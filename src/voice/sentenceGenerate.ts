import path from "node:path";
import { randomInt } from "node:crypto";
import { mkdir } from "node:fs/promises";
import config from "../../config.json";
import type { PlanScene } from "../plan/types";
import { loadStoryboard, storyboardBlockMessage, storyboardStatus, unapprovedScenes } from "../plan/storyboard";
import { encodeWav } from "../remotion/dafatir/audio/compose";
import { audioDuration, estimateWords } from "./generate";
import { capsFor, dropTagWords } from "./models";
import { applyTempo, scaleTimes } from "./tempo";
import { alignmentToWords, wordsForCaptions } from "./words";
import { planVerseTexts } from "./quranGuard";
import { checkSay, coreOf, quranMask } from "./lexicon";
import { isNoopSay } from "./pronunciationRules";
import { remapWords, spliceWord, type SpliceCheck } from "./wordSplice";
import { contextFingerprint, words, type Sentence, type SentenceAudio, type SentenceCorrection, type TimedWord } from "./sentences";
import { sentencesDirFor, writeAtomic, type Ctx, sendOf, sayOf, voiceOf, flatten, neighbours, coverageOf, wordFixRefusal, sentKey } from "./sentenceContext";
import { SENTENCE_SAMPLE_RATE, decode } from "./sentenceStitch";
import type { SentenceActionOptions } from "./sentenceVoice";

/**
 * طلب الصوت المدفوع لجملة واحدة (التوليد وإعادة نطق كلمة)، عبر عميل ElevenLabs القائم وحده: هو يبني الطلب ويمرره
 * على حارس القرآن `assertNoQuranForTts` ثم على مزوّد الصوت (src/voice/provider.ts). البوابات قبله كلها هنا (voiceGates).
 */
/** بوابات أي طلب صوت مدفوع لجملة (التوليد وإعادة نطق كلمة): الآية، التشكيل، الاعتمادات، النبرة، المفتاح، تدريب الصوت */
export const voiceGates = async (ctx: Ctx, episode: string, scene: PlanScene, list: Sentence[], s: Sentence, opts: SentenceActionOptions, corrections: SentenceCorrection[] = s.corrections ?? [], mode: { current?: boolean } = {}) => {
  if (s.kind === "basmala") throw new Error("البسملة يسجلها صاحب القناة بصوته ولا ينطقها الصوت المستنسخ: «ارفع التسجيل» في صفها.");
  if (s.kind !== "narration") throw new Error("هذه الجملة نص قرآني؛ الصوت المستنسخ لا يتلو القرآن أبدًا. انقلها إلى مشهد آية وارفع تلاوتها.");
  const cov = coverageOf(ctx, s.id, s.text, corrections, sayOf(ctx, s));
  if (!cov.ok) {
    if (!ctx.speech.tk && cov.coverage < 1) throw new Error("لا توجد نسخة مشكولة (tashkeel.md) لهذه الحلقة؛ أضفها أو اكتب التشكيل في نص الجملة قبل توليد صوتها.");
    throw new Error(`تشكيل هذه الجملة ${Math.round(cov.coverage * 1000) / 10}% وأقل من الحد ٩٨٪؛ كلمات بلا تشكيل: ${cov.missing.slice(0, 8).join("، ")}. اكتب التشكيل في نص الجملة نفسها أو حدّث tashkeel.md، ثم ولّدها.`);
  }
  if (!opts.testOnlySkipApprovalGates) {
    // Ledger first (11 Nov): it records a board changed after «اعتمد التجهيز» and refuses a blocked scene.
    const { requireScenesProducible } = await import("../studio/sceneService");
    await requireScenesProducible(episode, [scene.id]);
    const sb = storyboardStatus(ctx.plan, await loadStoryboard(ctx.scriptPath));
    const blocked = unapprovedScenes(sb, [scene.id]);
    if (blocked.length) throw new Error(storyboardBlockMessage(blocked, sb));
    // D234: لا صوت لسكريبت فيه جملة لم تمرّ بمحرر المحتوى (الاستثناء الصريح الوحيد: مشاهد D229)
    const { assertEditorPassed } = await import("../studio/scriptPipelineStore");
    await assertEditorPassed(ctx.scriptPath, { voiceScenes: [scene.id] });
  }
  const v = voiceOf(ctx, scene, list, s, mode);
  if (!v.tone) throw new Error("اختر نبرة لهذه الجملة، أو نبرة الحلقة (تحرير المشهد ← «نبرة الصوت في الحلقة») فتسري على كل جملة بلا نبرة خاصة.");
  if (!opts.client) throw new Error("مفاتيح ElevenLabs غير موجودة. أضف المفتاح واختر الصوت من تبويب «الإعدادات» في الاستوديو.");
  if (opts.client.voiceInfo) {
    const info = await opts.client.voiceInfo().catch(() => null);
    const state = info?.category === "professional" ? info.training[ctx.model] : undefined;
    if (info?.category === "professional" && state !== "fine_tuned")
      throw new Error(`صوتك «${info.name}» غير مدرَّب بعد على ${ctx.model}${state ? ` (الحالة: ${state})` : ""}؛ اختر نموذجًا آخر من «الإعدادات» أو انتظر التدريب.`);
  }
  return { v, client: opts.client };
};
/** D136: a fresh seed for a regeneration (ElevenLabs: an integer 0…4294967295) */
export const newSeed = () => randomInt(1, 4_294_967_295);
export const speedFor = (ctx: Ctx, tune: { speed?: number } | undefined) => (capsFor(ctx.model).speed === "post" ? (tune?.speed ?? config.voice.speed) : 1);

export const generateOne = async (ctx: Ctx, episode: string, scene: PlanScene, list: Sentence[], s: Sentence, opts: SentenceActionOptions) => {
  // توليد جديد: بإعدادات النبرات الحالية دائمًا (ولو كان تسجيلها الحالي بالإصدار السابق)
  const { v, client } = await voiceGates(ctx, episode, scene, list, s, opts, s.corrections ?? [], { current: true });
  const nb = neighbours(flatten(ctx), s.id);
  // D136: a regeneration varies the seed (a fixed seed gave a near-copy of the take it replaces); the first take keeps
  // config.voice.seed. The seed is stored with the take, so any take can be reproduced. Not part of the fingerprint.
  const seed = s.audio ? newSeed() : config.voice.seed;
  const r = await client.tts(v.send.text, { previousText: nb.previousText, nextText: nb.nextText, voiceId: scene.voice || undefined, tune: v.tune,
    scene: { id: scene.id, template: scene.template, ayahKey: scene.ayahKey }, verses: planVerseTexts(ctx.plan), seed });
  const speed = speedFor(ctx, v.tune);
  const audio = await applyTempo(r.audio, speed);
  const dir = sentencesDirFor(ctx.scriptPath);
  await mkdir(dir, { recursive: true });
  // اسم جديد لكل توليد: لا يُكتب فوق تسجيل سابق أبدًا
  const file = `${s.id}-${v.fingerprint}-${Date.now().toString(36)}.mp3`;
  await writeAtomic(path.join(dir, file), audio);
  let duration = (await audioDuration(path.join(dir, file))) ?? 0;
  const spokenWords = r.alignment ? scaleTimes(dropTagWords(alignmentToWords(r.alignment)), speed) : estimateWords(v.send.text, duration);
  if (!duration) duration = spokenWords.length ? spokenWords[spokenWords.length - 1]!.end : 0;
  const capWords = wordsForCaptions(v.send.original, v.send.owner, spokenWords);
  const take: SentenceAudio = { file, fingerprint: v.fingerprint, context: contextFingerprint(nb.previousText, nb.nextText), duration, words: capWords,
    at: new Date().toISOString(), origin: "tts", ...(v.tone ? { tone: v.tone } : {}), presetVersion: v.presetVersion, timing: r.alignment ? "aligned" : "estimated",
    ...(v.send.applied.length ? { spokenFixes: v.send.applied.map((a) => ({ word: a.word, say: a.say })) } : {}), seed, sent: sentKey(v.send.text, v.tune?.direction) };
  return list.map((x) => (x.id === s.id ? { ...x, audio: take, takes: x.audio ? [...(x.takes ?? []), x.audio] : x.takes, heard: undefined, chosen: undefined } : x));
};

/** تصحيح كلمة من طلب المالك: رقمها ونطقها المكتوب، بعد الفحص (لا قرآن، تشكيل كامل) */
export const correctionFor = (s: Sentence, index: unknown, say: unknown): SentenceCorrection => {
  const ws = words(s.text);
  const i = Math.round(Number(index));
  if (!(i >= 0 && i < ws.length)) throw new Error("الكلمة غير موجودة في الجملة؛ حدّث الصفحة.");
  if (s.kind !== "narration" || quranMask(ws)[i]) throw new Error("النص القرآني لا يُغيَّر نطقه ولا يُعاد بالصوت المستنسخ أبدًا.");
  // KI (15 Nov): the word as written (even without tashkeel) is not a pronunciation to check: it removes the earlier
  // correction (withCorrection), and the word is sent automatically again (tashkeel.md / the channel lexicon).
  if (!isNoopSay(ws[i]!, String(say ?? ""))) {
    const bad = checkSay(String(say ?? ""));
    if (bad) throw new Error(bad);
  }
  return { index: i, word: ws[i]!, say: String(say).trim().replace(/\s+/g, " ") };
};
/**
 * The correction is saved with the sentence; one that says the word exactly as written (D66) is not a correction:
 * it removes any earlier correction of that word, so the word is sent as written again.
 */
export const withCorrection = (s: Sentence, c: SentenceCorrection): Sentence => {
  const rest = (s.corrections ?? []).filter((x) => x.index !== c.index);
  const corrections = isNoopSay(c.word, c.say) ? rest : [...rest, c].sort((a, z) => a.index - z.index);
  return { ...s, corrections: corrections.length ? corrections : undefined };
};

export type WordFixOutcome = { ok: boolean; index: number; word: string; say: string; reasons: string[]; check?: SpliceCheck; savedToLexicon?: boolean };

/**
 * «أعد نطق الكلمة»: مقطع قصير (الكلمة المصحَّحة بين جارتيها) بالصوت والنبرة والإعدادات والبذرة نفسها، مع بقية الجملة
 * والجارتين نصًا مجاورًا؛ تُقص الكلمة منه بتوقيتها وتوصل في تسجيل الجملة مكان القديمة (wordSplice.ts). نجح الفحص:
 * تسجيل جديد (والسابق في takes). لم ينجح: لا يتغير التسجيل، والمقطع المدفوع يبقى على القرص.
 */
export const fixWord = async (ctx: Ctx, episode: string, scene: PlanScene, list: Sentence[], s: Sentence, c: SentenceCorrection, opts: SentenceActionOptions & { neighbours?: 1 | 2 }):
  Promise<{ list: Sentence[]; outcome: WordFixOutcome }> => {
  const base0 = voiceOf(ctx, scene, list, s);
  if (base0.chosenTake) throw new Error("هذا التسجيل اخترته وهو بنبرة أو نطق غير المختار الآن؛ ولّد الجملة أولًا ثم صحّح الكلمة.");
  const refusal = wordFixRefusal(s, base0.fingerprint, base0.custom);
  if (refusal) throw new Error(refusal);
  // The word as written (noop) removes the earlier correction: the fragment says the word automatically (its
  // tashkeel / the lexicon), never the old correction and never the bare undiacritized word.
  const noop = isNoopSay(c.word, c.say);
  const rest = (s.corrections ?? []).filter((x) => x.index !== c.index);
  const { v, client } = await voiceGates(ctx, episode, scene, list, s, opts, noop ? rest : [...rest, c]);
  const fixed = noop ? sendOf(ctx, { ...s, corrections: rest }) : sendOf(ctx, s, c);
  const ws = words(s.text);
  const k = c.index;
  const tokens = (i: number) => (i >= 0 && i < ws.length ? fixed.perWord[i]!.split(" ").filter(Boolean) : []);
  const n = opts.neighbours ?? 1;
  const around = (from: number, to: number) => { const out: string[] = []; for (let i = from; i <= to; i++) out.push(...tokens(i)); return out; };
  const prevT = around(k - n, k - 1), target = tokens(k), nextT = around(k + 1, k + n);
  const fragment = [...prevT, ...target, ...nextT].join(" ");
  const nb = neighbours(flatten(ctx), s.id);
  const before = [nb.previousText, ws.slice(0, Math.max(0, k - n)).join(" ")].filter(Boolean).join(" ");
  const after = [ws.slice(k + n + 1).join(" "), nb.nextText].filter(Boolean).join(" ");
  const r = await client.tts(fragment, { previousText: before || undefined, nextText: after || undefined, voiceId: scene.voice || undefined, tune: v.tune,
    scene: { id: scene.id, template: scene.template, ayahKey: scene.ayahKey }, verses: planVerseTexts(ctx.plan), seed: s.audio?.seed ?? config.voice.seed });
  const speed = speedFor(ctx, v.tune);
  const audio = await applyTempo(r.audio, speed);
  const dir = sentencesDirFor(ctx.scriptPath);
  await mkdir(dir, { recursive: true });
  const stamp = Date.now().toString(36);
  const fragFile = `${s.id}-frag-${stamp}.mp3`;
  await writeAtomic(path.join(dir, fragFile), audio);
  const outcome: WordFixOutcome = { ok: false, index: k, word: c.word, say: c.say, reasons: [] };
  const record = (ok: boolean) => (x: Sentence): Sentence =>
    ({ ...x, fragments: [...(x.fragments ?? []), { file: fragFile, index: k, word: c.word, say: c.say, at: new Date().toISOString(), ok }] });
  const fail = (reason: string, check?: SpliceCheck) => {
    outcome.reasons = check?.reasons.length ? check.reasons : [reason];
    if (check) outcome.check = check;
    return { list: list.map((x) => (x.id === s.id ? record(false)(x) : x)), outcome };
  };
  if (!r.alignment) return fail("لم يُرجع النموذج توقيت كلمات المقطع، فلا تُعرف حدود الكلمة فيه.");
  const fw = scaleTimes(dropTagWords(alignmentToWords(r.alignment)), speed);
  if (fw.length !== prevT.length + target.length + nextT.length) return fail("كلمات المقطع لا تطابق المطلوب، فلا تُعرف حدود الكلمة فيه.");
  const fragWord = { start: fw[prevT.length]!.start, end: fw[prevT.length + target.length - 1]!.end };
  const basePcm = await decode(path.join(dir, s.audio!.file));
  const fragPcm = await decode(path.join(dir, fragFile));
  const old = s.audio!.words;
  const res = spliceWord({
    base: basePcm, frag: fragPcm, sr: SENTENCE_SAMPLE_RATE, span: old[k]!, fragSpan: fragWord,
    neighbours: [old[k - 1], old[k + 1]].filter((x): x is TimedWord => Boolean(x)),
  });
  if (!res.check.ok) return fail("", res.check);
  const file = `${s.id}-fix-${stamp}.wav`;
  await writeAtomic(path.join(dir, file), encodeWav(res.pcm, SENTENCE_SAMPLE_RATE));
  const prevAudio = s.audio!;
  const spokenFixes = [...(prevAudio.spokenFixes ?? []).filter((x) => x.word !== coreOf(c.word)), ...fixed.applied.filter((a) => a.index === k).map((a) => ({ word: a.word, say: a.say }))];
  const take: SentenceAudio = {
    file, fingerprint: v.fingerprint, context: prevAudio.context, duration: res.pcm.length / SENTENCE_SAMPLE_RATE,
    words: remapWords(old, k, res, fragWord), at: new Date().toISOString(), origin: "fix", timing: "aligned",
    ...(prevAudio.tone ? { tone: prevAudio.tone } : {}), spokenFixes, ...(prevAudio.seed !== undefined ? { seed: prevAudio.seed } : {}),
    fixes: [...(prevAudio.fixes ?? []), { index: k, word: c.word, say: c.say, from: prevAudio.file, fragment: fragFile, at: new Date().toISOString() }],
  };
  outcome.ok = true;
  outcome.check = res.check;
  return {
    list: list.map((x) => (x.id === s.id ? record(true)(withCorrection({ ...x, audio: take, takes: [...(x.takes ?? []), prevAudio], heard: undefined }, c)) : x)),
    outcome,
  };
};
