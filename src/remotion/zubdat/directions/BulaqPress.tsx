/**
 * اتجاه «مطبعة بولاق» لـ«زبدة الكتب» (المراجع: صفحات عناوين مطبعة بولاق من ١٨٢٠، وأغلفة الكتب العربية في الأربعينيات
 * والستينيات، وملمس طباعة الحروف المعدنية): مكبس حديدي فوق ورقة على سرير المطبعة؛ ينزل عند «يشعر» ويرتفع فيظهر
 * الحبر على الورق، ثم يُظلَّل «الحضور» بالفسفوري في سطره (الفكرة وحدها) ويُكتب في الهامش. أبيض وأسود.
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useBrandFonts } from "../../useBrandFonts";
import { Stage3D, camAt, ease, lightsAt, safeKeys, useGrainTexture, type Cam, type Light } from "../../three";
import { IDEA, PAGE_LINES, ZB, ZFrame, Z_STILL, usePageTexture, zAt } from "./common";

const START: Cam = { target: [0, 0.6, 0], yaw: -18, pitch: 30, dist: 8.6, fov: 32 };
const LIGHTS: Light[] = [
  { kind: "ambient", kelvin: 6500, intensity: 0.9, position: [0, 0, 0] },
  { kind: "key", kelvin: 5200, intensity: 2.4, position: [-4, 8, 4] },
];
const IRON = <meshStandardMaterial color={ZB.dark} roughness={0.45} metalness={0.6} />;

export const BulaqPressLab: React.FC = () => {
  const ready = useBrandFonts();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const still = Z_STILL;
  const wood = useGrainTexture(17, 0.4, 2);
  const key = (a: number, d: number) => safeKeys([{ a, b: a + d, to: 1 }], still)[0]!;
  const prog = (k: { a: number; b: number }) => Math.min(1, Math.max(0, (t - k.a) / (k.b - k.a)));
  // المكبس: ينزل ٠٫٤ ث عند «يشعر»، ويبقى لحظة، ثم يرتفع؛ والحبر يظهر حين يلمس الورق
  const down = ease(prog(key(zAt("يشعر") - 0.1, 0.4))), up = ease(prog(key(zAt("لأنّه") - 0.1, 0.6)));
  const press = down * (1 - up);
  const ink = down;
  // بعد الطبع تُسحب الورقة من تحت المكبس نحو القارئ
  const slide = ease(prog(key(zAt("ينتظر"), zAt(IDEA) - zAt("ينتظر") - 0.15)));
  const hi = ease(prog(key(zAt(IDEA) - 0.05, 0.5)));
  const page = usePageTexture(ready, { lines: PAGE_LINES, hi, ink, font: "Amiri" });
  const cam = camAt(t, START, [
    { a: zAt("ينتظر"), b: zAt(IDEA) - 0.1, to: { ...START, yaw: -4, pitch: 50, dist: 7.4, target: [0, 0, 2.4] } },
    { a: zAt(IDEA) - 0.1, b: zAt(IDEA) + 0.8, to: { ...START, yaw: 0, pitch: 66, dist: 5.0, target: [0.3, 0, 3.2] } },
  ], { still });
  return (
    <>
      <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, LIGHTS, still)} background={ZB.warm}>
        {/* سرير المطبعة الخشبي والورقة عليه */}
        <mesh position={[0, -0.15, 0]} receiveShadow castShadow><boxGeometry args={[5.2, 0.3, 4.2]} /><meshStandardMaterial color={ZB.grey} roughnessMap={wood} roughness={0.9} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006 + slide * 0.02, slide * 3.6]} receiveShadow><planeGeometry args={[2.6, 3.55]} /><meshStandardMaterial map={page} roughness={0.95} /></mesh>
        {/* الأرض */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow><planeGeometry args={[30, 30]} /><meshStandardMaterial color={ZB.warm} roughness={1} /></mesh>
        {/* إطار المكبس: عمودان وعارضة، والصفيحة تنزل بالبرغي */}
        {[-2.2, 2.2].map((x) => <mesh key={x} position={[x, 1.6, -0.2]} castShadow>{<boxGeometry args={[0.22, 3.5, 0.3]} />}{IRON}</mesh>)}
        <mesh position={[0, 3.35, -0.2]} castShadow><boxGeometry args={[4.65, 0.35, 0.4]} />{IRON}</mesh>
        <mesh position={[0, 2.55 - press * 1.4, -0.05]} castShadow><cylinderGeometry args={[0.09, 0.09, 1.6, 16]} />{IRON}</mesh>
        <mesh position={[0, 1.7 - press * 1.55, 0]} castShadow><boxGeometry args={[2.9, 0.18, 3.8]} />{IRON}</mesh>
      </Stage3D>
      <ZFrame t={t} name="مطبعة بولاق" />
    </>
  );
};
