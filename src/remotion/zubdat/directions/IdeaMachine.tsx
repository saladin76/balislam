/**
 * «الأفكار آلات» — عالم «زبدة الكتب» (اعتمده المالك ٢٢ نوفمبر، D190) بأسلوب مخطوطة الجزري (كتاب في معرفة الحيل
 * الهندسية، ١٢٠٦) وبمعايير «الحِرفة» (D189): ألوان المخطوطة (أحمر وأخضر وذهبي)، والأسماء بالحبر الأحمر بخط النسخ،
 * وخامات نحاس وخشب، **بلا فسفوري** (D188). ورقة مخطوطة مثبتة خلف الآلة، والآلة على طاولة خشب حقيقية.
 * الحكاية آلة: خزان نحاسي يقطر في كفّة على ذراع («يصلّي… يشعر»)، فتثقل فيميل الذراع («ينتظر»)، فيدير ذراعُ التوصيل
 * ترسين («الشعور… قبل»)، فيرفعان لوح «الحضور» بالحبر الأحمر في إطار ذهبي. ثم جملة ذكر الله: يسكن كل شيء.
 * أربع لقطات بقطع (تفاصيل، متوسطة، قريبة، واسعة) مددها ٢–٦ ث، وعمق ميدان، وتأرجح بعد الحركة، وصوت مع كل حركة.
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useBrandFonts } from "../../useBrandFonts";
import { BeamDust, DepthOfField, Stage3D, calmAt, ease, lightsAt, orbit, safeKeys, swing, useAssetTextures, type CamState, type Light, type V3 } from "../../three";
import { IDEA, ZSTARTS, ZWORDS, Z_SEC, Z_STILL, zAt } from "./common";

/** ألوان المخطوطة المقيّدة لهذا العالم (D188) مع أبيض الهوية وحبرها */
export const JAZARI = { red: "#A8322A", green: "#2F6B4F", gold: "#C9A24A", wood: "#7A5230", ink: "#111111", paper: "#F1EDE4", paperDeep: "#EDE7DA", grey: "#4A4A4A" } as const;
const J = JAZARI;
const span = (t: number, a: number, d: number) => Math.min(1, Math.max(0, (t - a) / d));
const BRASS = <meshStandardMaterial color={J.gold} metalness={0.75} roughness={0.32} />;

const gearShape = (r: number, teeth: number) => {
  const s = new THREE.Shape();
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2, a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2, rr = i % 2 ? r : r * 1.14;
    if (i === 0) s.moveTo(rr * Math.cos(a0), rr * Math.sin(a0)); else s.lineTo(rr * Math.cos(a0), rr * Math.sin(a0));
    s.lineTo(rr * Math.cos(a1), rr * Math.sin(a1));
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.22, 0, Math.PI * 2, true); s.holes.push(hole);
  for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2 + Math.PI / 4, h = new THREE.Path(); h.absarc(r * 0.58 * Math.cos(a), r * 0.58 * Math.sin(a), r * 0.16, 0, Math.PI * 2, true); s.holes.push(h); }
  return s;
};
const Gear: React.FC<{ r: number; teeth: number; pos: V3; angle: number }> = ({ r, teeth, pos, angle }) => {
  const shape = useMemo(() => gearShape(r, teeth), [r, teeth]);
  return <mesh position={pos} rotation={[0, 0, angle]} castShadow><extrudeGeometry args={[shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }]} />{BRASS}</mesh>;
};

/** ورقة المخطوطة خلف الآلة: إطار أحمر وأخضر وذهبي، وعنوان بالحبر الأحمر بالنسخ، ورسم الآلة نفسها خطوطًا */
const useFolio = (ready: boolean) => useMemo(() => {
  const W = 2048, H = 1152, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d")!;
  g.fillStyle = J.paper; g.fillRect(0, 0, W, H);
  g.strokeStyle = J.red; g.lineWidth = 10; g.strokeRect(60, 60, W - 120, H - 120);
  g.strokeStyle = J.gold; g.lineWidth = 18; g.strokeRect(86, 86, W - 172, H - 172);
  g.strokeStyle = J.green; g.lineWidth = 6; g.strokeRect(112, 112, W - 224, H - 224);
  g.direction = "rtl"; g.textAlign = "center"; g.fillStyle = J.red; g.font = "bold 110px Amiri"; g.fillText("في معرفة الحيل", W / 2, 260);
  g.fillStyle = J.ink; g.font = "60px Amiri"; g.fillText("صورة الآلة التي يقطر فيها الماء فيدور بها الترس", W / 2, 360);
  // رسم الآلة على الورقة بالحبر (كما في المخطوطة)، أخف من الآلة نفسها
  g.globalAlpha = 0.35; g.strokeStyle = J.ink; g.lineWidth = 5;
  g.strokeRect(300, 480, 220, 160); g.beginPath(); g.moveTo(420, 760); g.lineTo(900, 700); g.stroke();
  for (const [x, y, r] of [[1180, 720, 150], [1440, 600, 105]] as const) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); }
  g.globalAlpha = 1; g.fillStyle = J.red; g.font = "64px Amiri"; g.fillText("الحوض", 410, 450); g.fillText("الكفّة", 520, 860); g.fillText("الدولاب", 1300, 930);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}, [ready]);

/** بطاقة اسم بالحبر الأحمر بالنسخ على رقعة ورق (تُقرأ على هاتف) */
const useTag = (ready: boolean, text: string, big = false) => useMemo(() => {
  const c = document.createElement("canvas"); c.width = 512; c.height = big ? 256 : 160; const g = c.getContext("2d")!;
  g.fillStyle = J.paper; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = big ? J.gold : J.red; g.lineWidth = big ? 16 : 6; g.strokeRect(big ? 10 : 4, big ? 10 : 4, c.width - (big ? 20 : 8), c.height - (big ? 20 : 8));
  if (big) { g.strokeStyle = J.green; g.lineWidth = 4; g.strokeRect(30, 30, c.width - 60, c.height - 60); }
  g.fillStyle = J.red; g.font = `bold ${big ? 150 : 100}px Amiri`; g.textAlign = "center"; g.direction = "rtl"; g.fillText(text, 256, big ? 180 : 115);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}, [ready, text, big]);

type ShotCam = { target: V3; yaw: number; pitch: number; dist: number; fov: number };
export type MachineShot = { id: string; size: "detail" | "medium" | "close" | "wide"; a: number; b: number; from: ShotCam; to: ShotCam; aperture: number };
export const machineShots = (): MachineShot[] => {
  const s1 = 3.4, s2 = 5.5, s3 = Z_STILL[0]![0] - 0.05;
  const wide: ShotCam = { target: [0.2, 1.4, 0], yaw: -12, pitch: 8, dist: 8.6, fov: 34 };
  return [
    { id: "drops", size: "detail", a: 0, b: s1, aperture: 0.025, from: { target: [-2.3, 2.6, 0.05], yaw: 18, pitch: 4, dist: 2.6, fov: 30 }, to: { target: [-2.3, 2.45, 0.05], yaw: 10, pitch: 3, dist: 2.3, fov: 30 } },
    { id: "lever", size: "medium", a: s1, b: s2, aperture: 0.014, from: { target: [-1.2, 1.5, 0], yaw: -18, pitch: 10, dist: 4.4, fov: 32 }, to: { target: [-0.8, 1.5, 0], yaw: -8, pitch: 10, dist: 4.0, fov: 32 } },
    { id: "gears", size: "close", a: s2, b: s3, aperture: 0.022, from: { target: [1.4, 2.0, 0], yaw: 14, pitch: 4, dist: 3.0, fov: 32 }, to: { target: [1.9, 2.5, 0], yaw: 6, pitch: 2, dist: 2.7, fov: 32 } },
    { id: "folio", size: "wide", a: s3, b: Z_SEC, aperture: 0.006, from: wide, to: { ...wide, dist: 7.9, yaw: -6 } },
  ];
};
const camOf = (s: MachineShot, t: number): CamState & { focus: number } => {
  // اللقطة الأخيرة ساكنة في جملة الذكر، وتقترب بعدها
  const [a, b] = s.id === "folio" ? [Z_STILL[0]![1] + 0.1, s.b] : [s.a, s.b];
  const p = ease(span(t, a, b - a));
  const L = (x: number, y: number) => x + (y - x) * p;
  const c = { target: [L(s.from.target[0], s.to.target[0]), L(s.from.target[1], s.to.target[1]), L(s.from.target[2], s.to.target[2])] as V3, yaw: L(s.from.yaw, s.to.yaw), pitch: L(s.from.pitch, s.to.pitch), dist: L(s.from.dist, s.to.dist), fov: L(s.from.fov, s.to.fov) };
  return { position: orbit(c), target: c.target, fov: c.fov, focus: c.dist };
};

const SFX = (f: string) => staticFile(`three/sfx/${f}.mp3`);

export const IdeaMachineLab: React.FC = () => {
  const ready = useBrandFonts();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const still = Z_STILL;
  const wood = useAssetTextures(["zubdat-wood-diff", "zubdat-wood-nor"], [3, 2]);
  const wall = useAssetTextures(["zubdat-plaster-nor"], [3, 1.5]);
  const folio = useFolio(ready);
  const tags = { water: useTag(ready, "الحوض"), cup: useTag(ready, "الكفّة"), gear: useTag(ready, "الدولاب") };
  const idea = useTag(ready, IDEA, true);
  const key = (a: number, d: number) => safeKeys([{ a, b: a + d, to: 1 }], still)[0]!;
  const dripK = key(zAt("يصلّي") - 0.1, zAt("يشعر") - zAt("يصلّي") + 0.7);
  const tipK = key(zAt("ينتظر") - 0.1, 0.7);
  const turnK = key(zAt("الشعور") - 0.1, zAt(IDEA) - zAt("الشعور") + 0.2);
  const riseK = key(zAt(IDEA) - 0.05, 0.7);
  const fill = span(t, dripK.a, dripK.b - dripK.a);
  const calm = calmAt(t, still);
  const lever = -0.28 + ease(span(t, tipK.a, tipK.b - tipK.a)) * 0.5 + swing(t, tipK.b, 0.06, 1.8) * calm;
  const turn = ease(span(t, turnK.a, turnK.b - turnK.a));
  const rise = ease(span(t, riseK.a, riseK.b - riseK.a));
  const boardSway = swing(t, riseK.b, 0.08, 1.6) * calm;
  // قطرات حتمية ما دام التقطير، وتقف قبل جملة الذكر
  const drops: number[] = [];
  if (t > dripK.a && t < dripK.b) for (let k = 0; k < 4; k++) { const ph = ((t - dripK.a) / 0.22 - k) % 2; if (ph >= 0 && ph < 1.8) drops.push(Math.min(1, ph / 1.8)); }
  const shots = machineShots();
  const shot = shots.find((s) => t >= s.a && t < s.b) ?? shots[shots.length - 1]!;
  const cam = camOf(shot, t);
  if (!wood || !wall) return null;
  const lights: Light[] = [
    { kind: "ambient", kelvin: 4200, intensity: 0.85, position: [0, 0, 0] },
    { kind: "key", kelvin: 4800, intensity: 2.4, position: [-5, 8, 5] },
  ];
  const tip: [number, number] = [-1.4 + 1.2 * Math.cos(lever), 1.65 + 1.2 * Math.sin(lever)];
  const pin: [number, number] = [0.6 + 0.4 * Math.cos(Math.PI + turn * Math.PI * 1.2), 1.5 + 0.4 * Math.sin(Math.PI + turn * Math.PI * 1.2)];
  const rod = { dx: pin[0] - tip[0], dy: pin[1] - tip[1] };
  const boardY = 1.0 + rise * 1.5;
  return (
    <>
      <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, lights, still)} background={J.paperDeep} shadows="variance">
        <DepthOfField focus={cam.focus} aperture={shot.aperture} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[30, 20]} /><meshStandardMaterial map={wood[0]} normalMap={wood[1]} color="#BDBDBD" roughness={0.7} /></mesh>
        <mesh position={[0, 5, -2.2]} receiveShadow><planeGeometry args={[30, 12]} /><meshStandardMaterial normalMap={wall[0]} color={J.paper} roughness={1} /></mesh>
        {/* ورقة المخطوطة مثبتة على الجدار خلف الآلة */}
        <mesh position={[0.2, 2.6, -2.15]} receiveShadow><planeGeometry args={[6.4, 3.6]} /><meshStandardMaterial map={folio} roughness={0.95} /></mesh>
        <BeamDust t={t} from={[-5, 7.5, 4.5]} to={[0, 1.0, 0]} radius={1.0} color={J.paper} count={90} still={still} seed={13} />
        {/* الحوض النحاسي على عمود خشب، والصنبور */}
        <mesh position={[-3.2, 1.5, 0]} castShadow><boxGeometry args={[0.16, 3.0, 0.16]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" /></mesh>
        <mesh position={[-3.0, 3.6, 0]} castShadow><cylinderGeometry args={[0.5, 0.42, 0.9, 40]} />{BRASS}</mesh>
        <mesh position={[-2.5, 3.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.05, 0.05, 0.55, 16]} />{BRASS}</mesh>
        {drops.map((p, i) => <mesh key={i} position={[-2.23, 3.1 - p * 1.0, 0]}><sphereGeometry args={[0.045, 12, 8]} /><meshPhysicalMaterial color={J.paper} transmission={0.9} roughness={0.05} thickness={0.1} /></mesh>)}
        {/* الذراع الخشبي على محوره، والكفّة النحاسية على طرفه */}
        <mesh position={[-1.4, 0.8, 0]} castShadow><boxGeometry args={[0.18, 1.6, 0.3]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" /></mesh>
        <group position={[-1.4, 1.65, 0]} rotation={[0, 0, lever]}>
          <mesh castShadow><boxGeometry args={[2.4, 0.09, 0.2]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" /></mesh>
          <group position={[-0.9, 0.32, 0]}>
            <mesh castShadow><cylinderGeometry args={[0.3, 0.22, 0.5, 32, 1, true]} /><meshStandardMaterial color={J.gold} metalness={0.75} roughness={0.32} side={THREE.DoubleSide} /></mesh>
            <mesh position={[0, -0.24 + fill * 0.4, 0]}><cylinderGeometry args={[0.22 + fill * 0.07, 0.22, 0.01, 32]} /><meshPhysicalMaterial color={J.paper} transmission={0.6} roughness={0.05} /></mesh>
          </group>
        </group>
        <mesh position={[(tip[0] + pin[0]) / 2, (tip[1] + pin[1]) / 2, 0.14]} rotation={[0, 0, Math.atan2(rod.dy, rod.dx)]} castShadow><boxGeometry args={[Math.hypot(rod.dx, rod.dy), 0.05, 0.05]} />{BRASS}</mesh>
        <Gear r={0.6} teeth={12} pos={[0.6, 1.5, -0.1]} angle={turn * Math.PI * 1.2} />
        <Gear r={0.42} teeth={8} pos={[1.75, 2.05, -0.1]} angle={-turn * Math.PI * 1.2 * (0.6 / 0.42) + 0.2} />
        <mesh position={[0.6, 0.75, -0.15]} castShadow><boxGeometry args={[0.14, 1.5, 0.14]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" /></mesh>
        <mesh position={[1.75, 1.0, -0.15]} castShadow><boxGeometry args={[0.14, 2.05, 0.14]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" /></mesh>
        {/* لوح الفكرة يرتفع على ساقه ويتأرجح قليلًا ثم يهدأ */}
        <mesh position={[2.9, boardY / 2, 0.05]} castShadow><boxGeometry args={[0.07, boardY, 0.07]} />{BRASS}</mesh>
        <group position={[2.9, boardY + 0.5, 0.12]} rotation={[0, 0, boardSway]}>
          <mesh castShadow><boxGeometry args={[1.9, 0.95, 0.06]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" /></mesh>
          <mesh position={[0, 0, 0.031]}><planeGeometry args={[1.8, 0.86]} /><meshStandardMaterial map={idea} roughness={0.9} /></mesh>
        </group>
        {/* أسماء الأجزاء بالحبر الأحمر بالنسخ */}
        {[{ tex: tags.water, at: [-3.0, 4.3, 0.3] }, { tex: tags.cup, at: [-2.3, 0.75, 0.55] }, { tex: tags.gear, at: [0.6, 0.55, 0.55] }].map((l, i) => (
          <mesh key={i} position={l.at as V3} rotation={[-0.2, 0, 0]}><planeGeometry args={[1.2, 0.38]} /><meshStandardMaterial map={l.tex} roughness={0.9} /></mesh>
        ))}
      </Stage3D>
      {/* صوت الورشة الخافت، ومع كل حركة صوتها (D158): القطر، وميل الذراع، ودوران الترس، وارتفاع اللوح */}
      <Audio src={SFX("silence-room")} volume={0.3} loop />
      {Array.from({ length: 6 }, (_, k) => dripK.a + 0.2 + k * ((dripK.b - dripK.a - 0.4) / 6)).map((x, i) => <Sequence key={i} from={Math.round(x * fps)} durationInFrames={15}><Audio src={SFX("water-drop")} volume={0.45} /></Sequence>)}
      <Sequence from={Math.round(tipK.a * fps)} durationInFrames={25}><Audio src={SFX("drop-soft")} volume={0.5} /></Sequence>
      <Sequence from={Math.round(turnK.a * fps)} durationInFrames={Math.round((turnK.b - turnK.a) * fps)}><Audio src={SFX("gears")} volume={0.55} /></Sequence>
      <Sequence from={Math.round(riseK.b * fps)} durationInFrames={15}><Audio src={SFX("tick")} volume={0.5} /></Sequence>
      <ZCalm t={t} />
    </>
  );
};

/** الترجمة سطر هادئ بخط القناة بلا تلوين ولا قفز (D187) */
const ZCalm: React.FC<{ t: number }> = ({ t }) => {
  const si = Math.max(0, ZSTARTS.filter((x) => ZWORDS[x]!.s - 0.15 <= t).length - 1);
  const words = ZWORDS.slice(ZSTARTS[si], ZSTARTS[si + 1] ?? ZWORDS.length);
  if (t < ZWORDS[0]!.s - 0.15) return null;
  const fade = Math.min(1, Math.max(0, (t - words[0]!.s + 0.15) / 0.13));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", bottom: 56, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ opacity: fade, background: "rgba(17,17,17,0.6)", color: J.paper, padding: "8px 28px", borderRadius: 10, fontFamily: "Tajawal", fontWeight: 500, fontSize: 52, direction: "rtl" }}>
          {words.map((w) => w.w).join(" ")}
        </div>
      </div>
    </AbsoluteFill>
  );
};
