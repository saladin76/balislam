/**
 * خطة «خط الأفق» المصمَّمة من خطة المشاهد المكتوبة (`scenes.md`) والسكريبت، لحلقات «البدايات» في «دفاتر الزمن»
 * (002–008)، بالبنية نفسها التي عليها خطة 001 المتتبَّعة في Git: كل مشهد متكلَّم `horizon-shot` بلقطته في
 * `props.shot` (لقطة `bdNN-…` المبنية، أو مشهد مكتبة `lib-*`/`verse-tag` بحقوله)، وبلا افتتاحية (`intro: false`)
 * ولا شاشة نهاية عامة (الختام لقطة من الحلقة نفسها كما في 001).
 *
 * محدَّد تمامًا (deterministic): المدخلات `script.md` و`scenes.md` وحدهما (وملف انتماء السلسلة إن وُجد)، فيُعاد
 * بناؤها بالنتيجة نفسها. لا يكتب شيئًا؛ الكتابة في الأمر `bal plan-from-scenes` (نسخة احتياطية أولًا، ورفض الكتابة
 * فوق خطة مصمَّمة إلا بتأكيد صريح).
 *
 * القواعد:
 * - نص المشهد من السكريبت حرفيًا (لا من `scenes.md`): صف الجدول يحدد المشهد ومعرّفه ولقطته وحقوله فقط. فقرة السكريبت
 *   تُنسب إلى أول صف (بالترتيب) يحتوي نصها؛ والفقرات المتتالية في الصف نفسه مشهد واحد (كما يضم صف «… » «…» فقرتين).
 * - الآيات والأحاديث كما في 001 (D242، قرار المالك ٢٨ نوفمبر): لا مشهد `verse-card` ولا `hadith-card` صامت. كل بطاقة يولّدها
 *   المحرك من السكريبت (بمعرّف صفها في الجدول بالترتيب) تُلحق بلقطة متكلَّمة مجاورة (`attachQuoteCards`): نص الآية على صفحتها
 *   (`verseKey`/`verseText`/`versePartial`/`verseFrom`) أو نص الحديث (`hadithText`/`hadithRef`/`hadithNarrator`/`hadithFrom`)،
 *   والراوي مستمر. الجارة الأطول كلامًا (بعدد الكلمات؛ عند التساوي التالية)، ولا لقطة `pending` إن وُجدت غيرها، ولا لقطة
 *   تحمل اقتباسًا قبلها (الأحاديث تُلحق أولًا ثم الآيات، فإن تنازعتا لقطة أخذها الحديث وذهبت الآية إلى جارتها الأخرى). نص الآية في `verseText` من السكريبت كما يأخذه المحرك للبطاقة (كما في
 *   خطة 001)، فيقابله فحص Tanzil (D220)؛ ونص الحديث لا يُقابل بالمصحف ولا يُرسل إلى الصوت. ومعرّف البطاقة يُحذف من الخطة.
 * - تعليقات HTML في السكريبت ملاحظات إنتاج لا تُنطق ولا تصير مشاهد (يحذفها المحلل).
 * - حقول مشهد المكتبة من وصف الصف بصيغة «`الحقل` «القيمة»» (أو «`الحقل`: «القيمة»»)، وللحقول المعلنة لذلك المشهد
 *   وحدها (`LIB_UI`). `verse-tag` بلا مرجع يأخذ مرجع بطاقة الآية التي تليه، وكلمة ختمه اسم السورة إن نُطق.
 * - صف «بالكلمات وحدها» يصير `horizon-shot` بلقطة `pending` (قيد التصميم: لا يدخل نسخة نهائية) ويُذكر في التقرير.
 */
import type { ParsedScript } from "../script/types";
import type { Plan, PlanScene, PlanShort } from "./types";
import { generatePlan, type QuranTexts } from "./generate";
import { normalizeArabic } from "../script/quranMeta";
import { HZ_META, hzQuote } from "../remotion/dafatir/horizon/meta";
import { LIB_UI } from "../remotion/dafatir/lib/meta";
import type { ChannelConfig } from "../channel/types";
import type { SeriesStamp } from "../channel/series";
import type { EpisodeMedia } from "./media";
import { CARRY_KEYS, type QuoteCarry } from "./quoteCarry";
import { continuesQuote, placeQuotes, type CarryDecision, type QuotePlacement } from "./quotePlacement";

export type ScenesRow = {
  id: string;
  /** نص الخلية (الجملة كما نقلها الجدول) */
  cell: string;
  shotCell: string;
  desc: string;
  struck: boolean;
};

/** صفوف جدول «خطة المشاهد بشكل…» كلها (الأجزاء كلها)، بترتيبها */
export const parseScenesTable = (md: string): ScenesRow[] => {
  const start = md.indexOf("## خطة المشاهد بشكل");
  if (start < 0) return [];
  const rest = md.slice(start + 5);
  const stop = rest.search(/\n## /);
  const body = stop < 0 ? rest : rest.slice(0, stop);
  const rows: ScenesRow[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^\|\s*(~~)?(c\d+-s\d+[a-z]?)(~~)?\s*\|(.*?)\|(.*?)\|(.*)\|\s*$/);
    if (!m) continue;
    const cell = m[4]!.trim();
    rows.push({ id: m[2]!, cell, shotCell: m[5]!.trim(), desc: m[6]!.trim(), struck: Boolean(m[1]) || /\*\*محذوف/.test(cell) });
  }
  return rows;
};

const flat = (s: string) =>
  normalizeArabic(s.replace(/<!--[\s\S]*?-->/g, " ").replace(/[«»"“”]/g, " ").replace(/[.،,:؛?؟!…()\-–—]/g, " ")).replace(/\s+/g, " ").trim();

const quoted = (cell: string) => {
  const a = cell.indexOf("«"), b = cell.lastIndexOf("»");
  return a < 0 || b <= a ? "" : cell.slice(a + 1, b);
};

type RowKind = { kind: "verse" | "hadith" } | { kind: "shot"; shot: string } | { kind: "words" };
export const rowKind = (r: ScenesRow): RowKind => {
  if (/`verse-card`/.test(r.shotCell) || /^بطاقة الآية/.test(r.cell)) return { kind: "verse" };
  if (/`hadith-card`/.test(r.shotCell) || /^نص الحديث/.test(r.cell)) return { kind: "hadith" };
  const shot = r.shotCell.match(/`((?:bd\d\d-[a-z0-9-]+)|(?:lib-[a-z]+)|verse-tag|verse-intro)`/)?.[1];
  if (shot) return { kind: "shot", shot };
  return { kind: "words" };
};

/** حقول مشهد المكتبة من الصف: «`key` «value»» أو «`key`: «value»» أو «key «value»» في خلية اللقطة أو الوصف */
export const rowFields = (r: ScenesRow, shot: string): Record<string, string> => {
  const allowed = new Set([...(LIB_UI[shot]?.fields ?? []), "head"]);
  const out: Record<string, string> = {};
  // تُحذف الحواشي التاريخية بين قوسين أولًا (فيها اقتباسات قديمة لا حقول)
  const text = `${r.shotCell} | ${r.desc}`.replace(/\((?:المراجعة|دفعة|تجهيز|التحرير|قرار|تحرير)[^()]*(?:\([^()]*\)[^()]*)*\)/g, " ");
  for (const m of text.matchAll(/`?([a-z][A-Za-z]+)`?\s*:?\s*«((?:[^«»]|«[^«»]*»)*)»/g)) {
    const k = m[1]!, v = m[2]!.trim();
    if (!allowed.has(k) || k in out || !v) continue;
    out[k] = v;
  }
  return out;
};

export type FromScenesReport = {
  /** فقرات السكريبت التي لا صف لها في الجدول */
  unplaced: { line: number; text: string }[];
  /** صفوف في الجدول لا يقابلها نص في السكريبت (متأخرة عن السكريبت) */
  unusedRows: string[];
  /** صفوف بالكلمات وحدها (لقطة pending) */
  wordsOnly: string[];
  /** لقطة يسمّيها الجدول وليست في مكتبة «خط الأفق» */
  unknownShots: string[];
  /** بطاقات آية/حديث لا يقابلها صف بالترتيب */
  cardMismatch: string[];
  /** D242: كل بطاقة أُلحقت بلقطة متكلَّمة (لا مشهد صامت) */
  attached: AttachedQuote[];
  /** D242: بطاقة لم تجد لقطة متكلَّمة تحملها (تبقى، ويرفضها فحص الخطة في «دفاتر الزمن») */
  unattached: { card: string; reason: string }[];
  /** D246: البطاقات التي استمرت إلى ما بعد مشهدها */
  carries?: QuoteCarry[];
  /** D246 «أ»: كلمة كل بطاقة وصفحتها وزمنها */
  placements?: QuotePlacement[];
  /** D246 «أ»: قرارات الاستمرار في الموضوع نفسه */
  decisions?: CarryDecision[];
};

/* ── D242: الآيات والأحاديث داخل اللقطة كما في 001 ── */

export type AttachedQuote = { card: string; kind: "verse" | "hadith"; ref: string; to: string; side: "prev" | "next"; words: number };

const isQuoteCard = (s: PlanScene) => (s.template === "verse-card" || s.template === "hadith-card") && !s.narration.trim();
const wordCount = (t: string) => t.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
const hostsQuote = (s: PlanScene) => Boolean(s.props.verseText?.trim() || s.props.hadithText?.trim());
const SACRED_WORD = /الله|لله|ربنا|ربه|ربك|سبحانه|تعالي|تعالى/;

/** كلمة ظهور البطاقة: أول كلمة في نص اللقطة ليست ذكرًا لله (verseWindow يزيح النافذة لتتسع داخل الكلام وبعد نافذة الذكر) */
export const quoteFromWord = (narration: string): string => {
  const words = narration.split(/\s+/).map((w) => w.replace(/[.،,:؛?؟!«»"“”()…\-–—]/g, "")).filter((w) => /\p{L}/u.test(w));
  return words.find((w) => !SACRED_WORD.test(normalizeArabic(w))) ?? words[0] ?? "";
};

/**
 * D242: يُلحق كل بطاقة آية/حديث صامتة بلقطة «خط الأفق» متكلَّمة مجاورة، ويحذف البطاقة. دالة خالصة يشترك فيها بناء الخطة من
 * scenes.md وتحويل خطة قائمة (`inlineQuotesInPlan`)، فلا يختلف الناتجان. لا تغيّر نص أي مشهد.
 * بطاقة الآية تحتاج نصها في props.text (من السكريبت)؛ بلا نص أو بنص مؤقت تبقى وتُذكر.
 */
export const attachQuoteCards = (input: PlanScene[], first: "hadith" | "verse" = "hadith", pick: Record<string, "prev" | "next"> = {}): { scenes: PlanScene[]; attached: AttachedQuote[]; unattached: { card: string; reason: string }[] } => {
  const scenes = input.map((s) => ({ ...s, props: { ...s.props } }));
  const attached: AttachedQuote[] = [], unattached: { card: string; reason: string }[] = [];
  const drop = new Set<number>();
  const spoken = (i: number) => {
    const s = scenes[i];
    return s && s.template === "horizon-shot" && s.narration.trim() ? s : undefined;
  };
  const neighbour = (i: number, step: -1 | 1): number | undefined => {
    for (let k = i + step; k >= 0 && k < scenes.length; k += step) {
      if (isQuoteCard(scenes[k]!)) continue;
      return spoken(k) ? k : undefined;
    }
    return undefined;
  };
  // الأحاديث أولًا ثم الآيات: الحديث تمهّد له عادة لقطته المجاورة («الصحيحان»، «حديث المعراج»)، والآية تمهّد لها لقطة
  // verse-tag أو تحملها الجارة الأخرى؛ فإن تنازعت بطاقتان لقطة واحدة أخذها الحديث وذهبت الآية إلى جارتها الأخرى
  const order = scenes.map((_, i) => i).filter((i) => isQuoteCard(scenes[i]!))
    .sort((a, b) => (first === "hadith" ? 1 : -1) * (Number(scenes[a]!.template === "verse-card") - Number(scenes[b]!.template === "verse-card")) || a - b);
  for (const i of order) {
    const card = scenes[i]!;
    const kind = card.template === "verse-card" ? "verse" as const : "hadith" as const;
    const text = card.props.text ?? "";
    const ref = kind === "verse" ? card.ayahKey ?? "" : card.props.reference ?? "";
    if (!text.trim() || text.startsWith("‹") || !ref.trim()) { unattached.push({ card: card.id, reason: kind === "verse" ? "بطاقة آية بلا نص أو بلا مرجع في السكريبت" : "بطاقة حديث بلا نص أو بلا مرجع" }); continue; }
    const opts = ([[-1, "prev"], [1, "next"]] as const)
      .map(([step, side]) => ({ k: neighbour(i, step), side }))
      .filter((o): o is { k: number; side: "prev" | "next" } => o.k !== undefined && !hostsQuote(scenes[o.k]!));
    if (!opts.length) { unattached.push({ card: card.id, reason: "لا لقطة متكلَّمة مجاورة بلا اقتباس تحمله" }); continue; }
    const real = opts.filter((o) => scenes[o.k]!.props.shot !== "pending");
    const pool = real.length ? real : opts;
    // الأطول كلامًا؛ وعند التساوي التالية — إلا ما اختاره attachWithCarries للبطاقة (D246 «أ»: الجارة التي تُقرأ فيها أطول)
    const best = pool.find((o) => o.side === pick[card.id]) ?? pool.reduce((a, b) => {
      const wa = wordCount(scenes[a.k]!.narration), wb = wordCount(scenes[b.k]!.narration);
      return wb > wa || (wb === wa && b.side === "next") ? b : a;
    });
    const host = scenes[best.k]!;
    const from = quoteFromWord(host.narration);
    // صفحة البطاقة: الفارغة إن عُرف أن اللقطة ترسم على صفحة واحدة (HZ_META.quoteSide)، وإلا الافتراضي كما في 001
    const side = HZ_META[host.props.shot ?? ""]?.quoteSide;
    if (kind === "verse") {
      host.props.verseKey = ref;
      host.props.verseText = text;
      if (card.props.partial === "1") host.props.versePartial = "1";
      host.props.verseFrom = from;
      if (side) host.props.verseSide = side;
      if (card.props.y) host.props.verseY = card.props.y;
    } else {
      host.props.hadithText = text;
      host.props.hadithRef = ref;
      if (card.props.narrator?.trim()) host.props.hadithNarrator = card.props.narrator.trim();
      host.props.hadithFrom = from;
      if (side) host.props.hadithSide = side;
      if (card.props.y) host.props.hadithY = card.props.y;
    }
    drop.add(i);
    attached.push({ card: card.id, kind, ref, to: host.id, side: best.side, words: wordCount(host.narration) });
  }
  // التقرير بترتيب البطاقات في الخطة
  const pos = new Map(input.map((s, i) => [s.id, i]));
  attached.sort((a, b) => pos.get(a.card)! - pos.get(b.card)!);
  return { scenes: scenes.filter((_, i) => !drop.has(i)), attached, unattached };
};

/**
 * D246: الإلحاق ثم الموضع والاستمرار. يُجرَّب ترتيبان (الأحاديث أولًا ثم الآيات، والعكس) ويؤخذ ما تُقرأ فيه البطاقات كاملة؛ فإن
 * تساويا فالأحاديث أولًا (D242). مثال 002: آية الأنبياء ٨٥ على تمهيدها القصير لا تُقرأ كاملة لأن ما بعده يحمل حديث المعراج،
 * فتذهب الآية إلى c2-s31 والحديث إلى جارته الأخرى.
 * D246 «أ» (قرار المالك ٢٨ نوفمبر): بعد الإلحاق placeQuotes (src/plan/quotePlacement.ts): البطاقة بعد أول فكرة مرسومة على
 * الصفحة المقابلة، ولا تستمر إلا في الموضوع نفسه، والجزء (D222) لما لا يتسع. ثم تُجرَّب كل بطاقة على جارتها الأخرى، ويُؤخذ
 * التبديل إن قلّ به ما لا يُقرأ (أكثر من ٠٫٠٥ ث)؛ مثال 002: «المائدة ٣١» على c1-s38 تستمر إلى c1-s40 (الغراب والعجز والندم)
 * بدل c1-s40 وحده، لأن c1-s44 بعده موضوع آخر. ولا تُبدَّل إلى جارة لا يتكلم نصها عن الاقتباس نفسه بوضوح (continuesQuote:
 * «المائدة ٣٢» لا تنزل على c1-s49 «الطريق كان مفتوحًا أمامه» قبل أن يبلغها الراوي)، ولا بطاقة حاملها مثبَّت (`quotePinned`).
 */
export const attachWithCarries = (input: PlanScene[], media: Pick<EpisodeMedia, "voice" | "recitations"> | undefined, channelId?: string, quran?: QuranTexts) => {
  const run = (first: "hadith" | "verse", pick: Record<string, "prev" | "next"> = {}) => {
    const a = attachQuoteCards(input, first, pick);
    const p = placeQuotes(a.scenes, media, { channelId, quran });
    return { ...a, scenes: p.scenes, carries: p.carries, placements: p.placements, decisions: p.decisions, first, pick, short: p.carries.reduce((x, y) => x + y.shortfall, 0) };
  };
  let best = run("hadith");
  if (best.short > 0.05 && best.attached.length) {
    const v = run("verse");
    if (v.short < best.short - 0.05) best = v;
  }
  for (const a of [...best.attached]) {
    if (best.short <= 0.05) break;
    const host = best.scenes.find((x) => x.id === a.to);
    if (host?.props.quotePinned === "1") continue;
    const side = a.side === "prev" ? "next" as const : "prev" as const;
    const r = run(best.first, { ...best.pick, [a.card]: side });
    const moved = r.attached.find((x) => x.card === a.card);
    const to = moved && r.scenes.find((x) => x.id === moved.to);
    const q = to && hzQuote(to.props);
    // الحامل الجديد يتكلم عن الاقتباس نفسه بوضوح (لا تنزل الآية على كلام قبل أن يبلغها الراوي)
    if (moved?.side === side && q && continuesQuote(to.narration, q.text).allow && !r.unattached.length && r.short < best.short - 0.05) best = r;
  }
  return best;
};

/**
 * D246 «أ»: يعيد بطاقات الخطة الملحقة إلى مواضعها في scenes.md (صف البطاقة بين مشهديه) ليُعاد إلحاقها بالقواعد الحالية
 * (inline-quotes على خطة قائمة). البطاقة الـn من كل نوع تقابل حامل الاقتباس الـn منه بالترتيب؛ وإن اختلف العدد، أو كان صف
 * البطاقة مشهدًا في الخطة، أو لم يكن الحامل جارًا متكلَّمًا لموضعها، أو كان مثبَّتًا (`quotePinned`)، بقي في حامله.
 */
const QUOTE_FIELDS = ["verseKey", "verseText", "versePartial", "versePartialAuto", "verseFrom", "verseSide", "verseY", "hadithText", "hadithRef", "hadithNarrator", "hadithFrom", "hadithSide", "hadithY", "quoteFirm", ...CARRY_KEYS];
export const detachQuotes = (input: PlanScene[], rows: ScenesRow[], quran: QuranTexts): { scenes: PlanScene[]; detached: string[] } => {
  const scenes = input.map((s) => ({ ...s, props: { ...s.props } }));
  const ids = new Set(scenes.map((s) => s.id));
  const order = new Map(rows.map((r, i) => [r.id, i]));
  const cards = rows.filter((r) => !r.struck).map((r) => ({ r, k: rowKind(r).kind })).filter((x) => x.k === "verse" || x.k === "hadith");
  const spoken = (i: number) => Boolean(scenes[i]?.template === "horizon-shot" && scenes[i]!.narration.trim());
  const detached: string[] = [];
  const inserts: { at: number; card: PlanScene }[] = [];
  for (const kind of ["verse", "hadith"] as const) {
    const rs = cards.filter((x) => x.k === kind).map((x) => x.r);
    const hosts = scenes.filter((s) => s.template === "horizon-shot" && (kind === "verse" ? s.props.verseText?.trim() && s.props.verseKey : s.props.hadithText?.trim() && s.props.hadithRef));
    if (rs.length !== hosts.length) continue;
    hosts.forEach((h, n) => {
      const row = rs[n]!;
      const ri = order.get(row.id)!;
      if (ids.has(row.id) || h.props.quotePinned === "1") return;
      // موضع البطاقة: بعد آخر مشهد صفه قبل صفها
      let at = 0;
      scenes.forEach((s, i) => { const o = order.get(s.id); if (o !== undefined && o < ri) at = i + 1; });
      const hi = scenes.indexOf(h);
      // الحامل جار متكلَّم لموضعها (لا مشهد متكلَّم بينهما)
      const span = hi < at ? [hi + 1, at] : [at, hi];
      for (let k = span[0]!; k < span[1]!; k++) if (spoken(k)) return;
      const p = h.props;
      const scriptPartial = p.versePartial === "1" && p.versePartialAuto !== "1";
      const card: PlanScene = kind === "verse"
        ? { id: row.id, template: "verse-card", narration: "", line: h.line, ayahKey: p.verseKey!, sfx: [],
          props: { text: scriptPartial ? p.verseText! : quran[p.verseKey!] ?? p.verseText!, reference: p.verseKey!, ...(scriptPartial ? { partial: "1" } : {}), ...(p.verseY ? { y: p.verseY } : {}) } }
        : { id: row.id, template: "hadith-card", narration: "", line: h.line, sfx: [],
          props: { text: p.hadithText!, reference: p.hadithRef!, ...(p.hadithNarrator ? { narrator: p.hadithNarrator } : {}), ...(p.hadithY ? { y: p.hadithY } : {}) } };
      for (const k of QUOTE_FIELDS) delete p[k];
      inserts.push({ at, card });
      detached.push(row.id);
    });
  }
  // حقول الاستمرار القديمة تُمسح أيضًا (تُحسب من جديد)
  for (const s of scenes) for (const k of CARRY_KEYS) delete s.props[k];
  inserts.sort((a, b) => b.at - a.at);
  for (const x of inserts) scenes.splice(x.at, 0, x.card);
  return { scenes, detached };
};

/**
 * D242: تحويل خطة قائمة (لا إعادة بنائها): نصوص الآيات من السكريبت (quranFromScript) في بطاقاتها ثم attachQuoteCards في كل
 * فصل. كل ما سواه كما هو حرفيًا (النبرة، edited، الشورتس، السلسلة، الحقول). يرفض إن تغيّر نص أي مشهد باقٍ، أو كان شورت
 * يشير إلى بطاقة حُذفت.
 * D246 «أ»: ومع scenesMd تُعاد البطاقات الملحقة إلى مواضعها (detachQuotes) فيُعاد إلحاقها وموضعها واستمرارها بالقواعد الحالية؛
 * وحقول المالك/المحرر (`carryAllowed` بلا `carryAuto`، و`quotePinned`) تبقى.
 */
export const inlineQuotesInPlan = (plan: Plan, quran: QuranTexts, media?: Pick<EpisodeMedia, "voice" | "recitations">, scenesMd?: string): { plan: Plan; attached: AttachedQuote[]; unattached: { card: string; reason: string }[]; removed: string[]; carries: QuoteCarry[]; placements: QuotePlacement[]; decisions: CarryDecision[] } => {
  const attached: AttachedQuote[] = [], unattached: { card: string; reason: string }[] = [];
  const carries: QuoteCarry[] = [], placements: QuotePlacement[] = [], decisions: CarryDecision[] = [];
  const rows = scenesMd ? parseScenesTable(scenesMd) : [];
  const chapters = plan.chapters.map((c) => {
    const filled = c.scenes.map((s) => s.template === "verse-card" && s.ayahKey && !s.props.text?.trim() && quran[s.ayahKey]
      ? { ...s, props: { ...s.props, text: quran[s.ayahKey]! } } : s);
    const d = rows.length ? detachQuotes(filled, rows, quran) : { scenes: filled, detached: [] as string[] };
    // D246: الإلحاق ثم الموضع واستمرار البطاقة إلى ما بعد مشهدها إن قصر كلامه (من توقيت الصوت الحقيقي إن وُجد)
    let r = attachWithCarries(d.scenes, media, plan.channel, quran);
    // بطاقة أُعيدت ولم تجد حاملًا (لا يقع إلا بتغيّر الخطة): بلا إعادة إلحاق
    if (r.unattached.some((u) => d.detached.includes(u.card))) r = attachWithCarries(filled, media, plan.channel, quran);
    const re = new Set(rows.length ? d.detached : []);
    attached.push(...r.attached.filter((a) => !re.has(a.card)));
    unattached.push(...r.unattached);
    carries.push(...r.carries);
    placements.push(...r.placements);
    decisions.push(...r.decisions);
    // البطاقة التي بقيت تعود كما كانت (لا نص آية في plan.json لبطاقة، stripQuran)
    const back = new Map(c.scenes.map((s) => [s.id, s]));
    return { ...c, scenes: r.scenes.map((s) => (s.template === "verse-card" ? back.get(s.id) ?? s : s)) };
  });
  const before = new Map(plan.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s.narration]));
  const after = chapters.flatMap((c) => c.scenes);
  for (const s of after) {
    if (!before.has(s.id)) throw new Error(`التحويل أضاف مشهدًا ليس في الخطة (${s.id}).`);
    if (before.get(s.id) !== s.narration) throw new Error(`تغيّر نص المشهد ${s.id}؛ التحويل لا يمس النص.`);
  }
  const removed = attached.map((a) => a.card);
  for (const sh of plan.shorts ?? [])
    for (const id of [sh.from, sh.to, ...(sh.segments ?? []).flatMap((x) => [x.from, x.to])])
      if (removed.includes(id)) throw new Error(`الشورت «${sh.title ?? sh.from}» يبدأ أو ينتهي ببطاقة ستُحذف (${id})؛ عدّله أولًا.`);
  return { plan: { ...plan, chapters }, attached, unattached, removed, carries, placements, decisions };
};

export type FromScenesInput = {
  parsed: ParsedScript;
  scenesMd: string;
  channel: ChannelConfig;
  quran?: QuranTexts;
  series?: SeriesStamp;
  shorts?: PlanShort[];
  /** ثابت للاختبار وإعادة البناء؛ الافتراضي الآن */
  now?: string;
  /** D246: صوت الحلقة (إن وُجد) لحساب استمرار البطاقات بتوقيته الحقيقي */
  media?: Pick<EpisodeMedia, "voice" | "recitations">;
  /** D246 «أ»: الخطة القائمة — حقول المالك/المحرر على مشاهدها (`carryAllowed` بلا `carryAuto`، و`quotePinned`) تبقى */
  owner?: Plan;
};

/** حقول الاقتباس التي يضعها المالك أو المحرر على مشهد بعينه (لا يعيد الأمر حسابها) */
export const ownerQuoteProps = (p: Record<string, string | undefined>): Record<string, string> => ({
  ...(p.carryAllowed && p.carryAuto !== "1" ? { carryAllowed: p.carryAllowed } : {}),
  ...(p.quotePinned === "1" ? { quotePinned: "1" } : {}),
});

/** يبني الخطة المصمَّمة ويعيدها مع تقرير ما لم يُطابَق. لا يكتب شيئًا. */
export const planFromScenes = (input: FromScenesInput): { plan: Plan; report: FromScenesReport } => {
  const base = generatePlan(input.parsed, null, input.quran ?? {}, input.channel);
  const rows = parseScenesTable(input.scenesMd).filter((r) => !r.struck);
  const report: FromScenesReport = { unplaced: [], unusedRows: [], wordsOnly: [], unknownShots: [], cardMismatch: [], attached: [], unattached: [] };
  const used = new Set<string>();
  const textRows = rows.map((r) => ({ r, k: rowKind(r), t: flat(quoted(r.cell)) }));
  const cardRows = textRows.filter((x) => x.k.kind === "verse" || x.k.kind === "hadith");
  let cardCursor = 0;
  let rowCursor = 0;

  const scenes: PlanScene[] = [];
  type Open = { row: ScenesRow; scene: PlanScene };
  // حامل لا متغير: start() يغيّره داخل دالة، وTypeScript لا يتتبع ذلك في تضييق المتغير
  const st: { open: Open | null } = { open: null };
  const generated = base.chapters.flatMap((c) => c.scenes).filter((s) => !/^c\d+-end$/.test(s.id));
  for (const g of generated) {
    if (g.template === "verse-card" || g.template === "hadith-card") {
      st.open = null;
      const want = g.template === "verse-card" ? "verse" : "hadith";
      const hit = cardRows.slice(cardCursor).find((x) => x.k.kind === want);
      if (!hit) { report.cardMismatch.push(`${g.template} ${g.props.reference ?? ""} (السطر ${g.line})`); continue; }
      cardCursor = cardRows.indexOf(hit) + 1;
      used.add(hit.r.id);
      const s: PlanScene = { id: hit.r.id, template: g.template, narration: "", line: g.line, props: { ...g.props }, sfx: [] };
      if (g.ayahKey) s.ayahKey = g.ayahKey;
      scenes.push(s);
      continue;
    }
    const f = flat(g.narration);
    if (!f) continue;
    // الصف الحالي يضم الفقرة التالية أيضًا (صف بفقرتين)
    if (st.open && flat(quoted(st.open.row.cell)).includes(f)) {
      st.open.scene.narration = `${st.open.scene.narration} ${g.narration}`.trim();
      continue;
    }
    const findRow = (needle: string) => {
      const pool = textRows.slice(rowCursor).concat(textRows.slice(0, rowCursor));
      return pool.find((x) => x.k.kind !== "verse" && x.k.kind !== "hadith" && !used.has(x.r.id) && x.t.includes(needle));
    };
    const start = (hit: (typeof textRows)[number], narration: string) => {
      rowCursor = textRows.indexOf(hit) + 1;
      used.add(hit.r.id);
      let props: Record<string, string>;
      if (hit.k.kind === "shot") {
        const shot = hit.k.shot;
        if (!HZ_META[shot]) report.unknownShots.push(`${hit.r.id}: ${shot}`);
        props = { shot, ...(shot.startsWith("bd") ? {} : rowFields(hit.r, shot)) };
      } else {
        report.wordsOnly.push(hit.r.id);
        props = { shot: "pending", idea: "بالكلمات وحدها حتى تُصمَّم لقطتها (scenes.md)" };
      }
      const scene: PlanScene = { id: hit.r.id, template: "horizon-shot", narration, line: g.line, props, sfx: [] };
      scenes.push(scene);
      st.open = { row: hit.r, scene };
    };
    const whole = findRow(f);
    if (whole) { start(whole, g.narration); continue; }
    // فقرة واحدة في السكريبت يقسمها الجدول على صفوف متتالية (دمج المحرر جملتين كانتا صفين): جملةً جملة
    const parts = g.narration.split(/(?<=[.؟?!…])\s+/).filter(Boolean);
    const placed = parts.every((p) => {
      const fp = flat(p);
      const cur = st.open;
      if (cur && flat(quoted(cur.row.cell)).includes(fp)) { cur.scene.narration = `${cur.scene.narration} ${p}`.trim(); return true; }
      const hit = findRow(fp);
      if (!hit) return false;
      start(hit, p);
      return true;
    });
    if (!placed) { st.open = null; report.unplaced.push({ line: g.line, text: g.narration }); }
  }

  // تمهيد الآية: مرجع البطاقة التي تليه، وكلمة الختم اسم السورة إن نُطق
  scenes.forEach((s, i) => {
    if (s.template !== "horizon-shot" || s.props.shot !== "verse-tag") return;
    const next = scenes.slice(i + 1).find((x) => x.template === "verse-card");
    if (!s.props.ref && next?.props.reference) s.props.ref = next.props.reference;
    if (!s.props.tagWord && s.props.ref) {
      const surah = s.props.ref.split("·")[0]!.trim();
      const word = s.narration.split(/\s+/).find((w) => flat(w) === flat(surah));
      if (word) s.props.tagWord = word.replace(/[.،,:؛?؟!«»]/g, "");
    }
  });

  for (const x of textRows) if (!used.has(x.r.id)) report.unusedRows.push(x.r.id);

  // D242: لا بطاقة صامتة — كل بطاقة على صفحة لقطة متكلَّمة مجاورة (بعد ربط تمهيد الآية بمرجعها أعلاه)
  // D246: واستمرار البطاقة إلى ما بعد مشهدها إن قصر كلامه عن زمن قراءتها
  if (input.owner) {
    const own = new Map(input.owner.chapters.flatMap((c) => c.scenes).map((s) => [s.id, ownerQuoteProps(s.props)]));
    for (const s of scenes) Object.assign(s.props, own.get(s.id) ?? {});
  }
  const inline = attachWithCarries(scenes, input.media, base.channel, input.quran);
  scenes.splice(0, scenes.length, ...inline.scenes);
  report.carries = inline.carries;
  report.placements = inline.placements;
  report.decisions = inline.decisions;
  report.attached = inline.attached;
  report.unattached = inline.unattached;

  const ids = new Set<string>();
  for (const s of scenes) {
    if (ids.has(s.id)) throw new Error(`معرّف مكرر في الخطة: ${s.id}`);
    ids.add(s.id);
  }
  const plan: Plan = {
    version: 1,
    episode: base.episode,
    title: base.title,
    domain: base.domain,
    themeId: base.themeId,
    channel: base.channel,
    lang: base.lang,
    overlays: { captions: true, motif: true, watermark: true, chapterLabel: false },
    updatedAt: input.now ?? new Date().toISOString(),
    intro: false,
    ...(input.shorts?.length ? { shorts: input.shorts.map((x) => ({ ...x })) } : {}),
    chapters: [{ number: 1, title: "", scenes }],
    ...(input.series ? { series: input.series } : {}),
  };
  return { plan, report };
};

export const fromScenesProblems = (r: FromScenesReport): string[] => [
  ...r.unplaced.map((u) => `نص في السكريبت بلا صف في scenes.md (السطر ${u.line}): «${u.text.slice(0, 60)}»`),
  ...r.unknownShots.map((u) => `لقطة غير موجودة في مكتبة «خط الأفق»: ${u}`),
  ...r.cardMismatch.map((u) => `بطاقة بلا صف مقابل في scenes.md: ${u}`),
  ...r.unattached.map((u) => `D242: البطاقة ${u.card} لم تُلحق بلقطة متكلَّمة (${u.reason})`),
];
