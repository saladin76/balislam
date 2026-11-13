import type { Plan } from "../plan/types";
import { sceneHash } from "../plan/sceneHash";
import type { StoryboardMotion } from "./storyboardMotion";

/**
 * صلاحية تقرير الحركة مصدر واحد للحزم والواجهة والرندر:
 * التطابق العام وحده لا يكفي إذا غاب مشهد أو تغيّرت بصمته.
 */
export const staleMotionScenes = (plan: Plan, report: StoryboardMotion, currentInputHash: string): string[] => {
  const outdated = !report.inputHash || report.inputHash !== currentInputHash;
  return plan.chapters.flatMap((c) => c.scenes)
    .filter((s) => outdated || !report.scenes?.[s.id] || report.scenes[s.id]!.hash !== sceneHash(s))
    .map((s) => s.id);
};

/** التقرير الحديث ذو التحذيرات يحتاج قرار مراجعة صريحًا متعلقًا بالتقرير نفسه. */
export const auditNeedsJustification = (
  report: StoryboardMotion | null,
  audit?: { note: string; inputHash?: string },
): boolean => {
  if (!report) return false;
  const hasWarnings = Object.values(report.scenes ?? {}).some((scene) => scene.logic?.status === "needs-review");
  return hasWarnings && (!audit?.note?.trim() || audit.note.trim().length < 10 || audit.inputHash !== report.inputHash);
};
