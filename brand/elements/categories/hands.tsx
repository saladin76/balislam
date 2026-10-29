import React from "react";
import type { ElementDef, ElementPalette } from "../types";
import { L, S } from "../helpers";

/**
 * الأيدي والإشارات: أيدٍ فقط (مسموحة شرعًا) بلون البشرة p.skin،
 * مع كُمّ بلون الثيم. لا وجوه.
 */

/** حدّ للأجزاء المتراكبة (أصابع فوق كف): حبر في الخطي، وخط تفصيل خافت في المسطح ليظهر الفصل. */
const SF = (p: ElementPalette) =>
  p.style === "line"
    ? S(p)
    : { stroke: p.line, strokeWidth: 2.5, strokeOpacity: 0.3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/** تحجيم مسار مطلق مع إزاحة (يحفظ سمك الحد). */
const tp = (d: string, s: number, dx = 0, dy = 0) => {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  let cmd = "";
  let k = 0;
  const out: string[] = [];
  const f = (n: number) => String(Math.round(n * 100) / 100);
  for (const t of tokens) {
    if (/[A-Za-z]/.test(t)) {
      cmd = t;
      k = 0;
      out.push(t);
      continue;
    }
    const n = parseFloat(t);
    let v = n;
    if (cmd === "H") v = dx + n * s;
    else if (cmd === "V") v = dy + n * s;
    else if (cmd === "A") {
      const i = k % 7;
      v = i < 2 ? n * s : i === 5 ? dx + n * s : i === 6 ? dy + n * s : n;
    } else v = k % 2 === 0 ? dx + n * s : dy + n * s;
    out.push(f(v));
    k++;
  }
  return out.join(" ");
};

/** كف مفتوحة مواجهة، الأصابع للأعلى والإبهام يسارًا، المعصم عند y=104 */
const HAND =
  "M42 104 L40 92 Q30 86 24 76 L15 62 Q11 54 17 50 Q23 47 27 54 L35 65 L35 33 A5 5 0 0 1 45 33 L45 50 Q47.25 56 49.5 50 L49.5 23 A5.5 5.5 0 0 1 60.5 23 L60.5 50 Q62.5 56 64.5 50 L64.5 28 A5 5 0 0 1 74.5 28 L74.5 52 Q76.5 58 78.5 52 L78.5 41 A4.25 4.25 0 0 1 87 41 L87 72 Q87 88 78 94 L78 104 Z";
const PALM_LINES = "M46 82 Q58 74 72 78";

/** كف مفتوحة مع كمّ، بالمقياس s ومركز أسفل المعصم (cx، bottom) */
const openHand = (p: ElementPalette, s = 1, cx = 60, bottom = 114, cuff?: string) => {
  const dx = cx - 60 * s;
  const dy = bottom - 114 * s;
  return (
    <>
      <path {...S(p)} fill={p.skin} d={tp(HAND, s, dx, dy)} />
      <path {...L(p, 3 * Math.max(s, 0.8))} d={tp(PALM_LINES, s, dx, dy)} opacity={0.35} />
      <rect {...S(p)} x={dx + 36 * s} y={dy + 96 * s} width={48 * s} height={18 * s} rx={5 * s} fill={cuff ?? p.main} />
    </>
  );
};

/** قبضة بإصبع سبابة مرفوعة (الكف مواجهة) */
const fistIndex = (p: ElementPalette) => (
  <>
    <rect {...S(p)} x={40} y={8} width={15} height={62} rx={7.5} fill={p.skin} />
    <rect {...S(p)} x={36} y={50} width={50} height={52} rx={15} fill={p.skin} />
    <rect {...SF(p)} x={52} y={52} width={38} height={15} rx={7.5} fill={p.skin} />
    <rect {...SF(p)} x={52} y={67} width={38} height={15} rx={7.5} fill={p.skin} />
    <rect {...SF(p)} x={52} y={82} width={35} height={15} rx={7.5} fill={p.skin} />
    <rect {...SF(p)} x={32} y={72} width={40} height={15} rx={7.5} fill={p.skin} transform="rotate(-14 40 80)" />
    <rect {...S(p)} x={38} y={98} width={46} height={16} rx={5} fill={p.main} />
  </>
);

/** كفّان مقعرتان (غَرفة) من الأمام */
const CUP_L =
  "M60 79 V98 Q32 98 18 84 Q8 74 9 56 Q10 48 16 48 Q22 48 22 56 Q24 70 40 76 Q50 79 60 79 Z";
const cupped = (p: ElementPalette) => {
  const half = (
    <>
      <path {...S(p)} fill={p.skin} d={CUP_L} />
      <path {...L(p, 3)} d="M9.5 64 Q15 66 22.5 63 M12 74 Q20 76 28 71 M18 84 Q27 85 36 78" opacity={0.4} />
      <rect {...S(p)} x={38} y={96} width={22} height={16} rx={4} fill={p.main} />
    </>
  );
  return (
    <>
      {half}
      <g transform="translate(120 0) scale(-1 1)">{half}</g>
    </>
  );
};

/** يد جانبية مبسوطة الكف للأعلى، الإبهام مرفوع، الكم يسارًا */
const GIVE =
  "M22 68 Q38 68 48 64 L56 50 Q60 44 65 48 Q69 52 66 58 L62 66 H102 Q110 66 110 73 Q110 79 104 80 Q108 86 100 88 Q102 94 94 95 L60 96 Q40 97 22 94 Z";
const sideHand = (p: ElementPalette, cuff: string, s = 0.6, dx = 0, dy = 46) => (
  <>
    <path {...S(p)} fill={p.skin} d={tp(GIVE, s, dx, dy)} />
    <path {...L(p, 3)} d={tp("M64 80 H104 M64 88 H100", s, dx, dy)} opacity={0.35} />
    <rect {...S(p)} x={dx + 6 * s} y={dy + 62 * s} width={20 * s} height={38 * s} rx={4} fill={cuff} />
  </>
);

const HEART =
  "M60 104 C30 84 12 64 12 42 C12 24 26 14 40 14 C50 14 56 20 60 28 C64 20 70 14 80 14 C94 14 108 24 108 42 C108 64 90 84 60 104 Z";

export const elements: ElementDef[] = [
  {
    id: "hand-open",
    nameAr: "كف مفتوحة",
    category: "hands",
    tags: ["يد", "كف", "عطاء", "انفتاح"],
    draw: (p) => openHand(p),
  },
  {
    id: "hand-stop",
    nameAr: "يد توقف",
    category: "hands",
    tags: ["توقف", "منع", "كفى", "تحذير"],
    draw: (p) => (
      <>
        <circle {...S(p)} cx={60} cy={56} r={50} fill={p.themeId === "night" ? p.second : p.main} />
        <g>{openHand(p, 0.86, 60, 114, p.style === "line" ? p.second : p.dark)}</g>
      </>
    ),
  },
  {
    id: "hand-wave",
    nameAr: "يد تلوّح",
    category: "hands",
    tags: ["سلام", "تحية", "وداع", "ترحيب"],
    draw: (p) => (
      <>
        <path {...L(p, 4)} stroke={p.edge} d="M14 20 Q6 34 10 48 M24 14 Q16 26 18 38 M100 22 Q110 32 110 46 M92 12 Q102 20 104 30" opacity={0.7} />
        <g transform="rotate(-14 60 110)">{openHand(p, 0.9, 62, 116, p.second)}</g>
      </>
    ),
  },
  {
    id: "hands-dua",
    nameAr: "يدا الدعاء",
    category: "hands",
    tags: ["دعاء", "تضرع", "سؤال الله", "رجاء"],
    draw: (p) => {
      const one = <g transform="rotate(-10 34 112)">{openHand(p, 0.74, 36, 114)}</g>;
      return (
        <>
          {one}
          <g transform="translate(120 0) scale(-1 1)">{one}</g>
        </>
      );
    },
  },
  {
    id: "hand-one",
    nameAr: "إصبع مرفوعة",
    category: "hands",
    tags: ["توحيد", "واحد", "شهادة", "تنبيه"],
    draw: (p) => fistIndex(p),
  },
  {
    id: "hand-point",
    nameAr: "يد تشير",
    category: "hands",
    tags: ["إشارة", "اتجاه", "انظر", "التالي"],
    draw: (p) => <g transform="rotate(-90 60 60)">{fistIndex(p)}</g>,
  },
  {
    id: "thumbs-up",
    nameAr: "إبهام للأعلى",
    category: "hands",
    tags: ["موافقة", "أحسنت", "إعجاب", "صواب"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={30} y={10} width={18} height={54} rx={9} fill={p.skin} transform="rotate(-8 39 60)" />
        <rect {...S(p)} x={28} y={48} width={50} height={54} rx={14} fill={p.skin} />
        <rect {...SF(p)} x={52} y={46} width={42} height={14} rx={7} fill={p.skin} />
        <rect {...SF(p)} x={52} y={60} width={44} height={14} rx={7} fill={p.skin} />
        <rect {...SF(p)} x={52} y={74} width={42} height={14} rx={7} fill={p.skin} />
        <rect {...SF(p)} x={52} y={88} width={38} height={14} rx={7} fill={p.skin} />
        <rect {...S(p)} x={22} y={96} width={44} height={18} rx={5} fill={p.main} />
      </>
    ),
  },
  {
    id: "hand-giving",
    nameAr: "يد تعطي",
    category: "hands",
    tags: ["صدقة", "عطاء", "إنفاق", "كرم"],
    draw: (p) => (
      <>
        <circle {...S(p)} cx={86} cy={46} r={15} fill={p.metal} />
        <circle {...L(p, 3)} cx={86} cy={46} r={9} opacity={0.4} />
        <path {...L(p, 3)} stroke={p.edge} d="M86 16 V22 M70 22 L73 27 M102 22 L99 27" opacity={0.7} />
        <path
          {...S(p)}
          fill={p.skin}
          d="M22 68 Q38 68 48 64 L56 50 Q60 44 65 48 Q69 52 66 58 L62 66 H102 Q110 66 110 73 Q110 79 104 80 Q108 86 100 88 Q102 94 94 95 L60 96 Q40 97 22 94 Z"
        />
        <path {...L(p, 3)} d="M62 80 H104 M62 88 H100" opacity={0.35} />
        <rect {...S(p)} x={6} y={62} width={20} height={38} rx={5} fill={p.main} />
      </>
    ),
  },
  {
    id: "handshake",
    nameAr: "مصافحة",
    category: "hands",
    tags: ["مصافحة", "اتفاق", "أخوة", "صلح"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.skin} d="M96 44 L72 46 Q60 48 56 58 L58 82 Q70 88 82 82 L96 78 Z" />
        <path {...S(p)} fill={p.skin} d="M24 44 Q44 40 60 48 L74 56 Q78 62 72 66 Q58 74 44 78 Q34 80 24 80 Z" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} {...SF(p)} x={50 + i * 4} y={50 + i * 9} width={28} height={11} rx={5.5} fill={p.skin} transform={`rotate(28 ${50 + i * 4} ${55 + i * 9})`} />
        ))}
        <rect {...SF(p)} x={46} y={38} width={38} height={12} rx={6} fill={p.skin} transform="rotate(-10 84 44)" />
        <rect {...S(p)} x={4} y={40} width={22} height={46} rx={5} fill={p.main} />
        <rect {...S(p)} x={94} y={40} width={22} height={46} rx={5} fill={p.second} />
      </>
    ),
  },
  {
    id: "hands-help",
    nameAr: "يد العون",
    category: "hands",
    tags: ["مساعدة", "عون", "نجدة", "تكافل"],
    draw: (p) => (
      <>
        <g transform="rotate(45 34 88)">{openHand(p, 0.56, 34, 110)}</g>
        <g transform="rotate(225 86 32)">{openHand(p, 0.56, 86, 54, p.second)}</g>
      </>
    ),
  },
  {
    id: "hands-heart",
    nameAr: "كفان تحملان قلبًا",
    category: "hands",
    tags: ["رحمة", "حنان", "رعاية", "محبة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.themeId === "night" ? p.second : p.main} d={tp(HEART, 0.46, 32.4, 22)} />
        <g transform="translate(120 0) scale(-1 1)">
          <g transform="rotate(-16 8 104)">{sideHand(p, p.second, 0.68, 0, 38)}</g>
        </g>
        <g transform="rotate(-16 8 104)">{sideHand(p, p.main, 0.68, 0, 38)}</g>
      </>
    ),
  },
  {
    id: "hands-water",
    nameAr: "كفان تغرفان الماء",
    category: "hands",
    tags: ["وضوء", "ماء", "طهارة", "غرفة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.water} d="M60 18 Q70 32 70 40 Q70 50 60 50 Q50 50 50 40 Q50 32 60 18 Z" />
        {cupped(p)}
        <path {...S(p)} fill={p.water} d="M22 60 Q40 72 60 72 Q80 72 98 60 Q80 80 60 80 Q40 80 22 60 Z" />
      </>
    ),
  },
  {
    id: "hand-writing",
    nameAr: "يد تكتب",
    category: "hands",
    tags: ["كتابة", "تدوين", "علم", "توقيع"],
    draw: (p) => (
      <>
        <path {...L(p, 4)} stroke={p.edge} d="M8 110 Q14 102 20 108 Q26 114 32 106" />
        <g transform="rotate(38 60 60)">
          <rect {...SF(p)} x={42} y={54} width={12} height={28} rx={6} fill={p.skin} />
          <rect {...S(p)} x={54} y={10} width={12} height={94} rx={3} fill={p.main} />
          <path {...S(p)} fill={p.dark} d="M54 102 H66 L60 114 Z" />
          <rect {...S(p)} x={62} y={22} width={36} height={22} rx={5} fill={p.second} />
          <rect {...S(p)} x={60} y={40} width={34} height={46} rx={15} fill={p.skin} />
          <rect {...SF(p)} x={66} y={74} width={26} height={12} rx={6} fill={p.skin} />
          <rect {...SF(p)} x={66} y={64} width={28} height={12} rx={6} fill={p.skin} />
          <rect {...SF(p)} x={52} y={50} width={14} height={42} rx={7} fill={p.skin} />
        </g>
      </>
    ),
  },
];
