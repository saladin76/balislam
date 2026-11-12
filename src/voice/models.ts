/**
 * قدرات نماذج ElevenLabs: كل نموذج يقبل إعدادات مختلفة، فتُبنى الطلبات بحسبه.
 * - multilingual v2: السرعة والتعبير والثبات المتصل والنص المجاور (لاتصال النبرة بين المشاهد).
 * - v3: ثبات بثلاث قيم فقط (0 / 0.5 / 1) وأوامر أداء بين أقواس.
 * - v4: الثبات والتشابه وأوامر الأداء؛ لا سرعة ولا تعبير (حسب توثيق ElevenLabs)، فالسرعة تُطبَّق بعد التوليد
 *   بتمديد زمني يحفظ طبقة الصوت، والتعبير يُنقل بأمر أداء يناسب النبرة. ويقبل النص المجاور (وصل الطلبات أوثق فيه،
 *   D94): بدونه تُقرأ كل جملة منفصلة كأنها أول الكلام وآخره، فيتقطّع الإيقاع بين الجمل. v3 وحده بلا وصل.
 * نموذج غير معروف يعامَل بحذر كنموذج v4.
 */
export type ModelCaps = {
  id: string;
  nameAr: string;
  /** native: يرسلها النموذج؛ post: تُطبَّق بعد التوليد */
  speed: "native" | "post";
  style: boolean;
  stability: "continuous" | "discrete";
  /** previous_text / next_text */
  context: boolean;
  /** أوامر أداء مثل [calm] */
  tags: boolean;
  /** يحتاج الصوت الاحترافي تدريبًا خاصًا على هذا النموذج */
  needsTraining: boolean;
};

export const MODEL_CAPS: Record<string, ModelCaps> = {
  eleven_v4: { id: "eleven_v4", nameAr: "Eleven v4 (الأحدث، أعلى جودة)", speed: "post", style: false, stability: "continuous", context: true, tags: true, needsTraining: true },
  eleven_v3: { id: "eleven_v3", nameAr: "Eleven v3", speed: "post", style: false, stability: "discrete", context: false, tags: true, needsTraining: true },
  eleven_multilingual_v2: { id: "eleven_multilingual_v2", nameAr: "Multilingual v2 (المجرَّب سابقًا)", speed: "native", style: true, stability: "continuous", context: true, tags: false, needsTraining: true },
};

export const capsFor = (modelId: string): ModelCaps =>
  MODEL_CAPS[modelId] ?? { id: modelId, nameAr: modelId, speed: "post", style: false, stability: "continuous", context: false, tags: true, needsTraining: true };

/** الثبات كما يقبله النموذج */
export const stabilityFor = (caps: ModelCaps, x: number) => (caps.stability === "discrete" ? [0, 0.5, 1].reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a)) : x);

/** نص الطلب: أمر الأداء أولًا (للنماذج التي تقبله) ثم النص */
export const withDirection = (caps: ModelCaps, text: string, direction?: string) => (caps.tags && direction ? `[${direction}] ${text}` : text);

/** حذف كلمات أوامر الأداء من توقيت الكلام قبل الترجمة على الشاشة (لا تظهر أبدًا) */
export const dropTagWords = <T extends { word: string }>(words: T[]): T[] => {
  const out: T[] = [];
  let inside = false;
  for (const w of words) {
    if (!inside && w.word.startsWith("[")) inside = true;
    if (!inside) out.push(w);
    if (inside && w.word.includes("]")) inside = false;
  }
  return out;
};
