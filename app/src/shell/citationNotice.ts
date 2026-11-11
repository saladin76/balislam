/**
 * Audit item 12: the decision lines say how many citations are still unverified. The citation ledger
 * (review.json) is documentation only and never blocks anything — not the script approval, the voice, the
 * Master, the publish permission or the Drive handoff (CLAUDE.md rule 5; owner decisions 4 and 10 Nov).
 * This only makes the count visible in step ١ and step ٣.
 */
import { AYAT, CITATIONS, arabicCountAr } from "../../../src/i18n/count";

const arNum = (n: number) => n.toLocaleString("ar-EG");

export const citationNotice = (items: { kind: string; status: string }[]): string => {
  const open = items.filter((i) => i.status !== "verified");
  if (!items.length || !open.length) return "";
  const ayat = open.filter((i) => i.kind === "ayah").length;
  return `استشهادات غير موثّقة: ${arNum(open.length)} من ${arNum(items.length)}${ayat ? ` (منها ${arabicCountAr(ayat, AYAT)})` : ""}. للتوثيق فقط ولا تمنع شيئًا (لا الاعتماد ولا النسخة النهائية ولا النشر)؛ وثّقها في «سجل التوثيق» (أدوات وتفاصيل بجوار السكريبت).`;
};
/** Step ٣: the same count, one short line (information only). */
export const citationLine = (items: { kind: string; status: string }[]): string => {
  const open = items.filter((i) => i.status !== "verified").length;
  if (!items.length) return "";
  if (!open) return `الاستشهادات موثّقة كلها (${arabicCountAr(items.length, CITATIONS)}).`;
  return `التوثيق: ${arNum(items.length - open)} من ${arNum(items.length)} موثّق — للعلم فقط، لا يمنع النسخة النهائية ولا النشر.`;
};
/** D73: the dock's chip — the count only («غير موثّق: ٥ من ١٦»); the full notice is its tooltip and its card. */
export const citationChip = (items: { kind: string; status: string }[]): string => {
  const open = items.filter((i) => i.status !== "verified").length;
  return items.length && open ? `غير موثّق: ${arNum(open)} من ${arNum(items.length)}` : "";
};
