import React from "react";
import { useVideoConfig } from "remotion";
import { useMotionSettings, useSize, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import type { Theme } from "../../../brand/themes";
import { Element } from "../../../brand/elements/Element";
import { LogoMark } from "../../../brand/logo/Logo";
import { SceneShell } from "./SceneShell";
import { T, useLang } from "../../i18n/context";
import { ChannelName } from "../../channel/context";
import { enter, fade, float, useBoil, useSceneFrame } from "./motion";
import type { SceneBase, StringFields } from "./types";

export type EndScreenProps = SceneBase & StringFields<"step" | "prompt">;

/**
 * أماكن عناصر شاشة النهاية في يوتيوب (أفقي 1920×1080). يضعها صاحب القناة في YouTube Studio
 * فوق هذه المواضع تمامًا: فيديوهان 16:9 ودائرة اشتراك.
 * هذه مواضع العربية (RTL): دائرة الاشتراك يمينًا (جانب البداية) والفيديو الأول بجوارها.
 * للتركية والإنجليزية (LTR) تنعكس أفقيًا (x' = 1920 − x − w): استخدم endScreenSlots(dir).
 */
export const END_SCREEN_SLOTS = {
  videos: [
    { x: 870, y: 600, w: 640, h: 360 },
    { x: 190, y: 600, w: 640, h: 360 },
  ],
  subscribe: { cx: 1650, cy: 780, r: 100 },
} as const;

const END_W = 1920;

/** End-screen slots for both directions. LTR mirrors the RTL layout horizontally (subscribe on the left). */
export const END_SCREEN_SLOTS_LTR = {
  videos: END_SCREEN_SLOTS.videos.map((v) => ({ ...v, x: END_W - v.x - v.w })),
  subscribe: { ...END_SCREEN_SLOTS.subscribe, cx: END_W - END_SCREEN_SLOTS.subscribe.cx },
};

/** مواضع عناصر يوتيوب حسب اتجاه اللغة: "rtl" ⇒ END_SCREEN_SLOTS، "ltr" ⇒ END_SCREEN_SLOTS_LTR. */
export const endScreenSlots = (dir: "rtl" | "ltr") => (dir === "rtl" ? END_SCREEN_SLOTS : END_SCREEN_SLOTS_LTR);

/** مكان فارغ ناعم (بلا نص) يدلّ على موضع عنصر يوتيوب. */
const Slot: React.FC<{ t: Theme; style: React.CSSProperties; round?: boolean; a: number }> = ({ t, style, round, a }) => {
  const night = t.id === "night";
  return (
    <div
      style={{
        position: "absolute",
        borderRadius: round ? "50%" : 22,
        background: t.colors.ink,
        opacity: a * (night ? 0.06 : 0.045),
        ...style,
      }}
    />
  );
};

/** خط فاصل قصير مع معين في الوسط. */
const Rule: React.FC<{ t: Theme; width: number; a: number }> = ({ t, width, a }) => (
  <svg width={width} height={16} viewBox={`0 0 ${width} 16`} style={{ opacity: a, overflow: "visible" }}>
    <line x1={0} x2={width / 2 - 14} y1={8} y2={8} stroke={t.colors.primary} strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
    <line x1={width / 2 + 14} x2={width} y1={8} y2={8} stroke={t.colors.primary} strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
    <path d={`M${width / 2} 1 L${width / 2 + 7} 8 L${width / 2} 15 L${width / 2 - 7} 8 Z`} fill={t.colors.primary} />
  </svg>
);

/**
 * «شاشة النهاية»: آخر 20 ثانية من الحلقة، بلا ترجمة.
 * أفقي: الشعار والخطوة العملية وسؤال التعليقات في الأعلى، وصف سفلي فارغ لعناصر يوتيوب
 * (فيديوهان ودائرة اشتراك) لا يتداخل مع أي نص.
 * عمودي (الشورت بلا عناصر نهاية): الشعار، الخطوة، السؤال، و«تابعنا».
 */
export const EndScreen: React.FC<EndScreenProps> = (props) => {
  const { themeId, orientation, step = "", prompt } = props;
  const frame = useSceneFrame();
  const boil = useBoil();
  const motion = useMotionSettings();
  const bubbleSize = useSize("bubble", orientation);
  const refSize = useSize("reference", orientation);
  const eyebrowSize = useSize("eyebrow", orientation);
  const { durationInFrames } = useVideoConfig();
  const t = useTheme(themeId);
  const c = t.colors;
  const portrait = orientation === "portrait";
  const line = t.character.style === "line";
  const night = themeId === "night";
  const dir = useLang().dir;

  const logoIn = enter(frame, 0, 30, 110);
  const cardIn = enter(frame, 10, 30, 100);
  const labelIn = enter(frame, 18, 30, 150);
  const stepIn = fade(frame, 24, 22);
  const promptIn = enter(frame, 44, 30, 120);
  const slotsIn = fade(frame, 30, 30);
  const followIn = enter(frame, 60, 30, 120);
  /** نبضة هادئة متكررة على أيقونة التعليق لتذكّر بالسؤال. */
  const pulse = 1 + 0.06 * Math.max(0, Math.sin(((frame - 70) / 90) * Math.PI * 2)) * (frame > 70 ? 1 : 0);

  const stepLong = step.length > 70;
  const stepSize = Math.round(bubbleSize * (portrait ? (stepLong ? 0.92 : 1) : stepLong ? 0.9 : 1));

  const logo = (size: number) => (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.3, opacity: logoIn, transform: `translateY(${(1 - logoIn) * -14 + float(frame, 3 * motion.float, 120)}px)` }}>
      <LogoMark size={size} colors={t.logo} />
      <span style={{ fontFamily: fontFamilies.wordmark, fontWeight: 700, fontSize: size * 0.56, lineHeight: 1, color: c.ink }}><ChannelName /></span>
    </div>
  );

  const label = (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        background: line ? c.secondary : c.primary,
        border: line ? `3px solid ${c.ink}` : "none",
        color: line ? c.ink : c.bg,
        borderRadius: 999,
        padding: portrait ? "10px 34px 12px" : "8px 30px 10px",
        fontFamily: fontFamilies.heading,
        fontWeight: 700,
        fontSize: Math.round(eyebrowSize * 1.3),
        opacity: labelIn,
        transform: `translateY(${(1 - labelIn) * 12}px) ${line ? boil(frame, 8, 0.4) : ""}`,
      }}
    >
      <svg width={18} height={18} viewBox="0 0 20 20">
        <path d="M10 1 L19 10 L10 19 L1 10 Z" fill={line ? c.primary : c.bg} opacity={line ? 1 : 0.8} />
      </svg>
      <T k="practicalStep" />
    </div>
  );

  const stepCard = (
    <div
      style={{
        position: "relative",
        background: c.surface,
        border: line ? `3px solid ${c.ink}` : "none",
        boxShadow: line ? `8px 8px 0 ${c.secondary}` : `0 18px 48px rgba(0,0,0,${night ? 0.32 : 0.08})`,
        borderRadius: 30,
        padding: portrait ? "68px 56px 48px" : "54px 64px 38px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: cardIn,
        transform: `scale(${0.95 + 0.05 * cardIn}) ${line ? boil(frame, 9, 0.15) : ""}`,
      }}
    >
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translate(-50%, -55%)" }}>{label}</div>
      <div
        style={{
          fontFamily: fontFamilies.heading,
          fontWeight: 700,
          fontSize: stepSize,
          lineHeight: 1.45,
          textAlign: "center",
          color: c.ink,
          textWrap: "balance",
          opacity: stepIn,
          transform: `translateY(${(1 - stepIn) * 16}px)`,
        }}
      >
        {step}
      </div>
    </div>
  );

  const promptRow = prompt ? (
    <div
      style={{
        display: "flex",
        flexDirection: portrait ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: portrait ? 14 : 18,
        opacity: promptIn,
        transform: `translateY(${(1 - promptIn) * 14}px)`,
      }}
    >
      <div style={{ transform: `scale(${pulse}) ${line ? boil(frame, 12) : ""}`, flexShrink: 0 }}>
        <Element id="speech-bubble" theme={t} size={portrait ? 92 : 76} />
      </div>
      <div style={{ fontFamily: fontFamilies.heading, fontWeight: 600, fontSize: Math.round(refSize * (portrait ? 1.2 : 1.12)), color: c.inkSoft, lineHeight: 1.4, textWrap: "balance", textAlign: "center" }}>
        {prompt}
      </div>
    </div>
  ) : null;

  if (portrait) {
    return (
      <SceneShell {...props} eyebrow={undefined} captions={false} durationInFrames={durationInFrames}>
        <div
          style={{
            position: "absolute",
            top: 290,
            bottom: 470,
            left: 0,
            right: 0,
            padding: "0 90px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 76,
          }}
        >
          <div style={{ marginBottom: 18 }}>{logo(118)}</div>
          {stepCard}
          {promptRow}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: -14,
              opacity: followIn,
              transform: `translateY(${(1 - followIn) * 14}px)`,
            }}
          >
            <Rule t={t} width={70} a={1} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: fontFamilies.heading, fontWeight: 700, fontSize: Math.round(refSize * 1.1), color: c.primary }}>
              <Element id="bell" theme={t} size={56} />
              <T k="follow" />
            </div>
            <Rule t={t} width={70} a={1} />
          </div>
        </div>
      </SceneShell>
    );
  }

  const { videos, subscribe } = endScreenSlots(dir);
  return (
    <SceneShell {...props} eyebrow={undefined} captions={false} durationInFrames={durationInFrames}>
      {/* أماكن عناصر يوتيوب (فارغة عمدًا) */}
      {videos.map((v, i) => (
        <Slot key={i} t={t} a={fade(frame, 30 + i * 6, 30)} style={{ left: v.x, top: v.y, width: v.w, height: v.h }} />
      ))}
      <Slot t={t} round a={slotsIn} style={{ left: subscribe.cx - subscribe.r, top: subscribe.cy - subscribe.r, width: subscribe.r * 2, height: subscribe.r * 2 }} />

      {/* الشعار */}
      <div style={{ position: "absolute", top: 58, ...(dir === "rtl" ? { right: 110 } : { left: 110 }) }}>{logo(80)}</div>

      {/* الخطوة العملية والسؤال */}
      <div
        style={{
          position: "absolute",
          top: 136,
          left: 170,
          right: 170,
          height: 444,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 34,
        }}
      >
        <div style={{ width: "100%", maxWidth: 1360, marginTop: 36 }}>{stepCard}</div>
        {promptRow}
      </div>
    </SceneShell>
  );
};

/** محتوى تجريبي لمعاينة القالب. */
export const endScreenSample: Omit<EndScreenProps, "themeId" | "orientation"> = {
  step: "اكتب الآن مهمة واحدة أجلتها، وابدأ فيها خمس دقائق فقط.",
  prompt: "اكتب في التعليقات: ما المهمة التي اخترتها؟",
  captions: false,
};
export const endScreenSeconds = 20;

/** English preview sample (LTR). */
export const endScreenSampleEn: Omit<EndScreenProps, "themeId" | "orientation"> = {
  step: "Write down one task you've been putting off, and start it for just five minutes.",
  prompt: "Tell us in the comments: which task did you pick?",
  captions: false,
};
