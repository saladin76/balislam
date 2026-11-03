import React from "react";
import { AbsoluteFill, Easing, interpolate, spring } from "remotion";
import { fontFamilies } from "../../../brand/fonts";
import { useChannel } from "../../channel/context";
import { clamp } from "./motion";
import { useBrandFonts } from "../useBrandFonts";

/**
 * افتتاحية «محراب النور» (بالإسلام، الهوية المعتمدة):
 * النقش الهندسي يتركّب من أطراف الشاشة ← يتجمع في قوس محراب نحاسي يضيء بنور الفجر من أسفله
 * ← فرشاة تكتب الباء ← نقطتها شمس ذهبية تطلع ← الشعار يصعد ويُكتب الاسم بالرقعة ← ختم أحمر يضغط.
 * بلا موسيقى (مؤثرات: نقرات تركيب، فرشاة، ضغطة ختم).
 */
export const MIHRAB_FRAMES = 105;

export const MIHRAB = {
  night: "#0B1F1C",
  night2: "#0F2A26",
  brass: "#C9A24A",
  dawn: "#F2B35B",
  paper: "#F4EEE2",
  seal: "#C2412D",
} as const;

/** مسارات الشعار (مساحة 210×250) لتُستعمل في كل مكان: الافتتاحية والصورة المصغّرة وصورة الحساب. */
export const MIHRAB_PATHS = {
  arch: "M32 240 V104 A73 73 0 0 1 178 104 V240",
  archFill: "M32 240 V104 A73 73 0 0 1 178 104 V240 Z",
  star: "M105 46 L118 59 L105 72 L92 59 Z M96 50 H114 V68 H96 Z",
  baa: "M161 118 C163 158 139 190 105 190 C75 190 53 173 51 146 L64 147 C67 165 84 176 105 176 C132 176 148 155 148 118 Z",
} as const;

const tile = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy} Z M${cx - r * 0.7} ${cy - r * 0.7} H${cx + r * 0.7} V${cy + r * 0.7} H${cx - r * 0.7} Z`;

export const MihrabIntro: React.FC<{ frame: number; fps: number; portrait: boolean }> = ({ frame, fps, portrait }) => {
  useBrandFonts();
  const ch = useChannel();
  const W = portrait ? 1080 : 1920;
  const H = portrait ? 1920 : 1080;
  const c = MIHRAB;

  // ١) النقش: يُرسم من الأطراف نحو المركز
  const gap = 170;
  const tiles: { x: number; y: number; d: number }[] = [];
  for (let x = gap / 2; x < W + gap; x += gap) for (let y = gap / 2; y < H + gap; y += gap) tiles.push({ x, y, d: Math.hypot(x - W / 2, y - H / 2) });
  const maxD = Math.hypot(W / 2, H / 2);
  const patternFade = interpolate(frame, [28, 52], [0.42, 0.1], clamp);

  // ٢) المحراب: القوس يُرسم ثم يمتلئ بنور الفجر من أسفله
  const archDraw = interpolate(frame, [20, 44], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const glow = interpolate(frame, [36, 62], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const starPop = spring({ frame: frame - 40, fps, config: { damping: 10, stiffness: 160, mass: 0.6 } });
  // ٣) الفرشاة تكتب الباء (من اليمين إلى اليسار) والشمس تطلع
  const brush = interpolate(frame, [48, 64], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const sun = spring({ frame: frame - 62, fps, config: { damping: 12, stiffness: 120 } });
  // ٤) الشعار يصعد ويصغر، والاسم يُكتب، والختم يضغط
  const lift = interpolate(frame, [70, 86], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const nameT = interpolate(frame, [76, 92], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const stamp = spring({ frame: frame - 90, fps, config: { damping: 9, stiffness: 220, mass: 0.5 } });
  const shake = frame >= 90 && frame < 96 ? Math.sin((frame - 90) * 3) * 3 * (1 - (frame - 90) / 6) : 0;
  const push = 1 + interpolate(frame, [0, MIHRAB_FRAMES], [0, 0.05], clamp);

  const emH = portrait ? 520 : 440;
  const emW = (emH * 210) / 250;
  const scale = 1 - 0.38 * lift;
  const emY = H / 2 - emH / 2 - lift * (portrait ? 230 : 150);

  return (
    <AbsoluteFill style={{ background: c.night, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% ${portrait ? 46 : 50}%, ${c.night2} 0%, ${c.night} 70%)` }} />
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          {tiles.map((t, i) => {
            const delay = (t.d / maxD) * -14 + 16; // الأبعد يبدأ أولًا
            const p = interpolate(frame, [delay, delay + 16], [0, 1], clamp);
            return <path key={i} d={tile(t.x, t.y, 52)} fill="none" stroke={c.brass} strokeWidth={1.6} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} opacity={patternFade} />;
          })}
        </svg>
        {/* هالة الفجر خلف المحراب */}
        <div style={{ position: "absolute", left: W / 2 - emW * 1.3 * scale, top: emY + emH * 0.62 - emW * 1.3 * scale, width: emW * 2.6 * scale, height: emW * 2.6 * scale, borderRadius: "50%", background: `radial-gradient(circle, ${c.dawn}50 0%, ${c.dawn}00 60%)`, opacity: glow * (1 - 0.35 * lift) }} />
        <div style={{ position: "absolute", left: W / 2 - emW / 2, top: emY, width: emW, height: emH, transform: `scale(${scale}) translateX(${shake}px)`, transformOrigin: "50% 50%" }}>
          <svg width={emW} height={emH} viewBox="0 0 210 250" style={{ overflow: "visible" }}>
            <defs>
              <linearGradient id="mihrab-dawn" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor={c.dawn} stopOpacity={0.75} />
                <stop offset="0.75" stopColor={c.dawn} stopOpacity={0.05} />
              </linearGradient>
              <clipPath id="mihrab-glow-clip">
                <rect x={0} y={250 - 250 * glow} width={210} height={250} />
              </clipPath>
            </defs>
            <path d={MIHRAB_PATHS.archFill} fill="url(#mihrab-dawn)" clipPath="url(#mihrab-glow-clip)" />
            <path d={MIHRAB_PATHS.arch} fill="none" stroke={c.brass} strokeWidth={7} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - archDraw} />
            <g transform={`translate(105 59) scale(${Math.max(0.001, starPop)}) translate(-105 -59)`}>
              <path d={MIHRAB_PATHS.star} fill="none" stroke={c.brass} strokeWidth={3} />
            </g>
            <g style={{ clipPath: `inset(-10% -10% -10% ${(1 - brush) * 110}%)` }}>
              <path d={MIHRAB_PATHS.baa} fill={c.paper} />
            </g>
            <g transform={`translate(105 ${222 + (1 - sun) * 18})`} opacity={Math.min(1, sun * 1.5)}>
              <circle r={22 * sun} fill={c.dawn} opacity={0.25} />
              <rect x={-9} y={-9} width={18} height={18} transform="rotate(45)" fill={c.dawn} />
            </g>
          </svg>
        </div>
        {/* الاسم بالرقعة والختم */}
        <div style={{ position: "absolute", left: 0, right: 0, top: emY + emH * (portrait ? 0.86 : 0.8), display: "flex", flexDirection: "column", alignItems: "center", gap: portrait ? 10 : 6 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 22, direction: "rtl" }}>
            <div style={{ fontFamily: "'Aref Ruqaa', serif", fontWeight: 700, fontSize: portrait ? 150 : 128, lineHeight: 1.25, color: c.paper, clipPath: `inset(-20% 0 -20% ${(1 - nameT) * 100}%)`, textShadow: `0 6px 30px ${c.night}` }}>{ch.nameDisplay ?? ch.name}</div>
            <div style={{ width: portrait ? 48 : 40, height: portrait ? 48 : 40, borderRadius: 6, background: c.seal, transform: `scale(${stamp > 0.001 ? 1.6 - 0.6 * stamp : 0}) rotate(${(1 - stamp) * 14}deg)`, opacity: Math.min(1, stamp * 2), boxShadow: `0 0 ${20 * (1 - stamp)}px ${c.seal}` }} />
          </div>
          <div style={{ fontFamily: fontFamilies.wordmark, fontWeight: 300, fontSize: portrait ? 26 : 22, letterSpacing: "0.55em", color: c.brass, opacity: interpolate(frame, [86, 98], [0, 1], clamp), direction: "ltr", marginTop: portrait ? 18 : 14 }}>{(ch.nameLatin ?? "").toUpperCase()}</div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${portrait ? 240 : 300}px ${portrait ? 60 : 90}px ${c.night}`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
