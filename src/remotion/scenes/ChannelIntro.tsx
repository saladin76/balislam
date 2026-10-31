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

/**
 * الافتتاحية السينمائية: أشرطة سينما، ضوء دافئ يرتعش، غبار في شعاع الضوء،
 * الشعار يتوهج بالذهبي ويمر عليه بريق، والاسم بحروف ذهبية يتسع تباعدها ثم يستقر.
 */
type CineLook = { bg: string; glow: string; gold: string; gold2: string; ink: string; font: string; ornament: "frame" | "line" };
const CinematicIntro: React.FC<P & { look: CineLook }> = ({ frame, fps, portrait, look }) => {
  const ch = useChannel();
  const t = useTheme("warm");
  const W = portrait ? 1080 : 1920;
  const H = portrait ? 1920 : 1080;
  const push = 1 + interpolate(frame, [0, INTRO_FRAMES], [0, 0.06], clamp);
  const flicker = 0.85 + 0.15 * Math.sin(frame * 0.9) * Math.sin(frame * 0.37);
  const bars = interpolate(frame, [0, 12], [0, 1], clamp);
  const logoIn = spring({ frame: frame - 8, fps, config: { damping: 18, stiffness: 60 } });
  const sheen = interpolate(frame, [26, 46], [-1, 2], clamp);
  const nameIn = interpolate(frame, [30, 52], [0, 1], clamp);
  const spacing = interpolate(frame, [30, 60], [18, 2], clamp);
  const draw = interpolate(frame, [6, 34], [0, 1], clamp);
  const logoSize = portrait ? 300 : 250;
  return (
    <AbsoluteFill style={{ background: look.bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, ${look.glow} 0%, transparent 55%)`, opacity: flicker }} />
        {/* شعاع ضوء من الأعلى وغبار يسبح فيه */}
        <div style={{ position: "absolute", left: W / 2 - 260, top: -100, width: 520, height: H * 0.75, background: `linear-gradient(to bottom, ${look.gold}22, transparent)`, clipPath: "polygon(38% 0, 62% 0, 100% 100%, 0 100%)", opacity: 0.7 * flicker }} />
        {Array.from({ length: 46 }, (_, i) => {
          const x = W / 2 - 240 + ((i * 97) % 480);
          const y = ((i * 131 + frame * (0.6 + (i % 5) * 0.25)) % (H * 0.8));
          return <div key={i} style={{ position: "absolute", left: x + Math.sin(frame / 14 + i) * 12, top: y, width: i % 4 ? 2 : 3, height: i % 4 ? 2 : 3, borderRadius: 2, background: look.gold2, opacity: 0.18 + 0.25 * Math.abs(Math.sin(i + frame / 9)) }} />;
        })}
        {/* زخرفة */}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          {look.ornament === "frame"
            ? [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sy], i) => {
                const cx = W / 2 + sx! * (portrait ? 420 : 760);
                const cy = H / 2 + sy! * (portrait ? 760 : 400);
                return <path key={i} d={`M${cx} ${cy + -sy! * 120} V${cy} H${cx + -sx! * 120}`} stroke={look.gold} strokeWidth={3} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} opacity={0.75} />;
              })
            : null}
        </svg>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: portrait ? 44 : 30 }}>
          <div style={{ position: "relative", width: logoSize, height: logoSize, opacity: logoIn, transform: `scale(${0.85 + 0.15 * logoIn})`, filter: `drop-shadow(0 0 ${30 * logoIn}px ${look.gold}88)` }}>
            <ChannelLogo theme={t} size={logoSize} />
            <div style={{ position: "absolute", inset: 0, borderRadius: logoSize * 0.23, overflow: "hidden", mixBlendMode: "screen" }}>
              <div style={{ position: "absolute", top: 0, bottom: 0, width: "45%", left: `${sheen * 100}%`, background: "linear-gradient(100deg, transparent, rgba(255,240,200,.55), transparent)" }} />
            </div>
          </div>
          <div style={{ opacity: nameIn, textAlign: "center" }}>
            <div style={{ fontFamily: look.font, fontWeight: 700, fontSize: portrait ? 132 : 118, letterSpacing: spacing, background: `linear-gradient(180deg, ${look.gold2} 0%, ${look.gold} 60%, #8A6326 100%)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", lineHeight: 1.3, filter: `drop-shadow(0 4px 18px ${look.bg})` }}>{ch.name}</div>
            <svg width={portrait ? 520 : 460} height={24} viewBox="0 0 460 24" style={{ display: "block", margin: "6px auto 0" }}>
              <path d="M10 12 H200 M260 12 H450" stroke={look.gold} strokeWidth={2} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - nameIn} />
              <path d={`M230 3 L239 12 L230 21 L221 12 Z`} fill={look.gold} opacity={nameIn} />
            </svg>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${portrait ? 260 : 320}px ${portrait ? 80 : 120}px ${look.bg}` }} />
      {/* أشرطة السينما */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: H * 0.09 * bars, background: "#000" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: H * 0.09 * bars, background: "#000" }} />
    </AbsoluteFill>
  );
};

/** دفاتر الزمن: أسود دافئ، ضوء شمعة، ذهب وخط أميري، وزوايا إطار */
const ArchiveIntro: React.FC<P> = (p) => <CinematicIntro {...p} look={{ bg: "#0C0907", glow: "#3A2614", gold: "#D4A24C", gold2: "#F3D99A", ink: "#F1E3C6", font: "'Amiri', serif", ornament: "frame" }} />;

/** زبدة الكتب: أزرق ليلي، ضوء قراءة، كهرماني وكريمي */
const BookIntro: React.FC<P> = (p) => <CinematicIntro {...p} look={{ bg: "#071116", glow: "#16343E", gold: "#F2C46D", gold2: "#FBEFD2", ink: "#F3EEE4", font: fontFamilies.heading, ornament: "line" }} />;
