/**
 * وصل بنية الصوت المعزولة (الأمر 025) بالتوليد والرندر — «دفاتر الزمن» وحدها.
 *
 * دوال خالصة بلا ملفات ولا شبكة (يستدعيها src/voice/dafatirParts.ts، وتختبرها بيانات صناعية):
 * - composeScene: يضع أجزاء المشهد المقصوصة في موضعها (layoutScene) ويحوّل توقيت كلماتها إلى زمن المشهد.
 * - mixScene: يصنع عينات المشهد الواحد من الأجزاء (صمت الرأس ثم كل جزء مقصوصًا في موضعه).
 * - renderBoundaries: صمت كل حد بمالك واحد (D8) على عقد الرندر الحالي: بطاقة الآية = التلاوة بالضبط،
 *   فيُحمل صمت ما قبل التلاوة في ذيل المشهد قبلها، وصمت ما بعدها في رأس تسجيل المشهد بعدها؛
 *   القيمة عند كل حد = max(المقرر، أقل خروج بصري) كما في silence.ts، لا مجموع القيم.
 */
import type { HzExit } from "../horizon/meta";
import { layoutScene, type PartClip, type PartJob, type PlacedPart } from "./parts";
import { SILENCE_POLICY } from "./silence";

export type TimedWord = { word: string; start: number; end: number };

/** نتيجة جزء واحد بعد توليده وقياس حدوده: التسجيل، وكلماته المنطوقة بزمن الملف */
export type PartResult = { clip: PartClip; words: TimedWord[] };

export type ComposedScene = {
  scene: string;
  parts: PlacedPart[];
  /** صمت يسبق الكلام في ملف المشهد (بعد بطاقة آية فقط) */
  pre: number;
  /** أول كلام وآخره، ونهاية الصوت (بعد هامش التلاشي) — بزمن المشهد، شاملة pre */
  speechStart: number;
  speechEnd: number;
  audioEnd: number;
  /** الكلمات المنطوقة مرتبة بزمن المشهد */
  words: TimedWord[];
};

export const composeScene = (scene: string, jobs: PartJob[], results: Record<string, PartResult>, pre = 0, partGap?: number): ComposedScene => {
  const clips = Object.fromEntries(Object.entries(results).map(([k, r]) => [k, r.clip]));
  const layout = layoutScene(scene, jobs, clips, partGap);
  const words: TimedWord[] = [];
  for (const placed of layout.parts) {
    const toScene = (x: number) => pre + placed.at + (x - placed.trimStart);
    for (const w of results[placed.partId]!.words) words.push({ word: w.word, start: toScene(w.start), end: toScene(w.end) });
  }
  return {
    scene,
    parts: layout.parts.map((p) => ({ ...p, at: p.at + pre, speechAt: p.speechAt + pre, speechEndAt: p.speechEndAt + pre })),
    pre,
    speechStart: layout.speechStart + pre,
    speechEnd: layout.speechEnd + pre,
    audioEnd: layout.audioEnd + pre,
    words,
  };
};

/** عينات المشهد: كل جزء مقصوص من ملفه ومنسوخ إلى موضعه (لا تداخل: الفاصل بين الأجزاء موجب) */
export const mixScene = (c: ComposedScene, samples: Record<string, Float32Array>, sampleRate: number): Float32Array => {
  const out = new Float32Array(Math.ceil(c.audioEnd * sampleRate));
  for (const p of c.parts) {
    const src = samples[p.partId];
    if (!src) throw new Error(`لا عينات للجزء ${p.partId}`);
    const a = Math.round(p.trimStart * sampleRate);
    const b = Math.min(src.length, Math.round(p.trimEnd * sampleRate));
    const at = Math.round(p.at * sampleRate);
    for (let i = a; i < b && at + i - a < out.length; i++) out[at + i - a] = src[i]!;
  }
  return out;
};

/** عنصر في تسلسل الحلقة كما يراه الرندر */
export type SeqItem =
  | { kind: "narration"; id: string; exit: HzExit; designTail: number; minEnd?: number }
  | { kind: "verse"; id: string }
  | { kind: "card"; id: string };

export type Boundary = { pre: number; tail: number; seconds: number };
export type GapCheck = { from: string; to: string; owner: "scene-tail" | "verse-lead" | "verse-trail" | "chapter-card" | "end"; value: number; expected: number };

/**
 * الصمت عند الحدود ومدة كل مشهد منطوق.
 * - إلى مشهد منطوق: ذيل = max(أقل خروج، ذيل التصميم − هامش الكلام التالي) فيصير الصمت = ذيل التصميم.
 * - إلى بطاقة آية: ذيل = max(قبل التلاوة 0.7، أقل خروج) — الخروج يمرّ تحت الصمت ولا يُضاف إليه.
 * - بعد بطاقة آية: رأس التسجيل = max(0، بعد التلاوة 0.6 − هامش الكلام) فيصير الصمت 0.6.
 * - إلى بطاقة فصل: ذيل = أقل خروج (البطاقة وقفة بصرية مستقلة، لا صمت فوقها).
 * - آخر مشهد: ذيل = max(أقل خروج، ذيل التصميم).
 * assumedLead: هامش أول كلام المشهد التالي المفترض عند حساب الذيل (هامش القص الثابت)، فلا تتغير مدة مشهد
 * معتمد حين يُولَّد صوت المشهد بعده (الإنتاج مشهدًا مشهدًا)؛ الفحص يقيس الصمت الفعلي بسماح فرق الهامش.
 */
export const renderBoundaries = (
  seq: SeqItem[],
  scene: Record<string, { speechStart: number; speechEnd: number; audioEnd: number }>,
  policy = SILENCE_POLICY,
  opts: { assumedLead?: number } = {},
): { boundaries: Record<string, Boundary>; gaps: GapCheck[] } => {
  const boundaries: Record<string, Boundary> = {};
  const gaps: GapCheck[] = [];
  // رأس كل مشهد منطوق يلي بطاقة آية مباشرة
  const pre: Record<string, number> = {};
  seq.forEach((it, i) => {
    const prev = seq[i - 1];
    if (it.kind === "narration" && prev?.kind === "verse") {
      const s = scene[it.id];
      if (s) pre[it.id] = Math.max(0, policy.afterVerse - s.speechStart);
    }
  });
  seq.forEach((it, i) => {
    if (it.kind !== "narration") return;
    const s = scene[it.id];
    if (!s) return;
    const p = pre[it.id] ?? 0;
    const minTail = Math.max(policy.exitMin[it.exit], s.audioEnd - s.speechEnd);
    const nx = seq[i + 1];
    let tail: number;
    let owner: GapCheck["owner"];
    let expected: number;
    if (!nx) {
      tail = Math.max(minTail, it.designTail);
      owner = "end";
      expected = tail;
    } else if (nx.kind === "card") {
      tail = minTail;
      owner = "chapter-card";
      expected = minTail;
    } else if (nx.kind === "verse") {
      tail = Math.max(policy.beforeVerse, minTail);
      owner = "verse-lead";
      expected = Math.max(policy.beforeVerse, minTail);
    } else {
      const actual = scene[nx.id] ? scene[nx.id]!.speechStart + (pre[nx.id] ?? 0) : 0;
      const lead = opts.assumedLead ?? actual;
      tail = Math.max(minTail, it.designTail - lead);
      owner = "scene-tail";
      expected = Math.max(it.designTail, minTail + lead) + (scene[nx.id] ? actual - lead : 0);
    }
    const seconds = p + s.speechEnd + tail;
    boundaries[it.id] = { pre: p, tail, seconds };
    const nextLead = nx && nx.kind === "narration" && scene[nx.id] ? scene[nx.id]!.speechStart + (pre[nx.id] ?? 0) : 0;
    // (الذيل مبني على الهامش المفترض؛ الصمت الفعلي = الذيل + هامش التالي الفعلي)
    // الصمت إلى مشهد لم يُسجَّل بعد لا يُقاس (يُقاس حين يُركَّب)
    if (!(nx?.kind === "narration" && !scene[nx.id])) gaps.push({ from: it.id, to: nx?.id ?? "", owner, value: tail + nextLead, expected });
    // بعد التلاوة: من نهاية البطاقة إلى أول كلام
    if (seq[i - 1]?.kind === "verse") gaps.push({ from: seq[i - 1]!.id, to: it.id, owner: "verse-trail", value: p + s.speechStart, expected: Math.max(policy.afterVerse, s.speechStart) });
  });
  return { boundaries, gaps };
};

/** المخالفات: صمت مختلف عن قيمة مالكه الواحدة */
export const boundaryProblems = (gaps: GapCheck[]) =>
  gaps.filter((g) => Math.abs(g.value - g.expected) > 1e-6).map((g) => `${g.from}→${g.to}: ${g.value.toFixed(3)} ث والمتوقع ${g.expected.toFixed(3)} (${g.owner})`);

/** WAV أحادي 16 بت من عينات بين −1 و1 */
export const encodeWav = (s: Float32Array, rate: number): Uint8Array => {
  const b = new Uint8Array(44 + s.length * 2);
  const v = new DataView(b.buffer);
  const w = (o: number, t: string) => [...t].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + s.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, s.length * 2, true);
  for (let i = 0; i < s.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, s[i]!)) * 32767), true);
  return b;
};
