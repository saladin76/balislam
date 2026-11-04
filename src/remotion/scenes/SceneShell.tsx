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
import { ChannelLogo, useChannel } from "../../channel/context";
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
    case "girih": {
      // نقش النجمة الثمانية (بالإسلام): بلاطات خافتة تُرسم من الأطراف
      const g = 150;
      const cells: React.ReactNode[] = [];
      for (let x = g / 2, i = 0; x < w + g; x += g) for (let y = g / 2; y < h + g; y += g, i++) {
        const r = 44;
        const d = `M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y} Z M${x - r * 0.7} ${y - r * 0.7} H${x + r * 0.7} V${y + r * 0.7} H${x - r * 0.7} Z`;
        cells.push(<path key={i} d={d} fill="none" stroke={c.primary} strokeOpacity={0.09} strokeWidth={1.6} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - reveal} />);
      }
      return <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>{cells}</svg>;
    }
    case "horizon": {
      // خط الأفق بعلامات القرون (دفاتر الزمن)
      const y = h * 0.84;
      const n = 12;
      return (
        <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
          <line x1={rtl ? w * (1 - reveal) : 0} x2={rtl ? w : w * reveal} y1={y} y2={y} stroke={c.ink} strokeOpacity={0.14} strokeWidth={3} />
          {Array.from({ length: n + 1 }, (_, i) => (
            <line key={i} x1={(i / n) * w} x2={(i / n) * w} y1={y} y2={y + (i % 3 === 0 ? 22 : 12)} stroke={c.ink} strokeOpacity={0.14 * reveal} strokeWidth={3} />
          ))}
        </svg>
      );
    }
    case "ruled": {
      // ورقة مسطّرة بهامش (زبدة الكتب): الأصفر للفكرة فقط، فلا تظليل في الخلفية
      const gap = 56;
      const lines = Math.ceil(h / gap);
      const mx = rtl ? w - 96 : 96;
      return (
        <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: lines }, (_, i) => (
            <line key={i} x1={rtl ? w * (1 - reveal) : 0} x2={rtl ? w : w * reveal} y1={(i + 1) * gap} y2={(i + 1) * gap} stroke={c.ink} strokeOpacity={0.06} strokeWidth={2} />
          ))}
          <line x1={mx} x2={mx} y1={0} y2={h * reveal} stroke={c.secondary} strokeOpacity={0.25} strokeWidth={2} />
        </svg>
      );
    }
  }
};

/** ألوان «دفتر الأفق» الثابتة للغلاف والشريط */
const NB = { cover: "#4A2E1F", coverDeep: "#2E1C12", tape: "#D7372B", parchment: "#F1E4CB", sand: "#C8A15A" } as const;

/**
 * غلاف الدفتر (دفاتر الزمن): كل مشهد صفحة داخل دفتر مفتوح؛ إطار جلدي بني بزوايا داخلية مستديرة،
 * وظل خفيف على حافة الصفحة. ثابت لا يتحرك، فلا يُحسب حركة ولا يزاحم المحتوى.
 */
const NotebookCover: React.FC<{ w: number; h: number; u: number }> = ({ w, h, u }) => {
  const b = 26 * u;
  const r = 18 * u;
  const inner = `M${b + r} ${b} H${w - b - r} Q${w - b} ${b} ${w - b} ${b + r} V${h - b - r} Q${w - b} ${h - b} ${w - b - r} ${h - b} H${b + r} Q${b} ${h - b} ${b} ${h - b - r} V${b + r} Q${b} ${b} ${b + r} ${b} Z`;
  return (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <defs>
        <linearGradient id="nb-cover" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={NB.cover} />
          <stop offset="1" stopColor={NB.coverDeep} />
        </linearGradient>
      </defs>
      <path fillRule="evenodd" fill="url(#nb-cover)" d={`M0 0 H${w} V${h} H0 Z ${inner}`} />
      <path d={inner} fill="none" stroke="#000" strokeOpacity={0.28} strokeWidth={10 * u} style={{ filter: `blur(${6 * u}px)` }} />
      <path d={inner} fill="none" stroke={NB.sand} strokeOpacity={0.35} strokeWidth={1.5 * u} />
    </svg>
  );
};

/** عنوان الفصل شريطَ تاريخ أحمر معلّقًا من الحافة العليا للصفحة */
const DateTape: React.FC<{ text: string; size: number; u: number; a: number; portrait: boolean }> = ({ text, size, u, a, portrait }) => (
  <div
    style={{
      position: "absolute",
      top: (portrait ? 220 : 26) * u,
      insetInlineStart: (portrait ? 72 : 110) * u,
      background: NB.tape,
      color: NB.parchment,
      fontFamily: fontFamilies.body,
      fontWeight: 700,
      fontSize: size,
      lineHeight: 1.25,
      padding: `${14 * u}px ${26 * u}px ${22 * u}px`,
      clipPath: `polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - ${10 * u}px), 0 100%)`,
      boxShadow: "0 6px 14px rgba(0,0,0,0.25)",
      transformOrigin: "top center",
      transform: `scaleY(${0.2 + 0.8 * a})`,
      opacity: Math.min(1, a * 1.5),
    }}
  >
    {text}
  </div>
);

type ShellProps = SceneBase & {
  children: React.ReactNode;
  durationInFrames: number;
  /** لون خلفية خاص بالقالب (سبورة، مسرح…) بدل خلفية الثيم */
  background?: string;
  /** ألوان شارة عنوان الفصل على تلك الخلفية */
  eyebrowColors?: { text: string; border: string };
  captionVariant?: "pill" | "cinema";
};

/**
 * غلاف كل مشهد: الخلفية، عنوان الفصل، شريط الترجمة، والخروج الموحّد.
 * المقاسات: أفقي 1920×1080، عمودي 1080×1920 (منطقة آمنة للشورت تتجنب أسفل 22% وأعلى 12%).
 */
export const SceneShell: React.FC<ShellProps> = ({ themeId, orientation, eyebrow, narration, narrationTimings, captions = true, backdrop, motif = true, watermark = false, children, durationInFrames, background, eyebrowColors, captionVariant }) => {
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
  const notebook = useChannel().frame === "notebook";
  const u = Math.min(width, height) / 1080;

  return (
    <AbsoluteFill style={{ backgroundColor: background ?? t.colors.bg, direction: lang.dir, fontFamily: fontFamilies.body, color: t.colors.ink }}>
      {backdrop && hasElement(backdrop) ? (
        <div style={{ position: "absolute", inset: 0, opacity: fade(frame, 0, 14) }}>
          <Element id={backdrop} theme={t} width={width} height={height} />
        </div>
      ) : motif ? (
        <Motif t={t} w={width} h={height} frame={frame} rtl={lang.dir === "rtl"} />
      ) : null}
      <AbsoluteFill style={{ opacity: out }}>
        {eyebrow && notebook ? <DateTape text={eyebrow} size={eyebrowSize * 1.35 * u} u={u} a={eyebrowIn} portrait={portrait} /> : null}
        {eyebrow && !notebook ? (
          <div
            style={{
              position: "absolute",
              top: portrait ? 250 : 64,
              insetInlineStart: portrait ? 72 : 96,
              fontSize: eyebrowSize,
              fontWeight: 600,
              color: eyebrowColors?.text ?? t.colors.inkSoft,
              border: `2px solid ${eyebrowColors?.border ?? t.colors.primary}`,
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
      {notebook ? <NotebookCover w={width} h={height} u={u} /> : null}
      {captions && timings.length ? (
        <AbsoluteFill style={{ opacity: out }}>
          <CaptionBar theme={t} timings={timings} portrait={portrait} variant={captionVariant} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
