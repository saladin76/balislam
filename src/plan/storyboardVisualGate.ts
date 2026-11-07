import type { Plan } from "./types";
import { versesMissingText } from "./storyboard";

/**
 * Stage-specific decision: approving ALL illustrated storyboard scenes happens
 * before voice-over and is never conditional on the motion-audit quality of
 * a full video which has not yet been produced.
 *
 * Quran verse text remains a hard blocker for any content approval. Missing
 * source text does not block uploading/reviewing earlier draft PDF/PNG boards.
 */
export const checkVisualStoryboardSignoff = (plan: Plan, note: unknown) => {
  const scenes = plan.chapters.flatMap((chapter) => chapter.scenes);
  if (scenes.length === 0)
    return { ok: false as const, reason: "لا توجد لوحات مشاهد في الخطة الحالية." };
  const missing = versesMissingText(plan);
  if (missing.length)
    return {
      ok: false as const,
      reason: `توجد ${missing.length} بطاقة آية بلا نص مصدري معتمد (${missing.join("، ")}). يمكن رفع المسودة ومراجعة تصميمها، لكن لا يجوز اعتمادها أو بدء الصوت قبل استكمال النصوص.`,
    };
  if (typeof note !== "string" || note.trim().length < 25)
    return {
      ok: false as const,
      reason: "أكّد مراجعة جميع اللوحات المرئية واكتب ملاحظة لا تقل عن 25 حرفًا تشمل إصدار الملفات وما فحصته فعليًا، دون تقديم اعتماد آلي.",
    };
  return { ok: true as const, note: note.trim() };
};
