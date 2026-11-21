/**
 * الكرة الأرضية ثلاثية الأبعاد (أداة مشتركة، قرار المالك ٢١ نوفمبر): كرة بسيطة low-poly، ويابسة وبحر وخطوط عرض
 * وطول على خامة مسطحة، وسواحل وحدود وطرق وأنهار خطوطًا عريضة حادة بأي تكبير، ومدن أقراصًا على سطحها.
 *
 * المكوّن «أبكم»: لا زمن فيه. المشهد يحسب كل شيء من الإطار (الكاميرا، نسبة رسم الخط، السنة)
 * ويمرره، فالرندر حتمي ويتبع كلمات الراوي كباقي القوالب. الألوان من «مظهر» القناة (GlobeLook)،
 * فلا تنتقل هوية قناة إلى أخرى: لكل قناة مظهرها في مجلدها.
 * البيانات: Natural Earth (ملكية عامة) عبر world-atlas.
 */
import React, { useMemo, useRef } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { geoArea, geoEquirectangular, geoGraticule10, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import land110 from "world-atlas/land-110m.json";
import { camPosition, type GlobeCam } from "./globeCamera";
import { partialLine, slerpV, toV3, type LonLat } from "./globeSphere";

export type GlobeLook = {
  sea: string;
  land: string;
  grid: string;
  coast: string;
  border: string;
  borderFill: string;
  route: string;
  river: string;
  city: string;
  /** شدة الظل على الوجه البعيد عن الضوء (0 بلا ظل) */
  shade: number;
};

export type GlobeLine = { pts: LonLat[]; p?: number };
export type GlobeBorder = { ring: LonLat[]; draw: number; fill: number };
export type GlobeCity = { at: LonLat; size: number; pulse: number; o: number };

export type Globe3DProps = {
  width: number;
  height: number;
  cam: GlobeCam;
  look: GlobeLook;
  borders?: GlobeBorder[];
  routes?: GlobeLine[];
  rivers?: GlobeLine[];
  cities?: GlobeCity[];
  /** عرض الخطوط بالبكسل عند 1920 (يتضاعف مع 4K) */
  lineWidth?: number;
};

import { GLOBE_FOV } from "./globeCamera";
export { GLOBE_FOV };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const topo = land110 as any;
const LAND = feature(topo, topo.objects.land) as unknown as GeoJSON.FeatureCollection;
const COAST = mesh(topo, topo.objects.land) as unknown as GeoJSON.MultiLineString;

/** إسقاط الخامة المسطحة على اصطلاح SphereGeometry: x من −180 إلى 180، وy من 90 إلى −90 */
const equirect = (w: number, h: number) => geoEquirectangular().scale(w / (2 * Math.PI)).translate([w / 2, h / 2]).precision(0.1);

/** حلقة d3 الكروية باتجاه عقارب الساعة (وإلا ملأت العالم كله إلا المنطقة) */
const polygonOf = (ring: LonLat[]): GeoJSON.Polygon => {
  const g: GeoJSON.Polygon = { type: "Polygon", coordinates: [ring] };
  return geoArea(g) > 2 * Math.PI ? { type: "Polygon", coordinates: [[...ring].reverse()] } : g;
};

const baseTexture = (look: GlobeLook) => {
  const w = 4096;
  const h = 2048;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = look.sea;
  ctx.fillRect(0, 0, w, h);
  const path = geoPath(equirect(w, h), ctx);
  ctx.beginPath();
  path(geoGraticule10());
  ctx.strokeStyle = look.grid;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  path(LAND);
  ctx.fillStyle = look.land;
  ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

/** خطوط على الكرة (أزواج نقاط) لـLineSegments2، فوق السطح قليلًا كي لا تتداخل معه */
const segmentsOf = (lines: LonLat[][], r: number): number[] => {
  const out: number[] = [];
  for (const l of lines)
    for (let i = 1; i < l.length; i++) {
      // الجزء الطويل يُقسَّم على الدائرة العظمى (كما يملأ d3 المنطقة) حتى لا يقطع الخط داخل الكرة
      const a = toV3(l[i - 1]!, r);
      const b = toV3(l[i]!, r);
      const steps = Math.max(1, Math.ceil((Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / r) / 0.035));
      let p = a;
      for (let k = 1; k <= steps; k++) {
        const q = slerpV(a, b, k / steps);
        out.push(...p, ...q);
        p = q;
      }
    }
  return out;
};

const Lines: React.FC<{ lines: LonLat[][]; color: string; width: number; r: number; opacity?: number }> = ({ lines, color, width, r, opacity = 1 }) => {
  const { size } = useThree();
  const key = useMemo(() => JSON.stringify(lines), [lines]);
  const obj = useMemo(() => {
    const geo = new LineSegmentsGeometry();
    const pos = segmentsOf(lines, r);
    geo.setPositions(pos.length ? pos : [0, 0, 0, 0, 0, 0]);
    const mat = new LineMaterial({ color: new THREE.Color(color), linewidth: width, transparent: opacity < 1, opacity, worldUnits: false });
    return new LineSegments2(geo, mat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, color, width, r, opacity]);
  obj.material.resolution.set(size.width, size.height);
  obj.visible = lines.some((l) => l.length > 1);
  return <primitive object={obj} />;
};

/** خامة المناطق (الحدود المملوءة)، تُعاد رسمها كلما تغيّر الحد */
const FillLayer: React.FC<{ borders: GlobeBorder[]; color: string }> = ({ borders, color }) => {
  const ref = useRef<{ cv: HTMLCanvasElement; tex: THREE.CanvasTexture } | null>(null);
  if (!ref.current) {
    const cv = document.createElement("canvas");
    cv.width = 2048;
    cv.height = 1024;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    ref.current = { cv, tex };
  }
  const { cv, tex } = ref.current;
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, cv.width, cv.height);
  const path = geoPath(equirect(cv.width, cv.height), ctx);
  for (const b of borders) {
    if (b.fill <= 0 || b.ring.length < 4) continue;
    ctx.beginPath();
    path(polygonOf(b.ring));
    ctx.globalAlpha = b.fill;
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  tex.needsUpdate = true;
  return (
    <mesh renderOrder={1}>
      <sphereGeometry args={[1.0015, 96, 64]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
};

const City: React.FC<{ c: GlobeCity; color: string }> = ({ c, color }) => {
  const [x, y, z] = toV3(c.at, 1.004);
  const q = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    o.lookAt(x * 2, y * 2, z * 2);
    return o.quaternion.clone();
  }, [x, y, z]);
  if (c.o <= 0) return null;
  const ringR = c.size * (1 + 2.2 * c.pulse);
  return (
    <group position={[x, y, z]} quaternion={q}>
      <mesh renderOrder={3}>
        <circleGeometry args={[c.size, 40]} />
        <meshBasicMaterial color={color} transparent opacity={c.o} depthWrite={false} />
      </mesh>
      {c.pulse > 0 && c.pulse < 1 ? (
        <mesh renderOrder={3}>
          <ringGeometry args={[ringR * 0.86, ringR, 64]} />
          <meshBasicMaterial color={color} transparent opacity={(1 - c.pulse) * 0.9 * c.o} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
};

const CameraRig: React.FC<{ cam: GlobeCam }> = ({ cam }) => {
  const { camera } = useThree();
  const [x, y, z] = camPosition(cam);
  camera.position.set(x, y, z);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return null;
};

/** الضوء من فوق الكاميرا ويسارها قليلًا، فيبقى الوجه المرئي مضاءً ويظهر استدارة الكرة عند الحافة */
const Light: React.FC<{ cam: GlobeCam; shade: number }> = ({ cam, shade }) => {
  const [x, y, z] = camPosition({ ...cam, lon: cam.lon + 25, lat: Math.min(80, cam.lat + 20) });
  return (
    <>
      <ambientLight intensity={Math.PI * (1 - shade)} />
      <directionalLight position={[x, y, z]} intensity={Math.PI * shade * 1.15} />
    </>
  );
};

export const Globe3D: React.FC<Globe3DProps> = ({ width, height, cam, look, borders = [], routes = [], rivers = [], cities = [], lineWidth = 2.2 }) => {
  const tex = useMemo(() => baseTexture(look), [look]);
  const coast = useMemo(() => COAST.coordinates as LonLat[][], []);
  const lw = lineWidth;
  const outline = borders.map((b) => (b.draw >= 1 ? b.ring : b.ring.slice(0, Math.max(0, Math.round(b.ring.length * b.draw)))));
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: GLOBE_FOV, near: 0.01, far: 100 }} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
      <CameraRig cam={cam} />
      <Light cam={cam} shade={look.shade} />
      <mesh>
        <sphereGeometry args={[1, 128, 96]} />
        <meshLambertMaterial map={tex} />
      </mesh>
      <FillLayer borders={borders} color={look.borderFill} />
      <Lines lines={coast} color={look.coast} width={lw} r={1.0025} />
      <Lines lines={rivers.map((r) => (r.p === undefined ? r.pts : partial(r.pts, r.p)))} color={look.river} width={lw * 1.1} r={1.003} />
      <Lines lines={outline} color={look.border} width={lw * 1.6} r={1.0035} />
      <Lines lines={routes.map((r) => (r.p === undefined ? r.pts : partial(r.pts, r.p)))} color={look.route} width={lw * 2} r={1.005} />
      {cities.map((c, i) => (
        <City key={i} c={c} color={look.city} />
      ))}
    </ThreeCanvas>
  );
};

const partial = (pts: LonLat[], p: number) => partialLine(pts, p);
