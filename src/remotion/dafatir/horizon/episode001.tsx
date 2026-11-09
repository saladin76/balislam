/**
 * مشاهد «خط الأفق» للحلقة 001 (الفصلان 1 و2 — الدفعة البصرية الأولى) — `production-plan.md`.
 * كل حدث مربوط بكلمته (at/end) في توقيت الجملة، فيُستبدل التوقيت التقديري بتوقيت صوت الراوي دون إعادة تصميم.
 * لا يبدأ عنصر ولا تتحرك الكاميرا عند ذكر الله وما في معناه. ولا يُصوَّر غيب: الملائكة والخلق تُكتب كلامًا لا رسمًا.
 */
import React from "react";
import { at, end, type Timeline } from "./timeline";
import { C, CoverLeaf, Dusk, FlipLeaf, Ink, W, Words, easeOut, mix, prog, rng } from "./kit";
import { BlankBookOver, Book, ChapterHead, DateRibbon, EXIT_BEAT, NEUTRAL, SceneCloseContext, Pin, QuranSeal, SText, WriteIn, camPath, fonts, type Cam, type Exit } from "./book";
import { Shot2, Shot4, Shot5, Shot6 } from "./shots";
import { GATE, GLYPHS, Hatch, RUINS, Sunset } from "../lib/drawings";
import { HZ_META } from "./meta";
import { HZ_SCENES_B } from "./episode001b";
import { VerseRefPanel } from "./verseRef";
import { HZ_SCENES_C } from "./episode001c";
import { HZ_SCENES_D } from "./episode001d";
import { LIB_SCENES } from "../lib/scenes";

export type HzProps = { t: number; tl: Timeline; dur: number; exit: Exit; from?: Cam; p: Record<string, string | undefined> };
const { Amiri, Tajawal } = fonts;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** البسملة كما ينطقها الراوي، على الصفحة الأولى، تحتها خط ذهبي */
const Basmala: React.FC = () => (
  <g>
    <SText x={1365} y={505} size={92} color={C.inkText}>
      بسم الله الرحمن الرحيم
    </SText>
    <path d="M1200 575 H1530" stroke={C.gold} strokeWidth={3} strokeLinecap="round" />
    <circle cx={1365} cy={575} r={6} fill={C.gold} />
  </g>
);

// ─────────── c1-s0: الدفتر المغلق يُفتح، وعلى صفحته الأولى البسملة ───────────
const Cover: React.FC<HzProps> = ({ t, dur, exit }) => {
  const cover = prog(t, 0.3, 1.5);
  const cam = camPath(t, { cx: 1370, cy: 520, s: 1.06 }, [{ a: 0.45, b: 2.1, ...NEUTRAL }]);
  return <Book id="cv" t={t} dur={dur} exit={exit} cam={cam} R={<Basmala />} top={<CoverLeaf p={cover} />} noLeft={cover < 1} light={prog(t, 0.45, 1.65)} />;
};

// ─────────── c1-s1: البسملة ساكنة ───────────
const BasmalaScene: React.FC<HzProps> = ({ t, dur, exit }) => <Book id="bs" t={t} dur={dur} exit={exit} cam={NEUTRAL} R={<Basmala />} />;

// ─────────── c1-s2: أمم كثيرة وأجيال تتعاقب على الأفق ───────────
// الماضي على اليمين (اتجاه الخط العربي): كل أمة تظهر على يسار الأفق ثم تمضي نحو اليمين وتبهت، وتأتي بعدها أخرى.
const N_GLYPH = 16;
const SP = 112;
const Nations: React.FC<HzProps> = ({ t, tl, dur, exit }) => {
  const hzR = prog(t, at(tl, "عرفت") - 0.1, at(tl, "الأرض") + 0.2);
  const hzL = prog(t, at(tl, "الأرض"), at(tl, "أمما") + 0.1);
  // مقدار ما مضى من الزمن على الأفق: يتقدم مع الكلمات ويقف قبل ذكر الله
  const anchors: [number, number][] = [
    [at(tl, "أمما") - 0.1, 0],
    [end(tl, "كثيرة") + 0.1, 5.2 * SP],
    [at(tl, "وتعاقبت"), 5.6 * SP],
    [end(tl, "أجيال"), 10 * SP],
    [end(tl, "عددها"), 14.5 * SP],
  ];
  let S = 0;
  for (let i = 1; i < anchors.length; i++) {
    const [a0, v0] = anchors[i - 1]!;
    const [a1, v1] = anchors[i]!;
    if (t >= a0) S = mix(v0, v1, prog(t, a0, a1, (x) => x * x * (3 - 2 * x)));
  }
  const r = rng(5);
  const heights = Array.from({ length: N_GLYPH }, () => 0.85 + r() * 0.35);
  const row = (
    <g>
      {Array.from({ length: N_GLYPH }, (_, i) => {
        const age = S - i * SP;
        if (age <= 0) return null;
        const x = 250 + age;
        if (x > 1760) return null;
        const old = clamp01((x - 250) / 1480);
        const draw = clamp01(age / (0.8 * SP));
        const sc = (1.8 - 0.75 * old) * heights[i]!;
        return (
          <g key={i} transform={`translate(${x} 640) scale(${sc})`} opacity={(1 - 0.8 * old) * (x > 1690 ? 1 - (x - 1690) / 70 : 1)}>
            <Ink d={GLYPHS[i % GLYPHS.length]!} w={3 / sc} p={draw} fill="#E8D6B3" fillP={draw} />
          </g>
        );
      })}
    </g>
  );
  const sky = (
    <g opacity={0.8 * hzR}>
      <defs>
        <linearGradient id="nt-sky" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={C.ember} stopOpacity={0.22} />
          <stop offset="1" stopColor={C.ember} stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={140} y={330} width={1660} height={310} fill="url(#nt-sky)" />
      <rect x={140} y={640} width={1660} height={300} fill="#D9C29A" opacity={0.35} />
    </g>
  );
  const cam = camPath(t, NEUTRAL, [
    { a: at(tl, "أمما") - 0.3, b: end(tl, "كثيرة"), cx: 720, cy: 560, s: 1.12 },
    { a: at(tl, "وتعاقبت") - 0.1, b: end(tl, "أجيال"), cx: 1120, cy: 560, s: 1.06 },
    { a: at(tl, "يعلم") - 0.2, b: at(tl, "إلا") - 0.3, ...NEUTRAL },
  ]);
  return (
    <Book
      id="nt"
      t={t}
      dur={dur}
      exit={exit}
      cam={cam}
      R={
        <g>
          {sky}
          <Ink d="M1740 640 C1500 636 1200 644 960 640" w={4} p={hzR} />
          {row}
        </g>
      }
      L={
        <g>
          {sky}
          <Ink d="M960 640 C720 636 420 644 180 640" w={4} p={hzL} />
          {row}
        </g>
      }
    />
  );
};

// ─────────── c1-s3: لا من مدينة قديمة، ولا من مملكة نُسي اسمها… بل من آدم عليه السلام ───────────
const ReturnScene: React.FC<HzProps> = ({ t, tl, dur, exit, from }) => {
  const d0 = at(tl, "تبدأ");
  const d1 = end(tl, "قديمة");
  const step = (d1 - 0.5 - d0) / (RUINS.length - 1);
  const f1 = end(tl, "قديمة") + 0.05;
  const f2 = end(tl, "اسمها") + 0.1;
  const flip1 = prog(t, f1, f1 + 1.1);
  const flip2 = prog(t, f2, f2 + 1.15);
  const forget = prog(t, at(tl, "نسي"), end(tl, "اسمها"));
  const horizon = prog(t, at(tl, "إننا"), at(tl, "آدم") - 0.25, easeOut);
  const wash = prog(t, at(tl, "رحلتنا"), d0 + 0.6);
  const ruins = (
    <g>
      <Sunset y={700} o={wash} />
      <g transform="translate(1368 700) scale(1.15) translate(-1368 -700)">
        {RUINS.map((d, i) => (
          <Ink key={i} d={d} w={4} p={prog(t, d0 + i * step, d0 + i * step + 0.5)} />
        ))}
        <Hatch x={1124} y={510} w={34} h={186} o={prog(t, d1 - 0.2, d1 + 0.3)} />
        <Hatch x={1503} y={466} w={34} h={230} o={prog(t, d1 - 0.1, d1 + 0.4)} />
      </g>
    </g>
  );
  const gate = (o: number) => (
    <g opacity={o}>
      <Sunset y={722} o={1} />
      <g transform="translate(1360 722) scale(1.08) translate(-1360 -722)">
        {GATE.map((d, i) => (
          <Ink key={i} d={d} w={4} p={1} />
        ))}
        <Hatch x={1124} y={384} w={50} h={334} o={1} />
        <Hatch x={1484} y={384} w={50} h={334} o={1} />
        <path d="M1304 722 V604 C1304 526 1416 526 1416 604 V722 Z" fill={C.ink} opacity={0.14} />
      </g>
    </g>
  );
  const finalPage = (
    <g>
      <Sunset y={640} o={horizon * 0.8} />
      <Ink d="M1720 640 C1500 636 1220 642 1010 638" w={4} p={horizon} />
    </g>
  );
  const under = t < f1 ? ruins : t < f2 ? gate(1 - 0.72 * forget) : finalPage;
  const cam = camPath(t, NEUTRAL, [
    { a: at(tl, "رحلتنا"), b: d1, cx: 1330, cy: 540, s: 1.12 },
    { a: at(tl, "إننا") - 0.2, b: tl.end + 0.6, cx: 1250, cy: 520, s: 1.1 },
  ]);
  return (
    <Book
      id="rt"
      t={t}
      dur={dur}
      exit={exit}
      from={from}
      cam={cam}
      tintL={`rgba(200,161,90,${0.04 * (flip1 >= 1 ? 1 : 0) + 0.04 * (flip2 >= 1 ? 1 : 0)})`}
      R={under}
      top={
        <g>
          <FlipLeaf id="rt" p={flip1} front={ruins} />
          <FlipLeaf id="rt" p={flip2} front={gate(1 - 0.72 * forget)} />
        </g>
      }
      htmlR={
        <Words
          now={t}
          dur={0.5}
          items={[{ w: "آدم", t: at(tl, "آدم") }, { w: "عليه", t: at(tl, "عليه") }, { w: "السلام", t: at(tl, "السلام") }]}
          style={{ right: W - 1700, top: 486, width: 660, textAlign: "center", fontFamily: Amiri, fontWeight: 700, fontSize: 104, lineHeight: 1.25, color: C.ink }}
        />
      }
    />
  );
};

// ─────────── c1-s4: ومنه بدأ نسل البشر الذي انتشر في الأرض ───────────
const GEN = [
  { y: 300, c: 1370, h: 0 },
  { y: 385, c: 1290, h: 150 },
  { y: 470, c: 1200, h: 330 },
  { y: 555, c: 1080, h: 560 },
  { y: 640, c: 960, h: 770 },
];
const nodeX = (k: number, j: number) => {
  const g = GEN[k]!;
  const n = 2 ** k;
  return n === 1 ? g.c : g.c - g.h + (j * 2 * g.h) / (n - 1);
};
const Lineage: React.FC<HzProps> = ({ t, tl, dur, exit, from }) => {
  const mv = prog(t, at(tl, "أول") - 0.1, at(tl, "إنسان") + 0.5);
  const root = prog(t, at(tl, "إنسان"), at(tl, "إنسان") + 0.45, easeOut);
  const genAt = [0, at(tl, "ومنه"), at(tl, "بدأ"), at(tl, "نسل"), at(tl, "البشر")];
  const spread = prog(t, at(tl, "انتشر") - 0.1, at(tl, "انتشر") + 1.1, easeOut);
  const ground = prog(t, at(tl, "الأرض") - 0.1, at(tl, "الأرض") + 0.8);
  const tree = (
    <g>
      <rect x={140} y={640} width={1660} height={300} fill="#D9C29A" opacity={0.4 * ground} />
      <circle cx={1370} cy={300} r={15 * root} fill={C.ink} />
      {[1, 2, 3, 4].map((k) => {
        const p = prog(t, genAt[k]!, genAt[k]! + 0.6, easeOut);
        return Array.from({ length: 2 ** k }, (_, j) => {
          const px = nodeX(k - 1, Math.floor(j / 2));
          const py = GEN[k - 1]!.y;
          const x = nodeX(k, j);
          const y = GEN[k]!.y;
          const fade = k < 4 ? 1 - 0.35 * spread : 1;
          return (
            <g key={`${k}-${j}`} opacity={fade}>
              <Ink d={`M${px} ${py + 10} C${px} ${py + 45} ${x} ${y - 45} ${x} ${y - 9}`} w={k < 3 ? 3.5 : 2.5} p={p} />
              <circle cx={x} cy={y} r={(k < 4 ? 9 - k : 6) * prog(t, genAt[k]! + 0.4, genAt[k]! + 0.7, easeOut)} fill={C.ink} />
            </g>
          );
        });
      })}
      {/* «انتشر»: من كل فرع أخير يمضي أثر على الأفق إلى الجانبين */}
      {Array.from({ length: 16 }, (_, j) => {
        const x = nodeX(4, j);
        return [-1, 1].map((sd) => {
          const dx = sd * (26 + (j % 3) * 10) * spread;
          return <circle key={`${j}${sd}`} cx={x + dx} cy={640} r={4.5 * spread} fill={C.ink} opacity={0.75} />;
        });
      })}
    </g>
  );
  const cam = camPath(t, { cx: 1250, cy: 520, s: 1.1 }, [
    { a: at(tl, "ومنه") + 0.05, b: at(tl, "نسل") + 0.4, cx: 1160, cy: 480, s: 1.02 },
    { a: at(tl, "انتشر") - 0.2, b: end(tl, "الأرض") + 0.4, ...NEUTRAL },
  ]);
  const top = mix(486, 168, mv);
  return (
    <Book
      id="ln"
      t={t}
      dur={dur}
      exit={exit}
      from={from}
      cam={cam}
      R={
        <g>
          <Sunset y={640} o={0.8 * (1 - 0.6 * ground)} />
          <Ink d="M1720 640 C1500 636 1220 642 1010 638" w={4} p={1} />
          <Ink d="M1010 638 C990 639 975 640 960 640" w={4} p={spread} />
          {tree}
        </g>
      }
      L={
        <g>
          <Ink d="M960 640 C720 636 420 644 180 640" w={4} p={spread} />
          {tree}
        </g>
      }
      htmlR={
        <div style={{ position: "absolute", right: W - 1700, top, width: 660, textAlign: "center", fontFamily: Amiri, fontWeight: 700, fontSize: 104, lineHeight: 1.25, color: C.ink, direction: "rtl", transform: `scale(${mix(1, 0.62, mv)})`, transformOrigin: "50% 0" }}>آدم عليه السلام</div>
      }
    />
  );
};

// ─────────── c1-s6: ما هو أعظم من تحديد سنة أو مكان ───────────
const FRAME_O = "M1690 170 H1040 V870 H1690 Z";
const FRAME_I = "M1676 184 H1054 V856 H1676 Z";
const marginNotes = (ribbon: number, pin: number) => (
  <g>
    <g transform={`translate(0 ${(1 - ribbon) * -40})`}>
      <DateRibbon x={300} y={120} s={0.42} o={ribbon} />
    </g>
    <SText x={300} y={248} size={30} font="tajawal" weight={500} color={C.inkSoft} o={ribbon}>
      سنة
    </SText>
    <Pin x={430} y={210} s={0.75} o={pin} />
    <SText x={430} y={248} size={30} font="tajawal" weight={500} color={C.inkSoft} o={pin}>
      مكان
    </SText>
  </g>
);
const GreaterFrame: React.FC<{ p: number }> = ({ p }) => (
  <g>
    <Ink d={FRAME_O} w={4} p={p} c={C.gold} />
    <Ink d={FRAME_I} w={1.8} p={prog(p, 0.25, 1)} c={C.gold} />
  </g>
);
const Greater: React.FC<HzProps> = ({ t, tl, dur, exit }) => {
  const frame = prog(t, at(tl, "أعظم") - 0.1, at(tl, "أعظم") + 1.1);
  const ribbon = prog(t, at(tl, "سنة") - 0.05, at(tl, "سنة") + 0.45, easeOut);
  const pin = prog(t, at(tl, "مكان") - 0.05, at(tl, "مكان") + 0.45, easeOut);
  const cam = camPath(t, NEUTRAL, [
    { a: at(tl, "أعظم") - 0.25, b: at(tl, "أعظم") + 0.9, cx: 1320, cy: 520, s: 1.08 },
    { a: at(tl, "تحديد") - 0.2, b: at(tl, "سنة") + 0.3, cx: 820, cy: 460, s: 1.1 },
    { a: end(tl, "مكان") + 0.1, b: end(tl, "مكان") + 1.0, ...NEUTRAL },
  ]);
  return <Book id="gr" t={t} dur={dur} exit={exit} cam={cam} R={<GreaterFrame p={frame} />} L={marginNotes(ribbon, pin)} />;
};

// ─────────── c1-s7: فهرس ما أخبرنا به ───────────
const ENTRIES = [
  { w: "خلق", txt: "خلق آدم", n: "٣" },
  { w: "وتكريمه", txt: "تكريمه", n: "٤" },
  { w: "وتعليمه", txt: "تعليمه", n: "٣" },
  { w: "أمر", txt: "أمر الملائكة بالسجود", n: "٤" },
  { w: "عداوة", txt: "عداوة إبليس", n: "٤" },
  { w: "عما", txt: "ما جرى لآدم وزوجه", n: "٥" },
  { w: "وهبوطهما", txt: "هبوطهما إلى الأرض", n: "٦" },
];
const ENTRY_Y = (i: number) => 312 + i * 78;
const IndexList: React.FC<{ t: number; times: number[]; head: number; glow?: number }> = ({ t, times, head, glow = -1 }) => (
  <g>
    <SText x={1365} y={240} size={34} font="tajawal" weight={700} color={C.inkSoft} o={head}>
      ما أخبرنا به
    </SText>
    <Ink d="M1520 262 H1210" w={2.5} p={head} c={C.gold} />
    {ENTRIES.map((e, i) => {
      const a = times[i]!;
      const txt = prog(t, a - 0.05, a + 0.4, easeOut);
      const lead = prog(t, a + 0.25, a + 0.85);
      const y = ENTRY_Y(i);
      const x0 = 1630 - e.txt.length * 20.5 - 22;
      const lit = glow >= 0 ? prog(t, glow + i * 0.08, glow + i * 0.08 + 0.3) * (1 - prog(t, glow + 0.9 + i * 0.08, glow + 1.4 + i * 0.08)) : 0;
      return (
        <g key={i}>
          <g transform={`translate(${(1 - txt) * 18} 0)`}>
            <SText x={1630} y={y} size={40} font="tajawal" weight={500} anchor="start" o={txt}>
              {e.txt}
            </SText>
          </g>
          {lead > 0 ? <line x1={x0} x2={mix(x0, 1135, lead)} y1={y - 11} y2={y - 11} stroke={C.inkSoft} strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" /> : null}
          <circle cx={1103} cy={y - 13} r={26} fill={C.gold} opacity={0.35 * lit} />
          <SText x={1103} y={y} size={42} o={prog(t, a + 0.7, a + 1.0)} color={C.ink}>
            {e.n}
          </SText>
        </g>
      );
    })}
  </g>
);
const indexTimes = (tl: Timeline) => ENTRIES.map((e) => at(tl, e.w));
const IndexScene: React.FC<HzProps> = ({ t, tl, dur, exit }) => {
  const times = indexTimes(tl);
  // الكاميرا تتبع السطر الجديد، ولا تنزل تحت cy 660: عند s=1.14 يُرى y من cy−474، فيبقى العنوان «ما أخبرنا به» (من y≈208)
  // والسطر الأخير (حتى y≈795) معًا في الكادر (كان الحد 740 فيُقص العنوان من أعلى نحو ثانيتين)
  const keys = times.map((a, i) => ({ a: a - 0.3, b: a + 0.5, cx: 1370, cy: Math.min(660, Math.max(400, ENTRY_Y(i))), s: 1.14 }));
  const cam = camPath(t, NEUTRAL, [...keys, { a: tl.end + 0.05, b: tl.end + 0.9, ...NEUTRAL }]);
  return <Book id="ix" t={t} dur={dur} exit={exit} cam={cam} R={<g><GreaterFrame p={1} /><IndexList t={t} times={times} head={prog(t, at(tl, "أخبرنا") - 0.05, at(tl, "أخبرنا") + 0.45)} /></g>} L={marginNotes(1, 1)} />;
};

// ─────────── c1-s8: ومن هذه الأخبار نبدأ قصتنا (قلب الصفحة) ───────────
const Begin: React.FC<HzProps> = ({ t, tl, dur, exit }) => {
  const done = ENTRIES.map(() => -10);
  const sweep = prog(t, at(tl, "الأخبار") - 0.05, at(tl, "الأخبار") + 0.6);
  return (
    <Book
      id="bg"
      t={t}
      dur={dur}
      exit={exit}
      turnAt={at(tl, "نبدأ")}
      cam={NEUTRAL}
      R={
        <g>
          <GreaterFrame p={1} />
          <IndexList t={t} times={done} head={1} glow={at(tl, "الأخبار")} />
          <Ink d="M1640 828 H1090" w={4} p={sweep} c={C.gold} />
        </g>
      }
      L={marginNotes(1, 1)}
    />
  );
};

// ─────────── c2-s3: سؤال لطلب الفهم، لا اعتراض (حاشية ابن كثير على البقرة 30) ───────────
const Question: React.FC<HzProps> = ({ t, tl, dur, exit, from, p }) => {
  const q = prog(t, at(tl, "وسألت") - 0.05, at(tl, "وسألت") + 0.45, easeOut);
  const head = prog(t, end(tl, "وسألت") - 0.05, end(tl, "وسألت") + 0.25);
  const fasad = prog(t, at(tl, "الفساد") - 0.05, at(tl, "الفساد") + 0.45, easeOut);
  const safk = prog(t, at(tl, "وسفك") - 0.05, at(tl, "وسفك") + 0.45, easeOut);
  const card = prog(t, at(tl, "سؤالهم") - 0.15, at(tl, "سؤالهم") + 0.6, easeOut);
  const i3 = prog(t, at(tl, "اعتراضا") - 0.05, at(tl, "اعتراضا") + 0.4, easeOut);
  const strike = prog(t, at(tl, "اعتراضا") + 0.4, at(tl, "حكم") - 0.05);
  const ring = prog(t, end(tl, "الفهم"), end(tl, "الفهم") + 0.6);
  const under = prog(t, at(tl, "الحكمة"), end(tl, "الحكمة") + 0.3);
  const cam = camPath(t, NEUTRAL, [
    { a: at(tl, "وسألت") - 0.2, b: at(tl, "وسألت") + 0.55, cx: 1365, cy: 520, s: 1.1 },
    // لقطة أقرب على ما سألوا عنه، ثم إلى الحاشية
    // يبدأ الاقتراب مع «عن جعل من يكون منه» (موضوع السؤال) لا بعده
    { a: at(tl, "جعل") - 0.1, b: at(tl, "وسفك") + 0.3, cx: 1360, cy: 640, s: 1.3 },
    { a: at(tl, "يسبحون") - 0.6, b: at(tl, "يسبحون") - 0.26, cx: 1365, cy: 520, s: 1.1 },
    // الحاشية (x 250–870) والسؤال (x 1140–1560) معًا في الكادر: الجواب بجوار ما يجيب عنه، ولا يبقى «سؤال/سفك الدماء» مقصوصًا
    // عند الحافة (كان cx 600 ثم 560 فيُقص نحو خمس ثوانٍ؛ مراجعة المشاهد ٩ نوفمبر)
    { a: at(tl, "سؤالهم") - 0.3, b: at(tl, "سؤالهم") + 0.9, cx: 905, cy: 500, s: 1.12 },
    // «وإنما كان سؤالًا لطلب الفهم ومعرفة الحكمة»: الكادر يقترب وسطرا الجواب يُكتبان، والسؤال ورأس الفصل باقيان كاملين (s=1.24 يُرى x 186–1734)
    { a: at(tl, "سؤالا") - 0.2, b: end(tl, "الحكمة"), cx: 960, cy: 480, s: 1.24 },
  ]);
  const R = (
    <g>
      <ChapterHead label={p.head ?? ""} />
      <g transform={`translate(1365 430) scale(${0.85 + 0.15 * q}) translate(-1365 -430)`}>
        <SText x={1365} y={500} size={300} o={q} color={C.ink}>
          ؟
        </SText>
      </g>
      <SText x={1365} y={590} size={48} font="tajawal" o={head} color={C.inkText}>
        سؤال
      </SText>
      <Ink d="M1560 640 V626 H1170 V640" w={2.5} p={Math.max(fasad, safk)} c={C.inkSoft} />
      <SText x={1470} y={705} size={40} font="tajawal" weight={500} o={fasad} color={C.inkSoft}>
        الفساد
      </SText>
      <SText x={1250} y={705} size={40} font="tajawal" weight={500} o={safk} color={C.inkSoft}>
        سفك الدماء
      </SText>
    </g>
  );
  const row = (top: number): React.CSSProperties => ({ right: 34, top, fontFamily: Tajawal, fontWeight: 500, fontSize: 50, lineHeight: 1.4, color: C.inkText });
  const htmlL = (
    <div style={{ position: "absolute", left: 250, top: 250, width: 620, height: 470, background: "#FFFAF0", border: "3px solid rgba(74,46,31,0.6)", borderRadius: 8, boxShadow: "0 16px 32px rgba(43,30,20,0.25)", opacity: card, transform: `translate(${(1 - card) * -40}px, 0) rotate(${-1.2 + 1.2 * card}deg)`, direction: "rtl" }}>
      <div style={{ position: "absolute", right: 24, top: -42, padding: "4px 18px 8px", background: C.ribbon, color: C.page, fontFamily: Tajawal, fontWeight: 700, fontSize: 28, borderRadius: "6px 6px 0 0" }}>حاشية</div>
      <div style={{ position: "absolute", ...row(34), opacity: i3 }}>
        <span style={{ position: "relative", display: "inline-block" }}>
          اعتراضا
          <span style={{ position: "absolute", right: 0, top: "54%", height: 5, width: `${strike * 100}%`, background: C.ribbon, borderRadius: 3 }} />
        </span>
      </div>
      <Words now={t} items={[{ w: "سؤالا", t: at(tl, "سؤالا") }, { w: "لطلب", t: at(tl, "لطلب") }, { w: "الفهم", t: at(tl, "الفهم") }]} style={row(150)} />
      <svg width={620} height={470} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <Ink d="M614 196 C616 158 500 144 390 146 C270 148 164 168 164 200 C164 236 280 252 390 252 C500 252 612 236 614 196" w={4} p={ring} c={C.ribbon} />
      </svg>
      <Words now={t} items={[{ w: "ومعرفة", t: at(tl, "ومعرفة") }, { w: "الحكمة", t: at(tl, "الحكمة") }]} style={row(262)} />
      <div style={{ position: "absolute", right: 34, top: 340, height: 5, width: 300 * under, background: C.gold, borderRadius: 3 }} />
      <div style={{ position: "absolute", right: 34, bottom: 24, fontFamily: Tajawal, fontWeight: 500, fontSize: 26, color: C.inkSoft, opacity: prog(t, end(tl, "الحكمة") + 0.1, end(tl, "الحكمة") + 0.6) }}>ابن كثير · تفسير البقرة: ٣٠</div>
    </div>
  );
  return <Book id="qs" t={t} dur={dur} exit={exit} from={from} cam={cam} R={R} htmlL={htmlL} />;
};

// ─────────── c2-s4: معرفتنا محدودة (لا يُرسم ما يرمز إلى علم الله) ───────────
const KNOWN_BIG = "M560 300 C680 298 770 390 768 520 C766 640 680 740 560 740 C436 740 352 640 352 520 C352 400 440 302 554 300";
const KNOWN = "M560 368 C640 366 694 430 692 500 C690 574 634 632 560 632 C484 632 428 572 428 500 C428 428 486 370 556 368";
const Known: React.FC<HzProps> = ({ t, tl, dur, exit, from, p }) => {
  // يبقى سؤال الملائكة («؟» من المشهد السابق) ساكنًا ما دام الجواب لله؛ ثم يبهت حين يبدأ الكلام عن معرفتنا
  const qFade = prog(t, at(tl, "إن") - 0.05, at(tl, "معرفتنا") + 0.6);
  const circ = prog(t, at(tl, "معرفتنا") - 0.05, at(tl, "معرفتنا") + 0.9);
  const firm = prog(t, at(tl, "محدودة") - 0.05, at(tl, "محدودة") + 0.6);
  const label = prog(t, at(tl, "معرفتنا") + 0.25, at(tl, "معرفتنا") + 0.7);
  const dots = [at(tl, "نعرف"), at(tl, "بعض"), at(tl, "الحكم")].map((a) => prog(t, a - 0.05, a + 0.4, easeOut));
  const reach = prog(t, at(tl, "ندعي") - 0.05, at(tl, "الإحاطة") + 0.1);
  const recede = prog(t, at(tl, "الإحاطة") + 0.1, end(tl, "الإحاطة") + 0.2);
  // لقطة قريبة على دائرتنا الصغيرة، ثم عند «لا ندعي الإحاطة» تبتعد الكاميرا فيظهر اتساع الصفحة حولها: الفراغ هنا هو المعنى
  const cam = camPath(t, NEUTRAL, [
    { a: at(tl, "معرفتنا") - 0.25, b: at(tl, "محدودة") + 0.4, cx: 560, cy: 520, s: 1.35 },
    // «وقد نعرف بعض الحكم»: اقتراب من النقاط الثلاث داخل الدائرة وهي تُضاء، قبل ذكر الله
    { a: at(tl, "نعرف") - 0.2, b: at(tl, "الحكم") + 0.45, cx: 575, cy: 560, s: 1.55 },
    { a: at(tl, "ندعي") - 0.1, b: end(tl, "الإحاطة") + 0.2, cx: 900, cy: 520, s: 0.86 },
  ]);
  const L = (
    <g>
      <Ink d={KNOWN_BIG} w={5} p={circ} />
      <Ink d={KNOWN_BIG} w={10} p={firm} opacity={0.85} />
      <SText x={560} y={790} size={46} font="tajawal" weight={700} o={label} color={C.inkText}>
        معرفتنا
      </SText>
      {[
        [500, 470],
        [630, 440],
        [590, 590],
      ].map(([x, y], i) => (
        <g key={i} opacity={dots[i]}>
          <circle cx={x} cy={y} r={34 * dots[i]!} fill={C.gold} opacity={0.3} />
          <circle cx={x} cy={y} r={14} fill={C.gold} stroke={C.ink} strokeWidth={3} />
        </g>
      ))}
      <g opacity={1 - recede}>
        <path d="M740 470 C900 380 1100 300 1400 260 C1550 240 1650 250 1720 270" fill="none" stroke={C.inkSoft} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray={`${reach} 1`} opacity={reach > 0 ? 0.8 : 0} />
      </g>
    </g>
  );
  const R = (
    <g>
      <ChapterHead label={p.head ?? ""} />
      <g opacity={1 - qFade}>
        <SText x={1365} y={560} size={300} color={C.ink} o={0.9}>
          ؟
        </SText>
      </g>
      <g opacity={1 - recede}>
        <path d="M740 470 C900 380 1100 300 1400 260 C1550 240 1650 250 1720 270" fill="none" stroke={C.inkSoft} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray={`${reach} 1`} opacity={reach > 0 ? 0.8 : 0} />
      </g>
    </g>
  );
  return <Book id="kn" t={t} dur={dur} exit={exit} from={from} cam={cam} R={R} L={L} />;
};

// ─────────── c2-s5: يحدثنا القرآن عن الخلق (يمين)، ثم ينتقل إلى ما هو أعظم: التعليم (يسار) ───────────
const TwoTitles: React.FC<HzProps> = ({ t, tl, dur, exit, from, p }) => {
  const seal = prog(t, at(tl, "القرآن") - 0.05, at(tl, "القرآن") + 0.45, easeOut);
  // «وبعد هذا الإخبار»: خط ذهبي يُغلق ما سبق قبل أن يبدأ الحديث الجديد
  const rule = prog(t, at(tl, "وبعد") - 0.05, at(tl, "الإخبار") + 0.4);
  const khalq = prog(t, at(tl, "خلق") - 0.05, at(tl, "خلق") + 0.7);
  const adam = prog(t, at(tl, "آدم") - 0.05, at(tl, "آدم") + 0.45);
  const arrow = prog(t, at(tl, "ثم") - 0.1, at(tl, "عن", 2) + 0.4);
  const box = prog(t, at(tl, "أعظم") - 0.1, at(tl, "أعظم") + 0.8);
  const taalim = prog(t, at(tl, "التعليم") - 0.05, at(tl, "التعليم") + 0.8);
  const cam = camPath(t, NEUTRAL, [
    // «وبعد هذا الإخبار»: من الصفحتين إلى الصفحة اليمنى مع الخط الذهبي الذي يغلق ما سبق
    { a: at(tl, "وبعد") - 0.1, b: at(tl, "الإخبار") + 0.5, cx: 1365, cy: 500, s: 1.12 },
    // «يحدثنا القرآن الكريم»: إلى ختم القرآن، ثم «عن خلق آدم»: نزولًا إلى الكلمة وهي تُكتب
    { a: at(tl, "القرآن") - 0.25, b: at(tl, "الكريم") + 0.3, cx: 1365, cy: 330, s: 1.3 },
    { a: at(tl, "خلق") - 0.2, b: at(tl, "عليه") + 0.2, cx: 1365, cy: 480, s: 1.26 },
    // «ثم»: يتسع النظر عبر الكعب ليجمع العنوانين، «الخلق» (x≈1235–1495) و«التعليم» (x 300–820) والسهم بينهما
    // (كان cx 600 فيُقص «الخلق» عند الحافة نحو أربع ثوانٍ؛ مراجعة المشاهد ٩ نوفمبر). s=1.12 يُرى x 143–1857.
    { a: at(tl, "ثم") - 0.1, b: at(tl, "أعظم") + 0.3, cx: 1000, cy: 520, s: 1.12 },
  ]);
  const both = <Ink d="M1240 520 C1100 640 900 660 760 560" w={5} p={arrow} />;
  const R = (
    <g>
      <ChapterHead label={p.head ?? ""} />
      <Ink d="M1640 200 H1090" w={3} p={rule} c={C.gold} />
      <QuranSeal x={1365} y={270} o={seal} s={0.9} />
      <WriteIn id="tt-k" x={1365} y={470} size={120} p={khalq} label="الخلق" color="#8A5A3C" />
      <SText x={1365} y={545} size={38} font="tajawal" weight={500} color={C.inkSoft} o={adam}>
        آدم عليه السلام
      </SText>
      {both}
    </g>
  );
  const L = (
    <g>
      {both}
      <Ink d="M776 548 L760 560 L780 572" w={5} p={prog(arrow, 0.9, 1)} />
      <Ink d="M820 380 H300 V680 H820 Z" w={5} p={box} c={C.gold} />
      <Ink d="M806 394 H314 V666 H806 Z" w={1.8} p={box} c={C.gold} />
      <WriteIn id="tt-t" x={560} y={570} size={120} p={taalim} label="التعليم" />
    </g>
  );
  return <Book id="tt" t={t} dur={dur} exit={exit} from={from} cam={cam} R={R} L={L} />;
};

// ─────────── لقطتان مصممتان قبل هذا البناء (اختبار «خط الأفق»)، بخروج بخفوت الحبر ───────────
const legacy = (Comp: React.FC<{ t: number; tl: Timeline; refText?: string }>, endCam: Cam): React.FC<HzProps> =>
  function Legacy({ t, tl, dur, exit, p }) {
    // الخفوت يبدأ حين يُغلق الراوي الفكرة (كالدفتر)، لا بعد ذيل ساكن
    const close = React.useContext(SceneCloseContext);
    const f0 = close !== undefined ? Math.min(dur - 0.75, close + EXIT_BEAT) : dur - 0.75;
    return (
      // خفوت الحبر: الدفتر الفارغ بالكادر نفسه تحت اللقطة، واللقطة تخفت فوقه
      <>
        {exit === "fade" && t > f0 - 0.05 ? <BlankBookOver id="lg" cam={endCam} o={1} /> : null}
        <div style={{ position: "absolute", inset: 0, opacity: exit === "fade" ? 1 - prog(t, f0, dur - 0.15) : 1 }}>
          <Comp t={t} tl={tl} refText={p.ref} />
        </div>
      </>
    );
  };

// الأثر وحدوده (الأمر 019، E2): يبدأ بالدفتر نفسه بدل كادر ممتلئ بلون الورق. يتراجع من قرب «العتبة» إلى الدفتر كاملًا
// في أول 0.8 ث (قبل نافذة ذكر الله)، ويسكن عليه حتى «شواهد»، ثم يخفت الدفتر ويُكمل النزول في الطبقات كما كان.
// العنوان يحمله الدفتر وحده: عنوان اللقطة القديمة كان يظهر تحته أثناء الخفوت فيتكرر «الفصل السابع» نحو 0.6 ث (10:21.4)
const Shot6Body: React.FC<{ t: number; tl: Timeline }> = (q) => <Shot6 {...q} noHead />;
const EvidenceLegacy = legacy(Shot6Body, NEUTRAL);
const EvidenceScene: React.FC<HzProps> = (props) => {
  const { t, tl, p } = props;
  const sh = at(tl, "شواهد");
  const pull = prog(t, 0, 0.8, (x) => x * x * (3 - 2 * x));
  const o = 1 - prog(t, sh - 0.1, sh + 0.6);
  // تراجع بسرعة إدراك ثابتة: المقياس على سلّم لوغاريتمي، والمركز يتبع عرض الرؤية، فلا يتكدس الاتساع في آخر الإطارات
  const s = Math.pow(4.2, 1 - pull);
  const w = (1 / s - 1 / 4.2) / (1 - 1 / 4.2);
  const cam = { cx: mix(1365, 960, w), cy: mix(760, 520, w), s };
  return (
    <>
      <EvidenceLegacy {...props} />
      {o > 0 ? (
        <div style={{ position: "absolute", inset: 0, opacity: o }}>
          <Dusk />
          <Book id="ev0" t={t} dur={1e4} exit="none" cam={cam} R={p.head ? <ChapterHead label={p.head} /> : undefined} />
        </div>
      ) : null}
    </>
  );
};

/** كل مشاهد «خط الأفق»: المكتبة العامة (../lib/scenes) ثم مشاهد الحلقة 001 */
export const HZ_SCENES: Record<string, React.FC<HzProps>> = {
  ...LIB_SCENES,
  cover: Cover,
  basmala: BasmalaScene,
  nations: Nations,
  return: ReturnScene,
  lineage: Lineage,
  "no-date": legacy(Shot2, { cx: 960, cy: 520, s: 1 }),
  greater: Greater,
  index: IndexScene,
  begin: Begin,
  interpreters: legacy(Shot4, { cx: 900, cy: 575, s: 1.12 }),
  question: Question,
  known: Known,
  "two-titles": TwoTitles,
  ...HZ_SCENES_B,
  ...HZ_SCENES_C,
  "return-line": legacy(Shot5, { cx: 1405, cy: 500, s: 1.24 }),
  ...HZ_SCENES_D,
  evidence: EvidenceScene,
};

// كل مشهد مسجل له بياناته، والعكس
for (const k of Object.keys(HZ_META)) if (!HZ_SCENES[k]) throw new Error(`مشهد «خط الأفق» بلا رسم: ${k}`);
