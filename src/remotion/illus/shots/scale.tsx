import React from "react";
import { CLOTH, ID, darken, mix } from "../palette";
import { Figure, LOOKS, POSES, blendPose, handAt, type FigureLook, type PoseSpec } from "../Figure";
import { GROUND, Glow, archPath } from "../world";
import { LightPool, Texture } from "../texture";
import { prog } from "./kit";

/**
 * «ميزان البائع» (الأمر 015): واقعة واحدة يراها شاهدان من جهتين، في زمن واحد متصل.
 * ميزان بكفتين: في اليسرى ثقل معياري، وفي اليمنى البرتقال. أربع حبات أخف من الثقل، فيضع البائع حبتين
 * فتنزل كفة البرتقال (زيادة)، ثم يرفع حبة ويعيدها إلى صندوقه فتستوي الكفتان (خمس حبات = الثقل).
 * الشاهد الأول خلف الزبون: يرى من زاويته يد البائع ترفع حبة من بضاعة الزبون، والزبون وكيسه يحجبان الميزان.
 * الشاهدة الثانية عند طرف الدكان: ترى الكفتين تستويان.
 * والزاويتان قطعان في اللحظة نفسها (لا إعادة)، فالاختلاف في الحكم من اختلاف ما رآه كلٌّ منهما.
 */

const INK = darken(ID.night, 0.55);
const ORANGE = mix(ID.dawn, ID.seal, 0.28);
const WOOD = mix(darken(ID.copper, 0.45), ID.night, 0.25);
const BRASS = mix(ID.copper, ID.paper, 0.15);
/** ظلّا الشاهدين في المقدمة (زاويتا النظر): داكنان بلون لباس كلٍّ منهما، فيُعرف صاحب الزاوية بلا شرح */
const SIL_FIRST = mix(darken(CLOTH.emerald, 0.62), ID.night, 0.25);
const SIL_SECOND = mix(darken(CLOTH.ink, 0.2), ID.night, 0.15);

/** الشخوص: هيئات مختلفة بالأسلوب نفسه وبلا ملامح، وكلهم بالغون بأحجام متقاربة */
export const SCALE_CAST = {
  vendor: { ...LOOKS.vendor, build: 1.3 } satisfies FigureLook,
  customer: { outfit: "thobe", cloth: "copper", head: "kufi", skin: 1, build: 0.9 } satisfies FigureLook,
  first: LOOKS.hero,
  second: LOOKS.woman,
};
export const SCALE_SIZES = { vendor: 1.62, customer: 1.8, first: 1.75, second: 1.68 };

/** مواضع ثابتة في العالم (الزاوية الرئيسية)؛ الشاهدان أقرب في العمودي */
export const scaleLayout = (portrait: boolean) => ({
  // بين الشاهد الأول وكيس الزبون فراغ يسمح بحافة إطار بينهما (لقطة الفعل القريبة تُخرج الأول كاملًا)
  first: portrait ? 600 : 480,
  customer: 790,
  pivot: 1020,
  crate: 1236,
  vendor: 1262,
  second: portrait ? 1450 : 1560,
});
const COUNTER_TOP = GROUND - 232;
const PIVOT_Y = COUNTER_TOP - 150;
const ARM = 92;
const PAN_DROP = 96;
const STALL = { x0: 860, x1: 1340 };
const VENDOR_Y = GROUND + 6;

// ———————————————————— الميزان ————————————————————

/** طرفا العاتق بزاوية tilt (موجب: كفة البرتقال اليمنى أسفل) */
const beamEnds = (x: number, tilt: number) => {
  const a = (tilt * Math.PI) / 180;
  return { L: { x: x - ARM * Math.cos(a), y: PIVOT_Y - ARM * Math.sin(a) }, R: { x: x + ARM * Math.cos(a), y: PIVOT_Y + ARM * Math.sin(a) } };
};
/** موضع الحبة رقم i في كفة البرتقال */
const slot = (p: { x: number; y: number }, i: number) => {
  const row = i < 3 ? 0 : 1;
  const col = row === 0 ? i - 1 : i - 3.5;
  return { x: p.x + col * 25, y: p.y + PAN_DROP - 12 - row * 21 };
};

/** الثقل المعياري: كتلة نحاسية بعنق ومقبض، وحزّان محفوران (بلا كتابة) */
const StandardWeight: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g>
    <path d={`M${x - 24} ${y} L${x - 18} ${y - 34} L${x + 18} ${y - 34} L${x + 24} ${y} Z`} fill={mix(BRASS, ID.night, 0.25)} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
    <rect x={x - 7} y={y - 44} width={14} height={11} fill={mix(BRASS, ID.night, 0.2)} stroke={INK} strokeWidth={2} />
    <circle cx={x} cy={y - 52} r={8} fill={mix(BRASS, ID.night, 0.15)} stroke={INK} strokeWidth={2} />
    <path d={`M${x - 15} ${y - 22} L${x + 15} ${y - 22} M${x - 17} ${y - 12} L${x + 17} ${y - 12}`} stroke={darken(BRASS, 0.45)} strokeWidth={2} />
  </g>
);

/** ميزان بكفتين: الثقل في اليسرى، والبرتقال (goods حبة) في اليمنى. بلا مؤشر: الدليل استواء الكفتين */
export const MarketScale: React.FC<{ x: number; tilt: number; goods: number }> = ({ x, tilt, goods }) => {
  const { L, R } = beamEnds(x, tilt);
  const pan = (p: { x: number; y: number }, content: React.ReactNode) => (
    <g>
      <path d={`M${p.x} ${p.y} L${p.x - 40} ${p.y + PAN_DROP} M${p.x} ${p.y} L${p.x + 40} ${p.y + PAN_DROP}`} stroke={darken(BRASS, 0.3)} strokeWidth={2} />
      {content}
      <path d={`M${p.x - 50} ${p.y + PAN_DROP} Q${p.x} ${p.y + PAN_DROP + 26} ${p.x + 50} ${p.y + PAN_DROP} Z`} fill={BRASS} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
    </g>
  );
  return (
    <g>
      <path d={`M${x - 46} ${COUNTER_TOP} Q${x} ${COUNTER_TOP - 26} ${x + 46} ${COUNTER_TOP} Z`} fill={darken(BRASS, 0.12)} stroke={INK} strokeWidth={2.6} />
      <rect x={x - 6} y={PIVOT_Y} width={12} height={COUNTER_TOP - PIVOT_Y - 12} fill={darken(BRASS, 0.08)} stroke={INK} strokeWidth={2.2} />
      {pan(L, <StandardWeight x={L.x} y={L.y + PAN_DROP} />)}
      {pan(
        R,
        Array.from({ length: goods }, (_, i) => {
          const s = slot(R, i);
          return <circle key={i} cx={s.x} cy={s.y} r={13} fill={ORANGE} stroke={INK} strokeWidth={2} />;
        }),
      )}
      <line x1={L.x} y1={L.y} x2={R.x} y2={R.y} stroke={BRASS} strokeWidth={7} strokeLinecap="round" />
      <line x1={L.x} y1={L.y} x2={R.x} y2={R.y} stroke={INK} strokeWidth={1.5} opacity={0.5} />
      <circle cx={x} cy={PIVOT_Y} r={8} fill={BRASS} stroke={INK} strokeWidth={2} />
    </g>
  );
};

// ———————————————————— الواقعة (زمن واحد) ————————————————————

/** لحظات الواقعة والسرد بالإطارات */
export type ScaleBeats = { add: number; lift: number; witnesses: number; first: number; firstSay: number; second: number; secondSay: number; link: number };

/**
 * ذراع البائع: وضعيات محسوبة لتصل كفّه فعلًا إلى الصندوق والكفة وفوقها (أقرب زاويتين بالبحث)،
 * والحبة المحمولة في كفه بالحساب نفسه الذي تُرسم به الشخصية.
 */
const reach = (target: { x: number; y: number }, base: PoseSpec = POSES.stand): PoseSpec => {
  let best = { d: Infinity, s: 0, e: 0 };
  for (let s = -20; s <= 170; s += 2)
    for (let e = 0; e <= 140; e += 2) {
      const h = handAt({ ...base, armFront: { s, e } }, { x: STALL_VENDOR.x, y: VENDOR_Y, scale: SCALE_SIZES.vendor, flip: true });
      const d = Math.hypot(h.x - target.x, h.y - target.y);
      if (d < best.d) best = { d, s, e };
    }
  return { ...base, armFront: { s: best.s, e: best.e } };
};
const STALL_VENDOR = { x: 1262 };
const pivotX = 1020;
const panR0 = { x: pivotX + ARM, y: PIVOT_Y };
const ARM_POSES = (() => {
  const lean = { ...POSES.stand, lean: 6 };
  return {
    rest: POSES.stand,
    crate: reach({ x: 1220, y: COUNTER_TOP - 60 }, lean),
    pan: reach({ x: panR0.x + 6, y: PIVOT_Y + PAN_DROP - 40 }, lean),
    // فوق الكفة وإلى جهة البائع: في زاوية الأول تظهر اليد بالحبة بجانب الزبون لا خلفه
    up: reach({ x: 1205, y: PIVOT_Y - 170 }, lean),
  };
})();

/** خط زمني للذراع: [إطار، وضعية]، بانتقال ناعم بين كل وضعيتين متتاليتين */
const armAt = (frame: number, tl: [number, PoseSpec][]): PoseSpec => {
  if (frame <= tl[0]![0]) return tl[0]![1];
  for (let i = 1; i < tl.length; i++) {
    const [a0, p0] = tl[i - 1]!;
    const [a1, p1] = tl[i]!;
    if (frame < a1) return blendPose(p0, p1, prog(frame, a0, a1));
  }
  return tl[tl.length - 1]![1];
};

/**
 * حالة الواقعة في أي إطار: وضعية البائع، والحبة في كفه، وعدد الحبات في الكفة، وميل الميزان.
 * أربع حبات (أخف) ← يضع حبتين (أثقل) ← يرفع حبة (تستوي الكفتان).
 */
export const scaleState = (frame: number, b: ScaleBeats) => {
  const A = ARM_POSES;
  const tl: [number, PoseSpec][] = [
    [b.add - 30, A.rest],
    [b.add - 16, A.crate],
    [b.add - 10, A.crate],
    [b.add + 6, A.pan],
    [b.add + 14, A.pan],
    [b.add + 28, A.rest],
    [b.lift - 14, A.rest],
    [b.lift, A.pan],
    [b.lift + 4, A.pan],
    [b.lift + 14, A.up],
    [b.lift + 24, A.up],
    [b.lift + 40, A.crate],
    [b.lift + 46, A.crate],
    [b.lift + 62, A.rest],
  ];
  const pose = armAt(frame, tl);
  const hand = handAt(pose, { x: STALL_VENDOR.x, y: VENDOR_Y, scale: SCALE_SIZES.vendor, flip: true });
  // الحبات: حبتان من الصندوق إلى الكفة، ثم حبة من الكفة إلى الصندوق
  const carryIn = frame >= b.add - 10 && frame < b.add + 6 ? 2 : 0;
  const carryOut = frame >= b.lift + 4 && frame < b.lift + 42 ? 1 : 0;
  const goods = 4 + (frame >= b.add + 6 ? 2 : 0) - (frame >= b.lift + 4 ? 1 : 0);
  const crate = 6 - (frame >= b.add - 10 ? 2 : 0) + (frame >= b.lift + 42 ? 1 : 0);
  // الميل: أخف (-13)، أثقل (+13)، مستوٍ (0)، بارتداد يسكن بعد كل تغيّر (والاستواء أبطأ قليلًا)
  const resp = (f: number, at: number, from: number, to: number, slow: number) => {
    if (f < at) return from;
    const t = f - at;
    return to + (from - to) * Math.exp(-t / slow) * Math.cos(t / (slow * 0.55));
  };
  let tilt = -13;
  if (frame >= b.add + 6) tilt = resp(frame, b.add + 6, -13, 13, 7);
  if (frame >= b.lift + 4) tilt = resp(frame, b.lift + 4, resp(b.lift + 4, b.add + 6, -13, 13, 7), 0, 11);
  return { pose, hand, carried: carryIn || carryOut, goods, crate, tilt };
};

// ———————————————————— الدكان ————————————————————

const Crate: React.FC<{ x: number; n: number }> = ({ x, n }) => (
  <g>
    {Array.from({ length: Math.max(0, n) }, (_, i) => (
      <circle key={i} cx={x - 40 + (i % 4) * 27} cy={COUNTER_TOP - 52 - Math.floor(i / 4) * 20} r={13} fill={ORANGE} stroke={INK} strokeWidth={2} />
    ))}
    <rect x={x - 62} y={COUNTER_TOP - 52} width={124} height={52} fill={mix(WOOD, ID.copper, 0.35)} stroke={INK} strokeWidth={2.6} />
    <path d={`M${x - 62} ${COUNTER_TOP - 26} L${x + 62} ${COUNTER_TOP - 26}`} stroke={INK} strokeWidth={2} opacity={0.6} />
  </g>
);

const Counter: React.FC<{ x0: number; x1: number }> = ({ x0, x1 }) => (
  <g>
    <rect x={x0} y={COUNTER_TOP} width={x1 - x0} height={GROUND - COUNTER_TOP} fill={WOOD} stroke={INK} strokeWidth={2.6} />
    <rect x={x0 - 12} y={COUNTER_TOP - 8} width={x1 - x0 + 24} height={14} fill={mix(WOOD, ID.copper, 0.4)} stroke={INK} strokeWidth={2.6} />
    {[0.33, 0.66].map((k) => (
      <line key={k} x1={x0 + (x1 - x0) * k} y1={COUNTER_TOP + 14} x2={x0 + (x1 - x0) * k} y2={GROUND - 6} stroke={INK} strokeWidth={2} opacity={0.45} />
    ))}
  </g>
);

/** الجدار والمظلة والأرض: جدار هادئ بقوسين خافتين، وضوء داخلي واحد على موضع الوزن */
const StallBack: React.FC<{ frame: number }> = ({ frame }) => {
  const wall = mix(darken(ID.copper, 0.5), ID.night, 0.35);
  const wallFar = mix(wall, ID.night, 0.35);
  const { x0, x1 } = STALL;
  const sway = Math.sin(frame / 30) * 0.45;
  return (
    <g>
      <rect x={-600} y={-1000} width={3100} height={GROUND + 1000} fill={wallFar} />
      <Texture kind="plaster" x={-600} y={-1000} w={3100} h={GROUND + 1000} opacity={0.18} />
      <path d={archPath(250, GROUND, 170, 330)} fill={darken(wallFar, 0.25)} opacity={0.7} />
      <path d={archPath(1640, GROUND, 170, 330)} fill={darken(wallFar, 0.25)} opacity={0.7} />
      <rect x={x0 - 30} y={GROUND - 520} width={x1 - x0 + 60} height={520} fill={wall} />
      <path d={archPath((x0 + x1) / 2 - 170, GROUND - 232, 340, 260)} fill={darken(wall, 0.35)} />
      <g transform={`translate(0 ${sway})`}>
        <path d={`M${x0 - 60} ${GROUND - 540} L${x1 + 60} ${GROUND - 540} L${x1 + 30} ${GROUND - 470} L${x0 - 30} ${GROUND - 470} Z`} fill={ID.seal} stroke={INK} strokeWidth={2.6} />
        {Array.from({ length: 7 }, (_, i) => {
          const w = (x1 - x0 + 120) / 14;
          const a = x0 - 60 + (i * 2 + 1) * w;
          return <path key={i} d={`M${a} ${GROUND - 540} L${a + w} ${GROUND - 540} L${a + w - 2} ${GROUND - 470} L${a - 2} ${GROUND - 470} Z`} fill={mix(ID.paper, ID.copper, 0.2)} opacity={0.9} />;
        })}
        <path d={`M${x0 - 30} ${GROUND - 470} ${Array.from({ length: 10 }, () => `q${(x1 - x0 + 60) / 20} 22 ${(x1 - x0 + 60) / 10} 0`).join(" ")}`} fill={ID.seal} stroke={INK} strokeWidth={2.4} />
      </g>
      <Glow cx={pivotX + 40} cy={GROUND - 380} r={330} color={ID.dawn} opacity={0.45} />
      <LightPool cx={pivotX + 40} cy={COUNTER_TOP + 6} rx={260} ry={26} color={ID.dawn} opacity={0.5} />
      <rect x={-600} y={GROUND} width={3100} height={900} fill={mix(darken(ID.night, 0.3), ID.copper, 0.12)} />
      <LightPool cx={(x0 + x1) / 2} cy={GROUND + 30} rx={520} ry={50} color={ID.dawn} opacity={0.22} />
      <rect x={-600} y={GROUND} width={3100} height={3} fill={darken(ID.night, 0.4)} opacity={0.6} />
    </g>
  );
};

/** الدكان بما عليه في لحظة ما: البائع، الطاولة، الصندوق، الميزان، والحبة في كف البائع */
const StallAt: React.FC<{ frame: number; b: ScaleBeats }> = ({ frame, b }) => {
  const st = scaleState(frame, b);
  const { R } = beamEnds(pivotX, st.tilt);
  return (
    <g>
      <Figure x={STALL_VENDOR.x} y={VENDOR_Y} scale={SCALE_SIZES.vendor} pose={st.pose} look={SCALE_CAST.vendor} flip frame={frame + 4} />
      <Counter x0={STALL.x0 - 20} x1={STALL.x1 - 10} />
      <Crate x={1236} n={st.crate} />
      <MarketScale x={pivotX} tilt={st.tilt} goods={st.goods} />
      {/* الحبة المحمولة في كف البائع، بهالة خفيفة من ضوء الدكان تقود العين إليها (وهي محور الواقعة) */}
      {st.carried ? <Glow cx={st.hand.x + 4} cy={st.hand.y - 8} r={52} color={ID.dawn} opacity={0.55} /> : null}
      {st.carried
        ? Array.from({ length: st.carried }, (_, i) => <circle key={i} cx={st.hand.x - 4 + i * 20} cy={st.hand.y - 6 - i * 6} r={13} fill={ORANGE} stroke={INK} strokeWidth={2} />)
        : null}
      {void R}
    </g>
  );
};

// ———————————————————— بطاقة الحكم ————————————————————

/** بطاقة تفسير الشخصية مربوطة بها: ذيل يشير إلى رأسها، فوق الرأس بفراغ ومائلة نحو الداخل (أو بجواره بـ above = false) */
export const VerdictTag: React.FC<{ head: { x: number; y: number }; side: 1 | -1; text: string; color: string; t: number; size?: number; above?: boolean }> = ({ head, side, text, color, t, size = 54, above = false }) => {
  if (t <= 0.001) return null;
  const w = text.length * size * 0.58 + 70;
  const h = size * 1.6;
  const cx = above ? head.x - side * 90 : head.x + side * (70 + w / 2);
  const cy = above ? head.y - 80 - h / 2 - 34 : head.y - 20;
  const bg = darken(ID.night, 0.4);
  const tail = above
    ? `M${cx - 16} ${cy + h / 2 - 2} L${head.x} ${head.y - 66} L${cx + 16} ${cy + h / 2 - 2} Z`
    : `M${cx - side * (w / 2)} ${cy - 14} L${head.x + side * 40} ${head.y - 6} L${cx - side * (w / 2)} ${cy + 14} Z`;
  const patch = above ? <rect x={cx - 13} y={cy + h / 2 - 8} width={26} height={10} fill={bg} /> : <rect x={cx - side * (w / 2) - side * 6} y={cy - 13} width={10} height={26} fill={bg} />;
  return (
    <g opacity={t} transform={above ? `translate(0 ${(1 - t) * 12})` : `translate(${side * (1 - t) * 14} ${(1 - t) * 10})`}>
      <path d={tail} fill={bg} stroke={color} strokeWidth={3} strokeLinejoin="round" />
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={h / 2} fill={bg} stroke={color} strokeWidth={3.5} />
      {patch}
      <text x={cx} y={cy + size * 0.34} textAnchor="middle" direction="rtl" fontFamily="'Aref Ruqaa', serif" fontWeight={700} fontSize={size} fill={color}>
        {text}
      </text>
    </g>
  );
};

// ———————————————————— الزوايا ————————————————————

export type ScaleAngle = "main" | "first" | "second";

/** زاوية الشاهد الأول: الدكان مصغّر (أبعد) حول محور الميزان، والزبون أقرب وأكبر بينه وبين الميزان */
export const FIRST_ANGLE = { far: 0.85, lift: 40, customerX: 1082, customerDy: 110, customerScale: 2.5 };
/** نقطة من الدكان في زاوية الشاهد الأول (التحويل نفسه الذي يُرسم به) */
export const firstAngleMap = (p: { x: number; y: number }) => ({ x: pivotX + (p.x - pivotX) * FIRST_ANGLE.far, y: GROUND - FIRST_ANGLE.lift + (p.y - GROUND) * FIRST_ANGLE.far });
/** حدود الميزان (العاتق والكفتان وما فيهما) في العالم، مهما كان ميله */
export const scaleBounds = () => ({ x0: pivotX - ARM - 50, x1: pivotX + ARM + 50, y0: PIVOT_Y - ARM * Math.sin((13 * Math.PI) / 180) - 4, y1: PIVOT_Y + ARM * Math.sin((13 * Math.PI) / 180) + PAN_DROP + 14 });

/**
 * الزاوية الرئيسية: الجميع على خط واحد جانبيًا، والميزان ظاهر كاملًا.
 * first: من خلف كتف الشاهد الأول (ظله في المقدمة): الزبون وكيسه أقرب إلى الكاميرا فيحجبان الميزان،
 *   ويد البائع ترتفع بالحبة فوق كتفه ثم تنزل إلى الصندوق، فيُرى الأخذ ولا يُرى الوزن.
 * second: من عند الشاهدة الثانية (ظلها في المقدمة): الكفتان ظاهرتان.
 */
/** وضعيات الشخوص في الزاوية الرئيسية، وظهور بطاقتي التفسير (0..1) */
export type ScaleCast = { first: PoseSpec; second: PoseSpec; customer: PoseSpec; tags?: { first: number; second: number } };

export const ScaleIncident: React.FC<{ frame: number; b: ScaleBeats; portrait: boolean; angle: ScaleAngle; cast: ScaleCast; verdicts: { first: string; second: string }; size: number }> = ({ frame, b, portrait, angle, cast, verdicts, size }) => {
  const lay = scaleLayout(portrait);
  const S = SCALE_SIZES;
  if (angle === "first") {
    // الدكان أبعد (أصغر)، والزبون أقرب بين الكاميرا والميزان
    const far = FIRST_ANGLE.far;
    const fx = pivotX;
    const custX = FIRST_ANGLE.customerX;
    return (
      <g>
        <StallBack frame={frame} />
        <g transform={`translate(${fx} ${GROUND - FIRST_ANGLE.lift}) scale(${far}) translate(${-fx} ${-GROUND})`}>
          <StallAt frame={frame} b={b} />
        </g>
        <Figure x={custX} y={GROUND + FIRST_ANGLE.customerDy} scale={FIRST_ANGLE.customerScale} pose={POSES.stand} look={SCALE_CAST.customer} holding="bundle" frame={frame + 9} shade={1.2} />
        <Figure x={custX - 440} y={GROUND + 280} scale={3.1} pose={POSES.listen} look={SCALE_CAST.first} silhouette={SIL_FIRST} shadow={false} frame={frame} />
      </g>
    );
  }
  const fHead = { x: lay.first + 6, y: GROUND - 6 - 300 * S.first };
  const sHead = { x: lay.second - 6, y: GROUND - 6 - 300 * S.second };
  return (
    <g>
      <StallBack frame={frame} />
      <StallAt frame={frame} b={b} />
      <Figure x={lay.customer} y={GROUND + 6} scale={S.customer} pose={cast.customer} look={SCALE_CAST.customer} holding="bundle" frame={frame + 9} />
      <Figure x={lay.first} y={GROUND + 6} scale={S.first} pose={cast.first} look={SCALE_CAST.first} frame={frame} />
      {angle === "second" ? null : <Figure x={lay.second} y={GROUND + 6} scale={S.second} pose={cast.second} look={SCALE_CAST.second} flip frame={frame + 13} />}
      {angle === "second" ? <Figure x={pivotX + (portrait ? 330 : 470)} y={GROUND + 230} scale={2.9} pose={POSES.listen} look={SCALE_CAST.second} flip silhouette={SIL_SECOND} shadow={false} frame={frame} /> : null}
      {angle === "main" && cast.tags ? (
        <>
          <VerdictTag head={fHead} side={-1} text={verdicts.first} color={ID.seal} t={cast.tags.first} size={size} above />
          <VerdictTag head={sHead} side={1} text={verdicts.second} color={ID.dawn} t={cast.tags.second} size={size} above />
        </>
      ) : null}
    </g>
  );
};

/** رأس الشاهد في العالم (لموضع بطاقته ولفحص التأطير) */
export const witnessHead = (who: "first" | "second", portrait: boolean) => {
  const lay = scaleLayout(portrait);
  return who === "first" ? { x: lay.first + 6, y: GROUND - 6 - 300 * SCALE_SIZES.first } : { x: lay.second - 6, y: GROUND - 6 - 300 * SCALE_SIZES.second };
};

/** مستطيل بطاقة التفسير في العالم (الحساب نفسه الذي ترسم به VerdictTag فوق الرأس) */
export const verdictTagRect = (head: { x: number; y: number }, side: 1 | -1, text: string, size: number) => {
  const w = text.length * size * 0.58 + 70;
  const h = size * 1.6;
  const cx = head.x - side * 90;
  const cy = head.y - 80 - h / 2 - 34;
  return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: head.y - 66 };
};

const pb = (a: PoseSpec, b2: PoseSpec, t: number) => (t <= 0 ? a : t >= 1 ? b2 : blendPose(a, b2, t));

/**
 * الحلقة 001 · c1-s1 «قد يشاهد شخصان الموقف نفسه، ثم يخرجان منه بحكمين مختلفين تمامًا.»
 * الواقعة كاملة بثلاث زوايا متصلة زمنيًا. اللحظات على كلمات الجملة، بحد أدنى للمسافات فلا تنضغط الواقعة إن أسرع الصوت.
 */
export const scaleEventBeats = (at: (w: string, frac: number) => number) => {
  const witnesses = at("شخصان", 0.15);
  const add = Math.max(at("الموقف", 0.24), 40);
  const lift = Math.max(at("ثم", 0.42), add + 48);
  const back = lift + 76;
  const diverge = Math.max(at("بحكمين", 0.6), back + 6);
  const b: ScaleBeats = { add, lift, witnesses, first: 1e6, firstSay: 1e6, second: 1e6, secondSay: 1e6, link: 1e6 };
  return { b, back, diverge, end: back + 50 };
};
export const scaleEventCast = (frame: number, e: ReturnType<typeof scaleEventBeats>): ScaleCast => ({
  first: pb(pb(POSES.stand, POSES.listen, prog(frame, e.b.witnesses - 4, e.b.witnesses + 10)), POSES.cross, prog(frame, e.diverge, e.diverge + 12)),
  second: pb(pb(POSES.stand, POSES.listen, prog(frame, e.b.witnesses + 2, e.b.witnesses + 16)), POSES.nod, prog(frame, e.diverge + 6, e.diverge + 18)),
  // الزبون واقف ينتظر وزنته: يده لا تمتد فوق كفة الثقل، ولا تدخل لقطتي الكفتين القريبتين
  customer: POSES.stand,
});

/**
 * الحلقة 001 · c1-s2 «الأول يراه ظلمًا، والثاني يراه عدلًا.»: الواقعة انتهت (الميزان مستوٍ، والحبة في الصندوق)،
 * والشاهدان يبدآن بوضعيتي آخر c1-s1 (استمرار)، ثم تفسير كلٍّ عند كلمته وبطاقته.
 */
export const DONE_BEATS: ScaleBeats = { add: -2000, lift: -1000, witnesses: -900, first: -1, firstSay: -1, second: -1, secondSay: -1, link: -1 };
export const scaleVerdictBeats = (at: (w: string, frac: number) => number) => {
  const firstSay = at("ظلمًا", 0.3);
  const second = Math.max(at("والثاني", 0.45), firstSay + 16);
  const secondSay = Math.max(at("عدلًا", 0.75), second + 24);
  return { firstSay, second, secondSay, link: secondSay + 14 };
};
export const scaleVerdictCast = (frame: number, v: ReturnType<typeof scaleVerdictBeats>): ScaleCast => ({
  // الأول عاقد ذراعيه ثم يُعرض عن الدكان عند «ظلمًا» (رفض ما رآه)؛ لا يمد يده نحو كيس الزبون
  first: pb(POSES.cross, POSES["turn-away"], prog(frame, v.firstSay - 4, v.firstSay + 10)),
  second: pb(POSES.nod, POSES.sincere, prog(frame, v.secondSay - 4, v.secondSay + 10)),
  customer: POSES.stand,
  // بطاقة الأول تخبو حين تنتقل الكاميرا إلى الثانية (صاحبها خارج الإطار فلا تُقص) وتعود في اللقطة الرابطة
  tags: {
    first: prog(frame, v.firstSay, v.firstSay + 12) * (1 - prog(frame, v.second, v.second + 10) * (1 - prog(frame, v.link + 8, v.link + 20))),
    second: prog(frame, v.secondSay, v.secondSay + 12),
  },
});

/** الزاوية في كل إطار: الرئيسية، ثم من عند الأول لحظة الرفع، ثم من عند الثانية لحظة الاستواء، ثم الرئيسية */
export const scaleAngleAt = (frame: number, b: ScaleBeats): ScaleAngle =>
  frame >= b.lift - 10 && frame < b.lift + 28 ? "first" : frame >= b.lift + 28 && frame < b.lift + 76 ? "second" : "main";
