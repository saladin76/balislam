/**
 * مختبر عدّة الثري دي (لا يُنشر، وليس اتجاهًا بصريًا): أشكال طين رمادية محايدة على طاولة، لفحص العدّة وحدها —
 * كاميرا تتحرك بمفاتيح «كلمات» مفترضة، ونافذة سكون مقصود (٣–٤ ث) يتأخر فيها المفتاح ويسكن الاهتزاز والارتعاش،
 * وضوء عملي حي، وحبيبات الخامة. الألوان رمادية عمدًا: ألوان كل عالم من هوية قناته بعد اختيار المالك.
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Stage3D, useGrainTexture } from "./Stage3D";
import { camAt, lightsAt, type Cam, type CamKey, type Light } from "./rig";
import type { Window } from "./time";

export const KIT_LAB_FPS = 30;
export const KIT_LAB_SEC = 8;

export const KIT_LAB_STILL: Window[] = [[3, 4]];
const START: Cam = { target: [0, 0.4, 0], yaw: -25, pitch: 18, dist: 6, fov: 32 };
/** المفتاح الثاني يقع على نافذة السكون فيتأخر إلى ٤ ث */
export const KIT_LAB_KEYS: CamKey[] = [
  { a: 0.5, b: 2.5, to: { ...START, yaw: 10, dist: 5 } },
  { a: 3.2, b: 5.2, to: { ...START, yaw: 35, pitch: 10, dist: 4.2, target: [0.6, 0.4, 0] } },
];
const LIGHTS: Light[] = [
  { kind: "ambient", kelvin: 6500, intensity: 0.25, position: [0, 0, 0] },
  { kind: "key", kelvin: 4800, intensity: 2.2, position: [4, 6, 3] },
  { kind: "practical", kelvin: 2200, intensity: 9, position: [-1.6, 1.4, 1.2], flicker: { depth: 0.18, rate: 6, seed: 3 } },
];

export const KitLab: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const cam = camAt(t, START, KIT_LAB_KEYS, { still: KIT_LAB_STILL, shake: { amp: 0.03, rate: 0.8, seed: 11 } });
  const rough = useGrainTexture(5, 0.5);
  return (
    <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, LIGHTS, KIT_LAB_STILL)} background="#2a2a2a">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial color="#8a8a8a" roughnessMap={rough} roughness={1} />
      </mesh>
      <mesh position={[-0.8, 0.5, 0]} castShadow receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#b0b0b0" roughnessMap={rough} roughness={0.9} /></mesh>
      <mesh position={[0.9, 0.6, -0.4]} castShadow receiveShadow><cylinderGeometry args={[0.45, 0.5, 1.2, 32]} /><meshStandardMaterial color="#9c9c9c" metalness={0.6} roughness={0.45} /></mesh>
      <mesh position={[0.4, 0.3, 1]} castShadow receiveShadow><sphereGeometry args={[0.3, 32, 16]} /><meshStandardMaterial color="#c4c4c4" roughness={0.7} /></mesh>
    </Stage3D>
  );
};
