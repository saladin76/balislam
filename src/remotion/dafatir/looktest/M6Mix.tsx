/**
 * الطريقة ٦ — «المزيج» (إضافة المالك): الأشكال معًا، كلٌّ بمعنى ثابت:
 * - الأرشيف الحقيقي (الطريقة ١) لما ثبت: «مدينة قديمة» = أطلال حقيقية قائمة.
 * - الثري دي (الطريقة ٥) لإعادة البناء والتقدير: «مملكة نسي الناس اسمها» = لا صورة لها، فهي تقدير يغوص في الرمل.
 * - الرسم اليدوي (الطريقة ٣) للسرد والرواية: «بل تبدأ من أبي البشر…» وجملة الذكر بعدها في سكون تام.
 * - الخيط الأحمر للانتقال: يعبر الإطار مع انتشار الحبر.
 * لوحة ألوان واحدة (تدرّج دافئ موحّد فوق الأرشيف والثري دي)، وخط واحد، وورق واحد فوق كل شيء؛ والانتقال ثابت (انتشار حبر ٠٫٦ ث)؛
 * ولا مقطع أقل من ٣ ثوانٍ. الانتقالات كلها قبل جملة الذكر، ولا يتحرك فيها شيء.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useBrandFonts } from "../../useBrandFonts";
import { C } from "../horizon/kit";
import { LINES, LtAudio, LT_FPS, at, pr } from "./common";
import { M1Archive } from "./M1Archive";
import { M3HandDrawn } from "./M3HandDrawn";
import { M5ThreeD } from "./M5ThreeD";

/** حدود المقاطع: أرشيف ٠–٤٫٦ ث (٤٫٦)، ثري دي ٤٫٦–٧٫٧ (٣٫١)، رسم يدوي ٧٫٧–النهاية (١٣٫٥) */
export const M6_T1 = at("ولا") - 0.15;
export const M6_T2 = at("بل") - 0.1;
const TR = 0.6;
/** تدرّج واحد فوق الصور الحقيقية والثري دي ليقتربا من ورق «دفتر الأفق» */
const GRADE = "sepia(0.32) saturate(0.82) contrast(0.96) brightness(1.02)";

/** انتشار الحبر: دائرة تكبر من المركز (قص CSS يعمل مع الثري دي)، وحافتها حلقة حبر مبعثرة */
const InkSpread: React.FC<{ p: number; id: string; children: React.ReactNode }> = ({ p, id, children }) => {
  if (p <= 0) return null;
  if (p >= 1) return <AbsoluteFill>{children}</AbsoluteFill>;
  const r = 40 + 1180 * p;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `circle(${r}px at 960px 540px)` }}>{children}</AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <filter id={`${id}f`} x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={3} seed={7} /><feDisplacementMap in="SourceGraphic" scale={70} /><feGaussianBlur stdDeviation={2} /></filter>
        <circle cx={960} cy={540} r={r} fill="none" stroke="#2B1E14" strokeWidth={34 * (1 - p) + 6} opacity={0.75 * (1 - p * 0.6)} filter={`url(#${id}f)`} />
      </svg>
    </AbsoluteFill>
  );
};

/** الخيط الأحمر يعبر الإطار مع الانتقال ثم يبهت */
const Thread: React.FC<{ t: number; t0: number }> = ({ t, t0 }) => {
  const draw = pr(t, t0 - 0.2, 0.7);
  const fade = 1 - pr(t, t0 + 0.9, 0.5);
  if (draw <= 0 || fade <= 0) return null;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      <path d="M-20 600 C 400 560 760 640 1100 590 S 1700 560 1940 600" fill="none" stroke={C.ember} strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - draw} opacity={0.9 * fade} />
    </svg>
  );
};

/** ترجمة واحدة للطرق كلها هنا: حبر على شريط من الورق نفسه */
const MixCaption: React.FC<{ t: number }> = ({ t }) => {
  const line = LINES.find((l) => t >= l.a && t < l.b);
  if (!line) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 36, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 1640, padding: "4px 30px 10px", direction: "rtl", textAlign: "center", fontFamily: "'IBM Plex Sans Arabic', sans-serif", fontWeight: 600, fontSize: 40, lineHeight: 1.45,
        color: "#2B1E14", background: "rgba(241,228,203,0.86)", borderRadius: 6, boxShadow: "0 2px 10px rgba(20,12,6,0.25)" }}>{line.text}</div>
    </div>
  );
};

export const M6Mix: React.FC = () => {
  useBrandFonts();
  const t = useCurrentFrame() / LT_FPS;
  const p1 = pr(t, M6_T1, TR);
  const p2 = pr(t, M6_T2, TR);
  const showA = t < M6_T1 + TR + 0.05;
  const show3d = t > M6_T1 - 0.1 && t < M6_T2 + TR + 0.05;
  return (
    <AbsoluteFill style={{ background: "#1C140E" }}>
      {showA && <AbsoluteFill style={{ filter: GRADE }}><M1Archive bare /></AbsoluteFill>}
      {show3d && <InkSpread p={p1} id="m6a"><AbsoluteFill style={{ filter: GRADE }}><M5ThreeD bare /></AbsoluteFill></InkSpread>}
      <InkSpread p={p2} id="m6b"><M3HandDrawn bare /></InkSpread>
      <Thread t={t} t0={M6_T1} />
      <Thread t={t} t0={M6_T2} />
      {/* ورق واحد فوق كل شيء: حبيبات ثابتة (لا حركة في السكون) */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, mixBlendMode: "multiply", opacity: 0.28 }}>
        <filter id="m6g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={9} /><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0.6 0" /></filter>
        <rect width={1920} height={1080} filter="url(#m6g)" />
      </svg>
      <MixCaption t={t} />
      <LtAudio />
    </AbsoluteFill>
  );
};
