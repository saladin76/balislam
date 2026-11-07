import React from "react";
import { ID, darken, lighten, mix } from "../palette";
import { Figure, POSES, blendPose, handAt, type FigureLook, type PoseSpec } from "../Figure";
import { GROUND, Glow, WordPill } from "../world";
import { Cafe, CafeTable, Chair } from "./interior";
import { Courtyard, Rooftops, RoofWall } from "./outdoor";
import { BuzzArcs } from "./phone";
import { K, Walker, prog, pz, type CamKey, type ShotCtx } from "./kit";
import { Counter, Crate, StallBack, StandardWeight } from "./scale";

/**
 * الحلقة 001 · الفصل 2 «عندما يرتدي الباطل ثوب الحق» (التوجيه 019): أربع وحدات بصرية مترابطة بدل الإخراج العام.
 * 1. الصراحة والقسوة: مجلس المقهى (c2-s3، c2-s4، وعودة c2-s14): يجرحه أمام الناس، فيترك الشاب ورقته ويخرج، ثم يبقى وحده معها.
 * 2. الثقة والتكبر: صحن الدار (c2-s5، c2-s6، وعودة c2-s15): رفض التحية وإدارة الظهر، مقابل مصافحة الواثق؛ على أرض واحدة وبلباس واحد.
 * 3. خبر يخدم قضية: الشاهد الأول من الفصل 1 ينشر ما رآه من زاويته (يد البائع ترفع حبة) دون ما حجبه عنه الزبون (الكفتان مستويتان)؛
 *    رؤية ناقصة صادقة النية، لا كذب (c2-s7، c2-s8).
 * 4. صحة المبدأ وخطأ التطبيق: الميزان حين يضيف معنى وفعل بشري حين يكون أدق، ولا تتكرر حركة واحدة:
 *    ثقل لامع يرتفع (c2-s1)، مصباح ينير البضاعة ثم يُرفع إلى الوجه (c2-s2)، ثلاث لوحات للقيم الثلاث (c2-s9)،
 *    ميزان لا يتحرك للكره ولا للتبرير (c2-s12)، يد تضع الثقل في كفته فيستوي (c2-s13)، والاسم والفعل في الختام (c2-s16)؛
 *    وتمهيد الآية c2-s10 سكون تام.
 * شخصيات بلا ملامح، والألوان من الهوية، ولا حدث في جملة فيها ذكر الله.
 */

const INK = darken(ID.night, 0.55);
const BRASS = mix(ID.copper, ID.paper, 0.15);
const ORANGE = mix(ID.dawn, ID.seal, 0.28);
const hero = { outfit: "jacket", cloth: "emerald", head: "hair", skin: 1 } as FigureLook;

/** شخوص الفصل 2 (جدد غير شخوص الفصل 1، إلا البطل: الشاهد الأول) */
export const CH2_CAST = {
  harsh: { outfit: "thobe", cloth: "ink", head: "bare", skin: 1, build: 1.15 } as FigureLook,
  young: { outfit: "shirt", cloth: "teal", head: "hair", skin: 0 } as FigureLook,
  proud: { outfit: "jacket", cloth: "sand", head: "hair", skin: 1, build: 1.1 } as FigureLook,
  worker: { outfit: "shirt", cloth: "clay", head: "kufi", skin: 0 } as FigureLook,
  modest: { outfit: "thobe", cloth: "copper", head: "kufi", skin: 1 } as FigureLook,
  reader: { outfit: "abaya", cloth: "ink", head: "hijab", skin: 0 } as FigureLook,
  vendor: { outfit: "shirt", cloth: "sand", head: "ghutra", skin: 0, pants: "#3A3427", build: 1.3 } as FigureLook,
  // الواثق بلباس المتكبر نفسه وبنيته (التوجيه 021): لا يُعرف الفرق من الملابس، بل من الفعل
  confident: { outfit: "jacket", cloth: "dusk", head: "hair", skin: 0, build: 1.1 } as FigureLook,
};

type Ch2Shot = { nameAr: string; place: string; render: (c: ShotCtx) => { cam: CamKey[]; world: React.ReactNode; captionBackdrop?: number } };

/** خط زمني لوضعيات مكتوبة (PoseSpec) بانتقال 10 إطارات */
const tlPose = (frame: number, tl: [number, PoseSpec][]) => {
  let i = 0;
  while (i + 1 < tl.length && frame >= tl[i + 1]![0]) i++;
  const [t0, p0] = tl[i]!;
  return i > 0 && frame < t0 + 10 ? blendPose(tl[i - 1]![1], p0, prog(frame, t0, t0 + 10)) : p0;
};

// ———————————————————— 4. الميزان: ثقل وكفتان بمحتوى حر ————————————————————

const VS = { pivotY: GROUND - 232 - 150, arm: 92, drop: 96, top: GROUND - 232 };
/** ميزان بكفتين بمحتوى حر لكل كفة (الوحدة 4)؛ tilt موجب: الكفة اليمنى أسفل */
export const ValueScale: React.FC<{ x: number; tilt: number; left: (p: { x: number; y: number }) => React.ReactNode; right: (p: { x: number; y: number }) => React.ReactNode }> = ({ x, tilt, left, right }) => {
  const a = (tilt * Math.PI) / 180;
  const L = { x: x - VS.arm * Math.cos(a), y: VS.pivotY - VS.arm * Math.sin(a) };
  const R = { x: x + VS.arm * Math.cos(a), y: VS.pivotY + VS.arm * Math.sin(a) };
  const pan = (p: { x: number; y: number }, content: React.ReactNode) => (
    <g>
      <path d={`M${p.x} ${p.y} L${p.x - 40} ${p.y + VS.drop} M${p.x} ${p.y} L${p.x + 40} ${p.y + VS.drop}`} stroke={darken(BRASS, 0.3)} strokeWidth={2} />
      {content}
      <path d={`M${p.x - 50} ${p.y + VS.drop} Q${p.x} ${p.y + VS.drop + 26} ${p.x + 50} ${p.y + VS.drop} Z`} fill={BRASS} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
    </g>
  );
  return (
    <g>
      <path d={`M${x - 46} ${VS.top} Q${x} ${VS.top - 26} ${x + 46} ${VS.top} Z`} fill={darken(BRASS, 0.12)} stroke={INK} strokeWidth={2.6} />
      <rect x={x - 6} y={VS.pivotY} width={12} height={VS.top - VS.pivotY - 12} fill={darken(BRASS, 0.08)} stroke={INK} strokeWidth={2.2} />
      {pan(L, left({ x: L.x, y: L.y + VS.drop }))}
      {pan(R, right({ x: R.x, y: R.y + VS.drop }))}
      <line x1={L.x} y1={L.y} x2={R.x} y2={R.y} stroke={BRASS} strokeWidth={7} strokeLinecap="round" />
      <circle cx={x} cy={VS.pivotY} r={8} fill={BRASS} stroke={INK} strokeWidth={2} />
    </g>
  );
};
const oranges = (p: { x: number; y: number }, n: number) =>
  Array.from({ length: n }, (_, i) => {
    const row = i < 3 ? 0 : 1;
    const col = row === 0 ? i - 1 : i - 3.5;
    return <circle key={i} cx={p.x + col * 25} cy={p.y - 12 - row * 21} r={13} fill={ORANGE} stroke={INK} strokeWidth={2} />;
  });
/** ثقل لامع مزيّف: أجمل شكلًا من المعياري وأخف وزنًا */
const ShinyWeight: React.FC<{ x: number; y: number; glow?: number }> = ({ x, y, glow = 1 }) => (
  <g>
    <Glow cx={x} cy={y - 26} r={70} color={lighten(ID.dawn, 0.2)} opacity={0.6 * glow} />
    <path d={`M${x - 22} ${y} L${x - 16} ${y - 34} L${x + 16} ${y - 34} L${x + 22} ${y} Z`} fill={lighten(ID.dawn, 0.25)} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
    <rect x={x - 6} y={y - 44} width={12} height={11} fill={lighten(ID.dawn, 0.3)} stroke={INK} strokeWidth={2} />
    <circle cx={x} cy={y - 51} r={7} fill={lighten(ID.dawn, 0.35)} stroke={INK} strokeWidth={2} />
    <path d={`M${x - 10} ${y - 28} L${x - 4} ${y - 8}`} stroke={lighten(ID.paper, 0.4)} strokeWidth={3} opacity={0.8} />
  </g>
);
/** حجر داكن: الفعل الحقيقي الذي يُوزن (الوحدة 4) */
const ActStone: React.FC<{ x: number; y: number }> = ({ x, y }) => <path d={`M${x - 26} ${y} Q${x - 30} ${y - 30} ${x - 6} ${y - 38} Q${x + 24} ${y - 40} ${x + 28} ${y - 8} L${x + 24} ${y} Z`} fill={darken(ID.night, 0.25)} stroke={INK} strokeWidth={2.4} />;

/** الدكان بلا شاهدين: الخلفية والطاولة والصندوق، والبائع إن طُلب */
const StallSet: React.FC<{ frame: number; vendor?: PoseSpec; vendorFlip?: boolean }> = ({ frame, vendor, vendorFlip = true }) => (
  <g>
    <StallBack frame={frame} />
    {vendor ? <Figure x={1262} y={GROUND + 6} scale={1.62} pose={vendor} look={CH2_CAST.vendor} flip={vendorFlip} frame={frame + 4} /> : null}
    <Counter x0={840} x1={1330} />
    <Crate x={1236} n={5} />
  </g>
);
/** كاميرا الدكان بإحداثيات صريحة لكل اتجاه: العريضة تضم المظلة والبائع والطاولة، والقريبة الميزان وكفتيه كبيرين */
const SC = (t: number, portrait: boolean, close: boolean, x?: number): CamKey =>
  portrait ? { t, x: x ?? 1040, y: close ? 560 : 540, z: close ? 1.25 : 0.95 } : { t, x: x ?? 1020, y: close ? 500 : 530, z: close ? 1.8 : 1.45 };
const V = (t: number, x: number, z: number, y: number): CamKey => ({ t, x, y, z });
const easeIn = (frame: number, a: number, b: number) => prog(frame, a, b);
/** ميل يرتد ثم يسكن عند الهدف */
const settle = (frame: number, at: number, from: number, to: number) => {
  if (frame < at) return from;
  const t = frame - at;
  return to + (from - to) * Math.exp(-t / 9) * Math.cos(t / 5);
};

// ———————————————————— 1. المقهى: الصراحة والقسوة ————————————————————

const PAPER_ON_TABLE = { x: 905, y: GROUND - 206 };
const CafeMajlis: React.FC<{
  frame: number;
  harsh: PoseSpec;
  harshFlip?: boolean;
  harshHolding?: "paper" | "none";
  young: PoseSpec | null;
  youngPaper: boolean;
  onlookers: number;
  look2?: number;
  shame: number;
  emptySeat?: boolean;
  paperOnTable?: boolean;
  children?: React.ReactNode;
}> = ({ frame, harsh, harshFlip = true, harshHolding = "none", young, youngPaper, onlookers, look2, shame, emptySeat, paperOnTable, children }) => (
  <g>
    <Cafe frame={frame} />
    <Chair x={800} />
    <CafeTable x={960} frame={frame} />
    {/* ورقة الشاب (عمله) على الطاولة بعد أن تركها */}
    {paperOnTable ?? emptySeat ? <rect x={PAPER_ON_TABLE.x} y={PAPER_ON_TABLE.y} width={46} height={10} rx={2} fill={mix(ID.paper, ID.night, 0.15)} stroke={INK} strokeWidth={1.6} transform={`rotate(-8 928 ${GROUND - 200})`} /> : null}
    {young ? <Figure x={820} y={GROUND} scale={1.06} pose={young} look={CH2_CAST.young} holding={youngPaper ? "paper" : "none"} frame={frame + 7} /> : null}
    {young ? <Glow cx={830} cy={GROUND - 200} r={170} color="#000" opacity={0.3 * shame} /> : null}
    {children}
    <Figure x={1120} y={GROUND + 4} scale={1.22} pose={harsh} look={CH2_CAST.harsh} flip={harshFlip} holding={harshHolding} frame={frame} />
    {/* رجلان على الطاولة الخلفية: يلتفتان إلى الموقف ثم يخفض أحدهما رأسه حرجًا */}
    <Figure x={1480} y={GROUND - 20} scale={0.86} pose={blendPose(POSES.sit, POSES["sit-nod"], onlookers)} look={CH2_CAST.modest} flip={onlookers < 0.5} frame={frame + 21} />
    <Figure x={1620} y={GROUND - 20} scale={0.86} pose={blendPose(POSES.sit, POSES["sit-low"], look2 ?? onlookers)} look={CH2_CAST.worker} flip frame={frame + 3} />
  </g>
);
/** يشير إلى ورقة الشاب منحنيًا عليه */
const HARSH_POINT: PoseSpec = { ...POSES.point, lean: 16, head: 20, armFront: { s: 64, e: 4 } };
/** يلتفت إلى الحاضرين بذراع مفتوحة: يجعل الكلمة عرضًا أمامهم */
const HARSH_SHOW: PoseSpec = { ...POSES.talk, lean: -2, head: -6, armFront: { s: 70, e: 18 } };

// ———————————————————— 2. صحن الدار: الثقة والتكبر ————————————————————

/** يد ممدودة للتحية أو للمصافحة */
const OFFER: PoseSpec = { ...POSES.stand, lean: 6, head: 6, armFront: { s: 62, e: 14 } };
const SHAKE: PoseSpec = { ...POSES.stand, lean: 4, head: 12, armFront: { s: 62, e: 14 } };
const COURT = { worker: 1160, proud: 1430 };

// ———————————————————— 3. الخبر: ما رآه من زاويته ————————————————————

const WINDOWS = [
  { x: 380, y: GROUND - 520 }, { x: 560, y: GROUND - 470 }, { x: 1440, y: GROUND - 560 }, { x: 1640, y: GROUND - 500 }, { x: 260, y: GROUND - 600 }, { x: 1820, y: GROUND - 590 },
];
/** يد البائع تعيد الحبة الزائدة إلى صندوقه (الفصل 1)؛ من زاوية الشاهد الأول تُرى يدًا ترفع حبة من كفة الزبون */
// الكف فوق كفة البرتقال مباشرة (محسوبة بـhandAt: نحو 1125، 530)
const VENDOR_RETURN: PoseSpec = { ...POSES.point, lean: 0, head: 18, armFront: { s: 35, e: 58 } };
/** إطار ما رآه الشاهد الأول (الصورة): اليد والحبة وطرف الكفة، والعاتق ومحوره والكفة الأخرى خارجه */
const CROP = { x: 1056, y: 470, w: 210, h: 170 };
/** الدكان كاملًا لحظة الواقعة: الكفتان مستويتان (خمس حبات = الثقل)، ويد البائع تحمل السادسة إلى صندوقه */
const StallWhole: React.FC<{ frame: number }> = ({ frame }) => {
  const hand = handAt(VENDOR_RETURN, { x: 1262, y: GROUND + 6, scale: 1.62, flip: true });
  return (
    <g>
      <StallSet frame={frame} vendor={VENDOR_RETURN} />
      <ValueScale x={1020} tilt={0} left={(p) => <StandardWeight x={p.x} y={p.y} />} right={(p) => <g>{oranges(p, 5)}</g>} />
      <circle cx={hand.x - 6} cy={hand.y - 4} r={13} fill={ORANGE} stroke={INK} strokeWidth={2} />
    </g>
  );
};
/** الصورة: ما داخل الإطار ساطع، وما خارجه (الحقيقة كاملة) يظهر خافتًا بمقدار reveal */
const CroppedView: React.FC<{ frame: number; reveal: number; id: string }> = ({ frame, reveal, id }) => (
  <g>
    <defs>
      <clipPath id={id}>
        <rect x={CROP.x} y={CROP.y} width={CROP.w} height={CROP.h} />
      </clipPath>
    </defs>
    <rect x={600} y={150} width={1000} height={760} fill={darken(ID.night, 0.4)} />
    {reveal > 0.01 ? <g opacity={0.5 * reveal}><StallWhole frame={frame} /></g> : null}
    <g clipPath={`url(#${id})`}>
      <StallWhole frame={frame} />
    </g>
    <rect x={CROP.x} y={CROP.y} width={CROP.w} height={CROP.h} fill="none" stroke={ID.paper} strokeWidth={5} strokeDasharray={reveal > 0.01 ? "16 10" : undefined} />
  </g>
);
/** الهاتف بيد الشاهد الأول (منطقة مستقلة في العالم تقطع إليها الكاميرا بالاتجاهين) */
const PH = { x: 3600, y: 540 };
const HeldPhone: React.FC<{ frame: number; thumb: number; sent: number }> = ({ frame, thumb, sent }) => {
  const W = 420;
  const H = 820;
  const x0 = PH.x - W / 2;
  const y0 = PH.y - H / 2;
  const card = { x: x0 + 30, y: y0 + 190, w: W - 60, h: 306 };
  const btn = { x: x0 + W - 92, y: y0 + H - 120 };
  // الصورة تصغر وتطير خارج الهاتف عند الإرسال
  const k = 1 - 0.7 * sent;
  const cx = card.x + card.w / 2;
  const cy = card.y + card.h / 2 - 600 * sent * sent;
  const tx = btn.x + 30 + (1 - thumb) * 200;
  const ty = btn.y + 30 + (1 - thumb) * 260;
  return (
    <g>
      <rect x={PH.x - 1400} y={PH.y - 800} width={2800} height={1600} fill={darken(ID.night, 0.35)} />
      <Glow cx={PH.x} cy={PH.y} r={620} color={mix(ID.dawn, ID.paper, 0.4)} opacity={0.25} />
      <rect x={x0 - 18} y={y0 - 18} width={W + 36} height={H + 36} rx={54} fill={darken(ID.night, 0.6)} stroke={INK} strokeWidth={5} />
      <rect x={x0} y={y0} width={W} height={H} rx={40} fill={mix(ID.night, ID.paper, 0.1)} />
      <rect x={PH.x - 60} y={y0 + 16} width={120} height={22} rx={11} fill={darken(ID.night, 0.6)} />
      {/* الصورة: ما رآه من زاويته */}
      <g transform={`translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`} opacity={1 - prog(sent, 0.7, 1)}>
        <svg x={card.x} y={card.y} width={card.w} height={card.h} viewBox={`${CROP.x} ${CROP.y} ${CROP.w} ${CROP.h}`} preserveAspectRatio="xMidYMid slice">
          <StallWhole frame={frame} />
        </svg>
        <rect x={card.x} y={card.y} width={card.w} height={card.h} fill="none" stroke={ID.paper} strokeWidth={4} />
      </g>
      {sent > 0.05 ? <BuzzArcs x={cx} y={card.y - 40} p={sent} /> : null}
      {/* زر الإرسال: سهم */}
      <circle cx={btn.x + 30} cy={btn.y + 30} r={44} fill={ID.dawn} stroke={INK} strokeWidth={4} />
      <path d={`M${btn.x + 8} ${btn.y + 50} L${btn.x + 56} ${btn.y + 30} L${btn.x + 8} ${btn.y + 10} L${btn.x + 18} ${btn.y + 30} Z`} fill={ID.paper} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      {/* الإبهام يقترب ويضغط */}
      <path d={`M${tx - 40} ${ty + 260} L${tx - 30} ${ty + 20} Q${tx} ${ty - 30} ${tx + 30} ${ty + 20} L${tx + 50} ${ty + 260} Z`} fill={SKIN_T} stroke={INK} strokeWidth={4} />
      <path d={`M${x0 + W - 30} ${y0 + H + 40} L${x0 + W + 260} ${y0 + H - 160} L${x0 + W + 320} ${y0 + H + 300} L${x0 + W - 60} ${y0 + H + 300} Z`} fill={heroCloth} stroke={INK} strokeWidth={4} />
    </g>
  );
};
const SKIN_T = "#D2A782";
const heroCloth = mix(ID.night, ID.paper, 0.32);

// ———————————————————— 4. المصباح (c2-s2) والوحدات الثلاث (c2-s9) ————————————————————

/** مصباح يدوي: غطاء نحاسي وزجاج مضيء وعروة */
const Lantern: React.FC<{ x: number; y: number; on: number }> = ({ x, y, on }) => (
  <g>
    <Glow cx={x} cy={y + 30} r={150} color={ID.dawn} opacity={0.75 * on} />
    <path d={`M${x} ${y - 26} q-12 -16 0 -26 q12 10 0 26`} fill="none" stroke={INK} strokeWidth={3} />
    <path d={`M${x - 18} ${y - 4} L${x} ${y - 20} L${x + 18} ${y - 4} Z`} fill={BRASS} stroke={INK} strokeWidth={2.6} />
    <rect x={x - 14} y={y - 4} width={28} height={44} rx={5} fill={lighten(ID.dawn, 0.3)} stroke={INK} strokeWidth={2.6} />
    <rect x={x - 16} y={y + 40} width={32} height={8} fill={BRASS} stroke={INK} strokeWidth={2.4} />
  </g>
);
/** يحمل المصباح نازلًا نحو البضاعة (ينيرها) أو مرفوعًا إلى وجه من أمامه */
// المواضع محسوبة بـhandAt للبائع عند 1340: المنخفض فوق صندوق البرتقال، والمرتفع أمام وجه الزبونة
const LAMP_LOW: PoseSpec = { ...POSES.point, lean: 0, head: 24, armFront: { s: 29, e: 60 } };
const LAMP_HIGH: PoseSpec = { ...POSES.point, lean: 24, head: 4, armFront: { s: 101, e: 0 } };

/** لوحة مصغرة لموقف من الوحدات الثلاث: نافذة على جزء من العالم بقصّ */
const Panel: React.FC<{ id: string; x: number; y: number; w: number; h: number; view: { x: number; y: number; w: number; h: number }; dim: number; children: React.ReactNode }> = ({ id, x, y, w, h, view, dim, children }) => (
  <g>
    <rect x={x - 8} y={y - 8} width={w + 16} height={h + 16} rx={10} fill={darken(ID.copper, 0.5)} stroke={INK} strokeWidth={3} />
    <svg x={x} y={y} width={w} height={h} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid slice">
      {children}
    </svg>
    <rect x={x} y={y} width={w} height={h} fill="#000" opacity={0.45 * dim} />
    <rect x={x} y={y} width={w} height={h} fill="none" stroke={BRASS} strokeWidth={3} />
    <title>{id}</title>
  </g>
);

export const CH2_SHOTS: Record<string, Ch2Shot> = {
  // ——— الوحدة 4: المدخل ———
  "scale-shiny-weight": {
    nameAr: "الميزان: ثقل لامع جميل الشكل خفيف الوزن (ليس كل باطل يسهل رفضه)",
    place: "دكان الميزان",
    render: ({ frame, at, portrait }) => {
      const tB = at("باطل", 0.25);
      const tR = at("رفضها", 0.8);
      const on = easeIn(frame, tB - 6, tB + 14);
      // المنطق: اللامع أخف من المعياري المقابل له، فترتفع كفته وتنزل كفة المعياري (المرة الوحيدة التي يميل فيها الميزان لثقل مزيف)
      const tilt = settle(frame, tB + 14, 0, -12);
      return {
        cam: [SC(0, portrait, false), SC(tR - 6, portrait, true)],
        world: (
          <g>
            <StallSet frame={frame} vendor={POSES.stand} />
            {on < 1 ? <g opacity={1 - on}><ShinyWeight x={1160} y={VS.top} /></g> : null}
            <ValueScale x={1020} tilt={tilt} left={(p) => <StandardWeight x={p.x} y={p.y} />} right={(p) => (on > 0 ? <g opacity={on}><ShinyWeight x={p.x} y={p.y} glow={1 - 0.6 * prog(frame, tR - 10, tR + 10)} /></g> : null)} />
          </g>
        ),
      };
    },
  },
  "stall-lantern-misused": {
    nameAr: "الدكان مساءً: مصباح ينير البضاعة (معنى صحيح) ثم يُرفع إلى وجه الزبونة (في غير موضعه)",
    place: "دكان الميزان مساءً",
    render: ({ frame, at, portrait }) => {
      // التوجيه 021: فعل بشري بدل حركة الميزان. البائع يرفع المصباح إلى وجه الزبونة فتحجب عينيها (التصرف الخاطئ)،
      // ثم يُرى المعنى الصحيح وراءه: يخفضه فتضيء البرتقالات (الضوء يُري)، ثم يرفعه إلى وجهها ثانية: الضوء نفسه في غير موضعه.
      const tW = at("الخاطئ", 0.3);
      const tM = at("معنى", 0.42);
      const tU = at("يستخدمه", 0.7);
      const highA = prog(frame, tW - 16, tW) * (1 - prog(frame, tM - 14, tM));
      const highB = prog(frame, tU - 10, tU + 6);
      const high = Math.max(highA, highB);
      const vendorPose = blendPose(LAMP_LOW, LAMP_HIGH, high);
      const VX = 1340;
      const hand = handAt(vendorPose, { x: VX, y: GROUND + 6, scale: 1.5, flip: true });
      const glare = high;
      const fruitLit = prog(frame, tM - 6, tM + 10) * (1 - prog(frame, tU - 10, tU));
      // الزبونة: تنظر إلى البرتقال حين يُضاء، وتحجب عينيها وتميل للخلف حين يُرفع المصباح إلى وجهها
      const custPose = blendPose(blendPose(POSES.stand, { ...POSES.listen, head: 26, lean: 8 }, fruitLit), { ...POSES.halt, head: -10, lean: -8, armFront: { s: 150, e: 30 } }, glare);
      return {
        captionBackdrop: 0.3,
        cam: portrait ? [V(0, 1180, 1.0, 560), V(tW - 18, 1160, 1.2, 520), V(tM - 8, 1200, 1.2, 580), V(tU - 12, 1160, 1.2, 520)] : [K(0, 1160, 1.4, -40), K(tW - 18, 1180, 1.6, -60), K(tM - 8, 1200, 1.6, -20), K(tU - 12, 1180, 1.6, -60)],
        world: (
          <g>
            <StallBack frame={frame} />
            <Counter x0={840} x1={1330} />
            <Crate x={1236} n={5} />
            <ValueScale x={1020} tilt={0} left={(p) => <StandardWeight x={p.x} y={p.y} />} right={(p) => <g>{oranges(p, 5)}</g>} />
            {/* المساء: عتمة على الدكان إلا ما يقع عليه ضوء المصباح */}
            <rect x={-300} y={-300} width={2520} height={1500} fill={darken(ID.night, 0.3)} opacity={0.5} />
            <Glow cx={1236} cy={GROUND - 250} r={150} color={ID.dawn} opacity={0.8 * fruitLit} />
            <Figure x={1060} y={GROUND + 8} scale={1.45} pose={custPose} look={CH2_CAST.reader} frame={frame + 5} />
            <Figure x={VX} y={GROUND + 6} scale={1.5} pose={vendorPose} look={CH2_CAST.vendor} flip frame={frame + 4} />
            <Lantern x={hand.x - 4} y={hand.y + 6} on={1} />
            <Glow cx={1080} cy={GROUND - 390} r={110} color={lighten(ID.dawn, 0.3)} opacity={0.6 * glare} />
          </g>
        ),
      };
    },
  },

  // ——— الوحدة 1: المقهى ———
  "cafe-harsh-candor": {
    nameAr: "المقهى: يجرح الشاب أمام الناس ثم يقول: أنا صريح",
    place: "مقهى الحارة",
    render: ({ frame, at, portrait }) => {
      // التوجيه 021: الفعل ورد الفعل واضحان. الشاب يعرض ورقته؛ عند «يجرح» ينحني القاسي ويشير إليها،
      // فيُنزل الشاب ورقته وينكمش؛ عند «الآخرين» يلتفت القاسي إلى الحاضرين بذراع مفتوحة (يجعلها عرضًا) فيلتفتون؛
      // عند «يقول» يضع يده على صدره (أنا صريح) أمامهم، ثم يرفع رأسه.
      const tH = at("يجرح", 0.2);
      const tO = at("الآخرين", 0.28);
      const tS = at("يقول", 0.6);
      const tF = at("صريح", 0.86);
      const harsh = tlPose(frame, [[0, POSES.stand], [tH - 6, HARSH_POINT], [tO + 4, HARSH_SHOW], [tS, POSES.sincere], [tF - 2, POSES.proud]]);
      const young = tlPose(frame, [[0, POSES["sit-show"]], [tH + 2, POSES["sit-low"]], [tH + 24, POSES["head-down"]]]);
      return {
        captionBackdrop: 0.3,
        cam: portrait
          ? [V(0, 970, 1.0, 600), V(tH - 6, 900, 1.35, 650), V(tO + 2, 1360, 1.0, 620), V(tS - 4, 1110, 1.3, 600)]
          : [K(0, 1000, 1.35), K(tH - 6, 930, 1.8), K(tO + 2, 1250, 1.2), K(tS - 4, 1100, 1.6)],
        world: <CafeMajlis frame={frame} harsh={harsh} harshFlip={frame < tO + 4} young={young} youngPaper onlookers={prog(frame, tO + 4, tO + 20)} look2={prog(frame, tS, tS + 20)} shame={prog(frame, tH, tH + 20)} />,
      };
    },
  },
  "cafe-harsh-cost": {
    nameAr: "المقهى: الصراحة لا تبرر القسوة (يترك الشاب ورقته ويخرج)",
    place: "مقهى الحارة",
    render: ({ frame, at, portrait }) => {
      // يبدأ من آخر c2-s3 (القاسي مرفوع الرأس أمام الحاضرين)؛ عند «القسوة» إلى الشاب: ورقته في حجره؛
      // عند «وإهانة» يضعها على الطاولة ويقوم ويخرج؛ وعند «الناس» يخفض الحاضران رأسيهما.
      const tC = at("القسوة", 0.58);
      const tI = at("وإهانة", 0.7);
      const tN = at("الناس", 0.82);
      const seated = frame < tI + 8;
      return {
        captionBackdrop: 0.3,
        cam: portrait ? [V(0, 1110, 1.3, 600), V(tC - 8, 860, 1.3, 650), V(tI + 4, 760, 0.95, 600)] : [K(0, 1100, 1.6), K(tC - 8, 880, 1.7), K(tI + 4, 900, 1.2)],
        world: (
          <CafeMajlis frame={frame} harsh={POSES.proud} harshFlip={false} young={seated ? POSES["head-down"] : null} youngPaper={frame < tI} onlookers={1} look2={prog(frame, tN - 4, tN + 12)} shame={1} paperOnTable={frame >= tI}>
            {!seated ? <Walker frame={frame} from={820} to={-220} y={GROUND} start={tI + 8} look={CH2_CAST.young} scale={1.06} /> : null}
          </CafeMajlis>
        ),
      };
    },
  },
  "cafe-harsh-alone": {
    nameAr: "المقهى (عودة): وحده أمام المقعد الفارغ، يرفع ورقة الشاب وينظر فيها",
    place: "مقهى الحارة",
    render: ({ frame, at, portrait }) => {
      // يُكمل الحدث الأول: المقعد الذي جلس فيه الشاب فارغ وورقته على الطاولة. عند «لكن» ينظر إليها (تضيء)،
      // وعند «قلناه» يرفعها وينظر فيها، وعند «ليس» يخفض رأسه وهي في يده.
      const tB = at("لكن", 0.36);
      const tQ = at("قلناه", 0.46);
      const tN = at("ليس", 0.55);
      const lifted = frame >= tQ;
      const pose = tlPose(frame, [[0, { ...POSES.stand, head: 4 }], [tB - 4, { ...POSES.stand, head: 26, lean: 6 }], [tQ - 6, { ...POSES.point, lean: 18, head: 30, armFront: { s: 40, e: 6 } }], [tQ + 4, POSES.hold], [tN, { ...POSES.hold, head: 34, lean: 8 }]]);
      return {
        captionBackdrop: 0.3,
        cam: portrait ? [V(0, 1000, 1.0, 600), V(tB - 6, 1010, 1.35, 620)] : [K(0, 1040, 1.25), K(tB - 6, 1000, 1.75)],
        world: (
          <g>
            <CafeMajlis frame={frame} harsh={pose} harshHolding={lifted ? "paper" : "none"} young={null} youngPaper={false} onlookers={prog(frame, tN, tN + 20)} shame={0} paperOnTable={!lifted} />
            <Glow cx={928} cy={GROUND - 210} r={110} color={ID.dawn} opacity={0.45 * prog(frame, tB - 6, tB + 10) * (lifted ? 0 : 1)} />
          </g>
        ),
      };
    },
  },

  // ——— الوحدة 2: صحن الدار ———
  "courtyard-pride": {
    nameAr: "صحن الدار: يرفض يد العامل الممدودة ويعطيه ظهره، ثم يقول: أعرف قيمة نفسي",
    place: "صحن دار بنافورة",
    render: ({ frame, at, portrait }) => {
      // التوجيه 021: التكبر من الفعل لا من الملابس ولا من مكان الوقوف: على أرض واحدة. العامل يمد يده للتحية؛
      // عند «يتكبر» ينظر المتكبر إلى اليد ثم يعطيه ظهره؛ عند «غيره» تنزل يد العامل ورأسه؛ عند «يقول» يقف مرفوع الرأس ويداه خلفه.
      const tP = at("يتكبر", 0.15);
      const tG = at("غيره", 0.32);
      const tS = at("يقول", 0.47);
      const turned = frame >= tP + 8;
      return {
        cam: portrait ? [V(0, 1290, 1.05, 560), V(tP - 4, 1300, 1.3, 540), V(tS, 1330, 1.15, 560)] : [K(0, 1290, 1.45, 60), K(tP - 4, 1300, 1.8, 40), K(tS, 1300, 1.45, 60)],
        world: (
          <g>
            <Courtyard frame={frame} />
            <Figure x={COURT.worker} y={GROUND + 4} scale={1.22} pose={tlPose(frame, [[0, POSES.stand], [6, OFFER], [tG, { ...POSES.stand, head: 22 }]])} look={CH2_CAST.worker} frame={frame + 9} />
            <Figure x={COURT.proud} y={GROUND + 4} scale={1.22} pose={tlPose(frame, [[0, POSES.stand], [tP - 4, { ...POSES.stand, head: 18 }], [tP + 8, { ...POSES.stand, head: -6 }], [tS, POSES.proud]])} look={CH2_CAST.proud} flip={!turned} frame={frame} />
          </g>
        ),
      };
    },
  },
  "courtyard-confident-greets": {
    nameAr: "صحن الدار: الواثق يصافح العامل نفسه بانحناءة احترام (معرفة القدر لا تعني الاحتقار)",
    place: "صحن دار بنافورة",
    render: ({ frame, at, portrait }) => {
      // الواثق بلباس المتكبر نفسه: يمشي مستقيم القامة (يعرف قدره)، يقف عند «قدر»، ويصافح العامل وينحني له قليلًا عند «احتقار»؛
      // يرفع العامل رأسه عند «الآخرين». والمتكبر في الخلف مدير ظهره كما كان.
      const tK = at("قدر", 0.3);
      const tC = at("احتقار", 0.6);
      const tO = at("الآخرين", 0.74);
      const workerHand = handAt(SHAKE, { x: COURT.worker, y: GROUND + 4, scale: 1.22, flip: true });
      const myOff = handAt(SHAKE, { x: 0, y: GROUND + 4, scale: 1.22 });
      const cx = workerHand.x - myOff.x;
      const shake = prog(frame, tC - 10, tC + 4);
      return {
        cam: portrait ? [V(0, 1000, 1.0, 560), V(tK, 1060, 1.3, 540), V(tC - 8, 1100, 1.25, 540), V(tO, 1250, 0.9, 560)] : [K(0, 1100, 1.3, 60), K(tK, 1080, 1.7, 40), K(tO, 1220, 1.25, 60)],
        world: (
          <g>
            <Courtyard frame={frame} />
            <Figure x={COURT.proud} y={GROUND + 4} scale={1.22} pose={POSES.proud} look={CH2_CAST.proud} frame={frame} />
            <Figure x={COURT.worker} y={GROUND + 4} scale={1.22} pose={tlPose(frame, [[0, { ...POSES.stand, head: 22 }], [tC - 10, SHAKE], [tO, { ...SHAKE, head: -2, lean: 0 }]])} look={CH2_CAST.worker} flip frame={frame + 9} />
            {frame < tK - 6 ? (
              <Walker frame={frame} from={640} to={cx} y={GROUND + 4} start={0} end={tK - 6} look={CH2_CAST.confident} scale={1.22} />
            ) : (
              <Figure x={cx} y={GROUND + 4} scale={1.22} pose={tlPose(frame, [[0, { ...POSES.stand, head: -4 }], [tC - 10, SHAKE], [tC + 4, { ...SHAKE, head: 20, lean: 10 }], [tO, SHAKE]])} look={CH2_CAST.confident} frame={frame} />
            )}
            <Glow cx={(cx + COURT.worker) / 2} cy={workerHand.y} r={130} color={ID.dawn} opacity={0.5 * shake} />
          </g>
        ),
      };
    },
  },
  "courtyard-proud-alone": {
    nameAr: "صحن الدار (عودة): العامل والواثق يتحدثان، والمتكبر وحده ينظر إليهما ثم يخفض رأسه",
    place: "صحن دار بنافورة",
    render: ({ frame, at, portrait }) => {
      const tB = at("لكن", 0.55);
      const tF = at("فعلناه", 0.65);
      const tK = at("تكبرا", 0.82);
      return {
        cam: portrait ? [V(0, 1130, 0.85, 560), V(tB, 1400, 1.3, 540)] : [K(0, 1130, 1.15, 80), K(tB, 1340, 1.6, 50)],
        world: (
          <g>
            <Courtyard frame={frame} />
            <Glow cx={940} cy={GROUND - 250} r={260} color={ID.dawn} opacity={0.45} />
            <Figure x={860} y={GROUND + 4} scale={1.22} pose={tlPose(frame, [[0, POSES.talk], [60, POSES.listen], [120, POSES.talk]])} look={CH2_CAST.worker} flip frame={frame + 9} />
            <Figure x={700} y={GROUND + 4} scale={1.22} pose={tlPose(frame, [[0, POSES.listen], [60, POSES.talk], [120, POSES.listen]])} look={CH2_CAST.confident} frame={frame} />
            {/* المتكبر: عند «لكن» يلتفت إليهما، وعند «فعلناه» ينظر إلى يده التي لم يمدها، وعند «تكبرًا» يخفض رأسه */}
            <Figure x={1480} y={GROUND + 4} scale={1.22} pose={tlPose(frame, [[0, POSES.proud], [tB, { ...POSES.stand, head: 4 }], [tF, { ...POSES.stand, head: 26, armFront: { s: 40, e: 60 } }], [tK, { ...POSES.stand, head: 30, lean: 6 }]])} look={CH2_CAST.proud} flip={frame >= tB} frame={frame} />
            <rect x={1300} y={-200} width={500} height={1300} fill="#000" opacity={0.18 * prog(frame, tK, tK + 20)} />
          </g>
        ),
      };
    },
  },

  // ——— الوحدة 3: الخبر ———
  "roof-news-spreads": {
    nameAr: "الخبر: الشاهد الأول ينشر ما رآه من زاويته (يد ترفع حبة)، وما حجبه عنه الزبون خارج الصورة، والخبر ينتشر",
    place: "أسطح المدينة ليلًا، وهاتفه",
    render: ({ frame, at, portrait }) => {
      // التوجيه 021: النشر والانتقال والنتيجة مفهومة على الهاتف، بلا نص صغير. ينشر صورة صادقة لكنها ناقصة (الفصل 1):
      // 1) على السطح بهاتفه؛ 2) «ينشر»: الصورة على شاشته والإبهام يضغط الإرسال عند «خبرًا» فتطير؛
      // 3) «لم يتحقق»: الصورة نفسها كبيرة ثم يظهر حولها خافتًا ما لم تلتقطه: الكفتان مستويتان والحبة عائدة إلى الصندوق؛
      // 4) «لأنه»: النوافذ تضيء واحدة بعد أخرى بالصورة نفسها، وهو يضع يده على صدره عند «عادلة» (مقتنع، لا يكذب).
      const tN = at("ينشر", 0.11);
      const tX = at("خبرا", 0.18);
      const tU = at("يتحقق", 0.28);
      const tL = at("لأنه", 0.43);
      const tJ = at("عادلة", 0.84);
      const PHOTO = { x: 6000, y: 540 };
      const cam: CamKey[] = portrait
        ? [K(0, 980, 1.35, -90), { t: tN - 2, x: PH.x, y: PH.y, z: 1.05, cut: true }, { t: tU - 6, x: PHOTO.x + CROP.w / 2 - 1000 + CROP.x, y: PHOTO.y + CROP.y + CROP.h / 2 - 540, z: 2.4, cut: true }, { t: tU + 2, x: PHOTO.x + 1060 - 1000, y: PHOTO.y, z: 0.95 }, { ...K(tL + 6, 980, 0.95, -60), cut: true }, K(tJ - 10, 980, 1.3, -80)]
        : [K(0, 980, 1.7, -90), { t: tN - 2, x: PH.x, y: PH.y, z: 1.0, cut: true }, { t: tU - 6, x: PHOTO.x + CROP.w / 2 - 1000 + CROP.x, y: PHOTO.y + CROP.y + CROP.h / 2 - 540, z: 3.4, cut: true }, { t: tU + 2, x: PHOTO.x + 1060 - 1000, y: PHOTO.y - 60, z: 1.45 }, { ...K(tL + 6, 980, 1.1, -60), cut: true }, K(tJ - 10, 980, 1.5, -80)];
      return {
        captionBackdrop: 0.4,
        cam,
        world: (
          <g>
            <Rooftops frame={frame} mood="night" />
            {WINDOWS.map((w, i) => {
              const on = prog(frame, tL + 12 + i * 9, tL + 20 + i * 9);
              return (
                <g key={i}>
                  <Glow cx={w.x} cy={w.y} r={90} color={ID.dawn} opacity={0.6 * on} />
                  <rect x={w.x - 16} y={w.y - 13} width={32} height={26} fill={ID.dawn} opacity={0.3 + 0.7 * on} stroke={INK} strokeWidth={2} />
                  {/* الصورة نفسها في كل نافذة */}
                  {on > 0.05 ? (
                    <svg x={w.x - 13} y={w.y - 10} width={26} height={20} viewBox={`${CROP.x} ${CROP.y} ${CROP.w} ${CROP.h}`} preserveAspectRatio="xMidYMid slice" opacity={on}>
                      <StallWhole frame={frame} />
                    </svg>
                  ) : null}
                </g>
              );
            })}
            <Figure x={980} y={GROUND + 40} scale={1.3} pose={pz(frame, [[0, "hold"], [tJ - 8, "sincere"]])} look={hero} holding={frame >= tJ - 8 ? "none" : "phone"} frame={frame} rim={0.4} rimColor={ID.paper} />
            <RoofWall frame={frame} />
            <HeldPhone frame={frame} thumb={prog(frame, tN + 4, tX)} sent={prog(frame, tX + 2, tX + 16)} />
            <g transform={`translate(${PHOTO.x - 1000} ${PHOTO.y - 540})`}>
              <CroppedView frame={frame} reveal={prog(frame, tU + 6, tU + 24)} id="c2s7-crop" />
            </g>
          </g>
        ),
      };
    },
  },
  "stall-truth-unchanged": {
    nameAr: "الدكان: الزبونة تقرأ الخبر وتنصرف، والميزان مستوٍ؛ إطار الصورة جزء صغير من المشهد",
    place: "دكان الميزان",
    render: ({ frame, at, portrait }) => {
      // النتيجة: زبونة تقرأ في هاتفها ثم تنصرف (أثر الخبر)، والبائع يرفع كفه «انتظري» ثم يخفض رأسه؛
      // عند «غير الصحيح» يظهر إطار الصورة نفسه على موضعه (اليد والحبة)، وعند «صحيحًا» تتسع الكاميرا فيُرى الميزان مستويًا كله.
      const tQ = at("عدالة", 0.12);
      const tT = at("تجعل", 0.38);
      const tW = at("غير", 0.58);
      const tR = at("صحيحا", 0.8);
      const leaveStart = tT + 4;
      return {
        captionBackdrop: 0.3,
        cam: portrait ? [V(0, 940, 0.95, 560), V(tW - 6, CROP.x + CROP.w / 2, 1.7, CROP.y + CROP.h / 2), V(tR - 6, 1060, 1.0, 560)] : [K(0, 980, 1.35, -40), V(tW - 6, CROP.x + CROP.w / 2 - 40, 2.6, CROP.y + CROP.h / 2), V(tR - 6, 1020, 1.45, 530)],
        world: (
          <g>
            <StallSet frame={frame} vendor={tlPose(frame, [[0, POSES.stand], [tT + 10, { ...POSES.halt, armFront: { s: 70, e: 30 } }], [tW - 10, { ...POSES.stand, head: 26 }]])} />
            <ValueScale x={1020} tilt={0} left={(p) => <StandardWeight x={p.x} y={p.y} />} right={(p) => <g>{oranges(p, 5)}</g>} />
            {frame < leaveStart ? (
              <g>
                <Figure x={780} y={GROUND + 6} scale={1.45} pose={pz(frame, [[0, "hold"], [tQ + 6, "stand"]])} look={CH2_CAST.reader} holding="phone" frame={frame + 5} />
                <BuzzArcs x={830} y={GROUND - 360} p={prog(frame, 0, 18)} />
              </g>
            ) : (
              <Walker frame={frame} from={780} to={180} y={GROUND + 6} start={leaveStart} look={CH2_CAST.reader} scale={1.45} holding="phone" />
            )}
            {frame >= tW - 4 ? <rect x={CROP.x} y={CROP.y} width={CROP.w} height={CROP.h} fill="none" stroke={ID.paper} strokeWidth={5} strokeDasharray="16 10" opacity={prog(frame, tW - 4, tW + 8)} /> : null}
          </g>
        ),
      };
    },
  },

  // ——— الوحدة 4: المبدأ وتطبيقه ———
  "values-three-panels": {
    nameAr: "ثلاث لوحات: الصراحة والثقة والقضية العادلة؛ القيم صحيحة، والخلل في طريقة استعمالها لتبرير الفعل",
    place: "المقهى وصحن الدار والسطوح",
    render: ({ frame, at, portrait }) => {
      // التوجيه 021 (ازدحام البطاقات): ثلاث لوحات منفصلة لكل منها كلمتها الكبيرة تحتها، بدل بطاقات فوق ميزان.
      // «القيمة»: تضيء الكلمات الثلاث. «الطريقة»: تخبو الكلمات ويضيء الفعل في كل لوحة بالترتيب.
      // «لتبرير»: تصعد كل كلمة فتقف أمام الفعل (تغطيه) كما يُستعمل الاسم غطاءً للفعل.
      const tV = at("القيمة", 0.36);
      const tW = at("الطريقة", 0.65);
      const tJ = at("لتبرير", 0.86);
      const words = ["الصراحة", "الثقة", "قضية عادلة"];
      const L = portrait
        ? [0, 1, 2].map((i) => ({ x: 960 - 270, y: 270 + i * 280, w: 540, h: 196 }))
        : [0, 1, 2].map((i) => ({ x: 960 + (1 - i) * 600 - 270, y: 240, w: 540, h: 380 }));
      const aspect = L[0]!.w / L[0]!.h;
      const view = (cx: number, cy: number, h: number) => ({ x: cx - (h * aspect) / 2, y: cy - h / 2, w: h * aspect, h });
      const shown = (i: number) => prog(frame, 4 + i * 8, 16 + i * 8);
      const valueGlow = prog(frame, tV - 6, tV + 10) * (1 - prog(frame, tW - 6, tW + 6));
      const act = (i: number) => prog(frame, tW + i * 12, tW + 10 + i * 12);
      const cover = prog(frame, tJ - 4, tJ + 16);
      const scenes = [
        <CafeMajlis key="c" frame={frame} harsh={HARSH_POINT} young={POSES["sit-low"]} youngPaper onlookers={1} shame={1} />,
        <g key="y">
          <Courtyard frame={frame} />
          <Figure x={COURT.worker} y={GROUND + 4} scale={1.22} pose={OFFER} look={CH2_CAST.worker} frame={frame + 9} />
          <Figure x={COURT.proud} y={GROUND + 4} scale={1.22} pose={POSES.proud} look={CH2_CAST.proud} frame={frame} />
        </g>,
        <g key="r">
          <Rooftops frame={frame} mood="night" />
          {WINDOWS.slice(0, 4).map((w, i) => <rect key={i} x={w.x - 16} y={w.y - 13} width={32} height={26} fill={ID.dawn} />)}
          <Figure x={980} y={GROUND + 40} scale={1.3} pose={POSES.hold} look={hero} holding="phone" frame={frame} />
          <RoofWall frame={frame} />
        </g>,
      ];
      const views = portrait ? [view(1000, 640, 470), view(1300, 640, 470), view(980, 560, 520)] : [view(1000, 600, 560), view(1300, 600, 560), view(980, 520, 640)];
      // موضع الفعل في كل لوحة (بإحداثيات اللوحة): يد القاسي، ظهر المتكبر، الهاتف
      const actAt = (i: number) => {
        const v = views[i]!;
        const p = [{ x: 1040, y: 600 }, { x: 1430, y: 560 }, { x: 1010, y: 640 }][i]!;
        const l = L[i]!;
        return { x: l.x + ((p.x - v.x) / v.w) * l.w, y: l.y + ((p.y - v.y) / v.h) * l.h };
      };
      const size = portrait ? 42 : 54;
      return {
        captionBackdrop: 0.5,
        // دفعة خفيفة نحو اللوحات عند «الطريقة»: الانتقال من القيمة إلى الفعل
        cam: portrait ? [V(0, 960, 1.0, 560), V(tW, 960, 1.05, 560)] : [V(0, 960, 1.0, 470), V(tW, 960, 1.06, 460)],
        world: (
          <g>
            <rect x={-400} y={-400} width={2720} height={2000} fill={darken(ID.night, 0.25)} />
            {L.map((l, i) => (
              <g key={i} opacity={shown(i)}>
                <Panel id={words[i]!} x={l.x} y={l.y} w={l.w} h={l.h} view={views[i]!} dim={valueGlow * 0.6}>
                  {scenes[i]}
                </Panel>
                {act(i) > 0.01 ? <Glow cx={actAt(i).x} cy={actAt(i).y} r={portrait ? 90 : 120} color={mix(ID.seal, ID.dawn, 0.3)} opacity={0.7 * act(i) * (1 - 0.5 * cover)} /> : null}
              </g>
            ))}
            {L.map((l, i) => {
              const base = { x: l.x + l.w / 2, y: l.y + l.h + (portrait ? 40 : 64) };
              const tgt = actAt(i);
              const x = base.x + (tgt.x - base.x) * cover;
              const y = base.y + (tgt.y - base.y) * cover;
              return <WordPill key={words[i]} x={x} y={y} text={words[i]!} t={shown(i)} size={size} color={valueGlow > 0.05 ? lighten(ID.dawn, 0.15 * valueGlow) : act(i) > 0.5 && cover < 0.5 ? mix(ID.dawn, ID.paper, 0.4) : ID.dawn} />;
            })}
          </g>
        ),
      };
    },
  },
  "stall-still": {
    nameAr: "الدكان ساكنًا: تمهيد الآية (سكون مقصود)",
    place: "دكان الميزان",
    render: ({ frame, portrait }) => ({
      // لا حدث ولا حركة كاميرا ولا عنصر: ذكر الله وكلامه بسكون (القاعدة الثانية، الاستثناء)
      cam: [SC(0, portrait, false)],
      world: (
        <g>
          <StallSet frame={0} />
          <ValueScale x={1020} tilt={0} left={(p) => <StandardWeight x={p.x} y={p.y} />} right={(p) => <g>{oranges(p, 5)}</g>} />
          {void frame}
        </g>
      ),
    }),
  },
  "scale-not-moved": {
    nameAr: "الميزان لا يتحرك: لا لكرهنا (مستوٍ)، ولا لتبريرنا (اللامع يبقى خفيفًا)",
    place: "دكان الميزان",
    render: ({ frame, at, portrait }) => {
      // التوجيه 021: لا تكرار لحركة الميزان؛ المعنى هنا في ثباته. النصف الأول: الميزان مستوٍ والبطل يعرض عنه كارهًا، فلا يتغير.
      // النصف الثاني: الميزان كما انتهى في c2-s1 (اللامع مرتفع)، تُعلّق عليه بطاقة «تبرير مقنع» فلا يتغير شيء.
      const tH = at("نكرهه", 0.3);
      const half = at("والباطل", 0.42);
      const tJ = at("تبريرا", 0.78);
      const second = frame >= half - 4;
      const tag = prog(frame, tJ - 6, tJ + 10);
      return {
        captionBackdrop: 0.6,
        cam: second ? [V(0, 1020, portrait ? 1.25 : 1.8, portrait ? 560 : 500)] : [portrait ? V(0, 860, 0.85, 540) : V(0, 860, 1.3, 560), portrait ? V(tH - 6, 860, 1.0, 560) : V(tH - 6, 900, 1.5, 540)],
        world: (
          <g>
            <StallSet frame={frame} />
            {!second ? (
              <g>
                <ValueScale x={1020} tilt={0} left={(p) => <StandardWeight x={p.x} y={p.y} />} right={(p) => <g>{oranges(p, 5)}</g>} />
                <Figure x={640} y={GROUND + 6} scale={1.2} pose={pz(frame, [[0, "listen"], [tH - 6, "wave-off"], [tH + 20, "cross"]])} look={hero} frame={frame} />
              </g>
            ) : (
              <ValueScale
                x={1020}
                tilt={-12}
                left={(p) => <StandardWeight x={p.x} y={p.y} />}
                right={(p) => (
                  <g>
                    <ShinyWeight x={p.x} y={p.y} />
                    {tag > 0 ? (
                      <g>
                        <line x1={p.x} y1={p.y - 56} x2={p.x} y2={p.y - 96} stroke={INK} strokeWidth={2} opacity={tag} />
                        <WordPill x={p.x} y={p.y - 118} text="تبرير مقنع" t={tag} size={portrait ? 30 : 32} />
                      </g>
                    ) : null}
                  </g>
                )}
              />
            )}
          </g>
        ),
      };
    },
  },
  "scale-right-pan": {
    nameAr: "يد تضع الثقل الصحيح في كفته فيستوي الميزان (صحة المبدأ وصحة تطبيقه)",
    place: "دكان الميزان",
    render: ({ frame, at, portrait }) => {
      // التوجيه 021: فعل بشري بدل ميزانين. البطل يمسك الثقل المعياري (المبدأ) فيضيء عند «المبدأ»؛
      // عند «وصحة تطبيقنا» ينظر إلى الكفتين ثم يضعه في كفته (اليسرى) فيستوي الميزان مع البرتقال: حركة استواء لا ميل.
      const tP = at("المبدأ", 0.6);
      const tA = at("تطبيقنا", 0.78);
      const place = tA + 14;
      const placed = frame >= place;
      const tilt = placed ? settle(frame, place, 15, 0) : 15;
      const REACH: PoseSpec = { ...POSES.point, lean: 8, head: 8, armFront: { s: 100, e: 40 } };
      const HOLD_W: PoseSpec = { ...POSES.hold, head: 14 };
      const pose = tlPose(frame, [[0, HOLD_W], [tA - 4, { ...HOLD_W, head: -4 }], [place - 10, REACH], [place + 12, { ...POSES.stand, head: 6 }]]);
      const HX = 830;
      const hand = handAt(pose, { x: HX, y: GROUND + 6, scale: 1.25 });
      return {
        captionBackdrop: 0.6,
        cam: portrait ? [V(0, 960, 1.1, 510), V(tA - 6, 990, 1.3, 510)] : [V(0, 960, 1.55, 520), V(tA - 6, 990, 1.8, 500)],
        world: (
          <g>
            <StallSet frame={frame} vendor={POSES.stand} />
            <ValueScale x={1020} tilt={tilt} left={(p) => (placed ? <StandardWeight x={p.x} y={p.y} /> : null)} right={(p) => <g>{oranges(p, 5)}</g>} />
            <Figure x={HX} y={GROUND + 6} scale={1.25} pose={pose} look={hero} frame={frame} />
            {!placed ? (
              <g>
                <Glow cx={hand.x} cy={hand.y - 20} r={90} color={ID.dawn} opacity={0.75 * prog(frame, tP - 6, tP + 10)} />
                <StandardWeight x={hand.x + 4} y={hand.y + 22} />
              </g>
            ) : null}
          </g>
        ),
      };
    },
  },
  "scale-name-vs-act": {
    nameAr: "الميزان (ختام الوحدة): الاسم لا يحركه والفعل يحركه، ثم مشقة قبول الصواب",
    place: "دكان الميزان",
    render: ({ frame, at, portrait }) => {
      const tN = at("الاسم", 0.15);
      const tR = at("حقيقتها", 0.35);
      const tK = at("نعرف", 0.75);
      const tA = at("قبوله", 0.95);
      const name = prog(frame, tN - 4, tN + 12);
      const act = prog(frame, tR - 8, tR + 4);
      const tilt = act > 0.5 ? settle(frame, tR + 4, 0, 15) : 0;
      return {
        cam: [SC(0, portrait, true), portrait ? V(tK - 10, 860, 0.85, 540) : V(tK - 10, 860, 1.3, 560)],
        world: (
          <g>
            <StallSet frame={frame} />
            <ValueScale
              x={1020}
              tilt={tilt}
              left={(p) => <StandardWeight x={p.x} y={p.y} />}
              right={(p) => (
                <g>
                  {oranges(p, 5)}
                  {name > 0 && act < 0.5 ? <WordPill x={p.x} y={p.y - 70} text="صراحة" t={name} size={34} /> : null}
                  {act > 0 ? <g opacity={act}><ActStone x={p.x} y={p.y - 34} /></g> : null}
                </g>
              )}
            />
            <Figure x={640} y={GROUND + 6} scale={1.2} pose={pz(frame, [[0, "stand"], [tK - 6, "listen"], [tA - 10, "sincere"], [tA + 10, "turn-away"]])} look={hero} frame={frame} />
          </g>
        ),
      };
    },
  },
};
