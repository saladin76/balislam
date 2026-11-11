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
  // 11 Nov (owner): the note is optional and one line; no minimum length anywhere. «راجعته بنفسي» is the confirmation.
  if (note !== undefined && note !== null && typeof note !== "string")
    return { ok: false as const, reason: "ملاحظة اللوحات نص من سطر واحد." };
  const text = typeof note === "string" ? note.trim() : "";
  if (/[\r\n]/.test(text) || text.length > 300)
    return { ok: false as const, reason: "ملاحظة اللوحات سطر واحد (٣٠٠ حرف على الأكثر)." };
  return { ok: true as const, note: text || "راجعت اللوحات كلها بنفسي" };
};
