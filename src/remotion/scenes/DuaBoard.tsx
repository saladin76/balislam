import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamilies } from "../../../brand/fonts";
import { useBrandFonts } from "../useBrandFonts";
import { ID, darken, mix } from "../illus/palette";
import { TopCaption, bareWord } from "../illus/TopCaption";
import { estimateTimings, type WordTiming } from "./timing";
import { exit } from "./motion";
import type { SceneBase, StringFields } from "./types";

/**
 * «لوح الدعاء» (بالإسلام): ورقة هادئة واحدة تمتد عبر مشاهد متتالية.
 * - الدعاء يُعرض كاملًا مقروءًا (باهتًا من أول المشهد)، وتكتمل كل عبارة منه بالحبر لحظة نطقها؛ لا رموز ولا مؤثرات بجواره.
 * - ثم يرتفع الدعاء إلى أعلى الورقة، وتُرسم شبكة المطالب الأربعة: أرِنا / ارزقنا × الحق / الباطل،
 *   ويُكتب كل مطلب وكل كلمة شرح لحظة نطق كلمتها فقط.
 * حالة اللوح صريحة في كل مشهد: shown = ما كان على اللوح قبل المشهد، وcues = ما يظهر فيه («العنصر | الكلمة»).
 * العناصر:
 *   source, dua, dock, grid, ask1..ask4, focus:N (0 = بلا تركيز), head1, head2,
 *   noteN:نص / warnN:نص / pillN:نص (كلمات شرح تحت المطلب N)، haze1..4 (التباس عابر)،
 *   reach12 (سهم يمتد ولا يصل) و stall12 (يتعثر)، link12 / link34 (سهم كامل)،
 *   glow1 / glow2 / glowall (إضاءة عمود)، grow3 (تكبر الكلمات المغرية)، clear (تمحى كلمات الشرح بهدوء).
 * الكلمة المكررة تُحدَّد بترتيبها: «وارزقنا#2».
 */
export type DuaBoardProps = SceneBase & StringFields<"dua" | "asks" | "heads" | "source" | "shown" | "cues"> & { continues?: boolean; fromBoard?: boolean };

type Cue = { item: string; at: number; word?: string };

/** لحظة نطق الكلمة (مع حروف العطف والجر الملتصقة)، أو نسبة من المشهد إن لم تُنطق */
const findWord = (timings: WordTiming[], spec: string): WordTiming | undefined => {
  const [w, nth] = spec.split("#");
  const k = bareWord(w ?? "");
  let seen = 0;
  for (const t of timings) {
    const b = bareWord(t.word);
    if (b === k || ["و", "ف", "ب", "ل"].some((p) => b === p + k)) {
      seen++;
      if (seen === Number(nth || 1)) return t;
    }
  }
  return undefined;
};

export const parseBoardCues = (text: string | undefined, timings: WordTiming[], dur: number): Cue[] =>
  (text ?? "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [item, word] = l.split("|").map((s) => s.trim());
      const hit = word ? findWord(timings, word) : undefined;
      return { item: item ?? "", word, at: hit ? hit.start : word ? Math.round(dur * 0.5) : 0 };
    })
    .filter((c) => c.item);

const ease = Easing.inOut(Easing.cubic);
const p01 = (frame: number, a: number, len: number) => interpolate(frame, [a, a + len], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

/** أبعاد اللوح (بإحداثياته الداخلية) */
const BW = 1500;
const BH = 880;
const COL = { see: { x: 830, w: 560 }, act: { x: 110, w: 560 } };
const ROW = [
  { y: 288, h: 280 },
  { y: 584, h: 280 },
];
/** المطلب N: 1 أرِنا الحق، 2 ارزقنا اتباعه، 3 أرِنا الباطل، 4 ارزقنا اجتنابه */
const cell = (n: number) => {
  const c = n % 2 === 1 ? COL.see : COL.act;
  const r = ROW[n <= 2 ? 0 : 1]!;
  return { x: c.x, y: r.y, w: c.w, h: r.h };
};
const AR_DIGITS = ["١", "٢", "٣", "٤"];

const INK = darken(ID.night, 0.05);
const INK_SOFT = mix(ID.night, ID.paper, 0.45);
const COPPER_INK = darken(ID.copper, 0.35);

/** إظهار الحبر من دون clip-path: القصّ المتحرك يقطع الحروف العربية وعلامات التشكيل وسط الكلمة. */
export const arabicInkRevealStyle = (progress: number): React.CSSProperties => {
  const p = Math.max(0, Math.min(1, progress));
  return {
    display: "inline-block",
    opacity: p,
    transform: `translateY(${(1 - p) * 6}px)`,
  };
};
const Ink: React.FC<{ p: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ p, style, children }) => (
  <span style={{ ...arabicInkRevealStyle(p), ...style }}>{children}</span>
);

export const DuaBoard: React.FC<DuaBoardProps> = (props) => {
  useBrandFonts();
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur, width } = useVideoConfig();
  const portrait = props.orientation === "portrait";
  const narration = props.narration ?? "";
  const timings = narration ? (props.narrationTimings ?? estimateTimings(narration, 6, dur - 12)) : [];
  const cues = parseBoardCues(props.cues, timings, dur);
  const shown = new Set((props.shown ?? "").split(/[,،\n]+/).map((s) => s.trim()).filter(Boolean));
  const shownOrder = (props.shown ?? "").split(/[,،\n]+/).map((s) => s.trim()).filter(Boolean);
  /** لحظة ظهور عنصر: قبل المشهد (-1e4) إن كان على اللوح، أو لحظة كلمته، أو لا يظهر */
  const when = (item: string): number | undefined => (shown.has(item) ? -1e4 : cues.find((c) => c.item === item)?.at);
  const p = (item: string, len = 18) => {
    const t = when(item);
    return t === undefined ? 0 : p01(frame, t, len);
  };
  const out = props.continues ? 1 : exit(frame, dur, 10);
  const anyBefore = shownOrder.length > 0;
  const paperIn = anyBefore ? 1 : p01(frame, 0, 20);
  // العودة إلى اللوح بعد مشهد مرسوم: يظهر بهدوء
  const fadeIn = !anyBefore || props.fromBoard ? 1 : p01(frame, 0, 10);

  // آخر تركيز حتى الآن
  const focusEvents: { n: number; at: number }[] = [
    ...shownOrder.filter((s) => s.startsWith("focus:")).map((s) => ({ n: Number(s.slice(6)), at: -1e4 })),
    ...cues.filter((c) => c.item.startsWith("focus:")).map((c) => ({ n: Number(c.item.slice(6)), at: c.at })),
  ];
  const focusAmount = (n: number) => {
    let v = 0;
    for (const e of focusEvents) {
      const k = p01(frame, e.at, 12);
      v = v + ((String(e.n).includes(String(n)) && e.n !== 0 ? 1 : 0) - v) * k;
    }
    return v;
  };
  const clears = [...(shown.has("clear") ? [-1e4] : []), ...cues.filter((c) => c.item === "clear").map((c) => c.at)];
  /** كلمات الشرح تُمحى بهدوء عند أول «clear» بعد ظهورها */
  const fadeAfter = (t: number) => {
    const c = clears.find((x) => x > t);
    return c === undefined ? 1 : 1 - p01(frame, c, 14);
  };

  // الدعاء: كامل باهت من البداية، وكل عبارة تكتمل لحظة نطقها
  const duaText = props.dua ?? "";
  const lines = duaText.split("/").map((l) => l.split("|").map((s) => s.trim()).filter(Boolean));
  let cursor = 0;
  const phraseAt = (phrase: string) => {
    const first = bareWord(phrase.split(/\s+/)[0] ?? "");
    for (let i = cursor; i < timings.length; i++) {
      if (bareWord(timings[i]!.word) === first) {
        cursor = i + 1;
        return timings[i]!.start;
      }
    }
    return undefined;
  };
  const duaHere = when("dua");
  const phraseTimes = lines.map((l) => l.map((ph) => (duaHere === -1e4 ? -1e4 : phraseAt(ph))));
  const dock = p("dock", 26);
  // المصدر كبير في وسط الورقة قبل الدعاء، ثم يصعد إلى أعلاها حين يُعرض الدعاء
  const srcUp = shown.has("dua") ? 1 : cues.some((c) => c.item === "dua") ? p01(frame, 0, 18) : 0;

  const grid = p("grid", 26);
  const gridAt = when("grid");

  const asks = (props.asks ?? "").split("|").map((s) => s.trim());
  const heads = (props.heads ?? "").split("|").map((s) => s.trim());

  // كلمات الشرح بترتيب ظهورها لكل مطلب
  type Note = { id: string; kind: "note" | "warn" | "pill"; n: number; text: string; at: number };
  const noteOf = (id: string, at: number): Note | undefined => {
    const m = /^(note|warn|pill)([1-4]):(.+)$/.exec(id);
    return m ? { id, kind: m[1] as Note["kind"], n: Number(m[2]), text: m[3]!.trim(), at } : undefined;
  };
  const notes: Note[] = [
    ...shownOrder.map((s) => noteOf(s, -1e4)),
    ...cues.map((c) => noteOf(c.item, c.at)),
  ].filter((n): n is Note => Boolean(n));

  const glow = (col: "see" | "act") => {
    let v = 0;
    for (const c of cues) {
      const hit = c.item === "glowall" || (col === "see" ? c.item === "glow1" : c.item === "glow2");
      if (!hit) continue;
      const k = frame - c.at;
      if (k < 0) continue;
      v = Math.max(v, k < 10 ? k / 10 : Math.max(0.3, 1 - (k - 10) / 45));
    }
    return v;
  };
  const grow3 = p("grow3", 20);

  // كاميرا اللوح: تتقدم إلى المطلب الذي يُشرح الآن، وتعود إلى اللوح كاملًا عند الربط بينها (لا حركة دائمة)
  type Cam = { x: number; y: number; z: number; ay: number };
  const camFor = (id: string): Cam => {
    if (/^c[1-4]$/.test(id)) {
      const c = cell(Number(id[1]));
      // الخانة مع رقمها كاملة في الإطار، وفوق منطقة أسفل الشاشة
      return { x: c.x + c.w / 2, y: c.y + (c.h - 30) / 2, z: 2.05, ay: 480 };
    }
    if (id === "r1" || id === "r2") {
      const r = ROW[id === "r1" ? 0 : 1]!;
      return { x: BW / 2, y: r.y + r.h / 2, z: 1.3, ay: 480 };
    }
    return { x: BW / 2, y: BH / 2, z: 1, ay: 600 };
  };
  const camEvents = [
    ...shownOrder.filter((x) => x.startsWith("cam:")).map((x) => ({ id: x.slice(4), at: -1e4 })),
    ...cues.filter((c) => c.item.startsWith("cam:")).map((c) => ({ id: c.item.slice(4), at: c.at })),
  ];
  let cam = camFor("all");
  for (const e of camEvents) {
    const k = p01(frame, e.at, 24);
    const t = camFor(e.id);
    cam = { x: cam.x + (t.x - cam.x) * k, y: cam.y + (t.y - cam.y) * k, z: cam.z + (t.z - cam.z) * k, ay: cam.ay + (t.ay - cam.ay) * k };
  }

  // الحركة الخلفية الهادئة: نور الفجر يتنفس خلف الورقة
  const breathe = 0.5 + 0.5 * Math.sin((frame / fps) * ((2 * Math.PI) / 6));

  // نافذة اللوح تحت الكابشن؛ مركزها نقطة ارتكاز الكاميرا
  const base = portrait ? 1000 / BW : 1;
  const win = portrait ? { x: 20, y: 300, w: width - 40, h: 1300 } : { x: 40, y: 140, w: width - 80, h: 925 };
  const z = base * cam.z;
  const tx = win.w / 2 - cam.x * z;
  const ty = (portrait ? win.h / 2 : cam.ay - win.y) - cam.y * z;
  const top = win.y;

  // الحالة الكبيرة للدعاء ثم استقراره في أعلى الورقة
  const bigY = 270;
  const dockY = 20;
  const duaY = bigY + (dockY - bigY) * dock;
  const duaScale = 1 - 0.6 * dock;

  const arrow = (from: number, to: number, prog: number, dim: number, falter: number, alpha = 1) => {
    const a = cell(from);
    const b = cell(to);
    const y = a.y + a.h / 2 + 6;
    const x1 = a.x - 18;
    const x2 = b.x + b.w + 18;
    const xe = x1 + (x2 - x1) * prog;
    if (prog <= 0.001) return null;
    const shake = falter * Math.sin(frame / 2.2) * 3 * Math.max(0, 1 - (frame % 60) / 60);
    return (
      <g opacity={(1 - 0.6 * dim) * alpha}>
        <path d={`M${x1} ${y} L${xe} ${y + shake}`} stroke={COPPER_INK} strokeWidth={5} strokeLinecap="round" strokeDasharray={dim > 0.5 ? "10 12" : undefined} />
        {prog > 0.97 ? <path d={`M${x2 + 16} ${y - 13} L${x2} ${y} L${x2 + 16} ${y + 13}`} fill="none" stroke={COPPER_INK} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" /> : null}
      </g>
    );
  };
  const reach = when("reach12");
  const stall = when("stall12");
  const reachProg = reach === undefined ? 0 : reach === -1e4 ? 0.55 : 0.55 * p01(stall === undefined ? frame : Math.min(frame, stall), reach, 30);
  const reachFade = reach === undefined ? 0 : fadeAfter(reach);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 0%, ${mix(ID.night, ID.copper, 0.12)} 0%, ${darken(ID.night, 0.25)} 70%)`, direction: "rtl" }}>
      <AbsoluteFill style={{ opacity: out }}>
        {/* نور الفجر يتنفس فوق الورقة */}
        <div style={{ position: "absolute", left: "50%", top: top - 220, width: 1800, height: 520, transform: "translateX(-50%)", background: `radial-gradient(50% 50% at 50% 50%, ${ID.dawn} 0%, transparent 70%)`, opacity: 0.16 + 0.12 * breathe }} />
        {/* الورقة تملأ النافذة دائمًا: لا فراغ داكن عند تقدم الكاميرا */}
        <div style={{ position: "absolute", left: win.x, top: win.y + (1 - paperIn) * 40, width: win.w, height: win.h, overflow: "hidden", borderRadius: 18, opacity: paperIn * fadeIn, background: `linear-gradient(180deg, ${ID.paper} 0%, ${mix(ID.paper, ID.copper, 0.08)} 100%)`, boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: BW,
            height: BH,
            transform: `translate(${tx}px, ${ty}px) scale(${z})`,
            transformOrigin: "top left",
          }}
        >
          {/* مصدر الدعاء: من كلام أهل العلم، بلا نسبة إلى النبي ﷺ */}
          {props.source ? (
            <div style={{ position: "absolute", top: 26 - 8 * dock + (1 - srcUp) * 370, left: 0, right: 0, textAlign: "center", fontFamily: fontFamilies.body, fontSize: 30 - 6 * dock + (1 - srcUp) * 34, color: COPPER_INK, opacity: 1 - 0.4 * dock }}>
              <Ink p={p("source", 22)} style={{ background: srcUp < 1 ? mix(ID.copper, ID.paper, 0.5 + 0.5 * srcUp) : undefined, borderRadius: 16, padding: `${14 * (1 - srcUp)}px ${40 * (1 - srcUp)}px` }}>{props.source}</Ink>
            </div>
          ) : null}

          {/* الدعاء */}
          {duaHere !== undefined ? (
            <div style={{ position: "absolute", left: 0, right: 0, top: duaY + (props.source ? 40 : 0), transform: `scale(${duaScale})`, transformOrigin: "top center", textAlign: "center", fontFamily: fontFamilies.scripture, fontSize: 86, lineHeight: 1.8, color: INK }}>
              {lines.map((l, li) => (
                <div key={li}>
                  {l.map((ph, pi) => {
                    const t = phraseTimes[li]?.[pi];
                    const k = t === undefined ? 1 : p01(frame, t, 16);
                    return (
                      <span key={pi} style={{ position: "relative", display: "inline-block", margin: "0 12px" }}>
                        <span style={{ opacity: 0.16 * (1 - k) * (duaHere === -1e4 ? 0 : p01(frame, 12, 12)) }}>{ph}</span>
                        <span style={{ position: "absolute", inset: 0, whiteSpace: "nowrap" }}>
                          <Ink p={k}>{ph}</Ink>
                        </span>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : null}

          {/* شبكة المطالب الأربعة */}
          {gridAt !== undefined ? (
            <>
              <svg width={BW} height={BH} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
                {[1, 2, 3, 4].map((n) => {
                  const c = cell(n);
                  const per = 2 * (c.w + c.h);
                  const f = focusAmount(n);
                  const drop = gridAt === undefined || gridAt === -1e4 ? 0 : 1 - p01(frame, gridAt + (n - 1) * 5, 16);
                  // «أربعة»: كل خانة تومض مرة مع ظهور رقمها، فتُعدّ الأربعة عدًّا
                  // تضيء واحدة بعد الأخرى وتبقى، ثم تهدأ الأربع معًا مرة واحدة (لا وميض متكرر)
                  const countAt = when("count") ?? (gridAt === undefined ? undefined : gridAt + 10);
                  const count = countAt === undefined || countAt === -1e4 ? 0 : p01(frame, countAt + n * 7, 10) * (1 - p01(frame, countAt + 52, 24));
                  return (
                    <g key={n} transform={`translate(0 ${90 * drop})`} opacity={1 - drop}>
                      <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={20} fill={mix(ID.copper, ID.paper, 0.85)} />
                      <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={20} fill={ID.dawn} opacity={0.75 * Math.max(f, count)} />
                      <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={20} fill="none" stroke={mix(ID.copper, ID.night, 0.25 * f)} strokeWidth={3 + 2.5 * f} strokeDasharray={per} strokeDashoffset={per * (1 - Math.min(1, grid * 1.4))} />
                    </g>
                  );
                })}
                {(["see", "act"] as const).map((col) => {
                  const c = COL[col];
                  const g = glow(col);
                  return g > 0 ? <rect key={col} x={c.x - 14} y={ROW[0]!.y - 14} width={c.w + 28} height={ROW[1]!.y + ROW[1]!.h - ROW[0]!.y + 28} rx={26} fill={ID.dawn} opacity={0.55 * g} /> : null;
                })}
                {arrow(1, 2, reachProg, stall === undefined ? 0 : p01(frame, stall, 12), stall === undefined ? 0 : p01(frame, stall, 4) * (1 - p01(frame, stall + 30, 10)), reachFade)}
                {arrow(1, 2, p("link12", 26), 0, 0)}
                {arrow(3, 4, p("link34", 26), 0, 0)}
              </svg>
              {[1, 2, 3, 4].map((n) => {
                const c = cell(n);
                const k = gridAt === -1e4 ? 1 : p01(frame, gridAt + 10 + n * 5, 10);
                return (
                  <div key={n} style={{ position: "absolute", left: c.x + c.w - 30, top: c.y - 22, width: 48, height: 48, borderRadius: 24, background: ID.paper, border: `3px solid ${ID.copper}`, color: COPPER_INK, fontFamily: fontFamilies.body, fontWeight: 700, fontSize: 28, lineHeight: "42px", textAlign: "center", opacity: k, transform: `scale(${0.6 + 0.4 * k})` }}>
                    {AR_DIGITS[n - 1]}
                  </div>
                );
              })}
              {/* عنوانا العمودين */}
              {(["head1", "head2"] as const).map((h, i) => {
                const c = i === 0 ? COL.see : COL.act;
                const k = p(h, 20);
                if (!k) return null;
                return (
                  <div key={h} style={{ position: "absolute", left: c.x, width: c.w, top: ROW[0]!.y - 78, height: 66, borderRadius: 16, background: mix(ID.copper, ID.paper, 0.3), clipPath: `inset(0 0 0 ${(1 - k) * 100}%)`, textAlign: "center", fontFamily: fontFamilies.ruqaa, fontSize: 50, lineHeight: "62px", color: darken(ID.night, 0.1) }}>
                    {heads[i]}
                  </div>
                );
              })}
              {/* نص المطالب وكلمات الشرح */}
              {[1, 2, 3, 4].map((n) => {
                const c = cell(n);
                const k = p(`ask${n}`, 20);
                const haze = when(`haze${n}`);
                const blur = haze === undefined || haze === -1e4 ? 0 : 7 * Math.sin(Math.PI * Math.min(1, Math.max(0, (frame - haze) / 34)));
                const mine = notes.filter((x) => x.n === n);
                return (
                  <React.Fragment key={n}>
                    <div style={{ position: "absolute", left: c.x, width: c.w, top: c.y + 8, textAlign: "center", fontFamily: fontFamilies.scripture, fontWeight: 700, fontSize: 54, lineHeight: 1.45, color: INK, filter: blur > 0.05 ? `blur(${blur}px)` : undefined }}>
                      <Ink p={k} style={{ background: mix(ID.copper, ID.paper, 0.55), borderRadius: 14, padding: "0 26px" }}>{asks[n - 1]}</Ink>
                    </div>
                    <div style={{ position: "absolute", left: c.x + 24, width: c.w - 48, top: c.y + 92, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 10px" }}>
                      {mine.map((x) => {
                        const a = p01(frame, x.at, 12) * fadeAfter(x.at);
                        if (a <= 0.001) return null;
                        const pill = x.kind === "pill";
                        const sc = pill ? 1 + 0.14 * grow3 : 1;
                        return (
                          <span
                            key={x.id}
                            style={{
                              fontFamily: fontFamilies.body,
                              fontWeight: 600,
                              fontSize: 36,
                              lineHeight: 1.35,
                              color: pill ? darken(ID.night, 0.1) : ID.paper,
                              background: x.kind === "warn" ? ID.seal : pill ? ID.dawn : mix(ID.night, ID.copper, 0.12),
                              border: `2px solid ${x.kind === "warn" ? darken(ID.seal, 0.2) : pill ? darken(ID.dawn, 0.15) : ID.night}`,
                              borderRadius: pill ? 999 : 12,
                              padding: "3px 16px",
                              opacity: a,
                              transform: `translateY(${(1 - Math.min(1, a * 1.2)) * 10}px) scale(${sc})`,
                            }}
                          >
                            {x.text}
                          </span>
                        );
                      })}
                    </div>
                  </React.Fragment>
                );
              })}
            </>
          ) : null}
        </div>
        <div style={{ position: "absolute", inset: 0, borderRadius: 18, boxShadow: `inset 0 0 0 3px ${mix(ID.copper, ID.paper, 0.35)}`, pointerEvents: "none" }} />
        </div>
        {cues.some((c) => c.item === "dua") ? null : (
          <TopCaption frame={frame} fps={fps} timings={timings} keys={cues.map((c) => c.word ?? "").filter((w) => w && !w.includes("#"))} portrait={portrait} out={out} />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const duaBoardSample: Omit<DuaBoardProps, "themeId" | "orientation"> = {
  narration: "أولها أن نرى الحق حقًّا.",
  dua: "اللهم أرنا الحق حقًّا | وارزقنا اتباعه، / وأرنا الباطل باطلًا | وارزقنا اجتنابه",
  asks: "أن نرى الحق حقًّا | أن نتّبعه | أن نرى الباطل باطلًا | أن نجتنبه",
  heads: "البصيرة | العزيمة",
  source: "من الأدعية المأثورة في كلام أهل العلم",
  shown: "source, dua, dock, grid",
  cues: "focus:1 | أولها\nask1 | نرى",
};
export const duaBoardSeconds = 4;
export const duaBoardSampleEn = duaBoardSample;
