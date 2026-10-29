import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../../../brand/themes";
import { useSize, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { useBrandFonts } from "../useBrandFonts";
import { CaptionBar } from "./CaptionBar";
import { useLang } from "../../i18n/context";
import { Element } from "../../../brand/elements/Element";
import { hasElement } from "../../../brand/elements/registry";
import { enter, exit, fade } from "./motion";
import { estimateTimings } from "./timing";
import { ChannelLogo } from "../../channel/context";
import type { SceneBase } from "./types";

/** خلفية الثيم: لون الخلفية مع زخرفته الخفيفة (لا تنافس النص). */
const Motif: React.FC<{ t: Theme; w: number; h: number; frame: number; rtl: boolean }> = ({ t, w, h, frame, rtl }) => {
  const c = t.colors;
  const reveal = fade(frame, 0, 24);
  switch (t.motif) {
    case "ink-lines": {
      const gap = 64;
      const lines = Math.ceil(h / gap);
      return (
        <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: lines }, (_, i) => (
            <line key={i} x1={rtl ? w * (1 - reveal) : 0} x2={rtl ? w : w * reveal} y1={(i + 1) * gap} y2={(i + 1) * gap} stroke={c.ink} strokeOpacity={0.05} strokeWidth={2} />
          ))}
          <line x1={rtl ? w - 120 : 120} x2={rtl ? w - 120 : 120} y1={0} y2={h * reveal} stroke={c.primary} strokeOpacity={0.18} strokeWidth={3} />
        </svg>
      );
    }
    case "house-circles":
      return (
        <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
          <circle cx={w * 0.08} cy={h * 0.12} r={Math.min(w, h) * 0.22 * reveal} fill={c.highlight} opacity={0.35} />
          <circle cx={w * 0.94} cy={h * 0.9} r={Math.min(w, h) * 0.3 * reveal} fill={c.secondary} opacity={0.18} />
        </svg>
      );
    case "stars":
      return (
        <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: 40 }, (_, i) => {
            const x = ((i * 7919) % 1000) / 1000;
            const y = ((i * 104729) % 1000) / 1000;
            const tw = 0.35 + 0.35 * Math.sin((frame + i * 13) / 18);
            return <circle key={i} cx={x * w} cy={y * h * 0.8} r={i % 5 === 0 ? 3 : 1.8} fill={c.ink} opacity={tw * reveal} />;
          })}
        </svg>
      );
    case "arches": {
      const n = 5;
      const aw = w / n;
      return (
        <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: n }, (_, i) => (
            <path
              key={i}
              d={`M${i * aw + aw * 0.1} ${h} V${h * 0.55} Q${i * aw + aw * 0.5} ${h * 0.3} ${i * aw + aw * 0.9} ${h * 0.55} V${h}`}
              fill="none"
              stroke={c.primary}
              strokeOpacity={0.12 * reveal}
              strokeWidth={4}
            />
          ))}
        </svg>
      );
    }
  }
};

type ShellProps = SceneBase & { children: React.ReactNode; durationInFrames: number };

/**
 * غلاف كل مشهد: الخلفية، عنوان الفصل، شريط الترجمة، والخروج الموحّد.
 * المقاسات: أفقي 1920×1080، عمودي 1080×1920 (منطقة آمنة للشورت تتجنب أسفل 22% وأعلى 12%).
 */
export const SceneShell: React.FC<ShellProps> = ({ themeId, orientation, eyebrow, narration, narrationTimings, captions = true, backdrop, motif = true, watermark = false, children, durationInFrames }) => {
  useBrandFonts();
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = useTheme(themeId);
  const lang = useLang();
  const portrait = orientation === "portrait";
  const eyebrowSize = useSize("eyebrow", orientation);
  const out = exit(frame, durationInFrames, 8);
  const eyebrowIn = enter(frame, 4);
  const timings = narration ? (narrationTimings ?? estimateTimings(narration, 6, durationInFrames - 12)) : [];

  return (
    <AbsoluteFill style={{ backgroundColor: t.colors.bg, direction: lang.dir, fontFamily: fontFamilies.body, color: t.colors.ink }}>
      {backdrop && hasElement(backdrop) ? (
        <div style={{ position: "absolute", inset: 0, opacity: fade(frame, 0, 14) }}>
          <Element id={backdrop} theme={t} width={width} height={height} />
        </div>
      ) : motif ? (
        <Motif t={t} w={width} h={height} frame={frame} rtl={lang.dir === "rtl"} />
      ) : null}
      <AbsoluteFill style={{ opacity: out }}>
        {eyebrow ? (
          <div
            style={{
              position: "absolute",
              top: portrait ? 250 : 64,
              insetInlineStart: portrait ? 72 : 96,
              fontSize: eyebrowSize,
              fontWeight: 600,
              color: t.colors.inkSoft,
              border: `2px solid ${t.colors.primary}`,
              borderRadius: 999,
              padding: portrait ? "8px 26px" : "6px 22px",
              opacity: eyebrowIn,
              transform: `translateY(${(1 - eyebrowIn) * -12}px)`,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        {children}
        {watermark ? (
          <div style={{ position: "absolute", top: portrait ? 244 : 56, insetInlineEnd: portrait ? 64 : 72, opacity: 0.88 * fade(frame, 6, 16) }}>
            <ChannelLogo theme={t} size={portrait ? 84 : 72} tile />
          </div>
        ) : null}
      </AbsoluteFill>
      {captions && timings.length ? <CaptionBar theme={t} timings={timings} portrait={portrait} /> : null}
    </AbsoluteFill>
  );
};
