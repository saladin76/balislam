/**
 * D217، طلب المالك (٢٤ نوفمبر، البند ٤): «لا سكوت أكثر من ثانية، ولا شاشة واقفة أكثر من ٣ ثوانٍ، إلا بطاقة آية تحتها تلاوة».
 * وجد المالك في «دفاتر الزمن 001» قبل النهائية (v15) سكوتًا ٢–٤ ث في سبعة مواضع وشاشات واقفة ٨–٩ ث تُشعر بأن الفيديو انتهى.
 *
 * - السكوت: مرشح ffmpeg «silencedetect» على صوت الملف كله بعتبة −45 dB، وهي عتبة «سكوت البداية» نفسها
 *   (leadingSilence في src/studio/assembleScenes.ts) فيتفق البندان: ما تحتها لا يسمعه المشاهد صوتًا (الراوي والمكان فوقها بكثير).
 *   كل سكوت أطول من ثانية واحدة يُذكر بزمنه ومشهده. لا استثناء: بطاقة الآية تحتها تلاوة فليست سكوتًا أصلًا،
 *   ونافذة آية بلا تلاوة (المعاينة قبل النهائية بلا تلاوات) سكوت يُذكر.
 * - الشاشة الواقفة: فترات «freezedetect» نفسها التي يقيسها مقياس التفاعلية (detectFreezes، في مساحة المشهد بلا عنوان
 *   الفصل والترجمة)، فالترجمة المتغيرة مع كل كلمة لا تخفي صورة واقفة، والقياس مرور واحد على الملف للبندين.
 *   الاستثناء الوحيد: نافذة آية (span «آية» في intendedStillness) في مشهد تلاوته البشرية المعتمدة موجودة في الوسائط
 *   (media.recitations بمفتاح ayahKey لبطاقة الآية أو verseKey للقطة «خط الأفق»). نافذة آية بلا تلاوة لا تُعفى،
 *   ولا تمهيد الآية، ولا نوافذ ذكر الله (± ربع ثانية، لا تبلغ ٣ ث عادة؛ وإن بلغتها تُذكر كما هي).
 * الأزمنة في زمن الملف نفسه، والمشاهد تُسمّى من بدايات المشاهد في الملف (سجل الوصلات للمجمّعة، وزمن الخطة للنهائية).
 * هذا الملف خالص إلا detectSilences (ffmpeg).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Plan } from "../../plan/types";
import type { EpisodeMedia } from "../../plan/media";
import { intendedStillness } from "../../render/stillnessSpans";
import { mergeIntervals, planSceneStarts, remapSpans, subtractIntervals, type Interval } from "./interactivity";

const exec = promisify(execFile);

/** أطول سكوت مسموح بالثواني (يُذكر ما زاد عليه) */
export const SILENCE_MAX_SEC = 1;
/** الصوت تحت هذه العتبة سكوت؛ هي عتبة «سكوت البداية» نفسها */
export const SILENCE_NOISE_DB = -45;
/** أطول شاشة واقفة مسموحة بالثواني، إلا بطاقة آية تحتها تلاوة */
export const FREEZE_MAX_SEC = 3;

export type PauseSpan = Interval & { scenes: string[] };
export type PauseReport = { spans: PauseSpan[]; longest: number; max: number; ok: boolean };
export type SceneStart = { id: string; start: number };

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** فترات السكوت من مخرجات silencedetect؛ سكوت بلا نهاية يمتد إلى آخر الملف */
export const parseSilences = (stderr: string, duration: number): Interval[] => {
  const out: Interval[] = [];
  let start: number | null = null;
  for (const m of stderr.matchAll(/silence_(start|end):\s*(-?[\d.]+)/g)) {
    const t = Number(m[2]);
    if (m[1] === "start") start = t;
    else if (start !== null) {
      out.push({ from: start, to: t });
      start = null;
    }
  }
  if (start !== null) out.push({ from: start, to: duration });
  return mergeIntervals(out, duration);
};

/** فترات السكوت في صوت الملف كله (أقصرها SILENCE_MAX_SEC، فالمرشح لا يلتقط ما دونها) */
export const detectSilences = async (file: string, duration: number): Promise<Interval[]> => {
  const r = await exec("ffmpeg", ["-hide_banner", "-nostats", "-nostdin", "-i", file, "-map", "0:a:0", "-af", `silencedetect=n=${SILENCE_NOISE_DB}dB:d=${SILENCE_MAX_SEC}`, "-f", "null", "-"],
    { maxBuffer: 64 * 1024 * 1024, timeout: 3_600_000 });
  return parseSilences(String(r.stderr), duration);
};

/** المشاهد التي تقع فيها الفترة (بدايات المشاهد في زمن الملف) */
export const scenesIn = (x: Interval, starts: readonly SceneStart[]): string[] => {
  const sorted = [...starts].sort((a, b) => a.start - b.start);
  return sorted.filter((s, i) => {
    const end = sorted[i + 1]?.start ?? Infinity;
    return s.start < x.to - 1e-6 && end > x.from + 1e-6;
  }).map((s) => s.id);
};

/** ما زاد على الحد من الفترات، بمشاهده */
export const pausesOver = (xs: readonly Interval[], max: number, starts: readonly SceneStart[] = []): PauseReport => {
  const merged = mergeIntervals(xs);
  const spans = merged.filter((x) => x.to - x.from > max + 1e-6).map((x) => ({ from: r3(x.from), to: r3(x.to), scenes: scenesIn(x, starts) }));
  const longest = merged.reduce((a, x) => Math.max(a, x.to - x.from), 0);
  return { spans, longest: r3(longest), max, ok: spans.length === 0 };
};

export const silenceReport = (silences: readonly Interval[], starts: readonly SceneStart[] = []) => pausesOver(silences, SILENCE_MAX_SEC, starts);

/** الشاشة الواقفة: فترات السكون بعد إعفاء نوافذ الآيات المتلوّة وحدها */
export const frozenReport = (freezes: readonly Interval[], recitedVerses: readonly Interval[] = [], starts: readonly SceneStart[] = []) =>
  pausesOver(subtractIntervals(freezes, recitedVerses), FREEZE_MAX_SEC, starts);

/** مفتاح تلاوة المشهد: ayahKey لبطاقة الآية، وverseKey للقطة الآية في «خط الأفق» */
const verseKeyOf = (s: Plan["chapters"][number]["scenes"][number]) => s.ayahKey ?? (typeof s.props?.verseKey === "string" ? s.props.verseKey : undefined);

/**
 * نوافذ الآيات التي تحتها تلاوة بشرية معتمدة (في زمن الخطة): نوافذ «آية» من intendedStillness في مشهد تلاوته في الوسائط.
 * المشهد يُعرف ببدايته كما في remapSpans (آخر مشهد يبدأ قبل النافذة).
 */
export const recitedVerseSpans = (plan: Plan, media: Pick<EpisodeMedia, "voice" | "recitations">, introSec = 0): (Interval & { scene: string })[] => {
  const starts = planSceneStarts(plan, media, introSec);
  const byId = new Map(plan.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s]));
  const out: (Interval & { scene: string })[] = [];
  for (const x of intendedStillness(plan, introSec, media)) {
    if (x.why !== "آية") continue;
    let k = -1;
    for (let i = 0; i < starts.length; i++) if (starts[i]!.start <= x.from + 1e-6) k = i;
    const s = k >= 0 ? byId.get(starts[k]!.id) : undefined;
    const key = s && verseKeyOf(s);
    if (s && key && media.recitations[key]) out.push({ from: x.from, to: x.to, scene: s.id });
  }
  return out;
};

/** دقيقة:ثانية بعُشر ثانية (يُقرَّب العُشر أولًا فلا يُكتب 4:60.0) */
export const clockTenth = (s: number) => {
  const d = Math.round(s * 10);
  return `${Math.floor(d / 600)}:${((d % 600) / 10).toFixed(1).padStart(4, "0")}`;
};
/** «0:50.3–0:53.1 (c1-s8)» */
export const pauseText = (x: PauseSpan) => `${clockTenth(x.from)}–${clockTenth(x.to)}${x.scenes.length ? ` (${x.scenes.join("، ")})` : ""}`;

/** للطرفية */
export const pausesSummary = (silence: PauseReport, frozen: PauseReport): string => [
  `سكوت أطول من ${SILENCE_MAX_SEC} ث: ${silence.spans.length ? silence.spans.map(pauseText).join("، ") : "لا شيء"} (أطوله ${silence.longest} ث)`,
  `شاشة واقفة أطول من ${FREEZE_MAX_SEC} ث: ${frozen.spans.length ? frozen.spans.map(pauseText).join("، ") : "لا شيء"} (أطولها ${frozen.longest} ث)`,
].join("\n");
