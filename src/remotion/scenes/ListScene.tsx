import React from "react";
import { useVideoConfig } from "remotion";
import { useSize, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { Element } from "../../../brand/elements/Element";
import { hasElement } from "../../../brand/elements/registry";
import { SceneShell } from "./SceneShell";
import { Digits, useLang } from "../../i18n/context";

import { enter, fade, useBoil, useSceneFrame } from "./motion";
import type { SceneBase, StringFields } from "./types";

export type ListSceneProps = SceneBase & StringFields<"title" | "items" | "style" | "icons">;

/** أرقام عربية مشرقية: 1 → ١ */
const arabicDigits = (n: number) => String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)] ?? d);

/** تقدير ارتفاع القائمة لتصغير الخط إن طال النص (عرض الحرف العربي ≈ 0.44 من حجم الخط). */
const estimate = (items: string[], fs: number, textW: number, lead: number, padY: number, gap: number) => {
  const perLine = Math.max(4, Math.floor(textW / (fs * 0.44)));
  const rows = items.map((it) => Math.max(lead, Math.ceil(it.length / perLine) * fs * 1.45) + padY * 2 + 6);
  return rows.reduce((a, b) => a + b, 0) + Math.max(0, items.length - 1) * gap;
};

/**
 * «القائمة»: عنوان ثم حتى خمس نقاط تظهر واحدة بعد أخرى.
 * الأشكال: مرقّمة (١ ٢ ٣ في شارات)، علامات صح، أو رمز من المكتبة لكل نقطة.
 * النقطة الجارية تُبرز قليلًا وما قبلها يهدأ، ثم تستوي كلها في آخر المشهد.
 */
export const ListScene: React.FC<ListSceneProps> = (props) => {
  const { themeId, orientation, title = "" } = props;
  const frame = useSceneFrame();
  const boil = useBoil();
  const questionSize = useSize("question", orientation);
  const bubbleSize = useSize("bubble", orientation);
  const { durationInFrames } = useVideoConfig();
  const t = useTheme(themeId);
  const c = t.colors;
  const portrait = orientation === "portrait";
  const ink = t.character.style === "line";
  /** الصفوف تنزلق من جهة بداية القراءة. */
  const rtl = useLang().dir === "rtl";
  const startSide = rtl ? "right" : "left";
  const style = props.style === "check" || props.style === "icons" ? props.style : "numbered";

  const items = (props.items ?? "")
    .split(/\n+/)
    .map((x) => x.replace(/^[\s\-–•·*]+/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
  const icons = (props.icons ?? "").split(/[,،\n]+/).map((x) => x.trim());

  // ـــ المقاسات ـــ
  const maxW = portrait ? 940 : 1200;
  const badgeBase = portrait ? 96 : 92;
  const iconBase = portrait ? 112 : 108;
  const leadBase = style === "icons" ? iconBase : badgeBase;
  const rowPadX = portrait ? 30 : 36;
  const padY = portrait ? 18 : 14;
  const gap = portrait ? 24 : 22;
  const titleBase = Math.round(questionSize * (portrait ? 0.68 : 0.62));
  const itemBase = Math.round(bubbleSize * (portrait ? 0.92 : 0.94));
  const fits = (k: number) => {
    const tSize = titleBase * Math.max(0.72, k);
    const titleLines = Math.max(1, Math.ceil(title.length / Math.max(4, Math.floor(maxW / (tSize * 0.46)))));
    const avail = (portrait ? 990 : 730) - (title ? titleLines * tSize * 1.3 + (portrait ? 66 : 54) : 0);
    const l = leadBase * Math.max(0.7, k);
    return estimate(items, itemBase * k, maxW - rowPadX * 2 - l - 28, l, padY, gap * Math.max(0.6, k)) <= avail;
  };
  let scale = 1;
  while (scale > 0.56 && !fits(scale)) scale -= 0.03;
  const titleSize = Math.round(titleBase * Math.max(0.72, scale));
  const badge = Math.round(badgeBase * Math.max(0.7, scale));
  const iconSize = Math.round(iconBase * Math.max(0.7, scale));
  const lead = style === "icons" ? iconSize : badge;
  const rowGap = Math.round(gap * Math.max(0.6, scale));
  const itemSize = Math.round(itemBase * scale);

  // ـــ التوقيت ـــ
  const n = Math.max(1, items.length);
  const first = title ? 22 : 8;
  const step = Math.max(12, Math.min(42, Math.floor((durationInFrames - first - 60) / n)));
  const at = (i: number) => first + i * step;
  const settleAt = at(n - 1) + Math.max(30, Math.min(step, 48));
  const settle = fade(frame, settleAt, 16);

  const titleIn = enter(frame, 2, 30, 140);
  const barIn = fade(frame, 12, 18);

  const lead$ = (i: number, a: number) => {
    const id = icons[i];
    if (style === "icons" && id && hasElement(id)) {
      return (
        <div style={{ width: iconSize, height: iconSize, flexShrink: 0, transform: `scale(${0.4 + 0.6 * a}) rotate(${(1 - a) * -20}deg) ${ink ? boil(frame, 30 + i) : ""}` }}>
          <Element id={id} theme={t} size={iconSize} />
        </div>
      );
    }
    const fill = ink ? c.secondary : c.primary;
    const on = ink ? c.ink : c.surface;
    return (
      <div
        style={{
          width: badge,
          height: badge,
          flexShrink: 0,
          borderRadius: 999,
          background: fill,
          border: ink ? `3px solid ${c.ink}` : "none",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${0.4 + 0.6 * a}) ${ink ? boil(frame, 30 + i) : ""}`,
          ...(style === "icons" ? { margin: `0 ${(iconSize - badge) / 2}px` } : {}),
        }}
      >
        {style === "check" ? (
          <svg width={badge * 0.56} height={badge * 0.56} viewBox="0 0 40 40">
            <path d="M8 21 L17 30 L33 11" fill="none" stroke={on} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={40} strokeDashoffset={40 * (1 - fade(frame, at(i) + 4, 12))} />
          </svg>
        ) : (
          <span style={{ fontFamily: fontFamilies.heading, fontWeight: 700, fontSize: badge * 0.56, lineHeight: 1, color: on, marginTop: badge * 0.06 }}><Digits>{arabicDigits(i + 1)}</Digits></span>
        )}
      </div>
    );
  };

  return (
    <SceneShell {...props} durationInFrames={durationInFrames}>
      <div
        style={{
          position: "absolute",
          top: portrait ? 340 : 150,
          bottom: portrait ? 580 : 190,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: maxW, display: "flex", flexDirection: "column", gap: Math.round((portrait ? 44 : 36) * Math.max(0.7, scale)) }}>
          {title ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, opacity: titleIn, transform: `translateY(${(1 - titleIn) * 24}px)` }}>
              <div style={{ fontFamily: fontFamilies.heading, fontWeight: 700, fontSize: titleSize, lineHeight: 1.3, color: c.ink }}>{title}</div>
              <div style={{ height: 8, width: portrait ? 150 : 170, borderRadius: 4, background: ink ? c.secondary : c.primary, border: ink ? `2px solid ${c.ink}` : "none", transformOrigin: `${startSide} center`, transform: `scaleX(${barIn})` }} />
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: rowGap }}>
            {items.map((it, i) => {
              const a = enter(frame, at(i), 30, 150);
              const seen = fade(frame, at(i), 10);
              const next = i + 1 < items.length ? fade(frame, at(i + 1), 12) : fade(frame, settleAt, 16);
              const current = seen * (1 - next);
              const dim = (seen - current) * (1 - settle);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 28,
                    padding: `${padY}px ${rowPadX}px`,
                    borderRadius: 26,
                    background: c.surface,
                    border: ink ? `3px solid ${c.ink}` : "none",
                    boxShadow: ink
                      ? `${8 * current}px ${8 * current}px 0 ${c.secondary}`
                      : `0 0 0 ${3 * current}px ${c.primary}, 0 ${10 + 8 * current}px ${30 + 12 * current}px rgba(0,0,0,${themeId === "night" ? 0.28 : 0.07 + 0.03 * current})`,
                    opacity: Math.min(1, a * 1.5),
                    transform: `translateX(${(1 - a) * 70 * (rtl ? 1 : -1)}px) scale(${1 + 0.012 * current}) ${ink ? boil(frame, 40 + i, 0.18) : ""}`,
                    transformOrigin: `${startSide} center`,
                  }}
                >
                  <div style={{ opacity: 1 - dim * 0.4, display: "flex" }}>{lead$(i, a)}</div>
                  <div style={{ opacity: 1 - dim * 0.4, fontFamily: fontFamilies.body, fontWeight: 600, fontSize: itemSize, lineHeight: 1.45, color: c.ink, minWidth: 0, flex: 1 }}>{it}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SceneShell>
  );
};

/** محتوى تجريبي لمعاينة القالب. */
export const listSample: Omit<ListSceneProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 5 · كيف نبدأ",
  title: "ثلاث خطوات صغيرة",
  items: "حدّد مهمة واحدة فقط\nاعمل عليها خمس دقائق\nكافئ نفسك بعد الإنجاز",
  style: "numbered",
  icons: "target, timer, star-badge",
  narration: "حدّد مهمة واحدة، واعمل عليها خمس دقائق، ثم كافئ نفسك.",
};
/** English preview content. */
export const listSampleEn: Omit<ListSceneProps, "themeId" | "orientation"> = {
  eyebrow: "Chapter 5 · How to start",
  title: "Three small steps",
  items: "Pick just one task\nWork on it for five minutes\nReward yourself when it's done",
  style: "numbered",
  icons: "target, timer, star-badge",
  narration: "Pick one task, work on it for five minutes, then reward yourself.",
};
export const listSeconds = 8;
