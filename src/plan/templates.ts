import { lightingHelp } from "./lighting";
import { INK_SHOTS } from "../remotion/zubdat/shots";
import { HZ_META } from "../remotion/dafatir/horizon/meta";
import { SHOTS } from "../remotion/illus/shots";
import { LIB_UI } from "../remotion/dafatir/lib/meta";
import { INK_UI } from "../remotion/zubdat/kitSlots";
import { cueNamesAr } from "./sceneCues";
import type { MatchMode, ShotUi } from "./sceneSlots";
/**
 * تعريف القوالب كبيانات: الاسم، هل بُني، والحقول التي يعرضها الاستوديو لكل قالب.
 * مشترك بين مولّد الخطة والاستوديو وتكوين الحلقة.
 */
/** خيارات مشتركة لقوالب «بالإسلام» المصوَّرة */
const MOOD_OPTIONS = [
  { value: "night", label: "ليل زمردي (سؤال وتأمل)" },
  { value: "deep", label: "ليل أعمق (ثقل وإنكار)" },
  { value: "dusk", label: "غروب (تأثر وذكرى)" },
  { value: "predawn", label: "قبيل الفجر (بداية الفهم)" },
  { value: "dawn", label: "فجر (الخلاصة والحق)" },
  { value: "day", label: "نهار هادئ (الحياة اليومية)" },
];
const CAMERA_OPTIONS = [
  { value: "push", label: "اقتراب بطيء" },
  { value: "track", label: "تتبّع جانبي" },
  { value: "rise", label: "ارتفاع" },
  { value: "drift", label: "انجراف هادئ" },
  { value: "still", label: "ثابتة" },
];
/** أدوات المحرك (الأوامر 006–011) في محرر المشهد: فارغ = السلوك القائم حرفيًا */
const GAIT_OPTIONS = [
  { value: "", label: "الافتراضية" },
  { value: "stroll", label: "تمهّل (stroll)" },
  { value: "walk", label: "مشي عادي (walk)" },
  { value: "brisk", label: "مشي سريع (brisk)" },
  { value: "heavy", label: "مشي مثقل (heavy)" },
];
const MOTION_OPTIONS = [
  { value: "", label: "القديمة (كما هي)" },
  { value: "natural", label: "طبيعية: قدم ثابتة وتسارع والتفاتة بالجسد" },
];
const CAMERA_PLAN_HELP =
  "مع الكاميرا المؤلَّفة فقط. فارغ = خطة آلية من كلمات المعنى. «ثابت» وحدها = كاميرا ساكنة. أو سطر لكل حركة: الكلمة (ويجوز +إطارات أو -إطارات) أو رقم الإطار | wide أو medium أو close ثم الهدف (hero، pair، door، board، center، وother للطرف الآخر مع التأطير المحتوي) ثم مدة اختيارية بالإطارات (12–300). السطر الأول 0 = التأطير الافتتاحي.";
const LOOK_OPTIONS = [
  { value: "hero", label: "شاب (سترة)" },
  { value: "heroThobe", label: "شاب (ثوب)" },
  { value: "woman", label: "امرأة (عباءة داكنة)" },
  { value: "womanSand", label: "امرأة (عباءة رملية)" },
  { value: "elder", label: "شيخ كبير" },
];

export type FieldType = "text" | "textarea" | "element" | "variant" | "pose" | "select" | "number" | "boolean" | "image";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  help?: string;
  placeholder?: string;
  /**
   * كيف يحرره المالك في «إعدادات المشهد» (D54، src/plan/sceneSlots.ts). بلا قيمة = الحقل العادي.
   * shot: بطاقات المشاهد المصوَّرة · anchor-lines: أسطر «المفتاح | الكلمة» بالنقر على الكلمات ·
   * anchor: كلمة واحدة بالنقر · phrases: عبارات من الجملة · events: أحداث «المعنى | الكلمة».
   * التخزين لا يتغير بها.
   */
  ui?: "shot" | "anchor-lines" | "anchor" | "phrases" | "events";
  /** مطابقة الكلمة كما يقرؤها الرسم (للمراسي) */
  match?: MatchMode;
  /** اسم لحظة الظهور للمالك (ui: anchor) */
  slot?: string;
  /** حقل نصّ أول كلمة منه هي لحظة الظهور التلقائية */
  fallbackFrom?: string;
  /** يظهر مع كل مشهد من مشاهد القالب */
  common?: boolean;
  /** لمشهد الخاتمة وحده (آخر مشهد في الحلقة أو مشهد يعلن أنه خاتمة) */
  closing?: boolean;
  /** يظهر متى كانت له قيمة ولو لم يعلنه المشهد المختار */
  keepIfSet?: boolean;
  /** الرسم لا يقرأ «#ن» في هذا الحقل: يقع الحدث عند أول نطق للكلمة */
  firstOnly?: boolean;
};

export type TemplateDef = {
  id: string;
  nameAr: string;
  /** وصف قصير لمتى يُستخدم */
  useAr: string;
  /** سطر واحد بالعربية السهلة للمالك فوق «المزيد» (وإلا يُعرض أول useAr) */
  summaryAr?: string;
  /** واجهة كل مشهد في حقل ui: "shot" (الاسم المختصر، وحقوله، ولحظات ظهوره، وعباراته) */
  shots?: Record<string, ShotUi>;
  /** حقول يقرؤها كل مشهد مصمَّم لم يعلن حقوله */
  shotFields?: string[];
  implemented: boolean;
  fields: FieldDef[];
  /** مدة افتراضية بالثواني إن لم يكن له تعليق صوتي */
  baseSeconds: number;
  /** أقل مدة تحتاجها حركة القالب لتكتمل، حتى لو كان الصوت أقصر */
  minSeconds: number;
};

const side = { value: "right", label: "يمين" };

export const templateDefs: TemplateDef[] = [
  {
    id: "big-question",
    nameAr: "السؤال الكبير",
    useAr: "افتتاح الفصل بسؤال واحد بخط كبير",
    implemented: true,
    baseSeconds: 5,
    minSeconds: 3.5,
    fields: [
      { key: "question", label: "السؤال", type: "textarea" },
      { key: "highlight", label: "العبارة المميزة", type: "text", help: "جزء من السؤال كما هو، يمر عليه قلم التمييز" },
      { key: "element", label: "الرمز فوق السؤال", type: "element" },
    ],
  },
  {
    id: "character-talk",
    nameAr: "حوار الشخصية",
    useAr: "شخصية تتكلم بعبارة قصيرة في فقاعة",
    implemented: true,
    baseSeconds: 5,
    minSeconds: 3,
    fields: [
      { key: "line", label: "عبارة الفقاعة", type: "textarea", help: "قصيرة: ثماني كلمات أو أقل" },
      { key: "variant", label: "الشخصية", type: "variant" },
      { key: "pose", label: "الوضعية", type: "pose" },
      { key: "element", label: "عنصر بجوارها", type: "element" },
      { key: "side", label: "جهة الشخصية", type: "select", options: [{ value: "", label: "تلقائي (بداية السطر)" }, side, { value: "left", label: "يسار" }] },
    ],
  },
  {
    id: "verse-card",
    nameAr: "بطاقة الآية",
    useAr: "عرض آية بنصها من المصدر المعتمد",
    implemented: true,
    baseSeconds: 7,
    minSeconds: 7,
    fields: [
      { key: "text", label: "نص الآية", type: "textarea", help: "مصدره السكريبت المعتمد؛ لا يُبدّل تلقائيًا، ويجب تدقيقه قبل الإنتاج" },
      { key: "reference", label: "المرجع", type: "text" },
      { key: "reciter", label: "القارئ", type: "text", help: "يظهر فقط إن صاحبت الآيةَ تلاوةٌ مرخّصة" },
      { key: "meaning", label: "ترجمة المعنى", type: "textarea", help: "للقنوات غير العربية: تُجلب من الترجمة المحددة في إعدادات القناة" },
    ],
  },
  {
    id: "hadith-card",
    nameAr: "بطاقة الحديث",
    useAr: "نص الحديث بمصدره ودرجته",
    implemented: true,
    baseSeconds: 8,
    minSeconds: 7,
    fields: [
      { key: "narrator", label: "الراوي", type: "text", placeholder: "عن أبي هريرة رضي الله عنه" },
      { key: "text", label: "نص الحديث", type: "textarea", help: "كما في المصدر، بلا تعديل" },
      { key: "reference", label: "المصدر", type: "text", placeholder: "صحيح البخاري · ٦٤٤٦" },
      { key: "grade", label: "الدرجة", type: "select", options: [{ value: "صحيح", label: "صحيح" }, { value: "حسن", label: "حسن" }] },
    ],
  },
  {
    id: "comparison",
    nameAr: "المقارنة",
    useAr: "جانبان متقابلان: قبل وبعد، خطأ وصواب",
    implemented: true,
    baseSeconds: 7,
    minSeconds: 7,
    fields: [
      { key: "rightTitle", label: "عنوان الجانب الأول (يمين)", type: "text" },
      { key: "rightItems", label: "نقاطه (سطر لكل نقطة)", type: "textarea" },
      { key: "rightElement", label: "رمزه", type: "element" },
      { key: "leftTitle", label: "عنوان الجانب الثاني (يسار)", type: "text" },
      { key: "leftItems", label: "نقاطه (سطر لكل نقطة)", type: "textarea" },
      { key: "leftElement", label: "رمزه", type: "element" },
      { key: "tone", label: "النوع", type: "select", options: [{ value: "neutral", label: "محايد" }, { value: "contrast", label: "خطأ ← صواب" }] },
    ],
  },
  {
    id: "list",
    nameAr: "القائمة",
    useAr: "نقاط تظهر تباعًا",
    implemented: true,
    baseSeconds: 7,
    minSeconds: 6,
    fields: [
      { key: "title", label: "العنوان", type: "text" },
      { key: "items", label: "النقاط (سطر لكل نقطة، حتى 5)", type: "textarea" },
      { key: "style", label: "الشكل", type: "select", options: [{ value: "numbered", label: "مرقّمة" }, { value: "check", label: "علامات صح" }, { value: "icons", label: "رمز لكل نقطة" }] },
      { key: "icons", label: "رموز النقاط (معرّفات مفصولة بفواصل)", type: "text", help: "لشكل «رمز لكل نقطة» فقط، مثل: heart, coin, book-open" },
    ],
  },
  {
    id: "big-number",
    nameAr: "الرقم الكبير",
    useAr: "رقم أو نسبة صادمة",
    implemented: true,
    baseSeconds: 5,
    minSeconds: 5,
    fields: [
      { key: "number", label: "الرقم", type: "text", placeholder: "٧٠٪" },
      { key: "caption", label: "الوصف", type: "textarea" },
      { key: "source", label: "المصدر (سطر صغير)", type: "text" },
      { key: "element", label: "رمز بجواره", type: "element" },
    ],
  },
  {
    id: "chart",
    nameAr: "الرسم البياني",
    useAr: "مقارنة أرقام بأعمدة",
    implemented: true,
    baseSeconds: 7,
    minSeconds: 7,
    fields: [
      { key: "title", label: "العنوان", type: "text" },
      { key: "data", label: "البيانات (الاسم: القيمة في كل سطر)", type: "textarea", placeholder: "الهاتف: 4\nالقراءة: 0.5" },
      { key: "unit", label: "الوحدة", type: "text", placeholder: "ساعات" },
      { key: "highlight", label: "العمود المميز (اسمه)", type: "text" },
      { key: "source", label: "المصدر (سطر صغير)", type: "text" },
    ],
  },
  {
    id: "noor-text",
    nameAr: "نور وكتابة",
    useAr: "لما لا يُصوَّر أبدًا: نور فقط مع كتابة (آدم عليه السلام، والملائكة)، أو فراغ الأفق مع كتابة (الجنة، والشجرة)، أو حبر على صفحة الدفتر لما ليس غيبًا. الكتابة تظهر وقت نطقها",
    implemented: true,
    baseSeconds: 5,
    minSeconds: 3,
    fields: [
      { key: "text", label: "الكتابة", type: "text", placeholder: "آدم عليه السلام" },
      { key: "light", label: "النوع", type: "select", options: [{ value: "on", label: "نور مع كتابة (آدم والملائكة فقط)" }, { value: "off", label: "فراغ مع كتابة (الغيب)" }, { value: "ink", label: "حبر على صفحة الدفتر" }] },
      { key: "subtitle", label: "سطر صغير تحتها (اختياري)", type: "text" },
    ],
  },
  {
    id: "timeline",
    nameAr: "الخط الزمني",
    useAr: "أحداث بترتيبها",
    implemented: true,
    baseSeconds: 8,
    minSeconds: 8,
    fields: [
      { key: "title", label: "العنوان", type: "text" },
      { key: "events", label: "الأحداث (التاريخ | الحدث في كل سطر، حتى 5)", type: "textarea", placeholder: "٢٢٠ هـ | تأسيس بيت الحكمة" },
      { key: "element", label: "رمز", type: "element" },
    ],
  },
  {
    id: "symbolic",
    nameAr: "المشهد الرمزي",
    useAr: "عنصر رمزي كبير يعبّر عن الفكرة",
    implemented: true,
    baseSeconds: 5,
    minSeconds: 5,
    fields: [
      { key: "cue", label: "كلمة الظهور", type: "text", help: "الكلمة المنطوقة التي يظهر عندها العنصر (قاعدة القناة: يظهر وقت نطق كلمته)." },
      { key: "element", label: "العنصر", type: "element" },
      { key: "secondElement", label: "عنصر ثانٍ (اختياري)", type: "element" },
      { key: "relation", label: "العلاقة بينهما", type: "select", options: [{ value: "becomes", label: "يتحول إلى ←" }, { value: "versus", label: "مقابل" }, { value: "plus", label: "مع +" }] },
      { key: "caption", label: "عبارة قصيرة", type: "text" },
      { key: "effect", label: "الحركة", type: "select", options: [{ value: "pop", label: "ظهور" }, { value: "grow", label: "نمو" }, { value: "shake", label: "اهتزاز" }, { value: "float", label: "طفو" }] },
    ],
  },
  {
    id: "board-story",
    nameAr: "السبورة المتصلة",
    useAr: "كل جملة تُرسم وقت قولها (رسمة + كلمة بخط اليد) على لوحة واحدة تتحرك عليها الكاميرا",
    implemented: true,
    baseSeconds: 6,
    minSeconds: 3.5,
    fields: [
      { key: "beats", label: "اللقطات (سطر لكل جملة)", type: "textarea", help: "الرسمة | الكلمة المكتوبة. الرسمة: معرّف عنصر من المكتبة، أو person أو people أو person:think" },
      { key: "board", label: "السبورة", type: "select", options: [{ value: "white", label: "بيضاء (ورق مسطّر)" }, { value: "green", label: "سوداء (حبر أبيض)" }] },
      { key: "extras", label: "رسمات مساندة آلية", type: "select", options: [{ value: "on", label: "نعم (من قائمة المعاني)" }, { value: "off", label: "لا (اللقطات المختارة فقط)" }] },
    ],
  },
  {
    id: "alley-tale",
    nameAr: "حكايات الحارة",
    useAr: "كل جملة لقطة في مكان مرسوم (حارة، سوق، بيت)، وبطل بلا ملامح يمثّل الكلام، والضوء يحمل المعنى لحظة نطق كلمته",
    summaryAr: "لقطة مرسومة في الحارة لكل جملة، والضوء يحمل المعنى لحظة نطق كلمته.",
    shots: Object.fromEntries(Object.keys(SHOTS).map((k) => [k, {}])),
    // اللقطة المصمَّمة تقرأ من حقول القالب أحداثَ الكلمات (للترجمة) ووضع الكاميرا وحدهما (AlleyTale.tsx، ShotScene)
    shotFields: ["cues", "cameraMode"],
    implemented: true,
    baseSeconds: 6,
    minSeconds: 4,
    fields: [
      { key: "place", label: "المكان", type: "select", options: [{ value: "alley", label: "حارة قديمة" }, { value: "market", label: "سوق" }, { value: "home", label: "بيت" }] },
      { key: "mood", label: "المزاج", type: "select", options: MOOD_OPTIONS },
      { key: "moodTo", label: "يتحول إلى", type: "select", options: [{ value: "", label: "لا يتحول" }, ...MOOD_OPTIONS] },
      { key: "cameraMode", label: "وضع الكاميرا", type: "select", options: [{ value: "", label: "تلقائي (القديم: تأطير مع كل سطر)" }, { value: "directed", label: "إخراج يدوي (حركة «الكاميرا» وحدها)" }, { value: "composed", label: "مؤلَّفة: حركات قليلة على كلمات المعنى ومشي طبيعي" }], help: "المؤلَّفة تفعّل المشي الطبيعي والالتفات بالجسد واستمرار الحركة بين المشاهد (carry)." },
      { key: "camera", label: "الكاميرا", type: "select", options: CAMERA_OPTIONS, help: "في الوضع المؤلَّف تتولاها خطة الكاميرا." },
      { key: "framing", label: "التأطير", type: "select", options: [{ value: "", label: "القائم (كما هو)" }, { value: "fit", label: "محتوي: الشخصيات والعناصر المطلوبة كاملة، وما سواها لا يُقص نصف قص" }], help: "مع الكاميرا المؤلَّفة فقط (الأمر 013). في العمودي: يقترب من أمام البطل قليلًا ليتسعا، وتنتقل الكاميرا بين الشاهدين عند كلمتي حكمهما، وتكون كلمة كل شاهد بجوار رأسه." },
      { key: "cameraPlan", label: "خطة الكاميرا (اختياري)", type: "textarea", help: CAMERA_PLAN_HELP },
      { key: "cameraPlanPortrait", label: "خطة الكاميرا للعمودي (اختياري)", type: "textarea", help: "مثل خطة الكاميرا، للنسخة العمودية وحدها؛ فارغ = الخطة نفسها." },
      { key: "gait", label: "المشية", type: "select", options: GAIT_OPTIONS, help: "مع الكاميرا المؤلَّفة فقط." },
      { key: "poses", label: "حركة البطل لكل جملة", type: "text", help: "مفصولة بفاصلة: stand, think, sit, sit-low, head-down, hold, cross, point, look-up, nod, turn-away, walk, proud, apologize, listen, talk" },
      { key: "poseTimeline", label: "وضعيات بتوقيت دقيق (اختياري)", type: "textarea", help: "سطر لكل حدث: رقم_الإطار | الوضعية (من قائمة الحركات أعلاه)، تحل محل الإيماءات الآلية." },
      { key: "look", label: "البطل", type: "select", options: LOOK_OPTIONS },
      { key: "shot", label: "لقطة مصمَّمة", type: "select", ui: "shot", options: [{ value: "", label: "بلا (إخراج عام)" }, ...Object.entries(SHOTS).map(([value, d]) => ({ value, label: d.nameAr }))] },
      { key: "cast", label: "من في المشهد", type: "select", options: [{ value: "", label: "من معنى الكلام" }, { value: "solo", label: "البطل وحده" }, { value: "companion", label: "شخص أمامه" }, { value: "witnesses", label: "شاهدان على موقف واحد" }] },
      { key: "cues", label: "الأحداث (سطر لكل كلمة)", type: "textarea", options: Object.entries(cueNamesAr).map(([value, label]) => ({ value, label })), ui: "events", match: "first", help: "المعنى | الكلمة المنطوقة. المعاني: truth, wrong, just, news, people, memory, door, think, walk, pain, decide, heart, witnesses, companion, harsh, proud, spread, apologize, listen, debate, money, work, success, evidence. لا أحداث في جملة فيها ذكر الله أو دعاء أو آية" },
      { key: "lighting", label: "الإضاءة والظلال (اختياري)", type: "textarea", help: lightingHelp("alley-tale") },
    ],
  },
  {
    id: "road-journey",
    nameAr: "الطريق",
    useAr: "الحلقة رحلة مسافر واحد بلا قطع: يمشي من أطراف المدينة إلى تلة الفجر، ويتوقف عند كل محطة يذكرها الكلام",
    implemented: true,
    baseSeconds: 6,
    minSeconds: 4,
    fields: [
      { key: "biome", label: "الطريق", type: "select", options: [{ value: "city", label: "أطراف المدينة" }, { value: "fields", label: "الحقول" }, { value: "desert", label: "الصحراء" }, { value: "hill", label: "تلة الفجر" }] },
      { key: "mood", label: "المزاج", type: "select", options: MOOD_OPTIONS },
      { key: "moodTo", label: "يتحول إلى", type: "select", options: [{ value: "", label: "لا يتحول" }, ...MOOD_OPTIONS] },
      { key: "poses", label: "حركة المسافر", type: "text", help: "walk للمشي (الافتراضي)، أو stand ليقف طوال المشهد" },
      { key: "motion", label: "طريقة المشي", type: "select", options: MOTION_OPTIONS, help: "الطبيعية: قدم ثابتة على الطريق المتحرك، وتباطؤ عند المحطات واندفاع بعدها." },
      { key: "gait", label: "المشية", type: "select", options: GAIT_OPTIONS, help: "مع الطريقة الطبيعية فقط (الافتراضية stroll)." },
      { key: "look", label: "المسافر", type: "select", options: LOOK_OPTIONS },
      { key: "cues", label: "الأحداث (سطر لكل كلمة)", type: "textarea", options: Object.entries(cueNamesAr).map(([value, label]) => ({ value, label })), ui: "events", match: "first", help: "المعنى | الكلمة المنطوقة. المعاني: truth, wrong, just, news, people, memory, door, think, walk, pain, decide, heart, witnesses, companion, harsh, proud, spread, apologize, listen, debate, money, work, success, evidence. لا أحداث في جملة فيها ذكر الله أو دعاء أو آية" },
      { key: "lighting", label: "الإضاءة والظلال (اختياري)", type: "textarea", help: lightingHelp("road-journey") },
    ],
  },
  {
    id: "light-stage",
    nameAr: "ظل ونور",
    useAr: "مسرح مظلم وبقعة ضوء: البطل ينتقل إلى علامة جديدة مع كل سطر، والمعنى يُروى بالضوء والظل",
    implemented: true,
    baseSeconds: 6,
    minSeconds: 4,
    fields: [
      { key: "mood", label: "لون الضوء", type: "select", options: [{ value: "night", label: "ضوء ورقي (حيرة وسؤال)" }, { value: "dawn", label: "ضوء الفجر (حق وخلاصة)" }] },
      { key: "poses", label: "حركة البطل لكل جملة", type: "text", help: "مفصولة بفاصلة: stand, think, sit, sit-low, head-down, hold, cross, point, look-up, nod, turn-away" },
      { key: "motion", label: "الانتقال بين العلامات", type: "select", options: MOTION_OPTIONS, help: "الطبيعية: يمشي إلى علامة كل سطر بخطوات حقيقية بدل الانزلاق السريع، ويقصّر المسافة إن قصر السطر." },
      { key: "gait", label: "المشية", type: "select", options: GAIT_OPTIONS, help: "مع الطريقة الطبيعية فقط (الافتراضية walk)." },
      { key: "look", label: "البطل", type: "select", options: LOOK_OPTIONS },
      { key: "cues", label: "الأحداث (سطر لكل كلمة)", type: "textarea", options: Object.entries(cueNamesAr).map(([value, label]) => ({ value, label })), ui: "events", match: "first", help: "المعنى | الكلمة المنطوقة. المعاني: truth, wrong, just, news, people, memory, door, think, walk, pain, decide, heart, witnesses, companion, harsh, proud, spread, apologize, listen, debate, money, work, success, evidence. لا أحداث في جملة فيها ذكر الله أو دعاء أو آية" },
    ],
  },
  {
    id: "dua-board",
    nameAr: "لوح الدعاء",
    useAr: "ورقة هادئة تمتد عبر مشاهد متتالية: الدعاء كاملًا مقروءًا تكتمل كل عبارة منه لحظة نطقها بلا رموز بجواره، ثم شبكة مطالبه الأربعة تُكتب كلمةً كلمة مع الشرح",
    implemented: true,
    baseSeconds: 4,
    minSeconds: 2,
    fields: [
      { key: "dua", label: "نص الدعاء", type: "text", help: "كما في السكريبت حرفيًا؛ / لسطر جديد و| بين العبارات" },
      { key: "source", label: "مصدره", type: "text", help: "مثل: من الأدعية المأثورة في كلام أهل العلم (لا يُنسب إلى النبي ﷺ بلا سند)" },
      { key: "asks", label: "المطالب الأربعة", type: "text", help: "مفصولة بـ |" },
      { key: "heads", label: "عنوانا العمودين", type: "text", help: "البصيرة | العزيمة" },
      { key: "shown", label: "على اللوح قبل المشهد", type: "text", help: "source, dua, dock, grid, ask1… (حالة اللوح من المشهد السابق)" },
      { key: "cues", label: "ما يظهر في المشهد (سطر لكل كلمة)", type: "textarea", help: "العنصر | الكلمة المنطوقة. العناصر: source, dua, dock, grid, ask1-4, focus:N, head1-2, count (إضاءة الخانات الأربع تباعًا), note1:نص, warn1:نص, pill3:نص, haze1, reach12, stall12, link12, link34, glow1, glow2, glowall, grow3, clear. الكلمة المكررة: كلمة#2" },
    ],
  },
  {
    id: "ink-shot",
    nameAr: "مشهد حبر مصمَّم",
    useAr: "مشهد مرسوم بالحبر خاص بجملته: حدث بصري له بداية وتطور ونتيجة (خط الوقت، الكتاب ورحلته، خط الانتباه، الإقبال، التكبير، الخطوة العملية)، وكل رسم لحظة نطق كلمته",
    summaryAr: "رسم بالحبر لهذه الجملة، يظهر كل جزء منه لحظة نطق كلمته.",
    shots: Object.fromEntries(Object.keys(INK_SHOTS).map((k) => [k, INK_UI[k] ?? {}])),
    shotFields: [],
    implemented: true,
    baseSeconds: 6,
    minSeconds: 4,
    fields: [
      { key: "shot", label: "المشهد", type: "select", ui: "shot", options: Object.entries(INK_SHOTS).map(([value, d]) => ({ value, label: d.nameAr })) },
      { key: "task", label: "مهمة الحلقة", type: "text", closing: true, help: "تُكتب في الخاتمة كما قيلت في الحلقة" },
      { key: "labels", label: "العبارات على الشاشة", type: "text", ui: "phrases", help: "مفصولة بـ |، وكل عبارة منطوقة حرفيًا في جملة المشهد" },
      { key: "cues", label: "متى يظهر كل عنصر", type: "textarea", ui: "anchor-lines", match: "ink", help: "سطر لكل مفتاح: المفتاح | الكلمة المنطوقة (الكلمة المكررة: كلمة#2). المفاتيح: idea1-5، from، to، cross، step1-4، rise، fall، peak، low، high، title، author، note، و«مفتاح.end» لنهاية الكتابة" },
    ],
  },
  {
    id: "horizon-shot",
    nameAr: "مشهد خط الأفق",
    useAr: "دفاتر الزمن: مشهد مصمَّم لجملته على الدفتر المفتوح (أفق، أطلال، نسل، فهرس، حاشية مفسر، عنوان فصل)، كل حدث لحظة نطق كلمته، ولا يُصوَّر غيب",
    summaryAr: "مشهد على الدفتر المفتوح، يقع كل حدث فيه لحظة نطق كلمته.",
    shots: Object.fromEntries(Object.keys(HZ_META).map((k) => [k, LIB_UI[k] ?? {}])),
    shotFields: [],
    implemented: true,
    baseSeconds: 6,
    minSeconds: 2.5,
    fields: [
      { key: "shot", label: "المشهد", type: "select", ui: "shot", options: Object.entries(HZ_META).map(([value, d]) => ({ value, label: d.nameAr })) },
      { key: "head", label: "رأس الصفحة (رقم الفصل)", type: "text", common: true },
      { key: "label", label: "عنوان الفصل (لمشهد العنوان)", type: "text" },
      { key: "title", label: "العنوان (اسم الفصل، أو موضوع المقارنة أو الخط الزمني)", type: "text" },
      { key: "from", label: "كاميرا البداية من المشهد السابق (x,y,تكبير)", type: "text", common: true },
      { key: "exit", label: "الخروج", type: "select", common: true, options: [{ value: "", label: "حسب المشهد" }, { value: "turn", label: "قلب صفحة" }, { value: "fade", label: "خفوت الحبر" }, { value: "none", label: "يكمله المشهد التالي" }] },
      { key: "idea", label: "فكرة المشهد (قيد التصميم)", type: "textarea" },
      { key: "batch", label: "الدفعة", type: "text" },
      { key: "ref", label: "مرجع الختم القرآني (مثل: ص ٧١–٧٢)", type: "text", keepIfSet: true },
      { key: "tagWord", label: "كلمة ظهور الختم (تمهيد الآية)", type: "text", ui: "anchor", match: "prefix", slot: "ظهور الختم", firstOnly: true },
      // مشاهد المكتبة العامة (lib-*): كل حقل «كلمة …» مرسى الحدث في الكلام («كلمة#2» للورود الثاني). التوثيق: docs/dafatir-alzaman/03-tools.md
      { key: "term", label: "المصطلح (كلمة أو كلمتان)", type: "text" },
      { key: "termWord", label: "كلمة كتابة المصطلح", type: "text", ui: "anchor", match: "prefix", slot: "كتابة المصطلح", fallbackFrom: "term" },
      { key: "sub", label: "سطر الشرح", type: "text" },
      { key: "subWord", label: "كلمة سطر الشرح", type: "text", ui: "anchor", match: "prefix", slot: "سطر الشرح", fallbackFrom: "sub" },
      { key: "kind", label: "نوع المصدر", type: "select", options: [{ value: "", label: "بلا" }, { value: "quran", label: "قرآن (ختم ذهبي بالمرجع)" }, { value: "tafsir", label: "تفسير (لسان أحمر)" }, { value: "note", label: "مصدر آخر / تعليق" }] },
      { key: "source", label: "المصدر أو المرجع", type: "text" },
      { key: "sourceWord", label: "كلمة ظهور المصدر", type: "text", ui: "anchor", match: "prefix", slot: "ظهور المصدر" },
      { key: "matn", label: "نص أصلي غير قرآني (قصير)", type: "textarea", help: "لا يوضع هنا نص آية أبدًا: للقرآن حقل «مرجع الختم القرآني» وحده" },
      { key: "matnWord", label: "كلمة ظهور الأصل", type: "text", ui: "anchor", match: "prefix", slot: "ظهور الأصل" },
      { key: "matnLabel", label: "وسم الأصل", type: "text" },
      { key: "matnSource", label: "مصدر الأصل", type: "text" },
      { key: "tafsir", label: "نص الحاشية/التفسير", type: "textarea" },
      { key: "tafsirWord", label: "كلمة ظهور الحاشية", type: "text", ui: "anchor", match: "prefix", slot: "ظهور الحاشية", fallbackFrom: "tafsir" },
      { key: "tafsirLabel", label: "وسم الحاشية", type: "text" },
      { key: "tafsirSource", label: "مصدر الحاشية", type: "text" },
      { key: "note", label: "تعليق القناة", type: "textarea" },
      { key: "noteWord", label: "كلمة ظهور التعليق", type: "text", ui: "anchor", match: "prefix", slot: "ظهور التعليق", fallbackFrom: "note" },
      { key: "titleWord", label: "كلمة موضوع المقارنة (حقل العنوان)", type: "text", ui: "anchor", match: "prefix", slot: "موضوع المقارنة", fallbackFrom: "title" },
      { key: "aLabel", label: "وسم الطرف الأول", type: "text" },
      { key: "aText", label: "نص الطرف الأول", type: "text" },
      { key: "aWord", label: "كلمة الطرف الأول", type: "text", ui: "anchor", match: "prefix", slot: "الطرف الأول" },
      { key: "bLabel", label: "وسم الطرف الثاني", type: "text" },
      { key: "bText", label: "نص الطرف الثاني", type: "text" },
      { key: "bWord", label: "كلمة الطرف الثاني", type: "text", ui: "anchor", match: "prefix", slot: "الطرف الثاني" },
      { key: "verdict", label: "الحكم في المقارنة", type: "select", options: [{ value: "", label: "بلا" }, { value: "a", label: "الأول" }, { value: "b", label: "الثاني" }, { value: "both", label: "يجتمعان" }, { value: "open", label: "مسألة مفتوحة" }] },
      { key: "verdictText", label: "نص الحكم", type: "text" },
      { key: "verdictWord", label: "كلمة الحكم", type: "text", ui: "anchor", match: "prefix", slot: "الحكم" },
      { key: "items", label: "العلامات أو الشواهد", type: "textarea", help: "سطر لكل عنصر: «كلمة = نص». في الخط الزمني تسبق «؟» الكلمة للفجوة بلا سجل. في الشواهد النص مفتاح الرسم: tool، home، food، settle، burial، art (ويجوز «= مفتاح = وسم»)" },
      { key: "limit", label: "حدود الشاهد", type: "text" },
      { key: "limitWord", label: "كلمة حدود الشاهد", type: "text", ui: "anchor", match: "prefix", slot: "حدود الشاهد", fallbackFrom: "limit" },
    ],
  },
  {
    id: "ink-meaning",
    nameAr: "حبر ومعنى",
    useAr: "الكلمات نفسها هي الرسم: كل كلمة أو عبارة تُكتب بالحبر لحظة نطقها، وأسهم وخطوط تصل الأفكار، والفسفوري للفكرة المحورية وحدها",
    implemented: true,
    baseSeconds: 6,
    minSeconds: 3.5,
    fields: [
      { key: "layout", label: "التخطيط", type: "select", options: [{ value: "center", label: "كلمة محورية" }, { value: "compare", label: "مقارنة" }, { value: "flow", label: "تدفق بأسهم" }, { value: "book", label: "بطاقة الكتاب" }, { value: "sacred", label: "ذكر ثابت" }, { value: "note", label: "ورقة لاصقة" }] },
      { key: "items", label: "العناصر (سطر لكل عنصر)", type: "textarea", help: "النص | الدور | كلمة البدء. الأدوار: key، word، line، mark (تظليل عنصر بنصه)، cross (شطبه)، link (وصل الطرفين)" },
      { key: "author", label: "المؤلف (لبطاقة الكتاب)", type: "text" },
      { key: "enter", label: "الدخول", type: "select", options: [{ value: "", label: "بلا" }, { value: "page", label: "صفحة تُقلب" }] },
    ],
  },
  {
    id: "motion-story",
    nameAr: "القصة المتحركة",
    useAr: "شرح حديث بعمق: أيقونة على قرص زجاجي، عنوان يُبنى كلمة كلمة، شريط للأفكار السابقة، وترجمة متزامنة تتوهج مع الصوت",
    implemented: true,
    baseSeconds: 6,
    minSeconds: 3.5,
    fields: [
      { key: "beats", label: "اللحظات (سطر لكل جملة)", type: "textarea", help: "الرسمة | العنوان. الرسمة: معرّف عنصر من المكتبة، أو person أو people أو person:think. آخر كلمة في العنوان تظهر بالذهبي" },
    ],
  },
  {
    id: "glow-story",
    nameAr: "القصة المضيئة",
    useAr: "لقطة قصصية ليلية بخطوط مضيئة: شخص وأمنيته المتوهجة وجملة تُكتب حرفًا حرفًا",
    implemented: true,
    baseSeconds: 6,
    minSeconds: 5,
    fields: [
      { key: "quote", label: "الجملة في الأعلى", type: "textarea", help: "ما يقوله أو يتمناه صاحب المشهد، قصيرة" },
      { key: "highlight", label: "الكلمة المتوهجة", type: "text", help: "جزء من الجملة كما هو، يظهر بالذهبي" },
      { key: "wish", label: "الأمنية (تتوهج)", type: "element" },
      { key: "subjectElement", label: "صاحب المشهد (عنصر بدل الشخصية)", type: "element", help: "اتركه فارغًا لتظهر شخصية" },
      { key: "variant", label: "الشخصية", type: "variant" },
      { key: "pose", label: "الوضعية", type: "pose" },
      { key: "sideElement", label: "عنصر جانبي", type: "element" },
      { key: "sideGlow", label: "وهج العنصر الجانبي", type: "select", options: [{ value: "none", label: "بلا وهج" }, { value: "red", label: "أحمر" }, { value: "green", label: "أخضر" }, { value: "gold", label: "ذهبي" }] },
      { key: "connector", label: "خط الأمنية", type: "select", options: [{ value: "dotted", label: "منقّط" }, { value: "beam", label: "شعاع" }, { value: "none", label: "بلا خط" }] },
    ],
  },
  {
    id: "sketch-board",
    nameAr: "السبورة (خط اليد)",
    useAr: "شرح مرسوم باليد: عنوان يُكتب، عنصر يُرسم، ثم نقاط بعلامة صح",
    implemented: true,
    baseSeconds: 7,
    minSeconds: 6,
    fields: [
      { key: "title", label: "العنوان", type: "text" },
      { key: "keyword", label: "كلمة تُحوَّط بدائرة", type: "text", help: "جزء من العنوان كما هو" },
      { key: "element", label: "الرسمة", type: "element" },
      { key: "items", label: "النقاط", type: "textarea", help: "سطر لكل نقطة، حتى 4 نقاط قصيرة" },
      { key: "board", label: "السبورة", type: "select", options: [{ value: "white", label: "بيضاء (ورق مسطّر)" }, { value: "green", label: "سوداء (حبر أبيض)" }] },
    ],
  },
  {
    id: "kinetic-text",
    nameAr: "النص الحركي",
    useAr: "كلمات التعليق نفسها كبيرة في وسط الشاشة على إيقاع الصوت، والمهم منها مميز",
    implemented: true,
    baseSeconds: 5,
    minSeconds: 3,
    fields: [
      { key: "emphasis", label: "الكلمات المهمة", type: "text", help: "كلمات من التعليق مفصولة بفاصلة، تظهر أكبر وملونة" },
      { key: "element", label: "رمز فوق الكلام (اختياري)", type: "element" },
      { key: "stage", label: "الخلفية", type: "select", options: [{ value: "theme", label: "ثيم الحلقة" }, { value: "dark", label: "ليلية" }] },
    ],
  },
  {
    id: "map-journey",
    nameAr: "الخريطة المتحركة",
    useAr: "خريطة حقيقية لمنطقة الأحداث: مسار يُرسم من مكان إلى مكان وعليه قافلة أو جيش أو سفينة، والأماكن تظهر بدبابيس",
    implemented: true,
    baseSeconds: 8,
    minSeconds: 5,
    fields: [
      { key: "title", label: "عنوان الخريطة", type: "text", placeholder: "من دمشق إلى قرطبة" },
      { key: "places", label: "الأماكن بالترتيب", type: "textarea", help: "سطر لكل مكان: دمشق، بغداد، قرطبة… أو مكان غير معروف بإحداثياته: «اسم | 35.2, 31.7»" },
      { key: "mode", label: "العرض", type: "select", options: [{ value: "route", label: "مسار يُرسم بين الأماكن" }, { value: "points", label: "أماكن تظهر تباعًا بلا مسار" }] },
      { key: "mover", label: "ما يتحرك على المسار", type: "select", options: [{ value: "caravan", label: "قافلة" }, { value: "army", label: "جيش (راية)" }, { value: "ship", label: "سفينة" }, { value: "none", label: "لا شيء" }] },
      { key: "look", label: "الشكل", type: "select", options: [{ value: "parchment", label: "رَقّ قديم بالحبر" }, { value: "night", label: "ليل سينمائي بالذهب" }] },
      { key: "zoom", label: "الكاميرا", type: "select", options: [{ value: "in", label: "تقترب ببطء" }, { value: "follow", label: "تتبع المسار" }, { value: "off", label: "ثابتة" }] },
      { key: "rivers", label: "الأنهار (النيل ودجلة والفرات)", type: "select", options: [{ value: "on", label: "تظهر" }, { value: "off", label: "بدونها" }] },
    ],
  },
  {
    id: "set-scene",
    nameAr: "مشهد في مكان",
    useAr: "مكان مرسوم كامل (مطبخ، شارع بالليل، فصل، سوق، صحراء، مكتب) وشخصية أو اثنتان، وكاميرا تتحرك، وفقاعة كلام أو فكرة",
    implemented: true,
    baseSeconds: 6,
    minSeconds: 3.5,
    fields: [
      { key: "set", label: "المكان", type: "select", options: [{ value: "office", label: "مكتب" }, { value: "kitchen", label: "مطبخ البيت" }, { value: "street-night", label: "شارع بالليل" }, { value: "classroom", label: "فصل دراسي" }, { value: "market", label: "سوق" }, { value: "desert-night", label: "صحراء تحت السماء" }, { value: "castle-walls", label: "أسوار وقلعة" }, { value: "walls-night", label: "فوق السور ليلًا (معسكر العدو)" }, { value: "palace-court", label: "صحن قصر" }, { value: "caravan", label: "قافلة في الصحراء" }, { value: "wisdom-library", label: "بيت الحكمة" }] },
      { key: "variant", label: "الشخصية الأولى", type: "variant" },
      { key: "pose", label: "وضعيتها", type: "pose" },
      { key: "variant2", label: "الشخصية الثانية (اختياري)", type: "variant" },
      { key: "pose2", label: "وضعيتها", type: "pose" },
      { key: "camera", label: "الكاميرا", type: "select", options: [{ value: "push", label: "تقترب" }, { value: "pull", label: "تبتعد" }, { value: "pan", label: "تتحرك جانبيًا" }, { value: "still", label: "ثابتة" }] },
      { key: "bubble", label: "الفقاعة", type: "text", help: "جملة قصيرة يقولها أو يفكر فيها" },
      { key: "bubbleKind", label: "نوع الفقاعة", type: "select", options: [{ value: "say", label: "كلام" }, { value: "think", label: "تفكير" }] },
      { key: "bubbleWho", label: "صاحب الفقاعة", type: "select", options: [{ value: "1", label: "الأولى" }, { value: "2", label: "الثانية" }] },
      { key: "element", label: "عنصر مساعد", type: "element" },
      { key: "figure", label: "شخصية تاريخية بملامح (بدل الأولى)", type: "select", options: [{ value: "", label: "بلا (شخصية بلا ملامح)" }, { value: "scholar", label: "عالم" }, { value: "commander", label: "قائد" }, { value: "merchant", label: "تاجر" }, { value: "ruler", label: "حاكم" }, { value: "woman", label: "امرأة" }, { value: "youth", label: "شاب" }, { value: "elder", label: "شيخ كبير" }, { value: "traveler", label: "رحّالة غريب" }], help: "تظهر فقط في القنوات التي تسمح بالوجوه (دفاتر الزمن). لا تُستعمل لنبي ولا صحابي." },
      { key: "expr", label: "تعبيرها", type: "select", options: [{ value: "neutral", label: "هادئ" }, { value: "happy", label: "سعيد" }, { value: "sad", label: "حزين" }, { value: "angry", label: "غاضب" }, { value: "surprised", label: "مندهش" }, { value: "worried", label: "قلق" }] },
      { key: "figure2", label: "شخصية تاريخية ثانية", type: "select", options: [{ value: "", label: "بلا (شخصية بلا ملامح)" }, { value: "scholar", label: "عالم" }, { value: "commander", label: "قائد" }, { value: "merchant", label: "تاجر" }, { value: "ruler", label: "حاكم" }, { value: "woman", label: "امرأة" }, { value: "youth", label: "شاب" }, { value: "elder", label: "شيخ كبير" }, { value: "traveler", label: "رحّالة غريب" }] },
      { key: "expr2", label: "تعبيرها", type: "select", options: [{ value: "neutral", label: "هادئ" }, { value: "happy", label: "سعيد" }, { value: "sad", label: "حزين" }, { value: "angry", label: "غاضب" }, { value: "surprised", label: "مندهش" }, { value: "worried", label: "قلق" }] },
      { key: "talk", label: "من يتكلم (يتحرك فمه)", type: "select", options: [{ value: "", label: "لا أحد" }, { value: "1", label: "الأولى" }, { value: "2", label: "الثانية" }] },
      { key: "look", label: "المظهر", type: "select", options: [{ value: "", label: "حسب القناة" }, { value: "cinema", label: "سينمائي (إضاءة، عمق، جو، أشرطة)" }, { value: "flat", label: "مسطح بسيط" }], help: "السينمائي: الكاميرا تحرك الخلفية أبطأ من الشخصيات (عمق)، وإضاءة وأشعة، وغبار أو جمر، وحبيبات فيلم." },
      { key: "atmos", label: "الجو (في السينمائي)", type: "select", options: [{ value: "", label: "حسب المكان" }, { value: "dust", label: "غبار يطفو" }, { value: "embers", label: "جمر يتطاير" }, { value: "smoke", label: "دخان" }, { value: "rain", label: "مطر" }, { value: "none", label: "بدون" }] },
      { key: "title", label: "المكان (أعلى الشاشة)", type: "text", placeholder: "بغداد" },
      { key: "date", label: "الزمن", type: "text", placeholder: "سنة 1258م" },
    ],
  },
  {
    id: "doc-plate",
    nameAr: "لوحة وثائقية",
    useAr: "صورة واقعية (مولّدة أو أرشيفية) تتحول للقطة سينمائية: حركة كاميرا بطيئة، تلوين، حبيبات فيلم، غبار أو دخان، وعنوان المكان والتاريخ. للتاريخ والوثائقي",
    implemented: true,
    baseSeconds: 7,
    minSeconds: 4,
    fields: [
      { key: "image", label: "الصورة", type: "image", help: "ولّدها من الوصف بالأسفل (Midjourney أو Flux…) بنسبة 16:9 ثم ارفعها هنا. الشورت يقصّ من الوسط حسب «نقطة التركيز»." },
      { key: "prompt", label: "وصف الصورة لأداة التوليد (بالإنجليزية)", type: "textarea", help: "صف المشهد فقط: المكان والزمن والضوء وما يحدث. الاستوديو يضيف أسلوب القناة وقواعد الوجوه تلقائيًا." },
      { key: "image2", label: "اللوحة الثانية (اختيارية)", type: "image", help: "لوحة ثانية تتبدل مع العبارة التالية من الكلام. لوحتان أو ثلاث في المشهد الطويل تبقي الحركة فوق حد القناة." },
      { key: "prompt2", label: "وصف اللوحة الثانية (بالإنجليزية)", type: "textarea" },
      { key: "image3", label: "اللوحة الثالثة (اختيارية)", type: "image" },
      { key: "prompt3", label: "وصف اللوحة الثالثة (بالإنجليزية)", type: "textarea" },
      { key: "look", label: "النوع", type: "select", options: [{ value: "scene", label: "لقطة سينمائية" }, { value: "archive", label: "وثيقة أرشيفية (مخطوطة، خريطة، لوحة)" }] },
      { key: "camera", label: "حركة الكاميرا", type: "select", options: [{ value: "push", label: "اقتراب بطيء" }, { value: "pull", label: "ابتعاد بطيء" }, { value: "pan-right", label: "تحريك لليمين" }, { value: "pan-left", label: "تحريك لليسار" }, { value: "rise", label: "صعود" }, { value: "drift", label: "انجراف هادئ" }] },
      { key: "focus", label: "نقطة التركيز", type: "select", options: [{ value: "center", label: "الوسط" }, { value: "right", label: "اليمين" }, { value: "left", label: "اليسار" }, { value: "top", label: "الأعلى" }, { value: "bottom", label: "الأسفل" }] },
      { key: "grade", label: "التلوين", type: "select", options: [{ value: "warm", label: "دافئ (ذهبي)" }, { value: "cold", label: "بارد" }, { value: "night", label: "ليل" }, { value: "sepia", label: "قديم (بني)" }, { value: "natural", label: "طبيعي" }] },
      { key: "atmos", label: "الجو", type: "select", options: [{ value: "dust", label: "غبار يطفو في الضوء" }, { value: "smoke", label: "دخان/ضباب" }, { value: "embers", label: "جمر يتطاير" }, { value: "rain", label: "مطر" }, { value: "none", label: "بدون" }] },
      { key: "title", label: "المكان (أعلى الشاشة)", type: "text", placeholder: "بغداد" },
      { key: "date", label: "الزمن", type: "text", placeholder: "سنة 1258م" },
      { key: "credit", label: "مصدر الصورة", type: "text", help: "للوثائق والصور الحقيقية من المتاحف: اسم المتحف أو المكتبة." },
      { key: "letterbox", label: "أشرطة السينما", type: "select", options: [{ value: "on", label: "تظهر" }, { value: "off", label: "بدونها" }] },
    ],
  },
  {
    id: "desk-moment",
    nameAr: "لحظة على المكتب",
    useAr: "رسم مسطح بألوان هادئة: شخص على مكتبه يتصفح هاتفه والكاميرا تقترب، ثم ردّة فعل (! ؟ …). لمشاهد الحياة اليومية: خبر، إشعار، رسالة، تشتت",
    implemented: true,
    baseSeconds: 7,
    minSeconds: 4,
    fields: [
      { key: "reaction", label: "ردّة الفعل", type: "select", options: [{ value: "!", label: "! مفاجأة" }, { value: "?", label: "؟ حيرة" }, { value: "...", label: "… تفكير" }, { value: "heart", label: "♥ إعجاب" }, { value: "none", label: "بدون" }] },
      { key: "reactAt", label: "متى تحدث (0.1–0.9 من المشهد)", type: "text", placeholder: "0.6" },
      { key: "push", label: "اقتراب الكاميرا", type: "select", options: [{ value: "on", label: "يقترب ببطء" }, { value: "off", label: "ثابتة" }] },
      { key: "outfit", label: "لون القميص", type: "select", options: [{ value: "blue", label: "أزرق" }, { value: "green", label: "أخضر" }, { value: "sand", label: "رملي" }, { value: "maroon", label: "عنابي" }] },
      { key: "screen", label: "الشاشة", type: "select", options: [{ value: "feed", label: "فاتحة" }, { value: "dark", label: "داكنة" }] },
    ],
  },
  {
    id: "sim-stage",
    nameAr: "المحاكاة",
    useAr: "مسرح مظلم وشخصية بيضاء في بيئة (محل عطور، حظيرة، ورشة) ولوحة كأنها لعبة: مؤشر يمتلئ وعدّاد وقت. للأمثال والتجارب الذهنية «لو جلست ساعتين في…»",
    implemented: true,
    baseSeconds: 7,
    minSeconds: 4,
    fields: [
      { key: "kicker", label: "تمهيد صغير فوق العنوان", type: "text", placeholder: "ركّز معي" },
      { key: "title", label: "العنوان الكبير", type: "text", placeholder: "لو جلست ساعتين في زريبة غنم،" },
      { key: "location", label: "المكان (في اللوحة)", type: "text", placeholder: "داخل الزريبة" },
      { key: "meter", label: "المؤشر", type: "text", placeholder: "ريحة الغنم" },
      { key: "meterTo", label: "يمتلئ حتى (%)", type: "text", placeholder: "100" },
      { key: "timer", label: "العدّاد (دقائق:ثوانٍ)", type: "text", placeholder: "02:00", help: "يعدّ من الصفر إليه طوال المشهد" },
      { key: "timerLabel", label: "تحت العدّاد", type: "text", placeholder: "ساعتين" },
      { key: "env", label: "عنصر البيئة", type: "element", help: "يتكرر حول الشخصية: perfume-shelf، sheep، forge-bellows…" },
      { key: "envLayout", label: "ترتيب البيئة", type: "select", options: [{ value: "shelves", label: "رفوف خلفه" }, { value: "pen", label: "حظيرة بسياج وحوله" }, { value: "row", label: "صف على الأرض" }] },
      { key: "badge", label: "زر/شارة تحت اللوحة", type: "text", placeholder: "عطور" },
      { key: "tone", label: "اللون", type: "select", options: [{ value: "gold", label: "ذهبي (طيّب)" }, { value: "green", label: "أخضر" }, { value: "red", label: "أحمر (تحذير)" }] },
      { key: "aura", label: "خيوط الرائحة/الدخان", type: "select", options: [{ value: "on", label: "تظهر" }, { value: "off", label: "بدونها" }] },
      { key: "variant", label: "الشخصية", type: "variant" },
      { key: "pose", label: "الوضعية", type: "pose" },
    ],
  },
  {
    id: "summary",
    nameAr: "الخلاصة",
    useAr: "خلاصة الفصل في جملة",
    implemented: true,
    baseSeconds: 6,
    minSeconds: 5,
    fields: [
      { key: "text", label: "الخلاصة", type: "textarea" },
      { key: "element", label: "رمز", type: "element" },
    ],
  },
  {
    id: "end-screen",
    nameAr: "شاشة النهاية",
    useAr: "آخر 20 ثانية: الخطوة العملية وأماكن عناصر يوتيوب",
    implemented: true,
    baseSeconds: 20,
    minSeconds: 20,
    fields: [
      { key: "step", label: "الخطوة العملية", type: "textarea" },
      { key: "prompt", label: "سؤال التعليقات", type: "text", placeholder: "اكتب في التعليقات: ما المهمة التي اخترتها؟" },
    ],
  },
];

export const templateById = (id: string) => templateDefs.find((t) => t.id === id);
