/** Hard separation: authored Quran is display/review content, never a TTS prompt.
 * This guard checks every script-sourced TTS job; it never generates recitation.
 */
import { normalizeArabic } from "../script/quranMeta";
import { quranFromScript } from "./scriptText";
import type { ParsedScript } from "../script/types";

const normalize = (text: string) => normalizeArabic(text).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const containsCitation = (text: string) => /\[\s*آية\s*:/u.test(text);

/** Reject full verses and substantial verbatim four-word Quran fragments. */
export const assertNoQuranInTts = (script: ParsedScript, utterances: readonly string[]): void => {
  const authored = quranFromScript(script);
  if (authored.problems.length)
    throw new Error("مراجع القرآن داخل السكريبت تحتاج مراجعة؛ لن يُرسل صوت إلى محرك الاستنساخ.");
  const snippets = new Set<string>();
  for (const text of Object.values(authored.texts)) {
    const normalized = normalize(text);
    if (normalized.length >= 8) snippets.add(normalized);
    const words = normalized.split(/\s+/).filter(Boolean);
    if (words.length > 4) for (let i = 0; i <= words.length - 4; i++) {
      const part = words.slice(i, i + 4).join(" ");
      if (part.length >= 15) snippets.add(part);
    }
  }
  for (const text of utterances) {
    if (containsCitation(text))
      throw new Error("لا تُرسل علامات الآيات إلى محرك التعليق الصوتي؛ التلاوة تسجيل بشري منفصل.");
    const shown = " " + normalize(text) + " ";
    if ([...snippets].some((part) => shown.includes(" " + part + " ")))
      throw new Error("يحتوي نص التعليق على نص قرآني مكتوب في السكريبت؛ التلاوة لا تُولّد اصطناعيًا.");
  }
};
