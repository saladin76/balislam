import React from "react";
import { Easing, interpolate, useVideoConfig } from "remotion";
import { usePalette, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { Element } from "../../../brand/elements/Element";
import { hasElement } from "../../../brand/elements/registry";
import type { Theme } from "../../../brand/themes";
import { SceneShell } from "./SceneShell";
import { isPerson, People } from "./People";
import { useLang } from "../../i18n/context";
import { boil, useSceneFrame, clamp } from "./motion";
import { Drawn, inkPalette, Pen } from "./SketchBoard";
import { estimateTimings, type WordTiming } from "./timing";
import { parseBeats, sentenceGroups, type Beat } from "../../plan/beats";
import { cameraAt, camTransform, fillCameraGaps, findWord, groupRanges, Highlighter, mentionsOf, pulse, Ring, spokenWords, supportsOf, type CamKey } from "./boardLayer";
import { useChannel } from "../../channel/context";
import { drawAllowed } from "../../channel/library";
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
  /** الفسفوري للفكرة فقط: الكلمة المحورية لكل جملة لحظة نطقها */
  const highlight = paper.colors.highlight;
  const onHighlight = paper.colors.onHighlight ?? paper.colors.ink;
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
  const ranges = groupRanges(groups);
  const starts: number[] = [];
  for (const r of ranges) starts.push(Math.max(hasPrev ? CAMERA + 4 : 10, (timings[r.from]?.start ?? 0) - 4));
  while (starts.length < beats.length) starts.push((starts[starts.length - 1] ?? 4) + 40);

  // الطبقة الثانية: الكلمة تُكتب لحظة نطقها، والرسمة تُرسم على طول جزء من جملتها
  const words = spokenWords(timings);
  const sentEnd = (i: number) => (i + 1 < beats.length ? (starts[i + 1] ?? durationInFrames) : durationInFrames - 30);
  const drawLen = beats.map((_, i) => Math.round(Math.min(46, Math.max(24, (sentEnd(i) - (starts[i] ?? 0)) * 0.3))));
  const labelWord = beats.map((b, i) => findWord(words, b.label, ranges[i]?.from ?? 0, ranges[i]?.to ?? Infinity));
  const labelLens = beats.map((b) => Math.max(10, Array.from(b.label).length * 1.6));
  const labelAt = beats.map((_, i) => {
    const st = starts[i] ?? 0;
    const w = labelWord[i];
    const at = w ? Math.max(st + 12, w.start - 2) : st + 14;
    // لا تتأخر الكلمة إلى ما بعد جملتها
    return Math.min(at, Math.max(st + 12, sentEnd(i) - labelLens[i]! - 14));
  });
  const markAt = beats.map((_, i) => labelAt[i]! + labelLens[i]! + 2);
  const shown = beats.map((b, i) => ({ draw: b.draw, shownAt: (starts[i] ?? 0) + drawLen[i]!, labelWord: labelWord[i]?.i }));
  const mentions = mentionsOf(words, shown);
  const ch = useChannel();
  const allow = drawAllowed({ id: ch.id, rules: { faces: ch.rules?.faces ?? false, quran: ch.rules?.quran ?? false, hadith: ch.rules?.hadith ?? false } });
  const supports = supportsOf(words, ranges.slice(0, beats.length), shown, (id) => allow(id) && hasElement(id));

  // انتقال الكاميرا: اللوحة السابقة تخرج والجديدة تدخل في اتجاه القراءة
  const cam = hasPrev ? interpolate(frame, [0, CAMERA], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 1;
  const dir = rtl ? 1 : -1;
  const curX = -dir * W * (1 - cam);
  const prevX = dir * W * cam;

  const jitter = (seed: number) => boil(frame, seed, 0.3);
  const handFont: React.CSSProperties = { fontFamily: rtl ? fontFamilies.hand : "'Caveat', cursive", fontWeight: 700, color: inkColor, whiteSpace: "nowrap", direction: lang.dir };
  const labelSize = portrait ? (beats.length >= 3 ? 68 : 82) : beats.length >= 3 ? 72 : beats.length === 2 ? 84 : 96;

  /** موضع الرسمة المساندة بجوار لقطة جملتها (نحو اللقطة التالية، تحت مسار السهم). */
  const supportPos = (slots: Slot[], i: number) => {
    const s = slots[i]!;
    const size = portrait ? s.size * 0.42 : s.size * 0.4;
    const toward = portrait ? 0 : slots.length === 1 ? (rtl ? -1 : 1) : Math.sign((slots[i + 1] ?? slots[i - 1] ?? s).cx - s.cx) || 1;
    return { x: portrait ? s.lx : s.cx + toward * (s.size / 2 + s.size * 0.05 + size / 2), y: portrait ? s.cy - s.size * 0.45 : s.cy + s.size * 0.24, size };
  };

  /** لوحة كاملة (الحالية متحركة، أو السابقة مكتملة). */
  const panel = (list: Beat[], live: boolean) => {
    const slots = layout(list.length, W, H, portrait, rtl);
    let pen: { x: number; y: number } | null = null;
    const nodes = list.map((b, i) => {
      const s = slots[i]!;
      const st = live ? (starts[i] ?? 0) : -999;
      const drawT = interpolate(frame, [st, st + (drawLen[i] ?? 22)], [0, 1], clamp);
      const labelLen = Math.max(10, Array.from(b.label).length * 1.6);
      const la = live ? (labelAt[i] ?? st + 14) : -999;
      const labelT = interpolate(frame, [la, la + labelLen], [0, 1], clamp);
      const ulT = interpolate(frame, [la + labelLen, la + labelLen + 10], [0, 1], clamp);
      const mk = live ? (markAt[i] ?? 0) : -999;
      const markT = interpolate(frame, [mk, mk + 12], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
      const myMentions = live ? mentions.filter((m) => m.slot === i) : [];
      const bump = myMentions.reduce((a, m) => Math.max(a, pulse(frame, m.start - 2, 18)), 0);
      const ringT = myMentions.reduce((a, m) => Math.max(a, interpolate(frame, [m.start - 2, m.start + 14], [0, 1], clamp) * interpolate(frame, [m.start + 40, m.start + 52], [1, 0], clamp)), 0);
      if (live && drawT > 0 && drawT < 1) pen = { x: rtl ? s.cx + s.size / 2 - s.size * drawT : s.cx - s.size / 2 + s.size * drawT, y: s.cy - s.size * 0.3 + s.size * 0.6 * (0.5 + 0.5 * Math.sin(frame * 1.7)) };
      else if (live && labelT > 0 && labelT < 1) pen = { x: s.lx + (rtl ? 1 : -1) * (b.label.length * labelSize * 0.21) * (1 - 2 * labelT), y: s.ly + labelSize * 0.4 };
      const reveal: React.CSSProperties = { clipPath: rtl ? `inset(-30% 0 -30% ${(1 - drawT) * 100}%)` : `inset(-30% ${(1 - drawT) * 100}% -30% 0)` };
      const labelW = Math.max(160, Array.from(b.label).length * labelSize * 0.5 + 40);
      return (
        <React.Fragment key={i}>
          {ringT > 0 ? (
            <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
              <Ring cx={s.cx} cy={s.cy} rx={s.size * 0.64} ry={s.size * 0.6} t={Math.min(1, ringT * 1.4)} fadeOut={Math.min(1, ringT * 3)} color={inkColor} width={6} />
            </svg>
          ) : null}
          <div style={{ position: "absolute", left: s.cx - s.size / 2, top: s.cy - s.size / 2, width: s.size, height: s.size, display: "flex", alignItems: "flex-end", justifyContent: "center", ...reveal, transform: `${jitter(i * 7 + 1)} scale(${1 + 0.08 * bump})`, opacity: drawT > 0 ? 1 : 0 }}>
            {isPerson(b.draw) ? <People draw={b.draw} t={charTheme} height={s.size * 1.05} gap={s.size * 0.08} /> : hasElement(b.draw) ? <Element id={b.draw} theme={paper} size={s.size} palette={elPal} /> : null}
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
              <Highlighter width={labelW * 0.86} height={labelSize * 0.62} t={markT} color={highlight} rtl={rtl} style={{ left: labelW * 0.07, top: labelSize * 0.82 }} />
              <span style={{ ...handFont, position: "relative", fontSize: labelSize, color: chalk && markT > 0.4 ? onHighlight : i === list.length - 1 ? accent : inkColor, display: "inline-block", transform: jitter(i * 7 + 3) }}>{b.label}</span>
              <svg width={labelW} height={24} viewBox={`0 0 ${labelW} 24`} style={{ display: "block", margin: "-6px auto 0", overflow: "visible" }}>
                <Drawn d={`M${labelW * 0.2} 10 Q ${labelW / 2} 20 ${labelW * 0.8} 6`} t={ulT} color={accent} width={5} />
              </svg>
            </div>
          ) : null}
          {live
            ? supports
                .filter((x) => x.slot === i)
                .map((x, k) => {
                  const { x: px, y: py, size: sz } = supportPos(slots, i);
                  const t = interpolate(frame, [x.start, x.start + 20], [0, 1], clamp);
                  return (
                    <div key={`sup${k}`} style={{ position: "absolute", left: px - sz / 2, top: py - sz / 2, width: sz, height: sz, opacity: t > 0 ? 1 : 0, clipPath: rtl ? `inset(-20% 0 -20% ${(1 - t) * 100}%)` : `inset(-20% ${(1 - t) * 100}% -20% 0)`, transform: jitter(40 + i * 3 + k) }}>
                      <Element id={x.draw} theme={paper} size={sz} palette={elPal} />
                    </div>
                  );
                })
            : null}
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

  // الكاميرا تتبع القلم: تقترب من لقطة الجملة الحالية، وتنتقل مع الجملة التالية، ثم تبتعد لترى اللوحة كلها قبل المشهد التالي
  const slots = layout(beats.length, W, H, portrait, rtl);
  const focus = slots.map((sl) => {
    const top = sl.cy - sl.size / 2;
    const bottom = sl.align === "side" ? sl.cy + sl.size / 2 : sl.ly + labelSize * 0.7;
    const left = sl.align === "side" ? Math.min(sl.cx, sl.lx) - sl.size / 2 : sl.cx - sl.size / 2;
    const right = sl.align === "side" ? Math.max(sl.cx, sl.lx) + sl.size / 2 : sl.cx + sl.size / 2;
    const z = Math.max(1.12, Math.min(1.5, (H * (portrait ? 0.5 : 0.62)) / (bottom - top), (W * 0.8) / (right - left)));
    // مركز الإطار المرئي فوق شريط الترجمة قليلًا
    return { x: (left + right) / 2, y: (top + bottom) / 2 + (H * 0.06) / z, z };
  });
  const overview = { x: W / 2, y: H / 2, z: 1 };
  const lastDone = (markAt[beats.length - 1] ?? 0) + 16;
  const pullAt = Math.max(lastDone, durationInFrames - 46);
  const camKeys: CamKey[] = [{ ...overview, at: 0, dur: 0 }];
  focus.forEach((f, i) => {
    camKeys.push({ ...f, at: (starts[i] ?? 0) - (i === 0 ? 8 : 10), dur: i === 0 ? 18 : 20 });
    // لحظة نطق الكلمة المحورية: الكاميرا تقترب منها قليلًا
    const sl = slots[i]!;
    camKeys.push({ x: f.x + (sl.lx - f.x) * 0.2, y: f.y + (sl.ly - f.y) * 0.22, z: f.z * 1.12, at: (labelAt[i] ?? 0) - 2, dur: 16 });
    // الرسمة المساندة لحظة نطقها: الإطار يتسع ليضمها
    for (const sup of supports.filter((x) => x.slot === i)) {
      const p = supportPos(slots, i);
      camKeys.push({ x: (f.x + p.x) / 2, y: f.y, z: Math.max(1, f.z * 0.9), at: sup.start - 4, dur: 16 });
    }
  });
  const events = [...starts.slice(0, beats.length), ...labelAt, ...markAt, ...supports.map((x) => x.start), ...mentions.map((m) => m.start)];
  const focusAt = (at: number) => focus[Math.max(0, starts.slice(0, beats.length).filter((st) => st <= at).length - 1)] ?? overview;
  const filled = fillCameraGaps(camKeys, events, pullAt, focusAt, overview, portrait ? 9999 : 30, 46);
  camKeys.length = 0;
  camKeys.push(...filled);
  if (beats.length && pullAt + 18 < durationInFrames) camKeys.push({ ...overview, at: pullAt, dur: 18 });
  const view = beats.length ? cameraAt(camKeys, frame) : overview;
  const camStyle = camTransform(view, W, H);
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
        <div style={{ position: "absolute", inset: 0, ...camStyle }}>
          <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>{cur.arrows}</svg>
          {cur.nodes}
          {cur.pen ? <Pen x={cur.pen.x} y={cur.pen.y} color={chalk ? paper.colors.surface : paper.colors.ink} tip={accent} show={penShow} flip={rtl} /> : null}
        </div>
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
