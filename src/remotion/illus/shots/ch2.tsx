import React from "react";
import { ID, darken, lighten, mix } from "../palette";
import { Figure, POSES, blendPose, type FigureLook, type PoseSpec } from "../Figure";
import { GROUND, Glow, WordPill } from "../world";
import { Cafe, CafeTable, Chair } from "./interior";
import { Courtyard, Rooftops, RoofWall } from "./outdoor";
import { BuzzArcs } from "./phone";
import { K, prog, pz, type CamKey, type ShotCtx } from "./kit";
import { Counter, Crate, StallBack, StandardWeight } from "./scale";

/**
 * الحلقة 001 · الفصل 2 «عندما يرتدي الباطل ثوب الحق» (التوجيه 019): أربع وحدات بصرية مترابطة بدل الإخراج العام.
 * 1. الصراحة والقسوة: مجلس المقهى (c2-s3، c2-s4، وعودة c2-s14).
 * 2. الثقة والتكبر: صحن الدار (c2-s5، c2-s6، وعودة c2-s15).
 * 3. خبر يخدم قضية: الشاهد الأول من الفصل 1 ينشر أن البائع يغش، والميزان مستوٍ كما كان (c2-s7، c2-s8).
 * 4. صحة المبدأ وخطأ التطبيق: ميزان البائع نفسه؛ ثقل لامع خفيف، وثقل صحيح في الكفة الخطأ، وأسماء لا تحرك الميزان
 *    (c2-s1، c2-s2، c2-s9، c2-s12، c2-s13، c2-s16)؛ وتمهيد الآية c2-s10 سكون تام.
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

const CafeMajlis: React.FC<{ frame: number; harsh: PoseSpec; young: PoseSpec | null; youngPaper: boolean; onlookers: number; shame: number; emptySeat?: boolean }> = ({ frame, harsh, young, youngPaper, onlookers, shame, emptySeat }) => (
  <g>
    <Cafe frame={frame} />
    <Chair x={800} />
    <CafeTable x={960} frame={frame} />
    {/* الورقة (عمله) على الطاولة حين يغادر */}
    {emptySeat ? <rect x={905} y={GROUND - 206} width={46} height={10} rx={2} fill={mix(ID.paper, ID.night, 0.15)} stroke={INK} strokeWidth={1.6} transform={`rotate(-8 928 ${GROUND - 200})`} /> : null}
    {/* الشابّ جالسًا بورقته؛ ظل الإحراج يقع عليه */}
    {young ? <Figure x={820} y={GROUND} scale={1.06} pose={young} look={CH2_CAST.young} holding={youngPaper ? "paper" : "none"} frame={frame + 7} /> : null}
    {young ? <Glow cx={830} cy={GROUND - 200} r={170} color="#000" opacity={0.3 * shame} /> : null}
    {/* القاسي واقفًا فوقه */}
    <Figure x={1120} y={GROUND + 4} scale={1.22} pose={harsh} look={CH2_CAST.harsh} flip frame={frame} />
    {/* رجلان على الطاولة الخلفية يلتفتان حرجًا */}
    <Figure x={1480} y={GROUND - 20} scale={0.86} pose={blendPose(POSES.sit, POSES["sit-nod"], onlookers)} look={CH2_CAST.modest} flip={onlookers < 0.5} frame={frame + 21} />
    <Figure x={1620} y={GROUND - 20} scale={0.86} pose={blendPose(POSES.sit, POSES["sit-low"], onlookers)} look={CH2_CAST.worker} flip frame={frame + 3} />
  </g>
);

// ———————————————————— 2. صحن الدار: الثقة والتكبر ————————————————————

const Step: React.FC<{ x: number }> = ({ x }) => (
  <g>
    <rect x={x - 150} y={GROUND - 40} width={300} height={44} fill={mix(darken(ID.copper, 0.35), ID.paper, 0.1)} stroke={INK} strokeWidth={3} />
    <rect x={x - 150} y={GROUND - 40} width={300} height={8} fill={lighten(ID.copper, 0.05)} opacity={0.6} />
  </g>
);

// ———————————————————— 3. السطوح ليلًا: الخبر ينتشر ————————————————————

const WINDOWS = [
  { x: 380, y: GROUND - 520 }, { x: 560, y: GROUND - 470 }, { x: 1440, y: GROUND - 560 }, { x: 1640, y: GROUND - 500 }, { x: 260, y: GROUND - 600 }, { x: 1820, y: GROUND - 590 },
];

export const CH2_SHOTS: Record<string, Ch2Shot> = {
  // ——— الوحدة 4: المدخل ———
  "scale-shiny-weight": {
    nameAr: "الميزان: ثقل لامع جميل الشكل خفيف الوزن (ليس كل باطل يسهل رفضه)",
    place: "دكان الميزان",
    render: ({ frame, at, portrait }) => {
      const tB = at("باطل", 0.25);
      const tR = at("رفضها", 0.8);
      const on = easeIn(frame, tB - 6, tB + 14);
      const tilt = settle(frame, tB + 14, 0, -12);
      return {
        cam: [SC(0, portrait, false), SC(tR - 6, portrait, true)],
        world: (
          <g>
            <StallSet frame={frame} vendor={POSES.stand} />
            {/* الثقل اللامع على الطاولة يلفت النظر، ثم يوضع في الكفة مقابل المعياري فيرتفع: أخف مما يبدو */}
            {on < 1 ? <g opacity={1 - on}><ShinyWeight x={1160} y={VS.top} /></g> : null}
            <ValueScale x={1020} tilt={tilt} left={(p) => <StandardWeight x={p.x} y={p.y} />} right={(p) => (on > 0 ? <g opacity={on}><ShinyWeight x={p.x} y={p.y} glow={1 - 0.6 * prog(frame, tR - 10, tR + 10)} /></g> : null)} />
          </g>
        ),
      };
    },
  },
  "scale-weight-wrong-pan": {
    nameAr: "الميزان: ثقل صحيح في الكفة الخطأ (معنى صحيح في غير موضعه)",
    place: "دكان الميزان",
    render: ({ frame, at, portrait }) => {
      const tS = at("صحيح", 0.4);
      const tW = at("موضعه", 0.85);
      const moved = easeIn(frame, tW - 18, tW);
      // المعياري يُرفع من كفته إلى كفة البرتقال: الكفتان كلتاهما تثقلان من جهة واحدة فيختل الميزان
      const tilt = settle(frame, tW, 0, 15);
      return {
        cam: [SC(0, portrait, false), SC(tS, portrait, true)],
        world: (
          <g>
            <StallSet frame={frame} vendor={pz(frame, [[0, "stand"], [tW - 24, "hold"], [tW + 6, "stand"]])} />
            <Glow cx={1020 - 92} cy={VS.pivotY + 70} r={90} color={ID.dawn} opacity={0.5 * prog(frame, tS - 6, tS + 10) * (1 - moved)} />
            <ValueScale
              x={1020}
              tilt={tilt}
              left={(p) => (moved < 0.5 ? <StandardWeight x={p.x} y={p.y} /> : null)}
              right={(p) => (
                <g>
                  {oranges(p, 5)}
                  {moved >= 0.5 ? <StandardWeight x={p.x + 4} y={p.y - 30} /> : null}
                </g>
              )}
            />
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
      const tH = at("يجرح", 0.25);
      const tS = at("يقول", 0.6);
      const tF = at("صريح", 0.9);
      const harsh = tlPose(frame, [[0, POSES.talk], [tH - 6, { ...POSES.point, lean: 10, head: 14 }], [tS, POSES.stand], [tF - 6, POSES.proud]]);
      // الشاب يعرض ورقته جالسًا، فتقع الكلمة فينكمش ثم يخفض رأسه
      const young = tlPose(frame, [[0, POSES["sit-show"]], [tH + 2, POSES["sit-low"]], [tH + 26, POSES["head-down"]]]);
      return {
        captionBackdrop: 0.3,
        cam: portrait ? [V(0, 970, 1.0, 600), V(tH - 8, 960, 1.2, 640), V(tF - 10, 1100, 1.3, 600)] : [K(0, 1150, 1.2), K(tH - 8, 980, 1.6), K(tF - 10, 1060, 1.45)],
        world: <CafeMajlis frame={frame} harsh={harsh} young={young} youngPaper onlookers={prog(frame, tH + 6, tH + 26)} shame={prog(frame, tH, tH + 20)} />,
      };
    },
  },
  "cafe-harsh-cost": {
    nameAr: "المقهى: الصراحة لا تبرر القسوة (ثمن الكلمة على الشاب)",
    place: "مقهى الحارة",
    render: ({ frame, at, portrait }) => {
      const tV = at("محمودة", 0.25);
      const tC = at("القسوة", 0.6);
      const tI = at("وإهانة", 0.8);
      return {
        captionBackdrop: 0.3,
        // يبدأ من آخر c2-s3 (القاسي بوضعية الافتخار)، ثم إلى الشاب: يضع ورقته على الطاولة ويقوم
        cam: portrait ? [V(0, 1000, 1.15, 600), V(tC - 8, 860, 1.25, 640), V(tI, 960, 1.0, 600)] : [K(0, 1060, 1.45), K(tC - 8, 880, 1.7), K(tI, 1000, 1.25)],
        world: (
          <CafeMajlis
            frame={frame}
            harsh={tlPose(frame, [[0, POSES.proud], [tV, POSES.stand]])}
            young={frame < tI + 10 ? POSES["head-down"] : POSES["sit-low"]}
            youngPaper={frame < tI}
            onlookers={1}
            shame={1 - 0.3 * prog(frame, tI, tI + 30)}
            emptySeat={frame >= tI}
          />
        ),
      };
    },
  },
  "cafe-harsh-alone": {
    nameAr: "المقهى (عودة): وحده أمام المقعد الفارغ وورقة الشاب",
    place: "مقهى الحارة",
    render: ({ frame, at, portrait }) => {
      const tB = at("لكن", 0.45);
      return {
        captionBackdrop: 0.3,
        cam: portrait ? [V(0, 1000, 1.0, 600), V(tB, 960, 1.3, 620)] : [K(0, 1040, 1.25), K(tB, 980, 1.7)],
        world: (
          <g>
            <CafeMajlis frame={frame} harsh={tlPose(frame, [[0, POSES.stand], [tB, { ...POSES.think, head: 22 }]])} young={null} youngPaper={false} onlookers={0} shame={0} emptySeat />
            <Glow cx={928} cy={GROUND - 210} r={110} color={ID.dawn} opacity={0.45 * prog(frame, tB - 6, tB + 14)} />
          </g>
        ),
      };
    },
  },

  // ——— الوحدة 2: صحن الدار ———
  "courtyard-pride": {
    nameAr: "صحن الدار: يتكبر على العامل ويقول: أعرف قيمة نفسي",
    place: "صحن دار بنافورة",
    render: ({ frame, at, portrait }) => {
      const tP = at("يتكبر", 0.25);
      const tS = at("يقول", 0.6);
      const offer = prog(frame, tP - 12, tP);
      const turned = frame >= tP + 6;
      return {
        cam: portrait ? [K(0, 1240, 1.0, 80), K(tS, 1380, 1.25, 60)] : [K(0, 1220, 1.3, 80), K(tS, 1320, 1.6, 60)],
        world: (
          <g>
            <Courtyard frame={frame} />
            <Step x={1420} />
            <Figure x={1420} y={GROUND - 36} scale={1.3} pose={pz(frame, [[0, "stand"], [tP + 4, "look-up"], [tS, "proud"]])} look={CH2_CAST.proud} flip={!turned} frame={frame} />
            <Figure x={1160} y={GROUND + 4} scale={1.2} pose={blendPose(POSES.stand, { ...POSES.talk, lean: 8 }, offer * (1 - prog(frame, tP + 20, tP + 34)))} look={CH2_CAST.worker} frame={frame + 9} />
          </g>
        ),
      };
    },
  },
  "courtyard-confident-greets": {
    nameAr: "صحن الدار: الواثق يصافح العامل (معرفة القدر لا تعني الاحتقار)",
    place: "صحن دار بنافورة",
    render: ({ frame, at, portrait }) => {
      const tK = at("قدر", 0.3);
      const tC = at("احتقار", 0.8);
      const walk = prog(frame, 0, tK, (t) => t);
      const shake = prog(frame, tK, tK + 14);
      return {
        cam: portrait ? [K(0, 1060, 1.0, 80), K(tK, 1020, 1.25, 70), K(tC, 1180, 0.85, 80)] : [K(0, 1100, 1.3, 80), K(tK, 1060, 1.5, 70), K(tC, 1180, 1.15, 80)],
        world: (
          <g>
            <Courtyard frame={frame} />
            <Step x={1420} />
            <Figure x={1420} y={GROUND - 36} scale={1.3} pose={POSES.proud} look={CH2_CAST.proud} frame={frame} />
            <Figure x={1160} y={GROUND + 4} scale={1.2} pose={blendPose(POSES.stand, { ...POSES.talk, lean: 4 }, shake)} look={CH2_CAST.worker} flip frame={frame + 9} />
            <Figure x={760 + 280 * walk} y={GROUND + 4} scale={1.24} pose={shake > 0 ? blendPose(POSES.stand, { ...POSES.talk, lean: 6, head: 6 }, shake) : POSES.stand} look={CH2_CAST.modest} frame={frame} />
            <Glow cx={1100} cy={GROUND - 250} r={200} color={ID.dawn} opacity={0.4 * shake} />
          </g>
        ),
      };
    },
  },
  "courtyard-proud-alone": {
    nameAr: "صحن الدار (عودة): المتكبر وحده على الدرجة، والناس عند النافورة",
    place: "صحن دار بنافورة",
    render: ({ frame, at, portrait }) => {
      const tB = at("لكن", 0.5);
      return {
        cam: portrait ? [K(0, 1180, 0.85, 80), K(tB, 1420, 1.3, 60)] : [K(0, 1180, 1.15, 80), K(tB, 1340, 1.5, 60)],
        world: (
          <g>
            <Courtyard frame={frame} />
            <Step x={1420} />
            <Figure x={840} y={GROUND + 4} scale={1.2} pose={POSES["sit-nod"]} look={CH2_CAST.worker} flip frame={frame + 9} />
            <Figure x={1040} y={GROUND + 4} scale={1.24} pose={POSES.talk} look={CH2_CAST.modest} flip frame={frame} />
            <Glow cx={940} cy={GROUND - 250} r={260} color={ID.dawn} opacity={0.45} />
            <Figure x={1420} y={GROUND - 36} scale={1.3} pose={tlPose(frame, [[0, POSES.proud], [tB, { ...POSES.stand, head: 24 }]])} look={CH2_CAST.proud} flip={false} frame={frame} />
            <rect x={1250} y={-200} width={500} height={1300} fill="#000" opacity={0.18 * prog(frame, tB, tB + 20)} />
          </g>
        ),
      };
    },
  },

  // ——— الوحدة 3: الخبر ———
  "roof-news-spreads": {
    nameAr: "السطوح: الشاهد الأول ينشر أن البائع يغش، والخبر ينتشر نافذة نافذة",
    place: "أسطح المدينة",
    render: ({ frame, at, portrait }) => {
      const tN = at("ينشر", 0.15);
      const tV = at("يتحقق", 0.35);
      const tJ = at("عادلة", 0.9);
      const sent = frame >= tV;
      return {
        captionBackdrop: 0.3,
        cam: portrait ? [K(0, 980, 1.35, -90), K(tV + 4, 980, 1.05, -60)] : [K(0, 980, 1.7, -90), K(tV + 4, 980, 1.25, -60)],
        world: (
          <g>
            <Rooftops frame={frame} mood="night" />
            {WINDOWS.map((w, i) => {
              const on = prog(frame, tV + 8 + i * 6, tV + 18 + i * 6);
              return (
                <g key={i}>
                  <Glow cx={w.x} cy={w.y} r={80} color={ID.dawn} opacity={0.6 * on} />
                  <rect x={w.x - 9} y={w.y - 12} width={18} height={24} fill={ID.dawn} opacity={0.3 + 0.7 * on} />
                  <BuzzArcs x={w.x} y={w.y - 30} p={prog(frame, tV + 8 + i * 6, tV + 30 + i * 6)} />
                </g>
              );
            })}
            <Glow cx={1010} cy={GROUND - 260} r={160} color={ID.dawn} opacity={0.5 * prog(frame, tN - 6, tN + 10)} />
            <BuzzArcs x={1030} y={GROUND - 300} p={prog(frame, tV - 2, tV + 18)} />
            <Figure x={980} y={GROUND + 40} scale={1.3} pose={pz(frame, [[0, "hold"], [tJ - 8, "sincere"]])} look={hero} holding={sent && frame >= tJ - 8 ? "none" : "phone"} frame={frame} rim={0.4} rimColor={ID.paper} />
            <RoofWall frame={frame} />
          </g>
        ),
      };
    },
  },
  "stall-truth-unchanged": {
    nameAr: "الدكان: الميزان مستوٍ كما كان، وزبونة تقرأ الخبر فتنصرف",
    place: "دكان الميزان",
    render: ({ frame, at, portrait }) => {
      const tJ = at("عدالة", 0.25);
      const tT = at("صحيحا", 0.85);
      const leave = prog(frame, tJ + 6, tT, (t) => t);
      return {
        cam: [SC(0, portrait, false, portrait ? 980 : 960), SC(tT - 10, portrait, true)],
        world: (
          <g>
            <StallSet frame={frame} vendor={pz(frame, [[0, "stand"], [tJ + 10, "head-down"]])} />
            <Glow cx={1020} cy={VS.pivotY + 60} r={220} color={ID.dawn} opacity={0.6 * prog(frame, tT - 10, tT + 10)} />
            <ValueScale x={1020} tilt={0} left={(p) => <StandardWeight x={p.x} y={p.y} />} right={(p) => <g>{oranges(p, 5)}</g>} />
            <Figure x={760 - 320 * leave} y={GROUND + 6} scale={1.16} pose={pz(frame, [[0, "hold"], [tJ + 6, "stand"]])} look={CH2_CAST.reader} holding="phone" flip={frame >= tJ + 6} frame={frame + 5} />
          </g>
        ),
      };
    },
  },

  // ——— الوحدة 4: المبدأ وتطبيقه ———
  "scale-values-misused": {
    nameAr: "الميزان: القيم الثلاث صحيحة، والخلل في طريقة استعمالها",
    place: "دكان الميزان",
    render: ({ frame, at, portrait }) => {
      const tV = at("القيمة", 0.35);
      const tW = at("الطريقة", 0.65);
      const words = ["الصراحة", "الثقة", "قضية عادلة"];
      const slide = prog(frame, tW, tW + 24);
      const tilt = settle(frame, tW + 24, 0, 14);
      return {
        cam: [SC(0, portrait, false), SC(tW + 12, portrait, true)],
        world: (
          <g>
            <StallSet frame={frame} vendor={POSES.stand} />
            <ValueScale x={1020} tilt={tilt} left={(p) => <StandardWeight x={p.x} y={p.y} />} right={(p) => <g>{oranges(p, 5)}</g>} />
            {words.map((w, i) => {
              const t = prog(frame, tV - 10 + i * 8, tV + 4 + i * 8);
              const x0 = portrait ? 1020 : 760 + i * 260;
              const y0 = portrait ? GROUND - 500 - i * 80 : GROUND - 520;
              const x1 = 1020 + 92 + (i - 1) * 30;
              const y1 = VS.pivotY + 50 - i * 38;
              return <WordPill key={w} x={x0 + (x1 - x0) * slide} y={y0 + (y1 - y0) * slide} text={w} t={t} size={(portrait ? 40 : 44) * (1 - 0.3 * slide)} color={slide > 0.5 ? mix(ID.dawn, ID.seal, 0.4) : ID.dawn} />;
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
    nameAr: "الميزان: لا يتحرك لكرهنا، ولا للثقل اللامع وإن زُيّن",
    place: "دكان الميزان",
    render: ({ frame, at, portrait }) => {
      const tH = at("نكرهه", 0.35);
      const tJ = at("تبريرا", 0.85);
      const half = at("والباطل", 0.5);
      const second = frame >= half - 8;
      const ribbon = prog(frame, tJ - 10, tJ + 6);
      return {
        cam: [portrait ? V(0, 860, 0.85, 540) : V(0, 860, 1.3, 560), SC(half - 8, portrait, true)],
        world: (
          <g>
            <StallSet frame={frame} />
            <ValueScale
              x={1020}
              tilt={second ? -12 : 0}
              left={(p) => <StandardWeight x={p.x} y={p.y} />}
              right={(p) =>
                second ? (
                  <g>
                    <ShinyWeight x={p.x} y={p.y} />
                    {ribbon > 0 ? <WordPill x={p.x} y={p.y - 80} text="تبرير" t={ribbon} size={34} /> : null}
                  </g>
                ) : (
                  <g>{oranges(p, 5)}</g>
                )
              }
            />
            {/* البطل يعرض عن الميزان المستوي كارهًا ما يقوله؛ والميزان لا يتغير */}
            {!second ? <Figure x={640} y={GROUND + 6} scale={1.2} pose={pz(frame, [[0, "stand"], [tH - 6, "wave-off"], [tH + 20, "cross"]])} look={hero} frame={frame} /> : null}
          </g>
        ),
      };
    },
  },
  "scale-principle-application": {
    nameAr: "ميزانان: المبدأ صحيح في موضعه، والمبدأ نفسه في غير موضعه",
    place: "دكان الميزان",
    render: ({ frame, at, portrait }) => {
      const tP = at("المبدأ", 0.6);
      const tA = at("تطبيقنا", 0.85);
      const misuse = settle(frame, tA, 0, 15);
      const g1 = prog(frame, tP - 6, tP + 10);
      const g2 = prog(frame, tA - 6, tA + 10);
      return {
        cam: portrait ? [V(0, 720, 1.1, 560), V(tA - 6, 1210, 1.1, 560)] : [V(0, 965, 1.3, 560), V(tA - 6, 1210, 1.8, 520)],
        world: (
          <g>
            <StallBack frame={frame} />
            <Counter x0={480} x1={1460} />
            <Glow cx={720} cy={VS.pivotY + 60} r={180} color={ID.dawn} opacity={0.5 * g1} />
            <ValueScale x={720} tilt={0} left={(p) => <StandardWeight x={p.x} y={p.y} />} right={(p) => <g>{oranges(p, 5)}</g>} />
            <g opacity={0.35 + 0.65 * g1}>
              <ValueScale x={1210} tilt={misuse} left={() => null} right={(p) => <g>{oranges(p, 5)}{<StandardWeight x={p.x + 4} y={p.y - 30} />}</g>} />
            </g>
            <Glow cx={1210} cy={VS.pivotY + 60} r={180} color={mix(ID.seal, ID.dawn, 0.4)} opacity={0.45 * g2} />
          </g>
        ),
      };
    },
  },
  "scale-name-vs-act": {
    nameAr: "الميزان: الاسم لا يحركه والفعل يحركه، ثم مشقة قبول الصواب",
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
            {/* البطل يرى الميزان مائلًا: يعرف، ثم يتردد في القبول (يده إلى صدره ويعرض قليلًا) */}
            <Figure x={640} y={GROUND + 6} scale={1.2} pose={pz(frame, [[0, "stand"], [tK - 6, "listen"], [tA - 10, "sincere"], [tA + 10, "turn-away"]])} look={hero} frame={frame} />
          </g>
        ),
      };
    },
  },
};
