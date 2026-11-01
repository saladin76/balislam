import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamilies } from "../../../brand/fonts";
import { useBrandFonts } from "../useBrandFonts";

/** أدوات مشتركة لنماذج الأساليب: العنوان، الترجمة، أرقام عشوائية ثابتة، وأشكال المدينة الإسلامية. */
export const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const DEMO_LINE = "قافلةٌ تصل إلى بغداد عند الغروب، محمّلةً بالحرير… والكتب.";

/** عنوان المكان والزمن + سطر الترجمة: نفس الكلام في كل النماذج لتسهل المقارنة */
export const DemoText: React.FC<{ title: string; date: string; color?: string; accent?: string; font?: string; captionBg?: string; panel?: string; captionColor?: string }> = ({ title, date, color = "#F6EBDD", accent = "#F2B45A", font = fontFamilies.scripture, captionBg = "rgba(0,0,0,0.35)", panel, captionColor }) => {
  useBrandFonts();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const a = Math.min(interpolate(frame, [14, 34], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }), interpolate(frame, [durationInFrames - 20, durationInFrames - 6], [1, 0], clamp));
  const c = interpolate(frame, [30, 44], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ direction: "rtl", pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 70, right: 96, color, opacity: a, transform: `translateY(${(1 - a) * 16}px)`, textShadow: panel ? undefined : "0 3px 22px rgba(0,0,0,0.45)", background: panel, padding: panel ? "14px 30px 18px" : undefined, borderRadius: panel ? 18 : undefined }}>
        <div style={{ fontFamily: font, fontWeight: 700, fontSize: 76, lineHeight: 1.15 }}>{title}</div>
        <div style={{ width: 260 * a, height: 3, background: accent, borderRadius: 2, margin: "12px 0" }} />
        <div style={{ fontFamily: fontFamilies.heading, fontSize: 34, color: accent }}>{date}</div>
      </div>
      <div style={{ position: "absolute", bottom: 64, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: c }}>
        <div style={{ fontFamily: fontFamilies.body, fontWeight: 600, fontSize: 44, color: captionColor ?? color, background: captionBg, padding: "10px 30px", borderRadius: 16, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>{DEMO_LINE}</div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * أفق مدينة إسلامية (قباب ومآذن وأسوار) كمسار واحد: يُستعمل ظلًّا أسود أو طبقة ورق أو لونًا مسطحًا.
 * x0..x1 عرض المدينة، base خط الأرض، s مقياس الارتفاع.
 */
export const skylinePath = (x0: number, x1: number, base: number, s = 1, seed = 1) => {
  let d = `M${x0} ${base}`;
  let x = x0;
  let i = seed;
  while (x < x1) {
    const kind = rnd(i) ;
    const w = (50 + rnd(i + 1) * 90) * s;
    const h = (60 + rnd(i + 2) * 110) * s;
    if (kind < 0.18) {
      // مئذنة: عمود رفيع وشرفة ورأس مدبب
      const mw = 16 * s;
      const mh = h + 170 * s;
      d += ` L${x} ${base - h * 0.4} L${x + w * 0.3} ${base - h * 0.4} L${x + w * 0.3} ${base - mh} L${x + w * 0.3 - 6 * s} ${base - mh} L${x + w * 0.3 + mw / 2} ${base - mh - 34 * s} L${x + w * 0.3 + mw + 6 * s} ${base - mh} L${x + w * 0.3 + mw} ${base - mh} L${x + w * 0.3 + mw} ${base - h * 0.4} L${x + w} ${base - h * 0.4}`;
    } else if (kind < 0.55) {
      // مبنى بقبة
      const r = w * 0.38;
      const cx = x + w / 2;
      d += ` L${x} ${base - h} L${cx - r} ${base - h} A${r} ${r * 1.15} 0 0 1 ${cx - 3 * s} ${base - h - r * 1.12} L${cx} ${base - h - r * 1.15 - 24 * s} L${cx + 3 * s} ${base - h - r * 1.12} A${r} ${r * 1.15} 0 0 1 ${cx + r} ${base - h} L${x + w} ${base - h}`;
    } else {
      // بيت بسقف مسطح وشرفات
      d += ` L${x} ${base - h * 0.6}`;
      for (let k = 0; k < 3; k++) d += ` L${x + (w / 3) * k} ${base - h * 0.6 - 10 * s} L${x + (w / 3) * k + w / 6} ${base - h * 0.6 - 10 * s} L${x + (w / 3) * k + w / 6} ${base - h * 0.6}`;
      d += ` L${x + w} ${base - h * 0.6}`;
    }
    x += w;
    i += 3;
  }
  d += ` L${x1} ${base} Z`;
  return d;
};

/** جمل ظلّي يمشي (متجه يمينًا): أرجل بخطوة متبادلة ورأس يتمايل؛ fill واحد بلا خطوط */
export const CamelShape: React.FC<{ t: number; phase: number; fill: string; load?: string; stroke?: string }> = ({ t, phase, fill, load, stroke }) => {
  const w = t * 4 + phase;
  const leg = (hx: number, a: number) => {
    const ang = Math.sin(w + a) * 0.36;
    const kx = hx + Math.sin(ang) * 56;
    const ky = 40 + Math.cos(ang) * 56;
    const knee = Math.max(0, Math.sin(w + a + 1.2)) * 0.5;
    const fx = kx + Math.sin(ang - knee) * 56;
    const fy = ky + Math.cos(ang - knee) * 56;
    return <path key={`${hx}${a}`} d={`M${hx} 30 L${kx} ${ky} L${fx} ${fy}`} stroke={fill} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
  };
  const bob = Math.abs(Math.sin(w)) * -5;
  return (
    <g transform={`translate(0 ${bob})`}>
      {leg(46, Math.PI)}
      {leg(-50, 0)}
      <path fill={fill} stroke={stroke} strokeWidth={stroke ? 3 : 0} d="M80 24 Q86 -12 50 -22 Q30 -72 0 -64 Q-20 -82 -44 -54 Q-70 -42 -76 0 Q-78 34 -50 42 H60 Q82 42 80 24 Z" />
      <g transform={`rotate(${Math.sin(w * 2) * 3} 76 8)`}>
        <path fill={fill} stroke={stroke} strokeWidth={stroke ? 3 : 0} d="M72 16 Q108 -2 114 -50 Q118 -76 98 -82 Q78 -86 76 -64 Q80 -32 58 -8 Z" />
        <path fill={fill} stroke={stroke} strokeWidth={stroke ? 3 : 0} d="M102 -82 Q138 -88 148 -72 Q148 -60 130 -60 Q116 -62 98 -64 Z" />
      </g>
      {load ? <rect x={-36} y={-104} width={70} height={42} rx={12} fill={load} /> : null}
      {leg(40, 0)}
      {leg(-56, Math.PI)}
      <path d="M-76 0 Q-92 10 -88 34" stroke={fill} strokeWidth={6} fill="none" strokeLinecap="round" />
    </g>
  );
};

/** مسافر بعباءة يمشي (ظلّي) */
export const WalkerShape: React.FC<{ t: number; phase: number; fill: string }> = ({ t, phase, fill }) => {
  const w = t * 4 + phase;
  const a = Math.sin(w) * 0.32;
  return (
    <g transform={`translate(0 ${Math.abs(Math.sin(w)) * -4})`}>
      <path d={`M0 50 l${Math.sin(a) * 40} 56`} stroke={fill} strokeWidth={11} strokeLinecap="round" />
      <path d={`M0 50 l${-Math.sin(a) * 40} 56`} stroke={fill} strokeWidth={11} strokeLinecap="round" />
      <path fill={fill} d={`M-24 -40 Q-34 20 ${-30 - Math.sin(w) * 6} 70 H${32 + Math.sin(w) * 8} Q34 20 24 -40 Q0 -54 -24 -40 Z`} />
      <path fill={fill} d="M-22 -48 Q-26 -92 0 -94 Q26 -92 22 -48 Z" />
      <path fill={fill} d={`M18 -70 Q${44 + Math.sin(w * 1.3) * 8} -60 ${48 + Math.sin(w * 1.1) * 10} -30 L20 -46 Z`} />
    </g>
  );
};
