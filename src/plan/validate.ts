import { hasElement } from "../../brand/elements/registry";
import type { Plan } from "./types";
import { langPack, langPacks } from "../i18n/packs";

export type PlanIssue = { level: "error" | "warning"; sceneId: string; message: string };

/**
 * فحص الخطة قبل الرندر النهائي: ما لا يجوز نشره (حديث بلا نص، آية بنص مؤقت)
 * وما يستحق التنبيه (عنصر غير موجود في المكتبة).
 */
export const planIssues = (plan: Plan): PlanIssue[] => {
  const out: PlanIssue[] = [];
  if (plan.lang && langPacks[plan.lang] && !langPack(plan.lang).ready)
    out.push({ level: "error", sceneId: "-", message: `لغة «${langPack(plan.lang).nameAr}» في مرحلة التجهيز: تخطيط القوالب من اليسار لليمين لم يُفعَّل بعد، فلا تخرج منها نسخة نهائية.` });
  for (const ch of plan.chapters)
    for (const s of ch.scenes) {
      const p = s.props;
      if (s.template === "hadith-card" && !p.text?.trim()) out.push({ level: "error", sceneId: s.id, message: `بطاقة الحديث «${p.reference ?? ""}» بلا نص.` });
      if (s.template === "verse-card" && (!p.text?.trim() || p.text.startsWith("‹")))
        out.push({ level: "error", sceneId: s.id, message: `بطاقة الآية «${p.reference ?? ""}» بنص مؤقت؛ اجلب نصوص الآيات (زر «اجلب نصوص الآيات» في الاستوديو أو الأمر bal quran) بعد إضافة مفاتيح Quran Foundation.` });
      for (const k of ["element", "rightElement", "leftElement", "secondElement"])
        if (p[k] && !hasElement(p[k]!)) out.push({ level: "warning", sceneId: s.id, message: `العنصر «${p[k]}» غير موجود في المكتبة.` });
      // نصوص أطول من مساحة القالب: تُصغَّر تلقائيًا، لكن الأوضح تقصيرها
      const wc = (x?: string) => (x ?? "").split(/\s+/).filter(Boolean).length;
      if (s.template === "big-question" && wc(p.question) > 14) out.push({ level: "warning", sceneId: s.id, message: `السؤال طويل (${wc(p.question)} كلمة)؛ الأوضح ألا يزيد على 12 كلمة.` });
      if (s.template === "character-talk" && wc(p.line) > 14) out.push({ level: "warning", sceneId: s.id, message: `جملة الفقاعة طويلة (${wc(p.line)} كلمة)؛ الأوضح ألا تزيد على 10 كلمات.` });
      if (s.template === "hadith-card" && (p.text ?? "").length > 320) out.push({ level: "warning", sceneId: s.id, message: "نص الحديث طويل وسيُعرض بخط صغير؛ يمكن الاكتفاء بموضع الشاهد مع ذكر المصدر." });
      if (s.backdrop && !hasElement(s.backdrop)) out.push({ level: "warning", sceneId: s.id, message: `الخلفية «${s.backdrop}» غير موجودة.` });
    }
  return out;
};
