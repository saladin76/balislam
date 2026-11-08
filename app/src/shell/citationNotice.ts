/**
 * Audit item 12: the script decision line says how many citations are still unverified. The citation
 * ledger (review.json) never blocks the script approval or the voice (owner decision, 4 Nov); this only
 * makes the count visible at the moment of the decision.
 */
const arNum = (n: number) => n.toLocaleString("ar-EG");

export const citationNotice = (items: { kind: string; status: string }[]): string => {
  const open = items.filter((i) => i.status !== "verified");
  if (!items.length || !open.length) return "";
  const ayat = open.filter((i) => i.kind === "ayah").length;
  return `استشهادات غير موثّقة: ${arNum(open.length)} من ${arNum(items.length)}${ayat ? ` (منها ${arNum(ayat)} ${ayat === 1 ? "آية" : "آيات"})` : ""}. لا تمنع الاعتماد؛ وثّقها في «سجل التوثيق» (أدوات وتفاصيل بجوار السكريبت).`;
};
