import React from "react";
import { Easing, interpolate } from "remotion";
import { fontFamilies } from "../../../brand/fonts";
import { normalizeArabic } from "../../script/quranMeta";
import type { WordTiming } from "../scenes/timing";

/**
 * عُدّة «مشاهد الحبر» لقناة زبدة الكتب (هوية «القلم المميِّز»): ورق أبيض، حبر أسود،
 * فسفوري للفكرة وحدها، وبرتقالي للشطب والتنبيه. كل رسم يُخطّ بالقلم لحظة نطق كلمته.
 * لا تستعمل هذه العُدّة أي رسم من هويات القنوات الأخرى.
 */
export type Z = { ink: string; paper: string; hl: string; alert: string; faint: string };

export const W = 1920;
export const H = 1080;

const ease = Easing.inOut(Easing.cubic);
export const prog = (frame: number, a: number, b: number, e: (t: number) => number = ease) =>
  b <= a ? (frame >= a ? 1 : 0) : interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });
export const outCubic = Easing.out(Easing.cubic);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const strip = (w: string) => normalizeArabic(w.replace(/[«»"“”'؟?!.,،:؛…ـ()]/g, ""));
/**
 * لحظة نطق الكلمة (الظهور رقم nth)، وإن لم تُنطق في النص فنسبة من مدة المشهد.
 * تقبل السوابق الشائعة (و، ف، ب، ل، ال) فـ«قلوبنا» تطابق «وقلوبنا».
 */
export const makeAt = (timings: WordTiming[], dur: number) => (word: string, frac: number, nth = 1) => {
  const k = strip(word);
  let n = 0;
  for (const t of timings) {
    const w = strip(t.word);
    if (w === k || w === `و${k}` || w === `ف${k}` || w === `ب${k}` || w === `ل${k}` || w === `وب${k}` || w === `ول${k}`) {
      n++;
      if (n === nth) return t.start;
    }
  }
  return Math.round(frac * dur);
};
/** نهاية نطق الكلمة */
export const makeEnd = (timings: WordTiming[], dur: number) => (word: string, frac: number, nth = 1) => {
  const k = strip(word);
  let n = 0;
  for (const t of timings) {
    const w = strip(t.word);
    if (w === k || w === `و${k}` || w === `ف${k}` || w === `ب${k}` || w === `ل${k}`) {
      n++;
      if (n === nth) return t.end;
    }
  }
  return Math.round(frac * dur);
};

// ── قياس النص (لكشف الكتابة من بداية السطر بدقة) ─────────────────────────
let ctx: CanvasRenderingContext2D | null = null;
export const measure = (text: string, size: number, family: string, weight = 400) => {
  if (typeof document === "undefined") return Array.from(text).length * size * 0.5;
  ctx = ctx ?? document.createElement("canvas").getContext("2d");
  if (!ctx) return Array.from(text).length * size * 0.5;
  const resolved = family.replace(/var\((--[\w-]+)\s*,\s*([^)]+)\)/, (_m, v: string, fb: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fb);
  ctx.font = `${weight} ${size}px ${resolved}`;
  return ctx.measureText(text).width;
};

export type Font = "hand" | "head" | "body";
export const fam = (f: Font) => (f === "head" ? fontFamilies.heading : f === "hand" ? fontFamilies.hand : fontFamilies.body);

// ── الورق ───────────────────────────────────────────────────────────────
export const Paper: React.FC<{ z: Z }> = ({ z }) => (
  <g>
    <rect x={-1600} y={-1000} width={W + 3200} height={H + 2000} fill={z.paper} />
    {Array.from({ length: 60 }, (_, i) => (
      <line key={i} x1={-1600} x2={W + 1600} y1={-1000 + 26 + i * 54} y2={-1000 + 26 + i * 54} stroke={z.ink} strokeOpacity={0.055} strokeWidth={2} />
    ))}
    <line x1={W - 150} x2={W - 150} y1={-1000} y2={H + 1000} stroke={z.alert} strokeOpacity={0.28} strokeWidth={3} />
  </g>
);

/**
 * ورقة الدفتر بإحداثيات الصفحة (1920×1080): بياض، وسطور خافتة، وهامش. هي الورقة التي تُقلب بين الأفكار،
 * وهي نفسها ما تتلاشى إليه الافتتاحية، فالانتقال من الشعار إلى أول صفحة بلا سواد (توجيه المالك، ٩ نوفمبر).
 */
export const PageSheet: React.FC<{ z: Z; x?: number; shadow?: boolean }> = ({ z, x = 0, shadow = true }) => (
  <g transform={`translate(${x} 0)`}>
    {shadow ? <rect x={-40} y={0} width={40} height={H} fill={z.ink} opacity={0.12} /> : null}
    <rect x={0} y={0} width={W} height={H} fill={z.paper} />
    {Array.from({ length: 20 }, (_, i) => (
      <line key={i} x1={0} x2={W} y1={26 + i * 54} y2={26 + i * 54} stroke={z.ink} strokeOpacity={0.055} strokeWidth={2} />
    ))}
    <line x1={W - 150} x2={W - 150} y1={0} y2={H} stroke={z.alert} strokeOpacity={0.28} strokeWidth={3} />
  </g>
);

// ── خطّ بالقلم: مسار يُرسم من أوله إلى آخره ─────────────────────────────
export const Stroke: React.FC<{ d: string; p: number; c: string; w?: number; fill?: string; fillP?: number; opacity?: number; cap?: "round" | "butt" }> = ({ d, p, c, w = 7, fill, fillP = 0, opacity = 1, cap = "round" }) =>
  p <= 0 ? null : (
    <g opacity={opacity}>
      {fill && fillP > 0 ? <path d={d} fill={fill} opacity={fillP} stroke="none" /> : null}
      <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - Math.min(1, p)} fill="none" stroke={c} strokeWidth={w} strokeLinecap={cap} strokeLinejoin="round" />
    </g>
  );

/** نص يُكتب من بداية السطر (يمين العربية) لحظة نطقه، والقلم عند رأس الكتابة */
export const Write: React.FC<{
  x: number; y: number; text: string; size: number; p: number; c: string; font?: Font; weight?: number;
  anchor?: "middle" | "start" | "end"; opacity?: number; pen?: boolean; z?: Z; id: string;
}> = ({ x, y, text, size, p, c, font = "hand", weight = 400, anchor = "middle", opacity = 1, pen = true, z, id }) => {
  if (p <= 0) return null;
  // القياس تقديري (الخط الفعلي قد يختلف قليلًا)، فالعرض مُوسَّع للكشف، ولا قصّ بعد اكتمال الكتابة
  const w = measure(text, size, fam(font), weight) * 1.18 + size * 0.4;
  const right = anchor === "middle" ? x + w / 2 : anchor === "start" ? x + size * 0.2 : x + w;
  const left = right - w;
  const shown = Math.min(1, p);
  const cx = right - w * shown;
  const tx = anchor === "middle" ? x : anchor === "start" ? x : x + w;
  const ta = anchor === "middle" ? "middle" : "start";
  return (
    <g opacity={opacity}>
      {shown < 1 ? (
        <defs>
          <clipPath id={`wc-${id}`}>
            <rect x={cx} y={y - size * 1.5} width={right - cx + size} height={size * 2.3} />
          </clipPath>
        </defs>
      ) : null}
      <text
        x={tx}
        y={y}
        direction="rtl"
        textAnchor={ta}
        clipPath={shown < 1 ? `url(#wc-${id})` : undefined}
        style={{ fontFamily: fam(font), fontSize: size, fontWeight: weight, fill: c }}
      >
        {text}
      </text>
      {pen && shown < 1 && z ? <PenTip x={Math.max(left, cx)} y={y - size * 0.25} z={z} /> : null}
    </g>
  );
};

/** القلم المميِّز: جسم أسود وغطاء فسفوري (من هوية القناة) */
export const PenTip: React.FC<{ x: number; y: number; z: Z; s?: number }> = ({ x, y, z, s = 1 }) => (
  <g transform={`translate(${x} ${y}) rotate(-32) scale(${s})`}>
    <path d="M0 0 L-7 -22 L7 -22 Z" fill={z.ink} />
    <rect x={-10} y={-120} width={20} height={98} rx={6} fill={z.ink} />
    <rect x={-10} y={-136} width={20} height={22} rx={6} fill={z.hl} />
  </g>
);

/** تظليل فسفوري يُسحب تحت الكلمة */
export const Mark: React.FC<{ x: number; y: number; w: number; h: number; p: number; z: Z; rtl?: boolean }> = ({ x, y, w, h, p, z, rtl = true }) =>
  p <= 0 ? null : <rect x={rtl ? x + w * (1 - p) : x} y={y} width={w * p} height={h} rx={h * 0.18} fill={z.hl} opacity={0.92} style={{ mixBlendMode: "multiply" }} />;

/** شطب برتقالي (نفي ما قيل) */
export const Cross: React.FC<{ x1: number; x2: number; y: number; p: number; z: Z }> = ({ x1, x2, y, p, z }) => (
  <Stroke d={`M${x1} ${y + 6} Q${(x1 + x2) / 2} ${y - 10} ${x2} ${y - 2}`} p={p} c={z.alert} w={9} />
);

// ── أشكال ──────────────────────────────────────────────────────────────
export const heartPath = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy + r * 0.95} C${cx - r * 1.7} ${cy - r * 0.15} ${cx - r * 0.75} ${cy - r * 1.35} ${cx} ${cy - r * 0.42} C${cx + r * 0.75} ${cy - r * 1.35} ${cx + r * 1.7} ${cy - r * 0.15} ${cx} ${cy + r * 0.95} Z`;

/** سهم: خط ورأس، يُرسم من (x1,y1) إلى (x2,y2) */
export const Arrow: React.FC<{ x1: number; y1: number; x2: number; y2: number; p: number; c: string; w?: number; bend?: number }> = ({ x1, y1, x2, y2, p, c, w = 8, bend = 0 }) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - bend;
  const d = `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`;
  const a = Math.atan2(y2 - my, x2 - mx);
  const hs = w * 3.2;
  const head = `M${x2 - hs * Math.cos(a - 0.5)} ${y2 - hs * Math.sin(a - 0.5)} L${x2} ${y2} L${x2 - hs * Math.cos(a + 0.5)} ${y2 - hs * Math.sin(a + 0.5)}`;
  return (
    <g>
      <Stroke d={d} p={Math.min(1, p * 1.15)} c={c} w={w} />
      <Stroke d={head} p={prog(p, 0.85, 1)} c={c} w={w} />
    </g>
  );
};

/** بطاقة ورقية بظل حبري مزاح (أسلوب القناة) */
export const Card: React.FC<{ x: number; y: number; w: number; h: number; z: Z; fill?: string; rot?: number; children?: React.ReactNode; opacity?: number }> = ({ x, y, w, h, z, fill, rot = 0, children, opacity = 1 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`} opacity={opacity}>
    <rect x={-w / 2 + 10} y={-h / 2 + 12} width={w} height={h} rx={14} fill={z.ink} opacity={0.12} />
    <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={14} fill={fill ?? z.paper} stroke={z.ink} strokeWidth={5} />
    {children}
  </g>
);

// ── إنسان بلا ملامح (رسم خطي بالحبر) ─────────────────────────────────────
export type InkPose = "stand" | "fold" | "raise" | "ruku" | "sujud" | "dua" | "walk";
const POSES: Record<InkPose, { head: [number, number]; lines: string[] }> = {
  stand: { head: [0, -272], lines: ["M0 -236 L0 -118", "M0 -118 L-20 0", "M0 -118 L20 0", "M0 -220 L-24 -128", "M0 -220 L24 -128"] },
  fold: { head: [0, -272], lines: ["M0 -236 L0 -118", "M0 -118 L-20 0", "M0 -118 L20 0", "M0 -222 L-28 -176 L10 -182", "M0 -222 L26 -170 L-8 -176"] },
  raise: { head: [0, -272], lines: ["M0 -236 L0 -118", "M0 -118 L-20 0", "M0 -118 L20 0", "M0 -222 L-34 -244 L-38 -286", "M0 -222 L34 -244 L38 -286"] },
  ruku: { head: [-158, -150], lines: ["M0 0 L0 -126", "M0 -126 L-124 -138", "M-100 -136 L-18 -74", "M-112 -138 L-30 -70", "M14 0 L8 -126"] },
  dua: { head: [0, -272], lines: ["M0 -236 L0 -118", "M0 -118 L-20 0", "M0 -118 L20 0", "M0 -222 L-34 -170 L-72 -180", "M0 -222 L-22 -160 L-60 -164"] },
  walk: { head: [-6, -272], lines: ["M-4 -236 L0 -118", "M0 -118 L-38 0", "M0 -118 L32 0", "M-2 -220 L-34 -142", "M-2 -220 L26 -150"] },
  sujud: { head: [-150, -22], lines: ["M78 0 L-6 0", "M-6 0 L14 -84", "M14 -84 L-112 -44", "M-96 -48 L-128 0", "M-84 -52 L-112 0"] },
};
export const InkPerson: React.FC<{ x: number; y: number; s?: number; pose: InkPose; p?: number; z: Z; dir?: 1 | -1; color?: string; dashed?: boolean; opacity?: number }> = ({
  x, y, s = 1, pose, p = 1, z, dir = 1, color, dashed, opacity = 1,
}) => {
  const def = POSES[pose];
  const c = color ?? z.ink;
  const n = def.lines.length;
  return (
    <g transform={`translate(${x} ${y}) scale(${s * dir} ${s})`} opacity={opacity}>
      {def.lines.map((d, i) =>
        dashed ? (
          <Stroke key={i} d={d} p={prog(p, (i * 0.7) / (n + 1), (i * 0.7 + 1.6) / (n + 1), outCubic)} c={c} w={9} opacity={0.45} />
        ) : (
          <Stroke key={i} d={d} p={prog(p, (i * 0.7) / (n + 1), (i * 0.7 + 1.6) / (n + 1), outCubic)} c={c} w={16} />
        ),
      )}
      <circle cx={def.head[0]} cy={def.head[1]} r={30} fill={dashed ? "none" : c} stroke={c} strokeWidth={dashed ? 7 : 0} opacity={prog(p, 0, 0.35) * (dashed ? 0.45 : 1)} />
    </g>
  );
};

// ── أيقونات حبرية (للشواغل والحياة اليومية) ──────────────────────────────
export type IconId = "house" | "bag" | "phone" | "calendar" | "clock" | "cart";
const ICONS: Record<IconId, string[]> = {
  house: ["M-46 -4 L0 -46 L46 -4", "M-34 -14 L-34 40 L34 40 L34 -14", "M-10 40 L-10 12 L10 12 L10 40"],
  bag: ["M-48 -20 L48 -20 L48 40 L-48 40 Z", "M-18 -20 L-18 -38 L18 -38 L18 -20", "M-48 4 L48 4"],
  phone: ["M-26 -46 L26 -46 L26 46 L-26 46 Z", "M-8 34 L8 34", "M-26 -30 L26 -30"],
  calendar: ["M-44 -34 L44 -34 L44 42 L-44 42 Z", "M-44 -12 L44 -12", "M-24 -46 L-24 -24", "M24 -46 L24 -24", "M-22 10 L-10 10", "M10 10 L22 10", "M-22 26 L-10 26"],
  clock: ["M0 -44 A44 44 0 1 1 -0.1 -44 Z", "M0 -26 L0 0 L18 12"],
  cart: ["M-50 -30 L-34 -30 L-22 22 L36 22 L46 -16 L-28 -16", "M-14 40 A6 6 0 1 1 -14.1 40", "M28 40 A6 6 0 1 1 27.9 40"],
};
export const Icon: React.FC<{ id: IconId; x: number; y: number; s?: number; p: number; c: string; rot?: number; opacity?: number }> = ({ id, x, y, s = 1, p, c, rot = 0, opacity = 1 }) =>
  p <= 0 ? null : (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={opacity}>
      {ICONS[id].map((d, i, a) => (
        <Stroke key={i} d={d} p={prog(p, i / (a.length + 1), (i + 2) / (a.length + 1), outCubic)} c={c} w={7 / s} />
      ))}
    </g>
  );

/** شمس صغيرة بالحبر الأسود وحده: الفسفوري للفكرة لا للزينة (توجيه المالك، ٩ نوفمبر) */
export const Sun: React.FC<{ x: number; y: number; r?: number; z: Z; p?: number }> = ({ x, y, r = 30, z, p = 1 }) => (
  <g transform={`translate(${x} ${y})`} opacity={p}>
    <circle r={r} fill={z.paper} stroke={z.ink} strokeWidth={6} />
    {Array.from({ length: 8 }, (_, i) => {
      const a = (Math.PI / 4) * i;
      return <line key={i} x1={Math.cos(a) * (r + 12)} y1={Math.sin(a) * (r + 12)} x2={Math.cos(a) * (r + 26)} y2={Math.sin(a) * (r + 26)} stroke={z.ink} strokeWidth={6} strokeLinecap="round" />;
    })}
  </g>
);

/** أثر قدم (خطوة): نعل بخط الحبر وتعبئة فسفورية خفيفة */
export const Foot: React.FC<{ x: number; y: number; s?: number; rot?: number; p: number; c: string; fill?: string }> = ({ x, y, s = 1, rot = 0, p, c, fill = "none" }) =>
  p <= 0 ? null : (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s * (0.7 + 0.3 * p)})`} opacity={Math.min(1, p * 2)}>
      <path d="M0 -40 C14 -40 18 -22 16 -4 C14 14 12 34 0 40 C-12 34 -14 14 -16 -4 C-18 -22 -14 -40 0 -40 Z" fill={fill} stroke={c} strokeWidth={5} />
      <path d="M-8 -6 L8 -6" stroke={c} strokeWidth={4} strokeLinecap="round" />
    </g>
  );
