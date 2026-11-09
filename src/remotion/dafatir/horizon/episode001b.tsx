/**
 * مشاهد «خط الأفق» للحلقة 001 — الفصلان 3 و4 (الدفعة البصرية الثانية) — `production-plan.md` والأمر 010.
 * لا يُصوَّر آدم ولا الملائكة ولا إبليس بهيئة أو ظل أو رمز يُفهم تجسيدًا، ولا يُمثَّل الخلق ولا نفخ الروح:
 * الكلمات تُكتب، والمعاني تُشرح برسوم مفاهيمية (خطوات، درج فهرسة، أدوات المعرفة، ميزان، أسهم، دوائر تصنيف).
 * ما ورد في القرآن يُوسم بختم ذهبي ومرجعه، وما قاله المفسرون بلسان أحمر ومصدره، ولا يُعرض تفسير بوصفه نصًا قرآنيًا.
 */
import React from "react";
import { at, end, type Timeline } from "./timeline";
import { C, Ink, easeOut, mix, prog, rng } from "./kit";
import { Book, ChapterHead, NEUTRAL, QuranSeal, SText, TafsirTab, WriteIn, camPath, type Cam, type Exit } from "./book";
import { VerseRefPanel } from "./verseRef";
import { Books, Desk, Hourglass, Inkwell, Lens, Qalam, Ruler, Tool } from "../lib/drawings";
import { Pan } from "../lib/compare";
import { Strike, Word } from "../lib/text";

export type HzProps = { t: number; tl: Timeline; dur: number; exit: Exit; from?: Cam; p: Record<string, string | undefined> };
const CLAY = "#8A5A3C";
const EMBER = C.ember;
const pop = (t: number, a: number, d = 0.45) => prog(t, a - 0.05, a - 0.05 + d, easeOut);

/** خط يتلاشى ثم يعود بالكتابة: كلمة SText تظهر مع ارتفاع خفيف */

/** شطب بخط أحمر يُرسم */

// ═══════════════ الفصل الثالث ═══════════════

// ─── c3-s1: «طين» كلمةً بلون الطين (لا تشكيل لصلصال ولا هيئة)، ثم مواضع ذكره علاماتٍ في كتاب مغلق ───
const MUSHAF = "M380 300 H740 V760 H380 Z";
const Clay: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const adam = pop(t, at(tl, "عليه"));
  const tin = prog(t, at(tl, "طين") - 0.05, at(tl, "طين") + 0.7, easeOut);
  const book = prog(t, at(tl, "وقد") - 0.05, at(tl, "ذكر") + 0.3);
  const m0 = at(tl, "مواضع");
  const m1 = end(tl, "متعددة");
  const seal = pop(t, at(tl, "القرآن"));
  const r = rng(31);
  const grains = Array.from({ length: 70 }, () => [1150 + r() * 430, 470 + r() * 120, 1.5 + r() * 2.5]);
  const R = (
    <g>
      {p.head ? <ChapterHead label={p.head} /> : null}
      <Word x={1365} y={330} size={42} p={adam} font="tajawal" weight={500} color={C.inkSoft}>
        آدم عليه السلام
      </Word>
      <ellipse cx={1365} cy={540} rx={250 * (0.6 + 0.4 * tin)} ry={78} fill={CLAY} opacity={0.16 * tin} />
      {grains.map(([x, y, rr], i) => (
        <circle key={i} cx={x} cy={y} r={rr! * tin} fill={CLAY} opacity={0.35 * prog(t, at(tl, "طين") + 0.1 + i * 0.004, at(tl, "طين") + 0.5 + i * 0.004)} />
      ))}
      <SText x={1365} y={585} size={190} o={tin} dy={(1 - tin) * 18} color={CLAY}>
        طين
      </SText>
    </g>
  );
  const L = (
    <g opacity={book}>
      <rect x={392} y={312} width={360} height={460} rx={10} fill="#2B1E14" opacity={0.18} />
      <Ink d={MUSHAF} w={4} p={book} fill="#3A4A3A" fillP={book} />
      <rect x={404} y={324} width={312} height={412} rx={4} fill="none" stroke={C.gold} strokeWidth={3} opacity={book} />
      <rect x={418} y={338} width={284} height={384} rx={2} fill="none" stroke={C.gold} strokeWidth={1.2} opacity={book} />
      <path d="M560 470 L600 530 L560 590 L520 530 Z" fill="none" stroke={C.gold} strokeWidth={3} opacity={book} />
      <circle cx={560} cy={530} r={10} fill={C.gold} opacity={book} />
      {[430, 485, 545, 610, 675].map((x, i) => {
        const a = mix(m0, m1 - 0.3, i / 4);
        const q = prog(t, a, a + 0.5, easeOut);
        const len = [110, 150, 92, 136, 120][i]!;
        return <path key={i} d={`M${x} 760 h${i % 2 ? 22 : 26} v${len * q} l${i % 2 ? -11 : -13} -12 l${i % 2 ? -11 : -13} 12 Z`} fill={i % 2 ? C.gold : C.ribbon} stroke={C.ink} strokeWidth={1.5} opacity={q} />;
      })}
      <QuranSeal x={760} y={250} o={seal} s={0.9} />
    </g>
  );
  // يبدأ برأس الفصل كاملًا، ويقترب على «آدم عليه السلام» حتى تملأ «طين» الكادر
  const cam = camPath(t, NEUTRAL, [
    { a: at(tl, "عليه") - 0.1, b: at(tl, "طين") + 0.4, cx: 1365, cy: 500, s: 1.7 },
    { a: at(tl, "وقد") - 0.2, b: at(tl, "مواضع"), ...NEUTRAL },
    // «في مواضع متعددة من القرآن الكريم»: إلى المصحف وعلامات مواضعه وهي تظهر
    // اقتراب خفيف والمصحف وعلاماته تظهر، ولا يخرج شيء من الكادر (القاعدة السادسة):
    // عند s=1.22 يُرى x 203–1777 وy 57–943، فيبقى المصحف (من 392) و«طين» وبقعتها (حتى 1615)
    // ورأس الفصل وشريطه (حتى 1736، من y 72) كاملين. كان 590/520/1.28 فيقص «طين» و«عليه السلام» نحو ثانيتين.
    { a: at(tl, "مواضع") + 0.05, b: at(tl, "القرآن") + 0.4, cx: 990, cy: 500, s: 1.22 },
  ]);
  return <Book id="c31" t={t} dur={dur} exit={exit} cam={cam} R={R} L={L} />;
};

// ─── c3-s4: ثلاث محطات كما وردت في الآيات (كلمات لا صور) — الخلق، التسوية، نفخ الروح ───
const STEPS = [
  { x: 1520, w: "خلق", label: "الخلق", n: "١" },
  { x: 1160, w: "وتسويته", label: "التسوية", n: "٢" },
  { x: 620, w: "ونفخ", label: "نفخ الروح", n: "٣" },
];
const Steps: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const seal = pop(t, at(tl, "الآيات"));
  const times = STEPS.map((s) => at(tl, s.w));
  const station = (i: number) => {
    const s = STEPS[i]!;
    const q = prog(t, times[i]! - 0.1, times[i]! + 0.45, easeOut);
    return (
      <g key={i}>
        <circle cx={s.x} cy={520} r={52 * q} fill={C.page} stroke={C.ink} strokeWidth={4} />
        <circle cx={s.x} cy={520} r={40 * q} fill={C.gold} opacity={0.25} />
        <SText x={s.x} y={540} size={56} o={q} color={C.ink}>
          {s.n}
        </SText>
        <Word x={s.x} y={660} size={64} p={prog(t, times[i]! + 0.1, times[i]! + 0.55, easeOut)} color={C.inkText}>
          {s.label}
        </Word>
      </g>
    );
  };
  const seg = (i: number) => {
    const a = STEPS[i]!.x - 52;
    const b = STEPS[i + 1]!.x + 52;
    return <Ink d={`M${a} 520 C${a - 120} 500 ${b + 120} 540 ${b} 520`} w={4} p={prog(t, times[i + 1]! - 0.4, times[i + 1]! - 0.05)} />;
  };
  const both = (
    <g>
      {seg(0)}
      {seg(1)}
      {[0, 1, 2].map(station)}
    </g>
  );
  const cam = camPath(t, NEUTRAL, [
    // «وفي هذه الآيات خبر…»: من الصفحتين إلى ختم الآيات، ثم إلى المحطة الأولى عند «خلق»
    { a: at(tl, "هذه") - 0.1, b: at(tl, "خبر") + 0.2, cx: 1500, cy: 360, s: 1.24 },
    { a: times[0]! - 0.35, b: times[0]! + 0.4, cx: 1420, cy: 520, s: 1.15 },
    { a: times[1]! - 0.5, b: times[1]! + 0.3, cx: 1250, cy: 520, s: 1.12 },
    { a: times[2]! - 0.5, b: times[2]! + 0.3, cx: 800, cy: 520, s: 1.12 },
    { a: tl.end - 0.2, b: tl.end + 0.7, ...NEUTRAL },
  ]);
  return (
    <Book
      id="c34"
      t={t}
      dur={dur}
      exit={exit}
      cam={cam}
      R={
        <g>
          {p.head ? <ChapterHead label={p.head} /> : null}
          <QuranSeal x={1560} y={270} o={seal} s={0.85} refText={p.ref} />
          {both}
        </g>
      }
      L={both}
    />
  );
};

// ─── c3-s6: درج فهرسة لأقوال المفسرين (بطاقات «قول» بلا تفصيل مُختلق)، ثم بطاقة واحدة لما هو واضح في الآيات ───
const DRAWER_FRONT = "M600 640 H1320 V860 H600 Z";
const Catalog: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const drawer = prog(t, 0, 0.8);
  const label = pop(t, at(tl, "المفسرون"));
  const c0 = at(tl, "اختلف");
  const c1 = end(tl, "متعددة");
  const sink = prog(t, at(tl, "ولكن") - 0.05, at(tl, "المعنى") + 0.3);
  const clear = prog(t, at(tl, "المعنى") - 0.05, at(tl, "الواضح") + 0.4, easeOut);
  const seal = pop(t, at(tl, "الآيات"));
  const cards = [650, 746, 842, 938, 1034, 1110];
  const both = (
    <g>
      {/* فتحة الدرج من أعلى */}
      <Ink d="M600 640 L660 590 H1260 L1320 640" w={3.5} p={drawer} fill="#5A3B26" fillP={0.22 * drawer} />
      {cards.map((x, i) => {
        const a = mix(c0, c1 - 0.35, i / (cards.length - 1));
        const up = prog(t, a, a + 0.55, easeOut) * (1 - sink);
        const y = 640 - 290 * up;
        const tilt = (i - 2.5) * 2.2 * up;
        return (
          <g key={i} transform={`rotate(${tilt} ${x + 80} ${y + 220})`}>
            <rect x={x} y={y} width={160} height={220} rx={8} fill="#FFFAF0" stroke={C.ink} strokeWidth={2.5} />
            <rect x={x + 92} y={y - 26} width={56} height={30} rx={5} fill={C.ribbon} stroke={C.ink} strokeWidth={1.5} />
            <SText x={x + 120} y={y - 4} size={20} font="tajawal" weight={700} color={C.page}>
              قول
            </SText>
            {[44, 84, 124].map((dy) => (
              <line key={dy} x1={x + 20} x2={x + 140 - (dy % 3) * 12} y1={y + dy} y2={y + dy} stroke={C.inkSoft} strokeWidth={2} opacity={0.4} />
            ))}
          </g>
        );
      })}
      {/* واجهة الدرج تغطي البطاقات */}
      <Ink d={DRAWER_FRONT} w={4} p={drawer} fill="#8B5E3C" fillP={drawer} />
      <rect x={810} y={680} width={300} height={74} rx={6} fill={C.page} stroke={C.ribbon} strokeWidth={3} opacity={drawer} />
      <SText x={960} y={728} size={32} font="tajawal" weight={700} color={C.ribbon} o={label}>
        أقوال المفسرين
      </SText>
      <path d="M910 800 C910 830 1010 830 1010 800" fill="none" stroke={C.gold} strokeWidth={6} strokeLinecap="round" opacity={drawer} />
    </g>
  );
  const cardW = 560;
  const cy = mix(640, 250, clear);
  const front = (
    <g opacity={clear}>
      <rect x={960 - cardW / 2} y={cy} width={cardW} height={250} rx={12} fill="#FFFAF0" stroke={C.gold} strokeWidth={5} />
      <rect x={960 - cardW / 2 + 12} y={cy + 12} width={cardW - 24} height={226} rx={8} fill="none" stroke={C.gold} strokeWidth={1.5} />
      <SText x={960} y={cy + 150} size={64} color={C.ink}>
        علم خص به آدم
      </SText>
    </g>
  );
  const cam = camPath(t, { cx: 1380, cy: 640, s: 1.25 }, [
    { a: c0 - 0.2, b: c1, cx: 1340, cy: 560, s: 1.15 },
    { a: at(tl, "المعنى") - 0.2, b: at(tl, "الواضح") + 0.5, cx: 1360, cy: 480, s: 1.12 },
    // «خصّ آدم بعلم علّمه إياه»: الكادر يقترب من البطاقة التي تحمل هذا المعنى (بعد نافذة ذكر الله)
    { a: end(tl, "الله") + 0.3, b: at(tl, "إياه") + 0.3, cx: 1380, cy: 380, s: 1.36 },
  ]);
  return (
    <Book
      id="c36"
      t={t}
      dur={dur}
      exit={exit}
      cam={cam}
      R={
        <g>
          {p.head ? <ChapterHead label={p.head} /> : null}
          <g transform="translate(420 0)">
            {both}
            {front}
            <QuranSeal x={960 + cardW / 2 - 10} y={cy + 6} o={seal * clear} s={0.7} />
          </g>
        </g>
      }
    />
  );
};

// ─── c3-s9: الدفتر على مكتب الكاتب: أسباب المعرفة أدواتٌ حوله، و«الغرور» يُشطب، و«دليل» تحت العدسة ───
const Knowledge: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const learn = at(tl, "ونتعلم");
  const ilm = prog(t, at(tl, "العلم", 1) - 0.05, at(tl, "العلم", 1) + 0.7);
  const nima = pop(t, at(tl, "نعمة"));
  const tools = [at(tl, "نعرفه", 1), at(tl, "نعرفه", 2), at(tl, "أسباب"), at(tl, "المعرفة")].map((a) => prog(t, a - 0.05, a + 0.5, easeOut));
  const ghurur = pop(t, at(tl, "للغرور"));
  const strike = prog(t, at(tl, "بالعلم"), end(tl, "بالعلم") + 0.1);
  const iddia = pop(t, at(tl, "لادعاء"));
  const strike2 = prog(t, at(tl, "معرفة"), at(tl, "يقم"));
  const dalil = pop(t, at(tl, "دليل"));
  const lensMove = prog(t, at(tl, "دليل"), at(tl, "دليل") + 0.8, easeOut);
  const cam = camPath(t, NEUTRAL, [
    // «ما علّمه لآدم»: اقتراب من بطاقة ما خُصّ به آدم قبل أن ينفتح الكادر على المكتب
    { a: at(tl, "علمه") - 0.1, b: at(tl, "السلام") + 0.3, cx: 1365, cy: 425, s: 1.3 },
    { a: learn - 0.1, b: at(tl, "نعمة") + 0.4, cx: 960, cy: 560, s: 0.7 },
    // «بما يسّره لنا من أسباب المعرفة»: النظر يمر على أدوات المعرفة حول الدفتر وهي تظهر
    { a: at(tl, "بما") - 0.1, b: at(tl, "المعرفة") + 0.4, cx: 1180, cy: 640, s: 0.76 },
    { a: at(tl, "فلا") - 0.2, b: at(tl, "للغرور") + 0.4, cx: 600, cy: 520, s: 1.05 },
    // «ولا لادعاء معرفة…»: اقتراب من الادعاء وهو يُشطب، ثم يتبع العدسة إلى «دليل»
    { a: at(tl, "لادعاء") - 0.2, b: at(tl, "لادعاء") + 0.6, cx: 560, cy: 540, s: 1.22 },
    { a: at(tl, "دليل") - 0.3, b: at(tl, "دليل") + 0.6, cx: 560, cy: 680, s: 1.28 },
  ]);
  // يبدأ المشهد من حيث انتهى الدرج: ما خُصّ به آدم من علم، ثم ينفتح على ما نتعلمه نحن
  const recap = 1 - prog(t, learn - 0.2, learn + 0.4);
  const R = (
    <g>
      {p.head ? <ChapterHead label={p.head} /> : null}
      <g opacity={recap}>
        <rect x={1085} y={300} width={560} height={250} rx={12} fill="#FFFAF0" stroke={C.gold} strokeWidth={5} />
        <rect x={1097} y={312} width={536} height={226} rx={8} fill="none" stroke={C.gold} strokeWidth={1.5} />
        <SText x={1365} y={450} size={64} color={C.ink}>
          علم خص به آدم
        </SText>
        <QuranSeal x={1635} y={306} s={0.7} />
      </g>
      <WriteIn id="kw-i" x={1365} y={470} size={120} p={ilm} label="العلم" />
      <Word x={1365} y={610} size={56} p={nima} font="tajawal" weight={500} color={C.gold}>
        نعمة
      </Word>
    </g>
  );
  const L = (
    <g>
      <Word x={560} y={380} size={84} p={ghurur} color={EMBER}>
        الغرور
      </Word>
      <Strike x1={680} x2={440} y={352} p={strike} />
      <Word x={560} y={530} size={70} p={iddia} font="tajawal" weight={500} color={C.inkSoft}>
        ادعاء بلا علم
      </Word>
      <Strike x1={730} x2={390} y={506} p={strike2} />
      <Word x={560} y={720} size={96} p={dalil} color={C.ink}>
        دليل
      </Word>
      <ellipse cx={560} cy={690} rx={150 * dalil} ry={70 * dalil} fill="none" stroke={C.gold} strokeWidth={5} opacity={dalil} />
    </g>
  );
  // الأدوات حول الدفتر على المكتب، والعدسة تنتقل إلى «دليل» في آخر المشهد
  const over = (
    <g>
      <Tool q={tools[0]!} x={2030} y={340}>
        <Books />
      </Tool>
      <Tool q={tools[1]!} x={-60} y={230}>
        <Inkwell />
      </Tool>
      <Tool q={tools[1]!} x={-80} y={620} rot={-62}>
        <Qalam />
      </Tool>
      <Tool q={tools[2]!} x={1990} y={960} rot={-8}>
        <Ruler />
      </Tool>
      <Tool q={tools[3]!} x={mix(-150, 560, lensMove)} y={mix(1060, 690, lensMove)} rot={mix(-12, 0, lensMove)}>
        <Lens />
      </Tool>
    </g>
  );
  return <Book id="c39" t={t} dur={dur} exit={exit} cam={cam} under={<g opacity={prog(t, learn - 0.2, learn + 0.4)}><Desk /></g>} R={R} L={L} over={over} />;
};

// ═══════════════ الفصل الرابع ═══════════════

// ─── c4-s1: السجود تكريم لا عبادة (ابن كثير، البقرة 34)، والعبادة لله وحده ───
const Honor: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const sujud = prog(t, at(tl, "يسجدوا") - 0.05, at(tl, "يسجدوا") + 0.7);
  const adam = prog(t, 0.05, 0.6, easeOut);
  const boxK = prog(t, at(tl, "تكريما") + 0.1, at(tl, "تكريما") + 0.6);
  const boxI = prog(t, at(tl, "وليس") - 0.05, at(tl, "عبادة") + 0.2);
  const takrim = pop(t, at(tl, "تكريما") + 0.1);
  const check = prog(t, at(tl, "تكريما") + 0.3, at(tl, "تكريما") + 0.8);
  const tab = pop(t, at(tl, "لآدم"));
  const ibada = pop(t, at(tl, "عبادة"));
  const cross = prog(t, at(tl, "عبادة") + 0.2, at(tl, "له", 2) + 0.2);
  const lift = prog(t, at(tl, "فالعبادة") - 0.1, at(tl, "حق") + 0.05, easeOut);
  const cam = camPath(t, NEUTRAL, [
    // «آدم عليه السلام»: إلى الاسم المكتوب (بعد نافذة ذكر الله)، ثم «أمر…أن يسجدوا»: نزولًا إلى الكلمة وهي تُكتب
    { a: end(tl, "الله") + 0.3, b: at(tl, "السلام") + 0.3, cx: 1365, cy: 290, s: 1.26 },
    { a: at(tl, "أمر") - 0.1, b: at(tl, "يسجدوا") + 0.6, cx: 1365, cy: 460, s: 1.1 },
    // «وكان هذا السجود»: اقتراب من الكلمة نفسها قبل ذكر الله
    { a: at(tl, "هذا") - 0.1, b: at(tl, "السجود") + 0.4, cx: 1365, cy: 360, s: 1.3 },
    { a: at(tl, "تكريما") + 0.1, b: at(tl, "تكريما") + 0.7, cx: 1365, cy: 600, s: 1.2 },
    // «وليس عبادة له»: انتقال إلى العمود الثاني وهو يُرسم ويُشطب
    { a: at(tl, "وليس") - 0.2, b: at(tl, "عبادة") + 0.4, cx: 1220, cy: 600, s: 1.26 },
    { a: at(tl, "فالعبادة") - 0.3, b: at(tl, "حق") - 0.05, cx: 780, cy: 500, s: 1.04 },
  ]);
  const col = (x: number, label: string, q: number, good: boolean, mark: number, fade = 1) => (
    <g opacity={fade}>
      <Ink d={`M${x + 140} 470 H${x - 140} V720 H${x + 140} Z`} w={3} p={good ? boxK : boxI} c={good ? C.gold : C.inkSoft} />
      <Word x={x} y={590} size={64} p={q} color={good ? C.ink : C.inkSoft}>
        {label}
      </Word>
      {good ? <Ink d={`M${x - 40} 650 L${x - 10} 680 L${x + 46} 622`} w={7} p={mark} c={C.gold} /> : <Ink d={`M${x - 120} 490 L${x + 120} 700 M${x + 120} 490 L${x - 120} 700`} w={5} p={mark} c={C.ribbon} />}
    </g>
  );
  const R = (
    <g>
      {p.head ? <ChapterHead label={p.head} /> : null}
      <Word x={1365} y={230} size={46} p={adam} font="tajawal" weight={500} color={C.inkSoft}>
        آدم عليه السلام
      </Word>
      <WriteIn id="hn-s" x={1365} y={340} size={100} p={sujud} label="السجود" />
      <Ink d="M1500 370 H1230" w={3} p={sujud} c={C.gold} />
      {col(1530, "تكريم", takrim, true, check)}
      {col(1200, "عبادة", ibada, false, cross, 1 - 0.6 * lift)}
      <TafsirTab x={1690} y={760} o={tab} label="ابن كثير · تفسير البقرة ٣٤" w={380} />
    </g>
  );
  const L = (
    <g opacity={lift}>
      <Ink d="M820 300 H300 V700 H820 Z" w={4} p={lift} c={C.gold} />
      <Ink d="M806 314 H314 V686 H806 Z" w={1.5} p={lift} c={C.gold} />
      <SText x={560} y={470} size={104} color={C.ink}>
        العبادة
      </SText>
      <SText x={560} y={590} size={70} color={C.ink}>
        لله وحده
      </SText>
    </g>
  );
  return <Book id="c41" t={t} dur={dur} exit={exit} cam={cam} R={R} L={L} />;
};

// ─── c4-s2: خطان على مسار الأمر: خط يتبعه حتى آخره (استجابة)، وخط يقف ثم يعلو عنه (إباء واستكبار) ───
const PATH_R = "M1700 470 C1500 430 1250 520 960 470";
const PATH_L = "M960 470 C700 420 450 520 220 470";
const LOW_R = "M1700 640 C1520 610 1330 680 1180 640";
const RISE = "M1180 640 C1120 625 1090 560 1070 470 C1050 380 1010 300 960 250";
const Comply: React.FC<HzProps> = ({ t, tl, dur, exit }) => {
  const guide = prog(t, 0.1, 0.9);
  const g0 = at(tl, "استجابت") - 0.05;
  const g1 = at(tl, "ربها") - 0.3;
  const gm = (g0 + g1) / 2;
  const gR = prog(t, g0, gm);
  const gL = prog(t, gm, g1);
  const lblA = pop(t, end(tl, "ربها") + 0.3);
  const e0 = at(tl, "إبليس");
  const low = prog(t, e0 - 0.05, at(tl, "أبى"));
  const halt = pop(t, at(tl, "أبى"), 0.3);
  const rise = prog(t, at(tl, "واستكبر") - 0.05, end(tl, "واستكبر") + 0.3);
  const lblB = pop(t, end(tl, "واستكبر"));
  const dots = (d: string) => <path d={d} fill="none" stroke={C.gold} strokeWidth={3} strokeDasharray="2 12" strokeLinecap="round" opacity={0.8 * guide} />;
  const cam = camPath(t, { cx: 1380, cy: 520, s: 1.12 }, [
    { a: gm - 0.3, b: g1, cx: 640, cy: 500, s: 1.12 },
    { a: e0 - 0.4, b: e0 + 0.1, cx: 1360, cy: 560, s: 1.1 },
    { a: at(tl, "واستكبر") - 0.1, b: end(tl, "واستكبر") + 0.6, cx: 1150, cy: 470, s: 1.0 },
  ]);
  const R = (
    <g>
      <SText x={1690} y={420} size={34} font="tajawal" weight={700} color={C.gold} anchor="start" o={guide}>
        الأمر
      </SText>
      {dots(PATH_R)}
      {dots(LOW_R)}
      <Ink d={PATH_R} w={8} p={gR} c={C.gold} />
      <Ink d={LOW_R} w={22} p={low} c={EMBER} opacity={0.18} />
      <Ink d={LOW_R} w={10} p={low} c="#B23A1E" />
      <circle cx={1180} cy={640} r={22 * halt} fill="#B23A1E" stroke={C.ink} strokeWidth={3} />
      <Ink d={RISE} w={26} p={rise} c={EMBER} opacity={0.18} />
      <Ink d={RISE} w={10} p={rise} c="#B23A1E" />
      <Ink d="M928 280 L960 250 L948 294" w={10} p={prog(rise, 0.85, 1)} c="#B23A1E" />
      <Word x={1250} y={300} size={58} p={lblB} font="tajawal" weight={800} color="#B23A1E">
        إباء واستكبار
      </Word>
    </g>
  );
  const L = (
    <g>
      {dots(PATH_L)}
      <path d="M960 640 C700 610 450 680 220 640" fill="none" stroke={C.gold} strokeWidth={3} strokeDasharray="2 12" strokeLinecap="round" opacity={0.8 * guide} />
      <Ink d={PATH_L} w={8} p={gL} c={C.gold} />
      <circle cx={220} cy={470} r={12 * lblA} fill={C.gold} />
      <Word x={420} y={400} size={58} p={lblA} font="tajawal" weight={800} color="#A8803A">
        استجابة
      </Word>
    </g>
  );
  return <Book id="c42" t={t} dur={dur} exit={exit} cam={cam} R={R} L={L} />;
};

// ─── c4-s3: تصنيف لا تجسيد: «إبليس» كلمةً لا تدخل دائرة الملائكة، وتستقر في دائرة الجن (الكهف 50) ───
const Sort: React.FC<HzProps> = ({ t, tl, dur, exit }) => {
  const ring = prog(t, 0.05, at(tl, "نعرف") + 0.3);
  const angels = pop(t, at(tl, "الملائكة"));
  const jinn = pop(t, at(tl, "الجن"));
  const tag = pop(t, at(tl, "إبليس"));
  const toA = prog(t, at(tl, "يكن") - 0.1, at(tl, "الملائكة") + 0.2, easeOut);
  const blocked = prog(t, at(tl, "الملائكة") + 0.1, end(tl, "الملائكة") + 0.3);
  const toJ = prog(t, at(tl, "بل") - 0.05, end(tl, "الجن") + 0.1, easeOut);
  const seal = pop(t, at(tl, "الكهف"));
  // موضع الكلمة: من الوسط إلى حافة دائرة الملائكة (ترتد)، ثم إلى قلب دائرة الجن
  const bx = mix(mix(960, 1170, toA) - 60 * blocked, 560, toJ);
  const by = mix(300, 520, Math.max(toA * 0.4, toJ));
  const tagEl = (
    <g opacity={tag} transform={`translate(${bx} ${by})`}>
      <rect x={-110} y={-44} width={220} height={74} rx={37} fill={C.page} stroke={EMBER} strokeWidth={4} />
      <SText x={0} y={12} size={42} font="tajawal" weight={700} color={EMBER}>
        إبليس
      </SText>
    </g>
  );
  const cam = camPath(t, NEUTRAL, [
    // «ومن المهم هنا أن نعرف»: يبدأ النظر يتجه إلى الدائرتين وهما تُرسمان، ثم إلى «إبليس»
    { a: at(tl, "هنا") - 0.1, b: at(tl, "الملائكة") + 0.3, cx: 1200, cy: 500, s: 1.15 },
    { a: at(tl, "بل") - 0.2, b: end(tl, "الجن") + 0.3, cx: 820, cy: 520, s: 1.1 },
  ]);
  const R = (
    <g>
      <Ink d="M1365 320 C1520 320 1600 420 1600 520 C1600 640 1500 720 1365 720 C1230 720 1130 640 1130 520 C1130 410 1220 320 1361 320" w={4} p={ring} c={C.gold} />
      <Word x={1365} y={540} size={56} p={angels} color={C.ink}>
        الملائكة
      </Word>
      <Ink d="M1150 380 L1230 470 M1230 380 L1150 470" w={6} p={blocked} c={C.ribbon} />
      {tagEl}
    </g>
  );
  const L = (
    <g>
      <Ink d="M560 320 C715 320 795 420 795 520 C795 640 695 720 560 720 C425 720 325 640 325 520 C325 410 415 320 556 320" w={4} p={ring} c={C.inkSoft} />
      <Word x={560} y={640} size={56} p={jinn} color={C.ink}>
        الجن
      </Word>
      <QuranSeal x={300} y={250} o={seal} s={0.85} refText="الكهف ٥٠" />
      {tagEl}
    </g>
  );
  return <Book id="c43" t={t} dur={dur} exit={exit} cam={cam} R={R} L={L} />;
};

// ─── c4-s5: ميزان «نار / طين» الذي ظنه حجة، يُخطَّأ ويصغر، ويعلوه «أمر واجب الطاعة» ───
const Scale: React.FC<HzProps> = ({ t, tl, dur, exit }) => {
  const draw = prog(t, at(tl, "فقدم") - 0.05, at(tl, "حجة") + 0.2);
  const zann = pop(t, at(tl, "ظنه"));
  const nar = pop(t, at(tl, "نار"));
  const tilt = prog(t, at(tl, "أفضل") - 0.1, at(tl, "أفضل") + 0.6, easeOut);
  const tin = pop(t, at(tl, "طين"));
  const wrong = prog(t, at(tl, "أخطأ") - 0.05, at(tl, "أخطأ") + 0.5);
  const bar = prog(t, at(tl, "مقدما"), at(tl, "على") + 0.1);
  const shrink = prog(t, at(tl, "مجرد") - 0.1, at(tl, "مقارنة") + 0.4, easeOut);
  const pulse = prog(t, at(tl, "مادتين"), at(tl, "مادتين") + 0.35) * (1 - prog(t, at(tl, "مادتين") + 0.35, at(tl, "مادتين") + 0.8));
  const amr = [at(tl, "أمرا"), at(tl, "وجبت"), at(tl, "طاعته")].map((a) => pop(t, a));
  const rise = prog(t, at(tl, "فاستكبر") - 0.05, end(tl, "عنه") + 0.2);
  const ang = -9 * tilt;
  const sc = mix(1, 0.55, shrink);
  const ox = mix(1180, 760, shrink);
  const oy = mix(0, 210, shrink);
  const beam = (
    <g transform={`translate(${ox} ${oy}) scale(${sc}) translate(-960 0)`} opacity={draw * (1 - 0.45 * wrong)}>
      <Ink d="M960 300 V820 M860 820 H1060" w={6} p={draw} />
      <circle cx={960} cy={300} r={14} fill={C.gold} stroke={C.ink} strokeWidth={3} />
      <g transform={`rotate(${ang} 960 300)`}>
        <Ink d="M650 300 H1270" w={7} p={draw} />
        <g transform={`rotate(${-ang} 650 300)`}>
          <Pan x={650} y={300} label="نار" color={EMBER} q={nar * (1 + 0.15 * pulse)} />
        </g>
        <g transform={`rotate(${-ang} 1270 300)`}>
          <Pan x={1270} y={300} label="طين" color={CLAY} q={tin * (1 + 0.15 * pulse)} />
        </g>
      </g>
    </g>
  );
  // «الظن» ختمٌ يُرفع فوق «الأمر» (الخطأ في الترتيب)، ثم يُشطب ويسقط عند «لم يكن الأمر مجرد مقارنة»
  const lift = prog(t, at(tl, "جعل") - 0.05, at(tl, "مقدما"), easeOut);
  const fall = prog(t, at(tl, "لم") + 0.35, at(tl, "مجرد") + 0.3);
  const cross = prog(t, at(tl, "لم") - 0.05, at(tl, "لم") + 0.35);
  const zx = mix(1430, 1250, lift);
  const zy = mix(205, 128, lift) + 520 * fall * fall;
  const stamp = (
    <g opacity={zann * (1 - fall)} transform={`translate(${zx} ${zy}) rotate(${-8 + 8 * lift + 30 * fall}) scale(${1 + 0.25 * lift})`}>
      <rect x={-86} y={-44} width={172} height={80} rx={8} fill={C.page} stroke={C.ribbon} strokeWidth={5} />
      <SText x={0} y={14} size={52} color={C.ribbon}>
        ظن
      </SText>
      <Ink d="M-96 -52 L96 46 M96 -52 L-96 46" w={7} p={cross} c={C.ribbon} />
    </g>
  );
  const top = (
    <g>
      <Ink d="M1500 190 H420" w={10} p={bar} c={C.gold} />
      {stamp}
      {["أمر", "واجب", "الطاعة"].map((w, i) => (
        <Word key={i} x={[1290, 1060, 800][i]!} y={290} size={70} p={amr[i]!} color={C.ink}>
          {w}
        </Word>
      ))}
      <Ink d="M720 720 C700 590 640 460 540 370 C460 300 360 280 280 320" w={6} p={rise} c={EMBER} opacity={0.9} />
    </g>
  );
  const cam = camPath(t, NEUTRAL, [
    // «ما ظنه حجة»: إلى ختم «ظن» لحظة ظهوره
    { a: at(tl, "ظنه") - 0.2, b: at(tl, "حجة") + 0.3, cx: 1400, cy: 270, s: 1.3 },
    { a: at(tl, "رأى") - 0.1, b: at(tl, "أفضل") + 0.5, cx: 1100, cy: 520, s: 1.1 },
    // «من طين»: إلى الكفة الثانية، ثم «ولكنه أخطأ»: رجوع يرى الميزان كله وهو يبهت
    { a: at(tl, "طين") - 0.3, b: at(tl, "طين") + 0.5, cx: 1460, cy: 420, s: 1.26 },
    { a: at(tl, "أخطأ") - 0.2, b: at(tl, "أخطأ") + 0.6, cx: 1100, cy: 500, s: 1.04 },
    { a: at(tl, "جعل") - 0.2, b: at(tl, "مقدما") + 0.3, cx: 1100, cy: 400, s: 1.08 },
    { a: at(tl, "لم") - 0.1, b: at(tl, "مقارنة") + 0.5, ...NEUTRAL },
    // «بين مادتين»: إلى الميزان الصغير وكفتاه تنبضان
    { a: at(tl, "مادتين") - 0.2, b: at(tl, "مادتين") + 0.6, cx: 760, cy: 440, s: 1.22 },
    { a: at(tl, "أمرا") - 0.2, b: at(tl, "طاعته") + 0.3, cx: 960, cy: 380, s: 1.08 },
  ]);
  return (
    <Book
      id="c45"
      t={t}
      dur={dur}
      exit={exit}
      cam={cam}
      R={
        <g>
          {beam}
          {top}
        </g>
      }
      L={
        <g>
          {beam}
          {top}
        </g>
      }
    />
  );
};

// ─── c4-s6 وc4-s7: العداوة سهمٌ من «إبليس» إلى نسل آدم، والإمهال ساعة رملية، ثم حدّ لا سلطان له وراءه ───
const TREE: [number, number][] = [[1380, 300]];
for (const [y, xs] of [
  [400, [1290, 1470]],
  [500, [1230, 1340, 1430, 1540]],
  [600, [1180, 1250, 1320, 1390, 1460, 1530, 1600, 1660]],
] as [number, number[]][])
  for (const x of xs) TREE.push([x, y]);
const OUTSIDE: [number, number][] = [
  [1110, 760],
  [1180, 800],
  [1060, 820],
];
const Lineage2: React.FC<{ t: number; a: number; o?: number }> = ({ t, a, o = 1 }) => (
  <g opacity={o}>
    {TREE.slice(1).map(([x, y], i) => {
      const parent = i < 2 ? TREE[0]! : i < 6 ? TREE[1 + Math.floor((i - 2) / 2)]! : TREE[3 + Math.floor((i - 6) / 2)]!;
      const q = prog(t, a + i * 0.05, a + 0.4 + i * 0.05);
      return <Ink key={i} d={`M${parent[0]} ${parent[1] + 8} C${parent[0]} ${parent[1] + 50} ${x} ${y - 50} ${x} ${y - 8}`} w={2.5} p={q} />;
    })}
    {TREE.map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={(i ? 7 : 12) * prog(t, a + i * 0.04, a + 0.3 + i * 0.04)} fill={C.ink} />
    ))}
  </g>
);
const ATTACK = [
  "M640 520 C820 560 980 640 1170 610",
  "M640 520 C820 440 1000 380 1240 410",
  "M640 520 C800 620 980 760 1100 760",
  "M640 520 C820 500 1060 540 1300 520",
];
const IblisWord: React.FC<{ o: number }> = ({ o }) => (
  <g opacity={o}>
    <SText x={480} y={540} size={84} color={EMBER}>
      إبليس
    </SText>
  </g>
);
const Enmity: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  // العلاقة تُبنى مع الجملة: «إبليس» ثم سهم «عداوة» يخرج بلا هدف، ثم يظهر هدفه «آدم وذريته» فيصل إليه؛
  // ثم «إمهال» ساعة رملية تجري، ثم «إغواء» مسارات تُرسم نحو فروع النسل.
  const iblis = pop(t, at(tl, "إبليس", 1));
  const tree = at(tl, "لآدم");
  const lbl = pop(t, at(tl, "وذريته"));
  const arrow = prog(t, at(tl, "عدوا") - 0.05, end(tl, "وذريته") + 0.2);
  const seal = pop(t, at(tl, "القرآن"));
  const hg = pop(t, at(tl, "يمهله"));
  const flow = prog(t, at(tl, "يمهله"), dur);
  const mhl = pop(t, at(tl, "يمهله") + 0.2);
  const att = [at(tl, "أعلن"), at(tl, "عزمه"), at(tl, "إغواء"), at(tl, "البشر")].map((a) => prog(t, a - 0.05, a + 0.8));
  const ighwa = pop(t, at(tl, "إغواء"));
  const cam = camPath(t, { cx: 620, cy: 520, s: 1.2 }, [
    { a: at(tl, "عدوا") - 0.1, b: end(tl, "وذريته") + 0.2, cx: 1250, cy: 450, s: 1.08 },
    { a: end(tl, "وذريته") + 0.3, b: end(tl, "وذريته") + 1.0, ...NEUTRAL },
    // «أن إبليس سأل»: النظر يعود إلى «إبليس» قبل نافذة ذكر الله، ثم الساعة الرملية عند «يمهله»
    { a: at(tl, "إبليس", 2) - 0.2, b: Math.min(at(tl, "سأل") + 0.2, at(tl, "الله") - 0.3), cx: 560, cy: 500, s: 1.16 },
    { a: at(tl, "يمهله") + 0.05, b: at(tl, "يمهله") + 0.7, cx: 620, cy: 560, s: 1.15 },
    { a: at(tl, "أعلن") - 0.2, b: at(tl, "إغواء") + 0.3, ...NEUTRAL },
  ]);
  const both = (
    <g>
      <path d="M650 470 C800 380 1000 360 1150 400" fill="none" stroke={EMBER} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={`${arrow} 1`} opacity={arrow > 0 ? 1 : 0} />
      <Ink d="M1125 380 L1152 401 L1120 420" w={6} p={prog(arrow, 0.9, 1)} c={EMBER} />
      <SText x={900} y={350} size={44} font="tajawal" weight={800} color={EMBER} o={prog(arrow, 0, 0.3)}>
        عداوة
      </SText>
      {ATTACK.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={EMBER} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray={`${att[i]! * 0.98} 1`} opacity={att[i]! > 0 ? 0.75 : 0} />
      ))}
    </g>
  );
  return (
    <Book
      id="c46"
      t={t}
      dur={dur}
      exit={exit}
      cam={cam}
      R={
        <g>
          {p.head ? <ChapterHead label={p.head} /> : null}
          <Lineage2 t={t} a={tree} />
          <Word x={1420} y={240} size={50} p={lbl} font="tajawal" weight={700} color={C.ink}>
            آدم وذريته
          </Word>
          {both}
        </g>
      }
      L={
        <g>
          <IblisWord o={iblis} />
          <Hourglass q={hg} flow={flow} />
          <SText x={480} y={800} size={38} font="tajawal" weight={700} color={C.gold} o={mhl}>
            إمهال
          </SText>
          <SText x={760} y={700} size={40} font="tajawal" weight={800} color={EMBER} o={ighwa}>
            إغواء
          </SText>
          <QuranSeal x={300} y={250} o={seal} s={0.85} />
          {both}
        </g>
      }
    />
  );
};
const Authority: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const threat = prog(t, at(tl, "الوعيد") - 0.1, at(tl, "الوعيد") + 0.5);
  const seal = pop(t, at(tl, "الحجر"));
  const ring = prog(t, at(tl, "عباده") - 0.05, at(tl, "عليهم") + 0.2);
  const stop = prog(t, at(tl, "سلطان") - 0.05, at(tl, "سلطان") + 0.6);
  const follow = prog(t, at(tl, "اتبعه") - 0.05, end(tl, "الغاوين") + 0.2);
  const cam = camPath(t, NEUTRAL, [
    // «في مقابل هذا الوعيد»: إلى مسارات الإغواء وهي تشتد (قبل ذكر الله)، ثم ختم «الحجر» لحظة ذكرها
    { a: at(tl, "مقابل") - 0.1, b: Math.min(at(tl, "الوعيد") + 0.4, at(tl, "الله") - 0.3), cx: 900, cy: 520, s: 1.1 },
    { a: at(tl, "الحجر") - 0.2, b: at(tl, "الحجر") + 0.5, cx: 440, cy: 330, s: 1.22 },
    { a: at(tl, "عباده") - 0.3, b: at(tl, "سلطان") + 0.4, cx: 1150, cy: 540, s: 1.08 },
    // «إلا من اتبعه من الغاوين»: إلى من خرجوا من الحد وهم يُتبعون
    { a: at(tl, "اتبعه") - 0.2, b: end(tl, "الغاوين") + 0.2, cx: 1150, cy: 740, s: 1.3 },
  ]);
  const attacks = (
    <g opacity={(0.35 + 0.65 * threat) * (1 - 0.85 * stop)}>
      {ATTACK.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={EMBER} strokeWidth={3.5} pathLength={1} strokeDasharray="0.02 0.025" strokeLinecap="round" opacity={0.8} />
      ))}
    </g>
  );
  const both = (
    <g>
      {attacks}
      {OUTSIDE.map(([x, y], i) => (
        <path key={i} d={`M640 520 C760 640 ${x - 120} ${y + 20} ${x} ${y}`} fill="none" stroke={EMBER} strokeWidth={3.5} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - follow} opacity={0.85} />
      ))}
    </g>
  );
  return (
    <Book
      id="c47"
      t={t}
      dur={dur}
      exit={exit}
      cam={cam}
      R={
        <g>
          {p.head ? <ChapterHead label={p.head} /> : null}
          <Lineage2 t={t} a={-5} />
          {OUTSIDE.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={7} fill={C.inkSoft} />
          ))}
          <Ink d="M1420 205 C1640 210 1740 380 1730 480 C1720 640 1580 690 1420 690 C1230 690 1120 620 1120 470 C1120 330 1220 210 1416 205" w={6} p={ring} c={C.gold} />
          <Word x={1420} y={760} size={40} p={ring} font="tajawal" weight={700} color={C.gold}>
            لا سلطان له عليهم
          </Word>
          {both}
        </g>
      }
      L={
        <g>
          <IblisWord o={1} />
          <Hourglass q={1} flow={0.55} />
          <QuranSeal x={300} y={250} o={seal} s={0.85} refText="الحجر ٤٢" />
          {both}
        </g>
      }
    />
  );
};

// ─── c4-s8: عداوة قديمة على خط الزمن، وتحذير صريح من القرآن ───
const Warning: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const line = prog(t, 0.05, 0.9);
  const run = prog(t, at(tl, "عداوة") - 0.05, at(tl, "قديمة") + 0.3);
  const old = pop(t, at(tl, "قديمة"));
  const seal = pop(t, at(tl, "القرآن"));
  const warn = prog(t, at(tl, "يحذرنا") - 0.05, at(tl, "يحذرنا") + 0.5, easeOut);
  const ring = prog(t, at(tl, "صريحا") - 0.05, end(tl, "صريحا") + 0.3);
  const cam = camPath(t, NEUTRAL, [
    // «ومن هنا نفهم»: من الصفحتين إلى بداية الخط وهو يُرسم
    { a: 0.2, b: at(tl, "عداوة") - 0.1, cx: 1380, cy: 560, s: 1.1 },
    { a: at(tl, "عداوة") - 0.1, b: at(tl, "قديمة") + 0.3, cx: 900, cy: 540, s: 1.0 },
    { a: at(tl, "يحذرنا") - 0.3, b: at(tl, "يحذرنا") + 0.4, cx: 520, cy: 520, s: 1.12 },
  ]);
  const both = (
    <g>
      <path d="M1740 600 C1400 592 1200 608 960 600 C700 592 450 608 200 600" fill="none" stroke={C.ink} strokeWidth={4} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - line} />
      <path d="M1740 640 C1400 632 1200 648 960 640 C700 632 450 648 260 640" fill="none" stroke={EMBER} strokeWidth={6} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - run} strokeLinecap="round" />
    </g>
  );
  return (
    <Book
      id="c48"
      t={t}
      dur={dur}
      exit={exit}
      cam={cam}
      R={
        <g>
          {p.head ? <ChapterHead label={p.head} /> : null}
          {both}
          <Word x={1580} y={710} size={48} p={old} font="tajawal" weight={700} color={EMBER}>
            قديمة
          </Word>
          <Word x={1300} y={540} size={44} p={pop(t, at(tl, "عداوة"))} font="tajawal" weight={500} color={C.inkSoft}>
            عداوة الشيطان للإنسان
          </Word>
        </g>
      }
      L={
        <g>
          {both}
          <QuranSeal x={420} y={300} o={seal} s={0.9} />
          <g opacity={warn} transform={`translate(0 ${(1 - warn) * -30})`}>
            <path d="M320 470 H600 V560 L460 600 L320 560 Z" fill={C.ribbon} stroke={C.ink} strokeWidth={3} />
            <SText x={460} y={540} size={56} font="tajawal" weight={700} color={C.page}>
              تحذير
            </SText>
          </g>
          <Ink d="M300 500 C300 440 620 430 640 500 C660 590 300 650 280 560 C270 520 290 500 300 500" w={4} p={ring} c={C.gold} />
          <Word x={460} y={680} size={40} p={ring} font="tajawal" weight={700} color={C.ink}>
            صريح
          </Word>
        </g>
      }
    />
  );
};

export const HZ_SCENES_B: Record<string, React.FC<HzProps>> = {
  clay: Clay,
  steps: Steps,
  catalog: Catalog,
  knowledge: Knowledge,
  honor: Honor,
  comply: Comply,
  sort: Sort,
  scale: Scale,
  enmity: Enmity,
  authority: Authority,
  warning: Warning,
};
