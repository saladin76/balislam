import React from "react";
import { ID, darken, mix } from "../palette";
import { Figure, LOOKS, POSES, walkPose } from "../Figure";
import { GROUND, Glow } from "../world";
import { LightPool } from "../texture";
import { SouqStreet, FruitCart } from "./street";
import { HomeRoom, Cafe, CafeTable, Chair, Workshop, TintedLattice, NightWindow } from "./interior";
import { Courtyard, Rooftops, RoofWall } from "./outdoor";
import { Birds, K, Rolling, Walker, prog, pz, type CamKey, type ShotCtx } from "./kit";

/**
 * اللقطات المصمَّمة: كل لقطة تحكي جملتها بمكانها وشخوصها وكاميرتها، وأحداثها تقع لحظة نطق كلماتها.
 * تُختار في الخطة بحقل shot في قالب «حكايات الحارة»، وتظهر في مكتبة الاستوديو.
 * الفصل الأول من الحلقة 001 قصة واحدة متصلة: حادثة في السوق يحكم عليها شاهدان بحكمين،
 * ثم البطل نفسه في يومه: ما يؤثر فيه، وخبر يصدقه، ونصيحة يرفضها، وقرار يدافع عنه، حتى فجر يراجع فيه نفسه.
 */
export type Shot = { cam: CamKey[]; world: React.ReactNode; tint?: string; tintOpacity?: number };
export type ShotDef = { nameAr: string; place: string; render: (c: ShotCtx) => Shot };

const hero = LOOKS.hero;
const RED = ID.seal;
const GOLD = ID.dawn;

/** حادثة السوق: البائع يمسك معصم الفتى وفي يده برتقالة؛ هل سرق أم ظُلم؟ */
const Incident: React.FC<{ frame: number; grab: number; fallAt?: number }> = ({ frame, grab, fallAt }) => (
  <g>
    <FruitCart x={820} missing={fallAt !== undefined && frame > fallAt ? 4 : 0} />
    <Figure x={1140} y={GROUND + 4} scale={1.15} pose={grab > 0.5 ? (frame % 50 < 25 ? POSES.halt : POSES.point) : POSES.stand} look={LOOKS.vendor} flip frame={frame} />
    <Figure x={760} y={GROUND + 4} scale={0.82} pose={grab > 0.5 ? POSES.flinch : POSES.hold} look={LOOKS.boy} holding="none" frame={frame + 7} />
    {/* البرتقالة في يد الفتى */}
    <circle cx={grab > 0.5 ? 742 : 792} cy={GROUND - 150} r={11} fill={mix(GOLD, RED, 0.3)} stroke="#1a1208" strokeWidth={2} />
    {fallAt !== undefined ? <Rolling frame={frame} at={fallAt} x={900} y={GROUND - 200} ground={GROUND + 20} color={mix(GOLD, RED, 0.3)} dir={-1} /> : null}
  </g>
);

/** مارّة في عمق الشارع (حياة لا تتوقف) */
const Passers: React.FC<{ frame: number }> = ({ frame }) => (
  <g>
    <Walker frame={frame} from={2200} to={-300} y={GROUND - 40} loop look={LOOKS.elder} scale={0.78} start={-40} end={620} />
    <Walker frame={frame} from={-300} to={2200} y={GROUND - 40} loop look={LOOKS.womanSand} scale={0.76} start={-260} end={480} />
  </g>
);

export const SHOTS: Record<string, ShotDef> = {
  "souq-two-witnesses": {
    nameAr: "السوق: شاهدان على حادثة واحدة",
    place: "سوق الحارة",
    render: ({ frame, dur, at }) => {
      const t1 = at("شخصان", 0.15);
      const t2 = at("الموقف", 0.3);
      const t3 = at("يخرجان", 0.55);
      const t4 = at("مختلفين", 0.8);
      return {
        cam: [
          K(0, 960, 1.12),
          K(t1, 960, 1.13),
          K(t2, 950, 1.49),
          K(t3, 960, 1.12),
          K(t4, 960, 1.17),
        ],
        world: (
          <g>
            <SouqStreet frame={frame} />
            <Passers frame={frame} />
            <Incident frame={frame} grab={prog(frame, t2 - 4, t2 + 4)} fallAt={t2 + 2} />
            <Figure x={340 - 60 * prog(frame, t3, t3 + 40)} y={GROUND + 6} scale={1.2} pose={pz(frame, [[0, "stand"], [t1, "think"], [t3, "cross"], [t4, "think"]])} look={hero} frame={frame} />
            <Figure x={1560 + 60 * prog(frame, t3, t3 + 40)} y={GROUND + 6} scale={1.18} pose={pz(frame, [[0, "stand"], [t1 + 6, "listen"], [t3, "cross"], [t4, "nod"]])} look={LOOKS.woman} flip frame={frame + 11} />
          </g>
        ),
        tintOpacity: 0,
      };
    },
  },
  "souq-two-verdicts": {
    nameAr: "السوق: كل شاهد يرى الحادثة بلونه",
    place: "سوق الحارة",
    render: ({ frame, at }) => {
      const tR = at("ظلما", 0.35);
      const t2 = at("والثاني", 0.55);
      const tG = at("عدلا", 0.8);
      const red = prog(frame, tR, tR + 16);
      const gold = prog(frame, tG, tG + 16);
      return {
        cam: [
          K(0, 520, 1.78),
          K(tR - 6, 620, 1.61),
          K(t2, 1340, 1.67),
          K(tG + 2, 960, 1.12),
        ],
        world: (
          <g>
            <SouqStreet frame={frame} />
            <Incident frame={frame} grab={1} />
            <LightPool cx={340} cy={GROUND - 160} rx={420} ry={360} color={RED} opacity={0.55 * red} />
            <LightPool cx={1560} cy={GROUND - 160} rx={420} ry={360} color={GOLD} opacity={0.6 * gold} />
            <Figure x={340} y={GROUND + 6} scale={1.2} pose={pz(frame, [[0, "think"], [tR, "point"], [tR + 50, "cross"]])} look={hero} frame={frame} rim={red} rimColor={RED} />
            <Figure x={1560} y={GROUND + 6} scale={1.18} pose={pz(frame, [[0, "cross"], [tG, "nod"], [tG + 24, "talk"]])} look={LOOKS.woman} flip frame={frame + 11} rim={gold} />
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
    render: ({ frame, at }) => {
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
          <Incident frame={frame} grab={1} />
        </g>
      );
      return {
        cam: [
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
  "home-what-shapes-us": {
    nameAr: "البيت: تجاربنا ومخاوفنا ومن نحب وأفكارنا",
    place: "بيت بمكتبة وصور",
    render: ({ frame, at }) => {
      const tE = at("بتجاربنا", 0.15);
      const tF = at("ومخاوفنا", 0.38);
      const tP = at("والأشخاص", 0.55);
      const tI = at("والأفكار", 0.8);
      const fear = prog(frame, tF, tF + 20) * (1 - prog(frame, tP + 10, tP + 30));
      return {
        cam: [
          K(0, 960, 1.15),
          K(tE, 1100, 1.67),
          K(tF, 900, 1.21),
          K(tP, 520, 1.26),
          K(tI, 420, 1.55),
        ],
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
    render: ({ frame, at }) => {
      const tN = at("خبرا", 0.3);
      const tA = at("يؤكد", 0.6);
      const tR = at("رأينا", 0.85);
      const glow = prog(frame, tN - 4, tN + 10);
      return {
        cam: [
          K(0, 960, 1.5),
          K(tN - 6, 860, 1.95),
          K(tA + 10, 960, 1.44),
        ],
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
    render: ({ frame, at }) => {
      // الزميل يشير إلى ساق الكرسي القصيرة منذ أول المشهد؛ «نرفض» يلوّح البطل رافضًا،
      // و«نصيحة صحيحة» تقترب الكاميرا من الكرسي فيتأرجح فعلًا، و«لا نحبه» ينكفئ الزميل.
      const tR = at("نرفض", 0.12);
      const tA = at("صحيحة", 0.35);
      const tD = at("نحبه", 0.85);
      const wob = (from: number) => (frame > from ? Math.sin((frame - from) / 3) * 2.4 * Math.exp(-(frame - from) / 36) : 0);
      return {
        cam: [
          K(0, 1080, 1.15),
          K(tR, 1420, 1.67),
          K(tA, 1230, 1.78),
          K(tD, 1080, 1.24),
        ],
        world: (
          <g>
            <Workshop frame={frame} chairTilt={2.5 + wob(0) + wob(tA)} />
            <Figure x={880} y={GROUND + 8} scale={1.18} pose={pz(frame, [[0, "point"], [tR + 30, "talk"], [tA, "point"], [tD, "stand"], [tD + 20, "nod"]])} look={LOOKS.friend} frame={frame} />
            <Figure x={1580} y={GROUND + 8} scale={1.2} pose={pz(frame, [[0, "hold"], [tR, "wave-off"], [tR + 34, "turn-away"], [tD, "cross"]])} look={hero} flip={frame < tR + 34} frame={frame} />
          </g>
        ),
      };
    },
  },
  "home-defending-decision": {
    nameAr: "البيت: يدافع عن قراره لأن الاعتراف بالخطأ مؤلم",
    place: "بيت بمكتبة وصور",
    render: ({ frame, at }) => {
      const tD = at("ندافع", 0.1);
      const tQ = at("قرار", 0.2);
      const tE = at("الأدلة", 0.45);
      const tC = at("الاعتراف", 0.7);
      const tP = at("مؤلما", 0.88);
      const dim = prog(frame, tC, tC + 30);
      return {
        cam: [
          K(0, 900, 1.32),
          K(tQ, 1050, 1.72),
          K(tE, 860, 1.29),
          K(tC, 1060, 1.78),
          K(tP, 1060, 1.95),
        ],
        world: (
          <g>
            <HomeRoom frame={frame} mood="night" />
            <Chair x={1110} flip />
            <Figure x={620} y={GROUND + 8} scale={1.18} pose={pz(frame, [[0, "listen"], [tE - 10, "talk"], [tE + 30, "hold"], [tC, "stand"]])} look={LOOKS.elder} holding={frame > tE - 10 ? "book" : "none"} frame={frame + 5} />
            <Figure x={1090} y={frame > tP - 6 ? GROUND : GROUND + 8} scale={1.2} pose={pz(frame, [[0, "talk"], [tD, "point"], [tQ, "hold"], [tE + 8, "turn-away"], [tC, "cross"], [tP - 6, "sit-low"], [tP + 20, "head-down"]])} look={hero} flip holding={frame > tQ - 4 && frame < tC ? "paper" : "none"} frame={frame} />
            <rect x={-300} y={-300} width={2520} height={1500} fill="#000" opacity={0.25 * dim} />
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
    render: ({ frame, at }) => {
      const tS = at("يراه", 0.35);
      const tW = at("يتمنى", 0.65);
      const diverge = prog(frame, tW, tW + 26);
      const arrive = Math.min(46, Math.max(20, tS - 4));
      const walking = frame < arrive;
      const heroPose = walking ? walkPose(POSES.stand, (frame / 30) * Math.PI * 2 * 0.95) : pz(frame, [[arrive, "stand"], [tS, "point"], [tS + 40, "think"], [tW + 30, "listen"]]);
      const reflPose = diverge > 0.5 ? pz(frame, [[0, "stand"], [tW, "proud"]]) : heroPose;
      return {
        cam: [
          K(0, 700, 1.75),
          K(tS, 860, 1.5),
          K(tW, 1060, 1.67),
        ],
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
        cam: [
          K(0, 640, 1.72, -90),
          K(tO - 10, 820, 1.32, -90),
          K(tB, 1000, 1.49, -90),
          K(tU, 1010, 1.9, -90),
        ],
        world: (
          <g>
            <Rooftops frame={frame} mood="night" streetPeople />
            <Figure x={1400 - 390 * prog(frame, 0, 44, (t) => t)} y={GROUND + 40} scale={1.3} pose={frame < 44 ? walkPose(POSES.stand, (frame / 30) * Math.PI * 2 * 0.95) : pz(frame, [[44, "lean-rail"], [tO, "point"], [tO + 50, "lean-rail"], [tB, "stand"], [tB + 14, "sincere"]])} look={hero} flip={!turn} frame={frame} />
            <Birds frame={frame} start={tO + 10} y={160} n={5} />
            <RoofWall frame={frame} />
          </g>
        ),
      };
    },
  },
  "rooftop-dawn-fog": {
    nameAr: "السطح فجرًا: يراجع ما صدّقه وما رفضه، والضباب يخلط الحدود",
    place: "أسطح المدينة",
    render: ({ frame, dur, at }) => {
      const tB = at("نقتنع", 0.15);
      const tL = at("يعجبنا", 0.4);
      const tM = at("يختلط", 0.65);
      const tC = at("الواضحة", 0.92);
      const dawn = prog(frame, 0, Math.min(dur, tM + 40), (t) => t);
      return {
        cam: [
          K(0, 980, 1.72, -90),
          K(tB, 900, 1.6, -90),
          K(tL, 1000, 1.55, -90),
          K(tM, 960, 1.15, -90),
          K(tC, 960, 1.12, -90),
          K(Math.max(tC + 20, dur - 70), 1020, 0.98, -110),
        ],
        world: (
          <g>
            <Rooftops frame={frame} mood="predawn" to="dawn" t={dawn} fog={prog(frame, tM, tM + 50)} />
            <Birds frame={frame} start={Math.round(dur * 0.06)} y={260} n={8} color={darken(ID.night, 0.2)} />
            <Birds frame={frame} start={Math.round(dur * 0.62)} y={180} n={5} dir={1} color={darken(ID.night, 0.2)} />
            <Figure x={980 - 220 * prog(frame, tM - 10, tM + 60, (t) => t) + 260 * prog(frame, tC, dur, (t) => t)} y={GROUND + 40} scale={1.3} pose={(frame > tM - 10 && frame < tM + 60) || frame > tC ? walkPose(POSES.stand, (frame / 30) * Math.PI * 2 * 0.95) : pz(frame, [[0, "hold"], [tB + 20, "stand"], [tB + 50, "think"], [tL, "hold"], [tL + 40, "think"], [tL + 70, "hold"], [tM + 60, "look-up"]])} look={hero} flip={frame > tM - 10 && frame < tM + 60} holding={frame < tB + 20 ? "phone" : frame >= tL - 4 && frame < tM ? "paper" : "none"} frame={frame} rim={dawn} />
            <RoofWall frame={frame} />
          </g>
        ),
      };
    },
  },
};

export const SHOT_IDS = Object.keys(SHOTS);

/** الأماكن المرسومة بالمستوى الجديد (معرض «أماكن التصوير» في الاستوديو): ما يظهر هنا هو ما يُرندر */
export const RICH_SETS: { id: string; nameAr: string; render: (frame: number) => React.ReactNode }[] = [
  { id: "souq-street", nameAr: "سوق الحارة عصرًا: دكاكين بمظلات وشرفات مشربية وعربة فاكهة", render: (f) => <><SouqStreet frame={f} /><FruitCart x={820} /></> },
  { id: "tinted-lattice", nameAr: "مشربية بزجاج ملوّن تطل على السوق", render: (f) => <TintedLattice frame={f} tint={GOLD} tintAmount={0.6} outside={<g transform="translate(520 120) scale(0.46) translate(-200 -260)"><SouqStreet frame={f} /></g>} /> },
  { id: "home-room", nameAr: "البيت: مكتبة وصور وصندوق رسائل ونافذة الغروب", render: (f) => <HomeRoom frame={f} mood="dusk" /> },
  { id: "home-room-night", nameAr: "البيت ليلًا", render: (f) => <HomeRoom frame={f} mood="night" /> },
  { id: "cafe", nameAr: "مقهى الحارة: أقواس وفوانيس وروّاد وطاولة شاي", render: (f) => <><Cafe frame={f} /><Chair x={800} /><Chair x={1120} flip /><CafeTable x={960} frame={f} /></> },
  { id: "workshop", nameAr: "ورشة نجارة: لوح أدوات ومنضدة وكرسي قيد الصنع", render: (f) => <Workshop frame={f} chairTilt={2.5} /> },
  { id: "night-window", nameAr: "غرفة ليلًا بنافذة تعكس صاحبها", render: (f) => <NightWindow frame={f} /> },
  { id: "courtyard", nameAr: "صحن دار بنافورة ليلًا", render: (f) => <Courtyard frame={f} /> },
  { id: "rooftops-night", nameAr: "أسطح المدينة ليلًا والشارع في الأسفل", render: (f) => <><Rooftops frame={f} mood="night" streetPeople /><RoofWall frame={f} /></> },
  { id: "rooftops-dawn", nameAr: "أسطح المدينة فجرًا بالضباب", render: (f) => <><Rooftops frame={f} mood="predawn" to="dawn" t={0.8} fog={0.6} /><RoofWall frame={f} /></> },
];
void LightPool;
