import React from "react";
import type { ElementDef } from "../types";
import { L, S } from "../helpers";

/**
 * رموز وواجهة: أسهم وعلامات وفقاعات كلام.
 * هذه الفئة هي المرجع لأسلوب الرسم: مساحة 120×120، هامش 10 تقريبًا،
 * أشكال ممتلئة مستديرة الزوايا، وتفاصيل داخلية بخطوط L(p).
 */
export const elements: ElementDef[] = [
  {
    id: "arrow-left",
    nameAr: "سهم لليسار",
    category: "ui",
    tags: ["سهم", "اتجاه", "التالي"],
    draw: (p) => <path {...S(p)} fill={p.main} d="M14 60 L58 20 V44 H104 Q108 44 108 48 V72 Q108 76 104 76 H58 V100 Z" />,
  },
  {
    id: "arrow-right",
    nameAr: "سهم لليمين",
    category: "ui",
    tags: ["سهم", "اتجاه", "رجوع"],
    draw: (p) => <path {...S(p)} fill={p.main} d="M106 60 L62 20 V44 H16 Q12 44 12 48 V72 Q12 76 16 76 H62 V100 Z" />,
  },
  {
    id: "arrow-up",
    nameAr: "سهم للأعلى",
    category: "ui",
    tags: ["سهم", "صعود", "زيادة"],
    draw: (p) => <path {...S(p)} fill={p.second} d="M60 12 L100 56 H76 V104 Q76 108 72 108 H48 Q44 108 44 104 V56 H20 Z" />,
  },
  {
    id: "arrow-down",
    nameAr: "سهم للأسفل",
    category: "ui",
    tags: ["سهم", "نزول", "نقص"],
    draw: (p) => <path {...S(p)} fill={p.second} d="M60 108 L100 64 H76 V16 Q76 12 72 12 H48 Q44 12 44 16 V64 H20 Z" />,
  },
  {
    id: "arrow-curve",
    nameAr: "سهم منحنٍ",
    category: "ui",
    tags: ["سهم", "تحول", "انتقال"],
    draw: (p) => (
      <>
        <path {...L(p, 10)} stroke={p.style === "line" ? p.line : p.main} d="M98 88 Q98 30 40 30" />
        <path {...S(p)} fill={p.main} d="M18 30 L44 10 V50 Z" />
      </>
    ),
  },
  {
    id: "check",
    nameAr: "علامة صح",
    category: "ui",
    tags: ["صح", "صواب", "تم", "افعل"],
    draw: (p) => (
      <>
        <circle {...S(p)} cx={60} cy={60} r={50} fill={p.second} />
        <path {...L(p, 12)} stroke={p.style === "line" ? p.line : p.light} d="M36 62 L54 80 L86 42" />
      </>
    ),
  },
  {
    id: "cross",
    nameAr: "علامة خطأ",
    category: "ui",
    tags: ["خطأ", "لا", "تجنب"],
    draw: (p) => (
      <>
        <circle {...S(p)} cx={60} cy={60} r={50} fill={p.main} />
        <path {...L(p, 12)} stroke={p.style === "line" ? p.line : p.light} d="M40 40 L80 80 M80 40 L40 80" />
      </>
    ),
  },
  {
    id: "plus",
    nameAr: "زائد",
    category: "ui",
    tags: ["زيادة", "إضافة"],
    draw: (p) => <path {...S(p)} fill={p.second} d="M48 14 H72 V48 H106 V72 H72 V106 H48 V72 H14 V48 H48 Z" />,
  },
  {
    id: "minus",
    nameAr: "ناقص",
    category: "ui",
    tags: ["نقص", "طرح"],
    draw: (p) => <rect {...S(p)} x={14} y={48} width={92} height={24} rx={6} fill={p.main} />,
  },
  {
    id: "equals",
    nameAr: "يساوي",
    category: "ui",
    tags: ["مساواة", "نتيجة"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={16} y={32} width={88} height={20} rx={6} fill={p.second} />
        <rect {...S(p)} x={16} y={68} width={88} height={20} rx={6} fill={p.second} />
      </>
    ),
  },
  {
    id: "question-mark",
    nameAr: "علامة استفهام",
    category: "ui",
    tags: ["سؤال", "استفهام", "حيرة"],
    draw: (p) => (
      <>
        <path
          {...S(p)}
          fill={p.main}
          d="M34 42 Q34 12 62 12 Q90 12 90 38 Q90 54 74 62 Q68 66 68 74 V80 H50 V70 Q50 56 64 48 Q72 44 72 38 Q72 30 62 30 Q52 30 52 42 Z"
        />
        <circle {...S(p)} cx={59} cy={98} r={11} fill={p.main} />
      </>
    ),
  },
  {
    id: "exclamation",
    nameAr: "علامة تعجب",
    category: "ui",
    tags: ["تنبيه", "انتباه", "مهم"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d="M48 12 H72 L68 78 H52 Z" />
        <circle {...S(p)} cx={60} cy={98} r={11} fill={p.second} />
      </>
    ),
  },
  {
    id: "warning",
    nameAr: "تحذير",
    category: "ui",
    tags: ["خطر", "تحذير", "انتبه"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.accent} d="M60 10 Q64 10 66 14 L110 96 Q112 104 104 104 H16 Q8 104 10 96 L54 14 Q56 10 60 10 Z" />
        <path {...L(p, 9)} stroke={p.style === "line" ? p.line : p.dark} d="M60 42 V70" />
        <circle cx={60} cy={86} r={5} fill={p.style === "line" ? p.line : p.dark} />
      </>
    ),
  },
  {
    id: "quote-open",
    nameAr: "علامة اقتباس",
    category: "ui",
    tags: ["اقتباس", "قول", "كلام"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d="M18 70 Q18 30 50 22 L54 32 Q38 40 38 54 H54 V96 H18 Z" />
        <path {...S(p)} fill={p.main} d="M66 70 Q66 30 98 22 L102 32 Q86 40 86 54 H102 V96 H66 Z" />
      </>
    ),
  },
  {
    id: "speech-bubble",
    nameAr: "فقاعة كلام",
    category: "ui",
    tags: ["كلام", "حوار", "قول"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.light} d="M14 24 Q14 14 24 14 H96 Q106 14 106 24 V74 Q106 84 96 84 H52 L30 104 V84 H24 Q14 84 14 74 Z" />
        <path {...L(p)} d="M32 38 H88 M32 52 H88 M32 66 H66" opacity={0.6} />
      </>
    ),
  },
  {
    id: "thought-bubble",
    nameAr: "فقاعة تفكير",
    category: "ui",
    tags: ["تفكير", "خاطرة", "تأمل"],
    draw: (p) => (
      <>
        <path
          {...S(p)}
          fill={p.light}
          d="M30 70 Q12 70 12 54 Q12 38 28 38 Q30 18 52 18 Q66 10 80 20 Q104 18 106 40 Q114 54 102 66 Q98 80 80 78 Q66 88 50 78 Q40 82 30 70 Z"
        />
        <circle {...S(p)} cx={30} cy={92} r={8} fill={p.light} />
        <circle {...S(p)} cx={16} cy={108} r={5} fill={p.light} />
      </>
    ),
  },
  {
    id: "dots-typing",
    nameAr: "نقاط انتظار",
    category: "ui",
    tags: ["انتظار", "صمت", "تفكير"],
    draw: (p) => (
      <>
        <circle {...S(p)} cx={28} cy={60} r={12} fill={p.main} />
        <circle {...S(p)} cx={60} cy={60} r={12} fill={p.second} />
        <circle {...S(p)} cx={92} cy={60} r={12} fill={p.main} />
      </>
    ),
  },
  {
    id: "lightbulb",
    nameAr: "مصباح فكرة",
    category: "ui",
    tags: ["فكرة", "إلهام", "حل"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.metal} d="M60 10 Q94 10 94 44 Q94 62 78 74 V84 H42 V74 Q26 62 26 44 Q26 10 60 10 Z" />
        <rect {...S(p)} x={42} y={86} width={36} height={10} rx={3} fill={p.dark} />
        <rect {...S(p)} x={46} y={98} width={28} height={10} rx={4} fill={p.dark} />
        <path {...L(p)} d="M50 72 V54 Q60 46 70 54 V72" opacity={0.5} />
      </>
    ),
  },
  {
    id: "target",
    nameAr: "هدف",
    category: "ui",
    tags: ["هدف", "غاية", "تركيز"],
    draw: (p) => (
      <>
        <circle {...S(p)} cx={56} cy={64} r={46} fill={p.light} />
        <circle {...S(p)} cx={56} cy={64} r={32} fill={p.main} />
        <circle {...S(p)} cx={56} cy={64} r={18} fill={p.light} />
        <circle {...S(p)} cx={56} cy={64} r={7} fill={p.main} />
        <path {...L(p, 5)} stroke={p.edge} d="M58 62 L104 16" />
        <path {...S(p)} fill={p.second} d="M100 8 L112 8 L112 20 L104 20 L100 16 Z" />
      </>
    ),
  },
  {
    id: "flag",
    nameAr: "راية",
    category: "ui",
    tags: ["إنجاز", "وصول", "هدف"],
    draw: (p) => (
      <>
        <path {...L(p, 6)} stroke={p.edge} d="M30 110 V12" />
        <path {...S(p)} fill={p.main} d="M32 14 Q56 6 70 16 Q86 26 104 18 V64 Q86 72 70 62 Q56 52 32 60 Z" />
      </>
    ),
  },
  {
    id: "pin",
    nameAr: "دبوس موقع",
    category: "ui",
    tags: ["مكان", "موقع", "نقطة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d="M60 112 Q22 70 22 46 Q22 10 60 10 Q98 10 98 46 Q98 70 60 112 Z" />
        <circle {...S(p)} cx={60} cy={46} r={14} fill={p.light} />
      </>
    ),
  },
  {
    id: "search",
    nameAr: "عدسة بحث",
    category: "ui",
    tags: ["بحث", "تدقيق", "تحقق"],
    draw: (p) => (
      <>
        <path {...L(p, 14)} stroke={p.edge} d="M78 78 L106 106" />
        <circle {...S(p)} cx={50} cy={50} r={38} fill={p.dark} />
        <circle {...S(p)} cx={50} cy={50} r={28} fill={p.water} />
        <path d="M34 42 Q38 30 50 28" stroke={p.light} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.8} />
      </>
    ),
  },
  {
    id: "lock",
    nameAr: "قفل",
    category: "ui",
    tags: ["قفل", "منع", "خصوصية"],
    draw: (p) => (
      <>
        <path {...L(p, 10)} stroke={p.edge} d="M38 52 V36 Q38 14 60 14 Q82 14 82 36 V52" />
        <rect {...S(p)} x={24} y={50} width={72} height={58} rx={10} fill={p.metal} />
        <circle cx={60} cy={74} r={7} fill={p.dark} />
        <path d="M60 78 V92" stroke={p.dark} strokeWidth={6} strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "unlock",
    nameAr: "قفل مفتوح",
    category: "ui",
    tags: ["فتح", "تحرر", "حل"],
    draw: (p) => (
      <>
        <path {...L(p, 10)} stroke={p.edge} d="M38 52 V36 Q38 14 60 14 Q82 14 82 30" />
        <rect {...S(p)} x={24} y={50} width={72} height={58} rx={10} fill={p.second} />
        <circle cx={60} cy={74} r={7} fill={p.dark} />
        <path d="M60 78 V92" stroke={p.dark} strokeWidth={6} strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "key",
    nameAr: "مفتاح",
    category: "ui",
    tags: ["مفتاح", "حل", "سر"],
    draw: (p) => (
      <>
        <circle {...S(p)} cx={36} cy={60} r={24} fill={p.metal} />
        <circle {...S(p)} cx={30} cy={60} r={8} fill={p.style === "line" ? p.light : p.bg} />
        <path {...S(p)} fill={p.metal} d="M58 54 H108 V66 H100 V80 H90 V66 H82 V76 H72 V66 H58 Z" />
      </>
    ),
  },
  {
    id: "link",
    nameAr: "حلقتا سلسلة",
    category: "ui",
    tags: ["ربط", "علاقة", "صلة"],
    draw: (p) => (
      <>
        <rect {...L(p, 12)} stroke={p.style === "line" ? p.line : p.main} x={12} y={38} width={56} height={44} rx={22} transform="rotate(-30 40 60)" />
        <rect {...L(p, 12)} stroke={p.style === "line" ? p.line : p.second} x={52} y={38} width={56} height={44} rx={22} transform="rotate(-30 80 60)" />
      </>
    ),
  },
  {
    id: "refresh",
    nameAr: "تكرار ودوران",
    category: "ui",
    tags: ["تكرار", "عادة", "دورة"],
    draw: (p) => (
      <>
        <path {...L(p, 10)} stroke={p.style === "line" ? p.line : p.main} d="M96 52 A38 38 0 0 0 26 40" />
        <path {...L(p, 10)} stroke={p.style === "line" ? p.line : p.main} d="M24 68 A38 38 0 0 0 94 80" />
        <path {...S(p)} fill={p.main} d="M10 30 L36 26 L30 52 Z" />
        <path {...S(p)} fill={p.main} d="M110 90 L84 94 L90 68 Z" />
      </>
    ),
  },
  {
    id: "bell",
    nameAr: "جرس تنبيه",
    category: "ui",
    tags: ["تنبيه", "إشعار", "تذكير"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.metal} d="M60 14 Q88 14 90 46 L92 72 Q94 82 104 88 V94 H16 V88 Q26 82 28 72 L30 46 Q32 14 60 14 Z" />
        <circle {...S(p)} cx={60} cy={104} r={10} fill={p.dark} />
        <circle {...S(p)} cx={60} cy={12} r={6} fill={p.dark} />
      </>
    ),
  },
  {
    id: "bookmark",
    nameAr: "علامة حفظ",
    category: "ui",
    tags: ["حفظ", "تذكر"],
    draw: (p) => <path {...S(p)} fill={p.main} d="M30 12 H90 Q94 12 94 16 V110 L60 86 L26 110 V16 Q26 12 30 12 Z" />,
  },
  {
    id: "star-badge",
    nameAr: "نجمة تقييم",
    category: "ui",
    tags: ["تميز", "تقييم", "أفضل"],
    draw: (p) => (
      <path
        {...S(p)}
        fill={p.metal}
        d="M60 8 L74 42 L110 44 L82 68 L92 104 L60 84 L28 104 L38 68 L10 44 L46 42 Z"
      />
    ),
  },
  {
    id: "number-circle",
    nameAr: "دائرة رقم",
    category: "ui",
    tags: ["رقم", "ترتيب", "خطوة"],
    note: "تُكتب فوقها الأرقام في القوالب؛ الدائرة نفسها فارغة.",
    draw: (p) => (
      <>
        <circle {...S(p)} cx={60} cy={60} r={50} fill={p.main} />
        <circle {...L(p)} stroke={p.style === "line" ? p.line : p.light} cx={60} cy={60} r={40} opacity={0.5} />
      </>
    ),
  },
  {
    id: "timer",
    nameAr: "مؤقت",
    category: "ui",
    tags: ["وقت", "سرعة", "عد تنازلي"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={50} y={6} width={20} height={12} rx={3} fill={p.dark} />
        <circle {...S(p)} cx={60} cy={66} r={46} fill={p.light} />
        <path {...S(p)} fill={p.main} d="M60 66 V26 A40 40 0 0 1 98 56 Z" />
        <path {...L(p, 6)} d="M60 66 L80 46" />
        <circle cx={60} cy={66} r={6} fill={p.dark} />
      </>
    ),
  },
  {
    id: "sparkle",
    nameAr: "لمعة",
    category: "ui",
    tags: ["لمعان", "جديد", "بركة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.metal} d="M54 10 Q58 50 94 56 Q58 62 54 104 Q50 62 14 56 Q50 50 54 10 Z" />
        <path {...S(p)} fill={p.second} d="M94 8 Q96 22 108 24 Q96 26 94 40 Q92 26 80 24 Q92 22 94 8 Z" />
      </>
    ),
  },
  {
    id: "burst",
    nameAr: "انفجار لحظة",
    category: "ui",
    tags: ["مفاجأة", "صدمة", "لحظة"],
    draw: (p) => (
      <path
        {...S(p)}
        fill={p.accent}
        d="M60 6 L70 36 L100 20 L86 50 L116 60 L86 70 L100 100 L70 84 L60 114 L50 84 L20 100 L34 70 L4 60 L34 50 L20 20 L50 36 Z"
      />
    ),
  },
  {
    id: "loading-ring",
    nameAr: "حلقة تقدم",
    category: "ui",
    tags: ["تقدم", "نسبة", "مرحلة"],
    draw: (p) => (
      <>
        <circle cx={60} cy={60} r={44} fill="none" stroke={p.style === "line" ? p.second : p.edge} strokeOpacity={p.style === "line" ? 1 : 0.2} strokeWidth={16} />
        <path d="M60 16 A44 44 0 1 1 16 60" fill="none" stroke={p.style === "line" ? p.line : p.main} strokeWidth={16} strokeLinecap="round" />
      </>
    ),
  },
];
