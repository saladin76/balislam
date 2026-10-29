import React from "react";
import type { ElementDef, ElementPalette } from "../types";
import { L, S } from "../helpers";

/**
 * إطارات وزخارف: كلها فارغة من الداخل، والقوالب تكتب النص فوقها.
 * المساحة 120×120 بهامش ~8.
 */

/** نقاط نجمة منتظمة بعدد رؤوس n، نصف قطر خارجي R وداخلي r. */
const star = (cx: number, cy: number, n: number, R: number, r: number, rot = -90) => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const rr = i % 2 === 0 ? R : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
};

/** مستطيل بزوايا مقعرة (خرطوشة). */
const cartouche = (x0: number, y0: number, x1: number, y1: number, r: number) =>
  `M${x0 + r} ${y0} H${x1 - r} A${r} ${r} 0 0 0 ${x1} ${y0 + r} V${y1 - r} A${r} ${r} 0 0 0 ${x1 - r} ${y1} H${x0 + r} A${r} ${r} 0 0 0 ${x0} ${y1 - r} V${y0 + r} A${r} ${r} 0 0 0 ${x0 + r} ${y0} Z`;

/** تعبئة ذهبية في المسطح ونعناعية في الخطي. */
const gold = (p: ElementPalette) => p.metal;
/** خط تفصيل يظهر فوق الذهب/الفاتح. */
const thin = (p: ElementPalette, w = 1.6) => ({ ...L(p, w), opacity: 0.55 });

export const elements: ElementDef[] = [
  {
    id: "verse-frame",
    nameAr: "إطار آية مزخرف",
    category: "frames",
    tags: ["آية", "إطار", "خرطوشة", "قرآن", "زخرفة"],
    note: "إطار فارغ لبطاقة الآية؛ النص تكتبه القوالب.",
    draw: (p) => (
      <>
        <path {...S(p)} fill={gold(p)} d="M12 48 L4 60 L12 72 Z M108 48 L116 60 L108 72 Z" />
        <path {...S(p)} fill={gold(p)} d="M46 26 Q60 10 74 26 Z M46 94 Q60 110 74 94 Z" />
        <path {...S(p)} fill={gold(p)} d={cartouche(10, 24, 110, 96, 9)} />
        <path {...S(p)} fill={p.light} d={cartouche(18, 32, 102, 88, 6)} />
        <path {...thin(p)} d={cartouche(22, 36, 98, 84, 5)} />
        <circle cx={60} cy={19} r={2.6} fill={p.style === "line" ? p.line : p.light} />
        <circle cx={60} cy={101} r={2.6} fill={p.style === "line" ? p.line : p.light} />
        <path {...thin(p, 2)} d="M14 28 L16 30 M106 28 L104 30 M14 92 L16 90 M106 92 L104 90" />
      </>
    ),
  },
  {
    id: "hadith-frame",
    nameAr: "إطار حديث",
    category: "frames",
    tags: ["حديث", "إطار", "اقتباس", "بطاقة"],
    note: "إطار فارغ؛ النص تكتبه القوالب.",
    draw: (p) => (
      <>
        <rect {...S(p)} x={10} y={26} width={100} height={78} rx={14} fill={p.second} />
        <rect {...S(p)} x={17} y={33} width={86} height={64} rx={9} fill={p.light} />
        <path {...S(p)} fill={p.accent} d="M44 30 Q44 14 60 10 Q76 14 76 30 Z" />
        <circle cx={60} cy={22} r={3.4} fill={p.style === "line" ? p.line : p.light} />
        <path {...thin(p)} d="M30 90 H90" />
      </>
    ),
  },
  {
    id: "divider-ornament",
    nameAr: "فاصل مزخرف",
    category: "frames",
    tags: ["فاصل", "زخرفة", "خط", "تقسيم"],
    draw: (p) => (
      <>
        <path {...L(p, 3)} stroke={p.edge} d="M12 60 H44 M76 60 H108" />
        <path {...L(p, 2)} stroke={p.edge} d="M20 54 Q30 60 44 54 M20 66 Q30 60 44 66 M100 54 Q90 60 76 54 M100 66 Q90 60 76 66" opacity={0.7} />
        <circle {...S(p)} cx={10} cy={60} r={4} fill={gold(p)} />
        <circle {...S(p)} cx={110} cy={60} r={4} fill={gold(p)} />
        <path {...S(p)} fill={gold(p)} d="M60 44 L76 60 L60 76 L44 60 Z" />
        <path {...S(p)} fill={p.light} d="M60 52 L68 60 L60 68 L52 60 Z" />
        <path {...S(p)} fill={p.second} d="M34 56 L38 60 L34 64 L30 60 Z M86 56 L90 60 L86 64 L82 60 Z" />
      </>
    ),
  },
  {
    id: "corner-ornament",
    nameAr: "زخرفة زاوية",
    category: "frames",
    tags: ["زاوية", "زخرفة", "ركن", "إطار"],
    note: "زاوية علوية يمنى؛ تُقلب للزوايا الأخرى.",
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d="M40 12 H108 L100 20 H40 Z" />
        <path {...S(p)} fill={p.second} d="M12 40 V108 L20 100 V40 Z" />
        <path {...S(p)} fill={gold(p)} d="M10 10 H48 A38 38 0 0 1 10 48 Z" />
        <path {...thin(p)} d="M10 34 A24 24 0 0 0 34 10" />
        <path {...S(p)} fill={p.light} d="M18 18 L28 18 L18 28 Z" />
        <path {...L(p, 2.5)} stroke={p.edge} d="M44 44 Q58 36 62 48 Q64 58 54 56" />
        <path {...S(p)} fill={p.main} d="M44 44 Q36 54 44 64 Q52 54 44 44 Z" />
        <circle {...S(p)} cx={30} cy={56} r={3.5} fill={p.accent} />
        <circle {...S(p)} cx={56} cy={30} r={3.5} fill={p.accent} />
      </>
    ),
  },
  {
    id: "star-pattern-tile",
    nameAr: "بلاطة نجمة ثمانية",
    category: "frames",
    tags: ["نجمة", "هندسة", "زخرفة إسلامية", "بلاطة", "نمط"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={10} y={10} width={100} height={100} rx={2} fill={p.light} />
        {[
          [10, 10, 0],
          [110, 10, 90],
          [110, 110, 180],
          [10, 110, 270],
        ].map(([x, y, a0], i) => {
          // ربع نجمة ثمانية في كل زاوية داخل البلاطة
          const pts = [`${x},${y}`];
          for (let j = 0; j <= 4; j++) {
            const a = ((a0! + j * 22.5) * Math.PI) / 180;
            const rr = j % 2 === 0 ? 26 : 18;
            pts.push(`${(x! + rr * Math.cos(a)).toFixed(2)},${(y! + rr * Math.sin(a)).toFixed(2)}`);
          }
          return <polygon key={i} {...S(p)} fill={p.second} points={pts.join(" ")} />;
        })}
        <rect x={10} y={10} width={100} height={100} rx={2} fill="none" stroke={p.style === "line" ? p.line : "none"} strokeWidth={p.sw} />
        <polygon {...S(p)} fill={p.main} points={star(60, 60, 8, 42, 32, -90)} />
        <polygon {...S(p)} fill={gold(p)} points={star(60, 60, 8, 26, 20, -90 + 22.5)} />
        <polygon {...S(p)} fill={p.light} points={star(60, 60, 8, 12, 11, -90)} />
        <path {...thin(p)} d="M60 18 V34 M60 86 V102 M18 60 H34 M86 60 H102" />
      </>
    ),
  },
  {
    id: "girih-tile",
    nameAr: "بلاطة گره هندسية",
    category: "frames",
    tags: ["هندسة", "زخرفة إسلامية", "بلاطة", "نجمة عشرية", "نمط"],
    draw: (p) => {
      const rays = Array.from({ length: 10 }, (_, i) => {
        const a = ((-90 + i * 36) * Math.PI) / 180;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const t = Math.min(48 / Math.max(Math.abs(c), 1e-6), 48 / Math.max(Math.abs(s), 1e-6));
        return `M${(60 + 34 * c).toFixed(2)} ${(60 + 34 * s).toFixed(2)} L${(60 + t * c).toFixed(2)} ${(60 + t * s).toFixed(2)}`;
      }).join(" ");
      return (
        <>
          <rect {...S(p)} x={12} y={12} width={96} height={96} rx={6} fill={p.second} />
          <rect x={18} y={18} width={84} height={84} rx={3} fill={p.light} opacity={p.style === "line" ? 0 : 0.35} />
          <path {...L(p, 2.4)} d={rays} opacity={0.75} />
          <polygon {...S(p)} fill={p.main} points={star(60, 60, 10, 34, 22)} />
          <polygon {...S(p)} fill={p.light} points={star(60, 60, 10, 18, 15.5, -90 + 18)} />
          <circle {...S(p)} cx={60} cy={60} r={5} fill={gold(p)} />
          <path {...S(p)} fill={gold(p)} d="M12 12 L24 12 L12 24 Z M108 12 L96 12 L108 24 Z M12 108 L24 108 L12 96 Z M108 108 L96 108 L108 96 Z" />
        </>
      );
    },
  },
  {
    id: "arabesque-border",
    nameAr: "شريط أرابيسك",
    category: "frames",
    tags: ["أرابيسك", "شريط", "زخرفة نباتية", "حاشية"],
    draw: (p) => {
      const leaf = (x: number, y: number, up: boolean) => {
        const d = up ? -1 : 1;
        return `M${x} ${y} Q${x - 7} ${y + d * 7} ${x} ${y + d * 13} Q${x + 7} ${y + d * 7} ${x} ${y} Z`;
      };
      return (
        <>
          <rect {...S(p)} x={6} y={38} width={108} height={44} rx={6} fill={p.second} />
          <rect {...S(p)} x={12} y={44} width={96} height={32} rx={4} fill={p.light} />
          <path {...L(p, 2.6)} stroke={p.style === "line" ? p.line : p.main} d="M14 60 Q24 48 36 60 T60 60 T84 60 T106 60" />
          <path {...S(p)} fill={gold(p)} d={[leaf(25, 53, true), leaf(48, 67, false), leaf(73, 53, true), leaf(96, 67, false)].join(" ")} />
          <circle cx={36} cy={60} r={2.6} fill={p.style === "line" ? p.line : p.main} />
          <circle cx={60} cy={60} r={2.6} fill={p.style === "line" ? p.line : p.main} />
          <circle cx={84} cy={60} r={2.6} fill={p.style === "line" ? p.line : p.main} />
        </>
      );
    },
  },
  {
    id: "badge-circle",
    nameAr: "وسام دائري",
    category: "frames",
    tags: ["وسام", "شارة", "دائرة", "إنجاز", "إطار"],
    draw: (p) => (
      <>
        <polygon {...S(p)} fill={gold(p)} points={star(60, 60, 20, 50, 44)} />
        <circle {...S(p)} cx={60} cy={60} r={38} fill={p.main} />
        <circle {...S(p)} cx={60} cy={60} r={30} fill={p.light} />
        <circle cx={60} cy={60} r={34} fill="none" stroke={p.style === "line" ? p.line : p.light} strokeWidth={1.8} strokeDasharray="2 4" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "ribbon-banner",
    nameAr: "شريط لافتة",
    category: "frames",
    tags: ["شريط", "لافتة", "عنوان", "راية"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d="M8 50 H32 V86 H8 L18 68 Z" />
        <path {...S(p)} fill={p.second} d="M112 50 H88 V86 H112 L102 68 Z" />
        <path {...S(p)} fill={p.dark} d="M24 76 L32 86 V76 Z M96 76 L88 86 V76 Z" opacity={p.style === "line" ? 1 : 0.55} />
        <rect {...S(p)} x={24} y={36} width={72} height={40} rx={3} fill={p.main} />
        <path {...thin(p)} stroke={p.style === "line" ? p.line : p.light} d="M30 42 H90 M30 70 H90" />
      </>
    ),
  },
  {
    id: "label-chip",
    nameAr: "شريحة عنوان",
    category: "frames",
    tags: ["شريحة", "وسم", "عنوان", "تصنيف"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={10} y={42} width={100} height={36} rx={18} fill={p.second} />
        <circle {...S(p)} cx={92} cy={60} r={7} fill={p.light} />
        <rect x={15} y={47} width={90} height={26} rx={13} fill="none" stroke={p.style === "line" ? p.line : p.light} strokeWidth={1.5} opacity={0.6} />
      </>
    ),
  },
  {
    id: "card-plain",
    nameAr: "بطاقة بسيطة",
    category: "frames",
    tags: ["بطاقة", "لوحة", "إطار", "صندوق"],
    draw: (p) => (
      <>
        <rect x={18} y={24} width={94} height={82} rx={12} fill={p.shadow} />
        <rect {...S(p)} x={10} y={16} width={94} height={82} rx={12} fill={p.light} />
        <rect x={10} y={16} width={94} height={8} rx={4} fill={p.second} opacity={p.style === "line" ? 0 : 0.8} />
      </>
    ),
  },
  {
    id: "arch-frame",
    nameAr: "إطار محراب",
    category: "frames",
    tags: ["محراب", "قوس", "إطار", "مسجد", "زخرفة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d="M16 110 V56 Q16 26 60 8 Q104 26 104 56 V110 Z" />
        <path {...S(p)} fill={p.light} d="M26 110 V58 Q26 34 60 19 Q94 34 94 58 V110 Z" />
        <path {...thin(p)} d="M32 110 V60 Q32 40 60 27 Q88 40 88 60 V110" />
        <rect {...S(p)} x={12} y={104} width={96} height={8} rx={2} fill={gold(p)} />
        <rect {...S(p)} x={20} y={54} width={10} height={6} rx={1.5} fill={gold(p)} />
        <rect {...S(p)} x={90} y={54} width={10} height={6} rx={1.5} fill={gold(p)} />
        <circle {...S(p)} cx={60} cy={12} r={3.5} fill={gold(p)} />
      </>
    ),
  },
  {
    id: "seal-stamp",
    nameAr: "ختم دائري",
    category: "frames",
    tags: ["ختم", "خاتم", "توثيق", "دائرة"],
    draw: (p) => (
      <>
        <circle {...S(p)} cx={60} cy={60} r={48} fill={p.main} />
        <circle cx={60} cy={60} r={42} fill="none" stroke={p.style === "line" ? p.line : p.light} strokeWidth={2.2} />
        <circle cx={60} cy={60} r={28} fill="none" stroke={p.style === "line" ? p.line : p.light} strokeWidth={2.2} />
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i * 2 * Math.PI) / 16;
          return <circle key={i} cx={60 + 35 * Math.cos(a)} cy={60 + 35 * Math.sin(a)} r={2.2} fill={p.style === "line" ? p.line : p.light} />;
        })}
      </>
    ),
  },
  {
    id: "bracket-ornate",
    nameAr: "قوس زخرفي",
    category: "frames",
    tags: ["قوس", "زخرفة", "حاصرة", "اقتباس"],
    note: "قوس أيمن؛ يُقلب أفقيًا للجهة الأخرى.",
    draw: (p) => {
      const d = "M78 12 Q50 12 52 36 Q54 54 36 60 Q54 66 52 84 Q50 108 78 108";
      return (
        <>
          {p.style === "line" ? (
            <>
              <path {...L(p, 14)} d={d} />
              <path {...L(p, 8)} stroke={p.second} d={d} />
            </>
          ) : (
            <path {...L(p, 10)} stroke={p.main} d={d} />
          )}
          <path {...S(p)} fill={gold(p)} d="M36 50 L46 60 L36 70 L26 60 Z" />
          <circle {...S(p)} cx={82} cy={12} r={6} fill={gold(p)} />
          <circle {...S(p)} cx={82} cy={108} r={6} fill={gold(p)} />
        </>
      );
    },
  },
  {
    id: "dots-pattern",
    nameAr: "نمط نقاط",
    category: "frames",
    tags: ["نقاط", "نمط", "خلفية", "زخرفة"],
    draw: (p) => (
      <>
        {Array.from({ length: 25 }, (_, i) => {
          const c = i % 5;
          const r = Math.floor(i / 5);
          const big = (c + r) % 2 === 0;
          return (
            <circle
              key={i}
              cx={20 + c * 20}
              cy={20 + r * 20}
              r={big ? 6 : 3.5}
              fill={p.style === "line" ? (big ? p.second : p.line) : big ? p.main : p.second}
              stroke={p.style === "line" && big ? p.line : "none"}
              strokeWidth={2}
            />
          );
        })}
      </>
    ),
  },
  {
    id: "lines-pattern",
    nameAr: "نمط خطوط",
    category: "frames",
    tags: ["خطوط", "نمط", "خلفية", "تظليل"],
    draw: (p) => {
      const segs: string[] = [];
      for (let c = 28; c <= 196; c += 14) {
        // خط قطري x + y = c داخل المربع 14..106
        const x0 = Math.max(14, c - 106);
        const x1 = Math.min(106, c - 14);
        if (x1 > x0) segs.push(`M${x0} ${c - x0} L${x1} ${c - x1}`);
      }
      return (
        <>
          <rect {...S(p)} x={10} y={10} width={100} height={100} rx={12} fill={p.light} />
          <path {...L(p, 4)} stroke={p.style === "line" ? p.line : p.second} d={segs.join(" ")} opacity={p.style === "line" ? 0.5 : 1} />
        </>
      );
    },
  },
];
