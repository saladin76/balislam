/**
 * تصنيف القوالب لمكتبة الاستوديو وفحص التنوّع: العائلة البصرية، والقوالب الخاصة بقنوات بعينها (only).
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
  "map-journey": { family: "data", only: ["dafatir-alzaman", "balislam"], legacy: true },
  "desk-moment": { family: "story", legacy: true },
  "doc-plate": { family: "story", only: ["dafatir-alzaman"] },
  "sim-stage": { family: "story", legacy: true },
  "glow-story": { family: "story" },
  "character-talk": { family: "story" },
  "board-story": { family: "explain" },
  "motion-story": { family: "explain" },
  "sketch-board": { family: "explain" },
  symbolic: { family: "explain" },
  "big-question": { family: "text" },
  "kinetic-text": { family: "text" },
  comparison: { family: "data" },
  list: { family: "data" },
  "big-number": { family: "data" },
  chart: { family: "data" },
  timeline: { family: "data" },
  "verse-card": { family: "scripture" },
  "hadith-card": { family: "scripture" },
  summary: { family: "close" },
  "end-screen": { family: "close" },
};
