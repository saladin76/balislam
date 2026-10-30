import React from "react";
import type { ElementPalette } from "./types";
import { S, tint } from "./helpers";

/**
 * أدوات رسم مشتركة للعناصر المفصّلة (city / possessions / life / islamic-pro).
 * كلها تعتمد على رموز اللوحة فقط.
 */

/** لون خط: حبر في الثيم الخطي، ولون معيّن في المسطح */
export const ln = (p: ElementPalette, flat: string) => (p.style === "line" ? p.line : flat);
/** زجاج/شاشة */
export const glass = (p: ElementPalette) => tint(p, p.water);
/** توهج (نار، ضوء): نعناعي في الخطي، معدني دافئ في المسطح */
export const glow = (p: ElementPalette) => (p.style === "line" ? p.second : p.metal);
/** حدّ رفيع للقطع الصغيرة (2 في الخطي، لا شيء في المسطح) */
export const S2 = (p: ElementPalette) => ({ ...S(p), strokeWidth: p.style === "line" ? 2 : 0 });
/** تظليل داكن شفاف فوق التعبئة */
export const shade = (p: ElementPalette, o = 0.14) => ({ fill: p.dark, opacity: p.style === "line" ? o * 0.6 : o });
/** لمعة فاتحة شفافة */
export const hi = (p: ElementPalette, o = 0.4) => ({ fill: p.style === "line" ? p.second : p.light, opacity: p.style === "line" ? o * 0.9 : o });
/** ظل أرضي بيضاوي */
export const ground = (p: ElementPalette, cx = 60, cy = 110, rx = 46, ry = 4) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={p.shadow} />;

/**
 * «أنبوب»: خط سميك مقروء في الثيمين. في الخطي حبر عريض تحته لون التعبئة،
 * وفي المسطح خط بلون التعبئة فقط. يصلح للحبال والسلاسل والأقواس المعدنية.
 */
export const tube = (p: ElementPalette, d: string, color: string, w = 7, key?: string | number) =>
  p.style === "line" ? (
    <g key={key}>
      <path d={d} fill="none" stroke={p.stroke} strokeWidth={w + 3} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={Math.max(w - 3, 2)} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ) : (
    <path key={key} d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  );

/** نجمة رباعية للبريق */
export const sparkle = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r} Q${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} Q${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} Q${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} Q${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r} Z`;

/** نجمة خماسية/متعددة الرؤوس كنقاط polygon */
export const starPts = (cx: number, cy: number, R: number, r: number, n = 5) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = (Math.PI / n) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? R : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

/** حلقة (دائرة مثقوبة) كمسار evenodd */
export const ringPath = (cx: number, cy: number, R: number, r: number, ry?: number, rry?: number) => {
  const Ry = ry ?? R;
  const iy = rry ?? r;
  return `M${cx - R} ${cy} a${R} ${Ry} 0 1 0 ${2 * R} 0 a${R} ${Ry} 0 1 0 ${-2 * R} 0 Z M${cx - r} ${cy} a${r} ${iy} 0 1 0 ${2 * r} 0 a${r} ${iy} 0 1 0 ${-2 * r} 0 Z`;
};

/** طائر صورة ظلية (بلا ملامح) متمركز عند cx,cy بعرض تقريبي 2s */
export const birdPath = (cx: number, cy: number, s: number) =>
  `M${cx - s} ${cy + s * 0.1} Q${cx - s * 0.5} ${cy - s * 0.55} ${cx - s * 0.1} ${cy} Q${cx} ${cy + s * 0.12} ${cx + s * 0.1} ${cy} Q${cx + s * 0.5} ${cy - s * 0.55} ${cx + s} ${cy + s * 0.1} Q${cx + s * 0.5} ${cy - s * 0.15} ${cx + s * 0.12} ${cy + s * 0.32} Q${cx} ${cy + s * 0.45} ${cx - s * 0.12} ${cy + s * 0.32} Q${cx - s * 0.5} ${cy - s * 0.15} ${cx - s} ${cy + s * 0.1} Z`;

/** موج ماء أسفل المشهد بين y و 112 */
export const water = (p: ElementPalette, y: number) => (
  <path
    {...S(p)}
    fill={tint(p, p.water)}
    d={`M4 ${y} Q13 ${y - 5} 22 ${y} T40 ${y} T58 ${y} T76 ${y} T94 ${y} T112 ${y} Q115 ${y + 1} 116 ${y + 2} V108 Q116 112 112 112 H8 Q4 112 4 108 Z`}
  />
);
