/**
 * «دفاتر الزمن 009 — ذرية نوح» (خاتمة «البدايات»): لقطات «خط الأفق» الجديدة كما في خطة المشاهد (scenes.md، D214).
 * لا تصوير لنوح عليه السلام ولا لأبنائه ولا لأي نبي أو إنسان: الناس نقاط حبر وطرق، والأسماء كلمات وحدها.
 * لا خريطة أنساب ولا حدود ولا أسماء أمم على خريطة؛ هيكل الشجرة في bd09-margin متقطع باهت بلا أسماء (بانتظار اعتماد المالك).
 * كل حدث على كلمته (cueKit)، والسكون عند كلمات الذكر بالزمن المرئي (reverent).
 */
import React from "react";
import { Books, FindAt, GATE, GLYPHS, Hatch, Ruler, RUINS, Sunset, Tent, Village, Wheat, Boat, Fire, Qalam } from "../lib/drawings";
import { ChapterHead, DateRibbon, QuranSeal } from "../horizon/book";
import {
  Book, C, CLAY, Dot, EMBER, Feather, Field, GOLD_D, Globe, GoldSeal, Horizon, Ink, Leaf, NEUTRAL, Peak, Plank, Q, Ring, STONE, Scribble, Seal, Sheet, Slip,
  Stone, Tab, Thread, Txt, WATER, Waterline, Write, bounce, crackPath, cueKit, mix, prog, reverent, rng, type BdProps, type KnotDef,
} from "./kit";

// ───────────────────────── الطريق المتفرّع (القطعة المخصوصة) ─────────────────────────

type Pt = readonly [number, number];
type Seg = { a: Pt; b: Pt; g: 0 | 1 | 2 | 3; bend: number };
const ROOT: Pt = [1460, 840];
const SEGS: Seg[] = [
  { a: ROOT, b: [1250, 560], g: 0, bend: 30 },
  { a: [1250, 560], b: [1480, 320], g: 1, bend: -30 },
  { a: [1250, 560], b: [900, 520], g: 1, bend: 30 },
  { a: [1480, 320], b: [1690, 180], g: 2, bend: 20 },
  { a: [1480, 320], b: [1300, 170], g: 2, bend: -20 },
  { a: [900, 520], b: [640, 280], g: 2, bend: 25 },
  { a: [900, 520], b: [580, 740], g: 2, bend: -25 },
  { a: [900, 520], b: [340, 500], g: 2, bend: 20 },
  { a: [1690, 180], b: [1745, 115], g: 3, bend: 6 },
  { a: [1300, 170], b: [1250, 105], g: 3, bend: 6 },
  { a: [640, 280], b: [520, 130], g: 3, bend: 10 },
  { a: [580, 740], b: [470, 860], g: 3, bend: -10 },
  { a: [340, 500], b: [175, 470], g: 3, bend: 8 },
];
/** أطراف الطرق (نهايات الفروع الأخيرة) */
const TIPS: Pt[] = SEGS.filter((s) => s.g === 3).map((s) => s.b);
const segD = (s: Seg) => {
  const [x1, y1] = s.a, [x2, y2] = s.b;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  return `M${x1} ${y1} Q${mx + (-(y2 - y1) / len) * s.bend} ${my + ((x2 - x1) / len) * s.bend} ${x2} ${y2}`;
};
const TONES = [C.ink, CLAY, GOLD_D, "#5A4636", EMBER, WATER, "#7A5C46", CLAY, GOLD_D, WATER, EMBER, "#5A4636", C.ink];

/** الطرق: g = تقدّم كل جيل من الفروع، tone = تمايز درجات الحبر، back = رجوعها إلى الأصل (من الأطراف أولًا) */
const Roads: React.FC<{ g: [number, number, number, number]; tone?: number; back?: number; dust?: number; o?: number }> = ({ g, tone = 0, back = 0, dust = 0, o = 1 }) => (
  <g opacity={o}>
    {SEGS.map((s, i) => {
      const keep = 1 - prog(back, (3 - s.g) / 4, (4 - s.g) / 4);
      const p = g[s.g] * keep;
      if (p <= 0) return null;
      const d = segD(s);
      return (
        <g key={i}>
          {dust > 0 && s.g < 2 ? <Ink d={d} p={p} w={26} c={CLAY} opacity={0.14 * dust} /> : null}
          <Ink d={d} p={p} w={s.g === 0 ? 7 : s.g === 1 ? 6 : 4.5} c={C.ink} opacity={1 - tone} />
          {tone > 0 ? <Ink d={d} p={p} w={s.g === 0 ? 7 : s.g === 1 ? 6 : 4.5} c={TONES[i]!} opacity={tone} /> : null}
        </g>
      );
    })}
  </g>
);
/** حبيبات تراب خفيفة على ورق بلا أفق (أرض من أعلى) */
const Grain: React.FC<{ o?: number }> = ({ o = 1 }) => {
  const r = rng(91);
  return (
    <g opacity={0.5 * o}>
      {Array.from({ length: 70 }, (_, i) => (
        <circle key={i} cx={170 + r() * 1580} cy={110 + r() * 780} r={1.4 + r() * 2.2} fill={CLAY} opacity={0.5} />
      ))}
    </g>
  );
};

// ───────────────────────── الخيط بعقده (أسماء الحلقات ورموز قطعها) ─────────────────────────

const KX = [1690, 1530, 1370, 1210, 1050, 870, 710, 550, 390];
const KNAMES = ["خلق آدم", "ابنا آدم", "الأجيال الأولى", "كيف بدأ الشرك", "دعوة نوح", "السفينة", "الطوفان", "الجودي", "ذرية نوح"];

/** رموز قطع الحلقات الصغيرة فوق العقد (حبر، بلا هيئات) */
const Sym: React.FC<{ k: number; q: number }> = ({ k, q }) => {
  if (q <= 0) return null;
  const body = (() => {
    switch (k) {
      case 0: // نور (001)
        return (
          <g>
            <circle r={22} fill={C.gold} opacity={0.3} />
            <circle r={10} fill={C.gold} stroke={GOLD_D} strokeWidth={3} />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d="M0 -16 V-26" stroke={GOLD_D} strokeWidth={3} strokeLinecap="round" transform={`rotate(${a})`} />)}
          </g>
        );
      case 1: // ريشة (002)
        return <Feather x={0} y={0} s={0.24} q={1} rot={-30} />;
      case 2: // موقد (003)
        return (
          <g transform="scale(0.42)">
            <Fire q={1} />
            {[-46, -16, 16, 46].map((x) => <ellipse key={x} cx={x} cy={14} rx={14} ry={9} fill={STONE} stroke={C.ink} strokeWidth={4} />)}
          </g>
        );
      case 3: // حجر أصم (004)
        return <g transform="scale(0.4)"><Stone x={0} y={20} w={70} h={90} q={1} /></g>;
      case 4: // قطرات وحلقاتها (005)
        return (
          <g>
            <path d="M0 -26 C6 -16 8 -10 0 -4 C-8 -10 -6 -16 0 -26 Z" fill={WATER} />
            <ellipse cx={0} cy={8} rx={12} ry={4} fill="none" stroke={WATER} strokeWidth={2.5} />
            <ellipse cx={0} cy={8} rx={24} ry={8} fill="none" stroke={WATER} strokeWidth={2} opacity={0.6} />
          </g>
        );
      case 5: // لوحان مشدودان (006)
        return (
          <g>
            <Plank x={0} y={-8} w={60} h={12} q={1} />
            <Plank x={0} y={8} w={60} h={12} q={1} />
            <path d="M-6 -16 V16 M6 -16 V16" stroke={C.ribbon} strokeWidth={3} />
          </g>
        );
      case 6: // خط ماء (007)
        return <path d="M-28 0 Q-21 -8 -14 0 T0 0 T14 0 T28 0 M-28 10 Q-21 2 -14 10 T0 10 T14 10 T28 10" fill="none" stroke={WATER} strokeWidth={3} />;
      default: // قمة (008)
        return <path d="M-28 14 L-6 -18 L2 -10 L10 -24 L30 14 Z" fill="#CDBB98" stroke={C.ink} strokeWidth={3} strokeLinejoin="round" />;
    }
  })();
  return <g opacity={q} transform={`scale(${0.7 + 0.3 * q})`}>{body}</g>;
};

// ─── c2-s1 / c2-s21 / c2-s35: الطريق المتفرّع ───
const RoadShot = reverent((q) => {
  const k = cueKit(q, ["طريق", "تباعدت", "التعليقات"]);
  const { t, S } = k;
  if (S === 2) {
    // الختام من بعيد: الطريق صغيرًا فوق، والخيط بعقده التسع تحته، ورقعة التعليق
    const slip = k.on(2, "التعليقات", 0.6);
    const pulseAt = k.at("أي", 0.3);
    const why = k.on(2, "ولماذا");
    const knots: KnotDef[] = KX.map((x, i) => ({ x, kind: "tied", q: 1, glow: bounce(t, pulseAt + i * 0.22, pulseAt + i * 0.22 + 0.6) }));
    const cam = k.cam(NEUTRAL, [[2, "التعليقات", { cx: 1250, cy: 520, s: 1.08 }, 1.2]]);
    const both = (
      <g>
        <g transform="translate(560 120) scale(0.5)"><Grain /><Roads g={[1, 1, 1, 1]} /></g>
        <Thread x1={1760} x2={160} y={640} p={1} knots={knots} w={5} />
      </g>
    );
    return (
      <Leaf q={q} id="b9r3" cam={cam} L={both}
        R={<g>{both}
          <Sheet x={1400} y={790} w={420} h={170} q={slip}>
            {[0, 1, 2].map((i) => <path key={i} d={`M170 ${-40 + i * 40} H-170`} stroke={C.inkSoft} strokeWidth={2} opacity={0.6} />)}
            <Q x={-120} y={30} size={70} q={why} />
          </Sheet>
          <g opacity={slip} transform="translate(1520 700) rotate(-30) scale(0.3)"><Qalam /></g>
        </g>} />
    );
  }
  let g: [number, number, number, number];
  let tone = 0, back = 0, dust = 0, tongue = 0;
  if (S === 0) {
    g = [k.draw(0, "طريق", 1.2), k.span(0, "يتفرع", "طريقين", 0.8), k.draw(0, "طرق", 1.2), k.draw(0, "جهة", 0.9)];
    dust = k.on(0, "الأرض", 0.8);
  } else {
    g = [1, 1, 1, 1];
    tongue = k.on(1, "ألسنتها");
    tone = k.on(1, "وألوانها", 0.9);
    back = prog(t, k.at("تعود", 1.2) - 0.05, k.end("أب") + 0.2);
    dust = 1;
  }
  const spread = S === 1 ? k.on(1, "تباعدت", 1.0) : 0;
  const one = S === 1 ? k.on(1, "أب", 0.6) : 0;
  const cam =
    S === 0
      ? k.cam({ cx: 1380, cy: 680, s: 1.35 }, [
          [0, "يتفرع", { cx: 1200, cy: 520, s: 1.2 }, 1.2],
          [0, "طرق", { cx: 960, cy: 480, s: 1.05 }, 1.4],
          [0, "جهة", NEUTRAL, 1.0],
        ])
      : k.cam(NEUTRAL, [
          [1, "تعود", { cx: 1300, cy: 640, s: 1.2 }, 1.6],
          [1, "أب", { cx: 1420, cy: 760, s: 1.4 }, 1.0],
        ]);
  // «تباعدت»: الأطراف تبتعد إلى الحواف (الفروع الأخيرة تطول قليلًا للخارج)
  const both = (
    <g>
      <Grain />
      <g transform={`translate(${-40 * spread} ${-20 * spread}) scale(${1 + 0.04 * spread})`} style={{ transformOrigin: "1460px 840px" }}>
        <Roads g={g} tone={tone} back={back} dust={dust} />
      </g>
      {one > 0 ? <Ring x={ROOT[0]} y={ROOT[1]} r={26} p={one} c={GOLD_D} fill={C.gold} fillO={0.3} /> : null}
      <Dot x={ROOT[0]} y={ROOT[1]} q={S === 1 ? Math.max(one, 1 - back) : g[0]} r={12} />
    </g>
  );
  return (
    <Leaf q={q} id="b9r" cam={cam} L={<g>{both}<Txt x={300} y={440} size={34} q={tongue * (1 - back)} color={C.inkSoft}>ألسنتها</Txt></g>} R={both} />
  );
});

// ─── c2-s3: الخيط بعقده الثماني، والعقدة التاسعة الفارغة ───
const KnotsShot = reverent((q) => {
  // دمج الحلقتين (٢٧ نوفمبر): حُذفت «في الحلقة الماضية، استقرت السفينة…» ومرحلتها، فالقارب على القمة والنقاط على الأرض
  // وخطها حاضرة من أول «واليوم نسأل السؤال الذي تُختم به هذه السلسلة…»
  // دفعة المحرر ١، ٢٧ نوفمبر: الجملة «وعند هذه العقدة الأخيرة من البدايات، نقرأ ما جاء في سورة الصافات عن نوح عليه السلام.» بدل «واليوم نسأل السؤال الذي تُختم به هذه السلسلة…» (حُذفت):
  // العقدة التاسعة على «العقدة» بدل «واليوم»، وكتابة «البدايات» على «البدايات» بدل «تختم»، ولمعة عقدة نوح على «نوح» كما كانت، وحُذف «؟» (كان على «بعد»)
  // التحرير النهائي للمحرر (٢٧ نوفمبر): «وعند هذه العقدة من خيط الزمن، نقرأ…» بدل «وعند هذه العقدة الأخيرة من البدايات، نقرأ…»:
  // حُذفت كتابة «البدايات» وخط إغلاقها (كانا على «البدايات» المحذوفة)، والكاميرا تسحب إلى الخيط كله على «خيط» بدل «البدايات»
  const k = cueKit(q, ["العقدة"]);
  const { t } = k;
  const glow = 1;
  const settle = 1;
  const down = 1;
  const ground = 1;
  const nine = k.on(0, "العقدة", 0.7);
  // قرار المالك ٢٥ نوفمبر: السؤال «ماذا بقي من نوح عليه السلام بعد الطوفان؟» — عقدة نوح تلمع، بلا انتشار
  const scatter = 0;
  const noah = bounce(t, k.at("نوح"), k.at("نوح") + 1.4);
  const qm = 0;
  const knots: KnotDef[] = KX.map((x, i) => (i < 8
    ? { x, kind: "tied", q: 1, label: KNAMES[i], lq: 0.75, glow: i === 7 ? glow * (0.6 + 0.4 * Math.sin(t * 3) ** 2) : i === 4 ? noah : 0 }
    : { x, kind: "ring", q: nine, tie: 0, mark: qm }));
  const PX = 550, PY = 690;
  const boatY = mix(440, PY - 150, settle);
  const r = rng(29);
  const dots = Array.from({ length: 7 }, (_, i) => {
    const sx = PX + (i - 3) * 14, sy = PY - 150;
    const gx = PX + (i - 3) * 40, gy = PY + 6;
    const fx = mix(250, 1300, r()), fy = 180 + r() * 420;
    return [mix(mix(sx, gx, down), fx, scatter), mix(mix(sy, gy, down), fy, scatter)] as const;
  });
  const cam = k.cam({ cx: 1500, cy: 720, s: 1.3 }, [
    [0, "العقدة", { cx: 520, cy: 700, s: 1.35 }, 1.0],
    [0, "خيط", { cx: 960, cy: 600, s: 1.05 }, 1.0],
  ]);
  const both = (
    <g>
      <Thread x1={1760} x2={200} y={800} p={1} knots={knots} labelDy={48} labelSize={22} w={5} />
      <Peak x={PX} y={PY} w={260} h={130} p={1} />
      <Ink d={`M${PX + 260} ${PY + 6} H${PX - 360}`} p={ground} w={4} />
      <g opacity={Math.min(1, settle * 3)} transform={`translate(${PX + 6} ${boatY}) scale(0.55)`}><Boat /></g>
      {dots.map(([x, y], i) => <Dot key={i} x={x} y={y} q={down} r={6} />)}
    </g>
  );
  return <Leaf q={q} id="b9k" cam={cam} L={both} R={both} />;
});

// ─── c2-s7: عودة الأفق مع انحسار الماء (الدفعة ٦ البندان ١٤٨ و١٤٩: الصافات ٧٦–٧٧، ونقاط قليلة بلا فروع ولا أسماء ولا توزيع) ───
const AfterWater = reverent((q) => {
  const k = cueKit(q, ["ثابت"]);
  const { t } = k;
  const seal = k.on(0, "ثابت", 0.5);
  const quran = k.on(0, "القرآن", 0.6);
  const hz = k.draw(0, "أنقذ", 1.4);
  const boat = k.on(0, "نوحا", 0.6);
  const rise = prog(t, k.at("البلاء", 1.0) - 0.05, k.at("البلاء", 1.0) + 1.0);
  const fall = prog(t, k.at("العظيم", 1.4) - 0.05, k.at("العظيم", 1.4) + 1.4);
  const wy = mix(900, 610, rise * (1 - fall));
  const word = k.draw(0, "ببقاء", 0.8);
  const seed = k.on(0, "ذريته");
  const walk = k.draw(0, "ذريته", 1.4);
  const cam = k.cam(NEUTRAL, [
    [0, "نوحا", { cx: 1250, cy: 540, s: 1.25 }, 1.0],
    [0, "البلاء", { cx: 760, cy: 620, s: 1.05 }, 1.0],
    [0, "ذريته", { cx: 1200, cy: 560, s: 1.2 }, 1.0],
  ]);
  const both = (
    <g>
      <Horizon y={560} p={hz} sky="morning" texture={0.5} />
      <Hatch x={200} y={600} w={700} h={180} o={hz * (1 - fall * 0.6)} />
      {rise > 0 ? <Waterline y={wy} p={1} t={t} rows={2} fill={0.3} /> : null}
      <g opacity={boat} transform={`translate(1300 ${560 + 4 * Math.sin(t * 1.5)}) scale(0.7)`}><Boat /></g>
      {[0, 1, 2].map((i) => <Dot key={i} x={1220 - i * 40 - walk * (90 + i * 50)} y={600 + (i % 2) * 18} q={seed} r={6} />)}
    </g>
  );
  return (
    <Leaf q={q} id="b9a" cam={cam} L={both}
      R={<g>{both}<Sunset y={560} o={hz * 0.6} />
        <Seal x={1560} y={250} q={seal} kind="ثابت" s={0.6} />
        <QuranSeal x={1250} y={250} o={quran} s={0.8} refText="الصافات ٧٦–٧٧" />
        <Write id="b9a-b" x={1100} y={460} size={40} p={word} label="الباقين" font="tajawal" color={C.inkSoft} />
      </g>} />
  );
});

// ─── c2-s17: حدّ الدفتر وسجل بسطرين وختمه (الدفعة ٦ البند ١٥٠؛ نص قرار المالك ٢٥ نوفمبر) ───
const ROWS = [380, 560];
const Ledger = reverent((q) => {
  const k = cueKit(q, ["فالطرق"]);
  const rule = k.draw(0, "حده", 1.2);
  const r = [k.draw(0, "فالطرق", 0.7), k.draw(0, "والسنوات", 0.7)];
  const road = k.draw(0, "فالطرق", 1.0);
  const unk = k.on(0, "نعلمها", 0.6);
  const cam = k.cam(NEUTRAL, [[0, "فالطرق", { cx: 1365, cy: 400, s: 1.25 }, 1.0], [0, "نعلمها", { cx: 1365, cy: 480, s: 1.1 }, 1.2]]);
  const LAB = ["الطرق", "السنوات"];
  return (
    <Leaf q={q} id="b9l" cam={cam}
      L={<Ink d="M720 130 V880" p={rule} w={5} c={C.ribbon} />}
      R={<g>
        {ROWS.map((y, i) => (
          <g key={i}>
            <Write id={`b9l-${i}`} x={1580} y={y} size={46} p={r[i]!} label={LAB[i]!} font="tajawal" />
            <Ink d={`M1720 ${y + 26} H1020`} p={r[i]!} w={2} c={C.inkSoft} />
          </g>
        ))}
        <g transform={`translate(1230 ${ROWS[0]! + 8}) scale(0.18)`}><Roads g={[road, road, road, road]} /></g>
        <DateRibbon x={1240} y={ROWS[1]! - 60} s={0.38} o={r[1]!} />
        <g transform={`rotate(-6 1300 ${(ROWS[0]! + ROWS[1]!) / 2})`}><Seal x={1300} y={(ROWS[0]! + ROWS[1]!) / 2} q={unk} kind="لا نعلم" s={0.9} w={360} /></g>
      </g>} />
  );
});

// ─── c2-s19: رقعة الحديث تنبسط ───
const HadithLead = reverent((q) => {
  const k = cueKit(q, ["قال"]);
  const sheet = k.on(0, "قال", 0.6);
  const said = k.on(0, "النبي", 0.5);
  const salla = k.on(0, "وسلم", 0.5);
  const cam = k.cam(NEUTRAL, [[0, "قال", { cx: 1365, cy: 480, s: 1.15 }, 1.0]]);
  return (
    <Leaf q={q} id="b9hl" cam={cam}
      R={<g>
        <g opacity={sheet} transform={`translate(1365 500) scale(1 ${Math.max(0.02, sheet)}) translate(-1365 -500)`}>
          <Sheet x={1365} y={500} w={640} h={560} q={1}>
            {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M280 ${-180 + i * 56} H-280`} stroke={C.inkSoft} strokeWidth={1.6} opacity={0.4} />)}
          </Sheet>
        </g>
        <Write id="b9hl-q" x={1365} y={330} size={58} p={said} label="قال النبي" />
        <Txt x={1365} y={410} size={36} q={salla} color={C.inkSoft}>صلى الله عليه وسلم</Txt>
      </g>} />
  );
});

// ─── c2-s21 أعيد في RoadShot ───

// ─── c2-s22: باب «التعارف» ───
const GateWord = reverent((q) => {
  const k = cueKit(q, ["الاختلاف"]);
  const near = k.draw(0, "الاختلاف", 1.0);
  const gate = k.draw(0, "بابا", 1.2);
  const word = k.on(0, "للتعارف", 0.6);
  const meet = k.draw(0, "للتعارف", 0.8);
  const fakhr = k.on(0, "للتفاخر", 0.6);
  const cam = k.cam(NEUTRAL, [[0, "بابا", { cx: 1365, cy: 560, s: 1.25 }, 1.2]]);
  const ax = mix(1560, 1440, near), bx = mix(1170, 1290, near);
  return (
    <Leaf q={q} id="b9g" cam={cam}
      R={<g>
        <Ink d={`M1720 860 Q1620 760 ${ax} 720`} p={1} w={6} c={C.ink} />
        <Ink d={`M1010 860 Q1110 760 ${bx} 720`} p={1} w={6} c={CLAY} />
        <Ink d={`M${ax} 720 L1370 700`} p={meet} w={6} c={C.ink} />
        <Ink d={`M${bx} 720 L1360 700`} p={meet} w={6} c={CLAY} />
        <g transform="translate(1365 700) scale(0.5) translate(-1360 -722)">
          {GATE.map((d, i) => <Ink key={i} d={d} p={prog(gate, i / GATE.length * 0.6, i / GATE.length * 0.6 + 0.4)} w={6} />)}
        </g>
        <Txt x={1365} y={500} size={44} q={word} color={C.ink}>للتعارف</Txt>
        <Txt x={1650} y={300} size={32} q={fakhr * 0.4} color={C.inkSoft}>للتفاخر</Txt>
      </g>} />
  );
});

// ─── c2-s25: الخيط تحت الطرق ───
const UNDER = "M1740 640 C1560 620 1400 580 1250 560 C1080 540 980 520 900 520 C760 520 640 560 520 560 C400 560 300 500 180 480";
const UnderThread = reverent((q) => {
  const k = cueKit(q, ["والتعارف"]);
  const word = k.draw(0, "والتعارف", 0.9);
  const sheer = k.on(0, "معنى", 1.0);
  const thread = k.draw(0, "السلسلة", 1.4);
  const cam = k.cam(NEUTRAL, [[0, "معنى", { cx: 1100, cy: 540, s: 1.1 }, 1.2], [0, "السلسلة", NEUTRAL, 1.0]]);
  const both = (
    <g>
      <Grain />
      <rect x={150} y={80} width={1630} height={860} fill="#FFF8E8" opacity={0.35 * sheer} />
      <path d={UNDER} fill="none" stroke={C.ribbon} strokeWidth={6} opacity={0.18 * sheer * (1 - thread)} />
      <Ink d={UNDER} p={thread} w={6} c={C.ribbon} />
      <Roads g={[1, 1, 1, 1]} o={1 - 0.35 * sheer} dust={1} />
    </g>
  );
  return <Leaf q={q} id="b9u" cam={cam} L={both} R={<g>{both}<Write id="b9u-w" x={1600} y={420} size={48} p={word} label="التعارف" /></g>} />;
});

// ─── c2-s26: طرق العيش عند أطراف الطرق ───
const Ways = reverent((q) => {
  const k = cueKit(q, ["تفرقت"]);
  const { t } = k;
  const ext = k.draw(0, "تفرقت", 1.0);
  const tongue = k.on(0, "ألسنتها");
  const tone = k.on(0, "وألوانها", 0.9);
  const w0 = k.at("وطرق", 0.5);
  const icons = [0, 1, 2].map((i) => prog(t, w0 + i * 0.4 - 0.05, w0 + i * 0.4 + 0.45));
  const cam = k.cam(NEUTRAL, [[0, "وطرق", { cx: 520, cy: 480, s: 1.1 }, 1.2]]);
  const both = (
    <g>
      <Grain />
      <Roads g={[1, 1, 1, mix(0.5, 1, ext)]} tone={tone} dust={1} />
    </g>
  );
  return (
    <Leaf q={q} id="b9w" cam={cam}
      L={<g>{both}
        <Txt x={250} y={410} size={34} q={tongue} color={C.inkSoft}>ألسنتها</Txt>
        <g opacity={icons[0]} transform={`translate(640 210) scale(${0.9 * (0.7 + 0.3 * icons[0]!)})`}><Tent /></g>
        <g opacity={icons[1]} transform={`translate(250 600) scale(${0.8 * (0.7 + 0.3 * icons[1]!)})`}><Wheat /></g>
        <g opacity={icons[2]} transform={`translate(520 850) scale(${0.7 * (0.7 + 0.3 * icons[2]!)})`}><Boat /></g>
      </g>}
      R={both} />
  );
});

// ─── c2-s27: رقاع القصص عند الأطراف ───
const SLIPS: Pt[] = [[1640, 250], [1200, 230], [560, 240], [300, 560]];
const Retold = reverent((q) => {
  const k = cueKit(q, ["يحفظون"]);
  const { t } = k;
  const slip = k.on(0, "قصة", 0.6);
  const more = k.draw(0, "ويزيدون", 0.9);
  const less = k.on(0, "وينقصون", 0.6);
  const r0 = k.at("روايات", 0.3);
  const seals = SLIPS.map((_, i) => prog(t, r0 + i * 0.25 - 0.05, r0 + i * 0.25 + 0.4));
  const mixC = k.draw(0, "واختلطت", 1.0);
  const truth = k.draw(0, "الحقيقة", 0.8);
  const pride = k.draw(0, "الفخر", 0.8);
  const cam = k.cam(NEUTRAL, [
    [0, "قصة", { cx: 1400, cy: 300, s: 1.2 }, 1.1],
    [0, "روايات", NEUTRAL, 1.0],
    [0, "الحقيقة", { cx: 1300, cy: 620, s: 1.25 }, 1.0],
  ]);
  const slips = (side: "l" | "r") => SLIPS.filter(([x]) => (side === "r" ? x > 960 : x < 960)).map(([x, y]) => {
    const i = SLIPS.findIndex((s) => s[0] === x);
    return (
      <Slip key={i} x={x} y={y} w={210} h={130} q={slip} rot={i % 2 ? 4 : -4} dx={0}>
        <Scribble x={85} y={-35} w={160} n={2} p={1} gap={26} seed={i + 30} c={C.ink} o={0.6} />
        <Scribble x={85} y={17} w={160} n={2} p={more} gap={26} seed={i + 40} c={i === 0 && mixC > 0 ? C.ribbon : C.ink} o={0.6} />
        {i === 0 ? <Scribble x={85} y={-30} w={150} n={3} p={mixC} gap={24} seed={77} c={CLAY} o={0.6} /> : null}
        {/* «ينقصون»: فراغات تنقطع فيها السطور (لا شطب) */}
        {[[-20, -35], [30, -9], [-40, 17]].map(([gx, gy], j) => <rect key={j} x={gx! - 22} y={gy! - 6} width={44} height={12} fill="#FBF3E2" opacity={less} />)}
        <Seal x={-60} y={44} q={seals[i]!} kind="رواية" s={0.35} />
      </Slip>
    );
  });
  return (
    <Leaf q={q} id="b9t" cam={cam}
      L={<g><Roads g={[1, 1, 1, 1]} o={0.3} />{slips("l")}</g>}
      R={<g><Roads g={[1, 1, 1, 1]} o={0.3} />{slips("r")}
        <g transform="rotate(-5 1300 620)"><Write id="b9t-h" x={1330} y={610} size={56} p={truth} label="الحقيقة" color={C.ink} /></g>
        <g transform="rotate(7 1300 640)"><Write id="b9t-f" x={1290} y={650} size={56} p={pride} label="الفخر" color={EMBER} /></g>
      </g>} />
  );
});

// ─── c2-s28: الخيط يجمع الأطراف، والعقدة التاسعة ───
const GATHER = "M1745 115 C1600 200 1400 90 1250 105 C1000 130 760 60 520 130 C380 170 170 300 175 470 C180 600 380 720 470 860 C520 780 560 740 620 720";
const Gather = reverent((q) => {
  const k = cueKit(q, ["ودفترنا"]);
  const fade = k.on(0, "فخر", 0.8);
  const thread = k.draw(0, "الخيط", 1.8);
  const tie = k.on(0, "يجمعهم", 0.8);
  const cam = k.cam({ cx: 1300, cy: 360, s: 1.3 }, [[0, "ودفترنا", NEUTRAL, 1.3], [0, "يجمعهم", { cx: 640, cy: 700, s: 1.3 }, 1.0]]);
  const both = (
    <g>
      <Grain />
      <Roads g={[1, 1, 1, 1]} dust={1} />
      {SLIPS.map(([x, y], i) => (
        <g key={i} opacity={0.8 * (1 - fade)}><rect x={x - 90} y={y - 55} width={180} height={110} rx={6} fill="#FBF3E2" stroke={C.ink} strokeWidth={2} /></g>
      ))}
      <Ink d={GATHER} p={thread} w={6} c={C.ribbon} />
      {TIPS.map(([x, y], i) => <Ring key={i} x={x} y={y} r={12} p={prog(thread, 0.1 + i * 0.16, 0.25 + i * 0.16)} c={C.ribbon} w={3} />)}
      <g transform="translate(620 720)">
        <Ring x={0} y={0} r={22 * (1 - 0.5 * tie)} p={prog(thread, 0.9, 1)} c={C.ribbon} w={5} />
        {tie > 0 ? <path d="M-14 -2 C-14 -16 14 -16 14 -2 C14 12 -14 12 -14 -2 Z" fill={C.ribbon} stroke="#8E1F17" strokeWidth={3} opacity={tie} /> : null}
        <Q x={0} y={-40} size={60} q={prog(thread, 0.9, 1) * (1 - tie)} color={C.ribbon} />
        <Txt x={0} y={60} size={28} q={tie} color={C.ink}>ذرية نوح</Txt>
      </g>
    </g>
  );
  return <Leaf q={q} id="b9ga" cam={cam} L={both} R={both} />;
});

// ─── c2-s29..s31: عقد البدايات التسع برموز حلقاتها ───
const SYM_W: [number, string][] = [[1, "بخلق"], [1, "أول"], [1, "والأجيال"], [1, "الشرك"], [2, "دعوة"], [2, "والسفينة"], [2, "والطوفان"], [2, "والجودي"]];
const Series = reverent((q) => {
  const k = cueKit(q, ["تختم", "بدأنا", "دعوة"]);
  const head = k.on(0, "البدايات", 0.7);
  const lit = SYM_W.map(([sc, w]) => k.on(sc, w, 0.6));
  const knots: KnotDef[] = KX.map((x, i) => ({ x, kind: "tied", q: 1, label: KNAMES[i], lq: 0.7, glow: i < 8 ? lit[i]! * 0.8 : 0, sym: i < 8 ? <Sym k={i} q={lit[i]!} /> : undefined }));
  const cam = k.cam(NEUTRAL, [
    [0, "البدايات", { cx: 1400, cy: 420, s: 1.1 }, 1.0],
    [1, "بخلق", { cx: 1500, cy: 560, s: 1.35 }, 1.0],
    [1, "والأجيال", { cx: 1300, cy: 560, s: 1.35 }, 1.2],
    [2, "دعوة", { cx: 1000, cy: 560, s: 1.3 }, 1.2],
    [2, "والطوفان", { cx: 640, cy: 560, s: 1.3 }, 1.2],
  ]);
  const both = <Thread x1={1760} x2={200} y={600} p={1} knots={knots} labelDy={50} labelSize={22} w={5} />;
  return <Leaf q={q} id="b9s" cam={cam} L={both} R={<g>{both}{head > 0 ? <ChapterHead label="البدايات" o={head} /> : null}</g>} />;
});

// ─── c2-s32: الأختام الأربعة تحت الخيط ───
const Seals = reverent((q) => {
  const k = cueKit(q, ["فرقنا"]);
  const s = [k.on(0, "ثبت", 0.5), k.on(0, "رواية", 0.5), k.on(0, "تقدير", 0.5), k.on(0, "نعلمه", 0.5)];
  const cam = k.cam(NEUTRAL, [
    [0, "ثبت", { cx: 1450, cy: 560, s: 1.15 }, 0.9],
    [0, "رواية", { cx: 1180, cy: 560, s: 1.15 }, 0.9],
    [0, "تقدير", { cx: 780, cy: 560, s: 1.15 }, 0.9],
    [0, "نعلمه", { cx: 520, cy: 560, s: 1.15 }, 0.9],
  ]);
  const knots: KnotDef[] = KX.map((x, i) => ({ x, kind: "tied", q: 1, glow: 0.5, sym: i < 8 ? <Sym k={i} q={1} /> : undefined }));
  const ROW: [number, string][] = [[1550, "ثابت"], [1180, "رواية"], [760, "تقدير"], [380, "لا نعلم"]];
  const both = (
    <g>
      <Thread x1={1760} x2={200} y={420} p={1} knots={knots} w={5} />
      {ROW.map(([x, kind], i) => <Seal key={i} x={x} y={650} q={s[i]!} kind={kind} s={0.7} />)}
    </g>
  );
  return <Leaf q={q} id="b9se" cam={cam} L={both} R={both} />;
});

// ─── c2-s33: الخيط يتفرع (الغلاف المرشح) ───
const FKX = [1700, 1625, 1550, 1475, 1400, 1325, 1250, 1175, 1100];
const FORKS = [
  "M1060 560 C900 520 820 360 700 270",
  "M1060 560 C860 560 600 440 370 410",
  "M1060 560 C880 600 700 640 540 650",
  "M1060 560 C860 640 500 760 280 760",
];
const FTIPS: Pt[] = [[700, 270], [370, 410], [540, 650], [280, 760]];
const Fork = reverent((q) => {
  const k = cueKit(q, ["يتفرع"]);
  const { t } = k;
  const fork = prog(t, k.at("يتفرع", 1.4) - 0.05, k.at("يتفرع", 1.4) + 1.4);
  const dots = k.draw(0, "انتشروا", 1.0);
  const v = k.on(0, "قرى", 0.6), c = k.on(0, "مدنا", 0.6), g = k.draw(0, "ممالك", 1.0), a = k.draw(0, "آثارها", 1.0);
  const cam = k.cam({ cx: 1300, cy: 560, s: 1.3 }, [
    [0, "يتفرع", { cx: 900, cy: 540, s: 1.05 }, 1.4],
    [0, "قرى", { cx: 620, cy: 400, s: 1.2 }, 1.0],
    [0, "آثارها", { cx: 520, cy: 640, s: 1.15 }, 1.0],
  ]);
  const knots: KnotDef[] = FKX.map((x, i) => ({ x, kind: "tied", q: 1, glow: i === 8 ? 0.8 : 0.3 }));
  const both = (
    <g>
      <Thread x1={1760} x2={1060} y={560} p={1} knots={knots} sag={2} w={6} />
      {FORKS.map((d, i) => <Ink key={i} d={d} p={prog(fork, i * 0.1, 0.6 + i * 0.1)} w={5} c={C.ribbon} />)}
      {FORKS.map((_, i) => [0.3, 0.55, 0.8].map((f, j) => {
        const [tx, ty] = FTIPS[i]!;
        return <Dot key={`${i}-${j}`} x={mix(1060, tx, f)} y={mix(560, ty, f) + (j % 2 ? -14 : 12)} r={6} q={prog(dots, (i * 3 + j) / 12, (i * 3 + j) / 12 + 0.2)} />;
      }))}
      <g opacity={v} transform={`translate(700 240) scale(${0.55 * (0.8 + 0.2 * v)})`}><Village /></g>
      <g opacity={c} transform="translate(370 385)">
        {[0, 1, 5].map((gi, i) => <path key={i} d={GLYPHS[gi]} transform={`translate(${(i - 1) * 62} 0) scale(0.9)`} fill="#E8D6B3" stroke={C.ink} strokeWidth={3} strokeLinejoin="round" />)}
      </g>
      <g transform="translate(540 640) scale(0.26) translate(-1360 -722)">
        {GATE.map((d, i) => <Ink key={i} d={d} p={prog(g, i / GATE.length * 0.6, i / GATE.length * 0.6 + 0.4)} w={12} />)}
      </g>
      <g transform="translate(300 770) scale(0.32) translate(-1370 -700)">
        {RUINS.map((d, i) => <Ink key={i} d={d} p={prog(a, i / RUINS.length * 0.6, i / RUINS.length * 0.6 + 0.4)} w={10} />)}
      </g>
      <g opacity={a}><FindAt k="tool" x={190} y={720} s={0.4} p={a} /></g>
    </g>
  );
  return <Leaf q={q} id="b9f" cam={cam} L={both} R={both} />;
});

// ─── c2-s34: الدفتر يتسع إلى أطلس ───
const TICKS = [1700, 1500, 1300, 1100, 820, 620, 420, 220];
const Atlas = reverent((q) => {
  const k = cueKit(q, ["القادمة"]);
  const wide = k.on(0, "القادمة", 1.2);
  const branch = k.draw(0, "الحضارات", 1.0);
  const r1 = k.draw(0, "حدث", 1.2);
  const world = k.draw(0, "العالم", 1.2);
  const r2 = k.draw(0, "نفسه", 1.2);
  const cam = k.cam({ cx: 1100, cy: 480, s: 1.15 }, [
    [0, "القادمة", NEUTRAL, 1.4],
    [0, "حدث", { cx: 960, cy: 600, s: 1.0 }, 1.0],
  ]);
  const ruler = (y: number, p: number, c: string) => (
    <g>
      <Ink d={`M1740 ${y} H180`} p={p} w={5} c={c} />
      {TICKS.map((x, i) => <path key={i} d={`M${x} ${y - 14} V${y + 14}`} stroke={c} strokeWidth={4} opacity={prog(p, (1740 - x) / 1560 - 0.05, (1740 - x) / 1560 + 0.05)} />)}
    </g>
  );
  const both = (
    <g>
      {ruler(640, r1, C.ink)}
      {ruler(780, r2, GOLD_D)}
      {TICKS.map((x, i) => <path key={i} d={`M${x} 656 V764`} stroke={C.inkSoft} strokeWidth={2} strokeDasharray="6 8" opacity={prog(r2, (1740 - x) / 1560, (1740 - x) / 1560 + 0.1)} />)}
    </g>
  );
  // الدفتر يُبسط على عرضه: ورقتان إضافيتان تنفتحان خارج حافتي الصفحتين (تحت الدفتر)
  const under = (
    <g opacity={wide}>
      <path d={`M150 100 L${mix(150, 30, wide)} 110 V930 L150 934 Z`} fill="#EFE0C2" stroke={C.ink} strokeWidth={3} />
      <path d={`M1770 100 L${mix(1770, 1890, wide)} 110 V930 L1770 934 Z`} fill="#EFE0C2" stroke={C.ink} strokeWidth={3} />
    </g>
  );
  return (
    <Book id="b9at" t={q.t} dur={q.dur} exit={q.exit} from={q.from} cam={cam} under={under}
      L={<g>{both}<Globe x={520} y={360} r={150} p={world} spin={q.t} /></g>}
      R={<g>{both}
        <Thread x1={1760} x2={1080} y={330} p={branch} knots={[{ x: 1200, kind: "ring", q: branch, tie: 0, mark: branch }]} w={5} />
        <Write id="b9at-h" x={1450} y={270} size={54} p={branch} label="الحضارات" />
      </g>} />
  );
});

export const BD09_SCENES: Record<string, React.FC<BdProps>> = {
  "bd09-road": RoadShot,
  "bd09-knots": KnotsShot,
  "bd09-after-water": AfterWater,
  "bd09-ledger": Ledger,
  "bd09-hadith-lead": HadithLead,
  "bd09-gate-word": GateWord,
  "bd09-under-thread": UnderThread,
  "bd09-ways": Ways,
  "bd09-retold": Retold,
  "bd09-gather": Gather,
  "bd09-series": Series,
  "bd09-seals": Seals,
  "bd09-fork": Fork,
  "bd09-atlas": Atlas,
};

/** مشهد الصورة الثابتة للمراجعة لكل لقطة (المعرّف في الخطة)؛ الغائب = آخر مشهد يستعمل اللقطة، عند نهاية آخر كلمة */
export const BD09_STILLS: Record<string, string> = {
  "bd09-road": "c2-s1",
  "bd09-knots": "c2-s3",
};
