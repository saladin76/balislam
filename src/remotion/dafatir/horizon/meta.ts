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

export const HZ_LEAD = 0.5;

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
