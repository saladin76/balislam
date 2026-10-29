import React from "react";
import type { ElementDef, ElementPalette } from "../types";

/**
 * الخلفيات: تُرسم بمقاس المشهد (1920×1080 أو 1080×1920) خلف الشخصيات والنص.
 * هادئة ومنخفضة التباين، والوسط فارغ قدر الإمكان، والتفاصيل عند الحواف والأسفل.
 * الألوان كلها مشتقة من لوحة الثيم بخلطها مع لون الخلفية (mix) فلا تتراكب الشفافيات.
 * في ثيم «حبر وورق» تُرسم بخطوط حبر رفيعة شفافة كأنها كراسة رسم.
 */

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const mixHex = (a: string, b: string, t: number) => {
  const A = rgb(a);
  const B = rgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i]! - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

/** مولد عشوائي ثابت البذرة: نفس الرسم في كل تصيير. */
const rng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type Ctx = ReturnType<typeof ctx>;

const ctx = (p: ElementPalette, w: number, h: number, name: string) => {
  const k = Math.min(w, h) / 1080;
  const line = p.style === "line";
  const portrait = h > w;
  const darkBg = lum(p.bg) < 0.4;
  /** لون مخلوط مع الخلفية بنسبة t */
  const m = (col: string, t: number) => mixHex(p.bg, col, t);
  /** خصائص شكل مملوء: مسطح = لون مخلوط، خطي = تعبئة ورقية وحد حبر شفاف */
  const F = (col: string, t: number, lineFill?: string) =>
    line
      ? {
          fill: lineFill ?? p.bg,
          stroke: p.edge,
          strokeOpacity: 0.3,
          strokeWidth: 3.5 * k,
          strokeLinejoin: "round" as const,
          strokeLinecap: "round" as const,
        }
      : { fill: m(col, t) };
  /** خط تفصيل فوق الخلفية */
  const Ln = (t: number, sw = 3.5) => ({
    fill: "none",
    stroke: line ? p.edge : m(p.edge, t),
    strokeOpacity: line ? 0.3 : 1,
    strokeWidth: sw * k,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  });
  /** تعبئة خفيفة بالنعناعي في الخطي للتمييز */
  const mint = line ? mixHex(p.bg, p.second, 0.35) : undefined;
  const uid = (s: string) => `${name}-${s}-${p.themeId}-${w}`;
  return { p, w, h, k, line, portrait, darkBg, m, F, Ln, mint, uid };
};

const Base = ({ c }: { c: Ctx }) => <rect x={0} y={0} width={c.w} height={c.h} fill={c.p.bg} />;

/** سماء متدرجة من الأعلى إلى خط الأفق */
const Sky = ({ c, to, top, bottom, tTop, tBottom }: { c: Ctx; to: number; top: string; bottom: string; tTop: number; tBottom: number }) => {
  if (c.line) return null;
  const id = c.uid("sky");
  return (
    <>
      <defs>
        <linearGradient id={id} x1={0} y1={0} x2={0} y2={1}>
          <stop offset="0" stopColor={c.m(top, tTop)} />
          <stop offset="1" stopColor={c.m(bottom, tBottom)} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={c.w} height={to} fill={`url(#${id})`} />
    </>
  );
};

/** نجوم موزعة بعيدًا عن الوسط */
const Stars = ({ c, n, seed, maxY }: { c: Ctx; n: number; seed: number; maxY: number }) => {
  const r = rng(seed);
  const out: React.ReactNode[] = [];
  const col = c.line ? c.p.edge : c.darkBg ? c.p.light : c.m(c.p.metal, 0.55);
  for (let i = 0; i < n; i++) {
    const x = r() * c.w;
    const y = r() * maxY;
    const size = (1.5 + r() * 3.5) * c.k;
    const dx = (x - c.w / 2) / (c.w * 0.32);
    const dy = (y - c.h * 0.48) / (c.h * 0.3);
    const quiet = dx * dx + dy * dy < 1;
    const op = (quiet ? 0.25 : 0.85) * (0.4 + r() * 0.6) * (c.line ? 0.5 : 1);
    if (size > 4 * c.k && !quiet) {
      const s = size * 2.4;
      out.push(
        <path
          key={i}
          d={`M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`}
          fill={c.line ? "none" : col}
          stroke={c.line ? col : "none"}
          strokeWidth={2.5 * c.k}
          opacity={op}
        />,
      );
    } else out.push(<circle key={i} cx={x} cy={y} r={size} fill={col} opacity={op} />);
  }
  return <>{out}</>;
};

/** هلال مفتوح لليمين */
const Crescent = ({ c, cx, cy, r }: { c: Ctx; cx: number; cy: number; r: number }) => (
  <g transform={`rotate(-25 ${cx} ${cy})`}>
    {c.darkBg && !c.line && <circle cx={cx} cy={cy} r={r * 1.9} fill={c.m(c.p.metal, 0.07)} />}
    <path
      d={`M${cx} ${cy - r} A${r} ${r} 0 1 0 ${cx} ${cy + r} A${r * 0.7} ${r} 0 1 1 ${cx} ${cy - r} Z`}
      {...(c.line ? { fill: c.mint, stroke: c.p.edge, strokeOpacity: 0.4, strokeWidth: 3.5 * c.k } : { fill: c.m(c.p.metal, c.darkBg ? 0.85 : 0.5) })}
    />
  </g>
);

/** خط متموج يملأ ما تحته حتى أسفل المشهد */
const wave = (c: Ctx, y0: number, amp: number, len: number, phase: number, extra?: (x: number) => number) => {
  const pts: string[] = [];
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * c.w;
    const y = y0 + amp * Math.sin((x / len) * Math.PI * 2 + phase) + (extra ? extra(x) : 0);
    pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M0 ${c.h} L${pts.join(" L")} L${c.w} ${c.h} Z`;
};

/** نخلة صورة ظلية */
const Palm = ({ c, x, base, s, col, t, flip = false }: { c: Ctx; x: number; base: number; s: number; col: string; t: number; flip?: boolean }) => {
  const f = flip ? -1 : 1;
  const tx = x + f * 40 * s;
  const ty = base - 330 * s;
  const fronds = [-160, -125, -90, -55, -20].map((a, i) => {
    const rad = (a * Math.PI) / 180;
    const L = (150 + (i % 2) * 30) * s;
    const ex = tx + Math.cos(rad) * L;
    const ey = ty + Math.sin(rad) * L * 0.55 + 60 * s;
    const mx = tx + Math.cos(rad) * L * 0.5;
    const my = ty + Math.sin(rad) * L * 0.5 - 20 * s;
    return `M${tx} ${ty} Q${mx} ${my - 22 * s} ${ex} ${ey} Q${mx} ${my + 18 * s} ${tx} ${ty} Z`;
  });
  const fill = c.F(col, t);
  return (
    <>
      <path d={`M${x} ${base} Q${x + f * 6 * s} ${base - 180 * s} ${tx} ${ty}`} fill="none" stroke={c.line ? c.p.edge : c.m(col, t)} strokeOpacity={c.line ? 0.3 : 1} strokeWidth={(c.line ? 3.5 : 18) * (c.line ? c.k : s)} strokeLinecap="round" />
      {c.line && <path d={`M${x + 12 * s} ${base} Q${x + f * 6 * s + 12 * s} ${base - 180 * s} ${tx + 6 * s} ${ty}`} fill="none" stroke={c.p.edge} strokeOpacity={0.3} strokeWidth={3.5 * c.k} />}
      <path d={fronds.join(" ")} {...fill} />
    </>
  );
};

/** شجرة مستديرة */
const Tree = ({ c, x, base, s, t }: { c: Ctx; x: number; base: number; s: number; t: number }) => (
  <>
    <path d={`M${x - 14 * s} ${base} L${x - 8 * s} ${base - 190 * s} H${x + 8 * s} L${x + 14 * s} ${base} Z`} {...c.F(c.p.wood, t + 0.05)} />
    <path
      d={`M${x - 110 * s} ${base - 220 * s} A80 80 0 0 1 ${x - 40 * s} ${base - 340 * s} A95 95 0 0 1 ${x + 70 * s} ${base - 330 * s} A80 80 0 0 1 ${x + 115 * s} ${base - 210 * s} A70 70 0 0 1 ${x + 40 * s} ${base - 150 * s} H${x - 50 * s} A70 70 0 0 1 ${x - 110 * s} ${base - 220 * s} Z`}
      {...c.F(c.p.green, t, c.mint)}
    />
  </>
);

/** أرض الغرفة وإطار الجدار */
const Floor = ({ c, y, t = 0.16 }: { c: Ctx; y: number; t?: number }) => (
  <>
    <rect x={0} y={y} width={c.w} height={c.h - y} {...c.F(c.p.wood, t)} />
    <rect x={-10} y={y - 16 * c.k} width={c.w + 20} height={16 * c.k} {...c.F(c.p.edge, 0.08)} />
  </>
);

const bd = (id: string, nameAr: string, tags: string[], draw: (c: Ctx) => React.ReactNode, note?: string): ElementDef => ({
  id,
  nameAr,
  category: "backdrops",
  kind: "backdrop",
  tags,
  note,
  draw: (p, { w, h }) => {
    const c = ctx(p, w, h, id);
    return (
      <>
        <Base c={c} />
        {draw(c)}
      </>
    );
  },
});

export const elements: ElementDef[] = [
  // ───────────── ورقة على مكتب
  bd("paper-desk", "ورقة ورسوم هامش", ["ورق", "كراسة", "مكتب", "رسم", "دفتر"], (c) => {
    const { w, h, k, m, p, line } = c;
    const mg = (c.portrait ? 60 : 80) * k;
    const sx = mg;
    const sy = mg;
    const sw = w - mg * 2;
    const sh = h - mg * 2;
    const rows: React.ReactNode[] = [];
    for (let y = sy + 150 * k, i = 0; y < sy + sh - 50 * k; y += 72 * k, i++)
      rows.push(<path key={i} d={`M${sx + 30 * k} ${y} H${sx + sw - 30 * k}`} stroke={line ? p.second : m(p.water, 0.3)} strokeOpacity={line ? 0.6 : 1} strokeWidth={2.5 * k} />);
    const ink = { fill: "none", stroke: line ? p.edge : m(p.edge, 0.22), strokeOpacity: line ? 0.35 : 1, strokeWidth: 4 * k, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    // دوامة
    const spx = sx + 120 * k;
    const spy = sy + 95 * k;
    const sp: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const a = i * 0.32;
      const r = (3 + i * 0.75) * k;
      sp.push(`${(spx + r * Math.cos(a)).toFixed(1)} ${(spy + r * Math.sin(a)).toFixed(1)}`);
    }
    // نجمة خماسية
    const stx = sx + sw - 120 * k;
    const sty = sy + 95 * k;
    const st: string[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (-90 + i * 36) * (Math.PI / 180);
      const r = (i % 2 ? 18 : 44) * k;
      st.push(`${(stx + r * Math.cos(a)).toFixed(1)} ${(sty + r * Math.sin(a)).toFixed(1)}`);
    }
    const bx = sx + 110 * k;
    const by = sy + sh - 120 * k;
    const rx = sx + sw - 140 * k;
    const ry = sy + sh - 110 * k;
    return (
      <>
        <rect x={sx + 14 * k} y={sy + 18 * k} width={sw} height={sh} rx={10 * k} fill={m(p.edge, 0.07)} />
        <rect x={sx} y={sy} width={sw} height={sh} rx={10 * k} fill={line ? p.surface : m(p.surface, 0.75)} stroke={line ? p.edge : "none"} strokeOpacity={0.25} strokeWidth={3.5 * k} />
        {rows}
        <path d={`M${sx + sw - 200 * k} ${sy + 20 * k} V${sy + sh - 20 * k}`} stroke={line ? p.accent : m(p.main, 0.3)} strokeOpacity={line ? 0.35 : 1} strokeWidth={3 * k} />
        <path d={`M${sp.join(" L")}`} {...ink} />
        <path d={`M${st.join(" L")} Z`} {...ink} fill={line ? c.mint : m(p.metal, 0.2)} />
        <path d={`M${bx} ${by} Q${bx + 60 * k} ${by - 70 * k} ${bx + 150 * k} ${by - 30 * k} M${bx + 150 * k} ${by - 30 * k} l${-34 * k} ${-14 * k} M${bx + 150 * k} ${by - 30 * k} l${-20 * k} ${28 * k}`} {...ink} />
        <path d={`M${bx - 30 * k} ${by + 50 * k} q${25 * k} ${-25 * k} ${50 * k} 0 t${50 * k} 0 t${50 * k} 0 t${50 * k} 0`} {...ink} />
        <circle cx={rx} cy={ry} r={30 * k} {...ink} />
        <path d={`M${rx} ${ry - 30 * k} V${ry - 60 * k} M${rx + 30 * k} ${ry} H${rx + 60 * k} M${rx - 30 * k} ${ry} H${rx - 60 * k} M${rx} ${ry + 30 * k} V${ry + 60 * k} M${rx + 21 * k} ${ry - 21 * k} l${21 * k} ${-21 * k} M${rx - 21 * k} ${ry - 21 * k} l${-21 * k} ${-21 * k} M${rx + 21 * k} ${ry + 21 * k} l${21 * k} ${21 * k} M${rx - 21 * k} ${ry + 21 * k} l${-21 * k} ${21 * k}`} {...ink} />
        <path d={`M${sx + 60 * k} ${sy + sh * 0.5} q${-24 * k} ${40 * k} 0 ${80 * k} q${24 * k} ${40 * k} 0 ${80 * k}`} {...ink} opacity={0.7} />
      </>
    );
  }),

  // ───────────── غرفة جلوس
  bd("room-living", "غرفة جلوس", ["بيت", "غرفة", "أريكة", "صالة", "أسرة"], (c) => {
    const { w, h, k, p, F, Ln, portrait } = c;
    const fy = h * 0.78;
    const wx = portrait ? 70 * k : w * 0.07;
    const wy = h * (portrait ? 0.1 : 0.16);
    const ww = 300 * k;
    const wh = 400 * k;
    const sofaW = Math.min(660 * k, w * 0.62);
    const sx = w - sofaW - (portrait ? 50 * k : w * 0.07);
    const base = fy + 50 * k;
    const lx = portrait ? 150 * k : sx - 120 * k;
    return (
      <>
        <Floor c={c} y={fy} />
        <ellipse cx={w / 2} cy={fy + (h - fy) * 0.55} rx={w * (portrait ? 0.42 : 0.3)} ry={(h - fy) * 0.25} {...F(p.second, 0.14, c.mint)} />
        {/* نافذة بستائر */}
        <rect x={wx} y={wy} width={ww} height={wh} rx={8 * k} {...F(p.water, 0.2, p.surface)} />
        <path d={`M${wx + ww / 2} ${wy} V${wy + wh} M${wx} ${wy + wh * 0.45} H${wx + ww}`} {...Ln(0.15, 8)} />
        <path d={`M${wx - 40 * k} ${wy - 30 * k} H${wx + ww + 40 * k}`} {...Ln(0.25, 6)} />
        <path d={`M${wx - 40 * k} ${wy - 30 * k} H${wx + 40 * k} Q${wx + 10 * k} ${wy + wh * 0.5} ${wx + 30 * k} ${wy + wh + 40 * k} H${wx - 40 * k} Z`} {...F(p.main, 0.2)} />
        <path d={`M${wx + ww + 40 * k} ${wy - 30 * k} H${wx + ww - 40 * k} Q${wx + ww - 10 * k} ${wy + wh * 0.5} ${wx + ww - 30 * k} ${wy + wh + 40 * k} H${wx + ww + 40 * k} Z`} {...F(p.main, 0.2)} />
        {/* إطار صورة فارغ */}
        {!portrait && <rect x={sx + sofaW * 0.36} y={base - 600 * k} width={200 * k} height={150 * k} rx={6 * k} {...F(p.metal, 0.18, p.surface)} />}
        {/* أريكة */}
        <rect x={sx + 40 * k} y={base - 300 * k} width={sofaW - 80 * k} height={200 * k} rx={40 * k} {...F(p.main, 0.24)} />
        <rect x={sx + 50 * k} y={base - 150 * k} width={sofaW - 100 * k} height={100 * k} rx={24 * k} {...F(p.main, 0.3)} />
        <rect x={sx} y={base - 210 * k} width={100 * k} height={190 * k} rx={40 * k} {...F(p.main, 0.34)} />
        <rect x={sx + sofaW - 100 * k} y={base - 210 * k} width={100 * k} height={190 * k} rx={40 * k} {...F(p.main, 0.34)} />
        <rect x={sx + 120 * k} y={base - 250 * k} width={130 * k} height={100 * k} rx={26 * k} {...F(p.second, 0.3, c.mint)} />
        <path d={`M${sx + 30 * k} ${base - 20 * k} v${22 * k} M${sx + sofaW - 30 * k} ${base - 20 * k} v${22 * k}`} {...Ln(0.3, 10)} />
        {/* مصباح أرضي */}
        <path d={`M${lx} ${base} V${base - 470 * k}`} {...Ln(0.25, 8)} />
        <ellipse cx={lx} cy={base} rx={50 * k} ry={12 * k} {...F(p.edge, 0.2)} />
        <path d={`M${lx - 70 * k} ${base - 420 * k} L${lx - 45 * k} ${base - 540 * k} H${lx + 45 * k} L${lx + 70 * k} ${base - 420 * k} Z`} {...F(p.metal, 0.35, c.mint)} />
      </>
    );
  }),

  // ───────────── غرفة أطفال
  bd("room-kids", "غرفة أطفال", ["أطفال", "غرفة", "ألعاب", "طفل", "تربية"], (c) => {
    const { w, h, k, p, F, Ln, m, line, portrait } = c;
    const fy = h * 0.8;
    const cols = [p.main, p.second, p.metal];
    const y0 = h * 0.07;
    const sag = 70 * k;
    const flags: React.ReactNode[] = [];
    const n = Math.round(w / (120 * k));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = t * w;
      const y = y0 + 4 * sag * t * (1 - t);
      const fw = 34 * k;
      flags.push(<path key={i} d={`M${x - fw} ${y} L${x + fw} ${y} L${x} ${y + 70 * k} Z`} {...F(cols[i % 3]!, 0.32, i % 3 === 1 ? c.mint : p.bg)} />);
    }
    const bedW = Math.min(560 * k, w * 0.5);
    const bx = w - bedW - (portrait ? 30 * k : w * 0.06);
    const bb = fy + 60 * k;
    const tx = portrait ? 60 * k : w * 0.08;
    const blocks = [
      [tx, bb - 90 * k],
      [tx + 92 * k, bb - 90 * k],
      [tx + 46 * k, bb - 180 * k],
    ];
    const deco: React.ReactNode[] = [];
    const r = rng(77);
    for (let i = 0; i < 10; i++) {
      const left = i % 2 === 0;
      const x = left ? r() * w * 0.16 + 30 * k : w - r() * w * 0.16 - 30 * k;
      const y = h * (0.22 + r() * 0.36);
      const s = (14 + r() * 10) * k;
      deco.push(<path key={i} d={`M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`} {...F(p.metal, 0.3, c.mint)} />);
    }
    return (
      <>
        <Floor c={c} y={fy} t={0.14} />
        <path d={`M0 ${y0} Q${w / 2} ${y0 + 2 * sag} ${w} ${y0}`} {...Ln(0.3, 4)} />
        {flags}
        {deco}
        <ellipse cx={w * 0.5} cy={fy + (h - fy) * 0.55} rx={w * 0.3} ry={(h - fy) * 0.24} {...F(p.second, 0.16, c.mint)} />
        {/* سرير */}
        <path d={`M${bx + bedW - 30 * k} ${bb} V${bb - 330 * k} Q${bx + bedW - 30 * k} ${bb - 380 * k} ${bx + bedW - 80 * k} ${bb - 380 * k} Q${bx + bedW - 130 * k} ${bb - 380 * k} ${bx + bedW - 130 * k} ${bb - 330 * k} V${bb} Z`} {...F(p.wood, 0.3)} />
        <rect x={bx} y={bb - 170 * k} width={bedW - 100 * k} height={120 * k} rx={18 * k} {...F(p.surface, 0.6, p.surface)} />
        <rect x={bx} y={bb - 150 * k} width={bedW - 220 * k} height={100 * k} rx={18 * k} {...F(p.main, 0.26)} />
        <rect x={bx + bedW - 250 * k} y={bb - 210 * k} width={110 * k} height={60 * k} rx={22 * k} {...F(p.second, 0.3, c.mint)} />
        <path d={`M${bx + 20 * k} ${bb - 50 * k} V${bb}`} {...Ln(0.3, 12)} />
        {/* مكعبات وكرة */}
        {blocks.map(([x, y], i) => (
          <rect key={i} x={x} y={y} width={86 * k} height={86 * k} rx={10 * k} {...F(cols[i % 3]!, 0.32, i === 1 ? c.mint : p.bg)} />
        ))}
        <circle cx={tx + 260 * k} cy={bb - 60 * k} r={60 * k} {...F(p.main, 0.3)} />
        <path d={`M${tx + 200 * k} ${bb - 60 * k} Q${tx + 260 * k} ${bb - 100 * k} ${tx + 320 * k} ${bb - 60 * k}`} fill="none" stroke={line ? p.edge : m(p.surface, 0.8)} strokeOpacity={line ? 0.3 : 1} strokeWidth={10 * k} />
      </>
    );
  }),

  // ───────────── مطبخ
  bd("kitchen", "مطبخ", ["مطبخ", "بيت", "طعام", "طبخ", "أسرة"], (c) => {
    const { w, h, k, p, F, Ln, portrait } = c;
    const top = h * 0.04;
    const ch = (portrait ? 300 : 250) * k;
    const n = Math.max(3, Math.round(w / (250 * k)));
    const dw = w / n;
    const cy = h * 0.74;
    const upper: React.ReactNode[] = [];
    const lower: React.ReactNode[] = [];
    for (let i = 0; i < n; i++) {
      const x = i * dw;
      upper.push(
        <g key={i}>
          <rect x={x + 8 * k} y={top} width={dw - 16 * k} height={ch} rx={10 * k} {...F(p.wood, 0.18, p.surface)} />
          <rect x={x + 30 * k} y={top + 24 * k} width={dw - 60 * k} height={ch - 48 * k} rx={8 * k} {...F(p.wood, 0.13)} />
          <path d={`M${x + (i % 2 ? 50 * k : dw - 50 * k)} ${top + ch - 80 * k} v${40 * k}`} {...Ln(0.35, 8)} />
        </g>,
      );
      lower.push(
        <g key={i}>
          <rect x={x + 8 * k} y={cy + 40 * k} width={dw - 16 * k} height={h - cy} rx={10 * k} {...F(p.wood, 0.22, p.surface)} />
          <path d={`M${x + dw / 2 - 30 * k} ${cy + 90 * k} h${60 * k}`} {...Ln(0.35, 8)} />
        </g>,
      );
    }
    const tiles: string[] = [];
    const tile = 70 * k;
    for (let r = 1; r <= 2; r++) tiles.push(`M0 ${cy - r * tile} H${w}`);
    for (let x = 0; x < w; x += tile) tiles.push(`M${x} ${cy} V${cy - 2 * tile}`);
    const px = portrait ? 120 * k : w * 0.12;
    const jx = w - (portrait ? 140 * k : w * 0.12);
    return (
      <>
        {upper}
        <path d={tiles.join(" ")} {...Ln(0.07, 2.5)} />
        {lower}
        <rect x={-10} y={cy} width={w + 20} height={40 * k} {...F(p.edge, 0.14, p.surface)} />
        {/* قدر */}
        <rect x={px - 110 * k} y={cy - 130 * k} width={220 * k} height={130 * k} rx={18 * k} {...F(p.main, 0.3)} />
        <path d={`M${px - 120 * k} ${cy - 130 * k} H${px + 120 * k}`} {...Ln(0.35, 10)} />
        <path d={`M${px - 30 * k} ${cy - 150 * k} H${px + 30 * k} M${px - 110 * k} ${cy - 90 * k} h${-30 * k} M${px + 110 * k} ${cy - 90 * k} h${30 * k}`} {...Ln(0.35, 12)} />
        {/* برطمانات */}
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x={jx - 150 * k + i * 100 * k} y={cy - (110 + (i % 2) * 40) * k} width={80 * k} height={(110 + (i % 2) * 40) * k} rx={16 * k} {...F(i === 1 ? p.second : p.metal, 0.3, i === 1 ? c.mint : p.bg)} />
            <rect x={jx - 140 * k + i * 100 * k} y={cy - (130 + (i % 2) * 40) * k} width={60 * k} height={22 * k} rx={6 * k} {...F(p.wood, 0.35)} />
          </g>
        ))}
      </>
    );
  }),

  // ───────────── سماء ليل
  bd("night-sky", "سماء ليلية بهلال", ["ليل", "سماء", "نجوم", "هلال", "تأمل", "رمضان"], (c) => {
    const { w, h, k, p, F, portrait } = c;
    const hy = h * 0.82;
    return (
      <>
        <Sky c={c} to={h} top={p.dark} bottom={p.water} tTop={c.darkBg ? 0 : 0.1} tBottom={c.darkBg ? 0.28 : 0.12} />
        <Stars c={c} n={portrait ? 110 : 140} seed={11} maxY={hy} />
        <Crescent c={c} cx={w * (portrait ? 0.74 : 0.84)} cy={h * (portrait ? 0.12 : 0.18)} r={70 * k} />
        <path d={wave(c, hy, 30 * k, w * 0.8, 0.5)} {...F(p.dark, c.darkBg ? 0.35 : 0.12)} />
        <path d={wave(c, hy + 70 * k, 24 * k, w * 0.55, 2.2)} {...F(p.dark, c.darkBg ? 0.55 : 0.2, p.surface)} />
      </>
    );
  }),

  // ───────────── مدينة ليلًا
  bd("city-night", "مدينة ليلًا", ["مدينة", "ليل", "مباني", "دنيا", "عمل", "مال"], (c) => {
    const { w, h, k, p, m, F, line, darkBg, portrait } = c;
    const r = rng(23);
    const back: React.ReactNode[] = [];
    const front: React.ReactNode[] = [];
    const lit = line ? c.mint! : darkBg ? m(p.accent, 0.7) : m(p.metal, 0.45);
    // طبقة خلفية مع مئذنة وقبة
    let x = -20 * k;
    let i = 0;
    const domeAt = w * (portrait ? 0.3 : 0.24);
    while (x < w) {
      const bw = (110 + r() * 120) * k;
      const bh = (260 + r() * 240) * k;
      if (x < domeAt && x + bw > domeAt) {
        back.push(
          <g key={`d${i}`}>
            <rect x={x} y={h - 230 * k} width={bw + 160 * k} height={230 * k} {...F(p.dark, darkBg ? 0.42 : 0.12)} />
            <path d={`M${x + 40 * k} ${h - 230 * k} Q${x + 40 * k} ${h - 400 * k} ${x + 120 * k} ${h - 420 * k} Q${x + 200 * k} ${h - 400 * k} ${x + 200 * k} ${h - 230 * k} Z`} {...F(p.dark, darkBg ? 0.42 : 0.12)} />
            <rect x={x + bw + 100 * k} y={h - 560 * k} width={36 * k} height={330 * k} {...F(p.dark, darkBg ? 0.42 : 0.12)} />
            <path d={`M${x + bw + 92 * k} ${h - 560 * k} L${x + bw + 118 * k} ${h - 630 * k} L${x + bw + 144 * k} ${h - 560 * k} Z`} {...F(p.dark, darkBg ? 0.42 : 0.12)} />
          </g>,
        );
        x += bw + 160 * k;
      } else {
        back.push(<rect key={i} x={x} y={h - bh} width={bw} height={bh} {...F(p.dark, darkBg ? 0.42 : 0.12)} />);
        x += bw + r() * 30 * k;
      }
      i++;
    }
    x = -30 * k;
    while (x < w) {
      const bw = (130 + r() * 140) * k;
      const bh = (150 + r() * 200) * k;
      const by = h - bh;
      front.push(<rect key={`f${i}`} x={x} y={by} width={bw} height={bh} {...F(p.dark, darkBg ? 0.55 : 0.22, p.surface)} />);
      for (let wy = by + 30 * k; wy < h - 30 * k; wy += 52 * k)
        for (let wx = x + 22 * k; wx < x + bw - 30 * k; wx += 40 * k)
          if (r() < 0.32) front.push(<rect key={`w${i}-${wx}-${wy}`} x={wx} y={wy} width={16 * k} height={24 * k} rx={2 * k} fill={lit} stroke={line ? p.edge : "none"} strokeOpacity={0.3} strokeWidth={2 * k} />);
      x += bw + r() * 20 * k;
      i++;
    }
    return (
      <>
        <Sky c={c} to={h} top={p.dark} bottom={p.water} tTop={darkBg ? 0 : 0.1} tBottom={darkBg ? 0.3 : 0.14} />
        <Stars c={c} n={portrait ? 60 : 80} seed={5} maxY={h * 0.55} />
        <Crescent c={c} cx={w * (portrait ? 0.78 : 0.86)} cy={h * (portrait ? 0.1 : 0.16)} r={56 * k} />
        {back}
        {front}
      </>
    );
  }),

  // ───────────── صحراء ليلًا
  bd("desert-night", "صحراء ليلًا", ["صحراء", "ليل", "نجوم", "رمال", "سفر", "تأمل"], (c) => {
    const { w, h, k, p, F, darkBg, portrait } = c;
    const hy = h * 0.74;
    return (
      <>
        <Sky c={c} to={h} top={p.dark} bottom={p.water} tTop={darkBg ? 0 : 0.1} tBottom={darkBg ? 0.3 : 0.12} />
        <Stars c={c} n={portrait ? 120 : 150} seed={31} maxY={hy} />
        <Crescent c={c} cx={w * (portrait ? 0.24 : 0.16)} cy={h * (portrait ? 0.12 : 0.2)} r={64 * k} />
        <path d={wave(c, hy, 34 * k, w * 0.9, 1.2)} {...F(p.metal, darkBg ? 0.16 : 0.18)} />
        <path d={wave(c, hy + 80 * k, 44 * k, w * 1.3, 3.4)} {...F(p.metal, darkBg ? 0.24 : 0.26, p.surface)} />
        <path d={wave(c, hy + 190 * k, 30 * k, w * 0.7, 0.2)} {...F(p.metal, darkBg ? 0.32 : 0.34)} />
        <Palm c={c} x={w - (portrait ? 120 : 200) * k} base={hy + 120 * k} s={0.9 * k} col={p.dark} t={darkBg ? 0.6 : 0.3} />
        <Palm c={c} x={w - (portrait ? 40 : 90) * k} base={hy + 140 * k} s={0.7 * k} col={p.dark} t={darkBg ? 0.6 : 0.3} flip />
      </>
    );
  }),

  // ───────────── صحراء نهارًا
  bd("desert-day", "صحراء نهارًا", ["صحراء", "نهار", "رمال", "واحة", "نخيل", "سفر"], (c) => {
    const { w, h, k, p, m, F, line, darkBg, portrait } = c;
    const hy = h * 0.66;
    const sx = w * (portrait ? 0.72 : 0.8);
    const sy = h * (portrait ? 0.13 : 0.2);
    return (
      <>
        <Sky c={c} to={hy + 60 * k} top={p.water} bottom={p.metal} tTop={darkBg ? 0.12 : 0.16} tBottom={0.1} />
        <circle cx={sx} cy={sy} r={150 * k} fill={line ? "none" : m(p.metal, 0.1)} />
        <circle cx={sx} cy={sy} r={90 * k} {...F(p.metal, darkBg ? 0.5 : 0.35, c.mint)} />
        <path d={wave(c, hy, 26 * k, w * 1.1, 0.4)} {...F(p.metal, 0.16)} />
        <path d={wave(c, hy + 110 * k, 50 * k, w * 1.4, 2.6)} {...F(p.metal, 0.24, p.surface)} />
        <path d={wave(c, hy + 260 * k, 34 * k, w * 0.8, 4.4)} {...F(p.metal, 0.32)} />
        <Palm c={c} x={(portrait ? 130 : 180) * k} base={hy + 150 * k} s={1 * k} col={p.green} t={0.4} flip />
        <Palm c={c} x={(portrait ? 50 : 80) * k} base={hy + 170 * k} s={0.75 * k} col={p.green} t={0.45} />
        <ellipse cx={(portrait ? 120 : 160) * k} cy={hy + 175 * k} rx={170 * k} ry={22 * k} {...F(p.water, 0.3, c.mint)} />
      </>
    );
  }),

  // ───────────── رواق أقواس
  bd("courtyard-arches", "رواق أقواس", ["أقواس", "رواق", "فناء", "مسجد", "تاريخ", "حضارة"], (c) => {
    const { w, h, k, p, m, F, Ln, line, portrait } = c;
    const pitch = portrait ? w * 0.72 : w * 0.3;
    const ow = pitch * 0.74;
    const spring = h * (portrait ? 0.36 : 0.4);
    const fy = h * 0.86;
    const rise = ow * 0.62;
    const holes: string[] = [];
    const outlines: string[] = [];
    const caps: React.ReactNode[] = [];
    for (let i = -3; i <= 3; i++) {
      const cx = w / 2 + i * pitch;
      const x0 = cx - ow / 2;
      const x1 = cx + ow / 2;
      if (x1 < -pitch || x0 > w + pitch) continue;
      holes.push(`M${x0} ${fy} V${spring} Q${x0} ${spring - rise * 0.75} ${cx} ${spring - rise} Q${x1} ${spring - rise * 0.75} ${x1} ${spring} V${fy} Z`);
      const g = 26 * k;
      outlines.push(`M${x0 - g} ${spring} Q${x0 - g} ${spring - rise * 0.75 - g} ${cx} ${spring - rise - g * 1.4} Q${x1 + g} ${spring - rise * 0.75 - g} ${x1 + g} ${spring}`);
      caps.push(<rect key={i} x={x0 - 18 * k} y={spring - 8 * k} width={36 * k} height={22 * k} {...F(p.metal, 0.4, c.mint)} />);
      caps.push(<rect key={`r${i}`} x={x1 - 18 * k} y={spring - 8 * k} width={36 * k} height={22 * k} {...F(p.metal, 0.4, c.mint)} />);
    }
    const frieze: string[] = [];
    const fyy = h * 0.06;
    for (let x = 0; x < w + 40 * k; x += 60 * k) frieze.push(`M${x} ${fyy} l${30 * k} ${-20 * k} l${30 * k} ${20 * k} l${-30 * k} ${20 * k} Z`);
    const tiles: string[] = [];
    for (let i = -12; i <= 12; i++) tiles.push(`M${w / 2 + i * 60 * k} ${fy} L${w / 2 + i * 260 * k} ${h}`);
    for (let j = 1; j <= 3; j++) {
      const y = fy + (h - fy) * (j / 4) ** 1.3;
      tiles.push(`M0 ${y} H${w}`);
    }
    return (
      <>
        {/* منظر الفناء خلف الأقواس */}
        <rect x={0} y={0} width={w} height={h} fill={line ? p.bg : m(p.surface, 0.5)} />
        <path d={wave(c, fy - 90 * k, 16 * k, w * 0.25, 1)} {...F(p.green, 0.2, c.mint)} />
        <rect x={0} y={fy - 40 * k} width={w} height={h} {...F(p.wood, 0.14)} />
        {/* الجدار بالفتحات */}
        <path d={`M0 0 H${w} V${fy} H0 Z ${holes.join(" ")}`} fillRule="evenodd" {...F(p.main, 0.16, p.surface)} />
        <path d={outlines.join(" ")} {...Ln(0.14, 5)} />
        {caps}
        <path d={frieze.join(" ")} {...F(p.metal, 0.3, c.mint)} />
        <path d={`M0 ${fyy + 40 * k} H${w}`} {...Ln(0.14, 4)} />
        {/* أرضية */}
        <rect x={0} y={fy} width={w} height={h - fy} {...F(p.main, 0.1)} />
        <path d={tiles.join(" ")} {...Ln(0.08, 3)} />
      </>
    );
  }),

  // ───────────── قاعة مكتبة
  bd("library-hall", "قاعة مكتبة", ["مكتبة", "كتب", "علم", "قراءة", "تاريخ"], (c) => {
    const { w, h, k, p, F, Ln, portrait } = c;
    const sw = portrait ? w * 0.26 : w * 0.2;
    const top = h * 0.05;
    const fy = h * 0.9;
    const shelfH = 210 * k;
    const cols = [p.main, p.second, p.metal, p.accent, p.wood];
    const r = rng(41);
    const caseAt = (x0: number, key: string) => {
      const items: React.ReactNode[] = [<rect key={`${key}c`} x={x0} y={top} width={sw} height={fy - top} {...F(p.wood, 0.24)} />];
      for (let y = top + 30 * k, j = 0; y + shelfH < fy - 10 * k; y += shelfH, j++) {
        items.push(<rect key={`${key}i${j}`} x={x0 + 24 * k} y={y} width={sw - 48 * k} height={shelfH - 24 * k} {...F(p.wood, 0.1, p.surface)} />);
        let bx = x0 + 34 * k;
        let b = 0;
        while (bx < x0 + sw - 80 * k) {
          const bw = (26 + r() * 22) * k;
          const bh = (110 + r() * 60) * k;
          const col = cols[Math.floor(r() * cols.length)]!;
          if (r() < 0.08) {
            bx += 30 * k;
            continue;
          }
          items.push(<rect key={`${key}b${j}-${b++}`} x={bx} y={y + shelfH - 24 * k - bh} width={bw} height={bh} rx={4 * k} {...F(col, 0.28, r() < 0.3 ? c.mint : c.p.bg)} />);
          bx += bw + 4 * k;
        }
      }
      return items;
    };
    const tw = portrait ? w * 0.36 : w * 0.24;
    const tx = w / 2 - tw / 2;
    const ty = fy - 30 * k;
    return (
      <>
        <rect x={0} y={fy} width={w} height={h - fy} {...F(p.wood, 0.16)} />
        {caseAt(0, "l")}
        {caseAt(w - sw, "r")}
        {/* قنديل معلق */}
        <path d={`M${w / 2} 0 V${h * 0.07}`} {...Ln(0.25, 4)} />
        <path d={`M${w / 2 - 40 * k} ${h * 0.07} H${w / 2 + 40 * k} L${w / 2 + 24 * k} ${h * 0.07 + 70 * k} H${w / 2 - 24 * k} Z`} {...F(p.metal, 0.4, c.mint)} />
        {/* طاولة قراءة */}
        <rect x={tx} y={ty - 24 * k} width={tw} height={24 * k} rx={6 * k} {...F(p.wood, 0.3)} />
        <path d={`M${tx + 30 * k} ${ty} V${h} M${tx + tw - 30 * k} ${ty} V${h}`} {...Ln(0.25, 14)} />
      </>
    );
  }),

  // ───────────── سوق
  bd("market-street", "شارع سوق", ["سوق", "تجارة", "بيع", "شارع", "مال"], (c) => {
    const { w, h, k, p, F, Ln, portrait } = c;
    const gy = h * 0.82;
    const r = rng(9);
    const houses: React.ReactNode[] = [];
    let x = -40 * k;
    let i = 0;
    while (x < w) {
      const hw = (220 + r() * 160) * k;
      const hh = (300 + r() * 200) * k;
      houses.push(<rect key={i} x={x} y={gy - hh} width={hw} height={hh} {...F(p.edge, 0.06)} />);
      houses.push(<path key={`d${i}`} d={`M${x + hw / 2 - 40 * k} ${gy} V${gy - 100 * k} A40 40 0 0 1 ${x + hw / 2 + 40 * k} ${gy - 100 * k} V${gy} Z`} {...F(p.edge, 0.1)} />);
      x += hw + 6 * k;
      i++;
    }
    const stall = (sx: number, sw: number, key: string, ci: number) => {
      const top = gy - 470 * k;
      const stripes: React.ReactNode[] = [];
      const ns = 6;
      const st = sw / ns;
      for (let j = 0; j < ns; j++) {
        stripes.push(
          <path
            key={`${key}s${j}`}
            d={`M${sx + j * st} ${top} H${sx + (j + 1) * st} V${top + 70 * k} A${st / 2} ${st / 2.6} 0 0 1 ${sx + j * st} ${top + 70 * k} Z`}
            {...F(j % 2 ? p.surface : ci ? p.second : p.main, j % 2 ? 0.7 : 0.32, j % 2 ? p.bg : c.mint)}
          />,
        );
      }
      const fruits: React.ReactNode[] = [];
      const cy = gy - 190 * k;
      for (let j = 0; j < 7; j++) fruits.push(<circle key={`${key}f${j}`} cx={sx + 50 * k + j * ((sw - 100 * k) / 6)} cy={cy - 24 * k} r={26 * k} {...F(j % 3 === 0 ? p.metal : ci ? p.main : p.second, 0.36, c.mint)} />);
      for (let j = 0; j < 5; j++) fruits.push(<circle key={`${key}g${j}`} cx={sx + 90 * k + j * ((sw - 180 * k) / 4)} cy={cy - 62 * k} r={24 * k} {...F(j % 2 ? p.metal : p.accent, 0.3)} />);
      return (
        <g key={key}>
          <path d={`M${sx + 20 * k} ${gy} V${top} M${sx + sw - 20 * k} ${gy} V${top}`} {...Ln(0.3, 12)} />
          {fruits}
          <rect x={sx} y={cy} width={sw} height={gy - cy} rx={8 * k} {...F(p.wood, 0.3)} />
          <path d={`M${sx + 20 * k} ${cy + 60 * k} H${sx + sw - 20 * k} M${sx + 20 * k} ${cy + 120 * k} H${sx + sw - 20 * k}`} {...Ln(0.15, 4)} />
          {stripes}
        </g>
      );
    };
    const sw = portrait ? 380 * k : 460 * k;
    const lights: React.ReactNode[] = [];
    const ly = h * 0.06;
    const sag = 80 * k;
    for (let j = 1; j < 14; j++) {
      const t = j / 14;
      lights.push(<circle key={j} cx={t * w} cy={ly + 4 * sag * t * (1 - t) + 14 * k} r={10 * k} {...F(p.metal, 0.6, c.mint)} />);
    }
    return (
      <>
        {houses}
        <rect x={0} y={gy} width={w} height={h - gy} {...F(p.wood, 0.14)} />
        <path d={`M0 ${gy + (h - gy) * 0.45} H${w}`} {...Ln(0.07, 3)} />
        <path d={`M0 ${ly} Q${w / 2} ${ly + 2 * sag} ${w} ${ly}`} {...Ln(0.25, 3)} />
        {lights}
        {stall(portrait ? -40 * k : w * 0.03, sw, "a", 0)}
        {stall(w - sw - (portrait ? -40 * k : w * 0.03), sw, "b", 1)}
      </>
    );
  }),

  // ───────────── حديقة
  bd("garden", "حديقة", ["حديقة", "شجر", "عشب", "طبيعة", "نزهة"], (c) => {
    const { w, h, k, p, F, darkBg, portrait } = c;
    const gy = h * 0.76;
    const r = rng(3);
    const flowers: React.ReactNode[] = [];
    for (let i = 0; i < 36; i++) {
      const left = i % 2 === 0;
      const x = left ? r() * w * 0.3 : w - r() * w * 0.3;
      const y = gy + 40 * k + r() * (h - gy - 60 * k);
      const col = [p.main, p.metal, p.second][i % 3]!;
      flowers.push(<circle key={i} cx={x} cy={y} r={(8 + r() * 6) * k} {...F(col, 0.45, c.mint)} />);
    }
    const cloud = (x: number, y: number, s: number, key: string) => (
      <path key={key} d={`M${x} ${y} a${40 * s} ${40 * s} 0 0 1 ${70 * s} ${-30 * s} a${55 * s} ${55 * s} 0 0 1 ${100 * s} ${10 * s} a${35 * s} ${35 * s} 0 0 1 ${20 * s} ${20 * s} Z`} {...F(darkBg ? p.light : p.surface, darkBg ? 0.08 : 0.7, p.surface)} />
    );
    return (
      <>
        <Sky c={c} to={gy} top={p.water} bottom={p.bg} tTop={0.2} tBottom={0} />
        {cloud(w * 0.06, h * 0.16, 1.4 * k, "c1")}
        {cloud(w * (portrait ? 0.6 : 0.78), h * 0.1, 1.1 * k, "c2")}
        <path d={wave(c, gy - 80 * k, 22 * k, w * 0.18, 0.5)} {...F(p.green, 0.14, c.mint)} />
        <Tree c={c} x={portrait ? 80 * k : w * 0.08} base={gy + 30 * k} s={1.5 * k} t={0.3} />
        <Tree c={c} x={w - (portrait ? 90 * k : w * 0.09)} base={gy + 40 * k} s={1.3 * k} t={0.3} />
        {!portrait && <Tree c={c} x={w * 0.2} base={gy} s={0.9 * k} t={0.22} />}
        <path d={wave(c, gy, 12 * k, w * 0.5, 2)} {...F(p.green, 0.22, p.surface)} />
        <path d={`M${w / 2 - 40 * k} ${gy + 8 * k} L${w / 2 + 40 * k} ${gy + 8 * k} L${w / 2 + w * 0.22} ${h} L${w / 2 - w * 0.22} ${h} Z`} {...F(p.wood, 0.14)} />
        {flowers}
      </>
    );
  }),

  // ───────────── فصل دراسي
  bd("classroom", "فصل دراسي", ["فصل", "مدرسة", "سبورة", "تعليم", "درس"], (c) => {
    const { w, h, k, p, F, Ln, m, line, portrait } = c;
    const bx0 = w * (portrait ? 0.08 : 0.18);
    const bx1 = w * (portrait ? 0.92 : 0.82);
    const by0 = h * (portrait ? 0.12 : 0.1);
    const by1 = h * (portrait ? 0.42 : 0.56);
    const fr = 22 * k;
    const fy = h * 0.82;
    const desks: React.ReactNode[] = [];
    const dn = portrait ? 2 : 3;
    const dw = 380 * k;
    for (let i = 0; i < dn; i++) {
      const cx = ((i + 0.5) / dn) * w;
      const dy = h - 130 * k;
      desks.push(
        <g key={i}>
          <rect x={cx - dw / 2} y={dy} width={dw} height={28 * k} rx={6 * k} {...F(p.wood, 0.3)} />
          <path d={`M${cx - dw / 2 + 30 * k} ${dy + 28 * k} V${h} M${cx + dw / 2 - 30 * k} ${dy + 28 * k} V${h}`} {...Ln(0.25, 12)} />
        </g>,
      );
    }
    const clx = portrait ? w * 0.84 : w * 0.92;
    const cly = portrait ? h * 0.06 : h * 0.14;
    return (
      <>
        <rect x={0} y={fy} width={w} height={h - fy} {...F(p.wood, 0.12)} />
        <rect x={bx0 - fr} y={by0 - fr} width={bx1 - bx0 + 2 * fr} height={by1 - by0 + 2 * fr} rx={10 * k} {...F(p.wood, 0.32)} />
        <rect x={bx0} y={by0} width={bx1 - bx0} height={by1 - by0} {...F(p.green, c.darkBg ? 0.22 : 0.3, p.surface)} />
        <path d={`M${bx0 + 60 * k} ${by0 + 80 * k} q${80 * k} ${-30 * k} ${160 * k} 0`} stroke={line ? p.edge : m(p.surface, 0.35)} strokeOpacity={line ? 0.15 : 1} strokeWidth={14 * k} fill="none" strokeLinecap="round" />
        <rect x={bx0 + 40 * k} y={by1 + fr} width={bx1 - bx0 - 80 * k} height={16 * k} {...F(p.wood, 0.36)} />
        <rect x={bx1 - 220 * k} y={by1 + fr - 26 * k} width={90 * k} height={26 * k} rx={4 * k} {...F(p.dark, 0.3)} />
        <rect x={bx0 + 120 * k} y={by1 + fr - 10 * k} width={50 * k} height={10 * k} rx={4 * k} {...F(p.surface, 0.9, p.surface)} />
        <circle cx={clx} cy={cly} r={52 * k} {...F(p.surface, 0.8, p.surface)} />
        <path d={`M${clx} ${cly} V${cly - 32 * k} M${clx} ${cly} L${clx + 22 * k} ${cly + 10 * k}`} {...Ln(0.4, 6)} />
        {desks}
      </>
    );
  }),

  // ───────────── مسجد من بعيد
  bd("mosque-exterior", "مسجد من بعيد", ["مسجد", "صلاة", "قبة", "مئذنة", "جمعة", "عبادة"], (c) => {
    const { w, h, k, p, F, Ln, darkBg, portrait } = c;
    const base = h * (portrait ? 0.8 : 0.8);
    const s = k * (portrait ? 0.95 : 0.85);
    const cx = w / 2;
    const col = darkBg ? 0.17 : 0.13;
    const sil = F(p.edge, col, p.surface);
    const minaret = (mx: number, key: string) => (
      <g key={key}>
        <rect x={mx - 22 * s} y={base - 520 * s} width={44 * s} height={520 * s} {...sil} />
        <rect x={mx - 34 * s} y={base - 400 * s} width={68 * s} height={22 * s} rx={4 * s} {...sil} />
        <path d={`M${mx - 26 * s} ${base - 520 * s} Q${mx - 26 * s} ${base - 580 * s} ${mx} ${base - 620 * s} Q${mx + 26 * s} ${base - 580 * s} ${mx + 26 * s} ${base - 520 * s} Z`} {...sil} />
        <path d={`M${mx} ${base - 620 * s} V${base - 650 * s}`} {...Ln(darkBg ? 0.3 : 0.2, 4)} />
      </g>
    );
    const windows: string[] = [];
    for (let i = -2; i <= 2; i++) {
      const wx = cx + i * 80 * s;
      windows.push(`M${wx - 20 * s} ${base - 30 * s} V${base - 100 * s} Q${wx} ${base - 130 * s} ${wx + 20 * s} ${base - 100 * s} V${base - 30 * s} Z`);
    }
    const r = rng(15);
    return (
      <>
        <Sky c={c} to={base} top={p.water} bottom={p.metal} tTop={darkBg ? 0.08 : 0.16} tBottom={darkBg ? 0.12 : 0.1} />
        {darkBg && <Stars c={c} n={60} seed={19} maxY={h * 0.5} />}
        <path d={wave(c, base - 30 * k, 18 * k, w * 0.6, 1)} {...F(p.green, 0.12)} />
        {minaret(cx - 330 * s, "m1")}
        {minaret(cx + 330 * s, "m2")}
        <rect x={cx - 270 * s} y={base - 170 * s} width={540 * s} height={170 * s} {...sil} />
        <rect x={cx - 120 * s} y={base - 220 * s} width={240 * s} height={50 * s} {...sil} />
        <path d={`M${cx - 150 * s} ${base - 220 * s} Q${cx - 165 * s} ${base - 360 * s} ${cx} ${base - 420 * s} Q${cx + 165 * s} ${base - 360 * s} ${cx + 150 * s} ${base - 220 * s} Z`} {...sil} />
        <path d={`M${cx} ${base - 420 * s} V${base - 470 * s}`} {...Ln(darkBg ? 0.3 : 0.2, 5)} />
        {[-1, 1].map((d) => (
          <path key={d} d={`M${cx + d * 200 * s - 60 * s} ${base - 170 * s} Q${cx + d * 200 * s - 60 * s} ${base - 250 * s} ${cx + d * 200 * s} ${base - 260 * s} Q${cx + d * 200 * s + 60 * s} ${base - 250 * s} ${cx + d * 200 * s + 60 * s} ${base - 170 * s} Z`} {...sil} />
        ))}
        <path d={windows.join(" ")} {...F(p.metal, darkBg ? 0.45 : 0.22, c.mint)} />
        <rect x={0} y={base} width={w} height={h - base} {...F(p.wood, 0.12)} />
        {Array.from({ length: 6 }, (_, i) => {
          const x = i < 3 ? r() * w * 0.2 + 30 * k : w - r() * w * 0.2 - 30 * k;
          return <path key={i} d={`M${x} ${base} Q${x - 30 * k} ${base - 120 * k} ${x} ${base - 200 * k} Q${x + 30 * k} ${base - 120 * k} ${x} ${base} Z`} {...F(p.green, 0.22, c.mint)} />;
        })}
      </>
    );
  }),

  // ───────────── طريق إلى الأفق
  bd("road-horizon", "طريق إلى الأفق", ["طريق", "أفق", "سفر", "هدف", "رحلة", "مستقبل"], (c) => {
    const { w, h, k, p, F, darkBg, portrait } = c;
    const hy = h * (portrait ? 0.56 : 0.6);
    const vx = w / 2;
    const bw = portrait ? w * 0.95 : w * 0.6;
    const dashes: React.ReactNode[] = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const f0 = (i / n) ** 2;
      const f1 = ((i + 0.5) / n) ** 2;
      const y0 = hy + (h - hy) * f0;
      const y1 = hy + (h - hy) * f1;
      const w0 = 4 * k + 22 * k * f0;
      const w1 = 4 * k + 22 * k * f1;
      if (i === 0) continue;
      dashes.push(<path key={i} d={`M${vx - w0} ${y0} H${vx + w0} L${vx + w1} ${y1} H${vx - w1} Z`} {...F(p.metal, 0.5, c.mint)} />);
    }
    const posts: React.ReactNode[] = [];
    for (let i = 1; i < 7; i++) {
      const f = (i / 7) ** 2;
      const y = hy + (h - hy) * f;
      const half = (bw / 2) * f + 6 * k;
      const ph = 160 * k * f + 6 * k;
      for (const d of [-1, 1]) {
        const x = vx + d * (half + 80 * k * f + 10 * k);
        posts.push(<rect key={`${i}${d}`} x={x - 5 * k * (f + 0.3)} y={y - ph} width={10 * k * (f + 0.3)} height={ph} {...F(p.wood, 0.35)} />);
      }
    }
    return (
      <>
        <Sky c={c} to={hy} top={p.water} bottom={p.metal} tTop={darkBg ? 0.08 : 0.18} tBottom={darkBg ? 0.16 : 0.14} />
        {darkBg && <Stars c={c} n={60} seed={7} maxY={hy * 0.8} />}
        <path d={wave(c, hy - 30 * k, 28 * k, w * 0.45, 0.8, (x) => -Math.max(0, 1 - Math.abs(x - w * 0.25) / (w * 0.25)) * 60 * k)} {...F(p.green, 0.12)} />
        <rect x={0} y={hy} width={w} height={h - hy} {...F(p.green, 0.18, p.surface)} />
        <path d={`M${vx - 6 * k} ${hy} H${vx + 6 * k} L${vx + bw / 2} ${h} H${vx - bw / 2} Z`} {...F(p.edge, darkBg ? 0.12 : 0.1)} />
        {dashes}
        {posts}
      </>
    );
  }),

  // ───────────── بحر وأفق
  bd("sea-horizon", "بحر وأفق", ["بحر", "أفق", "ماء", "سفينة", "تأمل", "سفر"], (c) => {
    const { w, h, k, p, m, F, Ln, line, darkBg, portrait } = c;
    const hy = h * (portrait ? 0.56 : 0.6);
    const sx = w * (portrait ? 0.7 : 0.72);
    const r = rng(29);
    const waves: string[] = [];
    for (let i = 0; i < 40; i++) {
      const f = r();
      const y = hy + 30 * k + (h - hy - 40 * k) * f * f;
      const x = r() * w;
      if (Math.abs(x - w / 2) < w * 0.22 && f < 0.6) continue;
      const len = (30 + 80 * f) * k;
      waves.push(`M${x} ${y} q${len / 2} ${-12 * k * (0.5 + f)} ${len} 0`);
    }
    const glint: string[] = [];
    for (let i = 0; i < 6; i++) {
      const y = hy + 20 * k + i * 26 * k * (1 + i * 0.3);
      const half = (90 - i * 8) * k;
      glint.push(`M${sx - half} ${y} H${sx + half}`);
    }
    const gid = c.uid("sea");
    const bx = w * (portrait ? 0.2 : 0.16);
    return (
      <>
        <Sky c={c} to={hy} top={p.water} bottom={p.metal} tTop={darkBg ? 0.1 : 0.18} tBottom={darkBg ? 0.14 : 0.12} />
        {darkBg && <Stars c={c} n={50} seed={13} maxY={hy * 0.7} />}
        <circle cx={sx} cy={hy} r={210 * k} fill={line ? "none" : m(p.metal, 0.1)} />
        <circle cx={sx} cy={hy} r={120 * k} {...F(p.metal, darkBg ? 0.55 : 0.35, c.mint)} />
        {!line && (
          <defs>
            <linearGradient id={gid} x1={0} y1={0} x2={0} y2={1}>
              <stop offset="0" stopColor={m(p.water, darkBg ? 0.25 : 0.24)} />
              <stop offset="1" stopColor={m(p.water, darkBg ? 0.4 : 0.38)} />
            </linearGradient>
          </defs>
        )}
        <rect x={0} y={hy} width={w} height={h - hy} {...(line ? F(p.water, 0, p.bg) : { fill: `url(#${gid})` })} />
        <path d={glint.join(" ")} fill="none" stroke={line ? p.edge : m(p.metal, 0.5)} strokeOpacity={line ? 0.3 : 1} strokeWidth={6 * k} strokeLinecap="round" />
        <path d={waves.join(" ")} {...Ln(darkBg ? 0.12 : 0.1, 4)} stroke={line ? p.edge : m(p.surface, darkBg ? 0.25 : 0.6)} />
        {/* مركب */}
        <path d={`M${bx - 70 * k} ${hy - 4 * k} H${bx + 70 * k} L${bx + 50 * k} ${hy + 22 * k} H${bx - 50 * k} Z`} {...F(p.edge, darkBg ? 0.3 : 0.3)} />
        <path d={`M${bx} ${hy - 6 * k} V${hy - 130 * k} L${bx + 60 * k} ${hy - 16 * k} Z`} {...F(p.surface, darkBg ? 0.35 : 0.8, p.surface)} />
        <path d={`M${w * 0.1} ${h * 0.18} q${16 * k} ${-14 * k} ${30 * k} 0 q${14 * k} ${-14 * k} ${30 * k} 0 M${w * 0.18} ${h * 0.24} q${12 * k} ${-10 * k} ${22 * k} 0 q${10 * k} ${-10 * k} ${22 * k} 0`} {...Ln(0.3, 4)} />
      </>
    );
  }),
];
