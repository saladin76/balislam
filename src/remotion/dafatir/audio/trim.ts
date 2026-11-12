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
 * توسيع القص ليشمل أول حرف وآخر حرف كما في محاذاة الحروف التي يعيدها التوليد (إن وُجدت):
 * القص لا يبدأ بعد أول حرف ولا ينتهي قبل آخر حرف أبدًا.
 */
export const safeTrim = (b: SpeechBounds, alignment?: { start: number[]; end: number[] }, opts: Partial<TrimOptions> = {}): SpeechBounds => {
  if (!alignment || (!alignment.start.length && !alignment.end.length)) return b;
  const o = { ...TRIM_DEFAULTS, ...opts };
  // Timestamp encoders can differ from decoded PCM by one analysis frame. Reject larger drift;
  // never return speechEnd > end (the compositor correctly refuses that contract).
  const tolerance = o.frameSec + 1e-9;
  const invalid = !Number.isFinite(b.duration) || b.duration <= 0 ||
    alignment.start.length !== alignment.end.length ||
    alignment.start.some((start, i) => !Number.isFinite(start) || !Number.isFinite(alignment.end[i]) ||
      start < -tolerance || alignment.end[i]! > b.duration + tolerance || start > alignment.end[i]! ||
      (i > 0 && (start < alignment.start[i - 1]! || alignment.end[i]! < alignment.end[i - 1]!)));
  if (invalid) throw new Error(
    "توقيت المحاذاة لا يطابق مدة التسجيل؛ أعد معالجة التسجيل الأصلي دون توليد جديد. " +
    JSON.stringify({ duration: b.duration, first: alignment.start[0], last: alignment.end.at(-1) }),
  );
  const firstChar = Math.max(0, Math.min(b.duration, Math.min(...alignment.start)));
  const lastChar = Math.max(0, Math.min(b.duration, Math.max(...alignment.end)));
  // The no-silence fallback also derives b.speech* from the same alignment.
  const speechStart = Math.max(0, Math.min(b.duration, Math.min(b.speechStart, firstChar)));
  const speechEnd = Math.min(b.duration, Math.max(b.speechEnd, lastChar));
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
