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

const AR = "٠١٢٣٤٥٦٧٨٩";
/** The same agreement with Arabic-Indic digits, for the Studio's owner-facing lines («١١٤ مشهدًا؛ ٤ آيات»). */
export const arabicCountAr = (n: number, f: ArabicNounForms): string =>
  arabicCount(n, f).replace(/\d/g, (d) => AR[Number(d)]!);

/**
 * The Studio's one counting formatter for owner-facing text (QA 12 Nov: «٢ أخطاء»، «٢ آية»، «١ مشهد»، «جملة من 27
 * كلمة»): Arabic-Indic digits and the right number–noun agreement. `zero` names the empty case («بلا أخطاء»);
 * without it ٠ reads «٠ <plural>».
 */
export const countAr = (n: number, f: ArabicNounForms, zero?: string): string =>
  n === 0 ? (zero ?? `٠ ${f.few}`) : arabicCountAr(Math.max(0, Math.round(n)), f);

export const SCENES: ArabicNounForms = { one: "مشهد واحد", two: "مشهدان", few: "مشاهد", many: "مشهدًا", hundred: "مشهد" };
export const AYAT: ArabicNounForms = { one: "آية واحدة", two: "آيتان", few: "آيات", many: "آية", hundred: "آية" };
export const EPISODES: ArabicNounForms = { one: "حلقة واحدة", two: "حلقتان", few: "حلقات", many: "حلقة", hundred: "حلقة" };
export const CITATIONS: ArabicNounForms = { one: "استشهاد واحد", two: "استشهادان", few: "استشهادات", many: "استشهادًا", hundred: "استشهاد" };
export const ERRORS: ArabicNounForms = { one: "خطأ واحد", two: "خطآن", few: "أخطاء", many: "خطأً", hundred: "خطأ" };
export const WARNINGS: ArabicNounForms = { one: "تنبيه واحد", two: "تنبيهان", few: "تنبيهات", many: "تنبيهًا", hundred: "تنبيه" };
export const WORDS: ArabicNounForms = { one: "كلمة واحدة", two: "كلمتان", few: "كلمات", many: "كلمة", hundred: "كلمة" };
export const SENTENCES: ArabicNounForms = { one: "جملة واحدة", two: "جملتان", few: "جمل", many: "جملة", hundred: "جملة" };
export const CORRECTIONS: ArabicNounForms = { one: "تصحيح واحد", two: "تصحيحان", few: "تصحيحات", many: "تصحيحًا", hundred: "تصحيح" };
export const NOTES: ArabicNounForms = { one: "ملاحظة واحدة", two: "ملاحظتان", few: "ملاحظات", many: "ملاحظة", hundred: "ملاحظة" };
export const PROBLEMS: ArabicNounForms = { one: "مشكلة واحدة", two: "مشكلتان", few: "مشكلات", many: "مشكلة", hundred: "مشكلة" };
export const DRAFTS: ArabicNounForms = { one: "مسودة واحدة", two: "مسودتان", few: "مسودات", many: "مسودة", hundred: "مسودة" };
export const BOARDS: ArabicNounForms = { one: "لوحة واحدة", two: "لوحتان", few: "لوحات", many: "لوحة", hundred: "لوحة" };
export const CLIPS: ArabicNounForms = { one: "مقطع واحد", two: "مقطعان", few: "مقاطع", many: "مقطعًا", hundred: "مقطع" };
export const SEAMS: ArabicNounForms = { one: "وصلة واحدة", two: "وصلتان", few: "وصلات", many: "وصلة", hundred: "وصلة" };
export const LETTERS: ArabicNounForms = { one: "حرف واحد", two: "حرفان", few: "أحرف", many: "حرفًا", hundred: "حرف" };
export const SECONDS_AR: ArabicNounForms = { one: "ثانية واحدة", two: "ثانيتان", few: "ثوانٍ", many: "ثانية", hundred: "ثانية" };
/** «كل سبت»: the weekly publishing day as the owner reads it. */
export const everyWeekday = (day: string) => `كل ${day.replace(/^(يوم\s+)?(ال)?/, "")}`;
