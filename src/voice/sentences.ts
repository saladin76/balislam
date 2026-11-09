/**
 * الصوت جملةً جملة (قرار صاحب المشروع، ٩ نوفمبر، D50) — النموذج الصافي بلا قرص ولا شبكة.
 *
 * تعليق كل مشهد يُقسم آليًا إلى جمل عند علامات نهاية الجملة (. ؟ ! … : ؛ ;)، ولا يُقطع نص قرآني
 * بين ﴿ ﴾ ولا ما بين [ ]. الجملة الطويلة جدًا (فوق LONG_WORDS كلمة) تُقسم عند الفاصلة الأقرب لوسطها.
 * كل جملة داخل مشهدها دائمًا؛ ونص المشهد = نصوص جمله موصولة بمسافة (فالترجمة كلمة بكلمة كما هي).
 * المعرّفات ثابتة: التقسيم يُبقي معرّف الأولى، والدمج يُبقي معرّف الأولى، والحذف لا يغيّر غيره.
 * التسجيلات المدفوعة لا تُرمى: الدمج والاستبدال يحفظان التسجيل السابق في takes.
 */
import { createHash, randomUUID } from "node:crypto";
import type { Tone } from "./tones";

export type TimedWord = { word: string; start: number; end: number };
export type SentenceKind = "narration" | "verse";
export type SentenceAudio = {
  /** في voice/sentences/ */
  file: string;
  /** بصمة ما يغيّر صوت الجملة نفسها: النطق المرسل، الصوت والنموذج، الإعدادات، النبرة */
  fingerprint: string;
  /** بصمة الجارتين (previous_text / next_text) لحظة التوليد: تغيّرها تنبيه لا يُبطل التسجيل */
  context: string;
  duration: number;
  /** كلمات نص الجملة (للترجمة) بزمن ملفها */
  words: TimedWord[];
  at: string;
  /** tts: وُلّد للجملة؛ scene: قُصّ من صوت المشهد القديم بتوقيت كلماته؛ split: قُصّ من تسجيل جملة قُسمت */
  origin: "tts" | "scene" | "split";
  tone?: string;
};
export type Sentence = {
  id: string;
  sceneId: string;
  kind: SentenceKind;
  text: string;
  /** نبرة صريحة لهذه الجملة؛ بلا قيمة = ترث المشهد ثم الحلقة ثم القناة (أو جزء خريطة النبرة) */
  tone?: Tone;
  pauseAfterMs: number;
  audio?: SentenceAudio;
  /** تسجيلات سابقة لهذه الجملة (الأحدث آخرًا): لا يُحذف تسجيل مدفوع */
  takes?: SentenceAudio[];
  /** «سمعتها»: الملف والبصمة اللذان سمعهما المالك */
  heard?: string;
};
export type SceneSentences = {
  sentences: Sentence[];
  createdAt: string;
  /** صوت المشهد القديم: هل قُصّ إلى الجمل بتوقيت كلماته، ولماذا لا */
  import: { state: "imported" | "none" | "unreliable"; note?: string };
  /** ملفات صوت المشهد السابقة التي حلّ محلها التركيب من الجمل (نُقلت إلى voice/superseded/ ولم تُحذف) */
  replaced?: { file: string; hash: string; movedTo: string; at: string }[];
};
export type SentencesDoc = { version: 1; scenes: Record<string, SceneSentences> };

export const emptyDoc = (): SentencesDoc => ({ version: 1, scenes: {} });

/** جملة طويلة جدًا تُقسم عند الفاصلة الأقرب لوسطها */
export const LONG_WORDS = 30;
const MIN_PART_WORDS = 6;
const END = /[.؟?!…:؛;]["»”’)\]]*$/u;
const QURAN = /﴿|﴾|\[آية/;

export const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
export const normText = (s: string) => words(s).join(" ");
export const hasQuranText = (s: string) => QURAN.test(s);

/** وقفة افتراضية بعد الجملة بحسب علامتها */
export const defaultPauseMs = (text: string): number => {
  const t = text.trim();
  if (/[؟?!]["»”)\]]*$/u.test(t)) return 500;
  if (/[.…]["»”)\]]*$/u.test(t)) return 450;
  if (/[:؛;]["»”)\]]*$/u.test(t)) return 300;
  if (/[،,]["»”)\]]*$/u.test(t)) return 220;
  return 250;
};
export const clampPause = (ms: unknown) => Math.max(0, Math.min(3000, Math.round(Number(ms) || 0)));

const splitLong = (ws: string[]): string[][] => {
  if (ws.length <= LONG_WORDS) return [ws];
  const mid = ws.length / 2;
  let best = -1;
  ws.forEach((w, i) => {
    if (!/[،,]$/.test(w)) return;
    const cut = i + 1;
    if (cut < MIN_PART_WORDS || ws.length - cut < MIN_PART_WORDS) return;
    if (best < 0 || Math.abs(cut - mid) < Math.abs(best - mid)) best = cut;
  });
  if (best < 0) return [ws];
  return [...splitLong(ws.slice(0, best)), ...splitLong(ws.slice(best))];
};

/**
 * التقسيم الآلي: نصوص الجمل بالترتيب، وموصولةً بمسافة = نص المشهد (بمسافات موحّدة).
 * لا يُقطع داخل ﴿ ﴾ أو [ ] أو « »، فالآية المقتبسة تبقى جملة واحدة كاملة.
 */
export const splitNarration = (text: string): string[] => {
  const ws = words(text);
  const out: string[][] = [];
  let cur: string[] = [];
  let depth = 0;
  for (const w of ws) {
    cur.push(w);
    for (const ch of w) {
      if (ch === "﴿" || ch === "[" || ch === "«") depth++;
      else if (ch === "﴾" || ch === "]" || ch === "»") depth = Math.max(0, depth - 1);
    }
    if (depth === 0 && END.test(w)) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out.flatMap((s) => (hasQuranText(s.join(" ")) ? [s] : splitLong(s))).map((s) => s.join(" "));
};

export const newSentenceId = () => `t${randomUUID().replace(/-/g, "").slice(0, 10)}`;

export const sentencesFor = (sceneId: string, narration: string, idOf: () => string = newSentenceId): Sentence[] =>
  splitNarration(narration).map((text) => ({
    id: idOf(), sceneId, kind: hasQuranText(text) ? "verse" : "narration", text, pauseAfterMs: defaultPauseMs(text),
  }));

/** نص المشهد من جمله */
export const sceneNarration = (list: Sentence[]) => list.map((s) => normText(s.text)).filter(Boolean).join(" ");

const at = (list: Sentence[], id: string) => {
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) throw new Error("الجملة غير موجودة؛ حدّث الصفحة.");
  return i;
};
const kindOf = (text: string): SentenceKind => (hasQuranText(text) ? "verse" : "narration");
const withTake = (s: Sentence, a?: SentenceAudio): SentenceAudio[] | undefined =>
  a ? [...(s.takes ?? []), a] : s.takes;

export const editSentenceText = (list: Sentence[], id: string, text: string): Sentence[] => {
  const t = normText(text);
  if (!t) throw new Error("نص الجملة فارغ؛ احذف الجملة بدل تفريغها.");
  const i = at(list, id);
  return list.map((s, k) => (k === i ? { ...s, text: t, kind: kindOf(t) } : s));
};

/** يقسم الجملة بعد الكلمة رقم wordIndex (١…ن−١): الأولى تبقى بمعرّفها، والثانية جديدة. */
export const splitSentence = (list: Sentence[], id: string, wordIndex: number, newId = newSentenceId()): { list: Sentence[]; first: Sentence; second: Sentence } => {
  const i = at(list, id);
  const s = list[i]!;
  const ws = words(s.text);
  const k = Math.round(wordIndex);
  if (!(k >= 1 && k < ws.length)) throw new Error("اختر موضع التقسيم بين كلمتين داخل الجملة.");
  const a = ws.slice(0, k).join(" "), b = ws.slice(k).join(" ");
  const first: Sentence = { ...s, text: a, kind: kindOf(a), pauseAfterMs: defaultPauseMs(a), audio: undefined, takes: withTake(s, s.audio), heard: undefined };
  const second: Sentence = { id: newId, sceneId: s.sceneId, kind: kindOf(b), text: b, ...(s.tone ? { tone: s.tone } : {}), pauseAfterMs: s.pauseAfterMs };
  return { list: [...list.slice(0, i), first, second, ...list.slice(i + 1)], first, second };
};

/** يدمج الجملة مع التالية في المشهد نفسه؛ المعرّف للأولى، وتسجيلاهما يُحفظان في takes. */
export const mergeWithNext = (list: Sentence[], id: string): Sentence[] => {
  const i = at(list, id);
  const s = list[i]!, n = list[i + 1];
  if (!n || n.sceneId !== s.sceneId) throw new Error("لا جملة بعدها في هذا المشهد تُدمج معها.");
  const text = `${normText(s.text)} ${normText(n.text)}`;
  const takes = [...(s.takes ?? []), ...(s.audio ? [s.audio] : []), ...(n.takes ?? []), ...(n.audio ? [n.audio] : [])];
  const merged: Sentence = { id: s.id, sceneId: s.sceneId, kind: kindOf(text), text, ...(s.tone ? { tone: s.tone } : {}), pauseAfterMs: n.pauseAfterMs, ...(takes.length ? { takes } : {}) };
  return [...list.slice(0, i), merged, ...list.slice(i + 2)];
};

export const deleteSentence = (list: Sentence[], id: string): Sentence[] => {
  const i = at(list, id);
  if (list.filter((s) => s.sceneId === list[i]!.sceneId).length <= 1)
    throw new Error("هذه الجملة الوحيدة في المشهد؛ لا يبقى المشهد بلا تعليق من هنا. عدّل نصها بدل حذفها.");
  return list.filter((_, k) => k !== i);
};

export const addSentenceAfter = (list: Sentence[], id: string, text: string, newId = newSentenceId()): { list: Sentence[]; added: Sentence } => {
  const i = at(list, id);
  const t = normText(text);
  if (!t) throw new Error("اكتب نص الجملة الجديدة أولًا.");
  const added: Sentence = { id: newId, sceneId: list[i]!.sceneId, kind: kindOf(t), text: t, pauseAfterMs: defaultPauseMs(t) };
  return { list: [...list.slice(0, i + 1), added, ...list.slice(i + 1)], added };
};

const sha1 = (x: unknown) => createHash("sha1").update(JSON.stringify(x)).digest("hex").slice(0, 16);

/** بصمة صوت الجملة: كل ما يغيّر صوتها نفسها (كما في بصمة المشهد في generate.ts) */
export const sentenceFingerprint = (o: { spoken: string; voiceKey: string; tts: unknown; tune?: unknown; voiceId?: string }) =>
  sha1({ sentence: 1, spoken: o.spoken, voiceKey: o.voiceKey, v: o.tts, ...(o.tune ? { tune: o.tune } : {}), ...(o.voiceId ? { voice: o.voiceId } : {}) });
export const contextFingerprint = (previousText?: string, nextText?: string) => sha1({ p: previousText ?? "", n: nextText ?? "" });

export type SentenceStatus = "missing" | "generated" | "stale" | "heard";
export const heardKey = (a: SentenceAudio) => `${a.file}#${a.fingerprint}`;
export const sentenceStatus = (s: Sentence, fingerprint: string): SentenceStatus =>
  !s.audio ? "missing" : s.audio.fingerprint !== fingerprint ? "stale" : s.heard === heardKey(s.audio) ? "heard" : "generated";

/**
 * مواضع القص في تسجيل بتوقيت كلماته: بين آخر كلمة في كل جملة وأول كلمة في التالية.
 * موثوق فقط إن طابق عدد الكلمات النص، وكان التوقيت متصاعدًا، وفي كل حد وقفة حقيقية (≥ minGap):
 * التوقيت التقديري (بلا محاذاة من النموذج) لا يترك وقفة كهذه، فلا يُقص منه شيء.
 */
export const MIN_CUT_GAP = 0.12;
export const cutPoints = (clipWords: TimedWord[], counts: number[], minGap = MIN_CUT_GAP): { ok: true; cuts: number[] } | { ok: false; reason: string } => {
  const total = counts.reduce((a, b) => a + b, 0);
  if (clipWords.length !== total) return { ok: false, reason: `عدد كلمات التوقيت (${clipWords.length}) لا يطابق النص (${total}).` };
  for (let i = 1; i < clipWords.length; i++)
    if (!(clipWords[i]!.start >= clipWords[i - 1]!.start - 1e-6)) return { ok: false, reason: "توقيت الكلمات غير متصاعد." };
  const cuts: number[] = [];
  let k = 0;
  for (let j = 0; j < counts.length - 1; j++) {
    k += counts[j]!;
    const end = clipWords[k - 1]!.end, start = clipWords[k]!.start;
    if (start - end < minGap) return { ok: false, reason: `لا وقفة واضحة بين الجملتين ${j + 1} و${j + 2} في التسجيل.` };
    cuts.push((end + start) / 2);
  }
  return { ok: true, cuts };
};

/**
 * نص المشهد تغيّر من خارج الجمل (محرر المشهد): تُعاد الجمل من النص الجديد، وكل جملة بقي نصها كما هو
 * تحتفظ بمعرّفها ونبرتها ووقفتها وتسجيلها. لا يُرمى تسجيل: ما لم يعد له نص يبقى في takes أول جملة جديدة.
 */
export const reconcileScene = (list: Sentence[], sceneId: string, narration: string, idOf: () => string = newSentenceId): Sentence[] => {
  if (sceneNarration(list) === normText(narration)) return list;
  const pool = [...list];
  const next = splitNarration(narration).map((text): Sentence => {
    const k = pool.findIndex((s) => normText(s.text) === text);
    if (k >= 0) return pool.splice(k, 1)[0]!;
    return { id: idOf(), sceneId, kind: kindOf(text), text, pauseAfterMs: defaultPauseMs(text) };
  });
  const orphaned = pool.flatMap((s) => [...(s.takes ?? []), ...(s.audio ? [s.audio] : [])]);
  if (orphaned.length && next[0]) next[0] = { ...next[0], takes: [...(next[0].takes ?? []), ...orphaned] };
  return next;
};
