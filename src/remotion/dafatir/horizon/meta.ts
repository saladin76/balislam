/**
 * بيانات مشاهد «خط الأفق» (بلا React، فتقرؤها حسابات المدة والسكون أيضًا):
 * الاسم في الاستوديو، وذيل المشهد بعد آخر كلمة، وطريقة الخروج، والسكون المقصود، ومدة المشاهد الصامتة.
 */
import { buildTimeline } from "./timeline";

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
};

export const HZ_LEAD = 0.3;

export const HZ_META: Record<string, HzMeta> = {
  cover: { nameAr: "فتح الدفتر (بلا كلام)", tail: 0, exit: "none", seconds: 2.6 },
  basmala: { nameAr: "البسملة على الصفحة الأولى", tail: 1.5, exit: "turn", still: "dhikr" },
  nations: { nameAr: "أمم وأجيال على الأفق", tail: 1.2, exit: "fade" },
  return: { nameAr: "الرجوع إلى البداية: الأطلال ثم البوابة ثم الاسم", tail: 0.9, exit: "none" },
  lineage: { nameAr: "النسل ينتشر في الأرض", tail: 1.3, exit: "fade" },
  "no-date": { nameAr: "لا تاريخ ثابتًا: الخانة الفارغة", tail: 1.2, exit: "fade" },
  greater: { nameAr: "ما هو أعظم من السنة والمكان", tail: 1.2, exit: "none" },
  index: { nameAr: "فهرس الأخبار", tail: 1.0, exit: "none" },
  begin: { nameAr: "من هذه الأخبار نبدأ (قلب الصفحة)", tail: 1.0, exit: "turn" },
  chapter: { nameAr: "عنوان الفصل (بلا كلام)", tail: 0, exit: "none", seconds: 3.2 },
  "verse-intro": { nameAr: "تمهيد آية (صفحة ساكنة)", tail: 1.0, exit: "none", still: "verse-intro" },
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
  "verse-tag": { nameAr: "تمهيد آية بختم سورتها", tail: 1.0, exit: "none" },
  scale: { nameAr: "ميزان «نار / طين» الذي ظنه حجة، و«أمر واجب الطاعة»", tail: 1.2, exit: "fade" },
  enmity: { nameAr: "العداوة والإمهال وعزم الإغواء", tail: 1.2, exit: "fade" },
  authority: { nameAr: "لا سلطان له على عباد الله إلا من اتبعه", tail: 1.2, exit: "fade" },
  warning: { nameAr: "عداوة قديمة وتحذير صريح", tail: 1.6, exit: "turn" },
  permit: { nameAr: "الإباحة واسعة، والنهي علامة واحدة بحدّ «لا تقربا»", tail: 1.2, exit: "fade" },
  species: { nameAr: "بطاقة «نوع الشجرة»: فارغة، ثم العبرة", tail: 1.2, exit: "fade" },
  "warn-recall": { nameAr: "تحذير من عداوة الشيطان (قبل آية)", tail: 1.0, exit: "none" },
  whisper: { nameAr: "الوسوسة خط متموج، والوعدان الكاذبان يُشطبان", tail: 1.2, exit: "fade" },
  breach: { nameAr: "ثم وقع: ثغرة في حدّ النهي (قبل آية)", tail: 1.0, exit: "none" },
  "return-line": { nameAr: "الخط العائد: لم يصر بل رجع (قبل الدعاء)", tail: 1.9, exit: "fade" },
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
  questions: { nameAr: "أسئلة الحلقة القادمة، لكل سؤال أداته", tail: 1.6, exit: "turn" },
  closing: { nameAr: "الختام: صفحة «دفاتر الزمن» الأولى", tail: 3.2, exit: "none" },
  pending: { nameAr: "قيد التصميم (مكان المشهد في الخطة)", tail: 1.0, exit: "none" },
};

/** جمل النص كما في السكريبت (الجملة تنتهي بنقطة أو علامة استفهام) */
export const hzSentences = (narration: string) => (narration.match(/[^.؟!]+[.؟!]?/g) ?? []).map((s) => s.trim()).filter(Boolean);

/** مدة المشهد قبل وجود صوت الراوي: توقيت الكلمات التقديري + الذيل */
export const hzEstimateSeconds = (narration: string, shot: string) => {
  const m = HZ_META[shot];
  if (!narration.trim()) return m?.seconds ?? 3;
  const tl = buildTimeline(hzSentences(narration), HZ_LEAD);
  return Math.round((tl.end + (m?.tail ?? 1.2)) * 10) / 10;
};
