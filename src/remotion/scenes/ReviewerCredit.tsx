import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import type { Orientation } from "./types";
import type { ThemeId } from "../../../brand/themes";

/**
 * «راجعها علميًا» في آخر الفيديو (src/package/reviewer.ts): سطر صغير هادئ أسفل شاشة النهاية، يظهر مرة واحدة بخفوت
 * ويبقى حتى آخر المشهد. لا يُرسم إلا حين تحمل شاشة النهاية `props.reviewerCredit`، ولا يُكتب ذلك إلا بإذن مكتوب
 * مسجّل للحلقة. شريط داكن خفيف خلفه ليُقرأ فوق أي خلفية.
 */
export const ReviewerCreditLine: React.FC<{ text: string; themeId: ThemeId; orientation: Orientation }> = ({ text, themeId, orientation }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = useTheme(themeId);
  const a = Math.round(0.6 * fps);
  const o = interpolate(frame, [a, a + Math.round(0.5 * fps)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (o <= 0 || !text.trim()) return null;
  const portrait = orientation === "portrait";
  const size = Math.round(width * (portrait ? 0.032 : 0.017));
  return (
    <AbsoluteFill data-reviewer-credit style={{ justifyContent: "flex-end", alignItems: "center", pointerEvents: "none" }}>
      <div style={{
        opacity: o, marginBottom: Math.round(width * (portrait ? 0.16 : 0.03)), direction: "rtl",
        fontFamily: fontFamilies.body, fontSize: size, fontWeight: 500, color: "#FFFFFF",
        background: "rgba(0,0,0,0.42)", padding: `${Math.round(size * 0.35)}px ${Math.round(size * 0.9)}px`, borderRadius: Math.round(size * 0.4),
        borderBottom: `2px solid ${t.colors.primary}`,
      }}>
        {text}
      </div>
    </AbsoluteFill>
  );
};
