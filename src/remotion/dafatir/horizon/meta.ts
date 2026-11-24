/**
 * بيانات مشاهد «خط الأفق» (بلا React، فتقرؤها حسابات المدة والسكون أيضًا):
 * الاسم في الاستوديو، وذيل المشهد بعد آخر كلمة، وطريقة الخروج، والسكون المقصود، ومدة المشاهد الصامتة.
 */
import { buildTimeline, type Timeline } from "./timeline";
import { LIB_META, LIB_SACRED } from "../lib/meta";

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
  "no-map": { nameAr: "خريطة بلا معالم: روايات، ودبوس لا يستقر، وتاريخ فارغ", tail: 1.4, exit: "fade" },
  limit: { nameAr: "نؤمن به ونثبته، ولا نزيد عليه إلا بدليل", tail: 1.6, exit: "turn" },
  "gen-fan": { nameAr: "النسل مراوح أجيال من أصل واحد (النساء 1)", tail: 1.2, exit: "fade" },
  lineline: { nameAr: "خط الأجيال: معايش تتنوع، وفجوات بلا سجل، وأسئلة", tail: 1.4, exit: "fade" },
  threshold: { nameAr: "مرحلة أخرى: العبور من الورق إلى أرض الشواهد", tail: 1.6, exit: "none" },
  "evidence": { nameAr: "الأثر وحدوده: أدوات ومساكن وأطعمة ومستوطنات ومدافن ونقوش", tail: 1.4, exit: "fade" },
  method: { nameAr: "من الشاهد إلى الحكم: ثبت / اختُلف فيه / ظن", tail: 1.3, exit: "fade" },
  roadmap: { nameAr: "طريق الحلقات: قبل الكتابة، القرى والمدن، الحضارات", tail: 1.2, exit: "fade" },
  sources: { nameAr: "مبدأ السلسلة: لا يُنسب اكتشاف إلى شخصية بلا دليل، والتمييز بين الخبر والشاهد وموضع البحث", tail: 1.4, exit: "turn" },
  questions: { nameAr: "أسئلة الحلقة القادمة، لكل سؤال أداته", tail: 1.6, exit: "turn" },
  closing: { nameAr: "الختام: صفحة «دفاتر الزمن» الأولى", tail: 1.0, exit: "none" },
};

/** كل مشاهد «خط الأفق»: المكتبة العامة (lib/meta.ts) ثم مشاهد الحلقة 001 */
export const HZ_META: Record<string, HzMeta> = { ...LIB_META, ...EP001_META };

/** جمل النص كما في السكريبت (الجملة تنتهي بنقطة أو علامة استفهام) */
export const hzSentences = (narration: string) => (narration.match(/[^.؟!]+[.؟!]?/g) ?? []).map((s) => s.trim()).filter(Boolean);

/** مدة المشهد قبل وجود صوت الراوي: توقيت الكلمات التقديري + الذيل */
/**
 * الاستشهاد البصري (V9، قرار المالك ١١ نوفمبر): نص الآية ومرجعها يظهران على صفحة الدفتر من كلمة verseFrom والراوي مستمر.
 * تبقى البطاقة زمن القراءة على الأقل (1.5 ث + الكلمات ÷ 2.2، ولا يقل عن 4 ث)؛ إن كان الكلام أقصر أمسك المشهد للقراءة.
 * يعيد [ظهور البطاقة، نهاية زمن قراءتها] أو null.
 */
export const verseWindow = (props: Record<string, string | undefined>, tl: Timeline): [number, number] | null => {
  if (!props.verseText || !props.verseKey) return null;
  const w = (props.verseFrom ?? "").trim();
  const p = w.replace(/[\u064B-\u0652\u0670\u0640]/g, "");
  const hit = p ? tl.words.find((x) => x.w.replace(/[\u064B-\u0652\u0670\u0640]/g, "").startsWith(p)) : tl.words[0];
  const a = hit ? hit.s : 0.4;
  const read = verseReadSeconds(props.verseText);
  // D219 (قرار المالك ٢٤ نوفمبر: «الراوي يكمل بلا سكوت، ومدة البطاقة قدر قراءتها فقط»): النافذة داخل الكلام؛ إن جاوزت آخر كلمة
  // تتقدم بدايتها (لا قبل أول كلمة) فتنتهي معه، فلا يطول المشهد بسكوت للقراءة
  // ولا تبدأ قبل نهاية نافذة ذكر سابقة (لا تظهر البطاقة مع لفظ الجلالة)؛ وإن قصر الكلام عن القراءة تمتد بعد آخر كلمة ٠٫٨ ث على الأكثر
  const last = tl.words.length ? tl.words[tl.words.length - 1]!.e : a + read;
  let floor = tl.words[0]?.s ?? 0.3;
  for (const w of tl.words) if (w.s < a && LIB_SACRED.test(w.w)) floor = Math.max(floor, w.e + 0.25);
  const s = a + read <= last ? a : Math.max(floor, Math.min(a, last - read));
  return [s, Math.min(s + read, last + 0.8)];
};

/**
 * زمن قراءة نص آية معروض والراوي مستمر (المراجعة 031): ثانيتان لإيجاد البطاقة وقراءة مرجعها، ثم نصف ثانية لكل كلمة
 * (قراءة متأنية لنص مشكول، نحو 120 كلمة في الدقيقة، أبطأ من القراءة الحرة لأن المشاهد يسمع الراوي في الوقت نفسه)،
 * وخمس ثوانٍ على الأقل. البطاقة تبقى بعده حتى نهاية المشهد.
 */
export const verseReadSeconds = (text: string) => Math.max(5, 2 + 0.5 * text.trim().split(/\s+/).filter(Boolean).length);

export const hzEstimateSeconds = (narration: string, shot: string, props: Record<string, string | undefined> = {}) => {
  const m = HZ_META[shot];
  if (!narration.trim()) return m?.seconds ?? 3;
  const tl = buildTimeline(hzSentences(narration), HZ_LEAD);
  const base = tl.end + (m?.tail ?? 1.2);
  const vw = verseWindow(props, tl);
  return Math.round(Math.max(base, m?.minEnd?.(props, tl) ?? 0, vw ? vw[1] + 0.3 : 0) * 10) / 10;
};
