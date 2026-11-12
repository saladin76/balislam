/**
 * الصوت جملةً جملة (قرار صاحب المشروع، ٩ نوفمبر، D50): القرص والتوليد والتركيب.
 *
 * - `voice/sentences.json` بجوار index.json (محلي على جهاز المالك مثل الصوت نفسه): جمل كل مشهد بدأ المالك
 *   العمل عليه جملةً جملة، ونبرتها ووقفتها وتسجيلها. المشهد الذي لا جمل له يبقى على المسار القائم كما هو.
 * - التوليد لجملة واحدة فقط بعميل ElevenLabs القائم، مع نص الجارتين (previous_text / next_text) لاتصال الأداء.
 *   البوابات نفسها: كلمة المالك، التشكيل ≥ 98% للجملة، اعتماد الستوري بورد للمشهد، اعتماد السكريبت والستوري بورد
 *   في السجل، النبرة، المفتاح، والصوت الاحترافي المدرَّب. الصوت المستنسخ لا يتلو القرآن أبدًا: صف الآية «ارفع التلاوة».
 * - صوت المشهد = تسجيلات جمله بوقفاتها في ملف WAV واحد بكلماته بزمن المشهد، في index.json نفسه الذي يقرؤه
 *   الرندر وسجل المشاهد، فلا يتغير شيء في الرندر. علوّ الجمل يُقارب وسيطها (±6 dB)، والقمة محمية.
 * - تعديل نص جملة يكتب نص مشهدها وحده في plan.json (لا إعادة توليد للخطة أبدًا، D46)، فيعيد السجل فتح ذلك المشهد وحده.
 * - لا يُحذف تسجيل مدفوع: التسجيل السابق يبقى في takes، وملف صوت المشهد القديم يُنقل إلى voice/superseded/.
 */
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, open, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import config from "../../config.json";
import { resolveScriptPath } from "../script/episodes";
import { planPathFor, readJson, readPlanFile, stripQuran } from "../plan/io";
import { withPlanWrite } from "../plan/planWriteLock";
import { writeJsonAtomic } from "../io/atomicJson";
import { syncScriptNarration } from "../script/narrationSync";
import type { Plan, PlanScene } from "../plan/types";
import { loadChannel } from "../channel/index";
import { showsDivision } from "../script/divisions";
import type { VoiceProfile } from "../channel/types";
import { loadStoryboard, storyboardBlockMessage, storyboardStatus, unapprovedScenes } from "../plan/storyboard";
import { encodeWav, renderBoundaries } from "../remotion/dafatir/audio/compose";
import { TRIM_DEFAULTS, warnAlignmentClamp } from "../remotion/dafatir/audio/trim";
import { voiceIdFor, type ElevenLabsClient } from "./elevenlabs";
import { audioDuration, estimateWords, speechContextFor, voiceDirFor, type VoiceClip, type VoiceIndex } from "./generate";
import { capsFor, dropTagWords } from "./models";
import { applyTempo, scaleTimes } from "./tempo";
import { effectiveLegacyTone, isSupersededVersion, isTone, layersOf, legacyTunes, TONE_PRESET_VERSION, tones, voiceSettingsFor, type Tone, type VoiceLayers } from "./tones";
import { normWord, stripTashkeel, vowelize } from "./tashkeel";
import { tashkeelReport } from "./tashkeelReport";
import { alignmentToWords, applyDictionary, wordsForCaptions } from "./words";
import { planVerseTexts } from "./quranGuard";
import { BASMALA_KEY, BASMALA_PLACEHOLDER_SEC, hasBasmala } from "./basmala";
import { applyLexicon, checkSay, coreOf, loadLexicon, NOOP_SAY, quranMask, removeLexiconEntry, sayWarnings, setLexiconEntry, type LexiconEntry } from "./lexicon";
import { isNoopSay, lexiconEffects, type LexiconEffect, type LexiconMatch } from "./pronunciationRules";
import { remapWords, snapBoundary, SPLICE, spliceWord, type SpliceCheck } from "./wordSplice";
import {
  addSentenceAfter, clampPause, contextFingerprint, cutPoints, deleteSentence, editSentenceText, emptyDoc, heardKey,
  mergeWithNext, reconcileScene, sceneNarration, sentenceFingerprint, sentencesFor, sentenceStatus, splitSentence,
  normText, sceneAdoption, splitBasmalaInList, sceneSpans, words, recordedOnOtherText, recordedText, type SceneSpan, type Sentence, type SentenceAudio, type SentenceCorrection, type SentencesDoc, type SentenceStatus, type TimedWord,
} from "./sentences";

export const SENTENCE_SAMPLE_RATE = 44100;
/** صمت بعد آخر كلام في ملف المشهد (الذيل الذي يضيفه الرندر يبقى كما هو) */
const TAIL_PAD = 0.25;
const MAX_GAIN = 2; // ±6 dB

export const sentencesFileFor = (scriptPath: string) => path.join(voiceDirFor(scriptPath), "sentences.json");
export const sentencesDirFor = (scriptPath: string) => path.join(voiceDirFor(scriptPath), "sentences");
const supersededDirFor = (scriptPath: string) => path.join(voiceDirFor(scriptPath), "superseded");

export const loadSentencesDoc = async (scriptPath: string): Promise<SentencesDoc> => {
  const d = await readJson<SentencesDoc>(sentencesFileFor(scriptPath));
  if (!d) return emptyDoc();
  if (d.version !== 1 || !d.scenes || typeof d.scenes !== "object") throw new Error("ملف الجمل (voice/sentences.json) غير صالح.");
  return d;
};
const writeAtomic = async (file: string, text: string | Uint8Array) => {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  const fd = await open(temp, "wx", 0o644);
  try {
    try { await fd.writeFile(text); await fd.sync(); } finally { await fd.close(); }
    await rename(temp, file);
  } finally { await rm(temp, { force: true }); }
};
const saveDoc = (scriptPath: string, doc: SentencesDoc) => writeAtomic(sentencesFileFor(scriptPath), JSON.stringify(doc, null, 2) + "\n");

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

type ToneMapLite = {
  raw: string;
  sha256: string;
  version: string;
  /** لكل مشهد: مقاطعه بالترتيب، وعدد كلماتها، ونبرة جزئها (بعد sceneOverrides) */
  scenes: Record<string, { words: number; tone: string }[]>;
  sentenceOverrides: Record<string, { tone?: string }>;
};
const plainCount = (s: string) => words(stripTashkeel(s)).map(normWord).filter(Boolean).length;

const loadToneMapLite = async (scriptPath: string): Promise<ToneMapLite | null> => {
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

type Ctx = {
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
};
const loadCtx = async (episode: string): Promise<Ctx> => {
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
    lexicon: (await loadLexicon()).entries,
  };
};

const allScenes = (plan: Plan) => plan.chapters.flatMap((c) => c.scenes.map((scene) => ({ scene, chapter: c })));
const isNarrated = (s: PlanScene) => s.template !== "verse-card" && Boolean(s.narration?.trim());

/** جمل المشهد كما تُعرض: المحفوظة (مصالَحة مع نص الخطة)، أو التقسيم الآلي بمعرّفات مؤقتة إن لم يبدأ العمل عليه */
const sceneSentences = (ctx: Ctx, scene: PlanScene): { list: Sentence[]; managed: boolean } => {
  const stored = ctx.doc.scenes[scene.id];
  if (stored) return { list: reconcileScene(stored.sentences, scene.id, scene.narration), managed: true };
  let k = 0;
  return { list: sentencesFor(scene.id, scene.narration, () => `virtual-${scene.id}-${k++}`), managed: false };
};

/** النبرة الموروثة والصريحة للجملة */
const toneOf = (ctx: Ctx, scene: PlanScene, list: Sentence[], s: Sentence) => {
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

const ttsSettings = () => {
  const { tailSeconds: _t, creditsPerChar: _c, ...tts } = config.voice;
  return tts;
};
const spokenOf = (ctx: Ctx, text: string) => {
  const ws = words(text);
  return applyDictionary(normText(text), ctx.speech.dict, ctx.speech.tk ? vowelize(ws, ctx.speech.tk) : undefined);
};
/**
 * النص المرسل فعلًا: النطق (القاموس القديم والتشكيل) ثم قاموس النطق للقناة وتصحيحات الجملة.
 * البصمة من النطق قبل هذه الخطوة (spokenOf)، فإضافة كلمة للقاموس لا تُبطل تسجيلًا قائمًا.
 */
const sendOf = (ctx: Ctx, s: Pick<Sentence, "text" | "kind" | "corrections">, extra?: SentenceCorrection) => {
  const d = spokenOf(ctx, s.text);
  const corrections = [...(s.corrections ?? []).filter((c) => !extra || c.index !== extra.index), ...(extra ? [extra] : [])];
  const l = applyLexicon(d.original, d.spoken.split(" ").filter(Boolean), d.owner, ctx.lexicon, { corrections, verse: s.kind === "verse" });
  /** لكل كلمة أصلية: ما يُنطق لها */
  const perWord = d.original.map((_, i) => l.spoken.filter((_, k) => l.owner[k] === i).join(" "));
  return { text: l.spoken.join(" "), original: d.original, owner: l.owner, applied: l.applied, perWord };
};
/**
 * صوت الجملة: النبرة والإعدادات والبصمة. الإصدار الحالي للنبرات افتراضيًا؛ لكن تسجيلًا قائمًا بصمته تطابق إعدادات
 * نبرة سابقة (الإصدار ١ طبقة القناة، أو ٢ القوي D70) يبقى صالحًا: تُرجع إعدادات ذلك الإصدار وبصمته ومعها olderTone، فلا تصير الجملة
 * «تحتاج توليدًا» ولا تُعاد في «جهّز كل المشاهد»، وتصحيح كلمة فيه يُولَّد بإعداداته نفسها فيتصل الصوت.
 * current: للتوليد الجديد دائمًا (الإعدادات الحالية). version: لنسخة مقصوصة من تسجيل معروف الإصدار.
 */
const voiceOf = (ctx: Ctx, scene: PlanScene, list: Sentence[], s: Sentence, o: { current?: boolean; version?: number } = {}) => {
  const t = toneOf(ctx, scene, list, s);
  const tone = t.explicit ?? t.inherited;
  const d = spokenOf(ctx, s.text);
  const fp = (tune: ReturnType<typeof voiceSettingsFor>) =>
    sentenceFingerprint({ spoken: d.spoken, voiceKey: ctx.voiceKey, tts: ttsSettings(), tune, voiceId: scene.voice || undefined });
  const tune = voiceSettingsFor(ctx.profile, tone);
  const fingerprint = fp(tune);
  const base = { tone, toneInfo: t, spoken: d, send: sendOf(ctx, s), currentFingerprint: fingerprint };
  if (!o.current) {
    // the tone as the earlier versions resolved it: a saved id that is no tone any more (grave) still names an old take
    const legacyTone = ctx.map?.scenes[scene.id] ? tone : effectiveLegacyTone(s.tone, scene.tone, ctx.plan.tone, ctx.channelTone);
    // D97 for old takes too: a take recorded with a known tone keeps it while only the inherited tone changed
    const legacyTones = [legacyTone, ...(!t.explicit && s.audio?.tone && s.audio.tone !== legacyTone ? [effectiveLegacyTone(s.audio.tone)] : [])];
    const legacy = [...new Set(legacyTones)].flatMap((lt) => legacyTunes(ctx.layers, lt, { text: s.text }))
      .map((l) => ({ ...l, fingerprint: fp(l.tune) })).filter((l) => l.fingerprint !== fingerprint);
    const pick = o.version !== undefined ? legacy.find((l) => l.version === o.version)
      : s.audio && s.audio.fingerprint !== fingerprint ? legacy.find((l) => l.fingerprint === s.audio!.fingerprint) : undefined;
    if (pick) return { ...base, tune: pick.tune, fingerprint: pick.fingerprint, presetVersion: pick.version, olderTone: true, pinnedTone: undefined as Tone | undefined };
    // D97: a take recorded with a known tone (audio.tone) stays valid when only the INHERITED tone changes
    // (the episode or scene tone chosen or changed later): the episode tone is a default for new generations.
    // A sentence whose own explicit tone differs from its take still needs generating (the owner chose it).
    const recTone = s.audio?.tone;
    if (s.audio && s.audio.fingerprint !== fingerprint && !t.explicit && isTone(recTone) && recTone !== tone) {
      const pinned = voiceSettingsFor(ctx.profile, recTone);
      if (fp(pinned) === s.audio.fingerprint)
        return { ...base, tone: recTone, tune: pinned, fingerprint: s.audio.fingerprint, presetVersion: TONE_PRESET_VERSION, olderTone: false, pinnedTone: recTone };
    }
  }
  return { ...base, tune, fingerprint, presetVersion: TONE_PRESET_VERSION, olderTone: false, pinnedTone: undefined as Tone | undefined };
};

/** نص الجارتين في تسلسل الحلقة (جمل الراوي فقط؛ الآية لا تدخل النص المجاور) */
type Flat = { scene: PlanScene; list: Sentence[]; s: Sentence };
const flatten = (ctx: Ctx): Flat[] =>
  allScenes(ctx.plan).filter((x) => isNarrated(x.scene)).flatMap(({ scene }) => {
    const { list } = sceneSentences(ctx, scene);
    return list.map((s) => ({ scene, list, s }));
  });
const neighbours = (flat: Flat[], id: string) => {
  const i = flat.findIndex((f) => f.s.id === id);
  const prev = flat.slice(0, Math.max(0, i)).reverse().find((f) => f.s.kind === "narration");
  const next = flat.slice(i + 1).find((f) => f.s.kind === "narration");
  return { previousText: prev?.s.text, nextText: next?.s.text };
};

// ── نموذج القراءة ────────────────────────────────────────────────────────────

export type SentenceRow = {
  id: string; sceneId: string; kind: "narration" | "verse" | "basmala"; text: string; spoken: string;
  tone: string; inheritedTone: string; toneSource: "map" | "scene" | "episode" | "channel";
  pauseAfterMs: number; status: SentenceStatus; virtual: boolean; last: boolean;
  audio: { file: string; duration: number; origin: SentenceAudio["origin"] } | null;
  takes: number; contextChanged: boolean;
  /** «وُلّدت بنبرة سابقة»: تسجيلها الحالي صالح بإعدادات إصدار سابق (يُعاد بأمر المالك وحده) */
  olderTone: boolean;
  tashkeel: { ok: boolean; coverage: number; missing: string[] };
  chars: number;
  /**
   * كلمات النص كما تُعرض (شرائح «أعد نطق الكلمة»): توقيتها في التسجيل الحالي إن صلح.
   * say: الكلمة كما كتبها المالك (بلا ترقيم) — ما يُملأ به حقل النطق (D66: لا النطق القديم ولا المسموع)؛
   * sent: ما يُرسل لها الآن فعلًا؛ source: من أين جاء sent إن اختلف (تصحيح الجملة، القاموس، ملف التشكيل)؛
   * correction: نطق كتبه المالك لهذه الكلمة في هذه الجملة.
   */
  words: { word: string; say: string; sent: string; source: "written" | "sentence" | "lexicon" | "tashkeel"; correction: string | null;
    start: number | null; end: number | null; quran: boolean }[];
  /**
   * هل تصلح إعادة نطق كلمة في التسجيل الحالي، ولماذا لا. adopt: لا تسجيل للجملة لكن صوت المشهد ملفًا واحدًا
   * بتوقيت كلمات حقيقي، فالضغط على كلمة يقصه إلى جمله أولًا («من صوت المشهد»، بلا طلب مدفوع) ثم يفتح التصحيح؛
   * وتوقيت words حينها بزمن ملف المشهد (source: "scene").
   */
  wordFix: { ok: boolean; reason?: string; adopt?: boolean; source?: "scene" };
  /** «نُطقت: …» (sent: في التسجيل الحالي) أو «ستُنطق: …» (next: عند التوليد القادم) */
  applied: { word: string; say: string }[]; appliedState: "sent" | "next";
  fixes: number;
  /** حدود الجملة في صوت المشهد ملفًا واحدًا (لتشغيلها وحدها حين لا تسجيل لها)؛ null بلا صوت مشهد مطابق لنصه */
  sceneSpan: SceneSpan | null;
  /** status "old" (D97): the text the current take was recorded on («قديم — سُجّل على نص سابق»); null otherwise */
  recordedOn: string | null;
  /** D97: the take is current under the tone it was recorded with, not the inherited tone now («سُجّلت بنبرة …») */
  recordedTone: string | null;
  /** D109: the scene's current audio clamped this sentence's timing to its file (ms), «التوقيت ضُبط قليلًا»; null otherwise */
  timingClamped: number | null;
};
export type VerseRow = {
  id: string; sceneId: string; kind: "verse-card"; ayahKey: string; reference: string;
  status: "approved" | "pending" | "missing"; file: string | null;
};
export type SentenceScene = {
  id: string; index: number; chapter: number; chapterTitle: string;
  /** يُذكر القسم في الاستوديو؟ لا لخطة بقسم واحد بلا عنوان (سرد واحد، D87) */
  divided: boolean; managed: boolean;
  audio: { state: "sentences" | "scene" | "stale" | "none"; file: string | null; duration: number | null };
  /** صوت المشهد ملفًا واحدًا (أو من أجزاء الخريطة) مولَّد بنبرة سابقة: «وُلّد بنبرة سابقة» */
  olderTone: boolean;
  import: SentencesDoc["scenes"][string]["import"] | null;
  /** لماذا لا يُركَّب صوت المشهد من جمله الآن (null: مركّب أو قابل للتركيب) */
  waiting: string | null;
  rows: SentenceRow[];
  verse: VerseRow | null;
};
export type SentencesRead = {
  episode: string;
  voiceKey: boolean;
  toneMap: { version: string } | null;
  scenes: SentenceScene[];
  /** قاموس النطق للقناة (pronunciations.json) */
  lexicon: LexiconEntry[];
  /** أثر كل مدخل على كلمات هذه الحلقة الآن (ما يغيّره، وما لا يطابقه بتشكيله، وتنبيهاته) */
  lexiconEffects: LexiconEffect[];
};

/** التشكيل ≥ ٩٨٪ بعد التصحيحات: الكلمة المصحَّحة تُعدّ بنطقها المكتوب، وكلمات القاموس مغطاة (نطقها فُحص عند حفظه) */
const coverageOf = (ctx: Ctx, id: string, text: string, corrections: SentenceCorrection[] = []) => {
  const ws = words(text);
  const eff = ws.map((w, i) => corrections.find((c) => c.index === i && c.word === w)?.say ?? w).join(" ");
  const dict = { entries: [...(ctx.speech.dict.entries ?? []), ...ctx.lexicon.map((e) => ({ text: e.word, say: e.say }))] };
  const r = tashkeelReport([{ id, narration: eff }], ctx.speech.tk, dict);
  return { ok: r.ok, coverage: r.coverage, missing: r.gaps.flatMap((g) => g.words) };
};

/** لماذا لا تصلح إعادة نطق كلمة في التسجيل الحالي (null: تصلح) */
const wordFixRefusal = (s: Sentence, fingerprint: string): string | null => {
  if (s.kind !== "narration") return "نص قرآني: لا يُعاد نطقه بالصوت المستنسخ أبدًا.";
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
const fresh = (ctx: Ctx, scene: PlanScene, list: Sentence[]) =>
  list.every((s) => s.kind === "basmala" || (s.kind === "narration" && s.audio && s.audio.fingerprint === voiceOf(ctx, scene, list, s).fingerprint));
const waitingReason = (ctx: Ctx, scene: PlanScene, list: Sentence[], hasOld = false): string | null => {
  if (list.some((s) => s.kind === "verse")) return "في هذا المشهد نص قرآني داخل التعليق؛ الصوت المستنسخ لا يتلوه. انقله إلى مشهد آية من محرر المشهد.";
  const notCurrent = list.filter((s) => s.kind !== "basmala" && (!s.audio || s.audio.fingerprint !== voiceOf(ctx, scene, list, s).fingerprint));
  const n = notCurrent.length;
  if (!n) return null;
  // D97: say how many of them hold a take recorded on an earlier text («قديم»), so the owner knows they can be heard
  const old = notCurrent.filter((s) => s.audio && recordedOnOtherText(s)).length;
  return `جمل بلا صوت حالي: ${n.toLocaleString("ar-EG")}${old ? ` (منها ${old.toLocaleString("ar-EG")} «قديم» سُجّل على نص سابق)` : ""}. يُركَّب صوت المشهد من جمله حين تُولَّد كلها${hasOld ? "، وحتى ذلك يبقى صوته السابق كما هو" : ""}.`;
};

export const readSentences = async (episode: string): Promise<SentencesRead> => {
  const ctx = await loadCtx(episode);
  const index = (await readJson<VoiceIndex>(path.join(voiceDirFor(ctx.scriptPath), "index.json"))) ?? {};
  const flat = flatten(ctx);
  const { ownAudioStatus } = await import("../quran/manualAudio");
  const recs = await ownAudioStatus(episode).catch(() => ({ pending: {}, approved: {} } as Awaited<ReturnType<typeof ownAudioStatus>>));
  const scenes: SentenceScene[] = [];
  allScenes(ctx.plan).forEach(({ scene, chapter }, i) => {
    const base = { id: scene.id, index: i + 1, chapter: chapter.number, chapterTitle: chapter.title, divided: showsDivision(ctx.plan.chapters, chapter) };
    if (scene.template === "verse-card") {
      const key = scene.ayahKey ?? "";
      const ok = (recs.approved as Record<string, { parts: { file: string }[] }>)[key];
      const pend = (recs.pending as Record<string, { file: string }>)[key];
      scenes.push({ ...base, managed: false, audio: { state: "none", file: null, duration: null }, olderTone: false, import: null, waiting: null, rows: [],
        verse: { id: `verse:${scene.id}`, sceneId: scene.id, kind: "verse-card", ayahKey: key, reference: String(scene.props?.reference ?? key),
          status: ok ? "approved" : pend ? "pending" : "missing", file: ok?.parts?.[0]?.file ?? pend?.file ?? null } });
      return;
    }
    if (!isNarrated(scene)) return;
    const { list, managed } = sceneSentences(ctx, scene);
    const clip = index[scene.id];
    const narr = scene.narration.trim();
    const audio: SentenceScene["audio"] = !clip ? { state: "none", file: null, duration: null }
      : { state: clip.text !== narr ? "stale" : clip.sentences ? "sentences" : "scene", file: clip.file, duration: clip.duration };
    const spans = clip && audio.state === "scene" ? sceneSpans(clip, list.map((s) => s.text)) : null;
    // صوت المشهد ملفًا واحدًا: هل يُقص إلى جمله بتوقيت كلماته (الضغط على كلمة جملة بلا تسجيل)
    const adoption = clip && audio.state === "scene" ? sceneAdoption(clip, list.map((s) => s.text)) : null;
    let w0 = 0;
    const rows = list.map((s, k): SentenceRow => {
      const count = words(s.text).length;
      const sceneWords = adoption?.ok ? clip!.words.slice(w0, w0 + count) : undefined;
      w0 += count;
      const v = voiceOf(ctx, scene, list, s);
      const nb = neighbours(flat, s.id);
      return {
        id: s.id, sceneId: scene.id, kind: s.kind, text: s.text, spoken: v.send.text,
        tone: v.toneInfo.explicit ?? "", inheritedTone: v.toneInfo.inherited ?? "", toneSource: v.toneInfo.source,
        pauseAfterMs: s.pauseAfterMs, status: sentenceStatus(s, v.fingerprint), virtual: !managed, last: k === list.length - 1,
        audio: s.audio ? { file: s.audio.file, duration: s.audio.duration, origin: s.audio.origin } : null,
        takes: s.takes?.length ?? 0,
        olderTone: Boolean(s.audio && v.olderTone && s.audio.fingerprint === v.fingerprint),
        contextChanged: Boolean(s.audio && s.audio.origin === "tts" && s.audio.context !== contextFingerprint(nb.previousText, nb.nextText)),
        tashkeel: coverageOf(ctx, s.id, s.text, s.corrections), chars: v.send.text.length,
        ...wordRows(s, v, adoption ? { adopt: adoption.ok, reason: adoption.ok ? undefined : adoption.reason, words: sceneWords } : undefined),
        sceneSpan: spans?.[k] ?? null,
        recordedOn: s.audio && recordedOnOtherText(s) ? recordedText(s.audio) : null,
        timingClamped: audio.state === "sentences" ? clip?.sentences?.clamped?.[s.id] ?? null : null,
        recordedTone: v.pinnedTone ?? null,
      };
    });
    const sceneOlder = Boolean(clip && audio.state === "scene" && !clip.basmala && isSupersededVersion(clip.presetVersion));
    scenes.push({ ...base, managed, audio, olderTone: sceneOlder, import: ctx.doc.scenes[scene.id]?.import ?? null,
      waiting: managed ? waitingReason(ctx, scene, list, audio.state !== "none") : null,
      rows, verse: null });
  });
  const allWords = scenes.flatMap((x) => x.rows.filter((r) => r.kind === "narration").flatMap((r) => r.words.filter((w) => !w.quran).map((w) => w.word)));
  return { episode, voiceKey: Boolean(process.env.ELEVENLABS_API_KEY && voiceIdFor()), toneMap: ctx.map ? { version: ctx.map.version } : null, scenes,
    lexicon: ctx.lexicon, lexiconEffects: lexiconEffects(ctx.lexicon, allWords) };
};

/** صوت المشهد ملفًا واحدًا لجملة بلا تسجيل: يصلح قصه (adopt) بكلماتها بزمنه، أو لماذا لا */
type SceneAlt = { adopt: boolean; reason?: string; words?: TimedWord[] };
const wordRows = (s: Sentence, v: ReturnType<typeof voiceOf>, scene?: SceneAlt): Pick<SentenceRow, "words" | "wordFix" | "applied" | "appliedState" | "fixes"> => {
  const refusal = wordFixRefusal(s, v.fingerprint);
  const ws = words(s.text);
  const mask = quranMask(ws);
  const current = Boolean(s.audio && s.audio.fingerprint === v.fingerprint);
  const fromScene = Boolean(refusal && !s.audio && s.kind === "narration" && scene);
  const adopt = fromScene && scene!.adopt && scene!.words?.length === ws.length;
  const at = (i: number, k: "start" | "end") => (!refusal ? s.audio!.words[i]![k] : adopt ? scene!.words![i]![k] : null);
  return {
    words: ws.map((w, i) => {
      const sent = coreOf(v.send.perWord[i] || w) || w;
      const correction = s.corrections?.find((c) => c.index === i && c.word === w)?.say ?? null;
      const fromLex = v.send.applied.find((a) => a.index === i);
      const source = fromLex ? fromLex.source : sent === coreOf(w) ? "written" as const : "tashkeel" as const;
      return { word: w, say: coreOf(w) || w, sent, source, correction, start: at(i, "start"), end: at(i, "end"), quran: mask[i]! || s.kind === "verse" };
    }),
    wordFix: !refusal ? { ok: true }
      : adopt ? { ok: false, adopt: true, source: "scene", reason: "تُقص الجملة من صوت المشهد عند الضغط على كلمة، بلا توليد." }
      : fromScene && scene!.reason ? { ok: false, reason: scene!.reason } : { ok: false, reason: refusal },
    applied: current ? (s.audio!.spokenFixes ?? []) : v.send.applied.map((a) => ({ word: a.word, say: a.say })),
    appliedState: current ? "sent" : "next",
    fixes: s.audio?.fixes?.length ?? 0,
  };
};

// ── الصوت: فكّ، قص، تركيب ────────────────────────────────────────────────────

const decode = async (file: string) => (await import("./dafatirParts")).decodeAudio(file, SENTENCE_SAMPLE_RATE);
const sliceWav = (pcm: Float32Array, a: number, b: number) =>
  encodeWav(pcm.subarray(Math.max(0, Math.floor(a * SENTENCE_SAMPLE_RATE)), Math.min(pcm.length, Math.ceil(b * SENTENCE_SAMPLE_RATE))), SENTENCE_SAMPLE_RATE);
const shiftWords = (ws: TimedWord[], by: number) => ws.map((w) => ({ word: w.word, start: Math.max(0, w.start + by), end: Math.max(0, w.end + by) }));

/**
 * يقص تسجيلًا واحدًا (صوت مشهد قديم، أو جملة تُقسم) إلى أجزاء بتوقيت كلماته، إن كان القص موثوقًا.
 * الملف الأصلي لا يُمس؛ الأجزاء نسخ جديدة في voice/sentences/.
 */
const sliceByWords = async (o: { scriptPath: string; source: string; sourceWords: TimedWord[]; duration: number; parts: { id: string; count: number }[]; tag: string }):
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

/** The owner's approved basmala recording for the episode (bytes verified), or undefined. */
const approvedBasmala = async (scriptPath: string): Promise<{ file: string; path: string; sha256: string } | undefined> => {
  const { verifiedOwnRecitations } = await import("../quran/manualAudio");
  const { recitationsDirFor } = await import("../quran/sync");
  const rec = (await verifiedOwnRecitations(scriptPath))[BASMALA_KEY];
  const part = rec?.parts?.[0];
  if (!rec?.sha256 || !part) return undefined;
  return { file: part.file, path: path.join(recitationsDirFor(scriptPath), part.file), sha256: rec.sha256 };
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
    // D109: a bounded overshoot is clamped (shared rule, src/remotion/dafatir/audio/trim.ts) and named in the row
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
  const hash = createHash("sha1").update(JSON.stringify({ sentences: placed.map((p) => [p.s.id, audioOf(p.s).file, audioOf(p.s).fingerprint, p.s.pauseAfterMs]), pre })).digest("hex").slice(0, 16);
  const file = `${hash}.wav`;
  const vdir = voiceDirFor(ctx.scriptPath);
  if (!existsSync(path.join(vdir, file))) await writeAtomic(path.join(vdir, file), encodeWav(out, SR));
  const narration = scene.narration.trim();
  const clip: VoiceClip = { file, hash, text: narration, duration: total, words: sceneWords, ...(timing ? { timing } : {}), sentences: { hash, ids: list.map((s) => s.id), ...(Object.keys(clamped).length ? { clamped } : {}) },
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
// ── الأفعال ──────────────────────────────────────────────────────────────────

export type SentenceCommand = {
  action: "init" | "adopt" | "edit" | "split" | "merge" | "delete" | "add" | "tone" | "pause" | "generate" | "restore" | "heard" | "fixword";
  /** معرّف الجملة؛ أو مشهد ورقم الجملة فيه لصف لم يبدأ العمل على مشهده بعد */
  id?: string; sceneId?: string; index?: number;
  text?: string; at?: number; tone?: string | null; ms?: number; note?: string; value?: boolean;
  /**
   * «أعد نطق الكلمة» (fixword)، و«ولّد الجملة كاملة بهذا النطق» (generate مع word وsay): رقم الكلمة في الجملة،
   * ونطقها المكتوب، و«احفظ هذا النطق للقناة».
   */
  word?: number; say?: string; save?: boolean;
  /**
   * fixword: how many words on each side are re-said with the corrected word (1 by default: its two neighbours;
   * 2 under «المزيد»: two on each side, for a smoother join). Only the corrected word is spliced in.
   */
  neighbours?: 1 | 2;
};
export type SentenceActionOptions = {
  client?: ElevenLabsClient | null;
  /**
   * للاختبارات المعزولة فقط (لا يصل إليه الخادم ولا سطر الأوامر): تجاوز بوابتي الستوري بورد والسجل.
   * كلمة المالك والتشكيل والنبرة والآية لا تُتجاوز أبدًا.
   */
  testOnlySkipApprovalGates?: boolean;
};
export type SentenceActionResult = { read: SentencesRead; planChanged: boolean; composed?: { sceneId: string; composed: boolean; reason?: string }; message?: string; fix?: WordFixOutcome };

/** يبدأ العمل جملةً جملة على مشهد: يحفظ التقسيم الآلي، ويقص صوت المشهد القديم إلى الجمل إن أمكن بثقة */
const initScene = async (ctx: Ctx, scene: PlanScene) => {
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
const adoptSceneAudio = async (ctx: Ctx, scene: PlanScene, list: Sentence[], clip: VoiceClip): Promise<{ ok: true } | { ok: false; reason: string }> => {
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
      s.audio = { file: f.file, fingerprint: voiceOf(ctx, scene, list, s, isSupersededVersion(cv) ? { version: cv } : {}).fingerprint, context: contextFingerprint(nb.previousText, nb.nextText),
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

/** يكتب نص مشهد واحد في plan.json كما هو على القرص (بلا آيات، بلا إعادة توليد للخطة أبدًا) */
const writeSceneNarration = async (scriptPath: string, sceneId: string, narration: string): Promise<boolean> => {
  const file = planPathFor(scriptPath);
  // D109: read and write under the plan write lock, as the page's save does (src/plan/planWriteLock.ts)
  return withPlanWrite(file, async () => {
    const raw = await readJson<Plan>(file);
    const scene = raw?.chapters.flatMap((c) => c.scenes).find((s) => s.id === sceneId);
    if (!raw || !scene) throw new Error("المشهد غير موجود في الخطة.");
    if (scene.template === "verse-card") throw new Error("مشهد الآية بلا تعليق؛ تلاوته تُرفع ولا تُكتب هنا.");
    if (normText(scene.narration) === narration) return false;
    const before = scene.narration;
    scene.narration = narration;
    scene.edited = true;
    await writeJsonAtomic(file, stripQuran({ ...raw, updatedAt: new Date().toISOString() }));
    // QA balislam 2: the same change in script.md when it can be placed unambiguously (else the scene is flagged).
    await syncScriptNarration(scriptPath, before, narration);
    return true;
  });
};

/** بوابات أي طلب صوت مدفوع لجملة (التوليد وإعادة نطق كلمة): الآية، التشكيل، الاعتمادات، النبرة، المفتاح، تدريب الصوت */
const voiceGates = async (ctx: Ctx, episode: string, scene: PlanScene, list: Sentence[], s: Sentence, opts: SentenceActionOptions, corrections: SentenceCorrection[] = s.corrections ?? [], mode: { current?: boolean } = {}) => {
  if (s.kind === "basmala") throw new Error("البسملة يسجلها صاحب القناة بصوته ولا ينطقها الصوت المستنسخ: «ارفع التسجيل» في صفها.");
  if (s.kind !== "narration") throw new Error("هذه الجملة نص قرآني؛ الصوت المستنسخ لا يتلو القرآن أبدًا. انقلها إلى مشهد آية وارفع تلاوتها.");
  const cov = coverageOf(ctx, s.id, s.text, corrections);
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
const speedFor = (ctx: Ctx, tune: { speed?: number } | undefined) => (capsFor(ctx.model).speed === "post" ? (tune?.speed ?? config.voice.speed) : 1);

const generateOne = async (ctx: Ctx, episode: string, scene: PlanScene, list: Sentence[], s: Sentence, opts: SentenceActionOptions) => {
  // توليد جديد: بإعدادات النبرات الحالية دائمًا (ولو كان تسجيلها الحالي بالإصدار السابق)
  const { v, client } = await voiceGates(ctx, episode, scene, list, s, opts, s.corrections ?? [], { current: true });
  const nb = neighbours(flatten(ctx), s.id);
  const r = await client.tts(v.send.text, { previousText: nb.previousText, nextText: nb.nextText, voiceId: scene.voice || undefined, tune: v.tune,
    scene: { id: scene.id, template: scene.template, ayahKey: scene.ayahKey }, verses: planVerseTexts(ctx.plan) });
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
    ...(v.send.applied.length ? { spokenFixes: v.send.applied.map((a) => ({ word: a.word, say: a.say })) } : {}) };
  return list.map((x) => (x.id === s.id ? { ...x, audio: take, takes: x.audio ? [...(x.takes ?? []), x.audio] : x.takes, heard: undefined } : x));
};

/** تصحيح كلمة من طلب المالك: رقمها ونطقها المكتوب، بعد الفحص (لا قرآن، تشكيل كامل) */
const correctionFor = (s: Sentence, index: unknown, say: unknown): SentenceCorrection => {
  const ws = words(s.text);
  const i = Math.round(Number(index));
  if (!(i >= 0 && i < ws.length)) throw new Error("الكلمة غير موجودة في الجملة؛ حدّث الصفحة.");
  if (s.kind !== "narration" || quranMask(ws)[i]) throw new Error("النص القرآني لا يُغيَّر نطقه ولا يُعاد بالصوت المستنسخ أبدًا.");
  const bad = checkSay(String(say ?? ""));
  if (bad) throw new Error(bad);
  return { index: i, word: ws[i]!, say: String(say).trim().replace(/\s+/g, " ") };
};
/**
 * The correction is saved with the sentence; one that says the word exactly as written (D66) is not a correction:
 * it removes any earlier correction of that word, so the word is sent as written again.
 */
const withCorrection = (s: Sentence, c: SentenceCorrection): Sentence => {
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
const fixWord = async (ctx: Ctx, episode: string, scene: PlanScene, list: Sentence[], s: Sentence, c: SentenceCorrection, opts: SentenceActionOptions & { neighbours?: 1 | 2 }):
  Promise<{ list: Sentence[]; outcome: WordFixOutcome }> => {
  const base0 = voiceOf(ctx, scene, list, s);
  const refusal = wordFixRefusal(s, base0.fingerprint);
  if (refusal) throw new Error(refusal);
  const { v, client } = await voiceGates(ctx, episode, scene, list, s, opts, [...(s.corrections ?? []).filter((x) => x.index !== c.index), c]);
  const fixed = sendOf(ctx, s, c);
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
    scene: { id: scene.id, template: scene.template, ayahKey: scene.ayahKey }, verses: planVerseTexts(ctx.plan) });
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
  const spokenFixes = [...(prevAudio.spokenFixes ?? []).filter((x) => x.word !== c.word), { word: coreOf(c.word), say: c.say }];
  const take: SentenceAudio = {
    file, fingerprint: v.fingerprint, context: prevAudio.context, duration: res.pcm.length / SENTENCE_SAMPLE_RATE,
    words: remapWords(old, k, res, fragWord), at: new Date().toISOString(), origin: "fix", timing: "aligned",
    ...(prevAudio.tone ? { tone: prevAudio.tone } : {}), spokenFixes,
    fixes: [...(prevAudio.fixes ?? []), { index: k, word: c.word, say: c.say, from: prevAudio.file, fragment: fragFile, at: new Date().toISOString() }],
  };
  outcome.ok = true;
  outcome.check = res.check;
  return {
    list: list.map((x) => (x.id === s.id ? record(true)(withCorrection({ ...x, audio: take, takes: [...(x.takes ?? []), prevAudio], heard: undefined }, c)) : x)),
    outcome,
  };
};

/**
 * فعل المالك على جملة (من الاستوديو على جهازه أو من الطرفية، بلا كلمة مرور: assertSceneOwner)؛ والأفعال على حلقة واحدة متتالية بقفل.
 */
export const sentenceAction = async (episode: string, cmd: SentenceCommand, opts: SentenceActionOptions = {}): Promise<SentenceActionResult> => {
  const { assertSceneOwner, serialized } = await import("../studio/sceneService");
  assertSceneOwner();
  const actions = ["init", "adopt", "edit", "split", "merge", "delete", "add", "tone", "pause", "generate", "restore", "heard", "fixword"];
  if (!cmd || !actions.includes(cmd.action) || (cmd.text !== undefined && (typeof cmd.text !== "string" || cmd.text.length > 4000)) ||
      (cmd.note !== undefined && (typeof cmd.note !== "string" || cmd.note.length > 2000)) ||
      (cmd.say !== undefined && (typeof cmd.say !== "string" || cmd.say.length > 200)) || (cmd.word !== undefined && !Number.isInteger(cmd.word)) ||
      (cmd.action === "fixword" && (cmd.word === undefined || cmd.say === undefined)) ||
      (cmd.neighbours !== undefined && cmd.neighbours !== 1 && cmd.neighbours !== 2))
    throw new Error("أمر الجملة غير صالح.");
  const scriptPath = await resolveScriptPath(episode);
  await mkdir(voiceDirFor(scriptPath), { recursive: true });
  let planChanged = false;
  let composed: SentenceActionResult["composed"];
  let message: string | undefined;
  let fix: WordFixOutcome | undefined;
  await serialized(sentencesFileFor(scriptPath), async () => {
    const ctx = await loadCtx(episode);
    const flatScenes = allScenes(ctx.plan).map((x) => x.scene);
    // الجملة المقصودة ومشهدها
    let sceneId = cmd.sceneId;
    let id = cmd.id;
    if (id && !id.startsWith("virtual-")) {
      // D97: the id the page shows is the reconciled one (a scene whose text changed after recording is
      // reconciled on every read, with stable ids), so it is looked up in the reconciled lists, not only on disk.
      sceneId = Object.entries(ctx.doc.scenes).find(([, v]) => v.sentences.some((s) => s.id === id))?.[0]
        ?? flatScenes.filter((sc) => ctx.doc.scenes[sc.id] && isNarrated(sc)).find((sc) => sceneSentences(ctx, sc).list.some((s) => s.id === id))?.id
        ?? sceneId;
    } else if (id?.startsWith("virtual-")) {
      const m = /^virtual-(.+)-(\d+)$/.exec(id);
      if (m) { sceneId = m[1]; cmd.index = Number(m[2]); id = undefined; }
    }
    const scene = flatScenes.find((s) => s.id === sceneId);
    if (!scene || !isNarrated(scene)) throw new Error("المشهد غير موجود أو بلا تعليق.");
    // المصالحة مع نص الخطة الحالي، ثم البدء إن لم يبدأ العمل على المشهد
    if (ctx.doc.scenes[scene.id]) ctx.doc.scenes[scene.id]!.sentences = reconcileScene(ctx.doc.scenes[scene.id]!.sentences, scene.id, scene.narration);
    await initScene(ctx, scene);
    const rec = ctx.doc.scenes[scene.id]!;
    if (!id && cmd.action !== "init") {
      const s = rec.sentences[Number(cmd.index)];
      if (!s) throw new Error("الجملة غير موجودة؛ حدّث الصفحة.");
      id = s.id;
    }
    let list = rec.sentences;
    const one = () => {
      const s = list.find((x) => x.id === id);
      if (!s) throw new Error("الجملة غير موجودة؛ حدّث الصفحة.");
      return s;
    };
    switch (cmd.action) {
      case "init": break;
      case "adopt": {
        // «اضغط كلمة» في مشهد صوته ملف واحد: يُقص إلى جمله «من صوت المشهد» (بلا طلب مدفوع، ولا يُركّب المشهد)
        const clip = ((await readJson<VoiceIndex>(path.join(voiceDirFor(scriptPath), "index.json"))) ?? {})[scene.id];
        if (list.every((s) => s.audio)) break;
        if (!clip || clip.sentences) throw new Error("لا صوت مشهد ملفًا واحدًا يُقص إلى جمله؛ ولّد الجملة.");
        const r = await adoptSceneAudio(ctx, scene, list, clip);
        if (!r.ok) throw new Error(r.reason);
        rec.import = { state: "imported", note: "قُصّ صوت المشهد السابق إلى جمله بتوقيت كلماته؛ الملف الأصلي كما هو." };
        message = "قُصّ صوت المشهد إلى جمله «من صوت المشهد» بلا توليد؛ صوت المشهد نفسه لم يتغير.";
        break;
      }
      case "edit": list = editSentenceText(list, id!, String(cmd.text ?? "")); break;
      case "add": list = addSentenceAfter(list, id!, String(cmd.text ?? "")).list; break;
      case "delete": list = deleteSentence(list, id!); break;
      case "merge": list = mergeWithNext(list, id!); break;
      case "split": {
        const before = one();
        const r = splitSentence(list, id!, Number(cmd.at));
        list = r.list;
        // التسجيل الحالي يُقص عند الموضع نفسه إن كان القص موثوقًا (والأصل يبقى في takes)
        const bv = voiceOf(ctx, scene, rec.sentences, before);
        if (before.audio && before.audio.fingerprint === bv.fingerprint) {
          const cut = await sliceByWords({ scriptPath, source: path.join(sentencesDirFor(scriptPath), before.audio.file), sourceWords: before.audio.words,
            duration: before.audio.duration, parts: [{ id: r.first.id, count: words(r.first.text).length }, { id: r.second.id, count: words(r.second.text).length }], tag: "split" });
          if (cut.ok) {
            const tmp = { ...ctx, doc: { ...ctx.doc, scenes: { ...ctx.doc.scenes, [scene.id]: { ...rec, sentences: list } } } };
            const flat = flatten(tmp);
            list = list.map((s) => {
              const f = cut.files.find((x) => x.id === s.id);
              if (!f) return s;
              const nb = neighbours(flat, s.id);
              return { ...s, audio: { file: f.file, fingerprint: voiceOf(ctx, scene, list, s, bv.olderTone ? { version: bv.presetVersion } : {}).fingerprint, context: contextFingerprint(nb.previousText, nb.nextText),
                duration: f.duration, words: f.words, at: new Date().toISOString(), origin: "split" as const, ...(before.audio!.tone ? { tone: before.audio!.tone } : {}) } };
            });
          } else message = `قُسمت الجملة؛ ولم يُقص تسجيلها (${cut.reason})، فتحتاج الجملتان توليدًا.`;
        }
        break;
      }
      case "pause": list = list.map((s) => (s.id === one().id ? { ...s, pauseAfterMs: clampPause(cmd.ms) } : s)); break;
      case "heard": list = list.map((s) => (s.id === one().id ? { ...s, heard: cmd.value === false || !s.audio ? undefined : heardKey(s.audio) } : s)); break;
      case "restore": {
        const s = one();
        const prev = s.takes?.[s.takes.length - 1];
        if (!prev) throw new Error("لا تسجيل سابق لهذه الجملة.");
        list = list.map((x) => (x.id === s.id ? { ...x, audio: prev, takes: [...(x.takes ?? []).slice(0, -1), ...(x.audio ? [x.audio] : [])], heard: undefined } : x));
        break;
      }
      case "tone": {
        const s = one();
        const tone = cmd.tone === null || cmd.tone === "" || cmd.tone === undefined ? null : cmd.tone;
        if (tone !== null && !isTone(tone)) throw new Error("النبرة المختارة غير معروفة.");
        if (ctx.map) {
          // خريطة النبرة (دفاتر الزمن): إصدار جديد للجملة وحدها (D41)، والخريطة سجل القرار
          const { writeSentenceToneOverride } = await import("./toneMapOverride");
          const v = await writeSentenceToneOverride(scriptPath, { scene: scene.id, sentence: s.id, text: s.text, tone, note: String(cmd.note ?? ""), at: new Date().toISOString() });
          if (v) message = `حُدّثت خريطة النبرة إلى ${v} لهذه الجملة وحدها.`;
          ctx.map = await loadToneMapLite(scriptPath);
        } else list = list.map((x) => (x.id === s.id ? { ...x, tone: (tone ?? undefined) as Tone | undefined } : x));
        break;
      }
      case "generate": {
        let s = one();
        // «ولّد الجملة كاملة بهذا النطق»: التصحيح يُحفظ مع الجملة (ولقاموس القناة إن طُلب) ثم تُولَّد كاملة
        const c = cmd.say !== undefined ? correctionFor(s, cmd.word, cmd.say) : null;
        if (c && cmd.save && isNoopSay(c.word, c.say)) throw new Error(NOOP_SAY);
        if (c) { s = withCorrection(s, c); list = list.map((x) => (x.id === s.id ? s : x)); }
        list = await generateOne(ctx, episode, scene, list, s, opts);
        if (c && cmd.save) {
          await setLexiconEntry(c.word, c.say);
          message = [`حُفظ نطق «${coreOf(c.word)}» في قاموس النطق للقناة؛ يسري على كل توليد قادم.`, ...sayWarnings(c.word, c.say)].join(" ");
        }
        break;
      }
      case "fixword": {
        const s = one();
        const c = correctionFor(s, cmd.word, cmd.say);
        if (cmd.save && isNoopSay(c.word, c.say)) throw new Error(NOOP_SAY);
        const r = await fixWord(ctx, episode, scene, list, s, c, { ...opts, neighbours: cmd.neighbours });
        list = r.list;
        fix = r.outcome;
        if (r.outcome.ok && cmd.save) {
          await setLexiconEntry(c.word, c.say);
          fix.savedToLexicon = true;
        }
        message = r.outcome.ok
          ? [`أُعيد نطق «${coreOf(c.word)}» وحده؛ التسجيل السابق محفوظ في «ارجع إلى التسجيل السابق».${fix.savedToLexicon ? " وحُفظ نطقها في قاموس النطق للقناة." : ""}`,
            ...(fix.savedToLexicon ? sayWarnings(c.word, c.say) : [])].join(" ")
          : "لم يندمج بشكل طبيعي — جرّب نطقًا آخر أو ولّد الجملة";
        break;
      }
    }
    // A sentence edited (or added) to hold the basmala with narration is split at once (owner, 10 Nov).
    if (["edit", "add", "merge"].includes(cmd.action)) list = splitBasmalaInList(list);
    rec.sentences = list;
    const narration = sceneNarration(list);
    if (["edit", "add", "delete", "merge", "split"].includes(cmd.action))
      planChanged = await writeSceneNarration(scriptPath, scene.id, narration);
    if (planChanged) {
      const p = await readPlanFile(scriptPath);
      if (p) ctx.plan = p;
    }
    const current = allScenes(ctx.plan).map((x) => x.scene).find((s) => s.id === scene.id)!;
    // صوت المشهد يُركّب من جمله حين تكون كلها حالية (وإلا يبقى صوته السابق كما هو)؛ وصل لم يُطبَّق لا يغيّر شيئًا
    if (cmd.action !== "init" && cmd.action !== "adopt" && cmd.action !== "heard" && !(cmd.action === "fixword" && !fix?.ok)) {
      const c = await composeSentenceScene(ctx, current, list);
      composed = { sceneId: scene.id, ...c };
    }
    await saveDoc(scriptPath, ctx.doc);
  });
  return { read: await readSentences(episode), planChanged, ...(composed ? { composed } : {}), ...(message ? { message } : {}), ...(fix ? { fix } : {}) };
};

export type ToneImpact = {
  tone: string | null;
  /** sentences that are current now and would need a new (paid) generation under this episode tone */
  sentences: { id: string; sceneId: string }[];
  /** whole-scene voices (not sentence by sentence) that would need a new generation */
  scenes: string[];
};
/**
 * D97: what choosing (or clearing) the episode tone would invalidate, BEFORE it is applied: the studio shows
 * «سيحتاج N جملة توليدًا جديدًا» and asks. Read only: nothing is written, generated or sent.
 * Takes recorded with a known tone keep it (voiceOf pins them), so only takes made under the channel layer whose
 * sound the chosen tone really changes are counted.
 */
export const toneChangeImpact = async (episode: string, tone: string | null): Promise<ToneImpact> => {
  if (tone !== null && !isTone(tone)) throw new Error("النبرة المختارة غير معروفة.");
  const ctx = await loadCtx(episode);
  const nextPlan: Plan = { ...ctx.plan, tone: tone ?? undefined };
  const after: Ctx = { ...ctx, plan: nextPlan };
  const sentences: ToneImpact["sentences"] = [];
  if (!ctx.map) for (const { scene } of allScenes(ctx.plan)) {
    if (!isNarrated(scene) || !ctx.doc.scenes[scene.id]) continue;
    const { list } = sceneSentences(ctx, scene);
    for (const s of list) {
      if (s.kind !== "narration" || !s.audio) continue;
      const now = sentenceStatus(s, voiceOf(ctx, scene, list, s).fingerprint);
      if (now !== "generated" && now !== "heard") continue;
      const later = sentenceStatus(s, voiceOf(after, scene, list, s).fingerprint);
      if (later !== "generated" && later !== "heard") sentences.push({ id: s.id, sceneId: scene.id });
    }
  }
  const { sceneVoiceToneImpact } = await import("./generate");
  return { tone, sentences, scenes: await sceneVoiceToneImpact(ctx.scriptPath, ctx.plan, nextPlan) };
};

export type SentencesRepair = {
  file: string;
  /** scenes whose saved sentences were behind the plan text (reconciled now, with stable ids) */
  reconciled: string[];
  /** old takes the earlier reconcile had parked on a scene's first sentence, put back on the sentence they belong to («قديم») */
  restored: { sceneId: string; sentenceId: string; file: string }[];
  written: boolean;
  backup: string | null;
};
const plainWords = (t: string) => new Set(words(stripTashkeel(t)).map(normWord).filter(Boolean));
const overlap = (a: string, b: string) => {
  const x = plainWords(a), y = plainWords(b);
  let n = 0;
  for (const w of x) if (y.has(w)) n++;
  return x.size + y.size - n ? n / (x.size + y.size - n) : 0;
};
/**
 * D97 one-time repair of voice/sentences.json (owner's Mac, after remap-scene-ids --with-changed-text):
 * 1) every saved scene whose text changed is reconciled with the plan once and saved (stable ids; changed sentences
 *    keep their old take as «قديم»);
 * 2) takes the earlier reconcile parked on the scene's first sentence (recorded on another sentence's text) are put
 *    back as the «قديم» take of the sentence without audio whose text is closest (≥ 30% shared words).
 * Preview by default; `apply` writes after a backup (sentences.before-repair.json). Nothing is deleted or generated.
 */
export const repairSentences = async (episode: string, o: { apply?: boolean } = {}): Promise<SentencesRepair> => {
  const { serialized } = await import("../studio/sceneService");
  const scriptPath = await resolveScriptPath(episode);
  const file = sentencesFileFor(scriptPath);
  const out: SentencesRepair = { file, reconciled: [], restored: [], written: false, backup: null };
  if (o.apply) (await import("../studio/sceneService")).assertSceneOwner();
  if (!existsSync(file)) return out;
  await serialized(file, async () => {
    const ctx = await loadCtx(episode);
    for (const { scene } of allScenes(ctx.plan)) {
      const rec = ctx.doc.scenes[scene.id];
      if (!rec || !isNarrated(scene)) continue;
      const list = reconcileScene(rec.sentences, scene.id, scene.narration).map((x) => ({ ...x }));
      if (list !== rec.sentences && sceneNarration(rec.sentences) !== normText(scene.narration)) out.reconciled.push(scene.id);
      const head = list[0];
      const parked = (head?.takes ?? []).filter((t) => { const r = recordedText(t); return r !== null && normText(r) !== normText(head!.text) && !list.some((x) => normText(x.text) === normText(r)); });
      for (const t of parked) {
        const target = list.filter((x) => x.kind === "narration" && !x.audio)
          .map((x) => ({ x, score: overlap(recordedText(t)!, x.text) })).sort((a, z) => z.score - a.score)[0];
        if (!target || target.score < 0.3) continue;
        target.x.audio = t;
        head!.takes = head!.takes!.filter((y) => y !== t);
        out.restored.push({ sceneId: scene.id, sentenceId: target.x.id, file: t.file });
      }
      if (head && !head.takes?.length) delete head.takes;
      rec.sentences = list;
    }
    if (o.apply && (out.reconciled.length || out.restored.length)) {
      const backup = path.join(path.dirname(file), "sentences.before-repair.json");
      if (!existsSync(backup)) await writeAtomic(backup, await readFile(file));
      out.backup = backup;
      await saveDoc(scriptPath, ctx.doc);
      out.written = true;
    }
  });
  return out;
};

export type LexiconCommand = { op: "set" | "remove"; word: string; say?: string; note?: string; match?: LexiconMatch };
/** «قاموس النطق» في «أدوات وتفاصيل»: تعديل كلمة أو حذفها (المالك على جهازه). لا يُبطل تسجيلًا قائمًا. */
export const lexiconAction = async (episode: string, cmd: LexiconCommand): Promise<SentencesRead> => {
  const { assertSceneOwner } = await import("../studio/sceneService");
  assertSceneOwner();
  if (!cmd || (cmd.op !== "set" && cmd.op !== "remove") || typeof cmd.word !== "string" || cmd.word.length > 80 ||
      (cmd.say !== undefined && (typeof cmd.say !== "string" || cmd.say.length > 200)) || (cmd.note !== undefined && typeof cmd.note !== "string") ||
      (cmd.match !== undefined && cmd.match !== "exact" && cmd.match !== "letters"))
    throw new Error("أمر قاموس النطق غير صالح.");
  if (cmd.op === "set") await setLexiconEntry(cmd.word, String(cmd.say ?? ""), cmd.note, undefined, cmd.match);
  else await removeLexiconEntry(cmd.word);
  return readSentences(episode);
};

/** أسماء النبرات للعرض */
export const toneNames = Object.fromEntries(Object.entries(tones).map(([k, v]) => [k, v.nameAr]));

/**
 * «جهّز كل المشاهد» for the scenes holding the basmala (owner decision 10 Nov): their split is saved, each
 * narration sentence without a current take is voiced through the same sentence gates (tashkeel, approvals,
 * tone, the Quran guard), and the scene is composed with the owner's recording or its marked placeholder.
 * The basmala itself is never sent to the voice. Returns what was voiced and what could not be, per scene.
 */
export const prepareBasmalaScenes = async (episode: string, opts: { client: ElevenLabsClient | null; shouldStop?: () => boolean }) => {
  const scriptPath = await resolveScriptPath(episode);
  const ids = await basmalaScenes(scriptPath);
  const out = { generated: 0, errors: [] as { id: string; error: string }[] };
  if (!ids.length) return out;
  await recomposeBasmalaScenes(episode);
  if (!opts.client) return out;
  for (const sceneId of ids) {
    const read = await readSentences(episode);
    const scene = read.scenes.find((x) => x.id === sceneId);
    for (const row of scene?.rows ?? []) {
      if (opts.shouldStop?.()) return out;
      if (row.kind !== "narration" || row.status === "generated" || row.status === "heard") continue;
      try {
        await sentenceAction(episode, { action: "generate", id: row.id }, { client: opts.client });
        out.generated++;
      } catch (e) {
        out.errors.push({ id: sceneId, error: (e as Error).message });
        break;
      }
    }
  }
  return out;
};

/**
 * M5 (funnel QA, 10 Nov): «أعد توليد الصوت» in the dock for a scene voiced sentence by sentence regenerates
 * EVERY narration sentence of that scene through the sentence path (same gates; the basmala and verses are
 * never voiced), then the scene is composed from them. Old takes are kept (never deleted).
 */
export const regenerateSceneSentences = async (episode: string, sceneId: string, opts: { client: ElevenLabsClient | null }) => {
  await sentenceAction(episode, { action: "init", sceneId });
  let read = await readSentences(episode);
  const rows = read.scenes.find((x) => x.id === sceneId)?.rows ?? [];
  let generated = 0;
  let composed: SentenceActionResult["composed"];
  for (const row of rows) {
    if (row.kind !== "narration") continue;
    const r = await sentenceAction(episode, { action: "generate", id: row.id }, { client: opts.client });
    generated++;
    read = r.read;
    composed = r.composed ?? composed;
  }
  if (!generated) throw new Error("لا جمل للراوي في هذا المشهد؛ البسملة والآيات تُرفع بتسجيلك ولا تُولَّد.");
  return { generated, composed, read };
};
