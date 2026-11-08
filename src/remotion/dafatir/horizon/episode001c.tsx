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
    { a: at(tl, "ونهاهما") - 0.25, b: at(tl, "الاقتراب") + 0.2, cx: 600, cy: 520, s: 1.1 },
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
  const flip = prog(t, at(tl, "معرفة") - 0.1, at(tl, "العبرة") - 0.1, (x) => x * x * (3 - 2 * x));
  const ibra = pop(t, at(tl, "العبرة"));
  const story = pop(t, at(tl, "القصة"));
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
    { a: at(tl, "فليس") - 0.1, b: at(tl, "معرفة"), cx: 1370, cy: 560, s: 1.25 },
    { a: at(tl, "معرفة") - 0.2, b: at(tl, "العبرة"), cx: 1370, cy: 520, s: 1.18 },
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
            <SText x={cx} y={348} size={34} font="tajawal" weight={700} color={C.page}>
              ما تتوقف عليه القصة
            </SText>
            <SText x={cx} y={560} size={130} o={ibra} color={C.ink}>
              العبرة
            </SText>
            <Ink d={`M${cx + 180} 610 H${cx - 180}`} w={5} p={story} c={C.gold} />
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
  const pull = prog(t, at(tl, "وسعى") - 0.05, at(tl, "فيما") + 0.1);
  const seal = pop(t, at(tl, "الأعراف"));
  const zaam = pop(t, at(tl, "زعم"));
  const p1 = pop(t, at(tl, "منزلة"));
  const p2 = pop(t, at(tl, "الخلد"));
  const strike = prog(t, end(tl, "الخلد") + 0.15, end(tl, "الخلد") + 0.7);
  const cam = camPath(t, NEUTRAL, [
    { a: at(tl, "وسوس") - 0.2, b: at(tl, "وزوجه") + 0.2, cx: 900, cy: 480, s: 1.06 },
    // «وسعى إلى إيقاعهما فيما نهاهما»: يتبع الخط المتقطع نحو حدّ النهي (قبل نافذة ذكر الله)
    { a: at(tl, "وسعى") - 0.1, b: Math.min(at(tl, "فيما") + 0.3, at(tl, "الله") - 0.3), cx: 780, cy: 580, s: 1.14 },
    // «وفي سورة الأعراف»: إلى ختمها لحظة ذكرها
    { a: at(tl, "وفي") - 0.1, b: at(tl, "الأعراف") + 0.4, cx: 1520, cy: 330, s: 1.28 },
    { a: at(tl, "زعم") - 0.25, b: at(tl, "الخلد") + 0.2, cx: 1340, cy: 520, s: 1.1 },
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
    </g>
  );
  const R = (
    <g>
      {p.head ? <ChapterHead label={p.head} /> : null}
      <Word x={1365} y={460} size={72} p={pair} color={C.ink}>
        آدم وزوجه
      </Word>
      <QuranSeal x={1600} y={260} o={seal} s={0.85} refText="الأعراف ٢٠" />
      <SText x={1365} y={600} size={40} font="tajawal" weight={700} color={EMBER} o={zaam}>
        زعم:
      </SText>
      {promise(1365, 700, "منزلة الملائكة", p1)}
      {promise(1365, 820, "الخلد", p2)}
      <Strike x1={1560} x2={1170} y={704} p={strike} w={7} />
      <Strike x1={1560} x2={1170} y={824} p={prog(strike, 0.3, 1)} w={7} />
      {both}
    </g>
  );
  const L = (
    <g>
      <Forbidden x={560} y={560} mark={forb} bound={forb} />
      {both}
    </g>
  );
  return <Book id="c54" t={t} dur={dur} exit={exit} cam={cam} R={R} L={L} />;
};

// ─── c5-s5: «ثم وقع ما حذرهما الله منه»: الحد المتقطع ينفتح فيه ثغرة (بلا تصوير للأكل ولا للشجرة) ───
const Breach: React.FC<HzProps> = ({ t, tl, dur, exit }) => {
  const br = prog(t, at(tl, "وقع") - 0.05, at(tl, "وقع") + 0.5);
  return <Book id="c55" t={t} dur={dur} exit={exit} cam={{ cx: 700, cy: 520, s: 1.08 }} L={<Forbidden x={560} y={520} mark={1} bound={1} breach={br} />} />;
};

// ─── c5-s8: موقفان: خطٌ يعلو ويمضي (استكبر وأصر)، وخطٌ يعود (تاب وأناب)، ثم باب التوبة مفتوح ───
const Stances: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const diff = pop(t, at(tl, "الفرق"));
  const iblis = pop(t, at(tl, "فإبليس"));
  const rise = prog(t, at(tl, "استكبر") - 0.05, at(tl, "استكبر") + 0.6);
  const persist = prog(t, at(tl, "وأصر") - 0.05, at(tl, "وأصر") + 0.7);
  const adam = pop(t, at(tl, "وآدم"));
  const away = prog(t, at(tl, "تاب") - 0.05, at(tl, "تاب") + 0.4);
  const back = prog(t, at(tl, "وأناب") - 0.05, at(tl, "وأناب") + 0.6);
  const door = prog(t, at(tl, "باب") - 0.05, at(tl, "التوبة") + 0.3);
  const open = prog(t, at(tl, "مغلقا") - 0.1, at(tl, "مغلقا") + 0.6, easeOut);
  const walk = prog(t, at(tl, "رجع") - 0.1, at(tl, "رجع") + 0.15);
  const glow = prog(t, at(tl, "صادقا") + 0.25, at(tl, "صادقا") + 0.7);
  const cam = camPath(t, NEUTRAL, [
    // «يظهر الفرق بين الموقفين»: إلى العنوان وهو يُكتب
    { a: at(tl, "الفرق") - 0.2, b: at(tl, "الموقفين") + 0.3, cx: 1365, cy: 270, s: 1.3 },
    { a: at(tl, "فإبليس") - 0.3, b: at(tl, "فإبليس") + 0.3, cx: 560, cy: 520, s: 1.22 },
    { a: at(tl, "وآدم") - 0.35, b: at(tl, "وآدم") + 0.3, cx: 1370, cy: 520, s: 1.22 },
    { a: end(tl, "وأناب") + 0.1, b: end(tl, "وأناب") + 0.8, ...NEUTRAL },
    { a: at(tl, "باب") - 0.3, b: at(tl, "التوبة") + 0.3, cx: 1300, cy: 520, s: 1.12 },
    // «لمن أذنب ثم رجع»: يتبع النقطة وهي تعود إلى الباب (قبل نافذة «ربه»)
    { a: at(tl, "أذنب") - 0.2, b: Math.min(at(tl, "رجع") + 0.3, at(tl, "ربه") - 0.3), cx: 1240, cy: 640, s: 1.3 },
  ]);
  // الباب على الصفحة اليمنى: إطار ثابت ومصراع يدور على مفصله الأيمن
  const dx = 1420;
  const leafW = 170 * Math.cos((open * Math.PI) / 2.6);
  const R = (
    <g>
      {p.head ? <ChapterHead label={p.head} /> : null}
      <Word x={1365} y={225} size={42} p={diff} font="tajawal" weight={700} color={C.inkSoft}>
        الفرق بين الموقفين
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
        <circle cx={mix(1000, dx, walk)} cy={mix(720, 700, walk)} r={13 * prog(t, at(tl, "أذنب") - 0.05, at(tl, "أذنب") + 0.3)} fill={C.ink} />
        <Word x={dx} y={318} size={44} p={door} font="tajawal" weight={700} color={C.ink}>
          باب التوبة
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
  const life = pop(t, at(tl, "حياة"));
  const death = pop(t, at(tl, "وموتهم"));
  const out = prog(t, at(tl, "إخراجهم") - 0.1, at(tl, "إخراجهم") + 0.7);
  const cam = camPath(t, NEUTRAL, [
    // «وفي سورة الأعراف»: إلى ختمها، ثم «في الأرض»: إلى الأفق وهو يُرسم
    { a: at(tl, "سورة") - 0.1, b: at(tl, "الأعراف") + 0.5, cx: 1560, cy: 300, s: 1.3 },
    { a: at(tl, "بيان") - 0.1, b: at(tl, "الأرض") + 0.6, cx: 1300, cy: 500, s: 1.1 },
    { a: at(tl, "ومتاعا") - 0.2, b: at(tl, "حين") + 0.3, cx: 900, cy: 520, s: 1.0 },
    { a: at(tl, "حياة") - 0.2, b: at(tl, "إخراجهم") + 0.4, cx: 960, cy: 600, s: 1.04 },
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
  const extend = prog(t, at(tl, "قصة") + 0.2, at(tl, "بالتاريخ") + 0.3, easeOut);
  const ground = prog(t, at(tl, "بالتاريخ") - 0.05, at(tl, "البشري") + 0.6);
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
            الخبر
          </Word>
          <Word x={1365} y={590} size={36} p={khabar} font="tajawal" weight={500} color={C.inkSoft}>
            قصة آدم عليه السلام
          </Word>
        </g>
      }
      L={both}
      over={
        <g>
          <SText x={2330} y={900} size={120} font="tajawal" weight={800} color={C.sand} o={lbl}>
            التاريخ البشري
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
  const fadeR = prog(t, at(tl, "نعلم") - 0.05, at(tl, "يحدده") + 0.3);
  const pin = prog(t, at(tl, "نصا") - 0.1, at(tl, "صريحا") + 0.2, easeOut);
  const hover0 = Math.sin(t * 2.4) * 10;
  const ribbon = prog(t, at(tl, "تاريخا", 1) - 0.1, at(tl, "محددا") + 0.2, easeOut);
  const dash = prog(t, at(tl, "محددا"), at(tl, "محددا") + 0.4);
  const aside = prog(t, at(tl, "ننسب") - 0.05, at(tl, "الجزم") + 0.2);
  // الدبوس معلق يتردد ولا يستقر، ثم يسكن حين نترك الجزم
  const hover = hover0 * (1 - aside);
  const cam = camPath(t, { cx: 960, cy: 540, s: 1.05 }, [
    // «وأما موضع هبوطه»: الكادر يجول في الخريطة الخالية من المعالم
    { a: at(tl, "موضع") - 0.1, b: r0 - 0.2, cx: 800, cy: 500, s: 1.12 },
    { a: r0 - 0.2, b: r0 + 0.6, cx: 640, cy: 520, s: 1.15 },
    { a: r0 + 0.6, b: r1, cx: 1300, cy: 520, s: 1.15 },
    { a: at(tl, "نعلم") - 0.2, b: at(tl, "نصا"), cx: 1180, cy: 470, s: 1.12 },
    // «يحدده»: اقتراب من الدبوس المعلق الذي لا يستقر، ثم إلى شريط التاريخ الفارغ
    { a: at(tl, "يحدده") - 0.1, b: at(tl, "كما") + 0.3, cx: 1180, cy: 400, s: 1.3 },
    { a: at(tl, "تاريخا", 1) - 0.25, b: at(tl, "محددا") + 0.3, cx: 1480, cy: 420, s: 1.16 },
    { a: at(tl, "ننسب") - 0.2, b: at(tl, "الجزم") + 0.4, ...NEUTRAL },
    // «ونقول فيما لا نعلمه»: تراجع يفسح الصفحة، ثم سكون كامل عند «الله أعلم»
    { a: at(tl, "ونقول") - 0.1, b: Math.min(end(tl, "نعلمه") + 0.1, at(tl, "الله") - 0.3), cx: 960, cy: 520, s: 0.94 },
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
  const w1 = pop(t, at(tl, "نؤمن"));
  const w2 = pop(t, at(tl, "ونثبته"));
  const bar = prog(t, at(tl, "نزيد") - 0.1, at(tl, "عليه") + 0.2);
  const outside = prog(t, at(tl, "يثبت") - 0.05, at(tl, "يثبت") + 0.4);
  const dalil = pop(t, at(tl, "دليل"));
  const cam = camPath(t, NEUTRAL, [
    // «نؤمن به ونثبته»: اقتراب من الكلمتين داخل الإطار (بعد نافذة ذكر الله)
    { a: at(tl, "نؤمن") - 0.2, b: at(tl, "ونثبته") + 0.5, cx: 1365, cy: 480, s: 1.25 },
    { a: at(tl, "نزيد") - 0.25, b: at(tl, "دليل") + 0.3, cx: 1100, cy: 560, s: 1.06 },
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
      <Word x={1365} y={780} size={40} p={bar} font="tajawal" weight={700} color={C.inkText}>
        لا نزيد عليه
      </Word>
    </g>
  );
  const L = (
    <g>
      <g opacity={outside}>
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={300} x2={760 - i * 70} y1={330 + i * 60} y2={330 + i * 60} stroke={C.inkSoft} strokeWidth={3} strokeDasharray="6 10" opacity={0.6} />
        ))}
        <SText x={530} y={620} size={40} font="tajawal" weight={500} color={C.inkSoft}>
          ما لم يثبت
        </SText>
      </g>
      <g opacity={dalil}>
        <circle cx={540} cy={760} r={78} fill="rgba(255,250,235,0.3)" stroke={C.gold} strokeWidth={12} />
        <path d="M596 816 L680 900" stroke="#6B4A2E" strokeWidth={22} strokeLinecap="round" />
        <SText x={540} y={778} size={50} color={C.ink}>
          دليل
        </SText>
      </g>
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
