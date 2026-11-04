import React from "react";
import type { CamKey } from "../illus/shots/kit";
import { INK_SHOTS_2 } from "./shots2";
import { Arrow, Card, Cross, Icon, InkPerson, Mark, Stroke, Sun, Write, heartPath, lerp, measure, fam, outCubic, prog, type Z } from "./inkKit";

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
            <circle cx={x} cy={-46} r={10 * on} fill={gray > 0 ? z.faint : z.hl} stroke={col} strokeWidth={4} />
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

export const INK_SHOTS: Record<string, InkShotDef> = {
  // S01 — العادة وحضور القلب
  "habit-heart": {
    nameAr: "الصلاة اليومية: تكرار الفعل وحضور القلب",
    render: ({ frame, z, at, end }) => {
      const t0 = at("نصلي", 0.02);
      const tW = [at("نقف", 0.2), at("نقرأ", 0.26), at("نركع", 0.32), at("نسجد", 0.38)];
      const tYears = at("السنين", 0.46);
      const tFam = at("مألوفة", 0.58);
      const tQ = at("سؤالا", 0.64);
      const tHal = at("هل", 0.76);
      const tHeart = at("قلبنا", 0.82);
      const tBody2 = at("يحضر", 0.88, 2);
      const tBody = at("جسدنا", 0.95);
      const line = prog(frame, t0 - 4, t0 + 20);
      const sun = prog(frame, t0 + 4, tW[0]! + 6, (t) => t);
      const post = tW.map((t) => prog(frame, t - 3, t + 16));
      const gridIn = (k: number) => prog(frame, tYears + k * 4, tYears + k * 4 + 12);
      const gray = prog(frame, tFam - 4, tFam + 16);
      const gridOut = 1 - prog(frame, tQ - 10, tQ + 10);
      const qBig = wp(frame, tQ, tQ + 14);
      const qMove = prog(frame, tHal, tHal + 18);
      const cells: [number, number][] = [];
      for (const r of [-1, 0, 1, 2]) for (const c of [-1, 0, 1]) if (!(r === 0 && c === 0)) cells.push([c, r]);
      return {
        camLen: 28,
        focus: [[at("يوم", 0.06), 960, 330], ...tW.map((t, i): [number, number, number] => [t, 960 + [420, 140, -140, -420][i]!, 620]), [at("نحفظ", 0.5), 960, 600], [tQ, 960, 600], [at("لأنفسنا", 0.72), 1180, 700], [tHal, 965, 470], [tHeart, 760, 600], [tBody2, 1180, 700], [tBody, 1400, 700]],
        cam: [C(0, 960, 420, 1.12), C(tW[0]! - 8, 960, 560, 1.0), C(tYears - 2, 960, 640, 0.45), C(tQ - 6, 960, 540, 1.0), C(tHeart - 8, 960, 600, 1.12)],
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
            {/* «لأنفسنا»: نحن نسأل؛ الجسد يحضر متقطعًا ثم يكتمل عند «جسدنا»، والقلب يبقى سؤالًا */}
            <InkPerson x={1180} y={860} s={1.3} pose="stand" p={prog(frame, at("لأنفسنا", 0.72) - 2, at("لأنفسنا", 0.72) + 16)} z={z} dir={-1} dashed opacity={1 - prog(frame, tBody, tBody + 10)} />
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
      const tTrip = at("رحلة", 0.45);
      const tA = at("التهيؤ", 0.6);
      const tBst = at("نقوله", 0.7);
      const tStep = at("بالخطوة", 0.84);
      const tHeart = at("تهيئة", 0.92);
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
        focus: [[tT, 1330, 410], [tSub, 1330, 500], [tDr, 1250, 850], [tTrip, 950, 560], [at("معاني", 0.52), 860, 560], [tA, 760, 570], [tBst, 350, 430], [tStep, 760, 480], [tHeart, 760, 700]],
        cam: [C(0, 1180, 500, 1.02), C(tDr - 10, 1240, 600, 1.08), C(tTrip - 2, 900, 520, 1.0), C(tBst - 4, 760, 520, 1.05), C(tHeart - 8, 820, 560, 1.15)],
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
              <Write id="bs" x={-12} y={34} text="وكان للصلاة طعم آخر" size={50} p={wp(frame, tSub, end("آخر", 0.22))} c={z.hl} z={z} />
              <rect x={-12 - t1w / 2} y={190} width={t1w} height={4} fill={z.paper} opacity={0.5 * bIn} />
            </g>
            {/* بطاقة المؤلف تنزلق من تحت الكتاب */}
            <g transform={`translate(${1250 - 60 * (1 - slip)} ${750 + 120 * (1 - slip)})`} opacity={slip}>
              <Card x={0} y={0} w={560} h={104} z={z} rot={-2}>
                <Write id="au" x={0} y={16} text="الدكتور خالد أبو شادي" size={50} p={wp(frame, tDr, end("شادي", 0.4))} c={z.ink} font="body" weight={600} z={z} />
              </Card>
            </g>
            {/* الرحلة: من الكتاب إلى محطتين */}
            <Stroke d="M1080 520 C980 560 880 600 800 580" p={path1} c={z.ink} w={7} />
            <Stroke d="M720 560 C640 520 560 470 460 450" p={path2} c={z.ink} w={7} />
            <g opacity={prog(frame, tA - 4, tA + 8)}>
              <circle cx={760} cy={570} r={46} fill={z.paper} stroke={z.ink} strokeWidth={7} />
              <circle cx={760} cy={570} r={40 * fill} fill={z.hl} />
              {fill > 0 ? <path d={heartPath(760, 572, 18)} fill={z.ink} opacity={prog(frame, end("القلب", 0.97) - 6, end("القلب", 0.97) + 6)} /> : null}
            </g>
            <Write id="sa" x={760} y={690} text="التهيؤ لها" size={66} p={wp(frame, tA, end("لها", 0.64))} c={z.ink} z={z} opacity={1 - fill} />
            <g opacity={prog(frame, tBst - 4, tBst + 8)}>
              <circle cx={420} cy={440} r={46} fill={z.paper} stroke={z.ink} strokeWidth={7} />
            </g>
            <Write id="sb" x={420} y={570} text="ما نقوله ونفعله" size={66} p={wp(frame, tBst - 4, end("ونفعله", 0.74))} c={z.ink} z={z} />
            {/* الخطوة الأولى: علم يُغرز في المحطة الأولى */}
            <g transform={`translate(${760} ${570 - 46 - 40 * (1 - flag)})`} opacity={flag}>
              <line x1={0} y1={0} x2={0} y2={-110} stroke={z.ink} strokeWidth={7} strokeLinecap="round" />
              <path d="M0 -110 L-70 -88 L0 -66 Z" fill={z.hl} stroke={z.ink} strokeWidth={5} strokeLinejoin="round" />
            </g>
            <Write id="tq" x={760} y={760} text="تهيئة القلب" size={92} p={wp(frame, tHeart, end("القلب", 0.98))} c={z.ink} font="head" z={z} />
          </g>
        ),
      };
    },
  },

  // S07 — خط الانتباه: يخرج ثم يرجع
  "attention-line": {
    nameAr: "خط الانتباه: تشرد الخواطر ثم نرجع إلى ما نقرؤه",
    render: ({ frame, z, at, end }) => {
      const tCause = at("بالأسباب", 0.04);
      const tFull = at("خشوعا", 0.18);
      const tSalah = at("صلاة", 0.26);
      const tThought = at("ترد", 0.33);
      const tWeak = at("يضعف", 0.43);
      const tBack = at("نرجع", 0.52);
      const tRead = at("نقرأه", 0.6);
      const tSay = at("ونقوله", 0.64);
      const tChase = at("مطاردة", 0.74);
      const tIdeal = at("مثالي", 0.8);
      const tBal = at("بل", 0.84);
      const tTruth = at("الصدق", 0.88);
      const seg1 = prog(frame, tCause, tFull, (t) => t);
      const ghost = prog(frame, tFull - 4, tFull + 12);
      const seg2 = prog(frame, tThought - 2, tWeak, (t) => t);
      const seg3 = prog(frame, tWeak, tBack, (t) => t);
      const seg4 = prog(frame, tBack - 2, tRead + 8, (t) => t);
      const chase = prog(frame, tChase - 2, tIdeal + 14, (t) => t);
      const truth = prog(frame, tTruth - 2, tTruth + 22);
      const cloud = (k: number) => prog(frame, tThought + k * 6, tThought + k * 6 + 12, outCubic);
      const starX = lerp(1000, 560, chase);
      return {
        camLen: 26,
        focus: [[tCause, 1590, 500], [tFull, 860, 600], [tSalah, 860, 620], [tThought, 1200, 350], [at("الخواطر", 0.36), 1050, 250], [tWeak, 900, 260], [tBack, 700, 400], [tRead, 250, 560], [tSay, 150, 560], [tChase, 900, 170], [tIdeal, 600, 170], [tBal, 870, 170], [tTruth, 600, 640]],
        cam: [C(0, 1440, 520, 1.3), C(tFull - 6, 1000, 560, 1.0), C(tThought - 2, 1130, 400, 1.22), C(tBack - 2, 760, 440, 1.14), C(tRead, 520, 560, 1.25), C(tChase - 6, 900, 400, 1.0), C(tTruth - 6, 880, 520, 1.0)],
        world: (
          <g>
            <Write id="cs" x={1590} y={470} text="الأسباب" size={72} p={wp(frame, tCause, tCause + 14)} c={z.ink} z={z} />
            <Stroke d="M1720 560 L1380 560" p={seg1} c={z.ink} w={9} />
            {/* الخشوع الكامل المتصوَّر: خط مثالي متقطع، يُشطب */}
            <g opacity={ghost * (1 - 0.6 * prog(frame, tThought, tThought + 20))}>
              <line x1={1380} y1={560} x2={360} y2={560} stroke={z.faint} strokeWidth={6} strokeDasharray="18 16" />
            </g>
            <Write id="kf" x={860} y={640} text="خشوع كامل" size={68} p={wp(frame, tFull, end("كاملا", 0.22))} c={z.ink} z={z} opacity={1 - 0.5 * prog(frame, tThought, tThought + 20)} />
            <Cross x1={1010} x2={710} y={624} p={prog(frame, tSalah - 2, tSalah + 12)} z={z} />
            {/* الخواطر: يخرج الخط عن مساره */}
            <Stroke d="M1380 560 C1300 560 1290 430 1210 410 C1130 390 1170 300 1090 320 C1020 340 1050 262 1000 300" p={seg2} c={z.ink} w={9} />
            {([
              [1270, 300, 82],
              [1090, 210, 68],
              [930, 200, 56],
            ] as const).map(([x, y, r], k) => (
              <g key={k} transform={`translate(${x} ${y}) scale(${cloud(k)})`} opacity={cloud(k) * (1 - 0.7 * prog(frame, tBack, tBack + 20))}>
                <path d={`M${-r} 0 a${r * 0.6} ${r * 0.6} 0 0 1 ${r * 0.7} ${-r * 0.6} a${r * 0.7} ${r * 0.7} 0 0 1 ${r * 1.1} ${r * 0.1} a${r * 0.5} ${r * 0.5} 0 0 1 ${r * 0.2} ${r * 0.9} Z`} fill={z.faint} fillOpacity={0.25} stroke={z.ink} strokeWidth={6} strokeLinejoin="round" />
              </g>
            ))}
            {/* يضعف الانتباه: الخط يبهت ويتقطع */}
            <path d="M1000 300 C960 270 900 250 830 250" fill="none" stroke={z.ink} strokeWidth={5} strokeDasharray="10 14" opacity={0.45 * Math.min(1, seg3 * 3)} pathLength={1} />
            {/* نرجع: يعود الخط إلى المحور حتى الكتاب */}
            <Stroke d="M830 250 C700 260 700 560 560 560 L400 560" p={seg4} c={z.ink} w={10} />
            <Stroke d="M830 250 C700 260 700 560 560 560 L400 560" p={truth} c={z.hl} w={34} opacity={0.8} />
            <OpenBook x={310} y={560} s={1.1} p={prog(frame, tRead - 4, tRead + 14)} z={z} />
            {[0, 1, 2].map((k) => (
              <Stroke key={k} d={`M${215 - k * 18} ${520} q${-16} 40 0 80`} p={prog(frame, tSay + k * 3, tSay + k * 3 + 10)} c={z.ink} w={6} opacity={0.8} />
            ))}
            {/* مطاردة شعور مثالي: نجمة تهرب وسهم يلاحقها، ثم يُشطب */}
            <g opacity={prog(frame, tChase - 4, tChase + 6)}>
              <path d="M0 -30 Q5 -5 30 0 Q5 5 0 30 Q-5 5 -30 0 Q-5 -5 0 -30 Z" transform={`translate(${starX} 200) scale(1.8)`} fill={z.hl} stroke={z.ink} strokeWidth={5} />
              <line x1={1240} y1={200} x2={starX + 70} y2={200} stroke={z.ink} strokeWidth={6} strokeDasharray="16 14" strokeLinecap="round" />
            </g>
            <Write id="ms" x={1000} y={150} text="شعور مثالي" size={62} p={wp(frame, at("شعور", 0.78), end("مثالي", 0.8))} c={z.ink} z={z} />
            <Cross x1={1250} x2={500} y={206} p={prog(frame, tBal - 4, tBal + 12)} z={z} />
            {/* «الصدق»: بطاقة فسفورية تثبت على الخط الراجع */}
            <g transform={`translate(560 ${lerp(760, 676, prog(frame, tTruth - 4, tTruth + 10, outCubic))}) rotate(-2)`} opacity={prog(frame, tTruth - 4, tTruth + 6)}>
              <rect x={-150} y={-60} width={300} height={110} rx={12} fill={z.ink} opacity={0.12} transform="translate(8 10)" />
              <rect x={-150} y={-60} width={300} height={110} rx={12} fill={z.hl} stroke={z.ink} strokeWidth={5} />
            </g>
            <Write id="sd" x={560} y={700} text="الصدق" size={96} p={wp(frame, tTruth, end("الصدق", 0.9))} c={z.ink} font="head" z={z} />
          </g>
        ),
      };
    },
  },

  // S12 — سر الصلاة: الإقبال (البدن والقلب إلى جهة واحدة)
  iqbal: {
    nameAr: "الإقبال: البدن إلى القبلة والقلب معه",
    render: ({ frame, z, at, end }) => {
      const tPhrase = at("عبارة", 0.04);
      const tBook = at("الكتاب", 0.16);
      const tSir = at("سر", 0.2);
      const tIq = at("الإقبال", 0.26);
      const tFace = at("نستقبل", 0.32);
      const tQibla = at("القبلة", 0.36);
      const tBody = at("بأبداننا", 0.4);
      const tTry = at("ونجتهد", 0.46);
      const tHearts = at("قلوبنا", 0.52);
      const tDunya = at("الدنيا", 0.68);
      const tBal = at("بل", 0.8);
      const tHaq = at("حقها", 0.9);
      const book = prog(frame, tPhrase - 2, tPhrase + 16) * (1 - prog(frame, tFace - 10, tFace + 8));
      const flip = prog(frame, tBook - 2, tBook + 16, (t) => t);
      const cardUp = prog(frame, tSir - 8, tSir + 10, outCubic);
      const w1 = measure("سر الصلاة:", 74, fam("head"));
      const w2 = measure("الإقبال", 74, fam("head"));
      const tot = w1 + 24 + w2;
      const right = 960 + tot / 2;
      const iqX = right - w1 - 24 - w2;
      const aside = prog(frame, tBal - 2, tBal + 22);
      const iconAt = [at("ننسى", 0.64) + 6, at("كل", 0.66), tDunya];
      const icon = (k: number) => prog(frame, iconAt[k]! - 4, iconAt[k]! + 12);
      // سهم القلب يكتمل قبل ذكر اسم الله، فلا حركة جديدة عنده
      const heartArrow = prog(frame, tTry, end("قلوبنا", 0.56), (t) => t);
      return {
        focus: [[tPhrase, 960, 560], [at("القسم", 0.12), 960, 520], [tBook, 960, 560], [at("ننسى", 0.64), 1200, 450], [tSir, 1100, 232], [tIq, 850, 232], [tFace, 1320, 700], [tQibla, 420, 640], [tBody, 880, 700], [tTry, 1320, 650], [tHearts, 900, 560], [tDunya, 1300, 560], [at("الأبد", 0.76), 1200, 560], [tBal, 1250, 560], [tHaq, 1150, 560]],
        cam: [C(0, 960, 470, 1.15), C(tSir - 6, 960, 400, 1.05), C(tFace - 6, 980, 560, 1.0), C(tTry - 4, 1000, 590, 1.06), C(tDunya - 6, 1060, 560, 1.0), C(tHaq - 6, 1060, 580, 1.0)],
        world: (
          <g>
            <g opacity={book}>
              <OpenBook x={960} y={560} s={1.7} p={book} z={z} flip={flip} />
              {/* «هذا القسم»: شريط علامة فسفوري ينزل بين الصفحات */}
              <path d={`M948 474 L974 474 L974 ${474 + 170 * prog(frame, at("القسم", 0.12) - 2, at("القسم", 0.12) + 12)} L961 ${462 + 170 * prog(frame, at("القسم", 0.12) - 2, at("القسم", 0.12) + 12)} L948 ${474 + 170 * prog(frame, at("القسم", 0.12) - 2, at("القسم", 0.12) + 12)} Z`} fill={z.hl} stroke={z.ink} strokeWidth={4} opacity={prog(frame, at("القسم", 0.12) - 2, at("القسم", 0.12) + 4)} />
            </g>
            <g transform={`translate(0 ${lerp(300, 0, cardUp)})`} opacity={cardUp}>
              <Card x={960} y={232} w={tot + 120} h={160} z={z} rot={-1.5}>
                <Mark x={iqX - 960 - 10} y={-14} w={w2 + 20} h={46} p={prog(frame, end("الإقبال", 0.3) - 4, end("الإقبال", 0.3) + 10)} z={z} />
                <Write id="sr" x={right - 960} y={24} text="سر الصلاة:" size={74} p={wp(frame, tSir, at("الإقبال", 0.26))} c={z.ink} font="head" anchor="start" z={z} />
                <Write id="iq" x={iqX + w2 - 960} y={24} text="الإقبال" size={74} p={wp(frame, tIq, end("الإقبال", 0.3))} c={z.ink} font="head" anchor="start" z={z} />
              </Card>
            </g>
            {/* القبلة: بوصلة إبرتها نحو الجهة */}
            <g opacity={prog(frame, tQibla - 4, tQibla + 10)} transform="translate(420 610)">
              <circle r={70} fill={z.paper} stroke={z.ink} strokeWidth={7} />
              <path d="M-50 0 L18 -16 L18 16 Z" fill={z.ink} />
              <circle r={8} fill={z.hl} stroke={z.ink} strokeWidth={4} />
            </g>
            <Write id="qb" x={420} y={760} text="القبلة" size={68} p={wp(frame, tQibla, end("القبلة", 0.38))} c={z.ink} z={z} />
            <InkPerson x={1320} y={860} s={1.15} pose="stand" p={prog(frame, tFace - 2, tFace + 20)} z={z} dir={-1} />
            <Arrow x1={1210} y1={720} x2={530} y2={650} p={prog(frame, tBody - 2, tBody + 18)} c={z.ink} w={9} bend={-10} />
            <Write id="bd" x={880} y={760} text="بأبداننا" size={66} p={wp(frame, tBody, end("بأبداننا", 0.42))} c={z.ink} z={z} />
            {/* القلب: يُضاء ويتجه السهم الفسفوري في الجهة نفسها */}
            <path d={heartPath(1320, 650, 26)} fill={z.hl} stroke={z.ink} strokeWidth={5} opacity={prog(frame, tTry - 2, tTry + 10)} />
            <Stroke d="M1280 640 Q920 560 540 600" p={heartArrow} c={z.hl} w={28} opacity={0.95} />
            <Write id="hb" x={900} y={540} text="قلوبنا" size={66} p={wp(frame, tHearts, end("قلوبنا", 0.56))} c={z.ink} z={z} />
            {/* الدنيا لا تُمحى: تبقى، وتتنحى قليلًا لتأخذ الصلاة حقها */}
            {([["house", 1600, 330], ["bag", 1610, 560], ["cart", 1580, 760]] as const).map(([id, x, y], k) => (
              <Icon key={id} id={id} x={x + 40 * aside} y={y} s={1.1 - 0.2 * aside} p={icon(k)} c={z.ink} opacity={1 - 0.35 * aside} />
            ))}
            <ellipse cx={1320} cy={700} rx={200} ry={250} fill="none" stroke={z.hl} strokeWidth={22} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - prog(frame, tHaq - 2, tHaq + 20)} opacity={0.95} />
            <Write id="hq" x={1320} y={395} text="حقها من الانتباه" size={68} p={wp(frame, tHaq, end("الانتباه", 0.96))} c={z.ink} z={z} />
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
};
