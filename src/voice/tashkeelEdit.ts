/**
 * «النص المشكول» في الخطوة ١ (طلب المالك ١٤ نوفمبر «نفّذه الآن رغم التجميد»، D132؛ في القنوات الثلاث):
 * قراءة tashkeel.md وحفظه من الاستوديو، بتغطية التشكيل ومشكلات المطابقة مع جمل السكريبت.
 *
 * - tashkeel.md يغيّر ما يُرسل إلى الصوت وحده: نص الجملة والسكريبت والترجمة على الشاشة من script.md كما هي.
 * - الحفظ لا يولّد شيئًا: الجمل التي تغيّر نطقها تصير «تحتاج توليدًا» ببصمة صوتها نفسها (spokenOf يقرأ الملف في كل
 *   سياق جديد، src/voice/sentenceContext.ts)، ولا يُحذف تسجيل.
 * - «النطق» المكتوب لجملة (D131) يعلو على هذا الملف لتلك الجملة وحدها؛ فلا تدخل تغطيته ولا مطابقته، ولا يغيّر الملف
 *   ما يُرسل لها.
 * - tashkeel.md ليس من بصمة التجهيز (sourceNow يبصم script.md واللوحات والصوت): تعديله بعد «اعتمد التجهيز» لا يسجّل
 *   «تحديث بعد التجهيز» ولا يطلب اعتمادًا؛ يعود المشهد للمراجعة حين يُركَّب له صوت جديد، كأي توليد (D76).
 * - القرآن: الملف يحوي نص الآيات كما في السكريبت، ولا يُرسل منه شيء إلا نظير كلمة راوٍ؛ الحراس على النص المرسل كما هي.
 * - التعارض: الحفظ يحمل نسخة الملف التي فُتحت (expectedRevision)؛ إن تغيّر الملف بعدها (حفظ آخر أو تحديث آلي، D101)
 *   يُرفض الحفظ 409 ويبقى تعديل المالك في الصفحة.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { writeFileAtomic } from "../io/atomicJson";
import { checkTashkeelText, tashkeelRevision } from "./tashkeelFile";
import { buildTashkeelIndex, normWord, stripTashkeel, vowelize, type TashkeelIndex } from "./tashkeel";
import { PLAIN_OK, tashkeelReport, type TashkeelReport } from "./tashkeelReport";
import { tashkeelFileFor } from "./generate";
import { flatten, loadCtx, sayOf, voiceOf, type Ctx } from "./sentenceContext";

export { TASHKEEL_MAX_BYTES, tashkeelRevision, checkTashkeelText } from "./tashkeelFile";

const ARABIC = /[ء-ي]/;
const coreOf = (w: string) => w.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "");

/** مشكلة مطابقة: جملة سكريبت لا نظير لها في الملف، أو كلمات منها تختلف عنه بعد حذف التشكيل. */
export type TashkeelAlignment = { sceneId: string; sentence: string; problem: "missing" | "mismatch"; words: string[] };

const MARK = /[ً-ٰٟ]/;
/**
 * لكل جملة راوٍ: هل وجد الملف نظير كلماتها التي تحتاجه؟ المطابقة نفسها التي يرسل بها الصوت (vowelize). الكلمة المشكولة
 * في السكريبت نفسه لا تحتاج الملف (يملأ الملف ما لم يكتبه المالك فقط، pronunciationRules)، ولا الحرف الذي لا يلتبس نطقه؛
 * فجملة مشكولة كلها في السكريبت لا مشكلة مطابقة لها ولو اختلف الملف. «missing»: لم تُطابق أي كلمة محتاجة،
 * «mismatch»: طابق بعضها وبقيت كلمات بلا نظير (تختلف حروفها في الملف أو حُذفت منه). الكلمة الموجودة في الملف بلا
 * تشكيل ليست مشكلة مطابقة؛ مكانها تقرير التغطية.
 */
export const tashkeelAlignment = (sentences: { sceneId: string; text: string }[], idx: TashkeelIndex | null): TashkeelAlignment[] => {
  if (!idx) return [];
  const out: TashkeelAlignment[] = [];
  for (const s of sentences) {
    const ws = s.text.trim().split(/\s+/).filter(Boolean);
    const v = vowelize(ws, idx);
    const needy = ws.map((w, i) => ({ w: coreOf(w), i }))
      .filter(({ w }) => ARABIC.test(w) && normWord(w) && !MARK.test(w) && !PLAIN_OK.has(normWord(w)));
    if (!needy.length) continue;
    const lost = needy.filter(({ i }) => v[i] === undefined).map(({ w }) => stripTashkeel(w));
    if (!lost.length) continue;
    out.push({ sceneId: s.sceneId, sentence: s.text.trim(), problem: lost.length === needy.length ? "missing" : "mismatch", words: lost });
  }
  return out;
};

export type TashkeelState = {
  exists: boolean;
  text: string;
  revision: string;
  /** التغطية لجمل الراوي التي يُرسل لها هذا الملف (بلا الآيات والبسملة وما له «النطق» مكتوبًا) */
  report: TashkeelReport;
  alignment: TashkeelAlignment[];
  /** جمل لها «النطق» مكتوبًا (D131): يُرسل نطقها كما كُتب، فلا يغيّرها هذا الملف */
  saySentences: number;
  /** دفاتر الزمن: خريطة النبرة بُنيت على نسخة مشكولة أخرى (توليد المشهد كاملًا يرفضها؛ الجمل تُولَّد كالمعتاد) */
  toneMapStale: boolean;
};

const readText = async (file: string) => (existsSync(file) ? readFile(file, "utf8") : null);

/** جمل الراوي التي يقرأ لها الصوتُ هذا الملف */
const ownSentences = (ctx: Ctx) => {
  const flat = flatten(ctx).filter((f) => f.s.kind === "narration");
  const said = flat.filter((f) => sayOf(ctx, f.s));
  return { flat, said: said.length, read: flat.filter((f) => !sayOf(ctx, f.s)) };
};

const toneMapStaleFor = async (scriptPath: string, text: string | null) => {
  const { isPartsChannel, toneMapFileFor } = await import("./dafatirParts");
  if (text === null || !isPartsChannel(scriptPath) || !existsSync(toneMapFileFor(scriptPath))) return false;
  try {
    const map = JSON.parse(await readFile(toneMapFileFor(scriptPath), "utf8")) as { source?: { tashkeel?: { sha256?: string } } };
    const want = map.source?.tashkeel?.sha256;
    return Boolean(want && want !== createHash("sha256").update(text).digest("hex"));
  } catch { return false; }
};

/** التقرير والمطابقة لنص معيّن (المحفوظ، أو ما يكتبه المالك الآن قبل حفظه) */
export const tashkeelStateFor = async (ctx: Ctx, text: string | null): Promise<Omit<TashkeelState, "exists" | "text" | "revision">> => {
  const idx = text === null ? null : buildTashkeelIndex(text);
  const { read, said } = ownSentences(ctx);
  const byScene = new Map<string, string[]>();
  for (const f of read) byScene.set(f.scene.id, [...(byScene.get(f.scene.id) ?? []), f.s.text]);
  const dict = { entries: [...(ctx.speech.dict.entries ?? []), ...ctx.lexicon.map((e) => ({ text: e.word, say: e.say }))] };
  const report = tashkeelReport([...byScene].map(([id, ts]) => ({ id, narration: ts.join(" ") })), idx, dict);
  return { report, alignment: tashkeelAlignment(read.map((f) => ({ sceneId: f.scene.id, text: f.s.text })), idx), saySentences: said,
    toneMapStale: await toneMapStaleFor(ctx.scriptPath, text) };
};

export const readTashkeel = async (episode: string): Promise<TashkeelState> => {
  const ctx = await loadCtx(episode);
  const text = await readText(tashkeelFileFor(ctx.scriptPath));
  return { exists: text !== null, text: text ?? "", revision: tashkeelRevision(text), ...(await tashkeelStateFor(ctx, text)) };
};

/** نص يكتبه المالك ولم يُحفظ: التقرير والمطابقة وحدهما (لا يُكتب شيء) */
export const checkTashkeelDraft = async (episode: string, text: string) => tashkeelStateFor(await loadCtx(episode), text);

export class TashkeelStaleError extends Error {
  readonly code = "TASHKEEL_REVISION_STALE";
  readonly status = 409;
  constructor(readonly current: { exists: boolean; text: string; revision: string }) {
    super("تغيّرت النسخة المشكولة على هذا الجهاز بعد أن فتحتها (حفظ آخر أو تحديث). تعديلك باقٍ هنا؛ اختر: احفظه فوقها، أو افتح النسخة المحفوظة.");
  }
}
export class TashkeelInputError extends Error {
  readonly status = 400;
}

export type TashkeelSaveResult = TashkeelState & {
  /** جمل راوٍ تغيّر ما يُرسل لها إلى الصوت */
  changedSentences: number;
  /** تسجيلات كانت حالية وصارت «تحتاج توليدًا» (لا يُولَّد شيء ولا يُحذف) */
  staleTakes: number;
};

/**
 * يحفظ tashkeel.md (أو ينشئه من script.md بـ fromScript، إن لم يوجد). لا يولّد ولا يحذف ولا يلمس السكريبت ولا الخطة
 * ولا سجل الاعتماد.
 */
export const saveTashkeel = async (episode: string, b: { text?: unknown; fromScript?: unknown; expectedRevision?: unknown }): Promise<TashkeelSaveResult> => {
  const scriptPath = await resolveScriptPath(episode);
  const file = tashkeelFileFor(scriptPath);
  const current = await readText(file);
  if (typeof b.expectedRevision !== "string" || b.expectedRevision !== tashkeelRevision(current))
    throw new TashkeelStaleError({ exists: current !== null, text: current ?? "", revision: tashkeelRevision(current) });
  let text: string;
  if (b.fromScript === true) {
    if (current !== null) throw new TashkeelInputError("النسخة المشكولة موجودة بالفعل؛ عدّلها هنا بدل إنشائها من جديد.");
    text = await readFile(scriptPath, "utf8");
  } else {
    if (typeof b.text !== "string") throw new TashkeelInputError("نص غير صالح.");
    text = b.text.replace(/\r\n?/g, "\n");
  }
  if (!text.endsWith("\n")) text += "\n";
  const bad = checkTashkeelText(text);
  if (bad.length) throw new TashkeelInputError(bad.join(" "));

  const before = await loadCtx(episode);
  const after: Ctx = { ...before, speech: { ...before.speech, tk: buildTashkeelIndex(text) } };
  let changedSentences = 0, staleTakes = 0;
  for (const f of ownSentences(before).flat) {
    const a = voiceOf(before, f.scene, f.list, f.s), z = voiceOf(after, f.scene, f.list, f.s);
    if (a.send.text !== z.send.text) changedSentences++;
    if (f.s.audio && f.s.audio.fingerprint === a.fingerprint && f.s.audio.fingerprint !== z.fingerprint) staleTakes++;
  }
  await writeFileAtomic(file, text);
  return { exists: true, text, revision: tashkeelRevision(text), ...(await tashkeelStateFor(after, text)), changedSentences, staleTakes };
};
