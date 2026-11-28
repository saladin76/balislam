/**
 * D247: لوحات ستوري بورد «مكتب القارئ» (زبدة الكتب) — صور ثابتة للمراجعة وحدها، لا قالب إنتاج.
 * عالم واحد بثلاث زوايا: أ من أعلى، وب ثلاثة أرباع بعمق ميدان، وج لقطة قريبة على الصفحة (boards.ts).
 *
 * - مكتب خشب بعروق مولَّدة ببذرة ثابتة، وشريطا ضوء شباك مائلان، وظل ناعم تحت الورق.
 * - صفحة الدفتر بأسلوب «دفتر القارئ» المعتمد: قلم أزرق وأحمر، والفسفوري #E8F542 للفكرة وحدها، وورق أبيض بسطور خفيفة.
 * - يد واحدة عامة بلا شخصية (حتى الرسغ وحده، يقطعه طرف الكادر)، بلا تفاصيل لون أو جنس، تكتب من اليمين إلى اليسار.
 * - بطاقة الآية ورقة على المكتب بنص السكريبت حرفًا وخط الأميري، بلا يد ولا قلم ولا تحديد قربها (توقير).
 * - لا عنصر في نطاق الترجمة (٢٢٪ أسفل الكادر)؛ والترجمة حبر داكن بهالة ورقية في مكانها الحقيقي.
 * - لا يُسجَّل في sceneCatalog ولا في قوالب الخطة؛ يُرندر على جهاز الرندر بمهمة «stills» وحدها (D247).
 */
import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { fontFamilies } from "../../../../brand/fonts";
import { useBrandFonts } from "../../useBrandFonts";
import { DESK_BOARDS, TAHA_14, TAHA_14_REF, type DeskVariant } from "./boards";

const W = 1920, H = 1080;
/** أعلى نطاق الترجمة: لا عنصر تحته */
export const DESK_CAPTION_TOP = Math.round(H * 0.78);

export const DK = {
  paper: "#FFFEFA",
  paperEdge: "#ECE6DA",
  rule: "#D3DFEA",
  margin: "#FF6B4A",
  ink: "#111111",
  blue: "#22416E",
  red: "#C0392B",
  grey: "#7A7A7A",
  hl: "#E8F542",
  note: ["#FFFFFF", "#F4F4F1", "#FDFBE6"],
  woodA: "#C8976A",
  woodB: "#B07D4F",
  woodLine: "rgba(92,56,26,0.20)",
  hand: "#D6BFA8",
  handShade: "#BFA48B",
  card: "#FFFDF7",
} as const;

const HAND = fontFamilies.hand, CLEAN = fontFamilies.clean, BOLD = fontFamilies.bold, QURAN = fontFamilies.quran;

// ───────────────────────── أدوات ─────────────────────────
const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
let ctx: CanvasRenderingContext2D | null = null;
const measure = (text: string, size: number, family: string, weight = 400) => {
  if (typeof document === "undefined") return text.length * size * 0.42;
  ctx = ctx ?? document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * size * 0.42;
  ctx.font = `${weight} ${size}px ${family}`;
  return ctx.measureText(text).width;
};

type Seg = { t: string; c?: string; hl?: boolean; strike?: boolean; family?: string; weight?: number };
/** سطر من اليمين إلى اليسار: x الحافة اليمنى؛ التحديد تحت الجزء والشطب فوقه */
const Row: React.FC<{ x: number; y: number; size: number; segs: Seg[]; c?: string; family?: string }> = ({ x, y, size, segs, c = DK.blue, family = HAND }) => {
  let cur = x;
  const gap = size * 0.3;
  const parts = segs.map((s) => {
    const f = s.family ?? family, wt = s.weight ?? 700;
    const w = measure(s.t, size, f, wt);
    const right = cur;
    cur -= w + gap;
    return { ...s, f, wt, w, right };
  });
  return (
    <g>
      {parts.filter((p) => p.hl).map((p, i) => (
        <path key={`h${i}`} d={`M${p.right + 8} ${y - size * 0.5} L${p.right - p.w - 10} ${y - size * 0.56} L${p.right - p.w - 6} ${y + size * 0.2} L${p.right + 10} ${y + size * 0.16} Z`} fill={DK.hl} opacity={0.88} />
      ))}
      {parts.map((p, i) => (
        <text key={i} x={p.right} y={y} direction="rtl" textAnchor="start" style={{ fontFamily: p.f, fontWeight: p.wt, fontSize: size, fill: p.c ?? c }}>{p.t}</text>
      ))}
      {parts.filter((p) => p.strike).map((p, i) => (
        <path key={`s${i}`} d={`M${p.right + 6} ${y - size * 0.3} q${-p.w / 2} ${-6} ${-p.w - 12} ${3}`} stroke={DK.red} strokeWidth={5} fill="none" strokeLinecap="round" />
      ))}
    </g>
  );
};
const Tick: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <path d={`M${x - 16 * s} ${y - 4 * s} l${10 * s} ${14 * s} l${24 * s} ${-34 * s}`} stroke={DK.red} strokeWidth={5.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
);
const Box: React.FC<{ x: number; y: number; dashed?: boolean; c?: string }> = ({ x, y, dashed, c = DK.blue }) => (
  <rect x={x - 19} y={y - 32} width={38} height={38} rx={6} fill="none" stroke={c} strokeWidth={3.5} strokeDasharray={dashed ? "7 6" : undefined} />
);

// ───────────────────────── المكتب والضوء ─────────────────────────
const Desk: React.FC<{ seed: number; x0: number; y0: number; x1: number; y1: number }> = ({ seed, x0, y0, x1, y1 }) => {
  const planks = useMemo(() => {
    const r = rng(seed);
    const out: { y: number; h: number; tint: number; grain: string[]; knots: { x: number; y: number; rx: number }[] }[] = [];
    for (let y = y0; y < y1; ) {
      const h = 150 + Math.round(r() * 40);
      const grain: string[] = [];
      const lines = 9 + Math.floor(r() * 5);
      for (let k = 0; k < lines; k++) {
        const gy = y + 8 + (h - 16) * (k + r() * 0.6) / lines;
        const amp = 2 + r() * 7, len = 260 + r() * 520, ph = r() * 6.28;
        let d = `M${x0} ${gy.toFixed(1)}`;
        for (let x = x0; x <= x1; x += 60) d += ` L${x} ${(gy + Math.sin(x / len * 6.28 + ph) * amp + Math.sin(x / 97 + ph) * 1.2).toFixed(1)}`;
        grain.push(d);
      }
      const knots = r() < 0.6 ? [{ x: x0 + r() * (x1 - x0), y: y + h * (0.3 + r() * 0.4), rx: 14 + r() * 22 }] : [];
      out.push({ y, h, tint: r(), grain, knots });
      y += h;
    }
    return out;
  }, [seed, x0, y0, x1, y1]);
  return (
    <g>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={DK.woodA} />
      {planks.map((p, i) => (
        <g key={i}>
          <rect x={x0} y={p.y} width={x1 - x0} height={p.h} fill={p.tint > 0.5 ? DK.woodB : DK.woodA} opacity={0.35 + p.tint * 0.4} />
          {p.grain.map((d, k) => <path key={k} d={d} stroke={DK.woodLine} strokeWidth={k % 3 === 0 ? 2.6 : 1.4} fill="none" />)}
          {p.knots.map((k, j) => (
            <g key={j}>
              <ellipse cx={k.x} cy={k.y} rx={k.rx} ry={k.rx * 0.38} fill="rgba(92,56,26,0.18)" />
              <ellipse cx={k.x} cy={k.y} rx={k.rx * 1.9} ry={k.rx * 0.7} fill="none" stroke={DK.woodLine} strokeWidth={1.6} />
            </g>
          ))}
          <line x1={x0} x2={x1} y1={p.y} y2={p.y} stroke="rgba(60,34,14,0.45)" strokeWidth={3} />
          <line x1={x0} x2={x1} y1={p.y + 3} y2={p.y + 3} stroke="rgba(255,230,190,0.18)" strokeWidth={2} />
        </g>
      ))}
    </g>
  );
};

/** شريطا ضوء الشباك المائلان (فوق كل شيء، بمزج «screen») */
const Sun: React.FC<{ id: string; x0: number; y0: number; x1: number; y1: number }> = ({ id, x0, y0, x1, y1 }) => {
  const hgt = y1 - y0, slope = 0.55 * hgt;
  const band = (x: number, w: number) => `${x},${y0} ${x + w},${y0} ${x + w - slope},${y1} ${x - slope},${y1}`;
  return (
    <g style={{ mixBlendMode: "screen" }} filter={`url(#${id}-soft)`}>
      <polygon points={band(x0 + (x1 - x0) * 0.58, 300)} fill="rgba(255,236,196,0.30)" />
      <polygon points={band(x0 + (x1 - x0) * 0.58 + 390, 170)} fill="rgba(255,236,196,0.24)" />
    </g>
  );
};

// ───────────────────────── الورق ─────────────────────────
const Notebook: React.FC<{ x: number; y: number; w: number; h: number; id: string; children?: React.ReactNode }> = ({ x, y, w, h, id, children }) => {
  const half = w / 2;
  const lines: number[] = [];
  for (let ly = 110; ly < h - 30; ly += 56) lines.push(ly);
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-10} y={-8} width={w + 20} height={h + 18} rx={14} fill="#2B2B2B" filter={`url(#${id}-shadow)`} />
      {[0, half].map((px) => (
        <g key={px}>
          <rect x={px} y={0} width={half} height={h} rx={px === 0 ? 10 : 10} fill={DK.paper} />
          {lines.map((ly) => <line key={ly} x1={px + 30} x2={px + half - 30} y1={ly} y2={ly} stroke={DK.rule} strokeWidth={2} />)}
          <line x1={px + half - 64} x2={px + half - 64} y1={20} y2={h - 20} stroke={DK.margin} strokeWidth={2} opacity={0.45} />
        </g>
      ))}
      <rect x={half - 60} y={0} width={120} height={h} fill={`url(#${id}-spine)`} />
      {children}
    </g>
  );
};

/** كتاب مفتوح بسطور رمادية (المصدر)؛ blueBracket قوس أزرق على كلام المؤلف */
const OpenBook: React.FC<{ x: number; y: number; w: number; h: number; rot?: number; id: string; title?: string; blueBracket?: boolean }> = ({ x, y, w, h, rot = 0, id, title, blueBracket }) => {
  const half = w / 2;
  const rows: number[] = [];
  for (let ly = 70; ly < h - 40; ly += 26) rows.push(ly);
  const r = rng(7);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot} ${half} ${h / 2})`}>
      <rect x={-14} y={-6} width={w + 28} height={h + 22} rx={10} fill="#1F2A33" filter={`url(#${id}-shadow)`} />
      <path d={`M0 18 Q${half / 2} -6 ${half} 14 L${half} ${h} Q${half / 2} ${h - 16} 0 ${h - 2} Z`} fill="#FBF8F1" />
      <path d={`M${half} 14 Q${half * 1.5} -6 ${w} 18 L${w} ${h - 2} Q${half * 1.5} ${h - 16} ${half} ${h} Z`} fill="#FFFDF8" />
      <rect x={half - 40} y={0} width={80} height={h} fill={`url(#${id}-spine)`} opacity={0.8} />
      {rows.map((ly, i) => (
        <g key={ly}>
          <rect x={40 + (i % 5 === 4 ? 60 : 0)} y={ly} width={half - 90 - (i % 5 === 4 ? 60 : r() * 30)} height={7} rx={3} fill="#B9B4AA" />
          <rect x={half + 50} y={ly} width={half - 90 - r() * 30} height={7} rx={3} fill="#B9B4AA" />
        </g>
      ))}
      {title && <text x={w - 40} y={46} direction="rtl" textAnchor="start" style={{ fontFamily: CLEAN, fontWeight: 700, fontSize: 22, fill: "#8C857A" }}>{title}</text>}
      {blueBracket && <path d={`M${w - 22} 120 q12 0 12 14 v150 q0 14 -12 14`} stroke={DK.blue} strokeWidth={6} fill="none" strokeLinecap="round" />}
    </g>
  );
};

const Calendar: React.FC<{ x: number; y: number; id: string }> = ({ x, y, id }) => (
  <g transform={`translate(${x} ${y}) rotate(-5)`}>
    <rect x={0} y={0} width={270} height={300} rx={14} fill="#FFFFFF" filter={`url(#${id}-shadow)`} />
    <rect x={0} y={0} width={270} height={64} rx={14} fill={DK.ink} />
    <rect x={0} y={44} width={270} height={20} fill={DK.ink} />
    {[60, 210].map((cx) => <circle key={cx} cx={cx} cy={8} r={9} fill="#9A9A9A" />)}
    {Array.from({ length: 5 }, (_, r) => Array.from({ length: 7 }, (_, c) => (
      <rect key={`${r}-${c}`} x={22 + c * 34} y={90 + r * 40} width={24} height={24} rx={4} fill={(r === 1 && c === 2) || (r === 2 && c === 5) || (r === 3 && c === 1) ? "none" : "#EEEEEA"}
        stroke={(r === 1 && c === 2) || (r === 2 && c === 5) || (r === 3 && c === 1) ? DK.red : "none"} strokeWidth={3} />
    )))}
  </g>
);

const Clock: React.FC<{ x: number; y: number; r: number; id: string; blur?: boolean }> = ({ x, y, r, id }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={r + 14} fill="#2B2B2B" filter={`url(#${id}-shadow)`} />
    <circle r={r} fill="#FFFFFF" />
    {Array.from({ length: 12 }, (_, i) => (
      <line key={i} x1={0} x2={0} y1={-r + 10} y2={-r + (i % 3 === 0 ? 30 : 20)} stroke={DK.ink} strokeWidth={i % 3 === 0 ? 6 : 3} transform={`rotate(${i * 30})`} />
    ))}
    <line x1={0} y1={0} x2={0} y2={-r * 0.5} stroke={DK.ink} strokeWidth={9} strokeLinecap="round" transform="rotate(-60)" />
    <line x1={0} y1={0} x2={0} y2={-r * 0.75} stroke={DK.ink} strokeWidth={6} strokeLinecap="round" transform="rotate(48)" />
    <line x1={0} y1={r * 0.15} x2={0} y2={-r * 0.85} stroke={DK.red} strokeWidth={3} strokeLinecap="round" transform="rotate(128)" />
    <circle r={8} fill={DK.red} />
  </g>
);

const WorkPapers: React.FC<{ x: number; y: number; id: string }> = ({ x, y, id }) => (
  <g transform={`translate(${x} ${y})`}>
    {[-9, 4, -2].map((rot, i) => (
      <g key={i} transform={`translate(${i * 14} ${i * 10}) rotate(${rot} 160 210)`}>
        <rect width={320} height={420} rx={6} fill={i === 2 ? "#FFFFFF" : "#F4F4F1"} filter={`url(#${id}-shadow)`} />
        {i === 2 && (
          <g>
            {[60, 90, 120, 150].map((ly) => <rect key={ly} x={40} y={ly} width={240 - (ly % 60)} height={8} rx={4} fill="#C9C9C4" />)}
            {[0, 1, 2, 3, 4].map((k) => <rect key={k} x={60 + k * 46} y={360 - [70, 120, 90, 160, 130][k]!} width={30} height={[70, 120, 90, 160, 130][k]} fill={k === 3 ? "#7A7A7A" : "#BDBDBD"} />)}
            <path d="M250 -14 v60 a14 14 0 0 0 28 0 v-50 a8 8 0 0 0 -16 0 v44" stroke="#8A8A8A" strokeWidth={4} fill="none" />
          </g>
        )}
      </g>
    ))}
  </g>
);

/** قلم مستقر على المكتب (بلا يد) */
const LyingPen: React.FC<{ x: number; y: number; rot: number; id: string }> = ({ x, y, rot, id }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`} filter={`url(#${id}-shadow)`}>
    <rect x={0} y={-9} width={300} height={18} rx={9} fill={DK.blue} />
    <rect x={230} y={-10} width={70} height={20} rx={9} fill={DK.ink} />
    <path d="M0 -9 L-34 0 L0 9 Z" fill="#C9C9C4" />
  </g>
);

/** بطاقة الآية: ورقة على المكتب، الآية كاملة بنص السكريبت والأميري، والمرجع تحتها؛ لا تحديد ولا رسم عليها */
const VerseCard: React.FC<{ x: number; y: number; w: number; h: number; rot: number; id: string }> = ({ x, y, w, h, rot, id }) => {
  const words = TAHA_14.split(" ");
  // سطران عند نهاية الجملة الأولى («…إلا أنا»)، والنص حرفًا كما في السكريبت
  const l1 = words.slice(0, 7).join(" "), l2 = words.slice(7).join(" ");
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot} ${w / 2} ${h / 2})`}>
      <rect width={w} height={h} rx={8} fill={DK.card} filter={`url(#${id}-shadow)`} />
      <rect x={16} y={16} width={w - 32} height={h - 32} rx={4} fill="none" stroke={DK.ink} strokeWidth={2} opacity={0.75} />
      <rect x={24} y={24} width={w - 48} height={h - 48} rx={3} fill="none" stroke={DK.ink} strokeWidth={1} opacity={0.4} />
      <text x={w / 2} y={74} textAnchor="middle" style={{ fontFamily: CLEAN, fontWeight: 700, fontSize: 26, fill: "#4A4A4A" }}>سورة طه</text>
      <text x={w / 2} y={h / 2 + 8} textAnchor="middle" direction="rtl" style={{ fontFamily: QURAN, fontSize: 46, fill: DK.ink }}>{l1}</text>
      <text x={w / 2} y={h / 2 + 88} textAnchor="middle" direction="rtl" style={{ fontFamily: QURAN, fontSize: 46, fill: DK.ink }}>{l2}</text>
      <text x={w / 2} y={h - 44} textAnchor="middle" style={{ fontFamily: CLEAN, fontWeight: 500, fontSize: 24, fill: "#4A4A4A" }}>{TAHA_14_REF}</text>
    </g>
  );
};

// ───────────────────────── اليد ─────────────────────────
type Tool = "blue" | "red" | "grey" | "marker";
/**
 * يد يمنى عامة تمسك القلم، رأس القلم عند (x, y)، والرسغ يمتد يمينًا حتى طرف الكادر (لا ساعد ولا كم ولا ملامح).
 * edge: الإحداثي الذي يجب أن يبلغه الرسغ (طرف الكادر في هذا العالم)؛ والمقياس منه في حدود اليد الواقعية.
 */
const WritingHand: React.FC<{ x: number; y: number; tool: Tool; id: string; edge: number }> = ({ x, y, tool, id, edge }) => {
  const s = Math.min(1.5, Math.max(1, (edge - x) / 470));
  const barrel = tool === "red" ? DK.red : tool === "grey" ? DK.grey : tool === "marker" ? DK.ink : DK.blue;
  const hand = "M30 -40 C60 -95 120 -120 175 -118 C230 -116 280 -112 330 -110 L520 -104 L520 34 L330 26 C280 40 230 62 180 60 C130 58 95 42 80 22 C66 2 46 -14 30 -40 Z";
  const thumb = "M64 -72 C86 -132 140 -152 192 -142 C208 -139 208 -124 192 -119 C150 -110 116 -94 94 -60 Z";
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g transform="translate(16 26)" opacity={0.28} filter={`url(#${id}-blur)`}>
        <path d={hand} fill="#2A1708" />
        <g transform="rotate(-60)"><rect x={0} y={-10} width={300} height={20} rx={10} fill="#2A1708" /></g>
      </g>
      <g transform="rotate(-60)">
        {tool === "marker" ? (
          <g>
            <path d="M0 -14 L26 -18 L26 18 L0 14 Z" fill={DK.hl} />
            <rect x={26} y={-20} width={260} height={40} rx={10} fill={barrel} />
            <rect x={200} y={-22} width={86} height={44} rx={10} fill={DK.hl} />
          </g>
        ) : (
          <g>
            <path d="M0 0 L22 -7 L22 7 Z" fill="#8A8A8A" />
            <rect x={22} y={-9} width={270} height={18} rx={9} fill={barrel} />
            <rect x={232} y={-10} width={60} height={20} rx={9} fill={DK.ink} />
          </g>
        )}
      </g>
      <defs>
        <linearGradient id={`${id}-handg`} x1="0" y1="-1" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor={DK.hand} />
          <stop offset="1" stopColor={DK.handShade} />
        </linearGradient>
        <linearGradient id={`${id}-wrist`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.7" stopColor={DK.handShade} stopOpacity={0} />
          <stop offset="1" stopColor="#7E6A57" stopOpacity={0.35} />
        </linearGradient>
      </defs>
      <path d={hand} fill={`url(#${id}-handg)`} />
      <path d={hand} fill={`url(#${id}-wrist)`} />
      <path d={thumb} fill={DK.hand} />
      <path d="M86 20 C112 2 142 -4 172 -2 M104 42 C134 28 164 24 194 28 M72 -6 C96 -22 126 -28 156 -26" stroke={DK.handShade} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.8} />
    </g>
  );
};

// ───────────────────────── محتوى الصفحة لكل مشهد ─────────────────────────
/** إحداثيات الدفتر المحلية: صفحتان 0…w (اليسرى 0…w/2، واليمنى w/2…w)، والارتفاع h */
type Ctx = { w: number; h: number };
type Pen = { x: number; y: number; tool: Tool } | null;
type SceneDef = {
  page: (c: Ctx) => React.ReactNode;
  /** موضع رأس القلم لحظة الذروة (محلي في الدفتر)، أو null بلا يد */
  pen: Pen;
  props: "calendar" | "book" | "bookBracket" | "clock" | "papers" | "verse";
  caption: string;
  /** مركز اللقطة القريبة (محلي في الدفتر) */
  focus: { x: number; y: number };
};

const SCENES: Record<number, SceneDef> = {
  1: {
    page: ({ w }) => {
      const R = w - 110;
      return (
        <g>
          {["نقف", "نقرأ", "نركع", "نسجد"].map((t, i) => (
            <g key={t}><Box x={R + 20} y={166 + i * 112} /><Tick x={R + 24} y={160 + i * 112} /><Row x={R - 30} y={166 + i * 112} size={52} segs={[{ t }]} /></g>
          ))}
          <Box x={R + 20} y={614} dashed c={DK.red} />
          <Row x={R - 30} y={614} size={52} segs={[{ t: "القلب", c: DK.red }]} />
          <Row x={w / 2 - 90} y={180} size={46} c={DK.red} segs={[{ t: "هل يحضر" }, { t: "قلبنا", hl: true }]} />
          <Row x={w / 2 - 90} y={252} size={46} c={DK.red} segs={[{ t: "كما يحضر جسدنا؟" }]} />
          <path d={`M${w / 2 - 160} 300 C ${w / 2 - 120} 520, ${w / 2 + 40} 600, ${R - 160} 600`} stroke={DK.red} strokeWidth={5} fill="none" strokeLinecap="round" />
          <path d={`M${R - 182} 584 l24 16 l-26 14`} stroke={DK.red} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    },
    pen: { x: 1074, y: 600, tool: "red" },
    props: "book",
    caption: "هل يحضر قلبنا في الصلاة كما يحضر جسدنا؟",
    focus: { x: 900, y: 460 },
  },
  2: {
    page: ({ w }) => {
      const R = w - 110;
      return (
        <g>
          <Row x={R} y={170} size={50} segs={[{ t: "نقرأ…" }, { t: "والذهن في مكان آخر", c: DK.grey }]} />
          {[{ t: "مواعيد", x: R - 120, y: 150, r: -7, c: DK.note[0] }, { t: "هموم", x: R - 330, y: 196, r: 5, c: DK.note[2] }, { t: "رسائل", x: R - 520, y: 160, r: -3, c: DK.note[1] }].map((n) => (
            <g key={n.t} transform={`translate(${n.x} ${n.y}) rotate(${n.r})`}>
              <rect x={-150} y={-56} width={150} height={112} rx={4} fill={n.c} stroke="#DADAD3" strokeWidth={2} />
              <text x={-14} y={10} direction="rtl" textAnchor="start" style={{ fontFamily: HAND, fontWeight: 700, fontSize: 36, fill: DK.ink }}>{n.t}</text>
            </g>
          ))}
          <Row x={R} y={450} size={50} segs={[{ t: "لا نبحث عن" }, { t: "صلاة جديدة", strike: true }]} />
          <Row x={R} y={560} size={50} segs={[{ t: "بل عن" }, { t: "قلبٍ أكثر انتباهًا", hl: true }]} />
        </g>
      );
    },
    pen: { x: 935, y: 566, tool: "marker" },
    props: "calendar",
    caption: "بل عن قلب أكثر انتباها",
    focus: { x: 900, y: 500 },
  },
  3: {
    page: ({ w }) => {
      const R = w - 110;
      return (
        <g>
          <g transform={`translate(${w / 2 + 70} 96)`}>
            <rect width={w / 2 - 170} height={250} rx={10} fill="#FFFFFF" stroke={DK.ink} strokeWidth={3} />
            <rect x={w / 2 - 250} y={22} width={58} height={206} rx={4} fill={DK.ink} />
            <text x={w / 2 - 280} y={92} direction="rtl" textAnchor="start" style={{ fontFamily: BOLD, fontSize: 40, fill: DK.ink }}>أول مرة أصلي</text>
            <text x={w / 2 - 280} y={146} direction="rtl" textAnchor="start" style={{ fontFamily: BOLD, fontSize: 32, fill: DK.ink }}>وكان للصلاة طعم آخر</text>
            <text x={w / 2 - 280} y={206} direction="rtl" textAnchor="start" style={{ fontFamily: HAND, fontWeight: 700, fontSize: 34, fill: DK.blue }}>د. خالد أبو شادي</text>
          </g>
          <Row x={R} y={470} size={50} c={DK.red} segs={[{ t: "كيف نهيئ" }, { t: "قلوبنا؟", hl: true }]} />
          <path d={`M${w / 2 - 120} 260 C ${w / 2 - 220} 380, ${w / 2 - 330} 420, 300 420 S 120 330 100 250`} stroke={DK.blue} strokeWidth={5} fill="none" strokeDasharray="16 14" strokeLinecap="round" />
          {[{ x: w / 2 - 120, y: 260, t: "التهيؤ" }, { x: 300, y: 420, t: "الأقوال" }, { x: 100, y: 250, t: "الأفعال" }].map((s, i) => (
            <g key={s.t}>
              <circle cx={s.x} cy={s.y} r={20} fill={i === 0 ? DK.red : DK.paper} stroke={i === 0 ? DK.red : DK.blue} strokeWidth={5} />
              <text x={s.x} y={s.y + 70} textAnchor="middle" style={{ fontFamily: HAND, fontWeight: 700, fontSize: 40, fill: i === 0 ? DK.red : DK.blue }}>{s.t}</text>
            </g>
          ))}
          <g transform={`translate(${w / 2 - 120} 150)`}>
            <path d="M0 60 C -30 20 -30 -10 0 -10 C 30 -10 30 20 0 60 Z" fill={DK.red} />
            <circle cx={0} cy={8} r={9} fill={DK.paper} />
            <text x={-50} y={10} direction="rtl" textAnchor="start" style={{ fontFamily: HAND, fontWeight: 700, fontSize: 34, fill: DK.red }}>نحن هنا</text>
          </g>
        </g>
      );
    },
    pen: { x: 1000, y: 474, tool: "red" },
    props: "book",
    caption: "سنبدأ مما يسبقهما: كيف نهيئ قلوبنا؟",
    focus: { x: 620, y: 330 },
  },
  4: {
    page: ({ w }) => {
      const R = w - 110;
      const cx = w / 4 + 10;
      return (
        <g>
          <rect x={R - 16} y={120} width={30} height={30} rx={5} fill={DK.blue} />
          <Row x={R - 34} y={146} size={38} family={CLEAN} c={DK.ink} segs={[{ t: "ما يقوله المؤلف", weight: 700 }]} />
          <rect x={R - 16} y={184} width={30} height={30} rx={5} fill={DK.grey} />
          <Row x={R - 34} y={210} size={38} family={CLEAN} c={DK.ink} segs={[{ t: "ما نضيفه من شرح", weight: 700 }]} />
          <Row x={R} y={340} size={44} segs={[{ t: "الخشوع لا يغني عن صحة الصلاة" }]} />
          <Row x={R} y={430} size={44} c={DK.grey} segs={[{ t: "ولكلٍّ موضعه" }]} />
          <line x1={cx} x2={cx} y1={150} y2={460} stroke={DK.ink} strokeWidth={6} strokeLinecap="round" />
          <path d={`M${cx - 70} 470 h140`} stroke={DK.ink} strokeWidth={6} strokeLinecap="round" />
          <line x1={cx - 210} x2={cx + 210} y1={170} y2={170} stroke={DK.ink} strokeWidth={6} strokeLinecap="round" />
          <circle cx={cx} cy={170} r={11} fill={DK.ink} />
          {[-1, 1].map((k) => (
            <g key={k}>
              <path d={`M${cx + k * 210} 170 L${cx + k * 210 - 70} 300 M${cx + k * 210} 170 L${cx + k * 210 + 70} 300`} stroke={DK.ink} strokeWidth={3} />
              <path d={`M${cx + k * 210 - 90} 300 Q${cx + k * 210} 360 ${cx + k * 210 + 90} 300 Z`} fill="none" stroke={DK.ink} strokeWidth={5} />
              <text x={cx + k * 210} y={410} textAnchor="middle" style={{ fontFamily: HAND, fontWeight: 700, fontSize: 40, fill: DK.blue }}>{k > 0 ? "الخشوع" : "صحة الصلاة"}</text>
            </g>
          ))}
          <Row x={w / 2 - 90} y={590} size={48} segs={[{ t: "نطلب" }, { t: "الأمرين معًا", hl: true }]} />
        </g>
      );
    },
    pen: { x: 1010, y: 436, tool: "grey" },
    props: "bookBracket",
    caption: "فلكل موضعه، ونحن نطلب الأمرين معا",
    focus: { x: 430, y: 380 },
  },
  5: {
    page: ({ w }) => {
      const R = w - 110;
      const tw = measure("العجلة", 72, HAND, 700);
      return (
        <g>
          <g transform={`translate(${R} 128)`}>
            <circle cx={-6} cy={-16} r={16} fill="none" stroke={DK.blue} strokeWidth={5} />
            <path d="M-22 -16 h-44 m14 0 v14 m14 -14 v10" stroke={DK.blue} strokeWidth={5} fill="none" strokeLinecap="round" />
          </g>
          <Row x={R - 90} y={140} size={44} segs={[{ t: "مفاتيح الصلاة" }]} />
          <Row x={R - 40} y={290} size={72} c={DK.red} segs={[{ t: "العجلة" }]} />
          <ellipse cx={R - 40 - tw / 2} cy={268} rx={tw / 2 + 46} ry={62} fill="none" stroke={DK.red} strokeWidth={5} transform={`rotate(-4 ${R - 40 - tw / 2} 268)`} />
          <Row x={R} y={410} size={40} c={DK.grey} segs={[{ t: "السكينة لا تجتمع بسهولة مع الاستعجال" }]} />
          <Row x={R} y={520} size={48} segs={[{ t: "العبادة ليست" }, { t: "مهمة نعبرها", strike: true }]} />
          <Row x={R} y={610} size={48} segs={[{ t: "بل وقتٌ نُقبل فيه…" }]} />
        </g>
      );
    },
    pen: { x: 1078, y: 236, tool: "red" },
    props: "clock",
    caption: "فالعبادة ليست مهمة نعبرها على عجل",
    focus: { x: 880, y: 420 },
  },
  6: {
    page: ({ w }) => {
      const R = w - 110;
      return (
        <g>
          {["تقرير", "رسائل", "اجتماع"].map((t, i) => <Row key={t} x={R} y={150 + i * 56} size={40} c={DK.grey} segs={[{ t: `• ${t}` }]} />)}
          <path d={`M${w} 0 L${w} 300 L${w - 330} 0 Z`} fill="#F1EEE6" stroke={DK.paperEdge} strokeWidth={2} />
          <path d={`M${w} 300 L${w - 330} 0 L${w - 300} 320 Z`} fill="#E3DED2" opacity={0.9} />
          <Row x={R} y={400} size={56} c={DK.ink} segs={[{ t: "التهيؤ", hl: true }]} />
          {["نهدّئ عجلتنا", "نتذكر لماذا نصلي", "ندخل بسكينة"].map((t, i) => (
            <g key={t}><Box x={R + 20} y={486 + i * 70} />{i < 3 && <Tick x={R + 24} y={480 + i * 70} />}<Row x={R - 30} y={486 + i * 70} size={44} segs={[{ t }]} /></g>
          ))}
        </g>
      );
    },
    pen: { x: 1112, y: 618, tool: "red" },
    props: "papers",
    caption: "ونتذكر لماذا نصلي",
    focus: { x: 900, y: 470 },
  },
  7: {
    page: () => null,
    pen: null,
    props: "verse",
    caption: "",
    focus: { x: 860, y: 360 },
  },
};

// ───────────────────────── المشهد كاملًا ─────────────────────────
const Defs: React.FC<{ id: string }> = ({ id }) => (
  <defs>
    <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx={0} dy={14} stdDeviation={16} floodColor="#3A2410" floodOpacity={0.38} />
    </filter>
    <filter id={`${id}-blur`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={10} /></filter>
    <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={28} /></filter>
    <linearGradient id={`${id}-spine`} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#000" stopOpacity={0} />
      <stop offset="0.5" stopColor="#000" stopOpacity={0.16} />
      <stop offset="1" stopColor="#000" stopOpacity={0} />
    </linearGradient>
    <radialGradient id={`${id}-vig`} cx="0.5" cy="0.45" r="0.75">
      <stop offset="0.55" stopColor="#000" stopOpacity={0} />
      <stop offset="1" stopColor="#1B0F05" stopOpacity={0.42} />
    </radialGradient>
  </defs>
);

type Layout = { nb: { x: number; y: number; w: number; h: number }; book: { x: number; y: number; w: number; h: number; rot: number }; side: { x: number; y: number }; edge: number; desk: [number, number, number, number] };
const LAYOUTS: Record<DeskVariant, Layout> = {
  a: { nb: { x: 470, y: 70, w: 1180, h: 720 }, book: { x: -150, y: 150, w: 560, h: 400, rot: -8 }, side: { x: 70, y: 120 }, edge: 1990, desk: [0, 0, W, H] },
  b: { nb: { x: 400, y: 380, w: 1120, h: 672 }, book: { x: 560, y: -200, w: 800, h: 500, rot: 0 }, side: { x: 80, y: -120 }, edge: 2110, desk: [-1300, -2300, 3200, 1400] },
  c: { nb: { x: 470, y: 70, w: 1180, h: 720 }, book: { x: -150, y: 150, w: 560, h: 400, rot: -8 }, side: { x: 70, y: 120 }, edge: 1990, desk: [-400, -400, W + 400, H + 400] },
};

const Props: React.FC<{ def: SceneDef; L: Layout; id: string; far: boolean }> = ({ def, L, id, far }) => {
  // في (ب) الكتاب وأدوات المكتب في العمق خلف الدفتر (مغبَّشة)، وفي (أ) و(ج) على يسار المكتب
  const { book, side } = L;
  switch (def.props) {
    case "book":
    case "verse": return <OpenBook {...book} id={id} title="أول مرة أصلي" />;
    case "bookBracket": return <OpenBook {...book} id={id} title="أول مرة أصلي" blueBracket />;
    case "calendar": return <Calendar x={side.x} y={side.y + 40} id={id} />;
    case "clock": return <Clock x={side.x + 170} y={side.y + 220} r={120} id={id} />;
    case "papers": return far ? <WorkPapers x={1500} y={-160} id={id} /> : <WorkPapers x={40} y={side.y} id={id} />;
  }
};

const World: React.FC<{ scene: number; v: DeskVariant; id: string; layer: "all" | "far" | "near" }> = ({ scene, v, id, layer }) => {
  const def = SCENES[scene]!;
  const L = LAYOUTS[v];
  const { nb } = L;
  const far = v === "b";
  const showFar = layer !== "near", showNear = layer !== "far";
  const verse = def.props === "verse";
  return (
    <g>
      {showFar && <Desk seed={20261128} x0={L.desk[0]} y0={L.desk[1]} x1={L.desk[2]} y1={L.desk[3]} />}
      {showFar && <Props def={def} L={L} id={id} far={far} />}
      {showNear && (
        <>
          <Notebook {...nb} id={id}>{def.page({ w: nb.w, h: nb.h })}</Notebook>
          {verse && v === "a" && <VerseCard x={nb.x + nb.w / 2 - 30} y={nb.y + 150} w={640} h={400} rot={-2.5} id={id} />}
          {verse && v === "b" && <VerseCard x={nb.x + 120} y={nb.y + 40} w={640} h={420} rot={-4} id={id} />}
          {verse && <LyingPen x={nb.x + nb.w + 60} y={nb.y + 220} rot={112} id={id} />}
          {def.pen && <WritingHand x={nb.x + def.pen.x * (nb.w / 1180)} y={nb.y + def.pen.y * (nb.h / 720)} tool={def.pen.tool} id={id} edge={L.edge} />}
        </>
      )}
      {showNear && <Sun id={id} x0={L.desk[0]} y0={L.desk[1]} x1={L.desk[2]} y1={L.desk[3]} />}
    </g>
  );
};

const Caption: React.FC<{ text: string }> = ({ text }) =>
  !text ? null : (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <text x={W / 2} y={962} textAnchor="middle" direction="rtl" paintOrder="stroke"
        style={{ fontFamily: CLEAN, fontWeight: 700, fontSize: 52, fill: DK.ink, stroke: "rgba(255,253,246,0.94)", strokeWidth: 14, strokeLinejoin: "round" }}>{text}</text>
    </svg>
  );

export type ReaderDeskBoardProps = { scene: number; variant: DeskVariant };

export const ReaderDeskBoard: React.FC<ReaderDeskBoardProps> = ({ scene, variant }) => {
  const ready = useBrandFonts();
  const id = `dk${scene}${variant}`;
  const def = SCENES[scene];
  if (!ready || !def) return <AbsoluteFill style={{ background: DK.woodA }} />;
  const svg = (layer: "all" | "far" | "near", extra?: React.ReactNode, style?: React.CSSProperties) => (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} overflow="visible" style={{ position: "absolute", inset: 0, overflow: "visible", ...style }}>
      <Defs id={id} />
      {extra}
      <World scene={scene} v={variant} id={id} layer={layer} />
    </svg>
  );
  let body: React.ReactNode;
  if (variant === "a") body = svg("all");
  else if (variant === "c") {
    const L = LAYOUTS.c;
    const k = 2.05;
    const fx = L.nb.x + def.focus.x, fy = L.nb.y + def.focus.y;
    body = (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <Defs id={id} />
        <g transform={`translate(${W / 2} ${H * 0.42}) scale(${k}) translate(${-fx} ${-fy})`}>
          <World scene={scene} v="c" id={id} layer="all" />
        </g>
      </svg>
    );
  } else {
    // (ب) ثلاثة أرباع: المكتب يميل بمنظور حقيقي حول حافته القريبة، والبعيد (الكتاب والأدوات) مغبَّش بعمق الميدان
    const tilt: React.CSSProperties = { transform: "translateY(-220px) perspective(1800px) rotateX(30deg)", transformOrigin: "50% 100%" };
    body = (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, ...tilt }}>
          {svg("far", null, { filter: "blur(3.2px)" })}
          {svg("near")}
        </div>
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(255,240,214,0.34) 0%, rgba(255,240,214,0.10) 28%, rgba(255,240,214,0) 45%)" }} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: DK.woodB, direction: "rtl" }}>
      {body}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <Defs id={`${id}v`} />
        <rect width={W} height={H} fill={`url(#${id}v-vig)`} />
      </svg>
      <Caption text={def.caption} />
    </AbsoluteFill>
  );
};

/** كل لوحة بمعرّف تكوينها (Root.tsx) */
export const DESK_STILLS = DESK_BOARDS.map((b) => ({ id: b.composition, props: { scene: b.scene, variant: b.variant } as ReaderDeskBoardProps }));
