import React from "react";
import { Easing, interpolate } from "remotion";
import { normalizeArabic } from "../../script/quranMeta";
import { SACRED_NEIGHBORS, wordElement } from "../../plan/beats";
import { clamp } from "./motion";
import { Drawn } from "./SketchBoard";
import type { WordTiming } from "./timing";

/**
 * طبقة الحركة الثانية لقالبي السبورة (السبورة المتصلة والسبورة المرسومة):
 * كل حدث فيها مربوط بكلمة منطوقة أو ببداية جملة، فلا حركة للزينة:
 * - كاميرا تتبع القلم: تقترب من الرسمة التي تُرسم الآن، وتنتقل مع الجملة التالية، وتبتعد في الختام لترى اللوحة كلها.
 * - الكلمة المكتوبة تُكتب لحظة نطقها، ثم يمر عليها القلم الفسفوري (الفكرة المحورية فقط).
 * - إذا ذُكر معنى رسمة موجودة على اللوحة مرة أخرى (من قائمة المعاني المراجَعة CONCEPTS) تُحوَّط وتنبض.
 */

const PUNCT = /[«»"“”'؟?!.,،:؛…()]/g;
const norm = (w: string) => normalizeArabic(w.replace(PUNCT, "")).replace(/[^\p{L}\p{N}]/gu, "");
/** بلا واو/فاء العطف وأل وحروف الجر الملتصقة (للمطابقة فقط). */
const core = (w: string) =>
  norm(w)
    .replace(/^(و|ف)(?=..)/, "")
    .replace(/^(بال|كال|فال|لل|ال)(?=..)/, "")
    .replace(/^(ب|ل|ك)(?=...)/, "");

/** صور الكلمة للمطابقة: كما هي، وبلا أل/حرف جر، وبلا عطف أيضًا (لا تُقبل صورة أقصر من حرفين). */
const forms = (w: string) => {
  const n = norm(w);
  const noAl = n.replace(/^(بال|كال|فال|وال|لل|ال)(?=..)/, "");
  return [...new Set([n, noAl, core(w)])].filter((f) => f.length >= 2);
};

export type SpokenWord = { i: number; raw: string; start: number; end: number };

export const spokenWords = (timings: WordTiming[]): SpokenWord[] => timings.map((t, i) => ({ i, raw: t.word, start: t.start, end: t.end }));

/** أول ظهور لكلمة (كما كُتبت في اللقطة) بين كلمتين من التعليق. */
export const findWord = (words: SpokenWord[], label: string, from = 0, to = Infinity): SpokenWord | undefined => {
  const parts = label.split(/\s+/).filter(Boolean);
  if (!parts.length) return undefined;
  const want = forms(parts[0]!);
  return words.find((w) => w.i >= from && w.i < to && forms(w.raw).some((f) => want.includes(f)));
};

/** حدود كلمات كل مجموعة جمل (بداية ونهاية بالفهرس). */
export const groupRanges = (groups: string[]) => {
  const out: { from: number; to: number }[] = [];
  let wi = 0;
  for (const g of groups) {
    const n = g.split(/\s+/).filter(Boolean).length;
    out.push({ from: wi, to: wi + n });
    wi += n;
  }
  return out;
};

export type Mention = { slot: number; start: number };

/**
 * لحظات ذكر معنى رسمة موجودة على اللوحة مرة أخرى. المعنى من قائمة المعاني المراجَعة فقط (wordElement)،
 * ولا تُحسب الكلمة التي كُتبت تحت الرسمة نفسها، ولا ذكر قبل ظهور الرسمة.
 */
export const mentionsOf = (words: SpokenWord[], slots: { draw: string; shownAt: number; labelWord?: number }[], minGap = 36): Mention[] => {
  const out: Mention[] = [];
  const last = new Map<number, number>();
  words.forEach((w, k) => {
    const draw = wordElement(w.raw, words[k - 1]?.raw ?? "", words[k + 1]?.raw ?? "");
    if (!draw) return;
    slots.forEach((s, si) => {
      if (s.draw !== draw || s.labelWord === w.i || w.start < s.shownAt + 20) return;
      if (w.start - (last.get(si) ?? -999) < minGap) return;
      last.set(si, w.start);
      out.push({ slot: si, start: w.start });
    });
  });
  return out;
};

export type Cam = { x: number; y: number; z: number };
export type CamKey = Cam & { at: number; dur: number };

const ease = Easing.inOut(Easing.cubic);

/** موضع الكاميرا الآن من مفاتيح متتالية (كل مفتاح ينتقل من الحالة السابقة إليه). */
export const cameraAt = (keys: CamKey[], frame: number): Cam => {
  if (!keys.length) return { x: 0, y: 0, z: 1 };
  let c: Cam = { x: keys[0]!.x, y: keys[0]!.y, z: keys[0]!.z };
  for (const k of keys.slice(1)) {
    const t = interpolate(frame, [k.at, k.at + Math.max(1, k.dur)], [0, 1], { ...clamp, easing: ease });
    if (t <= 0) break;
    c = { x: c.x + (k.x - c.x) * t, y: c.y + (k.y - c.y) * t, z: c.z + (k.z - c.z) * t };
  }
  return c;
};

/** تحويل CSS يضع نقطة (x, y) من اللوحة في وسط الإطار بتكبير z. */
export const camTransform = (c: Cam, W: number, H: number, cy = H / 2): React.CSSProperties => ({
  transformOrigin: "0 0",
  transform: `translate(${W / 2 - c.x * c.z}px, ${cy - c.y * c.z}px) scale(${c.z})`,
});

/** نبضة قصيرة (0 ← 1 ← 0) تبدأ عند at. */
export const pulse = (frame: number, at: number, len = 16) => {
  const t = (frame - at) / len;
  return t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI);
};

/** ضربة القلم الفسفوري خلف الكلمة: تُسحب في اتجاه القراءة. */
export const Highlighter: React.FC<{ width: number; height: number; t: number; color: string; rtl: boolean; style?: React.CSSProperties }> = ({ width, height, t, color, rtl, style }) => {
  const y = height / 2;
  const d = rtl ? `M${width - 4} ${y + 3} L${4} ${y - 2}` : `M4 ${y - 2} L${width - 4} ${y + 3}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", overflow: "visible", ...style }}>
      <path d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} fill="none" stroke={color} strokeWidth={height * 0.78} strokeLinecap="butt" opacity={t > 0 ? 0.95 : 0} />
    </svg>
  );
};

/** دائرة يدوية حول رسمة (تحويط المعنى عند ذكره). */
export const Ring: React.FC<{ cx: number; cy: number; rx: number; ry: number; t: number; color: string; width?: number; fadeOut?: number }> = ({ cx, cy, rx, ry, t, color, width = 5, fadeOut = 1 }) => {
  const p = (a: number, k = 1) => `${cx + rx * k * Math.cos(a)} ${cy + ry * k * Math.sin(a)}`;
  const d = `M${p(-0.3)} C ${p(-1.2, 1.08)}, ${p(-2.4, 1.04)}, ${p(-3.1)} S ${p(-4.6, 1.05)}, ${p(-5.6)} S ${p(-6.8, 0.98)}, ${p(-6.9, 0.93)}`;
  return <g opacity={fadeOut}><Drawn d={d} t={t} color={color} width={width} /></g>;
};

export type Support = { slot: number; draw: string; word: number; start: number };

/**
 * رسمات مساندة صغيرة: كلمة أخرى في جملة اللقطة لها معنى في قائمة المعاني المراجَعة (CONCEPTS)
 * تُرسم بجوار رسمة الجملة لحظة نطقها. لا تكرار لرسمة على اللوحة، ولا شيء خارج مكتبة القناة.
 */
export const supportsOf = (
  words: SpokenWord[],
  ranges: { from: number; to: number }[],
  beats: { draw: string; shownAt: number; labelWord?: number }[],
  allow: (id: string) => boolean,
  max = 1,
): Support[] => {
  const used = new Set(beats.map((b) => b.draw));
  const out: Support[] = [];
  ranges.forEach((r, slot) => {
    // توقير: لا رسمة مساندة في جملة فيها ذكر الله
    if (words.slice(r.from, r.to).some((w) => SACRED_NEIGHBORS.test(normalizeArabic(w.raw.replace(PUNCT, ""))))) return;
    let n = 0;
    for (let k = r.from; k < r.to && n < max; k++) {
      const w = words[k];
      if (!w || w.i === beats[slot]?.labelWord) continue;
      const draw = wordElement(w.raw, words[k - 1]?.raw ?? "", words[k + 1]?.raw ?? "");
      if (!draw || used.has(draw) || !allow(draw)) continue;
      used.add(draw);
      n++;
      out.push({ slot, draw, word: w.i, start: Math.max(w.start - 4, (beats[slot]?.shownAt ?? 0) - 6) });
    }
  });
  return out;
};

/**
 * لا يبقى المشهد ساكنًا أكثر من ثانية ونصف: إن طال الكلام بلا حدث على اللوحة تبتعد الكاميرا لترى ما رُسم حتى الآن،
 * ثم تعود إلى موضع الحديث. يعيد المفاتيح مرتبة مع مفاتيح الملء.
 */
export const fillCameraGaps = (keys: CamKey[], events: number[], until: number, focusAt: (frame: number) => Cam, overview: Cam, maxGap = 30, step = 46): CamKey[] => {
  const sorted = [...keys].sort((a, b) => a.at - b.at);
  const ev = [...keys.map((k) => k.at), ...events].filter((t) => t >= 0 && t < until).sort((a, b) => a - b);
  const fill: CamKey[] = [];
  ev.forEach((t, k) => {
    const next = ev[k + 1] ?? until;
    for (let at = t + 26; next - at > maxGap; at += step) {
      const now = cameraAt([...sorted, ...fill].sort((a, b) => a.at - b.at), at);
      fill.push(now.z > overview.z + 0.05 ? { ...overview, at, dur: 20 } : { ...focusAt(at), at, dur: 20 });
    }
  });
  return [...sorted, ...fill].sort((a, b) => a.at - b.at);
};

/**
 * خلفية السبورة من زخرفة هوية القناة: «ورقة مسطّرة بهامش» (زبدة الكتب) ثابتة بلا حركة،
 * وإلا نقاط السبورة الخفيفة. الخطوط تنزاح مع انتقال الكاميرا بين المشاهد (إحساس اللوحة الواحدة).
 */
export const BoardPaper: React.FC<{ motif?: string; ink: string; margin: string; dark: boolean; rtl: boolean; shift?: number }> = ({ motif, ink, margin, dark, rtl, shift = 0 }) =>
  motif === "ruled" ? (
    <>
      <div style={{ position: "absolute", inset: 0, opacity: dark ? 0.1 : 0.06, backgroundImage: `linear-gradient(to bottom, transparent 54px, ${ink} 54px, ${ink} 56px)`, backgroundSize: "100% 56px" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, [rtl ? "right" : "left"]: 96, width: 2, background: margin, opacity: 0.25 }} />
    </>
  ) : (
    <div style={{ position: "absolute", inset: 0, opacity: dark ? 0.1 : 0.07, backgroundImage: `radial-gradient(${ink} 1.6px, transparent 1.8px)`, backgroundSize: "48px 48px", backgroundPosition: `${shift}px 0` }} />
  );
