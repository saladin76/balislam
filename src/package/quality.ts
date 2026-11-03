/**
 * فحص جودة حزمة النشر قبل التصدير: العناوين العامة، والتكرار، والنصوص المبتورة، والوسوم الضعيفة.
 * الخطأ يمنع الحزمة (مثل فحص الآثار)، والتنبيه يظهر في الاستوديو للمراجعة البشرية، ومع كل منهما اقتراح إن أمكن.
 */
import { normalizeArabic } from "../script/quranMeta";
import type { PublishKit } from "./social";

export type KitIssue = { level: "error" | "warning"; where: string; message: string; suggestion?: string };

const n = (s: string) => normalizeArabic(s).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const words = (s: string) => n(s).split(" ").filter(Boolean);

/** عناوين لا تقول شيئًا وحدها. */
const GENERIC = new Set(["لماذا", "كيف", "هل", "ماذا", "متى", "اين", "من", "ما", "هل تعلم", "شاهد", "شاهد للنهاية", "انتظر", "الحقيقة", "السر", "مهم", "مهم جدا", "فكرة", "سؤال", "الجزء الاول", "الجزء الثاني", "بداية", "النهاية", "الخلاصه", "الخلاصة", "مقدمه", "مقدمة"].map(n));
/** إثارة رخيصة لا تليق بهوية القنوات. */
const CLICKBAIT = ["لن تصدق", "صادم", "صدمه", "كارثه", "فضيحه", "لا يريدونك ان تعرف", "سيغير حياتك", "100%", "اقسم"].map(n);
/** كلمات لا تنتهي بها جملة تامة. */
const DANGLING = new Set(["و", "او", "ثم", "لكن", "بل", "في", "من", "علي", "عن", "الي", "الذي", "التي", "الذين", "ان", "لان", "حتي", "مع", "عند", "بين", "كما", "اذا", "لو", "قد", "لم", "لن", "هل"].map(n));
/** وسوم عامة لا تخدم البحث ولا الهوية. */
const WEAK_TAGS = new Set(["explore", "explorepage", "fyp", "foryou", "viral", "trend", "trending", "اكسبلور", "ترند", "لايك", "متابعه", "اشتراك", "shorts", "reels", "فيديو", "video"].map(n));

const sentencesOf = (t: string) => t.split(/(?<=[.؟?!…])\s+|\n+/).map((s) => s.trim()).filter((s) => words(s).length >= 3);

export const isGenericTitle = (t: string) => {
  const w = words(t);
  return w.length === 0 || GENERIC.has(w.join(" ")) || w.length < 3;
};

/** نص يبدو مبتورًا: ينتهي بحرف عطف أو جر، أو بعلامات تنصيص/أقواس غير مغلقة؛ والنقاط الثلاث تنبيه. */
export const truncation = (t: string): "error" | "warning" | null => {
  const s = t.replace(/(#\S+\s*)+$/u, "").trim();
  if (!s) return null;
  const opens = (s.match(/[«(“]/g) ?? []).length;
  const closes = (s.match(/[»)”]/g) ?? []).length;
  if (opens !== closes) return "error";
  const last = words(s.split("\n").filter((l) => l.trim()).pop() ?? "").pop() ?? "";
  if (DANGLING.has(last) && !/[.؟?!]$/.test(s)) return "error";
  if (/(…|\.\.\.)$/.test(s)) return "warning";
  return null;
};

/** جمل مكررة داخل النص نفسه. */
export const repeatedSentences = (t: string) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of sentencesOf(t)) {
    const k = n(s);
    if (seen.has(k)) out.push(s);
    seen.add(k);
  }
  return out;
};

export const kitIssues = (kit: PublishKit): KitIssue[] => {
  const out: KitIssue[] = [];
  const err = (where: string, message: string, suggestion?: string) => out.push({ level: "error", where, message, suggestion });
  const warn = (where: string, message: string, suggestion?: string) => out.push({ level: "warning", where, message, suggestion });

  const title = (where: string, t: string, fallback: string) => {
    if (!t.trim()) return err(where, "العنوان فارغ.", fallback || undefined);
    if (isGenericTitle(t)) err(where, `العنوان «${t}» عام جدًا لا يقول شيئًا وحده.`, fallback || undefined);
    for (const c of CLICKBAIT) if (n(t).includes(c)) warn(where, `في العنوان إثارة لا تليق بهوية القناة («${t}»).`);
    const tr = truncation(t);
    if (tr === "error") err(where, `العنوان يبدو مبتورًا: «${t}».`);
    else if (tr === "warning") warn(where, `العنوان مقصوص بنقاط حذف: «${t}»؛ الأفضل عنوان تام.`);
  };
  const text = (where: string, t: string) => {
    if (!t.trim()) return err(where, "النص فارغ.");
    const tr = truncation(t);
    if (tr === "error") err(where, "النص يبدو مبتورًا (ينتهي بكلمة ربط أو بعلامة تنصيص غير مغلقة).");
    else if (tr === "warning") warn(where, "النص ينتهي بنقاط حذف؛ الأفضل جملة تامة.");
    for (const s of repeatedSentences(t)) err(where, `جملة مكررة: «${s}».`);
  };
  const tags = (where: string, list: string[]) => {
    const seen = new Set<string>();
    for (const raw of list) {
      const t = raw.replace(/^#/, "");
      const k = n(t.replace(/_/g, " "));
      if (!k) continue;
      if (/\s/.test(raw.trim()) && raw.trim().startsWith("#")) err(where, `الهاشتاج «${raw}» فيه مسافة فينقطع؛ استعمل _ بين كلماته.`);
      if (seen.has(k)) err(where, `الوسم «${raw}» مكرر.`);
      if (WEAK_TAGS.has(k.replace(/\s/g, ""))) warn(where, `الوسم «${raw}» عام لا يخدم البحث ولا هوية القناة.`);
      if (Array.from(k.replace(/\s/g, "")).length < 3) warn(where, `الوسم «${raw}» قصير جدًا.`);
      seen.add(k);
    }
  };

  const L = kit.long;
  L.titles.forEach((t, i) => title(i === 0 ? "يوتيوب: العنوان" : `يوتيوب: العنوان البديل ${i}`, t.text, ""));
  const tt = L.titles.map((t) => n(t.text)).filter(Boolean);
  if (new Set(tt).size < tt.length) err("يوتيوب: العناوين", "عنوانان متطابقان؛ كل بديل يجب أن يكون زاوية مختلفة.");
  text("يوتيوب: الوصف", L.description);
  text("التعليق المثبّت", L.pinnedComment);
  text("فيسبوك: منشور الحلقة", L.facebook);
  tags("يوتيوب: الوسوم", L.tags);
  tags("يوتيوب: الهاشتاجات", L.hashtags);

  const shortTitles = new Map<string, number>();
  for (const s of kit.shorts) {
    const w = `الشورت ${s.chapter}`;
    title(`${w}: العنوان`, s.youtube.title, s.hook.replace(/[.،]$/, ""));
    const k = n(s.youtube.title);
    if (k && shortTitles.has(k)) err(`${w}: العنوان`, `العنوان نفسه في الشورت ${shortTitles.get(k)}؛ كل شورت يحتاج عنوانه.`);
    shortTitles.set(k, s.chapter);
    text(`${w}: وصف يوتيوب`, s.youtube.description);
    text(`${w}: إنستجرام`, s.instagram.caption);
    text(`${w}: فيسبوك`, s.facebook.caption);
    tags(`${w}: هاشتاجات إنستجرام`, s.instagram.hashtags);
    tags(`${w}: هاشتاجات يوتيوب`, s.youtube.hashtags);
  }
  const caps = kit.shorts.map((s) => n(s.instagram.caption));
  if (caps.length > 1 && new Set(caps).size < caps.length) warn("الشورتس", "كابشن إنستجرام نفسه في أكثر من شورت.");
  return out;
};

export const kitBlockMessage = (issues: KitIssue[]) => {
  const e = issues.filter((i) => i.level === "error");
  return `حزمة النشر فيها ${e.length} مشكلة تمنع التصدير (عدّلها من «النشر ← حزمة الانتشار»): ${e
    .slice(0, 5)
    .map((i) => `${i.where}: ${i.message}`)
    .join(" | ")}`;
};
