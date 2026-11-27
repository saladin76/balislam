/**
 * «دفاتر الزمن 002 — ابنا آدم»: لقطات «خط الأفق» الجديدة كما في خطة المشاهد (scenes.md، D214).
 * لا تصوير لآدم عليه السلام ولا لابنيه ولا لأي إنسان بأي هيئة (لا وجه ولا يد ولا ظل ولا أثر قدم)، ولا دم ولا عنف:
 * الأخوان نقطتا حبر صغيرتان (رمز بانتظار اعتماد المالك)، والقصة بالحجرين والقربانين والتراب والغراب (بانتظار الاعتماد) والنص.
 * كل حدث على كلمته (cueKit)، والسكون عند كلمات الذكر بالزمن المرئي (reverent).
 */
import React from "react";
import { Lens } from "../lib/drawings";
import { DateRibbon } from "../horizon/book";
import {
  Arrow, C, CLAY, Cloth, Crow, DotFrame, Dot, EMBER, Feather, Field, GOLD_D, Globe, Grass, Horizon, Ink, Leaf, NEUTRAL, Q, Ring, Seal, Stone, Sun, Tab, Thread, Txt, Write, bounce, crackPath, cueKit, mix, prog, reverent, rng, type BdProps,
} from "./kit";

const GROUND = 640;

/** لطخة تراب بالحبر البني */
const Smudge: React.FC<{ x: number; y: number; q: number; s?: number }> = ({ x, y, q, s = 1 }) => {
  if (q <= 0) return null;
  const r = rng(21);
  return (
    <g opacity={q} transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-120 10 C-110 -30 -40 -44 10 -38 C70 -32 128 -18 124 12 C118 40 40 48 -20 44 C-80 40 -126 34 -120 10 Z" fill={CLAY} opacity={0.38} />
      {Array.from({ length: 26 }, (_, i) => (
        <circle key={i} cx={-110 + r() * 220} cy={-30 + r() * 66} r={1.5 + r() * 3} fill={CLAY} opacity={0.55} />
      ))}
    </g>
  );
};

// ─── c1-s1 / c1-s52: الريشة على التراب ───
const FeatherShot = reverent((q) => {
  // التحرير النهائي للمحرر (٢٧ نوفمبر): الافتتاح «في قصة ابني آدم عليه السلام، حفر طائرٌ في التراب. ماذا رأى فيه الرجل الذي قتل أخاه؟»
  // بدل «قبل أن يعرف الإنسان الكتابة، وقبل أن يبني أول بيت، تعلّم درسًا من طائر.» (حُذف الجزم بسبق الكتابة والبيت لغياب مستنده):
  // حُذف السطر الفارغ (كان على «الكتابة») والكوخ المنقّط (كان على «بيت»)؛ الريشة على «طائر» كما كانت، وخطوط النبش في التراب على «التراب»،
  // والكاميرا تقترب من التراب على «رأى»
  const k = cueKit(q, ["قصة", "الصامت"]);
  const { t, S } = k;
  const dig = S === 0 ? k.draw(0, "التراب", 1.0) : 1;
  const fall = S === 0 ? prog(t, k.at("طائر", 1.6) - 0.05, k.at("طائر", 1.6) + 1.6) : 1;
  const lens = S === 1 ? prog(t, k.at("وأبصر", 1.4) - 0.1, k.at("وأبصر", 1.4) + 1.4) : 0;
  const fx = 470 + Math.sin(fall * Math.PI * 2.2) * 50 * (1 - fall);
  const fy = mix(330, 712, fall);
  const close = { cx: 500, cy: 640, s: 2.3 };
  const cam =
    S === 0
      ? k.cam(close, [[0, "طائر", { cx: 520, cy: 610, s: 1.8 }, 1.4], [0, "رأى", { cx: 490, cy: 700, s: 2.25 }, 1.3]])
      : k.cam({ cx: 480, cy: 690, s: 2.2 }, [
          [1, "أضعف", NEUTRAL, 1.4],
          [1, "تواضع", { cx: 480, cy: 700, s: 1.9 }, 1.2],
        ]);
  const L = (
    <g>
      <Horizon y={GROUND + 120} p={1} sky="plain" texture={0.6} />
      <Smudge x={480} y={735} q={1} />
      {/* خطوط نبش قصيرة في لطخة التراب (حفر الطائر)، بلا حفرة ولا دفن مرسوم */}
      {["M430 730 q14 -10 30 -2", "M470 742 q16 -12 34 -3", "M512 728 q12 -9 26 -1"].map((d, i) => <Ink key={i} d={d} p={prog(dig, i * 0.25, i * 0.25 + 0.5)} w={3} c={C.ink} />)}
      <Feather x={fx} y={fy} s={0.5} q={S === 0 ? k.on(0, "طائر", 0.3) : 1} rot={mix(-60, -78, fall) + Math.sin(fall * 9) * 12 * (1 - fall)} />
      {lens > 0 ? (
        <g opacity={Math.min(1, lens * 4) * (1 - prog(lens, 0.85, 1))} transform={`translate(${mix(700, 300, lens)} ${700 - 20 * Math.sin(lens * Math.PI)}) scale(0.42)`}>
          <Lens />
        </g>
      ) : null}
    </g>
  );
  return <Leaf q={q} id="b2f" cam={cam} L={L} R={<Horizon y={GROUND + 120} p={1} sky="plain" texture={0.6} />} />;
});

// ─── c1-s2 / c1-s3: الخيط الأحمر على أرض السهل ───
const ThreadGround = reverent((q) => {
  const k = cueKit(q, ["الماضية", "نعقد"]);
  const { t, S } = k;
  const title = k.draw(0, "الماضية", 1.2);
  const thread = k.draw(0, "خيط", 1.4);
  const knot1 = k.on(0, "عقدته");
  const glow = S === 0 ? bounce(t, k.at("عقدته"), k.at("عقدته") + 1.6) : 0;
  const descend = k.draw(0, "هبوط", 0.9);
  const tawba = k.draw(0, "وتوبة", 0.8);
  const ring = k.on(1, "نعقد", 0.8);
  const house = k.draw(1, "بيت", 1.0);
  const cam = k.cam({ cx: 760, cy: 640, s: 1.6 }, [
    [0, "الماضية", NEUTRAL, 1.2],
    [0, "عقدته", { cx: 1420, cy: 560, s: 1.35 }, 1.1],
    [1, "نعقد", { cx: 760, cy: 580, s: 1.3 }, 1.1],
  ]);
  const both = (
    <g>
      <Horizon y={600} p={1} sky="plain" />
      <Thread x1={1760} x2={160} y={600} p={thread} knots={[
        { x: 1440, kind: "tied", q: knot1, glow, label: "١", lq: knot1 },
        { x: 720, kind: "ring", q: ring, tie: 0 },
      ]} />
      <path d="M1560 360 C1530 450 1480 520 1450 586" fill="none" stroke={C.inkSoft} strokeWidth={4} strokeDasharray="10 10" opacity={descend} />
    </g>
  );
  return (
    <Leaf q={q} id="b2tg" cam={cam}
      L={<g>{both}<Write id="b2tg-h" x={720} y={700} size={40} p={house} label="بيت آدم عليه السلام" font="tajawal" /></g>}
      R={<g>{both}
        <Write id="b2tg-t" x={1365} y={250} size={38} p={title} label="خلق آدم عليه السلام وبداية البشرية" font="tajawal" color={C.inkSoft} />
        <Write id="b2tg-w" x={1440} y={710} size={50} p={tawba} label="توبة" />
      </g>} />
  );
});

// ─── c1-s4..s6: في الزمن نفسه، عالم بلا أضواء ───
const WorldDark = reverent((q) => {
  const k = cueKit(q, ["العالم", "مدن", "ضوءا"]);
  const { t, S } = k;
  const globe = k.draw(0, "العالم", 1.4);
  const counter = k.on(0, "الأيام");
  const bound = k.draw(0, "حدود", 1.4);
  const cities = k.on(1, "مدن"), kings = k.on(1, "ممالك"), year = k.on(1, "سنة");
  const wash = k.draw(1, "الأرض", 1.2);
  const fam = k.draw(1, "أسرة", 0.8);
  const light = S === 2 ? bounce(t, k.at("ضوءا"), k.at("دليلا") + 0.2) : 0;
  const ctext = k.draw(2, "عداد", 0.9);
  const seal = k.on(2, "نعلم", 0.5);
  const cam = k.cam(NEUTRAL, [
    [0, "العالم", { cx: 620, cy: 520, s: 1.25 }, 1.4],
    [0, "حدود", { cx: 560, cy: 560, s: 1.15 }, 1.2],
    [1, "مدن", { cx: 1360, cy: 420, s: 1.3 }, 1.0],
    [1, "الأرض", { cx: 600, cy: 520, s: 1.2 }, 1.1],
    [2, "ضوءا", { cx: 620, cy: 480, s: 1.2 }, 1.0],
    [2, "عداد", { cx: 600, cy: 760, s: 1.35 }, 1.0],
  ]);
  const L = (
    <g>
      <Globe x={560} y={460} r={200} p={globe} spin={t} wash={wash} />
      <Ring x={560} y={460} r={240} p={bound} dash={bound >= 1} c={C.inkSoft} />
      <Ring x={600} y={430} r={22} p={fam} w={4} />
      {light > 0 ? <circle cx={mix(900, 640, light)} cy={mix(250, 380, light)} r={14} fill={C.gold} opacity={light} /> : null}
      <g opacity={counter}>
        <rect x={380} y={700} width={360} height={170} rx={10} fill={C.page} stroke={C.ink} strokeWidth={4} />
        <Write id="b2w-c" x={560} y={745} size={34} p={ctext} label="في هذه الحلقة:" font="tajawal" />
        <Seal x={560} y={815} q={seal} kind="لا نعلم" s={0.5} />
      </g>
    </g>
  );
  const R = (
    <g>
      <Field x={1640} y={300} label="مدن:" q={cities} w={220} />
      <Field x={1640} y={390} label="ممالك:" q={kings} w={220} />
      <DateRibbon x={1300} y={470} s={1.1} o={year} />
      <Txt x={1300} y={720} size={30} q={year} color={C.inkSoft}>سنة: —</Txt>
    </g>
  );
  return <Leaf q={q} id="b2w" cam={cam} L={L} R={R} />;
});

// ─── c1-s8: الخبر كما وقع ───
const Tell = reverent((q) => {
  const k = cueKit(q, ["يخبر"]);
  const name = k.draw(0, "محمدا", 0.9);
  const people = k.draw(0, "الناس", 1.0);
  const dots = k.on(0, "بخبرهما");
  const seal = k.on(0, "كما");
  const cam = k.cam(NEUTRAL, [[0, "الناس", { cx: 1200, cy: 520, s: 1.15 }, 1.2]]);
  return (
    <Leaf q={q} id="b2t" cam={cam}
      L={<g><Horizon y={GROUND} p={1} sky="plain" /><Dot x={560} y={GROUND - 12} q={dots} r={12} /><Dot x={640} y={GROUND - 12} q={dots} r={12} /></g>}
      R={<g>
        <Write id="b2t-n" x={1365} y={330} size={66} p={name} label="محمد ﷺ" />
        <Arrow d="M1560 450 H1100" p={people} hx={1100} hy={450} ang={180} />
        <Txt x={1340} y={520} size={40} q={people}>إلى الناس</Txt>
        <Seal x={1365} y={700} q={seal} kind="ثابت" s={0.7} />
      </g>} />
  );
});

/** الحجران والقربانان (مشترك بين المشاهد): الأيمن قُبل، والأيسر لم يُقبل */
const STONE_R = 1350;
const STONE_L = 570;
const Offerings: React.FC<{ stones: number; cloths: number; windL?: number; t: number; shadeR?: number; dim?: number }> = ({ stones, cloths, windL = 0, t, shadeR = 0.25, dim = 1 }) => (
  <g opacity={dim}>
    <Stone x={STONE_R} y={740} w={230} h={64} q={stones} shade={shadeR} />
    <Stone x={STONE_L} y={740} w={230} h={64} q={stones} />
    <Cloth x={STONE_R} y={706} q={cloths} />
    <Cloth x={STONE_L} y={706} q={cloths} wind={windL} t={t} />
  </g>
);

// ─── c1-s10..s12: الحجران والقربانان ───
const OfferingsShot = reverent((q) => {
  const k = cueKit(q, ["ابنان", "فتقبل", "كيف"]);
  const { t, S } = k;
  const apart = k.on(0, "ابنان", 0.9);
  const stones = k.on(0, "قرب", 0.6);
  const cloths = k.on(0, "قربانا", 0.6);
  const yes = k.draw(1, "فتقبل", 0.6);
  const no = k.draw(1, "يتقبل", 0.7);
  const qm = k.on(2, "كيف");
  const flashY = S === 2 ? bounce(t, k.at("قبل"), k.at("قبل") + 0.8) : 0;
  const flashN = S === 2 ? bounce(t, k.at("رد"), k.at("رد") + 0.8) : 0;
  const seal = k.on(2, "يذكر");
  const cam = k.cam(NEUTRAL, [
    [0, "قرب", { cx: 960, cy: 620, s: 1.08 }, 1.2],
    [1, "فتقبل", { cx: 1300, cy: 660, s: 1.35 }, 0.9],
    [1, "يتقبل", { cx: 620, cy: 660, s: 1.35 }, 1.0],
    [2, "كيف", { cx: 960, cy: 520, s: 1.05 }, 1.0],
  ]);
  const both = (
    <g>
      <Horizon y={600} p={1} sky="plain" />
      <Offerings stones={stones} cloths={cloths} t={t} />
      <Dot x={mix(1060, 1180, apart)} y={700} q={1} r={11} />
      <Dot x={mix(860, 740, apart)} y={700} q={1} r={11} />
      <g transform={`translate(${STONE_R} 812) scale(${1 + 0.25 * flashY})`}>
        <Ink d="M-26 0 L-8 18 L28 -20" p={yes} w={7} c={C.ink} />
      </g>
      <Ring x={STONE_L} y={812} r={22 * (1 + 0.25 * flashN)} p={no} w={5} />
      <Q x={1160} y={470} size={120} q={qm} />
      <Seal x={1160} y={330} q={seal} kind="لا نعلم" s={0.6} />
    </g>
  );
  return <Leaf q={q} id="b2o" cam={cam} L={both} R={both} />;
});

const GoldSealSmall: React.FC<{ x: number; y: number; q: number; label?: string }> = ({ x, y, q, label }) =>
  q <= 0 ? null : (
    <g opacity={q} transform={`translate(${x} ${y}) scale(${0.8 + 0.2 * q})`}>
      <circle r={36} fill={C.gold} stroke={C.ink} strokeWidth={2.5} />
      <circle r={28} fill="none" stroke={C.page} strokeWidth={1.5} strokeDasharray="3 5" />
      {label ? <Txt x={0} y={70} size={26} q={1} color={C.ink}>{label}</Txt> : null}
    </g>
  );

// ─── c1-s17..s19: القماش في الريح، والشق الذي وقف (نص المراجعة العلمية، الدفعة ٥) ───
const WindCloth = reverent((q) => {
  const k = cueKit(q, ["فهدد", "فأجابه", "فالمشكلة"]);
  const { t, S } = k;
  const wind = S === 0 ? k.on(0, "يتقبل", 0.8) : S === 1 ? 1 - k.on(1, "فأجابه", 1.0) : 0;
  const crack = S === 2 ? 1 - prog(t, k.at("فالمشكلة", 1.2) - 0.05, k.at("فالمشكلة", 1.2) + 1.2) : k.draw(0, "بالقتل", 1.2);
  const shade = 0.25 + 0.25 * k.on(1, "أخوه", 0.8);
  const taqwa = k.draw(1, "التقوى", 1.0);
  const notHere = S === 2 ? bounce(t, k.at("أخيه"), k.at("أخيه") + 1.1) : 0;
  const heart = k.draw(2, "قلبه", 0.8);
  const cam = k.cam(NEUTRAL, [
    [0, "يتقبل", { cx: 620, cy: 650, s: 1.3 }, 1.0],
    [0, "بالقتل", { cx: 800, cy: 700, s: 1.15 }, 1.0],
    [1, "أخوه", { cx: 1320, cy: 640, s: 1.3 }, 1.0],
    [2, "قلبه", { cx: 640, cy: 680, s: 1.35 }, 1.0],
  ]);
  const cr = crackPath(STONE_L + 110, 780, 960, 790, 31, 10, 12);
  const both = (
    <g>
      <Horizon y={600} p={1} sky="plain" />
      <Offerings stones={1} cloths={1} windL={wind} t={t} shadeR={shade} />
      <Ink d={cr} p={crack} w={5} c={C.ink} />
      <Ring x={STONE_R} y={790} r={70} p={notHere} dash c={C.inkSoft} />
      <Ring x={STONE_L + 110} y={780} r={26} p={heart} w={4} c={EMBER} />
    </g>
  );
  return <Leaf q={q} id="b2wc" cam={cam} L={both} R={<g>{both}<Write id="b2wc-t" x={STONE_R} y={560} size={54} p={taqwa} label="التقوى" /></g>} />;
});

// ─── c1-s21 / c1-s22: الخط الذي وقف ───
const HaltedStroke = reverent((q) => {
  const k = cueKit(q, ["الصالح", "ضعفا"]);
  const halo = k.on(0, "الصالح", 0.7);
  const line = k.draw(0, "يمد", 1.0);
  const bar = prog(line, 0.85, 1);
  const other = k.draw(0, "وإن", 1.0);
  const weak = k.draw(1, "ضعفا", 0.8);
  const under = k.draw(1, "ضعفا", 1.3);
  const why = k.draw(1, "علته", 0.8);
  const cam = k.cam(NEUTRAL, [
    [0, "الصالح", { cx: 1220, cy: 600, s: 1.3 }, 1.0],
    [0, "وإن", { cx: 960, cy: 600, s: 1.1 }, 1.0],
    [1, "ضعفا", { cx: 1200, cy: 420, s: 1.2 }, 1.0],
  ]);
  const both = (
    <g>
      <Horizon y={640} p={1} sky="plain" texture={0.5} />
      <Ring x={1260} y={620} r={34} p={halo} fill={C.gold} fillO={0.35} c={GOLD_D} />
      <Dot x={1260} y={620} q={1} r={12} />
      <Dot x={660} y={620} q={1} r={12} />
      <Ink d="M1236 620 H1060" p={line} w={5} />
      <path d="M1052 590 V650" stroke={C.ink} strokeWidth={7} strokeLinecap="round" opacity={bar} />
      <path d="M684 620 H900" fill="none" stroke={C.inkSoft} strokeWidth={4} strokeDasharray="12 10" opacity={other} />
    </g>
  );
  return (
    <Leaf q={q} id="b2h" cam={cam} L={both}
      R={<g>{both}
        <Write id="b2h-w" x={1300} y={380} size={56} p={weak} label="ليس ضعفًا" />
        <Ink d="M1440 410 H1160" p={under} w={4} c={C.ink} />
        <Arrow d="M1052 580 C1060 520 1100 480 1150 470" p={why} hx={1150} hy={470} ang={-10} />
        <Txt x={1230} y={480} size={34} q={why} color={C.inkSoft}>علّته:</Txt>
      </g>} />
  );
});

/** حزمة إثم: كيس حبر مربوط */
const Load: React.FC<{ x: number; y: number; q: number }> = ({ x, y, q }) =>
  q <= 0 ? null : (
    <g opacity={Math.min(1, q * 1.4)} transform={`translate(${x} ${y - (1 - q) * 40})`}>
      <path d="M-56 0 C-62 -60 -30 -90 0 -92 C30 -90 62 -60 56 0 C40 14 -40 14 -56 0 Z" fill="#5A4636" stroke={C.ink} strokeWidth={4} />
      <path d="M-18 -92 C-8 -110 8 -110 18 -92" fill="none" stroke={C.ink} strokeWidth={4} />
    </g>
  );

// ─── c1-s23: حِملان على ظهر واحد ───
const TwoLoads = reverent((q) => {
  const k = cueKit(q, ["إثمه"]);
  const ref = k.on(0, "الآية");
  const l1 = k.on(0, "إثمه", 0.6), l2 = k.on(0, "وإثم", 0.6);
  const tie = k.draw(0, "معا", 0.8);
  const sag = 26 * tie;
  const nar = k.on(0, "النار");
  const cam = k.cam(NEUTRAL, [[0, "إثمه", { cx: 1370, cy: 560, s: 1.3 }, 1.2]]);
  const R = (
    <g>
      <GoldSealSmall x={1640} y={250} q={ref} label="المائدة ٢٩" />
      <g transform={`translate(0 ${sag})`}>
        <Load x={1430} y={600} q={l1} />
        <Load x={1300} y={600} q={l2} />
        <Ink d="M1490 560 C1420 590 1310 590 1240 560" p={tie} w={5} c={CLAY} />
      </g>
      <path d={`M1600 ${620} Q1365 ${620 + 2 * sag} 1130 620`} fill="none" stroke={C.ink} strokeWidth={6} />
      <Txt x={1365} y={780} size={44} q={nar} color={C.inkSoft}>النار</Txt>
    </g>
  );
  return <Leaf q={q} id="b2l" cam={cam} R={R} />;
});

// ─── c1-s25 / c1-s26: سهل الغروب ───
const DuskPlain = reverent((q) => {
  const k = cueKit(q, ["الكلام", "تهون"]);
  const { t, S } = k;
  const ghost = S === 0 ? bounce(t, k.at("الكلام"), k.at("الكلام") + 1.8) : 0;
  const wind = S === 0 ? k.on(0, "النفس", 0.8) : 1;
  const short = S === 1 ? bounce(t, k.at("تهون"), k.at("تهون") + 1.2) : 0;
  const steps = ["خطوة", "بعد", "خطوة#2", "حتى", "استجاب", "لها"].map((w) => (S === 1 ? k.on(1, w, 0.3) : 0));
  const set = S === 1 ? prog(t, k.at("استجاب", 1.4) - 0.05, k.at("استجاب", 1.4) + 1.4) : 0;
  const cam = k.cam(NEUTRAL, [
    [0, "النفس", { cx: 700, cy: 600, s: 1.15 }, 1.2],
    [1, "خطوة", { cx: 1100, cy: 640, s: 1.1 }, 1.6],
    [1, "استجاب", { cx: 1500, cy: 560, s: 1.2 }, 1.2],
  ]);
  const shadowL = 220 * (1 - 0.6 * short);
  const both = (
    <g>
      <Horizon y={600} p={1} sky="dusk" dim={0.4 + 0.6 * set} />
      <Sun x={1500} y={560} r={44} q={1} set={set} line={600} />
      <path d={`M640 640 L${640 + shadowL} 652 L${640 + shadowL} 664 L620 658 Z`} fill="#2B1E14" opacity={0.3} />
      <Stone x={560} y={650} w={200} h={110} q={1} fill="#A99C86" />
      <Grass x={360} y={640} q={1} t={t} wind={wind} seed={4} />
      <Grass x={1120} y={700} q={1} t={t} wind={wind} seed={6} n={7} />
      <Grass x={1650} y={660} q={1} t={t} wind={wind} seed={9} n={6} />
      {steps.map((s, i) => (
        <path key={i} d={`M${1560 - i * 150} 720 h-60`} stroke={C.ink} strokeWidth={6} strokeLinecap="round" opacity={s} />
      ))}
    </g>
  );
  return <Leaf q={q} id="b2d" cam={cam} L={both} R={<g>{both}<Txt x={1620} y={230} size={40} q={ghost} color={C.inkSoft} font="amiri">التقوى</Txt></g>} />;
});

// ─── c1-s28 / c1-s30: الصخرة والظل الطويل («كيف قتله» إطار فارغ بختم «لا نعلم»، الدفعة ٥) ───
const LongShadow = reverent((q) => {
  const k = cueKit(q, ["وقعت", "يقينا"]);
  const fall = k.on(0, "وقعت", 1.4);
  const frame = k.draw(0, "كيف", 0.8);
  const unk = k.on(0, "نعلم");
  const seal = k.on(1, "يقينا");
  const lost = k.draw(1, "خسر", 0.8);
  const edge = k.on(1, "عظيمة", 1.2);
  const reach = 1100 + 500 * fall + 160 * edge;
  const cam = k.cam(NEUTRAL, [
    [0, "وقعت", { cx: 900, cy: 620, s: 1.05 }, 1.4],
    [0, "كيف", { cx: 1365, cy: 440, s: 1.25 }, 1.0],
    [1, "خسر", { cx: 1365, cy: 560, s: 1.2 }, 1.0],
    [1, "عظيمة", NEUTRAL, 1.2],
  ]);
  const both = (
    <g>
      <Horizon y={600} p={1} sky="dusk" dim={0.6 + 0.4 * fall} />
      <path d={`M640 650 L${reach} 676 L${reach} 700 L620 668 Z`} fill="#2B1E14" opacity={0.36} />
      <Stone x={560} y={650} w={200} h={110} q={1} fill="#A99C86" />
    </g>
  );
  return (
    <Leaf q={q} id="b2ls" cam={cam} L={both}
      R={<g>{both}
        <DotFrame x={1365} y={420} w={360} h={220} q={frame} />
        <Seal x={1365} y={420} q={unk} kind="لا نعلم" s={0.55} />
        <Seal x={1600} y={240} q={seal} kind="ثابت" s={0.5} />
        <Txt x={1600} y={300} size={26} q={seal} color={C.ink}>المائدة ٣٠</Txt>
        <Write id="b2ls-k" x={1300} y={590} size={58} p={lost} label="خسر" />
      </g>} />
  );
});

/** كتاب مفتوح على صفحة فارغة */
const OpenBook: React.FC<{ x: number; y: number; q: number; s?: number }> = ({ x, y, q, s = 1 }) =>
  q <= 0 ? null : (
    <g opacity={q} transform={`translate(${x} ${y}) scale(${s * (0.8 + 0.2 * q)})`}>
      <path d="M0 -10 C-60 -30 -150 -30 -200 -14 V120 C-150 104 -60 104 0 124 Z" fill={C.page} stroke={C.ink} strokeWidth={4} />
      <path d="M0 -10 C60 -30 150 -30 200 -14 V120 C150 104 60 104 0 124 Z" fill={C.page} stroke={C.ink} strokeWidth={4} />
      <path d="M0 -10 V124" stroke={C.ink} strokeWidth={3} />
    </g>
  );

// ─── c1-s31: صحيح مسلم (تمهيد الحديث؛ مسلم ١٦٧٧ وحده بعد المراجعة العلمية، الدفعة ٥ البند ١٠٤) ───
const HadithLead = reverent((q) => {
  const k = cueKit(q, ["صحيح"]);
  const book = k.on(0, "صحيح", 0.6);
  const tab = k.on(0, "مسلم", 0.5);
  const name = k.draw(0, "عن", 0.9);
  const open = k.on(0, "النبي", 0.6);
  const cam = k.cam(NEUTRAL, [[0, "صحيح", { cx: 1365, cy: 480, s: 1.2 }, 1.2]]);
  return (
    <Leaf q={q} id="b2hl" cam={cam}
      R={<g>
        <g opacity={book * (1 - open)} transform={`translate(1365 560) scale(${0.85 + 0.15 * book})`}>
          <rect x={-150} y={-100} width={300} height={200} rx={10} fill="#8A5A3C" stroke={C.ink} strokeWidth={4} />
          <rect x={-130} y={-80} width={260} height={160} rx={6} fill="none" stroke={GOLD_D} strokeWidth={2} />
        </g>
        <Tab x={1560} y={440} q={tab} label="صحيح مسلم ١٦٧٧" />
        <Write id="b2hl-n" x={1365} y={240} size={34} p={name} label="عبد الله بن مسعود رضي الله عنه" font="tajawal" color={C.inkSoft} />
        <OpenBook x={1365} y={500} q={open} s={0.9} />
      </g>} />
  );
});

// ─── c1-s34: العلامة الأولى (جملة «أول نفس تُقتل ظلمًا» حُذفت في المراجعة العلمية، الدفعة ٥؛ c1-s33 «الكِفل» بالكلمة) ───
const MARKS = [1250, 1100, 940, 800, 660, 520, 380, 250];
const FirstMark = reverent((q) => {
  const k = cueKit(q, ["اللحظة"]);
  const { t } = k;
  const mark = k.on(0, "اللحظة", 0.6);
  const pulse = bounce(t, k.at("أول"), k.at("أول") + 0.9);
  const many = prog(t, k.at("كل") - 0.05, k.end("يسفك") + 0.3);
  const zulm = k.draw(0, "ظلما", 0.8);
  const back = prog(t, k.at("يعود") - 0.05, k.end("نصيب"));
  const sann = k.draw(0, "سن", 0.8);
  const ground = k.open(0, 1.0);
  const cam = k.cam({ cx: 1300, cy: 600, s: 1.3 }, [
    [0, "كل", { cx: 860, cy: 600, s: 1.05 }, 1.6],
    [0, "نصيب", { cx: 1260, cy: 600, s: 1.2 }, 1.0],
  ]);
  const both = (
    <g>
      <Ink d="M1700 640 H1400" p={1} w={4} />
      <Ink d="M1400 640 H160" p={ground} w={4} />
      <Thread x1={1760} x2={160} y={800} p={1} knots={[{ x: 1500, kind: "ring", q: 1, tie: 0 }]} w={4} />
      <g transform={`translate(1400 640) scale(${1 + 0.3 * pulse})`} opacity={mark}>
        <path d="M0 -30 V30" stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
        <Txt x={0} y={-50} size={48} q={1} font="amiri">١</Txt>
      </g>
      {MARKS.map((x, i) => {
        const m = prog(many, i / MARKS.length, (i + 1) / MARKS.length);
        const b = prog(back, i / MARKS.length * 0.6, i / MARKS.length * 0.6 + 0.4);
        return (
          <g key={i}>
            <path d={`M${x} 622 V658`} stroke={C.ink} strokeWidth={4} strokeLinecap="round" opacity={m} />
            <Ink d={`M${x} 618 Q${(x + 1400) / 2} ${560 - (1400 - x) * 0.12} 1400 610`} p={b} w={1.8} c={EMBER} />
          </g>
        );
      })}
    </g>
  );
  return (
    <Leaf q={q} id="b2fm" cam={cam} L={both}
      R={<g>{both}
        <Write id="b2fm-z" x={1400} y={720} size={46} p={zulm} label="ظلمًا" />
        <Write id="b2fm-s" x={1400} y={500} size={44} p={sann} label="أول من سنّ" font="tajawal" />
      </g>} />
  );
});

// ─── c1-s35 / c1-s36: أرض لم تُحفر ───
const BareGround: React.FC = () => <Horizon y={520} p={1} sky="morning" ground="#CDB892" texture={0.4} />;
const BareEarth = reverent((q) => {
  // مراجعة المتخصص (الدفعة ٥): حُذفت جملة «لم يكن على الأرض قبر بعد» (c1-s36) فلا كوم منقّط
  const k = cueKit(q, ["وقف"]);
  const qm = k.on(0, "يدري");
  const cam = k.cam(NEUTRAL, [[0, "وقف", { cx: 520, cy: 660, s: 1.5 }, 1.2]]);
  return (
    <Leaf q={q} id="b2be" cam={cam} R={<BareGround />}
      L={<g><BareGround />
        <Dot x={440} y={710} q={1} r={12} />
        <Q x={500} y={640} size={80} q={qm} />
      </g>} />
  );
});

// ─── c1-s37 / c1-s38 / c1-s40: الغراب يحفر (نص المراجعة العلمية، الدفعة ٥: بلا «منقار ومخالب»، ولا دفن بعده) ───
const CrowShot = reverent((q) => {
  const k = cueKit(q, ["فأرسل", "يحفر", "فتساءل"]);
  const { t, S } = k;
  const land = S === 0 ? prog(t, k.at("غرابا", 1.6) - 0.05, k.at("غرابا", 1.6) + 1.6) : 1;
  const away = S === 2 ? prog(t, k.at("فتساءل", 1.4) - 0.05, k.at("فتساءل", 1.4) + 1.4) : 0;
  const scratch = k.draw(1, "يحفر", 1.0);
  const beak = S === 1 ? bounce(t, k.at("التراب"), k.at("التراب") + 0.8) : 0;
  const claw = S === 1 ? bounce(t, k.at("التراب") + 0.35, k.at("التراب") + 1.15) : 0;
  const toward = k.draw(1, "ليريه", 1.0);
  const cover = k.draw(1, "يستر", 1.2);
  const feather = S === 2 ? prog(t, k.at("الغراب", 1.4) - 0.05, k.at("الغراب", 1.4) + 1.4) : 0;
  const nadam = k.draw(2, "الندم", 0.9);
  const seal = k.on(2, "الندم", 0.6);
  const bob = S === 1 ? (Math.sin(t * 6) + 1) / 2 : 0;
  const cx = S === 2 ? mix(720, 120, away) : mix(1500, 720, land);
  const cy = S === 2 ? mix(720, 160, away) : mix(200, 720, land);
  const pose = S === 2 ? (away > 0.02 ? "fly" : "stand") : land < 1 ? "fly" : S === 1 ? "peck" : "stand";
  const cam = k.cam(NEUTRAL, [
    [0, "غرابا", { cx: 760, cy: 640, s: 1.25 }, 1.6],
    [1, "يحفر", { cx: 620, cy: 700, s: 1.5 }, 1.0],
    [2, "عجز", { cx: 600, cy: 700, s: 1.4 }, 1.0],
    [2, "الندم", NEUTRAL, 1.2],
  ]);
  const r = rng(40);
  const L = (
    <g>
      <BareGround />
      <Dot x={360} y={710} q={1} r={12} />
      {Array.from({ length: 7 }, (_, i) => (
        <Ink key={i} d={`M${610 - i * 9} ${700 + (i % 3) * 8} l${-30 - (i % 2) * 14} ${6 + (i % 3) * 3}`} p={prog(scratch, i / 8, i / 8 + 0.35)} w={2.6} />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <circle key={i} cx={600 - r() * 50} cy={690 - r() * 40 * beak} r={3} fill={CLAY} opacity={beak} />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <circle key={i} cx={640 + r() * 40 * claw} cy={705 - r() * 26} r={3} fill={CLAY} opacity={claw} />
      ))}
      {[0, 1, 2].map((i) => <Ink key={i} d={`M${540 - i * 6} ${706 + i * 8} L${420 + i * 4} ${712 + i * 3}`} p={toward} w={2} c={C.inkSoft} />)}
      <ellipse cx={500} cy={716} rx={40} ry={9} fill="#4A3020" opacity={0.45 * (1 - cover)} />
      <ellipse cx={500} cy={714} rx={40 * cover} ry={8 * cover} fill={CLAY} opacity={0.6 * cover} />
      <Feather x={660} y={mix(380, 716, feather)} s={0.32} q={feather} rot={-76} />
      {S < 2 || away < 1 ? <Crow x={cx} y={cy} s={0.85} q={1} pose={pose} bob={bob} flap={(Math.sin(t * 9) + 1) / 2} /> : null}
      <Write id="b2c-n" x={620} y={560} size={60} p={nadam} label="الندم" />
    </g>
  );
  return <Leaf q={q} id="b2c" cam={cam} L={L} R={<g><BareGround /><Seal x={1365} y={420} q={seal} kind="ثابت" s={0.55} /><Txt x={1365} y={480} size={28} q={seal} color={C.ink}>المائدة ٣١</Txt></g>} />;
});

// ─── c1-s46: ثلاثة أختام في صف ───
const ThreeSeals = reverent((q) => {
  const k = cueKit(q, ["الفرق"]);
  const head = k.draw(0, "الفرق", 0.9);
  const s = [k.on(0, "يثبت", 0.5), k.on(0, "يروى", 0.5), k.on(0, "نسبته", 0.5)];
  const cam = k.cam(NEUTRAL, [[0, "يثبت", { cx: 1200, cy: 520, s: 1.1 }, 1.2]]);
  const ROW = [[1560, "ثابت", "خبر يثبت"], [1200, "رواية", "خبر يُروى"], [820, "لا يصح", "لا تصح نسبته"]] as const;
  const row = (
    <g>
      {ROW.map(([x, kind, lab], i) => (
        <g key={i}>
          <Seal x={x} y={520} q={s[i]!} kind={kind} s={0.7} />
          <Txt x={x} y={640} size={38} q={s[i]!} color={C.inkSoft}>{lab}</Txt>
        </g>
      ))}
    </g>
  );
  return <Leaf q={q} id="b2ts" cam={cam} L={row} R={<g>{row}<Write id="b2ts-h" x={1365} y={220} size={54} p={head} label="الفرق" color={C.inkSoft} /></g>} />;
});

// ─── c1-s47 / c1-s53 / c1-s54 (جملة الوصل، دفعة المحرر ١، ٢٧ نوفمبر): العقدة الثانية تُشد، ثم حلقة الثالثة فارغة (يعقدها الجزء الثاني في bd03-thread-night) ───
const ThreadKnot = reverent((q) => {
  const k = cueKit(q, ["بقي", "ومضت", "الأجيال"]);
  const { t, S } = k;
  const tie2 = k.on(0, "بقي", 0.8);
  const name2 = k.draw(0, "بقي", 1.0);
  const ext = S === 1 ? prog(t, k.at("ومضت") - 0.05, k.end("الأيام") + 0.6) : S > 1 ? 1 : 0;
  const many = S === 1 ? prog(t, k.at("وكثر") - 0.05, k.end("وأحفاده") + 0.3) : S > 1 ? 1 : 0;
  // دفعة المحرر ١، ٢٧ نوفمبر: صارت المرحلة الثالثة جملة الوصل «ومن قصة الأخوين ننتقل إلى خبر الأجيال الأولى…» بدل «فكيف عاشت تلك الأجيال الأولى؟…»؛
  // حلقة العقدة الثالثة على «الأجيال» كما كانت، وحُذفت خانتا «ثابت» و«رواية» (كانتا على «نعلمه» و«رواية» المحذوفتين)
  const ring3 = k.on(2, "الأجيال", 0.7);
  const r = rng(52);
  // النقاط بعيدة عن الخيط وعن أسماء العقد تحته
  const dots = Array.from({ length: 26 }, () => [mix(1100, 220, r()), 560 + (r() > 0.35 ? -1 : 1) * (110 + r() * 150)] as const).map(([x, y]) => [x, y > 560 ? y + 60 : y] as const);
  const cam = k.cam({ cx: 1300, cy: 560, s: 1.35 }, [
    [1, "ومضت", { cx: 860, cy: 560, s: 1.05 }, 1.4],
    [2, "الأجيال", { cx: 560, cy: 520, s: 1.3 }, 1.0],
  ]);
  const both = (
    <g>
      <Thread x1={1760} x2={160} y={560} p={mix(0.42, 1, ext)} knots={[
        { x: 1620, kind: "tied", q: 1, label: "خلق آدم", lq: 1 },
        { x: 1240, kind: "ring", q: 1, tie: tie2, label: "ابنا آدم", lq: name2 },
        { x: 520, kind: "ring", q: ring3, tie: 0, mark: ring3 },
      ]} />
      {dots.map(([x, y], i) => <Dot key={i} x={x} y={y} r={6} q={prog(many, i / dots.length, i / dots.length + 0.15)} />)}
    </g>
  );
  return (
    <Leaf q={q} id="b2k" cam={cam} L={both} R={both} />
  );
});

// ─── c1-s48 / c1-s49: الشق الذي يكبر، والطريق المفتوح ───
const CrackGrows = reverent((q) => {
  const k = cueKit(q, ["الحسد", "الطريق"]);
  const { t, S } = k;
  const dot = k.on(0, "صغير");
  const off = k.on(0, "قربان");
  const grow = S === 0 ? prog(t, k.at("يكبر") - 0.05, k.end("قتلا") + 0.2) : 1;
  const widen = S === 0 ? prog(t, k.at("يكبر"), k.last + 2) * 0.6 : 0.6 + 0.4 * (S === 1 ? prog(t, 0, k.at("ليصلح")) : 1);
  const road = k.draw(1, "الطريق", 1.0);
  const open = k.draw(1, "مفتوحا", 1.2);
  const taqwa = k.on(1, "التقوى", 0.7);
  const cam = k.cam({ cx: 700, cy: 560, s: 1.4 }, [
    [0, "يكبر", { cx: 520, cy: 560, s: 1.05 }, 1.6],
    [1, "الطريق", NEUTRAL, 1.0],
    [1, "التقوى", { cx: 1300, cy: 460, s: 1.25 }, 1.0],
  ]);
  const cr = crackPath(700, 560, 170, 610, 61, 12, 18);
  const L = (
    <g>
      <Horizon y={440} p={1} sky="plain" texture={0.3} />
      <Ink d={cr} p={grow} w={4 + 10 * widen} c="#3A281C" />
      <Ink d={cr} p={grow} w={2} c={C.page} opacity={0.5 * widen} />
      <Dot x={700} y={560} q={dot} r={12} />
      <g transform="translate(760 590) scale(0.45)"><Cloth x={0} y={0} q={off} /></g>
    </g>
  );
  const R = (
    <g>
      <Horizon y={440} p={1} sky="plain" texture={0.3} />
      <Ink d="M1200 900 L1290 440" p={road} w={5} />
      <Ink d="M1420 900 L1310 440" p={road} w={5} />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M${1310 - i * 4} ${840 - i * 110} v-36`} stroke={C.gold} strokeWidth={5} opacity={prog(open, i / 4, i / 4 + 0.3)} />)}
      <Txt x={1300} y={410} size={50} q={taqwa} font="amiri" color={GOLD_D}>التقوى</Txt>
    </g>
  );
  return <Leaf q={q} id="b2cg" cam={cam} L={L} R={R} />;
});

// ─── c1-s51: نفس واحدة والبشر كلهم (نص المراجعة العلمية، الدفعة ٥: ما كُتب على بني إسرائيل) ───
const OneAndAll = reverent((q) => {
  const k = cueKit(q, ["قيمة"]);
  const { t } = k;
  const one = k.on(0, "النفس", 0.6);
  const halo = k.draw(0, "عظيمة", 0.9);
  const mark = k.on(0, "القصة");
  const pulse = bounce(t, k.at("نفس"), k.at("نفس") + 0.9);
  const all = prog(t, k.at("البشر") - 0.05, k.end("كلهم") + 0.8);
  const save = k.draw(0, "وإحياءها", 0.9);
  const warm = prog(t, k.at("كإحياء") - 0.05, k.at("كإحياء") + 0.8);
  const r = rng(77);
  const dots = Array.from({ length: 60 }, () => [mix(1740, 180, r()), 560 + (r() - 0.5) * 300] as const).filter(([x, y]) => Math.hypot(x - 1180, y - 500) > 110);
  const cam = k.cam({ cx: 1180, cy: 500, s: 1.5 }, [[0, "البشر", NEUTRAL, 1.6]]);
  const both = (
    <g>
      {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={7 * prog(all, i / dots.length * 0.7, i / dots.length * 0.7 + 0.3)} fill={warm > 0 ? (i % 2 ? GOLD_D : C.ember) : C.ink} opacity={0.85} />)}
    </g>
  );
  return (
    <Leaf q={q} id="b2oa" cam={cam} L={both}
      R={<g>{both}
        <Ring x={1180} y={500} r={52} p={halo} c={C.ink} />
        <Ring x={1180} y={500} r={78} p={save} c={C.ember} w={6} fill={C.ember} fillO={0.15} />
        <g transform={`translate(1180 500) scale(${1 + 0.4 * pulse})`}><Dot x={0} y={0} q={one} r={16} /></g>
        <g opacity={mark}><path d="M1560 680 V730" stroke={C.ink} strokeWidth={6} strokeLinecap="round" /><Txt x={1560} y={660} size={40} q={1} font="amiri">١</Txt></g>
      </g>} />
  );
});

export const BD02_SCENES: Record<string, React.FC<BdProps>> = {
  "bd02-feather": FeatherShot,
  "bd02-thread-ground": ThreadGround,
  "bd02-world-dark": WorldDark,
  "bd02-tell": Tell,
  "bd02-offerings": OfferingsShot,
  "bd02-wind-cloth": WindCloth,
  "bd02-halted-stroke": HaltedStroke,
  "bd02-two-loads": TwoLoads,
  "bd02-dusk-plain": DuskPlain,
  "bd02-long-shadow": LongShadow,
  "bd02-hadith-lead": HadithLead,
  "bd02-first-mark": FirstMark,
  "bd02-bare-earth": BareEarth,
  "bd02-crow": CrowShot,
  "bd02-three-seals": ThreeSeals,
  "bd02-thread-knot": ThreadKnot,
  "bd02-crack-grows": CrackGrows,
  "bd02-one-and-all": OneAndAll,
};

/** مشهد الصورة الثابتة للمراجعة لكل لقطة (المعرّف في الخطة)؛ الغائب = آخر مشهد يستعمل اللقطة، عند نهاية آخر كلمة */
export const BD02_STILLS: Record<string, string> = { "bd02-crow": "c1-s38" };
