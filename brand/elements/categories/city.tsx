import React from "react";
import type { ElementDef, ElementPalette } from "../types";
import { L, S, tint } from "../helpers";
import { S2, birdPath, glass, glow, ground, hi, ln, shade, tube, water } from "../kit";

/**
 * المدينة والسفر: وسائل نقل ومبانٍ وأماكن، لقصص الأمنيات والطموح والمقارنة.
 * المركبات تتجه يمينًا مثل «car» في daily، وكل النوافذ كتل مجردة.
 */

/** شبكة نوافذ: بعضها مضاء بلون التمييز */
const windows = (p: ElementPalette, x0: number, y0: number, cols: number, rows: number, w: number, h: number, gx: number, gy: number, lit: number[] = []) =>
  Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const i = r * cols + c;
      return <rect key={i} {...S2(p)} x={x0 + c * gx} y={y0 + r * gy} width={w} height={h} rx={1} fill={lit.includes(i) ? glow(p) : glass(p)} />;
    }),
  );

const wheel = (p: ElementPalette, cx: number, cy: number, r: number, key?: string) => (
  <g key={key}>
    <circle {...S(p)} cx={cx} cy={cy} r={r} fill={p.dark} />
    <circle {...S2(p)} cx={cx} cy={cy} r={r * 0.58} fill={p.metal} />
    <path {...L(p, 2)} stroke={p.style === "line" ? p.line : p.dark} opacity={0.5} d={`M${cx - r * 0.5} ${cy} H${cx + r * 0.5} M${cx} ${cy - r * 0.5} V${cy + r * 0.5}`} />
    <circle cx={cx} cy={cy} r={r * 0.2} fill={p.style === "line" ? p.line : p.light} />
  </g>
);

export const elements: ElementDef[] = [
  {
    id: "helicopter",
    nameAr: "مروحية",
    category: "city",
    tags: ["مروحية", "هليكوبتر", "طيران", "ثراء", "سفر", "helicopter"],
    draw: (p) => (
      <>
        {ground(p, 52, 112, 36, 3)}
        <path {...S(p)} fill={p.main} d="M74 46 L104 40 L106 48 L74 60 Z" />
        <path {...S(p)} fill={p.second} d="M98 28 H106 L110 50 L102 50 Z" />
        <circle {...S(p)} cx={104} cy={44} r={7} fill="none" strokeDasharray="3 4" stroke={p.edge} strokeWidth={2.5} />
        <circle cx={104} cy={44} r={2.5} fill={p.edge} />
        <path {...L(p, 4)} stroke={p.edge} d="M32 74 L28 86 M66 74 L70 86 M14 86 H80 Q88 86 90 80" />
        <path {...S(p)} fill={p.main} d="M16 62 Q16 36 44 34 H62 Q82 34 84 54 Q84 74 64 76 H32 Q16 76 16 62 Z" />
        <path {...shade(p, 0.16)} d="M16 62 Q18 76 32 76 H64 Q82 74 84 58 Q76 68 60 68 H30 Q20 68 16 62 Z" />
        <path {...S(p)} fill={glass(p)} d="M19 58 Q20 41 42 38 H50 V58 Z" />
        <path {...hi(p, 0.5)} d="M24 50 Q28 43 38 41 L34 48 Q28 50 26 54 Z" />
        <rect {...S(p)} x={55} y={40} width={16} height={13} rx={3} fill={glass(p)} />
        <path d="M24 64 H80" stroke={p.second} strokeWidth={4} strokeLinecap="round" />
        <rect {...S(p)} x={46} y={24} width={10} height={11} rx={2} fill={p.dark} />
        <rect {...S(p)} x={6} y={19} width={92} height={5} rx={2.5} fill={p.edge} />
        <circle {...S(p)} cx={51} cy={21.5} r={5} fill={p.metal} />
      </>
    ),
  },
  {
    id: "private-jet",
    nameAr: "طائرة خاصة",
    category: "city",
    tags: ["طائرة خاصة", "ثراء", "رفاهية", "سفر", "أمنيات", "private jet"],
    draw: (p) => (
      <>
        {ground(p, 60, 110, 44, 3)}
        <path {...S(p)} fill={p.second} d="M88 52 L100 26 H112 L108 52 Z" />
        <path {...S(p)} fill={p.second} d="M100 28 L116 24 L114 30 L102 32 Z" />
        <path {...S(p)} fill={p.main} d="M114 58 Q112 66 98 68 H26 Q10 68 6 62 Q8 52 28 50 H96 Q110 50 114 58 Z" />
        <path {...shade(p, 0.15)} d="M6 62 Q10 68 26 68 H98 Q112 66 114 58 Q104 63 90 63 H22 Q12 63 6 62 Z" />
        <path {...S(p)} fill={glass(p)} d="M10 58 Q14 52 24 52 L22 58 Z" />
        {[34, 43, 52, 61, 70, 79].map((x) => (
          <rect key={x} {...S2(p)} x={x} y={54} width={5} height={5} rx={2.5} fill={glass(p)} />
        ))}
        <path d="M16 63 H104" stroke={p.accent} strokeWidth={2.5} strokeLinecap="round" opacity={0.9} />
        <rect {...S(p)} x={74} y={40} width={26} height={10} rx={5} fill={p.metal} />
        <path {...L(p, 2)} d="M96 41 V49" opacity={0.5} />
        <path {...S(p)} fill={p.second} d="M44 64 H72 L56 84 H44 Z" />
        <path {...L(p, 2)} d="M50 68 L48 80" opacity={0.4} />
        <path {...hi(p, 0.45)} d="M30 52 H92 Q90 54 86 54 H32 Z" />
      </>
    ),
  },
  {
    id: "airplane",
    nameAr: "طائرة ركاب",
    category: "city",
    tags: ["طائرة", "سفر", "رحلة", "هجرة", "غربة", "airplane"],
    draw: (p) => (
      <g transform="rotate(40 60 60)">
        <path {...S(p)} fill={p.second} d="M54 46 L8 70 V78 L54 66 Z" />
        <path {...S(p)} fill={p.second} d="M66 46 L112 70 V78 L66 66 Z" />
        <rect {...S(p)} x={27} y={58} width={9} height={15} rx={4.5} fill={p.metal} />
        <rect {...S(p)} x={84} y={58} width={9} height={15} rx={4.5} fill={p.metal} />
        <path {...S(p)} fill={p.second} d="M56 94 L40 106 V110 L56 104 Z" />
        <path {...S(p)} fill={p.second} d="M64 94 L80 106 V110 L64 104 Z" />
        <path {...S(p)} fill={p.main} d="M60 6 Q67 6 67 22 V90 Q67 102 60 112 Q53 102 53 90 V22 Q53 6 60 6 Z" />
        <path {...shade(p, 0.14)} d="M60 6 Q67 6 67 22 V90 Q67 102 60 112 Z" />
        <path {...S2(p)} fill={glass(p)} d="M56 17 Q60 11 64 17 L63 20 H57 Z" />
        <path {...L(p, 2)} d="M60 28 V88" opacity={0.3} />
      </g>
    ),
  },
  {
    id: "yacht",
    nameAr: "يخت",
    category: "city",
    tags: ["يخت", "ثراء", "بحر", "رفاهية", "مقارنة", "yacht"],
    draw: (p) => (
      <>
        {water(p, 96)}
        <path {...L(p, 3)} stroke={p.edge} d="M74 44 V32 L80 26" />
        <path {...S2(p)} fill={p.light} d="M62 44 Q62 36 68 36 Q74 36 74 44 Z" />
        <path {...S(p)} fill={p.main} d="M4 72 H114 L106 96 H30 Q12 92 4 72 Z" />
        <path {...shade(p, 0.18)} d="M10 84 H110 L106 96 H30 Q16 93 10 84 Z" />
        <path d="M10 80 H111" stroke={p.second} strokeWidth={4} strokeLinecap="round" />
        {[40, 52, 64, 76, 88].map((x) => (
          <circle key={x} {...S2(p)} cx={x} cy={88} r={2.2} fill={glass(p)} />
        ))}
        <path {...S(p)} fill={p.light} d="M26 72 L38 56 H96 L102 72 Z" />
        <path {...S2(p)} fill={glass(p)} d="M42 60 H94 L96 67 H38 Z" />
        <path {...S(p)} fill={p.main} d="M46 56 L54 44 H84 L88 56 Z" />
        <path {...S2(p)} fill={glass(p)} d="M56 47 H82 L84 53 H53 Z" />
        <path {...hi(p, 0.5)} d="M44 61 H60 L58 66 H41 Z" />
      </>
    ),
  },
  {
    id: "sailboat",
    nameAr: "قارب شراعي",
    category: "city",
    tags: ["قارب", "شراع", "بحر", "رحلة", "صبر", "توكل", "sailboat"],
    draw: (p) => (
      <>
        {water(p, 98)}
        <path {...S(p)} fill={p.accent} d="M60 8 L74 12 L60 16 Z" />
        <path {...L(p, 4)} stroke={p.edge} d="M60 10 V84" />
        <path {...S(p)} fill={p.light} d="M64 16 Q88 44 102 78 H64 Z" />
        <path {...shade(p, 0.1)} d="M64 16 Q76 34 82 50 Q76 66 64 78 Z" />
        <path {...L(p, 2)} d="M64 38 H82 M64 58 H94" opacity={0.35} />
        <path {...S(p)} fill={p.second} d="M56 22 Q44 52 20 78 H56 Z" />
        <path {...L(p, 2)} d="M56 44 H40 M56 62 H30" opacity={0.35} />
        <path {...S(p)} fill={p.wood} d="M12 82 H108 Q102 98 86 100 H32 Q16 96 12 82 Z" />
        <path d="M18 89 H102" stroke={p.style === "line" ? p.second : p.dark} strokeWidth={3.5} strokeLinecap="round" opacity={p.style === "line" ? 1 : 0.35} />
      </>
    ),
  },
  {
    id: "motorbike",
    nameAr: "دراجة نارية",
    category: "city",
    tags: ["دراجة نارية", "موتوسيكل", "سرعة", "شباب", "motorbike"],
    draw: (p) => (
      <>
        {ground(p, 60, 104, 50, 3)}
        <path {...L(p, 5)} stroke={p.edge} d="M24 86 L52 72" />
        <path {...L(p, 5)} stroke={p.edge} d="M84 44 L96 86" />
        {wheel(p, 24, 86, 16)}
        {wheel(p, 96, 86, 16)}
        <path {...L(p, 4)} stroke={p.edge} d="M82 72 Q96 62 110 74" />
        <rect {...S(p)} x={44} y={64} width={28} height={18} rx={4} fill={p.metal} />
        <path {...L(p, 2)} d="M50 68 V78 M56 68 V78 M62 68 V78" opacity={0.45} />
        <rect {...S(p)} x={40} y={82} width={44} height={6} rx={3} fill={p.metal} />
        <path {...S(p)} fill={p.main} d="M38 62 Q44 48 62 48 H74 Q82 48 82 56 L74 66 H44 Z" />
        <path {...hi(p, 0.5)} d="M48 54 Q54 51 64 51 L62 55 H50 Z" />
        <path {...S(p)} fill={p.dark} d="M16 56 Q18 50 30 52 H46 L42 60 H18 Z" />
        <path {...L(p, 5)} stroke={p.edge} d="M78 40 L90 42" />
        <circle {...S(p)} cx={92} cy={54} r={6} fill={glow(p)} />
        <path {...S(p)} fill={p.second} d="M12 56 H20 L22 62 H14 Z" />
      </>
    ),
  },
  {
    id: "sports-car",
    nameAr: "سيارة رياضية",
    category: "city",
    tags: ["سيارة رياضية", "فخامة", "سرعة", "تفاخر", "حسد", "sports car"],
    draw: (p) => (
      <>
        {ground(p, 60, 100, 54, 4)}
        <rect {...S(p)} x={4} y={58} width={20} height={5} rx={2.5} fill={p.dark} />
        <path {...L(p, 3)} stroke={p.edge} d="M12 63 V68" />
        <path {...S(p)} fill={p.main} d="M6 82 Q6 70 16 68 L40 62 Q52 48 70 48 Q84 48 94 60 L110 64 Q116 66 116 74 V82 Q116 88 110 88 H12 Q6 88 6 82 Z" />
        <path {...S(p)} fill={glass(p)} d="M47 62 Q55 53 67 52 V62 Z" />
        <path {...S(p)} fill={glass(p)} d="M71 52 Q81 53 88 62 H71 Z" />
        <path {...hi(p, 0.5)} d="M52 60 Q56 56 62 55 L60 60 Z" />
        <path d="M14 74 H104" stroke={p.second} strokeWidth={4} strokeLinecap="round" />
        <path {...shade(p, 0.3)} d="M76 76 Q86 72 98 77 Q86 80 76 76 Z" />
        <path {...S2(p)} fill={glow(p)} d="M106 67 L115 70 V74 L107 72 Z" />
        <path {...shade(p, 0.16)} d="M6 82 V80 H116 V82 Q116 88 110 88 H12 Q6 88 6 82 Z" />
        {wheel(p, 30, 86, 12)}
        {wheel(p, 92, 86, 12)}
      </>
    ),
  },
  {
    id: "train",
    nameAr: "قطار",
    category: "city",
    tags: ["قطار", "سفر", "محطة", "رحلة", "مواعيد", "train"],
    draw: (p) => (
      <>
        <path {...L(p, 3)} stroke={p.edge} d="M36 112 L48 104 M84 112 L72 104 M30 110 H90" />
        <path {...S(p)} fill={p.main} d="M26 96 V42 Q26 12 60 12 Q94 12 94 42 V96 Q94 102 88 102 H32 Q26 102 26 96 Z" />
        <path {...shade(p, 0.12)} d="M76 15 Q94 22 94 42 V96 Q94 102 88 102 H78 Q84 70 76 15 Z" />
        <path {...S(p)} fill={glass(p)} d="M34 30 Q36 20 60 20 Q84 20 86 30 V52 H34 Z" />
        <path {...hi(p, 0.45)} d="M40 48 L52 23 H60 L48 48 Z" />
        <path {...L(p, 2.5)} d="M60 21 V52" opacity={0.6} />
        <rect {...S(p)} x={26} y={58} width={68} height={8} fill={p.second} />
        <circle {...S(p)} cx={40} cy={80} r={7} fill={glow(p)} />
        <circle {...S(p)} cx={80} cy={80} r={7} fill={glow(p)} />
        <circle cx={40} cy={80} r={2.5} fill={p.light} />
        <circle cx={80} cy={80} r={2.5} fill={p.light} />
        <rect {...S(p)} x={51} y={72} width={18} height={16} rx={3} fill={p.dark} />
        <path {...L(p, 2)} stroke={p.style === "line" ? p.light : p.light} opacity={0.5} d="M55 77 H65 M55 82 H65" />
        <rect {...S(p)} x={22} y={96} width={76} height={8} rx={3} fill={p.dark} />
        <rect {...S2(p)} x={54} y={14} width={12} height={4} rx={2} fill={glow(p)} />
      </>
    ),
  },
  {
    id: "skyscraper",
    nameAr: "ناطحة سحاب",
    category: "city",
    tags: ["ناطحة سحاب", "برج", "مدينة", "طموح", "تطاول في البنيان", "skyscraper"],
    draw: (p) => (
      <>
        <path {...L(p, 3)} stroke={p.edge} d="M50 20 V4" />
        <path {...S(p)} fill={p.second} d="M70 32 L86 26 V112 H70 Z" />
        <path {...L(p, 2)} d="M74 40 L82 37 M74 52 L82 49 M74 64 L82 61 M74 76 L82 73 M74 88 L82 85 M74 100 L82 97" opacity={0.4} />
        <path {...S(p)} fill={p.main} d="M38 32 V20 H62 V32 Z" />
        <path {...S(p)} fill={p.second} d="M62 32 V20 L70 17 V32 Z" />
        <path {...S(p)} fill={p.light} d="M38 20 L46 17 H70 L62 20 Z" />
        <path {...S(p)} fill={p.main} d="M30 112 V32 H70 V112 Z" />
        <path {...S(p)} fill={p.light} d="M30 32 L46 26 H86 L70 32 Z" />
        {windows(p, 35, 38, 3, 8, 7, 5, 11, 9, [4, 9, 13, 20])}
        <path {...hi(p, 0.3)} d="M30 32 H36 V112 H30 Z" />
        <path {...L(p, 3)} stroke={p.edge} d="M14 112 H106" />
      </>
    ),
  },
  {
    id: "apartment-block",
    nameAr: "عمارة سكنية",
    category: "city",
    tags: ["عمارة", "شقة", "سكن", "جيران", "إيجار", "apartment"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={30} y={8} width={10} height={10} fill={p.dark} />
        <rect {...S(p)} x={78} y={10} width={14} height={8} rx={2} fill={p.metal} />
        <rect {...S(p)} x={20} y={22} width={80} height={88} fill={p.light} />
        <path {...shade(p, 0.1)} d="M86 22 H100 V110 H86 Z" />
        <rect {...S(p)} x={16} y={16} width={88} height={8} rx={2} fill={p.main} />
        {[0, 1, 2, 3, 4].map((r) =>
          [0, 1, 2, 3].map((c) => {
            const x = 27 + c * 18;
            const y = 30 + r * 15;
            if (r === 4 && (c === 1 || c === 2)) return null;
            const lit = (r + c * 2) % 5 === 1;
            return (
              <g key={`${r}-${c}`}>
                <rect {...S2(p)} x={x} y={y} width={12} height={9} rx={1} fill={lit ? glow(p) : glass(p)} />
                {r % 2 === 1 ? <rect {...S2(p)} x={x - 2} y={y + 8} width={16} height={4} rx={1} fill={p.main} /> : null}
                {(r + c) % 3 === 0 ? <path {...shade(p, 0.25)} d={`M${x} ${y} H${x + 5} V${y + 9} H${x} Z`} /> : null}
              </g>
            );
          }),
        )}
        <path {...S(p)} fill={p.second} d="M48 92 H72 L70 86 H50 Z" />
        <rect {...S(p)} x={52} y={92} width={16} height={18} fill={p.wood} />
        <path {...L(p, 2)} d="M60 92 V110" opacity={0.5} />
        <path {...L(p, 3)} stroke={p.edge} d="M8 110 H112" />
      </>
    ),
  },
  {
    id: "villa",
    nameAr: "قصر فاخر",
    category: "city",
    tags: ["قصر", "فيلا", "ثراء", "بيت كبير", "أمنيات", "دنيا", "villa", "mansion"],
    draw: (p) => (
      <>
        {ground(p, 60, 110, 56, 3)}
        <rect {...S(p)} x={6} y={68} width={20} height={40} fill={p.light} />
        <rect {...S(p)} x={94} y={68} width={20} height={40} fill={p.light} />
        <rect {...S(p)} x={4} y={64} width={24} height={6} rx={2} fill={p.main} />
        <rect {...S(p)} x={92} y={64} width={24} height={6} rx={2} fill={p.main} />
        <path {...S2(p)} fill={glass(p)} d="M11 100 V82 Q16 75 21 82 V100 Z" />
        <path {...S2(p)} fill={glass(p)} d="M99 100 V82 Q104 75 109 82 V100 Z" />
        <path {...S(p)} fill={p.main} d="M18 50 L34 30 H86 L102 50 Z" />
        <path {...L(p, 2)} d="M30 40 H90 M24 46 H96" opacity={0.3} />
        <rect {...S(p)} x={22} y={50} width={76} height={58} fill={p.light} />
        <path {...shade(p, 0.08)} d="M22 50 H98 V56 H22 Z" />
        <path {...S2(p)} fill={glass(p)} d="M27 70 V60 H35 V70 Z M85 70 V60 H93 V70 Z" />
        <path {...S2(p)} fill={glass(p)} d="M27 96 V82 H35 V96 Z M85 96 V82 H93 V96 Z" />
        <path {...S(p)} fill={p.second} d="M34 58 L60 42 L86 58 Z" />
        <circle {...S2(p)} cx={60} cy={52} r={3.5} fill={p.light} />
        {[40, 50, 65, 75].map((x) => (
          <g key={x}>
            <rect {...S2(p)} x={x} y={58} width={5} height={40} fill={p.light} />
            <rect x={x} y={58} width={2} height={40} fill={p.dark} opacity={0.08} />
          </g>
        ))}
        <path {...S(p)} fill={p.wood} d="M55 98 V82 Q60 76 65 82 V98 Z" />
        <rect {...S(p)} x={34} y={98} width={52} height={5} fill={p.light} />
        <rect {...S(p)} x={30} y={103} width={60} height={6} fill={p.light} />
        <circle {...S(p)} cx={14} cy={106} r={6} fill={p.green} />
        <circle {...S(p)} cx={106} cy={106} r={6} fill={p.green} />
      </>
    ),
  },
  {
    id: "shop-front",
    nameAr: "واجهة متجر",
    category: "city",
    tags: ["متجر", "دكان", "محل", "تجارة", "رزق", "shop"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={12} y={14} width={96} height={96} fill={p.light} />
        <rect {...S(p)} x={18} y={20} width={84} height={16} rx={3} fill={p.main} />
        {[30, 42, 54, 66, 78, 90].map((x) => (
          <circle key={x} cx={x} cy={28} r={2} fill={p.style === "line" ? p.second : p.light} opacity={0.8} />
        ))}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const x = 12 + i * 16;
          return <path key={i} {...S(p)} fill={i % 2 === 0 ? p.second : tint(p, p.main)} d={`M${x} 40 H${x + 16} V52 A8 8 0 0 1 ${x} 52 Z`} />;
        })}
        <rect {...S(p)} x={18} y={64} width={52} height={40} rx={2} fill={glass(p)} />
        <path {...L(p, 2.5)} d="M20 84 H68" opacity={0.6} />
        <rect {...S2(p)} x={24} y={74} width={8} height={10} rx={2} fill={p.main} />
        <circle {...S2(p)} cx={40} cy={79} r={5} fill={p.accent} />
        <rect {...S2(p)} x={48} y={72} width={14} height={12} rx={2} fill={p.metal} />
        <rect {...S2(p)} x={26} y={92} width={12} height={12} rx={2} fill={p.metal} />
        <circle {...S2(p)} cx={50} cy={98} r={6} fill={p.main} />
        <path {...hi(p, 0.4)} d="M54 64 H64 L48 104 H38 Z" />
        <rect {...S(p)} x={76} y={60} width={26} height={50} fill={p.wood} />
        <rect {...S2(p)} x={81} y={66} width={16} height={20} rx={2} fill={glass(p)} />
        <circle cx={96} cy={92} r={2.5} fill={ln(p, p.metal)} />
        <rect {...S(p)} x={6} y={108} width={108} height={5} rx={2} fill={p.dark} />
      </>
    ),
  },
  {
    id: "street-lamp",
    nameAr: "عمود إنارة",
    category: "city",
    tags: ["إنارة", "شارع", "ليل", "نور", "وحدة", "street lamp"],
    draw: (p) => (
      <>
        <circle cx={60} cy={32} r={26} fill={glow(p)} opacity={0.22} />
        <circle cx={60} cy={32} r={16} fill={glow(p)} opacity={0.25} />
        <rect {...S(p)} x={57} y={48} width={6} height={54} fill={p.edge} />
        <rect {...S(p)} x={53} y={64} width={14} height={5} rx={2} fill={p.edge} />
        <path {...S(p)} fill={p.edge} d="M48 112 H72 L67 98 H53 Z" />
        <path {...S(p)} fill={p.dark} d="M44 22 L60 10 L76 22 Z" />
        <circle cx={60} cy={8} r={2.5} fill={p.edge} />
        <path {...S(p)} fill={glow(p)} d="M48 22 H72 L68 44 H52 Z" />
        <path {...hi(p, 0.6)} d="M53 25 H58 L56 40 H54 Z" />
        <path {...L(p, 2)} stroke={p.style === "line" ? p.line : p.dark} d="M60 22 V44" opacity={0.6} />
        <rect {...S(p)} x={50} y={44} width={20} height={5} rx={2} fill={p.dark} />
      </>
    ),
  },
  {
    id: "bridge-suspension",
    nameAr: "جسر معلّق",
    category: "city",
    tags: ["جسر", "عبور", "وصل", "مدينة", "تواصل", "bridge"],
    draw: (p) => {
      const cy = (x: number) => {
        const t = (x - 34) / 52;
        return 24 + 108 * t * (1 - t);
      };
      const hangers = [40, 46, 52, 58, 64, 70, 76, 82].map((x) => `M${x} ${cy(x).toFixed(1)} V80`).join(" ");
      return (
        <>
          {water(p, 96)}
          <path {...L(p, 2)} stroke={p.edge} d={hangers} opacity={0.8} />
          <path {...L(p, 2)} stroke={p.edge} d="M10 80 V74 M18 80 V60 M26 80 V44 M94 80 V44 M102 80 V60 M110 80 V74" opacity={0.8} />
          <path {...L(p, 3)} stroke={p.edge} d="M4 78 Q20 46 34 24 Q60 78 86 24 Q100 46 116 78" />
          <rect {...S(p)} x={30} y={18} width={8} height={86} fill={p.main} />
          <rect {...S(p)} x={82} y={18} width={8} height={86} fill={p.main} />
          <rect {...S2(p)} x={30} y={36} width={8} height={4} fill={p.second} />
          <rect {...S2(p)} x={82} y={36} width={8} height={4} fill={p.second} />
          <rect {...S(p)} x={4} y={80} width={112} height={7} rx={1} fill={p.second} />
          <path {...shade(p, 0.25)} d="M4 84 H116 V87 H4 Z" />
          <rect {...S(p)} x={28} y={14} width={12} height={5} rx={1} fill={p.dark} />
          <rect {...S(p)} x={80} y={14} width={12} height={5} rx={1} fill={p.dark} />
        </>
      );
    },
  },
  {
    id: "city-skyline",
    nameAr: "أفق المدينة",
    category: "city",
    tags: ["مدينة", "أبراج", "زحام", "حضارة", "skyline"],
    draw: (p) => {
      const b: [number, number, number, string][] = [
        [6, 62, 16, p.second],
        [20, 40, 18, p.main],
        [36, 70, 14, p.light],
        [48, 22, 20, p.main],
        [66, 54, 16, p.second],
        [80, 34, 18, p.light],
        [96, 66, 18, p.main],
      ];
      return (
        <>
          <circle cx={92} cy={22} r={10} fill={glow(p)} opacity={0.5} />
          <path {...L(p, 3)} stroke={p.edge} d="M58 22 V8 M89 34 V24" />
          {b.map(([x, y, w, c], i) => (
            <g key={i}>
              <rect {...S(p)} x={x} y={y} width={w} height={108 - y} fill={c} />
              <rect x={x + w - 4} y={y} width={4} height={108 - y} {...shade(p, 0.12)} />
              {Array.from({ length: Math.floor((100 - y) / 9) }, (_, r) => (
                <path key={r} d={`M${x + 4} ${y + 7 + r * 9} H${x + w - 7}`} stroke={(r + i) % 4 === 0 ? glow(p) : glass(p)} strokeWidth={p.style === "line" ? 2.5 : 3} strokeLinecap="round" />
              ))}
            </g>
          ))}
          <rect {...S(p)} x={4} y={106} width={112} height={6} rx={2} fill={p.dark} />
        </>
      );
    },
  },
  {
    id: "park-bench",
    nameAr: "مقعد حديقة",
    category: "city",
    tags: ["مقعد", "حديقة", "انتظار", "وحدة", "تأمل", "bench"],
    draw: (p) => (
      <>
        {ground(p, 60, 106, 52, 4)}
        <path {...L(p, 5)} stroke={p.edge} d="M22 46 V104 M98 46 V104 M24 80 L16 104 M96 80 L104 104" />
        <path {...L(p, 4)} stroke={p.edge} d="M14 68 Q12 60 20 58 M106 68 Q108 60 100 58" />
        <rect {...S(p)} x={12} y={34} width={96} height={9} rx={3} fill={p.wood} />
        <rect {...S(p)} x={12} y={47} width={96} height={9} rx={3} fill={p.wood} />
        <path {...L(p, 2)} d="M24 38 H40 M70 51 H92" opacity={0.3} />
        <path {...S(p)} fill={p.wood} d="M8 68 H112 L108 76 H12 Z" />
        <path {...shade(p, 0.18)} d="M10 72 H110 L108 76 H12 Z" />
        <path {...S(p)} fill={p.green} d="M70 64 Q76 58 82 64 Q76 68 70 64 Z" />
      </>
    ),
  },
  {
    id: "hot-air-balloon",
    nameAr: "منطاد",
    category: "city",
    tags: ["منطاد", "ارتفاع", "طموح", "حلم", "سفر", "hot air balloon"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d="M60 6 C90 6 102 30 98 50 C94 68 72 78 68 86 H52 C48 78 26 68 22 50 C18 30 30 6 60 6 Z" />
        <path {...S(p)} fill={p.second} d="M60 6 C46 6 38 30 40 50 C42 66 52 78 55 86 H65 C68 78 78 66 80 50 C82 30 74 6 60 6 Z" />
        <path {...S2(p)} fill={p.accent} d="M60 6 C55 6 52 30 53 50 C54 66 57 78 58 86 H62 C63 78 66 66 67 50 C68 30 65 6 60 6 Z" />
        <path {...hi(p, 0.4)} d="M30 30 Q34 16 46 12 Q36 22 34 40 Z" />
        <path {...shade(p, 0.15)} d="M92 26 Q100 42 96 54 C92 68 74 78 68 86 H64 C70 76 84 64 88 50 Q92 38 92 26 Z" />
        <rect {...S(p)} x={52} y={84} width={16} height={5} rx={2} fill={p.dark} />
        <path {...L(p, 2.5)} stroke={p.edge} d="M53 89 L50 98 M67 89 L70 98 M60 89 V98" />
        <rect {...S(p)} x={47} y={97} width={26} height={16} rx={3} fill={p.wood} />
        <path {...L(p, 2)} d="M47 102 H73 M47 107 H73 M54 97 V113 M60 97 V113 M66 97 V113" opacity={0.35} />
      </>
    ),
  },
  {
    id: "construction-crane",
    nameAr: "رافعة بناء",
    category: "city",
    tags: ["بناء", "رافعة", "عمل", "مشروع", "تعمير", "crane"],
    draw: (p) => {
      const lat = ln(p, p.metal);
      const zig = Array.from({ length: 8 }, (_, i) => `L${i % 2 === 0 ? 50 : 40} ${36 + i * 9}`).join(" ");
      const jz = Array.from({ length: 14 }, (_, i) => `L${18 + i * 7} ${i % 2 === 0 ? 30 : 24}`).join(" ");
      return (
        <>
          <rect {...S(p)} x={70} y={86} width={36} height={24} fill={p.light} />
          <path {...L(p, 2)} d="M70 94 H106 M70 102 H106 M82 86 V110 M94 86 V110" opacity={0.35} />
          <path {...L(p, 2.5)} stroke={p.edge} d="M70 78 H106 M72 78 V86 M104 78 V86" />
          <path {...L(p, 3)} stroke={lat} d="M40 104 V30 M50 104 V30" />
          <path {...L(p, 2)} stroke={lat} d={`M40 32 ${zig} L40 104`} />
          <path {...L(p, 3)} stroke={lat} d="M12 24 H112 M18 30 H112" />
          <path {...L(p, 2)} stroke={lat} d={`M18 30 ${jz}`} />
          <path {...L(p, 2)} stroke={p.edge} d="M45 8 L14 24 M45 8 L110 24" />
          <path {...L(p, 3.5)} stroke={lat} d="M45 24 V6" />
          <rect {...S(p)} x={10} y={30} width={16} height={12} rx={1} fill={p.dark} />
          <rect {...S(p)} x={36} y={30} width={18} height={14} rx={2} fill={p.main} />
          <rect {...S2(p)} x={44} y={33} width={8} height={7} rx={1} fill={glass(p)} />
          <path {...L(p, 2)} stroke={p.edge} d="M96 30 V58" />
          <rect {...S(p)} x={90} y={56} width={12} height={5} rx={1} fill={p.dark} />
          <path {...L(p, 3)} stroke={p.edge} d="M96 61 V66 Q96 72 91 70" />
          <rect {...S(p)} x={30} y={104} width={30} height={7} rx={2} fill={p.dark} />
        </>
      );
    },
  },
  {
    id: "clock-tower",
    nameAr: "برج ساعة",
    category: "city",
    tags: ["برج", "ساعة", "وقت", "مدينة", "موعد", "clock tower"],
    draw: (p) => (
      <>
        <path {...L(p, 3)} stroke={p.edge} d="M60 10 V2" />
        <path {...S(p)} fill={p.main} d="M38 30 L60 8 L82 30 Z" />
        <path {...shade(p, 0.15)} d="M60 8 L82 30 H60 Z" />
        <rect {...S(p)} x={36} y={28} width={48} height={6} rx={1} fill={p.second} />
        <rect {...S(p)} x={40} y={34} width={40} height={64} fill={p.light} />
        <path {...shade(p, 0.1)} d="M70 34 H80 V98 H70 Z" />
        <circle {...S(p)} cx={60} cy={52} r={15} fill={p.metal} />
        <circle {...S(p)} cx={60} cy={52} r={11} fill={p.light} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (Math.PI / 6) * i;
          return <path key={i} {...L(p, i % 3 === 0 ? 2.2 : 1.4)} stroke={ln(p, p.dark)} d={`M${60 + 8.5 * Math.sin(a)} ${52 - 8.5 * Math.cos(a)} L${60 + 10.5 * Math.sin(a)} ${52 - 10.5 * Math.cos(a)}`} />;
        })}
        <path {...L(p, 2.5)} stroke={ln(p, p.dark)} d="M60 52 V45 M60 52 L65 55" />
        <path {...S2(p)} fill={glass(p)} d="M48 86 V76 Q51 72 54 76 V86 Z M66 86 V76 Q69 72 72 76 V86 Z" />
        <rect {...S(p)} x={34} y={96} width={52} height={14} fill={p.main} />
        <path {...S(p)} fill={p.wood} d="M54 110 V102 Q60 96 66 102 V110 Z" />
        <path {...L(p, 3)} stroke={p.edge} d="M22 110 H98" />
      </>
    ),
  },
  {
    id: "suitcase",
    nameAr: "حقيبة سفر",
    category: "city",
    tags: ["حقيبة سفر", "سفر", "رحيل", "غربة", "رحلة", "suitcase"],
    draw: (p) => (
      <>
        {ground(p, 60, 112, 34, 3)}
        <path {...L(p, 5)} stroke={p.edge} d="M50 26 V8 H70 V26" />
        <rect {...S(p)} x={28} y={24} width={64} height={80} rx={10} fill={p.main} />
        <path {...shade(p, 0.14)} d="M80 24 H82 Q92 24 92 34 V94 Q92 104 82 104 H80 Z" />
        <path {...L(p, 2.5)} d="M44 32 V96 M60 32 V96 M76 32 V96" opacity={0.3} />
        <path {...S(p)} fill={p.dark} d="M28 34 Q28 24 38 24 H42 V30 H34 V38 H28 Z M92 34 Q92 24 82 24 H78 V30 H86 V38 H92 Z M28 94 Q28 104 38 104 H42 V98 H34 V90 H28 Z M92 94 Q92 104 82 104 H78 V98 H86 V90 H92 Z" />
        <circle {...S(p)} cx={50} cy={56} r={8} fill={p.second} />
        <path {...L(p, 2)} d="M46 56 H54" opacity={0.5} />
        <rect {...S(p)} x={62} y={66} width={16} height={11} rx={2} fill={p.accent} transform="rotate(-12 70 71)" />
        <circle {...S(p)} cx={40} cy={108} r={5} fill={p.dark} />
        <circle {...S(p)} cx={80} cy={108} r={5} fill={p.dark} />
      </>
    ),
  },
];
