import React from "react";
import { Easing, interpolate } from "remotion";
import { Figure, LOOKS, poseAt, walkPose, type FigureLook, type Holding, type PoseName } from "../Figure";
import { normalizeArabic } from "../../../script/quranMeta";
import type { WordTiming } from "../../scenes/timing";

/**
 * عُدّة اللقطات المصمَّمة: كل لقطة تحكي جملتها، ولها مكانها وكاميرتها وأحداثها على توقيت كلماتها.
 * - at(كلمة، نسبة): لحظة نطق الكلمة في المشهد، وإن لم تُنطق (نص معدَّل) فنسبة من مدة المشهد.
 * - cam: مفاتيح كاميرا (نقطة التركيز والتكبير)، والانتقال بينها ناعم.
 */
export type ShotCtx = {
  frame: number;
  fps: number;
  dur: number;
  portrait: boolean;
  at: (word: string, frac: number) => number;
};

const strip = (w: string) => normalizeArabic(w.replace(/[«»"“”'؟?!.,،:؛…ـ()]/g, ""));
export const makeAt = (timings: WordTiming[], dur: number) => (word: string, frac: number) => {
  const k = strip(word);
  const hit = timings.find((t) => {
    const w = strip(t.word);
    return w === k || w === `و${k}` || w === `ف${k}` || w === `ب${k}` || w === `ل${k}`;
  });
  return hit ? hit.start : Math.round(frac * dur);
};

export type CamKey = { t: number; x: number; y: number; z: number };
const ease = Easing.inOut(Easing.cubic);
/** موضع الكاميرا: بين مفتاحين انتقال ناعم مدته len، ثم انجراف بطيء جدًا حتى المفتاح التالي */
export const camAt = (frame: number, keys: CamKey[], len = 22) => {
  const ks = [...keys].sort((a, b) => a.t - b.t);
  let cur = ks[0]!;
  let out = { x: cur.x, y: cur.y, z: cur.z };
  for (let i = 1; i < ks.length; i++) {
    const k = ks[i]!;
    if (frame < k.t) break;
    const p = interpolate(frame, [k.t, k.t + len], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
    out = { x: cur.x + (k.x - cur.x) * p, y: cur.y + (k.y - cur.y) * p, z: cur.z + (k.z - cur.z) * p };
    cur = { ...k, x: out.x, y: out.y, z: out.z };
  }
  return out;
};
/** مفتاح كاميرا بتأطير متوازن: الأرض نحو 15% من أسفل الإطار مهما كان التكبير */
export const K = (t: number, x: number, z: number, dy = 0): CamKey => ({ t, x, y: 860 - 390 / z + dy, z });
export const camTransform = (c: { x: number; y: number; z: number }, drift = 0) => `translate(960 540) scale(${c.z * (1 + drift)}) translate(${-c.x} ${-c.y})`;

/** وضعيات على خط زمني [لحظة، وضعية] */
export const pz = (frame: number, tl: [number, PoseName][]) => poseAt(frame, tl.map(([at, pose]) => ({ at, pose })));

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const prog = (frame: number, a: number, b: number, e: (t: number) => number = ease) => interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

/** شخص يتحرك بين نقطتين ماشيًا (للمارّة والدخول والخروج) */
export const Walker: React.FC<{
  frame: number;
  from: number;
  to: number;
  y: number;
  start?: number;
  end?: number;
  look?: FigureLook;
  scale?: number;
  opacity?: number;
  loop?: boolean;
  holding?: Holding;
  silhouette?: string;
  pose?: PoseName;
}> = ({ frame, from, to, y, start = 0, end, look = LOOKS.stranger, scale = 1, opacity = 1, loop = false, holding, silhouette, pose = "stand" }) => {
  const speed = 2.6 * scale;
  const len = Math.abs(to - from) / speed;
  const stop = end ?? start + len;
  let t = (frame - start) / Math.max(1, stop - start);
  if (loop) t = ((t % 1) + 1) % 1;
  const walking = loop || (frame > start && frame < stop);
  const p = clamp01(t);
  const x = from + (to - from) * p;
  const base = poseAt(frame, [{ at: 0, pose }]);
  const pose2 = walking ? walkPose(base, ((frame - start) / 30) * Math.PI * 2 * 0.95) : base;
  return <Figure x={x} y={y} scale={scale} pose={pose2} look={look} flip={to < from} opacity={opacity} frame={frame} holding={holding} silhouette={silhouette} />;
};

/** حبات تتدحرج وتقفز (برتقال يسقط من عربة) */
export const Rolling: React.FC<{ frame: number; at: number; x: number; y: number; ground: number; color: string; n?: number; dir?: 1 | -1 }> = ({ frame, at, x, y, ground, color, n = 4, dir = 1 }) => {
  if (frame < at) return null;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const f = frame - at - i * 4;
        if (f < 0) return null;
        const vx = (2.2 + i * 0.9) * dir;
        const fall = Math.min(f, 20);
        const yy = Math.min(ground - 10, y + 0.55 * fall * fall);
        const bounce = f > 20 ? Math.abs(Math.sin((f - 20) / 5)) * 14 * Math.exp(-(f - 20) / 14) : 0;
        const xx = x + vx * Math.min(f, 70) + i * 6;
        return <circle key={i} cx={xx} cy={yy - bounce} r={11} fill={color} stroke="#1a1208" strokeWidth={2} />;
      })}
    </g>
  );
};

/** بخار يتصاعد (شاي، قهوة) */
export const Steam: React.FC<{ frame: number; x: number; y: number; color?: string }> = ({ frame, x, y, color = "#F4EEE2" }) => (
  <g opacity={0.5} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round">
    {[0, 1].map((k) => {
      const p = ((frame + k * 30) % 60) / 60;
      return <path key={k} d={`M${x + k * 8} ${y - p * 40} q6 -8 0 -16 q-6 -8 0 -16`} opacity={1 - p} />;
    })}
  </g>
);

/** سرب طيور يعبر السماء (حياة الفجر والأسطح) */
export const Birds: React.FC<{ frame: number; start: number; y: number; n?: number; dir?: 1 | -1; color?: string }> = ({ frame, start, y, n = 7, dir = -1, color = "#1a1a14" }) => {
  const f = frame - start;
  if (f < 0) return null;
  return (
    <g fill="none" stroke={color} strokeWidth={4} strokeLinecap="round">
      {Array.from({ length: n }, (_, i) => {
        const x = (dir < 0 ? 2100 : -200) + dir * (f * (7 + (i % 3)) + i * 40);
        const yy = y + (i % 4) * 26 - i * 6 + Math.sin(f / 6 + i) * 6;
        const flap = Math.sin(f / 3 + i * 1.3) * 10;
        return <path key={i} d={`M${x - 16} ${yy - flap} Q${x - 6} ${yy - 6} ${x} ${yy} Q${x + 6} ${yy - 6} ${x + 16} ${yy - flap}`} />;
      })}
    </g>
  );
};
