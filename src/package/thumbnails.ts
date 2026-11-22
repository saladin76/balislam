/**
 * الأغلفة الثلاثة لكل حلقة (قرار المالك ٢١ نوفمبر ٢٠٢٦، خطة «احترافية بلا مثيل»، المرحلة ٢ البند ١):
 * ثلاث صور مصغّرة مختلفة الفكرة لـ«Test & Compare» في يوتيوب — «عنوان» (كلمة الغلاف بخط القناة وعنصرها)،
 * و«مشهد» (لقطة حقيقية من مشهد معتمد في الحلقة)، و«سؤال» (سؤال الحلقة بلا إجابة) — بهوية القناة نفسها.
 *
 * القواعد (يفحصها `thumbnailIssues`، وتدخل `kitIssues` فتمنع الحزمة كباقي نصوص النشر):
 * - ثلاثة بالضبط، واحد من كل فكرة؛
 * - على الصورة ثلاث كلمات على الأكثر (والمشهد قد يكون بلا كلمة)، والعنوان والسؤال بكلمة على الأقل؛
 * - الصورة لا تكرر العنوان: كلمات الغلاف لا تكون كلها من عنوان واحد من عناوين الحلقة؛
 * - لا غلافان بالنص نفسه، والسؤال ينتهي بـ«؟»، ولا أثر لأدوات الإنتاج ولا إثارة رخيصة؛
 * - غلاف المشهد من مشهد في الخطة، وليس مشهد آية أو بسملة أو دعاء أو حديث (توقير).
 * المرجع: youtube-agent-skill (yt-package).
 */
import { normalizeArabic } from "../script/quranMeta";
import { findTraces } from "./traces";

export const THUMB_KINDS = ["title", "scene", "question"] as const;
export type ThumbKind = (typeof THUMB_KINDS)[number];
export const THUMB_KIND_LABEL: Record<ThumbKind, string> = { title: "عنوان", scene: "مشهد", question: "سؤال" };
/**
 * KI-120: غلافا «مشهد» و«سؤال» موقوفان عن الرسم حتى يختار المالك اتجاه القناة البصري من اتجاهات C الثلاثة
 * (قرار المالك ٢١ نوفمبر: لا قوالب افتراضية، ولا قالب قبل اتجاه يختاره المالك). نصوصهما تُكتب وتُفحص كما هي،
 * ولا يُرسم إلا «عنوان» بأسلوب مصغّرة القناة المعتمد. يُرفع الإيقاف بتصميم يتبع الاتجاه المختار، لا قبله.
 */
export const THUMB_ON_HOLD: Partial<Record<ThumbKind, string>> = {
  scene: "موقوف حتى يختار المالك اتجاه القناة البصري (KI-120)",
  question: "موقوف حتى يختار المالك اتجاه القناة البصري (KI-120)",
};

/**
 * رفع الإيقاف بالاتجاه المعتمد (D196، قرار المالك ٢٢ نوفمبر: «الأغلفة الثلاثة الآن، الاتجاه معتمد»): أسلوب «دفتر الأفق»
 * لدفاتر الزمن له تصميم «مشهد» و«سؤال» يتبعه (src/remotion/Thumbnail.tsx)، فلا إيقاف له. الأساليب الأخرى موقوفة كما هي
 * حتى يُعتمد اتجاه قناتها.
 */
export const THUMB_STYLES_RELEASED = ["horizon"] as const;
export const thumbHoldFor = (style?: string): Partial<Record<ThumbKind, string>> =>
  style && (THUMB_STYLES_RELEASED as readonly string[]).includes(style) ? {} : THUMB_ON_HOLD;

/** أقصى عدد كلمات على الصورة (قرار المالك). */
export const THUMB_MAX_WORDS = 3;

export type ThumbnailConcept = {
  kind: ThumbKind;
  /** الكلمات على الصورة: ثلاث على الأكثر */
  text: string;
  /** غلاف «مشهد»: المشهد الذي تُؤخذ منه اللقطة */
  sceneId?: string;
  /** غلاف «مشهد»: لحظة اللقطة بالثواني من بداية المشهد؛ إن غابت تُختار آليًا (`frameTimeFor`) */
  atSeconds?: number;
};

export type ThumbIssue = { level: "error" | "warning"; where: string; message: string; suggestion?: string };
/** ما يلزم الفحص من الخطة: المشاهد (لغلاف المشهد) والعناوين (لقاعدة «لا تكرر العنوان»). */
export type ThumbContext = { titles: string[]; scenes?: ThumbScene[] };
export type ThumbScene = { id: string; sacred: boolean };

const norm = (s: string) => normalizeArabic(s).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
/** كلمات الغلاف كما تُقرأ على الصورة (علامات الترقيم لا تُعد كلمة). */
export const thumbnailWords = (text: string): string[] => norm(text).split(" ").filter(Boolean);

const CLICKBAIT = ["لن تصدق", "صادم", "صدمه", "كارثه", "فضيحه", "لا يريدونك ان تعرف", "سيغير حياتك", "اقسم"].map(norm);

/** مشهد لا يصلح غلافًا: الآية والبسملة والدعاء والحديث وشاشة النهاية (توقير، ولا كلام على صورة آية). */
export const isSacredScene = (s: { template: string; ayahKey?: string; props?: Record<string, string> }): boolean =>
  Boolean(s.ayahKey || s.props?.verseKey || s.props?.verseText || s.props?.basmala) ||
  ["verse-card", "dua-board", "hadith-card", "end-screen"].includes(s.template) || /basmala|بسمل/i.test(s.props?.shot ?? "");

/** كل كلمات الغلاف موجودة في عنوان واحد = الغلاف يكرر العنوان. */
const repeatsTitle = (text: string, titles: string[]) => {
  const w = thumbnailWords(text);
  if (!w.length) return undefined;
  return titles.find((t) => {
    const tw = new Set(thumbnailWords(t));
    return tw.size > 0 && w.every((x) => tw.has(x));
  });
};

export const thumbnailIssues = (concepts: ThumbnailConcept[] | undefined, ctx: ThumbContext): ThumbIssue[] => {
  const out: ThumbIssue[] = [];
  const err = (where: string, message: string, suggestion?: string) => out.push({ level: "error", where, message, suggestion });
  const warn = (where: string, message: string) => out.push({ level: "warning", where, message });
  if (!concepts) {
    warn("الأغلفة الثلاثة", "لم تُكتب بعد: الصور الحالية تكتب العنوان نفسه. اكتب «عنوان» و«مشهد» و«سؤال» (ثلاث كلمات على الأكثر لكل صورة).");
    return out;
  }
  const kinds = concepts.map((c) => c.kind);
  if (concepts.length !== 3 || THUMB_KINDS.some((k) => kinds.filter((x) => x === k).length !== 1))
    err("الأغلفة الثلاثة", "يلزم ثلاثة أغلفة بالضبط، واحد لكل فكرة: «عنوان» و«مشهد» و«سؤال».");
  const sceneById = new Map((ctx.scenes ?? []).map((s) => [s.id, s]));
  const seen = new Map<string, ThumbKind>();
  for (const c of concepts) {
    const where = `الغلاف «${THUMB_KIND_LABEL[c.kind] ?? c.kind}»`;
    const text = (c.text ?? "").trim();
    const words = thumbnailWords(text);
    if (c.kind !== "scene" && !words.length) err(where, "بلا كلمات: اكتب كلمة إلى ثلاث كلمات.");
    if (words.length > THUMB_MAX_WORDS) err(where, `${words.length} كلمات؛ الحد ${THUMB_MAX_WORDS} على الصورة (تُقرأ على الهاتف في أقل من ثانية).`);
    const dup = repeatsTitle(text, ctx.titles);
    if (dup) err(where, `يكرر العنوان «${dup}»؛ الصورة تضيف فكرة لا يقولها العنوان.`);
    if (c.kind === "question" && words.length && !/[؟?]\s*$/.test(text)) err(where, "السؤال ينتهي بـ«؟».", `${text}؟`);
    if (c.kind !== "question" && /[؟?]\s*$/.test(text)) warn(where, "ينتهي بـ«؟» وهو ليس غلاف السؤال؛ الأفضل فكرة مختلفة عنه.");
    for (const b of CLICKBAIT) if (norm(text).includes(b)) err(where, "إثارة لا تليق بهوية القناة.");
    const hits = findTraces(text);
    if (hits.length) err(where, `أثر أدوات الإنتاج: ${hits.join("، ")}.`);
    if (words.length) {
      const k = words.join(" ");
      if (seen.has(k)) err(where, `النص نفسه في غلاف «${THUMB_KIND_LABEL[seen.get(k)!]}»؛ كل غلاف فكرة مختلفة.`);
      seen.set(k, c.kind);
    }
    if (c.kind === "scene") {
      if (!c.sceneId) err(where, "اختر المشهد الذي تُؤخذ منه اللقطة.");
      else if (ctx.scenes) {
        const s = sceneById.get(c.sceneId);
        if (!s) err(where, `المشهد ${c.sceneId} ليس في خطة الحلقة.`);
        else if (s.sacred) err(where, `المشهد ${c.sceneId} مشهد آية أو بسملة أو دعاء؛ لا يُستعمل غلافًا.`);
      }
      if (c.atSeconds !== undefined && !(Number.isFinite(c.atSeconds) && c.atSeconds >= 0)) err(where, "لحظة اللقطة غير صالحة.");
    }
  }
  return out;
};

/**
 * اقتراح أولي من الحلقة نفسها، لا يُعتمد وحده: سؤال الحلقة الأقصر الذي يُقرأ وحده (≤ ٣ كلمات بعد حذف واو/فاء العطف)،
 * ومشهد من وسط الحلقة ليس آية. كلمة «العنوان» لا تُخترع آليًا: تبقى فارغة ليكتبها المالك (أو Claude للحلقة بعناية).
 */
export const suggestThumbnails = (input: {
  titles: string[];
  scenes: { id: string; narration: string; sacred: boolean }[];
}): ThumbnailConcept[] => {
  const questions = input.scenes
    .filter((s) => !s.sacred)
    .flatMap((s) => s.narration.split(/(?<=[؟?])\s+|(?<=[.!…])\s+/))
    .map((q) => q.trim())
    .filter((q) => /[؟?]$/.test(q))
    .map((q) => q.replace(/^(?:[وف])(?=\S{3,})/, "").replace(/^(?:ولكن|لكن|ثم)\s+/, ""))
    .filter((q) => {
      const n = thumbnailWords(q).length;
      return n >= 2 && n <= THUMB_MAX_WORDS && !repeatsTitle(q, input.titles);
    })
    .sort((a, b) => thumbnailWords(a).length - thumbnailWords(b).length || a.length - b.length);
  const usable = input.scenes.filter((s) => !s.sacred && s.narration.trim());
  const mid = usable[Math.floor(usable.length * 0.4)] ?? usable[0];
  return [
    { kind: "title", text: "" },
    { kind: "scene", text: "", ...(mid ? { sceneId: mid.id } : {}) },
    { kind: "question", text: questions[0] ?? "" },
  ];
};

/** لحظة اللقطة: ما حدده المالك، وإلا ٦٠٪ من المشهد (بعد دخول عناصره وقبل خروجها)، داخل حدوده دائمًا. */
export const frameTimeFor = (durationSec: number, at?: number): number => {
  const d = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
  const pick = at !== undefined && Number.isFinite(at) && at >= 0 ? at : d * 0.6;
  return Math.round(Math.max(0, Math.min(pick, Math.max(0, d - 0.1))) * 1000) / 1000;
};

/** ملف الغلاف رقم n: الترتيب ثابت (١ عنوان، ٢ مشهد، ٣ سؤال)، فيبقى اسم كل ملف لفكرته في «Test & Compare». */
export const conceptOrder = (concepts: ThumbnailConcept[]) =>
  THUMB_KINDS.map((k) => concepts.find((c) => c.kind === k)).filter((c): c is ThumbnailConcept => Boolean(c));

/** ما يُرسم الآن وما هو موقوف (KI-120)، بترتيب الملفات الثابت؛ style أسلوب مصغّرة القناة (brand.thumbnail). */
export const renderableConcepts = (concepts: ThumbnailConcept[], style?: string) => {
  const hold = thumbHoldFor(style);
  const all = conceptOrder(concepts);
  return { render: all.filter((c) => !hold[c.kind]), held: all.filter((c) => hold[c.kind]) };
};
