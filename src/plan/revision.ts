import type { Plan } from "./types";
import { stripQuran } from "./quranText";

/**
 * Plan fields written by the server alone, never by the page's plan save (D110): the series stamp (moving an
 * episode, src/channel/seriesStore.ts) and the owner's shorts selection (src/plan/io.ts saveShortsSelection).
 * They are left out of the revision, and PUT /plan keeps them from disk, so moving an episode or saving the
 * shorts never turns the page's next edit into a 409.
 */
export const SERVER_OWNED_PLAN_FIELDS = ["series", "shorts"] as const;

/** Same representation in the server and browser; Quran text remains authored in script.md. */
export const planRevisionSource = (plan: Plan): string => {
  const { series: _series, shorts: _shorts, ...edited } = stripQuran(plan);
  return JSON.stringify(edited);
};
export const browserPlanRevision = async (plan: Plan): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(planRevisionSource(plan)));
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
};
