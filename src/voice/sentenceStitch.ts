import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rename, unlink } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { readJson } from "../plan/io";
import type { PlanScene } from "../plan/types";
import { encodeWav, renderBoundaries } from "../remotion/dafatir/audio/compose";
import { TRIM_DEFAULTS, warnAlignmentClamp } from "../remotion/dafatir/audio/trim";
import { voiceDirFor, type VoiceClip, type VoiceIndex } from "./generate";
import { isSupersededVersion } from "./tones";
import { BASMALA_KEY, BASMALA_PLACEHOLDER_SEC, hasBasmala } from "./basmala";
import { snapBoundary, SPLICE } from "./wordSplice";
import { clampPause, contextFingerprint, cutPoints, reconcileScene, sceneNarration, sentencesFor, normText, sceneAdoption, splitBasmalaInList, words, type Sentence, type SentenceAudio, type SentencesDoc, type TimedWord } from "./sentences";
import { sentencesFileFor, sentencesDirFor, supersededDirFor, writeAtomic, saveDoc, type Ctx, loadCtx, allScenes, isNarrated, voiceOf, flatten, neighbours, fresh, waitingReason } from "./sentenceContext";

/**
 * التقسيم والتركيب (العمل ٨): بدء المشهد جملةً جملة وقص صوته القائم على جمله، وقص الصوت بالكلمات، وصوت المشهد
 * من تسجيلات جمله بوقفاتها (والبسملة بتسجيل المالك). لا طلب صوت هنا أبدًا: لا مزوّد ولا مفتاح.
 */
export const SENTENCE_SAMPLE_RATE = 44100;
/** صمت بعد آخر كلام في ملف المشهد (الذيل الذي يضيفه الرندر يبقى كما هو) */
export const TAIL_PAD = 0.25;
export const MAX_GAIN = 2; // ±6 dB

// ── الصوت: فكّ، قص، تركيب ────────────────────────────────────────────────────

export const decode = async (file: string) => (await import("./dafatirParts")).decodeAudio(file, SENTENCE_SAMPLE_RATE);
export const sliceWav = (pcm: Float32Array, a: number, b: number) =>
  encodeWav(pcm.subarray(Math.max(0, Math.floor(a * SENTENCE_SAMPLE_RATE)), Math.min(pcm.length, Math.ceil(b * SENTENCE_SAMPLE_RATE))), SENTENCE_SAMPLE_RATE);
export const shiftWords = (ws: TimedWord[], by: number) => ws.map((w) => ({ word: w.word, start: Math.max(0, w.start + by), end: Math.max(0, w.end + by) }));

/**
 * يقص تسجيلًا واحدًا (صوت مشهد قديم، أو جملة تُقسم) إلى أجزاء بتوقيت كلماته، إن كان القص موثوقًا.
 * الملف الأصلي لا يُمس؛ الأجزاء نسخ جديدة في voice/sentences/.
 */
export const sliceByWords = async (o: { scriptPath: string; source: string; sourceWords: TimedWord[]; duration: number; parts: { id: string; count: number }[]; tag: string }):
  Promise<{ ok: true; files: { id: string; file: string; duration: number; words: TimedWord[] }[] } | { ok: false; reason: string }> => {
  const cp = cutPoints(o.sourceWords, o.parts.map((p) => p.count));
  if (!cp.ok) return cp;
  const pcm = await decode(o.source);
  const total = pcm.length / SENTENCE_SAMPLE_RATE || o.duration;
  // كل حد إلى أهدأ نقطة داخل الوقفة نفسها (لا يدخل كلمة): الوقفة تبقى كما هي موزّعة بين الجملتين
  let k0 = 0;
  const cuts = cp.cuts.map((c, j) => {
    k0 += o.parts[j]!.count;
    const lo = o.sourceWords[k0 - 1]!.end, hi = o.sourceWords[k0]!.start;
    const x = snapBoundary(pcm, SENTENCE_SAMPLE_RATE, c, Math.min(SPLICE.snapSec, (hi - lo) / 2));
    return Math.min(hi, Math.max(lo, x));
  });
  const bounds = [0, ...cuts, total];
  const dir = sentencesDirFor(o.scriptPath);
  await mkdir(dir, { recursive: true });
  const out = [];
  let w = 0;
  for (const [k, p] of o.parts.entries()) {
    const a = bounds[k]!, b = bounds[k + 1]!;
    const file = `${p.id}-${o.tag}-${randomUUID().slice(0, 8)}.wav`;
    await writeAtomic(path.join(dir, file), sliceWav(pcm, a, b));
    out.push({ id: p.id, file, duration: b - a, words: shiftWords(o.sourceWords.slice(w, w + p.count), -a) });
    w += p.count;
  }
  return { ok: true, files: out };
};

/**
 * The basmala audio for the episode (bytes verified), or undefined: the episode's own approved recording first (it
 * stays exactly as it is, e.g. «دفاتر الزمن» 001), else the owner's one approved clip (D239) while its sha256 matches.
 */
export const approvedBasmala = async (scriptPath: string): Promise<{ file: string; path: string; sha256: string } | undefined> => {
  const { verifiedOwnRecitations } = await import("../quran/manualAudio");
  const { recitationsDirFor } = await import("../quran/sync");
  const rec = (await verifiedOwnRecitations(scriptPath))[BASMALA_KEY];
  const part = rec?.parts?.[0];
  if (rec?.sha256 && part) return { file: part.file, path: path.join(recitationsDirFor(scriptPath), part.file), sha256: rec.sha256 };
  const { installedBasmalaClip } = await import("./basmalaClip");
  const clip = await installedBasmalaClip();
  return clip ? { file: clip.file, path: clip.path, sha256: clip.sha256 } : undefined;
};

/**
 * After the owner approves (or withdraws) the basmala recording: every scene holding the basmala is composed
 * again with it (or with the placeholder), so its draft re-opens with the real audio. Scenes not started
 * sentence by sentence yet are started (their split saved); their narration sentences keep their takes.
 */
export const recomposeBasmalaScenes = async (episode: string): Promise<string[]> => {
  const { serialized } = await import("../studio/sceneService");
  const scriptPath = await resolveScriptPath(episode);
  const done: string[] = [];
  await serialized(sentencesFileFor(scriptPath), async () => {
    const ctx = await loadCtx(episode);
    for (const { scene } of allScenes(ctx.plan)) {
      if (!isNarrated(scene) || !hasBasmala(scene.narration)) continue;
      if (ctx.doc.scenes[scene.id]) ctx.doc.scenes[scene.id]!.sentences = reconcileScene(ctx.doc.scenes[scene.id]!.sentences, scene.id, scene.narration);
      await initScene(ctx, scene);
      const rec = ctx.doc.scenes[scene.id]!;
      rec.sentences = splitBasmalaInList(rec.sentences);
      const r = await composeSentenceScene(ctx, scene, rec.sentences);
      if (r.composed) done.push(scene.id);
    }
    await saveDoc(scriptPath, ctx.doc);
  });
  return done;
};

/** The identity of a scene sound composed from its sentences ([id, file, fingerprint, pause] each, and the lead). */
export const compositionHash = (entries: [string, string, string, number][], pre: number) =>
  createHash("sha1").update(JSON.stringify({ sentences: entries, pre })).digest("hex").slice(0, 16);

/** يركّب صوت المشهد من جمله ويكتبه في index.json (المسار الذي يقرؤه الرندر والسجل). */
export const composeSentenceScene = async (ctx: Ctx, scene: PlanScene, list: Sentence[]): Promise<{ composed: boolean; reason?: string; file?: string }> => {
  const reason = fresh(ctx, scene, list) ? null : waitingReason(ctx, scene, list);
  if (reason) return { composed: false, reason };
  const { measurePart, sequenceFor } = await import("./dafatirParts");
  const dir = sentencesDirFor(ctx.scriptPath);
  const SR = SENTENCE_SAMPLE_RATE;
  const items: { s: Sentence; pcm: Float32Array; clip: { start: number; end: number; speechStart: number; speechEnd: number }; rms: number }[] = [];
  // The basmala: the owner's approved recording, or a marked silent placeholder until it is approved.
  const basmalaRec = list.some((s) => s.kind === "basmala") ? await approvedBasmala(ctx.scriptPath) : undefined;
  const basmalaAudio = new Map<string, SentenceAudio>();
  const clamped: Record<string, number> = {};
  for (const s of list) {
    let pcm: Float32Array;
    if (s.kind === "basmala") {
      pcm = basmalaRec ? await decode(basmalaRec.path) : new Float32Array(Math.round(BASMALA_PLACEHOLDER_SEC * SR));
      const dur = pcm.length / SR;
      const ws = words(s.text);
      const a: SentenceAudio = { file: basmalaRec?.file ?? "", fingerprint: basmalaRec?.sha256 ?? "pending", context: "", duration: dur,
        words: ws.map((w, i) => ({ word: w, start: (dur * i) / ws.length, end: (dur * (i + 1)) / ws.length })), at: new Date().toISOString(), origin: "scene", timing: "estimated" };
      basmalaAudio.set(s.id, a);
      // A silent placeholder has no speech to measure: the whole length counts as its "speech".
      const clip = basmalaRec ? measurePart(s.id, pcm, SR, a.words).clip : { start: 0, end: dur, speechStart: 0, speechEnd: dur };
      items.push({ s, pcm, clip, rms: 0 });
      continue;
    }
    pcm = await decode(path.join(dir, s.audio!.file));
    // D110: a bounded overshoot is clamped (shared rule, src/remotion/dafatir/audio/trim.ts) and named in the row
    const clip = measurePart(s.id, pcm, SR, s.audio!.words, (c) => {
      warnAlignmentClamp("الجملة " + s.id, c);
      if (c.overshootEndSec > 0.005 || c.undershootStartSec > 0.005) clamped[s.id] = Math.round(Math.max(c.overshootEndSec, c.undershootStartSec) * 1000);
    }).clip;
    let sum = 0, n = 0;
    for (let i = Math.floor(clip.speechStart * SR); i < Math.min(pcm.length, Math.ceil(clip.speechEnd * SR)); i++) { sum += pcm[i]! * pcm[i]!; n++; }
    items.push({ s, pcm, clip, rms: n ? Math.sqrt(sum / n) : 0 });
  }
  const levels = items.map((x) => x.rms).filter((x) => x > 1e-5).sort((a, b) => a - b);
  const target = levels.length ? levels[Math.floor(levels.length / 2)]! : 0;
  let t = 0;
  const placedAt: number[] = [];
  const placed = items.map((x, k) => {
    const lead = x.clip.speechStart - x.clip.start;
    if (k > 0) {
      const prev = items[k - 1]!;
      const prevEnd = placedAt[k - 1]! + (prev.clip.speechEnd - prev.clip.start);
      t = Math.max(placedAt[k - 1]!, prevEnd + prev.s.pauseAfterMs / 1000 - lead);
    }
    placedAt.push(t);
    // The owner's recording keeps its own polished loudness (rms 0 → gain 1), like a verse recitation.
    const gain = target && x.rms > 1e-5 ? Math.min(MAX_GAIN, Math.max(1 / MAX_GAIN, target / x.rms)) : 1;
    return { ...x, at: t, gain };
  });
  const last = placed[placed.length - 1]!;
  const speechStart = placed[0]!.at + (placed[0]!.clip.speechStart - placed[0]!.clip.start);
  const speechEnd = last.at + (last.clip.speechEnd - last.clip.start);
  const audioEnd = Math.max(last.at + (last.clip.end - last.clip.start), speechEnd + TAIL_PAD);
  // دفاتر الزمن (خريطة نبرة): سياسة الصمت نفسها عند الحدود (رأس بعد الآية، وذيل الحد)، كمسار الأجزاء
  let pre = 0;
  let timing: VoiceClip["timing"];
  if (ctx.map) {
    const b = renderBoundaries(sequenceFor(ctx.plan), { [scene.id]: { speechStart, speechEnd, audioEnd } }, undefined, { assumedLead: TRIM_DEFAULTS.onsetPadSec }).boundaries[scene.id];
    if (b) {
      pre = b.pre;
      timing = { pre: b.pre, tail: b.tail, seconds: b.seconds, speechStart: speechStart + pre, speechEnd: speechEnd + pre, toneMap: ctx.map.sha256, parts: [] };
    }
  }
  const total = pre + audioEnd;
  const out = new Float32Array(Math.ceil(total * SR) + 1);
  for (const p of placed) {
    const a = Math.floor(p.clip.start * SR), z = Math.min(p.pcm.length, Math.ceil(p.clip.end * SR));
    const at = Math.round((p.at + pre) * SR);
    for (let i = a; i < z && at + i - a < out.length; i++) out[at + i - a] = out[at + i - a]! + p.pcm[i]! * p.gain;
  }
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]!));
  if (peak > 0.98) for (let i = 0; i < out.length; i++) out[i] = out[i]! * (0.98 / peak);
  const audioOf = (x: Sentence) => basmalaAudio.get(x.id) ?? x.audio!;
  const sceneWords = placed.flatMap((p) => shiftWords(audioOf(p.s).words, p.at + pre - p.clip.start));
  const hash = compositionHash(placed.map((p) => [p.s.id, audioOf(p.s).file, audioOf(p.s).fingerprint, p.s.pauseAfterMs]), pre);
  const file = `${hash}.wav`;
  const vdir = voiceDirFor(ctx.scriptPath);
  if (!existsSync(path.join(vdir, file))) await writeAtomic(path.join(vdir, file), encodeWav(out, SR));
  const narration = scene.narration.trim();
  const clip: VoiceClip = { file, hash, text: narration, duration: total, words: sceneWords, ...(timing ? { timing } : {}), sentences: { hash, ids: list.map((s) => s.id),
    // KI-066: the take of each sentence this sound holds, so the studio can say when a newer take is not in it
    takes: Object.fromEntries(placed.map((p) => [p.s.id, audioOf(p.s).file])), ...(Object.keys(clamped).length ? { clamped } : {}) },
    ...(basmalaAudio.size ? { basmala: { pending: !basmalaRec, sha256: basmalaRec?.sha256 ?? null } } : {}) };
  // index.json يُقرأ من جديد قبل الكتابة: لا يُمس مشهد آخر
  const indexFile = path.join(vdir, "index.json");
  const index = (await readJson<VoiceIndex>(indexFile)) ?? {};
  const old = index[scene.id];
  index[scene.id] = clip;
  const stillUsed = (f: string) => Object.values(index).some((c) => c.file === f);
  if (old && old.file !== file && !stillUsed(old.file) && path.basename(old.file) === old.file && existsSync(path.join(vdir, old.file))) {
    if (old.sentences) await unlink(path.join(vdir, old.file)).catch(() => {}); // تركيب سابق من الجمل: يُعاد من ملفاتها
    else {
      // صوت المشهد المدفوع: يُنقل ولا يُحذف
      const sup = supersededDirFor(ctx.scriptPath);
      await mkdir(sup, { recursive: true });
      const target = existsSync(path.join(sup, old.file)) ? `${Date.now().toString(36)}-${old.file}` : old.file;
      await rename(path.join(vdir, old.file), path.join(sup, target));
      const rec = ctx.doc.scenes[scene.id];
      if (rec) rec.replaced = [...(rec.replaced ?? []), { file: old.file, hash: old.hash, movedTo: `superseded/${target}`, at: new Date().toISOString() }];
    }
  }
  await writeAtomic(indexFile, JSON.stringify(index, null, 2) + "\n");
  return { composed: true, file };
};

/** يبدأ العمل جملةً جملة على مشهد: يحفظ التقسيم الآلي، ويقص صوت المشهد القديم إلى الجمل إن أمكن بثقة */
export const initScene = async (ctx: Ctx, scene: PlanScene) => {
  if (ctx.doc.scenes[scene.id]) return;
  const list = sentencesFor(scene.id, scene.narration);
  if (sceneNarration(list) !== normText(scene.narration)) throw new Error("تعذّر تقسيم نص المشهد دون تغيير كلماته.");
  const index = (await readJson<VoiceIndex>(path.join(voiceDirFor(ctx.scriptPath), "index.json"))) ?? {};
  const clip = index[scene.id];
  let imp: SentencesDoc["scenes"][string]["import"] = { state: "none", note: "لا صوت سابق لهذا المشهد." };
  const source = clip ? path.join(voiceDirFor(ctx.scriptPath), clip.file) : "";
  if (clip && (clip.text !== scene.narration.trim() || path.basename(clip.file) !== clip.file || !existsSync(source)))
    imp = { state: "unreliable", note: "صوت المشهد السابق لنص قديم أو ملفه غير موجود؛ بقي كما هو، والجمل تبدأ بلا صوت." };
  else if (clip) {
    const r = await adoptSceneAudio(ctx, scene, list, clip);
    imp = r.ok ? { state: "imported", note: "قُصّ صوت المشهد السابق إلى جمله بتوقيت كلماته؛ الملف الأصلي كما هو." }
      : { state: "unreliable", note: `لم يُقص صوت المشهد السابق إلى جمل (${r.reason})؛ بقي صوت المشهد كما هو حتى تُولَّد الجمل.` };
  }
  ctx.doc.scenes[scene.id] = { sentences: list, createdAt: new Date().toISOString(), import: imp };
};

/**
 * يقص صوت المشهد ملفًا واحدًا إلى جمله بتوقيت كلماته (D63): نسخ جديدة في voice/sentences/ بأصل «scene» («من صوت المشهد»)
 * لكل جملة بلا تسجيل، والحدود في أهدأ نقطة داخل كل وقفة، ووقفة كل جملة = وقفتها في التسجيل (فيبقى الإيقاع إن رُكّب
 * المشهد من جمله لاحقًا). بلا أي طلب مدفوع، ولا يمس index.json ولا ملف المشهد ولا الخطة، فلا تتغير بصمة صوت
 * المشهد في السجل ولا اعتماده. يغيّر list في مكانه.
 */
export const adoptSceneAudio = async (ctx: Ctx, scene: PlanScene, list: Sentence[], clip: VoiceClip): Promise<{ ok: true } | { ok: false; reason: string }> => {
  const source = path.join(voiceDirFor(ctx.scriptPath), clip.file);
  if (clip.text !== scene.narration.trim() || path.basename(clip.file) !== clip.file || !existsSync(source))
    return { ok: false, reason: "صوت المشهد لنص قديم أو ملفه غير موجود" };
  const can = sceneAdoption(clip, list.map((s) => s.text));
  if (!can.ok) return can;
  const r = await sliceByWords({ scriptPath: ctx.scriptPath, source, sourceWords: clip.words, duration: clip.duration,
    parts: list.map((s) => ({ id: s.id, count: words(s.text).length })), tag: `scene-${clip.hash}` });
  if (!r.ok) return r;
  const flatCtx = { ...ctx, doc: { ...ctx.doc, scenes: { ...ctx.doc.scenes, [scene.id]: { sentences: list, createdAt: "", import: { state: "none" as const } } } } };
  const flat = flatten(flatCtx);
  let w = 0;
  for (const [k, s] of list.entries()) {
    const count = words(s.text).length;
    const f = r.files.find((x) => x.id === s.id)!;
    const next = clip.words[w + count];
    if (!s.audio) {
      const nb = neighbours(flat, s.id);
      // النسخة المقصوصة بإصدار نبرات مقطع المشهد نفسه (غيابه = ١): لا تصير «حالية» وهي بالإعدادات القديمة
      const cv = clip.presetVersion ?? 1;
      s.audio = { file: f.file, fingerprint: voiceOf(ctx, scene, list, s, isSupersededVersion(cv) ? { version: cv, automatic: true } : { automatic: true }).fingerprint, context: contextFingerprint(nb.previousText, nb.nextText),
        duration: f.duration, words: f.words, at: new Date().toISOString(), origin: "scene", timing: "aligned" };
      if (next && k < list.length - 1) s.pauseAfterMs = clampPause((next.start - clip.words[w + count - 1]!.end) * 1000);
    } else {
      // تسجيل الجملة قائم: النسخة المقصوصة لا تُستعمل (تُحذف، فهي نسخة مجانية من ملف المشهد)
      await unlink(path.join(sentencesDirFor(ctx.scriptPath), f.file)).catch(() => {});
    }
    w += count;
  }
  return { ok: true };
};
