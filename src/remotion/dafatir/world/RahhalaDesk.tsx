/**
 * قالب «مكتب الرحّالة» (rahhala-desk) لدفاتر الزمن — العالم المعتمد (D190) بمعايير «الحِرفة» (D189) قالبًا يُستعمل
 * مشهدًا مشهدًا في الحلقات الجديدة (الحلقات الأولى ثنائية الأبعاد، والجديدة ثلاثية، D191). D194.
 * المشهد لقطة واحدة من خمس يختارها حقل shot، وكل حدث فيها لحظة نطق كلمته (حقول «كلمة …»):
 *  - astrolabe: العنكبوت يدور حتى السنة (year) وتظهر مطعّمة بالفضة عند كلمتها.
 *  - map: الحبر يرسم الطريق من مكان إلى مكان على خريطة رقّ قديمة، والماء وحده لازوردي (D188).
 *  - city: القطعة المخصوصة (المدينة المدوّرة بطوب اللبن) ترتفع من المكتب عند كلمتها.
 *  - document: وثيقة تسقط وتستقر، وسطر يُكتب ويتشرب عند كلمته، وختم بأثر ناقص عند كلمته.
 *  - desk: المكتب كله (لقطة الختام الواسعة).
 * لا يُرسم ما لم تحدده الحقول (القاعدة الثالثة): كلمة غير موجودة في النص = لا حدث، والفراغ أفضل من عنصر خاطئ.
 * التوقيت من صوت الراوي إن وُجد، وإلا تقديري بالقاعدة نفسها التي يقيس بها السكونُ المقصود (estimateTimings)،
 * فيتطابق الحدث والترجمة ونوافذ السكون. عند ذكر الله والدعاء: لا مفتاح ولا ارتعاش ولا كاميرا ولا غبار.
 * المشهد الطويل يُقطع لقطات ٢–٨ ث بين زاويتين للّقطة نفسها (لا لقطة أطول من ٨ ث). بلا وجوه، ولا يُصوَّر نبي ولا صحابي.
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useBrandFonts } from "../../useBrandFonts";
import { BeamDust, CAPTION_SHADOW, DepthOfField, Stage3D, calmAt, ease, lightsAt, orbit, safeKeys, swing, useAssetTextures, type CamState, type Light, type V3, type Window } from "../../three";
import { estimateTimings, splitWords, type WordTiming } from "../../scenes/timing";
import { SACRED_WORD, duaRanges } from "../../../render/stillnessSpans";
import { normalizeArabic } from "../../../script/quranMeta";
import type { SceneBase, StringFields } from "../../scenes/types";
import { SceneShell } from "../../scenes/SceneShell";
import {
  ASTRO_AT, ATLAS_AT, CANDLE_AT, CITY_AT, Candle, DOC_AT, Inkwell, K, LeatherBook, MAP_H, MAP_W, RoundCity,
  canvasOf, drawAstro, ink, parchment, pathTo, span, useCanvasTex, wash,
} from "./DeskWorld";

import { RAHHALA_CITIES, RAHHALA_SHOTS, type RahhalaShotId } from "./shots";
export { RAHHALA_CITIES, RAHHALA_SHOTS, type RahhalaShotId };

export type RahhalaDeskProps = SceneBase & StringFields<"shot" | "year" | "era" | "yearWord" | "mapTitle" | "water" | "fromPlace" | "fromWord" | "toPlace" | "toWord" | "city" | "cityWord" | "docTitle" | "docLines" | "docWrite" | "docWord" | "stamp" | "stampWord">;

// ——— الزمن ———
type W = { w: string; s: number; e: number };
const clean = (w: string) => normalizeArabic(w).replace(/[،,.:؛؟!«»"()﴿﴾]/g, "");
/** كلمات المشهد بالثواني: من صوت الراوي، وإلا التقدير نفسه الذي تستعمله الترجمة ونوافذ السكون */
export const rahhalaWords = (narration: string, timings: WordTiming[] | undefined, fps: number, frames: number): W[] =>
  (timings?.length ? timings : estimateTimings(narration, 6, frames - 12)).map((x) => ({ w: x.word, s: x.start / fps, e: x.end / fps }));
/** بداية الكلمة المرسى («كلمة» أو «كلمة#2» للورود الثاني) بالبادئة بعد التطبيع؛ لا وجود = null (لا حدث) */
export const anchorAt = (words: W[], anchor?: string): number | null => {
  if (!anchor?.trim()) return null;
  const [raw, n] = anchor.trim().split("#");
  const p = clean(raw!), nth = Math.max(1, Number(n) || 1);
  if (!p) return null;
  return words.filter((x) => clean(x.w).startsWith(p))[nth - 1]?.s ?? null;
};
/** السكون المقصود بقواعد src/render/stillnessSpans.ts نفسها: كل ذكر لله ±٠٫٢٥ ث، والدعاء */
export const rahhalaStill = (words: W[]): Window[] => {
  const out: Window[] = [];
  for (const x of words) if (SACRED_WORD.test(normalizeArabic(x.w))) out.push([x.s - 0.25, x.e + 0.25]);
  for (const [a, b] of duaRanges(words.map((x) => x.w))) out.push([words[a]!.s - 0.25, words[b]!.e + 0.25]);
  return out;
};
/** زمن «فعّال» لا يتقدم داخل نوافذ السكون: الكاميرا تقف فيها ثم تكمل من حيث وقفت */
const effective = (t: number, still: Window[]) => {
  let x = t;
  for (const [s, e] of still) x -= Math.max(0, Math.min(t, e) - Math.max(0, s));
  return x;
};

// ——— اللقطات ———
type ShotCam = { target: V3; yaw: number; pitch: number; dist: number; fov: number };
type Setup = { size: "detail" | "medium" | "close" | "wide"; from: ShotCam; to: ShotCam; aperture: number };
const SETUPS: Record<RahhalaShotId, [Setup, Setup]> = {
  astrolabe: [
    // السنة المطعّمة أسفل القرص: الكاميرا تميل إليها فلا تغطيها الترجمة
    { size: "detail", aperture: 0.03, from: { target: [ASTRO_AT[0], ASTRO_AT[1], ASTRO_AT[2] + 0.08], yaw: 20, pitch: 78, dist: 1.5, fov: 30 }, to: { target: [ASTRO_AT[0], ASTRO_AT[1], ASTRO_AT[2] + 0.18], yaw: 4, pitch: 84, dist: 1.35, fov: 30 } },
    { size: "medium", aperture: 0.016, from: { target: [ASTRO_AT[0] - 0.3, 0.05, ASTRO_AT[2] + 0.1], yaw: -28, pitch: 46, dist: 2.4, fov: 32 }, to: { target: [ASTRO_AT[0] - 0.2, 0.05, ASTRO_AT[2]], yaw: -16, pitch: 52, dist: 2.1, fov: 32 } },
  ],
  map: [
    { size: "medium", aperture: 0.016, from: { target: [ATLAS_AT[0] + 0.66, 0, ATLAS_AT[2] + 0.05], yaw: -6, pitch: 74, dist: 2.75, fov: 34 }, to: { target: [ATLAS_AT[0] + 0.6, 0, ATLAS_AT[2] + 0.0], yaw: 0, pitch: 82, dist: 2.1, fov: 32 } },
    { size: "detail", aperture: 0.026, from: { target: [ATLAS_AT[0] + 0.5, 0.05, ATLAS_AT[2] - 0.05], yaw: 18, pitch: 62, dist: 1.3, fov: 30 }, to: { target: [ATLAS_AT[0] + 0.42, 0.05, ATLAS_AT[2] - 0.22], yaw: 8, pitch: 70, dist: 1.1, fov: 30 } },
  ],
  city: [
    { size: "wide", aperture: 0.012, from: { target: [CITY_AT[0], 0.06, CITY_AT[2]], yaw: 0, pitch: 86, dist: 2.2, fov: 32 }, to: { target: [CITY_AT[0] + 0.2, 0.08, CITY_AT[2] - 0.1], yaw: -35, pitch: 38, dist: 2.6, fov: 32 } },
    { size: "close", aperture: 0.022, from: { target: [CITY_AT[0], 0.1, CITY_AT[2]], yaw: 30, pitch: 22, dist: 1.7, fov: 30 }, to: { target: [CITY_AT[0], 0.1, CITY_AT[2]], yaw: 58, pitch: 26, dist: 1.5, fov: 30 } },
  ],
  document: [
    { size: "close", aperture: 0.02, from: { target: [DOC_AT[0], 0, DOC_AT[2]], yaw: 12, pitch: 66, dist: 2.0, fov: 32 }, to: { target: [DOC_AT[0] - 0.1, 0, DOC_AT[2] + 0.15], yaw: 4, pitch: 74, dist: 1.75, fov: 32 } },
    // السطر المكتوب والختم معًا (الختم أسفل يسار الوثيقة، السطر فوقه)
    { size: "detail", aperture: 0.024, from: { target: [DOC_AT[0] - 0.02, 0, DOC_AT[2] + 0.12], yaw: 10, pitch: 66, dist: 1.45, fov: 30 }, to: { target: [DOC_AT[0] - 0.08, 0, DOC_AT[2] + 0.2], yaw: 4, pitch: 72, dist: 1.25, fov: 30 } },
  ],
  desk: [
    // لقطة المكتب بلا أحداث: الكاميرا ترتفع وتدور حول المكتب كله (حركة الختام نفسها هي الحدث)
    { size: "wide", aperture: 0.006, from: { target: [0.3, 0, 0.3], yaw: 18, pitch: 30, dist: 5.6, fov: 34 }, to: { target: [-0.2, 0, 0], yaw: -16, pitch: 54, dist: 7.6, fov: 34 } },
    { size: "wide", aperture: 0.008, from: { target: [-0.4, 0, 0], yaw: -30, pitch: 36, dist: 5.8, fov: 34 }, to: { target: [0.2, 0, 0], yaw: 6, pitch: 48, dist: 7.0, fov: 34 } },
  ],
};
export type RahhalaCut = Setup & { a: number; b: number };
/** اللقطات داخل المشهد: لقطة واحدة إلى ٨ ث، وفوقها قطع متساوية (≤٧ ث) تتناوب بين زاويتي اللقطة */
export const rahhalaCuts = (shot: RahhalaShotId, dur: number): RahhalaCut[] => {
  const n = dur <= 8 ? 1 : Math.ceil(dur / 7);
  return Array.from({ length: n }, (_, i) => ({ ...SETUPS[shot][i % 2]!, a: (i * dur) / n, b: ((i + 1) * dur) / n }));
};
const camOf = (c: RahhalaCut, t: number, still: Window[]): CamState & { focus: number } => {
  const p = ease(span(effective(t, still), effective(c.a, still), Math.max(0.01, effective(c.b, still) - effective(c.a, still))));
  const L = (x: number, y: number) => x + (y - x) * p;
  const s = { target: [L(c.from.target[0], c.to.target[0]), L(c.from.target[1], c.to.target[1]), L(c.from.target[2], c.to.target[2])] as V3, yaw: L(c.from.yaw, c.to.yaw), pitch: L(c.from.pitch, c.to.pitch), dist: L(c.from.dist, c.to.dist), fov: L(c.from.fov, c.to.fov) };
  return { position: orbit(s), target: s.target, fov: s.fov, focus: s.dist };
};

// ——— الرسم على الرّق ———
const AR = (n: string) => n.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
/** الخريطة: إطار وعنوان، وماء لازوردي إن ذُكر، والطريق يُرسم بالحبر من مكان إلى مكان ويتشرب */
const FROM_PX: [number, number] = [MAP_W * 0.7, MAP_H * 0.74], TO_PX: [number, number] = [MAP_W * 0.32, MAP_H * 0.36];
export const routePts = (): [number, number][] => Array.from({ length: 24 }, (_, i) => {
  const k = i / 23, x = FROM_PX[0] + (TO_PX[0] - FROM_PX[0]) * k, y = FROM_PX[1] + (TO_PX[1] - FROM_PX[1]) * k;
  return [x + Math.sin(k * Math.PI) * 170 + Math.sin(k * 9) * 14, y + Math.sin(k * 7 + 1) * 12];
});
const drawRouteMap = (g: CanvasRenderingContext2D, p: Record<string, string | undefined>, fromP: number, route: number, toP: number, age: CanvasImageSource | null) => {
  const w = MAP_W, h = MAP_H;
  parchment(g, w, h, 5, age);
  g.lineWidth = 6; g.strokeStyle = K.ink; g.strokeRect(70, 70, w - 140, h - 140);
  g.lineWidth = 14; g.strokeStyle = K.gold; g.strokeRect(96, 96, w - 192, h - 192);
  g.textAlign = "center"; g.direction = "rtl";
  if (p.mapTitle) {
    g.fillStyle = K.dusk; g.fillRect(w / 2 - 380, 150, 760, 170); g.strokeStyle = K.gold; g.lineWidth = 8; g.strokeRect(w / 2 - 368, 162, 736, 146);
    g.fillStyle = K.goldLight; g.font = "bold 104px Amiri"; g.fillText(p.mapTitle, w / 2, 268);
  }
  // معالم الرّق نفسها (خطوط الطول والعرض باهتة)، لا مدن ولا أسماء لم تُذكر
  g.save(); g.globalAlpha = 0.08; g.strokeStyle = K.ink; g.lineWidth = 3;
  for (let x = 260; x < w - 160; x += 220) { g.beginPath(); g.moveTo(x, 360); g.lineTo(x, h - 160); g.stroke(); }
  for (let y = 420; y < h - 160; y += 220) { g.beginPath(); g.moveTo(150, y); g.lineTo(w - 150, y); g.stroke(); }
  g.restore();
  if (p.water) {
    // الماء لازوردي (D188): نهر يجاور الطريق بغسيل بحواف غير منتظمة وضفتين بالحبر، واسمه
    const bank = routePts().map(([x, y], i): [number, number] => [x + 150 + Math.sin(i * 0.8) * 18, y + 40]);
    const ext: [number, number][] = [[bank[0]![0] + 60, h - 150], ...bank, [bank[bank.length - 1]![0] + 40, 330]];
    const poly: [number, number][] = [...ext.map(([x, y]): [number, number] => [x - 26, y]), ...[...ext].reverse().map(([x, y]): [number, number] => [x + 26, y])];
    wash(g, poly, K.lapis, 1, 1); wash(g, poly, K.lapis, 1, 2);
    ink(g, ext.map(([x, y]): [number, number] => [x - 30, y]), 1, 5, K.ink, 1); ink(g, ext.map(([x, y]): [number, number] => [x + 30, y]), 1, 5, K.ink, 1);
    const mid = ext[Math.floor(ext.length / 2)]!;
    g.save(); g.translate(mid[0] + 90, mid[1]); g.rotate(-1.25); g.fillStyle = K.lapis; g.font = "bold 88px Amiri"; g.fillText(p.water, 0, 0); g.restore();
  }
  const place = (at: [number, number], name: string | undefined, q: number, main: boolean) => {
    if (q <= 0 || !name) return;
    g.save(); g.globalAlpha = Math.min(1, q * 1.4);
    g.fillStyle = main ? K.vermilion : K.ink; g.beginPath(); g.arc(at[0], at[1], (main ? 46 : 34) * q, 0, Math.PI * 2); g.fill();
    if (main) { g.strokeStyle = K.gold; g.lineWidth = 10; g.beginPath(); g.arc(at[0], at[1], 62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * q); g.stroke(); }
    g.fillStyle = main ? K.vermilion : K.ink; g.font = `bold ${main ? 104 : 88}px Amiri`; g.fillText(name, at[0], at[1] + (main ? 170 : 140));
    g.restore();
  };
  place(FROM_PX, p.fromPlace, fromP, false);
  if (route > 0) { g.save(); g.setLineDash([34, 22]); ink(g, routePts(), route, 12, K.vermilion, span(route, 0.6, 0.4)); g.restore(); }
  place(TO_PX, p.toPlace, toP, true);
};
/** الصفحة المقابلة: رقّ بسطور حبر باهتة بلا كلام (لا نص لم يُطلب) */
const drawBlank = (g: CanvasRenderingContext2D, age: CanvasImageSource | null) => {
  parchment(g, MAP_W, MAP_H, 9, age);
  g.lineWidth = 6; g.strokeStyle = K.ink; g.strokeRect(70, 70, MAP_W - 140, MAP_H - 140);
  g.save(); g.globalAlpha = 0.09; g.strokeStyle = K.ink; g.lineWidth = 3;
  for (let y = 300; y < MAP_H - 200; y += 110) { g.beginPath(); g.moveTo(170, y); g.lineTo(MAP_W - 170, y); g.stroke(); }
  g.restore();
};
/** الوثيقة: عنوان وسطور، والسطر المنطوق يُكتب ويتشرب، والختم بأثر ناقص */
const drawDocument = (g: CanvasRenderingContext2D, w: number, h: number, p: Record<string, string | undefined>, write: number, soak: number, stamp: number, age: CanvasImageSource | null) => {
  parchment(g, w, h, 17, age);
  g.direction = "rtl"; g.textAlign = "right"; g.fillStyle = K.ink;
  if (p.docTitle) { g.font = "bold 84px 'Aref Ruqaa'"; g.fillText(p.docTitle, w - 110, 190); }
  const lines = (p.docLines ?? "").split("|").map((x) => x.trim()).filter(Boolean).slice(0, 4);
  g.font = "60px Amiri"; lines.forEach((l, i) => g.fillText(l, w - 110, 330 + i * 92));
  const y = 330 + lines.length * 92 + 140;
  if (p.docWrite && write > 0) {
    g.save(); g.beginPath(); g.rect(w - 110 - 1000 * write, y - 100, 1000 * write, 140); g.clip();
    if (soak > 0) { g.filter = `blur(${1.5 + soak * 2}px)`; g.globalAlpha = 0.25 * soak; g.font = "bold 86px Amiri"; g.fillText(p.docWrite, w - 110, y + 2); }
    g.filter = "none"; g.globalAlpha = 1; g.font = "bold 86px Amiri"; g.fillText(p.docWrite, w - 110, y);
    g.restore();
  }
  if (p.stamp && stamp > 0) {
    const [sc, sg] = canvasOf(560, 560);
    sg.translate(280, 280); sg.rotate(-0.18); sg.strokeStyle = K.vermilion; sg.fillStyle = K.vermilion;
    sg.lineWidth = 16; sg.beginPath(); sg.arc(0, 0, 230, 0, Math.PI * 2); sg.stroke(); sg.lineWidth = 6; sg.beginPath(); sg.arc(0, 0, 186, 0, Math.PI * 2); sg.stroke();
    sg.textAlign = "center"; sg.font = `bold ${p.stamp.length > 6 ? 84 : 130}px Amiri`; sg.fillText(AR(p.stamp), 0, 40);
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 1400; i++) { const x = ((Math.sin(i * 91.7) * 4375.5) % 1 + 1) % 1 * 560, yy = ((Math.sin(i * 17.3) * 1254.1) % 1 + 1) % 1 * 560; sg.globalAlpha = 0.5 + 0.5 * (1 - x / 560); sg.fillRect(x, yy, 3 + (i % 4), 3 + (i % 3)); }
    const fade = sg.createLinearGradient(0, 0, 560, 0); fade.addColorStop(0, "rgba(0,0,0,0.55)"); fade.addColorStop(0.6, "rgba(0,0,0,0)");
    sg.globalAlpha = 1; sg.fillStyle = fade; sg.fillRect(0, 0, 560, 560);
    g.globalAlpha = 0.9 * stamp; g.drawImage(sc, w * 0.36 - 280, h * 0.74 - 280); g.globalAlpha = 1;
  }
};

const SFX = (f: string) => staticFile(`three/sfx/${f}.mp3`);
/** أحداث المشهد بأزمانها (بعد تأخير ما يقع في نافذة سكون): كل حدث له صوته (D158) */
export type RahhalaEvent = { id: string; a: number; b: number; sfx: string };
export const rahhalaEvents = (shot: RahhalaShotId, p: Record<string, string | undefined>, words: W[], still: Window[]): RahhalaEvent[] => {
  const ev: RahhalaEvent[] = [];
  const add = (id: string, at: number | null, d: number, sfx: string) => { if (at !== null) ev.push({ id, a: Math.max(0, at - 0.1), b: Math.max(0, at - 0.1) + d, sfx }); };
  if (shot === "astrolabe" && p.year) { const y = anchorAt(words, p.yearWord); if (y !== null) ev.push({ id: "rete", a: 0.3, b: Math.max(0.9, y), sfx: "tick" }); add("year", y, 0.4, "tick"); }
  if (shot === "map") {
    const f = p.fromPlace ? anchorAt(words, p.fromWord) : null, to = p.toPlace ? anchorAt(words, p.toWord) : null;
    add("from", f, 0.6, "quill-write");
    if (f !== null && to !== null && to > f) ev.push({ id: "route", a: f + 0.4, b: Math.max(f + 1.2, to), sfx: "quill-write" });
    add("to", to, 0.8, "pen-write");
  }
  if (shot === "city" && p.city && RAHHALA_CITIES[p.city]) add("rise", anchorAt(words, p.cityWord), 1.6, "drop-soft");
  if (shot === "document") {
    ev.push({ id: "land", a: 0.15, b: 0.5, sfx: "swipe-paper" });
    if (p.docWrite) add("write", anchorAt(words, p.docWord), 1.3, "pen-write");
    if (p.stamp) add("stamp", anchorAt(words, p.stampWord), 0.9, "stamp");
  }
  // كل حدث يُؤخَّر وحده عن نافذة السكون (الأحداث تتداخل عمدًا: الطريق يكتمل مع وصول المكان)
  return ev.map((e) => { const k = safeKeys([{ a: e.a, b: e.b, to: e }], still)[0]!; return { ...e, a: k.a, b: k.b }; });
};

export const RahhalaDesk: React.FC<RahhalaDeskProps> = (props) => {
  const ready = useBrandFonts();
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const t = frame / fps, dur = durationInFrames / fps;
  const p = props as unknown as Record<string, string | undefined>;
  const shot: RahhalaShotId = (props.shot && props.shot in RAHHALA_SHOTS ? props.shot : "desk") as RahhalaShotId;
  const words = React.useMemo(() => rahhalaWords(props.narration ?? "", props.narrationTimings, fps, durationInFrames), [props.narration, props.narrationTimings, fps, durationInFrames]);
  const still = React.useMemo(() => rahhalaStill(words), [words]);
  const events = React.useMemo(() => rahhalaEvents(shot, p, words, still), [shot, words, still, JSON.stringify(p)]); // eslint-disable-line react-hooks/exhaustive-deps
  const ev = (id: string) => events.find((e) => e.id === id);
  const prog = (id: string) => { const e = ev(id); return e ? ease(span(t, e.a, e.b - e.a)) : 0; };
  const wood = useAssetTextures(["dafatir-walnut-diff", "dafatir-walnut-nor", "dafatir-walnut-rough"], [4, 2.6]);
  const leather = useAssetTextures(["dafatir-leather-diff", "dafatir-leather-nor"]);
  const age = useAssetTextures(["dafatir-age-diff"]);
  const brick = useAssetTextures(["dafatir-mudbrick-diff", "dafatir-mudbrick-nor"]);
  const ageImg = (age?.[0]?.image as CanvasImageSource | undefined) ?? null;
  const fromP = prog("from"), route = prog("route"), toP = prog("to");
  const mapTex = useCanvasTex(MAP_W, MAP_H, (g) => drawRouteMap(g, p, fromP, route, toP, ageImg), [ready, shot === "map" ? frame : 0, Boolean(ageImg), JSON.stringify(p)]);
  const blankTex = useCanvasTex(MAP_W, MAP_H, (g) => drawBlank(g, ageImg), [ready, Boolean(ageImg)]);
  const write = prog("write"), soak = ev("write") ? span(t, ev("write")!.b - 0.3, 1.5) : 0, stampP = ev("stamp") ? span(t, ev("stamp")!.a + 0.25, 0.06) : 0;
  const docTex = useCanvasTex(1200, 1560, (g) => drawDocument(g, 1200, 1560, p, write, soak, stampP, ageImg), [ready, shot === "document" ? frame : 0, Boolean(ageImg), JSON.stringify(p)]);
  const yearN = Number(String(p.year ?? "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))) || 0;
  const base = Math.floor(yearN / 100) * 100;
  const yearShown = shot === "astrolabe" && yearN ? prog("year") : 0;
  const label = yearN ? `${AR(String(yearN))} ${p.era?.trim() || "هـ"}` : "";
  const astroTex = useCanvasTex(1024, 1024, (g) => drawAstro(g, 1024, yearShown, label, base), [ready, Math.round(yearShown * 20), label, base]);
  const cuts = rahhalaCuts(shot, dur);
  const cut = cuts.find((c) => t >= c.a && t < c.b) ?? cuts[cuts.length - 1]!;
  const cam = camOf(cut, t, still);
  const calm = calmAt(t, still);
  const rete = shot === "astrolabe" && yearN ? base + (yearN - base) * prog("rete") : base + 20;
  const pointer = ((rete - base) / 100) * Math.PI * 1.6 - Math.PI * 0.8;
  const land = ev("land");
  const docY = !land ? 0 : t < land.a ? 0.45 : t < land.b ? 0.45 * (1 - ease((t - land.a) / (land.b - land.a))) : Math.abs(swing(t, land.b, 0.025, 3.2, 7)) * calm;
  const docTilt = !land ? 0 : t < land.b ? 0.06 : swing(t, land.b, 0.05, 2.4, 6) * calm;
  const st = ev("stamp");
  const sd = st ? span(t, st.a, 0.2) : 0, su = st ? span(t, st.a + 0.4, 0.4) : 0;
  const stampAt: V3 = [-0.2 - 1.3 * ease(su), 0.9 - 0.82 * ease(sd) * (1 - ease(su)) + 0.9 * ease(su), 0.3 - 0.9 * ease(su)];
  const rise = prog("rise");
  if (!wood || !leather || !age || !brick) return null;
  const pr = t / Math.max(1, dur);
  const lights: Light[] = [
    { kind: "ambient", kelvin: 3600, intensity: 0.95, position: [0, 0, 0] },
    { kind: "key", kelvin: 4400 - 400 * pr, intensity: 2.6, position: [-7 + pr, 8, -5 + pr] },
    { kind: "practical", kelvin: 1900, intensity: 1.6, position: [CANDLE_AT[0], 0.75, CANDLE_AT[2]], flicker: { depth: 0.2, rate: 7, seed: 41 } },
  ];
  const sentence = (() => {
    // الترجمة سطر هادئ (جملة جملة) بلا مستطيل خلفه (D187، D192)
    if (props.captions === false || !words.length) return null;
    const ends = splitWords(props.narration ?? "").map((w, i) => (/[.؟!،]$/.test(w) ? i : -1)).filter((i) => i >= 0);
    const bounds = [-1, ...ends.filter((i) => i < words.length - 1), words.length - 1];
    for (let k = bounds.length - 1; k > 0; k--) {
      const a = bounds[k - 1]! + 1, b = bounds[k]!;
      if (words[a] && words[a]!.s - 0.15 <= t) return { text: words.slice(a, b + 1).map((x) => x.w).join(" "), fade: Math.min(1, Math.max(0, (t - words[a]!.s + 0.15) / 0.13)) };
    }
    return null;
  })();
  return (
    <SceneShell {...props} captions={false} eyebrow={undefined} motif={false} watermark={false} background={K.dusk} durationInFrames={durationInFrames} exitFrames={0} frameless>
      <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, lights, still)} background={K.dusk} shadows="variance">
        <DepthOfField focus={cam.focus} aperture={cut.aperture} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[14, 9]} /><meshStandardMaterial map={wood[0]} normalMap={wood[1]} roughnessMap={wood[2]} color="#c9b49a" /></mesh>
        <mesh position={[0, 3, -4.4]} receiveShadow><planeGeometry args={[24, 10]} /><meshStandardMaterial color={K.dusk} roughness={1} /></mesh>
        <BeamDust t={t} from={[-4.2, 4.4, -3.1]} to={[0.4, 0.2, -0.2]} radius={0.9} color={K.goldLight} count={110} seed={7} still={still} />
        <LeatherBook ts={leather} />
        <Inkwell />
        <Candle t={t} still={still} />
        <group position={ATLAS_AT}>
          <mesh position={[0, 0.02, 0]} receiveShadow castShadow><boxGeometry args={[2.62, 0.04, 1.86]} /><meshStandardMaterial color={K.brassDark} roughness={0.7} /></mesh>
          <mesh position={[0.64, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[1.26, 1.68]} /><meshStandardMaterial map={shot === "map" ? mapTex : blankTex} roughness={0.92} /></mesh>
          <mesh position={[-0.64, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[1.26, 1.68]} /><meshStandardMaterial map={blankTex} roughness={0.92} /></mesh>
          <mesh position={[0, 0.05, 0]}><boxGeometry args={[0.03, 0.02, 1.7]} /><meshStandardMaterial color={K.inkDark} /></mesh>
        </group>
        {shot === "document" && (
          <>
            <group position={[DOC_AT[0], docY, DOC_AT[2]]} rotation={[docTilt, -0.12, docTilt * 0.5]}>
              <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow><planeGeometry args={[1.15, 1.5]} /><meshStandardMaterial map={docTex} roughness={0.95} side={THREE.DoubleSide} /></mesh>
            </group>
            {p.stamp && (
              <group position={[DOC_AT[0] + stampAt[0], stampAt[1], DOC_AT[2] + stampAt[2]]}>
                <mesh castShadow><cylinderGeometry args={[0.24, 0.24, 0.12, 40]} /><meshStandardMaterial color={K.inkDark} roughness={0.6} /></mesh>
                <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.06, 0.09, 0.32, 24]} /><meshStandardMaterial color={K.brassDark} roughness={0.5} /></mesh>
                <mesh position={[0, 0.4, 0]} castShadow><sphereGeometry args={[0.1, 24, 16]} /><meshStandardMaterial color={K.brassDark} roughness={0.5} /></mesh>
              </group>
            )}
          </>
        )}
        <group position={ASTRO_AT}>
          <mesh position={[0, 0.03, 0]} castShadow receiveShadow><cylinderGeometry args={[0.62, 0.62, 0.06, 96]} /><meshStandardMaterial color={K.brassDark} metalness={0.8} roughness={0.35} /></mesh>
          <mesh position={[0, 0.062, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.6, 96]} /><meshStandardMaterial map={astroTex} metalness={0.55} roughness={0.38} /></mesh>
          <group position={[0, 0.075, 0]} rotation={[0, -pointer, 0]}>
            <mesh position={[0, 0, -0.27]} castShadow><boxGeometry args={[0.035, 0.012, 0.56]} /><meshStandardMaterial color={K.silver} metalness={0.9} roughness={0.2} /></mesh>
            <mesh castShadow rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.15, 0.012, 12, 64]} /><meshStandardMaterial color={K.gold} metalness={0.85} roughness={0.3} /></mesh>
          </group>
          <mesh position={[0, 0.09, 0]}><cylinderGeometry args={[0.04, 0.04, 0.04, 24]} /><meshStandardMaterial color={K.gold} metalness={0.9} roughness={0.25} /></mesh>
        </group>
        {shot === "city" && p.city && RAHHALA_CITIES[p.city] && <RoundCity wood={wood} brick={brick} rise={rise} />}
      </Stage3D>
      {/* صوت الغرفة، ومع كل حركة صوتها (D158) */}
      <Audio src={SFX("silence-room")} volume={0.35} loop />
      {events.flatMap((e) => e.id === "rete"
        ? Array.from({ length: Math.max(2, Math.round((e.b - e.a) / 0.35)) }, (_, i) => <Sequence key={`${e.id}${i}`} from={Math.round((e.a + i * 0.35) * fps)} durationInFrames={20}><Audio src={SFX("tick")} volume={0.5} /></Sequence>)
        : [<Sequence key={e.id} from={Math.round(e.a * fps)} durationInFrames={Math.max(15, Math.round((e.b - e.a + 0.4) * fps))}><Audio src={SFX(e.sfx)} volume={0.6} /></Sequence>])}
      {sentence && (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <div style={{ position: "absolute", bottom: props.orientation === "portrait" ? 460 : 62, left: 40, right: 40, display: "flex", justifyContent: "center" }}>
            <div style={{ opacity: sentence.fade, color: K.parchment, textShadow: CAPTION_SHADOW, padding: "8px 28px", fontFamily: "Tajawal", fontWeight: 500, fontSize: 52, direction: "rtl", textAlign: "center" }}>{sentence.text}</div>
          </div>
        </AbsoluteFill>
      )}
    </SceneShell>
  );
};

/** نموذج المعاينة (محتوى «دفاتر الزمن»، لا يُنشر): الطريق من الكوفة إلى بغداد */
export const rahhalaDeskSample: Omit<RahhalaDeskProps, "themeId" | "orientation"> = {
  shot: "map",
  mapTitle: "صورة العراق",
  water: "دجلة",
  fromPlace: "الكوفة",
  fromWord: "الكوفة",
  toPlace: "بغداد",
  toWord: "ببغداد",
  narration: "خرج أبو جعفر المنصور من الكوفة يرتاد موضعًا لمدينته، فسار شمالًا على ضفاف دجلة، حتى نزل عند قرية صغيرة تُعرف ببغداد.",
};
export const rahhalaDeskSampleEn = rahhalaDeskSample;
export const rahhalaDeskSeconds = 11;
