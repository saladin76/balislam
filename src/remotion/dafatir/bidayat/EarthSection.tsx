/**
 * «البدايات» — الاتجاه ٣: «مقطع الأرض» (D203).
 * المراجع: مجسمات التضاريس السويسرية لإدوارد إمهوف وكزافير إمفيلد (مجسم «ماترهورن» في المتحف الألبي السويسري: الأرض
 * مجسمًا دقيقًا على قاعدة)، وديوراما المتحف الأمريكي للتاريخ الطبيعي (قاعة كارل إيكلي: ضوء متحف مسلط في غرفة داكنة)،
 * وخريطة ويليام سميث الجيولوجية (١٨١٥: طبقات الأرض ألوانًا، الزمن يُقرأ من أسفل إلى أعلى).
 * العالم: كتلة أرض مقطوعة على قاعدة في متحف داكن يُضاء مسلطه عند «ومن هنا»: سطحها تضاريس وواجهتها طبقات الزمن. خيط الزمن الأحمر يصعد الطبقات
 * مثبتًا بدبابيس نحاس عند «تتصل» وعقدته عند «البشرية»، و«ثابت» يُختم على بطاقة المتحف عند «قصة»، والطبقات تنزلق
 * إلى الأمام واحدة واحدة عند «الأرض»، والنهر يجري على السطح عند «حياة»، ومجسمات القرى البيضاء عند «القرى» والمدينة
 * المسورة عند «المدن»، و«تقدير» عند «القديمة». جملة الذكر: سكون تام.
 * لماذا أفضل من المصدر: الزمن عمق يُرى (طبقات بعضها فوق بعض)، و«درجة الثبوت» بطاقة متحف حقيقية بجوار ما توثقه.
 */
import React, { useMemo } from "react";
import { Audio, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { BeamDust, DepthOfField, Stage3D, ease, lightsAt, orbit, safeKeys, type Light } from "../../three";
import { RedrawWhenReady } from "../archive/ArchiveLab";
import { BID_SEC, BID_STILL, BidLine, K, ProofStamp, Stream, WallRing, n2, useWearBump, RedThread, SFX, camOf, shotBounds, span, useBidFont, wordAt, type BidShot, type V3 } from "./common";

/** الطبقات من الأقدم (أسفل) إلى الأحدث (أعلى): السمك واللون */
export const STRATA: { h: number; color: string }[] = [
  { h: 0.34, color: K.soil }, { h: 0.22, color: K.earth }, { h: 0.18, color: K.clay }, { h: 0.26, color: K.sand }, { h: 0.14, color: K.olive }, { h: 0.2, color: K.pale },
];
const W = 3.2, D = 2.2;
const topY = () => STRATA.reduce((n, s) => n + s.h, 0);
const relief = (x: number, z: number) => 0.3 * Math.exp(-((x - 0.7) ** 2 + (z + 0.5) ** 2) / 0.9) + 0.12 * Math.exp(-((x + 1.1) ** 2 + (z + 0.6) ** 2) / 0.5) + 0.05 * n2(41, x * 1.3, z * 1.3) + 0.006 * n2(47, x * 8, z * 8);
const HOUSES: V3[] = [[-0.9, 0, 0.55], [-0.65, 0, 0.75], [-1.1, 0, 0.8], [-0.75, 0, 0.35], [-0.45, 0, 0.55]];
const RIVER: [number, number][] = [[1.4, -0.9], [0.8, -0.5], [0.2, -0.1], [-0.3, 0.2], [-0.9, 0.3], [-1.5, 0.45]];

export const sectionShots = (): BidShot[] => {
  const { s1, s2, s3 } = shotBounds();
  const y = 1.34;
  const medium = { target: [0, y * 0.8, 0] as V3, yaw: -32, pitch: 18, dist: 6.8, fov: 32 };
  return [
    { id: "museum", size: "wide", a: 0, b: s1, aperture: 0.004, from: { target: [0, 0.9, 0], yaw: 16, pitch: 12, dist: 9.4, fov: 34 }, to: { target: [0, 0.9, 0], yaw: 8, pitch: 14, dist: 8.4, fov: 34 } },
    { id: "strata", size: "detail", a: s1, b: s2, aperture: 0.03, from: { target: [-0.6, 0.55, D / 2], yaw: 22, pitch: 4, dist: 1.7, fov: 30 }, to: { target: [-0.5, 0.75, D / 2], yaw: 14, pitch: 6, dist: 1.55, fov: 30 } },
    { id: "relief", size: "close", a: s2, b: s3, aperture: 0.016, from: { target: [-0.3, y + 0.25, 0.3], yaw: -18, pitch: 34, dist: 3.4, fov: 32 }, to: { target: [-0.6, y + 0.2, 0.5], yaw: -8, pitch: 36, dist: 3.0, fov: 32 } },
    { id: "block", size: "medium", a: s3, b: BID_SEC, aperture: 0.008, from: medium, to: { ...medium, dist: 6.2, yaw: -26 } },
  ];
};

export const EarthSectionLab: React.FC = () => {
  const ready = useBidFont();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const still = BID_STILL;
  const key = (w: string, d: number, lead = 0.1) => safeKeys([{ a: wordAt(w) - lead, b: wordAt(w) - lead + d, to: 1 }], still)[0]!;
  const threadK = key("تتصل", 2.4), stampK = key("قصة", 0.5), knotK = key("البشرية", 0.6), layersK = key("الأرض", 1.2);
  const waterK = key("حياة", 1.4), proofK = key("القديمة", 0.5), villageK = key("القرى", 0.9), cityK = key("والمدن", 0.9);
  const p = (k: { a: number; b: number }) => ease(span(t, k.a, k.b - k.a));
  const layers = span(t, layersK.a, layersK.b - layersK.a), water = p(waterK), village = p(villageK), city = p(cityK);
  const Y = topY();
  // أثر الزمن على الطبقات: تحزيز أفقي (ترسيب) ونقر صغير
  const strataWear = useWearBump(83, [3, 2], true), topWear = useWearBump(89, [3, 2]);
  const top = useMemo(() => {
    const g = new THREE.PlaneGeometry(W, D, 96, 66), pos = g.attributes.position!, colors: number[] = [];
    const lo = new THREE.Color(K.pale), hi = new THREE.Color(K.sand);
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = -pos.getY(i), h = relief(x, z); pos.setZ(i, h); const c = lo.clone().lerp(hi, Math.min(1, h / 0.35)); colors.push(c.r, c.g, c.b); }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); g.computeVertexNormals(); return g;
  }, []);
  const hTop = React.useCallback((x: number, z: number) => Y + relief(x, z), [Y]);
  // الخيط يصعد الواجهة من أقدم طبقة: دبوس عند كل حد طبقة
  const pins: V3[] = useMemo(() => {
    let y = 0.12; const out: V3[] = [];
    STRATA.forEach((s, i) => { out.push([-0.9 + i * 0.22, y, D / 2 + 0.06]); y += s.h; });
    out.push([0.45, Y - 0.04, D / 2 + 0.06]);
    return out;
  }, [Y]);
  const thread = p(threadK);
  const shots = sectionShots();
  const shot = shots.find((s) => t >= s.a && t < s.b) ?? shots[shots.length - 1]!;
  const c = camOf(shot, t);
  const cam = { position: orbit(c), target: c.target, fov: c.fov };
  // «ومن هنا»: يُضاء المسلط على الكتلة (من هنا نبدأ) في غرفة المتحف الداكنة
  const spot = 0.15 + 0.85 * ease(span(t, wordAt("ومن") - 0.15, 0.9));
  const lights: Light[] = [
    { kind: "ambient", kelvin: 5200, intensity: 0.22, position: [0, 0, 0] },
    // ضوء المتحف المسلط من أعلى أمام الكتلة: بقعة دافئة تُلقي ظل المجسمات، والغرفة حولها داكنة
    { kind: "practical", kelvin: 3400, intensity: 26 * spot, position: [0.8, 4.2, 2.4] },
    { kind: "key", kelvin: 4200, intensity: 0.9, position: [-5, 6, 5] },
  ];
  let y0 = 0;
  return (
    <>
      <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, lights, still)} background={K.night} shadows="soft">
        <RedrawWhenReady ready={ready} />
        <DepthOfField focus={c.dist} aperture={shot.aperture} />
        {/* أرض المتحف والقاعدة */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow><planeGeometry args={[40, 40]} /><meshStandardMaterial color={K.deep} roughness={0.7} /></mesh>
        <mesh position={[0, -0.25, 0]} castShadow receiveShadow><boxGeometry args={[W + 0.8, 0.5, D + 0.8]} /><meshStandardMaterial color={K.ink} roughness={0.55} /></mesh>
        {/* الطبقات: تنزلق إلى الأمام واحدة واحدة عند «الأرض» كأدراج الزمن ثم تعود */}
        {STRATA.map((s, i) => {
          const q = Math.sin(Math.PI * ease(span(layers * STRATA.length, i, 1.8))) * 0.12;
          const y = y0 + s.h / 2; y0 += s.h;
          return (
            <mesh key={i} position={[0, y, q]} castShadow receiveShadow>
              <boxGeometry args={[W, s.h, D]} /><meshStandardMaterial color={s.color} bumpMap={strataWear} bumpScale={1.4} roughness={0.95} />
            </mesh>
          );
        })}
        <mesh geometry={top} rotation={[-Math.PI / 2, 0, 0]} position={[0, Y, 0]} castShadow receiveShadow><meshStandardMaterial vertexColors bumpMap={topWear} bumpScale={0.5} roughness={0.9} /></mesh>
        <Stream path={RIVER} p={water} w={0.09} h={hTop} />
        {/* مجسمات المتحف البيضاء: القرى، ثم المدينة بسورها */}
        {HOUSES.map(([x, , z], i) => {
          const q = ease(span(village, i * 0.12, 0.5));
          return q > 0 ? <mesh key={i} position={[x, Y + relief(x, z) + 0.05 * q, z]} scale={[1, q, 1]} castShadow receiveShadow><boxGeometry args={[0.12, 0.1, 0.1]} /><meshStandardMaterial color={K.paper} roughness={0.8} /></mesh> : null;
        })}
        <group>
          <WallRing at={[0.7, Y + relief(0.7, 0.6), 0.6]} r={0.26} q={city} color={K.paper} h={0.06} />
          {([[-0.06, 0.05], [0.08, -0.04], [0, 0.1]] as [number, number][]).map(([x, z], k) => (city > 0 ? <mesh key={k} position={[0.7 + x, Y + relief(0.7 + x, 0.6 + z) + 0.05 * city, 0.6 + z]} scale={[1, city, 1]} castShadow><boxGeometry args={[0.1, 0.1, 0.09]} /><meshStandardMaterial color={K.paper} roughness={0.8} /></mesh> : null))}
        </group>
        {/* الدبابيس النحاسية والخيط بينها */}
        {pins.map((q, i) => (span(thread * pins.length, i, 0.6) > 0 ? (
          <mesh key={i} position={q} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.022, 0.022, 0.05, 12]} /><meshStandardMaterial color={K.sand} metalness={0.7} roughness={0.3} /></mesh>
        ) : null))}
        <RedThread points={pins.map(([x, y, z]) => [x, y, z + 0.02] as V3)} p={thread} knot={p(knotK)} knotAt={0.5} radius={0.012} />
        {/* بطاقتا المتحف على حافة القاعدة، والختم يُضغط عليهما */}
        {[{ x: -1.5, word: "ثابت" as const, k: stampK, ink: K.ribbon }, { x: 1.4, word: "تقدير" as const, k: proofK, ink: K.ink }].map((b) => (
          <group key={b.word}>
            <mesh position={[b.x, 0.005, D / 2 + 0.25]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[0.95, 0.56]} /><meshStandardMaterial color={K.paper} roughness={0.9} /></mesh>
            <ProofStamp word={b.word} at={[b.x, 0.006, D / 2 + 0.25]} press={span(t, b.k.a, 0.3)} lift={span(t, b.k.a + 0.35, 0.4)} ready={ready} size={0.24} ink={b.ink} />
          </group>
        ))}
        <BeamDust t={t} from={[0.8, 4.2, 2.4]} to={[0, 1.2, 0.6]} radius={0.7} color={K.light} count={40} still={still} seed={29} />
      </Stage3D>
      {/* صوت الغرفة، ومع كل حركة صوتها (D158): الدبابيس، والختم، والطبقات، والماء، والمجسمات */}
      <Audio src={SFX("silence-room")} volume={0.3} loop />
      <Sequence from={Math.round(threadK.a * fps)} durationInFrames={20}><Audio src={SFX("tick")} volume={0.3} /></Sequence>
      <Sequence from={Math.round((stampK.a + 0.28) * fps)} durationInFrames={20}><Audio src={SFX("stamp")} volume={0.45} /></Sequence>
      <Sequence from={Math.round(layersK.a * fps)} durationInFrames={30}><Audio src={SFX("swipe-paper")} volume={0.25} /></Sequence>
      <Sequence from={Math.round(waterK.a * fps)} durationInFrames={30}><Audio src={SFX("water-drop")} volume={0.3} /></Sequence>
      <Sequence from={Math.round((proofK.a + 0.28) * fps)} durationInFrames={20}><Audio src={SFX("stamp")} volume={0.35} /></Sequence>
      <Sequence from={Math.round(villageK.a * fps)} durationInFrames={20}><Audio src={SFX("drop-soft")} volume={0.3} /></Sequence>
      <Sequence from={Math.round(cityK.a * fps)} durationInFrames={20}><Audio src={SFX("drop-soft")} volume={0.3} /></Sequence>
      <BidLine t={t} name="مقطع الأرض" tone="light" />
    </>
  );
};
