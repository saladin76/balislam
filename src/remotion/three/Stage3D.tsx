/**
 * عدّة الثري دي — المسرح: لوحة Three داخل Remotion بكاميرا وأضواء محسوبة من الإطار (camAt وlightsAt).
 * المكوّن «أبكم» كـ Globe3D: لا زمن فيه، والمشهد يمرر حال الكاميرا والأضواء، فالرندر حتمي.
 * لا توهج ولا جسيمات ولا لمعة عدسة ولا ما بعد المعالجة (قرار المالك «لا قوالب افتراضية»): الصورة من الخامة والضوء والظل.
 * الظل: المفتاح والضوء العملي يُلقيانه، والجسم يلقيه ويستقبله بـ castShadow وreceiveShadow في العالم نفسه.
 */
import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CamState, LitLight } from "./rig";
import { grain } from "./imperfection";

const CameraSync: React.FC<{ cam: CamState }> = ({ cam }) => {
  const { camera } = useThree();
  const c = camera as THREE.PerspectiveCamera;
  c.position.set(...cam.position);
  c.up.set(0, 1, 0);
  c.lookAt(...cam.target);
  if (c.fov !== cam.fov) { c.fov = cam.fov; c.updateProjectionMatrix(); }
  c.updateMatrixWorld();
  return null;
};

const LightOf: React.FC<{ l: LitLight }> = ({ l }) =>
  l.kind === "ambient" ? <ambientLight color={l.color} intensity={l.intensity} />
  : l.kind === "practical" ? <pointLight color={l.color} intensity={l.intensity} position={l.position} decay={2} distance={0} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.03} shadow-camera-near={0.1} />
  // المفتاح وحده يُلقي ظلًا حادًا؛ الملء والخلفي بلا ظل (ظلّان من كل جهة يفضحان المسرح)
  : <directionalLight color={l.color} intensity={l.intensity} position={l.position} castShadow={l.kind === "key"}
      shadow-mapSize={[4096, 4096]} shadow-bias={-0.0002} shadow-normalBias={0.02} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />;

export type Stage3DProps = { width: number; height: number; cam: CamState; lights: LitLight[]; background: string; children?: React.ReactNode };

export const Stage3D: React.FC<Stage3DProps> = ({ width, height, cam, lights, background, children }) => (
  <ThreeCanvas shadows="soft" width={width} height={height} camera={{ fov: cam.fov, near: 0.01, far: 200 }} gl={{ antialias: true }} style={{ background }}>
    <CameraSync cam={cam} />
    {lights.map((l, i) => <LightOf key={i} l={l} />)}
    {children}
  </ThreeCanvas>
);

/** خامة حبيبات رمادية تتكرر على السطح (خريطة خشونة أو لون)، محسوبة مرة لكل بذرة */
export const useGrainTexture = (seed: number, strength: number, repeat = 4, size = 256) =>
  useMemo(() => {
    const g = grain(size, seed, strength);
    const rgba = new Uint8Array(size * size * 4);
    for (let i = 0; i < g.length; i++) rgba.set([g[i]!, g[i]!, g[i]!, 255], i * 4);
    const t = new THREE.DataTexture(rgba, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.needsUpdate = true;
    return t;
  }, [seed, strength, repeat, size]);
