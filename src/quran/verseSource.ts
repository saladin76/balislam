/**
 * D220 (قرار المالك ٢٤ نوفمبر): «فحص آلي يمنع أي بطاقة لا تطابق [نص Tanzil بالرسم العثماني] حرفًا حرفًا».
 * هذا الملف خالص (بلا ملفات): يأخذ دالة البحث (tanzilVerses في tanzil.ts على الخادم) ويقابل بها كل نص آية معروض.
 *
 * ما يُعرض نص آية:
 * - بطاقة الآية (`verse-card`): `props.text` بمرجعها `ayahKey` (النص من [آية: … | …] في السكريبت).
 * - لقطة الآية في «خط الأفق» (`horizon-shot`): `props.verseText` بمرجعها `props.verseKey` (استشهاد بصري صامت).
 * - أي مشهد آخر يحمل `verseText` أو `verseKey`: يُقابل كذلك، ونص بلا مرجع أو مرجع بلا نص خطأ.
 *
 * التطبيع (المقرر، ولا غيره): توحيد ترميز يونيكود NFC (ترتيب الحركات المتكافئ يُرسم واحدًا)، والمسافات (أي مسافة أو
 * سطر = مسافة واحدة، ولا مسافة في الطرفين)، وعلامة نهاية الآية برقمها بين آيات النطاق (۝٣٥ أو ﴿٣٥﴾) تُحذف من المعروض.
 * وما عدا ذلك فرق: كل حرف وحركة وعلامة وقف وتطويل وألف خنجرية كما في المصدر. لا يُصحَّح شيء آليًا؛ «انسخ نص المصدر»
 * (scripts/tanzil-verse-text.mts) ينسخ نص المصدر المعتمد نفسه إلى الخطة بطلب صريح.
 *
 * D222 (قرار المالك ٢٤ نوفمبر): «الآية القصيرة والمتوسطة تظهر كاملة. والطويلة جدًا (أكثر من نحو ٣٠ كلمة) يظهر منها جزء تام
 * المعنى برقم الآية وعلامة أنه جزء، بشرط موافقة المتخصص». الجزء يُعلَّم صراحة: «(جزء)» في آخر مرجع السكريبت
 * ([آية: البقرة 282 (جزء) | … نص الجزء …]) فيصير `props.partial: "1"` لبطاقة الآية، و`versePartial: "1"` للقطة «خط الأفق».
 * يُقبل الجزء إن كان معلَّمًا، لآية واحدة كلماتها أكثر من PARTIAL_MIN_WORDS (بلا علامات الوقف المنفصلة)، وكان كلمات متصلة من
 * نص المصدر كما هي (التطبيع نفسه) تبدأ وتنتهي عند حد كلمة وتبدأ بكلمة لا بعلامة وقف، وأقصر من الآية، وعليه «…» في كل طرف
 * مقطوع وحده (أوله إن لم يبدأ من أول الآية، وآخره إن لم ينته بآخرها). والجزء غير المعلَّم يُرفض كأي نص لا يطابق الآية كاملة.
 */
import type { Plan } from "../plan/types";
import { toEasternDigits } from "../i18n/packs";

/** آيات المرجع بالترتيب من المصدر، أو null لمرجع غير صالح */
export type VerseLookup = (ref: string) => { key: string; verses: { number: number; text: string }[] } | null;

export type ShownVerse = { sceneId: string; key: string; text: string; field: "text" | "verseText"; partial?: boolean };

/** الآية التي تُعرض كاملة إلى هذا العدد من الكلمات؛ ما فوقه «طويلة جدًا» يجوز عرض جزء منها (D222) */
export const PARTIAL_MIN_WORDS = 30;
/** كلمة تُعد في الطول وزمن القراءة: فيها حرف (علامة الوقف المنفصلة و«…» ليستا كلمة) */
export const isVerseWord = (w: string) => /\p{L}/u.test(w);
export const verseWordCount = (text: string) => text.trim().split(/\s+/u).filter(isVerseWord).length;
const ELLIPSIS = /^(?:…|\.\.\.)$/u;
export type VerseMismatch = { sceneId: string; key: string; field: ShownVerse["field"] | "verseKey"; message: string };

const DIGITS = "0-9٠-٩۰-۹";
const END_MARK = new RegExp(`\\s*(?:۝\\s*[${DIGITS}]*|[﴿﴾]\\s*[${DIGITS}]+\\s*[﴿﴾])`, "gu");

/** المعروض بعد التطبيع المقرر: NFC، وبلا علامة نهاية الآية برقمها، ومسافة واحدة */
export const normalizeShownVerse = (s: string): string => s.normalize("NFC").replace(END_MARK, " ").replace(/\s+/gu, " ").trim();
/** نص المصدر بالتطبيع نفسه، وآيات النطاق بمسافة */
export const sourceVerseText = (verses: readonly { text: string }[]): string => normalizeShownVerse(verses.map((v) => v.text).join(" "));

/** أول كلمة مختلفة (١ = الأولى)، أو null إن تطابق النصان */
export const firstWordDiff = (shown: string, source: string): { at: number; shown: string; source: string; words: number } | null => {
  if (shown === source) return null;
  const a = shown.split(" "), b = source.split(" ");
  let i = 0;
  while (i < Math.max(a.length, b.length) && a[i] === b[i]) i++;
  return { at: i + 1, shown: a[i] ?? "—", source: b[i] ?? "—", words: b.length };
};

const ar = (n: number) => n.toLocaleString("ar-EG");

/** موضع كلمات الجزء متصلةً في كلمات المصدر، أو -1 */
const indexOfRun = (hay: readonly string[], run: readonly string[]): number => {
  for (let i = 0; i + run.length <= hay.length; i++) if (run.every((w, k) => hay[i + k] === w)) return i;
  return -1;
};

/** رسالة جزء الآية المعلَّم (D222)، أو null إن قُبل */
export const partialVerseMessage = (shown: string, key: string, source: string): string | null => {
  const all = source.split(" ");
  const total = all.filter(isVerseWord).length;
  if (key.includes("-")) return `علامة «(جزء)» لآية واحدة لا لنطاق (${key}).`;
  if (total <= PARTIAL_MIN_WORDS) return `الآية ${key} ${ar(total)} كلمة: القصيرة والمتوسطة تُعرض كاملة (الجزء لما فوق ${ar(PARTIAL_MIN_WORDS)} كلمة)؛ احذف «(جزء)» وانسخ نص المصدر كاملًا.`;
  const words = normalizeShownVerse(shown).split(" ").filter(Boolean);
  const lead = words.length > 0 && ELLIPSIS.test(words[0]!), tail = words.length > 1 && ELLIPSIS.test(words[words.length - 1]!);
  const run = words.slice(lead ? 1 : 0, tail ? -1 : undefined);
  if (!run.length || run.some((w) => ELLIPSIS.test(w))) return `جزء الآية ${key} فارغ أو فيه «…» في وسطه؛ الجزء كلمات متصلة من الآية، و«…» في طرفيه المقطوعين وحدهما.`;
  if (!isVerseWord(run[0]!)) return `جزء الآية ${key} يبدأ بعلامة وقف؛ يبدأ بكلمة.`;
  const at = indexOfRun(all, run);
  if (at < 0) return `جزء الآية ${key} ليس كلمات متصلة من نص المصدر (Tanzil بالرسم العثماني) كما هي؛ انسخ كلمات الجزء من المصدر دون تغيير داخله.`;
  if (run.length === all.length) return `جزء الآية ${key} هو الآية كاملة؛ احذف «(جزء)» و«…».`;
  const cutStart = at > 0, cutEnd = at + run.length < all.length;
  if (cutStart !== lead || cutEnd !== tail)
    return `جزء الآية ${key}: «…» في الطرف المقطوع وحده (${cutStart ? "أوله مقطوع" : "يبدأ من أول الآية"}، و${cutEnd ? "آخره مقطوع" : "ينتهي بآخرها"}).`;
  return null;
};

/** رسالة الفرق بين نص معروض ومرجعه، أو null إن طابق. partial: معلَّم «(جزء)» (D222) */
export const verseMismatchMessage = (shown: string, ref: string, lookup: VerseLookup, partial = false): string | null => {
  const src = lookup(ref);
  if (!src) return `مرجع الآية «${ref}» غير صالح؛ لا نص في المصدر يُقابل به.`;
  const source = sourceVerseText(src.verses);
  if (partial) return partialVerseMessage(shown, src.key, source);
  const d = firstWordDiff(normalizeShownVerse(shown), source);
  if (!d) return null;
  // جزء غير معلَّم: يُرفض، ويُقال إن كان جزءًا صحيحًا ينقصه التعليم
  const hint = src.verses.length === 1 && !partialVerseMessage(shown, src.key, source)
    ? " هذا جزء من الآية: الجزء لا يُعرض إلا معلَّمًا «(جزء)» بعد موافقة المتخصص (D222)."
    : " انسخ نص المصدر كما هو.";
  return `نص الآية ${src.key} لا يطابق المصدر (Tanzil بالرسم العثماني) حرفًا حرفًا: أول اختلاف في الكلمة ${ar(d.at)} من ${ar(d.words)} (المعروض «${d.shown}» والمصدر «${d.source}»).${hint}`;
};

/** نصوص الآيات المعروضة في الخطة بمراجعها (بطاقة بنص مؤقت أو فارغ يفحصها planIssues) */
export const shownVerses = (plan: Pick<Plan, "chapters">): { shown: ShownVerse[]; problems: VerseMismatch[] } => {
  const shown: ShownVerse[] = [], problems: VerseMismatch[] = [];
  for (const s of plan.chapters.flatMap((c) => c.scenes)) {
    const p = (s.props ?? {}) as Record<string, unknown>;
    if (s.template === "verse-card") {
      const text = typeof p.text === "string" ? p.text : "";
      if (text.trim() && !text.startsWith("‹")) {
        if (s.ayahKey?.trim()) shown.push({ sceneId: s.id, key: s.ayahKey.trim(), text, field: "text", partial: p.partial === "1" });
        else problems.push({ sceneId: s.id, key: "", field: "text", message: "بطاقة آية بلا مرجع (ayahKey)؛ لا تُقابل بالمصدر فلا تُعرض." });
      }
    }
    const vt = typeof p.verseText === "string" ? p.verseText : "";
    const vk = typeof p.verseKey === "string" ? p.verseKey.trim() : "";
    if (vt.trim() && vk) shown.push({ sceneId: s.id, key: vk, text: vt, field: "verseText", partial: p.versePartial === "1" });
    else if (vt.trim()) problems.push({ sceneId: s.id, key: "", field: "verseKey", message: "نص آية معروض (verseText) بلا مرجع (verseKey)؛ لا يُقابل بالمصدر فلا يُعرض." });
    // D246: آية مستمرة من المشهد السابق تُقابل كذلك (النص نفسه في مشهدين)
    const ct = typeof p.carryText === "string" ? p.carryText : "";
    const ck = typeof p.carryRef === "string" ? p.carryRef.trim() : "";
    if (p.carryKind !== "hadith" && ct.trim() && ck) shown.push({ sceneId: s.id, key: ck, text: ct, field: "verseText", partial: p.carryPartial === "1" });
  }
  return { shown, problems };
};

/** كل نص آية معروض في الخطة لا يطابق المصدر حرفًا حرفًا */
export const planVerseMismatches = (plan: Pick<Plan, "chapters">, lookup: VerseLookup): VerseMismatch[] => {
  const { shown, problems } = shownVerses(plan);
  const out = [...problems];
  for (const v of shown) {
    const message = verseMismatchMessage(v.text, v.key, lookup, v.partial);
    if (message) out.push({ sceneId: v.sceneId, key: v.key, field: v.field, message });
  }
  return out;
};

/** آيات السكريبت ([آية: مرجع | نص]) بعد quranFromScript: كل نص لا يطابق المصدر */
export const scriptVerseMismatches = (ayahs: readonly { key: string; text: string; line: number; partial?: boolean }[], lookup: VerseLookup): { key: string; line: number; message: string }[] =>
  ayahs.flatMap((a) => {
    const message = verseMismatchMessage(a.text, a.key, lookup, a.partial);
    return message ? [{ key: a.key, line: a.line, message }] : [];
  });

/** يستبدل `verseText` بنص المصدر لمرجعه في كل مشهد يحمل الاثنين؛ لا يمس غيره. يعيد الخطة الجديدة والمشاهد التي تغيّرت */
export const withSourceVerseTexts = <P extends Pick<Plan, "chapters">>(plan: P, lookup: VerseLookup): { plan: P; changed: { sceneId: string; key: string }[]; failed: { sceneId: string; key: string }[] } => {
  const changed: { sceneId: string; key: string }[] = [], failed: { sceneId: string; key: string }[] = [];
  const chapters = plan.chapters.map((c) => ({ ...c, scenes: c.scenes.map((s) => {
    const p = (s.props ?? {}) as Record<string, unknown>;
    // الجزء المعلَّم (D222) لا يُستبدل بالآية كاملة
    if (typeof p.verseText !== "string" || typeof p.verseKey !== "string" || !p.verseText.trim() || p.versePartial === "1") return s;
    const src = lookup(p.verseKey);
    if (!src) { failed.push({ sceneId: s.id, key: p.verseKey }); return s; }
    // آية واحدة كما هي؛ والنطاق كبطاقة الآية (composeVerses): كل آية وعلامة نهايتها برقمها
    const text = src.verses.length === 1 ? src.verses[0]!.text : src.verses.map((v) => `${v.text} ۝${toEasternDigits(String(v.number))}`).join(" ");
    if (text === p.verseText) return s;
    changed.push({ sceneId: s.id, key: src.key });
    return { ...s, props: { ...s.props, verseText: text } };
  }) }));
  return { plan: { ...plan, chapters } as P, changed, failed };
};
