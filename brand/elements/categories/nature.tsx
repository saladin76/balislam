import React from "react";
import type { ElementDef, ElementPalette } from "../types";
import { L, S, tint } from "../helpers";

/**
 * الطبيعة والكون: سماء وأجرام، طقس، نبات، تضاريس، ماء ونار.
 * على نسق ui.tsx: مساحة 120×120، أشكال ممتلئة مستديرة، تفاصيل بخطوط L(p).
 */

/** مسار هلال: دائرة خارجية (cx,cy,R) تقتطع منها دائرة داخلية (ix,iy,r). */
const crescent = (cx: number, cy: number, R: number, ix: number, iy: number, r: number) => {
  const dx = ix - cx;
  const dy = iy - cy;
  const d = Math.hypot(dx, dy);
  const a = (R * R - r * r + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, R * R - a * a));
  const px = cx + (a * dx) / d;
  const py = cy + (a * dy) / d;
  const ax = px - (h * dy) / d;
  const ay = py + (h * dx) / d;
  const bx = px + (h * dy) / d;
  const by = py - (h * dx) / d;
  const f = (n: number) => n.toFixed(1);
  return `M${f(ax)} ${f(ay)} A${R} ${R} 0 1 1 ${f(bx)} ${f(by)} A${r} ${r} 0 0 0 ${f(ax)} ${f(ay)} Z`;
};

/** نجمة خماسية مركزها (cx,cy) */
const star5 = (cx: number, cy: number, R: number, r: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(cx + rad * Math.cos(ang)).toFixed(1)} ${(cy + rad * Math.sin(ang)).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
};

/** لمعة رباعية صغيرة */
const twinkle = (cx: number, cy: number, s: number) =>
  `M${cx} ${cy - s} Q${cx + s * 0.15} ${cy - s * 0.15} ${cx + s} ${cy} Q${cx + s * 0.15} ${cy + s * 0.15} ${cx} ${cy + s} Q${cx - s * 0.15} ${cy + s * 0.15} ${cx - s} ${cy} Q${cx - s * 0.15} ${cy - s * 0.15} ${cx} ${cy - s} Z`;

/** قطرة رأسها عند (x,y) وطولها s */
const drop = (x: number, y: number, s: number) => {
  const w = s * 0.42;
  return `M${x} ${y} Q${x + w * 0.4} ${y + s * 0.4} ${x + w} ${y + s * 0.62} A${w} ${w} 0 1 1 ${x - w} ${y + s * 0.62} Q${x - w * 0.4} ${y + s * 0.4} ${x} ${y} Z`;
};

/** غيمة منتفخة داخل مستطيل (x,y,w,h) */
const cloudPath = (x: number, y: number, w: number, h: number) => {
  const X = (t: number) => (x + t * w).toFixed(1);
  const Y = (t: number) => (y + t * h).toFixed(1);
  return `M${X(0.18)} ${Y(1)} Q${X(0)} ${Y(1)} ${X(0)} ${Y(0.74)} Q${X(0)} ${Y(0.46)} ${X(0.2)} ${Y(0.44)} Q${X(0.22)} ${Y(0.08)} ${X(0.48)} ${Y(0.08)} Q${X(0.66)} ${Y(-0.04)} ${X(0.76)} ${Y(0.24)} Q${X(1)} ${Y(0.22)} ${X(1)} ${Y(0.6)} Q${X(1)} ${Y(1)} ${X(0.8)} ${Y(1)} Z`;
};

/** سعفة نخلة متدلية من التاج (x,y) إلى الطرف (tx,ty)؛ (cx,cy) نقطة التحكم العليا وw سمك الورقة */
const frond = (x: number, y: number, cx: number, cy: number, tx: number, ty: number, w = 16) =>
  `M${x} ${y} Q${cx} ${cy} ${tx} ${ty} Q${cx} ${cy + w} ${x} ${y + 4} Z`;

const rays = (p: ElementPalette, cx: number, cy: number, r0: number, len: number, angles: number[], w = 9) =>
  angles.map((a) => (
    <rect key={a} {...S(p)} x={cx - w / 2} y={cy - r0 - len} width={w} height={len} rx={w / 2} fill={p.metal} transform={`rotate(${a} ${cx} ${cy})`} />
  ));

export const elements: ElementDef[] = [
  // ───────── السماء والأجرام ─────────
  {
    id: "sun",
    nameAr: "شمس",
    category: "nature",
    tags: ["شمس", "نهار", "ضوء", "حرارة", "صباح"],
    draw: (p) => (
      <>
        {rays(p, 60, 60, 36, 18, [0, 45, 90, 135, 180, 225, 270, 315], 10)}
        <circle {...S(p)} cx={60} cy={60} r={30} fill={p.metal} />
        <path d="M44 52 Q48 40 60 38" stroke={p.light} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.7} />
      </>
    ),
  },
  {
    id: "sunrise",
    nameAr: "شروق الشمس",
    category: "nature",
    tags: ["شروق", "فجر", "بداية", "صباح", "غروب"],
    draw: (p) => (
      <>
        {rays(p, 60, 80, 42, 16, [0, -40, 40, -76, 76], 9)}
        <path {...S(p)} fill={p.metal} d="M24 80 A36 36 0 0 1 96 80 Z" />
        <path {...S(p)} fill={p.second} d="M8 80 H112 V96 Q112 104 104 104 H16 Q8 104 8 96 Z" />
        <path {...L(p)} stroke={p.style === "line" ? p.line : p.light} d="M28 92 H58 M70 92 H92" opacity={0.6} />
      </>
    ),
  },
  {
    id: "moon-crescent",
    nameAr: "هلال",
    category: "nature",
    tags: ["هلال", "قمر", "ليل", "شهر", "رمضان"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.metal} d={crescent(54, 62, 46, 76, 46, 40)} />
        <path {...S(p)} fill={p.metal} d={twinkle(96, 84, 10)} />
      </>
    ),
  },
  {
    id: "moon-full",
    nameAr: "بدر",
    category: "nature",
    tags: ["بدر", "قمر", "ليل", "اكتمال", "منتصف الشهر"],
    draw: (p) => (
      <>
        <circle {...S(p)} cx={60} cy={60} r={48} fill={p.metal} />
        <circle cx={44} cy={46} r={10} fill={p.dark} opacity={0.14} />
        <circle cx={74} cy={74} r={13} fill={p.dark} opacity={0.14} />
        <circle cx={76} cy={38} r={6} fill={p.dark} opacity={0.14} />
        <circle cx={42} cy={80} r={5} fill={p.dark} opacity={0.14} />
        <path d="M24 56 Q26 32 46 22" stroke={p.light} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.6} />
      </>
    ),
  },
  {
    id: "star",
    nameAr: "نجمة",
    category: "nature",
    tags: ["نجم", "سماء", "ليل", "هداية"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.metal} strokeLinejoin="round" d={star5(56, 64, 48, 21)} />
        <path {...S(p)} fill={p.second} d={twinkle(102, 18, 10)} />
        <circle {...S(p)} cx={104} cy={100} r={5} fill={p.second} />
      </>
    ),
  },
  {
    id: "stars-cluster",
    nameAr: "نجوم",
    category: "nature",
    tags: ["نجوم", "سماء", "ليل", "كثرة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.metal} d={star5(42, 70, 32, 14)} />
        <path {...S(p)} fill={p.metal} d={star5(88, 34, 20, 9)} />
        <path {...S(p)} fill={p.second} d={twinkle(92, 86, 14)} />
        <path {...S(p)} fill={p.second} d={twinkle(32, 20, 9)} />
        <circle {...S(p)} cx={64} cy={18} r={4} fill={p.metal} />
        <circle {...S(p)} cx={110} cy={62} r={4} fill={p.metal} />
      </>
    ),
  },
  {
    id: "comet",
    nameAr: "مذنب",
    category: "nature",
    tags: ["مذنب", "شهاب", "فضاء", "سرعة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d="M22 70 Q60 38 110 10 Q82 60 50 98 Z" />
        <path {...S(p)} fill={p.metal} d="M30 78 Q62 50 96 26 Q74 60 42 90 Z" opacity={p.style === "line" ? 1 : 0.7} />
        <circle {...S(p)} cx={36} cy={84} r={20} fill={p.metal} />
        <circle cx={30} cy={78} r={6} fill={p.light} opacity={0.7} />
      </>
    ),
  },
  {
    id: "earth-globe",
    nameAr: "كوكب الأرض",
    category: "nature",
    tags: ["الأرض", "العالم", "كوكب", "الناس"],
    draw: (p) => (
      <>
        <circle {...S(p)} cx={60} cy={60} r={50} fill={p.water} />
        <path
          {...S(p)}
          fill={tint(p, p.green)}
          d="M30 28 Q42 18 56 22 Q62 30 54 36 Q46 38 48 48 Q52 58 42 62 Q32 62 28 52 Q20 46 22 38 Q24 30 30 28 Z"
        />
        <path {...S(p)} fill={tint(p, p.green)} d="M70 46 Q82 40 94 48 Q102 58 96 70 Q90 76 92 86 Q86 96 78 92 Q72 82 74 72 Q66 66 66 56 Q66 50 70 46 Z" />
        <path {...S(p)} fill={tint(p, p.green)} d="M40 86 Q48 82 54 88 Q54 96 46 98 Q38 96 40 86 Z" />
        <path d="M22 46 Q28 22 52 14" stroke={p.light} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.5} />
      </>
    ),
  },
  {
    id: "planet-ringed",
    nameAr: "كوكب بحلقة",
    category: "nature",
    tags: ["كوكب", "فضاء", "زحل", "كون"],
    draw: (p) => (
      <>
        <g transform="rotate(-20 60 60)">
          <path {...S(p)} fill={p.metal} d="M6 60 A54 17 0 0 1 114 60 H100 A40 9 0 0 0 20 60 Z" />
        </g>
        <circle {...S(p)} cx={60} cy={60} r={32} fill={p.main} />
        <path {...L(p)} d="M34 48 Q60 40 86 50 M30 64 Q60 56 90 68" opacity={0.3} />
        <g transform="rotate(-20 60 60)">
          <path {...S(p)} fill={p.metal} d="M6 60 A54 17 0 0 0 114 60 H100 A40 9 0 0 1 20 60 Z" />
        </g>
        <circle {...S(p)} cx={104} cy={18} r={4} fill={p.second} />
        <circle {...S(p)} cx={16} cy={100} r={5} fill={p.second} />
      </>
    ),
  },

  // ───────── الطقس ─────────
  {
    id: "cloud",
    nameAr: "غيمة",
    category: "nature",
    tags: ["غيم", "سحاب", "سماء", "طقس"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.light} d={cloudPath(10, 26, 100, 66)} />
        <path {...L(p)} d="M30 80 H76" opacity={0.25} />
      </>
    ),
  },
  {
    id: "cloud-rain",
    nameAr: "غيمة ممطرة",
    category: "nature",
    tags: ["مطر", "غيث", "سحاب", "رحمة", "شتاء"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.light} d={cloudPath(12, 10, 96, 58)} />
        <path {...S(p)} fill={p.water} d={drop(34, 76, 24)} />
        <path {...S(p)} fill={p.water} d={drop(60, 84, 26)} />
        <path {...S(p)} fill={p.water} d={drop(86, 76, 24)} />
      </>
    ),
  },
  {
    id: "cloud-lightning",
    nameAr: "برق ورعد",
    category: "nature",
    tags: ["برق", "رعد", "عاصفة", "خوف", "قوة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.style === "line" ? p.light : p.water} d={cloudPath(10, 8, 100, 62)} />
        <path {...S(p)} fill={p.metal} d="M62 52 L40 86 H56 L46 114 L82 74 H64 L76 52 Z" />
      </>
    ),
  },
  {
    id: "rainbow",
    nameAr: "قوس قزح",
    category: "nature",
    tags: ["قوس", "ألوان", "أمل", "بعد المطر"],
    draw: (p) => {
      const cx = 60;
      const cy = 88;
      const band = (r1: number, r2: number) => `M${cx - r1} ${cy} A${r1} ${r1} 0 0 1 ${cx + r1} ${cy} H${cx + r2} A${r2} ${r2} 0 0 0 ${cx - r2} ${cy} Z`;
      const fills = p.style === "line" ? [p.light, p.second, p.light] : [p.main, p.metal, p.second];
      return (
        <>
          <path {...S(p)} fill={fills[0]} d={band(52, 42)} />
          <path {...S(p)} fill={fills[1]} d={band(42, 32)} />
          <path {...S(p)} fill={fills[2]} d={band(32, 22)} />
          <path {...S(p)} fill={p.light} d={cloudPath(4, 76, 34, 28)} />
          <path {...S(p)} fill={p.light} d={cloudPath(82, 76, 34, 28)} />
        </>
      );
    },
  },
  {
    id: "snowflake",
    nameAr: "ندفة ثلج",
    category: "nature",
    tags: ["ثلج", "برد", "شتاء", "صقيع"],
    draw: (p) => {
      const c = p.style === "line" ? p.line : p.water;
      return (
        <>
          {[0, 60, 120].map((a) => (
            <path key={a} {...L(p, 8)} stroke={c} d="M60 10 V110" transform={`rotate(${a} 60 60)`} />
          ))}
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <path key={`b${a}`} {...L(p, 6)} stroke={c} d="M48 20 L60 32 L72 20" transform={`rotate(${a} 60 60)`} />
          ))}
          <circle {...S(p)} cx={60} cy={60} r={10} fill={p.light} />
        </>
      );
    },
  },
  {
    id: "wind",
    nameAr: "ريح",
    category: "nature",
    tags: ["ريح", "هواء", "رياح", "تغيير"],
    draw: (p) => (
      <>
        <path {...L(p, 8)} stroke={p.edge} d="M10 46 H78 Q94 46 94 32 Q94 20 82 20 Q72 20 72 30" />
        <path {...L(p, 8)} stroke={p.edge} d="M10 66 H96 Q110 66 110 80 Q110 94 96 94 Q86 94 86 84" />
        <path {...L(p, 8)} stroke={p.edge} d="M22 86 H56" />
        <path {...S(p)} fill={p.green} d="M30 104 Q40 88 58 96 Q48 112 30 104 Z" />
      </>
    ),
  },

  // ───────── النبات ─────────
  {
    id: "seed",
    nameAr: "بذرة",
    category: "nature",
    tags: ["بذرة", "بداية", "نية", "زرع", "إمكان"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.wood} d="M60 102 Q12 82 30 40 Q42 14 72 16 Q104 22 98 60 Q92 96 60 102 Z" transform="rotate(-20 60 60)" />
        <path {...L(p)} d="M62 26 Q46 56 64 96" transform="rotate(-20 60 60)" opacity={0.45} />
        <path d="M44 38 Q52 26 64 24" stroke={p.light} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.6} transform="rotate(-20 60 60)" />
      </>
    ),
  },
  {
    id: "sprout",
    nameAr: "نبتة صغيرة",
    category: "nature",
    tags: ["نبتة", "نمو", "بداية", "أمل"],
    draw: (p) => (
      <>
        <path {...L(p, 6)} stroke={p.style === "line" ? p.line : p.green} d="M60 90 V50" />
        <path {...S(p)} fill={p.green} d="M58 58 Q22 62 16 30 Q50 24 58 58 Z" />
        <path {...S(p)} fill={p.green} d="M62 50 Q70 14 106 14 Q102 50 62 50 Z" />
        <path {...L(p)} d="M54 54 Q38 44 26 34 M66 46 Q82 32 96 22" opacity={0.35} />
        <path {...S(p)} fill={p.wood} d="M12 108 Q16 84 60 84 Q104 84 108 108 Z" />
      </>
    ),
  },
  {
    id: "plant-young",
    nameAr: "نبتة في أصيص",
    category: "nature",
    tags: ["نبات", "نمو", "رعاية", "تربية"],
    draw: (p) => (
      <>
        <path {...L(p, 6)} stroke={p.style === "line" ? p.line : p.green} d="M60 76 V26" />
        <path {...S(p)} fill={p.green} d="M58 64 Q30 68 22 44 Q50 38 58 64 Z" />
        <path {...S(p)} fill={p.green} d="M62 54 Q70 30 98 30 Q92 56 62 54 Z" />
        <path {...S(p)} fill={p.green} d="M58 38 Q40 34 38 14 Q58 16 58 38 Z" />
        <path {...S(p)} fill={p.green} d="M62 30 Q66 12 84 8 Q84 28 62 30 Z" />
        <path {...S(p)} fill={p.main} d="M30 76 H90 L82 110 Q81 112 78 112 H42 Q39 112 38 110 Z" />
        <rect {...S(p)} x={26} y={72} width={68} height={12} rx={4} fill={p.main} />
      </>
    ),
  },
  {
    id: "flower",
    nameAr: "زهرة",
    category: "nature",
    tags: ["زهرة", "ورد", "جمال", "ربيع"],
    draw: (p) => (
      <>
        <path {...L(p, 6)} stroke={p.style === "line" ? p.line : p.green} d="M60 64 V112" />
        <path {...S(p)} fill={p.green} d="M60 96 Q38 98 30 80 Q52 76 60 96 Z" />
        <path {...S(p)} fill={p.green} d="M60 88 Q72 70 92 74 Q84 92 60 88 Z" />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse key={a} {...S(p)} cx={60} cy={20} rx={13} ry={17} fill={p.main} transform={`rotate(${a} 60 40)`} />
        ))}
        <circle {...S(p)} cx={60} cy={40} r={13} fill={p.metal} />
      </>
    ),
  },
  {
    id: "leaf",
    nameAr: "ورقة شجر",
    category: "nature",
    tags: ["ورقة", "شجر", "خريف", "طبيعة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.green} d="M24 98 Q10 40 56 22 Q84 12 108 12 Q110 46 96 72 Q76 106 24 98 Z" />
        <path {...L(p)} d="M12 110 L24 98 Q56 64 96 26" />
        <path {...L(p)} d="M42 80 L40 56 M56 66 L56 42 M70 52 L74 32 M50 74 L72 76 M64 60 L86 60 M76 46 L96 44" opacity={0.4} />
      </>
    ),
  },
  {
    id: "tree",
    nameAr: "شجرة",
    category: "nature",
    tags: ["شجرة", "ظل", "ثبات", "نمو", "صدقة جارية"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.wood} d="M52 70 H68 L70 108 Q70 112 66 112 H54 Q50 112 50 108 Z" />
        <path
          {...S(p)}
          fill={p.green}
          d="M60 8 Q84 8 90 28 Q108 34 106 54 Q104 78 80 80 H40 Q16 78 14 54 Q12 34 30 28 Q36 8 60 8 Z"
        />
        <path {...L(p)} d="M36 44 Q44 36 54 38 M66 52 Q76 46 86 50 M44 64 Q52 60 58 64" opacity={0.35} />
      </>
    ),
  },
  {
    id: "fruit-tree",
    nameAr: "شجرة مثمرة",
    category: "nature",
    tags: ["ثمر", "شجرة", "عطاء", "حصاد", "أجر"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.wood} d="M52 70 H68 L70 108 Q70 112 66 112 H54 Q50 112 50 108 Z" />
        <path
          {...S(p)}
          fill={p.green}
          d="M60 8 Q84 8 90 28 Q108 34 106 54 Q104 78 80 80 H40 Q16 78 14 54 Q12 34 30 28 Q36 8 60 8 Z"
        />
        {[
          [38, 40],
          [62, 28],
          [84, 44],
          [50, 62],
          [76, 64],
          [28, 60],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} {...S(p)} cx={x} cy={y} r={7} fill={p.style === "line" ? p.light : p.metal} />
        ))}
      </>
    ),
  },
  {
    id: "tree-bare",
    nameAr: "شجرة عارية",
    category: "nature",
    tags: ["شتاء", "خريف", "جفاف", "ذبول", "صبر"],
    draw: (p) => {
      const c = p.style === "line" ? p.line : p.wood;
      return (
        <>
          <path {...L(p, 4)} stroke={c} d="M40 38 L20 38 M46 46 L38 60 M80 36 L102 40 M76 44 L84 56 M60 30 L48 20 M61 36 L74 24 M30 30 L24 18 M90 26 L98 14" />
          <path
            {...S(p)}
            fill={p.wood}
            d="M48 110 Q56 90 55 68 Q44 54 26 30 L32 25 Q46 42 57 55 Q58 36 55 14 H64 Q65 36 63 54 Q76 40 89 20 L96 25 Q82 50 65 68 Q65 90 72 110 Z"
          />
          <path {...S(p)} fill={p.light} d="M28 112 Q34 102 60 102 Q86 102 92 112 Z" />
        </>
      );
    },
  },
  {
    id: "palm-tree",
    nameAr: "نخلة",
    category: "nature",
    tags: ["نخلة", "نخيل", "تمر", "صحراء", "ثبات"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.wood} d="M48 112 Q56 74 58 36 H68 Q68 76 64 112 Z" />
        <path {...L(p)} d="M52 98 H64 M54 84 H65 M56 70 H66 M57 56 H67" opacity={0.4} />
        <path {...S(p)} fill={p.green} d={frond(63, 34, 60, 0, 90, 8, 12)} />
        <path {...S(p)} fill={p.green} d={frond(63, 34, 34, 8, 14, 30, 14)} />
        <path {...S(p)} fill={p.green} d={frond(63, 34, 106, 12, 112, 66, 20)} />
        <path {...S(p)} fill={p.green} d={frond(63, 34, 20, 18, 12, 70, 20)} />
        <path {...S(p)} fill={p.green} d={frond(63, 34, 92, 24, 96, 56, 14)} />
        <circle {...S(p)} cx={56} cy={44} r={6} fill={p.metal} />
        <circle {...S(p)} cx={66} cy={46} r={6} fill={p.metal} />
        <circle {...S(p)} cx={61} cy={52} r={6} fill={p.metal} />
      </>
    ),
  },

  // ───────── التضاريس والماء والنار ─────────
  {
    id: "mountain",
    nameAr: "جبل",
    category: "nature",
    tags: ["جبل", "رسوخ", "صعوبة", "قمة", "تحدي"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.water} d="M54 104 L82 46 Q86 40 90 46 L114 104 Z" />
        <path {...S(p)} fill={p.green} d="M6 104 L52 18 Q56 12 60 18 L104 104 Z" />
        <path {...S(p)} fill={p.light} d="M41 39 L52 18 Q56 12 60 18 L71 39 L64 46 L56 38 L48 46 Z" />
        <path {...S(p)} fill={p.light} d="M78 54 L82 46 Q86 40 90 46 L94 54 L88 58 L84 54 Z" />
      </>
    ),
  },
  {
    id: "hills",
    nameAr: "تلال",
    category: "nature",
    tags: ["تلال", "مرج", "ريف", "خضرة"],
    draw: (p) => (
      <>
        <circle {...S(p)} cx={88} cy={34} r={14} fill={p.metal} />
        <path {...S(p)} fill={p.water} d="M8 78 Q30 40 64 58 Q88 44 112 64 V100 H8 Z" />
        <path {...S(p)} fill={tint(p, p.green)} d="M8 104 V86 Q40 64 76 82 Q96 74 112 82 V96 Q112 104 104 104 Z" />
      </>
    ),
  },
  {
    id: "desert-dune",
    nameAr: "كثبان رملية",
    category: "nature",
    tags: ["صحراء", "رمل", "كثبان", "عطش", "سفر"],
    draw: (p) => (
      <>
        <circle {...S(p)} cx={86} cy={30} r={16} fill={p.metal} />
        <path {...S(p)} fill={p.second} d="M8 80 Q34 44 62 66 Q78 56 112 70 V96 H8 Z" />
        <path {...S(p)} fill={tint(p, p.metal)} d="M8 104 V90 Q50 62 112 88 V96 Q112 104 104 104 Z" />
        <path {...L(p)} d="M30 94 Q46 84 62 86" opacity={0.3} />
      </>
    ),
  },
  {
    id: "oasis",
    nameAr: "واحة",
    category: "nature",
    tags: ["واحة", "ماء", "صحراء", "نجاة", "راحة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={tint(p, p.metal)} d="M6 104 V84 Q60 66 114 84 V96 Q114 104 106 104 Z" />
        <ellipse {...S(p)} cx={60} cy={92} rx={34} ry={9} fill={p.water} />
        <path {...S(p)} fill={p.wood} d="M30 88 Q36 62 36 36 H44 Q44 62 40 88 Z" />
        <path {...S(p)} fill={p.green} d={frond(40, 34, 42, 10, 66, 16, 12)} />
        <path {...S(p)} fill={p.green} d={frond(40, 34, 38, 10, 14, 16, 12)} />
        <path {...S(p)} fill={p.green} d={frond(40, 34, 66, 18, 74, 52, 14)} />
        <path {...S(p)} fill={p.green} d={frond(40, 34, 14, 18, 6, 52, 14)} />
        <path {...S(p)} fill={p.wood} d="M84 86 Q86 70 86 56 H92 Q92 70 92 86 Z" />
        <path {...S(p)} fill={p.green} d={frond(89, 54, 106, 44, 114, 70, 10)} />
        <path {...S(p)} fill={p.green} d={frond(89, 54, 72, 44, 66, 70, 10)} />
        <path {...S(p)} fill={p.green} d={frond(89, 54, 92, 36, 104, 40, 8)} />
      </>
    ),
  },
  {
    id: "rock",
    nameAr: "صخرة",
    category: "nature",
    tags: ["صخر", "حجر", "قسوة", "ثبات"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.water} d="M14 100 Q8 76 20 56 L40 34 Q50 24 66 28 L88 36 Q104 44 108 66 Q112 88 104 100 Z" />
        <path {...L(p)} d="M40 34 L50 58 L84 54 L88 36 M50 58 L42 100 M84 54 L104 74" opacity={0.3} />
      </>
    ),
  },
  {
    id: "water-drop",
    nameAr: "قطرة ماء",
    category: "nature",
    tags: ["ماء", "قطرة", "حياة", "طهارة", "وضوء"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.water} d="M60 8 Q72 36 88 54 Q100 70 98 82 Q96 112 60 112 Q24 112 22 82 Q20 70 32 54 Q48 36 60 8 Z" />
        <path d="M38 80 Q38 94 52 100" stroke={p.light} strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.75} />
      </>
    ),
  },
  {
    id: "wave",
    nameAr: "موجة",
    category: "nature",
    tags: ["موج", "بحر", "قوة", "فتنة", "اضطراب"],
    draw: (p) => (
      <>
        <path
          {...S(p)}
          fill={p.water}
          d="M8 104 V74 Q16 38 50 22 Q82 10 104 30 Q114 42 106 54 Q98 62 88 56 Q84 46 74 46 Q60 48 58 66 Q58 86 76 92 Q96 96 112 88 V96 Q112 104 104 104 Z"
        />
        <path {...S(p)} fill={p.light} d="M104 30 Q114 42 106 54 Q98 62 88 56 Q90 48 98 46 Q104 40 98 32 Z" />
        <path {...L(p)} stroke={p.style === "line" ? p.line : p.light} d="M22 72 Q28 46 52 34" opacity={0.6} />
      </>
    ),
  },
  {
    id: "river",
    nameAr: "نهر",
    category: "nature",
    tags: ["نهر", "جريان", "ماء", "استمرار"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={8} y={8} width={104} height={104} rx={16} fill={p.green} />
        <path {...S(p)} fill={p.water} d="M54 8 H70 Q76 30 58 44 Q38 60 58 76 Q82 94 78 112 H44 Q48 96 34 84 Q14 64 40 42 Q54 30 54 8 Z" />
        <path {...L(p)} stroke={p.style === "line" ? p.line : p.light} d="M46 56 Q48 50 54 46 M54 92 Q58 86 64 88" opacity={0.6} />
        <circle {...S(p)} cx={92} cy={30} r={9} fill={p.style === "line" ? p.second : p.dark} opacity={p.style === "line" ? 1 : 0.25} />
        <circle {...S(p)} cx={24} cy={100} r={7} fill={p.style === "line" ? p.second : p.dark} opacity={p.style === "line" ? 1 : 0.25} />
      </>
    ),
  },
  {
    id: "campfire",
    nameAr: "نار",
    category: "nature",
    tags: ["نار", "لهب", "دفء", "خطر", "عذاب"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.metal} d="M60 8 Q72 30 86 44 Q100 60 94 78 Q88 94 60 94 Q32 94 26 78 Q20 62 34 48 Q36 60 44 62 Q40 44 50 32 Q56 22 60 8 Z" />
        <path {...S(p)} fill={p.style === "line" ? p.second : p.light} d="M60 44 Q70 58 74 68 Q78 84 60 86 Q42 84 46 70 Q50 60 60 44 Z" />
        <rect {...S(p)} x={14} y={90} width={92} height={14} rx={7} fill={p.wood} transform="rotate(10 60 97)" />
        <rect {...S(p)} x={14} y={90} width={92} height={14} rx={7} fill={p.wood} transform="rotate(-10 60 97)" />
      </>
    ),
  },

  // ───────── كائنات (صور ظلية) ─────────
  {
    id: "bird-flying",
    nameAr: "طائر يحلق",
    category: "nature",
    tags: ["طير", "حرية", "رزق", "توكل", "سماء"],
    note: "صورة ظلية بلا ملامح.",
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.edge} d="M8 58 Q28 34 54 56 Q60 62 66 56 Q90 30 112 50 Q90 48 70 70 Q60 80 50 70 Q32 52 8 58 Z" />
        <path {...S(p)} fill={p.edge} d="M64 96 Q74 84 86 94 Q89 97 92 94 Q102 84 112 92 Q102 92 94 102 Q89 106 84 102 Q76 94 64 96 Z" />
      </>
    ),
  },
  {
    id: "butterfly",
    nameAr: "فراشة",
    category: "nature",
    tags: ["فراشة", "تحول", "جمال", "ربيع"],
    note: "صورة ظلية بلا ملامح.",
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d="M58 56 Q40 10 18 18 Q4 26 14 46 Q24 62 58 60 Z" />
        <path {...S(p)} fill={p.main} d="M62 56 Q80 10 102 18 Q116 26 106 46 Q96 62 62 60 Z" />
        <path {...S(p)} fill={p.second} d="M58 62 Q24 66 22 88 Q24 104 40 100 Q56 94 58 66 Z" />
        <path {...S(p)} fill={p.second} d="M62 62 Q96 66 98 88 Q96 104 80 100 Q64 94 62 66 Z" />
        <circle cx={30} cy={34} r={6} fill={p.light} opacity={0.7} />
        <circle cx={90} cy={34} r={6} fill={p.light} opacity={0.7} />
        <rect {...S(p)} x={55} y={38} width={10} height={58} rx={5} fill={p.edge} />
        <path {...L(p, 3)} stroke={p.edge} d="M58 40 Q52 26 44 22 M62 40 Q68 26 76 22" />
      </>
    ),
  },
];
