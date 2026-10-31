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
 * كل قناة بعالمها: بالإسلام نقش هندسي دافئ، دفاتر الزمن خريطة قديمة وبوصلة، زبدة الكتب رفوف وضوء.
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

type Look = {
  dark: boolean;
  bg: string;
  bg2: string;
  glow: string;
  gold: string;
  gold2: string;
  goldDeep: string;
  ink: string;
  soft: string;
  font: string;
  deco: "pattern" | "map" | "shelf";
};

const LOOKS: Record<string, Look> = {
  "dafatir-alzaman": { dark: true, bg: "#0A0705", bg2: "#1A110A", glow: "#4A2E14", gold: "#D4A24C", gold2: "#F6E2AE", goldDeep: "#7A5521", ink: "#F1E3C6", soft: "#B9A47F", font: "'Amiri', serif", deco: "map" },
  "zubdat-alkutub": { dark: true, bg: "#050D11", bg2: "#0D2028", glow: "#1C4350", gold: "#F2C46D", gold2: "#FFF1CF", goldDeep: "#8E6A2C", ink: "#F3EEE4", soft: "#9DB3B8", font: fontFamilies.heading, deco: "shelf" },
};

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

const ArtInner: React.FC<Omit<ChannelArtProps, "identity" | "channel">> = ({ kind, tagline }) => {
  useBrandFonts();
  const ch = useChannel();
  const warm = useTheme("warm");
  const { width: W, height: H } = artSizes[kind];
  const line = tagline ?? TAGLINES[ch.id] ?? "";
  // بالإسلام: من ثيمها الدافئ
  const look: Look = LOOKS[ch.id] ?? {
    dark: false,
    bg: warm.colors.bg,
    bg2: warm.colors.surface,
    glow: warm.colors.surface,
    gold: warm.colors.primary,
    gold2: warm.colors.secondary,
    goldDeep: warm.colors.primary,
    ink: warm.colors.ink,
    soft: warm.colors.inkSoft,
    font: fontFamilies.wordmark,
    deco: "pattern",
  };
  const profile = kind === "profile";
  const uid = `${ch.id}-${kind}`;

  // ---------- الخلفية والزخرفة ----------
  const map = useMemo(() => {
    if (look.deco !== "map") return null;
    const box: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: { type: "MultiPoint", coordinates: profile ? [[20, 22], [52, 42]] : [[-14, 14], [76, 50]] } };
    const proj = geoMercator().fitExtent([[0, 0], [W, H]], box);
    const p = geoPath(proj);
    const stops: [number, number][] = [[-4.8, 37.9], [10.2, 36.8], [31.2, 30.0], [36.3, 33.5], [44.4, 33.3], [59.6, 36.3], [66.9, 39.6]];
    const route: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: stops } };
    return { land: p(land) ?? "", grid: p(geoGraticule10()) ?? "", route: p(route) ?? "", pins: stops.map((s) => proj(s) as [number, number]) };
  }, [look.deco, W, H, profile]);

  const u = profile ? W / 1024 : kind === "youtube" ? 1 : kind === "facebook" ? 1.02 : 0.92;
  const deco = (() => {
    if (look.deco === "map" && map)
      return (
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <path d={map.grid} fill="none" stroke={look.gold} strokeOpacity={0.09} strokeWidth={1} />
          <path d={map.land} fill={look.gold} fillOpacity={0.045} stroke={look.gold} strokeOpacity={0.32} strokeWidth={1.6 * u} />
          <path d={map.route} fill="none" stroke={look.gold} strokeOpacity={0.45} strokeWidth={2.2 * u} strokeDasharray={`${10 * u} ${10 * u}`} />
          {map.pins.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={9 * u} fill="none" stroke={look.gold} strokeOpacity={0.35} strokeWidth={1.5} />
              <circle cx={x} cy={y} r={3.6 * u} fill={look.gold} fillOpacity={0.6} />
            </g>
          ))}
          {!profile ? <Compass cx={kind === "youtube" ? 380 : W * 0.1} cy={H * (kind === "youtube" ? 0.5 : 0.62)} r={H * (kind === "youtube" ? 0.2 : 0.42)} color={look.gold} /> : null}
        </svg>
      );
    if (look.deco === "shelf") {
      const n = Math.ceil(W / (40 * u)) + 1;
      const shelfY = H * (profile ? 1.02 : 0.96);
      return (
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <linearGradient id={`beam-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={look.gold2} stopOpacity={0.16} />
              <stop offset="1" stopColor={look.gold2} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`spine-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={look.gold} stopOpacity={0.12} />
              <stop offset="1" stopColor={look.gold} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {/* شعاع ضوء من الأعلى */}
          <polygon points={`${W * 0.42},0 ${W * 0.58},0 ${W * 0.78},${H} ${W * 0.22},${H}`} fill={`url(#beam-${uid})`} />
          {/* رف كتب */}
          {Array.from({ length: n }, (_, i) => {
            const w = (24 + rand(i) * 18) * u;
            const x = i * 40 * u + rand(i + 50) * 6;
            const h = H * (profile ? 0.14 + rand(i + 9) * 0.12 : kind === "youtube" ? 0.1 + rand(i + 9) * 0.12 : 0.16 + rand(i + 9) * 0.16);
            const lean = rand(i + 3) > 0.92 ? -6 : 0;
            return (
              <g key={i} transform={`rotate(${lean} ${x + w / 2} ${shelfY})`}>
                <rect x={x} y={shelfY - h} width={w} height={h} rx={3 * u} fill={`url(#spine-${uid})`} stroke={look.gold} strokeOpacity={0.12} strokeWidth={1} />
                <rect x={x + w * 0.15} y={shelfY - h + h * 0.1} width={w * 0.7} height={2 * u} fill={look.gold} opacity={0.22} />
                <rect x={x + w * 0.15} y={shelfY - h + h * 0.16} width={w * 0.7} height={2 * u} fill={look.gold} opacity={0.22} />
              </g>
            );
          })}
          <rect x={0} y={shelfY} width={W} height={4 * u} fill={look.gold} opacity={0.18} />
          {/* ذرات ضوء */}
          {Array.from({ length: profile ? 40 : 90 }, (_, i) => (
            <circle key={`p${i}`} cx={rand(i + 200) * W} cy={rand(i + 400) * H * 0.75} r={(0.8 + rand(i + 600) * 2.4) * u} fill={look.gold2} opacity={0.12 + rand(i + 800) * 0.4} />
          ))}
        </svg>
      );
    }
    return <StarPattern W={W} H={H} size={(profile ? 170 : 150) * u} color={profile ? warm.logo.baa : look.gold} opacity={profile ? 0.14 : 0.16} id={`pat-${uid}`} />;
  })();

  // الزخرفة تخفت خلف المحتوى وتظهر على الأطراف
  const mask = profile ? "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.35) 0%, #000 70%)" : "radial-gradient(ellipse 34% 40% at 50% 50%, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.5) 55%, #000 100%)";
  const background = look.dark
    ? `radial-gradient(ellipse ${profile ? "70% 70%" : "55% 75%"} at 50% ${profile ? "42%" : "50%"}, ${look.glow} 0%, ${look.bg2} 45%, ${look.bg} 100%)`
    : profile
      ? `radial-gradient(circle at 50% 40%, #C9663F 0%, ${warm.logo.tile} 55%, #8E3E21 100%)`
      : `radial-gradient(ellipse 60% 80% at 50% 50%, ${warm.colors.surface} 0%, ${look.bg} 70%, #E2D3BC 100%)`;

  const Layers = (
    <>
      <AbsoluteFill style={{ background }} />
      <AbsoluteFill style={{ WebkitMaskImage: mask, maskImage: mask }}>{deco}</AbsoluteFill>
      <Grain W={W} H={H} opacity={look.dark ? 0.22 : 0.3} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${H * 0.3}px ${H * 0.06}px ${look.dark ? look.bg : profile ? "#6E2F17" : "#CDB898"}`, opacity: look.dark ? 1 : 0.6 }} />
    </>
  );

  const goldText = (size: number): React.CSSProperties =>
    look.dark
      ? { background: `linear-gradient(180deg, ${look.gold2} 0%, ${look.gold} 55%, ${look.goldDeep} 100%)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", paddingBottom: size * 0.08 }
      : { color: profile ? warm.logo.baa : look.ink };

  // ---------- صورة الحساب: الرمز والاسم داخل الدائرة ----------
  if (profile) {
    const name = 118 * u;
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {Layers}
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 18 * u, paddingTop: 10 * u }}>
          <div style={{ filter: look.dark ? `drop-shadow(0 0 ${50 * u}px ${look.gold}55)` : `drop-shadow(0 ${10 * u}px ${24 * u}px #00000040)` }}>
            <LogoMark size={(look.dark ? 440 : 400) * u} colors={warm.logo} mark={ch.logo} tile={false} />
          </div>
          <div style={{ fontFamily: look.font, fontWeight: 700, fontSize: name, lineHeight: 1.05, whiteSpace: "nowrap", direction: "rtl", filter: look.dark ? `drop-shadow(0 0 ${18 * u}px ${look.gold}40)` : `drop-shadow(0 ${4 * u}px ${10 * u}px #00000033)`, ...goldText(name) }}>
            {ch.name}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // ---------- الأغلفة: كل المحتوى داخل المنطقة الآمنة ----------
  const safe = kind === "youtube" ? { w: 1546, h: 423 } : kind === "facebook" ? { w: 1180, h: 470 } : { w: 1060, h: 400 };
  const nameSize = 150 * u;
  const logo = (look.dark ? 300 : 250) * u;
  // في فيسبوك وX تغطي صورة الحساب الزاوية اليسرى، فنزيح المحتوى يمينًا قليلًا
  const offsetX = kind === "youtube" ? 0 : W * 0.06;
  const accent = look.dark ? look.gold : warm.colors.primary;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {Layers}
      <div
        style={{
          position: "absolute",
          left: (W - safe.w) / 2 + offsetX,
          top: (H - safe.h) / 2,
          width: safe.w,
          height: safe.h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 64 * u,
          direction: "rtl",
        }}
      >
        <div style={{ flex: "none", filter: look.dark ? `drop-shadow(0 0 ${logo * 0.16}px ${look.gold}66)` : `drop-shadow(0 ${12 * u}px ${26 * u}px #5A3A2240)` }}>
          <LogoMark size={logo} colors={warm.logo} mark={ch.logo} tile={!look.dark} />
        </div>
        {/* خط فاصل رأسي رفيع بين الرمز والاسم */}
        <div style={{ flex: "none", width: 2, height: safe.h * 0.62, background: `linear-gradient(180deg, transparent, ${accent}, transparent)`, opacity: 0.6 }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 * u }}>
          <div style={{ fontFamily: look.font, fontWeight: 700, fontSize: nameSize, lineHeight: 1.1, whiteSpace: "nowrap", filter: look.dark ? `drop-shadow(0 0 ${22 * u}px ${look.gold}33)` : undefined, ...goldText(nameSize) }}>{ch.name}</div>
          <Ornament width={nameSize * 3} color={accent} />
          {line ? <div style={{ fontFamily: fontFamilies.heading, fontWeight: 700, fontSize: 50 * u, lineHeight: 1.3, color: look.dark ? look.ink : look.soft, whiteSpace: "nowrap" }}>{line}</div> : null}
          <div style={{ fontFamily: "'Readex Pro', sans-serif", fontWeight: 500, fontSize: 22 * u, letterSpacing: "0.42em", color: accent, opacity: 0.85, direction: "ltr", textTransform: "uppercase", whiteSpace: "nowrap", marginTop: 4 * u }}>{ch.nameLatin}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
