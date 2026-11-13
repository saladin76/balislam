/**
 * «النطق» لكل جملة راوٍ (طلب صاحب المشروع ١٣ نوفمبر، D131؛ في القنوات الثلاث): النص المرسل إلى الصوت للجملة كلها،
 * بتشكيله، يكتبه المالك بنفسه بدل النطق الآلي (القاموس القديم والتشكيل وقاموس القناة وتصحيحات الكلمات).
 *
 * - يُحفظ في `channels/<القناة>/episodes/<الحلقة>/sentence-pronunciations.json` بجوار السكريبت: محتوى مالك يُحفظ في
 *   main (D101)، لا تحت voice/. المفتاح المشهد ونص الجملة كما كُتب، فإن تغيّر نص الجملة لم يعد النطق المكتوب يسري
 *   عليها (يعود الآلي) ولا يُرسل نطق نص قديم أبدًا.
 * - لا يغيّر نص الجملة ولا نص المشهد ولا السكريبت ولا الترجمة (كلماتها من نص الجملة): يُرسل إلى الصوت وحده.
 * - يدخل بصمة صوت الجملة: تسجيلها يصير «تحتاج توليدًا»، ولا يُولَّد شيء وحده (التوليد مدفوع وبضغطة المالك).
 * - الحراس كما هي: لا قرآن ولا بسملة ولا آية من آيات الحلقة (assertNoQuranForTts نفسه)، والتشكيل ≥ ٩٨٪ للنص المكتوب،
 *   ولا نطق لصف آية ولا بسملة.
 */
import path from "node:path";
import { readJson } from "../plan/io";
import { writeJsonAtomic } from "../io/atomicJson";
import { QuranTtsError, assertNoQuranForTts } from "./quranGuard";
import { tashkeelReport } from "./tashkeelReport";

export type SentenceSay = { scene: string; text: string; say: string; at: string };
export type SentenceSayDoc = { _note?: string; version: 1; entries: SentenceSay[] };

export const SAY_NOTE = "نطق جمل الراوي كما كتبه المالك (D131): يُرسل إلى الصوت وحده بدل النطق الآلي؛ نص الجملة والسكريبت والترجمة كما هي. لا قرآن ولا بسملة.";
export const SAY_MAX = 1000;

const norm = (s: string) => s.trim().split(/\s+/).filter(Boolean).join(" ");

export const sayFileFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "sentence-pronunciations.json");

export const loadSays = async (scriptPath: string): Promise<SentenceSay[]> => {
  const d = await readJson<SentenceSayDoc>(sayFileFor(scriptPath)).catch(() => null);
  if (!d || !Array.isArray(d.entries)) return [];
  return d.entries.filter((e) => e && typeof e.scene === "string" && typeof e.text === "string" && typeof e.say === "string" && e.say.trim());
};

/** النطق المكتوب لهذه الجملة (مشهدها ونصها كما هو الآن)، أو لا شيء */
export const sayFor = (entries: SentenceSay[], sceneId: string, text: string): string | undefined =>
  entries.find((e) => e.scene === sceneId && norm(e.text) === norm(text))?.say;

/** فحص النطق المكتوب قبل حفظه: null إن صلح، وإلا سبب الرفض بالعربية */
export const checkSentenceSay = (say: string, verses: readonly string[] = []): string | null => {
  const s = norm(say);
  if (!s) return "اكتب نطق الجملة كما يجب أن يُرسل إلى الصوت، أو «ارجع إلى النطق الآلي».";
  if (s.length > SAY_MAX) return "النطق المكتوب أطول من الحد؛ اكتب نطق هذه الجملة وحدها.";
  if (/[\u0000-\u001f<>{}]/.test(s)) return "النطق المكتوب فيه رموز لا تُرسل إلى الصوت.";
  try { assertNoQuranForTts(s, null, { verses, source: "النطق" }); }
  catch (e) {
    if (e instanceof QuranTtsError) return `${e.message} لا يُكتب القرآن ولا البسملة في «النطق».`;
    throw e;
  }
  const r = tashkeelReport([{ id: "say", narration: s }], { plain: [], voweled: [] });
  if (!r.ok) return `التشكيل في النطق المكتوب ${Math.round(r.coverage * 1000) / 10}% وأقل من الحد ٩٨٪؛ كلمات بلا تشكيل: ${r.gaps.flatMap((g) => g.words).slice(0, 8).join("، ")}.`;
  return null;
};

/** يكتب النطق المكتوب لجملة (أو يحذفه بـ null). الفحص قبله عند المستدعي. */
export const writeSay = async (scriptPath: string, sceneId: string, text: string, say: string | null): Promise<SentenceSay[]> => {
  const all = await loadSays(scriptPath);
  const rest = all.filter((e) => !(e.scene === sceneId && norm(e.text) === norm(text)));
  const entries = say === null ? rest : [...rest, { scene: sceneId, text: norm(text), say: norm(say), at: new Date().toISOString() }];
  await writeJsonAtomic(sayFileFor(scriptPath), { _note: SAY_NOTE, version: 1, entries } satisfies SentenceSayDoc);
  return entries;
};

/**
 * خريطة الكلمات المرسلة إلى كلمات نص الجملة (للترجمة): كلمة بكلمة إن تساوى العدد، وإلا بالتناسب بالترتيب
 * (wordsForCaptions يوزّع حينها بالمدة). الترجمة دائمًا بكلمات نص الجملة لا بالنطق.
 */
export const ownerForSay = (original: string[], spoken: string[]): number[] =>
  spoken.map((_, k) => (spoken.length === original.length ? k : Math.min(original.length - 1, Math.floor((k * original.length) / Math.max(1, spoken.length)))));
