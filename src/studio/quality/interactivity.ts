/**
 * مقياس التفاعلية (خطة «احترافية بلا مثيل»، قرار المالك ٢، المرحلة A): في ٨٠٪ على الأقل من زمن الفيديو
 * شيء يتحرك أو يتغير على الشاشة (كاميرا، شخصية، كلمة تظهر، رسم يتكوّن، انتقال)، بعد استبعاد السكون المقصود
 * عند ذكر الله والآيات والدعاء (src/render/stillnessSpans.ts).
 *
 * يُقاس على الفيديو المجمّع نفسه بمرشح FFmpeg «freezedetect»: كل مقطع لا يتغير فيه الإطار (فوق FREEZE_NOISE)
 * مدة FREEZE_MIN_SEC فأكثر «ساكن»، وما سواه متحرك. وبخلاف src/render/motionMeter.ts (الحركة المقصودة، القاعدة الثانية
 * في CLAUDE.md) تُحسب هنا حركة الكاميرا البطيئة والانجراف، كما نص قرار المالك.
 * المساحة المقيسة هي مساحة المشهد نفسها في motionMeter: بلا أعلى ١٢٪ (عنوان الفصل) وأسفل ٢٤٪ (الترجمة)،
 * فلا تجعل الترجمة المتغيرة مع كل كلمة الفيديو كله «متحركًا».
 * الحساب بالفترات لا بالثواني: النسبة = (الزمن المحسوب − الساكن منه) ÷ الزمن المحسوب،
 * والزمن المحسوب = مدة الفيديو − نوافذ السكون المقصود.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Plan } from "../../plan/types";
import type { EpisodeMedia } from "../../plan/media";
import { sceneAdvanceFrames } from "../../plan/seams";
import { intendedStillness, type Span } from "../../render/stillnessSpans";

const exec = promisify(execFile);

export const INTERACTIVITY_MIN = 80;
/** D214: الحد لكل قناة — «دفاتر الزمن» (خط الأفق) ٩٥٪ خارج السكون المقصود بقرار المالك (٢٤ نوفمبر)، وغيرها ٨٠٪ */
export const INTERACTIVITY_MIN_BY_CHANNEL: Readonly<Record<string, number>> = { "dafatir-alzaman": 95 };
export const interactivityMinFor = (channel?: string) => (channel && INTERACTIVITY_MIN_BY_CHANNEL[channel]) || INTERACTIVITY_MIN;
/** مقطع ساكن غير مقصود أطول من هذا يُذكر بالاسم في البطاقة (القاعدة الثانية: لا يزيد على ثانيتين) */
export const STILL_REPORT_SEC = 2;
/** تغيّر الإطار تحت هذا (نسبة، 0.003 ≈ −50 dB) ضجيج ترميز لا حركة */
export const FREEZE_NOISE = 0.003;
/** أقصر سكون يلتقطه المرشح بالثواني */
export const FREEZE_MIN_SEC = 0.5;
/** مساحة المشهد (كما في motionMeter): من ١٢٪ إلى ٧٦٪ من الارتفاع */
export const SCENE_TOP = 0.12;
export const SCENE_BOTTOM = 0.76;

export type Interval = { from: number; to: number };

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** دمج الفترات المتداخلة والمتلاصقة بعد قصها على [0, end] */
export const mergeIntervals = (xs: readonly Interval[], end = Infinity): Interval[] => {
  const sorted = xs.map((x) => ({ from: Math.max(0, x.from), to: Math.min(end, x.to) })).filter((x) => x.to > x.from).sort((a, b) => a.from - b.from);
  const out: Interval[] = [];
  for (const x of sorted) {
    const last = out[out.length - 1];
    if (last && x.from <= last.to) last.to = Math.max(last.to, x.to);
    else out.push({ ...x });
  }
  return out;
};

export const totalLength = (xs: readonly Interval[]) => mergeIntervals(xs).reduce((a, x) => a + (x.to - x.from), 0);

/** a ناقص b (كلاهما قائمة فترات) */
export const subtractIntervals = (a: readonly Interval[], b: readonly Interval[]): Interval[] => {
  const cut = mergeIntervals(b);
  const out: Interval[] = [];
  for (const x of mergeIntervals(a)) {
    let from = x.from;
    for (const y of cut) {
      if (y.to <= from || y.from >= x.to) continue;
      if (y.from > from) out.push({ from, to: y.from });
      from = Math.max(from, y.to);
    }
    if (from < x.to) out.push({ from, to: x.to });
  }
  return out;
};

/** فترات السكون من مخرجات freezedetect؛ سكون بلا نهاية يمتد إلى آخر الفيديو */
export const parseFreezes = (stderr: string, duration: number): Interval[] => {
  const out: Interval[] = [];
  let start: number | null = null;
  for (const m of stderr.matchAll(/freeze_(start|end):\s*(-?[\d.]+)/g)) {
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

export type InteractivityReport = {
  /** نسبة زمن الحركة من الزمن المحسوب (منزلة عشرية واحدة، بالقطع لا بالتقريب للأعلى) */
  percent: number;
  duration: number;
  /** الزمن المحسوب: المدة بلا السكون المقصود */
  counted: number;
  moving: number;
  /** زمن السكون المقصود داخل الفيديو */
  exempt: number;
  /** السكون غير المقصود الذي يزيد على STILL_REPORT_SEC */
  still: Interval[];
  min: number;
  ok: boolean;
};

export const interactivityFrom = (duration: number, freezes: readonly Interval[], exempt: readonly Interval[] = []): InteractivityReport => {
  const ex = mergeIntervals(exempt, duration);
  const exemptSec = totalLength(ex);
  const counted = Math.max(0, duration - exemptSec);
  const stillAll = subtractIntervals(mergeIntervals(freezes, duration), ex);
  const moving = Math.max(0, counted - totalLength(stillAll));
  const raw = counted > 0 ? (moving / counted) * 100 : 100;
  return {
    percent: Math.floor(raw * 10) / 10,
    duration: r3(duration),
    counted: r3(counted),
    moving: r3(moving),
    exempt: r3(exemptSec),
    still: stillAll.filter((x) => x.to - x.from > STILL_REPORT_SEC).map((x) => ({ from: r3(x.from), to: r3(x.to) })),
    min: INTERACTIVITY_MIN,
    ok: raw >= INTERACTIVITY_MIN,
  };
};

const probeDuration = async (file: string) => {
  const { stdout } = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  const d = Number(stdout.trim());
  if (!Number.isFinite(d) || d <= 0) throw Error(`مدة الفيديو غير معروفة: ${file}`);
  return d;
};

/** فترات السكون في مساحة المشهد لملف فيديو (يُصغَّر للقياس فلا يطول على 4K) */
export const detectFreezes = async (file: string, duration?: number): Promise<{ duration: number; freezes: Interval[] }> => {
  const d = duration ?? (await probeDuration(file));
  const vf = `crop=iw:trunc(ih*${(SCENE_BOTTOM - SCENE_TOP).toFixed(2)}/2)*2:0:trunc(ih*${SCENE_TOP}/2)*2,scale=480:-2,freezedetect=n=${FREEZE_NOISE}:d=${FREEZE_MIN_SEC}`;
  const r = await exec("ffmpeg", ["-hide_banner", "-nostats", "-nostdin", "-i", file, "-map", "0:v:0", "-vf", vf, "-an", "-f", "null", "-"], { maxBuffer: 64 * 1024 * 1024, timeout: 3_600_000 });
  return { duration: d, freezes: parseFreezes(String(r.stderr), d) };
};

export const measureInteractivity = async (file: string, exempt: readonly Interval[] = []): Promise<InteractivityReport> => {
  const { duration, freezes } = await detectFreezes(file);
  return interactivityFrom(duration, freezes, exempt);
};

/** بداية كل مشهد ظاهر في زمن الخطة (كما يحسبها intendedStillness: وصل السرد تحت ذيل السابق) */
export const planSceneStarts = (plan: Plan, media: Pick<EpisodeMedia, "voice" | "recitations">, startSec = 0, chapter?: number): { id: string; start: number }[] => {
  const shown = plan.chapters.filter((c) => !chapter || c.number === chapter).flatMap((c) => c.scenes.filter((s) => !(chapter && s.template === "end-screen")));
  const adv = sceneAdvanceFrames(shown, media, { channelId: plan.channel });
  let t = startSec;
  return shown.map((s, i) => {
    const out = { id: s.id, start: t };
    t += adv[i]! / 30;
    return out;
  });
};

/**
 * ينقل فترات زمن الخطة إلى زمن الملف المجمّع: كل فترة تُزاح بفرق بداية مشهدها بين الخطة والملف
 * (المشاهد في الملف بأطوالها الفعلية، وقد يُقص سكوت البداية KI-091). مشهد غائب عن الملف تسقط فتراته.
 */
export const remapSpans = <T extends Interval>(spans: readonly T[], planStarts: readonly { id: string; start: number }[], fileStarts: ReadonlyMap<string, number>): T[] => {
  const out: T[] = [];
  for (const x of spans) {
    let k = -1;
    for (let i = 0; i < planStarts.length; i++) if (planStarts[i]!.start <= x.from + 1e-6) k = i;
    if (k < 0) k = 0;
    const s = planStarts[k];
    const at = s && fileStarts.get(s.id);
    if (!s || at === undefined) continue;
    out.push({ ...x, from: x.from + at - s.start, to: x.to + at - s.start });
  }
  return out;
};

/** بداية كل مشهد في الملف المجمّع من سجل وصلاته (previews/<slot>.seams.json) */
export const fileStartsFromSeams = (rec: { sceneSeconds: Record<string, number>; seams: { at: number }[]; headTrimmed?: number }): Map<string, number> => {
  const ids = Object.keys(rec.sceneSeconds);
  const out = new Map<string, number>();
  ids.forEach((id, i) => out.set(id, i === 0 ? -(rec.headTrimmed ?? 0) : rec.seams[i - 1]?.at ?? NaN));
  return new Map([...out].filter(([, v]) => Number.isFinite(v)));
};

/** نوافذ السكون المقصود في الملف المجمّع */
export const assemblyStillness = (plan: Plan, media: Pick<EpisodeMedia, "voice" | "recitations">, rec: Parameters<typeof fileStartsFromSeams>[0], introSec = 0): Span[] => {
  return remapSpans(intendedStillness(plan, introSec, media), planSceneStarts(plan, media, introSec), fileStartsFromSeams(rec));
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const interactivitySummary = (r: InteractivityReport): string => {
  const head = `التفاعلية: ${r.percent}% من ${Math.round(r.counted)} ث محسوبة (الحد ${r.min}%) · سكون مقصود مستثنى ${Math.round(r.exempt)} ث`;
  return r.still.length ? `${head}\nسكون غير مقصود فوق ${STILL_REPORT_SEC} ث: ${r.still.map((x) => `${clock(x.from)}–${clock(x.to)}`).join("، ")}` : head;
};
