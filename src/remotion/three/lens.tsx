/**
 * عدّة الثري دي — العدسة والهواء (معايير «الحِرفة»، D189):
 * - عمق ميدان حقيقي: تمويه العدسة لما خارج مسافة التركيز (BokehPass من three). هو وحده المسموح من «ما بعد المعالجة»؛
 *   التوهج والإشعاع ولمعة العدسة ممنوعة كما كانت (قرار «لا قوالب افتراضية»).
 * - غبار خفيف في شعاع الشمس: ذرات قليلة داخل حجم الشعاع وحده، تنجرف ببطء حتمي، وتسكن في السكون المقصود.
 *   ليس «جسيمات» زخرفية: يُرى حيث يمر ضوء النافذة فقط، كما في غرفة حقيقية.
 */
import React, { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { calmAt, type Window } from "./time";
import { noise1 } from "./imperfection";

/** تمويه العدسة: focus مسافة التركيز من الكاميرا (وحدات المشهد)، وaperture فتحتها (أكبر = عمق أضيق) */
export const DepthOfField: React.FC<{ focus: number; aperture: number; maxblur?: number }> = ({ focus, aperture, maxblur = 0.012 }) => {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new BokehPass(scene, camera, { focus, aperture, maxblur }));
    c.addPass(new OutputPass());
    return c;
  }, [gl, scene, camera]); // eslint-disable-line react-hooks/exhaustive-deps
  useMemo(() => composer.setSize(size.width, size.height), [composer, size.width, size.height]);
  const bokeh = composer.passes[1] as BokehPass;
  const u = bokeh.uniforms as Record<string, { value: number }>;
  u.focus!.value = focus; u.aperture!.value = aperture; u.maxblur!.value = maxblur;
  // أولوية أعلى من الصفر: r3f لا يرسم بنفسه، والمركّب يرسم الإطار مرة واحدة
  useFrame(() => composer.render(), 1);
  return null;
};

/** ذرات غبار في حجم الشعاع (صندوق مائل من النافذة إلى المكتب)؛ ثابتة الموضع لكل بذرة، تنجرف مع t */
export const BeamDust: React.FC<{ t: number; count?: number; from: [number, number, number]; to: [number, number, number]; radius: number; color: string; still?: Window[]; seed?: number }> =
  ({ t, count = 90, from, to, radius, color, still = [], seed = 5 }) => {
    const base = useMemo(() => Array.from({ length: count }, (_, i) => ({
      k: (noise1(seed, i * 1.7) + 1) / 2, a: noise1(seed + 1, i * 2.3) * Math.PI, r: Math.abs(noise1(seed + 2, i * 3.1)) * radius, s: 0.0025 + Math.abs(noise1(seed + 3, i)) * 0.004,
    })), [count, radius, seed]);
    // الانجراف يتوقف في السكون المقصود (يُحسب بزمن «فعّال» لا يتقدم داخل النافذة)
    const drift = (t2: number) => { let d = 0; for (let x = 0; x < t2; x += 0.1) d += 0.1 * calmAt(x, still, 0.2); return d; };
    const dt = drift(t);
    const geo = useMemo(() => new THREE.SphereGeometry(1, 6, 4), []);
    const dir = new THREE.Vector3(...to).sub(new THREE.Vector3(...from));
    const side = new THREE.Vector3(0, 1, 0).cross(dir).normalize(), up = dir.clone().cross(side).normalize();
    return (
      <group>
        {base.map((p, i) => {
          const k = (p.k + dt * 0.012) % 1, a = p.a + dt * 0.15;
          const pos = new THREE.Vector3(...from).addScaledVector(dir, k).addScaledVector(side, Math.cos(a) * p.r).addScaledVector(up, Math.sin(a) * p.r + noise1(seed + 9, i + dt * 0.3) * 0.04);
          return <mesh key={i} geometry={geo} position={pos} scale={p.s}><meshBasicMaterial color={color} transparent opacity={0.4} toneMapped={false} /></mesh>;
        })}
      </group>
    );
  };
