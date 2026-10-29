import React from "react";
import type { ElementDef, ElementPalette } from "../types";
import { L, S, tint } from "../helpers";

/**
 * الحياة اليومية والتقنية: أجهزة ومواصلات وأدوات عمل ودراسة.
 * الشاشات تعرض كتلًا مجردة فقط (لا نص ولا وجوه).
 */

/** لون خط: حبر في الثيم الخطي، ولون معيّن في المسطح */
const ln = (p: ElementPalette, flat: string) => (p.style === "line" ? p.line : flat);
/** لون الشاشة المضيئة */
const screen = (p: ElementPalette) => tint(p, p.water);
/** كتلة واجهة على الشاشة */
const blk = (p: ElementPalette, c: string) => (p.style === "line" ? (c === p.light ? p.light : p.second) : c);

const star = (cx: number, cy: number, R: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? R : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

/** هيكل الهاتف (الشاشة من x=38 إلى 82 ومن y=20 إلى 100) */
const phone = (p: ElementPalette, inner: React.ReactNode) => (
  <>
    <rect {...S(p)} x={30} y={8} width={60} height={104} rx={12} fill={p.dark} />
    <rect {...S(p)} x={37} y={18} width={46} height={84} rx={4} fill={screen(p)} />
    {inner}
    <rect x={52} y={12} width={16} height={3} rx={1.5} fill={p.style === "line" ? p.light : p.bg} opacity={0.6} />
    <rect x={50} y={105} width={20} height={3} rx={1.5} fill={p.style === "line" ? p.light : p.bg} opacity={0.6} />
  </>
);

export const elements: ElementDef[] = [
  {
    id: "smartphone",
    nameAr: "هاتف ذكي",
    category: "daily",
    tags: ["هاتف", "جوال", "تقنية", "تطبيقات"],
    draw: (p) =>
      phone(
        p,
        [0, 1, 2].flatMap((r) =>
          [0, 1, 2].map((c) => {
            const cols = [p.main, p.second, p.accent];
            return (
              <rect
                key={`${r}-${c}`}
                {...S(p)}
                strokeWidth={p.style === "line" ? 2 : 0}
                x={42 + c * 13}
                y={28 + r * 15}
                width={10}
                height={10}
                rx={3}
                fill={blk(p, cols[(r + c) % 3] ?? p.main)}
              />
            );
          }),
        ).concat(<rect key="dock" x={41} y={88} width={38} height={9} rx={4} fill={p.light} opacity={p.style === "line" ? 1 : 0.5} {...S(p)} strokeWidth={p.style === "line" ? 2 : 0} />),
      ),
  },
  {
    id: "phone-notifications",
    nameAr: "هاتف بإشعارات",
    category: "daily",
    tags: ["إشعارات", "تنبيهات", "هاتف", "تشتت", "انشغال"],
    draw: (p) => (
      <>
        {phone(
          p,
          [28, 48, 68].map((y, i) => (
            <g key={y}>
              <rect {...S(p)} strokeWidth={p.style === "line" ? 2 : 0} x={40} y={y} width={40} height={16} rx={4} fill={p.light} />
              <circle cx={47} cy={y + 8} r={4} fill={blk(p, [p.main, p.second, p.accent][i] ?? p.main)} />
              <path {...L(p, 2.5)} d={`M55 ${y + 6} H75 M55 ${y + 11} H68`} opacity={0.4} />
            </g>
          )),
        )}
        <circle {...S(p)} cx={88} cy={14} r={12} fill={p.main} />
        <circle cx={88} cy={14} r={4} fill={p.style === "line" ? p.line : p.light} />
      </>
    ),
  },
  {
    id: "phone-scroll",
    nameAr: "تصفح الهاتف",
    category: "daily",
    tags: ["تصفح", "تمرير", "إدمان", "وسائل التواصل", "وقت ضائع"],
    draw: (p) => (
      <>
        {phone(
          p,
          <>
            <rect {...S(p)} strokeWidth={p.style === "line" ? 2 : 0} x={40} y={22} width={34} height={22} rx={3} fill={blk(p, p.main)} />
            <path {...L(p, 2.5)} d="M41 50 H72 M41 56 H62" opacity={0.4} />
            <rect {...S(p)} strokeWidth={p.style === "line" ? 2 : 0} x={40} y={64} width={34} height={22} rx={3} fill={blk(p, p.second)} />
            <path {...L(p, 2.5)} d="M41 92 H72 M41 98 H62" opacity={0.4} />
            <rect x={77} y={30} width={3} height={18} rx={1.5} fill={ln(p, p.dark)} opacity={0.5} />
          </>,
        )}
        <path {...L(p, 5)} stroke={p.edge} d="M14 36 V84" />
        <path {...S(p)} fill={p.edge} d="M14 24 L22 36 H6 Z M14 96 L22 84 H6 Z" stroke={p.edge} />
      </>
    ),
  },
  {
    id: "laptop",
    nameAr: "حاسوب محمول",
    category: "daily",
    tags: ["حاسوب", "لابتوب", "عمل", "دراسة", "تقنية"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={18} y={20} width={84} height={60} rx={6} fill={p.dark} />
        <rect {...S(p)} x={24} y={26} width={72} height={48} rx={2} fill={screen(p)} />
        <rect x={24} y={26} width={72} height={8} fill={blk(p, p.main)} {...S(p)} strokeWidth={p.style === "line" ? 2 : 0} />
        <rect {...S(p)} strokeWidth={p.style === "line" ? 2 : 0} x={30} y={40} width={24} height={28} rx={3} fill={blk(p, p.second)} />
        <path {...L(p, 3)} d="M60 44 H88 M60 52 H88 M60 60 H78" opacity={0.4} />
        <path {...S(p)} fill={p.light} d="M6 80 H114 L108 92 Q106 96 100 96 H20 Q14 96 12 92 Z" />
        <rect x={50} y={80} width={20} height={5} rx={2} fill={p.dark} opacity={0.5} />
      </>
    ),
  },
  {
    id: "desktop-monitor",
    nameAr: "شاشة حاسوب",
    category: "daily",
    tags: ["حاسوب", "شاشة", "مكتب", "عمل"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={52} y={78} width={16} height={20} fill={p.dark} />
        <rect {...S(p)} x={32} y={96} width={56} height={10} rx={5} fill={p.dark} />
        <rect {...S(p)} x={8} y={12} width={104} height={70} rx={7} fill={p.dark} />
        <rect {...S(p)} x={15} y={19} width={90} height={56} rx={2} fill={screen(p)} />
        <rect {...S(p)} strokeWidth={p.style === "line" ? 2 : 0} x={20} y={24} width={22} height={46} rx={3} fill={p.light} opacity={p.style === "line" ? 1 : 0.7} />
        <path {...L(p, 3)} d="M25 32 H37 M25 40 H37 M25 48 H33" opacity={0.4} />
        {[0, 1, 2].map((i) => (
          <rect key={i} {...S(p)} strokeWidth={p.style === "line" ? 2 : 0} x={50 + i * 18} y={70 - (i + 2) * 9} width={12} height={(i + 2) * 9} rx={2} fill={blk(p, [p.second, p.accent, p.main][i] ?? p.main)} />
        ))}
      </>
    ),
  },
  {
    id: "tv",
    nameAr: "تلفاز",
    category: "daily",
    tags: ["تلفاز", "شاشة", "مشاهدة", "إعلام"],
    draw: (p) => (
      <>
        <path {...L(p, 4)} stroke={p.edge} d="M60 22 L42 6 M60 22 L80 4" />
        <path {...L(p, 6)} stroke={p.edge} d="M30 92 L22 110 M90 92 L98 110" />
        <rect {...S(p)} x={8} y={22} width={104} height={72} rx={10} fill={p.dark} />
        <rect {...S(p)} x={15} y={29} width={90} height={58} rx={4} fill={screen(p)} />
        <circle {...S(p)} cx={84} cy={46} r={8} fill={p.metal} />
        <path {...S(p)} fill={p.green} d="M15 87 V72 Q36 56 56 70 Q74 60 105 70 V87 Z" />
      </>
    ),
  },
  {
    id: "headphones",
    nameAr: "سماعات رأس",
    category: "daily",
    tags: ["سماعات", "استماع", "عزلة", "صوت"],
    note: "للاستماع إلى درس أو محاضرة؛ لا تُقرن برموز موسيقية.",
    draw: (p) => (
      <>
        <path {...L(p, 10)} stroke={ln(p, p.main)} d="M24 70 V60 Q24 16 60 16 Q96 16 96 60 V70" />
        <rect {...S(p)} x={12} y={58} width={26} height={44} rx={12} fill={p.main} />
        <rect {...S(p)} x={82} y={58} width={26} height={44} rx={12} fill={p.main} />
        <rect {...S(p)} x={32} y={64} width={10} height={32} rx={5} fill={p.dark} />
        <rect {...S(p)} x={78} y={64} width={10} height={32} rx={5} fill={p.dark} />
      </>
    ),
  },
  {
    id: "game-controller",
    nameAr: "يد ألعاب",
    category: "daily",
    tags: ["ألعاب", "لعب", "ترفيه", "إدمان"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d="M32 36 H88 Q108 36 112 62 Q116 92 100 96 Q90 98 82 84 H38 Q30 98 20 96 Q4 92 8 62 Q12 36 32 36 Z" />
        <path {...S(p)} fill={p.dark} d="M30 52 H38 V60 H46 V68 H38 V76 H30 V68 H22 V60 H30 Z" />
        <circle {...S(p)} cx={86} cy={54} r={5.5} fill={p.second} />
        <circle {...S(p)} cx={96} cy={64} r={5.5} fill={p.accent} />
        <circle {...S(p)} cx={76} cy={64} r={5.5} fill={p.light} />
        <circle {...S(p)} cx={86} cy={74} r={5.5} fill={p.metal} />
        <rect x={52} y={52} width={6} height={4} rx={2} fill={ln(p, p.dark)} />
        <rect x={62} y={52} width={6} height={4} rx={2} fill={ln(p, p.dark)} />
      </>
    ),
  },
  {
    id: "wifi",
    nameAr: "شبكة لاسلكية",
    category: "daily",
    tags: ["إنترنت", "شبكة", "اتصال", "واي فاي"],
    draw: (p) => {
      const arc = (r: number) => {
        const d = r * Math.SQRT1_2;
        return `M${60 - d} ${96 - d} A${r} ${r} 0 0 1 ${60 + d} ${96 - d}`;
      };
      return (
        <>
          <path {...L(p, 12)} stroke={ln(p, p.main)} d={arc(64)} />
          <path {...L(p, 12)} stroke={ln(p, p.main)} d={arc(42)} />
          <path {...L(p, 12)} stroke={ln(p, p.main)} d={arc(20)} />
          <circle {...S(p)} cx={60} cy={98} r={9} fill={p.second} />
        </>
      );
    },
  },
  {
    id: "alarm-clock",
    nameAr: "منبه",
    category: "daily",
    tags: ["منبه", "استيقاظ", "فجر", "وقت", "صباح"],
    draw: (p) => (
      <>
        <path {...L(p, 6)} stroke={p.edge} d="M36 96 L26 110 M84 96 L94 110" />
        <path {...S(p)} fill={p.metal} d="M14 38 A18 18 0 0 1 42 16 Z" />
        <path {...S(p)} fill={p.metal} d="M106 38 A18 18 0 0 0 78 16 Z" />
        <rect {...S(p)} x={55} y={14} width={10} height={14} rx={3} fill={p.dark} />
        <circle {...S(p)} cx={60} cy={64} r={42} fill={p.main} />
        <circle {...S(p)} cx={60} cy={64} r={32} fill={p.light} />
        <path {...L(p, 4)} stroke={ln(p, p.dark)} d="M60 36 V42 M60 86 V92 M32 64 H38 M82 64 H88" />
        <path {...L(p, 5)} stroke={ln(p, p.dark)} d="M60 64 V46 M60 64 L74 72" />
        <circle cx={60} cy={64} r={4.5} fill={ln(p, p.main)} />
      </>
    ),
  },
  {
    id: "calendar",
    nameAr: "تقويم",
    category: "daily",
    tags: ["تقويم", "موعد", "أيام", "تخطيط", "شهر"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={14} y={20} width={92} height={90} rx={8} fill={p.light} />
        <path {...S(p)} fill={p.main} d="M14 44 V28 Q14 20 22 20 H98 Q106 20 106 28 V44 Z" />
        <rect {...S(p)} x={32} y={10} width={9} height={20} rx={4.5} fill={p.dark} />
        <rect {...S(p)} x={79} y={10} width={9} height={20} rx={4.5} fill={p.dark} />
        {[0, 1, 2].flatMap((r) =>
          [0, 1, 2, 3].map((c) => {
            const hot = r === 1 && c === 2;
            return (
              <rect
                key={`${r}-${c}`}
                x={23 + c * 19}
                y={53 + r * 18}
                width={14}
                height={12}
                rx={3}
                fill={hot ? (p.style === "line" ? p.second : p.main) : p.style === "line" ? p.light : p.dark}
                opacity={hot ? 1 : p.style === "line" ? 1 : 0.15}
                stroke={p.style === "line" ? p.line : "none"}
                strokeWidth={2}
              />
            );
          }),
        )}
      </>
    ),
  },
  {
    id: "wristwatch",
    nameAr: "ساعة يد",
    category: "daily",
    tags: ["ساعة", "وقت", "موعد", "التزام"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={44} y={6} width={32} height={108} rx={10} fill={p.wood} />
        <path {...L(p, 3)} d="M50 92 H70 M50 100 H70" opacity={0.35} />
        <rect {...S(p)} x={86} y={54} width={8} height={12} rx={3} fill={p.metal} />
        <circle {...S(p)} cx={60} cy={60} r={32} fill={p.metal} />
        <circle {...S(p)} cx={60} cy={60} r={24} fill={p.light} />
        <path {...L(p, 4)} stroke={ln(p, p.dark)} d="M60 60 V44 M60 60 L72 66" />
        <circle cx={60} cy={60} r={3.5} fill={ln(p, p.dark)} />
      </>
    ),
  },
  {
    id: "car",
    nameAr: "سيارة",
    category: "daily",
    tags: ["سيارة", "سفر", "طريق", "تنقل"],
    draw: (p) => (
      <>
        <ellipse cx={60} cy={100} rx={52} ry={4} fill={p.shadow} />
        <path {...S(p)} fill={p.main} d="M8 84 V68 Q8 58 18 56 L32 54 L44 36 Q48 30 56 30 H80 Q88 30 92 36 L104 54 Q114 56 114 68 V84 Q114 88 110 88 H12 Q8 88 8 84 Z" />
        <path {...S(p)} fill={screen(p)} d="M50 37 H64 V54 H38 Z" />
        <path {...S(p)} fill={screen(p)} d="M70 37 H84 Q86 37 87 39 L96 54 H70 Z" />
        <rect {...S(p)} x={104} y={62} width={8} height={7} rx={2} fill={p.accent} />
        <path {...L(p, 3)} d="M66 60 V84 M72 66 H78" opacity={0.35} />
        {[32, 90].map((x) => (
          <g key={x}>
            <circle {...S(p)} cx={x} cy={88} r={13} fill={p.dark} />
            <circle cx={x} cy={88} r={5} fill={p.light} />
          </g>
        ))}
      </>
    ),
  },
  {
    id: "bus",
    nameAr: "حافلة",
    category: "daily",
    tags: ["حافلة", "باص", "مدرسة", "تنقل", "رحلة"],
    draw: (p) => (
      <>
        <ellipse cx={60} cy={104} rx={54} ry={4} fill={p.shadow} />
        <rect {...S(p)} x={6} y={24} width={108} height={70} rx={12} fill={p.metal} />
        {[14, 36, 58].map((x) => (
          <rect key={x} {...S(p)} x={x} y={34} width={18} height={22} rx={3} fill={screen(p)} />
        ))}
        <rect {...S(p)} x={82} y={34} width={22} height={50} rx={3} fill={screen(p)} />
        <path {...L(p, 3)} d="M93 34 V84" opacity={0.4} />
        <rect x={6} y={64} width={74} height={6} fill={ln(p, p.dark)} opacity={p.style === "line" ? 0.3 : 0.25} />
        <rect {...S(p)} x={108} y={70} width={6} height={10} rx={2} fill={p.accent} />
        {[28, 68].map((x) => (
          <g key={x}>
            <circle {...S(p)} cx={x} cy={94} r={12} fill={p.dark} />
            <circle cx={x} cy={94} r={4.5} fill={p.light} />
          </g>
        ))}
      </>
    ),
  },
  {
    id: "bicycle",
    nameAr: "دراجة",
    category: "daily",
    tags: ["دراجة", "رياضة", "توازن", "حركة"],
    draw: (p) => (
      <>
        <circle {...L(p, 7)} stroke={p.edge} cx={28} cy={80} r={22} />
        <circle {...L(p, 7)} stroke={p.edge} cx={92} cy={80} r={22} />
        <path {...L(p, 6)} stroke={ln(p, p.main)} d="M28 80 L56 80 L46 50 Z M56 80 L84 48 L46 50 M84 48 L92 80" />
        <path {...L(p, 6)} stroke={p.edge} d="M84 48 L80 36 M74 36 H90 M46 50 L44 42" />
        <rect {...S(p)} x={34} y={36} width={20} height={7} rx={3.5} fill={p.dark} />
        <circle {...S(p)} cx={56} cy={80} r={5} fill={p.second} />
        <circle cx={28} cy={80} r={4} fill={p.edge} />
        <circle cx={92} cy={80} r={4} fill={p.edge} />
      </>
    ),
  },
  {
    id: "road",
    nameAr: "طريق",
    category: "daily",
    tags: ["طريق", "مسار", "رحلة", "مستقبل", "سفر"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.style === "line" ? p.light : p.dark} d="M6 112 L52 16 H68 L114 112 Z" />
        <path {...L(p, 3)} stroke={p.style === "line" ? p.line : p.light} d="M16 108 L54 22 M104 108 L66 22" opacity={0.7} />
        <path fill={p.style === "line" ? p.second : p.metal} d="M58 22 H62 L62.6 32 H57.4 Z M57 42 H63 L64 58 H56 Z M55 70 H65 L67 94 H53 Z" stroke={p.stroke} strokeWidth={p.style === "line" ? 2 : 0} />
      </>
    ),
  },
  {
    id: "traffic-light",
    nameAr: "إشارة مرور",
    category: "daily",
    tags: ["إشارة", "توقف", "انتظار", "قواعد", "مرور"],
    draw: (p) => (
      <>
        <path {...L(p, 7)} stroke={p.edge} d="M60 92 V112" />
        <rect {...S(p)} x={36} y={6} width={48} height={88} rx={14} fill={p.dark} />
        <circle {...S(p)} cx={60} cy={26} r={11} fill={p.style === "line" ? p.light : p.main} />
        <circle {...S(p)} cx={60} cy={50} r={11} fill={p.style === "line" ? p.light : p.metal} opacity={p.style === "line" ? 1 : 0.45} />
        <circle {...S(p)} cx={60} cy={74} r={11} fill={p.green} opacity={p.style === "line" ? 1 : 0.45} />
        <circle cx={56} cy={22} r={3} fill={p.light} opacity={0.7} />
      </>
    ),
  },
  {
    id: "briefcase",
    nameAr: "حقيبة عمل",
    category: "daily",
    tags: ["عمل", "وظيفة", "مهنة", "كسب"],
    draw: (p) => (
      <>
        <path {...L(p, 7)} stroke={p.edge} d="M44 36 V28 Q44 20 52 20 H68 Q76 20 76 28 V36" />
        <rect {...S(p)} x={10} y={36} width={100} height={70} rx={9} fill={p.wood} />
        <path {...L(p, 3)} d="M10 62 H110" opacity={0.35} />
        <rect {...S(p)} x={52} y={56} width={16} height={14} rx={3} fill={p.metal} />
      </>
    ),
  },
  {
    id: "glasses",
    nameAr: "نظارة",
    category: "daily",
    tags: ["نظارة", "رؤية", "بصيرة", "قراءة"],
    draw: (p) => (
      <>
        <path {...L(p, 6)} stroke={p.edge} d="M14 56 L6 46 M106 56 L114 46 M52 56 Q60 48 68 56" />
        {[32, 88].map((x) => (
          <g key={x}>
            <circle cx={x} cy={64} r={20} fill={p.water} opacity={p.style === "line" ? 0.6 : 0.4} />
            <circle {...L(p, 7)} stroke={p.edge} cx={x} cy={64} r={20} />
            <path d={`M${x - 10} ${60} Q${x - 8} ${52} ${x - 1} ${50}`} stroke={p.light} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.8} />
          </g>
        ))}
      </>
    ),
  },
  {
    id: "pen",
    nameAr: "قلم حبر",
    category: "daily",
    tags: ["قلم", "كتابة", "توقيع", "عمل"],
    draw: (p) => (
      <g transform="rotate(-45 60 60)">
        <path {...S(p)} fill={p.metal} d="M90 51 L110 60 L90 69 Z" />
        <circle cx={108} cy={60} r={2.2} fill={ln(p, p.dark)} />
        <rect {...S(p)} x={10} y={50} width={84} height={20} rx={8} fill={p.main} />
        <rect {...S(p)} x={10} y={50} width={32} height={20} rx={8} fill={p.dark} />
        <rect {...S(p)} x={14} y={43} width={28} height={6} rx={3} fill={p.metal} />
        <path {...L(p, 3)} d="M50 55 H86" stroke={ln(p, p.light)} opacity={0.4} />
      </g>
    ),
  },
  {
    id: "pencil",
    nameAr: "قلم رصاص",
    category: "daily",
    tags: ["قلم", "رسم", "مذاكرة", "مدرسة", "تعلم"],
    draw: (p) => (
      <g transform="rotate(-45 60 60)">
        <path {...S(p)} fill={p.wood} d="M86 50 L110 60 L86 70 Z" />
        <path fill={ln(p, p.dark)} d="M102 56.7 L110 60 L102 63.3 Z" />
        <rect {...S(p)} x={26} y={50} width={62} height={20} fill={p.metal} />
        <path {...L(p, 2.5)} d="M28 57 H86 M28 63 H86" opacity={0.3} />
        <rect {...S(p)} x={10} y={50} width={14} height={20} rx={5} fill={p.main} />
        <rect {...S(p)} x={20} y={50} width={10} height={20} fill={p.second} />
      </g>
    ),
  },
  {
    id: "notebook",
    nameAr: "دفتر",
    category: "daily",
    tags: ["دفتر", "تدوين", "مذاكرة", "ملاحظات"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={26} y={10} width={78} height={100} rx={7} fill={p.main} />
        <rect {...S(p)} x={44} y={30} width={46} height={26} rx={4} fill={p.light} />
        <path {...L(p, 3)} d="M52 40 H82 M52 47 H72" opacity={0.4} />
        <rect x={92} y={10} width={6} height={100} fill={p.dark} opacity={0.2} />
        {[20, 34, 48, 62, 76, 90].map((y) => (
          <path key={y} {...L(p, 5)} stroke={p.edge} d={`M18 ${y} H34`} />
        ))}
      </>
    ),
  },
  {
    id: "checklist",
    nameAr: "قائمة مهام",
    category: "daily",
    tags: ["مهام", "تخطيط", "إنجاز", "قائمة", "تنظيم"],
    draw: (p) => (
      <>
        <rect {...S(p)} x={18} y={14} width={84} height={98} rx={8} fill={p.wood} />
        <rect {...S(p)} x={26} y={24} width={68} height={80} rx={3} fill={p.light} />
        <rect {...S(p)} x={42} y={8} width={36} height={14} rx={4} fill={p.metal} />
        {[36, 58, 80].map((y, i) => (
          <g key={y}>
            <rect x={33} y={y} width={13} height={13} rx={3} fill={i < 2 ? p.second : "none"} stroke={ln(p, p.dark)} strokeWidth={2.5} strokeOpacity={p.style === "line" ? 1 : 0.6} />
            {i < 2 && <path {...L(p, 3.5)} stroke={ln(p, p.dark)} d={`M36 ${y + 6.5} L39 ${y + 9.5} L44 ${y + 3}`} />}
            <path {...L(p, 3)} d={`M54 ${y + 6.5} H${i === 1 ? 76 : 86}`} opacity={0.4} />
          </g>
        ))}
      </>
    ),
  },
  {
    id: "trophy",
    nameAr: "كأس فوز",
    category: "daily",
    tags: ["فوز", "نجاح", "إنجاز", "تفوق", "جائزة"],
    draw: (p) => (
      <>
        <path {...L(p, 7)} stroke={ln(p, p.metal)} d="M32 26 H20 Q12 26 14 40 Q16 54 34 58 M88 26 H100 Q108 26 106 40 Q104 54 86 58" />
        <rect {...S(p)} x={53} y={72} width={14} height={18} fill={p.metal} />
        <path {...S(p)} fill={p.metal} d="M30 14 H90 V44 Q90 76 60 76 Q30 76 30 44 Z" />
        <polygon {...S(p)} fill={p.light} points={star(60, 42, 12, 5)} strokeWidth={p.style === "line" ? 2 : 0} />
        <rect {...S(p)} x={38} y={88} width={44} height={10} rx={3} fill={p.dark} />
        <rect {...S(p)} x={30} y={98} width={60} height={12} rx={3} fill={p.wood} />
      </>
    ),
  },
  {
    id: "medal",
    nameAr: "ميدالية",
    category: "daily",
    tags: ["ميدالية", "فوز", "تكريم", "إنجاز"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d="M30 8 H52 L70 56 H50 Z" />
        <path {...S(p)} fill={p.second} d="M90 8 H68 L50 56 H70 Z" />
        <circle {...S(p)} cx={60} cy={80} r={30} fill={p.metal} />
        <circle {...L(p, 3)} cx={60} cy={80} r={21} opacity={0.4} />
        <polygon {...S(p)} fill={p.light} points={star(60, 80, 14, 6)} strokeWidth={p.style === "line" ? 2 : 0} />
      </>
    ),
  },
  {
    id: "ladder",
    nameAr: "سلم خشبي",
    category: "daily",
    tags: ["سلم", "صعود", "ترقي", "خطوات", "تدرج"],
    draw: (p) => (
      <>
        {[22, 44, 66, 88].map((y) => (
          <rect key={y} {...S(p)} x={34} y={y} width={52} height={8} rx={2} fill={p.wood} />
        ))}
        <rect {...S(p)} x={26} y={6} width={10} height={108} rx={4} fill={p.wood} />
        <rect {...S(p)} x={84} y={6} width={10} height={108} rx={4} fill={p.wood} />
      </>
    ),
  },
  {
    id: "ticket",
    nameAr: "تذكرة",
    category: "daily",
    tags: ["تذكرة", "دخول", "سفر", "رحلة", "فرصة"],
    draw: (p) => (
      <g transform="rotate(-12 60 60)">
        <path {...S(p)} fill={p.main} d="M10 34 Q10 30 14 30 H106 Q110 30 110 34 V50 Q100 50 100 60 Q100 70 110 70 V86 Q110 90 106 90 H14 Q10 90 10 86 V70 Q20 70 20 60 Q20 50 10 50 Z" />
        <path {...L(p, 3)} stroke={ln(p, p.light)} strokeDasharray="4 6" d="M82 34 V86" opacity={p.style === "line" ? 1 : 0.7} />
        <rect {...L(p, 3)} stroke={ln(p, p.light)} x={28} y={42} width={44} height={36} rx={4} opacity={p.style === "line" ? 0.5 : 0.5} />
        <polygon fill={p.style === "line" ? p.second : p.light} points={star(50, 60, 11, 5)} stroke={p.stroke} strokeWidth={p.style === "line" ? 2 : 0} strokeLinejoin="round" />
      </g>
    ),
  },
  {
    id: "camera",
    nameAr: "كاميرا",
    category: "daily",
    tags: ["كاميرا", "تصوير", "صورة", "توثيق"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d="M38 34 L44 22 Q46 18 50 18 H70 Q74 18 76 22 L82 34 Z" />
        <rect {...S(p)} x={16} y={26} width={14} height={8} rx={2} fill={p.dark} />
        <rect {...S(p)} x={8} y={32} width={104} height={74} rx={12} fill={p.main} />
        <rect x={8} y={56} width={104} height={26} fill={p.dark} opacity={p.style === "line" ? 0 : 0.25} />
        <circle {...S(p)} cx={60} cy={68} r={28} fill={p.dark} />
        <circle {...S(p)} cx={60} cy={68} r={20} fill={p.water} />
        <circle cx={60} cy={68} r={9} fill={p.dark} />
        <circle cx={53} cy={61} r={4} fill={p.light} opacity={0.8} />
        <rect {...S(p)} x={92} y={40} width={12} height={8} rx={2} fill={p.light} />
      </>
    ),
  },
  {
    id: "shopping-bag",
    nameAr: "كيس تسوق",
    category: "daily",
    tags: ["تسوق", "شراء", "سوق", "استهلاك"],
    draw: (p) => (
      <>
        <path {...L(p, 6)} stroke={p.edge} d="M42 52 V34 Q42 16 60 16 Q78 16 78 34 V52" />
        <path {...S(p)} fill={p.main} d="M24 38 H96 Q100 38 100 42 L104 106 Q104 110 100 110 H20 Q16 110 16 106 L20 42 Q20 38 24 38 Z" />
        <circle cx={42} cy={52} r={4} fill={p.style === "line" ? p.line : p.dark} />
        <circle cx={78} cy={52} r={4} fill={p.style === "line" ? p.line : p.dark} />
        <path {...S(p)} fill={p.second} d="M44 80 Q44 70 54 70 Q60 70 60 76 Q60 70 66 70 Q76 70 76 80 Q76 90 60 98 Q44 90 44 80 Z" />
      </>
    ),
  },
  {
    id: "social-like",
    nameAr: "إعجاب",
    category: "daily",
    tags: ["إعجاب", "تواصل", "تفاعل", "شهرة", "رياء"],
    draw: (p) => (
      <>
        <path {...S(p)} fill={p.main} d="M14 22 Q14 12 24 12 H96 Q106 12 106 22 V80 Q106 90 96 90 H52 L32 108 V90 H24 Q14 90 14 80 Z" />
        <rect {...S(p)} x={32} y={46} width={12} height={32} rx={2} fill={p.light} />
        <path {...S(p)} fill={p.light} d="M48 46 L58 28 Q62 22 68 25 Q73 28 71 36 L68 44 H82 Q90 44 88 52 L84 72 Q82 78 76 78 H48 Z" />
      </>
    ),
  },
];
