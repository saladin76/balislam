/**
 * نموذج المالك لقالب «اللوح – خزانة الأرشيف» (D185؛ رسالة التكليف C، دفاتر الزمن ١).
 * المرجع الفني: طاولة كاتب ديوان: سجل (دفتر) يُكتب فيه بالحبر، ووثيقة يُضغط عليها ختم، وصحيفة خريطة،
 * وقصاصة مصدر. كل ظهور عند كلمته، والكاميرا دولي فوق الطاولة بين محطات مختلفة التكوين.
 *
 * قرار المالك (٢١ نوفمبر) في القوالب: لا تدرّج خلف عنوان، ولا بطاقات زجاجية، ولا وهج، ولا جسيمات، ولا لمعة،
 * ولا كلام قافز، ولا أيقونات جاهزة، ولا الظل الجاهز، ولا خطوط الواجهات الشائعة، ولا انتقالات جاهزة (اختبار tests/dafatir-archive.test.ts).
 * ثري دي (ملاحظة المالك ٢١ نوفمبر: «القناة قريبة جدًا من الثري دي»): طاولة وأوراق ومحبرة وكتاب وختم خشبي
 * أجسام حقيقية بـ@remotion/three، وضوء نافذة واحد يلقي ظلالًا حقيقية (shadow map)، والأوراق منحنية قليلًا،
 * والكاميرا تتحرك في المكان بمنظور حقيقي. الحبر يُكتب ويجف على خامة الورقة، والختم ينزل فيضغط ثم يرتفع.
 *
 * مختبر لا يُنشر: توقيت تقديري بلا صوت. صحيفة الخريطة **موضع مادة أرشيفية** لم تُختر بعد (تنتظر مراجعة الرخصة)،
 * والنهر والمدينة مرسومان بحبر القناة فوقها. الحقائق: بدأ المنصور بناء بغداد سنة 145هـ وسمّاها مدينة السلام.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useBrandFonts } from "../../useBrandFonts";
import { C, Tag, prog, easeOut } from "../horizon/kit";
import { at, buildTimeline, end, type Timeline } from "../horizon/timeline";
import { rivers, places } from "../../../geo/places";
import { textureField } from "./texture";
import { deskCamAt, inkAt, stampAt, type Station, type StationKey } from "./desk";

export const ARCHIVE_LAB_FPS = 30;
export const ARCHIVE_LAB_SENTENCES = ["سنة مئة وخمس وأربعين للهجرة، بدأ أبو جعفر المنصور بناء بغداد على دجلة.", "| | وسمّاها مدينة السلام."];
export const archiveLabTimeline = (): Timeline => buildTimeline(ARCHIVE_LAB_SENTENCES, 0.8);
export const archiveLabFrames = () => Math.ceil((archiveLabTimeline().end + 2.2) * ARCHIVE_LAB_FPS);

/** ألوان المادة: كلها من هوية «دفتر الأفق» المعتمدة أو درجاتها المشتقة (اختبار) */
export const ARCHIVE_COLORS = { wood: "#2B1E14", woodGrain: "#5A4632", paper: C.parchment, paperLight: "#F4E9D4", paperOld: "#EADBC0", ink: C.ink, inkWet: "#2B1E14", seal: C.ribbon, sealDry: "#B4583A", rule: "#A399B4" };
const K = ARCHIVE_COLORS;

type Doc = { id: string; seed: number; x: number; y: number; w: number; h: number; rot: number; lift: number; tone: string };
export const DOCS: Doc[] = [
  { id: "register", seed: 31, x: 640, y: 210, w: 1120, h: 1480, rot: -1.2, lift: 1, tone: K.paper },
  { id: "deed", seed: 38, x: 1880, y: 260, w: 860, h: 760, rot: 2.6, lift: 0.4, tone: K.paperOld },
  { id: "map", seed: 45, x: 1780, y: 1080, w: 1160, h: 680, rot: -1.8, lift: 0, tone: K.paperLight },
  { id: "slip", seed: 52, x: 2420, y: 1540, w: 660, h: 330, rot: -4.5, lift: 2.2, tone: K.paperLight },
];

export const START: Station = { id: "desk", x: 1640, y: 980, z: 0.56, shot: "wide" };

/** محطات الكاميرا مربوطة بالكلمات */
export const archiveStations = (tl: Timeline): StationKey[] => {
  const k = (a: number, d: number, s: Station): StationKey => ({ ...s, a, b: a + d });
  return [
    k(at(tl, "سنة") - 0.5, 0.8, { id: "register-top", x: 1180, y: 560, z: 1.12, shot: "medium" }),
    k(at(tl, "مئة"), 1.25, { id: "seal", x: 2410, y: 790, z: 1.95, shot: "detail" }),
    k(at(tl, "بدأ") - 0.45, 1.45, { id: "register-line", x: 1170, y: 700, z: 1.4, shot: "close" }),
    k(at(tl, "بغداد") - 0.75, 1.25, { id: "map", x: 2330, y: 1410, z: 1.3, shot: "medium" }),
    k(end(tl, "دجلة") + 0.15, 0.65, { id: "slip", x: 2750, y: 1700, z: 1.75, shot: "detail" }),
    k(at(tl, "مدينة") - 0.35, 1.3, { id: "register-wide", x: 1260, y: 930, z: 0.8, shot: "wide" }),
    // بعد آخر كلمة: دفع بطيء نحو «مدينة السلام» حتى نهاية المشهد، فلا سكون أطول من ثانيتين
    k(tl.end + 0.2, 2.0, { id: "register-push", x: 1200, y: 1060, z: 1.15, shot: "medium" }),
  ];
};

export const mixHex = (a: string, b: string, p: number) => {
  const h = (s: string, i: number) => parseInt(s.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `rgb(${[0, 1, 2].map((i) => Math.round(h(a, i) + (h(b, i) - h(a, i)) * p)).join(",")})`;
};

/** الكلمات كما كُتبت في النص (بتشكيلها وعلامات ترقيمها)، بترتيب كلمات التوقيت نفسه */
export const writtenTokens = () => ARCHIVE_LAB_SENTENCES.join(" ").split(/\s+/).filter((w) => w && w !== "|");

// ——— من بكسلات الطاولة إلى وحدات المكان ثلاثي الأبعاد (متر تقريبًا لكل ١٠٠٠ بكسل) ———
const U = 1000;
const CX = 1900;
const CZ = 1200;
export const toWorld = (x: number, y: number) => [(x - CX) / U, (y - CZ) / U] as const;
/** الكاميرا: تنظر إلى نقطة المحطة على الطاولة من أمامها وأعلاها، والمسافة بعكس التكبير */
export const cameraPose = (s: Station) => {
  const [tx, tz] = toWorld(s.x, s.y);
  const d = 2.05 / s.z;
  const dir = new THREE.Vector3(0.1, 1, 0.66).normalize();
  return { target: [tx, 0, tz] as const, position: [tx + dir.x * d, dir.y * d, tz + dir.z * d] as const };
};

const PX = 1.5; // دقة خامة الورقة: بكسل لكل بكسل طاولة (حدة كافية لـ4K عن قرب)

let grainCache: HTMLCanvasElement | null = null;
export const grain = () => {
  if (grainCache) return grainCache;
  const n = 512;
  const f = textureField("paper", n, n, 31);
  const cv = document.createElement("canvas");
  cv.width = cv.height = n;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(n, n);
  for (let i = 0; i < f.length; i++) {
    img.data[i * 4] = 74;
    img.data[i * 4 + 1] = 46;
    img.data[i * 4 + 2] = 31;
    img.data[i * 4 + 3] = Math.round(255 * 0.1 * Math.max(0, Math.min(1, (f[i]! - 0.3) * 2.2)));
  }
  ctx.putImageData(img, 0, 0);
  return (grainCache = cv);
};

export const woodTexture = () => {
  const [w, h] = [1024, 512];
  const f = textureField("wood", w, h, 19);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const [a, b] = [[43, 30, 20], [90, 70, 50]];
  for (let i = 0; i < f.length; i++) {
    const p = Math.max(0, Math.min(1, (f[i]! - 0.25) * 1.8));
    for (let c = 0; c < 3; c++) img.data[i * 4 + c] = Math.round(a[c]! + (b[c]! - a[c]!) * p * 0.7);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 8;
  return tex;
};

export type Word = { w: string; s: number; e: number };

/** سطر يُكتب بالحبر من اليمين: كل كلمة تظهر بنسبة نطقها، الطرية أغمق ثم تجف */
export const inkLine = (ctx: CanvasRenderingContext2D, words: Word[], right: number, y: number, size: number, t: number, center?: number, family = "Amiri", weight = 700, ink: [string, string] = [K.ink, K.inkWet]) => {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  const space = ctx.measureText(" ").width;
  const widths = words.map((w) => ctx.measureText(w.w).width);
  let x = center !== undefined ? center + (widths.reduce((a, b) => a + b, 0) + space * (words.length - 1)) / 2 : right;
  words.forEach((w, i) => {
    const { write, wet } = inkAt(t, w.s, w.e);
    const wd = widths[i]!;
    if (write > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - wd * write - 4, y - size * 1.3, wd * write + 8, size * 1.9);
      ctx.clip();
      ctx.fillStyle = mixHex(ink[0], ink[1], wet);
      ctx.fillText(w.w, x, y);
      ctx.restore();
    }
    x -= wd + space;
  });
};

let sealCache: HTMLCanvasElement | null = null;
/** طبعة الختم: حلقتان ونص، والحبر غير منتظم (بقع فارغة ثابتة البذرة) كما يطبع الختم على الورق */
const sealImage = () => {
  if (sealCache) return sealCache;
  const n = 300;
  const cv = document.createElement("canvas");
  cv.width = cv.height = n;
  const ctx = cv.getContext("2d")!;
  ctx.translate(n / 2, n / 2);
  ctx.rotate(-0.14);
  ctx.strokeStyle = ctx.fillStyle = K.seal;
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.arc(0, 0, 130, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 108, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = "700 58px Amiri";
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ctx.fillText("سنة", 0, -6);
  ctx.font = "700 66px Amiri";
  ctx.fillText("١٤٥", 0, 64);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "destination-out";
  let seed = 5;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 420; i++) {
    ctx.globalAlpha = 0.15 + 0.5 * r();
    ctx.beginPath();
    ctx.arc(r() * n, r() * n, 1 + 7 * r() * r(), 0, Math.PI * 2);
    ctx.fill();
  }
  return (sealCache = cv);
};

type Doc3 = (typeof DOCS)[number];

const paperBase = (ctx: CanvasRenderingContext2D, d: Doc3) => {
  const [w, h] = [d.w * PX, d.h * PX];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = d.tone;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = ctx.createPattern(grain(), "repeat")!;
  ctx.fillRect(0, 0, w, h);
  // حافة أقدم من الوسط: أثر الأيدي والرطوبة
  ctx.strokeStyle = "rgba(90,70,50,0.13)";
  ctx.lineWidth = 16;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.scale(PX, PX);
};

/** محتوى كل ورقة في لحظة t: ما يتغير فقط يُعاد رسمه (المفتاح يلخص الحالة) */
const docState = (id: string, t: number, tl: Timeline) => {
  const q = (x: number) => Math.round(x * 60) / 60;
  if (id === "register") return tl.words.map((w) => { const i = inkAt(t, w.s, w.e); return `${q(i.write)}${q(i.wet)}`; }).join("");
  if (id === "deed") { const s = stampAt(t, at(tl, "للهجرة")); return `${q(s.ink)}`; }
  if (id === "map") return `${q(prog(t, at(tl, "دجلة") - 0.05, at(tl, "دجلة") + 1.1, easeOut))}${JSON.stringify(inkAt(t, at(tl, "بغداد"), end(tl, "بغداد")))}`;
  const s0 = end(tl, "دجلة") + 0.1;
  return [0, 1, 2].map((i) => q(inkAt(t, s0 + i * 0.45, s0 + i * 0.45 + 0.42).write)).join(",");
};

const drawDoc = (ctx: CanvasRenderingContext2D, d: Doc3, t: number, tl: Timeline) => {
  paperBase(ctx, d);
  const tokens = writtenTokens();
  const words: Word[] = tl.words.map((w, i) => ({ w: tokens[i] ?? w.w, s: w.s, e: w.e }));
  if (d.id === "register") {
    ctx.strokeStyle = K.seal;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.strokeRect(80, 90, d.w - 160, d.h - 180);
    ctx.strokeStyle = K.rule;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 11; i++) { ctx.beginPath(); ctx.moveTo(100, 330 + i * 110); ctx.lineTo(d.w - 100, 330 + i * 110); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const iH = tl.words.findIndex((w) => w.w.startsWith("للهجرة")) + 1;
    const iM = tl.words.findIndex((w) => w.w.startsWith("المنصور")) + 1;
    const n1 = ARCHIVE_LAB_SENTENCES[0]!.split(/\s+/).filter(Boolean).length;
    inkLine(ctx, words.slice(0, iH), d.w - 120, 310, 70, t);
    inkLine(ctx, words.slice(iH, iM), d.w - 120, 420, 70, t);
    inkLine(ctx, words.slice(iM, n1), d.w - 120, 530, 70, t);
    inkLine(ctx, words.slice(n1), d.w - 120, 760, 112, t, d.w / 2);
  } else if (d.id === "deed") {
    ctx.strokeStyle = K.ink;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(90, 110 + i * 52); ctx.lineTo(d.w - 90 - (i % 3) * 60, 110 + i * 52); ctx.stroke(); }
    const s = stampAt(t, at(tl, "للهجرة"));
    ctx.globalAlpha = s.ink * 0.92;
    if (s.ink > 0) ctx.drawImage(sealImage(), 540 - 150, 560 - 150);
    ctx.globalAlpha = 1;
  } else if (d.id === "map") {
    ctx.strokeStyle = K.ink;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 34, d.w - 80, d.h - 68);
    ctx.strokeStyle = K.seal;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(52, 46, d.w - 104, d.h - 92);
    ctx.globalAlpha = 1;
    const P = ([lon, lat]: [number, number]) => [80 + ((lon - 42) / 7) * (d.w - 160), 60 + ((37 - lat) / 8) * (d.h - 120)] as const;
    const pts = rivers.find((r) => r.name === "دجلة")!.points.map((p) => P(p as [number, number]));
    const pr = prog(t, at(tl, "دجلة") - 0.05, at(tl, "دجلة") + 1.1, easeOut);
    if (pr > 0) {
      const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
      let left = lens.reduce((a, b) => a + b, 0) * pr;
      ctx.strokeStyle = K.ink;
      ctx.lineWidth = 5;
      ctx.lineCap = ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0]![0], pts[0]![1]);
      for (let i = 1; i < pts.length && left > 0; i++) {
        const f = Math.min(1, left / lens[i - 1]!);
        ctx.lineTo(pts[i - 1]![0] + (pts[i]![0] - pts[i - 1]![0]) * f, pts[i - 1]![1] + (pts[i]![1] - pts[i - 1]![1]) * f);
        left -= lens[i - 1]!;
      }
      ctx.stroke();
    }
    const [bx, by] = P(places["بغداد"] as [number, number]);
    const ci = inkAt(t, at(tl, "بغداد"), end(tl, "بغداد"));
    if (ci.write > 0) {
      ctx.fillStyle = mixHex(K.ink, K.inkWet, ci.wet);
      ctx.beginPath();
      ctx.arc(bx, by, 9 * Math.min(1, ci.write * 2), 0, Math.PI * 2);
      ctx.fill();
    }
    const iB = tl.words.findIndex((w) => w.w.startsWith("بغداد"));
    inkLine(ctx, words.slice(iB, iB + 1), bx - 24, by + 18, 58, t);
    ctx.font = "400 22px Amiri";
    ctx.fillStyle = K.rule;
    ctx.textAlign = "right";
    ctx.fillText("موضع مادة أرشيفية · تنتظر مراجعة الرخصة", d.w - 70, d.h - 60);
  } else {
    const s0 = end(tl, "دجلة") + 0.1;
    ["المصدر: الطبري", "تاريخ الرسل والملوك", "حوادث سنة ١٤٥"].forEach((line, i) =>
      inkLine(ctx, [{ w: line, s: s0 + i * 0.45, e: s0 + i * 0.45 + 0.42 }], d.w - 50, 105 + i * 82, i === 0 ? 50 : 42, t),
    );
  }
};

/** ورقة منحنية قليلًا: تنتفخ في وسطها وترتفع أطرافها، شكل ثابت لكل ورقة (بذرتها) */
const paperGeometry = (d: Doc3) => {
  const g = new THREE.PlaneGeometry(d.w / U, d.h / U, 48, 48);
  const pos = g.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / (d.w / U) + 0.5;
    const v = pos.getY(i) / (d.h / U) + 0.5;
    const bow = 0.006 * Math.sin(Math.PI * u) * (d.id === "register" ? 1 : 0.5);
    const curl = 0.02 * Math.pow(Math.max(0, Math.abs(u - 0.5) * 2 - 0.82) / 0.18, 2) * (0.6 + 0.4 * Math.sin(d.seed + v * 3));
    const corner = 0.012 * Math.pow(Math.max(0, u + v - 1.75) / 0.25, 2);
    pos.setZ(i, bow + curl + corner);
  }
  g.computeVertexNormals();
  return g;
};

const Paper3D: React.FC<{ d: Doc3; t: number; tl: Timeline; ready: boolean }> = ({ d, t, tl, ready }) => {
  const ref = useRef<{ cv: HTMLCanvasElement; tex: THREE.CanvasTexture; key: string } | null>(null);
  if (!ref.current) {
    const cv = document.createElement("canvas");
    cv.width = d.w * PX;
    cv.height = d.h * PX;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    ref.current = { cv, tex, key: "" };
  }
  const fontOk = ready;
  const key = fontOk ? docState(d.id, t, tl) : "loading";
  if (key !== ref.current.key) {
    if (fontOk) drawDoc(ref.current.cv.getContext("2d")!, d, t, tl);
    else paperBase(ref.current.cv.getContext("2d")!, d);
    ref.current.tex.needsUpdate = true;
    ref.current.key = key;
  }
  const geo = useMemo(() => paperGeometry(d), [d]);
  const [x, z] = toWorld(d.x + d.w / 2, d.y + d.h / 2);
  return (
    <mesh geometry={geo} position={[x, 0.002 + d.lift * 0.004, z]} rotation={[-Math.PI / 2, 0, (-d.rot * Math.PI) / 180]} castShadow receiveShadow>
      <meshStandardMaterial map={ref.current.tex} roughness={0.95} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
};

/** حين يجهز الخط تُعاد كتابة الأوراق، فيُرسم المشهد مرة أخرى (الرسم في ThreeCanvas لا يتكرر من نفسه) */
export const RedrawWhenReady: React.FC<{ ready: boolean }> = ({ ready }) => {
  const advance = useThree((st) => st.advance);
  useEffect(() => {
    if (ready) advance(performance.now());
  }, [ready, advance]);
  return null;
};

const CameraRig: React.FC<{ s: Station }> = ({ s }) => {
  const { camera } = useThree();
  const p = cameraPose(s);
  camera.position.set(...p.position);
  camera.lookAt(...p.target);
  camera.updateMatrixWorld();
  return null;
};

/** الختم الخشبي: ينزل على الوثيقة عند كلمته، يضغط، ثم يرتفع ويبتعد */
const Stamp: React.FC<{ t: number; tl: Timeline }> = ({ t, tl }) => {
  const s = stampAt(t, at(tl, "للهجرة"));
  const deed = DOCS[1]!;
  const [x, z] = toWorld(deed.x + 540, deed.y + 560);
  const up = s.ink > 0 ? s.lift : Math.max(s.lift, 0);
  const y = 0.012 + 0.22 * up * up;
  const away = s.ink > 0 ? Math.max(0, (t - at(tl, "للهجرة") - 0.35) / 0.45) : 0;
  if (away >= 1 || t < at(tl, "للهجرة") - 0.9) return null;
  const fade = t < at(tl, "للهجرة") - 0.25 ? (t - (at(tl, "للهجرة") - 0.9)) / 0.65 : 1;
  return (
    <group position={[x + 0.5 * away * away, y + 0.35 * (1 - fade) + 0.3 * away, z - 0.2 * away]}>
      <mesh position={[0, 0.045, 0]} castShadow>
        <cylinderGeometry args={[0.145, 0.15, 0.09, 40]} />
        <meshStandardMaterial color={K.woodGrain} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.002, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.006, 40]} />
        <meshStandardMaterial color={K.seal} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 0.16, 20]} />
        <meshStandardMaterial color={K.woodGrain} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.26, 0]} castShadow>
        <sphereGeometry args={[0.06, 24, 16]} />
        <meshStandardMaterial color={K.woodGrain} roughness={0.7} />
      </mesh>
    </group>
  );
};

/** أدوات الكاتب على الطاولة: محبرة وقلم قصب وكتاب مغلق (تعطي المكان عمقه) */
const Props: React.FC = () => {
  const [ix, iz] = toWorld(520, 330);
  const [px, pz] = toWorld(1800, 300);
  const [bx, bz] = toWorld(250, 1250);
  return (
    <>
      <group position={[ix, 0, iz]}>
        <mesh position={[0, 0.055, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.085, 0.1, 0.11, 32]} />
          <meshStandardMaterial color={K.inkWet} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.112, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.004, 32]} />
          <meshStandardMaterial color="#120C18" roughness={0.2} />
        </mesh>
      </group>
      <mesh position={[px, 0.012, pz]} rotation={[0, 0.5, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.009, 0.007, 0.62, 12]} />
        <meshStandardMaterial color={C.gold} roughness={0.6} />
      </mesh>
      <group position={[bx, 0.07, bz]} rotation={[0, 0.25, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.62, 0.13, 0.86]} />
          <meshStandardMaterial color={K.paperOld} roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.068, 0]}>
          <boxGeometry args={[0.66, 0.008, 0.9]} />
          <meshStandardMaterial color="#B4583A" roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.068, 0]}>
          <boxGeometry args={[0.66, 0.008, 0.9]} />
          <meshStandardMaterial color="#B4583A" roughness={0.85} />
        </mesh>
        <mesh position={[-0.33, 0, 0]}>
          <boxGeometry args={[0.012, 0.144, 0.9]} />
          <meshStandardMaterial color="#B4583A" roughness={0.85} />
        </mesh>
      </group>
    </>
  );
};

/** الكتابة على خامة الورقة (Canvas) تحتاج خط أميري محمّلًا فعلًا لهذه الأوزان والحروف قبل الرسم:
 * يؤخر الرندر حتى يُحمّل، فلا تُرسم الكلمات أبدًا بخط بديل */
export const useCanvasFont = (brandReady: boolean, extra: string[] = []) => {
  const [handle] = useState(() => delayRender("خط أميري للورق"));
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!brandReady) return;
    Promise.all(["700 70px Amiri", "700 112px Amiri", "400 22px Amiri", ...extra].map((f) => document.fonts.load(f, "سنة مئة ١٤٥ بغداد")))
      .then(() => setOk(true))
      .catch(() => continueRender(handle));
  }, [brandReady, handle]);
  // الإطار يُصوَّر بعد أن تُكتب الأوراق وترسمها الكاميرا (إطاران من المتصفح)، لا قبل
  useEffect(() => {
    if (ok) requestAnimationFrame(() => requestAnimationFrame(() => continueRender(handle)));
  }, [ok, handle]);
  return ok;
};

export const ArchiveLab: React.FC = () => {
  const ready = useCanvasFont(useBrandFonts());
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const tl = archiveLabTimeline();
  const cam = deskCamAt(t, START, archiveStations(tl));
  const wood = useMemo(() => woodTexture(), []);
  return (
    <AbsoluteFill style={{ background: K.wood }}>
      <ThreeCanvas width={width} height={height} shadows camera={{ fov: 32, near: 0.05, far: 40 }} gl={{ antialias: true }}>
        <CameraRig s={cam} />
        <RedrawWhenReady ready={ready} />
        <color attach="background" args={["#120C18"]} />
        {/* ضوء النافذة: واحد، من أعلى يسار الطاولة، يلقي ظلالًا ناعمة؛ وسماء الغرفة دافئة خافتة */}
        <hemisphereLight args={["#F8EEDB", "#2B1E14", 0.9]} />
        <directionalLight position={[-2.6, 3.4, -1.6]} intensity={2.6} color="#F8EEDB" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-3} shadow-camera-near={0.5} shadow-camera-far={9} shadow-bias={-0.0004} shadow-radius={4} />
        <mesh position={[0, -0.06, 0]} receiveShadow>
          <boxGeometry args={[9, 0.12, 7]} />
          <meshStandardMaterial map={wood} roughness={0.78} />
        </mesh>
        {DOCS.map((d) => (
          <Paper3D key={d.id} d={d} t={t} tl={tl} ready={ready} />
        ))}
        <Stamp t={t} tl={tl} />
        <Props />
      </ThreeCanvas>
      <Tag corner="tr" text="نموذج تقني · اللوح: خزانة الأرشيف ثلاثي الأبعاد · بلا صوت · لا يُنشر" />
    </AbsoluteFill>
  );
};
