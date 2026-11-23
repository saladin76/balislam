/**
 * الطريقة ٥ — ثري دي بالأداة الحالية بأفضل ما يمكن، بلا تكلفة:
 * - تضاريس حقيقية: وادي رم (الأردن) من بيانات الارتفاع العامة (SRTM، ناسا/هيئة المساحة الأمريكية، ملك عام؛ عبر AWS Terrain Tiles)، تبدأ
 *   خلف سهل رملي قريب.
 * - إضاءة HDRI للفجر من Poly Haven (Qwantani Dawn Pure Sky، CC0): سماء الخلفية وانعكاسات المواد منها.
 * - صخور ممسوحة ضوئيًا من Poly Haven (Namaqualand Boulder 02/03/05 وRock 07، CC0) حلقةً هي أطلال «مدينة قديمة»، تغوص في الرمل عند
 *   «نسي الناس اسمها»؛ ثم عند «بل تبدأ» ترتفع الكاميرا فوق السهل نحو الجبال والشروق، وحفنة الطين من عالم «البدايات» في المقدمة.
 * - السكون: الصورة تتجمد قبل جملة الذكر ولا يتحرك فيها شيء. لا تصوير لأحد.
 */
import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, getInputProps, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useBrandFonts } from "../../useBrandFonts";
import { useAssetTextures } from "../../three";
import { ClayMaterial, useClayHandful } from "../bidayat/StoneLines";
import { useBidTextures } from "../bidayat/earth";
import { LtAudio, LtCaption, LT_FPS, at, pr, vt } from "./common";

const A = (p: string) => staticFile(`three/dafatir-alzaman/looktest/${p}`);
const MODELS = ["namaqualand_boulder_02", "namaqualand_boulder_03", "namaqualand_boulder_05", "rock_07"];
/** دوران السماء حول المحور الرأسي بحيث تكون الشمس أمام الكاميرا (يُضبط بالنظر) */
const SKY_YAW = Number((getInputProps() as { yaw?: number }).yaw ?? 1.846);

type Loaded = { hdr: THREE.DataTexture; models: THREE.Object3D[]; terrain: { w: number; h: number; data: Float32Array } };

const useLoaded = () => {
  const [handle] = useState(() => delayRender("أصول الطريقة الخامسة"));
  const [res, setRes] = useState<Loaded | null>(null);
  useEffect(() => {
    (async () => {
      const hdr = await new RGBELoader().loadAsync(A(`${(getInputProps() as { sky?: string }).sky ?? "sunrise"}.hdr`));
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      const gl = new GLTFLoader();
      const models = await Promise.all(MODELS.map(async (m) => (await gl.loadAsync(A(`models/${m}/${m}.gltf`))).scene));
      const img = new Image();
      img.src = A("terrain/rum.png");
      await img.decode();
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, c.width, c.height).data;
      const data = new Float32Array(c.width * c.height);
      for (let i = 0; i < data.length; i++) data[i] = px[i * 4]! * 256 + px[i * 4 + 1]! + px[i * 4 + 2]! / 256 - 32768;
      setRes({ hdr, models, terrain: { w: c.width, h: c.height, data } });
      continueRender(handle);
    })().catch((e) => { console.error(e); continueRender(handle); });
  }, [handle]);
  return res;
};

/** الأرض: سهل رملي مستوٍ قريب، والتضاريس الحقيقية ترتفع بعد ٦٠ وحدة (الوحدة نحو ٢٠ مترًا في الجبال) */
const useTerrain = (t: Loaded["terrain"] | undefined) => useMemo(() => {
  if (!t) return null;
  const SIZE = 1600, SEG = 320;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  let min = Infinity;
  for (const v of t.data) min = Math.min(min, v);
  const pos = geo.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const u = (x / SIZE + 0.5) * (t.w - 1), v = (z / SIZE + 0.5) * (t.h - 1);
    const x0 = Math.floor(u), z0 = Math.floor(v), fx = u - x0, fz = v - z0;
    const s = (a: number, b: number) => t.data[Math.min(t.h - 1, b) * t.w + Math.min(t.w - 1, a)]!;
    const hm = (s(x0, z0) * (1 - fx) + s(x0 + 1, z0) * fx) * (1 - fz) + (s(x0, z0 + 1) * (1 - fx) + s(x0 + 1, z0 + 1) * fx) * fz;
    const d = Math.hypot(x, z + 40);
    const k = Math.min(1, Math.max(0, (d - 60) / 220));
    const kk = k * k * (3 - 2 * k);
    pos.setY(i, ((hm - min) / 20) * 0.95 * kk - 0.02);
  }
  geo.computeVertexNormals();
  return geo;
}, [t]);

const SceneSync: React.FC<{ hdr: THREE.Texture; cam: { p: THREE.Vector3; l: THREE.Vector3; fov: number } }> = ({ hdr, cam }) => {
  const { scene, camera, gl } = useThree();
  useMemo(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.62;
    scene.background = hdr;
    scene.environment = hdr;
    scene.backgroundRotation = new THREE.Euler(0, SKY_YAW, 0);
    scene.environmentRotation = new THREE.Euler(0, SKY_YAW, 0);
    scene.fog = new THREE.FogExp2("#D9A77E", 0.0006);
  }, [scene, hdr, gl]);
  const c = camera as THREE.PerspectiveCamera;
  c.position.copy(cam.p); c.lookAt(cam.l);
  if (c.fov !== cam.fov) { c.fov = cam.fov; c.updateProjectionMatrix(); }
  c.far = 3000; c.updateProjectionMatrix();
  return null;
};

/** أطلال المدينة: أساسات جدران من حجارة ممسوحة صغيرة على محيط ثلاث غرف (كما تبدو المدن القديمة في الحفريات) */
const RING = (() => {
  const rooms: [number, number, number, number][] = [[-3.2, -8.5, 3.0, 2.4], [0.4, -9.2, 2.6, 3.2], [-1.4, -5.2, 3.6, 1.8]];
  const out: { x: number; z: number; m: number; s: number; rot: number }[] = [];
  let k = 0;
  for (const [x0, z0, w, d] of rooms) {
    const per: [number, number][] = [];
    for (let i = 0; i <= Math.round(w / 0.3); i++) { per.push([x0 + (i * w) / Math.round(w / 0.3), z0]); per.push([x0 + (i * w) / Math.round(w / 0.3), z0 + d]); }
    for (let i = 1; i < Math.round(d / 0.3); i++) { per.push([x0, z0 + (i * d) / Math.round(d / 0.3)]); per.push([x0 + w, z0 + (i * d) / Math.round(d / 0.3)]); }
    for (const [x, z] of per) { k++; if (k % 9 === 4 || k % 13 === 7) continue; out.push({ x: x + 0.04 * Math.sin(k * 3.1), z: z + 0.04 * Math.cos(k * 2.3), m: k % 2, s: 0.2 + 0.05 * ((k * 5) % 4), rot: (k % 2) * Math.PI / 2 + 0.15 * Math.sin(k) }); }
  }
  return out;
})();

/** bare: بلا ترجمة ولا صوت (طبقة داخل «المزيج») */
export const M5ThreeD: React.FC<{ bare?: boolean }> = ({ bare }) => {
  useBrandFonts();
  const t = useCurrentFrame() / LT_FPS;
  const v = vt(t);
  const L = useLoaded();
  const terrain = useTerrain(L?.terrain);
  const clay = useClayHandful();
  const bid = useBidTextures();
  const sand = useAssetTextures(["dafatir-bid-sand-diff", "dafatir-bid-sand-nor", "dafatir-bid-sand-rough"], [260, 260]);
  const rocks = useMemo(() => (L ? RING.map((r) => { const m = L.models[r.m]!.clone(); m.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return m; }) : []), [L]);
  // الأطلال تغوص في الرمل عند «نسي الناس اسمها»
  const sink = pr(v, at("نسي"), 1.6);
  // الكاميرا: قريبة تدور ببطء حول الأطلال، ثم ترتفع وتتراجع نحو الجبال والشروق عند «بل تبدأ»
  const orbitP = pr(v, 0, at("بل"));
  const crane = pr(v, at("بل") - 0.1, 3.4);
  const ang = -0.5 + 0.55 * orbitP;
  const near = new THREE.Vector3(7.5 * Math.sin(ang), 2.4, -7 + 7.5 * Math.cos(ang));
  const far = new THREE.Vector3(0.8, 0.62, 2.4);
  const p = near.clone().lerp(far, crane);
  p.y += 2.2 * Math.sin(Math.PI * crane);
  const lookNear = new THREE.Vector3(-0.6, 0.2, -7), lookFar = new THREE.Vector3(0, 3, -400);
  const l = lookNear.clone().lerp(lookFar, crane);
  const cam = { p, l, fov: 38 + 6 * crane };
  const ready = Boolean(L && terrain && sand && bid);
  return (
    <AbsoluteFill style={{ background: "#2A1E3F" }}>
      {ready && L && (
        <ThreeCanvas width={1920} height={1080} shadows camera={{ fov: 38, near: 0.05, far: 3000 }} gl={{ antialias: true }}>
          <SceneSync hdr={L.hdr} cam={cam} />
          <directionalLight position={[100, 12, -282]} intensity={2.6} color="#FFC08A" castShadow shadow-mapSize={[4096, 4096]} shadow-bias={-0.0004} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-camera-far={600} />
          <mesh geometry={terrain!} receiveShadow>
            <meshStandardMaterial color="#E9C08C" map={sand![0]} normalMap={sand![1]} roughnessMap={sand![2]} roughness={1} envMapIntensity={0.6} />
          </mesh>
          {RING.map((r, i) => (
            <primitive key={i} object={rocks[i]!} position={[r.x, -0.05 - 1.4 * r.s * sink, r.z]} rotation={[0, r.rot, 0]} scale={r.s * (r.m === 3 ? 0.7 : 1)} />
          ))}
        </ThreeCanvas>
      )}
      {!bare && <LtCaption t={t} tone="light" />}
      {!bare && <LtAudio />}
    </AbsoluteFill>
  );
};
