/**
 * خارج الاستعمال (قرار المالك، ٢٧ نوفمبر): «بالإسلام» موقوفة وتُبنى من جديد (D235)، فهذه اللقطات محفوظة لا محذوفة،
 * ولا تُسجَّل في SHOTS (index.tsx)، فلا تظهر في مكتبة الاستوديو ولا في قائمة لقطات «حكايات الحارة»،
 * ومشهد يذكر معرّف ep001-* يُرندر بالإخراج العام. اختباراتها تستورد EP001_SHOTS من هنا مباشرة.
 * للاستعادة (بقرار المالك وحده): أعد في index.tsx استيراد EP001_SHOTS و`Object.assign(SHOTS, EP001_SHOTS);`
 * قبل SHOT_IDS، واحذف الاستثناء المسمّى ARCHIVED_EP001 في tests/illus-direction.test.ts. مفاتيحها في legacy من
 * templates/approvals.json باقية كما هي.
 */
import React from "react";
import { ID, darken, mix } from "../palette";
import { Figure, LOOKS, POSES, frontHand, walkPose, type PoseName } from "../Figure";
import { ArchDoor, GROUND, Glow, WordPill } from "../world";
import { AlleyView } from "../places";
import { LightPool } from "../texture";
import { SouqStreet, FruitCart } from "./street";
import { Cafe, CafeTable, Chair, HomeRoom, Workshop } from "./interior";
import { BuzzArcs } from "./phone";
import { K, prog, type CamKey, type ShotCtx } from "./kit";
import {
  Envelope, FullChair, INK, MemoryBubble, Ruler, StoryCat, StoryNotebook, StoryPhone, ThreeCoins, TornLeaf, VendorScale,
  chairFlFloor, chairFrFloor, scalePansBox, CHAIR_SHORT,
} from "../storyProps";

/**
 * لقطات قصة الحلقة 001 المعتمدة تصميمًا (القرار 031، الأمر 032): الميزان، الدفتر والقطة والقطع والظرف،
 * الكرسي، الهاتف، الرد والاعتذار، الجلوس الليلي والاستماع.
 *
 * اللقطة الممتدة: مشاهد متتالية تحمل `seq` واحدًا ومكانًا واحدًا، فتُقطع بلا إظلام (`continues`)،
 * وكل مشهد يبدأ من الحالة التي انتهى إليها سابقه (الأشياء ومواضعها والكاميرا)؛ المعرّفات والنصوص كما هي،
 * ولكل جملة حدثها على كلمتها. لا مدد ثابتة: كل لحظة من `at(كلمة)`، فتتبع الصوت الحقيقي حين يوجد.
 */

/** امتداد عالمي لشخص أو عنصر في لحظة: must = يجب أن يكون كاملًا في الإطار، moving = عابر يدخل أو يخرج */
export type ShotSpan = { id: string; lo: number; hi: number; must?: boolean; moving?: boolean };
type Out = { cam: CamKey[]; world: React.ReactNode; tint?: string; tintOpacity?: number; spans: ShotSpan[] };
type Def = { nameAr: string; place: string; seq: string; render: (c: ShotCtx) => Out };

const hero = LOOKS.hero;
const brother = LOOKS.friend;
const RED = ID.seal;
const GOLD = ID.dawn;

/** مفتاح كاميرا لا يُظهر ما وراء طرف المكان (0..1920) بالاتجاهين */
const KC = (portrait: boolean) => (t: number, x: number, z: number, dy = 0): CamKey => {
  const half = (portrait ? 304 : 960) / z;
  return K(t, Math.max(half, Math.min(1920 - half, x)), z, dy);
};
/** امتداد شخص بمقياسه */
const fig = (id: string, x: number, s: number, o: { must?: boolean; moving?: boolean; w?: number } = {}): ShotSpan => ({ id, lo: x - (o.w ?? 70) * s, hi: x + (o.w ?? 70) * s, must: o.must ?? true, moving: o.moving });
const thing = (id: string, lo: number, hi: number, must = true): ShotSpan => ({ id, lo, hi, must });
const P = (frame: number, a: number, len = 14, e?: (t: number) => number) => prog(frame, a, a + len, e);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp2 = (a: [number, number], b: [number, number], t: number): [number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/* ═════════════ الميزان: c1-s2…c1-s5، والتذكّر c1-s148…c1-s150 ═════════════ */

export const SX = 980;
const SB = GROUND - 150;
const SS = 1.25;
/** حالة الميزان الواحدة في الواقعة والتذكّر (الكفتان مستويتان) */
export const SCALE_TILT = 0;
const VENDOR_X = 1200;
const CUST_X = 750;
const W1_X = 510;
const W2_X = 1460;
const PILL_Y = GROUND - 470;
export const FRUIT_PAN: [number, number] = [SX + 120 * SS, SB + (-238 + 92 - 34) * SS];
const IN_HAND: [number, number] = [SX + 250, GROUND - 268];
const IN_CART: [number, number] = [SX + 170, GROUND - 236];
/**
 * الحاجب في لقطة الأول: صُرّة الزبون في المقدمة (بإحداثيات المشهد). ملاحظة المالك nce96d54edd (١٥ نوفمبر):
 * كان الحاجب دائرة كبيرة تغطي الميزان كله فلا يُرى ما «نظر إليه»؛ الآن صُرّة بقدر الكفة اليسرى والثقل وحدهما،
 * فيبقى ذراع الميزان وكفة الفاكهة ويد البائع ظاهرة.
 */
export const OCCLUDER = { cx: SX - 150, cy: GROUND - 335, rx: 118, ry: 108 };
/** الكفة اليسرى والثقل المختوم: ما يحجبه الكيس عن الأول */
export const WEIGHT_PAN_BOX = (() => {
  const b = scalePansBox(SX, SB, SS);
  return { lo: b.lo, hi: SX - (120 - 52) * SS, top: SB + (-238 + 92 - 53) * SS, bottom: b.bottom };
})();

/** الحبة الزائدة: من كفة الفاكهة إلى يد البائع (lift) ثم إلى العربة (drop) */
const orangeAt = (lift: number, drop: number): [number, number] => (drop > 0 ? lerp2(IN_HAND, IN_CART, drop) : lerp2(FRUIT_PAN, IN_HAND, lift));
const Orange: React.FC<{ p: [number, number]; glow?: number }> = ({ p, glow = 0 }) => (
  <g>
    {glow > 0 ? <Glow cx={p[0]} cy={p[1]} r={70} color={RED} opacity={0.45 * glow} /> : null}
    <circle cx={p[0]} cy={p[1]} r={14} fill={mix(GOLD, RED, 0.3)} stroke={INK} strokeWidth={2.4} />
  </g>
);

type SouqState = { lift: number; drop: number; vendor: PoseName; w1: PoseName; w2: PoseName; pillR: number; pillG: number; dimR?: number; dimG?: number; weightGlow?: number; levelGlow?: number; cust?: number; recall?: boolean };
const souqWorld = (frame: number, st: SouqState) => (
  <g>
    <SouqStreet frame={frame} />
    <FruitCart x={SX + 60} />
    <VendorScale x={SX} base={SB} tilt={SCALE_TILT} s={SS} weightGlow={st.weightGlow ?? 0} levelGlow={st.levelGlow ?? 0} />
    <Figure x={VENDOR_X} y={GROUND + 4} scale={1.15} pose={POSES[st.vendor]} look={LOOKS.vendor} flip frame={frame} />
    <Orange p={orangeAt(st.lift, st.drop)} />
    {(st.cust ?? 1) > 0.01 ? <Figure x={CUST_X} y={GROUND + 6} scale={1.22} pose={POSES.stand} look={LOOKS.stranger} holding="bundle" frame={frame + 5} opacity={st.cust ?? 1} /> : null}
    <Figure x={W1_X} y={GROUND + 6} scale={1.2} pose={POSES[st.w1]} look={hero} frame={frame} />
    <Figure x={W2_X} y={GROUND + 6} scale={1.18} pose={POSES[st.w2]} look={LOOKS.woman} flip frame={frame + 11} />
    <WordPill x={W1_X} y={PILL_Y} text="ظلم" color={RED} size={44} t={st.pillR * (1 - 0.7 * (st.dimR ?? 0))} />
    <WordPill x={W2_X} y={PILL_Y} text="عدل" color={GOLD} size={44} t={st.pillG * (1 - 0.7 * (st.dimG ?? 0))} />
  </g>
);
const souqSpans = (st: { cust?: number }): ShotSpan[] => [fig("witness-1", W1_X, 1.2, { must: false }), fig("witness-2", W2_X, 1.18, { must: false }), fig("vendor", VENDOR_X, 1.15, { must: false }), ...((st.cust ?? 1) > 0.01 ? [fig("customer", CUST_X, 1.22, { must: false, w: 110 })] : [])];

/** لقطة الأول: من خلف كتفه، والكيس يحجب الكفة اليسرى والثقل، فلا يرى إلا اليد والحبة */
const W1View: React.FC<{ frame: number; show: number; orange: [number, number]; pill: number; pillX?: number; speak?: number; pillY?: number; pillSize?: number }> = ({ show, orange, pill, pillX = SX - 380, speak = 0, pillY = 360, pillSize = 44 }) => {
  if (show <= 0.001) return null;
  const { cx, cy, rx, ry } = OCCLUDER;
  return (
    <g opacity={Math.min(1, show * 1.6)}>
      {/* صُرّة مربوطة: جسم مستدير وعنق معقود فوقه */}
      <g data-prop="occluder">
        <path d={`M${cx - rx * 0.32} ${cy - ry * 0.86} C${cx - rx * 1.08} ${cy - ry * 0.7} ${cx - rx * 1.08} ${cy + ry} ${cx} ${cy + ry} C${cx + rx * 1.08} ${cy + ry} ${cx + rx * 1.08} ${cy - ry * 0.7} ${cx + rx * 0.32} ${cy - ry * 0.86} Z`} fill={darken(ID.copper, 0.45)} stroke={INK} strokeWidth={4} />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry * 0.9} fill={darken(ID.copper, 0.45)} />
        <path d={`M${cx - rx * 0.34} ${cy - ry * 0.86} q${rx * 0.34} ${-ry * 0.34} ${rx * 0.68} 0`} fill="none" stroke={INK} strokeWidth={4} />
        <path d={`M${cx - rx * 0.14} ${cy - ry * 1.04} l${rx * 0.14} ${ry * 0.2} l${rx * 0.14} ${-ry * 0.2}`} fill={darken(ID.copper, 0.6)} stroke={INK} strokeWidth={3} />
        <path d={`M${cx - rx * 0.6} ${cy - ry * 0.1} q${rx * 0.5} ${-ry * 0.3} ${rx * 1.1} ${-ry * 0.1}`} fill="none" stroke={darken(ID.copper, 0.6)} strokeWidth={5} />
      </g>
      {/* الأول من خلف كتفه: يتأمل الميزان، وعند «وقال» يشير إليه */}
      <g transform={`translate(${SX - 520} ${GROUND + 300}) scale(2.2)`}>
        <g data-pose="think" opacity={1 - speak}><Figure x={0} y={0} scale={1} pose={POSES.think} look={hero} silhouette={darken(ID.night, 0.4)} shadow={false} /></g>
        {speak > 0.001 ? <g data-pose="point" opacity={speak}><Figure x={0} y={0} scale={1} pose={POSES.point} look={hero} silhouette={darken(ID.night, 0.4)} shadow={false} /></g> : null}
      </g>
      <Glow cx={orange[0]} cy={orange[1]} r={70} color={RED} opacity={0.45} />
      <WordPill x={pillX} y={pillY} text="ظلم" color={RED} size={pillSize} t={pill} />
    </g>
  );
};
/** لقطة الثانية: لا حاجب، والاستواء والثقل ظاهران */
const W2View: React.FC<{ show: number; pill: number; pillX?: number }> = ({ show, pill, pillX = SX + 330 }) =>
  show <= 0.001 ? null : (
    <g opacity={Math.min(1, show * 1.6)}>
      <g transform={`translate(${SX + 640} ${GROUND + 320}) scale(2.5)`}>
        <Figure x={0} y={0} scale={1} pose={POSES.nod} look={LOOKS.woman} flip silhouette={darken(ID.night, 0.35)} shadow={false} />
      </g>
      <WordPill x={pillX} y={360} text="عدل" color={GOLD} size={44} t={pill} />
    </g>
  );

const SCALE_SHOTS: Record<string, Def> = {
  "ep001-scale-weigh": {
    nameAr: "الميزان ١: لحظة واحدة يراها الجميع (البائع يرفع الحبة الزائدة)",
    place: "سوق الميزان",
    seq: "ep001-scale",
    render: ({ frame, at, portrait }) => {
      const tS = at("سوق", 0.12);
      const t2 = at("شخصان", 0.35);
      const tM = at("ميزان", 0.6);
      const tF = at("الفاكهة", 0.85);
      const lift = P(frame, tM, 24);
      const kc = KC(portrait);
      const st: SouqState = { lift, drop: 0, vendor: frame < tM - 4 ? "hold" : "point", w1: "think", w2: frame < t2 + 8 ? "stand" : "nod", pillR: 0, pillG: 0, levelGlow: 0.6 * P(frame, tF, 20) };
      return {
        cam: portrait
          ? [kc(0, SX, 1.12), kc(tS, SX - 200, 1.16), kc(t2, W1_X + 60, 1.2), kc(t2 + 40, W2_X - 60, 1.2), kc(tM, SX + 110, 1.3), kc(tF, SX + 60, 1.36)]
          : [kc(0, SX, 1.08), kc(tS, SX, 1.12), kc(t2, SX, 1.14), kc(tM, SX + 40, 1.3), kc(tF, SX + 20, 1.34)],
        world: (
          <g>
            {souqWorld(frame, st)}
            <LightPool cx={W1_X} cy={GROUND + 10} rx={150} ry={36} color={GOLD} opacity={0.7 * P(frame, t2, 12) * (1 - 0.6 * P(frame, tM, 30))} />
            <LightPool cx={W2_X} cy={GROUND + 10} rx={150} ry={36} color={GOLD} opacity={0.7 * P(frame, t2 + 6, 12) * (1 - 0.6 * P(frame, tM, 30))} />
          </g>
        ),
        spans: souqSpans({}),
      };
    },
  },
  "ep001-scale-witness1": {
    nameAr: "الميزان ٢: ما يراه الأول — الكيس يحجب الوزن، فيرى اليد والحبة: «ظلم»",
    place: "سوق الميزان",
    seq: "ep001-scale",
    render: ({ frame, at, portrait }) => {
      // ملاحظة المالك nce96d54edd: «نظر … إلى الميزان» والميزان ظاهر، والحبة تُرفع منه لحظة «الميزان»،
      // و«وقال» يشير الأول إليه، و«ظلم» بطاقة أكبر بجواره
      const tN = at("نظر", 0.02);
      const tL = at("الميزان", 0.35);
      const tQ = at("وقال", 0.55);
      const tZ = at("ظلم", 0.75);
      const drop = P(frame, tL, 26);
      const kc = KC(portrait);
      const o = orangeAt(1, drop);
      return {
        cam: portrait ? [kc(0, 1080, 2.0, -140), kc(tL, 1150, 2.06, -140), kc(tZ, 1000, 2.0, -140)] : [kc(0, 860, 1.9, -140), kc(tN + 6, 900, 1.96, -140), kc(tL, 950, 2.04, -140), kc(tQ, 880, 2.0, -140), kc(tZ, 860, 2.06, -140)],
        world: (
          <g>
            {souqWorld(frame, { lift: 1, drop, vendor: "point", w1: "think", w2: "nod", pillR: 0, pillG: 0 })}
            <W1View frame={frame} show={1} orange={o} pill={P(frame, tZ, 14)} pillX={portrait ? 1000 : SX - 340} pillY={portrait ? 360 : 380} pillSize={portrait ? 44 : 60} speak={P(frame, tQ - 2, 8)} />
          </g>
        ),
        spans: [thing("pill", (portrait ? 1000 : SX - 340) - 90, (portrait ? 1000 : SX - 340) + 90, frame >= tZ + 20)],
      };
    },
  },
  "ep001-scale-witness2": {
    nameAr: "الميزان ٣: ما تراه الثانية — الكفتان مستويتان والثقل مختوم: «عدل»",
    place: "سوق الميزان",
    seq: "ep001-scale",
    render: ({ frame, at, portrait }) => {
      const tL = at("الميزان", 0.3);
      const tN = at("نفسه", 0.45);
      const tA = at("عدل", 0.8);
      const kc = KC(portrait);
      return {
        cam: portrait ? [kc(0, 1000, 2.0, -140), kc(tL, SX - 100, 2.06, -140), kc(tA, 1250, 2.0, -140)] : [kc(0, 1080, 2.0, -140), kc(tL, 1060, 2.04, -140), kc(tA, 1100, 2.06, -140)],
        world: (
          <g>
            {souqWorld(frame, { lift: 1, drop: 1, vendor: "hold", w1: "think", w2: "nod", pillR: 0, pillG: 0, levelGlow: 0.4 + 0.6 * P(frame, tL, 18), weightGlow: P(frame, tN, 18) })}
            <W2View show={1} pill={P(frame, tA, 14)} pillX={portrait ? 1250 : SX + 330} />
          </g>
        ),
        spans: [thing("pill", (portrait ? 1250 : SX + 330) - 90, (portrait ? 1250 : SX + 330) + 90, frame >= tA + 20)],
      };
    },
  },
  "ep001-scale-verdicts": {
    nameAr: "الميزان ٤: ميزان واحد وحكمان (العمودي: لقطتا الشاهدين بالتتابع)",
    place: "سوق الميزان",
    seq: "ep001-scale",
    render: ({ frame, at, portrait }) => {
      const t1 = at("ميزان", 0.1);
      const t2 = at("وموقف", 0.4);
      const t3 = at("وحكمان", 0.65);
      const kc = KC(portrait);
      if (portrait) {
        // لا يتسع العمودي للشاهدين معًا: لقطة الأول ثم لقطة الثانية، قصيرتين، بالحالة نفسها
        const second = frame >= t3 ? 1 : 0;
        return {
          cam: [kc(0, SX, 1.3), kc(t1, SX, 1.36), kc(t2, 1080, 2.0, -140), kc(t3, 1250, 2.0, -140)],
          world: (
            <g>
              {souqWorld(frame, { lift: 1, drop: 1, vendor: "hold", w1: "think", w2: "nod", pillR: 0, pillG: 0, levelGlow: 0.5 })}
              {frame >= t2 && !second ? <W1View frame={frame} show={1} orange={IN_CART} pill={1} pillX={1080} /> : null}
              {second ? <W2View show={1} pill={1} pillX={1250} /> : null}
            </g>
          ),
          spans: [thing("scale", SX - 160, SX + 160, frame < t2)],
        };
      }
      return {
        cam: [kc(0, SX, 1.18), kc(t1, SX, 1.22), kc(t3, SX, 1.12)],
        world: souqWorld(frame, { lift: 1, drop: 1, vendor: "hold", w1: frame < t3 ? "think" : "point", w2: "nod", pillR: P(frame, t2, 14), pillG: P(frame, t2 + 8, 14), levelGlow: 0.5 * P(frame, t1, 16) }),
        spans: [...souqSpans({}), thing("pill-r", W1_X - 90, W1_X + 90, frame >= t2), thing("pill-g", W2_X - 90, W2_X + 90, frame >= t2)],
      };
    },
  },
};

/** التذكّر: المكان نفسه بالحالة نفسها؛ البطاقتان تبهتان، والثقل المختوم يضيء عند «الحقيقة والدليل» */
const RECALL_TINT = mix(ID.copper, ID.paper, 0.3);
const RECALL_SHOTS: Record<string, Def> = {
  "ep001-scale-recall-1": {
    nameAr: "تذكّر الميزان ١: لم يكن عادلًا لأن أحدهما قال إنه عادل",
    place: "سوق الميزان (ذكرى)",
    seq: "ep001-scale-recall",
    render: ({ frame, at, portrait }) => {
      const tT = at("وتذكر", 0.08);
      const tL = at("الميزان", 0.3);
      const tA = at("عادلا", 0.55);
      const tQ = at("قال", 0.8);
      const kc = KC(portrait);
      return {
        cam: portrait ? [kc(0, SX, 1.3), kc(tT, W1_X + 60, 1.3), kc(tL, SX, 1.3), kc(tA, W2_X - 40, 1.3)] : [kc(0, SX, 1.12), kc(tT, SX, 1.16), kc(tA, SX + 100, 1.2)],
        world: souqWorld(frame, { lift: 1, drop: 1, vendor: "hold", w1: "think", w2: frame < tQ ? "nod" : "talk", pillR: P(frame, tT, 16), pillG: P(frame, tT + 6, 16), dimG: P(frame, tQ + 8, 24), levelGlow: 0.6 * P(frame, tL, 14) * (1 - P(frame, tA, 20)) }),
        tint: RECALL_TINT,
        tintOpacity: 0.22,
        spans: souqSpans({}),
      };
    },
  },
  "ep001-scale-recall-2": {
    nameAr: "تذكّر الميزان ٢: ولم يكن ظالمًا لأن الآخر غضب منه",
    place: "سوق الميزان (ذكرى)",
    seq: "ep001-scale-recall",
    render: ({ frame, at, portrait }) => {
      const tZ = at("ظالما", 0.35);
      const tG = at("غضب", 0.75);
      const kc = KC(portrait);
      return {
        cam: portrait ? [kc(0, W2_X - 40, 1.3), kc(tZ, W1_X + 40, 1.3)] : [kc(0, SX + 100, 1.2), kc(tZ, SX - 120, 1.2)],
        world: souqWorld(frame, { lift: 1, drop: 1, vendor: "hold", w1: frame < tG ? "think" : "point", w2: "talk", pillR: 1, pillG: 1, dimG: 1, dimR: P(frame, tG + 8, 24) }),
        tint: RECALL_TINT,
        tintOpacity: 0.22,
        spans: souqSpans({}),
      };
    },
  },
  "ep001-scale-recall-3": {
    nameAr: "تذكّر الميزان ٣: الحكم بالحقيقة والدليل — الثقل المختوم يستقر",
    place: "سوق الميزان (ذكرى)",
    seq: "ep001-scale-recall",
    render: ({ frame, at, portrait }) => {
      const tG = at("الحكم", 0.15);
      const tH = at("الحقيقة", 0.35);
      const tD = at("والدليل", 0.45);
      const tV = at("الصوت", 0.65);
      const tI = at("الاقتناع", 0.92);
      const kc = KC(portrait);
      return {
        cam: portrait ? [kc(0, W1_X + 40, 1.3), kc(tH, SX, 1.5, -60), kc(tD, SX - 120, 1.9, -120)] : [kc(0, SX - 120, 1.2), kc(tH, SX, 1.4, -50), kc(tD, SX - 60, 1.7, -110)],
        world: souqWorld(frame, { lift: 1, drop: 1, vendor: frame < tG ? "hold" : "point", w1: frame < tI ? "think" : "nod", w2: frame < tI ? "talk" : "nod", pillR: 1 - P(frame, tV, 20), pillG: 1 - P(frame, tV + 6, 20), dimG: 1, dimR: 1, levelGlow: P(frame, tH, 18), weightGlow: P(frame, tD, 18) }),
        tint: RECALL_TINT,
        tintOpacity: 0.22 * (1 - P(frame, tD, 30)),
        spans: [thing("scale", SX - 220, SX + 220, !portrait || frame < tH)],
      };
    },
  },
};

/* ═════════════ البيت: الدفتر والقطة والقطع والظرف (c1-s39…c1-s57، c1-s78، c1-s79، c1-s105…c1-s107) ═════════════ */

const DESK_X = 1590;
const NB: [number, number] = [1520, GROUND - 252];
const NB_S = 1.2;
const HERO_X = 1210;
const BRO_X = 860;
const LEAF_FLOOR: [number, number] = [1330, GROUND - 6];
const CAT_X = 1770;
const ENV_DESK: [number, number] = [1660, GROUND - 262];
/** طرف المكتب: حيث يبقى الظرف المغلق بعد c1-s56 */
const ENV_CORNER = 1722;
const DESK_HERO = 1500;

const Desk: React.FC = () => (
  <g>
    <rect x={DESK_X - 170} y={GROUND - 250} width={340} height={22} fill={darken(ID.copper, 0.3)} stroke={INK} strokeWidth={3} />
    <rect x={DESK_X - 160} y={GROUND - 228} width={18} height={228} fill={darken(ID.copper, 0.4)} />
    <rect x={DESK_X + 142} y={GROUND - 228} width={18} height={228} fill={darken(ID.copper, 0.4)} />
  </g>
);

/**
 * حالة البيت في لحظة: كل مشهد يبدأ من حالة نهاية سابقه.
 * coinsWith: من يحمل القطع (brother / hero / envelope)، envOpen: الظرف (null = لم يظهر بعد)
 */
type HomeState = {
  mood: "dusk" | "night";
  tear: number;
  leaf: "floor" | "hand" | "desk";
  bro: number; // 0 غائب، 1 حاضر
  broX: number;
  broPose: PoseName;
  broWalk?: number; // طور المشي إن كان يمشي
  broFlip?: boolean;
  heroX: number;
  heroPose: PoseName;
  heroFlip?: boolean;
  heroHold: "leaf" | "three-coins" | "envelope" | "none";
  cat?: number; // 0 غائبة، 1 على المكتب
  catX?: number;
  catPaw?: [number, number];
  catCrouch?: number;
  ripped?: boolean; // الصفحة الثانية في قائمة القطة
  env?: { open: number; x: number; y: number; glow?: number } | null;
  door?: number;
  ghost?: number;
};

const homeWorld = (frame: number, st: HomeState, extra?: React.ReactNode) => {
  const bPose = st.broWalk !== undefined ? walkPose(POSES.stand, st.broWalk) : POSES[st.broPose];
  return (
    <g>
      <HomeRoom frame={frame} mood={st.mood} door={st.door ?? 0} />
      <Desk />
      <StoryNotebook x={NB[0]} y={NB[1]} s={NB_S} tear={st.tear} />
      {st.leaf === "floor" ? <TornLeaf x={LEAF_FLOOR[0]} y={LEAF_FLOOR[1]} s={0.42} rot={8} claws="faint" /> : null}
      {st.leaf === "desk" ? <TornLeaf x={1350} y={GROUND - 256} s={0.42} rot={-4} claws="faint" /> : null}
      {st.env ? <Envelope x={st.env.x} y={st.env.y} w={64} open={st.env.open} glow={st.env.glow ?? 0} /> : null}
      {(st.cat ?? 0) > 0.01 ? (
        <g opacity={Math.min(1, (st.cat ?? 0) * 1.5)}>
          <StoryCat x={st.catX ?? CAT_X} y={GROUND - 252} s={1} paw={st.catPaw ?? [1700, GROUND - 268]} crouch={st.catCrouch ?? 0} tail={Math.sin(frame / 18)} />
          {st.ripped ? <TornLeaf x={(st.catPaw ?? [1700, 0])[0]} y={(st.catPaw ?? [0, GROUND - 330])[1] + 30} rot={-20} s={0.9} claws="clear" /> : null}
        </g>
      ) : null}
      {st.ghost && st.ghost > 0.01 ? <Figure x={140} y={GROUND + 6} scale={1.16} pose={POSES.stand} look={brother} silhouette={mix(ID.night, ID.copper, 0.3)} opacity={0.55 * st.ghost} shadow={false} /> : null}
      {st.bro > 0.01 ? <Figure x={st.broX} y={GROUND + 6} scale={1.16} pose={bPose} look={brother} flip={st.broFlip} frame={frame + 9} opacity={Math.min(1, st.bro)} /> : null}
      <Figure x={st.heroX} y={GROUND + 6} scale={1.2} pose={POSES[st.heroPose]} look={hero} flip={st.heroFlip} frame={frame} holding={st.heroHold} />
      {extra}
    </g>
  );
};
const homeSpans = (st: HomeState): ShotSpan[] => [
  fig("hero", st.heroX, 1.2),
  ...(st.bro > 0.01 ? [fig("brother", st.broX, 1.16, { must: false, moving: st.broWalk !== undefined })] : []),
  ...((st.cat ?? 0) > 0.01 ? [thing("cat", (st.catX ?? CAT_X) - 100, (st.catX ?? CAT_X) + 90, false)] : []),
];

/** القطع الثلاث تنتقل من كف إلى كف (frontHand) */
const CoinsFlight: React.FC<{ from: [number, number]; to: [number, number]; t: number }> = ({ from, to, t }) => {
  if (t <= 0 || t >= 1) return null;
  const p = lerp2(from, to, t);
  return <ThreeCoins x={p[0]} y={p[1] - 40 * Math.sin(Math.PI * t)} r={9} tilt={0.6} />;
};

/** إدراج المقارنة T5: الورقة التي اتهم بها أخاه بجانب الصفحة التي نزعتها القطة الآن */
const CompareInsert: React.FC<{ show: number; cx: number; cy: number; s: number }> = ({ show, cx, cy, s }) =>
  show <= 0.001 ? null : (
    <g data-prop="compare-insert" opacity={Math.min(1, show * 1.5)} transform={`translate(${cx} ${cy}) scale(${s * (0.85 + 0.15 * show)}) translate(${-cx} ${-cy})`}>
      <rect x={cx - 300} y={cy - 150} width={600} height={290} rx={18} fill={mix(ID.paper, ID.copper, 0.3)} stroke={GOLD} strokeWidth={6} />
      <TornLeaf x={cx - 70} y={cy + 40} s={1.8} claws="clear" />
      <TornLeaf x={cx + 170} y={cy + 48} rot={4} s={1.8} claws="clear" />
    </g>
  );

const HOME = "بيت الأخوين";
const HOME_SHOTS: Record<string, Def> = {
  "ep001-home-found": {
    nameAr: "الدفتر ١: يجد دفتره ممزقًا",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tB = at("بيت", 0.12);
      const tW = at("وجد", 0.4);
      const tD = at("ممزقا", 0.8);
      const kc = KC(portrait);
      const st: HomeState = { mood: "dusk", tear: 0, leaf: "floor", bro: 0, broX: BRO_X, broPose: "stand", heroX: lerp(1000, HERO_X, P(frame, tB, 40)), heroPose: frame < tW ? "stand" : frame < tD ? "look-up" : "think", heroHold: "none" };
      return {
        cam: portrait ? [kc(0, 1060, 1.2), kc(tW, 1300, 1.3), kc(tD, NB[0] - 40, 1.7, -60)] : [kc(0, 1240, 1.2), kc(tW, 1340, 1.32), kc(tD, 1440, 1.6, -40)],
        world: homeWorld(frame, st, <Glow cx={NB[0]} cy={NB[1] - 40} r={140} color={GOLD} opacity={0.5 * P(frame, tD, 16)} />),
        spans: homeSpans(st),
      };
    },
  },
  "ep001-home-leaf": {
    nameAr: "الدفتر ٢: يرفع الورقة (خدوش باهتة لا ينتبه إليها) ويتذكر أخاه",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tO = at("الأوراق", 0.2);
      const tA = at("أخاه", 0.6);
      const tR = at("الغرفة", 0.9);
      const kc = KC(portrait);
      const picked = frame >= tO + 10;
      const st: HomeState = { mood: "dusk", tear: 0, leaf: picked ? "hand" : "floor", bro: 0, broX: BRO_X, broPose: "stand", heroX: HERO_X, heroPose: frame < tO - 4 ? "think" : frame < tO + 10 ? "sit-low" : frame < tA ? "hold" : "think", heroFlip: frame >= tA, heroHold: picked ? "leaf" : "none", door: P(frame, tR - 6, 18) };
      return {
        cam: portrait
          ? [kc(0, NB[0] - 40, 1.7, -60), kc(tO, LEAF_FLOOR[0], 1.5), kc(tO + 16, HERO_X + 60, 2.6, -150), kc(tA, HERO_X - 60, 1.3)]
          : [kc(0, 1440, 1.6, -40), kc(tO, 1300, 1.5), kc(tO + 16, HERO_X + 70, 2.4, -150), kc(tA, 980, 1.2)],
        world: homeWorld(frame, st),
        spans: homeSpans(st),
      };
    },
  },
  "ep001-home-accuse": {
    nameAr: "الاتهام ١: يدخل الأخ، والإصبع يشير والورقة في اليد",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tG = at("غضب", 0.3);
      const tI = at("اتهمه", 0.55);
      const tF = at("الدفتر", 0.9);
      const kc = KC(portrait);
      const walkEnd = Math.max(8, tG - 4);
      const bx = lerp(-40, BRO_X, P(frame, 0, walkEnd));
      const walking = frame < walkEnd;
      const st: HomeState = { mood: "dusk", tear: 0, leaf: "hand", bro: 1, broX: bx, broPose: walking ? "stand" : frame < tI ? "stand" : "flinch", broWalk: walking ? (frame / 30) * Math.PI * 2 * 0.95 : undefined, heroX: HERO_X, heroPose: frame < tI ? "cross" : "point", heroFlip: true, heroHold: "leaf", door: 1 - P(frame, walkEnd, 20) };
      return {
        cam: portrait ? [kc(0, HERO_X - 20, 1.3), kc(tI, HERO_X - 40, 1.4), kc(tF, BRO_X + 30, 1.4)] : [kc(0, 980, 1.2), kc(tI, 1040, 1.3), kc(tF, 1030, 1.34)],
        world: homeWorld(frame, st),
        spans: homeSpans(st),
      };
    },
  },
  "ep001-home-denies": {
    nameAr: "الاتهام ٢: الأخ ينكر",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tQ = at("قال", 0.2);
      const tN = at("يفعل", 0.7);
      const kc = KC(portrait);
      const st: HomeState = { mood: "dusk", tear: 0, leaf: "hand", bro: 1, broX: BRO_X, broPose: frame < tQ ? "flinch" : frame < tN ? "talk" : "halt", heroX: HERO_X, heroPose: "point", heroFlip: true, heroHold: "leaf" };
      return {
        cam: portrait ? [kc(0, BRO_X + 30, 1.4), kc(tN, BRO_X + 10, 1.5)] : [kc(0, 1030, 1.34), kc(tN, 1000, 1.42)],
        world: homeWorld(frame, st),
        spans: homeSpans(st),
      };
    },
  },
  "ep001-home-not-ready": {
    nameAr: "الاتهام ٣: لم يكن مستعدًا لسماع تفسير آخر (يتكتّف)",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tM = at("مستعدا", 0.45);
      const tT = at("تفسير", 0.75);
      const kc = KC(portrait);
      const st: HomeState = { mood: "dusk", tear: 0, leaf: "hand", bro: 1, broX: BRO_X, broPose: frame < tT ? "halt" : "talk", heroX: HERO_X, heroPose: frame < tM ? "point" : "cross", heroFlip: true, heroHold: "leaf" };
      return {
        cam: portrait ? [kc(0, BRO_X + 10, 1.5), kc(tM, HERO_X - 30, 1.5)] : [kc(0, 1000, 1.42), kc(tM, 1110, 1.5)],
        world: homeWorld(frame, st),
        spans: homeSpans(st),
      };
    },
  },
  "ep001-home-waits": {
    nameAr: "الاتهام ٤: كوّن حكمه وينتظر أن يعترف أخوه (يمد يده)",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tK = at("حكمه", 0.25);
      const tW = at("ينتظر", 0.5);
      const tI = at("يعترف", 0.85);
      const kc = KC(portrait);
      const st: HomeState = { mood: "dusk", tear: 0, leaf: "hand", bro: 1, broX: BRO_X, broPose: frame < tW ? "talk" : "think", heroX: HERO_X, heroPose: frame < tW ? "cross" : frame < tI ? "proud" : "hold", heroFlip: true, heroHold: "leaf" };
      return {
        cam: portrait ? [kc(0, HERO_X - 30, 1.5), kc(tK, HERO_X - 10, 1.6), kc(tI, HERO_X - 90, 1.4)] : [kc(0, 1110, 1.5), kc(tW, 1060, 1.36), kc(tI, 1040, 1.4)],
        world: homeWorld(frame, st),
        spans: homeSpans(st),
      };
    },
  },
  "ep001-home-demand": {
    nameAr: "الاتهام ٥: يطلب ثلاث قطع، والأخ يُخرجها",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tT = at("طلب", 0.2);
      const tC = at("نقدية", 0.45);
      const tA = at("أتلفه", 0.85);
      const kc = KC(portrait);
      const bp: PoseName = frame < tC - 6 ? "think" : "hold";
      const st: HomeState = { mood: "dusk", tear: 0, leaf: "hand", bro: 1, broX: BRO_X, broPose: bp, heroX: HERO_X, heroPose: frame < tT ? "hold" : "point", heroFlip: true, heroHold: "leaf" };
      const bh = frontHand(POSES.hold, BRO_X, GROUND + 6, 1.16, false);
      const coins = P(frame, tC, 12);
      return {
        cam: portrait ? [kc(0, HERO_X - 90, 1.4), kc(tC, BRO_X + 40, 1.6), kc(tA, BRO_X + 80, 1.5)] : [kc(0, 1040, 1.4), kc(tC, 1000, 1.5), kc(tA, 1020, 1.42)],
        world: homeWorld(frame, st, frame >= tC ? <ThreeCoins x={bh[0] + 14} y={bh[1] - 6} r={7} tilt={0.6} opacity={coins} lift={6 * (1 - coins)} /> : null),
        spans: homeSpans(st),
      };
    },
  },
  "ep001-home-gives": {
    nameAr: "الاتهام ٦: القطع الثلاث تنتقل من كف الأخ إلى كفه",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tG = at("أعطاه", 0.15);
      const tM = at("المال", 0.4);
      const tE = at("الجدال", 0.85);
      const kc = KC(portrait);
      const fly = P(frame, tM, 22);
      const st: HomeState = { mood: "dusk", tear: 0, leaf: "hand", bro: 1, broX: BRO_X, broPose: frame < tM + 22 ? "hold" : frame < tE ? "stand" : "turn-away", heroX: HERO_X, heroPose: frame < tG ? "point" : "hold", heroFlip: true, heroHold: fly >= 1 ? "three-coins" : "leaf" };
      const from = frontHand(POSES.hold, BRO_X, GROUND + 6, 1.16, false);
      const to = frontHand(POSES.hold, HERO_X, GROUND + 6, 1.2, true);
      return {
        cam: portrait ? [kc(0, BRO_X + 80, 1.5), kc(tM - 6, (BRO_X + HERO_X) / 2, 2.0, -130), kc(tE, HERO_X - 40, 1.5)] : [kc(0, 1020, 1.42), kc(tM - 6, 1035, 2.0, -130), kc(tE, 1060, 1.4)],
        world: homeWorld(frame, st, (
          <g>
            {fly <= 0 ? <ThreeCoins x={from[0] + 14} y={from[1] - 6} r={7} tilt={0.6} /> : null}
            <CoinsFlight from={[from[0] + 14, from[1] - 6]} to={[to[0] - 10, to[1] - 4]} t={fly} />
            {/* الورقة توضع على المكتب حين تمتلئ الكف بالقطع */}
          </g>
        )),
        spans: homeSpans(st),
      };
    },
  },
  "ep001-home-brother-leaves": {
    nameAr: "بعد الجدال: الأخ يخرج، والشاب يعدّ القطع، ثم ينظر إلى النافذة",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait, dur }) => {
      const tK = at("تكن", 0.25);
      const tH = at("الحقيقة", 0.5);
      const tA = at("بعد", 0.85);
      const kc = KC(portrait);
      const out = P(frame, 0, Math.max(40, tH));
      const bx = lerp(BRO_X, -120, out);
      const walking = out > 0 && out < 1;
      const st: HomeState = { mood: "dusk", tear: 0, leaf: "desk", bro: out < 1 ? 1 : 0, broX: bx, broPose: "turn-away", broWalk: walking ? (frame / 30) * Math.PI * 2 * 0.95 : undefined, broFlip: true, heroX: HERO_X, heroPose: frame < tH ? "hold" : "look-up", heroFlip: frame < tH, heroHold: "three-coins", cat: P(frame, tA - 10, Math.max(12, dur - tA)), catX: lerp(2040, CAT_X, P(frame, tA - 10, Math.max(12, dur - tA))), door: 0.4 * (1 - out) };
      return {
        cam: portrait ? [kc(0, HERO_X - 40, 1.6), kc(tK, HERO_X, 2.0, -120), kc(tA, 1500, 1.5)] : [kc(0, 1060, 1.4), kc(tK, HERO_X, 1.9, -110), kc(tA, 1440, 1.36)],
        world: homeWorld(frame, st, <Glow cx={1590} cy={GROUND - 500} r={260} color={GOLD} opacity={0.35 * P(frame, tH, 20)} />),
        spans: [fig("hero", HERO_X, 1.2), ...(out < 1 ? [fig("brother", bx, 1.16, { must: false, moving: true })] : []), thing("cat", st.catX! - 100, st.catX! + 90, false)].map((s) => (s.id === "cat" ? { ...s, moving: frame < tA + 20 } : s)),
      };
    },
  },
  "ep001-home-cat-hook": {
    nameAr: "القطة ١: تعبث بأوراق الدفتر عند النافذة، وتعلق مخلبها بالصفحة",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tR = at("رأى", 0.25);
      const tQ = at("تعبث", 0.55);
      const tN = at("النافذة", 0.85);
      const kc = KC(portrait);
      const reach = P(frame, tQ, 16);
      const st: HomeState = { mood: "dusk", tear: 0, leaf: "desk", bro: 0, broX: BRO_X, broPose: "stand", heroX: HERO_X, heroPose: frame < tR ? "look-up" : "think", heroHold: "three-coins", cat: 1, catX: CAT_X, catPaw: lerp2([1730, GROUND - 268], [1646, GROUND - 322], reach), catCrouch: 0.3 * reach };
      return {
        cam: portrait ? [kc(0, 1500, 1.5), kc(tQ, 1625, 1.15, -40), kc(tN, 1640, 1.18, -40)] : [kc(0, 1440, 1.36), kc(tQ, 1560, 2.2, -50), kc(tN, 1580, 2.3, -50)],
        world: homeWorld(frame, st),
        spans: [thing("cat", CAT_X - 100, CAT_X + 90, frame >= tQ + 22), thing("notebook", NB[0] - 130, NB[0] + 130, !portrait && frame >= tQ + 22)],
      };
    },
  },
  "ep001-home-cat-rip": {
    nameAr: "القطة ٢: آثار المخالب، تشد فتنشق، تنزع الصفحة، ثم المقارنة",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tC = at("مخالبها", 0.25);
      const tP = at("تشد", 0.5);
      const tX = at("فتمزقها", 0.72);
      const kc = KC(portrait);
      const pull = P(frame, tP, 18);
      const off = P(frame, tX, 10);
      const tear = off >= 1 ? 1 : 0.5 * pull + 0.49 * off;
      const paw: [number, number] = off >= 1 ? lerp2([1640, GROUND - 372], [1700, GROUND - 330], P(frame, tX + 10, 14)) : lerp2([1646, GROUND - 322], [1640, GROUND - 372], pull);
      const st: HomeState = { mood: "dusk", tear, leaf: "desk", bro: 0, broX: BRO_X, broPose: "stand", heroX: HERO_X, heroPose: frame < tX ? "think" : "hold", heroHold: "three-coins", cat: 1, catX: CAT_X, catPaw: paw, catCrouch: frame < tP ? 0.3 + 0.3 * P(frame, tC, 10) : 0.6 * (1 - off), ripped: off >= 1 };
      return {
        cam: portrait
          ? [kc(0, 1660, 2.3, -60), kc(tP, 1640, 2.4, -60), kc(tX + 8, 1500, 1.5)]
          : [kc(0, 1580, 2.3, -50), kc(tP, 1560, 2.4, -50), kc(tX + 8, 1420, 1.6)],
        world: homeWorld(frame, st),
        spans: [fig("hero", HERO_X, 1.2, { must: false }), thing("cat", CAT_X - 100, CAT_X + 90, false)],
      };
    },
  },
  "ep001-home-stops": {
    nameAr: "يتوقف: اتهم أخاه وأخذ ماله بلا دليل (القطع في كفه)",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tS = at("توقف", 0.08);
      const tL = at("لقد", 0.2);
      const tM = at("المال", 0.5);
      const tD = at("دليلا", 0.85);
      const kc = KC(portrait);
      const st: HomeState = { mood: "dusk", tear: 1, leaf: "desk", bro: 0, broX: BRO_X, broPose: "stand", heroX: HERO_X, heroPose: frame < tS + 6 ? "hold" : frame < tM ? "halt" : "hold", heroHold: "three-coins", cat: 1 - P(frame, tS, 30), catX: lerp(CAT_X, 2060, P(frame, tS, 30)), catPaw: [1700, GROUND - 268], ripped: false };
      const hand = frontHand(POSES.hold, HERO_X, GROUND + 6, 1.2, false);
      // إدراج المقارنة (T5) بين التمزيق والتوقف: الحافتان والخدوش متطابقة، ثم يعود الإطار إليه
      const insert = 1 - P(frame, tL + 6, 14);
      const IS = portrait ? 0.5 : 0.9;
      const ICX = portrait ? 1400 : 1440;
      return {
        cam: portrait ? [kc(0, 1400, 1.5, -150), kc(tL + 6, HERO_X, 1.6), kc(tM, hand[0], 2.6, -170), kc(tD, 1350, 2.0, -110)] : [kc(0, 1440, 1.9, -150), kc(tL + 6, HERO_X + 40, 1.6), kc(tM, hand[0], 2.4, -170), kc(tD, 1330, 1.9, -110)],
        world: homeWorld(frame, st, <g><CompareInsert show={insert} cx={ICX} cy={GROUND - 470} s={IS} /><Glow cx={hand[0] + 10} cy={hand[1] - 6} r={70} color={GOLD} opacity={0.6 * P(frame, tM, 14)} /><Glow cx={1350} cy={GROUND - 270} r={90} color={GOLD} opacity={0.5 * P(frame, tD, 14)} /></g>),
        spans: [...(insert > 0.5 ? [thing("insert", ICX - 300 * IS, ICX + 300 * IS)] : []), fig("hero", HERO_X, 1.2, { must: frame >= tL + 30 && frame < tM }), thing("cat", (st.catX ?? CAT_X) - 100, (st.catX ?? CAT_X) + 90, false)].map((s) => (s.id === "cat" ? { ...s, moving: true } : s)),
      };
    },
  },
  "ep001-home-test": {
    nameAr: "اختبار مختلف: القطع في كفه",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tL = at("اللحظة", 0.3);
      const tX = at("اختبار", 0.6);
      const kc = KC(portrait);
      const hand = frontHand(POSES.hold, HERO_X, GROUND + 6, 1.2, false);
      const st: HomeState = { mood: "dusk", tear: 1, leaf: "desk", bro: 0, broX: BRO_X, broPose: "stand", heroX: HERO_X, heroPose: frame < tL ? "hold" : "think", heroHold: "three-coins" };
      return {
        cam: portrait ? [kc(0, 1350, 2.0, -110), kc(tL, hand[0], 2.6, -170), kc(tX, hand[0] + 20, 2.8, -180)] : [kc(0, 1330, 1.9, -110), kc(tL, hand[0], 2.5, -170), kc(tX, hand[0] + 20, 2.7, -180)],
        world: homeWorld(frame, st, <Glow cx={hand[0] + 10} cy={hand[1] - 6} r={80} color={GOLD} opacity={0.4 + 0.3 * P(frame, tX, 14)} />),
        spans: [thing("hand", hand[0] - 40, hand[0] + 60)],
      };
    },
  },
  "ep001-home-question-who": {
    nameAr: "لم يعد السؤال من أفسد الدفتر: نظرة إلى الدفتر",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tQ = at("السؤال", 0.3);
      const tD = at("الدفتر", 0.8);
      const kc = KC(portrait);
      const st: HomeState = { mood: "dusk", tear: 1, leaf: "desk", bro: 0, broX: BRO_X, broPose: "stand", heroX: HERO_X, heroPose: frame < tQ ? "think" : "think", heroHold: "three-coins" };
      return {
        cam: portrait ? [kc(0, 1300, 2.6, -170), kc(tQ, HERO_X + 40, 1.7), kc(tD, NB[0] - 60, 1.9, -60)] : [kc(0, 1290, 2.6, -170), kc(tQ, HERO_X + 120, 1.6), kc(tD, 1440, 1.8, -50)],
        world: homeWorld(frame, st, <Glow cx={NB[0]} cy={NB[1] - 40} r={150} color={GOLD} opacity={0.45 * P(frame, tD, 16)} />),
        spans: [fig("hero", HERO_X, 1.2, { must: false }), thing("notebook", NB[0] - 130, NB[0] + 130, frame >= tD + 20)],
      };
    },
  },
  "ep001-home-question-now": {
    nameAr: "بل ماذا سيفعل الآن: نظرة إلى الباب",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tW = at("سيفعل", 0.3);
      const tJ = at("متعجلا", 0.85);
      const kc = KC(portrait);
      const st: HomeState = { mood: "dusk", tear: 1, leaf: "desk", bro: 0, broX: BRO_X, broPose: "stand", heroX: HERO_X, heroPose: frame < tW ? "think" : frame < tJ ? "look-up" : "cross", heroFlip: frame >= tW, heroHold: "three-coins", door: 0.6 * P(frame, tW, 20) };
      return {
        cam: portrait ? [kc(0, NB[0] - 60, 1.9, -60), kc(tW, HERO_X - 80, 1.4), kc(tJ, HERO_X - 20, 1.6)] : [kc(0, 1440, 1.8, -50), kc(tW, 1000, 1.24), kc(tJ, 1080, 1.4)],
        world: homeWorld(frame, st),
        spans: [fig("hero", HERO_X, 1.2)],
      };
    },
  },
  "ep001-home-could": {
    nameAr: "كان يستطيع: الباب يضيء والقطع في كفه (خطوة ثم يتوقف)",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tG = at("يذهب", 0.3);
      const tR = at("ويعيد", 0.6);
      const tA = at("ويعتذر", 0.85);
      const kc = KC(portrait);
      const step = P(frame, tG, 30) - P(frame, tA + 6, 20) * 0.6;
      const hx = HERO_X - 120 * step;
      const st: HomeState = { mood: "dusk", tear: 1, leaf: "desk", bro: 0, broX: BRO_X, broPose: "stand", heroX: hx, heroPose: frame < tR ? "stand" : frame < tA ? "hold" : "think", heroFlip: true, heroHold: "three-coins", door: 0.6 + 0.4 * P(frame, tG, 20) };
      return {
        cam: portrait ? [kc(0, HERO_X - 20, 1.6), kc(tG, HERO_X - 140, 1.4), kc(tA, HERO_X - 100, 1.5)] : [kc(0, 1080, 1.4), kc(tG, 980, 1.3), kc(tA, 1020, 1.36)],
        world: homeWorld(frame, st),
        spans: [fig("hero", hx, 1.2)],
      };
    },
  },
  "ep001-home-envelope": {
    nameAr: "الظرف: يضع القطع الثلاث في ظرف صغير ويغلقه بالختم",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tN = at("يفعل", 0.2);
      const tW = at("وضع", 0.35);
      const tE = at("ظرف", 0.6);
      const tD = at("وأجل", 0.82);
      const kc = KC(portrait);
      // يلتفت عن الباب ويمشي إلى المكتب (من موضعه في نهاية c1-s54)
      const walkEnd = Math.max(tN + 20, tW - 2);
      const go = P(frame, tN - 6, walkEnd - tN + 6, (t) => t);
      const hx = lerp(HERO_X - 72, DESK_HERO, go);
      const walking = go > 0 && go < 1;
      const envShow = P(frame, tW, 12);
      const coinsIn = P(frame, tE, 18);
      const close = P(frame, tD, 16);
      const open = envShow > 0 ? 1 - close : 0;
      const st: HomeState = { mood: "dusk", tear: 1, leaf: "desk", bro: 0, broX: BRO_X, broPose: "stand", heroX: hx, heroPose: frame < tN - 6 ? "think" : walking ? "stand" : frame < tD + 16 ? "hold" : "turn-away", heroFlip: frame < tN - 6, heroHold: coinsIn > 0 ? "none" : "three-coins", env: envShow > 0 ? { open, x: ENV_DESK[0], y: ENV_DESK[1] } : null };
      const hand = frontHand(POSES.hold, DESK_HERO, GROUND + 6, 1.2, false);
      return {
        cam: portrait ? [kc(0, HERO_X - 60, 1.5), kc(tN, 1360, 1.4), kc(tW, ENV_DESK[0] - 50, 2.3, -150), kc(tD + 20, 1600, 1.8, -90)] : [kc(0, 1060, 1.36), kc(tN, 1300, 1.36), kc(tW, 1600, 2.2, -150), kc(tD + 20, 1560, 1.8, -90)],
        world: homeWorld(frame, { ...st, heroPose: walking ? "stand" : st.heroPose }, coinsIn > 0 && coinsIn < 1 ? <CoinsFlight from={[hand[0] + 10, hand[1] - 4]} to={[ENV_DESK[0], ENV_DESK[1] - 10]} t={coinsIn} /> : null),
        spans: [fig("hero", hx, 1.2, { must: false, moving: walking }), thing("envelope", ENV_DESK[0] - 40, ENV_DESK[0] + 40, frame >= tW + 22)],
      };
    },
  },
  "ep001-home-later": {
    nameAr: "سأفعل ذلك لاحقًا: يدفع الظرف إلى طرف المكتب ويلتفت",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tS = at("سأفعل", 0.3);
      const tL = at("لاحقا", 0.75);
      const kc = KC(portrait);
      const push = P(frame, tS, 20);
      const st: HomeState = { mood: "dusk", tear: 1, leaf: "desk", bro: 0, broX: BRO_X, broPose: "stand", heroX: DESK_HERO, heroPose: frame < tS ? "turn-away" : frame < tL ? "hold" : "turn-away", heroFlip: frame >= tL, heroHold: "none", env: { open: 0, x: lerp(ENV_DESK[0], ENV_CORNER, push), y: ENV_DESK[1] } };
      return {
        cam: portrait ? [kc(0, 1600, 1.8, -90), kc(tS, 1660, 2.0, -110), kc(tL, DESK_HERO, 1.5)] : [kc(0, 1560, 1.8, -90), kc(tS, 1600, 1.9, -110), kc(tL, 1380, 1.4)],
        world: homeWorld(frame, st),
        spans: [fig("hero", DESK_HERO, 1.2, { must: false }), thing("envelope", ENV_CORNER - 40, ENV_CORNER + 40, frame < tL)],
      };
    },
  },
  "ep001-home-why": {
    nameAr: "«لماذا لم تصدقني؟»: طيف الأخ في الباب",
    place: HOME,
    seq: "ep001-notebook",
    render: ({ frame, at, portrait }) => {
      const tK = at("خشي", 0.3);
      const tW = at("لماذا", 0.7);
      const kc = KC(portrait);
      const st: HomeState = { mood: "dusk", tear: 1, leaf: "desk", bro: 0, broX: BRO_X, broPose: "stand", heroX: DESK_HERO, heroPose: frame < tK ? "turn-away" : frame < tW ? "think" : "think", heroFlip: true, heroHold: "none", env: { open: 0, x: ENV_CORNER, y: ENV_DESK[1] }, door: 0.5 * P(frame, tW, 16), ghost: P(frame, tW, 18) };
      return {
        cam: portrait ? [kc(0, DESK_HERO, 1.5), kc(tW, 330, 1.3)] : [kc(0, 1380, 1.4), kc(tK, 1200, 1.24), kc(tW, 800, 1.1)],
        world: homeWorld(frame, st),
        spans: [fig("hero", DESK_HERO, 1.2, { must: false }), fig("ghost", 140, 1.16, { must: false })],
      };
    },
  },
  "ep001-home-envelope-explains": {
    nameAr: "الظرف المغلق يشرح الفرق (القطع داخله لا تُرى)",
    place: "بيت الأخوين (عمق)",
    seq: "ep001-envelope-deep",
    render: ({ frame, at, portrait }) => {
      const tC = at("القطع", 0.15);
      const tW = at("وضعها", 0.4);
      const tE = at("الظرف", 0.55);
      const tX = at("تشرح", 0.7);
      const tF = at("الفرق", 0.85);
      const kc = KC(portrait);
      const ex = ENV_CORNER;
      const st: HomeState = { mood: "night", tear: 1, leaf: "desk", bro: 0, broX: BRO_X, broPose: "stand", heroX: DESK_HERO - 60, heroPose: frame < tW ? "think" : frame < tE ? "look-up" : frame < tX ? "hold" : "think", heroHold: "none", env: { open: 0, x: ex, y: ENV_DESK[1], glow: P(frame, tC, 14) * (1 - 0.5 * P(frame, tF, 20)) } };
      return {
        cam: portrait ? [kc(0, HERO_X + 120, 1.5), kc(tC, ex - 40, 2.4, -160), kc(tF, ex - 100, 2.0, -110)] : [kc(0, 1260, 1.4), kc(tC, ex - 60, 2.3, -160), kc(tF, ex - 160, 1.9, -110)],
        world: homeWorld(frame, st),
        spans: [thing("envelope", ex - 40, ex + 40)],
      };
    },
  },
  "ep001-home-knows-must-return": {
    nameAr: "عرف أن عليه ردها: يرفع الظرف وينظر إلى الباب",
    place: "بيت الأخوين (عمق)",
    seq: "ep001-envelope-deep",
    render: ({ frame, at, portrait }) => {
      const tK = at("عرف", 0.1);
      const tR = at("ردها", 0.3);
      const tN = at("المعرفة", 0.5);
      const tM = at("المال", 0.65);
      const tY = at("يعود", 0.75);
      const tB = at("أخيه", 0.9);
      const kc = KC(portrait);
      const ex = ENV_CORNER;
      const taken = frame >= tR + 8;
      const st: HomeState = { mood: "night", tear: 1, leaf: "desk", bro: 0, broX: BRO_X, broPose: "stand", heroX: DESK_HERO - 60, heroPose: frame < tK ? "think" : frame < tR ? "look-up" : frame < tN ? "hold" : frame < tM ? "think" : frame < tB ? "hold" : "think", heroFlip: frame >= tB - 6, heroHold: taken ? "envelope" : "none", env: taken ? null : { open: 0, x: ex, y: ENV_DESK[1] }, door: 0.25 * P(frame, tY, 14) + 0.35 * P(frame, tB - 6, 18) };
      const hand = frontHand(POSES.hold, DESK_HERO - 60, GROUND + 6, 1.2, frame >= tB - 6);
      return {
        cam: portrait ? [kc(0, ex - 100, 2.0, -110), kc(tR, HERO_X + 80, 1.7, -60), kc(tB, HERO_X - 40, 1.4)] : [kc(0, ex - 160, 1.9, -110), kc(tR, 1240, 1.6, -60), kc(tB, 1100, 1.3)],
        world: homeWorld(frame, st, taken ? <Glow cx={hand[0]} cy={hand[1]} r={70} color={GOLD} opacity={0.45 * P(frame, tM, 14) * (1 - P(frame, tB, 20))} /> : null),
        spans: [fig("hero", DESK_HERO - 60, 1.2)],
      };
    },
  },
  "ep001-home-no-new-evidence": {
    nameAr: "لم يكن يحتاج إلى دليل جديد: الورقة والدفتر على المكتب",
    place: "بيت الأخوين (نهارًا)",
    seq: "ep001-envelope-day",
    render: ({ frame, at, portrait }) => {
      const tS = at("الشاب", 0.25);
      const tD = at("دليل", 0.65);
      const kc = KC(portrait);
      const ex = ENV_CORNER;
      const st: HomeState = { mood: "dusk", tear: 1, leaf: "desk", bro: 0, broX: BRO_X, broPose: "stand", heroX: HERO_X, heroPose: frame < tS ? "stand" : "think", heroHold: "none", env: { open: 0, x: ex, y: ENV_DESK[1] } };
      return {
        cam: portrait ? [kc(0, HERO_X - 20, 1.4), kc(tS, HERO_X + 30, 1.6), kc(tD, 1420, 2.0, -100)] : [kc(0, 1120, 1.3), kc(tS, 1200, 1.4), kc(tD, 1420, 1.9, -100)],
        world: homeWorld(frame, st, <g><Glow cx={1350} cy={GROUND - 270} r={90} color={GOLD} opacity={0.5 * P(frame, tD, 14)} /><Glow cx={NB[0]} cy={NB[1] - 40} r={130} color={GOLD} opacity={0.4 * P(frame, tD + 8, 14)} /></g>),
        spans: [fig("hero", HERO_X, 1.2, { must: frame < tD })],
      };
    },
  },
  "ep001-home-same-justice": {
    nameAr: "بالعدل نفسه: يلتفت من المكتب إلى الباب",
    place: "بيت الأخوين (نهارًا)",
    seq: "ep001-envelope-day",
    render: ({ frame, at, portrait }) => {
      const tB = at("أخاه", 0.3);
      const tJ = at("بالعدل", 0.55);
      const tO = at("الآخرين", 0.9);
      const kc = KC(portrait);
      const ex = ENV_CORNER;
      const st: HomeState = { mood: "dusk", tear: 1, leaf: "desk", bro: 0, broX: BRO_X, broPose: "stand", heroX: HERO_X, heroPose: frame < tB ? "think" : frame < tO ? "look-up" : "think", heroFlip: frame >= tB && frame < tO, heroHold: "none", env: { open: 0, x: ex, y: ENV_DESK[1] }, door: 0.6 * P(frame, tB, 18) * (1 - P(frame, tO, 20)) };
      return {
        cam: portrait ? [kc(0, 1420, 2.0, -100), kc(tB, HERO_X - 60, 1.4), kc(tO, HERO_X + 40, 1.5)] : [kc(0, 1420, 1.9, -100), kc(tB, 1000, 1.24), kc(tO, 1200, 1.4)],
        world: homeWorld(frame, st, <LightPool cx={HERO_X} cy={GROUND + 10} rx={180} ry={40} color={GOLD} opacity={0.6 * P(frame, tJ, 16)} />),
        spans: [fig("hero", HERO_X, 1.2)],
      };
    },
  },
  "ep001-home-envelope-still": {
    nameAr: "فالظرف لا يزال معه: يرفعه، والحق ينتظر فعلًا",
    place: "بيت الأخوين (نهارًا)",
    seq: "ep001-envelope-day",
    render: ({ frame, at, portrait }) => {
      const tE = at("فالظرف", 0.12);
      const tH = at("والحق", 0.5);
      const tF = at("فعلا", 0.9);
      const kc = KC(portrait);
      const ex = ENV_CORNER;
      const go = P(frame, tE - 4, Math.max(16, tH - tE - 2), (t) => t);
      const hx = lerp(HERO_X, DESK_HERO, go);
      const taken = frame >= tH;
      const st: HomeState = { mood: "dusk", tear: 1, leaf: "desk", bro: 0, broX: BRO_X, broPose: "stand", heroX: hx, heroPose: frame < tH ? "stand" : "hold", heroHold: taken ? "envelope" : "none", env: taken ? null : { open: 0, x: ex, y: ENV_DESK[1], glow: P(frame, tE, 14) } };
      return {
        cam: portrait ? [kc(0, HERO_X + 60, 1.5), kc(tE, ex - 30, 2.2, -150), kc(tH, DESK_HERO + 40, 1.7, -60), kc(tF, DESK_HERO, 1.6)] : [kc(0, 1200, 1.4), kc(tE, ex - 80, 2.2, -150), kc(tH, 1520, 1.6, -60), kc(tF, 1480, 1.5)],
        world: homeWorld(frame, st),
        spans: [fig("hero", hx, 1.2, { must: frame >= tH + 22, moving: go > 0 && go < 1 })],
      };
    },
  },
};

/* ═════════════ الورشة: الكرسي (c1-s91…c1-s97) ═════════════ */

const CHX = 560;
const CHS = 1.4;
const CRAFT_X = 980;
type ChairState = { rock: number; shim: number; sheen: number; rulers: number; mark: number; craft: PoseName; craftX: number; gap: number };
const shopWorld = (frame: number, st: ChairState, extra?: React.ReactNode) => {
  const fl = chairFlFloor(CHX, GROUND, CHS);
  const fr = chairFrFloor(CHX, GROUND, CHS);
  return (
    <g>
      <Workshop frame={frame} benchChair={false} />
      <FullChair x={CHX} floor={GROUND} s={CHS} rock={st.rock} shim={st.shim} sheen={st.sheen} gapGlow={st.gap} />
      <Ruler x={fl.x - 34} floor={GROUND} show={st.rulers} />
      <Ruler x={fr.x + 22} floor={GROUND} show={st.rulers} />
      {st.mark > 0 ? <line x1={fr.x - 18} y1={GROUND - CHAIR_SHORT * CHS} x2={fr.x - 18 + 70 * st.mark} y2={GROUND - CHAIR_SHORT * CHS} stroke={GOLD} strokeWidth={5} strokeLinecap="round" /> : null}
      <Figure x={st.craftX} y={GROUND + 6} scale={1.2} pose={POSES[st.craft]} look={LOOKS.elder} flip frame={frame} />
      {extra}
    </g>
  );
};
/** اهتزاز الكرسي: يميل نحو الرجل القصيرة حتى تلمس الأرض ثم يعود، بسعة تتناقص (لا رجل تحت الأرض) */
const rockAt = (frame: number, t0: number) => {
  const f = frame - t0;
  if (f < 0 || f > 70) return 0;
  return Math.abs(Math.sin((f / 70) * Math.PI * 3)) * Math.exp(-f / 30);
};
const CHAIR_SHOTS: Record<string, Def> = {
  "ep001-chair-finished": {
    nameAr: "الكرسي ١: صانع أنهى كرسيًّا جميلًا",
    place: "ورشة الصانع",
    seq: "ep001-chair",
    render: ({ frame, at, portrait }) => {
      const tF = at("أنهى", 0.4);
      const tC = at("كرسيا", 0.6);
      const kc = KC(portrait);
      const st: ChairState = { rock: 0, shim: 0, sheen: P(frame, tC, 20) * (1 - P(frame, tC + 30, 30)), rulers: 0, mark: 0, craft: frame < tF ? "hold" : "look-up", craftX: CRAFT_X, gap: 0.25 };
      return {
        cam: portrait ? [kc(0, CRAFT_X, 1.3), kc(tF, CHX + 140, 1.6, -40), kc(tC, CHX + 100, 1.8, -60)] : [kc(0, 820, 1.2), kc(tF, 760, 1.5, -40), kc(tC, 740, 1.7, -60)],
        world: shopWorld(frame, st),
        spans: [thing("chair", CHX - 40, CHX + 240), fig("craftsman", CRAFT_X, 1.2, { must: false })],
      };
    },
  },
  "ep001-chair-beautiful": {
    nameAr: "الكرسي ٢: الخشب والطلاء والشكل",
    place: "ورشة الصانع",
    seq: "ep001-chair",
    render: ({ frame, at, portrait }) => {
      const tW = at("الخشب", 0.15);
      const tP = at("والطلاء", 0.45);
      const tS = at("يلفت", 0.8);
      const kc = KC(portrait);
      const st: ChairState = { rock: 0, shim: 0, sheen: P(frame, tP, 20) * (1 - P(frame, tS, 30)) + 0.3 * P(frame, tW, 14) * (1 - P(frame, tP, 14)), rulers: 0, mark: 0, craft: frame < tS ? "look-up" : "nod", craftX: lerp(CRAFT_X, CRAFT_X + 90, P(frame, tS, 30)), gap: 0.25 };
      return {
        cam: portrait ? [kc(0, CHX + 100, 1.8, -60), kc(tW, CHX + 60, 2.2, -120), kc(tS, 700, 1.3)] : [kc(0, 740, 1.7, -60), kc(tW, 700, 2.0, -120), kc(tS, 820, 1.4)],
        world: shopWorld(frame, st),
        spans: [thing("chair", CHX - 40, CHX + 240, frame >= tS), fig("craftsman", st.craftX, 1.2, { must: false })],
      };
    },
  },
  "ep001-chair-rocks": {
    nameAr: "الكرسي ٣: يضع يده فيهتز (الرجل القصيرة والفجوة تحتها)",
    place: "ورشة الصانع",
    seq: "ep001-chair",
    render: ({ frame, at, portrait }) => {
      const tH = at("يده", 0.35);
      const tR = at("اهتز", 0.7);
      const kc = KC(portrait);
      const near = P(frame, 0, Math.max(12, tH));
      const cx = lerp(CRAFT_X + 90, CHX + 330, near);
      const st: ChairState = { rock: rockAt(frame, tR - 4), shim: 0, sheen: 0, rulers: 0, mark: 0, craft: frame < tH - 8 ? "nod" : frame < tR + 50 ? "point" : "think", craftX: cx, gap: 0.4 + 0.6 * P(frame, tR + 20, 14) };
      return {
        cam: portrait ? [kc(0, 700, 1.3), kc(tH, CHX + 180, 1.7, -40), kc(tR, CHX + 160, 1.9, -60)] : [kc(0, 820, 1.4), kc(tH, 760, 1.6, -40), kc(tR, 720, 1.8, -60)],
        world: shopWorld(frame, st),
        spans: [thing("chair", CHX - 40, CHX + 240), fig("craftsman", cx, 1.2, { must: false, moving: near > 0 && near < 1 })],
      };
    },
  },
  "ep001-chair-could-hide": {
    nameAr: "الكرسي ٤: كان يستطيع أن يخفي العيب",
    place: "ورشة الصانع",
    seq: "ep001-chair",
    render: ({ frame, at, portrait }) => {
      const tH = at("يخفي", 0.35);
      const tB = at("الجميل", 0.85);
      const kc = KC(portrait);
      const st: ChairState = { rock: 0, shim: 0, sheen: 0.4 * P(frame, tB, 16), rulers: 0, mark: 0, craft: frame < tH ? "think" : frame < tB ? "turn-away" : "think", craftX: CHX + 330, gap: 1 - 0.7 * P(frame, tH, 16) * (1 - P(frame, tB, 16)) };
      return {
        cam: portrait ? [kc(0, CHX + 160, 1.9, -60), kc(tH, CHX + 220, 1.6), kc(tB, CHX + 140, 2.0, -80)] : [kc(0, 720, 1.8, -60), kc(tH, 780, 1.5), kc(tB, 700, 1.9, -80)],
        world: shopWorld(frame, st),
        spans: [thing("chair", CHX - 40, CHX + 240, false), fig("craftsman", CHX + 330, 1.2, { must: false })],
      };
    },
  },
  "ep001-chair-admits": {
    nameAr: "الكرسي ٥: يعترف بما يحتاج إلى إصلاح (يقيس الفرق)",
    place: "ورشة الصانع",
    seq: "ep001-chair",
    render: ({ frame, at, portrait }) => {
      const tC = at("اختار", 0.3);
      const tA = at("يعترف", 0.5);
      const tF = at("إصلاح", 0.85);
      const kc = KC(portrait);
      const st: ChairState = { rock: 0, shim: 0, sheen: 0, rulers: P(frame, tC, 16), mark: P(frame, tA, 18), craft: frame < tC ? "think" : "sit-low", craftX: CHX + 330, gap: 1 };
      return {
        cam: portrait ? [kc(0, CHX + 140, 1.7, -80), kc(tA, CHX + 90, 1.8, -150)] : [kc(0, 700, 1.9, -80), kc(tA, 700, 2.4, -170)],
        world: shopWorld(frame, st, <Glow cx={chairFrFloor(CHX, GROUND, CHS).x} cy={GROUND - 12} r={60} color={GOLD} opacity={0.6 * P(frame, tF, 14)} />),
        spans: [thing("chair-legs", CHX - 45, CHX + 225)],
      };
    },
  },
  "ep001-chair-value": {
    nameAr: "الكرسي ٦: هل نقصت قيمة عمله؟",
    place: "ورشة الصانع",
    seq: "ep001-chair",
    render: ({ frame, at, portrait }) => {
      const tV = at("قيمة", 0.4);
      const tS = at("عيبه", 0.85);
      const kc = KC(portrait);
      const st: ChairState = { rock: 0, shim: 0, sheen: 0.5 * P(frame, tV, 16) * (1 - P(frame, tS, 16)), rulers: 1, mark: 1, craft: frame < tS ? "sit-low" : "look-up", craftX: CHX + 330, gap: 1 };
      return {
        cam: portrait ? [kc(0, CHX + 90, 1.8, -150), kc(tV, CHX + 180, 1.7, -40)] : [kc(0, 700, 2.4, -170), kc(tV, 760, 1.6, -40)],
        world: shopWorld(frame, st),
        spans: [thing("chair", CHX - 40, CHX + 240), fig("craftsman", CHX + 330, 1.2, { must: false })],
      };
    },
  },
  "ep001-chair-first-fix": {
    nameAr: "الكرسي ٧: أول خطوة إلى الإصلاح (إسفين يستقر به الكرسي)",
    place: "ورشة الصانع",
    seq: "ep001-chair",
    render: ({ frame, at, portrait }) => {
      const tS = at("رؤية", 0.25);
      const tF = at("خطوة", 0.65);
      const tR = at("إصلاحه", 0.9);
      const kc = KC(portrait);
      const shim = P(frame, tF, 20);
      const fr = chairFrFloor(CHX, GROUND, CHS);
      const st: ChairState = { rock: 0, shim, sheen: 0.3 * P(frame, tR, 16), rulers: 1 - P(frame, tS, 16), mark: 1 - P(frame, tS, 16), craft: frame < tF - 6 ? "sit-low" : frame < tR ? "hold" : "nod", craftX: CHX + 330, gap: 1 };
      return {
        cam: portrait ? [kc(0, CHX + 180, 1.7, -40), kc(tS, CHX + 90, 1.8, -150), kc(tR, CHX + 160, 1.6)] : [kc(0, 760, 1.6, -40), kc(tS, fr.x + 40, 2.5, -170), kc(tR, 740, 1.5)],
        world: shopWorld(frame, st, <Glow cx={fr.x} cy={GROUND - 10} r={70} color={GOLD} opacity={0.5 * P(frame, tF + 18, 14)} />),
        spans: [thing("chair-legs", CHX - 45, CHX + 225)],
      };
    },
  },
};

/* ═════════════ المقهى: الهاتف (c1-s114…c1-s119) ═════════════ */

const CAFE_HERO = 860;
const PH: [number, number] = [1450, 460];
const PH_S = 1.25;
const PhonePeople: React.FC = () => (
  <g>
    <Figure x={-90} y={0} scale={1} pose={POSES.point} look={LOOKS.stranger} />
    <Figure x={160} y={0} scale={0.68} pose={POSES.flinch} look={LOOKS.boy} flip />
  </g>
);
type CafeState = { show: number; full: number; lines: number; tag: number; thumb: number; man: number; pose: PoseName; buzz?: number };
const cafeWorld = (frame: number, st: CafeState) => (
  <g>
    <Cafe frame={frame} />
    <Chair x={CAFE_HERO} />
    <CafeTable x={1020} frame={frame} />
    <Figure x={CAFE_HERO} y={GROUND - 30} scale={1.2} pose={POSES[st.pose]} look={hero} holding="phone" flip frame={frame} />
    {st.buzz !== undefined ? <BuzzArcs x={CAFE_HERO + 80} y={GROUND - 330} p={st.buzz} /> : null}
    <StoryPhone x={PH[0]} y={PH[1]} s={PH_S} full={st.full} show={st.show} lines={st.lines} tag={st.tag} thumb={st.thumb} man={st.man} people={<PhonePeople />} />
  </g>
);
const cafeSpans = (st: CafeState, portrait = false, phoneMust = true): ShotSpan[] => [fig("hero", CAFE_HERO, 1.2, { must: !portrait && st.show < 0.05 }), ...(st.show > 0.5 ? [thing("phone", PH[0] - 190 * PH_S, PH[0] + 190 * PH_S, phoneMust)] : [])];
/** كاميرا الهاتف: في العمودي يملأ الهاتف عرض النافذة */
const phoneCam = (kc: ReturnType<typeof KC>, portrait: boolean, t: number, z = 1.2) => (portrait ? kc(t, PH[0], 1.0, 20) : kc(t, 1180, z));
const CAFE_SHOTS: Record<string, Def> = {
  "ep001-cafe-message": {
    nameAr: "الهاتف ١: تصل الرسالة في المقهى",
    place: "المقهى",
    seq: "ep001-phone",
    render: ({ frame, at, portrait }) => {
      const tC = at("المقهى", 0.2);
      const tM = at("رسالة", 0.55);
      const tP = at("هاتفه", 0.85);
      const kc = KC(portrait);
      const st: CafeState = { show: 0, full: 0, lines: 0, tag: 0, thumb: 0, man: 0, pose: frame < tM ? "sit" : "sit-show", buzz: P(frame, tM, 24) };
      return {
        cam: portrait ? [kc(0, CAFE_HERO + 60, 1.3), kc(tC, CAFE_HERO + 40, 1.4), kc(tP, CAFE_HERO + 60, 1.8, -80)] : [kc(0, 1000, 1.2), kc(tC, 960, 1.3), kc(tP, 960, 1.6, -80)],
        world: cafeWorld(frame, st),
        spans: cafeSpans(st, portrait),
      };
    },
  },
  "ep001-cafe-cropped": {
    nameAr: "الهاتف ٢: صورة مقصوصة، وعبارة غاضبة، واتهام جاهز",
    place: "المقهى",
    seq: "ep001-phone",
    render: ({ frame, at, portrait }) => {
      const tI = at("صورة", 0.1);
      const tA = at("غاضبة", 0.4);
      const tJ = at("واتهام", 0.7);
      const kc = KC(portrait);
      const st: CafeState = { show: P(frame, tI - 4, 16), full: 0, lines: 3 * P(frame, tA, 24), tag: P(frame, tJ, 12), thumb: 0, man: 0, pose: "sit-show" };
      return {
        cam: [kc(0, portrait ? CAFE_HERO + 60 : 960, portrait ? 1.8 : 1.6, -80), phoneCam(kc, portrait, tI, 1.2), phoneCam(kc, portrait, tJ, 1.26)],
        world: cafeWorld(frame, st),
        spans: cafeSpans(st, portrait, frame >= tI + 22),
      };
    },
  },
  "ep001-cafe-agrees": {
    nameAr: "الهاتف ٣: الخبر يوافق رأيًا يحمله من قبل",
    place: "المقهى",
    seq: "ep001-phone",
    render: ({ frame, at, portrait }) => {
      const tY = at("يوافق", 0.35);
      const tB = at("قبل", 0.85);
      const kc = KC(portrait);
      const st: CafeState = { show: 1, full: 0, lines: 3, tag: 1, thumb: 0, man: 0, pose: frame < tY ? "sit-show" : "sit-nod" };
      return {
        cam: portrait ? [kc(0, PH[0], 1.0, 20), kc(tY, CAFE_HERO + 40, 1.6, -60), kc(tB, PH[0], 1.0, 20)] : [kc(0, 1180, 1.26), kc(tY, 1060, 1.3), kc(tB, 1140, 1.24)],
        world: <g>{cafeWorld(frame, st)}<Glow cx={PH[0]} cy={PH[1] + 230} r={110} color={RED} opacity={0.4 * P(frame, tY, 16) * (1 - P(frame, tB, 20))} /></g>,
        spans: portrait && frame >= tY + 22 && frame < tB ? [fig("hero", CAFE_HERO, 1.2)] : cafeSpans(st, portrait),
      };
    },
  },
  "ep001-cafe-almost-sends": {
    nameAr: "الهاتف ٤: كاد يرسله، لكنه توقف (الإبهام فوق الزر)",
    place: "المقهى",
    seq: "ep001-phone",
    render: ({ frame, at, portrait }) => {
      const tS = at("يرسله", 0.3);
      const tT = at("توقف", 0.7);
      const kc = KC(portrait);
      const st: CafeState = { show: 1, full: 0, lines: 3, tag: 1, thumb: P(frame, tS, 14) * (1 - 0.6 * P(frame, tT, 12)), man: 0, pose: "sit-show" };
      return {
        cam: [phoneCam(kc, portrait, 0, 1.24), kc(tS, PH[0], portrait ? 1.3 : 1.6, 220), kc(tT + 20, portrait ? PH[0] : 1180, portrait ? 1.0 : 1.24, portrait ? 20 : 0)],
        world: cafeWorld(frame, st),
        spans: [thing("send", PH[0] - 80, PH[0] + 80)],
      };
    },
  },
  "ep001-cafe-original": {
    nameAr: "الهاتف ٥: يعود إلى أصل الصورة فيتسع الإطار عليها",
    place: "المقهى",
    seq: "ep001-phone",
    render: ({ frame, at, portrait }) => {
      const tO = at("أصل", 0.15);
      const tR = at("وراجع", 0.35);
      const tX = at("سياق", 0.45);
      const tK = at("فاكتشف", 0.55);
      const tV = at("وصله", 0.7);
      const tP = at("الموقف", 0.85);
      const tW = at("كاملا", 0.9);
      const kc = KC(portrait);
      const full = 0.5 * P(frame, tO, 22) + 0.5 * P(frame, tR + 10, 30);
      const st: CafeState = { show: 1, full, lines: 3, tag: 1, thumb: 0.4 * (1 - P(frame, tO, 10)), man: P(frame, tP, 18), pose: frame < tK ? "sit-show" : frame < tV ? "sit" : "sit-show" };
      return {
        cam: [phoneCam(kc, portrait, 0, 1.24), kc(tO, PH[0], portrait ? 1.5 : 1.7, -170), kc(tX, PH[0], portrait ? 1.3 : 1.5, -100), phoneCam(kc, portrait, tK, 1.3), ...(portrait ? [kc(tV, PH[0], 1.3, -110)] : []), phoneCam(kc, portrait, tW, 1.2)],
        world: cafeWorld(frame, st),
        spans: [thing("photo", PH[0] - 170, PH[0] + 170)],
      };
    },
  },
  "ep001-cafe-context": {
    nameAr: "الهاتف ٦: السياق الكامل — كان قريبًا من أن يكرر الخطأ",
    place: "المقهى",
    seq: "ep001-phone",
    render: ({ frame, at, portrait }) => {
      const tN = at("قريبا", 0.3);
      const tK = at("الخطأ", 0.55);
      const tS = at("نفسه", 0.65);
      const tH = at("حق", 0.8);
      const tO = at("آخر", 0.9);
      const kc = KC(portrait);
      const down = P(frame, tK, 24);
      const st: CafeState = { show: 1 - down, full: 1, lines: 3, tag: 1, thumb: 0, man: 1 - 0.5 * P(frame, tO, 16), pose: frame < tK ? "sit-show" : frame < tS ? "sit" : frame < tH ? "head-down" : "sit-show" };
      return {
        cam: portrait ? [kc(0, PH[0], 1.0, 20), kc(tK, CAFE_HERO + 60, 1.4), kc(tO, CAFE_HERO + 80, 1.5)] : [kc(0, 1180, 1.2), kc(tN, 1200, 1.26), kc(tK, 1000, 1.2), kc(tO, 980, 1.28)],
        world: <g>{cafeWorld(frame, st)}<Glow cx={CAFE_HERO} cy={GROUND - 260} r={160} color={GOLD} opacity={0.35 * P(frame, tO, 18)} /></g>,
        spans: portrait && frame >= tK + 22 ? [fig("hero", CAFE_HERO, 1.2)] : cafeSpans(st, portrait),
      };
    },
  },
};

/* ═════════════ الجلوس الليلي (c1-s125…c1-s132) ═════════════ */

const NIGHT_HERO = 1150;
const LAMP: [number, number] = [1330, GROUND - 260];
const NIGHT_ENV: [number, number] = [1300, GROUND - 236];
const LowTable: React.FC = () => (
  <g>
    <rect x={1180} y={GROUND - 222} width={300} height={20} fill={darken(ID.copper, 0.35)} stroke={INK} strokeWidth={3} />
    <rect x={1196} y={GROUND - 202} width={16} height={202} fill={darken(ID.copper, 0.45)} />
    <rect x={1448} y={GROUND - 202} width={16} height={202} fill={darken(ID.copper, 0.45)} />
  </g>
);
const TableLamp: React.FC<{ on: number; frame: number }> = ({ on, frame }) => {
  const fl = 0.94 + 0.06 * Math.sin(frame / 5) * Math.sin(frame / 13);
  return (
    <g>
      <Glow cx={LAMP[0]} cy={LAMP[1] - 30} r={260} color={GOLD} opacity={0.75 * on * fl} />
      <path d={`M${LAMP[0] - 8} ${GROUND - 222} L${LAMP[0] - 4} ${LAMP[1] - 10} L${LAMP[0] + 4} ${LAMP[1] - 10} L${LAMP[0] + 8} ${GROUND - 222} Z`} fill={darken(ID.copper, 0.3)} stroke={INK} strokeWidth={2} />
      <path d={`M${LAMP[0] - 40} ${LAMP[1] - 10} L${LAMP[0] + 40} ${LAMP[1] - 10} L${LAMP[0] + 24} ${LAMP[1] - 60} L${LAMP[0] - 24} ${LAMP[1] - 60} Z`} fill={mix(ID.copper, GOLD, 0.4 + 0.6 * on)} stroke={INK} strokeWidth={2.4} />
    </g>
  );
};
type NightState = { lamp: number; pose: PoseName; envRot: number; envGlow: number; reach: number; reflect: number };
const nightWorld = (frame: number, st: NightState, extra?: React.ReactNode) => {
  return (
    <g>
      <HomeRoom frame={frame} mood="night" />
      {/* انعكاسه في زجاج النافذة: «صورتنا أمام الآخرين» */}
      {st.reflect > 0.01 ? <g opacity={0.45 * st.reflect}><Figure x={1590} y={GROUND - 290} scale={0.7} pose={POSES.proud} look={hero} silhouette={mix(ID.night, GOLD, 0.35)} shadow={false} /></g> : null}
      <Chair x={NIGHT_HERO} />
      <LowTable />
      <TableLamp on={st.lamp} frame={frame} />
      <Envelope x={NIGHT_ENV[0]} y={NIGHT_ENV[1]} w={64} open={0} rot={st.envRot} glow={st.envGlow} />
      <Figure x={NIGHT_HERO} y={GROUND - 30} scale={1.2} pose={st.reach > 0 ? { ...POSES.sit, armFront: { s: lerp(POSES.sit.armFront.s, 70, st.reach), e: lerp(POSES.sit.armFront.e, 10, st.reach) } } : POSES[st.pose]} look={hero} frame={frame} />
      {extra}
    </g>
  );
};
const NIGHT = "غرفة الليل";
const nightCam = (kc: ReturnType<typeof KC>, portrait: boolean, t: number, k: "wide" | "env" | "hero" | "window") =>
  k === "wide" ? kc(t, portrait ? 1240 : 1260, portrait ? 1.3 : 1.3, -20) : k === "env" ? kc(t, NIGHT_ENV[0], portrait ? 2.2 : 2.0, -130) : k === "hero" ? kc(t, NIGHT_HERO + 40, portrait ? 1.8 : 1.7, -90) : kc(t, portrait ? 1560 : 1440, portrait ? 1.6 : 1.4, -80);
const NIGHT_SHOTS: Record<string, Def> = {
  "ep001-night-alone": {
    nameAr: "الليل ١: جلس وحده والظرف أمامه",
    place: NIGHT,
    seq: "ep001-night",
    render: ({ frame, at, portrait }) => {
      const tE = at("المساء", 0.15);
      const tA = at("وحده", 0.45);
      const tN = at("الظرف", 0.75);
      const kc = KC(portrait);
      return {
        cam: [nightCam(kc, portrait, 0, "wide"), kc(tA, NIGHT_HERO + 80, portrait ? 1.5 : 1.4, -40), nightCam(kc, portrait, tN, "env")],
        world: nightWorld(frame, { lamp: P(frame, tE, 20), pose: frame < tA ? "sit" : "sit-low", envRot: 0, envGlow: P(frame, tN, 16), reach: 0, reflect: 0 }),
        spans: [fig("hero", NIGHT_HERO, 1.2, { must: frame < tN })],
      };
    },
  },
  "ep001-night-question": {
    nameAr: "الليل ٢: سأل نفسه سؤالًا لم يكن مريحًا",
    place: NIGHT,
    seq: "ep001-night",
    render: ({ frame, at, portrait }) => {
      const tQ = at("سؤالا", 0.4);
      const tU = at("مريحا", 0.85);
      const kc = KC(portrait);
      return {
        cam: [nightCam(kc, portrait, 0, "env"), nightCam(kc, portrait, tQ, "hero")],
        world: nightWorld(frame, { lamp: 1, pose: frame < tQ ? "sit-low" : frame < tU ? "sit-show" : "sit-low", envRot: 0, envGlow: 1 - P(frame, tQ, 20), reach: 0, reflect: 0 }),
        spans: [fig("hero", NIGHT_HERO, 1.2, { must: frame >= tQ + 20 })],
      };
    },
  },
  "ep001-night-q1": {
    nameAr: "الليل ٣: هل أريد أن أصل إلى الحق؟ (يمد يده نحو الظرف)",
    place: NIGHT,
    seq: "ep001-night",
    render: ({ frame, at, portrait }) => {
      const tA = at("أريد", 0.2);
      const tH = at("الحق", 0.6);
      const kc = KC(portrait);
      return {
        cam: [nightCam(kc, portrait, 0, "hero"), kc(tA, NIGHT_HERO + 60, portrait ? 1.9 : 1.8, -100), kc(tH, NIGHT_HERO + 100, portrait ? 1.8 : 1.6, -80)],
        world: nightWorld(frame, { lamp: 1, pose: frame < tA ? "sit" : "sit-show", envRot: 0, envGlow: 0.4 * P(frame, tH, 14), reach: P(frame, tH - 6, 18), reflect: 0 }),
        spans: [fig("hero", NIGHT_HERO, 1.2)],
      };
    },
  },
  "ep001-night-q2": {
    nameAr: "الليل ٤: أم ألا أبدو مخطئًا؟ (يسحب يده)",
    place: NIGHT,
    seq: "ep001-night",
    render: ({ frame, at, portrait }) => {
      const tW = at("مخطئا", 0.55);
      const tB = at("أخي", 0.9);
      const kc = KC(portrait);
      return {
        cam: [kc(0, NIGHT_HERO + 100, portrait ? 1.8 : 1.6, -80), nightCam(kc, portrait, tW, "hero")],
        world: nightWorld(frame, { lamp: 1, pose: frame < tB ? "sit" : "head-down", envRot: 0, envGlow: 0.4 * (1 - P(frame, tW, 14)), reach: 1 - P(frame, tW, 16), reflect: 0 }),
        spans: [fig("hero", NIGHT_HERO, 1.2)],
      };
    },
  },
  "ep001-night-q3": {
    nameAr: "الليل ٥: هل أخشى أن أكون قد ظلمته؟ (يقلب الظرف)",
    place: NIGHT,
    seq: "ep001-night",
    render: ({ frame, at, portrait }) => {
      const tF = at("أخشى", 0.25);
      const tO = at("أكون", 0.5);
      const tZ = at("ظلمته", 0.8);
      const kc = KC(portrait);
      return {
        cam: [nightCam(kc, portrait, 0, "env"), kc(tZ, NIGHT_ENV[0] - 60, portrait ? 2.0 : 1.8, -110)],
        world: nightWorld(frame, { lamp: 1, pose: "sit-low", envRot: -18 * P(frame, tF, 18) + 18 * P(frame, tZ, 18), envGlow: 0.2 + 0.4 * P(frame, tO, 12) * (1 - P(frame, tZ, 16)), reach: P(frame, tF - 8, 12) * (1 - P(frame, tZ + 10, 14)), reflect: 0 }),
        spans: [thing("envelope", NIGHT_ENV[0] - 40, NIGHT_ENV[0] + 40)],
      };
    },
  },
  "ep001-night-q4": {
    nameAr: "الليل ٦: أم أخشى أن أعترف له؟ (يخفض رأسه)",
    place: NIGHT,
    seq: "ep001-night",
    render: ({ frame, at, portrait }) => {
      const tC = at("أعترف", 0.45);
      const tZ = at("ظلمته", 0.85);
      const kc = KC(portrait);
      return {
        cam: [kc(0, NIGHT_ENV[0] - 60, portrait ? 2.0 : 1.8, -110), nightCam(kc, portrait, tC, "hero")],
        world: nightWorld(frame, { lamp: 1, pose: frame < tC ? "sit" : frame < tZ ? "sit-low" : "head-down", envRot: 0, envGlow: 0, reach: 0, reflect: 0 }),
        spans: [fig("hero", NIGHT_HERO, 1.2, { must: frame >= tC + 20 })],
      };
    },
  },
  "ep001-night-battle": {
    nameAr: "الليل ٧: المعركة ليست بين دليلين",
    place: NIGHT,
    seq: "ep001-night",
    render: ({ frame, at, portrait }) => {
      const tM = at("المعركة", 0.35);
      const tD = at("دليلين", 0.85);
      const kc = KC(portrait);
      return {
        cam: [nightCam(kc, portrait, 0, "hero"), nightCam(kc, portrait, tM, "wide")],
        world: nightWorld(frame, { lamp: 1, pose: frame < tM ? "head-down" : frame < tD ? "sit" : "sit-nod", envRot: 0, envGlow: 0.3 * P(frame, tD, 16), reach: 0, reflect: 0 }),
        spans: [fig("hero", NIGHT_HERO, 1.2)],
      };
    },
  },
  "ep001-night-image": {
    nameAr: "الليل ٨: ما نعرف أنه صواب، وصورتنا أمام الآخرين (انعكاسه في الزجاج)",
    place: NIGHT,
    seq: "ep001-night",
    render: ({ frame, at, portrait }) => {
      const tR = at("صواب", 0.3);
      const tN = at("نريد", 0.5);
      const tI = at("صورتنا", 0.7);
      const tO = at("الآخرين", 0.9);
      const kc = KC(portrait);
      return {
        cam: [nightCam(kc, portrait, 0, "wide"), kc(tR, NIGHT_ENV[0], portrait ? 1.8 : 1.6, -90), nightCam(kc, portrait, tI, "window")],
        world: nightWorld(frame, { lamp: 1, pose: frame < tN ? "sit" : frame < tI ? "sit-low" : frame < tO ? "sit-show" : "sit-nod", envRot: 0, envGlow: P(frame, tR, 14) * (1 - P(frame, tI, 20)), reach: 0, reflect: 0.6 * P(frame, tI, 24) + 0.4 * P(frame, tO, 14) }),
        spans: [fig("hero", NIGHT_HERO, 1.2, { must: false })],
      };
    },
  },
};

/* ═════════════ باب الأخ: المرور (c1-s109…c1-s111) والرد والاعتذار (c1-s134…c1-s139) ═════════════ */

const DOOR_X = 1080;
const BRO_DOOR = 1170;
const HERO_DOOR = 880;
const doorWorld = (frame: number, mood: "dusk" | "dawn", o: { light: number; heroX: number; heroPose: PoseName | "walk"; heroFlip?: boolean; heroHold?: "envelope" | "envelope-open" | "none"; bro?: number; broX?: number; broPose?: PoseName; broFlip?: boolean; coinsInBro?: boolean; knock?: number }, extra?: React.ReactNode) => {
  const hp = o.heroPose === "walk" ? walkPose(POSES.stand, (frame / 30) * Math.PI * 2 * 0.95) : POSES[o.heroPose];
  const bp = POSES[o.broPose ?? "stand"];
  const bh = frontHand(bp, o.broX ?? BRO_DOOR, GROUND + 6, 1.16, o.broFlip ?? true);
  return (
    <g>
      <AlleyView mood={mood} frame={frame} />
      <ArchDoor x={DOOR_X} w={190} h={300} light={o.light} mood={mood} spill />
      {o.knock !== undefined ? <BuzzArcs x={DOOR_X + 40} y={GROUND - 200} p={o.knock} color={GOLD} /> : null}
      {(o.bro ?? 0) > 0.01 ? <g data-actor="brother" data-pose={o.broPose ?? "stand"}><Figure x={o.broX ?? BRO_DOOR} y={GROUND + 6} scale={1.16} pose={bp} look={brother} flip={o.broFlip ?? true} opacity={Math.min(1, o.bro ?? 0)} frame={frame + 9} /></g> : null}
      {o.coinsInBro ? <ThreeCoins x={bh[0] - 8} y={bh[1] - 4} r={7} tilt={0.6} /> : null}
      <g data-actor="hero" data-pose={o.heroPose}><Figure x={o.heroX} y={GROUND + 6} scale={1.2} pose={hp} look={hero} flip={o.heroFlip} frame={frame} holding={o.heroHold ?? "none"} /></g>
      {extra}
    </g>
  );
};
const DOOR_SHOTS: Record<string, Def> = {
  "ep001-door-pass": {
    nameAr: "باب الأخ ١: يمر بالقرب من الباب (يتباطأ)",
    place: "باب الأخ",
    seq: "ep001-door-pass",
    render: ({ frame, at, portrait }) => {
      const tB = at("باب", 0.7);
      const kc = KC(portrait);
      const x = lerp(300, 900, P(frame, 0, Math.max(30, tB + 20), (t) => 1 - (1 - t) * (1 - t)));
      return {
        cam: portrait ? [kc(0, 420, 1.3), kc(tB, 900, 1.3)] : [kc(0, 760, 1.2), kc(tB, 980, 1.24)],
        world: doorWorld(frame, "dusk", { light: 0.3 + 0.3 * P(frame, tB, 16), heroX: x, heroPose: x < 899 ? "walk" : "stand", heroHold: "envelope" }),
        spans: [fig("hero", x, 1.2, { moving: x < 899 })],
      };
    },
  },
  "ep001-door-pause": {
    nameAr: "باب الأخ ٢: توقف قليلًا، ثم مضى",
    place: "باب الأخ",
    seq: "ep001-door-pass",
    render: ({ frame, at, portrait }) => {
      const tS = at("توقف", 0.1);
      const tT = at("ثم", 0.55);
      const tM = at("مضى", 0.7);
      const kc = KC(portrait);
      const x = 900 + 220 * P(frame, tM, 50, (t) => t);
      return {
        cam: portrait ? [kc(0, 900, 1.3), kc(tS, 940, 1.5, -40), kc(tM, 1050, 1.3)] : [kc(0, 980, 1.24), kc(tS, 980, 1.4, -40), kc(tM, 1060, 1.24)],
        world: doorWorld(frame, "dusk", { light: 0.6, heroX: x, heroPose: frame < tS + 6 ? "stand" : frame < tT ? "look-up" : frame < tM ? "think" : "walk", heroHold: "envelope" }),
        spans: [fig("hero", x, 1.2)],
      };
    },
  },
  "ep001-door-postpones": {
    nameAr: "باب الأخ ٣: لم يكن يجهل، لكنه كان يؤجل (يمضي والظرف معه)",
    place: "باب الأخ",
    seq: "ep001-door-pass",
    render: ({ frame, at, portrait }) => {
      const tK = at("يجهل", 0.3);
      const tP = at("يؤجله", 0.85);
      const kc = KC(portrait);
      const x = 1120 + 360 * P(frame, 0, Math.max(40, tP + 30), (t) => t);
      return {
        cam: portrait ? [kc(0, 1080, 1.3), kc(tK, 1240, 1.3), kc(tP, 1440, 1.3)] : [kc(0, 1060, 1.24), kc(tP, 1200, 1.24)],
        world: doorWorld(frame, "dusk", { light: 0.6 - 0.3 * P(frame, tP, 20), heroX: x, heroPose: "walk", heroHold: "envelope" }, <Glow cx={x + 40} cy={GROUND - 250} r={70} color={GOLD} opacity={0.4 * P(frame, tP, 14)} />),
        spans: [fig("hero", x, 1.2, { moving: true })],
      };
    },
  },
  "ep001-return-arrives": {
    nameAr: "الرد ١: في الصباح يعود إلى باب أخيه",
    place: "باب الأخ فجرًا",
    seq: "ep001-return",
    render: ({ frame, at, portrait }) => {
      const tM = at("صباح", 0.15);
      const tB = at("باب", 0.8);
      const kc = KC(portrait);
      const x = lerp(260, HERO_DOOR, P(frame, tM - 10, Math.max(40, tB - tM + 10), (t) => 1 - (1 - t) * (1 - t)));
      return {
        cam: portrait ? [kc(0, 420, 1.3), kc(tB, HERO_DOOR + 60, 1.3)] : [kc(0, 760, 1.2), kc(tB, 980, 1.3)],
        world: doorWorld(frame, "dawn", { light: 0.3, heroX: x, heroPose: x < HERO_DOOR - 1 ? "walk" : "stand", heroHold: "envelope" }),
        spans: [fig("hero", x, 1.2, { moving: x < HERO_DOOR - 1 })],
      };
    },
  },
  "ep001-return-knocks": {
    nameAr: "الرد ٢: لم يكتف بالوقوف، طرق الباب",
    place: "باب الأخ فجرًا",
    seq: "ep001-return",
    render: ({ frame, at, portrait }) => {
      const tM = at("المرة", 0.12);
      const tW = at("بالوقوف", 0.35);
      const tK = at("طرق", 0.75);
      const kc = KC(portrait);
      return {
        cam: portrait ? [kc(0, HERO_DOOR + 60, 1.3), kc(tK, DOOR_X + 40, 1.5, -40)] : [kc(0, 980, 1.3), kc(tW, 1000, 1.4, -30), kc(tK, 1010, 1.5, -40)],
        world: doorWorld(frame, "dawn", { light: 0.3 + 0.3 * P(frame, tK + 10, 20), heroX: HERO_DOOR, heroPose: frame < tM ? "stand" : frame < tW ? "look-up" : frame < tK ? "think" : "point", heroHold: "envelope", knock: P(frame, tK, 24) }),
        spans: [fig("hero", HERO_DOOR, 1.2)],
      };
    },
  },
  "ep001-return-coins": {
    nameAr: "الرد ٣: يخرج أخوه، فيفتح الظرف ويعيد القطع الثلاث إلى كفه",
    place: "باب الأخ فجرًا",
    seq: "ep001-return",
    render: ({ frame, at, portrait }) => {
      const tO = at("خرج", 0.15);
      const tE = at("أخرج", 0.4);
      const tR = at("وأعاد", 0.6);
      const tC = at("الثلاث", 0.9);
      const kc = KC(portrait);
      const bro = P(frame, tO, 16);
      const open = P(frame, tE + 8, 12);
      const fly = P(frame, tR, 24);
      const hp: PoseName = "hold";
      const from = frontHand(POSES[hp], HERO_DOOR, GROUND + 6, 1.2, false);
      const to = frontHand(POSES.hold, BRO_DOOR, GROUND + 6, 1.16, true);
      return {
        cam: portrait ? [kc(0, DOOR_X + 40, 1.5, -40), kc(tO, BRO_DOOR, 1.4), kc(tE, HERO_DOOR + 40, 1.6, -60), kc(tR, (HERO_DOOR + BRO_DOOR) / 2, 1.9, -110), kc(tC, BRO_DOOR - 20, 1.6, -60)] : [kc(0, 1010, 1.5, -40), kc(tO, 1020, 1.4), kc(tR, 1025, 1.7, -90), kc(tC, 1020, 1.5)],
        world: doorWorld(frame, "dawn", { light: 0.6 + 0.4 * bro, heroX: HERO_DOOR, heroPose: frame < tE ? "stand" : "hold", heroHold: frame < tE ? "envelope" : frame >= tR + 40 ? "none" : open > 0 ? "envelope-open" : "envelope", bro, broX: BRO_DOOR, broPose: frame < tR ? "stand" : "hold", coinsInBro: fly >= 1 }, <CoinsFlight from={[from[0] + 12, from[1] - 30]} to={[to[0] - 8, to[1] - 4]} t={fly} />),
        spans: [fig("hero", HERO_DOOR, 1.2, { must: false }), fig("brother", BRO_DOOR, 1.16, { must: false })],
      };
    },
  },
  "ep001-return-apology": {
    nameAr: "الاعتذار: المخطئ وحده ينحني، يداه فارغتان، والأخ مستقيم يستمع",
    place: "باب الأخ فجرًا",
    seq: "ep001-return",
    render: ({ frame, at, portrait }) => {
      const tQ = at("قال", 0.05);
      const tB = at("تبرير", 0.15);
      const tA = at("اتهمتك", 0.25);
      const tT = at("وأخذت", 0.45);
      const tK = at("أخطأت", 0.65);
      const tS = at("وأعتذر", 0.9);
      const kc = KC(portrait);
      return {
        cam: portrait ? [kc(0, BRO_DOOR - 20, 1.6, -60), kc(tA, HERO_DOOR + 30, 1.5), kc(tK, HERO_DOOR + 40, 1.6, -40), kc(tS, BRO_DOOR - 10, 1.5)] : [kc(0, 1020, 1.5), kc(tB, 960, 1.7, -50), kc(tA, 1000, 1.5), kc(tK, 990, 1.6, -30), kc(tS, 1020, 1.5)],
        world: doorWorld(frame, "dawn", { light: 1, heroX: HERO_DOOR, heroPose: frame < tQ + 4 ? "stand" : frame < tB ? "look-up" : frame < tA ? "stand" : frame < tT ? "sincere" : frame < tK ? "hold" : "apologize", heroHold: "none", bro: 1, broX: BRO_DOOR, broPose: "listen", coinsInBro: true }, (
          <g>
            <Glow cx={frontHand(POSES.listen, BRO_DOOR, GROUND + 6, 1.16, true)[0]} cy={frontHand(POSES.listen, BRO_DOOR, GROUND + 6, 1.16, true)[1]} r={60} color={GOLD} opacity={0.55 * P(frame, tT, 14) * (1 - P(frame, tK, 16))} />
            <Glow cx={1020} cy={GROUND - 300} r={260} color={GOLD} opacity={0.3 * P(frame, tS, 20)} />
          </g>
        )),
        spans: [fig("hero", HERO_DOOR, 1.2, { must: !portrait || frame < tS }), fig("brother", BRO_DOOR, 1.16, { must: false })],
      };
    },
  },
  "ep001-return-not-easy": {
    nameAr: "استجابة الأخ ١: لم يكن الاعتذار سهلًا (يتمهّل)",
    place: "باب الأخ فجرًا",
    seq: "ep001-return",
    render: ({ frame, at, portrait }) => {
      const tE = at("سهلا", 0.3);
      const tN = at("الضروري", 0.55);
      const tX = at("الخلاف", 0.75);
      const tL = at("لحظة", 0.9);
      const kc = KC(portrait);
      return {
        cam: portrait ? [kc(0, BRO_DOOR - 10, 1.5), kc(tE, BRO_DOOR + 10, 1.7, -60), kc(tL, HERO_DOOR + 40, 1.5)] : [kc(0, 1020, 1.5), kc(tE, 1060, 1.7, -60), kc(tL, 1020, 1.5)],
        world: doorWorld(frame, "dawn", { light: 1, heroX: HERO_DOOR, heroPose: frame < tL ? "apologize" : "stand", bro: 1, broX: BRO_DOOR, broPose: frame < tE ? "listen" : frame < tN ? "think" : frame < tX ? "hold" : "listen", coinsInBro: true }),
        spans: [fig("hero", HERO_DOOR, 1.2, { must: !portrait }), fig("brother", BRO_DOOR, 1.16, { must: false })],
      };
    },
  },
  "ep001-return-changed": {
    nameAr: "استجابة الأخ ٢: يومئ ويفسح الباب — شيء مهم قد تغير",
    place: "باب الأخ فجرًا",
    seq: "ep001-return",
    render: ({ frame, at, portrait }) => {
      const tG = at("شيئا", 0.15);
      const tM = at("مهما", 0.35);
      const tC = at("تغير", 0.75);
      const kc = KC(portrait);
      const aside = P(frame, tC, 24);
      const bx = BRO_DOOR + 30 * aside;
      return {
        cam: portrait ? [kc(0, HERO_DOOR + 40, 1.5), kc(tM, BRO_DOOR, 1.5), kc(tC + 10, 1020, 1.2)] : [kc(0, 1020, 1.5), kc(tC, 1030, 1.36)],
        world: doorWorld(frame, "dawn", { light: 1, heroX: HERO_DOOR, heroPose: frame < tG ? "stand" : frame < tC ? "look-up" : "stand", bro: 1, broX: bx, broPose: frame < tM ? "think" : "nod", broFlip: aside < 0.5, coinsInBro: true }, <Glow cx={DOOR_X + 90} cy={GROUND - 200} r={300} color={GOLD} opacity={0.4 * aside} />),
        spans: [fig("hero", HERO_DOOR, 1.2, { must: !portrait || frame < tM }), fig("brother", bx, 1.16, { must: false })],
      };
    },
  },
};

/* ═════════════ الاستماع (c1-s142…c1-s147) ═════════════ */

const L_HERO = 820;
const L_BRO = 1180;
const listenWorld = (frame: number, o: { hero: PoseName; bro: PoseName; bubble: number; red: number; nod?: number }) => {
  const head: [number, number] = [L_BRO - 10, GROUND - 330];
  return (
    <g>
      <HomeRoom frame={frame} mood="dusk" />
      <Chair x={L_HERO} />
      <Chair x={L_BRO} flip />
      <rect x={950} y={GROUND - 120} width={100} height={14} fill={darken(ID.copper, 0.35)} stroke={INK} strokeWidth={2.4} />
      <rect x={994} y={GROUND - 106} width={12} height={106} fill={darken(ID.copper, 0.45)} />
      <ThreeCoins x={1000} y={GROUND - 128} r={6} tilt={0.5} />
      <Figure x={L_HERO} y={GROUND - 30} scale={1.2} pose={POSES[o.hero]} look={hero} frame={frame} />
      <Figure x={L_BRO} y={GROUND - 30} scale={1.16} pose={POSES[o.bro]} look={brother} flip frame={frame + 9} />
      <MemoryBubble cx={L_BRO + 170} cy={GROUND - 520} head={head} show={o.bubble} ring={mix(ID.copper, RED, o.red)}>
        {/* لحظة الاتهام من جهة الأخ: الإصبع يشير والورقة في اليد */}
        <g transform={`translate(${L_BRO + 170} ${GROUND - 470}) scale(0.42) translate(-960 ${-(GROUND - 120)})`}>
          <rect x={500} y={GROUND - 600} width={900} height={700} fill={mix(mix(ID.copper, ID.paper, 0.45), ID.seal, 0.12)} />
          <Figure x={760} y={GROUND} scale={1.16} pose={POSES.flinch} look={brother} />
          <Figure x={1130} y={GROUND} scale={1.2} pose={POSES.point} look={hero} flip holding="leaf" />
        </g>
      </MemoryBubble>
    </g>
  );
};
const LISTEN = "مجلس الأخوين";
const LISTEN_SHOTS: Record<string, Def> = {
  "ep001-listen-sits": {
    nameAr: "الاستماع ١: جلس مع أخيه يستمع إليه",
    place: LISTEN,
    seq: "ep001-listen",
    render: ({ frame, at, portrait }) => {
      const tJ = at("وجلس", 0.15);
      const tL = at("يستمع", 0.7);
      const kc = KC(portrait);
      return {
        cam: portrait ? [kc(0, L_HERO + 40, 1.3), kc(tL, L_HERO + 30, 1.5, -60)] : [kc(0, 1000, 1.2), kc(tJ, 1000, 1.26), kc(tL, 980, 1.36, -40)],
        world: listenWorld(frame, { hero: frame < tL ? "sit" : "sit-nod", bro: "sit-show", bubble: 0, red: 0 }),
        spans: [fig("hero", L_HERO, 1.2), fig("brother", L_BRO, 1.16, { must: !portrait })],
      };
    },
  },
  "ep001-listen-no-interrupt": {
    nameAr: "الاستماع ٢: لم يقاطعه (يهمّ ثم يمسك)",
    place: LISTEN,
    seq: "ep001-listen",
    render: ({ frame, at, portrait }) => {
      const tI = at("يقاطعه", 0.35);
      const tG = at("غضب", 0.85);
      const kc = KC(portrait);
      return {
        cam: portrait ? [kc(0, L_HERO + 30, 1.5, -60), kc(tI, L_HERO + 30, 1.7, -80)] : [kc(0, 980, 1.36, -40), kc(tI, 900, 1.6, -80)],
        world: listenWorld(frame, { hero: frame < tI ? "sit-nod" : frame < tI + 20 ? "sit-show" : "sit", bro: frame < tG ? "sit-show" : "sit", bubble: 0, red: 0 }),
        spans: [fig("hero", L_HERO, 1.2)],
      };
    },
  },
  "ep001-listen-no-reply": {
    nameAr: "الاستماع ٣: لم ينشغل بإعداد رد",
    place: LISTEN,
    seq: "ep001-listen",
    render: ({ frame, at, portrait }) => {
      const tB = at("ينشغل", 0.3);
      const tD = at("يدافع", 0.7);
      const kc = KC(portrait);
      return {
        cam: portrait ? [kc(0, L_HERO + 30, 1.7, -80), kc(tB, L_BRO - 20, 1.5)] : [kc(0, 900, 1.6, -80), kc(tB, 1000, 1.3), kc(tD, 1020, 1.36)],
        world: listenWorld(frame, { hero: frame < tD ? "sit" : "sit-nod", bro: frame < tB ? "sit" : "sit-show", bubble: 0, red: 0 }),
        spans: [fig("brother", L_BRO, 1.16, { must: portrait ? frame >= tB + 20 : true }), fig("hero", L_HERO, 1.2, { must: !portrait })],
      };
    },
  },
  "ep001-listen-feeling": {
    nameAr: "الاستماع ٤: ما شعر به حين اتُّهم ظلمًا (ذكرى الأخ)",
    place: LISTEN,
    seq: "ep001-listen",
    render: ({ frame, at, portrait }) => {
      const tF = at("شعر", 0.45);
      const tZ = at("ظلما", 0.9);
      const kc = KC(portrait);
      const bub = P(frame, tF - 4, 18);
      return {
        cam: portrait ? [kc(0, L_BRO - 20, 1.5), kc(tF, L_BRO + 130, 1.4, -120)] : [kc(0, 1020, 1.36), kc(tF, 1180, 1.4, -120)],
        world: listenWorld(frame, { hero: "sit", bro: "sit-show", bubble: bub, red: P(frame, tZ, 16) }),
        spans: [fig("brother", L_BRO, 1.16), ...(bub > 0.5 && frame >= tF + 22 ? [thing("bubble", L_BRO + 170 - 118, L_BRO + 170 + 118)] : [])],
      };
    },
  },
  "ep001-listen-whole": {
    nameAr: "الاستماع ٥: استمع إلى حجته كاملة (يومئ)",
    place: LISTEN,
    seq: "ep001-listen",
    render: ({ frame, at, portrait }) => {
      const tL = at("واستمع", 0.2);
      const tW = at("كاملة", 0.8);
      const kc = KC(portrait);
      const bub = 1 - P(frame, tL, 20);
      return {
        cam: portrait ? [kc(0, L_BRO + 130, 1.4, -120), kc(tL, L_HERO + 40, 1.5, -60)] : [kc(0, 1180, 1.4, -120), kc(tL, 1000, 1.26)],
        world: listenWorld(frame, { hero: frame < tW ? "sit" : "sit-nod", bro: "sit-show", bubble: bub, red: 1 }),
        spans: [fig("hero", L_HERO, 1.2, { must: frame >= tL + 20 })],
      };
    },
  },
  "ep001-listen-not-weakness": {
    nameAr: "الاستماع ٦: لم يكن ضعفًا، بل استعدادًا لأن يتعلم",
    place: LISTEN,
    seq: "ep001-listen",
    render: ({ frame, at, portrait }) => {
      const tW = at("ضعفا", 0.2);
      const tT = at("يتعلم", 0.55);
      const tR = at("سماعه", 0.9);
      const kc = KC(portrait);
      return {
        cam: portrait ? [kc(0, L_HERO + 40, 1.5, -60), kc(tT, L_HERO + 30, 1.6, -60), kc(tR, L_BRO - 20, 1.5)] : [kc(0, 1000, 1.26), kc(tT, 940, 1.36, -40), kc(tR, 1000, 1.24)],
        world: listenWorld(frame, { hero: frame < tW ? "sit-nod" : frame < tT ? "sit" : "sit-nod", bro: frame < tR ? "sit-show" : "sit-nod", bubble: 0, red: 0 }),
        spans: [fig("hero", L_HERO, 1.2, { must: !portrait || frame < tR }), fig("brother", L_BRO, 1.16, { must: !portrait || frame >= tR + 20 })],
      };
    },
  },
};

/* ═════════════ تأطير بلا قص (القرار ٩ نوفمبر) بالاتجاهين ═════════════ */

/** هامش الأمان حول الشخص أو العنصر داخل الإطار (بوحدات المشهد) */
export const SPAN_MARGIN = 20;
const DRIFT = 0.045;
/** هل الإطار سليم: داخل المكان، والمطلوب كامل، والاختياري كامل أو غائب كله (العابر مستثنى وهو يمشي) */
export const frameClean = (spans: ShotSpan[], x: number, z: number, portrait: boolean, margin = SPAN_MARGIN) => {
  const half = (portrait ? 304 : 960) / z;
  const v0 = x - half, v1 = x + half;
  if (v0 < -0.5 || v1 > 1920.5) return false;
  return spans.every((sp) => {
    if (sp.moving) return true;
    const inside = sp.lo >= v0 + margin && sp.hi <= v1 - margin;
    if (sp.must) return inside;
    return inside || sp.hi <= v0 - margin / 2 || sp.lo >= v1 + margin / 2;
  });
};
const fitCache = new Map<string, CamKey[]>();
/**
 * يصحح كل مفتاح كاميرا بأقل إزاحة (ثم بأقل تغيير في التكبير) حتى تكون كل لحظات ثباته سليمة:
 * التكوين المصمَّم كما هو ما دام سليمًا، ولا يُقص شخص عند حافة الإطار في الأفقي ولا في نافذة العمودي.
 */
const fitCam = (id: string, d: Def, c: ShotCtx, keys: CamKey[]): CamKey[] => {
  const ks = [...keys].sort((a, b) => a.t - b.t);
  const sig = `${id}|${c.dur}|${c.portrait}|${ks.map((k) => `${k.t},${k.x.toFixed(1)},${k.y.toFixed(1)},${k.z}`).join(";")}`;
  const hit = fitCache.get(sig);
  if (hit) return hit;
  const out = ks.map((k, i) => {
    const end = Math.min(c.dur - 1, i + 1 < ks.length ? ks[i + 1]!.t - 1 : c.dur - 1);
    const start = Math.max(0, Math.min(end, i === 0 ? k.t : k.t + 22));
    const samples = [...new Set([start, Math.round((start + end) / 2), end].map((f) => Math.max(0, Math.min(c.dur - 1, f))))];
    const spansAt = samples.map((f) => ({ f, spans: d.render({ ...c, frame: f }).spans }));
    const ok = (x: number, z: number) => spansAt.every(({ f, spans }) => frameClean(spans, x, z * (1 + DRIFT * (f / c.dur)), c.portrait));
    if (ok(k.x, k.z)) return k;
    const dy = k.y - (860 - 390 / k.z);
    const zs = [...new Set([...[1, 0.92, 0.84, 1.12, 0.76, 1.25, 0.68, 1.4, 1.6].map((m) => Math.max(1, k.z * m)), 1.2, 1.1, 1])];
    let best: { x: number; z: number; cost: number } | null = null;
    for (const z of zs) {
      const half = (c.portrait ? 304 : 960) / z;
      for (let dx = 0; dx <= 700; dx += 8) {
        for (const sgn of dx ? [-1, 1] : [1]) {
          const x = Math.max(half, Math.min(1920 - half, k.x + sgn * dx));
          if (!ok(x, z)) continue;
          const cost = Math.abs(x - k.x) / 100 + Math.abs(Math.log(z / k.z)) * 4;
          if (!best || cost < best.cost) best = { x, z, cost };
          break;
        }
        if (best && best.z === z) break;
      }
    }
    return best ? { t: k.t, x: best.x, y: 860 - 390 / best.z + dy, z: best.z } : k;
  });
  if (fitCache.size > 4000) fitCache.clear();
  fitCache.set(sig, out);
  return out;
};
const fitted = (defs: Record<string, Def>): Record<string, Def> =>
  Object.fromEntries(Object.entries(defs).map(([id, d]) => [id, { ...d, render: (c: ShotCtx) => { const r = d.render(c); return { ...r, cam: fitCam(id, d, c, r.cam) }; } }]));

export const EP001_SHOTS: Record<string, Def> = fitted({
  ...SCALE_SHOTS,
  ...HOME_SHOTS,
  ...CHAIR_SHOTS,
  ...CAFE_SHOTS,
  ...NIGHT_SHOTS,
  ...DOOR_SHOTS,
  ...LISTEN_SHOTS,
  ...RECALL_SHOTS,
});

/** ربط مشاهد الحلقة 001 بلقطاتها (للخطة والاختبارات والتقرير) */
export const EP001_SCENE_SHOTS: Record<string, string> = {
  "c1-s2": "ep001-scale-weigh", "c1-s3": "ep001-scale-witness1", "c1-s4": "ep001-scale-witness2", "c1-s5": "ep001-scale-verdicts",
  "c1-s39": "ep001-home-found", "c1-s40": "ep001-home-leaf", "c1-s41": "ep001-home-accuse", "c1-s42": "ep001-home-denies",
  "c1-s43": "ep001-home-not-ready", "c1-s44": "ep001-home-waits", "c1-s45": "ep001-home-demand", "c1-s46": "ep001-home-gives",
  "c1-s47": "ep001-home-brother-leaves", "c1-s48": "ep001-home-cat-hook", "c1-s49": "ep001-home-cat-rip", "c1-s50": "ep001-home-stops",
  "c1-s51": "ep001-home-test", "c1-s52": "ep001-home-question-who", "c1-s53": "ep001-home-question-now", "c1-s54": "ep001-home-could",
  "c1-s55": "ep001-home-envelope", "c1-s56": "ep001-home-later", "c1-s57": "ep001-home-why",
  "c1-s78": "ep001-home-envelope-explains", "c1-s79": "ep001-home-knows-must-return",
  "c1-s91": "ep001-chair-finished", "c1-s92": "ep001-chair-beautiful", "c1-s93": "ep001-chair-rocks", "c1-s94": "ep001-chair-could-hide",
  "c1-s95": "ep001-chair-admits", "c1-s96": "ep001-chair-value", "c1-s97": "ep001-chair-first-fix",
  "c1-s105": "ep001-home-no-new-evidence", "c1-s106": "ep001-home-same-justice", "c1-s107": "ep001-home-envelope-still",
  "c1-s109": "ep001-door-pass", "c1-s110": "ep001-door-pause", "c1-s111": "ep001-door-postpones",
  "c1-s114": "ep001-cafe-message", "c1-s115": "ep001-cafe-cropped", "c1-s116": "ep001-cafe-agrees", "c1-s117": "ep001-cafe-almost-sends",
  "c1-s118": "ep001-cafe-original", "c1-s119": "ep001-cafe-context",
  "c1-s125": "ep001-night-alone", "c1-s126": "ep001-night-question", "c1-s127": "ep001-night-q1", "c1-s128": "ep001-night-q2",
  "c1-s129": "ep001-night-q3", "c1-s130": "ep001-night-q4", "c1-s131": "ep001-night-battle", "c1-s132": "ep001-night-image",
  "c1-s134": "ep001-return-arrives", "c1-s135": "ep001-return-knocks", "c1-s136": "ep001-return-coins", "c1-s137": "ep001-return-apology",
  "c1-s138": "ep001-return-not-easy", "c1-s139": "ep001-return-changed",
  "c1-s142": "ep001-listen-sits", "c1-s143": "ep001-listen-no-interrupt", "c1-s144": "ep001-listen-no-reply", "c1-s145": "ep001-listen-feeling",
  "c1-s146": "ep001-listen-whole", "c1-s147": "ep001-listen-not-weakness",
  "c1-s148": "ep001-scale-recall-1", "c1-s149": "ep001-scale-recall-2", "c1-s150": "ep001-scale-recall-3",
};
