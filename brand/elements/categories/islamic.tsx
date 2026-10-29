import React from "react";
import type { ElementDef } from "../types";
import { L, S, tint } from "../helpers";

/**
 * رموز إسلامية: مساجد وعمارة، أدوات العبادة، رموز رمضان والتقويم.
 * ضوابط: لا نص قرآني ولا حروف (المصحف مغلق دائمًا)، لا أشخاص، لا رموز لغير الإسلام.
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

/** نجمة بعدد رؤوس n */
const starN = (cx: number, cy: number, R: number, r: number, n: number, rot = -90) => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const ang = ((rot + (i * 180) / n) * Math.PI) / 180;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(cx + rad * Math.cos(ang)).toFixed(1)} ${(cy + rad * Math.sin(ang)).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
};

/** ربع الحزب: مربعان متداخلان (نجمة ثمانية) */
const rubElHizb = (cx: number, cy: number, R: number) => starN(cx, cy, R, R * 0.7654, 8, -90);

/** قبة بصلية قاعدتها من x1 إلى x2 عند y وقمتها عند top */
const onionDome = (x1: number, x2: number, y: number, top: number) => {
  const w = x2 - x1;
  const c = (x1 + x2) / 2;
  const h = y - top;
  return `M${x1} ${y} Q${x1 - w * 0.06} ${y - h * 0.55} ${c - w * 0.2} ${y - h * 0.78} Q${c - w * 0.04} ${y - h * 0.88} ${c} ${top} Q${c + w * 0.04} ${y - h * 0.88} ${c + w * 0.2} ${y - h * 0.78} Q${x2 + w * 0.06} ${y - h * 0.55} ${x2} ${y} Z`;
};

/** فتحة مقوسة (باب أو نافذة) */
const archOpening = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y + h} V${y + w * 0.5} Q${x} ${y + w * 0.1} ${x + w / 2} ${y} Q${x + w} ${y + w * 0.1} ${x + w} ${y + w * 0.5} V${y + h} Z`;

/** كسوة الكعبة سوداء في كل الثيمات (لون واقعي ثابت، استثناء مقصود من قاعدة ألوان الثيم). */
const KISWA = "#1E1E1E";

export const elements: ElementDef[] = [
  // ───────── العمارة ─────────
  {
    id: "mosque",
    nameAr: "مسجد",
    category: "islamic",
    tags: ["مسجد", "صلاة", "جماعة", "بيت الله", "جمعة"],
    draw: (p) => (
      <>
        {/* المئذنتان */}
        {[10, 98].map((x) => (
          <g key={x}>
            <rect {...S(p)} x={x + 2} y={34} width={10} height={74} rx={2} fill={p.light} />
            <rect {...S(p)} x={x} y={52} width={14} height={7} rx={2} fill={p.main} />
            <path {...S(p)} fill={p.main} d={`M${x + 2} 35 L${x + 7} 18 L${x + 12} 35 Z`} />
          </g>
        ))}
        {/* القبة */}
        <path {...L(p, 3)} stroke={p.edge} d="M60 22 V10" />
        <circle {...S(p)} cx={60} cy={9} r={4} fill={p.metal} />
        <path {...S(p)} fill={p.main} d={onionDome(32, 88, 62, 20)} />
        {/* المبنى */}
        <rect {...S(p)} x={26} y={60} width={68} height={48} rx={3} fill={p.light} />
        <path {...S(p)} fill={p.dark} d={archOpening(50, 76, 20, 32)} />
        <path {...S(p)} fill={p.dark} d={archOpening(33, 74, 10, 16)} />
        <path {...S(p)} fill={p.dark} d={archOpening(77, 74, 10, 16)} />
        <rect {...S(p)} x={6} y={104} width={108} height={8} rx={3} fill={p.second} />
      </>
    ),
  },
  {
    id: "minaret",
    nameAr: "مئذنة",
    category: "islamic",
    tags: ["مئذنة", "أذان", "نداء", "مسجد"],
    draw: (p) => (
      <>
        <path {...L(p, 3)} stroke={p.edge} d="M60 18 V8" />
        <circle {...S(p)} cx={60} cy={7} r={4} fill={p.metal} />
        <path {...S(p)} fill={p.main} d="M50 34 L60 14 L70 34 Z" />
        <rect {...S(p)} x={52} y={34} width={16} height={16} rx={2} fill={p.light} />
        <rect {...S(p)} x={46} y={48} width={28} height={7} rx={3} fill={p.main} />
        <rect {...S(p)} x={49} y={55} width={22} height={47} rx={2} fill={p.light} />
        <rect {...S(p)} x={44} y={70} width={32} height={7} rx={3} fill={p.main} />
        <path {...S(p)} fill={p.dark} d={archOpening(56, 38, 8, 10)} />
        <path {...S(p)} fill={p.dark} d={archOpening(55, 82, 10, 14)} />
        <rect {...S(p)} x={40} y={100} width={40} height={12} rx={3} fill={p.second} />
      </>
    ),
  },
  {
    id: "dome",
    nameAr: "قبة",
    category: "islamic",
    tags: ["قبة", "عمارة", "مسجد", "حضارة"],
    draw: (p) => (
      <>
        <path {...L(p, 4)} stroke={p.edge} d="M60 20 V8" />
        <circle {...S(p)} cx={60} cy={8} r={5} fill={p.metal} />
        <path {...S(p)} fill={p.main} d={onionDome(22, 98, 76, 18)} />
        <path {...L(p)} stroke={p.style === "line" ? p.line : p.light} d="M40 50 Q46 34 60 26" opacity={0.5} />
        <rect {...S(p)} x={16} y={74} width={88} height={8} rx={3} fill={p.metal} />
        <rect {...S(p)} x={22} y={82} width={76} height={28} rx={2} fill={p.light} />
        {[30, 48, 66, 84].map((x) => (
          <path key={x} {...S(p)} fill={p.dark} d={archOpening(x - 2, 87, 10, 17)} />
        ))}
      </>
    ),
  },
  {
    id: "mihrab-arch",
    nameAr: "محراب",
    category: "islamic",
    tags: ["محراب", "قبلة", "إمام", "صلاة", "عمارة"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={14} y={8} width={92} height={104} rx={10} fill={p.main} />
        <path {...S(p)} fill={tint(p, p.second)} d="M30 112 V58 Q30 34 60 18 Q90 34 90 58 V112 Z" />
        <path {...L(p)} d="M40 112 V62 Q40 42 60 30 Q80 42 80 62 V112" opacity={0.35} />
        <path {...L(p, 3)} stroke={p.style === "line" ? p.line : p.dark} d="M60 30 V44" />
        <path {...S(p)} fill={p.metal} d="M52 44 H68 L64 58 Q60 62 56 58 Z" />
        <rect {...S(p)} x={22} y={66} width={8} height={46} rx={2} fill={p.metal} />
        <rect {...S(p)} x={90} y={66} width={8} height={46} rx={2} fill={p.metal} />
      </>
    ),
  },
  {
    id: "arch-window",
    nameAr: "نافذة مقوسة",
    category: "islamic",
    tags: ["نافذة", "مشربية", "عمارة", "ليل", "تأمل"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d="M20 106 V54 Q20 26 60 10 Q100 26 100 54 V106 Z" />
        <path {...S(p)} fill={p.style === "line" ? p.second : p.dark} d="M32 104 V56 Q32 36 60 23 Q88 36 88 56 V104 Z" />
        <path {...S(p)} fill={p.metal} d={crescent(68, 46, 11, 74, 42, 9)} />
        <path {...L(p, 4)} stroke={p.style === "line" ? p.line : p.main} d="M60 23 V104 M32 66 H88 M32 86 H88" />
        <rect {...S(p)} x={12} y={102} width={96} height={10} rx={3} fill={p.metal} />
      </>
    ),
  },
  {
    id: "minbar",
    nameAr: "منبر",
    category: "islamic",
    tags: ["منبر", "خطبة", "جمعة", "موعظة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.wood} d="M24 110 L76 52 H96 V110 Z" />
        <path {...L(p)} d="M38 110 V94 H50 V80 H62 V66 H76" opacity={0.45} />
        <path {...L(p, 5)} stroke={p.style === "line" ? p.line : p.dark} d="M28 76 L78 26" />
        <rect {...S(p)} x={74} y={28} width={6} height={26} rx={2} fill={p.wood} />
        <rect {...S(p)} x={92} y={28} width={6} height={26} rx={2} fill={p.wood} />
        <path {...S(p)} fill={p.metal} d="M70 30 Q72 12 86 8 Q100 12 102 30 Z" />
        <rect {...S(p)} x={10} y={70} width={22} height={40} rx={2} fill={p.main} />
        <path {...S(p)} fill={p.metal} d="M8 72 Q12 58 21 54 Q30 58 34 72 Z" />
        <path {...S(p)} fill={p.dark} d={archOpening(15, 82, 12, 28)} />
      </>
    ),
  },
  {
    id: "kaaba",
    nameAr: "الكعبة",
    category: "islamic",
    tags: ["الكعبة", "مكة", "قبلة", "حج", "عمرة", "البيت الحرام"],
    note: "صورة ظلية مبسطة بلا كتابة على الحزام.",
    draw: (p) => (
      <>
        <ellipse cx={60} cy={108} rx={52} ry={6} fill={p.shadow} />
        <path {...S(p)} fill={KISWA} d="M14 40 L66 48 V108 L14 98 Z" />
        <path {...S(p)} fill={KISWA} d="M66 48 L106 38 V98 L66 108 Z" />
        <path d="M66 48 L106 38 V98 L66 108 Z" fill={p.light} opacity={0.12} />
        <path {...S(p)} fill={KISWA} d="M14 40 L54 30 L106 38 L66 48 Z" />
        <path d="M14 40 L54 30 L106 38 L66 48 Z" fill={p.light} opacity={0.25} />
        <path {...S(p)} fill={p.metal} d="M14 52 L66 60 V68 L14 60 Z" />
        <path {...S(p)} fill={p.metal} d="M66 60 L106 50 V58 L66 68 Z" />
        <path {...S(p)} fill={p.metal} d="M36 74 L50 76 V98 L36 96 Z" />
      </>
    ),
  },

  // ───────── أدوات العبادة ─────────
  {
    id: "mushaf-rehal",
    nameAr: "مصحف على حامل",
    category: "islamic",
    tags: ["مصحف", "قرآن", "تلاوة", "حامل", "رحل"],
    note: "المصحف مغلق دائمًا ولا يُكتب عليه شيء.",
    draw: (p) => (
      <>
        <rect {...S(p)} x={12} y={83} width={96} height={11} rx={4} fill={p.wood} transform="rotate(32 60 88)" />
        <rect {...S(p)} x={12} y={83} width={96} height={11} rx={4} fill={p.wood} transform="rotate(-32 60 88)" />
        <rect {...S(p)} x={30} y={10} width={64} height={66} rx={4} fill={p.light} />
        <rect {...S(p)} x={26} y={12} width={62} height={66} rx={5} fill={p.main} />
        <rect {...L(p)} stroke={p.style === "line" ? p.line : p.metal} x={33} y={19} width={48} height={52} rx={3} />
        <path {...S(p)} fill={p.metal} d={rubElHizb(57, 45, 15)} />
        <circle {...S(p)} cx={57} cy={45} r={5} fill={p.main} />
      </>
    ),
  },
  {
    id: "prayer-mat",
    nameAr: "سجادة صلاة",
    category: "islamic",
    tags: ["سجادة", "صلاة", "سجود", "مصلى"],
    draw: (p) => (
      <>
        <path {...L(p, 3)} stroke={p.edge} d="M30 6 V12 M40 6 V12 M50 6 V12 M60 6 V12 M70 6 V12 M80 6 V12 M90 6 V12 M30 108 V114 M40 108 V114 M50 108 V114 M60 108 V114 M70 108 V114 M80 108 V114 M90 108 V114" />
        <rect {...S(p)} x={24} y={10} width={72} height={100} rx={5} fill={p.main} />
        <rect {...S(p)} x={32} y={18} width={56} height={84} rx={3} fill={tint(p, p.second)} />
        <path {...S(p)} fill={p.main} d="M40 74 V44 Q40 30 60 22 Q80 30 80 44 V74 Z" />
        <path {...S(p)} fill={p.metal} d="M60 82 L68 88 L60 94 L52 88 Z" />
        <path {...L(p)} d="M36 78 H84" opacity={0.4} />
      </>
    ),
  },
  {
    id: "tasbih",
    nameAr: "مسبحة",
    category: "islamic",
    tags: ["مسبحة", "تسبيح", "ذكر", "أذكار"],
    draw: (p) => {
      const n = 19;
      const beads = Array.from({ length: n }, (_, i) => {
        const a = ((112 + (i * 316) / (n - 1)) * Math.PI) / 180;
        return [60 + 38 * Math.cos(a), 46 + 36 * Math.sin(a)];
      });
      return (
        <>
          <ellipse {...L(p, 2)} stroke={p.edge} cx={60} cy={46} rx={38} ry={36} />
          {beads.map(([x, y], i) => (
            <circle key={i} {...S(p)} cx={x} cy={y} r={6} fill={p.metal} />
          ))}
          <path {...S(p)} fill={p.main} d="M52 94 H68 L74 112 Q74 114 72 114 H48 Q46 114 46 112 Z" />
          <path {...L(p)} d="M55 98 L52 112 M60 98 V112 M65 98 L68 112" opacity={0.4} />
          <ellipse {...S(p)} cx={60} cy={86} rx={7} ry={10} fill={p.main} />
        </>
      );
    },
  },
  {
    id: "ibriq",
    nameAr: "إبريق وضوء",
    category: "islamic",
    tags: ["إبريق", "وضوء", "طهارة", "ماء"],
    draw: (p) => (
      <>
        <path {...L(p, 7)} stroke={p.edge} d="M76 46 Q102 44 100 68 Q98 84 84 90" />
        <path {...S(p)} fill={p.metal} d="M40 78 Q24 66 14 36 Q14 32 18 32 Q22 32 23 36 Q32 58 46 68 Z" />
        <path
          {...S(p)}
          fill={p.metal}
          d="M40 110 H80 Q86 110 86 104 Q92 78 76 64 Q72 58 72 48 H48 Q48 58 44 64 Q28 78 34 104 Q34 110 40 110 Z"
        />
        <path {...S(p)} fill={p.metal} d="M42 36 H78 L74 48 H46 Z" />
        <path {...S(p)} fill={p.main} d="M44 36 Q46 22 60 20 Q74 22 76 36 Z" />
        <circle {...S(p)} cx={60} cy={16} r={5} fill={p.main} />
        <path {...L(p)} d="M38 84 Q60 92 82 84" opacity={0.45} />
        <path d="M44 96 Q42 84 48 76" stroke={p.light} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.6} />
      </>
    ),
  },
  {
    id: "qibla-compass",
    nameAr: "بوصلة القبلة",
    category: "islamic",
    tags: ["قبلة", "اتجاه", "بوصلة", "صلاة", "سفر"],
    draw: (p) => (
      <>
        <circle {...S(p)} cx={60} cy={62} r={50} fill={p.metal} />
        <circle {...S(p)} cx={60} cy={62} r={40} fill={p.light} />
        <path {...L(p, 4)} d="M60 26 V32 M60 92 V98 M24 62 H30 M90 62 H96" opacity={0.5} />
        <g transform="rotate(38 60 62)">
          <path {...S(p)} fill={p.main} d="M60 30 L68 62 H52 Z" />
          <path {...S(p)} fill={p.style === "line" ? p.light : p.dark} d="M52 62 H68 L60 90 Z" />
        </g>
        <circle {...S(p)} cx={60} cy={62} r={5} fill={p.metal} />
        <rect {...S(p)} x={77} y={22} width={14} height={14} rx={1.5} fill={p.dark} />
        <rect x={77} y={26} width={14} height={3} fill={p.metal} />
      </>
    ),
  },
  {
    id: "miswak",
    nameAr: "سواك",
    category: "islamic",
    tags: ["سواك", "سنة", "نظافة", "طهارة"],
    draw: (p) => (
      <g transform="rotate(-40 60 60)">
        <rect {...S(p)} x={6} y={52} width={84} height={16} rx={8} fill={p.wood} />
        <path {...L(p)} d="M22 56 Q30 60 22 64 M50 56 Q58 60 50 64" opacity={0.35} />
        <path {...S(p)} fill={tint(p, p.light)} d="M86 52 H108 Q114 52 114 60 Q114 68 108 68 H86 Z" />
        <path {...L(p, 2)} d="M92 56 H112 M92 60 H114 M92 64 H112" opacity={0.5} />
      </g>
    ),
  },

  // ───────── رموز رمضان والتقويم ─────────
  {
    id: "crescent-star",
    nameAr: "هلال ونجمة",
    category: "islamic",
    tags: ["هلال", "رمضان", "عيد", "شهر", "ليل"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.metal} d={crescent(52, 62, 46, 74, 50, 38)} />
        <path {...S(p)} fill={p.metal} d={starN(88, 44, 16, 7, 5)} />
      </>
    ),
  },
  {
    id: "ramadan-lantern",
    nameAr: "فانوس رمضان",
    category: "islamic",
    tags: ["فانوس", "رمضان", "نور", "فرح", "ليالي"],
    draw: (p) => (
      <>
        <circle {...L(p, 4)} stroke={p.edge} cx={60} cy={12} r={6} />
        <path {...S(p)} fill={p.metal} d="M42 34 Q44 20 60 18 Q76 20 78 34 Z" />
        <rect {...S(p)} x={34} y={32} width={52} height={9} rx={3} fill={p.metal} />
        <path {...S(p)} fill={p.metal} d="M38 41 H82 L92 68 L82 92 H38 L28 68 Z" />
        <path {...S(p)} fill={p.style === "line" ? p.light : p.accent} d="M50 46 H70 V88 H50 Z" />
        <path {...S(p)} fill={p.style === "line" ? p.second : p.main} d="M42 46 H46 V88 H42 L34 68 Z" />
        <path {...S(p)} fill={p.style === "line" ? p.second : p.main} d="M74 46 H78 L86 68 L78 88 H74 Z" />
        <path {...S(p)} fill={p.light} d="M60 56 Q68 66 66 74 Q64 80 60 80 Q56 80 54 74 Q52 66 60 56 Z" />
        <rect {...S(p)} x={36} y={90} width={48} height={9} rx={3} fill={p.metal} />
        <path {...S(p)} fill={p.metal} d="M44 99 H76 L64 112 H56 Z" />
      </>
    ),
  },
  {
    id: "mosque-lamp",
    nameAr: "قنديل مسجد",
    category: "islamic",
    tags: ["قنديل", "نور", "مسجد", "هداية"],
    draw: (p) => (
      <>
        <path {...L(p, 3)} stroke={p.edge} d="M60 10 L38 34 M60 10 L82 34" />
        <circle {...S(p)} cx={60} cy={9} r={5} fill={p.metal} />
        <path {...S(p)} fill={p.water} d="M38 36 H82 L70 60 Q98 68 94 86 Q88 104 60 106 Q32 104 26 86 Q22 68 50 60 Z" />
        <path {...L(p, 6)} stroke={p.metal} d="M30 72 Q60 82 90 72" />
        <rect {...S(p)} x={32} y={32} width={56} height={8} rx={4} fill={p.metal} />
        <path {...S(p)} fill={p.metal} d="M60 76 Q68 86 66 92 Q64 98 60 98 Q56 98 54 92 Q52 86 60 76 Z" />
        <circle {...S(p)} cx={60} cy={110} r={5} fill={p.metal} />
        <path d="M32 88 Q34 96 42 100" stroke={p.light} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.6} />
      </>
    ),
  },
  {
    id: "dates-bowl",
    nameAr: "طبق تمر",
    category: "islamic",
    tags: ["تمر", "إفطار", "رمضان", "سنة", "ضيافة"],
    draw: (p) => (
      <>
        {([
          [34, 58, -30],
          [56, 52, 12],
          [78, 54, -18],
          [92, 62, 30],
          [46, 40, 40],
          [70, 38, -40],
        ] as [number, number, number][]).map(([x, y, a]) => (
          <g key={`${x}-${y}`} transform={`rotate(${a} ${x} ${y})`}>
            <ellipse {...S(p)} cx={x} cy={y} rx={13} ry={8} fill={p.wood} />
            <path d={`M${x - 6} ${y - 3} Q${x} ${y - 6} ${x + 6} ${y - 3}`} stroke={p.light} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.5} />
          </g>
        ))}
        <path {...S(p)} fill={p.main} d="M12 64 H108 Q106 100 64 104 H56 Q14 100 12 64 Z" />
        <rect {...S(p)} x={40} y={102} width={40} height={8} rx={3} fill={p.main} />
        <path {...L(p)} stroke={p.style === "line" ? p.line : p.light} d="M22 76 Q60 86 98 76" opacity={0.5} />
      </>
    ),
  },
  {
    id: "hijri-calendar",
    nameAr: "تقويم هجري",
    category: "islamic",
    tags: ["تقويم", "هجري", "شهر", "هلال", "موعد"],
    note: "بلا أرقام؛ تضاف الأرقام في القوالب.",
    draw: (p) => (
      <>
        <rect {...S(p)} x={12} y={20} width={96} height={90} rx={10} fill={p.light} />
        <path {...S(p)} fill={p.main} d="M12 30 Q12 20 22 20 H98 Q108 20 108 30 V44 H12 Z" />
        <rect {...S(p)} x={32} y={10} width={9} height={20} rx={4.5} fill={p.dark} />
        <rect {...S(p)} x={79} y={10} width={9} height={20} rx={4.5} fill={p.dark} />
        <path {...S(p)} fill={p.metal} d={crescent(54, 76, 24, 64, 70, 20)} />
        <path {...S(p)} fill={p.metal} d={starN(80, 66, 8, 3.5, 5)} />
      </>
    ),
  },
  {
    id: "rub-el-hizb",
    nameAr: "نجمة ثمانية",
    category: "islamic",
    tags: ["زخرفة", "نجمة", "ربع الحزب", "فن إسلامي"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.metal} d={rubElHizb(60, 60, 52)} />
        <path {...L(p)} d={rubElHizb(60, 60, 40)} opacity={0.3} />
        <circle {...S(p)} cx={60} cy={60} r={22} fill={p.main} />
        <path {...S(p)} fill={p.metal} d={rubElHizb(60, 60, 12)} />
      </>
    ),
  },
];
