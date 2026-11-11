import { APPROVED_IDENTITIES, type ApprovedIdentity } from "../../brand/identity/approved";

/**
 * السلاسل والتصنيفات داخل القناة (طلب صاحب القناة، ١١ نوفمبر).
 * كل قناة تُقسَّم إلى سلاسل (حلقات مرتّبة) وتصنيفات (بلا ترتيب، وقد تحوي سلاسل)، ولكل واحدة:
 * - هوية فرعية مشتقة من هوية القناة المعتمدة وحدها (لا علامة جديدة): لون تمييز من لوحة القناة أو درجة محسوبة منه
 *   في حدود، وزخرفة من زخارف القناة، وخط عناوين القناة نفسه بأوزان وأحجام مسموحة، وافتتاحية القناة مع بطاقة السلسلة،
 *   وشارة السلسلة على الصورة المصغّرة بأسلوب القناة، وشعار صغير من أجزاء شعار القناة.
 * - قالب حلقات: افتراضيات تُختم في الحلقة لحظة إنشائها (`plan.series`)، فلا تتغير حلقة قائمة بتعديل القالب لاحقًا.
 * الملف `channels/<القناة>/series/<المعرّف>/series.json`. الوحدة نقية (للمتصفح وRemotion والخادم).
 */

export type SeriesKind = "series" | "category";
export const SERIES_KIND_AR: Record<SeriesKind, string> = { series: "سلسلة", category: "تصنيف" };
export type SeriesStatus = "active" | "archived";

/** «عام»: تصنيف يُنشأ لكل قناة عند الحاجة ولا يُكتب ملفه حتى يعدّله المالك؛ كل حلقة بلا سلسلة فيه. */
export const GENERAL_SLUG = "general";
export const GENERAL_NAME = "عام";
/** أقصى عمق للتداخل: تصنيف ← تصنيف ← سلسلة */
export const MAX_DEPTH = 3;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type TitleWeight = "regular" | "bold";
export type TitleSize = "s" | "m" | "l";
export type TitleOrnament = "none" | "rule" | "motif";
export type IntroVariant = "channel" | "sting" | "none";
export type ThumbBadge = "none" | "band" | "corner";

/** ما يختاره المالك لهوية السلسلة؛ كل حقل يُقصّ إلى قواعد هوية القناة في `deriveSeriesIdentity`. */
export type SeriesIdentityOverrides = {
  /** لون من لوحة القناة (hex)، ومعه إزاحة الإضاءة (−0.15…0.15) ونسبة التشبّع (0.8…1.15) */
  accent?: { base?: string; lightness?: number; chroma?: number };
  /** زخرفة من زخارف القناة */
  motif?: string;
  title?: { weight?: TitleWeight; size?: TitleSize; ornament?: TitleOrnament };
  /** «sting»: بطاقة السلسلة بعد افتتاحية القناة */
  intro?: IntroVariant;
  thumbnail?: { badge?: ThumbBadge };
  /** شعار السلسلة: جزءان على الأكثر من أجزاء شعار القناة */
  emblem?: { parts?: string[] };
};

export type DerivedSeriesIdentity = {
  channel: string;
  accent: string;
  accentBase: string;
  /** لون الحبر فوق لون التمييز */
  onAccent: string;
  /** لون الورق/الخلفية والحبر من لوحة القناة (للبطاقة والشارة) */
  paper: string;
  ink: string;
  /** البطاقة والسطح بأسلوب القناة: داكنة (المحراب والأفق) أو ورقة بيضاء (القلم المميِّز) */
  card: { bg: string; ink: string };
  motif: string;
  fonts: ApprovedIdentity["fonts"];
  title: { weight: TitleWeight; size: TitleSize; ornament: TitleOrnament };
  intro: IntroVariant;
  thumbnail: { badge: ThumbBadge };
  emblem: { base: string; parts: string[] };
  /** ما قُصَّ أو رُفض من الاختيارات (للعرض في الاستوديو) */
  clamped: string[];
};

export type SeriesTemplate = {
  /** «channel»: قالب القناة (مع عناوين الفصول أدناه)؛ «series»: templates/<القناة>/series/<المعرّف>/script.md إن وُجد */
  script?: { source?: "channel" | "series" };
  /** أساليب من أساليب القناة (channel.styles) تتناوب عليها حلقات السلسلة */
  styles?: string[];
  /** عائلات اللقطات: قوالب من مكتبة القناة وحدها */
  shots?: string[];
  /** النبرة الافتراضية لحلقات السلسلة (من نبرات الصوت) */
  tone?: string;
  pacing?: { wordsPerMinute?: number; chapterSeconds?: number };
  chapters?: { count?: number; titles?: string[] };
  intro?: IntroVariant;
  outro?: "channel" | "none";
  thumbnail?: { layout?: "channel" | "badge" };
  publish?: { titlePattern?: string; tags?: string[]; playlist?: string };
};

export type SeriesConfig = {
  version: 1;
  id: string;
  name: string;
  kind: SeriesKind;
  parent?: string;
  description?: string;
  order?: number;
  status?: SeriesStatus;
  identity?: SeriesIdentityOverrides;
  template?: SeriesTemplate;
  /** يُنشأ آليًا («عام») ولم يُكتب ملفه بعد */
  virtual?: boolean;
};

/** ما يُختم في خطة الحلقة لحظة إنشائها (لا يتغير بتعديل السلسلة لاحقًا) */
export type SeriesStamp = {
  id: string;
  name: string;
  kind: SeriesKind;
  /** رقم الحلقة في السلسلة (للسلاسل المرتّبة) */
  number?: number;
  identity: DerivedSeriesIdentity;
  template: SeriesTemplate;
  stampedAt: string;
};

/** أجزاء شعار كل قناة (باسم الشعار المعتمد لا باسم القناة)، والألوان المحجوزة التي لا تصير لون سلسلة. */
export const EMBLEM_PARTS: Record<string, { parts: { id: string; nameAr: string }[]; reservedAccents?: string[]; card?: "dark" | "light" }> = {
  mihrab: { parts: [{ id: "arch", nameAr: "قوس المحراب" }, { id: "sun", nameAr: "نقطة الشمس" }, { id: "seal", nameAr: "الختم" }, { id: "star8", nameAr: "النجمة الثمانية" }] },
  "horizon-book": { parts: [{ id: "book", nameAr: "الدفتر المفتوح" }, { id: "hourglass", nameAr: "الساعة الرملية" }, { id: "sun", nameAr: "شمس الغروب" }, { id: "ribbon", nameAr: "شريط التاريخ" }] },
  // الفسفوري للفكرة وحدها («idea-only»): لا يصير لون سلسلة ولا شارة
  "highlighter-z": { parts: [{ id: "card", nameAr: "بطاقة الكتاب" }, { id: "bar", nameAr: "ضربة القلم" }, { id: "sticky", nameAr: "الورقة اللاصقة" }, { id: "counter", nameAr: "عدّاد الأفكار" }], reservedAccents: ["#E8F542"], card: "light" },
};

export const MOTIF_AR: Record<string, string> = { arches: "الأقواس", girih: "النجمة الثمانية (گره)", stars: "النجوم", horizon: "خط الأفق", "ink-lines": "خطوط الحبر", ruled: "سطور الدفتر" };

export const LIMITS = { lightness: 0.15, chromaMin: 0.8, chromaMax: 1.15, emblemParts: 2 } as const;

// ———————————————————— ألوان ————————————————————
const norm = (h: string) => h.trim().toUpperCase();
const isHex = (h: unknown): h is string => typeof h === "string" && /^#[0-9A-Fa-f]{6}$/.test(h.trim());
const toRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
export const hexToHsl = (h: string): [number, number, number] => {
  const [r, g, b] = toRgb(h);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue / 6, s, l];
};
export const hslToHex = (hh: number, s: number, l: number): string => {
  if (s === 0) return toHex(l, l, l);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    return x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p;
  };
  return toHex(f(hh + 1 / 3), f(hh), f(hh - 1 / 3));
};
const luminance = (h: string) => {
  const [r, g, b] = toRgb(h).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
};
const clampN = (v: unknown, lo: number, hi: number, dflt: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);

/** ألوان كل القنوات المعتمدة الأخرى (لوحتها وبصمتها ومشتقاتها): لا تظهر في سلسلة هذه القناة. */
export const foreignColours = (channelId: string): Set<string> =>
  new Set(Object.entries(APPROVED_IDENTITIES).filter(([id]) => id !== channelId).flatMap(([, a]) => [...a.palette.map((p) => p.hex), ...a.signature, ...a.derived]).map(norm));

/** ألوان اللوحة المسموحة أساسًا للون السلسلة */
export const accentChoices = (a: ApprovedIdentity): string[] => {
  const reserved = new Set((EMBLEM_PARTS[a.emblem]?.reservedAccents ?? []).map(norm));
  return a.palette.map((p) => norm(p.hex)).filter((h) => !reserved.has(h));
};

/** درجة من لون اللوحة بإزاحة إضاءة ونسبة تشبّع داخل الحدود */
export const shade = (base: string, lightness = 0, chroma = 1): string => {
  const [h, s, l] = hexToHsl(norm(base));
  const dl = clampN(lightness, -LIMITS.lightness, LIMITS.lightness, 0);
  const dc = clampN(chroma, LIMITS.chromaMin, LIMITS.chromaMax, 1);
  if (dl === 0 && dc === 1) return norm(base);
  return hslToHex(h, Math.min(1, s * dc), Math.min(0.97, Math.max(0.03, l + dl)));
};

/**
 * هل اللون من هوية القناة: من لوحتها أو بصمتها أو مشتقاتها، أو درجة من لون في لوحتها داخل الحدود
 * (نفس الصبغة تقريبًا، وإضاءة وتشبّع في المدى المسموح)، وليس لونًا لقناة أخرى.
 */
export const colourAllowed = (channelId: string, hex: string): boolean => {
  const a = APPROVED_IDENTITIES[channelId];
  if (!a || !isHex(hex)) return false;
  const h = norm(hex);
  if (foreignColours(channelId).has(h)) return false;
  const own = new Set([...a.palette.map((p) => p.hex), ...a.signature, ...a.derived].map(norm));
  if (own.has(h)) return true;
  const [hh, s, l] = hexToHsl(h);
  return accentChoices(a).some((b) => {
    const [bh, bs, bl] = hexToHsl(b);
    const dh = Math.min(Math.abs(hh - bh), 1 - Math.abs(hh - bh));
    return dh <= 0.02 && Math.abs(l - bl) <= LIMITS.lightness + 0.01 && s <= Math.min(1, bs * LIMITS.chromaMax) + 0.02 && s >= bs * LIMITS.chromaMin - 0.02;
  });
};

const pick = <T extends string>(v: unknown, allowed: readonly T[], dflt: T): T => (allowed.includes(v as T) ? (v as T) : dflt);

/**
 * يشتق هوية السلسلة من هوية القناة المعتمدة ويقصّ كل اختيار إلى قواعدها:
 * لا لون خارج لوحة القناة ودرجاتها، ولا زخرفة ولا خط ولا جزء شعار من خارجها، ولا لون لقناة أخرى.
 */
export const deriveSeriesIdentity = (channel: ApprovedIdentity & { id?: string } | string, overrides: SeriesIdentityOverrides = {}): DerivedSeriesIdentity => {
  const channelId = typeof channel === "string" ? channel : channel.id ?? Object.entries(APPROVED_IDENTITIES).find(([, x]) => x === channel)?.[0] ?? "";
  const a = typeof channel === "string" ? APPROVED_IDENTITIES[channel] : channel;
  if (!a) throw new Error(`لا هوية معتمدة للقناة «${channelId}»؛ السلاسل تُشتق من هوية معتمدة فقط.`);
  const clamped: string[] = [];
  const choices = accentChoices(a);
  const wantBase = overrides.accent?.base ? norm(overrides.accent.base) : undefined;
  const base = wantBase && choices.includes(wantBase) ? wantBase : choices.find((c) => a.signature.map(norm).includes(c)) ?? choices[0]!;
  if (wantBase && wantBase !== base) clamped.push(`اللون ${wantBase} ليس من لوحة القناة المسموحة؛ استُعمل ${base}.`);
  const lw = overrides.accent?.lightness, cw = overrides.accent?.chroma;
  if (typeof lw === "number" && Math.abs(lw) > LIMITS.lightness) clamped.push("إزاحة الإضاءة قُصّت إلى حدود هوية القناة.");
  if (typeof cw === "number" && (cw < LIMITS.chromaMin || cw > LIMITS.chromaMax)) clamped.push("التشبّع قُصّ إلى حدود هوية القناة.");
  let accent = shade(base, lw, cw);
  if (!colourAllowed(channelId, accent)) { clamped.push("الدرجة المحسوبة خرجت عن هوية القناة؛ استُعمل لون اللوحة نفسه."); accent = base; }
  const paletteHex = a.palette.map((p) => norm(p.hex));
  const byLum = [...paletteHex].sort((x, y) => luminance(y) - luminance(x));
  const light = byLum[0]!, dark = byLum[byLum.length - 1]!;
  const onAccent = contrast(accent, dark) >= contrast(accent, light) ? dark : light;
  const motif = pick(overrides.motif, a.motifs, a.motifs[0]!);
  if (overrides.motif && overrides.motif !== motif) clamped.push(`الزخرفة «${overrides.motif}» ليست من زخارف القناة.`);
  const allParts = (EMBLEM_PARTS[a.emblem]?.parts ?? []).map((p) => p.id);
  const wantParts = overrides.emblem?.parts ?? [];
  const parts = [...new Set(wantParts.filter((p) => allParts.includes(p)))].slice(0, LIMITS.emblemParts);
  if (wantParts.length && parts.length !== wantParts.length) clamped.push("أجزاء الشعار من شعار القناة فقط، وجزءان على الأكثر.");
  return {
    channel: channelId,
    accent,
    accentBase: base,
    onAccent,
    paper: light,
    ink: dark,
    card: EMBLEM_PARTS[a.emblem]?.card === "light" ? { bg: light, ink: dark } : { bg: dark, ink: light },
    motif,
    // خط القناة نفسه دائمًا: لا خط جديد للسلسلة
    fonts: { ...a.fonts },
    title: {
      weight: pick(overrides.title?.weight, ["regular", "bold"] as const, "bold"),
      size: pick(overrides.title?.size, ["s", "m", "l"] as const, "m"),
      ornament: pick(overrides.title?.ornament, ["none", "rule", "motif"] as const, "rule"),
    },
    intro: pick(overrides.intro, ["channel", "sting", "none"] as const, "sting"),
    thumbnail: { badge: pick(overrides.thumbnail?.badge, ["none", "band", "corner"] as const, "band") },
    emblem: { base: a.emblem, parts: parts.length ? parts : allParts.slice(0, 1) },
    clamped,
  };
};

// ———————————————————— التحقق والتداخل ————————————————————
export type SeriesContext = {
  channelId: string;
  /** أساليب القناة (channel.styles) */
  styles: string[];
  /** قوالب مكتبة القناة (channelLibrary(...).templates) */
  templates: string[];
  /** النبرات المعروفة */
  tones: string[];
  /** فحص آثار أدوات الإنتاج لما يُنشر (src/package/traces.ts → findTraces) */
  traces?: (text: string) => string[];
};

const byId = (all: SeriesConfig[]) => new Map(all.map((s) => [s.id, s]));

/** سلسلة الآباء من الأعلى إلى العنصر نفسه */
export const ancestry = (id: string, all: SeriesConfig[]): string[] => {
  const m = byId(all);
  const out: string[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = id;
  while (cur && m.has(cur) && !seen.has(cur)) { seen.add(cur); out.unshift(cur); cur = m.get(cur)!.parent; }
  return out;
};
export const depthOf = (id: string, all: SeriesConfig[]) => ancestry(id, all).length;

/** يرفض ما يخالف النموذج: المعرّف والاسم والنوع والأب والتداخل والعمق وقالب الحلقات. */
export const validateSeries = (s: SeriesConfig, all: SeriesConfig[], ctx: SeriesContext): string[] => {
  const e: string[] = [];
  if (!SLUG_RE.test(s.id ?? "")) e.push("معرّف السلسلة بالإنجليزية الصغيرة والأرقام والشرطات فقط (مثل ramadan-nights).");
  if (!s.name?.trim()) e.push("اسم السلسلة مطلوب.");
  if (s.name && s.name.trim().length > 40) e.push("اسم السلسلة أطول من ٤٠ حرفًا.");
  if (s.kind !== "series" && s.kind !== "category") e.push("النوع «سلسلة» أو «تصنيف».");
  if (s.status && s.status !== "active" && s.status !== "archived") e.push("الحالة نشطة أو مؤرشفة.");
  const others = all.filter((x) => x.id !== s.id);
  const dup = others.find((x) => x.name.trim() === s.name?.trim());
  if (dup) e.push(`الاسم «${s.name}» مستعمل لـ«${dup.id}».`);
  if (s.parent) {
    const m = byId([...others, s]);
    const p = m.get(s.parent);
    if (!p) e.push(`الأب «${s.parent}» غير موجود.`);
    else if (p.kind !== "category") e.push("السلسلة لا تحوي غيرها؛ الأب يجب أن يكون تصنيفًا.");
    if (s.parent === s.id || ancestry(s.parent, [...others, s]).includes(s.id)) e.push("لا يكون العنصر أبًا لنفسه ولا لأحد آبائه.");
    else {
      const depth = ancestry(s.parent, [...others, s]).length + 1;
      const below = (id: string): number => Math.max(0, ...others.filter((x) => x.parent === id).map((x) => 1 + below(x.id)));
      if (depth + below(s.id) > MAX_DEPTH) e.push(`التداخل ${MAX_DEPTH} مستويات على الأكثر.`);
    }
  }
  if (s.kind === "series" && others.some((x) => x.parent === s.id)) e.push("السلسلة لا تحوي سلاسل؛ اجعلها تصنيفًا أو انقل ما تحتها.");
  e.push(...validateTemplate(s.template ?? {}, ctx));
  if (ctx.traces) {
    const pub = [s.name, s.description ?? "", s.template?.publish?.titlePattern ?? "", s.template?.publish?.playlist ?? "", ...(s.template?.publish?.tags ?? [])].join("\n");
    const hits = ctx.traces(pub);
    if (hits.length) e.push(`في نصوص السلسلة ما يدل على أدوات الإنتاج: ${hits.join("، ")}.`);
  }
  return e;
};

export const validateTemplate = (t: SeriesTemplate, ctx: SeriesContext): string[] => {
  const e: string[] = [];
  for (const st of t.styles ?? []) if (!ctx.styles.includes(st)) e.push(`الأسلوب «${st}» ليس من أساليب القناة.`);
  for (const sh of t.shots ?? []) if (!ctx.templates.includes(sh)) e.push(`القالب «${sh}» ليس من مكتبة القناة.`);
  if (t.tone && !ctx.tones.includes(t.tone)) e.push(`النبرة «${t.tone}» غير معروفة.`);
  const wpm = t.pacing?.wordsPerMinute;
  if (wpm !== undefined && (wpm < 90 || wpm > 170)) e.push("سرعة الإلقاء بين ٩٠ و١٧٠ كلمة في الدقيقة.");
  const cs = t.pacing?.chapterSeconds;
  if (cs !== undefined && (cs < 20 || cs > 600)) e.push("طول الفصل بين ٢٠ و٦٠٠ ثانية.");
  const cc = t.chapters?.count;
  if (cc !== undefined && (!Number.isInteger(cc) || cc < 1 || cc > 12)) e.push("عدد الفصول بين ١ و١٢.");
  if (t.intro && !["channel", "sting", "none"].includes(t.intro)) e.push("الافتتاحية: افتتاحية القناة، أو معها بطاقة السلسلة، أو بلا افتتاحية.");
  const pat = t.publish?.titlePattern;
  if (pat !== undefined && pat.trim() && !pat.includes("{title}")) e.push("نمط العنوان يجب أن يحوي {title}.");
  const tags = t.publish?.tags ?? [];
  if (new Set(tags).size !== tags.length) e.push("وسم مكرر في وسوم السلسلة.");
  return e;
};

/** «عام» الافتراضي (لا يُكتب ملفه حتى يعدّله المالك) */
export const generalSeries = (): SeriesConfig => ({ version: 1, id: GENERAL_SLUG, name: GENERAL_NAME, kind: "category", order: 9999, status: "active", virtual: true, identity: {}, template: {} });

/** يضيف «عام» إن لم يكن له ملف */
export const withGeneral = (list: SeriesConfig[]): SeriesConfig[] => (list.some((s) => s.id === GENERAL_SLUG) ? list : [...list, generalSeries()]);

export type SeriesNode = SeriesConfig & { children: SeriesNode[]; depth: number };
/** الشجرة مرتبة بـ order ثم الاسم؛ والمؤرشفة في آخرها */
export const seriesTree = (all: SeriesConfig[]): SeriesNode[] => {
  const sort = (xs: SeriesConfig[]) => [...xs].sort((a, b) => Number(a.status === "archived") - Number(b.status === "archived") || (a.order ?? 100) - (b.order ?? 100) || a.name.localeCompare(b.name, "ar"));
  const ids = new Set(all.map((s) => s.id));
  const build = (parent: string | undefined, depth: number): SeriesNode[] =>
    depth > MAX_DEPTH ? [] : sort(all.filter((s) => (parent ? s.parent === parent : !s.parent || !ids.has(s.parent)))).map((s) => ({ ...s, depth, children: build(s.id, depth + 1) }));
  return build(undefined, 1);
};

/** العنوان المنشور من نمط السلسلة: {series} و{n} و{title}؛ بلا رقم يُحذف الجزء الذي فيه {n} */
export const publishTitle = (pattern: string | undefined, v: { series: string; n?: number; title: string }, digits: (n: number) => string = String): string => {
  if (!pattern?.trim()) return v.title;
  let p = pattern;
  if (v.n === undefined) p = p.replace(/[^|:،—-]*\{n\}[^|:،—-]*[|:،—-]?\s*/g, " ");
  return p.replaceAll("{series}", v.series).replaceAll("{n}", v.n !== undefined ? digits(v.n) : "").replaceAll("{title}", v.title).replace(/\s{2,}/g, " ").replace(/^\s*[|:،—-]\s*|\s*[|:،—-]\s*$/g, "").trim();
};

/** نمط العنوان الافتراضي لكل نوع */
export const defaultTitlePattern = (kind: SeriesKind) => (kind === "series" ? "{series} | الحلقة {n}: {title}" : "");

/** النبرة الافتراضية لقالب السلسلة: «قوي رزين» (D70، قرار صاحب القناة ١١ نوفمبر) */
export const DEFAULT_SERIES_TONE = "grave";
/** القالب كما يُختم: نسخة مستقلة، والنبرة «قوي رزين» ما لم تُختر غيرها */
export const effectiveTemplate = (t: SeriesTemplate | undefined): SeriesTemplate => {
  const copy = JSON.parse(JSON.stringify(t ?? {})) as SeriesTemplate;
  return { ...copy, tone: copy.tone || DEFAULT_SERIES_TONE };
};

/** يختم السلسلة في الحلقة الجديدة */
export const stampSeries = (s: SeriesConfig, channelId: string, number: number | undefined, at = new Date().toISOString()): SeriesStamp => ({
  id: s.id,
  name: s.name,
  kind: s.kind,
  ...(s.kind === "series" && number ? { number } : {}),
  identity: deriveSeriesIdentity(channelId, s.identity ?? {}),
  template: effectiveTemplate(s.template),
  stampedAt: at,
});

/**
 * أسلوب الحلقة الجديدة من أساليب السلسلة: أول أسلوب يختلف عن أسلوب الحلقة السابقة في القناة
 * (مبدأ التنوع يبقى فوق افتراضيات السلسلة؛ وفحوص التنوع القائمة تعمل كما هي).
 */
export const nextStyle = (styles: string[] | undefined, previousStyle?: string): string | undefined => {
  if (!styles?.length) return undefined;
  return styles.find((s) => s !== previousStyle) ?? styles[0];
};

/** عناوين فصول السلسلة في قالب السكريبت: «## الفصل N · عنوان» يأخذ عنوان السلسلة للفصل N */
export const applyChapterTitles = (script: string, titles: string[] | undefined): string => {
  if (!titles?.length) return script;
  return script.replace(/^(##\s+الفصل\s+(\d+)\s*·\s*)(.*)$/gm, (all, head: string, n: string) => {
    const t = titles[Number(n) - 1]?.trim();
    return t ? `${head}${t}` : all;
  });
};

/**
 * ختم السلسلة في الخطة (مثل plan.engineDefaults): الخطة القائمة تحتفظ بختمها هي وحده (وغيابه في كل خطة قديمة = «عام»
 * بهوية القناة)، والخطة الأولى لحلقة جديدة تأخذ ختمها من ملف الانتماء، ومعه نبرة السلسلة والافتتاحية إن لم تُختر.
 */
export const withSeriesStamp = <P extends { tone?: string; intro?: boolean; series?: SeriesStamp }>(plan: P, previous: P | null | undefined, stamp: SeriesStamp | undefined): P => {
  const out = { ...plan };
  delete out.series;
  if (previous) {
    if (previous.series) out.series = previous.series;
    return out;
  }
  if (!stamp) return out;
  out.series = stamp;
  if (!out.tone && stamp.template.tone) out.tone = stamp.template.tone;
  if (stamp.template.intro === "none") out.intro = false;
  return out;
};

/** ما تضيفه السلسلة إلى حزمة النشر: العنوان بنمطها، ووسومها، وقائمة التشغيل (بلا ختم: عنوان الحلقة كما هو) */
export const seriesPublish = (plan: { title: string; series?: SeriesStamp }, digits: (n: number) => string = (n) => n.toLocaleString("ar-EG")): { title: string; tags: string[]; playlist?: string } => {
  const s = plan.series;
  if (!s) return { title: plan.title, tags: [] };
  const pub = s.template.publish ?? {};
  return {
    title: publishTitle(pub.titlePattern, { series: s.name, n: s.kind === "series" ? s.number : undefined, title: plan.title }, digits),
    tags: [...new Set((pub.tags ?? []).map((t) => t.trim().replace(/^#/, "")).filter(Boolean))],
    ...(pub.playlist?.trim() || s.kind === "series" ? { playlist: pub.playlist?.trim() || s.name } : {}),
  };
};
