/**
 * أدوات المقارنة البصرية: كفة ميزان، وحدّ يحيط بعلامة نهي/منع، وختم حكم يُضرب على الورق.
 */

import React from "react";
import { C, Ink, easeOut, mix, prog, rng } from "../horizon/kit";
import { SText } from "../horizon/book";
import { CLAY, EMBER_DEEP } from "./drawings";
import { Word } from "./text";


export const Pan: React.FC<{ x: number; y: number; label: string; color: string; q: number }> = ({ x, y, label, color, q }) => (
  <g>
    <path d={`M${x} ${y} L${x - 120} ${y + 150} M${x} ${y} L${x + 120} ${y + 150}`} stroke={C.ink} strokeWidth={2.5} />
    <path d={`M${x - 140} ${y + 150} C${x - 110} ${y + 210} ${x + 110} ${y + 210} ${x + 140} ${y + 150} Z`} fill={C.page} stroke={C.ink} strokeWidth={4} />
    <ellipse cx={x} cy={y + 164} rx={92 * q} ry={18 * q} fill={color} opacity={0.85} />
    <SText x={x} y={y + 128} size={52} o={q} color={color === C.ember ? "#B4512A" : CLAY}>
      {label}
    </SText>
  </g>
);

export const ring = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx} ${cy - ry} C${cx + rx * 0.56} ${cy - ry} ${cx + rx} ${cy - ry * 0.55} ${cx + rx} ${cy} C${cx + rx} ${cy + ry * 0.56} ${cx + rx * 0.55} ${cy + ry} ${cx} ${cy + ry} C${cx - rx * 0.56} ${cy + ry} ${cx - rx} ${cy + ry * 0.55} ${cx - rx} ${cy} C${cx - rx} ${cy - ry * 0.56} ${cx - rx * 0.55} ${cy - ry} ${cx - 4} ${cy - ry}`;

/** علامة منع (✗ في دائرة) يحيط بها حدّ متقطع؛ breach يفتح ثغرة في الحد؛ labelText تسمية تحتها */
export const BoundaryMark: React.FC<{ labelText?: string; x: number; y: number; mark: number; bound: number; breach?: number; label?: number }> = ({ x, y, mark, bound, breach = 0, label = 0, labelText = "" }) => (
  <g>
    <circle cx={x} cy={y} r={70 * mark} fill={C.page} stroke={breach > 0 ? EMBER_DEEP : C.ink} strokeWidth={5} />
    <Ink d={`M${x - 34} ${y - 34} L${x + 34} ${y + 34} M${x + 34} ${y - 34} L${x - 34} ${y + 34}`} w={8} p={prog(mark, 0.4, 1)} c={breach > 0 ? EMBER_DEEP : C.ribbon} />
    <path d={ring(x, y, 190, 190)} fill="none" stroke={C.ink} strokeWidth={4} strokeDasharray="14 14" pathLength={1000} strokeDashoffset={0} opacity={bound * (1 - 0.0 * breach)} style={{ strokeDasharray: `${14 * bound} 14` }} />
    {breach > 0 ? <path d={`M${x + 120} ${y - 150} C${x + 160} ${y - 110} ${x + 180} ${y - 80} ${x + 190} ${y - 30}`} stroke={C.page} strokeWidth={14 * breach} fill="none" /> : null}
    <Word x={x} y={y + 260} size={44} p={label} font="tajawal" weight={700} color={C.inkText}>
      {labelText}
    </Word>
  </g>
);

export const Stamp: React.FC<{ x: number; y: number; q: number; label: string; color: string; filled?: boolean; w?: number }> = ({ x, y, q, label, color, filled, w = 260 }) => {
  if (q <= 0) return null;
  const sc = 1 + 0.6 * (1 - q);
  const ring = prog(q, 0.6, 1);
  return (
    <g opacity={Math.min(1, q * 2)} transform={`translate(${x} ${y}) rotate(${-6 + 6 * q}) scale(${sc})`}>
      <rect x={-w / 2 - 22 * ring} y={-60 - 22 * ring} width={w + 44 * ring} height={120 + 44 * ring} rx={16} fill="none" stroke={color} strokeWidth={3} opacity={0.5 * (1 - ring)} />
      <rect x={-w / 2} y={-60} width={w} height={120} rx={12} fill={filled ? color : C.page} stroke={color} strokeWidth={7} />
      <SText x={0} y={20} size={58} font="tajawal" weight={800} color={filled ? C.page : color}>
        {label}
      </SText>
    </g>
  );
};
