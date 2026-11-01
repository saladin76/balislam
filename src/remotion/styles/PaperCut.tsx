import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CamelShape, DemoText, WalkerShape, clamp, rnd, skylinePath } from "./common";

/**
 * نموذج «ورق مقصوص ثلاثي الأبعاد»: كل طبقة ورقة بملمس وحافة، ظل حقيقي بين الطبقات، والكاميرا تميل في فضاء
 * ثلاثي الأبعاد فتتحرك الطبقات بعمق حقيقي. الشمس والسحب معلّقة بخيوط كمسرح ورقي، والقافلة دمى ورقية بمفاصل.
 */
const PAPER = (id: string, seed: number) => (
  <filter id={id} x="-2%" y="-2%" width="104%" height="104%">
    <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={3} seed={seed} result="n" />
    <feDiffuseLighting in="n" lightingColor="#fff" surfaceScale={1.4} result="l">
      <feDistantLight azimuth={45} elevation={60} />
    </feDiffuseLighting>
    <feComposite in="l" in2="SourceAlpha" operator="in" result="lt" />
    <feBlend in="SourceGraphic" in2="lt" mode="multiply" />
  </filter>
);

/** حافة ورق ممزقة قليلًا: موجة مع اهتزاز صغير */
const ridge = (y: number, amp: number, seed: number, w = 2400, x0 = -240) => {
  let d = `M${x0} 1200 L${x0} ${y}`;
  for (let x = x0; x <= x0 + w; x += 40) d += ` L${x} ${y - Math.sin((x + seed * 300) / 260) * amp - rnd(x + seed) * 6}`;
  return `${d} L${x0 + w} 1200 Z`;
};

const Layer: React.FC<{ z: number; shadow?: number; children: React.ReactNode }> = ({ z, shadow = 14, children }) => {
  const s = 1 - z / 1600; // تعويض الحجم حتى تملأ الطبقات البعيدة الإطار
  return (
    <div style={{ position: "absolute", inset: 0, transform: `translateZ(${z}px) scale(${s})`, filter: `drop-shadow(0 ${shadow * 0.6}px ${shadow}px rgba(70,30,10,0.38))` }}>
      <svg viewBox="0 0 1920 1080" style={{ width: "100%", height: "100%", overflow: "visible" }}>{children}</svg>
    </div>
  );
};

export const PaperCutDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const rotY = interpolate(p, [0, 1], [-7, 6]);
  const rotX = interpolate(p, [0, 1], [3, 1]);
  const camX = interpolate(p, [0, 1], [60, -60]);
  const sway = (k: number) => Math.sin(t * 1.2 + k) * 2.2;

  return (
    <AbsoluteFill style={{ background: "#F1DDB8", perspective: 1600, perspectiveOrigin: "50% 45%", overflow: "hidden" }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          {PAPER("pp1", 1)}
          {PAPER("pp2", 2)}
          {PAPER("pp3", 3)}
          {PAPER("pp4", 4)}
          {PAPER("pp5", 5)}
        </defs>
      </svg>
      <AbsoluteFill style={{ transformStyle: "preserve-3d", transform: `translateX(${camX}px) rotateY(${rotY}deg) rotateX(${rotX}deg)` }}>
        {/* السماء */}
        <Layer z={-700} shadow={0}>
          <rect x={-600} y={-400} width={3120} height={1900} fill="#F3D7A8" filter="url(#pp1)" />
          {Array.from({ length: 5 }, (_, i) => <rect key={i} x={-600} y={-100 + i * 110} width={3120} height={110} fill={["#E9B98A", "#EDC596", "#F0CFA0", "#F3D7A8", "#F5DEB2"][i]} filter="url(#pp1)" />)}
        </Layer>
        {/* الشمس معلّقة بخيط */}
        <Layer z={-560} shadow={18}>
          <line x1={1260} y1={-300} x2={1260} y2={300 + sway(1) * 4} stroke="#8A6A4A" strokeWidth={2} />
          <g transform={`rotate(${sway(1)} 1260 -300)`}>
            <circle cx={1260} cy={380} r={96} fill="#E58A4E" filter="url(#pp2)" />
            <circle cx={1260} cy={380} r={70} fill="#F2A65E" filter="url(#pp2)" />
          </g>
        </Layer>
        {/* سحب معلّقة */}
        <Layer z={-480} shadow={14}>
          {[[420, 230, 0], [900, 170, 2], [1420, 300, 4]].map(([x, y, k]) => (
            <g key={x} transform={`rotate(${sway(k!)} ${x} -300)`}>
              <line x1={x} y1={-300} x2={x} y2={y! - 30} stroke="#8A6A4A" strokeWidth={2} />
              <path d={`M${x! - 110} ${y} Q${x! - 100} ${y! - 50} ${x! - 40} ${y! - 46} Q${x! - 10} ${y! - 90} ${x! + 40} ${y! - 60} Q${x! + 110} ${y! - 70} ${x! + 120} ${y} Z`} fill="#FFF4E2" filter="url(#pp2)" />
            </g>
          ))}
        </Layer>
        {/* جبال بعيدة */}
        <Layer z={-380}>
          <path d="M-400 760 L-100 600 L160 680 L460 560 L760 670 L1060 590 L1360 680 L1660 570 L1960 660 L2300 600 V1300 H-400 Z" fill="#C98E6E" filter="url(#pp3)" />
        </Layer>
        {/* أفق بغداد */}
        <Layer z={-240}>
          <path d={skylinePath(640, 2100, 790, 1.1, 7)} fill="#9A5644" filter="url(#pp3)" />
          {Array.from({ length: 16 }, (_, i) => <rect key={i} x={700 + i * 82} y={700 + (i % 3) * 20} width={10} height={16} rx={5} fill="#F6C46A" opacity={0.85} />)}
        </Layer>
        {/* كثيب أول */}
        <Layer z={-120}>
          <path d={ridge(830, 26, 1)} fill="#DDAA6A" filter="url(#pp4)" />
        </Layer>
        {/* القافلة: دمى ورقية بمفاصل */}
        <Layer z={-40} shadow={10}>
          {Array.from({ length: 6 }, (_, i) => {
            const x = -320 + i * 190 + t * 60;
            return (
              <g key={i} transform={`translate(${x} ${790}) scale(0.62)`} filter="url(#pp5)">
                {i % 3 === 1 ? <WalkerShape t={t} phase={i * 1.4} fill="#6A3A28" /> : <CamelShape t={t} phase={i * 1.7} fill="#8A5234" load="#C2553A" />}
              </g>
            );
          })}
        </Layer>
        {/* كثيب أمامي */}
        <Layer z={60} shadow={20}>
          <path d={ridge(930, 34, 3)} fill="#C98A4E" filter="url(#pp4)" />
        </Layer>
        {/* المقدمة: نخلة وصخور */}
        <Layer z={200} shadow={24}>
          <path d={ridge(1010, 20, 6)} fill="#9C5E34" filter="url(#pp5)" />
          <g transform="translate(150 1010)" filter="url(#pp5)">
            <path d="M-14 0 Q-6 -200 18 -380 L32 -380 Q10 -200 14 0 Z" fill="#6A3E22" />
            {[-60, -25, 10, 45, 80, 120].map((a, i) => <path key={i} transform={`rotate(${a + sway(i) * 1.5} 25 -380)`} d="M25 -380 Q120 -430 220 -380 Q120 -400 25 -380 Z" fill={i % 2 ? "#4E7A3E" : "#5E8E48"} />)}
          </g>
        </Layer>
      </AbsoluteFill>
      {/* إطار مسرحي داكن */}
      <AbsoluteFill style={{ boxShadow: "inset 0 0 160px 30px rgba(60,25,8,0.55)" }} />
      <DemoText title="بغداد" date="القرن التاسع الميلادي" color="#5A2A18" accent="#B4532F" captionBg="rgba(70,30,10,0.55)" panel="rgba(255,244,226,0.82)" captionColor="#FFF4E2" />
    </AbsoluteFill>
  );
};
