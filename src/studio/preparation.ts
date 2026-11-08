/**
 * Step ١ «التجهيز» (funnel v3, owner decision 8 Nov): the script, its research and the storyboard are prepared
 * by the system and reviewed by the owner on one screen, then approved with ONE button «اعتمد التجهيز».
 *
 * Under the hood nothing is merged or weakened. The single owner action writes, strictly in order and each
 * through its own full check:
 *   1. «approve-script» in the scene-production ledger (bound to the script fingerprint the owner saw);
 *   2. the board review record (storyboard.json, the same `checkVisualStoryboardSignoff` with the owner's note
 *      of 25+ characters and the same «script approved first» rule) — only when the boards are not recorded yet;
 *   3. «approve-storyboard» in the ledger (bound to the storyboard fingerprint the owner saw, or, when step 2
 *      wrote the record in this same action, to the record this action just wrote).
 * Every ledger write still goes through `decideSceneProduction` with the owner passphrase. Nothing else is
 * approved: preparing the scenes afterwards (prepareAll) only makes drafts.
 */
import { readFile } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { parseScript } from "../script/parse";
import { checkForChannel } from "../script/checkChannel";
import { loadPlan } from "../plan/io";
import { approveStoryboard as recordBoards, loadStoryboard, storyboardStatus, versesMissingText } from "../plan/storyboard";
import { checkVisualStoryboardSignoff } from "../plan/storyboardVisualGate";
import {
  assertSceneOwner, decideSceneProduction, inspectSceneProduction, requireScriptApproved,
} from "./sceneService";

export type PreparationCommand = {
  /** The script fingerprint the owner reviewed (from the ledger read). */
  scriptSha256: string;
  /** The storyboard fingerprint the owner reviewed (from the ledger read). */
  storyboardSha256: string;
  /** «راجعته بنفسي»: required, like every other owner approval. */
  reviewed: boolean;
  /** The owner's board review note; required (25+ characters) only when the boards are not recorded yet. */
  note?: string;
};

const hex64 = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);

/** What still blocks the preparation approval, without writing anything (also shown as the fix list). */
export const preparationBlockers = async (episode: string): Promise<{ scriptErrors: number; versesMissing: string[]; boardsRecorded: boolean }> => {
  const scriptPath = await resolveScriptPath(episode);
  const check = checkForChannel(parseScript(await readFile(scriptPath, "utf8"), scriptPath));
  const plan = await loadPlan(episode);
  if (!plan) throw Error("Prepare and save a storyboard plan first.");
  const status = storyboardStatus(plan, await loadStoryboard(scriptPath));
  return {
    scriptErrors: check.issues.filter((i) => i.level === "error").length,
    versesMissing: versesMissingText(plan),
    boardsRecorded: status.ok && Boolean(status.audit?.note?.trim()),
  };
};

export const approvePreparation = async (episode: string, command: PreparationCommand, sessionToken: unknown) => {
  assertSceneOwner(sessionToken);
  if (!command || !hex64(command.scriptSha256) || !hex64(command.storyboardSha256) ||
      (command.note !== undefined && (typeof command.note !== "string" || command.note.length > 3000)))
    throw Error("Malformed preparation approval.");
  if (command.reviewed !== true) throw Error("Confirm that you reviewed the script and every board yourself.");

  // Everything that can refuse is checked BEFORE the first write, so a refusal leaves the ledger untouched.
  const before = await inspectSceneProduction(episode);
  if (before.script.sha256 !== command.scriptSha256) throw Error("Script changed before review.");
  if (before.storyboard.sha256 !== command.storyboardSha256) throw Error("Storyboard changed before review.");
  const blockers = await preparationBlockers(episode);
  if (blockers.scriptErrors > 0) throw Error("Fix the script errors before approving the preparation.");
  const scriptPath = await resolveScriptPath(episode);
  const plan = await loadPlan(episode);
  if (!plan) throw Error("Prepare and save a storyboard plan first.");
  let boardNote = "";
  if (!blockers.boardsRecorded) {
    const checked = checkVisualStoryboardSignoff(plan, command.note);
    if (!checked.ok) throw Error(checked.reason);
    boardNote = checked.note;
  } else if (blockers.versesMissing.length) {
    throw Error(`لا يُعتمد الستوري بورد وفيه ${blockers.versesMissing.length} آية بلا نصها (${blockers.versesMissing.join("، ")}). أضف نص الآيات داخل السكريبت.`);
  }

  // 1 · the script (its own ledger record, passphrase checked again by the ledger).
  if (!before.script.approved)
    await decideSceneProduction(episode, {
      action: "approve-script", expectedSha256: command.scriptSha256, confirmedWatched: true,
      note: "راجعت السكريبت والمصادر (اعتماد التجهيز)",
    }, sessionToken);

  // 2 · the board review record, only after the script approval (same rule as «سجل مراجعة اللوحات»).
  let storyboardSha256 = command.storyboardSha256;
  if (!blockers.boardsRecorded) {
    await requireScriptApproved(episode);
    await recordBoards(scriptPath, plan, { note: boardNote });
    storyboardSha256 = (await inspectSceneProduction(episode)).storyboard.sha256;
  }

  // 3 · the storyboard (its own ledger record).
  const mid = await inspectSceneProduction(episode);
  if (!mid.storyboard.approved)
    await decideSceneProduction(episode, {
      action: "approve-storyboard", expectedSha256: storyboardSha256, confirmedWatched: true,
      note: "راجعت لوحات الستوري بورد كاملة (اعتماد التجهيز)",
    }, sessionToken);
  return inspectSceneProduction(episode);
};
