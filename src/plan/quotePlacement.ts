/**
 * D246 «أ» (قرار المالك ٢٨ نوفمبر، يعدّل D242/D246): موضع بطاقة الآية/الحديث في لقطة «خط الأفق» وزمنها.
 *
 * ١) أول فكرة مرسومة ثم البطاقة: رسم المشهد يقف (سكون D214) طوال ظهور البطاقة، فإن ظهرت من أول كلمة بقي الدفتر فارغًا خلفها
 *    (002 c1-s51 «المائدة ٣٢»: نحو ١٨ ث على دفتر فارغ). الآن يرسم المشهد أول فكرة له (أول عنصر على كلمته، من مراسي اللقطة
 *    نفسها: cueKit في البدايات، وحقول «…Word» في المكتبة، عبر cueTrace)، ثم تنزل البطاقة من الكلمة التي بعد اكتمال رسمها
 *    (`verseFrom`/`hadithFrom`، وقد تكون «كلمة#2») على **الصفحة المقابلة** للرسم (`verseSide`/`hadithSide`)، والرسم باقٍ ساكنًا
 *    بجوارها. و`quoteFirm: "1"`: لا تتقدم البطاقة عن كلمتها أبدًا (quoteStart).
 *    الصفحة: يُرسم المشهد بلا كاميرا (renderToStaticMarkup، بلا رندر فيديو) قبل الفكرة وبعدها، وتُحسب مواضع العناصر التي تغيّرت
 *    في إحداثيات الدفتر (x < 960 الصفحة اليسرى «l»، وإلا اليمنى «r»)، بعد حذف ما يتحرك وحده (الحركة الدائمة) وما يمتد على
 *    الصفحتين؛ وإن تعادلت فكل ما رُسم في المشهد إلى تلك اللحظة، ثم `HZ_META.quoteSide`، ثم الافتراضي (اليمنى).
 * ٢) الاستمرار في الموضوع نفسه وحده: البطاقة لا تستمر إلى المشهد التالي إلا إن عُلّم `carryAllowed: "1"` (ويمنعه "0" صراحة).
 *    يضعه المحوّل حيث يكمل الراوي الآية نفسها بوضوح (continuesQuote): إشارة صريحة («هذه الآية»، «في الحديث نفسه»…)، أو
 *    شرح بكلمة منه («والكِفل نصيب.»: أول كلمة في جملة قصيرة من كلمات الاقتباس)، أو «ومعناه/أي/يعني» في أوله، أو كلمتان على
 *    الأقل من كلمات الاقتباس بعد التطبيع، أو اللقطة نفسها مستمرة (المشهد التالي بلقطة الحامل نفسها: فكرة واحدة مرسومة على
 *    مشهدين). وعند الشك لا استمرار. ويضعه المحرر أو المالك يدويًا حيث يرى ذلك.
 * ٣) ما لا يتسع: آية واحدة فوق ٣٠ كلمة (D222) تُعرض جزءًا متصلًا من أولها ينتهي عند علامة وقف (حد معنى تام) يتسع لزمن
 *    قراءته، معلَّمًا «(جزء)» و«…» (`versePartial: "1"` و`versePartialAuto: "1"`، ونصها الكامل من السكريبت يعود عند إعادة
 *    الحساب)؛ ويحتاج موافقة المتخصص كأي جزء (D222). وآية حتى ٣٠ كلمة أو نطاق أو حديث: النص كاملًا، والنقص يُذكر في التقرير.
 * ٤) `quotePinned: "1"`: لا يُعاد حساب كلمة البطاقة ولا صفحتها ولا حاملها (قرار مالك على مشهد بعينه، مثل 002 c2-s10).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PlanScene } from "./types";
import type { EpisodeMedia } from "./media";
import { emptyMedia } from "./media";
import { HZ_SCENES } from "../remotion/dafatir/horizon/episode001";
import { HZ_META, hzQuote, verseReadSeconds } from "../remotion/dafatir/horizon/meta";
import type { Timeline } from "../remotion/dafatir/horizon/timeline";
import { traceCues, type CueEvent } from "../remotion/dafatir/horizon/cueTrace";
import { StillViewContext, rawSacred } from "../remotion/dafatir/bidayat/kit";
import { Book, NEUTRAL } from "../remotion/dafatir/horizon/book";
import { LIB_SACRED } from "../remotion/dafatir/lib/meta";
import { PARTIAL_MIN_WORDS, verseWordCount } from "../quran/verseSource";
import { computeQuoteCarries, sceneTimeline, type QuoteCarry } from "./quoteCarry";

/* ───────────── ١) أول فكرة مرسومة ───────────── */

type Shot = (q: { t: number; tl: Timeline; dur: number; exit: string; p: Record<string, string | undefined> }) => unknown;
const shotOf = (s: PlanScene) => HZ_SCENES[s.props.shot ?? ""] as unknown as Shot | undefined;
/** حقول الاقتباس لا تدخل رسم اللقطة عند التتبع */
const bareProps = (p: Record<string, string>) => Object.fromEntries(Object.entries(p).filter(([k]) => !/^(verse|hadith|carry|quote)/.test(k)));

export type FirstIdea = { idx: number; len: number; word: string; s: number; done: number };
/** أول عنصر مرسوم على كلمته في المشهد (null: لا حدث على كلمة، كتمهيد الآية الساكن أو مشهد بالكلمات وحدها) */
export const firstDrawnIdea = (scene: PlanScene, tl: Timeline): FirstIdea | null => {
  const fn = shotOf(scene);
  if (!fn || !tl.words.length || HZ_META[scene.props.shot ?? ""]?.still) return null;
  const dur = tl.end + 1.2;
  const p = bareProps(scene.props);
  const ev: CueEvent[] = [];
  for (const t of [0.05, tl.end / 2, tl.end]) ev.push(...traceCues(() => fn({ t, tl, dur, exit: "none", p })));
  const ok = ev.filter((e) => e.idx >= 0 && e.idx < tl.words.length);
  if (!ok.length) return null;
  const idx = Math.min(...ok.map((e) => e.idx));
  const len = Math.max(...ok.filter((e) => e.idx === idx).map((e) => e.len));
  const w = tl.words[idx]!;
  return { idx, len, word: w.w, s: w.s, done: w.s + len };
};

const strip = (x: string) => x.replace(/[ً-ْٰـ]/g, "");
/** الكلمة بصيغة quoteStart: «كلمة» أو «كلمة#n» إن سبقتها كلمة تبدأ بها */
export const fromToken = (tl: Timeline, j: number): string => {
  const p = strip(tl.words[j]!.w);
  const nth = tl.words.slice(0, j + 1).filter((x) => strip(x.w).startsWith(p)).length;
  return nth > 1 ? `${p}#${nth}` : p;
};

/** صيغ الصلاة والسلام والترضي بعد الاسم: لا تنزل البطاقة في وسطها («صلى الله عليه وسلم»، «عليه السلام»، «رضي الله عنه») */
const HONORIFIC = /^(?:صلى|صلي|عليه|عليها|عليهما|عليهم|السلام|وسلم|رضي|عنه|عنها|عنهما|عنهم)$/;
/** كلمة ظهور البطاقة: أول كلمة تبدأ بعد اكتمال رسم الفكرة الأولى، ليست ذكرًا لله ولا داخل نافذته (±٠٫٢٥ ث) */
export const fromAfterIdea = (tl: Timeline, idea: FirstIdea | null): number => {
  const n = tl.words.length;
  // نوافذ الذكر والدعاء (±٠٫٢٥ ث، كما في السكون المقصود): البطاقة لا تنزل داخلها
  const wins = rawSacred(tl, tl.end + 2);
  const clear = (k: number) => !LIB_SACRED.test(tl.words[k]!.w) && !HONORIFIC.test(strip(tl.words[k]!.w)) && !wins.some(([a, b]) => tl.words[k]!.s >= a - 0.05 && tl.words[k]!.s <= b);
  const start = idea ? tl.words.findIndex((w, k) => k > idea.idx && w.s >= idea.done - 0.05) : 0;
  for (let k = start < 0 ? n : start; k < n; k++) if (clear(k)) return k;
  // لا كلمة بعد اكتمال الفكرة: الكلمة التي بعد كلمتها (أو الأخيرة)
  if (idea) for (let k = idea.idx + 1; k < n; k++) if (clear(k)) return k;
  return Math.max(0, idea ? Math.min(idea.idx, n - 1) : 0);
};

/* ───────────── الصفحة المقابلة للرسم ───────────── */

type M = [number, number, number, number, number, number];
const mul = (a: M, b: M): M => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const ID: M = [1, 0, 0, 1, 0, 0];
const parseTransform = (v: string): M => {
  let m = ID;
  for (const f of v.matchAll(/(translate|scale|rotate|matrix)\(([^)]*)\)/g)) {
    const a = f[2]!.split(/[\s,]+/).filter(Boolean).map(Number);
    if (f[1] === "translate") m = mul(m, [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]);
    else if (f[1] === "scale") m = mul(m, [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0]);
    else if (f[1] === "matrix" && a.length === 6) m = mul(m, a as M);
    else if (f[1] === "rotate") {
      const r = ((a[0] ?? 0) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), cx = a[1] ?? 0, cy = a[2] ?? 0;
      m = mul(mul(mul(m, [1, 0, 0, 1, cx, cy]), [c, s, -s, c, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
    }
  }
  return m;
};
const attr = (s: string, k: string) => s.match(new RegExp(`(?:^|\\s)${k}="([^"]*)"`))?.[1];
const num = (s: string, k: string, d = 0) => { const v = Number(attr(s, k)); return Number.isFinite(v) ? v : d; };
/** نقاط مسار SVG (المطلقة والنسبية) لتقدير حدوده */
const pathPoints = (d: string): [number, number][] => {
  const tok = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const pts: [number, number][] = [];
  let x = 0, y = 0, cmd = "M", i = 0, sx = 0, sy = 0;
  const n = () => Number(tok[i++]);
  const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i]!)) { cmd = tok[i++]!; if (/[Zz]/.test(cmd)) { x = sx; y = sy; continue; } }
    const C = cmd.toUpperCase(), rel = cmd !== C, k = ARGS[C] ?? 2;
    if (i + k > tok.length || k === 0) break;
    const a = Array.from({ length: k }, n);
    if (C === "H") x = rel ? x + a[0]! : a[0]!;
    else if (C === "V") y = rel ? y + a[0]! : a[0]!;
    else {
      for (let q = C === "A" ? 5 : 0; q < k; q += 2) {
        const px = rel ? x + a[q]! : a[q]!, py = rel ? y + a[q + 1]! : a[q + 1]!;
        pts.push([px, py]);
      }
      x = rel ? x + a[k - 2]! : a[k - 2]!;
      y = rel ? y + a[k - 1]! : a[k - 1]!;
    }
    pts.push([x, y]);
    if (C === "M") { sx = x; sy = y; cmd = rel ? "l" : "L"; }
  }
  return pts;
};
type Ink = { sig: string; cx: number; w: number; h: number; bucket: string };
const SKIP = new Set(["defs", "clipPath", "mask", "pattern", "linearGradient", "radialGradient", "filter", "symbol", "marker"]);
const SHAPES = new Set(["circle", "ellipse", "rect", "line", "path", "polyline", "polygon", "text", "image", "use"]);
/** عناصر الحبر الظاهرة في رسم SVG بإحداثيات الدفتر */
export const inkElements = (html: string): Ink[] => {
  const out: Ink[] = [];
  const stack: { tag: string; m: M; hidden: boolean; skip: boolean }[] = [];
  for (const t of html.matchAll(/<(\/?)([a-zA-Z][\w:-]*)((?:[^>"]|"[^"]*")*?)(\/?)>/g)) {
    const [, close, tag, rest] = t;
    if (close) { while (stack.length && stack.pop()!.tag !== tag) { /* وسم بلا إغلاق */ } continue; }
    const top = stack[stack.length - 1];
    const m = mul(top?.m ?? ID, parseTransform(attr(rest!, "transform") ?? ""));
    const op = attr(rest!, "opacity");
    const hidden = Boolean(top?.hidden) || op === "0" || attr(rest!, "display") === "none";
    const skip = Boolean(top?.skip) || SKIP.has(tag!);
    if (!t[4] && !/^(img|br|hr|input|meta|link)$/i.test(tag!)) stack.push({ tag: tag!, m, hidden, skip });
    if (skip || hidden || !SHAPES.has(tag!)) continue;
    let pts: [number, number][] = [];
    const r = rest!;
    if (tag === "circle" || tag === "ellipse") {
      const rx = num(r, tag === "circle" ? "r" : "rx"), ry = tag === "circle" ? rx : num(r, "ry");
      if (rx <= 0 || ry <= 0) continue;
      pts = [[num(r, "cx") - rx, num(r, "cy") - ry], [num(r, "cx") + rx, num(r, "cy") + ry]];
    } else if (tag === "rect" || tag === "image" || tag === "use") {
      const w = num(r, "width"), h = num(r, "height");
      if (tag === "rect" && (w <= 0 || h <= 0)) continue;
      pts = [[num(r, "x"), num(r, "y")], [num(r, "x") + w, num(r, "y") + h]];
    } else if (tag === "line") pts = [[num(r, "x1"), num(r, "y1")], [num(r, "x2"), num(r, "y2")]];
    else if (tag === "path") pts = pathPoints(attr(r, "d") ?? "");
    else if (tag === "polyline" || tag === "polygon") pts = (attr(r, "points") ?? "").trim().split(/[\s,]+/).map(Number).reduce<[number, number][]>((a, v, i, arr) => (i % 2 ? a : [...a, [v, arr[i + 1]!]]), []);
    else if (tag === "text") pts = [[num(r, "x"), num(r, "y")]];
    if (!pts.length) continue;
    const xs = pts.map(([x, y]) => m[0] * x + m[2] * y + m[4]);
    const ys = pts.map(([x, y]) => m[1] * x + m[3] * y + m[5]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    out.push({ sig: `${tag}|${r}|${m.map((v) => Math.round(v * 10)).join(",")}`, cx, w: x1 - x0, h: y1 - y0, bucket: `${tag}@${Math.round(cx / 40)},${Math.round(cy / 40)}` });
  }
  return out;
};
/** ما في b وليس في a (عدًّا) */
const added = (a: Ink[], b: Ink[]): Ink[] => {
  const n = new Map<string, number>();
  for (const x of a) n.set(x.sig, (n.get(x.sig) ?? 0) + 1);
  return b.filter((x) => { const k = n.get(x.sig) ?? 0; if (k > 0) { n.set(x.sig, k - 1); return false; } return true; });
};
const WIDE = 700;
const SPINE = 960;
/** «l» أو «r» أو null إن تعادلت الصفحتان */
/** byArea: كل عنصر بمساحته (للحبر الظاهر كله: الحجر يغلب خطوط تظليل الأرض الصغيرة الموزعة على الصفحتين) */
const sideOf = (els: Ink[], byArea = false): "l" | "r" | null => {
  const xs = els.filter((e) => e.w <= WIDE);
  const wt = (e: Ink) => (byArea ? (e.w + 10) * (e.h + 10) : 1);
  const l = xs.filter((e) => e.cx < SPINE).reduce((a, e) => a + wt(e), 0), all = xs.reduce((a, e) => a + wt(e), 0), r = all - l;
  if (!xs.length || Math.min(l, r) >= 0.4 * all) return null;
  return l > r ? "l" : "r";
};

export type DrawingSide = { side: "l" | "r" | null; why: string };
/** صفحة الرسم عند ظهور البطاقة: صفحة ما رُسم للفكرة الأولى، وإلا ما رُسم في المشهد إلى تلك اللحظة */
export const drawingSide = (scene: PlanScene, tl: Timeline, idea: FirstIdea | null, at: number): DrawingSide => {
  const fn = shotOf(scene);
  if (!fn || !tl.words.length) return { side: null, why: "لا رسم" };
  const dur = tl.end + 1.2;
  const p = bareProps(scene.props);
  const Comp = fn as unknown as React.FC<Record<string, unknown>>;
  const ink = (t: number) => {
    try {
      return inkElements(renderToStaticMarkup(React.createElement(StillViewContext.Provider, { value: true }, React.createElement(Comp, { t: Math.max(0.02, t), tl, dur, exit: "none", p }))));
    } catch { return null; }
  };
  const tB = Math.max(0.1, at - 0.02);
  const B = ink(tB);
  if (!B) return { side: null, why: "تعذّر الرسم" };
  if (idea) {
    const tA = Math.max(0.02, idea.s - 0.12);
    const A = ink(tA), A0 = ink(Math.max(0.02, tA - (tB - tA)));
    if (A && A0) {
      // ما يتحرك وحده (دوران، انجراف) في نافذة مساوية قبل الفكرة لا يُحسب من رسمها
      const ambient = new Set(added(A0, A).map((e) => e.bucket));
      const s = sideOf(added(A, B).filter((e) => !ambient.has(e.bucket)));
      if (s) return { side: s, why: `الفكرة الأولى «${idea.word}»` };
    }
  }
  const Z = ink(0.02);
  const s = Z ? sideOf(added(Z, B)) : null;
  if (s) return { side: s, why: "ما رُسم في المشهد قبل البطاقة" };
  // كل الحبر الظاهر عند البطاقة (ومنه ما رُسم في مشاهد اللقطة السابقة)، بلا عناصر الدفتر نفسه (الورق والكعب والظلال)
  const chrome = new Map<string, number>();
  try {
    for (const e of inkElements(renderToStaticMarkup(React.createElement(Book, { id: "q", t: tB, dur, cam: NEUTRAL }))))
      chrome.set(e.bucket, (chrome.get(e.bucket) ?? 0) + 1);
  } catch { /* بلا طرح */ }
  const own = B.filter((e) => { const k = chrome.get(e.bucket) ?? 0; if (k > 0) { chrome.set(e.bucket, k - 1); return false; } return true; });
  const all = sideOf(own, true);
  return all ? { side: all, why: "الحبر الظاهر عند البطاقة" } : { side: null, why: "الرسم على الصفحتين" };
};

/* ───────────── ٢) الاستمرار في الموضوع نفسه ───────────── */

const normAr = (w: string) => w.normalize("NFC").replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "").replace(/ء(?=ا)/g, "").replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/[^\p{L}]/gu, "");
const STOP = new Set("الله لله ربه ربك ربنا ربكم الذي التي الذين اللذين من في على عن الي ان كان كانوا قال قالوا هذا هذه ذلك تلك ما لا ثم او قد لقد كل بعد قبل عند مع اذا اذ لم لن هو هي هم انه انها انا انت وقد ولا فلا ايضا اخبرنا اخبر القران الايه الايات الحديث النبي صلي وسلم عليه السلام رضي عنه عنهما".split(" ").map(normAr));
const stemAr = (w: string) => {
  const x = normAr(w);
  if (!x || STOP.has(x)) return "";
  const y = x.replace(/^(و|ف)(?=..)/, "").replace(/^(بال|كال|فال|وال|لل|ال)(?=...)/, "");
  return y.length >= 3 && !STOP.has(y) ? y : "";
};
const stemsOf = (t: string) => [...new Set(t.split(/\s+/).map(stemAr).filter(Boolean))];
/** هيكل الجذر التقريبي: بلا حرف المضارعة وبلا حروف المد بعد الحرف الأول (خاسرين/خسر، يخاف/أخاف) */
const skeletons = (x: string) => [x, ...(x.length >= 4 && /^[اينت]/.test(x) ? [x.slice(1)] : [])].map((y) => (y[0] ?? "") + y.slice(1).replace(/[اوي]/g, "")).filter((y) => y.length >= 3);
const sameStem = (a: string, b: string) => a === b || skeletons(a).some((x) => skeletons(b).some((y) => x.slice(0, 3) === y.slice(0, 3)));
/** كلمات النص المطابقة لكلمات الاقتباس */
export const quoteOverlap = (narration: string, quote: string): string[] => {
  const q = stemsOf(quote);
  return stemsOf(narration).filter((x) => q.some((v) => sameStem(x, v)));
};
const EXPLICIT = /(?:هذه|تلك|في|نفس)\s+(?:ال)?آي(?:ة|ات)(?!\s+(?:التي\s+)?(?:بعدها|تليها|الأخرى))|الآية\s+نفسها|(?:هذا|ذلك)\s+الحديث|الحديث\s+نفسه|في\s+هذا\s+الحديث/;
const EXPLAINS = /^\s*(?:و|ف)?(?:معناه|معناها|والمعنى|المعنى|أي|يعني)[\s:،]/;

export type TopicDecision = { allow: boolean; why: string };
/**
 * هل يكمل نص المشهد التالي الاقتباسَ نفسه بوضوح؟ (الاستدلال المحافظ؛ عند الشك لا)
 * sameShot: المشهد التالي بلقطة الحامل نفسها (فكرة مرسومة واحدة على مشهدين).
 */
export const continuesQuote = (narration: string, quote: string, sameShot = false): TopicDecision => {
  if (!narration.trim()) return { allow: false, why: "بلا كلام" };
  if (EXPLICIT.test(narration)) return { allow: true, why: "إشارة صريحة إلى الاقتباس" };
  if (EXPLAINS.test(narration)) return { allow: true, why: "شرح «ومعناه/أي»" };
  const hits = quoteOverlap(narration, quote);
  const words = narration.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  const first = stemsOf(words.slice(0, 2).join(" "))[0];
  if (words.length <= 6 && first && hits.includes(first)) return { allow: true, why: `شرح كلمة منه «${first}»` };
  if (hits.length >= 2) return { allow: true, why: `كلمات منه: ${hits.slice(0, 4).join("، ")}` };
  if (sameShot && hits.length) return { allow: true, why: `اللقطة نفسها مستمرة وكلمة منه (${hits[0]})` };
  return { allow: false, why: hits.length ? `كلمة واحدة منه فقط (${hits[0]})` : "موضوع آخر" };
};

/* ───────────── ٣) الجزء (D222) ───────────── */

const WAQF = /^[ۖ-ۜ]$/u;
/**
 * جزء متصل من أول الآية ينتهي عند علامة وقف ويتسع زمن قراءته في maxRead، أو null.
 * آية واحدة فوق PARTIAL_MIN_WORDS كلمة وحدها (D222)؛ وإن لم يتسع حتى المقطع الأول فهو المقطع الأول (أقل نقص).
 */
export const autoPartial = (full: string, key: string, maxRead: number): string | null => {
  if (key.includes("-") || verseWordCount(full) <= PARTIAL_MIN_WORDS) return null;
  const tok = full.trim().split(/\s+/);
  const cuts: string[] = [];
  tok.forEach((w, i) => { if (WAQF.test(w) && i < tok.length - 1) cuts.push(`${tok.slice(0, i + 1).join(" ")} …`); });
  if (!cuts.length) return null;
  const fit = cuts.filter((c) => verseReadSeconds(c) <= maxRead + 1e-6);
  return fit.length ? fit[fit.length - 1]! : cuts[0]!;
};

/* ───────────── التطبيق على فصل ───────────── */

export type QuotePlacement = {
  host: string; kind: "verse" | "hadith"; ref: string; pinned: boolean;
  idea?: string; from: string; side: "l" | "r"; sideWhy: string;
  /** زمن القراءة للنص المعروض، وما يُعرض فعلًا (ث) */
  read: number; shown: number; shortfall: number;
  carried: { id: string; seconds: number }[]; stop?: string;
  partial?: "script" | "auto";
};
export type CarryDecision = { host: string; next: string; allow: boolean; why: string; source: "owner" | "auto" };

/** أول فكرة وكلمة الظهور وصفحة الرسم لكل مشهد بمدخلاته (يُجرَّب الإلحاق مرات) */
const MEMO = new Map<string, { idea: FirstIdea | null; j: number; ds: DrawingSide }>();
const QUOTE_KEYS = ["verseFrom", "verseSide", "hadithFrom", "hadithSide", "quoteFirm"] as const;

/**
 * يطبّق «أ» والاستمرار في الموضوع والجزء على مشاهد فصل واحد بعد الإلحاق (attachQuoteCards). خالصة ومحدَّدة.
 * quran: نصوص الآيات من السكريبت (لإعادة نص الجزء الآلي كاملًا قبل إعادة الحساب).
 */
export const placeQuotes = (input: PlanScene[], media: Pick<EpisodeMedia, "voice" | "recitations"> = emptyMedia, o: { channelId?: string; quran?: Record<string, string> } = {}) => {
  let scenes = input.map((s) => ({ ...s, props: { ...s.props } }));
  const decisions: CarryDecision[] = [];
  const why = new Map<string, { idea?: string; side: string }>();
  const hostIdx = scenes.map((s, i) => (s.template === "horizon-shot" && s.narration.trim() && hzQuote(s.props) && !hzQuote(s.props)!.carried ? i : -1)).filter((i) => i >= 0);
  for (const i of hostIdx) {
    const h = scenes[i]!;
    const p = h.props;
    const q = hzQuote(p)!;
    // الجزء الآلي يعود نصًا كاملًا من السكريبت قبل إعادة الحساب
    if (q.kind === "verse" && p.versePartialAuto === "1") {
      const full = o.quran?.[p.verseKey ?? ""];
      if (full?.trim()) { p.verseText = full; delete p.versePartial; }
      delete p.versePartialAuto;
    }
    if (p.quotePinned === "1") { why.set(h.id, { side: "مثبَّت (quotePinned)" }); continue; }
    for (const k of QUOTE_KEYS) delete p[k];
    const tl = sceneTimeline(h, media);
    const key = JSON.stringify([p.shot, h.narration, bareProps(p), tl.words.map((w) => Math.round(w.s * 100))]);
    let hit = MEMO.get(key);
    if (!hit) {
      const idea = firstDrawnIdea(h, tl);
      const j = fromAfterIdea(tl, idea);
      hit = { idea, j, ds: drawingSide(h, tl, idea, tl.words[j]?.s ?? 0.3) };
      if (MEMO.size > 500) MEMO.clear();
      MEMO.set(key, hit);
    }
    const { idea, j, ds } = hit;
    const from = tl.words.length ? fromToken(tl, j) : "";
    const side = ds.side ? (ds.side === "l" ? "r" : "l") : HZ_META[p.shot ?? ""]?.quoteSide ?? "r";
    if (q.kind === "verse") { p.verseFrom = from; p.verseSide = side; } else { p.hadithFrom = from; p.hadithSide = side; }
    p.quoteFirm = "1";
    why.set(h.id, { ...(idea ? { idea: idea.word } : {}), side: ds.side ? `الرسم على ${ds.side === "l" ? "اليسرى" : "اليمنى"} (${ds.why})` : `${ds.why}: ${HZ_META[p.shot ?? ""]?.quoteSide ? "HZ_META.quoteSide" : "الافتراضي"}` });
  }
  // الاستمرار في الموضوع نفسه: قرار المالك/المحرر أولًا (carryAllowed بلا carryAuto)، ثم الاستدلال المحافظ: يُكتب
  // carryAllowed «1» مع carryAuto «1» حيث يجوز، ويُعاد حسابه في كل تشغيل، ويُحذف حيث لم تصل إليه بطاقة
  for (const s of scenes) if (s.props.carryAuto === "1") { delete s.props.carryAuto; delete s.props.carryAllowed; }
  const auto = new Set<string>();
  for (const i of hostIdx) {
    const h = scenes[i]!;
    const q = hzQuote(h.props)!;
    for (let k = i + 1; k < scenes.length; k++) {
      const n = scenes[k]!;
      if (n.template !== "horizon-shot" || !n.narration.trim() || hzQuote(n.props) && !hzQuote(n.props)!.carried || HZ_META[n.props.shot ?? ""]?.still) break;
      const own = n.props.carryAllowed;
      if ((own === "1" || own === "0") && !auto.has(n.id)) {
        decisions.push({ host: h.id, next: n.id, allow: own === "1", why: own === "1" ? "carryAllowed «1» في الخطة (المحرر/المالك)" : "carryAllowed «0» في الخطة (المحرر/المالك)", source: "owner" });
        if (own === "0") break;
        continue;
      }
      const d = continuesQuote(n.narration, q.text, n.props.shot === scenes[k - 1]!.props.shot);
      decisions.push({ host: h.id, next: n.id, allow: d.allow, why: d.why, source: "auto" });
      if (!d.allow) break;
      n.props.carryAllowed = "1";
      auto.add(n.id);
    }
  }
  const run = () => computeQuoteCarries(scenes, media, { channelId: o.channelId });
  let c = run();
  scenes = c.scenes;
  // ما لا يتسع: جزء آلي لآية واحدة طويلة جدًا (D222)، يقصر مقطعًا مقطعًا حتى يتسع
  for (let round = 0; round < 6; round++) {
    let again = false;
    for (const r of c.carries) {
      if (r.kind !== "verse" || r.shortfall <= 0.05) continue;
      const h = scenes.find((s) => s.id === r.host)!;
      if (h.props.quotePinned === "1" || (h.props.versePartial === "1" && h.props.versePartialAuto !== "1")) continue;
      const full = h.props.versePartialAuto === "1" ? o.quran?.[h.props.verseKey ?? ""] ?? "" : h.props.verseText ?? "";
      const cur = h.props.verseText ?? "";
      let seg = autoPartial(full, h.props.verseKey ?? "", r.read - r.shortfall);
      // المقطع نفسه ولا يزال لا يتسع (تغيّرت بداية التالي): الأقصر منه
      if (seg && seg === cur) seg = autoPartial(full, h.props.verseKey ?? "", verseReadSeconds(cur) - 0.5);
      if (!seg || seg === cur) continue;
      h.props.verseText = seg;
      h.props.versePartial = "1";
      h.props.versePartialAuto = "1";
      again = true;
    }
    if (!again) break;
    c = run();
    scenes = c.scenes;
  }
  // الإذن الآلي حيث لم تصل إليه بطاقة يُحذف (لا حقل بلا أثر في الخطة)
  const reached = new Set(c.carries.flatMap((r) => r.carried.map((x) => x.id)));
  for (const s of scenes) {
    if (auto.has(s.id) && !reached.has(s.id)) delete s.props.carryAllowed;
    else if (auto.has(s.id)) s.props.carryAuto = "1";
  }
  // قرارات الاستمرار التي احتاجتها بطاقة فعلًا (المشاهد التي استمرت إليها، والمشهد الذي وقفت قبله)
  const needed = decisions.filter((d) => {
    const r = c.carries.find((x) => x.host === d.host);
    if (!r) return false;
    const ids = r.carried.map((x) => x.id);
    const i = scenes.findIndex((x) => x.id === d.host);
    const stopAt = scenes[i + 1 + ids.length]?.id;
    return ids.includes(d.next) || d.next === stopAt;
  });
  decisions.splice(0, decisions.length, ...needed);
  const placements: QuotePlacement[] = hostIdx.map((i) => {
    const h = scenes[i]!;
    const p = h.props;
    const q = hzQuote(p)!;
    const rec: QuoteCarry | undefined = c.carries.find((x) => x.host === h.id);
    const read = verseReadSeconds(q.text);
    const w = why.get(h.id);
    return {
      host: h.id, kind: q.kind, ref: (q.kind === "verse" ? p.verseKey : p.hadithRef) ?? "", pinned: p.quotePinned === "1",
      ...(w?.idea ? { idea: w.idea } : {}), from: q.from,
      side: ((q.kind === "verse" ? p.verseSide : p.hadithSide ?? p.verseSide) === "l" ? "l" : "r"),
      sideWhy: w?.side ?? "",
      read, shown: rec ? Math.round((read - rec.shortfall) * 100) / 100 : read, shortfall: rec?.shortfall ?? 0,
      carried: rec?.carried ?? [], ...(rec?.stop ? { stop: rec.stop } : {}),
      ...(p.versePartial === "1" ? { partial: p.versePartialAuto === "1" ? "auto" as const : "script" as const } : {}),
    };
  });
  return { scenes, carries: c.carries, placements, decisions };
};
