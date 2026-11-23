/**
 * «مكتب الرحّالة» — عالم «دفاتر الزمن» (اعتمده المالك ٢٢ نوفمبر، D190) بمعايير «الحِرفة» (D189):
 * خمس لقطات بقطع حقيقي، مددها ٢–٨ ث، بلا لقطة مكررة، وأحجامها متنوعة (تفاصيل، متوسطة، واسعة، قريبة، واسعة):
 *  ١. الخطاف (تفاصيل): الإسطرلاب من فوق، والعنكبوت يدور حتى «١٤٥ هـ» المطعّمة بالفضة، وغبار في شعاع الشمس.
 *  ٢. (متوسطة ← قريبة): الحبر يرسم دجلة ويتشرب في ألياف الرّق، والبحر لازوردي، والكاميرا تدفع نحو دائرة بغداد.
 *  ٣. قطع بالشكل (واسعة): دائرة بغداد على الخريطة تصير المدينة المدوّرة نفسها (القطعة المخصوصة لهذه الحلقة)
 *     بأسوارها وأبوابها الأربعة والقصر والقبة في قلبها، والكاميرا ترتفع فتكشفها على المكتب.
 *  ٤. (قريبة): الوثيقة تسقط على المكتب وتستقر بوزنها، والسطر يُكتب بحبر يتشرب، والختم يُضغط بأثر ناقص كالحقيقي.
 *  ٥. (واسعة، ملصق): المكتب كله، وشمعة ترتعش، والشمس تحركت ودفئت منذ البداية.
 * الضوء من مصادر داخل المشهد (شمس النافذة تتحرك وغبار في شعاعها، والشمعة)، والظلال ناعمة دافئة بلا ظل إطار أسود، وعمق ميدان حقيقي لكل لقطة،
 * وصوت مع كل حركة فوق صوت الغرفة (D158). الخامات CC0 (materials.ts)، والقِدم من بقع صورة حقيقية.
 * الألوان من «دفتر الأفق» واللازورد للماء والخرائط وحدها (D188).
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useBrandFonts } from "../../useBrandFonts";
import { BeamDust, DepthOfField, Stage3D, ease, flicker, lightsAt, orbit, swing, useAssetTextures, type CamState, type Light, type V3 , CAPTION_SHADOW } from "../../three";

export const WORLD_FPS = 30;
const SENTENCES = ["سنة مئة وخمس وأربعين للهجرة،", "وقف أبو جعفر المنصور على ضفة دجلة،", "فخطّ مدينةً مدوّرة، لها أربعة أبواب، وفي قلبها قصره،", "وسمّاها مدينة السلام."];
export const WORLD_WORDS = (() => {
  const out: { w: string; s: number; e: number; line: number }[] = [];
  let t = 0.5;
  SENTENCES.forEach((sentence, line) => {
    for (const w of sentence.split(" ")) { out.push({ w, s: t, e: t + 0.38, line }); t += 0.44 + (/[،.]$/.test(w) ? 0.28 : 0); }
    t += 0.2;
  });
  return out;
})();
export const wAt = (w: string) => WORLD_WORDS.find((x) => x.w.replace(/[،.]/g, "") === w)!.s;
export const WORLD_SEC = Math.ceil(WORLD_WORDS[WORLD_WORDS.length - 1]!.e + 3.2);
export const worldFrames = () => WORLD_SEC * WORLD_FPS;

/** ألوان «دفتر الأفق» ودرجاتها، واللازورد للماء والخرائط وحدها (D188) */
export const WORLD_COLORS = {
  parchment: "#F1E4CB", parchmentDeep: "#EADBC0", ink: "#4A2E1F", inkDark: "#2B1E14", vermilion: "#D7372B", gold: "#C8A15A",
  goldLight: "#F3C98B", lapis: "#26619C", seaDeep: "#35284D", verdigris: "#7A7F4E", dusk: "#2A1E3F", silver: "#F3E9DA", brassDark: "#5A4632",
  wax: "#F8EEDB", flame: "#E07A3F",
} as const;
export const K = WORLD_COLORS;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const span = (t: number, a: number, d: number) => clamp01((t - a) / d);

// ——— الرّق: ألياف وبقع قِدم من صورة CC0 حقيقية وحواف أغمق ———
export const parchment = (g: CanvasRenderingContext2D, w: number, h: number, seed: number, age: CanvasImageSource | null) => {
  g.fillStyle = K.parchment; g.fillRect(0, 0, w, h);
  if (age) { g.save(); g.globalCompositeOperation = "multiply"; g.globalAlpha = 0.32; g.drawImage(age, (seed * 97) % 300, (seed * 53) % 300, 700, 700, 0, 0, w, h); g.restore(); }
  g.save(); g.globalAlpha = 0.05; g.strokeStyle = K.ink;
  for (let i = 0; i < 700; i++) {
    const x = ((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1 * w, y = ((Math.sin(i * 78.233 + seed) * 12543.13) % 1 + 1) % 1 * h;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18 * Math.cos(i), y + 6 * Math.sin(i)); g.stroke();
  }
  const r = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  r.addColorStop(0, "rgba(0,0,0,0)"); r.addColorStop(1, "rgba(74,46,31,0.3)");
  g.globalAlpha = 1; g.fillStyle = r; g.fillRect(0, 0, w, h);
  g.restore();
};

/** مسار بنسبة p من طوله */
export const pathTo = (g: CanvasRenderingContext2D, pts: [number, number][], p: number) => {
  const segs = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1]));
  let left = segs.reduce((a, b) => a + b, 0) * p;
  g.beginPath(); g.moveTo(...pts[0]!);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const d = segs[i - 1]!, k = Math.min(1, left / d);
    g.lineTo(pts[i - 1]![0] + (pts[i]![0] - pts[i - 1]![0]) * k, pts[i - 1]![1] + (pts[i]![1] - pts[i - 1]![1]) * k);
    left -= d;
  }
};
/** حبر يتشرب: الخط نفسه، وهالة مموّهة حوله تتسع مع الزمن (absorb ٠–١) كما يسري الحبر في الألياف */
export const ink = (g: CanvasRenderingContext2D, pts: [number, number][], p: number, width: number, color: string, absorb: number) => {
  if (p <= 0) return;
  g.save(); g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = color;
  if (absorb > 0) { g.filter = `blur(${2 + absorb * 4}px)`; g.globalAlpha = 0.28 * absorb; g.lineWidth = width * (1.6 + absorb); pathTo(g, pts, p); g.stroke(); }
  g.filter = "none"; g.globalAlpha = 0.95; g.lineWidth = width; pathTo(g, pts, p); g.stroke();
  g.restore();
};
/** غسيل لوني بطبقات شفافة بحواف غير منتظمة */
export const wash = (g: CanvasRenderingContext2D, poly: [number, number][], color: string, p: number, seed: number) => {
  if (p <= 0) return;
  const cx = poly.reduce((a, q) => a + q[0], 0) / poly.length, cy = poly.reduce((a, q) => a + q[1], 0) / poly.length;
  g.save(); g.fillStyle = color; g.filter = "blur(3px)";
  for (let k = 0; k < 5; k++) {
    g.globalAlpha = 0.12 * p; g.beginPath();
    poly.forEach(([x, y], i) => { const s = 0.55 + 0.45 * p, X = cx + (x - cx) * s + Math.sin(seed * 7 + i * 3.1 + k * 1.7) * 9, Y = cy + (y - cy) * s + Math.cos(seed + i * 2.3 + k) * 9; i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
    g.closePath(); g.fill();
  }
  g.restore();
};

// ——— صفحة الخريطة (الجنوب فوق) ———
export const MAP_W = 1536, MAP_H = 2048;
/** دائرة بغداد على الخريطة (للقطع بالشكل إلى المدينة المدوّرة) */
export const BAGHDAD_PX = { x: MAP_W / 2 + 290, y: 1600, r: 70 };
const drawMap = (g: CanvasRenderingContext2D, t: number, age: CanvasImageSource | null) => {
  const w = MAP_W, h = MAP_H;
  parchment(g, w, h, 3, age);
  g.lineWidth = 6; g.strokeStyle = K.ink; g.strokeRect(70, 70, w - 140, h - 140);
  g.lineWidth = 14; g.strokeStyle = K.gold; g.strokeRect(96, 96, w - 192, h - 192);
  g.lineWidth = 3; g.strokeStyle = K.ink; g.strokeRect(118, 118, w - 236, h - 236);
  g.fillStyle = K.dusk; g.fillRect(w / 2 - 380, 150, 760, 170);
  g.strokeStyle = K.gold; g.lineWidth = 8; g.strokeRect(w / 2 - 368, 162, 736, 146);
  g.fillStyle = K.goldLight; g.font = "bold 112px Amiri"; g.textAlign = "center"; g.direction = "rtl"; g.fillText("صورة العراق", w / 2, 272);
  // البحر لازوردي (D188)
  const sea: [number, number][] = Array.from({ length: 33 }, (_, i) => [w / 2 + 520 * Math.cos(Math.PI * (i / 32)), 360 + 400 * Math.sin(Math.PI * (i / 32))]);
  wash(g, [...sea, [w / 2 - 520, 360]], K.lapis, 1, 1); wash(g, [...sea, [w / 2 - 520, 360]], K.lapis, 1, 2);
  ink(g, sea, 1, 7, K.ink, 1);
  g.fillStyle = K.silver; g.font = "bold 104px Amiri"; g.fillText("بحر فارس", w / 2, 580);
  const euph: [number, number][] = [[w / 2 - 420, h - 200], [w / 2 - 150, 760]];
  const tigris: [number, number][] = [[w / 2 + 380, h - 200], [w / 2 + 120, 760]];
  // الفرات مرسوم من قبل، ودجلة يرسمه الحبر الآن ويتشرب، ثم يُغسل باللازورد (ماء)
  const pT = ease(span(t, wAt("وقف") - 0.1, wAt("دجلة") - wAt("وقف") + 0.3)), absorbT = span(t, wAt("دجلة") + 0.2, 1.6);
  wash(g, [[w / 2 - 400, h - 230], [w / 2 + 360, h - 230], [w / 2 + 130, 790], [w / 2 - 140, 790]], K.verdigris, 1, 4);
  ink(g, euph, 1, 14, K.ink, 1); ink(g, tigris, pT, 14, K.ink, absorbT);
  g.save(); g.globalAlpha = 0.5; ink(g, euph, 1, 6, K.lapis, 0); if (absorbT > 0) { g.globalAlpha = 0.5 * absorbT; ink(g, tigris, 1, 6, K.lapis, 0); } g.restore();
  g.font = "bold 92px Amiri"; g.fillStyle = K.ink;
  g.save(); g.translate(w / 2 - 360, 1400); g.rotate(-1.33); g.fillText("الفرات", 0, 0); g.restore();
  if (pT > 0.6) { g.save(); g.globalAlpha = span(pT, 0.6, 0.4); g.translate(w / 2 + 330, 1400); g.rotate(-1.805); g.fillText("دجلة", 0, 0); g.restore(); }
  const city = (x: number, y: number, name: string) => { g.strokeStyle = K.ink; g.lineWidth = 8; g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2); g.stroke(); g.fillStyle = K.ink; g.font = "bold 80px Amiri"; g.fillText(name, x, y + 120); };
  city(w / 2 - 40, 830, "البصرة"); city(w / 2 - 330, 1700, "الكوفة");
  // بغداد: دائرة بالزنجفر بإطار ذهبي تُرسم مع «المنصور… دجلة»
  const pB = ease(span(t, wAt("المنصور"), 1.1));
  if (pB > 0) {
    g.fillStyle = K.vermilion; g.globalAlpha = Math.min(1, pB * 1.4); g.beginPath(); g.arc(BAGHDAD_PX.x, BAGHDAD_PX.y, 58 * pB, 0, Math.PI * 2); g.fill();
    g.strokeStyle = K.gold; g.lineWidth = 12; g.beginPath(); g.arc(BAGHDAD_PX.x, BAGHDAD_PX.y, BAGHDAD_PX.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pB); g.stroke();
    g.fillStyle = K.vermilion; g.font = "bold 118px Amiri"; g.fillText("بغداد", BAGHDAD_PX.x, BAGHDAD_PX.y + 190); g.globalAlpha = 1;
  }
};

/** الصفحة اليسرى: متن حقيقي وحاشية برقعة حمراء بجوار «ببغداد» */
const drawText = (g: CanvasRenderingContext2D, age: CanvasImageSource | null) => {
  const w = MAP_W;
  parchment(g, w, MAP_H, 9, age);
  g.lineWidth = 6; g.strokeStyle = K.ink; g.strokeRect(70, 70, w - 140, MAP_H - 140);
  g.fillStyle = K.gold; g.fillRect(150, 150, w - 300, 26); g.fillStyle = K.vermilion; g.fillRect(150, 186, w - 300, 8);
  g.direction = "rtl"; g.textAlign = "right"; g.fillStyle = K.vermilion; g.font = "bold 96px Amiri"; g.fillText("ذكر مدينة السلام", w - 170, 330);
  g.fillStyle = K.ink; g.font = "68px Amiri";
  ["وكان المنصور قد خرج يرتاد موضعًا", "يبني فيه مدينته، فنزل على دجلة", "عند قرية تُعرف ببغداد، فاستطاب", "هواءها، وقال: هذا موضع معسكر", "صالح، وهذه دجلة ليس بيننا وبين", "الصين شيء، يأتينا فيها كل ما", "في البحر، وتأتينا الميرة من الجزيرة.", "", "فخطّها، وجعل لها أربعة أبواب."].forEach((l, i) => g.fillText(l, w - 170, 470 + i * 112));
  g.globalAlpha = 0.7; g.font = "56px 'Aref Ruqaa'"; g.fillText("— بتصرّف عن تاريخ الطبري", w - 170, 470 + 10 * 112); g.globalAlpha = 1;
  g.save(); g.strokeStyle = K.vermilion; g.lineWidth = 5; pathTo(g, [[600, 700], [440, 760]], 1); g.stroke();
  g.translate(420, 820); g.rotate(-0.2); g.fillStyle = K.vermilion; g.textAlign = "right"; g.font = "104px 'Aref Ruqaa'";
  g.fillText("بُنيت", 0, 0); g.fillText("سنة ١٤٥", 0, 130); g.fillText("على دجلة", 0, 260); g.restore();
};

export const canvasOf = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")!] as const; };
export const texOf = (c: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

/** الوثيقة: سطور حقيقية، والسطر المنطوق يُكتب ويتشرب، والختم بأثر ناقص كالضغط الحقيقي */
const drawDoc = (g: CanvasRenderingContext2D, w: number, h: number, t: number, age: CanvasImageSource | null) => {
  parchment(g, w, h, 17, age);
  g.direction = "rtl"; g.textAlign = "right";
  g.fillStyle = K.ink; g.font = "bold 84px 'Aref Ruqaa'"; g.fillText("سِجلّ البناء", w - 110, 190);
  g.font = "60px Amiri"; ["أمر أمير المؤمنين أبو جعفر", "ببناء المدينة المدوّرة", "على الجانب الغربي من دجلة"].forEach((l, i) => g.fillText(l, w - 110, 330 + i * 92));
  const p = span(t, wAt("وسمّاها") - 0.1, 1.3), soak = span(t, wAt("وسمّاها") + 1.0, 1.5);
  if (p > 0) {
    g.save(); g.beginPath(); g.rect(w - 110 - 1000 * p, 560, 1000 * p, 140); g.clip();
    if (soak > 0) { g.filter = `blur(${1.5 + soak * 2}px)`; g.globalAlpha = 0.25 * soak; g.fillStyle = K.ink; g.font = "bold 86px Amiri"; g.fillText("وسمّاها مدينة السلام", w - 110, 662); }
    g.filter = "none"; g.globalAlpha = 1; g.fillStyle = K.ink; g.font = "bold 86px Amiri"; g.fillText("وسمّاها مدينة السلام", w - 110, 660);
    g.restore();
  }
  const s = span(t, wAt("السلام") + 0.15, 0.06);
  if (s > 0) {
    // الختم على قماش مستقل، ثم تُمحى منه نقاط حتمية (ضغط غير متساوٍ) وجانبه الأيسر أخف
    const [sc, sg] = canvasOf(560, 560);
    sg.translate(280, 280); sg.rotate(-0.18); sg.strokeStyle = K.vermilion; sg.fillStyle = K.vermilion;
    sg.lineWidth = 16; sg.beginPath(); sg.arc(0, 0, 230, 0, Math.PI * 2); sg.stroke(); sg.lineWidth = 6; sg.beginPath(); sg.arc(0, 0, 186, 0, Math.PI * 2); sg.stroke();
    sg.textAlign = "center"; sg.font = "bold 110px Amiri"; sg.fillText("سنة", 0, -20); sg.font = "bold 140px Amiri"; sg.fillText("١٤٥", 0, 120);
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 1400; i++) { const x = ((Math.sin(i * 91.7) * 4375.5) % 1 + 1) % 1 * 560, y = ((Math.sin(i * 17.3) * 1254.1) % 1 + 1) % 1 * 560; sg.globalAlpha = 0.5 + 0.5 * (1 - x / 560); sg.fillRect(x, y, 3 + (i % 4), 3 + (i % 3)); }
    const fade = sg.createLinearGradient(0, 0, 560, 0); fade.addColorStop(0, "rgba(0,0,0,0.55)"); fade.addColorStop(0.6, "rgba(0,0,0,0)");
    sg.globalAlpha = 1; sg.fillStyle = fade; sg.fillRect(0, 0, 560, 560);
    g.globalAlpha = 0.9 * s; g.drawImage(sc, w * 0.36 - 280, h * 0.72 - 280); g.globalAlpha = 1;
  }
};

/** الإسطرلاب: نحاس محفور مطعّم بالفضة، وأثر استعمال (خدوش وبقع اتساخ حول المحور) */
export const drawAstro = (g: CanvasRenderingContext2D, n: number, yearShown: number, label = "١٤٥ هـ", base = 100) => {
  const c = n / 2;
  const brass = g.createRadialGradient(c, c, 60, c, c, c);
  brass.addColorStop(0, K.goldLight); brass.addColorStop(0.7, K.gold); brass.addColorStop(1, K.brassDark);
  g.fillStyle = brass; g.beginPath(); g.arc(c, c, c - 4, 0, Math.PI * 2); g.fill();
  g.save(); g.globalAlpha = 0.18; g.strokeStyle = K.brassDark; g.lineWidth = 1.5;
  for (let i = 0; i < 160; i++) { const a = i * 2.399, r = 80 + ((i * 37) % 380), l = 10 + (i % 7) * 6; g.beginPath(); g.moveTo(c + r * Math.cos(a), c + r * Math.sin(a)); g.lineTo(c + r * Math.cos(a) + l * Math.cos(a * 3), c + r * Math.sin(a) + l * Math.sin(a * 3)); g.stroke(); }
  const grime = g.createRadialGradient(c, c, 10, c, c, 160); grime.addColorStop(0, "rgba(43,30,20,0.35)"); grime.addColorStop(1, "rgba(43,30,20,0)");
  g.globalAlpha = 1; g.fillStyle = grime; g.beginPath(); g.arc(c, c, 160, 0, Math.PI * 2); g.fill(); g.restore();
  const inlay = (draw: () => void, wDark: number, wSilver: number) => { g.strokeStyle = K.inkDark; g.lineWidth = wDark; draw(); g.strokeStyle = K.silver; g.lineWidth = wSilver; draw(); };
  inlay(() => { g.beginPath(); g.arc(c, c, c - 40, 0, Math.PI * 2); g.stroke(); }, 14, 7);
  inlay(() => { g.beginPath(); g.arc(c, c, c - 190, 0, Math.PI * 2); g.stroke(); }, 12, 6);
  for (let y = base; y <= base + 100; y += 5) {
    const a = ((y - base) / 100) * Math.PI * 1.6 - Math.PI * 0.8 - Math.PI / 2, long = y % 25 === 0;
    inlay(() => { g.beginPath(); g.moveTo(c + (c - 40) * Math.cos(a), c + (c - 40) * Math.sin(a)); g.lineTo(c + (c - (long ? 120 : 80)) * Math.cos(a), c + (c - (long ? 120 : 80)) * Math.sin(a)); g.stroke(); }, long ? 12 : 8, long ? 6 : 4);
    if (long) { g.save(); g.translate(c + (c - 158) * Math.cos(a), c + (c - 158) * Math.sin(a)); g.rotate(a + Math.PI / 2); g.font = "bold 78px Amiri"; g.textAlign = "center"; g.fillStyle = K.inkDark; g.fillText(y.toLocaleString("ar-EG"), 3, 30); g.fillStyle = K.silver; g.fillText(y.toLocaleString("ar-EG"), 0, 27); g.restore(); }
  }
  for (let k = 1; k <= 4; k++) inlay(() => { g.beginPath(); g.ellipse(c, c + 40 * k, 90 * k, 60 * k, 0, Math.PI, Math.PI * 2); g.stroke(); }, 8, 4);
  if (yearShown > 0) { g.save(); g.globalAlpha = yearShown; g.textAlign = "center"; g.font = "bold 104px Amiri"; g.fillStyle = K.inkDark; g.fillText(label, c + 3, c + 248); g.fillStyle = K.silver; g.fillText(label, c, c + 245); g.restore(); }
};

export const useCanvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, deps: unknown[]) =>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => { const [c, g] = canvasOf(w, h); draw(g); return texOf(c); }, deps);

// ——— المكان ———
export const ATLAS_AT: V3 = [-0.65, 0, 0.25];
export const DOC_AT: V3 = [2.05, 0, 0.55];
export const ASTRO_AT: V3 = [0.95, 0.06, -1.35];
export const CITY_AT: V3 = [-2.55, 0, 1.25];
/** بغداد على الخريطة في إحداثيات العالم (صفحة اليمين ١٫٢٦×١٫٦٨) */
export const BAGHDAD_WORLD: V3 = [ATLAS_AT[0] + 0.64 + (BAGHDAD_PX.x / MAP_W - 0.5) * 1.26, 0.046, ATLAS_AT[2] + (BAGHDAD_PX.y / MAP_H - 0.5) * 1.68];
export const CITY_R = 0.62;

/** طوب لبن بمقياس المدينة: نسخة من الخامة بتكرار يناسب كل سطح */
const useBrick = (src: THREE.Texture[] | null, rx: number, ry: number) => useMemo(() => {
  if (!src) return null;
  return src.map((t, i) => {
    // اللبن طين مجفف بالشمس: أقل تشبعًا من الآجر المحروق، والملاط بين المداميك أوضح (تباين أعلى)، فتُعالج الخريطة اللونية وحدها
    let c: THREE.Texture = t.clone();
    const img = t.image as (CanvasImageSource & { width: number; height: number }) | undefined;
    if (i === 0 && img?.width) {
      const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height; const g = cv.getContext("2d")!;
      g.filter = "saturate(0.4) brightness(1.08) contrast(1.2)"; g.drawImage(img, 0, 0);
      c = new THREE.CanvasTexture(cv); c.colorSpace = THREE.SRGBColorSpace;
    }
    c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(rx, ry); c.needsUpdate = true; return c;
  });
}, [src, rx, ry]);
/** سور سميك بمقطع مستطيل يدور حول المركز (لا أسطوانة رقيقة): وجهه الخارجي وأعلاه وداخله طوب لبن */
const wallGeo = (r: number, thick: number, hh: number) => new THREE.LatheGeometry([new THREE.Vector2(r - thick, 0), new THREE.Vector2(r, 0), new THREE.Vector2(r, hh), new THREE.Vector2(r - thick, hh), new THREE.Vector2(r - thick, 0)], 128);
/**
 * السوران: الخارجي أقصر بأبراج نصف دائرية على مسافات (تُترك عند الأبواب)، والداخلي أعلى؛ ولكل سور إيقاع شرفات مختلف
 * (كل شرفة رابعة أو خامسة أعرض)، فلا تتكرر الكتلة نفسها حول المدينة.
 */
export const CITY_WALLS = [
  { r: CITY_R, hh: 0.11, thick: 0.035, merlons: 84, accent: 4, towers: 20 },
  { r: CITY_R * 0.78, hh: 0.15, thick: 0.03, merlons: 60, accent: 5, towers: 0 },
] as const;
/** زاوية قريبة من طريق أو باب (على القطرين) */
const nearGate = (a: number, w: number) => Math.abs((((a - Math.PI / 4) % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2) - 0) < w || Math.abs(((((a - Math.PI / 4) % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2)) - Math.PI / 2) < w;
/** حتمي ٠–١ */
const h01 = (i: number, k: number) => ((Math.sin(i * 127.1 + k * 311.7) * 43758.5453) % 1 + 1) % 1;
/**
 * بيوت الربض بين السورين: مجموعات غير منتظمة لا صفوف مكعبات — مساحات وأطوال مختلفة، وأسطح مستوية بستائر (حاجز السطح)،
 * وبعضها دور بفناء في وسطه، وتُترك الطرق الأربعة. مطلية بالطين (خامة اللبن بتكرار صغير جدًا: لياسة لا مداميك).
 */
export const cityHouses = () => {
  const out: { x: number; z: number; rot: number; w: number; d: number; h: number; court: boolean }[] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2 + h01(i, 1) * 0.05;
    if (nearGate(a, 0.1)) continue;
    const n = 1 + Math.floor(h01(i, 2) * 3);
    for (let k = 0; k < n; k++) {
      const rr = CITY_R * (0.82 + 0.12 * h01(i, k + 3)), aa = a + (h01(i, k + 7) - 0.5) * 0.06;
      out.push({ x: rr * Math.cos(aa), z: rr * Math.sin(aa), rot: -aa + (h01(i, k + 11) - 0.5) * 0.25, w: 0.035 + 0.05 * h01(i, k + 13), d: 0.03 + 0.04 * h01(i, k + 17), h: 0.025 + 0.05 * h01(i, k + 19) ** 1.6, court: h01(i, k + 23) > 0.62 });
    }
  }
  return out;
};

/** المدينة المدوّرة (القطعة المخصوصة لهذه الحلقة): خندق لازوردي، وسوران من طوب لبن بشرفاتهما وأبراجهما، وأربعة أبواب بقباب مذهّبة، والقصر وقبته الخضراء وحده في القلب */
export const RoundCity: React.FC<{ wood: THREE.Texture[]; brick: THREE.Texture[]; rise: number }> = ({ wood, brick, rise }) => {
  const wallTex = useBrick(brick, 30, 2.4), blockTex = useBrick(brick, 0.5, 0.5), plasterTex = useBrick(brick, 0.08, 0.08);
  const geos = useMemo(() => CITY_WALLS.map((w) => wallGeo(w.r, w.thick, w.hh)), []);
  const houses = useMemo(cityHouses, []);
  const mud = (tx: THREE.Texture[] | null, n = 0.35) => <meshStandardMaterial map={tx?.[0]} normalMap={tx?.[1]} normalScale={new THREE.Vector2(n, n)} color={K.parchment} roughness={0.88} />;
  const y = Math.max(0.001, rise);
  return (
    <group position={CITY_AT}>
      <mesh position={[0, 0.03, 0]} receiveShadow castShadow><cylinderGeometry args={[CITY_R + 0.22, CITY_R + 0.25, 0.06, 96]} /><meshStandardMaterial map={wood[0]} normalMap={wood[1]} color="#c9b49a" /></mesh>
      <mesh position={[0, 0.062, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[CITY_R + 0.04, CITY_R + 0.12, 96]} /><meshStandardMaterial color={K.lapis} roughness={0.25} /></mesh>
      {/* السوران يرتفعان من الأرض مع «المدوّرة»، وعليهما الشرفات بإيقاع مختلف لكل سور، وعلى الخارجي أبراج */}
      <group position={[0, 0.06, 0]} scale={[1, y, 1]}>
        {CITY_WALLS.map((w, i) => (
          <group key={i}>
            <mesh geometry={geos[i]} castShadow receiveShadow>{mud(wallTex)}</mesh>
            {Array.from({ length: w.merlons }, (_, k) => {
              const a = (k / w.merlons) * Math.PI * 2, big = k % w.accent === 0, step = (Math.PI * 2 * w.r) / w.merlons;
              return <mesh key={k} position={[(w.r - w.thick / 2) * Math.cos(a), w.hh + (big ? 0.014 : 0.01), (w.r - w.thick / 2) * Math.sin(a)]} rotation={[0, -a, 0]} castShadow>
                <boxGeometry args={[w.thick * 0.9, big ? 0.028 : 0.02, step * (big ? 0.7 : 0.45)]} />{mud(blockTex)}</mesh>;
            })}
            {Array.from({ length: w.towers }, (_, k) => {
              const a = ((k + 0.5) / w.towers) * Math.PI * 2;
              if (nearGate(a, 0.14)) return null;
              return <mesh key={`t${k}`} position={[(w.r + 0.012) * Math.cos(a), (w.hh + 0.025) / 2, (w.r + 0.012) * Math.sin(a)]} castShadow receiveShadow><cylinderGeometry args={[0.028, 0.032, w.hh + 0.025, 20]} />{mud(blockTex)}</mesh>;
            })}
          </group>
        ))}
        {/* الأبواب الأربعة: برج بطوب اللبن وقبة مذهّبة (الخضراء للقصر وحده) */}
        {[0, 1, 2, 3].map((k) => {
          const a = Math.PI / 4 + (k * Math.PI) / 2;
          return (
            <group key={k} position={[CITY_R * Math.cos(a), 0, CITY_R * Math.sin(a)]} rotation={[0, -a, 0]}>
              <mesh position={[0, 0.09, 0]} castShadow receiveShadow><boxGeometry args={[0.1, 0.18, 0.15]} />{mud(blockTex)}</mesh>
              <mesh position={[0, 0.18, 0]} castShadow><sphereGeometry args={[0.05, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={K.gold} metalness={0.6} roughness={0.38} /></mesh>
            </group>
          );
        })}
        {/* بيوت الربض: مجموعات غير منتظمة بأسطح مستوية وحواجز، وبعضها دور بفناء */}
        {houses.map((hs, i) => (
          <group key={i} position={[hs.x, 0, hs.z]} rotation={[0, hs.rot, 0]}>
            <mesh position={[0, hs.h / 2, 0]} castShadow receiveShadow><boxGeometry args={[hs.w, hs.h, hs.d]} />{mud(plasterTex, 0.2)}</mesh>
            {/* حاجز السطح: حافة أعلى قليلًا حول السطح المستوي */}
            <mesh position={[0, hs.h + 0.003, 0]} castShadow><boxGeometry args={[hs.w, 0.006, hs.d]} />{mud(plasterTex, 0.2)}</mesh>
            <mesh position={[0, hs.h + 0.0062, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[hs.w * (hs.court ? 0.5 : 0.8), hs.d * (hs.court ? 0.5 : 0.8)]} /><meshStandardMaterial color={hs.court ? K.brassDark : K.gold} roughness={0.95} /></mesh>
          </group>
        ))}
        <mesh position={[0, 0.09, 0]} castShadow><boxGeometry args={[0.2, 0.18, 0.2]} />{mud(blockTex)}</mesh>
        <mesh position={[0, 0.18, 0]} castShadow><sphereGeometry args={[0.1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={K.verdigris} roughness={0.4} metalness={0.3} /></mesh>
      </group>
      {[0, 1].map((k) => <mesh key={k} position={[0, 0.063, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4 + (k * Math.PI) / 2]}><planeGeometry args={[CITY_R * 2, 0.03]} /><meshStandardMaterial color={K.brassDark} /></mesh>)}
    </group>
  );
};

/** كتاب بجلد حقيقي وجامة مذهّبة بارزة */
export const LeatherBook: React.FC<{ ts: THREE.Texture[] }> = ({ ts }) => {
  const emboss = useCanvasTex(512, 640, (g) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, 512, 640); g.strokeStyle = "#fff"; g.lineWidth = 10; g.strokeRect(36, 36, 440, 568);
    g.save(); g.translate(256, 320);
    for (let k = 0; k < 16; k++) { g.rotate(Math.PI / 8); g.beginPath(); g.moveTo(0, 30); g.quadraticCurveTo(40, 90, 0, 140); g.quadraticCurveTo(-40, 90, 0, 30); g.stroke(); }
    g.beginPath(); g.arc(0, 0, 150, 0, Math.PI * 2); g.stroke(); g.restore();
  }, []);
  const [diff, nor] = ts;
  const cover = <meshStandardMaterial map={diff} normalMap={nor} bumpMap={emboss} bumpScale={4} color="#B4583A" roughness={0.6} />;
  return (
    <group position={[2.35, 0, -1.35]} rotation={[0, -0.35, 0]}>
      <mesh position={[0, 0.13, 0]} castShadow receiveShadow><boxGeometry args={[1.25, 0.26, 1.65]} /><meshStandardMaterial color={K.parchmentDeep} roughness={0.9} /></mesh>
      <mesh position={[0, 0.27, 0]} castShadow><boxGeometry args={[1.3, 0.03, 1.7]} />{cover}</mesh>
      <mesh><boxGeometry args={[1.3, 0.03, 1.7]} />{cover}</mesh>
      <mesh position={[-0.66, 0.13, 0]}><boxGeometry args={[0.04, 0.3, 1.7]} />{cover}</mesh>
      <mesh position={[0, 0.288, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.3, 48]} /><meshStandardMaterial color={K.gold} metalness={0.7} roughness={0.35} bumpMap={emboss} bumpScale={3} transparent opacity={0.85} /></mesh>
    </group>
  );
};

/** محبرة زجاج حقيقية (ينكسر فيها الضوء) فيها حبر داكن، وقلم قصب */
export const Inkwell: React.FC = () => (
  <group position={[-2.35, 0, -1.15]}>
    <mesh position={[0, 0.17, 0]} castShadow><cylinderGeometry args={[0.2, 0.25, 0.34, 64]} /><meshPhysicalMaterial color={K.silver} transmission={0.92} thickness={0.35} ior={1.5} roughness={0.06} clearcoat={1} attenuationColor={K.verdigris} attenuationDistance={1.2} /></mesh>
    <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.17, 0.21, 0.2, 48]} /><meshStandardMaterial color={K.inkDark} roughness={0.05} /></mesh>
    <mesh position={[0, 0.355, 0]}><torusGeometry args={[0.11, 0.03, 16, 48]} /><meshPhysicalMaterial color={K.silver} transmission={0.9} thickness={0.2} roughness={0.08} /></mesh>
    <mesh position={[0.24, 0.45, 0.1]} rotation={[0.25, 0, -0.55]} castShadow><cylinderGeometry args={[0.02, 0.012, 1.05, 12]} /><meshStandardMaterial color={K.gold} roughness={0.7} /></mesh>
  </group>
);

/** شمعة: شمع ولهب يرتعش */
export const CANDLE_AT: V3 = [-1.75, 0, -1.55];
export const Candle: React.FC<{ t: number; still?: [number, number][] }> = ({ t, still = [] }) => {
  const f = flicker(t, { depth: 0.22, rate: 7, seed: 41 }, still);
  return (
    <group position={CANDLE_AT}>
      <mesh position={[0, 0.03, 0]} castShadow><cylinderGeometry args={[0.16, 0.18, 0.06, 32]} /><meshStandardMaterial color={K.brassDark} metalness={0.7} roughness={0.35} /></mesh>
      <mesh position={[0, 0.32, 0]} castShadow><cylinderGeometry args={[0.07, 0.075, 0.52, 32]} /><meshStandardMaterial color={K.wax} roughness={0.45} /></mesh>
      <mesh position={[0, 0.66 + 0.01 * f, 0]} scale={[1, f, 1]}><coneGeometry args={[0.03, 0.12, 16]} /><meshBasicMaterial color={K.flame} toneMapped={false} /></mesh>
      <mesh position={[0, 0.63, 0]} scale={[1, f, 1]}><sphereGeometry args={[0.022, 12, 8]} /><meshBasicMaterial color={K.goldLight} toneMapped={false} /></mesh>
    </group>
  );
};

// ——— اللقطات ———
type ShotCam = { target: V3; yaw: number; pitch: number; dist: number; fov: number };
/** push: أس منحنى الحركة (>١ = تبقى قريبة من البداية وتندفع في آخرها) */
export type Shot = { id: string; size: "detail" | "medium" | "close" | "wide"; a: number; b: number; from: ShotCam; to: ShotCam; aperture: number; push?: number };
export const worldShots = (): Shot[] => {
  const t1 = wAt("وقف") - 0.25, t2 = wAt("فخطّ") - 0.15, t3 = wAt("وسمّاها") - 0.3, t4 = wAt("السلام") + 1.25, end = WORLD_SEC;
  // قطع بالشكل: آخر لقطة الخريطة دائرة بغداد من فوق، وأول لقطة المدينة سورها من فوق بالحجم نفسه على الشاشة
  const dMap = 0.42, dCity = dMap * ((CITY_R + 0.12) / ((BAGHDAD_PX.r / MAP_W) * 1.26));
  return [
    { id: "astrolabe", size: "detail", a: 0, b: t1, aperture: 0.03, from: { target: ASTRO_AT, yaw: 20, pitch: 80, dist: 1.25, fov: 30 }, to: { target: ASTRO_AT, yaw: 4, pitch: 86, dist: 1.1, fov: 30 } },
    { id: "map", size: "medium", a: t1, b: t2, aperture: 0.016, push: 2.6, from: { target: [ATLAS_AT[0] + 0.66, 0, ATLAS_AT[2] + 0.05], yaw: -6, pitch: 74, dist: 2.75, fov: 34 }, to: { target: BAGHDAD_WORLD, yaw: 0, pitch: 89, dist: dMap, fov: 32 } },
    { id: "city", size: "wide", a: t2, b: t3, aperture: 0.012, from: { target: [CITY_AT[0], 0.06, CITY_AT[2]], yaw: 0, pitch: 89, dist: dCity, fov: 32 }, to: { target: [CITY_AT[0] + 0.2, 0.08, CITY_AT[2] - 0.1], yaw: -35, pitch: 38, dist: 2.6, fov: 32 } },
    { id: "document", size: "close", a: t3, b: t4, aperture: 0.02, from: { target: [DOC_AT[0], 0, DOC_AT[2]], yaw: 12, pitch: 66, dist: 2.0, fov: 32 }, to: { target: [DOC_AT[0] - 0.1, 0, DOC_AT[2] + 0.15], yaw: 4, pitch: 74, dist: 1.75, fov: 32 } },
    { id: "desk", size: "wide", a: t4, b: end, aperture: 0.006, from: { target: [0, 0, 0.1], yaw: -2, pitch: 46, dist: 6.6, fov: 34 }, to: { target: [-0.2, 0, 0], yaw: -12, pitch: 50, dist: 7.4, fov: 34 } },
  ];
};

export const camOfShot = (s: Shot, t: number): CamState & { focus: number } => {
  const p = Math.pow(ease(span(t, s.a, s.b - s.a)), s.push ?? 1);
  const L = (x: number, y: number) => x + (y - x) * p;
  const c = { target: [L(s.from.target[0], s.to.target[0]), L(s.from.target[1], s.to.target[1]), L(s.from.target[2], s.to.target[2])] as V3, yaw: L(s.from.yaw, s.to.yaw), pitch: L(s.from.pitch, s.to.pitch), dist: L(s.from.dist, s.to.dist), fov: L(s.from.fov, s.to.fov) };
  return { position: orbit(c), target: c.target, fov: c.fov, focus: c.dist };
};

/** الشمس تتحرك وتدفأ مع الحكاية (٤٦٠٠ ← ٣٦٠٠ كلفن)، والشمعة مصدر ثانٍ دافئ يرتعش */
const lightsAtT = (t: number): Light[] => {
  const p = t / WORLD_SEC;
  return [
    { kind: "ambient", kelvin: 3600, intensity: 0.95, position: [0, 0, 0] },
    { kind: "key", kelvin: 4600 - 1000 * p, intensity: 2.6, position: [-7 + 2 * p, 8 - 1.2 * p, -5 + 1.5 * p] },
    { kind: "practical", kelvin: 1900, intensity: 1.6, position: [CANDLE_AT[0], 0.75, CANDLE_AT[2]], flicker: { depth: 0.2, rate: 7, seed: 41 } },
  ];
};

const SFX = (f: string) => staticFile(`three/sfx/${f}.mp3`);

export const DeskWorldLab: React.FC = () => {
  const ready = useBrandFonts();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const wood = useAssetTextures(["dafatir-walnut-diff", "dafatir-walnut-nor", "dafatir-walnut-rough"], [4, 2.6]);
  const leather = useAssetTextures(["dafatir-leather-diff", "dafatir-leather-nor"]);
  const age = useAssetTextures(["dafatir-age-diff"]);
  const brick = useAssetTextures(["dafatir-mudbrick-diff", "dafatir-mudbrick-nor"]);
  const ageImg = (age?.[0]?.image as CanvasImageSource | undefined) ?? null;
  const mapTex = useCanvasTex(MAP_W, MAP_H, (g) => drawMap(g, t, ageImg), [ready, frame, Boolean(ageImg)]);
  const textTex = useCanvasTex(MAP_W, MAP_H, (g) => drawText(g, ageImg), [ready, Boolean(ageImg)]);
  const docTex = useCanvasTex(1200, 1560, (g) => drawDoc(g, 1200, 1560, t, ageImg), [ready, frame, Boolean(ageImg)]);
  const yearShown = span(t, wAt("للهجرة") + 0.15, 0.35);
  const astroTex = useCanvasTex(1024, 1024, (g) => drawAstro(g, 1024, yearShown), [ready, Math.round(yearShown * 20)]);
  const shots = worldShots();
  const shot = shots.find((s) => t >= s.a && t < s.b) ?? shots[shots.length - 1]!;
  const cam = camOfShot(shot, t);
  const year = 100 + 45 * ease(span(t, 0.3, wAt("للهجرة")));
  const pointer = ((year - 100) / 100) * Math.PI * 1.6 - Math.PI * 0.8;
  // الوثيقة تسقط في أول لقطتها وتستقر بوزنها (ارتداد صغير يخمد)
  const docDrop = shots[3]!.a + 0.15, land = docDrop + 0.35;
  const docY = t < docDrop ? 0.45 : t < land ? 0.45 * (1 - ease((t - docDrop) / 0.35)) : Math.abs(swing(t, land, 0.025, 3.2, 7));
  const docTilt = t < land ? 0.06 : swing(t, land, 0.05, 2.4, 6);
  const sd = span(t, wAt("السلام") - 0.05, 0.2), su = span(t, wAt("السلام") + 0.35, 0.4);
  // بعد الطبع يرتفع ويُزاح جانبًا ثم يوضع على المكتب
  const sl = span(t, wAt("السلام") + 0.75, 0.5);
  const stamp: V3 = [-0.2 - 1.3 * ease(su), 0.9 - 0.82 * ease(sd) * (1 - ease(su)) + 0.9 * ease(su) - 1.74 * ease(sl), 0.3 - 0.9 * ease(su)];
  const rise = ease(span(t, shots[2]!.a + 0.4, 1.6));
  if (!wood || !leather || !age || !brick) return null;
  const tickTimes = Array.from({ length: 8 }, (_, i) => 0.35 + i * ((wAt("للهجرة") - 0.1) / 8));
  return (
    <>
      <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, lightsAtT(t))} background={K.dusk} shadows="variance">
        <DepthOfField focus={cam.focus} aperture={shot.aperture} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[14, 9]} /><meshStandardMaterial map={wood[0]} normalMap={wood[1]} roughnessMap={wood[2]} color="#c9b49a" /></mesh>
        <mesh position={[0, 3, -4.4]} receiveShadow><planeGeometry args={[24, 10]} /><meshStandardMaterial color={K.dusk} roughness={1} /></mesh>
        <BeamDust t={t} from={[-4.2, 4.4, -3.1]} to={[0.4, 0.2, -0.2]} radius={0.9} color={K.goldLight} count={110} seed={7} />
        <LeatherBook ts={leather} />
        <Inkwell />
        <Candle t={t} />
        <group position={ATLAS_AT}>
          <mesh position={[0, 0.02, 0]} receiveShadow castShadow><boxGeometry args={[2.62, 0.04, 1.86]} /><meshStandardMaterial color={K.brassDark} roughness={0.7} /></mesh>
          <mesh position={[0.64, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[1.26, 1.68]} /><meshStandardMaterial map={mapTex} roughness={0.92} /></mesh>
          <mesh position={[-0.64, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[1.26, 1.68]} /><meshStandardMaterial map={textTex} roughness={0.92} /></mesh>
          <mesh position={[0, 0.05, 0]}><boxGeometry args={[0.03, 0.02, 1.7]} /><meshStandardMaterial color={K.inkDark} /></mesh>
        </group>
        <group position={[DOC_AT[0], docY, DOC_AT[2]]} rotation={[docTilt, -0.12, docTilt * 0.5]}>
          <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow><planeGeometry args={[1.15, 1.5]} /><meshStandardMaterial map={docTex} roughness={0.95} side={THREE.DoubleSide} /></mesh>
        </group>
        <group position={[DOC_AT[0] + stamp[0], stamp[1], DOC_AT[2] + stamp[2]]}>
          <mesh castShadow><cylinderGeometry args={[0.24, 0.24, 0.12, 40]} /><meshStandardMaterial color={K.inkDark} roughness={0.6} /></mesh>
          <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.06, 0.09, 0.32, 24]} /><meshStandardMaterial color={K.brassDark} roughness={0.5} /></mesh>
          <mesh position={[0, 0.4, 0]} castShadow><sphereGeometry args={[0.1, 24, 16]} /><meshStandardMaterial color={K.brassDark} roughness={0.5} /></mesh>
        </group>
        <group position={ASTRO_AT}>
          <mesh position={[0, 0.03, 0]} castShadow receiveShadow><cylinderGeometry args={[0.62, 0.62, 0.06, 96]} /><meshStandardMaterial color={K.brassDark} metalness={0.8} roughness={0.35} /></mesh>
          <mesh position={[0, 0.062, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.6, 96]} /><meshStandardMaterial map={astroTex} metalness={0.55} roughness={0.38} /></mesh>
          <group position={[0, 0.075, 0]} rotation={[0, -pointer, 0]}>
            <mesh position={[0, 0, -0.27]} castShadow><boxGeometry args={[0.035, 0.012, 0.56]} /><meshStandardMaterial color={K.silver} metalness={0.9} roughness={0.2} /></mesh>
            <mesh castShadow rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.15, 0.012, 12, 64]} /><meshStandardMaterial color={K.gold} metalness={0.85} roughness={0.3} /></mesh>
          </group>
          <mesh position={[0, 0.09, 0]}><cylinderGeometry args={[0.04, 0.04, 0.04, 24]} /><meshStandardMaterial color={K.gold} metalness={0.9} roughness={0.25} /></mesh>
        </group>
        <RoundCity wood={wood} brick={brick} rise={rise} />
      </Stage3D>
      {/* صوت الغرفة، ومع كل حركة صوتها (D158): تكّات العنكبوت، والقلم، والمدينة، والوثيقة، والختم */}
      <Audio src={SFX("silence-room")} volume={0.35} loop />
      {tickTimes.map((x, i) => <Sequence key={i} from={Math.round(x * fps)} durationInFrames={20}><Audio src={SFX("tick")} volume={0.55} /></Sequence>)}
      <Sequence from={Math.round((wAt("وقف") - 0.1) * fps)} durationInFrames={Math.round(2.2 * fps)}><Audio src={SFX("quill-write")} volume={0.7} /></Sequence>
      <Sequence from={Math.round((shots[2]!.a + 0.4) * fps)} durationInFrames={Math.round(1.2 * fps)}><Audio src={SFX("drop-soft")} volume={0.5} /></Sequence>
      <Sequence from={Math.round(land * fps)} durationInFrames={30}><Audio src={SFX("swipe-paper")} volume={0.6} /></Sequence>
      <Sequence from={Math.round((wAt("وسمّاها") - 0.1) * fps)} durationInFrames={Math.round(1.4 * fps)}><Audio src={SFX("pen-write")} volume={0.6} /></Sequence>
      <Sequence from={Math.round((wAt("السلام") + 0.15) * fps)} durationInFrames={30}><Audio src={SFX("stamp")} volume={0.8} /></Sequence>
      <CalmCaption t={t} />
    </>
  );
};

/** الترجمة سطر هادئ بخط القناة بلا تلوين ولا قفز (D187) */
const CalmCaption: React.FC<{ t: number }> = ({ t }) => {
  const line = [...WORLD_WORDS].reverse().find((w) => w.s - 0.15 <= t)?.line;
  if (line === undefined || t > WORLD_WORDS[WORLD_WORDS.length - 1]!.e + 1.2) return null;
  const words = WORLD_WORDS.filter((w) => w.line === line);
  const fade = clamp01((t - words[0]!.s + 0.15) / 0.13);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", bottom: 62, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ opacity: fade, color: K.parchment, textShadow: CAPTION_SHADOW, padding: "8px 28px", fontFamily: "Tajawal", fontWeight: 500, fontSize: 52, direction: "rtl" }}>
          {words.map((w) => w.w).join(" ")}
        </div>
      </div>
    </AbsoluteFill>
  );
};
