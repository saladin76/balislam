/**
 * تصنيف القوالب لمكتبة الاستوديو وفحص التنوّع: العائلة البصرية، والقوالب الخاصة بقنوات بعينها (only).
 * قوالب الأسلوب (التي تحمل حلقة كاملة) لكل قناة وحدها، فلا يتشابه أسلوب قناتين:
 * بالإسلام: القصة المتحركة والمضيئة والنص الحركي · زبدة الكتب: السبورة والرسم · دفاتر الزمن: اللوحات الوثائقية والخط الزمني.
 * ما يجوز لكل قناة يُحسب في src/channel/library.ts (يجمع only مع قواعد القناة: القرآن والحديث والوجوه).
 */
export type TemplateFamily = "story" | "explain" | "text" | "data" | "scripture" | "close";
export const familyNamesAr: Record<TemplateFamily, string> = {
  story: "قصة ومشاهد",
  explain: "شرح ورسم",
  text: "نص وحركة",
  data: "أرقام ومقارنات",
  scripture: "آيات وأحاديث",
  close: "خلاصة وختام",
};
/** legacy: قالب برسومات وألوان ثابتة من قبل الهويات المعتمدة؛ لا يظهر في مكتبة أي قناة ولا يُستعمل حتى يُعاد رسمه بهويتها */
export const templateMeta: Record<string, { family: TemplateFamily; only?: string[]; legacy?: true }> = {
  "set-scene": { family: "story", legacy: true },
  // أُعيد رسمه بهوية «دفتر الأفق» وقيست حركته، فعاد لدفاتر الزمن وحدها
  "map-journey": { family: "data", only: ["dafatir-alzaman"] },
  "desk-moment": { family: "story", legacy: true },
  "doc-plate": { family: "story", only: ["dafatir-alzaman"] },
  "sim-stage": { family: "story", legacy: true },
  "glow-story": { family: "story", only: ["balislam"] },
  "character-talk": { family: "story" },
  "board-story": { family: "explain", only: ["zubdat-alkutub"] },
  "alley-tale": { family: "story", only: ["balislam"] },
  "road-journey": { family: "story", only: ["balislam"] },
  "light-stage": { family: "story", only: ["balislam"] },
  "motion-story": { family: "explain", only: ["balislam"] },
  "sketch-board": { family: "explain", only: ["zubdat-alkutub"] },
  symbolic: { family: "explain" },
  "big-question": { family: "text" },
  "kinetic-text": { family: "text", only: ["balislam"] },
  comparison: { family: "data" },
  list: { family: "data" },
  "big-number": { family: "data" },
  chart: { family: "data" },
  timeline: { family: "data", only: ["dafatir-alzaman"] },
  "verse-card": { family: "scripture" },
  "hadith-card": { family: "scripture" },
  summary: { family: "close" },
  "end-screen": { family: "close" },
};
