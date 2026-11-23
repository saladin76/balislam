/**
 * الطريقة ٣ — رسم يدوي متحرك: حبر على ورق كامل الإطار، يُرسم خطًّا خطًّا، و«غليان» الخط اليدوي (اهتزاز خفيف يتجدد كل إطارين،
 * ١٢ رسمة في الثانية) يقف تمامًا في جملة الذكر. المدينة ثم المملكة، ثم يمسحهما غسل رملي عند «نسي الناس اسمها»،
 * ثم «بل تبدأ»: خط أفق واحد يعبر الورقة كلها، وشمس تُرسم عند «البشر»، وخطوط ماء. ألوان مائية من لوحة «دفتر الأفق».
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useBrandFonts } from "../../useBrandFonts";
import { C, Ink } from "../horizon/kit";
import { LtAudio, LtCaption, LT_FPS, STILL_AT, at, pr, vt } from "./common";

const CITY = [
  "M180 640 C 500 636 820 642 1040 638",
  "M230 640 V500 H300 V640", "M246 500 V476 H284 V500",
  "M340 640 V430 L380 405 L420 430 V640", "M362 640 V560 H398 V640",
  "M470 640 V330 L492 296 L514 330 V640",
  "M560 640 V520 M600 640 V520 M640 640 V520 M680 640 V520 M545 520 H695 M538 508 H702",
  "M740 640 V540 H780 V520 H820 V540 H860 V640", "M900 640 V560 H980 V640 M920 600 H960",
];
const KINGDOM = [
  "M1060 640 C 1300 636 1560 642 1760 638",
  "M1090 640 V470 H1120 V450 H1150 V470 H1180 V450 H1210 V470 H1240 V640",
  "M1240 640 V500 H1460 V640", "M1310 640 V560 C1310 505 1390 505 1390 560 V640",
  "M1460 640 V470 H1490 V450 H1520 V470 H1550 V450 H1580 V470 H1610 V640",
  "M1650 640 V520 L1690 490 L1730 520 V640",
];
const RAYS = Array.from({ length: 9 }, (_, i) => {
  const a = Math.PI * (0.12 + (0.76 * i) / 8);
  const r0 = 150, r1 = 200 + (i % 2) * 30;
  return `M${960 + r0 * Math.cos(a)} ${560 - r0 * Math.sin(a)} L${960 + r1 * Math.cos(a)} ${560 - r1 * Math.sin(a)}`;
});
const WATER = ["M300 640 C 420 636 520 644 640 640", "M1240 652 C 1360 648 1480 656 1620 652", "M520 690 C 700 684 860 694 1040 688", "M980 730 C 1160 724 1300 734 1480 728", "M700 780 C 820 776 920 784 1060 780"];

/** bare: بلا ترجمة ولا صوت (طبقة داخل «المزيج») */
export const M3HandDrawn: React.FC<{ bare?: boolean }> = ({ bare }) => {
  useBrandFonts();
  const f = useCurrentFrame();
  const t = f / LT_FPS;
  const v = vt(t);
  // الغليان: بذرة تتجدد كل إطارين، وتثبت في السكون
  const boilSeed = t < STILL_AT ? Math.floor(f / 2) % 7 : Math.floor(Math.round(STILL_AT * LT_FPS) / 2) % 7;
  const cityP = pr(v, at("مدينة") - 0.1, 1.4);
  const kingP = pr(v, at("مملكة") - 0.1, 1.2);
  const wash = pr(v, at("نسي"), 1.3);
  const horizon = pr(v, at("بل") - 0.05, 0.7);
  const sky = pr(v, at("بل") + 0.3, 1.6);
  const sun = pr(v, at("البشر") - 0.1, 1.1);
  const rays = pr(v, at("البشر") + 0.7, 1.2);
  const water = pr(v, at("آدم"), 1.6);
  const part = (p: number, i: number, n: number) => Math.min(1, Math.max(0, p * (1 + n * 0.12) - i * 0.12));
  return (
    <AbsoluteFill style={{ background: C.parchment }}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="m3paper"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves={3} seed={11} /><feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.30  0 0 0 0 0.18  0 0 0 0.16 0" /></filter>
          <filter id="m3boil" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="turbulence" baseFrequency="0.022" numOctaves={2} seed={boilSeed} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={4} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="m3wc"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={3} seed={5} result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale={60} /><feGaussianBlur stdDeviation={6} /></filter>
          <radialGradient id="m3sun" cx="0.5" cy="0.6" r="0.6"><stop offset="0" stopColor={C.ember} stopOpacity={0.55} /><stop offset="1" stopColor={C.sand} stopOpacity={0} /></radialGradient>
        </defs>
        <rect width={1920} height={1080} filter="url(#m3paper)" />
        {/* غسل السماء المائي عند «بل تبدأ» */}
        <g filter="url(#m3wc)" opacity={sky}>
          <rect x={120} y={140} width={1680} height={500} fill={C.sand} opacity={0.45} />
          <circle cx={960} cy={560} r={420} fill="url(#m3sun)" />
        </g>
        <g filter="url(#m3boil)">
          <g opacity={(1 - 0.8 * wash) * (1 - pr(v, at("بل") - 0.1, 0.6))}>
            {CITY.map((d, i) => <Ink key={`c${i}`} d={d} p={part(cityP, i, CITY.length)} w={4.5} c={C.inkText} />)}
            {KINGDOM.map((d, i) => <Ink key={`k${i}`} d={d} p={part(kingP, i, KINGDOM.length)} w={4.5} c={C.inkText} />)}
          </g>
          {horizon > 0 && <Ink d="M90 640 C 520 634 1400 646 1830 638" p={horizon} w={5} c={C.inkText} />}
          {sun > 0 && <Ink d="M810 560 A150 150 0 0 1 1110 560" p={sun} w={5} c={C.ink} />}
          {RAYS.map((d, i) => <Ink key={`r${i}`} d={d} p={part(rays, i, RAYS.length)} w={3.5} c={C.ink} />)}
          {WATER.map((d, i) => <Ink key={`w${i}`} d={d} p={part(water, i, WATER.length)} w={3} c={C.inkSoft} />)}
        </g>
        {/* الغسل الرملي يمسح المدينة والمملكة من اليمين إلى اليسار عند «نسي» */}
        <g filter="url(#m3wc)" opacity={0.55 * (1 - horizon)}>
          <rect x={1880 - 1800 * wash} y={300} width={1800 * wash} height={400} fill={C.sand} />
        </g>
      </svg>
      {!bare && <LtCaption t={t} tone="ink" />}
      {!bare && <LtAudio />}
    </AbsoluteFill>
  );
};
