import React from "react";

/**
 * «أماكن التصوير»: خلفيات كاملة مرسومة (1920×1080) بأسلوب مسطح بخط خارجي، فيها حركة خفيفة
 * (بخار، أضواء، نجوم، أوراق). القوالب تضع الشخصيات فوقها على خط الأرض floorY.
 * كل مكان يذكر القنوات التي يناسبها، وتستعمله مكتبة الاستوديو وفحص التنوّع.
 */
export type SetDef = {
  id: string;
  nameAr: string;
  tags: string[];
  /** القنوات التي يناسبها (فارغ = كل القنوات) */
  channels?: string[];
  /** خط الأرض الذي تقف عليه الشخصيات */
  floorY: number;
  /** لون الحبر المناسب للشخصية فوق هذه الخلفية (ليلي/نهاري) */
  mood: "day" | "night";
  draw: (t: number) => React.ReactNode;
};

const ink = "#2A2F3A";
const S = { stroke: ink, strokeWidth: 5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const L = (w = 5, c = ink) => ({ stroke: c, strokeWidth: w, strokeLinecap: "round" as const, fill: "none" });

const steam = (x: number, y: number, t: number, op = 0.35) => (
  <path {...L(3)} opacity={op} d={`M${x} ${y} q 10 -${14 + Math.sin(t * 3) * 4} 0 -28 q -10 -14 0 -28 M${x + 22} ${y + 4} q 10 -${16 + Math.cos(t * 3) * 4} 0 -30`} />
);

/** المكتب: نافذة على المدينة، رف أيقونات، مكتب جانبي */
const office: SetDef = {
  id: "office",
  nameAr: "مكتب",
  tags: ["عمل", "دراسة", "هاتف", "حاسوب", "يومي"],
  floorY: 940,
  mood: "day",
  draw: (t) => (
    <>
      <rect x={0} y={0} width={1920} height={1080} fill="#F4F6EF" />
      <path d="M0 0 H760 L560 520 L0 700 Z" fill="#D6ECF3" opacity={0.75} />
      <path d="M1300 0 H1920 V560 L1480 420 Z" fill="#FBEFCF" opacity={0.8} />
      <rect x={0} y={940} width={1920} height={140} fill="#E7E1D3" />
      <line {...L(4)} x1={0} y1={940} x2={1920} y2={940} opacity={0.4} />
      <rect {...S} x={180} y={170} width={380} height={420} rx={10} fill="#fff" />
      <rect x={204} y={194} width={332} height={372} fill="#E1F1F8" />
      <path fill="#BCDCEB" d="M204 566 V440 H250 V380 H300 V460 H340 V340 H400 V430 H440 V370 H490 V450 H536 V566 Z" />
      <line {...S} stroke="#fff" strokeWidth={9} x1={370} y1={194} x2={370} y2={566} />
      <rect {...S} x={160} y={586} width={420} height={24} rx={6} fill="#fff" />
      {[["#E8B23A", 1340], ["#B9C6D6", 1430], ["#fff", 1520]].map(([c, x], i) => <rect key={i} {...S} strokeWidth={4} x={x as number} y={200} width={64} height={64} rx={14} fill={c as string} />)}
      <rect {...S} x={1300} y={286} width={320} height={14} rx={4} fill="#fff" />
      {[["#7FB7D9", 1330, 80], ["#F2C14E", 1358, 66], ["#8CC79A", 1384, 86], ["#E58F6A", 1412, 72]].map(([c, x, h], i) => <rect key={i} {...S} strokeWidth={4} x={x as number} y={400 - (h as number)} width={26} height={h as number} rx={3} fill={c as string} />)}
      <rect {...S} x={1300} y={400} width={320} height={14} rx={4} fill="#fff" />
      <rect {...S} x={1260} y={700} width={560} height={26} rx={6} fill="#DCE0E6" />
      <rect {...S} x={1260} y={724} width={560} height={20} fill="#C99A63" />
      <rect {...S} x={1290} y={742} width={24} height={198} fill="#C99A63" />
      <rect {...S} x={1766} y={742} width={24} height={198} fill="#C99A63" />
      <rect {...S} x={1380} y={560} width={240} height={140} rx={10} fill="#3B4660" />
      <rect x={1396} y={576} width={208} height={108} rx={4} fill="#A9DCEB" opacity={0.6 + 0.1 * Math.sin(t * 2)} />
      <rect {...S} x={1480} y={700} width={40} height={0} />
      <path {...S} fill="#EEE7DC" d="M1680 650 H1730 V694 Q1730 702 1722 702 H1688 Q1680 702 1680 694 Z" />
      {steam(1694, 640, t)}
    </>
  ),
};

/** المطبخ: بلاط، خزائن، ثلاجة، قدر يغلي */
const kitchen: SetDef = {
  id: "kitchen",
  nameAr: "مطبخ البيت",
  tags: ["أسرة", "بيت", "أم", "طعام", "رزق"],
  floorY: 950,
  mood: "day",
  draw: (t) => (
    <>
      <rect x={0} y={0} width={1920} height={1080} fill="#FBF6EC" />
      {Array.from({ length: 16 }, (_, i) => Array.from({ length: 4 }, (_, j) => <rect key={`${i}-${j}`} x={i * 120} y={420 + j * 60} width={118} height={58} fill={(i + j) % 2 ? "#E6F1EE" : "#F1F7F4"} />))}
      <rect x={0} y={950} width={1920} height={130} fill="#E2D4BC" />
      {Array.from({ length: 12 }, (_, i) => <line key={i} {...L(3)} opacity={0.2} x1={i * 180} y1={950} x2={i * 180 - 80} y2={1080} />)}
      {/* خزائن علوية */}
      {[120, 420, 1080, 1380].map((x) => <rect key={x} {...S} x={x} y={120} width={280} height={250} rx={10} fill="#8DB8A8" />)}
      {[120, 420, 1080, 1380].map((x) => <circle key={x} cx={x + 140} cy={330} r={9} fill={ink} />)}
      {/* نافذة */}
      <rect {...S} x={740} y={150} width={300} height={240} rx={10} fill="#fff" />
      <rect x={760} y={170} width={260} height={200} fill="#DDF0FA" />
      <circle cx={940} cy={230} r={34} fill="#F7D774" opacity={0.9} />
      <line {...S} stroke="#fff" strokeWidth={8} x1={890} y1={170} x2={890} y2={370} />
      {/* سطح العمل */}
      <rect {...S} x={60} y={660} width={1500} height={30} rx={6} fill="#F0E6D6" />
      <rect {...S} x={80} y={690} width={1460} height={260} fill="#8DB8A8" />
      {[80, 445, 810, 1175].map((x) => <rect key={x} {...S} x={x + 20} y={712} width={325} height={210} rx={8} fill="#9CC5B5" />)}
      {/* موقد وقدر */}
      <rect {...S} x={300} y={640} width={260} height={22} rx={4} fill="#3B4660" />
      <path {...S} fill="#D86B4A" d="M330 560 H530 V630 Q530 650 510 650 H350 Q330 650 330 630 Z" />
      <rect {...S} x={320} y={548} width={220} height={18} rx={6} fill="#C25A3B" />
      {steam(400, 540, t, 0.45)}
      {steam(460, 536, t + 1, 0.4)}
      {/* ثلاجة */}
      <rect {...S} x={1610} y={300} width={250} height={650} rx={18} fill="#EEF2F5" />
      <line {...S} x1={1610} y1={560} x2={1860} y2={560} />
      <line {...S} x1={1640} y1={360} x2={1640} y2={440} strokeWidth={8} />
      <line {...S} x1={1640} y1={600} x2={1640} y2={720} strokeWidth={8} />
      {/* سلة فاكهة */}
      <path {...S} fill="#C99A63" d="M1100 610 H1260 L1240 660 H1120 Z" />
      {[[1140, "#E5534B"], [1180, "#F2C14E"], [1220, "#8CC79A"]].map(([x, c]) => <circle key={x as number} {...S} strokeWidth={4} cx={x as number} cy={600} r={24} fill={c as string} />)}
    </>
  ),
};

/** شارع بالليل: عمارات بنوافذ مضاءة، عمود إنارة، قمر */
const streetNight: SetDef = {
  id: "street-night",
  nameAr: "شارع بالليل",
  tags: ["ليل", "مدينة", "وحدة", "تفكير", "طريق"],
  floorY: 930,
  mood: "night",
  draw: (t) => (
    <>
      <defs>
        <linearGradient id="sn-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#141B33" /><stop offset="1" stopColor="#2D3A63" /></linearGradient>
        <radialGradient id="sn-lamp"><stop offset="0" stopColor="#FFE7A3" stopOpacity={0.55} /><stop offset="1" stopColor="#FFE7A3" stopOpacity={0} /></radialGradient>
      </defs>
      <rect x={0} y={0} width={1920} height={1080} fill="url(#sn-sky)" />
      {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 197) % 1920} cy={(i * 73) % 380} r={i % 3 ? 2 : 3} fill="#fff" opacity={0.3 + 0.5 * Math.abs(Math.sin(t * 1.5 + i))} />)}
      <circle cx={1600} cy={170} r={70} fill="#F4EBD0" />
      <circle cx={1630} cy={150} r={70} fill="#2A3660" opacity={0.25} />
      {[[0, 380, 260], [260, 300, 220], [480, 440, 300], [1180, 340, 260], [1440, 260, 240], [1680, 400, 240]].map(([x, y, w], i) => (
        <g key={i}>
          <rect {...S} stroke="#0D1226" x={x} y={y} width={w} height={930 - (y as number)} fill={i % 2 ? "#273257" : "#1F2A4A"} />
          {Array.from({ length: Math.floor(((930 - (y as number)) - 60) / 70) }, (_, r) => Array.from({ length: Math.floor((w as number) / 70) }, (_, c) => {
            const on = (r * 7 + c * 3 + i) % 4 !== 0;
            return <rect key={`${r}-${c}`} x={(x as number) + 24 + c * 70} y={(y as number) + 30 + r * 70} width={34} height={40} rx={3} fill={on ? "#F7D774" : "#3A4670"} opacity={on ? 0.85 : 1} />;
          }))}
        </g>
      ))}
      <rect x={0} y={930} width={1920} height={150} fill="#1A2140" />
      <rect x={0} y={930} width={1920} height={26} fill="#3A4670" />
      {Array.from({ length: 10 }, (_, i) => <rect key={i} x={i * 220 + 40} y={1010} width={120} height={10} rx={5} fill="#F2E2A0" opacity={0.6} />)}
      <circle cx={980} cy={420} r={260} fill="url(#sn-lamp)" opacity={0.85 + 0.15 * Math.sin(t * 4)} />
      <rect {...S} stroke="#0D1226" x={968} y={420} width={22} height={510} fill="#4A5680" />
      <path {...S} stroke="#0D1226" fill="#4A5680" d="M940 420 H1018 L1004 380 H954 Z" />
      <rect x={952} y={420} width={54} height={18} fill="#FFE7A3" />
    </>
  ),
};

/** فصل دراسي: سبورة، ساعة، مقاعد */
const classroom: SetDef = {
  id: "classroom",
  nameAr: "فصل دراسي",
  tags: ["تعليم", "طالب", "معلم", "علم", "امتحان"],
  floorY: 950,
  mood: "day",
  draw: (t) => (
    <>
      <rect x={0} y={0} width={1920} height={1080} fill="#F6F1E4" />
      <rect x={0} y={620} width={1920} height={330} fill="#EADFC8" />
      <rect x={0} y={950} width={1920} height={130} fill="#C9A77C" />
      {Array.from({ length: 14 }, (_, i) => <line key={i} {...L(3)} opacity={0.18} x1={i * 150} y1={950} x2={i * 150} y2={1080} />)}
      <rect {...S} x={420} y={140} width={1080} height={420} rx={14} fill="#2F5B4A" />
      <rect {...S} x={420} y={140} width={1080} height={420} rx={14} fill="none" stroke="#B4884F" strokeWidth={16} />
      <path {...L(5, "#F2EFE6")} opacity={0.85} d="M520 260 q 60 -40 120 0 t 120 0 M520 340 H900 M520 400 H780" />
      <circle {...L(5, "#F2EFE6")} opacity={0.8} cx={1220} cy={330} r={90} />
      <path {...L(5, "#F2EFE6")} opacity={0.8} d="M1130 330 H1310 M1220 240 V420" />
      <rect {...S} x={760} y={556} width={400} height={18} rx={4} fill="#B4884F" />
      <circle {...S} cx={1720} cy={220} r={70} fill="#fff" />
      <line {...L(6)} x1={1720} y1={220} x2={1720 + Math.sin(t * 0.5) * 44} y2={220 - Math.cos(t * 0.5) * 44} />
      <line {...L(6)} x1={1720} y1={220} x2={1760} y2={232} />
      <rect {...S} x={100} y={180} width={220} height={320} rx={10} fill="#fff" />
      <rect x={118} y={198} width={184} height={284} fill="#DDF0FA" />
      <path fill="#A8D5A2" d="M118 482 Q170 400 230 440 Q270 410 302 450 V482 Z" />
      {([[260, 800], [700, 800], [1140, 800], [1580, 800]] as [number, number][]).map(([x, y]) => (
        <g key={x}>
          <rect {...S} x={x} y={y} width={240} height={24} rx={4} fill="#D9B98A" />
          <rect {...S} x={x + 16} y={y + 24} width={16} height={126} fill="#8C6A44" />
          <rect {...S} x={x + 208} y={y + 24} width={16} height={126} fill="#8C6A44" />
          <rect {...S} strokeWidth={4} x={x + 70} y={y - 14} width={90} height={14} rx={3} fill="#7FB7D9" />
        </g>
      ))}
    </>
  ),
};

/** سوق قديم: أقواس، مظلات، صناديق فاكهة، فوانيس */
const market: SetDef = {
  id: "market",
  nameAr: "سوق",
  tags: ["تجارة", "بيع", "شراء", "مال", "تاريخ", "أمانة"],
  floorY: 950,
  mood: "day",
  draw: (t) => (
    <>
      <rect x={0} y={0} width={1920} height={1080} fill="#F7E6C8" />
      <rect x={0} y={0} width={1920} height={260} fill="#BFE0EC" />
      {[0, 480, 960, 1440].map((x) => (
        <g key={x}>
          <path {...S} fill="#E8CFA3" d={`M${x} 260 H${x + 480} V950 H${x + 420} V520 Q${x + 240} 330 ${x + 60} 520 V950 H${x} Z`} />
          <path {...L(4)} opacity={0.25} d={`M${x + 90} 560 Q${x + 240} 400 ${x + 390} 560`} />
        </g>
      ))}
      <rect x={0} y={950} width={1920} height={130} fill="#D8B98C" />
      {Array.from({ length: 30 }, (_, i) => <rect key={i} x={(i * 140) % 1920} y={970 + (i % 3) * 36} width={110} height={26} rx={4} fill="#CBA977" opacity={0.6} />)}
      {[[120, "#C2453A"], [600, "#2F7A8C"], [1080, "#D19A2A"], [1560, "#5B7F3A"]].map(([x, c], i) => (
        <g key={i}>
          <path {...S} fill={c as string} d={`M${x} 560 H${(x as number) + 300} L${(x as number) + 330} 640 H${(x as number) - 30} Z`} />
          {Array.from({ length: 6 }, (_, k) => <path key={k} fill="#fff" opacity={0.35} d={`M${(x as number) + k * 55} 560 h 27 l 4 80 h -27 Z`} />)}
          <rect {...S} x={(x as number) + 10} y={800} width={280} height={150} rx={6} fill="#B4884F" />
          {Array.from({ length: 5 }, (_, k) => <circle key={k} {...S} strokeWidth={4} cx={(x as number) + 45 + k * 52} cy={790} r={24} fill={["#E5534B", "#F2C14E", "#8CC79A", "#E58F6A", "#C2453A"][(k + i) % 5]} />)}
        </g>
      ))}
      {[340, 820, 1300, 1780].map((x, i) => {
        const sw = Math.sin(t * 1.6 + i) * 4;
        return (
          <g key={x} transform={`rotate(${sw} ${x} 270)`}>
            <line {...L(3)} x1={x} y1={260} x2={x} y2={330} />
            <path {...S} fill="#E8B23A" d={`M${x - 22} 330 H${x + 22} L${x + 30} 380 L${x} 410 L${x - 30} 380 Z`} />
            <circle cx={x} cy={370} r={40} fill="#FFE7A3" opacity={0.25 + 0.1 * Math.sin(t * 3 + i)} />
          </g>
        );
      })}
    </>
  ),
};

/** صحراء بالليل: كثبان، نجوم تلمع، نخلة، خيمة */
const desertNight: SetDef = {
  id: "desert-night",
  nameAr: "صحراء تحت السماء",
  tags: ["تأمل", "سفر", "تاريخ", "نجوم", "صبر", "هجرة"],
  floorY: 900,
  mood: "night",
  draw: (t) => (
    <>
      <defs>
        <linearGradient id="dn-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0E1430" /><stop offset="0.7" stopColor="#3B3363" /><stop offset="1" stopColor="#8A5A6E" /></linearGradient>
      </defs>
      <rect x={0} y={0} width={1920} height={1080} fill="url(#dn-sky)" />
      {Array.from({ length: 90 }, (_, i) => <circle key={i} cx={(i * 211) % 1920} cy={(i * 97) % 620} r={i % 5 ? 1.8 : 3.2} fill="#fff" opacity={0.25 + 0.6 * Math.abs(Math.sin(t * 1.2 + i * 1.7))} />)}
      <path d="M200 120 Q900 40 1700 160" stroke="#fff" strokeWidth={60} opacity={0.05} fill="none" />
      <circle cx={360} cy={200} r={64} fill="#F4EBD0" />
      <circle cx={392} cy={182} r={60} fill="#1A1F44" />
      <path fill="#6E4A55" d="M0 760 Q300 640 640 740 T1300 720 T1920 700 V1080 H0 Z" />
      <path fill="#8E6150" d="M0 860 Q420 760 900 860 T1920 830 V1080 H0 Z" />
      <path fill="#A9775C" d="M0 940 Q600 880 1200 950 T1920 930 V1080 H0 Z" />
      <g transform="translate(1500 700)">
        <path {...S} stroke="#1A1F44" fill="#4A2E2E" d="M0 200 Q10 100 -6 0" strokeWidth={14} />
        {[-60, -20, 20, 60, 100].map((a, i) => <path key={i} fill="#2E4A3A" transform={`rotate(${a + Math.sin(t + i) * 3} -6 0)`} d="M-6 0 Q60 -30 120 10 Q60 -10 -6 0 Z" />)}
      </g>
      <path {...S} stroke="#1A1F44" fill="#C98B5E" d="M1640 900 L1760 760 L1880 900 Z" />
      <path fill="#2A1A1A" d="M1740 900 L1760 820 L1780 900 Z" />
      <circle cx={1760} cy={880} r={60} fill="#FFB65C" opacity={0.12 + 0.06 * Math.sin(t * 5)} />
    </>
  ),
};

export const sets: SetDef[] = [office, kitchen, streetNight, classroom, market, desertNight];
export const setById = (id: string) => sets.find((s) => s.id === id);

/** يرسم مكانًا كاملًا داخل SVG بإطار 1920×1080 */
export const SetBackdrop: React.FC<{ id: string; t: number }> = ({ id, t }) => {
  const def = setById(id) ?? office;
  return <>{def.draw(t)}</>;
};
