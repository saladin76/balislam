/**
 * D254 (طلب المالك ٢٨ نوفمبر): أداة ثابتة لملفات النطق مع مدقق النطق الخارجي، بلا تعديل يدوي من المنسّق.
 *
 * ١) الطلب: `للمراجعة/النطق/طلب-<القناة>-<الحلقة>.md` — تعليمات الرد في أوله، ثم جملة في كل سطر:
 *    `المعرّف | النص كما في السكريبت | التشكيل الحالي المرسل للصوت`. المعرّف `<المشهد>.<ترتيب الجملة>` من تقسيم الاستوديو
 *    نفسه (splitNarration)، فيبقى ثابتًا ما بقي النص. الآيات لا تدخل الملف أبدًا (جملة الآية، وما بين ﴿ ﴾). ثم كلمات القاموس
 *    الموجودة في الحلقة.
 * ٢) الرد: `رد-<القناة>-<الحلقة>.md` بالسطور نفسها والعمود الثالث التشكيل النهائي، وجدول «كتابات بديلة» وجدول «إضافات القاموس».
 * ٣) الاستيراد يفحص قبل القبول: المعرّفات نفسها وعددها، والنص بلا تشكيل يطابق السكريبت حرفًا إلا كلمات جدول الكتابات البديلة.
 *    عند الفشل يُرفض كله، ويُكتب رد جاهز للمدقق بالسطور الخطأ وحدها. وعند النجاح يصير tashkeel.md للحلقة (بعد نسخة احتياطية)،
 *    وتُضاف الكتابات البديلة والإضافات إلى القاموس الثابت.
 * ٤) القاموس الثابت `pronunciation/قاموس-النطق.md` واحد للقنوات الثلاث، يُطبَّق على كل توليد (loadLexicon يدمجه).
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { splitNarration, kindOf } from "./sentences";
import { buildTashkeelIndex, normWord, stripTashkeel, vowelize, type TashkeelIndex } from "./tashkeel";
import type { LexiconEntry } from "./lexicon";
import { lexiconSay } from "./pronunciationRules";
import type { Plan } from "../plan/types";

export const SHARED_LEXICON_REL = path.join("pronunciation", "قاموس-النطق.md");
const QURAN = /[﴿﴾]/;
const coreOf = (w: string) => w.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "");
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const cell = (s: string) => s.replace(/\|/g, "¦").replace(/\s+/g, " ").trim();

// ── القاموس الثابت (Markdown: | الكلمة | النطق | ملاحظة |) ──
export const parseSharedLexicon = (md: string): LexiconEntry[] => {
  const out: LexiconEntry[] = [];
  for (const line of md.split("\n")) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*$/);
    if (!m || /^-+$/.test(m[1]!) || m[1] === "الكلمة") continue;
    if (QURAN.test(m[1]! + m[2]!)) continue;
    const word = coreOf(m[1]!), say = m[2]!.trim();
    if (!word || !say) continue;
    out.push({ word, say, at: "", ...(m[3]?.trim() ? { note: m[3]!.trim() } : {}) });
  }
  return out;
};
export const serializeSharedLexicon = (entries: LexiconEntry[]) =>
  "# قاموس النطق (للقنوات الثلاث)\n\nيُطبَّق على كل توليد صوت (النص المرسل وحده؛ الشاشة والترجمة كما هما). لا كلمة من آية.\n\n| الكلمة | النطق | ملاحظة |\n|---|---|---|\n" +
  entries.map((e) => `| ${cell(e.word)} | ${cell(e.say)} | ${cell(e.note ?? "")} |`).join("\n") + "\n";
export const sharedLexiconFile = (root: string) => path.join(root, SHARED_LEXICON_REL);
export const loadSharedLexicon = async (root: string): Promise<LexiconEntry[]> =>
  existsSync(sharedLexiconFile(root)) ? parseSharedLexicon(await readFile(sharedLexiconFile(root), "utf8")) : [];

// ── الطلب ──
export type ExchangeRow = { id: string; text: string; voiced: string };
/** جمل الراوي في الحلقة (بلا آيات) بمعرّف ثابت ونص التشكيل المرسل الآن (tashkeel.md ثم القاموس) */
export const exchangeRows = (plan: Plan, tk: TashkeelIndex | null, lex: LexiconEntry[]): ExchangeRow[] => {
  const rows: ExchangeRow[] = [];
  for (const c of plan.chapters) for (const s of c.scenes) {
    if (!s.narration?.trim() || s.template === "verse-card") continue;
    splitNarration(s.narration).forEach((text, k) => {
      if (kindOf(text) !== "narration" || QURAN.test(text)) return;
      const ws = words(text);
      const v = tk ? vowelize(ws, tk) : ws.map(() => undefined);
      const voiced = ws.map((w, i) => {
        const base = v[i] ?? w;
        const say = lexiconSay(w, lex)?.say;
        return say ? `${w.match(/^[\p{P}\p{S}]+/u)?.[0] ?? ""}${say}${w.match(/[\p{P}\p{S}]+$/u)?.[0] ?? ""}` : base;
      }).join(" ");
      rows.push({ id: `${s.id}.${k + 1}`, text: text.trim(), voiced });
    });
  }
  return rows;
};

export const REPLY_INSTRUCTIONS = `## تعليمات الرد (اتبعها بالضبط)
- أعد الملف نفسه باسم \`رد-<القناة>-<الحلقة>.md\`، بالسطور نفسها وبالترتيب نفسه وبالعدد نفسه.
- كل سطر: \`المعرّف | النص كما في السكريبت | التشكيل النهائي\`. لا تغيّر المعرّف ولا العمود الثاني أبدًا.
- العمود الثالث هو النص نفسه حرفًا بحرف مع التشكيل الصحيح للنطق. **ممنوع** تغيير أي حرف أو كلمة، أو إضافة كلمة أو حذفها، أو تغيير الترقيم.
- الكلمة التي لا تُنطق صحيحًا إلا بكتابة مختلفة الحروف: اكتبها في العمود الثالث بكتابتها البديلة، **وسجّلها** في جدول «كتابات بديلة» تحت السطور.
- لا آيات في هذا الملف، ولا تضف أي آية أو لفظ آية.
- تحت السطور جدولان فقط:
  - \`## كتابات بديلة\` ثم \`| الكلمة في السكريبت | الكتابة البديلة |\`
  - \`## إضافات القاموس\` ثم \`| الكلمة | النطق | ملاحظة |\` (كلمات تتكرر في كل الحلقات وتستحق قاعدة ثابتة)
- مثال سطرين:
\`c1-s3.1 | وكان أول من قرّب القربان | وَكَانَ أَوَّلَ مَنْ قَرَّبَ الْقُرْبَانَ\`
\`c1-s3.2 | ثم وقف أمام ما صنع. | ثُمَّ وَقَفَ أَمَامَ مَا صَنَعَ.\`
`;

export const buildRequest = (channel: string, episode: string, rows: ExchangeRow[], lex: LexiconEntry[]): string => {
  const inEp = new Set(rows.flatMap((r) => words(r.text).map(coreOf)));
  const dict = lex.filter((e) => inEp.has(e.word) || [...inEp].some((w) => normWord(w) === normWord(e.word)));
  return `# طلب تدقيق النطق — ${channel} ${episode}\n\n${REPLY_INSTRUCTIONS}\n## السطور (${rows.length})\n\n` +
    rows.map((r) => `${r.id} | ${cell(r.text)} | ${cell(r.voiced)}`).join("\n") +
    `\n\n## كلمات القاموس الموجودة في الحلقة (للعلم)\n\n| الكلمة | النطق | ملاحظة |\n|---|---|---|\n` +
    dict.map((e) => `| ${cell(e.word)} | ${cell(e.say)} | ${cell(e.note ?? "")} |`).join("\n") + "\n";
};

// ── الرد ──
export type ParsedReply = { rows: ExchangeRow[]; alternates: { word: string; alt: string }[]; additions: LexiconEntry[] };
export const parseReply = (md: string): ParsedReply => {
  const rows: ExchangeRow[] = [], alternates: { word: string; alt: string }[] = [], additions: LexiconEntry[] = [];
  let section: "rows" | "alt" | "add" | "other" = "rows";
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (/^##\s*كتابات بديلة/.test(line)) { section = "alt"; continue; }
    if (/^##\s*إضافات القاموس/.test(line)) { section = "add"; continue; }
    if (/^##\s*(كلمات القاموس|تعليمات)/.test(line)) { section = "other"; continue; }
    if (/^##\s*السطور/.test(line)) { section = "rows"; continue; }
    if (section === "rows") {
      const m = line.match(/^`?([a-z0-9-]+\.\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)`?$/);
      if (m) rows.push({ id: m[1]!, text: m[2]!.trim(), voiced: m[3]!.trim() });
    } else if (section === "alt" || section === "add") {
      const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|(?:\s*([^|]*?)\s*\|)?\s*$/);
      if (!m || /^-+$/.test(m[1]!) || /^(الكلمة|الكلمة في السكريبت)$/.test(m[1]!)) continue;
      if (section === "alt") alternates.push({ word: coreOf(m[1]!), alt: coreOf(m[2]!) });
      else additions.push({ word: coreOf(m[1]!), say: m[2]!.trim(), at: "", ...(m[3]?.trim() ? { note: m[3]!.trim() } : {}) });
    }
  }
  return { rows, alternates, additions };
};

/** فحوص القبول. يعيد أخطاء كل سطر (فارغة = مقبول) */
export const checkReply = (req: ExchangeRow[], rep: ParsedReply): { lineErrors: { id: string; why: string }[]; global: string[] } => {
  const global: string[] = [], lineErrors: { id: string; why: string }[] = [];
  if (rep.rows.length !== req.length) global.push(`عدد السطور ${rep.rows.length} والمطلوب ${req.length}.`);
  const alt = new Map(rep.alternates.map((a) => [normWord(a.word), normWord(a.alt)]));
  for (const a of [...rep.alternates, ...rep.additions.map((x) => ({ word: x.word, alt: x.say }))])
    if (QURAN.test(a.word + a.alt)) global.push(`لا كلمة من آية في الجداول: ${a.word}`);
  req.forEach((r, i) => {
    const got = rep.rows[i];
    if (!got) return;
    if (got.id !== r.id) { lineErrors.push({ id: r.id, why: `المعرّف «${got.id}» في موضع «${r.id}»` }); return; }
    if (cell(got.text) !== cell(r.text)) { lineErrors.push({ id: r.id, why: "العمود الثاني تغيّر (يجب أن يبقى نص السكريبت كما هو)" }); return; }
    if (QURAN.test(got.voiced)) { lineErrors.push({ id: r.id, why: "فيه علامة آية" }); return; }
    const a = words(r.text).map(normWord), b = words(got.voiced).map((w) => normWord(stripTashkeel(w)));
    if (a.length !== b.length) { lineErrors.push({ id: r.id, why: `عدد الكلمات ${b.length} والمطلوب ${a.length}` }); return; }
    const bad = a.map((w, k) => (w === b[k] || alt.get(w) === b[k] ? null : `«${words(r.text)[k]}» صارت «${words(got.voiced)[k]}»`)).filter(Boolean);
    if (bad.length) lineErrors.push({ id: r.id, why: `حروف تغيّرت: ${bad.join("، ")} (إن كانت كتابة بديلة فسجّلها في الجدول)` });
  });
  return { lineErrors, global };
};

/** رسالة جاهزة للمدقق بالسطور الخطأ وحدها */
export const rejectionMessage = (channel: string, episode: string, req: ExchangeRow[], res: ReturnType<typeof checkReply>) =>
  `# رد مرفوض — ${channel} ${episode}\n\nأعد هذه السطور وحدها مصحّحة بالصيغة نفسها (المعرّف | النص كما هو | التشكيل)، والتزم بتعليمات الطلب:\n\n` +
  (res.global.length ? res.global.map((g) => `- ${g}`).join("\n") + "\n\n" : "") +
  res.lineErrors.map((e) => { const r = req.find((x) => x.id === e.id)!; return `- ${e.why}\n  \`${r.id} | ${cell(r.text)} | …\``; }).join("\n") + "\n";

/** tashkeel.md الجديد: التشكيل النهائي جملة في سطر بترتيب الحلقة، والكتابات البديلة تبقى بكلمة السكريبت (تذهب للقاموس) */
export const tashkeelFromReply = (req: ExchangeRow[], rep: ParsedReply): string => {
  const alt = new Map(rep.alternates.map((a) => [normWord(a.word), normWord(a.alt)]));
  return rep.rows.map((r, i) => {
    const src = words(req[i]!.text), got = words(r.voiced);
    return got.map((w, k) => (normWord(stripTashkeel(w)) === normWord(src[k]!) ? w : src[k]!)).join(" ");
  }).join("\n") + "\n" + (alt.size ? "" : "");
};

export type ImportResult = { ok: true; tashkeel: string; added: number } | { ok: false; message: string };
export const importReply = async (o: { root: string; channel: string; episode: string; scriptPath: string; req: ExchangeRow[]; replyMd: string }): Promise<ImportResult> => {
  const rep = parseReply(o.replyMd);
  const res = checkReply(o.req, rep);
  if (res.global.length || res.lineErrors.length) return { ok: false, message: rejectionMessage(o.channel, o.episode, o.req, res) };
  const tkFile = path.join(path.dirname(o.scriptPath), "tashkeel.md");
  if (existsSync(tkFile)) await copyFile(tkFile, path.join(path.dirname(o.scriptPath), `tashkeel.backup-${new Date().toISOString().replace(/[:.]/g, "-")}.md`));
  const text = tashkeelFromReply(o.req, rep);
  await writeFile(tkFile, text);
  const shared = await loadSharedLexicon(o.root);
  const add = [...rep.alternates.map((a) => ({ word: a.word, say: a.alt, at: new Date().toISOString(), note: `كتابة بديلة (${o.channel} ${o.episode})` })),
    ...rep.additions.map((x) => ({ ...x, at: new Date().toISOString() }))];
  let added = 0;
  for (const e of add) {
    const i = shared.findIndex((x) => x.word === e.word);
    if (i >= 0) shared[i] = { ...shared[i]!, say: e.say, note: e.note ?? shared[i]!.note }; else { shared.push(e); added++; }
  }
  await mkdir(path.dirname(sharedLexiconFile(o.root)), { recursive: true });
  await writeFile(sharedLexiconFile(o.root), serializeSharedLexicon(shared));
  return { ok: true, tashkeel: tkFile, added };
};

/** تحقق سريع أن tashkeel.md المستورد يغطي كل جملة (يستعمله الاختبار والأمر) */
export const coverage = (req: ExchangeRow[], tashkeelText: string) => {
  const idx = buildTashkeelIndex(tashkeelText);
  return req.filter((r) => vowelize(words(r.text), idx).some((v) => v === undefined)).map((r) => r.id);
};
