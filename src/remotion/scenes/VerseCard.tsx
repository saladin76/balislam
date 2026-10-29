import React from "react";
import { interpolate, useVideoConfig } from "remotion";
import { useSize, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { SceneShell } from "./SceneShell";
import { T } from "../../i18n/context";
import { enter, fade, useSceneFrame } from "./motion";
import type { VerseCardProps } from "./types";

/** نجمة ثمانية صغيرة للزخرفة (مربعان متراكبان). */
const Star8: React.FC<{ size: number; fill: string; stroke?: string; sw?: number }> = ({ size, fill, stroke = "none", sw = 0 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <rect x={8} y={8} width={24} height={24} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
    <rect x={8} y={8} width={24} height={24} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" transform="rotate(45 20 20)" />
  </svg>
);

/**
 * «بطاقة الآية»: لحظة سكون. البطاقة تنفتح، ثم يظهر النص كاملًا بهدوء (لا كلمة كلمة،
 * احترامًا لتلاوة الآية)، ثم المرجع. لا ترجمة سطرية تحت الآية؛ الشريط السفلي يختفي.
 * النص يُعرض كما ورد من المصدر بلا أي تعديل.
 */
export const VerseCard: React.FC<VerseCardProps> = (props) => {
  const { themeId, orientation, text, reference, reciter, sourceNote } = props;
  const frame = useSceneFrame();
  const verseSize = useSize("verse", orientation);
  const refSize = useSize("reference", orientation);
  const { durationInFrames } = useVideoConfig();
  const t = useTheme(themeId);
  const c = t.colors;
  const portrait = orientation === "portrait";
  const line = t.character.style === "line";

  const card = enter(frame, 0, 30, 90);
  const textIn = fade(frame, 14, 30);
  const blur = interpolate(textIn, [0, 1], [8, 0]);
  const refIn = fade(frame, 40, 16);
  const ornament = enter(frame, 8, 30, 120);

  return (
    <SceneShell {...props} captions={false} durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: portrait ? "0 60px 300px" : "0 200px 20px" }}>
        <div
          style={{
            position: "relative",
            background: c.surface,
            border: line ? `3px solid ${c.ink}` : "none",
            boxShadow: line ? `10px 10px 0 ${c.secondary}` : `0 24px 60px rgba(0,0,0,${themeId === "night" ? 0.35 : 0.1})`,
            borderRadius: 28,
            padding: portrait ? "110px 64px 80px" : "96px 120px 64px",
            width: "100%",
            maxWidth: portrait ? 960 : 1440,
            opacity: card,
            transform: `scale(${0.94 + 0.06 * card})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: portrait ? 44 : 36,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: portrait ? -38 : -34,
              left: "50%",
              transform: `translateX(-50%) scale(${ornament}) rotate(${(1 - ornament) * -45}deg)`,
              background: c.bg,
              borderRadius: 999,
              padding: 8,
            }}
          >
            <Star8 size={portrait ? 64 : 56} fill={line ? c.secondary : c.primary} stroke={line ? c.ink : "none"} sw={line ? 2.5 : 0} />
          </div>
          <div style={{ position: "absolute", inset: 18, border: `2px solid ${line ? c.ink : c.primary}`, borderRadius: 18, opacity: 0.18 * card, pointerEvents: "none" }} />
          <div
            style={{
              fontFamily: fontFamilies.scripture,
              fontSize: verseSize,
              lineHeight: 1.9,
              textAlign: "center",
              color: c.ink,
              opacity: textIn,
              filter: `blur(${blur}px)`,
              textWrap: "balance",
            }}
          >
            <span style={{ color: line ? c.primary : c.primary }}>﴿</span> {text} <span style={{ color: c.primary }}>﴾</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: refIn, transform: `translateY(${(1 - refIn) * 10}px)` }}>
            <div style={{ width: 56, height: 2, background: c.inkSoft, opacity: 0.4 }} />
            <div style={{ fontFamily: fontFamilies.heading, fontWeight: 600, fontSize: refSize, color: c.inkSoft }}>{reference}</div>
            <div style={{ width: 56, height: 2, background: c.inkSoft, opacity: 0.4 }} />
          </div>
          {reciter || sourceNote ? (
            <div style={{ fontSize: portrait ? 26 : 22, color: c.inkSoft, opacity: refIn * 0.8, marginTop: -16 }}>
              {reciter ? `$<T k="recitedBy" /> ${reciter}` : sourceNote}
            </div>
          ) : null}
        </div>
      </div>
    </SceneShell>
  );
};
