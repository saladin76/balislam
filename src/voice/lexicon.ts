/**
 * قاموس النطق للقناة (قرار صاحب المشروع، ٩ نوفمبر: «أعد نطق الكلمة»): channels/<القناة>/pronunciations.json.
 *
 * - كلمة كما كُتبت في النص ← كيف تُنطق (تشكيل آخر أو كتابة صوتية). يُحفظ من «احفظ هذا النطق للقناة» في «الجمل»،
 *   ويُعدَّل ويُحذف من «قاموس النطق» في «أدوات وتفاصيل». ملف نصي محفوظ في Git.
 * - يُطبَّق عند الإرسال فقط (مسار الجمل ومسار المشهد ومسار الأجزاء) على النص المرسل إلى الصوت؛ نص الجملة والترجمة
 *   على الشاشة لا يتغيران أبدًا (الترجمة تبقى بالكلمة الأصلية عبر خريطة owner).
 * - لا يدخل بصمة الصوت: إضافة كلمة لا تُبطل تسجيلًا قائمًا ولا تعيد توليد مشهد مدفوع؛ تسري على كل توليد قادم.
 *   (قاموس pronunciation.json القديم يبقى كما هو، جزءًا من البصمة.)
 * - القرآن لا يُمس: الكلمات بين ﴿ ﴾ لا يُطبَّق عليها شيء، ولا تُحفظ كلمة فيها ﴿ أو ﴾ أو من صف آية.
 */
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { channelPaths } from "../channel";
import { readJson } from "../plan/io";
import { tashkeelReport } from "./tashkeelReport";

export type LexiconEntry = { word: string; say: string; at: string; note?: string };
export type LexiconDoc = { _note?: string; entries: LexiconEntry[] };
/** تصحيح لكلمة واحدة في جملة واحدة (رقمها فيها وكلمتها كما كُتبت) */
export type WordCorrection = { index: number; word: string; say: string };
export type Applied = { index: number; word: string; say: string; source: "lexicon" | "sentence" };

export const LEXICON_NOTE = "قاموس النطق للقناة: الكلمة كما كُتبت ← كيف تُنطق. يُطبَّق على النص المرسل إلى الصوت فقط؛ النص والترجمة على الشاشة كما هما. لا يُطبَّق على نص قرآني بين ﴿ ﴾.";

export const lexiconFileFor = (channel?: string) => path.join(channelPaths(channel).dir, "pronunciations.json");

/** طرفا الكلمة من علامات الترقيم لا يمنعان المطابقة */
export const coreOf = (w: string) => w.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "");
const QURAN_MARK = /[﴿﴾]/;

export const loadLexicon = async (channel?: string): Promise<LexiconDoc> => {
  const d = await readJson<LexiconDoc>(lexiconFileFor(channel));
  if (!d || !Array.isArray(d.entries)) return { entries: [] };
  return { ...d, entries: d.entries.filter((e) => e && typeof e.word === "string" && typeof e.say === "string" && e.word && e.say) };
};

const writeAtomic = async (file: string, text: string) => {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  const fd = await open(temp, "wx", 0o644);
  try {
    try { await fd.writeFile(text); await fd.sync(); } finally { await fd.close(); }
    await rename(temp, file);
  } finally { await rm(temp, { force: true }); }
};
const saveLexicon = (doc: LexiconDoc, channel?: string) =>
  writeAtomic(lexiconFileFor(channel), JSON.stringify({ _note: doc._note ?? LEXICON_NOTE, entries: doc.entries }, null, 2) + "\n");

/** النطق المكتوب: بلا ﴿ ﴾ وبلا رموز تحكم، وتشكيله ≥ الحد (كل كلمة عربية مشكولة) */
export const checkSay = (say: string): string | null => {
  const s = say.trim().replace(/\s+/g, " ");
  if (!s) return "اكتب الكلمة كما يجب أن تُنطق.";
  if (s.length > 80) return "النطق المكتوب طويل؛ اكتب الكلمة وحدها (أو كلمتين).";
  if (QURAN_MARK.test(s) || /[\u0000-\u001f\[\]<>{}]/.test(s)) return "النطق المكتوب فيه رموز لا تُرسل إلى الصوت.";
  const r = tashkeelReport([{ id: "say", narration: s }], { plain: [], voweled: [] });
  if (!r.ok) return `اكتب التشكيل كاملًا للنطق (${r.gaps.flatMap((g) => g.words).join("، ")})؛ لا يُرسل للصوت ما سيخمّن نطقه.`;
  return null;
};
export const checkWord = (word: string): string | null => {
  const w = coreOf(word.trim());
  if (!w || /\s/.test(w) || w.length > 40) return "الكلمة غير صالحة للقاموس.";
  if (QURAN_MARK.test(word)) return "النص القرآني لا يُغيَّر نطقه أبدًا.";
  return null;
};

export const setLexiconEntry = async (word: string, say: string, note?: string, channel?: string): Promise<LexiconDoc> => {
  const bad = checkWord(word) ?? checkSay(say);
  if (bad) throw new Error(bad);
  const doc = await loadLexicon(channel);
  const w = coreOf(word.trim());
  const entry: LexiconEntry = { word: w, say: say.trim().replace(/\s+/g, " "), at: new Date().toISOString(), ...(note ? { note: note.slice(0, 300) } : {}) };
  const entries = doc.entries.some((e) => e.word === w) ? doc.entries.map((e) => (e.word === w ? entry : e)) : [...doc.entries, entry];
  const next = { ...doc, entries };
  await saveLexicon(next, channel);
  return next;
};
export const removeLexiconEntry = async (word: string, channel?: string): Promise<LexiconDoc> => {
  const doc = await loadLexicon(channel);
  const w = coreOf(word.trim());
  if (!doc.entries.some((e) => e.word === w)) throw new Error("الكلمة غير موجودة في قاموس النطق؛ حدّث الصفحة.");
  const next = { ...doc, entries: doc.entries.filter((e) => e.word !== w) };
  await saveLexicon(next, channel);
  return next;
};

/** هل الكلمة رقم i داخل ﴿ ﴾ (عدًّا على الكلمات الأصلية) */
export const quranMask = (original: string[]): boolean[] => {
  let depth = 0;
  return original.map((w) => {
    const opens = w.includes("﴿");
    if (opens) depth++;
    const inside = depth > 0;
    if (w.includes("﴾")) depth = Math.max(0, depth - 1);
    return inside;
  });
};

/**
 * يطبّق القاموس وتصحيحات الجملة على الكلمات المنطوقة (بعد قاموس pronunciation.json والتشكيل)، ويعيد بناء خريطة owner
 * فتبقى الترجمة بالكلمة الأصلية. singleToken: لمسار الأجزاء الذي يعدّ الكلمات (نطق من كلمة واحدة فقط).
 */
export const applyLexicon = (
  original: string[], spoken: string[], owner: number[], entries: LexiconEntry[],
  o: { corrections?: WordCorrection[]; singleToken?: boolean; verse?: boolean } = {},
): { spoken: string[]; owner: number[]; applied: Applied[] } => {
  if (o.verse || (!entries.length && !o.corrections?.length)) return { spoken, owner, applied: [] };
  const map = new Map(entries.map((e) => [e.word, e.say]));
  const fix = new Map((o.corrections ?? []).filter((c) => original[c.index] === c.word).map((c) => [c.index, c.say]));
  const mask = quranMask(original);
  const out: string[] = [];
  const own: number[] = [];
  const applied: Applied[] = [];
  const done = new Set<number>();
  spoken.forEach((part, k) => {
    const i = owner[k]!;
    const w = original[i] ?? "";
    const core = coreOf(w);
    const say = mask[i] ? undefined : fix.get(i) ?? map.get(core);
    if (!say || (o.singleToken && /\s/.test(say.trim()))) { out.push(part); own.push(i); return; }
    if (done.has(i)) return; // كل أجزاء الكلمة الأصلية تُستبدل مرة واحدة
    done.add(i);
    const lead = w.match(/^[\p{P}\p{S}]+/u)?.[0] ?? "";
    const trail = w.match(/[\p{P}\p{S}]+$/u)?.[0] ?? "";
    const tokens = `${lead}${say.trim()}${trail}`.split(/\s+/).filter(Boolean);
    for (const t of tokens) { out.push(t); own.push(i); }
    applied.push({ index: i, word: core, say: say.trim(), source: fix.has(i) ? "sentence" : "lexicon" });
  });
  return { spoken: out, owner: own, applied };
};
