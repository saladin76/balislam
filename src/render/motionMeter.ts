import { RenderInternals } from "@remotion/renderer";

/**
 * قاعدة القناة: الحركة والتفاعل في 80–90% من الوقت على الأقل.
 * المقياس: نسبة الثواني التي فيها «حركة مقصودة» في مساحة المشهد (بلا شريط الترجمة وعنوان الفصل):
 * يتغير ظاهريًا ≥ 2.5% من بكسلات المشهد خلال نصف ثانية. الحركة المحيطة الخفيفة (انجراف الكاميرا، الذرات، الطفو)
 * تبقى تحت هذا الحد عمدًا، فلا تُحسب «حركة» إلا الأحداث التي يراها المشاهد فعلًا (دخول عنصر، بناء نص، انتقال، نبضة).
 * المعايرة: السبورة الثابتة القديمة 25%، القصة المتحركة الأولى 70%.
 * السبورتان بطبقة الحركة الثانية (boardLayer.tsx)، فصل تجريبي 55 ثانية: المتصلة 95% أفقي و96% عمودي (كانت 33%)، والمرسومة 95% أفقي و98% عمودي (كانت 11%).
 *
 * الحدث الموضعي (٨ نوفمبر ٢٠٢٦، D34 في مرجع زبدة الكتب): حد المساحة (2.5% من المشهد) يُسقط أحداثًا يراها المشاهد
 * لكنها صغيرة المساحة: كتابة بخط اليد الرفيع، امتلاء مربع صغير بالفسفوري، ظهور كلمة في دعاء، مشي شخصية صغيرة.
 * فيُحسب الحدث أيضًا إذا تركّز تغيير «جديد» في نافذة واحدة 16×16 (بدقة القياس): بكسلات تغيّرت فوق PIXEL_DELTA
 * ولا يفسّرها انزياح صغير (±SHIFT_PX في أي اتجاه) لما كان في الإطار قبل نصف ثانية. الانجراف والطفو وحركة
 * الكاميرا البطيئة انزياح، فيفسّرها البحث فلا تُحسب؛ والضجيج تحت PIXEL_DELTA؛ والحبر الجديد لا يفسّره انزياح.
 * المعايرة على فيديوهات القنوات الثلاث: المحيط وحده ≤ 25 بكسلًا في النافذة، والأحداث الرقيقة الحقيقية ≥ 34.
 * القيمة في perSecond هي الأكبر من نسبة المساحة ومن «ما يعادلها» للحدث الموضعي (LOCAL_EVENT_PX ↔ ACTIVE_PCT)،
 * فيبقى حكم «نشط» عند كل المستهلكين: perSecond ≥ ACTIVE_PCT.
 */
export const MOTION_MIN = 80;
export const MOTION_TARGET = 90;
/** فوق هذا تنبيه فقط: كثرة الحركة قد ترهق المشاهد. */
export const MOTION_BUSY = 97;

const W = 320;
const H = 180;
const FPS = 10;
const LAG = 5; // نصف ثانية
const PIXEL_DELTA = 28;
export const ACTIVE_PCT = 2.5;
/** نصف قطر البحث عن الانزياح (بكسل بدقة القياس): ما يفسّره انزياح بهذا القدر في نصف ثانية ليس حدثًا جديدًا */
export const SHIFT_PX = 2;
/** النافذة الموضعية بكسل (بدقة القياس)، تُفحص بخطوة نصفها فلا ينقسم الحدث على حدود نافذتين */
export const LOCAL_WIN = 16;
/** بكسلات التغيير الجديد في نافذة واحدة التي تجعلها حدثًا (1/8 من النافذة) */
export const LOCAL_EVENT_PX = 32;

export type MotionReport = { percent: number; seconds: number; activeSeconds: number; perSecond: number[]; still: { from: number; to: number }[]; exempt?: number[] };

/**
 * exempt: ثوانٍ سكونها مقصود (الآيات وتمهيدها وذكر الله، انظر stillness.ts): لا تدخل في النسبة
 * ولا تُعد «مقطعًا ساكنًا»، وتُذكر في التقرير منفصلة.
 */
export const measureMotion = async (file: string, orientation: "landscape" | "portrait" = "landscape", exempt?: Set<number>): Promise<MotionReport> => {
  const proc = RenderInternals.callFf({
    bin: "ffmpeg",
    args: ["-v", "error", "-i", file, "-r", String(FPS), "-vf", `scale=${orientation === "portrait" ? `${H}:${W}` : `${W}:${H}`},format=gray`, "-c:v", "rawvideo", "-f", "image2pipe", "-"],
    indent: false,
    logLevel: "error",
    binariesDirectory: null,
    cancelSignal: undefined,
    options: { encoding: "buffer", maxBuffer: 1024 * 1024 * 1024 } as never,
  });
  const out = (await proc).stdout as unknown as Buffer;
  const [fw, fh] = orientation === "portrait" ? [H, W] : [W, H];
  const size = fw * fh;
  const n = Math.floor(out.length / size);
  // مساحة المشهد: بلا أعلى 12% (عنوان الفصل) وأسفل 24% (الترجمة)
  const y0 = Math.floor(fh * 0.12);
  const y1 = Math.floor(fh * 0.76);
  const changed: number[] = [];
  for (let i = LAG; i < n; i++) changed.push(frameActivity(out.subarray((i - LAG) * size, (i - LAG + 1) * size), out.subarray(i * size, (i + 1) * size), fw, y0, y1));
  const seconds = Math.floor(n / FPS);
  const perSecond = Array.from({ length: seconds }, (_, s) => {
    const from = Math.max(0, s * FPS - LAG);
    const to = Math.max(from + 1, (s + 1) * FPS - LAG);
    return Math.max(0, ...changed.slice(from, to));
  });
  const active = perSecond.map((v) => v >= ACTIVE_PCT);
  const ex = (s: number) => Boolean(exempt?.has(s));
  const still: { from: number; to: number }[] = [];
  let s0 = -1;
  active.forEach((on, s) => {
    const breakHere = on || ex(s);
    if (!breakHere && s0 < 0) s0 = s;
    if ((breakHere || s === active.length - 1) && s0 >= 0) {
      const end = breakHere ? s : s + 1;
      if (end - s0 >= 2) still.push({ from: s0, to: end });
      s0 = -1;
    }
  });
  const counted = active.map((_, s) => s).filter((s) => !ex(s));
  const activeSeconds = counted.filter((s) => active[s]).length;
  return {
    percent: counted.length ? Math.round((activeSeconds / counted.length) * 100) : 0,
    seconds: counted.length,
    activeSeconds,
    perSecond: perSecond.map((v) => Math.round(v * 10) / 10),
    still,
    ...(exempt && exempt.size ? { exempt: [...exempt].filter((s) => s < seconds).sort((a, b) => a - b) } : {}),
  };
};

/**
 * نشاط زوج إطارين رماديين (a قبل نصف ثانية، b الآن) في الصفوف [y0, y1): نسبة البكسلات المتغيرة من المشهد،
 * أو ما يعادلها للحدث الموضعي إن كان أكبر (انظر التعليق أعلى الملف). القيمة ≥ ACTIVE_PCT تعني ثانية نشطة.
 */
export const frameActivity = (a: Uint8Array, b: Uint8Array, fw: number, y0: number, y1: number): number => {
  const area = (y1 - y0) * fw;
  let c = 0;
  const half = LOCAL_WIN / 2;
  const cw = Math.ceil(fw / half);
  const ch = Math.ceil((y1 - y0) / half);
  const cells = new Uint16Array(cw * ch);
  let fresh = 0;
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < fw; x++) {
      const k = y * fw + x;
      const v = b[k]!;
      if (Math.abs(v - a[k]!) <= PIXEL_DELTA) continue;
      c++;
      // تغيير يفسّره انزياح صغير (انجراف، طفو، كاميرا) ليس جديدًا. حافة الإطار لا يُحكم فيها.
      if (y < y0 + SHIFT_PX || y >= y1 - SHIFT_PX || x < SHIFT_PX || x >= fw - SHIFT_PX) continue;
      let explained = false;
      for (let dy = -SHIFT_PX; dy <= SHIFT_PX && !explained; dy++)
        for (let dx = -SHIFT_PX; dx <= SHIFT_PX; dx++)
          if (Math.abs(v - a[k + dy * fw + dx]!) <= PIXEL_DELTA) {
            explained = true;
            break;
          }
      if (!explained) {
        cells[Math.floor((y - y0) / half) * cw + Math.floor(x / half)]!++;
        fresh++;
      }
    }
  const pct = (c / area) * 100;
  if (pct >= ACTIVE_PCT || fresh < LOCAL_EVENT_PX) return pct;
  let local = 0;
  for (let cy = 0; cy < ch; cy++)
    for (let cx = 0; cx < cw; cx++) {
      const at = (yy: number, xx: number) => (yy < ch && xx < cw ? cells[yy * cw + xx]! : 0);
      local = Math.max(local, at(cy, cx) + at(cy, cx + 1) + at(cy + 1, cx) + at(cy + 1, cx + 1));
    }
  return Math.max(pct, (local / LOCAL_EVENT_PX) * ACTIVE_PCT);
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export const motionSummary = (r: MotionReport, label: string) => {
  const verdict = r.percent < MOTION_MIN ? "أقل من الحد" : r.percent > MOTION_BUSY ? "مزدحمة (راجع الإيقاع)" : r.percent >= MOTION_TARGET ? "ممتاز" : "مقبول";
  const still = r.still.length ? `\nمقاطع ساكنة (ثانيتان فأكثر): ${r.still.map((x) => `${clock(x.from)}–${clock(x.to)}`).join("، ")}` : "";
  const ex = r.exempt?.length ? ` · سكون مقصود مستثنى: ${r.exempt.length} ثانية (الآيات وتمهيدها وذكر الله)` : "";
  return `${label}: الحركة ${r.percent}% (${r.activeSeconds}/${r.seconds} ثانية) · ${verdict} · الحد ${MOTION_MIN}% والهدف ${MOTION_TARGET}%${ex}${still}`;
};
