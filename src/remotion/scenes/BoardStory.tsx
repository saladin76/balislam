import React from "react";
import { Easing, interpolate, useVideoConfig } from "remotion";
import { usePalette, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { Element } from "../../../brand/elements/Element";
import { hasElement } from "../../../brand/elements/registry";
import type { Theme } from "../../../brand/themes";
import { Character, type CharacterPose } from "../../../characters/Character";
import { SceneShell } from "./SceneShell";
import { useLang } from "../../i18n/context";
import { boil, useSceneFrame } from "./motion";
import { Drawn, inkPalette, Pen } from "./SketchBoard";
import { estimateTimings, type WordTiming } from "./timing";
import { parseBeats, sentenceGroups, type Beat } from "../../plan/beats";
import type { SceneBase, StringFields } from "./types";

/**
 * «السبورة المتصلة»: الحلقة كلها لوحة واحدة طويلة. كل جملة تُرسم وقت قولها (رسمة + كلمة بخط اليد)،
 * والمشهد التالي يبدأ بانتقال الكاميرا إلى المساحة الفارغة التالية من اللوحة نفسها.
 * لا نصوص طويلة على الشاشة: الصورة تشرح والصوت يتكلم.
 */
export type BoardStoryProps = SceneBase &
  StringFields<"beats" | "board" | "prevBeats"> & {
    /** للانتقال المتصل: لقطات المشهد السابق إن كان سبورة أيضًا */
    prevNarration?: string;
  };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const CAMERA = 18;

type Slot = { cx: number; cy: number; size: number; lx: number; ly: number; align: "center" | "side" };

/** مواضع اللقطات في اللوحة حسب عددها والمقاس. */
const layout = (n: number, W: number, H: number, portrait: boolean, rtl: boolean): Slot[] => {
  const X = (f: number) => (rtl ? W * (1 - f) : W * f);
  if (portrait) {
    if (n <= 1) return [{ cx: W / 2, cy: 720, size: 500, lx: W / 2, ly: 1060, align: "center" }];
    const rows = n === 2 ? [600, 1030] : [500, 800, 1100];
    const size = n === 2 ? 340 : 250;
    return rows.slice(0, n).map((cy, i) => {
      const left = i % 2 === 0;
      return { cx: X(left ? 0.3 : 0.7), cy, size, lx: X(left ? 0.72 : 0.28), ly: cy, align: "side" };
    });
  }
  if (n <= 1) return [{ cx: W / 2, cy: 450, size: 560, lx: W / 2, ly: 820, align: "center" }];
  if (n === 2) return [0.28, 0.72].map((f) => ({ cx: X(f), cy: 440, size: 470, lx: X(f), ly: 780, align: "center" as const }));
  return [0.18, 0.5, 0.82].map((f, i) => ({ cx: X(f), cy: i === 1 ? 470 : 410, size: 380, lx: X(f), ly: (i === 1 ? 470 : 410) + 260, align: "center" as const }));
};

/** شخصية أو شخصان بخط القلم. */
const People: React.FC<{ draw: string; t: Theme; size: number }> = ({ draw, t, size }) => {
  const pose = (draw.split(":")[1] || "stand") as CharacterPose;
  const h = size * 1.05;
  if (draw === "people")
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: size * 0.08 }}>
        <Character theme={t} variant="narrator-m" pose="stand" height={h * 0.92} />
        <div style={{ transform: "scaleX(-1)" }}>
          <Character theme={t} variant="narrator-f" pose="stand" height={h * 0.92} />
        </div>
      </div>
    );
  return <Character theme={t} variant="narrator-m" pose={pose} height={h} />;
};

export const BoardStory: React.FC<BoardStoryProps> = (props) => {
  const { orientation, narration = "", narrationTimings, board = "white" } = props;
  const frame = useSceneFrame();
  const { width: W, height: H, durationInFrames } = useVideoConfig();
  const lang = useLang();
  const rtl = lang.dir === "rtl";
  const portrait = orientation === "portrait";

  const paper = useTheme("paper");
  const pal = usePalette("paper");
  const chalk = board === "green";
  const boardColor = chalk ? paper.colors.primary : paper.colors.surface;
  const inkColor = chalk ? paper.colors.surface : paper.colors.ink;
  const accent = chalk ? paper.colors.highlight : paper.colors.primary;
  const elPal = inkPalette(pal, boardColor, inkColor, accent);
  const charTheme: Theme = {
    ...paper,
    colors: { ...paper.colors, surface: boardColor, inkSoft: inkColor },
    character: { ...paper.character, style: "line", outline: inkColor, skin: [boardColor, boardColor], garments: [boardColor, boardColor, boardColor, boardColor, boardColor], cap: accent },
  };

  const beats: Beat[] = parseBeats(props.beats ?? "").slice(0, 3);
  const hasPrev = Boolean(props.prevBeats);
  const prevBeats: Beat[] = parseBeats(props.prevBeats ?? "").slice(0, 3);

  // متى تُرسم كل لقطة: عند أول كلمة من جملتها
  const timings: WordTiming[] = narration ? (narrationTimings ?? estimateTimings(narration, 6, durationInFrames - 12)) : [];
  const groups = sentenceGroups(narration, Math.max(1, beats.length));
  const starts: number[] = [];
  let wi = 0;
  for (const g of groups) {
    starts.push(Math.max(hasPrev ? CAMERA - 2 : 4, (timings[wi]?.start ?? 0) - 4));
    wi += g.split(/\s+/).filter(Boolean).length;
  }
  while (starts.length < beats.length) starts.push((starts[starts.length - 1] ?? 4) + 40);

  // انتقال الكاميرا: اللوحة السابقة تخرج والجديدة تدخل في اتجاه القراءة
  const cam = hasPrev ? interpolate(frame, [0, CAMERA], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 1;
  const dir = rtl ? 1 : -1;
  const curX = -dir * W * (1 - cam);
  const prevX = dir * W * cam;

  const jitter = (seed: number) => boil(frame, seed, 0.3);
  const handFont: React.CSSProperties = { fontFamily: rtl ? fontFamilies.hand : "'Caveat', cursive", fontWeight: 700, color: inkColor, whiteSpace: "nowrap", direction: lang.dir };
  const labelSize = portrait ? (beats.length >= 3 ? 68 : 82) : beats.length >= 3 ? 72 : beats.length === 2 ? 84 : 96;

  /** لوحة كاملة (الحالية متحركة، أو السابقة مكتملة). */
  const panel = (list: Beat[], live: boolean) => {
    const slots = layout(list.length, W, H, portrait, rtl);
    let pen: { x: number; y: number } | null = null;
    const nodes = list.map((b, i) => {
      const s = slots[i]!;
      const st = live ? (starts[i] ?? 0) : -999;
      const drawT = interpolate(frame, [st, st + 22], [0, 1], clamp);
      const labelLen = Math.max(10, Array.from(b.label).length * 1.6);
      const labelT = interpolate(frame, [st + 14, st + 14 + labelLen], [0, 1], clamp);
      const ulT = interpolate(frame, [st + 14 + labelLen, st + 24 + labelLen], [0, 1], clamp);
      if (live && drawT > 0 && drawT < 1) pen = { x: rtl ? s.cx + s.size / 2 - s.size * drawT : s.cx - s.size / 2 + s.size * drawT, y: s.cy - s.size * 0.3 + s.size * 0.6 * (0.5 + 0.5 * Math.sin(frame * 1.7)) };
      else if (live && labelT > 0 && labelT < 1) pen = { x: s.lx + (rtl ? 1 : -1) * (b.label.length * labelSize * 0.21) * (1 - 2 * labelT), y: s.ly + labelSize * 0.4 };
      const reveal: React.CSSProperties = { clipPath: rtl ? `inset(-30% 0 -30% ${(1 - drawT) * 100}%)` : `inset(-30% ${(1 - drawT) * 100}% -30% 0)` };
      const isPerson = b.draw === "person" || b.draw === "people" || b.draw.startsWith("person:");
      const labelW = Math.max(160, Array.from(b.label).length * labelSize * 0.5 + 40);
      return (
        <React.Fragment key={i}>
          <div style={{ position: "absolute", left: s.cx - s.size / 2, top: s.cy - s.size / 2, width: s.size, height: s.size, display: "flex", alignItems: "flex-end", justifyContent: "center", ...reveal, transform: jitter(i * 7 + 1), opacity: drawT > 0 ? 1 : 0 }}>
            {isPerson ? <People draw={b.draw} t={charTheme} size={s.size} /> : hasElement(b.draw) ? <Element id={b.draw} theme={paper} size={s.size} palette={elPal} /> : null}
          </div>
          {b.label ? (
            <div
              style={{
                position: "absolute",
                left: s.lx - labelW / 2,
                width: labelW,
                top: s.ly - labelSize * 0.55,
                textAlign: "center",
                clipPath: rtl ? `inset(-40% 0 -40% ${(1 - labelT) * 100}%)` : `inset(-40% ${(1 - labelT) * 100}% -40% 0)`,
              }}
            >
              <span style={{ ...handFont, fontSize: labelSize, color: i === list.length - 1 ? accent : inkColor, display: "inline-block", transform: jitter(i * 7 + 3) }}>{b.label}</span>
              <svg width={labelW} height={24} viewBox={`0 0 ${labelW} 24`} style={{ display: "block", margin: "-6px auto 0", overflow: "visible" }}>
                <Drawn d={`M${labelW * 0.2} 10 Q ${labelW / 2} 20 ${labelW * 0.8} 6`} t={ulT} color={accent} width={5} />
              </svg>
            </div>
          ) : null}
        </React.Fragment>
      );
    });
    // أسهم يدوية بين اللقطات المتتالية
    const arrows = slots.slice(1, list.length).map((s, k) => {
      const a = slots[k]!;
      const st = live ? (starts[k + 1] ?? 0) - 10 : -999;
      const t = interpolate(frame, [st, st + 12], [0, 1], clamp);
      const sx = portrait ? a.cx : a.cx + (s.cx > a.cx ? 1 : -1) * a.size * 0.5;
      const sy = portrait ? a.cy + a.size * 0.5 : a.cy - a.size * 0.15;
      const ex = portrait ? s.cx : s.cx - (s.cx > a.cx ? 1 : -1) * s.size * 0.5;
      const ey = portrait ? s.cy - s.size * 0.55 : s.cy - s.size * 0.15;
      const mx = (sx + ex) / 2;
      const my = Math.min(sy, ey) - (portrait ? -20 : 70);
      const ang = Math.atan2(ey - my, ex - mx);
      const hx = (d: number) => ex - 22 * Math.cos(ang + d);
      const hy = (d: number) => ey - 22 * Math.sin(ang + d);
      return (
        <g key={k}>
          <Drawn d={`M${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`} t={t} color={inkColor} width={4.5} opacity={0.85} />
          <Drawn d={`M${hx(0.5)} ${hy(0.5)} L${ex} ${ey} L${hx(-0.5)} ${hy(-0.5)}`} t={interpolate(t, [0.85, 1], [0, 1], clamp)} color={inkColor} width={4.5} opacity={0.85} />
        </g>
      );
    });
    return { nodes, arrows, pen: pen as { x: number; y: number } | null };
  };

  const cur = panel(beats, true);
  const prev = hasPrev && cam < 1 ? panel(prevBeats, false) : null;
  const lastStart = starts[beats.length - 1] ?? 0;
  const penShow = interpolate(frame, [lastStart + 60, lastStart + 72], [1, 0], clamp);

  // نقاط السبورة الخفيفة تتحرك مع الكاميرا (إحساس اللوحة الواحدة)
  const gridShift = ((hasPrev ? dir * W * cam : 0) % 48 + 48) % 48;

  return (
    <SceneShell
      {...props}
      themeId="paper"
      motif={false}
      background={boardColor}
      eyebrowColors={chalk ? { text: paper.colors.surface, border: paper.colors.highlight } : undefined}
      durationInFrames={durationInFrames}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: chalk ? 0.1 : 0.07,
          backgroundImage: `radial-gradient(${inkColor} 1.6px, transparent 1.8px)`,
          backgroundSize: "48px 48px",
          backgroundPosition: `${gridShift}px 0`,
        }}
      />
      {prev ? (
        <div style={{ position: "absolute", inset: 0, transform: `translateX(${prevX}px)` }}>
          <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>{prev.arrows}</svg>
          {prev.nodes}
        </div>
      ) : null}
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${curX}px)` }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>{cur.arrows}</svg>
        {cur.nodes}
        {cur.pen ? <Pen x={cur.pen.x} y={cur.pen.y} color={chalk ? paper.colors.surface : paper.colors.ink} tip={accent} show={penShow} flip={rtl} /> : null}
      </div>
    </SceneShell>
  );
};

export const boardStorySample: Omit<BoardStoryProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 1 · هل ترى الحقيقة فعلًا؟",
  narration: "تخيل شخصين يشاهدان الموقف نفسه. الأول يراه ظلمًا، والثاني يراه عدلًا. كل واحد منهما مقتنع أنه يرى الحقيقة.",
  beats: "people | الموقف نفسه\nscale-brass-tilted | ظلم؟ عدل؟\nmagnifier-brass | الحقيقة",
  board: "white",
};
export const boardStorySampleEn: Omit<BoardStoryProps, "themeId" | "orientation"> = {
  eyebrow: "Chapter 1 · Do you really see the truth?",
  narration: "Imagine two people watching the same situation. One sees injustice, the other sees justice. Each is sure he sees the truth.",
  beats: "people | same situation\nscale-brass-tilted | unjust? just?\nmagnifier-brass | the truth",
  board: "green",
};
export const boardStorySeconds = 9;
