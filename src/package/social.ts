import { parseScript } from "../script/parse";
import { normalizeArabic } from "../script/quranMeta";
import { chapterStarts } from "../remotion/scenes/Episode";
import type { EpisodeMedia } from "../plan/media";
import type { Plan } from "../plan/types";
import { defaultChannel, type ChannelConfig } from "../channel/types";

/**
 * «حزمة الانتشار»: عناوين وأوصاف وكابشن وهاشتاجات لكل منصة، لكل حلقة وكل شورت.
 * تُحفظ في publish.json بجوار السكريبت (تُعدَّل من الاستوديو، أو يكتبها Claude بعناية لكل حلقة)،
 * وهذا الملف يولّد نسخة أولى آلية من السكريبت حين لا توجد.
 */
export type Platform = "youtube" | "youtubeShorts" | "instagram" | "facebook";

export type TitleIdea = { text: string; angle: string };
export type LongKit = {
  titles: TitleIdea[];
  description: string;
  tags: string[];
  hashtags: string[];
  pinnedComment: string;
  thumbnailTexts: string[];
  /** كابشن منشور الحلقة على فيسبوك (فيديو طويل) */
  facebook: string;
};
export type ShortKit = {
  chapter: number;
  hook: string;
  youtube: { title: string; description: string; hashtags: string[] };
  instagram: { caption: string; hashtags: string[] };
  facebook: { caption: string; hashtags: string[] };
};
/** يُكتب في الوصف ويُستبدل بتوقيت الفصول الحقيقي (يتغير بعد تسجيل الصوت). */
export const CHAPTERS_TOKEN = "{{الفصول}}";
export const chaptersText = (plan: Plan, media?: EpisodeMedia) => ["فصول الحلقة:", ...chapterStarts(plan, media).map((s) => `${clock(s.start)} ${s.title}`)].join("\n");
export const resolveDescription = (desc: string, chapters: string) => desc.replace(CHAPTERS_TOKEN, chapters);

export type PublishKit = { version: 1; generatedBy: "auto" | "claude" | "edited"; updatedAt: string; long: LongKit; shorts: ShortKit[] };

/**
 * قواعد المنصات (مراجعة في أكتوبر 2026). تُستخدم في الفحص داخل الاستوديو.
 * - يوتيوب: العنوان حتى 100 حرف ويظهر نحو 60–70 في نتائج البحث؛ أول ~150 حرفًا من الوصف تظهر قبل «المزيد»؛
 *   أول 3 هاشتاجات تظهر فوق العنوان، وأكثر من 15 يجعل يوتيوب يتجاهلها كلها؛ الفصول تحتاج 0:00 وثلاثة فصول على الأقل.
 * - الشورتس: عنوان قصير يبدأ بالكلمة المفتاحية (يُقرأ منه ~40 حرفًا على الهاتف)، والهاشتاجات في الوصف.
 * - إنستجرام: حد أقصى 5 هاشتاجات (منذ ديسمبر 2025)، والبحث يعتمد على كلمات الكابشن والنص على الشاشة؛ أول ~125 حرفًا قبل «المزيد».
 * - فيسبوك: كابشن قصير بسؤال يفتح التعليقات، و1–3 هاشتاجات متخصصة.
 */
export const RULES = {
  youtube: { titleMax: 100, titleVisible: 70, descFold: 150, hashtagsShown: 3, hashtagsMax: 15, tagsChars: 500 },
  youtubeShorts: { titleMax: 100, titleVisible: 45, hashtagsMax: 5 },
  instagram: { captionMax: 2200, fold: 125, hashtagsMax: 5 },
  facebook: { fold: 125, hashtagsMax: 3 },
} as const;

export type Check = { ok: boolean; label: string };

const len = (s: string) => Array.from(s).length;
const firstLine = (s: string) => s.split("\n").find((l) => l.trim()) ?? "";
const containsKeyword = (s: string, keywords: string[]) => {
  const n = normalizeArabic(s);
  return keywords.some((k) => k && n.includes(normalizeArabic(k)));
};

/** فحوص سريعة لما سيظهر للمشاهد ولما تقرؤه الخوارزمية. */
export const checkTitle = (title: string, platform: "youtube" | "youtubeShorts", keywords: string[]): Check[] => {
  const r = RULES[platform];
  return [
    { ok: len(title) > 0 && len(title) <= r.titleVisible, label: `الطول ${len(title)}/${r.titleVisible}` },
    { ok: containsKeyword(title.slice(0, platform === "youtubeShorts" ? 40 : 60), keywords), label: "كلمة بحث في أوله" },
    { ok: !/#/.test(title) || platform === "youtubeShorts", label: "بلا هاشتاج في العنوان" },
  ];
};
export const checkDescription = (desc: string, keywords: string[], hashtags: string[]): Check[] => [
  { ok: containsKeyword(desc.slice(0, RULES.youtube.descFold), keywords), label: "كلمة بحث قبل «المزيد»" },
  { ok: /(^|\n)0:00 /.test(desc) && (desc.match(/(^|\n)\d+:\d\d /g) ?? []).length >= 3, label: "فصول بتوقيت" },
  { ok: hashtags.length >= 1 && hashtags.length <= RULES.youtube.hashtagsMax, label: `هاشتاجات ${hashtags.length} (يظهر أول 3)` },
];
export const checkCaption = (caption: string, hashtags: string[], platform: "instagram" | "facebook", keywords: string[]): Check[] => {
  const r = RULES[platform];
  return [
    { ok: len(firstLine(caption)) <= r.fold && len(firstLine(caption)) > 0, label: `السطر الأول ${len(firstLine(caption))}/${r.fold}` },
    { ok: containsKeyword(caption, keywords), label: "كلمات بحث في الكابشن" },
    { ok: /[؟?]/.test(caption), label: "سؤال يفتح التعليقات" },
    { ok: hashtags.length <= r.hashtagsMax && hashtags.length > 0, label: `هاشتاجات ${hashtags.length}/${r.hashtagsMax}` },
  ];
};

const STOP = new Set(
  ["هذا", "هذه", "ذلك", "التي", "الذي", "الذين", "على", "إلى", "الى", "عن", "من", "في", "كان", "كانت", "يكون", "تكون", "ليس", "لكن", "حتى", "أننا", "أنه", "أنها", "أنك", "لأن", "عندما", "حين", "كل", "بعض", "أحيانًا", "دائمًا", "فقط", "أيضًا", "نحن", "أنت", "قد", "لقد", "بل", "ثم", "هناك", "هنا", "مما", "عما", "بين", "أمام", "فعلًا", "تمامًا", "نفسه", "نفسها", "شيء", "شيئًا", "يمكن", "ماذا", "لماذا", "كيف", "هل", "أم", "أو", "ولا", "وهذا", "وهنا", "تخيل", "تأمل", "الله", "اللهم", "أرنا", "ارزقنا", "وارزقنا", "تعرف", "نعرف", "يعرف", "نقول", "يقول"].map(normalizeArabic),
);

/** أكثر الكلمات تكرارًا في التعليق والعناوين (كلمات بحث مرشحة). */
export const keywordsOf = (text: string, extra: string[] = [], max = 8): string[] => {
  const counts = new Map<string, { w: string; n: number }>();
  for (const raw of text.split(/\s+/)) {
    const w = raw.replace(/[^\p{L}]/gu, "");
    const n = normalizeArabic(w).replace(/^(و|ف)(?=...)/, "").replace(/^(بال|وال|فال|لل)(?=..)/, "ال");
    if (Array.from(n).length < 4 || STOP.has(n)) continue;
    const c = counts.get(n) ?? { w: w.replace(/^(و|ف)(?=...)/, ""), n: 0 };
    c.n++;
    counts.set(n, c);
  }
  // الأسماء المعرّفة («الحق»، «الباطل») أقوى ككلمات بحث من الأفعال؛ والكلمة غير المعرّفة تحتاج تكرارًا
  const scored = [...counts.entries()]
    .map(([n, c]) => ({ w: c.w, score: c.n * (n.startsWith("ال") ? 2 : 1), ok: n.startsWith("ال") || c.n >= 2 }))
    .filter((x) => x.ok);
  const top = scored.sort((a, b) => b.score - a.score).map((c) => c.w);
  return [...new Set([...extra, ...top])].slice(0, max);
};

const hashtag = (s: string) => `#${s.trim().replace(/^#/, "").replace(/\s+/g, "_")}`;
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const sentences = (t: string) => t.split(/(?<=[.؟?!])\s+/).map((s) => s.trim()).filter(Boolean);
const clip = (s: string, n: number) => (len(s) <= n ? s : `${Array.from(s).slice(0, n - 1).join("").replace(/\s+\S*$/, "")}…`);

/** نسخة أولى آلية من السكريبت والخطة. */
export const generatePublishKit = (plan: Plan, script: string, media: EpisodeMedia | undefined, channel: ChannelConfig = defaultChannel): PublishKit => {
  const parsed = parseScript(script);
  const fm = (parsed.frontmatter ?? {}) as { title?: string; alt_titles?: string[] };
  const narr = (n: number) => plan.chapters.find((c) => c.number === n)?.scenes.map((s) => s.narration).filter(Boolean).join(" ") ?? "";
  const all = plan.chapters.map((c) => `${c.title} ${narr(c.number)}`).join(" ");
  const domainTags = channel.domains[plan.domain]?.tags ?? [];
  const keywords = keywordsOf(`${plan.title} ${plan.title} ${all}`, [], 8);
  const tagsBase = [...new Set([...keywords, ...domainTags, ...channel.youtube.tags])];
  const hashtags = [...new Set([channel.youtube.tags[0] ?? channel.name, ...keywords.slice(0, 2), ...domainTags.slice(0, 1)])].filter(Boolean).slice(0, 4).map(hashtag);
  const step = parsed.practicalStep?.text ?? "";
  const hook = sentences(narr(1))[0] ?? plan.title;

  const titles: TitleIdea[] = [
    { text: plan.title, angle: "العنوان الأساسي (سؤال)" },
    ...(fm.alt_titles ?? []).filter(Boolean).map((t, i) => ({ text: t, angle: ["زاوية التحدي", "زاوية الفضول", "زاوية الحل"][i] ?? "بديل" })),
  ];

  const description = [
    clip(hook, 140),
    `في هذه الحلقة: ${plan.chapters.slice(1, 4).map((c) => c.title.replace(/[؟?]$/, "")).join("، ")}.`,
    "",
    CHAPTERS_TOKEN,
    "",
    step ? `الخطوة العملية: ${step}` : "",
    "",
    channel.youtube.voiceDisclosure,
    "",
    hashtags.join(" "),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const shorts: ShortKit[] = plan.chapters.slice(0, 6).map((c) => {
    const text = narr(c.number);
    const ss = sentences(text);
    const q = ss.find((s) => /[؟?]$/.test(s));
    const first = ss[0] ?? c.title;
    const kw = keywordsOf(`${c.title} ${text}`, [], 4);
    const tags = [...new Set([...kw.slice(0, 2), ...domainTags.slice(0, 1), channel.youtube.tags[0] ?? ""])].filter(Boolean);
    const title = clip(/[؟?]$/.test(c.title) ? c.title : q ?? c.title, 60);
    const value = ss.slice(1, 3).join(" ");
    const ask = q && q !== first ? q : "ما رأيك؟ اكتب في التعليقات.";
    return {
      chapter: c.number,
      hook: clip(first, 90),
      youtube: { title, description: `${clip(first, 140)}\n\nالحلقة كاملة على القناة.\n\n${tags.slice(0, 3).map(hashtag).join(" ")}`, hashtags: tags.slice(0, 3).map(hashtag) },
      instagram: { caption: `${clip(first, 120)}\n\n${clip(value, 300)}\n\n${ask}\n\nاحفظه لترجع له، وأرسله لمن يحتاجه.`, hashtags: tags.slice(0, 5).map(hashtag) },
      facebook: { caption: `${clip(first, 120)}\n\n${ask}`, hashtags: tags.slice(0, 2).map(hashtag) },
    };
  });

  return {
    version: 1,
    generatedBy: "auto",
    updatedAt: new Date().toISOString(),
    long: {
      titles,
      description,
      tags: tagsBase.filter((t, i, a) => a.join(",").length <= RULES.youtube.tagsChars || i < 10),
      hashtags,
      pinnedComment: step ? `${step}\n\nاكتب لنا تجربتك 👇` : `ما الفكرة التي توقفت عندها أكثر في الحلقة؟`,
      thumbnailTexts: [plan.title, ...(fm.alt_titles ?? [])].map((t) => clip(t, 28)).slice(0, 3),
      facebook: `${clip(hook, 120)}\n\n${plan.title}\n\nشاهد الحلقة كاملة، وشاركنا رأيك: ${step ? clip(step, 120) : ""}\n\n${hashtags.slice(0, 3).join(" ")}`,
    },
    shorts,
  };
};

/** كلمات البحث المستخدمة في الفحص (من الحلقة نفسها). */
export const kitKeywords = (plan: Plan): string[] =>
  keywordsOf(`${plan.title} ${plan.title} ${plan.chapters.map((c) => `${c.title} ${c.scenes.map((s) => s.narration).join(" ")}`).join(" ")}`, [], 10);

/** نسخة نصية للحزمة (تُضاف لملفات النشر). */
export const kitToMarkdown = (kit: PublishKit, title: string, chapters = ""): string => {
  const b = (s: string) => ["```", s, "```"].join("\n");
  const L = kit.long;
  const out = [
    `# حزمة الانتشار · ${title}`,
    "",
    "## يوتيوب: الحلقة",
    "",
    "### العناوين المقترحة",
    ...L.titles.map((t, i) => `${i + 1}. ${t.text} — ${t.angle}`),
    "",
    "### الوصف",
    b(resolveDescription(L.description, chapters)),
    "",
    "### الوسوم (Tags)",
    b(L.tags.join(", ")),
    "",
    "### تعليق مثبّت",
    b(L.pinnedComment),
    "",
    "### نص الصورة المصغّرة",
    ...L.thumbnailTexts.map((t) => `- ${t}`),
    "",
    "### فيسبوك: منشور الحلقة",
    b(L.facebook),
    "",
  ];
  for (const s of kit.shorts) {
    out.push(
      `## الشورت ${s.chapter}`,
      "",
      `**الخطاف (أول ثانيتين):** ${s.hook}`,
      "",
      "### يوتيوب شورتس",
      `**العنوان:** ${s.youtube.title}`,
      b(s.youtube.description),
      "",
      "### إنستجرام ريلز",
      b(`${s.instagram.caption}\n\n${s.instagram.hashtags.join(" ")}`),
      "",
      "### فيسبوك ريلز",
      b(`${s.facebook.caption}\n\n${s.facebook.hashtags.join(" ")}`),
      "",
    );
  }
  return out.join("\n");
};
