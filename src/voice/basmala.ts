/**
 * The basmala (owner decision, 10 Nov 2026): «بسم الله الرحمن الرحيم» is treated like a verse in all three
 * channels. The owner records it in his own voice; the cloned voice never says it.
 *
 * - Detection is by words, whatever their tashkeel, tatweel, alef forms or punctuation, and also when the
 *   basmala sits inside a longer narration sentence (`basmalaSpans`).
 * - The Quran guard (quranGuard.ts) refuses any text that contains it and cuts it out of TTS context.
 * - A sentence that mixes it with narration is split automatically (`splitBasmala`): the basmala becomes its
 *   own recitation item (kind "basmala", «ارفع التسجيل»), the rest stays narration for the voice. The words
 *   of the scene are unchanged, so captions and the script stay word for word.
 * - A scene whose narration contains it is voiced sentence by sentence (its sentences are composed with the
 *   owner's approved recording, key `BASMALA_KEY` in the episode's recitations), and until that recording is
 *   approved its draft carries a marked silent placeholder and can only be approved «مشروطًا بالتلاوة» — the
 *   same D35 gates as a verse: no assembly, Master or publish while it is pending.
 */

/** The recitation key of the owner's own basmala recording (one per episode, reused by every occurrence). */
export const BASMALA_KEY = "basmala";
/** The reviewed text of that recording (fixed: it is not read from the script). */
export const BASMALA_TEXT = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
/** Placeholder length in a draft before the recording is approved (seconds). */
export const BASMALA_PLACEHOLDER_SEC = 3.2;

const norm = (w: string) =>
  w.normalize("NFKC")
    .replace(/[ً-ٰٟـۖ-ۭ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]/gu, "");
const PATTERN = ["بسم", "الله", "الرحمن", "الرحيم"];
const same = (w: string, k: number) => {
  const n = norm(w);
  if (k === 0) return n === "بسم" || n === "وبسم" || n === "فبسم";
  if (k === 2) return n === "الرحمن" || n === "الرحمان";
  return n === PATTERN[k];
};

/** [start, end) word ranges of every basmala in the text (words split on whitespace). */
export const basmalaSpans = (text: string): [number, number][] => {
  const ws = text.trim().split(/\s+/).filter(Boolean);
  const out: [number, number][] = [];
  for (let i = 0; i + PATTERN.length <= ws.length; i++) {
    if (PATTERN.every((_, k) => same(ws[i + k]!, k))) {
      out.push([i, i + PATTERN.length]);
      i += PATTERN.length - 1;
    }
  }
  return out;
};
export const hasBasmala = (text: unknown): boolean => typeof text === "string" && basmalaSpans(text).length > 0;
/** The text is the basmala and nothing else (punctuation allowed). */
export const isBasmalaOnly = (text: string): boolean => {
  const ws = text.trim().split(/\s+/).filter(Boolean);
  const spans = basmalaSpans(text);
  return spans.length === 1 && spans[0]![0] === 0 && spans[0]![1] === ws.length;
};
/**
 * Split a sentence around each basmala: [before, basmala, after…] in order, every word kept exactly as written
 * (joined with single spaces). A text without the basmala comes back as it is.
 */
export const splitBasmala = (text: string): string[] => {
  const ws = text.trim().split(/\s+/).filter(Boolean);
  const spans = basmalaSpans(text);
  if (!spans.length) return [ws.join(" ")].filter(Boolean);
  const out: string[] = [];
  let at = 0;
  for (const [a, b] of spans) {
    if (a > at) out.push(ws.slice(at, a).join(" "));
    out.push(ws.slice(a, b).join(" "));
    at = b;
  }
  if (at < ws.length) out.push(ws.slice(at).join(" "));
  return out;
};
/** The text with every basmala cut out (for TTS context); empty → "". */
export const withoutBasmala = (text: string): string => {
  const ws = text.trim().split(/\s+/).filter(Boolean);
  const spans = basmalaSpans(text);
  return ws.filter((_, i) => !spans.some(([a, b]) => i >= a && i < b)).join(" ");
};
