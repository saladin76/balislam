import React from "react";
import type { ElementDef, ElementPalette } from "../types";
import { L, S, tint } from "../helpers";

/**
 * النفس والمشاعر: رموز مجردة للمشاعر والحالات النفسية،
 * لأن الشخصيات بلا ملامح؛ فالقلب والرأس الظلي والرموز تحمل المعنى.
 */

/** تحجيم مسار مطلق (M L C Q A H V Z) مع إزاحة، حتى يبقى سمك الحد ثابتًا. */
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

/** قلب أساسي مركزه (60،59) بعرض 96 */
const HEART =
  "M60 104 C30 84 12 64 12 42 C12 24 26 14 40 14 C50 14 56 20 60 28 C64 20 70 14 80 14 C94 14 108 24 108 42 C108 64 90 84 60 104 Z";
const heart = (s: number, cx: number, cy: number) => tp(HEART, s, cx - 60 * s, cy - 59 * s);

/** رأس ظلي جانبي (يتجه لليمين) بلا ملامح */
const HEAD =
  "M40 110 L40 94 Q18 82 18 52 Q18 14 58 12 Q94 12 98 46 L105 61 Q107 67 101 68 L99 69 L100 79 Q100 88 90 88 L80 88 L80 110 Z";

/** لون الحرارة والغضب: أحمر/برتقالي في كل ثيم */
const hot = (p: ElementPalette) => (p.themeId === "night" ? p.second : p.main);
/** لون الكآبة والسحب الداكنة */
const gloom = (p: ElementPalette) => (p.style === "line" ? p.light : p.themeId === "night" ? p.water : p.dark);
/** خط فوق شكل مملوء: حبر في الخطي وفاتح في المسطح */
const onFill = (p: ElementPalette) => (p.style === "line" ? p.line : p.light);

const gear = (cx: number, cy: number, ro: number, ri: number, n: number) => {
  const st = (Math.PI * 2) / n;
  const pt = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * st - Math.PI / 2;
    pts.push(pt(ri, a - 0.34 * st), pt(ro, a - 0.2 * st), pt(ro, a + 0.2 * st), pt(ri, a + 0.34 * st));
  }
  return `M${pts.join(" L")} Z`;
};

const battery = (p: ElementPalette, level: number, fill: string) => (
  <>
    <rect {...S(p)} x={100} y={48} width={12} height={24} rx={4} fill={tint(p, p.dark)} />
    <rect {...S(p)} x={8} y={32} width={96} height={56} rx={12} fill={tint(p, p.dark)} />
    <rect x={17} y={41} width={78} height={38} rx={6} fill={p.style === "line" ? "none" : p.light} opacity={p.style === "line" ? 1 : 0.9} />
    {[0, 1, 2, 3].slice(0, level).map((i) => (
      <rect key={i} {...S(p)} x={22 + i * 18} y={46} width={14} height={28} rx={3} fill={fill} />
    ))}
  </>
);

export const elements: ElementDef[] = [
  {
    id: "heart",
    nameAr: "قلب",
    category: "mind",
    tags: ["قلب", "حب", "مشاعر", "إيمان"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d={HEART} />
        <path d="M26 40 Q28 28 40 26" stroke={p.light} strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.7} />
      </>
    ),
  },
  {
    id: "heart-broken",
    nameAr: "قلب مكسور",
    category: "mind",
    tags: ["حزن", "انكسار", "خذلان", "ألم"],
    draw: (p) => {
      const left = "M60 104 C30 84 12 64 12 42 C12 24 26 14 40 14 C50 14 56 20 60 28 L52 46 L64 62 L54 80 Z";
      const right = "M60 28 C64 20 70 14 80 14 C94 14 108 24 108 42 C108 64 90 84 60 104 L54 80 L64 62 L52 46 Z";
      return (
        <>
          <path {...S(p)} fill={p.main} d={tp(left, 0.86, 2.4, 10)} transform="translate(-6 0) rotate(-7 60 100)" />
          <path {...S(p)} fill={p.main} d={tp(right, 0.86, 9.4, 10)} transform="translate(6 0) rotate(7 60 100)" />
        </>
      );
    },
  },
  {
    id: "heart-calm",
    nameAr: "قلب مطمئن",
    category: "mind",
    tags: ["طمأنينة", "سكينة", "راحة", "هدوء"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d={HEART} />
        <path
          {...L(p, 5)}
          stroke={onFill(p)}
          d="M30 50 Q38 43 46 50 Q54 57 62 50 Q70 43 78 50 Q86 57 92 50 M40 70 Q47 64 54 70 Q61 76 68 70 Q75 64 82 70"
        />
      </>
    ),
  },
  {
    id: "heart-bandaged",
    nameAr: "قلب مضمّد",
    category: "mind",
    tags: ["شفاء", "جبر الخاطر", "تعافٍ", "مواساة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d={HEART} />
        <g transform="rotate(-35 60 54)">
          <rect {...S(p)} x={22} y={43} width={76} height={22} rx={10} fill={p.light} />
          <rect {...S(p)} x={49} y={43} width={22} height={22} rx={3} fill={p.accent} />
          <path {...L(p, 3)} d="M32 50 V58 M40 50 V58 M80 50 V58 M88 50 V58" opacity={0.45} />
        </g>
      </>
    ),
  },
  {
    id: "heart-light",
    nameAr: "قلب منير",
    category: "mind",
    tags: ["نور", "إيمان", "هداية", "صفاء"],
    draw: (p) => {
      const rays = [-170, -140, -110, -90, -70, -40, -10, 20, 160]
        .map((a) => {
          const r = (a * Math.PI) / 180;
          return `M${(60 + 42 * Math.cos(r)).toFixed(1)} ${(58 + 42 * Math.sin(r)).toFixed(1)} L${(60 + 54 * Math.cos(r)).toFixed(1)} ${(58 + 54 * Math.sin(r)).toFixed(1)}`;
        })
        .join(" ");
      return (
        <>
          <path {...L(p, 6)} stroke={p.style === "line" ? p.line : p.metal} d={rays} />
          <path {...S(p)} fill={p.main} d={heart(0.66, 60, 62)} />
          <path d="M42 54 Q43 46 51 45" stroke={p.light} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.7} />
        </>
      );
    },
  },
  {
    id: "head-profile",
    nameAr: "رأس جانبي",
    category: "mind",
    tags: ["عقل", "تفكير", "نفس", "إنسان"],
    note: "صورة ظلية بلا ملامح؛ يمكن وضع رموز أخرى فوقها.",
    draw: (p) => <path {...S(p)} fill={p.second} d={HEAD} />,
  },
  {
    id: "head-storm",
    nameAr: "رأس فيه غيمة",
    category: "mind",
    tags: ["هم", "قلق", "اكتئاب", "ضيق"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d={HEAD} />
        <path
          {...S(p)}
          fill={gloom(p)}
          d="M34 60 Q24 60 24 51 Q24 42 34 41 Q36 29 50 29 Q62 26 67 37 Q79 35 81 47 Q87 51 83 60 Z"
        />
        <path {...S(p)} fill={p.metal} d="M56 56 L46 72 H55 L50 86 L68 66 H59 L64 56 Z" />
      </>
    ),
  },
  {
    id: "head-gears",
    nameAr: "رأس يفكر",
    category: "mind",
    tags: ["تفكير", "تدبر", "عقل", "تخطيط"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d={HEAD} />
        <path {...S(p)} fill={p.light} d={gear(48, 44, 19, 14, 8)} />
        <circle {...S(p)} cx={48} cy={44} r={6} fill={p.second} />
        <path {...S(p)} fill={p.light} d={gear(74, 64, 13, 9.5, 7)} />
        <circle {...S(p)} cx={74} cy={64} r={4} fill={p.second} />
      </>
    ),
  },
  {
    id: "head-tangle",
    nameAr: "رأس مشوش",
    category: "mind",
    tags: ["تشتت", "حيرة", "وسواس", "كثرة التفكير"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d={HEAD} />
        <path
          {...L(p, 4)}
          stroke={onFill(p)}
          d="M32 52 C34 28 72 22 76 42 C80 62 40 66 42 46 C44 30 84 32 82 56 C80 74 46 72 50 54 C53 42 70 44 66 58 C62 70 34 64 34 52"
        />
      </>
    ),
  },
  {
    id: "head-idea",
    nameAr: "رأس فيه فكرة",
    category: "mind",
    tags: ["فكرة", "إلهام", "وعي", "فهم"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d={HEAD} />
        <path {...S(p)} fill={p.metal} d="M57 22 Q76 22 76 40 Q76 50 67 57 V62 H47 V57 Q38 50 38 40 Q38 22 57 22 Z" />
        <rect {...S(p)} x={47} y={64} width={20} height={6} rx={2} fill={p.dark} />
        <rect {...S(p)} x={50} y={72} width={14} height={6} rx={3} fill={p.dark} />
        <path {...L(p, 3)} d="M51 56 V45 Q57 40 63 45 V56" opacity={0.5} />
      </>
    ),
  },
  {
    id: "head-sprout",
    nameAr: "رأس ينبت",
    category: "mind",
    tags: ["نمو", "تزكية", "تطور", "تعلم"],
    draw: (p) => (
      <>
        <path {...L(p, 5)} stroke={p.style === "line" ? p.line : p.green} d="M50 44 Q48 30 52 14" />
        <path {...S(p)} fill={p.green} d="M50 26 Q32 28 24 12 Q42 6 50 26 Z" />
        <path {...S(p)} fill={p.green} d="M52 18 Q60 2 82 6 Q78 24 52 18 Z" />
        <path {...S(p)} fill={p.second === p.green ? p.main : p.second} d={tp(HEAD, 0.78, 13, 24.2)} />
      </>
    ),
  },
  {
    id: "weight-burden",
    nameAr: "ثقل وعبء",
    category: "mind",
    tags: ["عبء", "هم", "ثقل", "ذنوب", "ضغط"],
    draw: (p) => (
      <>
        <path {...L(p, 10)} stroke={p.edge} d="M44 48 V38 Q44 20 60 20 Q76 20 76 38 V48" />
        <path {...S(p)} fill={gloom(p)} d="M30 44 H90 Q96 44 98 50 L110 98 Q112 106 104 106 H16 Q8 106 10 98 L22 50 Q24 44 30 44 Z" />
        <path d="M30 58 L24 92" stroke={p.light} strokeWidth={5} strokeLinecap="round" opacity={p.style === "line" ? 0 : 0.35} />
      </>
    ),
  },
  {
    id: "anchor-steady",
    nameAr: "مرساة",
    category: "mind",
    tags: ["ثبات", "رسوخ", "يقين", "استقرار"],
    draw: (p) => {
      const c = p.style === "line" ? p.line : p.main;
      return (
        <>
          <circle cx={60} cy={20} r={10} fill="none" stroke={c} strokeWidth={7} />
          <path d="M18 70 Q22 104 60 106 Q98 104 102 70" fill="none" stroke={c} strokeWidth={10} strokeLinecap="round" />
          <rect {...S(p)} x={54} y={28} width={12} height={76} rx={5} fill={p.main} />
          <rect {...S(p)} x={34} y={38} width={52} height={11} rx={5.5} fill={p.main} />
          <path {...S(p)} fill={p.main} d="M8 78 L18 58 L30 74 Z" />
          <path {...S(p)} fill={p.main} d="M112 78 L102 58 L90 74 Z" />
        </>
      );
    },
  },
  {
    id: "chain-broken",
    nameAr: "قيد مكسور",
    category: "mind",
    tags: ["تحرر", "ترك العادة", "انعتاق", "توبة"],
    draw: (p) => {
      const c = p.style === "line" ? p.line : p.metal;
      return (
        <g transform="rotate(-20 60 60)">
          <rect x={4} y={48} width={34} height={24} rx={12} fill="none" stroke={c} strokeWidth={8} />
          <path d="M50 50 H38 Q28 50 28 60 Q28 70 38 70 H50" fill="none" stroke={c} strokeWidth={8} strokeLinecap="round" />
          <path d="M70 50 H82 Q92 50 92 60 Q92 70 82 70 H70" fill="none" stroke={c} strokeWidth={8} strokeLinecap="round" />
          <rect x={82} y={48} width={34} height={24} rx={12} fill="none" stroke={c} strokeWidth={8} />
          <path {...L(p, 4)} stroke={p.edge} d="M60 38 V30 M52 40 L47 34 M68 40 L73 34 M60 82 V90 M52 80 L47 86 M68 80 L73 86" />
        </g>
      );
    },
  },
  {
    id: "cage-open",
    nameAr: "قفص مفتوح",
    category: "mind",
    tags: ["حرية", "انطلاق", "تحرر", "خروج"],
    draw: (p) => (
      <>
        <path {...L(p, 4)} stroke={p.edge} d="M14 92 V50 Q14 20 46 18 Q78 20 78 50 V92 M30 92 V50 Q31 26 46 18 M62 92 V50 Q61 26 46 18 M46 18 V40 M46 8 V18" />
        <circle cx={46} cy={10} r={4} fill="none" stroke={p.edge} strokeWidth={3.5} />
        <rect {...S(p)} x={6} y={90} width={80} height={14} rx={5} fill={p.main} />
        <rect {...S(p)} x={10} y={44} width={72} height={8} rx={4} fill={p.main} />
        <path {...L(p, 4)} stroke={p.edge} d="M40 56 H58 V88 H40 Z" opacity={0.35} />
        <path {...S(p)} fill={p.second} d="M40 56 L26 62 V94 L40 88 Z" opacity={0.95} />
        <path {...S(p)} fill={p.second} d="M84 36 Q92 24 100 32 Q108 22 116 30 Q108 28 100 38 Q92 28 84 36 Z" />
        <path {...S(p)} fill={p.second} d="M70 64 Q76 56 82 62 Q88 54 94 60 Q88 59 82 67 Q76 61 70 64 Z" />
      </>
    ),
  },
  {
    id: "balloon-rising",
    nameAr: "بالون يرتفع",
    category: "mind",
    tags: ["خفة", "فرح", "انطلاق", "أمل"],
    draw: (p) => (
      <>
        <path {...L(p, 3)} stroke={p.edge} d="M58 86 Q50 96 58 104 Q64 110 56 116" />
        <path {...S(p)} fill={p.main} d="M58 8 Q88 8 88 40 Q88 66 62 80 L58 82 L54 80 Q28 66 28 40 Q28 8 58 8 Z" />
        <path {...S(p)} fill={p.main} d="M53 88 L58 80 L63 88 Z" />
        <path d="M40 34 Q42 22 52 19" stroke={p.light} strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.7} />
        <path {...L(p, 4)} stroke={p.edge} d="M98 62 V80 M106 52 V64 M18 66 V82" opacity={0.6} />
      </>
    ),
  },
  {
    id: "path-fork",
    nameAr: "مفترق طرق",
    category: "mind",
    tags: ["اختيار", "قرار", "حيرة", "طريق"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={tint(p, p.dark)} d="M38 112 L50 68 L12 24 L30 12 L60 50 L90 12 L108 24 L70 68 L82 112 Z" />
        <path
          d="M60 106 V74 M55 60 L26 24 M65 60 L94 24"
          stroke={p.style === "line" ? p.line : p.light}
          strokeWidth={4}
          strokeDasharray="8 8"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
  {
    id: "signpost",
    nameAr: "لافتة اتجاهات",
    category: "mind",
    tags: ["اتجاه", "اختيار", "طريق", "هداية"],
    draw: (p) => (
      <>
        <path {...L(p, 5)} stroke={p.edge} d="M36 110 H84" />
        <rect {...S(p)} x={54} y={12} width={12} height={98} rx={4} fill={p.wood} />
        <path {...S(p)} fill={p.main} d="M10 30 L22 18 H94 Q98 18 98 22 V38 Q98 42 94 42 H22 Z" />
        <path {...S(p)} fill={p.second} d="M110 64 L98 52 H26 Q22 52 22 56 V72 Q22 76 26 76 H98 Z" />
        <path {...L(p, 3)} stroke={onFill(p)} d="M30 30 H84 M36 64 H90" opacity={0.6} />
      </>
    ),
  },
  {
    id: "door-light",
    nameAr: "باب يشع نورًا",
    category: "mind",
    tags: ["أمل", "فرج", "فرصة", "بداية"],
    draw: (p) => (
      <>
        <path fill={p.metal} opacity={0.4} d="M38 104 H92 L114 116 H44 Z" />
        <rect {...S(p)} x={38} y={10} width={54} height={94} rx={3} fill={p.metal} />
        <path {...L(p, 4)} stroke={p.style === "line" ? p.line : p.light} d="M52 24 L78 50 M58 46 L76 64" opacity={0.6} />
        <path {...S(p)} fill={p.main} d="M38 10 L18 18 V110 L38 104 Z" />
        <circle cx={32} cy={60} r={3.5} fill={p.style === "line" ? p.line : p.metal} />
      </>
    ),
  },
  {
    id: "tunnel-light",
    nameAr: "نور في آخر النفق",
    category: "mind",
    tags: ["أمل", "فرج", "صبر", "نهاية الشدة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={tint(p, p.dark)} d="M10 108 V60 A50 50 0 0 1 110 60 V108 Z" />
        <path {...S(p)} fill={p.shadow} d="M26 108 V66 A34 34 0 0 1 94 66 V108 Z" />
        <path fill={p.metal} opacity={0.35} d="M48 88 H72 L94 108 H26 Z" />
        <circle cx={60} cy={76} r={22} fill={p.metal} opacity={0.25} />
        <path {...S(p)} fill={p.metal} d="M48 88 V74 A12 12 0 0 1 72 74 V88 Z" />
        <path {...L(p, 3)} stroke={p.style === "line" ? p.line : p.light} d="M10 108 L48 88 M110 108 L72 88" opacity={0.3} />
      </>
    ),
  },
  {
    id: "bridge-crossing",
    nameAr: "جسر",
    category: "mind",
    tags: ["عبور", "تجاوز", "صلة", "وصول"],
    draw: (p) => (
      <>
        <path {...L(p, 4)} stroke={p.edge} d="M8 36 H112 M20 36 V50 M40 36 V50 M60 36 V50 M80 36 V50 M100 36 V50" />
        <path {...S(p)} fill={p.second} d="M6 48 H114 V108 H94 Q94 68 60 68 Q26 68 26 108 H6 Z" />
        <path {...L(p, 3)} stroke={onFill(p)} d="M6 58 H114" opacity={0.5} />
        <path {...L(p, 4)} stroke={p.style === "line" ? p.line : p.water} d="M34 100 Q40 95 46 100 Q52 105 58 100 Q64 95 70 100 Q76 105 82 100 Q86 97 88 98" />
      </>
    ),
  },
  {
    id: "footprints",
    nameAr: "آثار أقدام",
    category: "mind",
    tags: ["خطوات", "مسير", "أثر", "رحلة"],
    draw: (p) => {
      const foot = (x: number, y: number, r: number, o: number) => (
        <g transform={`rotate(${r} ${x} ${y + 8})`} opacity={o}>
          <ellipse {...S(p)} cx={x} cy={y} rx={7.5} ry={11.5} fill={p.main} />
          <ellipse {...S(p)} cx={x} cy={y + 18} rx={6} ry={5.5} fill={p.main} />
        </g>
      );
      return (
        <>
          {foot(42, 84, -10, 1)}
          {foot(76, 62, 10, 1)}
          {foot(44, 38, -10, 0.75)}
          {foot(78, 16, 10, 0.5)}
        </>
      );
    },
  },
  {
    id: "mountain-flag",
    nameAr: "قمة وراية",
    category: "mind",
    tags: ["هدف", "طموح", "إنجاز", "وصول"],
    draw: (p) => (
      <>
        <path {...L(p, 4)} stroke={p.edge} d="M54 30 V8" />
        <path {...S(p)} fill={p.main} d="M56 8 L78 14 L56 21 Z" />
        <path {...S(p)} fill={p.second} d="M6 108 L48 36 Q54 26 60 36 L76 62 L84 52 Q88 47 92 52 L114 108 Z" />
        <path {...S(p)} fill={p.light} d="M38 54 L48 36 Q54 26 60 36 L70 52 L62 58 L55 50 L46 58 Z" />
      </>
    ),
  },
  {
    id: "stairs-up",
    nameAr: "درج صاعد",
    category: "mind",
    tags: ["تقدم", "ترقٍّ", "تدرج", "خطوات"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d="M8 108 V88 H33 V68 H58 V48 H83 V28 H110 V108 Z" />
        <path {...L(p, 3)} stroke={onFill(p)} d="M33 88 V108 M58 68 V108 M83 48 V108" opacity={0.35} />
        <path {...L(p, 6)} stroke={p.edge} d="M12 70 L54 28" />
        <path {...S(p)} fill={p.main} d="M44 18 L66 16 L64 38 Z" />
      </>
    ),
  },
  {
    id: "energy-low",
    nameAr: "طاقة منخفضة",
    category: "mind",
    tags: ["تعب", "إرهاق", "فتور", "ضعف"],
    draw: (p) => battery(p, 1, hot(p)),
  },
  {
    id: "energy-half",
    nameAr: "طاقة متوسطة",
    category: "mind",
    tags: ["توسط", "جهد", "استمرار"],
    draw: (p) => battery(p, 2, p.metal),
  },
  {
    id: "energy-full",
    nameAr: "طاقة كاملة",
    category: "mind",
    tags: ["نشاط", "همة", "قوة", "حماس"],
    draw: (p) => battery(p, 4, p.green),
  },
  {
    id: "hourglass-patience",
    nameAr: "ساعة رملية",
    category: "mind",
    tags: ["صبر", "وقت", "انتظار", "عمر"],
    draw: (p) => (
      <>
        <path {...L(p, 5)} stroke={p.style === "line" ? p.line : p.wood} d="M27 16 V104 M93 16 V104" />
        <path {...S(p)} fill={p.water} opacity={p.style === "line" ? 1 : 0.45} d="M34 18 H86 Q86 44 64 60 Q86 76 86 102 H34 Q34 76 56 60 Q34 44 34 18 Z" />
        <path {...S(p)} fill={p.metal} d="M44 36 H76 Q72 48 60 56 Q48 48 44 36 Z" />
        <path d="M60 58 V82" stroke={p.style === "line" ? p.line : p.metal} strokeWidth={2.5} />
        <path {...S(p)} fill={p.metal} d="M38 100 Q42 82 60 80 Q78 82 82 100 Z" />
        <rect {...S(p)} x={20} y={8} width={80} height={12} rx={4} fill={p.wood} />
        <rect {...S(p)} x={20} y={100} width={80} height={12} rx={4} fill={p.wood} />
      </>
    ),
  },
  {
    id: "mirror-reflect",
    nameAr: "مرآة",
    category: "mind",
    tags: ["محاسبة النفس", "تأمل", "مراجعة", "ذات"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={52} y={88} width={16} height={14} rx={3} fill={p.wood} />
        <rect {...S(p)} x={30} y={100} width={60} height={10} rx={5} fill={p.wood} />
        <ellipse {...S(p)} cx={60} cy={50} rx={34} ry={42} fill={p.main} />
        <ellipse {...S(p)} cx={60} cy={50} rx={25} ry={33} fill={p.water} />
        <path d="M44 42 L60 24 M46 58 L70 32" stroke={p.light} strokeWidth={5} strokeLinecap="round" opacity={p.style === "line" ? 1 : 0.7} />
      </>
    ),
  },
  {
    id: "mask-hypocrisy",
    nameAr: "قناع",
    category: "mind",
    tags: ["نفاق", "رياء", "تظاهر", "خداع"],
    note: "قناع مجرد بلا ملامح تعبيرية.",
    draw: (p) => (
      <>
        <path {...L(p, 6)} stroke={p.edge} d="M94 70 L106 112" />
        <path
          {...S(p)}
          fill={p.main}
          fillRule="evenodd"
          d="M8 44 Q30 28 60 40 Q90 28 112 44 Q110 70 88 74 Q72 76 60 64 Q48 76 32 74 Q10 70 8 44 Z M24 52 Q36 42 49 53 Q36 61 24 52 Z M96 52 Q84 42 71 53 Q84 61 96 52 Z"
        />
        <path {...L(p, 3)} stroke={onFill(p)} d="M18 42 Q30 36 44 38 M102 42 Q90 36 76 38" opacity={0.6} />
      </>
    ),
  },
  {
    id: "fire-anger",
    nameAr: "لهب الغضب",
    category: "mind",
    tags: ["غضب", "شهوة", "انفعال", "حرارة"],
    draw: (p) => (
      <>
        <path
          {...S(p)}
          fill={hot(p)}
          d="M60 112 Q22 110 22 74 Q22 52 40 32 Q42 48 52 52 Q48 28 66 8 Q70 30 86 44 Q100 58 98 78 Q96 110 60 112 Z"
        />
        <path {...S(p)} fill={p.metal} d="M60 108 Q40 106 40 86 Q40 72 52 62 Q54 74 62 76 Q60 64 70 54 Q82 70 80 88 Q78 106 60 108 Z" />
      </>
    ),
  },
  {
    id: "ice-cold",
    nameAr: "مكعب ثلج",
    category: "mind",
    tags: ["برود", "جفاء", "قسوة", "تبلد"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.water} d="M18 38 L60 60 V108 L18 86 Z" />
        <path {...S(p)} fill={p.water} d="M60 60 L102 38 V86 L60 108 Z" />
        <path fill={p.style === "line" ? "none" : p.dark} opacity={0.15} d="M60 60 L102 38 V86 L60 108 Z" />
        <path {...S(p)} fill={p.style === "line" ? p.light : p.water} d="M60 16 L102 38 L60 60 L18 38 Z" />
        <path fill={p.style === "line" ? "none" : p.light} opacity={0.5} d="M60 16 L102 38 L60 60 L18 38 Z" />
        <path d="M28 54 V76 M74 64 L90 56" stroke={p.light} strokeWidth={5} strokeLinecap="round" opacity={p.style === "line" ? 0 : 0.7} />
        <path {...L(p, 3)} stroke={p.style === "line" ? p.line : p.edge} d="M100 4 V20 M92 12 H108 M94 6 L106 18 M106 6 L94 18" />
      </>
    ),
  },
  {
    id: "cloud-storm",
    nameAr: "غيمة عاصفة",
    category: "mind",
    tags: ["هم", "كرب", "ابتلاء", "شدة"],
    draw: (p) => (
      <>
        <path {...L(p, 5)} stroke={p.style === "line" ? p.line : p.water} d="M28 82 L22 96 M44 82 L38 96 M84 82 L78 96 M98 82 L92 96" />
        <path
          {...S(p)}
          fill={gloom(p)}
          d="M28 76 Q10 76 10 60 Q10 44 26 42 Q28 20 52 20 Q66 14 78 26 Q100 24 104 46 Q114 52 110 66 Q106 76 94 76 Z"
        />
        <path {...S(p)} fill={p.metal} d="M64 60 L50 84 H62 L56 108 L80 76 H67 L74 60 Z" />
      </>
    ),
  },
  {
    id: "sun-hope",
    nameAr: "شمس مشرقة",
    category: "mind",
    tags: ["أمل", "بداية جديدة", "تفاؤل", "فجر"],
    draw: (p) => {
      const rays = [-165, -140, -115, -90, -65, -40, -15]
        .map((a) => {
          const r = (a * Math.PI) / 180;
          return `M${(60 + 40 * Math.cos(r)).toFixed(1)} ${(78 + 40 * Math.sin(r)).toFixed(1)} L${(60 + 54 * Math.cos(r)).toFixed(1)} ${(78 + 54 * Math.sin(r)).toFixed(1)}`;
        })
        .join(" ");
      return (
        <>
          <path {...L(p, 6)} stroke={p.style === "line" ? p.line : p.metal} d={rays} />
          <path {...S(p)} fill={p.metal} d="M28 80 A32 32 0 0 1 92 80 Z" />
          <path {...S(p)} fill={p.green} d="M8 84 Q60 74 112 84 V100 Q112 108 104 108 H16 Q8 108 8 100 Z" />
        </>
      );
    },
  },
  {
    id: "maze",
    nameAr: "متاهة",
    category: "mind",
    tags: ["حيرة", "ضياع", "تعقيد", "بحث عن مخرج"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={8} y={8} width={104} height={104} rx={12} fill={p.second} />
        <path
          {...L(p, 6)}
          stroke={onFill(p)}
          d="M38 20 H100 V100 H56 M38 100 H20 V20 M38 20 V56 H56 M20 82 H38 V64 M56 20 V38 H74 M74 56 V82 H56 V64 M92 38 V64 M74 100 V82 H92"
        />
        <circle cx={65} cy={47} r={5} fill={p.style === "line" ? p.line : p.main} />
      </>
    ),
  },
  {
    id: "scale-heart",
    nameAr: "ميزان القلب",
    category: "mind",
    tags: ["ميزان", "عدل", "أولويات", "دنيا وآخرة"],
    draw: (p) => (
      <>
        <path {...L(p, 6)} stroke={p.edge} d="M60 26 V100 M18 38 L102 22" />
        <path {...L(p, 2.5)} stroke={p.edge} d="M18 38 L7 78 M18 38 L31 78 M102 22 L91 58 M102 22 L113 58" />
        <path {...S(p)} fill={p.main} d={heart(0.24, 19, 66)} />
        <path {...S(p)} fill={p.metal} d="M4 78 H34 Q32 88 19 88 Q6 88 4 78 Z" />
        <circle {...S(p)} cx={102} cy={51} r={6} fill={p.metal} />
        <path {...S(p)} fill={p.metal} d="M88 58 H116 Q114 68 102 68 Q90 68 88 58 Z" />
        <circle {...S(p)} cx={60} cy={28} r={6} fill={p.metal} />
        <path {...S(p)} fill={p.metal} d="M40 110 Q40 98 60 98 Q80 98 80 110 Z" />
      </>
    ),
  },
  {
    id: "shield-heart",
    nameAr: "درع القلب",
    category: "mind",
    tags: ["حماية", "تحصين", "وقاية", "حفظ"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d="M60 8 L102 22 V56 Q102 92 60 112 Q18 92 18 56 V22 Z" />
        <path {...L(p, 3)} stroke={onFill(p)} d="M60 18 L92 29 V56 Q92 85 60 101 Q28 85 28 56 V29 Z" opacity={0.5} />
        <path {...S(p)} fill={p.main} d={heart(0.42, 60, 58)} />
      </>
    ),
  },
  {
    id: "puzzle-piece",
    nameAr: "قطعة أحجية",
    category: "mind",
    tags: ["نقص", "تكامل", "حل", "انتماء"],
    draw: (p) => (
      <path
        {...S(p)}
        fill={p.main}
        d="M14 32 H44 Q38 24 44 16 Q52 8 62 14 Q72 22 64 32 H96 V58 Q104 52 110 58 Q116 66 110 74 Q104 80 96 74 V104 H64 Q70 96 64 90 Q56 84 48 90 Q42 96 46 104 H14 Z"
      />
    ),
  },
  {
    id: "magnet-pull",
    nameAr: "مغناطيس",
    category: "mind",
    tags: ["جذب", "شهوات", "فتنة", "تعلق"],
    draw: (p) => (
      <>
        <path {...L(p, 4)} stroke={p.edge} d="M86 46 Q94 60 86 74 M98 36 Q110 60 98 84" opacity={0.7} />
        <path {...S(p)} fill={hot(p)} d="M60 14 H44 Q10 14 10 60 Q10 106 44 106 H60 V84 H46 Q34 84 34 60 Q34 36 46 36 H60 Z" />
        <rect {...S(p)} x={58} y={14} width={18} height={22} rx={3} fill={p.style === "line" ? p.second : p.light} />
        <rect {...S(p)} x={58} y={84} width={18} height={22} rx={3} fill={p.style === "line" ? p.second : p.light} />
        <circle {...S(p)} cx={110} cy={60} r={7} fill={p.metal} />
      </>
    ),
  },
];
