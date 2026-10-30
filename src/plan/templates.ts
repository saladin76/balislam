/**
 * تعريف القوالب كبيانات: الاسم، هل بُني، والحقول التي يعرضها الاستوديو لكل قالب.
 * مشترك بين مولّد الخطة والاستوديو وتكوين الحلقة.
 */
export type FieldType = "text" | "textarea" | "element" | "variant" | "pose" | "select" | "number" | "boolean";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  help?: string;
  placeholder?: string;
};

export type TemplateDef = {
  id: string;
  nameAr: string;
  /** وصف قصير لمتى يُستخدم */
  useAr: string;
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
      { key: "text", label: "نص الآية", type: "textarea", help: "يُجلب من Quran Foundation ولا يُعدَّل يدويًا" },
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
      { key: "element", label: "العنصر", type: "element" },
      { key: "secondElement", label: "عنصر ثانٍ (اختياري)", type: "element" },
      { key: "relation", label: "العلاقة بينهما", type: "select", options: [{ value: "becomes", label: "يتحول إلى ←" }, { value: "versus", label: "مقابل" }, { value: "plus", label: "مع +" }] },
      { key: "caption", label: "عبارة قصيرة", type: "text" },
      { key: "effect", label: "الحركة", type: "select", options: [{ value: "pop", label: "ظهور" }, { value: "grow", label: "نمو" }, { value: "shake", label: "اهتزاز" }, { value: "float", label: "طفو" }] },
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
      { key: "board", label: "السبورة", type: "select", options: [{ value: "white", label: "بيضاء (حبر وأخضر)" }, { value: "green", label: "خضراء (طباشير)" }] },
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
