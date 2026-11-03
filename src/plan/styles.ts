import { templateDefs } from "./templates";

/**
 * أسلوب الحلقة (style في رأس السكريبت): القالب الذي تأخذه المشاهد التي بلا علامة [مشهد: …].
 * مصدر واحد للسكريبت والخطة والاستوديو. الاختصارات الأربعة للأساليب الأساسية، ويُقبل أيضًا معرّف أي قالب.
 */
export const STYLE_ALIASES: Record<string, string> = {
  motion: "motion-story",
  board: "board-story",
  glow: "glow-story",
  kinetic: "kinetic-text",
};

/** قوالب تعمل من التعليق وحده (لا تحتاج حقولًا يكتبها صاحب القناة) فتصلح أسلوبًا لحلقة كاملة. */
const STYLE_TEMPLATES = ["motion-story", "board-story", "glow-story", "kinetic-text", "sketch-board", "sim-stage", "desk-moment", "set-scene", "doc-plate", "map-journey", "timeline", "character-talk"];

/** القالب الافتراضي لأسلوب، أو undefined لـ «templates» (قوالب متنوعة بالعلامات). */
export const styleTemplate = (style?: string): string | undefined => {
  if (!style || style === "templates") return undefined;
  return STYLE_ALIASES[style] ?? (STYLE_TEMPLATES.includes(style) ? style : undefined);
};

export const isStyle = (s: string) => s === "templates" || styleTemplate(s) !== undefined;

/** كل القيم المقبولة في style (للفحص والقوائم). */
export const styleIds = ["templates", ...Object.keys(STYLE_ALIASES), ...STYLE_TEMPLATES.filter((t) => !Object.values(STYLE_ALIASES).includes(t))];

/** الاسم العربي لأسلوب أو قالب، من سجل القوالب نفسه. */
export const styleNameAr = (s: string): string => {
  if (s === "templates") return "قوالب متنوعة";
  const t = styleTemplate(s) ?? s;
  return templateDefs.find((d) => d.id === t)?.nameAr ?? s;
};
