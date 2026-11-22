/**
 * اتجاه «حكايات الحارة مطبوعة» لـ«بالإسلام» (المراجع: رسوم كتب الأطفال المصرية لمحيي الدين اللباد، وأغلفة حلمي التوني
 * إلهامًا لا نسخًا، ولافتات المحلات المرسومة باليد، وطباعة الريزو بطبقاتها المنزاحة قليلًا): قصاصات ورق بثلاثة
 * أحبار على أعماق مختلفة، وكل طبقة تحتها ظل حبرها منزاحًا كأنها طُبعت. الكاميرا تتحرك فتنفصل الطبقات (عمق حقيقي).
 * الشخصيتان قصاصتان بلا وجوه. عند ذكر الله يسكن كل شيء.
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useBrandFonts } from "../../useBrandFonts";
import { Stage3D, camAt, ease, grain, lightsAt, safeKeys, type Cam, type Light } from "../../three";
import { BAA, DIR_STILL, DirFrame, wordAt } from "./common";
import { figureShapes } from "./figure";

const START: Cam = { target: [0, 2.2, 0], yaw: -8, pitch: 2, dist: 11, fov: 34 };
const LIGHTS: Light[] = [
  { kind: "ambient", kelvin: 5600, intensity: 1.6, position: [0, 0, 0] },
  { kind: "key", kelvin: 5000, intensity: 1.1, position: [3, 6, 8] },
];

/** ورق مطبوع: لون الحبر على حبيبات الورق */
const usePaper = (seed: number) => useMemo(() => {
  const n = 128, g = grain(n, seed, 0.35), rgba = new Uint8Array(n * n * 4);
  for (let i = 0; i < g.length; i++) { const v = 200 + (g[i]! - 128) * 0.4; rgba.set([v, v, v, 255], i * 4); }
  const t = new THREE.DataTexture(rgba, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.needsUpdate = true;
  return t;
}, [seed]);

/** قصاصة: الشكل بحبره، وتحته ظل الحبر نفسه منزاحًا (انزياح الريزو) */
const Cutout: React.FC<{ shapes: THREE.Shape[]; ink: string; z: number; tex: THREE.Texture; shift?: [number, number] }> = ({ shapes, ink, z, tex, shift = [0.035, -0.025] }) => (
  <group position={[0, 0, z]}>
    {shapes.map((s, i) => (
      <group key={i}>
        <mesh position={[shift[0], shift[1], -0.004]}><shapeGeometry args={[s, 24]} /><meshBasicMaterial color={new THREE.Color(ink).lerp(new THREE.Color(BAA.paper), 0.55)} /></mesh>
        <mesh castShadow receiveShadow><shapeGeometry args={[s, 24]} /><meshStandardMaterial color={ink} map={tex} roughness={0.95} side={THREE.DoubleSide} /></mesh>
      </group>
    ))}
  </group>
);

const archRow = () => {
  const out: THREE.Shape[] = [];
  const wall = new THREE.Shape();
  wall.moveTo(-8, 0); wall.lineTo(8, 0); wall.lineTo(8, 5.4); wall.lineTo(-8, 5.4); wall.lineTo(-8, 0);
  for (const x of [-5.4, -1.8, 1.8, 5.4]) {
    const h = new THREE.Path();
    h.moveTo(x - 1.1, 0.4); h.lineTo(x + 1.1, 0.4); h.lineTo(x + 1.1, 2.6); h.quadraticCurveTo(x + 1.1, 3.8, x, 4.1); h.quadraticCurveTo(x - 1.1, 3.8, x - 1.1, 2.6); h.lineTo(x - 1.1, 0.4);
    wall.holes.push(h);
  }
  out.push(wall);
  return out;
};
const stall = (x: number) => {
  const s = new THREE.Shape();
  s.moveTo(x - 1.4, 0); s.lineTo(x + 1.4, 0); s.lineTo(x + 1.4, 1.1); s.lineTo(x - 1.4, 1.1); s.lineTo(x - 1.4, 0);
  const awning = new THREE.Shape();
  awning.moveTo(x - 1.7, 2.3); awning.lineTo(x + 1.7, 2.3);
  for (let k = 0; k <= 6; k++) { const xx = x + 1.7 - (k * 3.4) / 6; awning.lineTo(xx, k % 2 ? 1.75 : 1.9); }
  awning.lineTo(x - 1.7, 2.3);
  const pole1 = new THREE.Shape(); pole1.moveTo(x - 1.5, 0); pole1.lineTo(x - 1.42, 0); pole1.lineTo(x - 1.42, 2.3); pole1.lineTo(x - 1.5, 2.3);
  const pole2 = new THREE.Shape(); pole2.moveTo(x + 1.42, 0); pole2.lineTo(x + 1.5, 0); pole2.lineTo(x + 1.5, 2.3); pole2.lineTo(x + 1.42, 2.3);
  return [s, awning, pole1, pole2];
};

const Person: React.FC<{ x: number; flip: boolean; ink: string; arm: number; tex: THREE.Texture; cap: "turban" | "kufiya" }> = ({ x, flip, ink, arm, tex, cap }) => {
  const s = useMemo(() => figureShapes({ robe: cap === "turban" ? 1 : 1.1, cap, stoop: 0 }), [cap]);
  return (
    <group position={[x, 0, 0]} scale={[flip ? -2.6 : 2.6, 2.6, 1]}>
      <Cutout shapes={[s.robe, s.head]} ink={ink} z={0} tex={tex} shift={[0.012, -0.01]} />
      <Cutout shapes={[s.cap]} ink={BAA.paper} z={0.003} tex={tex} shift={[0.008, -0.006]} />
      <group position={[s.shoulder.x + 0.02, s.shoulder.y - 0.01, 0.005]} rotation={[0, 0, Math.PI + arm]}>
        <Cutout shapes={[s.upper]} ink={ink} z={0} tex={tex} shift={[0.008, -0.006]} />
        <group position={[0, 0.19, 0.002]} rotation={[0, 0, -arm * 0.3]}><Cutout shapes={[s.fore]} ink={ink} z={0} tex={tex} shift={[0.008, -0.006]} /></group>
      </group>
    </group>
  );
};

export const PrintedAlleyLab: React.FC = () => {
  useBrandFonts();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const still = DIR_STILL;
  const paperA = usePaper(3), paperB = usePaper(7), paperC = usePaper(11);
  const wall = useMemo(archRow, []);
  const stalls = useMemo(() => [...stall(-3.2), ...stall(3.4)], []);
  const p = (w: string, d = 0.7) => { const k = safeKeys([{ a: wordAt(w) - 0.1, b: wordAt(w) - 0.1 + d, to: 1 }], still)[0]!; return ease((t - k.a) / (k.b - k.a)); };
  const enter = p("رجلان", 0.9), market = p("السوق", 0.7), say1 = p("يقول", 0.5), say2 = p("الحقُّ", 0.5);
  const cam = camAt(t, START, [
    { a: wordAt("السوق") - 0.2, b: wordAt("السوق") + 1.2, to: { ...START, yaw: 6, dist: 9.6 } },
    { a: wordAt("يقول") - 0.1, b: wordAt("معي") + 0.4, to: { ...START, yaw: 14, dist: 8.4, target: [0.3, 2.0, 0] } },
  ], { still, shake: { amp: 0.015, rate: 0.5, seed: 8 } });
  return (
    <>
      <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, LIGHTS, still)} background={BAA.paper}>
        {/* سماء الحارة ورقة، والجدار بأقواسه طبقة الزمرد بعيدة */}
        <mesh position={[0, 3, -4.2]}><planeGeometry args={[40, 20]} /><meshStandardMaterial color={BAA.paper} map={paperC} roughness={1} /></mesh>
        <group position={[0, 0, -3]}><Cutout shapes={wall} ink={BAA.emerald} z={0} tex={paperA} shift={[0.06, -0.05]} /></group>
        {/* الدكاكين طبقة النحاس، تنزل عند «السوق» */}
        <group position={[0, (1 - market) * -3, -1.4]}><Cutout shapes={stalls} ink={BAA.copper} z={0} tex={paperB} shift={[0.05, -0.04]} /></group>
        {/* الأرض */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -1]} receiveShadow><planeGeometry args={[40, 12]} /><meshStandardMaterial color="#D9B08C" map={paperA} roughness={1} /></mesh>
        <Person x={-6 + enter * 4.2} flip={false} ink={BAA.rose} arm={say1 * 1.2} tex={paperC} cap="turban" />
        <Person x={6 - enter * 4.2} flip ink={BAA.night} arm={say2 * 1.0} tex={paperB} cap="kufiya" />
      </Stage3D>
      <DirFrame t={t} name="حكايات الحارة مطبوعة" tone="dark" />
    </>
  );
};
