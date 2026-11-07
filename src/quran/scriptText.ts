/**
 * Script-first Quran source. Verse bytes are authored by the owner in script.md,
 * never inferred from recitation, fetched into quran.json, or silently corrected.
 * [آية: النجم 39 | وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ]
 */
import { parseAyahRef } from "../script/quranMeta";
import type { ParsedScript } from "../script/types";

export type ScriptAyah = { key: string; ref: string; text: string; line: number };
export type ScriptQuranProblem = { key: string; ref: string; line: number; code: "invalid-ref" | "missing-text" | "conflicting-text"; reason: string };

export const quranFromScript = (script: ParsedScript): {
  texts: Record<string, string>; ayahs: ScriptAyah[]; problems: ScriptQuranProblem[];
} => {
  const texts: Record<string, string> = {};
  const ayahs: ScriptAyah[] = [];
  const problems: ScriptQuranProblem[] = [];
  for (const chapter of script.chapters) for (const block of chapter.blocks) {
    if (block.kind !== "ayah") continue;
    const parsed = parseAyahRef(block.ref);
    if (!parsed.ok) {
      problems.push({ key: block.ref, ref: block.ref, line: block.line, code: "invalid-ref", reason: parsed.reason });
      continue;
    }
    const key = parsed.ref.key;
    const text = block.text?.trim() ?? "";
    if (!text) {
      problems.push({ key, ref: block.ref, line: block.line, code: "missing-text",
        reason: `نص الآية ${key} غير مكتوب داخل السكريبت؛ اكتب [آية: ${block.ref} | النص بالتشكيل].` });
      continue;
    }
    // A repeated citation cannot silently override an earlier verse.
    if (Object.prototype.hasOwnProperty.call(texts, key) && texts[key] !== text) {
      problems.push({ key, ref: block.ref, line: block.line, code: "conflicting-text",
        reason: `يوجد نصان مختلفان للمرجع ${key} داخل السكريبت؛ راجعهما دون تصحيح آلي.` });
      continue;
    }
    texts[key] = text;
    ayahs.push({ key, ref: block.ref, text, line: block.line });
  }
  return { texts, ayahs, problems };
};

/** A provenance label is not proof of review. Old placeholder labels are not sources. */
export const attributedMeaningSource = (candidate: unknown): string | null => {
  if (typeof candidate !== "string") return null;
  const source = candidate.trim();
  if (!source || /^(?:مدخل يدويًا|مصدر غير موثق|المصدر غير معروف|المصدر التاريخي غير معروف|غير معروف|unknown\b)/iu.test(source))
    return null;
  return source;
};

/** A historical quran.json is read ONLY for meaning/provenance, never verse text. */
export const historicalMeanings = (
  historical: Record<string, string>,
  previousSources: Record<string, string> = {},
): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(historical)) {
    if (!key.endsWith("#meaning") || typeof value !== "string" || !value.trim()) continue;
    result[key] = value;
    const verseKey = key.slice(0, -"#meaning".length);
    const source = attributedMeaningSource(historical[`${verseKey}#meaningSource`]) ??
      attributedMeaningSource(previousSources[verseKey]);
    if (source) result[`${verseKey}#meaningSource`] = source;
  }
  return result;
};
