/**
 * «دفاتر الزمن 006 — السفينة»: لقطات «خط الأفق» الجديدة كما في خطة المشاهد (scenes.md، D214).
 * لا تصوير لنوح عليه السلام ولا لأحد بأي هيئة، ولا تُرسم السفينة كاملة «كما كانت» ولا يُكتب رقم لمقاساتها:
 * ألواح وما يشدّها وأرض يابسة فقط. «ورقة البنّاء» شبكة باهتة بلا أرقام، والمساطر بلا تدريج.
 * كل حدث على كلمته (cueKit)، والسكون عند كلمات الذكر بالزمن المرئي (reverent).
 */
import React from "react";
import { Books, Hourglass } from "../lib/drawings";
import {
  C, Dot, DotFrame, Field, GOLD_D, GoldSeal, Horizon, Ink, Leaf, NEUTRAL, Peak, Plank, Q, Ring, Scribble, Seal, Sheet, Tab, Thread, Txt, WATER, Write,
  bounce, crackPath, cueKit, mix, prog, reverent, rng, type BdProps, type KnotDef,
} from "./kit";

const DRY = 620;
const TY = 820;
const KX = [1680, 1580, 1480, 1380, 1280];
const K6 = 1060;
const K7 = 640;
/** موضع رأس الخيط لنسبة p (من 1760 إلى 160) */
const pFor = (x: number) => (1760 - x) / 1600;

/** «ورقة البنّاء»: شبكة مسطّرة باهتة بالأزرق بلا أرقام ولا مقاييس */
const Grid: React.FC<{ o?: number }> = ({ o = 1 }) => (
  <g opacity={0.13 * o}>
    {Array.from({ length: 28 }, (_, i) => <path key={`v${i}`} d={`M${160 + i * 60} 90 V900`} stroke={WATER} strokeWidth={1.6} />)}
    {Array.from({ length: 14 }, (_, i) => <path key={`h${i}`} d={`M150 ${100 + i * 60} H1770`} stroke={WATER} strokeWidth={1.6} />)}
  </g>
);

const CRACKS = [
  crackPath(1640, 700, 1480, 760, 3, 6, 8),
  crackPath(1300, 680, 1160, 740, 7, 6, 8),
  crackPath(860, 720, 700, 690, 11, 6, 8),
  crackPath(520, 690, 330, 760, 13, 7, 9),
  crackPath(1450, 830, 1260, 860, 17, 6, 7),
  crackPath(640, 840, 420, 860, 19, 6, 7),
];
/** الأرض اليابسة إلى الأفق بشقوق خفيفة (cr نسبة الشقوق) */
const Dry: React.FC<{ p?: number; cr?: number; grid?: number }> = ({ p = 1, cr = 1, grid = 1 }) => (
  <g>
    <Horizon y={DRY} p={p} sky="noon" ground="#D8C49A" texture={0.7} />
    {grid > 0 ? <Grid o={grid} /> : null}
    {CRACKS.map((d, i) => <Ink key={i} d={d} p={prog(cr, i / 8, i / 8 + 0.4)} w={2.4} c={C.inkSoft} />)}
  </g>
);

/** ختم قبل أن يُضرب: قالب خشبي مقلوب بإطار حبر */
const Blank: React.FC<{ x: number; y: number; q: number }> = ({ x, y, q }) =>
  q <= 0 ? null : <rect x={x - 80} y={y - 38} width={160} height={76} rx={10} fill={C.page} stroke={C.ink} strokeWidth={4} strokeDasharray="6 6" opacity={q} />;

/**
 * لوحان مسطّحان متجاوران (القطعة المخصوصة): بلا وتد ولا حبل ولا مسمار مرسوم ولا طريقة وصل
 * (المراجعة العلمية، الدفعة ٦ البند ١٣٢: «وفسّر الطبري الدُّسُر بالمسامير» نصًّا على لسان فقط). b يُقرّب اللوح الثاني حتى يستقر بجوار الأول.
 */
const Pair: React.FC<{ x: number; y: number; a: number; b: number; s?: number; glow?: number }> = ({ x, y, a, b, s = 1, glow = 0 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {glow > 0 ? <ellipse cx={0} cy={0} rx={240} ry={90} fill={C.gold} opacity={0.22 * glow} /> : null}
    <Plank x={0} y={-26} w={380} h={34} q={a} />
    <Plank x={0} y={mix(110, 26, b)} w={380} h={34} q={b} />
  </g>
);

/** مسطرة بلا تدريج ولا أرقام، وخانة قيمتها منقّطة فارغة */
const BlankRuler: React.FC<{ x: number; y: number; w?: number; rot?: number; q: number; box?: number }> = ({ x, y, w = 420, rot = 0, q, box = 0 }) =>
  q <= 0 ? null : (
    <g opacity={Math.min(1, q * 1.4)} transform={`translate(${x} ${y}) rotate(${rot}) scale(${0.85 + 0.15 * q})`}>
      <rect x={-w / 2} y={-28} width={w} height={56} rx={6} fill="#D9B680" stroke={C.ink} strokeWidth={4} />
      <rect x={-46} y={-60 - 24} width={92} height={48} rx={6} fill="none" stroke={C.inkSoft} strokeWidth={3} strokeDasharray="8 7" opacity={box} />
    </g>
  );

/** كومة ألواح تُرصّ من الأرض إلى أعلى (لا هيكل سفينة): qs ظهور كل لوح */
const Pile: React.FC<{ x: number; y: number; qs: number[]; shade?: number }> = ({ x, y, qs, shade = 0.25 }) => (
  <g>
    <ellipse cx={x + 20} cy={y + 24} rx={260} ry={22} fill="#2B1E14" opacity={shade} />
    {qs.map((q, i) => <Plank key={i} x={x + ((i * 37) % 5 - 2) * 10} y={y - i * 34} w={420 - (i % 3) * 30} h={32} q={q} rot={((i * 53) % 7 - 3) * 0.6} />)}
  </g>
);

/** طريق منقّط يمر عبر الصفحة (طريق لا أشخاص) */
const Road: React.FC<{ y: number; q: number; x1?: number; x2?: number }> = ({ y, q, x1 = 1760, x2 = 160 }) =>
  q <= 0 ? null : <path d={`M${x1} ${y} C${mix(x1, x2, 0.3)} ${y - 18} ${mix(x1, x2, 0.6)} ${y + 18} ${x2} ${y}`} fill="none" stroke={C.inkSoft} strokeWidth={4} strokeDasharray="4 16" strokeLinecap="round" opacity={q} />;

/** علامات حبر مطموسة غير مقروءة داخل خانة (لا رقم حقيقي) */
const Smudge: React.FC<{ x: number; y: number; q: number; seed?: number }> = ({ x, y, q, seed = 1 }) => {
  if (q <= 0) return null;
  const r = rng(seed * 7 + 3);
  return (
    <g opacity={0.7 * q}>
      {Array.from({ length: 5 }, (_, i) => <ellipse key={i} cx={x - 70 + r() * 140} cy={y - 20 + r() * 40} rx={14 + r() * 18} ry={8 + r() * 8} fill={C.inkSoft} opacity={0.35} />)}
      <Scribble x={x + 70} y={y - 14} w={140} n={2} p={q} gap={28} seed={seed} c={C.inkSoft} o={0.7} />
    </g>
  );
};

/** خانة بإطار حبر واسمها */
const Box: React.FC<{ x: number; y: number; w?: number; h?: number; q: number; label?: string }> = ({ x, y, w = 320, h = 170, q, label }) =>
  q <= 0 ? null : (
    <g opacity={Math.min(1, q * 1.4)}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={10} fill="rgba(251,244,230,0.6)" stroke={C.ink} strokeWidth={4} />
      {label ? <Txt x={x + w / 2 - 20} y={y - h / 2 + 42} size={32} q={1} anchor="start" color={C.ink}>{label}</Txt> : null}
    </g>
  );

/** خيط السلسلة على حافة ورقة البنّاء */
const SeriesThread: React.FC<{ p: number; k5?: number; glow5?: number; x5?: number; k6?: number; tie6?: number; l6?: number; glow6?: number; k7?: number; l7?: number }> = ({ p, k5 = 1, glow5 = 0, x5 = KX[4]!, k6 = 0, tie6 = 1, l6 = 0, glow6 = 0, k7 = 0, l7 = 0 }) => {
  const knots: KnotDef[] = [
    ...KX.slice(0, 4).map((x, i) => ({ x, kind: "tied" as const, q: 1, label: ["١", "٢", "٣", "٤"][i] })),
    { x: x5, kind: "tied", q: k5, glow: glow5, label: "٥" },
    { x: K6, kind: "plank", q: k6, tie: tie6, glow: glow6, label: "السفينة", lq: l6 },
    { x: K7, kind: "ring", q: k7, tie: 0, label: "الطوفان", lq: l7 },
  ];
  return <Thread x1={1760} x2={160} y={TY} p={p} knots={knots} labelDy={52} labelSize={28} />;
};

// ─── c1-s1: لوح واحد على الأرض، وطريق المارّين ───
const PlankShot = reverent((q) => {
  // التحرير النهائي للمحرر (٢٧ نوفمبر): الافتتاح «كان قوم نوح عليه السلام يمرّون به وهو يبني السفينة فيسخرون منه. ماذا قال لهم، وماذا نعرف
  // عن السفينة التي كان يبنيها؟» بدل «كيف تبني سفينة في أرض لا بحر فيها؟» و«ولماذا يبنيها رجل يعرف قومه أنه لا يكذب؟» (حُذفتا):
  // حُذفت لقطة الأرض اليابسة وخط البحر الذي لا يكتمل (bd06-dryland في BD_REMOVED: الجزم بطبيعة أرض البناء بانتظار التحقق) وكتابة «لا يكذب»؛
  // الأرض بلا شقوق ولا شبكة. «يمرون» ← طريق منقّط بلا أشخاص، «يبني» ← اللوح كما كان، «نعرف» ← «؟» بالحبر، «السفينة» ← الكلمة تحت اللوح
  // المراجعة العلمية (الدفعات ١٤–١٧، ٢٧ نوفمبر): الافتتاح «حين مرّ كبار قوم نوحٍ عليه السلام به وهو يصنع السفينة، سخروا منه. فكيف ردّ عليهم؟» (البندان ٣٣٩ و٣٩٢):
  // الطريق على «كبار»، واللوح على «يصنع»، والكلمة على «السفينة»، و«؟» على «فكيف»
  const k = cueKit(q, ["كبار"]);
  const road = k.draw(0, "كبار", 1.2);
  const plank = k.on(0, "يصنع", 0.7);
  const ask = k.on(0, "فكيف", 0.6);
  const word = k.draw(0, "السفينة", 0.8);
  const cam = k.cam(NEUTRAL, [[0, "يصنع", { cx: 620, cy: 640, s: 1.3 }, 1.2], [0, "فكيف", { cx: 640, cy: 700, s: 1.2 }, 1.1]]);
  return (
    <Leaf q={q} id="b6p" cam={cam} R={<g><Dry cr={0} grid={0} /><Road y={DRY + 150} q={road} /></g>}
      L={<g><Dry cr={0} grid={0} /><Road y={DRY + 150} q={road} />
        <Plank x={580} y={710} w={420} h={40} q={plank} rot={-4} />
        <Write id="b6p-w" x={580} y={810} size={48} p={word} label="السفينة" />
        <Write id="b6p-q" x={860} y={640} size={64} p={ask} label="؟" />
      </g>} />
  );
});

// ─── c1-s3 / c1-s4: الخيط على حافة ورقة البنّاء، وعقدة من خشب ───
const ThreadWood = reverent((q) => {
  const k = cueKit(q, ["الماضية", "نعقد"]);
  const { t, S } = k;
  const pass = S === 0 ? prog(t, k.at("الماضية") - 0.05, k.at("الماضية") + 1.6) : 1;
  const glow5 = S === 0 ? bounce(t, k.at("نوحا"), k.at("نوحا") + 1.6) : 0;
  const long = k.on(0, "زمنا", 1.2);
  const few = k.on(0, "وقلة", 0.6);
  const adv = k.on(1, "نعقد", 1.0);
  const k6 = k.on(1, "عقدة", 0.6);
  const tie6 = S === 1 ? prog(t, k.at("عقدة") + 0.3, k.at("عقدة") + 1.0) : 0;
  const l6 = k.draw(1, "السفينة", 0.8);
  const p = S === 0 ? pass * (pFor(1220) + 0.03) : mix(pFor(1220) + 0.03, pFor(K6) + 0.06, adv);
  const x5 = mix(1290, 1220, long);
  const cam = k.cam({ cx: 960, cy: 700, s: 1.15 }, [
    [0, "نوحا", { cx: 1340, cy: 760, s: 1.45 }, 1.1],
    [0, "وقلة", { cx: 1260, cy: 780, s: 1.55 }, 1.0],
    [1, "نعقد", { cx: 1100, cy: 760, s: 1.4 }, 1.0],
  ]);
  const r = rng(61);
  const both = (
    <g>
      <Dry grid={1} />
      <SeriesThread p={p} x5={x5} glow5={glow5} k6={k6} tie6={tie6} l6={l6} />
      {Array.from({ length: 5 }, (_, i) => <Dot key={i} x={x5 - 30 + r() * 60} y={TY - 40 - r() * 30} r={5} q={prog(few, i / 6, i / 6 + 0.4)} />)}
    </g>
  );
  return <Leaf q={q} id="b6tw" cam={cam} L={both} R={both} />;
});

// ─── c1-s5 / c1-s7: الأختام الثلاثة على الهامش ───
const SealsTray = reverent((q) => {
  const k = cueKit(q, ["أختامنا", "فلنبدأ"]);
  const { t, S } = k;
  const tray = k.on(0, "أختامنا", 0.9);
  const hit = [k.on(0, "ثبت", 0.5), k.on(0, "روي", 0.5), k.on(0, "نعلم", 0.5)];
  const aside = k.on(1, "فلنبدأ", 0.8);
  const go = S === 1 ? prog(t, k.at("ثبت") - 0.05, k.at("ثبت") + 0.8) : 0;
  const ROW = [[330, "ثابت"], [520, "رواية"], [710, "لا نعلم"]] as const;
  const cam = k.cam(NEUTRAL, [
    [0, "أختامنا", { cx: 560, cy: 520, s: 1.3 }, 1.0],
    [1, "ثبت", { cx: 1100, cy: 360, s: 1.1 }, 1.0],
  ]);
  const L = (
    <g>
      <Grid />
      {ROW.map(([y, kind], i) => {
        const off = i === 0 ? 0 : aside;
        const x = mix(-120, 420, tray) - 260 * off;
        const yy = i === 0 ? mix(y, 300, go) : y;
        const xx = i === 0 ? mix(x, 1365, go) : x;
        if (i === 0 && go > 0) return null;
        return (
          <g key={i} opacity={1 - off}>
            <Blank x={xx} y={yy} q={tray * (1 - hit[i]!)} />
            <Seal x={xx} y={yy} q={hit[i]!} kind={kind} s={0.62} />
          </g>
        );
      })}
    </g>
  );
  const R = (
    <g>
      <Grid />
      {go > 0 ? <Seal x={mix(380, 1365, go)} y={mix(330, 230, go)} q={1} kind="ثابت" s={mix(0.62, 0.85, go)} /> : null}
      <Ink d="M1700 300 H1030" p={go} w={3} c={C.inkSoft} />
    </g>
  );
  return <Leaf q={q} id="b6st" cam={cam} L={L} R={R} />;
});

// ─── c1-s6: كومة أوراق وورقة صغيرة ───
const PileShot = reverent((q) => {
  const k = cueKit(q, ["أكثر"]);
  const { t } = k;
  const many = prog(t, k.at("أكثر") - 0.05, k.end("عنه") + 0.3);
  const small = k.on(0, "أقل", 0.8);
  const seal = k.on(0, "بيقين", 0.5);
  const r = rng(66);
  const sheets = Array.from({ length: 9 }, (_, i) => ({ x: 1365 + (r() - 0.5) * 120, y: 560 - i * 14 + (r() - 0.5) * 20, rot: (r() - 0.5) * 16 }));
  const cam = k.cam(NEUTRAL, [[0, "أكثر", { cx: 1365, cy: 520, s: 1.2 }, 1.0], [0, "أقل", { cx: 800, cy: 520, s: 1.05 }, 1.0]]);
  return (
    <Leaf q={q} id="b6pi" cam={cam}
      L={<g><Grid />
        <Sheet x={mix(1100, 600, small)} y={520} w={220} h={150} q={small} rot={-3}>
          <Scribble x={80} y={-30} w={150} n={2} p={small} gap={30} seed={4} o={0.5} />
        </Sheet>
        <Seal x={600} y={610} q={seal} kind="ثابت" s={0.5} />
      </g>}
      R={<g><Grid />
        {sheets.map((s, i) => (
          <Sheet key={i} x={s.x} y={s.y} w={360} h={250} q={prog(many, i / 9, i / 9 + 0.18)} rot={s.rot}>
            <Scribble x={140} y={-80} w={270} n={5} p={1} gap={34} seed={i + 3} o={0.4} />
          </Sheet>
        ))}
      </g>} />
  );
});

/** خانة مرقّمة بالحروف على هامش الصفحة اليسرى: mark يعلّمها بنقطة حمراء */
const Mark: React.FC<{ y: number; q: number; label: string; mark: number; children?: React.ReactNode }> = ({ y, q, label, mark, children }) =>
  q <= 0 ? null : (
    <g opacity={Math.min(1, q * 1.4)}>
      <rect x={250} y={y - 70} width={620} height={140} rx={10} fill="rgba(251,244,230,0.5)" stroke={C.ink} strokeWidth={3} />
      <Txt x={850} y={y - 22} size={34} q={1} anchor="start" color={C.ink}>{label}</Txt>
      <Ring x={720} y={y - 34} r={14} p={mark} c={C.ribbon} w={4} fill={C.ribbon} fillO={0.9} />
      {children}
    </g>
  );

// ─── c1-s10..s13: ثلاث علامات على الهامش ───
const ThreeMarks = reverent((q) => {
  const k = cueKit(q, ["نقف", "الأول", "والثاني", "والثالث"]);
  const { t, S } = k;
  const boxes = k.on(0, "ثلاثة", 0.8);
  const ref = k.on(0, "الآيات");
  const m1 = k.on(1, "الأول"), m2 = k.on(2, "والثاني"), m3 = k.on(3, "والثالث");
  // الدفعة ٦ البند ١٣٤: «أمر… فصنعها بوحيٍ من ربّه، وفي حفظه وعنايته» كلماتٍ بلا رمز
  const p1 = k.on(1, "يصنع", 0.7);
  const amr = k.draw(1, "أمر", 0.7), wahy = k.draw(1, "بوحي", 0.7), inaya = k.draw(1, "حفظه", 0.9);
  const road = k.draw(2, "يمرون", 1.2);
  const p2 = k.on(2, "يبني", 0.7);
  const mock = k.on(2, "فيسخرون", 0.7);
  const anger = S === 3 ? bounce(t, k.at("غضبا"), k.at("غضبا") + 1.6) * 0.6 : 0;
  const yaqin = k.draw(3, "يقينا", 0.8);
  const dawn = k.draw(3, "العاقبة", 1.4);
  const cam = k.cam(NEUTRAL, [
    [0, "ثلاثة", { cx: 600, cy: 500, s: 1.2 }, 1.0],
    [1, "يصنع", { cx: 1300, cy: 640, s: 1.2 }, 1.0],
    [1, "بوحي", { cx: 600, cy: 360, s: 1.35 }, 1.0],
    [2, "يمرون", { cx: 1300, cy: 700, s: 1.15 }, 1.2],
    [3, "غضبا", { cx: 600, cy: 700, s: 1.3 }, 1.0],
    [3, "العاقبة", NEUTRAL, 1.2],
  ]);
  const L = (
    <g>
      <Grid />
      <GoldSeal x={560} y={170} q={ref} label="هود ٣٧–٣٩" s={0.85} />
      <Mark y={340} q={boxes} label="أولًا" mark={m1}>
        <Write id="b6tm-a" x={620} y={362} size={40} p={amr} label="أمر" font="tajawal" />
        <Write id="b6tm-w" x={450} y={362} size={40} p={wahy} label="بوحي" font="tajawal" />
        <Write id="b6tm-i" x={530} y={402} size={30} p={inaya} label="حفظه وعنايته" font="tajawal" color={C.inkSoft} />
      </Mark>
      <Mark y={520} q={boxes} label="ثانيًا" mark={m2}>
        <Txt x={480} y={560} size={36} q={mock} color={C.inkSoft} weight={500}>يسخرون</Txt>
      </Mark>
      <Mark y={700} q={boxes} label="ثالثًا" mark={m3}>
        <Txt x={600} y={740} size={38} q={anger} color={C.inkSoft} weight={500}>غضبًا</Txt>
        <Write id="b6tm-y" x={420} y={742} size={42} p={yaqin} label="يقينًا" />
      </Mark>
      <Ink d={`M160 ${DRY} H960`} p={dawn} w={6} c={C.ink} />
    </g>
  );
  const R = (
    <g>
      <Dry />
      <Road y={790} q={road} x2={980} />
      <Plank x={1330} y={720} w={420} h={36} q={p1} rot={-2} />
      <Plank x={1350} y={686} w={380} h={34} q={p2} rot={1.5} />
      <Txt x={1200} y={850} size={34} q={mock * 0.6} color={C.inkSoft} weight={500}>يسخرون</Txt>
      <Ink d={`M960 ${DRY} H1770`} p={prog(dawn, 0.4, 1)} w={6} c={C.ink} />
    </g>
  );
  return <Leaf q={q} id="b6tm" cam={cam} L={L} R={R} />;
});

// ─── c1-s14: ألواح تُرصّ على اليابسة ───
const PlanksRise = reverent((q) => {
  // المراجعة العلمية (الدفعات ١٤–١٧، ٢٧ نوفمبر): «كان نوح عليه السلام يصنع السفينة، وكان الملأ من قومه يمرّون به فيسخرون.» بلا «كبيرة» ولا «على اليابسة» (البند ٣٤٠):
  // اللوحان على «يصنع»، وظل الكومة على «السفينة»، والطريق على «يمرون»، واللوح الخامس على «فيسخرون»؛ الأرض بلا شقوق
  const k = cueKit(q, ["الملأ"]);
  const { t } = k;
  const a = prog(t, k.at("يصنع") - 0.05, k.at("يصنع") + 0.4), b = prog(t, k.at("يصنع") + 0.35, k.at("يصنع") + 0.8);
  const shade = k.on(0, "السفينة", 0.8);
  const road = k.draw(0, "يمرون", 1.2);
  const fifth = k.on(0, "فيسخرون", 0.6);
  const cam = k.cam({ cx: 1300, cy: 640, s: 1.3 }, [[0, "الملأ", NEUTRAL, 1.4]]);
  return (
    <Leaf q={q} id="b6pr" cam={cam} L={<g><Dry cr={0} grid={0} /><Road y={800} q={road * 0.6} /></g>}
      R={<g><Dry cr={0} grid={0} /><Road y={800} q={road * 0.6} />
        <Pile x={1320} y={740} qs={[1, 1, a, b, fifth]} shade={0.15 + 0.25 * shade} />
      </g>} />
  );
});

// ─── c1-s18 / c1-s19 / c1-s30: اللوحان المتجاوران والدُّسُر (بلا وتد ولا حبل، الدفعة ٦ البند ١٣٢) ───
const Dusur = reverent((q) => {
  // المراجعة العلمية (الدفعات ١٤–١٧، ٢٧ نوفمبر): c1-s30 صارت «وصف القرآن السفينة بالألواح والدُّسُر، وهذا ما نعرفه.» بدل «سترى ألواحًا، وأرضًا يابسة…» (البند ٣٤٠):
  // اللوحان على «بالألواح»، وكلمة «الدُّسُر» على «والدسر»، وختم «ثابت» على «نعرفه»؛ حُذفت الأرض اليابسة
  const k = cueKit(q, ["المسطح", "وصفه", "بالألواح"]);
  const { S } = k;
  const a = S === 2 ? k.on(2, "بالألواح", 0.7) : k.on(0, "الألواح", 0.7);
  const b = S === 2 ? a : k.on(0, "المسطح", 0.9);
  const tab = k.on(0, "الطبري");
  const word = S === 2 ? k.draw(2, "والدسر", 0.9) : k.draw(0, "الدسر", 0.9);
  const nails = k.draw(0, "بالمسامير", 0.9);
  const seal = S === 2 ? k.on(2, "نعرفه") : k.on(1, "القرآن");
  const lw = k.draw(1, "ألواح", 0.8);
  const hold = k.draw(1, "يشدها", 0.9);
  const ground = S === 1 ? 1 : 0;
  const cam = k.cam({ cx: 1365, cy: 520, s: 1.3 }, [
    [0, "الطبري", { cx: 1480, cy: 380, s: 1.2 }, 1.0],
    [0, "بالمسامير", { cx: 1500, cy: 300, s: 1.3 }, 1.0],
    [1, "القرآن", { cx: 1365, cy: 560, s: 1.15 }, 1.0],
    [2, "والدسر", NEUTRAL, 1.2],
  ]);
  const land = <g opacity={ground}><Dry p={ground} grid={0} /></g>;
  return (
    <Leaf q={q} id="b6du" cam={cam} L={<g><Grid />{land}</g>}
      R={<g><Grid />{land}
        <Pair x={1365} y={520} a={a} b={b} />
        <Write id="b6du-d" x={1365} y={420} size={56} p={S === 0 || S === 2 ? word : 0} label="الدُّسُر" />
        <Tab x={1760} y={200} q={S === 0 ? tab : 0} label="تفسير الطبري" />
        <Write id="b6du-n" x={1560} y={290} size={34} p={S === 0 ? nails : 0} label="المسامير" font="tajawal" color={C.ink} />
        <Seal x={1620} y={720} q={seal} kind="ثابت" s={0.55} />
        <Write id="b6du-l" x={1365} y={640} size={44} p={S === 1 ? lw : 0} label="ألواح" font="tajawal" />
        <Write id="b6du-h" x={1365} y={420} size={40} p={S === 1 ? hold : 0} label="وما يشدّها" font="tajawal" color={C.inkSoft} />
      </g>} />
  );
});

// ─── c1-s20: مساطر بلا أرقام ───
const BlankRulerShot = reverent((q) => {
  const k = cueKit(q, ["الطول"]);
  const r1 = k.on(0, "الطول", 0.6), r2 = k.on(0, "والعرض", 0.6), r3 = k.on(0, "والارتفاع", 0.6);
  const box = k.on(0, "فلم", 0.6);
  const cam = k.cam(NEUTRAL, [[0, "الطول", { cx: 640, cy: 480, s: 1.15 }, 1.0], [0, "فلم", NEUTRAL, 1.0]]);
  return (
    <Leaf q={q} id="b6br" cam={cam}
      L={<g><Grid />
        <BlankRuler x={620} y={300} q={r1} box={box} />
        <BlankRuler x={640} y={560} q={r2} rot={-18} box={box} />
        <BlankRuler x={300} y={560} w={380} q={r3} rot={-90} box={box} />
      </g>}
      R={<g><Grid /><Pair x={1400} y={540} a={1} b={1} s={0.7} /></g>} />
  );
});

const BOXES = [
  [1550, 360, "الخشب"],
  [1180, 360, "الطوابق"],
  [1550, 600, "المكان"],
  [1180, 600, "المدة"],
] as const;

// ─── c1-s21 / c1-s22: أربع خانات فارغة ───
const FourBoxes = reverent((q) => {
  const k = cueKit(q, ["الطوابق", "حديث"]);
  const bs = [k.on(0, "الخشب", 0.6), k.on(0, "الطوابق", 0.6), k.on(0, "المكان", 0.6), k.on(0, "المدة", 0.6)];
  // الدفعة ٦ البند ١٣١: «ولا نعلم حديثًا صحيحًا يحدّد مقاسها أو نوع خشبها أو عدد طبقاتها»
  const unk = k.on(1, "نعلم", 0.6);
  const hd = k.on(1, "حديث", 0.7);
  const fl = k.S === 1 ? [bounce(k.t, k.at("خشبها"), k.at("خشبها") + 0.9), bounce(k.t, k.at("طبقاتها"), k.at("طبقاتها") + 0.9), 0, 0] : [0, 0, 0, 0];
  const cam = k.cam({ cx: 1365, cy: 480, s: 1.15 }, [[1, "حديث", { cx: 1365, cy: 640, s: 1.2 }, 1.0]]);
  return (
    <Leaf q={q} id="b6fb" cam={cam} L={<g><Grid /><Pair x={560} y={520} a={1} b={1} s={0.6} /></g>}
      R={<g><Grid />
        {BOXES.map(([x, y, l], i) => <Box key={i} x={x} y={y} q={bs[i]!} label={l} />)}
        {BOXES.map(([x, y], i) => (fl[i]! > 0 ? <rect key={`f${i}`} x={x - 160} y={y - 85} width={320} height={170} rx={10} fill="none" stroke={C.gold} strokeWidth={8} opacity={fl[i]} /> : null))}
        <Field x={1620} y={790} label="حديث صحيح:" q={hd} w={260} />
        <Seal x={1160} y={800} q={unk} kind="لا نعلم" s={0.45} />
      </g>} />
  );
});

// ─── c1-s23 / c1-s25: خانات بخط مطموس، ثم ختم «رواية» ───
const Smudged = reverent((q) => {
  const k = cueKit(q, ["ستجد", "ختمنا"]);
  const { t, S } = k;
  const books = k.on(0, "كتب", 0.7);
  const drift = S === 0 ? bounce(t, k.at("أرقاما"), k.at("أرقاما") + 1.0) : 0;
  const fills = [k.on(0, "طولا", 0.6), k.on(0, "عرضا", 0.6), k.on(0, "طبقات", 0.6), k.on(0, "نوع", 0.6)];
  const lift = k.on(1, "ختمنا", 0.7);
  const hit = k.on(1, "رواية", 0.5);
  const cam = k.cam(NEUTRAL, [
    [0, "كتب", { cx: 600, cy: 520, s: 1.15 }, 1.0],
    [0, "طولا", { cx: 1365, cy: 480, s: 1.2 }, 1.0],
    [1, "ختمنا", { cx: 1365, cy: 440, s: 1.1 }, 1.0],
  ]);
  return (
    <Leaf q={q} id="b6sm" cam={cam}
      L={<g><Grid />
        {[0, 1, 2].map((i) => <g key={i} opacity={books} transform={`translate(${300 + i * 150} ${560 - i * 10}) rotate(${-4 + i * 3}) scale(0.32)`}><Books /></g>)}
        {drift > 0 ? <Smudge x={mix(700, 1000, drift)} y={300} q={drift} seed={9} /> : null}
      </g>}
      R={<g><Grid />
        {BOXES.map(([x, y, l], i) => <g key={i}><Box x={x} y={y} q={1} label={l} /><Smudge x={x} y={y + 20} q={fills[i]!} seed={i + 2} /></g>)}
        <Blank x={1365} y={mix(260, 180, lift)} q={lift * (1 - hit)} />
        <Seal x={1365} y={480} q={hit} kind="رواية" s={1.05} />
      </g>} />
  );
});

// ─── c1-s29: إطار رسم فارغ ───
const NoSketch = reverent((q) => {
  const k = cueKit(q, ["دفترنا"]);
  const ruler = k.on(0, "رقما", 0.7);
  const frame = k.on(0, "رسما", 0.8);
  const line = k.draw(0, "كانت", 0.9);
  const cam = k.cam({ cx: 1200, cy: 520, s: 1.3 }, [[0, "دفترنا", NEUTRAL, 1.2]]);
  return (
    <Leaf q={q} id="b6ns" cam={cam}
      L={<g><Grid />
        <DotFrame x={560} y={460} w={600} h={460} q={frame} />
        <Write id="b6ns-l" x={560} y={770} size={44} p={line} label="لا نعلم شكلها" font="tajawal" />
      </g>}
      R={<g><Grid />
        <BlankRuler x={1365} y={420} q={ruler} box={ruler} />
        <Pair x={1365} y={660} a={1} b={1} s={0.6} />
      </g>} />
  );
});

// ─── c1-s31 / c1-s32: ورقة الأسئلة بلا معالم ───
const UnknownSheet = reverent((q) => {
  const k = cueKit(q, ["الختم", "أين"]);
  const { S } = k;
  const lift = k.on(0, "الختم", 0.7);
  const sheet = S === 0 ? k.on(0, "نعلم", 0.9) : 1;
  const seal0 = k.on(0, "نعلم", 0.6);
  const l1 = k.draw(1, "أين", 0.9), s1 = k.on(1, "نعلم", 0.5);
  const l2 = k.draw(1, "كم", 0.9), hg = k.on(1, "كم", 0.6), s2 = k.on(1, "نعلم#2", 0.5);
  const cam = k.cam(NEUTRAL, [
    [0, "الختم", { cx: 1365, cy: 360, s: 1.2 }, 1.0],
    [1, "أين", { cx: 1365, cy: 440, s: 1.25 }, 1.0],
    [1, "كم", { cx: 1365, cy: 600, s: 1.25 }, 1.0],
  ]);
  return (
    <Leaf q={q} id="b6us" cam={cam} L={<Grid />}
      R={<g><Grid />
        <Blank x={1600} y={mix(260, 180, lift)} q={lift * (1 - seal0)} />
        <Sheet x={1365} y={520} w={660} h={560} q={sheet} rot={-1}>
          <Seal x={220} y={-220} q={S === 0 ? seal0 : 1} kind="لا نعلم" s={0.45} />
          <Write id="b6us-1" x={40} y={-90} size={48} p={l1} label="أين بُنيت؟" font="tajawal" />
          <Seal x={-200} y={-100} q={s1} kind="لا نعلم" s={0.42} />
          <Write id="b6us-2" x={40} y={110} size={48} p={l2} label="كم استغرق؟" font="tajawal" />
          <Seal x={-200} y={100} q={s2} kind="لا نعلم" s={0.42} />
          <g transform="translate(-700 -560)"><Hourglass q={hg} flow={0} /></g>
        </Sheet>
      </g>} />
  );
});

// ─── c1-s33: جبلان على الأفق بلا دبوس ───
const TwoPeaks = reverent((q) => {
  const k = cueKit(q, ["بقاياها"]);
  const p1 = k.draw(0, "الجبل", 1.0), p2 = k.draw(0, "ذاك", 1.0);
  const qm = k.on(0, "يثبت", 0.6);
  const seal = k.on(0, "بدليل", 0.5);
  const cam = k.cam(NEUTRAL, [[0, "الجبل", { cx: 1365, cy: 520, s: 1.2 }, 1.2]]);
  return (
    <Leaf q={q} id="b6tp" cam={cam} L={<Dry grid={0.5} />}
      R={<g><Dry grid={0.5} />
        <Peak x={1600} y={DRY} w={300} h={210} p={p1} />
        <Peak x={1140} y={DRY} w={280} h={180} p={p2} />
        <Q x={1610} y={360} size={80} q={qm} />
        <Q x={1150} y={400} size={80} q={qm} />
        <Seal x={1375} y={250} q={seal} kind="لا نعلم" s={0.5} />
      </g>} />
  );
});

// ─── c1-s36: المسطرة تُطوى والمعنى يبقى ───
const Meaning = reverent((q) => {
  const k = cueKit(q, ["يكفينا"]);
  const { t } = k;
  const pair = k.on(0, "علامة", 0.8);
  const hz = k.draw(0, "باقية", 1.4);
  const enough = k.draw(0, "يكفينا", 0.8);
  const out = prog(t, k.at("مقاساتها") - 0.05, k.at("مقاساتها") + 1.0);
  const mean = k.draw(0, "معناها", 0.9);
  const cam = k.cam({ cx: 1365, cy: 520, s: 1.2 }, [[0, "باقية", NEUTRAL, 1.4]]);
  const line = <g><Ink d={`M1760 ${DRY} H160`} p={hz} w={4} /><Grid o={0.6} /></g>;
  return (
    <Leaf q={q} id="b6me" cam={cam} L={line}
      R={<g>{line}
        <Write id="b6me-k" x={1365} y={230} size={52} p={enough} label="يكفينا" font="tajawal" color={C.inkSoft} />
        <Write id="b6me-m" x={1365} y={420} size={66} p={mean} label="معناها" color={GOLD_D} />
        <Pair x={1365} y={560} a={pair} b={pair} s={0.55} />
        <BlankRuler x={mix(1365, 2050, out)} y={760} q={1 - prog(out, 0.85, 1)} />
      </g>} />
  );
});

// ─── c1-s37..s39: عقدة الخشب وحولها الأختام ───
const KnotSeals = reverent((q) => {
  const k = cueKit(q, ["نعقد", "عقدة", "وبجوارها"]);
  const { t, S } = k;
  const glow = S === 0 ? bounce(t, k.at("نعقد"), k.at("نعقد") + 1.5) : 0;
  const circles = k.draw(0, "اليوم", 1.0);
  const tie = S === 1 ? prog(t, k.at("عقدة") - 0.05, k.at("عقدة") + 0.8) : S > 1 ? 1 : 0.4;
  const sabit = k.on(1, "ثابت", 0.5);
  const amr = k.draw(1, "بنيت", 0.8);
  const pl = k.on(1, "ألواح", 0.6);
  const mock = k.on(1, "يسخرون", 0.7);
  const riw = k.on(2, "رواية", 0.5), num = k.on(2, "للأرقام", 0.6);
  const unk = k.on(2, "نعلم", 0.5), place = k.draw(2, "للمكان", 0.9);
  const KXX = 1300, KY = 650;
  const cam = k.cam({ cx: 1300, cy: 700, s: 1.45 }, [
    [0, "اليوم", { cx: 1300, cy: 540, s: 1.1 }, 1.0],
    [1, "ثابت", { cx: 1300, cy: 420, s: 1.3 }, 1.0],
    [2, "رواية", { cx: 1300, cy: 520, s: 1.05 }, 1.0],
  ]);
  const both = (
    <g>
      <Grid />
      <Thread x1={1760} x2={160} y={KY} p={1} knots={[
        { x: 1660, kind: "tied", q: 1 },
        { x: 1560, kind: "tied", q: 1 },
        { x: KXX, kind: "plank", q: 1, tie, glow: glow + 0.4 * sabit },
        { x: 700, kind: "ring", q: 0.6, tie: 0 },
      ]} />
    </g>
  );
  return (
    <Leaf q={q} id="b6ks" cam={cam} L={both}
      R={<g>{both}
        <Ring x={KXX} y={380} r={78} p={circles} dash c={C.inkSoft} />
        <Ring x={1580} y={520} r={78} p={circles} dash c={C.inkSoft} />
        <Ring x={1060} y={520} r={78} p={circles} dash c={C.inkSoft} />
        <Seal x={KXX} y={380} q={sabit} kind="ثابت" s={0.5} />
        <Write id="b6ks-a" x={KXX} y={490} size={34} p={amr} label="بأمر" font="tajawal" />
        <Plank x={KXX - 40} y={760} w={140} h={22} q={pl} />
        <Plank x={KXX + 30} y={740} w={140} h={22} q={pl} rot={3} />
        <Txt x={KXX + 200} y={790} size={30} q={mock * 0.55} color={C.inkSoft} weight={500}>يسخرون</Txt>
        <Seal x={1580} y={520} q={riw} kind="رواية" s={0.45} />
        <Smudge x={1580} y={640} q={num} seed={5} />
        <Seal x={1060} y={520} q={unk} kind="لا نعلم" s={0.45} />
        <Ink d="M1130 620 H990 M1130 590 H990" p={place} w={3} c={C.inkSoft} />
      </g>} />
  );
});

// ─── c1-s40 / c1-s41: الألواح تعلو والسخرية تبهت ───
const KeepBuilding = reverent((q) => {
  const k = cueKit(q, ["درس", "صاحبه"]);
  const { t, S } = k;
  const lesson = k.draw(0, "درس", 0.8);
  const nums = S === 0 ? 1 - prog(t, k.at("أرقام") - 0.05, k.at("أرقام") + 0.9) : 0;
  const pile = S === 0 ? k.on(0, "العمل", 0.9) : 1;
  const pass = S === 0 ? prog(t, k.at("غريبا") - 0.2, k.at("غريبا") + 1.6) : 1;
  const clear = k.draw(0, "وقته", 1.2);
  const p6 = k.on(1, "يتوقف", 0.6), p7 = k.on(1, "البناء", 0.6);
  const fadeMock = S === 1 ? 1 - prog(t, k.at("يضحكون") - 0.05, k.at("يضحكون") + 1.0) : 1;
  const cam = k.cam(NEUTRAL, [
    [0, "العمل", { cx: 1300, cy: 600, s: 1.15 }, 1.0],
    [0, "وقته", NEUTRAL, 1.2],
    [1, "يتوقف", { cx: 1320, cy: 540, s: 1.2 }, 1.0],
  ]);
  const mockX = mix(1700, 1000, pass);
  return (
    <Leaf q={q} id="b6kb" cam={cam}
      L={<g><Dry grid={0.6} />
        <Road y={800} q={0.5 * pile} />
        <g opacity={nums}><Box x={560} y={300} w={260} h={120} q={1} /><Smudge x={560} y={310} q={1} seed={7} /></g>
        <Ink d={`M160 ${DRY} H960`} p={clear} w={6} />
      </g>}
      R={<g><Dry grid={0.6} />
        <Road y={800} q={0.5 * pile} x2={960} />
        <Write id="b6kb-d" x={1365} y={200} size={56} p={lesson} label="درس" />
        <Pile x={1320} y={740} qs={[pile, pile, pile, pile, pile, p6, p7]} />
        <Txt x={mockX} y={860} size={34} q={pile * 0.5 * fadeMock * (S === 0 ? k.on(0, "غريبا", 0.6) : 1)} color={C.inkSoft} weight={500}>يسخرون</Txt>
        <Ink d={`M960 ${DRY} H1770`} p={prog(clear, 0.3, 1)} w={6} />
      </g>} />
  );
});

// ─── c1-s42: آخر لوح وسحابة ───
const Cloud = reverent((q) => {
  const k = cueKit(q, ["اكتملت"]);
  const last = k.on(0, "اكتملت", 0.8);
  const cloud = k.draw(0, "الأمر", 1.2);
  const qs = Array.from({ length: 18 }, (_, i) => (i < 17 ? 1 : last));
  const cam = k.cam({ cx: 1300, cy: 700, s: 1.45 }, [[0, "الأمر", { cx: 760, cy: 640, s: 1.3 }, 1.4]]);
  return (
    <Leaf q={q} id="b6cl" cam={cam}
      L={<g><Dry grid={0.4} />
        <Ink d={`M420 ${DRY - 6} C400 ${DRY - 60} 470 ${DRY - 84} 510 ${DRY - 64} C530 ${DRY - 110} 610 ${DRY - 112} 630 ${DRY - 66} C680 ${DRY - 80} 720 ${DRY - 40} 690 ${DRY - 6} Z`} p={cloud} w={4} fill="#9AA5A8" fillP={0.5 * cloud} />
      </g>}
      R={<g><Dry grid={0.4} /><Pile x={1300} y={760} qs={qs} /></g>} />
  );
});

// ─── c1-s43: الخيط إلى عقدة ٧ فارغة ───
const NextKnot = reverent((q) => {
  // دفعة المحرر ١ (٢٧ نوفمبر): الجملة «ومن بناء السفينة ننتقل إلى ما حدث حين جاء الماء.» بدل «فماذا حدث حين جاء الماء؟» بالكلمتين نفسيهما؛ الخيط يمتد إلى العقدة ٧ الفارغة على «حدث»
  // بلا اسم (اسمها «الطوفان» يُكتب في bd07-thread عند نطقه)، وحُذفت مرحلة سؤال التعليقات
  const k = cueKit(q, ["الماء"]);
  const { t } = k;
  const water = prog(t, k.at("الماء") - 0.05, k.at("الماء") + 1.0);
  const ext = k.on(0, "حدث", 1.2);
  const lab = 0;
  const cam = k.cam(NEUTRAL, [
    [0, "حدث", { cx: 860, cy: 720, s: 1.3 }, 1.2],
  ]);
  const both = (
    <g>
      <Dry grid={0.6} />
      <path d={`M1700 ${DRY - 4} H${1700 - 1000 * water}`} stroke={WATER} strokeWidth={4} strokeDasharray="10 12" opacity={0.85} />
      <SeriesThread p={mix(pFor(K6) + 0.06, pFor(K7) + 0.05, ext)} k6={1} k7={ext} l7={lab} />
    </g>
  );
  return (
    <Leaf q={q} id="b6nk" cam={cam}
      L={both}
      R={both} />
  );
});

export const BD06_SCENES: Record<string, React.FC<BdProps>> = {
  "bd06-plank": PlankShot,
  "bd06-thread-wood": ThreadWood,
  "bd06-seals-tray": SealsTray,
  "bd06-pile": PileShot,
  "bd06-three-marks": ThreeMarks,
  "bd06-planks-rise": PlanksRise,
  "bd06-dusur": Dusur,
  "bd06-blank-ruler": BlankRulerShot,
  "bd06-four-boxes": FourBoxes,
  "bd06-smudged": Smudged,
  "bd06-no-sketch": NoSketch,
  "bd06-unknown-sheet": UnknownSheet,
  "bd06-two-peaks": TwoPeaks,
  "bd06-meaning": Meaning,
  "bd06-knot-seals": KnotSeals,
  "bd06-keep-building": KeepBuilding,
  "bd06-cloud": Cloud,
  "bd06-next-knot": NextKnot,
};

/** مشهد الصورة الثابتة للمراجعة لكل لقطة (المعرّف في الخطة)؛ الغائب = آخر مشهد يستعمل اللقطة، عند نهاية آخر كلمة */
export const BD06_STILLS: Record<string, string> = {
  "bd06-dusur": "c1-s18",
  "bd06-seals-tray": "c1-s5",
  "bd06-thread-wood": "c1-s4",
  "bd06-three-marks": "c1-s13",
  "bd06-knot-seals": "c1-s39",
  "bd06-next-knot": "c1-s43",
};
