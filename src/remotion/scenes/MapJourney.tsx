import React, { useMemo } from "react";
import { Easing, interpolate, spring, useVideoConfig } from "remotion";
import { geoGraticule10, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import land50 from "world-atlas/land-50m.json";
import { fontFamilies } from "../../../brand/fonts";
import { parsePlace, rivers } from "../../geo/places";
import { SceneShell } from "./SceneShell";
import { useLang } from "../../i18n/context";
import { useSceneFrame } from "./motion";
import type { SceneBase, StringFields } from "./types";

/**
 * «الخريطة المتحركة»: خريطة حقيقية (Natural Earth) لمنطقة الأحداث تُضبط على الأماكن المذكورة،
 * ومسار يُرسم من مكان إلى مكان وعليه رمز يتحرك (قافلة، جيش، سفينة)، والدبابيس تسقط حين يصلها المسار.
 * أسلوبان: رَقّ قديم بالحبر، أو ليل سينمائي بالذهب.
 */
export type MapJourneyProps = SceneBase & StringFields<"title" | "places" | "mode" | "mover" | "look" | "rivers" | "zoom">;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const landGeo = feature(land50 as any, (land50 as any).objects.land) as unknown as GeoJSON.FeatureCollection;

const LOOKS = {
  parchment: { sea: "#A9BBB2", sea2: "#8EA398", land: "#F1E3C4", coast: "#6B4A2E", grid: "#8A6B45", route: "#8E2F23", label: "#2E1F14", halo: "#F1E3C4", river: "#6E95A6", pin: "#8E2F23", vignette: "rgba(60,35,15,.55)", font: "'Amiri', serif" },
  night: { sea: "#0A1218", sea2: "#05090C", land: "#2C3B3B", coast: "#C9A25A", grid: "#C9A25A", route: "#E8B64C", label: "#F1E6CF", halo: "#0B1419", river: "#4F7F8C", pin: "#E8B64C", vignette: "rgba(0,0,0,.7)", font: "'Amiri', serif" },
} as const;

/** نقاط منحنى بين مكانين (يرتفع قليلًا ليبدو كمسار رحلة) */
const curve = (a: [number, number], b: [number, number], n = 40) => {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const c: [number, number] = [mx - dy * 0.18, my + dx * 0.18 - Math.hypot(dx, dy) * 0.08];
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]] as [number, number];
  });
};

export const MapJourney: React.FC<MapJourneyProps> = (props) => {
  const { orientation, title = "", places: placesText = "", mode = "route", mover = "caravan", look: lookId = "parchment", rivers: showRivers = "on", zoom = "in" } = props;
  const frame = useSceneFrame();
  const { fps, durationInFrames, width: W, height: H } = useVideoConfig();
  const lang = useLang();
  const portrait = orientation === "portrait";
  const look = LOOKS[lookId === "night" ? "night" : "parchment"];

  const pts = useMemo(() => placesText.split(/\n|،(?=\s*\S)/).map((l) => parsePlace(l)).filter((x): x is NonNullable<typeof x> => Boolean(x)), [placesText]);

  // الإسقاط: يحيط بالأماكن مع هامش، ولا يقل عن مساحة إقليم
  const geo = useMemo(() => {
    const list = pts.length ? pts : [{ name: "", at: [36, 30] as [number, number] }];
    const lons = list.map((p) => p.at[0]);
    const lats = list.map((p) => p.at[1]);
    let [x0, x1, y0, y1] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
    const minSpan = 9;
    if (x1 - x0 < minSpan) [x0, x1] = [(x0 + x1) / 2 - minSpan / 2, (x0 + x1) / 2 + minSpan / 2];
    if (y1 - y0 < minSpan * 0.6) [y0, y1] = [(y0 + y1) / 2 - minSpan * 0.3, (y0 + y1) / 2 + minSpan * 0.3];
    const padX = (x1 - x0) * 0.22;
    const padY = (y1 - y0) * 0.3;
    const box: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: { type: "MultiPoint", coordinates: [[x0 - padX, y0 - padY], [x1 + padX, y1 + padY]] } };
    const margin = portrait ? [80, 380] : [120, 150];
    const proj = geoMercator().fitExtent([[margin[0]!, margin[1]!], [W - margin[0]!, H - margin[1]! + (portrait ? 0 : 40)]], box);
    const path = geoPath(proj);
    const project = (p: [number, number]) => proj(p) as [number, number];
    // المسار عبر الأماكن بالترتيب
    const route = list.length > 1 ? list.slice(1).flatMap((p, i) => curve(project(list[i]!.at), project(p.at)).slice(i ? 1 : 0)) : [];
    const lens = [0];
    for (let i = 1; i < route.length; i++) lens.push(lens[i - 1]! + Math.hypot(route[i]![0] - route[i - 1]![0], route[i]![1] - route[i - 1]![1]));
    // طول المسار عند الوصول لكل مكان
    const arrive = list.map((_, i) => (i === 0 ? 0 : lens[Math.min(lens.length - 1, i * 40)] ?? 0));
    return {
      land: path(landGeo) ?? "",
      grid: path(geoGraticule10()) ?? "",
      rivers: rivers.map((r) => path({ type: "LineString", coordinates: r.points }) ?? ""),
      pts: list.map((p) => ({ name: p.name, xy: project(p.at) })),
      route,
      lens,
      total: lens[lens.length - 1] ?? 0,
      arrive,
    };
  }, [pts, W, H, portrait]);

  // التوقيت
  const start = 14;
  const end = Math.max(start + 30, durationInFrames - 30);
  const prog = interpolate(frame, [start, end], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const drawn = prog * geo.total;
  const k = geo.route.findIndex((_, i) => (geo.lens[i] ?? 0) >= drawn);
  const head = geo.route[k < 0 ? geo.route.length - 1 : Math.max(0, k)] ?? geo.pts[0]?.xy ?? [W / 2, H / 2];
  const routeD = geo.route.slice(0, k < 0 ? geo.route.length : Math.max(1, k + 1)).map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const routeAll = geo.route.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

  // الكاميرا: اقتراب بطيء يتبع رأس المسار
  const z = zoom === "off" ? 1 : interpolate(frame, [0, durationInFrames], [1, zoom === "follow" ? 1.35 : 1.12], { ...clamp, easing: Easing.inOut(Easing.quad) });
  // المتابعة: الكاميرا تتجه نحو رأس المسار دون أن تقفز (نصف المسافة بين المركز والرأس)
  const fx = zoom === "follow" ? W / 2 + (head[0] - W / 2) * 0.55 : W / 2;
  const fy = zoom === "follow" ? H / 2 + (head[1] - H / 2) * 0.55 : H / 2;
  const titleIn = interpolate(frame, [0, 14], [0, 1], clamp);
  const route = mode !== "points";

  const moverIcon = (() => {
    if (!route || mover === "none" || !geo.route.length || prog <= 0 || prog >= 1) return null;
    const nxt = geo.route[Math.min(geo.route.length - 1, (k < 0 ? geo.route.length - 1 : k) + 1)] ?? head;
    const ang = (Math.atan2(nxt[1] - head[1], nxt[0] - head[0]) * 180) / Math.PI;
    const flip = Math.abs(ang) > 90;
    return (
      <g transform={`translate(${head[0]} ${head[1]})`}>
        <circle r={34} fill={look.route} opacity={0.18} />
        <g transform={`scale(${flip ? -1 : 1} 1) translate(-30 -34)`} fill={look.label} stroke={look.halo} strokeWidth={2}>
          {mover === "ship" ? (
            <path d="M6 44 H54 L46 56 H14 Z M30 10 V44 M30 12 L50 38 H30 Z" />
          ) : mover === "army" ? (
            <path d="M18 54 L22 24 L30 14 L38 24 L42 54 Z M30 14 V2 M30 4 L46 10 L30 14" />
          ) : (
            <path d="M4 44 Q12 22 26 28 Q32 14 44 26 Q52 24 54 34 L60 22 Q66 14 70 22 L66 40 Q62 48 54 46 L52 58 H48 L46 46 H18 L16 58 H12 L10 46 Q4 48 4 44 Z" />
          )}
        </g>
      </g>
    );
  })();

  return (
    <SceneShell {...props} themeId={lookId === "night" ? "night" : "warm"} motif={false} background={look.sea} durationInFrames={durationInFrames}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="mj-sea" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stopColor={look.sea} /><stop offset="1" stopColor={look.sea2} /></radialGradient>
          <filter id="mj-rough"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={3} /><feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0.12 0" /><feComposite in2="SourceGraphic" operator="in" /></filter>
        </defs>
        <rect width={W} height={H} fill="url(#mj-sea)" />
        <g transform={zoom === "follow" ? `translate(${W / 2} ${H / 2}) scale(${z}) translate(${-fx} ${-fy})` : `translate(${fx} ${fy}) scale(${z}) translate(${-fx} ${-fy})`}>
          <path d={geo.grid} fill="none" stroke={look.grid} strokeWidth={1} opacity={0.18} />
          <path d={geo.land} fill={look.land} stroke={look.coast} strokeWidth={2.4} strokeLinejoin="round" />
          {lookId !== "night" ? <path d={geo.land} fill="#000" filter="url(#mj-rough)" opacity={0.9} /> : null}
          {showRivers !== "off" ? geo.rivers.map((d, i) => <path key={i} d={d} fill="none" stroke={look.river} strokeWidth={3} strokeLinecap="round" opacity={0.8} />) : null}
          {route && geo.route.length ? (
            <>
              <path d={routeAll} fill="none" stroke={look.route} strokeWidth={3} strokeDasharray="2 12" strokeLinecap="round" opacity={0.25} />
              <path d={routeD} fill="none" stroke={look.route} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="22 12" style={{ filter: lookId === "night" ? `drop-shadow(0 0 8px ${look.route})` : undefined }} />
            </>
          ) : null}
          {geo.pts.map((p, i) => {
            const at = route ? start + ((geo.arrive[i] ?? 0) / Math.max(1, geo.total)) * (end - start) : start + i * 14;
            const s = spring({ frame: frame - at, fps, config: { damping: 11, stiffness: 150 } });
            const pulse = (frame - at) > 0 ? ((frame - at) % 40) / 40 : 0;
            const left = p.xy[0] > W * 0.62;
            return (
              <g key={i} transform={`translate(${p.xy[0]} ${p.xy[1]})`} opacity={Math.min(1, s * 1.4)}>
                <circle r={10 + pulse * 30} fill="none" stroke={look.pin} strokeWidth={3} opacity={(1 - pulse) * 0.6 * s} />
                <g transform={`translate(0 ${(1 - s) * -40}) scale(${s})`}>
                  <path d="M0 0 C-14 -16 -16 -24 -16 -30 A16 16 0 0 1 16 -30 C16 -24 14 -16 0 0 Z" fill={look.pin} stroke={look.halo} strokeWidth={3} />
                  <circle cy={-30} r={6} fill={look.halo} />
                </g>
                <text x={left ? -26 : 26} y={-18} textAnchor={left ? "start" : "end"} fontFamily={look.font} fontWeight={700} fontSize={portrait ? 46 : 40} fill={look.label} stroke={look.halo} strokeWidth={8} paintOrder="stroke" opacity={s} direction="rtl">{p.name}</text>
              </g>
            );
          })}
          {moverIcon}
        </g>
        <rect width={W} height={H} fill="none" style={{ filter: "none" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 ${portrait ? 220 : 260}px ${look.vignette}`, pointerEvents: "none" }} />
      {title ? (
        <div style={{ position: "absolute", top: portrait ? 230 : 60, left: 0, right: 0, textAlign: "center", opacity: titleIn, transform: `translateY(${(1 - titleIn) * -14}px)` }}>
          <span style={{ fontFamily: look.font, fontWeight: 700, fontSize: portrait ? 76 : 66, color: look.label, background: `${look.halo}d9`, padding: "4px 34px", borderRadius: 12, border: `2px solid ${look.coast}`, direction: lang.dir }}>{title}</span>
        </div>
      ) : null}
      {pts.length === 0 ? <div style={{ position: "absolute", bottom: 160, width: "100%", textAlign: "center", fontFamily: fontFamilies.body, fontSize: 34, color: look.label }}>اكتب الأماكن سطرًا سطرًا (مثل: دمشق، بغداد)</div> : null}
    </SceneShell>
  );
};

export const mapJourneySample: Omit<MapJourneyProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 1 · الطريق إلى الأندلس",
  title: "من دمشق إلى قرطبة",
  places: "دمشق\nالقيروان\nجبل طارق\nقرطبة",
  mode: "route",
  mover: "caravan",
  look: "parchment",
  rivers: "on",
  zoom: "in",
  narration: "خرج عبد الرحمن من دمشق هاربًا، وقطع شمال أفريقيا كله حتى عبر إلى الأندلس.",
  captions: false,
};
export const mapJourneySampleEn: Omit<MapJourneyProps, "themeId" | "orientation"> = { ...mapJourneySample, title: "From Damascus to Cordoba", narration: "He fled Damascus and crossed North Africa until he reached al-Andalus." };
export const mapJourneySeconds = 8;
