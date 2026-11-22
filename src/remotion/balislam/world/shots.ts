/** لقطات قالب «الحارة» وحقول كل لقطة (بلا React ولا three: يقرؤها مولّد الخطة والاستوديو). D200 */
export type AlleyShotId = "market" | "two-figures" | "lanterns" | "alley-wide";
export const ALLEY_SHOTS: Record<AlleyShotId, { nameAr: string; fields: string[] }> = {
  market: { nameAr: "السوق: الدكاكين تنزل وتستقر", fields: ["stallWord"] },
  "two-figures": { nameAr: "الشخصيتان: دخول، ثم «يقول»، ثم «معي»", fields: ["setting", "figures", "enterWord", "speakWord", "selfWord"] },
  lanterns: { nameAr: "الفوانيس تُضاء واحدًا واحدًا", fields: ["setting", "lightWord"] },
  "alley-wide": { nameAr: "الحارة كلها (ختام)", fields: ["setting"] },
};
