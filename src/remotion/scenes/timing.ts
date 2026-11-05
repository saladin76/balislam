/**
 * توقيت الكلمات. في الإنتاج يأتي من ElevenLabs (with-timestamps) لكل كلمة.
 * إلى أن يتوفر الصوت نوزّع الكلمات بالتساوي على مدة الجملة (تقدير مؤقت للمعاينة فقط).
 */
export type WordTiming = { word: string; start: number; end: number };

export const splitWords = (text: string) => text.split(/\s+/).filter(Boolean);

/** توزيع تقديري: start/end بالإطارات. */
export const estimateTimings = (text: string, fromFrame: number, toFrame: number): WordTiming[] => {
  const words = splitWords(text);
  const weights = words.map((w) => Math.max(2, w.replace(/[ً-ْٰ]/g, "").length));
  const total = weights.reduce((a, b) => a + b, 0);
  const span = toFrame - fromFrame;
  let t = fromFrame;
  return words.map((word, i) => {
    const d = (span * (weights[i] ?? 2)) / total;
    const timing = { word, start: Math.round(t), end: Math.round(t + d) };
    t += d;
    return timing;
  });
};

/** يحوّل توقيتات بالثواني (من ElevenLabs) إلى إطارات. */
export const toFrames = (timings: { word: string; start: number; end: number }[], fps: number): WordTiming[] =>
  timings.map((t) => ({ word: t.word, start: Math.round(t.start * fps), end: Math.round(t.end * fps) }));

/**
 * لحظات متتالية لـ n عنصرًا موزعة على مدى الكلام المنطوق في المشهد (من أول كلمة إلى آخرها)،
 * فلا تظهر العناصر كلها في البداية ثم يسكن المشهد. بلا كلام: من from إلى to.
 */
export const spreadOverSpeech = (n: number, timings: WordTiming[], from: number, to: number): number[] => {
  if (n <= 0) return [];
  const a = timings.length ? Math.max(from, timings[0]!.start) : from;
  const b = timings.length ? Math.max(a + 1, timings[timings.length - 1]!.start) : to;
  if (n === 1) return [a];
  return Array.from({ length: n }, (_, i) => Math.round(a + ((b - a) * i) / (n - 1)));
};
