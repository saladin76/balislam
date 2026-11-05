import React from "react";
import type { ElementDef, ElementPalette } from "../types";
import { L, S, tint } from "../helpers";
import { ground, hi, shade, tube } from "../kit";

/**
 * التاريخ والحضارات: أدوات الحرب والحصون والمواكب والرحلات والآثار.
 * لقناة «دفاتر الزمن» وحدها (src/channel/library.ts). بلا وجوه، والحيوانات صور ظلية بلا ملامح،
 * وبلا رموز دينية لغير الإسلام، وبلا دماء.
 */
/** هل خلفية الثيم داكنة؟ (ثيما الغسق والليل) */
const darkBg = (p: ElementPalette) => {
  const h = p.bg.replace("#", "");
  if (h.length < 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! < 110;
};
/** فاتح يُرى على كل خلفية: الورق في الثيم الخطي، والرملي في المسطح الفاتح، ولون النص الفاتح في الداكن */
const paperOf = (p: ElementPalette) => (darkBg(p) ? p.ink : p.style === "line" ? p.light : p.metal);
/** خشب يُرى على كل خلفية: الخشب في الفاتحة، والرملي في الداكنة */
const woodOf = (p: ElementPalette) => (darkBg(p) ? p.metal : p.wood);

export const elements: ElementDef[] = [
  {
    id: "sword",
    nameAr: "سيف",
    category: "history",
    tags: ["سيف", "حرب", "معركة", "فارس", "قتال", "جيش"],
    draw: (p) => (
      <g transform="rotate(-38 60 60)">
        <path {...S(p)} fill={paperOf(p)} d="M56 8 Q60 2 64 8 L66 78 H54 Z" />
        <path {...L(p, 2)} opacity={0.45} d="M60 12 V76" />
        <rect {...S(p)} x={34} y={78} width={52} height={9} rx={4.5} fill={p.metal} />
        <rect {...S(p)} x={55} y={87} width={10} height={20} rx={3} fill={p.main} />
        <circle {...S(p)} cx={60} cy={112} r={6} fill={p.metal} />
      </g>
    ),
  },
  {
    id: "shield-round",
    nameAr: "درع مستدير",
    category: "history",
    tags: ["درع", "حماية", "دفاع", "حرب", "جيش"],
    draw: (p) => (
      <>
        {ground(p, 60, 112, 40, 4)}
        <circle {...S(p)} cx={60} cy={58} r={48} fill={p.main} />
        <circle {...S(p)} cx={60} cy={58} r={38} fill={p.second} />
        <circle {...L(p, 2)} cx={60} cy={58} r={30} opacity={0.4} />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <circle key={a} cx={60 + 43 * Math.cos((a * Math.PI) / 180)} cy={58 + 43 * Math.sin((a * Math.PI) / 180)} r={3} fill={p.metal} />
        ))}
        <circle {...S(p)} cx={60} cy={58} r={13} fill={p.metal} />
        <circle {...hi(p, 0.5)} cx={55} cy={53} r={4} />
      </>
    ),
  },
  {
    id: "helmet",
    nameAr: "خوذة",
    category: "history",
    tags: ["خوذة", "جندي", "حرب", "فارس", "جيش"],
    draw: (p) => (
      <>
        {ground(p, 60, 110, 38, 4)}
        <path {...S(p)} fill={p.metal} d="M22 86 Q20 40 60 24 Q100 40 98 86 Z" />
        <path {...S(p)} fill={p.main} d="M56 6 L64 6 L66 26 H54 Z" />
        <path {...S(p)} fill={p.dark} d="M30 86 H90 Q94 98 88 104 H32 Q26 98 30 86 Z" />
        <path {...L(p, 2)} opacity={0.5} d="M60 28 V84" />
        <path {...shade(p, 0.12)} d="M60 26 Q98 42 98 86 H60 Z" />
        <circle {...hi(p, 0.45)} cx={44} cy={50} r={5} />
      </>
    ),
  },
  {
    id: "bow-arrow",
    nameAr: "قوس وسهم",
    category: "history",
    tags: ["قوس", "سهم", "رماية", "حرب", "صيد"],
    draw: (p) => (
      <>
        {tube(p, "M40 12 Q100 60 40 108", woodOf(p), 8)}
        <path {...L(p, 2)} stroke={p.edge} d="M40 12 L40 108" />
        <path {...L(p, 3)} stroke={p.edge} d="M24 60 H96" />
        <path {...S(p)} fill={p.metal} d="M96 60 L84 52 V68 Z" />
        <path {...S(p)} fill={p.main} d="M24 60 L16 52 H28 L32 60 L28 68 H16 Z" />
      </>
    ),
  },
  {
    id: "war-banner",
    nameAr: "راية جيش",
    category: "history",
    tags: ["راية", "لواء", "جيش", "دولة", "نصر", "فتح"],
    note: "راية بلا كتابة ولا شعار ديني؛ اللون من الثيم.",
    draw: (p) => (
      <>
        {ground(p, 40, 112, 22, 3)}
        {tube(p, "M40 112 V10", woodOf(p), 6)}
        <circle {...S(p)} cx={40} cy={9} r={5} fill={p.metal} />
        <path {...S(p)} fill={p.main} d="M43 16 H100 Q92 32 100 48 Q92 64 100 78 H43 Z" />
        <path {...shade(p, 0.12)} d="M43 64 H96 Q99 72 100 78 H43 Z" />
        <path {...S(p)} fill={p.second} d="M43 16 H58 V78 H43 Z" />
      </>
    ),
  },
  {
    id: "fortress",
    nameAr: "قلعة",
    category: "history",
    tags: ["قلعة", "حصن", "حصار", "دفاع", "مدينة", "أسوار"],
    draw: (p) => (
      <>
        {ground(p, 60, 112, 52, 4)}
        <path {...S(p)} fill={p.main} d="M10 110 V44 H18 V36 H26 V44 H34 V110 Z" />
        <path {...S(p)} fill={p.main} d="M86 110 V44 H94 V36 H102 V44 H110 V110 Z" />
        <path {...S(p)} fill={tint(p, p.second)} d="M34 110 V60 H40 V54 H46 V60 H54 V54 H66 V60 H74 V54 H80 V60 H86 V110 Z" />
        <path {...S(p)} fill={p.dark} d="M50 110 V88 Q60 76 70 88 V110 Z" />
        <path {...L(p, 2)} opacity={0.5} d="M22 56 V64 M98 56 V64 M44 72 H52 M68 72 H76" />
        <path {...shade(p, 0.12)} d="M98 44 H110 V110 H98 Z" />
      </>
    ),
  },
  {
    id: "watch-tower",
    nameAr: "برج مراقبة",
    category: "history",
    tags: ["برج", "مراقبة", "حراسة", "حصن", "حدود"],
    draw: (p) => (
      <>
        {ground(p, 60, 112, 36, 4)}
        <path {...S(p)} fill={p.main} d="M38 110 L44 34 H76 L82 110 Z" />
        <path {...S(p)} fill={p.second} d="M34 34 V16 H42 V24 H50 V16 H58 V24 H66 V16 H74 V24 H78 V16 H86 V34 Z" />
        <path {...S(p)} fill={p.dark} d="M54 52 Q60 44 66 52 V64 H54 Z" />
        <path {...S(p)} fill={p.dark} d="M52 110 V92 Q60 82 68 92 V110 Z" />
        <path {...shade(p, 0.12)} d="M60 34 H76 L82 110 H60 Z" />
      </>
    ),
  },
  {
    id: "city-walls",
    nameAr: "أسوار مدينة",
    category: "history",
    tags: ["أسوار", "سور", "مدينة", "حصار", "باب المدينة"],
    draw: (p) => (
      <>
        {ground(p, 60, 112, 54, 4)}
        <path {...S(p)} fill={tint(p, p.second)} d="M6 110 V66 H12 V60 H18 V66 H24 V60 H30 V66 H90 V60 H96 V66 H102 V60 H108 V66 H114 V110 Z" />
        <path {...S(p)} fill={p.main} d="M40 110 V42 H46 V34 H54 V42 H66 V34 H74 V42 H80 V110 Z" />
        <path {...S(p)} fill={p.dark} d="M50 110 V82 Q60 68 70 82 V110 Z" />
        <path {...L(p, 2)} opacity={0.45} d="M10 80 H36 M10 94 H36 M84 80 H110 M84 94 H110 M20 66 V110 M100 66 V110" />
        <path {...L(p, 2)} opacity={0.5} d="M56 54 V62 M64 54 V62" />
      </>
    ),
  },
  {
    id: "camel",
    nameAr: "جمل",
    category: "history",
    tags: ["جمل", "قافلة", "صحراء", "تجارة", "سفر", "رحلة"],
    note: "صورة ظلية بلا ملامح.",
    draw: (p) => (
      <>
        {ground(p, 60, 110, 44, 4)}
        <path
          {...S(p)}
          fill={p.main}
          d="M22 60 Q24 48 34 46 Q40 30 52 40 Q58 28 70 38 Q78 44 80 54 L88 52 Q90 34 96 24 Q100 18 106 20 Q112 22 110 28 L104 30 Q98 40 98 58 Q98 66 92 70 L92 108 H85 L84 76 H78 L76 108 H69 L68 74 Q50 76 38 72 L36 108 H29 L28 74 Q22 70 22 60 Z"
        />
        <path {...S(p)} fill={p.second} d="M38 48 Q52 40 68 46 L66 58 Q52 54 40 60 Z" />
        <path {...L(p, 2)} opacity={0.4} d="M16 58 Q18 70 22 64" />
      </>
    ),
  },
  {
    id: "horse",
    nameAr: "حصان",
    category: "history",
    tags: ["حصان", "فرس", "خيل", "فارس", "معركة", "جيش"],
    note: "صورة ظلية بلا ملامح.",
    draw: (p) => (
      <>
        {ground(p, 60, 110, 44, 4)}
        <path
          {...S(p)}
          fill={p.main}
          d="M20 56 Q20 44 32 44 H72 Q78 30 86 22 L88 12 L94 20 Q104 24 108 36 L110 44 Q106 48 100 44 L96 42 Q92 52 90 60 Q88 66 84 68 L86 108 H79 L76 74 H44 L40 108 H33 L32 72 Q22 70 20 56 Z"
        />
        <path {...S(p)} fill={p.dark} d="M74 32 Q80 22 86 22 Q84 34 80 44 H72 Z" />
        <path {...S(p)} fill={p.dark} d="M20 56 Q10 62 12 80 Q18 70 24 66 Z" />
        <path {...S(p)} fill={p.second} d="M44 44 H64 V58 Q54 62 44 58 Z" />
      </>
    ),
  },
  {
    id: "dhow-ship",
    nameAr: "سفينة شراعية قديمة",
    category: "history",
    tags: ["سفينة", "مركب", "بحر", "تجارة", "رحلة", "أسطول"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={tint(p, p.water)} d="M4 100 Q19 94 34 100 T64 100 T94 100 T116 100 V112 H4 Z" />
        {tube(p, "M58 92 V12", woodOf(p), 5)}
        <path {...S(p)} fill={paperOf(p)} d="M60 14 Q96 34 92 82 L60 82 Z" />
        <path {...L(p, 2)} opacity={0.45} d="M60 34 Q82 44 86 60 M60 56 Q76 62 82 74" />
        <path {...S(p)} fill={paperOf(p)} d="M56 30 Q34 50 30 80 H56 Z" />
        <path {...S(p)} fill={p.main} d="M10 84 H108 Q102 102 90 102 H28 Q14 100 10 84 Z" />
        <path {...L(p, 2)} opacity={0.5} d="M18 90 H100" />
      </>
    ),
  },
  {
    id: "tent",
    nameAr: "خيمة",
    category: "history",
    tags: ["خيمة", "معسكر", "بادية", "صحراء", "جيش", "قبيلة"],
    draw: (p) => (
      <>
        {ground(p, 60, 110, 52, 4)}
        <path {...S(p)} fill={p.main} d="M8 108 L60 22 L112 108 Z" />
        <path {...S(p)} fill={p.dark} d="M60 52 L44 108 H76 Z" />
        <path {...L(p, 2)} opacity={0.45} d="M34 68 L28 108 M86 68 L92 108" />
        <path {...S(p)} fill={p.second} d="M60 22 L56 12 L68 16 Z" />
        <path {...shade(p, 0.12)} d="M60 22 L112 108 H76 Z" />
      </>
    ),
  },
  {
    id: "pyramid",
    nameAr: "هرم",
    category: "history",
    tags: ["هرم", "مصر", "فراعنة", "حضارة قديمة", "آثار"],
    draw: (p) => (
      <>
        {ground(p, 60, 110, 54, 4)}
        <path {...S(p)} fill={tint(p, p.metal)} d="M82 108 L96 82 L110 108 Z" />
        <path {...S(p)} fill={tint(p, p.metal)} d="M6 108 L52 24 L98 108 Z" />
        <path {...shade(p, 0.16)} d="M52 24 L98 108 H66 Z" />
        <path {...L(p, 2)} opacity={0.35} d="M30 64 H74 M20 84 H86" />
      </>
    ),
  },
  {
    id: "ruins-columns",
    nameAr: "أطلال أعمدة",
    category: "history",
    tags: ["أطلال", "آثار", "خراب", "حضارة زالت", "إمبراطورية"],
    draw: (p) => (
      <>
        {ground(p, 60, 112, 52, 4)}
        <rect {...S(p)} x={6} y={100} width={108} height={10} rx={2} fill={paperOf(p)} />
        <rect {...S(p)} x={16} y={30} width={18} height={70} rx={2} fill={paperOf(p)} />
        <rect {...S(p)} x={12} y={22} width={26} height={9} rx={2} fill={paperOf(p)} />
        <path {...S(p)} fill={paperOf(p)} d="M51 100 V58 L58 52 L62 60 L69 54 V100 Z" />
        <rect {...S(p)} x={86} y={30} width={18} height={70} rx={2} fill={paperOf(p)} />
        <rect {...S(p)} x={82} y={22} width={34} height={9} rx={2} fill={paperOf(p)} />
        <path {...L(p, 2)} opacity={0.4} d="M22 34 V96 M28 34 V96 M92 34 V96 M98 34 V96 M57 62 V96 M63 64 V96" />
        <path {...S(p)} fill={p.second} d="M70 104 L80 96 L92 104 Z" />
      </>
    ),
  },
  {
    id: "pottery-jar",
    nameAr: "جرة فخارية",
    category: "history",
    tags: ["جرة", "فخار", "آثار", "تنقيب", "حرفة", "تجارة"],
    draw: (p) => (
      <>
        {ground(p, 60, 112, 30, 4)}
        <path {...S(p)} fill={p.main} d="M46 14 H74 V22 Q70 26 72 32 Q98 44 96 74 Q94 100 70 110 H50 Q26 100 24 74 Q22 44 48 32 Q50 26 46 22 Z" />
        {tube(p, "M48 34 Q30 30 32 52", p.main, 6)}
        {tube(p, "M72 34 Q90 30 88 52", p.main, 6)}
        <path {...L(p, 2)} opacity={0.5} d="M30 62 Q60 72 90 62 M28 78 Q60 88 92 78" />
        <path {...shade(p, 0.12)} d="M60 32 Q96 44 96 74 Q94 100 70 110 H60 Z" />
      </>
    ),
  },
  {
    id: "wax-seal",
    nameAr: "ختم شمع",
    category: "history",
    tags: ["ختم", "رسالة", "مرسوم", "معاهدة", "وثيقة", "سلطان"],
    note: "الختم بلا كتابة.",
    draw: (p) => (
      <>
        <path {...S(p)} fill={paperOf(p)} d="M10 22 H96 Q104 22 104 30 V96 Q104 104 96 104 H10 Z" />
        <path {...L(p, 2)} opacity={0.35} d="M22 40 H86 M22 54 H80 M22 68 H70" />
        <path {...S(p)} fill={p.second} d="M84 70 Q98 68 104 80 Q112 92 102 102 Q92 112 80 106 Q66 100 70 86 Q72 72 84 70 Z" />
        <circle {...L(p, 2)} cx={88} cy={89} r={10} opacity={0.55} />
        <path {...S(p)} fill={p.second} d="M80 104 L74 116 L84 112 Z M96 104 L100 116 L92 112 Z" />
      </>
    ),
  },
  {
    id: "throne",
    nameAr: "عرش",
    category: "history",
    tags: ["عرش", "ملك", "سلطان", "حكم", "خلافة", "سلطة"],
    draw: (p) => (
      <>
        {ground(p, 60, 112, 40, 4)}
        <path {...S(p)} fill={p.main} d="M30 70 V16 Q60 2 90 16 V70 Z" />
        <path {...S(p)} fill={p.second} d="M38 66 V24 Q60 14 82 24 V66 Z" />
        <rect {...S(p)} x={20} y={62} width={80} height={16} rx={5} fill={p.metal} />
        <rect {...S(p)} x={24} y={78} width={10} height={30} rx={3} fill={p.main} />
        <rect {...S(p)} x={86} y={78} width={10} height={30} rx={3} fill={p.main} />
        <circle {...S(p)} cx={30} cy={16} r={5} fill={p.metal} />
        <circle {...S(p)} cx={90} cy={16} r={5} fill={p.metal} />
      </>
    ),
  },
  {
    id: "catapult",
    nameAr: "منجنيق",
    category: "history",
    tags: ["منجنيق", "حصار", "معركة", "قلعة", "حرب"],
    draw: (p) => (
      <>
        {ground(p, 60, 112, 50, 4)}
        <path {...S(p)} fill={woodOf(p)} d="M14 92 H106 V100 H14 Z" />
        <circle {...S(p)} cx={28} cy={102} r={9} fill={woodOf(p)} />
        <circle {...S(p)} cx={92} cy={102} r={9} fill={woodOf(p)} />
        <path {...S(p)} fill={woodOf(p)} d="M48 92 L60 54 L72 92 H64 L60 74 L56 92 Z" />
        {tube(p, "M60 60 L104 16", woodOf(p), 6)}
        <path {...S(p)} fill={p.dark} d="M96 12 Q108 8 112 18 Q108 26 100 22 Z" />
        <rect {...S(p)} x={24} y={62} width={22} height={22} rx={3} fill={p.metal} />
        {tube(p, "M46 72 L60 60", p.metal, 4)}
      </>
    ),
  },
{
    id: "clay-mound",
    nameAr: "طين",
    category: "history",
    tags: ["طين", "صلصال", "تراب", "خلق من طين", "فخار"],
    note: "مادة مجردة فقط: كتلة طين بلا أي هيئة.",
    draw: (p) => (
      <>
        {ground(p, 60, 110, 50, 4)}
        <path {...S(p)} fill={woodOf(p)} d="M10 106 Q14 80 34 74 Q42 52 62 56 Q80 46 92 64 Q110 70 110 106 Z" />
        <path {...shade(p, 0.14)} d="M62 56 Q80 46 92 64 Q110 70 110 106 H70 Q78 82 62 56 Z" />
        <path {...L(p, 2)} opacity={0.45} d="M26 92 Q40 86 52 92 M60 80 Q72 74 84 82 M70 98 Q84 94 96 98" />
        <circle {...hi(p, 0.35)} cx={46} cy={70} r={5} />
      </>
    ),
  },
  {
    id: "flame",
    nameAr: "نار",
    category: "history",
    tags: ["نار", "لهب", "خلق من نار", "اشتعال"],
    note: "لهب مجرد بلا وقود ولا مكان.",
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.second} d="M60 8 Q86 38 88 62 Q90 92 60 110 Q30 92 32 64 Q34 46 48 34 Q48 52 58 58 Q52 34 60 8 Z" />
        <path {...S(p)} fill={p.metal} d="M60 48 Q76 66 74 84 Q70 102 60 106 Q48 100 46 84 Q46 72 54 64 Q56 76 62 78 Q58 64 60 48 Z" />
        <path fill={p.style === "line" ? p.light : p.light} opacity={0.55} d="M60 76 Q68 86 66 96 Q62 102 58 98 Q54 92 60 76 Z" />
      </>
    ),
  },
  {
    id: "stone-tools",
    nameAr: "أدوات حجرية",
    category: "history",
    tags: ["أدوات حجرية", "حجر", "فأس حجري", "ما قبل التاريخ", "آثار", "صناعة قديمة"],
    draw: (p) => (
      <>
        {ground(p, 60, 110, 50, 4)}
        <path {...S(p)} fill={paperOf(p)} d="M30 104 Q14 76 24 46 Q34 18 50 14 Q62 30 60 60 Q58 90 30 104 Z" />
        <path {...L(p, 2)} opacity={0.5} d="M28 50 L40 44 M24 66 L40 60 M28 82 L44 76 M36 30 L48 28" />
        <path {...S(p)} fill={p.metal} d="M66 104 L74 60 Q78 48 86 48 Q96 50 98 62 L104 104 Z" />
        <path {...L(p, 2)} opacity={0.5} d="M78 64 L92 70 M76 80 L96 84 M74 94 L98 96" />
      </>
    ),
  },
  {
    id: "rock-art",
    nameAr: "نقوش صخرية",
    category: "history",
    tags: ["نقوش", "رسوم صخرية", "كهف", "ما قبل الكتابة", "آثار"],
    note: "علامات ونقوش مجردة على صخرة، بلا رسم لإنسان أو حيوان.",
    draw: (p) => (
      <>
        {ground(p, 60, 112, 52, 4)}
        <path {...S(p)} fill={woodOf(p)} d="M8 108 Q6 60 26 34 Q50 10 84 18 Q112 28 114 66 Q116 96 108 108 Z" />
        <path {...shade(p, 0.14)} d="M84 18 Q112 28 114 66 Q116 96 108 108 H80 Q96 70 84 18 Z" />
        <g stroke={paperOf(p)} strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.95}>
          <path d="M30 56 Q40 46 50 56 Q60 66 70 56" />
          <path d="M34 72 H74 M40 80 H68" />
          <circle cx={88} cy={50} r={8} />
          <path d="M84 72 L92 82 L100 72 M28 92 L36 86 L44 92 L52 86" />
        </g>
      </>
    ),
  },
  {
    id: "excavation-tools",
    nameAr: "أدوات التنقيب",
    category: "history",
    tags: ["تنقيب", "علم الآثار", "باحثون", "حفريات", "اكتشاف"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={woodOf(p)} d="M6 112 V92 Q30 86 60 92 Q90 98 114 90 V112 Z" />
        {tube(p, "M30 90 L58 30", p.main, 7)}
        <path {...S(p)} fill={p.metal} d="M54 34 L74 14 Q82 10 84 18 L70 40 Z" />
        {tube(p, "M86 92 L94 44", woodOf(p), 6)}
        <path {...S(p)} fill={p.second} d="M88 46 Q84 30 94 26 Q104 30 100 46 Z" />
        <path {...L(p, 2)} opacity={0.6} d="M90 32 V44 M94 30 V44 M98 32 V44" />
        <path {...S(p)} fill={paperOf(p)} d="M40 100 L48 94 L54 100 L48 104 Z" />
      </>
    ),
  },
  {
    id: "dwelling-remains",
    nameAr: "آثار مساكن",
    category: "history",
    tags: ["مساكن قديمة", "مستوطنة", "قرية قديمة", "استيطان", "أساسات", "آثار"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={tint(p, p.light)} d="M4 112 V84 Q60 72 116 84 V112 Z" />
        <ellipse {...S(p)} cx={38} cy={92} rx={26} ry={10} fill="none" stroke={p.style === "line" ? p.stroke : paperOf(p)} strokeWidth={6} />
        <ellipse {...S(p)} cx={86} cy={96} rx={22} ry={8} fill="none" stroke={p.style === "line" ? p.stroke : paperOf(p)} strokeWidth={6} />
        {[18, 30, 44, 58, 70, 80, 94, 104].map((x, i) => (
          <circle key={i} {...S(p)} cx={x} cy={i % 2 ? 90 + (i % 3) * 3 : 98 - (i % 3) * 2} r={4} fill={p.metal} />
        ))}
        {/* بقايا جدران منخفضة من الحجر حول كل بيت */}
        <path {...S(p)} fill={paperOf(p)} d="M14 92 Q14 78 38 76 Q62 78 62 92 L56 92 Q56 84 38 83 Q20 84 20 92 Z" />
        <path {...S(p)} fill={paperOf(p)} d="M66 96 Q66 84 86 82 Q106 84 106 96 L100 96 Q100 90 86 89 Q72 90 72 96 Z" />
      </>
    ),
  },
  {
    id: "generations",
    nameAr: "أجيال البشر",
    category: "history",
    tags: ["أجيال", "نسل", "ذرية", "البشر", "الناس", "تعاقب الأجيال"],
    note: "صور ظلية بلا ملامح، تتكرر كالموج دلالة على تعاقب الأجيال.",
    draw: (p) => (
      <>
        {ground(p, 60, 112, 54, 3)}
        {[
          [18, 0.62],
          [40, 0.78],
          [62, 0.92],
          [84, 0.78],
          [104, 0.62],
        ].map(([x, k], i) => {
          const s = k as number;
          const cx = x as number;
          const top = 108 - 92 * s;
          return (
            <g key={i} opacity={0.55 + 0.45 * s}>
              <circle {...S(p)} cx={cx} cy={top + 10 * s} r={9 * s} fill={i === 2 ? p.main : p.second} />
              <path {...S(p)} fill={i === 2 ? p.main : p.second} d={`M${cx - 14 * s} 108 Q${cx - 15 * s} ${top + 26 * s} ${cx} ${top + 22 * s} Q${cx + 15 * s} ${top + 26 * s} ${cx + 14 * s} 108 Z`} />
            </g>
          );
        })}
      </>
    ),
  },
  {
    id: "food-remains",
    nameAr: "بقايا أطعمة",
    category: "history",
    tags: ["بقايا أطعمة", "حبوب متفحمة", "آثار", "تنقيب", "طعام القدماء"],
    note: "شقفة فخار وحبوب متفحمة ونوى في التراب: بقايا طعام كما يجدها المنقبون، بلا عظام.",
    draw: (p) => (
      <>
        <path {...S(p)} fill={woodOf(p)} d="M4 112 V84 Q30 76 60 82 Q90 88 116 80 V112 Z" />
        <path {...S(p)} fill={p.main} d="M18 74 Q40 54 70 60 L64 78 Q42 74 26 86 Z" />
        <path {...L(p, 2)} opacity={0.5} d="M28 72 Q44 64 62 66" />
        {[
          [74, 92],
          [82, 96],
          [90, 91],
          [98, 97],
          [86, 102],
          [94, 104],
          [78, 103],
        ].map(([x = 0, y = 0], i) => (
          <ellipse key={i} {...S(p)} cx={x} cy={y} rx={4.5} ry={3} transform={`rotate(${(i * 37) % 90 - 40} ${x} ${y})`} fill={p.dark} />
        ))}
        <ellipse {...S(p)} cx={40} cy={98} rx={7} ry={4.5} fill={paperOf(p)} />
        <ellipse {...S(p)} cx={54} cy={102} rx={6} ry={4} fill={paperOf(p)} />
      </>
    ),
  },
  {
    id: "burial-cairn",
    nameAr: "مدافن قديمة",
    category: "history",
    tags: ["مدافن", "قبور قديمة", "آثار", "تنقيب"],
    note: "ركام حجارة فوق تلة صغيرة، بلا عظام ولا رموز دينية.",
    draw: (p) => (
      <>
        {ground(p, 60, 112, 54, 4)}
        <path {...S(p)} fill={woodOf(p)} d="M6 110 Q30 80 60 78 Q90 80 114 110 Z" />
        {[
          [38, 80, 12],
          [58, 76, 13],
          [80, 80, 12],
          [48, 62, 11],
          [70, 62, 11],
          [59, 46, 10],
        ].map(([x = 0, y = 0, r = 0], i) => (
          <path key={i} {...S(p)} fill={i % 2 ? paperOf(p) : p.metal} d={`M${x - r} ${y + r * 0.6} Q${x - r} ${y - r * 0.7} ${x} ${y - r * 0.8} Q${x + r} ${y - r * 0.7} ${x + r} ${y + r * 0.6} Z`} />
        ))}
        <path {...shade(p, 0.12)} d="M60 78 Q90 80 114 110 H70 Q74 92 60 78 Z" />
      </>
    ),
  },
  {
    id: "soil-strata",
    nameAr: "طبقات الأرض في موقع التنقيب",
    category: "history",
    tags: ["طبقات", "تنقيب", "علم الآثار", "باحثون", "مقطع أثري", "تأريخ الآثار"],
    note: "مقطع في موقع تنقيب: طبقات تراب متتالية، في كل طبقة أثر (كسرة فخار، أداة حجرية، عظمة)، وحبل المربع الأثري بوتديه، ومسطرين يدوي. بلا آلات حديثة ولا أرقام.",
    draw: (p) => (
      <>
        {/* حبل مربع التنقيب بين وتدين */}
        {tube(p, "M14 30 L14 10", woodOf(p), 4, "peg-a")}
        {tube(p, "M106 30 L106 10", woodOf(p), 4, "peg-b")}
        <path {...L(p, 2)} d="M14 14 Q60 20 106 14" />
        {/* الطبقات من الأحدث (أعلى) إلى الأقدم (أسفل) */}
        <path {...S(p)} fill={woodOf(p)} d="M8 30 Q34 26 60 30 Q86 34 112 29 V48 Q86 52 60 47 Q34 43 8 48 Z" />
        <path {...S(p)} fill={paperOf(p)} d="M8 48 Q34 43 60 47 Q86 52 112 48 V70 Q86 66 60 70 Q34 74 8 69 Z" />
        <path {...S(p)} fill={darkBg(p) ? p.wood : tint(p, p.light)} d="M8 69 Q34 74 60 70 Q86 66 112 70 V92 Q86 96 60 91 Q34 87 8 92 Z" />
        <path {...S(p)} fill={tint(p, p.second)} d="M8 92 Q34 87 60 91 Q86 96 112 92 V112 H8 Z" />
        <path {...shade(p, 0.1)} d="M84 30 Q100 33 112 29 V112 H90 Z" />
        {/* الآثار في طبقاتها */}
        <path {...S(p)} fill={p.main} d="M30 58 Q38 52 48 56 L46 62 Q38 59 32 63 Z" />
        <path {...S(p)} fill={p.stroke === "none" ? p.dark : p.light} d="M72 76 L84 74 L80 86 Z" />
        <path {...L(p, 1.5)} opacity={0.7} d="M76 77 L79 82" />
        <rect {...S(p)} x={30} y={99.5} width={20} height={3.5} rx={1.5} fill={paperOf(p)} />
        {[
          [29, 98.5],
          [29, 104],
          [51, 98.5],
          [51, 104],
        ].map(([x = 0, y = 0], i) => (
          <circle key={i} {...S(p)} cx={x} cy={y} r={2.6} fill={paperOf(p)} />
        ))}
        {/* مسطرين يدوي مغروس في الطبقة العليا */}
        {tube(p, "M92 6 L92 20", woodOf(p), 5, "trowel")}
        <path {...S(p)} fill={p.metal} d="M86 20 H98 L92 38 Z" />
      </>
    ),
  },
];
