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
import { isBasmalaOnly, splitBasmala } from "./basmala";

export type TimedWord = { word: string; start: number; end: number };
/** basmala: the owner's own recording (owner decision 10 Nov, src/voice/basmala.ts), never the cloned voice. */
export type SentenceKind = "narration" | "verse" | "basmala";
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
  /** tts: وُلّد للجملة؛ scene: قُصّ من صوت المشهد القديم بتوقيت كلماته؛ split: قُصّ من تسجيل جملة قُسمت؛ fix: تسجيل سابق أُعيد نطق كلمة فيه */
  origin: "tts" | "scene" | "split" | "fix";
  tone?: string;
  /** aligned: توقيت الكلمات من محاذاة النموذج؛ estimated: مقدَّر من المدة (لا يصلح لإعادة نطق كلمة). غائب في التسجيلات القديمة */
  timing?: "aligned" | "estimated";
  /** ما أُرسل بغير كتابته (قاموس النطق للقناة أو تصحيح الجملة): «نُطقت: …» */
  spokenFixes?: { word: string; say: string }[];
  /** إعادات نطق الكلمات في هذا التسجيل (الأحدث آخرًا)، ومن أي تسجيل بُني */
  fixes?: { index: number; word: string; say: string; from: string; fragment: string; at: string }[];
};
/** تصحيح نطق كلمة في هذه الجملة وحدها: يُرسل عند كل توليد قادم لها (خارج البصمة) */
export type SentenceCorrection = { index: number; word: string; say: string };
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
  /** تصحيحات نطق كلمات هذه الجملة (من «أعد نطق الكلمة»)؛ تسري ما دامت الكلمة في موضعها */
  corrections?: SentenceCorrection[];
  /** مقاطع «أعد نطق الكلمة» المدفوعة (تبقى على القرص، نجح الوصل أم لا) */
  fragments?: { file: string; index: number; word: string; say: string; at: string; ok: boolean }[];
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
  return out.flatMap((s) => (hasQuranText(s.join(" ")) ? [s] : splitLong(s))).map((s) => s.join(" "))
    // The basmala is its own recitation item; the rest of a mixed sentence stays narration (owner, 10 Nov).
    .flatMap((t) => splitBasmala(t));
};
/** A list where every sentence that mixes the basmala with narration is split into its parts (new ids for the extra parts). */
export const splitBasmalaInList = (list: Sentence[], idOf: () => string = newSentenceId): Sentence[] =>
  list.flatMap((s) => {
    const parts = splitBasmala(s.text);
    if (parts.length <= 1) return [s.kind === kindOf(s.text) ? s : { ...s, kind: kindOf(s.text), audio: undefined, heard: undefined, takes: withTakes(s) }];
    return parts.map((text, k): Sentence => k === 0
      ? { ...s, text, kind: kindOf(text), audio: undefined, heard: undefined, takes: withTakes(s), corrections: undefined }
      : { id: idOf(), sceneId: s.sceneId, kind: kindOf(text), text, pauseAfterMs: k === parts.length - 1 ? s.pauseAfterMs : defaultPauseMs(text), ...(s.tone ? { tone: s.tone } : {}) });
  });
const withTakes = (s: Sentence) => (s.audio ? [...(s.takes ?? []), s.audio] : s.takes);

export const newSentenceId = () => `t${randomUUID().replace(/-/g, "").slice(0, 10)}`;

export const sentencesFor = (sceneId: string, narration: string, idOf: () => string = newSentenceId): Sentence[] =>
  splitNarration(narration).map((text) => ({
    id: idOf(), sceneId, kind: kindOf(text), text, pauseAfterMs: defaultPauseMs(text),
  }));

/** نص المشهد من جمله */
export const sceneNarration = (list: Sentence[]) => list.map((s) => normText(s.text)).filter(Boolean).join(" ");

const at = (list: Sentence[], id: string) => {
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) throw new Error("الجملة غير موجودة؛ حدّث الصفحة.");
  return i;
};
export const kindOf = (text: string): SentenceKind => (isBasmalaOnly(text) ? "basmala" : hasQuranText(text) ? "verse" : "narration");
const withTake = (s: Sentence, a?: SentenceAudio): SentenceAudio[] | undefined =>
  a ? [...(s.takes ?? []), a] : s.takes;

export const editSentenceText = (list: Sentence[], id: string, text: string): Sentence[] => {
  const t = normText(text);
  if (!t) throw new Error("نص الجملة فارغ؛ احذف الجملة بدل تفريغها.");
  const i = at(list, id);
  const ws = words(t);
  return list.map((s, k) => {
    if (k !== i) return s;
    const corrections = s.corrections?.filter((c) => ws[c.index] === c.word);
    return { ...s, text: t, kind: kindOf(t), corrections: corrections?.length ? corrections : undefined };
  });
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

/** حدود جملة داخل صوت مشهد واحد (لتشغيلها وحدها في الاستوديو؛ لا يُقص شيء ولا يُكتب). */
export type SceneSpan = { start: number; end: number; timing: "words" | "estimated" };
/**
 * حدود كل جملة في صوت المشهد ملفًا واحدًا: بتوقيت كلماته إن طابق عددها النص وكان متصاعدًا (الحد في منتصف
 * الوقفة بين آخر كلمة وأول التالية، والأولى من ٠ والأخيرة حتى نهاية الملف)، وإلا تقديرًا بعدد الأحرف («تقريبي»).
 */
export const sceneSpans = (clip: { words: TimedWord[]; duration: number }, texts: string[]): SceneSpan[] => {
  const total = Math.max(0, clip.duration || 0);
  const counts = texts.map((t) => words(t).length);
  const ws = clip.words ?? [];
  const n = counts.reduce((a, b) => a + b, 0);
  const sorted = ws.every((w, i) => Number.isFinite(w.start) && Number.isFinite(w.end) && (i === 0 || w.start >= ws[i - 1]!.start - 1e-6));
  if (n > 0 && ws.length === n && sorted && total > 0) {
    const out: SceneSpan[] = [];
    let k = 0, from = 0;
    counts.forEach((c, j) => {
      k += c;
      const last = j === counts.length - 1;
      const to = last ? total : c === 0 ? from : (ws[k - 1]!.end + ws[k]!.start) / 2;
      out.push({ start: from, end: Math.min(total, Math.max(from, to)), timing: "words" });
      from = Math.min(total, Math.max(from, to));
    });
    return out;
  }
  const chars = texts.map((t) => normText(t).length);
  const sum = chars.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return chars.map((c) => {
    const start = (acc / sum) * total;
    acc += c;
    return { start, end: (acc / sum) * total, timing: "estimated" as const };
  });
};

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

/** السطر الذي يراه المالك حين لا يصلح توقيت كلمات صوت المشهد لقصه */
export const NO_EXACT_TIMINGS = "لا توجد أوقات دقيقة لكلمات هذا المشهد";

/**
 * توقيت مقدَّر بطول الحروف (estimateWords في generate.ts حين لا يُرجع النموذج محاذاة): يبدأ من ٠ تمامًا،
 * وكل كلمة ٠٫٩٢ من خطوتها حتى التالية. هذا النمط لا يقع في محاذاة حقيقية.
 */
export const looksEstimated = (ws: TimedWord[]): boolean => {
  if (ws.length < 2 || Math.abs(ws[0]!.start) > 1e-6) return false;
  for (let i = 0; i < ws.length - 1; i++) {
    const step = ws[i + 1]!.start - ws[i]!.start;
    if (!(step > 0) || Math.abs((ws[i]!.end - ws[i]!.start) / step - 0.92) > 0.002) return false;
  }
  return true;
};

/**
 * هل يُقص صوت المشهد ملفًا واحدًا إلى جمله بتوقيت كلماته (بلا أي طلب مدفوع)؟ يصلح إن كان التوقيت حقيقيًا
 * (لا تقديريًا)، بعدد كلمات النص، متصاعدًا، ولكل كلمة مدة، وفي كل حد بين جملتين وقفة واضحة (cutPoints).
 */
export const sceneAdoption = (clip: { words?: TimedWord[]; duration?: number } | null | undefined, texts: string[]): { ok: true } | { ok: false; reason: string; timings: boolean } => {
  const ws = clip?.words ?? [];
  const counts = texts.map((t) => words(t).length);
  const n = counts.reduce((a, b) => a + b, 0);
  const exact = n > 0 && ws.length === n && !looksEstimated(ws) &&
    ws.every((w, i) => Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start && (i === 0 || w.start >= ws[i - 1]!.start - 1e-6));
  if (!exact) return { ok: false, reason: NO_EXACT_TIMINGS, timings: false };
  const cp = cutPoints(ws, counts);
  return cp.ok ? { ok: true } : { ok: false, reason: `لا يُقص صوت المشهد إلى جمله: ${cp.reason}`, timings: true };
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
