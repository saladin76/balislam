/**
 * فحص النطق (العمل ٩): تطبيع عربي لمقارنة تفريغ الجملة بنصها. القاعدة: ما لا يُسمع لا يُقارن.
 *   - التشكيل والتطويل وعلامات المصحف تُحذف (الحركات لا تُكتب في التفريغ).
 *   - الهمزات: أ إ آ ٱ ← ا، ؤ ← و، ئ ← ي، والهمزة المفردة ء تُحذف (يكتبها التفريغ أو يتركها).
 *   - التاء المربوطة ة ← ه، والألف المقصورة ى ← ي.
 *   - NFKC، والمحارف الخفية واتجاه الكتابة تُحذف، والأرقام الهندية ← 0-9، والترقيم يُحذف.
 */

const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿­؜]/g;
const DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

/** One word (or a whole text) in its comparable form. */
export const normalizeArabic = (s: string): string =>
  s.normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(MARKS, "")
    .replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d] ?? d)
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء/g, "")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The comparable words of a text (empty pieces dropped). */
export const normalizedWords = (s: string): string[] => normalizeArabic(s).split(" ").filter(Boolean);

/** Levenshtein distance over code points. */
export const editDistance = (a: string, b: string): number => {
  const x = [...a], y = [...b];
  if (!x.length) return y.length;
  if (!y.length) return x.length;
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++)
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[y.length]!;
};

const plainSimilarity = (a: string, b: string): number => {
  if (a === b) return 1;
  const n = Math.max([...a].length, [...b].length);
  return n ? 1 - editDistance(a, b) / n : 1;
};
/** The article with its clinging letters (و، ف، ب، ك، ل) — shared by both words, it says nothing about the word itself. */
const ARTICLE = /^[وفبكل]?ال(?=..)/u;

/**
 * 1 = same comparable word, 0 = nothing in common. A shared «ال» is set aside first, so «الصبر» and «الشكر» are
 * compared as «صبر» / «شكر» (different), not as two five-letter words that share three letters.
 */
export const wordSimilarity = (a: string, b: string): number => {
  const full = plainSimilarity(a, b);
  const ca = a.replace(ARTICLE, ""), cb = b.replace(ARTICLE, "");
  if (ca === a || cb === b) return full;
  return Math.min(full, plainSimilarity(ca, cb));
};
