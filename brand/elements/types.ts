import type React from "react";
import type { ThemeId } from "../themes";

/**
 * لوحة ألوان العناصر لكل ثيم. كل عنصر يُرسم بهذه الرموز الدلالية فقط
 * (لا ألوان ثابتة داخل الرسم) حتى يتبدل شكله تلقائيًا مع الثيم.
 */
export type ElementPalette = {
  themeId: ThemeId;
  /** line = حبر وورق (خطوط حبر وتعبئة فاتحة)، flat = مسطح ملون بلا حدود */
  style: "line" | "flat";
  /** حدّ الأشكال الخارجي: في line حبر بسمك 3، وفي flat لا حدّ */
  stroke: string;
  sw: number;
  /** خطوط التفاصيل الداخلية (صفحات كتاب، نوافذ…) تظهر في الأسلوبين */
  line: string;
  lw: number;
  /** خط أو مقبض قائم بذاته فوق الخلفية مباشرة (سارية، عصا، يد عدسة): يضمن التباين مع خلفية الثيم */
  edge: string;
  /** التعبئة الرئيسية للجسم */
  main: string;
  /** تعبئة ثانوية */
  second: string;
  /** لون تمييز صغير (نقطة، شعلة، علامة) */
  accent: string;
  /** محايد فاتح (ورق، جدران، غيوم) */
  light: string;
  /** محايد داكن (ظلال قوية، فتحات، شعر) */
  dark: string;
  /** لون البشرة للأيدي */
  skin: string;
  /** ذهب ومعادن وعملات */
  metal: string;
  /** خشب */
  wood: string;
  /** نبات */
  green: string;
  /** ماء وسماء */
  water: string;
  /** ظل شفاف تحت العناصر */
  shadow: string;
  /** ألوان المشهد العامة */
  bg: string;
  surface: string;
  ink: string;
};

export type ElementCategory =
  | "ui"
  | "nature"
  | "home"
  | "daily"
  | "money"
  | "knowledge"
  | "islamic"
  | "mind"
  | "hands"
  | "frames"
  | "backdrops";

export type ElementDef = {
  /** معرّف إنجليزي فريد بشرطات، يُستخدم في السكريبت والكود: book-open */
  id: string;
  nameAr: string;
  category: ElementCategory;
  /** كلمات بحث عربية */
  tags: string[];
  /** يُرسم داخل مساحة 120×120 (للخلفيات: مساحة w×h) */
  draw: (p: ElementPalette, size: { w: number; h: number }) => React.ReactNode;
  /** الخلفيات تُرسم بمقاس المشهد كاملًا */
  kind?: "prop" | "backdrop";
  /** ملاحظة استخدام أو ضابط شرعي */
  note?: string;
};

export const categoryNamesAr: Record<ElementCategory, string> = {
  ui: "رموز وواجهة",
  nature: "الطبيعة والكون",
  home: "البيت والأسرة",
  daily: "الحياة اليومية والتقنية",
  money: "المال والتجارة",
  knowledge: "العلم والحضارة",
  islamic: "رموز إسلامية",
  mind: "النفس والمشاعر",
  hands: "الأيدي والإشارات",
  frames: "إطارات وزخارف",
  backdrops: "الخلفيات",
};

export const categoryOrder: ElementCategory[] = [
  "ui",
  "mind",
  "nature",
  "home",
  "daily",
  "money",
  "knowledge",
  "islamic",
  "hands",
  "frames",
  "backdrops",
];
