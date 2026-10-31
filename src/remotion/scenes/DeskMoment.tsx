import React from "react";
import { Easing, interpolate, spring, useVideoConfig } from "remotion";
import { SceneShell } from "./SceneShell";
import { useSceneFrame } from "./motion";
import type { SceneBase, StringFields } from "./types";

/**
 * «لحظة على المكتب»: رسم مسطح بألوان الباستيل (غرفة، مكتب، نافذة على المدينة، رف)
 * وشخصية بلا ملامح وجه تتصفح هاتفها، والكاميرا تقترب ببطء، ثم ردّة فعل (! أو ؟ أو …).
 * يصلح لمشاهد الحياة اليومية: إشعار، خبر، رسالة، تشتت.
 */
export type DeskMomentProps = SceneBase & StringFields<"reaction" | "reactAt" | "push" | "screen" | "outfit">;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const C = {
  bg: "#F4F6EF",
  blob1: "#D6ECF3",
  blob2: "#FBEFCF",
  blob3: "#DCEFDD",
  line: "#2A2F3A",
  wood: "#C99A63",
  woodDark: "#A87C4B",
  deskTop: "#DCE0E6",
  skin: "#E3B58E",
  skinShade: "#CF9C74",
  hair: "#2B2420",
  pants: "#2C3A57",
  chair: "#2F4A7A",
  phone: "#1F2533",
  screen: "#A9DCEB",
  white: "#FFFFFF",
  leaf: "#8CC79A",
  leafDark: "#5FA675",
  pot: "#C98B5E",
  mug: "#EEE7DC",
  glass: "#E1F1F8",
  city: "#BCDCEB",
  accent: "#E8B23A",
};
const shirts: Record<string, string> = { blue: "#4A78B8", green: "#3E8E6E", sand: "#C49A62", maroon: "#9A4A4A" };

export const DeskMoment: React.FC<DeskMomentProps> = (props) => {
  const { orientation, reaction = "!", reactAt = "0.6", push = "on", screen = "feed", outfit = "blue" } = props;
  const frame = useSceneFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const portrait = orientation === "portrait";
  const shirt = shirts[outfit] ?? shirts.blue!;
  const lw = 5; // سماكة الخط الخارجي

  // التوقيت
  const t = frame / fps;
  const react = Math.round(durationInFrames * Math.min(0.9, Math.max(0.1, Number(reactAt) || 0.6)));
  const hasReaction = reaction !== "none" && reaction !== "";
  const r = hasReaction ? spring({ frame: frame - react, fps, config: { damping: 9, stiffness: 140 } }) : 0;
  const rIn = hasReaction ? interpolate(frame, [react, react + 4], [0, 1], clamp) : 0;

  // الكاميرا: اقتراب بطيء نحو الشخصية
  const zoom = push === "off" ? 1 : interpolate(frame, [0, durationInFrames], [1, portrait ? 1.18 : 1.32], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const focus = { x: 900, y: 470 };

  // التنفس والتمرير
  const breathe = Math.sin(t * 2.2) * 0.008;
  const swipeCycle = (frame % 22) / 22;
  const swipe = frame < react || !hasReaction ? Math.sin(swipeCycle * Math.PI) * 16 : 0;
  const feedShift = frame < react || !hasReaction ? (frame * 2.2) % 60 : (react * 2.2) % 60;

  // الرأس: منحنٍ إلى الهاتف، ثم يرتفع مع ردة الفعل
  const headTilt = interpolate(r, [0, 1], [7, -3]);
  const headLift = interpolate(r, [0, 1], [0, -10]);
  const phoneLift = interpolate(r, [0, 1], [0, -26]);
  const jolt = hasReaction ? Math.sin(Math.min(1, Math.max(0, (frame - react) / 8)) * Math.PI) * -8 : 0;

  // إطار الرؤية: العمودي يقص حول الشخصية
  const viewBox = portrait ? "420 -380 960 1707" : "0 0 1920 1080";
  const S = { stroke: C.line, strokeWidth: lw, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

  const bubble = (() => {
    if (!hasReaction) return null;
    const s = r;
    const txt = reaction === "?" ? "?" : reaction === "..." || reaction === "…" ? "…" : reaction === "heart" ? "♥" : "!";
    return (
      <g transform={`translate(1000 270) scale(${s}) rotate(${(1 - s) * -20})`} opacity={rIn}>
        <path {...S} fill={C.white} d="M-62 -40 Q-62 -78 -24 -78 H24 Q62 -78 62 -40 V8 Q62 44 24 44 H-6 L-30 70 L-24 44 Q-62 44 -62 8 Z" />
        <text x={0} y={reaction === "..." || reaction === "…" ? 6 : 26} textAnchor="middle" fontSize={reaction === "heart" ? 78 : 92} fontWeight={800} fill={reaction === "heart" ? "#E0565B" : C.accent} fontFamily="system-ui, sans-serif">{txt}</text>
        {/* شرارات */}
        {[0, 1, 2, 3].map((i) => {
          const a = (-150 + i * 40) * (Math.PI / 180);
          const d0 = 96 + (1 - s) * -30;
          return <line key={i} x1={Math.cos(a) * d0} y1={Math.sin(a) * d0 + 10} x2={Math.cos(a) * (d0 + 30)} y2={Math.sin(a) * (d0 + 30) + 10} stroke={C.accent} strokeWidth={7} strokeLinecap="round" opacity={Math.max(0, 1 - Math.abs(frame - react - 8) / 18)} />;
        })}
      </g>
    );
  })();

  return (
    <SceneShell {...props} themeId="paper" motif={false} background={C.bg} durationInFrames={durationInFrames}>
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <g transform={`translate(${focus.x} ${focus.y}) scale(${zoom}) translate(${-focus.x} ${-focus.y})`}>
          {/* الخلفية: أشكال باستيل ناعمة */}
          <rect x={-400} y={-400} width={2800} height={1900} fill={C.bg} />
          <path d="M-300 -700 L900 -700 L560 420 L-100 640 Z" fill={C.blob1} opacity={0.75} />
          <path d="M1100 -700 L2100 -700 L2100 520 L1400 380 Z" fill={C.blob2} opacity={0.8} />
          <path d="M-100 720 L640 560 L1100 1300 L-100 1300 Z" fill={C.blob2} opacity={0.6} />
          <path d="M1240 640 L2100 420 L2100 1300 L1500 1300 Z" fill={C.blob3} opacity={0.8} />
          <path d="M640 -700 L1300 -700 L1140 260 L780 300 Z" fill={C.blob3} opacity={0.55} />

          {/* النافذة على المدينة */}
          <g>
            <rect {...S} x={250} y={150} width={330} height={360} rx={10} fill={C.white} />
            <rect x={272} y={172} width={286} height={316} fill={C.glass} />
            <path fill={C.city} d="M272 488 V390 H310 V340 H350 V410 H380 V300 H430 V380 H460 V330 H500 V400 H530 V360 H558 V488 Z" />
            {[[318, 352], [318, 372], [395, 320], [395, 345], [408, 320], [408, 345], [475, 350]].map(([x, y], i) => <rect key={i} x={x} y={y} width={8} height={10} fill={C.white} opacity={0.8} />)}
            <line {...S} x1={415} y1={172} x2={415} y2={488} strokeWidth={8} stroke={C.white} />
            <rect {...S} x={236} y={506} width={358} height={22} rx={6} fill={C.white} />
            {/* نبتة عند النافذة */}
            <path {...S} fill={C.leaf} d="M300 506 Q270 450 310 420 Q322 470 300 506 Z" />
            <path {...S} fill={C.leafDark} d="M330 506 Q350 440 392 432 Q378 488 330 506 Z" />
          </g>

          {/* الرف والأيقونات */}
          <g>
            {[["bulb", 1290], ["gear", 1370], ["chat", 1450]].map(([k, x]) => (
              <g key={k as string} transform={`translate(${x} 200)`}>
                <rect {...S} strokeWidth={4} x={-30} y={-30} width={60} height={60} rx={12} fill={C.glass} />
                {k === "bulb" ? <path {...S} strokeWidth={4} fill={C.accent} d="M0 -18 Q16 -18 16 -2 Q16 8 7 12 V18 H-7 V12 Q-16 8 -16 -2 Q-16 -18 0 -18 Z" /> : null}
                {k === "gear" ? <><circle {...S} strokeWidth={4} r={14} fill="#B9C6D6" /><circle r={5} fill={C.line} /></> : null}
                {k === "chat" ? <path {...S} strokeWidth={4} fill={C.white} d="M-18 -14 H18 V8 H-4 L-12 16 V8 H-18 Z" /> : null}
              </g>
            ))}
            <rect {...S} x={1250} y={236} width={260} height={14} rx={4} fill={C.white} />
            {[["#7FB7D9", 1282, 70], ["#F2C14E", 1306, 62], ["#8CC79A", 1328, 74], ["#E58F6A", 1352, 66]].map(([c, x, h], i) => (
              <rect key={i} {...S} strokeWidth={4} x={x as number} y={340 - (h as number)} width={22} height={h as number} rx={3} fill={c as string} />
            ))}
            <rect {...S} strokeWidth={4} x={1400} y={318} width={80} height={22} rx={3} fill="#F7E3A8" transform="rotate(-4 1440 330)" />
            <rect {...S} x={1250} y={340} width={260} height={14} rx={4} fill={C.white} />
          </g>

          {/* الكرسي (خلف الشخصية) */}
          <rect {...S} x={772} y={470} width={256} height={250} rx={36} fill={C.chair} />
          <rect {...S} x={892} y={760} width={16} height={120} fill={C.chair} />
          <path {...S} fill={C.chair} d="M820 900 L980 900 L990 916 L810 916 Z" />
          <circle {...S} cx={820} cy={926} r={12} fill={C.line} />
          <circle {...S} cx={980} cy={926} r={12} fill={C.line} />

          {/* الساقان تحت المكتب */}
          <path {...S} fill={C.pants} d="M812 660 H988 V760 Q988 790 958 790 H842 Q812 790 812 760 Z" />
          <rect {...S} x={830} y={770} width={68} height={150} rx={20} fill={C.pants} />
          <rect {...S} x={902} y={770} width={68} height={150} rx={20} fill={C.pants} />
          <path {...S} fill={C.line} d="M816 912 H896 Q904 930 890 936 H822 Q808 930 816 912 Z" />
          <path {...S} fill={C.line} d="M904 912 H984 Q992 930 978 936 H910 Q896 930 904 912 Z" />

          {/* الجسم */}
          <g transform={`translate(0 ${jolt}) translate(900 650) scale(1 ${1 + breathe}) translate(-900 -650)`}>
            <path {...S} fill={shirt} d="M788 660 L790 532 Q792 478 850 466 L950 466 Q1008 478 1010 532 L1012 660 Z" />
            <path {...S} fill={C.white} d="M866 468 L900 548 L934 468 Z" />
            <path {...S} fill="none" d="M866 468 L852 520 M934 468 L948 520" opacity={0.6} />
            {/* الرقبة والرأس (بلا ملامح) */}
            <g transform={`translate(0 ${headLift}) rotate(${headTilt} 900 450)`}>
              <rect {...S} x={880} y={418} width={40} height={54} fill={C.skin} />
              <ellipse {...S} cx={842} cy={384} rx={11} ry={16} fill={C.skin} />
              <ellipse {...S} cx={958} cy={384} rx={11} ry={16} fill={C.skin} />
              <ellipse {...S} cx={900} cy={378} rx={58} ry={68} fill={C.skin} />
              <path d="M858 400 Q900 440 942 400 Q936 430 900 444 Q864 430 858 400 Z" fill={C.skinShade} opacity={0.45} />
              <path {...S} fill={C.hair} d="M842 380 Q834 304 900 300 Q968 304 958 380 Q956 344 930 334 Q900 350 868 336 Q846 346 842 380 Z" />
            </g>

            {/* الذراع الماسكة للهاتف */}
            <g transform={`translate(0 ${phoneLift})`}>
              <path stroke={C.line} strokeWidth={lw * 2 + 44} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M1000 500 Q1046 590 1012 600 L986 580" />
              <path stroke={shirt} strokeWidth={44} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M1000 500 Q1046 590 1012 600 L986 580" />
              {/* الهاتف */}
              <g transform="rotate(-14 984 530)">
                <rect {...S} x={952} y={470} width={64} height={116} rx={11} fill={C.phone} />
                <clipPath id="dm-screen"><rect x={959} y={480} width={50} height={96} rx={6} /></clipPath>
                <rect x={959} y={480} width={50} height={96} rx={6} fill={screen === "dark" ? "#3B4660" : C.screen} />
                <g clipPath="url(#dm-screen)">
                  {Array.from({ length: 5 }, (_, i) => (
                    <g key={i} transform={`translate(0 ${i * 30 - feedShift + 10})`}>
                      <rect x={964} y={474} width={40} height={16} rx={3} fill={C.white} opacity={0.9} />
                      <rect x={964} y={493} width={26} height={4} rx={2} fill={C.white} opacity={0.6} />
                    </g>
                  ))}
                  {hasReaction ? <rect x={959} y={480} width={50} height={96} fill={C.accent} opacity={Math.max(0, 0.7 - Math.abs(frame - react) / 10)} /> : null}
                </g>
              </g>
              <ellipse {...S} cx={992} cy={584} rx={22} ry={18} fill={C.skin} />
            </g>

            {/* الذراع الأخرى: الإصبع يمرّر على الشاشة */}
            <path stroke={C.line} strokeWidth={lw * 2 + 44} strokeLinecap="round" strokeLinejoin="round" fill="none" d={`M800 500 Q780 610 860 618 L${940} ${560 - swipe + phoneLift * 0.6}`} />
            <path stroke={shirt} strokeWidth={44} strokeLinecap="round" strokeLinejoin="round" fill="none" d={`M800 500 Q780 610 860 618 L${940} ${560 - swipe + phoneLift * 0.6}`} />
            <g transform={`translate(0 ${-swipe + phoneLift * 0.6})`}>
              <circle {...S} cx={948} cy={556} r={19} fill={C.skin} />
              <path {...S} strokeWidth={4} fill={C.skin} d="M956 544 L976 530 Q984 528 982 538 L964 556 Z" />
            </g>
          </g>

          {/* المكتب (أمام الشخصية) */}
          <rect {...S} x={560} y={640} width={780} height={28} rx={6} fill={C.deskTop} />
          <rect {...S} x={560} y={666} width={780} height={22} fill={C.wood} />
          <rect {...S} x={592} y={686} width={28} height={330} fill={C.wood} />
          <rect {...S} x={1280} y={686} width={28} height={330} fill={C.wood} />
          <line {...S} x1={606} y1={760} x2={1294} y2={760} stroke={C.woodDark} strokeWidth={10} opacity={0.6} />
          {/* لابتوب مغلق وكوب ونبتة */}
          <rect {...S} x={720} y={622} width={250} height={20} rx={6} fill="#C3CAD4" />
          <g>
            <path {...S} fill={C.mug} d="M1100 586 H1152 V632 Q1152 642 1142 642 H1110 Q1100 642 1100 632 Z" />
            <path {...S} fill="none" d="M1152 598 Q1176 600 1172 618 Q1168 630 1152 628" />
            <path stroke={C.line} strokeWidth={3} fill="none" opacity={0.35} strokeLinecap="round" d={`M1116 570 q 8 -${10 + Math.sin(t * 3) * 3} 0 -22 M1134 568 q 8 -${12 + Math.cos(t * 3) * 3} 0 -24`} />
          </g>
          <g>
            <path {...S} fill={C.pot} d="M1206 600 H1266 L1258 642 H1214 Z" />
            <g transform={`rotate(${Math.sin(t * 1.4) * 2} 1236 600)`}>
              <path {...S} fill={C.leaf} d="M1236 600 Q1196 560 1210 520 Q1240 550 1236 600 Z" />
              <path {...S} fill={C.leafDark} d="M1236 600 Q1280 556 1274 516 Q1236 548 1236 600 Z" />
              <path {...S} fill={C.leaf} d="M1236 600 Q1232 540 1240 500 Q1256 540 1236 600 Z" />
            </g>
          </g>

          {/* الأرضية */}
          <path d="M-400 1016 H2400" stroke={C.line} strokeWidth={4} opacity={0.15} />

          {bubble}
        </g>
      </svg>
    </SceneShell>
  );
};

export const deskMomentSample: Omit<DeskMomentProps, "themeId" | "orientation"> = {
  eyebrow: "",
  reaction: "!",
  reactAt: "0.6",
  push: "on",
  screen: "feed",
  outfit: "blue",
  narration: "يمسك هاتفه ليتفقد شيئًا سريعًا… ثم يرى خبرًا يصدّقه فورًا لأنه يوافق رأيه.",
  captions: false,
};
export const deskMomentSampleEn: Omit<DeskMomentProps, "themeId" | "orientation"> = { ...deskMomentSample, narration: "He picks up his phone for a quick look… then sees a headline he believes at once." };
export const deskMomentSeconds = 8;
