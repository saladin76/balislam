import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CamelShape, DemoText, WalkerShape, clamp, rnd, skylinePath } from "./common";

/**
 * نموذج «ظلال سينمائية»: سماء غروب متدرجة، طبقات تبهت مع البعد (منظور جوّي)، أفق بغداد ظلًّا،
 * قافلة سوداء تمشي على حافة الكثيب، رجل بعباءة تطير في المقدمة، أشعة وغبار وطيور، وكاميرا بعمق حقيقي.
 */
export const SilhouetteDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const cam = p * 220; // تحريك أفقي
  const zoom = 1 + p * 0.06;
  const layer = (depth: number, children: React.ReactNode) => (
    <g transform={`translate(${-cam * depth} ${p * 20 * depth}) translate(960 640) scale(${1 + (zoom - 1) * depth}) translate(-960 -640)`}>{children}</g>
  );
  return (
    <AbsoluteFill style={{ background: "#120713" }}>
      <svg viewBox="0 0 1920 1080" style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id="sl-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1A0E33" />
            <stop offset="0.35" stopColor="#5A2457" />
            <stop offset="0.62" stopColor="#D9634A" />
            <stop offset="0.78" stopColor="#F6B865" />
            <stop offset="1" stopColor="#F9D79A" />
          </linearGradient>
          <radialGradient id="sl-sun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#FFF4D6" />
            <stop offset="0.25" stopColor="#FFE0A0" stopOpacity={0.9} />
            <stop offset="1" stopColor="#FFB060" stopOpacity={0} />
          </radialGradient>
          <linearGradient id="sl-haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F6B865" stopOpacity={0} />
            <stop offset="1" stopColor="#F6B865" stopOpacity={0.55} />
          </linearGradient>
          <filter id="sl-soft"><feGaussianBlur stdDeviation={2.2} /></filter>
          <filter id="sl-ray"><feGaussianBlur stdDeviation={22} /></filter>
        </defs>
        <rect width={1920} height={1080} fill="url(#sl-sky)" />
        {/* نجوم خافتة في أعلى السماء */}
        {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={rnd(i) * 1920} cy={rnd(i + 50) * 260} r={1.4} fill="#fff" opacity={0.2 + 0.3 * Math.abs(Math.sin(t + i))} />)}
        {layer(0.05, <circle cx={1230} cy={600} r={340} fill="url(#sl-sun)" />)}
        {layer(0.05, <circle cx={1230} cy={600} r={78} fill="#FFF1CC" />)}
        {/* أشعة من الشمس */}
        <g filter="url(#sl-ray)" opacity={0.35 + Math.sin(t * 0.8) * 0.05} style={{ mixBlendMode: "screen" }}>
          {[-0.5, -0.2, 0.15, 0.45].map((a, i) => (
            <polygon key={i} points={`1230,600 ${1230 + Math.cos(a + Math.PI) * 2400},${600 + Math.sin(a + Math.PI * 0.95) * 900} ${1230 + Math.cos(a + Math.PI + 0.08) * 2400},${600 + Math.sin(a + Math.PI * 0.95 + 0.08) * 900}`} fill="#FFE2A8" />
          ))}
        </g>
        {/* سحب طويلة رفيعة */}
        {layer(0.1, [[300, 330, 520], [900, 250, 700], [1500, 380, 460]].map(([x, y, w], i) => <rect key={i} x={x! - w! / 2 + t * 6} y={y} width={w} height={12} rx={6} fill="#F7A27A" opacity={0.35} />))}
        {/* جبال بعيدة: فاتحة لأنها بعيدة */}
        {layer(0.12, <path fill="#B6596B" opacity={0.8} d="M-200 700 L60 600 L260 660 L520 560 L780 650 L1000 590 L1300 660 L1560 570 L1840 640 L2200 600 V1080 H-200 Z" />)}
        {layer(0.12, <rect x={-200} y={560} width={2400} height={180} fill="url(#sl-haze)" />)}
        {/* أفق بغداد */}
        {layer(0.25, <path fill="#6A2747" d={skylinePath(700, 2050, 740, 1.05, 7)} />)}
        {layer(0.25, <rect x={-200} y={640} width={2600} height={140} fill="url(#sl-haze)" opacity={0.7} />)}
        {/* كثيب أوسط عليه القافلة */}
        {layer(0.55, <path fill="#3A1530" d="M-300 860 Q200 770 700 800 T1600 790 T2500 820 V1080 H-300 Z" />)}
        {layer(0.55,
          <g filter="url(#sl-soft)">
            {Array.from({ length: 7 }, (_, i) => {
              const x = -260 + i * 200 + t * 52;
              const y = 788 - Math.sin((x + 300) / 900) * 10;
              return (
                <g key={i} transform={`translate(${x} ${y - 78}) scale(0.62)`}>
                  {i % 3 === 1 ? <WalkerShape t={t} phase={i * 1.4} fill="#1E0A18" /> : <CamelShape t={t} phase={i * 1.7} fill="#1E0A18" load="#1E0A18" />}
                </g>
              );
            })}
          </g>,
        )}
        {/* غبار خلف القافلة */}
        {layer(0.55, Array.from({ length: 10 }, (_, i) => <ellipse key={i} cx={-200 + i * 150 + t * 52 + Math.sin(t + i) * 20} cy={790} rx={90} ry={22} fill="#F6B865" opacity={0.12} />))}
        {/* المقدمة: تل صخري ورجل بعباءة تطير */}
        {layer(1.25,
          <g>
            <path fill="#0B0409" d="M-300 1080 L-300 900 Q60 860 360 900 Q520 880 640 940 Q760 1000 900 1080 Z" />
            <g transform="translate(330 770) scale(1.35)">
              <path fill="#0B0409" d="M-18 120 L-12 30 Q-30 -10 -16 -50 Q0 -64 16 -50 Q30 -10 14 30 L20 120 Z" />
              <circle cx={0} cy={-64} r={16} fill="#0B0409" />
              <path fill="#0B0409" d={`M-14 -52 Q${-70 - Math.sin(t * 3) * 14} ${-20 + Math.sin(t * 2.4) * 10} ${-120 - Math.sin(t * 2) * 20} ${40 + Math.sin(t * 3.1) * 14} Q-60 40 -14 10 Z`} />
              <path d="M16 -30 L64 -96" stroke="#0B0409" strokeWidth={6} strokeLinecap="round" />
            </g>
          </g>,
        )}
        {/* طيور */}
        {Array.from({ length: 5 }, (_, i) => {
          const x = 1500 - t * (60 + i * 8) - i * 70;
          const y = 360 + i * 22 + Math.sin(t * 2 + i) * 8;
          const f = Math.sin(t * 10 + i) * 8;
          return <path key={i} d={`M${x - 14} ${y - f} Q${x - 7} ${y - 4} ${x} ${y} Q${x + 7} ${y - 4} ${x + 14} ${y - f}`} stroke="#2A0F25" strokeWidth={3} fill="none" />;
        })}
        {/* ذرات ذهبية في الهواء */}
        {Array.from({ length: 60 }, (_, i) => <circle key={`d${i}`} cx={(rnd(i) * 1920 + t * (10 + rnd(i + 3) * 20)) % 1920} cy={500 + rnd(i + 9) * 520 + Math.sin(t + i) * 10} r={1 + rnd(i + 4) * 2.4} fill="#FFD9A0" opacity={0.15 + rnd(i + 7) * 0.35} />)}
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 75% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
      <DemoText title="بغداد" date="القرن التاسع الميلادي" />
    </AbsoluteFill>
  );
};
