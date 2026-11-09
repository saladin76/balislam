/**
 * «أعد نطق الكلمة» (قرار صاحب المشروع، ٩ نوفمبر): استبدال كلمة واحدة في تسجيل جملة بكلمة من مقطع قصير جديد،
 * بدل توليد الجملة كلها. دوال صافية على PCM أحادي (Float32) بلا قرص ولا شبكة.
 *
 * - الحدود عند توقيت الكلمة، مُزاحة إلى أهدأ نقطة في ±40 م.ث ثم إلى أقرب عبور للصفر.
 * - وصلتان بتلاشٍ متساوي القدرة (15 م.ث)، وعلوّ الكلمة الجديدة يطابق جارتيها (RMS).
 * - الوقفات حول الكلمة تبقى من التسجيل الأصلي كما هي: يُستبدل مقطع الكلمة وحده.
 * - فحص الجودة: مدة الكلمة الجديدة بين 0.6 و1.6 من القديمة، ولا قفزة علوّ تزيد على 6 dB عند الوصلتين
 *   (زيادةً على ما كان في الأصل عند الموضع نفسه)، ولا فرق علوّ يزيد على 6 dB عن الجارتين بعد المطابقة.
 */
import type { TimedWord } from "./sentences";

export const SPLICE = { snapSec: 0.04, fadeSec: 0.015, minRatio: 0.6, maxRatio: 1.6, maxJumpDb: 6, maxLevelDb: 6, contextSec: 0.3, windowSec: 0.02 };

const ar = (x: number, d: number) => x.toLocaleString("ar-EG", { maximumFractionDigits: d, minimumFractionDigits: d });
const dbOf = (x: number) => Math.max(-60, 20 * Math.log10(Math.max(x, 1e-6)));

/** RMS بين زمنين بالثواني */
export const rmsOf = (pcm: Float32Array, sr: number, a: number, b: number) => {
  const i0 = Math.max(0, Math.floor(a * sr)), i1 = Math.min(pcm.length, Math.ceil(b * sr));
  let sum = 0;
  for (let i = i0; i < i1; i++) sum += pcm[i]! * pcm[i]!;
  return i1 > i0 ? Math.sqrt(sum / (i1 - i0)) : 0;
};

/** أهدأ نقطة قرب t (نافذة 5 م.ث كل 1 م.ث)، ثم أقرب عبور للصفر في ±2 م.ث */
export const snapBoundary = (pcm: Float32Array, sr: number, t: number, win = SPLICE.snapSec): number => {
  const dur = pcm.length / sr;
  const lo = Math.max(0, t - win), hi = Math.min(dur, t + win);
  let best = Math.min(dur, Math.max(0, t)), bestE = Infinity;
  for (let x = lo; x <= hi + 1e-9; x += 0.001) {
    const e = rmsOf(pcm, sr, x - 0.0025, x + 0.0025);
    if (e < bestE - 1e-9 || (Math.abs(e - bestE) <= 1e-9 && Math.abs(x - t) < Math.abs(best - t))) { bestE = e; best = x; }
  }
  const c = Math.round(best * sr), r = Math.round(0.002 * sr);
  for (let d = 0; d <= r; d++)
    for (const i of [c - d, c + d]) {
      if (i <= 0 || i >= pcm.length) continue;
      if ((pcm[i - 1]! <= 0 && pcm[i]! > 0) || (pcm[i - 1]! >= 0 && pcm[i]! < 0)) return i / sr;
    }
  return c / sr;
};

export type SpliceCheck = { ok: boolean; ratio: number; jumpsDb: number[]; levelDb: number; gainDb: number; reasons: string[] };
export type SpliceResult = {
  pcm: Float32Array;
  /** حدود الكلمة القديمة في الأصل والجديدة في المقطع (بعد الإزاحة) */
  a: number; b: number; fa: number; fb: number;
  /** فرق المدة الكلية: (fb−fa) − (b−a) */
  shift: number;
  gain: number;
  check: SpliceCheck;
};

/**
 * يستبدل [span] في base بـ [fragSpan] من frag. neighbours: كلمتا الجوار في base لمطابقة العلوّ.
 * الحدود تُزاح هنا (snap) ما لم يُطلب غير ذلك.
 */
export const spliceWord = (o: {
  base: Float32Array; frag: Float32Array; sr: number;
  span: { start: number; end: number }; fragSpan: { start: number; end: number };
  neighbours: { start: number; end: number }[];
  fadeSec?: number; snap?: boolean;
}): SpliceResult => {
  const { base, frag, sr } = o;
  const snap = o.snap !== false;
  let a = snap ? snapBoundary(base, sr, o.span.start) : o.span.start;
  let b = snap ? snapBoundary(base, sr, o.span.end) : o.span.end;
  let fa = snap ? snapBoundary(frag, sr, o.fragSpan.start) : o.fragSpan.start;
  let fb = snap ? snapBoundary(frag, sr, o.fragSpan.end) : o.fragSpan.end;
  if (b <= a) { a = o.span.start; b = o.span.end; }
  if (fb <= fa) { fa = o.fragSpan.start; fb = o.fragSpan.end; }

  // مطابقة العلوّ بجارتي الكلمة في الأصل
  let tSum = 0, tN = 0;
  for (const n of o.neighbours) {
    const i0 = Math.max(0, Math.floor(n.start * sr)), i1 = Math.min(base.length, Math.ceil(n.end * sr));
    for (let i = i0; i < i1; i++) { tSum += base[i]! * base[i]!; tN++; }
  }
  const target = tN ? Math.sqrt(tSum / tN) : rmsOf(base, sr, a, b);
  // علوّ الكلمة نفسها بتوقيتها (لا صمت الحدود المُزاحة)
  const fr = rmsOf(frag, sr, o.fragSpan.start, o.fragSpan.end);
  const gain = target > 1e-5 && fr > 1e-5 ? Math.min(4, Math.max(0.25, target / fr)) : 1;

  // الوصل: الأصل والمقطع مبطّنان بصمت hL في الطرفين فلا تخرج نافذة التلاشي عن الملف
  const hL = Math.max(1, Math.round(((o.fadeSec ?? SPLICE.fadeSec) * sr) / 2));
  const F = 2 * hL;
  const pad = (x: Float32Array) => { const y = new Float32Array(x.length + F); y.set(x, hL); return y; };
  const baseP = pad(base), fragP = pad(frag);
  const aS = Math.round(a * sr) + hL, bS = Math.round(b * sr) + hL;
  const faS = Math.round(fa * sr) + hL, fbS = Math.round(fb * sr) + hL;
  const A = baseP.subarray(0, aS + hL);
  const B = fragP.slice(faS - hL, fbS + hL).map((v) => v * gain);
  const C = baseP.subarray(bS - hL);
  const out = new Float32Array(A.length + B.length + C.length - 2 * F);
  const xfade = (x: Float32Array, y: Float32Array, at: number) => {
    for (let j = 0; j < F; j++) {
      const th = ((j + 0.5) / F) * (Math.PI / 2);
      out[at + j] = x[x.length - F + j]! * Math.cos(th) + y[j]! * Math.sin(th);
    }
  };
  out.set(A.subarray(0, A.length - F), 0);
  xfade(A, B, A.length - F);
  out.set(B.subarray(F, B.length - F), A.length);
  const s2 = A.length + B.length - 2 * F;
  // الوصلة الثانية: ذيل المقطع مع أول C
  for (let j = 0; j < F; j++) {
    const th = ((j + 0.5) / F) * (Math.PI / 2);
    out[s2 + j] = B[B.length - F + j]! * Math.cos(th) + C[j]! * Math.sin(th);
  }
  out.set(C.subarray(F), s2 + F);
  // حذف التبطين
  const pcm = out.slice(hL, out.length - hL);

  const shift = (fbS - faS - (bS - aS)) / sr;
  const aT = (aS - hL) / sr, seam2 = aT + (fbS - faS) / sr;
  const w = SPLICE.windowSec;
  const across = (x: Float32Array, t: number) => dbOf(rmsOf(x, sr, t - w, t)) - dbOf(rmsOf(x, sr, t, t + w));
  const jumpsDb = [Math.abs(across(pcm, aT)) - Math.abs(across(base, a)), Math.abs(across(pcm, seam2)) - Math.abs(across(base, b))].map((x) => Math.round(x * 10) / 10);
  const ratio = (fb - fa) / Math.max(1e-6, b - a);
  const levelDb = target > 1e-5 && fr > 1e-5 ? Math.round((dbOf(fr * gain) - dbOf(target)) * 10) / 10 : 0;
  const reasons: string[] = [];
  if (ratio < SPLICE.minRatio || ratio > SPLICE.maxRatio)
    reasons.push(`مدة الكلمة الجديدة ${ar(ratio, 2)}× من القديمة (المسموح ${ar(SPLICE.minRatio, 1)}–${ar(SPLICE.maxRatio, 1)}×).`);
  if (jumpsDb.some((j) => j > SPLICE.maxJumpDb)) reasons.push(`قفزة علوّ عند الوصل ${ar(Math.max(...jumpsDb), 1)} dB (الحد ${ar(SPLICE.maxJumpDb, 0)} dB).`);
  if (Math.abs(levelDb) > SPLICE.maxLevelDb) reasons.push(`علوّ الكلمة يختلف عن جارتيها ${ar(Math.abs(levelDb), 1)} dB بعد المطابقة.`);
  return {
    pcm, a: aT, b, fa, fb, shift, gain,
    check: { ok: reasons.length === 0, ratio: Math.round(ratio * 100) / 100, jumpsDb, levelDb, gainDb: Math.round(20 * Math.log10(gain) * 10) / 10, reasons },
  };
};

/** توقيت كلمات الجملة بعد الوصل: ما قبل الكلمة كما هو، والكلمة من المقطع، وما بعدها مُزاح بفرق المدة */
export const remapWords = (words: TimedWord[], k: number, r: Pick<SpliceResult, "a" | "b" | "fa" | "fb" | "shift">, fragWord: { start: number; end: number }): TimedWord[] =>
  words.map((w, i) => {
    if (i < k) return w;
    if (i > k) return { word: w.word, start: Math.max(0, w.start + r.shift), end: Math.max(0, w.end + r.shift) };
    const lo = r.a, hi = r.a + (r.fb - r.fa);
    const map = (t: number) => Math.min(hi, Math.max(lo, r.a + (t - r.fa)));
    return { word: w.word, start: map(fragWord.start), end: map(fragWord.end) };
  });
