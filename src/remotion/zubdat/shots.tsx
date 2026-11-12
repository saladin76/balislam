import React from "react";
import type { CamKey } from "../illus/shots/kit";
import { INK_SHOTS_2 } from "./shots2";
import { KIT_SHOTS, type InkArgs } from "./kitShots";
import { Arrow, Card, Cross, Icon, InkPerson, Kaaba, Mark, Stroke, Sun, Write, heartPath, lerp, measure, fam, outCubic, prog, type Z } from "./inkKit";

/**
 * مشاهد الحبر المصمَّمة لزبدة الكتب: كل مشهد حدث بصري له بداية وتطور ونتيجة،
 * وكل ما يُرسم أو يُكتب يقع لحظة نطق كلمته، ولا نص على الشاشة إلا ما يُنطق.
 * توقير: لا قلم ولا تظليل ولا رمز بجوار ذكر الله، والكاميرا ساكنة تمامًا وقت الذكر.
 */
export type InkCtx = {
  frame: number;
  dur: number;
  z: Z;
  at: (word: string, frac: number, nth?: number) => number;
  end: (word: string, frac: number, nth?: number) => number;
  /** شعار القناة المعتمد (كما هو، بلا تعديل) */
  logo: (size: number) => React.ReactNode;
  /** تسجيل مستطيل عنصر ولحظة ظهوره، لتبقيه الكاميرا داخل الإطار */
  reg: (r: [number, number, number, number], t: number) => void;
  /** مهمة الحلقة (للخاتمة) */
  task?: string;
  /** حقلا أدوات الاستوديو العامة (kit-*): العبارات والتوقيت؛ لا تستعملهما مشاهد الحلقات الخاصة */
  args?: InkArgs;
};
/**
 * focus: لحظات الأحداث ومواضعها [لحظة، x، y]؛ الكاميرا تميل إلى كل حدث لحظة وقوعه (كاميرا فوق الدفتر تتبع القلم).
 * still: نوافذ سكون تام (الذكر)، لا تُضاف فيها حركة كاميرا.
 */
export type InkShotOut = { cam: CamKey[]; world: React.ReactNode; camLen?: number; focus?: [number, number, number][]; still?: [number, number][] };
export type InkShotDef = { nameAr: string; render: (c: InkCtx) => InkShotOut };

const C = (t: number, x: number, y: number, z: number): CamKey => ({ t, x, y, z });
/** كتابة نص بين لحظتين (بداية الكلمة الأولى ونهاية الأخيرة) */
const wp = (frame: number, a: number, b: number) => prog(frame, a - 2, Math.max(a + 10, b), (t) => t);

// ── شريط اليوم: خط الوقت، والشمس تعبره، وعلامات الصلوات الخمس ────────────────
const TICKS = [0.08, 0.36, 0.56, 0.74, 0.92];
const DayStrip: React.FC<{ z: Z; line: number; sun: number; postures?: number[]; gray?: number; ticksAll?: boolean }> = ({ z, line, sun, postures, gray = 0, ticksAll }) => {
  const col = gray > 0 ? z.faint : z.ink;
  const L = 620;
  return (
    <g>
      <Stroke d={`M${L} 0 L${-L} 0`} p={line} c={col} w={7} />
      {TICKS.map((f, i) => {
        const x = L - 2 * L * f;
        const on = ticksAll ? line : prog(sun, f - 0.02, f + 0.06);
        return (
          <g key={i} opacity={on}>
            <line x1={x} x2={x} y1={-24} y2={24} stroke={col} strokeWidth={7} strokeLinecap="round" />
            {/* علامة الصلاة بالحبر الأسود: الفسفوري للفكرة وحدها (توجيه المالك، ٩ نوفمبر) */}
            <circle cx={x} cy={-46} r={10 * on} fill={col} stroke={col} strokeWidth={4} />
          </g>
        );
      })}
      {sun > 0 && sun < 1 && !gray ? <Sun x={L - 2 * L * sun} y={-90 - 150 * Math.sin(Math.PI * sun)} z={z} r={26} /> : null}
      {postures
        ? (["stand", "fold", "ruku", "sujud"] as const).map((pose, i) => (
            <InkPerson key={pose} x={[420, 140, -140, -420][i]!} y={340} s={0.82} pose={pose} p={postures[i] ?? 0} z={z} dir={-1} color={col} />
          ))
        : null}
    </g>
  );
};

/** كتاب مفتوح صغير بالحبر */
const OpenBook: React.FC<{ x: number; y: number; s?: number; p: number; z: Z; flip?: number }> = ({ x, y, s = 1, p, z, flip = 0 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <Stroke d="M-80 -34 Q-40 -54 0 -34 Q40 -54 80 -34 L80 44 Q40 24 0 44 Q-40 24 -80 44 Z" p={p} c={z.ink} w={7} fill={z.paper} fillP={p} />
    <Stroke d="M0 -34 L0 44" p={prog(p, 0.5, 1)} c={z.ink} w={6} />
    {[-14, 2, 18].map((dy, i) => (
      <g key={i}>
        <Stroke d={`M-64 ${dy} Q-34 ${dy - 12} -12 ${dy}`} p={prog(p, 0.6 + i * 0.1, 1)} c={z.ink} w={3} opacity={0.5} />
        <Stroke d={`M12 ${dy} Q34 ${dy - 12} 64 ${dy}`} p={prog(p, 0.6 + i * 0.1, 1)} c={z.ink} w={3} opacity={0.5} />
      </g>
    ))}
    {flip > 0 && flip < 1 ? (
      <path d={`M0 -34 Q${80 - 160 * flip} ${-60 + 20 * Math.sin(Math.PI * flip)} ${80 - 160 * flip} -34 L${80 - 160 * flip} 44 Q${40 - 80 * flip} 24 0 44 Z`} fill={z.paper} stroke={z.ink} strokeWidth={5} />
    ) : null}
  </g>
);

/** علامة الإيقاف المؤقت: خطان سميكان */
const Pause: React.FC<{ x: number; y: number; p: number; z: Z }> = ({ x, y, p, z }) => (
  <g transform={`translate(${x} ${y})`}>
    <Stroke d="M-18 -40 L-18 40" p={prog(p, 0, 0.6)} c={z.ink} w={18} />
    <Stroke d="M18 -40 L18 40" p={prog(p, 0.4, 1)} c={z.ink} w={18} />
  </g>
);

/**
 * «habit-heart» (c1-s1): لحظات خروج الشبكة ودخول «؟» من كلمتيهما. الشبكة تبدأ الاختفاء عند «لكنْ»
 * (أو قبل «سؤالٌ» بستة إطارات إن ضاق ما بينهما) وتنتهي قبل «سؤالٌ» بإطار، و«؟» يبدأ مع «سؤالٌ» نفسها.
 */
export const habitHeartCues = (tLakin: number, tQ: number) => {
  const gridEnd = tQ - 1;
  return { gridStart: Math.min(tLakin, gridEnd - 6), gridEnd, qStart: tQ };
};

export const INK_SHOTS: Record<string, InkShotDef> = {
  // S01 — العادة وحضور القلب
  "habit-heart": {
    nameAr: "الصلاة اليومية: تكرار الفعل وحضور القلب",
    render: ({ frame, z, at, end }) => {
      // السكريبت المعتمد (١١ نوفمبر): «تخيّل أنك أنهيت صلاتك… نعرف هذه الأفعال جيدًا؛ ولكنْ… يبقى سؤالٌ أعمق: هل يحضر قلبنا…»
      const t0 = at("صلاتك", 0.08);
      const tW = [at("نقف", 0.36), at("نقرأ", 0.39), at("نركع", 0.42), at("نسجد", 0.45)];
      const tYears = at("نعرف", 0.47); // معرفة الأفعال بالتكرار: الأيام تتكرر شبكةً
      const tFam = at("جيدا", 0.56); // الإلف: الأيام تبهت
      const tLakin = at("لكن", 0.58);
      const tQ = at("سؤال", 0.72);
      const tHal = at("هل", 0.78);
      const tBody1 = at("يحضر", 0.8);
      const tHeart = at("قلبنا", 0.83);
      const tBody2 = at("يحضر", 0.94, 2);
      const tBody = at("جسدنا", 0.97);
      const line = prog(frame, t0 - 4, t0 + 20);
      const sun = prog(frame, t0 + 4, tW[0]! + 6, (t) => t);
      const post = tW.map((t) => prog(frame, t - 3, t + 16));
      const gridIn = (k: number) => prog(frame, tYears + k * 4, tYears + k * 4 + 12);
      const gray = prog(frame, tFam - 4, tFam + 16);
      // توجيه المالك (٩ نوفمبر): الشبكة تبدأ الاختفاء عند «لكنَّ» وتفرغ الصفحة قبل «سؤالًا»،
      // ثم يبدأ «؟» مع بداية «سؤالًا» على صفحة فارغة، بلا تداخل
      const { gridStart, gridEnd, qStart } = habitHeartCues(tLakin, tQ);
      const gridOut = 1 - prog(frame, gridStart, gridEnd);
      const qBig = prog(frame, qStart, qStart + 16, (t) => t);
      const qMove = prog(frame, tHal, tHal + 18);
      const cells: [number, number][] = [];
      for (const r of [-1, 0, 1, 2]) for (const c of [-1, 0, 1]) if (!(r === 0 && c === 0)) cells.push([c, r]);
      return {
        camLen: 28,
        focus: [[at("تخيل", 0.0), 960, 330], ...tW.map((t, i): [number, number, number] => [t, 960 + [420, 140, -140, -420][i]!, 620]), [at("الأفعال", 0.53), 960, 600], [tQ, 960, 600], [tHal, 965, 470], [tHeart, 760, 600], [tBody2, 1180, 700], [tBody, 1400, 700]],
        cam: [C(0, 960, 420, 1.12), C(tW[0]! - 8, 960, 560, 1.0), C(tYears - 2, 960, 640, 0.45), C(gridStart, 960, 540, 1.0), C(tHeart - 8, 960, 600, 1.12)],
        world: (
          <g>
            <g opacity={gridOut}>
              {cells.map(([c, r], k) => (
                <g key={k} transform={`translate(${960 + c * 1420} ${380 + r * 600})`} opacity={gridIn(k) * 0.7}>
                  <DayStrip z={z} line={1} sun={1} postures={[1, 1, 1, 1]} gray={gray} ticksAll />
                </g>
              ))}
              <g transform="translate(960 380)">
                <DayStrip z={z} line={line} sun={sun} postures={post} gray={gray} />
              </g>
            </g>
            {/* السؤال: علامة استفهام كبيرة تنتقل لتقف بين القلب والجسد */}
            <Write id="q" x={lerp(960, 965, qMove)} y={lerp(700, 470, qMove)} text="؟" size={lerp(420, 230, qMove)} p={qBig} c={z.ink} font="head" z={z} />
            <g opacity={prog(frame, tHeart - 4, tHeart + 8)}>
              <ellipse cx={760} cy={600} rx={170} ry={160} fill={z.hl} opacity={0.55 * prog(frame, tHeart, tHeart + 14)} />
              <path d={heartPath(760, 600, 112)} fill="none" stroke={z.ink} strokeWidth={10} strokeDasharray="22 18" strokeLinecap="round" />
            </g>
            <Write id="hq" x={760} y={830} text="قلبنا" size={72} p={wp(frame, tHeart, end("قلبنا", 0.85))} c={z.ink} z={z} />
            {/* «يحضر»: الجسد يحضر متقطعًا ثم يكتمل عند «جسدنا»، والقلب يبقى سؤالًا */}
            <InkPerson x={1180} y={860} s={1.3} pose="stand" p={prog(frame, tBody1 - 2, tBody1 + 16)} z={z} dir={-1} dashed opacity={1 - prog(frame, tBody, tBody + 10)} />
            <InkPerson x={1180} y={860} s={1.3} pose="stand" p={prog(frame, tBody2 - 2, tBody + 6)} z={z} dir={-1} />
            <Write id="bq" x={1400} y={720} text="جسدنا" size={72} p={wp(frame, tBody, end("جسدنا", 0.98))} c={z.ink} z={z} />
          </g>
        ),
      };
    },
  },

  // S03 — بطاقة الكتاب والرحلة
  "book-journey": {
    nameAr: "بطاقة الكتاب ورحلته: من التهيؤ إلى ما نقوله ونفعله",
    render: ({ frame, z, at, end }) => {
      const tB = at("كتاب", 0.02);
      const tT = at("أول", 0.06);
      const tSub = at("وكان", 0.14);
      const tDr = at("الدكتور", 0.3);
      // السكريبت المعتمد (١١ نوفمبر): «يصحبنا… مِنَ التهيؤ للصلاة إلى معاني أقوالها وأفعالها. ولكننا لن نبدأ من الركوع
      // أو السجود؛ سنبدأ مما يسبقهما: كيف نهيئ قلوبنا؟»
      const tTrip = at("من", 0.36, 2);
      const tA = at("التهيؤ", 0.4);
      const tBst = at("معاني", 0.5);
      const tNot = at("الركوع", 0.68);
      const tStep = at("سنبدأ", 0.78);
      const tKayf = at("كيف", 0.88);
      const tHeart = at("نهيئ", 0.92);
      const bIn = prog(frame, tB - 10, tB + 16, outCubic);
      const bx = 1330 + 700 * (1 - bIn);
      const rot = lerp(9, -3, bIn);
      const t1w = measure("أول مرة أصلي", 62, fam("head"));
      const slip = prog(frame, tDr - 8, tDr + 10, outCubic);
      const path1 = prog(frame, tTrip, tA + 2, (t) => t);
      const path2 = prog(frame, tA + 6, tBst + 4, (t) => t);
      const fill = prog(frame, tHeart - 2, tHeart + 16);
      const flag = prog(frame, tStep - 2, tStep + 14, outCubic);
      return {
        focus: [[tT, 1330, 410], [tSub, 1330, 500], [tDr, 1250, 850], [tTrip, 950, 560], [tA, 760, 570], [tBst, 420, 470], [tNot, 420, 470], [tStep, 760, 480], [tKayf, 680, 740]],
        cam: [C(0, 1180, 500, 1.02), C(tDr - 10, 1240, 600, 1.08), C(tTrip - 2, 900, 520, 1.0), C(tBst - 4, 760, 520, 1.05), C(tKayf - 8, 820, 600, 1.1)],
        world: (
          <g>
            {/* الكتاب: غلاف أسود بشريط فسفوري (بطاقة القناة، لا صورة الغلاف الأصلي) */}
            <g transform={`translate(${bx} 420) rotate(${rot})`}>
              <rect x={-198} y={-278} width={420} height={580} rx={18} fill={z.ink} opacity={0.15} transform="translate(16 18)" />
              <rect x={-212} y={-286} width={420} height={580} rx={16} fill={z.paper} stroke={z.ink} strokeWidth={5} />
              <rect x={-222} y={-292} width={420} height={580} rx={16} fill={z.ink} />
              <rect x={160} y={-292} width={38} height={580} fill={z.paper} opacity={0.14} />
              <rect x={-170} y={-210} width={290} height={26} rx={6} fill={z.hl} />
              <Write id="bt" x={-12} y={-60} text="أول مرة أصلي" size={62} p={wp(frame, tT, end("أصلي", 0.1))} c={z.paper} font="head" z={z} />
              {/* الأمر 018: سطران بحجم 62 بدل سطر بحجم 50 (غير مقروء بعرض 390)، والغلاف بعرضه */}
              <Write id="bs" x={-12} y={24} text="وكان للصلاة" size={62} p={wp(frame, tSub, at("طعم", 0.2))} c={z.hl} z={z} />
              <Write id="bs2" x={-12} y={104} text="طعم آخر" size={62} p={wp(frame, at("طعم", 0.2), end("آخر", 0.22))} c={z.hl} z={z} />
              <rect x={-12 - t1w / 2} y={190} width={t1w} height={4} fill={z.paper} opacity={0.5 * bIn} />
            </g>
            {/* بطاقة المؤلف تنزلق من تحت الكتاب */}
            <g transform={`translate(${1250 - 60 * (1 - slip)} ${750 + 120 * (1 - slip)})`} opacity={slip}>
              <Card x={0} y={0} w={560} h={104} z={z} rot={-2}>
                <Write id="au" x={0} y={16} text="الدكتور خالد أبو شادي" size={54} p={wp(frame, tDr, end("شادي", 0.4))} c={z.ink} font="body" weight={600} z={z} />
              </Card>
            </g>
            {/* الرحلة: من الكتاب إلى محطتين */}
            <Stroke d="M1080 520 C980 560 880 600 800 580" p={path1} c={z.ink} w={7} />
            <Stroke d="M720 560 C640 520 560 470 460 450" p={path2} c={z.ink} w={7} />
            <g opacity={prog(frame, tA - 4, tA + 8)}>
              <circle cx={760} cy={570} r={46} fill={z.paper} stroke={z.ink} strokeWidth={7} />
              <circle cx={760} cy={570} r={40 * fill} fill={z.hl} />
              {fill > 0 ? <path d={heartPath(760, 572, 18)} fill={z.ink} opacity={prog(frame, end("قلوبنا", 0.97) - 6, end("قلوبنا", 0.97) + 6)} /> : null}
            </g>
            <Write id="sa" x={760} y={690} text="التهيؤ للصلاة" size={66} p={wp(frame, tA, end("للصلاة", 0.46))} c={z.ink} z={z} opacity={1 - fill} />
            {/* «لن نبدأ من الركوع أو السجود»: المحطة الثانية تخفت، والبداية من الأولى */}
            <g opacity={prog(frame, tBst - 4, tBst + 8) * (1 - 0.65 * prog(frame, tNot - 2, tNot + 12))}>
              <circle cx={420} cy={440} r={46} fill={z.paper} stroke={z.ink} strokeWidth={7} />
            </g>
            <Write id="sb" x={420} y={570} text="معاني أقوالها وأفعالها" size={52} p={wp(frame, tBst - 4, end("وأفعالها", 0.6))} c={z.ink} z={z} opacity={1 - 0.65 * prog(frame, tNot - 2, tNot + 12)} />
            {/* الخطوة الأولى: علم يُغرز في المحطة الأولى */}
            <g transform={`translate(${760} ${570 - 46 - 40 * (1 - flag)})`} opacity={flag}>
              <line x1={0} y1={0} x2={0} y2={-110} stroke={z.ink} strokeWidth={7} strokeLinecap="round" />
              <path d="M0 -110 L-70 -88 L0 -66 Z" fill={z.hl} stroke={z.ink} strokeWidth={5} strokeLinejoin="round" />
            </g>
            <Write id="tq" x={620} y={800} text="كيف نهيئ قلوبنا؟" size={76} p={wp(frame, tKayf, end("قلوبنا", 0.98))} c={z.ink} font="head" z={z} />
          </g>
        ),
      };
    },
  },

  // S07 — خط الانتباه: يخرج ثم يرجع
  "attention-line": {
    nameAr: "خط الانتباه: يشرد الذهن ثم نعود إلى ما نقرؤه",
    render: ({ frame, z, at, end }) => {
      // السكريبت المعتمد (١١ نوفمبر): «ولا يعني هذا أن الخواطر ستنقطع تمامًا. قد يشرد الذهن، ثم ننتبه، فنعود إلى ما نقرأه ونقوله.
      // وهذه العودة نفسها جزء من مجاهدتنا. فالخشوع يزيد وينقص؛ وما نسعى إليه ليس ادعاء الكمال، بل الاستمرار في طلبه.»
      const tCause = at("الخواطر", 0.06);
      const tFull = at("ستنقطع", 0.1);
      const tSalah = at("تماما", 0.14);
      const tThought = at("يشرد", 0.2);
      const tWeak = at("الذهن", 0.24);
      const tBack = at("فنعود", 0.32);
      const tRead = at("نقرأه", 0.38);
      const tSay = at("ونقوله", 0.42);
      const tAwda = at("العودة", 0.48);
      const tMuj = at("مجاهدتنا", 0.56);
      const tKh = at("الخشوع", 0.62);
      const tUp = at("يزيد", 0.65);
      const tDown = at("وينقص", 0.68);
      const tJ = at("نسعى", 0.74);
      const tYa = at("ادعاء", 0.8);
      const tQal = at("الكمال", 0.84);
      const tAsp = at("الاستمرار", 0.9);
      const tAkmal = at("طلبه", 0.97);
      const seg1 = prog(frame, tCause, tFull, (t) => t);
      const ghost = prog(frame, tFull - 4, tFull + 12);
      const seg2 = prog(frame, tThought - 2, tWeak, (t) => t);
      const seg3 = prog(frame, tWeak, tBack, (t) => t);
      const seg4 = prog(frame, tBack - 2, tRead + 8, (t) => t);
      const truth = prog(frame, tAwda - 2, tAwda + 16);
      // صفحة الفكرة الجديدة: ما سبق يبهت ولا يختفي، ويُرسم مؤشر الخشوع على الورقة نفسها
      // الأمر 010: ما سبق يُخفى تمامًا فلا يبقى طيفه فوق المؤشر
      const dim = 1 - prog(frame, tKh - 6, tKh + 12);
      // «الاستمرار» يمضي صاعدًا دون أن يبلغ «ادعاء الكمال» المشطوب
      const W = [[1620, 600], [1420, 440], [1220, 660], [990, 450], [800, 580], [560, 500]] as const;
      const segT: [number, number][] = [[tUp - 2, tUp + 14], [tDown - 2, tDown + 14], [tJ - 2, tJ + 18], [tYa - 4, tQal + 8], [tAsp - 2, tAkmal + 8]];
      const segP = segT.map(([a, b]) => prog(frame, a, b, (t) => t));
      const seg = (i: number) => `M${W[i]![0]} ${W[i]![1]} L${W[i + 1]![0]} ${W[i + 1]![1]}`;
      // الساعي: يظهر مع «نسعى» ويمشي على رأس المؤشر صعودًا وهبوطًا
      const tipK = segP[4]! > 0 ? 4 : segP[3]! > 0 ? 3 : 2;
      const tp = segP[tipK]!;
      const sx = lerp(W[tipK]![0], W[tipK + 1]![0], tp);
      const sy = lerp(W[tipK]![1], W[tipK + 1]![1], tp);
      const cloud = (k: number) => prog(frame, tThought + k * 6, tThought + k * 6 + 12, outCubic);
      return {
        camLen: 26,
        focus: [[tCause, 1590, 500], [tFull, 860, 600], [tSalah, 860, 620], [tThought, 1200, 350], [tWeak, 900, 260], [tBack, 700, 400], [tRead, 250, 560], [tSay, 150, 560], [tAwda, 600, 600], [tMuj, 520, 720], [tKh, 960, 200], [tUp, 1420, 400], [tDown, 1220, 700], [tJ, 1120, 500], [tYa, 470, 250], [tAsp, 770, 830], [tAkmal, 560, 460]],
        cam: [C(0, 1440, 520, 1.3), C(tFull - 6, 1000, 560, 1.0), C(tThought - 2, 1130, 400, 1.22), C(tBack - 2, 760, 440, 1.14), C(tRead, 520, 560, 1.25), C(tKh - 6, 1000, 470, 1.0)],
        world: (
          <g>
            <g opacity={dim}>
            <Write id="cs" x={1590} y={470} text="الخواطر" size={72} p={wp(frame, tCause, end("الخواطر", 0.08))} c={z.ink} z={z} />
            <Stroke d="M1720 560 L1380 560" p={seg1} c={z.ink} w={9} />
            {/* «ستنقطع تمامًا»: خط مثالي بلا خواطر، يُشطب */}
            <g opacity={ghost * (1 - 0.6 * prog(frame, tThought, tThought + 20))}>
              <line x1={1380} y1={560} x2={360} y2={560} stroke={z.faint} strokeWidth={6} strokeDasharray="18 16" />
            </g>
            <rect x={660} y={570} width={400} height={100} rx={16} fill="none" stroke={z.ink} strokeWidth={5} strokeDasharray="14 12" opacity={prog(frame, tFull - 4, tFull + 8) * (1 - 0.5 * prog(frame, tThought, tThought + 20))} />
            <Write id="kf" x={860} y={640} text="ستنقطع تماما" size={64} p={wp(frame, tFull, end("تماما", 0.16))} c={z.ink} z={z} opacity={1 - 0.5 * prog(frame, tThought, tThought + 20)} />
            <Cross x1={1010} x2={710} y={624} p={prog(frame, end("تماما", 0.16), end("تماما", 0.16) + 14)} z={z} />
            {/* الخواطر: يخرج الخط عن مساره */}
            <Stroke d="M1380 560 C1300 560 1290 430 1210 410 C1130 390 1170 300 1090 320 C1020 340 1050 262 1000 300" p={seg2} c={z.ink} w={9} />
            {/* الخواطر لا تختفي: عند «نرجع» تتنحى قليلًا إلى الأعلى وتبهت، وتبقى حاضرة */}
            {([
              [1290, 310, 96],
              [1100, 215, 80],
              [925, 205, 66],
            ] as const).map(([x, y, r], k) => (
              <g key={k} transform={`translate(${x + 70 * prog(frame, tBack, tBack + 24, outCubic)} ${y - 40 * prog(frame, tBack, tBack + 24, outCubic)}) scale(${cloud(k) * (1 - 0.2 * prog(frame, tBack, tBack + 24))})`} opacity={cloud(k) * (1 - 0.45 * prog(frame, tBack, tBack + 20))}>
                <path d={`M${-r} 0 a${r * 0.6} ${r * 0.6} 0 0 1 ${r * 0.7} ${-r * 0.6} a${r * 0.7} ${r * 0.7} 0 0 1 ${r * 1.1} ${r * 0.1} a${r * 0.5} ${r * 0.5} 0 0 1 ${r * 0.2} ${r * 0.9} Z`} fill={z.faint} fillOpacity={0.25} stroke={z.ink} strokeWidth={6} strokeLinejoin="round" />
              </g>
            ))}
            {/* «الذهن» شارد: الخط يبهت ويتقطع */}
            <path d="M1000 300 C960 270 900 250 830 250" fill="none" stroke={z.ink} strokeWidth={5} strokeDasharray="10 14" opacity={0.45 * Math.min(1, seg3 * 3)} pathLength={1} />
            {/* «فنعود»: يعود الخط إلى المحور حتى الكتاب، و«العودة» نفسها تُبرز */}
            <Stroke d="M830 250 C700 260 700 560 560 560 L400 560" p={seg4} c={z.ink} w={10} />
            <Stroke d="M830 250 C700 260 700 560 560 560 L400 560" p={truth} c={z.hl} w={34} opacity={0.8} />
            <OpenBook x={310} y={560} s={1.1} p={prog(frame, tRead - 4, tRead + 14)} z={z} />
            {[0, 1, 2].map((k) => (
              <Stroke key={k} d={`M${215 - k * 18} ${520} q${-16} 40 0 80`} p={prog(frame, tSay + k * 3, tSay + k * 3 + 10)} c={z.ink} w={6} opacity={0.8} />
            ))}
            <Write id="mj" x={600} y={720} text="جزء من مجاهدتنا" size={64} p={wp(frame, at("جزء", 0.52), end("مجاهدتنا", 0.57))} c={z.ink} font="head" z={z} />
            </g>
            {/* «فالخشوع يزيد وينقص»: مؤشر يعلو وينخفض على خط أساس متقطع */}
            <Write id="kh" x={960} y={210} text="الخشوع" size={84} p={wp(frame, tKh, end("الخشوع", 0.71))} c={z.ink} font="head" z={z} />
            <line x1={1640} y1={560} x2={420} y2={560} stroke={z.faint} strokeWidth={5} strokeDasharray="14 14" opacity={prog(frame, tKh, tKh + 12)} />
            {/* مقدار الخشوع: مساحة فسفورية تحت المؤشر تتسع وتضيق معه */}
            {segP.map((p, i) => {
              if (p <= 0) return null;
              const [x0, y0] = W[i]!; const x1 = lerp(x0, W[i + 1]![0], p), y1 = lerp(y0, W[i + 1]![1], p);
              return <path key={i} d={`M${x0} 760 L${x0} ${y0} L${x1} ${y1} L${x1} 760 Z`} fill={z.hl} opacity={0.55} />;
            })}
            {segP.map((p, i) => <Stroke key={i} d={seg(i)} p={p} c={z.ink} w={12} />)}
            <Write id="yz" x={1420} y={390} text="يزيد" size={72} p={wp(frame, tUp, end("يزيد", 0.73))} c={z.ink} z={z} />
            <Write id="yn" x={1220} y={740} text="وينقص" size={72} p={wp(frame, tDown, end("وينقص", 0.76))} c={z.ink} z={z} />
            {/* «ما نسعى إليه»: ساعٍ يصعد مع المؤشر */}
            <g transform={`rotate(${tipK === 3 ? 8 : -14} ${sx} ${sy})`}>
              <InkPerson x={sx} y={sy - 4} s={0.42} pose="walk" p={prog(frame, tJ - 4, tJ + 10)} z={z} dir={-1} />
            </g>
            <Write id="jh" x={1160} y={480} text="نسعى" size={60} p={wp(frame, tJ, end("نسعى", 0.75))} c={z.ink} font="head" z={z} />
            {/* «ليس ادعاء الكمال»: أفق متقطع يقترب منه المؤشر، والادعاء يُشطب */}
            <rect x={300} y={196} width={340} height={110} rx={16} fill="none" stroke={z.ink} strokeWidth={5} strokeDasharray="14 12" opacity={prog(frame, tYa - 4, tYa + 8)} />
            <Write id="ak" x={470} y={272} text="ادعاء الكمال" size={58} p={wp(frame, tYa, end("الكمال", 0.86))} c={z.ink} font="head" z={z} />
            <Cross x1={640} x2={300} y={252} p={prog(frame, end("الكمال", 0.86), end("الكمال", 0.86) + 14)} z={z} />
            {/* «بل الاستمرار في طلبه»: المؤشر يمضي، والكلمة تحته تُبرز */}
            <rect x={560} y={792} width={420} height={80} rx={10} fill={z.hl} opacity={0.75 * prog(frame, tAsp - 2, tAsp + 12)} />
            <Write id="ny" x={770} y={852} text="الاستمرار في طلبه" size={60} p={wp(frame, tAsp, end("طلبه", 0.98))} c={z.ink} font="head" z={z} />
          </g>
        ),
      };
    },
  },

  // S12 — «سر الصلاة الإقبال» بلفظ عنوان الكتاب، بلا نقطتين (الأمر 008)
  iqbal: {
    nameAr: "الإقبال: البدن إلى القبلة والقلب معه",
    render: ({ frame, z, at, end, reg }) => {
      // السكريبت المعتمد (١١ نوفمبر): «وهنا نصل إلى كلمتين تلخصان المعنى: سر الصلاة الإقبال. نتجه بأبداننا نحو القبلة، ولكن السؤال
      // هو: إلى أين يتجه قلبنا؟ الإقبال لا يعني أن هموم الدنيا تختفي، بل أن نعطي صلاتنا من الانتباه ما نستطيع.»
      const tPhrase = at("كلمتين", 0.08);
      const tBook = at("تلخصان", 0.12);
      const tMana = at("المعنى", 0.16);
      const tSir = at("سر", 0.2);
      const tIq = at("الإقبال", 0.26);
      const tFace = at("نتجه", 0.3);
      const tBody = at("بأبداننا", 0.33);
      const tQibla = at("القبلة", 0.38);
      const tTry = at("يتجه", 0.48);
      const tHearts = at("قلبنا", 0.52);
      const tHum = at("هموم", 0.62);
      const tDunya = at("الدنيا", 0.66);
      const tBal = at("بل", 0.74);
      const tHaq = at("الانتباه", 0.88);
      const book = prog(frame, tPhrase - 2, tPhrase + 16) * (1 - prog(frame, tFace - 10, tFace + 8));
      const flip = prog(frame, tBook - 2, tBook + 16, (t) => t);
      const cardUp = prog(frame, tSir - 8, tSir + 10, outCubic);
      const w1 = measure("سر الصلاة", 74, fam("head"));
      const w2 = measure("الإقبال", 74, fam("head"));
      const tot = w1 + 24 + w2;
      const right = 960 + tot / 2;
      const iqX = right - w1 - 24 - w2;
      const aside = prog(frame, tBal - 2, tBal + 22);
      const iconAt = [tHum, tHum + 6, tDunya];
      const icon = (k: number) => prog(frame, iconAt[k]! - 4, iconAt[k]! + 12);
      const heartArrow = prog(frame, tTry, end("قلبنا", 0.56), (t) => t);
      // دائرة «الانتباه»: حول المصلي كله، وتبقى فوق خط الترجمة (أسفلها 860 < 880)
      reg([1130, 430, 1510, 860], tHaq);
      return {
        focus: [[tPhrase, 960, 560], [tBook, 960, 560], [tMana, 960, 520], [tSir, 1100, 232], [tIq, 850, 232], [tFace, 1320, 700], [tBody, 880, 700], [tQibla, 420, 640], [at("السؤال", 0.42), 1420, 560], [tTry, 1320, 650], [tHearts, 900, 560], [tHum, 1600, 400], [tDunya, 1300, 560], [tBal, 1250, 560], [tHaq, 1150, 560]],
        cam: [C(0, 960, 470, 1.15), C(tSir - 6, 960, 400, 1.05), C(tFace - 6, 980, 560, 1.0), C(tTry - 4, 1000, 590, 1.06), C(tDunya - 6, 1060, 560, 1.0), C(tHaq - 6, 1060, 580, 1.0)],
        world: (
          <g>
            <g opacity={book}>
              <OpenBook x={960} y={560} s={1.7} p={book} z={z} flip={flip} />
              {/* «تلخصان المعنى»: شريط علامة فسفوري ينزل بين الصفحات */}
              <path d={`M948 474 L974 474 L974 ${474 + 170 * prog(frame, tMana - 2, tMana + 12)} L961 ${462 + 170 * prog(frame, tMana - 2, tMana + 12)} L948 ${474 + 170 * prog(frame, tMana - 2, tMana + 12)} Z`} fill={z.hl} stroke={z.ink} strokeWidth={4} opacity={prog(frame, tMana - 2, tMana + 4)} />
            </g>
            <g transform={`translate(0 ${lerp(300, 0, cardUp)})`} opacity={cardUp}>
              <Card x={960} y={232} w={tot + 120} h={160} z={z} rot={-1.5}>
                <Mark x={iqX - 960 - 10} y={-14} w={w2 + 20} h={46} p={prog(frame, end("الإقبال", 0.3) - 4, end("الإقبال", 0.3) + 10)} z={z} />
                <Write id="sr" x={right - 960} y={24} text="سر الصلاة" size={74} p={wp(frame, tSir, at("الإقبال", 0.26))} c={z.ink} font="head" anchor="start" z={z} />
                <Write id="iq" x={iqX + w2 - 960} y={24} text="الإقبال" size={74} p={wp(frame, tIq, end("الإقبال", 0.3))} c={z.ink} font="head" anchor="start" z={z} />
              </Card>
            </g>
            {/* القبلة: الكعبة نفسها (لا بوصلة) — «نستقبل القبلة بأبداننا» */}
            <Kaaba x={420} y={690} s={0.72} p={prog(frame, tQibla - 4, tQibla + 16)} z={z} />
            <Write id="qb" x={420} y={760} text="القبلة" size={68} p={wp(frame, tQibla, end("القبلة", 0.38))} c={z.ink} z={z} />
            <InkPerson x={1320} y={860} s={1.15} pose="stand" p={prog(frame, tFace - 2, tFace + 20)} z={z} dir={-1} />
            <Arrow x1={1210} y1={720} x2={530} y2={650} p={prog(frame, tQibla - 2, tQibla + 16)} c={z.ink} w={9} bend={-10} />
            <Write id="bd" x={880} y={760} text="بأبداننا" size={66} p={wp(frame, tBody, end("بأبداننا", 0.42))} c={z.ink} z={z} />
            {/* «ولكن السؤال هو: إلى أين»: علامة سؤال فوق المصلي حتى يُجاب بالقلب */}
            <g opacity={prog(frame, at("السؤال", 0.42) - 2, at("السؤال", 0.42) + 8) * (1 - prog(frame, tHearts, tHearts + 10))}>
              <Write id="qq" x={1450} y={600} text="؟" size={130} p={wp(frame, at("السؤال", 0.42), at("السؤال", 0.42) + 12)} c={z.ink} font="head" z={z} />
            </g>
            {/* القلب: يُضاء ويتجه السهم الفسفوري في الجهة نفسها */}
            <path d={heartPath(1320, 650, 26)} fill={z.hl} stroke={z.ink} strokeWidth={5} opacity={prog(frame, tTry - 2, tTry + 10)} />
            <Stroke d="M1280 640 Q920 560 540 600" p={heartArrow} c={z.hl} w={28} opacity={0.95} />
            <Write id="hb" x={900} y={540} text="قلبنا" size={66} p={wp(frame, tHearts, end("قلبنا", 0.56))} c={z.ink} z={z} />
            {/* «هموم الدنيا» لا «تختفي»: تبقى، وتتنحى قليلًا مع «بل» */}
            {([["house", 1600, 330], ["bag", 1610, 560], ["cart", 1580, 760]] as const).map(([id, x, y], k) => (
              <Icon key={id} id={id} x={x + 40 * aside} y={y} s={1.1 - 0.2 * aside} p={icon(k)} c={z.ink} opacity={1 - 0.35 * aside} />
            ))}
            <ellipse cx={1320} cy={645} rx={190} ry={215} fill="none" stroke={z.hl} strokeWidth={22} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - prog(frame, tHaq - 2, tHaq + 20)} opacity={0.95} />
            <Write id="hq" x={1320} y={395} text="من الانتباه ما نستطيع" size={60} p={wp(frame, at("من", 0.86), end("نستطيع", 0.98))} c={z.ink} z={z} />
          </g>
        ),
      };
    },
  },

  // S19 — الله أكبر: سكون ووقار
  takbir: {
    nameAr: "التكبير: ندخل الصلاة، ثم سكون عند الذكر",
    render: ({ frame, z, at, end }) => {
      const tEnter = at("ندخل", 0.03);
      const tSalah = at("الصلاة", 0.08);
      const tTak = at("بالتكبير", 0.12);
      const tA1 = at("الله", 0.16, 1);
      const tMany = at("مرات", 0.3);
      const tRecall = at("نستحضر", 0.42);
      const tA2 = at("الله", 0.52, 2);
      const tEndA2 = end("شيء", 0.62);
      const tThikr = at("الذكر", 0.66);
      const tIbada = at("عبادة", 0.74);
      const tTamrin = at("تمرين", 0.84);
      const tFahasb = at("فحسب", 0.94);
      const mat = prog(frame, tEnter - 2, tEnter + 16);
      // الشخص والسجادة يتواريان بهدوء قبل الذكر، فيبقى الذكر وحده
      const fadeFig = 1 - prog(frame, tA1 - 22, tA1 - 8);
      const raised = prog(frame, tTak - 2, tTak + 8);
      const word = prog(frame, tA1 - 8, tA1 + 2);
      const ticks = (k: number) => prog(frame, tMany + k * 3, tMany + k * 3 + 6);
      const clear = 1 - prog(frame, tThikr - 2, tThikr + 18);
      return {
        focus: [[tEnter, 960, 820], [tSalah, 960, 700], [tTak, 960, 600], [tMany, 960, 700], [at("كثيرة", 0.33), 1000, 810], [tRecall, 960, 880], [tThikr, 960, 700], [tIbada, 1260, 760], [tTamrin, 640, 760], [tFahasb, 640, 760]],
        still: [[tA1 - 24, end("أكبر", 0.2, 1) + 14], [tA2 - 24, tEndA2 + 14]],
        cam: [C(0, 960, 600, 1.1), C(tTak - 4, 960, 560, 1.02), C(tA1 - 30, 960, 540, 1.0), C(tMany - 2, 960, 660, 1.08), C(tA2 - 34, 960, 540, 1.0), C(tEndA2 + 14, 960, 620, 1.06)],
        world: (
          <g>
            <g opacity={fadeFig}>
              <Stroke d="M760 800 L1160 800 L1110 860 L810 860 Z" p={mat} c={z.ink} w={6} fill={z.hl} fillP={0.5 * mat} />
              <g opacity={1 - raised}>
                <InkPerson x={960} y={820} s={1.1} pose="stand" p={prog(frame, tSalah - 4, tSalah + 16)} z={z} dir={-1} />
              </g>
              <g opacity={raised}>
                <InkPerson x={960} y={820} s={1.1} pose="raise" p={1} z={z} dir={-1} />
              </g>
            </g>
            {/* الذكر: يثبت وحده بلا قلم ولا تظليل ولا حركة */}
            <text x={960} y={420} textAnchor="middle" direction="rtl" opacity={word} style={{ fontFamily: fam("head"), fontSize: 210, fill: z.ink }}>
              اللهُ أكبر
            </text>
            <g opacity={clear}>
              {Array.from({ length: 9 }, (_, k) => (
                <line key={k} x1={1160 - k * 50} x2={1160 - k * 50} y1={700} y2={700 - 56 * ticks(k)} stroke={z.ink} strokeWidth={9} strokeLinecap="round" opacity={ticks(k)} />
              ))}
              <Write id="mk" x={960} y={780} text="مرات كثيرة" size={66} p={wp(frame, tMany, end("كثيرة", 0.36))} c={z.ink} z={z} />
              <Write id="ns" x={960} y={862} text="نستحضر ما نقوله" size={62} p={wp(frame, tRecall, end("نقوله", 0.48))} c={z.ink} font="body" weight={500} z={z} />
            </g>
            <Write id="ib" x={1260} y={760} text="عبادة مشروعة" size={66} p={wp(frame, tIbada, end("مشروعة", 0.8))} c={z.ink} font="body" weight={600} z={z} />
            <Write id="tm" x={640} y={760} text="تمرين على الهدوء" size={72} p={wp(frame, tTamrin, end("الهدوء", 0.9))} c={z.ink} z={z} />
            <Cross x1={830} x2={450} y={744} p={prog(frame, tFahasb - 2, tFahasb + 12)} z={z} />
          </g>
        ),
      };
    },
  },

  // S26 — خطوة واحدة قبل الصلاة القادمة
  "one-step": {
    nameAr: "خطوة واحدة: نتوقف قبل الصلاة القادمة ونستحضر التكبير",
    render: ({ frame, z, at, end }) => {
      const t0 = at("ولنجعل", 0.02);
      const tStep = at("خطوة", 0.1, 1);
      const tBefore = at("قبل", 0.22);
      const tNext = at("صلاتنا", 0.26);
      const tStop = at("نتوقف", 0.36);
      const tRecall = at("ونستحضر", 0.45);
      const tSmall = at("صغيرة", 0.74, 1);
      const tDir = at("تتجه", 0.84);
      const tGoal = at("المقصود", 0.94);
      const line = prog(frame, t0 - 4, t0 + 22);
      const PX = 900; // الصلاة القادمة
      const note = prog(frame, tRecall - 6, tRecall + 10, outCubic);
      return {
        focus: [[tStep, 1380, 520], [tBefore, 1020, 470], [tNext, 900, 600], [tStop, 1030, 380], [tRecall, 520, 300], [at("سندخل", 0.6), 780, 470], [tSmall, 1200, 520], [tDir, 980, 530], [tGoal, 900, 560]],
        cam: [C(0, 960, 540, 1.05), C(tStep - 6, 1260, 520, 1.3), C(tBefore - 4, 1040, 520, 1.18), C(tRecall - 6, 820, 440, 1.12), C(tSmall - 6, 1000, 520, 1.12), C(tGoal - 8, 960, 540, 1.05)],
        world: (
          <g>
            <g transform="translate(960 560)">
              <DayStrip z={z} line={line} sun={1} ticksAll />
            </g>
            {/* «خطوة واحدة»: سهم قصير فسفوري على خط اليوم، ويتسع قليلًا عند «صغيرة» */}
            <g transform={`translate(1400 560) scale(${1 + 0.18 * Math.sin(Math.PI * prog(frame, tSmall - 2, tSmall + 16))})`}>
              <Stroke d="M0 0 L-110 0" p={prog(frame, tStep - 2, tStep + 10)} c={z.hl} w={30} />
              <Arrow x1={0} y1={0} x2={-120} y2={0} p={prog(frame, tStep - 2, tStep + 12)} c={z.ink} w={8} />
            </g>
            <Stroke d={`M1120 470 Q1020 430 ${PX + 30} 470`} p={prog(frame, tBefore - 2, tBefore + 12)} c={z.ink} w={6} />
            <circle cx={PX + 4} cy={560} r={58} fill="none" stroke={z.hl} strokeWidth={14} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - prog(frame, tNext - 2, tNext + 14)} />
            <circle cx={PX + 4} cy={560} r={44 * prog(frame, tGoal - 2, tGoal + 12)} fill={z.hl} opacity={0.7} />
            <Write id="nx" x={PX} y={700} text="صلاتنا القادمة" size={66} p={wp(frame, tNext, end("القادمة", 0.3))} c={z.ink} z={z} />
            <Pause x={1030} y={400} p={prog(frame, tStop - 2, tStop + 14)} z={z} />
            <Write id="st" x={1030} y={310} text="نتوقف قليلا" size={64} p={wp(frame, tStop, end("قليلا", 0.4))} c={z.ink} z={z} />
            {/* الورقة اللاصقة: المهمة الواحدة، ومربع فارغ ينتظر التنفيذ */}
            <g transform={`translate(${520} ${300 - 120 * (1 - note)}) rotate(${-3 + 4 * (1 - note)})`} opacity={note}>
              <rect x={-250 + 8} y={-120 + 10} width={500} height={240} fill={z.ink} opacity={0.12} />
              <rect x={-250} y={-120} width={500} height={240} fill={z.hl} />
              <rect x={-60} y={-136} width={120} height={32} fill={z.paper} opacity={0.7} transform="rotate(-4)" />
              <Write id="nt" x={0} y={-10} text="نستحضر معنى التكبير" size={64} p={wp(frame, tRecall, end("التكبير", 0.55))} c={z.ink} z={z} />
              <rect x={-24} y={36} width={48} height={48} rx={6} fill="none" stroke={z.ink} strokeWidth={6} opacity={prog(frame, end("التكبير", 0.55), end("التكبير", 0.55) + 10)} />
            </g>
            {/* نستحضره قبل أن «ندخل» بها الصلاة: صلة من الورقة إلى الصلاة القادمة */}
            <path d={`M640 420 Q800 470 ${PX - 30} 520`} fill="none" stroke={z.ink} strokeWidth={6} strokeDasharray="14 12" strokeLinecap="round" opacity={prog(frame, at("سندخل", 0.6) - 2, at("سندخل", 0.6) + 10)} />
            <Arrow x1={790} y1={470} x2={PX - 34} y2={518} p={prog(frame, at("سندخل", 0.6), at("سندخل", 0.6) + 14)} c={z.ink} w={6} bend={-6} />
            <Arrow x1={1270} y1={540} x2={PX + 70} y2={540} p={prog(frame, tDir - 2, tDir + 16)} c={z.ink} w={8} bend={60} />
          </g>
        ),
      };
    },
  },
  ...INK_SHOTS_2,
  ...KIT_SHOTS,
};
