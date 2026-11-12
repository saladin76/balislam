import type { Plan } from "./types";
import { stripQuran } from "./quranText";

/** Same representation in the server and browser; Quran text remains authored in script.md. */
export const planRevisionSource = (plan: Plan): string => JSON.stringify(stripQuran(plan));
export const browserPlanRevision = async (plan: Plan): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(planRevisionSource(plan)));
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
};
