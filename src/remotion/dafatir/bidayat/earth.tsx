/**
 * «البدايات» — بيئة العالم المشتركة (D203): السماء والشمس من الفجر إلى الضحى، والرمل الذهبي الفاتح، والرمل المبلول عند
 * الحافة، والماء بانعكاس وموج خفيف. يستعملها نموذج «خطوط على الأرض» (StoneLines.tsx) وقوالب السلسلة كلها (BidayatScene.tsx)
 * فلا عالمان مختلفان في الحلقة الواحدة.
 * الجولة ٤ (بعد مراجعة v3): الماء يرقّ نحو الشاطئ (شفافية كل رأس من عمق الماء فوق الرمل) فلا خط أزرق داكن حاد على الحافة،
 * ولونه أعمق من السماء (يُقرأ ماءً لا لوحًا ليلكيًا)، والمرآة تحته أعمق قليلًا فتختفي حافتها تحت الماء.
 */
import React, { useMemo } from "react";
import * as THREE from "three";
import { ease, useAssetTextures, type Light } from "../../three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { K, n2, type V3 } from "./common";

/** الأرض البكر: تنحدر نحو الماء ببطء مع تموج ثنائي البعد، فيرسم سطح الماء خط شاطئ غير مستقيم؛ الحلزون في ماء ضحل */
export const groundH = (x: number, z: number) => 0.05 + 0.022 * (z + 0.4) + 0.05 * n2(61, x * 0.45, z * 0.45) + 0.008 * n2(63, x * 3, z * 3);
/** ماء بانعكاس: مرآة مستوية (Reflector) تحت سطح شفاف بلون الماء ونسيج موج يتحرك بالزمن الفعّال */
export const useWaterNormals = () => useMemo(() => {
  const S = 256, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d")!, img = g.createImageData(S, S);
  const h = (x: number, y: number) => 0.6 * Math.sin((x / S) * Math.PI * 2 * 3 + 2 * Math.sin((y / S) * Math.PI * 2)) + 0.4 * Math.sin((y / S) * Math.PI * 2 * 5 + 1.3 * Math.sin((x / S) * Math.PI * 2 * 2));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1);
    const n = new THREE.Vector3(-dx * 0.6, -dy * 0.6, 1).normalize(), i = (y * S + x) * 4;
    img.data[i] = (n.x * 0.5 + 0.5) * 255; img.data[i + 1] = (n.y * 0.5 + 0.5) * 255; img.data[i + 2] = (n.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 7); return t;
}, []);
export const Mirror: React.FC<{ y: number; width: number; height: number }> = ({ y, width, height }) => {
  const m = useMemo(() => {
    const r = new Reflector(new THREE.PlaneGeometry(90, 44), { textureWidth: Math.round(width / 2), textureHeight: Math.round(height / 2), color: new THREE.Color(K.mist), clipBias: 0.003 });
    r.rotation.x = -Math.PI / 2; return r;
  }, [width, height]);
  m.position.set(0, y - 0.004, -10);
  return <primitive object={m} />;
};


export const mixC = (a: string, b: string, q: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), q).getHexString()}`;
/** اتجاه الشمس عند تقدّم sp (٠ فجر، ١ ضحى): ترتفع وتنتقل من خلف الماء إلى يمينه */
export const sunDirAt = (sp: number): V3 => {
  const elev = -0.02 + 0.6 * ease(sp), az = 0.35 - 0.55 * sp;
  return [Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev)];
};
/** أعمق ما يصير عنده الماء معتمًا تمامًا (متر): ما دونه يرقّ نحو الشاطئ */
export const SHORE_FADE = 0.06;
/** شفافية الماء فوق نقطة: صفر على خط الشاطئ، وتكتمل بعمق SHORE_FADE */
export const waterAlpha = (level: number, x: number, z: number, max = 0.88) => {
  const d = (level - groundH(x, z)) / SHORE_FADE;
  return max * Math.min(1, Math.max(0, d)) ** 0.7;
};
/** خامات العالم كلها (Poly Haven CC0)؛ null حتى تكتمل، فلا يُرسم إطار بمادة ناقصة */
export const useBidTextures = () => {
  const stone1 = useAssetTextures(["dafatir-bid-stone-diff", "dafatir-bid-stone-nor", "dafatir-bid-stone-rough"], [0.22, 0.22]);
  const stone2 = useAssetTextures(["dafatir-bid-stone2-diff", "dafatir-bid-stone2-nor", "dafatir-bid-stone2-rough"], [0.3, 0.3]);
  const stone3 = useAssetTextures(["dafatir-bid-stone3-diff", "dafatir-bid-stone3-nor", "dafatir-bid-stone3-rough"], [0.3, 0.3]);
  const clay = useAssetTextures(["dafatir-bid-clay-diff", "dafatir-bid-clay-nor", "dafatir-bid-clay-rough"], [4, 2]);
  const sand = useAssetTextures(["dafatir-bid-sand-diff", "dafatir-bid-sand-nor", "dafatir-bid-sand-rough"], [28, 18]);
  const wet = useAssetTextures(["dafatir-bid-wetsand-diff", "dafatir-bid-wetsand-nor", "dafatir-bid-wetsand-rough"], [32, 20]);
  const strata = useAssetTextures(["dafatir-bid-strata-diff", "dafatir-bid-strata-nor", "dafatir-bid-strata-rough"], [8, 0.35]);
  if (!stone1 || !stone2 || !stone3 || !clay || !sand || !wet || !strata) return null;
  return { stone: [stone1, stone2, stone3], clay, sand, wet, strata };
};
export type BidTextures = NonNullable<ReturnType<typeof useBidTextures>>;

/** أضواء العالم: الشمس المائلة تدفأ ثم تبيضّ، وسماء باردة، ومصباح عمل تحت الرمل (عدده ثابت في كل اللقطات) */
export const bidLights = (sp: number, under = false, lamp: V3 = [-1.2, -0.4, 6.2], fill: V3 = [-1.9, -0.8, 10.6]): Light[] => {
  const sd = sunDirAt(sp);
  return [
    // الجولة ٤: الفجر أنور (كانت مشاهد أول الحلقة رمادية داكنة): سماء الفجر تملأ الظلال، والشمس المائلة أقوى قليلًا
    { kind: "ambient", kelvin: 7500, intensity: 0.85 + 0.25 * sp, position: [0, 0, 0] },
    { kind: "key", kelvin: 2200 + 3000 * sp, intensity: 1.7 + 2.0 * Math.max(0, sd[1]) + 0.4 * sp, position: [sd[0] * 16, Math.max(1.2, sd[1] * 16), sd[2] * 16] },
    { kind: "fill", kelvin: 8500, intensity: 0.55 + 0.1 * sp, position: [-4, 6, 8] },
    { kind: "practical", kelvin: 3400, intensity: under ? 4.8 : 0, position: lamp },
    { kind: "fill", kelvin: 6500, intensity: under ? 0.7 : 0, position: fill },
  ];
};

/** الماء: سطح مقسَّم شفافيته لكل رأس من عمقه فوق الرمل (يرقّ نحو الشاطئ)، ولونه أعمق من السماء، ونسيج موج بالزمن الفعّال */
const Water: React.FC<{ level: number; te: number; sp: number }> = ({ level, te, sp }) => {
  const nor = useWaterNormals();
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(90, 44, 360, 176);
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position!.count * 4), 4));
    return g;
  }, []);
  // الشفافية تُحسب مرة لكل مستوى ماء (مقرّبًا)، لا لكل إطار
  const lv = Math.round(level * 2000) / 2000;
  useMemo(() => {
    const pos = geo.attributes.position!, col = geo.attributes.color!;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = -pos.getY(i) - 10;
      // الماء الضحل أفتح (يُرى الرمل تحته) فلا خط أزرق داكن على الحافة
      const a = waterAlpha(lv, x, z), sh = 1 + 1.3 * (1 - a / 0.88);
      col.setXYZW(i, sh, sh, sh, a);
    }
    col.needsUpdate = true;
  }, [geo, lv]);
  nor.offset.set(te * 0.012, te * 0.007);
  // لون الماء: أزرق مخضرّ عميق في الفجر يفتح قليلًا في الضحى (أعمق دائمًا من السماء)
  const tint = mixC(mixC(K.water, K.deep, 0.35), mixC(K.water, K.paper, 0.12), sp);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, lv, -10]} receiveShadow>
      <meshStandardMaterial color={tint} vertexColors transparent roughness={0.12} metalness={0.1} normalMap={nor} normalScale={new THREE.Vector2(0.35, 0.35)} depthWrite={false} />
    </mesh>
  );
};

/**
 * البيئة: قبة السماء، وقرص الشمس بلا وهج، والرمل الجاف المطفأ بخامته الحقيقية مُعادًا إلى الذهبي الفاتح، والرمل المبلول
 * فوقه حتى خط الماء الحالي بقليل (يتبع الفيضان والموج)، ثم المرآة والماء.
 */
export const BidEarth: React.FC<{ tex: BidTextures; sp: number; level: number; te: number; width: number; height: number }> = ({ tex, sp, level, te, width, height }) => {
  const sunDir = sunDirAt(sp);
  const skyQ = Math.round(sp * 120) / 120;
  const sky = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 8; c.height = 512;
    const g = c.getContext("2d")!, gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, mixC(K.dusk, K.haze, skyQ)); gr.addColorStop(0.3, mixC(K.mist, K.pale, skyQ)); gr.addColorStop(0.46, mixC(K.light, K.paper, skyQ)); gr.addColorStop(0.5, mixC(K.sun, K.paper, skyQ)); gr.addColorStop(1, mixC(K.sun, K.paper, skyQ));
    g.fillStyle = gr; g.fillRect(0, 0, 8, 512);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  }, [skyQ]);
  const ground = useMemo(() => {
    const g = new THREE.PlaneGeometry(80, 52, 560, 360), pos = g.attributes.position!;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = -pos.getY(i); pos.setZ(i, groundH(x, z)); }
    g.computeVertexNormals(); return g;
  }, []);
  // رمل شاطئ ذهبي فاتح بخامته الحقيقية: لون الخامة يُعاد إلى الشحوب حول متوسطها (تبقى حبيباتها ونتوؤها)
  const sandMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.97, side: THREE.DoubleSide, map: tex.sand[0]!, normalMap: tex.sand[1]! });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uPale = { value: new THREE.Color(K.light).lerp(new THREE.Color(K.pale), 0.3) };
      sh.uniforms.uMean = { value: new THREE.Color(0x83725d) };
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uPale;\nuniform vec3 uMean;")
        .replace("#include <map_fragment>", "#ifdef USE_MAP\nvec4 sd = texture2D( map, vMapUv );\ndiffuseColor.rgb *= uPale * mix( vec3( 1.0 ), sd.rgb / uMean, 0.55 );\n#endif");
    };
    return m;
  }, [tex]);
  const wetUniform = useMemo(() => ({ value: 0 }), []);
  wetUniform.value = level;
  const wetMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, map: tex.wet[0]!, normalMap: tex.wet[1]!, roughnessMap: tex.wet[2]! });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uLevel = wetUniform;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vWY;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vWY;\nuniform float uLevel;").replace("#include <alphamap_fragment>", "#include <alphamap_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(uLevel + 0.006, uLevel + 0.055, vWY);");
    };
    return m;
  }, [wetUniform, tex]);
  return (
    <>
      <mesh><sphereGeometry args={[90, 48, 24]} /><meshBasicMaterial map={sky} side={THREE.BackSide} toneMapped={false} depthWrite={false} /></mesh>
      <mesh position={[sunDir[0] * 29 / Math.max(0.2, -sunDir[2]), 9 * Math.max(0, sunDir[1]), -29]}><circleGeometry args={[1.0, 48]} /><meshBasicMaterial color={mixC(K.sun, K.paper, sp)} toneMapped={false} /></mesh>
      <mesh geometry={ground} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><primitive object={sandMat} attach="material" /></mesh>
      <mesh geometry={ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0015, 0]} material={wetMat} receiveShadow />
      {/* المرآة أعمق من سطح الماء: حافتها تحت ماء شبه معتم، فلا خط حاد على الشاطئ */}
      <Mirror y={level - 0.06} width={width} height={height} />
      <Water level={level} te={te} sp={sp} />
    </>
  );
};
