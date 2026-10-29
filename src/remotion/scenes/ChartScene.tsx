import React from "react";
import { useVideoConfig } from "remotion";
import { useSize, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { SceneShell } from "./SceneShell";
import { Digits, useLang } from "../../i18n/context";

import { enter, fade, useBoil, useSceneFrame } from "./motion";
import type { SceneBase, StringFields } from "./types";

export type ChartSceneProps = SceneBase & StringFields<"title" | "data" | "unit" | "highlight" | "source">;

type Row = { label: string; value: number; decimals: number };

/** يحوّل الأرقام الهندية والفارسية والفاصلة العشرية العربية إلى صيغة يفهمها JS. */
const normalizeNumber = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫,]/g, ".")
    .replace(/[٬\s]/g, "");

/** «الاسم: القيمة» في كل سطر. يقبل «:» أو «：» أو «|»، ويأخذ آخر رقم في السطر. */
const parseData = (data: string): Row[] =>
  data
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = Math.max(line.lastIndexOf(":"), line.lastIndexOf("："), line.lastIndexOf("|"));
      const label = (idx >= 0 ? line.slice(0, idx) : line).trim();
      const raw = normalizeNumber(idx >= 0 ? line.slice(idx + 1) : "");
      const m = raw.match(/-?\d+(?:\.\d+)?/);
      const value = m ? Math.max(0, parseFloat(m[0])) : 0;
      const decimals = m && m[0].includes(".") ? (m[0].split(".")[1] ?? "").length : 0;
      return { label, value, decimals };
    })
    .filter((r) => r.label)
    .slice(0, 7);

/** رقم بالأرقام العربية الهندية مع الفاصلة العشرية «٫». */
export const toArabicDigits = (n: number, decimals = 0) =>
  n
    .toFixed(decimals)
    .replace(/\./g, "٫")
    .replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));

const bare = (s: string) => s.replace(/[ً-ْٰـ]/g, "").trim();

/**
 * «الرسم البياني»: عنوان ثم أعمدة أفقية تنمو من جانب البداية (يمين→يسار في العربية، يسار→يمين في LTR)
 * من خط الصفر واحدًا تلو الآخر،
 * بمقياس واحد لكل الأعمدة. العمود المميز بلون الثيم، والبقية خافتة، ثم يمر قلم التمييز على اسمه.
 * في الشاشة العمودية يعلو الاسمُ عمودَه ليأخذ العمود عرض الشاشة كله.
 */
export const ChartScene: React.FC<ChartSceneProps> = (props) => {
  const { themeId, orientation, title, data = "", unit, highlight, source } = props;
  const frame = useSceneFrame();
  const boil = useBoil();
  const questionSize = useSize("question", orientation);
  const bubbleSize = useSize("bubble", orientation);
  const refSize = useSize("reference", orientation);
  const { durationInFrames } = useVideoConfig();
  const t = useTheme(themeId);
  const c = t.colors;
  const portrait = orientation === "portrait";
  const ink = t.character.style === "line";
  // اتجاه القراءة: العربية تنمو أعمدتها من اليمين، والتركية/الإنجليزية من اليسار.
  const rtl = useLang().dir === "rtl";
  const startSide = rtl ? "right" : "left";
  const endSide = rtl ? "left" : "right";

  const rows = parseData(data);
  const n = Math.max(1, rows.length);
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  const hlIndex = highlight ? rows.findIndex((r) => bare(r.label) === bare(highlight)) : -1;

  const titleSize = Math.round(questionSize * (portrait ? 0.62 : 0.56));
  const labelSize = Math.round(bubbleSize * (portrait ? 0.7 : 0.62));
  const valueSize = Math.round(bubbleSize * (portrait ? 0.76 : 0.66));

  // المقاسات الثابتة للرسم (بالبكسل) حتى يبقى المقياس واحدًا ودقيقًا.
  const cardW = portrait ? 960 : 1500;
  const padX = portrait ? 52 : 72;
  const labelCol = portrait ? 0 : 340;
  const labelGap = portrait ? 0 : 34;
  const trackW = cardW - padX * 2 - labelCol - labelGap;
  const valueReserve = portrait ? 260 : 250;
  const maxBar = trackW - valueReserve;
  const rowH = portrait ? Math.min(158, Math.floor(660 / n)) : Math.min(112, Math.floor(470 / n));
  const barH = Math.round(portrait ? Math.min(64, rowH * 0.42) : Math.min(64, rowH * 0.56));

  const titleIn = enter(frame, 0, 30, 130);
  const cardIn = enter(frame, 6, 30, 110);
  const axisIn = fade(frame, 12, 14);
  const growFrom = 20;
  const stagger = Math.max(8, Math.min(14, Math.round(60 / n)));
  const growLen = 26;
  const allDone = growFrom + (n - 1) * stagger + growLen;
  const marker = fade(frame, allDone + 2, 14);
  const pulse = enter(frame, allDone + 2, 30, 200);
  const sourceIn = fade(frame, allDone - 6, 16);

  const barFill = (hl: boolean): React.CSSProperties => {
    if (ink) {
      return hl
        ? { background: c.secondary, border: `3px solid ${c.ink}` }
        : { background: `repeating-linear-gradient(-45deg, ${c.ink}33 0 3px, transparent 3px 14px), ${c.surface}`, border: `3px solid ${c.ink}` };
    }
    return hl ? { background: c.primary } : { background: c.inkSoft, opacity: themeId === "night" ? 0.42 : 0.28 };
  };

  const rowsEl = rows.map((r, i) => {
    const hl = i === hlIndex;
    const g = fade(frame, growFrom + i * stagger, growLen);
    const w = Math.max(0, (r.value / max) * maxBar * g);
    const labelIn = fade(frame, growFrom + i * stagger - 6, 12);
    const shown = r.value * g;
    const valueIn = fade(frame, growFrom + i * stagger + 4, 10);
    const hlScale = hl ? 1 + 0.12 * Math.sin(Math.min(1, pulse) * Math.PI) : 1;

    const label = (
      <div
        style={{
          position: "relative",
          width: portrait ? "auto" : labelCol,
          alignSelf: portrait ? "flex-start" : "center",
          fontFamily: fontFamilies.heading,
          fontWeight: 700,
          fontSize: labelSize,
          lineHeight: 1.25,
          color: hl ? c.ink : c.inkSoft,
          opacity: labelIn,
          transform: `translateX(${(1 - labelIn) * (rtl ? 18 : -18)}px)`,
          overflowWrap: "anywhere",
        }}
      >
        {hl ? (
          <span
            style={{
              position: "absolute",
              [startSide]: -12,
              [endSide]: portrait ? -12 : "auto",
              width: portrait ? "auto" : "calc(100% + 24px)",
              top: "8%",
              bottom: "4%",
              background: c.highlight,
              borderRadius: 12,
              transformOrigin: `${startSide} center`,
              transform: `scaleX(${marker}) ${ink ? boil(frame, 11, 0.3) : ""}`,
            }}
          />
        ) : null}
        <span style={{ position: "relative", color: hl && marker > 0.6 ? c.onHighlight : undefined }}>{r.label}</span>
      </div>
    );

    const bar = (
      <div style={{ position: "relative", width: trackW, height: barH, display: "flex", alignItems: "center" }}>
        {portrait ? (
          <div style={{ position: "absolute", [startSide]: -3, top: -8, bottom: -8, width: 4, borderRadius: 2, background: c.ink, opacity: 0.55 * axisIn }} />
        ) : null}
        <div
          style={{
            height: barH,
            width: w,
            minWidth: g > 0 ? (ink ? 6 : 4) : 0,
            borderRadius: rtl ? `${barH * 0.28}px 0 0 ${barH * 0.28}px` : `0 ${barH * 0.28}px ${barH * 0.28}px 0`,
            boxSizing: "border-box",
            transform: ink ? boil(frame, 20 + i, 0.08) : undefined,
            ...barFill(hl),
            ...(ink ? (rtl ? { borderRight: "none" } : { borderLeft: "none" }) : {}),
          }}
        />
        <div
          style={{
            ...(rtl ? { marginRight: 20 } : { marginLeft: 20 }),
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            whiteSpace: "nowrap",
            opacity: valueIn,
            transform: `scale(${hlScale})`,
            transformOrigin: `${startSide} center`,
          }}
        >
          <span style={{ fontFamily: fontFamilies.heading, fontWeight: 700, fontSize: valueSize, color: hl ? c.primary : c.ink, fontVariantNumeric: "tabular-nums" }}>
            <Digits>{toArabicDigits(g >= 1 ? r.value : shown, r.decimals)}</Digits>
          </span>
          {unit ? <span style={{ fontSize: Math.round(valueSize * 0.6), fontWeight: 600, color: c.inkSoft }}>{unit}</span> : null}
        </div>
      </div>
    );

    return (
      <div
        key={i}
        style={{
          height: rowH,
          display: "flex",
          flexDirection: portrait ? "column" : "row",
          alignItems: portrait ? "stretch" : "center",
          justifyContent: "center",
          gap: portrait ? 2 : labelGap,
        }}
      >
        {label}
        {bar}
      </div>
    );
  });

  // خط الصفر: عمودي على جانب البداية من الأعمدة (يمينًا في العربية، يسارًا في الإنجليزية).
  const axisRight = padX + labelCol + labelGap;

  return (
    <SceneShell {...props} durationInFrames={durationInFrames}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: portrait ? 48 : 40,
          padding: portrait ? "330px 60px 590px" : "120px 160px 190px",
        }}
      >
        {title ? (
          <div
            style={{
              fontFamily: fontFamilies.heading,
              fontWeight: 700,
              fontSize: titleSize,
              lineHeight: 1.3,
              textAlign: "center",
              maxWidth: portrait ? 940 : 1500,
              textWrap: "balance",
              opacity: titleIn,
              transform: `translateY(${(1 - titleIn) * 22}px)`,
            }}
          >
            {title}
          </div>
        ) : null}
        <div
          style={{
            position: "relative",
            width: cardW,
            maxWidth: "100%",
            background: c.surface,
            border: ink ? `3px solid ${c.ink}` : "none",
            boxShadow: ink ? `10px 10px 0 ${c.secondary}` : `0 24px 60px rgba(0,0,0,${themeId === "night" ? 0.35 : 0.08})`,
            borderRadius: 28,
            padding: portrait ? `40px ${padX}px 36px` : `40px ${padX}px 30px`,
            opacity: cardIn,
            transform: `translateY(${(1 - cardIn) * 30}px) scale(${0.96 + 0.04 * cardIn})`,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
        >
          <div style={{ position: "relative" }}>
            {portrait ? null : <div
              style={{
                position: "absolute",
                [startSide]: axisRight - padX - 3,
                top: 6,
                bottom: 6,
                width: 4,
                borderRadius: 2,
                background: c.ink,
                opacity: 0.55 * axisIn,
                transformOrigin: "top center",
                transform: `scaleY(${axisIn})`,
              }}
            />}
            {rowsEl}
          </div>
          {source ? (
            <div
              style={{
                marginTop: portrait ? 18 : 12,
                paddingTop: portrait ? 18 : 14,
                borderTop: `2px solid ${c.inkSoft}33`,
                fontSize: Math.round(refSize * 0.7),
                color: c.inkSoft,
                opacity: sourceIn * 0.9,
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 5, background: c.primary, flexShrink: 0 }} />
              <span>{source}</span>
            </div>
          ) : null}
        </div>
      </div>
    </SceneShell>
  );
};

/** محتوى تجريبي لمعاينة القالب. */
export const chartSample: Omit<ChartSceneProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 3 · السبب الأعمق",
  title: "أين يذهب يومنا؟",
  data: "الهاتف: 4\nالعمل المؤجَّل: 1\nالقراءة: ٠٫٥\nالرياضة: 0.3",
  unit: "ساعات",
  highlight: "الهاتف",
  source: "أرقام توضيحية للمعاينة",
  narration: "ساعات على الهاتف، ودقائق لما نعرف أنه مهم.",
};
export const chartSeconds = 8;

/** English preview sample (LTR). */
export const chartSampleEn: Omit<ChartSceneProps, "themeId" | "orientation"> = {
  eyebrow: "Chapter 3 · The deeper cause",
  title: "Where does our day go?",
  data: "Phone: 4\nPutting off work: 1.5\nReading: 0.5\nExercise: 0.3",
  unit: "hours",
  highlight: "Phone",
  source: "Illustrative numbers for preview",
  narration: "Hours on the phone, and minutes for what we know matters.",
};
