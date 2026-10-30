import React from "react";
import { interpolate, useVideoConfig } from "remotion";
import { usePalette, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { Element } from "../../../brand/elements/Element";
import { hasElement } from "../../../brand/elements/registry";
import type { ElementPalette } from "../../../brand/elements/types";
import { SceneShell } from "./SceneShell";
import { useLang } from "../../i18n/context";
import { boil, fade } from "./motion";
import { useSceneFrame } from "./motion";
import type { SceneBase, StringFields } from "./types";

/**
 * «السبورة»: شرح مرسوم باليد كأن قلمًا يرسم أمامك. العنوان يُكتب بخط اليد ويُخط تحته،
 * ثم يُرسم العنصر، ثم سهم، ثم النقاط واحدة بعد الأخرى بعلامة صح.
 * لوحتان: «سبورة بيضاء» (حبر أسود وأخضر) و«سبورة خضراء» (طباشير).
 */
export type SketchBoardProps = SceneBase & StringFields<"title" | "items" | "element" | "board" | "keyword">;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** لوحة «حبر على سبورة»: حدود بلون القلم، وتعبئة بلون السبورة، ولمسة اللون الثاني للتمييز. */
const inkPalette = (base: ElementPalette, board: string, ink: string, accent: string): ElementPalette => ({
  ...base,
  style: "line",
  stroke: ink,
  sw: 3.2,
  line: ink,
  lw: 2.4,
  edge: ink,
  main: board,
  second: board,
  accent,
  light: board,
  dark: ink,
  skin: board,
  metal: board,
  wood: board,
  green: board,
  water: board,
  shadow: "transparent",
  bg: board,
  surface: board,
  ink,
});

/** رأس قلم صغير يتبع خط الرسم. */
const Pen: React.FC<{ x: number; y: number; color: string; tip: string; show: number; flip: boolean }> = ({ x, y, color, tip, show, flip }) => (
  <svg width={150} height={150} viewBox="0 0 150 150" style={{ position: "absolute", left: x - 8, top: y - 142, opacity: show, transform: flip ? "scaleX(-1)" : undefined, transformOrigin: "8px 142px", overflow: "visible" }}>
    <g transform="rotate(35 8 142)">
      <rect x={-6} y={6} width={28} height={110} rx={8} fill={color} />
      <rect x={-6} y={6} width={28} height={26} rx={6} fill={tip} />
      <path d="M-6 116 L22 116 L12 140 L4 140 Z" fill={color} />
      <path d="M4 140 L12 140 L8 150 Z" fill={tip} />
    </g>
  </svg>
);

/** مسار يُرسم تدريجيًا (0 → 1). */
const Drawn: React.FC<{ d: string; t: number; color: string; width: number; opacity?: number }> = ({ d, t, color, width, opacity = 1 }) => (
  <path d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" opacity={t > 0 ? opacity : 0} />
);

export const SketchBoard: React.FC<SketchBoardProps> = (props) => {
  const { orientation, title = "", element = "lightbulb", board = "white", keyword = "" } = props;
  const frame = useSceneFrame();
  const { width: W, height: H, durationInFrames } = useVideoConfig();
  const lang = useLang();
  const rtl = lang.dir === "rtl";
  const portrait = orientation === "portrait";

  // ألوان السبورة من هوية القناة (ثيم «حبر وورق»): أبيض بحبر وأخضر، أو أخضر بطباشير
  const paper = useTheme("paper");
  const pal = usePalette("paper");
  const chalk = board === "green";
  const boardColor = chalk ? paper.colors.primary : paper.colors.surface;
  const inkColor = chalk ? paper.colors.surface : paper.colors.ink;
  const accent = chalk ? paper.colors.highlight : paper.colors.primary;
  const elPal = inkPalette(pal, boardColor, inkColor, accent);

  const items = (props.items ?? "")
    .split(/\n|؛/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 4);

  // المواضع (تنعكس في العربية)
  const X = (f: number) => (rtl ? W * (1 - f) : W * f);
  const titleTop = portrait ? 330 : 110;
  const titleSize = Math.round((portrait ? 92 : 96) * (title.length > 28 ? Math.max(0.65, Math.sqrt(28 / title.length)) : 1));
  const elSize = portrait ? (items.length > 2 ? 400 : 470) : 460;
  const elCx = portrait ? W / 2 : X(0.27);
  const elCy = portrait ? (items.length > 2 ? 700 : 740) : 580;
  const itemSize = portrait ? (items.length > 3 ? 58 : 66) : items.length > 3 ? 58 : 66;
  const itemsTop = portrait ? elCy + elSize / 2 + 30 : 330;
  const itemGap = itemSize * 1.8;

  // التوقيت: عنوان ← خط تحته ← رسم العنصر ← سهم ← النقاط
  const titleT = interpolate(frame, [4, 4 + Math.max(18, title.length * 1.1)], [0, 1], clamp);
  const underlineT = interpolate(frame, [4 + Math.max(18, title.length * 1.1), 18 + Math.max(18, title.length * 1.1)], [0, 1], clamp);
  const drawFrom = 14 + Math.max(18, title.length * 1.1);
  const elT = interpolate(frame, [drawFrom, drawFrom + 36], [0, 1], clamp);
  const arrowFrom = drawFrom + 30;
  const arrowT = interpolate(frame, [arrowFrom, arrowFrom + 14], [0, 1], clamp);
  const itemFrom = (i: number) => arrowFrom + (portrait ? 4 : 14) + i * 26;
  const itemT = (i: number) => interpolate(frame, [itemFrom(i), itemFrom(i) + Math.max(14, (items[i]?.length ?? 0) * 0.9)], [0, 1], clamp);
  const lastEnd = items.length ? itemFrom(items.length - 1) + Math.max(14, (items[items.length - 1]?.length ?? 0) * 0.9) : drawFrom + 36;

  // موضع القلم: يتبع آخر شيء يُرسم الآن
  const wipeX = (left: number, right: number, t: number) => (rtl ? right - (right - left) * t : left + (right - left) * t);
  const scribbleY = (top: number, h: number) => top + h * (0.5 + 0.35 * Math.sin(frame * 1.7));
  let pen: { x: number; y: number } | null = null;
  const titleBox = { left: portrait ? 60 : 160, right: W - (portrait ? 60 : 160), top: titleTop, h: titleSize * 1.4 };
  if (titleT > 0 && titleT < 1) pen = { x: wipeX(titleBox.left + 80, titleBox.right - 80, titleT), y: scribbleY(titleBox.top, titleBox.h) };
  const elBox = { left: elCx - elSize / 2, right: elCx + elSize / 2, top: elCy - elSize / 2 };
  if (elT > 0 && elT < 1) pen = { x: wipeX(elBox.left, elBox.right, elT), y: scribbleY(elBox.top + elSize * 0.1, elSize * 0.8) };
  const itemsLeft = portrait ? 90 : rtl ? 120 : W * 0.5;
  const itemsRight = portrait ? W - 90 : rtl ? W * 0.5 : W - 120;
  items.forEach((it, i) => {
    const t = itemT(i);
    if (t > 0 && t < 1) {
      const est = Math.min(itemsRight - itemsLeft - 90, it.length * itemSize * 0.48);
      const start = rtl ? itemsRight - 90 : itemsLeft + 90;
      pen = { x: rtl ? start - est * t : start + est * t, y: itemsTop + i * itemGap + itemSize * 0.7 };
    }
  });
  const penShow = frame < lastEnd + 6 ? 1 : interpolate(frame, [lastEnd + 6, lastEnd + 16], [1, 0], clamp);

  /** كشف من بداية السطر (قص) كأن القلم يكتب. */
  const reveal = (t: number): React.CSSProperties => ({
    clipPath: rtl ? `inset(-20% 0 -20% ${(1 - t) * 100}%)` : `inset(-20% ${(1 - t) * 100}% -20% 0)`,
  });

  // سطر تحت العنوان: خط يد متموج بلون التمييز
  const ulW = Math.min(W - 200, title.length * titleSize * 0.42 + 80);
  const ulX0 = W / 2 - ulW / 2;
  const ulY = titleTop + titleSize * 1.38;
  const underline = `M${rtl ? ulX0 + ulW : ulX0} ${ulY} Q ${W / 2} ${ulY + 14} ${rtl ? ulX0 : ulX0 + ulW} ${ulY - 4}`;

  // السهم من العنصر إلى النقاط (أفقي في الأفقي، عمودي قصير في العمودي)
  const arrow = portrait
    ? `M${W / 2} ${elCy + elSize / 2 - 30} q 18 14 0 34`
    : rtl
      ? `M${elBox.left - 10} ${elCy - 40} C ${elBox.left - 120} ${elCy - 120}, ${elBox.left - 200} ${elCy - 60}, ${itemsRight + 30} ${itemsTop + 20}`
      : `M${elBox.right + 10} ${elCy - 40} C ${elBox.right + 120} ${elCy - 120}, ${elBox.right + 200} ${elCy - 60}, ${itemsLeft - 30} ${itemsTop + 20}`;
  const arrowEnd = portrait ? { x: W / 2, y: elCy + elSize / 2 + 4 } : { x: rtl ? itemsRight + 30 : itemsLeft - 30, y: itemsTop + 20 };
  const head = `M${arrowEnd.x - (portrait ? 14 : rtl ? -16 : 16)} ${arrowEnd.y - (portrait ? 16 : 14)} L${arrowEnd.x} ${arrowEnd.y} L${arrowEnd.x - (portrait ? -14 : rtl ? -16 : 16)} ${arrowEnd.y + (portrait ? -16 : 14)}`;

  // الكلمة المحوّطة داخل العنوان
  const kwIndex = keyword ? title.indexOf(keyword) : -1;
  const titleParts = kwIndex >= 0 ? [title.slice(0, kwIndex), keyword, title.slice(kwIndex + keyword.length)] : [title];
  const circleT = interpolate(frame, [lastEnd + 2, lastEnd + 18], [0, 1], clamp);

  // العربية بخط الرقعة، واللاتينية بخط Caveat (خط الرقعة يحمل حروفًا لاتينية لا تشبه خط اليد)
  const handFont: React.CSSProperties = { fontFamily: rtl ? fontFamilies.hand : "'Caveat', cursive", fontWeight: 700, color: inkColor, direction: lang.dir, whiteSpace: "nowrap" };
  const handScale = rtl ? 1.12 : 1.08;
  /** النقطة الطويلة تصغر لتبقى في سطر واحد قدر الإمكان (ثم تلتف بمسافة كافية). */
  const fitItem = (it: string) => {
    const avail = itemsRight - itemsLeft - 90;
    const est = it.length * itemSize * handScale * (rtl ? 0.42 : 0.4);
    return est > avail ? Math.max(0.72, avail / est) : 1;
  };
  const jitter = (seed: number) => boil(frame, seed, 0.35);

  return (
    <SceneShell
      {...props}
      themeId="paper"
      motif={false}
      background={boardColor}
      eyebrowColors={chalk ? { text: paper.colors.surface, border: paper.colors.highlight } : undefined}
      durationInFrames={durationInFrames}
    >
      {/* إطار السبورة الخفيف */}
      <div style={{ position: "absolute", inset: portrait ? 28 : 22, border: `3px solid ${inkColor}`, borderRadius: 26, opacity: chalk ? 0.12 : 0.07 }} />
      {chalk ? <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 40%, ${paper.colors.surface}14, transparent 70%)` }} /> : null}

      {/* العنوان بخط اليد */}
      {title ? (
        <div style={{ position: "absolute", top: titleTop, left: titleBox.left, right: W - titleBox.right, textAlign: "center", ...reveal(titleT) }}>
          <span style={{ ...handFont, fontSize: Math.round(titleSize * handScale), lineHeight: 1.3, whiteSpace: "normal", display: "inline-block", transform: jitter(1) }}>
            {titleParts.map((p, i) => (
              <span key={i} style={i === 1 ? { position: "relative", color: accent } : undefined}>
                {p}
                {i === 1 ? (
                  <svg viewBox="0 0 100 50" preserveAspectRatio="none" style={{ position: "absolute", left: "-14%", top: "-12%", width: "128%", height: "124%", overflow: "visible" }}>
                    <Drawn d="M 96 22 C 98 6, 70 2, 50 3 C 22 4, 2 12, 3 27 C 4 42, 30 48, 55 47 C 82 46, 99 36, 95 18 C 93 10, 84 6, 76 5" t={circleT} color={accent} width={2.2} />
                  </svg>
                ) : null}
              </span>
            ))}
          </span>
        </div>
      ) : null}

      <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {title ? <Drawn d={underline} t={underlineT} color={accent} width={portrait ? 7 : 6} /> : null}
        {items.length ? (
          <>
            <Drawn d={arrow} t={arrowT} color={inkColor} width={5} />
            <Drawn d={head} t={interpolate(arrowT, [0.8, 1], [0, 1], clamp)} color={inkColor} width={5} />
          </>
        ) : null}
      </svg>

      {/* العنصر يُرسم أمامك */}
      {hasElement(element) ? (
        <div style={{ position: "absolute", left: elBox.left, top: elBox.top, ...reveal(elT), transform: jitter(3) }}>
          <Element id={element} theme={paper} size={elSize} palette={elPal} />
        </div>
      ) : null}

      {/* النقاط بعلامة صح */}
      {items.map((it, i) => {
        const t = itemT(i);
        const y = itemsTop + i * itemGap;
        const tick = interpolate(frame, [itemFrom(i) - 6, itemFrom(i) + 4], [0, 1], clamp);
        return (
          <div key={i} style={{ position: "absolute", top: y, left: itemsLeft, width: itemsRight - itemsLeft, display: "flex", alignItems: "center", gap: 22, direction: lang.dir }}>
            <svg width={64} height={64} viewBox="0 0 64 64" style={{ flex: "none" }}>
              <Drawn d="M10 34 L26 50 L56 12" t={tick} color={accent} width={7} />
            </svg>
            <span style={{ ...handFont, fontSize: Math.round(itemSize * handScale * fitItem(it)), lineHeight: 1.5, whiteSpace: "normal", ...reveal(t), transform: jitter(10 + i) }}>{it}</span>
          </div>
        );
      })}

      {pen ? <Pen x={(pen as { x: number }).x} y={(pen as { y: number }).y} color={chalk ? paper.colors.surface : paper.colors.ink} tip={accent} show={penShow} flip={rtl} /> : null}
      {/* لمسة ظهور أولى للسبورة */}
      <div style={{ position: "absolute", inset: 0, background: boardColor, opacity: 1 - fade(frame, 0, 8), pointerEvents: "none" }} />
    </SceneShell>
  );
};

export const sketchBoardSample: Omit<SketchBoardProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 5 · كيف نبدأ",
  title: "قاعدة الدقائق الخمس",
  keyword: "الخمس",
  element: "timer",
  items: "اختر مهمة واحدة\nاعمل خمس دقائق فقط\nتوقف إن شئت… غالبًا ستكمل",
  board: "white",
  narration: "ابدأ بخمس دقائق فقط، فالبداية هي أصعب جزء.",
};
export const sketchBoardSampleEn: Omit<SketchBoardProps, "themeId" | "orientation"> = {
  eyebrow: "Chapter 5 · How to start",
  title: "The five-minute rule",
  keyword: "five-minute",
  element: "timer",
  items: "Pick one task\nWork for five minutes\nStop if you like… you'll probably continue",
  board: "green",
  narration: "Start with just five minutes; starting is the hardest part.",
};
export const sketchBoardSeconds = 7;
