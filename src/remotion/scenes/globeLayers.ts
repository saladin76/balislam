/**
 * طبقات التاريخ على الكرة: حدود، ومدن، وطرق. كل طبقة تحمل مصدرها وترخيصه («كما حدثت»)، وكل حد فيه خلاف
 * بين المؤرخين يُعلَّم تقريبيًا ويُقال ذلك على الشاشة. لا حد تاريخي بلا مصدر: assertSourced يرفضه قبل الرندر.
 */
import { morphRing, type LonLat } from "./globeSphere";

export type Source = {
  /** ما يظهر على الشاشة: «الطبري · تاريخ الرسل والملوك» */
  label: string;
  /** ترخيص البيانات (للحدود والخطوط): «ملكية عامة (Natural Earth)»… لا يظهر على الشاشة */
  license: string;
  /** حد تقريبي (خلاف المؤرخين أو تقدير): يُكتب «تقريبي» بجواره */
  approximate: boolean;
  /** نموذج تقني بلا مصدر تاريخي: يُرسم في المختبر فقط ويرفضه الإنتاج */
  prototypeOnly?: boolean;
};

/** حد في سنة بعينها */
export type BorderState = { year: number; ring: LonLat[] };
export type BorderLayer = { id: string; label: string; states: BorderState[]; source: Source };

export type CityLayer = { id: string; name: string; at: LonLat; /** سنة الظهور */ from: number; source?: Source };

export const sourceProblems = (layers: { id: string; source?: Source }[], mode: "lab" | "production"): string[] =>
  layers.flatMap((l) => {
    const s = l.source;
    if (!s) return [`${l.id}: بلا مصدر`];
    const out: string[] = [];
    if (!s.label.trim()) out.push(`${l.id}: المصدر بلا اسم يظهر على الشاشة`);
    if (!s.license.trim()) out.push(`${l.id}: بلا ترخيص بيانات`);
    if (mode === "production" && s.prototypeOnly) out.push(`${l.id}: حد نموذجي للمختبر لا يدخل الإنتاج`);
    return out;
  });

export const assertSourced = (layers: BorderLayer[], mode: "lab" | "production") => {
  const p = sourceProblems(layers, mode);
  if (p.length) throw new Error(`حدود بلا مصدر صالح: ${p.join("، ")}`);
};

/** الحد عند سنة year: استيفاء بين أقرب حالتين، وقبل أول حالة وبعد آخرها يثبت (متصل عند كل سنة بينية) */
export const borderAt = (layer: BorderLayer, year: number): LonLat[] => {
  const s = [...layer.states].sort((a, b) => a.year - b.year);
  if (!s.length) return [];
  if (s.length === 1 || year <= s[0]!.year) return morphRing(s[0]!.ring, s[0]!.ring, 0);
  for (let i = 1; i < s.length; i++)
    if (year <= s[i]!.year) return morphRing(s[i - 1]!.ring, s[i]!.ring, (year - s[i - 1]!.year) / (s[i]!.year - s[i - 1]!.year));
  return morphRing(s[s.length - 1]!.ring, s[s.length - 1]!.ring, 0);
};
