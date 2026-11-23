/**
 * قوالب سلسلة «البدايات» (D209) على عالم «خطوط على الأرض» (D203): خمسة قوالب بلقطاتها (shots.ts)، كلها على البيئة نفسها
 * (earth.tsx: شاطئ ذهبي فاتح، وماء بانعكاس يرقّ نحو الحافة، وشمس تشرق على مدار الحلقة من الفجر إلى الضحى بحقل sun).
 * كل حدث لحظة نطق كلمته (حقول «كلمة …»)، ولا يُرسم ما لم تحدده الحقول (القاعدة الثالثة: الفراغ أفضل من عنصر خاطئ).
 * التوقيت من صوت الراوي إن وُجد، وإلا تقديري بقاعدة السكون نفسها (rahhalaWords). عند ذكر الله والدعاء: لا حدث ولا كاميرا
 * ولا موج ولا شمس (زمن فعّال يقف)، ولا يُعوَّض قبلها أو بعدها. مشهد الآية (verse) ساكن الكاميرا كله، والنص يظهر مرة.
 * التوقير (أشد في هذه السلسلة): لا تصوير لآدم عليه السلام ولا للملائكة ولا لإبليس بأي هيئة: لا شخص ولا ظل ولا أثر قدم
 * ولا ضوء يقوم مقام أحد؛ القصة بالأرض والطين والماء والضوء والحجر والنص وحدها.
 * المشهد الطويل يُقطع لقطات ≤٧ ث بين زاويتين للّقطة نفسها (الحِرفة، D189).
 */
import React, { useMemo } from "react";
import { Audio, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { DepthOfField, Stage3D, ease, lightsAt, orbit, safeKeys, type CamState, type Window } from "../../three";
import { splitWords } from "../../scenes/timing";
import type { SceneBase, StringFields } from "../../scenes/types";
import { SceneShell } from "../../scenes/SceneShell";
import { anchorAt, rahhalaStill, rahhalaWords } from "../world/RahhalaDesk";
import { verseRef } from "../horizon/kit";
import { RedrawWhenReady } from "../archive/ArchiveLab";
import { BidCaption, K, ProofStamp, RedThread, SFX, n2, span, useBidFont, type V3 } from "./common";
import { BidEarth, bidLights, groundH, mixC, useBidTextures, type BidTextures } from "./earth";
import {
  CLAY_AT, CLAY_CRUMBS, CUT, ClayMaterial, LAYERS, RING_KINDS, WallStamp, cutTop, stonePath, swash, useClayHandful, useContactShadow,
  useCrumbs, useDampRing, useStones, waterLevel,
} from "./StoneLines";
import { BID_CAPTION_TONE, BID_STAMPS, BID_TEMPLATES, type BidShotId, type BidStamp, type BidTemplateId } from "./shots";
export { BID_TEMPLATES, type BidShotId, type BidTemplateId };

export type BidayatProps = SceneBase & { template?: BidTemplateId } & StringFields<
  | "shot" | "sun" | "mark" | "markWord" | "stamp" | "stampWord" | "lineWord" | "knotWord" | "branchWords" | "villageWord" | "cityWord"
  | "descendWord" | "provenWord" | "reportWord" | "unknownWord" | "verseText" | "verseFrom" | "verseKey" | "ref" | "items"
  | "aText" | "aWord" | "bText" | "bWord" | "verdictText" | "verdictWord">;

type W = { w: string; s: number; e: number };
/** زمن «فعّال» لا يتقدم داخل نوافذ السكون: الكاميرا والموج والشمس تقف فيها ثم تكمل من حيث وقفت */
export const bidEffective = (t: number, still: Window[]) => {
  let x = t;
  for (const [s, e] of still) x -= Math.max(0, Math.min(t, e) - Math.max(0, s));
  return x;
};
/** اللقطة المختارة إن كانت من لقطات القالب، وإلا أولى لقطاته */
export const bidShotOf = (template: BidTemplateId, shot?: string): BidShotId => {
  const shots = Object.keys(BID_TEMPLATES[template].shots) as BidShotId[];
  return shot && (shots as string[]).includes(shot) ? (shot as BidShotId) : shots[0]!;
};
/** تقدّم الشمس في المشهد: من حقل sun (موضع المشهد في الحلقة، ٠ فجر و١ ضحى) يتقدم قليلًا بالزمن الفعّال */
export const bidSun = (sun: string | undefined, te: number, dur: number) => {
  const s0 = Math.min(1, Math.max(0, Number(sun) || 0.5));
  return Math.min(1, s0 + 0.03 * (te / Math.max(1, dur)));
};

// ——— المواضع في العالم (إحداثيات «خطوط على الأرض» نفسها) ———
/** لوح الحجر المسطح للآية والحصى والميزان والطريقين: على الرمل الجاف أمام الماء */
export const SLAB_AT: [number, number] = [0.6, 2.3];
const yAt = (x: number, z: number) => groundH(x, z);
/** خطوط النسل: من حجر الأصل تتفرع خطوط بزوايا متباعدة نحو الماء */
export const fanPaths = (n: number): [number, number][][] => {
  const [ox, oz] = [-0.6, 3.2];
  return Array.from({ length: n }, (_, b) => {
    const a = -Math.PI / 2 + ((b - (n - 1) / 2) / Math.max(1, n - 1)) * 1.9;
    return Array.from({ length: 9 }, (_, i) => {
      const r = 0.45 + i * 0.42, bend = 0.16 * Math.sin(i * 0.7 + b);
      return [ox + Math.cos(a + bend) * r, oz + Math.sin(a + bend) * r] as [number, number];
    });
  });
};
/** طريقان من حجر واحد: الأول يمضي بعيدًا نحو الماء، والثاني يخرج ثم ينعطف راجعًا إلى البداية */
export const twoPaths = (): [[number, number][], [number, number][]] => {
  const [ox, oz] = [SLAB_AT[0] - 0.2, SLAB_AT[1] + 0.9];
  const away = Array.from({ length: 12 }, (_, i) => [ox - 0.25 * i * 0.9 - 0.05 * Math.sin(i), oz - 0.32 * i] as [number, number]);
  const back = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 13) * Math.PI * 1.55;
    return [ox + 0.55 + 0.9 * Math.sin(a), oz - 1.25 + 1.25 * Math.cos(a)] as [number, number];
  });
  return [away, back];
};
const PEBBLE_KINDS = ["flat"] as const;
const CIRCLES: { x: number; z: number; r: number; n: number; gap?: number }[] = [
  { x: -3.4, z: 1.4, r: 0.38, n: 11 }, { x: -2.5, z: 0.4, r: 0.32, n: 9 }, { x: -4.0, z: 0.2, r: 0.3, n: 9 },
  { x: -5.2, z: -1.0, r: 0.9, n: 26, gap: 0.5 },
];

// ——— اللقطات: زاويتان لكل لقطة ———
type ShotCam = { target: V3; yaw: number; pitch: number; dist: number; fov: number };
type Setup = { size: "detail" | "close" | "medium" | "wide"; from: ShotCam; to: ShotCam; aperture: number };
const at = (x: number, z: number, dy = 0.05): V3 => [x, yAt(x, z) + dy, z];
const [CX, CZ] = CLAY_AT, [SX, SZ] = SLAB_AT;
export const BID_SETUPS: Record<BidShotId, [Setup, Setup]> = {
  horizon: [
    { size: "wide", aperture: 0.0015, from: { target: [0.4, 0.6, -6], yaw: -6, pitch: 3, dist: 11.5, fov: 36 }, to: { target: [0.4, 0.55, -6], yaw: -1, pitch: 4, dist: 10.4, fov: 36 } },
    { size: "wide", aperture: 0.002, from: { target: [1.8, 0.5, -6], yaw: 14, pitch: 5, dist: 10.8, fov: 36 }, to: { target: [1.2, 0.5, -6], yaw: 6, pitch: 4, dist: 10.0, fov: 36 } },
  ],
  shore: [
    { size: "medium", aperture: 0.006, from: { target: [1.2, 0.05, 0.4], yaw: -24, pitch: 12, dist: 4.6, fov: 34 }, to: { target: [1.6, 0.05, 0.1], yaw: -34, pitch: 14, dist: 4.2, fov: 34 } },
    { size: "close", aperture: 0.012, from: { target: [2.6, 0.05, 0.6], yaw: 30, pitch: 18, dist: 3.0, fov: 32 }, to: { target: [2.2, 0.05, 0.4], yaw: 18, pitch: 20, dist: 2.7, fov: 32 } },
  ],
  aerial: [
    { size: "wide", aperture: 0.002, from: { target: [-1.2, 0, -0.4], yaw: 18, pitch: 70, dist: 10.6, fov: 34 }, to: { target: [-0.6, 0, -0.8], yaw: 34, pitch: 74, dist: 12.4, fov: 34 } },
    { size: "wide", aperture: 0.002, from: { target: [0.2, 0, -1.2], yaw: -12, pitch: 62, dist: 9.4, fov: 34 }, to: { target: [0.4, 0, -1.4], yaw: -26, pitch: 68, dist: 10.8, fov: 34 } },
  ],
  line: [
    { size: "medium", aperture: 0.006, from: { target: [-2.4, 0.1, 2.6], yaw: 40, pitch: 22, dist: 4.4, fov: 34 }, to: { target: [-1.4, 0.1, 1.4], yaw: 20, pitch: 18, dist: 4.8, fov: 34 } },
    { size: "detail", aperture: 0.03, from: { target: [-1.3, 0.12, 1.9], yaw: 62, pitch: 12, dist: 1.75, fov: 30 }, to: { target: [-0.75, 0.12, 1.2], yaw: 18, pitch: 20, dist: 1.3, fov: 30 } },
  ],
  fan: [
    { size: "medium", aperture: 0.006, from: { target: [-0.6, 0.05, 2.2], yaw: 0, pitch: 58, dist: 5.4, fov: 34 }, to: { target: [-0.6, 0.05, 2.0], yaw: 10, pitch: 64, dist: 6.0, fov: 34 } },
    { size: "close", aperture: 0.014, from: { target: [-0.6, 0.05, 2.8], yaw: -30, pitch: 26, dist: 3.0, fov: 32 }, to: { target: [-0.7, 0.05, 2.4], yaw: -12, pitch: 30, dist: 3.4, fov: 32 } },
  ],
  circles: [
    { size: "close", aperture: 0.014, from: { target: [-3.4, 0.15, 0.6], yaw: 70, pitch: 20, dist: 4.4, fov: 32 }, to: { target: [-4.0, 0.15, 0.2], yaw: 58, pitch: 22, dist: 4.0, fov: 32 } },
    { size: "medium", aperture: 0.006, from: { target: [-4.0, 0.1, 0.2], yaw: 20, pitch: 46, dist: 5.6, fov: 34 }, to: { target: [-4.4, 0.1, -0.2], yaw: 34, pitch: 52, dist: 5.2, fov: 34 } },
  ],
  strata: [
    { size: "close", aperture: 0.012, from: { target: [-2.2, 0.0, CUT.z1], yaw: 0, pitch: 38, dist: 3.2, fov: 34 }, to: { target: [-1.9, cutTop() - 0.6, CUT.z1], yaw: 4, pitch: 4, dist: 2.2, fov: 34 } },
    { size: "detail", aperture: 0.02, from: { target: [-1.5, cutTop() - 0.5, CUT.z1], yaw: -14, pitch: 6, dist: 1.6, fov: 32 }, to: { target: [-1.4, cutTop() - 0.7, CUT.z1], yaw: -6, pitch: 4, dist: 1.45, fov: 32 } },
  ],
  clay: [
    { size: "detail", aperture: 0.035, from: { target: at(CX, CZ), yaw: -28, pitch: 16, dist: 1.05, fov: 30 }, to: { target: at(CX, CZ), yaw: -20, pitch: 18, dist: 0.98, fov: 30 } },
    { size: "detail", aperture: 0.03, from: { target: at(CX, CZ), yaw: 24, pitch: 30, dist: 0.95, fov: 30 }, to: { target: at(CX, CZ), yaw: 16, pitch: 32, dist: 0.9, fov: 30 } },
  ],
  "clay-shore": [
    { size: "close", aperture: 0.016, from: { target: at(CX, CZ, 0.1), yaw: -10, pitch: 8, dist: 2.6, fov: 32 }, to: { target: at(CX, CZ, 0.1), yaw: -4, pitch: 8, dist: 2.3, fov: 32 } },
    { size: "medium", aperture: 0.008, from: { target: at(CX - 0.4, CZ - 0.6, 0.2), yaw: 22, pitch: 10, dist: 3.6, fov: 34 }, to: { target: at(CX - 0.4, CZ - 0.6, 0.2), yaw: 14, pitch: 10, dist: 3.3, fov: 34 } },
  ],
  // مشهد الآية: الكاميرا ثابتة (السكون المقصود)، واللقطة الثانية زاوية أقرب ثابتة أيضًا
  verse: [
    { size: "close", aperture: 0.006, from: { target: at(SX, SZ, 0.04), yaw: 0, pitch: 72, dist: 2.75, fov: 32 }, to: { target: at(SX, SZ, 0.04), yaw: 0, pitch: 72, dist: 2.75, fov: 32 } },
    { size: "medium", aperture: 0.005, from: { target: at(SX, SZ - 0.2, 0.04), yaw: -8, pitch: 48, dist: 4.4, fov: 34 }, to: { target: at(SX, SZ - 0.2, 0.04), yaw: -8, pitch: 48, dist: 4.4, fov: 34 } },
  ],
  words: [
    { size: "close", aperture: 0.012, from: { target: at(SX, SZ + 0.2), yaw: -8, pitch: 50, dist: 2.6, fov: 32 }, to: { target: at(SX, SZ + 0.1), yaw: 4, pitch: 56, dist: 2.3, fov: 32 } },
    { size: "detail", aperture: 0.024, from: { target: at(SX + 0.3, SZ + 0.2), yaw: 18, pitch: 40, dist: 1.7, fov: 30 }, to: { target: at(SX - 0.2, SZ + 0.2), yaw: 6, pitch: 46, dist: 1.6, fov: 30 } },
  ],
  scale: [
    { size: "close", aperture: 0.012, from: { target: at(SX, SZ, 0.35), yaw: -6, pitch: 14, dist: 2.9, fov: 32 }, to: { target: at(SX, SZ, 0.35), yaw: 4, pitch: 16, dist: 2.6, fov: 32 } },
    { size: "medium", aperture: 0.008, from: { target: at(SX, SZ, 0.3), yaw: 26, pitch: 22, dist: 3.4, fov: 34 }, to: { target: at(SX, SZ, 0.3), yaw: 14, pitch: 24, dist: 3.1, fov: 34 } },
  ],
  paths: [
    { size: "medium", aperture: 0.006, from: { target: at(SX, SZ - 0.6), yaw: 0, pitch: 60, dist: 4.4, fov: 34 }, to: { target: at(SX, SZ - 0.8), yaw: 12, pitch: 66, dist: 4.8, fov: 34 } },
    { size: "close", aperture: 0.012, from: { target: at(SX + 0.2, SZ - 0.2), yaw: -26, pitch: 34, dist: 3.0, fov: 32 }, to: { target: at(SX, SZ - 0.4), yaw: -12, pitch: 38, dist: 3.2, fov: 32 } },
  ],
};
export type BidCut = Setup & { a: number; b: number };
/** اللقطات داخل المشهد: واحدة إلى ٨ ث، وفوقها قطع متساوية ≤٧ ث تتناوب بين زاويتي اللقطة */
export const bidCuts = (shot: BidShotId, dur: number): BidCut[] => {
  const n = dur <= 8 ? 1 : Math.ceil(dur / 7);
  return Array.from({ length: n }, (_, i) => ({ ...BID_SETUPS[shot][i % 2]!, a: (i * dur) / n, b: ((i + 1) * dur) / n }));
};
const camOf = (c: BidCut, t: number, still: Window[]): CamState & { focus: number } => {
  const p = ease(span(bidEffective(t, still), bidEffective(c.a, still), Math.max(0.01, bidEffective(c.b, still) - bidEffective(c.a, still))));
  const L = (x: number, y: number) => x + (y - x) * p;
  const s = { target: [L(c.from.target[0], c.to.target[0]), L(c.from.target[1], c.to.target[1]), L(c.from.target[2], c.to.target[2])] as V3, yaw: L(c.from.yaw, c.to.yaw), pitch: L(c.from.pitch, c.to.pitch), dist: L(c.from.dist, c.to.dist), fov: L(c.from.fov, c.to.fov) };
  return { position: orbit(s), target: s.target, fov: s.fov, focus: s.dist };
};

/**
 * موضع الكلمة المكتوبة في الرمل لكل لقطة: على الأرض في اتجاه نظر الزاوية التي تُكتب فيها (setup)، على ٧٢٪ من المسافة إلى الهدف (وفي اللقطة
 * الواسعة على ٦ م من الكاميرا)، ومدارة لتُقرأ من الكاميرا، وعرضها بحسب بعدها؛ والختم إلى يسار الكلمة على الشاشة.
 */
export const bidMarkPlace = (shot: BidShotId, setup = 0) => {
  const c = BID_SETUPS[shot][setup % 2]!.from, pos = orbit(c);
  const dx = c.target[0] - pos[0], dz = c.target[2] - pos[2], len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len;
  // على الرمل الجاف وحده: يقترب من الكاميرا حتى يكون فوق أعلى الماء بوضوح (لا كلمة تحت الماء)
  let d = Math.min(0.72 * len, 4.5);
  while (d > 1 && groundH(pos[0] + ux * d, pos[2] + uz * d) < waterLevel(1) + 0.015) d -= 0.25;
  const markAt: [number, number] = [pos[0] + ux * d, pos[2] + uz * d];
  const markW = Math.min(3.0, Math.max(0.7, d * 0.5));
  // يسار الشاشة: عمودي على اتجاه النظر
  // الختم إلى يسار الكلمة وأبعد منها قليلًا (فوقها في الكادر، لا تحت الترجمة ولا خارج الإطار)
  const stampAt: [number, number] = [markAt[0] + uz * markW * 0.42 + ux * markW * 0.45, markAt[1] - ux * markW * 0.42 + uz * markW * 0.45];
  return { markAt, markW, stampAt, markRot: Math.atan2(-ux, -uz) };
};

// ——— الأحداث ———
export type BidEvent = { id: string; a: number; b: number; sfx: string };
/** «كلمة = نص» سطرًا سطرًا (الحصى) */
export const bidItems = (items?: string) => (items ?? "").split("\n").map((l) => l.split("=").map((x) => x.trim())).filter((x) => x[0] && x[1]).map(([w, text]) => ({ w: w!, text: text! })).slice(0, 6);
/** أحداث المشهد بأزمانها (بعد تأخير ما يقع في نافذة سكون): كل حدث له صوته (D158) */
export const bidEvents = (shot: BidShotId, p: Record<string, string | undefined>, words: W[], still: Window[], dur: number): BidEvent[] => {
  const ev: BidEvent[] = [];
  const add = (id: string, t: number | null, d: number, sfx: string) => { if (t !== null) ev.push({ id, a: Math.max(0, t - 0.1), b: Math.max(0, t - 0.1) + d, sfx }); };
  if (p.mark) add("mark", anchorAt(words, p.markWord), 1.4, "quill-write");
  if (p.stamp && (BID_STAMPS as readonly string[]).includes(p.stamp)) add("stamp", anchorAt(words, p.stampWord), 0.8, "stamp");
  if (shot === "line") {
    const l = anchorAt(words, p.lineWord) ?? 0.3;
    ev.push({ id: "line", a: l, b: Math.max(l + 2, dur * 0.85), sfx: "drop-soft" });
    add("knot", anchorAt(words, p.knotWord), 0.6, "drop-soft");
  }
  if (shot === "fan") {
    const l = anchorAt(words, p.lineWord) ?? 0.3;
    add("origin", l, 0.6, "drop-soft");
    const bw = (p.branchWords ?? "").split("|").map((x) => x.trim()).filter(Boolean);
    const n = bw.length || 5;
    for (let b = 0; b < n; b++) {
      const t0 = bw[b] ? anchorAt(words, bw[b]) : l + 0.6 + (b * (dur * 0.7 - l)) / n;
      if (t0 !== null) ev.push({ id: `branch${b}`, a: t0, b: t0 + 1.6, sfx: "drop-soft" });
    }
  }
  if (shot === "circles") { add("village", anchorAt(words, p.villageWord), 1.0, "drop-soft"); add("city", anchorAt(words, p.cityWord), 1.1, "drop-soft"); }
  if (shot === "strata") {
    ev.push({ id: "descend", a: anchorAt(words, p.descendWord) ?? 0.2, b: (anchorAt(words, p.descendWord) ?? 0.2) + 1.8, sfx: "swipe-paper" });
    add("proven", anchorAt(words, p.provenWord), 0.9, "stamp"); add("report", anchorAt(words, p.reportWord), 0.9, "stamp"); add("unknown", anchorAt(words, p.unknownWord), 0.9, "stamp");
  }
  if (shot === "verse" && p.verseText) add("verse", anchorAt(words, p.verseFrom) ?? 0.3, 1.4, "quill-write");
  if (shot === "words") bidItems(p.items).forEach((it, i) => add(`item${i}`, anchorAt(words, it.w), 0.7, "drop-soft"));
  if (shot === "scale" || shot === "paths") {
    add("a", anchorAt(words, p.aWord), 1.2, "drop-soft"); add("b", anchorAt(words, p.bWord), 1.2, "drop-soft");
    if (shot === "scale") add("verdict", anchorAt(words, p.verdictWord), 1.0, "stamp");
  }
  return ev.map((e) => { const k = safeKeys([{ a: e.a, b: e.b, to: e }], still)[0]!; return { ...e, a: k.a, b: k.b }; });
};

// ——— الكتابة على الرمل والحجر ———
const useCanvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, deps: unknown[]) => useMemo(() => {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}, deps); // eslint-disable-line react-hooks/exhaustive-deps
/** كلمة محفورة في الرمل المبلول: حبر الرمل الداكن بحافة فاتحة (أثر الحفر)، تُكتب من اليمين إلى اليسار حتى q */
const drawSandWord = (g: CanvasRenderingContext2D, text: string, q: number, ready: boolean) => {
  g.clearRect(0, 0, 1024, 256);
  if (!ready || q <= 0) return;
  g.save(); g.beginPath(); g.rect(1024 * (1 - q), 0, 1024 * q, 256); g.clip();
  g.font = `700 ${text.length > 10 ? 120 : 150}px Amiri`; g.textAlign = "center"; g.textBaseline = "middle"; g.direction = "rtl";
  g.lineJoin = "round";
  g.strokeStyle = "rgba(244,233,212,0.55)"; g.lineWidth = 16; g.strokeText(text, 512, 136);
  g.fillStyle = "rgba(58,38,24,0.92)"; g.fillText(text, 512, 132);
  g.restore();
};
/** الآية على الحجر: سطور بالأميري بحبر داكن، والمرجع تحتها؛ تظهر بالحبر مرة واحدة (q) ثم لا تتغير */
const wrapAr = (g: CanvasRenderingContext2D, text: string, max: number) => {
  const lines: string[] = []; let cur = "";
  for (const w of text.split(/\s+/)) { const tryL = cur ? `${cur} ${w}` : w; if (g.measureText(tryL).width > max && cur) { lines.push(cur); cur = w; } else cur = tryL; }
  if (cur) lines.push(cur);
  return lines;
};
const drawVerse = (g: CanvasRenderingContext2D, text: string, refText: string, q: number, ready: boolean) => {
  g.clearRect(0, 0, 1600, 1000);
  if (!ready || q <= 0) return;
  g.globalAlpha = Math.min(1, q);
  g.direction = "rtl"; g.textAlign = "center"; g.textBaseline = "middle";
  const size = text.length > 200 ? 70 : text.length > 120 ? 80 : 92;
  g.font = `${size}px Amiri`;
  const lines = wrapAr(g, text, 1380);
  const lh = size * 1.9, top = 500 - ((lines.length - 1) * lh) / 2 - 50;
  g.fillStyle = "rgba(43,30,20,0.93)";
  lines.forEach((l, i) => g.fillText(l, 800, top + i * lh));
  if (refText) { g.font = "600 46px Tajawal"; g.fillStyle = "rgba(74,46,31,0.85)"; g.fillText(refText, 800, top + lines.length * lh + 20); }
  g.globalAlpha = 1;
};

/** حجر مسطح كبير (لوح) من خامة الحجر نفسها: صندوق بحواف مكسورة قليلًا */
const slabGeometry = () => {
  const g = new THREE.BoxGeometry(2.2, 0.16, 1.4, 64, 4, 44), pos = g.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const edge = Math.max(Math.abs(x) / 1.1, Math.abs(z) / 0.7);
    const f = 1 - 0.06 * Math.max(0, edge - 0.85) / 0.15 * (0.5 + 0.5 * n2(401, x * 3, z * 3));
    pos.setXYZ(i, x * f + 0.03 * n2(403, z * 2, y), y + (y > 0 ? 0.012 * n2(407, x * 4, z * 4) : 0), z * f + 0.03 * n2(409, x * 2, y));
  }
  g.computeVertexNormals(); return g;
};

export const BidayatScene: React.FC<BidayatProps> = (props) => {
  const ready = useBidFont();
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const t = frame / fps, dur = durationInFrames / fps;
  const p = props as unknown as Record<string, string | undefined>;
  const template: BidTemplateId = props.template && props.template in BID_TEMPLATES ? props.template : "bidayat-shore";
  const shot = bidShotOf(template, props.shot);
  const words = useMemo(() => rahhalaWords(props.narration ?? "", props.narrationTimings, fps, durationInFrames), [props.narration, props.narrationTimings, fps, durationInFrames]);
  // مشهد الآية كله سكون مقصود (الكاميرا والماء والشمس)، وغيره نوافذ ذكر الله والدعاء
  // الأحداث تتجنب نوافذ ذكر الله والدعاء؛ والكاميرا والماء والشمس تقف فيها، وفي مشهد الآية كله
  const sacred = useMemo(() => rahhalaStill(words), [words]);
  const still = useMemo<Window[]>(() => (shot === "verse" ? [[-1, dur + 1]] : sacred), [sacred, shot, dur]);
  const events = useMemo(() => bidEvents(shot, p, words, sacred, dur), [shot, words, sacred, dur, JSON.stringify(p)]); // eslint-disable-line react-hooks/exhaustive-deps
  const ev = (id: string) => events.find((e) => e.id === id);
  const prog = (id: string) => { const e = ev(id); return e ? ease(span(t, e.a, e.b - e.a)) : 0; };
  const te = bidEffective(t, still);
  const sp = bidSun(props.sun, te, dur);
  const level = waterLevel(1) + swash(te);
  const tex = useBidTextures();
  const path = useMemo(stonePath, []);
  const lineStones = useStones(path.length, 31, 0.1);
  const ringStones = useStones(CIRCLES.reduce((n, c) => n + c.n, 0), 57, 0.45, RING_KINDS);
  const fan = useMemo(() => fanPaths(Math.max(1, (p.branchWords ?? "").split("|").filter((x) => x.trim()).length || 5)), [p.branchWords]);
  const fanStones = useStones(fan.length * 9 + 1, 83, 0.3);
  const [away, back] = useMemo(twoPaths, []);
  const pathStones = useStones(away.length + back.length + 1, 97, 0.3);
  const pebbles = useStones(6, 113, 0.2, PEBBLE_KINDS);
  const contact = useContactShadow(), damp = useDampRing(), crumbs = useCrumbs(), clay = useClayHandful();
  const slab = useMemo(slabGeometry, []);
  const markQ = prog("mark");
  const markTex = useCanvasTex(1024, 256, (g) => drawSandWord(g, p.mark ?? "", markQ, ready), [ready, Math.round(markQ * 40), p.mark]);
  const verseQ = prog("verse");
  const verseTex = useCanvasTex(1600, 1000, (g) => drawVerse(g, p.verseText ?? "", p.ref?.trim() || (p.verseKey ? verseRef(p.verseKey) : ""), verseQ, ready), [ready, Math.round(verseQ * 30), p.verseText, p.ref, p.verseKey]);
  const items = bidItems(p.items);
  const itemTex = useCanvasTex(1024, 256 * 6, (g) => { g.clearRect(0, 0, 1024, 1536); items.forEach((it, i) => { g.save(); g.translate(0, i * 256); drawSandWord(g, it.text, 1, ready); g.restore(); }); }, [ready, p.items]);
  const abTex = useCanvasTex(1024, 768, (g) => {
    g.clearRect(0, 0, 1024, 768);
    [p.aText, p.bText, p.verdictText].forEach((x, i) => { if (!x) return; g.save(); g.translate(0, i * 256); drawSandWord(g, x, 1, ready); g.restore(); });
  }, [ready, p.aText, p.bText, p.verdictText]);
  const under = shot === "strata";
  const topY = useMemo(cutTop, []);
  const cuts = bidCuts(shot, dur);
  const cut = cuts.find((c) => t >= c.a && t < c.b) ?? cuts[cuts.length - 1]!;
  // تحت الرمل: النزول عند كلمته، وقبلها الكاميرا فوق سطح المكان نفسه
  const descend = shot === "strata" ? prog("descend") : 1;
  const cam = shot === "strata" && cut === cuts[0] ? camOf({ ...cut, a: ev("descend")!.a, b: ev("descend")!.b }, t, still) : camOf(cut, t, still);
  void descend;
  const lights = bidLights(sp, under, [-1.2, topY - 0.2, CUT.z1 + 1.6], [-1.9, topY - 0.6, CUT.z1 + 6]);
  const stoneMat = (tint: THREE.Color, set = 0) => {
    const tx = tex?.stone[set];
    return tx ? <meshStandardMaterial color={tint} map={tx[0]!} normalMap={tx[1]!} normalScale={new THREE.Vector2(0.8, 0.8)} roughnessMap={tx[2]!} /> : <meshStandardMaterial color={tint} roughness={0.9} />;
  };
  const stoneAt = (key: string, st: ReturnType<typeof useStones>[number], x: number, z: number, scale: number, drop: number) => (
    <group key={key}>
      <mesh geometry={st.g} position={[x, yAt(x, z) + (-st.minY - st.sink * st.height) * scale + drop, z]} rotation={[st.tilt[0], st.rot, st.tilt[1]]} scale={scale} castShadow={drop < 0.12} receiveShadow>{stoneMat(st.tint, st.tex)}</mesh>
      {drop < 0.02 && <mesh position={[x, yAt(x, z) + 0.008, z]} rotation={[-Math.PI / 2, 0, st.rot]} renderOrder={1}><planeGeometry args={[scale * 2.9, scale * 2.3]} /><meshBasicMaterial map={contact} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-4} /></mesh>}
    </group>
  );
  /** مستطيل نص على السطح (رمل أو حجر): جزء من خامة نصوص (row من rows) */
  const decal = (key: string, map: THREE.Texture, x: number, z: number, w: number, y: number, rot = 0, row = 0, rows = 1, opacity = 1) => {
    const m = map.clone(); m.repeat.set(1, 1 / rows); m.offset.set(0, 1 - (row + 1) / rows); m.needsUpdate = true;
    return <mesh key={key} position={[x, y, z]} rotation={[-Math.PI / 2, 0, rot]} renderOrder={2}><planeGeometry args={[w, w / 4]} /><meshStandardMaterial map={m} transparent opacity={opacity} roughness={0.9} depthWrite={false} polygonOffset polygonOffsetFactor={-6} /></mesh>;
  };
  // موضع الكلمة المكتوبة في الرمل: على الأرض بين الكاميرا وهدفها في الزاوية الأولى (حيث تُقرأ)، والختم إلى يسارها
  // الكلمة والختم في زاوية القطع الذي تقع فيه لحظتهما، فيُريان حين يُكتبان (ويبقيان في مكانهما بعده)
  const setupAt = (e?: BidEvent) => (e ? Math.max(0, cuts.findIndex((c) => e.a >= c.a && e.a < c.b)) : 0);
  const { markAt, markW, markRot } = bidMarkPlace(shot, setupAt(ev("mark")));
  const { stampAt, markRot: stampRot } = bidMarkPlace(shot, setupAt(ev("stamp")));
  const sentence = (() => {
    // الترجمة سطر هادئ (جملة جملة) بلا مستطيل (D187، D192)، بنبرة اللقطة
    if (props.captions === false || !words.length) return null;
    const ends = splitWords(props.narration ?? "").map((w, i) => (/[.؟!،]$/.test(w) ? i : -1)).filter((i) => i >= 0);
    const bounds = [-1, ...ends.filter((i) => i < words.length - 1), words.length - 1];
    for (let k = bounds.length - 1; k > 0; k--) {
      const a = bounds[k - 1]! + 1, b = bounds[k]!;
      if (words[a] && words[a]!.s - 0.15 <= t) return { text: words.slice(a, b + 1).map((x) => x.w).join(" "), fade: Math.min(1, Math.max(0, (t - words[a]!.s + 0.15) / 0.13)), si: k };
    }
    return null;
  })();
  const tone = BID_CAPTION_TONE[shot];
  const showSpiral = shot === "aerial" || shot === "horizon" || shot === "shore";
  const lineP = shot === "line" ? prog("line") : 1;
  let ri = 0;
  let ly = topY;
  const stampWord = (BID_STAMPS as readonly string[]).includes(p.stamp ?? "") ? (p.stamp as BidStamp) : null;
  const stE = ev("stamp");
  // الميزان يميل إلى كفة «نار» عند كلمة الحكم (ظن إبليس)، كما في نسخة الـ2D المعتمدة
  const tilt = shot === "scale" ? prog("verdict") * 0.16 : 0;
  return (
    <SceneShell {...props} captions={false} eyebrow={undefined} motif={false} watermark={false} background={K.dusk} durationInFrames={durationInFrames} exitFrames={0} frameless>
      <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, lights, still)} background={mixC(K.dusk, K.haze, Math.round(sp * 120) / 120)} shadows="soft">
        <RedrawWhenReady ready={ready && Boolean(tex)} />
        <DepthOfField focus={cam.focus} aperture={cut.aperture} maxblur={0.005} />
        {tex && (<>
          <BidEarth tex={tex} sp={sp} level={level} te={te} width={width} height={height} />
          {/* الحلزون في الماء: أثر الحلقة كلها في لقطات الشاطئ والأفق والختام */}
          {showSpiral && path.map(([x, z], i) => stoneAt(`sp${i}`, lineStones[i]!, x, z, lineStones[i]!.s, 0))}
          {shot === "line" && path.slice(0, 16).map(([x, z], i) => { const q = ease(span(lineP * 16, i, 1.4)); return q > 0 ? stoneAt(`l${i}`, lineStones[i]!, x, z, lineStones[i]!.s, (1 - q) * 0.6) : null; })}
          {shot === "line" && <RedThread points={path.slice(0, 12).map(([x, z], i) => { const ox = 0.16 + 0.07 * Math.sin(i * 1.7); return [x + ox, yAt(x + ox, z) + 0.012, z + 0.06] as V3; })} p={Math.min(1, lineP * 1.6)} knot={prog("knot")} knotAt={0.5} radius={0.012} />}
          {shot === "fan" && (<>
            {prog("origin") > 0 && stoneAt("o", fanStones[0]!, -0.6, 3.2, 0.16, (1 - prog("origin")) * 0.5)}
            {fan.map((br, b) => br.map(([x, z], i) => { const q = ease(span(prog(`branch${b}`) * 9, i, 1.3)); const st = fanStones[1 + b * 9 + i]!; return q > 0 ? stoneAt(`f${b}-${i}`, st, x, z, st.s * (1 - i * 0.045), (1 - q) * 0.5) : null; }))}
          </>)}
          {shot === "circles" && CIRCLES.map((cc, ci) => Array.from({ length: cc.n }, (_, k) => {
            const st = ringStones[ri++]!;
            const a = (k / cc.n) * Math.PI * 2;
            if (cc.gap && Math.abs(((a + Math.PI) % (Math.PI * 2)) - Math.PI) < cc.gap / 2) return null;
            const e = ev(ci < 3 ? "village" : "city");
            const q = e ? ease(span(t, e.a + (ci < 3 ? ci * 0.15 : 0) + k * 0.02, 0.4)) : 0;
            const x = cc.x + Math.cos(a) * cc.r, z = cc.z + Math.sin(a) * cc.r;
            return q > 0 ? stoneAt(`${ci}-${k}`, st, x, z, st.s * (ci < 3 ? 0.8 : 1.1), (1 - q) * 0.5) : null;
          }))}
          {shot === "strata" && (<>
            {LAYERS.map((L, i) => {
              const y = ly - L.h / 2; ly -= L.h;
              const k = i === 0 ? "proven" : i === 1 ? "report" : "unknown";
              const e = ev(k);
              return (
                <group key={L.word}>
                  <mesh position={[(CUT.x0 + CUT.x1) / 2, y, (CUT.z0 + CUT.z1) / 2]} receiveShadow castShadow>
                    <boxGeometry args={[CUT.x1 - CUT.x0, L.h, CUT.z1 - CUT.z0]} />
                    <meshStandardMaterial map={tex.strata[0]!} normalMap={tex.strata[1]!} normalScale={new THREE.Vector2(1.6, 1.6)} roughness={1} color={L.tint} />
                  </mesh>
                  {/* «ثابت» مختوم من قبل إن لم تُحدد كلمته؛ وغيره يُختم عند كلمته وحدها (لا كلمة = لا ختم) */}
                  {(e || i === 0) && <WallStamp word={L.word} at={[-1.35, y, CUT.z1]} ready={ready} pressed={i === 0 && !e} p={e ? span(t, e.a, 0.9) : 1} />}
                </group>
              );
            })}
            <mesh position={[(CUT.x0 + CUT.x1) / 2, ly - 1.0, (CUT.z0 + CUT.z1) / 2]} receiveShadow><boxGeometry args={[CUT.x1 - CUT.x0, 2.0, CUT.z1 - CUT.z0]} /><meshStandardMaterial map={tex.strata[0]!} normalMap={tex.strata[1]!} roughness={1} color={K.soil} /></mesh>
          </>)}
          {(shot === "clay" || shot === "clay-shore") && (
            <group>
              <mesh position={[CX, yAt(CX, CZ) + 0.014, CZ]} rotation={[-Math.PI / 2, 0, 0.4]} renderOrder={1}><planeGeometry args={[0.92, 0.78]} /><meshStandardMaterial map={damp} transparent roughness={0.16} depthWrite={false} polygonOffset polygonOffsetFactor={-4} /></mesh>
              <mesh geometry={clay} position={[CX, yAt(CX, CZ) + 0.012, CZ]} rotation={[0, 0.6, 0]} scale={0.13} castShadow receiveShadow><ClayMaterial tex={tex.clay} /></mesh>
              {CLAY_CRUMBS.map(([dx, dz, r], i) => (
                <mesh key={i} geometry={crumbs[i]!} position={[CX + dx, yAt(CX, CZ) + r * 0.35, CZ + dz]} rotation={[0, i * 1.3, 0]} scale={r} castShadow receiveShadow><meshStandardMaterial color={mixC(K.earth, K.clay, 0.25)} roughness={0.85} /></mesh>
              ))}
            </group>
          )}
          {(shot === "verse" || shot === "words") && (
            <group>
              {/* لوح حجر فاتح (حجر جيري): نتوء الخامة وخشونتها بلا لونها الداكن، فيُقرأ الحبر عليه */}
              <mesh geometry={slab} position={[SX, yAt(SX, SZ) + 0.04, SZ]} castShadow receiveShadow><meshStandardMaterial color={mixC(K.sand, K.pale, 0.45)} normalMap={tex.stone[0]![1]!} normalScale={new THREE.Vector2(0.5, 0.5)} roughness={1} /></mesh>
              {shot === "verse" && <mesh position={[SX, yAt(SX, SZ) + 0.125, SZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}><planeGeometry args={[2.0, 1.25]} /><meshStandardMaterial map={verseTex} transparent roughness={0.95} depthWrite={false} polygonOffset polygonOffsetFactor={-6} /></mesh>}
              {shot === "words" && items.map((_, i) => {
                const e = ev(`item${i}`); const q = e ? ease(span(t, e.a, 0.5)) : 0;
                const x = SX + 0.75 - i * (1.5 / Math.max(1, items.length - 1 || 1)), z = SZ + 0.05 + (i % 2) * 0.12;
                return q > 0 ? (
                  <group key={i}>
                    {/* الحصاة تهبط على اللوح، والكلمة عليها */}
                    <mesh geometry={pebbles[i]!.g} position={[x, yAt(SX, SZ) + 0.15 + (1 - q) * 0.4, z]} scale={0.12} rotation={[0, pebbles[i]!.rot, 0]} castShadow>{stoneMat(new THREE.Color(K.pale), 2)}</mesh>
                    {q >= 1 && decal(`w${i}`, itemTex, x, z, 0.3, yAt(SX, SZ) + 0.19, 0, i, 6)}
                  </group>
                ) : null;
              })}
            </group>
          )}
          {shot === "scale" && (() => {
            // الميزان (الجولة ٤): عارضة من خشب الشاطئ على حجر قائم، وكفتان من حجر مسطح؛ في كفة «نار» جمر (فحم وجمرات بلا لهب ولا
            // وهج)، وفي كفة «طين» حفنة طين صغيرة. الكلمتان مكتوبتان في الرمل أمام الكفتين، والختم «ظن» يُضغط في الرمل بينهما
            const y0 = yAt(SX, SZ), beamY = 0.42;
            const qa = prog("a"), qb = prog("b");
            return (
              <group>
                <mesh position={[SX, y0 + beamY / 2, SZ]} castShadow receiveShadow><cylinderGeometry args={[0.07, 0.13, beamY, 7]} />{stoneMat(new THREE.Color(K.pale), 0)}</mesh>
                <group position={[SX, y0 + beamY + 0.03, SZ]} rotation={[0, 0, tilt]}>
                  <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow><cylinderGeometry args={[0.045, 0.038, 2.0, 12]} /><meshStandardMaterial color={mixC(K.earth, K.sand, 0.5)} roughness={0.95} /></mesh>
                  {[-0.9, 0.9].map((x, i) => (
                    <group key={i} position={[x, 0.05, 0]}>
                      <mesh castShadow receiveShadow scale={[0.34, 0.05, 0.3]}><sphereGeometry args={[1, 32, 12]} />{stoneMat(new THREE.Color(K.paper).lerp(new THREE.Color(K.pale), 0.4), 2)}</mesh>
                      {i === 0 && qa > 0 && [0, 1, 2, 3, 4, 5].map((k) => (
                        <mesh key={k} position={[Math.cos(k * 2.1) * 0.12 * (k % 3) / 2, 0.06 + 0.012 * (k % 2), Math.sin(k * 2.1) * 0.1 * (k % 3) / 2]} scale={0.045 + 0.01 * (k % 3)} castShadow>
                          <dodecahedronGeometry args={[1, 0]} />
                          <meshStandardMaterial color={k % 2 ? K.soil : mixC(K.soil, K.clay, 0.35)} emissive={K.sun} emissiveIntensity={(k % 2 ? 0.15 : 0.5) * qa} roughness={0.9} />
                        </mesh>
                      ))}
                      {i === 1 && qb > 0 && <mesh geometry={clay} position={[0, 0.045, 0]} scale={0.07 * qb} castShadow><ClayMaterial tex={tex.clay} /></mesh>}
                    </group>
                  ))}
                </group>
                {qa > 0 && decal("la", abTex, SX - 0.8, SZ + 0.7, 1.1, yAt(SX - 0.8, SZ + 0.7) + 0.03, 0, 0, 3, qa)}
                {qb > 0 && decal("lb", abTex, SX + 0.8, SZ + 0.7, 1.1, yAt(SX + 0.8, SZ + 0.7) + 0.03, 0, 1, 3, qb)}
                {ev("verdict") && <ProofStamp word="ظن" at={[SX, y0 + 0.012, SZ + 0.62]} press={span(t, ev("verdict")!.a, 0.3)} lift={span(t, ev("verdict")!.a + 0.35, 0.4)} ready={ready} size={0.3} ink={K.ribbon} />}
              </group>
            );
          })()}
          {shot === "paths" && (<>
            {stoneAt("start", pathStones[0]!, twoPaths()[0][0]![0], twoPaths()[0][0]![1], 0.17, 0)}
            {away.map(([x, z], i) => { const q = ease(span(prog("a") * away.length, i, 1.3)); const st = pathStones[1 + i]!; return q > 0 ? stoneAt(`pa${i}`, st, x, z, st.s * 0.9, (1 - q) * 0.5) : null; })}
            {back.map(([x, z], i) => { const q = ease(span(prog("b") * back.length, i, 1.3)); const st = pathStones[1 + away.length + i]!; return q > 0 ? stoneAt(`pb${i}`, st, x, z, st.s * 0.9, (1 - q) * 0.5) : null; })}
            {prog("a") > 0.6 && decal("la", abTex, away[0]![0] - 0.55, away[0]![1] - 0.55, 1.1, yAt(away[0]![0] - 0.55, away[0]![1] - 0.55) + 0.03, 0, 0, 3, span(prog("a"), 0.6, 0.4))}
            {prog("b") > 0.6 && decal("lb", abTex, away[0]![0] + 0.75, away[0]![1] - 0.55, 1.1, yAt(away[0]![0] + 0.75, away[0]![1] - 0.55) + 0.03, 0, 1, 3, span(prog("b"), 0.6, 0.4))}
          </>)}
          {p.mark && markQ > 0 && decal("mark", markTex, markAt[0], markAt[1], markW, yAt(markAt[0], markAt[1]) + 0.03, markRot)}
          {stampWord && stE && <ProofStamp word={stampWord} at={[stampAt[0], yAt(stampAt[0], stampAt[1]) + 0.012, stampAt[1]]} press={span(t, stE.a, 0.3)} lift={span(t, stE.a + 0.35, 0.4)} ready={ready} size={0.5} ink={stampWord === "ثابت" ? K.ribbon : K.soil} tilt={stampRot} />}
        </>)}
      </Stage3D>
      {/* صوت المكان، ومع كل حركة صوتها (D158) */}
      <Audio src={SFX("silence-room")} volume={0.3} loop />
      {events.map((e) => <Sequence key={e.id} from={Math.round((e.a + (e.sfx === "stamp" ? 0.28 : 0)) * fps)} durationInFrames={Math.max(15, Math.round((e.b - e.a + 0.4) * fps))}><Audio src={SFX(e.sfx)} volume={e.sfx === "stamp" ? 0.4 : 0.3} /></Sequence>)}
      <BidCaption line={sentence} tones={(sentence?.text ?? "").split(" ").map(() => tone)} bottom={props.orientation === "portrait" ? 460 : 56} />
    </SceneShell>
  );
};

/** نماذج المعاينة (محتوى «دفاتر الزمن» 001 نفسه، لا يُنشر) */
export const bidayatSamples: Record<BidTemplateId, Record<string, string>> = {
  "bidayat-shore": { shot: "shore", sun: "0.2", narration: "عرفت الأرض أممًا كثيرة، وتعاقبت عليها أجيال لا يعلم عددها إلا الله.", mark: "أمم", markWord: "أممًا" },
  "bidayat-line": { shot: "line", sun: "0.85", narration: "ومن هنا تتصل قصة آدم عليه السلام بتاريخ البشرية على الأرض.", lineWord: "ومن", knotWord: "البشرية" },
  "bidayat-strata": { shot: "strata", sun: "0.86", narration: "لقد اشتهرت في ذلك روايات مختلفة، ولا نعلم نصًا صحيحًا صريحًا يحدد لنا موضع هبوطه على وجه الجزم.", descendWord: "لقد", reportWord: "روايات", unknownWord: "نعلم" },
  "bidayat-clay": { shot: "clay", sun: "0.3", narration: "خلق الله آدم من طين، وقد ورد في سورة ص خبر خلقه وتسويته ونفخ الروح فيه." },
  "bidayat-stone": { shot: "scale", sun: "0.5", narration: "فحين سئل عن ذلك، قال إنه خير من آدم؛ لأن الله خلقه من نار وخلق آدم من طين.", aText: "نار", aWord: "نار", bText: "طين", bWord: "طين", verdictText: "ظن", verdictWord: "طين" },
};
export const bidayatSeconds = 9;
