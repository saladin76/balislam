/**
 * «البدايات» — الاتجاه ١: «أرض من طين» (D203).
 * المراجع: أعمال آندي غولدزورثي بالطين والحجر (Clay Wall وأعمال الأنهار: خامة الأرض نفسها هي العمل)، وطين التحريك
 * اليدوي كما في أفلام Laika (Kubo and the Two Strings) وAardman (بصمات الأصابع على الخامة مقصودة)، وضوء الفجر
 * المائل في صور سيباستياو سالغادو «Genesis» (الأرض قبل الإنسان).
 * العالم: لوح طين خام على طاولة، تتشكل فيه الأرض مع الكلام: يُمدّ خيط الزمن الأحمر عند «تتصل»، ويُختم «ثابت» عند «قصة»،
 * وتنعقد العقدة عند «البشرية»، وترتفع التلال من الطين عند «الأرض»، ويجري الماء في المجرى عند «حياة»، وتُضغط القرى من
 * الطين عند «القرى»، ويُرفع سور المدينة عند «المدن»، و«تقدير» عند «القديمة». جملة الذكر: سكون تام.
 * لماذا أفضل من المصدر: الخامة التي يذكرها النص نفسه (الطين)، تُرى بأثر اليد والزمن، لا رسم مسطح ولا خرائط جاهزة.
 */
import React, { useMemo } from "react";
import { Audio, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { BeamDust, DepthOfField, Stage3D, ease, lightsAt, orbit, safeKeys, type Light } from "../../three";
import { RedrawWhenReady } from "../archive/ArchiveLab";
import { BID_STILL, BidLine, K, ProofStamp, Stream, WallRing, n2, RedThread, SFX, camOf, shotBounds, span, useBidFont, wordAt, BID_SEC, type BidShot, type V3 } from "./common";

/** ارتفاع التلال (حتمي): مجموع موجات ضوضاء؛ rise من ٠ (لوح مسطح) إلى ١ (أرض تشكلت) */
export const clayHeight = (x: number, z: number, rise: number) => {
  // تلال بأشكال مستديرة في مواضع ثابتة، وتفاصيل ثنائية البعد (لا خطوط متوازية)، وأثر اليد صغير دائمًا
  const MOUNDS: [number, number, number, number][] = [[2.4, -1.6, 1.7, 0.95], [0.5, -2.3, 1.2, 0.55], [3.7, 0.6, 1.1, 0.5], [-2.9, -1.9, 1.5, 0.6], [-0.9, -0.9, 0.9, 0.25]];
  const hills = MOUNDS.reduce((n, [mx, mz, r, a]) => n + a * Math.exp(-((x - mx) ** 2 + (z - mz) ** 2) / (r * r)), 0);
  return rise * (hills + 0.1 * n2(3, x * 0.8, z * 0.8)) + 0.014 * n2(11, x * 4, z * 4);
};

/** خطوط بصمات الأصابع على الطين (bumpMap): أقواس متحدة المركز متقطعة في مواضع ثابتة */
const useFingerprints = () => useMemo(() => {
  const c = document.createElement("canvas"); c.width = c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgb(128,128,128)"; g.fillRect(0, 0, 1024, 1024);
  for (let k = 0; k < 46; k++) {
    const cx = (k * 397) % 1024, cy = (k * 613) % 1024, a0 = (k * 1.7) % (Math.PI * 2);
    for (let r = 6; r < 64; r += 5) {
      g.strokeStyle = r % 2 ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)"; g.lineWidth = 2.2;
      g.beginPath(); g.ellipse(cx, cy, r, r * 0.72, a0, 0.3, Math.PI * 1.7); g.stroke();
    }
  }
  // أثر أداة النحت: ضربات مستقيمة قصيرة
  for (let k = 0; k < 140; k++) { const x = (k * 211) % 1024, y = (k * 347) % 1024; g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40, y + 9); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t;
}, []);

/** مجرى الماء: من أعلى التلال إلى الوادي (مسار على السطح) */
const RIVER: [number, number][] = [[3.6, -2.4], [2.6, -1.6], [1.5, -1.1], [0.4, -0.4], [-0.6, 0.3], [-1.8, 0.9], [-3.2, 1.4]];
/** خيط الزمن: من حافة اللوح القريبة يسارًا عبر الأرض إلى القرية */
const THREAD: [number, number][] = [[-4.4, 2.6], [-3.2, 1.9], [-2.0, 1.2], [-0.9, 0.9], [0.2, 1.1], [1.1, 1.7]];
const VILLAGE: { x: number; z: number; w: number; d: number; h: number; r: number }[] = [
  { x: -0.4, z: 1.6, w: 0.22, d: 0.18, h: 0.14, r: 0.2 }, { x: -0.05, z: 1.85, w: 0.18, d: 0.2, h: 0.12, r: -0.3 }, { x: -0.7, z: 1.95, w: 0.2, d: 0.16, h: 0.13, r: 0.6 },
  { x: -0.3, z: 2.2, w: 0.16, d: 0.16, h: 0.11, r: 0.1 }, { x: 0.25, z: 2.15, w: 0.2, d: 0.17, h: 0.12, r: -0.5 },
];

export const clayShots = (): BidShot[] => {
  const { s1, s2, s3 } = shotBounds();
  const medium = { target: [0.2, 0.3, 0.8] as V3, yaw: -24, pitch: 30, dist: 7.6, fov: 32 };
  return [
    { id: "slab", size: "wide", a: 0, b: s1, aperture: 0.004, from: { target: [0, 0, 0], yaw: 12, pitch: 38, dist: 12.5, fov: 34 }, to: { target: [-0.6, 0, 0.6], yaw: 4, pitch: 34, dist: 11.0, fov: 34 } },
    { id: "thread", size: "detail", a: s1, b: s2, aperture: 0.03, from: { target: [-2.0, 0.1, 1.2], yaw: 40, pitch: 16, dist: 2.0, fov: 30 }, to: { target: [-1.4, 0.15, 1.0], yaw: 30, pitch: 18, dist: 1.8, fov: 30 } },
    { id: "valley", size: "close", a: s2, b: s3, aperture: 0.016, from: { target: [0.4, 0.15, 1.0], yaw: -40, pitch: 22, dist: 4.4, fov: 32 }, to: { target: [-0.1, 0.15, 1.5], yaw: -28, pitch: 24, dist: 3.9, fov: 32 } },
    { id: "land", size: "medium", a: s3, b: BID_SEC, aperture: 0.008, from: medium, to: { ...medium, dist: 6.8, pitch: 34 } },
  ];
};

export const ClayLandLab: React.FC = () => {
  const ready = useBidFont();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const still = BID_STILL;
  const prints = useFingerprints();
  const key = (w: string, d: number, lead = 0.1) => safeKeys([{ a: wordAt(w) - lead, b: wordAt(w) - lead + d, to: 1 }], still)[0]!;
  const threadK = key("تتصل", 2.4), stampK = key("قصة", 0.5), knotK = key("البشرية", 0.6), riseK = key("الأرض", 1.2);
  const waterK = key("حياة", 1.6), proofK = key("القديمة", 0.5), villageK = key("القرى", 0.9), cityK = key("والمدن", 0.9);
  const p = (k: { a: number; b: number }) => ease(span(t, k.a, k.b - k.a));
  const rise = p(riseK), water = p(waterK), village = p(villageK), city = p(cityK);
  // الفجر يطلع في الثواني الأربع الأولى ويثبت بعدها (قبل جملة الذكر بكثير)
  const dawn = ease(span(t, 0, 4));
  const terrain = useMemo(() => new THREE.PlaneGeometry(10, 7, 150, 105), []);
  // التلال ترتفع من اللوح: إزاحة الرؤوس وألوانها بالارتفاع
  useMemo(() => {
    const pos = terrain.attributes.position!, colors: number[] = [];
    // «صامتة اللون»: الطين مكسور بالبني، والقمم رملية باهتة
    const low = new THREE.Color(K.clay).lerp(new THREE.Color(K.earth), 0.45), high = new THREE.Color(K.sand).lerp(new THREE.Color(K.pale), 0.3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = -pos.getY(i), h = clayHeight(x, z, rise);
      pos.setZ(i, h);
      const c = low.clone().lerp(high, Math.min(1, h / 0.8)); colors.push(c.r, c.g, c.b);
    }
    pos.needsUpdate = true; terrain.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); terrain.computeVertexNormals();
  }, [terrain, rise]);
  const onLand = (pts: [number, number][], lift: number): V3[] => pts.map(([x, z]) => [x, clayHeight(x, z, rise) + lift, z]);
  const shots = clayShots();
  const shot = shots.find((s) => t >= s.a && t < s.b) ?? shots[shots.length - 1]!;
  const c = camOf(shot, t);
  const cam = { position: orbit(c), target: c.target, fov: c.fov };
  const lights: Light[] = [
    { kind: "ambient", kelvin: 7000, intensity: 0.35 + 0.35 * dawn, position: [0, 0, 0] },
    // فجر منخفض من يمين اللوح: يكشف بصمات الأصابع والتلال (ضوء مائل لا علوي)
    { kind: "key", kelvin: 2900 + 900 * dawn, intensity: 1.2 + 1.6 * dawn, position: [9, 2.2 + 1.6 * dawn, -3] },
    { kind: "fill", kelvin: 8000, intensity: 0.3, position: [-6, 5, 6] },
  ];
  const hAt = React.useCallback((x: number, z: number) => clayHeight(x, z, rise), [rise]);
  return (
    <>
      <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, lights, still)} background={K.dusk} shadows="soft">
        <RedrawWhenReady ready={ready} />
        <DepthOfField focus={c.dist} aperture={shot.aperture} />
        {/* الطاولة تحت اللوح */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow><planeGeometry args={[30, 20]} /><meshStandardMaterial color={K.soil} roughness={0.9} /></mesh>
        {/* لوح الطين: الأرض تتشكل */}
        <mesh geometry={terrain} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial vertexColors bumpMap={prints} bumpScale={0.35} roughness={0.92} />
        </mesh>
        {/* المجرى: الماء يجري من التلال إلى الوادي (اللازورد للماء وحده) */}
        <Stream path={RIVER} p={water} w={0.16} h={hAt} />
        {/* القرى تُضغط من الطين نفسه وترتفع منه، والسور حلقة طين تُرفع */}
        {VILLAGE.map((v, i) => {
          const q = ease(span(village, i * 0.12, 0.5));
          return q > 0 ? (
            <mesh key={i} position={[v.x, clayHeight(v.x, v.z, rise) + v.h * (q - 0.5), v.z]} rotation={[0, v.r, 0]} castShadow receiveShadow>
              <boxGeometry args={[v.w, v.h, v.d]} /><meshStandardMaterial color={K.earth} bumpMap={prints} bumpScale={0.3} roughness={0.95} />
            </mesh>
          ) : null;
        })}
        <WallRing at={[0.9, clayHeight(0.9, 2.5, rise), 2.5]} r={0.42} q={city} color={K.sand} bump={prints} />
        <RedThread points={onLand(THREAD, 0.025)} p={p(threadK)} knot={p(knotK)} knotAt={0.55} />
        <ProofStamp word="ثابت" at={[-3.6, clayHeight(-3.6, 1.0, rise) + 0.01, 1.0]} press={span(t, stampK.a, 0.3)} lift={span(t, stampK.a + 0.35, 0.4)} ready={ready} size={0.42} />
        <ProofStamp word="تقدير" at={[1.6, clayHeight(1.6, 1.4, rise) + 0.01, 1.4]} press={span(t, proofK.a, 0.3)} lift={span(t, proofK.a + 0.35, 0.4)} ready={ready} size={0.34} ink={K.ink} />
        <BeamDust t={t} from={[9, 3, -3]} to={[0, 0.4, 0.8]} radius={0.8} color={K.light} count={50} still={still} seed={23} />
      </Stage3D>
      {/* صوت الغرفة، ومع كل حركة صوتها (D158): مدّ الخيط، والختم، والماء، وضغط الطين */}
      <Audio src={SFX("silence-room")} volume={0.3} loop />
      <Sequence from={Math.round(threadK.a * fps)} durationInFrames={30}><Audio src={SFX("swipe-paper")} volume={0.2} /></Sequence>
      <Sequence from={Math.round((stampK.a + 0.28) * fps)} durationInFrames={20}><Audio src={SFX("stamp")} volume={0.45} /></Sequence>
      <Sequence from={Math.round(waterK.a * fps)} durationInFrames={30}><Audio src={SFX("water-drop")} volume={0.35} /></Sequence>
      <Sequence from={Math.round((proofK.a + 0.28) * fps)} durationInFrames={20}><Audio src={SFX("stamp")} volume={0.35} /></Sequence>
      <Sequence from={Math.round(villageK.a * fps)} durationInFrames={20}><Audio src={SFX("drop-soft")} volume={0.35} /></Sequence>
      <Sequence from={Math.round(cityK.a * fps)} durationInFrames={20}><Audio src={SFX("drop-soft")} volume={0.35} /></Sequence>
      <BidLine t={t} name="أرض من طين" tone="light" />
    </>
  );
};
