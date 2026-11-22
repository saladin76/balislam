/**
 * «خيال الظل» — عالم «بالإسلام» (اعتمده المالك ٢٢ نوفمبر، D190) بتصحيحاته وبمعايير «الحِرفة» (D189).
 * المراجع: خيال الظل العربي، وبابات ابن دانيال في القاهرة، والقرة قوز العثماني.
 * - نحن في الجمهور: الستارة تملأ الكادر، وقنديل زيت حقيقي على حافة المسرح يرتعش، ونوره من خلف الستارة يرتعش معه.
 * - الدمى جلد ملوّن شفاف يمر الضوء فيه (نسج القطن يظهر من خلفه، ووسطه أضوأ من حوافه) بثقوب زخرفية، على عصيّ تأتي
 *   من أسفل وخلف الستارة (لا خطافات من فوق)، وتتأرجح بعد كل حركة ثم تهدأ.
 * - «هندسة النور» ظلُّ مشربية على الستارة (نجمة ثمانية في قلبها مثمن) يكتمل قبل جملة التأمل وذكر الله، ويبقى ساكنًا
 *   فيها؛ ولا يتحرك فيها شيء (لا دمية ولا كاميرا ولا ارتعاش)، ولا يُضاف شيء بعدها لتعويضها.
 * - أربع لقطات بقطع (تفاصيل، واسعة، قريبة، متوسطة) مددها ٢–٥ ث، وعمق ميدان، وصوت مع كل حركة فوق صوت الغرفة.
 * بلا وجوه، وألوان «باء التشغيل» وحدها.
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useBrandFonts } from "../../useBrandFonts";
import { DepthOfField, Stage3D, calmAt, ease, flicker, lightsAt, orbit, safeKeys, swing, useAssetTextures, type CamState, type Light, type V3 } from "../../three";
import { BAA, DIR_SEC, DIR_STILL, DIR_WORDS, wordAt } from "./common";
import { figureShapes, type FigureVariant } from "./figure";

const SCREEN = { w: 9, h: 5.2, y: 2.6 };
const LAMP = { depth: 0.14, rate: 5, seed: 21 };
const CLOTH = new THREE.Color("#F2D2B0");
const span = (t: number, a: number, d: number) => Math.min(1, Math.max(0, (t - a) / d));

/** جلد مصبوغ يمر فيه الضوء: نسج القطن من خلفه، ووسطه أضوأ من حوافه، ولونه الصبغة مضروبة في نور الستارة */
const useLeather = (hex: string, weave: THREE.Texture) => useMemo(() => {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const g = c.getContext("2d")!;
  const dye = new THREE.Color(hex).multiply(CLOTH).multiplyScalar(1.15);
  const r = g.createRadialGradient(128, 110, 10, 128, 128, 180);
  r.addColorStop(0, `#${dye.clone().lerp(new THREE.Color("#FBF6EE"), 0.28).getHexString()}`);
  r.addColorStop(1, `#${dye.clone().multiplyScalar(0.72).getHexString()}`);
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  const img = weave.image as CanvasImageSource | undefined;
  if (img) { g.globalCompositeOperation = "multiply"; g.globalAlpha = 0.55; g.drawImage(img, 0, 0, 256, 256); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}, [hex, weave]);

/** دمية: حافة جلد داكنة (خيط) ثم الجلد الشفاف، ومفاصل بمسامير، والعصا من أسفل خلف الستارة */
const Puppet: React.FC<{ v: FigureVariant; leather: THREE.Texture; x: number; flip: boolean; arm: number; sway: number; light: number }> = ({ v, leather, x, flip, arm, sway, light }) => {
  const s = useMemo(() => figureShapes(v), [v]);
  const lum = 0.8 + 0.2 * light;
  const mat = <meshBasicMaterial map={leather} color={new THREE.Color(lum, lum, lum)} transparent opacity={0.96} side={THREE.DoubleSide} />;
  const edge = <meshBasicMaterial color="#1B1B1B" />;
  const part = (shape: THREE.Shape, z: number, m: React.ReactNode) => <mesh position={[0, 0, z]}><shapeGeometry args={[shape, 32]} />{m}</mesh>;
  return (
    <group position={[x, 0.35, 0.02]} scale={[flip ? -3.5 : 3.5, 3.5, 1]} rotation={[0, 0, sway]}>
      <group scale={[1.03, 1.012, 1]} position={[0, -0.004, -0.004]}>{part(s.robe, 0, edge)}{part(s.head, 0, edge)}{part(s.cap, 0, edge)}</group>
      {part(s.robe, 0, mat)}{part(s.head, 0.001, mat)}
      {part(s.cap, 0.002, <meshBasicMaterial color={new THREE.Color(BAA.gold).multiply(CLOTH).multiplyScalar(lum * 1.1)} transparent opacity={0.96} />)}
      <group position={[s.shoulder.x + 0.02, s.shoulder.y - 0.01, 0.003]} rotation={[0, 0, Math.PI + arm]}>
        {part(s.upper, 0, mat)}
        <group position={[0, 0.19, 0.001]} rotation={[0, 0, -arm * 0.3]}>{part(s.fore, 0, mat)}<mesh position={[0, 0, 0.002]}><circleGeometry args={[0.012, 12]} />{edge}</mesh>
        </group>
        <mesh position={[0, 0, 0.002]}><circleGeometry args={[0.013, 12]} />{edge}</mesh>
      </group>
      {/* عصا اليد: من موضع اليد عموديًا إلى أسفل خلف الستارة (لا خطاف من فوق) */}
      {(() => {
        const t1 = Math.PI + arm, t2 = t1 - arm * 0.3;
        const hx = s.shoulder.x + 0.02 - 0.19 * Math.sin(t1) - 0.19 * Math.sin(t2), hy = s.shoulder.y - 0.01 + 0.19 * Math.cos(t1) + 0.19 * Math.cos(t2);
        const bottom = -0.9, len = hy - bottom;
        return <mesh position={[hx, bottom + len / 2, -0.003]}><planeGeometry args={[0.006, len]} /><meshBasicMaterial color="#1B1B1B" transparent opacity={0.55} /></mesh>;
      })()}
      {/* عصا الجسد من أسفل، خلف الستارة: ظلها أخف من الجلد */}
      <mesh position={[0, -0.5, -0.003]}><planeGeometry args={[0.008, 1.1]} /><meshBasicMaterial color="#1B1B1B" transparent opacity={0.55} /></mesh>
    </group>
  );
};

/** دكان من جلد مثبت على الستارة (أشكال منفصلة) */
const stallShapes = () => {
  const rect = (x0: number, y0: number, x1: number, y1: number) => { const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.lineTo(x0, y0); return s; };
  const counter = rect(-0.9, 0, 0.9, 0.7);
  for (const x of [-0.45, 0, 0.45]) { const h = new THREE.Path(); h.absarc(x, 0.35, 0.12, 0, Math.PI * 2, true); counter.holes.push(h); }
  const awning = new THREE.Shape();
  awning.moveTo(-1.05, 1.9); awning.lineTo(1.05, 1.9);
  for (let k = 0; k <= 6; k++) awning.lineTo(1.05 - (k * 2.1) / 6, k % 2 ? 1.32 : 1.48);
  awning.lineTo(-1.05, 1.9);
  for (const x of [-0.6, 0, 0.6]) { const h = new THREE.Path(); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, r = k % 2 ? 0.035 : 0.07; k ? h.lineTo(x + r * Math.cos(a), 1.68 + r * Math.sin(a)) : h.moveTo(x + r, 1.68); } awning.holes.push(h); }
  return [counter, rect(-0.8, 0.7, -0.7, 1.5), rect(0.7, 0.7, 0.8, 1.5), awning];
};

/** ظل المشربية على الستارة: شبكة نجوم ثمانية ({٨/٢}: مربعان متراكبان) في قلب كل منها مثمن، بحواف ناعمة كظل حقيقي */
export const MASHRABIYA = { cell: 120, star: 0.92, octagon: 0.42 } as const;
const useMashrabiya = () => useMemo(() => {
  const W = 1536, H = 888, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!, { cell } = MASHRABIYA;
  g.fillStyle = "#1B1B1B"; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "destination-out"; g.filter = "blur(3px)";
  for (let y = cell / 2; y < H + cell; y += cell) for (let x = cell / 2; x < W + cell; x += cell) {
    const R = (cell / 2) * MASHRABIYA.star;
    // النجمة الثمانية: مربعان متراكبان (الثاني مدار ٤٥°)، والمثمن في القلب مفرغ أيضًا (يمر منه النور)
    for (const rot of [0, Math.PI / 4]) { g.beginPath(); for (let k = 0; k < 4; k++) { const a = rot + (k * Math.PI) / 2 + Math.PI / 4; k ? g.lineTo(x + R * Math.cos(a), y + R * Math.sin(a)) : g.moveTo(x + R * Math.cos(a), y + R * Math.sin(a)); } g.closePath(); g.fill(); }
  }
  g.globalCompositeOperation = "source-over"; g.fillStyle = "#1B1B1B";
  for (let y = cell / 2; y < H + cell; y += cell) for (let x = cell / 2; x < W + cell; x += cell) {
    // المثمن في القلب: حشوة خشب مخروطة (ظل)، وحولها النجمة نور
    const r = (cell / 2) * MASHRABIYA.octagon; g.beginPath();
    for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4 + Math.PI / 8; k ? g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)) : g.moveTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}, []);

/** القنديل: نحاس وزجاج ولهب يرتعش، على حافة المسرح أمام الستارة */
const OilLamp: React.FC<{ f: number }> = ({ f }) => (
  <group position={[-2.9, 0.3, 0.85]}>
    <mesh position={[0, 0.08, 0]} castShadow><cylinderGeometry args={[0.22, 0.28, 0.16, 32]} /><meshStandardMaterial color={BAA.gold} metalness={0.7} roughness={0.35} /></mesh>
    <mesh position={[0, 0.24, 0]} castShadow><sphereGeometry args={[0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={BAA.gold} metalness={0.7} roughness={0.35} /></mesh>
    <mesh position={[0.24, 0.26, 0]} rotation={[0, 0, -1.2]}><cylinderGeometry args={[0.03, 0.05, 0.22, 16]} /><meshStandardMaterial color={BAA.gold} metalness={0.7} roughness={0.35} /></mesh>
    <mesh position={[0.34, 0.36 + 0.02 * f, 0]} scale={[1, f, 1]}><coneGeometry args={[0.04, 0.17, 16]} /><meshBasicMaterial color={BAA.copper} toneMapped={false} /></mesh>
    <mesh position={[0.34, 0.33, 0]} scale={[1, f, 1]}><sphereGeometry args={[0.03, 12, 8]} /><meshBasicMaterial color={BAA.gold} toneMapped={false} /></mesh>
  </group>
);

type ShotCam = { target: V3; yaw: number; pitch: number; dist: number; fov: number };
export type TheaterShot = { id: string; size: "detail" | "wide" | "close" | "medium"; a: number; b: number; from: ShotCam; to: ShotCam; aperture: number };
/** اللقطات: الرابعة تبدأ قبل جملة الذكر وكاميرتها ساكنة فيها، ثم تقترب بعدها */
export const theaterShots = (): TheaterShot[] => {
  const s1 = 2.8, s2 = 4.9, s3 = DIR_STILL[0]![0] - 0.05;
  const wide: ShotCam = { target: [0, 2.45, 0], yaw: 0, pitch: -4, dist: 8.4, fov: 38 };
  return [
    { id: "leather", size: "detail", a: 0, b: s1, aperture: 0.03, from: { target: [-1.75, 1.55, 0], yaw: 10, pitch: 2, dist: 1.9, fov: 30 }, to: { target: [-1.6, 1.5, 0], yaw: 3, pitch: 2, dist: 1.6, fov: 30 } },
    { id: "audience", size: "wide", a: s1, b: s2, aperture: 0.006, from: wide, to: { ...wide, dist: 7.9 } },
    { id: "hands", size: "close", a: s2, b: s3, aperture: 0.02, from: { target: [0, 2.7, 0], yaw: -6, pitch: -2, dist: 3.6, fov: 32 }, to: { target: [0, 2.6, 0], yaw: 4, pitch: -2, dist: 3.3, fov: 32 } },
    { id: "contemplation", size: "medium", a: s3, b: DIR_SEC, aperture: 0.01, from: { target: [0, 2.5, 0], yaw: 0, pitch: -3, dist: 6.2, fov: 36 }, to: { target: [0, 2.5, 0], yaw: 0, pitch: -3, dist: 5.6, fov: 36 } },
  ];
};
const camOf = (s: TheaterShot, t: number): CamState & { focus: number } => {
  // اللقطة الأخيرة لا تتحرك إلا بعد نافذة السكون (مفتاح يبدأ بعدها)
  const [a, b] = s.id === "contemplation" ? [DIR_STILL[0]![1] + 0.1, s.b] : [s.a, s.b];
  const p = ease(span(t, a, b - a));
  const L = (x: number, y: number) => x + (y - x) * p;
  const c = { target: [L(s.from.target[0], s.to.target[0]), L(s.from.target[1], s.to.target[1]), L(s.from.target[2], s.to.target[2])] as V3, yaw: L(s.from.yaw, s.to.yaw), pitch: L(s.from.pitch, s.to.pitch), dist: L(s.from.dist, s.to.dist), fov: L(s.from.fov, s.to.fov) };
  return { position: orbit(c), target: c.target, fov: c.fov, focus: c.dist };
};

const SFX = (f: string) => staticFile(`three/sfx/${f}.mp3`);

export const ShadowTheaterLab: React.FC = () => {
  useBrandFonts();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const still = DIR_STILL;
  const cotton = useAssetTextures(["balislam-cotton-diff"], [3, 1.8]);
  const wood = useAssetTextures(["balislam-wood-diff"], [1, 3]);
  const weave = cotton?.[0];
  const copper = useLeather(BAA.copper, weave ?? new THREE.Texture());
  const rose = useLeather(BAA.rose, weave ?? new THREE.Texture());
  const emerald = useLeather(BAA.emerald, weave ?? new THREE.Texture());
  const stall = useMemo(stallShapes, []);
  const lattice = useMashrabiya();
  // بقعة نور السراج خلف الستارة: تدرّج ناعم بلا حافة
  const spot = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 192; const g = c.getContext("2d")!;
    const rg = g.createRadialGradient(128, 96, 0, 128, 96, 120); rg.addColorStop(0, "rgba(251,246,238,0.55)"); rg.addColorStop(1, "rgba(251,246,238,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 256, 192);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  }, []);
  const light = flicker(t, LAMP, still);
  const key = (a: number, d: number) => safeKeys([{ a, b: a + d, to: 1 }], still)[0]!;
  const prog = (k: { a: number; b: number }) => ease(span(t, k.a, k.b - k.a));
  const enterK = key(wordAt("رجلان") - 0.2, 1.0), marketK = key(wordAt("السوق") - 0.1, 0.8), say1K = key(wordAt("يقول") - 0.05, 0.5), say2K = key(wordAt("الحقُّ") - 0.05, 0.5);
  const enter = prog(enterK), market = prog(marketK), say1 = prog(say1K), say2 = prog(say2K);
  // المشربية: تكتمل قبل نافذة السكون بقليل، وتبقى
  const lattice01 = ease(span(t, still[0]![0] - 1.2, 1.0));
  // التأرجح بعد كل حركة، ولا تأرجح في السكون المقصود (calmAt)
  const calm = calmAt(t, still);
  const swayA = (swing(t, enterK.b, 0.05) + 0.015 * Math.sin(t * 2.1)) * calm;
  const swayB = (swing(t, enterK.b, -0.045, 1.4) + 0.015 * Math.sin(t * 2.1 + 2)) * calm;
  const arm1 = say1 * 1.15 + swing(t, say1K.b, 0.12, 2) * calm, arm2 = say2 * 1.0 + swing(t, say2K.b, 0.1, 2.2) * calm;
  const shots = theaterShots();
  const shot = shots.find((s) => t >= s.a && t < s.b) ?? shots[shots.length - 1]!;
  const cam = camOf(shot, t);
  if (!cotton || !wood) return null;
  const lights: Light[] = [
    { kind: "ambient", kelvin: 2600, intensity: 0.35, position: [0, 0, 0] },
    // نور القنديل على حافة المسرح والإطار (يرتعش مع لهبه)
    { kind: "practical", kelvin: 1900, intensity: 2.4, position: [-2.56, 0.75, 0.85], flicker: LAMP },
  ];
  const screenLum = 0.72 + 0.28 * light;
  return (
    <>
      <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, lights, still)} background={BAA.night} shadows="variance">
        <DepthOfField focus={cam.focus} aperture={shot.aperture} />
        {/* الستارة: نسج القطن الحقيقي يضيئه نور من خلفه، والبقعة الأضوأ تتبع ارتعاش السراج */}
        <mesh position={[0, SCREEN.y, -0.01]}><planeGeometry args={[SCREEN.w, SCREEN.h]} /><meshBasicMaterial map={weave} color={new THREE.Color(BAA.paper).multiplyScalar(screenLum)} /></mesh>
        <mesh position={[0.3 * Math.sin(t * 0.7) * calm, SCREEN.y - 0.4, -0.008]}><planeGeometry args={[8, 6]} /><meshBasicMaterial map={spot} transparent opacity={0.5 * light} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
        {/* ظل المشربية (يُضرب في نور الستارة) */}
        {lattice01 > 0 && <mesh position={[0, SCREEN.y, 0.001]}><planeGeometry args={[SCREEN.w, SCREEN.h]} /><meshBasicMaterial map={lattice} transparent opacity={0.42 * lattice01} depthWrite={false} /></mesh>}
        {/* إطار المسرح خشب حقيقي، وحافته التي يقف عليها القنديل */}
        {[[-SCREEN.w / 2 - 0.25, SCREEN.y, 0.5, SCREEN.h + 1.0], [SCREEN.w / 2 + 0.25, SCREEN.y, 0.5, SCREEN.h + 1.0], [0, SCREEN.y + SCREEN.h / 2 + 0.25, SCREEN.w + 1.0, 0.5]].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x!, y!, 0.05]}><boxGeometry args={[w!, h!, 0.3]} /><meshStandardMaterial map={wood[0]} color="#7A5A44" roughness={0.8} /></mesh>
        ))}
        <mesh position={[0, -0.15, 0.7]} receiveShadow><boxGeometry args={[SCREEN.w + 1.0, 0.3, 1.5]} /><meshStandardMaterial map={wood[0]} color="#7A5A44" roughness={0.8} /></mesh>
        <OilLamp f={light} />
        {/* الديكور على الستارة: دكانان يُثبتان عند «السوق» */}
        {[[-3.2, BAA.copper, copper], [3.25, BAA.emerald, emerald]].map(([x, , tex], i) => (
          <group key={i} position={[x as number, 0.35 + (1 - market) * -2.2, 0.008]} scale={i ? 0.95 : 1.05}>
            <mesh position={[0.02, -0.015, -0.002]}><shapeGeometry args={[stall, 24]} /><meshBasicMaterial color="#1B1B1B" /></mesh>
            <mesh><shapeGeometry args={[stall, 24]} /><meshBasicMaterial map={tex as THREE.Texture} color={new THREE.Color(screenLum, screenLum, screenLum)} transparent opacity={0.95} side={THREE.DoubleSide} /></mesh>
          </group>
        ))}
        <Puppet v={{ robe: 1, cap: "turban", stoop: 0 }} leather={copper} x={-4.9 + enter * 3.3} flip={false} arm={arm1} sway={swayA} light={light} />
        <Puppet v={{ robe: 1.12, cap: "kufiya", stoop: 0 }} leather={rose} x={4.9 - enter * 3.3} flip arm={arm2} sway={swayB} light={light} />
      </Stage3D>
      {/* صوت الغرفة (القنديل)، وصوت مع كل حركة: دخول الدمى، وتثبيت الدكاكين، ورفع الذراعين (D158) */}
      <Audio src={SFX("fire-crackle")} volume={(f) => 0.25 * calmAt(f / fps, still, 0.3) + 0.1} loop />
      <Sequence from={Math.round(enterK.a * fps)} durationInFrames={40}><Audio src={SFX("paper-crumple")} volume={0.35} /></Sequence>
      <Sequence from={Math.round(marketK.a * fps)} durationInFrames={20}><Audio src={SFX("drop-soft")} volume={0.45} /></Sequence>
      <Sequence from={Math.round(say1K.a * fps)} durationInFrames={20}><Audio src={SFX("tick")} volume={0.4} /></Sequence>
      <Sequence from={Math.round(say2K.a * fps)} durationInFrames={20}><Audio src={SFX("tick")} volume={0.4} /></Sequence>
      <CalmLine t={t} />
    </>
  );
};

/** الترجمة سطر هادئ بخط القناة بلا تلوين ولا قفز (D187) */
const STARTS = [0, 4, 9];
const CalmLine: React.FC<{ t: number }> = ({ t }) => {
  const si = Math.max(0, STARTS.filter((x) => DIR_WORDS[x]!.s - 0.15 <= t).length - 1);
  const words = DIR_WORDS.slice(STARTS[si], STARTS[si + 1] ?? DIR_WORDS.length);
  if (t < DIR_WORDS[0]!.s - 0.15) return null;
  const fade = Math.min(1, Math.max(0, (t - words[0]!.s + 0.15) / 0.13));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", bottom: 56, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ opacity: fade, background: "rgba(14,26,43,0.6)", color: BAA.paper, padding: "8px 28px", borderRadius: 10, fontFamily: "IBM Plex Sans Arabic", fontWeight: 500, fontSize: 52, direction: "rtl" }}>
          {words.map((w) => w.w).join(" ")}
        </div>
      </div>
    </AbsoluteFill>
  );
};
