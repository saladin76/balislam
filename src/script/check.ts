import { z } from "zod";
import defaultConfig from "../../config.json";
import { normalizeArabic, parseAyahRef } from "./quranMeta";
import { isSceneTemplate, SCENE_TEMPLATES } from "./sceneTemplates";
import type { Chapter, Frontmatter, Issue, ParsedScript } from "./types";
import { defaultChannel, domainIds } from "../channel/types";
import { langPacks } from "../i18n/packs";

export type CheckConfig = {
  wordsPerMinute: number;
  chapters: number;
  chapterSeconds: { min: number; max: number };
  maxSentenceWords: number;
  maxTitleChars: number;
  /** مجالات القناة المسموحة (افتراضيًا: مجالات القناة الأساسية) */
  domains?: string[];
};

export const configFromFile = (c: typeof defaultConfig = defaultConfig): CheckConfig => ({
  wordsPerMinute: c.speech.wordsPerMinute,
  chapters: c.episode.chapters,
  chapterSeconds: c.episode.chapterSeconds,
  maxSentenceWords: c.writing.maxSentenceWords,
  maxTitleChars: c.writing.maxTitleChars,
});

const frontmatterSchemaFor = (domains: string[]) => z.object({
  title: z.string({ error: "العنوان (title) مطلوب ويجب أن يكون نصًا." }).trim().min(1, { error: "العنوان (title) فارغ." }),
  domain: z.string({ error: "المجال (domain) مطلوب." }).refine((d) => domains.includes(d), {
    error: `المجال (domain) يجب أن يكون واحدًا من: ${domains.join("، ")}.`,
  }),
  episode: z.union([z.string(), z.number()]).transform(String).pipe(
    z.string().regex(/^\d{3}$/, { error: "رقم الحلقة (episode) يجب أن يكون ثلاث خانات، مثل 001." }),
  ),
  alt_titles: z.array(z.string()).optional(),
  lang: z.string().optional(),
  /** أسلوب العرض الافتراضي للمشاهد التي بلا علامة: templates (القوالب) أو board (السبورة المتصلة) */
  style: z.enum(["templates", "board"], { error: "الأسلوب (style) يجب أن يكون templates أو board." }).optional(),
});

/** عبارات تحيل لفصل سابق، فتكسر استقلال الفصل حين يُنشر شورت. */
const BACK_REFERENCES = ["كما قلنا", "كما ذكرنا", "ذكرنا سابقا", "في الفصل السابق", "قلنا سابقا", "كما اشرنا"];
/** كلمات تبدأ بها الجملة الأولى فتصبح غير مفهومة وحدها. */
const DANGLING_STARTERS = ["هذا", "هذه", "ذلك", "تلك", "هؤلاء", "هو", "هي", "هم"];
const ALLOWED_HADITH_GRADES = ["صحيح", "حسن"];
const REJECTED_HADITH_GRADES = ["ضعيف", "موضوع", "منكر", "لا اصل له", "باطل"];

export type ChapterStats = { number: number; words: number; seconds: number };

export type CheckResult = {
  issues: Issue[];
  frontmatter: Frontmatter | null;
  stats: { chapters: ChapterStats[]; totalWords: number; totalSeconds: number };
  ok: boolean;
};

const countWords = (text: string): number => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

const narrationOf = (ch: Chapter, includeBridge = true): string =>
  ch.blocks
    .filter((b) => b.kind === "narration" || (includeBridge && b.kind === "bridge"))
    .map((b) => ("text" in b ? b.text : ""))
    .join(" ");

const sentences = (text: string): string[] =>
  text
    .split(/(?<=[.!؟?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

/** يفحص السكريبت حسب «أصول كتابة السكريبت» ويعيد الأخطاء والتنبيهات والإحصاءات. */
export const checkScript = (script: ParsedScript, config: CheckConfig = configFromFile()): CheckResult => {
  const issues: Issue[] = [...script.parseIssues];
  const err = (code: string, message: string, line?: number) => issues.push({ level: "error", code, message, line });
  const warn = (code: string, message: string, line?: number) => issues.push({ level: "warning", code, message, line });

  // ترويسة الحلقة
  let fm: Frontmatter | null = null;
  if (script.frontmatter) {
    const parsed = frontmatterSchemaFor(config.domains ?? domainIds(defaultChannel)).safeParse(script.frontmatter);
    if (parsed.success) {
      fm = parsed.data as Frontmatter;
      if (fm.title.length > config.maxTitleChars) {
        warn("title-length", `العنوان ${fm.title.length} حرفًا؛ الحد ${config.maxTitleChars} حتى لا يُقطع على الموبايل.`, script.frontmatterLine);
      }
      if (fm.lang) {
        const pack = langPacks[fm.lang];
        if (!pack) err("lang-unknown", `اللغة «${fm.lang}» غير معروفة. المتاح: ${Object.keys(langPacks).join("، ")}.`, script.frontmatterLine);
        else if (!pack.ready) warn("lang-not-ready", `اللغة «${pack.nameAr}» في مرحلة التجهيز: نصوصها جاهزة، وتخطيط القوالب من اليسار لليمين لم يُفعَّل بعد.`, script.frontmatterLine);
      }
      if (!/[؟?]\s*$/.test(fm.title)) warn("title-question", "العنوان يُفضّل أن يكون سؤالًا ينتهي بـ «؟».", script.frontmatterLine);
      if (!fm.alt_titles || fm.alt_titles.length < 3) {
        warn("alt-titles", "اكتب ثلاثة عناوين بديلة في alt_titles لنختار منها.", script.frontmatterLine);
      }
    } else {
      for (const issue of parsed.error.issues) err("frontmatter-invalid", issue.message, script.frontmatterLine);
    }
  }
  const isArabic = (fm?.lang ?? "ar") === "ar";

  // الفصول
  if (script.chapters.length !== config.chapters) {
    err("chapter-count", `السكريبت فيه ${script.chapters.length} فصول؛ المطلوب ${config.chapters} بالضبط.`, script.chapters[0]?.line);
  }
  script.chapters.forEach((ch, idx) => {
    if (ch.number !== idx + 1) err("chapter-number", `رقم الفصل ${ch.number} في غير ترتيبه؛ المتوقع ${idx + 1}.`, ch.line);
    if (!ch.title) warn("chapter-title", `الفصل ${ch.number} بلا عنوان بعد «·».`, ch.line);
  });

  const stats: ChapterStats[] = [];
  const ayahMarkers: { ref: string; key: string; line: number }[] = [];
  const hadithMarkers: { ref: string; line: number }[] = [];

  script.chapters.forEach((ch, idx) => {
    const isLast = idx === script.chapters.length - 1;
    const narrationBlocks = ch.blocks.filter((b) => b.kind === "narration");
    if (narrationBlocks.length === 0) err("chapter-empty", `الفصل ${ch.number} لا يحتوي نص تعليق.`, ch.line);

    // جمل الربط
    const bridges = ch.blocks.filter((b) => b.kind === "bridge");
    if (bridges.length > 1) err("bridge-multiple", `الفصل ${ch.number} فيه أكثر من جملة ربط؛ المسموح واحدة.`, bridges[1]?.line);
    if (isLast && bridges.length > 0) err("bridge-last", "الفصل الأخير لا يحتاج جملة ربط؛ لا فصل بعده.", bridges[0]?.line);
    const lastBlock = ch.blocks.filter((b) => b.kind !== "sfx").at(-1);
    if (bridges.length === 1 && lastBlock?.kind !== "bridge") {
      warn("bridge-position", `جملة الربط في الفصل ${ch.number} يُفضّل أن تكون آخر سطر فيه.`, bridges[0]?.line);
    }

    // الأحكام على نص التعليق
    for (const b of ch.blocks) {
      if (b.kind === "scene" && !isSceneTemplate(b.template)) {
        err("scene-unknown", `قالب المشهد «${b.template}» غير موجود. القوالب: ${Object.keys(SCENE_TEMPLATES).join("، ")}.`, b.line);
      }
      if (b.kind === "ayah") {
        const r = parseAyahRef(b.ref);
        if (r.ok) ayahMarkers.push({ ref: b.ref, key: r.ref.key, line: b.line });
        else err("ayah-ref", r.reason, b.line);
      }
      if (b.kind === "hadith") {
        hadithMarkers.push({ ref: b.ref, line: b.line });
        if (!b.text) warn("hadith-text-missing", `نص الحديث [${b.ref}] غير مكتوب؛ أضفه هكذا: [حديث: ${b.ref} | نص الحديث | الراوي]، أو اكتبه في الاستوديو.`, b.line);
      }
      if (b.kind !== "narration" && b.kind !== "bridge") continue;

      const text = b.text;
      const norm = normalizeArabic(text);
      // قواعد خاصة بالكتابة العربية
      if (isArabic) for (const phrase of BACK_REFERENCES) {
        if (norm.includes(normalizeArabic(phrase))) {
          err("back-reference", `«${phrase}» تحيل لما قبل الفصل، والفصل يُنشر وحده كشورت. أعد تقديم الفكرة في جملة.`, b.line);
        }
      }
      if (text.includes("ﷺ")) err("salawat-symbol", "اكتب «صلى الله عليه وسلم» كاملة بدل الرمز ﷺ، لأن الصوت لا يقرؤه.", b.line);
      if (/[﴿﴾]/.test(text)) {
        err("ayah-inline", "لا تُكتب الآيات داخل نص التعليق؛ استخدم علامة [آية: السورة رقم] في سطر مستقل.", b.line);
      }
      if (/[0-9٠-٩]/.test(text)) warn("digits", "اكتب الأرقام بالحروف كما تُنطق، حتى يقرأها الصوت صحيحة.", b.line);
      if (/[%&@#]/.test(text)) warn("symbols", "الرموز (% & @ #) تُكتب كلمات، مثل «في المئة».", b.line);
      for (const s of sentences(text)) {
        const n = countWords(s);
        if (n > config.maxSentenceWords) {
          warn("sentence-long", `جملة من ${n} كلمة؛ قسّمها (الحد ${config.maxSentenceWords}): «${s.slice(0, 40)}…»`, b.line);
        }
      }
    }

    // الجملة الأولى
    const first = narrationBlocks[0];
    if (first && isArabic) {
      const firstWord = normalizeArabic(first.text.split(/\s+/)[0] ?? "").replace(/[^\p{L}]/gu, "");
      if (DANGLING_STARTERS.map(normalizeArabic).includes(firstWord)) {
        warn("dangling-start", `الفصل ${ch.number} يبدأ بـ «${first.text.split(/\s+/)[0]}»؛ قد لا يُفهم وحده كشورت.`, first.line);
      }
    }

    const words = countWords(narrationOf(ch));
    const seconds = Math.round((words / config.wordsPerMinute) * 60);
    stats.push({ number: ch.number, words, seconds });
    if (narrationBlocks.length > 0 && (seconds < config.chapterSeconds.min || seconds > config.chapterSeconds.max)) {
      warn(
        "chapter-length",
        `الفصل ${ch.number}: ${words} كلمة ≈ ${seconds} ثانية؛ المستهدف من ${config.chapterSeconds.min} إلى ${config.chapterSeconds.max} ثانية.`,
        ch.line,
      );
    }
  });

  // الاستشهادات
  if (!script.hasCitationsSection) err("citations-missing", "قسم «## الاستشهادات» مفقود في آخر السكريبت.");
  if (!script.practicalStep) err("step-missing", "قسم «## الخطوة العملية» مفقود أو فارغ.");

  const citedAyahKeys = new Map<string, number>();
  const citedHadith = new Map<string, number>();
  for (const c of script.citations) {
    if (c.kind === "ayah") {
      const r = parseAyahRef(c.fields[0] ?? "");
      if (r.ok) citedAyahKeys.set(r.ref.key, c.line);
      else err("citation-ayah-ref", r.reason, c.line);
    } else if (c.kind === "hadith") {
      const ref = c.fields[0] ?? "";
      const grade = normalizeArabic(c.fields[1] ?? "");
      citedHadith.set(normalizeArabic(ref), c.line);
      if (!ref) err("citation-hadith-ref", "حديث بلا مصدر في قائمة الاستشهادات.", c.line);
      if (!grade) {
        err("citation-hadith-grade", `الحديث «${ref}» بلا درجة؛ اكتب «صحيح» أو «حسن» في الحقل الثالث.`, c.line);
      } else if (REJECTED_HADITH_GRADES.some((g) => grade.includes(normalizeArabic(g)))) {
        err("hadith-weak", `الحديث «${ref}» درجته «${c.fields[1]}»؛ ميثاق المحتوى يقبل الصحيح والحسن فقط.`, c.line);
      } else if (!ALLOWED_HADITH_GRADES.some((g) => grade.includes(normalizeArabic(g)))) {
        err("hadith-grade-unknown", `درجة الحديث «${c.fields[1]}» غير معروفة؛ المقبول «صحيح» أو «حسن».`, c.line);
      }
      if (!c.fields.some((f) => normalizeArabic(f).startsWith(normalizeArabic("تحقق")))) {
        warn("citation-verified", `اذكر مصدر التحقق من درجة الحديث «${ref}» (مثال: تحقق: الدرر السنية).`, c.line);
      }
    }
  }
  for (const m of ayahMarkers) {
    if (!citedAyahKeys.has(m.key)) err("ayah-not-cited", `الآية [${m.ref}] غير موجودة في قائمة الاستشهادات.`, m.line);
  }
  for (const m of hadithMarkers) {
    if (!citedHadith.has(normalizeArabic(m.ref))) err("hadith-not-cited", `الحديث [${m.ref}] غير موجود في قائمة الاستشهادات.`, m.line);
  }

  const totalWords = stats.reduce((s, c) => s + c.words, 0);
  const totalSeconds = stats.reduce((s, c) => s + c.seconds, 0);
  issues.sort((a, b) => (a.line ?? Number.MAX_SAFE_INTEGER) - (b.line ?? Number.MAX_SAFE_INTEGER));
  return {
    issues,
    frontmatter: fm,
    stats: { chapters: stats, totalWords, totalSeconds },
    ok: !issues.some((x) => x.level === "error"),
  };
};
