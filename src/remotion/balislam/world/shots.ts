/** لقطات قالب «الحارة» وحقول كل لقطة (بلا React ولا three: يقرؤها مولّد الخطة والاستوديو). D200 */
export type AlleyShotId = "market" | "two-figures" | "lanterns" | "alley-wide";
/** caption: ما تحت شريط الترجمة في اللقطة — الأرض الفاتحة (حبر) أو الجدار الأخضر (نص فاتح) */
export const ALLEY_SHOTS: Record<AlleyShotId, { nameAr: string; fields: string[]; caption: "ink" | "light" }> = {
  market: { nameAr: "السوق: الدكاكين تنزل وتستقر", fields: ["stallWord"], caption: "ink" },
  "two-figures": { nameAr: "الشخصيتان: دخول، ثم «يقول»، ثم «معي»", fields: ["setting", "figures", "enterWord", "speakWord", "selfWord"], caption: "ink" },
  lanterns: { nameAr: "الفوانيس تُضاء واحدًا واحدًا", fields: ["setting", "lightWord"], caption: "light" },
  "alley-wide": { nameAr: "الحارة كلها (ختام)", fields: ["setting"], caption: "light" },
};
