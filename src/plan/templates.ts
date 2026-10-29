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
  { id: "hadith-card", nameAr: "بطاقة الحديث", useAr: "نص الحديث ومصدره ودرجته", implemented: false, baseSeconds: 7, fields: [{ key: "text", label: "نص الحديث", type: "textarea" }, { key: "reference", label: "المصدر والدرجة", type: "text" }] },
  { id: "comparison", nameAr: "المقارنة", useAr: "جانبان متقابلان", implemented: false, baseSeconds: 6, fields: [{ key: "left", label: "الجانب الأول", type: "text" }, { key: "right", label: "الجانب الثاني", type: "text" }] },
  { id: "list", nameAr: "القائمة", useAr: "نقاط تظهر تباعًا", implemented: false, baseSeconds: 6, fields: [{ key: "items", label: "النقاط (سطر لكل نقطة)", type: "textarea" }] },
  { id: "big-number", nameAr: "الرقم الكبير", useAr: "رقم أو نسبة صادمة", implemented: false, baseSeconds: 5, fields: [{ key: "number", label: "الرقم", type: "text" }, { key: "caption", label: "الوصف", type: "text" }] },
  { id: "chart", nameAr: "الرسم البياني", useAr: "مقارنة أرقام", implemented: false, baseSeconds: 6, fields: [{ key: "data", label: "البيانات (اسم: قيمة في كل سطر)", type: "textarea" }] },
  { id: "timeline", nameAr: "الخط الزمني", useAr: "أحداث بترتيبها", implemented: false, baseSeconds: 7, fields: [{ key: "events", label: "الأحداث (سطر لكل حدث)", type: "textarea" }] },
  { id: "symbolic", nameAr: "المشهد الرمزي", useAr: "عنصر رمزي كبير يعبّر عن الفكرة", implemented: false, baseSeconds: 5, fields: [{ key: "element", label: "العنصر", type: "element" }] },
  { id: "summary", nameAr: "الخلاصة", useAr: "خلاصة الفصل في جملة", implemented: false, baseSeconds: 5, fields: [{ key: "text", label: "الخلاصة", type: "textarea" }] },
  { id: "end-screen", nameAr: "شاشة النهاية", useAr: "آخر 20 ثانية للحلقة", implemented: false, baseSeconds: 20, fields: [] },
];

export const templateById = (id: string) => templateDefs.find((t) => t.id === id);
