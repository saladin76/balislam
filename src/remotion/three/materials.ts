/**
 * عدّة الثري دي — سجل الخامات والصور الأرشيفية. القاعدة (ملف التسليم ٢٢ نوفمبر): للاستعمال التجاري CC0 فقط،
 * من مصادر مسمّاة (المتروبوليتان، ووالترز، وكليفلاند، وSmithsonian، وPoly Haven للخامات)، ولكل ملف مصدره ورابطه
 * وتاريخ مراجعة رخصته. السجل يرفض غير ذلك، فلا يدخل الرندر ملف بلا رخصة مراجعة.
 * السجل فارغ عمدًا: اختيار الخامات جزء من «عالم» كل قناة، ويُضاف مع نموذجه بعد اختيار المالك اتجاهه.
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
export const ASSETS: readonly Asset[] = [];

export const assetsFor = (channel: Asset["channel"]) => ASSETS.filter((a) => a.channel === channel);
