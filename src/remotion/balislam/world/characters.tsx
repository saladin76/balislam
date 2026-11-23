/**
 * شخصيات «الحارة» الثابتة (مقترح لسجل الشخصيات، عمود «بالإسلام» القسم العاشر/١): ست قصاصات ورق على مسرح الحارة،
 * **بلا وجوه** (الرأس قصاصة واحدة بلا عين ولا فم ولا أنف)، وتُعرف كل شخصية بهيئتها: الظل العام، وغطاء الرأس، والوقفة،
 * وما في يدها، ولونها من «باء التشغيل» وحدها. لا شخصية تمثل نبيًا أو صحابيًا أو عالمًا معروفًا.
 * نموذج للمراجعة لا يُستعمل في حلقة قبل اعتماد المالك.
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { orbit, useAssetTextures, type V3 } from "../../three";
import { BAA } from "../directions/common";
import { AlleyStage, Brad, Paper, handShape, usePaper, type ArmPose } from "../directions/PrintedAlley";

type Pt = [number, number];
const poly = (pts: Pt[]) => { const s = new THREE.Shape(); s.moveTo(pts[0]![0], pts[0]![1]); for (const p of pts.slice(1)) s.lineTo(p[0], p[1]); s.lineTo(pts[0]![0], pts[0]![1]); return s; };
const rounded = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, 0); s.lineTo(w / 2 - r, 0); s.quadraticCurveTo(w / 2, 0, w / 2, r);
  s.lineTo(w / 2, h - r); s.quadraticCurveTo(w / 2, h, w / 2 - r, h); s.lineTo(-w / 2 + r, h);
  s.quadraticCurveTo(-w / 2, h, -w / 2, h - r); s.lineTo(-w / 2, r); s.quadraticCurveTo(-w / 2, 0, -w / 2 + r, 0);
  return s;
};
const ellipse = (x: number, y: number, rx: number, ry: number, rot = 0) => { const s = new THREE.Shape(); s.absellipse(x, y, rx, ry, 0, Math.PI * 2, false, rot); return s; };

/** الجذع من الخصر (0.38) إلى الكتف (0.66)، والجزء السفلي من القدم إلى الخصر */
const torso = (sh: number, waist: number) => {
  const s = new THREE.Shape();
  s.moveTo(-waist, 0.37); s.lineTo(waist, 0.37);
  s.bezierCurveTo(waist * 1.05, 0.5, sh * 1.1, 0.58, sh, 0.66);
  s.quadraticCurveTo(0, 0.7, -sh, 0.66);
  s.bezierCurveTo(-sh * 1.1, 0.58, -waist * 1.05, 0.5, -waist, 0.37);
  return s;
};
const skirt = (hem: number, waist: number, bottom = 0) => {
  const s = new THREE.Shape();
  s.moveTo(-hem, bottom); s.lineTo(hem, bottom);
  s.bezierCurveTo(hem * 0.95, bottom + 0.15, waist * 1.1, 0.33, waist, 0.4);
  s.lineTo(-waist, 0.4);
  s.bezierCurveTo(-waist * 1.1, 0.33, -hem * 0.95, bottom + 0.15, -hem, bottom);
  return s;
};

type Headwear = "turban" | "taqiya" | "scarf" | "fez" | "hair";
const HEAD = { x: 0, y: 0.77, rx: 0.062, ry: 0.075 };
/** غطاء الرأس: خلفه (يؤطر الرأس) وأمامه (فوق الجبهة)، والرأس نفسه قصاصة ملساء بلا ملامح */
const headwear = (k: Headwear): { back: THREE.Shape[]; front: THREE.Shape[] } => {
  switch (k) {
    case "turban": {
      const wrap = new THREE.Shape();
      wrap.moveTo(-0.074, 0.79); wrap.quadraticCurveTo(-0.1, 0.9, 0, 0.94); wrap.quadraticCurveTo(0.1, 0.9, 0.074, 0.79); wrap.quadraticCurveTo(0, 0.83, -0.074, 0.79);
      return { back: [], front: [wrap, poly([[-0.07, 0.86], [0.07, 0.885], [0.068, 0.9], [-0.072, 0.875]])] };
    }
    case "taqiya": {
      const cap = new THREE.Shape(); cap.moveTo(-0.064, 0.8); cap.quadraticCurveTo(0, 0.885, 0.064, 0.8); cap.quadraticCurveTo(0, 0.815, -0.064, 0.8);
      return { back: [], front: [cap] };
    }
    case "fez": {
      // طربوش: جذع مخروطي قصير، وشرّابته تتدلى على جانبه
      return { back: [], front: [poly([[-0.058, 0.815], [0.058, 0.815], [0.047, 0.925], [-0.047, 0.925]]), poly([[0.0, 0.925], [0.006, 0.925], [0.052, 0.86], [0.046, 0.855]]), ellipse(0.05, 0.85, 0.009, 0.016)] };
    }
    case "hair": {
      const h = new THREE.Shape(); h.moveTo(-0.066, 0.78); h.quadraticCurveTo(-0.07, 0.868, 0, 0.865); h.quadraticCurveTo(0.07, 0.868, 0.066, 0.78); h.quadraticCurveTo(0.04, 0.83, -0.066, 0.78);
      return { back: [], front: [h] };
    }
    case "scarf": {
      // الخمار: يحيط بالرأس وينسدل على الكتفين والظهر، وحافته الأمامية فوق الجبهة
      const back = new THREE.Shape();
      back.moveTo(-0.115, 0.46); back.lineTo(-0.088, 0.74); back.quadraticCurveTo(-0.09, 0.875, 0, 0.88); back.quadraticCurveTo(0.09, 0.875, 0.088, 0.74); back.lineTo(0.125, 0.46); back.quadraticCurveTo(0, 0.5, -0.115, 0.46);
      const front = new THREE.Shape(); front.moveTo(-0.069, 0.75); front.quadraticCurveTo(-0.072, 0.87, 0, 0.866); front.quadraticCurveTo(0.072, 0.87, 0.069, 0.75); front.quadraticCurveTo(0, 0.835, -0.069, 0.75);
      return { back: [back], front: [front] };
    }
  }
};

type Layer = { shapes: THREE.Shape[]; ink: string; z?: number };
export type AlleyCharacter = {
  id: string; name: string; role: string;
  scale: number; shoulder: number; waist: number; hem: number;
  /** ميل الجذع إلى الأمام (راديان) حول الخصر: انحناء الجدة */
  stoop: number;
  ink: string; headInk: string; wearInk: string; head: Headwear;
  /** الشاب: سترة قصيرة وساقان بدل الثوب الطويل */
  legs?: boolean;
  arm: ArmPose;
  /** قصاصات فوق الجسد (مريلة، حزام، حقيبة...) وما في اليد */
  layers: () => Layer[];
  hand?: () => Layer[];
};

export const ALLEY_CHARACTERS: AlleyCharacter[] = [
  {
    id: "attar", name: "عم صابر", role: "العطّار", scale: 0.97, shoulder: 0.11, waist: 0.12, hem: 0.19, stoop: 0,
    ink: BAA.emerald, headInk: "#D9B08C", wearInk: BAA.paper, head: "turban",
    arm: { shoulder: 0.45, elbow: 1.75, wrist: 0.3 },
    // حزام ذهبي بطرف متدلٍّ، وصدرية قصيرة
    layers: () => [
      { shapes: [poly([[-0.125, 0.4], [0.125, 0.4], [0.12, 0.44], [-0.12, 0.44]]), poly([[0.05, 0.4], [0.075, 0.4], [0.085, 0.29], [0.06, 0.29]])], ink: BAA.gold, z: 0.008 },
      { shapes: [poly([[-0.095, 0.45], [-0.03, 0.45], [-0.03, 0.64], [-0.095, 0.63]]), poly([[0.03, 0.45], [0.095, 0.45], [0.095, 0.63], [0.03, 0.64]])], ink: BAA.night, z: 0.006 },
    ],
    // قارورة عطر صغيرة في الكف: جسم مدوّر وعنق وسدادة
    hand: () => [{ shapes: [ellipse(0, 0.105, 0.03, 0.036), poly([[-0.009, 0.135], [0.009, 0.135], [0.009, 0.16], [-0.009, 0.16]]), ellipse(0, 0.168, 0.014, 0.01)], ink: BAA.gold, z: 0.004 }],
  },
  {
    id: "haddad", name: "عم فتحي", role: "الحدّاد", scale: 1.02, shoulder: 0.15, waist: 0.12, hem: 0.16, stoop: 0,
    ink: BAA.night, headInk: "#B98B66", wearInk: BAA.copper, head: "taqiya",
    arm: { shoulder: 0.12, elbow: 0.15, wrist: 0 },
    // مريلة جلد نحاسية بحزام الرقبة
    layers: () => [
      { shapes: [poly([[-0.105, 0.06], [0.105, 0.06], [0.095, 0.56], [-0.095, 0.56]]), poly([[-0.06, 0.56], [-0.045, 0.56], [-0.025, 0.67], [-0.04, 0.67]]), poly([[0.045, 0.56], [0.06, 0.56], [0.04, 0.67], [0.025, 0.67]])], ink: BAA.copper, z: 0.008 },
    ],
    // مطرقة: يد خشبية ورأس حديد
    hand: () => [
      { shapes: [poly([[-0.008, 0.04], [0.008, 0.04], [0.008, 0.25], [-0.008, 0.25]])], ink: "#8A5A3C", z: 0.004 },
      { shapes: [poly([[-0.045, 0.235], [0.045, 0.235], [0.045, 0.28], [-0.045, 0.28]])], ink: BAA.night, z: 0.006 },
    ],
  },
  {
    id: "grandma", name: "الحاجة نعيمة", role: "الجدة", scale: 0.9, shoulder: 0.1, waist: 0.11, hem: 0.18, stoop: 0.22,
    ink: BAA.rose, headInk: "#D9B08C", wearInk: BAA.paper, head: "scarf",
    arm: { shoulder: 0.32, elbow: -0.15, wrist: 0 },
    // عكاز بمقبض معقوف إلى جوارها (على الأرض)
    layers: () => {
      const crook = new THREE.Shape(); crook.absarc(0.205, 0.31, 0.035, Math.PI, 0, true); crook.lineTo(0.255, 0.31); crook.absarc(0.205, 0.31, 0.05, 0, Math.PI, false); crook.lineTo(0.17, 0.31);
      return [{ shapes: [poly([[0.165, 0], [0.178, 0], [0.178, 0.31], [0.165, 0.31]]), crook], ink: "#8A5A3C", z: 0.012 }];
    },
  },
  {
    id: "shab", name: "مازن", role: "الشاب", scale: 1.05, shoulder: 0.115, waist: 0.1, hem: 0.12, stoop: 0,
    ink: BAA.night, headInk: "#C99B77", wearInk: BAA.night, head: "hair", legs: true,
    arm: { shoulder: 0.15, elbow: 0.25, wrist: 0 },
    // حزام الحقيبة على الصدر، والحقيبة عند الورك، وسترة ذهبية مفتوحة
    layers: () => [
      { shapes: [poly([[-0.1, 0.3], [-0.035, 0.3], [-0.035, 0.645], [-0.095, 0.63]]), poly([[0.035, 0.3], [0.1, 0.3], [0.095, 0.63], [0.035, 0.645]])], ink: BAA.gold, z: 0.006 },
      { shapes: [poly([[0.07, 0.64], [0.09, 0.63], [-0.1, 0.36], [-0.12, 0.37]]), poly([[-0.17, 0.27], [-0.07, 0.27], [-0.065, 0.37], [-0.165, 0.37]])], ink: BAA.copper, z: 0.01 },
    ],
  },
  {
    id: "muallim", name: "الأستاذ شريف", role: "المعلّم", scale: 1.06, shoulder: 0.11, waist: 0.105, hem: 0.15, stoop: 0,
    ink: BAA.emerald, headInk: "#D9B08C", wearInk: BAA.rose, head: "fez",
    arm: { shoulder: 0.55, elbow: 1.35, wrist: 0.3 },
    // ياقة بيضاء وصف أزرار، ولوح أردواز تحت الذراع (لوح الدرس، لا كتاب ولا مصحف)
    layers: () => [
      { shapes: [poly([[-0.045, 0.6], [0, 0.55], [0.045, 0.6], [0.035, 0.66], [-0.035, 0.66]])], ink: BAA.paper, z: 0.008 },
      { shapes: [0.5, 0.44, 0.38, 0.32, 0.26].map((y) => ellipse(0, y, 0.008, 0.008)), ink: BAA.gold, z: 0.009 },
      { shapes: [poly([[0.09, 0.3], [0.21, 0.3], [0.21, 0.47], [0.09, 0.47]])], ink: "#8A5A3C", z: 0.014 },
      { shapes: [poly([[0.1, 0.31], [0.2, 0.31], [0.2, 0.46], [0.1, 0.46]])], ink: "#2E3B3A", z: 0.016 },
    ],
  },
  {
    id: "jara", name: "أم هالة", role: "الجارة", scale: 0.95, shoulder: 0.105, waist: 0.11, hem: 0.19, stoop: 0,
    ink: BAA.gold, headInk: "#C99B77", wearInk: BAA.copper, head: "scarf",
    arm: { shoulder: 2.2, elbow: 1.3, wrist: 0.4 },
    // طاولة عيش على الرأس: صينية مستديرة وأرغفة عليها
    layers: () => [
      { shapes: [ellipse(0, 0.9, 0.13, 0.018)], ink: "#8A5A3C", z: 0.012 },
      { shapes: [-0.08, -0.027, 0.027, 0.08].map((x) => ellipse(x, 0.927, 0.028, 0.017)), ink: "#E3B57A", z: 0.014 },
    ],
  },
];

const legsShapes = () => [poly([[-0.07, 0], [-0.015, 0], [-0.02, 0.33], [-0.065, 0.33]]), poly([[0.015, 0], [0.07, 0], [0.065, 0.33], [0.02, 0.33]])];
const shoes = () => [ellipse(-0.05, 0.012, 0.04, 0.014), ellipse(0.05, 0.012, 0.04, 0.014)];

/** شخصية واحدة على المسرح (وحدة «ارتفاع الشخصية = ١» مضروبة في 2.6 كشخصيتي النموذج) */
export const AlleyFigure: React.FC<{ c: AlleyCharacter; x: number; z?: number; flip?: boolean; tex: THREE.Texture; nor?: THREE.Texture }> = ({ c, x, z = 0, flip = false, tex, nor }) => {
  const parts = useMemo(() => {
    const hw = headwear(c.head);
    return {
      lower: c.legs ? skirt(c.hem, c.waist, 0.28) : skirt(c.hem, c.waist), torso: torso(c.shoulder, c.waist),
      head: ellipse(HEAD.x, HEAD.y, HEAD.rx, HEAD.ry), hw, layers: c.layers(), hand: c.hand?.() ?? [],
      upper: rounded(0.05, 0.2, 0.022), fore: rounded(0.044, 0.19, 0.02), palm: handShape(),
    };
  }, [c]);
  const k = 2.6 * c.scale;
  const sh = new THREE.Vector2(c.shoulder - 0.02, 0.63);
  return (
    <group position={[x, 0, z]} scale={[flip ? -k : k, k, 1]}>
      {c.legs && <><Paper shapes={legsShapes()} ink={BAA.night} tex={tex} nor={nor} shift={[0.008, -0.006]} z={-0.004} /><Paper shapes={shoes()} ink={BAA.copper} tex={tex} nor={nor} shift={[0.005, -0.004]} /></>}
      <Paper shapes={[parts.lower]} ink={c.ink} tex={tex} nor={nor} shift={[0.01, -0.008]} />
      {/* الجذع والرأس والذراع تميل معًا حول الخصر (انحناء الجدة) */}
      <group position={[0, 0.38, 0]} rotation={[0, 0, -c.stoop]}>
        <group position={[0, -0.38, 0]}>
          {parts.hw.back.length > 0 && <Paper shapes={parts.hw.back} ink={c.wearInk} tex={tex} nor={nor} shift={[0.008, -0.006]} z={-0.006} />}
          <Paper shapes={[parts.torso]} ink={c.ink} tex={tex} nor={nor} shift={[0.01, -0.008]} z={0.002} />
          <Paper shapes={[parts.head]} ink={c.headInk} tex={tex} nor={nor} shift={[0.006, -0.005]} z={0.003} />
          <Paper shapes={parts.hw.front} ink={c.wearInk} tex={tex} nor={nor} shift={[0.006, -0.005]} z={0.007} />
          {parts.layers.map((l, i) => <Paper key={i} shapes={l.shapes} ink={l.ink} tex={tex} nor={nor} shift={[0.006, -0.005]} z={l.z ?? 0.008} />)}
          <group position={[sh.x + 0.02, sh.y, 0.02]} rotation={[0, 0, Math.PI + c.arm.shoulder]}>
            <Paper shapes={[parts.upper]} ink={c.ink} tex={tex} nor={nor} shift={[0.006, -0.005]} />
            <Brad />
            <group position={[0, 0.18, 0.006]} rotation={[0, 0, c.arm.elbow]}>
              <Paper shapes={[parts.fore]} ink={c.ink} tex={tex} nor={nor} shift={[0.006, -0.005]} />
              <Brad />
              <group position={[0, 0.17, 0.006]} rotation={[0, 0, c.arm.wrist]}>
                <Paper shapes={parts.palm} ink={c.headInk} tex={tex} nor={nor} shift={[0.004, -0.003]} />
                {parts.hand.map((l, i) => <Paper key={i} shapes={l.shapes} ink={l.ink} tex={tex} nor={nor} shift={[0.004, -0.003]} z={l.z ?? 0.004} />)}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};

const LIGHTS_STILL: [number, number][] = [[0, 999]];
/** نموذج السجل: `who` = معرّف شخصية أو "all" للمجموعة. إطار ثابت للمراجعة */
export const AlleyCharactersLab: React.FC<{ who: string }> = ({ who }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const nor = useAssetTextures(["balislam-plaster-nor"], [0.25, 0.25]);
  const paper = usePaper(11);
  const list = who === "all" ? ALLEY_CHARACTERS : ALLEY_CHARACTERS.filter((c) => c.id === who);
  const group = list.length > 1;
  const target: V3 = group ? [0, 1.75, 1.6] : [0, 1.35, 0];
  const c = { target, yaw: group ? 0 : -8, pitch: 3, dist: group ? 13.5 : 5.2, fov: group ? 36 : 32 };
  const cam = { position: orbit(c), target, fov: c.fov, focus: c.dist };
  if (!nor) return null;
  const extra = list.map((ch, i) => <AlleyFigure key={ch.id} c={ch} x={group ? -5.0 + i * 2.0 : 0} z={group ? 2.0 : 0} flip={group ? i >= 3 : false} tex={paper} nor={nor[0]} />);
  return (
    <AlleyStage t={t} width={width} height={height} cam={cam} aperture={group ? 0.0015 : 0.012} still={LIGHTS_STILL} calm={0} nor={nor}
      market={group ? null : 1} settle={0} figures={0} enter={0} wobA={0} wobB={0} pose1={{ shoulder: 0, elbow: 0, wrist: 0 }} pose2={{ shoulder: 0, elbow: 0, wrist: 0 }} lit={7} extra={extra} />
  );
};
