/** Interpret the server's actual update result; failed updates must never trigger a reload. */
export type StudioUpdateResult = { ok: boolean; message: string; reinstalled?: boolean; restart?: boolean };
export const updateOutcome = (result: StudioUpdateResult): "failure" | "restart" | "reload" => {
  if (!result.ok) return "failure";
  return result.reinstalled || result.restart ? "restart" : "reload";
};
