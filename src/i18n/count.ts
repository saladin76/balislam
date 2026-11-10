/**
 * Arabic counting (number–noun agreement) for owner-facing messages (QA, 10 Nov 2026: «و3 ملفًا آخر» was wrong).
 *   1 → «ملف واحد» / the `one` form          2 → the dual («ملفان»)
 *   3–10 → number + plural («3 ملفات»)       11–99 → number + accusative singular («11 ملفًا»)
 *   100, 101, 102, 200… (last two digits 0–2) → number + genitive singular («100 ملف»)
 * The last two digits decide for n > 100 («103 ملفات»، «111 ملفًا»).
 */
export type ArabicNounForms = { one: string; two: string; few: string; many: string; hundred: string };

export const arabicCount = (n: number, f: ArabicNounForms): string => {
  if (!Number.isInteger(n) || n < 0) throw new Error("arabicCount: a non-negative integer is required.");
  if (n === 1) return f.one;
  if (n === 2) return f.two;
  const r = n % 100;
  if (n > 2 && r >= 3 && r <= 10) return `${n} ${f.few}`;
  if (r >= 11 && r <= 99) return `${n} ${f.many}`;
  return `${n} ${f.hundred}`;
};

export const FILES: ArabicNounForms = { one: "ملف واحد", two: "ملفان", few: "ملفات", many: "ملفًا", hundred: "ملف" };
/** «… و<N> <ملفات> أخرى» */
export const OTHER_FILES: ArabicNounForms = { one: "ملف آخر", two: "ملفان آخران", few: "ملفات أخرى", many: "ملفًا آخر", hundred: "ملف آخر" };
