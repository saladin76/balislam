/**
 * التشكيل للنطق فقط: صاحب القناة يضع نسخة مشكولة من السكريبت في مجلد الحلقة (tashkeel.md).
 * عند توليد الصوت تُستبدل كل كلمة في التعليق بنظيرتها المشكولة، والترجمة على الشاشة تبقى بلا تشكيل.
 * المطابقة كلمة بكلمة بعد حذف التشكيل، فلا يلزم أن يطابق الملف السكريبت سطرًا بسطر
 * (الآيات والعناوين فيه تُتجاوز تلقائيًا، والكلمة التي لا نظير لها تُرسل كما هي).
 */

/** حركات التشكيل والتطويل وعلامات المصحف. */
const MARKS = /[ـً-ٰٟۖ-ۭ]/g;

export const stripTashkeel = (s: string) => s.replace(MARKS, "");

/** صورة الكلمة للمقارنة: بلا تشكيل ولا ترقيم، وبتوحيد صور الهمزة والألف. */
export const normWord = (w: string) =>
  stripTashkeel(w)
    .replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[ؤئ]/g, "ء");

export type TashkeelIndex = { plain: string[]; voweled: string[] };

export const buildTashkeelIndex = (text: string): TashkeelIndex => {
  const voweled = text.split(/\s+/).filter(Boolean);
  return { plain: voweled.map(normWord), voweled };
};

/** حذف علامات الترقيم من طرفي الكلمة المشكولة، وأخذ ترقيم الكلمة الأصلية بدلها. */
const withPunctOf = (orig: string, voweledWord: string) => {
  const core = voweledWord.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "");
  const lead = orig.match(/^[\p{P}\p{S}]+/u)?.[0] ?? "";
  const trail = orig.match(/[\p{P}\p{S}]+$/u)?.[0] ?? "";
  return core ? `${lead}${core}${trail}` : orig;
};

/**
 * لكل كلمة من الكلمات الأصلية: نظيرتها المشكولة، أو undefined إن لم توجد.
 * يبحث عن موضع بداية تتطابق عنده أول كلمات الجملة، ثم يمشي للأمام بنافذة صغيرة يتحمل فيها فروقًا بسيطة.
 */
export const vowelize = (words: string[], idx: TashkeelIndex | null): (string | undefined)[] => {
  if (!idx || !words.length) return words.map(() => undefined);
  const target = words.map(normWord);
  const n = idx.plain.length;
  // أفضل موضع بداية: أطول تطابق متتالٍ (حتى 6 كلمات) مع بداية الجملة
  let best = -1;
  let bestLen = 0;
  const anchor = target.findIndex((w) => w.length > 0);
  if (anchor < 0) return words.map(() => undefined);
  for (let p = 0; p < n; p++) {
    if (idx.plain[p] !== target[anchor]) continue;
    let k = 0;
    while (k < 6 && anchor + k < target.length && p + k < n && idx.plain[p + k] === target[anchor + k]) k++;
    if (k > bestLen) {
      bestLen = k;
      best = p - anchor;
    }
    if (k === 6) break;
  }
  if (best < 0 && bestLen === 0) return words.map(() => undefined);
  const out: (string | undefined)[] = [];
  let p = Math.max(0, best);
  for (let i = 0; i < words.length; i++) {
    const t = target[i]!;
    let found = -1;
    for (let q = p; q < Math.min(n, p + 8); q++)
      if (idx.plain[q] === t) {
        found = q;
        break;
      }
    if (found >= 0 && t) {
      out.push(withPunctOf(words[i]!, idx.voweled[found]!));
      p = found + 1;
    } else out.push(undefined);
  }
  return out;
};
