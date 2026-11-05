import React from "react";
import { AbsoluteFill, Freeze, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { easeOf, type ShapeName, type Transition } from "../../plan/transitions";

/**
 * محرك الانتقالات بين المشاهد (الأمر 011).
 *
 * الانتقال يقع في أول إطارات المشهد الداخل: طبقتان، تحتها المشهد الخارج مجمَّدًا على آخر إطار له
 * (بمدته الأصلية، فتوقيتات كلماته صحيحة، وبلا صوته)، وفوقها المشهد الداخل حيًّا؛ والانتقال حركة أو قناع
 * أو ضوء على الطبقتين. لا تداخل في الخط الزمني: مدد المشاهد وتوقيت الصوت لا تتغير أبدًا.
 * المشهد الخارج يُرسم فقط داخل نافذة الانتقال (تُحذف طبقته فور انتهائه)، فالتكلفة الإضافية محصورة في إطاراته القليلة.
 */

/** سياق الانتقال لكل مشهد: إيقاف تلاشي الخروج/الدخول حين يتولاهما الانتقال، واستمرار حركة البطل */
export type TransitionCtx = { holdExit?: boolean; skipEnter?: boolean; carryIn?: "left" | "right"; carryOut?: "left" | "right" };
export const TransitionContext = React.createContext<TransitionCtx>({});
export const useTransition = () => React.useContext(TransitionContext);

type V2 = [number, number];
const N = 96;
/** شكل وحدة (نصف قطره ≈ 1) بـ N نقطة متساوية على المحيط، تبدأ من الأعلى وتدور مع عقارب الساعة: كل الأشكال بالبنية نفسها فتتحول بسلاسة */
const resample = (poly: V2[]): V2[] => {
  const closed = [...poly, poly[0]!];
  const seg = closed.slice(1).map((p, i) => Math.hypot(p[0] - closed[i]![0], p[1] - closed[i]![1]));
  const total = seg.reduce((a, b) => a + b, 0);
  const out: V2[] = [];
  let i = 0;
  let acc = 0;
  for (let k = 0; k < N; k++) {
    const target = (k / N) * total;
    while (acc + seg[i]! < target && i < seg.length - 1) acc += seg[i++]!;
    const t = (target - acc) / (seg[i]! || 1);
    const a = closed[i]!;
    const b = closed[i + 1]!;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
};
const unitShape = (s: ShapeName): V2[] => {
  const pts: V2[] = [];
  if (s === "circle") for (let k = 0; k < 360; k++) pts.push([Math.sin((k / 360) * Math.PI * 2), -Math.cos((k / 360) * Math.PI * 2)]);
  else if (s === "square") {
    // مربع بزوايا مستديرة قليلًا
    const r = 0.18;
    const c = 0.86;
    const arc = (cx: number, cy: number, a0: number) => {
      for (let k = 0; k <= 12; k++) {
        const a = a0 + (k / 12) * (Math.PI / 2);
        pts.push([cx + r * Math.sin(a), cy - r * Math.cos(a)]);
      }
    };
    pts.push([0, -c]);
    arc(c - r, -c + r, 0);
    arc(c - r, c - r, Math.PI / 2);
    arc(-c + r, c - r, Math.PI);
    arc(-c + r, -c + r, (3 * Math.PI) / 2);
  } else if (s === "arch") {
    // قوس محراب مدبب: رأس مدبب في الأعلى، ثم جانبان مستقيمان، وقاعدة
    const w = 0.62;
    const spring = -0.25;
    pts.push([0, -1]);
    for (let k = 1; k <= 24; k++) {
      const t = k / 24;
      pts.push([w * Math.sin((t * Math.PI) / 2), spring - (1 + spring) * Math.cos((t * Math.PI) / 2) * (1 - 0.1 * t)]);
    }
    pts.push([w, 1], [-w, 1]);
    for (let k = 24; k >= 1; k--) {
      const t = k / 24;
      pts.push([-w * Math.sin((t * Math.PI) / 2), spring - (1 + spring) * Math.cos((t * Math.PI) / 2) * (1 - 0.1 * t)]);
    }
  } else {
    // نجمة ثمانية: 16 رأسًا متناوبة (النقش في هوية القناة)
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const r = k % 2 === 0 ? 1 : 0.72;
      pts.push([r * Math.sin(a), -r * Math.cos(a)]);
    }
  }
  return resample(pts);
};
const SHAPE_CACHE = new Map<ShapeName, V2[]>();
const shapePts = (s: ShapeName) => {
  if (!SHAPE_CACHE.has(s)) SHAPE_CACHE.set(s, unitShape(s));
  return SHAPE_CACHE.get(s)!;
};
/** مسار الشكل (بين شكلين بنسبة m) بمركز وحجم */
export const shapePath = (from: ShapeName, to: ShapeName, m: number, cx: number, cy: number, r: number) => {
  const a = shapePts(from);
  const b = shapePts(to);
  return (
    a
      .map((p, i) => {
        const q = b[i]!;
        const x = cx + (p[0] + (q[0] - p[0]) * m) * r;
        const y = cy + (p[1] + (q[1] - p[1]) * m) * r;
        return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
};
/** نصف القطر الذي يغطي الإطار كله من نقطة (لأي شكل وحدة يحتوي دائرة نصف قطرها 0.72) */
const coverRadius = (x: number, y: number, w: number, h: number) => Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y)) / 0.6;

/** المشهد الخارج مجمَّدًا على آخر إطار له، بمدته الأصلية، دون تلاشي خروجه ولا صوته */
export const FrozenScene = React.memo<{ frames: number; children: React.ReactNode }>(({ frames, children }) => (
  <Freeze frame={frames - 1}>
    <Sequence durationInFrames={frames} layout="none" name="المشهد السابق (مجمَّد للانتقال)">
      <TransitionContext.Provider value={{ holdExit: true }}>{children}</TransitionContext.Provider>
    </Sequence>
  </Freeze>
));

type Colors = { bg: string; light: string };
const layer: React.CSSProperties = { position: "absolute", inset: 0, overflow: "hidden" };

/**
 * يرسم الانتقال في أول `t.dur` إطارًا من المشهد الداخل. بعدها لا يبقى إلا المشهد الداخل كما هو.
 */
export const TransitionIn: React.FC<{ t: Transition; outgoing: React.ReactNode; colors: Colors; children: React.ReactNode }> = ({ t, outgoing, colors, children }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  if (t.dur <= 0 || frame >= t.dur) return <>{children}</>;
  const p = easeOf(t.ease)((frame + 1) / (t.dur + 1));
  const lin = (frame + 1) / (t.dur + 1);
  const A = (style: React.CSSProperties, extra?: React.ReactNode) => (
    <div style={{ ...layer, ...style }}>
      {outgoing}
      {extra}
    </div>
  );
  const B = (style: React.CSSProperties, extra?: React.ReactNode) => (
    <div style={{ ...layer, ...style }}>
      {children}
      {extra}
    </div>
  );
  const at = (q: { x: number; y: number }) => ({ x: q.x * W, y: q.y * H });
  switch (t.kind) {
    case "fade":
      return (
        <AbsoluteFill>
          {A({})}
          {B({ opacity: p })}
        </AbsoluteFill>
      );
    case "push": {
      const v = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[t.dir];
      // المشهدان معًا كأن الكاميرا تنعطف: الخارج يمضي في الاتجاه، والداخل يأتي من الجهة المقابلة
      return (
        <AbsoluteFill>
          {A({ transform: `translate(${v[0]! * W * p}px, ${v[1]! * H * p}px)` })}
          {B({ transform: `translate(${-v[0]! * W * (1 - p)}px, ${-v[1]! * H * (1 - p)}px)` })}
        </AbsoluteFill>
      );
    }
    case "zoom": {
      const c = at(t.at);
      const o = `${c.x}px ${c.y}px`;
      const into = t.dir === "in";
      const aScale = into ? 1 + 0.45 * p : 1 - 0.18 * p;
      const bScale = into ? 0.82 + 0.18 * p : 1.25 - 0.25 * p;
      return (
        <AbsoluteFill>
          {A({ transform: `scale(${aScale})`, transformOrigin: o })}
          {B({ transform: `scale(${bScale})`, transformOrigin: o, opacity: Math.min(1, p * 1.6) })}
        </AbsoluteFill>
      );
    }
    case "through": {
      // الكاميرا تدخل العنصر في الأول حتى يملأ الإطار، ثم تخرج من العنصر نفسه في الثاني
      const a = at(t.a);
      const b = at(t.b);
      const S = 5;
      const pa = Math.min(1, p / 0.6);
      const pb = Math.max(0, (p - 0.4) / 0.6);
      const mixB = Math.max(0, Math.min(1, (p - 0.42) / 0.16));
      return (
        <AbsoluteFill>
          {A({ transform: `scale(${1 + (S - 1) * pa * pa})`, transformOrigin: `${a.x}px ${a.y}px` })}
          {B({ transform: `scale(${S - (S - 1) * (1 - (1 - pb) ** 2)})`, transformOrigin: `${b.x}px ${b.y}px`, opacity: mixB })}
        </AbsoluteFill>
      );
    }
    case "mask":
    case "morph": {
      const c = at(t.at);
      const R = coverRadius(c.x, c.y, W, H);
      const edge = Math.max(2, Math.min(W, H) / 360);
      const edgeOpacity = 0.7 * (1 - lin) * Math.min(1, lin * 6);
      let clip: string;
      let outline: string | null = null;
      if (t.kind === "mask" && t.shape === "wipe") {
        const s = p * 100;
        clip = { left: `inset(0 0 0 ${100 - s}%)`, right: `inset(0 ${100 - s}% 0 0)`, up: `inset(${100 - s}% 0 0 0)`, down: `inset(0 0 ${100 - s}% 0)` }[t.dir];
        const pos = { left: W * (1 - p), right: W * p, up: H * (1 - p), down: H * p }[t.dir];
        outline = t.dir === "left" || t.dir === "right" ? `M${pos} 0 L${pos} ${H}` : `M0 ${pos} L${W} ${pos}`;
      } else {
        const from: ShapeName = t.kind === "morph" ? t.from : t.shape === "arch" ? "arch" : "circle";
        const to: ShapeName = t.kind === "morph" ? t.to : from;
        // الشكل يتحول في أول ثلثي الانتقال ثم يتسع بشكله الأخير حتى يغطي الإطار
        const m = t.kind === "morph" ? Math.min(1, lin / 0.66) : 0;
        const r = Math.max(0.5, R * p);
        const d = shapePath(from, to, m, c.x, c.y, r);
        clip = `path('${d}')`;
        outline = d;
      }
      return (
        <AbsoluteFill>
          {A({})}
          {B({ clipPath: clip, WebkitClipPath: clip } as React.CSSProperties)}
          {outline && edgeOpacity > 0.01 ? (
            <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <path d={outline} fill="none" stroke={colors.light} strokeWidth={edge} opacity={edgeOpacity} strokeLinejoin="round" />
            </svg>
          ) : null}
        </AbsoluteFill>
      );
    }
    case "light": {
      // يخبو الأول نحو نقطة ضوء، ثم يعود الضوء من النقطة نفسها فينتشر الثاني منها
      const c = at(t.at);
      const R = coverRadius(c.x, c.y, W, H) * 0.6;
      const dim = Math.min(1, p / 0.5);
      const grow = Math.max(0, (p - 0.5) / 0.5);
      const glow = Math.sin(Math.PI * lin);
      const hole = R * (1 - dim) ** 1.5;
      // الكشف ينتهي وقد غطى الإطار كله (فلا قفزة عند نهاية الانتقال)
      const Rc = R / 0.6;
      const mask = `radial-gradient(circle at ${c.x}px ${c.y}px, #000 0, #000 ${Rc * grow}px, transparent ${Rc * grow + Rc * 0.3}px)`;
      return (
        <AbsoluteFill>
          {grow <= 0 ? A({}) : null}
          {grow <= 0 ? (
            <div style={{ ...layer, background: `radial-gradient(circle at ${c.x}px ${c.y}px, transparent 0, transparent ${hole * 0.6}px, ${colors.bg} ${Math.max(1, hole)}px)`, opacity: dim }} />
          ) : (
            <>
              <div style={{ ...layer, background: colors.bg }} />
              {B({ maskImage: mask, WebkitMaskImage: mask } as React.CSSProperties)}
            </>
          )}
          <div
            style={{
              ...layer,
              background: `radial-gradient(circle at ${c.x}px ${c.y}px, ${colors.light} 0, transparent ${Math.min(W, H) * (0.18 + 0.3 * grow)}px)`,
              opacity: 0.55 * glow,
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      );
    }
    default:
      return <>{children}</>;
  }
};
