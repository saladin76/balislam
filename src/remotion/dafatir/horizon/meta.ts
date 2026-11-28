/**
 * بيانات مشاهد «خط الأفق» (بلا React، فتقرؤها حسابات المدة والسكون أيضًا):
 * الاسم في الاستوديو، وذيل المشهد بعد آخر كلمة، وطريقة الخروج، والسكون المقصود، ومدة المشاهد الصامتة.
 */
import { buildTimeline, type Timeline } from "./timeline";
import { LIB_META, LIB_SACRED } from "../lib/meta";
import { BD_META } from "../bidayat/meta";

export type HzExit = "turn" | "fade" | "none";
export type HzMeta = {
  nameAr: string;
  /** ثوانٍ بعد آخر كلمة */
  tail: number;
  exit: HzExit;
  /** سكون مقصود للمشهد كله (ذكر الله، تمهيد آية): يُستثنى من نسبة الحركة */
  still?: "dhikr" | "verse-intro";
  /** مدة المشهد بلا كلام */
  seconds?: number;
  /** أقل مدة يحتاجها المشهد من بدايته بحسب حقوله وتوقيت كلماته (مثل إمساك مصطلح متأخر) — اختياري */
  minEnd?: (p: Record<string, string | undefined>, tl: import("./timeline").Timeline) => number;
  /**
   * D242: صفحة بطاقة الآية/الحديث على هذه اللقطة إن رسمت اللقطة على صفحة واحدة فقط (الأخرى فارغة): «l» لما يرسم على اليمنى
   * وحدها. يقرؤه attachQuoteCards فيضع verseSide/hadithSide؛ وبلا قيمة الافتراضي كما في 001 (اليمنى).
   */
  quoteSide?: "l" | "r";
};

export const HZ_LEAD = 0.3;

/** مشاهد الحلقة 001 الخاصة بها (لا تُستعمل في حلقة أخرى إلا بقرار) */
export const EP001_META: Record<string, HzMeta> = {
  cover: { nameAr: "فتح الدفتر (بلا كلام)", tail: 0, exit: "none", seconds: 2.6 },
  basmala: { nameAr: "البسملة على الصفحة الأولى", tail: 1.5, exit: "turn", still: "dhikr" },
  nations: { nameAr: "أمم وأجيال على الأفق", tail: 1.2, exit: "fade" },
  return: { nameAr: "الرجوع إلى البداية: الأطلال ثم البوابة ثم الاسم", tail: 0.9, exit: "none" },
  lineage: { nameAr: "النسل ينتشر في الأرض", tail: 1.3, exit: "fade" },
  "no-date": { nameAr: "لا تاريخ ثابتًا: الخانة الفارغة", tail: 1.2, exit: "fade" },
  greater: { nameAr: "ما هو أعظم من السنة والمكان", tail: 1.2, exit: "none" },
  index: { nameAr: "فهرس الأخبار", tail: 1.0, exit: "none" },
  begin: { nameAr: "من هذه الأخبار نبدأ (قلب الصفحة)", tail: 1.0, exit: "turn" },
  interpreters: { nameAr: "معنى الخلافة: أقوال المفسرين", tail: 1.2, exit: "fade" },
  question: { nameAr: "سؤال للفهم لا اعتراض (حاشية ابن كثير)", tail: 1.2, exit: "fade" },
  known: { nameAr: "معرفتنا محدودة", tail: 1.3, exit: "fade" },
  "two-titles": { nameAr: "الخلق ثم التعليم", tail: 1.5, exit: "turn" },
  clay: { nameAr: "«طين» كلمةً، ومواضع ذكره في القرآن", tail: 1.2, exit: "fade" },
  steps: { nameAr: "الخلق · التسوية · نفخ الروح (كلمات على خط)", tail: 1.6, exit: "turn" },
  catalog: { nameAr: "درج أقوال المفسرين، وبطاقة ما هو واضح في الآيات", tail: 1.2, exit: "fade" },
  knowledge: { nameAr: "الدفتر على مكتب الكاتب: أسباب المعرفة، والغرور يُشطب", tail: 1.6, exit: "turn" },
  honor: { nameAr: "السجود تكريم لا عبادة، والعبادة لله وحده", tail: 1.2, exit: "fade" },
  comply: { nameAr: "على مسار الأمر: استجابة، وإباء واستكبار", tail: 1.2, exit: "fade" },
  sort: { nameAr: "إبليس من الجن لا من الملائكة (تصنيف)", tail: 1.2, exit: "fade" },
  scale: { nameAr: "ميزان «نار / طين» الذي ظنه حجة، و«أمر واجب الطاعة»", tail: 1.2, exit: "fade" },
  enmity: { nameAr: "العداوة والإمهال وعزم الإغواء", tail: 1.2, exit: "fade" },
  authority: { nameAr: "لا سلطان له على عباد الله إلا من اتبعه", tail: 1.2, exit: "fade" },
  warning: { nameAr: "عداوة قديمة وتحذير صريح", tail: 1.6, exit: "turn" },
  permit: { nameAr: "الإباحة واسعة، والنهي علامة واحدة بحدّ «لا تقربا»", tail: 1.2, exit: "fade" },
  species: { nameAr: "بطاقة «نوع الشجرة»: فارغة، ثم العبرة", tail: 1.2, exit: "fade" },
  "warn-recall": { nameAr: "تحذير من عداوة الشيطان (قبل آية)", tail: 1.0, exit: "none" },
  whisper: { nameAr: "الوسوسة خط متموج، والوعدان تحت «زعم» يضمّهما قوس (بلا شطب)", tail: 1.2, exit: "fade" },
  breach: { nameAr: "ثم وقع: ثغرة في حدّ النهي، ثم «فأكلا من الشجرة»", tail: 1.0, exit: "none" },
  "return-line": { nameAr: "الخط العائد: لم يصر بل رجع، ومرجع الدعاء في الأعراف", tail: 1.9, exit: "fade" },
  received: { nameAr: "تلقى من ربه كلمات فتاب عليه: الخيط العائد وأسطر الحبر (D217)", tail: 0.6, exit: "fade" },
  stances: { nameAr: "موقفان: استكبر وأصر / تاب وأناب، وباب التوبة", tail: 1.6, exit: "turn" },
  "earth-words": { nameAr: "مستقر ومتاع إلى حين، وحياة وموت وإخراج", tail: 1.2, exit: "fade" },
  bridge: { nameAr: "نقطة التحول: أفق الخبر يتصل بأفق التاريخ البشري", tail: 1.4, exit: "fade" },
  "no-map": { nameAr: "خريطة بلا معالم: الهبوط إلى الأرض، ودبوس لا يستقر، وعلامات استفهام", tail: 1.4, exit: "fade" },
  limit: { nameAr: "نؤمن به ونثبته، ولا نزيد عليه إلا بدليل", tail: 1.6, exit: "turn" },
  "gen-fan": { nameAr: "النسل مراوح أجيال من أصل واحد (النساء 1)", tail: 1.2, exit: "fade" },
  lineline: { nameAr: "خط الأجيال: معايش تتنوع، وفجوات بلا سجل، وأسئلة", tail: 1.4, exit: "fade" },
  threshold: { nameAr: "مرحلة أخرى: العبور من الورق إلى أرض الشواهد", tail: 1.6, exit: "none" },
  "evidence": { nameAr: "الأثر وحدوده: أدوات ومساكن وأطعمة ومستوطنات ومدافن ونقوش", tail: 1.4, exit: "fade" },
  method: { nameAr: "من الشاهد إلى الحكم: ثبت / اختُلف فيه / ظن", tail: 1.3, exit: "fade" },
  roadmap: { nameAr: "طريق الحلقات: قبل الكتابة، القرى والمدن، الحضارات", tail: 1.2, exit: "fade" },
  sources: { nameAr: "مبدأ السلسلة: لا يُنسب اكتشاف إلى شخصية بلا دليل، والتمييز بين الخبر والشاهد وموضع البحث", tail: 1.4, exit: "turn" },
  questions: { nameAr: "أسئلة الحلقة القادمة، لكل سؤال أداته", tail: 1.6, exit: "turn" },
  // تصحيح D217 (v17): ذيل الختام ٠٫٨ ث بعد «رب العالمين» (كان ١٫٠، ومع تسجيل مركّب بذيل ٣٫٢ القديم بلغ السكوت ٣٫١ ث)
  closing: { nameAr: "الختام: صفحة «دفاتر الزمن» الأولى", tail: 0.8, exit: "none" },
};

/** كل مشاهد «خط الأفق»: المكتبة العامة (lib/meta.ts) ثم مشاهد الحلقة 001 ثم لقطات «البدايات» 002–009 (bidayat/) */
export const HZ_META: Record<string, HzMeta> = { ...LIB_META, ...EP001_META, ...BD_META };

/** جمل النص كما في السكريبت (الجملة تنتهي بنقطة أو علامة استفهام) */
export const hzSentences = (narration: string) => (narration.match(/[^.؟!]+[.؟!]?/g) ?? []).map((s) => s.trim()).filter(Boolean);

/**
 * الاستشهاد البصري (V9، قرار المالك ١١ نوفمبر): نص الآية ومرجعها يظهران على صفحة الدفتر من كلمة verseFrom والراوي مستمر.
 * ونص الحديث كذلك (قرار المالك ٢٨ نوفمبر، D242: «الآيات والأحاديث في دفاتر الزمن كما في 001»): hadithText بمرجعه hadithRef
 * من كلمة hadithFrom، بالنافذة نفسها وزمن القراءة نفسه، ولا يُرسل نصه إلى الصوت أبدًا ولا يُقابل بنص المصحف.
 *
 * D246 (قرار المالك ٢٨ نوفمبر، يحل محل سقف D219 «لا تبقى البطاقة بعد كلام مشهدها»): البطاقة تبقى زمن قراءتها كاملًا على
 * الأقل (verseReadSeconds). فإن قصر كلام مشهدها عنه **استمرت البطاقة نفسها إلى المشهد التالي** (وما بعده إن لزم) والراوي يكمل:
 * - المشهد الحامل يعلَّم `quoteCarried` (معرّف التالي)، ونافذته من ظهورها إلى آخر المشهد ([s، dur])؛ وإن اتسعت القراءة في
 *   ذيله قبل بداية التالي يعلَّم `quoteHold` (نافذته [s، s + القراءة] بلا سقف آخر كلمة، ولا تمد المشهد)؛
 * - المشهد التالي يحمل البطاقة بحقول `carry*` (`carryKind`، `carryText`، `carryRef`، `carryNarrator`، `carryPartial`،
 *   `carrySide`، `carryY`، `carryFrom`) و`carrySeconds` (ما بقي من زمن القراءة من بدايته)، ونافذته [0، carrySeconds]
 *   (أو المشهد كله إن عُلّم هو أيضًا `quoteCarried`)؛
 * - لا يطول أي مشهد بسبب البطاقة (لا سكوت يُضاف): المدة كلام المشهد وذيله كما هي.
 * يحسبها `computeQuoteCarries` (src/plan/quoteCarry.ts) من توقيت الصوت الحقيقي إن وُجد وإلا التقدير، ويقرؤها الرسم والمدة
 * والسكون المقصود وفحص الشاشة الواقفة من الخطة نفسها فتتفق كلها.
 * يعيد [ظهور البطاقة، نهايتها] أو null.
 */
export type HzQuote = { kind: "verse" | "hadith"; text: string; from: string; carried?: boolean };
/** الاقتباس المعروض في اللقطة: الآية (verseText + verseKey) أولًا، ثم الحديث (hadithText + hadithRef)، ثم المستمر من مشهد سابق (carry*) */
export const hzQuote = (props: Record<string, string | undefined>): HzQuote | null => {
  if (props.verseText?.trim() && props.verseKey?.trim()) return { kind: "verse", text: props.verseText, from: props.verseFrom ?? "" };
  if (props.hadithText?.trim() && props.hadithRef?.trim()) return { kind: "hadith", text: props.hadithText, from: props.hadithFrom ?? "" };
  if (props.carryText?.trim() && props.carryRef?.trim()) return { kind: props.carryKind === "hadith" ? "hadith" : "verse", text: props.carryText, from: "", carried: true };
  return null;
};
/** في اللقطة اقتباس معروض (آية أو حديث، أصلًا أو مستمرًا) تُحسب نافذته */
export const hasHzQuote = (props: Record<string, unknown> | undefined): boolean => Boolean(props && hzQuote(props as Record<string, string | undefined>));
/** نافذة البطاقة تمد المشهد للقراءة؟ لا في D246: الحامل الذي تستمر بطاقته والمشهد الذي يحمل المستمر لا يطولان أبدًا */
export const quoteHoldsScene = (props: Record<string, unknown> | undefined): boolean =>
  hasHzQuote(props) && !(props as Record<string, unknown>).quoteCarried && !(props as Record<string, unknown>).quoteHold && !(props as Record<string, unknown>).carryText;

/**
 * بداية البطاقة في مشهدها الحامل (D219/D242): من كلمتها، وتتقدم لتتسع داخل الكلام، ولا قبل نهاية نافذة ذكر سابقة.
 * الكلمة «كلمة» أو «كلمة#2» (الورود الثاني لما يبدأ بها، كمراسي الرسم).
 * firm (D246 «أ»، `quoteFirm: "1"`): البطاقة لا تتقدم عن كلمتها أبدًا — كلمتها بعد أول فكرة مرسومة في اللقطة، فلا تظهر على
 * دفتر فارغ؛ وما لا يتسع داخل الكلام يستمر إلى المشهد التالي إن جاز (carryAllowed) أو يُختصر جزءًا (D222).
 */
export const quoteStart = (from: string, text: string, tl: Timeline, firm = false): number => {
  const [w, n] = from.trim().split("#");
  const strip = (x: string) => x.replace(/[\u064B-\u0652\u0670\u0640]/g, "");
  const p = strip(w ?? "");
  const hit = p ? tl.words.filter((x) => strip(x.w).startsWith(p))[(Number(n) || 1) - 1] : tl.words[0];
  const a = hit ? hit.s : 0.4;
  if (firm && hit) return a;
  const read = verseReadSeconds(text);
  const last = tl.words.length ? tl.words[tl.words.length - 1]!.e : a + read;
  let floor = tl.words[0]?.s ?? 0.3;
  for (const w of tl.words) if (w.s < a && LIB_SACRED.test(w.w)) floor = Math.max(floor, w.e + 0.25);
  return a + read <= last ? a : Math.max(floor, Math.min(a, last - read));
};

/** dur: مدة المشهد الفعلية (للحامل الذي تستمر بطاقته، وللمشهد المستمر كله)؛ بلاها نهاية الكلام */
export const verseWindow = (props: Record<string, string | undefined>, tl: Timeline, dur?: number): [number, number] | null => {
  const q = hzQuote(props);
  if (!q) return null;
  const last = tl.words.length ? tl.words[tl.words.length - 1]!.e : 0;
  const end = dur ?? last + VERSE_AFTER_SPEECH;
  if (q.carried) {
    // D246: البطاقة المستمرة من المشهد السابق كاملة من أول إطار
    if (props.quoteCarried) return [0, end];
    const c = Number(props.carrySeconds);
    return [0, Math.min(Number.isFinite(c) && c > 0 ? c : 0, end)];
  }
  const s = quoteStart(q.from, q.text, tl, props.quoteFirm === "1");
  if (props.quoteCarried) return [s, end];
  // D246: القراءة تتسع في ذيل المشهد نفسه قبل بداية التالي (لا سقف عند آخر كلمة، ولا تمد المشهد)
  if (props.quoteHold) return [s, Math.min(s + verseReadSeconds(q.text), dur ?? Infinity)];
  return [s, Math.min(s + verseReadSeconds(q.text), last + VERSE_AFTER_SPEECH)];
};
/** الاسم العام للنافذة نفسها (آية أو حديث) */
export const quoteWindow = verseWindow;

/**
 * أطول بقاء لبطاقة الآية بعد آخر كلمة للراوي (ث). كان ٠٫٨ (D219)، فكانت نهاية المشهد بعد آخر كلمة نافذة سكون ساكنة صامتة
 * لا يعبرها المشهد التالي (الوصلة لا تبدأ قبل نهاية القراءة)، فبلغ السكوت المقيس في v17 ١٫٢–١٫٥ ث عند البقرة ٣٠ و٣٨
 * (قرار المالك ٢٤ نوفمبر: «لا سكوت فوق نحو ثانية، والهدف نصف ثانية؛ البطاقة تُعرض والراوي يكمل بلا سكوت»).
 * الآن ٠٫١٥ ث، دون الفاصل المختار بين جملتين (٠٫٢١ ث)، فيبدأ المشهد التالي بعد اختفائها كما يبدأ بعد أي جملة؛ والبطاقة كاملة
 * ساكنة طوال ظهورها وتختفي دفعة واحدة كما هي (D217). زمن القراءة (verseReadSeconds) كما هو حدًّا أعلى؛ وإن قصر كلام الراوي عنه بقيت البطاقة كاملة من بداية الكلام (لا قبل نافذة ذكر) إلى ما بعد آخر كلمة بهذا القدر.
 */
export const VERSE_AFTER_SPEECH = 0.15;

/**
 * زمن قراءة نص آية أو حديث معروض والراوي مستمر (المراجعة 031، وD246: «كلمتان في الثانية» بقرار المالك): ثانيتان لإيجاد
 * البطاقة وقراءة مرجعها، ثم نصف ثانية لكل كلمة (كلمتان في الثانية)، وخمس ثوانٍ على الأقل:
 * `max(5, 2 + كلمات ÷ 2)`. علامة الوقف المنفصلة في الرسم العثماني (ۖ ۗ ۚ، D220) و«…» ليست كلمة.
 * D246: هذا حد أدنى لبقاء البطاقة؛ إن قصر كلام مشهدها استمرت إلى ما بعده (computeQuoteCarries).
 */
export const verseReadSeconds = (text: string) => Math.max(5, 2 + 0.5 * text.trim().split(/\s+/).filter((w) => /\p{L}/u.test(w)).length);

export const hzEstimateSeconds = (narration: string, shot: string, props: Record<string, string | undefined> = {}) => {
  const m = HZ_META[shot];
  if (!narration.trim()) return m?.seconds ?? 3;
  const tl = buildTimeline(hzSentences(narration), HZ_LEAD);
  const base = tl.end + (m?.tail ?? 1.2);
  // D246: البطاقة لا تمد المشهد إن استمرت إلى ما بعده أو كانت مستمرة إليه
  const vw = quoteHoldsScene(props) ? verseWindow(props, tl) : null;
  return Math.round(Math.max(base, m?.minEnd?.(props, tl) ?? 0, vw ? vw[1] + 0.3 : 0) * 10) / 10;
};
