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
};

const side = { value: "right", label: "يمين" };

export const templateDefs: TemplateDef[] = [
  {
    id: "big-question",
    nameAr: "السؤال الكبير",
    useAr: "افتتاح الفصل بسؤال واحد بخط كبير",
    implemented: true,
    baseSeconds: 5,
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
    fields: [
      { key: "line", label: "عبارة الفقاعة", type: "textarea", help: "قصيرة: ثماني كلمات أو أقل" },
      { key: "variant", label: "الشخصية", type: "variant" },
      { key: "pose", label: "الوضعية", type: "pose" },
      { key: "element", label: "عنصر بجوارها", type: "element" },
      { key: "side", label: "جهة الشخصية", type: "select", options: [side, { value: "left", label: "يسار" }] },
    ],
  },
  {
    id: "verse-card",
    nameAr: "بطاقة الآية",
    useAr: "عرض آية بنصها من المصدر المعتمد",
    implemented: true,
    baseSeconds: 7,
    fields: [
      { key: "text", label: "نص الآية", type: "textarea", help: "يُجلب من Quran Foundation ولا يُعدَّل يدويًا" },
      { key: "reference", label: "المرجع", type: "text" },
      { key: "reciter", label: "القارئ", type: "text", help: "يظهر فقط إن صاحبت الآيةَ تلاوةٌ مرخّصة" },
    ],
  },
  {
    id: "hadith-card",
    nameAr: "بطاقة الحديث",
    useAr: "نص الحديث بمصدره ودرجته",
    implemented: false,
    baseSeconds: 8,
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
    implemented: false,
    baseSeconds: 7,
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
    implemented: false,
    baseSeconds: 7,
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
    implemented: false,
    baseSeconds: 5,
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
    implemented: false,
    baseSeconds: 7,
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
    implemented: false,
    baseSeconds: 8,
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
    implemented: false,
    baseSeconds: 5,
    fields: [
      { key: "element", label: "العنصر", type: "element" },
      { key: "secondElement", label: "عنصر ثانٍ (اختياري)", type: "element" },
      { key: "relation", label: "العلاقة بينهما", type: "select", options: [{ value: "becomes", label: "يتحول إلى ←" }, { value: "versus", label: "مقابل" }, { value: "plus", label: "مع +" }] },
      { key: "caption", label: "عبارة قصيرة", type: "text" },
      { key: "effect", label: "الحركة", type: "select", options: [{ value: "pop", label: "ظهور" }, { value: "grow", label: "نمو" }, { value: "shake", label: "اهتزاز" }, { value: "float", label: "طفو" }] },
    ],
  },
  {
    id: "summary",
    nameAr: "الخلاصة",
    useAr: "خلاصة الفصل في جملة",
    implemented: false,
    baseSeconds: 6,
    fields: [
      { key: "text", label: "الخلاصة", type: "textarea" },
      { key: "element", label: "رمز", type: "element" },
    ],
  },
  {
    id: "end-screen",
    nameAr: "شاشة النهاية",
    useAr: "آخر 20 ثانية: الخطوة العملية وأماكن عناصر يوتيوب",
    implemented: false,
    baseSeconds: 20,
    fields: [
      { key: "step", label: "الخطوة العملية", type: "textarea" },
      { key: "prompt", label: "سؤال التعليقات", type: "text", placeholder: "اكتب في التعليقات: ما المهمة التي اخترتها؟" },
    ],
  },
];

export const templateById = (id: string) => templateDefs.find((t) => t.id === id);
