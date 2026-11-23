import { seriesPublish } from "../channel/series";
import { isSingleNarration } from "../script/divisions";
import type { ChannelInfo } from "../channel/types";
import { parseScript } from "../script/parse";
import { normalizeArabic } from "../script/quranMeta";
import { chapterTimeline, type RealTimings } from "./chapterTimes";
import { shortSegments } from "../plan/shorts";
import type { EpisodeMedia } from "../plan/media";
import type { Plan } from "../plan/types";
import { defaultChannel, type ChannelConfig } from "../channel/types";

/**
 * «حزمة الانتشار»: عناوين وأوصاف وكابشن وهاشتاجات لكل منصة، لكل حلقة وكل شورت.
 * تُحفظ في publish.json بجوار السكريبت (تُعدَّل من الاستوديو، أو يكتبها Claude بعناية لكل حلقة)،
 * وهذا الملف يولّد نسخة أولى آلية من السكريبت حين لا توجد.
 */
import { findTraces, traceCheck } from "./traces";
import { THUMB_KIND_LABEL, conceptOrder, type ThumbnailConcept } from "./thumbnails";
import { EPISODE_LINK_TOKEN, questionFrom, resolveEpisodeLink } from "./shortsLink";
import { chapterMarksText, sceneStartsFor, type ChapterMark } from "./chapters";
import { isGenericTitle, repeatedSentences, truncation } from "./quality";
import { withReviewerLine, type ReviewerCredit } from "./reviewer";

export type Platform = "youtube" | "youtubeShorts" | "instagram" | "facebook";

export type TitleIdea = { text: string; angle: string };
export type LongKit = {
  titles: TitleIdea[];
  description: string;
  tags: string[];
  hashtags: string[];
  pinnedComment: string;
  /** قديم: نصوص الصور قبل الأغلفة الثلاثة (تبقى للحلقات التي لم تُكتب أغلفتها) */
  thumbnailTexts: string[];
  /** الأغلفة الثلاثة: عنوان، مشهد، سؤال (src/package/thumbnails.ts) */
  thumbnails?: ThumbnailConcept[];
  /** كابشن منشور الحلقة على فيسبوك (فيديو طويل) */
  facebook: string;
  /** رابط الحلقة على يوتيوب بعد نشرها: يدخل وصف كل شورت (src/package/shortsLink.ts) */
  episodeUrl?: string;
  /** فصول يوتيوب: المشهد الذي يبدأ عنده كل فصل وعنوانه؛ الوقت من حدود المشاهد الحقيقية (src/package/chapters.ts) */
  chapters?: ChapterMark[];
  /** قائمة التشغيل من سلسلة الحلقة (plan.series) */
  playlist?: string;
  /** «راجعها علميًا»: اسم المراجع، ولا يظهر في الوصف ولا في آخر الفيديو إلا بإذنه المكتوب لهذه الحلقة (src/package/reviewer.ts) */
  reviewer?: ReviewerCredit;
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
/** Chapter lines from the real assembled timings when available, else the plan; never past the end (D36). */
export const chaptersText = (plan: Plan, media?: EpisodeMedia, channel?: ChannelInfo, real?: RealTimings, marks?: ChapterMark[]) => {
  // فصول اختارها المالك (ولو لنص متصل): من حدود المشاهد الحقيقية، ولا شيء إن كانت لن تظهر في يوتيوب
  if (marks?.length) return chapterMarksText(marks, sceneStartsFor(plan, media, channel, real));
  const starts = chapterTimeline(plan, media, channel, real).starts;
  // نص متصل أو قسم بلا عنوان: لا «فصول الحلقة» (لا سطر وقت بلا عنوان)
  if (!starts.length || starts.some((s) => !s.title.trim())) return "";
  return ["فصول الحلقة:", ...starts.map((s) => `${clock(s.start)} ${s.title}`)].join("\n");
};
/**
 * الوصف كما يُنشر: {{الفصول}} يُستبدل بالفصول. وصف بلا الرمز (حزمة قديمة لنص متصل) وفيه فصول: تُضاف بعد فقرته الأولى،
 * فلا تضيع فصول اختارها المالك لأن الحزمة كُتبت قبلها. وبلا فصول لا يبقى سطر فارغ زائد.
 */
export const resolveDescription = (desc: string, chapters: string, reviewer?: ReviewerCredit) => {
  const out = desc.includes(CHAPTERS_TOKEN)
    ? desc.replace(CHAPTERS_TOKEN, chapters)
    : chapters ? desc.replace(/^([\s\S]*?)(\n\n|$)/, (_, first: string, sep: string) => `${first}\n\n${chapters}${sep}`) : desc;
  // «راجعها علميًا» بإذن مكتوب مسجّل لهذه الحلقة وحدها؛ وبلا إذن لا يتغير الوصف
  return withReviewerLine(out.replace(/\n{3,}/g, "\n\n").trim(), reviewer);
};

/**
 * مصدر الحزمة: «auto» نسخة آلية من السكريبت، و«written» مكتوبة لهذه الحلقة، و«edited» عدّلها المالك.
 * القاعدة الأولى: لا اسم أداة ولو في حقل داخلي من publish.json، فبوابة المحتوى تقرأ كل نصوصه (رفضت «claude» في ٢٣ نوفمبر).
 */
export type KitSource = "auto" | "written" | "edited";
export type PublishKit = { version: 1; generatedBy: KitSource; updatedAt: string; long: LongKit; shorts: ShortKit[] };

/** مصدر الحزمة عند الحفظ من الاستوديو: الآلية تصير «معدّلة»، وأي قيمة أخرى غير معروفة (ومنها القديمة) تصير «مكتوبة». */
export const savedKitSource = (v: unknown): Exclude<KitSource, "auto"> => (v === "auto" || v === "edited" ? "edited" : "written");

/** كل نص في الحزمة بمساره، فيه أثر لأدوات الإنتاج (findTraces): الحفظ يُرفض قبل أن تصل إلى بوابة المحتوى. */
export const kitTraceHits = (kit: unknown): string[] => {
  const out: string[] = [];
  const walk = (v: unknown, at: string) => {
    if (typeof v === "string") for (const h of findTraces(v)) out.push(`${at || "الحزمة"}: «${h}»`);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, at ? `${at}.${k}` : k);
  };
  walk(kit, "");
  return out;
};

/**
 * قواعد المنصات (مراجعة في أكتوبر 2026). تُستخدم في الفحص داخل الاستوديو.
 * - يوتيوب: العنوان حتى 100 حرف ويظهر نحو 60–70 في نتائج البحث؛ أول ~150 حرفًا من الوصف تظهر قبل «المزيد»؛
 *   أول 3 هاشتاجات تظهر فوق العنوان، وأكثر من 15 يجعل يوتيوب يتجاهلها كلها؛ الفصول تحتاج 0:00 وثلاثة فصول على الأقل.
 * - الشورتس: عنوان قصير يبدأ بالكلمة المفتاحية (يُقرأ منه ~40 حرفًا على الهاتف)، والهاشتاجات في الوصف.
 * - إنستجرام: حد أقصى 5 هاشتاجات (منذ ديسمبر 2025)، والبحث يعتمد على كلمات الكابشن والنص على الشاشة؛ أول ~125 حرفًا قبل «المزيد».
 * - فيسبوك: كابشن قصير بسؤال يفتح التعليقات، و1–3 هاشتاجات متخصصة.
 */
export const RULES = {
  // العنوان ≤ ٦٠ حرفًا والموضوع في أول ٤٠ (قرار المالك ٢١ نوفمبر، المرحلة ٢ البند ٢)
  youtube: { titleMax: 100, titleVisible: 60, subjectWithin: 40, descFold: 150, hashtagsShown: 3, hashtagsMax: 15, tagsChars: 500 },
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
    { ok: containsKeyword(Array.from(title).slice(0, platform === "youtubeShorts" ? 40 : RULES.youtube.subjectWithin).join(""), keywords), label: platform === "youtube" ? "الموضوع في أول ٤٠ حرفًا" : "كلمة بحث في أوله" },
    { ok: !/#/.test(title) || platform === "youtubeShorts", label: "بلا هاشتاج في العنوان" },
    { ok: !isGenericTitle(title), label: "عنوان يقول شيئًا وحده" },
    { ok: !truncation(title), label: "عنوان تام" },
    traceCheck(title),
  ];
};
export const checkDescription = (desc: string, keywords: string[], hashtags: string[]): Check[] => [
  { ok: containsKeyword(desc.slice(0, RULES.youtube.descFold), keywords), label: "كلمة بحث قبل «المزيد»" },
  { ok: /(^|\n)0:00 /.test(desc) && (desc.match(/(^|\n)\d+:\d\d /g) ?? []).length >= 3, label: "فصول بتوقيت" },
  { ok: hashtags.length >= 1 && hashtags.length <= RULES.youtube.hashtagsMax, label: `هاشتاجات ${hashtags.length} (يظهر أول 3)` },
  { ok: !truncation(desc) && repeatedSentences(desc).length === 0, label: "بلا تكرار ولا بتر" },
  traceCheck(`${desc}\n${hashtags.join(" ")}`),
];
export const checkCaption = (caption: string, hashtags: string[], platform: "instagram" | "facebook", keywords: string[]): Check[] => {
  const r = RULES[platform];
  return [
    { ok: len(firstLine(caption)) <= r.fold && len(firstLine(caption)) > 0, label: `السطر الأول ${len(firstLine(caption))}/${r.fold}` },
    { ok: containsKeyword(caption, keywords), label: "كلمات بحث في الكابشن" },
    { ok: /[؟?]/.test(caption), label: "سؤال يفتح التعليقات" },
    { ok: !truncation(caption) && repeatedSentences(caption).length === 0, label: "بلا تكرار ولا بتر" },
    { ok: hashtags.length <= r.hashtagsMax && hashtags.length > 0, label: `هاشتاجات ${hashtags.length}/${r.hashtagsMax}` },
    traceCheck(`${caption}\n${hashtags.join(" ")}`),
  ];
};

const STOP = new Set(
  ["هذا", "هذه", "ذلك", "التي", "الذي", "الذين", "على", "إلى", "الى", "عن", "من", "في", "كان", "كانت", "يكون", "تكون", "ليس", "لكن", "حتى", "أننا", "أنه", "أنها", "أنك", "لأن", "عندما", "حين", "كل", "بعض", "أحيانًا", "دائمًا", "فقط", "أيضًا", "نحن", "أنت", "قد", "لقد", "بل", "ثم", "هناك", "هنا", "مما", "عما", "بين", "أمام", "فعلًا", "تمامًا", "نفسه", "نفسها", "شيء", "شيئًا", "يمكن", "ماذا", "لماذا", "كيف", "هل", "أم", "أو", "ولا", "وهذا", "وهنا", "تخيل", "تأمل", "الله", "اللهم", "أرنا", "ارزقنا", "وارزقنا", "تعرف", "نعرف", "يعرف", "نقول", "يقول",
    // صيغ التوقير ليست كلمات بحث (حزمة «دفاتر الزمن 001» الآلية وسمت «#السلام» و«#عليه» من «عليه السلام»)
    "عليه", "عليها", "عليهم", "السلام", "الصلاة", "وسلم", "صلى", "رضي", "عنه", "عنها", "عنهم", "تعالى", "سبحانه", "وتعالى", "رحمه"].map(normalizeArabic),
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
/** يقص النص عند آخر جملة تامة تسعها المساحة؛ ولا يقص وسط جملة إلا إن كانت الجملة الأولى وحدها أطول. */
const clip = (s: string, n: number) => {
  if (len(s) <= n) return s;
  let out = "";
  for (const x of sentences(s)) {
    if (len(out ? `${out} ${x}` : x) > n) break;
    out = out ? `${out} ${x}` : x;
  }
  return out || `${Array.from(s).slice(0, n - 1).join("").replace(/\s+\S*$/, "")}…`;
};

/** نسخة أولى آلية من السكريبت والخطة. */
export const generatePublishKit = (plan: Plan, script: string, media: EpisodeMedia | undefined, channel: ChannelConfig = defaultChannel): PublishKit => {
  const parsed = parseScript(script);
  const fm = (parsed.frontmatter ?? {}) as { title?: string; alt_titles?: string[] };
  const narr = (n: number) => plan.chapters.find((c) => c.number === n)?.scenes.map((s) => s.narration).filter(Boolean).join(" ") ?? "";
  const all = plan.chapters.map((c) => `${c.title} ${narr(c.number)}`).join(" ");
  const domainTags = channel.domains[plan.domain]?.tags ?? [];
  const keywords = keywordsOf(`${plan.title} ${plan.title} ${all}`, [], 8);
  const sp = seriesPublish(plan);
  const tagsBase = [...new Set([...sp.tags, ...keywords, ...domainTags, ...channel.youtube.tags])];
  const hashtags = [...new Set([channel.youtube.tags[0] ?? channel.name, ...keywords.slice(0, 2), ...domainTags.slice(0, 1)])].filter(Boolean).slice(0, 4).map(hashtag);
  const step = parsed.practicalStep?.text ?? "";
  const hook = sentences(narr(1))[0] ?? plan.title;

  const titles: TitleIdea[] = [
    { text: sp.title, angle: plan.series && sp.title !== plan.title ? `العنوان الأساسي بنمط «${plan.series.name}»` : "العنوان الأساسي (سؤال)" },
    ...(fm.alt_titles ?? []).filter(Boolean).map((t, i) => ({ text: t, angle: ["زاوية التحدي", "زاوية الفضول", "زاوية الحل"][i] ?? "بديل" })),
  ];

  const inThis = plan.chapters.slice(1, 4).map((c) => c.title.replace(/[؟?]$/, "").trim()).filter(Boolean);
  const description = [
    clip(hook, 140),
    ...(inThis.length ? [`في هذه الحلقة: ${inThis.join("، ")}.`] : []),
    // سرد واحد بلا أقسام (D87): لا مكان فصول في الوصف؛ وإن اختار المالك فصولًا تُضاف بعد الفقرة الأولى (resolveDescription)
    ...(isSingleNarration(plan.chapters) ? [] : ["", CHAPTERS_TOKEN]),
    "",
    step ? `الخطوة العملية: ${step}` : "",
    "",
    channel.youtube.footer,
    "",
    hashtags.join(" "),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // مقاطع الشورتس من الخطة (plan.shorts) لا من عدد الأقسام (src/plan/shorts.ts)
  const sceneById = new Map(plan.chapters.flatMap((ch) => ch.scenes).map((s) => [s.id, s]));
  const shorts: ShortKit[] = shortSegments(plan).segments.map((seg) => {
    const c = { number: seg.n, title: seg.title };
    const text = seg.sceneIds.map((id) => sceneById.get(id)?.narration ?? "").filter(Boolean).join(" ");
    const ss = sentences(text);
    const q = ss.find((s) => /[؟?]$/.test(s));
    const first = ss[0] ?? c.title;
    const kw = keywordsOf(`${c.title} ${text}`, [], 4);
    const tags = [...new Set([...kw.slice(0, 2), ...domainTags.slice(0, 1), channel.youtube.tags[0] ?? ""])].filter(Boolean);
    // العنوان: سؤال الفصل إن كان يقول شيئًا وحده (لا «لماذا؟»)، وإلا عنوان الفصل، وإلا أول جملة
    // كل شورت بعنوان سؤال (المرحلة ٢ البند ٣): سؤال المقطع نفسه أولًا، ثم عنوان المالك أو أول جملة ليراجعها
    const cands = [/[؟?]$/.test(c.title) ? c.title : "", questionFrom(text) ?? "", q ?? "", c.title, first].filter((t) => t && !isGenericTitle(t));
    const title = cands.find((t) => len(t) <= 60) ?? clip(cands[0] ?? `${c.title} | ${plan.title}`, 60);
    // القيمة بلا السؤال الذي يُختم به الكابشن (لا جملة مكررة)
    const value = ss.slice(1, 4).filter((x) => x !== q).slice(0, 2).join(" ");
    const ask = q && q !== first && !isGenericTitle(q) ? q : "ما رأيك؟ اكتب في التعليقات.";
    return {
      chapter: c.number,
      hook: clip(first, 90),
      youtube: { title, description: `${clip(first, 140)}\n\n${EPISODE_LINK_TOKEN}\n\n${tags.slice(0, 3).map(hashtag).join(" ")}`, hashtags: tags.slice(0, 3).map(hashtag) },
      instagram: { caption: `${clip(first, 240)}\n\n${clip(value, 300)}\n\n${ask}\n\nاحفظه لترجع له، وأرسله لمن يحتاجه.`, hashtags: tags.slice(0, 5).map(hashtag) },
      facebook: { caption: `${clip(first, 240)}\n\n${ask}\n\n${EPISODE_LINK_TOKEN}`, hashtags: tags.slice(0, 2).map(hashtag) },
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
      ...(sp.playlist ? { playlist: sp.playlist } : {}),
      facebook: `${clip(hook, 120)}\n\n${plan.title}\n\nشاهد الحلقة كاملة، وشاركنا رأيك: ${step ? clip(step, 240) : ""}\n\n${hashtags.slice(0, 3).join(" ")}`,
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
    ...(L.playlist ? ["", `### قائمة التشغيل`, L.playlist] : []),
    "",
    "### الوصف",
    b(resolveDescription(L.description, chapters, L.reviewer)),
    "",
    "### الوسوم (Tags)",
    b(L.tags.join(", ")),
    "",
    "### تعليق مثبّت",
    b(L.pinnedComment),
    "",
    ...(L.thumbnails
      ? ["### الأغلفة الثلاثة (Test & Compare)", ...conceptOrder(L.thumbnails).map((c, i) => `${i + 1}. ${THUMB_KIND_LABEL[c.kind]}: ${c.text.trim() || "(بلا كلمات)"}${c.kind === "scene" && c.sceneId ? ` — لقطة من ${c.sceneId}` : ""}`)]
      : ["### نص الصورة المصغّرة", ...L.thumbnailTexts.map((t) => `- ${t}`)]),
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
      b(resolveEpisodeLink(s.youtube.description, L.episodeUrl)),
      "",
      "### إنستجرام ريلز",
      b(`${s.instagram.caption}\n\n${s.instagram.hashtags.join(" ")}`),
      "",
      "### فيسبوك ريلز",
      b(`${resolveEpisodeLink(s.facebook.caption, L.episodeUrl)}\n\n${s.facebook.hashtags.join(" ")}`),
      "",
    );
  }
  return out.join("\n");
};
