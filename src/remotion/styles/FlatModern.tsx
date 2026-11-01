import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamilies } from "../../../brand/fonts";
import { DemoText, clamp, rnd } from "./common";

/**
 * نموذج «فلات حديث بتدرجات»: أشكال ناعمة بلا خطوط خارجية، تدرجات وتوهج، المدينة تُبنى أمامك بقفزات مرنة،
 * النوافذ تضيء واحدة بعد واحدة، قافلة مبسّطة تتهادى، ونجوم تتلألأ. حركة سريعة ونظيفة.
 */
const Pop: React.FC<{ delay: number; x: number; y: number; children: React.ReactNode }> = ({ delay, x, y, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 11, stiffness: 140, mass: 0.7 } });
  return <g transform={`translate(${x} ${y}) scale(${Math.max(0.0001, s)}) translate(${-x} ${-y})`} opacity={Math.min(1, s * 2)}>{children}</g>;
};

const Building: React.FC<{ x: number; w: number; h: number; dome?: boolean; minaret?: boolean; base: number; i: number; frame: number }> = ({ x, w, h, dome, minaret, base, i, frame }) => {
  const top = base - h;
  const windows = [] as React.ReactNode[];
  for (let r = 0; r < Math.floor(h / 70); r++)
    for (let c = 0; c < Math.max(1, Math.floor(w / 60)); c++) {
      const k = i * 17 + r * 5 + c;
      const on = frame > 50 + rnd(k) * 120;
      windows.push(<rect key={`${r}-${c}`} x={x + 18 + c * 60} y={top + 30 + r * 70} width={22} height={32} rx={11} fill={on ? "#FFD27A" : "#2A2160"} opacity={on ? 0.95 : 0.6} />);
    }
  return (
    <g>
      <rect x={x} y={top} width={w} height={h} rx={10} fill="url(#fm-bld)" />
      <rect x={x} y={top} width={w} height={8} rx={4} fill="#8F7BE8" opacity={0.6} />
      {dome ? <path d={`M${x + w * 0.12} ${top} A${w * 0.38} ${w * 0.42} 0 0 1 ${x + w * 0.88} ${top} Z`} fill="url(#fm-dome)" /> : null}
      {dome ? <rect x={x + w / 2 - 3} y={top - w * 0.42 - 26} width={6} height={30} rx={3} fill="#F2C46D" /> : null}
      {minaret ? (
        <g>
          <rect x={x + w - 34} y={top - 230} width={26} height={232} rx={13} fill="url(#fm-bld)" />
          <rect x={x + w - 42} y={top - 170} width={42} height={12} rx={6} fill="#8F7BE8" />
          <path d={`M${x + w - 34} ${top - 228} Q${x + w - 21} ${top - 280} ${x + w - 8} ${top - 228} Z`} fill="url(#fm-dome)" />
        </g>
      ) : null}
      {windows}
    </g>
  );
};

const FlatCamel: React.FC<{ t: number; phase: number; color: string }> = ({ t, phase, color }) => {
  const w = t * 5 + phase;
  const b = Math.abs(Math.sin(w)) * -6;
  return (
    <g transform={`translate(0 ${b})`}>
      {[-34, -14, 22, 42].map((lx, k) => <rect key={k} x={lx} y={10} width={12} height={58} rx={6} fill={color} opacity={k % 2 ? 0.8 : 1} transform={`rotate(${Math.sin(w + (k % 2) * Math.PI) * 14} ${lx + 6} 12)`} />)}
      <ellipse cx={4} cy={0} rx={56} ry={30} fill={color} />
      <circle cx={-6} cy={-26} r={22} fill={color} />
      <rect x={42} y={-58} width={18} height={64} rx={9} fill={color} transform={`rotate(${18 + Math.sin(w * 2) * 4} 51 0)`} />
      <ellipse cx={74} cy={-58} rx={20} ry={12} fill={color} />
      <rect x={-30} y={-58} width={46} height={28} rx={10} fill="#F2C46D" />
    </g>
  );
};

export const FlatModernDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const base = 760;
  const blds = [
    { x: 760, w: 150, h: 230, dome: true },
    { x: 920, w: 120, h: 300 },
    { x: 1050, w: 210, h: 260, dome: true, minaret: true },
    { x: 1270, w: 130, h: 200 },
    { x: 1410, w: 180, h: 330, dome: true },
    { x: 1600, w: 120, h: 240, minaret: true },
    { x: 1730, w: 170, h: 210, dome: true },
  ];
  return (
    <AbsoluteFill style={{ background: "#0E1748" }}>
      <svg viewBox="0 0 1920 1080" style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id="fm-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0E1748" />
            <stop offset="0.55" stopColor="#3B2C8A" />
            <stop offset="0.85" stopColor="#C2558F" />
            <stop offset="1" stopColor="#F28C6B" />
          </linearGradient>
          <linearGradient id="fm-bld" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5A45C2" /><stop offset="1" stopColor="#2A1F7A" /></linearGradient>
          <linearGradient id="fm-dome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#44D0C3" /><stop offset="1" stopColor="#1C8C9B" /></linearGradient>
          <linearGradient id="fm-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F2A15A" /><stop offset="1" stopColor="#C5584A" /></linearGradient>
          <linearGradient id="fm-ground2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D9714E" /><stop offset="1" stopColor="#7A2E4A" /></linearGradient>
          <radialGradient id="fm-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#FFD27A" stopOpacity={0.9} /><stop offset="1" stopColor="#FFD27A" stopOpacity={0} /></radialGradient>
        </defs>
        <g transform={`translate(960 600) scale(${1.04 + p * 0.06}) translate(-960 -600)`}>
          <rect width={1920} height={1080} fill="url(#fm-sky)" />
          {/* نجوم على شكل علامة + */}
          {Array.from({ length: 34 }, (_, i) => {
            const s = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.6 + i * 1.3));
            const x = rnd(i) * 1920;
            const y = rnd(i + 30) * 460;
            return <path key={i} d={`M${x - 6 * s} ${y} H${x + 6 * s} M${x} ${y - 6 * s} V${y + 6 * s}`} stroke="#FFF3D6" strokeWidth={2.6} strokeLinecap="round" opacity={s} />;
          })}
          {/* قمر بحلقات توهج */}
          <Pop delay={4} x={420} y={260}>
            {[180, 130, 90].map((r, i) => <circle key={r} cx={420} cy={260} r={r + Math.sin(t * 2 + i) * 4} fill="#FFE7B8" opacity={0.06 + i * 0.05} />)}
            <circle cx={420} cy={260} r={64} fill="#FFF1D2" />
            <circle cx={398} cy={248} r={12} fill="#F2DDB0" />
            <circle cx={440} cy={280} r={8} fill="#F2DDB0" />
          </Pop>
          {/* تلال خلفية */}
          <path d="M0 760 Q300 650 640 720 T1300 700 T1920 690 V1080 H0 Z" fill="#6E3A8F" opacity={0.7} />
          {/* المدينة تُبنى قطعة قطعة */}
          {blds.map((b, i) => (
            <Pop key={i} delay={10 + i * 5} x={b.x + b.w / 2} y={base}>
              <Building {...b} base={base} i={i} frame={frame} />
            </Pop>
          ))}
          <Pop delay={44} x={1300} y={base}>
            <rect x={700} y={base - 70} width={1250} height={74} rx={14} fill="#3A2C9A" />
            {Array.from({ length: 24 }, (_, i) => <rect key={i} x={712 + i * 52} y={base - 90} width={30} height={26} rx={8} fill="#3A2C9A" />)}
            <path d={`M1240 ${base + 4} V${base - 50} A40 46 0 0 1 1320 ${base - 50} V${base + 4} Z`} fill="#1A1450" />
            <circle cx={1280} cy={base - 30} r={70} fill="url(#fm-glow)" opacity={0.5 + Math.sin(t * 3) * 0.1} />
          </Pop>
          {/* أرض متدرجة */}
          <path d="M0 790 Q480 740 960 780 T1920 770 V1080 H0 Z" fill="url(#fm-ground)" />
          <path d="M0 930 Q600 880 1200 930 T1920 920 V1080 H0 Z" fill="url(#fm-ground2)" />
          {/* القافلة: تدخل من اليسار نحو البوابة */}
          {Array.from({ length: 5 }, (_, i) => {
            const x = interpolate(frame, [0, durationInFrames], [-400 + i * 150, 620 + i * 150]);
            return (
              <g key={i} transform={`translate(${x} ${852}) scale(0.95)`}>
                <ellipse cx={4} cy={70} rx={60} ry={10} fill="#5A1E3A" opacity={0.35} />
                <FlatCamel t={t} phase={i * 1.6} color={i % 2 ? "#FFB27A" : "#FF9A6A"} />
              </g>
            );
          })}
          {/* فقاعات ضوء عائمة */}
          {Array.from({ length: 18 }, (_, i) => {
            const y = (1000 - ((t * (20 + rnd(i) * 30) + rnd(i + 4) * 600) % 700));
            return <circle key={i} cx={rnd(i + 8) * 1920} cy={y} r={3 + rnd(i + 2) * 6} fill="#FFD27A" opacity={0.25} />;
          })}
        </g>
      </svg>
      <DemoText title="بغداد" date="القرن التاسع الميلادي" font={fontFamilies.heading} accent="#44D0C3" captionBg="rgba(14,23,72,0.55)" />
    </AbsoluteFill>
  );
};
