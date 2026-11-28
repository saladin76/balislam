/**
 * قالب «دفتر القارئ» (reader-notebook) لـ«زبدة الكتب» (D227)، مبنيّ وفق D228 بعد اختيار المالك نماذجه من ستوري بورد
 * «زبدة-الكتب-001»: ست لقطات، كل لقطة نموذج معتمد واحد (shots.ts). كتابة ورسم باليد بالقلم الأزرق والأحمر وقلم التحديد
 * على ورق الدفتر. التصاميم المرسلة إلهام لا نسخ: الصورة الثابتة هدف الشكل، وسطر «الحركة» هدف الحركة.
 *
 * - كل خانة من السكريبت تُكتب أو تُرسم لحظة نطق كلمتها («…Word»)، وتمتد كتابتها حتى الحدث التالي فلا يقف القلم
 *   أكثر من لحظة بين الأحداث (القاعدة الثانية). الخانة بلا كلمة منطوقة تأخذ دورها بالترتيب بين جاريها.
 * - السكون: كل ذكر لله ±٠٫٢٥ ث والدعاء (stillWindows): الزمن «الفعّال» لا يتقدم داخل النافذة، فالصورة تقف تمامًا
 *   ثم تكمل من حيث وقفت بلا قفز. لا تحديد ولا دائرة ولا مرسى على ذكر الله (توقير).
 * - لا عنصر في نطاق الترجمة أسفل الكادر (٢٢٪)، والترجمة حبر داكن بهالة ورقية بلا مستطيل خلفها.
 * - بلا وجوه ولا شخصيات ولا موسيقى.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamilies } from "../../../../brand/fonts";
import { useBrandFonts } from "../../useBrandFonts";
import { CAPTION_BAND, CAPTION_TONES, anchorAt, captionLine, effectiveTime, sceneWords, stillWindows, type TimedWord } from "../../three/anchors";
import type { Window } from "../../three/time";
import { SACRED_WORD } from "../../../render/stillnessSpans";
import { normalizeArabic } from "../../../script/quranMeta";
import { SceneShell } from "../../scenes/SceneShell";
import type { SceneBase } from "../../scenes/types";
import { NOTEBOOK_SHOTS, type NotebookShotId } from "./shots";
export { NOTEBOOK_SHOTS, type NotebookShotId };

type Str = Record<string, string | undefined>;
export type ReaderNotebookProps = SceneBase & { shot?: string } & { [field: string]: unknown };

export const NB = {
  paper: "#FAF6EE",
  ink: "#1D2B3A",
  blue: "#22416E",
  red: "#C0392B",
  grey: "#6E6457",
  hl: "rgba(255,214,96,0.82)",
  dot: "#D9D0C0",
  rule: "#D3DFEA",
  margin: "#E8A9A2",
  sheet: "#F2EADB",
  sheetFold: "#E2D7C1",
  notes: ["#DCE7F4", "#FFF1B3", "#DDEDD8", "#F7DCD6"],
} as const;
const W = 1920, H = 1080;
/** لا عنصر تحت هذا الخط (نطاق الترجمة ٢٢٪ من الارتفاع، مع هامش للكاميرا) */
export const NB_SAFE_BOTTOM = Math.round(H * (1 - CAPTION_BAND)) - 30;
const HAND = fontFamilies.hand, BODY = fontFamilies.body;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const letters = (s: string) => s.replace(/[ً-ْٰـ\s]/g, "").length;
const sacred = (s?: string) => Boolean(s && SACRED_WORD.test(normalizeArabic(s)));
export const splitList = (s?: string) => (s ?? "").split("|").map((x) => x.trim()).filter(Boolean);
/** جزء من 0..1 داخل تقدم الجزء: [a, b] */
const sub = (p: number, a: number, b: number) => clamp01((p - a) / Math.max(0.001, b - a));

// ───────────────────────── القياس ─────────────────────────
let ctx: CanvasRenderingContext2D | null = null;
export const measure = (text: string, size: number, family: string, weight = 400) => {
  if (typeof document === "undefined") return letters(text) * size * 0.5 + (text.split(" ").length - 1) * size * 0.25;
  ctx = ctx ?? document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * size * 0.5;
  ctx.font = `${weight} ${size}px ${family}`;
  return ctx.measureText(text).width;
};

// ───────────────────────── الجدولة ─────────────────────────
/** جزء يُرسم: مفتاحه، وكلمته المنطوقة، ووزنه (طول الكتابة)، وأقصى مدة له */
export type Part = { key: string; anchor?: string; weight: number; max?: number };
export type Slot = { key: string; a: number; d: number };

/**
 * أزمنة الأجزاء بالثواني «الفعّالة» (بعد طي نوافذ السكون): الجزء بكلمة منطوقة يبدأ عندها (قبلها بعُشر ثانية)،
 * والجزء بلا كلمة يأخذ دوره بالترتيب بين جاريه. مدة الكتابة من طول النص، وتمتد حتى الجزء التالي (بحد أقصى)،
 * فيبقى القلم يكتب طوال الكلام. لا مرسى على ذكر الله.
 */
export const schedule = (parts: Part[], words: TimedWord[], still: Window[], dur: number): Slot[] => {
  if (!parts.length) return [];
  const E = (x: number) => effectiveTime(x, still);
  const speechA = words.length ? words[0]!.s : 0.3;
  const speechB = words.length ? words[words.length - 1]!.e : dur - 0.5;
  const fixed = parts.map((p) => {
    if (sacred(p.anchor)) return null;
    const at = anchorAt(words, p.anchor);
    return at === null ? null : E(Math.max(0, at - 0.1));
  });
  const starts: number[] = [];
  const a0 = E(Math.max(0.05, speechA - 0.1)), b0 = E(Math.max(speechA + 1, speechB - 0.6));
  let i = 0;
  while (i < parts.length) {
    if (fixed[i] !== null) { starts[i] = fixed[i]!; i++; continue; }
    let j = i;
    while (j < parts.length && fixed[j] === null) j++;
    const left = i === 0 ? a0 : starts[i - 1]! + 0.6;
    const right = j < parts.length ? fixed[j]! - 0.3 : b0;
    const n = j - i, span = Math.max(0.4 * n, right - left);
    for (let k = 0; k < n; k++) starts[i + k] = left + (span * k) / n;
    i = j;
  }
  for (let k = 1; k < starts.length; k++) starts[k] = Math.max(starts[k]!, starts[k - 1]! + 0.12);
  // آخر الكلام بالزمن الفعّال: لا كتابة بعده بقليل (ولا داخل نافذة السكون أصلًا)
  const endE = Math.min(E(dur) - 0.2, E(speechB) + 0.5);
  return parts.map((p, k) => {
    const own = Math.min(3.2, Math.max(0.6, 0.07 * p.weight));
    const next = k + 1 < parts.length ? starts[k + 1]! : endE;
    const gap = next - starts[k]!;
    return { key: p.key, a: starts[k]!, d: Math.max(0.45, Math.min(Math.max(own, gap - 0.12), p.max ?? 4.2)) };
  });
};

// ───────────────────────── الأدوات المرسومة ─────────────────────────
/** خط باليد: مسار يُخطّ من أوله إلى آخره */
const Pen: React.FC<{ d: string; p: number; c?: string; w?: number; o?: number }> = ({ d, p, c = NB.ink, w = 4.6, o = 1 }) =>
  p <= 0 ? null : <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - clamp01(p)} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={o} />;

/** رأس القلم عند موضع الكتابة */
const Nib: React.FC<{ x: number; y: number; c?: string }> = ({ x, y, c = "#2F4F7A" }) => (
  <g transform={`translate(${x} ${y}) rotate(-32)`}>
    <path d="M0 0 L-5 -15 L5 -15 Z" fill={NB.ink} />
    <rect x={-7} y={-100} width={14} height={86} rx={5} fill={c} />
    <rect x={-7} y={-114} width={14} height={16} rx={4} fill={NB.ink} />
  </g>
);

/** نص يُكتب من يمين السطر إلى يساره والقلم عند رأس الكتابة. x = الحافة اليمنى للسطر */
const Hand: React.FC<{ id: string; x: number; y: number; text: string; size: number; p: number; c?: string; family?: string; weight?: number; pen?: boolean; o?: number }> = ({ id, x, y, text, size, p, c = NB.ink, family = HAND, weight = 700, pen = true, o = 1 }) => {
  if (p <= 0 || !text) return null;
  const w = measure(text, size, family, weight) + size * 0.35;
  const shown = clamp01(p);
  const cx = x + size * 0.15 - w * shown;
  return (
    <g opacity={o}>
      {shown < 1 && (
        <defs>
          <clipPath id={`nb-${id}`}><rect x={cx} y={y - size * 1.5} width={x - cx + size} height={size * 2.4} /></clipPath>
        </defs>
      )}
      <text x={x} y={y} direction="rtl" textAnchor="start" clipPath={shown < 1 ? `url(#nb-${id})` : undefined} style={{ fontFamily: family, fontSize: size, fontWeight: weight, fill: c }}>{text}</text>
      {pen && shown < 1 && <Nib x={cx} y={y - size * 0.15} />}
    </g>
  );
};

/** قلم التحديد يمتد من اليمين خلف عبارة. x = الحافة اليمنى للعبارة، y = خط الكتابة */
const MarkBar: React.FC<{ x: number; y: number; w: number; size: number; p: number }> = ({ x, y, w, size, p }) =>
  p <= 0 ? null : <rect x={x + size * 0.12 - w * clamp01(p)} y={y - size * 0.42} width={w * clamp01(p)} height={size * 0.62} fill={NB.hl} style={{ mixBlendMode: "multiply" }} />;

/** مربع مرسوم باليد (x,y = الركن الأيسر الأعلى) */
const boxPath = (x: number, y: number, s: number) => `M${x + 2} ${y} L${x + s} ${y + 2} L${x + s - 1} ${y + s} L${x + 1} ${y + s - 1} Z`;
/** علامة ✓ حمراء داخل المربع */
const checkPath = (x: number, y: number, s: number) => `M${x + s * 0.16} ${y + s * 0.5} L${x + s * 0.42} ${y + s * 0.8} L${x + s * 0.98} ${y + s * 0.02}`;

const PaperBg: React.FC<{ kind: "dots" | "lines" }> = ({ kind }) => (
  <g>
    <rect x={-300} y={-300} width={W + 600} height={H + 600} fill={NB.paper} />
    {kind === "lines"
      ? (
        <g>
          {Array.from({ length: 20 }, (_, i) => <line key={i} x1={-300} x2={W + 300} y1={-100 + i * 84} y2={-100 + i * 84} stroke={NB.rule} strokeWidth={2} />)}
          <line x1={1780} x2={1780} y1={-300} y2={H + 300} stroke={NB.margin} strokeWidth={3} />
        </g>
      )
      : (
        <g fill={NB.dot}>
          {Array.from({ length: 30 }, (_, r) => Array.from({ length: 48 }, (_, c) => <circle key={`${r}-${c}`} cx={-260 + c * 52} cy={-260 + r * 52} r={2.2} />))}
        </g>
      )}
  </g>
);

/** ورقة لاصقة: تطلع من الهامش إلى موضعها وتلتصق بميل خفيف */
const Sticky: React.FC<{ x: number; y: number; w: number; h: number; rot: number; fill: string; text?: string; p: number; fade?: number; scribble?: boolean }> = ({ x, y, w, h, rot, fill, text, p, fade = 0, scribble }) => {
  if (p <= 0) return null;
  const fly = easeOut(sub(p, 0, 0.55));
  const fromX = 1800 - x;
  const tx = x + (1 - fly) * fromX * 0.9, ty = y + (1 - fly) * 40;
  const r = rot * (0.3 + 0.7 * fly);
  const o = clamp01(p * 6) * (1 - 0.82 * clamp01(fade));
  return (
    <g opacity={o} transform={`translate(${tx + (fade * -60)} ${ty}) rotate(${r} ${w / 2} ${h / 2})`}>
      <rect x={7} y={10} width={w} height={h} fill="rgba(40,30,20,0.10)" />
      <rect x={0} y={0} width={w} height={h} fill={fill} />
      {text && <Hand id={`st-${text}`} x={w - 40} y={h * 0.42} text={text} size={50} p={sub(p, 0.45, 1)} pen={false} />}
      {scribble && <Pen d={`M${w - 50} ${h * 0.4} c-30 -20 -60 24 -90 0 s-60 -22 -90 4 M${w - 60} ${h * 0.62} c-40 18 -70 -16 -110 6`} p={sub(p, 0.45, 1)} c={NB.grey} w={4} />}
    </g>
  );
};

// ───────────────────────── اللقطات ─────────────────────────
type Ctx = { p: Str; pr: (key: string) => number; te: number; slot: (key: string) => Slot | undefined };
type ShotDef = { parts: (p: Str) => Part[]; focus: Record<string, [number, number]>; draw: (c: Ctx) => React.ReactNode };
const wt = (s?: string) => letters(s ?? "");

const SHOTS: Record<NotebookShotId, ShotDef> = {
  // مشهد ١ (أ): المربعات تُرسم، والأفعال تُكتب بالأزرق مع كل كلمة، ثم ✓ حمراء لكل فعل، والمربع الأخير يبقى فارغًا،
  // والقوس يجمع الأفعال (هذا الاعتياد)، ثم سؤال الهامش بالأحمر وسهمه ينزل على المربع الفارغ
  "checklist-heart": {
    parts: (p) => {
      const items = splitList(p.items).slice(0, 4), iw = splitList(p.itemWords);
      return [
        { key: "boxes", anchor: p.boxesWord, weight: 30, max: 2.4 },
        ...(p.heart ? [{ key: "heartBox", anchor: p.heartBoxWord, weight: 10, max: 1.4 }] : []),
        ...items.map((it, k) => ({ key: `item${k}`, anchor: iw[k], weight: wt(it) + 8, max: 1.2 })),
        { key: "checks", anchor: p.checkWord, weight: 30, max: 2.6 },
        ...(p.groupWord ? [{ key: "group", anchor: p.groupWord, weight: 20, max: 1.6 }] : []),
        // السطر الأول من السؤال، ثم خانة المربع الفارغ لحظة نطقها، ثم السطر الثاني، ثم السهم
        ...splitList(p.question).slice(0, 1).map((q) => ({ key: "q0", anchor: splitList(p.questionWords)[0], weight: wt(q) + 6, max: 2.8 })),
        ...(p.heart ? [{ key: "heart", anchor: p.heartWord, weight: wt(p.heart) + 6, max: 1.2 }] : []),
        ...splitList(p.question).slice(1, 2).map((q) => ({ key: "q1", anchor: splitList(p.questionWords)[1], weight: wt(q) + 6, max: 2.8 })),
        { key: "arrow", anchor: p.arrowWord, weight: 20, max: 1.6 },
      ];
    },
    focus: { boxes: [1500, 420], heartBox: [1500, 640], item0: [1480, 260], item1: [1480, 360], item2: [1480, 460], item3: [1480, 560], checks: [1500, 420], group: [1350, 420], q0: [600, 260], q1: [600, 330], heart: [1400, 680], arrow: [1000, 500] },
    draw: ({ p, pr }) => {
      const items = splitList(p.items).slice(0, 4);
      const rows = [200, 320, 440, 560, 690];
      const bx = 1640, s = 62;
      const boxes = pr("boxes"), checks = pr("checks"), q = splitList(p.question).slice(0, 2);
      const heartRow = rows[4]!;
      return (
        <g>
          {items.map((_, k) => <Pen key={`b${k}`} d={boxPath(bx, rows[k]! - s / 2, s)} p={sub(boxes, k / 4, (k + 1) / 4)} w={4.6} />)}
          {p.heart && <Pen d={boxPath(bx, heartRow - s / 2, s)} p={pr("heartBox")} w={4.6} />}
          {items.map((it, k) => <Hand key={`i${k}`} id={`item${k}`} x={1600} y={rows[k]! + 26} text={it} size={80} p={pr(`item${k}`)} c={NB.ink} />)}
          {items.map((_, k) => <Pen key={`c${k}`} d={checkPath(bx + 4, rows[k]! - s / 2 + 2, s - 6)} p={sub(checks, k / 4, (k + 1) / 4)} c={NB.red} w={6} />)}
          {p.groupWord && <Pen d="M1440 168 C1414 172 1414 196 1414 286 C1414 368 1404 384 1384 384 C1404 384 1414 400 1414 482 C1414 574 1414 594 1440 598" p={pr("group")} c={NB.blue} w={4} o={0.8} />}
          {q.map((line, k) => <Hand key={`q${k}`} id={`q${k}`} x={600} y={200 + k * 86} text={line} size={58} p={pr(`q${k}`)} c={NB.red} />)}
          {p.heart && <Hand id="heart" x={1600} y={heartRow + 26} text={p.heart} size={80} p={pr("heart")} c={NB.red} />}
          <Pen d={`M560 300 C640 520 900 640 1385 ${heartRow - 4}`} p={sub(pr("arrow"), 0, 0.8)} c={NB.red} w={5} />
          <Pen d={`M1340 ${heartRow - 32} L1388 ${heartRow - 4} L1336 ${heartRow + 16}`} p={sub(pr("arrow"), 0.75, 1)} c={NB.red} w={5} />
        </g>
      );
    },
  },
  // مشهد ٢ (أ): «الاعتياد نعمة»، ثم سطر القراءة، وأوراق لاصقة (الذهن في مكان آخر، المواعيد، الهموم) تطلع من الهامش
  // وتغطي طرف السطر، ثم «نبحث عن قلب أكثر انتباهًا» وقلم التحديد عليه، وتنحسر الأوراق. ذكر الله آخر الجملة ساكن.
  "margin-thoughts": {
    parts: (p) => {
      const notes = splitList(p.notes).slice(0, 3), nw = splitList(p.noteWords);
      return [
        { key: "title", anchor: p.titleWord, weight: wt(p.title) + 10, max: 2.6 },
        ...(p.steadyWord ? [{ key: "steady", anchor: p.steadyWord, weight: 16, max: 1.6 }] : []),
        ...(p.habitWord ? [{ key: "habit", anchor: p.habitWord, weight: 20, max: 2.2 }] : []),
        ...(p.mindWord ? [{ key: "mind", anchor: p.mindWord, weight: 20, max: 2.4 }] : []),
        { key: "line", anchor: p.lineWord, weight: wt(p.line) + 6, max: 2.6 },
        ...notes.map((n, k) => ({ key: `note${k}`, anchor: nw[k], weight: wt(n) + 14, max: 1.6 })),
        { key: "seek", anchor: p.seekWord, weight: wt(p.seek) + 4, max: 3.2 },
        ...(p.mark ? [{ key: "mark", anchor: p.markWord, weight: wt(p.mark) + 8, max: 1.6 }] : []),
        ...(p.clearWord ? [{ key: "clear", anchor: p.clearWord, weight: 20, max: 1.3 }] : []),
      ];
    },
    focus: { title: [1450, 260], steady: [1450, 280], habit: [1250, 260], mind: [700, 600], line: [1450, 400], note0: [800, 380], note1: [1200, 420], note2: [700, 620], seek: [1400, 660], mark: [1350, 660], clear: [1000, 500] },
    draw: ({ p, pr }) => {
      const notes = splitList(p.notes).slice(0, 3);
      const titleW = measure(p.title ?? "", 76, HAND, 700);
      const seek = p.seek ?? "", mark = p.mark && !sacred(p.mark) && seek.includes(p.mark) ? p.mark : "";
      const pre = mark ? measure(seek.slice(0, seek.indexOf(mark)), 72, HAND, 700) : 0;
      const markW = mark ? measure(mark, 72, HAND, 700) + 18 : 0;
      const clear = pr("clear");
      const places = [{ x: 250, y: 250, rot: -4 }, { x: 1090, y: 330, rot: 4 }, { x: 610, y: 330, rot: 3 }];
      return (
        <g>
          <Hand id="title" x={1720} y={230} text={p.title ?? ""} size={76} p={pr("title")} />
          {p.steadyWord && <Pen d={`M1726 262 C${1720 - titleW * 0.5} 256 ${1720 - titleW * 0.8} 268 ${1714 - titleW} 260`} p={pr("steady")} c={NB.blue} w={4} />}
          {p.habitWord && (
            <g>
              <Pen d={`M${1660 - titleW - 40} 190 a40 40 0 1 0 22 -26`} p={sub(pr("habit"), 0, 0.85)} c={NB.blue} w={4.4} />
              <Pen d={`M${1660 - titleW - 22} 148 l2 20 l-20 4`} p={sub(pr("habit"), 0.8, 1)} c={NB.blue} w={4.4} />
            </g>
          )}
          {mark && <MarkBar x={1720 - pre} y={680} w={markW} size={72} p={pr("mark")} />}
          <Hand id="line" x={1720} y={380} text={p.line ?? ""} size={64} p={pr("line")} family={BODY} weight={400} />
          <Hand id="seek" x={1720} y={680} text={seek} size={72} p={pr("seek")} />
          {p.mindWord && <Sticky x={380} y={560} w={300} h={190} rot={-2} fill={NB.notes[0]} p={pr("mind")} scribble fade={clear} />}
          {notes.map((n, k) => <Sticky key={k} x={places[k]!.x} y={places[k]!.y} w={310} h={200} rot={places[k]!.rot} fill={NB.notes[(k + 1) % 4]!} text={n} p={pr(`note${k}`)} fade={clear} />)}
        </g>
      );
    },
  },
  // مشهد ٣ (أ): الرف يُرسم وكتبه بخطوط مظللة، والكتاب المختار يتقدم قليلًا ويُكتب عنوانه على كعبه، وسهم أحمر من عبارته،
  // واسم المؤلف تحت الرف؛ ثم محطات الرحلة تُكتب تحت العبارة، وتُشطب التي لا نبدأ منها، وتُحاط الأولى بدائرة، والسؤال
  "shelf-book": {
    parts: (p) => {
      const path = splitList(p.path).slice(0, 3), pw = splitList(p.pathWords);
      return [
        { key: "shelf", anchor: p.shelfWord, weight: 30, max: 1.6 },
        ...(p.title ? [{ key: "title", anchor: p.titleWord, weight: wt(p.title) + 6, max: 1.4 }] : []),
        // الكتاب يتقدم ويُكتب سطره الأول عند كلمته، ثم السطر الثاني (العنوان الفرعي) عند كلمته
        { key: "book", anchor: splitList(p.bookWords)[0], weight: wt(splitList(p.book)[0]) + 16, max: 3 },
        ...(splitList(p.book).length > 1 ? [{ key: "book2", anchor: splitList(p.bookWords)[1], weight: wt(splitList(p.book)[1]) + 6, max: 3 }] : []),
        ...(p.label ? [{ key: "label", anchor: p.labelWord, weight: wt(p.label) + 16, max: 1.4 }] : []),
        ...(p.author ? [{ key: "author", anchor: p.authorWord, weight: wt(p.author) + 8, max: 2.2 }] : []),
        ...path.map((x, k) => ({ key: `path${k}`, anchor: pw[k], weight: wt(x) + 8, max: 1.6 })),
        ...(path.length > 1 && p.skipWord ? [{ key: "skip", anchor: p.skipWord, weight: 16, max: 2 }] : []),
        ...(path.length && p.startWord ? [{ key: "start", anchor: p.startWord, weight: 18, max: 1.8 }] : []),
        ...(p.question ? [{ key: "question", anchor: p.questionWord, weight: wt(p.question) + 6, max: 2 }] : []),
      ];
    },
    focus: { shelf: [1150, 520], title: [1450, 260], book: [1270, 450], book2: [1270, 450], label: [800, 400], author: [1450, 760], path0: [700, 560], path1: [500, 560], path2: [350, 560], skip: [350, 560], start: [700, 560], question: [620, 680] },
    draw: ({ p, pr }) => {
      const s = pr("shelf"), b = pr("book"), l = pr("label");
      const seg = (k: number) => sub(s, k / 5, (k + 1) / 5);
      const lift = easeOut(sub(b, 0, 0.3));
      const bookLines = splitList(p.book).slice(0, 2);
      const path = splitList(p.path).slice(0, 3);
      // محطات الرحلة من اليمين: كلمة ثم سهم ←
      const PS = 54, gap = 86;
      const pathX: number[] = [];
      let x = 860;
      for (const it of path) { pathX.push(x); x -= measure(it, PS, HAND, 700) + gap; }
      const lastW = path.length ? measure(path[path.length - 1]!, PS, HAND, 700) : 0;
      const firstW = path.length ? measure(path[0]!, PS, HAND, 700) : 0;
      const yP = 540;
      return (
        <g>
          <Pen d="M240 700 C600 696 1200 706 1700 700" p={seg(0)} />
          <Pen d="M244 716 C640 712 1240 722 1696 716" p={seg(0)} />
          <Pen d="M880 700 L888 392 L1002 402 L996 700" p={seg(1)} />
          <Pen d="M1022 700 L1024 322 L1136 320 L1132 700" p={seg(2)} />
          <Pen d="M1430 700 L1434 372 L1530 370 L1526 700" p={seg(3)} />
          <g opacity={0.6}>{Array.from({ length: 7 }, (_, k) => <Pen key={k} d={`M896 ${420 + k * 40} L988 ${508 + k * 40}`} p={sub(seg(4), k / 7, (k + 1) / 7)} w={2} c={NB.grey} />)}</g>
          {p.title && <Hand id="title" x={1700} y={200} text={p.title} size={74} p={pr("title")} />}
          {/* الكتاب المختار: يتقدم قليلًا (يكبر ويرتفع ظله) ويُكتب عنوانه على كعبه */}
          <g transform={`translate(${1266} ${700}) scale(${1 + 0.035 * lift}) translate(${-1266} ${-700 - 8 * lift})`}>
            {lift > 0 && <rect x={1186} y={214} width={180} height={490} fill="rgba(40,30,20,0.08)" transform="translate(8 8)" />}
            <path d="M1176 704 L1178 210 L1352 216 L1358 706 Z" fill={NB.sheet} opacity={clamp01(b * 4)} />
            <Pen d="M1176 704 L1178 210 L1352 216 L1358 706 Z" p={sub(b, 0, 0.3)} w={5} />
            <Pen d="M1200 262 L1338 264 M1200 660 L1340 662" p={sub(b, 0.25, 0.4)} c={NB.red} w={3} />
            {bookLines.map((ln, k) => (
              <g key={k} transform={`translate(${1266 + (bookLines.length > 1 ? (k === 0 ? 26 : -34) : 0)} 460) rotate(90)`}>
                <Hand id={`book${k}`} x={measure(ln, k ? 36 : 50, HAND, 700) / 2} y={14} text={ln} size={k ? 36 : 50} p={k ? pr("book2") : sub(b, 0.38, 1)} pen={false} c={k ? NB.grey : NB.ink} />
              </g>
            ))}
          </g>
          <Pen d="M560 330 C760 240 1020 232 1168 298" p={sub(l, 0.55, 0.92)} c={NB.red} w={5} />
          <Pen d="M1116 268 L1170 300 L1110 324" p={sub(l, 0.9, 1)} c={NB.red} w={5} />
          {p.label && <Hand id="label" x={870} y={400} text={p.label} size={58} p={sub(l, 0, 0.6)} c={NB.red} />}
          {p.author && <Hand id="author" x={1700} y={790} text={p.author} size={50} p={pr("author")} c={NB.grey} />}
          {path.map((it, k) => (
            <g key={k}>
              <Hand id={`path${k}`} x={pathX[k]!} y={yP} text={it} size={PS} p={sub(pr(`path${k}`), 0, 0.8)} c={NB.blue} />
              {k > 0 && <Pen d={`M${pathX[k]! + 70} ${yP - 18} L${pathX[k]! + 14} ${yP - 18} M${pathX[k]! + 30} ${yP - 32} L${pathX[k]! + 14} ${yP - 18} L${pathX[k]! + 30} ${yP - 4}`} p={sub(pr(`path${k}`), 0, 0.4)} c={NB.blue} w={3.6} />}
            </g>
          ))}
          {path.length > 1 && <Pen d={`M${pathX[path.length - 1]! + 10} ${yP - 22} L${pathX[path.length - 1]! - lastW - 6} ${yP - 14}`} p={pr("skip")} c={NB.red} w={5} />}
          {path.length > 0 && (() => {
            const cx = pathX[0]! - firstW / 2, rx = firstW / 2 + 34;
            return <Pen d={`M${cx + 20} ${yP - 66} C${cx + rx + 30} ${yP - 70} ${cx + rx + 20} ${yP + 30} ${cx} ${yP + 30} C${cx - rx - 20} ${yP + 28} ${cx - rx - 26} ${yP - 64} ${cx + 34} ${yP - 70}`} p={pr("start")} c={NB.red} w={4.6} />;
          })()}
          {p.question && <Hand id="question" x={860} y={660} text={p.question} size={56} p={pr("question")} c={NB.red} />}
        </g>
      );
    },
  },
  // مشهد ٤ (ب): ميزان يُرسم بالقلم، والكفتان تميلان مع ما يُوزَن («الخشوع» في كفة و«صحة الصلاة» في الأخرى)
  // حتى تقفا متوازيتين، ثم قلم التحديد على «نطلب الأمرين معًا»
  "twin-pans": {
    parts: (p) => {
      const sw = splitList(p.swayWords).slice(0, 2), rc = splitList(p.recallWords).slice(0, 2);
      return [
        { key: "stand", anchor: p.standWord, weight: 24, max: 1.6 },
        { key: "beam", anchor: p.beamWord, weight: 30, max: 2.2 },
        ...sw.map((w, k) => ({ key: `sway${k}`, anchor: w, weight: 14, max: 1.6 })),
        ...(p.left ? [{ key: "left", anchor: p.leftWord, weight: wt(p.left) + 10, max: 1.6 }] : []),
        ...(p.right ? [{ key: "right", anchor: p.rightWord, weight: wt(p.right) + 10, max: 1.6 }] : []),
        ...rc.map((w, k) => ({ key: `recall${k}`, anchor: w, weight: 14, max: 1.6 })),
        { key: "balance", anchor: p.balanceWord, weight: 20, max: 2.2 },
        ...(p.mark ? [{ key: "mark", anchor: p.markWord, weight: wt(p.mark) + 10, max: 2.4 }] : []),
      ];
    },
    focus: { stand: [960, 460], beam: [960, 380], sway0: [1100, 440], sway1: [820, 440], left: [700, 520], right: [1220, 520], recall0: [1220, 480], recall1: [700, 480], balance: [960, 440], mark: [1050, 680] },
    draw: ({ p, pr, te, slot }) => {
      // الميل (درجات، موجب = كفة اليمين تهبط): كل حدث يميل نحو كفته، ثم «التوازن» يعيدهما متوازيتين بتأرجح يخمد
      const targets: { key: string; to: number }[] = [
        { key: "sway0", to: 6 }, { key: "sway1", to: -6 }, { key: "left", to: -5 }, { key: "right", to: 5 },
        { key: "recall0", to: 4 }, { key: "recall1", to: -4 }, { key: "balance", to: 0 },
      ];
      let ang = 0;
      for (const tg of targets) {
        const s = slot(tg.key);
        if (!s || te < s.a) continue;
        const k = ease(clamp01((te - s.a) / 0.9));
        ang = ang + (tg.to - ang) * k;
        // الكفتان تهتزان قليلًا بعد كل ميل ثم تهدآن
        if (tg.key !== "balance") ang += 2.4 * Math.exp(-(te - s.a - 0.9) * 1.1) * Math.sin((te - s.a - 0.9) * 4.6) * clamp01((te - s.a - 0.9) * 4);
      }
      const bal = slot("balance");
      if (bal && te > bal.a) ang += 3.2 * Math.exp(-(te - bal.a) * 1.6) * Math.sin((te - bal.a) * 5.2) * clamp01((te - bal.a) * 3);
      const st = pr("stand"), bm = pr("beam");
      const rad = (ang * Math.PI) / 180, L = 360, py = 300;
      const ends = [{ x: 960 - L * Math.cos(rad), y: py - L * Math.sin(rad) }, { x: 960 + L * Math.cos(rad), y: py + L * Math.sin(rad) }];
      const pan = (e: { x: number; y: number }, k: number, label?: string, lp = 0) => (
        <g key={k}>
          <Pen d={`M${e.x} ${e.y} L${e.x - 78} ${e.y + 170} M${e.x} ${e.y} L${e.x + 78} ${e.y + 170}`} p={sub(bm, 0.35 + k * 0.15, 0.6 + k * 0.15)} w={3} />
          <Pen d={`M${e.x - 108} ${e.y + 170} L${e.x + 108} ${e.y + 170} C${e.x + 98} ${e.y + 222} ${e.x - 98} ${e.y + 222} ${e.x - 108} ${e.y + 170}`} p={sub(bm, 0.55 + k * 0.15, 0.85 + k * 0.15)} w={4.4} />
          {label && <Hand id={`pan${k}`} x={e.x + measure(label, 62, HAND, 700) / 2} y={e.y + 300} text={label} size={62} p={lp} />}
        </g>
      );
      const markW = p.mark ? measure(p.mark, 62, HAND, 700) + 20 : 0;
      return (
        <g>
          <Pen d="M820 640 L1100 640" p={sub(st, 0, 0.4)} w={5} />
          <Pen d={`M960 640 L960 ${py - 80}`} p={sub(st, 0.3, 1)} w={5} />
          {st > 0.9 && <circle cx={960} cy={py - 86} r={13 * sub(st, 0.9, 1)} fill={NB.ink} />}
          <Pen d={`M${ends[0]!.x} ${ends[0]!.y} L${ends[1]!.x} ${ends[1]!.y}`} p={sub(bm, 0, 0.4)} w={5} />
          {pan(ends[0]!, 0, p.left, pr("left"))}
          {pan(ends[1]!, 1, p.right, pr("right"))}
          {p.mark && !sacred(p.mark) && <MarkBar x={960 + markW / 2} y={760} w={markW} size={62} p={sub(pr("mark"), 0.45, 1)} />}
          {p.mark && <Hand id="mark" x={960 + markW / 2 - 10} y={760} text={p.mark} size={62} p={sub(pr("mark"), 0, 0.5)} />}
        </g>
      );
    },
  },
  // مشهد ٥ (أ): المفتاح مرسومًا وبجواره «مفاتيح الصلاة»، ثم المصطلح كبيرًا وتحيط به دائرة حمراء؛ وما لا يجتمع معه بعلامة ≠؛
  // ثم «مهمة نعبرها» تُشطب، و«وقت نُقبل فيه» يمتد عليها قلم التحديد. آخر الجملة (ذكر الله) ساكن تمامًا.
  "term-circle": {
    parts: (p) => [
      { key: "key", anchor: p.keyWord, weight: 18, max: 1.2 },
      ...(p.label ? [{ key: "label", anchor: p.labelWord, weight: wt(p.label) + 6, max: 1.6 }] : []),
      { key: "term", anchor: p.termWord, weight: wt(p.term) + 12, max: 2.2 },
      { key: "circle", anchor: p.circleWord, weight: 26, max: 1.8 },
      ...(p.author ? [{ key: "author", anchor: p.authorWord, weight: wt(p.author) + 8, max: 1.6 }] : []),
      ...(p.contrast ? [{ key: "contrast", anchor: p.contrastWord, weight: wt(p.contrast) + 10, max: 1.4 }] : []),
      ...(p.contrast && p.neqWord ? [{ key: "neq", anchor: p.neqWord, weight: 14, max: 1.4 }] : []),
      ...(p.againWord ? [{ key: "again", anchor: p.againWord, weight: 20, max: 1.6 }] : []),
      ...(p.cross ? [{ key: "cross", anchor: p.crossWord, weight: wt(p.cross) + 4, max: 1.2 }] : []),
      ...(p.cross ? [{ key: "strike", anchor: p.strikeWord, weight: 14, max: 1.4 }] : []),
      ...(p.keep ? [{ key: "keep", anchor: p.keepWord, weight: wt(p.keep) + 4, max: 1.2 }] : []),
      ...(p.keep ? [{ key: "markKeep", anchor: p.markWord, weight: 12, max: 0.8 }] : []),
    ],
    focus: { key: [1580, 220], label: [1350, 220], term: [1080, 400], circle: [1040, 400], author: [480, 330], contrast: [500, 400], neq: [640, 400], again: [1040, 400], cross: [1500, 650], strike: [1500, 650], keep: [870, 650], markKeep: [870, 650] },
    draw: ({ p, pr }) => {
      const k = pr("key"), term = p.term ?? "";
      const TS = 150, tw = Math.max(220, measure(term, TS, HAND, 700));
      const cx = 1060, cy = 400, rx = tw / 2 + 120, ry = 122;
      const ring = (dx: number, dy: number) => `M${cx + 60 + dx} ${cy - ry + dy} C${cx + rx + 50} ${cy - ry - 10} ${cx + rx + 40} ${cy + ry} ${cx} ${cy + ry + dy} C${cx - rx - 40} ${cy + ry + 6} ${cx - rx - 30} ${cy - ry + 10} ${cx + 40 - dx} ${cy - ry - 6 + dy}`;
      const showRing = !sacred(term);
      const crossW = p.cross ? measure(p.cross, 60, HAND, 700) : 0;
      const keepW = p.keep ? measure(p.keep, 60, HAND, 700) + 20 : 0;
      return (
        <g>
          <Pen d="M1676 190 a36 36 0 1 0 -72 0 a36 36 0 1 0 72 0" p={sub(k, 0, 0.5)} w={4.6} />
          <Pen d="M1604 190 L1480 190 M1540 190 L1540 216 M1512 190 L1512 216" p={sub(k, 0.45, 1)} w={4.6} />
          {p.label && <Hand id="label" x={1440} y={212} text={p.label} size={50} p={pr("label")} c={NB.red} />}
          <Hand id="term" x={cx + tw / 2} y={cy + 52} text={term} size={TS} p={pr("term")} />
          {showRing && <Pen d={ring(0, 0)} p={pr("circle")} c={NB.red} w={6} />}
          {showRing && p.againWord && <Pen d={ring(14, 8)} p={pr("again")} c={NB.red} w={4} o={0.85} />}
          {p.author && <Hand id="author" x={560} y={318} text={p.author} size={44} p={pr("author")} c={NB.grey} />}
          {p.contrast && <Hand id="contrast" x={560} y={420} text={p.contrast} size={64} p={pr("contrast")} c={NB.blue} />}
          {p.contrast && p.neqWord && <Pen d="M668 380 L740 380 M668 410 L740 410 M724 352 L684 440" p={pr("neq")} c={NB.red} w={6} />}
          {p.cross && <Hand id="cross" x={1700} y={660} text={p.cross} size={60} p={pr("cross")} c={NB.grey} />}
          {p.cross && <Pen d={`M${1708} ${644} C${1700 - crossW * 0.4} ${640} ${1700 - crossW * 0.7} ${650} ${1700 - crossW - 18} ${646}`} p={pr("strike")} c={NB.red} w={6} />}
          {p.keep && <MarkBar x={1000} y={660} w={keepW} size={60} p={pr("markKeep")} />}
          {p.keep && <Hand id="keep" x={1000} y={660} text={p.keep} size={60} p={pr("keep")} />}
        </g>
      );
    },
  },
  // مشهد ٦ (أ): ورقة الشغل تُكتب بنودها بسرعة، وتخربشها الأفكار، ثم ركن الصفحة ينطوي عليها؛ وفي الصفحة «التهيؤ»
  // وتحته ثلاث خطوات، كل خطوة تُكتب وتأخذ ✓ مع نطقها، وقلم التحديد على الأخيرة
  "fold-threshold": {
    parts: (p) => {
      const steps = splitList(p.steps).slice(0, 3), sw = splitList(p.stepWords);
      return [
        { key: "sheet", anchor: p.sheetWord, weight: 24, max: 1.8 },
        { key: "work", anchor: p.workWord, weight: wt(p.work) + 10, max: 1.6 },
        ...(p.foldWord ? [{ key: "fold", anchor: p.foldWord, weight: 20, max: 1.6 }] : []),
        ...(p.nagWord ? [{ key: "nag", anchor: p.nagWord, weight: 24, max: 1.8 }] : []),
        ...(p.doneWord ? [{ key: "done", anchor: p.doneWord, weight: 20, max: 1.6 }] : []),
        { key: "title", anchor: p.titleWord, weight: wt(p.title) + 8, max: 1.4 },
        { key: "boxes", anchor: p.boxesWord, weight: 20, max: 1.2 },
        ...steps.map((s, k) => ({ key: `step${k}`, anchor: sw[k], weight: wt(s) + 14, max: 2.4 })),
        ...(steps.length && p.markWord ? [{ key: "mark", anchor: p.markWord, weight: 12, max: 0.9 }] : []),
      ];
    },
    focus: { sheet: [600, 440], work: [560, 330], fold: [620, 600], nag: [560, 330], done: [700, 560], title: [1480, 260], boxes: [1520, 470], step0: [1450, 340], step1: [1450, 470], step2: [1450, 600], mark: [1450, 600] },
    draw: ({ p, pr }) => {
      const sh = pr("sheet"), work = splitList(p.work).slice(0, 4), steps = splitList(p.steps).slice(0, 3);
      const fold = 0.45 * pr("fold") + 0.55 * pr("done");
      const f = 190 * (p.foldWord || p.doneWord ? fold : 0);
      const X0 = 110, Y0 = 120, X1 = 730, Y1 = 740;
      const sheet = `M${X0} ${Y0} L${X1} ${Y0} L${X1} ${Y1 - f} L${X1 - f} ${Y1} L${X0} ${Y1} Z`;
      const nag = pr("nag");
      const rows = [340, 470, 600], bx = 1640, s = 62;
      const last = steps.length - 1;
      const lastW = last >= 0 ? measure(steps[last]!, 56, HAND, 700) + 20 : 0;
      return (
        <g>
          <path d={sheet} fill={NB.sheet} opacity={sub(sh, 0.4, 1)} />
          <Pen d={`M${X0} ${Y0} L${X1} ${Y0} L${X1} ${Y1} L${X0} ${Y1} Z`} p={sub(sh, 0, 0.6)} w={2.4} c={NB.grey} o={1 - sub(sh, 0.7, 1)} />
          {work.map((it, k) => <Hand key={k} id={`work${k}`} x={680} y={220 + k * 96} text={it} size={52} p={sub(pr("work"), k / work.length, (k + 1) / work.length)} c={NB.grey} />)}
          {work.map((it, k) => {
            const ww = measure(it, 52, HAND, 700), y = 240 + k * 96;
            return <Pen key={`n${k}`} d={`M690 ${y} c-${ww * 0.2} 10 -${ww * 0.35} -8 -${ww * 0.55} 4 s-${ww * 0.3} -10 -${ww * 0.5} 6`} p={sub(nag, k / work.length, (k + 1) / work.length)} c={NB.red} w={3} o={0.75} />;
          })}
          {f > 1 && (
            <g>
              <path d={`M${X1} ${Y1 - f} L${X1 - f} ${Y1} L${X1 - f} ${Y1 - f} Z`} fill={NB.sheetFold} />
              <path d={`M${X1} ${Y1 - f} L${X1 - f} ${Y1} L${X1 - f} ${Y1 - f} Z`} fill="none" stroke="rgba(60,45,30,0.18)" strokeWidth={2} />
            </g>
          )}
          <Hand id="title" x={1700} y={210} text={p.title ?? ""} size={84} p={pr("title")} />
          {steps.map((_, k) => <Pen key={`b${k}`} d={boxPath(bx, rows[k]! - s / 2, s)} p={sub(pr("boxes"), k / steps.length, (k + 1) / steps.length)} w={4.6} />)}
          {last >= 0 && <MarkBar x={1600} y={rows[last]! + 24} w={lastW} size={56} p={pr("mark")} />}
          {steps.map((st, k) => (
            <g key={k}>
              <Hand id={`step${k}`} x={1600} y={rows[k]! + 24} text={st} size={56} p={sub(pr(`step${k}`), 0, 0.72)} />
              <Pen d={checkPath(bx + 4, rows[k]! - s / 2 + 2, s - 6)} p={sub(pr(`step${k}`), 0.72, 1)} c={NB.red} w={6} />
            </g>
          ))}
        </g>
      );
    },
  },
};

export const notebookParts = (shot: NotebookShotId, p: Str) => SHOTS[shot].parts(p);
export const notebookSlots = (shot: NotebookShotId, p: Str, words: TimedWord[], still: Window[], dur: number) => schedule(SHOTS[shot].parts(p), words, still, dur);

export const ReaderNotebook: React.FC<ReaderNotebookProps> = (props) => {
  useBrandFonts();
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const t = frame / fps, dur = durationInFrames / fps;
  const p = props as unknown as Str;
  const shot: NotebookShotId = (props.shot && props.shot in NOTEBOOK_SHOTS ? props.shot : "checklist-heart") as NotebookShotId;
  const def = SHOTS[shot];
  const narration = props.narration ?? "";
  const words = React.useMemo(() => sceneWords(narration, props.narrationTimings, fps, durationInFrames), [narration, props.narrationTimings, fps, durationInFrames]);
  const still = React.useMemo(() => stillWindows(narration, words, false), [narration, words]);
  const slots = React.useMemo(() => schedule(def.parts(p), words, still, dur), [shot, words, still, dur, JSON.stringify(p)]); // eslint-disable-line react-hooks/exhaustive-deps
  const te = effectiveTime(t, still);
  const slot = (key: string) => slots.find((x) => x.key === key);
  const pr = (key: string) => { const s = slot(key); return s ? ease(clamp01((te - s.a) / s.d)) : 0; };
  // الكاميرا فوق الدفتر: تقترب ببطء وتميل قليلًا نحو ما يُكتب الآن، ولا تتقدم داخل نافذة السكون
  const endE = effectiveTime(dur, still);
  const zoom = 1.0 + 0.035 * clamp01(te / Math.max(1, endE));
  let fx = 960, fy = 470;
  for (const s of slots) {
    const f = def.focus[s.key] ?? [960, 470];
    const m = ease(clamp01((te - s.a + 0.3) / 1.4));
    fx += (f[0] - fx) * m; fy += (f[1] - fy) * m;
  }
  const cx = 960 + (fx - 960) * 0.05, cy = 540 + (fy - 470) * 0.03;
  const portrait = props.orientation === "portrait";
  const line = props.captions === false || !words.length ? null : captionLine(narration, words, t);
  return (
    <SceneShell {...props} captions={false} eyebrow={undefined} motif={false} watermark={false} background={NB.paper} durationInFrames={durationInFrames} exitFrames={0} frameless>
      <AbsoluteFill>
        <svg width={width} height={height} viewBox={portrait ? "420 -420 1080 1920" : `0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
          <g transform={`translate(960 540) scale(${zoom}) translate(${-cx} ${-cy})`}>
            <PaperBg kind={NOTEBOOK_SHOTS[shot].paper} />
            {def.draw({ p, pr, te, slot })}
          </g>
        </svg>
      </AbsoluteFill>
      {line && (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          {/* الترجمة سطر هادئ (جملة جملة) بحبر داكن وهالة ورقية، بلا مستطيل خلفها */}
          <div style={{ position: "absolute", bottom: portrait ? 460 : 50, left: 60, right: 60, display: "flex", justifyContent: "center" }}>
            <div style={{ opacity: line.fade, color: NB.ink, textShadow: CAPTION_TONES.ink.textShadow, padding: "6px 24px", fontFamily: BODY, fontWeight: 500, fontSize: 46, lineHeight: "64px", direction: "rtl", textAlign: "center" }}>{line.text}</div>
          </div>
        </AbsoluteFill>
      )}
    </SceneShell>
  );
};

/** نموذج المعاينة (محتوى «زبدة الكتب» 001، لا يُنشر): المصطلح في دائرة حمراء */
export const readerNotebookSample: Omit<ReaderNotebookProps, "themeId" | "orientation"> = {
  shot: "term-circle",
  label: "مفاتيح الصلاة",
  keyWord: "يستوقفنا",
  labelWord: "مفاتيح",
  term: "العجلة",
  termWord: "العجلة",
  circleWord: "نسابق",
  narration: "أول ما يستوقفنا في «مفاتيح الصلاة» هو العجلة. فقد ندخل الصلاة وكأننا نسابق الوقت لننتهي منها.",
};
export const readerNotebookSampleEn = readerNotebookSample;
export const readerNotebookSeconds = 9;
