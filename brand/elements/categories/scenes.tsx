import React from "react";
import type { ElementDef } from "../types";
import { L, S, tint } from "../helpers";
import { ground, hi, shade } from "../kit";

/**
 * عناصر المشاهد والأمثال: ما يُبنى منه «مسرح المحاكاة» (رفوف عطور، حظيرة غنم، كير حداد…).
 * الحيوانات بلا ملامح وجه: كتلة الجسم والرأس فقط.
 */
export const elements: ElementDef[] = [
  {
    id: "perfume-bottle",
    nameAr: "قارورة عطر",
    category: "daily",
    tags: ["عطر", "مسك", "رائحة طيبة", "الجليس الصالح", "حامل المسك", "perfume"],
    draw: (p) => (
      <>
        {ground(p, 60, 112, 30, 3)}
        <rect {...S(p)} x={50} y={14} width={20} height={12} rx={3} fill={p.metal} />
        <rect {...S(p)} x={54} y={26} width={12} height={10} fill={tint(p, p.light)} />
        <path {...S(p)} fill={p.metal} d="M34 46 Q34 36 46 36 H74 Q86 36 86 46 V100 Q86 110 76 110 H44 Q34 110 34 100 Z" />
        <path {...shade(p, 0.18)} d="M70 40 H74 Q82 40 82 48 V100 Q82 106 76 106 H70 Z" />
        <rect {...hi(p, 0.45)} x={41} y={44} width={6} height={52} rx={3} />
        <rect {...S(p)} x={44} y={62} width={32} height={22} rx={4} fill={tint(p, p.light)} />
        <path {...L(p, 2)} d="M50 70 H70 M53 76 H67" opacity={0.5} />
      </>
    ),
  },
  {
    id: "perfume-shelf",
    nameAr: "رف عطور",
    category: "daily",
    tags: ["عطور", "محل عطور", "مسك", "رف", "الجليس الصالح", "perfume shop"],
    draw: (p) => (
      <>
        {[46, 98].map((y) => (
          <g key={y}>
            <rect {...S(p)} x={4} y={y} width={112} height={7} rx={2} fill={p.wood} />
            {[16, 38, 60, 82, 104].map((x, i) => {
              const h = i % 2 ? 26 : 32;
              return (
                <g key={x}>
                  <rect {...S(p)} x={x - 3} y={y - h - 6} width={6} height={6} fill={p.metal} />
                  <rect {...S(p)} x={x - 8} y={y - h} width={16} height={h} rx={4} fill={p.metal} />
                  <rect {...hi(p, 0.4)} x={x - 5} y={y - h + 4} width={3} height={h - 8} rx={1.5} />
                </g>
              );
            })}
          </g>
        ))}
      </>
    ),
  },
  {
    id: "sheep",
    nameAr: "خروف",
    category: "nature",
    tags: ["خروف", "غنم", "ماشية", "زريبة", "رعي", "sheep"],
    draw: (p) => (
      <>
        {ground(p, 60, 104, 40, 4)}
        <path {...L(p, 6)} stroke={p.dark} d="M42 84 V102 M54 86 V103 M70 86 V103 M82 84 V102" />
        <path
          {...S(p)}
          fill={tint(p, p.light)}
          d="M30 66 Q22 52 36 46 Q40 32 56 36 Q66 26 78 36 Q94 34 94 50 Q104 58 96 70 Q98 86 80 86 Q70 94 58 88 Q42 94 36 84 Q22 80 30 66 Z"
        />
        <path {...hi(p, 0.5)} d="M44 48 Q52 42 60 46 Q54 50 46 52 Z" />
        <ellipse {...S(p)} cx={26} cy={58} rx={11} ry={13} fill={p.dark} />
        <ellipse {...S(p)} cx={18} cy={52} rx={6} ry={3.5} fill={p.dark} transform="rotate(-25 18 52)" />
      </>
    ),
  },
  {
    id: "fence-wood",
    nameAr: "سياج خشبي",
    category: "nature",
    tags: ["سياج", "حظيرة", "زريبة", "مزرعة", "حدود", "fence"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={4} y={50} width={112} height={8} rx={2} fill={p.wood} />
        <rect {...S(p)} x={4} y={76} width={112} height={8} rx={2} fill={p.wood} />
        {[12, 40, 68, 96].map((x) => (
          <path key={x} {...S(p)} fill={p.wood} d={`M${x} 104 V44 L${x + 6} 36 L${x + 12} 44 V104 Z`} />
        ))}
        <path {...L(p, 1.6)} d="M10 54 H110 M10 80 H110" opacity={0.3} />
      </>
    ),
  },
  {
    id: "forge-bellows",
    nameAr: "كير الحداد",
    category: "daily",
    tags: ["كير", "حداد", "نافخ الكير", "نار", "دخان", "الجليس السوء", "forge"],
    draw: (p) => (
      <>
        {ground(p, 60, 112, 48, 4)}
        <path {...S(p)} fill={p.dark} d="M18 84 H102 L94 110 H26 Z" />
        <path {...S(p)} fill={p.accent} d="M40 84 Q36 66 48 58 Q46 70 56 72 Q54 56 66 48 Q66 64 74 66 Q80 72 78 84 Z" />
        <path {...hi(p, 0.5)} d="M52 82 Q50 72 58 68 Q60 76 66 78 Q66 82 64 84 Z" />
        <path {...L(p, 3)} stroke={p.edge} d="M58 44 Q50 34 58 26 Q66 18 58 8 M76 46 Q70 38 76 30" opacity={0.45} />
        <path {...S(p)} fill={p.wood} d="M98 64 L116 56 V80 L98 74 Z" />
        <path {...S(p)} fill={tint(p, p.light)} d="M84 60 Q92 52 100 60 V78 Q92 86 84 78 Z" />
        <path {...L(p, 2)} d="M86 66 H98 M86 72 H98" opacity={0.4} />
        <path {...L(p, 4)} stroke={p.edge} d="M84 70 H78" />
      </>
    ),
  },
];
