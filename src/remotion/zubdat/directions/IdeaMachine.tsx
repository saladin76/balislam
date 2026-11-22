/**
 * اتجاه «الأفكار آلات» لـ«زبدة الكتب» (المرجع: كتاب الجزري في معرفة الحيل الهندسية، ١٢٠٦، ورسوم ابن الهيثم):
 * الفكرة آلة تعمل على ورقة بيضاء. خزان يقطر الماء في كوب على ذراع («يصلّي… يشعر»)، فيثقل الكوب فيميل الذراع («ينتظر»)،
 * فيدفع ترسًا يدير ترسًا («الشعور… قبل»)، فيرفع بطاقة «الحضور» بالفسفوري (الفكرة وحدها بالفسفوري).
 * أبيض وأسود كهوية «القلم المميِّز». عند ذكر الله يسكن كل شيء.
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useBrandFonts } from "../../useBrandFonts";
import { Stage3D, camAt, ease, lightsAt, safeKeys, useGrainTexture, type Cam, type Light } from "../../three";
import { IDEA, ZB, ZFrame, Z_STILL, zAt } from "./common";

const START: Cam = { target: [0.4, 1.6, 0], yaw: -14, pitch: 10, dist: 10, fov: 34 };
const LIGHTS: Light[] = [
  { kind: "ambient", kelvin: 6500, intensity: 1.0, position: [0, 0, 0] },
  { kind: "key", kelvin: 5600, intensity: 2.2, position: [-4, 7, 5] },
];
const INK = <meshStandardMaterial color={ZB.dark} roughness={0.55} metalness={0.2} />;

const gearShape = (r: number, teeth: number) => {
  const s = new THREE.Shape();
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2, a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2, rr = i % 2 ? r : r * 1.14;
    if (i === 0) s.moveTo(rr * Math.cos(a0), rr * Math.sin(a0)); else s.lineTo(rr * Math.cos(a0), rr * Math.sin(a0));
    s.lineTo(rr * Math.cos(a1), rr * Math.sin(a1));
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.22, 0, Math.PI * 2, true); s.holes.push(hole);
  return s;
};
const Gear: React.FC<{ r: number; teeth: number; pos: [number, number, number]; angle: number }> = ({ r, teeth, pos, angle }) => {
  const shape = useMemo(() => gearShape(r, teeth), [r, teeth]);
  return <mesh position={pos} rotation={[0, 0, angle]} castShadow><extrudeGeometry args={[shape, { depth: 0.18, bevelEnabled: false }]} />{INK}</mesh>;
};

const useCardTexture = (ready: boolean) => useMemo(() => {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = ZB.fluo; g.fillRect(0, 0, 512, 256);
  g.fillStyle = ZB.ink; g.direction = "rtl"; g.textAlign = "center"; g.font = "150px Lalezar"; g.fillText(IDEA, 256, 180);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}, [ready]);

export const IdeaMachineLab: React.FC = () => {
  const ready = useBrandFonts();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const still = Z_STILL;
  const paper = useGrainTexture(13, 0.25, 4);
  const card = useCardTexture(ready);
  const key = (a: number, d: number) => safeKeys([{ a, b: a + d, to: 1 }], still)[0]!;
  const prog = (k: { a: number; b: number }) => Math.min(1, Math.max(0, (t - k.a) / (k.b - k.a)));
  const drip = key(zAt("يصلّي") - 0.1, zAt("يشعر") - zAt("يصلّي") + 0.5);
  const fill = prog(drip);
  const tip = ease(prog(key(zAt("ينتظر") - 0.1, 0.7)));
  const turn = ease(prog(key(zAt("الشعور") - 0.1, zAt(IDEA) - zAt("الشعور") + 0.2)));
  const rise = ease(prog(key(zAt(IDEA) - 0.05, 0.6)));
  // قطرات حتمية: كل ٠٫٢٢ ث قطرة تسقط ٠٫٤ ث، ما دام التقطير
  const drops: number[] = [];
  if (t > drip.a && t < drip.b) for (let k = 0; k < 4; k++) { const ph = ((t - drip.a) / 0.22 - k) % 2; if (ph >= 0 && ph < 1.8) drops.push(Math.min(1, ph / 1.8)); }
  const cam = camAt(t, START, [
    { a: zAt("ينتظر") - 0.2, b: zAt("الشعور"), to: { ...START, yaw: -4, dist: 9 } },
    { a: zAt(IDEA) - 0.2, b: zAt(IDEA) + 0.9, to: { ...START, yaw: 8, dist: 7.6, target: [1.6, 2.2, 0] } },
  ], { still });
  const lever = -0.28 + tip * 0.5;
  return (
    <>
      <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, LIGHTS, still)} background={ZB.paper}>
        {/* الورقة: الأرض والخلفية */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[30, 20]} /><meshStandardMaterial color={ZB.paper} roughnessMap={paper} roughness={1} /></mesh>
        <mesh position={[0, 5, -2.2]} receiveShadow><planeGeometry args={[30, 12]} /><meshStandardMaterial color={ZB.paper} roughnessMap={paper} roughness={1} /></mesh>
        {/* الخزان والصنبور */}
        <mesh position={[-3.2, 3.6, 0]} castShadow><cylinderGeometry args={[0.55, 0.55, 1.1, 32]} />{INK}</mesh>
        <mesh position={[-2.6, 3.15, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.06, 0.06, 0.6, 12]} />{INK}</mesh>
        {drops.map((p, i) => <mesh key={i} position={[-2.3, 3.0 - p * 1.0, 0]}><sphereGeometry args={[0.05, 12, 8]} /><meshStandardMaterial color={ZB.grey} roughness={0.2} /></mesh>)}
        {/* الذراع على محوره، والكوب على طرفه */}
        <mesh position={[-1.4, 0.8, 0]} castShadow><boxGeometry args={[0.16, 1.6, 0.3]} />{INK}</mesh>
        <group position={[-1.4, 1.65, 0]} rotation={[0, 0, lever]}>
          <mesh castShadow><boxGeometry args={[2.4, 0.08, 0.2]} />{INK}</mesh>
          <group position={[-0.9, 0.32, 0]}>
            <mesh castShadow><cylinderGeometry args={[0.3, 0.24, 0.55, 24, 1, true]} /><meshStandardMaterial color={ZB.dark} side={THREE.DoubleSide} roughness={0.5} /></mesh>
            <mesh position={[0, -0.27 + fill * 0.45, 0]}><cylinderGeometry args={[0.24 + fill * 0.05, 0.24, 0.02 + fill * 0.0, 24]} /><meshStandardMaterial color={ZB.grey} roughness={0.15} /></mesh>
          </group>
        </group>
        {/* ذراع التوصيل: من طرف الذراع إلى مسمار في الترس الأول، فالآلة قطعة واحدة */}
        {(() => {
          const tip: [number, number] = [-1.4 + 1.2 * Math.cos(lever), 1.65 + 1.2 * Math.sin(lever)];
          const pin: [number, number] = [0.6 + 0.4 * Math.cos(Math.PI + turn * Math.PI * 1.2), 1.5 + 0.4 * Math.sin(Math.PI + turn * Math.PI * 1.2)];
          const dx = pin[0] - tip[0], dy = pin[1] - tip[1];
          return <mesh position={[(tip[0] + pin[0]) / 2, (tip[1] + pin[1]) / 2, 0.14]} rotation={[0, 0, Math.atan2(dy, dx)]} castShadow><boxGeometry args={[Math.hypot(dx, dy), 0.06, 0.06]} />{INK}</mesh>;
        })()}
        {/* الترسان */}
        <Gear r={0.6} teeth={12} pos={[0.6, 1.5, -0.1]} angle={turn * Math.PI * 1.2} />
        <Gear r={0.42} teeth={8} pos={[1.75, 2.05, -0.1]} angle={-turn * Math.PI * 1.2 * (0.6 / 0.42) + 0.2} />
        {/* بطاقة الفكرة ترتفع */}
        {(() => {
          // البطاقة مقلوبة (ظهرها أسود) خلف الترس، ثم ترتفع وتنقلب فتظهر الفكرة عند «الحضور»
          const y = 1.0 + rise * 1.5;
          return (<>
            <mesh position={[2.9, y / 2, 0.05]} castShadow><boxGeometry args={[0.06, y, 0.06]} />{INK}</mesh>
            <group position={[2.9, y + 0.4, 0.12]} rotation={[0, Math.PI * (1 - rise), 0]}>
              <mesh castShadow><boxGeometry args={[1.6, 0.8, 0.04]} />{INK}</mesh>
              <mesh position={[0, 0, 0.021]}><planeGeometry args={[1.56, 0.76]} /><meshBasicMaterial map={card} toneMapped={false} /></mesh>
            </group>
          </>);
        })()}
      </Stage3D>
      <ZFrame t={t} name="الأفكار آلات" />
    </>
  );
};
