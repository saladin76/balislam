/**
 * مشاهد «خط الأفق» للحلقة 001 — الفصل السابع (الدفعة البصرية الرابعة) — الأمر 012.
 * من القصة القرآنية إلى منهج دراسة التاريخ: النسل مراوح أجيال (لا تصوير لآدم ولا تحديد لزمنه)، وخط زمن بفجوات،
 * والعبور إلى الشواهد، ومنهج «ثبت / اختُلف فيه / ظن»، وطريق الحلقات، وأسئلة الحلقة القادمة، وصفحة «دفاتر الزمن».
 * لا يُنسب أثر إلى آدم ولا ذريته الأولى، ولا تُعطى أعمار ولا تواريخ.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { at, end, type Timeline } from "./timeline";
import { C, Ink, easeOut, mix, prog, rng } from "./kit";
import { Book, ChapterHead, NEUTRAL, QuranSeal, SText, camPath, type Cam, type Exit } from "./book";
import { FINDS } from "./shots";

export type HzProps = { t: number; tl: Timeline; dur: number; exit: Exit; from?: Cam; p: Record<string, string | undefined> };
const EMBER = "#B23A1E";
const GOLD_D = "#A8803A";
const pop = (t: number, a: number, d = 0.45) => prog(t, a - 0.05, a - 0.05 + d, easeOut);
const Word: React.FC<{ x: number; y: number; size: number; p: number; color?: string; font?: "amiri" | "tajawal"; weight?: number; anchor?: "middle" | "start" | "end"; children: React.ReactNode }> = ({ p, ...r }) => (
  <SText {...r} o={p} dy={(1 - p) * 12}>
    {r.children}
  </SText>
);
/** أثر من رسوم الشواهد (مشهد الأثر وحدوده) في موضع جديد وبحجم جديد */
const Find: React.FC<{ k: string; x: number; y: number; s: number; p: number }> = ({ k, x, y, s, p }) => {
  const f = FINDS.find((v) => v.key === k)!;
  return <g transform={`translate(${x} ${y}) scale(${s}) translate(${-f.cx} ${-f.cy})`}>{f.draw(p)}</g>;
};

// ─── c7-s1: النسل مراوح أجيال تتسع من أصل واحد (النساء 1) — نقاط لا هيئات ───
const ROOT: [number, number] = [1300, 230];
const GENS = [
  { n: 2, rx: 300, ry: 170 },
  { n: 6, rx: 620, ry: 330 },
  { n: 14, rx: 940, ry: 500 },
  { n: 30, rx: 1250, ry: 660 },
];
const ANG = (k: number, j: number) => {
  const n = GENS[k]!.n;
  return ((92 + ((j + 0.5) / n) * 86) * Math.PI) / 180;
};
const genPt = (k: number, j: number): [number, number] => [ROOT[0] + GENS[k]!.rx * Math.cos(ANG(k, j)), ROOT[1] + GENS[k]!.ry * Math.sin(ANG(k, j))];
const parentOf = (k: number, j: number) => (k === 0 ? -1 : Math.min(GENS[k - 1]!.n - 1, Math.floor(((j + 0.5) / GENS[k]!.n) * GENS[k - 1]!.n)));
const GenFan: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const root = pop(t, at(tl, "بدأ"));
  const ga = [at(tl, "نسل"), at(tl, "البشر"), at(tl, "وبث"), at(tl, "كثيرا")];
  const label = pop(t, at(tl, "آدم"));
  const seal = pop(t, at(tl, "النساء"));
  const one = prog(t, at(tl, "واحدة") - 0.05, at(tl, "واحدة") + 0.7);
  const cam = camPath(t, { cx: 1180, cy: 420, s: 1.12 }, [
    { a: at(tl, "البشر") - 0.1, b: at(tl, "آدم") + 0.3, cx: 1120, cy: 470, s: 1.04 },
    { a: at(tl, "وبث") - 0.2, b: at(tl, "كثيرا") + 0.4, ...NEUTRAL },
  ]);
  const fan = (
    <g>
      {GENS.map((g, k) =>
        Array.from({ length: g.n }, (_, j) => {
          const q = prog(t, ga[k]! + (j / g.n) * 0.5, ga[k]! + 0.45 + (j / g.n) * 0.5, easeOut);
          if (q <= 0) return null;
          const [x, y] = genPt(k, j);
          const pj = parentOf(k, j);
          const [px, py] = k === 0 ? ROOT : genPt(k - 1, pj);
          return (
            <g key={`${k}-${j}`}>
              <path d={`M${px} ${py} Q${mix(px, x, 0.5)} ${mix(py, y, 0.5) - 30} ${x} ${y}`} fill="none" stroke={C.ink} strokeWidth={k < 2 ? 3.5 : 2.4} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - q} opacity={0.75} />
              <circle cx={x} cy={y} r={(11 - k * 2) * q} fill={k % 2 ? GOLD_D : C.ink} />
            </g>
          );
        }),
      )}
    </g>
  );
  const R = (
    <g>
      {p.head ? <ChapterHead label={p.head} /> : null}
      <circle cx={ROOT[0]} cy={ROOT[1]} r={60 * one} fill={C.gold} opacity={0.25 * (1 - 0.5 * one)} />
      <Ink d={`M${ROOT[0]} ${ROOT[1] - 34} a34 34 0 1 1 -0.1 0`} w={4} p={one} c={C.gold} />
      <circle cx={ROOT[0] - 12} cy={ROOT[1]} r={13 * root} fill={C.ink} />
      <circle cx={ROOT[0] + 12} cy={ROOT[1]} r={13 * root} fill={GOLD_D} />
      <Word x={ROOT[0]} y={ROOT[1] - 56} size={34} p={label} font="tajawal" weight={500} color={C.inkSoft}>
        آدم عليه السلام وزوجه
      </Word>
      <QuranSeal x={1640} y={300} o={seal} s={0.85} refText="النساء ١" />
      {fan}
    </g>
  );
  return <Book id="c71" t={t} dur={dur} exit={exit} cam={cam} R={R} L={fan} />;
};

// ─── c7-s2: خط الأجيال يمتد وتتنوع عليه المعايش، ثم تظهر فجواته: لا سجل متصل، وأسئلة بلا جواب ───
const LINE_Y = 560;
const GAPS: [number, number][] = [
  [1500, 1300],
  [900, 700],
  [580, 400],
];
const Tent = () => <path d="M-50 0 L0 -70 L50 0 Z M0 -70 V0 M-14 0 L0 -26 L14 0" fill="#E8D6B3" stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />;
const Wheat = () => (
  <g fill="none" stroke={C.ink} strokeWidth={4} strokeLinecap="round">
    <path d="M0 0 V-80 M-26 0 C-26 -30 -14 -54 -4 -70 M26 0 C26 -30 14 -54 4 -70" />
    {[-60, -44, -28].map((y) => (
      <path key={y} d={`M0 ${y} l-12 -12 M0 ${y} l12 -12`} />
    ))}
  </g>
);
const Boat = () => (
  <g stroke={C.ink} strokeWidth={4} strokeLinejoin="round">
    <path d="M-60 -16 H60 L42 6 H-42 Z" fill="#C9A06A" />
    <path d="M0 -16 V-84 L44 -26 H0" fill="#F2E3C2" />
  </g>
);
const Jar = () => <path d="M-16 -80 H16 V-70 C34 -60 40 -36 34 -16 C28 -2 16 0 0 0 C-16 0 -28 -2 -34 -16 C-40 -36 -34 -60 -16 -70 Z" fill="#C98E5A" stroke={C.ink} strokeWidth={4} />;
const LIVES = [Tent, Wheat, Boat, Jar];
const LIVES_X = [1560, 1150, 880, 470];
const Lineline: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const ticks = prog(t, at(tl, "تعاقب") - 0.1, end(tl, "البشري") + 0.2);
  const lives = [at(tl, "وتنوعت"), at(tl, "أحوال"), at(tl, "الناس"), at(tl, "ومعايشهم")].map((a) => pop(t, a, 0.5));
  const gaps = [at(tl, "سجلا"), at(tl, "متصلا"), at(tl, "بتفاصيل")].map((a) => prog(t, a - 0.05, a + 0.5, easeOut));
  const adam = pop(t, at(tl, "آدم"));
  const oldest = pop(t, at(tl, "آثارها"));
  const qs = [
    { w: "أسماء", a: at(tl, "أسماء") },
    { w: "أماكن", a: at(tl, "أماكن") },
    { w: "أحداث", a: at(tl, "أحداث") },
  ];
  const cam = camPath(t, { cx: 1400, cy: 520, s: 1.12 }, [
    { a: at(tl, "تعاقب") - 0.1, b: end(tl, "البشري") + 0.2, cx: 760, cy: 520, s: 1.08 },
    { a: at(tl, "وتنوعت") - 0.2, b: end(tl, "ومعايشهم"), cx: 1100, cy: 500, s: 1.02 },
    { a: at(tl, "ولكننا") - 0.2, b: at(tl, "متصلا") + 0.3, ...NEUTRAL },
    // طرفا الخط: «من آدم» ثم «إلى أقدم المجتمعات»، ثم كل سؤال عند فجوته
    { a: at(tl, "آدم") - 0.3, b: at(tl, "آدم") + 0.4, cx: 1420, cy: 560, s: 1.15 },
    { a: at(tl, "أقدم") - 0.2, b: at(tl, "آثارها") + 0.2, cx: 480, cy: 580, s: 1.15 },
    { a: at(tl, "أسماء") - 0.35, b: at(tl, "أسماء") + 0.25, cx: 1380, cy: 500, s: 1.18 },
    { a: at(tl, "أماكن") - 0.35, b: at(tl, "أماكن") + 0.25, cx: 820, cy: 500, s: 1.18 },
    { a: at(tl, "أحداث") - 0.35, b: at(tl, "أحداث") + 0.25, cx: 520, cy: 500, s: 1.18 },
    { a: end(tl, "أحداث") + 0.2, b: end(tl, "أحداث") + 1.0, ...NEUTRAL },
  ]);
  const r = rng(73);
  const tickX = Array.from({ length: 70 }, (_, i) => 1700 - i * 21.4 - r() * 4);
  const both = (
    <g>
      <path d={`M1720 ${LINE_Y} H210`} fill="none" stroke={C.ink} strokeWidth={5} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - ticks} />
      {tickX.map((x, i) => {
        const q = prog(ticks, i / 70, i / 70 + 0.05);
        return <line key={i} x1={x} x2={x} y1={LINE_Y - 10 - (i % 5 ? 0 : 8)} y2={LINE_Y + 10 + (i % 5 ? 0 : 8)} stroke={C.ink} strokeWidth={2.5} opacity={q} />;
      })}
      {LIVES.map((L, i) => (
        <g key={i} opacity={lives[i]} transform={`translate(${LIVES_X[i]} ${LINE_Y - 36 - (1 - lives[i]!) * 20})`}>
          <L />
        </g>
      ))}
      {/* فجوات السجل: صفحات مفقودة على الخط */}
      {GAPS.map(([a, b], i) => {
        const g = gaps[i]!;
        const w = (a - b) * g;
        const x = (a + b) / 2;
        return (
          <g key={i} opacity={g}>
            <path d={`M${x + w / 2} ${LINE_Y - 120} L${x + w / 2 - 14} ${LINE_Y - 60} L${x + w / 2 + 8} ${LINE_Y} L${x + w / 2 - 10} ${LINE_Y + 70} L${x + w / 2} ${LINE_Y + 120} H${x - w / 2} L${x - w / 2 + 12} ${LINE_Y + 60} L${x - w / 2 - 8} ${LINE_Y} L${x - w / 2 + 10} ${LINE_Y - 60} L${x - w / 2} ${LINE_Y - 120} Z`} fill="#2B1E14" opacity={0.82} />
            {Array.from({ length: Math.max(0, Math.floor(w / 26)) }, (_, j) => (
              <line key={j} x1={x - w / 2 + 14 + j * 26} x2={x - w / 2 + 34 + j * 26} y1={LINE_Y + 100} y2={LINE_Y - 100} stroke="#5A4030" strokeWidth={3} />
            ))}
          </g>
        );
      })}
      {qs.map((q, i) => {
        const [a, b] = GAPS[i]!;
        const o = pop(t, q.a, 0.5);
        return (
          <g key={i} opacity={o} transform={`translate(${(a + b) / 2} ${LINE_Y - 190 + (1 - o) * 20})`}>
            <rect x={-110} y={-48} width={220} height={78} rx={39} fill={C.page} stroke={C.ribbon} strokeWidth={4} />
            <SText x={0} y={8} size={42} font="tajawal" weight={800} color={C.ribbon}>
              {`${q.w}؟`}
            </SText>
          </g>
        );
      })}
    </g>
  );
  return (
    <Book
      id="c72"
      t={t}
      dur={dur}
      exit={exit}
      cam={cam}
      R={
        <g>
          {p.head ? <ChapterHead label={p.head} /> : null}
          {both}
          <Word x={1640} y={LINE_Y + 90} size={36} p={adam} font="tajawal" weight={700} color={C.ink}>
            آدم عليه السلام
          </Word>
        </g>
      }
      L={
        <g>
          {both}
          <Word x={262} y={LINE_Y + 90} size={34} p={oldest} font="tajawal" weight={700} color={C.ink}>
            أقدم الآثار
          </Word>
          <g opacity={oldest}>
            <Find k="food" x={262} y={LINE_Y + 170} s={0.55} p={oldest} />
          </g>
        </g>
      }
    />
  );
};

// ─── c7-s3: «وهنا تبدأ مرحلة أخرى»: مسار الباحث يبدأ على الصفحة، والكاميرا تعبر الورق إلى أرض الشواهد ───
const Threshold: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const trail = prog(t, at(tl, "تبدأ") - 0.1, end(tl, "رحلتنا") + 0.4);
  const push = prog(t, at(tl, "مرحلة") - 0.1, dur - 0.1, (x) => x * x * x);
  const ground = prog(t, at(tl, "أخرى"), end(tl, "رحلتنا"));
  const veil = prog(t, dur - 0.7, dur - 0.05);
  const cam = { cx: mix(960, 1365, push), cy: mix(520, 760, push), s: mix(1, 4.2, push) };
  const dots = Array.from({ length: 22 }, (_, i) => {
    const u = (i + 0.5) / 22;
    return { x: mix(1600, 1365, u) + Math.sin(u * 5) * 40, y: mix(330, 760, u), u };
  });
  const R = (
    <g>
      {p.head ? <ChapterHead label={p.head} /> : null}
      <rect x={960} y={720} width={810} height={220} fill="#DCC6A0" opacity={0.7 * ground} />
      <path d="M1770 720 C1500 712 1200 728 960 720" fill="none" stroke={C.ink} strokeWidth={5} />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={6} fill="#2B1E14" opacity={d.u <= trail ? 0.65 : 0} />
      ))}
    </g>
  );
  return (
    <>
      <Book id="c73" t={t} dur={dur} exit={exit} cam={cam} R={R} L={<path d="M960 720 C700 712 450 728 150 720" fill="none" stroke={C.ink} strokeWidth={5} />} />
      {/* يلتقي الكادر بأرض مشهد الأثر: ورق فوقه وطبقة تراب تحته */}
      <AbsoluteFill style={{ opacity: veil }}>
        <div style={{ position: "absolute", inset: 0, background: C.parchment }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 920, bottom: 0, background: "#DCC6A0" }} />
      </AbsoluteFill>
    </>
  );
};

// ─── c7-s5: من الشاهد إلى الحكم: «ثبت» و«اختُلف فيه» ختمان، و«ظن» لا يُختم حقيقة ───
const Stamp: React.FC<{ x: number; y: number; q: number; label: string; color: string; filled?: boolean; w?: number }> = ({ x, y, q, label, color, filled, w = 260 }) => {
  if (q <= 0) return null;
  const sc = 1 + 0.6 * (1 - q);
  const ring = prog(q, 0.6, 1);
  return (
    <g opacity={Math.min(1, q * 2)} transform={`translate(${x} ${y}) rotate(${-6 + 6 * q}) scale(${sc})`}>
      <rect x={-w / 2 - 22 * ring} y={-60 - 22 * ring} width={w + 44 * ring} height={120 + 44 * ring} rx={16} fill="none" stroke={color} strokeWidth={3} opacity={0.5 * (1 - ring)} />
      <rect x={-w / 2} y={-60} width={w} height={120} rx={12} fill={filled ? color : C.page} stroke={color} strokeWidth={7} />
      <SText x={0} y={20} size={58} font="tajawal" weight={800} color={filled ? C.page : color}>
        {label}
      </SText>
    </g>
  );
};
const Method: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const ev = prog(t, 0.05, 0.8);
  const a1 = prog(t, at(tl, "سنذكر") - 0.1, at(tl, "ثبت"));
  const s1 = prog(t, at(tl, "ثبت") - 0.05, at(tl, "ثبت") + 0.35);
  const a2 = prog(t, at(tl, "ونبين") - 0.1, at(tl, "اختلف"));
  const s2 = prog(t, at(tl, "اختلف") - 0.05, at(tl, "اختلف") + 0.35);
  const a3 = prog(t, at(tl, "نجعل") - 0.1, at(tl, "الظنون") + 0.1);
  const s3 = prog(t, at(tl, "الظنون") - 0.05, at(tl, "الظنون") + 0.35);
  const reach = prog(t, at(tl, "حقائق") - 0.1, at(tl, "حقائق") + 0.3);
  const block = prog(t, at(tl, "حقائق") + 0.2, end(tl, "حقائق") + 0.4);
  const cam = camPath(t, { cx: 1300, cy: 420, s: 1.1 }, [
    { a: at(tl, "سنذكر") - 0.2, b: at(tl, "ثبت") + 0.2, cx: 1250, cy: 560, s: 1.05 },
    { a: at(tl, "ونبين") - 0.2, b: at(tl, "اختلف") + 0.2, cx: 960, cy: 560, s: 1.02 },
    { a: at(tl, "نجعل") - 0.2, b: at(tl, "حقائق") + 0.3, cx: 660, cy: 560, s: 1.06 },
  ]);
  const arrow = (d: string, q: number) => <Ink d={d} w={5} p={q} c={C.inkSoft} />;
  const both = (
    <g>
      {arrow("M1320 400 C1340 470 1480 520 1520 600", a1)}
      {arrow("M1290 400 C1250 480 1180 520 1150 600", a2)}
      {arrow("M1260 400 C1100 470 780 470 640 600", a3)}
      <Stamp x={1520} y={680} q={s1} label="ثبت" color={GOLD_D} filled />
      <Stamp x={1150} y={680} q={s2} label="اختُلف فيه" color={C.ink} w={330} />
      <Stamp x={620} y={680} q={s3} label="ظن" color={EMBER} />
      {/* «ولن نجعل الظنون حقائق»: السهم من «ظن» إلى «حقيقة» يُقطع */}
      <path d="M480 680 C420 680 380 680 330 680" fill="none" stroke={EMBER} strokeWidth={5} strokeDasharray="10 10" opacity={reach} />
      <g opacity={reach}>
        <rect x={160} y={630} width={160} height={100} rx={10} fill="none" stroke={C.inkSoft} strokeWidth={4} strokeDasharray="8 8" />
        <SText x={240} y={694} size={40} font="tajawal" weight={700} color={C.inkSoft}>
          حقيقة
        </SText>
      </g>
      <Ink d="M370 640 L430 720 M430 640 L370 720" w={8} p={block} c={EMBER} />
    </g>
  );
  const R = (
    <g>
      {p.head ? <ChapterHead label={p.head} /> : null}
      <SText x={1290} y={210} size={40} font="tajawal" weight={700} color={C.inkSoft} o={ev}>
        الشاهد
      </SText>
      <Find k="tool" x={1380} y={330} s={0.75} p={ev} />
      <Find k="food" x={1200} y={330} s={0.75} p={ev} />
      {both}
    </g>
  );
  return <Book id="c75" t={t} dur={dur} exit={exit} cam={cam} R={R} L={both} />;
};

// ─── c7-s6: طريق الحلقات: قبل الكتابة ← القرى والمدن ← الحضارات ───
const ROAD = "M1740 820 C1600 820 1560 700 1460 690 C1300 670 1260 520 1120 470 C960 420 860 560 720 560 C560 560 560 380 420 340 C320 310 260 300 180 300";
const Fire = ({ q }: { q: number }) => (
  <g>
    <path d="M-50 10 H50" stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
    <path d="M-36 4 L30 -6 M-30 -6 L36 4" stroke="#6B4A2E" strokeWidth={8} strokeLinecap="round" />
    <path d={`M0 ${-70 * q} C26 -40 30 -16 14 0 C26 -10 22 -30 10 -40 C14 -22 0 -14 -6 0 C-24 -14 -20 -40 0 ${-70 * q} Z`} fill={C.ember} stroke={C.ink} strokeWidth={3} />
  </g>
);
const Village = () => (
  <g stroke={C.ink} strokeWidth={4} strokeLinejoin="round" fill="#E8D6B3">
    <path d="M-110 0 V-50 H-50 V0 Z M-110 -50 L-80 -76 L-50 -50" />
    <path d="M-40 0 V-70 H30 V0 Z M-40 -70 L-5 -98 L30 -70" />
    <path d="M40 0 V-46 H100 V0 Z" />
    <path d="M-130 0 H130" fill="none" />
    <path d="M-130 6 V-24 H-120 V6 M120 6 V-24 H130 V6" />
  </g>
);
const Temple = () => (
  <g stroke={C.ink} strokeWidth={4} strokeLinejoin="round" fill="#E8D6B3">
    <path d="M-140 0 H-10 V-14 H-24 V-28 H-38 V-42 H-60 V-56 H-90 V-42 H-112 V-28 H-126 V-14 H-140 Z" />
    <path d="M10 0 H140 V-12 H10 Z M20 -12 V-90 M50 -12 V-90 M80 -12 V-90 M110 -12 V-90 M130 -12 V-90 M4 -90 H146 L75 -126 Z" />
  </g>
);
const MILES = [
  { x: 1460, y: 690, w: "قبل", label: "قبل الكتابة", D: Fire },
  { x: 1120, y: 470, w: "القرى", label: "القرى والمدن", D: Village },
  { x: 420, y: 340, w: "والحضارات", label: "الحضارات", D: Temple },
];
const Roadmap: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const tag = pop(t, at(tl, "حلقاتنا"));
  const road = prog(t, 0.05, end(tl, "الأرض") + 0.3, (x) => x);
  const times = MILES.map((m) => at(tl, m.w));
  const cam = camPath(t, { cx: 1450, cy: 640, s: 1.18 }, [
    { a: times[0]! - 0.3, b: times[0]! + 0.3, cx: 1420, cy: 620, s: 1.2 },
    { a: times[1]! - 0.5, b: times[1]! + 0.3, cx: 1150, cy: 470, s: 1.2 },
    { a: times[2]! - 0.6, b: times[2]! + 0.3, cx: 520, cy: 400, s: 1.2 },
    { a: at(tl, "تعاقبت") - 0.1, b: end(tl, "الأرض") + 0.6, ...NEUTRAL },
  ]);
  const both = (
    <g>
      {/* الطريق يُرسم بقناع يتقدم معه (لا ممحاة بلون الورق فوق الصفحة) */}
      <defs>
        <mask id="c76-road" maskUnits="userSpaceOnUse" x={0} y={0} width={1920} height={1080}>
          <path d={ROAD} fill="none" stroke="white" strokeWidth={44} strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - road} />
        </mask>
      </defs>
      <g mask="url(#c76-road)">
        <path d={ROAD} fill="none" stroke="#C9B48E" strokeWidth={34} strokeLinecap="round" opacity={0.6} />
        <path d={ROAD} fill="none" stroke={C.ink} strokeWidth={4} strokeDasharray="14 12" opacity={0.8} />
      </g>
      {MILES.map((m, i) => {
        const q = prog(t, times[i]! - 0.05, times[i]! + 0.6, easeOut);
        return (
          <g key={i} opacity={q} transform={`translate(${m.x} ${m.y - 30 - (1 - q) * 30}) scale(${0.8 + 0.2 * q})`}>
            <circle cx={0} cy={30} r={14} fill={C.ribbon} stroke={C.ink} strokeWidth={3} />
            <g transform="translate(0 -6)">
              <m.D q={q} />
            </g>
            <SText x={0} y={-140} size={44} font="tajawal" weight={800} color={C.ink}>
              {m.label}
            </SText>
          </g>
        );
      })}
      <Ink d="M210 300 L176 300 M196 284 L176 300 L196 316" w={5} p={prog(road, 0.95, 1)} c={C.ink} />
    </g>
  );
  return (
    <Book
      id="c76"
      t={t}
      dur={dur}
      exit={exit}
      cam={cam}
      R={
        <g>
          {p.head ? <ChapterHead label={p.head} /> : null}
          {both}
          <g opacity={tag} transform={`translate(0 ${(1 - tag) * -30})`}>
            <path d="M1740 860 H1500 V910 H1740 L1726 885 Z" fill={C.ribbon} />
            <SText x={1714} y={895} size={28} font="tajawal" weight={700} color={C.page} anchor="start">
              الحلقات القادمة
            </SText>
          </g>
        </g>
      }
      L={both}
    />
  );
};

// ─── c7-s7: أسئلة الحلقة القادمة، لكل سؤال أداته: بلا سجل مكتوب / كم عمره؟ / حدود الدليل ───
const Questions: React.FC<HzProps> = ({ t, tl, dur, exit, p }) => {
  const q1 = at(tl, "كيف");
  const scrape = prog(t, at(tl, "الباحثون") - 0.1, at(tl, "قوم") + 0.2);
  const scroll = pop(t, at(tl, "سجلا"));
  const empty = prog(t, at(tl, "مكتوبا") - 0.05, at(tl, "مكتوبا") + 0.5);
  const q2 = at(tl, "يقدرون");
  const rod = prog(t, q2 - 0.05, q2 + 0.6);
  const items = [at(tl, "الأدوات"), at(tl, "والمساكن"), at(tl, "والآثار")].map((a) => pop(t, a));
  const spin = prog(t, q2, end(tl, "والآثار"));
  const settle = prog(t, end(tl, "والآثار"), end(tl, "والآثار") + 0.3);
  const q3 = at(tl, "الأدلة");
  const light = prog(t, q3 - 0.1, at(tl, "تخبرنا") + 0.3, easeOut);
  const bound = prog(t, at(tl, "خارج") - 0.05, end(tl, "حدودها") + 0.2);
  const qmark = pop(t, end(tl, "حدودها") - 0.1);
  const cam = camPath(t, { cx: 1380, cy: 340, s: 1.45 }, [
    { a: q2 - 0.4, b: q2 + 0.3, cx: 1380, cy: 720, s: 1.45 },
    { a: q3 - 0.6, b: q3 + 0.2, cx: 560, cy: 520, s: 1.12 },
    { a: end(tl, "حدودها") + 0.2, b: end(tl, "حدودها") + 1.0, ...NEUTRAL },
  ]);
  const r = rng(85);
  const digits = Array.from({ length: 4 }, (_, i) => (spin > 0 && settle < 1 ? String(Math.floor((t * 23 + i * 7 + r() * 10) % 10)) : "؟"));
  const eastern = (d: string) => (d === "؟" ? d : "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
  const R = (
    <g>
      {p.head ? <ChapterHead label={p.head} /> : null}
      {/* السؤال الأول: قوم بلا سجل مكتوب — مِسْحَج يكشط التراب، ولفافة فارغة */}
      <rect x={1030} y={180} width={700} height={340} rx={16} fill="none" stroke={C.inkSoft} strokeWidth={3} opacity={prog(t, q1 - 0.1, q1 + 0.4)} />
      <rect x={1050} y={400} width={660} height={100} fill="#D9C29A" opacity={0.8 * prog(t, q1 - 0.1, q1 + 0.4)} />
      <g transform={`translate(${1250 + Math.sin(scrape * Math.PI * 6) * 40} ${400 - 10 * scrape}) rotate(-35)`} opacity={scrape > 0 ? 1 : 0}>
        <path d="M0 0 L60 -10 L70 20 L10 30 Z" fill="#9AA0A6" stroke={C.ink} strokeWidth={3} />
        <rect x={66} y={-2} width={90} height={18} rx={8} fill="#8B5E3C" stroke={C.ink} strokeWidth={3} />
      </g>
      <g opacity={scroll} transform={`translate(1560 300)`}>
        <rect x={-110} y={-80} width={220} height={150} rx={6} fill="#FFFAF0" stroke={C.ink} strokeWidth={4} />
        <ellipse cx={-110} cy={-5} rx={14} ry={78} fill="#E8D6B3" stroke={C.ink} strokeWidth={4} />
        <ellipse cx={110} cy={-5} rx={14} ry={78} fill="#E8D6B3" stroke={C.ink} strokeWidth={4} />
        {[-40, -5, 30].map((y) => (
          <line key={y} x1={-80} x2={80} y1={y} y2={y} stroke={C.inkSoft} strokeWidth={3} strokeDasharray="4 10" opacity={1 - empty} />
        ))}
        <SText x={0} y={20} size={70} o={empty} color={C.ribbon}>
          ؟
        </SText>
      </g>
      {/* السؤال الثاني: كم عمره؟ — طبقات ومسطرة عمق، وعدّاد يدور ولا يستقر على رقم */}
      <g opacity={prog(t, q2 - 0.2, q2 + 0.3)}>
        {["#DCC6A0", "#CDB088", "#B9966E", "#A07B58"].map((c, i) => (
          <rect key={i} x={1040} y={570 + i * 80} width={480} height={80} fill={c} />
        ))}
        <rect x={1040} y={570} width={480} height={320} fill="none" stroke={C.ink} strokeWidth={3} />
      </g>
      <g opacity={rod}>
        <rect x={1540} y={570} width={34} height={320 * rod} fill="#F2E3C2" stroke={C.ink} strokeWidth={3} />
        {Array.from({ length: 8 }, (_, i) => (
          <line key={i} x1={1540} x2={1556} y1={590 + i * 40} y2={590 + i * 40} stroke={C.ink} strokeWidth={3} opacity={i * 40 < 320 * rod ? 1 : 0} />
        ))}
      </g>
      <g opacity={items[0]}>
        <Find k="tool" x={1420} y={810} s={0.45} p={items[0]!} />
      </g>
      <g opacity={items[1]}>
        <Find k="home" x={1260} y={720} s={0.4} p={items[1]!} />
      </g>
      <g opacity={items[2]}>
        <Find k="food" x={1110} y={620} s={0.45} p={items[2]!} />
      </g>
      <g opacity={rod}>
        <rect x={1590} y={620} width={150} height={74} rx={8} fill="#2B1E14" />
        <SText x={1665} y={672} size={44} font="tajawal" weight={700} color={C.sand} o={settle >= 1 || spin <= 0 ? 1 : 0.55}>
          {digits.map(eastern).join("")}
        </SText>
        <SText x={1665} y={730} size={30} font="tajawal" weight={700} color={C.inkSoft}>
          سنة
        </SText>
      </g>
    </g>
  );
  // السؤال الثالث: دائرة ضوء العدسة على الشواهد، وما خارجها يبقى في العتمة
  const L = (
    <g>
      <rect x={150} y={80} width={810} height={860} fill="#1E140E" opacity={0.75 * light} />
      <defs>
        <radialGradient id="c77-light" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.75" stopColor="#FFF3DC" stopOpacity={1} />
          <stop offset="1" stopColor="#FFF3DC" stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={560} cy={520} r={250 * light} fill="url(#c77-light)" opacity={light} />
      <g opacity={light}>
        <Find k="tool" x={480} y={470} s={0.6} p={1} />
        <Find k="food" x={640} y={560} s={0.6} p={1} />
        <Find k="art" x={540} y={600} s={0.35} p={1} />
      </g>
      <Ink d="M560 270 a250 250 0 1 1 -0.1 0" w={8} p={bound} c={C.gold} />
      {[
        [250, 200],
        [850, 260],
        [260, 820],
        [860, 820],
      ].map(([x, y], i) => (
        <SText key={i} x={x!} y={y!} size={64} o={qmark * 0.8} color={C.sand}>
          ؟
        </SText>
      ))}
    </g>
  );
  return <Book id="c77" t={t} dur={dur} exit={exit} cam={cam} R={R} L={L} />;
};

// ─── c7-s8: الختام: «قصة الإنسان عبر الزمن» قادمة، و«آدم عليه السلام» على أفق الصفحة الأولى، ثم تنقلب فتظهر صفحة «دفاتر الزمن» ───
const Closing: React.FC<HzProps> = ({ t, tl, dur, p }) => {
  const tag = prog(t, 0.05, 0.6, easeOut);
  const series = ["قصة", "الإنسان", "عبر", "الزمن"].map((w) => pop(t, at(tl, w, 1)));
  const hz = prog(t, at(tl, "اليوم") - 0.1, at(tl, "بدأنا") + 0.3);
  const adam = pop(t, at(tl, "آدم"));
  const abi = pop(t, at(tl, "أبي"));
  const one = pop(t, at(tl, "أولى"));
  const turnAt = at(tl, "نفتح") - 0.1;
  const turned = t >= turnAt + 0.8;
  const title = prog(t, at(tl, "دفاتر") - 0.05, at(tl, "دفاتر") + 0.7, easeOut);
  const glass = prog(t, turnAt + 0.6, at(tl, "دفاتر"));
  const ribbon = prog(t, end(tl, "الزمن", 2) + 0.1, end(tl, "الزمن", 2) + 0.8, easeOut);
  const pull = prog(t, end(tl, "الزمن", 2) + 0.1, at(tl, "والحمد") - 0.1);
  const night = prog(t, dur - 1.2, dur);
  const before = (
    <Book
      id="c78a"
      t={t}
      dur={dur}
      exit="turn"
      turnAt={turnAt}
      cam={camPath(t, { cx: 600, cy: 470, s: 1.12 }, [{ a: at(tl, "اليوم") - 0.2, b: at(tl, "بدأنا") + 0.4, cx: 1370, cy: 560, s: 1.1 }])}
      L={
        <g>
          <g opacity={tag} transform={`translate(0 ${(1 - tag) * -30})`}>
            <path d="M760 160 H360 V214 H760 L744 187 Z" fill={C.ribbon} />
            <SText x={732} y={198} size={30} font="tajawal" weight={700} color={C.page} anchor="start">
              الحلقة القادمة
            </SText>
          </g>
          {["قصة", "الإنسان", "عبر", "الزمن"].map((w, i) => (
            <Word key={i} x={[700, 540, 400, 280][i]!} y={420} size={64} p={series[i]!} color={C.ink}>
              {w}
            </Word>
          ))}
          <Ink d="M780 460 H220" w={3} p={series[3]!} c={C.gold} />
          <Find k="art" x={500} y={640} s={0.6} p={series[3]!} />
        </g>
      }
      R={
        <g>
          <path d="M1720 640 C1500 636 1220 642 1010 638" fill="none" stroke={C.ink} strokeWidth={4} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - hz} />
          <Word x={1370} y={560} size={96} p={adam} color={C.ink}>
            آدم عليه السلام
          </Word>
          <Word x={1370} y={720} size={44} p={abi} font="tajawal" weight={500} color={C.inkSoft}>
            أبو البشر
          </Word>
        </g>
      }
    />
  );
  const cam = { cx: 960, cy: mix(520, 540, pull), s: mix(1, 0.86, pull) };
  const after = (
    <Book
      id="c78b"
      t={t}
      dur={dur}
      cam={cam}
      light={1 + 0.2 * pull}
      L={
        <SText x={230} y={900} size={40} o={one} color={C.inkSoft}>
          ١
        </SText>
      }
      R={
        <g>
          <g opacity={glass} transform="translate(1365 330)">
            <path d="M-50 -80 H50 L8 0 L50 80 H-50 L-8 0 Z" fill="none" stroke={C.gold} strokeWidth={7} strokeLinejoin="round" />
            <path d={`M${-36 + 30 * glass} -66 H${36 - 30 * glass} L4 -8 H-4 Z`} fill={C.sand} />
            <path d={`M${-36 * glass} 70 H${36 * glass} L0 ${70 - 44 * glass} Z`} fill={C.sand} />
          </g>
          <SText x={1365} y={580} size={124} o={title} dy={(1 - title) * 14} color={C.ink}>
            دفاتر الزمن
          </SText>
          <Ink d="M1560 640 H1170" w={4} p={title} c={C.gold} />
          <g transform={`translate(0 ${(1 - ribbon) * -620})`} opacity={ribbon > 0 ? 1 : 0}>
            <path d="M1652 60 H1678 V860 L1665 844 L1652 860 Z" fill={C.ribbon} stroke={C.ink} strokeWidth={2} />
          </g>
        </g>
      }
    />
  );
  return (
    <>
      {turned ? after : before}
      <AbsoluteFill style={{ background: C.night, opacity: night }} />
    </>
  );
};

export const HZ_SCENES_D: Record<string, React.FC<HzProps>> = {
  "gen-fan": GenFan,
  lineline: Lineline,
  threshold: Threshold,
  method: Method,
  roadmap: Roadmap,
  questions: Questions,
  closing: Closing,
};
