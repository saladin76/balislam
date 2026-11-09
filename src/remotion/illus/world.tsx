import React from "react";
import { Easing, interpolate } from "remotion";
import { ID, MOODS, darken, lighten, mix, stoneFor, type Mood } from "./palette";

/**
 * عالم «بالإسلام» المصوَّر: سماء بحسب المزاج، وأفق مدينة بقبة ومئذنة، وبيوت بنوافذ مقوّسة تضيء،
 * وأبواب ولوحات ولافتات. كل شيء متجهي ومولَّد من بذرة ثابتة، فالرندر نفسه في كل مرة وحاد في 4K.
 * عالم المشهد 1920×1080، والنسخة العمودية تقتطع منه حول البطل.
 */
export const WW = 1920;
export const WH = 1080;
export const GROUND = 860;

export const clampOpt = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** شدة حدث يبدأ عند at ويكتمل في len إطارًا (0 قبل at) */
export const rise = (frame: number, at: number | undefined, len = 18) =>
  at === undefined ? 0 : interpolate(frame, [at, at + len], [0, 1], { ...clampOpt, easing: Easing.out(Easing.cubic) });

export const rand = (seed: number) => {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

/** معرّف SVG فريد وآمن داخل url(#…) */
export const useSvgId = (prefix: string) => {
  const raw = React.useId();
  return `${prefix}${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;
};

/** توهج دائري ناعم */
export const Glow: React.FC<{ cx: number; cy: number; r: number; color?: string; opacity?: number }> = ({ cx, cy, r, color = ID.dawn, opacity = 1 }) => {
  const id = useSvgId("glow");
  if (opacity <= 0.001) return null;
  return (
    <>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor={color} stopOpacity={0.6} />
          <stop offset="0.45" stopColor={color} stopOpacity={0.22} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} opacity={opacity} />
    </>
  );
};

/** السماء: تدرج بحسب المزاج، ويمكن الانتقال من مزاج إلى آخر (t) داخل المشهد */
export const Sky: React.FC<{ mood: Mood; to?: Mood; t?: number; frame: number; w?: number; h?: number }> = ({ mood, to, t = 0, frame, w = WW, h = WH }) => {
  const id = useSvgId("sky");
  const a = MOODS[mood];
  const b = MOODS[to ?? mood];
  const stops = a.sky.map((c, i) => mix(c, b.sky[i] ?? c, t));
  const stars = a.stars + (b.stars - a.stars) * t;
  const moon = (a.moon ? 1 - t : 0) + (b.moon ? t : 0);
  const sun = a.sun + (b.sun - a.sun) * t;
  const r = rand(7);
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.55" stopColor={stops[1]} />
          <stop offset="0.82" stopColor={stops[2]} />
        </linearGradient>
      </defs>
      <rect x={-200} y={-200} width={w + 400} height={h + 400} fill={`url(#${id})`} />
      {stars > 0.01
        ? Array.from({ length: 120 }, (_, i) => {
            const x = r() * (w + 200) - 100;
            const y = r() * GROUND * 0.62;
            const tw = 0.45 + 0.4 * Math.sin(frame / (14 + (i % 9)) + i);
            return <circle key={i} cx={x} cy={y} r={i % 11 === 0 ? 2.6 : i % 3 === 0 ? 1.7 : 1.2} fill={ID.paper} opacity={tw * stars * (i % 4 === 0 ? 0.9 : 0.55)} />;
          })
        : null}
      {moon > 0.01 ? (
        <g opacity={moon} transform={`translate(${w * 0.82} ${h * 0.14})`}>
          <Glow cx={0} cy={0} r={150} color={ID.paper} opacity={0.35} />
          <path d="M0 -30 A30 30 0 1 0 22 22 A24 24 0 1 1 0 -30 Z" fill={ID.paper} opacity={0.92} />
        </g>
      ) : null}
      {sun > 0.01 ? (
        <g opacity={sun}>
          <Glow cx={w * 0.5} cy={GROUND - 260} r={720} color={ID.dawn} opacity={0.75} />
          <circle cx={w * 0.5} cy={GROUND - 230 - 30 * sun} r={70} fill={lighten(ID.dawn, 0.35)} opacity={0.85} />
        </g>
      ) : null}
    </g>
  );
};

/** أفق المدينة البعيد: بيوت وقبة ومئذنة صامتة */
export const Skyline: React.FC<{ mood: Mood; base?: number; seed?: number; dome?: number; minaret?: number; w?: number }> = ({ mood, base = GROUND - 330, seed = 3, dome, minaret, w = WW }) => {
  const col = mix(MOODS[mood].sky[1], darken(ID.night, 0.4), 0.55);
  const r = rand(seed);
  const blocks: React.ReactNode[] = [];
  for (let x = -260, i = 0; x < w + 260; i++) {
    const bw = 60 + r() * 120;
    const bh = 40 + r() * 110;
    blocks.push(<rect key={i} x={x} y={base - bh} width={bw + 1} height={bh + 400} fill={col} />);
    x += bw;
  }
  return (
    <g>
      {blocks}
      {dome !== undefined ? (
        <g fill={col}>
          <rect x={dome - 110} y={base - 150} width={220} height={150} />
          <path d={`M${dome - 95} ${base - 150} Q${dome - 100} ${base - 330} ${dome} ${base - 345} Q${dome + 100} ${base - 330} ${dome + 95} ${base - 150} Z`} />
          <rect x={dome - 3} y={base - 380} width={6} height={40} />
        </g>
      ) : null}
      {minaret !== undefined ? (
        <g fill={col}>
          <rect x={minaret - 14} y={base - 420} width={28} height={420} />
          <rect x={minaret - 24} y={base - 340} width={48} height={14} />
          <rect x={minaret - 20} y={base - 250} width={40} height={10} />
          <path d={`M${minaret - 14} ${base - 420} L${minaret} ${base - 470} L${minaret + 14} ${base - 420} Z`} />
        </g>
      ) : null}
    </g>
  );
};

/** نافذة مقوّسة (قوس محراب) */
export const archPath = (x: number, y: number, w: number, h: number) => {
  const r = w / 2;
  const top = y - h;
  return `M${x} ${y} L${x} ${top + r} Q${x} ${top + r * 0.12} ${x + r} ${top} Q${x + w} ${top + r * 0.12} ${x + w} ${top + r} L${x + w} ${y} Z`;
};

export type WindowLight = { id: number; on: number };

/** صف بيوت الحارة: النوافذ تضيء بحسب lit (رقم النافذة ← شدة 0..1) */
export const HouseRow: React.FC<{ mood: Mood; seed?: number; from?: number; to?: number; base?: number; lit?: (i: number) => number; tall?: number }> = ({ mood, seed = 1, from = -120, to = WW + 120, base = GROUND, lit = () => 0, tall = 1 }) => {
  const r = rand(seed);
  const items: React.ReactNode[] = [];
  const glows: React.ReactNode[] = [];
  let wi = 0;
  for (let x = from, b = 0; x < to; b++) {
    const w = 230 + r() * 150;
    const h = (330 + r() * 170) * tall;
    const shade = r() * 0.18;
    const wall = stoneFor(mood, shade);
    const top = base - h;
    items.push(<rect key={`w${b}`} x={x} y={top} width={w + 2} height={h} fill={wall} />);
    // حافة السطح وشرفاتها
    items.push(<rect key={`c${b}`} x={x - 6} y={top - 10} width={w + 14} height={12} fill={darken(wall, 0.12)} />);
    for (let k = 0; k < Math.floor(w / 34); k++) items.push(<rect key={`p${b}-${k}`} x={x + 6 + k * 34} y={top - 26} width={18} height={18} fill={darken(wall, 0.12)} />);
    // ظل الزاوية يعطي عمقًا
    items.push(<rect key={`s${b}`} x={x + w - 18} y={top} width={20} height={h} fill="#000" opacity={0.12} />);
    const cols = Math.max(1, Math.floor(w / 120));
    const rows = Math.max(1, Math.floor((h - 150) / 150));
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const id = wi++;
        const wx = x + (w - cols * 120) / 2 + i * 120 + 34;
        const wy = top + 70 + j * 150;
        const on = Math.max(0, Math.min(1, lit(id)));
        const dark = mix(darken(ID.night, 0.25), wall, 0.15);
        items.push(<path key={`a${id}`} d={archPath(wx - 6, wy + 72, 64, 82)} fill={darken(wall, 0.2)} />);
        items.push(<path key={`n${id}`} d={archPath(wx, wy + 66, 52, 70)} fill={mix(dark, ID.dawn, on)} />);
        items.push(<rect key={`l${id}`} x={wx - 10} y={wy + 66} width={72} height={8} fill={darken(wall, 0.18)} />);
        if (on > 0.02) glows.push(<Glow key={`g${id}`} cx={wx + 26} cy={wy + 36} r={130} opacity={on * 0.75} />);
      }
    x += w;
  }
  return (
    <g>
      {items}
      {glows}
    </g>
  );
};

/** أرض الحارة المرصوفة */
export const Cobbles: React.FC<{ mood: Mood; y?: number; w?: number; tint?: string; tintOpacity?: number }> = ({ mood, y = GROUND, w = WW, tint, tintOpacity = 0 }) => {
  const base = mix(darken(ID.night, 0.15), stoneFor(mood, 0.45), 0.45);
  const rows: React.ReactNode[] = [];
  for (let j = 0; j < 5; j++)
    for (let i = -2; i < w / 70 + 2; i++) {
      const x = i * 70 + (j % 2) * 35;
      rows.push(<rect key={`${i}-${j}`} x={x} y={y + 22 + j * 44} width={52} height={7} rx={3.5} fill={lighten(base, 0.06)} opacity={0.6 - j * 0.08} />);
    }
  return (
    <g>
      <rect x={-200} y={y} width={w + 400} height={WH - y + 400} fill={base} />
      <rect x={-200} y={y} width={w + 400} height={10} fill={darken(base, 0.3)} />
      {rows}
      {tint ? <rect x={-200} y={y} width={w + 400} height={WH} fill={tint} opacity={tintOpacity} /> : null}
    </g>
  );
};

/** مصباح جداري في كوة مقوّسة */
export const WallLamp: React.FC<{ x: number; y: number; on?: number; frame: number }> = ({ x, y, on = 1, frame }) => {
  const flick = 0.92 + 0.08 * Math.sin(frame / 5) * Math.sin(frame / 13);
  return (
    <g>
      <Glow cx={x} cy={y} r={260} opacity={on * flick} />
      <path d={archPath(x - 20, y + 30, 40, 60)} fill={darken(ID.night, 0.3)} />
      <path d={archPath(x - 14, y + 24, 28, 44)} fill={mix(darken(ID.copper, 0.5), ID.dawn, on * flick)} />
      <rect x={x - 26} y={y + 30} width={52} height={7} fill={darken(ID.copper, 0.35)} />
    </g>
  );
};

/** مقعد حجري */
export const Bench: React.FC<{ x: number; w?: number; mood: Mood }> = ({ x, w = 220, mood }) => {
  // دكة خشبية بحدّ داكن تبين أمام الجدار (كانت بلون حجر الجدار فيبدو الجالس معلقًا في الهواء: c6-s1، ٩ نوفمبر)
  const c = mix(stoneFor(mood, 0.05), darken(ID.copper, 0.45), 0.6);
  return (
    <g>
      <rect x={x} y={GROUND - 72} width={w} height={72} fill={darken(c, 0.12)} stroke={darken(c, 0.5)} strokeWidth={3} />
      <rect x={x - 8} y={GROUND - 84} width={w + 16} height={16} rx={3} fill={lighten(c, 0.08)} stroke={darken(c, 0.5)} strokeWidth={3} />
    </g>
  );
};

/** باب مقوّس: light من 0 (مغلق مظلم) إلى 1 (نور يتسرب) */
export const ArchDoor: React.FC<{ x: number; w?: number; h?: number; light?: number; mood: Mood; spill?: boolean }> = ({ x, w = 150, h = 250, light = 0, mood, spill = true }) => {
  const frameCol = darken(stoneFor(mood), 0.25);
  return (
    <g>
      {light > 0.01 ? <Glow cx={x + w / 2} cy={GROUND - h * 0.45} r={420} opacity={light} /> : null}
      <path d={archPath(x - 16, GROUND, w + 32, h + 22)} fill={frameCol} />
      <path d={archPath(x, GROUND, w, h)} fill={mix(darken(ID.night, 0.4), ID.dawn, light)} />
      {light > 0.01 && spill ? <path d={`M${x} ${GROUND} L${x - 140} ${WH + 40} L${x + w + 140} ${WH + 40} L${x + w} ${GROUND} Z`} fill={ID.dawn} opacity={0.2 * light} /> : null}
    </g>
  );
};

/** لوحة إعلانات بأوراق، واحدة منها تتوهج */
export const NoticeBoard: React.FC<{ x: number; y: number; glow?: number; mood: Mood }> = ({ x, y, glow = 0, mood }) => {
  const wood = darken(ID.copper, 0.55);
  const papers: [number, number, number, number][] = [
    [18, 18, 100, 74],
    [134, 22, 112, 92],
    [24, 108, 88, 78],
    [128, 128, 118, 64],
  ];
  return (
    <g>
      <Glow cx={x + 190} cy={y + 70} r={260} opacity={glow * 0.9} />
      <rect x={x} y={y} width={266} height={212} rx={6} fill={darken(wood, 0.25)} stroke={wood} strokeWidth={8} />
      {papers.map(([px, py, pw, ph], i) => (
        <g key={i}>
          <rect x={x + px} y={y + py} width={pw} height={ph} fill={i === 1 ? mix(mix(ID.paper, stoneFor(mood, 0.5), 0.4), lighten(ID.paper, 0.3), glow) : mix(ID.paper, stoneFor(mood, 0.5), 0.45)} />
          {Array.from({ length: 3 }, (_, k) => (
            <rect key={k} x={x + px + 10} y={y + py + 14 + k * 14} width={pw - 24 - k * 12} height={4} rx={2} fill={ID.night} opacity={0.35} />
          ))}
        </g>
      ))}
    </g>
  );
};

/** بطاقة كلمة منطوقة (تظهر وقت نطقها فقط) */
export const WordPill: React.FC<{ x: number; y: number; text: string; color?: string; size?: number; t: number; font?: string }> = ({ x, y, text, color = ID.dawn, size = 46, t, font = "'Aref Ruqaa', serif" }) => {
  if (t <= 0.001) return null;
  const w = text.length * size * 0.58 + 64;
  return (
    <g opacity={t} transform={`translate(${x} ${y + (1 - t) * 18})`}>
      <rect x={-w / 2} y={-size * 1.05} width={w} height={size * 1.55} rx={size * 0.78} fill={darken(ID.night, 0.4)} opacity={0.86} stroke={color} strokeWidth={3} />
      <text x={0} y={0} textAnchor="middle" direction="rtl" fontFamily={font} fontWeight={700} fontSize={size} fill={color}>
        {text}
      </text>
    </g>
  );
};

/** بوابة/قوس محراب يضيء (نهاية الطريق، آخر الحارة) */
export const MihrabGate: React.FC<{ x: number; w?: number; h?: number; light?: number; base?: number }> = ({ x, w = 190, h = 290, light = 1, base = GROUND }) => (
  <g>
    <Glow cx={x + w / 2} cy={base - h * 0.5} r={520} opacity={light} />
    <path d={archPath(x - 26, base, w + 52, h + 34)} fill={ID.copper} />
    <path d={archPath(x - 12, base, w + 24, h + 16)} fill={darken(ID.copper, 0.3)} />
    <path d={archPath(x, base, w, h)} fill={mix(ID.night, lighten(ID.dawn, 0.2), light)} />
  </g>
);

/** لافتة طريق بسهم */
export const Signpost: React.FC<{ x: number; dir?: 1 | -1; base?: number }> = ({ x, dir = 1, base = GROUND }) => {
  const wood = darken(ID.copper, 0.5);
  const y = base - 300;
  return (
    <g>
      <rect x={x - 8} y={y} width={16} height={300} fill={darken(wood, 0.2)} />
      <path d={dir === 1 ? `M${x - 20} ${y + 20} H${x + 170} L${x + 200} ${y + 50} L${x + 170} ${y + 80} H${x - 20} Z` : `M${x + 20} ${y + 20} H${x - 170} L${x - 200} ${y + 50} L${x - 170} ${y + 80} H${x + 20} Z`} fill={wood} />
    </g>
  );
};

/** الحركة المسموح بها للكاميرا */
export type Camera = "push" | "track" | "still" | "rise" | "drift";
/** تحويل الكاميرا لطبقة بعمق depth (0 بعيد، 1 قريب) */
export const cameraTransform = (camera: Camera, frame: number, dur: number, depth: number, focusX = WW / 2) => {
  const p = interpolate(frame, [0, dur], [0, 1], clampOpt);
  const e = Easing.inOut(Easing.sin)(p);
  switch (camera) {
    case "push": {
      const z = 1 + 0.07 * e * (0.4 + depth * 0.6);
      return `translate(${focusX} ${GROUND}) scale(${z}) translate(${-focusX} ${-GROUND})`;
    }
    case "track":
      return `translate(${-90 * e * depth} 0)`;
    case "rise":
      return `translate(0 ${40 * (1 - e) * depth})`;
    case "drift":
      return `translate(${-30 * e * depth} 0)`;
    default:
      return "";
  }
};

/** طاولة عمل (أعمالنا ومشروعاتنا): أوراق وأدوات بسيطة، وإناء فخاري مكتمل يضيء عند «النجاح» */
export const Workbench: React.FC<{ x: number; mood: Mood; done?: number }> = ({ x, mood, done = 0 }) => {
  const wood = darken(ID.copper, 0.45);
  return (
    <g>
      {done > 0.01 ? <Glow cx={x + 150} cy={GROUND - 200} r={260} opacity={done} /> : null}
      <rect x={x} y={GROUND - 150} width={300} height={18} rx={3} fill={mix(wood, stoneFor(mood), 0.2)} />
      <rect x={x + 18} y={GROUND - 132} width={14} height={132} fill={darken(wood, 0.2)} />
      <rect x={x + 268} y={GROUND - 132} width={14} height={132} fill={darken(wood, 0.2)} />
      <rect x={x + 30} y={GROUND - 168} width={90} height={18} fill={mix(ID.paper, stoneFor(mood, 0.4), 0.35)} transform={`rotate(-4 ${x + 75} ${GROUND - 160})`} />
      <rect x={x + 44} y={GROUND - 176} width={80} height={10} fill={mix(ID.paper, stoneFor(mood, 0.4), 0.2)} />
      <path d={`M${x + 190} ${GROUND - 150} q-26 -10 -16 -50 q6 -18 -6 -26 h52 q-12 8 -6 26 q10 40 -16 50 z`} fill={mix(darken(ID.copper, 0.2), ID.dawn, done)} />
      <rect x={x + 176} y={GROUND - 232} width={36} height={8} rx={3} fill={mix(darken(ID.copper, 0.3), ID.dawn, done)} />
    </g>
  );
};

/** دوائر تتسع من يد من ينشر خبرًا: الكلمة تصل أبعد مما يظن */
export const Ripples: React.FC<{ x: number; y: number; t: number; frame: number; at: number }> = ({ x, y, t, frame, at }) => {
  if (t <= 0.001) return null;
  return (
    <g>
      {[0, 1, 2].map((k) => {
        const p = ((frame - at - k * 12) % 48) / 48;
        if (frame - at - k * 12 < 0) return null;
        return <circle key={k} cx={x} cy={y} r={30 + p * 260} fill="none" stroke={ID.dawn} strokeWidth={4} opacity={(1 - p) * 0.7 * t} />;
      })}
    </g>
  );
};
