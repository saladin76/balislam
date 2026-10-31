import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import land110 from "world-atlas/land-110m.json";
import { useTheme } from "../../brand/identity/index";
import { fontFamilies } from "../../brand/fonts";
import { useBrandFonts } from "./useBrandFonts";
import { Providers } from "./Providers";
import { ChannelLogo, useChannel } from "../channel/context";
import { LogoMark } from "../../brand/logo/Logo";
import type { Identity } from "../../brand/identity/index";
import type { ChannelInfo } from "../channel/types";

/**
 * صور القناة للمنصات: صورة الحساب (مربعة، تُقص دائرة)، وغلاف يوتيوب 2560×1440 (المنطقة الآمنة 1546×423 في الوسط)،
 * وغلاف فيسبوك 1640×624، وغلاف X ‏1500×500. كل قناة بأسلوبها: بالإسلام دافئ، ودفاتر الزمن ذهب على أسود، وزبدة الكتب كهرماني على أزرق ليلي.
 */
export type ArtKind = "profile" | "youtube" | "facebook" | "x";
export const artSizes: Record<ArtKind, { width: number; height: number }> = {
  profile: { width: 1024, height: 1024 },
  youtube: { width: 2560, height: 1440 },
  facebook: { width: 1640, height: 624 },
  x: { width: 1500, height: 500 },
};

export type ChannelArtProps = { kind: ArtKind; tagline?: string; schedule?: string; identity?: Identity; channel?: ChannelInfo };

export const ChannelArt: React.FC<ChannelArtProps> = ({ identity, channel, ...rest }) => (
  <Providers identity={identity} channel={channel}>
    <ArtInner {...rest} />
  </Providers>
);

type Look = { bg: string; glow: string; gold: string; gold2: string; ink: string; soft: string; font: string; deco: "arches" | "map" | "books" };
const LOOKS: Record<string, Look> = {
  "dafatir-alzaman": { bg: "#0C0907", glow: "#3A2614", gold: "#D4A24C", gold2: "#F3D99A", ink: "#F1E3C6", soft: "#B9A47F", font: "'Amiri', serif", deco: "map" },
  "zubdat-alkutub": { bg: "#071116", glow: "#16343E", gold: "#F2C46D", gold2: "#FBEFD2", ink: "#F3EEE4", soft: "#9DB3B8", font: fontFamilies.heading, deco: "books" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const land = feature(land110 as any, (land110 as any).objects.land) as unknown as GeoJSON.FeatureCollection;

const ArtInner: React.FC<Omit<ChannelArtProps, "identity" | "channel">> = ({ kind, tagline = "", schedule = "" }) => {
  useBrandFonts();
  const ch = useChannel();
  const warm = useTheme("warm");
  const { width: W, height: H } = artSizes[kind];
  // بالإسلام: من ثيمها الدافئ
  const look: Look = LOOKS[ch.id] ?? { bg: warm.colors.bg, glow: `${warm.colors.highlight}`, gold: warm.colors.primary, gold2: warm.colors.primary, ink: warm.colors.ink, soft: warm.colors.inkSoft, font: fontFamilies.wordmark, deco: "arches" };
  const dark = ch.id in LOOKS;

  const mapPath = useMemo(() => {
    if (look.deco !== "map") return "";
    const box: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: { type: "MultiPoint", coordinates: [[-12, 18], [72, 46]] } };
    const proj = geoMercator().fitExtent([[0, 0], [W, H]], box);
    return geoPath(proj)(land) ?? "";
  }, [look.deco, W, H]);

  const deco = (() => {
    if (look.deco === "map")
      return (
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <path d={mapPath} fill={look.gold} fillOpacity={0.05} stroke={look.gold} strokeOpacity={0.35} strokeWidth={kind === "youtube" ? 2.2 : 1.5} />
        </svg>
      );
    if (look.deco === "books") {
      const n = Math.ceil(W / 46);
      return (
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: n }, (_, i) => {
            const h = H * (0.18 + ((i * 37) % 23) / 100);
            const w = 26 + ((i * 13) % 14);
            return <rect key={i} x={i * 46} y={H - h} width={w} height={h} rx={3} fill={look.gold} opacity={0.05 + ((i * 7) % 5) / 100} />;
          })}
        </svg>
      );
    }
    // أقواس بالإسلام
    const aw = H * 0.36;
    const n = Math.ceil(W / aw) + 1;
    return (
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: n }, (_, i) => {
          const x = i * aw;
          return <path key={i} d={`M${x + aw * 0.12} ${H} V${H * 0.55} Q${x + aw * 0.12} ${H * 0.3} ${x + aw / 2} ${H * 0.2} Q${x + aw * 0.88} ${H * 0.3} ${x + aw * 0.88} ${H * 0.55} V${H}`} fill="none" stroke={look.gold} strokeOpacity={0.12} strokeWidth={Math.max(2, H / 260)} />;
        })}
      </svg>
    );
  })();

  if (kind === "profile") {
    return (
      <AbsoluteFill style={{ background: dark ? `radial-gradient(circle at 50% 42%, ${look.glow} 0%, ${look.bg} 70%)` : look.bg, alignItems: "center", justifyContent: "center" }}>
        {dark ? (
          <div style={{ filter: `drop-shadow(0 0 60px ${look.gold}66)` }}>
            <ChannelLogo theme={warm} size={600} tile={false} />
          </div>
        ) : (
          <LogoMark size={W} colors={warm.logo} mark={ch.logo} square />
        )}
      </AbsoluteFill>
    );
  }

  // مقاسات المحتوى داخل المنطقة الآمنة لكل منصة
  const safe = kind === "youtube" ? { w: 1546, h: 423 } : kind === "facebook" ? { w: 1100, h: 420 } : { w: 1000, h: 360 };
  const logo = safe.h * (kind === "youtube" ? 0.62 : 0.5);
  const nameSize = safe.h * (kind === "youtube" ? 0.36 : 0.3);
  const offsetX = kind === "youtube" ? 0 : W * 0.06; // الغلاف في فيسبوك وX تغطي صورة الحساب زاويته اليسرى

  return (
    <AbsoluteFill style={{ background: look.bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, ${dark ? look.glow : warm.colors.surface} 0%, transparent 60%)` }} />
      {deco}
      {dark ? <AbsoluteFill style={{ boxShadow: `inset 0 0 ${H * 0.35}px ${H * 0.1}px ${look.bg}` }} /> : null}
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
          gap: safe.h * 0.12,
          direction: "rtl",
        }}
      >
        <div style={{ filter: dark ? `drop-shadow(0 0 ${logo * 0.15}px ${look.gold}55)` : undefined, flex: "none" }}>
          <ChannelLogo theme={warm} size={logo} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: safe.h * 0.03 }}>
          <div
            style={{
              fontFamily: look.font,
              fontWeight: 700,
              fontSize: nameSize,
              lineHeight: 1.15,
              ...(dark
                ? { background: `linear-gradient(180deg, ${look.gold2} 0%, ${look.gold} 60%, #8A6326 100%)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }
                : { color: look.ink }),
              whiteSpace: "nowrap",
            }}
          >
            {ch.name}
          </div>
          {tagline ? <div style={{ fontFamily: fontFamilies.heading, fontWeight: 700, fontSize: nameSize * 0.34, color: dark ? look.ink : look.soft, whiteSpace: "nowrap" }}>{tagline}</div> : null}
          {schedule ? (
            <div style={{ display: "flex", alignItems: "center", gap: nameSize * 0.12, fontFamily: fontFamilies.heading, fontWeight: 700, fontSize: nameSize * 0.24, color: dark ? look.gold : warm.colors.primary, whiteSpace: "nowrap" }}>
              <span style={{ width: nameSize * 0.6, height: 3, background: dark ? look.gold : warm.colors.primary, borderRadius: 2 }} />
              {schedule}
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
