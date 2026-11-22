/**
 * اتجاه «خيال الظل» لـ«بالإسلام» (المرجع: خيال الظل العربي، بابات ابن دانيال في القاهرة، والقرة قوز العثماني):
 * ستارة قماش يضيئها سراج من خلفها يرتعش قليلًا، ودميتان من جلد ملوّن شفاف ملتصقتان بها، مثقوبتان بالزخرفة،
 * على عصيّ تنزل خارج الكادر، وتتحرك من مفاصلها. الشخصية ظل بلا وجه من أصلها. القوس (motif «arches») يُنزل
 * عند «السوق». عند ذكر الله يسكن كل شيء، والسراج يثبت.
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useBrandFonts } from "../../useBrandFonts";
import { Stage3D, camAt, calmAt, ease, flicker, safeKeys, useAssetTextures, type Cam } from "../../three";
import { BAA, DIR_STILL, DirFrame, wordAt } from "./common";
import { figureShapes, type FigureVariant } from "./figure";

const SCREEN = { w: 9, h: 5.2 };
const START: Cam = { target: [0, 1.9, 0], yaw: -6, pitch: 3, dist: 12.2, fov: 34 };
const LAMP = { depth: 0.12, rate: 5, seed: 21 };

/** الجلد المصبوغ كما يُرى والسراج خلفه: لون الصبغة مضروبًا في نور القماش، فيرتعش معه */
const CLOTH = new THREE.Color("#F2D2B0");
const lit = (hex: string, k: number) => new THREE.Color(hex).multiply(CLOTH).multiplyScalar(1.12 * (0.82 + 0.18 * k));

const useScreenTexture = () => useMemo(() => {
  const w = 1024, h = 600, c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  // نور السراج على القماش: أقوى في موضعه ويخفت إلى الحواف (ضوء فعلي، لا تدرّج زخرفي)
  const r = g.createRadialGradient(w * 0.5, h * 0.62, 40, w * 0.5, h * 0.62, w * 0.62);
  r.addColorStop(0, "#FBF6EE"); r.addColorStop(0.55, "#E9C6A8"); r.addColorStop(1, "#7A5A44");
  g.fillStyle = r; g.fillRect(0, 0, w, h);
  // نسج القماش
  g.globalAlpha = 0.07; g.strokeStyle = "#1B1B1B";
  for (let x = 0; x < w; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}, []);

const Puppet: React.FC<{ v: FigureVariant; color: string; x: number; flip: boolean; arm: number; sway: number; light: number }> = ({ v, color, x, flip, arm, sway, light }) => {
  const s = useMemo(() => figureShapes(v), [v]);
  const leather = lit(color, light), edge = new THREE.Color("#1B1B1B");
  const mat = (c: THREE.Color, o = 0.94) => <meshBasicMaterial color={c} transparent opacity={o} side={THREE.DoubleSide} />;
  const part = (shape: THREE.Shape, c: THREE.Color, z: number, o?: number) => <mesh position={[0, 0, z]}><shapeGeometry args={[shape, 24]} />{mat(c, o)}</mesh>;
  return (
    <group position={[x, 0.35, 0.02]} scale={[flip ? -3.5 : 3.5, 3.5, 1]} rotation={[0, 0, sway]}>
      {/* حافة الجلد الداكنة ثم الجلد الملوّن */}
      {/* حافة الجلد الداكنة: الشكل نفسه أكبر قليلًا خلفه، فلا يظهر منه إلا خيط */}
      <group scale={[1.03, 1.012, 1]} position={[0, -0.004, -0.004]}>{part(s.robe, edge, 0, 1)}{part(s.head, edge, 0, 1)}{part(s.cap, edge, 0, 1)}</group>
      {part(s.robe, leather, 0)}
      {part(s.head, leather, 0.001)}
      {part(s.cap, lit(BAA.gold, light), 0.002)}
      {/* الذراع من الكتف إلى خارج الثوب، يرتفع نحو الآخر مع كلمته (π = متدلٍّ، π + π/2 = أفقي نحوه) */}
      <group position={[s.shoulder.x + 0.02, s.shoulder.y - 0.01, 0.003]} rotation={[0, 0, Math.PI + arm]}>
        {part(s.upper, leather, 0)}
        <group position={[0, 0.19, 0.001]} rotation={[0, 0, -arm * 0.3]}>{part(s.fore, leather, 0)}<mesh position={[0, 0, 0.002]}><circleGeometry args={[0.012, 12]} /><meshBasicMaterial color="#1B1B1B" /></mesh></group>
        <mesh position={[0, 0, 0.002]}><circleGeometry args={[0.013, 12]} /><meshBasicMaterial color="#1B1B1B" /></mesh>
        {/* عصا الذراع */}
        <mesh position={[0, 0.2, -0.002]} rotation={[0, 0, 0]}><planeGeometry args={[0.006, 0.4]} /><meshBasicMaterial color="#1B1B1B" /></mesh>
      </group>
      {/* عصا الجسد تنزل خارج الكادر */}
      <mesh position={[0, -0.3, -0.002]}><planeGeometry args={[0.008, 0.7]} /><meshBasicMaterial color="#1B1B1B" /></mesh>
    </group>
  );
};

const Arch: React.FC<{ drop: number; light: number }> = ({ drop, light }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-1.3, 0); s.lineTo(-1.3, 1.6); s.quadraticCurveTo(-1.3, 2.7, 0, 3.05); s.quadraticCurveTo(1.3, 2.7, 1.3, 1.6); s.lineTo(1.3, 0);
    s.lineTo(1.05, 0); s.lineTo(1.05, 1.6); s.quadraticCurveTo(1.05, 2.5, 0, 2.78); s.quadraticCurveTo(-1.05, 2.5, -1.05, 1.6); s.lineTo(-1.05, 0);
    return s;
  }, []);
  return (
    <group position={[0, 0.35 + (1 - drop) * 3.5, 0.01]}>
      <mesh><shapeGeometry args={[shape, 32]} /><meshBasicMaterial color={lit(BAA.emerald, light)} transparent opacity={drop} side={THREE.DoubleSide} blending={THREE.MultiplyBlending} premultipliedAlpha depthWrite={false} /></mesh>
    </group>
  );
};

/** قطعة ديكور من جلد مصبوغ ملتصقة بالستارة (دكان بمظلة، فانوس معلّق) */
const Leather: React.FC<{ shape: THREE.Shape | THREE.Shape[]; color: string; light: number; pos: [number, number]; scale?: number }> = ({ shape, color, light, pos, scale = 1 }) => (
  <group position={[pos[0], pos[1], 0.008]} scale={scale}>
    <mesh position={[0.02, -0.015, -0.002]}><shapeGeometry args={[shape, 24]} /><meshBasicMaterial color="#1B1B1B" /></mesh>
    <mesh><shapeGeometry args={[shape, 24]} /><meshBasicMaterial color={lit(color, light)} transparent opacity={0.94} side={THREE.DoubleSide} /></mesh>
  </group>
);
/** الدكان: طاولة بثلاث نوافذ مثقوبة، وعمودان، ومظلة بحافة مسنّنة — أشكال منفصلة لا مسار يقطع نفسه */
const stallShapes = () => {
  const rect = (x0: number, y0: number, x1: number, y1: number) => { const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.lineTo(x0, y0); return s; };
  const counter = rect(-0.9, 0, 0.9, 0.7);
  for (const x of [-0.45, 0, 0.45]) { const h = new THREE.Path(); h.absarc(x, 0.35, 0.12, 0, Math.PI * 2, true); counter.holes.push(h); }
  const awning = new THREE.Shape();
  awning.moveTo(-1.05, 1.9); awning.lineTo(1.05, 1.9);
  for (let k = 0; k <= 6; k++) awning.lineTo(1.05 - (k * 2.1) / 6, k % 2 ? 1.32 : 1.48);
  awning.lineTo(-1.05, 1.9);
  return [counter, rect(-0.8, 0.7, -0.7, 1.5), rect(0.7, 0.7, 0.8, 1.5), awning];
};
const lanternShape = () => {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.22, 0.25); s.lineTo(0.22, 0.75); s.lineTo(0.1, 0.95); s.lineTo(0.03, 0.95); s.lineTo(0.03, 1.6); s.lineTo(-0.03, 1.6); s.lineTo(-0.03, 0.95); s.lineTo(-0.1, 0.95); s.lineTo(-0.22, 0.75); s.lineTo(-0.22, 0.25); s.lineTo(0, 0);
  for (let k = 0; k < 3; k++) { const h = new THREE.Path(); h.absellipse(0, 0.35 + k * 0.17, 0.09, 0.06, 0, Math.PI * 2, true, 0); s.holes.push(h); }
  return s;
};

export const ShadowTheaterLab: React.FC = () => {
  useBrandFonts();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const still = DIR_STILL;
  const screen = useScreenTexture();
  const cotton = useAssetTextures(["balislam-cotton-diff"], [4, 2.4]);
  const wood = useAssetTextures(["balislam-wood-diff"], [1, 3]);
  const stall = useMemo(stallShapes, []), lantern = useMemo(lanternShape, []);
  const light = flicker(t, LAMP, still);
  // مفاتيح الكلام (تتأخر عن نافذة السكون إن وقعت فيها)
  const p = (w: string, d = 0.7) => { const k = safeKeys([{ a: wordAt(w) - 0.1, b: wordAt(w) - 0.1 + d, to: 1 }], still)[0]!; return ease((t - k.a) / (k.b - k.a)); };
  const enter = p("رجلان", 0.9), market = p("السوق", 0.8), say1 = p("يقول", 0.5), say2 = p("الحقُّ", 0.5);
  const cam = camAt(t, START, [{ a: wordAt("السوق") - 0.2, b: wordAt("السوق") + 1.4, to: { ...START, dist: 11, yaw: -2 } },
    { a: wordAt("يقول") - 0.1, b: wordAt("معي") + 0.3, to: { ...START, dist: 10.2, yaw: 4, target: [0.4, 1.95, 0] } }], { still, shake: { amp: 0.02, rate: 0.6, seed: 4 } });
  const breath = (seed: number) => 0.015 * Math.sin(t * 2.1 + seed) * calmAt(t, still);
  if (!cotton || !wood) return null;
  return (
    <>
      <Stage3D width={width} height={height} cam={cam} lights={[]} background={BAA.night}>
        {/* نسج القطن الحقيقي (CC0) مضروبًا في نور السراج */}
        <mesh position={[0, 2.6, -0.005]}><planeGeometry args={[SCREEN.w, SCREEN.h]} /><meshBasicMaterial map={cotton[0]} transparent blending={THREE.MultiplyBlending} premultipliedAlpha depthWrite={false} /></mesh>
        {/* الستارة وإطارها الخشبي */}
        <mesh position={[0, 2.6, -0.01]}><planeGeometry args={[SCREEN.w, SCREEN.h]} /><meshBasicMaterial map={screen} color={new THREE.Color(1, 1, 1).multiplyScalar(0.7 + 0.3 * light)} /></mesh>
        {[[-SCREEN.w / 2 - 0.12, 2.6, 0.24, SCREEN.h + 0.5], [SCREEN.w / 2 + 0.12, 2.6, 0.24, SCREEN.h + 0.5], [0, 2.6 + SCREEN.h / 2 + 0.12, SCREEN.w + 0.48, 0.24], [0, 2.6 - SCREEN.h / 2 - 0.12, SCREEN.w + 0.48, 0.24]].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x!, y!, 0.03]}><planeGeometry args={[w!, h!]} /><meshBasicMaterial map={wood[0]} color="#7A5A44" /></mesh>
        ))}
        {/* ديكور الجلد على الستارة: دكانان وفانوس معلّق، فلا تبقى الستارة فارغة */}
        <Leather shape={stall} color={BAA.copper} light={light} pos={[-3.2, 0.35]} scale={1.05} />
        <Leather shape={stall} color={BAA.emerald} light={light} pos={[3.25, 0.35]} scale={0.95} />
        <Leather shape={lantern} color={BAA.gold} light={light} pos={[1.6, 3.55]} scale={0.9} />
        <Leather shape={lantern} color={BAA.gold} light={light} pos={[-1.7, 3.75]} scale={0.75} />
        <Arch drop={market} light={light} />
        <Puppet v={{ robe: 1, cap: "turban", stoop: 0 }} color={BAA.copper} x={-4.6 + enter * 3.0} flip={false} arm={say1 * 1.15} sway={breath(0) - say1 * 0.04} light={light} />
        <Puppet v={{ robe: 1.12, cap: "kufiya", stoop: 0 }} color={BAA.rose} x={4.6 - enter * 3.0} flip arm={say2 * 1.0} sway={breath(2) + say2 * 0.05} light={light} />
      </Stage3D>
      <DirFrame t={t} name="خيال الظل" />
    </>
  );
};
