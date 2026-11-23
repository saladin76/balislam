/**
 * The plan a scene cut (or its 4K cover still, D196 v6) is rendered from, and the plan its media is collected from.
 * The first scene of the episode carries the channel intro slot; any other scene drops it, so its frame 0 is its own first
 * frame (a later scene's cover moment is never shifted by an empty slot). No cold open in any channel (D207, التعريف:
 * docs/dafatir-alzaman/07-decisions.md): every episode starts from the first line of its script.
 */
import type { Plan } from "./types";

export const cutPlans = (full: Plan, ids: string[], sceneDraft = true): { plan: Plan; mediaPlan: Plan } => {
  const opensEpisode = full.chapters[0]?.scenes[0]?.id === ids[0];
  const plan: Plan = { ...full, ...(sceneDraft && !opensEpisode ? { intro: false } : {}),
    chapters: full.chapters.map((c) => ({ ...c, scenes: c.scenes.filter((s) => ids.includes(s.id)) })).filter((c) => c.scenes.length) };
  return { plan, mediaPlan: plan };
};
