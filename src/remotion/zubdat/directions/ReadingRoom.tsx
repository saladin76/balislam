/**
 * اتجاه «غرفة القراءة» لـ«زبدة الكتب» (المراجع: ضوء المصباح على الورق، والكتابة البطيئة، وفواصل الكتب): كتاب مفتوح
 * تحت مصباح مكتب في غرفة معتمة، والكاميرا تقترب ببطء شديد، والقلم المميِّز يمر على «الحضور» وحدها بالفسفوري.
 * هادئ جدًا، يناسب النسخ الطويلة والتجميعات. عند ذكر الله يسكن كل شيء.
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useBrandFonts } from "../../useBrandFonts";
import { Stage3D, camAt, ease, lightsAt, safeKeys, useAssetTextures, type Cam, type Light } from "../../three";
import { IDEA, PAGE_LINES, ZB, ZFrame, Z_STILL, usePageTexture, zAt } from "./common";

const START: Cam = { target: [0.2, 0, 0], yaw: 12, pitch: 48, dist: 6.2, fov: 30 };
const LIGHTS: Light[] = [
  { kind: "ambient", kelvin: 6500, intensity: 0.12, position: [0, 0, 0] },
  // المصباح وحده يضيء الصفحة
  { kind: "practical", kelvin: 3000, intensity: 14, position: [-1.6, 2.4, -0.6] },
];

/** صفحة منحنية قليلًا عند الكعب، كما يستلقي الكتاب المفتوح */
const Page: React.FC<{ side: 1 | -1; map: THREE.Texture | null }> = ({ side, map }) => {
  const geo = React.useMemo(() => {
    const g = new THREE.PlaneGeometry(2, 2.8, 24, 1);
    const p = g.attributes.position!;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 1; p.setZ(i, 0.18 * Math.exp(-x * 2.2)); }
    g.computeVertexNormals();
    return g;
  }, []);
  // اليسرى: الشكل نفسه معكوسًا (فينحني نحو الكعب) والصورة معكوسة معه، فيُقرأ النص صحيحًا
  const tex = React.useMemo(() => {
    if (!map || side === 1) return map;
    const t = map.clone(); t.wrapS = THREE.RepeatWrapping; t.repeat.set(-1, 1); t.offset.set(1, 0); t.needsUpdate = true; return t;
  }, [map, side]);
  return (
    <mesh geometry={geo} position={[side * 1.02, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[side, 1, 1]} receiveShadow castShadow>
      <meshStandardMaterial color={tex ? "#ffffff" : ZB.warm} map={tex ?? undefined} roughness={0.95} side={THREE.DoubleSide} />
    </mesh>
  );
};

export const ReadingRoomLab: React.FC = () => {
  const ready = useBrandFonts();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const still = Z_STILL;
  const key = (a: number, d: number) => safeKeys([{ a, b: a + d, to: 1 }], still)[0]!;
  const hi = ease(Math.min(1, Math.max(0, (t - key(zAt(IDEA) - 0.05, 0.55).a) / 0.55)));
  const page = usePageTexture(ready, { lines: PAGE_LINES, hi, ruled: false });
  // الصفحة اليمنى من الكتاب نفسه (ما قبل الفكرة)، فلا تبقى بيضاء
  const before = usePageTexture(ready, { lines: ["الفصل الثالث", "", "يظن كثيرون أن الخشوع", "شعورٌ يهبط فجأة،", "فإن لم يهبط", "تركوا الصلاة لوقتها."], hi: 0, ruled: false });
  const wood = useAssetTextures(["zubdat-wood-diff", "zubdat-wood-nor"], [3, 2]);
  const cam = camAt(t, START, [{ a: 0.4, b: zAt(IDEA) + 0.6, to: { ...START, yaw: 4, pitch: 58, dist: 4.4, target: [0.9, 0, -0.2] } }], { still });
  // القلم المميِّز: يتحرك فوق السطر مع التظليل ثم يرتفع
  const lift = key(zAt(IDEA) + 0.5, 0.5);
  const reach = key(zAt(IDEA) - 0.5, 0.45);
  const near = ease(Math.min(1, Math.max(0, (t - reach.a) / (reach.b - reach.a))));
  const pen = ease(Math.min(1, Math.max(0, (t - lift.a) / (lift.b - lift.a))));
  if (!wood) return null;
  return (
    <>
      <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, LIGHTS, still)} background={ZB.ink}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow><planeGeometry args={[20, 14]} /><meshStandardMaterial map={wood[0]} normalMap={wood[1]} color={ZB.line} roughness={0.6} /></mesh>
        <mesh position={[0, -0.01, 0]} receiveShadow><boxGeometry args={[4.3, 0.04, 3.0]} /><meshStandardMaterial color={ZB.ink} roughness={0.6} /></mesh>
        <Page side={-1} map={before} />
        <Page side={1} map={page} />
        {/* المصباح: قاعدة وذراع وقبعة */}
        <mesh position={[-2.6, 0.06, -1.1]} castShadow><cylinderGeometry args={[0.35, 0.4, 0.12, 32]} /><meshStandardMaterial color={ZB.dark} metalness={0.5} roughness={0.4} /></mesh>
        <mesh position={[-2.3, 1.3, -1.0]} rotation={[0, 0, -0.35]} castShadow><cylinderGeometry args={[0.04, 0.04, 2.6, 12]} /><meshStandardMaterial color={ZB.dark} metalness={0.5} roughness={0.4} /></mesh>
        <mesh position={[-1.75, 2.55, -0.75]} rotation={[0.3, 0, 0.9]}><coneGeometry args={[0.42, 0.55, 32, 1, true]} /><meshStandardMaterial color={ZB.dark} side={THREE.DoubleSide} metalness={0.4} roughness={0.5} /></mesh>
        {/* القلم المميِّز */}
        {/* يستريح في الهامش خارج النص، ويقترب من سطر الفكرة قبلها بقليل */}
        <group position={[2.35 + (1.35 - hi * 0.35 - 2.35) * near, 0.12 + pen * 0.5 + (1 - near) * 0.25, -0.3 + (-0.62 + 0.3) * near]} rotation={[0, 0.5, 0.6]}>
          <mesh castShadow><cylinderGeometry args={[0.07, 0.07, 0.9, 16]} /><meshStandardMaterial color={ZB.ink} roughness={0.5} /></mesh>
          <mesh position={[0, -0.5, 0]}><cylinderGeometry args={[0.03, 0.07, 0.12, 16]} /><meshBasicMaterial color={ZB.fluo} toneMapped={false} /></mesh>
        </group>
      </Stage3D>
      <ZFrame t={t} name="غرفة القراءة" tone="light" />
    </>
  );
};
