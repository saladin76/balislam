import React from "react";
import { ID, darken, mix } from "../palette";
import { Figure, LOOKS, POSES, blendPose, handAt, walkPose, type FigureLook, type PoseName, type PoseSpec } from "../Figure";
import { GROUND, Glow, useSvgId } from "../world";
import { LightPool } from "../texture";
import { SouqStreet, FruitCart } from "./street";
import { HomeRoom, Cafe, CafeTable, Chair, Workshop, TintedLattice, NightWindow, PhotoFrame, LATTICE } from "./interior";
import { Courtyard, Rooftops, RoofWall } from "./outdoor";
import { Birds, K, Rolling, Turn, Walker, prog, pz, turnSx, type CamKey, type ShotCtx } from "./kit";
import { BuzzArcs, PhonePOV } from "./phone";
import { CH2_SHOTS } from "./ch2";
import { CH3_SHOTS } from "./ch3";
import { DONE_BEATS, SCALE_TAG_SIZE, ScaleIncident, scaleAngleAt, scaleEventBeats, scaleEventCast, scaleSincereBeats, scaleSincereCast, scaleSincereEvidence, scaleVerdictBeats, scaleVerdictCast } from "./scale";

/**
 * اللقطات المصمَّمة: كل لقطة تحكي جملتها بمكانها وشخوصها وكاميرتها، وأحداثها تقع لحظة نطق كلماتها.
 * تُختار في الخطة بحقل shot في قالب «حكايات الحارة»، وتظهر في مكتبة الاستوديو.
 * الفصل الأول من الحلقة 001 قصة واحدة متصلة: حادثة في السوق يحكم عليها شاهدان بحكمين،
 * ثم البطل نفسه في يومه: ما يؤثر فيه، وخبر يصدقه، ونصيحة يرفضها، وقرار يدافع عنه، حتى فجر يراجع فيه نفسه.
 */
/** overlay: طبقة بإحداثيات الشاشة فوق المشهد (لقطة «بعين البطل») */
/** captionSize: حجم السطر المكتوب إن احتاجت اللقطة نصًا أكبر ليُقرأ على الهاتف (الأمر 015)؛ بلا الحقل الحجم القائم */
/** captionBackdrop (0..1، الأمر 019): تقوية خلفية الكابشن للقطة فاتحة الخلفية (تدرّج أعمق وكلمات قادمة أوضح)؛ بلا الحقل كما هو */
export type Shot = { cam: CamKey[]; world: React.ReactNode; tint?: string; tintOpacity?: number; overlay?: React.ReactNode; captionSize?: number; captionBackdrop?: number };
export type ShotDef = { nameAr: string; place: string; render: (c: ShotCtx) => Shot };

const hero = LOOKS.hero;
/** تأطير مشهد جلوس: مركز الإطار عند الصدر والطاولة، فلا يضيع الجالس أسفل إطار نصفه جدار */
const S = (t: number, x: number, z: number): CamKey => ({ t, x, y: 672, z });
const RED = ID.seal;
const GOLD = ID.dawn;

/**
 * حادثة السوق (حدث واحد لا يتغير): البائع منشغل بترتيب بضاعته وظهره للعربة، فيمد الفتى يده ويأخذ برتقالة،
 * ثم يلتفت البائع فيوقفه وتتساقط حبات من العربة. take وgrab لحظتا الأخذ والإيقاف (بالإطارات).
 */
const STOLEN_FROM = { x: 846, y: GROUND - 168 };
const IN_HAND = { x: 792, y: GROUND - 150 };
const vendorGesture = (grab: number): [number, PoseName][] => {
  const tl: [number, PoseName][] = [[-1e4, "hold"], [grab - 2, "halt"]];
  for (let k = 1; k < 40; k++) tl.push([grab + 26 * k, k % 2 ? "point" : "halt"]);
  return tl;
};
const Incident: React.FC<{ frame: number; take: number; grab: number; fallAt?: number }> = ({ frame, take, grab, fallAt }) => {
  const reach = prog(frame, take, take + 14);
  const pulled = prog(frame, grab, grab + 10);
  const ox = STOLEN_FROM.x + (IN_HAND.x - STOLEN_FROM.x) * reach - 50 * pulled;
  const oy = STOLEN_FROM.y + (IN_HAND.y - STOLEN_FROM.y) * reach;
  const vx = 1140 - 70 * prog(frame, grab - 6, grab + 14);
  return (
    <g>
      <FruitCart x={820} taken missing={fallAt !== undefined && frame > fallAt ? 4 : 0} />
      <Turn x={vx} sx={turnSx(frame, grab - 8, 1, -1, 8)}>
        <Figure x={vx} y={GROUND + 4} scale={1.15} pose={pz(frame, vendorGesture(grab))} look={LOOKS.vendor} frame={frame} />
      </Turn>
      <Figure x={760} y={GROUND + 4} scale={0.82} pose={pz(frame, [[-1e4, "stand"], [take - 12, "point"], [take + 12, "hold"], [grab, "flinch"]])} look={LOOKS.boy} holding="none" frame={frame + 7} />
      <circle cx={ox} cy={oy} r={13} fill={mix(GOLD, RED, 0.3)} stroke="#1a1208" strokeWidth={2} />
      {fallAt !== undefined ? <Rolling frame={frame} at={fallAt} x={900} y={GROUND - 200} ground={GROUND + 20} color={mix(GOLD, RED, 0.3)} dir={-1} /> : null}
    </g>
  );
};
/** الحادثة بعد انتهائها (للقطات التالية في السوق) */
const AFTER = { take: -400, grab: -360 };

/**
 * «الصورة التي خرج بها كل شاهد»: دائرة فوق رأسه فيها ما رآه هو وحده من الحادثة نفسها.
 * الحدث داخلها هو الحدث نفسه مجمَّدًا عند لحظة رآها، لا حدث آخر.
 */
const Memory: React.FC<{ frame: number; cx: number; cy: number; head: { x: number; y: number }; show: number; seenAt: number; ev: { take: number; grab: number }; tint?: string; tintAmt?: number }> = ({ frame, cx, cy, head, show, seenAt, ev, tint = RED, tintAmt = 0 }) => {
  const id = useSvgId("mem");
  if (show <= 0.001) return null;
  const r = 120;
  const s = 0.2 + 0.8 * show;
  const zoom = 0.5 * (1 + 0.05 * prog(frame, 0, 400, (t) => t));
  const ring = mix(ID.copper, tint, tintAmt);
  const ex = cx + (head.x < cx ? -r * 0.75 : r * 0.75);
  const ey = cy + r * 0.6;
  const dots = [0.25, 0.55].map((k) => ({ x: head.x + (ex - head.x) * k, y: head.y + (ey - head.y) * k, r: 7 + 7 * k }));
  return (
    <g opacity={Math.min(1, show * 1.4)}>
      {dots.map((d, i) => (show > 0.2 + i * 0.2 ? <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={ID.paper} stroke={ring} strokeWidth={3} /> : null))}
      <g transform={`translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`}>
        <defs>
          <clipPath id={id}>
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
        </defs>
        <circle cx={cx} cy={cy} r={r + 8} fill={darken(ID.night, 0.2)} opacity={0.35} />
        <g clipPath={`url(#${id})`}>
          <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} fill={mix(ID.paper, ID.copper, 0.25)} />
          <g transform={`translate(${cx} ${cy + 20}) scale(${zoom}) translate(-925 ${-(GROUND - 175)})`}>
            <rect x={400} y={GROUND} width={1200} height={300} fill={mix(ID.copper, ID.night, 0.35)} />
            <Incident frame={seenAt} take={ev.take} grab={ev.grab} />
          </g>
          <circle cx={cx} cy={cy} r={r} fill={tint} opacity={0.28 * tintAmt} />
        </g>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={ring} strokeWidth={7} />
      </g>
    </g>
  );
};

/** موضع الحادثة وموضعا الشاهدين في لقطتَي «الشاهدان» و«الحكمان» (ثابتة بينهما) */
const HERO_X = 340;
const WOMAN_X = 1560;
const MEM_Y = GROUND - 450;
/** الحادثة كما تُرسم داخل صورتَي الشاهدين (ثابتة بين اللقطتين) */
const MEM_EV = { take: 100, grab: 140 };
const souqEvent = (at: ShotCtx["at"]) => {
  const t2 = at("الموقف", 0.3);
  const take = t2 - 4;
  const grab = Math.max(at("نفسه", 0.42) + 4, take + 30);
  return { take, grab };
};

export const SHOTS: Record<string, ShotDef> = {
  "souq-scale-event": {
    nameAr: "ميزان البائع (1): واقعة واحدة بثلاث زوايا متصلة زمنيًا",
    place: "سوق الحارة",
    render: ({ frame, at, portrait }) => {
      // الحلقة 001 · c1-s1: الواقعة أولًا. الزاويتان قطعان في لحظة الرفع نفسها (لا إعادة)، ثم عودة إلى الرئيسية
      const e = scaleEventBeats(at);
      const { b } = e;
      const angle = scaleAngleAt(frame, b);
      const C = (t: number, x: number, z: number, y: number, cut = false): CamKey => ({ t, x, y, z, ...(cut ? { cut } : {}) });
      // الأمر 017: العمودي محسوب لا مقصوص من الأفقي. العامة بأقرب تقريب يتسع للشاهدين كاملين (0.59)؛
      // زاوية الثانية تتسع للكفتين والصندوق واليد حتى تستقر الحبة؛ ثم تقترب في آخر المشهد من الشاهد الأول
      // بتأطير أول c1-s2 نفسه (مع تعويض الانجراف) فلا يقفز القطع بين المشهدين.
      const cam = portrait
        ? [C(0, 1021, 0.59, 310), C(b.add - 12, 1105, 1.25, 520), C(b.lift - 10, 1110, 1.2, 390, true), C(b.lift + 28, 1118, 1.2, 470, true), C(e.back, 1021, 0.59, 310, true), C(e.diverge + 22, 700, 1.05 / 1.045, 390)]
        : [C(0, 1040, 1.0, 470), C(b.add - 12, 1128, 1.86, 450), C(b.lift - 10, 1080, 1.6, 360, true), C(b.lift + 28, 1100, 2.0, 440, true), C(e.back, 1040, 1.0, 470, true)];
      return {
        cam,
        world: <ScaleIncident frame={frame} b={b} portrait={portrait} angle={angle} cast={scaleEventCast(frame, e)} verdicts={{ first: "ظلمًا", second: "عدلًا" }} size={portrait ? 64 : 66} />,
      };
    },
  },
  "souq-scale-verdicts": {
    nameAr: "ميزان البائع (2): تفسير كل شاهد للواقعة نفسها، ثم لقطة تجمعهما",
    place: "سوق الحارة",
    render: ({ frame, at, portrait }) => {
      // الحلقة 001 · c1-s2: الميزان مستوٍ والحبة في الصندوق (حالة آخر c1-s1)؛ الشاهد الأول، ثم الثانية، ثم الرابطة
      const v = scaleVerdictBeats(at);
      const C = (t: number, x: number, z: number, y: number): CamKey => ({ t, x, y, z });
      const cam = portrait
        ? [C(0, 700, 1.05, 390), C(v.second, 1330, 1.05, 390), C(v.link, 1023, 0.533, 330)]
        : [C(0, 700, 1.3, 375), C(v.second, 1610, 1.3, 375), C(v.link, 1040, 1.25, 370)];
      return {
        cam,
        // البطاقة فوق رأس صاحبها مباشرة (الأمر 017)، فاللقطة الرابطة العمودية تتسع لها بين حافتي الإطار: حجمها 58
        world: <ScaleIncident frame={frame} b={DONE_BEATS} portrait={portrait} angle="main" cast={scaleVerdictCast(frame, v)} verdicts={{ first: "ظلمًا", second: "عدلًا" }} size={SCALE_TAG_SIZE(portrait)} />,
      };
    },
  },
  "souq-scale-sincere": {
    nameAr: "ميزان البائع (3): كلاهما صادق، والدليل هو الميزان لا الشعور",
    place: "سوق الحارة",
    render: ({ frame, at, portrait }) => {
      // الحلقة 001 · c1-s3 (الأمر 018): يبدأ بتأطير آخر c1-s2 نفسه، ثم إلى الميزان عند «لإثبات»
      const s = scaleSincereBeats(at);
      const C = (t: number, x: number, z: number, y: number): CamKey => ({ t, x, y, z });
      // التوجيه 019: لا اقتراب يُخرج الشاهدين؛ اللقطة كلها بتأطير آخر c1-s2 (الشاهدان والميزان معًا)،
      // والدليل ضوء يشتد على الميزان بينهما، فتبقى المقابلة بين صدقهما وصحة الحكم في إطار واحد
      const cam = portrait ? [C(0, 1023, 0.533, 330)] : [C(0, 1040, 1.25, 370)];
      return {
        cam,
        captionBackdrop: 0.6,
        world: <ScaleIncident frame={frame} b={DONE_BEATS} portrait={portrait} angle="main" cast={scaleSincereCast(frame, s)} verdicts={{ first: "ظلمًا", second: "عدلًا" }} size={SCALE_TAG_SIZE(portrait)} evidence={scaleSincereEvidence(frame, s)} />,
      };
    },
  },
  "souq-scale-witnesses": {
    nameAr: "ميزان البائع (مختبر الأمر 015): الواقعة والتفسيران في لقطة واحدة",
    place: "سوق الحارة",
    render: ({ frame, at, portrait }) => {
      // مختبر 900 بنص الاختبار: الواقعة من scaleEventBeats بكلمات المختبر، ثم التفسيران
      const e = scaleEventBeats((w, f) => at(w === "شخصان" ? "شاهدان" : w === "الموقف" ? "البرتقال" : w === "ثم" ? "يعيد" : w === "بحكمين" ? "الموقف" : w, f));
      const v = scaleVerdictBeats(at);
      const angle = scaleAngleAt(frame, e.b);
      const C = (t: number, x: number, z: number, y: number, cut = false): CamKey => ({ t, x, y, z, ...(cut ? { cut } : {}) });
      const cam = portrait
        ? [C(0, 1010, 0.6, 310), C(e.b.add - 12, 1150, 1.35, 520), C(e.b.lift - 10, 1070, 0.95, 430, true), C(e.b.lift + 28, 1060, 1.5, 520, true), C(e.back, 1010, 0.6, 310, true), C(v.firstSay - 14, 700, 1.05, 400), C(v.second, 1330, 1.05, 400), C(v.link, 1025, 0.6, 330)]
        : [C(0, 1040, 1.0, 470), C(e.b.add - 12, 1170, 1.75, 528), C(e.b.lift - 10, 1000, 1.3, 360, true), C(e.b.lift + 28, 1080, 1.7, 520, true), C(e.back, 1040, 1.0, 470, true), C(v.firstSay - 14, 720, 1.3, 375), C(v.second, 1380, 1.3, 375), C(v.link, 1040, 1.25, 390)];
      const ev = scaleEventCast(frame, e);
      const vc = scaleVerdictCast(frame, v);
      const cast = frame < v.firstSay - 14 ? ev : vc;
      return { cam, world: <ScaleIncident frame={frame} b={e.b} portrait={portrait} angle={angle} cast={cast} verdicts={{ first: "ظلمًا", second: "عدلًا" }} size={portrait ? 64 : 66} /> };
    },
  },
  "souq-two-witnesses": {
    nameAr: "السوق: شاهدان على حادثة واحدة، وكلٌّ رأى جزءًا منها",
    place: "سوق الحارة",
    render: ({ frame, at }) => {
      const t1 = at("شخصان", 0.15);
      const { take, grab } = souqEvent(at);
      const t3 = at("يخرجان", 0.55);
      const t4 = at("مختلفين", 0.8);
      const apart = prog(frame, t3, t3 + 40);
      const hx = HERO_X - 40 * apart;
      const wx = WOMAN_X + 40 * apart;
      const spot = prog(frame, t1, t1 + 12) * (1 - 0.6 * prog(frame, t1 + 30, t1 + 60));
      return {
        cam: [K(0, 960, 1.12), K(t1, 960, 1.14), K(grab - 4, 920, 1.24), K(t3, 960, 1.12), K(t4, 960, 1.15)],
        world: (
          <g>
            <SouqStreet frame={frame} />
            <LightPool cx={HERO_X} cy={GROUND + 10} rx={170} ry={40} color={GOLD} opacity={0.7 * spot} />
            <LightPool cx={WOMAN_X} cy={GROUND + 10} rx={170} ry={40} color={GOLD} opacity={0.7 * spot} />
            <Incident frame={frame} take={take} grab={grab} fallAt={grab + 2} />
            {/* الأول منشغل بالدكان المجاور وقت الأخذ، ولا يلتفت إلا على صوت البائع */}
            <Turn x={hx} sx={turnSx(frame, grab + 2, -1, 1, 10)}>
              <Figure x={hx} y={GROUND + 6} scale={1.2} pose={pz(frame, [[0, "hold"], [grab + 2, "flinch"], [grab + 22, "think"], [t3, "cross"], [t4, "think"]])} look={hero} frame={frame} />
            </Turn>
            {/* الثانية تنظر إلى العربة من البداية فترى الأخذ نفسه */}
            <Figure x={wx} y={GROUND + 6} scale={1.18} pose={pz(frame, [[0, "stand"], [t1 + 6, "listen"], [take + 8, "point"], [grab + 12, "nod"], [t3, "cross"], [t4, "nod"]])} look={LOOKS.woman} flip frame={frame + 11} />
            <Memory frame={frame} cx={hx + 175} cy={MEM_Y} head={{ x: hx + 30, y: GROUND - 390 }} show={prog(frame, t3, t3 + 18)} seenAt={MEM_EV.grab + 18} ev={MEM_EV} />
            <Memory frame={frame} cx={wx - 175} cy={MEM_Y} head={{ x: wx - 30, y: GROUND - 390 }} show={prog(frame, t3 + 8, t3 + 26)} seenAt={MEM_EV.take + 8} ev={MEM_EV} />
          </g>
        ),
        tintOpacity: 0,
      };
    },
  },
  "souq-two-verdicts": {
    nameAr: "السوق: كل شاهد يحكم بالصورة التي رآها",
    place: "سوق الحارة",
    render: ({ frame, at }) => {
      const tR = at("ظلما", 0.35);
      const t2 = at("والثاني", 0.55);
      const tG = at("عدلا", 0.8);
      const red = prog(frame, tR, tR + 16);
      const gold = prog(frame, tG, tG + 16);
      const hx = HERO_X - 40;
      const wx = WOMAN_X + 40;
      return {
        cam: [K(0, 560, 1.4, -40), K(tR - 6, 600, 1.46, -40), K(t2, 1380, 1.4, -40), K(tG + 4, 1360, 1.46, -40), K(tG + 34, 960, 1.12)],
        world: (
          <g>
            <SouqStreet frame={frame} />
            <Incident frame={frame} {...AFTER} fallAt={AFTER.grab + 2} />
            <LightPool cx={hx} cy={GROUND - 160} rx={420} ry={360} color={RED} opacity={0.5 * red} />
            <LightPool cx={wx} cy={GROUND - 160} rx={420} ry={360} color={GOLD} opacity={0.55 * gold} />
            <Figure x={hx} y={GROUND + 6} scale={1.2} pose={pz(frame, [[0, "think"], [tR, "point"], [tR + 50, "cross"]])} look={hero} frame={frame} rim={red} rimColor={RED} />
            <Figure x={wx} y={GROUND + 6} scale={1.18} pose={pz(frame, [[0, "cross"], [tG, "nod"], [tG + 24, "talk"]])} look={LOOKS.woman} flip frame={frame + 11} rim={gold} />
            <Memory frame={frame} cx={hx + 175} cy={MEM_Y} head={{ x: hx + 30, y: GROUND - 390 }} show={1} seenAt={MEM_EV.grab + 18} ev={MEM_EV} tint={RED} tintAmt={red} />
            <Memory frame={frame} cx={wx - 175} cy={MEM_Y} head={{ x: wx - 30, y: GROUND - 390 }} show={1} seenAt={MEM_EV.take + 8} ev={MEM_EV} tint={GOLD} tintAmt={gold} />
          </g>
        ),
      };
    },
  },
  "souq-both-sincere": {
    nameAr: "السوق: كلاهما صادق، والصدق لا يكفي",
    place: "سوق الحارة",
    render: ({ frame, dur, at }) => {
      const tS = at("صادقا", 0.25);
      const tW = at("وصف", 0.4);
      const tB = at("لكن", 0.55);
      const tN = at("يكفي", 0.68);
      const tP = at("لإثبات", 0.85);
      return {
        cam: [
          K(0, 960, 1.21),
          K(tS, 960, 1.44),
          K(tB, 980, 1.78),
          K(tP, 900, 1.55),
        ],
        world: (
          <g>
            <SouqStreet frame={frame} />
            <FruitCart x={760} missing={4} />
            <Rolling frame={frame} at={-200} x={840} y={GROUND - 200} ground={GROUND + 20} color={mix(GOLD, RED, 0.3)} dir={-1} />
            <Figure x={640} y={GROUND + 6} scale={1.2} pose={pz(frame, [[0, "talk"], [tS, "sincere"], [tW, "talk"], [tB, "stand"]])} look={hero} frame={frame} />
            <Figure x={1300} y={GROUND + 6} scale={1.18} pose={pz(frame, [[0, "stand"], [10, "talk"], [tS + 4, "sincere"], [tW + 10, "point"], [tB, "stand"]])} look={LOOKS.woman} flip frame={frame + 11} />
            <Figure x={1010} y={GROUND + 6} scale={1.22} pose={pz(frame, [[0, "listen"], [tB, "halt"], [tN + 20, "think"]])} look={LOOKS.elder} flip={frame < tP} frame={frame + 5} />
            <Glow cx={850} cy={GROUND - 60} r={220} opacity={0.6 * prog(frame, tP, tP + 20)} />
          </g>
        ),
      };
    },
  },
  "lattice-tinted-eye": {
    nameAr: "نافذة بزجاج ملوّن: لا ننظر بعين محايدة",
    place: "مشربية تطل على السوق",
    render: ({ frame, at, portrait }) => {
      const tL = at("ينظر", 0.35);
      const tE = at("الأحداث", 0.6);
      const tN = at("محايدة", 0.85);
      const toRed = prog(frame, tL, tL + 18);
      const toGold = prog(frame, tE, tE + 18);
      const tint = toGold > 0 ? mix(RED, GOLD, toGold) : mix(ID.paper, RED, toRed);
      const amount = 0.25 + 0.6 * Math.max(toRed, toGold) + 0.15 * prog(frame, tN, tN + 20);
      const outside = (
        <g transform="translate(520 120) scale(0.46) translate(-200 -260)">
          <SouqStreet frame={frame} />
          <Incident frame={frame} {...AFTER} fallAt={AFTER.grab + 2} />
        </g>
      );
      return {
        // العمودي (الأمر 018): البطل كاملًا مع طرف النافذة، ثم النافذة وحدها (البطل خارج الإطار كله)، ثم الاثنان
        cam: portrait
          ? [{ t: 0, x: 560, y: 520, z: 1.0 }, { t: tL, x: 960, y: 470, z: 1.1 }, { t: tE + 8, x: 640, y: 500, z: 0.9 }]
          : [
              { t: 0, x: 760, y: 470, z: 1.35 },
              { t: tL, x: 900, y: 460, z: 1.12 },
              { t: tN, x: 960, y: 450, z: 1.22 },
            ],
        world: (
          <g>
            <TintedLattice frame={frame} tint={tint} tintAmount={amount} outside={outside} />
            <Figure x={470} y={GROUND + 520} scale={2.6} pose={pz(frame, [[0, "stand"], [tL - 10, "listen"], [tE, "think"], [tN, "listen"]])} look={hero} frame={frame} rim={0.5 + 0.5 * amount} rimColor={tint} shadow={false} />
          </g>
        ),
      };
    },
  },
  "lattice-what-tints-us": {
    nameAr: "المشربية: ما يلوّن نظرنا (تجاربنا، مخاوفنا، من نحب، ما اعتدناه)",
    place: "مشربية تطل على السوق",
    render: ({ frame, at, portrait }) => {
      // التوجيه 019 (c1-s5): امتداد c1-s4 عند النافذة نفسها. كل كلمة تلوّن عمودًا من الزجاج ويظهر فيه انعكاس مصدره،
      // حتى يُرى السوق كله من خلال الألوان الأربعة: أثرها في النظر، لا رموزًا مجمّعة في غرفة. القراءة من اليمين.
      const tE = at("بتجاربنا", 0.15);
      const tF = at("ومخاوفنا", 0.38);
      const tP = at("والأشخاص", 0.55);
      const tI = at("والأفكار", 0.8);
      const on = (t: number) => prog(frame, t - 2, t + 16);
      const col = (i: number) => LATTICE.x + (i + 0.5) * (LATTICE.w / 4);
      const cw = LATTICE.w / 4;
      // التوجيه 021: أربعة ألوان متمايزة داخل المشربية الواحدة (الإطار والشبكة لا يتغيران)، وانعكاس كل عمود بلونه وشكله:
      // التجارب كهرماني دافئ (صورة قديمة)، المخاوف رمادي بارد (ظل كبير فوق شخص صغير، وزجاج متموّج)،
      // الأحباب وردي (أم وطفل يدًا بيد)، والأفكار المعتادة أخضر (صف كتب متطابقة: العادة تكرار).
      const INKC = darken(ID.night, 0.55);
      const C = {
        exp: { tint: ID.dawn, ink: darken(ID.dawn, 0.55), lite: mix(ID.dawn, ID.paper, 0.4) },
        fear: { tint: darken(ID.night, 0.2), ink: darken(ID.night, 0.7), lite: mix(ID.night, ID.paper, 0.6) },
        love: { tint: mix(ID.seal, ID.paper, 0.32), ink: darken(ID.seal, 0.5), lite: mix(ID.seal, ID.paper, 0.6) },
        idea: { tint: mix(mix(ID.night, ID.copper, 0.35), ID.paper, 0.45), ink: darken(ID.night, 0.3), lite: mix(mix(ID.night, ID.copper, 0.3), ID.paper, 0.75) },
      };
      const aE = on(tE);
      const aF = on(tF);
      const aP = on(tP);
      const aI = on(tI);
      // الأعمدة من اليسار: الأفكار، الأحباب، المخاوف، التجارب (القراءة من اليمين)
      const columns = [
        { tint: C.idea.tint, amount: aI },
        { tint: C.love.tint, amount: aP },
        { tint: C.fear.tint, amount: aF },
        { tint: C.exp.tint, amount: aE },
      ];
      const ripple = (cx: number) => (
        <g stroke={C.fear.lite} strokeWidth={3} fill="none" opacity={0.5}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
            const yy = LATTICE.y + 40 + k * 78 + 6 * Math.sin(frame / 9 + k);
            return <path key={k} d={`M${cx - cw / 2} ${yy} q${cw / 8} -12 ${cw / 4} 0 t${cw / 4} 0 t${cw / 4} 0 t${cw / 4} 0`} />;
          })}
        </g>
      );
      const reflections = [
        // الأفكار المعتادة: رف كتب متطابقة (العادة تكرار)، وكتاب مفتوح فوقها
        <g key="i" opacity={0.95 * aI}>
          <rect x={col(0) - 92} y={LATTICE.y + 470} width={184} height={14} fill={C.idea.ink} />
          {[0, 1, 2, 3, 4].map((k) => (
            <g key={k}>
              <rect x={col(0) - 84 + k * 34} y={LATTICE.y + 330 + (k % 2) * 12} width={30} height={140 - (k % 2) * 12} rx={3} fill={[darken(ID.copper, 0.25), ID.seal, darken(ID.night, 0.05), mix(ID.copper, ID.paper, 0.3), darken(ID.seal, 0.25)][k]} stroke={INKC} strokeWidth={3} />
              <rect x={col(0) - 80 + k * 34} y={LATTICE.y + 356 + (k % 2) * 12} width={22} height={5} fill={ID.paper} opacity={0.8} />
              <rect x={col(0) - 80 + k * 34} y={LATTICE.y + 436} width={22} height={5} fill={ID.paper} opacity={0.8} />
            </g>
          ))}
          {/* كتاب مسنود مائلًا في طرف الرف: يُقرأ رف كتب لا سياجًا */}
          <rect x={col(0) + 88} y={LATTICE.y + 336} width={28} height={134} rx={3} fill={mix(ID.copper, ID.night, 0.3)} stroke={INKC} strokeWidth={3} transform={`rotate(14 ${col(0) + 88} ${LATTICE.y + 470})`} />
        </g>,
        // الأحباب: أم وطفل يدًا بيد
        <g key="p" opacity={0.9 * aP}>
          <Glow cx={col(1)} cy={LATTICE.y + 420} r={150} color={C.love.lite} opacity={0.5} />
          <Figure x={col(1) - 36} y={LATTICE.y + 580} scale={1.05} pose={{ ...POSES.stand, armFront: { s: 22, e: 8 } }} look={LOOKS.woman} silhouette={C.love.ink} shadow={false} />
          <Figure x={col(1) + 42} y={LATTICE.y + 580} scale={0.66} pose={{ ...POSES.stand, armBack: { s: -30, e: 4 } }} look={LOOKS.boy} silhouette={C.love.ink} shadow={false} />
        </g>,
        // المخاوف: ظل كبير يعلو شخصًا صغيرًا منكمشًا، والزجاج يتموّج
        <g key="f" opacity={0.9 * aF}>
          {ripple(col(2))}
          <Figure x={col(2) + 30} y={LATTICE.y + 630} scale={1.6} pose={{ ...POSES.stand, lean: 16, head: 22, armFront: { s: 40, e: 30 } }} look={hero} silhouette={C.fear.ink} shadow={false} />
          <Figure x={col(2) - 52} y={LATTICE.y + 620} scale={0.72} pose={POSES.flinch} look={hero} silhouette={C.fear.lite} shadow={false} />
        </g>,
        // التجارب: صورة قديمة تضيء
        <g key="e" opacity={0.95 * aE} transform={`translate(${col(3) - 80} ${LATTICE.y + 130})`}>
          <PhotoFrame x={0} y={0} w={160} glow={0.6} people={2} />
        </g>,
      ];
      const edges = columns.map((c, i) =>
        c.amount > 0.01 ? <rect key={i} x={LATTICE.x + i * cw + 14} y={LATTICE.y + 14} width={cw - 28} height={LATTICE.h - 28} fill="none" stroke={[C.idea, C.love, C.fear, C.exp][i]!.lite} strokeWidth={6} opacity={0.75 * c.amount} /> : null,
      );
      const outside = (
        <g transform="translate(520 120) scale(0.46) translate(-200 -260)">
          <SouqStreet frame={frame} />
          <Incident frame={frame} {...AFTER} fallAt={AFTER.grab + 2} />
        </g>
      );
      const lastWord = Math.max(tE, tF, tP, tI);
      // حافة الضوء على البطل بلون آخر عمود أضاء
      const rimColor = frame >= tI ? C.idea.lite : frame >= tP ? C.love.lite : frame >= tF ? C.fear.lite : C.exp.lite;
      const clipId = "lattice-reflections-c1s5";
      return {
        // الأفقي يبدأ بتأطير آخر c1-s4؛ العمودي يمر على كل عمود عند كلمته ثم يعود إلى البطل والنافذة
        cam: portrait
          ? [{ t: 0, x: 640, y: 500, z: 0.9 }, { t: tE - 6, x: col(3), y: 440, z: 1.25 }, { t: tF - 6, x: col(2), y: 440, z: 1.25 }, { t: tP - 6, x: col(1), y: 440, z: 1.25 }, { t: tI - 6, x: col(0), y: 440, z: 1.25 }, { t: lastWord + 22, x: 700, y: 500, z: 0.86 }]
          : [{ t: 0, x: 960, y: 450, z: 1.22 }, { t: lastWord + 18, x: 900, y: 460, z: 1.12 }],
        captionBackdrop: 0.5,
        world: (
          <g>
            <TintedLattice frame={frame} tint={mix(ID.paper, ID.copper, 0.3)} tintAmount={0.05} outside={outside} columns={columns} />
            <defs>
              {[0, 1, 2, 3].map((i) => (
                <clipPath key={i} id={`${clipId}-${i}`}>
                  <rect x={LATTICE.x + i * cw + 9} y={LATTICE.y} width={cw - 18} height={LATTICE.h} />
                </clipPath>
              ))}
            </defs>
            {/* كل انعكاس داخل عموده وحده؛ وعمود المخاوف أعتم من غيره */}
            <rect x={LATTICE.x + 2 * cw} y={LATTICE.y} width={cw} height={LATTICE.h} fill={darken(ID.night, 0.4)} opacity={0.35 * aF} />
            {reflections.map((r, i) => <g key={i} clipPath={`url(#${clipId}-${i})`}>{r}</g>)}
            {edges}
            <Figure x={470} y={GROUND + 520} scale={2.6} pose={pz(frame, [[0, "listen"], [tF, "flinch"], [tP, "listen"], [tI, "think"]])} look={hero} frame={frame} rim={0.5 + 0.4 * Math.max(aE, aF, aP, aI)} rimColor={rimColor} shadow={false} />
          </g>
        ),
      };
    },
  },
  "home-what-shapes-us": {
    nameAr: "البيت: تجاربنا ومخاوفنا ومن نحب وأفكارنا",
    place: "بيت بمكتبة وصور",
    render: ({ frame, at, portrait }) => {
      const tE = at("بتجاربنا", 0.15);
      const tF = at("ومخاوفنا", 0.38);
      const tP = at("والأشخاص", 0.55);
      const tI = at("والأفكار", 0.8);
      const fear = prog(frame, tF, tF + 20) * (1 - prog(frame, tP + 10, tP + 30));
      return {
        // العمودي (الأمر 018): البطل، ثم هو وظل مخاوفه معًا، ثم الأهل عند الباب، ثم البطل والمكتبة والأهل في إطار واحد
        cam: portrait
          ? [K(0, 900, 0.95), K(tE, 1040, 1.15), K(tF, 790, 0.78), K(tP, 330, 0.9), K(tI - 12, 430, 0.76)]
          : [K(0, 960, 1.15), K(tE, 1100, 1.67), K(tF, 900, 1.21), K(tP, 520, 1.26), K(tI, 420, 1.55)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="dusk" box={prog(frame, tE, tE + 24)} door={prog(frame, tP - 10, tP + 10)} frames={prog(frame, tP, tP + 20)} shelf={prog(frame, tI, tI + 20)} />
            {/* ظل المخاوف يكبر على الجدار */}
            <g opacity={0.45 * fear}>
              <Figure x={760} y={GROUND - 10} scale={1.25 + 1.1 * fear} pose={POSES.flinch} look={hero} silhouette={darken(ID.night, 0.4)} shadow={false} />
            </g>
            <Walker frame={frame} from={-120} to={240} y={GROUND + 10} start={tP} look={LOOKS.woman} scale={1.12} />
            <Walker frame={frame} from={-200} to={110} y={GROUND + 10} start={tP + 8} look={LOOKS.boy} scale={0.78} />
            <Figure x={900 - 340 * prog(frame, tI, tI + 40)} y={GROUND + 10} scale={1.2} pose={pz(frame, [[0, "stand"], [tE, "listen"], [tF, "flinch"], [tP, "stand"], [tI, "hold"]])} look={hero} flip={frame > tP - 6} holding={frame > tI + 30 ? "book" : "none"} frame={frame} />
          </g>
        ),
      };
    },
  },
  "cafe-news-agrees": {
    nameAr: "المقهى: خبر يوافق رأيه فيصدّقه",
    place: "مقهى الحارة",
    render: ({ frame, at, portrait }) => {
      const tN = at("خبرا", 0.3);
      const tA = at("يؤكد", 0.6);
      const tR = at("رأينا", 0.85);
      const glow = prog(frame, tN - 4, tN + 10);
      return {
        // العمودي: الجالسان كاملان في اللقطتين الواسعتين (لا يُقص الصديق على الحافة)
        cam: portrait ? [K(0, 960, 1.3), K(tN - 6, 780, 1.95), K(tA + 10, 960, 1.3)] : [K(0, 960, 1.5), K(tN - 6, 860, 1.95), K(tA + 10, 960, 1.44)],
        world: (
          <g>
            <Cafe frame={frame} />
            <Chair x={800} />
            <Chair x={1120} flip />
            <CafeTable x={960} frame={frame} />
            <Glow cx={900} cy={GROUND - 250} r={200} opacity={glow * 0.9} />
            <Figure x={820} y={GROUND} scale={1.08} pose={pz(frame, [[0, "sit"], [tN - 8, "sit-show"], [tA, "sit-nod"], [tR, "sit-show"]])} look={hero} holding="phone" frame={frame} rim={glow} />
            <Figure x={1100} y={GROUND} scale={1.06} pose={pz(frame, [[0, "sit"], [tR + 6, "sit-nod"]])} look={LOOKS.friend} flip frame={frame + 9} />
          </g>
        ),
        tint: GOLD,
        tintOpacity: 0.1,
      };
    },
  },
  "workshop-rejected-advice": {
    nameAr: "الورشة: نصيحة صحيحة يرفضها لأنه لا يحب قائلها",
    place: "ورشة نجارة",
    render: ({ frame, at, portrait }) => {
      // التوجيه 021: لا يتحرك الكرسي إلا بيد. الزميل يشير إلى الساق القصيرة، ثم عند «صحيحة» ينحني ويضغط مقدّم المقعد
      // فيميل الكرسي على ساقه القصيرة حتى تلمس الأرض، ثم يرفع يده فيعود إلى أرجله الثلاث ويظهر الفراغ؛ دورة واحدة (التوجيه 022)،
      // في لقطة قريبة على الفراغ واليد. والبطل يرفض ويعطي ظهره دون أن ينظر.
      const tR = at("نرفض", 0.12);
      const tA = at("صحيحة", 0.35);
      const tJ = at("جاءت", 0.55);
      const tD = at("نحبه", 0.85);
      const p0 = tA - 6;
      // ميل الكرسي = مقدار ضغط اليد: ضغطة واحدة، نزول ثم ثبات قصير ثم رفع
      const rock = prog(frame, p0, p0 + 8) * (1 - prog(frame, p0 + 18, p0 + 26));
      // يجثو على ركبته القريبة بجانب الكرسي (لا ينحني فوقه)، وكفه على مقدّم المقعد فوق الساق القصيرة؛ ومع الضغط يميل قليلًا
      // فتنزل الكف مع مقدّم المقعد إلى موضعه بعد الميل حول قدم الساق الخلفية (المواضع محسوبة بـhandAt)
      const KNEEL = { legFront: { s: 4, e: 96 }, legBack: { s: 70, e: 70 } };
      const PRESS_UP: PoseSpec = { ...POSES.point, lean: 26, head: 22, armFront: { s: 14, e: 12 }, ...KNEEL };
      const PRESS_DOWN: PoseSpec = { ...PRESS_UP, lean: 30, armFront: { s: -2, e: 16 } };
      const POINT_DOWN: PoseSpec = { ...POSES.point, lean: 14, head: 24, armFront: { s: 46, e: 6 } };
      const pressing = frame >= p0 - 12 && frame < p0 + 32;
      const tl: [number, PoseSpec][] = [[0, POINT_DOWN], [tR + 6, POSES.talk], [p0 - 12, PRESS_UP], [p0 + 32, POINT_DOWN], [tJ + 14, POSES.talk], [tD, POSES.stand], [tD + 14, POSES.nod]];
      const friendPose = (() => {
        if (pressing && frame >= p0 - 2) return blendPose(PRESS_UP, PRESS_DOWN, rock);
        let i = 0;
        while (i + 1 < tl.length && frame >= tl[i + 1]![0]) i++;
        const [t0, p] = tl[i]!;
        const prev = i > 0 ? tl[i - 1]![1] : p;
        return i > 0 && frame < t0 + 10 ? blendPose(prev, p, prog(frame, t0, t0 + 10)) : p;
      })();
      return {
        // اللقطات: الاثنان والكرسي؛ البطل يرفض؛ لقطة قريبة على الساق القصيرة واليد طول الضغطتين؛ ثم الاثنان والبطل يعطيه ظهره
        cam: portrait
          ? [K(0, 880, 1.0), K(tR, 1520, 1.15), { t: p0 - 8, x: 870, y: 730, z: 2.0, cut: true }, { ...K(p0 + 34, 1530, 1.1), cut: true }, K(tD, 1530, 1.25)]
          : [K(0, 1150, 1.15), K(tR, 1530, 1.67), { t: p0 - 8, x: 880, y: 720, z: 2.5, cut: true }, { ...K(p0 + 34, 1190, 1.15), cut: true }, K(tD, 1220, 1.3)],
        world: (
          <g>
            <Workshop frame={frame} chairRock={rock} chairMark={prog(frame, p0 - 10, p0) * (1 - prog(frame, tD - 10, tD + 6))} />
            <Figure x={765} y={GROUND + 8} scale={1.18} pose={friendPose} look={LOOKS.friend} frame={frame} />
            <Figure x={1580} y={GROUND + 8} scale={1.2} pose={pz(frame, [[0, "hold"], [tR, "wave-off"], [tR + 34, "turn-away"], [tD, "cross"]])} look={hero} flip={frame < tR + 34} frame={frame} />
          </g>
        ),
      };
    },
  },
  "home-defending-decision": {
    nameAr: "البيت: يدافع عن قراره لأن الاعتراف بالخطأ مؤلم",
    place: "بيت بمكتبة وصور",
    render: ({ frame, at, portrait }) => {
      const tD = at("ندافع", 0.1);
      const tQ = at("قرار", 0.2);
      const tE = at("الأدلة", 0.45);
      const tC = at("الاعتراف", 0.7);
      const tP = at("مؤلما", 0.88);
      const dim = prog(frame, tC, tC + 30);
      // التوجيه 019: الفعل مفهوم قبل الكابشن. الورقة (قراره) في يده من أول المشهد إلى آخره؛ الشيخ يتقدم ويفتح الكتاب
      // فيضيء (الدليل)؛ البطل ينظر إليه ثم يضم ورقته إلى صدره ويعطيه ظهره؛ يضيء الباب خلف الشيخ (طريق الاعتراف) فلا يمضي إليه؛
      // ثم يجلس منكسرًا وورقته ما زالت في يده.
      // التوجيه 021: الشيخ يقترب أكثر فيجتمع الدليل والورقة في لقطة واحدة بالاتجاهين، ولكلٍّ ضوؤه:
      // الكتاب بنور الفجر (الدليل)، والورقة بضوء نحاسي خافت (القرار) يتبع كف البطل حيث كانت.
      const elderX = 620 + 140 * prog(frame, tE - 14, tE + 6);
      const proof = prog(frame, tE - 4, tE + 12) * (1 - 0.6 * prog(frame, tP, tP + 20));
      const CLUTCH: PoseSpec = { ...POSES.sincere, lean: -4, head: 14 };
      const heroPose =
        frame >= tE + 8 && frame < tP - 6
          ? blendPose(pz(frame, [[0, "talk"], [tD, "point"], [tQ, "hold"]]), CLUTCH, prog(frame, tE + 8, tE + 20))
          : pz(frame, [[0, "hold"], [tD, "point"], [tQ, "hold"], [tP - 6, "sit-low"], [tP + 20, "head-down"]]);
      const heroFlip = !(frame >= tE + 14 && frame < tP - 6);
      const heroY = frame > tP - 6 ? GROUND : GROUND + 8;
      const hand = handAt(heroPose, { x: 1090, y: heroY, scale: 1.2, flip: heroFlip });
      // مركز الورقة من الكف (الورقة ترسم من الكف إلى أعلى وإلى الأمام)
      const paperGlow = { x: hand.x + (heroFlip ? -1 : 1) * 16 * 1.2, y: hand.y - 14 * 1.2 };
      return {
        captionBackdrop: 0.5,
        // التوجيه 021: الاثنان، ثم البطل بورقة قراره، ثم الدليل والورقة معًا في لقطة واحدة (بالاتجاهين) حتى ينكسر والكتاب في الإطار
        cam: portrait
          ? [K(0, 855, 0.85), K(tQ, 1080, 1.3), K(tE - 12, 905, 1.05), K(tC, 960, 1.12), K(tP, 945, 1.1)]
          : [K(0, 900, 1.32), K(tQ, 1050, 1.72), K(tE, 925, 1.4), K(tC, 1000, 1.7), K(tP, 1000, 1.85)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="night" door={prog(frame, tC - 4, tC + 14) * (1 - 0.5 * prog(frame, tP, tP + 20))} />
            <Chair x={1110} flip />
            <Glow cx={elderX + 70} cy={GROUND - 230} r={150} color={ID.dawn} opacity={0.75 * proof} />
            <Glow cx={paperGlow.x} cy={paperGlow.y} r={80} color={ID.copper} opacity={0.55} />
            <Figure x={elderX} y={GROUND + 8} scale={1.18} pose={pz(frame, [[0, "listen"], [tE - 10, "hold"], [tP, "stand"]])} look={LOOKS.elder} holding={frame > tE - 14 ? "book" : "none"} frame={frame + 5} rim={0.6 * proof} />
            <Figure
              x={1090}
              y={heroY}
              scale={1.2}
              pose={heroPose}
              look={hero}
              flip={heroFlip}
              holding="paper"
              frame={frame}
            />
            <rect x={-300} y={-300} width={2520} height={1500} fill="#000" opacity={0.25 * dim} />
          </g>
        ),
      };
    },
  },
  "home-knows-cant": {
    nameAr: "البيت: يعرف ما ينبغي فعله ثم تعجز نفسه عن الالتزام",
    place: "بيت بمكتبة وصور (ليلًا)",
    render: ({ frame, at }) => {
      // الكتاب الذي ينبغي أن يقرأه على الطاولة؛ يأخذه ويفتحه، ثم يهتز الهاتف فيترك الكتاب ويُغلق
      const tK = at("يعرف", 0.3);
      const tS = at("ينبغي", 0.45);
      const tC = at("تعجز", 0.68);
      const tL = at("الالتزام", 0.86);
      const reading = prog(frame, tS, tS + 20) * (1 - prog(frame, tC + 6, tC + 30));
      const holdBook = frame >= tK + 6 && frame < tC + 12;
      const holdPhone = frame >= tC + 18;
      const close = prog(frame, tL, tL + 18);
      const bookOnTable = !holdBook;
      const bx = 930;
      const by = GROUND - 190;
      const pw = frame < tK + 6 ? 0 : 62 * (1 - close);
      return {
        cam: [S(0, 1040, 1.7), S(tK, 1060, 2.0), S(tC, 1030, 1.9), S(tL, 1040, 1.75)],
        world: (
          <g>
            <HomeRoom frame={frame} mood="night" />
            <LightPool cx={1080} cy={GROUND - 260} rx={260} ry={200} color={GOLD} opacity={0.8 * reading} />
            <CafeTable x={960} frame={frame} />
            <Chair x={1140} flip />
            {/* الكتاب على الطاولة: مغلق، ثم يعود مفتوحًا، ثم ينغلق */}
            {bookOnTable ? (
              <g>
                <rect x={bx - 46 - pw / 2} y={by} width={92 + pw} height={14} rx={3} fill={mix(ID.seal, ID.night, 0.35)} stroke="#1a1208" strokeWidth={2.4} />
                {pw > 1 ? <rect x={bx - pw / 2 - 40} y={by - 4} width={pw + 80} height={8} fill={ID.paper} stroke="#1a1208" strokeWidth={1.6} /> : null}
              </g>
            ) : null}
            {/* الهاتف على الطاولة يهتز ويضيء */}
            {!holdPhone ? <rect x={1010} y={GROUND - 182} width={44} height={10} rx={3} fill={frame > tC - 4 ? ID.dawn : darken(ID.night, 0.3)} stroke="#1a1208" strokeWidth={2} transform={frame > tC - 4 && frame < tC + 18 ? `translate(${Math.sin(frame * 2.3) * 3} 0)` : undefined} /> : null}
            <BuzzArcs x={1032} y={GROUND - 186} p={prog(frame, tC - 4, tC + 22, (t) => t)} />
            <Figure x={1120} y={GROUND} scale={1.12} pose={pz(frame, [[0, "sit"], [tK, "sit-show"], [tS, "sit-show"], [tC + 4, "sit"], [tC + 18, "sit-show"], [tL, "sit-low"]])} look={hero} flip holding={holdBook ? "book" : holdPhone ? "phone" : "none"} frame={frame} rim={0.6 * reading} />
          </g>
        ),
      };
    },
  },
  "cafe-rumor-looks-fine": {
    nameAr: "المقهى: خطأ لا يبدو قبيحًا (رسالة جميلة الشكل)",
    place: "مقهى الحارة",
    render: ({ frame, at }) => {
      const tW = at("خطأ", 0.3);
      const tL = at("يبدو", 0.45);
      const tQ = at("قبيحا", 0.6);
      const tE = at("أعيننا", 0.85);
      return {
        cam: [S(0, 1030, 1.6), S(tW, 1060, 1.95)],
        world: (
          <g>
            <Cafe frame={frame} />
            <Chair x={800} />
            <Chair x={1140} flip />
            <CafeTable x={960} frame={frame} />
            <Glow cx={1050} cy={GROUND - 220} r={120} opacity={0.8 * prog(frame, tW - 2, tW + 8)} />
            <BuzzArcs x={1050} y={GROUND - 222} p={prog(frame, tW - 2, tW + 24, (t) => t)} />
            <Figure x={1120} y={GROUND} scale={1.1} pose={pz(frame, [[0, "sit"], [tW + 4, "sit-show"]])} look={hero} flip holding="phone" frame={frame} />
          </g>
        ),
        overlay: <PhonePOV frame={frame} show={prog(frame, tL - 4, tL + 14)} buzz={prog(frame, tL - 4, tL + 20, (t) => t)} shine={prog(frame, tQ, tQ + 28, (t) => t)} tempt={0.5 * prog(frame, tE, tE + 18)} near={prog(frame, tE - 4, tE + 22)} />,
      };
    },
  },
  "cafe-rumor-tempting": {
    nameAr: "المقهى: مغرٍ وسهل وموافق لرغباته",
    place: "مقهى الحارة",
    render: ({ frame, at }) => {
      const tM = at("مغريا", 0.25);
      const tS = at("سهلا", 0.5);
      const tA = at("موافقا", 0.7);
      const tR = at("لرغباتنا", 0.86);
      const agree = prog(frame, tA + 6, tA + 24);
      return {
        cam: [S(0, 1060, 1.95), S(tA, 1060, 1.75)],
        world: (
          <g>
            <Cafe frame={frame} />
            <Chair x={800} />
            <Chair x={1140} flip />
            <CafeTable x={960} frame={frame} />
            <LightPool cx={1110} cy={GROUND - 260} rx={240} ry={240} color={GOLD} opacity={0.6 * agree} />
            <Figure x={1120} y={GROUND} scale={1.1} pose={pz(frame, [[0, "sit-show"], [tA + 8, "sit-nod"], [tR, "sit-show"], [tR + 14, "sit-nod"]])} look={hero} flip holding="phone" frame={frame} rim={agree} />
          </g>
        ),
        overlay: <PhonePOV frame={frame} show={1 - prog(frame, tA - 2, tA + 16)} tempt={0.5 + 0.5 * prog(frame, tM, tM + 14)} thumb={prog(frame, tS, tS + 18)} near={1 - prog(frame, tS - 6, tS + 14)} />,
      };
    },
  },
  "cafe-rumor-spreads": {
    nameAr: "المقهى: يزداد قبوله لأن الناس اعتادوه",
    place: "مقهى الحارة",
    render: ({ frame, at }) => {
      const tI = at("يزداد", 0.2);
      const tQ = at("قبولنا", 0.35);
      const tN = at("الناس", 0.65);
      const tH = at("اعتادوه", 0.85);
      // كل من تصله الرسالة يضيء هاتفه ثم يومئ ويعيد إرسالها؛ تنتقل من البطل إلى من حوله ثم إلى المقهى كله
      const people: { x: number; look: FigureLook; flip: boolean; got: number }[] = [
        { x: 1120, look: hero, flip: true, got: -100 },
        { x: 560, look: LOOKS.stranger, flip: true, got: tQ },
        { x: 380, look: LOOKS.elder, flip: false, got: tQ + 10 },
        { x: 1400, look: LOOKS.friend, flip: false, got: tN - 4 },
        { x: 1570, look: LOOKS.womanSand, flip: true, got: tN + 6 },
      ];
      const hand = (x: number, flip: boolean) => ({ x: x + (flip ? -62 : 62), y: GROUND - 222 });
      const sends: { from: number; to: number; at: number }[] = [
        { from: 0, to: 1, at: tI },
        { from: 0, to: 2, at: tI + 6 },
        { from: 1, to: 3, at: tN - 18 },
        { from: 2, to: 4, at: tN - 10 },
      ];
      return {
        cam: [S(0, 1060, 1.75), S(tI + 4, 975, 1.3), S(tH, 975, 1.36)],
        world: (
          <g>
            <Cafe frame={frame} />
            {[470, 1485].map((x) => (
              <CafeTable key={x} x={x} frame={frame} />
            ))}
            <Chair x={800} />
            <CafeTable x={960} frame={frame} />
            {people.map((pp, i) => {
              const lit = prog(frame, pp.got - 2, pp.got + 8) * (1 - 0.5 * prog(frame, pp.got + 40, pp.got + 70)) + (frame > tH ? prog(frame, tH, tH + 10) * (1 - prog(frame, tH + 30, tH + 60)) : 0);
              const h = hand(pp.x, pp.flip);
              return (
                <g key={i}>
                  <Chair x={pp.x + (pp.flip ? 20 : -20)} flip={pp.flip} />
                  <Glow cx={h.x} cy={h.y} r={90} opacity={0.8 * Math.min(1, lit)} />
                  <BuzzArcs x={h.x} y={h.y} p={prog(frame, pp.got - 2, pp.got + 22, (t) => t)} />
                  <Figure x={pp.x} y={GROUND} scale={i === 0 ? 1.1 : 1.02} pose={pz(frame, i === 0 ? [[0, "sit-show"], [tI - 6, "sit-nod"], [tI + 10, "sit-show"], [tH, "sit-nod"]] : [[0, "sit"], [pp.got, "sit-show"], [pp.got + 20, "sit-nod"], [tH + 4, "sit-show"]])} look={pp.look} flip={pp.flip} holding="phone" frame={frame + i * 11} />
                </g>
              );
            })}
            {/* الرسالة تنتقل من هاتف إلى هاتف */}
            {[...sends, ...(frame > tH ? people.slice(1).map((_, k) => ({ from: k + 1, to: ((k + 2) % people.length) || 1, at: tH + k * 4 })) : [])].map((s, i) => {
              const t = prog(frame, s.at, s.at + 20, (v) => v);
              if (t <= 0 || t >= 1) return null;
              const a = hand(people[s.from]!.x, people[s.from]!.flip);
              const b = hand(people[s.to]!.x, people[s.to]!.flip);
              const x = a.x + (b.x - a.x) * t;
              const y = a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * 160;
              return <rect key={i} x={x - 16} y={y - 11} width={32} height={22} rx={5} fill={GOLD} stroke="#1a1208" strokeWidth={2} />;
            })}
          </g>
        ),
      };
    },
  },
  "courtyard-pause": {
    nameAr: "صحن الدار: يتوقف عند مشكلة دقيقة",
    place: "صحن دار بنافورة",
    render: ({ frame, dur, at }) => {
      const tM = Math.min(at("مشكلة", 0.45), dur - 30);
      const walkEnd = tM;
      const x = 1740 - 360 * prog(frame, 0, walkEnd, (t) => t);
      const pose = frame < walkEnd ? walkPose(POSES.stand, (frame / 30) * Math.PI * 2 * 0.95) : pz(frame, [[walkEnd, "stand"], [walkEnd + 6, "think"]]);
      return {
        cam: [
          K(0, 1460, 1.15, 60),
          K(walkEnd - 10, 1380, 1.5, 90),
        ],
        world: (
          <g>
            <Courtyard frame={frame} />
            <Figure x={x} y={GROUND + 110} scale={1.35} pose={pose} look={hero} flip frame={frame} />
          </g>
        ),
      };
    },
  },
  "window-wished-reflection": {
    nameAr: "نافذة الليل: ما يراه وما يتمنى أن يكون",
    place: "غرفة ليلًا بنافذة",
    render: ({ frame, at, portrait }) => {
      const tS = at("يراه", 0.35);
      const tW = at("يتمنى", 0.65);
      const diverge = prog(frame, tW, tW + 26);
      const arrive = Math.min(46, Math.max(20, tS - 4));
      const walking = frame < arrive;
      const heroPose = walking ? walkPose(POSES.stand, (frame / 30) * Math.PI * 2 * 0.95) : pz(frame, [[arrive, "stand"], [tS, "point"], [tS + 40, "think"], [tW + 30, "listen"]]);
      const reflPose = diverge > 0.5 ? pz(frame, [[0, "stand"], [tW, "proud"]]) : heroPose;
      return {
        // العمودي (الأمر 018): البطل يمشي إلى النافذة، ثم يشير إليها، ثم هو وصورته المتمناة معًا في إطار واحد (معنى الجملة)
        cam: portrait ? [K(0, 470, 1.0), K(tS, 800, 0.95), K(tW - 16, 985, 0.74)] : [K(0, 700, 1.75), K(tS, 860, 1.5), K(tW, 1060, 1.67)],
        world: (
          <g>
            <NightWindow frame={frame} />
            <defs>
              <clipPath id="night-glass">
                <rect x={775} y={75} width={730} height={GROUND - 150} />
              </clipPath>
            </defs>
            <g clipPath="url(#night-glass)" opacity={(0.42 + 0.3 * diverge) * prog(frame, 0, arrive)}>
              <Figure x={1300 - 40 * diverge} y={GROUND - 40} scale={1.2 + 0.18 * diverge} pose={reflPose} look={hero} flip shadow={false} frame={frame} rim={diverge} silhouette={diverge > 0.05 ? undefined : mix(ID.night, ID.paper, 0.35)} />
              <Glow cx={1260} cy={GROUND - 300} r={300} opacity={diverge * 0.7} />
            </g>
            <Figure x={300 + 320 * prog(frame, 0, arrive, (t) => t) + 60 * prog(frame, tW + 30, tW + 70)} y={GROUND + 10} scale={1.25} pose={heroPose} look={hero} frame={frame} />
          </g>
        ),
      };
    },
  },
  "rooftop-look-inward": {
    nameAr: "السطح: من سؤال الآخرين إلى مراجعة النفس",
    place: "أسطح المدينة",
    render: ({ frame, at }) => {
      const tO = at("الآخرين", 0.4);
      const tB = at("بمراجعة", 0.62);
      const tU = at("نحن", 0.85);
      const turn = frame > tB;
      return {
        captionBackdrop: 0.4,
        cam: [
          K(0, 640, 1.72, -90),
          K(tO - 10, 820, 1.32, -90),
          K(tB, 1000, 1.49, -90),
          K(tU, 1010, 1.9, -90),
        ],
        world: (
          <g>
            <Rooftops frame={frame} mood="night" streetPeople />
            {/* التوجيه 019: قراءة أوضح في الليل بضوء هادئ: الناس في الشارع حين يذكرهم الكلام، ثم البطل حين يلتفت إلى نفسه */}
            <Glow cx={760} cy={GROUND - 330} r={520} color={ID.dawn} opacity={0.35 * prog(frame, tO - 8, tO + 14) * (1 - 0.6 * prog(frame, tB, tB + 20))} />
            <Glow cx={1010} cy={GROUND - 200} r={300} color={ID.dawn} opacity={0.18 + 0.4 * prog(frame, tB, tB + 20)} />
            <Figure rim={0.45 + 0.4 * prog(frame, tB, tB + 20)} rimColor={ID.paper} x={1400 - 390 * prog(frame, 0, 44, (t) => t)} y={GROUND + 40} scale={1.3} pose={frame < 44 ? walkPose(POSES.stand, (frame / 30) * Math.PI * 2 * 0.95) : pz(frame, [[44, "lean-rail"], [tO, "point"], [tO + 50, "lean-rail"], [tB, "stand"], [tB + 14, "sincere"]])} look={hero} flip={!turn} frame={frame} />
            <Birds frame={frame} start={tO + 10} y={160} n={5} />
            <RoofWall frame={frame} />
          </g>
        ),
      };
    },
  },
  "rooftop-dawn-fog": {
    nameAr: "السطح فجرًا: مصباحان يتشابه ضوؤهما فيتردد حكمه بينهما",
    place: "أسطح المدينة",
    render: ({ frame, dur, at, portrait }) => {
      const tB = at("نقتنع", 0.15);
      const tL = at("يعجبنا", 0.4);
      const tH = at("تزداد", 0.45);
      const tM = at("يختلط", 0.65);
      const tN = at("يظهر", 0.8);
      const tW = at("الخطأ", 0.85);
      const dawn = prog(frame, 0, Math.min(dur, tM + 40), (t) => t);
      // التوجيه 021: الاختلاط التباس حكم لا امتزاج ألوان. المصباحان قائمان طوال المشهد ولكلٍّ ظل يلقيه على البطل.
      // قبل «يختلط» إيماءاته حاسمة: يشير إلى الأول كاملًا، ويعرض عن الثاني كاملًا. عند «يختلط» يقترب لون الضوءين حتى يتطابقا،
      // ويتساوى ظلاه عند قدميه، فيرفع يده نصف رفعة نحو الأول ثم نحو الثاني ثم يعود فلا يتم الإشارة؛ ثم يده إلى ذقنه.
      const mixT = prog(frame, tM, tM + 40);
      const a = prog(frame, tB - 6, tB + 10);
      const b2 = prog(frame, tL - 6, tL + 10);
      const MID = mix(ID.dawn, ID.paper, 0.5);
      const colA = mix(ID.dawn, MID, mixT);
      const colB = mix(mix(ID.paper, ID.night, 0.12), MID, mixT);
      const iA = 0.3 + 0.5 * a;
      const iB = 0.3 + 0.5 * b2;
      // يد نصف مرفوعة بكف مفتوحة نحو المصباح ومرفق مثني: إشارة لم تكتمل
      const HALF: PoseSpec = { ...POSES.stand, lean: 3, head: -4, armFront: { s: 62, e: 38 } };
      const pose = (() => {
        const tl: [number, PoseSpec][] = [
          [0, POSES.stand], [tB - 4, POSES.point], [tB + 30, POSES.stand], [tL - 4, POSES["wave-off"]], [tL + 30, POSES.stand],
          [tH, { ...POSES.stand, head: 22 }], [tM + 4, HALF], [tM + 26, POSES.stand], [tM + 34, HALF], [tN - 10, POSES.stand], [tN - 2, HALF], [tW + 4, POSES.think],
        ];
        let i = 0;
        while (i + 1 < tl.length && frame >= tl[i + 1]![0]) i++;
        const [t0, p] = tl[i]!;
        return i > 0 && frame < t0 + 10 ? blendPose(tl[i - 1]![1], p, prog(frame, t0, t0 + 10)) : p;
      })();
      // الوجهة: -1 نحو الأول (يسار)، 1 نحو الثاني (يمين)؛ التفات متدرّج
      const turns: [number, 1 | -1][] = [[0, -1], [tL - 8, 1], [tM, -1], [tM + 26, 1], [tN - 10, -1]];
      let sx: number = -1;
      for (let k = 1; k < turns.length; k++) if (frame >= turns[k]![0]) sx = turnSx(frame, turns[k]![0], turns[k - 1]![1], turns[k]![1], 10);
      return {
        captionBackdrop: 0.7,
        // البطل والمصباحان في الإطار دائمًا (العمودي أوسع ليبقيا)، والكاميرا تقترب من البطل عند الالتباس فيُقرأ تردده
        cam: portrait
          ? [K(0, 1000, 0.9, -60), K(tB - 8, 820, 1.2, -60), K(tL - 8, 1180, 1.2, -60), K(tH, 1000, 0.9, -50), K(tM - 4, 1000, 0.9, -30)]
          : [K(0, 1000, 1.25, -60), K(tB - 8, 860, 1.5, -60), K(tL - 8, 1140, 1.5, -60), K(tH, 1000, 1.35, -50), K(tM - 4, 1000, 1.6, -30), K(tN - 10, 1000, 1.85, -10)],
        world: (
          <g>
            <Rooftops frame={frame} mood="predawn" to="dawn" t={dawn} fog={0.5 * prog(frame, tH, tM + 50)} />
            <Glow cx={700} cy={GROUND - 300} r={300} color={colA} opacity={iA * 0.75} />
            <Glow cx={1300} cy={GROUND - 300} r={300} color={colB} opacity={iB * 0.75} />
            <rect x={690} y={GROUND - 300} width={20} height={340} fill={darken(ID.night, 0.25)} />
            <rect x={1290} y={GROUND - 300} width={20} height={340} fill={darken(ID.night, 0.25)} />
            <circle cx={700} cy={GROUND - 310} r={22} fill={colA} opacity={0.6 + 0.4 * a} stroke={darken(ID.night, 0.25)} strokeWidth={3} />
            <circle cx={1300} cy={GROUND - 310} r={22} fill={colB} opacity={0.6 + 0.4 * b2} stroke={darken(ID.night, 0.25)} strokeWidth={3} />
            <Birds frame={frame} start={Math.round(dur * 0.06)} y={260} n={8} color={darken(ID.night, 0.2)} />
            {/* ضوء كل مصباح على جانب البطل الذي يليه؛ يتطابقان حين يختلط الضوءان فلا يميز جانبًا من جانب */}
            <Glow cx={930} cy={GROUND - 190} r={110} color={colA} opacity={0.4 * iA} />
            <Glow cx={1070} cy={GROUND - 190} r={110} color={colB} opacity={0.4 * iB} />
            <Turn x={1000} sx={sx}>
              <Figure x={1000} y={GROUND + 40} scale={1.3} pose={pose} look={hero} frame={frame} rim={0.5 + 0.5 * dawn} rimColor={sx < 0 ? colA : colB} />
            </Turn>
            <RoofWall frame={frame} />
          </g>
        ),
      };
    },
  },
  // الحلقة 001 · الفصل 2 (التوجيه 019): وحدات المقهى وصحن الدار والسطوح والميزان
  ...CH2_SHOTS,
  // الحلقة 001 · الفصل 3 (التوجيه 022)
  ...CH3_SHOTS,
};

export const SHOT_IDS = Object.keys(SHOTS);

/** الأماكن المرسومة بالمستوى الجديد (معرض «أماكن التصوير» في الاستوديو): ما يظهر هنا هو ما يُرندر */
export const RICH_SETS: { id: string; nameAr: string; render: (frame: number) => React.ReactNode }[] = [
  { id: "souq-street", nameAr: "سوق الحارة عصرًا: دكاكين بمظلات وشرفات مشربية وعربة فاكهة", render: (f) => <><SouqStreet frame={f} /><FruitCart x={820} /></> },
  { id: "tinted-lattice", nameAr: "مشربية بزجاج ملوّن تطل على السوق", render: (f) => <TintedLattice frame={f} tint={GOLD} tintAmount={0.6} outside={<g transform="translate(520 120) scale(0.46) translate(-200 -260)"><SouqStreet frame={f} /></g>} /> },
  { id: "home-room", nameAr: "البيت: مكتبة وصور وصندوق رسائل ونافذة الغروب", render: (f) => <HomeRoom frame={f} mood="dusk" /> },
  { id: "home-room-night", nameAr: "البيت ليلًا", render: (f) => <HomeRoom frame={f} mood="night" /> },
  { id: "cafe", nameAr: "مقهى الحارة: أقواس وفوانيس وروّاد وطاولة شاي", render: (f) => <><Cafe frame={f} /><Chair x={800} /><Chair x={1120} flip /><CafeTable x={960} frame={f} /></> },
  { id: "workshop", nameAr: "ورشة نجارة: لوح أدوات ومنضدة وكرسي قيد الصنع", render: (f) => <Workshop frame={f} /> },
  { id: "night-window", nameAr: "غرفة ليلًا بنافذة تعكس صاحبها", render: (f) => <NightWindow frame={f} /> },
  { id: "courtyard", nameAr: "صحن دار بنافورة ليلًا", render: (f) => <Courtyard frame={f} /> },
  { id: "rooftops-night", nameAr: "أسطح المدينة ليلًا والشارع في الأسفل", render: (f) => <><Rooftops frame={f} mood="night" streetPeople /><RoofWall frame={f} /></> },
  { id: "rooftops-dawn", nameAr: "أسطح المدينة فجرًا بالضباب", render: (f) => <><Rooftops frame={f} mood="predawn" to="dawn" t={0.8} fog={0.6} /><RoofWall frame={f} /></> },
];
void LightPool;
