/** لقطات قالب «آلات الجزري» وحقول كل لقطة (بلا React ولا three: يقرؤها مولّد الخطة والاستوديو). D201 */
export type JazariShotId = "drip" | "lever" | "gears" | "machine";
/** كل لقطة تُري الآلة نفسها من زاوية؛ الأحداث (التقطير، الميل، الدوران، ارتفاع اللوح) من حقول «كلمة …» في أي لقطة */
const MACHINE_FIELDS = ["idea", "parts", "dripWord", "tipWord", "turnWord", "riseWord"];
/** caption: ما تحت شريط الترجمة — ورق المخطوطة والجص الفاتح = حبر بهالة فاتحة؛ والواسعة فوق طاولة الخشب الداكنة = نص فاتح بحد داكن */
export const JAZARI_SHOTS: Record<JazariShotId, { nameAr: string; fields: string[]; caption: "ink" | "light" }> = {
  drip: { nameAr: "الحوض والقناة والقطر (تفصيلة)", fields: MACHINE_FIELDS, caption: "ink" },
  lever: { nameAr: "الكفّة والذراع (متوسطة)", fields: MACHINE_FIELDS, caption: "ink" },
  gears: { nameAr: "الترسان والحبل حتى اللوح (قريبة)", fields: MACHINE_FIELDS, caption: "ink" },
  machine: { nameAr: "الآلة كلها أمام المخطوطة (واسعة)", fields: MACHINE_FIELDS, caption: "light" },
};
/** أسماء الأجزاء بالترتيب: الحوض، العوّامة، الكفّة، الدولاب (حتى أربعة، مفصولة بـ |) */
export const JAZARI_PART_SLOTS = ["water", "float", "cup", "gear"] as const;
