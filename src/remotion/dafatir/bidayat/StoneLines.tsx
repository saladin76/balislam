/**
 * «البدايات» — الاتجاه ٢: «خطوط على الأرض» (D203).
 * المراجع: «الحاجز الحلزوني» لروبرت سميثسون (Spiral Jetty، ١٩٧٠: حجارة في ماء ضحل تُرى من علٍ)، و«خط صنعه المشي» ودوائر
 * الحجارة لريتشارد لونغ (A Line Made by Walking، ١٩٦٧؛ Circles)، و«مناظر البحر» لهيروشي سوغيموتو (Seascapes: أفق واحد
 * بين ماء وسماء، صامت اللون).
 * العالم: أرض واسعة بكر عند الفجر، ماء ضحل وأفق، والحجر يُوضع حجرًا حجرًا: خطٌّ يبدأ «من هنا» ويمتد ويلتف حلزونًا في الماء،
 * وخيط الزمن الأحمر ممدود على الخط وعقدته عند «البشرية»، و«ثابت» على بلاطة عند «قصة»، والماء يفيض حول الحلزون عند «حياة»،
 * ودوائر الحجارة (قرى) عند «القرى»، ودائرة كبيرة ببابها عند «المدن»، و«تقدير» عند «القديمة». جملة الذكر: سكون تام.
 * لماذا أفضل من المصدر: الزمن يُرى خطًّا على الأرض بالمقياس الحقيقي للمكان، والقليل من العناصر يُقرأ من بعيد.
 */
import React, { useMemo } from "react";
import { Audio, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { DepthOfField, Stage3D, ease, lightsAt, noise1, orbit, safeKeys, type Light } from "../../three";
import { RedrawWhenReady } from "../archive/ArchiveLab";
import { BID_SEC, BID_STILL, BidLine, K, ProofStamp, n2, useWearBump, RedThread, SFX, camOf, shotBounds, span, useBidFont, wordAt, type BidShot, type V3 } from "./common";

/** الخط: من القريب نحو الماء ثم حلزون في الماء (لفّتان ونصف إلى الداخل عكس عقارب الساعة كالأصل) */
export const stonePath = (): [number, number][] => {
  const out: [number, number][] = [];
  for (let i = 0; i <= 10; i++) out.push([-3.2 + i * 0.32, 4.2 - i * 0.42]);
  const [cx, cz] = [0.6, -1.6];
  for (let i = 1; i <= 46; i++) {
    const a = -Math.PI / 2 - i * 0.34, r = 1.9 * (1 - i / 56);
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return out;
};
const CIRCLES: { x: number; z: number; r: number; n: number; gap?: number }[] = [
  { x: -3.4, z: 1.4, r: 0.38, n: 11 }, { x: -2.5, z: 0.4, r: 0.32, n: 9 }, { x: -4.0, z: 0.2, r: 0.3, n: 9 },
  { x: -5.2, z: -1.0, r: 0.9, n: 26, gap: 0.5 },
];

/** الأرض البكر: تنحدر نحو الماء ببطء مع تموج ثنائي البعد، فيرسم سطح الماء خط شاطئ غير مستقيم؛ الحلزون في ماء ضحل */
export const groundH = (x: number, z: number) => 0.05 + 0.022 * (z + 0.4) + 0.05 * n2(61, x * 0.45, z * 0.45) + 0.008 * n2(63, x * 3, z * 3);
/** مستوى الماء: منخفض (طين مبلول) ثم يفيض عند «حياة» */
export const waterLevel = (p: number) => -0.02 + 0.07 * p;
/** حجر: مجسم بتشوّه ثابت البذرة (لا كرات متطابقة) */
const useStones = (n: number, seed: number) => useMemo(() => Array.from({ length: n }, (_, i) => {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const pos = g.attributes.position!;
  // حجر مُحتّ: تشوّه ناعم ثنائي البعد على الاتجاه، ومسطّح من أسفل
  for (let k = 0; k < pos.count; k++) { const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k), f = 1 + 0.28 * n2(seed + i * 3, x * 1.4 + y, z * 1.4 - y); pos.setXYZ(k, x * f * 1.15, Math.max(-0.35, y * f * 0.55), z * f * 0.9); }
  g.computeVertexNormals();
  const s = 0.09 + 0.05 * (noise1(seed + 40, i * 2.1) + 1) / 2;
  return { g, s, rot: noise1(seed + 70, i) * Math.PI, tone: i % 3 };
}), [n, seed]);

export const stoneShots = (): BidShot[] => {
  const { s1, s2, s3 } = shotBounds();
  const aerial = { target: [-1.2, 0, -0.4] as V3, yaw: 18, pitch: 72, dist: 11.5, fov: 34 };
  return [
    // سوغيموتو: الكاميرا منخفضة والأفق في المنتصف، والخط يمتد نحوه
    { id: "horizon", size: "wide", a: 0, b: s1, aperture: 0.003, from: { target: [0.4, 0.6, -6], yaw: -6, pitch: 3, dist: 11.5, fov: 36 }, to: { target: [0.4, 0.55, -6], yaw: -2, pitch: 4, dist: 10.6, fov: 36 } },
    { id: "knot", size: "detail", a: s1, b: s2, aperture: 0.03, from: { target: [-1.1, 0.12, 1.6], yaw: 48, pitch: 14, dist: 1.6, fov: 30 }, to: { target: [-0.8, 0.12, 1.25], yaw: 38, pitch: 16, dist: 1.45, fov: 30 } },
    { id: "circles", size: "close", a: s2, b: s3, aperture: 0.014, from: { target: [-3.4, 0.15, 0.6], yaw: 70, pitch: 20, dist: 4.4, fov: 32 }, to: { target: [-4.0, 0.15, 0.2], yaw: 58, pitch: 22, dist: 4.0, fov: 32 } },
    // سميثسون: من علٍ يُرى الحلزون والدوائر معًا
    { id: "aerial", size: "medium", a: s3, b: BID_SEC, aperture: 0.004, from: aerial, to: { ...aerial, dist: 10.2, pitch: 76 } },
  ];
};

export const StoneLinesLab: React.FC = () => {
  const ready = useBidFont();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const still = BID_STILL;
  const path = useMemo(stonePath, []);
  const lineStones = useStones(path.length, 31);
  const ringStones = useStones(CIRCLES.reduce((n, c) => n + c.n, 0), 57);
  const key = (w: string, d: number, lead = 0.1) => safeKeys([{ a: wordAt(w) - lead, b: wordAt(w) - lead + d, to: 1 }], still)[0]!;
  const lineK = key("ومن", 4.4), stampK = key("قصة", 0.5), knotK = key("البشرية", 0.6);
  const waterK = key("حياة", 1.4), proofK = key("القديمة", 0.5), villageK = key("القرى", 0.9), cityK = key("والمدن", 1.0);
  const p = (k: { a: number; b: number }) => ease(span(t, k.a, k.b - k.a));
  const line = span(t, lineK.a, lineK.b - lineK.a), water = p(waterK);
  const dawn = ease(span(t, 0, 4));
  // السماء: انتقال الفجر بلونين من الهوية (غسق إلى شمس) في كانفاس رأسي، بلا نجوم
  const sky = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 8; c.height = 512;
    const g = c.getContext("2d")!, gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, K.dusk); gr.addColorStop(0.55, K.mist); gr.addColorStop(0.9, K.light); gr.addColorStop(1, K.sun);
    g.fillStyle = gr; g.fillRect(0, 0, 8, 512);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  const wear = useWearBump(71, [6, 4]);
  // الأرض: طين ملحي فاتح، يغمق حيث يقترب من الماء (مبلول)
  const ground = useMemo(() => {
    const g = new THREE.PlaneGeometry(40, 26, 400, 260), pos = g.attributes.position!, colors: number[] = [];
    const dry = new THREE.Color(K.pale), sandy = new THREE.Color(K.sand), wet = new THREE.Color(K.earth);
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = -pos.getY(i) - 2, h = groundH(x, z); pos.setY(i, -(z)); pos.setZ(i, h); const c = wet.clone().lerp(dry.clone().lerp(sandy, 0.35 + 0.35 * n2(67, x * 0.6, z * 0.6)), Math.min(1, Math.max(0, h / 0.09))); colors.push(c.r, c.g, c.b); }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); g.computeVertexNormals(); return g;
  }, []);
  const shots = stoneShots();
  const shot = shots.find((s) => t >= s.a && t < s.b) ?? shots[shots.length - 1]!;
  const c = camOf(shot, t);
  const cam = { position: orbit(c), target: c.target, fov: c.fov };
  const lights: Light[] = [
    { kind: "ambient", kelvin: 7500, intensity: 0.45 + 0.3 * dawn, position: [0, 0, 0] },
    // الشمس عند الأفق خلف الماء: ضوء خلفي مائل يرسم حافة كل حجر وظله الطويل نحو الكاميرا
    { kind: "key", kelvin: 2700 + 1100 * dawn, intensity: 1.4 + 1.5 * dawn, position: [2, 1.2 + 1.8 * dawn, -14] },
    { kind: "fill", kelvin: 8500, intensity: 0.35, position: [-4, 6, 8] },
  ];
  let ri = 0;
  return (
    <>
      <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, lights, still)} background={K.dusk} shadows="soft">
        <RedrawWhenReady ready={ready} />
        <DepthOfField focus={c.dist} aperture={shot.aperture} />
        <mesh position={[0, 6, -30]}><planeGeometry args={[120, 30]} /><meshBasicMaterial map={sky} toneMapped={false} /></mesh>
        {/* قرص الشمس على الأفق يطلع قليلًا في الثواني الأولى، بلا وهج */}
        <mesh position={[6, -0.6 + 1.6 * dawn, -29]}><circleGeometry args={[1.1, 48]} /><meshBasicMaterial color={K.light} toneMapped={false} /></mesh>
        {/* الأرض البكر: طين ملحي فاتح، والماء الضحل بعده حتى الأفق، ويفيض حول الحلزون عند «حياة» */}
        <mesh geometry={ground} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><meshStandardMaterial vertexColors bumpMap={wear} bumpScale={1.2} roughness={0.95} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, waterLevel(water), -10]} receiveShadow><planeGeometry args={[90, 44]} /><meshStandardMaterial color={K.water} roughness={0.8} transparent opacity={0.9} /></mesh>
        {/* الخط ثم الحلزون: يوضع حجرًا حجرًا (يهبط ويستقر) */}
        {path.map(([x, z], i) => {
          const q = ease(span(line * path.length, i, 1.4));
          const st = lineStones[i]!;
          return q > 0 ? (
            <mesh key={i} geometry={st.g} position={[x, groundH(x, z) + st.s * 0.25 + (1 - q) * 0.6, z]} rotation={[0, st.rot, 0]} scale={st.s} castShadow receiveShadow>
              <meshStandardMaterial color={[K.earth, K.sand, K.soil][st.tone]} bumpMap={wear} bumpScale={0.8} roughness={0.95} />
            </mesh>
          ) : null;
        })}
        {/* دوائر الحجارة: ثلاث قرى عند «القرى»، والكبيرة ببابها عند «المدن» */}
        {CIRCLES.map((cc, ci) => Array.from({ length: cc.n }, (_, k) => {
          const st = ringStones[ri++]!;
          const a = (k / cc.n) * Math.PI * 2;
          if (cc.gap && Math.abs(((a + Math.PI) % (Math.PI * 2)) - Math.PI) < cc.gap / 2) return null;
          const prog = ci < 3 ? ease(span(t, villageK.a + ci * 0.15 + k * 0.02, 0.4)) : ease(span(t, cityK.a + k * 0.025, 0.4));
          return prog > 0 ? (
            <mesh key={`${ci}-${k}`} geometry={st.g} position={[cc.x + Math.cos(a) * cc.r, groundH(cc.x + Math.cos(a) * cc.r, cc.z + Math.sin(a) * cc.r) + st.s * 0.22 + (1 - prog) * 0.5, cc.z + Math.sin(a) * cc.r]} rotation={[0, st.rot, 0]} scale={st.s * (ci < 3 ? 0.8 : 1.1)} castShadow receiveShadow>
              <meshStandardMaterial color={[K.earth, K.sand, K.soil][st.tone]} bumpMap={wear} bumpScale={0.8} roughness={0.95} />
            </mesh>
          ) : null;
        }))}
        <RedThread points={path.slice(0, 12).map(([x, z], i) => { const ox = 0.16 + 0.07 * Math.sin(i * 1.7); return [x + ox, groundH(x + ox, z) + 0.012, z + 0.06] as V3; })} p={Math.min(1, line * 1.9)} knot={p(knotK)} knotAt={0.5} radius={0.012} />
        {/* بلاطتان مستويتان عليهما الختمان */}
        <mesh position={[-1.9, groundH(-1.9, 3.2) + 0.03, 3.2]} rotation={[0, 0.3, 0]} receiveShadow castShadow><boxGeometry args={[0.95, 0.06, 0.72]} /><meshStandardMaterial color={K.pale} bumpMap={wear} bumpScale={0.6} roughness={0.95} /></mesh>
        <ProofStamp word="ثابت" at={[-1.9, groundH(-1.9, 3.2) + 0.061, 3.2]} press={span(t, stampK.a, 0.3)} lift={span(t, stampK.a + 0.35, 0.4)} ready={ready} size={0.3} tilt={0.3} />
        <mesh position={[-3.0, groundH(-3.0, -0.4) + 0.03, -0.4]} rotation={[0, -0.2, 0]} receiveShadow castShadow><boxGeometry args={[0.85, 0.06, 0.66]} /><meshStandardMaterial color={K.pale} bumpMap={wear} bumpScale={0.6} roughness={0.95} /></mesh>
        <ProofStamp word="تقدير" at={[-3.0, groundH(-3.0, -0.4) + 0.061, -0.4]} press={span(t, proofK.a, 0.3)} lift={span(t, proofK.a + 0.35, 0.4)} ready={ready} size={0.27} ink={K.ink} tilt={-0.2} />
      </Stage3D>
      {/* صوت المكان، ومع كل حركة صوتها (D158): وضع الحجر، والختم، والماء */}
      <Audio src={SFX("silence-room")} volume={0.3} loop />
      <Sequence from={Math.round(lineK.a * fps)} durationInFrames={20}><Audio src={SFX("drop-soft")} volume={0.3} /></Sequence>
      <Sequence from={Math.round((stampK.a + 0.28) * fps)} durationInFrames={20}><Audio src={SFX("stamp")} volume={0.45} /></Sequence>
      <Sequence from={Math.round(waterK.a * fps)} durationInFrames={30}><Audio src={SFX("water-drop")} volume={0.35} /></Sequence>
      <Sequence from={Math.round((proofK.a + 0.28) * fps)} durationInFrames={20}><Audio src={SFX("stamp")} volume={0.35} /></Sequence>
      <Sequence from={Math.round(villageK.a * fps)} durationInFrames={20}><Audio src={SFX("drop-soft")} volume={0.3} /></Sequence>
      <Sequence from={Math.round(cityK.a * fps)} durationInFrames={20}><Audio src={SFX("drop-soft")} volume={0.3} /></Sequence>
      <BidLine t={t} name="خطوط على الأرض" tone="ink" />
    </>
  );
};
