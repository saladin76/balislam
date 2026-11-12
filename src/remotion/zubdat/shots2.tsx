import React from "react";
import type { CamKey } from "../illus/shots/kit";
import { Arrow, Card, Cross, Foot, Icon, InkPerson, Kaaba, Mark, Mosque, Stroke, Write, heartPath, lerp, fam, measure, outCubic, prog, type Font, type IconId, type Z } from "./inkKit";
import type { InkCtx, InkShotDef } from "./shots";

/**
 * بقية مشاهد الحبر للحلقة 001 (زبدة الكتب). القاعدة نفسها: لا يُكتب على الشاشة إلا ما يُنطق،
 * وكل حدث لحظة كلمته، ولا حدث ولا قلم عند ذكر الله (الكاميرا تسكن تلقائيًا عند كل ذكر).
 */
const C = (t: number, x: number, y: number, z: number): CamKey => ({ t, x, y, z });
const wp = (frame: number, a: number, b: number) => prog(frame, a - 2, Math.max(a + 10, b), (t) => t);

/** أدوات مختصرة لكل مشهد */
const kit = (c: InkCtx) => {
  const { frame, z, at, end } = c;
  /** نص يُكتب من بداية كلمة إلى نهاية أخرى */
  const T = (id: string, x: number, y: number, text: string, size: number, from: [string, number, number?], to?: [string, number, number?], o: { font?: Font; weight?: number; color?: string; opacity?: number } = {}) => {
    const a = at(from[0], from[1], from[2]);
    const b = to ? end(to[0], to[1], to[2]) : a + Math.max(12, Array.from(text).length * 2.2);
    const tw = measure(text, size, fam(o.font ?? "hand")) * 1.1;
    if ((o.opacity ?? 1) > 0.2) c.reg([x - tw / 2, y - size * 0.95, x + tw / 2, y + size * 0.4], a);
    return <Write id={id} x={x} y={y} text={text} size={size} p={wp(frame, a, b)} c={o.color ?? z.ink} font={o.font ?? "hand"} weight={o.weight} opacity={o.opacity} z={z} />;
  };
  /** كلمة داخل إطار يُرسم ثم تُكتب الكلمة */
  const Box = (id: string, x: number, y: number, text: string, size: number, t0: number, o: { font?: Font; fill?: string; opacity?: number; dashed?: boolean; tEnd?: number } = {}) => {
    const w = measure(text, size, fam(o.font ?? "hand")) * 1.15 + size * 1.1;
    const h = size * 1.7;
    const pb = prog(frame, t0 - 4, t0 + 10);
    if ((o.opacity ?? 1) > 0.2) c.reg([x - w / 2, y - h * 0.62, x + w / 2, y + h * 0.38], t0);
    return (
      <g opacity={o.opacity ?? 1}>
        {o.dashed ? (
          <rect x={x - w / 2} y={y - h * 0.62} width={w} height={h} rx={14} fill="none" stroke={z.ink} strokeWidth={5} strokeDasharray="14 12" opacity={pb} />
        ) : (
          <Stroke d={`M${x + w / 2 - 14} ${y - h * 0.62} H${x - w / 2 + 14} Q${x - w / 2} ${y - h * 0.62} ${x - w / 2} ${y - h * 0.62 + 14} V${y + h * 0.38 - 14} Q${x - w / 2} ${y + h * 0.38} ${x - w / 2 + 14} ${y + h * 0.38} H${x + w / 2 - 14} Q${x + w / 2} ${y + h * 0.38} ${x + w / 2} ${y + h * 0.38 - 14} V${y - h * 0.62 + 14} Q${x + w / 2} ${y - h * 0.62} ${x + w / 2 - 14} ${y - h * 0.62} Z`} p={pb} c={z.ink} w={6} fill={o.fill ?? z.paper} fillP={pb} />
        )}
        <Write id={id} x={x} y={y + size * 0.12} text={text} size={size} p={wp(frame, t0, o.tEnd ?? t0 + Math.max(12, Array.from(text).length * 2.2))} c={z.ink} font={o.font ?? "hand"} z={z} />
      </g>
    );
  };
  const P = (a: number, b: number, e: (t: number) => number = outCubic) => prog(frame, a, b, e);
  return { frame, z, at, end, T, Box, P };
};

/** يد مفتوحة راحتها إلى أعلى (رسم خطي): راحة وأربع أصابع وإبهام */
const OpenHand: React.FC<{ p: number; z: Z }> = ({ p, z }) => {
  const fingers: [number, number][] = [[-42, 92], [-14, 108], [14, 104], [42, 86]];
  return (
    <g>
      <Stroke d="M-60 0 L-60 90 Q-60 130 0 130 Q60 130 60 90 L60 0" p={prog(p, 0, 0.4)} c={z.ink} w={8} fill={z.paper} fillP={prog(p, 0, 0.4)} />
      {fingers.map(([x, h], k) => (
        <Stroke key={k} d={`M${x - 13} 4 L${x - 13} ${-h + 13} Q${x - 13} ${-h} ${x} ${-h} Q${x + 13} ${-h} ${x + 13} ${-h + 13} L${x + 13} 4`} p={prog(p, 0.3 + k * 0.1, 0.6 + k * 0.1)} c={z.ink} w={7} fill={z.paper} fillP={prog(p, 0.3 + k * 0.1, 0.6 + k * 0.1)} />
      ))}
      <Stroke d="M60 70 Q100 50 112 10 Q118 -8 104 -12 Q92 -14 86 2 L70 40" p={prog(p, 0.7, 1)} c={z.ink} w={7} fill={z.paper} fillP={prog(p, 0.7, 1)} />
    </g>
  );
};

/** يدان متجاورتان مفتوحتان تستقبلان الماء (للوضوء)، بلا ملامح */
const Hands: React.FC<{ x: number; y: number; s?: number; p: number; z: Z }> = ({ x, y, s = 1, p, z }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <g transform="translate(-74 0) rotate(10) scale(-1 1)"><OpenHand p={p} z={z} /></g>
    <g transform="translate(74 0) rotate(-10)"><OpenHand p={p} z={z} /></g>
    {/* ماء مجتمع في الكفين */}
    <path d="M-120 70 Q0 110 120 70" fill="none" stroke={z.ink} strokeWidth={4} strokeDasharray="10 10" opacity={prog(p, 0.8, 1)} />
  </g>
);

/** قطرة ماء */
const Drop: React.FC<{ x: number; y: number; s?: number; z: Z; o?: number }> = ({ x, y, s = 1, z, o = 1 }) => (
  <path d="M0 -26 C10 -10 16 0 16 8 A16 16 0 0 1 -16 8 C-16 0 -10 -10 0 -26 Z" transform={`translate(${x} ${y}) scale(${s})`} fill={z.paper} stroke={z.ink} strokeWidth={5} opacity={o} />
);

/** ساعة حبرية بعقربين */
const Clock: React.FC<{ x: number; y: number; r: number; a1: number; a2: number; p: number; z: Z; wedge?: number }> = ({ x, y, r, a1, a2, p, z, wedge = 0 }) => (
  <g transform={`translate(${x} ${y})`} opacity={Math.min(1, p * 2)}>
    <circle r={r} fill={z.paper} stroke={z.ink} strokeWidth={9} />
    {wedge > 0 ? <path d={`M0 0 L0 ${-r + 12} A${r - 12} ${r - 12} 0 ${wedge > 0.5 ? 1 : 0} 1 ${Math.sin(wedge * 2 * Math.PI) * (r - 12)} ${-Math.cos(wedge * 2 * Math.PI) * (r - 12)} Z`} fill={z.hl} /> : null}
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * 2 * Math.PI;
      return <line key={i} x1={Math.sin(a) * (r - 16)} y1={-Math.cos(a) * (r - 16)} x2={Math.sin(a) * (r - 30)} y2={-Math.cos(a) * (r - 30)} stroke={z.ink} strokeWidth={i % 3 ? 4 : 8} strokeLinecap="round" />;
    })}
    <line x1={0} y1={0} x2={Math.sin(a1) * r * 0.5} y2={-Math.cos(a1) * r * 0.5} stroke={z.ink} strokeWidth={12} strokeLinecap="round" />
    <line x1={0} y1={0} x2={Math.sin(a2) * r * 0.75} y2={-Math.cos(a2) * r * 0.75} stroke={z.ink} strokeWidth={7} strokeLinecap="round" />
    <circle r={10} fill={z.ink} />
  </g>
);

/** سحابة خاطرة صغيرة */
const Cloud: React.FC<{ x: number; y: number; r: number; p: number; z: Z; o?: number }> = ({ x, y, r, p, z, o = 1 }) =>
  p <= 0 ? null : (
    <g transform={`translate(${x} ${y}) scale(${p})`} opacity={Math.min(1, p) * o}>
      <path d={`M${-r} 0 a${r * 0.6} ${r * 0.6} 0 0 1 ${r * 0.7} ${-r * 0.6} a${r * 0.7} ${r * 0.7} 0 0 1 ${r * 1.1} ${r * 0.1} a${r * 0.5} ${r * 0.5} 0 0 1 ${r * 0.2} ${r * 0.9} Z`} fill={z.paper} stroke={z.ink} strokeWidth={6} strokeLinejoin="round" />
    </g>
  );

/** سطور رمادية (نص محفوظ بلا كتابته) */
const Lines: React.FC<{ x: number; y: number; w: number; n: number; p: number; z: Z; gap?: number }> = ({ x, y, w, n, p, z, gap = 34 }) => (
  <g>
    {Array.from({ length: n }, (_, i) => (
      <Stroke key={i} d={`M${x + w / 2} ${y + i * gap} L${x - w / 2 + (i === n - 1 ? w * 0.35 : 0)} ${y + i * gap}`} p={prog(p, i / (n + 1), (i + 2) / (n + 1))} c={z.faint} w={10} />
    ))}
  </g>
);

/** تمهيد الآية: اسم السورة وحده، بهدوء؛ لا شيء عند ذكر الله، والسكون قبل التلاوة */
const verseIntro = (surah: string): InkShotDef => ({
  nameAr: `تمهيد الآية: سورة ${surah}`,
  render: (c) => {
    const { frame, z, at, P } = kit(c);
    const tS = at("سورة", 0.5);
    const ln = P(tS - 6, tS + 18, (t) => t);
    return {
      cam: [C(0, 960, 500, 1.0)],
      world: (
        <g>
          <Stroke d="M1260 600 L660 600" p={ln} c={z.ink} w={5} />
          <Write id="vs" x={960} y={540} text={`سورة ${surah}`} size={110} p={wp(frame, tS, c.end(surah, 0.9))} c={z.ink} font="head" z={z} />
        </g>
      ),
    };
  },
});

/**
 * الخاتمة المتحركة (نموذج للمراجعة): 8 ثوانٍ. أول ما يُرسم إطارا عنصري يوتيوب (الحلقة التالية والاشتراك)
 * لأنهما يظهران من أول ثانية؛ ثم الشعار المعتمد كما هو، ثم مهمة الحلقة (مما قيل في المشهد 26)، ثم سهم إلى الحلقة التالية.
 * لا نص فيها إلا ما نُطق في الحلقة، واسم القناة.
 */
const outro: InkShotDef = {
  nameAr: "الخاتمة: الحلقة التالية والاشتراك ومهمة الحلقة",
  render: (c) => {
    const { frame, z, P } = kit(c);
    const s = (sec: number) => Math.round(sec * 30);
    const slot = P(s(0), s(1.2), (t) => t);
    const ring = P(s(0.4), s(1.5), (t) => t);
    const logoIn = P(s(1.5), s(2.3));
    const name = wp(frame, s(2.2), s(3.2));
    const sweep = P(s(3.2), s(3.9));
    const note = P(s(4.0), s(4.7));
    const box = P(s(5.0), s(5.4));
    const link = P(s(5.6), s(6.6), (t) => t);
    const close = P(s(7.2), s(8));
    return {
      cam: [C(0, 960, 520, 1.0)],
      world: (
        <g opacity={1 - 0.15 * close}>
          {/* إطار الحلقة التالية (يسار، اتجاه القراءة) */}
          <rect x={210} y={250} width={720} height={405} rx={6} fill={z.hl} opacity={0.35 * P(s(0.5), s(1.3))} />
          <Stroke d="M210 250 H930 V655 H210 Z" p={slot} c={z.ink} w={8} />
          <Write id="nx" x={570} y={205} text="الحلقة القادمة" size={60} p={wp(frame, s(0.6), s(1.6))} c={z.ink} z={z} />
          {/* دائرة الاشتراك حول الشعار المعتمد */}
          <circle cx={1440} cy={420} r={150} fill={z.hl} fillOpacity={0.35 * ring} stroke={z.ink} strokeWidth={8} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - ring} />
          <foreignObject x={1440 - 130} y={420 - 130} width={260} height={260} opacity={logoIn}>
            <div style={{ width: 260, height: 260, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${0.8 + 0.2 * logoIn})` }}>{c.logo(220)}</div>
          </foreignObject>
          <Mark x={1440 - 190} y={640} w={380} h={34} p={sweep} z={z} />
          <Write id="ch" x={1440} y={666} text="زبدة الكتب" size={90} p={name} c={z.ink} font="head" z={z} />
          {/* مهمة الحلقة: الورقة اللاصقة من المشهد 26 */}
          <g transform={`translate(1150 ${820 - 60 * (1 - note)}) rotate(-2)`} opacity={note}>
            <rect x={-260} y={-70} width={520} height={140} fill={z.hl} />
            <text x={30} y={14} textAnchor="middle" direction="rtl" style={{ fontFamily: fam("hand"), fontSize: c.task && c.task.length > 26 ? 38 : 50, fill: z.ink }}>{c.task || ""}</text>
            <rect x={-235} y={-26} width={48} height={48} rx={6} fill="none" stroke={z.ink} strokeWidth={6} opacity={box} />
          </g>
          {/* ومنها إلى الحلقة القادمة */}
          <Stroke d="M880 850 C720 870 600 800 570 670" p={link} c={z.ink} w={6} />
          <Stroke d="M540 694 L570 670 L596 698" p={P(s(6.4), s(6.8))} c={z.ink} w={6} />
        </g>
      ),
    };
  },
};

export const INK_SHOTS_2: Record<string, InkShotDef> = {
  outro,
  "verse-intro-taha": verseIntro("طه"),
  "verse-intro-muminun": verseIntro("المؤمنون"),
  "verse-intro-nahl": verseIntro("النحل"),
  // S02 — العادة والوعي
  "habit-attention": {
    nameAr: "العادة نعمة، لكنها قد تضعف الانتباه",
    render: (c) => {
      const { frame, z, at, T, Box, P } = kit(c);
      // السكريبت المعتمد (١١ نوفمبر): «الاعتياد على الصلاة نعمة؛ فبه تثبت العبادة… لكنّ ما نألفه قد نفعله… وذهننا في مكان آخر.
      // نقرأ، فتسبقنا الأفكار إلى مواعيدنا وهمومنا. لذلك لا نبحث عن صلاة جديدة، بل عن قلب أكثر انتباهًا…» — ولا حدث عند «شرعها الله لنا».
      const tHab = at("الاعتياد", 0.02);
      const tAib = at("نعمة", 0.08);
      const tFixed = at("تثبت", 0.12);
      const tAtt = at("نألفه", 0.24);
      const tWeak = at("وذهننا", 0.32);
      const tWords = at("نقرأ", 0.42);
      const tThought = at("الأفكار", 0.46);
      const tDates = at("مواعيدنا", 0.5);
      const tWorry = at("وهمومنا", 0.54);
      const tInvent = at("نبحث", 0.62);
      const tNew = at("جديدة", 0.68);
      const tQalb = at("قلب", 0.74);
      const tNotice = at("انتباها", 0.8);
      const cells: [number, number][] = [];
      for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) cells.push([1300 - k * 160, 220 + r * 150]);
      const KEEP = 7;
      // الشبكة تتوارى عند «الكلمات» قبل أن تُرسم سطور القراءة مكانها، فلا تداخل
      const gridOut = P(tWords - 16, tWords + 2);
      const keepMove = P(tWords - 16, tWords + 6);
      const kx = lerp(cells[KEEP]![0], 520, keepMove);
      const ky = lerp(cells[KEEP]![1], 420, keepMove);
      return {
        focus: [[tHab, 1000, 300], [tAib, 1560, 240], [tFixed, 980, 370], [tWeak, 980, 370], [tAtt, cells[KEEP]![0], cells[KEEP]![1]], [tWords, 1300, 420], [tDates, 1440, 230], [tWorry, 1680, 330], [tInvent, 1250, 700], [tQalb, 520, 420], [tNotice, 520, 440]],
        cam: [C(0, 980, 400, 1.05), C(tThought - 10, 1080, 470, 1.0), C(tNotice - 8, 900, 500, 1.04)],
        world: (
          <g>
            <g opacity={1 - gridOut}>
              {cells.map(([x, y], k) => {
                const on = P(tHab + k * 2, tHab + k * 2 + 10);
                const dim = k === KEEP ? 1 : 1 - 0.75 * P(tWeak, tWeak + 18);
                return (
                  <g key={k} opacity={on * dim}>
                    <rect x={x - 54} y={y - 52} width={120} height={120} rx={14} fill={z.ink} opacity={0.1} />
                    <rect x={x - 60} y={y - 60} width={120} height={120} rx={14} fill={z.paper} stroke={z.ink} strokeWidth={5} />
                    {k !== KEEP ? <rect x={x - 60} y={y - 60} width={120} height={120} rx={14} fill={z.ink} opacity={0.2 * P(tWeak, tWeak + 18)} /> : null}
                    {[0, 1, 2, 3, 4].map((d) => (
                      <circle key={d} cx={x + 40 - d * 20} cy={y + 30} r={7} fill={P(tFixed + k + d, tFixed + k + d + 6) > 0.5 ? z.hl : z.paper} stroke={z.ink} strokeWidth={3} />
                    ))}
                  </g>
                );
              })}
              {/* «نعمة»: العادة نعمة تُثبت العبادة — تُبرز ولا تُشطب */}
              <Mark x={1560 - 110} y={148} w={220} h={70} p={P(tAib + 2, tAib + 16)} z={z} />
              {T("ab", 1560, 200, "نعمة", 70, ["نعمة", 0.08])}
            </g>
            {/* مربع الانتباه يبقى ويتقدم */}
            <g opacity={P(tAtt - 4, tAtt + 6)}>
              <rect x={kx - 76} y={ky - 76} width={152} height={152} rx={20} fill={P(tNotice, tNotice + 16) > 0 ? z.hl : "none"} fillOpacity={P(tNotice, tNotice + 16)} stroke={z.ink} strokeWidth={10} />
              <rect x={kx - 60} y={ky - 60} width={120} height={120} rx={14} fill="none" stroke={z.ink} strokeWidth={5} opacity={keepMove} />
            </g>
            {/* «قلب أكثر انتباهًا»: القلب يدخل المربع الباقي، ثم يُبرز عند «انتباهًا» */}
            <g opacity={P(tQalb - 4, tQalb + 8) * keepMove}>
              <path d={heartPath(kx, ky + 6, 52)} fill="none" stroke={z.ink} strokeWidth={6} />
            </g>
            <Mark x={520 - 170} y={548} w={340} h={70} p={P(tNotice + 2, tNotice + 18) * keepMove} z={z} />
            {T("at", 520, 600, "انتباها", 80, ["انتباها", 0.8], undefined, { font: "head", opacity: keepMove * keepMove })}
            {/* نقرأ الكلمات… وتنتقل أفكارنا */}
            <g opacity={P(tWords - 4, tWords + 8)}>
              <Lines x={1300} y={400} w={420} n={3} p={P(tWords - 2, tWords + 10, (t) => t)} z={z} />
            </g>
            <Arrow x1={1250} y1={372} x2={1356} y2={250} p={P(tThought, tThought + 14)} c={z.ink} w={6} bend={30} />
            <g transform={`translate(1440 ${lerp(120, 220, P(tDates - 4, tDates + 10))}) rotate(-4)`} opacity={P(tDates - 4, tDates + 6)}>
              <rect x={-80} y={-80} width={160} height={160} rx={12} fill={z.hl} stroke={z.ink} strokeWidth={5} />
            </g>
            <Icon id="calendar" x={1440} y={220} s={1.1} p={P(tDates - 2, tDates + 12)} c={z.ink} />
            {/* بعيدًا عن سحابة «همومنا» فلا تتداخل العبارتان (مراجعة القاعدة السادسة، ٨ نوفمبر) */}
            {T("mw", 1440, 358, "مواعيدنا", 62, ["مواعيدنا", 0.56])}
            <g transform="translate(1640 330)" opacity={P(tWorry - 2, tWorry + 8)}>
              <circle r={70 * P(tWorry - 2, tWorry + 12)} fill={z.faint} opacity={0.35} />
            </g>
            <Cloud x={1640} y={330} r={60} p={P(tWorry - 2, tWorry + 12)} z={z} />
            {T("hm", 1630, 448, "همومنا", 62, ["وهمومنا", 0.6])}
            {/* ليس اختراع صلاة جديدة */}
            {Box("nw", 1250, 720, "صلاة جديدة", 64, tInvent, { dashed: true, tEnd: c.end("جديدة", 0.76) })}
            <Cross x1={1440} x2={1060} y={706} p={P(tNew + 10, tNew + 24)} z={z} />
          </g>
        ),
      };
    },
  },

  // S04 — الأمانة في القراءة، والأحكام مع الخشوع
  "honest-reading": {
    nameAr: "نقرأ بأمانة: كلام المؤلف وشرحنا، والصحة مع الخشوع",
    render: (c) => {
      const { frame, z, at, end, T, Box, P } = kit(c);
      // السكريبت المعتمد (١١ نوفمبر): «سنميز بين ما يقوله المؤلف وما نضيفه من شرح. وسنتذكر أن الخشوع لا يغني عن صحة الصلاة،
      // كما أن صحة أفعالها لا تعني أننا وصلنا إلى كمال الخشوع. فلكلٍّ موضعه، ونحن نطلب الأمرين معًا.»
      const tMayyiz = at("سنميز", 0.06);
      const tAuth = at("يقوله", 0.12);
      const tNisba = end("المؤلف", 0.16);
      const tAdd = at("نضيفه", 0.2);
      const tKh1 = at("الخشوع", 0.36);
      const tYughni = at("يغني", 0.4);
      const tSihha = at("صحة", 0.44);
      const tSihha2 = at("صحة", 0.56, 2);
      const tTani = at("تعني", 0.62);
      const tKamal = at("كمال", 0.7);
      const tMawdi = at("موضعه", 0.82);
      const tTogether = at("معا", 0.95);
      const top = 1 - 0.75 * P(tKh1 - 12, tKh1 + 6);
      return {
        focus: [[tMayyiz, 900, 320], [tAuth, 1150, 300], [tNisba, 1400, 300], [tAdd, 620, 300], [tKh1, 700, 720], [tYughni, 960, 660], [tSihha, 1250, 720], [tSihha2, 1250, 720], [tTani, 960, 780], [tKamal, 700, 720], [tMawdi, 960, 720], [tTogether, 960, 600]],
        cam: [C(0, 1100, 380, 1.08), C(tKh1 - 10, 960, 600, 1.0)],
        world: (
          <g>
            <g opacity={top}>
              {/* كتاب المؤلف: ما يقوله يُنسب إليه */}
              <g opacity={P(tAuth - 6, tAuth + 8)} transform={`translate(1640 ${330 - 30 * (1 - P(tAuth - 6, tAuth + 10))}) rotate(4)`}>
                <rect x={-80} y={-110} width={160} height={220} rx={10} fill={z.ink} />
                <rect x={-56} y={-80} width={112} height={14} rx={4} fill={z.hl} />
              </g>
              <Stroke d="M900 160 L900 480" p={P(tMayyiz - 2, tMayyiz + 14)} c={z.ink} w={5} />
              {Box("au", 1180, 320, "ما يقوله المؤلف", 62, tAuth - 6, { tEnd: end("المؤلف", 0.16) })}
              <Arrow x1={1430} y1={300} x2={1550} y2={300} p={P(tNisba, tNisba + 14)} c={z.ink} w={7} />
              <g transform="translate(600 320) rotate(-2)" opacity={P(tAdd - 6, tAdd + 6)}>
                <rect x={-230} y={-80} width={460} height={160} fill={z.hl} />
              </g>
              {T("ad", 600, 330, "ما نضيفه من شرح", 66, ["نضيفه", 0.2], ["شرح", 0.24])}
            </g>
            {/* الخشوع (قلب) والصحة (كتاب الأحكام): كلٌّ لا يغني عن الآخر */}
            <g opacity={P(tKh1 - 2, tKh1 + 10)}><path d={heartPath(690, 600, 46)} fill="none" stroke={z.ink} strokeWidth={7} /></g>
            <g opacity={1 - P(tKamal - 8, tKamal + 2)}>{T("kh", 690, 730, "الخشوع", 84, ["الخشوع", 0.36], undefined, { font: "head" })}</g>
            {T("km", 690, 730, "كمال الخشوع", 76, ["كمال", 0.7], ["الخشوع", 0.72, 2], { font: "head" })}
            {Box("sh", 1280, 720, "صحة الصلاة", 84, tSihha, { font: "head", tEnd: end("الصلاة", 0.48) })}
            <Icon id="book" x={1720} y={716} s={0.95} p={P(tSihha - 2, tSihha + 14)} c={z.ink} />
            {/* «لا يغني عن»: سهم من الخشوع إلى الصحة يُشطب */}
            <g opacity={1 - P(tSihha2 - 8, tSihha2 + 2)}>
              <Arrow x1={880} y1={640} x2={1060} y2={640} p={P(tYughni, tYughni + 12)} c={z.ink} w={6} bend={40} />
              <Cross x1={1070} x2={870} y={606} p={P(tYughni + 12, tYughni + 24)} z={z} />
            </g>
            {/* «لا تعني… كمال الخشوع»: سهم من الصحة إلى الخشوع يُشطب */}
            <g opacity={1 - P(tMawdi - 8, tMawdi + 2)}>
              <Arrow x1={1060} y1={820} x2={880} y2={820} p={P(tTani, tTani + 12)} c={z.ink} w={6} bend={-40} />
              <Cross x1={1070} x2={870} y={846} p={P(tTani + 12, tTani + 24)} z={z} />
            </g>
            {/* «فلكلٍّ موضعه»: كلٌّ يُثبَّت في مكانه بخط تحته */}
            <Stroke d="M540 790 L840 790" p={P(tMawdi, tMawdi + 12)} c={z.hl} w={16} />
            <Stroke d="M1130 790 L1430 790" p={P(tMawdi + 4, tMawdi + 16)} c={z.hl} w={16} />
            {/* «نطلب الأمرين معًا»: قوس يجمعهما من فوق */}
            <Stroke d="M1180 640 Q960 520 800 600" p={P(tTogether - 4, tTogether + 14)} c={z.hl} w={22} />
            <Stroke d="M1180 640 Q960 520 800 600" p={P(tTogether - 4, tTogether + 14)} c={z.ink} w={6} />
            {T("mm", 975, 540, "معا", 72, ["معا", 0.95], undefined, { font: "head" })}
          </g>
        ),
      };
    },
  },

  // S05 — المفتاح الأول: لا نجعل العجلة تسرق السكينة
  "rush-key": {
    nameAr: "مفاتيح الصلاة: من العجلة إلى التهيؤ",
    render: (c) => {
      const { frame, z, at, end, T, Box, P } = kit(c);
      // السكريبت المعتمد (١١ نوفمبر): «أول ما يستوقفنا في مفاتيح الصلاة هو العجلة… نسابق الوقت… ويلفت المؤلف انتباهنا إلى أن
      // السكينة لا تجتمع بسهولة مع هذا الاستعجال. فالعبادة ليست مهمة نعبرها على عجل، بل وقت نقبل فيه على الله.» — لا حدث عند «الله».
      const tKeys = at("مفاتيح", 0.06);
      const tTanbih = at("انتباهنا", 0.42);
      const tRush = at("العجلة", 0.14);
      const tCalm = at("السكينة", 0.5);
      const tTask = at("مهمة", 0.72);
      const tSkip = at("نعبرها", 0.76);
      const tFast = at("عجل", 0.8);
      const tEnd = end("عجل", 0.82);
      const tTime = at("وقت", 0.86);
      const tGive = at("نقبل", 0.9);
      // الساعة: تدور مسرعة مع «العجلة» وتسكن عند «سكينة»؛ وتعود تسرع مع «تجاوزها بأسرع»، ثم يُشطب ذلك فتسكن
      const spin1 = prog(frame, tRush - 6, tCalm, (t) => t);
      const spin2 = prog(frame, tSkip - 2, tEnd - 6, (t) => t * t);
      const a2 = (spin1 * 16 + spin2 * 10) * Math.PI;
      const a1 = (spin1 * 2.5 + spin2 * 1.5) * Math.PI;
      const calm = P(tCalm - 2, tCalm + 16) * (1 - 0.8 * P(tSkip, tSkip + 8)) + 0.8 * P(tEnd, tEnd + 14);
      const wedge = 0.25 * P(tTime, end("فيه", 0.94), (t) => t);
      // المصلي: يدخل مسرعًا مع «العجلة» و«نسابق الوقت»، يقف عند «السكينة»، وعلى سجادته عند «وقت»، ويقف للصلاة عند «نقبل»
      const walk = P(tRush - 6, at("لننتهي", 0.34), (t) => t);
      const px = lerp(250, 450, walk);
      const bob = walk > 0 && walk < 1 ? -10 * Math.abs(Math.sin(frame * 0.55)) : 0;
      const stop = P(at("لننتهي", 0.34) - 2, at("لننتهي", 0.34) + 8);
      const ready = P(tGive - 2, tGive + 10);
      const speed = P(tRush - 4, tRush + 4) * (1 - stop);
      const pIn = P(tRush - 8, tRush + 4);
      const list = P(at("ليست", 0.7) - 2, tTask + 6);
      c.reg([210, 560, 620, 860], tRush);
      return {
        focus: [[tKeys, 1200, 230], [tRush, 700, 600], [tTanbih, 960, 540], [tCalm, 900, 600], [tTask, 1400, 640], [tSkip, 600, 640], [tFast, 1300, 700], [tTime, 1400, 480], [tGive, 500, 700]],
        cam: [C(0, 1250, 280, 1.25), C(tRush - 8, 760, 560, 1.12), C(tCalm - 4, 1000, 560, 1.05), C(tTask - 8, 1100, 600, 1.05), C(tEnd + 10, 960, 560, 1.0)],
        world: (
          <g>
            {/* مفتاح وباب الكتاب */}
            <g transform="translate(1540 220)" opacity={P(tKeys - 4, tKeys + 6)}>
              <Stroke d="M40 0 A34 34 0 1 1 -28 0 A34 34 0 1 1 40 0 M-28 0 L-150 0 M-120 0 L-120 30 M-90 0 L-90 22" p={P(tKeys - 2, tKeys + 18)} c={z.ink} w={9} />
            </g>
            {Box("mk", 1170, 230, "مفاتيح الصلاة", 66, tKeys, { font: "head", tEnd: end("الصلاة", 0.08) })}
            <Clock x={960} y={540} r={160} a1={a1} a2={a2} p={P(tRush - 8, tRush + 4)} z={z} wedge={wedge} />
            <circle cx={960} cy={540} r={160 + 36 * Math.min(1, calm)} fill="none" stroke={z.hl} strokeWidth={22} opacity={Math.min(1, calm)} />
            {/* «يلفت المؤلف انتباهنا»: تنبيه برتقالي حول الساعة المسرعة */}
            <circle cx={960} cy={540} r={196} fill="none" stroke={z.alert} strokeWidth={7} strokeDasharray="22 16" opacity={P(tTanbih - 4, tTanbih + 8) * (1 - P(tCalm - 2, tCalm + 10))} />
            {T("sk", 960, 790, "السكينة", 66, ["السكينة", 0.5], undefined, { font: "head" })}
            {/* السجادة تُبسط عند «وقت»: وقت نعطيه للعبادة */}
            <Stroke d="M330 820 L590 820 L560 852 L360 852 Z" p={P(tTime - 2, tTime + 12)} c={z.ink} w={6} fill={z.hl} fillP={0.6 * P(tTime + 4, tTime + 16)} />
            {/* خطوط السرعة خلف المسرع */}
            <g opacity={speed}>
              {[0, 1, 2].map((k) => (
                <line key={k} x1={px - 70 - k * 14} x2={px - 150 - k * 14} y1={700 + k * 36} y2={700 + k * 36} stroke={z.ink} strokeWidth={7} strokeLinecap="round" />
              ))}
            </g>
            <g opacity={pIn}>
              <InkPerson x={px} y={820 + bob} s={0.8} pose="walk" z={z} opacity={1 - stop} />
              <InkPerson x={px} y={820} s={0.8} pose="stand" z={z} opacity={stop * (1 - ready)} dir={-1} />
              <InkPerson x={px} y={820} s={0.8} pose="fold" z={z} opacity={ready} dir={-1} />
            </g>
            {/* «بل وقتٌ نقبل فيه»: بطاقة فسفورية تدخل عند «وقت» */}
            <g transform={`translate(${lerp(1700, 1470, P(tTime - 6, tTime + 10))} 450) rotate(3)`} opacity={P(tTime - 6, tTime + 4)}>
              <rect x={-190} y={-80} width={380} height={160} rx={10} fill={z.ink} opacity={0.12} transform="translate(10 12)" />
              <rect x={-190} y={-80} width={380} height={160} rx={10} fill={z.hl} stroke={z.ink} strokeWidth={5} />
            </g>
            {T("wq", 1470, 470, "وقت نقبل فيه", 62, ["وقت", 0.86], ["فيه", 0.94])}
            {/* «مهمة نريد تجاوزها بأسرع ما يمكن»: قائمة مهام تصعد، تُعلَّم بسرعة، ثم تُشطب كلها */}
            <g transform={`translate(1470 ${lerp(980, 700, list)}) rotate(-2)`} opacity={list}>
              <rect x={-180} y={-125} width={360} height={250} rx={12} fill={z.ink} opacity={0.12} transform="translate(10 12)" />
              <rect x={-180} y={-125} width={360} height={250} rx={12} fill={z.paper} stroke={z.ink} strokeWidth={6} />
              {[0, 1, 2].map((k) => (
                <g key={k} transform={`translate(0 ${-30 + k * 56})`}>
                  <rect x={100} y={-20} width={40} height={40} rx={8} fill="none" stroke={z.ink} strokeWidth={5} />
                  <Stroke d="M106 0 L118 14 L136 -14" p={P(tFast + k * 4, tFast + k * 4 + 6)} c={z.ink} w={7} />
                  <Stroke d={`M76 0 L${-140 + k * 26} 0`} p={P(tTask + 6 + k * 3, tTask + 14 + k * 3)} c={z.faint} w={11} />
                </g>
              ))}
            </g>
            {T("mh", 1470, 632, "مهمة", 56, ["مهمة", 0.7], undefined, { font: "head" })}
            {/* «نعبرها»: قفزة متقطعة فوق موضع الصلاة، كأنها شيء يُعبر */}
            <path d="M230 800 Q460 470 700 800" fill="none" stroke={z.ink} strokeWidth={6} strokeDasharray="16 14" pathLength={1} strokeDashoffset={0} opacity={P(tSkip - 2, tSkip + 4) * (1 - 0.6 * P(tEnd, tEnd + 12))} style={{ clipPath: `inset(0 ${100 - 100 * P(tSkip - 2, tSkip + 14, (t) => t)}% 0 0)` }} />
            {/* «ليست مهمة نعبرها على عجل»: شطب القائمة والقفزة معًا */}
            <Stroke d="M1300 590 L1640 820" p={P(tEnd - 12, tEnd)} c={z.alert} w={10} />
            <Stroke d="M1640 590 L1300 820" p={P(tEnd - 6, tEnd + 6)} c={z.alert} w={10} />
          </g>
        ),
      };
    },
  },

  // S06 — من العمل المزدحم إلى الصلاة: التهيؤ
  "busy-threshold": {
    nameAr: "من عمل مرهق إلى الصلاة: قيمة التهيؤ",
    render: (c) => {
      const { frame, z, at, T, P } = kit(c);
      // السكريبت المعتمد (١١ نوفمبر): «ننهي عملًا مرهقًا، ونقوم إلى الصلاة، لكن العمل لا يزال يشغل أفكارنا. هنا تظهر قيمة
      // التهيؤ؛ فلحظات نهدئ فيها عجلتنا، ونتذكر لماذا نصلي، قد تعيننا على الدخول في الصلاة بقدر أكبر من السكينة.»
      const tWork = at("عملا", 0.1);
      const tBusy = at("مرهقا", 0.14);
      const tMove = at("ونقوم", 0.2);
      const tMind = at("يشغل", 0.32);
      const tLux = at("قيمة", 0.42);
      const tPrep = at("التهيؤ", 0.46);
      const tCauses = at("نهدئ", 0.56);
      const tTaz = at("لماذا", 0.66);
      const tEnter = at("الدخول", 0.84);
      const tCalm = at("السكينة", 0.94);
      c.reg([400, 500, 740, 860], tMove + 6);
      const icons: [IconId, number, number, number][] = [["bag", 1500, 360, -8], ["phone", 1650, 470, 10], ["calendar", 1430, 560, 4], ["clock", 1620, 660, -6], ["cart", 1480, 760, 6]];
      const calm = P(tCauses, tCalm + 6);
      return {
        focus: [[tWork, 1550, 500], [tBusy, 1560, 560], [tMove, 1000, 600], [tMind, 560, 380], [tLux, 1000, 300], [tPrep, 1000, 520], [tCauses, 820, 760], [tTaz, 570, 470], [tEnter, 570, 760], [tCalm, 570, 470]],
        cam: [C(0, 1550, 480, 1.3), C(tMove - 6, 1000, 560, 1.0), C(tMind - 4, 850, 560, 1.1), C(tLux - 4, 980, 540, 1.0), C(tCalm - 8, 700, 640, 1.12)],
        world: (
          <g>
            {icons.map(([id, x, y, r], k) => (
              <Icon key={id} id={id} x={x} y={y} s={1.25} rot={r} p={P(tWork + k * 4, tWork + k * 4 + 10)} c={z.ink} opacity={1 - 0.5 * calm} />
            ))}
            {T("ws", 1560, 250, "عملا مرهقا", 60, ["عملا", 0.1], ["مرهقا", 0.14], { opacity: 1 - calm })}
            {/* الانتقال إلى الصلاة */}
            <Arrow x1={1340} y1={620} x2={720} y2={700} p={P(tMove, tMove + 18)} c={z.ink} w={8} bend={60} />
            <Stroke d="M420 800 L720 800 L680 850 L460 850 Z" p={P(tMove + 6, tMove + 22)} c={z.ink} w={6} fill={z.hl} fillP={0.45 * P(tMove + 10, tMove + 24)} />
            {/* «الدخول في الصلاة»: يقف للصلاة على سجادته، ويضيء ما حولها */}
            <ellipse cx={570} cy={830} rx={lerp(60, 230, P(tEnter - 2, tEnter + 16))} ry={lerp(16, 60, P(tEnter - 2, tEnter + 16))} fill={z.hl} opacity={0.55 * P(tEnter - 2, tEnter + 8)} style={{ mixBlendMode: "multiply" }} />
            <InkPerson x={570} y={810} s={1.05} pose="stand" p={P(tMove + 10, tMove + 28)} z={z} dir={-1} opacity={1 - P(tEnter, tEnter + 10)} />
            <InkPerson x={570} y={810} s={1.05} pose="fold" z={z} dir={-1} opacity={P(tEnter, tEnter + 10)} />
            {/* الذهن ما زال في العمل؛ يهدأ مع «نهدئ» ويخلو قبل «لماذا نصلي» */}
            <g opacity={1 - P(tCauses, tTaz - 2)}>
              <path d="M600 450 C760 360 1100 330 1380 380" fill="none" stroke={z.ink} strokeWidth={5} strokeDasharray="10 14" opacity={P(tMind, tMind + 14)} />
              <Cloud x={600} y={400} r={70} p={P(tMind - 2, tMind + 12)} z={z} />
              <Icon id="phone" x={600} y={385} s={0.55} p={P(tMind + 6, tMind + 16)} c={z.ink} />
            </g>
            {/* التهيؤ: مسافة بين العمل والصلاة */}
            <rect x={940} y={160} width={120} height={720} rx={20} fill={z.hl} opacity={0.75 * P(tPrep - 2, tPrep + 14)} />
            {T("th", 1000, 560, "التهيؤ", 72, ["التهيؤ", 0.46], undefined, { font: "head" })}
            {/* «قيمة التهيؤ» تُبرز، و«لماذا نصلي» سؤال فوق المصلي يُذكِّر بالغاية */}
            {T("tr", 1000, 300, "قيمة", 64, ["قيمة", 0.42], undefined, { font: "head" })}
            <g opacity={P(tTaz - 2, tTaz + 10) * (1 - P(tEnter - 6, tEnter + 6))}>{T("lm", 570, 470, "لماذا نصلي؟", 60, ["لماذا", 0.66], ["نصلي", 0.7])}</g>
            <Stroke d="M440 868 Q570 880 700 868" p={P(tCalm - 2, tCalm + 14)} c={z.hl} w={16} />
            {/* «لحظات نهدئ فيها… قد تعيننا»: سهم من شريط التهيؤ إلى المصلي */}
            <Stroke d="M960 760 Q820 820 700 830" p={P(tCauses - 2, at("تعيننا", 0.76) + 10, (t) => t)} c={z.hl} w={34} opacity={0.85} />
            <Arrow x1={930} y1={720} x2={660} y2={760} p={P(at("تعيننا", 0.76) - 2, at("تعيننا", 0.76) + 14)} c={z.ink} w={7} bend={30} />
            {T("sk", 570, 470, "السكينة", 64, ["السكينة", 0.94])}
          </g>
        ),
      };
    },
  },

  // S08 — «أول مرة»: تجديد لا اختراع
  "first-time": {
    nameAr: "لماذا «أول مرة أصلي»؟ تجربة المؤلف مع رسالة ابن القيم",
    render: (c) => {
      const { frame, z, at, end, T, P } = kit(c);
      const tWhy = at("لماذا", 0.02);
      const tTitle = at("أول", 0.06);
      const tAuthor = at("المؤلف", 0.14);
      const tRisala = at("رسالة", 0.22);
      // السكريبت المعتمد (١١ نوفمبر): «يروي أنه تأمل معاني من رسالة لابن القيم عن أسرار الصلاة… وهو واقف أمام الكعبة… كأنه يصلي
      // لأول مرة. ومن هذه التجربة، ومما جمعه وشرحه من كلام ابن القيم، تشكّل هذا الكتاب.»
      const tIbn = at("لابن", 0.25);
      const tAsrar = at("أسرار", 0.29);
      const tTaammul = at("تأمل", 0.18);
      const tMaani0 = at("معاني", 0.2);
      // «تأمل معاني» تُقال قبل «رسالة»: التحديد يبدأ بعد أن تنبسط المخطوطة
      const tMaani = Math.max(tMaani0, tRisala + 14);
      const tStand = at("واقف", 0.46);
      const tKaaba = at("الكعبة", 0.5);
      const tKa = at("كأنه", 0.53);
      const tPray = at("يصلي", 0.55);
      const tFirst = at("لأول", 0.57);
      const tThree = at("التجربة", 0.7);
      const tHadhihi = at("جمعه", 0.76);
      const tSharh = at("وشرحه", 0.79);
      const tAdd = at("كلام", 0.83);
      const tIlayha = end("القيم", 0.87, 2);
      const tKutub = tAdd;
      const tBook = at("الكتاب", 0.97);
      // اللحظة الأساسية: «كأنه يصلي لأول مرة» — ما حولها يهدأ، والمصلي في نور هادئ
      const moment = P(tKa - 6, tKa + 16);
      // اللحظة تبقى حتى «التجربة»: ما بعدها يبدأ بعد أن تستقر الجملة
      const after = P(tThree - 14, tThree + 2);
      const calm = 1 - 0.7 * moment * (1 - after);
      // «ومما جمعه»: ورقتان تظهران خلف المخطوطة ثم تنضمان إليها
      const three = P(tHadhihi - 4, tHadhihi + 8);
      const merge = P(tHadhihi + 8, tHadhihi + 26);
      const final = P(tBook - 10, tBook + 12);
      const others = 1 - final;
      const pray = P(tPray - 4, tPray + 8);
      const sheetX = lerp(lerp(640, 760, after), 960, final);
      const sheetS = lerp(1, 0.55, final);
      c.reg([380, 240, 900, 760], tRisala);
      return {
        focus: [[tWhy, 1400, 300], [tTitle, 960, 190], [tAuthor, 1320, 620], [tTaammul, 640, 480], [tRisala, 640, 480], [tIbn, 640, 440], [tAsrar, 640, 360], [tMaani, 640, 560], [tStand, 1320, 700], [tKa, 1320, 400], [tFirst, 1320, 380], [tThree, 700, 500], [tHadhihi, 760, 500], [tSharh, 1300, 400], [tKutub, 1090, 560], [tBook, 960, 520]],
        cam: [C(0, 960, 300, 1.12), C(tAuthor - 6, 960, 470, 1.0), C(tKa - 8, 1240, 520, 1.12), C(tThree - 14, 960, 500, 1.0)],
        world: (
          <g>
            <Mark x={960 - 230} y={156} w={460} h={52} p={P(tFirst, tFirst + 16) * (1 - after)} z={z} />
            {T("tt", 960, 200, "أول مرة أصلي", 96, ["أول", 0.06], ["أصلي", 0.1], { font: "head" })}
            <g opacity={1 - P(tAuthor - 4, tAuthor + 8)}>{T("why", 1420, 230, "؟", 170, ["لماذا", 0.02], undefined, { font: "head" })}</g>
            {/* المؤلف: شخص بلا ملامح، يقف ثم يصلي على سجادته */}
            <g opacity={lerp(1, 0.25, after) * others}>
              <InkPerson x={1320} y={800} s={0.9} pose="stand" p={P(tAuthor - 4, tAuthor + 14)} z={z} dir={-1} opacity={1 - pray} />
              <InkPerson x={1320} y={800} s={0.9} pose="fold" p={1} z={z} dir={-1} opacity={pray} />
              <ellipse cx={1320} cy={620} rx={lerp(60, 230, moment)} ry={lerp(40, 260, moment)} fill={z.hl} opacity={0.45 * moment} style={{ mixBlendMode: "multiply" }} />
              <Stroke d="M1450 814 L1190 814 L1170 840 L1470 840 Z" p={P(tStand - 4, tStand + 10)} c={z.ink} w={6} fill={z.hl} fillP={0.5 * P(tStand + 2, tStand + 14)} />
              {/* «وهو واقف أمام الكعبة»: الكعبة أمامه لحظة نطقها */}
              <g opacity={1 - P(tAdd - 10, tAdd)}><Kaaba x={1040} y={830} s={0.78} p={P(tKaaba - 4, tKaaba + 16)} z={z} band={0} /></g>
            </g>
            {T("au", 1320, 900 - 40, "المؤلف", 64, ["المؤلف", 0.14], undefined, { opacity: 1 - P(tStand - 8, tStand) })}
            {/* «وأن تلك المعاني حضرت معه»: سهم متقطع من المخطوطة إلى المؤلف */}
            <path d="M860 470 Q1080 380 1250 560" fill="none" stroke={z.ink} strokeWidth={6} strokeDasharray="12 12" opacity={P(at("حضرت", 0.4) - 2, at("حضرت", 0.4) + 8) * (1 - P(tKa - 6, tKa + 6))} />
            <Arrow x1={1180} y1={470} x2={1250} y2={560} p={P(at("حضرت", 0.4) + 4, at("حضرت", 0.4) + 16) * (1 - P(tKa - 6, tKa + 6))} c={z.ink} w={6} />
            {/* «كأنه يصلي لأول مرة»: الجملة نفسها، فوق المصلي */}
            <g opacity={1 - after}>
              {T("ka", 1320, 370, "كأنه يصلي لأول مرة", 80, ["كأنه", 0.53], ["مرة", 0.6, 2], { font: "head" })}
            </g>
            {/* الصيغتان الأخريان خلف المخطوطة، ثم تنضمان إليها */}
            {[-1, 1].map((d) => (
              <g key={d} opacity={three * (1 - merge) * others} transform={`translate(${sheetX + d * lerp(150, 0, merge)} ${500 + d * 18}) rotate(${d * 7 * (1 - merge)})`}>
                <rect x={-190} y={-230} width={380} height={460} rx={10} fill={z.paper} stroke={z.ink} strokeWidth={6} />
                <rect x={-190} y={-230} width={380} height={460} rx={10} fill={z.hl} opacity={0.18} />
                <Lines x={0} y={-150} w={280} n={7} p={1} z={z} gap={44} />
              </g>
            ))}
            {/* المخطوطة: ورقة بالحبر، تنبسط مع «رسالة» */}
            <g transform={`translate(${sheetX} 500) scale(${sheetS})`} opacity={lerp(1, 0.3, moment * (1 - after)) * lerp(1, 0, P(tBook - 2, tBook + 10))}>
              <g transform={`scale(1 ${P(tRisala - 4, tRisala + 14)})`}>
                <rect x={-210} y={-240} width={420} height={480} rx={10} fill={z.paper} stroke={z.ink} strokeWidth={7} />
                <rect x={-210} y={-240} width={420} height={480} rx={10} fill={z.hl} opacity={0.22} />
                <path d="M-210 -240 Q-232 -222 -210 -204 M210 -240 Q232 -222 210 -204 M-210 240 Q-232 222 -210 204 M210 240 Q232 222 210 204" fill="none" stroke={z.ink} strokeWidth={6} />
                <Lines x={0} y={-50} w={320} n={6} p={P(tRisala, tMaani + 14, (t) => t)} z={z} gap={46} />
              </g>
              {/* «وتأمل معانيها»: تحديد فسفوري على سطرين */}
              <rect x={-160} y={-30} width={320 * P(tMaani - 2, tMaani + 12)} height={40} fill={z.hl} opacity={0.85} />
              <rect x={-160} y={62} width={240 * P(tMaani + 6, tMaani + 20)} height={40} fill={z.hl} opacity={0.85} />
              {/* «ومن شرحه وإضافاته»: حواشٍ في الهامش */}
              {[0, 1, 2].map((k) => (
                <g key={k}>
                  <rect x={-330} y={-150 + k * 80} width={100} height={36} rx={8} fill={z.hl} opacity={0.8 * P(tSharh + k * 4, tSharh + k * 4 + 8)} />
                  <Stroke d={`M${-236} ${-130 + k * 80} q-14 -12 -28 0 t-28 0 t-28 0`} p={P(tSharh + k * 4, tSharh + k * 4 + 10)} c={z.ink} w={6} />
                </g>
              ))}
            </g>
            {T("as", sheetX, 330, "أسرار الصلاة", 56, ["أسرار", 0.29], ["الصلاة", 0.31], { font: "head", opacity: lerp(1, 0.3, moment * (1 - after)) * (1 - final) })}
            {T("iq", sheetX, 400, "ابن القيم", 62, ["لابن", 0.25], ["القيم", 0.27], { opacity: lerp(1, 0.3, moment * (1 - after)) * (1 - final) })}
            {/* «من كلام ابن القيم»: كتبه بالحبر بلا عناوين تدخل مع «كلام»، ويتجه سهمها إلى الرسالة بعد «القيم» */}
            <g opacity={others}>
              {[0, 1, 2].map((k) => (
                <g key={k} transform={`translate(${1030 + k * 70} ${lerp(660, 540, P(tAdd - 4 + k * 3, tAdd + 10 + k * 3, outCubic))})`} opacity={P(tAdd - 4 + k * 3, tAdd + 6 + k * 3)}>
                  <rect x={-30} y={-130} width={60} height={260} rx={6} fill={k === 1 ? z.hl : z.paper} stroke={z.ink} strokeWidth={6} />
                  <line x1={-12} x2={12} y1={-70} y2={-70} stroke={z.ink} strokeWidth={4} />
                </g>
              ))}
              <Arrow x1={1000} y1={540} x2={930} y2={540} p={P(tIlayha - 2, tIlayha + 10)} c={z.ink} w={6} />
              {T("kt", 1080, 790, "كلام ابن القيم", 60, ["كلام", 0.83], ["القيم", 0.87, 2])}
              {/* «ومما جمعه وشرحه»: سهم من المؤلف إلى الهامش */}
              <path d="M1290 440 Q1100 320 900 330" fill="none" stroke={z.ink} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - P(tSharh - 2, tSharh + 14, (t) => t)} />
              {T("sh", 1420, 360, "جمعه وشرحه", 64, ["جمعه", 0.76], ["وشرحه", 0.79])}
            </g>
            {/* «تشكّل هذا الكتاب»: تجتمع كلها في كتاب واحد (رسم القناة، لا غلاف طبعة) */}
            <g transform={`translate(960 ${lerp(560, 520, final)}) scale(${lerp(0.6, 1, final)}) rotate(-3)`} opacity={final}>
              <rect x={-130} y={-180} width={260} height={360} rx={14} fill={z.ink} />
              <rect x={-90} y={-120} width={180} height={18} rx={6} fill={z.hl} />
            </g>
            {T("hk", 960, 800, "هذا الكتاب", 64, ["هذا", 0.96], ["الكتاب", 0.97], { font: "head" })}
          </g>
        ),
      };
    },
  },

  // S09 — المحفوظ ثابت والفهم يتسع (بلا كتابة نص قرآني)
  "growing-understanding": {
    nameAr: "نحفظ السورة صغارًا ثم يتسع فهمنا",
    render: (c) => {
      const { frame, z, at, T, Box, P } = kit(c);
      // السكريبت المعتمد (١١ نوفمبر): «قد نقرأ سورة حفظناها منذ الصغر، ثم نفهم منها بعد سنوات معنى لم نلتفت إليه قبل. كلام الله
      // لم يتغير؛ الذي تغير هو فهمنا. وكذلك يمكن للمعرفة والتدبر أن يجددا طريقة إقبالنا على الصلاة.» — سكون عند «كلام الله لم يتغير».
      const tSurah = at("سورة", 0.14);
      const tSmall = at("الصغر", 0.22);
      const tYears = at("سنوات", 0.32);
      const tMeaning = at("معنى", 0.36);
      const tWide = at("فهمنا", 0.62);
      const tRenew = at("يجددا", 0.86);
      const tIlm = at("للمعرفة", 0.76);
      const tTad = at("والتدبر", 0.8);
      const tAmal = at("إقبالنا", 0.92);
      const grow = P(tYears - 4, tYears + 20);
      const ring = P(tWide - 2, tWide + 22);
      return {
        focus: [[tSurah, 1200, 380], [tSmall, 760, 520], [tYears, 760, 480], [tMeaning, 760, 300], [tWide, 760, 420], [tIlm, 1350, 760], [tTad, 960, 760], [tRenew, 960, 700], [tAmal, 570, 760]],
        cam: [C(0, 1000, 440, 1.06), C(tIlm - 8, 960, 560, 1.0)],
        world: (
          <g>
            {/* إطار مجرد للمحفوظ: سطور رمادية لا نص */}
            <g opacity={P(tSurah - 4, tSurah + 8)}>
              <rect x={1032} y={264} width={380} height={260} rx={18} fill={z.ink} opacity={0.12} />
              <rect x={1020} y={250} width={380} height={260} rx={18} fill={z.paper} stroke={z.ink} strokeWidth={6} />
              <Lines x={1210} y={320} w={290} n={4} p={P(tSurah, tSurah + 20, (t) => t)} z={z} gap={42} />
            </g>
            {T("ns", 1210, 580, "سورة حفظناها", 66, ["سورة", 0.14], ["حفظناها", 0.16])}
            {/* نحن: صغارًا ثم كبارًا */}
            <InkPerson x={760} y={620} s={lerp(0.6, 1.0, grow)} pose="stand" p={P(tSmall - 4, tSmall + 14)} z={z} dir={-1} />
            {T("sg", 760, 680, "الصغر", 64, ["الصغر", 0.22], undefined, { opacity: 1 - grow })}
            {T("sn", 760, 680, "بعد سنوات", 64, ["بعد", 0.2], ["سنوات", 0.22], { opacity: grow })}
            {/* معنى جديد: صلة بين المحفوظ ومن يقرؤه */}
            <Arrow x1={1010} y1={380} x2={830} y2={380} p={P(tMeaning, tMeaning + 14)} c={z.ink} w={6} />
            <circle cx={760} cy={620 - 272} r={lerp(40, 170, ring)} fill={z.hl} opacity={0.6 * ring} />
            {/* «معنى لم نلتفت إليه»: شعاع فسفوري من المحفوظ إلى القارئ */}
            <path d="M1020 330 L840 310 L840 420 L1020 440 Z" fill={z.hl} opacity={0.55 * P(tMeaning + 6, tMeaning + 20)} />
            {T("fh", 760, 190, "فهمنا", 72, ["فهمنا", 0.62], undefined, { font: "head" })}
            {/* «للمعرفة والتدبر أن يجددا طريقة إقبالنا»: المعرفة والتدبر يقودان إلى الإقبال */}
            {Box("i1", 1350, 830, "للمعرفة", 76, tIlm, { font: "head", fill: z.hl })}
            {/* D73: المعرفة كتاب مفتوح، والتدبر عين تتأمل، والإقبال خطوة إلى الأمام — كلٌّ مع كلمته */}
            <Icon id="openbook" x={1350} y={715} s={0.9} p={P(tIlm - 2, tIlm + 14)} c={z.ink} />
            <Icon id="eye" x={960} y={715} s={0.9} p={P(tTad - 2, tTad + 14)} c={z.ink} />
            <Foot x={548} y={724} s={0.85} rot={-10} p={P(tAmal - 2, tAmal + 10)} c={z.ink} fill={z.hl} />
            <Foot x={594} y={700} s={0.85} rot={8} p={P(tAmal + 2, tAmal + 14)} c={z.ink} fill={z.hl} />
            <Arrow x1={1230} y1={820} x2={1100} y2={820} p={P(tTad - 6, tTad + 6)} c={z.ink} w={6} />
            {Box("i2", 960, 830, "والتدبر", 76, tTad, { font: "head", fill: z.hl })}
            <Arrow x1={830} y1={820} x2={700} y2={820} p={P(tRenew - 2, tRenew + 10)} c={z.ink} w={6} />
            {Box("i3", 570, 830, "إقبالنا", 76, tAmal, { font: "head", fill: z.hl })}
          </g>
        ),
      };
    },
  },

  // S10 — الافتقار والرجاء (سكون عند ذكر الله)
  "need-hope": {
    nameAr: "نأتي إلى الصلاة مفتقرين راجين، لا مدعين كمال قلوبنا",
    render: (c) => {
      const { frame, z, at, T, P } = kit(c);
      // السكريبت المعتمد (١١ نوفمبر): «وكلما فهمنا معنى جديدًا، تذكرنا أننا ما زلنا نحتاج إلى عون الله. نأتي إلى الصلاة وفينا تقصير
      // وهموم ورجاء؛ لا ندعي كمال قلوبنا، بل نسأل الله أن يصلحها. وبهذا يلتقي تجديد الفهم مع صدق الافتقار.»
      // سكون عند «عون الله» وفي الدعاء «نسأل الله أن يصلحها»: لا حدث ولا رمز فيهما.
      const tMana = at("معنى", 0.04);
      const tNeed = at("نحتاج", 0.18);
      const tCome = at("نأتي", 0.32);
      const tTaq = at("تقصير", 0.4);
      const tHum = at("وهموم", 0.43);
      const tRaj = at("ورجاء", 0.46);
      const tKamal = at("كمال", 0.54);
      const tBal = at("بل", 0.6);
      const tTaj = at("تجديد", 0.84);
      const tSidq = at("صدق", 0.92);
      const words: [string, number, number][] = [["تقصير", tTaq, 600], ["هموم", tHum, 700], ["رجاء", tRaj, 800]];
      return {
        focus: [[tMana, 960, 300], [tNeed, 1180, 640], [tCome, 1180, 820], [tTaq, 1520, 600], [tHum, 1520, 700], [tRaj, 1520, 800], [tKamal, 620, 640], [tBal, 620, 640], [tTaj, 1380, 220], [tSidq, 960, 360]],
        cam: [C(0, 960, 330, 1.2), C(tNeed - 6, 1100, 620, 1.12), C(tKamal - 6, 960, 640, 1.05), C(at("يلتقي", 0.8) - 6, 1060, 360, 1.12)],
        world: (
          <g>
            {T("mj", 960, 300, "معنى جديدا", 76, ["معنى", 0.04], ["جديدا", 0.08], { font: "head", opacity: 1 - P(tTaj - 10, tTaj) })}
            {/* «نحتاج»: يقف رافعًا يديه قبل «عون الله»، ثم سكون */}
            <InkPerson x={1180} y={820} s={1.1} pose="dua" p={P(tNeed - 2, tNeed + 16)} z={z} dir={-1} />
            {/* «نأتي إلى الصلاة»: عتبة الدخول تحت المصلي */}
            <Stroke d="M1000 860 L1360 860" p={P(tCome - 2, tCome + 14)} c={z.ink} w={8} />
            <ellipse cx={1180} cy={826} rx={150} ry={22} fill={z.hl} opacity={0.8 * P(tCome + 4, tCome + 18)} />
            {/* «وفينا تقصير وهموم ورجاء»: ثلاث كلمات بجانبه، كلٌّ مع نطقها */}
            {words.map(([w, t, y], k) => (
              <g key={w}>
                {k === 2 ? <Mark x={1520 - 90} y={y - 52} w={180} h={70} p={P(t, t + 12)} z={z} /> : null}
                {T(`w${k}`, 1520, y, w, 58, [k === 0 ? "تقصير" : k === 1 ? "وهموم" : "ورجاء", [0.4, 0.43, 0.46][k]!])}
              </g>
            ))}
            {T("km", 620, 640, "كمال قلوبنا", 64, ["كمال", 0.54], ["قلوبنا", 0.57])}
            <Cross x1={810} x2={430} y={624} p={P(tBal - 2, tBal + 12)} z={z} />
            {/* «يلتقي تجديد الفهم مع صدق الافتقار»: صلة بين الاثنين */}
            {T("tj", 1380, 200, "تجديد الفهم", 64, ["تجديد", 0.84], ["الفهم", 0.87])}
            <Stroke d="M1300 230 Q1200 290 1100 320" p={P(tSidq - 4, tSidq + 12)} c={z.ink} w={6} />
            {T("ft", 900, 380, "صدق الافتقار", 104, ["صدق", 0.92], ["الافتقار", 0.96], { font: "head" })}
          </g>
        ),
      };
    },
  },

  // S11 — من الخاطر إلى العمل
  "thought-to-action": {
    nameAr: "الفكرة تكتمل حين تتحول إلى عمل",
    render: (c) => {
      const { frame, z, at, end, T, Box, P } = kit(c);
      // السكريبت المعتمد (١١ نوفمبر): «ولكن فهم المعنى وحده لا يكفي. فما فائدة أن نعجب بكلام عن السكينة، ثم ندخل صلاتنا مستعجلين
      // كالعادة؟ وما فائدة أن نتحدث عن معاني الأذكار، ولا نتعلمها؟ الفكرة تكتمل حين تتحول إلى عمل.»
      const tCollect = at("فهم", 0.03);
      const tForget = at("يكفي", 0.12);
      const tKalam = at("بكلام", 0.2);
      const tEnter = at("ندخل", 0.3);
      const tRush = at("مستعجلين", 0.38);
      const tAdah = end("كالعادة", 0.44);
      const tDhikr = at("الأذكار", 0.6);
      const tLearn = at("نتعلمها", 0.68);
      const tUnder = at("الفكرة", 0.76);
      const tTurn = at("تتحول", 0.88);
      const tWork = at("عمل", 0.96);
      const fade = P(tForget - 2, tForget + 16);
      const spin = prog(frame, tRush - 4, tAdah + 10, (t) => t) * Math.PI * 10;
      return {
        focus: [[tCollect, 1450, 300], [tKalam, 1250, 640], [tEnter, 970, 780], [tRush, 1420, 760], [at("نتحدث", 0.52), 720, 720], [tDhikr, 720, 660], [tLearn, 720, 820], [tUnder, 1200, 500], [tWork, 740, 500]],
        cam: [C(0, 1400, 380, 1.12), C(tKalam - 6, 1100, 640, 1.05), C(tUnder - 8, 980, 580, 1.0)],
        world: (
          <g>
            {/* «فهم المعنى وحده لا يكفي»: يبهت */}
            <g opacity={1 - 0.7 * fade}>
              {[0, 1, 2].map((k) => (
                <Cloud key={k} x={1360 + k * 120} y={250 - (k % 2) * 40} r={80} p={P(tCollect + k * 5, tCollect + k * 5 + 12)} z={z} />
              ))}
            </g>
            {T("kh", 1480, 380, "فهم المعنى", 72, ["فهم", 0.03], ["المعنى", 0.06], { opacity: 1 - 0.7 * fade })}
            {/* المثال الأول: «نعجب بكلام عن السكينة، ثم ندخل صلاتنا مستعجلين كالعادة» */}
            {T("sk", 1220, 600, "بكلام عن السكينة", 60, ["بكلام", 0.2], ["السكينة", 0.24])}
            <Stroke d="M900 760 L1040 760 L1016 796 L924 796 Z" p={P(tEnter - 2, tEnter + 12)} c={z.ink} w={5} fill={z.hl} fillP={0.5} />
            <Clock x={1430} y={730} r={80} a1={spin / 6} a2={spin} p={P(tRush - 4, tRush + 6)} z={z} />
            <circle cx={1430} cy={730} r={108} fill="none" stroke={z.alert} strokeWidth={6} strokeDasharray="18 14" opacity={P(tRush + 4, tRush + 14)} />
            {T("ms", 1430, 870, "مستعجلين", 60, ["مستعجلين", 0.38])}
            {/* المثال الثاني: «نتحدث عن معاني الأذكار، ولا نتعلمها» — الكتيّب مغلق، و«نتعلمها» تُشطب */}
            <g opacity={P(at("نتحدث", 0.52) - 4, at("نتحدث", 0.52) + 8)} transform="translate(0 -30)">
              <path d="M600 690 Q660 660 720 690 Q780 660 840 690 L840 790 Q780 760 720 790 Q660 760 600 790 Z M720 690 L720 790" fill={z.paper} stroke={z.ink} strokeWidth={6} />
            </g>
            {T("dh", 720, 640, "معاني الأذكار", 58, ["معاني", 0.56], ["الأذكار", 0.6])}
            {T("lr", 720, 840, "نتعلمها", 72, ["نتعلمها", 0.68], undefined, { font: "head" })}
            <Cross x1={850} x2={590} y={822} p={P(end("نتعلمها", 0.7), end("نتعلمها", 0.7) + 12)} z={z} />
            {/* «الفكرة تكتمل حين تتحول إلى عمل» */}
            {Box("fh", 1200, 480, "الفكرة", 88, tUnder, { font: "head" })}
            <Arrow x1={1020} y1={470} x2={920} y2={470} p={P(tTurn - 2, tTurn + 12)} c={z.ink} w={8} />
            {Box("am", 740, 480, "عمل", 88, tWork, { font: "head", fill: z.hl })}
          </g>
        ),
      };
    },
  },

  // S15 — صحة الفعل وحضور القلب معًا
  "act-and-heart": {
    nameAr: "الخشوع معنى نطلبه، ونقصه لا يدفعنا إلى ترك الصلاة",
    render: (c) => {
      const { frame, z, at, end, T, P } = kit(c);
      // السكريبت المعتمد (١١ نوفمبر): «يتضح لنا أن الخشوع ليس مجرد زينة للصلاة؛ إنه معنى نطلبه ونجاهد أنفسنا عليه. ومع ذلك، فلا
      // يدفعننا نقصه إلى ترك الصلاة. نحافظ على صحة أفعالها، ونسعى إلى حضور قلوبنا فيها.»
      const tHeart = at("الخشوع", 0.2);
      const tZina = at("زينة", 0.3);
      const tInnahu = at("إنه", 0.36);
      const tMotive = at("نطلبه", 0.42);
      const tJihad = at("ونجاهد", 0.46);
      const tLack = at("نقصه", 0.6);
      const tLeave = at("ترك", 0.66);
      const tAct = at("نحافظ", 0.76);
      const tSahha = at("صحة", 0.8);
      const tNone = at("ونسعى", 0.86);
      const tHudur = at("حضور", 0.9);
      const level = 1 - 0.55 * P(tLack, tLack + 18) + 0.55 * P(tHudur, tHudur + 18);
      const climb = P(tMotive - 2, end("ونجاهد", 0.48) + 10);
      return {
        focus: [[tHeart, 630, 520], [tZina, 900, 300], [tMotive, 560, 400], [tJihad, 620, 260], [tLack, 620, 560], [tLeave, 960, 760], [tAct, 1300, 620], [tSahha, 1300, 770], [tNone, 960, 440], [tHudur, 630, 770]],
        cam: [C(0, 760, 480, 1.15), C(tMotive - 6, 640, 420, 1.15), C(at("ذلك", 0.54) - 4, 720, 560, 1.15), C(tLeave - 4, 960, 600, 1.05), C(tAct - 6, 960, 540, 1.0)],
        world: (
          <g>
            {/* «الخشوع»: قلب ممتلئ، ينقص مع «نقصه» ويعود مع «حضور قلوبنا» */}
            <defs>
              <clipPath id="hfill">
                <rect x={480} y={560 - 130 + 260 * (1 - level)} width={300} height={260} />
              </clipPath>
            </defs>
            <g opacity={P(tHeart - 4, tHeart + 8)}>
              <path d={heartPath(630, 560, 110)} fill={z.hl} clipPath="url(#hfill)" />
              <path d={heartPath(630, 560, 110)} fill="none" stroke={z.ink} strokeWidth={9} />
            </g>
            {T("kh", 630, 400, "الخشوع", 66, ["الخشوع", 0.2], undefined, { font: "head", opacity: 1 - P(tMotive - 6, tMotive) })}
            {/* «ليس مجرد زينة»: تُشطب مع «إنه» */}
            {T("zn", 960, 300, "زينة", 66, ["زينة", 0.3])}
            <Cross x1={1050} x2={870} y={284} p={P(tInnahu - 2, tInnahu + 10)} z={z} />
            {/* «نطلبه ونجاهد»: درجات إلى أعلى */}
            <Stroke d="M420 470 L420 400 L520 400 L520 330 L620 330 L620 260 L720 260" p={climb} c={z.ink} w={8} />
            {T("tl", 440, 380, "نطلبه", 60, ["نطلبه", 0.42], undefined, { font: "head" })}
            {T("mj", 700, 228, "ونجاهد", 60, ["ونجاهد", 0.46], undefined, { font: "head" })}
            {/* «ترك الصلاة»: سهم خارج يُشطب مع «نحافظ» */}
            <Arrow x1={960} y1={560} x2={960} y2={760} p={P(tLeave - 2, tLeave + 12)} c={z.ink} w={7} />
            {T("tr", 960, 846, "ترك الصلاة", 62, ["ترك", 0.66], ["الصلاة", 0.7], { font: "head" })}
            <Cross x1={1100} x2={820} y={826} p={P(tAct - 2, tAct + 10)} z={z} />
            {/* «نحافظ على صحة أفعالها» */}
            <InkPerson x={1300} y={700} s={1.0} pose="stand" p={P(tAct - 4, tAct + 16)} z={z} dir={-1} />
            {T("sf", 1300, 770, "صحة أفعالها", 64, ["صحة", 0.8], ["أفعالها", 0.83], { font: "head" })}
            {/* «ونسعى إلى حضور قلوبنا»: الاثنان معًا */}
            <Arrow x1={1180} y1={420} x2={790} y2={420} p={P(tNone - 2, tNone + 14)} c={z.ink} w={6} bend={60} />
            <Arrow x1={790} y1={460} x2={1180} y2={460} p={P(tNone + 8, tNone + 22)} c={z.ink} w={6} bend={-40} />
            {T("hq", 630, 770, "حضور قلوبنا", 64, ["حضور", 0.9], ["قلوبنا", 0.93], { font: "head" })}
          </g>
        ),
      };
    },
  },

  // S16 — الوضوء: من أحوال القلب إلى الأفعال
  wudu: {
    nameAr: "الوضوء: لحظاته فرصة للتهيؤ",
    render: (c) => {
      const { frame, z, at, T, P } = kit(c);
      // السكريبت المعتمد (١١ نوفمبر): «كيف نترجم هذا الإقبال إلى خطوات؟ نبدأ بالوضوء. نغسل أعضاءنا امتثالًا لأمر الله، ويلفت المؤلف
      // انتباهنا إلى معنى آخر: أن يصحب طهارة البدن تذكر حاجتنا إلى التوبة وطهارة القلب. هذا معنى تربوي، لا شرط لصحة الوضوء.
      // وهكذا تصير لحظات الوضوء فرصة للتهيؤ للصلاة.» — لا حدث جديد عند «لأمر الله».
      const tMove = at("نترجم", 0.03);
      const tBook = at("هذا", 0.06);
      const tHeart = at("الإقبال", 0.08);
      const tActs = at("خطوات", 0.12);
      const tWudu = at("بالوضوء", 0.18);
      const tDo = at("نغسل", 0.22);
      const tZahir = at("يصحب", 0.44);
      const tPurify = at("طهارة", 0.46);
      const tBadan = at("البدن", 0.48);
      const tBatin = at("تذكر", 0.5);
      const tQalb = tBatin;
      const tDhunub = at("حاجتنا", 0.52);
      const tTawba = at("التوبة", 0.56);
      const tTarb = at("تربوي", 0.68);
      const tShart = at("شرط", 0.72);
      const tMinutes = at("لحظات", 0.84);
      const tPart = at("فرصة", 0.9);
      const tPrep = at("للتهيؤ", 0.94);
      const tWorship = at("للصلاة", 0.98);
      // الكتاب يُفتح مع «نترجم» وتُقلب صفحته، ثم يتوارى حين يبدأ الوضوء
      const book = P(tMove - 4, tMove + 10) * (1 - P(tWudu - 10, tWudu + 4));
      const flip = P(tBook - 2, tBook + 16, (t) => t);
      // الإبريق يميل مع «بالوضوء» ويعتدل قبل «يصحب»: الماء يجري بين الحدثين فقط
      const tilt = P(tWudu - 2, tWudu + 12) * (1 - P(tZahir - 14, tZahir));
      const flow = P(tWudu + 6, tWudu + 16) * (1 - P(tZahir - 18, tZahir - 6));
      // الصفحة تُفسح لعمودَي «طهارة البدن» و«طهارة القلب»: «الإقبال» و«خطوات» تتواريان
      const clear = P(tZahir - 12, tZahir);
      const side = 1 - 0.55 * P(tMinutes - 4, tMinutes + 12);
      const stain = 1 - P(tTawba - 2, tTawba + 22);
      // الغسل يبدأ بعد «لأمر الله» لا عنده: لا حدث جديد وقت ذكر الله
      const tAfter = c.end("الله", 0.44) + 4;
      const rub = P(tAfter, tAfter + 6) * (1 - P(tPurify + 8, tPurify + 16));
      const rot = rub * 7 * Math.sin(frame * 0.32);
      const bar = P(tMinutes, tPrep + 6, (t) => t);
      return {
        focus: [[tMove, 960, 470], [tHeart, 1450, 300], [tActs, 1150, 300], [tWudu, 900, 400], [tDo, 960, 520], [tPurify, 1290, 430], [tBadan, 1290, 450], [tBatin, 1610, 400], [tDhunub, 1610, 470], [tTawba, 1610, 600], [tTarb, 1610, 680], [tShart, 1610, 780], [tMinutes, 1100, 800], [tPart, 760, 800], [tPrep, 470, 760], [tWorship, 470, 720]],
        cam: [C(0, 1100, 420, 1.2), C(tWudu - 8, 960, 470, 1.15), C(tZahir - 8, 1250, 480, 1.0), C(tMinutes - 6, 960, 640, 1.05), C(tWorship, 820, 640, 1.08)],
        world: (
          <g>
            {/* «نترجم هذا»: كتاب مفتوح تُقلب صفحته */}
            <g opacity={book} transform="translate(960 470) scale(1.6)">
              <path d="M-80 -34 Q-40 -54 0 -34 Q40 -54 80 -34 L80 44 Q40 24 0 44 Q-40 24 -80 44 Z M0 -34 L0 44" fill={z.paper} stroke={z.ink} strokeWidth={4} />
              {flip > 0 && flip < 1 ? <path d={`M0 -34 Q${(80 - 160 * flip) / 2} ${-54 + 10 * Math.sin(Math.PI * flip)} ${80 - 160 * flip} -34 L${80 - 160 * flip} 44 Q${(80 - 160 * flip) / 2} 24 0 44 Z`} fill={z.paper} stroke={z.ink} strokeWidth={3} /> : null}
            </g>
            {/* «الإقبال إلى خطوات»: القلب يخرج من الكتاب ثم ينتقل جانبًا وتأتي الخطوات */}
            <path d={heartPath(lerp(960, 1500, P(tActs - 4, tActs + 18)), lerp(lerp(470, 380, P(tHeart - 6, tHeart + 10)), 300, P(tActs - 4, tActs + 18)), lerp(110, 50, P(tActs - 4, tActs + 18)))} fill={z.hl} fillOpacity={0.6 * (1 - P(tActs, tActs + 18))} stroke={z.ink} strokeWidth={8} opacity={P(tHeart - 6, tHeart + 6) * (1 - 0.6 * P(tWudu, tWudu + 12)) * (1 - clear)} />
            {T("hq", 1500, 420, "الإقبال", 64, ["الإقبال", 0.08], undefined, { opacity: (1 - 0.6 * P(tWudu, tWudu + 12)) * (1 - clear) })}
            <g opacity={1 - clear}><Arrow x1={1420} y1={300} x2={1250} y2={300} p={P(tActs - 4, tActs + 10)} c={z.ink} w={6} /></g>
            {T("af", 1170, 320, "خطوات", 64, ["خطوات", 0.12], undefined, { opacity: (1 - 0.6 * P(tWudu, tWudu + 12)) * (1 - clear) })}
            {T("wd", 960, 230, "بالوضوء", 90, ["بالوضوء", 0.18], undefined, { font: "head" })}
            {/* الإبريق: يميل فيجري الماء على الكفين */}
            <g transform={`translate(700 380) rotate(${38 * tilt})`} opacity={P(tWudu - 6, tWudu + 4)}>
              <Stroke d="M-46 -40 Q-60 40 -30 70 L30 70 Q60 40 46 -40 Z" p={P(tWudu - 6, tWudu + 6)} c={z.ink} w={7} fill={z.paper} fillP={1} />
              <Stroke d="M-30 -40 Q0 -60 30 -40" p={P(tWudu - 4, tWudu + 6)} c={z.ink} w={7} />
              <Stroke d="M44 0 Q90 -6 104 -40" p={P(tWudu - 2, tWudu + 8)} c={z.ink} w={8} />
              <Stroke d="M-48 -20 Q-90 0 -50 40" p={P(tWudu - 2, tWudu + 8)} c={z.ink} w={7} />
            </g>
            {flow > 0 ? (
              <path d="M806 412 Q880 405 925 458" fill="none" stroke={z.ink} strokeWidth={7} strokeLinecap="round" strokeDasharray="22 12" strokeDashoffset={-frame * 3} opacity={flow * 0.8} />
            ) : null}
            {/* الكفان: تتلقيان الماء، وتتحركان حركة الغسل الهادئة بعد «لأمر الله» */}
            <g transform={`rotate(${rot} 960 560)`}>
              <Hands x={960} y={540} s={1.1} p={P(tWudu - 2, tWudu + 20)} z={z} />
            </g>
            {/* «طهارة البدن»: يسيل الماء من الكفين إلى الحوض، وهالة فسفورية حولهما */}
            <Stroke d="M820 715 Q960 760 1100 715" p={P(tPurify - 4, tPurify + 10)} c={z.ink} w={6} />
            {[0, 1, 2].map((k) => {
              const d = P(tPurify + k * 7, tPurify + k * 7 + 14, (t) => t);
              return d > 0 && d < 1 ? <Drop key={k} x={930 + k * 30} y={lerp(660, 735, d)} s={0.9} z={z} o={1 - d * 0.4} /> : null;
            })}
            <ellipse cx={960} cy={540} rx={lerp(120, 290, P(tPurify, tPurify + 18)) + 60 * Math.sin(Math.PI * P(tBadan - 2, tBadan + 22, (t) => t))} ry={lerp(60, 150, P(tPurify, tPurify + 18)) + 40 * Math.sin(Math.PI * P(tBadan - 2, tBadan + 22, (t) => t))} fill={z.hl} opacity={0.5 * P(tPurify, tPurify + 10) * (1 - 0.6 * P(tMinutes, tMinutes + 12))} style={{ mixBlendMode: "multiply" }} />
            {/* عمودان: «طهارة البدن» عند الكفين، و«طهارة القلب» قلب تظهر فيه بقعة مع «حاجتنا» وتصفو مع «التوبة» */}
            <g opacity={side}>
              <Arrow x1={1170} y1={480} x2={1090} y2={530} p={P(tBadan - 4, tBadan + 10)} c={z.ink} w={6} />
              {T("bd", 1300, 430, "طهارة البدن", 66, ["طهارة", 0.46], ["البدن", 0.48], { font: "head" })}
              <line x1={1450} x2={1450} y1={270} y2={640} stroke={z.faint} strokeWidth={4} strokeDasharray="10 12" opacity={P(tBatin - 4, tBatin + 10)} />
              {T("bt", 1610, 330, "طهارة القلب", 62, ["وطهارة", 0.6], ["القلب", 0.62], { font: "head" })}
              <g opacity={P(tQalb - 6, tQalb + 6)}>
                <path d={heartPath(1610, 470, 78)} fill={z.hl} fillOpacity={0.15 + 0.6 * (1 - stain)} stroke={z.ink} strokeWidth={8} />
                <circle cx={1588} cy={460} r={30 * stain * P(tDhunub - 4, tDhunub + 8)} fill={z.ink} opacity={0.55} />
                <circle cx={1632} cy={490} r={20 * stain * P(tDhunub, tDhunub + 10)} fill={z.ink} opacity={0.45} />
              </g>
              {T("tw", 1610, 600, "التوبة", 60, ["التوبة", 0.56], undefined, { font: "head" })}
              {/* «معنى تربوي، لا شرط لصحة الوضوء» */}
              <rect x={1455} y={630} width={310} height={84} rx={14} fill={z.hl} opacity={0.8 * P(tTarb - 2, tTarb + 10)} />
              {T("tr", 1610, 690, "معنى تربوي", 62, ["معنى", 0.66, 2], ["تربوي", 0.68])}
              <g opacity={1 - P(tMinutes - 10, tMinutes - 2)}>
                {T("sr", 1610, 790, "شرط", 58, ["شرط", 0.72])}
                <Cross x1={1680} x2={1540} y={774} p={P(tShart + 6, tShart + 18)} z={z} />
              </g>
            </g>
            {/* «لحظات الوضوء» تملأ شريط التهيؤ حتى تصل إلى السجادة: «للصلاة» */}
            <g opacity={P(tMinutes - 4, tMinutes + 6)}>
              <rect x={600} y={780} width={760} height={46} rx={23} fill="none" stroke={z.ink} strokeWidth={6} />
              <rect x={1360 - 754 * bar} y={785} width={751 * bar} height={36} rx={18} fill={z.hl} />
            </g>
            {T("dq", 1510, 815, "لحظات الوضوء", 62, ["لحظات", 0.84], ["الوضوء", 0.86, 2])}
            {T("th", 470, 830, "للتهيؤ", 60, ["للتهيؤ", 0.94], undefined, { font: "head" })}
            <Stroke d="M330 740 L610 740 L580 768 L360 768 Z" p={P(tWorship - 4, tWorship + 10)} c={z.ink} w={6} fill={z.hl} fillP={0.6 * P(tWorship + 2, tWorship + 14)} />
          </g>
        ),
      };
    },
  },

  // S17 — إلى المسجد: عودة من الغفلة وإقبال بتذلل (الأمر 008). لا تجسيد ولا جهة: الخيط أفقي إلى سجادة المسجد
  "to-mosque": {
    nameAr: "إلى المسجد: من الغفلة إلى تمام العبودية، والقلب ينتبه",
    render: (c) => {
      const { frame, z, at, T, Box, P } = kit(c);
      // السكريبت المعتمد (١١ نوفمبر): «ثم نتوجه إلى المسجد… فالمؤلف يذكرنا بما قد يعلق بقلوبنا من غفلة بين الصلاتين. ويصف المجيء
      // إلى المسجد بأنه من تمام العبودية. أما نحن، فنتذكر أن تغيير المكان وحده لا يكفي؛ بل يحتاج القلب أيضًا إلى أن ينتبه.»
      const tGo = at("نتوجه", 0.03);
      const tMasjid = at("المسجد", 0.06);
      const tGhafla = at("غفلة", 0.36);
      const tKhataya = at("بين", 0.38);
      const tWeak = at("الصلاتين", 0.4);
      const tAwda = at("المجيء", 0.48);
      const tTilk = at("المسجد", 0.52, 2);
      const tTamam = at("تمام", 0.56);
      const tTadh = at("العبودية", 0.58);
      const tPlace = at("المكان", 0.72);
      const tGuar = at("يكفي", 0.78);
      const tHeart = at("القلب", 0.88);
      const tCare = at("ينتبه", 0.97);
      const walk = P(tGo, tTamam + 8, (t) => t);
      const pathX = (t: number) => lerp(1500, 560, t);
      const pathY = (t: number) => 560 - 90 * Math.sin(Math.PI * t);
      const wx = pathX(walk * 0.92);
      const wy = pathY(walk * 0.92) - 20;
      const top = 1 - 0.94 * P(tPlace - 10, tPlace + 4);
      // «غفلة»: غيمة رمادية حول رأس السائر تثقل مع «بين الصلاتين»، وتتفرق مع «المجيء»
      const fog = P(tGhafla - 4, tGhafla + 14) * (1 - P(tAwda - 2, tTilk + 14));
      const heavy = P(tKhataya - 2, tKhataya + 12);
      // الصلة: خيط من قلب السائر إلى المسجد؛ يرق مع «الصلاتين»، ويقوى مع «المجيء»
      const thin = P(tWeak - 2, tWeak + 14) * (1 - P(tAwda - 2, tAwda + 14));
      const strong = P(tAwda - 2, tAwda + 16);
      const bow = P(tTadh - 4, tTadh + 14);
      const drop = (k: number) => P(tAwda + k * 6, tAwda + k * 6 + 14);
      const hx = wx - 6, hy = wy - 0.55 * 200;
      return {
        focus: [[tGo, 1500, 520], [tMasjid, 470, 520], [tGhafla, 1250, 640], [tWeak, 1000, 500], [tAwda, 900, 660], [tTadh, wx, 420], [tTamam, 470, 380], [tPlace, 1200, 780], [tGuar, 1350, 840], [tHeart, 650, 780], [tCare, 650, 780]],
        cam: [C(0, 1000, 500, 1.0), C(tPlace - 8, 960, 600, 1.0)],
        world: (
          <g>
            <g opacity={top}>
              <Icon id="house" x={1580} y={500} s={1.6} p={P(tGo - 6, tGo + 8)} c={z.ink} opacity={1 - 0.5 * P(tGhafla, tGhafla + 14)} />
              <path d={`M1500 560 Q1010 380 520 560`} fill="none" stroke={z.ink} strokeWidth={6} strokeDasharray="16 14" opacity={P(tGo, tGo + 10)} />
              {/* المسجد: قبة ومئذنة وباب (لا صندوق) — يُرسم لحظة «المسجد»، وبابه بالفسفوري مع «تمام العبودية» */}
              <Mosque x={440} y={610} s={0.62} p={P(tMasjid - 4, tMasjid + 18)} z={z} door={P(tTamam - 4, tTamam + 12)} />
              {T("ms", 440, 690, "المسجد", 60, ["المسجد", 0.08], undefined, { font: "head" })}
              {/* خيط الصلة إلى سجادة المسجد (أفقي، لا إلى أعلى) */}
              <line x1={hx} y1={hy} x2={470} y2={575} stroke={strong > 0 ? z.hl : z.ink} strokeWidth={lerp(lerp(6, 3, thin), 14, strong)} strokeDasharray={strong > 0.5 ? undefined : `${lerp(18, 6, thin)} ${lerp(12, 30, thin)}`} strokeLinecap="round" opacity={P(tGhafla + 6, tGhafla + 18) * lerp(lerp(0.8, 0.35, thin), 0.9, strong)} />
              {/* السائر: ينحني قليلًا مع «العبودية» */}
              <g transform={`rotate(${-9 * bow} ${wx} ${wy})`}>
                <InkPerson x={wx} y={wy} s={0.55} pose="walk" p={P(tGo, tGo + 12)} z={z} dir={-1} />
              </g>
              {/* الغفلة: غيمة ثقيلة حول الرأس، وفيها الشواغل */}
              {([[-70, -20, 70], [40, -50, 60], [10, 30, 54]] as const).map(([dx, dy, r], k) => (
                <g key={k} opacity={fog} transform={`translate(${hx + dx + 30 * (1 - fog)} ${hy - 70 + dy})`}>
                  <path d={`M${-r} 0 a${r * 0.6} ${r * 0.6} 0 0 1 ${r * 0.7} ${-r * 0.6} a${r * 0.7} ${r * 0.7} 0 0 1 ${r * 1.1} ${r * 0.1} a${r * 0.5} ${r * 0.5} 0 0 1 ${r * 0.2} ${r * 0.9} Z`} fill={z.faint} fillOpacity={0.15 + 0.35 * heavy} stroke={z.ink} strokeWidth={5} strokeLinejoin="round" />
                </g>
              ))}
              {(["phone", "bag", "calendar"] as const).map((id, k) => {
                const dx = drop(k);
                const fx = dx > 0 ? pathX(Math.min(walk, 0.45 + k * 0.08)) + 40 : hx - 60 + k * 60;
                const fy = dx > 0 ? pathY(0.45 + k * 0.08) + 40 * dx : hy - 90 - (k % 2) * 30;
                return <Icon key={id} id={id} x={fx} y={fy} s={0.42} p={P(tGhafla + k * 4, tGhafla + 10 + k * 4)} c={z.ink} opacity={1 - 0.6 * dx} />;
              })}
              {T("gf", 1250, 700, "غفلة", 64, ["غفلة", 0.36], undefined, { font: "head", opacity: 1 - 0.6 * strong })}
              {T("aw", 900, 720, "المجيء", 70, ["المجيء", 0.48], undefined, { font: "head" })}
              {T("tm", 440, 360, "تمام العبودية", 64, ["تمام", 0.56], ["العبودية", 0.58])}
            </g>
            {/* «تغيير المكان وحده لا يكفي» يُشطب؛ «بل يحتاج القلب أيضًا إلى أن ينتبه» */}
            {Box("mk", 1350, 760, "المكان وحده", 62, tPlace, { tEnd: c.end("وحده", 0.74) })}
            {T("dm", 1350, 870, "لا يكفي", 62, ["لا", 0.76], ["يكفي", 0.78])}
            <Cross x1={1550} x2={1150} y={752} p={P(tGuar + 6, tGuar + 18)} z={z} />
            <g opacity={P(tHeart - 4, tHeart + 8)}>
              <circle cx={600} cy={800} r={70 + 10 * P(tCare, tCare + 14)} fill={z.hl} opacity={0.7} />
              <path d={heartPath(600, 800, 42)} fill="none" stroke={z.ink} strokeWidth={8} />
            </g>
            {T("en", 760, 820, "ينتبه", 60, ["ينتبه", 0.97], undefined, { font: "head" })}
          </g>
        ),
      };
    },
  },

  // S18 — استقبال القبلة بالوجوه، والإقبال بالقلوب، وترك الالتفات (الأمر 008)
  "qibla-gather": {
    nameAr: "استقبال القبلة: اتجاه الجسد واضح، واتجاه القلب يحتاج مراقبة",
    render: (c) => {
      const { frame, z, at, T, P } = kit(c);
      // السكريبت المعتمد (١١ نوفمبر): «وعند استقبال القبلة، تجتمع حركتان: نوجه وجوهنا إلى القبلة امتثالًا لأمر الله، ونجاهد أن نوجه
      // قلوبنا إليه. وينبهنا المؤلف إلى الالتفات بالبصر والقلب. فاتجاه الجسد واضح للعين؛ أما اتجاه القلب فيحتاج إلى مراقبة ومجاهدة.»
      // لا حدث جديد عند «لأمر الله».
      const tFace = at("استقبال", 0.03);
      const tBodies = at("وجوهنا", 0.18);
      const tHearts = at("قلوبنا", 0.36);
      // «الالتفات بالبصر والقلب»: نظرة تنحرف إلى شاغل جانبي مع «بالبصر»، ثم تعود مع «والقلب»
      const tIlt = at("الالتفات", 0.5);
      const tLaNal = at("بالبصر", 0.53);
      const tAbsar = at("والقلب", 0.56);
      const tDiff = at("فاتجاه", 0.62);
      const tMove = at("الجسد", 0.65);
      const tDo = at("واضح", 0.68);
      const tMean = at("اتجاه", 0.78);
      const tNasrif = at("مراقبة", 0.9);
      // الخيوط تبدأ مع «ومجاهدة»: القلب يتبع صاحبه
      const tWith = at("ومجاهدة", 0.96);
      const turn = P(tBodies - 2, tBodies + 16);
      const gather = P(tHearts - 2, tHearts + 20);
      const xs = [1350, 1100, 850];
      const glance = P(tIlt - 2, tIlt + 12) * (1 - P(tAbsar - 2, tAbsar + 12));
      const steady = P(tNasrif - 2, tNasrif + 10);
      const pulse = 1 + 0.12 * Math.sin(Math.PI * P(tNasrif - 2, tNasrif + 18, (t) => t));
      return {
        focus: [[tFace, 400, 480], [tBodies, 1100, 620], [tHearts, 1100, 330], [tIlt, 560, 230], [tLaNal, 800, 380], [tNasrif, 1100, 300], [tDiff, 960, 600], [tMove, 1100, 660], [tDo, 1100, 660], [tMean, 1100, 300], [tWith, 1100, 460]],
        cam: [C(0, 520, 500, 1.3), C(tBodies - 6, 1050, 640, 1.12), C(tHearts - 6, 1100, 360, 1.2), C(tIlt - 6, 900, 420, 1.0), C(tDiff - 6, 1080, 520, 1.0)],
        world: (
          <g>
            {/* القبلة: الكعبة نفسها، تتجه إليها الوجوه (لا بوصلة) */}
            <Kaaba x={400} y={570} s={0.8} p={P(tFace - 6, tFace + 14)} z={z} />
            {T("qb", 400, 630, "القبلة", 60, ["القبلة", 0.06])}
            {xs.map((x, k) => {
              const d = k === 1 ? -1 : 1;
              const sx = lerp(d, -1, turn);
              return (
                <g key={k} transform={`translate(${x} 780) scale(${Math.abs(sx) < 0.08 ? 0.08 * Math.sign(sx || 1) : sx} 1)`}>
                  <InkPerson x={0} y={0} s={0.9} pose="stand" p={P(tFace + 6 + k * 4, tFace + 24 + k * 4)} z={z} />
                </g>
              );
            })}
            {T("ab", 690, 760, "وجوهنا", 66, ["وجوهنا", 0.18])}
            {/* القلوب: متفرقة ثم تُجمع على خط واحد */}
            {xs.map((x, k) => {
              const y0 = [300, 220, 340][k]!;
              return (
                <g key={k}>
                  <circle cx={x} cy={lerp(y0, 300, gather)} r={52 * steady} fill={z.hl} opacity={0.45 * steady} />
                  <path d={heartPath(x, lerp(y0, 300, gather), 30 * pulse)} fill={z.hl} stroke={z.ink} strokeWidth={5} opacity={P(tHearts - 4 + k * 3, tHearts + 6 + k * 3)} />
                </g>
              );
            })}
            <Stroke d="M1420 300 L780 300" p={P(tHearts + 18, tHearts + 34)} c={z.ink} w={5} opacity={0.6} />
            {T("ql", 1100, 170, "قلوبنا", 66, ["قلوبنا", 0.36])}
            {/* «الالتفات»: شاغل جانبي، ونظرة متقطعة من المصلي الأوسط إليه مع «بالبصر»، تعود مع «والقلب» */}
            <g opacity={P(tIlt - 4, tIlt + 8) * (1 - 0.75 * P(tAbsar, tAbsar + 14))}>
              <Icon id="phone" x={520} y={260} s={0.9} p={P(tIlt - 4, tIlt + 10)} c={z.ink} />
              {T("il", 560, 150, "الالتفات", 60, ["الالتفات", 0.42], undefined, { font: "head" })}
            </g>
            <line x1={1080} y1={500} x2={lerp(1080, 600, glance)} y2={lerp(500, 290, glance)} stroke={z.alert} strokeWidth={6} strokeDasharray="14 12" strokeLinecap="round" opacity={glance > 0.02 ? 0.9 : 0} />
            {T("ln", 700, 500, "بالبصر والقلب", 64, ["بالبصر", 0.53], ["والقلب", 0.56], { opacity: 1 - 0.7 * P(tDiff - 6, tDiff + 6) })}
            {/* «فاتجاه الجسد… أما اتجاه القلب»: خط يفصل بينهما، ثم يخف مع «ومجاهدة» */}
            <g opacity={1 - 0.65 * P(tWith, tWith + 16)}>
              <Stroke d="M720 420 L1480 420" p={P(tDiff - 2, tDiff + 16)} c={z.alert} w={5} />
            </g>
            {/* «اتجاه الجسد واضح للعين»: إطار حول الأبدان، يمتلئ قليلًا عند «واضح» */}
            <rect x={790} y={490} width={680} height={330} rx={28} fill={z.hl} opacity={0.22 * P(tDo - 2, tDo + 12)} />
            <rect x={790} y={490} width={680} height={330} rx={28} fill="none" stroke={z.ink} strokeWidth={6} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - P(tMove - 2, tMove + 16, (t) => t)} />
            {T("hr", 1600, 660, "اتجاه الجسد", 58, ["فاتجاه", 0.62], ["الجسد", 0.65], { font: "head" })}
            {/* «أما اتجاه القلب فيحتاج إلى مراقبة»: إطار فسفوري حول القلوب، وتتوهج مع «مراقبة» */}
            <rect x={740} y={232} width={720} height={130} rx={28} fill="none" stroke={z.hl} strokeWidth={14} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - P(tMean - 2, tMean + 16, (t) => t)} />
            {T("mn", 1600, 310, "اتجاه القلب", 58, ["اتجاه", 0.78], ["القلب", 0.8, 2], { font: "head" })}
            {/* «ومجاهدة»: خيط من كل قلب إلى صاحبه، فلا ينفصل اتجاه القلب عن الجسد */}
            {xs.map((x, k) => (
              <Stroke key={k} d={`M${x} 336 L${x} 500`} p={P(tWith - 4 + k * 4, tWith + 12 + k * 4, (t) => t)} c={z.hl} w={14} />
            ))}
          </g>
        ),
      };
    },
  },

  // S20 — التكبير لا يمحو المسؤوليات
  "duties-aside": {
    nameAr: "الهموم لا تختفي بعد التكبير، لكنها لا تستولي على الصلاة",
    render: (c) => {
      const { frame, z, at, end, T, P } = kit(c);
      // السكريبت المعتمد (١١ نوفمبر): «هل يعني ذلك أن الهموم ستختفي بعد التكبير؟ لا. لكننا نتعلم أن نعطي للصلاة وقتها ومكانها من
      // قلوبنا، دون أن ندعي أن مسؤوليات الدنيا لم تعد موجودة. المقصود ليس إنكار الهموم، بل ألا تستولي على هذه اللحظات.»
      const tProblems = at("الهموم", 0.08);
      const tGone = at("ستختفي", 0.12);
      const tLa = at("لا", 0.2);
      const tKnow = at("نتعلم", 0.26);
      const tWorship = at("للصلاة", 0.32);
      const tHeart = at("قلوبنا", 0.42);
      const tDuties = at("مسؤوليات", 0.52);
      const tMatter = at("موجودة", 0.6);
      const tInkar = at("إنكار", 0.72);
      const tBal = at("بل", 0.8);
      const tIstawli = at("تستولي", 0.88);
      const tLahazat = at("اللحظات", 0.96);
      const aside = P(tKnow - 2, tKnow + 22);
      const items: [IconId, number, number][] = [["calendar", 760, 420], ["bag", 960, 380], ["house", 1160, 420], ["phone", 860, 600], ["clock", 1060, 600]];
      const duty = Math.sin(Math.PI * P(tDuties - 2, tDuties + 18, (t) => t));
      return {
        focus: [[tProblems, 960, 480], [tGone, 960, 260], [tKnow, 1300, 520], [tWorship, 960, 520], [tHeart, 960, 420], [tDuties, 1470, 540], [tMatter, 1420, 250], [tInkar, 560, 300], [tIstawli, 1400, 540], [tLahazat, 960, 520]],
        cam: [C(0, 960, 480, 1.2), C(tKnow - 6, 1100, 520, 1.0), C(tInkar - 6, 1000, 500, 1.04)],
        world: (
          <g>
            {/* «الهموم» لا «تختفي»: تتنحى مع «نتعلم» إلى عمود جانبي داخل الإطار، أصغر وأخفت، وتبقى مرئية */}
            {items.map(([id, x, y], k) => {
              const tx = lerp(x, 1470, aside);
              const ty = lerp(y, 330 + k * 105, aside);
              if (aside > 0) c.reg([tx - 50, ty - 50, tx + 50, ty + 50], tKnow);
              return <Icon key={id} id={id} x={tx} y={ty} s={lerp(1.4, 0.75, aside) * (1 + 0.12 * duty)} p={P(tProblems - 2 + k * 3, tProblems + 10 + k * 3)} c={z.ink} opacity={1 - 0.4 * aside + 0.4 * duty} />;
            })}
            {/* «ألا تستولي»: حدّ بين الهموم ومساحة الصلاة */}
            <Stroke d="M1400 280 L1400 790" p={P(tIstawli - 2, tIstawli + 14)} c={z.ink} w={6} />
            <g opacity={P(tGone - 2, tGone + 8) * (1 - aside)}>
              <rect x={640} y={300} width={640} height={400} rx={30} fill="none" stroke={z.faint} strokeWidth={6} strokeDasharray="16 14" />
            </g>
            {T("ik", 960, 250, "ستختفي", 64, ["ستختفي", 0.12], undefined, { opacity: 1 - aside })}
            <g opacity={1 - aside}><Cross x1={1060} x2={860} y={234} p={P(tLa - 2, tLa + 10)} z={z} /></g>
            {/* «لم تعد موجودة»: ادعاء يُشطب، والهموم ما زالت في عمودها */}
            {T("mh", 1420, 250, "لم تعد موجودة", 58, ["لم", 0.56], ["موجودة", 0.6])}
            <Cross x1={1590} x2={1250} y={234} p={P(end("موجودة", 0.62), end("موجودة", 0.62) + 12)} z={z} />
            {/* «نعطي للصلاة وقتها ومكانها»: مساحة الصلاة تنفتح في الوسط */}
            <g opacity={P(tWorship - 4, tWorship + 10)}>
              <rect x={760} y={360} width={400} height={300} rx={30} fill={z.paper} stroke={z.ink} strokeWidth={7} />
              <rect x={760} y={360} width={400} height={300} rx={30} fill="none" stroke={z.hl} strokeWidth={18} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - P(tLahazat - 2, tLahazat + 16, (t) => t)} />
              <path d="M860 600 L1060 600 L1036 640 L884 640 Z" fill={z.hl} stroke={z.ink} strokeWidth={5} />
            </g>
            {T("qd", 960, 740, "وقتها ومكانها", 64, ["وقتها", 0.36], ["ومكانها", 0.38], { font: "head" })}
            <g opacity={P(tHeart - 4, tHeart + 10)}>
              <path d={heartPath(960, lerp(380, 500, P(tHeart, tHeart + 16)), 46)} fill={z.hl} stroke={z.ink} strokeWidth={6} />
            </g>
            {T("ng", 960, 300, "من قلوبنا", 62, ["من", 0.4], ["قلوبنا", 0.42])}
            {/* «ليس إنكار الهموم» يُشطب مع «بل» */}
            {T("ik2", 560, 300, "إنكار الهموم", 60, ["إنكار", 0.72], ["الهموم", 0.76, 2])}
            <Cross x1={720} x2={400} y={284} p={P(tBal - 2, tBal + 10)} z={z} />
          </g>
        ),
      };
    },
  },

  // S21 — الاستفتاح: الثناء والافتقار وطلب المغفرة
  istiftah: {
    nameAr: "دعاء الاستفتاح: الثناء والافتقار وطلب المغفرة",
    render: (c) => {
      const { frame, z, at, T, Box, P } = kit(c);
      const tDua = at("دعاء", 0.06);
      const tForms = at("صيغ", 0.22);
      const tThana = at("الثناء", 0.42);
      const tNeed = at("والافتقار", 0.52);
      const tMagh = at("وطلب", 0.6);
      const tKamal = at("الكمال", 0.78);
      const tBal = at("بل", 0.82);
      const tHope = at("راجين", 0.86);
      const fan = P(tForms, tForms + 20);
      return {
        focus: [[tDua, 960, 200], [tForms, 960, 420], [tThana, 1400, 680], [tNeed, 960, 680], [tMagh, 520, 680], [tKamal, 960, 860], [tHope, 960, 680]],
        cam: [C(0, 960, 230, 1.4), C(tForms - 6, 960, 430, 1.25), C(tThana - 6, 960, 680, 1.12)],
        world: (
          <g>
            {Box("ds", 960, 200, "دعاء الاستفتاح", 70, tDua, { font: "head", tEnd: c.end("الاستفتاح", 0.1) })}
            {/* صيغ متعددة: أوراق بسطور رمادية بلا نص */}
            {[-1, 0, 1].map((k) => (
              <g key={k} transform={`translate(${960 + k * 200 * fan} ${430}) rotate(${k * 6 * fan})`} opacity={P(tForms - 4, tForms + 6)}>
                <rect x={-110} y={-90} width={220} height={180} rx={14} fill={z.paper} stroke={z.ink} strokeWidth={5} />
                <Lines x={0} y={-40} w={150} n={3} p={1} z={z} gap={36} />
              </g>
            ))}
            {T("sg", 960, 590, "صيغ صحيحة متعددة", 66, ["صيغ", 0.22], ["متعددة", 0.3])}
            {Box("c1", 1400, 700, "الثناء", 64, tThana, { font: "head" })}
            {Box("c2", 960, 700, "الافتقار", 64, tNeed, { font: "head", fill: P(tHope, tHope + 14) > 0 ? z.hl : z.paper })}
            {Box("c3", 520, 700, "طلب المغفرة", 64, tMagh, { font: "head", tEnd: c.end("المغفرة", 0.64) })}
            {T("km", 960, 860, "مدعين الكمال", 64, ["مدعين", 0.76], ["الكمال", 0.78])}
            <InkPerson x={1640} y={860} s={0.8} pose="stand" p={P(at("نقف", 0.8) - 2, at("نقف", 0.8) + 16)} z={z} dir={-1} />
            <Cross x1={1130} x2={790} y={846} p={P(tBal - 2, tBal + 12)} z={z} />
          </g>
        ),
      };
    },
  },

  // S22 — اللفظ المشروع ومعناه
  "word-and-meaning": {
    nameAr: "نتعلم معاني الأذكار، ولا نضيف إليها ألفاظًا",
    render: (c) => {
      const { frame, z, at, T, P } = kit(c);
      // السكريبت المعتمد (١١ نوفمبر): «وبعد أن نسمع ألفاظ الذكر، نحتاج إلى أن نفهم معانيها. فالأذكار المأثورة لها صيغها ومواضعها؛
      // نتعلمها كما وردت، ولا ننسب إليها ألفاظًا من عندنا. وعندما نفهم ما نقول، يصبح لكل لفظ معنى نتأمله.»
      const tAdhkar = at("ألفاظ", 0.06);
      const tLearn = tAdhkar;
      const tMeanings = at("معانيها", 0.18);
      const tHurma = at("صيغها", 0.3);
      const tPlace = at("ومواضعها", 0.34);
      const tWarad = at("نتعلمها", 0.38);
      const tAdd = at("ننسب", 0.48);
      const tOurs = at("عندنا", 0.58);
      const tUnder = at("نفهم", 0.66, 2);
      const tGood = at("معنى", 0.9);
      const att = P(tAdd, tAdd + 22);
      return {
        focus: [[tAdhkar, 1300, 440], [tMeanings, 600, 440], [tHurma, 1300, 300], [tWarad, 1300, 440], [tAdd, 1000, 760], [tOurs, 1000, 760], [tUnder, 950, 440], [tGood, 950, 300]],
        cam: [C(0, 1300, 450, 1.25), C(tMeanings - 6, 950, 450, 1.1), C(tAdd - 6, 1000, 600, 1.1), C(tUnder - 6, 950, 440, 1.15)],
        world: (
          <g>
            {/* «ألفاظ الذكر» المأثورة: بطاقة ثابتة بسطور رمادية لا نص، يحيط بها إطار مع «صيغها»، وتُبرز مع «نتعلمها كما وردت» */}
            <g opacity={P(tAdhkar - 4, tAdhkar + 8)}>
              <rect x={1120} y={320} width={360} height={240} rx={18} fill={z.paper} stroke={z.ink} strokeWidth={7} />
              <rect x={1120} y={320} width={360} height={240} rx={18} fill={z.hl} opacity={0.35 * P(tWarad, tWarad + 14)} />
              <Lines x={1300} y={390} w={270} n={3} p={P(tAdhkar, tAdhkar + 16, (t) => t)} z={z} gap={44} />
              <rect x={1104} y={304} width={392} height={272} rx={24} fill="none" stroke={z.ink} strokeWidth={4} opacity={P(tHurma, tHurma + 14)} />
            </g>
            {T("ad", 1300, 640, "ألفاظ الذكر", 62, ["ألفاظ", 0.06], ["الذكر", 0.08])}
            {/* «معانيها»: كتاب يُفتح */}
            <g opacity={P(tMeanings - 4, tMeanings + 8)}>
              <path d="M460 360 Q530 330 600 360 Q670 330 740 360 L740 500 Q670 470 600 500 Q530 470 460 500 Z M600 360 L600 500" fill={z.paper} stroke={z.ink} strokeWidth={6} />
            </g>
            {T("mn", 600, 580, "معانيها", 64, ["معانيها", 0.18], undefined, { font: "head" })}
            {/* «ولا ننسب إليها ألفاظًا من عندنا»: بطاقة متقطعة تقترب ثم تُشطب، وتخفت مع «نفهم» */}
            <g transform={`translate(${lerp(820, 1000, att)} 750)`} opacity={P(tAdd - 4, tAdd + 6) * (1 - 0.5 * P(tUnder, tUnder + 10))}>
              <rect x={-200} y={-56} width={400} height={100} rx={14} fill="none" stroke={z.ink} strokeWidth={5} strokeDasharray="14 12" />
            </g>
            {T("lf", lerp(820, 1000, att), 762, "ألفاظا من عندنا", 64, ["ألفاظا", 0.52], ["عندنا", 0.58], { opacity: 1 - 0.5 * P(tUnder, tUnder + 10) })}
            <Cross x1={lerp(1010, 1190, att)} x2={lerp(630, 810, att)} y={746} p={P(tOurs + 8, tOurs + 22)} z={z} />
            {T("hm", 1300, 260, "صيغها ومواضعها", 60, ["صيغها", 0.3], ["ومواضعها", 0.34])}
            {/* «وعندما نفهم ما نقول»: سهم من المعاني إلى الألفاظ، و«معنى نتأمله» */}
            <Arrow x1={760} y1={430} x2={1100} y2={430} p={P(tUnder - 2, tUnder + 16)} c={z.ink} w={7} />
            <Stroke d="M760 430 L1100 430" p={P(tGood - 2, tGood + 14)} c={z.hl} w={26} opacity={0.8} />
            {T("hs", 930, 360, "معنى نتأمله", 64, ["معنى", 0.9], ["نتأمله", 0.95], { font: "head" })}
          </g>
        ),
      };
    },
  },

  // S23 — الاستعاذة: طلب العون والافتقار (سكون عند الذكر، ولا تصوير للشيطان)
  "seek-refuge": {
    nameAr: "الاستعاذة: طلب عون، لا وعد باختفاء كل شرود",
    render: (c) => {
      const { frame, z, at, T, P } = kit(c);
      // السكريبت المعتمد (١١ نوفمبر): «وحين نقترب من القراءة، نستعيذ بالله من الشيطان الرجيم. وهي ليست كلمات نمر بها على عجل؛ بل طلب
      // عون من الله، وإقرار بحاجتنا إليه. وإن عادت الخواطر بعدها، فليس هذا معناه أن الاستعاذة وعد باختفاء كل شرود؛ بل نستمر في المجاهدة
      // وطلب العون.» — سكون تام في الاستعاذة نفسها وعند «من الله»، ولا تصوير للشيطان.
      const tNear = at("نقترب", 0.02);
      const tRead = at("القراءة", 0.05);
      const tAjal = at("عجل", 0.36);
      const tBal1 = at("بل", 0.4);
      const tAsk = at("طلب", 0.42);
      const tNeed = at("بحاجتنا", 0.54);
      const tThought = at("الخواطر", 0.64);
      const tPromise = at("وعد", 0.74);
      const tBal2 = at("بل", 0.86, 2);
      const tDhikr = at("المجاهدة", 0.92);
      const tSincere = at("وطلب", 0.95);
      // الخواطر «عادت» حول الرأس، ولا تختفي: مع «بل نستمر» تتباعد قليلًا وتبهت، فتتسع المساحة حول المصلي
      const apart = P(tBal2, tDhikr + 18);
      const clouds: [number, number, number][] = [[800, 495, 54], [1125, 490, 50], [870, 415, 46], [1050, 420, 48]];
      c.reg([800, 470, 1120, 770], tNear);
      return {
        focus: [[tRead, 960, 330], [at("كلمات", 0.26), 960, 800], [tAjal, 960, 800], [tAsk, 1300, 560], [tNeed, 620, 560], [tThought, 960, 480], [tPromise, 960, 800], [tDhikr, 1300, 660], [tSincere, 620, 660]],
        cam: [C(0, 960, 330, 1.3), C(tNear - 2, 960, 520, 1.1), C(tAjal - 6, 960, 600, 1.08), C(tDhikr - 6, 960, 560, 1.04)],
        still: [],
        world: (
          <g>
            <g opacity={P(tRead - 4, tRead + 10)}>
              <path d="M760 220 Q860 180 960 220 Q1060 180 1160 220 L1160 380 Q1060 340 960 380 Q860 340 760 380 Z M960 220 L960 380" fill={z.paper} stroke={z.ink} strokeWidth={7} />
            </g>
            {T("qr", 960, 150, "القراءة", 64, ["القراءة", 0.05])}
            {/* المصلي قائم مع «نقترب»؛ لا يُرسم شيء عند الاستعاذة نفسها */}
            <InkPerson x={960} y={735} s={0.85} pose="fold" p={P(tNear - 4, tNear + 14)} z={z} dir={-1} />
            <Stroke d="M820 737 L1100 737 L1072 765 L848 765 Z" p={P(tNear - 2, tNear + 12)} c={z.ink} w={6} fill={z.hl} fillP={0.55 * P(tNear + 4, tNear + 16)} />
            {/* «ليست كلمات نمر بها على عجل»: تُكتب من «كلمات» وتُشطب مع «بل» */}
            <g opacity={1 - P(tThought - 8, tThought)}>
              {T("aj", 960, 860, "كلمات نمر بها على عجل", 58, ["كلمات", 0.26], ["عجل", 0.36])}
              <Cross x1={1240} x2={680} y={846} p={P(tBal1 - 2, tBal1 + 10)} z={z} />
            </g>
            {T("aw", 1360, 560, "طلب عون", 66, ["طلب", 0.42], ["عون", 0.44], { font: "body", weight: 600 })}
            {T("hj", 560, 560, "بحاجتنا", 66, ["بحاجتنا", 0.54], undefined, { font: "body", weight: 600 })}
            {/* «وإن عادت الخواطر بعدها»: سحب حول الرأس */}
            {clouds.map(([x, y, r], k) => {
              const dx = (x - 960) * 0.45 * apart;
              const dy = (y - 535) * 0.5 * apart;
              return <Cloud key={k} x={x + dx} y={y + dy} r={r} p={P(tThought - 4 + k * 4, tThought + 8 + k * 4)} z={z} o={1 - 0.5 * apart} />;
            })}
            {T("wd", 960, 860, "وعد باختفاء كل شرود", 60, ["وعد", 0.74], ["شرود", 0.82])}
            <Cross x1={1240} x2={680} y={846} p={P(tBal2 - 2, tBal2 + 12)} z={z} />
            {T("dm", 1360, 690, "المجاهدة", 64, ["المجاهدة", 0.92], undefined, { font: "head" })}
            {T("fs", 560, 690, "وطلب العون", 64, ["وطلب", 0.95], ["العون", 0.98], { font: "head" })}
            {/* «وطلب العون»: قلب المصلي يمتلئ */}
            <path d={heartPath(960, 575, 20)} fill={z.hl} stroke={z.ink} strokeWidth={4} opacity={P(tSincere - 2, tSincere + 10)} />
          </g>
        ),
      };
    },
  },

  // S25 — ما الذي تغير؟ محطات الحلقة والسؤال الواحد
  // S25 (معتمدة بالأمر 005 للقراءة على الهاتف): «الإقبال» محورًا بارزًا، وطرقه الثلاث بطاقات تُرسم عند نطقها،
  // والمحطات بالترتيب بخط النص العريض على مستويين، ثم تختفي العناصر الثانوية تدريجيًا فيبقى السؤال وحده
  recap: {
    nameAr: "ما سرنا معه: محطات التهيؤ والسؤال الواحد",
    render: (c) => {
      const { frame, z, at, end, T, P } = kit(c);
      // السكريبت المعتمد (١١ نوفمبر): «من العجلة إلى السكينة، ومن حركة الجسد إلى إقبال القلب، سرنا مع معاني التهيؤ للصلاة. الوضوء
      // يذكرنا بالطهارة، والقبلة بالاتجاه، والتكبير بالتعظيم، والاستفتاح بالافتقار، والاستعاذة بطلب العون. وراء هذه المعاني كلها
      // سؤال واحد: كيف نجعل ما نفهمه حاضرًا فيما نعمله؟»
      const tAjala = at("العجلة", 0.02);
      const tSakina = at("السكينة", 0.06);
      const tHaraka = at("حركة", 0.1);
      const tIqbal = at("إقبال", 0.16);
      const tTahayyu = at("التهيؤ", 0.26);
      const stations: [string, number, string, string, number][] = [
        ["الوضوء", at("الوضوء", 0.34), "بالطهارة", "بالطهارة", at("بالطهارة", 0.38)],
        ["والقبلة", at("والقبلة", 0.42), "بالاتجاه", "بالاتجاه", at("بالاتجاه", 0.45)],
        ["والتكبير", at("والتكبير", 0.48), "بالتعظيم", "بالتعظيم", at("بالتعظيم", 0.52)],
        ["والاستفتاح", at("والاستفتاح", 0.55), "بالافتقار", "بالافتقار", at("بالافتقار", 0.59)],
        ["والاستعاذة", at("والاستعاذة", 0.62), "بطلب العون", "بطلب", at("بطلب", 0.66)],
      ];
      const tOne = at("واحد", 0.8);
      const tFinal = at("كيف", 0.84);
      const dimAll = P(tOne - 4, Math.max(tOne + 14, tFinal - 4), (t) => t * t * (3 - 2 * t));
      const pathP = P(stations[0]![1] - 6, stations[4]![1] + 6, (t) => t);
      return {
        // كاميرا ثابتة تقريبًا تُبقي الخلاصة كلها داخل المنطقة الآمنة وبحجمها المقروء؛ الحركة من بناء العناصر نفسها
        focus: [],
        cam: [C(0, 995, 470, 1.04), C(tOne - 6, 960, 540, 1.0)],
        world: (
          <g>
            <g opacity={1 - 0.95 * dimAll}>
              <g transform={`translate(0 ${-45 * dimAll})`}>
              {/* «من العجلة إلى السكينة، ومن حركة الجسد إلى إقبال القلب» */}
              {T("aj", 1520, 240, "العجلة", 62, ["العجلة", 0.02], undefined, { font: "head" })}
              <Arrow x1={1420} y1={225} x2={1290} y2={225} p={P(tSakina - 4, tSakina + 8)} c={z.ink} w={6} />
              {T("sk", 1160, 240, "السكينة", 62, ["السكينة", 0.06], undefined, { font: "head" })}
              {T("hj", 1520, 350, "حركة الجسد", 58, ["حركة", 0.1], ["الجسد", 0.12])}
              <Arrow x1={1370} y1={335} x2={1290} y2={335} p={P(tIqbal - 4, tIqbal + 8)} c={z.ink} w={6} />
              {T("iq", 1140, 350, "إقبال القلب", 58, ["إقبال", 0.16], ["القلب", 0.18])}
              {/* «سرنا مع معاني التهيؤ للصلاة» */}
              <Mark x={540 - 220} y={228} w={440} h={60} p={P(end("للصلاة", 0.3), end("للصلاة", 0.3) + 12)} z={z} />
              {T("th", 540, 280, "التهيؤ للصلاة", 80, ["التهيؤ", 0.26], ["للصلاة", 0.3], { font: "head" })}
              </g>
              {/* المحطات: كل محطة ومعناها عند نطقهما؛ تصعد قليلًا عند «واحد» لتترك مساحة السؤال */}
              <g transform={`translate(0 ${-125 * dimAll})`}>
              <Stroke d="M1660 600 L260 600" p={pathP} c={z.ink} w={7} />
              {stations.map(([w, t, m, mw, tm], k) => {
                // تباعد ٣١٠ وصفّان ثابتان (المحطة ثم معناها) فلا تتزاحم الكلمات
                const x = 1580 - k * 310;
                const ly = 712;
                return (
                  <g key={w}>
                    <circle cx={x} cy={600} r={30} fill={z.hl} stroke={z.ink} strokeWidth={6} opacity={P(t - 4, t + 6)} />
                    {/* D73: ما له صورة في المكتبة يُرسم فوق محطته؛ الاستفتاح والاستعاذة ذِكر، فيبقيان كلمتين */}
                    {k === 0 ? <Icon id="ewer" x={x} y={500} s={0.8} p={P(t - 2, t + 12)} c={z.ink} /> : null}
                    {k === 1 ? <Kaaba x={x} y={548} s={0.42} p={P(t - 2, t + 12)} z={z} band={0} /> : null}
                    {k === 2 ? <InkPerson x={x} y={556} s={0.3} pose="raise" p={P(t - 2, t + 12)} z={z} dir={-1} /> : null}
                    <line x1={x} x2={x} y1={630} y2={650} stroke={z.ink} strokeWidth={4} opacity={P(t - 2, t + 6)} />
                    {T(`s${k}`, x, ly, w, 56, [w, 0.5], undefined, { font: "body", weight: 700 })}
                    {T(`m${k}`, x, ly + 62, m, 52, [mw, 0.5], k === 4 ? ["العون", 0.68] : undefined, { font: "body", weight: 500 })}
                  </g>
                );
              })}
              </g>
            </g>
            {/* السؤال الواحد: يأخذ مساحة الصفحة وحده بعد أن تبهت المحطات وتصعد */}
            <g opacity={P(Math.max(tOne + 10, tFinal - 14), Math.max(tOne + 22, tFinal - 2))}>
              <rect x={960 - 560} y={700} width={1120} height={150} rx={18} fill={z.paper} stroke={z.ink} strokeWidth={6} />
            </g>
            {T("fq", 960, 800, "كيف نجعل ما نفهمه حاضرا فيما نعمله؟", 60, ["كيف", 0.84], ["نعمله", 0.98], { font: "head" })}
            <Mark x={960 - 480} y={812} w={960} h={18} p={P(end("نعمله", 0.98), end("نعمله", 0.98) + 14)} z={z} />
          </g>
        ),
      };
    },
  },

  // S27 — باب القراءة: الحلقة القادمة والخاتمة
  "reading-door": {
    nameAr: "باب القراءة: الحلقة القادمة",
    render: (c) => {
      const { frame, z, at, end, T, P } = kit(c);
      // السكريبت المعتمد (١١ نوفمبر): «وإذا كانت الصلاة تبدأ بالتكبير، فماذا عن الكلام الذي نقرؤه بعده؟ هناك ينفتح باب الحلقة القادمة:
      // كيف نقرأ القرآن في الصلاة بفهم وانتباه؟ كانت هذه قراءتنا الأولى من كتاب «أول مرة أصلي» للدكتور خالد أبي شادي، من «زبدة الكتب».»
      const tWhat = at("فماذا", 0.14);
      const tNear = at("الكلام", 0.18);
      const tMeanings = at("نقرؤه", 0.24);
      const tDoor = at("باب", 0.32);
      const tNext = at("الحلقة", 0.34);
      const tPrayer = at("الصلاة", 0.44, 2);
      const tInter = at("بفهم", 0.48);
      const tFirstW = at("الأولى", 0.62);
      const tAuthor = end("شادي", 0.84);
      const bookS = lerp(1.3, 1.9, P(tNear - 2, tMeanings + 12));
      const tHearts = at("وانتباه", 0.5);
      const tFirst = at("قراءتنا", 0.58);
      const tBook = at("كتاب", 0.66);
      const tChannel = at("زبدة", 0.92);
      const open = P(tDoor, tDoor + 24);
      const out = P(tFirst - 10, tFirst + 8);
      const bookIn = P(tFirst - 4, tFirst + 14);
      return {
        focus: [[tWhat, 620, 330], [tNear, 960, 440], [tMeanings, 960, 460], [tDoor, 960, 460], [tNext, 960, 240], [tPrayer, 760, 600], [tInter, 960, 560], [tHearts, 960, 560], [tFirst, 1300, 500], [tFirstW, 1300, 380], [tBook, 1300, 500], [tAuthor, 700, 520], [tChannel, 700, 620]],
        cam: [C(0, 900, 440, 1.2), C(tDoor - 6, 960, 520, 1.15), C(tFirst - 8, 1000, 520, 1.0), C(tChannel - 6, 820, 600, 1.15)],
        world: (
          <g>
            <g opacity={1 - out}>
              {/* الباب يُفتح على صفحة مضيئة */}
              <rect x={800} y={230} width={320} height={480} rx={10} fill={z.hl} opacity={0.8 * open} />
              <rect x={800} y={230} width={320} height={480} rx={10} fill="none" stroke={z.ink} strokeWidth={8} opacity={P(tDoor - 6, tDoor + 4)} />
              <g transform={`translate(1120 230) scale(${1 - 0.82 * open} 1)`} opacity={P(tDoor - 6, tDoor + 4)}>
                <rect x={-320} y={0} width={320} height={480} rx={8} fill={z.paper} stroke={z.ink} strokeWidth={7} />
                <circle cx={-280} cy={250} r={10} fill={z.ink} />
              </g>
              {/* «فماذا عن الكلام الذي نقرؤه بعده؟» */}
              <g opacity={1 - P(tDoor - 6, tDoor + 6)}>{T("wq", 620, 330, "؟", 150, ["فماذا", 0.14], undefined, { font: "head" })}</g>
              {T("bq", 960, 790, "بفهم وانتباه", 66, ["بفهم", 0.48], ["وانتباه", 0.5], { font: "head" })}
              {/* «الحلقة القادمة»: بطاقة فسفورية فوق الباب */}
              <g transform={`translate(960 ${lerp(120, 170, P(tNext - 4, tNext + 10))})`} opacity={P(tNext - 4, tNext + 6)}>
                <rect x={-210} y={-50} width={420} height={92} rx={12} fill={z.hl} stroke={z.ink} strokeWidth={5} />
              </g>
              {T("nx", 960, 188, "الحلقة القادمة", 62, ["الحلقة", 0.34], ["القادمة", 0.36])}
              {/* «الكلام الذي نقرؤه بعده»: كتاب مفتوح يكبر، وتُكتب سطوره مع «نقرؤه»، وتُقلب صفحة مع «بعده» */}
              <g transform={`translate(960 440) scale(${bookS})`} opacity={P(tNear - 4, tNear + 8)}>
                <path d="M-80 -34 Q-40 -54 0 -34 Q40 -54 80 -34 L80 44 Q40 24 0 44 Q-40 24 -80 44 Z M0 -34 L0 44" fill={z.paper} stroke={z.ink} strokeWidth={4} />
                {[-14, 2, 18].map((dy, i) => (
                  <g key={i}>
                    <Stroke d={`M-12 ${dy} Q-34 ${dy - 10} -64 ${dy}`} p={P(tMeanings + i * 4, tMeanings + i * 4 + 10)} c={z.ink} w={3} />
                    <Stroke d={`M64 ${dy} Q34 ${dy - 10} 12 ${dy}`} p={P(tMeanings + 6 + i * 4, tMeanings + 16 + i * 4)} c={z.ink} w={3} />
                  </g>
                ))}
                {(() => {
                  const f = P(at("بعده", 0.26), at("بعده", 0.26) + 16, (t) => t);
                  const on = f > 0 && f < 1;
                  const x = 80 - 160 * f;
                  return on ? <path d={`M0 -34 Q${x / 2} ${-54 + 10 * Math.sin(Math.PI * f)} ${x} -34 L${x} 44 Q${x / 2} 24 0 44 Z`} fill={z.paper} stroke={z.ink} strokeWidth={3} /> : null;
                })()}
              </g>
              {/* «في الصلاة»: مصلٍّ قائم يقرأ عند الباب */}
              <InkPerson x={640} y={700} s={0.7} pose="fold" p={P(tPrayer - 4, tPrayer + 14)} z={z} dir={1} />
              {/* «بفهم»: خيطان فسفوريان من الصفحة إلى القلب */}
              <Stroke d="M900 520 Q910 560 945 585" p={P(tInter - 2, tInter + 12)} c={z.hl} w={12} />
              <Stroke d="M1020 520 Q1010 560 975 585" p={P(tInter + 2, tInter + 16)} c={z.hl} w={12} />
              {/* «وانتباه»: قلب يكبر ويمتلئ */}
              <path d={heartPath(960, 610, 44 + 10 * Math.sin(Math.PI * P(tHearts - 2, tHearts + 16)))} fill={P(tHearts, tHearts + 10) > 0.5 ? z.ink : z.paper} stroke={z.ink} strokeWidth={6} opacity={P(tHearts - 4, tHearts + 8)} />
            </g>
            {/* قراءتنا الأولى من الكتاب، من زبدة الكتب */}
            <g transform={`translate(${lerp(1900, 1340, bookIn)} 460) rotate(-3)`} opacity={bookIn}>
              <rect x={-170} y={-240} width={340} height={480} rx={14} fill={z.ink} />
              <rect x={-120} y={-170} width={240} height={22} rx={6} fill={z.hl} />
              <text x={0} y={-40} textAnchor="middle" direction="rtl" style={{ fontFamily: fam("head"), fontSize: 54, fill: z.paper }}>
                أول مرة أصلي
              </text>
              {/* «الأولى»: شريط علامة فسفوري ينزل في الكتاب؛ القراءة مستمرة في الحلقات القادمة */}
              <path d={`M100 -240 L140 -240 L140 ${-240 + 120 * P(tFirstW - 2, tFirstW + 14)} L120 ${-258 + 120 * P(tFirstW - 2, tFirstW + 14)} L100 ${-240 + 120 * P(tFirstW - 2, tFirstW + 14)} Z`} fill={z.hl} stroke={z.paper} strokeWidth={4} opacity={P(tFirstW - 2, tFirstW + 4)} />
            </g>
            {T("qa", 700, 420, "قراءتنا الأولى", 70, ["قراءتنا", 0.58], ["الأولى", 0.62], { font: "head" })}
            {T("au", 700, 520, "للدكتور خالد أبي شادي", 66, ["للدكتور", 0.74], ["شادي", 0.84], { font: "body", weight: 600 })}
            {T("zk", 700, 680, "زبدة الكتب", 96, ["زبدة", 0.92], ["الكتب", 0.98], { font: "head" })}
            <Mark x={700 - 300} y={530} w={600} h={16} p={P(tAuthor - 4, tAuthor + 12)} z={z} />
            <Mark x={700 - 230} y={690} w={460} h={22} p={P(tChannel + 10, tChannel + 26)} z={z} />
          </g>
        ),
      };
    },
  },
};
