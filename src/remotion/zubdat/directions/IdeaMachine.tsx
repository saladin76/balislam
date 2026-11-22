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
import { BeamDust, DepthOfField, Stage3D, calmAt, ease, lightsAt, orbit, safeKeys, swing, useAssetTextures, type CamState, type Light, type V3 , CAPTION_SHADOW, noise1 } from "../../three";
import { IDEA, ZSTARTS, ZWORDS, Z_SEC, Z_STILL, zAt } from "./common";

/** ألوان المخطوطة المقيّدة لهذا العالم (D188) مع أبيض الهوية وحبرها */
export const JAZARI = { red: "#A8322A", green: "#2F6B4F", gold: "#C9A24A", wood: "#7A5230", ink: "#111111", paper: "#F1EDE4", paperDeep: "#EDE7DA", grey: "#4A4A4A" } as const;
const J = JAZARI;
const span = (t: number, a: number, d: number) => Math.min(1, Math.max(0, (t - a) / d));
/** نحاس بأثر استعمال: بقع أكسدة داكنة متفاوتة، ولمعة حيث تمسّه اليد، وخدوش دقيقة (حتمي، بلا عشوائية) */
const useWornBrass = () => useMemo(() => {
  const N = 512, c = document.createElement("canvas"); c.width = N; c.height = N; const g = c.getContext("2d")!;
  const r = document.createElement("canvas"); r.width = N; r.height = N; const h = r.getContext("2d")!;
  g.fillStyle = J.gold; g.fillRect(0, 0, N, N); h.fillStyle = "rgb(95,95,95)"; h.fillRect(0, 0, N, N);
  for (let i = 0; i < 260; i++) {
    const x = (noise1(41, i * 1.3) + 1) / 2 * N, y = (noise1(42, i * 2.1) + 1) / 2 * N, rad = 6 + Math.abs(noise1(43, i * 0.7)) * 34, a = 0.05 + Math.abs(noise1(44, i)) * 0.16;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(74,52,18,${a})`); gr.addColorStop(1, "rgba(74,52,18,0)");
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    h.fillStyle = `rgba(190,190,190,${a * 1.6})`; h.beginPath(); h.arc(x, y, rad * 0.8, 0, Math.PI * 2); h.fill();
  }
  // لمعة الاستعمال: شريط أفتح وأنعم في الوسط حيث تمسك اليد
  const band = g.createLinearGradient(0, N * 0.35, 0, N * 0.65); band.addColorStop(0, "rgba(241,237,228,0)"); band.addColorStop(0.5, "rgba(241,237,228,0.16)"); band.addColorStop(1, "rgba(241,237,228,0)");
  g.fillStyle = band; g.fillRect(0, 0, N, N); h.fillStyle = "rgba(40,40,40,0.35)"; h.fillRect(0, N * 0.42, N, N * 0.16);
  g.strokeStyle = "rgba(241,237,228,0.22)"; g.lineWidth = 1;
  for (let i = 0; i < 70; i++) { const x = (noise1(45, i * 1.9) + 1) / 2 * N, y = (noise1(46, i * 1.1) + 1) / 2 * N, L = 10 + Math.abs(noise1(47, i)) * 40, a = noise1(48, i) * 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const rough = new THREE.CanvasTexture(r); rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map, roughnessMap: rough, color: "#FFFFFF", metalness: 0.8, roughness: 1, side: THREE.DoubleSide });
}, []);

/**
 * ترس بأسنان حقيقية: دائرة خطوة نصف قطرها r، ومقاس m = 2r/عدد الأسنان، ورأس السن على r+m وجذره على r−1.25m،
 * والسن شبه منحرف أضيق عند رأسه؛ وستة أذرع بينها فتحات كما في رسوم المخطوطة. الترسان المتعشّقان بالمقاس نفسه.
 */
export const gearShape = (r: number, teeth: number) => {
  const m = (2 * r) / teeth, tip = r + m, root = r - 1.25 * m, p = (Math.PI * 2) / teeth;
  const s = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const c = i * p, pts: [number, number][] = [[root, c - 0.3 * p], [r, c - 0.24 * p], [tip, c - 0.14 * p], [tip, c + 0.14 * p], [r, c + 0.24 * p], [root, c + 0.3 * p], [root, c + 0.5 * p]];
    pts.forEach(([rr, a], k) => (i === 0 && k === 0 ? s.moveTo(rr * Math.cos(a), rr * Math.sin(a)) : s.lineTo(rr * Math.cos(a), rr * Math.sin(a))));
  }
  s.closePath();
  const hub = new THREE.Path(); hub.absarc(0, 0, r * 0.12, 0, Math.PI * 2, true); s.holes.push(hub);
  const rin = r * 0.3, rout = root - m * 0.9, w = 0.17;
  for (let k = 0; k < 6; k++) {
    const a0 = (k * Math.PI) / 3 + w, a1 = ((k + 1) * Math.PI) / 3 - w, h = new THREE.Path();
    h.absarc(0, 0, rout, a0, a1, false); h.absarc(0, 0, rin, a1, a0, true); h.closePath(); s.holes.push(h);
  }
  return s;
};
const Gear: React.FC<{ r: number; teeth: number; pos: V3; angle: number; mat: THREE.Material }> = ({ r, teeth, pos, angle, mat }) => {
  const shape = useMemo(() => gearShape(r, teeth), [r, teeth]);
  return (
    <group position={pos} rotation={[0, 0, angle]}>
      <mesh castShadow material={mat}><extrudeGeometry args={[shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 24 }]} /></mesh>
      <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]} castShadow material={mat}><cylinderGeometry args={[r * 0.12, r * 0.12, 0.32, 20]} /></mesh>
    </group>
  );
};

/** حبل من نقطة إلى نقطة (كتان مفتول بلون الخشب) */
const Cord: React.FC<{ a: [number, number]; b: [number, number]; z: number }> = ({ a, b, z }) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z]} rotation={[0, 0, Math.atan2(dy, dx) - Math.PI / 2]} castShadow><cylinderGeometry args={[0.011, 0.011, Math.hypot(dx, dy), 8]} /><meshStandardMaterial color={J.wood} roughness={0.95} /></mesh>;
};
/** بكرة خشب بحافة نحاس تدور بقدر ما يمر عليها الحبل */
const Pulley: React.FC<{ at: [number, number]; z: number; r: number; angle: number; mat: THREE.Material; wood: THREE.Texture }> = ({ at, z, r, angle, mat, wood }) => (
  <group position={[at[0], at[1], z]} rotation={[0, 0, angle]}>
    <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[r, r, 0.07, 32]} /><meshStandardMaterial map={wood} color="#BDBDBD" roughness={0.8} /></mesh>
    <mesh castShadow material={mat}><torusGeometry args={[r, 0.018, 8, 40]} /></mesh>
    <mesh position={[r * 0.55, 0, 0.04]} material={mat}><boxGeometry args={[r * 0.5, 0.025, 0.01]} /></mesh>
  </group>
);

/** خيط الماء في القناة: تموجات تجري مع الزمن (تُرى حركة الماء لا لونه) */
const useRipples = () => useMemo(() => {
  const c = document.createElement("canvas"); c.width = 256; c.height = 32; const g = c.getContext("2d")!;
  g.fillStyle = J.paper; g.fillRect(0, 0, 256, 32);
  for (let i = 0; i < 18; i++) { const x = (i / 18) * 256 + noise1(51, i) * 6; g.fillStyle = `rgba(47,107,79,${0.25 + Math.abs(noise1(52, i)) * 0.25})`; g.fillRect(x, 2 + Math.abs(noise1(53, i)) * 22, 8 + Math.abs(noise1(54, i)) * 10, 3); g.fillStyle = "rgba(255,255,255,0.8)"; g.fillRect(x + 3, 6 + Math.abs(noise1(55, i)) * 18, 5, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}, []);

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
  g.globalAlpha = 1; g.fillStyle = J.red; g.font = "64px Amiri"; g.fillText("الحوض", 410, 450); g.fillText("الكفّة", 520, 860); g.fillText("الدولاب", 1300, 930); g.fillText("البكرة", 1640, 470);
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
  const wide: ShotCam = { target: [0, 2.6, 0], yaw: -12, pitch: 8, dist: 10.4, fov: 34 };
  return [
    // الحوض والعوّامة والقناة والقطر: تفصيلة تنزل مع الماء من الحوض إلى فم القناة
    { id: "drops", size: "detail", a: 0, b: s1, aperture: 0.022, from: { target: [-3.5, 4.1, 0.05], yaw: 20, pitch: 36, dist: 3.1, fov: 30 }, to: { target: [-2.6, 3.0, 0.05], yaw: 10, pitch: 28, dist: 2.7, fov: 30 } },
    { id: "lever", size: "medium", a: s1, b: s2, aperture: 0.014, from: { target: [-1.4, 2.0, 0], yaw: -18, pitch: 10, dist: 4.6, fov: 32 }, to: { target: [-1.0, 2.0, 0], yaw: -8, pitch: 10, dist: 4.2, fov: 32 } },
    // الترسان ثم الحبل: الكاميرا تتبع الحبل صاعدًا إلى البكرتين واللوح (حركة لها سبب)
    { id: "gears", size: "close", a: s2, b: s3, aperture: 0.02, from: { target: [1.2, 2.2, 0], yaw: 14, pitch: 4, dist: 3.0, fov: 32 }, to: { target: [2.3, 3.2, 0.1], yaw: 6, pitch: 2, dist: 3.4, fov: 32 } },
    { id: "folio", size: "wide", a: s3, b: Z_SEC, aperture: 0.006, from: wide, to: { ...wide, dist: 9.7, yaw: -6 } },
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

/** هندسة الآلة (وحدات المشهد): مواضع ثابتة تُختبر (الترسان متعشّقان، والحبل يلتف على الأسطوانة بقدر ما يرتفع اللوح) */
export const MACHINE = {
  tank: { x: -3.8, y: 3.95, h: 0.9 },
  trough: { from: [-3.2, 3.58] as [number, number], to: [-2.15, 2.85] as [number, number] },
  lever: { pivot: [-1.4, 1.65] as [number, number], cup: -0.9, arm: 1.2 },
  g1: { r: 0.6, teeth: 24, at: [0.6, 1.5] as [number, number], crank: 0.4, sweep: Math.PI * 1.2 },
  g2: { r: 0.4, teeth: 16, at: [0.6 + 1.0 * Math.cos(Math.PI / 6), 1.5 + 1.0 * Math.sin(Math.PI / 6)] as [number, number] },
  drum: 0.18, pulleyR: 0.12, boardX: 2.9, boardTop0: 2.4, z: 0.22,
};
const M = MACHINE;
/** زاوية الترس الصغير: نسبة الأسنان، وطور يضع سنّ الكبير في فجوة الصغير عند خط التماس (٣٠°) */
export const g2Angle = (a1: number) => -a1 * (M.g1.teeth / M.g2.teeth) + (198.75 - 22.5 * 8) * (Math.PI / 180);

export const IdeaMachineLab: React.FC = () => {
  const ready = useBrandFonts();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const still = Z_STILL;
  const wood = useAssetTextures(["zubdat-wood-diff", "zubdat-wood-nor"], [3, 2]);
  const wall = useAssetTextures(["zubdat-plaster-nor"], [3, 1.5]);
  const folio = useFolio(ready);
  const brass = useWornBrass();
  const ripples = useRipples();
  const tags = { water: useTag(ready, "الحوض"), float: useTag(ready, "العوّامة"), cup: useTag(ready, "الكفّة"), gear: useTag(ready, "الدولاب"), pulley: useTag(ready, "البكرة") };
  const idea = useTag(ready, IDEA, true);
  const key = (a: number, d: number) => safeKeys([{ a, b: a + d, to: 1 }], still)[0]!;
  const dripK = key(zAt("يصلّي") - 0.1, zAt("يشعر") - zAt("يصلّي") + 0.7);
  const tipK = key(zAt("ينتظر") - 0.1, 0.7);
  const turnK = key(zAt("الشعور") - 0.1, zAt(IDEA) - zAt("الشعور") + 0.2);
  const riseK = key(turnK.b, 0.3);
  const fill = span(t, dripK.a, dripK.b - dripK.a);
  const calm = calmAt(t, still);
  // الماء يجري في القناة ما دام التقطير، ويخفت عند آخره
  const flow = Math.min(span(t, dripK.a - 0.3, 0.3), 1 - span(t, dripK.b - 0.2, 0.3));
  ripples.offset.x = -t * 1.6 * calmAt(t, still, 0.2);
  const lever = -0.28 + ease(span(t, tipK.a, tipK.b - tipK.a)) * 0.5 + swing(t, tipK.b, 0.06, 1.8) * calm;
  const turn = ease(span(t, turnK.a, turnK.b - turnK.a));
  const a1 = turn * M.g1.sweep, a2 = g2Angle(a1);
  const wound = M.drum * Math.abs(a2 - g2Angle(0));
  const boardSway = swing(t, riseK.b, 0.07, 1.3) * calm;
  const shots = machineShots();
  const shot = shots.find((s) => t >= s.a && t < s.b) ?? shots[shots.length - 1]!;
  const cam = camOf(shot, t);
  if (!wood || !wall) return null;
  const lights: Light[] = [
    { kind: "ambient", kelvin: 4200, intensity: 0.85, position: [0, 0, 0] },
    { kind: "key", kelvin: 4800, intensity: 2.4, position: [-5, 8, 5] },
  ];
  // الكفّة في العالم (طرف الذراع)، وسطح مائها
  const [px, py] = M.lever.pivot;
  const toWorld = (lx: number, ly: number): [number, number] => [px + lx * Math.cos(lever) - ly * Math.sin(lever), py + lx * Math.sin(lever) + ly * Math.cos(lever)];
  const cupWater = toWorld(M.lever.cup, 0.32 - 0.24 + fill * 0.4);
  // قطرات تتكوّن عند فم القناة ثم تسقط بالجاذبية إلى الكفّة، وتموجة صغيرة حيث تقع
  const lip = M.trough.to, period = 0.42, fallT = 0.3;
  const drops: { y: number; s: number }[] = [], rings: number[] = [];
  if (t > dripK.a && t < dripK.b + fallT) for (let k = 0; k < 40; k++) {
    const t0 = dripK.a + k * period; if (t0 > dripK.b) break;
    const ph = t - t0;
    if (ph >= 0 && ph < period - fallT) drops.push({ y: lip[1] - 0.04, s: 0.4 + 0.6 * (ph / (period - fallT)) });
    else if (ph >= period - fallT && ph < period) { const q = (ph - (period - fallT)) / fallT; drops.push({ y: lip[1] - 0.04 - q * q * (lip[1] - 0.04 - cupWater[1]), s: 1 }); }
    else if (ph >= period && ph < period + 0.35) rings.push((ph - period) / 0.35);
  }
  // العوّامة تنزل مع منسوب الحوض
  const tankWater = M.tank.y + 0.3 - fill * 0.45;
  const tr = { dx: M.trough.to[0] - M.trough.from[0], dy: M.trough.to[1] - M.trough.from[1] };
  const trA = Math.atan2(tr.dy, tr.dx), trL = Math.hypot(tr.dx, tr.dy);
  const trMid: [number, number] = [(M.trough.from[0] + M.trough.to[0]) / 2, (M.trough.from[1] + M.trough.to[1]) / 2];
  const tip = toWorld(M.lever.arm, 0);
  const pin: [number, number] = [M.g1.at[0] + M.g1.crank * Math.cos(Math.PI + a1), M.g1.at[1] + M.g1.crank * Math.sin(Math.PI + a1)];
  const rod = { dx: pin[0] - tip[0], dy: pin[1] - tip[1] };
  // الحبل: من يمين الأسطوانة صاعدًا إلى البكرة الأولى، فأفقيًا إلى الثانية، فنازلًا إلى اللوح
  const cx = M.g2.at[0] + M.drum, P1: [number, number] = [cx + M.pulleyR, 3.9], P2: [number, number] = [M.boardX - M.pulleyR, 3.9];
  const boardTop = M.boardTop0 + wound;
  const z = M.z;
  return (
    <>
      <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, lights, still)} background={J.paperDeep} shadows="soft">
        <DepthOfField focus={cam.focus} aperture={shot.aperture} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[30, 20]} /><meshStandardMaterial map={wood[0]} normalMap={wood[1]} color="#BDBDBD" roughness={0.7} /></mesh>
        <mesh position={[0, 5, -2.2]} receiveShadow><planeGeometry args={[30, 12]} /><meshStandardMaterial normalMap={wall[0]} color={J.paper} roughness={1} /></mesh>
        {/* ورقة المخطوطة مثبتة على الجدار خلف الآلة */}
        <mesh position={[0, 2.9, -2.15]} receiveShadow><planeGeometry args={[8, 4.5]} /><meshStandardMaterial map={folio} roughness={0.95} /></mesh>
        <BeamDust t={t} from={[-5, 7.5, 4.5]} to={[0, 1.0, 0]} radius={1.0} color={J.paper} count={90} still={still} seed={13} />
        {/* الحوض النحاسي المفتوح على عموده، وفيه الماء والعوّامة الخشبية بقضيبها وعلامتها الحمراء */}
        <mesh position={[M.tank.x - 0.2, (M.tank.y - 0.45) / 2, 0]} castShadow><boxGeometry args={[0.16, M.tank.y - 0.45, 0.16]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" /></mesh>
        <mesh position={[M.tank.x, M.tank.y, 0]} castShadow material={brass}><cylinderGeometry args={[0.5, 0.42, M.tank.h, 40, 1, true]} /></mesh>
        <mesh position={[M.tank.x, M.tank.y - 0.44, 0]} rotation={[-Math.PI / 2, 0, 0]} material={brass}><circleGeometry args={[0.42, 40]} /></mesh>
        <mesh position={[M.tank.x, M.tank.y + 0.45, 0]} rotation={[Math.PI / 2, 0, 0]} material={brass}><torusGeometry args={[0.5, 0.03, 10, 48]} /></mesh>
        <mesh position={[M.tank.x, tankWater, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.47, 40]} /><meshPhysicalMaterial color={J.paper} transmission={0.5} roughness={0.08} /></mesh>
        <mesh position={[M.tank.x, tankWater, 0]} castShadow><sphereGeometry args={[0.16, 24, 16]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" roughness={0.7} /></mesh>
        <mesh position={[M.tank.x, tankWater + 0.5, 0]} castShadow material={brass}><cylinderGeometry args={[0.02, 0.02, 1.0, 10]} /></mesh>
        <mesh position={[M.tank.x + 0.09, tankWater + 0.96, 0]} castShadow><boxGeometry args={[0.16, 0.1, 0.02]} /><meshStandardMaterial color={J.red} roughness={0.8} /></mesh>
        {/* الصنبور والقناة المكشوفة، والماء يجري فيها إلى فمها */}
        <mesh position={[M.trough.from[0] - 0.08, M.trough.from[1] + 0.02, 0]} rotation={[0, 0, Math.PI / 2]} castShadow material={brass}><cylinderGeometry args={[0.05, 0.05, 0.36, 16]} /></mesh>
        <group position={[trMid[0], trMid[1], 0]} rotation={[0, 0, trA]}>
          <mesh castShadow receiveShadow><boxGeometry args={[trL, 0.014, 0.26]} /><meshStandardMaterial color={J.gold} metalness={0.75} roughness={0.38} /></mesh>
          {[-0.125, 0.125].map((dz) => <mesh key={dz} position={[0, 0.025, dz]} castShadow><boxGeometry args={[trL, 0.05, 0.014]} /><meshStandardMaterial color={J.gold} metalness={0.75} roughness={0.38} /></mesh>)}
          <mesh position={[0, 0.024, 0]}><boxGeometry args={[trL - 0.02, 0.022, 0.235]} /><meshPhysicalMaterial map={ripples} transparent opacity={0.9 * flow} roughness={0.05} clearcoat={1} /></mesh>
        </group>
        <mesh position={[trMid[0] + 0.05, trMid[1] - 0.75, -0.06]} castShadow><boxGeometry args={[0.08, 1.4, 0.08]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" /></mesh>
        {drops.map((d, i) => <mesh key={`d${i}`} position={[lip[0] - 0.02, d.y, 0]} scale={[d.s, d.s * 1.25, d.s]}><sphereGeometry args={[0.045, 16, 12]} /><meshPhysicalMaterial color={J.paper} roughness={0.03} clearcoat={1} transparent opacity={0.85} /></mesh>)}
        {rings.map((q, i) => <mesh key={`r${i}`} position={[cupWater[0], cupWater[1] + 0.006, 0]} rotation={[Math.PI / 2, 0, 0]} scale={0.04 + q * 0.18}><torusGeometry args={[1, 0.06, 6, 32]} /><meshStandardMaterial color={J.paper} transparent opacity={0.6 * (1 - q)} roughness={0.1} /></mesh>)}
        {/* الذراع الخشبي على محوره، والكفّة النحاسية على طرفه */}
        <mesh position={[px, 0.8, 0]} castShadow><boxGeometry args={[0.18, 1.6, 0.3]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" /></mesh>
        <group position={[px, py, 0]} rotation={[0, 0, lever]}>
          <mesh castShadow><boxGeometry args={[2.4, 0.09, 0.2]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={brass}><cylinderGeometry args={[0.05, 0.05, 0.4, 16]} /></mesh>
          <group position={[M.lever.cup, 0.32, 0]}>
            <mesh castShadow material={brass}><cylinderGeometry args={[0.3, 0.22, 0.5, 32, 1, true]} /></mesh>
            <mesh position={[0, -0.24 + fill * 0.4, 0]}><cylinderGeometry args={[0.22 + fill * 0.07, 0.22, 0.01, 32]} /><meshPhysicalMaterial color={J.paper} transmission={0.6} roughness={0.05} /></mesh>
          </group>
        </group>
        <mesh position={[(tip[0] + pin[0]) / 2, (tip[1] + pin[1]) / 2, 0.14]} rotation={[0, 0, Math.atan2(rod.dy, rod.dx)]} castShadow material={brass}><boxGeometry args={[Math.hypot(rod.dx, rod.dy), 0.05, 0.05]} /></mesh>
        {/* الترسان المتعشّقان على عموديهما */}
        <Gear r={M.g1.r} teeth={M.g1.teeth} pos={[M.g1.at[0], M.g1.at[1], -0.1]} angle={a1} mat={brass} />
        <Gear r={M.g2.r} teeth={M.g2.teeth} pos={[M.g2.at[0], M.g2.at[1], -0.1]} angle={a2} mat={brass} />
        <mesh position={[M.g1.at[0], M.g1.at[1] / 2, -0.24]} castShadow><boxGeometry args={[0.14, M.g1.at[1], 0.14]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" /></mesh>
        <mesh position={[M.g2.at[0], M.g2.at[1] / 2, -0.24]} castShadow><boxGeometry args={[0.14, M.g2.at[1], 0.14]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" /></mesh>
        {/* أسطوانة الحبل على محور الترس الصغير، والبكرتان على عارضة خشب */}
        <group position={[M.g2.at[0], M.g2.at[1], z]} rotation={[0, 0, a2]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[M.drum, M.drum, 0.12, 32]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" roughness={0.8} /></mesh>
          {[-0.065, 0.065].map((dz) => <mesh key={dz} position={[0, 0, dz]} material={brass}><torusGeometry args={[M.drum + 0.01, 0.015, 8, 40]} /></mesh>)}
        </group>
        <mesh position={[(1.3 + 4.05) / 2, 4.25, 0.05]} castShadow><boxGeometry args={[4.05 - 1.3 + 0.14, 0.14, 0.14]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" /></mesh>
        <mesh position={[1.3, 2.12, -0.25]} castShadow><boxGeometry args={[0.14, 4.25, 0.14]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" /></mesh>
        <mesh position={[4.05, 2.12, 0.05]} castShadow><boxGeometry args={[0.14, 4.25, 0.14]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" /></mesh>
        {[P1, P2].map((P, i) => <mesh key={`h${i}`} position={[P[0], (P[1] + 4.25) / 2, z]} material={brass}><boxGeometry args={[0.03, 4.25 - P[1], 0.03]} /></mesh>)}
        <Pulley at={P1} z={z} r={M.pulleyR} angle={-wound / M.pulleyR} mat={brass} wood={wood[0]!} />
        <Pulley at={P2} z={z} r={M.pulleyR} angle={-wound / M.pulleyR} mat={brass} wood={wood[0]!} />
        <Cord a={[cx, M.g2.at[1]]} b={[cx, P1[1]]} z={z} />
        <Cord a={[P1[0], P1[1] + M.pulleyR]} b={[P2[0], P2[1] + M.pulleyR]} z={z} />
        {/* لوح الفكرة معلّق بالحبل: يرتفع بقدر ما يلتف، ويتأرجح قليلًا عند وصوله ثم يهدأ */}
        <group position={[M.boardX, boardTop, z]} rotation={[0, 0, boardSway]}>
          <Cord a={[0, 3.9 - boardTop]} b={[0, 0]} z={0} />
          <mesh position={[0, -0.5, 0]} castShadow><boxGeometry args={[1.9, 0.95, 0.06]} /><meshStandardMaterial map={wood[0]} color="#BDBDBD" /></mesh>
          <mesh position={[0, -0.5, 0.045]}><planeGeometry args={[1.8, 0.86]} /><meshStandardMaterial map={idea} roughness={0.9} /></mesh>
          <mesh position={[0, -0.02, 0]} material={brass}><torusGeometry args={[0.05, 0.012, 8, 20]} /></mesh>
        </group>
        {/* أسماء الأجزاء بالحبر الأحمر بالنسخ */}
        {[{ tex: tags.water, at: [M.tank.x, 3.05, 0.6] }, { tex: tags.float, at: [M.tank.x + 0.85, 5.0, 0.3] }, { tex: tags.cup, at: [-2.3, 0.75, 0.55] }, { tex: tags.gear, at: [0.6, 0.55, 0.55] }, { tex: tags.pulley, at: [(P1[0] + P2[0]) / 2, 4.65, 0.3] }].map((l, i) => (
          <mesh key={i} position={l.at as V3} rotation={[-0.2, 0, 0]}><planeGeometry args={[1.2, 0.38]} /><meshStandardMaterial map={l.tex} roughness={0.9} /></mesh>
        ))}
      </Stage3D>
      {/* صوت الورشة الخافت، ومع كل حركة صوتها (D158): كل قطرة، وميل الذراع، ودوران الترس والبكرتين، ووصول اللوح */}
      <Audio src={SFX("silence-room")} volume={0.3} loop />
      {Array.from({ length: 40 }, (_, k) => dripK.a + k * period + period).filter((x) => x <= dripK.b + period).map((x, i) => <Sequence key={i} from={Math.round(x * fps)} durationInFrames={12}><Audio src={SFX("water-drop")} volume={0.32 + (i % 3) * 0.06} /></Sequence>)}
      <Sequence from={Math.round(tipK.a * fps)} durationInFrames={25}><Audio src={SFX("drop-soft")} volume={0.5} /></Sequence>
      <Sequence from={Math.round(turnK.a * fps)} durationInFrames={Math.round((turnK.b - turnK.a) * fps)}><Audio src={SFX("gears")} volume={0.55} /></Sequence>
      <Sequence from={Math.round(riseK.a * fps)} durationInFrames={15}><Audio src={SFX("tick")} volume={0.5} /></Sequence>
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
        <div style={{ opacity: fade, color: "#FFFFFF", textShadow: CAPTION_SHADOW, padding: "8px 28px", fontFamily: "Tajawal", fontWeight: 500, fontSize: 52, direction: "rtl" }}>
          {words.map((w) => w.w).join(" ")}
        </div>
      </div>
    </AbsoluteFill>
  );
};
