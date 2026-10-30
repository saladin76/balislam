import React from "react";
import type { ElementDef, ElementPalette } from "../types";
import { L, S, tint } from "../helpers";
import { S2, birdPath, glass, glow, ground, hi, ln, ringPath, shade, sparkle, tube } from "../kit";

/**
 * الحياة والوقت والأحوال الباطنة كرموز مفصّلة:
 * ساعات ومنبهات وطرق وقمم، موازين وقيود وأقفاص، ونور في الظلمة.
 */

/** ميزان نحاسي مزخرف؛ tilt بالدرجات (موجب = الكفة اليمنى أثقل) */
const brassScale = (p: ElementPalette, tilt: number) => {
  const a = (tilt * Math.PI) / 180;
  const ends = [-1, 1].map((s) => ({ x: 60 + s * 42 * Math.cos(a), y: 30 + s * 42 * Math.sin(a), s }));
  return (
    <>
      {ground(p, 60, 110, 34, 3)}
      <path {...S(p)} fill={p.wood} d="M30 110 H90 Q90 100 80 98 H40 Q30 100 30 110 Z" />
      <path {...shade(p, 0.15)} d="M30 108 H90 V110 H30 Z" />
      <rect {...S(p)} x={56} y={30} width={8} height={70} fill={p.metal} />
      <rect {...S(p)} x={51} y={60} width={18} height={5} rx={2} fill={p.metal} />
      <rect {...S(p)} x={52} y={88} width={16} height={10} rx={2} fill={p.metal} />
      <path {...shade(p, 0.14)} d="M60 30 H64 V100 H60 Z" />
      {ends.map((e) => {
        const py = e.y + 44;
        const heavy = tilt !== 0 && Math.sign(tilt) === e.s;
        return (
          <g key={e.s}>
            <path {...L(p, 2)} stroke={p.edge} d={`M${e.x} ${e.y} L${e.x - 17} ${py} M${e.x} ${e.y} L${e.x + 17} ${py} M${e.x} ${e.y} V${py}`} />
            {heavy ? (
              <>
                <ellipse {...S2(p)} cx={e.x} cy={py - 3} rx={10} ry={3.5} fill={p.metal} />
                <ellipse {...S2(p)} cx={e.x} cy={py - 7} rx={10} ry={3.5} fill={p.metal} />
                <ellipse {...S2(p)} cx={e.x} cy={py - 11} rx={10} ry={3.5} fill={p.metal} />
              </>
            ) : null}
            <path {...S(p)} fill={p.metal} d={`M${e.x - 20} ${py} H${e.x + 20} Q${e.x + 18} ${py + 13} ${e.x} ${py + 13} Q${e.x - 18} ${py + 13} ${e.x - 20} ${py} Z`} />
            <path {...shade(p, 0.14)} d={`M${e.x - 18} ${py + 4} H${e.x + 18} Q${e.x + 14} ${py + 13} ${e.x} ${py + 13} Q${e.x - 14} ${py + 13} ${e.x - 18} ${py + 4} Z`} />
          </g>
        );
      })}
      <g transform={`rotate(${tilt} 60 30)`}>
        <rect {...S(p)} x={16} y={27} width={88} height={6} rx={3} fill={p.metal} />
        <circle {...S(p)} cx={18} cy={30} r={4} fill={p.metal} />
        <circle {...S(p)} cx={102} cy={30} r={4} fill={p.metal} />
        <path {...S(p)} fill={p.metal} d="M57 30 L60 12 L63 30 Z" />
      </g>
      <circle {...S(p)} cx={60} cy={30} r={5} fill={p.dark} />
      <circle {...S(p)} cx={60} cy={10} r={4} fill={p.accent} />
    </>
  );
};

export const elements: ElementDef[] = [
  {
    id: "hourglass-ornate",
    nameAr: "ساعة رملية مزخرفة",
    category: "mind",
    tags: ["ساعة رملية", "وقت", "عمر", "صبر", "مهلة", "hourglass"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={tint(p, p.water)} opacity={p.style === "line" ? 1 : 0.55} d="M38 18 H82 Q82 42 64 57 Q61 60 64 63 Q82 78 82 102 H38 Q38 78 56 63 Q59 60 56 57 Q38 42 38 18 Z" />
        <path {...S(p)} fill={p.metal} d="M45 30 H75 Q73 44 62 53 H58 Q47 44 45 30 Z" />
        <path d="M60 54 V92" stroke={p.style === "line" ? p.line : p.metal} strokeWidth={2} strokeDasharray="2 3" />
        <path {...S(p)} fill={p.metal} d="M42 100 Q48 84 60 84 Q72 84 78 100 Z" />
        <path {...hi(p, 0.55)} d="M43 22 Q44 38 54 50 Q46 44 43 22 Z M43 98 Q45 82 54 70 Q48 82 47 98 Z" />
        <rect {...S(p)} x={28} y={18} width={6} height={84} rx={2} fill={p.wood} />
        <rect {...S(p)} x={86} y={18} width={6} height={84} rx={2} fill={p.wood} />
        <rect {...S(p)} x={20} y={8} width={80} height={11} rx={4} fill={p.wood} />
        <rect {...S(p)} x={20} y={101} width={80} height={11} rx={4} fill={p.wood} />
        <path {...shade(p, 0.18)} d="M20 15 H100 V15 Q100 19 96 19 H24 Q20 19 20 15 Z M20 108 H100 Q100 112 96 112 H24 Q20 112 20 108 Z" />
        {[31, 89].map((x) => (
          <g key={x}>
            <circle {...S2(p)} cx={x} cy={38} r={4} fill={p.metal} />
            <circle {...S2(p)} cx={x} cy={82} r={4} fill={p.metal} />
          </g>
        ))}
      </>
    ),
  },
  {
    id: "calendar-page",
    nameAr: "ورقة تقويم",
    category: "daily",
    tags: ["تقويم", "أيام", "موعد", "عمر", "مرور الوقت", "calendar"],
    draw: (p) => (
      <>
        {ground(p, 60, 112, 40, 3)}
        <rect {...S(p)} x={24} y={30} width={76} height={80} rx={4} fill={p.light} />
        <rect {...S(p)} x={20} y={26} width={76} height={80} rx={4} fill={p.light} />
        <rect {...S(p)} x={20} y={16} width={76} height={20} rx={4} fill={p.main} />
        <path {...shade(p, 0.12)} d="M20 30 H96 V36 H20 Z" />
        {[40, 76].map((x) => (
          <rect key={x} {...S(p)} x={x - 3} y={8} width={6} height={16} rx={3} fill={p.metal} />
        ))}
        {Array.from({ length: 4 }, (_, r) =>
          Array.from({ length: 6 }, (_, c) => {
            const i = r * 6 + c;
            const x = 27 + c * 11;
            const y = 44 + r * 13;
            if (i > 21) return null;
            return <rect key={i} x={x} y={y} width={7} height={7} rx={1.5} fill={i === 15 ? p.accent : ln(p, p.dark)} opacity={i === 15 ? 1 : p.style === "line" ? 0.3 : 0.22} />;
          }),
        )}
        <circle {...L(p, 2.5)} stroke={p.accent} cx={63.5} cy={73.5} r={7.5} />
        <path {...S(p)} fill={p.second} d="M70 106 Q74 92 96 86 V102 Q96 106 92 106 Z" />
        <path {...shade(p, 0.15)} d="M70 106 Q80 96 96 92 V86 Q74 92 70 106 Z" />
      </>
    ),
  },
  {
    id: "alarm-clock-ringing",
    nameAr: "منبه يرن",
    category: "daily",
    tags: ["منبه", "استيقاظ", "فجر", "تأخر", "تنبيه", "alarm"],
    draw: (p) => (
      <>
        <path {...L(p, 3)} stroke={p.edge} d="M8 50 Q4 62 8 74 M14 54 Q12 62 14 70 M112 50 Q116 62 112 74 M106 54 Q108 62 106 70" />
        <g transform="rotate(-8 60 64)">
          <path {...L(p, 5)} stroke={p.edge} d="M36 96 L28 108 M84 96 L92 108" />
          <g transform="rotate(-35 34 30)">
            <path {...S(p)} fill={p.metal} d="M17 34 A17 17 0 0 1 51 34 Z" />
            <path {...hi(p, 0.45)} d="M22 32 A12 12 0 0 1 32 22 L30 26 A9 9 0 0 0 25 32 Z" />
          </g>
          <g transform="rotate(35 86 30)">
            <path {...S(p)} fill={p.metal} d="M69 34 A17 17 0 0 1 103 34 Z" />
          </g>
          <path {...L(p, 3)} stroke={p.edge} d="M60 26 V16" />
          <rect {...S(p)} x={50} y={12} width={20} height={5} rx={2.5} fill={p.dark} />
          <circle {...S(p)} cx={60} cy={64} r={36} fill={p.main} />
          <path {...shade(p, 0.15)} d="M84 37 A36 36 0 0 1 36 91 A30 30 0 0 0 84 37 Z" />
          <circle {...S(p)} cx={60} cy={64} r={28} fill={tint(p, p.light)} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (Math.PI / 6) * i;
            const r0 = i % 3 === 0 ? 20 : 23;
            return <path key={i} {...L(p, i % 3 === 0 ? 3 : 2)} stroke={ln(p, p.dark)} d={`M${60 + r0 * Math.sin(a)} ${64 - r0 * Math.cos(a)} L${60 + 25.5 * Math.sin(a)} ${64 - 25.5 * Math.cos(a)}`} />;
          })}
          <path {...L(p, 3.5)} stroke={ln(p, p.dark)} d="M60 64 V48 M60 64 L48 70" />
          <path {...L(p, 2)} stroke={p.accent} d="M60 64 L72 52" />
          <circle cx={60} cy={64} r={3.5} fill={p.accent} />
        </g>
      </>
    ),
  },
  {
    id: "sunrise-hills",
    nameAr: "شروق فوق التلال",
    category: "nature",
    tags: ["شروق", "فجر", "بداية جديدة", "أمل", "صباح", "sunrise"],
    draw: (p) => (
      <>
        {Array.from({ length: 9 }, (_, i) => {
          const a = Math.PI + (Math.PI / 8) * i;
          return <path key={i} d={`M${60 + 30 * Math.cos(a)} ${64 + 30 * Math.sin(a)} L${60 + 44 * Math.cos(a)} ${64 + 44 * Math.sin(a)}`} stroke={p.style === "line" ? p.line : p.metal} strokeWidth={4} strokeLinecap="round" />;
        })}
        <circle {...S(p)} cx={60} cy={64} r={24} fill={p.style === "line" ? p.second : p.metal} />
        <circle cx={60} cy={64} r={16} fill={p.light} opacity={0.3} />
        <path {...S(p)} fill={p.second} d="M4 78 Q30 60 56 74 Q82 62 116 76 V98 H4 Z" />
        <path {...S(p)} fill={p.green} d="M4 90 Q40 74 70 86 Q94 78 116 86 V108 Q116 112 112 112 H8 Q4 112 4 108 Z" />
        <path {...shade(p, 0.12)} d="M4 100 Q50 90 116 98 V108 Q116 112 112 112 H8 Q4 112 4 108 Z" />
        <path d="M66 112 Q60 100 72 94 Q80 90 76 86" fill="none" stroke={p.light} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
        <path {...S2(p)} fill={p.edge} d={birdPath(26, 34, 6)} />
        <path {...S2(p)} fill={p.edge} d={birdPath(38, 26, 4)} />
      </>
    ),
  },
  {
    id: "path-milestones",
    nameAr: "طريق بمعالم",
    category: "mind",
    tags: ["طريق", "مراحل", "رحلة الحياة", "هدف", "تقدم", "milestones"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d="M4 46 Q30 34 58 42 Q88 30 116 44 V60 H4 Z" />
        <path {...S(p)} fill={p.green} d="M4 52 Q60 44 116 52 V108 Q116 112 112 112 H8 Q4 112 4 108 Z" />
        <path {...S(p)} fill={tint(p, p.light)} d="M20 112 C8 92 74 90 52 72 C40 60 64 56 63 48 H68 C70 58 50 62 60 72 C82 92 40 96 70 112 Z" />
        <path d="M45 112 C38 98 70 92 56 74 C48 64 66 56 65.5 48" fill="none" stroke={p.style === "line" ? p.line : p.metal} strokeWidth={2} strokeDasharray="4 5" opacity={0.8} />
        {(
          [
            [28, 100, 1],
            [80, 82, 0.75],
            [46, 64, 0.55],
          ] as const
        ).map(([x, y, k], i) => (
          <g key={i}>
            <rect {...S2(p)} x={x - 1.5 * k} y={y - 16 * k} width={3 * k} height={16 * k} fill={p.edge} />
            <path {...S2(p)} fill={p.accent} d={`M${x + 1.5 * k} ${y - 16 * k} L${x + 11 * k} ${y - 12.5 * k} L${x + 1.5 * k} ${y - 9 * k} Z`} />
          </g>
        ))}
        <path {...L(p, 2.5)} stroke={p.edge} d="M66 48 V22" />
        <path {...S(p)} fill={p.metal} d="M66 22 L82 27 L66 32 Z" />
        <path fill={p.accent} d={sparkle(92, 16, 6)} />
      </>
    ),
  },
  {
    id: "summit-climb",
    nameAr: "قمة وطريق الصعود",
    category: "mind",
    tags: ["قمة", "صعود", "هدف", "مجاهدة", "إنجاز", "summit"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d="M60 112 L90 50 L116 112 Z" />
        <path {...S(p)} fill={p.light} d="M84 62 L90 50 L96 62 L92 60 L89 64 Z" />
        <path {...S(p)} fill={p.main} d="M4 112 L52 26 L100 112 Z" />
        <path {...shade(p, 0.16)} d="M52 26 L100 112 H62 Q66 80 52 26 Z" />
        <path {...S(p)} fill={tint(p, p.light)} d="M40 48 L52 26 L64 48 L58 44 L52 52 L46 44 Z" />
        <path d="M22 108 Q42 98 34 86 Q28 74 46 70 Q60 66 50 54 Q46 46 52 34" fill="none" stroke={p.style === "line" ? p.line : p.accent} strokeWidth={2.5} strokeDasharray="3 5" strokeLinecap="round" />
        <path {...L(p, 3)} stroke={p.edge} d="M52 27 V8" />
        <path {...S(p)} fill={p.accent} d="M52 8 L68 13 L52 18 Z" />
        <circle {...S2(p)} cx={22} cy={108} r={3} fill={p.accent} />
      </>
    ),
  },
  {
    id: "ladder-clouds",
    nameAr: "سلم إلى السحاب",
    category: "mind",
    tags: ["سلم", "طموح", "ارتقاء", "حلم", "درجات", "ladder"],
    draw: (p) => {
      const lx = (t: number) => 26 + (48 - 26) * t;
      const rx = (t: number) => 74 + (66 - 74) * t;
      const yy = (t: number) => 112 - 86 * t;
      const rungs = [0.08, 0.22, 0.36, 0.5, 0.63, 0.76, 0.88];
      return (
        <>
          <circle cx={60} cy={22} r={22} fill={p.style === "line" ? p.second : p.metal} opacity={0.3} />
          {rungs.map((t) => {
            const h = 5 * (1 - t * 0.5);
            return <path key={t} {...S(p)} fill={p.wood} d={`M${lx(t)} ${yy(t)} H${rx(t)} V${yy(t) + h} H${lx(t)} Z`} />;
          })}
          <path {...S(p)} fill={p.wood} d={`M20 112 H30 L${lx(1) + 3} ${yy(1)} H${lx(1) - 3} Z`} />
          <path {...S(p)} fill={p.wood} d={`M70 112 H80 L${rx(1) + 3} ${yy(1)} H${rx(1) - 3} Z`} />
          <path {...shade(p, 0.15)} d={`M75 112 H80 L${rx(1) + 3} ${yy(1)} Z`} />
          <path {...S(p)} fill={p.light} d="M14 34 Q14 22 28 24 Q32 10 48 14 Q56 4 70 12 Q84 8 88 20 Q104 20 102 32 Q104 40 92 40 H24 Q14 40 14 34 Z" />
          <path {...shade(p, 0.08)} d="M18 36 H100 Q100 40 92 40 H24 Q18 40 18 36 Z" />
          <path {...S(p)} fill={p.light} d="M84 54 Q84 46 94 48 Q98 40 108 44 Q116 46 114 54 Q114 58 108 58 H90 Q84 58 84 54 Z" />
        </>
      );
    },
  },
  {
    id: "scale-brass-balanced",
    nameAr: "ميزان نحاسي متوازن",
    category: "money",
    tags: ["ميزان", "عدل", "توازن", "قسط", "اعتدال", "balanced scale"],
    draw: (p) => brassScale(p, 0),
  },
  {
    id: "scale-brass-tilted",
    nameAr: "ميزان نحاسي مائل",
    category: "money",
    tags: ["ميزان", "ظلم", "رجحان", "تطفيف", "خلل", "tilted scale"],
    draw: (p) => brassScale(p, 12),
  },
  {
    id: "chains-breaking",
    nameAr: "قيد ينكسر",
    category: "mind",
    tags: ["قيد", "تحرر", "كسر العادة", "انعتاق", "حرية", "breaking chains"],
    draw: (p) => {
      const steel = tint(p, p.edge);
      const link = (cx: number, cy: number, flat: boolean, rot: number, key: string) =>
        flat ? (
          <g key={key} transform={`rotate(${rot} ${cx} ${cy})`}>{tube(p, `M${cx - 8} ${cy - 5} H${cx + 8} A5 5 0 0 1 ${cx + 8} ${cy + 5} H${cx - 8} A5 5 0 0 1 ${cx - 8} ${cy - 5} Z`, steel, 5)}</g>
        ) : (
          <g key={key} transform={`rotate(${rot} ${cx} ${cy})`}>{tube(p, `M${cx - 11} ${cy} H${cx + 11}`, steel, 6)}</g>
        );
      return (
        <>
          {link(12, 74, true, -14, "a")}
          {link(26, 70, false, -14, "b")}
          {link(40, 66, true, -14, "c")}
          {tube(p, "M48 58 Q58 56 58 63 Q58 70 50 70", steel, 5)}
          {tube(p, "M72 58 Q62 54 62 62 Q62 70 70 70", steel, 5)}
          {link(80, 66, true, 14, "d")}
          {link(94, 70, false, 14, "e")}
          {link(108, 74, true, 14, "f")}
          <path {...L(p, 3)} stroke={p.accent} d="M60 44 V34 M48 48 L42 40 M72 48 L78 40 M60 82 V92 M48 78 L42 86 M72 78 L78 86" />
          <path fill={p.style === "line" ? p.second : p.metal} {...S2(p)} d={sparkle(60, 63, 9)} />
          <path {...S2(p)} fill={steel} d="M50 30 L54 26 L56 31 Z M68 94 L73 92 L72 98 Z" />
        </>
      );
    },
  },
  {
    id: "birdcage-freedom",
    nameAr: "قفص مفتوح وطائر محلق",
    category: "mind",
    tags: ["قفص", "حرية", "انطلاق", "تحرر", "روح", "birdcage"],
    note: "الطائر صورة ظلية بلا ملامح.",
    draw: (p) => {
      const bar = ln(p, p.metal);
      const xs = [30, 40, 50, 60, 70, 80, 90];
      return (
        <>
          <circle cx={60} cy={10} r={4} fill="none" stroke={p.edge} strokeWidth={3} />
          <path {...L(p, 3)} stroke={bar} d="M24 96 V54 Q24 20 60 20 Q96 20 96 54 V96" />
          {xs.map((x) => {
            const door = x === 40 || x === 50;
            return <path key={x} {...L(p, 2)} stroke={bar} d={`M${x} ${door ? 58 : 96} V54 Q${x} ${28 + Math.abs(x - 60) * 0.2} 60 20`} />;
          })}
          <path {...L(p, 2.5)} stroke={bar} d="M34 58 H56" />
          <path {...L(p, 3)} stroke={p.edge} d="M30 78 H90" opacity={0.6} />
          <rect {...S(p)} x={22} y={44} width={76} height={6} rx={3} fill={p.metal} />
          <path {...S(p)} fill="none" d="M34 58 L14 64 V98 L34 94" />
          <path {...L(p, 2)} stroke={bar} d="M34 58 L14 64 V98 L34 94 M21 62 V97 M28 60 V95" />
          <circle {...S(p)} cx={60} cy={20} r={5} fill={p.metal} />
          <rect {...S(p)} x={18} y={94} width={84} height={14} rx={4} fill={p.wood} />
          <path {...shade(p, 0.15)} d="M18 104 H102 Q102 108 98 108 H22 Q18 108 18 104 Z" />
          <path {...S(p)} fill={p.accent} d={birdPath(98, 26, 13)} />
          <path {...S2(p)} fill={p.accent} d={birdPath(108, 52, 6)} opacity={0.7} />
        </>
      );
    },
  },
  {
    id: "compass-pocket",
    nameAr: "بوصلة جيب",
    category: "mind",
    tags: ["بوصلة", "اتجاه", "هداية", "قرار", "وجهة", "compass"],
    draw: (p) => (
      <>
        <path {...S(p)} fillRule="evenodd" fill={p.metal} d={ringPath(60, 12, 8, 4)} />
        <rect {...S(p)} x={54} y={18} width={12} height={8} rx={2} fill={p.metal} />
        <circle {...S(p)} cx={60} cy={66} r={42} fill={p.metal} />
        <path {...shade(p, 0.15)} d="M90 36 A42 42 0 0 1 30 96 A36 36 0 0 0 90 36 Z" />
        <circle {...S(p)} cx={60} cy={66} r={35} fill={p.dark} />
        <circle {...S2(p)} cx={60} cy={66} r={31} fill={tint(p, p.light)} />
        {Array.from({ length: 16 }, (_, i) => {
          const a = (Math.PI / 8) * i;
          const r0 = i % 4 === 0 ? 22 : i % 2 === 0 ? 25 : 27;
          return <path key={i} {...L(p, i % 4 === 0 ? 2.5 : 1.5)} stroke={ln(p, p.dark)} d={`M${60 + r0 * Math.sin(a)} ${66 - r0 * Math.cos(a)} L${60 + 29 * Math.sin(a)} ${66 - 29 * Math.cos(a)}`} opacity={0.7} />;
        })}
        <path fill={p.second} opacity={0.5} d="M60 50 L64 66 L60 82 L56 66 Z" transform="rotate(90 60 66)" />
        <g transform="rotate(25 60 66)">
          <path {...S2(p)} fill={p.accent} d="M60 42 L67 66 H53 Z" />
          <path {...S2(p)} fill={p.style === "line" ? p.light : p.dark} d="M60 90 L67 66 H53 Z" />
        </g>
        <circle {...S2(p)} cx={60} cy={66} r={4} fill={p.metal} />
        <path d="M38 52 A26 26 0 0 1 56 40" fill="none" stroke={p.light} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      </>
    ),
  },
  {
    id: "anchor-rope",
    nameAr: "مرساة بحبل",
    category: "mind",
    tags: ["مرساة", "ثبات", "يقين", "طمأنينة", "رسوخ", "anchor"],
    draw: (p) => (
      <>
        {tube(p, "M22 74 Q24 104 60 106 Q96 104 98 74", p.main, 9)}
        <path {...S(p)} fill={p.main} d="M12 82 L20 62 L32 78 Z" />
        <path {...S(p)} fill={p.main} d="M108 82 L100 62 L88 78 Z" />
        <rect {...S(p)} x={55} y={26} width={10} height={78} rx={3} fill={p.main} />
        <path {...shade(p, 0.15)} d="M60 26 H65 V104 H60 Z" />
        <rect {...S(p)} x={34} y={34} width={52} height={8} rx={4} fill={p.wood} />
        <circle {...S(p)} cx={34} cy={38} r={5} fill={p.metal} />
        <circle {...S(p)} cx={86} cy={38} r={5} fill={p.metal} />
        <path {...S(p)} fillRule="evenodd" fill={p.metal} d={ringPath(60, 16, 11, 6)} />
        {tube(p, "M70 14 Q90 20 74 32 Q52 44 72 54 Q90 62 70 72 Q56 78 52 88", tint(p, p.wood), 5)}
        <path d="M70 14 Q90 20 74 32 Q52 44 72 54 Q90 62 70 72 Q56 78 52 88" fill="none" stroke={p.style === "line" ? p.line : p.dark} strokeWidth={1.2} strokeDasharray="2 3" opacity={0.4} />
      </>
    ),
  },
  {
    id: "storm-lantern",
    nameAr: "قنديل زيت",
    category: "home",
    tags: ["قنديل", "فانوس", "نور", "ظلمة", "هداية", "lantern"],
    draw: (p) => (
      <>
        <circle cx={60} cy={60} r={40} fill={p.style === "line" ? p.second : p.metal} opacity={0.18} />
        <path {...L(p, 3)} stroke={p.edge} d="M36 30 Q60 0 84 30" />
        <path {...S(p)} fill={tint(p, p.light)} opacity={p.style === "line" ? 1 : 0.75} d="M44 36 Q34 60 44 84 H76 Q86 60 76 36 Z" />
        <path {...S(p)} fill={p.style === "line" ? p.second : p.metal} d="M60 50 Q70 62 66 72 Q60 78 54 72 Q50 62 60 50 Z" />
        <path fill={p.light} d="M60 60 Q64 66 62 71 Q60 73 58 71 Q56 66 60 60 Z" opacity={0.9} />
        <rect {...S2(p)} x={58} y={74} width={4} height={10} fill={p.dark} />
        <path {...hi(p, 0.6)} d="M46 44 Q41 60 46 76 L49 74 Q45 60 49 46 Z" />
        <path {...L(p, 2.5)} stroke={ln(p, p.dark)} d="M44 36 Q34 60 44 84 M76 36 Q86 60 76 84 M60 36 V48" />
        <path {...S(p)} fill={p.dark} d="M38 36 H82 L74 24 H46 Z" />
        <rect {...S(p)} x={54} y={18} width={12} height={7} rx={2} fill={p.dark} />
        <path {...S(p)} fill={p.main} d="M34 84 H86 V100 Q86 108 78 108 H42 Q34 108 34 100 Z" />
        <path {...shade(p, 0.15)} d="M72 84 H86 V100 Q86 108 78 108 H72 Z" />
        <rect {...S2(p)} x={34} y={90} width={52} height={4} fill={p.metal} />
        <circle {...S(p)} cx={92} cy={96} r={4} fill={p.metal} />
      </>
    ),
  },
  {
    id: "candle",
    nameAr: "شمعة",
    category: "home",
    tags: ["شمعة", "نور", "تضحية", "عمر يذوب", "هدوء", "candle"],
    draw: (p) => (
      <>
        <circle cx={60} cy={30} r={22} fill={p.style === "line" ? p.second : p.metal} opacity={0.2} />
        <path {...S(p)} fill={p.metal} d="M14 98 Q60 112 106 98 Q102 90 60 90 Q18 90 14 98 Z" />
        <path {...L(p, 4)} stroke={ln(p, p.metal)} d="M104 96 Q116 92 112 84 Q108 78 100 84" />
        <path {...shade(p, 0.15)} d="M14 98 Q60 112 106 98 Q60 106 14 98 Z" />
        <rect {...S(p)} x={44} y={46} width={32} height={50} rx={2} fill={tint(p, p.light)} />
        <path {...shade(p, 0.1)} d="M66 46 H76 V96 H66 Z" />
        <path {...S(p)} fill={tint(p, p.light)} d="M42 48 Q42 44 46 44 H74 Q78 44 78 48 Q76 52 72 50 V60 Q72 64 69 60 V52 Q60 54 52 52 V66 Q52 70 49 66 V52 Q44 52 42 48 Z" />
        <path {...L(p, 2.5)} stroke={ln(p, p.dark)} d="M60 44 V36" />
        <path {...S(p)} fill={p.style === "line" ? p.second : p.metal} d="M60 12 Q72 28 67 36 Q60 42 53 36 Q48 28 60 12 Z" />
        <path fill={p.style === "line" ? p.light : p.second} d="M60 24 Q65 31 63 35 Q60 38 57 35 Q55 31 60 24 Z" />
      </>
    ),
  },
  {
    id: "staircase-door",
    nameAr: "درج نحو باب مفتوح",
    category: "mind",
    tags: ["درج", "صعود", "فرصة", "باب", "تقدم", "مستقبل", "stairs"],
    draw: (p) => (
      <>
        <path fill={p.style === "line" ? p.second : p.metal} opacity={0.28} d="M80 54 H106 L72 112 H34 Z" />
        <rect {...S(p)} x={76} y={8} width={34} height={48} rx={1} fill={p.dark} />
        <rect {...S(p)} x={80} y={12} width={26} height={42} fill={p.style === "line" ? p.second : p.metal} />
        <path fill={p.light} opacity={0.45} d="M80 12 H106 V54 H80 Z" />
        <path {...S(p)} fill={p.wood} d="M80 12 L68 18 V58 L80 54 Z" />
        <circle cx={71} cy={38} r={1.8} fill={ln(p, p.metal)} />
        <path {...S(p)} fill={p.main} d="M6 112 V100 H22 V88 H38 V76 H54 V64 H70 V54 H112 V112 Z" />
        <path {...shade(p, 0.15)} d="M6 112 V104 H22 V112 Z M22 112 V92 H38 V112 Z M38 112 V80 H54 V112 Z M54 112 V68 H70 V112 Z M70 112 V58 H112 V112 Z" />
        <path {...hi(p, 0.45)} d="M6 100 H22 V102 H6 Z M22 88 H38 V90 H22 Z M38 76 H54 V78 H38 Z M54 64 H70 V66 H54 Z M70 54 H112 V56 H70 Z" />
      </>
    ),
  },
];
