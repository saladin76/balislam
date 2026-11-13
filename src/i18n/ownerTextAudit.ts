/**
 * What the owner must never read (QA 12 Nov 2026, all three channels): Western digits inside Arabic text («جملة من 27
 * كلمة»، «(السطر 15)»), and raw scene ids («c1-s5») where «المشهد ٥» belongs. One rule for the vitest checks of rendered
 * markup and for the real-browser audit (`app/scripts/ui-audit.mjs`, check «owner-text», which inlines the same regexes).
 * Allowed: digits glued to Latin letters or symbols that are names of formats or codes (4K، H.264، 1080p، 320k، 1×).
 */
export const OWNER_LATIN_NUMBER = /(?<![A-Za-z0-9._/:#@-])\d+(?![A-Za-z0-9_/×-]|[.:]\d*[A-Za-z])/;
export const OWNER_RAW_SCENE_ID = /(?<![\w-])c\d+-(?:s\d+|end)(?![\w-])/;
const ARABIC = /[؀-ۿ]/;

/** The problems in one piece of owner-facing text (a text node, a message, a title). */
export const ownerTextProblems = (text: string): string[] => {
  const t = String(text ?? "");
  const out: string[] = [];
  if (OWNER_RAW_SCENE_ID.test(t)) out.push(`raw scene id: «${t.slice(0, 80)}»`);
  if (ARABIC.test(t) && OWNER_LATIN_NUMBER.test(t)) out.push(`Western digits: «${t.slice(0, 80)}»`);
  return out;
};

/**
 * The visible text of rendered markup, one entry per text run (tags removed; <code>, <textarea>, <input> values,
 * attributes and `dir="ltr"` runs are not owner prose and are skipped).
 */
export const markupTexts = (html: string): string[] =>
  html
    .replace(/<(code|pre|kbd|samp|textarea|select|script|style)\b[\s\S]*?<\/\1>/g, " ")
    .replace(/<([a-z0-9]+)\b[^>]*\bdir="ltr"[^>]*>[\s\S]*?<\/\1>/g, " ")
    .split(/<[^>]*>/)
    .map((s) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim())
    .filter(Boolean);

/** Every problem in rendered markup; a run that is only a Western number («27»، «0:08») counts too (the page is Arabic). */
export const markupProblems = (html: string): string[] =>
  markupTexts(html).flatMap((t) => (/^[0-9][0-9.:,٫ ]*$/.test(t) ? [`Western digits: «${t}»`] : ownerTextProblems(t)));
