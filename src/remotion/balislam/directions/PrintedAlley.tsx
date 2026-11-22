/**
 * «حكايات الحارة» — عالم «بالإسلام» بعد أن لم تبلغ محاولة «خيال الظل» الأخيرة المستوى (قرار المالك ٢٢ نوفمبر: محاولة
 * واحدة وإلا «الحارة» مباشرة)، بمعايير «الحِرفة» (D189). المراجع إلهامًا لا نسخًا: رسوم كتب الأطفال المصرية (اللباد)،
 * وأغلفة حلمي التوني، ولافتات المحلات المرسومة باليد، وطباعة الريزو بطبقاتها المنزاحة قليلًا، ومسرح الورق.
 * - مسرح ورق حقيقي: كل طبقة ورق ملوّن له سُمك، وحافة القص بيضاء (قلب الورق)، وتحته ظل حبره منزاحًا (انزياح الريزو)،
 *   وتحبّب الورق ونسيجه. شمس عصر منخفضة من يسار الحارة تُلقي ظل كل طبقة على التي خلفها (عمق حقيقي لا مرسوم).
 * - الفوانيس مضاءة بنور دافئ في الطبقة البعيدة، وغبار خفيف في شعاع الشمس من القوس.
 * - الورق يستقر: الدكاكين تنزل عند «السوق» وتتأرجح قليلًا ثم تسكن، والشخصيتان تنزلقان وتهتزان اهتزاز الورق، والذراعان
 *   ترتفعان مع «يقول» و«الحقُّ» وتتأرجحان ثم تهدآن. عند ذكر الله يسكن كل شيء: لا مفتاح ولا تأرجح ولا غبار ولا كاميرا.
 * - أربع لقطات بقطع (واسعة، تفاصيل، قريبة، متوسطة) مددها ٢–٥ ث، وعمق ميدان، وصوت مع كل حركة فوق صوت الغرفة (D158).
 * بلا وجوه، وألوان «باء التشغيل» وحدها، والترجمة سطر هادئ بلا مستطيل (D187، D192).
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useBrandFonts } from "../../useBrandFonts";
import { BeamDust, CAPTION_SHADOW_LIGHT, DepthOfField, Stage3D, calmAt, ease, grain, lightsAt, orbit, safeKeys, swing, useAssetTextures, type CamState, type Light, type V3 } from "../../three";
import { BAA, DIR_SEC, DIR_STILL, DIR_WORDS, wordAt } from "./common";
import { figureShapes } from "./figure";

const span = (t: number, a: number, d: number) => Math.min(1, Math.max(0, (t - a) / d));

/** تحبّب الورق (حتمي) */
const usePaper = (seed: number) => useMemo(() => {
  const n = 256, g = grain(n, seed, 0.35), rgba = new Uint8Array(n * n * 4);
  for (let i = 0; i < g.length; i++) { const v = 222 + (g[i]! - 128) * 0.3; rgba.set([v, v, v, 255], i * 4); }
  const t = new THREE.DataTexture(rgba, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.6, 0.6); t.needsUpdate = true;
  return t;
}, [seed]);

type PaperProps = { shapes: THREE.Shape[]; ink: string; tex: THREE.Texture; nor?: THREE.Texture; shift?: [number, number]; z?: number };
/** ورقة مقصوصة: وجهها بالحبر، وحافتها بيضاء (قلب الورق)، وتحتها ظل الحبر منزاحًا كأنها طُبعت */
const Paper: React.FC<PaperProps> = ({ shapes, ink, tex, nor, shift = [0.03, -0.022], z = 0 }) => {
  const misreg = useMemo(() => new THREE.Color(ink).lerp(new THREE.Color(BAA.paper), 0.6), [ink]);
  return (
    <group position={[0, 0, z]}>
      <mesh position={[shift[0], shift[1], -0.006]}><shapeGeometry args={[shapes, 24]} /><meshBasicMaterial color={misreg} /></mesh>
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[shapes, { depth: 0.014, bevelEnabled: false, curveSegments: 24 }]} />
        <meshStandardMaterial attach="material-0" color={ink} map={tex} normalMap={nor} normalScale={new THREE.Vector2(0.35, 0.35)} roughness={0.95} />
        <meshStandardMaterial attach="material-1" color="#FBF6EE" roughness={1} />
      </mesh>
    </group>
  );
};

const archRow = () => {
  const wall = new THREE.Shape();
  wall.moveTo(-9, 0); wall.lineTo(9, 0); wall.lineTo(9, 5.6); wall.lineTo(-9, 5.6); wall.lineTo(-9, 0);
  for (const x of [-5.4, -1.8, 1.8, 5.4]) {
    const h = new THREE.Path();
    h.moveTo(x - 1.1, 0.4); h.lineTo(x + 1.1, 0.4); h.lineTo(x + 1.1, 2.6); h.quadraticCurveTo(x + 1.1, 3.8, x, 4.1); h.quadraticCurveTo(x - 1.1, 3.8, x - 1.1, 2.6); h.lineTo(x - 1.1, 0.4);
    wall.holes.push(h);
  }
  return [wall];
};
const stall = (x: number) => {
  const rect = (x0: number, y0: number, x1: number, y1: number) => { const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.lineTo(x0, y0); return s; };
  const counter = rect(x - 1.4, 0, x + 1.4, 1.1);
  for (const dx of [-0.8, 0, 0.8]) { const h = new THREE.Path(); h.absarc(x + dx, 0.55, 0.2, 0, Math.PI * 2, true); counter.holes.push(h); }
  const awning = new THREE.Shape();
  awning.moveTo(x - 1.7, 2.3); awning.lineTo(x + 1.7, 2.3);
  for (let k = 0; k <= 6; k++) { const xx = x + 1.7 - (k * 3.4) / 6; awning.lineTo(xx, k % 2 ? 1.75 : 1.9); }
  awning.lineTo(x - 1.7, 2.3);
  return [counter, awning, rect(x - 1.5, 0, x - 1.42, 2.3), rect(x + 1.42, 0, x + 1.5, 2.3)];
};
/** بيوت بعيدة بنوافذ (تُرى من الأقواس) */
const farHouses = () => [[-7, 3.2, 2.4], [-4.4, 4.1, 2.2], [-2, 3.5, 2.6], [0.6, 4.4, 2.2], [3.1, 3.7, 2.5], [5.7, 4.2, 2.6]].map(([x, h, w]) => {
  const s = new THREE.Shape(); s.moveTo(x! - w! / 2, 0); s.lineTo(x! + w! / 2, 0); s.lineTo(x! + w! / 2, h!); s.lineTo(x! - w! / 2, h!); s.lineTo(x! - w! / 2, 0);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) { const p = new THREE.Path(); const wx = x! - 0.5 + c * 1.0, wy = h! - 1.1 - r * 1.0; p.moveTo(wx - 0.22, wy - 0.3); p.lineTo(wx + 0.22, wy - 0.3); p.lineTo(wx + 0.22, wy + 0.3); p.lineTo(wx - 0.22, wy + 0.3); p.lineTo(wx - 0.22, wy - 0.3); s.holes.push(p); }
  return s;
});
/** فانوس ورق: جسم مثمن مفرغ يُرى منه نوره */
const lanternShape = () => {
  const s = new THREE.Shape(); s.moveTo(0, -0.5); s.lineTo(0.22, -0.25); s.lineTo(0.22, 0.1); s.lineTo(0, 0.25); s.lineTo(-0.22, 0.1); s.lineTo(-0.22, -0.25); s.lineTo(0, -0.5);
  const h = new THREE.Path(); h.moveTo(0, -0.3); h.lineTo(0.12, -0.18); h.lineTo(0.12, 0.04); h.lineTo(0, 0.12); h.lineTo(-0.12, 0.04); h.lineTo(-0.12, -0.18); h.lineTo(0, -0.3); s.holes.push(h);
  return s;
};
/** قوس أمامي قريب من الكاميرا يؤطر الحارة (يذوب في عمق الميدان) */
const foreArch = () => {
  const s = new THREE.Shape(); s.moveTo(-9, -1); s.lineTo(9, -1); s.lineTo(9, 7); s.lineTo(-9, 7); s.lineTo(-9, -1);
  const h = new THREE.Path(); h.moveTo(-5.6, -1); h.lineTo(5.6, -1); h.lineTo(5.6, 3.6); h.quadraticCurveTo(5.6, 6.0, 0, 6.4); h.quadraticCurveTo(-5.6, 6.0, -5.6, 3.6); h.lineTo(-5.6, -1);
  s.holes.push(h); return [s];
};
const LANTERNS = Array.from({ length: 7 }, (_, k) => ({ x: -6 + k * 2, y: 5.0 - 0.35 * Math.cos((((k - 3) / 3) * Math.PI) / 2) }));

/** الطبقة الأمامية (عمق): سلال مجدولة، وأكياس بهار بكومها، وأثواب قماش مطوية على الأرض — كلها من عُدّة السوق */
const basket = (x: number, w: number, h: number) => {
  const s = new THREE.Shape(); s.moveTo(x - w / 2, h); s.lineTo(x + w / 2, h); s.quadraticCurveTo(x + w / 2, 0, x, 0); s.quadraticCurveTo(x - w / 2, 0, x - w / 2, h);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
    const cx = x - w * 0.27 + c * w * 0.18 + (r ? w * 0.09 : 0), cy = h * (0.55 + r * 0.22), d = Math.min(w, h) * 0.07, p = new THREE.Path();
    if (Math.abs(cx - x) > w * (0.42 - r * 0.05)) continue;
    p.moveTo(cx, cy - d); p.lineTo(cx + d, cy); p.lineTo(cx, cy + d); p.lineTo(cx - d, cy); p.lineTo(cx, cy - d); s.holes.push(p);
  }
  const rim = new THREE.Shape(); rim.moveTo(x - w / 2 - 0.05, h); rim.lineTo(x + w / 2 + 0.05, h); rim.lineTo(x + w / 2 + 0.05, h + 0.09); rim.lineTo(x - w / 2 - 0.05, h + 0.09); rim.lineTo(x - w / 2 - 0.05, h);
  return [s, rim];
};
const sack = (x: number, w: number, h: number) => {
  const s = new THREE.Shape(); s.moveTo(x - w / 2, 0); s.lineTo(x + w / 2, 0); s.quadraticCurveTo(x + w * 0.62, h * 0.6, x + w * 0.36, h); s.lineTo(x - w * 0.36, h); s.quadraticCurveTo(x - w * 0.62, h * 0.6, x - w / 2, 0);
  const heap = new THREE.Shape(); heap.moveTo(x - w * 0.36, h); heap.quadraticCurveTo(x, h + w * 0.42, x + w * 0.36, h); heap.lineTo(x - w * 0.36, h);
  return { sack: [s], heap: [heap] };
};
/** أثواب قماش مطوية مكدسة على الأرض: طبقات بألوان مختلفة، وطيّة مدوّرة عند طرفها */
const clothFold = (x: number, y: number, w: number, h: number) => {
  const s = new THREE.Shape(), r = h / 2;
  s.moveTo(x - w / 2, y); s.lineTo(x + w / 2 - r, y); s.absarc(x + w / 2 - r, y + r, r, -Math.PI / 2, Math.PI / 2, false); s.lineTo(x - w / 2, y + h); s.lineTo(x - w / 2, y);
  return [s];
};
export const CLOTH_STACK = [{ ink: "emerald", w: 1.25 }, { ink: "rose", w: 1.15 }, { ink: "gold", w: 1.2 }, { ink: "paper", w: 1.05 }] as const;

/** وضع الذراع: زاوية الكتف من التدلي، وثني الكوع، وميل الرسغ (موجب = نحو الخارج والأعلى) */
export type ArmPose = { shoulder: number; elbow: number; wrist: number };
/** الكف: راحة مدوّرة وإبهام صغير (قصاصة واحدة، بلا أصابع مرسومة) */
const handShape = () => {
  const s = new THREE.Shape();
  s.moveTo(-0.022, 0); s.lineTo(0.022, 0); s.quadraticCurveTo(0.028, 0.05, 0.016, 0.07); s.quadraticCurveTo(0, 0.082, -0.016, 0.07); s.quadraticCurveTo(-0.028, 0.05, -0.022, 0);
  const thumb = new THREE.Shape(); thumb.absellipse(0.024, 0.028, 0.009, 0.02, 0, Math.PI * 2, false, -0.5);
  return [s, thumb];
};
/** مسمار المفصل النحاسي (كما تُثبّت قصاصات مسرح الورق) */
const Brad: React.FC = () => <mesh position={[0, 0, 0.016]}><circleGeometry args={[0.011, 16]} /><meshStandardMaterial color={BAA.gold} metalness={0.6} roughness={0.35} /></mesh>;

const Person: React.FC<{ x: number; flip: boolean; ink: string; pose: ArmPose; tex: THREE.Texture; nor?: THREE.Texture; cap: "turban" | "kufiya"; wob: number }> = ({ x, flip, ink, pose, tex, nor, cap, wob }) => {
  const s = useMemo(() => figureShapes({ robe: cap === "turban" ? 1 : 1.1, cap, stoop: 0 }), [cap]);
  const hand = useMemo(handShape, []);
  return (
    <group position={[x, 0, 0]} rotation={[0, 0, wob]} scale={[flip ? -2.6 : 2.6, 2.6, 1]}>
      <Paper shapes={[s.robe, s.head]} ink={ink} tex={tex} nor={nor} shift={[0.01, -0.008]} />
      <Paper shapes={[s.cap]} ink={BAA.paper} tex={tex} nor={nor} shift={[0.007, -0.005]} z={0.006} />
      {/* الكتف ← العضد ← الكوع ← الساعد ← الرسغ ← الكف، وعلى كل مفصل مسمار */}
      <group position={[s.shoulder.x + 0.02, s.shoulder.y - 0.01, 0.012]} rotation={[0, 0, Math.PI + pose.shoulder]}>
        <Paper shapes={[s.upper]} ink={ink} tex={tex} nor={nor} shift={[0.007, -0.005]} />
        <Brad />
        <group position={[0, 0.18, 0.006]} rotation={[0, 0, pose.elbow]}>
          <Paper shapes={[s.fore]} ink={ink} tex={tex} nor={nor} shift={[0.007, -0.005]} />
          <Brad />
          <group position={[0, 0.17, 0.006]} rotation={[0, 0, pose.wrist]}>
            <Paper shapes={hand} ink={ink} tex={tex} nor={nor} shift={[0.005, -0.004]} />
          </group>
        </group>
      </group>
    </group>
  );
};

/**
 * إيماءة طبيعية: الكتف يبدأ، والكوع يتبعه بعد قليل، والرسغ آخرًا (تتابع الحركة)، وكل مفصل يتأرجح قليلًا عند وصوله ثم يهدأ.
 * «يقول»: ذراع ممدودة للخارج وراحة مفتوحة. «الحقُّ معي»: الكف تعود إلى الصدر.
 */
export const GESTURES = {
  speak: { shoulder: 1.2, elbow: 0.5, wrist: 0.5 },
  self: { shoulder: 0.55, elbow: -1.9, wrist: -0.3 },
} as const;
export const armPose = (t: number, k: { a: number; b: number }, to: ArmPose, calm: number): ArmPose => {
  const d = k.b - k.a, p = (lag: number) => ease(Math.min(1, Math.max(0, (t - k.a - lag) / d)));
  const sw = (lag: number, amp: number) => swing(t, k.b + lag, amp, 2.0) * calm;
  return { shoulder: to.shoulder * p(0) + sw(0, 0.08), elbow: to.elbow * p(0.08) + sw(0.08, 0.1 * Math.sign(to.elbow)), wrist: to.wrist * p(0.15) + sw(0.15, 0.14 * Math.sign(to.wrist)) };
};

type ShotCam = { target: V3; yaw: number; pitch: number; dist: number; fov: number };
export type AlleyShot = { id: string; size: "wide" | "detail" | "close" | "medium"; a: number; b: number; from: ShotCam; to: ShotCam; aperture: number };
/** اللقطات: الرابعة تبدأ قبل جملة الذكر وكاميرتها ساكنة فيها، ثم تقترب بعدها */
export const alleyShots = (): AlleyShot[] => {
  const s3 = DIR_STILL[0]![0] - 0.05, s1 = wordAt("السوق") + 0.6, s2 = s3 - 2.02;
  const mid: ShotCam = { target: [0, 1.8, -0.6], yaw: 0, pitch: 3, dist: 9.8, fov: 34 };
  return [
    // الحارة تتكوّن: الشخصيتان تدخلان والدكاكين تنزل، والكاميرا تدخل من القوس الأمامي
    { id: "market", size: "wide", a: 0, b: s1, aperture: 0.004, from: { target: [0, 2.2, -1], yaw: -6, pitch: 4, dist: 13.2, fov: 34 }, to: { target: [0, 2.0, -1], yaw: 2, pitch: 3, dist: 11.6, fov: 34 } },
    // «كلٌّ منهما يقول»: حافة الورق المقصوص وانزياح حبره على الأولى وهي ترفع ذراعها، والثانية خلفها في العمق
    { id: "paper", size: "detail", a: s1, b: s2, aperture: 0.03, from: { target: [-1.75, 1.55, 0], yaw: 24, pitch: 4, dist: 2.4, fov: 30 }, to: { target: [-1.6, 1.6, 0], yaw: 16, pitch: 4, dist: 2.1, fov: 30 } },
    { id: "say", size: "close", a: s2, b: s3, aperture: 0.016, from: { target: [0, 1.75, 0], yaw: -10, pitch: 2, dist: 4.6, fov: 32 }, to: { target: [0, 1.75, 0], yaw: -2, pitch: 2, dist: 4.2, fov: 32 } },
    { id: "contemplation", size: "medium", a: s3, b: DIR_SEC, aperture: 0.008, from: mid, to: { ...mid, dist: 9.0, pitch: 6, target: [0, 2.3, -0.6] } },
  ];
};
const camOf = (s: AlleyShot, t: number): CamState & { focus: number } => {
  const [a, b] = s.id === "contemplation" ? [DIR_STILL[0]![1] + 0.1, s.b] : [s.a, s.b];
  const p = ease(span(t, a, b - a));
  const L = (x: number, y: number) => x + (y - x) * p;
  const c = { target: [L(s.from.target[0], s.to.target[0]), L(s.from.target[1], s.to.target[1]), L(s.from.target[2], s.to.target[2])] as V3, yaw: L(s.from.yaw, s.to.yaw), pitch: L(s.from.pitch, s.to.pitch), dist: L(s.from.dist, s.to.dist), fov: L(s.from.fov, s.to.fov) };
  return { position: orbit(c), target: c.target, fov: c.fov, focus: c.dist };
};

const SFX = (f: string) => staticFile(`three/sfx/${f}.mp3`);

export const PrintedAlleyLab: React.FC = () => {
  useBrandFonts();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const still = DIR_STILL;
  const nor = useAssetTextures(["balislam-plaster-nor"], [0.25, 0.25]);
  const paperA = usePaper(3), paperB = usePaper(7), paperC = usePaper(11);
  const wall = useMemo(archRow, []), houses = useMemo(farHouses, []), lantern = useMemo(lanternShape, []), fore = useMemo(foreArch, []);
  const stalls = useMemo(() => [stall(-3.2), stall(3.4)], []);
  const fg = useMemo(() => ({ baskets: [...basket(-5.6, 1.5, 0.75), ...basket(-4.1, 1.1, 0.55)], sacks: [sack(4.3, 0.9, 0.85), sack(5.5, 1.05, 1.0)], cloth: CLOTH_STACK.map((c, i) => ({ ink: BAA[c.ink], shapes: clothFold(2.9 + (i % 2) * 0.06, i * 0.17, c.w, 0.16) })) }), []);
  const key = (w: string, d: number, lead = 0.1) => safeKeys([{ a: wordAt(w) - lead, b: wordAt(w) - lead + d, to: 1 }], still)[0]!;
  const enterK = key("رجلان", 1.0, 0.2), marketK = key("السوق", 0.7), say1K = key("يقول", 0.5, 0.05), say2K = key("الحقُّ", 0.5, 0.05);
  const prog = (k: { a: number; b: number }) => ease(span(t, k.a, k.b - k.a));
  const calm = calmAt(t, still);
  const enter = prog(enterK), market = prog(marketK);
  // الورق يستقر: تأرجح يخفت بعد كل حركة، ولا شيء منه في السكون المقصود
  const settle = swing(t, marketK.b, 0.05, 1.6) * calm;
  const wobA = (swing(t, enterK.b, 0.035, 1.8) + (enter > 0 && enter < 1 ? 0.02 * Math.sin(t * 14) : 0)) * calm;
  const wobB = (swing(t, enterK.b, -0.03, 1.5) + (enter > 0 && enter < 1 ? 0.02 * Math.sin(t * 13 + 1) : 0)) * calm;
  const pose1 = armPose(t, say1K, GESTURES.speak, calm), pose2 = armPose(t, say2K, GESTURES.self, calm);
  const lanternSway = (k: number) => 0.04 * Math.sin(t * 1.3 + k * 0.9) * calm;
  const shots = alleyShots();
  const shot = shots.find((s) => t >= s.a && t < s.b) ?? shots[shots.length - 1]!;
  const cam = camOf(shot, t);
  if (!nor) return null;
  const lights: Light[] = [
    { kind: "ambient", kelvin: 4200, intensity: 0.9, position: [0, 0, 0] },
    // شمس عصر منخفضة من يسار الحارة: تُلقي ظل كل طبقة ورق على التي خلفها
    { kind: "key", kelvin: 3600, intensity: 2.6, position: [-7, 6, 6] },
    // نور الفوانيس الدافئ على الجدار البعيد (بلا ظل)
    { kind: "fill", kelvin: 2200, intensity: 0.5, position: [0, 5, -1.6] },
  ];
  return (
    <>
      <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, lights, still)} background={BAA.paper} shadows="soft">
        <DepthOfField focus={cam.focus} aperture={shot.aperture} />
        {/* سماء الحارة ورقة، والبيوت البعيدة، والجدار بأقواسه */}
        <mesh position={[0, 3, -4.6]} receiveShadow><planeGeometry args={[40, 20]} /><meshStandardMaterial color={BAA.paper} map={paperC} normalMap={nor[0]} roughness={1} /></mesh>
        <group position={[0, 0, -3.8]}><Paper shapes={houses} ink="#D98C6E" tex={paperB} nor={nor[0]} shift={[0.05, -0.04]} /></group>
        <group position={[0, 0, -3]}><Paper shapes={wall} ink={BAA.emerald} tex={paperA} nor={nor[0]} shift={[0.06, -0.05]} /></group>
        {/* حبل الفوانيس: كل فانوس يتأرجح قليلًا على حبله، ونوره دافئ من خلف ورقه */}
        <group position={[0, 0, -2.2]}>
          {LANTERNS.map((l, k) => (
            <group key={k} position={[l.x, l.y + 0.25, 0]} rotation={[0, 0, lanternSway(k)]}>
              <mesh position={[0, -0.13, -0.02]}><circleGeometry args={[0.14, 16]} /><meshBasicMaterial color="#FBF6EE" toneMapped={false} /></mesh>
              <group position={[0, -0.25, 0]}><Paper shapes={[lantern]} ink={BAA.gold} tex={paperC} nor={nor[0]} shift={[0.025, -0.02]} /></group>
            </group>
          ))}
          <mesh position={[0, 5.27, 0]}><boxGeometry args={[15, 0.025, 0.01]} /><meshStandardMaterial color={BAA.night} /></mesh>
        </group>
        <BeamDust t={t} from={[-6, 6, 3]} to={[-1.8, 0.6, -1.4]} radius={0.9} color={BAA.paper} count={70} still={still} seed={17} />
        {/* الدكاكين تنزل من أعلى المسرح عند «السوق» (كما تُدلّى قطع مسرح الورق) وتستقر */}
        {stalls.map((sh, i) => (
          <group key={i} visible={market > 0} position={[0, (1 - market) * 9, -1.4]} rotation={[0, 0, i ? -settle : settle]}>
            <Paper shapes={sh} ink={BAA.copper} tex={paperB} nor={nor[0]} shift={[0.05, -0.04]} />
          </group>
        ))}
        {/* الأرض */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -1]} receiveShadow><planeGeometry args={[40, 14]} /><meshStandardMaterial color="#D9B08C" map={paperA} normalMap={nor[0]} roughness={1} /></mesh>
        <Person x={-6 + enter * 4.2} flip={false} ink={BAA.rose} pose={pose1} tex={paperC} nor={nor[0]} cap="turban" wob={wobA} />
        <Person x={6 - enter * 4.2} flip ink={BAA.night} pose={pose2} tex={paperB} nor={nor[0]} cap="kufiya" wob={wobB} />
        {/* الطبقة الأمامية للعمق: سلال، وأكياس بهار بكومها، وأثواب قماش مطوية مكدسة */}
        <group position={[0, 0, 1.5]}>
          <Paper shapes={fg.baskets} ink={BAA.gold} tex={paperA} nor={nor[0]} shift={[0.04, -0.03]} />
          {fg.sacks.map((k, i) => (
            <group key={i}>
              <Paper shapes={k.sack} ink={i ? BAA.emerald : BAA.rose} tex={paperB} nor={nor[0]} shift={[0.04, -0.03]} />
              <Paper shapes={k.heap} ink={i ? BAA.gold : BAA.copper} tex={paperC} nor={nor[0]} shift={[0.03, -0.02]} z={0.004} />
            </group>
          ))}
          {fg.cloth.map((c, i) => <Paper key={i} shapes={c.shapes} ink={c.ink} tex={paperA} nor={nor[0]} shift={[0.03, -0.02]} z={i * 0.003} />)}
        </group>
        {/* القوس الأمامي القريب */}
        <group position={[0, 0, 2.6]}><Paper shapes={fore} ink={BAA.night} tex={paperA} nor={nor[0]} shift={[0.06, -0.05]} /></group>
      </Stage3D>
      {/* صوت الغرفة، ومع كل حركة صوتها: انزلاق الورق، ونزول الدكاكين واستقرارها، ورفع الذراعين (D158) */}
      <Audio src={SFX("silence-room")} volume={0.3} loop />
      <Sequence from={Math.round(enterK.a * fps)} durationInFrames={35}><Audio src={SFX("swipe-paper")} volume={0.4} /></Sequence>
      <Sequence from={Math.round(marketK.a * fps)} durationInFrames={20}><Audio src={SFX("paper-crumple")} volume={0.25} /></Sequence>
      <Sequence from={Math.round(marketK.b * fps)} durationInFrames={20}><Audio src={SFX("drop-soft")} volume={0.45} /></Sequence>
      <Sequence from={Math.round(say1K.a * fps)} durationInFrames={18}><Audio src={SFX("swipe-paper")} volume={0.22} /></Sequence>
      <Sequence from={Math.round(say2K.a * fps)} durationInFrames={18}><Audio src={SFX("swipe-paper")} volume={0.22} /></Sequence>
      <AlleyLine t={t} />
    </>
  );
};

/** الترجمة سطر هادئ بخط القناة بلا تلوين ولا قفز ولا مستطيل: حبر الليل بظل فاتح خفيف على ورق الحارة (D187، D192) */
const STARTS = [0, 4, 9];
const AlleyLine: React.FC<{ t: number }> = ({ t }) => {
  const si = Math.max(0, STARTS.filter((x) => DIR_WORDS[x]!.s - 0.15 <= t).length - 1);
  const words = DIR_WORDS.slice(STARTS[si], STARTS[si + 1] ?? DIR_WORDS.length);
  if (t < DIR_WORDS[0]!.s - 0.15) return null;
  const fade = Math.min(1, Math.max(0, (t - words[0]!.s + 0.15) / 0.13));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", bottom: 56, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ opacity: fade, color: BAA.night, textShadow: CAPTION_SHADOW_LIGHT, padding: "8px 28px", fontFamily: "IBM Plex Sans Arabic", fontWeight: 500, fontSize: 52, direction: "rtl" }}>
          {words.map((w) => w.w).join(" ")}
        </div>
      </div>
    </AbsoluteFill>
  );
};
