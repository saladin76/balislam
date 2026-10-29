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
export const CaptionBar: React.FC<{ theme: Theme; timings: WordTiming[]; portrait: boolean }> = ({ theme, timings, portrait }) => {
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
        bottom: portrait ? 470 : 64,
        display: "flex",
        justifyContent: "center",
        padding: "0 64px",
      }}
    >
      <div
        style={{
          background: c.captionBg,
          color: c.captionInk,
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
                background: active ? c.highlight : "transparent",
                color: active ? c.onHighlight : c.captionInk,
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
