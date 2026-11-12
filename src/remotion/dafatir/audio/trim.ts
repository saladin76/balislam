/**
 * حدود الكلام في تسجيل الراوي — «دفاتر الزمن» (الأمر 025).
 *
 * معزول: لا يستدعيه مسار التوليد ولا الرندر المشترك بعد. يُستعمل لاحقًا لقص صمت طرفي التسجيل
 * حتى لا يجتمع صمت التسجيل مع ذيل المشهد أو صمت التلاوة (قرار D8).
 *
 * القص لا يأكل حرفًا: يبدأ من أول إطار قوي ثم يرجع ما دام الصوت فوق عتبة لينة
 * (الحروف المهموسة في أول الكلام مثل ف/س/ه)، ويتقدم في الآخر ما دام الصوت يتلاشى (النفَس والسكت)،
 * ثم يترك هامشًا قبل الكلام وبعده.
 */

export type TrimOptions = {
  /** طول إطار القياس بالثواني */
  frameSec: number;
  /** هامش يُترك قبل أول صوت مسموع */
  onsetPadSec: number;
  /** هامش يُترك بعد آخر صوت مسموع (التلاشي) */
  releasePadSec: number;
  /** الإطار القوي: فوق أرضية الضجيج بهذا القدر، أو دون القمة بهذا القدر */
  strongAboveFloorDb: number;
  strongBelowPeakDb: number;
  /** الإطار اللين (حرف مهموس، تلاشٍ) */
  softAboveFloorDb: number;
  softBelowPeakDb: number;
};

export const TRIM_DEFAULTS: TrimOptions = {
  frameSec: 0.01,
  onsetPadSec: 0.06,
  releasePadSec: 0.15,
  strongAboveFloorDb: 18,
  strongBelowPeakDb: 35,
  softAboveFloorDb: 6,
  softBelowPeakDb: 55,
};

export type SpeechBounds = {
  /** مدة التسجيل كاملًا */
  duration: number;
  /** أول صوت مسموع وآخره (ثوانٍ من بداية الملف) */
  speechStart: number;
  speechEnd: number;
  /** نقطتا القص: الكلام مع هامشيه */
  start: number;
  end: number;
  floorDb: number;
  peakDb: number;
};

const db = (rms: number) => (rms > 0 ? 20 * Math.log10(rms) : -120);

/** مستوى كل إطار بالديسيبل */
export const frameLevels = (samples: Float32Array, sampleRate: number, frameSec = TRIM_DEFAULTS.frameSec): number[] => {
  const n = Math.max(1, Math.round(frameSec * sampleRate));
  const out: number[] = [];
  for (let i = 0; i < samples.length; i += n) {
    let sum = 0;
    const end = Math.min(samples.length, i + n);
    for (let j = i; j < end; j++) sum += samples[j]! * samples[j]!;
    out.push(db(Math.sqrt(sum / Math.max(1, end - i))));
  }
  return out;
};

export const speechBounds = (samples: Float32Array, sampleRate: number, opts: Partial<TrimOptions> = {}): SpeechBounds => {
  const o = { ...TRIM_DEFAULTS, ...opts };
  const lv = frameLevels(samples, sampleRate, o.frameSec);
  const duration = samples.length / sampleRate;
  const sorted = [...lv].sort((a, b) => a - b);
  const floorDb = sorted[Math.floor(sorted.length * 0.1)] ?? -120;
  const peakDb = sorted[sorted.length - 1] ?? -120;
  const strong = Math.max(floorDb + o.strongAboveFloorDb, peakDb - o.strongBelowPeakDb);
  const soft = Math.max(floorDb + o.softAboveFloorDb, peakDb - o.softBelowPeakDb);
  let first = lv.findIndex((x) => x >= strong);
  if (first < 0 || peakDb <= floorDb + o.softAboveFloorDb) throw new Error("لا كلام في التسجيل");
  let last = lv.length - 1;
  while (last > first && lv[last]! < strong) last--;
  // الرجوع إلى أول الحرف المهموس، والتقدم إلى آخر التلاشي
  while (first > 0 && lv[first - 1]! >= soft) first--;
  while (last < lv.length - 1 && lv[last + 1]! >= soft) last++;
  const speechStart = (first * o.frameSec);
  const speechEnd = Math.min(duration, (last + 1) * o.frameSec);
  return {
    duration,
    speechStart,
    speechEnd,
    start: Math.max(0, speechStart - o.onsetPadSec),
    end: Math.min(duration, speechEnd + o.releasePadSec),
    floorDb,
    peakDb,
  };
};

/**
 * كم يُقبل أن تتجاوز محاذاة الكلمات طرفي الملف بعد فكّه (D110، مراجعة PR #97): ١٥٠ م.ث.
 * التوقيت يحسبه مزوّد الصوت على صوته هو، والملف المحفوظ MP3 يُفك هنا بـ ffmpeg إلى 44.1 kHz. قيس (ffmpeg 6.1،
 * LAME 128k، جملة طولها ١٫٠٠٠ ث): المفكّك يحذف حشو المرمّز فيعطي ١٫٠٠٠ ث، بينما المدة المعلنة للملف (إطارات MP3
 * كاملة، ١١٥٢ عينة للإطار) ١٫٠٤٥ ث عند 44.1 kHz و١٫٠٥٦ عند 24 kHz و١٫٠٧١ عند 22.05 kHz؛ وبلا ترويسة LAME يبقى
 * الحشو في الملف المفكوك (١٫٠٤٥). فتوقيت محسوب على المدة المعلنة يتجاوز الملف المفكوك حتى ≈ ٧١ م.ث. الحد ١٥٠ م.ث
 * ضعف ذلك تقريبًا، وأقصر من أقصر كلمة منطوقة؛ وما فوقه ليس فرق ترميز بل توقيت ملف آخر أو تسجيل مقطوع، فيُرفض.
 * يُراجَع على تسجيلات المالك الحقيقية بـ `npx bal voice-timing --all-channels --takes` (قياس فقط، بلا توليد).
 */
export const ALIGNMENT_OVERSHOOT_MAX_SEC = 0.15;
/** كم زوجًا متجاورًا مقلوب الترتيب يُقبل (تقريب توقيت المزوّد)؛ ما فوقه توقيت تسجيل آخر فيُرفض (D110) */
export const ALIGNMENT_DISORDER_MAX = 2;

/** تجاوز محدود حُصر في طرفي الملف: يُسجَّل تنبيهًا ولا يوقف التركيب */
export type AlignmentClamp = { overshootEndSec: number; undershootStartSec: number; disorder: number; duration: number };
export class AlignmentCorruptError extends Error {
  readonly code = "ALIGNMENT_CORRUPT";
  constructor(readonly detail: Record<string, unknown>) {
    super("توقيت المحاذاة لا يطابق مدة التسجيل؛ أعد معالجة التسجيل الأصلي دون توليد جديد. " + JSON.stringify(detail));
  }
}

/**
 * يفحص محاذاة الكلمات مقابل مدة الملف: `ok` سليمة، و`clamped` تجاوز محدود (≤ ALIGNMENT_OVERSHOOT_MAX_SEC)
 * يُحصر في طرفي الملف، و`corrupt` توقيت تالف بوضوح (قيمة غير رقمية، أطوال مختلفة، كلمة نهايتها قبل بدايتها
 * بأكثر من الحد، أو تجاوز أكبر من الحد). ترتيب الكلمات المتداخل قليلًا (حتى ALIGNMENT_DISORDER_MAX زوجًا) ليس تلفًا (القص يأخذ أصغر بداية وأكبر نهاية)، وما فوقه تلف.
 */
export const alignmentVerdict = (duration: number, alignment: { start: number[]; end: number[] }, maxSec = ALIGNMENT_OVERSHOOT_MAX_SEC):
  { kind: "ok" } | { kind: "clamped"; clamp: AlignmentClamp } | { kind: "corrupt"; detail: Record<string, unknown> } => {
  const { start, end } = alignment;
  const detail = (reason: string) => ({ reason, duration, first: start[0], last: end.at(-1), words: start.length });
  if (!Number.isFinite(duration) || duration <= 0) return { kind: "corrupt", detail: detail("مدة الملف غير صالحة") };
  if (start.length !== end.length) return { kind: "corrupt", detail: detail("عدد البدايات لا يساوي عدد النهايات") };
  if (start.some((x, i) => !Number.isFinite(x) || !Number.isFinite(end[i]))) return { kind: "corrupt", detail: detail("توقيت غير رقمي") };
  if (start.some((x, i) => x - end[i]! > maxSec)) return { kind: "corrupt", detail: detail("كلمة تنتهي قبل أن تبدأ") };
  const overshootEndSec = Math.max(0, Math.max(...end) - duration);
  const undershootStartSec = Math.max(0, -Math.min(...start));
  if (overshootEndSec > maxSec || undershootStartSec > maxSec)
    return { kind: "corrupt", detail: { ...detail("التوقيت يتجاوز طرفي الملف"), overshootEndSec, undershootStartSec, maxSec } };
  let disorder = 0;
  for (let i = 1; i < start.length; i++) if (start[i]! < start[i - 1]! || end[i]! < end[i - 1]! || start[i]! > end[i]!) disorder++;
  // A word or two out of order is rounding in the provider's timings; more is a timing list of another take.
  if (disorder > ALIGNMENT_DISORDER_MAX)
    return { kind: "corrupt", detail: { ...detail("ترتيب الكلمات مقلوب في أكثر من موضعين"), disorder, maxDisorder: ALIGNMENT_DISORDER_MAX } };
  const tiny = 1e-6;
  if (overshootEndSec <= tiny && undershootStartSec <= tiny && disorder === 0) return { kind: "ok" };
  return { kind: "clamped", clamp: { overshootEndSec, undershootStartSec, disorder, duration } };
};

/** التنبيه الافتراضي للتجاوز المحدود: سطر في سجل الخادم (لا يراه المالك خطأً، ولا يوقف التركيب) */
export const warnAlignmentClamp = (label: string, c: AlignmentClamp) => {
  // eslint-disable-next-line no-console
  console.warn(`[voice] ${label}: محاذاة خارج طرفي الملف حُصرت فيه (نهاية +${Math.round(c.overshootEndSec * 1000)} م.ث، بداية −${Math.round(c.undershootStartSec * 1000)} م.ث، ترتيب ${c.disorder}، المدة ${c.duration.toFixed(3)} ث).`);
};

/**
 * توسيع القص ليشمل أول حرف وآخر حرف كما في محاذاة الحروف التي يعيدها التوليد (إن وُجدت):
 * القص لا يبدأ بعد أول حرف ولا ينتهي قبل آخر حرف أبدًا، ولا يخرج عن الملف أبدًا (speechEnd ≤ end ≤ duration).
 * مشترك بين أجزاء دفاتر الزمن وتركيب الجمل (D50): التجاوز المحدود يُحصر ويُنبَّه عليه (`onClamp`)، والتالف يُرفض.
 */
export const safeTrim = (b: SpeechBounds, alignment?: { start: number[]; end: number[] }, opts: Partial<TrimOptions> = {},
  onClamp: (c: AlignmentClamp) => void = (c) => warnAlignmentClamp("تسجيل", c)): SpeechBounds => {
  if (!alignment || (!alignment.start.length && !alignment.end.length)) return b;
  const o = { ...TRIM_DEFAULTS, ...opts };
  const v = alignmentVerdict(b.duration, alignment);
  if (v.kind === "corrupt") throw new AlignmentCorruptError(v.detail);
  if (v.kind === "clamped") onClamp(v.clamp);
  const firstChar = Math.max(0, Math.min(b.duration, Math.min(...alignment.start)));
  const lastChar = Math.max(0, Math.min(b.duration, Math.max(...alignment.end)));
  // The no-silence fallback also derives b.speech* from the same alignment.
  const speechStart = Math.max(0, Math.min(b.duration, Math.min(b.speechStart, firstChar)));
  const speechEnd = Math.max(speechStart, Math.min(b.duration, Math.max(b.speechEnd, lastChar)));
  return { ...b, speechStart, speechEnd, start: Math.max(0, Math.min(b.start, speechStart - o.onsetPadSec)), end: Math.min(b.duration, Math.max(b.end, speechEnd + o.releasePadSec)) };
};

/** قراءة WAV (PCM 16 أو float 32) إلى عينات أحادية بين −1 و1 — للتسجيلات بعد فكّها */
export const readWav = (buf: Uint8Array): { samples: Float32Array; sampleRate: number } => {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (o: number) => String.fromCharCode(buf[o]!, buf[o + 1]!, buf[o + 2]!, buf[o + 3]!);
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("ليس ملف WAV");
  let p = 12;
  let fmt: { format: number; channels: number; rate: number; bits: number } | null = null;
  while (p + 8 <= buf.length) {
    const id = tag(p);
    const size = v.getUint32(p + 4, true);
    const body = p + 8;
    if (id === "fmt ") fmt = { format: v.getUint16(body, true), channels: v.getUint16(body + 2, true), rate: v.getUint32(body + 4, true), bits: v.getUint16(body + 14, true) };
    if (id === "data") {
      if (!fmt) throw new Error("WAV بلا fmt");
      const bytes = fmt.bits / 8;
      const frames = Math.floor(size / (bytes * fmt.channels));
      const out = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let s = 0;
        for (let c = 0; c < fmt.channels; c++) {
          const o = body + (i * fmt.channels + c) * bytes;
          s += fmt.format === 3 && fmt.bits === 32 ? v.getFloat32(o, true) : fmt.bits === 16 ? v.getInt16(o, true) / 32768 : 0;
        }
        out[i] = s / fmt.channels;
      }
      return { samples: out, sampleRate: fmt.rate };
    }
    p = body + size + (size % 2);
  }
  throw new Error("WAV بلا data");
};
