/**
 * D145 (owner decision 15 Nov 2026, all three channels): every scene is its own unit, produced, reviewed and approved
 * in ANY order. These pure helpers say each scene's own state in the owner's words (the filmstrip, the header, the
 * assembly button), which scene «اعتمد المشهد» moves to, and what the assembly still waits for. Display only: the
 * signed ledger on the server decides every gate.
 */
import type { SceneProductionRead } from "../../api";

type SceneRead = SceneProductionRead["scenes"][number];

/** لم يُنتج / جاهز للمراجعة / معتمد / بانتظار التعديل / مشروط بالتلاوة */
export type SceneStateKind = "todo" | "review" | "approved" | "fix" | "conditional";

export const SCENE_STATE_LABEL: Record<SceneStateKind, string> = {
  todo: "لم يُنتج",
  review: "جاهز للمراجعة",
  approved: "معتمد",
  fix: "بانتظار التعديل",
  conditional: "مشروط بالتلاوة",
};

export const sceneStateOf = (s: SceneRead | undefined): SceneStateKind => {
  if (!s) return "todo";
  if (s.approved) return s.conditional ? "conditional" : "approved";
  if (s.status === "in_review" && s.previewSha256) return "review";
  if (s.draft === "ready" && s.readyForAv && !s.awaitingChange) return "review";
  if (s.status === "needs_revision" && (s.awaitingChange || s.correction)) return "fix";
  return "todo";
};

/** After approving `afterId`: the next scene NOT yet approved after it, else the first one from the start, else null. */
export const nextUnapproved = (scenes: Pick<SceneRead, "id" | "approved">[], afterId: string): string | null => {
  const at = scenes.findIndex((s) => s.id === afterId);
  const open = (s: Pick<SceneRead, "approved">) => !s.approved;
  return scenes.slice(at + 1).find(open)?.id ?? scenes.slice(0, Math.max(0, at)).find(open)?.id ?? null;
};

/** What the assembly still waits for: scenes not approved, then verse scenes approved on condition of their recitation. */
export const assemblyMissing = (data: Pick<SceneProductionRead, "scenes" | "progress">) => ({
  unapproved: data.progress.unapprovedScenes ?? data.scenes.filter((s) => !s.approved).map((s) => s.id),
  conditional: data.progress.recitationPending ?? data.scenes.filter((s) => s.approved && s.conditional).map((s) => s.id),
});
