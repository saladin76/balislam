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

const Person: React.FC<{ x: number; flip: boolean; ink: string; arm: number; tex: THREE.Texture; nor?: THREE.Texture; cap: "turban" | "kufiya"; wob: number }> = ({ x, flip, ink, arm, tex, nor, cap, wob }) => {
  const s = useMemo(() => figureShapes({ robe: cap === "turban" ? 1 : 1.1, cap, stoop: 0 }), [cap]);
  return (
    <group position={[x, 0, 0]} rotation={[0, 0, wob]} scale={[flip ? -2.6 : 2.6, 2.6, 1]}>
      <Paper shapes={[s.robe, s.head]} ink={ink} tex={tex} nor={nor} shift={[0.01, -0.008]} />
      <Paper shapes={[s.cap]} ink={BAA.paper} tex={tex} nor={nor} shift={[0.007, -0.005]} z={0.006} />
      <group position={[s.shoulder.x + 0.02, s.shoulder.y - 0.01, 0.012]} rotation={[0, 0, Math.PI + arm]}>
        <Paper shapes={[s.upper]} ink={ink} tex={tex} nor={nor} shift={[0.007, -0.005]} />
        <group position={[0, 0.19, 0.006]} rotation={[0, 0, -arm * 0.3]}><Paper shapes={[s.fore]} ink={ink} tex={tex} nor={nor} shift={[0.007, -0.005]} /></group>
      </group>
    </group>
  );
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
  const key = (w: string, d: number, lead = 0.1) => safeKeys([{ a: wordAt(w) - lead, b: wordAt(w) - lead + d, to: 1 }], still)[0]!;
  const enterK = key("رجلان", 1.0, 0.2), marketK = key("السوق", 0.7), say1K = key("يقول", 0.5, 0.05), say2K = key("الحقُّ", 0.5, 0.05);
  const prog = (k: { a: number; b: number }) => ease(span(t, k.a, k.b - k.a));
  const calm = calmAt(t, still);
  const enter = prog(enterK), market = prog(marketK);
  // الورق يستقر: تأرجح يخفت بعد كل حركة، ولا شيء منه في السكون المقصود
  const settle = swing(t, marketK.b, 0.05, 1.6) * calm;
  const wobA = (swing(t, enterK.b, 0.035, 1.8) + (enter > 0 && enter < 1 ? 0.02 * Math.sin(t * 14) : 0)) * calm;
  const wobB = (swing(t, enterK.b, -0.03, 1.5) + (enter > 0 && enter < 1 ? 0.02 * Math.sin(t * 13 + 1) : 0)) * calm;
  const arm1 = prog(say1K) * 1.2 + swing(t, say1K.b, 0.12, 2) * calm, arm2 = prog(say2K) * 1.0 + swing(t, say2K.b, 0.1, 2.2) * calm;
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
          <group key={i} position={[0, (1 - market) * 4.5, -1.4]} rotation={[0, 0, i ? -settle : settle]}>
            <Paper shapes={sh} ink={BAA.copper} tex={paperB} nor={nor[0]} shift={[0.05, -0.04]} />
          </group>
        ))}
        {/* الأرض */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -1]} receiveShadow><planeGeometry args={[40, 14]} /><meshStandardMaterial color="#D9B08C" map={paperA} normalMap={nor[0]} roughness={1} /></mesh>
        <Person x={-6 + enter * 4.2} flip={false} ink={BAA.rose} arm={arm1} tex={paperC} nor={nor[0]} cap="turban" wob={wobA} />
        <Person x={6 - enter * 4.2} flip ink={BAA.night} arm={arm2} tex={paperB} nor={nor[0]} cap="kufiya" wob={wobB} />
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
