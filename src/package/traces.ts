/**
 * قاعدة القناة: لا يظهر للمشاهد أي أثر يدل على أدوات الإنتاج (الذكاء الاصطناعي، أسماء الأدوات، الصوت المستنسخ).
 * يُفحص كل نص منشور (العناوين، الأوصاف، الوسوم، الكابشن، التعليق المثبّت، ملفات الترجمة، نص الشاشة)
 * قبل تجهيز الحزمة، وتعرض الواجهة الفحص بجوار كل حقل.
 *
 * Normalisation before matching (security QA C2, 10 Nov), so a trace cannot hide behind spelling:
 *  NFKC (fullwidth → ASCII) · zero-width / bidi / format characters removed (U+200B–U+200F, U+202A–U+202E,
 *  U+2060–U+206F, U+FEFF, U+00AD and every other \p{Cf}) · Cyrillic/Greek lookalikes folded to Latin ·
 *  case-folded · Arabic tashkeel and tatweel removed, alef forms unified · separators collapsed, and a tool
 *  name split by separators («Eleven Labs», «E.l.e.v.e.n-Labs», «#Eleven_Labs») is rejoined token by token.
 * Rejoining only joins whole adjacent tokens into an exact name, so «reopen aisle» is not «openai».
 */
import type { Check } from "./social";

const FORMAT = /[­᠎​-‏‪-‮⁠-⁯﻿\p{Cf}]/gu;
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** Cyrillic and Greek letters that look like Latin ones (lower case; the text is case-folded first). */
const CONFUSABLES: Record<string, string> = {
  "а": "a", "в": "b", "с": "c", "ԁ": "d", "е": "e", "ё": "e", "һ": "h", "і": "i", "ї": "i", "ј": "j", "к": "k",
  "ӏ": "l", "м": "m", "н": "h", "о": "o", "р": "p", "ԛ": "q", "ѕ": "s", "т": "t", "у": "y", "ү": "y", "х": "x",
  "ԝ": "w", "ь": "b", "ɡ": "g", "ɑ": "a", "ı": "i", "ℓ": "l",
  "α": "a", "β": "b", "ε": "e", "η": "n", "ι": "i", "κ": "k", "ν": "v", "ο": "o", "ρ": "p", "τ": "t", "υ": "u",
  "χ": "x", "γ": "y", "ω": "w", "μ": "u", "ϲ": "c", "ј̇": "j",
};
const CONFUSABLE_RE = new RegExp(`[${Object.keys(CONFUSABLES).filter((k) => k.length === 1).join("")}]`, "gu");

/** The text as the matcher sees it (exported for tests). */
export const normalizeForTraces = (text: string): string =>
  String(text ?? "")
    .normalize("NFKC")
    .replace(FORMAT, "")
    .toLowerCase()
    .replace(CONFUSABLE_RE, (c) => CONFUSABLES[c] ?? c)
    .replace(ARABIC_MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي");

/** Tokens: runs of letters/digits; every other character is a separator. */
const tokensOf = (norm: string): string[] => norm.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const spacedOf = (norm: string): string => ` ${tokensOf(norm).join(" ")} `;

type Name = { name: string; label: string; /** also inside a longer token (only for distinctive names) */ inside?: boolean };
/** Latin tool names, written as one lower-case token. */
const NAMES: Name[] = [
  { name: "elevenlabs", label: "ElevenLabs", inside: true },
  { name: "elevenlab", label: "ElevenLabs", inside: true },
  { name: "claude", label: "Claude" },
  { name: "claudeai", label: "Claude", inside: true },
  { name: "anthropic", label: "Claude", inside: true },
  { name: "chatgpt", label: "ChatGPT", inside: true },
  { name: "openai", label: "ChatGPT", inside: true },
  { name: "gemini", label: "أداة ذكاء اصطناعي" },
  { name: "bard", label: "أداة ذكاء اصطناعي" },
  { name: "copilot", label: "أداة ذكاء اصطناعي" },
  { name: "midjourney", label: "أداة توليد صور", inside: true },
  { name: "firefly", label: "أداة توليد صور" },
  { name: "dalle", label: "أداة توليد صور" },
  { name: "stablediffusion", label: "أداة توليد صور", inside: true },
  { name: "sora", label: "أداة توليد صور" },
  { name: "veo", label: "أداة توليد صور" },
  { name: "runway", label: "أداة توليد صور" },
  { name: "runwayml", label: "أداة توليد صور", inside: true },
  { name: "pika", label: "أداة توليد صور" },
  { name: "heygen", label: "أداة توليد فيديو", inside: true },
  { name: "synthesia", label: "أداة توليد فيديو", inside: true },
  { name: "suno", label: "أداة توليد صوت" },
  { name: "udio", label: "أداة توليد صوت" },
  { name: "remotion", label: "Remotion", inside: true },
  { name: "ai", label: "AI" },
  { name: "tts", label: "مصطلح توليد" },
];
const MAX_NAME = Math.max(...NAMES.map((n) => n.name.length));

/** Token patterns (a whole token): GPT, GPT-4 («gpt» then «4»), GPT4o, GPTs… */
const TOKEN_PATTERNS: [RegExp, string][] = [
  [/^(chat)?gpt(\d+[a-z]?|s|o)?$/, "ChatGPT"],
  [/^claude\d*$/, "Claude"],
  [/^gemini\d*$/, "أداة ذكاء اصطناعي"],
];

/** Patterns on the spaced view (tokens joined by single spaces, with a leading and trailing space). */
const SPACED_PATTERNS: [RegExp, string][] = [
  // Arabic phrasing
  [/ذكاء (ال)?(اصطناع|صناع)/u, "ذكاء اصطناعي"],
  [/(مولد|مولده|مولدة|توليد|مصنوع|مصنوعه|مصنوعة) (من |عبر |بواسطه |بواسطة )?(ال|بال|ب)?ذكاء /u, "مولَّد آليًا"],
  [/ (ال)?(مولد|مولده|مولدة) (رقميا|حاسوبيا) /u, "مولَّد آليًا"],
  [/ (ال)?(صوت|اصوات|الاصوات|تعليق|التعليق|الراوي|راوي)( (ال)?صوتي)? (ال)?(مولد|مولده|مولدة|اصطناعي|اصطناعيه|اصطناعية|صناعي|مستنسخ|مستنسخه|مستنسخة) /u, "صوت آلي"],
  [/ (ال|و|ب|بال|وال)?مستنسخ[^ ]* /u, "استنساخ الصوت"],
  [/ (ب|ل|و)?(ال)?استنساخ (ال)?(صوت|اصوات|الاصوات|صوتي|صوته|صوتها|الصوتي) /u, "استنساخ الصوت"],
  // Arabic transliterations of the tools
  [/ (ال)?(كلود|كلاود) /u, "Claude"],
  [/ (انثروبيك|انثروبك) /u, "Claude"],
  [/ (شات |تشات )?جي ?بي ?تي /u, "ChatGPT"],
  [/ (اوبن|اوبين) ?(اي|ايه) ?اي /u, "ChatGPT"],
  [/ (الفن|اليفن|ايليفن|ايلفن|الڤن|اليڤن) ?(لابز|لابس|لاب) /u, "ElevenLabs"],
  [/ (ريموشن|ريموشين|ريموشون) /u, "Remotion"],
  [/ (ميدجورني|ميد جورني|ميدجيرني) /u, "أداة توليد صور"],
  [/ (جيميني|جيمناي|جمناي) /u, "أداة ذكاء اصطناعي"],
  [/ (كوبايلوت|كوبيلوت) /u, "أداة ذكاء اصطناعي"],
  [/ (هاي ?جين|سينثيسيا|سينثيزيا) /u, "أداة توليد فيديو"],
  // Latin phrasing
  [/ a i (generated|made|voice|art|image|video|narrat\w*|tool\w*) /, "AI"],
  [/ (synthetic|generated) (voice|narration|speech|audio|video|image|art) /, "مصطلح توليد"],
  [/ ai generated /, "مصطلح توليد"],
  [/ text to speech /, "مصطلح توليد"],
  [/ voice ?clon\w* /, "مصطلح توليد"],
  [/ clon\w* voice /, "مصطلح توليد"],
  [/ stable diffusion /, "أداة توليد صور"],
  [/ dall e /, "أداة توليد صور"],
  [/ open ai /, "ChatGPT"],
];

/** On the text with tashkeel removed but alef forms kept: «صوت آلي» / «توليد آلي» («آلي» ≠ «إلى»). */
const RAW_PATTERNS: [RegExp, string][] = [
  [/(^|[^\p{L}])(ال)?(صوت|اصوات|الأصوات|تعليق|التعليق|الراوي|راوي)( (ال)?صوتي)? (ال)?آلي/u, "صوت آلي"],
  [/(مولد|مولّد|مولده|مولدة) (آليا|آلي)|توليد (آلي|آليا)/u, "مولَّد آليًا"],
];

/** A.I. with dots: the only form where single letters are rejoined to «ai». */
const DOTTED_AI = /(^|[^\p{L}\p{N}])a\s*[.·•]\s*i\s*[.·•]?(?![\p{L}\p{N}])/u;

/** كل الآثار الموجودة في نص (بلا تكرار). */
export const findTraces = (text: string): string[] => {
  const norm = normalizeForTraces(text);
  const toks = tokensOf(norm);
  const hits = new Set<string>();
  const byName = new Map(NAMES.map((n) => [n.name, n.label]));
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    for (const [re, label] of TOKEN_PATTERNS) if (re.test(t)) hits.add(label);
    for (const n of NAMES) if (n.inside && n.name.length >= 6 && t !== n.name && t.includes(n.name)) hits.add(n.label);
    // rejoin adjacent whole tokens into an exact name: «eleven labs», «e l e v e n l a b s», «claude ai»
    let joined = "";
    for (let j = i; j < toks.length && joined.length < MAX_NAME; j++) {
      joined += toks[j]!;
      const label = byName.get(joined);
      // single letters rejoined into «ai» only in the dotted form (below): «a i» is ordinary English
      if (label && !(joined === "ai" && j > i)) hits.add(label);
    }
  }
  if (DOTTED_AI.test(norm)) hits.add("AI");
  const raw = String(text ?? "").normalize("NFKC").replace(FORMAT, "").replace(ARABIC_MARKS, "").replace(/\s+/g, " ");
  for (const [re, label] of RAW_PATTERNS) if (re.test(raw)) hits.add(label);
  const spaced = spacedOf(norm);
  for (const [re, label] of SPACED_PATTERNS) if (re.test(spaced)) hits.add(label);
  return [...hits];
};

/** فحص يظهر بجوار الحقل في الاستوديو. */
export const traceCheck = (text: string): Check => {
  const hits = findTraces(text);
  return { ok: hits.length === 0, label: hits.length ? `أثر أدوات: ${hits.join("، ")}` : "بلا أثر للأدوات" };
};

/** يرفض الحزمة إن وُجد أثر في أي ملف نصي منشور. */
export const assertNoTraces = (files: { name: string; text: string }[]) => {
  const bad = files.map((f) => ({ name: f.name, hits: findTraces(f.text) })).filter((f) => f.hits.length);
  if (bad.length)
    throw new Error(`قاعدة القناة: نص منشور يكشف أدوات الإنتاج، أزله ثم أعد التجهيز.\n${bad.map((b) => `• ${b.name}: ${b.hits.join("، ")}`).join("\n")}`);
};

/** An identifier (element id, pose, theme, file name…), not words the viewer reads. */
const IDENTIFIER = /^[a-z0-9_.:/#@+-]+$/i;
const textsIn = (v: unknown, depth = 0): string[] => {
  if (depth > 4 || v == null) return [];
  if (typeof v === "string") return v.trim() && !IDENTIFIER.test(v.trim()) ? [v] : [];
  if (Array.isArray(v)) return v.flatMap((x) => textsIn(x, depth + 1));
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).flatMap((x) => textsIn(x, depth + 1));
  return [];
};

/**
 * Every text the viewer can read on screen (security QA C2): the title, chapter titles, each scene's props
 * that are words (props.text, lines, quotes, beats, the chapter cards and the end screen…), the narration,
 * and the script's frontmatter book / author / alt titles. Identifiers (element ids, poses) are skipped.
 */
export const onScreenTexts = (
  plan: { title?: string; chapters: { title?: string; scenes: { id: string; narration?: string; props?: Record<string, unknown> }[] }[] },
  frontmatter: Record<string, unknown> = {},
): { name: string; text: string }[] => {
  const out: { name: string; text: string }[] = [];
  if (plan.title) out.push({ name: "عنوان الحلقة", text: plan.title });
  for (const k of ["book", "author", "alt_titles", "title", "subtitle"]) {
    const t = textsIn(frontmatter[k]);
    if (t.length) out.push({ name: `السكريبت: ${k}`, text: t.join("\n") });
  }
  for (const c of plan.chapters) {
    if (c.title) out.push({ name: `عنوان الفصل «${c.title.slice(0, 30)}»`, text: c.title });
    for (const s of c.scenes) {
      const t = [...textsIn(s.props), ...(s.narration?.trim() ? [s.narration] : [])];
      if (t.length) out.push({ name: `نص الشاشة في المشهد ${s.id}`, text: t.join("\n") });
    }
  }
  return out;
};
