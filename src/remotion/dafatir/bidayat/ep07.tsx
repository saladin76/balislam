/**
 * «دفاتر الزمن 007 — الطوفان»: لقطات «خط الأفق» الجديدة كما في خطة المشاهد (scenes.md، D214).
 * لا تصوير لنوح عليه السلام ولا لابنه ولا لأحد ممن ركب أو غرق، ولا وجوه ولا أيدٍ ولا أجساد في الماء:
 * القصة بالأرض المتشققة وخط الماء الصاعد ثم الهابط، والجبل، والسفينة نقطةً أو هيكلًا بخط واحد، والنص.
 * «زوجين» علامتان مجردتان متقابلتان (بانتظار اعتماد المالك). كل حدث على كلمته (cueKit)، والسكون عند الذكر (reverent).
 */
import React from "react";
import { Hatch } from "../lib/drawings";
import { QuranSeal } from "../horizon/book";
import {
  BlankLine, C, GOLD_D, GoldSeal, Grass, Horizon, Ink, Leaf, NEUTRAL, Peak, Q, Rain, Ring, Seal, Sheet, Slip, Tab, Thread, Txt, WATER, Waterline, Write,
  bounce, crackPath, cueKit, mix, prog, reverent, rng, type BdProps, type KnotDef,
} from "./kit";

// ───────────────────────── عناصر الحلقة ─────────────────────────

/** طين باهت من أعلى على الصفحتين (wet يُغمقه بالبلل) */
const Clay: React.FC<{ o?: number; wet?: number }> = ({ o = 1, wet = 0 }) => (
  <g opacity={o}>
    <rect x={140} y={60} width={1640} height={920} fill={wet > 0 ? "#9C7A5C" : "#C7A27E"} opacity={0.32 + 0.18 * wet} />
    {Array.from({ length: 40 }, (_, i) => {
      const r = rng(70 + i);
      return <circle key={i} cx={180 + r() * 1560} cy={110 + r() * 780} r={1.5 + r() * 2.5} fill="#8A5A3C" opacity={0.3} />;
    })}
  </g>
);

/** الشقوق: خطوط رئيسة وفروع (ثابتة بالبذور) */
const CR: [number, number, number, number][] = [
  [1700, 210, 1260, 520],
  [1260, 520, 1060, 860],
  [1260, 520, 1640, 840],
  [1480, 150, 1360, 400],
  [1080, 170, 1260, 520],
  [880, 170, 640, 450],
  [640, 450, 230, 300],
  [640, 450, 470, 860],
  [640, 450, 900, 720],
  [280, 700, 470, 860],
  [900, 720, 1060, 860],
  [1700, 600, 1520, 690],
];
const CRACKS = CR.map(([a, b, c, d], i) => crackPath(a, b, c, d, 100 + i * 7, 9, 12));
/** الشق الذي يخرج منه أول خيط ماء (اليمنى)، وشق الصفحة اليسرى */
const FIRST = 1;
const SECOND = 7;

const Cracks: React.FC<{ p: number; w?: number; c?: string; o?: number }> = ({ p, w = 4, c = "#3A281C", o = 1 }) => (
  <g opacity={o}>
    {CRACKS.map((d, i) => (
      <Ink key={i} d={d} p={prog(p, (i % 6) * 0.08, (i % 6) * 0.08 + 0.55)} w={w * (i < 9 ? 1 : 0.7)} c={c} />
    ))}
  </g>
);

/** خيط ماء في شق: p رسمه، والماء أزرق */
const WaterIn: React.FC<{ i: number; p: number; w?: number }> = ({ i, p, w = 5 }) => (p <= 0 ? null : <Ink d={CRACKS[i]!} p={p} w={w} c={WATER} />);

/** السفينة هيكلًا بخط واحد (لا تفاصيل ولا أحد عليها): s حجمها، door إغلاق بابها، glow لمعة */
const Hull: React.FC<{ x: number; y: number; s?: number; q: number; door?: number; glow?: number }> = ({ x, y, s = 1, q, door = 1, glow = 0 }) =>
  q <= 0 ? null : (
    <g opacity={Math.min(1, q * 1.5)} transform={`translate(${x} ${y}) scale(${s * (0.7 + 0.3 * q)})`}>
      {glow > 0 ? <circle cx={0} cy={-20} r={70 + 20 * glow} fill={C.gold} opacity={0.3 * glow} /> : null}
      <path d="M-70 -14 C-46 18 46 18 70 -14 Z" fill="#C9A06A" stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />
      <path d="M-40 -14 V-46 H40 V-14" fill="#E8D6B3" stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />
      <path d="M-8 -14 V-34 H10 V-14" fill="none" stroke={C.ink} strokeWidth={3} />
      <Ink d="M-8 -24 H10" p={door} w={4} />
    </g>
  );

/** السفينة نقطة حبر صغيرة على خط الماء */
const ShipDot: React.FC<{ x: number; y: number; q: number; glow?: number }> = ({ x, y, q, glow = 0 }) =>
  q <= 0 ? null : (
    <g opacity={Math.min(1, q * 1.5)} transform={`translate(${x} ${y})`}>
      {glow > 0 ? <circle r={30 + 14 * glow} fill={C.gold} opacity={0.35 * glow} /> : null}
      <path d="M-20 -4 C-12 8 12 8 20 -4 Z M-9 -4 V-14 H9 V-4" fill={C.ink} stroke={C.ink} strokeWidth={2} strokeLinejoin="round" />
    </g>
  );

/** عين ماء تتفجر من الأرض (أقواس زرقاء تصعد وتتكرر بالزمن) */
const Spring: React.FC<{ x: number; y: number; q: number; t: number }> = ({ x, y, q, t }) =>
  q <= 0 ? null : (
    <g opacity={q}>
      <ellipse cx={x} cy={y} rx={34} ry={9} fill={WATER} opacity={0.35} />
      {[0, 1, 2].map((i) => {
        const f = ((t * 0.9 + i / 3) % 1) * q;
        return <path key={i} d={`M${x - 26 * f} ${y - 4} Q${x} ${y - 70 * f - 10} ${x + 26 * f} ${y - 4}`} fill="none" stroke={WATER} strokeWidth={3.5} opacity={1 - f * 0.7} />;
      })}
    </g>
  );

/** قمة موج بشكل جبل (الأمواج كالجبال) */
const Crest: React.FC<{ x: number; y: number; w: number; h: number; p: number }> = ({ x, y, w, h, p }) => {
  if (p <= 0) return null;
  const d = `M${x + w / 2} ${y} Q${x + w / 5} ${y - h * 0.4} ${x + w * 0.04} ${y - h} Q${x - w * 0.12} ${y - h * 0.86} ${x - w * 0.08} ${y - h * 0.7} Q${x - w / 4} ${y - h * 0.3} ${x - w / 2} ${y}`;
  return (
    <g>
      <path d={`${d} Z`} fill={WATER} opacity={0.28 * prog(p, 0.5, 1)} />
      <Ink d={d} p={p} w={4} c={WATER} />
      {[0.25, 0.45, 0.65].map((k) => (
        <path key={k} d={`M${x + w * 0.02} ${y - h * (1 - k)} q${w * 0.12} ${h * 0.1} ${w * 0.2} ${h * 0.25}`} stroke={WATER} strokeWidth={2} fill="none" opacity={0.6 * prog(p, 0.7, 1)} />
      ))}
    </g>
  );
};

/** حبل حبر بين نقطتين بارتخاء sag، ينقطع عند cut (فجوة قرب طرفه الأيمن) */
const Rope: React.FC<{ x1: number; y1: number; x2: number; y2: number; p: number; sag?: number; c?: string; cut?: number; w?: number }> = ({ x1, y1, x2, y2, p, sag = 0, c = C.ink, cut = 0, w = 5 }) => {
  if (p <= 0) return null;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + sag;
  const d = `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`;
  if (cut <= 0) return <Ink d={d} p={p} w={w} c={c} />;
  // منقطع: الجزء البعيد يتدلى، والجزء القريب قصير مقطوع
  const bx = mix(x1, x2, 0.78), by = mix(y1, y2, 0.78) + sag * 0.4;
  return (
    <g>
      <Ink d={`M${x1} ${y1} Q${mix(x1, bx, 0.5)} ${mix(y1, by, 0.5) + sag * (1 + cut)} ${bx - 20 * cut} ${by + 60 * cut}`} p={1} w={w} c={c} />
      <Ink d={`M${x2} ${y2} L${mix(x2, bx, 0.6)} ${mix(y2, by, 0.6) + 30 * cut}`} p={1} w={w} c={c} />
    </g>
  );
};

/** خانات مظلَّلة بلا أرقام (لا أرقام مخترعة) */
const HatchBox: React.FC<{ x: number; y: number; w?: number; h?: number; q: number }> = ({ x, y, w = 120, h = 60, q }) =>
  q <= 0 ? null : (
    <g opacity={q}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={4} fill={C.page} stroke={C.ink} strokeWidth={3} />
      <Hatch x={x - w / 2} y={y - h / 2} w={w} h={h} o={2.2} />
    </g>
  );

// ─── c2-s1: الأرض المتشققة من أعلى، وخيط ماء رفيع ───
const CracksShot = reverent((q) => {
  const k = cueKit(q, ["جافة"]);
  const { t } = k;
  const dust = k.on(0, "جافة", 0.6);
  const crack = k.draw(0, "متشققة", 1.6);
  const widen = k.on(0, "العطش", 0.9);
  const glint = bounce(t, k.at("يخرج"), k.at("يخرج") + 0.9);
  const thread = k.draw(0, "خيط", 1.0);
  const flow = k.draw(0, "الماء", 1.2);
  const cam = k.cam({ cx: 960, cy: 500, s: 1.02 }, [
    [0, "جافة", { cx: 960, cy: 510, s: 1.1 }, 1.6],
    [0, "يخرج", { cx: 1180, cy: 640, s: 1.4 }, 1.4],
  ]);
  const r = rng(7);
  const specks = Array.from({ length: 18 }, () => [180 + r() * 1560, 140 + r() * 720, r()] as const);
  const both = (
    <g>
      <Clay />
      {specks.map(([x, y, v], i) => <circle key={i} cx={x + 30 * dust * v} cy={y - 40 * dust * v} r={3} fill="#8A5A3C" opacity={0.6 * dust * (1 - 0.6 * dust)} />)}
      <Cracks p={crack} w={4 + 2.5 * widen} />
      <circle cx={1260} cy={520} r={14 + 20 * glint} fill="#FFF6E0" opacity={0.85 * glint} />
      <WaterIn i={FIRST} p={thread * 0.45 + flow * 0.55} w={4 + 2 * flow} />
    </g>
  );
  return <Leaf q={q} id="b7c" cam={cam} L={both} R={both} />;
});

// ─── c2-s2: الماء من الشقوق كلها، ثم خط الماء أسفل الصفحتين ───
const Seep = reverent((q) => {
  const k = cueKit(q, ["آخر"]);
  const { t } = k;
  const second = k.draw(0, "شق", 1.0);
  const all = k.draw(0, "كل", 1.4);
  const line = k.draw(0, "مكان", 1.2);
  const cam = k.cam({ cx: 1180, cy: 640, s: 1.4 }, [
    [0, "شق", { cx: 700, cy: 600, s: 1.3 }, 1.0],
    [0, "كل", NEUTRAL, 1.6],
  ]);
  const both = (
    <g>
      <Clay o={1 - 0.4 * line} />
      <Cracks p={1} w={6} o={1 - 0.35 * line} />
      <WaterIn i={FIRST} p={1} w={6} />
      <WaterIn i={SECOND} p={second} w={5} />
      {CRACKS.map((_, i) => (i === FIRST || i === SECOND ? null : <WaterIn key={i} i={i} p={prog(all, (i % 5) * 0.1, (i % 5) * 0.1 + 0.6)} w={4} />))}
      <Waterline y={850} p={line} t={t} rows={1} fill={0.3} />
    </g>
  );
  return <Leaf q={q} id="b7s" cam={cam} L={both} R={both} />;
});

// ─── c2-s4: الخيط الأحمر طافيًا على خط الماء، والعقدة ٧ ───
const KX = [1680, 1540, 1400, 1260, 1110, 800, 560];
const ThreadShot = reverent((q) => {
  // دمج الحلقتين (٢٧ نوفمبر): حُذفت جملة «على خيط الزمن، رأينا في الحلقتين الماضيتين…» ومرحلتها (رسم الخيط والعقد ١–٦
  // ولمعان «دعوة نوح» و«السفينة»)، فالعقد ١–٦ بأسمائها حاضرة من أول «واليوم يصل خيطنا إلى الطوفان.» تكملةً للجزء الأول
  const k = cueKit(q, ["يصل"]);
  const { t } = k;
  const ext = k.draw(0, "واليوم", 0.9);
  const tie7 = k.on(0, "يصل", 0.8);
  const ring7 = k.on(0, "واليوم", 0.6);
  const name7 = k.draw(0, "الطوفان", 0.9);
  const rise = k.on(0, "الطوفان", 1.0);
  const years = 1;
  const dry = 1;
  const wy = 760 - 30 * rise;
  const knots: KnotDef[] = [
    ...[0, 1, 2, 3].map((i) => ({ x: KX[i]!, kind: "tied" as const, q: 1, label: "١٢٣٤"[i], lq: 1 })),
    { x: KX[4]!, kind: "tied", q: 1, glow: 0, label: "دعوة نوح عليه السلام", lq: 1 },
    { x: KX[5]!, kind: "tied", q: 1, glow: 0, label: "السفينة", lq: 1 },
    { x: KX[6]!, kind: "ring", q: ring7, tie: tie7, label: "الطوفان", lq: name7 },
  ];
  const reach = mix(0.62, 0.8, ext);
  const cam = k.cam(NEUTRAL, [
    [0, "يصل", { cx: 620, cy: 680, s: 1.35 }, 1.0],
  ]);
  const both = (
    <g>
      <Waterline y={wy + 8} p={1} t={t} rows={2} fill={0.25} />
      <Thread x1={1760} x2={200} y={wy} p={reach} knots={knots} labelSize={26} labelDy={58} />
      <path d={`M880 ${wy + 110} H720`} stroke="#8A5A3C" strokeWidth={5} strokeDasharray="12 10" opacity={dry} />
      <Txt x={KX[4]!} y={wy + 100} size={26} q={years} color={C.inkSoft}>تسعمئة وخمسين سنة</Txt>
    </g>
  );
  return <Leaf q={q} id="b7t" cam={cam} L={both} R={both} />;
});

// ─── c2-s5: ماء السماء وماء الأرض ───
const TwoWaters = reverent((q) => {
  const k = cueKit(q, ["أين"]);
  const { t } = k;
  const qm = k.on(0, "أين");
  const seal = k.on(0, "القرآن");
  const rain = k.on(0, "السماء", 0.8);
  const springs = [0, 1, 2].map((i) => prog(t, k.at("والأرض") + i * 0.2, k.at("والأرض") + i * 0.2 + 0.5));
  const toward = k.draw(0, "معا", 0.9);
  const cam = k.cam(NEUTRAL, [
    [0, "السماء", { cx: 1360, cy: 460, s: 1.15 }, 1.0],
    [0, "والأرض", { cx: 560, cy: 640, s: 1.15 }, 1.0],
    [0, "معا", NEUTRAL, 1.0],
  ]);
  const both = <Waterline y={820} p={1} t={t} rows={1} fill={0.2} />;
  return (
    <Leaf q={q} id="b7w" cam={cam}
      L={<g>{both}
        {[300, 520, 740].map((x, i) => <Spring key={i} x={x} y={800} q={springs[i]!} t={t} />)}
        <Ink d="M760 760 C820 720 880 700 950 690" p={toward} w={4} c={WATER} />
        <Q x={930} y={340} size={80} q={qm} />
      </g>}
      R={<g>{both}
        <QuranSeal x={1365} y={180} o={seal} s={0.8} />
        <Rain x={1000} y={240} w={740} h={520} q={rain} t={t} />
        <Ink d="M1160 760 C1100 720 1040 700 970 690" p={toward} w={4} c={WATER} />
      </g>} />
  );
});

// ─── c2-s8: التقاء الماءين على ما قدّره الله (نص قرار المالك ٢٥ نوفمبر) ───
const Meet = reverent((q) => {
  const k = cueKit(q, ["يتدفق"]);
  const { t } = k;
  const rain = 0.4 + 0.6 * k.on(0, "يتدفق", 0.8);
  const springs = [0, 1, 2].map((i) => prog(t, k.at("وينابيع") + i * 0.2, k.at("وينابيع") + i * 0.2 + 0.5));
  const meet = k.draw(0, "فيلتقي", 1.2);
  const set = k.on(0, "قدره", 1.0);
  const seal = k.on(0, "قدره", 0.6);
  const wy = 760 - 40 * set;
  const cam = k.cam(NEUTRAL, [
    [0, "وينابيع", { cx: 560, cy: 640, s: 1.15 }, 1.0],
    [0, "فيلتقي", { cx: 960, cy: 680, s: 1.3 }, 1.0],
    [0, "قدره", NEUTRAL, 1.0],
  ]);
  const both = (
    <g>
      <Waterline y={wy} p={1} t={t} amp={8 * (1 - set)} rows={2} fill={0.25} />
      <Ring x={960} y={wy} r={30 + 20 * meet} p={prog(meet, 0.7, 1)} c={WATER} w={4} />
    </g>
  );
  return (
    <Leaf q={q} id="b7m" cam={cam}
      L={<g>{both}
        {[300, 520, 740].map((x, i) => <Spring key={i} x={x} y={wy + 30} q={springs[i]!} t={t} />)}
        <Ink d={`M740 ${wy + 20} C820 ${wy + 10} 900 ${wy} 960 ${wy}`} p={meet} w={5} c={WATER} />
      </g>}
      R={<g>{both}
        <Rain x={1000} y={160} w={740} h={wy - 180} q={rain} t={t} />
        <Ink d={`M1200 200 C1120 ${wy - 200} 1020 ${wy - 40} 960 ${wy}`} p={meet} w={5} c={WATER} />
        <Seal x={1600} y={240} q={seal} kind="ثابت" s={0.5} />
      </g>} />
  );
});

// ─── c2-s9 / c2-s12: سجل «من يركب» ───
const LINES = [420, 530, 640];
const Manifest = reverent((q) => {
  const k = cueKit(q, ["يركب", "زوجين"]);
  const { t, S } = k;
  const lower = k.on(0, "وقبل", 1.0);
  const head = k.draw(0, "الأمر", 0.8);
  const title = k.draw(0, "يركب", 0.8);
  const lines = k.draw(0, "يركب", 1.4);
  const ship = k.on(0, "السفينة");
  // الدفعة ٦ البند ١٣٩: «فوران التنور» كلمةً بالحبر وحدها، بلا تنور ولا فقاعات
  const tannur = k.draw(1, "بفوران", 1.0);
  const pair = k.on(1, "زوجين", 0.6);
  const ahl = k.draw(1, "وأهله", 0.7);
  const dash = k.draw(1, "إلا", 0.6);
  const amana = k.draw(1, "ومن", 0.8);
  const few = k.on(1, "وقليل");
  const ages = S === 1 ? prog(t, k.at("القرون") - 0.05, k.at("القرون") + 1.2) : 0;
  const wy = S === 0 ? mix(760, 860, lower) : 860;
  const cam = k.cam(NEUTRAL, [
    [0, "يركب", { cx: 1365, cy: 470, s: 1.2 }, 1.0],
    [0, "السفينة", NEUTRAL, 1.0],
    [1, "بفوران", { cx: 1365, cy: 640, s: 1.2 }, 1.0],
    [1, "زوجين", { cx: 1400, cy: 470, s: 1.3 }, 1.0],
    [1, "ومن", { cx: 1380, cy: 600, s: 1.25 }, 1.0],
    [1, "القرون", NEUTRAL, 1.0],
  ]);
  const both = <Waterline y={wy} p={1} t={t} rows={1} fill={0.2} />;
  return (
    <Leaf q={q} id="b7mf" cam={cam}
      L={<g>{both}
        <ShipDot x={300} y={wy - 4} q={ship} />
        <Thread x1={900} x2={240} y={780} p={ages > 0 ? 1 : 0} w={3} knots={[860, 760, 660, 560, 460, 360].map((x, i) => ({ x, kind: "tied" as const, q: 1, glow: bounce(ages, i / 7, i / 7 + 0.4) }))} />
      </g>}
      R={<g>{both}
        <Write id="b7mf-h" x={1365} y={200} size={48} p={head} label="الأمر" color={C.inkSoft} />
        <Write id="b7mf-t" x={1365} y={310} size={60} p={title} label="من يركب" />
        <Write id="b7mf-f" x={1365} y={760} size={40} p={S === 1 ? tannur : 0} label="فوران التنور" font="tajawal" color={C.inkSoft} />
        {LINES.map((y, i) => <Ink key={i} d={`M1660 ${y} H1080`} p={prog(lines, i / 3, i / 3 + 0.5)} w={3} c={C.inkSoft} />)}
        {/* «زوجين»: علامتان مجردتان متقابلتان (لا حيوانات) — بانتظار اعتماد المالك */}
        <g opacity={pair}>
          <path d={`M1560 ${LINES[0]! - 50} q-26 22 0 44`} fill="none" stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
          <path d={`M1500 ${LINES[0]! - 50} q26 22 0 44`} fill="none" stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
        </g>
        <Write id="b7mf-a" x={1560} y={LINES[1]! - 14} size={46} p={ahl} label="أهله" font="tajawal" />
        <Ink d={`M1180 ${LINES[1]! - 20} H1110`} p={dash} w={6} />
        <Write id="b7mf-m" x={1540} y={LINES[2]! - 14} size={46} p={amana} label="من آمن" font="tajawal" />
        <Txt x={1220} y={LINES[2]! - 14} size={34} q={few} color={C.inkSoft}>قليل</Txt>
      </g>} />
  );
});

// ─── c2-s13: ورقة الأرقام تُطوى (رواية) ───
const Numbers = reverent((q) => {
  const k = cueKit(q, ["عددهم"]);
  const sheet = k.on(0, "عددهم", 0.6);
  const tab = k.on(0, "المفسرون");
  const boxes = [0, 1, 2, 3].map((i) => (k.has("أرقاما") ? prog(q.t, k.at("أرقاما") + i * 0.18, k.at("أرقاما") + i * 0.18 + 0.4) : 0));
  const sanad = k.on(0, "سندا", 0.6);
  const fold = k.on(0, "فنكتفي", 0.8);
  const gold = k.on(0, "القرآن");
  const few = k.draw(0, "قليل", 0.7);
  const seal = k.on(0, "رواية");
  const cam = k.cam(NEUTRAL, [
    [0, "عددهم", { cx: 600, cy: 480, s: 1.2 }, 1.0],
    [0, "فنكتفي", NEUTRAL, 1.0],
    [0, "رواية", { cx: 620, cy: 440, s: 1.2 }, 1.0],
  ]);
  const h = 420 * (1 - 0.5 * fold);
  return (
    <Leaf q={q} id="b7n" cam={cam}
      L={<g>
        <Sheet x={560} y={300 + h / 2} w={520} h={h} q={sheet} rot={-2}>
          <g transform={`translate(0 ${-h / 2})`}>
            {[0, 1, 2, 3].map((i) => <HatchBox key={i} x={-180 + i * 120} y={90} w={100} h={56} q={boxes[i]! * (1 - fold)} />)}
            <path d="M200 150 H-220" stroke={C.inkSoft} strokeWidth={3} strokeDasharray="10 10" opacity={sanad * (1 - fold)} />
            {[0, 1, 2, 3].map((i) => <HatchBox key={`b${i}`} x={-180 + i * 120} y={240} w={100} h={56} q={boxes[i]! * (1 - fold)} />)}
            {fold > 0 ? <path d={`M-250 ${h} H250`} stroke={C.ink} strokeWidth={3} opacity={fold} /> : null}
            <Seal x={0} y={h / 2 + 10} q={seal} kind="رواية" s={0.55} />
          </g>
        </Sheet>
        <Tab x={820} y={250} q={tab} label="أقوال المفسرين" />
      </g>}
      R={<g>
        <GoldSeal x={1365} y={380} q={gold} />
        <Write id="b7n-q" x={1365} y={560} size={66} p={few} label="قليل" />
      </g>} />
  );
});

// ─── c2-s15: الركوب، والسفينة تُغلق على خط الماء ───
const Embark = reverent((q) => {
  const k = cueKit(q, ["ركبوا"]);
  const { t } = k;
  const a = k.at("ركبوا", 0.85);
  const grow = prog(t, a - 0.05, a + 0.4);
  const door = prog(t, a + 0.35, a + 0.8);
  const cam = k.cam(NEUTRAL, [[0, "ركبوا", { cx: 1365, cy: 640, s: 1.25 }, 0.8]]);
  const both = <Waterline y={760} p={1} t={t} rows={2} fill={0.25} />;
  return (
    <Leaf q={q} id="b7e" cam={cam} L={both}
      R={<g>{both}
        <ShipDot x={1365} y={756} q={1 - grow} />
        <Hull x={1365} y={762} q={grow} s={0.6 + 0.4 * grow} door={door} />
      </g>} />
  );
});

// ─── c2-s18: لا ثقة بخشب ولا بحبال ───
const NotWood = reverent((q) => {
  const k = cueKit(q, ["سيرها"]);
  const { t } = k;
  // نص قرار المالك ٢٥ نوفمبر: «يبدأ سيرها ورسوّها بذكر الله»
  const run = prog(t, k.at("سيرها") - 0.05, k.at("سيرها") + 0.8);
  const rest = k.on(0, "ورسوها", 0.6);
  const plank = k.draw(0, "بخشب", 0.7);
  const rope = k.draw(0, "بحبال", 0.8);
  const fs = k.safe(k.at("بحبال") + 0.6, 0.7);
  const fade = prog(t, fs, fs + 0.7);
  const cam = k.cam(NEUTRAL, [[0, "بخشب", { cx: 560, cy: 560, s: 1.25 }, 1.0]]);
  const both = <Waterline y={760} p={1} t={t} rows={2} fill={0.25} amp={8 * (1 - 0.6 * rest)} />;
  return (
    <Leaf q={q} id="b7nw" cam={cam}
      L={<g>{both}
        <g opacity={1 - 0.75 * fade}>
          <g opacity={plank} transform={`translate(560 ${480 + (1 - plank) * 20})`}>
            <rect x={-170} y={-20} width={340} height={40} rx={4} fill="#C9A06A" stroke={C.ink} strokeWidth={4} />
            <path d="M-140 -6 C-60 -14 40 4 150 -4" stroke="#8B6A3E" strokeWidth={2.4} fill="none" />
          </g>
          <g opacity={rope} transform="translate(560 620)">
            {[0, 1, 2].map((i) => <ellipse key={i} cx={0} cy={-i * 10} rx={80 - i * 6} ry={22} fill="none" stroke={C.ink} strokeWidth={5} />)}
            <path d="M80 0 C120 10 140 30 170 26" fill="none" stroke={C.ink} strokeWidth={5} />
          </g>
        </g>
      </g>}
      R={<g>{both}<Hull x={mix(1500, 1340, run)} y={762} q={1} s={0.9} /></g>} />
  );
});

// ─── c2-s19: الأمواج كالجبال، والسفينة نقطة (الغلاف) ───
const CRESTS = [1650, 1480, 1300, 1120, 820, 640, 460, 290];
const Waves = reverent((q) => {
  const k = cueKit(q, ["وارتفع"]);
  const { t } = k;
  const rise = k.draw(0, "وارتفع", 1.4);
  const a1 = k.at("الأمواج"), a2 = k.at("كالجبال");
  const wy = mix(760, 300, rise);
  const cam = k.cam({ cx: 960, cy: 560, s: 1.05 }, [[0, "وارتفع", { cx: 960, cy: 500, s: 0.96 }, 1.6]]);
  const both = (
    <g>
      <Waterline y={wy} p={1} t={t} rows={3} fill={0.3} amp={10} />
      {CRESTS.map((x, i) => {
        const a = i < 4 ? a1 + i * 0.18 : a2 + (i - 4) * 0.15;
        return <Crest key={i} x={x} y={wy + 4} w={190} h={110 + (i % 3) * 40} p={prog(t, a - 0.05, a + 0.6)} />;
      })}
    </g>
  );
  return <Leaf q={q} id="b7wv" cam={cam} L={both} R={<g>{both}<ShipDot x={1210} y={wy - 4} q={1} /></g>} />;
});

// ─── c2-s23 / c2-s24: السفينة في اليمنى، والجبل في اليسرى، وخط النداء ───
const Far = reverent((q) => {
  // الدفعة ٦: «فأجابه نوح عليه السلام بأن النجاة في ذلك اليوم لمن رحمه الله»
  const k = cueKit(q, ["نادى", "فأجابه"]);
  const { t, S } = k;
  const call = S === 0 ? prog(t, k.at("نادى") - 0.05, k.end("بعيدا") + 0.3) * 0.6 + 0.4 * k.on(0, "يدعوه", 0.8) : 1;
  const wob = S === 0 ? k.on(0, "يدعوه") : 0;
  const mount = k.draw(0, "جبلا", 1.0);
  const lift = k.on(0, "عاليا", 0.8);
  const save = k.draw(0, "ينجيه", 0.8);
  const climb = S === 1 ? prog(t, k.at("النجاة") - 0.05, k.end("اليوم") + 0.2) : 0;
  const mercy = k.draw(1, "رحمه", 0.9);
  const wy = 660 - 160 * climb;
  const sx = 1450, sy = wy - 4;
  const ex = mix(1380, 700, call);
  const wave = (x: number) => Math.sin(x / 40 + t * 5) * 10 * wob;
  let d = `M${sx - 30} ${sy - 10}`;
  for (let x = sx - 30; x >= ex; x -= 30) d += ` L${x} ${sy - 10 - (sx - x) * 0.06 + wave(x)}`;
  const cam = k.cam(NEUTRAL, [
    [0, "جبلا", { cx: 600, cy: 520, s: 1.2 }, 1.0],
    [1, "النجاة", { cx: 620, cy: 560, s: 1.15 }, 1.0],
    [1, "رحمه", { cx: 1400, cy: 540, s: 1.2 }, 1.0],
  ]);
  const both = (
    <g>
      <Peak x={560} y={680 - 40 * lift} w={420} h={340} p={mount} />
      <Waterline y={wy} p={1} t={t} rows={2} fill={0.3} />
      <path d={d} fill="none" stroke={C.ink} strokeWidth={3} strokeDasharray="10 10" />
    </g>
  );
  return (
    <Leaf q={q} id="b7f" cam={cam}
      L={<g>{both}<Txt x={580} y={250 - 40 * lift} size={40} q={save}>ينجيه؟</Txt></g>}
      R={<g>{both}<ShipDot x={sx} y={sy} q={1} /><Write id="b7f-r" x={1450} y={sy - 110} size={44} p={mercy} label="النجاة لمن رحمه الله" /></g>} />
  );
});

// ─── c2-s25: وحال بينهما الموج ───
const WaveBetween = reverent((q) => {
  const k = cueKit(q, ["وحال"]);
  const { t } = k;
  const rise = k.draw(0, "وحال", 1.0);
  const calm = k.on(0, "الموج", 1.2);
  const h = 360 * rise * (1 - 0.85 * calm);
  const wy = mix(500, 330, calm);
  const cam = k.cam(NEUTRAL, [[0, "وحال", { cx: 960, cy: 480, s: 1.1 }, 1.0], [0, "الموج", NEUTRAL, 1.2]]);
  const both = (
    <g>
      <Peak x={560} y={640} w={420} h={300} p={1 - calm} />
      <Waterline y={wy} p={1} t={t} rows={2} fill={0.3} />
      <path d={`M1420 486 L700 496`} fill="none" stroke={C.ink} strokeWidth={3} strokeDasharray="10 10" opacity={1 - rise} />
      {h > 4 ? <Crest x={960} y={wy + 4} w={520} h={h} p={1} /> : null}
    </g>
  );
  return <Leaf q={q} id="b7wb" cam={cam} L={both} R={<g>{both}<ShipDot x={1450} y={wy - 4} q={1} /></g>} />;
});

// ─── c2-s26: خانة اسم فارغة (الدفعة ٦ البند ١٤٠: لا ورقة أسماء ولا ختم «رواية») ───
const BlankName = reverent((q) => {
  const k = cueKit(q, ["ابن"]);
  const { t } = k;
  const gold = k.on(0, "القرآن");
  const box = k.draw(0, "القرآن", 0.8);
  const son = k.draw(0, "ابن", 0.8);
  const hold = bounce(t, k.at("يسميه"), k.at("يسميه") + 1.0);
  const cam = k.cam(NEUTRAL, [[0, "ابن", { cx: 1365, cy: 400, s: 1.25 }, 1.0]]);
  return (
    <Leaf q={q} id="b7bn" cam={cam}
      R={<g>
        <GoldSeal x={1365} y={200} q={gold} />
        <Write id="b7bn-s" x={1365} y={330} size={50} p={son} label="ابن نوح" />
        <g opacity={box}>
          <Txt x={1365} y={390} size={30} q={box} color={C.inkSoft}>الاسم</Txt>
          <rect x={1165} y={410} width={400} height={110} rx={10} fill="none" stroke={C.ink} strokeWidth={4 + 3 * hold} />
        </g>
      </g>} />
  );
});

// ─── c2-s31: رابطتان إلى السفينة ───
const TwoRopes = reverent((q) => {
  const k = cueKit(q, ["فالرابطة"]);
  const { t } = k;
  const start = k.draw(0, "فالرابطة", 0.7);
  const r1 = k.draw(0, "الدم", 1.0);
  const slack = prog(t, k.at("وحدها") - 0.05, k.at("وحدها") + 1.0);
  const r2 = k.draw(0, "الإيمان", 0.9);
  const knot = k.on(0, "والعمل", 0.6);
  const sx = 1500, sy = 540;
  const cam = k.cam(NEUTRAL, [[0, "الدم", { cx: 900, cy: 440, s: 1.1 }, 1.0], [0, "الإيمان", { cx: 1000, cy: 600, s: 1.1 }, 1.0]]);
  const both = (
    <g>
      <Waterline y={720} p={1} t={t} rows={1} fill={0.2} />
      <Ink d={`M${sx - 60} ${sy - 30} L${sx - 140} ${sy - 50}`} p={start} w={5} />
      {r1 > 0 ? <Rope x1={360} y1={400} x2={sx - 140} y2={sy - 50} p={r1} sag={80 + 140 * slack} cut={prog(slack, 0.55, 1)} /> : null}
      <Rope x1={360} y1={640} x2={sx - 70} y2={sy - 4} p={r2} sag={0} c={C.ribbon} w={6} />
    </g>
  );
  return (
    <Leaf q={q} id="b7r" cam={cam}
      L={<g>{both}
        <Txt x={520} y={340} size={36} q={r1}>رابطة الدم وحدها</Txt>
        <Txt x={560} y={720} size={36} q={knot}>الإيمان · العمل الصالح</Txt>
        <g transform="translate(760 628)"><Ring x={0} y={0} r={14} p={knot} c={C.ribbon} w={6} fill={C.ribbon} fillO={1} /></g>
      </g>}
      R={<g>{both}<Hull x={sx} y={sy + 6} q={1} s={0.9} /></g>} />
  );
});

// ─── c2-s32 / c2-s34: حدود الماء غير المعروفة (الدفعة ٦ البند ١٣٨: لا غمر للصفحتين ولا حدّ يحصر الماء؛ خط ماء يتلاشى طرفاه) ───
const Edge = reverent((q) => {
  const k = cueKit(q, ["وهل", "بالطوفان"]);
  const { t, S } = k;
  const line = S === 0 ? k.draw(0, "عم", 1.4) : 1;
  const fadeEnds = S === 0 ? k.on(0, "كلها", 1.0) : 1;
  const q1 = S === 0 ? k.on(0, "أم", 0.6) : 0;
  const q2 = S === 0 ? k.on(0, "وحدهم", 0.6) : 0;
  const gold = k.on(1, "القرآن");
  const tufan = k.draw(1, "بالطوفان", 0.9);
  const sealT = k.on(1, "بالطوفان", 0.7);
  const saved = S === 1 ? bounce(t, k.at("وبنجاة"), k.at("وبنجاة") + 1.4) : 0;
  const ends = S === 1 ? bounce(t, k.at("بحدود"), k.at("بحدود") + 1.2) : 0;
  const unk = k.on(1, "نعلم");
  const cam = k.cam(NEUTRAL, [
    [0, "أم", { cx: 1500, cy: 520, s: 1.2 }, 1.0],
    [0, "وحدهم", { cx: 420, cy: 520, s: 1.2 }, 1.0],
    [1, "بالطوفان", { cx: 1365, cy: 400, s: 1.2 }, 1.0],
    [1, "بحدود", NEUTRAL, 1.0],
  ]);
  const W = 560;
  const x1 = mix(960, 1700, line), x2 = mix(960, 220, line);
  const both = (
    <g>
      <Clay o={0.6} wet={0.4} />
      <Cracks p={1} w={3} o={0.4} />
      <defs>
        <linearGradient id="b7ed-fade" gradientUnits="userSpaceOnUse" x1={x2} x2={x1} y1={W} y2={W}>
          <stop offset="0" stopColor={WATER} stopOpacity={1 - 0.95 * fadeEnds} />
          <stop offset="0.18" stopColor={WATER} stopOpacity={1} />
          <stop offset="0.82" stopColor={WATER} stopOpacity={1} />
          <stop offset="1" stopColor={WATER} stopOpacity={1 - 0.95 * fadeEnds} />
        </linearGradient>
      </defs>
      <path d={`M${x1} ${W} H${x2}`} stroke="url(#b7ed-fade)" strokeWidth={10 + 6 * ends} strokeLinecap="round" opacity={0.85} />
    </g>
  );
  return (
    <Leaf q={q} id="b7ed" cam={cam}
      L={<g>{both}<ShipDot x={760} y={W - 6} q={S === 1 ? 1 : 0} glow={saved} /><Q x={300} y={W - 90} size={80} q={q2} /></g>}
      R={<g>{both}
        <Q x={1620} y={W - 90} size={80} q={q1} />
        <GoldSeal x={1365} y={230} q={gold} />
        <Write id="b7ed-g" x={1365} y={370} size={50} p={tufan} label="الطوفان" />
        <Seal x={1365} y={440} q={sealT} kind="ثابت" s={0.45} />
        <Seal x={1640} y={W + 90} q={unk} kind="لا نعلم" s={0.5} />
      </g>} />
  );
});

// ─── c2-s35 / c2-s36: لفافة أرقام أهل الكتاب ───
const COLS: [number, string, string][] = [[750, "المطر", "المطر"], [560, "وارتفاع", "ارتفاع الماء"], [370, "وأيام", "الأيام"]];
const AhlKitab = reverent((q) => {
  const k = cueKit(q, ["أهل", "الأجيال"]);
  const { t, S } = k;
  const open = S === 0 ? k.draw(0, "كتب", 1.0) : 1 - (S === 1 ? prog(t, k.at("رواية") + 0.7, k.at("رواية") + 1.5) : 0);
  const cols = COLS.map(([, w]) => k.on(0, w, 0.6));
  const g3 = S === 1 ? bounce(t, k.at("الأجيال"), k.at("الأجيال") + 1.6) : 0;
  // الدفعة ٦ البند ١٤١: «ما لم يتبيّن صدقه أو كذبه: نتوقف»
  const rule = k.draw(1, "يتبين", 1.2);
  const seal = k.on(1, "رواية");
  const cam = k.cam(NEUTRAL, [
    [0, "المطر", { cx: 600, cy: 460, s: 1.2 }, 1.0],
    [1, "الأجيال", { cx: 1300, cy: 700, s: 1.2 }, 1.0],
    [1, "يتبين", { cx: 1100, cy: 460, s: 1.05 }, 1.0],
  ]);
  const w = 600 * open;
  return (
    <Leaf q={q} id="b7ak" cam={cam}
      L={<g>
        {w > 10 ? (
          <g>
            <rect x={560 - w / 2} y={260} width={w} height={380} fill="#F4E6C8" stroke={C.ink} strokeWidth={3} />
            <g opacity={prog(open, 0.6, 1)}>
              {COLS.map(([x, , lab], i) => (
                <g key={i} opacity={cols[i]}>
                  <Txt x={x} y={320} size={30} q={cols[i]!} color={C.ink}>{lab}</Txt>
                  <HatchBox x={x} y={430} w={130} h={120} q={cols[i]!} />
                </g>
              ))}
              <Seal x={560} y={570} q={seal} kind="رواية" s={0.5} />
            </g>
          </g>
        ) : null}
        <rect x={560 - w / 2 - 22} y={248} width={22} height={404} rx={10} fill="#C9A06A" stroke={C.ink} strokeWidth={3} />
        <rect x={560 + w / 2} y={248} width={22} height={404} rx={10} fill="#C9A06A" stroke={C.ink} strokeWidth={3} />
      </g>}
      R={<g>
        <Thread x1={1740} x2={980} y={800} p={1} w={4} knots={[1660, 1520, 1380].map((x, i) => ({ x, kind: "tied" as const, q: 1, glow: i === 2 ? g3 : 0, label: i === 2 ? "الأجيال الأولى" : undefined, lq: g3 > 0 ? 1 : 0 }))} labelSize={24} labelDy={48} />
        <Write id="b7ak-r" x={1365} y={460} size={44} p={rule} label="ما لم يتبيّن صدقه أو كذبه: نتوقف" font="tajawal" />
      </g>} />
  );
});

// ─── c2-s37 / c2-s40: الماء يعود إلى الأرض، والسفينة تستقر ───
const Calm = reverent((q) => {
  const k = cueKit(q, ["جاء", "ابتلعت"]);
  const { t, S } = k;
  const rain = S === 0 ? 1 - 0.6 * k.on(0, "الأمر", 0.8) - 0.4 * k.on(0, "والسماء", 0.8) : 0;
  const springs = S === 0 ? 1 - 0.8 * k.on(0, "للأرض", 0.9) : 0;
  const drop = S === 1 ? prog(t, k.at("ابتلعت") - 0.05, k.end("ماءها") + 1.0) : 0;
  const clear = k.on(1, "وكفت", 1.0);
  const line = k.draw(1, "وقضي", 0.8);
  const settle = k.on(1, "واستوت", 0.9);
  const wy = mix(380, 800, drop);
  const peakTop = 640;
  const shipY = settle > 0 ? mix(wy - 4, peakTop - 118, settle) : wy - 4;
  const shipX = mix(1300, 1225, settle);
  const cam = k.cam(NEUTRAL, [
    [1, "ابتلعت", { cx: 960, cy: 600, s: 1.05 }, 1.4],
    [1, "واستوت", { cx: 1260, cy: 560, s: 1.3 }, 1.0],
  ]);
  const both = (
    <g>
      {S === 1 ? <rect x={140} y={60} width={1640} height={320} fill="#E9EFEA" opacity={0.5 * clear} /> : null}
      {S === 1 ? <g opacity={drop}><Cracks p={1} w={4} c={WATER} o={0.35} /></g> : null}
      <Peak x={1300} y={800} w={380} h={280} p={1} />
      <Waterline y={wy} p={1} t={t} rows={2} fill={0.3} />
    </g>
  );
  return (
    <Leaf q={q} id="b7cl" cam={cam}
      L={<g>{both}{[320, 540, 760].map((x, i) => <Spring key={i} x={x} y={wy + 40} q={springs} t={t} />)}</g>}
      R={<g>{both}
        <Rain x={1000} y={100} w={740} h={wy - 120} q={rain} t={t} />
        <Ink d="M1600 220 H1140" p={line} w={4} />
        <ShipDot x={shipX} y={shipY} q={1} />
      </g>} />
  );
});

// ─── c2-s41: العقدة الثامنة فارغة ───
const NextKnot = reverent((q) => {
  const k = cueKit(q, ["استوت"]);
  const back = k.draw(0, "وأين", 1.4);
  const step = k.draw(0, "النزول", 0.9);
  const ring = k.on(0, "عقدتنا", 0.7);
  const reach = 0.55 * back + 0.2 * step;
  const cam = k.cam(NEUTRAL, [[0, "النزول", { cx: 760, cy: 640, s: 1.2 }, 1.0], [0, "عقدتنا", { cx: 560, cy: 620, s: 1.35 }, 1.0]]);
  const both = (
    <g>
      <Horizon y={560} p={1} sky="morning" ground="#A98C6C" texture={0.4} />
      <Thread x1={1760} x2={200} y={700} p={reach} knots={[
        ...[1680, 1580, 1480, 1380, 1280, 1180].map((x) => ({ x, kind: "tied" as const, q: 1 })),
        { x: 1040, kind: "tied", q: 1, label: "الطوفان", lq: 1 },
        { x: 560, kind: "ring", q: ring, tie: 0, mark: ring },
      ]} labelSize={26} />
    </g>
  );
  return <Leaf q={q} id="b7nk" cam={cam} L={both} R={both} />;
});

// ─── c2-s42 / c2-s43: الأرض بعد الطوفان مبلولة ملتئمة ───
const WetEarth = reverent((q) => {
  const k = cueKit(q, ["بقي", "القرب"]);
  const { t, S } = k;
  const wet = k.on(0, "بقي", 1.0);
  const mount = S === 0 ? k.draw(0, "الجبل", 0.8) * (1 - prog(t, k.at("العالي") + 0.5, k.at("العالي") + 1.2)) : 0;
  const ship = k.draw(0, "السفينة", 0.8);
  const shine = S === 0 ? bounce(t, k.at("السفينة") + 0.4, k.at("السفينة") + 1.6) : 0;
  const mock = k.draw(0, "وسخر", 0.9);
  const circle = k.draw(1, "القرب", 1.0);
  const gap = k.on(1, "يغني", 0.6);
  const faith = k.draw(1, "الإيمان", 1.0);
  const grass = k.on(1, "والعمل", 0.9);
  const cam = k.cam(NEUTRAL, [
    [0, "الجبل", { cx: 600, cy: 520, s: 1.15 }, 1.0],
    [0, "السفينة", { cx: 1365, cy: 540, s: 1.2 }, 1.0],
    [1, "الإيمان", NEUTRAL, 1.0],
  ]);
  const both = (
    <g>
      <Clay wet={wet} />
      <Cracks p={1} w={2.5} c="#4A3020" o={0.55} />
    </g>
  );
  return (
    <Leaf q={q} id="b7we" cam={cam}
      L={<g>{both}
        <Peak x={560} y={620} w={300} h={220} p={mount} />
        <Grass x={640} y={452} q={grass} t={t} wind={0.1} n={5} spread={50} h={40} />
        <Write id="b7we-f" x={560} y={760} size={50} p={faith} label="الإيمان والعمل" />
      </g>}
      R={<g>{both}
        <Hull x={1365} y={560} q={ship} s={1.1} glow={shine} />
        <Txt x={1365} y={660} size={32} q={mock} color={C.inkSoft}>وسخر منها الناس</Txt>
        {circle > 0 ? (
          <circle cx={1365} cy={520} r={170} fill="none" stroke={GOLD_D} strokeWidth={4} opacity={0.8} pathLength={1} strokeDasharray={`${circle * (1 - 0.14 * gap)} 1`} transform="rotate(-90 1365 520)" />
        ) : null}
      </g>} />
  );
});

// ─── c2-s44: سفينتك (سؤال الختام) ───
const Question = reverent((q) => {
  const k = cueKit(q, ["تحتمي"]);
  const { t } = k;
  const ship = k.on(0, "السفينة", 0.7);
  const waves = k.on(0, "الأمواج", 0.7);
  const line = k.draw(0, "اكتب", 0.9);
  const pen = k.on(0, "التعليقات", 0.7);
  const bob = Math.sin(t * 2.2) * 8 * waves;
  const cam = k.cam(NEUTRAL, [[0, "السفينة", { cx: 420, cy: 600, s: 1.3 }, 1.0], [0, "اكتب", { cx: 1340, cy: 560, s: 1.2 }, 1.0]]);
  return (
    <Leaf q={q} id="b7q" cam={cam}
      L={<g>
        <Hull x={360} y={640 + bob} q={ship} s={0.8} />
        <Waterline x1={520} x2={200} y={650 + bob * 0.6} p={waves} t={t} rows={2} fill={0.2} amp={6 + 6 * waves} />
      </g>}
      R={<BlankLine x={1340} y={560} w={560} p={line} pen={pen} />} />
  );
});

export const BD07_SCENES: Record<string, React.FC<BdProps>> = {
  "bd07-cracks": CracksShot,
  "bd07-seep": Seep,
  "bd07-thread": ThreadShot,
  "bd07-two-waters": TwoWaters,
  "bd07-meet": Meet,
  "bd07-manifest": Manifest,
  "bd07-numbers": Numbers,
  "bd07-embark": Embark,
  "bd07-not-wood": NotWood,
  "bd07-waves": Waves,
  "bd07-far": Far,
  "bd07-wave-between": WaveBetween,
  "bd07-blank-name": BlankName,
  "bd07-two-ropes": TwoRopes,
  "bd07-edge": Edge,
  "bd07-ahl-kitab": AhlKitab,
  "bd07-calm": Calm,
  "bd07-next-knot": NextKnot,
  "bd07-wet-earth": WetEarth,
  "bd07-question": Question,
};

/** مشهد الصورة الثابتة للمراجعة لكل لقطة (المعرّف في الخطة)؛ الغائب = آخر مشهد يستعمل اللقطة، عند نهاية آخر كلمة */
export const BD07_STILLS: Record<string, string> = {
  "bd07-thread": "c2-s4",
  "bd07-manifest": "c2-s12",
  "bd07-far": "c2-s24",
  "bd07-edge": "c2-s34",
  "bd07-calm": "c2-s40",
  "bd07-wet-earth": "c2-s43",
};

