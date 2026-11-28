/**
 * D251: لوحات ستوري بورد «الخريطة الحيّة» و«المكان والنور» لدفاتر الزمن — صور ثابتة للمراجعة وحدها، لا قالب إنتاج.
 *
 * الخريطة الحيّة (نموذجا أ وب):
 * - جغرافيا حقيقية: سواحل Natural Earth (world-atlas، ملكية عامة) بإسقاط مركاتور على خطوط الطول والعرض الحقيقية، كقالب
 *   «الخريطة المتحركة»؛ ثم منظور ثلاثي الأبعاد حقيقي (كاميرا مائلة قريبة) كـ«مكتب الرحّالة»: الخريطة على سطح.
 * - تضاريس بارزة: قمم ثلاثية الأبعاد على سلاسل الجبال الحقيقية بإحداثياتها (السروات، طوروس، زاغروس، لبنان…) بوجه مضاء
 *   من الغرب (ضوء الغروب) ووجه في الظل وظل ملقى على الأرض؛ والحرّات السوداء (رهط، خيبر، الشام…) والأودية في مواضعها.
 *   (في الستوري بورد السلاسل مرسومة على خطوطها؛ وفي القالب طبقة ارتفاع حقيقية، انظر اقرأني.)
 * - المسار (في الحلقات التي فيها مسار ثابت) خط يُرسم وحده: لا علامة تتحرك عليه. وما لا نعلم موضعه لا دبوس له.
 * - «الكرة الحيّة» بمظهر القناة (DAFATIR_GLOBE) تفتتح، والكاميرا تنزل منها.
 *
 * المكان والنور (نموذجا ج ود): طبقات كثيرة بعمق (2.5D) بضوء الغسق أو الفجر وضباب وغبار في الضوء، بلا قرص شمس ولا أشعة.
 * الأماكن عامة ما لم يثبت تفصيلها في البحث (002: أرض بكر بلا مكان ثابت؛ 008: جبل عام لا يطابق قمة معاصرة).
 *
 * لا شخصية، ولا ظل ولا ضوء ينوب عن أحد (حكم المراجعة العلمية): العناصر من PM_ELEMENTS وحدها (boards.ts) والاختبار يفحص
 * هذا الملف. والآية بطاقة داخل المشهد كما في 001 (VerseCard، D242/D246)، والراوي مستمر، والمشهد ساكن طول قراءتها.
 * لا يُسجَّل في sceneCatalog ولا في قوالب الخطة؛ يُرندر على جهاز الرندر بمهمة «stills» وحدها (D247).
 */
import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { geoContains, geoMercator, geoOrthographic, geoPath, geoTransform, type GeoProjection, type GeoStream } from "d3-geo";
import { feature } from "topojson-client";
import land50 from "world-atlas/land-50m.json";
import land110 from "world-atlas/land-110m.json";
import { useBrandFonts } from "../../useBrandFonts";
import { rivers as RIVERS } from "../../../geo/places";
import { C, Caption, VerseCard, rng } from "../horizon/kit";
import { DAFATIR_GLOBE } from "../geo/look";
import { NISA_1, NISA_1_KEY, PM_BOARDS, type PmVariant } from "./boards";

const W = 1920, H = 1080;
const AMIRI = "'Amiri', serif", TAJ = "'Tajawal', sans-serif";
type LL = [number, number];
type Pt = [number, number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LAND50 = feature(land50 as any, (land50 as any).objects.land) as unknown as GeoJSON.FeatureCollection;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LAND110 = feature(land110 as any, (land110 as any).objects.land) as unknown as GeoJSON.FeatureCollection;

/** ألوان القالبين: من لوحة «دفتر الأفق» (C) ومظهر الكرة المعتمد ودرجاتها المشتقة */
const PM = {
  sea: DAFATIR_GLOBE.sea,
  seaDeep: "#A99DB8",
  land: C.parchment,
  landWarm: "#EAD7B4",
  coast: C.ink,
  lit: "#F6E7C8",
  shade: "#8E6E58",
  shadeDeep: "#5E4535",
  harra: "#2B2220",
  wadi: "#9C7A5C",
  river: "#5B5287",
  desk: C.dusk,
  deskDeep: "#140E20",
  ember: C.ember,
  sand: C.sand,
  gold: C.gold,
  ribbon: C.ribbon,
  night: C.night,
} as const;

// ───────────────────────── المنظور ─────────────────────────
type Cam = { tilt: number; dist: number; f: number; x0: number; y0: number; yaw?: number };
type P3 = (x: number, y: number, z?: number) => [number, number, number];
/** كاميرا فوق مستوى الخريطة تنظر إلى مركزه بميل tilt (درجات من الرأسي)؛ الشمال إلى أعلى الشاشة */
const camera = (c: Cam): P3 => {
  const t = (c.tilt * Math.PI) / 180, st = Math.sin(t), ct = Math.cos(t);
  const yw = ((c.yaw ?? 0) * Math.PI) / 180, cy = Math.cos(yw), sy = Math.sin(yw);
  return (x, y, z = 0) => {
    const X = x * cy - y * sy, Y = x * sy + y * cy;
    const yc = -ct * Y + st * z, zc = -st * Y - ct * z + c.dist;
    return [c.x0 + (c.f * X) / zc, c.y0 - (c.f * yc) / zc, zc];
  };
};
const perspectivePath = (merc: GeoProjection, p3: P3) => {
  const t = geoTransform({ point(x, y) { const q = p3(x, y, 0); this.stream.point(q[0], q[1]); } });
  return geoPath({ stream: (s: GeoStream) => merc.stream(t.stream(s)) });
};
const poly = (pts: Pt[]) => `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L")} Z`;
const line = (pts: Pt[]) => `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L")}`;
/** مصفوفة محلية للمستوى عند نقطة: عنصر مسطح يُرسم بوحدات المستوى عند (0,0) فيستلقي على الخريطة */
const planeMatrix = (p3: P3, x: number, y: number) => {
  const a = p3(x, y), b = p3(x + 1, y), c = p3(x, y + 1);
  return `matrix(${b[0] - a[0]} ${b[1] - a[1]} ${c[0] - a[0]} ${c[1] - a[1]} ${a[0]} ${a[1]})`;
};

// ───────────────────────── الجغرافيا ─────────────────────────
/** سلاسل الجبال بخطوط قممها التقريبية (خط الطول، خط العرض) وارتفاعها في الرسم */
const RIDGES: { pts: LL[]; h: number }[] = [
  { pts: [[35.5, 28.6], [36.6, 27], [37.8, 25.2], [38.9, 23.5], [40.2, 21.5], [41.3, 19.6], [42.5, 17.6], [43.4, 15.8]], h: 46 }, // السروات والحجاز
  { pts: [[43.6, 16.2], [44.1, 14.8], [44.4, 13.6]], h: 58 }, // مرتفعات اليمن
  { pts: [[35.6, 33.0], [36.0, 33.8], [36.4, 34.6]], h: 44 }, // لبنان
  { pts: [[30.5, 37.1], [32.5, 37.1], [34.5, 37.3], [36.5, 37.9], [38.5, 38.2], [40.5, 38.5], [42.5, 38.2]], h: 54 }, // طوروس
  { pts: [[45.4, 36.6], [46.5, 35.1], [47.5, 33.8], [48.8, 32.6], [50.5, 30.8], [52, 29.6], [54, 28.4], [56, 27.5]], h: 52 }, // زاغروس
  { pts: [[33.9, 28.7], [34.2, 28.3]], h: 40 }, // سيناء
  { pts: [[56.2, 25.9], [57, 24.1], [58.6, 23.1]], h: 42 }, // الحجر بعُمان
  { pts: [[33.6, 27], [34.6, 25], [35.6, 23]], h: 30 }, // جبال البحر الأحمر
  { pts: [[40, 40.1], [42, 40.2], [44.3, 39.8]], h: 64 }, // الهضبة الأرمنية
  { pts: [[38.5, 44], [42, 43.1], [45.5, 42.2], [48.5, 41.2]], h: 72 }, // القوقاز
  { pts: [[48.5, 37.6], [51, 36.2], [54, 36.7]], h: 60 }, // البرز
  { pts: [[37, 8.5], [38, 10.5], [39, 12.6], [39.4, 14.2]], h: 54 }, // الحبشة
  { pts: [[-8, 31], [-4, 32.6], [0, 34.1], [5, 35.6], [9, 36.2]], h: 46 }, // الأطلس
  { pts: [[6, 45.2], [9, 46.3], [13, 46.8]], h: 54 }, // الألب
  { pts: [[67, 35], [70, 35.6], [73, 36]], h: 80 }, // هندوكوش
  { pts: [[73.5, 35], [78, 33], [82, 30.2], [86, 28], [90, 27.8], [95, 28.4]], h: 96 }, // الهملايا
];
/** الحرّات (حقول اللابة السوداء): المركز وأنصاف الأقطار بالدرجات */
const HARRAT: { at: LL; rx: number; ry: number }[] = [
  { at: [39.9, 23.4], rx: 0.38, ry: 1.0 }, // رهط
  { at: [40.0, 25.6], rx: 0.5, ry: 0.6 }, // خيبر
  { at: [37.4, 27.0], rx: 0.4, ry: 0.5 }, // عويرض
  { at: [41.3, 22.8], rx: 0.3, ry: 0.42 }, // كشب
  { at: [37.3, 31.7], rx: 0.9, ry: 0.6 }, // حرّة الشام
  { at: [42.2, 26.9], rx: 0.3, ry: 0.3 }, // هتيمة
  { at: [41.6, 18.4], rx: 0.3, ry: 0.3 }, // البرك
];
/** أودية كبرى بخطوطها التقريبية */
const WADIS: LL[][] = [
  [[40.6, 25.9], [41.8, 26.2], [43, 26.3], [44, 26.4], [45, 27.2], [46.2, 28.3], [47.6, 29.4]], // الرمة والباطن
  [[37.0, 31.6], [37.8, 30.9], [38.6, 30.2], [39.3, 29.6]], // السرحان
  [[42.6, 19.8], [42.9, 21.2], [43.6, 22.6], [44.6, 23.6]], // بيشة وتثليث
  [[39.6, 24.7], [38.6, 25.2], [37.5, 25.7], [37.2, 25.9]], // الحمض
];

type Peak = { depth: number; faces: { d: string; fill: string; o: number }[]; shadow: string };
const buildPeaks = (merc: GeoProjection, p3: P3, scale: number, seed: number, clip: (x: number, y: number) => boolean): Peak[] => {
  const r = rng(seed);
  const out: Peak[] = [];
  for (const ridge of RIDGES) {
    const pts = ridge.pts.map((ll) => merc(ll) as Pt);
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1]!, pts[i]!];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const step = Math.max(9, 15 * scale);
      const n = Math.max(1, Math.floor(len / step));
      const nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1);
      for (let k = 0; k < n; k++) {
        const t = (k + r()) / n;
        const off = (r() - 0.5) * 34 * scale;
        const x = a[0] + (b[0] - a[0]) * t + nx * off, y = a[1] + (b[1] - a[1]) * t + ny * off;
        if (!clip(x, y)) continue;
        const h = ridge.h * scale * (0.45 + r() * 0.7);
        const w = h * (0.95 + r() * 0.5);
        const ax = x + (r() - 0.5) * w * 0.3, ay = y + (r() - 0.5) * w * 0.2;
        const P = (px: number, py: number, pz = 0): Pt => { const q = p3(px, py, pz); return [q[0], q[1]]; };
        const apex = P(ax, ay, h), Wb = P(x - w, y), Sb = P(x, y + w * 0.7), Eb = P(x + w, y), Nb = P(x, y - w * 0.7);
        const tip = P(x + h * 1.7, y - h * 0.25);
        out.push({
          depth: p3(x, y)[2],
          shadow: poly([Nb, tip, Sb, Eb]),
          faces: [
            { d: poly([Nb, Wb, apex]), fill: PM.lit, o: 1 },
            { d: poly([Eb, Nb, apex]), fill: PM.shadeDeep, o: 1 },
            { d: poly([Wb, Sb, apex]), fill: PM.lit, o: 1 },
            { d: poly([Sb, Eb, apex]), fill: PM.shade, o: 1 },
          ],
        });
      }
    }
  }
  return out.sort((p, q) => q.depth - p.depth);
};
const blob = (merc: GeoProjection, p3: P3, h: { at: LL; rx: number; ry: number }, seed: number): string => {
  const r = rng(seed);
  const n = 26;
  const ph = [r() * 6.28, r() * 6.28];
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.18 * Math.sin(a * 3 + ph[0]!) + 0.12 * Math.sin(a * 5 + ph[1]!) + (r() - 0.5) * 0.12;
    const m = merc([h.at[0] + Math.cos(a) * h.rx * k, h.at[1] + Math.sin(a) * h.ry * k]) as Pt;
    const q = p3(m[0], m[1]);
    pts.push([q[0], q[1]]);
  }
  return poly(pts);
};

// ───────────────────────── الخريطة الحيّة ─────────────────────────
type MapView = {
  center: LL; scale: number; cam: Cam;
  /** حدود الورقة (أ) أو الأرض (ب) بوحدات المستوى */
  ext: [number, number, number, number];
  sheet: boolean;
  fog?: boolean; tray?: boolean; legend?: boolean; stamp?: boolean; wash?: boolean;
  reliefScale: number;
};
const MAP_VIEWS: Record<string, MapView> = {
  "1a": { center: [42, 27.5], scale: 4300, cam: { tilt: 52, dist: 1500, f: 1300, x0: 960, y0: 500 }, ext: [-900, -640, 900, 640], sheet: true, fog: true, reliefScale: 1 },
  "2a": { center: [41, 27], scale: 4600, cam: { tilt: 56, dist: 1350, f: 1250, x0: 1000, y0: 470, yaw: -6 }, ext: [-950, -700, 950, 700], sheet: true, tray: true, legend: true, stamp: true, reliefScale: 1.1 },
  "2b": { center: [42, 25.5], scale: 3000, cam: { tilt: 70, dist: 1400, f: 1350, x0: 960, y0: 640 }, ext: [-8000, -4600, 8000, 1180], sheet: false, legend: true, stamp: true, reliefScale: 0.85 },
  "3a": { center: [42, 25], scale: 760, cam: { tilt: 40, dist: 1800, f: 1500, x0: 1330, y0: 470 }, ext: [-760, -560, 760, 560], sheet: true, wash: true, reliefScale: 0.42 },
};

const MapStill: React.FC<{ view: MapView; id: string; seed: number }> = ({ view, id, seed }) => {
  const g = useMemo(() => {
    const [x0, y0, x1, y1] = view.ext;
    const merc = geoMercator().center(view.center).scale(view.scale).translate([0, 0]).clipExtent([[x0, y0], [x1, y1]]);
    const p3 = camera(view.cam);
    const path = perspectivePath(merc, p3);
    const inside = (x: number, y: number) => x > x0 + 10 && x < x1 - 10 && y > y0 + 10 && y < y1 - 10;
    const P = (x: number, y: number): Pt => { const q = p3(x, y); return [q[0], q[1]]; };
    const sheetPts: Pt[] = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
    const graticule: string[] = [];
    for (let lon = -180; lon <= 180; lon += 10) graticule.push(path({ type: "LineString", coordinates: Array.from({ length: 33 }, (_, i) => [lon, -80 + i * 5]) }) ?? "");
    for (let lat = -80; lat <= 80; lat += 10) graticule.push(path({ type: "LineString", coordinates: Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]) }) ?? "");
    const peaks = buildPeaks(merc, p3, view.reliefScale, seed, inside);
    const harrat = view.scale > 2000 ? HARRAT.map((h, i) => blob(merc, p3, h, seed + i * 7)) : [];
    const wadis = view.scale > 2000 ? WADIS.map((w) => path({ type: "LineString", coordinates: w }) ?? "") : [];
    const rivers = RIVERS.map((rv) => path({ type: "LineString", coordinates: rv.points }) ?? "");
    // دفء الانتشار: بقع ناعمة على اليابسة في كل الجهات معًا (لا نقطة انطلاق)
    const warm: { x: number; y: number; r: number }[] = [];
    if (view.wash) {
      const rr = rng(seed + 99);
      for (let lon = -18; lon <= 140; lon += 7) for (let lat = -34; lat <= 62; lat += 7) {
        const ll: LL = [lon + (rr() - 0.5) * 5, lat + (rr() - 0.5) * 5];
        if (!geoContains(LAND110, ll)) continue;
        const m = merc(ll) as Pt;
        if (!inside(m[0], m[1])) continue;
        const q = p3(m[0], m[1]);
        warm.push({ x: q[0], y: q[1], r: (view.cam.f / q[2]) * (26 + rr() * 22) });
      }
    }
    // حد ما نعرف: قطع ناقص حول المركز بوحدات المستوى
    const known: Pt[] = Array.from({ length: 72 }, (_, i) => { const a = (i / 72) * Math.PI * 2; return P(Math.cos(a) * 430, Math.sin(a) * 300 + 40); });
    // سطح المكتب: مستوى أكبر حول الورقة، وعروق خفيفة
    const deskPts: Pt[] = [P(-3000, -3000), P(3000, -3000), P(3000, 1200), P(-3000, 1200)];
    const r = rng(seed + 5);
    const grain: string[] = [];
    for (let k = 0; k < 46; k++) {
      const gy = -2600 + k * 82 + r() * 30;
      grain.push(line(Array.from({ length: 25 }, (_, i) => P(-3000 + i * 250, gy + Math.sin(i * 0.9 + k) * 12))));
    }
    return { path, land: path(LAND50) ?? "", sheetPts, graticule, peaks, harrat, wadis, rivers, warm, known, deskPts, grain, P, p3 };
  }, [view, seed]);

  const sheetD = poly(g.sheetPts);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PM.deskDeep} />
          <stop offset="0.55" stopColor={PM.desk} />
          <stop offset="1" stopColor="#6B3F55" />
        </linearGradient>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0" stopColor={PM.ember} stopOpacity="0.28" />
          <stop offset="0.45" stopColor={PM.sand} stopOpacity="0.06" />
          <stop offset="1" stopColor={PM.night} stopOpacity="0.32" />
        </linearGradient>
        <filter id={`${id}-paper`} x="0" y="0" width="1" height="1">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed={seed} result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.29  0 0 0 0 0.18  0 0 0 0 0.12  0 0 0 0.20 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id={`${id}-soft`}><feGaussianBlur stdDeviation="6" /></filter>
        <filter id={`${id}-fogblur`} x="-0.3" y="-0.3" width="1.6" height="1.6"><feGaussianBlur stdDeviation="70" /></filter>
        <filter id={`${id}-warmblur`} x="-0.5" y="-0.5" width="2" height="2"><feGaussianBlur stdDeviation="22" /></filter>
        <clipPath id={`${id}-sheet`}><path d={sheetD} /></clipPath>
        <clipPath id={`${id}-land`}><path d={g.land} /></clipPath>
        <mask id={`${id}-fogmask`}>
          <path d={sheetD} fill="#fff" />
          <path d={poly(g.known)} fill="#000" filter={`url(#${id}-fogblur)`} />
        </mask>
        <linearGradient id={`${id}-horizon`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3B2A4E" />
          <stop offset="0.6" stopColor="#8A5A62" />
          <stop offset="1" stopColor="#D99A6C" />
        </linearGradient>
        <linearGradient id={`${id}-farhaze`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D99A6C" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#C9A0A0" stopOpacity="0.45" />
          <stop offset="0.7" stopColor="#C9A0A0" stopOpacity="0" />
        </linearGradient>
      </defs>

      {view.sheet ? (
        <>
          {/* السطح: غسق داكن بعروق خشب خفيفة */}
          <rect width={W} height={H} fill={`url(#${id}-sky)`} />
          <path d={poly(g.deskPts)} fill={PM.desk} />
          {g.grain.map((d, i) => <path key={i} d={d} stroke="#3B2C52" strokeWidth={i % 3 ? 1.2 : 2.2} fill="none" opacity={0.55} />)}
          {/* ظل الورقة على السطح */}
          <path d={sheetD} fill="#000" opacity={0.45} transform="translate(18 22)" filter={`url(#${id}-soft)`} />
          <path d={sheetD} fill={PM.land} />
        </>
      ) : (
        <>
          <rect width={W} height={H} fill={`url(#${id}-horizon)`} />
          <path d={sheetD} fill={PM.sea} />
        </>
      )}

      <g clipPath={`url(#${id}-sheet)`}>
        <path d={sheetD} fill={PM.sea} />
        {g.graticule.map((d, i) => <path key={i} d={d} stroke={PM.coast} strokeWidth={0.8} opacity={0.18} fill="none" />)}
        <path d={g.land} fill={view.sheet ? PM.land : PM.landWarm} stroke={PM.coast} strokeWidth={2.2} strokeLinejoin="round" />
        {view.wash ? (
          <g clipPath={`url(#${id}-land)`} filter={`url(#${id}-warmblur)`}>
            {g.warm.map((w, i) => <circle key={i} cx={w.x} cy={w.y} r={w.r} fill={PM.ember} opacity={0.42} />)}
          </g>
        ) : null}
        {g.harrat.map((d, i) => (
          <g key={i}>
            <path d={d} fill={PM.harra} opacity={0.78} />
            <path d={d} fill="none" stroke={PM.harra} strokeWidth={1.2} strokeDasharray="2 5" opacity={0.6} transform="translate(2 1)" />
          </g>
        ))}
        {g.wadis.map((d, i) => <path key={i} d={d} stroke={PM.wadi} strokeWidth={2} strokeDasharray="7 5" fill="none" opacity={0.75} />)}
        {g.rivers.map((d, i) => <path key={i} d={d} stroke={PM.river} strokeWidth={view.scale > 2000 ? 3 : 1.6} fill="none" strokeLinecap="round" opacity={0.85} />)}
        {g.peaks.map((p, i) => <path key={`s${i}`} d={p.shadow} fill={PM.shadeDeep} opacity={0.16} />)}
        {g.peaks.map((p, i) => (
          <g key={i}>
            {p.faces.map((f, k) => <path key={k} d={f.d} fill={f.fill} opacity={f.o} stroke={PM.coast} strokeWidth={0.5} strokeOpacity={0.35} strokeLinejoin="round" />)}
          </g>
        ))}
        {view.sheet ? <path d={sheetD} fill="#fff" filter={`url(#${id}-paper)`} /> : null}
        {view.fog ? <path d={sheetD} fill="#F4EAD6" mask={`url(#${id}-fogmask)`} opacity={0.96} /> : null}
      </g>
      {view.sheet ? <path d={sheetD} fill="none" stroke={C.inkSoft} strokeWidth={2} opacity={0.7} /> : <rect width={W} height={H * 0.36} fill={`url(#${id}-farhaze)`} />}

      {/* ضوء الغروب الجانبي على المشهد كله */}
      <rect width={W} height={H} fill={`url(#${id}-light)`} />

      {view.legend ? <Legend id={id} p3={g.p3} sheet={view.sheet} at={view.sheet ? [-560, 360] : [0, 0]} empty={!view.sheet} /> : null}
      {view.tray ? <PinTray id={id} p3={g.p3} at={[-80, 400]} /> : null}
      {view.stamp ? <Stamp p3={g.p3} at={view.sheet ? [520, -380] : null} /> : null}
    </svg>
  );
};

/** مفتاح الخريطة: «ضوء = موضع ثابت بدليل» (ورقة على الخريطة في أ، ولوحة في الزاوية مع عدّاد «٠» في ب) */
const Legend: React.FC<{ id: string; p3: P3; sheet: boolean; at: Pt; empty: boolean }> = ({ id, p3, sheet, at, empty }) => {
  const body = (
    <g>
      <rect x={-250} y={-120} width={500} height={250} rx={10} fill="#FBF4E6" stroke={C.ink} strokeWidth={2.5} />
      <rect x={-238} y={-108} width={476} height={226} rx={6} fill="none" stroke={C.ink} strokeWidth={1} opacity={0.5} />
      <text x={0} y={-62} direction="rtl" textAnchor="middle" style={{ fontFamily: AMIRI, fontWeight: 700, fontSize: 40, fill: C.inkText }}>مفتاح الخريطة</text>
      <circle cx={190} cy={8} r={15} fill={PM.ember} />
      <circle cx={190} cy={8} r={26} fill={PM.ember} opacity={0.25} />
      <text x={150} y={20} direction="rtl" textAnchor="start" style={{ fontFamily: TAJ, fontWeight: 700, fontSize: 32, fill: C.inkText }}>ضوء = موضع ثابت بدليل</text>
      <circle cx={190} cy={78} r={15} fill="none" stroke={C.inkSoft} strokeWidth={2.5} strokeDasharray="4 4" />
      <text x={150} y={90} direction="rtl" textAnchor="start" style={{ fontFamily: TAJ, fontWeight: 500, fontSize: 30, fill: C.inkSoft }}>بلا ضوء = لا نعلم</text>
      {empty ? (
        <g>
          <rect x={-232} y={-20} width={92} height={118} rx={8} fill="none" stroke={C.ribbon} strokeWidth={2.5} />
          <text x={-186} y={58} textAnchor="middle" style={{ fontFamily: AMIRI, fontWeight: 700, fontSize: 70, fill: C.ribbon }}>٠</text>
        </g>
      ) : null}
    </g>
  );
  if (sheet) return <g transform={planeMatrix(p3, at[0], at[1])}><g transform="rotate(-4)"><rect x={-244} y={-112} width={500} height={250} fill="#000" opacity={0.25} transform="translate(10 12)" filter={`url(#${id}-soft)`} />{body}</g></g>;
  return <g transform="translate(330 250) scale(0.82)">{body}</g>;
};

/** علبة دبابيس الضوء على طرف الخريطة: الدبوس فيها، لا يُوضع */
const PinTray: React.FC<{ id: string; p3: P3; at: Pt }> = ({ id, p3, at }) => (
  <g transform={planeMatrix(p3, at[0], at[1])}>
    <ellipse cx={8} cy={10} rx={120} ry={88} fill="#000" opacity={0.35} filter={`url(#${id}-soft)`} />
    <ellipse cx={0} cy={0} rx={116} ry={84} fill="#8C6A3A" stroke="#5B4123" strokeWidth={4} />
    <ellipse cx={0} cy={0} rx={96} ry={66} fill="#B38A4E" />
    <ellipse cx={0} cy={0} rx={96} ry={66} fill="none" stroke="#6E5230" strokeWidth={2} opacity={0.6} />
    {[[-40, -14], [6, 20], [44, -20]].map(([x, y], i) => (
      <g key={i} transform={`translate(${x} ${y}) rotate(${-30 + i * 25})`}>
        <line x1={0} y1={0} x2={58} y2={0} stroke="#D9D2C0" strokeWidth={3} strokeLinecap="round" />
        <circle cx={0} cy={0} r={13} fill={i === 1 ? PM.ember : PM.gold} stroke="#6E5230" strokeWidth={1.5} />
        <circle cx={-4} cy={-4} r={4} fill="#fff" opacity={0.7} />
      </g>
    ))}
  </g>
);

/** ختم «لا نعلم» بالأحمر: على هامش الورقة (أ) أو على الشاشة في السماء (ب) */
const Stamp: React.FC<{ p3: P3; at: Pt | null }> = ({ p3, at }) => {
  const s = (
    <g transform="rotate(-9)" opacity={0.9}>
      <rect x={-170} y={-70} width={340} height={130} rx={12} fill="none" stroke={C.ribbon} strokeWidth={7} />
      <rect x={-156} y={-56} width={312} height={102} rx={6} fill="none" stroke={C.ribbon} strokeWidth={2.5} />
      <text x={0} y={26} direction="rtl" textAnchor="middle" style={{ fontFamily: AMIRI, fontWeight: 700, fontSize: 84, fill: C.ribbon }}>لا نعلم</text>
    </g>
  );
  return at ? <g transform={planeMatrix(p3, at[0], at[1])}>{s}</g> : <g transform="translate(1540 210)">{s}</g>;
};

/** الكرة الحيّة بمظهر القناة (DAFATIR_GLOBE)، والكاميرا قريبة نازلة */
const GlobeStill: React.FC<{ id: string; seed: number; cx: number; cy: number; r: number; rotate: [number, number]; fog?: boolean; wash?: boolean }> = ({ id, seed, cx, cy, r, rotate, fog, wash }) => {
  const g = useMemo(() => {
    const proj = geoOrthographic().rotate([rotate[0], rotate[1], 0]).translate([cx, cy]).scale(r).clipAngle(90);
    const path = geoPath(proj);
    const grat: string[] = [];
    for (let lon = -180; lon < 180; lon += 15) grat.push(path({ type: "LineString", coordinates: Array.from({ length: 35 }, (_, i) => [lon, -85 + i * 5]) }) ?? "");
    for (let lat = -75; lat <= 75; lat += 15) grat.push(path({ type: "LineString", coordinates: Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]) }) ?? "");
    const rr = rng(seed);
    const stars = Array.from({ length: 140 }, () => ({ x: rr() * W, y: rr() * H, r: 0.6 + rr() * 1.6, o: 0.2 + rr() * 0.6 }));
    const warm: { x: number; y: number; r: number }[] = [];
    if (wash) for (let lon = -180; lon < 180; lon += 6) for (let lat = -50; lat <= 70; lat += 6) {
      const ll: LL = [lon + (rr() - 0.5) * 4, lat + (rr() - 0.5) * 4];
      if (!geoContains(LAND110, ll)) continue;
      const q = proj(ll);
      if (!q || geoPath(proj)({ type: "Point", coordinates: ll }) === null) continue;
      warm.push({ x: q[0], y: q[1], r: r * (0.05 + rr() * 0.04) });
    }
    return { land: path(LAND110) ?? "", sphere: path({ type: "Sphere" }) ?? "", grat, stars, warm };
  }, [id, seed, cx, cy, r, rotate[0], rotate[1], wash]);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <radialGradient id={`${id}-space`} cx="0.3" cy="0.2" r="1.1">
          <stop offset="0" stopColor={PM.desk} />
          <stop offset="1" stopColor={PM.night} />
        </radialGradient>
        <radialGradient id={`${id}-shade`} cx={cx - r * 0.45} cy={cy - r * 0.4} r={r * 1.5} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFF4DD" stopOpacity="0.28" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor={PM.night} stopOpacity="0.62" />
        </radialGradient>
        <filter id={`${id}-glow`} x="-0.2" y="-0.2" width="1.4" height="1.4"><feGaussianBlur stdDeviation="18" /></filter>
        <filter id={`${id}-warmblur`} x="-0.5" y="-0.5" width="2" height="2"><feGaussianBlur stdDeviation="14" /></filter>
        <filter id={`${id}-fogblur`} x="-0.3" y="-0.6" width="1.6" height="2.2"><feGaussianBlur stdDeviation="40" /></filter>
        <clipPath id={`${id}-sph`}><path d={g.sphere} /></clipPath>
        <clipPath id={`${id}-land`}><path d={g.land} /></clipPath>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}-space)`} />
      {g.stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={C.parchment} opacity={s.o} />)}
      <path d={g.sphere} fill="none" stroke={PM.sand} strokeWidth={30} opacity={0.35} filter={`url(#${id}-glow)`} />
      <path d={g.sphere} fill={PM.sea} />
      <g clipPath={`url(#${id}-sph)`}>
        {g.grat.map((d, i) => <path key={i} d={d} stroke={DAFATIR_GLOBE.grid} strokeWidth={1} opacity={0.18} fill="none" />)}
        <path d={g.land} fill={DAFATIR_GLOBE.land} stroke={DAFATIR_GLOBE.coast} strokeWidth={2} strokeLinejoin="round" />
        {wash ? (
          <g clipPath={`url(#${id}-land)`} filter={`url(#${id}-warmblur)`}>
            {g.warm.map((w, i) => <circle key={i} cx={w.x} cy={w.y} r={w.r} fill={PM.ember} opacity={0.45} />)}
          </g>
        ) : null}
        {fog ? <ellipse cx={cx - r * 0.1} cy={cy - r * 0.62} rx={r * 0.9} ry={r * 0.16} fill="#F4EAD6" opacity={0.85} filter={`url(#${id}-fogblur)`} transform={`rotate(-14 ${cx} ${cy})`} /> : null}
        <path d={g.sphere} fill={`url(#${id}-shade)`} />
      </g>
      <path d={g.sphere} fill="none" stroke={C.ink} strokeWidth={2} opacity={0.5} />
    </svg>
  );
};

// ───────────────────────── المكان والنور ─────────────────────────
type Light = "dusk" | "night" | "dawn";
const SKY: Record<Light, string[]> = {
  dusk: ["#171127", C.dusk, "#5A3550", "#B4604A", C.ember],
  night: ["#0D0A14", "#171127", "#231A38", "#3B2A4E", "#7A4E5E"],
  dawn: ["#1F1A3C", "#433764", "#8E6278", "#D79A86", C.sand],
};
/** حافة طبقة تلال: مجموع موجات بذرة ثابتة */
const ridgeLine = (seed: number, y: number, amp: number, freq: number, x0 = -40, x1 = W + 40): Pt[] => {
  const r = rng(seed);
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  const pts: Pt[] = [];
  for (let x = x0; x <= x1; x += 16) pts.push([x, y - amp * (0.55 * Math.sin(x * freq + ph[0]!) + 0.3 * Math.sin(x * freq * 2.3 + ph[1]!) + 0.15 * Math.sin(x * freq * 5.1 + ph[2]!))]);
  return pts;
};
const fillDown = (pts: Pt[], bottom = H + 10) => `${line(pts)} L${pts[pts.length - 1]![0]} ${bottom} L${pts[0]![0]} ${bottom} Z`;
const mixHex = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i]! - v) * t).toString(16).padStart(2, "0")).join("")}`;
};

const Hearth: React.FC<{ id: string; x: number; y: number; s: number; smoke?: number }> = ({ id, x, y, s, smoke = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx={0} cy={4} rx={150} ry={46} fill={`url(#${id}-glowGround)`} />
    <circle cx={0} cy={-18} r={80} fill={`url(#${id}-glow)`} />
    {Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return <ellipse key={i} cx={Math.cos(a) * 30} cy={Math.sin(a) * 10 + 4} rx={9} ry={6} fill={i < 4 ? "#3A2A2A" : "#6E4A3A"} />; })}
    <path d="M0 -42 C10 -28 16 -16 12 -4 C9 4 -9 4 -12 -4 C-16 -16 -8 -26 0 -42 Z" fill={`url(#${id}-flame)`} />
    <path d="M2 -26 C7 -18 8 -10 5 -4 C2 0 -4 0 -5 -4 C-7 -10 -3 -18 2 -26 Z" fill="#FFF1C9" opacity={0.85} />
    {smoke > 0 ? [0, 1, 2].map((k) => (
      <path key={k} d={`M${-4 + k * 4} -44 C${-18 + k * 8} -90 ${22 - k * 6} -130 ${-6 + k * 10} -${180 + k * 30}`} stroke="#B8A9C9" strokeWidth={6 - k * 1.5} fill="none" opacity={0.16 * smoke} strokeLinecap="round" />
    )) : null}
  </g>
);
/** كوخ عام من حجر وأغصان (لا عمارة معيّنة) */
const Hut: React.FC<{ x: number; y: number; s: number; warm: string; dark: string }> = ({ x, y, s, warm, dark }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx={0} cy={6} rx={128} ry={18} fill="#000" opacity={0.35} />
    <path d="M-118 0 C-112 -90 -60 -150 0 -156 C60 -150 112 -90 118 0 Z" fill={dark} />
    {Array.from({ length: 11 }, (_, i) => { const t = -1 + (i * 2) / 10; return <path key={i} d={`M${t * 112} 0 Q${t * 70} -90 ${t * 8} -150`} stroke={mixHex(dark, warm, 0.25)} strokeWidth={4} fill="none" opacity={0.7} />; })}
    <path d="M-118 0 C-112 -90 -60 -150 0 -156 C-40 -140 -84 -86 -92 0 Z" fill={warm} opacity={0.32} />
    {Array.from({ length: 12 }, (_, i) => <ellipse key={i} cx={-112 + i * 20.5} cy={-6 - (i % 2) * 6} rx={13} ry={10} fill={i % 3 ? mixHex(dark, "#000000", 0.2) : mixHex(dark, warm, 0.3)} />)}
    <path d="M-26 0 L-26 -62 Q0 -80 26 -62 L26 0 Z" fill="#0D0A14" opacity={0.85} />
  </g>
);
const Shrub: React.FC<{ x: number; y: number; s: number; c: string }> = ({ x, y, s, c }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M-40 0 C-44 -20 -30 -30 -22 -24 C-22 -44 -2 -48 4 -34 C12 -50 34 -42 30 -24 C44 -28 50 -10 40 0 Z" fill={c} />
);

type PlaceSpec = { light: Light; horizon: number; crane: boolean };
const PLACE_SPECS: Record<string, PlaceSpec> = {
  "4c": { light: "dusk", horizon: 360, crane: true },
  "4d": { light: "night", horizon: 600, crane: false },
  "5c": { light: "dusk", horizon: 420, crane: true },
  "5d": { light: "dawn", horizon: 590, crane: false },
  "6c": { light: "dusk", horizon: 640, crane: true },
  "6d": { light: "dawn", horizon: 700, crane: false },
};

const PlaceStill: React.FC<{ id: string; scene: number; v: PmVariant; seed: number }> = ({ id, scene, v, seed }) => {
  const spec = PLACE_SPECS[`${scene}${v}`]!;
  const sky = SKY[spec.light];
  const hz = spec.horizon;
  const r = rng(seed);
  const far = sky[3]!, nearDark = spec.light === "dawn" ? "#2A2038" : "#120D1C";
  const warm = spec.light === "dawn" ? C.sand : C.ember;
  const mountain = scene === 6;
  // طبقات التلال من الأفق إلى الأمام
  const layers = Array.from({ length: 5 }, (_, i) => {
    const t = i / 4;
    const y = hz + (spec.crane ? 6 + i * 26 : -10 + i * 30);
    return { d: fillDown(ridgeLine(seed + i * 13, y, (spec.crane ? 22 : 40) * (1 - t * 0.4) * (mountain ? 0.6 : 1), 0.004 + i * 0.0012)), c: mixHex(mixHex(far, sky[1]!, 0.35), nearDark, 0.25 + t * 0.6), hazeY: y };
  });
  const dust = Array.from({ length: 70 }, () => ({ x: r() * W, y: hz - 260 + r() * 460, r: 0.8 + r() * 2.2, o: 0.15 + r() * 0.45 }));
  const groundBottom = H;

  // المواقد: مواضع بعمق، والقريب أولًا (الأول ثم الثاني بعيدًا ثم الثالث ثم العشرة)
  const hearths: { x: number; y: number; s: number }[] = [];
  if (scene === 4 || scene === 5) {
    const rr = rng(seed + 31);
    const n = scene === 4 ? 13 : 9;
    for (let i = 0; i < n; i++) {
      const depth = i === 0 ? 0.92 : 0.12 + rr() * 0.62;
      const y = hz + 40 + depth * (groundBottom - hz - 220);
      const x = i === 0 ? (spec.crane ? 1180 : 1380) : 120 + rr() * (W - 240);
      hearths.push({ x, y, s: 0.12 + depth * (spec.crane ? 0.75 : 1.05) });
    }
  }
  const huts = scene === 5 ? hearths.map((h, i) => ({ x: h.x + (i % 2 ? -1 : 1) * 190 * h.s, y: h.y + 6 * h.s, s: h.s * (i === 0 ? 1.05 : 0.95) })) : [];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2={hz / H}>
          {sky.map((c, i) => <stop key={i} offset={i / (sky.length - 1)} stopColor={c} />)}
        </linearGradient>
        <linearGradient id={`${id}-haze`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={far} stopOpacity="0" />
          <stop offset="0.5" stopColor={far} stopOpacity="0.42" />
          <stop offset="1" stopColor={far} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor="#FFD9A0" stopOpacity="0.95" />
          <stop offset="0.25" stopColor={C.ember} stopOpacity="0.55" />
          <stop offset="1" stopColor={C.ember} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-glowGround`}>
          <stop offset="0" stopColor={C.ember} stopOpacity="0.55" />
          <stop offset="1" stopColor={C.ember} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-flame`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={C.ribbon} />
          <stop offset="0.5" stopColor={C.ember} />
          <stop offset="1" stopColor={C.sand} />
        </linearGradient>
        <linearGradient id={`${id}-mount`} x1="0" y1="0" x2="1" y2="0.2">
          <stop offset="0" stopColor={mixHex(warm, "#4A3550", 0.35)} />
          <stop offset="0.42" stopColor="#4A3550" />
          <stop offset="1" stopColor="#1C1428" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7DFA0" />
          <stop offset="0.6" stopColor={C.gold} />
          <stop offset="1" stopColor="#A47B35" />
        </linearGradient>
        <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[4]!} stopOpacity="0.75" />
          <stop offset="1" stopColor={sky[2]!} stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={`${id}-vig`} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <linearGradient id={`${id}-ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={far} stopOpacity="0.34" />
          <stop offset="0.45" stopColor={far} stopOpacity="0.06" />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </linearGradient>
        <filter id={`${id}-motion`} x="-0.2" y="-0.2" width="1.4" height="1.4"><feGaussianBlur stdDeviation="14 2" /></filter>
        <filter id={`${id}-txtglow`} x="-0.2" y="-0.4" width="1.4" height="1.8"><feGaussianBlur stdDeviation="10" /></filter>
        <filter id={`${id}-mist`} x="-0.2" y="-1" width="1.4" height="3"><feGaussianBlur stdDeviation="26" /></filter>
      </defs>

      <rect width={W} height={H} fill={`url(#${id}-sky)`} />
      {/* وهج الأفق خطيًا (لا قرص شمس ولا أشعة) */}
      <rect x={0} y={hz - 140} width={W} height={180} fill={warm} opacity={spec.light === "night" ? 0.1 : 0.22} filter={`url(#${id}-mist)`} />

      {mountain ? <Mountain id={id} hz={hz} crane={spec.crane} seed={seed} sky={sky} /> : null}

      {layers.map((l, i) => (
        <g key={i}>
          <path d={l.d} fill={l.c} />
          {i < 4 ? <rect x={0} y={l.hazeY - 40} width={W} height={70} fill={`url(#${id}-haze)`} opacity={mountain ? 0.8 : 1} /> : null}
        </g>
      ))}

      <rect x={0} y={layers[4]!.hazeY - 30} width={W} height={H - layers[4]!.hazeY + 30} fill={`url(#${id}-ground)`} />
      {mountain ? <Waters id={id} hz={hz} crane={spec.crane} seed={seed} /> : null}

      {/* حجارة وشجيرات على الأرض بعمق */}
      {!mountain ? Array.from({ length: 34 }, (_, i) => {
        const rr = rng(seed + 300 + i);
        const depth = rr();
        const y = hz + 60 + depth * (H - hz - 40);
        return <Shrub key={i} x={rr() * W} y={y} s={0.25 + depth * 1.1} c={mixHex(layers[4]!.c, "#000000", 0.25)} />;
      }) : null}

      {huts.map((h, i) => <Hut key={`h${i}`} x={h.x} y={h.y} s={h.s} warm={warm} dark={mixHex(layers[3]!.c, "#2A1E3F", 0.4)} />)}
      {[...hearths].sort((a, b) => a.y - b.y).map((h, i) => <Hearth key={i} id={id} x={h.x} y={h.y} s={h.s} smoke={h.s > 0.3 ? 1 : 0.5} />)}

      {dust.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={C.sand} opacity={d.o * (spec.light === "night" ? 0.4 : 1)} />)}

      {/* المقدمة في التتبّع المنخفض: حجارة وعشب قريب يمر بغبش الحركة */}
      {!spec.crane ? (
        <g filter={`url(#${id}-motion)`}>
          <path d={`M-40 ${H} L-40 ${H - 150} C60 ${H - 200} 180 ${H - 170} 260 ${H - 120} C330 ${H - 160} 420 ${H - 120} 470 ${H} Z`} fill="#0D0A14" />
          <path d={`M${W - 380} ${H} C${W - 340} ${H - 120} ${W - 220} ${H - 170} ${W - 120} ${H - 140} C${W - 60} ${H - 190} ${W + 40} ${H - 160} ${W + 40} ${H} Z`} fill="#0D0A14" />
        </g>
      ) : null}
      <rect width={W} height={H} fill={`url(#${id}-vig)`} />
    </svg>
  );
};

/** الجبل العام (لا قمة معاصرة بعينها) وخطوط الماء المنحسر واسم «الجودي» في المكان نفسه */
const Mountain: React.FC<{ id: string; hz: number; crane: boolean; seed: number; sky: string[] }> = ({ id, hz, crane, seed }) => {
  const r = rng(seed + 77);
  const base = hz + 30;
  const peakX = crane ? 860 : 1040, peakY = crane ? 150 : 300;
  const span = crane ? 1150 : 900;
  const pts: Pt[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const x = peakX - span + t * span * 2;
    const d = Math.abs(t - 0.5) * 2;
    const y = peakY + (base - peakY) * Math.pow(d, 1.25) + (r() - 0.5) * 26 * (1 - d * 0.6) + Math.sin(t * 19) * 10;
    pts.push([x, Math.min(base, y)]);
  }
  const d = `${line(pts)} L${pts[pts.length - 1]![0]} ${base + 40} L${pts[0]![0]} ${base + 40} Z`;
  const contours = Array.from({ length: 7 }, (_, k) => {
    const y = base - 30 - k * (crane ? 46 : 34);
    return line(Array.from({ length: 50 }, (_, i) => [peakX - span + (i / 49) * span * 2, y + Math.sin(i * 0.7 + k) * 5] as Pt));
  });
  const txt = crane ? { x: peakX - 40, y: peakY + 300, size: 210 } : { x: peakX - 20, y: peakY + 210, size: 150 };
  return (
    <g>
      <clipPath id={`${id}-mclip`}><path d={d} /></clipPath>
      <path d={d} fill={`url(#${id}-mount)`} />
      {/* سفوح وأخاديد */}
      <g clipPath={`url(#${id}-mclip)`} opacity={0.5}>
        {Array.from({ length: 16 }, (_, i) => {
          const x = peakX - span * 0.8 + (i / 15) * span * 1.6;
          return <path key={i} d={`M${peakX + (x - peakX) * 0.08} ${peakY + 20} Q${(x + peakX) / 2} ${(peakY + base) / 2} ${x} ${base}`} stroke={i < 7 ? "#E7B98A" : "#120D1C"} strokeWidth={3} fill="none" opacity={0.35} />;
        })}
        {contours.map((c, i) => <path key={`c${i}`} d={c} stroke="#D9C7B0" strokeWidth={2.2} fill="none" opacity={0.45 - i * 0.04} strokeDasharray="22 10" />)}
      </g>
      {/* الاسم مكتوبًا في المكان: ذهب بخط عربي على السفح، والضباب يمر أمام أسفله */}
      <text x={txt.x} y={txt.y} direction="rtl" textAnchor="middle" style={{ fontFamily: AMIRI, fontWeight: 700, fontSize: txt.size, fill: C.gold }} opacity={0.55} filter={`url(#${id}-txtglow)`}>الجودي</text>
      <text x={txt.x} y={txt.y} direction="rtl" textAnchor="middle" style={{ fontFamily: AMIRI, fontWeight: 700, fontSize: txt.size }} fill={`url(#${id}-gold)`} stroke="#5E4535" strokeWidth={1.2} strokeOpacity={0.4}>الجودي</text>
      <rect x={txt.x - 420} y={txt.y - txt.size * 0.18} width={840} height={txt.size * 0.5} fill="#E9D8C4" opacity={0.42} filter={`url(#${id}-mist)`} />
    </g>
  );
};
const Waters: React.FC<{ id: string; hz: number; crane: boolean; seed: number }> = ({ id, hz, crane, seed }) => {
  const r = rng(seed + 91);
  const pools = Array.from({ length: crane ? 9 : 7 }, (_, i) => {
    const t = (i + r() * 0.6) / (crane ? 9 : 7);
    const y = hz + 70 + t * (H - hz - (crane ? 180 : 120));
    const w = 260 + t * 900 + r() * 200;
    return { x: r() * (W - w * 0.5) - w * 0.2, y, w, h: 10 + t * (crane ? 34 : 60) };
  });
  return (
    <g>
      {pools.map((p, i) => (
        <g key={i}>
          <ellipse cx={p.x + p.w / 2} cy={p.y} rx={p.w / 2} ry={p.h} fill={`url(#${id}-water)`} />
          <path d={`M${p.x + p.w * 0.2} ${p.y - p.h * 0.2} L${p.x + p.w * 0.8} ${p.y - p.h * 0.2}`} stroke="#F7E6C8" strokeWidth={2} opacity={0.4} />
          <path d={`M${p.x + p.w * 0.3} ${p.y + p.h * 0.3} L${p.x + p.w * 0.65} ${p.y + p.h * 0.3}`} stroke="#F7E6C8" strokeWidth={1.5} opacity={0.25} />
        </g>
      ))}
    </g>
  );
};

// ───────────────────────── اللوحة ─────────────────────────
export type PlaceMapBoardProps = { scene: number; variant: PmVariant };

export const PlaceMapBoard: React.FC<PlaceMapBoardProps> = ({ scene, variant }) => {
  useBrandFonts();
  const def = PM_BOARDS.find((x) => x.scene === scene && x.variant === variant)!;
  const id = `pm${scene}${variant}`;
  const seed = 2510 + scene * 17 + variant.charCodeAt(0);
  let body: React.ReactNode;
  if (def.direction === "map") {
    if (variant === "b" && scene === 1) body = <GlobeStill id={id} seed={seed} cx={1000} cy={1180} r={980} rotate={[-42, -6]} fog />;
    else if (variant === "b" && scene === 3) body = <GlobeStill id={id} seed={seed} cx={1390} cy={500} r={430} rotate={[-38, -18]} wash />;
    else body = <MapStill view={MAP_VIEWS[`${scene}${variant}`]!} id={id} seed={seed} />;
  } else body = <PlaceStill id={id} scene={scene} v={variant} seed={seed} />;
  const verse = def.elements.includes("verse-card");
  return (
    <AbsoluteFill style={{ background: C.night }}>
      {body}
      {/* D242/D246: الآية داخل المشهد كما في 001 — بطاقة على يسار الكادر، والراوي مستمر، والمشهد ساكن طول قراءتها */}
      {verse ? <VerseCard show={1} text={NISA_1} refKey={NISA_1_KEY} place="page" side="l" y={470} /> : null}
      <Caption text={def.narration} opacity={1} />
    </AbsoluteFill>
  );
};

/** كل لوحة بمعرّف تكوينها (Root.tsx) */
export const PM_STILLS = PM_BOARDS.map((b) => ({ id: b.composition, props: { scene: b.scene, variant: b.variant } as PlaceMapBoardProps }));
