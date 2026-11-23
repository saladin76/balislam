/** لقطات قالب «آلات الجزري» وحقول كل لقطة (بلا React ولا three: يقرؤها مولّد الخطة والاستوديو). D201 */
export type JazariShotId = "drip" | "lever" | "gears" | "machine";
/** كل لقطة تُري الآلة نفسها من زاوية؛ الأحداث (التقطير، الميل، الدوران، ارتفاع اللوح) من حقول «كلمة …» في أي لقطة */
const MACHINE_FIELDS = ["idea", "parts", "dripWord", "tipWord", "turnWord", "riseWord"];
/** لون الترجمة لا يُعلن لكل لقطة: يتكيف مع ما خلفه بكسلًا بكسلًا (CAPTION_ADAPTIVE في JazariMachine.tsx)، لأن السطر يقع على الورق والخشب معًا */
export const JAZARI_SHOTS: Record<JazariShotId, { nameAr: string; fields: string[] }> = {
  drip: { nameAr: "الحوض والقناة والقطر (تفصيلة)", fields: MACHINE_FIELDS },
  lever: { nameAr: "الكفّة والذراع (متوسطة)", fields: MACHINE_FIELDS },
  gears: { nameAr: "الترسان والحبل حتى اللوح (قريبة)", fields: MACHINE_FIELDS },
  machine: { nameAr: "الآلة كلها أمام المخطوطة (واسعة)", fields: MACHINE_FIELDS },
};
/** أسماء الأجزاء بالترتيب: الحوض، العوّامة، الكفّة، الدولاب (حتى أربعة، مفصولة بـ |) */
export const JAZARI_PART_SLOTS = ["water", "float", "cup", "gear"] as const;
