/**
 * اتجاه «هندسة النور» لـ«بالإسلام» (المراجع: لفافة طوب قابي، رسوم بناء الزخارف بالفرجار والمسطرة؛ وبلاط الحمراء؛
 * والتذهيب المملوكي): لوح جص يضيئه نور مائل من نافذة، وفرجار نحاسي يرسم الدائرة ثم تُبنى النجمة الثمانية خطًا خطًا
 * بماء الذهب مع الكلام، ويُملأ قلبها بالزمرد عند «معي». الزخرفة تكتمل قبل ذكر الله ولا تتحرك عنده (السكون المقصود).
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useBrandFonts } from "../../useBrandFonts";
import { Stage3D, camAt, ease, lightsAt, safeKeys, useAssetTextures, type Cam, type Light } from "../../three";
import { BAA, DIR_STILL, DirFrame, wordAt } from "./common";

const R = 1.6;
const START: Cam = { target: [0, 0, 0.35], yaw: 0, pitch: 58, dist: 8.4, fov: 32 };
const LIGHTS: Light[] = [
  { kind: "ambient", kelvin: 6000, intensity: 1.5, position: [0, 0, 0] },
  // نور نافذة مائل يكشف خشونة الجص
  { kind: "key", kelvin: 4300, intensity: 2.6, position: [-5, 3.2, 2.5] },
];

type Seg = { a: [number, number]; b: [number, number] };
/** النجمة الثمانية من مربعين متراكبين في الدائرة (البناء التقليدي) */
const starSegments = (): Seg[] => {
  const pt = (k: number): [number, number] => [R * Math.cos((k * Math.PI) / 4 + Math.PI / 8), R * Math.sin((k * Math.PI) / 4 + Math.PI / 8)];
  const out: Seg[] = [];
  // بترتيب القلم: من الرأس إلى الرأس الثالث بعده، فلا يُرفع القلم حتى تُغلق النجمة (٠←٣←٦←١…)
  for (let i = 0, k = 0; i < 8; i++, k = (k + 3) % 8) out.push({ a: pt(k), b: pt((k + 3) % 8) });
  return out;
};

/** شريط ذهبي مرسوم من a إلى b بنسبة p (خط بعرض على سطح اللوح) */
const Stroke: React.FC<{ s: Seg; p: number; w?: number; color?: string }> = ({ s, p, w = 0.035, color = BAA.gold }) => {
  if (p <= 0) return null;
  const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], len = Math.hypot(dx, dy) * p;
  return (
    <mesh position={[s.a[0] + (dx * p) / 2, 0.012, -(s.a[1] + (dy * p) / 2)]} rotation={[-Math.PI / 2, 0, Math.atan2(dy, dx)]} castShadow>
      <planeGeometry args={[len, w]} />
      <meshStandardMaterial color={color} metalness={0.25} roughness={0.38} emissive={color} emissiveIntensity={0.18} />
    </mesh>
  );
};

/** قوس الدائرة من ٠ إلى p (حلقة رفيعة) */
const Circle: React.FC<{ p: number }> = ({ p }) => p > 0 ? (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
    <ringGeometry args={[R - 0.012, R + 0.012, 128, 1, 0, Math.PI * 2 * p]} />
    <meshStandardMaterial color="#7A5A44" roughness={0.9} />
  </mesh>
) : null;

/** الفرجار: ساق ثابتة في المركز وساق تدور مع القوس، يرتفع ويختفي حين يكتمل */
const Compass: React.FC<{ angle: number; lift: number }> = ({ angle, lift }) => {
  const legLen = Math.hypot(R, 1.9);
  const tilt = Math.atan2(R, 1.9);
  return (
    <group position={[0, 1.9 + lift * 2.5, 0]} rotation={[0, angle, 0]}>
      <mesh position={[0, 0.1, 0]} castShadow><cylinderGeometry args={[0.09, 0.09, 0.22, 24]} /><meshStandardMaterial color={BAA.gold} metalness={0.6} roughness={0.3} /></mesh>
      <mesh position={[0, -0.95, 0]} castShadow><cylinderGeometry args={[0.025, 0.008, 1.9, 12]} /><meshStandardMaterial color="#8A6A55" metalness={0.8} roughness={0.35} /></mesh>
      <group rotation={[0, 0, tilt]}><mesh position={[0, -legLen / 2, 0]} castShadow><cylinderGeometry args={[0.025, 0.008, legLen, 12]} /><meshStandardMaterial color="#8A6A55" metalness={0.8} roughness={0.35} /></mesh></group>
    </group>
  );
};

export const LightGeometryLab: React.FC = () => {
  useBrandFonts();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const still = DIR_STILL;
  const plaster = useAssetTextures(["balislam-plaster-diff", "balislam-plaster-nor"], [3, 2]);
  // خطوط البناء كما في لفافة طوب قابي: شبكة الدوائر والأقطار بالرصاص، ونقاط حمراء عند التقاطعات — تملأ اللوح كله
  const guides = useMemo(() => {
    const W = 2048, H = 1366, c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d")!, u = W / 9; // ١ وحدة = ٢٢٧ بكسل (اللوح ٩×٦)
    g.strokeStyle = "rgba(122,90,68,0.38)"; g.lineWidth = 3; g.setLineDash([14, 10]);
    for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) {
      const x = W / 2 + i * 1.75 * u, y = H / 2 + j * 1.75 * u;
      g.beginPath(); g.arc(x, y, R * u, 0, Math.PI * 2); g.stroke();
      for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 4 + Math.PI / 8; g.beginPath(); g.moveTo(x - R * u * Math.cos(a), y - R * u * Math.sin(a)); g.lineTo(x + R * u * Math.cos(a), y + R * u * Math.sin(a)); g.stroke(); }
    }
    g.setLineDash([]); g.fillStyle = "#C2566B";
    for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) { g.beginPath(); g.arc(W / 2 + i * 1.75 * u, H / 2 + j * 1.75 * u, 9, 0, Math.PI * 2); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  const segs = useMemo(starSegments, []);
  const key = (a: number, d: number) => safeKeys([{ a, b: a + d, to: 1 }], still)[0]!;
  const prog = (k: { a: number; b: number }) => Math.min(1, Math.max(0, (t - k.a) / (k.b - k.a)));
  // «وقف رجلان»: الفرجار يرسم الدائرة؛ «في السوق»: يرتفع؛ «يقول: الحق معي»: الخطوط الثمانية؛ «معي»: الزمرد في القلب
  const circle = prog(key(wordAt("وقف") - 0.1, 1.4));
  const lift = ease(prog(key(wordAt("السوق") - 0.1, 0.8)));
  const lines = key(wordAt("كلٌّ") - 0.1, wordAt("معي") - wordAt("كلٌّ") + 0.1);
  const inlay = ease(prog(key(wordAt("معي"), 0.6)));
  const cam = camAt(t, START, [
    { a: wordAt("السوق") - 0.1, b: wordAt("يقول"), to: { ...START, pitch: 66, dist: 7.6, yaw: 6 } },
    { a: wordAt("الحقُّ") - 0.2, b: wordAt("معي") + 0.6, to: { ...START, pitch: 72, dist: 7.0, yaw: 10 } },
  ], { still });
  const inner = useMemo(() => {
    // المثمن الذي تحيط به خطوط النجمة {٨/٣}: عامده R·جتا(٣π/٨)، فرؤوسه على R·جتا(٣π/٨)/جتا(π/٨)
    const s = new THREE.Shape(), r = (R * Math.cos((3 * Math.PI) / 8)) / Math.cos(Math.PI / 8);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + Math.PI / 8 + Math.PI / 8 + (3 * Math.PI) / 8;
      k ? s.lineTo(r * Math.cos(a), r * Math.sin(a)) : s.moveTo(r * Math.cos(a), r * Math.sin(a));
    }
    return s;
  }, []);
  if (!plaster) return null;
  return (
    <>
      <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, LIGHTS, still)} background={BAA.night}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[9, 6]} />
          <meshStandardMaterial normalMap={plaster[1]} normalScale={new THREE.Vector2(1.4, 1.4)} color={BAA.paper} roughness={1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}><planeGeometry args={[9, 6]} /><meshStandardMaterial map={guides} transparent roughness={1} depthWrite={false} /></mesh>
        <Circle p={circle} />
        {segs.map((s, i) => {
          const d = (lines.b - lines.a) / segs.length;
          return <Stroke key={i} s={s} p={ease(prog({ a: lines.a + i * d, b: lines.a + i * d + d * 1.4 }))} />;
        })}
        {inlay > 0 && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
            <shapeGeometry args={[inner, 1]} />
            <meshStandardMaterial color={BAA.emerald} roughness={0.55} transparent opacity={inlay} />
          </mesh>
        )}
        {lift < 1 && <Compass angle={circle * Math.PI * 2} lift={lift} />}
      </Stage3D>
      <DirFrame t={t} name="هندسة النور" tone="dark" />
    </>
  );
};
