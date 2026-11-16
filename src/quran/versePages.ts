/**
 * الآية على الشاشة (طلب المالك ١٥ نوفمبر «لما يذكر ايه خليها تظهر على الشاشة»):
 * تقسيم نص الآية الطويل إلى صفحات تُعرض واحدة بعد الأخرى بدل تصغير الخط حتى يضيع أو يخرج من الإطار.
 *
 * - النص هو نص السكريبت كما كتبه المالك حرفًا (مع تشكيله وعلاماته)؛ لا يُضاف ولا يُحذف ولا يُصحَّح شيء:
 *   ضمّ الصفحات بمسافة يعيد كلمات الآية نفسها بترتيبها (`versePages(t).join(" ")` = كلمات t).
 * - القطع بين كلمتين دائمًا، لا داخل كلمة: عند فاصل الآيات ۝ أولًا، ثم علامات الوقف (ۖ–ۜ)، ثم الكلمات.
 * - لا يُقسَّم ما يتسع لصفحة واحدة: الآيات القصيرة تبقى كما كانت تمامًا.
 * - التوقيت: كل صفحة بنصيبها من الحروف على مدى التلاوة إن وُجدت (أو مدة المشهد)، فتتقدم مع القراءة.
 *   لا توجد توقيتات كلمات للتلاوة البشرية، فالحروف أقرب مقياس لزمن نطقها.
 */

/** الحروف دون التشكيل وعلامات الوقف والمسافات (الرسم العثماني كثير العلامات) */
export const verseLetters = (text: string) => text.replace(/[ً-ٰٟۖ-ۭ\s]/g, "").length;

/** فاصل الآيات في نص المالك (۝) */
const AYAH_END = /۝/;
/** علامات الوقف في الرسم العثماني */
const WAQF = /[ۖ-ۜ]/;

/**
 * أكبر عدد حروف تتسع له صفحة واحدة بخط مقروء (لا يصغر الخط تحت 0.6 من حجمه): room ÷ 0.36.
 * room هو عدد الحروف بالحجم الكامل في كل قالب (90/80 في البطاقة الكلاسيكية وصفحة الدفتر، 95/80 في الحبر).
 */
export const pageLetterBudget = (room: number, minFit = 0.6) => Math.floor(room / (minFit * minFit));

/** يقسم الكلمات إلى مقاطع عند فاصل الآيات ثم الوقف: الكلمة الحاملة للعلامة تختم مقطعها. */
const segments = (words: string[], mark: RegExp): string[][] => {
  const out: string[][] = [[]];
  for (const w of words) {
    out[out.length - 1]!.push(w);
    if (mark.test(w)) out.push([]);
  }
  return out.filter((s) => s.length);
};

/** يملأ صفحات بالمقاطع بالترتيب حتى الحد، ويقسم المقطع الأطول من الحد بالكلمات بالتساوي. */
const fill = (parts: string[][], budget: number, split: (p: string[]) => string[][]): string[][] => {
  const pages: string[][] = [];
  let cur: string[] = [];
  const size = (ws: string[]) => verseLetters(ws.join(" "));
  for (const p of parts) {
    if (size(p) > budget) {
      if (cur.length) pages.push(cur), (cur = []);
      for (const q of split(p)) pages.push(q);
      continue;
    }
    if (cur.length && size([...cur, ...p]) > budget) pages.push(cur), (cur = []);
    cur = [...cur, ...p];
  }
  if (cur.length) pages.push(cur);
  return pages;
};

const byWords = (budget: number) => (p: string[]): string[][] => {
  const total = verseLetters(p.join(" "));
  const n = Math.max(1, Math.ceil(total / budget));
  const target = total / n;
  const out: string[][] = [];
  let cur: string[] = [];
  for (const w of p) {
    if (cur.length && out.length < n - 1 && verseLetters([...cur, w].join(" ")) > target + verseLetters(w) / 2) out.push(cur), (cur = []);
    cur.push(w);
  }
  if (cur.length) out.push(cur);
  return out;
};

/**
 * صفحات الآية: صفحة واحدة (النص كما هو) إن اتسع لها، وإلا صفحات متتالية لا تتجاوز كل منها الحد
 * إلا كلمةً واحدة أطول منه (لا تُقطع كلمة أبدًا).
 */
export const versePages = (text: string, budget: number): string[] => {
  const trimmed = text.trim();
  if (!trimmed || verseLetters(trimmed) <= budget) return [trimmed];
  const words = trimmed.split(/\s+/).filter(Boolean);
  const pages = fill(segments(words, AYAH_END), budget, (ayah) => fill(segments(ayah, WAQF), budget, byWords(budget)));
  return pages.map((p) => p.join(" "));
};

export type PageWindow = { text: string; from: number; to: number };

/**
 * نافذة كل صفحة بالإطارات على مدى span (التلاوة أو المشهد) بدءًا من start، بنصيبها من الحروف.
 * الصفحة الأخيرة تبقى حتى نهاية المشهد (to = Infinity) فلا تختفي الآية قبل آخره.
 */
export const pageWindows = (pages: string[], start: number, span: number): PageWindow[] => {
  const sizes = pages.map((p) => Math.max(1, verseLetters(p)));
  const total = sizes.reduce((a, b) => a + b, 0);
  let at = start;
  return pages.map((text, i) => {
    const from = at;
    at += (span * sizes[i]!) / total;
    return { text, from: i === 0 ? -Infinity : from, to: i === pages.length - 1 ? Infinity : at };
  });
};

/** ظهور صفحة في الإطار frame: خفوت هادئ عند الحدود (fadeFrames)، وصفحة واحدة ظاهرة كاملة في غير لحظة التبدّل. */
export const pageOpacity = (w: PageWindow, frame: number, fadeFrames = 8): number => {
  const half = fadeFrames / 2;
  const inO = w.from === -Infinity ? 1 : Math.min(1, Math.max(0, (frame - w.from + half) / fadeFrames));
  const outO = w.to === Infinity ? 1 : Math.min(1, Math.max(0, (w.to + half - frame) / fadeFrames));
  // التبدّل خفوت ثم ظهور (لا تراكب نصين): الخروج يكتمل قبل منتصف الحد والدخول يبدأ بعده
  return Math.min(inO < 1 ? Math.max(0, 2 * inO - 1) : 1, outO < 1 ? Math.max(0, 2 * outO - 1) : 1);
};
