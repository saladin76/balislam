import React from "react";
import { useCurrentFrame } from "remotion";
import type { Theme } from "../../../brand/themes";
import { fontFamilies } from "../../../brand/fonts";
import type { WordTiming } from "./timing";
import { useMotionSettings, useSize } from "../../../brand/identity/index";


/**
 * شريط الترجمة: يعرض الجملة الجارية على دفعات قصيرة، والكلمة المنطوقة الآن مميزة.
 * في الشورت يرتفع فوق منطقة أزرار المنصات.
 */
export const CaptionBar: React.FC<{ theme: Theme; timings: WordTiming[]; portrait: boolean; variant?: "pill" | "cinema" | "paper" | "dusk" }> = ({ theme, timings, portrait, variant = "pill" }) => {
  // paper/dusk (دفاتر الزمن): ترجمة هادئة لحلقة وثائقية؛ حبر على شريط رَقّ شفيف، والكلمة المنطوقة بلون أعمق وخط رملي تحتها
  if (variant === "paper" || variant === "dusk") return <QuietCaption timings={timings} portrait={portrait} dusk={variant === "dusk"} />;
  const cinema = variant === "cinema";
  const frame = useCurrentFrame();
  const CHUNK = Math.max(1, Math.round(useMotionSettings().captionWords));
  const fontSize = useSize("caption", portrait ? "portrait" : "landscape");
  const first = timings[0];
  const last = timings[timings.length - 1];
  if (!first || !last || frame < first.start || frame > last.end + 6) return null;
  let idx = timings.findIndex((w) => frame >= w.start && frame < w.end);
  if (idx < 0) idx = frame >= last.end ? timings.length - 1 : 0;
  const chunkStart = Math.floor(idx / CHUNK) * CHUNK;
  const chunk = timings.slice(chunkStart, chunkStart + CHUNK);
  const c = theme.colors;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: portrait ? 470 : cinema ? 38 : 64,
        display: "flex",
        justifyContent: "center",
        padding: "0 64px",
      }}
    >
      <div
        style={{
          // السينمائي: نص أبيض بظل داخل شريط السينما السفلي، والكلمة المنطوقة ذهبية
          background: cinema ? "transparent" : c.captionBg,
          color: cinema ? "#F4EEE2" : c.captionInk,
          textShadow: cinema ? "0 2px 6px rgba(0,0,0,0.95), 0 0 18px rgba(0,0,0,0.8)" : undefined,
          borderRadius: 18,
          padding: portrait ? "14px 26px" : "12px 28px",
          fontFamily: fontFamilies.body,
          fontWeight: 600,
          fontSize,
          lineHeight: 1.5,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 14px",
          maxWidth: portrait ? 940 : 1500,
        }}
      >
        {chunk.map((w, i) => {
          const active = chunkStart + i === idx;
          return (
            <span
              key={chunkStart + i}
              style={{
                background: active && !cinema ? c.highlight : "transparent",
                color: active ? (cinema ? "#E8B65C" : c.onHighlight) : cinema ? "#F4EEE2" : c.captionInk,
                borderRadius: 10,
                padding: "0 8px",
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const QuietCaption: React.FC<{ timings: WordTiming[]; portrait: boolean; dusk: boolean }> = ({ timings, portrait, dusk }) => {
  const frame = useCurrentFrame();
  const CHUNK = Math.max(1, Math.round(useMotionSettings().captionWords));
  const fontSize = useSize("caption", portrait ? "portrait" : "landscape");
  const first = timings[0];
  const last = timings[timings.length - 1];
  if (!first || !last || frame < first.start || frame > last.end + 6) return null;
  let idx = timings.findIndex((w) => frame >= w.start && frame < w.end);
  if (idx < 0) idx = frame >= last.end ? timings.length - 1 : 0;
  const chunkStart = Math.floor(idx / CHUNK) * CHUNK;
  const chunk = timings.slice(chunkStart, chunkStart + CHUNK);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: portrait ? 470 : 62, display: "flex", justifyContent: "center", padding: "0 64px" }}>
      <div
        style={{
          background: dusk ? "rgba(18,12,28,0.55)" : "rgba(241,228,203,0.88)",
          color: dusk ? "#F1E4CB" : "#4A2E1F",
          borderRadius: 8,
          padding: portrait ? "10px 26px" : "8px 28px",
          fontFamily: fontFamilies.body,
          fontWeight: 500,
          fontSize,
          lineHeight: 1.5,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 12px",
          maxWidth: portrait ? 940 : 1500,
        }}
      >
        {chunk.map((w, i) => {
          const active = chunkStart + i === idx;
          return (
            <span key={chunkStart + i} style={{ color: active ? (dusk ? "#F3C98B" : "#8A3A1E") : undefined, fontWeight: active ? 700 : 500, boxShadow: active ? `inset 0 -3px 0 ${dusk ? "rgba(200,161,90,0.7)" : "rgba(200,161,90,0.8)"}` : "none" }}>
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
