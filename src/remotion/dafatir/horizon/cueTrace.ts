/**
 * D246 «أ» (قرار المالك ٢٨ نوفمبر): تتبّع مراسي الرسم في لقطة «خط الأفق» بلا React ولا رندر.
 * أدوات المراسي (cueKit في البدايات، وcues في المكتبة) تبلّغ هنا كل كلمة يُبنى عليها حدث مرسوم في المرحلة الحالية
 * (لا مفاتيح الكاميرا)، برقم الكلمة في التوقيت ومدة الحدث. لا أثر له في الرسم: المسجّل فارغ إلا داخل traceCues.
 * يقرؤه src/plan/quoteFirstIdea.ts ليعرف «أول فكرة مرسومة» في المشهد الحامل فتنزل البطاقة بعدها.
 */
export type CueEvent = { idx: number; len: number };

let sink: CueEvent[] | null = null;
let muted = 0;

/** تُستدعى من أدوات المراسي: كلمة رقم idx في توقيت المشهد بدأ عندها حدث مرسوم مدته len */
export const recordCue = (idx: number, len: number) => {
  if (sink && !muted && idx >= 0) sink.push({ idx, len });
};
/** مفاتيح الكاميرا ليست رسمًا: ما يُحسب داخلها لا يُسجَّل */
export const muteCues = <T>(fn: () => T): T => {
  muted++;
  try { return fn(); } finally { muted--; }
};
/** يشغّل رسم اللقطة مرة ويعيد مراسيه (خطأ الرسم، ككلمة غائبة، يُبتلع: ما سُجّل قبله يبقى) */
export const traceCues = (run: () => unknown): CueEvent[] => {
  const prev = sink;
  const out: CueEvent[] = [];
  sink = out;
  try { run(); } catch { /* M4: كلمة غائبة — يُعامل المشهد بلا فكرة مرسومة معروفة */ } finally { sink = prev; }
  return out;
};
