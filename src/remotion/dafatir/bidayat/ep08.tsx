/**
 * «دفاتر الزمن 008 — على الجودي»: لقطات «خط الأفق» الجديدة كما في خطة المشاهد (scenes.md، D214).
 * لا تصوير لنوح عليه السلام ولا لأحد ممن معه بأي هيئة، ولا للسفينة كاملة، ولا وجوه: الجبل والماء والأرض والضوء والحبر والأختام.
 * خط الأفق هنا خط الماء الهابط، والعقدة الثامنة حصاة. رموز بانتظار اعتماد المالك: دبوس الموصل (c1-s7)، وخيالا الطائرين
 * وورقة الزيتون تحت «رواية» (c1-s11–s13)، وعلامة القارب الصغيرة (c1-s16).
 */
import React from "react";
import { Books, Hatch, Lens, Ruler, TreeLeaf, Boat, Wheat } from "../lib/drawings";
import { DateRibbon, Pin } from "../horizon/book";
import {
  Arrow, BlankLine, C, DotFrame, Dot, Field, GOLD_D, Grass, Horizon, Ink, Leaf, NEUTRAL, Peak, Q, Ring, Scribble, Seal, Sheet, Sun, Tab, Thread, Txt, WATER,
  Waterline, Write, Crow, bounce, cueKit, mix, prog, reverent, rng, type BdProps,
} from "./kit";

const PX = 1365;
const SEALS = ["ثابت", "تقدير", "رواية", "لا نعلم"] as const;

/** قمة تخرج من خط الماء: base على خط الماء، والارتفاع بنسبة الخروج */
const Mount: React.FC<{ x?: number; base: number; emerge: number; w?: number; h?: number; o?: number }> = ({ x = PX, base, emerge, w = 440, h = 300, o = 1 }) =>
  emerge <= 0 ? null : <g opacity={o}><Peak x={x} y={base} w={w * (0.6 + 0.4 * emerge)} h={h * emerge} p={1} /></g>;

/** خانة ختم فارغة متقطعة */
const Slot: React.FC<{ x: number; y: number; q: number; gold?: boolean }> = ({ x, y, q, gold }) =>
  q <= 0 ? null : gold ? (
    <circle cx={x} cy={y} r={40} fill="none" stroke={GOLD_D} strokeWidth={4} strokeDasharray="10 8" opacity={q} />
  ) : (
    <rect x={x - 90} y={y - 46} width={180} height={92} rx={12} fill="none" stroke={C.inkSoft} strokeWidth={3.5} strokeDasharray="12 9" opacity={q} />
  );

/** ورقة مطوية (أرارات) تنفتح بنسبة open */
const Folded: React.FC<{ x: number; y: number; q: number; open: number; name: number; head?: number; s?: number }> = ({ x, y, q, open, name, head = 0, s = 1 }) =>
  q <= 0 ? null : (
    <g opacity={q} transform={`translate(${x} ${y}) scale(${s})`}>
      <g transform={`scale(${0.25 + 0.75 * open} 1)`}>
        <rect x={-170} y={-110} width={340} height={220} rx={6} fill="#F6EBD3" stroke={C.ink} strokeWidth={3} />
        <path d="M0 -110 V110" stroke={C.ink} strokeWidth={1.6} opacity={0.35 * open} />
      </g>
      <Txt x={0} y={20} size={56} q={name} color={C.inkSoft} font="amiri">أرارات</Txt>
      <Txt x={0} y={-62} size={28} q={head} color={C.ink}>أهل الكتاب</Txt>
    </g>
  );

/** غصن زيتون صغير (ورقة ضيقة أو غصن بأوراق) */
const Olive: React.FC<{ x: number; y: number; q: number; branch?: number; s?: number; o?: number; rot?: number }> = ({ x, y, q, branch = 0, s = 1, o = 1, rot = -20 }) =>
  q <= 0 ? null : (
    <g opacity={q * o} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <Ink d="M0 60 C10 20 18 -20 30 -70" p={branch} w={3} c={C.ink} />
      {[[-20, 30, -50], [26, 0, 40], [-14, -30, -40], [36, -52, 30]].map(([dx, dy, r], i) => (
        <g key={i} transform="scale(0.55 0.9)"><TreeLeaf q={prog(branch, i / 4, i / 4 + 0.3)} x={dx! / 0.55} y={dy! / 0.9} rot={r} s={0.42} /></g>
      ))}
      <g transform="scale(0.5 1)"><TreeLeaf q={1} x={0} y={0} rot={0} s={0.7} /></g>
    </g>
  );

/** خيال حمامة بحبر باهت جدًا */
const Dove: React.FC<{ x: number; y: number; q: number; s?: number }> = ({ x, y, q, s = 1 }) =>
  q <= 0 ? null : (
    <g opacity={0.3 * q} transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-60 0 C-40 -30 20 -34 50 -10 L80 -20 L64 0 L80 14 L48 8 C20 26 -40 22 -60 0 Z" fill="#E8E0D2" stroke={C.inkSoft} strokeWidth={3} />
      <path d="M-10 -14 C0 -60 40 -70 60 -56 C40 -40 20 -24 -10 -14 Z" fill="#E8E0D2" stroke={C.inkSoft} strokeWidth={3} />
      <path d="M-60 0 L-78 -4 L-60 6" fill="none" stroke={C.inkSoft} strokeWidth={3} />
    </g>
  );

/** شظية خشب بخط متقطع (لا هيئة سفينة) */
const Shard: React.FC<{ x: number; y: number; q: number; s?: number }> = ({ x, y, q, s = 1 }) =>
  q <= 0 ? null : (
    <path transform={`translate(${x} ${y}) scale(${s}) rotate(-12)`} d="M-46 -8 L30 -14 L48 -2 L36 10 L-40 12 L-30 2 Z" fill="#C9A06A" fillOpacity={0.35 * q} stroke={C.ink} strokeWidth={3} strokeDasharray="8 6" opacity={q} />
  );

/** خريطة مطوية صغيرة: ورقة بخطي نهرين باهتين */
const MiniMap: React.FC<{ x: number; y: number; q: number; s?: number }> = ({ x, y, q, s = 1 }) =>
  q <= 0 ? null : (
    <g opacity={q} transform={`translate(${x} ${y}) scale(${s}) rotate(-6)`}>
      <rect x={-110} y={-70} width={220} height={140} rx={4} fill="#F3E6CB" stroke={C.ink} strokeWidth={3} />
      <path d="M-36 -70 V70 M36 -70 V70" stroke={C.ink} strokeWidth={1.5} opacity={0.4} />
      <path d="M-80 -50 C-40 -20 -50 20 -10 50 M20 -56 C50 -20 30 20 70 52" fill="none" stroke={WATER} strokeWidth={3} opacity={0.5} />
    </g>
  );

const Water: React.FC<{ y: number; t: number; p?: number; amp?: number }> = ({ y, t, p = 1, amp = 6 }) => <Waterline y={y} p={p} t={t} amp={amp} rows={3} fill={0.22} />;

// ─── c1-s1: القمة تخرج من الماء ───
const PeakShot = reverent((q) => {
  const k = cueKit(q, ["هدأ"]);
  const { t } = k;
  const calm = k.on(0, "هدأ", 1.2);
  const emerge = k.draw(0, "وقفت", 2.0);
  const notes = k.on(0, "قرونا", 0.8);
  const write = k.span(0, "وكتبوا", "كثيرا", 1.2);
  const cam = k.cam(NEUTRAL, [
    [0, "وقفت", { cx: PX, cy: 540, s: 1.3 }, 1.8],
    [0, "قرونا", { cx: 560, cy: 470, s: 1.15 }, 1.2],
  ]);
  const both = <Water y={600} t={t} amp={12 * (1 - 0.8 * calm)} />;
  const NOTES = [[520, 240, -3, 4], [430, 400, 4, 9], [600, 520, -2, 14]] as const;
  return (
    <Leaf q={q} id="b8p" cam={cam}
      L={<g>{both}
        {NOTES.map(([x, y, r, s], i) => (
          <Sheet key={i} x={x} y={y} w={300} h={120} q={prog(notes, i / 3, i / 3 + 0.4)} rot={r} tone={i % 2 ? "#F3E8D2" : "#FAF2E2"}>
            <Scribble x={120} y={-30} w={240} n={3} p={prog(write, i / 3, i / 3 + 0.4)} gap={28} seed={s} c={i === 1 ? "#5A4636" : C.inkSoft} o={0.5} />
          </Sheet>
        ))}
      </g>}
      R={<g><Mount base={600} emerge={emerge} />{both}</g>} />
  );
});

// ─── c1-s2: الخيط على خط الماء ───
const ThreadWater = reverent((q) => {
  const k = cueKit(q, ["الطوفان"]);
  const { t } = k;
  const thread = k.open(0, 1.2);
  const k7 = k.on(0, "الطوفان", 0.6);
  const glow = bounce(t, k.at("الطوفان"), k.at("الطوفان") + 1.6);
  const recede = k.draw(0, "ينحسر", 1.4);
  const wy = mix(520, 600, recede);
  const dot = k.on(0, "تقف");
  const slot = k.on(0, "القرآن");
  const name = k.draw(0, "الجودي", 0.9);
  const cam = k.cam(NEUTRAL, [
    [0, "الطوفان", { cx: 1500, cy: 520, s: 1.3 }, 1.0],
    [0, "ينحسر", { cx: PX, cy: 480, s: 1.2 }, 1.4],
  ]);
  const both = (
    <g>
      <Water y={wy} t={t} />
      <Thread x1={1760} x2={160} y={wy} p={thread} knots={[{ x: 1620, kind: "tied", q: k7, glow, label: "الطوفان", lq: k7 }]} />
    </g>
  );
  return (
    <Leaf q={q} id="b8tw" cam={cam} L={both}
      R={<g>
        <Mount base={600} emerge={0.75} />
        {both}
        <Dot x={1260} y={wy - 14} q={dot} r={8} />
        <Slot x={1590} y={300} q={slot} gold />
        <Write id="b8tw-n" x={PX} y={440} size={52} p={name} label="الجودي" />
      </g>} />
  );
});

// ─── c1-s3: العقدة الحجرية ───
const StoneKnot = reverent((q) => {
  const k = cueKit(q, ["نعقد"]);
  const loop = k.draw(0, "نعقد", 0.8);
  const stone = k.on(0, "حجر", 0.6);
  const l1 = k.draw(0, "مكان", 0.9);
  const l2 = k.draw(0, "وأول", 1.0);
  const slots = k.on(0, "ثبت", 0.8);
  const cam = k.cam({ cx: PX, cy: 520, s: 1.6 }, [[0, "مكان", { cx: PX, cy: 600, s: 1.3 }, 1.0], [0, "ثبت", { cx: PX, cy: 540, s: 1.05 }, 1.2]]);
  const both = <Thread x1={1760} x2={160} y={500} p={1} knots={[{ x: PX, kind: "stone", q: stone }]} />;
  return (
    <Leaf q={q} id="b8sk" cam={cam} L={both}
      R={<g>{both}
        <Ring x={PX} y={500} r={30} p={loop * (1 - stone)} c={C.ribbon} w={5} />
        <Write id="b8sk-1" x={PX} y={620} size={44} p={l1} label="مكان الاستقرار" font="tajawal" />
        <Write id="b8sk-2" x={PX} y={700} size={40} p={l2} label="أول خطوة بعد الماء" font="tajawal" color={C.inkSoft} />
        {[[1080, 380], [1650, 380], [1080, 800], [1650, 800]].map(([x, y], i) => <Slot key={i} x={x!} y={y!} q={prog(slots, i / 4, i / 4 + 0.4)} />)}
      </g>} />
  );
});

// ─── c1-s5: خانات القمة الفارغة ───
const BlankFields = reverent((q) => {
  const k = cueKit(q, ["بلد"]);
  const f1 = k.on(0, "بلد"), f2 = k.on(0, "ارتفاعه"), f3 = k.on(0, "يقع");
  const ruler = k.on(0, "ارتفاعه", 0.7);
  const ground = k.draw(0, "الأرض", 1.2);
  const cam = k.cam(NEUTRAL, [[0, "بلد", { cx: 700, cy: 420, s: 1.2 }, 1.0], [0, "ارتفاعه", { cx: 1300, cy: 520, s: 1.15 }, 1.0], [0, "يقع", { cx: 700, cy: 560, s: 1.15 }, 1.0]]);
  return (
    <Leaf q={q} id="b8bf" cam={cam}
      L={<g>
        <Field x={820} y={340} label="البلد:" q={f1} w={260} />
        <Field x={820} y={460} label="الارتفاع:" q={f2} w={220} />
        <Field x={820} y={580} label="الموضع:" q={f3} w={230} />
        <Ink d="M860 700 H420" p={ground} w={4} />
        <path d="M420 700 H200" stroke={C.ink} strokeWidth={4} strokeDasharray="10 12" opacity={prog(ground, 0.8, 1)} />
      </g>}
      R={<g>
        <Mount base={720} emerge={1} />
        <Ink d="M1100 720 H1640" p={1} w={4} />
        <g opacity={ruler} transform="translate(1660 560) rotate(-90) scale(0.42)"><Ruler /></g>
      </g>} />
  );
});

// ─── c1-s6 / c1-s14: الجبل ذو الأختام الأربعة (القطعة المخصوصة) ───
const SLOT_POS = [[1080, 300], [1650, 300], [1080, 640], [1650, 640]] as const;
const SealMount = reverent((q) => {
  const k = cueKit(q, ["تحديد", "أختام"]);
  const { t, S } = k;
  const pin = k.on(0, "تحديد", 0.6);
  const hover = Math.sin(t * 3) * 14;
  const hadith = k.on(0, "حديث");
  const arc = k.draw(0, "الاسم", 0.9);
  const seals = S === 0 ? [k.on(0, "ثابت", 0.5), 0, 0, 0] : [0, 1, 2, 3].map((i) => prog(t, k.at("أختام") + i * 0.35 - 0.05, k.at("أختام") + i * 0.35 + 0.4));
  const truth = k.draw(1, "الصدق", 0.9);
  const join = k.draw(1, "نعرفه", 1.0);
  const cam = k.cam(NEUTRAL, [
    [0, "تحديد", { cx: PX, cy: 400, s: 1.25 }, 1.0],
    [0, "حديث", { cx: 900, cy: 520, s: 1.05 }, 1.0],
    [0, "الاسم", { cx: PX, cy: 460, s: 1.3 }, 1.0],
    [1, "جبل", { cx: PX, cy: 480, s: 1.25 }, 1.2],
    [1, "نعرفه", { cx: PX, cy: 500, s: 1.05 }, 1.0],
  ]);
  return (
    <Leaf q={q} id="b8sm" cam={cam}
      L={<g>
        <Water y={720} t={t} amp={4} />
        <Field x={860} y={420} label="حديث صحيح في المكان:" q={hadith} w={170} size={34} />
      </g>}
      R={<g>
        <Mount base={720} emerge={1} />
        <Water y={720} t={t} amp={4} />
        <Txt x={PX} y={540} size={50} q={1} font="amiri">الجودي</Txt>
        <Ink d={`M${PX + 110} 560 C${PX + 90} 600 ${PX - 90} 600 ${PX - 110} 560`} p={arc} w={4} c={GOLD_D} />
        {S === 0 ? <Pin x={PX} y={250 + hover} s={0.9} o={pin} /> : null}
        {SLOT_POS.map(([x, y], i) => (
          <g key={i}><Slot x={x} y={y} q={1} /><Seal x={x} y={y} q={seals[i]!} kind={SEALS[i]!} s={0.55} /></g>
        ))}
        <Write id="b8sm-s" x={PX} y={800} size={54} p={truth} label="الصدق" />
        <path d="M1050 220 C1000 500 1060 760 1365 760 C1670 760 1730 500 1680 220" fill="none" stroke={GOLD_D} strokeWidth={4} strokeDasharray="12 8" opacity={join} />
      </g>} />
  );
});

// ─── c1-s7: مخطط الجزيرة الباهت ───
const TafsirSketch = reverent((q) => {
  const k = cueKit(q, ["الطبري"]);
  const { t } = k;
  const tab = k.on(0, "المفسرون", 0.6);
  const names = k.draw(0, "الطبري", 1.2);
  const rivers = k.draw(0, "بالجزيرة", 1.4);
  const pin = k.on(0, "الموصل", 0.5);
  const jit = Math.sin(t * 23) * 4 * pin;
  const cam = k.cam(NEUTRAL, [[0, "الطبري", { cx: PX, cy: 330, s: 1.25 }, 1.0], [0, "بالجزيرة", { cx: 560, cy: 500, s: 1.15 }, 1.2]]);
  return (
    <Leaf q={q} id="b8ts" cam={cam}
      L={<g>
        <Ink d="M300 180 C360 320 330 460 420 600 C470 680 520 740 600 800" p={rivers} w={3.5} c={WATER} opacity={0.55} />
        <Ink d="M560 160 C620 300 600 420 680 560 C720 640 700 720 640 800" p={rivers} w={3.5} c={WATER} opacity={0.55} />
        <g opacity={prog(rivers, 0.6, 1)}><Hatch x={420} y={300} w={190} h={380} o={0.8} /></g>
        <g transform={`translate(${jit} ${-Math.abs(jit)})`}><Pin x={520} y={300} s={0.6} o={pin} /></g>
        <Txt x={460} y={260} size={26} q={pin} color={C.inkSoft}>قرب الموصل</Txt>
      </g>}
      R={<g>
        <Tab x={1760} y={200} q={tab} label="أهل التفسير" />
        <Write id="b8ts-t" x={PX} y={340} size={44} p={names} label="الطبري عن مجاهد وقتادة" font="tajawal" />
        <Txt x={PX} y={430} size={36} q={rivers} color={C.inkSoft}>جبل بالجزيرة</Txt>
      </g>} />
  );
});

/** ثلاثة كتب مغلقة في الهامش (كعوب) */
const ThreeBooks: React.FC<{ x: number; y: number; q: number }> = ({ x, y, q }) =>
  q <= 0 ? null : (
    <g opacity={q} transform={`translate(${x} ${y + (1 - q) * 20})`}>
      {["#3A4A3A", C.ribbon, "#5A3A26"].map((c, i) => (
        <g key={i} transform={`translate(${i * 54} 0) rotate(${(i - 1) * 3})`}>
          <rect x={-22} y={-120} width={46} height={240} rx={4} fill={c} stroke={C.ink} strokeWidth={3} />
          <rect x={-14} y={-90} width={30} height={8} fill={C.gold} opacity={0.8} />
          <rect x={-14} y={80} width={30} height={8} fill={C.gold} opacity={0.8} />
        </g>
      ))}
    </g>
  );

// ─── c1-s9: الورقة المطوية ───
const FoldedLeaf = reverent((q) => {
  const k = cueKit(q, ["المقابل"]);
  const books = k.on(0, "كتب", 0.6);
  const open = k.draw(0, "أرارات", 0.9);
  const name = k.on(0, "أرارات", 1.1);
  const slot = k.on(0, "يأت");
  const head = k.on(0, "أهل");
  const seal = k.on(0, "رواية");
  const cam = k.cam(NEUTRAL, [[0, "المقابل", { cx: 600, cy: 500, s: 1.15 }, 1.2], [0, "أرارات", { cx: 620, cy: 480, s: 1.3 }, 1.0]]);
  return (
    <Leaf q={q} id="b8fl" cam={cam}
      L={<g>
        <ThreeBooks x={260} y={500} q={books} />
        <Folded x={620} y={480} q={open > 0 ? 1 : 0} open={open} name={name * 0.75} head={head} />
        <Slot x={830} y={300} q={slot} gold />
        <Seal x={680} y={660} q={seal} kind="رواية" s={0.6} />
      </g>}
      R={<g><Mount base={720} emerge={1} o={0.5} /><Waterline y={720} p={1} t={0} amp={3} rows={2} fill={0.15} /></g>} />
  );
});

// ─── c1-s10: شظية الخشب المتنقلة ───
const WoodShard = reverent((q) => {
  const k = cueKit(q, ["بقايا"]);
  const { t } = k;
  const shard = k.on(0, "بقايا", 0.6);
  const p1 = k.draw(0, "هذا", 0.9), p2 = k.draw(0, "ذاك", 0.9);
  const hop = k.span(0, "ذاك", "عليه", 1.0);
  const fade = k.on(0, "يثبت", 0.9);
  const seal = k.on(0, "نعلم");
  const ph = (Math.sin(t * 2.2) + 1) / 2;
  const sx = p2 > 0 ? mix(600, 1320, ph * hop + (1 - hop) * 0) : 600;
  const sy = 640 - Math.sin(Math.PI * (p2 > 0 ? ph * hop : 0)) * 260 - 90;
  const cam = k.cam(NEUTRAL, [[0, "بقايا", { cx: 600, cy: 560, s: 1.3 }, 1.0], [0, "ذاك", NEUTRAL, 1.2]]);
  const arrow = (
    <path d="M620 520 C800 300 1120 300 1300 520" fill="none" stroke={C.inkSoft} strokeWidth={4} strokeDasharray="12 10" opacity={hop * (1 - 0.6 * fade)} />
  );
  return (
    <Leaf q={q} id="b8ws" cam={cam}
      L={<g>
        <Ink d="M200 700 H950" p={1} w={3} c={C.inkSoft} />
        <Peak x={600} y={700} w={260} h={170} p={p1} />
        {arrow}
        <Shard x={sx} y={sy} q={shard * (1 - 0.8 * fade)} />
        <Seal x={600} y={360} q={seal} kind="لا نعلم" s={0.55} />
      </g>}
      R={<g>
        <Ink d="M970 700 H1720" p={1} w={3} c={C.inkSoft} />
        <Peak x={1320} y={700} w={260} h={190} p={p2} />
        {arrow}
        <Shard x={sx} y={sy} q={shard * (1 - 0.8 * fade)} />
      </g>} />
  );
});

/** قوس الحاشية الباهت على الصفحة اليسرى */
const MarginArc: React.FC<{ p: number }> = ({ p }) => (
  <g>
    <Ink d="M840 180 C620 160 300 180 260 300 C230 420 240 560 300 650 C380 740 620 760 840 740" p={p} w={3} c={C.inkSoft} opacity={0.7} />
    <rect x={250} y={170} width={600} height={590} rx={40} fill={C.page} opacity={0.25 * p} />
  </g>
);

// ─── c1-s11: حاشية الرواية الباهتة ───
const PaleMargin = reverent((q) => {
  const k = cueKit(q, ["غرابا"]);
  const { t } = k;
  const corner = k.on(0, "الكتب", 0.6);
  const arc = k.draw(0, "قصة", 1.2);
  const crow = k.on(0, "غرابا", 0.8);
  const dove = k.on(0, "حمامة", 0.8);
  const dry = k.draw(0, "جفت", 1.0);
  const leaf = k.on(0, "زيتون", 0.8);
  const cam = k.cam(NEUTRAL, [[0, "قصة", { cx: 560, cy: 460, s: 1.2 }, 1.2]]);
  return (
    <Leaf q={q} id="b8pm" cam={cam}
      L={<g>
        <MarginArc p={arc} />
        <g opacity={0.22}><Crow x={420} y={330 + Math.sin(t * 2) * 6} s={0.5} q={crow} pose="fly" flap={(Math.sin(t * 7) + 1) / 2} /></g>
        <Dove x={660} y={380 + Math.sin(t * 2 + 1) * 6} q={dove} s={0.8} />
        <Ink d="M300 640 C450 630 650 646 800 636" p={dry} w={4} c={mix(0, 1, dry) > 0.5 ? "#B79A6E" : WATER} opacity={0.6} />
        <Olive x={560} y={540} q={leaf} o={0.5} />
      </g>}
      R={<Folded x={1600} y={210} q={corner} open={1} name={0.7} s={0.45} />} />
  );
});

const COPIES = [[1200, 280, 15], [1580, 420, -30], [1300, 700, 40], [1650, 760, -10], [420, 260, 20], [760, 300, -25], [330, 760, 35], [820, 760, -40], [1050, 480, 5], [560, 820, 10]] as const;

// ─── c1-s12: نسخ الرمز ───
const SymbolCopies = reverent((q) => {
  const k = cueKit(q, ["جميلة"]);
  const clear = k.on(0, "جميلة", 0.8);
  const branch = k.draw(0, "وغصن", 1.1);
  const stamp = k.on(0, "رمزا", 0.5);
  const spread = k.span(0, "الناس", "مكان", 1.0);
  const cam = k.cam({ cx: 560, cy: 520, s: 1.3 }, [[0, "رمزا", { cx: 760, cy: 520, s: 1.1 }, 1.0], [0, "مكان", NEUTRAL, 1.2]]);
  const copies = (half: "L" | "R") => (
    <g>
      {COPIES.map(([x, y, r], i) => {
        if ((half === "L") !== x < 960) return null;
        const v = i < 2 ? stamp : prog(spread, (i - 2) / 8, (i - 2) / 8 + 0.3);
        return <Olive key={i} x={x} y={y} q={v} branch={1} s={0.55} o={0.85} rot={r} />;
      })}
    </g>
  );
  return (
    <Leaf q={q} id="b8sc" cam={cam}
      L={<g><MarginArc p={1} /><Olive x={560} y={540} q={1} branch={branch} o={0.5 + 0.5 * clear} />{copies("L")}</g>}
      R={copies("R")} />
  );
});

// ─── c1-s13: رواية لا يُبنى عليها ───
const NoFoundation = reverent((q) => {
  const k = cueKit(q, ["فختمها"]);
  const { t } = k;
  const s1 = k.on(0, "تأت"), s2 = k.on(0, "حديث");
  const arrow = k.draw(0, "أهل", 1.0);
  const seal = k.on(0, "رواية");
  const glow = bounce(t, k.at("أين"), k.at("أين") + 1.0);
  const base = k.draw(0, "لنبني", 0.6);
  const lift = prog(t, k.at("لنبني") + 0.6, k.at("لنبني") + 1.4);
  const cam = k.cam(NEUTRAL, [[0, "أهل", { cx: 1100, cy: 400, s: 1.05 }, 1.0], [0, "لنبني", { cx: 560, cy: 600, s: 1.2 }, 1.0]]);
  return (
    <Leaf q={q} id="b8nf" cam={cam}
      L={<g>
        <MarginArc p={1} />
        <Olive x={560} y={480} q={1} branch={1} />
        <Slot x={380} y={250} q={s1} gold />
        <Field x={820} y={250} label="حديث صحيح:" q={s2} w={120} size={30} />
        <Seal x={700} y={640} q={seal} kind="رواية" s={0.55} />
        <g transform={`translate(0 ${-30 * lift})`} opacity={1 - lift}><Ink d="M820 780 H300" p={base} w={6} /></g>
        <Arrow d="M640 420 C800 300 1000 250 1100 240" p={arrow} hx={1100} hy={240} ang={-5} c={glow > 0 ? GOLD_D : C.ink} w={4 + 3 * glow} />
      </g>}
      R={<g>
        <Arrow d="M960 245 C1200 230 1380 220 1480 215" p={arrow} hx={1480} hy={215} ang={0} c={glow > 0 ? GOLD_D : C.ink} w={4 + 3 * glow} />
        <Folded x={1600} y={210} q={1} open={1} name={0.7} head={1} s={0.45} />
      </g>} />
  );
});

// ─── c1-s15: علامة التحديد الضائعة ───
const Crosshair = reverent((q) => {
  const k = cueKit(q, ["بالضبط"]);
  const { t } = k;
  const qm = k.on(0, "تسأل");
  const cross = k.draw(0, "بالضبط", 0.8);
  const calm = k.on(0, "يضر#2", 0.8);
  const fade = k.on(0, "يذكر", 1.2);
  const ibra = k.draw(0, "العبرة", 0.9);
  const pulse = (1 - calm) * Math.sin(t * 8) * 0.08;
  const cam = k.cam(NEUTRAL, [[0, "بالضبط", { cx: PX, cy: 420, s: 1.3 }, 1.0], [0, "العبرة", { cx: 800, cy: 480, s: 1.05 }, 1.2]]);
  return (
    <Leaf q={q} id="b8ch" cam={cam}
      L={<g><Q x={300} y={260} size={90} q={qm} /><Write id="b8ch-i" x={560} y={520} size={80} p={ibra} label="العبرة" /></g>}
      R={<g>
        <Mount base={720} emerge={1} />
        <Waterline y={720} p={1} t={0} amp={3} rows={2} fill={0.15} />
        <g opacity={1 - 0.85 * fade} transform={`translate(${PX + 40} 420) scale(${1 + pulse})`}>
          <Ink d="M0 -70 a70 70 0 1 1 -0.1 0" p={cross} w={3} c={C.ribbon} />
          <Ink d="M0 -100 V-40 M0 40 V100 M-100 0 H-40 M40 0 H100" p={cross} w={3} c={C.ribbon} />
        </g>
      </g>} />
  );
});

// ─── c1-s16: الماء يقف ───
const HILLS = [300, 520, 760, 1100, 1350, 1600];
const WaterHalt = reverent((q) => {
  const k = cueKit(q, ["أغرق"]);
  const { t } = k;
  const line = k.draw(0, "الماء", 0.9);
  const sink = k.on(0, "أغرق", 1.0);
  const full = k.draw(0, "كلها", 1.0);
  const stopT = k.at("توقف");
  const waveT = Math.min(t, stopT + 0.4);
  const amp = 10 * (1 - prog(t, stopT, stopT + 0.4));
  const boat = k.on(0, "الصغيرة", 0.6);
  const saved = bounce(t, k.at("نجت"), k.at("نجت") + 1.0);
  const down = k.on(0, "غرق", 1.0);
  const half = 0.55 + 0.45 * full;
  const cam = k.cam(NEUTRAL, [[0, "الصغيرة", { cx: 1500, cy: 420, s: 1.3 }, 1.0], [0, "غرق", { cx: 1450, cy: 440, s: 1.15 }, 1.0]]);
  const both = (
    <g>
      <Ink d="M1760 720 H160" p={1} w={3} c={C.inkSoft} />
      {HILLS.map((x, i) => <path key={i} d={`M${x - 70} 720 C${x - 40} 640 ${x + 40} 640 ${x + 70} 720`} fill="none" stroke={C.ink} strokeWidth={4} opacity={1 - 0.85 * sink} />)}
      <Waterline x1={960 + 800 * half} x2={960 - 800 * half} y={420} p={line} t={waveT} amp={amp} rows={3} fill={0.28} />
    </g>
  );
  return (
    <Leaf q={q} id="b8wh" cam={cam} L={both}
      R={<g>{both}
        {saved > 0 ? <circle cx={1500} cy={405} r={40} fill={C.gold} opacity={0.3 * saved} /> : null}
        <g opacity={boat} transform="translate(1500 418) scale(0.32)"><Boat /></g>
        {[[1440, 0], [1560, 0.3], [1410, 0.5], [1590, 0.2]].map(([x, d], i) => (
          <Dot key={i} x={x!} y={mix(400, 470, prog(down, d!, d! + 0.6))} q={1 - prog(down, d! + 0.4, d! + 0.8)} r={6} />
        ))}
      </g>} />
  );
});

// ─── c1-s17: العدسة والمعنى ───
const LensMiss = reverent((q) => {
  const k = cueKit(q, ["بالبحث"]);
  const { t } = k;
  const lens = k.on(0, "بالبحث", 0.6);
  const sweep = Math.sin(t * 1.4) * 0.5 + 0.5;
  const shard = k.on(0, "خشبة");
  const meaning = k.draw(0, "يفوته", 0.9);
  const link = k.draw(0, "حكيت", 1.0);
  const lx = mix(1180, 1520, sweep), ly = mix(640, 600, sweep);
  const cam = k.cam(NEUTRAL, [[0, "بالبحث", { cx: PX, cy: 560, s: 1.3 }, 1.0], [0, "يفوته", NEUTRAL, 1.2]]);
  return (
    <Leaf q={q} id="b8lm" cam={cam}
      L={<g>
        <Txt x={560} y={600} size={44} q={1} color={C.inkSoft} font="amiri">العبرة</Txt>
        <Write id="b8lm-m" x={560} y={380} size={76} p={meaning} label="المعنى" />
        <Ink d="M560 420 V555" p={link} w={3} c={GOLD_D} />
      </g>}
      R={<g>
        <Mount base={720} emerge={1} />
        <Shard x={1330} y={660} q={shard} s={0.6} />
        {lens > 0 ? <g opacity={lens} transform={`translate(${lx} ${ly}) scale(0.45)`}><Lens /></g> : null}
      </g>} />
  );
});

// ─── c1-s18: من المكان إلى ما بعده ───
const TurnAfter = reverent((q) => {
  const k = cueKit(q, ["فلننتقل"]);
  const { t } = k;
  const fold = k.on(0, "المكان", 1.2);
  const clear = k.on(0, "ماذا", 0.8);
  const line = k.draw(0, "حدث", 0.9);
  const step = k.on(0, "وقفت", 1.0);
  const cam = k.cam({ cx: 1100, cy: 520, s: 1.2 }, [[0, "فلننتقل", NEUTRAL, 1.4]]);
  const s = 1 - 0.65 * fold;
  return (
    <Leaf q={q} id="b8ta" cam={cam}
      L={<g>
        <Water y={mix(640, 700, step)} t={t} amp={4} />
        <g opacity={1 - clear}>
          <Txt x={560} y={440} size={44} q={1} color={C.inkSoft} font="amiri">المعنى</Txt>
          <Txt x={560} y={560} size={40} q={1} color={C.inkSoft} font="amiri">العبرة</Txt>
        </g>
        <Ink d="M800 420 H320" p={line} w={3} c={C.inkSoft} />
      </g>}
      R={<g>
        <Water y={mix(640, 700, step)} t={t} amp={4} />
        <g transform={`translate(${mix(0, 1640 - PX * 0.35 - 0 , fold)} ${mix(0, 180 - 480 * 0.35, fold)}) scale(${s})`}>
          <Mount base={640} emerge={1} />
          {SLOT_POS.map(([x, y], i) => <Seal key={i} x={x} y={y - 20} q={1} kind={SEALS[i]!} s={0.5} />)}
        </g>
      </g>} />
  );
});

/** أرض مبتلة: أفق وخطوط ماء رقيقة */
const WetGround: React.FC<{ y?: number; sky?: "morning" | "plain" | "rain" }> = ({ y = 560, sky = "rain" }) => (
  <g>
    <Horizon y={y} p={1} sky={sky} ground="#B8A27C" texture={0.4} />
    {[0, 1, 2, 3].map((i) => <path key={i} d={`M${1700 - i * 60} ${y + 60 + i * 70} H${220 + i * 50}`} stroke={WATER} strokeWidth={2} opacity={0.3} />)}
  </g>
);

// ─── c1-s21: الكلمتان على الأرض المبتلة ───
const TwoWords = reverent((q) => {
  const k = cueKit(q, ["كلمتين"]);
  const boxes = k.draw(0, "كلمتين", 0.9);
  const w1 = k.draw(0, "السلام", 0.9), w2 = k.draw(0, "والبركات", 0.9);
  const cam = k.cam(NEUTRAL, [[0, "السلام", { cx: 1365, cy: 470, s: 1.25 }, 0.9], [0, "والبركات", { cx: 560, cy: 470, s: 1.25 }, 0.9]]);
  const box = (x: number) => <Ink d={`M${x + 200} 400 H${x - 200} V540 H${x + 200} Z`} p={boxes} w={4} />;
  return (
    <Leaf q={q} id="b8w2" cam={cam}
      L={<g><WetGround />{box(560)}<Write id="b8w2-b" x={560} y={492} size={68} p={w2} label="البركات" /></g>}
      R={<g><WetGround />{box(PX)}<Write id="b8w2-s" x={PX} y={492} size={68} p={w1} label="السلام" /></g>} />
  );
});

// ─── c1-s22: الأرض والأمم الآتية ───
const BlessingReach = reverent((q) => {
  const k = cueKit(q, ["خراب"]);
  const broken = k.draw(0, "خراب", 0.8);
  const level = k.on(0, "فيها", 0.6);
  const salam = k.on(0, "سلام", 0.6);
  const baraka = k.on(0, "وبركات", 0.6);
  const dot = k.on(0, "نزل");
  const nations = k.span(0, "أمم", "ذريتهم", 1.0);
  const jag = (x1: number, x2: number) => {
    const r = rng(x1);
    let d = `M${x1} 660`;
    for (let x = x1; x >= x2; x -= 50) d += ` L${x} ${660 + (r() - 0.5) * 34 * (1 - level)}`;
    return d;
  };
  const cam = k.cam(NEUTRAL, [[0, "فيها", { cx: 1100, cy: 560, s: 1.15 }, 1.0], [0, "أمم", NEUTRAL, 1.2]]);
  const SLOPE = [1180, 650] as const;
  return (
    <Leaf q={q} id="b8br" cam={cam}
      L={<g>
        <Ink d={jag(960, 160)} p={broken} w={4} />
        {[0, 1, 2].map((i) => <path key={i} d={`M${SLOPE[0]} ${SLOPE[1]} Q${800 - i * 80} ${560 - i * 40} ${400 - i * 90} ${420 + i * 40}`} fill="none" stroke={C.ink} strokeWidth={3} strokeDasharray="8 10" opacity={prog(nations, i / 3, i / 3 + 0.4)} />)}
        <Txt x={560} y={mix(400, 620, baraka)} size={56} q={baraka} font="amiri">بركات</Txt>
      </g>}
      R={<g>
        <Peak x={1450} y={660} w={420} h={280} p={1} fill="#D4C4A2" />
        <Ink d={jag(1760, 960)} p={broken} w={4} />
        <Txt x={1250} y={mix(400, 620, salam)} size={56} q={salam} font="amiri">سلام</Txt>
        <Dot x={SLOPE[0]} y={SLOPE[1]} q={dot} r={9} />
        {[0, 1, 2].map((i) => <path key={i} d={`M${SLOPE[0]} ${SLOPE[1]} Q${1000} ${600 - i * 30} ${960} ${580 - i * 20}`} fill="none" stroke={C.ink} strokeWidth={3} strokeDasharray="8 10" opacity={prog(nations, i / 3, i / 3 + 0.4)} />)}
      </g>} />
  );
});

const LAND = [1150, 690] as const;
/** دائرة الموضع المبارك بضوء ناعم */
const BlessedCircle: React.FC<{ p: number; light: number }> = ({ p, light }) => (
  <g>
    {light > 0 ? <circle cx={LAND[0]} cy={LAND[1]} r={80 + 120 * light} fill={C.gold} opacity={0.22} /> : null}
    <Ring x={LAND[0]} y={LAND[1]} r={70} p={p} c={C.ink} w={4} />
    <Dot x={LAND[0]} y={LAND[1]} q={1} r={7} />
  </g>
);

// ─── c1-s25: قبل البيت والزرع ───
const BeforeHouse = reverent((q) => {
  const k = cueKit(q, ["المنزل"]);
  const circ = k.draw(0, "المنزل", 1.0) * 0.7 + 0.3 * k.draw(0, "المكان", 0.8);
  const l1 = k.on(0, "مباركا", 0.8) * 0.4;
  const l2 = k.on(0, "مباركا#2", 1.0) * 0.6;
  const house = k.on(0, "يبني", 0.8);
  const farm = k.on(0, "يزرع", 0.8);
  const cam = k.cam(NEUTRAL, [[0, "المنزل", { cx: 1150, cy: 620, s: 1.35 }, 1.0], [0, "يبني", { cx: 700, cy: 600, s: 1.1 }, 1.0], [0, "المكان", { cx: 1050, cy: 620, s: 1.2 }, 1.0]]);
  return (
    <Leaf q={q} id="b8bh" cam={cam}
      L={<g>
        <WetGround sky="morning" />
        <path d="M600 700 V610 L680 550 L760 610 V700 Z" fill="none" stroke={C.inkSoft} strokeWidth={4} strokeDasharray="10 9" opacity={house} />
        {[0, 1, 2, 3].map((i) => <path key={i} d={`M${300 + i * 40} 780 L${420 + i * 40} 700`} stroke={C.inkSoft} strokeWidth={3} strokeDasharray="8 8" opacity={farm} />)}
        <g opacity={0.4 * farm} transform="translate(360 740) scale(0.7)"><Wheat /></g>
      </g>}
      R={<g><WetGround sky="morning" /><Peak x={1500} y={690} w={420} h={280} p={1} fill="#D4C4A2" /><BlessedCircle p={circ} light={l1 + l2} /></g>} />
  );
});

// ─── c1-s26: دفتر الخسارة يُغلق ───
const Ledger = reverent((q) => {
  const k = cueKit(q, ["خريطة"]);
  const { t } = k;
  const map = k.on(0, "خريطة", 0.8);
  const step = k.on(0, "ينجو", 1.0);
  const col = k.span(0, "يحسب", "خسر", 0.8);
  const fold = k.on(0, "ليس", 0.9);
  const hamd = k.draw(0, "يحمد", 0.9);
  const light = k.draw(0, "البركة", 1.2);
  const cam = k.cam(NEUTRAL, [[0, "يحسب", { cx: 560, cy: 480, s: 1.2 }, 1.0], [0, "يحمد", { cx: 1250, cy: 480, s: 1.15 }, 1.0], [0, "البركة", NEUTRAL, 1.2]]);
  return (
    <Leaf q={q} id="b8lg" cam={cam}
      L={<g>
        <Water y={mix(780, 830, step)} t={t} amp={3} />
        <MiniMap x={mix(560, 300, map)} y={mix(400, 200, map)} q={map} s={0.8 - 0.3 * map} />
        <Sheet x={560} y={520} w={300 * (1 - 0.7 * fold)} h={360} q={col > 0 ? 1 - 0.8 * fold : 0}>
          <Scribble x={120 * (1 - 0.7 * fold)} y={-140} w={220 * (1 - 0.7 * fold)} n={8} p={col} gap={38} seed={7} c={C.inkSoft} o={0.7} />
        </Sheet>
      </g>}
      R={<g>
        <Water y={mix(780, 830, step)} t={t} amp={3} />
        <Peak x={1500} y={690} w={420} h={280} p={1} fill="#D4C4A2" />
        <BlessedCircle p={1} light={light} />
        <Write id="b8lg-h" x={1250} y={420} size={70} p={hamd} label="يحمد" />
      </g>} />
  );
});

// ─── c1-s27: أول صباح ───
const FirstMorning = reverent((q) => {
  const k = cueKit(q, ["جديد"]);
  const { t } = k;
  const dawn = k.on(0, "جديد", 1.6);
  const wet = k.on(0, "مبتلة", 0.8);
  const last = k.draw(0, "ينحسر", 1.4);
  const few = k.draw(0, "وقلة", 0.9);
  const grass = k.on(0, "لتبدأ", 0.8);
  const cam = k.cam(NEUTRAL, [[0, "جديد", { cx: 1100, cy: 480, s: 1.1 }, 1.6], [0, "لتبدأ", { cx: 1200, cy: 620, s: 1.3 }, 1.0]]);
  const both = (
    <g>
      <Horizon y={600} p={1} sky="morning" skyO={0.3 + 0.7 * dawn} ground="#BFA780" texture={0.5} />
      <g opacity={wet}><Hatch x={160} y={610} w={1600} h={140} o={0.6} /></g>
      <Waterline y={mix(640, 760, last)} p={1 - prog(last, 0.85, 1)} t={t} amp={3} rows={2} fill={0.18} />
    </g>
  );
  return (
    <Leaf q={q} id="b8fm" cam={cam}
      L={<g>{both}<Write id="b8fm-q" x={560} y={420} size={46} p={few} label="قلّة قليلة" font="tajawal" color={C.inkSoft} /></g>}
      R={<g>
        <Sun x={1600} y={mix(640, 470, dawn)} r={40} q={dawn} c={C.sand} line={600} />
        {both}
        <Peak x={1350} y={600} w={400} h={260} p={1} fill="#D4C4A2" />
        <Grass x={1180} y={610} q={grass} t={t} wind={0.2} n={6} spread={60} h={40} />
      </g>} />
  );
});

// ─── c1-s28: العقدة التاسعة الفارغة ───
const Handoff = reverent((q) => {
  const k = cueKit(q, ["انتشر"]);
  const branch = k.draw(0, "انتشر", 1.2);
  const qm = k.on(0, "الأمم");
  const ext = k.draw(0, "الخيط", 1.2);
  const k9 = k.on(0, "القادمة", 0.7);
  const rib = k.on(0, "البدايات", 0.7);
  const cam = k.cam(NEUTRAL, [[0, "الخيط", { cx: 960, cy: 700, s: 1.15 }, 1.2], [0, "البدايات", { cx: 520, cy: 520, s: 1.15 }, 1.0]]);
  const ORIG = [1150, 560] as const;
  const paths = (
    <g>
      {[0, 1, 2].map((i) => <path key={i} d={`M${ORIG[0]} ${ORIG[1]} Q${900 - i * 80} ${480 - i * 30} ${520 - i * 110} ${380 + i * 40}`} fill="none" stroke={C.ink} strokeWidth={3} strokeDasharray="8 10" opacity={0.8} />)}
      {[0, 1, 2, 3].map((i) => <Ink key={i} d={`M${700 - i * 60} ${440 + i * 10} L${560 - i * 90} ${320 + i * 40}`} p={prog(branch, i / 4, i / 4 + 0.4)} w={2.5} c={C.inkSoft} />)}
    </g>
  );
  const thread = (
    <Thread x1={1760} x2={160} y={800} p={mix(0.45, 1, ext)} knots={[
      { x: 1650, kind: "tied", q: 1 },
      { x: 1350, kind: "stone", q: 1 },
      { x: 600, kind: "ring", q: k9, tie: 0, mark: k9 },
    ]} />
  );
  return (
    <Leaf q={q} id="b8ho" cam={cam}
      L={<g>
        <Horizon y={560} p={1} sky="morning" texture={0.4} />
        {paths}
        <Q x={600} y={290} size={90} q={qm} />
        {thread}
        <DateRibbon x={300} y={170} s={1} o={rib} />
        <Txt x={300} y={150} size={34} q={rib} color={C.ribbon}>البدايات</Txt>
      </g>}
      R={<g><Horizon y={560} p={1} sky="morning" texture={0.4} /><Peak x={1400} y={560} w={420} h={260} p={1} fill="#D4C4A2" /><Dot x={ORIG[0]} y={ORIG[1]} q={1} r={8} />{paths}{thread}</g>} />
  );
});

// ─── c1-s29: العقدة الحجرية والأختام الأربعة ───
const KS = 1150;
const ROW = [1600, 1380, 760, 520];
const KnotSeals = reverent((q) => {
  const k = cueKit(q, ["نعقد"]);
  const { t } = k;
  const glow = bounce(t, k.at("حجر"), k.at("حجر") + 1.2);
  const seals = [k.on(0, "ثابت", 0.5), k.on(0, "تقدير", 0.5), k.on(0, "رواية", 0.5), k.on(0, "نعلم", 0.5)];
  const pull = k.on(0, "البقايا", 0.8);
  const ask = k.draw(0, "نعقد", 0.9);
  const cam = k.cam({ cx: KS, cy: 520, s: 1.5 }, [[0, "نعقد", { cx: KS, cy: 520, s: 1.75 }, 1.0], [0, "ثابت", { cx: 1300, cy: 560, s: 1.15 }, 1.0], [0, "رواية", { cx: 800, cy: 560, s: 1.1 }, 1.0], [0, "البقايا", NEUTRAL, 1.2]]);
  const both = (
    <g>
      <Thread x1={1760} x2={160} y={520} p={1} sag={8 * (1 - pull)} knots={[{ x: KS, kind: "stone", q: 1, glow }]} />
      <Ring x={KS} y={520} r={48} p={ask} c={C.ribbon} w={3} dash={ask >= 1} />
      {ROW.map((x, i) => (
        <g key={i}>
          <Ink d={`M${x} 528 V610`} p={pull} w={2.5} c={C.ribbon} />
          <Seal x={x} y={660} q={seals[i]!} kind={SEALS[i]!} s={0.55} />
        </g>
      ))}
    </g>
  );
  return <Leaf q={q} id="b8ks" cam={cam} L={both} R={both} />;
});

// ─── c1-s30: الختام في ضوء الصباح ───
const ClosingMorning = reverent((q) => {
  const k = cueKit(q, ["وبجوارها"]);
  const { t } = k;
  const w1 = k.on(0, "سلام"), w2 = k.on(0, "وبركات");
  const back = k.on(0, "وأنت", 1.4);
  const recede = k.draw(0, "أزمة", 1.4);
  const line = k.draw(0, "اكتبه", 0.9);
  const cam = k.cam({ cx: 1400, cy: 480, s: 1.6 }, [[0, "وأنت", NEUTRAL, 1.6]]);
  return (
    <Leaf q={q} id="b8cm" cam={cam}
      L={<g>
        <g opacity={back}>
          <Horizon y={420} p={1} sky="morning" texture={0.2} />
          <Peak x={560} y={420} w={220} h={130} p={1} fill="#D4C4A2" />
        </g>
        <Waterline x1={420} x2={170} y={mix(700, 780, recede)} p={1 - prog(recede, 0.7, 1)} t={t} amp={3} rows={2} fill={0.15} />
        <BlankLine x={560} y={640} w={440} p={line} pen={line} touch={prog(line, 0.8, 1)} />
      </g>}
      R={<g>
        <Thread x1={1760} x2={960} y={480} p={1} knots={[{ x: 1400, kind: "stone", q: 1 }]} />
        <Txt x={1560} y={400} size={50} q={w1} font="amiri">سلام</Txt>
        <Txt x={1250} y={400} size={50} q={w2} font="amiri">بركات</Txt>
        <Seal x={1400} y={600} q={1} kind="ثابت" s={0.45} dim={0.8} />
      </g>} />
  );
});

export const BD08_SCENES: Record<string, React.FC<BdProps>> = {
  "bd08-peak": PeakShot,
  "bd08-thread-water": ThreadWater,
  "bd08-stone-knot": StoneKnot,
  "bd08-blank-fields": BlankFields,
  "bd08-seal-mount": SealMount,
  "bd08-tafsir-sketch": TafsirSketch,
  "bd08-folded-leaf": FoldedLeaf,
  "bd08-wood-shard": WoodShard,
  "bd08-pale-margin": PaleMargin,
  "bd08-symbol-copies": SymbolCopies,
  "bd08-no-foundation": NoFoundation,
  "bd08-crosshair": Crosshair,
  "bd08-water-halt": WaterHalt,
  "bd08-lens-miss": LensMiss,
  "bd08-turn-after": TurnAfter,
  "bd08-two-words": TwoWords,
  "bd08-blessing-reach": BlessingReach,
  "bd08-before-house": BeforeHouse,
  "bd08-ledger": Ledger,
  "bd08-first-morning": FirstMorning,
  "bd08-handoff": Handoff,
  "bd08-knot-seals": KnotSeals,
  "bd08-closing-morning": ClosingMorning,
};

/** مشهد الصورة الثابتة للمراجعة لكل لقطة (المعرّف في الخطة)؛ الغائب = آخر مشهد يستعمل اللقطة، عند نهاية آخر كلمة */
export const BD08_STILLS: Record<string, string> = { "bd08-seal-mount": "c1-s14" };
