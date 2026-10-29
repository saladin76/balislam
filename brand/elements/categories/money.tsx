import React from "react";
import type { ElementDef, ElementPalette } from "../types";
import { L, S, tint } from "../helpers";

/**
 * المال والتجارة: عملات وأوراق نقدية وميزان ورسوم بيانية ومتجر.
 * الذهب والعملات بـ p.metal، والأوراق النقدية بـ p.second، بلا أرقام ولا كتابة.
 */

/** حدّ رفيع يفصل الأشكال المتراكبة من نفس اللون في الثيمات المسطحة */
const rim = (p: ElementPalette) => ({ ...L(p, 2), opacity: p.style === "line" ? 0 : 0.3 });

/** عملة مرئية من الجانب (قرص بسماكة) داخل رصّة */
const coinDisc = (p: ElementPalette, cx: number, y: number, rx: number, ry: number, h: number, key?: string) => (
  <g key={key}>
    <path {...S(p)} fill={p.metal} d={`M${cx - rx} ${y} V${y + h} A${rx} ${ry} 0 0 0 ${cx + rx} ${y + h} V${y} Z`} />
    <path {...L(p, 2)} opacity={0.35} d={`M${cx - rx} ${y + h / 2} A${rx} ${ry} 0 0 0 ${cx + rx} ${y + h / 2}`} />
    <ellipse {...S(p)} cx={cx} cy={y} rx={rx} ry={ry} fill={p.metal} />
    <ellipse {...L(p, 2)} cx={cx} cy={y} rx={rx - 7} ry={ry - 3} opacity={0.4} />
    <path {...rim(p)} d={`M${cx - rx} ${y} A${rx} ${ry} 0 0 0 ${cx + rx} ${y}`} />
  </g>
);

/** عملة أمامية صغيرة */
const coinFace = (p: ElementPalette, cx: number, cy: number, r: number, key?: string) => (
  <g key={key}>
    <circle {...S(p)} cx={cx} cy={cy} r={r} fill={p.metal} />
    <circle {...L(p, 2)} cx={cx} cy={cy} r={r * 0.7} opacity={0.45} />
    <circle {...rim(p)} cx={cx} cy={cy} r={r} />
  </g>
);

/** ورقة نقدية بزخرفة بلا أرقام */
const note = (p: ElementPalette, x: number, y: number, w: number, h: number, transform?: string, key?: string) => (
  <g key={key} transform={transform}>
    <rect {...S(p)} x={x} y={y} width={w} height={h} rx={6} fill={p.second} />
    <rect {...L(p, 2)} x={x + 7} y={y + 7} width={w - 14} height={h - 14} rx={4} opacity={0.45} />
    <ellipse {...S(p)} cx={x + w / 2} cy={y + h / 2} rx={h * 0.26} ry={h * 0.3} fill={tint(p, p.light)} opacity={p.style === "line" ? 1 : 0.55} />
    <path {...L(p, 2)} opacity={0.5} d={`M${x + w / 2} ${y + h / 2 - h * 0.16} L${x + w / 2 + h * 0.12} ${y + h / 2} L${x + w / 2} ${y + h / 2 + h * 0.16} L${x + w / 2 - h * 0.12} ${y + h / 2} Z`} />
    <circle cx={x + 16} cy={y + h / 2} r={4} fill={p.line} opacity={0.35} />
    <circle cx={x + w - 16} cy={y + h / 2} r={4} fill={p.line} opacity={0.35} />
    <rect {...rim(p)} x={x} y={y} width={w} height={h} rx={6} />
  </g>
);

/** ميزان بكفتين؛ tilt بالدرجات (موجب = الكفة اليسرى أثقل) */
const scale = (p: ElementPalette, tilt: number, heavy: boolean) => {
  const r = (tilt * Math.PI) / 180;
  const half = 40;
  const lx = 60 - half * Math.cos(r);
  const ly = 30 + half * Math.sin(r);
  const rx = 60 + half * Math.cos(r);
  const ry = 30 - half * Math.sin(r);
  const pan = (cx: number, top: number) => (
    <>
      <path {...L(p, 3)} stroke={p.edge} d={`M${cx} ${top - 40} L${cx - 15} ${top} M${cx} ${top - 40} L${cx + 15} ${top}`} />
      <path {...S(p)} fill={p.main} d={`M${cx - 19} ${top} H${cx + 19} Q${cx + 17} ${top + 14} ${cx} ${top + 14} Q${cx - 17} ${top + 14} ${cx - 19} ${top} Z`} />
    </>
  );
  return (
    <>
      {heavy && (
        <>
          {coinDisc(p, lx, ly + 34, 11, 4, 4)}
          {coinDisc(p, lx, ly + 28, 11, 4, 4)}
        </>
      )}
      {pan(lx, ly + 40)}
      {pan(rx, ry + 40)}
      <path {...S(p)} fill={p.metal} d="M56 30 H64 V100 H56 Z" />
      <path {...S(p)} fill={p.metal} d="M36 110 Q36 98 48 98 H72 Q84 98 84 110 Z" />
      <rect {...S(p)} x={60 - half - 4} y={26} width={2 * half + 8} height={8} rx={4} fill={p.metal} transform={`rotate(${-tilt} 60 30)`} />
      <circle {...S(p)} cx={60} cy={30} r={7} fill={p.dark} />
      <path {...S(p)} fill={p.metal} d="M60 8 L66 18 L60 22 L54 18 Z" />
    </>
  );
};

export const elements: ElementDef[] = [
  {
    id: "coin",
    nameAr: "عملة نقدية",
    category: "money",
    tags: ["عملة", "دينار", "مال", "نقود", "ذهب"],
    draw: (p) => (
      <>
        <circle {...S(p)} cx={60} cy={60} r={48} fill={p.metal} />
        <circle {...L(p)} cx={60} cy={60} r={37} opacity={0.45} />
        <path {...L(p)} opacity={0.55} d="M60 40 Q64 56 80 60 Q64 64 60 80 Q56 64 40 60 Q56 56 60 40 Z" />
        <path d="M30 46 Q36 30 52 24" stroke={p.light} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.7} />
      </>
    ),
  },
  {
    id: "coin-stack",
    nameAr: "رصّة عملات",
    category: "money",
    tags: ["عملات", "ادخار", "مال", "ثروة"],
    draw: (p) => <>{[0, 1, 2, 3, 4].map((i) => coinDisc(p, 60, 92 - i * 15, 38, 12, 12, `c${i}`))}</>,
  },
  {
    id: "coins-pile",
    nameAr: "كومة عملات",
    category: "money",
    tags: ["عملات", "كنز", "ثروة", "مال كثير"],
    draw: (p) => (
      <>
        <ellipse cx={60} cy={108} rx={50} ry={6} fill={p.shadow} />
        {([
          [24, 92],
          [48, 94],
          [72, 94],
          [96, 92],
          [36, 70],
          [60, 72],
          [84, 70],
          [48, 48],
          [72, 48],
          [60, 26],
        ] as [number, number][]).map(([x, y], i) => coinFace(p, x, y, 14, `c${i}`))}
      </>
    ),
  },
  {
    id: "banknote",
    nameAr: "ورقة نقدية",
    category: "money",
    tags: ["نقود", "ورقة", "مال", "عملة"],
    draw: (p) => note(p, 10, 30, 100, 60),
  },
  {
    id: "banknotes-stack",
    nameAr: "رزمة أوراق نقدية",
    category: "money",
    tags: ["نقود", "رزمة", "مال", "ثروة"],
    draw: (p) => (
      <>
        {note(p, 12, 36, 92, 54, "rotate(-12 60 64)", "a")}
        {note(p, 14, 38, 92, 54, "rotate(-2 60 64)", "b")}
        {note(p, 16, 42, 92, 54, "rotate(8 60 68)", "c")}
        <rect {...S(p)} x={52} y={36} width={16} height={64} rx={3} fill={p.accent} transform="rotate(8 60 68)" />
      </>
    ),
  },
  {
    id: "wallet",
    nameAr: "محفظة",
    category: "money",
    tags: ["محفظة", "نقود", "مصروف", "رزق"],
    draw: (p) => (
      <>
        {note(p, 22, 14, 62, 36, "rotate(-6 53 32)")}
        <rect {...S(p)} x={10} y={34} width={94} height={70} rx={12} fill={p.main} />
        <rect {...L(p, 2)} x={16} y={40} width={82} height={58} rx={8} strokeDasharray="5 5" opacity={0.4} />
        <path {...S(p)} fill={tint(p, p.dark)} d="M66 54 H108 Q112 54 112 58 V80 Q112 84 108 84 H66 Q60 84 60 78 V60 Q60 54 66 54 Z" />
        <circle {...S(p)} cx={74} cy={69} r={6} fill={p.metal} />
      </>
    ),
  },
  {
    id: "wallet-empty",
    nameAr: "محفظة فارغة",
    category: "money",
    tags: ["فقر", "إفلاس", "فراغ", "دين", "حاجة"],
    draw: (p) => {
      const moth = (x: number, y: number, s: number, rot: number) => (
        <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
          <path {...S(p)} fill={tint(p, p.light)} d="M0 0 Q-14 -14 -18 -4 Q-16 6 0 2 Z M0 0 Q14 -14 18 -4 Q16 6 0 2 Z" />
          <path {...S(p)} fill={tint(p, p.light)} d="M0 2 Q-10 4 -10 12 Q-4 12 0 4 Z M0 2 Q10 4 10 12 Q4 12 0 4 Z" />
          <path d="M0 -4 V8" stroke={p.edge} strokeWidth={3 / s} strokeLinecap="round" />
        </g>
      );
      return (
        <>
          <path {...L(p, 2)} stroke={p.edge} strokeDasharray="3 6" opacity={0.6} d="M56 50 Q46 36 40 34 M64 50 Q76 30 88 22" />
          <rect {...S(p)} x={16} y={46} width={80} height={14} rx={6} fill={p.dark} />
          <path {...S(p)} fill={p.main} d="M10 60 Q10 54 16 54 H96 Q104 54 104 62 V98 Q104 108 94 108 H20 Q10 108 10 98 Z" />
          <rect {...L(p, 2)} x={16} y={60} width={82} height={42} rx={7} strokeDasharray="5 5" opacity={0.4} />
          <path {...S(p)} fill={tint(p, p.dark)} d="M90 60 H106 Q112 60 112 66 V96 Q112 100 108 102 L98 106 Q92 108 92 102 V62 Q92 60 90 60 Z" />
          <circle {...S(p)} cx={102} cy={92} r={5} fill={p.metal} />
          {moth(34, 34, 1, -15)}
          {moth(92, 20, 0.7, 20)}
        </>
      );
    },
  },
  {
    id: "money-bag",
    nameAr: "كيس نقود",
    category: "money",
    tags: ["مال", "ثروة", "كنز", "غنى"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d="M48 38 Q14 56 14 86 Q14 110 40 110 H80 Q106 110 106 86 Q106 56 72 38 Z" />
        <path {...S(p)} fill={p.main} d="M46 36 L34 14 Q46 22 54 14 Q60 22 66 14 Q74 22 86 14 L74 36 Z" />
        <rect {...S(p)} x={42} y={32} width={36} height={9} rx={4} fill={p.dark} />
        {coinFace(p, 60, 80, 18)}
        <path {...L(p, 2)} opacity={0.35} d="M30 96 Q24 84 30 68" />
      </>
    ),
  },
  {
    id: "savings-jar",
    nameAr: "جرة ادخار",
    category: "money",
    tags: ["ادخار", "توفير", "مال", "مستقبل"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={tint(p, p.water)} d="M32 34 H88 V44 Q102 52 102 68 V98 Q102 110 90 110 H30 Q18 110 18 98 V68 Q18 52 32 44 Z" />
        {coinDisc(p, 48, 96, 18, 5, 5, "a")}
        {coinDisc(p, 74, 96, 18, 5, 5, "b")}
        {coinDisc(p, 48, 88, 18, 5, 5, "c")}
        {coinDisc(p, 72, 88, 18, 5, 5, "d")}
        {coinDisc(p, 58, 80, 18, 5, 5, "e")}
        {coinDisc(p, 60, 72, 18, 5, 5, "f")}
        <path d="M28 66 Q28 54 38 50" stroke={p.light} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.75} />
        <rect {...S(p)} x={28} y={20} width={64} height={16} rx={5} fill={p.main} />
        <rect x={46} y={26} width={28} height={5} rx={2.5} fill={p.dark} />
        {coinFace(p, 60, 12, 8)}
      </>
    ),
  },
  {
    id: "scale-balance",
    nameAr: "ميزان متعادل",
    category: "money",
    tags: ["ميزان", "عدل", "قسط", "توازن", "تجارة"],
    draw: (p) => scale(p, 0, false),
  },
  {
    id: "scale-tilted",
    nameAr: "ميزان مائل",
    category: "money",
    tags: ["ميزان", "ترجيح", "ظلم", "تطفيف", "ثقل"],
    draw: (p) => scale(p, 14, true),
  },
  {
    id: "chart-up",
    nameAr: "رسم بياني صاعد",
    category: "money",
    tags: ["نمو", "ربح", "زيادة", "صعود"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} opacity={p.style === "line" ? 1 : 0.45} d="M26 88 L48 66 L64 76 L94 37 V102 H26 Z" />
        <path {...L(p, 8)} stroke={p.style === "line" ? p.line : p.main} d="M26 88 L48 66 L64 76 L94 37" />
        <path {...S(p)} fill={p.main} d="M103 25 L100 46 L83 33 Z" />
        <path {...L(p, 6)} stroke={p.edge} d="M16 12 V104 H110" />
      </>
    ),
  },
  {
    id: "chart-down",
    nameAr: "رسم بياني هابط",
    category: "money",
    tags: ["خسارة", "نقص", "هبوط", "تراجع"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} opacity={p.style === "line" ? 1 : 0.45} d="M26 30 L46 52 L62 44 L93 83 V102 H26 Z" />
        <path {...L(p, 8)} stroke={p.style === "line" ? p.line : p.main} d="M26 30 L46 52 L62 44 L93 83" />
        <path {...S(p)} fill={p.main} d="M103 95 L100 74 L83 88 Z" />
        <path {...L(p, 6)} stroke={p.edge} d="M16 12 V104 H110" />
      </>
    ),
  },
  {
    id: "bar-chart",
    nameAr: "أعمدة بيانية",
    category: "money",
    tags: ["إحصاء", "مقارنة", "نمو", "أرقام"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={18} y={70} width={18} height={32} rx={3} fill={p.second} />
        <rect {...S(p)} x={42} y={52} width={18} height={50} rx={3} fill={p.main} />
        <rect {...S(p)} x={66} y={36} width={18} height={66} rx={3} fill={p.second} />
        <rect {...S(p)} x={90} y={16} width={18} height={86} rx={3} fill={p.main} />
        <path {...L(p, 6)} stroke={p.edge} d="M10 104 H112" />
      </>
    ),
  },
  {
    id: "pie-chart",
    nameAr: "دائرة نسب",
    category: "money",
    tags: ["نسبة", "حصة", "تقسيم", "ميراث", "زكاة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d="M56 64 H100 A44 44 0 1 1 56 20 Z" />
        <path {...S(p)} fill={p.metal} d="M56 64 V108 A44 44 0 0 1 12 64 Z" />
        <path {...S(p)} fill={p.second} d="M64 56 V12 A44 44 0 0 1 108 56 Z" />
        <path {...L(p, 2)} opacity={0.35} d="M56 64 V108 M56 64 H12" />
      </>
    ),
  },
  {
    id: "receipt",
    nameAr: "فاتورة",
    category: "money",
    tags: ["فاتورة", "حساب", "شراء", "دين"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.light} d="M26 10 H94 V104 L85 110 L77 104 L68 110 L60 104 L52 110 L43 104 L35 110 L26 104 Z" />
        <rect x={44} y={20} width={32} height={8} rx={4} fill={p.style === "line" ? p.second : p.main} />
        <path {...L(p)} opacity={0.5} d="M38 42 H66 M76 42 H82 M38 54 H62 M76 54 H82 M38 66 H70 M76 66 H82" />
        <path {...L(p, 2)} opacity={0.5} strokeDasharray="4 4" d="M36 78 H84" />
        <path {...L(p, 5)} d="M38 90 H58 M72 90 H82" />
      </>
    ),
  },
  {
    id: "credit-card",
    nameAr: "بطاقة بنكية",
    category: "money",
    tags: ["بطاقة", "بنك", "دفع", "شراء", "دين"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={10} y={24} width={100} height={70} rx={10} fill={p.main} />
        <rect {...S(p)} x={22} y={40} width={22} height={17} rx={4} fill={p.metal} />
        <path {...L(p, 2)} opacity={0.5} d="M22 48.5 H44 M33 40 V57" />
        <path {...L(p, 3)} stroke={p.style === "line" ? p.line : p.light} opacity={0.8} d="M88 40 Q92 48 88 56 M95 36 Q101 48 95 60" />
        <path {...L(p, 5)} stroke={p.style === "line" ? p.line : p.light} opacity={0.7} strokeDasharray="12 6" d="M22 72 H98" />
        <path {...L(p, 4)} stroke={p.style === "line" ? p.line : p.light} opacity={0.5} d="M22 84 H54" />
      </>
    ),
  },
  {
    id: "shop-stall",
    nameAr: "دكان في السوق",
    category: "money",
    tags: ["سوق", "تجارة", "بيع", "دكان", "كسب"],
    draw: (p) => (
      <>
        <path {...L(p, 5)} stroke={p.edge} d="M20 40 V78 M100 40 V78" />
        {[0, 1, 2, 3, 4].map((i) => {
          const w = 92 / 5;
          const x = 14 + i * w;
          const fill = i % 2 === 0 ? (p.style === "line" ? p.second : p.main) : p.light;
          return <path key={i} {...S(p)} fill={fill} d={`M${x} 18 H${x + w} V38 A${w / 2} ${w / 2} 0 0 1 ${x} 38 Z`} />;
        })}
        <rect {...S(p)} x={10} y={10} width={100} height={10} rx={5} fill={p.dark} />
        <circle {...S(p)} cx={34} cy={68} r={9} fill={p.accent} />
        <circle {...S(p)} cx={50} cy={70} r={7} fill={p.green} />
        <circle {...S(p)} cx={42} cy={62} r={7} fill={p.metal} />
        <rect {...S(p)} x={64} y={60} width={26} height={16} rx={3} fill={p.metal} />
        <path {...L(p, 2)} opacity={0.4} d="M64 68 H90" />
        <rect {...S(p)} x={12} y={76} width={96} height={32} rx={4} fill={p.wood} />
        <path {...L(p, 2)} opacity={0.4} d="M44 80 V104 M76 80 V104" />
      </>
    ),
  },
  {
    id: "shopping-cart",
    nameAr: "عربة تسوق",
    category: "money",
    tags: ["تسوق", "شراء", "استهلاك", "سوق"],
    draw: (p) => (
      <>
        <path {...L(p, 6)} stroke={p.edge} d="M8 18 H20 L36 76 L40 86 H98" />
        <path {...S(p)} fill={p.main} d="M24 30 H108 Q112 30 111 34 L100 70 Q99 74 95 74 H36 Z" />
        <path {...L(p, 2)} opacity={0.4} d="M30 44 H106 M33 58 H102 M48 30 V74 M68 30 V74 M88 30 V74" />
        <circle {...S(p)} cx={46} cy={100} r={9} fill={p.dark} />
        <circle {...S(p)} cx={90} cy={100} r={9} fill={p.dark} />
        <circle cx={46} cy={100} r={3} fill={p.light} />
        <circle cx={90} cy={100} r={3} fill={p.light} />
      </>
    ),
  },
  {
    id: "price-tag",
    nameAr: "بطاقة سعر",
    category: "money",
    tags: ["سعر", "ثمن", "بيع", "تخفيض"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d="M24 18 Q24 14 28 14 H64 Q68 14 71 17 L106 52 Q110 56 106 60 L64 102 Q60 106 56 102 L21 67 Q18 64 18 60 V24 Q18 18 24 18 Z" />
        <path {...L(p, 2)} opacity={0.4} strokeDasharray="5 5" d="M30 24 H62 L98 56 L60 94 L28 62 Z" />
        <circle {...S(p)} cx={40} cy={36} r={7} fill={p.style === "line" ? p.light : p.bg} />
        <path {...L(p, 3)} stroke={p.edge} d="M40 36 Q22 26 22 10 Q22 4 28 4" />
        <path {...L(p, 5)} opacity={0.6} d="M56 62 L74 44 M64 70 L82 52" />
      </>
    ),
  },
  {
    id: "bank-building",
    nameAr: "مبنى مصرف",
    category: "money",
    tags: ["بنك", "مصرف", "مؤسسة", "ربا", "اقتصاد"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d="M10 44 L60 12 L110 44 Z" />
        <circle {...S(p)} cx={60} cy={32} r={7} fill={p.metal} />
        <rect {...S(p)} x={14} y={44} width={92} height={10} rx={2} fill={p.main} />
        {[22, 44, 64, 86].map((x) => (
          <rect key={x} {...S(p)} x={x} y={58} width={12} height={36} rx={2} fill={p.light} />
        ))}
        <rect {...S(p)} x={14} y={94} width={92} height={8} rx={2} fill={p.main} />
        <rect {...S(p)} x={8} y={102} width={104} height={8} rx={2} fill={p.dark} />
        <path {...L(p, 2)} opacity={0.3} d="M14 54 H106" />
      </>
    ),
  },
  {
    id: "safe",
    nameAr: "خزنة",
    category: "money",
    tags: ["خزنة", "حفظ", "أمان", "كنز", "ادخار"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={22} y={100} width={14} height={10} rx={2} fill={p.dark} />
        <rect {...S(p)} x={84} y={100} width={14} height={10} rx={2} fill={p.dark} />
        <rect {...S(p)} x={12} y={12} width={96} height={90} rx={10} fill={p.second} />
        <rect {...S(p)} x={22} y={22} width={76} height={70} rx={6} fill={p.main} />
        <circle {...S(p)} cx={52} cy={57} r={18} fill={p.metal} />
        <circle cx={52} cy={57} r={5} fill={p.dark} />
        <path {...L(p, 3)} opacity={0.6} d="M52 41 V46 M52 68 V73 M36 57 H41 M63 57 H68" />
        <rect {...S(p)} x={80} y={44} width={8} height={26} rx={4} fill={p.dark} />
      </>
    ),
  },
  {
    id: "gold-bar",
    nameAr: "سبيكة ذهب",
    category: "money",
    tags: ["ذهب", "سبيكة", "ثروة", "زكاة"],
    draw: (p) => (
      <>
        <ellipse cx={60} cy={100} rx={52} ry={6} fill={p.shadow} />
        <path {...S(p)} fill={p.metal} d="M10 96 H110 L94 56 H26 Z" />
        <path {...S(p)} fill={p.metal} d="M26 56 H94 L84 36 H36 Z" />
        <path d="M26 56 H94 L84 36 H36 Z" fill={p.light} opacity={p.style === "line" ? 0 : 0.35} />
        <rect {...L(p, 2)} x={40} y={66} width={40} height={18} rx={3} opacity={0.4} />
        <path d="M22 88 L32 64" stroke={p.light} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
      </>
    ),
  },
  {
    id: "gold-bars-stack",
    nameAr: "سبائك ذهب",
    category: "money",
    tags: ["ذهب", "كنز", "ثروة", "اكتناز"],
    draw: (p) => {
      const bar = (x: number, y: number, w: number) => (
        <g key={`${x}-${y}`}>
          <path {...S(p)} fill={p.metal} d={`M${x} ${y} H${x + w} L${x + w - 7} ${y - 18} H${x + 7} Z`} />
          <path {...S(p)} fill={p.metal} d={`M${x + 7} ${y - 18} H${x + w - 7} L${x + w - 13} ${y - 28} H${x + 13} Z`} />
          <path d={`M${x + 7} ${y - 18} H${x + w - 7} L${x + w - 13} ${y - 28} H${x + 13} Z`} fill={p.light} opacity={p.style === "line" ? 0 : 0.35} />
          <path {...rim(p)} d={`M${x} ${y} H${x + w} L${x + w - 7} ${y - 18} H${x + 7} Z`} />
          <rect {...L(p, 2)} x={x + 14} y={y - 13} width={w - 28} height={8} rx={2} opacity={0.35} />
        </g>
      );
      return (
        <>
          <ellipse cx={60} cy={106} rx={54} ry={5} fill={p.shadow} />
          {bar(6, 104, 52)}
          {bar(62, 104, 52)}
          {bar(20, 76, 52)}
          {bar(52, 76, 52)}
          {bar(34, 48, 52)}
        </>
      );
    },
  },
  {
    id: "contract",
    nameAr: "عقد موثق",
    category: "money",
    tags: ["عقد", "دين", "توثيق", "كتابة الدين", "اتفاق"],
    note: "سطور بلا كتابة؛ يصلح لآية الدين وتوثيق العقود.",
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.light} d="M22 10 H76 L98 32 V106 Q98 110 94 110 H26 Q22 110 22 106 Z" />
        <path {...S(p)} fill={tint(p, p.second)} d="M76 10 V28 Q76 32 80 32 H98 Z" />
        <path {...L(p)} opacity={0.5} d="M34 28 H64 M34 42 H86 M34 54 H86 M34 66 H76" />
        <path {...L(p, 3)} d="M32 90 Q38 78 42 88 Q46 98 52 84 Q56 78 60 88" />
        <path {...S(p)} fill={p.main} d="M76 96 L72 114 L80 108 L86 114 L86 96 Z" />
        <circle {...S(p)} cx={80} cy={88} r={13} fill={p.main} />
        <circle {...L(p, 2)} cx={80} cy={88} r={7} opacity={0.5} />
      </>
    ),
  },
  {
    id: "calculator",
    nameAr: "آلة حاسبة",
    category: "money",
    tags: ["حساب", "زكاة", "ميزانية", "عد"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={22} y={8} width={76} height={104} rx={10} fill={p.dark} />
        <rect {...S(p)} x={31} y={18} width={58} height={22} rx={4} fill={tint(p, p.water)} />
        {[0, 1, 2, 3].flatMap((r) =>
          [0, 1, 2, 3].map((c) => (
            <rect
              key={`${r}-${c}`}
              {...S(p)}
              x={31 + c * 15.5}
              y={50 + r * 15}
              width={11}
              height={10}
              rx={3}
              fill={c === 3 ? p.metal : p.style === "line" ? p.light : p.main}
            />
          )),
        )}
      </>
    ),
  },
  {
    id: "grain-sack",
    nameAr: "كيس حبوب",
    category: "money",
    tags: ["قمح", "حبوب", "طعام", "زكاة الفطر", "رزق"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.wood} d="M30 34 Q16 64 18 96 Q18 108 32 108 H82 Q96 108 96 96 Q98 64 84 34 Z" />
        <path {...S(p)} fill={p.wood} d="M34 32 L26 12 Q42 20 57 12 Q72 20 88 12 L80 32 Z" />
        <path {...rim(p)} d="M34 32 L26 12 Q42 20 57 12 Q72 20 88 12 L80 32" />
        <rect {...S(p)} x={32} y={30} width={50} height={8} rx={4} fill={p.dark} />
        <path {...L(p, 3)} opacity={0.55} d="M57 96 V58" />
        {[60, 70, 80].map((y) => (
          <g key={y}>
            <ellipse {...L(p, 2)} cx={51} cy={y} rx={4} ry={7} transform={`rotate(-30 51 ${y})`} opacity={0.55} />
            <ellipse {...L(p, 2)} cx={63} cy={y} rx={4} ry={7} transform={`rotate(30 63 ${y})`} opacity={0.55} />
          </g>
        ))}
        <ellipse {...L(p, 2)} cx={57} cy={52} rx={4} ry={7} opacity={0.55} />
        {[
          [100, 106],
          [108, 104],
          [104, 98],
          [94, 108],
          [112, 108],
        ].map(([x, y], i) => (
          <ellipse key={i} {...S(p)} cx={x} cy={y} rx={4} ry={3} fill={p.metal} />
        ))}
      </>
    ),
  },
  {
    id: "charity-box",
    nameAr: "صندوق صدقة",
    category: "money",
    tags: ["صدقة", "تبرع", "إنفاق", "خير", "زكاة"],
    draw: (p) => (
      <>
        {coinFace(p, 60, 20, 12)}
        <rect {...S(p)} x={16} y={44} width={88} height={64} rx={6} fill={p.main} />
        <rect {...S(p)} x={10} y={36} width={100} height={14} rx={5} fill={tint(p, p.second)} />
        <rect x={40} y={40} width={40} height={6} rx={3} fill={p.dark} />
        <path {...S(p)} fill={p.style === "line" ? p.second : p.light} d="M60 98 Q34 82 34 70 Q34 60 44 60 Q54 60 60 68 Q66 60 76 60 Q86 60 86 70 Q86 82 60 98 Z" />
      </>
    ),
  },
  {
    id: "debt-chain",
    nameAr: "دين مقيِّد",
    category: "money",
    tags: ["دين", "قيد", "ربا", "عبء", "هم"],
    draw: (p) => (
      <>
        <g transform="rotate(-45 40 80)">
          <ellipse {...L(p, 6)} stroke={p.edge} cx={44} cy={80} rx={12} ry={7} />
          <path {...L(p, 6)} stroke={p.edge} d="M24 80 H34" />
          <ellipse {...L(p, 6)} stroke={p.edge} cx={14} cy={80} rx={12} ry={7} />
        </g>
        <circle {...L(p, 7)} stroke={p.edge} cx={18} cy={102} r={9} />
        {coinFace(p, 72, 46, 36)}
        <path {...L(p, 3)} opacity={0.5} d="M72 30 Q80 46 72 62 Q64 46 72 30 Z" />
        <circle {...S(p)} cx={50} cy={72} r={6} fill={p.dark} />
      </>
    ),
  },
  {
    id: "dates-basket",
    nameAr: "سلة تمر",
    category: "money",
    tags: ["تمر", "صدقة", "إطعام", "طعام", "إفطار"],
    draw: (p) => {
      const dateFill = p.style === "line" ? p.second : p.main;
      const dates: [number, number, number][] = [
        [28, 60, -30],
        [44, 54, 20],
        [60, 50, -10],
        [76, 54, 30],
        [92, 60, -20],
        [36, 44, 40],
        [52, 40, -25],
        [68, 38, 15],
        [84, 44, -35],
        [60, 28, 5],
      ];
      return (
        <>
          {dates.map(([x, y, r], i) => (
            <ellipse key={i} {...S(p)} cx={x} cy={y} rx={7} ry={11} fill={dateFill} transform={`rotate(${r} ${x} ${y})`} />
          ))}
          {dates.map(([x, y, r], i) => (
            <ellipse key={`o${i}`} {...rim(p)} cx={x} cy={y} rx={7} ry={11} transform={`rotate(${r} ${x} ${y})`} />
          ))}
          <path {...S(p)} fill={p.wood} d="M14 66 H106 L96 102 Q94 108 88 108 H32 Q26 108 24 102 Z" />
          <rect {...S(p)} x={10} y={60} width={100} height={12} rx={6} fill={p.wood} />
          <path {...L(p, 2)} opacity={0.4} d="M10 66 H110 M20 82 H100 M24 94 H96 M36 72 L40 106 M60 72 V108 M84 72 L80 106" />
        </>
      );
    },
  },
  {
    id: "coin-sprout",
    nameAr: "مال ينمو",
    category: "money",
    tags: ["نماء", "بركة", "استثمار", "ربح حلال", "صدقة تنمي"],
    draw: (p) => (
      <>
        {coinDisc(p, 60, 98, 34, 9, 8, "a")}
        {coinDisc(p, 60, 86, 34, 9, 8, "b")}
        <path {...L(p, 5)} stroke={p.style === "line" ? p.line : p.green} d="M60 80 V38" />
        <path {...S(p)} fill={p.green} d="M60 54 Q36 54 28 34 Q50 30 60 54 Z" />
        <path {...S(p)} fill={p.green} d="M60 44 Q66 18 94 16 Q90 44 60 44 Z" />
        <path {...L(p, 2)} opacity={0.4} d="M58 52 Q46 44 34 36 M62 42 Q76 32 88 22" />
      </>
    ),
  },
  {
    id: "coin-exchange",
    nameAr: "تبادل وصرف",
    category: "money",
    tags: ["صرف", "تبادل", "بيع", "مقايضة", "تجارة"],
    draw: (p) => (
      <>
        <path {...L(p, 7)} stroke={p.edge} d="M40 18 Q80 6 98 34" />
        <path {...S(p)} fill={p.edge} d="M108 26 L102 48 L86 34 Z" />
        <path {...L(p, 7)} stroke={p.edge} d="M80 102 Q40 114 22 86" />
        <path {...S(p)} fill={p.edge} d="M12 94 L18 72 L34 86 Z" />
        {coinFace(p, 38, 50, 26)}
        <path {...L(p, 3)} opacity={0.5} d="M38 38 L46 50 L38 62 L30 50 Z" />
        <circle {...S(p)} cx={82} cy={72} r={26} fill={p.second} />
        <circle {...L(p, 2)} cx={82} cy={72} r={18} opacity={0.45} />
        <circle {...L(p, 3)} cx={82} cy={72} r={6} opacity={0.5} />
      </>
    ),
  },
];
