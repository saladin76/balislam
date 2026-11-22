/**
 * اتجاه «دفتر الرحّالة» (مراجع المنسّق ٢١ نوفمبر، دفاتر الزمن ١): أطلس مخطوط مفتوح على الطاولة بثري دي.
 * المرجع: خرائط مدرسة البلخي (الإصطخري وابن حوقل): البحر دائرة، والأنهار خطوط مستقيمة، والمدن دوائر،
 * والجنوب في الأعلى؛ والحواشي في هامش المتن بخط الرقعة. الحبر يرسم الخط بنفسه، واللون يُغسل داخل
 * الإقليم كالألوان المائية. كادرات للمقارنة لا قالب (لا قالب قبل اختيار المالك).
 * الألوان من هوية القناة المعتمدة؛ الزنجار واللازورد التاريخيان يحتاجان قرار هوية من المالك إن اختار الاتجاه.
 */
import React, { useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useBrandFonts } from "../../useBrandFonts";
import { C, Tag, prog, easeOut } from "../horizon/kit";
import { at, buildTimeline, end, type Timeline } from "../horizon/timeline";
import { deskCamAt, inkAt, type Station, type StationKey } from "../archive/desk";
import { ARCHIVE_COLORS as K, RedrawWhenReady, cameraPose, grain, inkLine, useCanvasFont, woodTexture } from "../archive/ArchiveLab";

export const RAHHALA_FPS = 30;
export const RAHHALA_SENTENCES = ["بنى المنصور بغداد على دجلة، | وسمّاها مدينة السلام."];
export const rahhalaTimeline = (): Timeline => buildTimeline(RAHHALA_SENTENCES, 0.7);
export const rahhalaFrames = () => Math.ceil((rahhalaTimeline().end + 1.8) * RAHHALA_FPS);
const tokens = () => RAHHALA_SENTENCES.join(" ").split(/\s+/).filter((w) => w && w !== "|");

/** ألوان الصحيفة: «لازورد» البحر و«زنجبار» المدن تقريبًا من لوحة الهوية المعتمدة */
export const RAHHALA_COLORS = { sea: "#BFB3C9", land: "#EADBC0", wash: C.gold, city: C.ribbon, ink: C.ink };
const R = RAHHALA_COLORS;

const PAGE = { w: 1000, h: 1360 };
const PX = 1.5;

export const rahhalaStations = (tl: Timeline): StationKey[] => {
  const k = (a: number, d: number, s: Station): StationKey => ({ ...s, a, b: a + d });
  return [
    k(at(tl, "المنصور") - 0.2, 1.1, { id: "map", x: 2420, y: 1180, z: 1.05, shot: "medium" }),
    k(at(tl, "دجلة") - 0.1, 0.9, { id: "rivers", x: 2440, y: 1330, z: 1.6, shot: "detail" }),
    k(at(tl, "وسمّاها") - 0.3, 1.2, { id: "margin", x: 1240, y: 1020, z: 1.35, shot: "close" }),
  ];
};
export const RAHHALA_START: Station = { id: "book", x: 1900, y: 1200, z: 0.62, shot: "wide" };

const wobble = (a: number, seed: number) => 1 + 0.07 * Math.sin(a * 3 + seed) + 0.04 * Math.sin(a * 7 + seed * 2) + 0.02 * Math.sin(a * 13 + seed);

/** غسل لوني كالألوان المائية: يتسع من نقطة بحافة غير منتظمة ثابتة البذرة، وحافته أغمق قليلًا */
const wash = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, p: number, color: string, seed: number) => {
  if (p <= 0) return;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const rr = r * p * wobble(a, seed);
    ctx[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
};

/** خط يرسمه الحبر بنفسه من أوله إلى آخره */
const inkStroke = (ctx: CanvasRenderingContext2D, pts: [number, number][], p: number, width: number, color: string = R.ink) => {
  if (p <= 0) return;
  const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1]));
  let left = lens.reduce((a, b) => a + b, 0) * p;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(...pts[0]!);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const f = Math.min(1, left / lens[i - 1]!);
    ctx.lineTo(pts[i - 1]![0] + (pts[i]![0] - pts[i - 1]![0]) * f, pts[i - 1]![1] + (pts[i]![1] - pts[i - 1]![1]) * f);
    left -= lens[i - 1]!;
  }
  ctx.stroke();
  ctx.restore();
};

const circlePts = (cx: number, cy: number, r: number, from = 0, to = Math.PI * 2, n = 90): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => { const a = from + ((to - from) * i) / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });

const basePage = (ctx: CanvasRenderingContext2D) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = K.paperOld;
  ctx.fillRect(0, 0, PAGE.w * PX, PAGE.h * PX);
  ctx.fillStyle = ctx.createPattern(grain(), "repeat")!;
  ctx.fillRect(0, 0, PAGE.w * PX, PAGE.h * PX);
  ctx.scale(PX, PX);
  ctx.strokeStyle = C.ribbon;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.strokeRect(70, 80, PAGE.w - 140, PAGE.h - 160);
  ctx.strokeStyle = C.gold;
  ctx.strokeRect(78, 88, PAGE.w - 156, PAGE.h - 176);
  ctx.globalAlpha = 1;
};

/** صحيفة الخريطة: الخليج نصف دائرة في الأعلى (الجنوب فوق)، ودجلة والفرات خطان مستقيمان، وبغداد دائرة بينهما */
const drawMap = (ctx: CanvasRenderingContext2D, t: number, tl: Timeline) => {
  basePage(ctx);
  const sea = prog(t, 0.2, 1.6, easeOut);
  wash(ctx, 500, 200, 300, prog(t, 0.6, 2.2, easeOut), R.sea, 3);
  inkStroke(ctx, circlePts(500, 200, 300, 0, Math.PI), sea, 5);
  ctx.save();
  ctx.font = "700 46px Amiri";
  ctx.fillStyle = R.ink;
  ctx.globalAlpha = sea;
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ctx.fillText("بحر فارس", 500, 330);
  ctx.restore();
  const riv = prog(t, at(tl, "دجلة") - 0.05, end(tl, "دجلة") + 0.5, easeOut);
  inkStroke(ctx, [[400, 500], [400, 1200]], riv, 6);
  inkStroke(ctx, [[600, 500], [600, 1200]], riv, 6);
  inkStroke(ctx, [[400, 760], [600, 760]], prog(t, end(tl, "دجلة") + 0.2, end(tl, "دجلة") + 0.8), 3);
  const tw = tokens();
  const wd = (i: number) => ({ w: tw[i]!, s: tl.words[i]!.s, e: tl.words[i]!.e });
  const iT = tl.words.findIndex((w) => w.w.startsWith("دجلة"));
  inkLine(ctx, [{ ...wd(iT), w: "دجلة" }], 640, 1010, 40, t, undefined, "Amiri", 700);
  inkLine(ctx, [{ ...wd(iT), w: "الفرات" }], 390, 1010, 40, t, undefined, "Amiri", 700);
  const iB = tl.words.findIndex((w) => w.w.startsWith("بغداد"));
  const city = inkAt(t, tl.words[iB]!.s, tl.words[iB]!.e);
  wash(ctx, 500, 640, 120, prog(t, tl.words[iB]!.e, tl.words[iB]!.e + 1.6, easeOut), R.wash, 9);
  inkStroke(ctx, circlePts(500, 640, 44), city.write, 4, R.city);
  inkLine(ctx, [wd(iB)], 500, 578, 44, t, 500, "Amiri", 700);
};

/** صحيفة المتن: الكلام بالنسخ، والحاشية بالرقعة مائلة في الهامش عند «وسمّاها» */
const drawText = (ctx: CanvasRenderingContext2D, t: number, tl: Timeline) => {
  basePage(ctx);
  const tw = tokens();
  const words = tl.words.map((w, i) => ({ w: tw[i] ?? w.w, s: w.s, e: w.e }));
  const n1 = words.findIndex((w) => w.w.startsWith("وسم"));
  inkLine(ctx, words.slice(0, 3), 830, 300, 60, t);
  inkLine(ctx, words.slice(3, n1), 830, 400, 60, t);
  inkLine(ctx, words.slice(n1), 830, 500, 60, t);
  ctx.save();
  ctx.translate(250, 860);
  ctx.rotate(-0.5);
  const s = at(tl, "مدينة");
  inkLine(ctx, [{ w: "مدينة السلام", s, e: s + 0.7 }], 260, 0, 44, t, undefined, "Aref Ruqaa", 400, [C.ribbon, "#B4583A"]);
  inkLine(ctx, [{ w: "سنة ١٤٥", s: s + 0.7, e: s + 1.2 }], 200, 64, 40, t, undefined, "Aref Ruqaa", 400, [C.ribbon, "#B4583A"]);
  ctx.restore();
};

const pageKey = (side: "map" | "text", t: number) => `${side}:${Math.round(t * 30)}`;

const Page: React.FC<{ side: "map" | "text"; t: number; tl: Timeline; ready: boolean }> = ({ side, t, tl, ready }) => {
  const ref = useRef<{ cv: HTMLCanvasElement; tex: THREE.CanvasTexture; key: string } | null>(null);
  if (!ref.current) {
    const cv = document.createElement("canvas");
    cv.width = PAGE.w * PX;
    cv.height = PAGE.h * PX;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    ref.current = { cv, tex, key: "" };
  }
  const key = ready ? pageKey(side, t) : "loading";
  if (key !== ref.current.key) {
    const ctx = ref.current.cv.getContext("2d")!;
    if (ready) (side === "map" ? drawMap : drawText)(ctx, t, tl);
    else basePage(ctx);
    ref.current.tex.needsUpdate = true;
    ref.current.key = key;
  }
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(PAGE.w / 1000, PAGE.h / 1000, 40, 40);
    const pos = g.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / (PAGE.w / 1000) + 0.5;
      const k = side === "map" ? u : 1 - u; // من الكعب إلى الحافة
      pos.setZ(i, 0.05 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) - 0.012 * k);
    }
    g.computeVertexNormals();
    return g;
  }, [side]);
  const x = side === "map" ? PAGE.w / 2000 + 0.004 : -PAGE.w / 2000 - 0.004;
  return (
    <mesh geometry={geo} position={[x, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <meshStandardMaterial map={ref.current.tex} roughness={0.95} side={THREE.DoubleSide} />
    </mesh>
  );
};

const Rig: React.FC<{ s: Station }> = ({ s }) => {
  const { camera } = useThree();
  const p = cameraPose(s);
  camera.position.set(...p.position);
  camera.lookAt(...p.target);
  camera.updateMatrixWorld();
  return null;
};

export const RahhalaLab: React.FC = () => {
  const ready = useCanvasFont(useBrandFonts(), ["400 44px Aref Ruqaa"]);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const tl = rahhalaTimeline();
  const cam = deskCamAt(t, RAHHALA_START, rahhalaStations(tl));
  const wood = useMemo(() => woodTexture(), []);
  return (
    <AbsoluteFill style={{ background: K.wood }}>
      <ThreeCanvas width={width} height={height} shadows camera={{ fov: 32, near: 0.05, far: 40 }} gl={{ antialias: true }}>
        <Rig s={cam} />
        <RedrawWhenReady ready={ready} />
        <color attach="background" args={["#120C18"]} />
        <hemisphereLight args={["#F8EEDB", "#2B1E14", 0.9]} />
        <directionalLight position={[-2.6, 3.4, -1.6]} intensity={2.6} color="#F8EEDB" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-3} shadow-bias={-0.0004} />
        <mesh position={[0, -0.06, 0]} receiveShadow>
          <boxGeometry args={[9, 0.12, 7]} />
          <meshStandardMaterial map={wood} roughness={0.78} />
        </mesh>
        {/* جلد الأطلس تحت الصحيفتين، وكعبه */}
        <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.1, 0.024, 1.42]} />
          <meshStandardMaterial color="#5A4632" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.42, 16]} />
          <meshStandardMaterial color="#2B1E14" roughness={0.8} />
        </mesh>
        <Page side="map" t={t} tl={tl} ready={ready} />
        <Page side="text" t={t} tl={tl} ready={ready} />
      </ThreeCanvas>
      <Tag corner="tr" text="اتجاه للمقارنة · دفتر الرحّالة · لا يُنشر" />
    </AbsoluteFill>
  );
};
