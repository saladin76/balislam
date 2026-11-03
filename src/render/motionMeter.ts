import { RenderInternals } from "@remotion/renderer";

/**
 * قاعدة القناة: الحركة والتفاعل في 80–90% من الوقت على الأقل.
 * المقياس: نسبة الثواني التي فيها «حركة مقصودة» في مساحة المشهد (بلا شريط الترجمة وعنوان الفصل):
 * يتغير ظاهريًا ≥ 2.5% من بكسلات المشهد خلال نصف ثانية. الحركة المحيطة الخفيفة (انجراف الكاميرا، الذرات، الطفو)
 * تبقى تحت هذا الحد عمدًا، فلا تُحسب «حركة» إلا الأحداث التي يراها المشاهد فعلًا (دخول عنصر، بناء نص، انتقال، نبضة).
 * المعايرة: السبورة الثابتة القديمة 25%، القصة المتحركة الأولى 70%.
 * السبورتان بطبقة الحركة الثانية (boardLayer.tsx)، فصل تجريبي 55 ثانية: المتصلة 95% أفقي و96% عمودي (كانت 33%)، والمرسومة 95% أفقي و98% عمودي (كانت 11%).
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
const ACTIVE_PCT = 2.5;

export type MotionReport = { percent: number; seconds: number; activeSeconds: number; perSecond: number[]; still: { from: number; to: number }[] };

export const measureMotion = async (file: string, orientation: "landscape" | "portrait" = "landscape"): Promise<MotionReport> => {
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
  const area = (y1 - y0) * fw;
  const changed: number[] = [];
  for (let i = LAG; i < n; i++) {
    let c = 0;
    const a = (i - LAG) * size;
    const b = i * size;
    for (let y = y0; y < y1; y++)
      for (let x = 0; x < fw; x++) {
        const k = y * fw + x;
        if (Math.abs(out[b + k]! - out[a + k]!) > PIXEL_DELTA) c++;
      }
    changed.push((c / area) * 100);
  }
  const seconds = Math.floor(n / FPS);
  const perSecond = Array.from({ length: seconds }, (_, s) => {
    const from = Math.max(0, s * FPS - LAG);
    const to = Math.max(from + 1, (s + 1) * FPS - LAG);
    return Math.max(0, ...changed.slice(from, to));
  });
  const active = perSecond.map((v) => v >= ACTIVE_PCT);
  const still: { from: number; to: number }[] = [];
  let s0 = -1;
  active.forEach((on, s) => {
    if (!on && s0 < 0) s0 = s;
    if ((on || s === active.length - 1) && s0 >= 0) {
      const end = on ? s : s + 1;
      if (end - s0 >= 2) still.push({ from: s0, to: end });
      s0 = -1;
    }
  });
  const activeSeconds = active.filter(Boolean).length;
  return { percent: seconds ? Math.round((activeSeconds / seconds) * 100) : 0, seconds, activeSeconds, perSecond: perSecond.map((v) => Math.round(v * 10) / 10), still };
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export const motionSummary = (r: MotionReport, label: string) => {
  const verdict = r.percent < MOTION_MIN ? "أقل من الحد" : r.percent > MOTION_BUSY ? "مزدحمة (راجع الإيقاع)" : r.percent >= MOTION_TARGET ? "ممتاز" : "مقبول";
  const still = r.still.length ? `\nمقاطع ساكنة (ثانيتان فأكثر): ${r.still.map((x) => `${clock(x.from)}–${clock(x.to)}`).join("، ")}` : "";
  return `${label}: الحركة ${r.percent}% (${r.activeSeconds}/${r.seconds} ثانية) · ${verdict} · الحد ${MOTION_MIN}% والهدف ${MOTION_TARGET}%${still}`;
};
