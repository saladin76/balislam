/**
 * «دفاتر الزمن 005 — دعوة نوح عليه السلام»: لقطات «خط الأفق» الجديدة كما في خطة المشاهد (scenes.md، D214).
 * لا تصوير لنوح عليه السلام ولا لأي نبي أو ملَك ولا لأحد من قومه، ولا وجوه ولا أيدٍ: النبي رمزٌ (عقدة على الخيط ونقطة ضوء
 * من حبر، بانتظار اعتماد المالك)، وقومه بيوت وأبواب لا أشخاص. الخيط الأحمر في هذه الحلقة عمودي كخيط شاقول على الهامش الأيمن.
 * القطعة المخصوصة: الحجر من أعلى وأثر القطرات (حلقة، ثم حلقات، ثم حفرة صغيرة عند «عمرًا كاملًا»).
 */
import React from "react";
import { GLYPHS, Hatch } from "../lib/drawings";
import { DateRibbon, Pin } from "../horizon/book";
import {
  BlankLine, C, DotFrame, EMBER, GOLD_D, GREEN, GoldSeal, Horizon, Ink, Knot, Leaf, NEUTRAL, Q, Seal, Sheet, Tab, Txt, WATER, Write,
  bounce, crackPath, cueKit, easeOut, mix, prog, reverent, rng, Plank, Rain, type BdProps, type KnotKind,
} from "./kit";

// ───────────────────────── أدوات الحلقة ─────────────────────────

/** الخيط الأحمر عموديًا (شاقول) على x من y1 إلى y2 بنسبة p، وعقده بمواضعها الرأسية؛ الاسم يُكتب إلى يسار العقدة */
type VKnot = { y: number; kind: KnotKind; q: number; tie?: number; mark?: number; glow?: number; label?: string; lq?: number };
const VThread: React.FC<{ x: number; y1: number; y2: number; p: number; knots?: VKnot[] }> = ({ x, y1, y2, p, knots = [] }) => {
  const d = `M${x} ${y1} C${x + 4} ${mix(y1, y2, 0.35)} ${x - 4} ${mix(y1, y2, 0.7)} ${x} ${y2}`;
  const reach = mix(y1, y2, p);
  return (
    <g>
      <Ink d={d} p={p} w={6} c={C.ribbon} />
      <Ink d={d} p={p} w={1.6} c="#8E1F17" opacity={0.5} />
      {knots.map((k, i) =>
        k.q <= 0 || k.y > reach + 4 ? null : (
          <g key={i}>
            {k.glow ? <circle cx={x} cy={k.y} r={30 + 16 * k.glow} fill={C.gold} opacity={0.35 * k.glow} /> : null}
            <Knot x={x} y={k.y} kind={k.kind} q={k.q} tie={k.tie ?? 1} />
            {k.mark ? <Q x={x - 52} y={k.y + 20} size={60} q={k.mark} color={C.ribbon} /> : null}
            {k.label ? <Txt x={x - 40} y={k.y + 11} size={30} q={k.lq ?? k.q} anchor="start" color={C.ink}>{k.label}</Txt> : null}
          </g>
        ),
      )}
    </g>
  );
};

/** نقطة ضوء من حبر (رمز النبي، لا هيئة — بانتظار اعتماد المالك) */
const LightPoint: React.FC<{ x: number; y: number; q: number; r?: number }> = ({ x, y, q, r = 14 }) =>
  q <= 0 ? null : (
    <g opacity={q} transform={`translate(${x} ${y}) scale(${0.6 + 0.4 * q})`}>
      <circle r={r * 2.6} fill={C.gold} opacity={0.22} />
      <circle r={r * 1.6} fill={C.gold} opacity={0.3} />
      <circle r={r} fill={C.gold} stroke={GOLD_D} strokeWidth={3} />
    </g>
  );

/** الحجر من أعلى بغسل حبر رمادي */
const SX = 1365;
const SY = 540;
const TopStone: React.FC<{ x?: number; y?: number; s?: number }> = ({ x = SX, y = SY, s = 1 }) => {
  const r = rng(55);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-250 10 C-262 -110 -150 -196 -10 -192 C140 -188 252 -120 248 -6 C244 120 130 186 -6 184 C-150 182 -240 120 -250 10 Z" fill="#8F8A86" opacity={0.42} />
      <path d="M-250 10 C-262 -110 -150 -196 -10 -192 C140 -188 252 -120 248 -6 C244 120 130 186 -6 184 C-150 182 -240 120 -250 10 Z" fill="none" stroke={C.ink} strokeWidth={4} />
      <path d="M-180 -60 C-120 -120 -20 -140 60 -120" fill="none" stroke={C.ink} strokeWidth={2} opacity={0.25} />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={-220 + r() * 440} cy={-160 + r() * 320} r={1.4 + r() * 2.4} fill="#4A4450" opacity={0.22} />
      ))}
    </g>
  );
};

/** قطرة حبر (دمعة) */
const Drop: React.FC<{ x: number; y: number; s?: number; o?: number }> = ({ x, y, s = 1, o = 1 }) => (
  <path d="M0 -26 C10 -10 16 0 16 8 C16 18 8 24 0 24 C-8 24 -16 18 -16 8 C-16 0 -10 -10 0 -26 Z" transform={`translate(${x} ${y}) scale(${s})`} fill={C.ink} opacity={o} />
);

const ringPos = (i: number): [number, number] => {
  const r = rng(300 + i * 7);
  const a = r() * Math.PI * 2;
  const d = 10 + r() * 70;
  return [SX + Math.cos(a) * d * 1.3, SY + Math.sin(a) * d];
};

const PERIOD = 1.8;
const periodic = (from: number, until: number) => {
  const out: number[] = [];
  for (let h = from; h < until; h += PERIOD) out.push(h);
  return out;
};

/**
 * أثر القطرات على الحجر: n0 حلقات قديمة ثابتة، وhits لحظات ارتطام في المشهد (قطرة تتكوّن أعلى الإطار ثم تهبط ثم حلقة تتسع وتبقى باهتة).
 * crater يخسف الحلقات إلى حفرة صغيرة، وhang قطرة معلّقة لا تسقط.
 */
const TOP = 300;
const Drips: React.FC<{ t: number; n0: number; hits: { h: number; form?: number }[]; crater?: number; hang?: number }> = ({ t, n0, hits, crater = 0, hang = 0 }) => {
  const fade = 1 - 0.85 * crater;
  return (
    <g>
      {Array.from({ length: n0 }, (_, i) => {
        const [x, y] = ringPos(i);
        return <ellipse key={`o${i}`} cx={x} cy={y} rx={42 + (i % 3) * 8} ry={30 + (i % 3) * 6} fill="none" stroke="#4A4450" strokeWidth={2.4} opacity={0.38 * fade} />;
      })}
      {hits.map(({ h, form }, i) => {
        const [x, y] = ringPos(n0 + i);
        const f0 = form ?? h - 1.0;
        const out: React.ReactNode[] = [];
        if (t >= f0 && t < h) {
          const fallStart = h - 0.55;
          const grow = prog(t, f0, Math.min(f0 + 0.4, fallStart), easeOut);
          const k = t < fallStart ? 0 : ((t - fallStart) / 0.55) ** 2;
          out.push(<Drop key="d" x={x} y={mix(TOP, y, k)} s={0.4 + 0.6 * grow} />);
        }
        if (t >= h) {
          const g = prog(t, h, h + 0.8, easeOut);
          out.push(<ellipse key="r" cx={x} cy={y} rx={6 + 44 * g} ry={4 + 31 * g} fill="none" stroke="#4A4450" strokeWidth={3} opacity={(0.95 - 0.55 * g) * fade} />);
          if (g < 1) out.push(<circle key="s" cx={x} cy={y} r={7 * (1 - g)} fill={C.ink} opacity={0.8} />);
        }
        return <g key={i}>{out}</g>;
      })}
      {crater > 0 ? (
        <g opacity={crater}>
          <ellipse cx={SX} cy={SY} rx={44 * (0.5 + 0.5 * crater)} ry={30 * (0.5 + 0.5 * crater)} fill="#2E2830" opacity={0.75} />
          <ellipse cx={SX - 6} cy={SY - 5} rx={30 * crater} ry={18 * crater} fill="#1A161C" opacity={0.7} />
          <path d={`M${SX - 44} ${SY + 4} C${SX - 30} ${SY + 32} ${SX + 30} ${SY + 32} ${SX + 44} ${SY + 4}`} stroke="#C8C2BC" strokeWidth={3} fill="none" opacity={0.5} />
        </g>
      ) : null}
      {hang > 0 ? <Drop x={SX} y={TOP + 4 * Math.sin(t * 3)} s={0.4 + 0.6 * hang} /> : null}
    </g>
  );
};

/** بيت (رمز مستوطنة) برقم شكله من GLYPHS، وبابه (lit مضاء، shut مغلق) */
const House: React.FC<{ x: number; y: number; g: number; s?: number; q?: number; lit?: number; shut?: number; curtain?: number }> = ({ x, y, g, s = 1, q = 1, lit = 0, shut = 0, curtain = 0 }) =>
  q <= 0 ? null : (
    <g opacity={q} transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={GLYPHS[g % GLYPHS.length]} fill="#E8D6B3" stroke={C.ink} strokeWidth={3} strokeLinejoin="round" />
      <rect x={-6} y={-16} width={12} height={16} fill={lit > 0 ? C.gold : "#5A4636"} opacity={0.5 + 0.5 * Math.max(lit, shut)} />
      {shut > 0 ? <rect x={-6} y={-16} width={12 * shut} height={16} fill="#3A2A20" /> : null}
      {curtain > 0 ? <path d={`M-14 -34 h10 v${10 * curtain} h-10 Z M4 -34 h10 v${10 * curtain} h-10 Z`} fill={C.inkSoft} opacity={0.8} /> : null}
    </g>
  );

const ROW = [1700, 1600, 1500, 1400, 1290, 1180, 1070];
/** حلقة بيوت حول ساحة مفتوحة (الصفحة اليسرى) */
const PLAZA: [number, number] = [560, 720];
const RING = Array.from({ length: 11 }, (_, i) => {
  const a = Math.PI * (0.05 + (0.9 * i) / 10);
  return [PLAZA[0] + Math.cos(a) * 300, PLAZA[1] - Math.sin(a) * 110] as const;
});

// ─── c2-s1..s3، c2-s34، c2-s36، c2-s37: الحجر والقطرة ───
const DropStone = reverent((q) => {
  const k = cueKit(q, ["تسقط", "يتغير", "لبث", "نتعلم", "أياما", "نهاية"]);
  const { t, S, dur } = { ...k, dur: q.dur };
  let n0 = 0;
  let hits: { h: number; form?: number }[] = [];
  let crater = 0;
  let hang = 0;
  if (S === 0) {
    hits = [
      { h: k.at("حجر"), form: k.at("قطرة") },
      { h: k.at("أخرى"), form: k.at("قطرة#2") },
      { h: k.at("أخرى#2") + 0.2, form: k.at("أخرى#2") - 0.5 },
    ];
  } else if (S === 1) {
    n0 = 3;
    const a = k.at("القطرات") + 0.3;
    hits = [{ h: a }, { h: a + 0.7 }, ...periodic(a + 0.7 + PERIOD, dur).map((h) => ({ h }))];
  } else if (S === 2) {
    n0 = 6;
    hits = periodic(1.0, dur).map((h) => ({ h }));
  } else if (S === 3) {
    n0 = 14;
    hits = [{ h: k.at("تنته") + 0.4 }];
  } else if (S === 4) {
    n0 = 14;
    const m = k.at("شهورا");
    hits = [{ h: k.at("أياما") }, ...[0, 0.25, 0.5, 0.75].map((d) => ({ h: m + d, form: m + d - 0.5 }))];
    crater = prog(t, k.at("عمرا", 1.2) - 0.05, k.at("عمرا", 1.2) + 1.2, easeOut);
  } else {
    n0 = 14;
    crater = 1;
    hang = k.on(5, "الصبر", 0.9);
  }
  const yom = k.on(1, "يوم"), sana = k.on(1, "سنة");
  const sabr = S === 2 ? k.draw(2, "لبث", 0.8) : 0;
  const learn = S === 3 ? k.draw(3, "نتعلم", 0.8) : 0;
  const sabr2 = S === 4 ? k.draw(4, "الصبر", 0.8) : 0;
  const close = { cx: SX, cy: 520, s: 2.0 };
  const cam = k.cam(close, [
    [2, "فكم", { cx: SX, cy: 500, s: 1.55 }, 1.4],
    [3, "تنته", { cx: SX, cy: 540, s: 2.2 }, 1.0],
    [4, "عمرا", { cx: SX, cy: 540, s: 2.4 }, 1.2],
    [5, "نهاية", { cx: SX, cy: 340, s: 2.6 }, 1.6],
  ]);
  const R = (
    <g>
      <TopStone />
      <Drips t={t} n0={n0} hits={hits} crater={crater} hang={hang} />
      <Txt x={1210} y={720} size={34} q={yom} color={C.inkSoft}>يوم</Txt>
      <Txt x={1520} y={720} size={34} q={sana} color={C.inkSoft}>سنة</Txt>
      <Write id="b5d-s" x={SX} y={330} size={50} p={sabr} label="لبث" />
      <Write id="b5d-l" x={SX} y={330} size={46} p={learn} label="نتعلم" color={C.inkSoft} />
      <Write id="b5d-r" x={SX} y={330} size={50} p={sabr2} label="الصبر" />
    </g>
  );
  return <Leaf q={q} id="b5d" cam={cam} R={R} />;
});

// ─── c2-s5 / c2-s39: الخيط العمودي والعقدة الخامسة ───
const TX = 1660;
const ThreadKnot = reverent((q) => {
  // دمج الحلقتين (٢٧ نوفمبر): حُذفت جملة «على خيط الزمن، رأينا في الحلقة الماضية…» ومرحلتها (رسم الخيط والعقد ١–٤
  // و«التوحيد ← الشرك»)، فالخيط وعقده الأربع حاضرة من أول المشهد تكملةً لخيط آخر الجزء الأول
  const k = cueKit(q, ["نعقد", "صبرت"]);
  const { t, S } = k;
  const thread = 1;
  const old = (_i: number) => 1;
  const tie5 = k.on(0, "نعقد", 0.8);
  const light = k.on(0, "أول", 0.7);
  const ground = k.draw(0, "أهل", 0.8);
  const drop = S === 1 ? prog(t, k.at("صبرت") - 0.6, k.at("صبرت") + 0.6) : 0;
  const ext = k.draw(1, "أطول", 1.0);
  const blank = k.draw(1, "التعليقات", 0.9);
  const cam = k.cam({ cx: 1420, cy: 500, s: 1.25 }, [
    [0, "نعقد", { cx: 1560, cy: 560, s: 1.45 }, 1.0],
    [1, "أطول", { cx: 1480, cy: 660, s: 1.3 }, 1.0],
  ]);
  const R = (
    <g>
      <g><TopStone x={1450} y={660} s={0.3} /></g>
      {S === 1 ? <Drips t={t} n0={0} hits={[]} /> : null}
      {drop > 0 ? (drop < 0.5 ? <Drop x={1450} y={mix(560, 660, (drop * 2) ** 2)} s={0.6} /> : <ellipse cx={1450} cy={660} rx={6 + 26 * prog(drop, 0.5, 1)} ry={4 + 18 * prog(drop, 0.5, 1)} fill="none" stroke="#4A4450" strokeWidth={2.5} />) : null}
      <VThread x={TX} y1={110} y2={S === 1 ? mix(600, 760, ext) : 600} p={thread} knots={[
        { y: 170, kind: "tied", q: old(0) },
        { y: 240, kind: "tied", q: old(1) },
        { y: 310, kind: "tied", q: old(2) },
        { y: 380, kind: "dark", q: old(3) },
        { y: 540, kind: "ring", q: tie5 > 0 || S > 0 ? 1 : 0, tie: tie5, glow: S === 0 ? bounce(t, k.at("نعقد"), k.at("نعقد") + 1.2) : 0 },
        ...(S === 1 ? [{ y: 760, kind: "ring" as const, q: ext, tie: 0, mark: ext }] : []),
      ]} />
      <LightPoint x={TX - 70} y={540} q={light} />
      <Txt x={1500} y={552} size={34} q={light} anchor="end" color={C.ink}>أول رسول</Txt>
      <Ink d={`M${TX + 60} 600 H${TX - 120}`} p={ground} w={4} />
      <BlankLine x={1360} y={850} w={480} p={blank} pen={blank} />
    </g>
  );
  return <Leaf q={q} id="b5t" cam={cam} R={R} />;
});

// ─── c2-s6: لا سنة ولا مكان ───
const BlankRibbon = reverent((q) => {
  const k = cueKit(q, ["ومتى"]);
  const { t } = k;
  const ribbon = k.on(0, "ومتى", 0.6);
  const land = k.draw(0, "وأين", 1.2);
  const nib = prog(t, k.at("نكتبها", 0.9) - 0.05, k.at("نكتبها", 0.9) + 0.9, easeOut);
  const pinQ = k.on(0, "الخريطة", 0.5);
  const hover = Math.sin(t * 3) * 14;
  const seal = k.on(0, "بيقين");
  const cam = k.cam(NEUTRAL, [
    [0, "ومتى", { cx: 1365, cy: 420, s: 1.3 }, 1.0],
    [0, "وأين", { cx: 640, cy: 500, s: 1.2 }, 1.0],
    [0, "نكتبها", { cx: 1365, cy: 440, s: 1.4 }, 1.0],
    [0, "الخريطة", { cx: 600, cy: 460, s: 1.25 }, 1.0],
    [0, "بيقين", NEUTRAL, 1.0],
  ]);
  const L = (
    <g>
      <path d="M300 520 C320 400 460 330 600 350 C760 372 840 440 810 560 C786 660 640 700 500 680 C370 662 284 620 300 520 Z" fill="#D9C29A" opacity={0.35 * land} />
      <Ink d="M300 520 C320 400 460 330 600 350 C760 372 840 440 810 560 C786 660 640 700 500 680 C370 662 284 620 300 520 Z" p={land} w={3} c={C.inkSoft} dash="10 9" />
      <Pin x={560} y={470 + hover} o={pinQ} s={1.1} />
      {pinQ > 0 ? <ellipse cx={560} cy={520} rx={18} ry={5} fill="#2B1E14" opacity={0.18 * pinQ} /> : null}
    </g>
  );
  const R = (
    <g>
      <DateRibbon x={1365} y={250} s={1.6} o={ribbon} />
      {nib > 0 ? (
        <g opacity={Math.min(1, nib * 3)} transform={`translate(${mix(1600, 1440, nib)} ${mix(560, 450, nib)}) rotate(-35) scale(0.3)`}>
          <path d="M-100 -16 C-68 -16 -40 -8 0 0 C-40 8 -68 16 -100 16 Z" fill="#2B1E14" />
          <path d="M-100 -16 H-560 V16 H-100 Z" fill="#C9A06A" stroke={C.ink} strokeWidth={8} />
        </g>
      ) : null}
      <Seal x={1365} y={700} q={seal} kind="لا نعلم" s={0.7} />
    </g>
  );
  return <Leaf q={q} id="b5r" cam={cam} L={L} R={R} />;
});

// ─── c2-s8 / c2-s30: تمهيد الحديث ───
const HadithLead = reverent((q) => {
  const k = cueKit(q, ["قال"]);
  const long = k.has("الشفاعة");
  const head = k.draw(0, "قال", 0.9);
  const src = long ? k.on(0, "الشفاعة", 0.7) : 0;
  const day = long ? k.draw(0, "القيامة", 0.8) : 0;
  const open = long ? k.draw(0, "فيقولون", 0.9) : k.draw(0, "وسلم", 0.9);
  const cam = k.cam(NEUTRAL, [[0, long ? "فيقولون" : "وسلم", { cx: 1365, cy: 520, s: 1.15 }, 1.0]]);
  return (
    <Leaf q={q} id="b5h" cam={cam}
      R={<g>
        <Write id="b5h-h" x={1365} y={230} size={58} p={head} label="قال النبي ﷺ" />
        <Ink d="M1500 262 H1230" p={head} w={3} c={C.gold} />
        <Tab x={1720} y={330} q={src} label="صحيح البخاري ٣٣٤٠" />
        <Write id="b5h-d" x={1365} y={460} size={44} p={day} label="يوم القيامة" font="tajawal" color={C.inkSoft} />
        <Ink d="M1640 640 H1090" p={open} w={3} c={C.inkSoft} />
        <Ink d="M1640 720 H1090" p={prog(open, 0.3, 1)} w={3} c={C.inkSoft} opacity={0.6} />
      </g>} />
  );
});

// ─── c2-s10: أول رسول إلى أهل الأرض (نص المراجعة العلمية، الدفعة ٥ البند ١٢٥: بلا «أجيال من التوحيد ثم الاختلاف») ───
const LX = 1120;
const LY = 560;
const FOLK = [520, 420, 320, 220];
const FirstMessenger = reverent((q) => {
  const k = cueKit(q, ["أول"]);
  const { t } = k;
  const title = k.draw(0, "أول", 0.9);
  const light = k.on(0, "رسول", 0.6);
  const ground = k.draw(0, "الأرض", 1.4);
  const src = k.on(0, "الشفاعة", 0.6);
  const folk = k.on(0, "قومه", 0.8);
  const warn = k.draw(0, "لينذرهم", 1.0);
  const call = bounce(t, k.at("ويدعوهم"), k.at("ويدعوهم") + 1.2);
  const cam = k.cam(NEUTRAL, [
    [0, "رسول", { cx: LX, cy: LY, s: 1.35 }, 1.0],
    [0, "الأرض", NEUTRAL, 1.4],
    [0, "قومه", { cx: 640, cy: 540, s: 1.15 }, 1.0],
  ]);
  const both = (
    <g>
      <Ink d={`M1740 ${LY + 40} H180`} p={ground} w={5} />
      {FOLK.map((x, i) => <House key={i} x={x} y={LY + 40} g={i + 1} s={1.05} q={prog(folk, i * 0.2, i * 0.2 + 0.4)} />)}
      {FOLK.map((x, i) => <Ink key={`w${i}`} d={`M${LX - 30} ${LY - 10} Q${(LX + x) / 2} ${LY - 120 - i * 12} ${x + 20} ${LY - 40}`} p={prog(warn, i * 0.15, i * 0.15 + 0.55)} w={3 + 2 * call} c={GOLD_D} dash="10 8" />)}
      <LightPoint x={LX} y={LY} q={light} />
    </g>
  );
  return (
    <Leaf q={q} id="b5m" cam={cam} L={both}
      R={<g>{both}
        <Write id="b5m-t" x={1400} y={300} size={72} p={title} label="أول رسول" />
        <Tab x={1740} y={160} q={src} label="حديث الشفاعة" />
      </g>} />
  );
});

// ─── c2-s11 / c2-s14: الخانة الوحيدة المؤكدة ───
const BOX = { x: 1365, y: 540, w: 600, h: 170 };
const boxPath = `M${BOX.x + BOX.w / 2} ${BOX.y - BOX.h / 2} H${BOX.x - BOX.w / 2} V${BOX.y + BOX.h / 2} H${BOX.x + BOX.w / 2} Z`;
const OneNumber = reverent((q) => {
  const k = cueKit(q, ["وكم", "تسعمئة"]);
  const { t, S } = k;
  const frame = S === 0 ? k.span(0, "وكم", "يقينا", 1.2) : 1;
  const label = k.draw(0, "الرقم", 0.9);
  const glow = S === 0 ? bounce(t, k.at("يقينا"), k.at("يقينا") + 1.0) : 0;
  // المراجعة العلمية (الدفعة ٦ البند ١٢٦): «مدة لبثه في قومه» لا «عمره»، ولا ختم «تقدير»
  const num = k.draw(1, "تسعمئة", 1.3);
  const lab = k.draw(1, "المدة", 1.0);
  const seal = k.on(1, "القرآن", 0.6);
  const before = k.draw(1, "الطوفان", 1.0);
  const cam = k.cam({ cx: 1365, cy: 520, s: 1.2 }, [
    [0, "يقينا", { cx: 1365, cy: 520, s: 1.35 }, 1.0],
    [1, "المدة", { cx: 1365, cy: 600, s: 1.25 }, 1.0],
    [1, "الطوفان", { cx: 1365, cy: 640, s: 1.1 }, 1.0],
  ]);
  return (
    <Leaf q={q} id="b5n" cam={cam}
      R={<g>
        {glow > 0 ? <rect x={BOX.x - BOX.w / 2 - 16} y={BOX.y - BOX.h / 2 - 16} width={BOX.w + 32} height={BOX.h + 32} rx={14} fill={C.gold} opacity={0.3 * glow} /> : null}
        <Ink d={boxPath} p={frame} w={7} c={C.gold} />
        <Ink d={boxPath} p={frame} w={2} c={GOLD_D} />
        <Write id="b5n-l" x={1365} y={400} size={40} p={label} label="الرقم الوحيد" font="tajawal" color={C.inkSoft} />
        <Write id="b5n-n" x={1365} y={558} size={50} p={num} label="تسعمئة وخمسون سنة" />
        <Write id="b5n-m" x={1365} y={690} size={40} p={lab} label="مدة لبثه في قومه" font="tajawal" color={C.ink} />
        <GoldSeal x={1590} y={790} q={seal} label="العنكبوت ١٤" />
        <Ink d="M1365 730 V800 H1120" p={before} w={3} c={C.inkSoft} />
        <rect x={1020} y={770} width={100} height={60} rx={6} fill="none" stroke={C.inkSoft} strokeWidth={3} strokeDasharray="8 6" opacity={prog(before, 0.8, 1)} />
      </g>} />
  );
});

// ─── c2-s15: أجيال تسمع الدعوة نفسها ───
const GX = 1365;
const Generations = reverent((q) => {
  const k = cueKit(q, ["تخيل"]);
  const { t, dur } = { ...k, dur: q.dur };
  const born = k.on(0, "يولد", 0.5);
  const grow = k.on(0, "ويكبر", 0.6);
  const die = k.on(0, "ويموت", 0.8);
  const call = k.draw(0, "الدعوة", 1.0);
  const g2 = k.on(0, "جيلا#2", 0.5), g3 = k.on(0, "جيلا#3", 0.5);
  const many = prog(t, k.at("جيلا#3") + 0.5, dur - 0.6);
  const small = (q2: number, y: number, fadeQ: number, key: string) => (
    <g key={key} opacity={1 - 0.65 * fadeQ}><Knot x={GX} y={y} kind="tied" q={q2} /></g>
  );
  const cam = k.cam({ cx: GX, cy: 420, s: 1.35 }, [
    [0, "الدعوة", { cx: GX + 30, cy: 480, s: 1.25 }, 1.2],
    [0, "جيلا#2", { cx: GX, cy: 600, s: 1.2 }, 1.4],
  ]);
  const N = 12;
  return (
    <Leaf q={q} id="b5g" cam={cam}
      R={<g>
        <VThread x={GX} y1={110} y2={880} p={1} knots={[
          { y: 140, kind: "tied", q: 1 }, { y: 190, kind: "tied", q: 1 }, { y: 240, kind: "tied", q: 1 }, { y: 290, kind: "dark", q: 1 },
          { y: 360, kind: "tied", q: 1, label: "٥", lq: 1 },
        ]} />
        <g transform={`translate(${GX} 430) scale(${0.5 + 0.6 * grow}) translate(${-GX} -430)`}>{small(born, 430, die, "g1")}</g>
        {small(g2, 490, prog(t, k.at("جيلا#2") + 1.0, k.at("جيلا#2") + 2.0), "g2")}
        {small(g3, 550, prog(t, k.at("جيلا#3") + 1.0, k.at("جيلا#3") + 2.0), "g3")}
        {Array.from({ length: N }, (_, i) => small(prog(many, i / N, (i + 1) / N), 600 + i * 22, prog(many, (i + 3) / N, (i + 5) / N), `m${i}`))}
        <Ink d={`M${GX + 90} 400 V860`} p={call} w={3} c={GOLD_D} />
        <Txt x={GX + 90} y={385} size={30} q={call} color={GOLD_D}>الدعوة</Txt>
      </g>} />
  );
});

// ─── c2-s16: دعوته بلسانه (لا رسم بجوار ذكر الله) ───
const Complaint = reverent((q) => {
  const k = cueKit(q, ["دعوته"]);
  const title = k.draw(0, "دعوته", 0.8);
  const seal = k.on(0, "القرآن", 0.6);
  const quote = k.on(0, "بلسانه", 0.8);
  const shk = k.draw(0, "يشكو", 0.8);
  const cam = k.cam(NEUTRAL, [[0, "بلسانه", { cx: 1365, cy: 520, s: 1.25 }, 1.0]]);
  return (
    <Leaf q={q} id="b5c" cam={cam}
      R={<g>
        <Write id="b5c-t" x={1365} y={230} size={62} p={title} label="دعوته" />
        <GoldSeal x={1620} y={360} q={seal} />
        <g opacity={quote}>
          <Txt x={1640 - 40 * (1 - quote)} y={600} size={140} q={1} font="amiri" color={C.inkSoft}>«</Txt>
          <Txt x={1090 + 40 * (1 - quote)} y={600} size={140} q={1} font="amiri" color={C.inkSoft}>»</Txt>
          <Ink d="M1560 560 H1170" p={quote} w={3} c={C.inkSoft} />
        </g>
        <Write id="b5c-s" x={1365} y={740} size={52} p={shk} label="يشكو" font="tajawal" />
      </g>} />
  );
});

/** أفق الغسق والبيوت (مشترك بين مشاهد الدعوة) */
const HY = 640;
const Village5: React.FC<{ row: number; ring: number; lit?: (i: number) => number; shut?: (i: number) => number; curtain?: number }> = ({ row, ring, lit, shut, curtain = 0 }) => (
  <g>
    <Horizon y={HY} p={1} sky="dusk" />
    {ROW.map((x, i) => <House key={i} x={x} y={HY + 4} g={i} s={1.2} q={row} lit={lit?.(i) ?? 0} shut={shut?.(i) ?? 0} curtain={curtain} />)}
    {RING.map(([x, y], i) => <House key={`r${i}`} x={x} y={y} g={i + 2} s={0.95} q={ring} shut={shut?.(i + ROW.length) ?? 0} curtain={curtain} />)}
    <ellipse cx={PLAZA[0]} cy={PLAZA[1] + 20} rx={190 * ring} ry={50 * ring} fill="none" stroke={C.inkSoft} strokeWidth={2} strokeDasharray="8 8" opacity={ring} />
  </g>
);

// ─── c2-s19: ليلًا ونهارًا، علنًا وسرًّا (الدفعة ٦ البند ١٢٧: لا «باب بعد باب») ───
const DayNight = reverent((q) => {
  const k = cueKit(q, ["واصل"]);
  const { t } = k;
  const row = prog(t, 0.05, 0.8);
  const moon = prog(t, k.at("الليل", 1.4) - 0.05, k.at("الليل", 1.4) + 1.4);
  const sun = prog(t, k.at("النهار", 1.4) - 0.05, k.at("النهار", 1.4) + 1.4);
  const ring = k.on(0, "علنا", 0.8);
  const secret = k.on(0, "السر", 0.8);
  const lit = (i: number) => (i === 3 ? secret : 0);
  const cam = k.cam(NEUTRAL, [
    [0, "علنا", { cx: 620, cy: 640, s: 1.15 }, 1.0],
    [0, "السر", { cx: 1400, cy: 600, s: 1.25 }, 1.0],
  ]);
  const sky = (
    <g>
      {sun > 0 && sun < 1 ? <circle cx={mix(1700, 1100, sun)} cy={HY - 260 * Math.sin(Math.PI * sun) - 20} r={32} fill={C.ember} opacity={0.8} stroke={C.ink} strokeWidth={3} /> : null}
      {moon > 0 && moon < 1 ? (
        <g transform={`translate(${mix(1000, 300, moon)} ${HY - 260 * Math.sin(Math.PI * moon) - 20})`}>
          <path d="M0 -30 A30 30 0 1 0 0 30 A22 22 0 1 1 0 -30 Z" fill={C.sand} stroke={C.ink} strokeWidth={3} />
        </g>
      ) : null}
      <Ink d={`M1700 ${HY - 20} Q1400 ${HY - 540} 1100 ${HY - 20}`} p={sun} w={2} c={C.inkSoft} dash="8 10" />
      <Ink d={`M1000 ${HY - 20} Q650 ${HY - 540} 300 ${HY - 20}`} p={moon} w={2} c={C.inkSoft} dash="8 10" />
    </g>
  );
  const both = <g><Village5 row={row} ring={ring} lit={lit} />{sky}</g>;
  return <Leaf q={q} id="b5dn" cam={cam} L={both} R={both} />;
});

// ─── c2-s20: أبواب تُغلق ───
const ClosedDoors = reverent((q) => {
  const k = cueKit(q, ["سمعوه"]);
  const { t } = k;
  const s0 = k.at("سمعوه", 0.3);
  const c0 = k.at("سدوا", 0.3);
  const shutAll = (i: number) => prog(t, c0 + i * 0.12, c0 + i * 0.12 + 0.3);
  const broken = prog(t, c0, c0 + 1.2);
  const curtain = k.on(0, "وغطوا", 0.8);
  const wall = k.draw(0, "وأصروا", 1.0);
  const cam = k.cam(NEUTRAL, [
    [0, "سمعوه", { cx: 640, cy: 640, s: 1.15 }, 1.0],
    [0, "وغطوا", { cx: 1380, cy: 600, s: 1.2 }, 1.0],
    [0, "وأصروا", NEUTRAL, 1.0],
  ]);
  const waves = (
    <g>
      {[0, 1, 2].map((i) => {
        const g = prog(t, s0 + i * 0.35, s0 + i * 0.35 + 1.4);
        if (g <= 0) return null;
        const r = 40 + 900 * g;
        return <ellipse key={i} cx={PLAZA[0]} cy={PLAZA[1]} rx={r} ry={r * 0.36} fill="none" stroke={GOLD_D} strokeWidth={3} strokeDasharray={broken > 0 ? `${30 * (1 - broken) + 4} ${20 + 40 * broken}` : undefined} opacity={0.7 * (1 - 0.6 * g) * (1 - 0.7 * broken)} />;
      })}
    </g>
  );
  const both = (
    <g>
      <Village5 row={1} ring={1} shut={shutAll} curtain={curtain} />
      {waves}
      <Ink d={`M1760 ${HY + 70} H170`} p={wall} w={12} c="#7D7468" />
      <Ink d={`M1760 ${HY + 70} H170`} p={wall} w={2} c={C.ink} dash="40 8" />
    </g>
  );
  return <Leaf q={q} id="b5cd" cam={cam} L={both} R={both} />;
});

// ─── c2-s21: لا شيء يخسرونه ───
const NothingLost = reverent((q) => {
  const k = cueKit(q, ["يخسرونه"]);
  const line = k.draw(0, "يدعوهم", 1.0);
  const box = k.draw(0, "شيء", 0.8);
  const word = k.draw(0, "يخسرونه", 0.9);
  const cam = k.cam(NEUTRAL, [[0, "شيء", { cx: 1365, cy: 400, s: 1.25 }, 1.0]]);
  const both = (
    <g>
      <Village5 row={1} ring={1} shut={() => 1} />
      <Ink d={`M${PLAZA[0]} ${PLAZA[1] - 30} C900 520 1100 560 1360 ${HY - 20}`} p={line} w={3} c={GOLD_D} dash="10 8" />
    </g>
  );
  return (
    <Leaf q={q} id="b5nl" cam={cam} L={both}
      R={<g>{both}
        <Ink d="M1475 260 H1255 V420 H1475 Z" p={box} w={4} />
        <Write id="b5nl-w" x={1365} y={490} size={50} p={word} label="يخسرونه" font="tajawal" />
      </g>} />
  );
});

/** شجيرة بخط الدفتر */
const Bush: React.FC<{ x: number; y: number; q: number; s?: number }> = ({ x, y, q, s = 1 }) =>
  q <= 0 ? null : (
    <g opacity={q} transform={`translate(${x} ${y}) scale(${s * (0.5 + 0.5 * q)})`}>
      <path d="M0 0 V-30" stroke={C.ink} strokeWidth={4} />
      <path d="M-34 -36 C-50 -70 -10 -96 6 -80 C20 -104 60 -80 44 -52 C64 -36 40 -10 16 -24 C0 -8 -30 -14 -34 -36 Z" fill={GREEN} opacity={0.75} stroke={C.ink} strokeWidth={3} />
    </g>
  );

// ─── c2-s24: وعد الاستغفار ───
const Promise5 = reverent((q) => {
  // الدفعة ٦ البند ١٢٨: «الأموال» و«البنين» بالكلمة وحدها (لا قمح ولا عملات ولا أشخاص)
  const k = cueKit(q, ["استغفار"]);
  const { t } = k;
  const istighfar = k.draw(0, "استغفار", 1.0);
  const cloud = k.on(0, "المطر", 0.7);
  const rain = cloud * (1 - 0.6 * k.on(0, "رحمة", 1.0));
  const amwal = k.draw(0, "والأموال", 0.7);
  const banin = k.draw(0, "والبنين", 0.7);
  const bush = [0, 1, 2].map((i) => prog(t, k.at("والبساتين") + i * 0.18 - 0.05, k.at("والبساتين") + i * 0.18 + 0.5, easeOut));
  const river = k.draw(0, "والأنهار", 1.4);
  const rahma = k.draw(0, "رحمة", 0.9);
  const ghadab = k.on(0, "غضب", 0.6);
  const cam = k.cam(NEUTRAL, [
    [0, "المطر", { cx: 1400, cy: 460, s: 1.15 }, 1.0],
    [0, "والأموال", { cx: 700, cy: 420, s: 1.15 }, 1.0],
    [0, "والأنهار", NEUTRAL, 1.2],
  ]);
  const river_d = `M1760 ${HY + 170} C1500 ${HY + 120} 1300 ${HY + 220} 1000 ${HY + 160} C760 ${HY + 110} 520 ${HY + 220} 170 ${HY + 150}`;
  const both = (
    <g>
      <Village5 row={1} ring={0} />
      <Ink d={river_d} p={river} w={14} c={WATER} opacity={0.55} />
      <Ink d={river_d} p={river} w={3} c={WATER} />
      {[[900, HY + 70], [1180, HY + 90], [300, HY + 60]].map(([x, y], i) => <Bush key={i} x={x!} y={y!} q={bush[i]!} />)}
    </g>
  );
  return (
    <Leaf q={q} id="b5p" cam={cam} L={<g>{both}<Write id="b5p-a" x={760} y={300} size={40} p={amwal} label="الأموال" font="tajawal" color={C.inkSoft} /><Write id="b5p-b" x={480} y={300} size={40} p={banin} label="البنين" font="tajawal" color={C.inkSoft} /></g>}
      R={<g>{both}
        <Write id="b5p-i" x={1365} y={200} size={50} p={istighfar} label="الاستغفار" />
        <g opacity={cloud} transform={`translate(1500 ${330 - 20 * (1 - cloud)})`}>
          <path d="M-110 20 C-130 -20 -80 -50 -50 -36 C-40 -76 30 -80 44 -40 C80 -56 120 -20 100 16 C80 34 -90 40 -110 20 Z" fill="#C9C4BC" stroke={C.ink} strokeWidth={3} />
        </g>
        <Rain x={1400} y={370} w={200} h={HY - 380} q={rain} t={t} />
        <Write id="b5p-r" x={1250} y={400} size={70} p={rahma} label="رحمة" color={EMBER} />
        <Txt x={1100} y={470} size={28} q={ghadab * 0.5} color={C.inkSoft}>غضب</Txt>
      </g>} />
  );
});

// ─── c2-s25..s28: الورقة الجانبية — أعمار الروايات ───
const SH = { x: 560, y: 520, w: 620, h: 560 };
const ROWS = [
  { w: "بعث", label: "حين بُعث" },
  { w: "الطوفان", label: "بعد الطوفان" },
  { w: "كله", label: "عمره كله" },
];
const SideSheet = reverent((q) => {
  // الدفعة ٦ البند ١٢٩: الخانة الذهبية «مدة لبثه في قومه» تعود، وإطار «نص صحيح» فارغ لمجموع عمره، بلا لسان «أهل الكتاب»
  const k = cueKit(q, ["زاد", "أعمارا", "لبث", "فلن"]);
  const { t, S } = k;
  const slide = k.on(0, "زاد", 0.9);
  const tabs = S === 0 ? k.on(0, "روايات", 0.6) : 1;
  const lines = k.draw(1, "أعمارا", 0.9);
  const rows = ROWS.map((r) => k.on(1, r.w, 0.6));
  const gold = k.on(2, "القرآن", 0.7);
  const sahih = k.draw(2, "نصا", 0.9);
  const empty = S === 2 ? bounce(t, k.at("مجموع"), k.at("مجموع") + 1.0) : 0;
  const lift = S === 3 ? prog(t, k.at("فلن", 0.8) - 0.05, k.at("فلن", 0.8) + 0.8, easeOut) : 0;
  const fold = k.on(3, "رقما", 0.8);
  const seal = k.on(3, "رواية", 0.5);
  const cam = k.cam({ cx: 700, cy: 520, s: 1.1 }, [
    [0, "روايات", { cx: 600, cy: 380, s: 1.3 }, 1.0],
    [1, "بعث", { cx: 600, cy: 520, s: 1.3 }, 1.2],
    [2, "القرآن", { cx: 600, cy: 360, s: 1.3 }, 1.0],
    [2, "نصا", { cx: 560, cy: 600, s: 1.25 }, 1.0],
    [3, "رقما", { cx: 560, cy: 560, s: 1.25 }, 1.0],
  ]);
  const top = SH.y - SH.h / 2;
  const L = (
    <g transform={`translate(${-500 * (1 - slide)} 0)`} opacity={Math.min(1, slide * 2)}>
      <Sheet x={SH.x} y={SH.y} w={SH.w} h={SH.h} q={1} rot={-1.5}>
        <g>
          {ROWS.map((r, i) => {
            const y = -130 + i * 130;
            return (
              <g key={i}>
                <Ink d={`M260 ${y + 30} H-260`} p={lines} w={2} c={C.inkSoft} opacity={0.6} />
                <Txt x={250} y={y + 10} size={32} q={rows[i]!} anchor="start" color={C.ink}>{r.label}</Txt>
                <g opacity={rows[i]}>
                  <Hatch x={-60} y={y - 20} w={100} h={40} o={1.6} />
                  <Hatch x={-170} y={y - 20} w={90} h={40} o={1.6} />
                </g>
              </g>
            );
          })}
          <g opacity={gold}>
            <rect x={-290} y={-250} width={190} height={56} rx={6} fill="none" stroke={C.gold} strokeWidth={4} />
            <Txt x={-195} y={-214} size={18} q={1} font="amiri">مدة لبثه في قومه</Txt>
          </g>
          <DotFrame x={-150} y={225} w={200} h={70} q={sahih} c={empty > 0 ? EMBER : C.inkSoft} />
          <Txt x={120} y={235} size={26} q={sahih} color={C.inkSoft}>نص صحيح:</Txt>
          {fold > 0 ? <rect x={-SH.w / 2} y={SH.h / 2 - SH.h * 0.55 * fold} width={SH.w} height={SH.h * 0.55 * fold} rx={6} fill="#E6D8BE" stroke={C.ink} strokeWidth={3} /> : null}
          <Seal x={0} y={SH.h / 2 - SH.h * 0.27} q={seal} kind="رواية" s={0.7} />
        </g>
      </Sheet>
      <Tab x={SH.x + SH.w / 2 - 20} y={top - 44} q={tabs} label="المفسرون" />
      <Tab x={SH.x + 40} y={top - 44} q={tabs} label="المؤرخون" />
      {S === 3 ? (
        <g opacity={1 - lift * 0.7} transform={`translate(${SH.x + 160} ${SH.y + 40 - 160 * lift}) rotate(-35) scale(0.3)`}>
          <path d="M-100 -16 C-68 -16 -40 -8 0 0 C-40 8 -68 16 -100 16 Z" fill="#2B1E14" />
          <path d="M-100 -16 H-560 V16 H-100 Z" fill="#C9A06A" stroke={C.ink} strokeWidth={8} />
        </g>
      ) : null}
    </g>
  );
  return <Leaf q={q} id="b5ss" cam={cam} L={L} />;
});

// ─── c2-s32 / c2-s33: البلاغ والإنكار والشهادة ───
const Witness = reverent((q) => {
  // الدفعة ٦ البند ١٣٠: شريط مصدر «البخاري ٣٣٣٩»، ولا ختم ذهبي للقرآن (حُذف «بما أخبرها القرآن»)
  const k = cueKit(q, ["البلاغ", "صحيح"]);
  const { t, S } = k;
  const back = k.open(0, 0.6);
  const ticks = S === 0 ? prog(t, k.at("البلاغ") - 0.05, k.last + 0.6) : 1;
  const balagh = k.draw(0, "البلاغ", 0.7);
  const deny = k.draw(0, "ينكر", 0.9);
  const src = k.on(1, "صحيح", 0.6);
  const box = k.draw(1, "يشهد", 0.8);
  const witness = k.on(1, "فتشهد", 0.6);
  const ballagh = k.draw(1, "بلغ", 0.8);
  const cam = k.cam({ cx: 1365, cy: 500, s: 1.15 }, [
    [0, "البلاغ", { cx: 1450, cy: 520, s: 1.3 }, 1.0],
    [0, "ينكر", { cx: 1250, cy: 500, s: 1.2 }, 1.0],
    [1, "يشهد", { cx: 1450, cy: 300, s: 1.3 }, 1.0],
    [1, "فتشهد", { cx: 1480, cy: 460, s: 1.35 }, 1.0],
  ]);
  const N = 22;
  return (
    <Leaf q={q} id="b5w" cam={cam}
      R={<g>
        <g opacity={back}>
          <rect x={1520} y={130} width={200} height={70} rx={8} fill="none" stroke={C.gold} strokeWidth={4} />
          <Txt x={1620} y={176} size={22} q={1} font="amiri">تسعمئة وخمسون سنة</Txt>
        </g>
        <VThread x={1730} y1={220} y2={860} p={1} knots={[{ y: 300, kind: "tied", q: 1 }]} />
        <Txt x={1450} y={270} size={40} q={balagh} color={C.ink}>البلاغ</Txt>
        {Array.from({ length: N }, (_, i) => (
          <path key={i} d={`M1500 ${310 + i * 24} H1400`} stroke={C.ink} strokeWidth={4} strokeLinecap="round" opacity={prog(ticks, i / N, (i + 1) / N)} />
        ))}
        <Txt x={1130} y={270} size={40} q={deny} color={C.inkSoft}>ما جاءنا</Txt>
        <rect x={1060} y={300} width={140} height={540} rx={8} fill="none" stroke={C.inkSoft} strokeWidth={3} strokeDasharray="12 10" opacity={deny} />
        <Tab x={1760} y={60} q={src} label="صحيح البخاري ٣٣٣٩" />
        <Ink d="M1520 150 H1380 V210 H1520 Z" p={box} w={3} c={C.inkSoft} dash="8 6" />
        <Seal x={1450} y={470} q={witness} kind="شاهد" s={0.6} />
        <Write id="b5w-u" x={1450} y={580} size={44} p={ballagh} label="بلّغ" font="tajawal" />
      </g>} />
  );
});

// ─── c2-s38: لوح في أرض لا ماء فيها ───
const PlankTeaser = reverent((q) => {
  const k = cueKit(q, ["يؤمر"]);
  const thread = k.draw(0, "يؤمر", 1.0);
  const ruler = k.draw(0, "يصنع", 1.0);
  const houses = k.on(0, "قومه", 0.8);
  const cracks = k.draw(0, "ماء", 1.0);
  const word = k.draw(0, "السفينة", 0.9);
  const plank = k.on(0, "السفينة", 1.0);
  const cam = k.cam(NEUTRAL, [
    [0, "يصنع", { cx: 1300, cy: 700, s: 1.2 }, 1.0],
    [0, "قومه", { cx: 600, cy: 560, s: 1.15 }, 1.0],
    [0, "السفينة", { cx: 1200, cy: 620, s: 1.15 }, 1.0],
  ]);
  const both = (
    <g>
      <Horizon y={560} p={1} sky="noon" ground="#D8BE8E" />
      {[[1600, 640, 1480, 760, 1], [1050, 700, 880, 820, 2], [620, 660, 420, 800, 3], [300, 620, 200, 700, 4]].map(([x1, y1, x2, y2, s], i) => (
        <Ink key={i} d={crackPath(x1!, y1!, x2!, y2!, 70 + s!, 8, 10)} p={prog(cracks, i * 0.15, 0.6 + i * 0.13)} w={3} c="#5A4030" />
      ))}
      {[0, 1, 2, 3].map((i) => <House key={i} x={480 + i * 70} y={560} g={i} s={0.55} q={houses * 0.7} />)}
    </g>
  );
  return (
    <Leaf q={q} id="b5pt" cam={cam} L={both}
      R={<g>{both}
        <VThread x={1720} y1={110} y2={500} p={thread} knots={[{ y: 160, kind: "tied", q: thread }, { y: 210, kind: "tied", q: thread }, { y: 260, kind: "tied", q: thread }, { y: 310, kind: "dark", q: thread }, { y: 400, kind: "tied", q: thread }]} />
        <Ink d="M1640 720 H1080" p={ruler} w={5} c={C.inkSoft} />
        {Array.from({ length: 15 }, (_, i) => <path key={i} d={`M${1640 - i * 40} 720 v${i % 5 ? -10 : -20}`} stroke={C.inkSoft} strokeWidth={2.5} opacity={prog(ruler, i / 15, i / 15 + 0.1)} />)}
        <Plank x={1300} y={800} w={340} q={plank} o={0.5} rot={-3} />
        <Write id="b5pt-s" x={1340} y={420} size={60} p={word} label="السفينة" />
      </g>} />
  );
});

export const BD05_SCENES: Record<string, React.FC<BdProps>> = {
  "bd05-drop-stone": DropStone,
  "bd05-thread-knot": ThreadKnot,
  "bd05-blank-ribbon": BlankRibbon,
  "bd05-hadith-lead": HadithLead,
  "bd05-first-messenger": FirstMessenger,
  "bd05-one-number": OneNumber,
  "bd05-generations": Generations,
  "bd05-complaint": Complaint,
  "bd05-day-night": DayNight,
  "bd05-closed-doors": ClosedDoors,
  "bd05-nothing-lost": NothingLost,
  "bd05-promise": Promise5,
  "bd05-side-sheet": SideSheet,
  "bd05-witness": Witness,
  "bd05-plank-teaser": PlankTeaser,
};

/** مشهد الصورة الثابتة للمراجعة لكل لقطة (المعرّف في الخطة)؛ الغائب = آخر مشهد يستعمل اللقطة، عند نهاية آخر كلمة */
export const BD05_STILLS: Record<string, string> = {
  // الغلاف المرشح: الحجر وفي وسطه الحفرة
  "bd05-drop-stone": "c2-s36",
  "bd05-thread-knot": "c2-s5",
  "bd05-side-sheet": "c2-s27",
};
