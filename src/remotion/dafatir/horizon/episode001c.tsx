/**
 * مشاهد «خط الأفق» للحلقة 001 — الفصلان 5 و6 (الدفعة البصرية الثالثة) — `production-plan.md` والأمر 011.
 * لا يظهر آدم ولا زوجه ولا إبليس بهيئة أو ظل، ولا تُرسم شجرة على أنها شجرة القصة، ولا تُجسَّد الجنة ولا الهبوط،
 * ولا يُحدَّد موضع الهبوط ولا تاريخه. الأمر والنهي والوسوسة والتوبة حدودٌ وخطوط وكلمات على الصفحة.
 */
import React from "react";
import { at, end, type Timeline } from "./timeline";
import { C, Ink, easeOut, mix, prog, rng } from "./kit";
import { Book, ChapterHead, DateRibbon, NEUTRAL, Pin, QuranSeal, SText, WriteIn, camPath, type Cam, type Exit } from "./book";
import { BoundaryMark, ring } from "../lib/compare";
import { TreeLeaf } from "../lib/drawings";
import { Strike, Word } from "../lib/text";
/** حدّ النهي في هذه الحلقة: تسميته «شجرة معينة» (لا يُرسم نوعها) */
const Forbidden: React.FC<Omit<React.ComponentProps<typeof BoundaryMark>, "labelText">> = (props) => <BoundaryMark {...props} labelText="شجرة معينة" />;

export type HzProps = { t: number; tl: Timeline; dur: number; exit: Exit; from?: Cam; p: Record<string, string | undefined> };
const EMBER = "#B23A1E";
const GOLD_D = "#A8803A";
const pop = (t: number, a: number, d = 0.45) => prog(t, a - 0.05, a - 0.05 + d, easeOut);
/** دائرة مرسومة باليد حول نقطة */

/** علامة النهي: ✗ داخل دائرة، ويحيط بها حدّ «عدم الاقتراب» المتقطع؛ breach يفتح ثغرة في الحد */

// ─── c5-s1: الإباحة واسعة، والنهي علامة واحدة يحيط بها حدّ «لا تقربا» (لا جنة مرسومة ولا شجرة) ───
const Permit: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const pair = pop(t, at(tl, "زوجه"));
  const jannah = pop(t, at(tl, "الجنة"));
  const ibaha = prog(t, at(tl, "وأباح") - 0.05, at(tl, "وأباح") + 0.7);
  const g0 = at(tl, "يأكلا") - 0.1;
  const g1 = end(tl, "منها");
  const nahy = prog(t, at(tl, "ونهاهما") - 0.05, at(tl, "ونهاهما") + 0.7);
  const mark = prog(t, at(tl, "ونهاهما"), at(tl, "عن") + 0.2, easeOut);
  const bound = prog(t, at(tl, "الاقتراب") - 0.05, end(tl, "الاقتراب") + 0.4);
  const label = pop(t, at(tl, "شجرة"));
  const r = rng(51);
  const ticks = Array.from({ length: 24 }, (_, i) => ({ x: 1100 + (i % 6) * 110 + r() * 24, y: 450 + Math.floor(i / 6) * 105 + r() * 20, a: g0 + (i / 24) * (g1 - g0) }));
  const cam = camPath(t, NEUTRAL, [
    // «لآدم زوجه وأسكنهما الجنة»: إلى الاسمين المكتوبين وكلمة «الجنة» (بعد نافذة ذكر الله)
    { a: Math.max(at(tl, "لآدم"), at(tl, "الله") + 0.75), b: at(tl, "الجنة") + 0.4, cx: 1365, cy: 270, s: 1.3 },
    { a: at(tl, "وأباح") - 0.2, b: g1, cx: 1340, cy: 540, s: 1.08 },
    // «ونهاهما»: «الإباحة» وعلاماتها كاملة بجوار «النهي» (x −30–1710)؛ كان cx 600 فتُقص (ر٢٩)
    { a: at(tl, "ونهاهما") - 0.25, b: at(tl, "الاقتراب") + 0.2, cx: 840, cy: 520, s: 1.1 },
  ]);
  const R = (
    <g>
      {p.head ? <ChapterHead label={p.head} /> : null}
      <Word x={1365} y={225} size={56} p={pair} color={C.ink}>
        آدم وزوجه
      </Word>
      <Word x={1365} y={275} size={36} p={jannah} font="tajawal" weight={700} color={GOLD_D}>
        الجنة
      </Word>
      <WriteIn id="pm-i" x={1365} y={385} size={84} p={ibaha} label="الإباحة" />
      {ticks.map((k, i) => {
        const q = prog(t, k.a, k.a + 0.3, easeOut);
        return <Ink key={i} d={`M${k.x - 18} ${k.y} L${k.x - 4} ${k.y + 16} L${k.x + 22} ${k.y - 16}`} w={6} p={q} c={C.gold} />;
      })}
      {/* القائمة مفتوحة من جانبها: لا حدّ يغلق الإباحة */}
      <Ink d="M1720 380 V850" w={3} p={ibaha} c={C.gold} opacity={0.6} />
      <SText x={1060} y={860} size={56} o={prog(t, g1, g1 + 0.4)} color={C.gold}>
        …
      </SText>
    </g>
  );
  const L = (
    <g>
      <WriteIn id="pm-n" x={560} y={250} size={84} p={nahy} label="النهي" />
      <Forbidden x={560} y={520} mark={mark} bound={bound} label={label} />
    </g>
  );
  return <Book id="c51" t={t} dur={dur} exit={exit} cam={cam} R={R} L={L} />;
};

// ─── c5-s2: بطاقة فهرسة «نوع الشجرة»: الخانة فارغة، والاحتمالات تُكتب وتُشطب، ثم تنقلب البطاقة على «العبرة» ───
const Species: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const card = prog(t, 0.05, 0.6, easeOut);
  const seal = pop(t, at(tl, "القرآن"));
  const blank = prog(t, at(tl, "نوع") - 0.05, at(tl, "الشجرة") + 0.3);
  const guesses = [
    // الأمر 019 (E3): الكلمات أعلى ومتباعدة، والختم أسفلها بلا تداخل
    { w: "تفاح", x: 1590, a: at(tl, "تفاح") },
    { w: "تين", x: 1400, a: at(tl, "تين") },
    // مسافة أوسع بين الكلمتين (لا تنضم «غير ذلك» تحت خط الشطب)
    { w: "غير\u2002ذلك", x: 1165, a: at(tl, "غير") },
  ];
  const noJazm = pop(t, at(tl, "نجزم"));
  // V9: «فالعبرة ليست في معرفة نوع الشجرة»: البطاقة تنقلب على «العبرة»؛ «وإنما… أمره ونهيه، وما ترتب على مخالفته»: سطران يُكتبان
  const flip = prog(t, at(tl, "فالعبرة") - 0.15, at(tl, "فالعبرة") + 0.45, (x) => x * x * (3 - 2 * x));
  const ibra = pop(t, at(tl, "فالعبرة") + 0.3);
  const story = pop(t, at(tl, "وإنما"));
  const amr = pop(t, at(tl, "أمره"));
  const result = pop(t, at(tl, "ترتب"));
  const sx = Math.cos(Math.PI * flip);
  const front = sx > 0;
  const cx = 1370;
  const cam = camPath(t, NEUTRAL, [
    // «ولم يسمّ القرآن الكريم»: إلى ختم «لم يسمّها»، ثم «نوع تلك الشجرة»: إلى الخانة الفارغة وهي تُخطّ
    { a: at(tl, "القرآن") - 0.2, b: at(tl, "الكريم") + 0.3, cx: 1150, cy: 300, s: 1.3 },
    { a: at(tl, "نوع") - 0.1, b: at(tl, "الشجرة") + 0.4, cx: 1250, cy: 470, s: 1.32 },
    { a: at(tl, "نجزم") - 0.25, b: at(tl, "نجزم") + 0.3, cx: 1370, cy: 640, s: 1.3 },
    // الاحتمالات الثلاثة: كل كلمة لحظة كتابتها وشطبها، على ترتيبها من اليمين
    { a: at(tl, "تفاح") - 0.3, b: at(tl, "تفاح") + 0.3, cx: 1560, cy: 580, s: 1.45 },
    { a: at(tl, "تين") - 0.3, b: at(tl, "تين") + 0.3, cx: 1400, cy: 580, s: 1.45 },
    { a: at(tl, "غير") - 0.3, b: at(tl, "غير") + 0.3, cx: 1190, cy: 590, s: 1.45 },
    { a: at(tl, "فالعبرة") - 0.2, b: at(tl, "الشجرة", 2) + 0.3, cx: 1370, cy: 480, s: 1.22 },
    { a: Math.max(at(tl, "أمره") - 0.2, end(tl, "الله") + 0.3), b: end(tl, "مخالفته") + 0.3, cx: 1370, cy: 600, s: 1.2 },
  ]);
  const R = (
    <g>
      {p.head ? <ChapterHead label={p.head} /> : null}
      <g opacity={card} transform={`translate(${cx} 520) scale(${Math.max(0.02, Math.abs(sx))} 1) translate(${-cx} -520)`}>
        <rect x={cx - 380} y={300} width={760} height={440} rx={14} fill="#FFFAF0" stroke={C.ink} strokeWidth={4} />
        <rect x={cx - 380} y={300} width={760} height={70} rx={14} fill={front ? C.ribbon : C.gold} opacity={0.9} />
        {front ? (
          <g>
            <SText x={cx} y={348} size={34} font="tajawal" weight={700} color={C.page}>
              بطاقة فهرسة
            </SText>
            <SText x={cx + 340} y={460} size={52} font="tajawal" weight={700} anchor="start" color={C.inkText}>
              نوع الشجرة:
            </SText>
            <Ink d={`M${cx + 40} 470 H${cx - 340}`} w={3} p={blank} c={C.inkSoft} />
            {guesses.map((g, i) => {
              const q = pop(t, g.a);
              const st = prog(t, g.a + 0.3, g.a + 0.65);
              return (
                <g key={i}>
                  <Word x={g.x} y={575} size={60} p={q} font="tajawal" weight={700} color={C.inkText}>
                    {g.w}
                  </Word>
                  <Strike x1={g.x + 66 + (i === 2 ? 64 : 0)} x2={g.x - 66 - (i === 2 ? 64 : 0)} y={556} p={st} w={6} />
                </g>
              );
            })}
            <g opacity={noJazm} transform={`rotate(-4 ${cx} 690) translate(${cx} 690) scale(${1 + 0.5 * (1 - noJazm)}) translate(${-cx} -690)`}>
              <rect x={cx - 160} y={652} width={320} height={78} rx={8} fill="rgba(215,55,43,0.1)" stroke={C.ribbon} strokeWidth={6} />
              <SText x={cx} y={708} size={54} font="tajawal" weight={800} color={C.ribbon}>
                لا نجزم
              </SText>
            </g>
          </g>
        ) : (
          <g>
            {/* D143: «ليست في معرفة نوع الشجرة» تُقرأ لحظة نطقها، ويُخط تحتها عند «نوع» */}
            <SText x={cx} y={348} size={34} font="tajawal" weight={700} color={C.page} o={pop(t, at(tl, "ليست"))}>
              ليست في نوع الشجرة
            </SText>
            <Ink d={`M${cx + 150} 366 H${cx - 150}`} w={3} p={prog(t, at(tl, "نوع", 2) - 0.05, at(tl, "نوع", 2) + 0.7)} c={C.page} />
            <SText x={cx} y={490} size={110} o={ibra} color={C.ink}>
              العبرة
            </SText>
            <Ink d={`M${cx + 160} 530 H${cx - 160}`} w={5} p={story} c={C.gold} />
            <Word x={cx} y={620} size={60} p={amr} font="tajawal" weight={700} color={C.inkText}>
              الأمر والنهي
            </Word>
            <Word x={cx} y={700} size={46} p={result} font="tajawal" weight={500} color={C.ribbon}>
              عاقبة المخالفة
            </Word>
          </g>
        )}
      </g>
      <QuranSeal x={cx - 290} y={200} o={seal * (front ? 1 : 0)} s={0.7} refText="لم يسمّها" />
    </g>
  );
  return <Book id="c52" t={t} dur={dur} exit={exit} cam={cam} R={R} />;
};

// ─── c5-s3: تحذير من عداوة الشيطان (امتداد لختام الفصل الرابع)، ثم الآية ───
const WarnRecall: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const adam = pop(t, at(tl, "عليه"));
  const warn = prog(t, at(tl, "عداوة") - 0.05, at(tl, "عداوة") + 0.5, easeOut);
  const R = (
    <g>
      {p.head ? <ChapterHead label={p.head} /> : null}
      <Word x={1365} y={340} size={44} p={adam} font="tajawal" weight={500} color={C.inkSoft}>
        آدم عليه السلام
      </Word>
      <g opacity={warn} transform={`translate(0 ${(1 - warn) * -40})`}>
        <path d="M1185 420 H1545 V540 L1365 590 L1185 540 Z" fill={C.ribbon} stroke={C.ink} strokeWidth={3} />
        <SText x={1365} y={505} size={60} font="tajawal" weight={800} color={C.page}>
          تحذير
        </SText>
      </g>
      <Word x={1365} y={680} size={46} p={pop(t, at(tl, "الشيطان"))} font="tajawal" weight={700} color={EMBER}>
        عداوة الشيطان
      </Word>
    </g>
  );
  return <Book id="c53" t={t} dur={dur} exit={exit} cam={NEUTRAL} R={R} />;
};

// ─── c5-s4: الوسوسة خطٌ متموج يقترب من «آدم وزوجه» ويلتف بهما نحو حدّ النهي، والوعدان الكاذبان يُكتبان ثم يُشطبان ───
const WHISPER = "M120 300 C220 260 260 360 340 330 C430 300 420 220 520 240 C620 260 600 350 700 340 C800 330 830 270 900 300";
const TOWARD = "M1250 470 C1150 520 1040 600 900 640 C800 670 720 650 690 600";
const Whisper: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const pair = pop(t, at(tl, "آدم"));
  const forb = prog(t, 0.05, 0.6);
  const w0 = prog(t, at(tl, "وسوس") - 0.05, at(tl, "وزوجه") + 0.2);
  // V9: «وزعم… لا يكونا ملكين أو من الخالدين» ثم «وبذلك سعى إلى إيقاعهما»
  const pull = prog(t, at(tl, "سعى") - 0.05, at(tl, "فيما") + 0.1);
  const zaam = pop(t, at(tl, "وزعم"));
  const p1 = pop(t, at(tl, "ملكين"));
  const p2 = pop(t, at(tl, "الخالدين"));
  const strike = prog(t, end(tl, "الخالدين") + 0.15, end(tl, "الخالدين") + 0.7);
  // D143: «وزعم أن النهي عن الشجرة…» — خط زعمه يمتد من «زعم:» إلى حد النهي عند «النهي»، والحد ينبض عند «الشجرة»
  const claim = prog(t, at(tl, "النهي") - 0.05, at(tl, "النهي") + 0.8, easeOut);
  const pulse = prog(t, at(tl, "الشجرة") - 0.05, at(tl, "الشجرة") + 0.9);
  const cam = camPath(t, NEUTRAL, [
    { a: at(tl, "وسوس") - 0.2, b: at(tl, "وزوجه") + 0.2, cx: 900, cy: 480, s: 1.06 },
    // «وزعم… الخالدين»: دائرة النهي (x≈410–710) كاملة مع الوعدين (ر٢٩)
    { a: at(tl, "وزعم") - 0.25, b: end(tl, "الخالدين") + 0.4, cx: 1180, cy: 560, s: 1.1 },
    // «وبذلك سعى إلى إيقاعهما فيما نهاهما»: يتبع الخط المتقطع نحو حدّ النهي (قبل نافذة ذكر الله)
    { a: at(tl, "سعى") - 0.1, b: Math.min(at(tl, "فيما") + 0.3, at(tl, "الله") - 0.3), cx: 780, cy: 580, s: 1.14 },
  ]);
  const promise = (x: number, y: number, txt: string, q: number) => (
    <g opacity={q}>
      <rect x={x - 190} y={y - 56} width={380} height={92} rx={46} fill={C.page} stroke={EMBER} strokeWidth={4} strokeDasharray="12 8" />
      <SText x={x} y={y + 6} size={46} font="tajawal" weight={700} color={EMBER}>
        {txt}
      </SText>
    </g>
  );
  const both = (
    <g>
      <path d={WHISPER} fill="none" stroke={EMBER} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - w0} opacity={0.85 * (1 - 0.5 * pull)} />
      <path d={TOWARD} fill="none" stroke={EMBER} strokeWidth={6} strokeLinecap="round" strokeDasharray="10 10" opacity={0.85 * pull} />
      <path d="M1250 600 C1050 520 900 520 735 560" fill="none" stroke={EMBER} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - claim} opacity={0.8 * (1 - pull)} />
    </g>
  );
  const R = (
    <g>
      {p.head ? <ChapterHead label={p.head} /> : null}
      <Word x={1365} y={460} size={72} p={pair} color={C.ink}>
        آدم وزوجه
      </Word>
      <SText x={1365} y={600} size={40} font="tajawal" weight={700} color={EMBER} o={zaam}>
        زعم:
      </SText>
      {promise(1365, 700, "ملكين", p1)}
      {promise(1365, 820, "من الخالدين", p2)}
      <Strike x1={1560} x2={1170} y={704} p={strike} w={7} />
      <Strike x1={1560} x2={1170} y={824} p={prog(strike, 0.3, 1)} w={7} />
      {both}
    </g>
  );
  const L = (
    <g>
      <Forbidden x={560} y={560} mark={forb} bound={forb} />
      <ellipse cx={560} cy={560} rx={170 + 60 * pulse} ry={170 + 60 * pulse} fill="none" stroke={EMBER} strokeWidth={5} opacity={pulse > 0 && pulse < 1 ? 0.7 * (1 - pulse) : 0} />
      {both}
    </g>
  );
  return <Book id="c54" t={t} dur={dur} exit={exit} cam={cam} R={R} L={L} />;
};

// ─── c5-s5: «ثم وقع ما حذرهما الله منه»: الحد المتقطع ينفتح فيه ثغرة (بلا تصوير للأكل ولا للشجرة) ───
const Breach: React.FC<HzProps> = ({ t, tl, dur, exit }) => {
  const br = prog(t, at(tl, "وقع") - 0.05, at(tl, "وقع") + 0.5);
  // V8: «…فأكلا من الشجرة» صارت في الجملة نفسها (معنى الأعراف 22 بعد حذف بطاقتها): الكادر ينفتح على الصفحتين
  // ويُكتب الفعل على اليمنى لحظة نطقه، مقابل الحد المخروق.
  // V9: «ثم أكلا من الشجرة. وأخبرنا القرآن أن سوءاتهما بدت لهما، فشرعا يستران أنفسهما من ورق الجنة. لقد وقعت المخالفة…
  // لكن القصة لم تتوقف عند هذا الحد»: ختم القرآن عند ذكره، وأوراق تنزل عند «ورق الجنة» (لا تُصوَّر أجساد)،
  // و«المخالفة» تحت الحد المخروق، وسهم يمضي عند «لم تتوقف».
  const verb = ["فأكلا", "أكلا"].find((v) => tl.words.some((w) => w.w.startsWith(v)));
  const ate = Boolean(verb);
  const a = verb ? at(tl, verb) : 0;
  const v9 = tl.words.some((w) => w.w.startsWith("ورق"));
  const seal = v9 ? pop(t, at(tl, "القرآن")) : 0;
  // D143: الورقة الأولى عند «فشرعا» (بدء الستر) لا عند «يستران»، والحد المخروق ينبض عند «بدت» (ظهرت العاقبة)
  const leaves = v9 ? [tl.words.some((w) => w.w.startsWith("فشرعا")) ? at(tl, "فشرعا") : at(tl, "يستران"), at(tl, "يستران"), at(tl, "أنفسهما"), at(tl, "ورق")].map((x) => prog(t, x - 0.05, x + 0.6, easeOut)) : [];
  const shown = v9 && tl.words.some((w) => w.w.startsWith("بدت")) ? prog(t, at(tl, "بدت") - 0.05, at(tl, "بدت") + 0.9) : 0;
  const sin = v9 ? pop(t, at(tl, "المخالفة")) : 0;
  const goOn = v9 ? prog(t, at(tl, "تتوقف") - 0.1, end(tl, "الحد") + 0.3, easeOut) : 0;
  const cam = !ate
    ? { cx: 700, cy: 520, s: 1.08 }
    : camPath(t, { cx: 700, cy: 520, s: 1.08 }, [
        { a: a - 0.25, b: a + 0.55, cx: 960, cy: 530, s: 1 },
        ...(v9
          ? [
              // «ورق الجنة»: إلى الأوراق على الصفحة اليمنى
              { a: at(tl, "يستران") - 0.2, b: at(tl, "الجنة") + 0.4, cx: 1180, cy: 560, s: 1.05 },
              // «لقد وقعت المخالفة»: إلى الحد المخروق (قبل نافذة ذكر الله)
              { a: at(tl, "لقد") - 0.1, b: Math.min(at(tl, "المخالفة") + 0.5, at(tl, "الله") - 0.3), cx: 700, cy: 540, s: 1.12 },
              // «لكن القصة لم تتوقف»: الصفحتان والسهم يمضي
              { a: at(tl, "لكن") - 0.1, b: end(tl, "الحد") + 0.4, ...NEUTRAL },
            ]
          : []),
      ]);
  const w1 = ate ? prog(t, a - 0.05, a + 0.5, easeOut) : 0;
  const w2 = ate ? prog(t, at(tl, "الشجرة") - 0.05, at(tl, "الشجرة") + 0.45, easeOut) : 0;
  const LEAVES: [number, number, number][] = [[1500, 660, -24], [1250, 680, 18], [1400, 770, 64], [1180, 780, -50]];
  return (
    <Book id="c55" t={t} dur={dur} exit={exit} cam={cam}
      L={
        <g>
          <Forbidden x={560} y={520} mark={1} bound={1} breach={br} />
          <ellipse cx={560} cy={520} rx={170 + 60 * shown} ry={170 + 60 * shown} fill="none" stroke={EMBER} strokeWidth={5} opacity={shown > 0 && shown < 1 ? 0.7 * (1 - shown) : 0} />
          {v9 ? (
            <Word x={560} y={860} size={52} p={sin} font="tajawal" weight={700} color={EMBER}>
              المخالفة
            </Word>
          ) : null}
        </g>
      }
      R={ate ? (
        <g>
          <Word x={1365} y={500} size={72} p={w1} color={C.ink}>{verb}</Word>
          <Word x={1365} y={590} size={44} p={w2} font="tajawal" weight={700} color={C.inkSoft}>من الشجرة</Word>
          {v9 ? <QuranSeal x={1610} y={250} o={seal} s={0.8} /> : null}
          {LEAVES.map(([x, y, r], i) => {
            const q = leaves[i] ?? 0;
            return <TreeLeaf key={i} q={q} x={x} y={y - 120 * (1 - q)} rot={r + 30 * (1 - q)} s={0.8} />;
          })}
          {v9 ? <Ink d="M1700 875 H1100 M1132 850 L1100 875 L1132 900" w={7} p={goOn} c={C.gold} /> : null}
        </g>
      ) : undefined} />
  );

};

// ─── c5-s8: موقفان: خطٌ يعلو ويمضي (استكبر وأصر)، وخطٌ يعود (تاب وأناب)، ثم باب التوبة مفتوح ───
const Stances: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const diff = pop(t, at(tl, "الفرق"));
  const iblis = pop(t, at(tl, "إبليس"));
  const rise = prog(t, at(tl, "استكبر") - 0.05, at(tl, "استكبر") + 0.6);
  const persist = prog(t, at(tl, "وأصر") - 0.05, at(tl, "وأصر") + 0.7);
  const adam = pop(t, at(tl, "آدم"));
  const away = prog(t, at(tl, "تاب") - 0.05, at(tl, "تاب") + 0.4);
  const back = prog(t, at(tl, "وأناب") - 0.05, at(tl, "وأناب") + 0.6);
  // V9: «فوقوع الإنسان في الذنب»: الباب ونقطة الإنسان؛ «ليس نهاية الطريق»: الباب ينفتح؛ «ما دام يرجع»: تعود النقطة إليه
  const door = prog(t, at(tl, "فوقوع") - 0.05, at(tl, "الذنب") + 0.3);
  const open = prog(t, at(tl, "نهاية") - 0.1, at(tl, "نهاية") + 0.6, easeOut);
  const walk = prog(t, at(tl, "يرجع") - 0.1, at(tl, "يرجع") + 0.15);
  const glow = prog(t, at(tl, "صادقا") + 0.25, at(tl, "صادقا") + 0.7);
  const cam = camPath(t, NEUTRAL, [
    // «يظهر الفرق بين موقفين»: إلى العنوان وهو يُكتب
    { a: at(tl, "الفرق") - 0.2, b: at(tl, "موقفين") + 0.3, cx: 1365, cy: 270, s: 1.3 },
    // «فإبليس»: عنوان «الفرق بين الموقفين» ورأس الفصل كاملان مع «وأصر» (x 150–1730) لا مقصوص (ر٢٩)
    { a: at(tl, "إبليس") - 0.3, b: at(tl, "إبليس") + 0.3, cx: 940, cy: 520, s: 1.22 },
    // «وآدم»: الموقفان كاملان (x 310–1890)؛ كان cx 1370 فيُقص «إبليس/استكبر» (ر٢٩)
    { a: at(tl, "آدم") - 0.35, b: at(tl, "آدم") + 0.3, cx: 1100, cy: 520, s: 1.22 },
    { a: end(tl, "وأناب") + 0.1, b: end(tl, "وأناب") + 0.8, ...NEUTRAL },
    // «فوقوع الإنسان في الذنب»: لا يُقص «إبليس» و«استكبر» عند الحافة اليسرى (ر٢٩)
    { a: at(tl, "فوقوع") - 0.3, b: at(tl, "الذنب") + 0.3, cx: 1100, cy: 520, s: 1.12 },
    // «ليس نهاية الطريق… يرجع»: يتبع النقطة وهي تعود إلى الباب (قبل نافذة «ربه»)؛ يُرى x 240–1720 (ر٢٩)
    { a: at(tl, "ليس") - 0.2, b: Math.min(at(tl, "يرجع") + 0.3, at(tl, "ربه") - 0.3), cx: 980, cy: 590, s: 1.3 },
  ]);
  // الباب على الصفحة اليمنى: إطار ثابت ومصراع يدور على مفصله الأيمن
  const dx = 1420;
  const leafW = 170 * Math.cos((open * Math.PI) / 2.6);
  const R = (
    <g>
      {p.head ? <ChapterHead label={p.head} /> : null}
      <Word x={1365} y={225} size={42} p={diff} font="tajawal" weight={700} color={C.inkSoft}>
        الفرق بين موقفين
      </Word>
      <g opacity={1 - door}>
        <Word x={1365} y={330} size={58} p={adam} color={C.ink}>
          آدم عليه السلام
        </Word>
        <circle cx={1580} cy={500} r={11 * adam} fill={C.ink} />
        <Ink d="M1580 500 C1470 498 1340 504 1190 510" w={9} p={away} />
        <Ink d="M1190 510 C1110 514 1090 590 1178 600 C1300 612 1430 592 1546 570" w={9} p={back} c={C.gold} />
        <Word x={1460} y={690} size={52} p={away} font="tajawal" weight={700} color={C.ink}>
          تاب
        </Word>
        <Word x={1250} y={690} size={52} p={back} font="tajawal" weight={700} color="#A8803A">
          وأناب
        </Word>
      </g>
      <g opacity={door}>
        <rect x={dx - 170} y={370} width={340} height={480} fill="#2B1E14" opacity={0.08} />
        <rect x={dx - 170} y={370} width={340} height={480} fill={C.sand} opacity={0.75 * open + 0.25 * glow} />
        <path d={`M${dx + 170} 370 L${dx + 170 - leafW} ${370 - 30 * open} L${dx + 170 - leafW} ${850 + 30 * open} L${dx + 170} 850 Z`} fill="#8B5E3C" stroke={C.ink} strokeWidth={4} />
        <Ink d={`M${dx - 190} 860 V350 H${dx + 190} V860`} w={7} p={door} />
        <circle cx={mix(1000, dx, walk)} cy={mix(720, 700, walk)} r={13 * prog(t, at(tl, "الذنب") - 0.05, at(tl, "الذنب") + 0.3)} fill={C.ink} />
        <Word x={dx} y={318} size={44} p={open} font="tajawal" weight={700} color={C.ink}>
          ليس نهاية الطريق
        </Word>
      </g>
    </g>
  );
  const L = (
    <g>
      <Word x={560} y={330} size={58} p={iblis} color={EMBER}>
        إبليس
      </Word>
      <circle cx={760} cy={620} r={11 * iblis} fill={EMBER} />
      <Ink d="M760 620 C700 600 660 520 620 440" w={9} p={rise} c={EMBER} />
      <Ink d="M620 440 C590 380 480 400 300 420 C250 425 210 430 170 432" w={9} p={persist} c={EMBER} opacity={0.75} />
      <Word x={640} y={720} size={52} p={rise} font="tajawal" weight={700} color={EMBER}>
        استكبر
      </Word>
      <Word x={400} y={720} size={52} p={persist} font="tajawal" weight={700} color={EMBER}>
        وأصر
      </Word>
    </g>
  );
  return <Book id="c58" t={t} dur={dur} exit={exit} cam={cam} R={R} L={L} />;
};

// ═══════════════ الفصل السادس ═══════════════

// ─── c6-s2: على الأفق: مستقر ومتاع إلى حين، وفوقه الحياة، وتحته الموت، ومنه الإخراج (الأعراف 24–25) ───
const EarthWords: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const seal = pop(t, at(tl, "الأعراف"));
  const hz = prog(t, at(tl, "الأرض") - 0.1, at(tl, "الأرض") + 0.8);
  const w = [at(tl, "مستقرا"), at(tl, "ومتاعا"), at(tl, "إلى", 1)].map((a) => pop(t, a));
  const limit = prog(t, at(tl, "حين") - 0.05, at(tl, "حين") + 0.5);
  const life = pop(t, at(tl, "يحيا"));
  const death = pop(t, at(tl, "ويموتون"));
  const out = prog(t, at(tl, "إخراجهم") - 0.1, at(tl, "إخراجهم") + 0.7);
  const cam = camPath(t, NEUTRAL, [
    // «وفي سورة الأعراف»: إلى ختمها، ثم «في الأرض»: إلى الأفق وهو يُرسم
    { a: at(tl, "سورة") - 0.1, b: Math.min(at(tl, "الأعراف") + 0.5, at(tl, "الله") - 0.3), cx: 1560, cy: 300, s: 1.3 },
    { a: end(tl, "الله") + 0.3, b: at(tl, "الأرض") + 0.6, cx: 1300, cy: 500, s: 1.1 },
    { a: at(tl, "ومتاعا") - 0.2, b: at(tl, "حين") + 0.3, cx: 900, cy: 520, s: 1.0 },
    { a: at(tl, "يحيا") - 0.2, b: at(tl, "إخراجهم") + 0.4, cx: 960, cy: 600, s: 1.04 },
  ]);
  const both = (
    <g>
      <rect x={140} y={560} width={1660} height={380} fill="#D9C29A" opacity={0.5 * hz} />
      <path d="M1740 560 C1400 552 1200 568 960 560 C700 552 450 568 200 560" fill="none" stroke={C.ink} strokeWidth={5} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - hz} />
      <Word x={1500} y={510} size={64} p={w[0]!} color={C.ink}>
        مستقر
      </Word>
      <Word x={1080} y={510} size={64} p={w[1]!} color={C.ink}>
        متاع
      </Word>
      <Word x={620} y={510} size={64} p={w[2]!} color={C.ink}>
        إلى حين
      </Word>
      {/* «إلى حين»: الخط ينتهي عند حد */}
      <Ink d="M470 470 C400 470 330 472 280 470" w={4} p={limit} c={C.inkSoft} />
      <Ink d="M272 430 V510" w={7} p={limit} c={C.ribbon} />
      <Word x={1365} y={340} size={54} p={life} font="tajawal" weight={700} color="#A8803A">
        حياة
      </Word>
      <Word x={1365} y={760} size={54} p={death} font="tajawal" weight={700} color={C.inkSoft}>
        موت
      </Word>
      <Ink d="M760 860 C760 780 760 680 760 560 M730 600 L760 560 L790 600" w={6} p={out} c={C.gold} />
      <Word x={620} y={760} size={44} p={out} font="tajawal" weight={700} color={C.ink}>
        إخراج
      </Word>
    </g>
  );
  return (
    <Book
      id="c62"
      t={t}
      dur={dur}
      exit={exit}
      cam={cam}
      R={
        <g>
          {p.head ? <ChapterHead label={p.head} /> : null}
          <QuranSeal x={1610} y={250} o={seal} s={0.85} refText="الأعراف ٢٤–٢٥" />
          {both}
        </g>
      }
      L={both}
    />
  );
};

// ─── c6-s3: نقطة التحول: أفق الدفتر يمتد خارج الصفحات إلى أفق الأرض، فتتصل قصة آدم بالتاريخ البشري ───
const Bridge: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const inner = 1;
  const extend = prog(t, at(tl, "قصة") + 0.2, at(tl, "بتاريخ") + 0.3, easeOut);
  const ground = prog(t, at(tl, "بتاريخ") - 0.05, at(tl, "البشري") + 0.6);
  const lbl = pop(t, at(tl, "البشري"));
  const khabar = pop(t, at(tl, "قصة"));
  const earth = pop(t, at(tl, "الأرض"));
  const cam = camPath(t, NEUTRAL, [{ a: at(tl, "قصة"), b: at(tl, "الأرض") + 0.6, cx: 960, cy: 600, s: 0.5 }]);
  const strata = ["#5A4030", "#4E3628", "#432E22", "#38261C"];
  const under = (
    <g>
      <defs>
        <linearGradient id="c63-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.dusk} stopOpacity={0} />
          <stop offset="1" stopColor={C.ember} stopOpacity={0.35} />
        </linearGradient>
      </defs>
      <rect x={-1700} y={-400} width={5320} height={1040} fill="url(#c63-sky)" opacity={ground} />
      {strata.map((c, i) => (
        <path key={i} d={`M-1700 ${640 + i * 150} C-600 ${630 + i * 150 + (i % 2 ? 14 : -14)} 1400 ${650 + i * 150} 3620 ${640 + i * 150} V2200 H-1700 Z`} fill={c} opacity={ground} />
      ))}
      <path d="M-1700 640 C-900 636 -200 644 150 640" fill="none" stroke={C.sand} strokeWidth={6} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - extend} />
      <path d="M1770 640 C2200 636 2900 644 3620 640" fill="none" stroke={C.sand} strokeWidth={6} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - extend} />
    </g>
  );
  const both = <path d="M1770 640 C1400 634 1200 646 960 640 C700 634 450 646 150 640" fill="none" stroke={C.ink} strokeWidth={5} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - inner} />;
  return (
    <Book
      id="c63"
      t={t}
      dur={dur}
      exit={exit}
      cam={cam}
      under={under}
      R={
        <g>
          {p.head ? <ChapterHead label={p.head} /> : null}
          {both}
          <Word x={1365} y={520} size={70} p={khabar} color="#A8803A">
            قصة آدم
          </Word>
          <Word x={1365} y={590} size={36} p={khabar} font="tajawal" weight={500} color={C.inkSoft}>
            عليه السلام
          </Word>
        </g>
      }
      L={both}
      over={
        <g>
          <SText x={2330} y={900} size={120} font="tajawal" weight={800} color={C.sand} o={lbl}>
            تاريخ البشرية
          </SText>
          <SText x={-400} y={900} size={100} font="tajawal" weight={700} color={C.sand} o={earth * 0.85}>
            على الأرض
          </SText>
        </g>
      }
    />
  );
};

// ─── c6-s4: خريطة بلا معالم: روايات تظهر وتبهت، ودبوس لا يستقر، وشريط تاريخ فارغ… والله أعلم ───
const RUMORS: [number, number, number][] = [
  [420, 360, 70],
  [700, 640, 90],
  [1180, 420, 80],
  [1500, 700, 70],
  [1380, 300, 55],
];
const NoMap: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const map = prog(t, 0.05, 0.8);
  const r0 = at(tl, "روايات") - 0.1;
  const r1 = end(tl, "مختلفة") + 0.3;
  const fadeR = prog(t, at(tl, "نعلم") - 0.05, at(tl, "يحدد") + 0.3);
  const pin = prog(t, at(tl, "نصا") - 0.1, at(tl, "صريحا") + 0.2, easeOut);
  const hover0 = Math.sin(t * 2.4) * 10;
  // V9: «لا ننسب إليه بلدًا أو مكانًا أو زمنًا»: الدبوس (المكان) ثم شريط التاريخ (الزمن) بلا قيمة، و«دون دليل ثابت»: يسكنان جانبًا
  const ribbon = prog(t, at(tl, "زمنا") - 0.1, at(tl, "زمنا") + 0.4, easeOut);
  const dash = prog(t, at(tl, "دون"), at(tl, "دون") + 0.4);
  const aside = prog(t, at(tl, "دليل") - 0.05, end(tl, "ثابت") + 0.3);
  // الدبوس معلق يتردد ولا يستقر، ثم يسكن حين نترك الجزم
  const hover = hover0 * (1 - aside);
  const cam = camPath(t, { cx: 960, cy: 540, s: 1.05 }, [
    // «وأما موضع هبوطه»: الكادر يجول في الخريطة الخالية من المعالم
    { a: at(tl, "موضع") - 0.1, b: r0 - 0.2, cx: 800, cy: 500, s: 1.12 },
    { a: r0 - 0.2, b: r0 + 0.6, cx: 640, cy: 520, s: 1.15 },
    { a: r0 + 0.6, b: r1, cx: 1300, cy: 520, s: 1.15 },
    { a: at(tl, "نعلم") - 0.2, b: at(tl, "نصا"), cx: 1180, cy: 470, s: 1.12 },
    // «يحدد لنا موضع هبوطه»: اقتراب من الدبوس المعلق الذي لا يستقر
    { a: at(tl, "يحدد") - 0.1, b: at(tl, "الجزم") + 0.3, cx: 1180, cy: 400, s: 1.3 },
    // «بلدًا أو مكانًا أو زمنًا»: من الدبوس إلى شريط التاريخ الفارغ
    { a: at(tl, "ننسب") - 0.2, b: at(tl, "زمنا") + 0.4, cx: 1400, cy: 420, s: 1.12 },
    { a: at(tl, "دون") - 0.2, b: end(tl, "ثابت") + 0.4, ...NEUTRAL },
  ]);
  const grid = (
    <g opacity={0.5 * map}>
      {Array.from({ length: 16 }, (_, i) => (
        <line key={`v${i}`} x1={230 + i * 100} x2={230 + i * 100} y1={170} y2={880} stroke={C.inkSoft} strokeWidth={1.5} strokeDasharray="4 8" />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <line key={`h${i}`} x1={200} x2={1730} y1={190 + i * 98} y2={190 + i * 98} stroke={C.inkSoft} strokeWidth={1.5} strokeDasharray="4 8" />
      ))}
    </g>
  );
  const compass = (
    <g opacity={map} transform="translate(330 790)">
      <circle r={56} fill="none" stroke={C.ink} strokeWidth={3} />
      <path d="M0 -70 L12 0 L0 70 L-12 0 Z" fill={C.ink} opacity={0.7} />
      <path d="M-70 0 L0 12 L70 0 L0 -12 Z" fill={C.ink} opacity={0.35} />
    </g>
  );
  const rumors = (
    <g opacity={1 - fadeR}>
      {RUMORS.map(([x, y, r], i) => {
        const a = mix(r0, r1 - 0.3, i / (RUMORS.length - 1));
        const q = prog(t, a, a + 0.4, easeOut);
        return (
          <g key={i} opacity={q}>
            <circle cx={x} cy={y} r={r * (0.7 + 0.3 * q)} fill={C.ribbon} opacity={0.2} />
            <circle cx={x} cy={y} r={r * (0.7 + 0.3 * q)} fill="none" stroke={EMBER} strokeWidth={5} strokeDasharray="12 9" />
            <SText x={x} y={y + 22} size={64} o={q} color={EMBER}>
              ؟
            </SText>
          </g>
        );
      })}
    </g>
  );
  const both = (
    <g>
      {grid}
      {rumors}
    </g>
  );
  return (
    <Book
      id="c64"
      t={t}
      dur={dur}
      exit={exit}
      cam={cam}
      R={
        <g>
          {p.head ? <ChapterHead label={p.head} /> : null}
          {both}
          {/* الدبوس معلق لا يستقر على موضع */}
          <g opacity={pin * (1 - 0.6 * aside)}>
            <line x1={1180} x2={1180} y1={300 + hover} y2={640} stroke={C.ink} strokeWidth={2} strokeDasharray="4 10" />
            <Pin x={1180} y={300 + hover - 30 * (1 - pin)} s={1.3} />
          </g>
          <g opacity={ribbon * (1 - 0.6 * aside)} transform={`translate(0 ${(1 - ribbon) * -60})`}>
            <DateRibbon x={1600} y={300} s={1.1} />
            <SText x={1600} y={470} size={60} o={dash} font="tajawal" weight={700} color={C.inkText}>
              —
            </SText>
          </g>
        </g>
      }
      L={
        <g>
          {both}
          {compass}
        </g>
      }
    />
  );
};

// ─── c6-s5: ما أخبرنا الله به داخل إطار نؤمن به ونثبته، وحدٌّ لا نزيد بعده إلا بدليل ───
const Limit: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const frame = prog(t, 0.05, 0.8);
  const w1 = pop(t, Math.max(at(tl, "نؤمن"), end(tl, "الله") + 0.3));
  const w2 = pop(t, at(tl, "ونثبته"));
  // V9: «أما ما لم يخبرنا به»: حدّ الإطار وما خارجه؛ «فلا نتكلف ادعاء معرفته»: «ادعاء معرفته» يُكتب ويُشطب
  const bar = prog(t, at(tl, "أما") - 0.1, at(tl, "يخبرنا") + 0.2);
  const outside = prog(t, at(tl, "يخبرنا") - 0.05, at(tl, "يخبرنا") + 0.4);
  const claim = pop(t, at(tl, "ادعاء"));
  const strike = prog(t, at(tl, "ادعاء") + 0.25, end(tl, "معرفته") + 0.2);
  const cam = camPath(t, NEUTRAL, [
    // «نؤمن به ونثبته»: اقتراب من الكلمتين داخل الإطار (بعد نافذة ذكر الله)
    { a: Math.max(at(tl, "نؤمن") - 0.2, end(tl, "الله") + 0.3), b: at(tl, "ونثبته") + 0.5, cx: 1365, cy: 480, s: 1.25 },
    { a: at(tl, "أما") - 0.25, b: end(tl, "معرفته") + 0.3, cx: 1100, cy: 560, s: 1.06 },
  ]);
  const R = (
    <g>
      {p.head ? <ChapterHead label={p.head} /> : null}
      <Ink d="M1690 220 H1040 V640 H1690 Z" w={5} p={frame} c={C.gold} />
      <Ink d="M1676 234 H1054 V626 H1676 Z" w={1.8} p={frame} c={C.gold} />
      <SText x={1365} y={300} size={34} font="tajawal" weight={700} color={C.inkSoft} o={frame}>
        ما أخبرنا به
      </SText>
      <Word x={1365} y={430} size={84} p={w1} color={C.ink}>
        نؤمن به
      </Word>
      <Word x={1365} y={560} size={84} p={w2} color={C.ink}>
        ونثبته
      </Word>
      <Ink d="M1720 700 H1010" w={14} p={bar} c={C.gold} />
    </g>
  );
  const L = (
    <g>
      <g opacity={outside}>
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={300} x2={760 - i * 70} y1={330 + i * 60} y2={330 + i * 60} stroke={C.inkSoft} strokeWidth={3} strokeDasharray="6 10" opacity={0.6} />
        ))}
        <SText x={530} y={620} size={40} font="tajawal" weight={500} color={C.inkSoft}>
          ما لم يخبرنا به
        </SText>
      </g>
      <Word x={530} y={770} size={58} p={claim} font="tajawal" weight={700} color={EMBER}>
        ادعاء معرفته
      </Word>
      <Strike x1={720} x2={340} y={748} p={strike} w={7} />
    </g>
  );
  return <Book id="c65" t={t} dur={dur} exit={exit} cam={cam} R={R} L={L} />;
};

export const HZ_SCENES_C: Record<string, React.FC<HzProps>> = {
  permit: Permit,
  species: Species,
  "warn-recall": WarnRecall,
  whisper: Whisper,
  breach: Breach,
  stances: Stances,
  "earth-words": EarthWords,
  bridge: Bridge,
  "no-map": NoMap,
  limit: Limit,
};
