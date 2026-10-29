import React from "react";
import type { ElementDef, ElementPalette } from "../types";
import { L, S, tint } from "../helpers";

/**
 * البيت والأسرة: مبانٍ وأثاث وأدوات منزلية وألعاب.
 * على نهج ui.tsx: مساحة 120×120، أشكال ممتلئة مستديرة، تفاصيل بخطوط L(p).
 */

/** لون خط: حبر في الثيم الخطي، ولون معيّن في المسطح */
const ln = (p: ElementPalette, flat: string) => (p.style === "line" ? p.line : flat);

const house = (p: ElementPalette, warm: boolean) => (
  <>
    {warm && <rect {...S(p)} x={76} y={26} width={14} height={26} rx={2} fill={p.wood} />}
    {warm && (
      <>
        <circle {...S(p)} cx={86} cy={16} r={6} fill={tint(p, p.edge)} fillOpacity={p.style === "line" ? 1 : 0.35} />
        <circle {...S(p)} cx={97} cy={8} r={4.5} fill={tint(p, p.edge)} fillOpacity={p.style === "line" ? 1 : 0.25} />
      </>
    )}
    <rect {...S(p)} x={22} y={56} width={76} height={52} rx={3} fill={p.light} />
    <path {...S(p)} fill={p.main} d="M60 20 L109 58 Q112 62 106 62 H14 Q8 62 11 58 Z" />
    <path {...S(p)} fill={p.wood} d="M50 108 V86 Q50 76 60 76 Q70 76 70 86 V108 Z" />
    <circle cx={65} cy={94} r={2.5} fill={ln(p, p.dark)} />
    {[30, 76].map((x) => (
      <g key={x}>
        <rect {...S(p)} x={x} y={72} width={14} height={16} rx={2} fill={warm ? p.metal : p.water} />
        <path {...L(p, 2.5)} d={`M${x + 7} 72 V88 M${x} 80 H${x + 14}`} opacity={0.6} />
      </g>
    ))}
    {!warm && <path {...L(p, 2.5)} d="M22 62 H98" opacity={0.3} />}
  </>
);

export const elements: ElementDef[] = [
  {
    id: "house",
    nameAr: "بيت",
    category: "home",
    tags: ["بيت", "منزل", "أسرة", "مسكن"],
    draw: (p) => house(p, false),
  },
  {
    id: "house-warm",
    nameAr: "بيت دافئ",
    category: "home",
    tags: ["بيت", "دفء", "أسرة", "سكينة", "مدخنة"],
    draw: (p) => house(p, true),
  },
  {
    id: "door",
    nameAr: "باب",
    category: "home",
    tags: ["باب", "دخول", "بيت", "استئذان"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={26} y={8} width={68} height={100} rx={4} fill={p.dark} />
        <path {...S(p)} fill={p.wood} d="M34 108 V44 Q34 16 60 16 Q86 16 86 44 V108 Z" />
        <path {...L(p, 3)} d="M44 52 Q44 28 60 28 Q76 28 76 52 V64 H44 Z M44 74 H76 V98 H44 Z" opacity={0.45} />
        <circle {...S(p)} cx={78} cy={68} r={4} fill={p.metal} />
        <rect {...S(p)} x={16} y={106} width={88} height={8} rx={3} fill={p.dark} />
      </>
    ),
  },
  {
    id: "door-open",
    nameAr: "باب مفتوح",
    category: "home",
    tags: ["باب", "فتح", "ترحيب", "فرصة", "خروج"],
    draw: (p) => (
      <>
        <path fill={p.metal} opacity={0.35} d="M42 106 H90 L112 116 H34 Z" />
        <rect {...S(p)} x={36} y={8} width={60} height={100} rx={4} fill={p.dark} />
        <rect {...S(p)} x={44} y={16} width={44} height={92} rx={2} fill={p.metal} />
        <path {...S(p)} fill={p.wood} d="M44 16 L18 26 V102 L44 108 Z" />
        <path {...L(p, 3)} d="M24 34 L38 30 V58 L24 60 Z M24 70 L38 69 V96 L24 96 Z" opacity={0.45} />
        <circle {...S(p)} cx={24} cy={66} r={3.5} fill={ln(p, p.dark)} />
      </>
    ),
  },
  {
    id: "window",
    nameAr: "نافذة",
    category: "home",
    tags: ["نافذة", "شباك", "نور", "إطلالة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.wood} d="M20 100 V50 Q20 10 60 10 Q100 10 100 50 V100 Z" />
        <path {...S(p)} fill={p.water} d="M30 96 V52 Q30 20 60 20 Q90 20 90 52 V96 Z" />
        <path {...L(p, 6)} stroke={ln(p, p.wood)} d="M60 20 V96 M30 60 H90" />
        <path d="M38 50 Q42 34 54 28" stroke={p.light} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.7} />
        <rect {...S(p)} x={12} y={98} width={96} height={12} rx={4} fill={p.wood} />
      </>
    ),
  },
  {
    id: "table",
    nameAr: "طاولة",
    category: "home",
    tags: ["طاولة", "مائدة", "أثاث"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={20} y={56} width={10} height={52} rx={3} fill={p.wood} />
        <rect {...S(p)} x={90} y={56} width={10} height={52} rx={3} fill={p.wood} />
        <rect {...S(p)} x={26} y={56} width={68} height={10} rx={2} fill={p.wood} />
        <path {...L(p, 3)} d="M26 66 H94" opacity={0.3} />
        <rect {...S(p)} x={8} y={44} width={104} height={14} rx={5} fill={p.wood} />
        <path {...S(p)} fill={p.main} d="M46 44 V34 Q46 28 52 28 H68 Q74 28 74 34 V44 Z" />
        <path {...S(p)} fill={p.green} d="M60 30 Q50 18 54 8 Q62 16 60 30 Z M60 30 Q70 18 70 10 Q60 16 60 30 Z" />
      </>
    ),
  },
  {
    id: "chair",
    nameAr: "كرسي",
    category: "home",
    tags: ["كرسي", "جلوس", "أثاث"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={28} y={76} width={9} height={34} rx={3} fill={p.wood} />
        <rect {...S(p)} x={83} y={76} width={9} height={34} rx={3} fill={p.wood} />
        <rect {...S(p)} x={32} y={50} width={8} height={18} fill={p.wood} />
        <rect {...S(p)} x={80} y={50} width={8} height={18} fill={p.wood} />
        <rect {...S(p)} x={28} y={8} width={64} height={48} rx={12} fill={p.main} />
        <path {...L(p, 3)} d="M42 22 V44 M60 22 V44 M78 22 V44" opacity={0.35} />
        <rect {...S(p)} x={20} y={64} width={80} height={14} rx={6} fill={p.wood} />
      </>
    ),
  },
  {
    id: "sofa",
    nameAr: "أريكة",
    category: "home",
    tags: ["أريكة", "كنبة", "جلسة", "راحة"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={20} y={92} width={8} height={14} rx={2} fill={p.dark} />
        <rect {...S(p)} x={92} y={92} width={8} height={14} rx={2} fill={p.dark} />
        <rect {...S(p)} x={16} y={30} width={88} height={46} rx={14} fill={p.main} />
        <rect {...S(p)} x={22} y={68} width={76} height={26} rx={6} fill={p.main} />
        <path {...L(p, 3)} d="M60 36 V70 M60 70 V92" opacity={0.35} />
        <rect {...S(p)} x={6} y={52} width={22} height={44} rx={10} fill={p.main} />
        <rect {...S(p)} x={92} y={52} width={22} height={44} rx={10} fill={p.main} />
        <rect {...S(p)} x={30} y={44} width={24} height={22} rx={7} fill={p.second} transform="rotate(-10 42 55)" />
        <rect {...S(p)} x={66} y={44} width={24} height={22} rx={7} fill={p.accent} transform="rotate(10 78 55)" />
      </>
    ),
  },
  {
    id: "bed",
    nameAr: "سرير",
    category: "home",
    tags: ["سرير", "نوم", "راحة", "ليل"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={8} y={30} width={16} height={80} rx={6} fill={p.wood} />
        <rect {...S(p)} x={98} y={60} width={14} height={50} rx={6} fill={p.wood} />
        <rect {...S(p)} x={20} y={66} width={80} height={28} rx={6} fill={p.light} />
        <path {...S(p)} fill={p.main} d="M50 62 H96 Q100 62 100 66 V94 H46 Q40 78 50 62 Z" />
        <path {...L(p, 3)} d="M56 70 H94" opacity={0.35} />
        <ellipse {...S(p)} cx={37} cy={60} rx={14} ry={9} fill={p.light} />
        <rect {...S(p)} x={20} y={94} width={80} height={8} rx={2} fill={p.wood} />
      </>
    ),
  },
  {
    id: "cradle",
    nameAr: "مهد طفل",
    category: "home",
    tags: ["مهد", "طفل", "رضيع", "أمومة", "ولادة"],
    draw: (p) => (
      <>
        <path {...L(p, 6)} stroke={p.edge} d="M40 88 L32 104 M80 88 L88 104" />
        <path {...L(p, 6)} stroke={p.edge} d="M12 100 Q60 118 108 100" />
        <path {...S(p)} fill={p.main} d="M16 50 Q16 16 52 16 Q58 16 58 22 V50 Z" />
        <path {...S(p)} fill={p.wood} d="M14 50 H106 Q104 94 60 94 Q16 94 14 50 Z" />
        <path {...L(p, 3)} d="M30 58 V82 M45 58 V90 M60 58 V92 M75 58 V90 M90 58 V82" opacity={0.3} />
        <rect {...S(p)} x={10} y={46} width={100} height={8} rx={4} fill={p.wood} />
        <path {...S(p)} fill={p.second} d="M60 46 Q66 34 80 36 Q94 36 100 46 Z" />
      </>
    ),
  },
  {
    id: "lamp-floor",
    nameAr: "مصباح أرضي",
    category: "home",
    tags: ["مصباح", "إنارة", "ضوء", "مساء"],
    draw: (p) => (
      <>
        <path fill={p.metal} opacity={0.25} d="M34 46 L14 96 H106 L86 46 Z" />
        <path {...L(p, 6)} stroke={p.edge} d="M60 46 V104" />
        <rect {...S(p)} x={38} y={102} width={44} height={9} rx={4} fill={p.dark} />
        <path {...S(p)} fill={p.metal} d="M42 10 H78 Q82 10 84 14 L96 44 Q97 48 92 48 H28 Q23 48 24 44 L36 14 Q38 10 42 10 Z" />
        <path {...L(p, 3)} d="M34 30 H86" opacity={0.3} />
      </>
    ),
  },
  {
    id: "lamp-desk",
    nameAr: "مصباح مكتب",
    category: "home",
    tags: ["مصباح", "مذاكرة", "سهر", "قراءة"],
    draw: (p) => (
      <>
        <path fill={p.metal} opacity={0.25} d="M72 52 L100 34 L114 108 H70 Z" />
        <path {...L(p, 7)} stroke={p.edge} d="M30 100 L22 58 L62 30" />
        <circle {...S(p)} cx={22} cy={58} r={5} fill={p.dark} />
        <rect {...S(p)} x={10} y={98} width={46} height={10} rx={4} fill={p.dark} />
        <g transform="rotate(35 78 38)">
          <path {...S(p)} fill={p.main} d="M68 22 H88 Q92 22 93 26 L102 50 H54 L63 26 Q64 22 68 22 Z" />
          <ellipse cx={78} cy={51} rx={14} ry={4} fill={p.metal} />
        </g>
        <circle {...S(p)} cx={62} cy={30} r={5} fill={p.dark} />
      </>
    ),
  },
  {
    id: "kettle",
    nameAr: "إبريق",
    category: "home",
    tags: ["إبريق", "شاي", "ضيافة", "مطبخ"],
    draw: (p) => (
      <>
        <path {...L(p, 8)} stroke={ln(p, p.dark)} d="M88 54 Q110 54 106 78 Q104 90 94 94" />
        <path {...S(p)} fill={p.metal} d="M30 66 L10 42 Q8 38 12 38 L18 40 L38 58 Z" />
        <path {...S(p)} fill={p.metal} d="M30 104 Q20 104 22 94 L30 52 Q32 42 42 42 H78 Q88 42 90 52 L98 94 Q100 104 90 104 Z" />
        <path {...L(p, 3)} d="M28 80 H92" opacity={0.3} />
        <path {...S(p)} fill={p.dark} d="M42 42 Q42 30 60 30 Q78 30 78 42 Z" />
        <circle {...S(p)} cx={60} cy={26} r={5} fill={p.dark} />
        <path d="M38 62 Q40 54 46 50" stroke={p.light} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.7} />
      </>
    ),
  },
  {
    id: "tea-glass",
    nameAr: "كأس شاي",
    category: "home",
    tags: ["شاي", "استكانة", "ضيافة", "جلسة"],
    draw: (p) => (
      <>
        <path {...L(p, 3)} stroke={p.edge} d="M50 18 Q45 12 50 6 M66 18 Q61 12 66 6" opacity={0.6} />
        <ellipse {...S(p)} cx={60} cy={104} rx={42} ry={8} fill={p.metal} />
        <path {...S(p)} fill={p.light} fillOpacity={p.style === "line" ? 1 : 0.55} d="M36 24 H84 Q82 46 72 60 Q82 78 82 100 H38 Q38 78 48 60 Q38 46 36 24 Z" />
        <path fill={p.style === "line" ? p.second : p.main} d="M39 38 H81 Q78 50 70 60 Q79 78 79 97 H41 Q41 78 50 60 Q42 50 39 38 Z" />
        {p.style === "line" && <path {...L(p, 2.5)} d="M39 38 H81" />}
        <path d="M46 70 Q44 80 45 90" stroke={p.light} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.7} />
      </>
    ),
  },
  {
    id: "cup",
    nameAr: "فنجان",
    category: "home",
    tags: ["كوب", "قهوة", "صباح", "مشروب"],
    draw: (p) => (
      <>
        <path {...L(p, 3)} stroke={p.edge} d="M46 30 Q40 22 46 14 M60 30 Q54 22 60 14" opacity={0.6} />
        <ellipse {...S(p)} cx={56} cy={104} rx={46} ry={8} fill={p.second} />
        <path {...L(p, 9)} stroke={ln(p, p.main)} d="M86 52 Q106 52 106 68 Q106 84 86 84" />
        <path {...S(p)} fill={p.main} d="M22 40 H90 V84 Q90 102 72 102 H40 Q22 102 22 84 Z" />
        <ellipse {...S(p)} cx={56} cy={40} rx={34} ry={6} fill={p.dark} />
        <path {...L(p, 3)} d="M30 56 H82" opacity={0.3} />
      </>
    ),
  },
  {
    id: "plate-food",
    nameAr: "طبق طعام",
    category: "home",
    tags: ["طعام", "أكل", "وجبة", "نعمة", "رزق"],
    draw: (p) => (
      <>
        <path {...L(p, 3)} stroke={p.edge} d="M44 34 Q38 26 44 18 M60 30 Q54 22 60 12 M76 34 Q70 26 76 18" opacity={0.6} />
        <ellipse {...S(p)} cx={60} cy={76} rx={54} ry={30} fill={p.light} />
        <ellipse {...L(p, 3)} cx={60} cy={76} rx={40} ry={20} opacity={0.25} />
        <path {...S(p)} fill={p.metal} d="M26 80 Q30 46 60 44 Q90 46 94 80 Q60 90 26 80 Z" />
        <circle {...S(p)} cx={48} cy={60} r={9} fill={p.main} />
        <circle {...S(p)} cx={70} cy={56} r={8} fill={p.wood} />
        <path {...S(p)} fill={p.green} d="M60 70 Q66 58 78 64 Q72 76 60 70 Z M84 70 Q92 64 98 72 Q90 78 84 70 Z" />
      </>
    ),
  },
  {
    id: "dining-set",
    nameAr: "مائدة طعام",
    category: "home",
    tags: ["مائدة", "اجتماع", "أسرة", "طعام", "ضيافة"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={8} y={44} width={7} height={66} rx={3} fill={p.wood} />
        <rect {...S(p)} x={8} y={74} width={28} height={7} rx={3} fill={p.wood} />
        <rect {...S(p)} x={28} y={78} width={6} height={32} rx={3} fill={p.wood} />
        <rect {...S(p)} x={105} y={44} width={7} height={66} rx={3} fill={p.wood} />
        <rect {...S(p)} x={84} y={74} width={28} height={7} rx={3} fill={p.wood} />
        <rect {...S(p)} x={86} y={78} width={6} height={32} rx={3} fill={p.wood} />
        <rect {...S(p)} x={42} y={66} width={8} height={44} rx={3} fill={p.wood} />
        <rect {...S(p)} x={70} y={66} width={8} height={44} rx={3} fill={p.wood} />
        <path {...S(p)} fill={p.main} d="M38 56 Q38 40 60 40 Q82 40 82 56 Z" />
        <rect {...S(p)} x={56} y={30} width={8} height={10} rx={4} fill={p.main} />
        <rect {...S(p)} x={24} y={56} width={72} height={12} rx={4} fill={p.wood} />
      </>
    ),
  },
  {
    id: "bowl-soup",
    nameAr: "صحن حساء",
    category: "home",
    tags: ["حساء", "شوربة", "طعام", "دفء", "إفطار"],
    draw: (p) => (
      <>
        <path {...L(p, 3)} stroke={p.edge} d="M40 36 Q34 28 40 20 M56 32 Q50 24 56 14" opacity={0.6} />
        <path {...L(p, 7)} stroke={p.edge} d="M78 50 L102 14" />
        <rect {...S(p)} x={42} y={94} width={36} height={10} rx={4} fill={p.main} />
        <path {...S(p)} fill={p.main} d="M10 54 H110 Q108 96 60 98 Q12 96 10 54 Z" />
        <ellipse {...S(p)} cx={60} cy={54} rx={50} ry={10} fill={p.metal} />
        <circle cx={44} cy={54} r={3} fill={p.green} />
        <circle cx={66} cy={56} r={3} fill={p.green} />
        <path {...L(p, 3)} d="M22 70 Q60 80 98 70" opacity={0.3} />
      </>
    ),
  },
  {
    id: "wall-clock",
    nameAr: "ساعة حائط",
    category: "home",
    tags: ["ساعة", "وقت", "زمن", "عمر"],
    draw: (p) => (
      <>
        <circle {...S(p)} cx={60} cy={60} r={50} fill={p.main} />
        <circle {...S(p)} cx={60} cy={60} r={40} fill={p.light} />
        <path
          {...L(p, 4)}
          stroke={ln(p, p.dark)}
          d="M60 24 V31 M60 89 V96 M24 60 H31 M89 60 H96"
        />
        {[30, 60, 120, 150, 210, 240, 300, 330].map((a) => {
          const r = (a * Math.PI) / 180;
          return <circle key={a} cx={60 + 33 * Math.sin(r)} cy={60 - 33 * Math.cos(r)} r={2} fill={ln(p, p.dark)} />;
        })}
        <path {...L(p, 5)} stroke={ln(p, p.dark)} d="M60 60 V38 M60 60 L78 70" />
        <circle cx={60} cy={60} r={5} fill={p.style === "line" ? p.line : p.main} />
      </>
    ),
  },
  {
    id: "frame-landscape",
    nameAr: "لوحة منظر",
    category: "home",
    tags: ["لوحة", "منظر", "جدار", "زينة", "طبيعة"],
    draw: (p) => (
      <>
        <path {...L(p, 3)} stroke={p.edge} d="M34 26 L60 10 L86 26" />
        <circle cx={60} cy={10} r={3.5} fill={p.edge} />
        <rect {...S(p)} x={8} y={24} width={104} height={80} rx={4} fill={p.wood} />
        <rect {...S(p)} x={18} y={34} width={84} height={60} fill={tint(p, p.water)} />
        <circle {...S(p)} cx={84} cy={50} r={8} fill={p.metal} />
        <path {...S(p)} fill={p.green} opacity={p.style === "line" ? 1 : 0.65} d="M18 94 V72 Q36 54 56 70 Q70 60 102 68 V94 Z" />
        <path {...S(p)} fill={p.green} d="M18 94 V84 Q50 70 80 82 Q92 78 102 80 V94 Z" />
      </>
    ),
  },
  {
    id: "toy-ball",
    nameAr: "كرة لعب",
    category: "home",
    tags: ["كرة", "لعب", "طفولة", "أطفال"],
    draw: (p) => (
      <>
        <ellipse cx={60} cy={110} rx={34} ry={5} fill={p.shadow} />
        <circle cx={60} cy={60} r={46} fill={p.main} />
        <path fill={p.light} d="M60 14 Q30 60 60 106 Q90 60 60 14 Z" />
        <path fill={p.second} d="M60 14 Q48 60 60 106 Q72 60 60 14 Z" />
        <path {...L(p, 3)} d="M60 14 Q30 60 60 106 M60 14 Q90 60 60 106" opacity={p.style === "line" ? 1 : 0.25} />
        <circle {...S(p)} cx={60} cy={60} r={46} fill="none" />
        <path d="M30 40 Q36 28 48 22" stroke={p.light} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.6} />
      </>
    ),
  },
  {
    id: "toy-blocks",
    nameAr: "مكعبات لعب",
    category: "home",
    tags: ["مكعبات", "لعب", "طفولة", "بناء"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={12} y={64} width={46} height={46} rx={6} fill={p.main} />
        <rect {...L(p, 3)} x={21} y={73} width={28} height={28} rx={4} opacity={0.35} />
        <rect {...S(p)} x={62} y={64} width={46} height={46} rx={6} fill={p.second} />
        <rect {...L(p, 3)} x={71} y={73} width={28} height={28} rx={4} opacity={0.35} />
        <g transform="rotate(-10 60 38)">
          <rect {...S(p)} x={37} y={16} width={46} height={46} rx={6} fill={p.metal} />
          <rect {...L(p, 3)} x={46} y={25} width={28} height={28} rx={4} opacity={0.35} />
        </g>
      </>
    ),
  },
  {
    id: "school-bag",
    nameAr: "حقيبة مدرسية",
    category: "home",
    tags: ["حقيبة", "مدرسة", "طالب", "أطفال", "تعلم"],
    draw: (p) => (
      <>
        <path {...L(p, 6)} stroke={p.edge} d="M46 28 V22 Q46 10 60 10 Q74 10 74 22 V28" />
        <rect {...S(p)} x={22} y={26} width={76} height={86} rx={20} fill={p.main} />
        <path {...S(p)} fill={p.main} d="M22 54 Q22 40 36 40 H84 Q98 40 98 54 Z" />
        <rect {...S(p)} x={32} y={66} width={56} height={36} rx={9} fill={p.second} />
        <path {...L(p, 3)} d="M40 76 H80" opacity={0.35} />
        <rect {...S(p)} x={52} y={50} width={16} height={14} rx={3} fill={p.metal} />
      </>
    ),
  },
  {
    id: "shoes-pair",
    nameAr: "زوج أحذية",
    category: "home",
    tags: ["حذاء", "خروج", "مشي", "سفر"],
    draw: (p) => (
      <>
        {[
          { x: 4, y: 34, f: p.second },
          { x: 50, y: 64, f: p.main },
        ].map(({ x, y, f }) => (
          <g key={x} transform={`translate(${x} ${y})`}>
            <path {...S(p)} fill={f} d="M4 36 V16 Q4 10 10 10 H22 Q26 10 28 13 Q32 20 42 22 L56 25 Q64 27 64 34 V36 Z" />
            <path {...L(p, 3)} d="M27 17 L33 14 M32 22 L38 19" stroke={ln(p, p.light)} />
            <rect {...S(p)} x={0} y={34} width={66} height={9} rx={4} fill={p.light} />
          </g>
        ))}
      </>
    ),
  },
  {
    id: "plant-pot",
    nameAr: "نبتة في أصيص",
    category: "home",
    tags: ["نبتة", "زرع", "نمو", "رعاية"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.green} d="M60 70 Q30 64 22 30 Q52 32 60 70 Z" />
        <path {...S(p)} fill={p.green} d="M60 70 Q90 64 98 30 Q68 32 60 70 Z" />
        <path {...S(p)} fill={p.green} d="M60 70 Q46 38 60 8 Q74 38 60 70 Z" />
        <path {...L(p, 2.5)} d="M58 66 Q40 52 30 36 M62 66 Q80 52 90 36 M60 64 V18" opacity={0.35} />
        <path {...S(p)} fill={p.main} d="M34 74 H86 L80 108 Q79 112 75 112 H45 Q41 112 40 108 Z" />
        <rect {...S(p)} x={28} y={66} width={64} height={12} rx={4} fill={p.main} />
      </>
    ),
  },
  {
    id: "gift-box",
    nameAr: "صندوق هدية",
    category: "home",
    tags: ["هدية", "عيد", "فرح", "مودة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d="M60 40 Q40 12 30 22 Q22 32 60 40 Z" />
        <path {...S(p)} fill={p.second} d="M60 40 Q80 12 90 22 Q98 32 60 40 Z" />
        <rect {...S(p)} x={18} y={54} width={84} height={56} rx={4} fill={p.main} />
        <rect {...S(p)} x={12} y={38} width={96} height={20} rx={4} fill={p.main} />
        <rect {...S(p)} x={52} y={38} width={16} height={72} fill={p.second} />
        <path {...L(p, 3)} d="M18 58 H102" opacity={0.3} />
      </>
    ),
  },
  {
    id: "envelope",
    nameAr: "ظرف رسالة",
    category: "home",
    tags: ["رسالة", "بريد", "تواصل", "خبر"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={10} y={24} width={100} height={72} rx={6} fill={p.light} />
        <path {...L(p, 3)} d="M12 92 L48 60 M108 92 L72 60" opacity={0.35} />
        <path {...S(p)} fill={p.main} d="M10 30 Q10 24 16 24 H104 Q110 24 110 30 L64 66 Q60 69 56 66 Z" />
        <circle {...S(p)} cx={60} cy={62} r={8} fill={p.accent} />
      </>
    ),
  },
  {
    id: "letter-open",
    nameAr: "رسالة مفتوحة",
    category: "home",
    tags: ["رسالة", "خبر", "وصية", "قراءة"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d="M12 56 L60 22 L108 56 V104 H12 Z" />
        <rect {...S(p)} x={24} y={12} width={72} height={70} rx={3} fill={p.light} />
        <path {...L(p, 3)} d="M34 28 H86 M34 40 H86 M34 52 H72" opacity={0.4} />
        <path {...S(p)} fill={p.main} d="M12 56 L60 86 L108 56 V102 Q108 108 102 108 H18 Q12 108 12 102 Z" />
        <path {...L(p, 3)} d="M14 104 L48 78 M106 104 L72 78" opacity={0.3} />
      </>
    ),
  },
  {
    id: "keys-house",
    nameAr: "مفاتيح البيت",
    category: "home",
    tags: ["مفاتيح", "بيت", "أمانة", "عودة"],
    draw: (p) => (
      <>
        <circle {...L(p, 5)} stroke={p.edge} cx={44} cy={26} r={14} />
        <g transform="translate(52 38) rotate(62)">
          <circle {...S(p)} cx={0} cy={0} r={13} fill={p.metal} />
          <circle cx={-3} cy={0} r={4.5} fill={p.style === "line" ? p.light : p.bg} />
          <path {...S(p)} fill={p.metal} d="M11 -5 H60 V5 H54 V15 H46 V5 H40 V12 H32 V5 H11 Z" />
        </g>
        <g transform="translate(58 34) rotate(18)">
          <circle {...S(p)} cx={0} cy={0} r={12} fill={p.second} />
          <circle cx={-3} cy={0} r={4} fill={p.style === "line" ? p.light : p.bg} />
          <path {...S(p)} fill={p.second} d="M10 -4.5 H52 V4.5 H47 V13 H40 V4.5 H34 V10 H27 V4.5 H10 Z" />
        </g>
        <path {...L(p, 3)} stroke={p.edge} d="M32 36 L26 52" />
        <path {...S(p)} fill={p.main} d="M10 66 L26 52 L42 66 V94 Q42 98 38 98 H14 Q10 98 10 94 Z" />
        <rect x={21} y={78} width={10} height={20} rx={2} fill={ln(p, p.light)} opacity={p.style === "line" ? 1 : 0.8} />
      </>
    ),
  },
  {
    id: "fridge",
    nameAr: "ثلاجة",
    category: "home",
    tags: ["ثلاجة", "مطبخ", "طعام", "تخزين"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={28} y={8} width={64} height={102} rx={10} fill={tint(p, p.water)} />
        <path {...L(p, 3)} d="M28 44 H92" opacity={p.style === "line" ? 1 : 0.4} />
        <rect {...S(p)} x={78} y={20} width={6} height={16} rx={3} fill={p.dark} />
        <rect {...S(p)} x={78} y={54} width={6} height={26} rx={3} fill={p.dark} />
        <circle {...S(p)} cx={42} cy={26} r={5} fill={p.main} />
        <rect {...S(p)} x={38} y={56} width={14} height={10} rx={2} fill={p.second} transform="rotate(-8 45 61)" />
        <rect x={34} y={108} width={10} height={6} rx={2} fill={p.dark} />
        <rect x={76} y={108} width={10} height={6} rx={2} fill={p.dark} />
      </>
    ),
  },
  {
    id: "washing-machine",
    nameAr: "غسالة",
    category: "home",
    tags: ["غسالة", "غسيل", "نظافة", "عمل البيت"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={18} y={10} width={84} height={100} rx={10} fill={p.light} />
        <path {...S(p)} fill={p.main} d="M18 32 V20 Q18 10 28 10 H92 Q102 10 102 20 V32 Z" />
        <circle cx={32} cy={21} r={4} fill={p.light} />
        <circle cx={44} cy={21} r={4} fill={p.light} />
        <rect x={70} y={18} width={22} height={6} rx={3} fill={p.light} />
        <circle {...S(p)} cx={60} cy={70} r={32} fill={p.dark} />
        <circle {...S(p)} cx={60} cy={70} r={23} fill={p.water} />
        <path fill={p.second} d="M37 74 Q48 64 60 72 Q72 80 83 70 Q82 92 60 93 Q38 92 37 74 Z" />
        <path d="M48 58 Q52 52 60 50" stroke={p.light} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.7} />
      </>
    ),
  },
  {
    id: "broom",
    nameAr: "مكنسة",
    category: "home",
    tags: ["مكنسة", "تنظيف", "نظافة", "عمل البيت"],
    draw: (p) => (
      <>
        <path {...L(p, 6)} stroke={p.edge} d="M96 8 L58 70" />
        <g transform="rotate(32 56 84)">
          <path {...S(p)} fill={p.metal} d="M42 80 H70 L82 112 Q56 118 30 112 Z" />
          <path {...L(p, 2.5)} d="M48 84 L42 112 M56 84 V114 M64 84 L70 112" opacity={0.35} />
          <rect {...S(p)} x={40} y={72} width={32} height={12} rx={4} fill={p.main} />
        </g>
      </>
    ),
  },
  {
    id: "rug",
    nameAr: "سجادة بيت",
    category: "home",
    tags: ["سجادة", "بساط", "جلسة", "بيت"],
    draw: (p) => (
      <>
        <path {...L(p, 3)} stroke={p.edge} d="M14 38 H6 M14 50 H6 M14 62 H6 M14 74 H6 M14 86 H6 M106 38 H114 M106 50 H114 M106 62 H114 M106 74 H114 M106 86 H114" />
        <rect {...S(p)} x={14} y={30} width={92} height={62} rx={3} fill={p.main} />
        <rect {...S(p)} x={24} y={40} width={72} height={42} rx={2} fill={p.second} />
        <path {...S(p)} fill={p.main} d="M60 46 L82 61 L60 76 L38 61 Z" />
        <path {...S(p)} fill={p.accent} d="M60 54 L70 61 L60 68 L50 61 Z" />
        <path {...L(p, 3)} d="M18 34 H102 M18 88 H102" opacity={0.3} />
      </>
    ),
  },
];
