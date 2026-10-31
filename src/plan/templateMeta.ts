/**
 * تصنيف القوالب لمكتبة الاستوديو وفحص التنوّع: العائلة البصرية، والقنوات التي يناسبها كل قالب.
 * القناة غير المذكورة يناسبها القالب ما لم يُستثنَ (مثل بطاقات الآيات لقناة الكتب).
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
export const templateMeta: Record<string, { family: TemplateFamily; only?: string[]; not?: string[] }> = {
  "set-scene": { family: "story" },
  "desk-moment": { family: "story" },
  "sim-stage": { family: "story" },
  "glow-story": { family: "story" },
  "character-talk": { family: "story" },
  "board-story": { family: "explain" },
  "sketch-board": { family: "explain" },
  symbolic: { family: "explain" },
  "big-question": { family: "text" },
  "kinetic-text": { family: "text" },
  comparison: { family: "data" },
  list: { family: "data" },
  "big-number": { family: "data" },
  chart: { family: "data" },
  timeline: { family: "data" },
  "verse-card": { family: "scripture", not: ["zubdat-alkutub"] },
  "hadith-card": { family: "scripture", not: ["zubdat-alkutub"] },
  summary: { family: "close" },
  "end-screen": { family: "close" },
};
export const templateSuits = (id: string, channel: string) => {
  const m = templateMeta[id];
  if (!m) return true;
  if (m.only && !m.only.includes(channel)) return false;
  return !m.not?.includes(channel);
};
