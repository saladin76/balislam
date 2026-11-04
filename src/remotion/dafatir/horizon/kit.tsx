/**
 * أدوات «خط الأفق» لدفاتر الزمن: الألوان من لوحة الهوية المعتمدة «دفتر الأفق»، الدفتر المفتوح،
 * قلب الصفحة، رسم الحبر، الكاميرا، والترجمة. كل شيء بإحداثيات 1920×1080 (العالم قد يكون أكبر في بعض اللقطات).
 */
import React from "react";
import { AbsoluteFill, Easing } from "remotion";

export const C = {
  parchment: "#F1E4CB",
  page: "#F8EEDB",
  ink: "#4A2E1F",
  inkText: "#2B1E14",
  inkSoft: "#7A5C46",
  dusk: "#2A1E3F",
  night: "#0D0A14",
  ember: "#E07A3F",
  ribbon: "#D7372B",
  gold: "#C8A15A",
  sand: "#F3C98B",
} as const;

export const W = 1920;
export const H = 1080;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeIO = Easing.bezier(0.45, 0, 0.25, 1);
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
/** تقدّم ناعم من a إلى b بالثواني */
export const prog = (t: number, a: number, b: number, e: (x: number) => number = easeIO) => e(clamp01((t - a) / (b - a)));
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** مولّد عشوائي ثابت (لا يتغير بين الإطارات) */
export const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

/** خلفية الغسق حول الدفتر */
export const Dusk: React.FC<{ warm?: number }> = ({ warm = 0 }) => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.night} 0%, #1A1424 38%, ${C.dusk} 72%, ${warm > 0 ? `rgb(${mix(90, 120, warm)},${mix(46, 56, warm)},${mix(72, 60, warm)})` : "#4A2A44"} 100%)` }} />
);

/** إطار الكاميرا: يضع النقطة (cx,cy) من العالم في منتصف الشاشة بتكبير s */
export const Camera: React.FC<{ cx: number; cy: number; s: number; children: React.ReactNode; w?: number; h?: number }> = ({ cx, cy, s, children, w = W, h = H }) => (
  <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, transformOrigin: "0 0", transform: `translate(${W / 2 - cx * s}px, ${H / 2 - cy * s}px) scale(${s})` }}>{children}</div>
);

// الدفتر المفتوح: الكعب عند x=960، الصفحتان بين y=80 و940، وحافتان علوية وسفلية منحنيتان قليلًا.
export const GUTTER = 960;
export const PAGE_TOP = 80;
export const PAGE_BOT = 940;
export const RIGHT_PAGE = `M960 ${PAGE_TOP + 22} C1120 ${PAGE_TOP - 6} 1520 ${PAGE_TOP - 12} 1770 ${PAGE_TOP + 8} V${PAGE_BOT - 6} C1520 ${PAGE_BOT - 22} 1120 ${PAGE_BOT - 18} 960 ${PAGE_BOT + 8} Z`;
export const LEFT_PAGE = `M960 ${PAGE_TOP + 22} C800 ${PAGE_TOP - 6} 400 ${PAGE_TOP - 12} 150 ${PAGE_TOP + 8} V${PAGE_BOT - 6} C400 ${PAGE_BOT - 22} 800 ${PAGE_BOT - 18} 960 ${PAGE_BOT + 8} Z`;

/** تعريفات SVG المشتركة: حبيبات الورق وظل الكعب */
export const Defs: React.FC<{ id: string }> = ({ id }) => (
  <defs>
    <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={7} result="n" />
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.29  0 0 0 0 0.18  0 0 0 0 0.12  0 0 0 0.09 0" />
    </filter>
    <linearGradient id={`${id}-gutterR`} x1="0" x2="1">
      <stop offset="0" stopColor="#4A2E1F" stopOpacity={0.22} />
      <stop offset="0.12" stopColor="#4A2E1F" stopOpacity={0} />
    </linearGradient>
    <linearGradient id={`${id}-gutterL`} x1="1" x2="0">
      <stop offset="0" stopColor="#4A2E1F" stopOpacity={0.22} />
      <stop offset="0.12" stopColor="#4A2E1F" stopOpacity={0} />
    </linearGradient>
    <radialGradient id={`${id}-paper`} cx="0.5" cy="0.45" r="0.75">
      <stop offset="0" stopColor={C.page} />
      <stop offset="1" stopColor={C.parchment} />
    </radialGradient>
    <clipPath id={`${id}-rclip`}>
      <path d={RIGHT_PAGE} />
    </clipPath>
    <clipPath id={`${id}-lclip`}>
      <path d={LEFT_PAGE} />
    </clipPath>
  </defs>
);

/** صفحة واحدة (يمنى أو يسرى) بورقها وحبيباتها وظل الكعب */
export const Page: React.FC<{ id: string; side: "r" | "l"; children?: React.ReactNode; tint?: string }> = ({ id, side, children, tint }) => (
  <g>
    <path d={side === "r" ? RIGHT_PAGE : LEFT_PAGE} fill={`url(#${id}-paper)`} stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />
    <g clipPath={`url(#${id}-${side}clip)`}>
      <rect x={side === "r" ? 960 : 150} y={PAGE_TOP - 20} width={820} height={PAGE_BOT - PAGE_TOP + 40} filter={`url(#${id}-grain)`} />
      {tint ? <rect x={side === "r" ? 960 : 150} y={PAGE_TOP - 20} width={820} height={PAGE_BOT - PAGE_TOP + 40} fill={tint} /> : null}
      {children}
      <rect x={side === "r" ? 960 : 150} y={PAGE_TOP - 20} width={820} height={PAGE_BOT - PAGE_TOP + 40} fill={`url(#${id}-gutter${side === "r" ? "R" : "L"})`} />
    </g>
  </g>
);

/** الكعب: ساعة رملية ذهبية (عنصر الهوية) */
export const Spine: React.FC = () => (
  <path d={`M944 ${PAGE_TOP + 14} H976 L966 510 L976 ${PAGE_BOT} H944 L954 510 Z`} fill={C.gold} stroke={C.ink} strokeWidth={3} strokeLinejoin="round" />
);

/** ظل الدفتر على الغسق */
export const BookShadow: React.FC = () => <ellipse cx={960} cy={PAGE_BOT + 30} rx={860} ry={40} fill="#000" opacity={0.35} />;

/**
 * قلب صفحة إلى الخلف في كتاب عربي: الصفحة اليمنى ترتفع من حافتها وتنقلب فوق الكعب إلى اليسار.
 * p من 0 إلى 1. وجهها (front) يظهر في نصفها الأول، ثم ظهرها (أغمق قليلًا). ظل يقع على الصفحة تحتها، وانحناء خفيف عند الرفع.
 */
export const FlipLeaf: React.FC<{ id: string; p: number; front: React.ReactNode }> = ({ id, p, front }) => {
  if (p <= 0 || p >= 1) return null;
  const sx = Math.cos(Math.PI * p); // 1 → -1
  const sxSafe = Math.abs(sx) < 0.01 ? 0.01 * Math.sign(sx || 1) : sx;
  const lift = Math.sin(Math.PI * p);
  const shade = 0.32 * (1 - Math.abs(sx));
  return (
    <g>
      {/* ظل الورقة المرتفعة على الصفحة التي تحتها */}
      <path d={sx > 0 ? RIGHT_PAGE : LEFT_PAGE} fill="#2B1E14" opacity={0.18 * lift} />
      <g transform={`translate(${GUTTER} ${PAGE_TOP}) skewY(${-5 * lift * Math.sign(sx || 1)}) scale(${sxSafe} 1) translate(${-GUTTER} ${-PAGE_TOP})`}>
        {sx > 0 ? <Page id={id} side="r">{front}</Page> : <Page id={id} side="r" tint="rgba(74,46,31,0.08)" />}
        <path d={RIGHT_PAGE} fill="#2B1E14" opacity={shade} />
      </g>
    </g>
  );
};

/** ظهر صفحة: سطور باهتة فقط */
export const RuledBack: React.FC = () => (
  <g opacity={0.12}>
    {Array.from({ length: 14 }, (_, i) => (
      <path key={i} d={`M1010 ${170 + i * 52} H1720`} stroke={C.ink} strokeWidth={2} />
    ))}
  </g>
);

/** خط حبر يُرسم بنسبة p */
export const Ink: React.FC<{ d: string; p: number; w?: number; c?: string; opacity?: number; fill?: string; fillP?: number; cap?: "round" | "butt"; dash?: string }> = ({ d, p, w = 4, c = C.ink, opacity = 1, fill, fillP = 0, cap = "round", dash }) => {
  if (p <= 0 && fillP <= 0) return null;
  return (
    <g opacity={opacity}>
      {fill && fillP > 0 ? <path d={d} fill={fill} opacity={fillP} stroke="none" /> : null}
      <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap={cap} strokeLinejoin="round" pathLength={1} strokeDasharray={dash ?? "1"} strokeDashoffset={dash ? undefined : 1 - p} style={dash ? { opacity: p } : undefined} />
    </g>
  );
};

/** نص يُكتب من اليمين إلى اليسار (كشف بقناع) */
export const WriteText: React.FC<{ p: number; style: React.CSSProperties; children: React.ReactNode }> = ({ p, style, children }) => (
  <div style={{ position: "absolute", direction: "rtl", whiteSpace: "nowrap", clipPath: `inset(-30% 0 -30% ${(1 - p) * 100}%)`, ...style }}>{children}</div>
);

/** ترجمة كلام الراوي: جملة كاملة، بلا إبراز كلمة بكلمة */
export const Caption: React.FC<{ text: string; opacity: number }> = ({ text, opacity }) =>
  opacity <= 0 ? null : (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 22, display: "flex", justifyContent: "center", opacity }}>
      <div style={{ maxWidth: 1560, padding: "8px 28px 12px", borderRadius: 10, background: "rgba(13,10,20,0.62)", color: C.parchment, fontFamily: "'Tajawal', sans-serif", fontWeight: 500, fontSize: 34, lineHeight: 1.45, direction: "rtl", textAlign: "center" }}>{text}</div>
    </div>
  );

/**
 * كلمات تظهر كلمة كلمة عند نطق كل منها (تلاشٍ وصعود خفيف)، دون قص الحروف.
 * مكان كل كلمة محجوز من البداية فلا يتحرك السطر.
 */
export const Words: React.FC<{ items: { w: string; t: number }[]; now: number; style: React.CSSProperties; dur?: number }> = ({ items, now, style, dur = 0.35 }) => (
  <div style={{ position: "absolute", direction: "rtl", whiteSpace: "nowrap", ...style }}>
    {items.map((it, i) => {
      const p = prog(now, it.t - 0.05, it.t - 0.05 + dur, easeOut);
      return (
        <React.Fragment key={i}>
          <span style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>{it.w}</span>
          {i < items.length - 1 ? " " : null}
        </React.Fragment>
      );
    })}
  </div>
);

/** وسم صغير في زاوية الشاشة (للمعاينة فقط، لا يُنشر) */
export const Tag: React.FC<{ text: string; corner: "tl" | "tr" | "bl" | "br" | "tl2"; opacity?: number; tone?: "light" | "dark" }> = ({ text, corner, opacity = 1, tone = "light" }) => (
  <div
    style={{
      position: "absolute",
      ...(corner === "tl" ? { left: 28, top: 22 } : corner === "tl2" ? { left: 28, top: 66 } : corner === "tr" ? { right: 28, top: 22 } : corner === "br" ? { right: 28, bottom: 132 } : { left: 28, bottom: 132 }),
      padding: "5px 14px 7px",
      borderRadius: 8,
      background: tone === "light" ? "rgba(13,10,20,0.55)" : "rgba(241,228,203,0.85)",
      color: tone === "light" ? "rgba(241,228,203,0.92)" : C.inkText,
      fontFamily: "'Tajawal', sans-serif",
      fontWeight: 500,
      fontSize: 22,
      direction: "rtl",
      opacity,
    }}
  >
    {text}
  </div>
);
