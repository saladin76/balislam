import React from "react";
import type { ElementDef } from "../types";
import { L, S, tint } from "../helpers";
import { S2, glass, ground, hi, ln, ringPath, shade, sparkle, starPts } from "../kit";

/**
 * مقتنيات ومظاهر: رموز الثراء والمكانة لقصص الحسد والقناعة والشكر.
 * بلا علامات تجارية ولا نصوص.
 */

export const elements: ElementDef[] = [
  {
    id: "luxury-watch",
    nameAr: "ساعة فاخرة",
    category: "money",
    tags: ["ساعة فاخرة", "ثراء", "وقت", "مظاهر", "تفاخر", "luxury watch"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.metal} d="M44 4 H76 L72 32 H48 Z" />
        <path {...S(p)} fill={p.metal} d="M48 88 H72 L76 116 H44 Z" />
        <path {...L(p, 2)} d="M46 11 H74 M47 18 H73 M47.5 25 H72.5 M48 95 H72 M47.5 102 H72.5 M46 109 H74 M60 4 V32 M60 88 V116" opacity={0.35} />
        <rect {...S(p)} x={88} y={55} width={8} height={10} rx={2} fill={p.metal} />
        <circle {...S(p)} cx={60} cy={60} r={31} fill={p.metal} />
        <circle {...S(p)} cx={60} cy={60} r={26} fill={p.dark} />
        <path d="M38 48 A24 24 0 0 1 60 35" fill="none" stroke={p.light} strokeWidth={2.5} strokeLinecap="round" opacity={0.35} />
        <circle {...S2(p)} cx={60} cy={60} r={21} fill={tint(p, p.light)} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (Math.PI / 6) * i;
          const r0 = i % 3 === 0 ? 14.5 : 17;
          return <path key={i} {...L(p, i % 3 === 0 ? 3 : 1.8)} stroke={ln(p, p.dark)} d={`M${60 + r0 * Math.sin(a)} ${60 - r0 * Math.cos(a)} L${60 + 19 * Math.sin(a)} ${60 - 19 * Math.cos(a)}`} />;
        })}
        <circle {...L(p, 1.6)} stroke={ln(p, p.dark)} cx={60} cy={70} r={4.5} opacity={0.6} />
        <path {...L(p, 3)} stroke={ln(p, p.dark)} d="M60 60 L52 52 M60 60 L69 48" />
        <path {...L(p, 1.6)} stroke={p.accent} d="M60 60 L54 72" />
        <circle cx={60} cy={60} r={2.5} fill={p.accent} />
      </>
    ),
  },
  {
    id: "diamond-ring",
    nameAr: "خاتم ألماس",
    category: "money",
    tags: ["خاتم", "ألماس", "زواج", "مهر", "زينة", "ring"],
    draw: (p) => (
      <>
        <path {...S(p)} fillRule="evenodd" fill={p.metal} d={ringPath(60, 80, 32, 24, 26, 18)} />
        <path d="M34 92 Q40 104 56 106" fill="none" stroke={p.light} strokeWidth={3} strokeLinecap="round" opacity={0.45} />
        <path {...S(p)} fill={p.metal} d="M48 56 L52 46 H68 L72 56 Z" />
        <path {...S(p)} fill={tint(p, p.water)} d="M40 30 L50 18 H70 L80 30 L60 52 Z" />
        <path {...S2(p)} fill={p.light} opacity={0.55} d="M50 18 L55 30 H40 Z M60 18 L55 30 H65 Z" />
        <path {...shade(p, 0.18)} d="M65 30 L80 30 L60 52 Z" />
        <path {...L(p, 1.6)} d="M40 30 H80 M50 18 L55 30 L60 52 M70 18 L65 30 L60 52 M55 30 L60 18 L65 30" opacity={0.6} />
        <path fill={p.accent} d={sparkle(88, 18, 7)} />
        <path fill={p.accent} d={sparkle(30, 42, 5)} />
        <path fill={p.accent} d={sparkle(92, 44, 4)} />
      </>
    ),
  },
  {
    id: "crown",
    nameAr: "تاج",
    category: "money",
    tags: ["تاج", "ملك", "سلطة", "مكانة", "كبر", "crown"],
    draw: (p) => (
      <>
        {ground(p, 60, 106, 40, 3)}
        <path {...S(p)} fill={p.metal} d="M24 86 L14 38 L38 60 L60 24 L82 60 L106 38 L96 86 Z" />
        <path {...shade(p, 0.16)} d="M60 24 L82 60 L106 38 L96 86 H60 Z" />
        <path {...hi(p, 0.45)} d="M22 46 L34 58 L26 78 Z" />
        <circle {...S(p)} cx={14} cy={36} r={6} fill={p.accent} />
        <circle {...S(p)} cx={60} cy={20} r={7} fill={p.accent} />
        <circle {...S(p)} cx={106} cy={36} r={6} fill={p.accent} />
        <path {...S2(p)} fill={p.second} d="M60 54 L66 64 L60 74 L54 64 Z" />
        <circle {...S2(p)} cx={36} cy={72} r={4} fill={p.main} />
        <circle {...S2(p)} cx={84} cy={72} r={4} fill={p.main} />
        <path {...S(p)} fill={p.metal} d="M22 84 H98 V98 Q60 104 22 98 Z" />
        <path {...shade(p, 0.12)} d="M22 94 Q60 100 98 94 V98 Q60 104 22 98 Z" />
        {[36, 60, 84].map((x, i) => (
          <ellipse key={x} {...S2(p)} cx={x} cy={91} rx={6} ry={4} fill={[p.second, p.accent, p.main][i]} />
        ))}
      </>
    ),
  },
  {
    id: "podium",
    nameAr: "منصة التتويج",
    category: "daily",
    tags: ["منصة", "فوز", "منافسة", "مقارنة", "مركز أول", "podium"],
    draw: (p) => (
      <>
        {ground(p, 60, 110, 54, 3)}
        <path {...S(p)} fill={p.metal} d="M48 22 H72 V30 Q72 42 60 42 Q48 42 48 30 Z" />
        <path {...L(p, 3)} stroke={ln(p, p.metal)} d="M48 26 H43 Q42 34 49 36 M72 26 H77 Q78 34 71 36" />
        <rect {...S(p)} x={56} y={42} width={8} height={5} fill={p.metal} />
        <rect {...S(p)} x={51} y={46} width={18} height={5} rx={1} fill={p.dark} />
        <rect {...S(p)} x={10} y={70} width={34} height={40} fill={p.second} />
        <rect {...S(p)} x={76} y={80} width={34} height={30} fill={p.main} />
        <rect {...S(p)} x={42} y={52} width={36} height={58} fill={p.metal} />
        <path {...shade(p, 0.12)} d="M66 52 H78 V110 H66 Z" />
        <path {...hi(p, 0.4)} d="M42 52 H78 V57 H42 Z" />
        <polygon {...S2(p)} fill={p.light} points={starPts(60, 70, 8, 3.5)} />
        <circle {...S2(p)} cx={22} cy={84} r={3.5} fill={p.light} />
        <circle {...S2(p)} cx={32} cy={84} r={3.5} fill={p.light} />
        {[83, 93, 103].map((x) => (
          <circle key={x} {...S2(p)} cx={x} cy={93} r={3} fill={tint(p, p.light)} />
        ))}
      </>
    ),
  },
  {
    id: "gifts-stack",
    nameAr: "هدايا مكدسة",
    category: "home",
    tags: ["هدايا", "عيد", "فرح", "تهادوا تحابوا", "كرم", "gifts"],
    draw: (p) => (
      <>
        {ground(p, 60, 111, 52, 3)}
        <rect {...S(p)} x={14} y={66} width={58} height={44} fill={p.main} />
        <path {...shade(p, 0.14)} d="M58 66 H72 V110 H58 Z" />
        <rect {...S(p)} x={38} y={66} width={10} height={44} fill={p.second} />
        <rect {...S(p)} x={10} y={58} width={66} height={11} rx={2} fill={p.main} />
        <rect {...S(p)} x={38} y={58} width={10} height={11} fill={p.second} />
        <rect {...S(p)} x={74} y={80} width={36} height={30} fill={p.second} />
        <path {...shade(p, 0.14)} d="M100 80 H110 V110 H100 Z" />
        <rect {...S(p)} x={87} y={80} width={8} height={30} fill={p.accent} />
        <rect {...S(p)} x={71} y={74} width={42} height={9} rx={2} fill={p.second} />
        <rect {...S(p)} x={87} y={74} width={8} height={9} fill={p.accent} />
        <path {...S(p)} fill={p.accent} d="M91 74 Q80 62 82 70 Q82 76 91 74 Q102 62 100 70 Q100 76 91 74 Z" />
        <rect {...S(p)} x={26} y={34} width={36} height={24} fill={p.accent} />
        <rect {...S(p)} x={40} y={34} width={8} height={24} fill={p.light} />
        <rect {...S(p)} x={23} y={28} width={42} height={8} rx={2} fill={p.accent} />
        <rect {...S(p)} x={40} y={28} width={8} height={8} fill={p.light} />
        <path {...S(p)} fill={p.light} d="M44 28 Q30 12 30 22 Q30 30 44 28 Q58 12 58 22 Q58 30 44 28 Z" />
        <circle {...S2(p)} cx={44} cy={27} r={3} fill={p.light} />
      </>
    ),
  },
  {
    id: "camera-pro",
    nameAr: "كاميرا احترافية",
    category: "daily",
    tags: ["كاميرا", "تصوير", "توثيق", "شهرة", "camera"],
    draw: (p) => (
      <>
        {ground(p, 60, 108, 50, 3)}
        <path {...S(p)} fill={p.main} d="M14 40 H38 L45 28 H75 L82 40 H106 Q112 40 112 46 V96 Q112 102 106 102 H14 Q8 102 8 96 V46 Q8 40 14 40 Z" />
        <path {...S(p)} fill={p.dark} d="M14 40 H30 V102 H14 Q8 102 8 96 V46 Q8 40 14 40 Z" />
        <path {...L(p, 1.6)} stroke={p.style === "line" ? p.light : p.light} opacity={0.35} d="M13 52 H26 M13 60 H26 M13 68 H26 M13 76 H26 M13 84 H26" />
        <rect {...S(p)} x={12} y={33} width={14} height={7} rx={2} fill={p.accent} />
        <rect {...S(p)} x={52} y={22} width={16} height={6} rx={1} fill={p.dark} />
        <rect {...S2(p)} x={88} y={46} width={14} height={8} rx={2} fill={glass(p)} />
        <path {...shade(p, 0.1)} d="M30 92 H112 V96 Q112 102 106 102 H30 Z" />
        <circle {...S(p)} cx={66} cy={70} r={27} fill={p.metal} />
        <circle {...L(p, 1.6)} cx={66} cy={70} r={23} opacity={0.4} />
        <circle {...S(p)} cx={66} cy={70} r={19} fill={p.dark} />
        <circle {...S2(p)} cx={66} cy={70} r={12} fill={glass(p)} />
        <circle cx={66} cy={70} r={6} fill={p.dark} opacity={0.5} />
        <circle cx={60} cy={64} r={3.5} fill={p.light} opacity={0.8} />
        <circle cx={71} cy={75} r={1.8} fill={p.light} opacity={0.6} />
      </>
    ),
  },
  {
    id: "sneakers",
    nameAr: "حذاء رياضي",
    category: "daily",
    tags: ["حذاء", "رياضة", "موضة", "مشي", "سعي", "sneakers"],
    draw: (p) => (
      <>
        {ground(p, 60, 102, 54, 3)}
        <path {...S(p)} fill={p.main} d="M12 84 V56 Q12 48 20 48 H34 Q42 48 46 54 L60 66 Q76 70 96 72 Q112 74 112 86 Z" />
        <path {...S(p)} fill={p.second} d="M80 70 Q100 72 108 78 L111 86 H84 Q78 78 80 70 Z" />
        <path {...S(p)} fill={p.second} d="M12 66 H24 Q30 72 28 84 H12 Z" />
        <path {...S2(p)} fill={p.accent} d="M30 80 Q48 66 70 72 Q50 76 36 84 Z" />
        <path {...S(p)} fill={p.dark} d="M14 52 Q24 44 38 50 Q26 50 16 56 Z" />
        <path {...L(p, 2.5)} d="M44 58 L50 54 M50 62 L56 58 M56 66 L62 62" />
        <path {...hi(p, 0.45)} d="M18 54 H30 Q36 54 40 58 L20 60 Z" />
        <path {...S(p)} fill={tint(p, p.light)} d="M8 84 H114 Q116 92 108 96 H14 Q8 96 8 90 Z" />
        <path {...L(p, 2)} d="M16 90 H106" opacity={0.35} strokeDasharray="4 4" />
      </>
    ),
  },
  {
    id: "handbag",
    nameAr: "حقيبة يد فاخرة",
    category: "money",
    tags: ["حقيبة", "موضة", "فخامة", "مظاهر", "تسوق", "handbag"],
    draw: (p) => (
      <>
        {ground(p, 60, 110, 46, 3)}
        <path {...L(p, 6)} stroke={p.edge} d="M40 48 V40 Q40 16 60 16 Q80 16 80 40 V48" />
        <path {...S(p)} fill={p.main} d="M22 46 H98 L106 102 Q106 108 100 108 H20 Q14 108 14 102 Z" />
        <path {...shade(p, 0.14)} d="M86 46 H98 L106 102 Q106 108 100 108 H92 Z" />
        <path {...L(p, 1.5)} d="M20 100 H100" opacity={0.45} strokeDasharray="3 3" />
        <path {...S(p)} fill={p.second} d="M22 46 H98 L96 70 Q60 84 24 70 Z" />
        <path {...L(p, 1.5)} d="M26 66 Q60 78 94 66" opacity={0.45} strokeDasharray="3 3" />
        <path {...hi(p, 0.4)} d="M28 50 H54 L52 54 H28 Z" />
        <rect {...S(p)} x={53} y={70} width={14} height={12} rx={3} fill={p.metal} />
        <circle cx={60} cy={76} r={2} fill={ln(p, p.dark)} />
        <rect {...S2(p)} x={36} y={42} width={8} height={8} rx={2} fill={p.metal} />
        <rect {...S2(p)} x={76} y={42} width={8} height={8} rx={2} fill={p.metal} />
      </>
    ),
  },
  {
    id: "car-key",
    nameAr: "مفتاح سيارة",
    category: "money",
    tags: ["مفتاح", "سيارة", "امتلاك", "هدية", "car key"],
    draw: (p) => (
      <g transform="rotate(35 60 60)">
        <path {...S(p)} fillRule="evenodd" fill={p.metal} d={ringPath(60, 14, 11, 6.5)} />
        <rect {...S(p)} x={55} y={22} width={10} height={10} rx={3} fill={p.metal} />
        <rect {...S(p)} x={42} y={30} width={36} height={50} rx={15} fill={p.dark} />
        <path d="M48 42 Q50 34 58 33" fill="none" stroke={p.light} strokeWidth={2.5} strokeLinecap="round" opacity={0.35} />
        <circle {...S2(p)} cx={60} cy={46} r={5.5} fill={p.metal} />
        <circle {...S2(p)} cx={60} cy={62} r={5.5} fill={tint(p, p.light)} />
        <circle cx={60} cy={73} r={2.5} fill={p.accent} />
        <path {...S(p)} fill={p.metal} d="M55 80 H65 V96 H62 V100 H65 V108 L60 114 H55 Z" />
        <path {...L(p, 1.5)} d="M58 84 V110" opacity={0.4} />
      </g>
    ),
  },
  {
    id: "diamond",
    nameAr: "ألماسة",
    category: "money",
    tags: ["ألماس", "جوهرة", "نفيس", "كنز", "قيمة", "diamond"],
    draw: (p) => (
      <>
        <ellipse cx={60} cy={112} rx={30} ry={3} fill={p.shadow} />
        <path {...S(p)} fill={tint(p, p.water)} d="M14 44 L34 18 H86 L106 44 L60 106 Z" />
        <path fill={p.light} opacity={p.style === "line" ? 0 : 0.35} d="M34 18 L46 44 H14 Z M60 18 L46 44 H74 Z M86 18 L74 44 H106 Z" />
        <path {...shade(p, 0.12)} d="M34 18 H60 L46 44 Z M86 18 L106 44 H74 Z" />
        <path fill={p.style === "line" ? p.second : p.main} opacity={p.style === "line" ? 1 : 0.55} d="M46 44 H74 L60 106 Z" />
        <path {...shade(p, 0.18)} d="M74 44 H106 L60 106 Z" />
        <path {...hi(p, 0.35)} d="M14 44 H46 L60 106 Z" />
        <path {...L(p, 1.8)} d="M14 44 H106 M34 18 L46 44 L60 18 L74 44 L86 18 M46 44 L60 106 L74 44" opacity={0.55} />
        <path {...S(p)} fill="none" d="M14 44 L34 18 H86 L106 44 L60 106 Z" />
        <path fill={p.accent} d={sparkle(96, 16, 8)} />
        <path fill={p.accent} d={sparkle(18, 72, 5)} />
      </>
    ),
  },
];
