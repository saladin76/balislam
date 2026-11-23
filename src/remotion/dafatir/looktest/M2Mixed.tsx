/**
 * الطريقة ٢ — مختلط: دفتر «خط الأفق» الـ2D كما هو (الصفحات والحبر والغسق) وقطعة ثري دي واحدة بسيطة:
 * ساعة رملية من خشب وزجاج (عنصر هوية «دفتر الأفق»: كعب الدفتر ساعة رملية) تصعد من الكعب عند «بل تبدأ»،
 * ويبدأ رملها يسيل عند «البشر» (بدء الزمن الإنساني). المدينة والمملكة حبر يبهت عند «نسي الناس اسمها».
 */
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useBrandFonts } from "../../useBrandFonts";
import { BookShadow, C, Camera, Defs, Dusk, Ink, LightPool, Page, PageStack, Spine } from "../horizon/kit";
import { LtAudio, LtCaption, LT_FPS, at, pr, vt } from "./common";

// المدينة القديمة على الصفحة اليسرى: أعمدة وبوابة معبد ومسلة وأسوار (حبر)
const CITY = [
  "M200 760 H900", // الأرض
  "M240 760 V610 H330 V760", "M262 610 V585 H308 V610", // برج
  "M360 760 V540 L395 520 L430 540 V760", // بوابة معبد (صرح)
  "M470 760 V470 L490 440 L510 470 V760", // مسلة
  "M540 760 V600 M570 760 V600 M600 760 V600 M630 760 V600 M525 600 H645 M520 590 H650", // أعمدة
  "M680 760 V640 H720 V620 H760 V640 H800 V760", "M820 760 V660 H880 V760", // أسوار
];
// المملكة على الصفحة اليمنى: سور بشرافات وبوابة مقوسة
const KINGDOM = [
  "M1040 760 H1700",
  "M1080 760 V560 H1110 V540 H1140 V560 H1170 V540 H1200 V560 H1230 V540 H1260 V560 H1290 V760",
  "M1290 760 V600 H1480 V760", "M1350 760 V680 C1350 630 1420 630 1420 680 V760",
  "M1480 760 V560 H1510 V540 H1540 V560 H1570 V540 H1600 V560 H1630 V540 H1660 V560 V760",
];

const HourglassSync: React.FC<{ y: number; rot: number }> = ({ y, rot }) => {
  const { camera, scene } = useThree();
  camera.position.set(0, 0.25, 6.2);
  camera.lookAt(0, 0, 0);
  const g = scene.getObjectByName("hg");
  if (g) { g.position.y = y; g.rotation.y = rot; }
  return null;
};

const Hourglass: React.FC<{ sand: number }> = ({ sand }) => {
  const glass = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 40; i++) {
      const y = -1 + (2 * i) / 40;
      const r = 0.07 + 0.58 * Math.pow(Math.abs(y), 0.9) * (1 - 0.25 * Math.pow(Math.abs(y), 6));
      pts.push(new THREE.Vector2(r, y));
    }
    return new THREE.LatheGeometry(pts, 64);
  }, []);
  const top = 0.85 * (1 - sand), bot = 0.25 + 0.6 * sand;
  return (
    <group name="hg">
      <mesh geometry={glass}><meshPhysicalMaterial color="#FFF6E6" transmission={0.92} roughness={0.06} thickness={0.25} ior={1.45} transparent opacity={0.35} /></mesh>
      {/* الرمل: مخروط في الأعلى يتناقص وكومة في الأسفل تزيد وخيط بينهما */}
      {top > 0.02 && <mesh position={[0, 0.15 + top * 0.35, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.5 * Math.sqrt(top), top * 0.7, 48]} /><meshStandardMaterial color={C.sand} roughness={0.95} /></mesh>}
      <mesh position={[0, -1 + bot * 0.32, 0]}><coneGeometry args={[0.55 * Math.sqrt(bot), bot * 0.64, 48]} /><meshStandardMaterial color={C.sand} roughness={0.95} /></mesh>
      {sand > 0.005 && sand < 0.995 && <mesh position={[0, -0.45, 0]}><cylinderGeometry args={[0.012, 0.012, 0.95, 8]} /><meshStandardMaterial color={C.sand} /></mesh>}
      {/* الإطار: قرصان من الخشب وثلاثة أعمدة */}
      {[1.08, -1.08].map((y) => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[0.78, 0.78, 0.12, 64]} /><meshStandardMaterial color="#5A3A22" roughness={0.6} /></mesh>)}
      {[0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2 + 0.4; return <mesh key={i} position={[0.68 * Math.cos(a), 0, 0.68 * Math.sin(a)]}><cylinderGeometry args={[0.045, 0.045, 2.1, 16]} /><meshStandardMaterial color={C.gold} metalness={0.6} roughness={0.35} /></mesh>; })}
    </group>
  );
};

export const M2Mixed: React.FC = () => {
  useBrandFonts();
  const t = useCurrentFrame() / LT_FPS;
  const v = vt(t);
  const cityP = pr(v, at("مدينة") - 0.1, 1.3);
  const kingP = pr(v, at("مملكة") - 0.1, 1.1);
  const fade = 1 - 0.9 * pr(v, at("نسي"), 1.1);
  const rise = pr(v, at("بل") - 0.1, 1.5);
  const sand = 0.55 * pr(v, at("البشر"), 3.3);
  const cam = { cx: 960 + 0 * rise, cy: 520 - 20 * rise, s: 1 + 0.05 * pr(v, 0, 12) + 0.08 * rise };
  return (
    <AbsoluteFill>
      <Dusk warm={rise} />
      <Camera cx={cam.cx} cy={cam.cy} s={cam.s}>
        <svg width={1920} height={1080}>
          <Defs id="m2" />
          <BookShadow />
          <Page id="m2" side="l">{CITY.map((d, i) => <Ink key={i} d={d} p={Math.min(1, Math.max(0, cityP * 1.6 - i * 0.1))} w={5} opacity={fade} />)}</Page>
          <Page id="m2" side="r">{KINGDOM.map((d, i) => <Ink key={i} d={d} p={Math.min(1, Math.max(0, kingP * 1.5 - i * 0.12))} w={5} opacity={fade} />)}</Page>
          <PageStack />
          <Spine />
          <LightPool o={0.8} />
        </svg>
      </Camera>
      {rise > 0 && (
        <ThreeCanvas width={1920} height={1080} gl={{ alpha: true, antialias: true }} style={{ position: "absolute", inset: 0, background: "transparent" }} camera={{ fov: 30, near: 0.1, far: 50 }}>
          <HourglassSync y={-3.4 + 3.4 * rise} rot={0.6 * rise} />
          <ambientLight intensity={0.55} color="#FFE7C8" />
          <directionalLight position={[3, 4, 5]} intensity={2.2} color="#FFD9A0" />
          <directionalLight position={[-4, 1, -3]} intensity={0.8} color="#B08AD0" />
          <Hourglass sand={sand} />
        </ThreeCanvas>
      )}
      <LtCaption t={t} tone="light" bottom={6} />
      <LtAudio />
    </AbsoluteFill>
  );
};
