import React from "react";
import { AbsoluteFill, Easing, interpolate, spring } from "remotion";
import { fontFamilies } from "../../../brand/fonts";
import { useChannel } from "../../channel/context";
import { useBrandFonts } from "../useBrandFonts";
import { clamp } from "./motion";

type P = { frame: number; fps: number; portrait: boolean };

/**
 * دفاتر الزمن «دفتر الأفق» (٣٫٥ ث): دفتر مغلق بشريط أحمر في سماء الغسق ← ينفتح من كعبه
 * ← غروب يُرسم على صفحتيه وخط الأفق بعلامات القرون ← الدفتر يصعد والاسم بالأميري واسم القناة اللاتيني بخط الآلة الكاتبة.
 */
export const HORIZON_FRAMES = 105;
const PAGES = "M140 34 C110 22 62 20 22 30 V172 C62 162 110 164 140 176 C170 164 218 162 258 172 V30 C218 20 170 22 140 34 Z";
const LEFT = "M140 34 C110 22 62 20 22 30 V172 C62 162 110 164 140 176 Z";
const RIGHT = "M140 34 C170 22 218 20 258 30 V172 C218 162 170 164 140 176 Z";

export const HorizonIntro: React.FC<P> = ({ frame, fps, portrait }) => {
  useBrandFonts();
  const ch = useChannel();
  const W = portrait ? 1080 : 1920;
  const H = portrait ? 1920 : 1080;
  const appear = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 90 } });
  const open = interpolate(frame, [16, 40], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const sun = interpolate(frame, [38, 64], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const line = interpolate(frame, [42, 60], [0, 1], clamp);
  const lift = interpolate(frame, [68, 84], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const nameT = interpolate(frame, [72, 86], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const latin = interpolate(frame, [80, 93], [0, 1], clamp);
  // من -1 (الغلاف مطوي فوق الصفحة اليمنى) إلى 1 (مفتوح)، مع تجاوز ضئيل للصفر كي لا يختفي
  const flip = -1 + 2 * open === 0 ? 0.01 : -1 + 2 * open;
  const bw = portrait ? 860 : 820;
  const bh = (bw * 210) / 280;
  const scale = (0.86 + 0.14 * appear) * (1 - 0.32 * lift);
  const by = H / 2 - bh / 2 - lift * (portrait ? 220 : 150);
  const skyShift = interpolate(frame, [0, HORIZON_FRAMES], [0, 1], clamp);
  const latinText = (ch.nameLatin ?? "").toUpperCase();
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #0D0A14 0%, #1A1424 ${40 - skyShift * 8}%, #2A1E3F ${70 - skyShift * 10}%, #5A2E48 100%)`, overflow: "hidden" }}>
      {Array.from({ length: 70 }, (_, i) => {
        const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * W;
        const y = (Math.sin(i * 37.3) * 0.5 + 0.5) * H * 0.7;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: 3, height: 3, borderRadius: 2, background: "#F3E9DA", opacity: (0.25 + 0.35 * Math.abs(Math.sin(i + frame / 12))) * (1 - 0.4 * sun) }} />;
      })}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% ${(by + bh * 0.62) / H * 100}%, rgba(224,122,63,${0.35 * sun}) 0%, rgba(224,122,63,0) 45%)` }} />
      <div style={{ position: "absolute", left: W / 2 - bw / 2, top: by, width: bw, height: bh, transform: `scale(${scale})`, opacity: Math.min(1, appear * 1.5), filter: "drop-shadow(0 24px 40px rgba(0,0,0,0.5))" }}>
        <svg width={bw} height={bh} viewBox="0 0 280 210" style={{ overflow: "visible" }}>
          <defs>
            <clipPath id="hz-pages"><path d={PAGES} /></clipPath>
            <clipPath id="hz-sky"><rect x={0} y={0} width={280} height={128} /></clipPath>
          </defs>
          {/* الصفحة اليمنى ثابتة، واليسرى تنفتح من الكعب */}
          <path d={RIGHT} fill="#F1E4CB" stroke="#4A2E1F" strokeWidth={5} strokeLinejoin="round" />
          <g transform={`translate(140 0) scale(${flip} 1) translate(-140 0)`}>
            <path d={LEFT} fill={flip < 0 ? "#5A3A26" : "#F1E4CB"} stroke="#4A2E1F" strokeWidth={5} strokeLinejoin="round" />
            {flip < 0 ? <path d="M60 60 H110 M60 76 H96" stroke="#C8A15A" strokeWidth={4} strokeLinecap="round" opacity={0.8} /> : null}
          </g>
          {open > 0.98 ? (
            <g clipPath="url(#hz-pages)">
              <g clipPath="url(#hz-sky)">
                <circle cx={140} cy={128 + (1 - sun) * 50} r={46} fill="#E07A3F" />
              </g>
              <path d="M0 128 H280" stroke="#4A2E1F" strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - line} />
              {[40, 80, 200, 240].map((x, i) => <path key={x} d={`M${x} 128 V${i % 3 === 0 ? 140 : 136}`} stroke="#4A2E1F" strokeWidth={3} opacity={line > 0.3 + i * 0.15 ? 1 : 0} />)}
              <path d="M60 150 H110 M170 150 H220" stroke="#4A2E1F" strokeOpacity={0.3} strokeWidth={3} strokeDasharray={50} strokeDashoffset={50 * (1 - line)} />
            </g>
          ) : null}
          <path d="M128 40 H152 L142 104 L152 168 H128 L138 104 Z" fill="#C8A15A" stroke="#4A2E1F" strokeWidth={3} strokeLinejoin="round" />
          <path d={`M206 ${18 - (1 - appear) * 10} V${72 + sun * 6} L214 ${64 + sun * 6} L222 ${72 + sun * 6} V18 Z`} fill="#D7372B" />
        </svg>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: by + bh * (portrait ? 0.92 : 0.86), display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ fontFamily: "'Amiri', serif", fontWeight: 700, fontSize: portrait ? 150 : 128, lineHeight: 1.3, color: "#F3E9DA", clipPath: `inset(-20% 0 -20% ${(1 - nameT) * 100}%)`, direction: "rtl", textShadow: "0 6px 30px rgba(13,10,20,0.8)" }}>{ch.nameDisplay ?? ch.name}</div>
        <div style={{ fontFamily: fontFamilies.mono, fontSize: portrait ? 26 : 22, letterSpacing: "0.35em", color: "#F3C98B", direction: "ltr" }}>{latinText.slice(0, Math.round(latin * latinText.length))}</div>
      </div>
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${portrait ? 240 : 300}px ${portrait ? 60 : 90}px #0D0A14`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

/**
 * زبدة الكتب «القلم المميِّز» (٢٫٢ ث، سريعة كالشورتس): سطور صفحة باهتة ← قلم فسفوري يظلّل سطرًا
 * ← الظل يملأ الشاشة ويبقى حرف الزاي ← الاسم و«الكتب» مظلّلة.
 */
export const HIGHLIGHTER_FRAMES = 76;

export const HighlighterIntro: React.FC<P> = ({ frame, fps, portrait }) => {
  useBrandFonts();
  const ch = useChannel();
  const W = portrait ? 1080 : 1920;
  const H = portrait ? 1920 : 1080;
  const sweep = interpolate(frame, [6, 18], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const flood = interpolate(frame, [20, 30], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const zIn = spring({ frame: frame - 26, fps, config: { damping: 11, stiffness: 190, mass: 0.6 } });
  const out = interpolate(frame, [40, 48], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const nameOp = interpolate(frame, [45, 49], [0, 1], clamp);
  const nameIn = spring({ frame: frame - 44, fps, config: { damping: 14, stiffness: 170 } });
  const mark = interpolate(frame, [50, 58], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const lines = portrait ? 14 : 8;
  const gap = portrait ? 110 : 96;
  const y0 = H / 2 - ((lines - 1) * gap) / 2;
  const target = Math.floor(lines / 2);
  const [first, ...rest] = (ch.nameDisplay ?? ch.name).split(" ");
  const nameSize = portrait ? 170 : 150;
  return (
    <AbsoluteFill style={{ background: "#FFFFFF", overflow: "hidden" }}>
      {/* سطور الصفحة */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: flood >= 0.99 ? 0 : 1 }}>
        {Array.from({ length: lines }, (_, i) => {
          const y = y0 + i * gap;
          const len = W * (i === target ? 0.62 : 0.5 + 0.18 * Math.abs(Math.sin(i * 7.3)));
          const x2 = W * 0.82;
          return <path key={i} d={`M${x2} ${y} H${x2 - len}`} stroke={i === target ? "#111111" : "#D8D8D8"} strokeWidth={i === target ? 16 : 12} strokeLinecap="round" />;
        })}
        {/* ضربة القلم: من اليمين إلى اليسار */}
        <path d={`M${W * 0.84} ${y0 + target * gap - 30} L${W * 0.84 - W * 0.68 * sweep} ${y0 + target * gap - 34} L${W * 0.84 - W * 0.68 * sweep} ${y0 + target * gap + 30} L${W * 0.84} ${y0 + target * gap + 34} Z`} fill="#E8F542" style={{ mixBlendMode: "multiply" }} />
      </svg>
      {/* الظل يملأ الشاشة */}
      <div style={{ position: "absolute", left: 0, right: 0, top: y0 + target * gap - 34 - (y0 + target * gap) * flood, height: 68 + H * flood * 1.1, background: "#E8F542", opacity: flood > 0 ? 1 - out : 0 }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - out }}>
        <div style={{ fontFamily: "'Lalezar', sans-serif", fontSize: portrait ? 620 : 520, lineHeight: 1, color: "#111111", transform: `scale(${zIn * (1 + out * 0.6)}) rotate(${(1 - zIn) * -10}deg)` }}>ز</div>
      </AbsoluteFill>
      {/* الاسم */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, opacity: nameOp }}>
        <div style={{ display: "flex", alignItems: "center", gap: nameSize * 0.25, direction: "rtl", transform: `translateY(${(1 - nameIn) * 40}px)` }}>
          <span style={{ fontFamily: "'Lalezar', sans-serif", fontSize: nameSize, lineHeight: 1.2, color: "#111111" }}>{first}</span>
          {rest.length ? (
            <span style={{ position: "relative", fontFamily: "'Lalezar', sans-serif", fontSize: nameSize, lineHeight: 1.2, color: "#111111" }}>
              <span style={{ position: "absolute", top: "18%", bottom: "6%", right: -14, width: `calc(${mark * 100}% + ${28 * mark}px)`, background: "#E8F542", opacity: mark > 0 ? 1 : 0 }} />
              <span style={{ position: "relative" }}>{rest.join(" ")}</span>
            </span>
          ) : null}
        </div>
        <div style={{ fontFamily: fontFamilies.clean, fontWeight: 700, fontSize: portrait ? 26 : 22, letterSpacing: "0.4em", color: "#4A4A4A", direction: "ltr", opacity: mark }}>{(ch.nameLatin ?? "").toUpperCase()}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
