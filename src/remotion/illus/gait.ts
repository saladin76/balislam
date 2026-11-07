import { blendPose, LEG_LEN, POSES, type PoseName, type PoseSpec } from "./Figure";

/**
 * حركة الشخصيات (الأمر 006): مشية بحسب الحالة، وتسارع وتباطؤ، وقدم ثابتة على الأرض بلا انزلاق،
 * واستعداد قبل الانطلاق، واستقرار بعد التوقف، ومتابعة الثوب، والتفاتة بالجسد بدل الانقلاب الفوري.
 * دوال خالصة (رقم الإطار ← الحالة) فتُختبر وتعطي نفس النتيجة في كل رندر.
 * لا تمس walkPose ولا poseAt القديمتين: الأوضاع القديمة تبقى كما هي.
 */

export const GAIT_IDS = ["stroll", "walk", "brisk", "heavy"] as const;
export type GaitId = (typeof GAIT_IDS)[number];

type GaitSpec = {
  /** نصف طول الخطوة للقدم (وحدات محلية) عند السرعة الكاملة */
  ax: number;
  /** خطوات كاملة في الثانية (دورة = خطوتان) */
  cadence: number;
  /** نسبة الارتكاز من الدورة (أكثر من النصف = لحظة ارتكاز مزدوج) */
  stance: number;
  /** انثناء الركبة في التأرجح (درجات) */
  knee: number;
  /** تأرجح الذراع واثناء المرفق */
  arm: number;
  elbow: number;
  /** ميل الجذع وانحناء الرأس عند السرعة الكاملة */
  lean: number;
  head: number;
  /** إطارات التسارع والتباطؤ */
  accel: number;
  decel: number;
};

/** المشيات: من المتثاقل إلى المسرع. السرعة تُشتق من طول الخطوة والإيقاع، فلا تنزلق القدم */
export const GAITS: Record<GaitId, GaitSpec> = {
  // متثاقل: خطوة قصيرة، جذع منحنٍ، رأس منخفض، ذراعان شبه ساكنتين
  // (الأمر 007) أحيا قليلًا: خطوة أطول وإيقاع أسرع، فلا يبدو جرًّا، مع بقاء الانحناء والثقل
  heavy: { ax: 26, cadence: 0.7, stance: 0.66, knee: 24, arm: 6, elbow: 10, lean: 8, head: 14, accel: 24, decel: 26 },
  // متمهل: هادئ متأمل
  stroll: { ax: 31, cadence: 0.74, stance: 0.62, knee: 28, arm: 11, elbow: 10, lean: 3, head: 6, accel: 20, decel: 22 },
  // طبيعي
  walk: { ax: 40, cadence: 0.92, stance: 0.6, knee: 38, arm: 19, elbow: 14, lean: 4, head: 2, accel: 15, decel: 18 },
  // مسرع: خطوة طويلة، ذراعان أنشط، ميل للأمام
  brisk: { ax: 50, cadence: 1.1, stance: 0.58, knee: 48, arm: 22, elbow: 26, lean: 7, head: 0, accel: 11, decel: 14 },
};

/** أقصى سرعة (وحدات العالم لكل إطار) لمشية بمقياس شخصية */
export const gaitSpeed = (g: GaitId, scale: number, fps: number) => {
  const s = GAITS[g];
  return ((s.cadence / fps) * (2 * s.ax * scale)) / s.stance;
};

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * زاوية الفخذ التي تضع القدم عند x (وحدات محلية) مع انثناء ركبة e:
 * x = THIGH·sin(s) + SHIN·sin(s−e). حل بنيوتن (3 تكرارات تكفي للدقة المطلوبة).
 */
const THIGH = 70;
const SHIN = LEG_LEN - THIGH;
const thighFor = (x: number, e: number) => {
  let s = deg(Math.asin(Math.max(-0.95, Math.min(0.95, x / LEG_LEN)))) + e * (SHIN / LEG_LEN);
  for (let i = 0; i < 3; i++) {
    const f = THIGH * Math.sin(rad(s)) + SHIN * Math.sin(rad(s - e)) - x;
    const df = (THIGH * Math.cos(rad(s)) + SHIN * Math.cos(rad(s - e))) * (Math.PI / 180);
    s -= f / (df || 1);
  }
  return s;
};

/** موضع القدم وانثناء الركبة لساق في طور p (0..1): ارتكاز خطي ثم تأرجح بانثناء */
const legAt = (p: number, g: GaitSpec, amount: number) => {
  const ph = ((p % 1) + 1) % 1;
  const A = g.ax * amount;
  if (ph < g.stance) {
    // الارتكاز: القدم تتحرك للخلف بسرعة ثابتة تساوي سرعة الجسد، فتبدو ثابتة على الأرض
    const x = A * (1 - (2 * ph) / g.stance);
    const e = 4;
    return { s: thighFor(x, e), e, x };
  }
  const q = (ph - g.stance) / (1 - g.stance);
  const x = -A + 2 * A * smooth(q);
  const e = 4 + g.knee * amount * Math.sin(Math.PI * q);
  return { s: thighFor(x, e), e, x };
};

/** وضعية المشي فوق وضعية أساس (إيماءة الذراعين والرأس تبقى بقدر بطء الحركة) */
export const gaitPose = (base: PoseSpec, phase: number, amount: number, gait: GaitId, extraLean = 0): PoseSpec => {
  const g = GAITS[gait];
  const a = clamp01(amount);
  if (a <= 0.001) return { ...base, lean: base.lean + extraLean };
  const front = legAt(phase, g, a);
  const back = legAt(phase + 0.5, g, a);
  // الذراع تعاكس الساق المقابلة لها بتأرجح جيبي ناعم (البندول) يتأخر قليلًا عن الساق،
  // والمرفق ينثني أكثر في التأرجح للأمام ويرتخي في الرجوع
  const ph = ((phase % 1) + 1) % 1;
  const cF = Math.cos(2 * Math.PI * (ph - 0.03));
  const swingF = -g.arm * cF;
  const swingB = g.arm * cF;
  const elbowF = g.elbow * (1 + 0.7 * Math.max(0, -cF));
  const elbowB = g.elbow * (1 + 0.7 * Math.max(0, cF));
  const mix = (b: number, w: number) => b + (w - b) * a;
  // الساقان تتبعان هندسة الخطوة مباشرة (طولها يصغر مع السرعة)، لا مزجًا بالمقدار يقصّرها مرة ثانية
  // فتنزلق القدم في التسارع والتباطؤ؛ المزج بوضعية الأساس في أول السرعة وآخرها فقط
  const la = Math.min(1, a / 0.2);
  const mixL = (b: number, w: number) => b + (w - b) * la;
  return {
    lean: base.lean + g.lean * a + extraLean,
    head: base.head + g.head * a,
    legFront: { s: mixL(base.legFront.s, front.s), e: mixL(base.legFront.e, front.e) },
    legBack: { s: mixL(base.legBack.s, back.s), e: mixL(base.legBack.e, back.e) },
    armFront: { s: mix(base.armFront.s, swingF), e: mix(base.armFront.e, elbowF) },
    armBack: { s: mix(base.armBack.s, swingB), e: mix(base.armBack.e, elbowB) },
  };
};

/** المسافة التي تقطعها مشية في عدد إطارات متاح، مع التسارع والتباطؤ (لتنتهي الحركة داخل زمنها) */
export const fitDistance = (g: GaitId, frames: number, scale: number, fps: number) => {
  const s = GAITS[g];
  const T = Math.max(0, frames);
  const ramps = s.accel + s.decel;
  if (T <= ramps) return gaitSpeed(g, scale, fps) * (T / ramps) * (T / 2) * 0.5;
  return gaitSpeed(g, scale, fps) * (T - ramps / 2);
};

/**
 * For an explicitly authored short beat, compress the acceleration/deceleration ramps
 * into the available frames. Legacy fitDistance stays unchanged for old scenes.
 */
export const fitDistanceWithin = (g: GaitId, frames: number, scale: number, fps: number) => {
  if (!Number.isFinite(frames) || frames <= 0) return 0;
  const spec = GAITS[g];
  const T = Math.max(1, frames);
  const rampScale = Math.min(1, T / (spec.accel + spec.decel));
  const ra = spec.accel * rampScale;
  const rd = spec.decel * rampScale;
  return gaitSpeed(g, scale, fps) * (T - (ra + rd) / 2);
};

/** عدد الإطارات التي تستغرقها مسافة بمشية (عكس fitDistance)، مع البداية أو النهاية الطائرة */
export const fitFrames = (g: GaitId, distance: number, scale: number, fps: number, flyIn = false, flyOut = false) => {
  const s = GAITS[g];
  const ra = flyIn ? 0 : s.accel;
  const rd = flyOut ? 0 : s.decel;
  return Math.max(ra + rd, distance / gaitSpeed(g, scale, fps) + (ra + rd) / 2);
};

/** حركة: انطلاق عند start لمسافة dx (بإشارتها) بمشية */
export type Move = {
  start: number;
  dx: number;
  gait: GaitId;
  /** Opt-in authored duration; old moves without it remain byte-for-byte unchanged. */
  durationFrames?: number;
  /**
   * استمرار الحركة عبر حدود المشاهد (الأمر 011): flyIn تبدأ بالسرعة الكاملة بلا استعداد ولا تسارع
   * (كان يمشي قبل بداية المشهد)، وflyOut تنتهي بالسرعة الكاملة بلا تباطؤ (يخرج من الإطار ماشيًا).
   */
  flyIn?: boolean;
  flyOut?: boolean;
};
/** التفاتة في المكان نحو اتجاه */
export type Turn = { at: number; to: 1 | -1; dur?: number };

type Profile = { start: number; end: number; vpk: number; ra: number; rd: number; dir: 1 | -1; gait: GaitId; flyIn?: boolean };
const profileOf = (m: Move, scale: number, fps: number): Profile => {
  const g = GAITS[m.gait];
  const vmax = gaitSpeed(m.gait, scale, fps);
  const D = Math.abs(m.dx);
  let ra = m.flyIn ? 0 : g.accel;
  let rd = m.flyOut ? 0 : g.decel;
  let T = D / vmax + (ra + rd) / 2;
  let vpk = vmax;
  if (m.durationFrames !== undefined && Number.isFinite(m.durationFrames) && m.durationFrames > 0) {
    // Beat duration is authoritative: no residual walking after the next pose/scene cue.
    T = Math.max(1, m.durationFrames);
    const rampScale = Math.min(1, T / Math.max(1, ra + rd));
    ra *= rampScale;
    rd *= rampScale;
    vpk = Math.min(vmax, D / Math.max(0.1, T - (ra + rd) / 2));
    return { start: m.start, end: m.start + T, vpk, ra, rd, dir: m.dx < 0 ? -1 : 1, gait: m.gait, ...(m.flyIn ? { flyIn: true } : {}) };
  }
  if (T < ra + rd) {
    // مسافة قصيرة: لا تبلغ السرعة الكاملة (خطوات قليلة)
    vpk = D / ((ra + rd) / 2);
    T = ra + rd;
  }
  return { start: m.start, end: m.start + T, vpk, ra, rd, dir: m.dx < 0 ? -1 : 1, gait: m.gait, ...(m.flyIn ? { flyIn: true } : {}) };
};
/** السرعة الموقّعة لملف حركة عند إطار (منحدرات ناعمة: تسارع ثم ثبات ثم تباطؤ) */
const speedAt = (p: Profile, f: number) => {
  // بداية طائرة: السرعة كاملة منذ إطار البداية نفسه
  if (f >= p.end || (f <= p.start && !(p.ra === 0 && f === p.start))) return 0;
  const up = p.ra === 0 ? 1 : smooth((f - p.start) / p.ra);
  const down = p.rd === 0 ? 1 : smooth((p.end - f) / p.rd);
  return p.dir * p.vpk * Math.min(up, down);
};

export type LocoState = {
  x: number;
  /** السرعة الموقّعة (وحدات العالم/إطار) */
  v: number;
  /** نسبة السرعة إلى أقصى سرعة المشية الحالية (0..1): مقدار المشي في الوضعية */
  amount: number;
  /** طور دورة المشي (0..1 يتكرر) */
  phase: number;
  gait: GaitId;
  /** ميل إضافي للجذع: استعداد قبل الانطلاق، وتابع بعد التوقف */
  lean: number;
  /** انثناء الركبتين للاستعداد (0..1) */
  dip: number;
  /** تأخر الثوب (وحدات محلية، موجب = إلى الخلف) */
  sway: number;
  /** اتجاه الرسم (+1 أو -1): ينقلب عند مواجهة الناظر في منتصف الالتفاتة */
  facing: number;
  /** زاوية النظر للرسم (0 جانبي .. 1 أمامي): الالتفاتة دوران للجسد بحجمه، لا تضييق له */
  view: number;
  moving: boolean;
};

/**
 * اتجاه الجسد مع الالتفاتات (الأمر 007): الجسد يدور حول محوره الرأسي، جانبي ← ثلاثة أرباع ← أمامي
 * ← ثلاثة أرباع ← جانبي معاكس. الانقلاب يقع وهو مواجه للناظر تمامًا حيث الرسم متماثل، فلا قفزة.
 */
const facingWith = (f: number, initial: 1 | -1, turns: Turn[]) => {
  let dir: number = initial;
  for (const t of [...turns].sort((a, b) => a.at - b.at)) {
    const dur = t.dur ?? 16;
    if (f < t.at) break;
    if (t.to === dir) continue;
    const p = (f - t.at) / dur;
    if (p >= 1) {
      dir = t.to;
      continue;
    }
    const e = smooth(p);
    const side = e < 0.5 ? dir : t.to;
    return { facing: side, view: Math.sin(Math.PI * e), turning: Math.sin(Math.PI * e) };
  }
  return { facing: dir, view: 0, turning: 0 };
};

/**
 * حالة الشخصية عند إطار: تُحسب بالتكامل من الإطار 0 (حتمية، وتكلفتها خطية ضئيلة).
 * - التفاتة تلقائية قبل حركة تعاكس الاتجاه الحالي.
 * - استعداد 8 إطارات قبل الانطلاق (ميل للخلف وانثناء ركبتين).
 * - الجذع والثوب على نابضين مخمّدين: يتابعان الجسد بعد التوقف ثم يستقران.
 */
export type LocoOptions = {
  x0: number;
  facing0?: 1 | -1;
  moves: Move[];
  turns?: Turn[];
  scale: number;
  fps: number;
  /**
   * سرعة يفرضها القالب نفسه (وحدات العالم/إطار، موقّعة) بدل الحركات: لمشاهد «السير في المكان»
   * التي يتحرك فيها العالم تحت الشخصية (الطريق). القدم تبقى ثابتة على أرض تتحرك بهذه السرعة.
   */
  velocity?: (f: number) => number;
  /** المشية مع velocity */
  gait?: GaitId;
};

export const locomote = (frame: number, o: LocoOptions): LocoState => {
  const driven = o.velocity;
  const moves = driven ? [] : [...o.moves].filter((m) => Math.abs(m.dx) > 0.5).sort((a, b) => a.start - b.start);
  const profs = moves.map((m) => profileOf(m, o.scale, o.fps));
  // التفاتة قبل كل حركة تعاكس الاتجاه السابق
  const turns: Turn[] = [...(o.turns ?? [])];
  let dirNow: 1 | -1 = o.facing0 ?? 1;
  const allTurns = [...turns].sort((a, b) => a.at - b.at);
  for (const p of profs) {
    for (const t of allTurns) if (t.at + (t.dur ?? 16) <= p.start) dirNow = t.to;
    if (p.dir !== dirNow) {
      turns.push({ at: p.start - 14, to: p.dir, dur: 14 });
      dirNow = p.dir;
    }
  }
  let x = o.x0;
  let phase = 0;
  let gait: GaitId = o.gait ?? profs[0]?.gait ?? "walk";
  // نابضا الجذع والثوب
  let lean = 0;
  let leanV = 0;
  // بداية طائرة: الثوب في حال المشي المستقرة منذ الإطار الأول (لا «يلحق» بالجسد كأنه بدأ من سكون)
  const fly = profs.find((p) => p.flyIn && p.start <= 0);
  let sway = fly ? fly.vpk * 1.5 : 0;
  let swayV = 0;
  let v = fly ? fly.dir * fly.vpk : 0;
  const end = Math.max(0, Math.floor(frame));
  for (let f = 0; f <= end; f++) {
    const p = profs.find((q) => f > q.start - 1 && f < q.end + 1) ?? null;
    const prevV = v;
    v = driven ? driven(f) : p ? speedAt(p, f) : 0;
    if (p) gait = p.gait;
    if (f > 0) x += (v + prevV) / 2;
    const g = GAITS[gait];
    const vmax = gaitSpeed(gait, o.scale, o.fps);
    const amount = Math.min(1, Math.abs(v) / vmax);
    // الإيقاع ثابت للمشية، والخطوة تقصر مع السرعة: فلا انزلاق في البداية ولا النهاية
    // فوق أقصى سرعة المشية (سرعة يفرضها القالب) يسرع الإيقاع بدل أن تنزلق القدم
    if (Math.abs(v) > 1e-4) phase += (g.cadence / o.fps) * Math.max(1, Math.abs(v) / vmax);
    // نابض الجذع: يتبع ميل المشية، ويتأثر بالتسارع (يندفع للأمام عند الكبح)
    const acc = v - prevV;
    // عند الكبح يندفع الجذع للأمام بقدر التباطؤ، ثم يعود النابض فيستقر بتأرجح خفيف
    const braking = Math.abs(v) < Math.abs(prevV);
    const leanTarget = braking ? 26 * Math.abs(acc) : 0;
    leanV += (leanTarget - lean) * 0.09 - leanV * 0.28;
    lean += leanV;
    // نابض الثوب: يتأخر بقدر السرعة، ويتأرجح قليلًا بعد التوقف
    // ومع كل خطوة رفرفة صغيرة للذيل (ضعف إيقاع الدورة) بقدر السرعة
    const swayTarget = Math.abs(v) * 1.5 + Math.sin(4 * Math.PI * phase) * 0.9 * Math.min(1, Math.abs(v) / vmax);
    swayV += (swayTarget - sway) * 0.07 - swayV * 0.16;
    sway += swayV;
  }
  // استعداد قبل الانطلاق: ميل للخلف وانثناء ركبتين خلال 8 إطارات
  let dip = 0;
  let antic = 0;
  for (const p of profs) {
    if (p.flyIn) continue;
    const u = (frame - (p.start - 8)) / 10;
    if (u > 0 && u < 1) {
      dip = Math.max(dip, Math.sin(Math.PI * u));
      antic = Math.min(antic, -2.5 * Math.sin(Math.PI * u));
    }
  }
  const fc = facingWith(frame, o.facing0 ?? 1, turns);
  const vmaxNow = gaitSpeed(gait, o.scale, o.fps);
  return {
    x,
    v,
    amount: Math.min(1, Math.abs(v) / vmaxNow),
    phase,
    gait,
    lean: lean + antic,
    dip: Math.max(dip, fc.turning * 0.6),
    sway,
    facing: fc.facing,
    view: fc.view,
    moving: Math.abs(v) > 1e-3,
  };
};

/** وضعية كاملة من حالة الحركة: المشي فوق الأساس، والاستعداد (انثناء الركبتين) */
export const locoPose = (base: PoseSpec, st: LocoState): PoseSpec => {
  const p = gaitPose(base, st.phase, st.amount, st.gait, st.lean);
  if (st.dip <= 0) return p;
  return { ...p, legFront: { s: p.legFront.s + 7 * st.dip, e: p.legFront.e + 14 * st.dip }, legBack: { s: p.legBack.s + 7 * st.dip, e: p.legBack.e + 14 * st.dip } };
};

/**
 * انتقال طبيعي بين الوضعيات: المدة تتبع حجم التغيير (10–28 إطارًا)، والرأس يتأخر 3 إطارات
 * والذراعان إطارين عن الجذع (تداخل الحركة)، بمنحنى تباطؤ طويل في النهاية.
 */
export const poseDistance = (a: PoseSpec, b: PoseSpec) =>
  Math.max(
    Math.abs(a.lean - b.lean),
    Math.abs(a.head - b.head),
    ...(["armBack", "armFront", "legBack", "legFront"] as const).flatMap((k) => [Math.abs(a[k].s - b[k].s), Math.abs(a[k].e - b[k].e)]),
  );
export const transitionFrames = (a: PoseSpec, b: PoseSpec) => Math.round(Math.max(10, Math.min(28, 9 + poseDistance(a, b) * 0.16)));

const easeOutLong = (t: number) => {
  // bezier تقريبي (0.33, 0, 0.15, 1): بداية سلسة واستقرار طويل
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 2.6) * (1 - 0.35 * x * (1 - x));
};

export const poseAtNatural = (frame: number, timeline: { at: number; pose: PoseName }[]): PoseSpec => {
  const tl = [...timeline].sort((a, b) => a.at - b.at);
  if (!tl.length) return POSES.stand;
  let cur = POSES[tl[0]!.pose];
  for (let i = 1; i < tl.length; i++) {
    const k = tl[i]!;
    if (frame < k.at) break;
    const target = POSES[k.pose];
    const d = transitionFrames(cur, target);
    const tBody = easeOutLong((frame - k.at) / d);
    const tArms = easeOutLong((frame - k.at - 2) / d);
    const tHead = easeOutLong((frame - k.at - 3) / d);
    const body = blendPose(cur, target, tBody);
    const arms = blendPose(cur, target, tArms);
    const head = blendPose(cur, target, tHead);
    cur = { ...body, armBack: arms.armBack, armFront: arms.armFront, head: head.head };
  }
  return cur;
};

/**
 * الطبقة المشتركة لحركة الشخصيات (الأمر 007): كل قالب يطلب حالة شخصيته من هنا بدل حساب المشي بنفسه.
 * تعطي الموضع والوضعية والاتجاه وزاوية النظر وتأخر الثوب، فتُمرَّر إلى Figure كما هي:
 *   const c = characterAt(frame, base, spec);
 *   <Figure x={c.x} pose={c.pose} facing={c.facing} view={c.view} sway={c.sway} … />
 * spec إما حركات (moves/turns) لشخصية تقطع المكان، أو velocity لشخصية تسير والعالم يمر تحتها.
 */
export type CharacterState = { x: number; pose: PoseSpec; facing: 1 | -1; view: number; sway: number; moving: boolean; loco: LocoState };
export const characterAt = (frame: number, base: PoseSpec, spec: LocoOptions): CharacterState => {
  const loco = locomote(frame, spec);
  return { x: loco.x, pose: locoPose(base, loco), facing: loco.facing < 0 ? -1 : 1, view: loco.view, sway: loco.sway, moving: loco.moving, loco };
};

/**
 * استمرار الحركة عبر حدود المشاهد (الأمر 011، الانتقال carry): دالة نقية تعدّل خطة المشي فقط.
 * - carryIn: يبدأ خارج الإطار ماشيًا بالسرعة الكاملة (flyIn) حتى موضعه المعتاد، وتُسقط حركات تقع أثناء دخوله.
 * - carryOut: يخرج من الإطار في آخر المشهد ماشيًا بلا تباطؤ (flyOut)، فيلتقط المشهد التالي الحركة نفسها.
 * بلا carryIn/carryOut تُعاد الخطة كما هي حرفيًا.
 */
export const withCarry = (o: {
  x0: number;
  facing0: 1 | -1;
  moves: Move[];
  turns: Turn[];
  gait: GaitId;
  dur: number;
  fps: number;
  scale: number;
  worldW: number;
  carryIn?: "left" | "right";
  carryOut?: "left" | "right";
  margin?: number;
}): { x0: number; facing0: 1 | -1; moves: Move[] } => {
  if (!o.carryIn && !o.carryOut) return { x0: o.x0, facing0: o.facing0, moves: o.moves };
  // يكاد جسده يغادر حافة العالم (وهي حافة الإطار عند الحافة) في آخر إطار، ويظهر طرفه في أول إطار من التالي
  const margin = o.margin ?? 60;
  let moves = [...o.moves];
  let x0 = o.x0;
  let facing0 = o.facing0;
  if (o.carryIn) {
    const sx = o.carryIn === "left" ? o.worldW + margin : -margin;
    const entry: Move = { start: 0, dx: o.x0 - sx, gait: o.gait, flyIn: true };
    const entryEnd = fitFrames(o.gait, Math.abs(entry.dx), o.scale, o.fps, true, false);
    moves = [entry, ...moves.filter((m) => m.start >= entryEnd + 4)];
    x0 = sx;
    facing0 = o.carryIn === "left" ? -1 : 1;
  }
  if (o.carryOut) {
    const base = { x0, facing0, moves: [...moves], turns: o.turns, scale: o.scale, fps: o.fps };
    const target = o.carryOut === "left" ? -margin : o.worldW + margin;
    const lastEnd = Math.max(0, ...moves.map((m) => m.start + (m.durationFrames ?? fitFrames(m.gait, Math.abs(m.dx), o.scale, o.fps, Boolean(m.flyIn), Boolean(m.flyOut)))));
    // يبدأ الخروج بحيث يغادر الإطار مع آخر إطار، ولا يبدأ قبل انتهاء ما قبله
    let start = o.dur - 1;
    for (let k = 0; k < 3; k++) {
      const from = locomote(Math.max(0, start), base).x;
      start = Math.round(o.dur - 1 - fitFrames(o.gait, Math.abs(target - from), o.scale, o.fps, false, true));
    }
    start = Math.max(start, Math.ceil(lastEnd) + 2);
    const from = locomote(start, base).x;
    // يمتد قليلًا بعد آخر إطار: فهو في آخر إطار ما زال ماشيًا بالسرعة الكاملة (لا يقف عند الحافة)
    const beyond = Math.sign(target - from) * gaitSpeed(o.gait, o.scale, o.fps) * 3;
    moves.push({ start, dx: target - from + beyond, gait: o.gait, flyOut: true });
  }
  return { x0, facing0, moves };
};
