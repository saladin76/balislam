/**
 * عدّة الثري دي — سجل الخامات والصور الأرشيفية. القاعدة (ملف التسليم ٢٢ نوفمبر): للاستعمال التجاري CC0 فقط،
 * من مصادر مسمّاة (المتروبوليتان، ووالترز، وكليفلاند، وSmithsonian، وPoly Haven للخامات)، ولكل ملف مصدره ورابطه
 * وتاريخ مراجعة رخصته. السجل يرفض غير ذلك، فلا يدخل الرندر ملف بلا رخصة مراجعة.
 * يُضاف إليه مع نموذج عالم كل قناة؛ والملف نفسه لا يُستعمل في قناة غير قناته.
 */
export const CC0_SOURCES = {
  met: "metmuseum.org",
  walters: "art.thewalters.org",
  cleveland: "clevelandart.org",
  smithsonian: "si.edu",
  polyhaven: "polyhaven.com",
} as const;
export type Cc0Source = keyof typeof CC0_SOURCES;

export type Asset = {
  id: string;
  /** المسار تحت public/ (يُقرأ بـ staticFile) */
  file: string;
  kind: "texture" | "archive-image" | "hdri";
  source: Cc0Source;
  /** صفحة الأصل نفسها في المكتبة (لا رابط بحث) */
  url: string;
  license: "CC0";
  /** تاريخ مراجعة الرخصة على صفحة الأصل YYYY-MM-DD */
  checked: string;
  /** القناة التي يخصها (لا تتسرب خامة قناة إلى أخرى) */
  channel: "balislam" | "dafatir-alzaman" | "zubdat-alkutub";
};

/** أسباب رفض أصل؛ فارغة = مقبول */
export const assetProblems = (a: Asset): string[] => {
  const p: string[] = [];
  if (a.license !== "CC0") p.push(`${a.id}: الرخصة ليست CC0`);
  const host = CC0_SOURCES[a.source];
  let u: URL | null = null;
  try { u = new URL(a.url); } catch { /* يُرفض أدناه */ }
  if (!host || !u || u.protocol !== "https:" || !(u.hostname === host || u.hostname.endsWith(`.${host}`))) p.push(`${a.id}: الرابط ليس صفحة في ${host ?? "مصدر مسمّى"}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.checked)) p.push(`${a.id}: لا تاريخ لمراجعة الرخصة`);
  if (!/^three\/[a-z0-9-]+\/[a-z0-9._-]+$/.test(a.file)) p.push(`${a.id}: الملف خارج public/three/<القناة>/`);
  else if (!a.file.startsWith(`three/${a.channel}/`)) p.push(`${a.id}: ملف قناة أخرى`);
  return p;
};

/** السجل: يُضاف إليه مع نموذج كل عالم (tests/three-kit.test.ts يفحص كل مدخل) */
export const ASSETS: readonly Asset[] = [
  // Poly Haven (CC0، راجعت الرخصة على polyhaven.com/license وصفحة كل أصل ٢٢ نوفمبر)، دقة 1k
  { id: "dafatir-walnut-diff", file: "three/dafatir-alzaman/walnut-diff.jpg", kind: "texture", source: "polyhaven", url: "https://polyhaven.com/a/american_walnut_veneer", license: "CC0", checked: "2026-11-22", channel: "dafatir-alzaman" },
  { id: "dafatir-walnut-nor", file: "three/dafatir-alzaman/walnut-nor.jpg", kind: "texture", source: "polyhaven", url: "https://polyhaven.com/a/american_walnut_veneer", license: "CC0", checked: "2026-11-22", channel: "dafatir-alzaman" },
  { id: "dafatir-walnut-rough", file: "three/dafatir-alzaman/walnut-rough.jpg", kind: "texture", source: "polyhaven", url: "https://polyhaven.com/a/american_walnut_veneer", license: "CC0", checked: "2026-11-22", channel: "dafatir-alzaman" },
  { id: "dafatir-leather-diff", file: "three/dafatir-alzaman/leather-diff.jpg", kind: "texture", source: "polyhaven", url: "https://polyhaven.com/a/brown_leather", license: "CC0", checked: "2026-11-22", channel: "dafatir-alzaman" },
  { id: "dafatir-leather-nor", file: "three/dafatir-alzaman/leather-nor.jpg", kind: "texture", source: "polyhaven", url: "https://polyhaven.com/a/brown_leather", license: "CC0", checked: "2026-11-22", channel: "dafatir-alzaman" },
  { id: "balislam-cotton-diff", file: "three/balislam/cotton-diff.jpg", kind: "texture", source: "polyhaven", url: "https://polyhaven.com/a/cotton_jersey", license: "CC0", checked: "2026-11-22", channel: "balislam" },
  { id: "balislam-cotton-nor", file: "three/balislam/cotton-nor.jpg", kind: "texture", source: "polyhaven", url: "https://polyhaven.com/a/cotton_jersey", license: "CC0", checked: "2026-11-22", channel: "balislam" },
  { id: "balislam-plaster-diff", file: "three/balislam/plaster-diff.jpg", kind: "texture", source: "polyhaven", url: "https://polyhaven.com/a/beige_wall_001", license: "CC0", checked: "2026-11-22", channel: "balislam" },
  { id: "balislam-plaster-nor", file: "three/balislam/plaster-nor.jpg", kind: "texture", source: "polyhaven", url: "https://polyhaven.com/a/beige_wall_001", license: "CC0", checked: "2026-11-22", channel: "balislam" },
  { id: "balislam-wood-diff", file: "three/balislam/wood-diff.jpg", kind: "texture", source: "polyhaven", url: "https://polyhaven.com/a/wood_table_001", license: "CC0", checked: "2026-11-22", channel: "balislam" },
  { id: "balislam-wood-nor", file: "three/balislam/wood-nor.jpg", kind: "texture", source: "polyhaven", url: "https://polyhaven.com/a/wood_table_001", license: "CC0", checked: "2026-11-22", channel: "balislam" },
  { id: "zubdat-plaster-diff", file: "three/zubdat-alkutub/plaster-diff.jpg", kind: "texture", source: "polyhaven", url: "https://polyhaven.com/a/white_plaster_02", license: "CC0", checked: "2026-11-22", channel: "zubdat-alkutub" },
  { id: "zubdat-plaster-nor", file: "three/zubdat-alkutub/plaster-nor.jpg", kind: "texture", source: "polyhaven", url: "https://polyhaven.com/a/white_plaster_02", license: "CC0", checked: "2026-11-22", channel: "zubdat-alkutub" },
  { id: "zubdat-wood-diff", file: "three/zubdat-alkutub/wood-diff.jpg", kind: "texture", source: "polyhaven", url: "https://polyhaven.com/a/dark_wood", license: "CC0", checked: "2026-11-22", channel: "zubdat-alkutub" },
  { id: "zubdat-wood-nor", file: "three/zubdat-alkutub/wood-nor.jpg", kind: "texture", source: "polyhaven", url: "https://polyhaven.com/a/dark_wood", license: "CC0", checked: "2026-11-22", channel: "zubdat-alkutub" },
];

/** مسار الأصل لـ staticFile بمعرّفه (يرفض أصلًا غير مسجل) */
export const assetFile = (id: string) => { const a = ASSETS.find((x) => x.id === id); if (!a) throw Error(`أصل غير مسجل: ${id}`); return a.file; };

export const assetsFor = (channel: Asset["channel"]) => ASSETS.filter((a) => a.channel === channel);
