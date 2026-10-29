import React from "react";
import { useVideoConfig } from "remotion";
import { useMotionSettings, useSize, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { Element } from "../../../brand/elements/Element";
import { hasElement } from "../../../brand/elements/registry";
import type { Theme } from "../../../brand/themes";
import { SceneShell } from "./SceneShell";
import { enter, fade, float, useBoil, useSceneFrame } from "./motion";
import type { SceneBase, StringFields } from "./types";

export type ComparisonProps = SceneBase & StringFields<"rightTitle" | "rightItems" | "rightElement" | "leftTitle" | "leftItems" | "leftElement" | "tone">;

/** سطر لكل نقطة، حتى ٤ نقاط. */
const lines = (s?: string) =>
  (s ?? "")
    .split(/\n+/)
    .map((x) => x.replace(/^[\s\-–•·*]+/, "").trim())
    .filter(Boolean)
    .slice(0, 4);

/** لون بشفافية من لون الثيم (hex). */
const alpha = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(h)) return hex;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** تقدير ارتفاع عمود لتصغير الخط إن طال النص (عرض الحرف العربي ≈ نصف حجم الخط). */
const estimateHeight = (items: string[], fs: number, textW: number, titleFs: number, gap: number) => {
  const perLine = Math.max(4, Math.floor(textW / (fs * 0.44)));
  const rows = items.reduce((sum, it) => sum + Math.max(1, Math.ceil(it.length / perLine)), 0);
  return titleFs * 1.5 + rows * fs * 1.45 + Math.max(0, items.length - 1) * gap;
};

type Mark = "wrong" | "right" | "neutral-a" | "neutral-b";

/** علامة النقطة: × باهتة للخطأ، ✓ ممتلئة للصواب، معيّن صغير للمحايد. */
const Marker: React.FC<{ kind: Mark; size: number; t: Theme; a: number }> = ({ kind, size, t, a }) => {
  const c = t.colors;
  const line = t.character.style === "line";
  const s = size;
  if (kind === "wrong") {
    return (
      <svg width={s} height={s} viewBox="0 0 40 40" style={{ flexShrink: 0, opacity: a }}>
        <circle cx={20} cy={20} r={17} fill="none" stroke={c.inkSoft} strokeWidth={2.5} strokeOpacity={0.7} />
        <path d="M14 14 L26 26 M26 14 L14 26" stroke={c.inkSoft} strokeWidth={3} strokeLinecap="round" strokeDasharray={18} strokeDashoffset={18 * (1 - a)} />
      </svg>
    );
  }
  if (kind === "right") {
    return (
      <svg width={s} height={s} viewBox="0 0 40 40" style={{ flexShrink: 0, transform: `scale(${0.6 + 0.4 * a})`, opacity: Math.min(1, a * 2) }}>
        <circle cx={20} cy={20} r={18} fill={line ? c.secondary : c.primary} stroke={line ? c.ink : "none"} strokeWidth={2.5} />
        <path d="M12 20.5 L18 26.5 L28.5 14" fill="none" stroke={line ? c.ink : c.surface} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={26} strokeDashoffset={26 * (1 - a)} />
      </svg>
    );
  }
  const fill = kind === "neutral-a" ? c.primary : line ? c.secondary : c.secondary;
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" style={{ flexShrink: 0, opacity: a, transform: `scale(${0.5 + 0.5 * a}) rotate(${(1 - a) * 90}deg)` }}>
      <rect x={13} y={13} width={14} height={14} rx={2} transform="rotate(45 20 20)" fill={fill} stroke={line ? c.ink : "none"} strokeWidth={2.5} />
    </svg>
  );
};

/**
 * «المقارنة»: جانبان متقابلان. الأول (اليمين، أو الأعلى في الشورت) يظهر أولًا ثم الثاني،
 * والنقاط تتوالى. في نوع «خطأ ← صواب» يكون الأول باهتًا بإطار متقطع وعلامات ×،
 * وحين تظهر نقاط الجانب الثاني يُشطب ما يقابلها في الأول، والثاني بارز بعلامات ✓.
 */
export const Comparison: React.FC<ComparisonProps> = (props) => {
  const { themeId, orientation, rightTitle = "", leftTitle = "", rightElement, leftElement } = props;
  const frame = useSceneFrame();
  const boil = useBoil();
  const motion = useMotionSettings();
  const bubbleSize = useSize("bubble", orientation);
  const { durationInFrames } = useVideoConfig();
  const t = useTheme(themeId);
  const c = t.colors;
  const portrait = orientation === "portrait";
  const ink = t.character.style === "line";
  const contrast = props.tone === "contrast";

  const rItems = lines(props.rightItems);
  const lItems = lines(props.leftItems);

  // ـــ المقاسات ـــ
  const cardW = portrait ? 940 : 760;
  const padX = portrait ? 48 : 52;
  const iconSize = portrait ? 84 : 104;
  const markSize = portrait ? 44 : 42;
  const titleBase = Math.round(bubbleSize * 0.92);
  const itemBase = Math.round(bubbleSize * (portrait ? 0.66 : 0.7));
  const itemGap = portrait ? 12 : 24;
  const textW = cardW - padX * 2 - markSize - 20;
  const maxColH = portrait ? 320 : 470;
  let scale = 1;
  while (scale > 0.62) {
    const h = Math.max(
      estimateHeight(rItems, itemBase * scale, textW, titleBase * scale, itemGap),
      estimateHeight(lItems, itemBase * scale, textW, titleBase * scale, itemGap),
    );
    if (h <= maxColH) break;
    scale -= 0.04;
  }
  const itemSize = Math.round(itemBase * scale);
  const titleSize = Math.round(titleBase * Math.max(scale, 0.8));

  // ـــ التوقيت ـــ
  const all = rItems.length + lItems.length;
  const step = Math.max(6, Math.min(12, Math.floor((durationInFrames - 70) / Math.max(1, all + 3))));
  const rCardAt = 4;
  const rItemAt = (i: number) => 18 + i * step;
  const lCardAt = rItemAt(rItems.length) + 8;
  const lItemAt = (i: number) => lCardAt + 14 + i * step;
  const midAt = lCardAt - 6;

  const rIn = enter(frame, rCardAt, 30, 130);
  const lIn = enter(frame, lCardAt, 30, 130);
  const midIn = enter(frame, midAt, 30, 160);
  /** بعد ظهور الجانب الثاني يخفت الأول قليلًا في نوع التباين. */
  const settle = contrast ? fade(frame, lCardAt, 20) : 0;

  const column = (side: "right" | "left") => {
    const first = side === "right";
    const items = first ? rItems : lItems;
    const title = first ? rightTitle : leftTitle;
    const el = first ? rightElement : leftElement;
    const cardIn = first ? rIn : lIn;
    const itemAt = first ? rItemAt : lItemAt;
    const muted = contrast && first;
    const strong = contrast && !first;
    const kind: Mark = contrast ? (first ? "wrong" : "right") : first ? "neutral-a" : "neutral-b";
    const shift = portrait ? `translateY(${(1 - cardIn) * 40}px)` : `translateX(${(1 - cardIn) * (first ? 60 : -60)}px)`;

    const border = ink
      ? muted
        ? `3px dashed ${alpha(c.ink, 0.45)}`
        : `3px solid ${c.ink}`
      : muted
        ? `3px dashed ${alpha(c.inkSoft, 0.5)}`
        : strong
          ? `4px solid ${c.primary}`
          : "none";
    const shadow = muted
      ? "none"
      : ink
        ? `10px 10px 0 ${c.secondary}`
        : `0 22px 54px rgba(0,0,0,${themeId === "night" ? 0.32 : 0.09})`;

    return (
      <div
        style={{
          position: "relative",
          width: cardW,
          boxSizing: "border-box",
          background: muted ? alpha(c.surface, themeId === "night" ? 0.35 : 0.45) : c.surface,
          border,
          boxShadow: shadow,
          borderRadius: 30,
          padding: portrait ? `28px ${padX}px 32px` : `40px ${padX}px 46px`,
          opacity: cardIn * (1 - settle * 0.12),
          transform: `${shift} scale(${0.96 + 0.04 * cardIn}) ${ink ? boil(frame, first ? 2 : 9, 0.25) : ""}`,
          display: "flex",
          flexDirection: "column",
          gap: portrait ? 16 : 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22, minHeight: iconSize * 0.8 }}>
          {el && hasElement(el) ? (
            <div
              style={{
                flexShrink: 0,
                opacity: enter(frame, (first ? rCardAt : lCardAt) + 6, 30, 160),
                transform: `translateY(${float(frame, 4 * motion.float, 96, first ? 0 : 40)}px) scale(${0.5 + 0.5 * enter(frame, (first ? rCardAt : lCardAt) + 6, 30, 160)}) ${ink ? boil(frame, first ? 4 : 11) : ""}`,
                filter: muted ? "saturate(0.55)" : undefined,
              }}
            >
              <Element id={el} theme={t} size={iconSize} />
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <div
              style={{
                fontFamily: fontFamilies.heading,
                fontWeight: 700,
                fontSize: titleSize,
                lineHeight: 1.25,
                color: muted ? c.inkSoft : strong ? (ink ? c.ink : c.primary) : c.ink,
              }}
            >
              {title}
            </div>
            <div
              style={{
                height: 6,
                width: 110,
                borderRadius: 3,
                background: muted ? alpha(c.inkSoft, 0.35) : strong ? (ink ? c.secondary : c.primary) : first ? c.primary : c.secondary,
                transformOrigin: "right center",
                transform: `scaleX(${fade(frame, (first ? rCardAt : lCardAt) + 10, 16)})`,
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: itemGap }}>
          {items.map((it, i) => {
            const a = enter(frame, itemAt(i), 30, 170);
            // الشطب: حين تظهر النقطة المقابلة في الجانب الثاني (أو بعد آخرها).
            const strikeAt = lItemAt(Math.min(i, Math.max(0, lItems.length - 1))) + 6;
            const strike = muted ? fade(frame, strikeAt, 12) : 0;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 20,
                  opacity: Math.min(1, a * 1.4),
                  transform: `translateX(${(1 - a) * 36}px)`,
                }}
              >
                <div style={{ paddingTop: itemSize * 0.72 - markSize / 2 }}>
                  <Marker kind={kind} size={markSize} t={t} a={a} />
                </div>
                <div
                  style={{
                    fontFamily: fontFamilies.body,
                    fontWeight: strong ? 700 : 600,
                    fontSize: itemSize,
                    lineHeight: 1.45,
                    color: muted ? c.inkSoft : c.ink,
                    opacity: muted ? 1 - strike * 0.25 : 1,
                    minWidth: 0,
                  }}
                >
                  {muted ? (
                    <span
                      style={{
                        backgroundImage: `linear-gradient(${ink ? c.ink : c.primary}, ${ink ? c.ink : c.primary})`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 58%",
                        backgroundSize: `${strike * 100}% ${Math.max(3, Math.round(itemSize * 0.08))}px`,
                        WebkitBoxDecorationBreak: "clone",
                        boxDecorationBreak: "clone",
                        padding: "0 4px",
                      }}
                    >
                      {it}
                    </span>
                  ) : (
                    it
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /** الوسيط بين الجانبين: سهم «من ← إلى» في التباين، أو نجمة صغيرة في المحايد. */
  const mid = (
    <div
      style={{
        flexShrink: 0,
        width: portrait ? 84 : 92,
        height: portrait ? 84 : 92,
        borderRadius: 999,
        background: ink ? c.surface : contrast ? c.primary : c.surface,
        border: ink ? `3px solid ${c.ink}` : "none",
        boxShadow: ink ? "none" : `0 10px 28px rgba(0,0,0,${themeId === "night" ? 0.3 : 0.1})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: midIn,
        transform: `scale(${midIn}) ${ink ? boil(frame, 6) : ""}`,
        zIndex: 2,
      }}
    >
      {contrast ? (
        <svg width={48} height={48} viewBox="0 0 48 48" style={{ transform: portrait ? "rotate(-90deg)" : undefined }}>
          <path d="M38 24 H11 M21 13 L10 24 L21 35" fill="none" stroke={ink ? c.ink : c.surface} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width={44} height={44} viewBox="0 0 40 40">
          <rect x={9} y={9} width={22} height={22} fill={ink ? c.secondary : c.primary} stroke={ink ? c.ink : "none"} strokeWidth={2.5} strokeLinejoin="round" />
          <rect x={9} y={9} width={22} height={22} fill={ink ? c.secondary : c.primary} stroke={ink ? c.ink : "none"} strokeWidth={2.5} strokeLinejoin="round" transform="rotate(45 20 20)" />
        </svg>
      )}
    </div>
  );

  if (portrait) {
    const lineIn = fade(frame, midAt - 4, 18);
    return (
      <SceneShell {...props} durationInFrames={durationInFrames}>
        <div style={{ position: "absolute", top: 330, bottom: 600, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0 }}>
          {column("right")}
          <div style={{ position: "relative", width: cardW, height: 96, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", right: 40, left: 40, top: "50%", height: 3, borderRadius: 2, background: ink ? c.ink : alpha(c.inkSoft, 0.35), opacity: 0.5, transform: `scaleX(${lineIn})` }} />
            {mid}
          </div>
          {column("left")}
        </div>
      </SceneShell>
    );
  }

  return (
    <SceneShell {...props} durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", top: 140, bottom: 190, left: 0, right: 0, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", gap: 0 }}>
          {column("right")}
          <div style={{ width: 128, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div style={{ position: "absolute", top: 30, bottom: 30, left: "50%", width: 3, borderRadius: 2, background: ink ? c.ink : alpha(c.inkSoft, 0.3), opacity: 0.4 * fade(frame, midAt - 4, 18) }} />
            {mid}
          </div>
          {column("left")}
        </div>
      </div>
    </SceneShell>
  );
};

/** محتوى تجريبي لمعاينة القالب. */
export const comparisonSample: Omit<ComparisonProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 3 · السبب الأعمق",
  rightTitle: "ما نظنه",
  rightItems: "التأجيل كسل\nأحتاج حماسًا لأبدأ\nسأبدأ غدًا بنشاط أكبر",
  rightElement: "head-tangle",
  leftTitle: "ما يحدث فعلًا",
  leftItems: "التأجيل هروب من شعور ثقيل\nالحماس يأتي بعد البداية\nالغد لا يأتي وحده",
  leftElement: "head-idea",
  tone: "contrast",
  narration: "نظن أن التأجيل كسل، لكنه في الحقيقة هروب من شعور ثقيل.",
};
export const comparisonSeconds = 8;
