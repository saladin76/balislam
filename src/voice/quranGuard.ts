/**
 * The single Quran guard for every text-to-speech request (rule: the cloned voice never recites Quran).
 *
 * Every path that can send text to the voice service — whole scenes, one sentence, a word fix, the
 * dafatir parts, preview lines (synthesizeLines), the Studio voice sample, the CLI — reaches the
 * ElevenLabs client, and the client runs `assertNoQuranForTts` on the text and `ttsContext` on the
 * neighbouring context before building any request body (src/voice/elevenlabs.ts `bodyFor`). Callers
 * that know the scene or the episode's verses also call it earlier, for a clearer refusal and so no job is
 * ever planned for a verse. `tests/quran-tts-guard.test.ts` enumerates the call sites.
 *
 * Refused: a verse scene (template verse-card or an ayahKey), any ﴿ ﴾ bracket or [آية …] marker, and any
 * run of five consecutive words of a known verse of the episode (tashkeel, tatweel, punctuation and every
 * alef ignored, so imla'i narration still matches an Uthmani verse, D220), and the basmala anywhere in the text (owner decision 10 Nov, src/voice/basmala.ts). Context (previous_text / next_text) is never refused: the Quran spans are cut out of it
 * and a context made only of Quran becomes undefined, so a verse is not even sent as context.
 */

import { APPROVED_BASMALA_CLIP, hasBasmala, isApprovedBasmalaSha256, withoutBasmala } from "./basmala";

export type TtsScene = { id?: string; template?: string; ayahKey?: string };

export class QuranTtsError extends Error {
  readonly code = "QURAN_TTS";
  constructor(message: string) {
    super(message);
    this.name = "QuranTtsError";
  }
}

export const isVerseScene = (scene?: TtsScene | null): boolean =>
  Boolean(scene && (scene.template === "verse-card" || (typeof scene.ayahKey === "string" && scene.ayahKey.trim())));

const BRACKETS = /[﴿﴾]/;
const MARKER = /\[\s*(?:آية|ايه|آيه|اية|ayah|verse)/iu;
/** ﴿…﴾ (also an unclosed ﴿… to the end) and [آية …] markers */
const SPANS = /﴿[^﴾]*(?:﴾|$)|[^﴿]*﴾|\[\s*(?:آية|ايه|آيه|اية|ayah|verse)[^\]]*\]?/giu;

// D220: الآيات المعروضة صارت بالرسم العثماني (Tanzil) والراوي يكتب بالإملائي؛ الرسم العثماني يحذف ألفات يكتبها الإملائي
// (ٱلْعَـٰلَمِينَ/العالمين، لِلْمَلَـٰٓئِكَةِ/للملائكة)، فتُحذف الألف بكل صورها من الطرفين لتبقى الكلمات الخمس تُعرف بالرسمين
const norm = (w: string) =>
  w.normalize("NFKC")
    .replace(/[ً-ٰٟـۖ-ۭ]/g, "")
    .replace(/[اأإآٱ]/g, "")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]/gu, "");
const wordsOf = (s: string) => s.split(/\s+/).map(norm).filter(Boolean);

const GRAM = 5;
/** Normalised five-word runs of each verse (a verse shorter than five words counts as a whole). */
const verseGrams = (verses: readonly string[]): string[] => {
  const out = new Set<string>();
  for (const v of verses) {
    const ws = wordsOf(v);
    if (!ws.length) continue;
    if (ws.length < GRAM) { if (ws.length >= 3) out.add(ws.join(" ")); continue; }
    for (let i = 0; i + GRAM <= ws.length; i++) out.add(ws.slice(i, i + GRAM).join(" "));
  }
  return [...out];
};
const containsVerse = (text: string, verses: readonly string[]): boolean => {
  if (!verses.length) return false;
  const hay = ` ${wordsOf(text).join(" ")} `;
  return verseGrams(verses).some((g) => hay.includes(` ${g} `));
};

export type QuranGuardOptions = {
  scene?: TtsScene | null;
  /** The episode's verse texts (verse-card props.text), when the caller knows them. */
  verses?: readonly string[];
  /** Where the text came from, for the refusal message (e.g. "voice-sample"). */
  source?: string;
};

/** Throws `QuranTtsError` when the text (or its scene) must never reach the cloned voice. */
export const assertNoQuranForTts = (text: unknown, scene?: TtsScene | null, o: Omit<QuranGuardOptions, "scene"> = {}): void => {
  const where = scene?.id ? ` (المشهد ${scene.id})` : o.source ? ` (${o.source})` : "";
  if (isVerseScene(scene))
    throw new QuranTtsError(`مشهد الآية لا يُرسل إلى الصوت المستنسخ أبدًا${where}؛ التلاوة من ملف القارئ المرخّص الذي يرفعه المالك.`);
  const t = typeof text === "string" ? text : String(text ?? "");
  if (BRACKETS.test(t) || MARKER.test(t))
    throw new QuranTtsError(`نص فيه آية (﴿ ﴾ أو [آية]) لا يُرسل إلى الصوت المستنسخ${where}؛ ضع الآية في مشهد آية مستقل.`);
  // The basmala is treated like a verse (owner decision, 10 Nov) and is never generated: D239 allows only its one
  // approved fixed clip (assertApprovedBasmalaAudio below), never a new TTS request.
  if (hasBasmala(t))
    throw new QuranTtsError(`البسملة لا تُرسل إلى الصوت المستنسخ${where}؛ لا تُولَّد أبدًا: تُستعمل نسختها المعتمدة الثابتة (D239) أو تسجيل الحلقة المعتمد.`);
  if (containsVerse(t, o.verses ?? []))
    throw new QuranTtsError(`النص يحوي آية من آيات الحلقة${where}، والصوت المستنسخ لا يتلو القرآن؛ ضعها في مشهد آية مستقل.`);
};

/**
 * D239 — the single exception, for the basmala alone: audio of the basmala may come from the cloned voice only as the
 * owner's one approved clip, recognised by its pinned sha256 (`APPROVED_BASMALA_CLIP` in basmala.ts). Any other bytes
 * are refused. This is not a TTS path: nothing is generated, and verses have no exception at all.
 */
export const assertApprovedBasmalaAudio = (sha256: unknown, source = "البسملة"): void => {
  if (!isApprovedBasmalaSha256(sha256))
    throw new QuranTtsError(`${source}: بصمة الملف لا تطابق نسخة البسملة المعتمدة (${APPROVED_BASMALA_CLIP.decision})؛ لا يُستعمل غيرها ولا يُولَّد بديل.`);
};

/** True when the text may be sent (no throw). */
export const isQuranFreeForTts = (text: unknown, scene?: TtsScene | null, o: Omit<QuranGuardOptions, "scene"> = {}): boolean => {
  try { assertNoQuranForTts(text, scene, o); return true; } catch { return false; }
};

/**
 * Neighbouring context for previous_text / next_text: a verse scene gives none, ﴿…﴾ spans and [آية]
 * markers are cut out, and context that still contains a known verse is dropped. Empty → undefined.
 */
export const ttsContext = (text: string | undefined | null, scene?: TtsScene | null, verses: readonly string[] = []): string | undefined => {
  if (!text || isVerseScene(scene)) return undefined;
  const cut = withoutBasmala(text.replace(SPANS, " ").replace(/[﴿﴾]/g, " ").replace(/\s+/g, " ").trim());
  if (!cut || containsVerse(cut, verses)) return undefined;
  return cut;
};

/** Is word i (of the original words) inside ﴿ ﴾? Both pronunciation lexicons skip these words. */
export const quranMask = (original: string[]): boolean[] => {
  let depth = 0;
  return original.map((w) => {
    if (w.includes("﴿")) depth++;
    const inside = depth > 0;
    if (w.includes("﴾")) depth = Math.max(0, depth - 1);
    return inside;
  });
};

/**
 * Verse texts of a plan, for the five-word check: verse-card scenes (props.text), and any scene that shows a
 * verse on screen as a silent visual citation (props.verseText, دفاتر الزمن V9) — the narrator keeps speaking
 * there, so the shown verse must still never be read by the cloned voice.
 */
export const planVerseTexts = (plan: { chapters: { scenes: { template?: string; ayahKey?: string; props?: Record<string, unknown> }[] }[] } | null | undefined): string[] =>
  (plan?.chapters ?? []).flatMap((c) => c.scenes)
    .flatMap((s) => [isVerseScene(s) && typeof s.props?.text === "string" ? s.props.text : "", typeof s.props?.verseText === "string" ? s.props.verseText : ""])
    .filter((t) => t.trim() && !t.startsWith("‹"));
