/**
 * رسوم «دفتر الأفق» التوثيقية القابلة لإعادة الاستعمال في أي حلقة من «دفاتر الزمن»: أفق وغروب، أطلال وبوابة،
 * شواهد أثرية (أداة حجرية، مسكن، بقايا طعام، استيطان، مدفن، نقش)، رموز مستوطنات ومعايش، أدوات الكاتب والباحث.
 * رسوم توضيحية لا وثائق: لا تُنسب إلى موضع أو زمن أو شخص إلا بمصدر. الاستعمال والحدود في docs/dafatir-alzaman/03-tools.md.
 */

import React from "react";
import { C, Ink, easeOut, mix, prog, rng } from "../horizon/kit";
import { SText } from "../horizon/book";

export const CLAY = "#8A5A3C";
export const EMBER_DEEP = "#B23A1E";


export const Sunset: React.FC<{ y: number; o: number }> = ({ y, o }) => (
  <g opacity={o}>
    <defs>
      <linearGradient id={`sky-${y}`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor={C.ember} stopOpacity={0.26} />
        <stop offset="1" stopColor={C.ember} stopOpacity={0} />
      </linearGradient>
    </defs>
    <rect x={960} y={y - 330} width={820} height={330} fill={`url(#sky-${y})`} />
    <rect x={960} y={y} width={820} height={260} fill="#D9C29A" opacity={0.45} />
    {Array.from({ length: 9 }, (_, i) => (
      <path key={i} d={`M${1010 + i * 82} ${y + 22 + (i % 3) * 14} h${40 + (i % 2) * 18}`} stroke={C.ink} strokeWidth={2} opacity={0.18} />
    ))}
  </g>
);

export const Hatch: React.FC<{ x: number; y: number; w: number; h: number; o: number }> = ({ x, y, w, h, o }) => (
  <g opacity={0.28 * o}>
    <clipPath id={`h-${x}-${y}`}>
      <rect x={x} y={y} width={w} height={h} />
    </clipPath>
    <g clipPath={`url(#h-${x}-${y})`}>
      {Array.from({ length: Math.ceil((h + w) / 12) }, (_, i) => (
        <path key={i} d={`M${x} ${y + i * 12} l${w} ${-w}`} stroke={C.ink} strokeWidth={2} />
      ))}
    </g>
  </g>
);

export const RUINS = [
  "M1050 700 C1200 696 1500 704 1690 698",
  "M1120 700 V500 L1132 488 L1141 497 L1150 481 L1160 492 V700",
  "M1133 690 V512 M1147 690 V506",
  "M1210 700 V575 L1222 560 L1236 572 L1250 566 V700",
  "M1500 700 V452 H1540 V700 M1488 452 H1552 V434 H1488 Z M1513 690 V462 M1527 690 V462",
  "M1590 700 V570 C1590 512 1634 486 1676 500 L1668 520 C1640 512 1612 530 1612 572 V700",
  "M1300 700 V652 H1362 V700 M1362 700 V666 H1424 V700 M1300 652 L1330 640 L1352 652",
  "M1424 700 C1424 680 1474 680 1474 700 M1436 700 C1436 690 1462 690 1462 700",
  "M1080 700 L1088 692 L1098 700 M1270 700 L1280 690 L1292 700 M1640 700 L1650 693 L1660 700",
];

export const GATE = [
  "M1060 722 H1660",
  "M1120 722 V380 H1240 V722 M1120 380 V352 H1146 V380 M1167 380 V352 H1193 V380 M1214 380 V352 H1240 V380",
  "M1480 722 V380 H1600 V722 M1480 380 V352 H1506 V380 M1527 380 V352 H1553 V380 M1574 380 V352 H1600 V380",
  "M1240 722 V470 H1480 V722 M1300 722 V602 C1300 520 1420 520 1420 602 V722",
  "M1180 452 V496 M1540 452 V496 M1340 500 H1380",
  "M1290 722 V736 H1430 V722",
];

export type FindDef = { key: string; word: string; label: string; lx: number; ly: number; ax: number; ay: number; cx: number; cy: number; rx: number; ry: number; draw: (p: number) => React.ReactNode };

export const stone = "#CFC4B0";

export const FINDS: FindDef[] = [
  {
    key: "tool", word: "أدوات", label: "أدوات من الحجر", lx: 1400, ly: 1520, ax: 1528, ay: 1612, cx: 1562, cy: 1646, rx: 80, ry: 92,
    draw: (p) => (
      <g>
        <path d="M1560 1578 C1592 1598 1606 1650 1592 1690 C1582 1714 1540 1714 1530 1690 C1514 1650 1528 1600 1560 1578 Z" fill={stone} opacity={p} />
        <path d="M1560 1578 L1548 1630 L1530 1690 C1516 1650 1528 1600 1560 1578 Z" fill="#B7AA91" opacity={p} />
        <path d="M1562 1592 L1585 1650 L1592 1690 C1606 1650 1592 1600 1562 1580 Z" fill="#E1D8C6" opacity={p} />
        <path d="M1548 1630 L1562 1660 L1582 1676 L1556 1704 L1536 1692 Z" fill="#C9BDA6" opacity={p} />
        <Ink d="M1560 1578 C1592 1598 1606 1650 1592 1690 C1582 1714 1540 1714 1530 1690 C1514 1650 1528 1600 1560 1578 Z" w={3.5} p={p} c="#2B1E14" />
        <Ink d="M1560 1592 L1548 1630 L1562 1660 L1550 1700 M1572 1606 L1585 1650 M1540 1642 L1562 1660 L1582 1676" w={2} p={p} c="#2B1E14" />
      </g>
    ),
  },
  {
    key: "home", word: "مساكن", label: "آثار مساكن", lx: 1260, ly: 1118, ax: 1220, ay: 1196, cx: 1215, cy: 1240, rx: 210, ry: 72,
    draw: (p) => (
      <g>
        <Ink d="M1050 1200 H1330" w={3} p={p} c="#2B1E14" />
        {[1080, 1150, 1220, 1290].map((x, i) => (
          <rect key={x} x={x - 9} y={1200} width={18} height={56} rx={9} fill="#3A2418" opacity={0.8 * prog(p, i * 0.15, 0.4 + i * 0.15)} />
        ))}
        {Array.from({ length: 9 }, (_, i) => {
          const a = Math.PI + (i / 8) * Math.PI;
          return <circle key={i} cx={1380 + Math.cos(a) * 34} cy={1206 - Math.sin(a) * 16} r={8} fill={stone} stroke="#2B1E14" strokeWidth={2} opacity={prog(p, 0.4 + i * 0.05, 0.6 + i * 0.05)} />;
        })}
        <ellipse cx={1380} cy={1208} rx={24} ry={9} fill="#2B1E14" opacity={0.75 * prog(p, 0.8, 1)} />
      </g>
    ),
  },
  {
    key: "food", word: "أطعمة", label: "بقايا أطعمة", lx: 900, ly: 1318, ax: 840, ay: 1406, cx: 810, cy: 1446, rx: 96, ry: 58,
    draw: (p) => {
      const r = rng(5);
      return (
        <g>
          {Array.from({ length: 9 }, (_, i) => {
            const x = 790 + (i % 3) * 30 + r() * 10;
            const y = 1428 + Math.floor(i / 3) * 18 + r() * 6;
            const a = r() * 60 - 30;
            const o = prog(p, i * 0.06, 0.3 + i * 0.06);
            return (
              <g key={i} transform={`rotate(${a} ${x} ${y})`} opacity={o}>
                <ellipse cx={x} cy={y} rx={12} ry={7} fill="#5A3A26" />
                <path d={`M${x - 8} ${y} H${x + 8}`} stroke="#E3CFA8" strokeWidth={1.5} />
              </g>
            );
          })}
          <g transform="translate(740 1450) scale(1.5) translate(-740 -1450)">
            <path d="M716 1462 C716 1432 756 1422 771 1452 C776 1472 746 1482 716 1462 Z" fill="#E8DCC6" opacity={p} />
            <Ink d="M716 1462 C716 1432 756 1422 771 1452 C776 1472 746 1482 716 1462 Z M728 1458 L750 1440 M736 1466 L762 1450" w={2} p={p} c="#2B1E14" />
          </g>
        </g>
      );
    },
  },
  {
    key: "settle", word: "استيطان", label: "مواقع استيطان", lx: 480, ly: 1018, ax: 440, ay: 1068, cx: 420, cy: 1110, rx: 150, ry: 60,
    draw: (p) => (
      <g>
        <Ink d="M280 1148 C360 1150 470 1146 560 1149" w={2.5} p={prog(p, 0.7, 1)} c="#2B1E14" />
        {[0, 1, 2].map((row) =>
          Array.from({ length: row === 2 ? 3 : 6 - row }, (_, i) => {
            const x = 300 + row * 18 + i * 42;
            return <rect key={`${row}-${i}`} x={x} y={1124 - row * 24} width={38} height={21} rx={6} fill={stone} stroke="#2B1E14" strokeWidth={2} opacity={prog(p, row * 0.3 + i * 0.04, row * 0.3 + 0.35 + i * 0.04)} />;
          }),
        )}
      </g>
    ),
  },
  {
    key: "burial", word: "ومدافن", label: "مدافن", lx: 1020, ly: 1548, ax: 1000, ay: 1596, cx: 1000, cy: 1640, rx: 120, ry: 66,
    draw: (p) => (
      <g>
        <rect x={926} y={1606} width={148} height={66} rx={8} fill="#5A3E2C" opacity={0.85 * prog(p, 0.5, 1)} />
        <rect x={990} y={1566} width={110} height={22} rx={6} transform="rotate(-8 1045 1577)" fill={stone} stroke="#2B1E14" strokeWidth={2} opacity={prog(p, 0.75, 1)} />
        {Array.from({ length: 16 }, (_, i) => {
          const per = i / 16;
          const [x, y] = per < 0.3 ? [920 + (per / 0.3) * 160, 1598] : per < 0.5 ? [1080, 1598 + ((per - 0.3) / 0.2) * 82] : per < 0.8 ? [1080 - ((per - 0.5) / 0.3) * 160, 1680] : [920, 1680 - ((per - 0.8) / 0.2) * 82];
          return <rect key={i} x={x - 11} y={y - 7} width={22} height={14} rx={5} fill={stone} stroke="#2B1E14" strokeWidth={2} opacity={prog(p, i * 0.03, 0.25 + i * 0.03)} />;
        })}
      </g>
    ),
  },
  {
    key: "art", word: "ونقوش", label: "نقوش ورسوم", lx: 380, ly: 1470, ax: 400, ay: 1530, cx: 405, cy: 1600, rx: 140, ry: 90,
    draw: (p) => (
      <g>
        <path d="M300 1540 L500 1530 L520 1660 L290 1670 Z" fill="#9C8A74" opacity={p} />
        <Ink d="M300 1540 L500 1530 L520 1660 L290 1670 Z" w={3} p={p} c="#2B1E14" />
        <Ink d="M340 1590 L360 1570 L380 1590 L400 1570 L420 1590 M450 1580 C470 1560 490 1600 460 1610 C440 1615 445 1590 460 1592" w={3} p={prog(p, 0.4, 1)} c="#B4583A" />
        <Ink d="M480 1630 m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0" w={3} p={prog(p, 0.6, 1)} c="#B4583A" />
        {[0, 1, 2, 3, 4].map((k) => (
          <circle key={k} cx={350 + k * 26} cy={1630 - (k % 2) * 8} r={4.5} fill="#2B1E14" opacity={prog(p, 0.5 + k * 0.08, 0.6 + k * 0.08)} />
        ))}
      </g>
    ),
  },
];

/** رموز مستوطنات عامة على خط أفق (كوخ، برج، قبة، خيمة، مصطبة، أعمدة) */
export const GLYPHS = [
  "M-22 0 V-26 L0 -46 L22 -26 V0 Z",
  "M-11 0 V-72 H11 V0 Z M-16 -72 H16 V-80 H-16 Z",
  "M-28 0 V-22 C-28 -52 28 -52 28 -22 V0 Z",
  "M-30 0 L0 -42 L30 0 Z",
  "M-36 0 V-14 H-24 V-28 H-12 V-42 H12 V-28 H24 V-14 H36 V0 Z",
  "M-30 0 V-48 H30 V0 M-15 0 V-48 M0 0 V-48 M15 0 V-48 M-36 -48 H36 V-56 H-36 Z",
];

export const Desk: React.FC = () => {
  const r = rng(9);
  return (
    <g>
      <rect x={-900} y={-600} width={3720} height={2300} fill="#4A3020" />
      {Array.from({ length: 42 }, (_, i) => {
        const y = -560 + i * 54 + r() * 20;
        return <path key={i} d={`M-900 ${y} C0 ${y + 12 - r() * 24} 1000 ${y - 10 + r() * 20} 2820 ${y + 6}`} stroke="#3A2416" strokeWidth={2 + r() * 3} fill="none" opacity={0.5} />;
      })}
    </g>
  );
};

export const Tool: React.FC<{ q: number; children: React.ReactNode; x: number; y: number; rot?: number }> = ({ q, children, x, y, rot = 0 }) =>
  q <= 0 ? null : (
    <g opacity={q} transform={`translate(${x} ${y + (1 - q) * 30}) rotate(${rot})`}>
      <g transform="translate(6 10)" opacity={0.35}>
        <g style={{ filter: "blur(4px)" }}>{children}</g>
      </g>
      {children}
    </g>
  );
// أدوات المعرفة من أعلى، بحجم يُقرأ على شاشة عادية: كتب، وقلم ودواة، ومسطرة، وعدسة

export const Qalam = () => (
  <g>
    <path d="M-300 -16 L230 -16 C262 -16 290 -8 330 0 C290 8 262 16 230 16 L-300 16 C-312 16 -318 8 -318 0 C-318 -8 -312 -16 -300 -16 Z" fill="#C9A06A" stroke={C.ink} strokeWidth={5} />
    {[-220, -120, -20, 80].map((x) => (
      <path key={x} d={`M${x} -16 C${x + 8} -6 ${x + 8} 6 ${x} 16`} fill="none" stroke="#8B6A3E" strokeWidth={4} />
    ))}
    <path d="M230 -16 C262 -16 290 -8 330 0 C290 8 262 16 230 16 Z" fill="#2B1E14" />
  </g>
);

export const Inkwell = () => (
  <g>
    <circle r={96} fill="#2E2236" stroke={C.ink} strokeWidth={5} />
    <circle r={70} fill="#120C10" stroke={C.gold} strokeWidth={8} />
    <ellipse cx={-22} cy={-24} rx={22} ry={12} fill="#FFFFFF" opacity={0.25} />
  </g>
);

export const Lens = () => (
  <g>
    <path d="M80 80 L220 220" stroke="#6B4A2E" strokeWidth={34} strokeLinecap="round" />
    <path d="M80 80 L220 220" stroke={C.ink} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
    <circle r={116} fill="rgba(255,250,235,0.22)" stroke={C.gold} strokeWidth={18} />
    <circle r={116} fill="none" stroke={C.ink} strokeWidth={4} />
    <path d="M-60 -70 C-30 -92 20 -96 54 -76" fill="none" stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" opacity={0.5} />
  </g>
);

export const Books = () => (
  <g>
    {[
      { x: 30, y: 40, r: -7, c: "#3A4A3A" },
      { x: -10, y: -10, r: 5, c: C.ribbon },
    ].map((b, i) => (
      <g key={i} transform={`translate(${b.x} ${b.y}) rotate(${b.r})`}>
        <rect x={-180} y={-240} width={360} height={480} rx={10} fill={C.page} stroke={C.ink} strokeWidth={5} />
        <rect x={-180} y={-240} width={348} height={468} rx={10} fill={b.c} stroke={C.ink} strokeWidth={5} />
        <rect x={-180} y={-240} width={56} height={468} rx={8} fill="#000000" opacity={0.18} />
        <rect x={-80} y={-150} width={210} height={110} rx={8} fill="none" stroke={C.gold} strokeWidth={6} />
        <rect x={-70} y={150} width={190} height={8} rx={4} fill={C.gold} opacity={0.8} />
      </g>
    ))}
  </g>
);

export const Ruler = () => (
  <g>
    <rect x={-300} y={-40} width={600} height={80} rx={6} fill="#D9B680" stroke={C.ink} strokeWidth={5} />
    {Array.from({ length: 29 }, (_, i) => (
      <line key={i} x1={-280 + i * 20} x2={-280 + i * 20} y1={-40} y2={i % 5 ? -20 : 0} stroke={C.ink} strokeWidth={3} />
    ))}
  </g>
);

export const Hourglass: React.FC<{ q: number; flow: number }> = ({ q, flow }) => (
  <g opacity={q} transform="translate(480 690) scale(0.9)">
    <path d="M-40 -60 H40 L6 0 L40 60 H-40 L-6 0 Z" fill={C.page} stroke={C.gold} strokeWidth={4} />
    <path d={`M${-30 + 26 * flow} -50 H${30 - 26 * flow} L4 -6 H-4 Z`} fill={C.sand} />
    <path d={`M${-30 * flow} 52 H${30 * flow} L0 ${52 - 34 * flow} Z`} fill={C.sand} />
    <line x1={0} x2={0} y1={-4} y2={50} stroke={C.sand} strokeWidth={2} opacity={flow > 0 && flow < 1 ? 1 : 0} />
  </g>
);

export const Tent = () => <path d="M-50 0 L0 -70 L50 0 Z M0 -70 V0 M-14 0 L0 -26 L14 0" fill="#E8D6B3" stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />;

export const Wheat = () => (
  <g fill="none" stroke={C.ink} strokeWidth={4} strokeLinecap="round">
    <path d="M0 0 V-80 M-26 0 C-26 -30 -14 -54 -4 -70 M26 0 C26 -30 14 -54 4 -70" />
    {[-60, -44, -28].map((y) => (
      <path key={y} d={`M0 ${y} l-12 -12 M0 ${y} l12 -12`} />
    ))}
  </g>
);

export const Boat = () => (
  <g stroke={C.ink} strokeWidth={4} strokeLinejoin="round">
    <path d="M-60 -16 H60 L42 6 H-42 Z" fill="#C9A06A" />
    <path d="M0 -16 V-84 L44 -26 H0" fill="#F2E3C2" />
  </g>
);

export const Jar = () => <path d="M-16 -80 H16 V-70 C34 -60 40 -36 34 -16 C28 -2 16 0 0 0 C-16 0 -28 -2 -34 -16 C-40 -36 -34 -60 -16 -70 Z" fill="#C98E5A" stroke={C.ink} strokeWidth={4} />;

export const Fire = ({ q }: { q: number }) => (
  <g>
    <path d="M-50 10 H50" stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
    <path d="M-36 4 L30 -6 M-30 -6 L36 4" stroke="#6B4A2E" strokeWidth={8} strokeLinecap="round" />
    <path d={`M0 ${-70 * q} C26 -40 30 -16 14 0 C26 -10 22 -30 10 -40 C14 -22 0 -14 -6 0 C-24 -14 -20 -40 0 ${-70 * q} Z`} fill={C.ember} stroke={C.ink} strokeWidth={3} />
  </g>
);

export const Village = () => (
  <g stroke={C.ink} strokeWidth={4} strokeLinejoin="round" fill="#E8D6B3">
    <path d="M-110 0 V-50 H-50 V0 Z M-110 -50 L-80 -76 L-50 -50" />
    <path d="M-40 0 V-70 H30 V0 Z M-40 -70 L-5 -98 L30 -70" />
    <path d="M40 0 V-46 H100 V0 Z" />
    <path d="M-130 0 H130" fill="none" />
    <path d="M-130 6 V-24 H-120 V6 M120 6 V-24 H130 V6" />
  </g>
);

export const Temple = () => (
  <g stroke={C.ink} strokeWidth={4} strokeLinejoin="round" fill="#E8D6B3">
    <path d="M-140 0 H-10 V-14 H-24 V-28 H-38 V-42 H-60 V-56 H-90 V-42 H-112 V-28 H-126 V-14 H-140 Z" />
    <path d="M10 0 H140 V-12 H10 Z M20 -12 V-90 M50 -12 V-90 M80 -12 V-90 M110 -12 V-90 M130 -12 V-90 M4 -90 H146 L75 -126 Z" />
  </g>
);

/** شاهد من FINDS في موضع جديد وبحجم جديد */
export const FindAt: React.FC<{ k: string; x: number; y: number; s: number; p: number }> = ({ k, x, y, s, p }) => {
  const f = FINDS.find((v) => v.key === k)!;
  return <g transform={`translate(${x} ${y}) scale(${s}) translate(${-f.cx} ${-f.cy})`}>{f.draw(p)}</g>;
};
