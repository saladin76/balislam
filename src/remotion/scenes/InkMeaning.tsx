import React from "react";
import { Easing, interpolate, useVideoConfig } from "remotion";
import { useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { SceneShell } from "./SceneShell";
import { useLang } from "../../i18n/context";
import { clamp, useSceneFrame } from "./motion";
import { Drawn, Pen } from "./SketchBoard";
import { estimateTimings, type WordTiming } from "./timing";
import { BoardPaper, cameraAt, fillCameraGaps, findWord, Highlighter, safeCam, camTransform, spokenWords, type Cam, type CamKey, type SpokenWord } from "./boardLayer";
import type { SceneBase, StringFields } from "./types";

/**
 * «حبر ومعنى» (الاتجاه B لزبدة الكتب): الكلمات نفسها هي الرسم.
 * كل كلمة أو عبارة تُكتب بالحبر لحظة نطقها، والخطوط والأسهم تصل الأفكار، والفسفوري للفكرة المحورية وحدها.
 * لا رسمة ولا رمز لا يُنطق؛ وفي layout=sacred (ذكر الله) يثبت النص تمامًا أثناء الذكر ولا شيء بجواره.
 *
 * items: سطر لكل عنصر «النص | الدور | كلمة البدء (اختيارية)».
 * الأدوار: key (كلمة محورية كبيرة)، word (كلمة بخط اليد)، line (سطر)، mark (تظليل عنصر موجود بنصه)،
 * cross (شطب عنصر موجود بنصه)، link (وصل بين العنصرين المحوريين)،
 * quote (علامتا تنصيص كبيرتان حول الكلمة المحورية حين يُذكر أنها «عبارة» من الكتاب)،
 * book (بطاقة الكتاب الصغيرة تدخل حين يُذكر «الكتاب» مصدرًا للعبارة)،
 * focus (عند كلمته تخفت كلمات الصف العلوي السابقة وتقترب الكاميرا من الخلاصة).
 * التخطيطات: center، compare، flow، book، sacred، note.
 * enter=page: الورقة تدخل كصفحة تُقلب (الاتجاه A للانتقالات الرئيسة).
 */
export type InkMeaningProps = SceneBase & StringFields<"items" | "layout" | "enter" | "author">;

type Role = "key" | "word" | "line" | "mark" | "cross" | "link" | "quote" | "book" | "focus";
type Item = { text: string; role: Role; cue: string; beside?: boolean };

const parseItems = (s: string): Item[] =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [text = "", role = "word", cue = "", place = ""] = l.split("|").map((x) => x.trim());
      return { text, role: (["key", "word", "line", "mark", "cross", "link", "quote", "book", "focus"].includes(role) ? role : "word") as Role, cue: cue || text, beside: place === "beside" };
    });

const PAPER_NOTE = "#DCD6C8";

/** عرض النص الحقيقي بخطه (من المتصفح نفسه)، فيُرسم الإطار والخط تحت الكلمة على قدّها */
let measureCtx: CanvasRenderingContext2D | null | undefined;
const textWidth = (text: string, size: number, family: string, weight = 400): number | null => {
  if (measureCtx === undefined) measureCtx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (!measureCtx) return null;
  const resolved = family.replace(/var\((--[\w-]+)\s*,\s*([^)]+)\)/, (_m, v: string, fb: string) => {
    const real = typeof document !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue(v).trim() : "";
    return real || fb;
  });
  measureCtx.font = `${weight} ${size}px ${resolved}`;
  return measureCtx.measureText(text).width;
};

export const InkMeaning: React.FC<InkMeaningProps> = (props) => {
  const { orientation, narration = "", narrationTimings, layout = "center", enter = "", author = "" } = props;
  const frame = useSceneFrame();
  const { width: W, height: H, durationInFrames } = useVideoConfig();
  const lang = useLang();
  const rtl = lang.dir === "rtl";
  const portrait = orientation === "portrait";
  const t = useTheme("paper");
  const ink = t.colors.ink;
  const soft = t.colors.inkSoft;
  const hl = t.colors.highlight;
  const alert = t.colors.secondary;
  const bg = t.colors.bg;

  const items = parseItems(props.items ?? "");
  const timings: WordTiming[] = narration ? (narrationTimings ?? estimateTimings(narration, 6, durationInFrames - 12)) : [];
  const words: SpokenWord[] = spokenWords(timings);

  // لحظة كل عنصر: أول نطق لكلمة البدء بعد العنصر السابق (فلا يسبق عنصرٌ ما قبله)
  let cursor = 0;
  let lastAt = enter === "page" ? 16 : 6;
  const at = items.map((it) => {
    const w = findWord(words, it.cue, cursor) ?? findWord(words, it.cue);
    if (w) cursor = w.i + 1;
    const a = w ? Math.max(lastAt + 6, w.start - 3) : lastAt + 30;
    lastAt = a;
    return a;
  });

  const shown = (i: number) => frame >= at[i]!;
  // الكتابة على قدر الكلام: العنصر يُكتب حتى قبيل العنصر التالي (لا قفز من كلمة إلى كلمة)
  const minLen = (it: Item) => (it.role === "key" ? Math.max(16, Array.from(it.text).length * 2.4) : it.role === "line" ? Math.max(22, Array.from(it.text).length * 1.1) : Math.max(12, Array.from(it.text).length * 2));
  const writeLen = (i: number) => {
    const next = at.slice(i + 1).find((a) => a > at[i]!) ?? durationInFrames - 30;
    return Math.round(Math.min(72, Math.max(minLen(items[i]!), next - at[i]! - 8)));
  };
  const prog = (i: number) => interpolate(frame, [at[i]!, at[i]! + writeLen(i)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });

  // ── الأماكن حسب التخطيط ───────────────────────────────────────────────
  const keys = items.map((it, i) => ({ it, i })).filter((x) => x.it.role === "key");
  const smalls = items.map((it, i) => ({ it, i })).filter((x) => x.it.role === "word" && !x.it.beside);
  const lines = items.map((it, i) => ({ it, i })).filter((x) => x.it.role === "line");
  const keySize = (n: number) => (portrait ? 170 : layout === "center" || layout === "sacred" ? 210 : n > 2 ? 136 : 160);
  const wordSize = portrait ? 92 : 104;
  const lineSize = portrait ? 68 : 78;

  type Pos = { x: number; y: number; size: number; font: "key" | "hand" | "line" };
  const pos = new Map<number, Pos>();
  const dir = rtl ? -1 : 1; // اتجاه القراءة على المحور x
  const famOf = (q: { font: Pos["font"] }) => (q.font === "key" ? fontFamilies.heading : q.font === "hand" ? fontFamilies.hand : fontFamilies.body);
  const widthOf = (it: Item, q: { size: number; font: Pos["font"] }) => Math.min(W * 0.86, (textWidth(it.text, q.size, famOf(q), q.font === "line" ? 500 : 400) ?? Array.from(it.text).length * q.size * (q.font === "key" ? 0.4 : 0.36)) * 1.08 + (it.role === "key" ? 70 : 40));

  // صفّ عناصر بعرضها الحقيقي في اتجاه القراءة، متوسطًا، ويلتف إلى صف تالٍ إن ضاق (لا تلاصق ولا تداخل)
  const packRows = (list: { it: Item; i: number }[], size: number, font: Pos["font"], ys: number[], gap: number, maxW = W * 0.8) => {
    const rows: { i: number; w: number }[][] = [[]];
    list.forEach((x) => {
      const w = widthOf(x.it, { size, font });
      const row = rows[rows.length - 1]!;
      const used = row.reduce((a, r) => a + r.w + gap, 0);
      if (row.length && used + w > maxW && rows.length < ys.length) rows.push([{ i: x.i, w }]);
      else row.push({ i: x.i, w });
    });
    rows.forEach((row, r) => {
      const total = row.reduce((a, x) => a + x.w, 0) + gap * Math.max(0, row.length - 1);
      let cur = W / 2 - dir * (total / 2);
      row.forEach((x) => {
        pos.set(x.i, { x: cur + dir * (x.w / 2), y: ys[r] ?? ys[ys.length - 1]!, size, font });
        cur += dir * (x.w + gap);
      });
    });
    return rows.length;
  };

  let lineY = layout === "note" ? H * 0.45 : layout === "center" || layout === "sacred" ? H * 0.685 : H * 0.68;
  if (layout === "compare") {
    keys.slice(0, 2).forEach((k, j) => pos.set(k.i, { x: W / 2 + dir * (j === 0 ? -1 : 1) * W * 0.2, y: H * 0.4, size: keySize(2), font: "key" }));
    smalls.forEach((s, j) => pos.set(s.i, { x: W / 2 + dir * (j % 2 === 0 ? -1 : 1) * W * 0.2, y: H * 0.36 + 120 + Math.floor(j / 2) * 78, size: wordSize, font: "hand" }));
  } else if (layout === "flow") {
    // عقد التدفق بعرضها الحقيقي ومسافة تتسع للسهم بينها
    let ks = keySize(keys.length);
    const kw = () => keys.reduce((a, k) => a + widthOf(k.it, { size: ks, font: "key" }), 0) + 130 * Math.max(0, keys.length - 1);
    while (kw() > W * 0.82 && ks > 96) ks -= 8;
    packRows(keys, ks, "key", [H * 0.5], 130, W * 2);
    packRows(smalls, wordSize, "hand", [H * 0.16, H * 0.29], 90);
  } else if (layout === "book") {
    keys.forEach((k, j) => pos.set(k.i, { x: rtl ? W * 0.6 : W * 0.4, y: H * 0.28 + j * 160, size: 118, font: "key" }));
    smalls.forEach((s, j) => pos.set(s.i, { x: rtl ? W * 0.6 : W * 0.4, y: H * 0.72 + j * 90, size: wordSize, font: "hand" }));
  } else if (layout === "note") {
    keys.forEach((k) => pos.set(k.i, { x: W / 2, y: H * 0.3, size: 116, font: "key" }));
    smalls.forEach((s, j) => pos.set(s.i, { x: W / 2, y: H * 0.47 + j * 96, size: 82, font: "hand" }));
  } else {
    // center / sacred: كلمة محورية في الوسط، وكلماتها في صف فوقها ثم صف تحتها
    keys.forEach((k, j) => pos.set(k.i, { x: W / 2, y: H * 0.45 + j * 240, size: keySize(1), font: "key" }));
    // صفّان فوق المحور في اتجاه القراءة؛ المشهد مضموم ليبقى للكاميرا مجال تقترب فيه دون قطع
    packRows(smalls, wordSize, "hand", [H * 0.09, H * 0.225], 80, W * 0.7);
  }
  lines.forEach((l, j) => pos.set(l.i, { x: W / 2, y: lineY + j * (lineSize * 1.45), size: lineSize, font: "line" }));
  // beside: العنصر يقابل الذي قبله في صف واحد (مقابلة: «لا هذا… بل ذاك»)، والصف في موضع السطر إن كان أحدهما سطرًا
  items.forEach((it, i) => {
    if (!it.beside || (it.role !== "word" && it.role !== "line")) return;
    if (it.role === "word") pos.set(i, { x: W / 2, y: 0, size: wordSize, font: "hand" });
    let j = i - 1;
    while (j >= 0 && !(pos.has(j) && (items[j]!.role === "word" || items[j]!.role === "line"))) j--;
    if (j < 0) return;
    const a = pos.get(j)!, b = pos.get(i)!;
    const wa = widthOf(items[j]!, a), wb = widthOf(it, b);
    const y = it.role === "line" ? b.y : a.y;
    const gap = 120;
    const total = wa + gap + wb;
    const start = W / 2 - dir * (total / 2);
    pos.set(j, { ...a, x: start + dir * (wa / 2), y });
    pos.set(i, { ...b, x: start + dir * (wa + gap + wb / 2), y });
  });

  const markFor = (text: string) => items.findIndex((x, j) => x.role === "mark" && x.text === text && j >= 0);
  const crossFor = (text: string) => items.findIndex((x) => x.role === "cross" && x.text === text);

  // ── التركيز على الخلاصة: كلمات الصف العلوي السابقة تتلاشى تدريجيًا (لا فجأة) قبل أن تقترب الكاميرا ──
  const focusIdx = items.findIndex((x) => x.role === "focus");
  const focusAtF = focusIdx >= 0 ? at[focusIdx]! : Infinity;
  const faded = new Set(items.map((it, i) => (it.role === "word" && !it.beside && at[i]! < focusAtF ? i : -1)).filter((i) => i >= 0));
  const fadeT = focusIdx >= 0 ? interpolate(frame, [focusAtF - 4, focusAtF + 24], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) }) : 0;
  // بطاقة الكتاب الصغيرة: في جهة بداية القراءة بجوار المحور
  const bookIdx = items.findIndex((x) => x.role === "book");
  const miniBook = { x: rtl ? W * 0.83 : W * 0.17, y: H * 0.45, w: W * 0.085, h: W * 0.12 };
  const miniIn = bookIdx >= 0 ? interpolate(frame, [at[bookIdx]!, at[bookIdx]! + 18], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 0;

  // ── رسم العناصر ───────────────────────────────────────────────────────
  let pen: { x: number; y: number } | null = null;
  let penY = 0;
  let penEnv = 0; // قوة متابعة الكاميرا للقلم: تبدأ وتنتهي بصفر، فلا قفز بين عنصر وآخر
  const sacred = layout === "sacred";
  const sacredIdx = sacred ? (keys[0]?.i ?? -1) : -1;
  const sacredAt = sacredIdx >= 0 ? at[sacredIdx]! : Infinity;

  const widths = new Map<number, number>();
  items.forEach((it, i) => {
    const q = pos.get(i);
    if (q) widths.set(i, widthOf(it, q));
  });
  const node = (it: Item, i: number) => {
    const p = pos.get(i);
    if (!p || !shown(i)) return null;
    const pr = prog(i);
    const isSacred = i === sacredIdx;
    // الذكر يدخل دفعة واحدة بهدوء، ولا قلم ولا تظليل عليه
    const reveal = isSacred ? interpolate(frame, [at[i]! - 10, at[i]!], [0, 1], clamp) : Math.min(1, pr * 1.6);
    // بعد الكتابة يرسم القلم هندسة العنصر: إطار أو خط تحت الكلمة، في بقية زمن عبارتها
    const geoT = interpolate(pr, [0.62, 1], [0, 1], clamp);
    const fontFamily = p.font === "key" ? fontFamilies.heading : p.font === "hand" ? fontFamilies.hand : fontFamilies.body;
    const width = widths.get(i) ?? widthOf(it, p);
    const mi = markFor(it.text);
    const markT = mi >= 0 ? interpolate(frame, [at[mi]!, at[mi]! + 12], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) }) : 0;
    const ci = crossFor(it.text);
    const crossT = ci >= 0 ? interpolate(frame, [at[ci]!, at[ci]! + 14], [0, 1], clamp) : 0;
    // كلمات الشواغل في مشهد الذكر تتراجع قبل دخوله: تصغر وتخفت ولا تختفي فجأة
    const recede = sacred && !isSacred && at[i]! < sacredAt ? interpolate(frame, [sacredAt - 40, sacredAt - 8], [1, 0], clamp) : 1;
    const dim = faded.has(i) ? 1 - fadeT : 1;
    if (!isSacred && pr > 0 && pr < 1) {
      const wr = Math.min(1, pr * 1.6);
      penEnv = Math.sin(Math.PI * pr);
      penY = p.y;
      pen = wr < 1 ? { x: p.x + (rtl ? 1 : -1) * width * (0.5 - wr), y: p.y + p.size * 0.15 } : { x: p.x + (rtl ? -1 : 1) * width * (0.5 - geoT), y: p.y + p.size * (it.role === "key" && (layout === "flow" || layout === "compare") ? 0.7 : 0.75) };
    }
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: p.x - width / 2,
          top: p.y - p.size * 0.7,
          width,
          textAlign: "center",
          opacity: (isSacred ? reveal : 0.35 + 0.65 * recede) * dim,
          transform: `scale(${0.82 + 0.18 * recede})`,
          clipPath: isSacred ? undefined : rtl ? `inset(-30% 0 -30% ${(1 - reveal) * 100}%)` : `inset(-30% ${(1 - reveal) * 100}% -30% 0)`,
        }}
      >
        {!isSacred && mi >= 0 ? <Highlighter width={width * 0.9} height={p.size * 0.62} t={markT} color={hl} rtl={rtl} style={{ left: width * 0.05, top: p.size * 0.66 }} /> : null}
        <span style={{ position: "relative", fontFamily, fontWeight: p.font === "line" ? 500 : 400, fontSize: p.size, lineHeight: 1.35, color: p.font === "hand" ? soft : ink, whiteSpace: "nowrap", direction: lang.dir }}>{it.text}</span>
        {!isSacred && it.role !== "line" ? (
          <svg width={width} height={p.size * 1.6} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            {it.role === "key" && (layout === "flow" || layout === "compare") ? (
              <Drawn d={rtl ? `M${width - 6} ${p.size * 0.18} H${6} V${p.size * 1.42} H${width - 6} Z` : `M6 ${p.size * 0.18} H${width - 6} V${p.size * 1.42} H6 Z`} t={geoT} color={ink} width={6} />
            ) : it.role === "key" ? (
              <>
                <Drawn d={rtl ? `M${width * 0.92} ${p.size * 1.42} Q${width / 2} ${p.size * 1.5} ${width * 0.08} ${p.size * 1.4}` : `M${width * 0.08} ${p.size * 1.4} Q${width / 2} ${p.size * 1.5} ${width * 0.92} ${p.size * 1.42}`} t={Math.min(1, geoT * 2)} color={ink} width={layout === "center" ? 12 : 8} />
                <Drawn d={rtl ? `M${width * 0.8} ${p.size * 1.56} H${width * 0.2}` : `M${width * 0.2} ${p.size * 1.56} H${width * 0.8}`} t={Math.max(0, geoT * 2 - 1)} color={ink} width={layout === "center" ? 6 : 4} />
              </>
            ) : (
              <Drawn d={rtl ? `M${width * 0.85} ${p.size * 1.32} H${width * 0.15}` : `M${width * 0.15} ${p.size * 1.32} H${width * 0.85}`} t={geoT} color={soft} width={3} opacity={0.7} />
            )}
          </svg>
        ) : null}
        {crossT > 0 ? (
          <svg width={width} height={p.size * 1.4} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <Drawn d={rtl ? `M${width * 0.95} ${p.size * 0.78} L${width * 0.05} ${p.size * 0.62}` : `M${width * 0.05} ${p.size * 0.62} L${width * 0.95} ${p.size * 0.78}`} t={crossT} color={alert} width={6} />
          </svg>
        ) : null}
      </div>
    );
  };

  // ── عناصر الهوية في التخطيطات ─────────────────────────────────────────
  const bookIn = layout === "book" ? interpolate(frame, [6, 26], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 0;
  const noteIn = layout === "note" ? interpolate(frame, [6, 22], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) }) : 0;
  const authorAt = author ? (findWord(words, author.split(/\s+/)[0] ?? "")?.start ?? 60) - 3 : Infinity;

  // ── الورقة: تدخل كصفحة تُقلب (A)، والكاميرا تقترب برفق من آخر ما كُتب (B) ──
  const pageT = enter === "page" ? interpolate(frame, [0, 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  const overview: Cam = { x: W / 2, y: H / 2, z: 1 };
  const focusOf = (i: number): Cam => {
    const q = pos.get(i) ?? { x: W / 2, y: H / 2 };
    return { x: W / 2 + (q.x - W / 2) * 0.7, y: H / 2 + (q.y - H / 2) * 0.6, z: 1.1 };
  };
  const visible = items.map((_, i) => i).filter((i) => pos.has(i));
  const camKeys: CamKey[] = [{ ...overview, at: 0, dur: 0 }];
  visible.forEach((i) => camKeys.push({ ...focusOf(i), at: at[i]! - 6, dur: 18 }));
  const pullAt = Math.max((at[at.length - 1] ?? 0) + 20, durationInFrames - 44);
  const focusAt = (f: number) => {
    const done = visible.filter((i) => at[i]! <= f);
    return done.length ? focusOf(done[done.length - 1]!) : overview;
  };
  let keysAll = fillCameraGaps(camKeys, at, pullAt, focusAt, overview, 30, 46);
  // ذكر الله: سكون تام من قبيل نطقه حتى تمامه، في كل مرة يُذكر (الله … أكبر)
  const holds: [number, number][] = [];
  if (sacredIdx >= 0) {
    let from = 0;
    for (;;) {
      const a1 = findWord(words, "الله", from);
      if (!a1) break;
      const b1 = findWord(words, "أكبر", a1.i, a1.i + 3);
      if (b1) holds.push([a1.start - 12, b1.end + 12]);
      from = a1.i + 1;
    }
    keysAll = keysAll.filter((k) => !holds.some(([h0, h1]) => k.at + k.dur >= h0 && k.at <= h1));
    holds.forEach(([h0]) => keysAll.push({ ...overview, at: h0 - 18, dur: 16 }));
    keysAll.sort((x, y) => x.at - y.at);
  }
  if (pullAt + 20 < durationInFrames) keysAll.push({ ...overview, at: pullAt, dur: 20 });
  const stillNow = holds.some(([h0, h1]) => frame >= h0 && frame <= h1);
  const nodes = items.map((it, i) => (it.role === "key" || it.role === "word" || it.role === "line" ? node(it, i) : null));
  // الكاميرا تتابع القلم وهو يكتب الكلمة المنطوقة (كاميرا فوق الدفتر)، ولا تتحرك أبدًا وقت الذكر
  const base = stillNow ? overview : cameraAt(keysAll, frame);
  const follow = !stillNow && pen ? penEnv : 0;
  const pp = pen as { x: number; y: number } | null;
  // كل عناصر المشهد تبقى داخل الإطار (صندوق ثابت للمشهد كله، فلا قفز في التكبير)
  type Rect = [number, number, number, number];
  const rects: { at: number; r: Rect; i?: number }[] = [];
  items.forEach((it, i) => {
    const q = pos.get(i);
    if (q) { const w = widths.get(i) ?? 200; rects.push({ at: at[i]!, i, r: [q.x - w / 2, q.y - q.size * 0.75, q.x + w / 2, q.y + q.size * 1.0] }); }
  });
  if (bookIdx >= 0) rects.push({ at: at[bookIdx]!, r: [miniBook.x - miniBook.w / 2 - 30, miniBook.y - miniBook.h / 2 - 30, miniBook.x + miniBook.w / 2 + 40, miniBook.y + miniBook.h / 2 + 40] });
  const qIdx = items.findIndex((x) => x.role === "quote");
  if (qIdx >= 0 && keys[0]) {
    const kq = pos.get(keys[0].i)!;
    const kw = widths.get(keys[0].i) ?? 400;
    rects.push({ at: at[qIdx]!, r: [kq.x - kw / 2 - 60 - kq.size * 0.55, kq.y - kq.size * 0.8, kq.x + kw / 2 + 60 + kq.size * 0.55, kq.y + kq.size] });
  }
  if (layout === "book") { const bx = rtl ? W * 0.12 : W * 0.66; rects.push({ at: 0, r: [bx - 40, H * 0.18 - 50, bx + W * 0.2 + 60, H * 0.18 + W * 0.29 + 50] }); }
  if (layout === "note") rects.push({ at: 0, r: [W * 0.22, H * 0.12, W * 0.78, H * 0.82] });
  rects.sort((x, y) => x.at - y.at);
  // صندوق ما ظهر (وما سيظهر خلال لحظة): يتسع تدريجيًا قبل ظهور العنصر، فلا يُقطع عنصر ولا يقفز التكبير
  const grow = (skip: Set<number>): Rect | null => {
    let b: Rect | null = null;
    for (const { at: a, r, i } of rects) {
      if (i !== undefined && skip.has(i)) continue;
      const t = interpolate(frame, [a - 26, a - 2], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
      if (t <= 0) break;
      if (!b) { const cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2; b = [cx, cy, cx, cy]; }
      const u: Rect = [Math.min(b[0], r[0]), Math.min(b[1], r[1]), Math.max(b[2], r[2]), Math.max(b[3], r[3])];
      b = [b[0] + (u[0] - b[0]) * t, b[1] + (u[1] - b[1]) * t, b[2] + (u[2] - b[2]) * t, b[3] + (u[3] - b[3]) * t];
    }
    return b;
  };
  const full = grow(new Set());
  const focused = fadeT > 0 ? grow(faded) : full;
  const box: Rect | null = full && focused ? [0, 1, 2, 3].map((k) => full[k]! + (focused[k]! - full[k]!) * fadeT) as Rect : full;
  const fit = (c: Cam): Cam => {
    if (!box) return safeCam(c, W, H, 1.16);
    const m = 90;
    const z = Math.max(1, Math.min(c.z, W / (box[2] - box[0] + 2 * m), H / (box[3] - box[1] + 2 * m)));
    const hw = W / (2 * z), hh = H / (2 * z);
    const cx = Math.min(box[0] - m + hw, Math.max(box[2] + m - hw, c.x));
    const cy = Math.min(box[1] - m + hh, Math.max(box[3] + m - hh, c.y));
    return safeCam({ z, x: cx, y: cy }, W, H, 1.16);
  };
  const holdCam = fit(pp && follow > 0 ? { x: base.x + (pp.x - base.x) * 0.45 * follow, y: base.y + (penY - base.y) * 0.3 * follow, z: base.z + 0.06 * follow } : base);
  // ── الوصلات: أسهم بين عقد التدفق، وخط يصل طرفي المقارنة ───────────────
  const connectors: React.ReactNode[] = [];
  const quoteMarks: React.ReactNode[] = [];
  if (layout === "flow") {
    keys.slice(1).forEach((k, j) => {
      const a = pos.get(keys[j]!.i)!;
      const b = pos.get(k.i)!;
      const t0 = at[k.i]! - 14;
      const tt = interpolate(frame, [t0, t0 + 14], [0, 1], clamp);
      const x1 = a.x + dir * ((widths.get(keys[j]!.i) ?? 220) / 2 + 14);
      const x2 = b.x - dir * ((widths.get(k.i) ?? 220) / 2 + 14);
      const y = a.y + a.size * 0.1;
      connectors.push(<Drawn key={`a${j}`} d={`M${x1} ${y} Q${(x1 + x2) / 2} ${y - 26} ${x2} ${y}`} t={tt} color={ink} width={5} />);
      connectors.push(<Drawn key={`h${j}`} d={`M${x2 - dir * 18} ${y - 14} L${x2} ${y} L${x2 - dir * 18} ${y + 12}`} t={interpolate(frame, [t0 + 12, t0 + 16], [0, 1], clamp)} color={ink} width={5} />);
    });
  }
  const qi = items.findIndex((x) => x.role === "quote");
  if (qi >= 0 && keys[0]) {
    const kq = pos.get(keys[0].i)!;
    const kw = widths.get(keys[0].i) ?? 400;
    const qs = kq.size * 0.95;
    [0, 1].forEach((j) => {
      const t0 = at[qi]! + j * 10;
      const tt = interpolate(frame, [t0, t0 + 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
      const right = j === 0 ? rtl : !rtl; // علامة الفتح في جهة بداية القراءة
      const x = kq.x + (right ? 1 : -1) * (kw / 2 + 60);
      quoteMarks.push(
        <div key={`q${j}`} style={{ position: "absolute", left: x - qs / 2, top: kq.y - qs * 0.62, width: qs, textAlign: "center", fontFamily: fontFamilies.heading, fontSize: qs, lineHeight: 1, color: ink, opacity: 0.9 * tt, transform: `scale(${0.7 + 0.3 * tt})` }}>
          {j === 0 ? (rtl ? "«" : "“") : rtl ? "»" : "”"}
        </div>,
      );
    });
  }
  const link = items.findIndex((x) => x.role === "link");
  if (link >= 0 && keys.length >= 2) {
    const a = pos.get(keys[0]!.i)!;
    const b = pos.get(keys[1]!.i)!;
    const tt = interpolate(frame, [at[link]!, at[link]! + 20], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    const y = a.y + 30;
    const x1 = a.x - dir * -1 * 0;
    connectors.push(<Drawn key="link" d={`M${x1 + (b.x > a.x ? 160 : -160)} ${y} H${b.x + (b.x > a.x ? -160 : 160)}`} t={tt} color={ink} width={5} />);
    const lt = interpolate(frame, [at[link]! + 14, at[link]! + 26], [0, 1], clamp);
    connectors.push(
      <text key="linkt" x={(a.x + b.x) / 2} y={y - 22} textAnchor="middle" fontFamily={fontFamilies.hand} fontSize={wordSize} fill={ink} opacity={lt}>
        {items[link]!.text}
      </text>,
    );
  }

  const penShow = pen ? 1 : 0;
  const p = pen as { x: number; y: number } | null;

  return (
    <SceneShell {...props} themeId="paper" motif={false} background={bg} durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", inset: 0, ...camTransform(holdCam, W, H), transform: `${camTransform(holdCam, W, H).transform} translateY(${(1 - pageT) * H * 0.9}px) rotate(${(1 - pageT) * (rtl ? 3 : -3)}deg)` }}>
        {/* الورقة نفسها داخل الكاميرا: إذا تحركت الكاميرا تحركت الصفحة كلها كما في تصوير حقيقي */}
        <div style={{ position: "absolute", inset: 0, background: bg, boxShadow: pageT < 1 ? `0 -18px 40px ${ink}22` : undefined }}>
          <BoardPaper motif={t.motif} ink={ink} margin={t.colors.secondary} dark={false} rtl={rtl} />
        </div>
        {layout === "book" ? (
          <div style={{ position: "absolute", left: rtl ? W * 0.12 : W * 0.66, top: H * 0.18, width: W * 0.2, height: W * 0.29, background: ink, borderRadius: 12, transform: `translateX(${(1 - bookIn) * (rtl ? -1 : 1) * -W * 0.3}px) rotate(-5deg)`, boxShadow: `18px 22px 0 ${ink}22` }}>
            <div style={{ margin: `${W * 0.04}px ${W * 0.022}px 0`, height: W * 0.022, background: hl }} />
            <div style={{ margin: `${W * 0.016}px ${W * 0.022}px 0 ${W * 0.06}px`, height: W * 0.012, background: bg, opacity: 0.45 }} />
          </div>
        ) : null}
        {layout === "note" ? (
          <div style={{ position: "absolute", left: W * 0.24, top: H * 0.14, width: W * 0.52, height: H * 0.66, background: PAPER_NOTE, transform: `rotate(-2deg) scale(${0.6 + 0.4 * noteIn})`, opacity: noteIn, boxShadow: `14px 16px 0 ${ink}1A` }} />
        ) : null}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {connectors}
        </svg>
        {bookIdx >= 0 && miniIn > 0 ? (
          <div style={{ position: "absolute", left: miniBook.x - miniBook.w / 2, top: miniBook.y - miniBook.h / 2, width: miniBook.w, height: miniBook.h, background: ink, borderRadius: 8, opacity: miniIn, transform: `translateX(${(1 - miniIn) * (rtl ? 1 : -1) * W * 0.12}px) rotate(${rtl ? 6 : -6}deg)`, boxShadow: `10px 12px 0 ${ink}22` }}>
            <div style={{ margin: `${miniBook.h * 0.16}px ${miniBook.w * 0.12}px 0`, height: miniBook.h * 0.08, background: hl }} />
            <div style={{ margin: `${miniBook.h * 0.06}px ${miniBook.w * 0.12}px 0 ${miniBook.w * 0.3}px`, height: miniBook.h * 0.045, background: bg, opacity: 0.45 }} />
          </div>
        ) : null}
        {quoteMarks}
        {nodes}
        {author && layout === "book" ? (
          <div style={{ position: "absolute", left: (rtl ? W * 0.6 : W * 0.4) - W * 0.25, width: W * 0.5, top: H * 0.28 + keys.length * 160 - 30, textAlign: "center", fontFamily: fontFamilies.body, fontSize: 54, color: soft, clipPath: rtl ? `inset(-30% 0 -30% ${(1 - interpolate(frame, [authorAt, authorAt + 18], [0, 1], clamp)) * 100}%)` : undefined }}>
            {author}
          </div>
        ) : null}
        {p ? <Pen x={p.x} y={p.y} color={ink} tip={hl} show={penShow} flip={rtl} /> : null}
      </div>
    </SceneShell>
  );
};

export const inkMeaningSample: Omit<InkMeaningProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 1 · السؤال الذي لا يغيب",
  narration: "نصلي كل يوم. نقف، ونقرأ، ونركع، ونسجد. لكن سؤالا يستحق أن نسأله: هل يحضر قلبنا كما يحضر جسدنا؟",
  layout: "center",
  items: "الصلاة | key | نصلي\nنقف | word\nنقرأ | word\nنركع | word\nنسجد | word\nهل يحضر قلبنا كما يحضر جسدنا؟ | line | هل\nهل يحضر قلبنا كما يحضر جسدنا؟ | mark | قلبنا",
};
export const inkMeaningSampleEn: Omit<InkMeaningProps, "themeId" | "orientation"> = {
  eyebrow: "Chapter 1 · The question that stays",
  narration: "We pray every day. We stand, recite, bow and prostrate. But a question deserves asking: is our heart present as our body is?",
  layout: "center",
  items: "Prayer | key | pray\nstand | word\nrecite | word\nbow | word\nprostrate | word\nIs the heart present as the body is? | line | is\nIs the heart present as the body is? | mark | heart",
};
export const inkMeaningSeconds = 10;
