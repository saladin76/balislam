import type { Plan } from "../plan/types";
import { sceneHash } from "../plan/sceneReview";
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
