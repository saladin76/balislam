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


/** جمل يمشي (منظر جانبي متجه يسارًا): أرجل تتأرجح بخطوة متبادلة، ورأس يهتز، وحمولة اختيارية */
const WalkingCamel: React.FC<{ x: number; y: number; s: number; t: number; phase: number; load?: boolean; tone?: string }> = ({ x, y, s, t, phase, load, tone = "#7A5434" }) => {
  const w = t * 4.2 + phase;
  const leg = (hx: number, a: number, k: number) => {
    const ang = Math.sin(w + a) * 0.38;
    const kx = hx + Math.sin(ang) * 60;
    const ky = 60 + Math.cos(ang) * 60;
    const knee = Math.max(0, Math.sin(w + a + 1.2)) * 0.5;
    const fx = kx + Math.sin(ang - knee) * 58;
    const fy = ky + Math.cos(ang - knee) * 58;
    return <path key={`${hx}-${a}`} {...L(k, ink)} d={`M${hx} 40 L${kx} ${ky} L${fx} ${fy}`} />;
  };
  const bob = Math.abs(Math.sin(w)) * -5;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g transform={`translate(0 ${bob})`}>
        {/* الأرجل البعيدة أغمق */}
        <g opacity={0.75}>{[leg(-46, Math.PI, 11), leg(52, 0, 11)]}</g>
        <path {...S} fill={tone} d="M-80 30 Q-86 -10 -50 -20 Q-30 -70 0 -62 Q20 -80 44 -52 Q70 -40 76 0 Q78 36 50 46 H-60 Q-82 46 -80 30 Z" />
        {/* الرقبة والرأس يتمايلان */}
        <g transform={`rotate(${Math.sin(w * 2) * 3} -78 10)`}>
          <path {...S} fill={tone} d="M-74 18 Q-110 0 -116 -48 Q-120 -74 -100 -80 Q-80 -84 -78 -62 Q-82 -30 -60 -6 Z" />
          <path {...S} fill={tone} d="M-104 -80 Q-140 -86 -150 -70 Q-150 -58 -132 -58 Q-118 -60 -100 -62 Z" />
          <circle cx={-118} cy={-74} r={3} fill={ink} />
        </g>
        {load ? (
          <g>
            <rect {...S} fill="#C9A36B" x={-38} y={-104} width={72} height={40} rx={12} />
            <rect {...S} fill="#8E2F23" x={-44} y={-70} width={84} height={22} rx={6} />
            <path {...L(4, ink)} d="M-30 -104 V-64 M0 -104 V-64 M26 -104 V-64" />
          </g>
        ) : null}
        {[leg(-40, 0, 12), leg(58, Math.PI, 12)]}
        <path {...L(5)} d="M76 0 Q92 10 88 34" />
      </g>
      {/* غبار تحت الأقدام */}
      {[0, 1, 2].map((i) => {
        const life = ((t * 1.6 + i / 3 + phase) % 1 + 1) % 1;
        return <circle key={i} cx={-30 + i * 40 + life * 50} cy={126 - life * 20} r={10 + life * 26} fill="#E9C48E" opacity={(1 - life) * 0.35} />;
      })}
    </g>
  );
};

/** شخص بلا ملامح يمشي بجانب القافلة (ظل بعباءة) */
const Walker: React.FC<{ x: number; y: number; s: number; t: number; phase: number }> = ({ x, y, s, t, phase }) => {
  const w = t * 4.2 + phase;
  const a = Math.sin(w) * 18;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g transform={`translate(0 ${Math.abs(Math.sin(w)) * -4})`}>
        <path {...L(9)} d={`M0 60 l${Math.sin((a * Math.PI) / 180) * 40} 58`} />
        <path {...L(9)} d={`M0 60 l${-Math.sin((a * Math.PI) / 180) * 40} 58`} />
        <path {...S} fill="#5A3E2E" d="M-22 -40 Q-30 20 -28 74 H28 Q30 20 22 -40 Q0 -54 -22 -40 Z" />
        <path {...S} fill="#6B4E38" d="M-20 -46 Q-22 -86 0 -88 Q22 -86 20 -46 Q0 -38 -20 -46 Z" />
        <path {...S} fill="#C9B48E" d="M-24 -70 Q0 -100 24 -70 Q26 -54 22 -48 Q0 -60 -22 -48 Q-26 -56 -24 -70 Z" />
        <path {...L(7)} d={`M-18 -20 Q-34 20 ${-30 + Math.sin(w) * 10} 40`} />
      </g>
    </g>
  );
};

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

/** أسوار مدينة وقلعة عند الفجر: أبراج، رايات ترفرف، بوابة، ومشاعل */
const castleWalls: SetDef = {
  id: "castle-walls",
  nameAr: "أسوار وقلعة",
  tags: ["تاريخ", "حصار", "مدينة", "دفاع", "فتح", "قلعة"],
  channels: ["dafatir-alzaman", "balislam"],
  floorY: 950,
  mood: "day",
  draw: (t) => (
    <>
      <defs>
        <linearGradient id="cw-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3B4A6B" /><stop offset="0.55" stopColor="#D98E6A" /><stop offset="1" stopColor="#F2C98B" /></linearGradient>
      </defs>
      <rect x={0} y={0} width={1920} height={1080} fill="url(#cw-sky)" />
      <circle cx={1500} cy={560} r={90} fill="#FBE3A8" opacity={0.9} />
      {[[200, 160, 0.4], [700, 120, 0.3], [1250, 200, 0.35]].map(([x, y, o], i) => <ellipse key={i} cx={(x as number) + Math.sin(t * 0.2 + i) * 20} cy={y} rx={180} ry={26} fill="#fff" opacity={o} />)}
      <path fill="#8A6B5A" opacity={0.5} d="M0 700 L240 600 L420 680 L640 590 L900 690 L1200 610 L1500 690 L1760 600 L1920 660 V1080 H0 Z" />
      {/* السور */}
      <rect {...S} stroke="#3A2A20" x={-10} y={620} width={1940} height={330} fill="#C9A47A" />
      {Array.from({ length: 34 }, (_, i) => <rect key={i} {...S} stroke="#3A2A20" strokeWidth={4} x={i * 60 - 10} y={590} width={36} height={34} fill="#C9A47A" />)}
      {Array.from({ length: 20 }, (_, r) => Array.from({ length: 6 }, (_, c) => <line key={`${r}-${c}`} x1={r * 100 + (c % 2) * 50} y1={660 + c * 48} x2={r * 100 + (c % 2) * 50 + 80} y2={660 + c * 48} stroke="#A8865E" strokeWidth={3} />))}
      {/* البرجان والبوابة */}
      {[560, 1260].map((x) => (
        <g key={x}>
          <rect {...S} stroke="#3A2A20" x={x} y={420} width={160} height={530} fill="#BF996D" />
          {Array.from({ length: 4 }, (_, i) => <rect key={i} {...S} stroke="#3A2A20" strokeWidth={4} x={x - 6 + i * 44} y={390} width={30} height={34} fill="#BF996D" />)}
          <path {...S} stroke="#3A2A20" fill="#2B1F18" d={`M${x + 60} 560 V520 Q${x + 80} 494 ${x + 100} 520 V560 Z`} />
          <line {...L(4, "#3A2A20")} x1={x + 80} y1={390} x2={x + 80} y2={300} />
          <path fill="#8E2F23" d={`M${x + 80} 300 Q${x + 130} ${310 + Math.sin(t * 4 + x) * 8} ${x + 170} ${300 + Math.sin(t * 4 + x + 1) * 10} L${x + 170} ${350 + Math.sin(t * 4 + x + 1) * 10} Q${x + 130} ${360 + Math.sin(t * 4 + x) * 8} ${x + 80} 350 Z`} />
        </g>
      ))}
      <path {...S} stroke="#3A2A20" fill="#2B1F18" d="M820 950 V760 Q960 640 1100 760 V950 Z" />
      <path {...L(5, "#6B4A30")} d="M850 950 V780 M890 950 V745 M930 950 V728 M970 950 V722 M1010 950 V730 M1050 950 V748 M1080 950 V775" />
      <path {...L(6, "#3A2A20")} d="M820 760 Q960 640 1100 760" />
      {[790, 1130].map((x, i) => (
        <g key={x}>
          <rect {...S} stroke="#3A2A20" x={x - 6} y={760} width={12} height={60} fill="#5A3A22" />
          <path fill="#F2A23A" d={`M${x} ${700 + Math.sin(t * 9 + i) * 4} Q${x + 18} 740 ${x} 760 Q${x - 18} 740 ${x} ${700 + Math.sin(t * 9 + i) * 4} Z`} />
          <circle cx={x} cy={740} r={60} fill="#FFC56B" opacity={0.18 + 0.06 * Math.sin(t * 8 + i)} />
        </g>
      ))}
      <rect x={0} y={950} width={1920} height={130} fill="#B08A63" />
      <path fill="#9C7752" d="M0 990 Q480 960 960 990 T1920 980 V1080 H0 Z" />
    </>
  ),
};

/** صحن قصر: أقواس مزخرفة، نافورة، أشجار نخيل، ونجمة ثمانية في الأرضية */
const palaceCourt: SetDef = {
  id: "palace-court",
  nameAr: "صحن قصر",
  tags: ["قصر", "حكم", "خليفة", "سلطان", "حضارة", "أندلس"],
  channels: ["dafatir-alzaman", "balislam"],
  floorY: 960,
  mood: "day",
  draw: (t) => (
    <>
      <rect x={0} y={0} width={1920} height={1080} fill="#F3E6CF" />
      <rect x={0} y={0} width={1920} height={110} fill="#CDB38A" />
      {Array.from({ length: 48 }, (_, i) => <path key={i} fill="#B8955F" d={`M${i * 40} 110 l20 -26 l20 26 Z`} />)}
      {/* الأقواس */}
      {Array.from({ length: 6 }, (_, i) => {
        const x = 80 + i * 300;
        return (
          <g key={i}>
            <path fill="#2E5A6A" opacity={0.18} d={`M${x + 30} 820 V420 Q${x + 30} 300 ${x + 130} 250 Q${x + 230} 300 ${x + 230} 420 V820 Z`} />
            <path {...S} stroke="#5A3E22" fill="none" d={`M${x + 30} 820 V420 Q${x + 30} 300 ${x + 130} 250 Q${x + 230} 300 ${x + 230} 420 V820`} />
            <path {...L(3, "#B8955F")} d={`M${x + 46} 820 V424 Q${x + 46} 316 ${x + 130} 270 Q${x + 214} 316 ${x + 214} 424 V820`} />
            {Array.from({ length: 7 }, (_, k) => <circle key={k} cx={x + 60 + k * 23} cy={300 + Math.abs(k - 3) * 22} r={5} fill="#2E7A7A" />)}
            <rect {...S} stroke="#5A3E22" x={x + 14} y={820} width={32} height={140} fill="#E9D7B4" />
            <rect {...S} stroke="#5A3E22" x={x + 214} y={820} width={32} height={140} fill="#E9D7B4" />
          </g>
        );
      })}
      <rect {...S} stroke="#5A3E22" x={-10} y={810} width={1940} height={20} fill="#CDB38A" />
      {/* الأرضية والنجمة */}
      <rect x={0} y={960} width={1920} height={120} fill="#E2CBA2" />
      <g transform="translate(960 1020) scale(1 0.35)">
        <path fill="#2E7A7A" opacity={0.85} d="M0 -120 L34 -84 L85 -85 L84 -34 L120 0 L84 34 L85 85 L34 84 L0 120 L-34 84 L-85 85 L-84 34 L-120 0 L-84 -34 L-85 -85 L-34 -84 Z" />
      </g>
      {/* نافورة */}
      <path {...S} stroke="#5A3E22" fill="#D9C39A" d="M1500 950 H1760 L1740 900 H1520 Z" />
      <rect x={1528} y={904} width={204} height={14} fill="#7FB7C9" />
      <rect {...S} stroke="#5A3E22" x={1615} y={820} width={30} height={84} fill="#D9C39A" />
      {[-1, 1].map((d) => <path key={d} {...L(4, "#7FB7C9")} opacity={0.8} d={`M1630 820 Q${1630 + d * 50} ${760 + Math.sin(t * 6) * 6} ${1630 + d * 90} 900`} />)}
      {/* نخلة في أصيص */}
      <g transform="translate(260 960)">
        <path {...S} stroke="#5A3E22" fill="#B4532F" d="M-50 0 H50 L40 -70 H-40 Z" />
        <path stroke="#6B4A2E" strokeWidth={14} fill="none" d="M0 -70 Q10 -200 -4 -300" />
        {[-70, -30, 10, 50, 90].map((a, i) => <path key={i} fill="#4E7A4A" transform={`rotate(${a + Math.sin(t + i) * 3} -4 -300)`} d="M-4 -300 Q70 -330 140 -290 Q70 -310 -4 -300 Z" />)}
      </g>
    </>
  ),
};

/** قافلة في الصحراء نهارًا: كثبان، جمال تمشي في الأفق، وسراب */
const caravan: SetDef = {
  id: "caravan",
  nameAr: "قافلة في الصحراء",
  tags: ["تجارة", "سفر", "هجرة", "رحلة", "طريق الحرير", "صحراء"],
  channels: ["dafatir-alzaman", "balislam", "zubdat-alkutub"],
  floorY: 940,
  mood: "day",
  draw: (t) => (
    <>
      <defs>
        <linearGradient id="cv-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F2C27A" /><stop offset="1" stopColor="#FBE6C0" /></linearGradient>
      </defs>
      <rect x={0} y={0} width={1920} height={1080} fill="url(#cv-sky)" />
      <circle cx={420} cy={260} r={110} fill="#FFF3D1" opacity={0.95} />
      <circle cx={420} cy={260} r={180} fill="#FFF3D1" opacity={0.25} />
      <path fill="#E7B877" d="M0 640 Q300 560 640 620 T1300 600 T1920 610 V1080 H0 Z" />
      {/* القافلة على خط الأفق */}
      {Array.from({ length: 6 }, (_, i) => {
        const x = ((1700 - i * 120 - t * 30) % 2200 + 2200) % 2200 - 200;
        const bob = Math.sin(t * 4 + i) * 3;
        return (
          <g key={i} transform={`translate(${x} ${612 + bob}) scale(${i % 2 ? 0.9 : 1})`} fill="#6B4A2E">
            <path d="M0 0 Q10 -30 30 -24 Q40 -44 56 -28 Q70 -30 74 -12 L84 -30 Q92 -40 98 -30 L92 -6 Q88 4 78 2 L74 22 H68 L66 4 H22 L20 22 H14 L12 2 Q0 4 0 0 Z" />
            {i % 3 === 0 ? <path d="M36 -40 Q42 -56 48 -40 Z" /> : null}
          </g>
        );
      })}
      <path fill="#D9A15E" d="M0 760 Q420 660 860 740 T1920 720 V1080 H0 Z" />
      {/* القافلة القريبة: جمال تمشي فعلًا (أرجل تتحرك وغبار) من اليمين إلى اليسار */}
      {Array.from({ length: 6 }, (_, i) => {
        const span = 2600;
        const x = ((1500 + i * 200 - t * 45) % span + span) % span - 340;
        return i % 3 === 2 ? <Walker key={i} x={x} y={690} s={0.55} t={t} phase={i * 1.3} /> : <WalkingCamel key={i} x={x} y={660} s={0.55} t={t} phase={i * 1.7} load={i % 2 === 0} tone={i % 2 ? "#8A6040" : "#7A5434"} />;
      })}
      <path fill="#C98E4E" d="M0 880 Q520 800 1100 880 T1920 860 V1080 H0 Z" />
      <path fill="#B97C40" d="M0 960 Q700 920 1300 970 T1920 950 V1080 H0 Z" />
      {[0, 1, 2].map((i) => <path key={i} stroke="#FFF3D1" strokeWidth={3} opacity={0.35} fill="none" d={`M${200 + i * 500} ${700 + i * 20} q 40 ${Math.sin(t * 3 + i) * 4} 80 0 t 80 0`} />)}
    </>
  ),
};

/** بيت الحكمة: مكتبة مخطوطات، مصابيح معلّقة، إسطرلاب، ومنضدة كتابة */
const wisdomLibrary: SetDef = {
  id: "wisdom-library",
  nameAr: "بيت الحكمة",
  tags: ["علم", "كتب", "مخطوطات", "علماء", "ترجمة", "بغداد", "مكتبة"],
  channels: ["dafatir-alzaman", "zubdat-alkutub", "balislam"],
  floorY: 950,
  mood: "night",
  draw: (t) => (
    <>
      <rect x={0} y={0} width={1920} height={1080} fill="#2A1E18" />
      <rect x={0} y={0} width={1920} height={1080} fill="url(#wl-glow)" />
      <defs>
        <radialGradient id="wl-glow" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stopColor="#7A5232" stopOpacity={0.9} /><stop offset="1" stopColor="#2A1E18" stopOpacity={0} /></radialGradient>
      </defs>
      {/* رفوف المخطوطات */}
      {[60, 1380].map((x) => (
        <g key={x}>
          <rect {...S} stroke="#120C08" x={x} y={140} width={480} height={810} fill="#4A3020" />
          {[0, 1, 2, 3, 4].map((r) => (
            <g key={r}>
              <rect x={x + 16} y={160 + r * 158} width={448} height={138} fill="#2E1E14" />
              {Array.from({ length: 11 }, (_, k) => {
                const roll = (k + r) % 3 === 0;
                return roll ? <rect key={k} x={x + 26 + k * 40} y={250 + r * 158} width={34} height={44} rx={17} fill={["#E8D6AE", "#D9C08C", "#C8A86C"][(k + r) % 3]} stroke="#120C08" strokeWidth={2} /> : <rect key={k} x={x + 28 + k * 40} y={190 + r * 158 + (k % 2) * 14} width={30} height={104 - (k % 2) * 14} rx={3} fill={["#8E2F23", "#2E5A4A", "#6B4A2E", "#A07A3A"][(k + r) % 4]} stroke="#120C08" strokeWidth={2} />;
              })}
              <rect x={x + 10} y={296 + r * 158} width={460} height={10} fill="#6B4A30" />
            </g>
          ))}
        </g>
      ))}
      {/* نافذة مقوّسة ونجوم */}
      <path {...S} stroke="#120C08" fill="#1C2440" d="M820 520 V300 Q820 200 960 160 Q1100 200 1100 300 V520 Z" />
      {Array.from({ length: 14 }, (_, i) => <circle key={i} cx={850 + ((i * 53) % 220)} cy={210 + ((i * 37) % 280)} r={2.5} fill="#fff" opacity={0.4 + 0.5 * Math.abs(Math.sin(t * 1.5 + i))} />)}
      <path {...L(6, "#120C08")} d="M960 160 V520 M820 360 H1100" />
      {/* مصابيح معلّقة */}
      {[700, 1220].map((x, i) => {
        const sw = Math.sin(t * 1.2 + i) * 3;
        return (
          <g key={x} transform={`rotate(${sw} ${x} 0)`}>
            <line {...L(3, "#C9A25A")} x1={x} y1={0} x2={x} y2={300} />
            <path {...S} stroke="#120C08" fill="#C9A25A" d={`M${x - 30} 300 H${x + 30} L${x + 40} 340 Q${x} 380 ${x - 40} 340 Z`} />
            <circle cx={x} cy={350} r={90} fill="#FFC56B" opacity={0.16 + 0.05 * Math.sin(t * 7 + i)} />
          </g>
        );
      })}
      {/* منضدة ومخطوطة مفتوحة وإسطرلاب */}
      <rect x={0} y={950} width={1920} height={130} fill="#3A281C" />
      <rect {...S} stroke="#120C08" x={700} y={780} width={520} height={30} rx={6} fill="#6B4A30" />
      <rect {...S} stroke="#120C08" x={730} y={810} width={24} height={140} fill="#5A3A22" />
      <rect {...S} stroke="#120C08" x={1166} y={810} width={24} height={140} fill="#5A3A22" />
      <path {...S} stroke="#120C08" fill="#EBD9B0" d="M760 780 Q860 756 960 780 Q1060 756 1160 780 V770 Q1060 744 960 768 Q860 744 760 770 Z" />
      <g transform="translate(1110 700)">
        <circle {...S} stroke="#C9A25A" strokeWidth={5} r={44} fill="none" />
        <ellipse stroke="#C9A25A" strokeWidth={3} fill="none" rx={44} ry={16} transform={`rotate(${t * 20})`} />
        <line stroke="#C9A25A" strokeWidth={4} x1={-36} y1={22} x2={36} y2={-22} />
        <rect x={-6} y={44} width={12} height={36} fill="#C9A25A" />
      </g>
      <path fill="#F2A23A" d={`M820 ${700 + Math.sin(t * 9) * 4} Q836 740 820 760 Q804 740 820 ${700 + Math.sin(t * 9) * 4} Z`} />
      <rect {...S} stroke="#120C08" x={808} y={760} width={24} height={22} fill="#C9A25A" />
      <circle cx={820} cy={740} r={70} fill="#FFC56B" opacity={0.2 + 0.06 * Math.sin(t * 8)} />
    </>
  ),
};


/** فوق السور ليلًا: شرفات حجرية في المقدمة، وتحتها سهل فيه معسكر العدو بمئات النيران، وقمر */
const wallsNight: SetDef = {
  id: "walls-night",
  nameAr: "فوق السور ليلًا",
  tags: ["تاريخ", "حصار", "ليل", "معركة", "دفاع", "قائد"],
  channels: ["dafatir-alzaman"],
  floorY: 960,
  mood: "night",
  draw: (t) => (
    <>
      <defs>
        <linearGradient id="wn-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#070B1C" /><stop offset="0.55" stopColor="#1B2446" /><stop offset="1" stopColor="#3A2E3A" /></linearGradient>
        <radialGradient id="wn-fire" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#FFB45A" stopOpacity={0.9} /><stop offset="1" stopColor="#FFB45A" stopOpacity={0} /></radialGradient>
      </defs>
      <rect x={0} y={0} width={1920} height={1080} fill="url(#wn-sky)" />
      {Array.from({ length: 80 }, (_, i) => <circle key={i} cx={(i * 233) % 1920} cy={(i * 89) % 420} r={i % 6 ? 1.6 : 2.8} fill="#fff" opacity={0.2 + 0.5 * Math.abs(Math.sin(t * 1.1 + i * 1.9))} />)}
      <circle cx={1560} cy={180} r={70} fill="#F4EBD0" />
      <circle cx={1560} cy={180} r={170} fill="#F4EBD0" opacity={0.08} />
      {([[300, 260], [980, 200]] as const).map(([x, y], i) => <ellipse key={i} cx={x + Math.sin(t * 0.15 + i) * 40} cy={y} rx={260} ry={22} fill="#8A93B8" opacity={0.18} />)}
      {/* جبال بعيدة وسهل */}
      <path fill="#1A1E33" d="M0 520 L180 450 L360 500 L560 430 L820 510 L1080 440 L1340 500 L1600 430 L1920 490 V700 H0 Z" />
      <path fill="#231F2C" d="M0 560 Q480 520 960 560 T1920 550 V900 H0 Z" />
      {/* معسكر العدو: خيام ونيران تتراقص */}
      {Array.from({ length: 70 }, (_, i) => {
        const px = (i * 157 + (i % 7) * 23) % 1920;
        const py = 580 + ((i * 61) % 180) * (0.6 + (px / 1920) * 0.2);
        const sc = 0.5 + (py - 580) / 360;
        const fl = 0.6 + 0.4 * Math.abs(Math.sin(t * 6 + i * 2.3));
        return (
          <g key={i}>
            {i % 3 === 0 ? <path fill="#3A3040" d={`M${px - 22 * sc} ${py} L${px} ${py - 26 * sc} L${px + 22 * sc} ${py} Z`} /> : null}
            <circle cx={px + 30 * sc} cy={py - 4} r={26 * sc} fill="url(#wn-fire)" opacity={fl * 0.8} />
            <circle cx={px + 30 * sc} cy={py - 4} r={3.4 * sc} fill="#FFE2A8" opacity={fl} />
          </g>
        );
      })}
      {/* دخان المعسكر */}
      {[0, 1, 2, 3].map((i) => <ellipse key={i} cx={300 + i * 420 + Math.sin(t * 0.3 + i) * 50} cy={600 - ((t * 12 + i * 40) % 160)} rx={160} ry={30} fill="#6A6070" opacity={0.12} />)}
      {/* الشرفات في المقدمة */}
      <rect {...S} stroke="#0E0A08" x={-10} y={830} width={1940} height={260} fill="#5A4636" />
      {Array.from({ length: 16 }, (_, i) => <rect key={i} {...S} stroke="#0E0A08" x={i * 130 - 40} y={770} width={80} height={70} fill="#66503E" />)}
      {Array.from({ length: 16 }, (_, i) => <rect key={`h${i}`} x={i * 130 - 34} y={776} width={68} height={8} fill="#7A6250" opacity={0.6} />)}
      {Array.from({ length: 4 }, (_, r) => Array.from({ length: 12 }, (_, c) => <line key={`${r}-${c}`} x1={c * 170 + (r % 2) * 85} y1={850 + r * 50} x2={c * 170 + (r % 2) * 85 + 140} y2={850 + r * 50} stroke="#3E3026" strokeWidth={4} />))}
      {/* مشاعل على السور */}
      {[200, 1720].map((x, i) => (
        <g key={x}>
          <rect {...S} stroke="#0E0A08" x={x - 7} y={690} width={14} height={90} fill="#3A2416" />
          <path fill="#F2A23A" d={`M${x} ${632 + Math.sin(t * 9 + i) * 5} Q${x + 22} 676 ${x} 698 Q${x - 22} 676 ${x} ${632 + Math.sin(t * 9 + i) * 5} Z`} />
          <path fill="#FFE2A8" d={`M${x} ${656 + Math.sin(t * 11 + i) * 4} Q${x + 10} 680 ${x} 694 Q${x - 10} 680 ${x} ${656 + Math.sin(t * 11 + i) * 4} Z`} />
          <circle cx={x} cy={680} r={110} fill="#FFB45A" opacity={0.16 + 0.05 * Math.sin(t * 8 + i)} />
        </g>
      ))}
      <rect x={0} y={960} width={1920} height={120} fill="#2E241E" />
    </>
  ),
};

export const sets: SetDef[] = [office, kitchen, streetNight, classroom, market, desertNight, castleWalls, wallsNight, palaceCourt, caravan, wisdomLibrary];
export const setById = (id: string) => sets.find((s) => s.id === id);

/** يرسم مكانًا كاملًا داخل SVG بإطار 1920×1080 */
export const SetBackdrop: React.FC<{ id: string; t: number }> = ({ id, t }) => {
  const def = setById(id) ?? office;
  return <>{def.draw(t)}</>;
};
