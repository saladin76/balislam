import React from "react";
import { ID, darken, mix } from "../palette";
import { Figure, LOOKS, POSES, walkPose, type FigureLook, type PoseName } from "../Figure";
import { GROUND, Glow, useSvgId } from "../world";
import { LightPool } from "../texture";
import { SouqStreet, FruitCart } from "./street";
import { HomeRoom, Cafe, CafeTable, Chair, Workshop, TintedLattice, NightWindow } from "./interior";
import { Courtyard, Rooftops, RoofWall } from "./outdoor";
import { Birds, K, Rolling, Turn, Walker, prog, pz, turnSx, type CamKey, type ShotCtx } from "./kit";
import { BuzzArcs, PhonePOV } from "./phone";

/**
 * اللقطات المصمَّمة: كل لقطة تحكي جملتها بمكانها وشخوصها وكاميرتها، وأحداثها تقع لحظة نطق كلماتها.
 * تُختار في الخطة بحقل shot في قالب «حكايات الحارة»، وتظهر في مكتبة الاستوديو.
 * الفصل الأول من الحلقة 001 قصة واحدة متصلة: حادثة في السوق يحكم عليها شاهدان بحكمين،
 * ثم البطل نفسه في يومه: ما يؤثر فيه، وخبر يصدقه، ونصيحة يرفضها، وقرار يدافع عنه، حتى فجر يراجع فيه نفسه.
 */
/** overlay: طبقة بإحداثيات الشاشة فوق المشهد (لقطة «بعين البطل») */
export type Shot = { cam: CamKey[]; world: React.ReactNode; tint?: string; tintOpacity?: number; overlay?: React.ReactNode };
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
          <Incident frame={frame} {...AFTER} fallAt={AFTER.grab + 2} />
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
