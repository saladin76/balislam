import { hasElement } from "../../brand/elements/registry";
import type { Plan } from "./types";

export type PlanIssue = { level: "error" | "warning"; sceneId: string; message: string };

/**
 * فحص الخطة قبل الرندر النهائي: ما لا يجوز نشره (حديث بلا نص، آية بنص مؤقت)
 * وما يستحق التنبيه (عنصر غير موجود في المكتبة).
 */
export const planIssues = (plan: Plan): PlanIssue[] => {
  const out: PlanIssue[] = [];
  for (const ch of plan.chapters)
    for (const s of ch.scenes) {
      const p = s.props;
      if (s.template === "hadith-card" && !p.text?.trim()) out.push({ level: "error", sceneId: s.id, message: `بطاقة الحديث «${p.reference ?? ""}» بلا نص.` });
      if (s.template === "verse-card" && (!p.text?.trim() || p.text.startsWith("‹")))
        out.push({ level: "error", sceneId: s.id, message: `بطاقة الآية «${p.reference ?? ""}» بنص مؤقت؛ شغّل bal quran بعد إضافة مفاتيح Quran Foundation.` });
      for (const k of ["element", "rightElement", "leftElement", "secondElement"])
        if (p[k] && !hasElement(p[k]!)) out.push({ level: "warning", sceneId: s.id, message: `العنصر «${p[k]}» غير موجود في المكتبة.` });
      if (s.backdrop && !hasElement(s.backdrop)) out.push({ level: "warning", sceneId: s.id, message: `الخلفية «${s.backdrop}» غير موجودة.` });
    }
  return out;
};
