import type { PlanScene } from "./types";
import { LIGHTING_SUPPORT } from "./lighting";
import { NO_TRANSITION_TEMPLATES } from "./transitions";

/**
 * سجل أدوات المحرك (التوجيه الدائم بعد الأمر 011): كل ما بُني في الأوامر 005–011 مكانه في الإنتاج الفعلي،
 * وحالته الواضحة: مفعَّل دائمًا (بنية)، أو متاح عند الحاجة (مؤثر لا يُفرض)، أو أساس جاهز ينتظر اعتماد
 * صاحب القناة ليصير افتراضيًا للحلقات الجديدة فقط.
 *
 * الافتراضي المعتمد لا يمس حلقة قائمة: يُختم في خطة الحلقة لحظة إنشائها (`plan.engineDefaults`)، وإعادة
 * توليد خطة قائمة تستعمل ختمها هي (وغيابه = لا شيء)، فتبقى كل نسخة سابقة قابلة لإعادة الإنتاج كما كانت.
 */
export type EngineKind = "infra" | "effect" | "base";
export type EngineFeature = {
  id: string;
  nameAr: string;
  /** الأمر الذي بُني فيه */
  order: string;
  kind: EngineKind;
  /** القنوات التي فُعّل لها (العزل: تطوير «بالإسلام» لا يدخل استوديو قناة أخرى). غياب الحقل = بنية مشتركة للمستودع كله */
  channels?: string[];
  /** القوالب التي يعمل فيها (null = كل الإنتاج: بنية) */
  templates: string[] | null;
  /** أين يُتحكم به (اسم الحقل في محرر المشهد أو مكانه في الاستوديو) */
  control: string;
  summary: string;
  /** للأساس فقط: ما يُكتب في المشهد الجديد إن اعتُمد افتراضيًا (لا يُكتب فوق قيمة موجودة) */
  sets?: Record<string, Record<string, string>>;
  /** حدود معروفة تُعرض مع الحالة */
  limits?: string;
};

const ILLUS = ["alley-tale", "road-journey", "light-stage"];

export const ENGINE_FEATURES: EngineFeature[] = [
  {
    id: "composed-camera",
    nameAr: "الكاميرا المؤلَّفة والمشي الطبيعي في «حكايات الحارة»",
    order: "005–007",
    kind: "base",
    channels: ["balislam"],
    templates: ["alley-tale"],
    control: "محرر المشهد ← وضع الكاميرا = مؤلَّفة، والتأطير = محتوي (ومعهما خطة الكاميرا والمشية)",
    summary: "حركات كاميرا قليلة على كلمات المعنى بدل تأطير مع كل سطر، ومشي بقدم ثابتة وتسارع وتباطؤ، والتفاتة بالجسد.",
    sets: { "alley-tale": { cameraMode: "composed", framing: "fit" } },
    limits: "لا تُطبَّق على اللقطة المصمَّمة (shot) فلها كاميرتها. التأطير المحتوي (framing = fit، الأمر 013) جزء منها للحلقات الجديدة؛ وفي العمودي لا يتسع الشاهدان والموقف معًا فتنتقل الكاميرا بينهم.",
  },
  {
    id: "natural-road",
    nameAr: "المشي الطبيعي في «الطريق»",
    order: "007",
    kind: "base",
    channels: ["balislam"],
    templates: ["road-journey"],
    control: "محرر المشهد ← طريقة المشي = طبيعية",
    summary: "قدم ثابتة على الطريق المتحرك، وتباطؤ عند المحطات واندفاع بعدها، ومتابعة الثوب.",
    sets: { "road-journey": { motion: "natural" } },
  },
  {
    id: "natural-stage",
    nameAr: "المشي الطبيعي في «ظل ونور»",
    order: "التوجيه الدائم",
    kind: "base",
    channels: ["balislam"],
    templates: ["light-stage"],
    control: "محرر المشهد ← الانتقال بين العلامات = طبيعية",
    summary: "يمشي البطل إلى علامة كل سطر بخطوات حقيقية والتفاتة بالجسد، بدل الانزلاق السريع في 26 إطارًا.",
    sets: { "light-stage": { motion: "natural" } },
    limits: "إن قصر السطر عن المسافة يقصّر البطل خطوته ولا يسرع فوق مشيته.",
  },
  {
    id: "lighting",
    nameAr: "الإضاءة والظلال والعمق",
    order: "008–009",
    kind: "effect",
    channels: ["balislam"],
    templates: Object.keys(LIGHTING_SUPPORT),
    control: "محرر المشهد ← الإضاءة والظلال (اختياري)",
    summary: "ظل تماس وظل ملقى، واتجاه ضوء يتحرك على كلمة، وضوء الغرفة، وعمق مجال وضباب وطبقات.",
    limits: "«ظل ونور» إضاءته هي أسلوبه (البقعة والظل)، فلا يقرأ الحقل؛ و«الطريق» بلا طبقة مقدمة.",
  },
  {
    id: "transitions",
    nameAr: "الانتقالات بين المشاهد",
    order: "011",
    kind: "effect",
    channels: ["balislam"],
    templates: null,
    control: "محرر المشهد ← الدخول من المشهد السابق",
    summary: "قطع، مزج، حركة كاميرا، قناع، عنصر مشترك، تحول هندسي، ضوء، واستمرار الحركة.",
    limits: `غير متاح مع ${Object.keys(NO_TRANSITION_TEMPLATES).join("، ")}؛ وقبل الآية وذكر الله وبعدهما القطع والمزج فقط؛ واستمرار الحركة لـ«الحارة» المؤلَّفة.`,
  },
  {
    id: "render-queue",
    nameAr: "طابور الرندر الآمن",
    order: "009–010",
    kind: "infra",
    templates: null,
    control: "تلقائي في كل رندر من الاستوديو (ويُلغى من زر الإلغاء)",
    summary: "توازٍ من الذاكرة المتاحة، وتصنيف سبب الفشل بالدليل، ومراقبة التوقف، واستعادة الطابور بعد إعادة التشغيل.",
  },
  {
    id: "shorts-picker",
    nameAr: "مقاطع الشورتس يختارها المالك",
    order: "D83",
    kind: "infra",
    templates: null,
    control: "٢ المشاهد ← أدوات وتفاصيل ← مقاطع الشورتس، في أي وقت (ومنها في ٤ النشر ← الشورتس والريلز): من مشهد إلى مشهد، عنوان اختياري، إضافة وحذف وترتيب",
    summary: "كل شورت من مشهد البداية إلى مشهد النهاية، مع المدة التقريبية والنص قبل الحفظ؛ يُحفظ مع خطة الحلقة وحدها ولا يمس مشهدًا ولا اعتمادًا.",
    limits: "حتى ستة شورتس. الاختيار مسموح في أي وقت، والصناعة بعد اعتماد النسخة الأساسية وحدها. بلا اختيار: شورت لكل قسم في خطة فيها قسمان فأكثر، ولا شورتس للنص المتصل.",
  },
  {
    id: "gate",
    nameAr: "بوابة التسليم",
    order: "010",
    kind: "infra",
    templates: null,
    control: "تلقائية مع كل رفع للكود إلى المستودع",
    summary: "فحص الأنواع والاختبارات على النسخة المرفوعة نفسها، ويُرفض الرفع عند أي فشل.",
  },
];

export const engineFeature = (id: string) => ENGINE_FEATURES.find((f) => f.id === id);
/** هل الأداة مفعّلة لقناة (البنية المشتركة مفعّلة للجميع) */
export const engineEnabled = (id: string, channelId: string | undefined) => {
  const f = engineFeature(id);
  return Boolean(f && (!f.channels || (channelId !== undefined && f.channels.includes(channelId))));
};
/** أدوات القناة التي تُعرض حالتها في الاستوديو: لا لوحة لقناة لم يُفعَّل لها شيء من أدوات الإنتاج */
export const channelEngineFeatures = (channelId: string) =>
  ENGINE_FEATURES.some((f) => f.channels?.includes(channelId)) ? ENGINE_FEATURES.filter((f) => !f.channels || f.channels.includes(channelId)) : [];
export const BASE_FEATURE_IDS = ENGINE_FEATURES.filter((f) => f.kind === "base").map((f) => f.id);

export type EngineStatus = "always" | "available" | "default" | "awaiting-approval" | "unavailable";
export const ENGINE_STATUS_AR: Record<EngineStatus, string> = {
  always: "مفعَّل دائمًا",
  available: "متاح عند الحاجة (لا يُفرض)",
  default: "مفعَّل افتراضيًا للحلقات الجديدة",
  "awaiting-approval": "جاهز، ينتظر الاعتماد الفني ليصير افتراضيًا",
  unavailable: "لا قالب له في مكتبة هذه القناة",
};

/** حالة كل أداة لقناة: بحسب قوالب مكتبتها وما اعتمده صاحبها افتراضيًا */
export const engineStatus = (f: EngineFeature, channel: { id: string; production?: { defaults?: string[] } }, allowedTemplate: (t: string) => boolean): EngineStatus => {
  if (f.channels && !f.channels.includes(channel.id)) return "unavailable";
  if (f.templates && !f.templates.some(allowedTemplate)) return "unavailable";
  if (f.kind === "infra") return "always";
  if (f.kind === "effect") return "available";
  return channel.production?.defaults?.includes(f.id) ? "default" : "awaiting-approval";
};

/** يتحقق من قائمة الافتراضيات المعتمدة لقناة (لا يُقبل إلا أساس يعمل في مكتبتها) */
export const engineDefaultsIssues = (defaults: unknown, allowedTemplate: (t: string) => boolean, channelId?: string): string[] => {
  if (defaults === undefined) return [];
  if (!Array.isArray(defaults) || defaults.some((d) => typeof d !== "string")) return ["قائمة الافتراضيات يجب أن تكون معرّفات."];
  const out: string[] = [];
  for (const id of defaults as string[]) {
    const f = engineFeature(id);
    if (!f || f.kind !== "base") out.push(`«${id}» ليس أساسًا يمكن جعله افتراضيًا.`);
    else if (channelId !== undefined && !engineEnabled(id, channelId)) out.push(`«${f.nameAr}» غير مفعّل لهذه القناة.`);
    else if (f.templates && !f.templates.some(allowedTemplate)) out.push(`«${f.nameAr}» لا قالب له في مكتبة هذه القناة.`);
  }
  return out;
};

/**
 * يطبّق الافتراضيات المختومة في خطة على مشهد جديد: لا يكتب فوق قيمة موجودة، ولا يمس اللقطة المصمَّمة.
 * بلا افتراضيات (كل خطة قديمة) لا يتغير شيء.
 */
export const applyEngineDefaults = (scene: Pick<PlanScene, "template" | "props">, defaults: readonly string[] | undefined) => {
  if (!defaults?.length) return;
  for (const id of defaults) {
    const sets = engineFeature(id)?.sets?.[scene.template];
    if (!sets) continue;
    if (scene.template === "alley-tale" && scene.props.shot) continue;
    for (const [k, v] of Object.entries(sets)) if (!scene.props[k]) scene.props[k] = v;
  }
};

export const isIllusTemplate = (t: string) => ILLUS.includes(t);
