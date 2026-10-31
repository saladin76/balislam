import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { ChannelLogo, useChannel } from "../../channel/context";
import type { ChannelInfo } from "../../channel/types";
import type { Plan } from "../../plan/types";
import type { Orientation } from "./types";

/**
 * افتتاحية القناة (بصمتها الثابتة): ثانيتان ونصف في أول الحلقة الطويلة فقط، لا في الشورت.
 * ink: باء القناة وخط حبر يُرسم (بالإسلام) · archive: ختم شمع على رَقّ قديم (دفاتر الزمن) · book: كتاب يُفتح ويخرج منه الاسم (زبدة الكتب)
 */
export const INTRO_FRAMES = 75;
export type IntroKind = "ink" | "archive" | "book";

export const introKindFor = (channel?: ChannelInfo, plan?: Pick<Plan, "intro">, chapter?: number): IntroKind | null => {
  if (chapter || plan?.intro === false) return null;
  const k = channel?.brand?.intro;
  return k && k !== "none" ? k : null;
};
export const introFramesFor = (channel?: ChannelInfo, plan?: Pick<Plan, "intro">, chapter?: number) => (introKindFor(channel, plan, chapter) ? INTRO_FRAMES : 0);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const ChannelIntro: React.FC<{ kind: IntroKind; orientation: Orientation }> = ({ kind, orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = interpolate(frame, [INTRO_FRAMES - 10, INTRO_FRAMES], [1, 0], clamp);
  const portrait = orientation === "portrait";
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {kind === "ink" ? <InkIntro frame={frame} fps={fps} portrait={portrait} /> : kind === "archive" ? <ArchiveIntro frame={frame} fps={fps} portrait={portrait} /> : <BookIntro frame={frame} fps={fps} portrait={portrait} />}
    </AbsoluteFill>
  );
};

type P = { frame: number; fps: number; portrait: boolean };

/** بالإسلام: الشعار يقفز، خط حبر يُرسم تحته، والاسم يظهر حرفًا حرفًا */
const InkIntro: React.FC<P> = ({ frame, fps, portrait }) => {
  const t = useTheme("warm");
  const c = t.colors;
  const name = useChannel().name;
  const pop = spring({ frame: frame - 2, fps, config: { damping: 11, stiffness: 140 } });
  const line = interpolate(frame, [14, 38], [0, 1], clamp);
  const letters = [...name];
  const shown = Math.floor(interpolate(frame, [22, 46], [0, letters.length], clamp));
  return (
    <AbsoluteFill style={{ background: c.bg, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 26 }}>
      {[0, 1, 2].map((i) => {
        const r = interpolate(frame, [4 + i * 6, 40 + i * 6], [0, 1], clamp);
        return <div key={i} style={{ position: "absolute", width: 300 + r * 900, height: 300 + r * 900, borderRadius: "50%", border: `3px solid ${c.primary}`, opacity: (1 - r) * 0.35 }} />;
      })}
      <div style={{ transform: `scale(${pop}) rotate(${(1 - pop) * -12}deg)` }}>
        <ChannelLogo theme={t} size={portrait ? 230 : 200} />
      </div>
      <div style={{ fontFamily: fontFamilies.wordmark, fontWeight: 800, fontSize: portrait ? 110 : 96, color: c.ink, height: "1.3em", direction: "rtl" }}>
        {letters.map((ch, i) => <span key={i} style={{ opacity: i < shown ? 1 : 0 }}>{ch}</span>)}
      </div>
      <svg width={portrait ? 520 : 460} height={30} viewBox="0 0 460 30">
        <path d="M10 18 Q120 4 230 16 T450 12" stroke={c.primary} strokeWidth={8} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - line} />
      </svg>
    </AbsoluteFill>
  );
};

/** دفاتر الزمن: رَقّ قديم بإطار، ختم شمع أحمر يُطبع، والاسم بالحبر البني وزخرفة */
const ArchiveIntro: React.FC<P> = ({ frame, fps, portrait }) => {
  const t = useTheme("warm");
  const c = t.colors;
  const ch = useChannel();
  const letter = ch.logo?.type === "letter" ? ch.logo.letter : [...ch.name][0];
  const frameDraw = interpolate(frame, [0, 26], [0, 1], clamp);
  const stamp = spring({ frame: frame - 18, fps, config: { damping: 9, stiffness: 160 } });
  const stampScale = interpolate(stamp, [0, 1], [2.2, 1]);
  const shake = frame > 22 && frame < 30 ? Math.sin(frame * 3) * (30 - frame) * 0.8 : 0;
  const nameIn = interpolate(frame, [30, 48], [0, 1], clamp);
  const W = portrait ? 1080 : 1920;
  const H = portrait ? 1920 : 1080;
  return (
    <AbsoluteFill style={{ background: c.bg, transform: `translate(${shake}px, ${shake * 0.6}px)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, transparent 45%, ${c.ink}55 100%)` }} />
      {Array.from({ length: 40 }, (_, i) => <div key={i} style={{ position: "absolute", left: (i * 137) % W, top: ((i * 89 + frame * (1 + (i % 3))) % H), width: 3, height: 3, borderRadius: 2, background: c.inkSoft, opacity: 0.25 }} />)}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <rect x={60} y={60} width={W - 120} height={H - 120} fill="none" stroke={c.ink} strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - frameDraw} opacity={0.6} />
        <rect x={80} y={80} width={W - 160} height={H - 160} fill="none" stroke={c.secondary} strokeWidth={2} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - frameDraw} />
      </svg>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30 }}>
        <div style={{ transform: `scale(${stampScale})`, opacity: stamp > 0.01 ? 1 : 0 }}>
          <svg width={220} height={220} viewBox="0 0 220 220">
            <path d="M110 8 C150 10 168 30 190 46 C212 70 214 100 210 128 C204 162 182 190 148 206 C116 218 82 214 56 198 C26 180 8 150 10 112 C12 70 34 38 64 20 C78 12 94 8 110 8 Z" fill={c.primary} />
            <circle cx={110} cy={112} r={72} fill="none" stroke={c.bg} strokeWidth={4} opacity={0.5} />
            <text x={110} y={148} textAnchor="middle" fontSize={110} fontWeight={800} fill={c.bg} fontFamily={fontFamilies.heading}>{letter}</text>
          </svg>
        </div>
        <div style={{ opacity: nameIn, transform: `translateY(${(1 - nameIn) * 20}px)`, textAlign: "center" }}>
          <div style={{ fontFamily: fontFamilies.heading, fontWeight: 800, fontSize: portrait ? 120 : 110, color: c.ink, letterSpacing: 2 }}>{ch.name}</div>
          <div style={{ fontFamily: fontFamilies.heading, fontSize: portrait ? 40 : 36, color: c.primary, marginTop: 4 }}>— ✦ —</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** زبدة الكتب: كتاب يُفتح، ضوء يخرج من صفحاته، والاسم يصعد منه */
const BookIntro: React.FC<P> = ({ frame, fps, portrait }) => {
  const t = useTheme("night");
  const c = t.colors;
  const ch = useChannel();
  const open = spring({ frame: frame - 6, fps, config: { damping: 16, stiffness: 70 } });
  const glow = interpolate(frame, [16, 34], [0, 1], clamp);
  const rise = spring({ frame: frame - 26, fps, config: { damping: 13 } });
  const bw = portrait ? 260 : 240;
  const bh = bw * 1.35;
  return (
    <AbsoluteFill style={{ background: c.bg, alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 62%, ${c.primary}${Math.round(glow * 80).toString(16).padStart(2, "0")} 0%, transparent 45%)` }} />
      {Array.from({ length: 9 }, (_, i) => {
        const a = -70 + i * 17.5;
        return <div key={i} style={{ position: "absolute", left: "50%", top: "62%", width: 8, height: 520 * glow, background: `linear-gradient(to top, ${c.primary}aa, transparent)`, transformOrigin: "50% 100%", transform: `translate(-50%, -100%) rotate(${a}deg)`, opacity: 0.35 * glow }} />;
      })}
      <div style={{ position: "absolute", top: portrait ? "30%" : "16%", textAlign: "center", opacity: rise, transform: `translateY(${(1 - rise) * 140}px) scale(${0.8 + 0.2 * rise})` }}>
        <div style={{ fontFamily: fontFamilies.wordmark, fontWeight: 800, fontSize: portrait ? 130 : 120, color: c.ink }}>{ch.name}</div>
      </div>
      <div style={{ position: "absolute", top: portrait ? "56%" : "54%", width: bw * 2, height: bh, perspective: 1600, display: "flex", justifyContent: "center" }}>
        {/* الصفحات */}
        <div style={{ position: "absolute", left: bw * 0.04, width: bw * 0.96, height: bh * 0.96, top: bh * 0.02, background: "#FBF7EE", borderRadius: "10px 2px 2px 10px", boxShadow: "inset -10px 0 20px rgba(0,0,0,.12)" }} />
        <div style={{ position: "absolute", left: bw, width: bw * 0.96, height: bh * 0.96, top: bh * 0.02, background: "#FBF7EE", borderRadius: "2px 10px 10px 2px", boxShadow: "inset 10px 0 20px rgba(0,0,0,.12)" }}>
          {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ height: 8, margin: `${i ? 18 : 40}px 30px 0`, background: c.bg, opacity: 0.15 * glow, borderRadius: 4 }} />)}
        </div>
        {/* الغلاف ينقلب */}
        <div style={{ position: "absolute", left: bw, width: bw, height: bh, transformOrigin: "0 50%", transform: `rotateY(${-180 * open}deg)`, transformStyle: "preserve-3d" }}>
          <div style={{ position: "absolute", inset: 0, background: c.secondary, borderRadius: "4px 14px 14px 4px", backfaceVisibility: "hidden", display: "grid", placeItems: "center", border: `6px solid ${c.primary}` }}>
            <div style={{ fontFamily: fontFamilies.wordmark, fontSize: 90, fontWeight: 800, color: c.primary }}>{ch.logo?.type === "letter" ? ch.logo.letter : [...ch.name][0]}</div>
          </div>
          <div style={{ position: "absolute", inset: 0, background: c.secondary, borderRadius: "14px 4px 4px 14px", transform: "rotateY(180deg)", backfaceVisibility: "hidden" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
