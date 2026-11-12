/**
 * D110: a server action wrote plan.json fields the page does not own (the series stamp on a move or its undo,
 * the shorts selection). The page then re-reads those fields and, when no edit is pending, the plan revision.
 */
export const PLAN_SERVER_FIELDS_EVENT = "bal:plan-server-fields";
export type PlanServerFieldsDetail = { episodes: string[]; channel?: string };
export const notifyPlanServerFields = (episodes: string[], channel?: string) => {
  try { window.dispatchEvent(new CustomEvent<PlanServerFieldsDetail>(PLAN_SERVER_FIELDS_EVENT, { detail: { episodes, ...(channel ? { channel } : {}) } })); }
  catch { /* outside a browser (tests): nothing listens */ }
};
