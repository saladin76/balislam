import React from "react";
import type { ElementDef } from "../types";
import { L, S, tint } from "../helpers";
import { S2, glass, glow, ground, hi, shade, starPts } from "../kit";

/**
 * رموز إسلامية مفصّلة (تكمل islamic.tsx). بلا نص قرآني، والمصحف مغلق دائمًا.
 */

/** هلال صغير مفتوح يمينًا */
const crescent = (cx: number, cy: number, r: number) => {
  const ax = cx + r * 0.5;
  const dy = r * 0.866;
  return `M${ax} ${cy - dy} A${r} ${r} 0 1 0 ${ax} ${cy + dy} A${r * 0.92} ${r * 0.92} 0 1 1 ${ax} ${cy - dy} Z`;
};

export const elements: ElementDef[] = [
  {
    id: "prayer-mat-ornate",
    nameAr: "سجادة صلاة مزخرفة",
    category: "islamic",
    tags: ["سجادة", "صلاة", "سجود", "خشوع", "محراب", "prayer mat"],
    draw: (p) => (
      <>
        <path {...L(p, 2)} stroke={p.edge} d={Array.from({ length: 9 }, (_, i) => `M${30 + i * 7.5} 10 V4 M${30 + i * 7.5} 110 V116`).join(" ")} />
        <rect {...S(p)} x={24} y={10} width={72} height={100} rx={3} fill={p.main} />
        <rect {...S(p)} x={29} y={15} width={62} height={90} rx={2} fill={p.second} />
        {Array.from({ length: 8 }, (_, i) => (
          <path key={`l${i}`} fill={p.style === "line" ? p.light : p.light} opacity={0.75} d={`M32 ${22 + i * 11} l-2.5 4 l2.5 4 l2.5 -4 Z M88 ${22 + i * 11} l-2.5 4 l2.5 4 l2.5 -4 Z`} />
        ))}
        <rect {...S(p)} x={35} y={21} width={50} height={78} rx={1} fill={p.main} />
        <path {...S(p)} fill={p.accent} d="M40 94 V54 Q40 38 60 28 Q80 38 80 54 V94 Z" />
        <path {...L(p, 1.6)} stroke={p.style === "line" ? p.light : p.light} opacity={0.5} d="M44 92 V55 Q44 42 60 33 Q76 42 76 55 V92" />
        <path {...L(p, 1.5)} stroke={p.style === "line" ? p.light : p.edge} d="M60 36 V46" opacity={0.8} />
        <path {...S2(p)} fill={glow(p)} d="M55 46 H65 L63 56 Q60 59 57 56 Z" />
        <path {...S2(p)} fill={p.light} opacity={p.style === "line" ? 1 : 0.4} d="M42 94 L48 86 L54 94 L60 86 L66 94 L72 86 L78 94 Z" />
        <path {...S2(p)} fill={p.second} d="M40 23 L44 28 L40 33 L36 28 Z M80 23 L84 28 L80 33 L76 28 Z" />
        <path {...shade(p, 0.1)} d="M85 21 V99 H80 V21 Z" />
      </>
    ),
  },
  {
    id: "tasbih-33",
    nameAr: "مسبحة مفصلة",
    category: "islamic",
    tags: ["مسبحة", "تسبيح", "ذكر", "أذكار", "سبحة", "tasbih"],
    draw: (p) => {
      const beads = Array.from({ length: 34 }, (_, i) => {
        const t = (i / 34) * Math.PI * 2;
        return { i, x: 60 + 40 * Math.sin(t), y: 46 - 34 * Math.cos(t) };
      }).filter((b) => b.i !== 17);
      return (
        <>
          <ellipse cx={60} cy={46} rx={40} ry={34} fill="none" stroke={p.edge} strokeWidth={1.5} opacity={0.6} />
          {beads.map((b) => {
            const sep = b.i === 6 || b.i === 28;
            return (
              <g key={b.i}>
                <circle {...S2(p)} cx={b.x} cy={b.y} r={sep ? 5.6 : 4.8} fill={sep ? p.metal : p.main} />
                <circle cx={b.x - 1.4} cy={b.y - 1.4} r={1.3} fill={p.light} opacity={p.style === "line" ? 0 : 0.6} />
              </g>
            );
          })}
          <path {...L(p, 2)} stroke={p.edge} d="M54 79 L58 84 M66 79 L62 84" />
          <circle {...S(p)} cx={60} cy={86} r={4.5} fill={p.metal} />
          <path {...S(p)} fill={p.metal} d="M55 92 Q55 89 60 89 Q65 89 65 92 V100 Q65 103 60 103 Q55 103 55 100 Z" />
          <path {...hi(p, 0.5)} d="M57 92 H59 V100 H57 Z" />
          <rect {...S2(p)} x={56} y={103} width={8} height={3} rx={1} fill={p.metal} />
          <path {...L(p, 2)} stroke={p.style === "line" ? p.line : p.accent} d="M58 106 L52 116 M59 106 L56 116 M60 106 V117 M61 106 L64 116 M62 106 L68 116" />
        </>
      );
    },
  },
  {
    id: "minaret-ottoman",
    nameAr: "مئذنة رشيقة",
    category: "islamic",
    tags: ["مئذنة", "أذان", "مسجد", "صلاة", "عمارة إسلامية", "minaret"],
    draw: (p) => (
      <>
        <path {...S2(p)} fill={p.metal} d={crescent(60, 7, 5)} />
        <path {...L(p, 2.5)} stroke={p.edge} d="M60 13 V20" />
        <circle {...S2(p)} cx={60} cy={20} r={3} fill={p.metal} />
        <path {...S(p)} fill={p.main} d="M47 42 L60 20 L73 42 Z" />
        <path {...shade(p, 0.15)} d="M60 20 L73 42 H60 Z" />
        <rect {...S(p)} x={47} y={42} width={26} height={52} fill={p.light} />
        <path {...shade(p, 0.1)} d="M64 42 H73 V94 H64 Z" />
        {[46, 70].map((y) => (
          <g key={y}>
            <path {...S(p)} fill={p.second} d={`M40 ${y + 6} Q45 ${y + 13} 50 ${y + 6} Q55 ${y + 13} 60 ${y + 6} Q65 ${y + 13} 70 ${y + 6} Q75 ${y + 13} 80 ${y + 6} Z`} />
            <rect {...S(p)} x={38} y={y} width={44} height={7} rx={1} fill={p.main} />
            <path {...L(p, 2)} stroke={p.edge} d={`M40 ${y} V${y - 6} H80 V${y} M48 ${y} V${y - 6} M56 ${y} V${y - 6} M64 ${y} V${y - 6} M72 ${y} V${y - 6}`} />
          </g>
        ))}
        <path {...S2(p)} fill={glass(p)} d="M56 66 V60 Q60 54 64 60 V66 Z M56 90 V84 Q60 78 64 84 V90 Z" />
        <rect {...S(p)} x={36} y={92} width={48} height={18} fill={p.main} />
        <path {...shade(p, 0.12)} d="M72 92 H84 V110 H72 Z" />
        <path {...S(p)} fill={p.wood} d="M53 110 V101 Q60 94 67 101 V110 Z" />
        <path {...L(p, 3)} stroke={p.edge} d="M24 110 H96" />
      </>
    ),
  },
  {
    id: "zakat-jar",
    nameAr: "جرة الزكاة",
    category: "islamic",
    tags: ["زكاة", "صدقة", "إنفاق", "مال", "بركة", "zakat"],
    draw: (p) => (
      <>
        {ground(p, 60, 110, 40, 3)}
        <ellipse {...S2(p)} cx={60} cy={10} rx={7} ry={3.5} fill={p.metal} transform="rotate(-25 60 10)" />
        <path {...L(p, 2)} stroke={p.edge} d="M52 6 V12 M68 4 V9" opacity={0.6} />
        <ellipse {...S2(p)} cx={48} cy={31} rx={9} ry={3.5} fill={p.metal} />
        <ellipse {...S2(p)} cx={70} cy={31} rx={9} ry={3.5} fill={p.metal} />
        <ellipse {...S2(p)} cx={59} cy={27} rx={9} ry={3.5} fill={p.metal} />
        <path {...S(p)} fill={p.wood} d="M36 40 H84 V48 Q100 58 100 80 Q100 108 60 108 Q20 108 20 80 Q20 58 36 48 Z" />
        <path {...shade(p, 0.15)} d="M76 48 Q100 58 100 80 Q100 108 60 108 Q90 98 88 76 Q86 60 76 48 Z" />
        <path {...hi(p, 0.4)} d="M30 66 Q34 56 42 54 Q34 64 34 78 Z" />
        <path {...S(p)} fill={p.second} d="M22 70 H98 Q99 74 99 78 H21 Q21 74 22 70 Z" />
        <path {...L(p, 1.6)} stroke={p.style === "line" ? p.line : p.light} opacity={0.6} d="M26 74 L30 71 L34 74 L38 71 L42 74 L46 71 L50 74 L54 71 L58 74 L62 71 L66 74 L70 71 L74 74 L78 71 L82 74 L86 71 L90 74 L94 71" />
        <path {...S2(p)} fill={p.metal} d={crescent(54, 92, 9)} />
        <polygon {...S2(p)} fill={p.metal} points={starPts(68, 88, 4.5, 2)} />
        <rect {...S(p)} x={32} y={34} width={56} height={8} rx={3} fill={tint(p, p.wood)} />
      </>
    ),
  },
];
