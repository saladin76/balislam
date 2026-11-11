import React from "react";
import type { DerivedSeriesIdentity, SeriesStamp } from "../../channel/series";

/**
 * رسوم السلسلة بهوية قناتها وحدها (src/channel/series.ts → deriveSeriesIdentity):
 * - SeriesEmblem: شعار صغير من جزء أو جزأين من شعار القناة.
 * - SeriesTitleCard: بطاقة اسم السلسلة بخط عناوين القناة ولون السلسلة وزخرفة القناة.
 * - SeriesSting: البطاقة متحركةً بعد افتتاحية القناة (إطارات SERIES_STING_FRAMES).
 * - SeriesBadge: شارة السلسلة على الصورة المصغّرة بأسلوب القناة.
 * مكوّنات SVG/React خالصة (لا خطاطيف Remotion)، فتعمل في الرندر وفي معاينات الاستوديو.
 */
export const SERIES_STING_FRAMES = 45;

/** بطاقة السلسلة تعمل في هذه الحلقة: قالبها، وإلا هويتها */
export const stingOn = (s?: Pick<SeriesStamp, "template" | "identity">) => Boolean(s) && (s!.template.intro ?? s!.identity.intro) === "sting";

const font = (d: DerivedSeriesIdentity) => `'${d.fonts.heading}', serif`;

type PartProps = { id: string; d: DerivedSeriesIdentity; x: number; y: number; s: number };
/** جزء واحد من شعار القناة في مربع s×s */
const Part: React.FC<PartProps> = ({ id, d, x, y, s }) => {
  const k = s / 100;
  const t = `translate(${x} ${y}) scale(${k})`;
  const ink = d.accent, paper = d.paper, deep = d.ink;
  switch (id) {
    case "arch": return <g transform={t}><path d="M18 96 V46 A32 32 0 0 1 82 46 V96" fill="none" stroke={ink} strokeWidth={8} /><path d="M18 96 V46 A32 32 0 0 1 82 46 V96 Z" fill={ink} opacity={0.18} /></g>;
    case "sun": return <g transform={t}><circle cx={50} cy={56} r={22} fill={ink} /><path d="M10 82 H90" stroke={ink} strokeWidth={6} /></g>;
    case "seal": return <g transform={t}><rect x={24} y={24} width={52} height={52} rx={6} fill={ink} /><rect x={34} y={34} width={32} height={32} rx={3} fill="none" stroke={paper} strokeWidth={4} /></g>;
    case "star8": return <g transform={t}><path d="M50 10 L64 36 L90 50 L64 64 L50 90 L36 64 L10 50 L36 36 Z" fill="none" stroke={ink} strokeWidth={6} /><rect x={30} y={30} width={40} height={40} fill="none" stroke={ink} strokeWidth={5} transform="rotate(45 50 50)" /></g>;
    case "book": return <g transform={t}><path d="M8 28 Q30 18 50 30 Q70 18 92 28 V82 Q70 72 50 84 Q30 72 8 82 Z" fill={paper} stroke={ink} strokeWidth={5} /><path d="M50 30 V84" stroke={ink} strokeWidth={4} /></g>;
    case "hourglass": return <g transform={t}><path d="M28 12 H72 M28 88 H72 M32 12 C32 40 68 44 68 50 C68 56 32 60 32 88 M68 12 C68 40 32 44 32 50 C32 56 68 60 68 88" fill="none" stroke={ink} strokeWidth={6} /><path d="M40 80 Q50 66 60 80 Z" fill={ink} /></g>;
    case "ribbon": return <g transform={t}><path d="M20 30 H80 V58 L68 50 L56 58 V30" fill={ink} /><rect x={20} y={30} width={36} height={30} fill={ink} /></g>;
    case "card": return <g transform={t}><rect x={24} y={10} width={52} height={80} rx={5} fill={deep} transform="rotate(-6 50 50)" /><rect x={32} y={26} width={36} height={8} fill={ink} transform="rotate(-6 50 50)" /></g>;
    case "bar": return <g transform={t}><path d="M10 58 L88 44 L90 60 L12 74 Z" fill={ink} /></g>;
    case "sticky": return <g transform={t}><path d="M18 18 H82 V66 L66 82 H18 Z" fill={ink} /><path d="M66 82 V66 H82" fill={deep} opacity={0.25} /></g>;
    case "counter": return <g transform={t}><circle cx={50} cy={50} r={36} fill="none" stroke={ink} strokeWidth={8} /><text x={50} y={64} textAnchor="middle" fontSize={40} fontFamily={font(d)} fill={ink}>١</text></g>;
    default: return null;
  }
};

export const SeriesEmblem: React.FC<{ d: DerivedSeriesIdentity; size?: number; title?: string }> = ({ d, size = 64, title }) => {
  const parts = d.emblem.parts;
  const one = parts.length <= 1;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {one ? <Part id={parts[0] ?? ""} d={d} x={0} y={0} s={100} /> : <><Part id={parts[0]!} d={d} x={0} y={14} s={60} /><Part id={parts[1]!} d={d} x={40} y={26} s={60} /></>}
    </svg>
  );
};

const titleSize = (d: DerivedSeriesIdentity, base: number) => base * (d.title.size === "s" ? 0.8 : d.title.size === "l" ? 1.2 : 1);

/** زخرفة القناة خطًّا تحت الاسم (motif) أو خط بسيط (rule) */
const Ornament: React.FC<{ d: DerivedSeriesIdentity; width: number; progress?: number }> = ({ d, width, progress = 1 }) => {
  if (d.title.ornament === "none") return null;
  const w = width * progress;
  if (d.title.ornament === "rule") return <svg width={width} height={14}><rect x={(width - w) / 2} y={5} width={w} height={4} rx={2} fill={d.accent} /></svg>;
  const n = Math.max(1, Math.floor((w / width) * 9));
  return (
    <svg width={width} height={26}>
      {Array.from({ length: n }, (_, i) => {
        const cx = width / 2 + (i - (n - 1) / 2) * 30;
        return d.motif === "girih" || d.motif === "arches"
          ? <path key={i} d={`M${cx} 4 L${cx + 9} 13 L${cx} 22 L${cx - 9} 13 Z`} fill="none" stroke={d.accent} strokeWidth={3} />
          : d.motif === "stars" ? <circle key={i} cx={cx} cy={13} r={4} fill={d.accent} />
          : d.motif === "horizon" ? <path key={i} d={`M${cx - 13} 13 H${cx + 13}`} stroke={d.accent} strokeWidth={4} />
          : <path key={i} d={`M${cx - 12} 18 L${cx + 12} 8`} stroke={d.accent} strokeWidth={3} />;
      })}
    </svg>
  );
};

/** بطاقة السلسلة: الشعار، واسم السلسلة بخط القناة، وزخرفتها، و«الحلقة N» إن كانت سلسلة مرتبة */
export const SeriesTitleCard: React.FC<{ d: DerivedSeriesIdentity; name: string; number?: number; kindAr?: string; width?: number; height?: number; progress?: number }> = ({ d, name, number, kindAr, width = 1920, height = 1080, progress = 1 }) => {
  const scale = Math.min(width / 1920, height / 1080);
  const portrait = height > width;
  const fs = titleSize(d, (portrait ? 150 : 176) * scale * (portrait ? 1.6 : 1));
  const pIn = Math.min(1, progress * 1.6);
  return (
    <div style={{ width, height, background: d.card.bg, color: d.card.ink, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26 * scale, direction: "rtl", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 60%, ${d.accent}33 0%, transparent 60%)` }} />
      <div style={{ opacity: pIn, transform: `scale(${0.85 + 0.15 * pIn})` }}><SeriesEmblem d={d} size={220 * scale * (portrait ? 1.5 : 1)} /></div>
      {kindAr ? <div style={{ fontFamily: font(d), fontSize: 52 * scale * (portrait ? 1.5 : 1), color: d.accent, opacity: pIn }}>{kindAr}</div> : null}
      <div style={{ fontFamily: font(d), fontWeight: d.title.weight === "bold" ? 700 : 400, fontSize: fs, lineHeight: 1.25, textAlign: "center", padding: `0 ${80 * scale}px`, opacity: Math.min(1, Math.max(0, progress * 2 - 0.3)), transform: `translateY(${(1 - pIn) * 30 * scale}px)` }}>{name}</div>
      <Ornament d={d} width={420 * scale * (portrait ? 1.5 : 1)} progress={Math.min(1, Math.max(0, progress * 1.4 - 0.2))} />
      {number ? <div style={{ fontFamily: font(d), fontSize: 64 * scale * (portrait ? 1.5 : 1), background: d.accent, color: d.onAccent, padding: `${4 * scale}px ${28 * scale}px`, borderRadius: 8 * scale, opacity: Math.min(1, Math.max(0, progress * 2 - 0.8)) }}>الحلقة {number.toLocaleString("ar-EG")}</div> : null}
    </div>
  );
};

/** البطاقة متحركة: تدخل، تثبت، وتتلاشى في آخر ثلث ثانية */
export const SeriesSting: React.FC<{ stamp: Pick<SeriesStamp, "identity" | "name" | "number" | "kind">; frame: number; width: number; height: number }> = ({ stamp, frame, width, height }) => {
  const p = Math.min(1, frame / 24);
  const ease = 1 - (1 - p) ** 3;
  const out = frame > SERIES_STING_FRAMES - 10 ? Math.max(0, (SERIES_STING_FRAMES - frame) / 10) : 1;
  return <div style={{ opacity: out, width, height }}><SeriesTitleCard d={stamp.identity} name={stamp.name} number={stamp.kind === "series" ? stamp.number : undefined} width={width} height={height} progress={ease} /></div>;
};

/** شارة السلسلة على الصورة المصغّرة 1280×720: «band» شريط أعلى الصورة، «corner» لسان في الزاوية */
export const SeriesBadge: React.FC<{ d: DerivedSeriesIdentity; name: string; number?: number }> = ({ d, name, number }) => {
  if (d.thumbnail.badge === "none") return null;
  const label = number ? `${name}، ${number.toLocaleString("ar-EG")}` : name;
  const shape = d.emblem.base === "horizon-book"
    ? { clipPath: "polygon(0 0, 100% 0, 96% 50%, 100% 100%, 0 100%)" } // شريط التاريخ
    : d.emblem.base === "highlighter-z" ? { borderRadius: 4 } : { borderRadius: 999, border: `3px solid ${d.paper}` };
  const box: React.CSSProperties = d.thumbnail.badge === "band"
    ? { position: "absolute", top: 0, insetInlineStart: 0, insetInlineEnd: 0, height: 64, background: d.accent, color: d.onAccent, display: "flex", alignItems: "center", gap: 14, padding: "0 40px" }
    : { position: "absolute", top: 28, insetInlineEnd: 36, background: d.accent, color: d.onAccent, display: "flex", alignItems: "center", gap: 12, padding: "6px 26px 8px", ...shape };
  return (
    <div style={{ ...box, direction: "rtl", fontFamily: font(d), fontWeight: d.title.weight === "bold" ? 700 : 400, fontSize: 36, lineHeight: 1 }} data-series-badge={d.thumbnail.badge}>
      <SeriesEmblem d={{ ...d, accent: d.onAccent, paper: d.accent }} size={40} />
      <span>{label}</span>
    </div>
  );
};
