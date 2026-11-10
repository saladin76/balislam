/**
 * Pronunciation precedence, pure (no disk, no network; shared by the server and the Studio page) — D66, owner
 * report 10 Nov: «أَوَّلَ مَرَّةٍ أُصَلِّي» was sent as «أَوَّلُ» although the owner wrote the fatha.
 *
 * What is sent for one written word, in this order:
 *   (a) the word as the owner wrote it is the base;
 *   (b) an explicit per-word correction typed for THIS sentence wins over everything;
 *   (c) then the channel lexicon: an entry for the exact written form first; an entry saved as letter-insensitive
 *       («match: letters») only when the written word carries no tashkeel of its own that contradicts it;
 *   (d) then the legacy dictionary / the episode's voweled copy (tashkeel.md) — which only FILLS marks the owner did
 *       not write: a voweled form whose marks contradict the written ones is ignored (the written form is sent).
 * Never is a form the owner wrote with explicit tashkeel replaced by a different tashkeel, except by (b) or by an
 * exact-form lexicon entry (which is itself the owner's explicit «when I write X, say Y»).
 */

/** Tashkeel marks (same range as tashkeel.ts, tatweel included). */
const MARK = /[ـً-ٰٟۖ-ۭ]/u;
const MARKS = /[ـً-ٰٟۖ-ۭ]/gu;
const SHADDA = "ّ";
const FATHA = "َ", DAMMA = "ُ", KASRA = "ِ", SUKUN = "ْ";
const TRIM = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;

export const coreWord = (w: string) => w.replace(TRIM, "");
export const hasMarks = (w: string) => MARK.test(w);
export const bareLetters = (w: string) => coreWord(w).replace(MARKS, "");
/** Letters for comparison: no tashkeel, no punctuation, one shape of hamza/alef and yaa (as normWord in tashkeel.ts). */
export const looseLetters = (w: string) =>
  bareLetters(w).replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/[ؤئ]/g, "ء");

type Unit = { base: string; marks: string[] };
/** The word as letters, each with the marks written on it (tatweel dropped). */
export const units = (w: string): Unit[] => {
  const out: Unit[] = [];
  for (const ch of coreWord(w)) {
    if (ch === "ـ") continue;
    if (MARK.test(ch)) { if (out.length) out[out.length - 1]!.marks.push(ch); continue; }
    out.push({ base: ch, marks: [] });
  }
  return out;
};
/** Letters and their marks back to text, each mark in the order it was written. */
const join = (us: Unit[]) => us.map((u) => u.base + u.marks.join("")).join("");

/**
 * Can the voweled form stand for what the owner wrote? Yes when the written word has no marks, or when it has the
 * same letters and every mark the owner wrote on a letter is also on that letter in the voweled form (the voweled
 * form only ADDS marks). «أَوَّلَ» written, «أَوَّلُ» in tashkeel.md → false (the fatha would be lost).
 */
export const marksCompatible = (written: string, voweled: string): boolean => {
  if (!hasMarks(coreWord(written))) return true;
  const a = units(written), b = units(voweled);
  if (a.length !== b.length || a.some((u, i) => u.base !== b[i]!.base)) return false;
  return a.every((u, i) => u.marks.every((m) => b[i]!.marks.includes(m)));
};

/** The sent form for a written word from the voweled copy: the voweled form only when it does not contradict. */
export const fillFromVoweled = (written: string, voweled: string | undefined): string =>
  voweled && marksCompatible(written, voweled) ? voweled : written;

/** A pronunciation that changes nothing (the entry or correction says the word as it is written). */
export const isNoopSay = (word: string, say: string) => coreWord(word.trim()) === coreWord(say.trim().replace(/\s+/g, " "));

/** The pronunciation drops a shadda the written word has («مَرَّةٍ» → «مرةٍ»): almost always a mistake. */
export const dropsShadda = (word: string, say: string) => {
  const n = (s: string) => [...s].filter((c) => c === SHADDA).length;
  return n(coreWord(word)) > n(coreWord(say));
};

export type LexiconMatch = "exact" | "letters";
export type LexEntryLite = { word: string; say: string; match?: LexiconMatch };

/**
 * The lexicon's pronunciation for one written word, or undefined: the exact written form first; then an entry
 * saved letter-insensitive whose letters match, only if the owner's own marks do not contradict its pronunciation.
 */
export const lexiconSay = (written: string, entries: LexEntryLite[]): { say: string; entry: LexEntryLite } | undefined => {
  const core = coreWord(written);
  const exact = entries.find((e) => (e.match ?? "exact") === "exact" && e.word === core);
  if (exact) return { say: exact.say, entry: exact };
  const loose = looseLetters(core);
  const byLetters = entries.find((e) => e.match === "letters" && looseLetters(e.word) === loose);
  if (byLetters && (!hasMarks(core) || marksCompatible(core, byLetters.say))) return { say: byLetters.say, entry: byLetters };
  return undefined;
};

export type LexiconEffect = {
  word: string; say: string; match: LexiconMatch;
  /** Words of the episode this entry changes now (written forms, distinct, at most 6). */
  applies: string[];
  /** Words with the same letters it does NOT change (another tashkeel written), distinct, at most 6. */
  skipped: string[];
  warnings: string[];
};
/** What each lexicon entry does to the words of an episode, for the list in «قاموس النطق». */
export const lexiconEffects = (entries: LexEntryLite[], words: string[]): LexiconEffect[] => {
  const cores = [...new Set(words.map(coreWord).filter(Boolean))];
  return entries.map((e) => {
    const match = e.match ?? "exact";
    const loose = looseLetters(e.word);
    const same = cores.filter((w) => looseLetters(w) === loose);
    const applies = same.filter((w) => lexiconSay(w, [e])?.entry === e);
    const skipped = same.filter((w) => !applies.includes(w));
    const warnings: string[] = [];
    if (isNoopSay(e.word, e.say)) warnings.push("النطق مثل الكلمة تمامًا: لا يغيّر شيئًا.");
    if (dropsShadda(e.word, e.say)) warnings.push("النطق يحذف الشدّة التي في الكلمة.");
    if (!applies.length && skipped.length)
      warnings.push(`لا يطابق أي كلمة مكتوبة بهذا التشكيل في الحلقة؛ المكتوب: ${skipped.slice(0, 3).map((w) => `«${w}»`).join("، ")}.`);
    return { word: e.word, say: e.say, match, applies: applies.slice(0, 6), skipped: skipped.slice(0, 6), warnings };
  });
};

/**
 * «جرّب صيغة أخرى» (the model may still ignore a short vowel): up to 3 phonetic spellings of the word, each a
 * one-click fill of the field. (1) the final short vowel lengthened (أَوَّلَ → أَوَّلَا)، (2) a doubled letter written
 * twice (أَوَّلَ → أَوْوَلَ)، (3) only the marks that carry the sound — the doubled letters and the last one (أوَّلَ).
 */
export const phoneticVariants = (word: string): string[] => {
  const us = units(word);
  if (!us.length || !hasMarks(coreWord(word))) return [];
  const out: string[] = [];
  const last = us[us.length - 1]!;
  const long: Record<string, string> = { [FATHA]: "ا", [KASRA]: "ي", [DAMMA]: "و" };
  const vowel = last.marks.find((m) => long[m]);
  if (vowel) out.push(join(us) + long[vowel]);
  if (us.some((u) => u.marks.includes(SHADDA))) {
    const split: Unit[] = [];
    us.forEach((u) => {
      if (!u.marks.includes(SHADDA)) { split.push({ base: u.base, marks: [...u.marks] }); return; }
      split.push({ base: u.base, marks: [SUKUN] });
      split.push({ base: u.base, marks: u.marks.filter((m) => m !== SHADDA) });
    });
    out.push(join(split));
  }
  const minimal = us.map((u, i) => ({ base: u.base, marks: i === us.length - 1 || u.marks.includes(SHADDA) ? [...u.marks] : [] }));
  const m = join(minimal);
  if (hasMarks(m)) out.push(m);
  const self = join(us);
  return [...new Set(out)].filter((v) => v !== self && v !== coreWord(word)).slice(0, 3);
};
