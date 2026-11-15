import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import config from "../../config.json";
import { resolveScriptPath } from "../script/episodes";
import { readJson, readPlanFile } from "../plan/io";
import type { Plan, PlanScene } from "../plan/types";
import { loadChannel } from "../channel/index";
import type { VoiceProfile } from "../channel/types";
import { voiceIdFor } from "./elevenlabs";
import { speechContextFor, voiceDirFor } from "./generate";
import { effectiveLegacyTone, isTone, layersOf, legacyTunes, TONE_PRESET_VERSION, voiceSettingsFor, type Tone, type VoiceLayers } from "./tones";
import { normWord, stripTashkeel, vowelize } from "./tashkeel";
import { tashkeelReport } from "./tashkeelReport";
import { applyDictionary } from "./words";
import { hasBasmala } from "./basmala";
import { applyLexicon, loadLexicon, type LexiconEntry } from "./lexicon";
import { loadSays, ownerForSay, sayFor, type SentenceSay } from "./sentencePronunciation";
import { contextFingerprint, emptyDoc, reconcileScene, sentenceFingerprint, sentencesFor, normText, words, recordedOnOtherText, type Sentence, type SentenceCorrection, type SentencesDoc } from "./sentences";

/**
 * «الجمل» (D50): ملفاتها على القرص، وسياق الصوت (النبرة والإعدادات والنطق والبصمة، وما يُرسل وجارتاه)، وما يُحسب
 * منه لكل جملة (التشكيل، ورفض تصحيح الكلمة، وسبب الانتظار). بلا طلب صوت ولا تركيب.
 */

export const sentencesFileFor = (scriptPath: string) => path.join(voiceDirFor(scriptPath), "sentences.json");
export const sentencesDirFor = (scriptPath: string) => path.join(voiceDirFor(scriptPath), "sentences");
export const supersededDirFor = (scriptPath: string) => path.join(voiceDirFor(scriptPath), "superseded");

export const loadSentencesDoc = async (scriptPath: string): Promise<SentencesDoc> => {
  const d = await readJson<SentencesDoc>(sentencesFileFor(scriptPath));
  if (!d) return emptyDoc();
  if (d.version !== 1 || !d.scenes || typeof d.scenes !== "object") throw new Error("ملف الجمل (voice/sentences.json) غير صالح.");
  return d;
};
export const writeAtomic = async (file: string, text: string | Uint8Array) => {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  const fd = await open(temp, "wx", 0o644);
  try {
    try { await fd.writeFile(text); await fd.sync(); } finally { await fd.close(); }
    await rename(temp, file);
  } finally { await rm(temp, { force: true }); }
};
export const saveDoc = (scriptPath: string, doc: SentencesDoc) => writeAtomic(sentencesFileFor(scriptPath), JSON.stringify(doc, null, 2) + "\n");

/** المشاهد التي صوتها جملةً جملة (يستثنيها generateVoice ومسار الأجزاء والتجهيز) */
export const sentenceManagedScenes = async (scriptPath: string): Promise<Set<string>> => {
  let out = new Set<string>();
  try {
    out = new Set(Object.keys((await loadSentencesDoc(scriptPath)).scenes));
  } catch { /* no sentences yet */ }
  // A scene holding the basmala is always voiced sentence by sentence (its basmala is the owner's own
  // recording); the whole-scene and parts paths never voice it (owner decision 10 Nov).
  for (const id of await basmalaScenes(scriptPath)) out.add(id);
  return out;
};
/** Narrated scenes whose text contains the basmala (src/voice/basmala.ts). */
export const basmalaScenes = async (scriptPath: string): Promise<string[]> => {
  const plan = await readPlanFile(scriptPath).catch(() => null);
  return (plan?.chapters ?? []).flatMap((c) => c.scenes)
    .filter((sc) => sc.template !== "verse-card" && hasBasmala(sc.narration)).map((sc) => sc.id);
};

// ── سياق الصوت: النبرة والإعدادات والنطق والبصمة ──────────────────────────────

export type ToneMapLite = {
  raw: string;
  sha256: string;
  version: string;
  /** لكل مشهد: مقاطعه بالترتيب، وعدد كلماتها، ونبرة جزئها (بعد sceneOverrides) */
  scenes: Record<string, { words: number; tone: string }[]>;
  sentenceOverrides: Record<string, { tone?: string }>;
};
export const plainCount = (s: string) => words(stripTashkeel(s)).map(normWord).filter(Boolean).length;

export const loadToneMapLite = async (scriptPath: string): Promise<ToneMapLite | null> => {
  const { isPartsChannel, toneMapFileFor, applySceneOverrides } = await import("./dafatirParts");
  if (!isPartsChannel(scriptPath)) return null;
  const file = toneMapFileFor(scriptPath);
  if (!existsSync(file)) return null;
  const raw = await readFile(file, "utf8");
  const doc = JSON.parse(raw);
  const map = applySceneOverrides(doc);
  const partTone = new Map((map.audioParts ?? []).map((p: { id: string; tone: string }) => [p.id, p.tone]));
  const scenes: ToneMapLite["scenes"] = {};
  for (const s of [...(map.segments ?? [])].sort((a, z) => a.n - z.n))
    (scenes[s.scene] ??= []).push({ words: plainCount(s.text), tone: String(partTone.get(s.audioPart) ?? s.tone) });
  return { raw, sha256: createHash("sha256").update(raw).digest("hex"), version: String(doc.version ?? ""), scenes, sentenceOverrides: doc.sentenceOverrides ?? {} };
};

export type Ctx = {
  scriptPath: string;
  plan: Plan;
  doc: SentencesDoc;
  map: ToneMapLite | null;
  speech: Awaited<ReturnType<typeof speechContextFor>>;
  voiceKey: string;
  model: string;
  profile?: VoiceProfile;
  /** طبقة القناة عبر إصدارات النبرات (لبصمة التسجيلات القديمة) */
  layers: VoiceLayers;
  channelTone?: string;
  /** قاموس النطق للقناة (pronunciations.json): يُطبَّق عند الإرسال فقط */
  lexicon: LexiconEntry[];
  /** «النطق» المكتوب لجمل هذه الحلقة (D131، sentence-pronunciations.json): يُرسل بدل النطق الآلي */
  says: SentenceSay[];
};
export const loadCtx = async (episode: string): Promise<Ctx> => {
  const scriptPath = await resolveScriptPath(episode);
  const plan = await readPlanFile(scriptPath);
  if (!plan) throw new Error("خطة الحلقة غير موجودة.");
  const model = process.env.ELEVENLABS_MODEL_ID || config.voice.modelId;
  let profile: VoiceProfile | undefined;
  let channelTone: string | undefined;
  let layers: VoiceLayers = {};
  try {
    const v = loadChannel().voice;
    profile = v?.profile;
    channelTone = v?.tone;
    layers = layersOf(v);
  } catch { /* بلا قناة */ }
  return {
    scriptPath, plan, doc: await loadSentencesDoc(scriptPath), map: await loadToneMapLite(scriptPath),
    speech: await speechContextFor(scriptPath), voiceKey: `${voiceIdFor() ?? ""}|${model}`, model, profile, layers, channelTone,
    lexicon: (await loadLexicon()).entries, says: await loadSays(scriptPath),
  };
};

export const allScenes = (plan: Plan) => plan.chapters.flatMap((c) => c.scenes.map((scene) => ({ scene, chapter: c })));
export const isNarrated = (s: PlanScene) => s.template !== "verse-card" && Boolean(s.narration?.trim());

/** جمل المشهد كما تُعرض: المحفوظة (مصالَحة مع نص الخطة)، أو التقسيم الآلي بمعرّفات مؤقتة إن لم يبدأ العمل عليه */
export const sceneSentences = (ctx: Ctx, scene: PlanScene): { list: Sentence[]; managed: boolean } => {
  const stored = ctx.doc.scenes[scene.id];
  if (stored) return { list: reconcileScene(stored.sentences, scene.id, scene.narration), managed: true };
  let k = 0;
  return { list: sentencesFor(scene.id, scene.narration, () => `virtual-${scene.id}-${k++}`), managed: false };
};

/** النبرة الموروثة والصريحة للجملة */
export const toneOf = (ctx: Ctx, scene: PlanScene, list: Sentence[], s: Sentence) => {
  if (ctx.map?.scenes[scene.id]) {
    const segs = ctx.map.scenes[scene.id]!;
    let start = 0;
    for (const x of list) { if (x.id === s.id) break; start += plainCount(x.text); }
    let acc = 0;
    let inherited = segs[segs.length - 1]?.tone;
    for (const g of segs) { if (start < acc + g.words) { inherited = g.tone; break; } acc += g.words; }
    const explicit = ctx.map.sentenceOverrides[s.id]?.tone;
    const inh = isTone(inherited) ? inherited : undefined;
    return { explicit: isTone(explicit) ? explicit : undefined, inherited: inh, source: "map" as const };
  }
  const inherited = [scene.tone, ctx.plan.tone, ctx.channelTone].find(isTone);
  return { explicit: isTone(s.tone) ? s.tone : undefined, inherited, source: (isTone(scene.tone) ? "scene" : isTone(ctx.plan.tone) ? "episode" : "channel") as "scene" | "episode" | "channel" };
};

export const ttsSettings = () => {
  const { tailSeconds: _t, creditsPerChar: _c, ...tts } = config.voice;
  return tts;
};
export const spokenOf = (ctx: Ctx, text: string) => {
  const ws = words(text);
  return applyDictionary(normText(text), ctx.speech.dict, ctx.speech.tk ? vowelize(ws, ctx.speech.tk) : undefined);
};
/**
 * النص المرسل فعلًا: النطق (القاموس القديم والتشكيل) ثم قاموس النطق للقناة وتصحيحات الجملة.
 * البصمة من النطق قبل هذه الخطوة (spokenOf)، فإضافة كلمة للقاموس لا تُبطل تسجيلًا قائمًا.
 */
/** D131: «النطق» الذي كتبه المالك لهذه الجملة (جمل الراوي وحدها)، أو لا شيء */
export const sayOf = (ctx: Pick<Ctx, "says">, s: Pick<Sentence, "text" | "kind" | "sceneId">): string | undefined =>
  s.kind === "narration" && s.sceneId ? sayFor(ctx.says ?? [], s.sceneId, s.text) : undefined;
/** النطق الآلي (بلا «النطق» المكتوب): ما يُرسل لو لم يكتب المالك شيئًا */
export const autoSendOf = (ctx: Ctx, s: Pick<Sentence, "text" | "kind" | "corrections">, extra?: SentenceCorrection) => sendOf({ ...ctx, says: [] }, { ...s, sceneId: "" }, extra);
export const sendOf = (ctx: Ctx, s: Pick<Sentence, "text" | "kind" | "corrections"> & { sceneId?: string }, extra?: SentenceCorrection) => {
  const d = spokenOf(ctx, s.text);
  // D131: the owner's written pronunciation is sent exactly as written (no lexicon, no word corrections); the
  // captions keep the sentence's own words (owner map)
  const say = s.sceneId ? sayOf(ctx, { text: s.text, kind: s.kind, sceneId: s.sceneId }) : undefined;
  if (say) {
    const tokens = say.split(/\s+/).filter(Boolean);
    const owner = ownerForSay(d.original, tokens);
    const perWord = d.original.map((_, i) => tokens.filter((_, k) => owner[k] === i).join(" "));
    return { text: tokens.join(" "), original: d.original, owner, applied: [] as ReturnType<typeof applyLexicon>["applied"], perWord, custom: true };
  }
  const corrections = [...(s.corrections ?? []).filter((c) => !extra || c.index !== extra.index), ...(extra ? [extra] : [])];
  const l = applyLexicon(d.original, d.spoken.split(" ").filter(Boolean), d.owner, ctx.lexicon, { corrections, verse: s.kind === "verse" });
  /** لكل كلمة أصلية: ما يُنطق لها */
  const perWord = d.original.map((_, i) => l.spoken.filter((_, k) => l.owner[k] === i).join(" "));
  return { text: l.spoken.join(" "), original: d.original, owner: l.owner, applied: l.applied, perWord, custom: false };
};
/**
 * صوت الجملة: النبرة والإعدادات والبصمة. الإصدار الحالي للنبرات افتراضيًا؛ لكن تسجيلًا قائمًا بصمته تطابق إعدادات
 * نبرة سابقة (الإصدار ١ طبقة القناة، أو ٢ القوي D70) يبقى صالحًا: تُرجع إعدادات ذلك الإصدار وبصمته ومعها olderTone، فلا تصير الجملة
 * «تحتاج توليدًا» ولا تُعاد في «جهّز كل المشاهد»، وتصحيح كلمة فيه يُولَّد بإعداداته نفسها فيتصل الصوت.
 * current: للتوليد الجديد دائمًا (الإعدادات الحالية). version: لنسخة مقصوصة من تسجيل معروف الإصدار.
 */
export const voiceOf = (ctx: Ctx, scene: PlanScene, list: Sentence[], s: Sentence, o: { current?: boolean; version?: number; automatic?: boolean } = {}) => {
  const t = toneOf(ctx, scene, list, s);
  const tone = t.explicit ?? t.inherited;
  const d = spokenOf(ctx, s.text);
  // D131: the owner's written pronunciation is part of the take's fingerprint (a take made otherwise needs generating);
  // `automatic`: a cut of the scene's old file was not said with it
  const custom = o.automatic ? undefined : sayOf(ctx, s);
  // D132: a written pronunciation is what is sent, so its fingerprint is that text alone; tashkeel.md (or the old
  // dictionary) changes nothing for that sentence. `d131`: the form D131 stored (with the automatic spoken text too).
  const fpOf = (spoken: string, tune: ReturnType<typeof voiceSettingsFor>) =>
    sentenceFingerprint({ spoken, voiceKey: ctx.voiceKey, tts: ttsSettings(), tune, voiceId: scene.voice || undefined, ...(custom ? { exact: custom } : {}) });
  const fp = (tune: ReturnType<typeof voiceSettingsFor>) => fpOf(custom ?? d.spoken, tune);
  const tune = voiceSettingsFor(ctx.profile, tone, ctx.model);
  const fingerprint = fp(tune);
  const base = { tone, toneInfo: t, spoken: d, send: sendOf(ctx, o.automatic ? { ...s, sceneId: "" } : s), custom, currentFingerprint: fingerprint };
  if (!o.current) {
    // D136 «استعمل هذا التسجيل»: the take the owner chose himself stays current while it is on this very text
    if (s.chosen && s.audio && s.chosen === s.audio.file && s.audio.fingerprint !== fingerprint && !recordedOnOtherText(s))
      return { ...base, tune, fingerprint: s.audio.fingerprint, presetVersion: s.audio.presetVersion ?? 1, olderTone: false,
        pinnedTone: (isTone(s.audio.tone) ? s.audio.tone : undefined) as Tone | undefined, chosenTake: true };
    // A take recorded with the same written pronunciation under D131 (13 Nov) stays current.
    if (custom && s.audio && s.audio.fingerprint !== fingerprint && s.audio.fingerprint === fpOf(d.spoken, tune))
      return { ...base, tune, fingerprint: s.audio.fingerprint, presetVersion: TONE_PRESET_VERSION, olderTone: false, pinnedTone: undefined as Tone | undefined, chosenTake: false };
    // the tone as the earlier versions resolved it: a saved id that is no tone any more (grave) still names an old take
    const legacyTone = ctx.map?.scenes[scene.id] ? tone : effectiveLegacyTone(s.tone, scene.tone, ctx.plan.tone, ctx.channelTone);
    // D97 for old takes too: a take recorded with a known tone keeps it while only the inherited tone changed
    const legacyTones = [legacyTone, ...(!t.explicit && s.audio?.tone && s.audio.tone !== legacyTone ? [effectiveLegacyTone(s.audio.tone)] : [])];
    const legacy = [...new Set(legacyTones)].flatMap((lt) => legacyTunes(ctx.layers, lt, { text: s.text, modelId: ctx.model }))
      .map((l) => ({ ...l, fingerprint: fp(l.tune) })).filter((l) => l.fingerprint !== fingerprint);
    const pick = o.version !== undefined ? legacy.find((l) => l.version === o.version)
      : s.audio && s.audio.fingerprint !== fingerprint ? legacy.find((l) => l.fingerprint === s.audio!.fingerprint) : undefined;
    if (pick) return { ...base, tune: pick.tune, fingerprint: pick.fingerprint, presetVersion: pick.version, olderTone: true, pinnedTone: undefined as Tone | undefined, chosenTake: false };
    // D97: a take recorded with a known tone (audio.tone) stays valid when only the INHERITED tone changes
    // (the episode or scene tone chosen or changed later): the episode tone is a default for new generations.
    // A sentence whose own explicit tone differs from its take still needs generating (the owner chose it).
    const recTone = s.audio?.tone;
    if (s.audio && s.audio.fingerprint !== fingerprint && !t.explicit && isTone(recTone) && recTone !== tone) {
      const pinned = voiceSettingsFor(ctx.profile, recTone, ctx.model);
      if (fp(pinned) === s.audio.fingerprint)
        return { ...base, tone: recTone, tune: pinned, fingerprint: s.audio.fingerprint, presetVersion: TONE_PRESET_VERSION, olderTone: false, pinnedTone: recTone, chosenTake: false };
    }
  }
  return { ...base, tune, fingerprint, presetVersion: TONE_PRESET_VERSION, olderTone: false, pinnedTone: undefined as Tone | undefined, chosenTake: false };
};

/**
 * D136: «ولّد» would send exactly what made the current take (the same spoken text, tone direction, stability, voice,
 * model, seed policy and neighbours): the take is current by its own fingerprint and its neighbours are unchanged.
 * The owner is told «لم يتغير شيء يُرسل — سيخرج تسجيل مشابه» and confirms before anything is paid.
 */
export const wouldRepeat = (ctx: Ctx, scene: PlanScene, list: Sentence[], s: Sentence, flat: Flat[] = flatten(ctx)): boolean => {
  if (s.kind !== "narration" || !s.audio || recordedOnOtherText(s)) return false;
  const v = voiceOf(ctx, scene, list, s, { current: true });
  if (s.audio.fingerprint !== v.fingerprint) return false;
  // the text actually sent: the lexicon and word corrections are outside the fingerprint (D55), not outside the request
  if (s.audio.sent !== undefined ? s.audio.sent !== sentKey(v.send.text, v.tune?.direction)
    : JSON.stringify((s.audio.spokenFixes ?? []).map((x) => [x.word, x.say])) !== JSON.stringify(v.send.applied.map((a) => [a.word, a.say]))) return false;
  const nb = neighbours(flat, s.id);
  return s.audio.context === undefined || s.audio.context === contextFingerprint(nb.previousText, nb.nextText);
};
/** D136: a short key of the exact text a take was sent with (its performance direction included) */
export const sentKey = (text: string, direction?: string) => createHash("sha1").update(JSON.stringify([text, direction ?? ""])).digest("hex").slice(0, 16);
export const SAME_SEND = "لم يتغير شيء يُرسل — سيخرج تسجيل مشابه";

/**
 * نص الجارتين في تسلسل الحلقة (جمل الراوي فقط؛ الآية لا تدخل النص المجاور). KI-011 (D113): الآية حدّ لا يعبره
 * النص المجاور — مشهد آية (`verseBefore`: بين هذه الجملة والتي قبلها في التسلسل مشهد آية) أو جملة آية داخل المشهد؛
 * فتمهيد الآية «كما جاء في سورة طه:» لا يُرسل ومعه تمهيد الآية التالية بعدها.
 */
export type Flat = { scene: PlanScene; list: Sentence[]; s: Sentence; verseBefore?: boolean };
export const flatten = (ctx: Ctx): Flat[] => {
  const out: Flat[] = [];
  let verse = false;
  for (const { scene } of allScenes(ctx.plan)) {
    if (scene.template === "verse-card") { verse = true; continue; }
    if (!isNarrated(scene)) continue;
    const { list } = sceneSentences(ctx, scene);
    for (const s of list) { out.push({ scene, list, s, ...(verse ? { verseBefore: true } : {}) }); verse = false; }
  }
  return out;
};
export const neighbours = (flat: Flat[], id: string) => {
  const i = flat.findIndex((f) => f.s.id === id);
  let prev: Flat | undefined, next: Flat | undefined;
  if (i >= 0) {
    for (let j = i; j > 0 && !flat[j]!.verseBefore; j--) {
      const f = flat[j - 1]!;
      if (f.s.kind === "verse") break;
      if (f.s.kind === "narration") { prev = f; break; }
    }
    for (let j = i + 1; j < flat.length && !flat[j]!.verseBefore; j++) {
      const f = flat[j]!;
      if (f.s.kind === "verse") break;
      if (f.s.kind === "narration") { next = f; break; }
    }
  }
  return { previousText: prev?.s.text, nextText: next?.s.text };
};

/** التشكيل ≥ ٩٨٪ بعد التصحيحات: الكلمة المصحَّحة تُعدّ بنطقها المكتوب، وكلمات القاموس مغطاة (نطقها فُحص عند حفظه) */
export const coverageOf = (ctx: Ctx, id: string, text: string, corrections: SentenceCorrection[] = [], say?: string) => {
  // D131: a written pronunciation is what is sent, so its own tashkeel is checked (no file, no dictionary)
  if (say) {
    const r = tashkeelReport([{ id, narration: say }], { plain: [], voweled: [] });
    return { ok: r.ok, coverage: r.coverage, missing: r.gaps.flatMap((g) => g.words) };
  }
  const ws = words(text);
  const eff = ws.map((w, i) => corrections.find((c) => c.index === i && c.word === w)?.say ?? w).join(" ");
  const dict = { entries: [...(ctx.speech.dict.entries ?? []), ...ctx.lexicon.map((e) => ({ text: e.word, say: e.say }))] };
  const r = tashkeelReport([{ id, narration: eff }], ctx.speech.tk, dict);
  return { ok: r.ok, coverage: r.coverage, missing: r.gaps.flatMap((g) => g.words) };
};

/** لماذا لا تصلح إعادة نطق كلمة في التسجيل الحالي (null: تصلح) */
export const SAY_WORD_FIX = "نطق هذه الجملة مكتوب كاملًا في «النطق» تحتها؛ عدّل الكلمة هناك ثم ولّد الجملة.";
export const wordFixRefusal = (s: Sentence, fingerprint: string, custom?: string): string | null => {
  if (s.kind !== "narration") return "نص قرآني: لا يُعاد نطقه بالصوت المستنسخ أبدًا.";
  if (custom) return SAY_WORD_FIX;
  if (!s.audio) return "ولّد الجملة أولًا؛ إعادة نطق كلمة تعمل على تسجيل موجود.";
  if (s.audio.fingerprint !== fingerprint) return recordedOnOtherText(s)
    ? "تسجيلها قديم — سُجّل على نص سابق؛ ولّدها كاملة بنصها الحالي."
    : "تسجيلها لا يطابق إعدادها الحالي (تحتاج توليدًا)؛ ولّدها كاملة.";
  if (s.audio.timing === "estimated") return "توقيت كلمات تسجيلها تقديري (لم يُرجع النموذج محاذاة)؛ ولّدها كاملة.";
  const ws = s.audio.words;
  if (ws.length !== words(s.text).length) return "توقيت كلمات تسجيلها لا يطابق نصها؛ ولّدها كاملة.";
  for (let i = 0; i < ws.length; i++)
    if (!(ws[i]!.end > ws[i]!.start) || (i > 0 && ws[i]!.start < ws[i - 1]!.start - 1e-6)) return "توقيت كلمات تسجيلها غير صالح؛ ولّدها كاملة.";
  return null;
};
// A basmala sentence never needs a TTS take: its audio is the owner's recording (or a marked placeholder).
export const fresh = (ctx: Ctx, scene: PlanScene, list: Sentence[]) =>
  list.every((s) => s.kind === "basmala" || (s.kind === "narration" && s.audio && s.audio.fingerprint === voiceOf(ctx, scene, list, s).fingerprint));
export const waitingReason = (ctx: Ctx, scene: PlanScene, list: Sentence[], hasOld = false): string | null => {
  if (list.some((s) => s.kind === "verse")) return "في هذا المشهد نص قرآني داخل التعليق؛ الصوت المستنسخ لا يتلوه. انقله إلى مشهد آية من محرر المشهد.";
  const notCurrent = list.filter((s) => s.kind !== "basmala" && (!s.audio || s.audio.fingerprint !== voiceOf(ctx, scene, list, s).fingerprint));
  const n = notCurrent.length;
  if (!n) return null;
  // D97: say how many of them hold a take recorded on an earlier text («قديم»), so the owner knows they can be heard
  const old = notCurrent.filter((s) => s.audio && recordedOnOtherText(s)).length;
  return `جمل بلا صوت حالي: ${n.toLocaleString("ar-EG")}${old ? ` (منها ${old.toLocaleString("ar-EG")} «قديم» سُجّل على نص سابق)` : ""}. يُركَّب صوت المشهد من جمله حين تُولَّد كلها${hasOld ? "، وحتى ذلك يبقى صوته السابق كما هو" : ""}.`;
};
