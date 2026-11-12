/**
 * توليد صوت «دفاتر الزمن» بأجزاء خريطة النبرة (الأمر 025 موصولًا) — لهذه القناة وحدها.
 *
 * حين تكون للحلقة خريطة نبرة (tone-map.json بجوار السكريبت، v1.2 فما بعد، مبنية على التشكيل الحالي):
 * 1) كل جزء صوتي في الخريطة (s001–s088 موزعة على 52 جزءًا) يُولَّد ملفًا مستقلًا بنبرته المقررة، من نصه المشكول في الخريطة؛
 * 2) يُقاس الملف ويُقصّ من طرفيه دون أكل حرف (trim.ts + محاذاة الحروف)؛
 * 3) تُوضع أجزاء المشهد في مواضعها (parts.ts: الفاصل بين الجزأين 0.7 ث من كلام إلى كلام)؛
 * 4) يُحسب صمت كل حد بمالك واحد (compose.ts) فيُكتب للمشهد ملف واحد (WAV) وكلماته بزمن المشهد ومدته المقررة،
 *    فيستعملها الرندر كما يستعمل أي مقطع (media.voice)، ومدة المشهد من sceneSeconds عبر clip.timing.
 * لا جزء لبطاقة آية، ولا نص قرآني في أي جزء: الصوت المستنسخ لا يتلو القرآن. بالإسلام وزبدة الكتب لا تمرّان من هنا.
 */
import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { RenderInternals } from "@remotion/renderer";
import type { Plan } from "../plan/types";
import { studioMediaNamespace } from "../plan/collect";
import { partJobs, type PartJob, type ToneMap } from "../remotion/dafatir/audio/parts";
import { TRIM_DEFAULTS, safeTrim, speechBounds, warnAlignmentClamp } from "../remotion/dafatir/audio/trim";
import { boundaryProblems, composeScene, renderBoundaries, type ComposedScene, type PartResult, type SeqItem } from "../remotion/dafatir/audio/compose";
import { HZ_META, type HzExit } from "../remotion/dafatir/horizon/meta";
import { normWord, stripTashkeel } from "./tashkeel";
import { isSupersededVersion, isTone, TONE_PRESET_VERSION } from "./tones";

export const PARTS_CHANNEL = "dafatir-alzaman";
export const PARTS_SAMPLE_RATE = 44100;

export type PartsContext = { map: ToneMap; jobs: PartJob[]; file: string; mapSha256: string };

const sha256 = (b: string | Uint8Array) => createHash("sha256").update(b).digest("hex");
const plain = (s: string) => stripTashkeel(s).split(/\s+/).map(normWord).filter(Boolean).join(" ");
const QURAN_MARK = /﴿|﴾|\[آية/;

export const toneMapFileFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "tone-map.json");

/** هل تمر الحلقة بمسار الأجزاء؟ نعم لدفاتر الزمن ومعها خريطة نبرة فقط؛ وغير ذلك null فيبقى المسار العام كما هو */
export const isPartsChannel = (scriptPath: string) => {
  try {
    return studioMediaNamespace(scriptPath).channelName === PARTS_CHANNEL;
  } catch {
    return false;
  }
};

/**
 * يقرأ خريطة النبرة ويتحقق منها قبل أي توليد، ويرفض بدل أن يخمّن:
 * إصدار v1.2 فما بعد، وبصمة التشكيل الحالي، وكل مشهد منطوق في الخطة = أجزاؤه موصولة، ولا جزء لآية.
 */
export const validatePartsContext = (map: ToneMap & { source?: { tashkeel?: { sha256?: string } } }, plan: Plan, tashkeelText: string | null,
  /** مشاهد صوتها جملةً جملة (src/voice/sentenceVoice.ts): نصها قد يختلف عن الخريطة بتعديل المالك، فلا تُقارن */
  skipScenes: ReadonlySet<string> = new Set()): PartJob[] => {
  const m = /^v(\d+)\.(\d+)/.exec(map.version ?? "");
  if (!m || Number(m[1]) < 1 || (Number(m[1]) === 1 && Number(m[2]) < 2)) throw new Error(`خريطة النبرة ${map.version || "بلا إصدار"} أقدم من v1.2؛ التوليد يتبع الخريطة المعتمدة v1.2 فما بعد.`);
  if (tashkeelText !== null && map.source?.tashkeel?.sha256 && map.source.tashkeel.sha256 !== sha256(tashkeelText))
    throw new Error("خريطة النبرة مبنية على تشكيل قديم (البصمة لا تطابق tashkeel.md)؛ حدّثها قبل التوليد.");
  const jobs = partJobs(map);
  const scenes = plan.chapters.flatMap((c) => c.scenes);
  const byId = new Map(scenes.map((s) => [s.id, s]));
  for (const j of jobs) {
    const s = byId.get(j.scene);
    if (!s) throw new Error(`الجزء ${j.partId} لمشهد غير موجود في الخطة: ${j.scene}`);
    if (s.template === "verse-card" || s.ayahKey) throw new Error(`لا يُولَّد صوت لموضع آية: ${j.scene}`);
    if (QURAN_MARK.test(j.text)) throw new Error(`نص الجزء ${j.partId} فيه علامة قرآنية؛ الصوت المستنسخ لا يتلو القرآن.`);
  }
  for (const s of scenes.filter((x) => x.narration.trim() && !skipScenes.has(x.id))) {
    const mine = jobs.filter((j) => j.scene === s.id);
    if (!mine.length) throw new Error(`المشهد ${s.id} منطوق في الخطة وليس له جزء في خريطة النبرة.`);
    if (plain(mine.map((j) => j.text).join(" ")) !== plain(s.narration)) throw new Error(`نص المشهد ${s.id} في الخطة لا يطابق مقاطعه في خريطة النبرة.`);
  }
  return jobs;
};

/**
 * نبرة المالك لمشهد («النبرة غير مناسبة» في الخطوة ٣، src/voice/toneMapOverride.ts) تعلو على نبرة الخريطة
 * لأجزاء ذلك المشهد وحده. الإصدار الذي يكتبها يضعها في أجزائه أيضًا؛ وهذا يضمن أن التوليد يقرأ قرار المالك
 * من الإصدار الحالي حتى لو بقي جزء بنبرته القديمة. بقية المشاهد بنبرة الخريطة كما هي.
 */
export const applySceneOverrides = <M extends ToneMap & { sceneOverrides?: Record<string, { tone?: unknown }> }>(map: M): M => {
  const o = map.sceneOverrides;
  if (!o || typeof o !== "object") return map;
  return { ...map, audioParts: map.audioParts.map((p) => (isTone(o[p.scene]?.tone) ? { ...p, tone: o[p.scene]!.tone as string } : p)) };
};

export const loadPartsContext = async (scriptPath: string, plan: Plan, skipScenes: ReadonlySet<string> = new Set()): Promise<PartsContext | null> => {
  if (!isPartsChannel(scriptPath)) return null;
  const file = toneMapFileFor(scriptPath);
  if (!existsSync(file)) return null;
  const raw = await readFile(file, "utf8");
  const map = applySceneOverrides(JSON.parse(raw) as ToneMap);
  const tk = path.join(path.dirname(scriptPath), "tashkeel.md");
  const jobs = validatePartsContext(map, plan, existsSync(tk) ? await readFile(tk, "utf8") : null, skipScenes);
  return { map, jobs, file, mapSha256: sha256(raw) };
};

/** فكّ ملف صوت إلى عينات أحادية بمعدل ثابت (WAV مؤقت ثم قراءته؛ ffmpeg المرفق لا يكتب PCM خامًا إلى الأنبوب) */
export const decodeAudio = async (file: string, sampleRate = PARTS_SAMPLE_RATE): Promise<Float32Array> => {
  const os = await import("node:os");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { readWav } = await import("../remotion/dafatir/audio/trim");
  const tmp = await mkdtemp(path.join(os.tmpdir(), "bal-part-"));
  try {
    const out = path.join(tmp, "pcm.wav");
    await RenderInternals.callFf({
      bin: "ffmpeg",
      args: ["-v", "error", "-y", "-i", file, "-ac", "1", "-ar", String(sampleRate), "-c:a", "pcm_s16le", out],
      indent: false,
      logLevel: "error",
      binariesDirectory: null,
      cancelSignal: undefined,
    });
    return readWav(new Uint8Array(await readFile(out))).samples;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
};

export type TimedWord = { word: string; start: number; end: number };

/** قياس حدود جزء من عيناته ومحاذاة كلماته: القص لا يبدأ بعد أول حرف ولا ينتهي قبل آخر حرف */
export const measurePart = (partId: string, samples: Float32Array, sampleRate: number, words: TimedWord[]): PartResult => {
  const align = words.length ? { start: words.map((w) => w.start), end: words.map((w) => w.end) } : undefined;
  let raw;
  try {
    raw = speechBounds(samples, sampleRate);
  } catch (e) {
    // قياس المستوى تعذّر (تسجيل بلا صمت يُقاس منه): لا قص بالمستوى، وحدود الكلام من محاذاة الحروف وحدها
    if (!align) throw e;
    const duration = samples.length / sampleRate;
    raw = { duration, speechStart: Math.min(...align.start), speechEnd: Math.max(...align.end), start: 0, end: duration, floorDb: -120, peakDb: -120 };
  }
  let b;
  try { b = safeTrim(raw, align, {}, (c) => warnAlignmentClamp("الجزء " + partId, c)); }
  catch (error) { throw new Error("الجزء " + partId + ": " + (error as Error).message); }
  const boundedWords = words.map((w) => ({ ...w, start: Math.max(0, Math.min(b.duration, w.start)), end: Math.max(0, Math.min(b.duration, w.end)) }));
  return { clip: { partId, duration: b.duration, speechStart: b.speechStart, speechEnd: b.speechEnd, start: b.start, end: b.end }, words: boundedWords };
};

/** تسلسل الحلقة كما يراه الرندر (للصمت عند الحدود) */
export const sequenceFor = (plan: Plan): SeqItem[] =>
  plan.chapters.flatMap((c) =>
    c.scenes.map((s): SeqItem => {
      if (s.template === "verse-card") return { kind: "verse", id: s.id };
      if (!s.narration.trim()) return { kind: "card", id: s.id };
      const shot = String(s.props?.shot ?? "");
      const meta = HZ_META[shot];
      const exit = ((s.props?.exit as string) || meta?.exit || "none") as HzExit;
      return { kind: "narration", id: s.id, exit, designTail: meta?.tail ?? 1.2 };
    }),
  );

/**
 * يضع كل مشاهد الحلقة من نتائج أجزائها: رأس المشهد بعد الآية، ومواضع الأجزاء، وذيله ومدته بسياسة الصمت.
 * المشهد الذي ينقصه جزء لا يُركّب (يبقى بلا صوت حتى يكتمل).
 */
export const composeEpisode = (plan: Plan, jobs: PartJob[], results: Record<string, PartResult>) => {
  const scenes = [...new Set(jobs.map((j) => j.scene))].filter((sc) => jobs.filter((j) => j.scene === sc).every((j) => results[j.partId]));
  const first: Record<string, ComposedScene> = Object.fromEntries(scenes.map((sc) => [sc, composeScene(sc, jobs, results)]));
  const seq = sequenceFor(plan);
  // الذيل لا يتبع تسجيل المشهد التالي (هامش قص ثابت)، فلا يتغير مشهد معتمد حين يُولَّد ما بعده
  const { boundaries, gaps } = renderBoundaries(seq, first, undefined, { assumedLead: TRIM_DEFAULTS.onsetPadSec });
  const composed: Record<string, ComposedScene> = Object.fromEntries(scenes.map((sc) => [sc, composeScene(sc, jobs, results, boundaries[sc]?.pre ?? 0)]));
  const problems = boundaryProblems(gaps);
  return { composed, boundaries, gaps, problems };
};

type PartRecord = { file: string; hash: string; text: string; duration: number; words: TimedWord[]; presetVersion?: number };
type SceneClip = import("./generate").VoiceClip;

/**
 * يركّب ملف كل مشهد من أجزائه بعد التوليد: يفك الأجزاء، يقيس حدودها، يضعها بسياسة الصمت، ويكتب WAV للمشهد
 * وكلماته (بكتابة الخطة الأصلية للترجمة) ومدته المقررة في index. يُعاد كاملًا في كل توليد (بلا تكلفة توليد).
 */
export const composePartsIntoScenes = async (o: {
  plan: Plan;
  parts: PartsContext;
  partsIndex: Record<string, PartRecord>;
  partsDir: string;
  dir: string;
  index: Record<string, SceneClip>;
  allJobs: { id: string }[];
  log: (m: string) => void;
}) => {
  const { writeFile } = await import("node:fs/promises");
  const { applyDictionary, wordsForCaptions } = await import("./words");
  const { encodeWav, mixScene } = await import("../remotion/dafatir/audio/compose");
  const results: Record<string, PartResult> = {};
  const samples: Record<string, Float32Array> = {};
  for (const j of o.parts.jobs) {
    const rec = o.partsIndex[j.partId];
    if (!rec || !existsSync(path.join(o.partsDir, rec.file))) continue;
    const pcm = await decodeAudio(path.join(o.partsDir, rec.file));
    samples[j.partId] = pcm;
    results[j.partId] = measurePart(j.partId, pcm, PARTS_SAMPLE_RATE, rec.words);
  }
  const { composed, boundaries, problems } = composeEpisode(o.plan, o.parts.jobs, results);
  if (problems.length) throw new Error(`صمت الحدود يخالف سياسة المالك الواحد: ${problems.slice(0, 5).join("؛ ")}`);
  const scenes = new Map(o.plan.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s]));
  for (const [id, c] of Object.entries(composed)) {
    const scene = scenes.get(id)!;
    const b = boundaries[id]!;
    const narration = scene.narration.trim();
    // الكلمات المنطوقة (أجزاء موصولة) ← كلمات الخطة الأصلية للترجمة والتحريك
    const d = applyDictionary(o.parts.jobs.filter((j) => j.scene === id).sort((a, z) => a.index - z.index).map((j) => j.text).join(" "), {});
    const original = narration.split(/\s+/).filter(Boolean);
    const owner = d.owner.length === c.words.length && d.original.length === original.length ? d.owner : [];
    const words = wordsForCaptions(original, owner, c.words);
    const hash = createHash("sha1").update(JSON.stringify({ parts: c.parts.map((p) => [o.partsIndex[p.partId]!.hash, p.at, p.trimStart, p.trimEnd]), pre: b.pre })).digest("hex").slice(0, 16);
    const file = `${hash}.wav`;
    if (!existsSync(path.join(o.dir, file))) await writeFile(path.join(o.dir, file), encodeWav(mixScene(c, samples, PARTS_SAMPLE_RATE), PARTS_SAMPLE_RATE));
    // إصدار النبرات للمشهد المركّب: إن كان بين أجزائه جزء بإصدار غير الحالي (نبرة سابقة) فهو إصداره
    // (غيابه = ١ = الحالي)
    const presetVersion = c.parts.map((p) => o.partsIndex[p.partId]!.presetVersion ?? 1).find(isSupersededVersion) ?? TONE_PRESET_VERSION;
    o.index[id] = {
      file,
      hash,
      ...(isSupersededVersion(presetVersion) ? { presetVersion } : {}),
      text: narration,
      duration: c.audioEnd,
      words,
      timing: { pre: b.pre, tail: b.tail, seconds: b.seconds, speechStart: c.speechStart, speechEnd: c.speechEnd, toneMap: o.parts.mapSha256, parts: c.parts.map((p) => ({ partId: p.partId, at: p.at, trimStart: p.trimStart, trimEnd: p.trimEnd })) },
    };
    o.log(`${id}: ${c.parts.length} جزء، ${b.seconds.toFixed(2)} ث`);
  }
};
