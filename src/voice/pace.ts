/**
 * «سرعة الإلقاء» و«الفاصل بين الجمل» (طلب المالك ١٤ نوفمبر: «عاوز اداة للتحكم في سرعة الفيديو اقدر اسرعه اكثر في الانتاج»،
 * ثم «خلي من كل نبره ٣ انواع واحده هادئ والثانية متوسط والثالثة سريعة»). النموذج الصافي: بلا قرص ولا شبكة ولا صوت.
 *
 * - السرعة بُعد مستقل عن النبرة: كل نبرة بثلاث سرعات «هادئ» (×0.93) و«متوسط» (سرعة النبرة كما هي، الافتراضي)
 *   و«سريع» (×1.15)، معاملًا فوق سرعة النبرة نفسها التي وُلّد بها التسجيل. لا تدخل بصمة التسجيل ولا طلب الصوت: تُطبَّق
 *   بعد التوليد مدًّا زمنيًا يحفظ طبقة الصوت على التسجيلات القائمة (مجانًا، بلا توليد).
 * - الأسبقية: الجملة ← المشهد ← الحلقة ← «متوسط». والفاصل للحلقة كلها: «عادي» / «أقصر» / «الأقصر».
 * - لا يُمد ولا يُقص أبدًا: التلاوة ومشهد الآية، والبسملة (تسجيل المالك) والفاصل حولها، ومشاهد السكون المقصود
 *   (تمهيد الآية، ولقطات ذكر الله): تبقى كما هي حرفًا (القاعدة الثانية).
 */
import { createHash } from "node:crypto";
import type { PlanScene } from "../plan/types";

export { SPEEDS, PAUSES, speedIds, pauseIds, isSpeed, isPause, DEFAULT_SPEED, DEFAULT_PAUSE, type SpeedId, type PauseId } from "./paceOptions";
import { SPEEDS, PAUSES, isSpeed, isPause, DEFAULT_SPEED, DEFAULT_PAUSE, type SpeedId, type PauseId } from "./paceOptions";

// الثوابت والاستثناء الصافية في paceCore.ts (يقرؤها الرندر أيضًا لوصل المشاهد، src/plan/seams.ts)
export { MIN_GAP, MIN_TAIL, MIN_SCENE_TAIL, MARGIN, keepOf, paceExemption, pausedGap } from "./paceCore";
import { MIN_GAP, MIN_TAIL, MIN_SCENE_TAIL, MARGIN, keepOf, paceExemption } from "./paceCore";

/** pace.json بجوار السكريبت: محتوى المالك (D101). الجمل بمشهدها ونصها، كـ«النطق» (D131). */
export type PaceDoc = {
  _note?: string;
  version: 1;
  episode?: { speed?: SpeedId; pause?: PauseId };
  scenes?: Record<string, SpeedId>;
  sentences?: { scene: string; text: string; speed: SpeedId; at?: string }[];
};
export const PACE_NOTE = "سرعة الإلقاء والفاصل بين الجمل (طلب المالك ١٤ نوفمبر): تُطبَّق بعد التوليد على التسجيلات القائمة بلا توليد؛ التلاوة والبسملة والسكون المقصود كما هي.";
export const emptyPace = (): PaceDoc => ({ version: 1 });

const norm = (s: string) => s.trim().split(/\s+/).filter(Boolean).join(" ");

/** يقبل الملف كما هو إن صلح، ويُسقط ما لا يُفهم منه (لا يرمي) */
export const cleanPace = (raw: unknown): PaceDoc => {
  const d = (raw && typeof raw === "object" ? raw : {}) as Partial<PaceDoc>;
  const out: PaceDoc = { version: 1 };
  const ep = d.episode && typeof d.episode === "object" ? d.episode : undefined;
  if (ep && (isSpeed(ep.speed) || isPause(ep.pause)))
    out.episode = { ...(isSpeed(ep.speed) ? { speed: ep.speed } : {}), ...(isPause(ep.pause) ? { pause: ep.pause } : {}) };
  if (d.scenes && typeof d.scenes === "object") {
    const sc = Object.fromEntries(Object.entries(d.scenes).filter(([id, v]) => /^[a-z0-9][a-z0-9-]{0,70}$/.test(id) && isSpeed(v)));
    if (Object.keys(sc).length) out.scenes = sc as Record<string, SpeedId>;
  }
  if (Array.isArray(d.sentences)) {
    const ss = d.sentences.filter((e) => e && typeof e.scene === "string" && typeof e.text === "string" && norm(e.text) && isSpeed(e.speed));
    if (ss.length) out.sentences = ss.map((e) => ({ scene: e.scene, text: norm(e.text), speed: e.speed, ...(e.at ? { at: e.at } : {}) }));
  }
  return out;
};

/** أخطاء ملف pace.json (بوابة المحتوى D101): قيم غير معروفة لا تصل إلى main */
export const checkPaceDoc = (raw: unknown): string[] => {
  const errs: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return ["ليس كائن JSON."];
  const d = raw as Record<string, any>;
  if (d.version !== 1) errs.push("الإصدار غير معروف (المتوقع 1).");
  if (d.episode !== undefined) {
    if (typeof d.episode !== "object" || d.episode === null) errs.push("episode ليس كائنًا.");
    else {
      if (d.episode.speed !== undefined && !isSpeed(d.episode.speed)) errs.push(`سرعة الحلقة غير معروفة: ${String(d.episode.speed)}.`);
      if (d.episode.pause !== undefined && !isPause(d.episode.pause)) errs.push(`الفاصل غير معروف: ${String(d.episode.pause)}.`);
    }
  }
  if (d.scenes !== undefined) {
    if (typeof d.scenes !== "object" || d.scenes === null || Array.isArray(d.scenes)) errs.push("scenes ليس كائنًا.");
    else for (const [id, v] of Object.entries(d.scenes)) if (!isSpeed(v)) errs.push(`سرعة المشهد ${id} غير معروفة: ${String(v)}.`);
  }
  if (d.sentences !== undefined) {
    if (!Array.isArray(d.sentences)) errs.push("sentences ليست قائمة.");
    else for (const e of d.sentences) if (!e || typeof e.scene !== "string" || typeof e.text !== "string" || !isSpeed(e.speed))
      errs.push(`سطر جملة غير صالح في ${String(e?.scene ?? "؟")}.`);
  }
  return errs;
};

export type SpeedSource = "sentence" | "scene" | "episode" | "default";
/** سرعة جملة: الجملة ← المشهد ← الحلقة ← «متوسط» */
export const speedOf = (doc: PaceDoc, sceneId: string, text: string): { id: SpeedId; source: SpeedSource } => {
  const s = doc.sentences?.find((e) => e.scene === sceneId && norm(e.text) === norm(text))?.speed;
  if (isSpeed(s)) return { id: s, source: "sentence" };
  const sc = doc.scenes?.[sceneId];
  if (isSpeed(sc)) return { id: sc, source: "scene" };
  if (isSpeed(doc.episode?.speed)) return { id: doc.episode!.speed!, source: "episode" };
  return { id: DEFAULT_SPEED, source: "default" };
};
export const sceneSpeedOf = (doc: PaceDoc, sceneId: string): { id: SpeedId; source: Exclude<SpeedSource, "sentence"> } => {
  const sc = doc.scenes?.[sceneId];
  if (isSpeed(sc)) return { id: sc, source: "scene" };
  if (isSpeed(doc.episode?.speed)) return { id: doc.episode!.speed!, source: "episode" };
  return { id: DEFAULT_SPEED, source: "default" };
};
export const pauseOf = (doc: PaceDoc): PauseId => (isPause(doc.episode?.pause) ? doc.episode!.pause! : DEFAULT_PAUSE);

export type PaceSentence = { words: number; factor: number; exempt: boolean };
export type ScenePace = { key: string; sentences: PaceSentence[]; pause: number; exempt: string | null };

/**
 * ما يطلبه الإعداد لمشهد: معامل كل جملة (البسملة ١ ومعفاة، والآية داخل التعليق ١)، ومعامل الفاصل، والمفتاح.
 * المفتاح "" = لا تغيير (الصوت كما وُلّد: «متوسط» و«عادي») — فلا يتغير مشهد قائم حتى يختار المالك سرعة أو فاصلًا.
 */
export const scenePace = (doc: PaceDoc, scene: PlanScene, next: PlanScene | undefined,
  list: { text: string; kind: "narration" | "verse" | "basmala" }[], wordsOf: (t: string) => number): ScenePace => {
  const exempt = paceExemption(scene, next);
  const sentences = list.map((s) => {
    const isExempt = Boolean(exempt) || s.kind !== "narration";
    return { words: wordsOf(s.text), factor: isExempt ? 1 : SPEEDS[speedOf(doc, scene.id, s.text).id].factor, exempt: isExempt };
  });
  const pause = exempt ? 1 : PAUSES[pauseOf(doc)].factor;
  const identity = sentences.every((s) => s.factor === 1) && pause === 1;
  const key = identity ? "" : createHash("sha1").update(JSON.stringify({ v: 1, s: sentences.map((s) => [s.words, s.factor, s.exempt ? 1 : 0]), p: pause })).digest("hex").slice(0, 16);
  return { key, sentences, pause, exempt };
};

// ── خطة المد والتقصير لملف صوت واحد (صافية: تُحسب بها المدة التقديرية ويُبنى بها الملف) ─────────────────────────

export type TimedWord = { word: string; start: number; end: number };
/** قطعة من الملف الأصلي: تُنسخ كما هي (head)، أو تُمد بمعاملها (speech)، أو صمت يُقصَّر (gap/tail) */
export type PacePiece =
  | { kind: "head"; from: number; to: number }
  | { kind: "speech"; from: number; to: number; factor: number; sentence: number }
  | { kind: "gap" | "tail"; from: number; to: number; keep: number };
export type PacePlan = { pieces: PacePiece[]; uniform: boolean };

const r4 = (x: number) => Math.round(x * 10000) / 10000;

/**
 * يقسم الملف عند حدود الجمل بتوقيت كلماته (عدد الكلمات = مجموع كلمات الجمل)، ويمد كلام كل جملة بمعاملها، ويقصّر
 * الصمت بين جملتين (من وسطه) وبعد آخر كلمة بمعامل الفاصل. البداية قبل أول كلمة تُنسخ كما هي (رأس المشهد، ومنه صمت
 * ما بعد الآية في دفاتر الزمن). الفاصل الملاصق لجملة معفاة (البسملة) لا يُقصَّر. إن لم يطابق عدد الكلمات: مد واحد للكلام
 * كله بمتوسط المعاملات (موزونًا بالكلمات)، وتقصير ما بعد آخر كلمة فقط.
 */
export const planPace = (clip: { duration: number; words: TimedWord[] }, sentences: PaceSentence[], pause: number): PacePlan => {
  const D = clip.duration;
  const ws = clip.words.filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end));
  const total = sentences.reduce((a, s) => a + s.words, 0);
  if (!ws.length) {
    const f = mean(sentences);
    return { pieces: f === 1 ? [{ kind: "head", from: 0, to: D }] : [{ kind: "speech", from: 0, to: D, factor: f, sentence: 0 }], uniform: true };
  }
  const clampT = (x: number) => Math.max(0, Math.min(D, x));
  const pieces: PacePiece[] = [];
  const firstStart = clampT(ws[0]!.start);
  const lastEnd = clampT(Math.max(...ws.map((w) => w.end)));
  const head = Math.max(0, firstStart - MARGIN);
  if (head > 0) pieces.push({ kind: "head", from: 0, to: head });
  const lastExempt = sentences[sentences.length - 1]?.exempt ?? false;
  const tailFrom = Math.min(D, lastEnd + MARGIN);
  if (total !== ws.length || sentences.length === 0) {
    pieces.push({ kind: "speech", from: head, to: tailFrom, factor: mean(sentences), sentence: 0 });
    if (D > tailFrom) pieces.push({ kind: "tail", from: tailFrom, to: D, keep: keepOf(D - tailFrom, pause, MIN_TAIL) });
    return { pieces: merge(pieces), uniform: true };
  }
  let at = head;
  let w = 0;
  sentences.forEach((s, k) => {
    const last = ws[w + s.words - 1]!;
    w += s.words;
    const next = sentences[k + 1];
    if (!next) {
      pieces.push({ kind: "speech", from: at, to: Math.max(at, tailFrom), factor: s.factor, sentence: k });
      return;
    }
    const e = clampT(last.end), st = clampT(ws[w]!.start);
    const g = Math.max(0, st - e);
    const m = Math.min(MARGIN, g / 2);
    const gapFrom = e + m, gapTo = st - m;
    pieces.push({ kind: "speech", from: at, to: Math.max(at, gapFrom), factor: s.factor, sentence: k });
    if (gapTo > gapFrom) {
      const f = s.exempt || next.exempt ? 1 : pause;
      pieces.push({ kind: "gap", from: gapFrom, to: gapTo, keep: keepOf(gapTo - gapFrom, f, MIN_GAP) });
    }
    at = Math.max(gapTo, gapFrom);
  });
  if (D > tailFrom) pieces.push({ kind: "tail", from: tailFrom, to: D, keep: keepOf(D - tailFrom, lastExempt ? 1 : pause, MIN_TAIL) });
  return { pieces: merge(pieces), uniform: false };
};

const mean = (ss: PaceSentence[]) => {
  const n = ss.reduce((a, s) => a + s.words, 0);
  if (!n) return ss.length ? ss.reduce((a, s) => a + s.factor, 0) / ss.length : 1;
  return r4(ss.reduce((a, s) => a + s.factor * s.words, 0) / n);
};
/** قطعتا كلام متجاورتان بمعامل واحد تُدمجان (مد واحد أنعم) */
const merge = (ps: PacePiece[]): PacePiece[] => {
  const out: PacePiece[] = [];
  for (const p of ps) {
    if (p.to - p.from <= 1e-6) continue;
    const prev = out[out.length - 1];
    if (prev && prev.kind === "speech" && p.kind === "speech" && prev.factor === p.factor && Math.abs(prev.to - p.from) < 1e-6) {
      out[out.length - 1] = { ...prev, to: p.to };
      continue;
    }
    out.push(p);
  }
  return out;
};

/** طول كل قطعة بعد التطبيق (المخطط له؛ الملف الحقيقي يعطي طوله الفعلي) */
export const plannedLength = (p: PacePiece): number =>
  p.kind === "head" ? p.to - p.from : p.kind === "speech" ? (p.to - p.from) / p.factor : p.keep;

/**
 * يحوّل زمنًا في الملف الأصلي إلى زمنه في الملف الجديد، بأطوال القطع الفعلية (أو المخطط لها).
 * داخل صمت مُقصَّر: نصفه الأول من بدايته ونصفه الثاني من نهايته.
 */
export const timeMap = (plan: PacePlan, lengths: number[] = plan.pieces.map(plannedLength)) => (t: number): number => {
  let out = 0;
  for (const [i, p] of plan.pieces.entries()) {
    const len = lengths[i]!;
    if (t <= p.to + 1e-9 || i === plan.pieces.length - 1) {
      const x = Math.max(0, Math.min(p.to - p.from, t - p.from));
      const span = p.to - p.from;
      if (p.kind === "gap" || p.kind === "tail") {
        const half = len / 2;
        const y = p.kind === "tail" ? Math.min(x, len) : x <= span / 2 ? Math.min(x, half) : len - Math.min(span - x, half);
        return out + y;
      }
      return out + (span > 0 ? (x / span) * len : 0);
    }
    out += len;
  }
  return out;
};

export type PacedTimes = { duration: number; words: TimedWord[]; map: (t: number) => number };
/** المدة والكلمات بعد التطبيق */
export const pacedTimes = (plan: PacePlan, words: TimedWord[], lengths?: number[]): PacedTimes => {
  const map = timeMap(plan, lengths);
  const L = lengths ?? plan.pieces.map(plannedLength);
  return { duration: r4(L.reduce((a, b) => a + b, 0)), words: words.map((w) => ({ ...w, start: r4(map(w.start)), end: r4(map(w.end)) })), map };
};

/** ذيل المشهد بعد ملف صوته (config.voice.tailSeconds) بمعامل الفاصل، لا يقل عن MIN_SCENE_TAIL */
export const sceneTailFor = (base: number, pause: number) => (pause >= 1 ? base : Math.max(MIN_SCENE_TAIL, Math.round(base * pause * 1000) / 1000));
