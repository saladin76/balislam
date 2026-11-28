/**
 * عنوان الشورت على الشاشة (تكملة D207، قرار المالك ٢٣ نوفمبر، التعريف: docs/dafatir-alzaman/07-decisions.md):
 * لا خطاف في الشورت؛ يبدأ بجملة الحلقة طبيعيًا، ويظهر فوقه عنوان هادئ هو سؤال الشورت نفسه (عنوانه في حزمة النشر).
 * هادئ: نص ثابت بلا حركة ولا مؤثر، يظهر ويختفي بتلاشٍ قصير وحده. ولا يظهر أبدًا في نافذة سكون مقصود (آية، أو ذكر الله،
 * أو دعاء): إن وقعت نافذة في أول الشورت بقي غائبًا حتى تنتهي، ويغيب في كل نافذة بعدها.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamilies } from "../../../brand/fonts";
import { PORTRAIT_TEXT } from "../safeArea";
import { useBrandFonts } from "../useBrandFonts";

export type QuietSpan = { from: number; to: number };
/** ثواني التلاشي عند الظهور والغياب */
export const SHORT_TITLE_FADE_SEC = 0.3;

/**
 * شفافية العنوان عند الثانية t: صفر داخل كل نافذة سكون، ويتلاشى قبلها ويعود بعدها بـSHORT_TITLE_FADE_SEC، فلا يُرى
 * منه شيء داخل النافذة نفسها. يبدأ من الثانية صفر إن لم تكن فيها نافذة.
 */
export const shortTitleOpacity = (t: number, quiet: QuietSpan[], fade = SHORT_TITLE_FADE_SEC): number => {
  let o = Math.min(1, t / fade);
  for (const s of quiet) {
    if (t >= s.from && t <= s.to) return 0;
    if (t < s.from) o = Math.min(o, (s.from - t) / fade);
    else o = Math.min(o, (t - s.to) / fade);
  }
  return Math.max(0, Math.min(1, o));
};

export const ShortTitle: React.FC<{ text: string; quiet: QuietSpan[] }> = ({ text, quiet }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const opacity = shortTitleOpacity(frame / fps, quiet);
  return <ShortTitleText text={text} opacity={opacity} k={width / 1080} />;
};

/** النص نفسه بأسلوب القناة داخل المنطقة الآمنة (D243)؛ يرسمه ShortTitle في الرندر، وShortTitleStill لقص الشورت من النسخة العمودية */
export const ShortTitleText: React.FC<{ text: string; opacity: number; k: number }> = ({ text, opacity, k }) => {
  if (!text.trim() || opacity <= 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        data-short-title
        style={{ position: "absolute", top: PORTRAIT_TEXT.topLine.top * k, left: PORTRAIT_TEXT.topLine.left * k, right: PORTRAIT_TEXT.topLine.right * k, direction: "rtl", textAlign: "center", opacity,
          fontFamily: fontFamilies.body, fontWeight: 700, fontSize: 60 * k, lineHeight: 1.35, color: "#FFFFFF",
          textShadow: `0 ${2 * k}px ${10 * k}px rgba(0,0,0,0.55), 0 0 ${2 * k}px rgba(0,0,0,0.6)` }}
      >
        {text.trim()}
      </div>
    </AbsoluteFill>
  );
};

/** D243 (قرار المالك ٢٨ نوفمبر): عنوان الشورت المقصوص من النسخة العمودية: صورة PNG شفافة 1080×1920 بالعنوان كاملًا، يركّبها
 *  القص (verticalCut.ts) أول ثلاث ثوانٍ بتلاشٍ قصير، ولا يُرسم في نافذة سكون مقصود. */
export const ShortTitleStill: React.FC<{ text: string }> = ({ text }) => {
  useBrandFonts();
  return <ShortTitleText text={text} opacity={1} k={1} />;
};
