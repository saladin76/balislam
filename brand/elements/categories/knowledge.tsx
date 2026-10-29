import React from "react";
import type { ElementDef, ElementPalette } from "../types";
import { L, S, tint } from "../helpers";

/**
 * العلم والحضارة: كتب ومخطوطات وأدوات فلك وعلوم وعمارة.
 * الكتب بسطور فقط بلا كتابة، والأدوات النحاسية بـ p.metal.
 */

/** حدّ رفيع يفصل الأشكال المتراكبة من نفس اللون في الثيمات المسطحة */
const rim = (p: ElementPalette) => ({ ...L(p, 2), opacity: p.style === "line" ? 0 : 0.3 });

const r2 = (n: number) => Math.round(n * 10) / 10;

/** ترس: n سنًّا بين نصف قطر داخلي وخارجي */
const gearPath = (cx: number, cy: number, ro: number, ri: number, n: number) => {
  const s = (Math.PI * 2) / n;
  const pt = (r: number, a: number) => `${r2(cx + r * Math.cos(a))} ${r2(cy + r * Math.sin(a))}`;
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = i * s;
    d += `${i === 0 ? "M" : "L"}${pt(ri, a - 0.32 * s)} L${pt(ro, a - 0.17 * s)} L${pt(ro, a + 0.17 * s)} L${pt(ri, a + 0.32 * s)} `;
  }
  return d + "Z";
};

const gear = (p: ElementPalette, cx: number, cy: number, ro: number, n: number, fill: string, key?: string) => (
  <g key={key}>
    <path {...S(p)} fill={fill} d={gearPath(cx, cy, ro, ro - 9, n)} />
    <circle {...L(p, 2)} cx={cx} cy={cy} r={ro - 17} opacity={0.4} />
    <circle {...S(p)} cx={cx} cy={cy} r={ro * 0.28} fill={p.style === "line" ? p.light : p.bg} />
  </g>
);

/** ريشة كتابة من السن (bx,by) إلى الطرف (tx,ty) */
const feather = (p: ElementPalette, bx: number, by: number, tx: number, ty: number, w: number) => {
  const len = Math.hypot(tx - bx, ty - by);
  const ux = (tx - bx) / len;
  const uy = (ty - by) / len;
  const nx = -uy;
  const ny = ux;
  const at = (t: number, o: number) => `${r2(bx + ux * len * t + nx * o)} ${r2(by + uy * len * t + ny * o)}`;
  const vane = `M${at(0.28, 0)} Q${at(0.5, w * 1.25)} ${at(1, 0)} Q${at(0.62, -w * 1.1)} ${at(0.28, 0)} Z`;
  const notch = `M${at(0.55, w * 0.95)} L${at(0.52, w * 0.45)} M${at(0.62, -w * 0.85)} L${at(0.58, -w * 0.35)}`;
  return (
    <>
      <path {...S(p)} fill={p.main} d={vane} />
      <path {...L(p, 2)} opacity={0.5} d={notch} />
      <path {...L(p, 3)} stroke={p.style === "line" ? p.line : p.edge} d={`M${at(0.1, 0)} L${at(0.93, 0)}`} />
      <path {...S(p)} fill={p.dark} d={`M${at(0, 0)} L${at(0.13, 3)} L${at(0.13, -3)} Z`} />
    </>
  );
};

/** كتاب مستلقٍ يُرى كعبه: x,y الزاوية العليا اليسرى */
const lyingBook = (p: ElementPalette, x: number, y: number, w: number, h: number, fill: string, rot = 0) => (
  <g transform={rot ? `rotate(${rot} ${x + w / 2} ${y + h / 2})` : undefined}>
    <rect {...S(p)} x={x + w - 14} y={y + 3} width={14} height={h - 6} rx={2} fill={p.light} />
    <path {...L(p, 2)} opacity={0.35} d={`M${x + w - 12} ${y + h / 2 - 3} H${x + w - 2} M${x + w - 12} ${y + h / 2 + 3} H${x + w - 2}`} />
    <rect {...S(p)} x={x} y={y} width={w - 10} height={h} rx={4} fill={fill} />
    <path {...L(p, 2)} opacity={0.45} d={`M${x + 12} ${y + 2} V${y + h - 2} M${x + w - 24} ${y + 2} V${y + h - 2}`} />
    <rect {...rim(p)} x={x} y={y} width={w - 10} height={h} rx={4} />
  </g>
);

export const elements: ElementDef[] = [
  {
    id: "book-closed",
    nameAr: "كتاب مغلق",
    category: "knowledge",
    tags: ["كتاب", "علم", "قراءة", "معرفة"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={32} y={16} width={68} height={94} rx={5} fill={p.light} />
        <path {...L(p, 2)} opacity={0.35} d="M98 30 V96 M94 22 V104" />
        <rect {...S(p)} x={22} y={10} width={72} height={96} rx={6} fill={p.main} />
        <rect {...S(p)} x={22} y={10} width={14} height={96} rx={4} fill={p.dark} />
        <rect {...L(p, 2)} x={44} y={20} width={40} height={76} rx={4} opacity={0.4} />
        <path {...S(p)} fill={p.metal} d="M64 42 L76 58 L64 74 L52 58 Z" />
        <path {...S(p)} fill={p.second} d="M76 104 V113 L80 109 L84 113 V104 Z" />
      </>
    ),
  },
  {
    id: "book-open",
    nameAr: "كتاب مفتوح",
    category: "knowledge",
    tags: ["كتاب", "قراءة", "تعلم", "علم", "مطالعة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d="M60 36 Q36 24 8 30 V102 Q38 98 60 110 Q82 98 112 102 V30 Q84 24 60 36 Z" />
        <path {...S(p)} fill={p.light} d="M60 32 Q40 18 14 22 V94 Q40 90 60 102 Z" />
        <path {...S(p)} fill={p.light} d="M60 32 Q80 18 106 22 V94 Q80 90 60 102 Z" />
        <path {...L(p, 2)} opacity={0.3} d="M60 32 V102" />
        <path {...L(p)} opacity={0.45} d="M24 38 Q38 36 50 42 M24 50 Q38 48 50 54 M24 62 Q38 60 50 66 M24 74 Q34 72 42 76" />
        <path {...L(p)} opacity={0.45} d="M96 38 Q82 36 70 42 M96 50 Q82 48 70 54 M96 62 Q82 60 70 66 M96 74 Q86 72 78 76" />
      </>
    ),
  },
  {
    id: "books-stack",
    nameAr: "كومة كتب",
    category: "knowledge",
    tags: ["كتب", "علم", "دراسة", "مكتبة", "طلب العلم"],
    draw: (p) => (
      <>
        <ellipse cx={60} cy={108} rx={50} ry={4} fill={p.shadow} />
        {lyingBook(p, 10, 84, 98, 22, p.main)}
        {lyingBook(p, 18, 62, 88, 22, p.second)}
        {lyingBook(p, 14, 40, 90, 22, tint(p, p.metal), -4)}
        {lyingBook(p, 26, 20, 74, 20, p.main, 3)}
      </>
    ),
  },
  {
    id: "bookshelf",
    nameAr: "رف كتب",
    category: "knowledge",
    tags: ["مكتبة", "كتب", "علم", "دار الحكمة"],
    draw: (p) => {
      const top: [number, number, string][] = [
        [20, 34, p.main],
        [31, 30, p.second],
        [42, 36, p.metal],
        [53, 28, p.main],
        [64, 34, p.light],
      ];
      const bottom: [number, number, string][] = [
        [20, 32, p.second],
        [31, 36, p.light],
        [42, 30, p.main],
        [53, 34, p.metal],
        [64, 30, p.second],
      ];
      return (
        <>
          <rect {...S(p)} x={10} y={8} width={100} height={104} rx={4} fill={p.wood} />
          <rect {...S(p)} x={17} y={15} width={86} height={40} rx={2} fill={p.dark} />
          <rect {...S(p)} x={17} y={62} width={86} height={42} rx={2} fill={p.dark} />
          {top.map(([x, h, f]) => (
            <rect key={`t${x}`} {...S(p)} x={x} y={55 - h} width={10} height={h} rx={2} fill={f} />
          ))}
          <rect {...S(p)} x={84} y={22} width={10} height={34} rx={2} fill={p.main} transform="rotate(-18 89 55)" />
          {bottom.map(([x, h, f]) => (
            <rect key={`b${x}`} {...S(p)} x={x} y={104 - h} width={10} height={h} rx={2} fill={f} />
          ))}
          {lyingBook(p, 76, 92, 26, 12, p.main)}
          {lyingBook(p, 78, 80, 22, 12, p.metal)}
          <path {...L(p, 2)} opacity={0.4} d="M22 26 H28 M22 72 H28 M44 26 H50 M44 80 H50" />
        </>
      );
    },
  },
  {
    id: "scroll",
    nameAr: "لفافة مطوية",
    category: "knowledge",
    tags: ["مخطوط", "رسالة", "لفافة", "تاريخ"],
    draw: (p) => (
      <g transform="rotate(-18 60 60)">
        <rect {...S(p)} x={16} y={42} width={88} height={36} rx={4} fill={tint(p, p.light)} />
        <path {...L(p, 2)} opacity={0.3} d="M20 50 H100 M20 70 H100" />
        <ellipse {...S(p)} cx={104} cy={60} rx={9} ry={18} fill={p.light} />
        <path {...L(p, 2)} opacity={0.55} d="M104 60 m-3 0 a3 5 0 1 0 6 0 a6 10 0 1 0 -12 0" />
        <ellipse {...S(p)} cx={16} cy={60} rx={9} ry={18} fill={p.light} />
        <rect {...S(p)} x={52} y={38} width={14} height={44} rx={3} fill={p.main} />
        <path {...S(p)} fill={p.main} d="M56 80 L48 104 L56 100 L60 106 Z M62 80 L72 102 L64 100 L60 106 Z" />
        <circle {...S(p)} cx={59} cy={60} r={8} fill={p.metal} />
      </g>
    ),
  },
  {
    id: "scroll-open",
    nameAr: "لفافة مفتوحة",
    category: "knowledge",
    tags: ["مخطوط", "رسالة", "إعلان", "وثيقة", "تاريخ"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={26} y={18} width={68} height={84} fill={p.light} />
        <path {...L(p)} opacity={0.45} d="M38 36 H82 M38 48 H82 M38 60 H82 M38 72 H74 M38 84 H66" />
        <rect {...S(p)} x={20} y={8} width={80} height={16} rx={8} fill={tint(p, p.light)} />
        <rect {...S(p)} x={20} y={96} width={80} height={16} rx={8} fill={tint(p, p.light)} />
        <path {...rim(p)} d="M20 16 H100 M20 104 H100" />
        <rect {...S(p)} x={8} y={10} width={12} height={12} rx={4} fill={p.wood} />
        <rect {...S(p)} x={100} y={10} width={12} height={12} rx={4} fill={p.wood} />
        <rect {...S(p)} x={8} y={98} width={12} height={12} rx={4} fill={p.wood} />
        <rect {...S(p)} x={100} y={98} width={12} height={12} rx={4} fill={p.wood} />
      </>
    ),
  },
  {
    id: "quill",
    nameAr: "ريشة كتابة",
    category: "knowledge",
    tags: ["كتابة", "تدوين", "ريشة", "تأليف", "قلم"],
    draw: (p) => feather(p, 16, 106, 104, 14, 20),
  },
  {
    id: "inkwell",
    nameAr: "محبرة",
    category: "knowledge",
    tags: ["حبر", "كتابة", "تدوين", "محبرة"],
    draw: (p) => (
      <>
        <ellipse cx={60} cy={108} rx={46} ry={5} fill={p.shadow} />
        <path {...S(p)} fill={p.dark} d="M40 54 H80 V60 Q104 64 104 84 V98 Q104 108 92 108 H28 Q16 108 16 98 V84 Q16 64 40 60 Z" />
        <rect {...S(p)} x={34} y={38} width={52} height={16} rx={5} fill={p.metal} />
        <ellipse cx={60} cy={40} rx={18} ry={4} fill={p.dark} />
        <path d="M28 92 Q26 76 40 70" stroke={p.light} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.6} />
        <path {...S(p)} fill={p.metal} d="M16 86 H104 V92 H16 Z" />
      </>
    ),
  },
  {
    id: "quill-and-inkwell",
    nameAr: "ريشة ومحبرة",
    category: "knowledge",
    tags: ["كتابة", "تأليف", "علم", "تدوين", "علماء"],
    draw: (p) => (
      <>
        {feather(p, 74, 72, 12, 8, 13)}
        <ellipse cx={72} cy={110} rx={36} ry={4} fill={p.shadow} />
        <path {...S(p)} fill={p.dark} d="M56 74 H88 V78 Q108 82 108 96 V102 Q108 110 98 110 H46 Q36 110 36 102 V96 Q36 82 56 78 Z" />
        <rect {...S(p)} x={52} y={62} width={40} height={13} rx={4} fill={p.metal} />
        <path {...S(p)} fill={p.metal} d="M36 96 H108 V101 H36 Z" />
        <path d="M44 94 Q46 86 56 84" stroke={p.light} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.6} />
      </>
    ),
  },
  {
    id: "oil-lamp",
    nameAr: "سراج زيت",
    category: "knowledge",
    tags: ["سراج", "نور", "علم", "سهر", "قنديل"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.metal} d="M98 62 Q88 50 96 30 Q100 22 98 14 Q112 28 110 48 Q108 60 98 62 Z" />
        <path {...S(p)} fill={tint(p, p.light)} d="M99 58 Q94 50 99 40 Q104 48 103 54 Q102 58 99 58 Z" />
        <path {...L(p, 6)} stroke={p.edge} d="M22 76 Q6 74 8 62 Q10 52 24 60" />
        <ellipse {...S(p)} cx={50} cy={100} rx={20} ry={6} fill={p.wood} />
        <path {...S(p)} fill={p.wood} d="M18 78 Q18 62 48 60 Q72 58 86 66 L100 62 Q106 62 104 68 L92 80 Q86 96 50 96 Q18 96 18 78 Z" />
        <path {...S(p)} fill={p.wood} d="M38 62 Q40 48 50 48 Q60 48 62 62 Z" />
        <circle {...S(p)} cx={50} cy={46} r={4} fill={p.wood} />
        <path {...L(p, 2)} opacity={0.4} d="M26 82 Q50 90 84 78" />
        <path {...rim(p)} d="M38 62 Q40 48 50 48 Q60 48 62 62" />
      </>
    ),
  },
  {
    id: "astrolabe",
    nameAr: "أسطرلاب",
    category: "knowledge",
    tags: ["فلك", "أسطرلاب", "حضارة إسلامية", "علماء", "نجوم"],
    draw: (p) => {
      const ticks = Array.from({ length: 24 }, (_, i) => {
        const a = (i * Math.PI * 2) / 24;
        const r1 = i % 2 === 0 ? 36 : 39;
        return `M${r2(60 + r1 * Math.cos(a))} ${r2(66 + r1 * Math.sin(a))} L${r2(60 + 43 * Math.cos(a))} ${r2(66 + 43 * Math.sin(a))}`;
      }).join(" ");
      return (
        <>
          <circle {...L(p, 5)} stroke={p.edge} cx={60} cy={10} r={6} />
          <path {...S(p)} fill={p.metal} d="M48 26 Q48 14 60 14 Q72 14 72 26 Z" />
          <circle {...S(p)} cx={60} cy={66} r={48} fill={p.metal} />
          <path {...L(p, 2)} opacity={0.6} d={ticks} />
          <circle {...S(p)} cx={60} cy={66} r={34} fill={tint(p, p.second)} />
          <path {...L(p, 2)} opacity={0.55} d="M60 32 Q40 52 46 72 Q52 92 76 96 M60 32 Q84 48 80 70 Q76 90 46 96 M30 70 Q60 54 90 70" />
          <circle cx={46} cy={72} r={3} fill={p.line} opacity={0.6} />
          <circle cx={80} cy={70} r={3} fill={p.line} opacity={0.6} />
          <path {...S(p)} fill={p.dark} d="M24 72 L96 58 L97 62 L25 76 Z" />
          <circle {...S(p)} cx={60} cy={66} r={6} fill={p.metal} />
        </>
      );
    },
  },
  {
    id: "telescope",
    nameAr: "مقراب فلكي",
    category: "knowledge",
    tags: ["فلك", "رصد", "نجوم", "اكتشاف", "علم"],
    draw: (p) => (
      <>
        <path {...L(p, 5)} stroke={p.edge} d="M58 62 L32 110 M58 62 L60 110 M58 62 L86 110" />
        <g transform="rotate(-28 58 50)">
          <rect {...S(p)} x={8} y={44} width={16} height={12} rx={3} fill={p.dark} />
          <rect {...S(p)} x={22} y={41} width={32} height={18} rx={3} fill={p.second} />
          <rect {...S(p)} x={52} y={37} width={44} height={26} rx={4} fill={p.main} />
          <rect {...S(p)} x={94} y={33} width={14} height={34} rx={4} fill={p.metal} />
          <path {...L(p, 2)} opacity={0.4} d="M62 37 V63 M84 37 V63" />
        </g>
        <circle {...S(p)} cx={58} cy={58} r={7} fill={p.dark} />
      </>
    ),
  },
  {
    id: "globe-stand",
    nameAr: "مجسم كرة أرضية",
    category: "knowledge",
    tags: ["جغرافيا", "عالم", "خرائط", "رحلة", "دراسة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.metal} d="M36 112 Q36 100 56 100 Q76 100 76 112 Z" />
        <rect {...S(p)} x={52} y={90} width={8} height={12} fill={p.metal} />
        <circle {...S(p)} cx={56} cy={52} r={36} fill={p.water} />
        <path {...S(p)} fill={p.green} d="M34 30 Q46 24 54 32 Q58 42 48 46 Q44 56 34 52 Q26 42 34 30 Z" />
        <path {...S(p)} fill={p.green} d="M62 56 Q74 50 82 58 Q86 72 74 80 Q64 82 62 72 Q56 64 62 56 Z" />
        <path {...S(p)} fill={p.green} d="M66 24 Q76 22 80 32 Q74 36 66 30 Z" />
        <path d="M38 36 Q42 26 52 22" stroke={p.light} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.6} />
        <path {...L(p, 6)} stroke={p.style === "line" ? p.line : p.metal} d="M30 20 A44 44 0 0 1 82 92" />
        <path {...L(p, 6)} stroke={p.style === "line" ? p.line : p.metal} d="M82 92 Q72 98 56 96" />
      </>
    ),
  },
  {
    id: "map-old",
    nameAr: "خريطة قديمة",
    category: "knowledge",
    tags: ["خريطة", "رحلة", "جغرافيا", "استكشاف", "طريق"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.light} d="M10 26 L42 16 V96 L10 106 Z" />
        <path {...S(p)} fill={p.light} d="M42 16 L78 26 V106 L42 96 Z" />
        <path d="M42 16 L78 26 V106 L42 96 Z" fill={p.shadow} />
        <path {...S(p)} fill={p.light} d="M78 26 L110 16 V96 L78 106 Z" />
        <path {...rim(p)} d="M10 26 L42 16 L78 26 L110 16 V96 L78 106 L42 96 L10 106 Z M42 16 V96 M78 26 V106" />
        <path {...S(p)} fill={p.green} d="M16 40 Q26 32 36 40 Q44 48 40 58 Q30 64 22 58 Q14 50 16 40 Z" />
        <path {...S(p)} fill={p.green} d="M70 70 Q82 60 96 66 Q102 78 92 86 Q78 90 70 70 Z" />
        <path {...L(p, 3)} stroke={p.style === "line" ? p.line : p.main} strokeDasharray="5 6" d="M30 50 Q48 70 60 56 Q72 42 84 74" />
        <circle {...S(p)} cx={84} cy={76} r={6} fill={p.main} />
        <path {...L(p, 2)} opacity={0.6} d="M96 26 V44 M90 35 H102" />
      </>
    ),
  },
  {
    id: "compass-rose",
    nameAr: "وردة الاتجاهات",
    category: "knowledge",
    tags: ["اتجاه", "بوصلة", "ملاحة", "طريق", "قبلة"],
    draw: (p) => {
      const lit = tint(p, p.light);
      return (
        <>
          <circle {...L(p, 4)} stroke={p.edge} cx={60} cy={60} r={36} opacity={0.6} />
          <g transform="rotate(45 60 60)">
            <path {...S(p)} fill={p.second} d="M60 26 L68 60 L60 94 L52 60 Z M26 60 L60 52 L94 60 L60 68 Z" />
          </g>
          <path {...S(p)} fill={p.main} d="M60 8 L68 52 L60 60 Z" />
          <path {...S(p)} fill={lit} d="M60 8 L52 52 L60 60 Z" />
          <path {...S(p)} fill={lit} d="M60 112 L68 68 L60 60 Z" />
          <path {...S(p)} fill={p.main} d="M60 112 L52 68 L60 60 Z" />
          <path {...S(p)} fill={p.main} d="M112 60 L68 68 L60 60 Z" />
          <path {...S(p)} fill={lit} d="M112 60 L68 52 L60 60 Z" />
          <path {...S(p)} fill={lit} d="M8 60 L52 68 L60 60 Z" />
          <path {...S(p)} fill={p.main} d="M8 60 L52 52 L60 60 Z" />
          <circle {...S(p)} cx={60} cy={60} r={6} fill={p.metal} />
        </>
      );
    },
  },
  {
    id: "compass-tool",
    nameAr: "فرجار",
    category: "knowledge",
    tags: ["هندسة", "رسم", "دقة", "رياضيات"],
    draw: (p) => (
      <>
        <path {...L(p, 3)} stroke={p.edge} strokeDasharray="4 6" opacity={0.7} d="M24 104 Q60 118 98 104" />
        <rect {...S(p)} x={55} y={6} width={10} height={14} rx={4} fill={p.dark} />
        <path {...S(p)} fill={p.metal} d="M56 22 L64 22 L32 100 L26 98 Z" />
        <path {...S(p)} fill={p.metal} d="M56 22 L64 22 L90 92 L84 94 Z" />
        <path {...S(p)} fill={p.dark} d="M26 98 L32 100 L27 110 Z" />
        <path {...S(p)} fill={p.main} d="M83 92 L92 89 L95 100 L88 102 Z" />
        <path {...S(p)} fill={p.dark} d="M88 102 L95 100 L95 108 Z" />
        <circle {...S(p)} cx={60} cy={24} r={8} fill={p.metal} />
        <circle cx={60} cy={24} r={3} fill={p.dark} />
        <path {...L(p, 3)} stroke={p.edge} d="M40 68 Q60 60 78 68" />
      </>
    ),
  },
  {
    id: "microscope",
    nameAr: "مجهر",
    category: "knowledge",
    tags: ["مجهر", "بحث", "علوم", "خلية", "مختبر"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d="M68 98 V84 Q92 78 92 54 Q92 34 74 26 L70 36 Q82 42 82 54 Q82 70 62 76 V98 Z" />
        <rect {...S(p)} x={22} y={74} width={50} height={8} rx={3} fill={p.dark} />
        <g transform="rotate(-24 52 44)">
          <rect {...S(p)} x={44} y={20} width={18} height={44} rx={3} fill={p.main} />
          <rect {...S(p)} x={46} y={8} width={14} height={13} rx={3} fill={p.dark} />
          <rect {...S(p)} x={48} y={63} width={10} height={9} rx={2} fill={p.metal} />
        </g>
        <circle {...S(p)} cx={82} cy={54} r={6} fill={p.metal} />
        <rect {...S(p)} x={18} y={98} width={84} height={12} rx={5} fill={p.dark} />
        <rect x={34} y={72} width={16} height={4} rx={1} fill={tint(p, p.water)} />
      </>
    ),
  },
  {
    id: "flask",
    nameAr: "دورق مخبري",
    category: "knowledge",
    tags: ["كيمياء", "تجربة", "مختبر", "علوم"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.style === "line" ? p.light : p.water} opacity={p.style === "line" ? 1 : 0.55} d="M50 14 H70 V46 L98 96 Q104 108 92 108 H28 Q16 108 22 96 L50 46 Z" />
        <path {...S(p)} fill={p.second} d="M38 72 H82 L96 98 Q99 104 92 104 H28 Q21 104 24 98 Z" />
        <circle cx={52} cy={88} r={4} fill={p.light} opacity={0.8} />
        <circle cx={66} cy={94} r={3} fill={p.light} opacity={0.8} />
        <circle cx={62} cy={80} r={2.5} fill={p.light} opacity={0.8} />
        <path {...L(p, 3)} stroke={p.edge} opacity={p.style === "line" ? 0 : 0.6} d="M50 14 H70 V46 L98 96 Q104 108 92 108 H28 Q16 108 22 96 L50 46 Z" />
        <rect {...S(p)} x={44} y={8} width={32} height={9} rx={4} fill={p.dark} />
        <path d="M46 56 L32 82" stroke={p.light} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
      </>
    ),
  },
  {
    id: "test-tubes",
    nameAr: "أنابيب اختبار",
    category: "knowledge",
    tags: ["تجربة", "مختبر", "علوم", "كيمياء"],
    draw: (p) => {
      const tube = (x: number, level: number, fill: string) => (
        <g key={x}>
          <path {...S(p)} fill={p.style === "line" ? p.light : p.water} opacity={p.style === "line" ? 1 : 0.5} d={`M${x} 16 H${x + 18} V92 A9 9 0 0 1 ${x} 92 Z`} />
          <path {...S(p)} fill={fill} d={`M${x} ${level} H${x + 18} V92 A9 9 0 0 1 ${x} 92 Z`} />
          <path {...L(p, 3)} stroke={p.edge} opacity={p.style === "line" ? 0 : 0.55} d={`M${x} 16 V92 A9 9 0 0 0 ${x + 18} 92 V16`} />
          <rect {...S(p)} x={x - 3} y={12} width={24} height={6} rx={3} fill={p.dark} />
        </g>
      );
      return (
        <>
          {tube(22, 60, p.main)}
          {tube(51, 44, p.second)}
          {tube(80, 72, p.metal)}
          <rect {...S(p)} x={10} y={50} width={100} height={10} rx={3} fill={p.wood} />
          <rect {...S(p)} x={14} y={60} width={8} height={44} fill={p.wood} />
          <rect {...S(p)} x={98} y={60} width={8} height={44} fill={p.wood} />
          <rect {...S(p)} x={8} y={102} width={104} height={8} rx={3} fill={p.wood} />
        </>
      );
    },
  },
  {
    id: "atom",
    nameAr: "ذرة",
    category: "knowledge",
    tags: ["ذرة", "فيزياء", "علوم", "طاقة"],
    draw: (p) => (
      <>
        {[0, 60, 120].map((r) => (
          <ellipse key={r} {...L(p, 4)} stroke={p.edge} cx={60} cy={60} rx={50} ry={18} transform={`rotate(${r} 60 60)`} />
        ))}
        <circle {...S(p)} cx={60} cy={60} r={12} fill={p.main} />
        <circle {...S(p)} cx={110} cy={60} r={6} fill={p.second} />
        <circle {...S(p)} cx={35} cy={16.7} r={6} fill={p.second} />
        <circle {...S(p)} cx={35} cy={103.3} r={6} fill={p.second} />
      </>
    ),
  },
  {
    id: "gear",
    nameAr: "ترس",
    category: "knowledge",
    tags: ["آلة", "صناعة", "هندسة", "نظام", "عمل"],
    draw: (p) => gear(p, 60, 60, 50, 10, p.metal),
  },
  {
    id: "gears-pair",
    nameAr: "ترسان متعاشقان",
    category: "knowledge",
    tags: ["تعاون", "آلة", "نظام", "هندسة", "ترابط"],
    draw: (p) => (
      <>
        {gear(p, 44, 74, 36, 10, p.metal, "a")}
        {gear(p, 87, 33, 26, 8, p.second, "b")}
      </>
    ),
  },
  {
    id: "column-classic",
    nameAr: "عمود أثري",
    category: "knowledge",
    tags: ["عمارة", "حضارة", "تاريخ", "أثر", "ركيزة"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={34} y={26} width={52} height={70} fill={p.light} />
        <path {...L(p, 2)} opacity={0.45} d="M44 30 V92 M54 30 V92 M66 30 V92 M76 30 V92" />
        <rect {...rim(p)} x={34} y={26} width={52} height={70} />
        <path {...S(p)} fill={p.second} d="M26 18 H94 Q98 18 98 22 V26 H22 V22 Q22 18 26 18 Z" />
        <circle {...S(p)} cx={22} cy={30} r={9} fill={p.second} />
        <circle {...S(p)} cx={98} cy={30} r={9} fill={p.second} />
        <circle {...L(p, 2)} cx={22} cy={30} r={3.5} opacity={0.5} />
        <circle {...L(p, 2)} cx={98} cy={30} r={3.5} opacity={0.5} />
        <rect {...S(p)} x={16} y={10} width={88} height={9} rx={2} fill={p.main} />
        <rect {...S(p)} x={28} y={96} width={64} height={7} rx={2} fill={p.second} />
        <rect {...S(p)} x={20} y={102} width={80} height={9} rx={2} fill={p.main} />
      </>
    ),
  },
  {
    id: "arch-gate",
    nameAr: "قوس أندلسي",
    category: "knowledge",
    tags: ["أندلس", "عمارة", "حضارة إسلامية", "قرطبة", "باب"],
    note: "قوس حدوي بصنج متناوبة على طراز جامع قرطبة.",
    draw: (p) => {
      const cx = 60;
      const cy = 54;
      const ro = 40;
      const ri = 28;
      const a0 = (160 * Math.PI) / 180;
      const span = (220 * Math.PI) / 180;
      const a1 = a0 + span;
      const n = 11;
      const pt = (r: number, a: number) => `${r2(cx + r * Math.cos(a))} ${r2(cy + r * Math.sin(a))}`;
      const segs = Array.from({ length: n }, (_, i) => {
        const s = a0 + (span * i) / n;
        const e = a0 + (span * (i + 1)) / n;
        return (
          <path
            key={i}
            {...S(p)}
            fill={i % 2 === 0 ? p.main : tint(p, p.light)}
            d={`M${pt(ri, s)} L${pt(ro, s)} A${ro} ${ro} 0 0 1 ${pt(ro, e)} L${pt(ri, e)} A${ri} ${ri} 0 0 0 ${pt(ri, s)} Z`}
          />
        );
      });
      const lx = r2(cx + ri * Math.cos(a0));
      const rx = r2(cx + ri * Math.cos(a1));
      return (
        <>
          <rect {...S(p)} x={10} y={8} width={100} height={104} rx={3} fill={tint(p, p.metal)} />
          <rect {...L(p, 2)} x={16} y={12} width={88} height={100} opacity={0.4} />
          <path {...S(p)} fill={p.dark} d={`M${pt(ri, a0)} A${ri} ${ri} 0 1 1 ${pt(ri, a1)} L${rx} 112 H${lx} Z`} />
          {segs}
          <rect {...S(p)} x={22} y={66} width={14} height={8} rx={2} fill={p.second} />
          <rect {...S(p)} x={84} y={66} width={14} height={8} rx={2} fill={p.second} />
          <rect {...S(p)} x={25} y={74} width={8} height={38} fill={p.second} />
          <rect {...S(p)} x={87} y={74} width={8} height={38} fill={p.second} />
        </>
      );
    },
  },
  {
    id: "sundial",
    nameAr: "مزولة شمسية",
    category: "knowledge",
    tags: ["وقت", "مزولة", "مواقيت الصلاة", "فلك", "ظل"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d="M44 62 H76 L72 100 H48 Z" />
        <rect {...S(p)} x={32} y={98} width={56} height={12} rx={4} fill={p.second} />
        <ellipse {...S(p)} cx={60} cy={56} rx={52} ry={22} fill={p.metal} />
        <ellipse {...S(p)} cx={60} cy={54} rx={44} ry={17} fill={tint(p, p.light)} />
        <path {...L(p, 2)} opacity={0.5} d="M60 56 L18 52 M60 56 L24 42 M60 56 L38 38 M60 56 L60 37 M60 56 L82 38 M60 56 L96 42 M60 56 L102 52" />
        <path d="M60 56 L26 62" stroke={p.dark} strokeWidth={5} strokeLinecap="round" opacity={0.35} />
        <path {...S(p)} fill={p.main} d="M60 56 V18 L84 56 Z" />
      </>
    ),
  },
  {
    id: "abacus",
    nameAr: "معداد",
    category: "knowledge",
    tags: ["حساب", "رياضيات", "عدّ", "تعليم"],
    draw: (p) => {
      const rows: [number, number][] = [
        [3, 2],
        [1, 4],
        [4, 1],
        [2, 3],
        [3, 1],
      ];
      return (
        <>
          <rect {...S(p)} x={10} y={12} width={100} height={92} rx={6} fill={p.wood} />
          <rect {...S(p)} x={18} y={20} width={84} height={76} rx={3} fill={tint(p, p.light)} />
          {rows.map(([l, r], i) => {
            const y = 30 + i * 14.5;
            const beads = [
              ...Array.from({ length: l }, (_, k) => 26 + k * 11),
              ...Array.from({ length: r }, (_, k) => 94 - k * 11),
            ];
            return (
              <g key={i}>
                <path {...L(p, 2)} d={`M18 ${y} H102`} opacity={0.7} />
                {beads.map((x, k) => (
                  <ellipse key={k} {...S(p)} cx={x} cy={y} rx={5.5} ry={6} fill={i % 2 === 0 ? p.main : p.second} />
                ))}
              </g>
            );
          })}
          <rect {...S(p)} x={16} y={104} width={10} height={8} rx={2} fill={p.wood} />
          <rect {...S(p)} x={94} y={104} width={10} height={8} rx={2} fill={p.wood} />
        </>
      );
    },
  },
  {
    id: "ruler-triangle",
    nameAr: "مسطرة ومثلث",
    category: "knowledge",
    tags: ["هندسة", "رسم", "رياضيات", "قياس", "دقة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d="M18 92 V14 L100 92 Z" />
        <path {...S(p)} fill={p.style === "line" ? p.light : p.bg} d="M30 82 V44 L64 82 Z" />
        <path {...L(p, 2)} opacity={0.5} d="M18 26 H24 M18 38 H28 M18 50 H24 M18 62 H28 M18 74 H24" />
        <rect {...S(p)} x={8} y={90} width={104} height={20} rx={3} fill={p.metal} />
        <path {...L(p, 2)} opacity={0.55} d="M18 90 V100 M28 90 V96 M38 90 V100 M48 90 V96 M58 90 V100 M68 90 V96 M78 90 V100 M88 90 V96 M98 90 V100" />
      </>
    ),
  },
  {
    id: "magnifier-brass",
    nameAr: "عدسة مكبرة نحاسية",
    category: "knowledge",
    tags: ["تدقيق", "بحث علمي", "تحقيق", "قراءة", "تفحص"],
    note: "تختلف عن search في الواجهة: عدسة أثرية بإطار نحاسي فوق كتاب.",
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d="M60 86 Q38 78 10 82 V108 Q38 104 60 112 Q82 104 110 108 V82 Q82 78 60 86 Z" />
        <path {...S(p)} fill={p.light} d="M60 84 Q40 74 14 76 V102 Q40 100 60 108 Z" />
        <path {...S(p)} fill={p.light} d="M60 84 Q80 74 106 76 V102 Q80 100 60 108 Z" />
        <path {...L(p, 2)} opacity={0.4} d="M22 86 Q36 84 48 90 M22 94 Q36 92 48 98 M72 90 Q84 84 98 86" />
        <path {...S(p)} fill={p.wood} d="M44 66 L50 72 L28 96 Q24 100 20 96 Q16 92 20 88 Z" />
        <path {...L(p, 2)} opacity={0.45} d="M36 78 L42 84 M30 84 L36 90" />
        <circle {...S(p)} cx={70} cy={42} r={32} fill={p.metal} />
        <circle {...S(p)} cx={70} cy={42} r={23} fill={tint(p, p.water)} />
        <circle {...L(p, 2)} cx={70} cy={42} r={27.5} opacity={0.4} />
        <path d="M56 36 Q60 24 72 22" stroke={p.light} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.75} />
      </>
    ),
  },
  {
    id: "graduation-cap",
    nameAr: "قبعة تخرج",
    category: "knowledge",
    tags: ["تخرج", "شهادة", "تعليم", "جامعة", "نجاح"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.dark} d="M30 52 V80 Q60 96 90 80 V52 Z" />
        <path {...S(p)} fill={p.main} d="M60 20 L112 44 L60 68 L8 44 Z" />
        <path {...L(p, 3)} stroke={p.style === "line" ? p.line : p.metal} d="M60 44 L98 52 V82" />
        <path {...S(p)} fill={p.metal} d="M98 80 L92 100 H104 Z" />
        <circle {...S(p)} cx={60} cy={44} r={5} fill={p.metal} />
      </>
    ),
  },
  {
    id: "chalkboard",
    nameAr: "سبورة",
    category: "knowledge",
    tags: ["درس", "تعليم", "مدرسة", "شرح", "معلم"],
    draw: (p) => (
      <>
        <path {...L(p, 5)} stroke={p.edge} d="M32 84 L22 112 M88 84 L98 112" />
        <rect {...S(p)} x={8} y={10} width={104} height={76} rx={5} fill={p.wood} />
        <rect {...S(p)} x={15} y={17} width={90} height={62} rx={3} fill={p.style === "line" ? p.dark : p.dark} />
        <path stroke={p.light} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} d="M26 66 V38 L56 66 Z M70 32 H94 M70 44 H90 M70 56 H94 M70 68 H84" />
        <path stroke={p.light} strokeWidth={3} fill="none" opacity={0.6} d="M26 58 H34 V66" />
        <rect {...S(p)} x={10} y={84} width={100} height={6} rx={2} fill={p.wood} />
        <rect x={84} y={80} width={14} height={4} rx={2} fill={p.light} />
      </>
    ),
  },
  {
    id: "dna-helix",
    nameAr: "شريط وراثي",
    category: "knowledge",
    tags: ["وراثة", "خلق", "أحياء", "علوم", "تكوين"],
    draw: (p) => {
      const N = 40;
      const pts = (sgn: number) =>
        Array.from({ length: N + 1 }, (_, i) => {
          const y = 10 + (i * 100) / N;
          const x = 60 + sgn * 26 * Math.sin(((y - 10) / 100) * Math.PI * 3);
          return `${i === 0 ? "M" : "L"}${r2(x)} ${r2(y)}`;
        }).join(" ");
      const rungs = Array.from({ length: 14 }, (_, i) => {
        const y = 14 + i * 7;
        const dx = 26 * Math.sin(((y - 10) / 100) * Math.PI * 3);
        return Math.abs(dx) > 5 ? `M${r2(60 - dx)} ${y} L${r2(60 + dx)} ${y}` : "";
      }).join(" ");
      return (
        <>
          <path {...L(p, 3)} stroke={p.edge} opacity={0.55} d={rungs} />
          <path {...L(p, 7)} stroke={p.style === "line" ? p.line : p.main} d={pts(1)} />
          <path {...L(p, 7)} stroke={p.style === "line" ? p.line : p.second} d={pts(-1)} opacity={p.style === "line" ? 0.5 : 1} />
        </>
      );
    },
  },
  {
    id: "water-clock",
    nameAr: "ساعة مائية",
    category: "knowledge",
    tags: ["الجزري", "وقت", "اختراع", "حضارة إسلامية", "هندسة"],
    note: "ساعة مائية مبسطة: خزان يقطر في إناء وعوامة تحرك مؤشرًا على مقياس.",
    draw: (p) => (
      <>
        <rect {...S(p)} x={94} y={20} width={16} height={90} rx={3} fill={p.wood} />
        <path {...L(p, 2)} opacity={0.6} d="M94 32 H102 M94 44 H104 M94 56 H102 M94 68 H104 M94 80 H102 M94 92 H104" />
        <path {...S(p)} fill={p.main} d="M10 12 H70 L62 36 H18 Z" />
        <path {...L(p, 2)} opacity={0.4} d="M16 20 H64" />
        <rect {...S(p)} x={36} y={36} width={8} height={8} fill={p.metal} />
        <path {...S(p)} fill={p.water} d="M40 48 Q44 54 40 56 Q36 54 40 48 Z" />
        <path {...S(p)} fill={p.style === "line" ? p.light : p.water} opacity={p.style === "line" ? 1 : 0.45} d="M14 62 H74 V102 Q74 110 66 110 H22 Q14 110 14 102 Z" />
        <path {...S(p)} fill={p.water} d="M14 80 H74 V102 Q74 110 66 110 H22 Q14 110 14 102 Z" />
        <path {...L(p, 3)} stroke={p.edge} opacity={p.style === "line" ? 0 : 0.5} d="M14 62 V102 Q14 110 22 110 H66 Q74 110 74 102 V62" />
        <path {...L(p, 4)} stroke={p.edge} d="M58 76 V52 H92" />
        <path {...S(p)} fill={p.edge} d="M94 52 L86 47 V57 Z" />
        <rect {...S(p)} x={48} y={74} width={20} height={9} rx={4} fill={p.metal} />
      </>
    ),
  },
  {
    id: "manuscript-page",
    nameAr: "صفحة مخطوطة مزخرفة",
    category: "knowledge",
    tags: ["مخطوط", "تراث", "كتاب", "زخرفة", "حضارة إسلامية"],
    note: "سطور بلا كتابة؛ ليست صفحة مصحف.",
    draw: (p) => (
      <>
        <rect {...S(p)} x={16} y={8} width={88} height={104} rx={3} fill={p.light} />
        <rect x={23} y={15} width={74} height={90} rx={2} fill="none" stroke={p.style === "line" ? p.line : p.metal} strokeWidth={5} />
        <rect {...L(p, 2)} x={29} y={21} width={62} height={78} opacity={0.4} />
        <rect {...S(p)} x={36} y={27} width={48} height={14} rx={7} fill={p.main} />
        <circle {...S(p)} cx={60} cy={34} r={4} fill={p.metal} />
        <path {...L(p)} opacity={0.45} d="M36 52 H84 M36 61 H84 M36 70 H84 M36 79 H84 M44 88 H76" />
        {([
          [23, 15],
          [97, 15],
          [23, 105],
          [97, 105],
        ] as [number, number][]).map(([x, y]) => (
          <path key={`${x}${y}`} {...S(p)} fill={p.main} d={`M${x} ${y - 6} L${x + 6} ${y} L${x} ${y + 6} L${x - 6} ${y} Z`} />
        ))}
      </>
    ),
  },
];
