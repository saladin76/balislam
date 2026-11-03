import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { geoGraticule10, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import land110 from "world-atlas/land-110m.json";
import { useTheme } from "../../brand/identity/index";
import { fontFamilies } from "../../brand/fonts";
import { useBrandFonts } from "./useBrandFonts";
import { Providers } from "./Providers";
import { useChannel } from "../channel/context";
import { LogoMark } from "../../brand/logo/Logo";
import type { Identity } from "../../brand/identity/index";
import type { ChannelInfo } from "../channel/types";

/**
 * صور القناة للمنصات: صورة الحساب (مربعة تُقص دائرة، بالرمز والاسم)، وغلاف يوتيوب 2560×1440
 * (المنطقة الآمنة 1546×423 في الوسط)، وغلاف فيسبوك 1640×624، وغلاف X ‏1500×500.
 * كل قناة بهويتها المعتمدة: بالإسلام «محراب النور»، دفاتر الزمن «دفتر الأفق»، زبدة الكتب «القلم المميِّز».
 */
export type ArtKind = "profile" | "youtube" | "facebook" | "x";
export const artSizes: Record<ArtKind, { width: number; height: number }> = {
  profile: { width: 1024, height: 1024 },
  youtube: { width: 2560, height: 1440 },
  facebook: { width: 1640, height: 624 },
  x: { width: 1500, height: 500 },
};

export type ChannelArtProps = { kind: ArtKind; tagline?: string; identity?: Identity; channel?: ChannelInfo };

export const ChannelArt: React.FC<ChannelArtProps> = ({ identity, channel, ...rest }) => (
  <Providers identity={identity} channel={channel}>
    <ArtInner {...rest} />
  </Providers>
);

/** جملة كل قناة على الأغلفة (تُستبدل بـ tagline إن مُررت) */
const TAGLINES: Record<string, string> = {
  balislam: "الحياة بعين الإسلام",
  "dafatir-alzaman": "التاريخ كما حدث",
  "zubdat-alkutub": "خلاصة أهم الكتب في دقائق",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const land = feature(land110 as any, (land110 as any).objects.land) as unknown as GeoJSON.FeatureCollection;

/** أرقام شبه عشوائية ثابتة (نفس الصورة في كل رندر) */
const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** حبيبات خفيفة تعطي ملمس الورق/الفيلم */
const Grain: React.FC<{ W: number; H: number; opacity: number }> = ({ W, H, opacity }) => (
  <svg width={W} height={H} style={{ position: "absolute", inset: 0, mixBlendMode: "overlay", opacity }}>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency={0.85} numOctaves={2} stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width={W} height={H} filter="url(#grain)" />
  </svg>
);

/** فاصل زخرفي: خطان يتلاشيان ونجمة ثمانية صغيرة في الوسط */
const Ornament: React.FC<{ width: number; color: string }> = ({ width, color }) => {
  const h = width * 0.05;
  const c = width / 2;
  const r = h * 0.5;
  const star = Array.from({ length: 16 }, (_, i) => {
    const a = (Math.PI / 8) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    return `${c + Math.cos(a) * rr},${h / 2 + Math.sin(a) * rr}`;
  }).join(" ");
  return (
    <svg width={width} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="orn-l" x1="0" x2="1">
          <stop offset="0" stopColor={color} stopOpacity={0} />
          <stop offset="1" stopColor={color} stopOpacity={0.9} />
        </linearGradient>
        <linearGradient id="orn-r" x1="1" x2="0">
          <stop offset="0" stopColor={color} stopOpacity={0} />
          <stop offset="1" stopColor={color} stopOpacity={0.9} />
        </linearGradient>
      </defs>
      <rect x={0} y={h / 2 - 1} width={c - r * 1.9} height={2} fill="url(#orn-l)" />
      <rect x={c + r * 1.9} y={h / 2 - 1} width={c - r * 1.9} height={2} fill="url(#orn-r)" />
      <circle cx={c - r * 1.45} cy={h / 2} r={r * 0.18} fill={color} />
      <circle cx={c + r * 1.45} cy={h / 2} r={r * 0.18} fill={color} />
      <polygon points={star} fill={color} />
    </svg>
  );
};

/** نقش هندسي إسلامي (نجمة ثمانية متشابكة) كطبقة متكررة */
const StarPattern: React.FC<{ W: number; H: number; size: number; color: string; opacity: number; id: string }> = ({ W, H, size: s, color, opacity, id }) => {
  const q = s / 2;
  const sq = (rot: number) => {
    const r = s * 0.34;
    return Array.from({ length: 4 }, (_, i) => {
      const a = (Math.PI / 2) * i + rot;
      return `${q + Math.cos(a) * r},${q + Math.sin(a) * r}`;
    }).join(" ");
  };
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <pattern id={id} width={s} height={s} patternUnits="userSpaceOnUse">
          <g fill="none" stroke={color} strokeWidth={Math.max(1.4, s / 70)} opacity={opacity}>
            <polygon points={sq(Math.PI / 4)} />
            <polygon points={sq(0)} />
            <circle cx={q} cy={q} r={s * 0.12} />
            <path d={`M0 0 L${s * 0.16} ${s * 0.16} M${s} 0 L${s - s * 0.16} ${s * 0.16} M0 ${s} L${s * 0.16} ${s - s * 0.16} M${s} ${s} L${s - s * 0.16} ${s - s * 0.16}`} />
            <path d={`M${q} 0 V${s * 0.16} M${q} ${s} V${s - s * 0.16} M0 ${q} H${s * 0.16} M${s} ${q} H${s - s * 0.16}`} />
          </g>
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#${id})`} />
    </svg>
  );
};

/** بوصلة زخرفية لدفاتر الزمن */
const Compass: React.FC<{ cx: number; cy: number; r: number; color: string }> = ({ cx, cy, r, color }) => {
  const pts = (n: number, ro: number, ri: number, off = 0) =>
    Array.from({ length: n * 2 }, (_, i) => {
      const a = (Math.PI / n) * i - Math.PI / 2 + off;
      const rr = i % 2 === 0 ? ro : ri;
      return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`;
    }).join(" ");
  return (
    <g fill="none" stroke={color}>
      <circle cx={cx} cy={cy} r={r} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={r * 0.93} strokeWidth={1} />
      <circle cx={cx} cy={cy} r={r * 0.62} strokeWidth={1} strokeDasharray="3 9" />
      {Array.from({ length: 72 }, (_, i) => {
        const a = (Math.PI / 36) * i;
        const l = i % 9 === 0 ? 0.12 : 0.05;
        return <line key={i} x1={cx + Math.cos(a) * r * 0.93} y1={cy + Math.sin(a) * r * 0.93} x2={cx + Math.cos(a) * r * (0.93 - l)} y2={cy + Math.sin(a) * r * (0.93 - l)} strokeWidth={1.2} />;
      })}
      <polygon points={pts(4, r * 0.85, r * 0.13, Math.PI / 4)} strokeWidth={1.4} />
      <polygon points={pts(4, r * 1.05, r * 0.16)} strokeWidth={2} fill={color} fillOpacity={0.12} />
      <circle cx={cx} cy={cy} r={r * 0.05} fill={color} fillOpacity={0.6} />
    </g>
  );
};

type Brand = "mihrab" | "horizon" | "highlighter";
const BRAND: Record<string, Brand> = { balislam: "mihrab", "dafatir-alzaman": "horizon", "zubdat-alkutub": "highlighter" };

const ArtInner: React.FC<Omit<ChannelArtProps, "identity" | "channel">> = ({ kind, tagline }) => {
  useBrandFonts();
  const ch = useChannel();
  const t = useTheme(ch.id === "zubdat-alkutub" ? "paper" : ch.id === "dafatir-alzaman" ? "warm" : "night");
  const { width: W, height: H } = artSizes[kind];
  const line = tagline ?? TAGLINES[ch.id] ?? "";
  const brand: Brand = BRAND[ch.id] ?? "mihrab";
  const profile = kind === "profile";
  const uid = `${ch.id}-${kind}`;
  const u = profile ? W / 1024 : kind === "youtube" ? 1 : kind === "facebook" ? 1.02 : 0.92;
  const name = ch.nameDisplay ?? ch.name;
  const logoColors = t.logo;

  // ---------- الخلفيات ----------
  const map = useMemo(() => {
    if (brand !== "horizon") return null;
    const box: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: { type: "MultiPoint", coordinates: [[-14, 14], [76, 50]] } };
    const proj = geoMercator().fitExtent([[0, H * 0.5], [W, H * 1.15]], box);
    const p = geoPath(proj);
    const stops: [number, number][] = [[-4.8, 37.9], [10.2, 36.8], [31.2, 30.0], [36.3, 33.5], [44.4, 33.3], [59.6, 36.3], [66.9, 39.6]];
    const route: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: stops } };
    return { land: p(land) ?? "", grid: p(geoGraticule10()) ?? "", route: p(route) ?? "", pins: stops.map((s) => proj(s) as [number, number]) };
  }, [brand, W, H]);

  let background: React.ReactNode;
  let fg = "#F4EEE2";
  let accent = "#C9A24A";
  let soft = "#A9C3B9";
  let font: string = fontFamilies.ruqaa;
  if (brand === "mihrab") {
    background = (
      <>
        <AbsoluteFill style={{ background: `radial-gradient(ellipse ${profile ? "70% 70%" : "45% 70%"} at 50% ${profile ? "46%" : "50%"}, #14382F 0%, #0F2A26 40%, #0B1F1C 100%)` }} />
        <AbsoluteFill style={{ WebkitMaskImage: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.15) 0%, #000 75%)", maskImage: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.15) 0%, #000 75%)" }}>
          <StarPattern W={W} H={H} size={(profile ? 170 : 150) * u} color="#C9A24A" opacity={0.16} id={`pat-${uid}`} />
        </AbsoluteFill>
        <AbsoluteFill style={{ background: `radial-gradient(circle at 50% ${profile ? "44%" : "50%"}, rgba(242,179,91,0.22) 0%, rgba(242,179,91,0) ${profile ? "40%" : "26%"})` }} />
      </>
    );
  } else if (brand === "horizon") {
    fg = "#F3E9DA";
    accent = "#F3C98B";
    soft = "#E8D9C0";
    font = "'Amiri', serif";
    const hy = profile ? H * 0.58 : H * 0.6;
    background = (
      <>
        <AbsoluteFill style={{ background: `linear-gradient(180deg, #120C1E 0%, #2A1E3F ${profile ? 22 : 18}%, #6B3552 ${profile ? 42 : 38}%, #C8603A ${(hy / H) * 100 - 4}%, #E07A3F ${(hy / H) * 100}%, #EADBC0 ${(hy / H) * 100}%, #E3D2B3 100%)` }} />
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <defs><clipPath id={`sky-${uid}`}><rect x={0} y={0} width={W} height={hy} /></clipPath></defs>
          <circle cx={W / 2} cy={hy} r={(profile ? 230 : 150) * u} fill="#F3C98B" opacity={0.9} clipPath={`url(#sky-${uid})`} />
          {Array.from({ length: profile ? 30 : 80 }, (_, i) => <circle key={i} cx={rand(i) * W} cy={rand(i + 40) * hy * 0.45} r={(0.8 + rand(i + 80) * 1.8) * u} fill="#F3E9DA" opacity={0.25 + rand(i + 120) * 0.5} />)}
          <rect x={0} y={hy} width={W} height={H - hy} fill="#EADBC0" />
          {map ? (
            <g opacity={0.9}>
              <path d={map.grid} fill="none" stroke="#6B4A2B" strokeOpacity={0.12} strokeWidth={1} clipPath="none" transform={`translate(0 0)`} />
              <path d={map.route} fill="none" stroke="#7E2A22" strokeOpacity={0.7} strokeWidth={3 * u} strokeDasharray={`${12 * u} ${10 * u}`} />
              {map.pins.map(([x, y], i) => (y > hy ? <circle key={i} cx={x} cy={y} r={6 * u} fill="#7E2A22" /> : null))}
            </g>
          ) : null}
          <path d={`M0 ${hy} H${W}`} stroke="#2B1E14" strokeWidth={4 * u} />
          {Array.from({ length: Math.ceil(W / (120 * u)) }, (_, i) => <path key={`n${i}`} d={`M${i * 120 * u + 60 * u} ${hy} V${hy + (i % 4 === 0 ? 22 : 12) * u}`} stroke="#2B1E14" strokeWidth={3 * u} />)}
        </svg>
      </>
    );
  } else {
    fg = "#111111";
    accent = "#E8F542";
    soft = "#4A4A4A";
    font = fontFamilies.bold;
    background = (
      <>
        <AbsoluteFill style={{ background: "#FFFFFF" }} />
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: Math.ceil(H / (64 * u)) }, (_, i) => <path key={i} d={`M0 ${(i + 1) * 64 * u} H${W}`} stroke="#111111" strokeOpacity={0.05} strokeWidth={2} />)}
          {!profile ? <path d={`M${W * 0.08} ${H * 0.2} L${W * 0.3} ${H * 0.17} L${W * 0.305} ${H * 0.22} L${W * 0.085} ${H * 0.25} Z`} fill="#E8F542" opacity={0.5} /> : null}
          {!profile ? <path d={`M${W * 0.7} ${H * 0.8} L${W * 0.93} ${H * 0.77} L${W * 0.935} ${H * 0.82} L${W * 0.705} ${H * 0.85} Z`} fill="#E8F542" opacity={0.5} /> : null}
        </svg>
      </>
    );
  }

  const Layers = (
    <>
      {background}
      <Grain W={W} H={H} opacity={brand === "highlighter" ? 0.12 : 0.22} />
      {brand === "mihrab" ? <AbsoluteFill style={{ boxShadow: `inset 0 0 ${H * 0.3}px ${H * 0.06}px #0B1F1C` }} /> : null}
    </>
  );

  // الاسم: في «القلم المميِّز» تُظلَّل الكلمة الثانية بالفسفوري
  const nameNode = (size: number) => {
    if (brand === "highlighter") {
      const [a, ...rest] = name.split(" ");
      return (
        <div style={{ fontFamily: font, fontSize: size, lineHeight: 1.15, color: fg, whiteSpace: "nowrap", direction: "rtl" }}>
          {a} {rest.length ? <span style={{ background: accent, padding: `0 ${size * 0.12}px` }}>{rest.join(" ")}</span> : null}
        </div>
      );
    }
    return <div style={{ fontFamily: font, fontWeight: 700, fontSize: size, lineHeight: 1.25, color: fg, whiteSpace: "nowrap", direction: "rtl", textShadow: brand === "horizon" ? "0 4px 24px rgba(18,12,30,0.6)" : undefined }}>{name}</div>;
  };

  // ---------- صورة الحساب: الرمز وحده كبيرًا (الاسم يظهر بجوارها في كل المنصات) ----------
  if (profile) {
    const size = (brand === "highlighter" ? 760 : brand === "horizon" ? 720 : 640) * u;
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {Layers}
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ marginTop: brand === "horizon" ? -60 * u : 0, filter: brand === "mihrab" ? `drop-shadow(0 0 ${60 * u}px rgba(242,179,91,0.35))` : brand === "horizon" ? `drop-shadow(0 ${16 * u}px ${30 * u}px rgba(18,12,30,0.45))` : undefined }}>
            <LogoMark size={size} colors={logoColors} mark={ch.logo} tile={false} />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // ---------- الأغلفة: كل المحتوى داخل المنطقة الآمنة ----------
  const safe = kind === "youtube" ? { w: 1546, h: 423 } : kind === "facebook" ? { w: 1180, h: 470 } : { w: 1060, h: 400 };
  const nameSize = (brand === "highlighter" ? 150 : 140) * u;
  const logo = (brand === "horizon" ? 330 : 300) * u;
  const offsetX = kind === "youtube" ? 0 : W * 0.06;
  const top = brand === "horizon" ? (H - safe.h) / 2 - 30 * u : (H - safe.h) / 2;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {Layers}
      <div style={{ position: "absolute", left: (W - safe.w) / 2 + offsetX, top, width: safe.w, height: safe.h, display: "flex", alignItems: "center", justifyContent: "center", gap: 60 * u, direction: "rtl" }}>
        <div style={{ flex: "none", filter: brand === "mihrab" ? `drop-shadow(0 0 ${logo * 0.18}px rgba(242,179,91,0.45))` : brand === "horizon" ? `drop-shadow(0 ${10 * u}px ${24 * u}px rgba(18,12,30,0.5))` : undefined }}>
          <LogoMark size={logo} colors={logoColors} mark={ch.logo} tile={false} />
        </div>
        <div style={{ flex: "none", width: 2, height: safe.h * 0.62, background: `linear-gradient(180deg, transparent, ${brand === "highlighter" ? "#111111" : accent}, transparent)`, opacity: 0.5 }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 * u }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 * u }}>
            {nameNode(nameSize)}
            {brand === "mihrab" ? <div style={{ width: 34 * u, height: 34 * u, borderRadius: 5 * u, background: "#C2412D", marginTop: 30 * u }} /> : null}
          </div>
          {brand === "highlighter" ? null : <Ornament width={nameSize * 2.6} color={accent} />}
          {line ? <div style={{ fontFamily: brand === "highlighter" ? fontFamilies.clean : font, fontWeight: 700, fontSize: 46 * u, lineHeight: 1.35, color: brand === "horizon" ? fg : soft, whiteSpace: "nowrap", textShadow: brand === "horizon" ? "0 3px 18px rgba(18,12,30,0.7)" : undefined }}>{line}</div> : null}
          <div style={{ fontFamily: brand === "horizon" ? fontFamilies.mono : "'Readex Pro', sans-serif", fontWeight: 500, fontSize: 22 * u, letterSpacing: "0.42em", color: brand === "highlighter" ? "#111111" : accent, opacity: 0.85, direction: "ltr", textTransform: "uppercase", whiteSpace: "nowrap" }}>{ch.nameLatin}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
