/**
 * قاعدة القناة: لا يظهر للمشاهد أي أثر يدل على أدوات الإنتاج (الذكاء الاصطناعي، أسماء الأدوات، الصوت المستنسخ).
 * يُفحص كل نص منشور (العناوين، الأوصاف، الوسوم، الكابشن، التعليق المثبّت، ملفات الترجمة)
 * قبل تجهيز الحزمة، وتعرض الواجهة الفحص بجوار كل حقل.
 */
import type { Check } from "./social";

const MARKS = /[ـً-ٰٟ]/g;

/** كل نمط: [ما يُبحث عنه، اسم مختصر يظهر لصاحب القناة] */
const PATTERNS: [RegExp, string][] = [
  [/ذكاء\s*(ال)?اصطناع/, "ذكاء اصطناعي"],
  [/(ال)?اصطناعي/, "اصطناعي"],
  [/مستنسخ|استنساخ|مُستنسَخ/, "استنساخ الصوت"],
  [/مولد\s*(آليا|آليًا|بال|من)|توليد\s*آلي|مولَّد/, "مولَّد آليًا"],
  [/صوت\s*(آلي|رقمي|صناعي)/, "صوت آلي"],
  [/(^|[^\p{L}])A\.?I\.?(?![\p{L}])/u, "AI"],
  [/eleven\s*labs|elevenlabs/i, "ElevenLabs"],
  [/\bclaude\b|anthropic/i, "Claude"],
  [/chat\s*gpt|\bgpt\b|openai/i, "ChatGPT"],
  [/midjourney|firefly|dall-?e|stable\s*diffusion|\bsora\b|\bveo\b|runway/i, "أداة توليد صور"],
  [/remotion/i, "Remotion"],
  [/synthetic|generated|text[-\s]?to[-\s]?speech|\btts\b|voice\s*clon/i, "مصطلح توليد"],
  [/كلود|شات\s*جي\s*بي\s*تي|إيليفن\s*لابز/, "اسم أداة بالعربية"],
];

/** كل الآثار الموجودة في نص (بلا تكرار). */
export const findTraces = (text: string): string[] => {
  const t = text.replace(MARKS, "");
  return [...new Set(PATTERNS.filter(([re]) => re.test(t)).map(([, name]) => name))];
};

/** فحص يظهر بجوار الحقل في الاستوديو. */
export const traceCheck = (text: string): Check => {
  const hits = findTraces(text);
  return { ok: hits.length === 0, label: hits.length ? `أثر أدوات: ${hits.join("، ")}` : "بلا أثر للأدوات" };
};

/** يرفض الحزمة إن وُجد أثر في أي ملف نصي منشور. */
export const assertNoTraces = (files: { name: string; text: string }[]) => {
  const bad = files.map((f) => ({ name: f.name, hits: findTraces(f.text) })).filter((f) => f.hits.length);
  if (bad.length)
    throw new Error(`قاعدة القناة: نص منشور يكشف أدوات الإنتاج، أزله ثم أعد التجهيز.\n${bad.map((b) => `• ${b.name}: ${b.hits.join("، ")}`).join("\n")}`);
};
