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
 * Every ledger write still goes through `decideSceneProduction` and its owner check. Nothing else is
 * approved: preparing the scenes afterwards (prepareAll) only makes drafts.
 *
 * Boards changed after the approval (P-05, 10 Nov): when the boards were reviewed before, step 2 records ONLY the
 * changed/new boards (`recordChangedBoards`); the other boards keep their record byte for byte, so no approved
 * scene is re-opened. The ledger semantics are unchanged and explicit: the board record is a new file, so the
 * ledger's storyboard decision is taken again (step 3) in the same click, and a script edit re-opens the script
 * decision too (step 1). The owner sees the changed boards listed with the reason and presses one button.
 */
import { readFile } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { parseScript } from "../script/parse";
import { checkForChannel } from "../script/checkChannel";
import { loadPlan } from "../plan/io";
import type { Plan } from "../plan/types";
import { effectiveTone, isTone } from "../voice/tones";
import { loadChannel } from "../channel/index";
import { approveStoryboard as recordBoards, loadStoryboard, recordChangedBoards, storyboardStatus, versesMissingText } from "../plan/storyboard";
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
export type PreparationBlockers = {
  scriptErrors: number; versesMissing: string[]; boardsRecorded: boolean;
  /** Boards whose scene differs from its recorded board (changed after the record, or new), in episode order. */
  changedBoards: string[];
  /** The boards were reviewed before: only `changedBoards` need the owner's review now. */
  boardsReviewedBefore: boolean;
  /**
   * M1 (funnel QA, 10 Nov): narrated scenes with no tone at all (none of their own, none for the episode, none
   * for the channel). Their voice cannot be made, so preparing stops at once; step ١ says it BEFORE the
   * approval («لا نبرة للحلقة — اخترها هنا»). Informative: it does not block «اعتمد التجهيز».
   */
  toneMissing: string[];
  /** The episode's own tone (plan.tone) and the channel's, to preselect the choice in step ١. */
  episodeTone: string | null;
  channelTone: string | null;
};

/** Narrated scenes (not verse cards) whose voice has no tone to be made with. */
export const scenesWithoutTone = (plan: Plan, channelTone?: unknown): string[] =>
  plan.chapters.flatMap((c) => c.scenes)
    .filter((s) => s.template !== "verse-card" && s.narration?.trim() && !effectiveTone(s.tone, plan.tone, channelTone))
    .map((s) => s.id);
const channelToneNow = (): string | null => {
  try { return loadChannel().voice?.tone ?? null; } catch { return null; }
};

export const preparationBlockers = async (episode: string): Promise<PreparationBlockers> => {
  const scriptPath = await resolveScriptPath(episode);
  const check = checkForChannel(parseScript(await readFile(scriptPath, "utf8"), scriptPath));
  const plan = await loadPlan(episode);
  if (!plan) throw Error("Prepare and save a storyboard plan first.");
  const status = storyboardStatus(plan, await loadStoryboard(scriptPath));
  const changed = new Set([...status.changed, ...status.fresh]);
  return {
    scriptErrors: check.issues.filter((i) => i.level === "error").length,
    versesMissing: versesMissingText(plan),
    boardsRecorded: status.ok && Boolean(status.audit?.note?.trim()),
    changedBoards: Object.keys(status.scenes).filter((id) => changed.has(id)),
    boardsReviewedBefore: Boolean(status.audit?.note?.trim()) && status.approved > 0,
    toneMissing: scenesWithoutTone(plan, channelToneNow()),
    episodeTone: isTone(plan.tone) ? plan.tone : null,
    channelTone: channelToneNow(),
  };
};


export const approvePreparation = async (episode: string, command: PreparationCommand) => {
  assertSceneOwner();
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

  // 1 · the script (its own ledger record, owner checked again by the ledger).
  if (!before.script.approved)
    await decideSceneProduction(episode, {
      action: "approve-script", expectedSha256: command.scriptSha256, confirmedWatched: true,
      note: "راجعت السكريبت والمصادر (اعتماد التجهيز)",
    });

  // 2 · the board review record, only after the script approval (same rule as «سجل مراجعة اللوحات»).
  let storyboardSha256 = command.storyboardSha256;
  if (!blockers.boardsRecorded) {
    await requireScriptApproved(episode);
    if (blockers.boardsReviewedBefore) await recordChangedBoards(scriptPath, plan, { note: boardNote });
    else await recordBoards(scriptPath, plan, { note: boardNote });
    storyboardSha256 = (await inspectSceneProduction(episode)).storyboard.sha256;
  }

  // 3 · the storyboard (its own ledger record).
  const mid = await inspectSceneProduction(episode);
  if (!mid.storyboard.approved)
    await decideSceneProduction(episode, {
      action: "approve-storyboard", expectedSha256: storyboardSha256, confirmedWatched: true,
      note: "راجعت لوحات الستوري بورد كاملة (اعتماد التجهيز)",
    });
  return inspectSceneProduction(episode);
};

/**
 * H6 (security QA, 10 Nov): the direct ledger actions «approve-script» / «approve-storyboard» on the HTTP
 * surface (POST /api/episodes/<n>/scene-production) get exactly the checks «اعتمد التجهيز» enforces —
 * «راجعته بنفسي» (`reviewed: true`), no script error, and for the storyboard no verse without its text —
 * so they are never a way around the preparation step. Returns the refusal, or null (other actions: null).
 */
export const directPreparationRefusal = async (episode: string, command: unknown): Promise<string | null> => {
  const c = command as { action?: unknown; reviewed?: unknown } | null;
  if (!c || (c.action !== "approve-script" && c.action !== "approve-storyboard")) return null;
  if (c.reviewed !== true) return "Confirm that you reviewed the script and every board yourself («راجعته بنفسي»).";
  const scriptPath = await resolveScriptPath(episode);
  const check = checkForChannel(parseScript(await readFile(scriptPath, "utf8"), scriptPath));
  if (check.issues.some((i) => i.level === "error")) return "Fix the script errors before approving the preparation.";
  if (c.action === "approve-storyboard") {
    const plan = await loadPlan(episode);
    if (!plan) return "Prepare and save a storyboard plan first.";
    const missing = versesMissingText(plan);
    if (missing.length) return `لا يُعتمد الستوري بورد وفيه ${missing.length} آية بلا نصها (${missing.join("، ")}). أضف نص الآيات داخل السكريبت.`;
  }
  return null;
};

export type SceneBoardCommand = {
  sceneId: string;
  /** The storyboard fingerprint the owner saw (from the ledger read). */
  storyboardSha256: string;
  /** The script fingerprint the owner saw; required when the script decision is re-recorded (D66). */
  scriptSha256?: string;
  /** «راجعته بنفسي». */
  reviewed: boolean;
  /** What the owner checked on this scene (25+ characters, the same rule as every board review). */
  note: string;
};

/**
 * B2 (funnel QA, 10 Nov) extended by D66: one scene edited after «اعتمد التجهيز» — its sentence text (board) and/or
 * its narration in the script — is re-approved from step ٢ with ONE owner action «اعتمد تعديل هذا المشهد», without
 * locking the step. In order, each through its own check and the ledger's owner check:
 *   1. «approve-script» — only when the script decision was re-opened AND the script differs from the signed copy
 *      of the approved script in this scene's narration only (sceneService.ts · sceneEditOf, scriptScope.ts);
 *   2. this scene's board only (`recordChangedBoards(…, [sceneId])`) — when its board changed;
 *   3. «approve-storyboard».
 * Every refusal is checked before the first write. Other scenes keep their approvals and their board record byte
 * for byte. When anything else changed (another board, another part of the script, no signed copy), nothing is
 * written and the owner is sent to step ١ with the precise reason.
 */
export const approveSceneBoard = async (episode: string, command: SceneBoardCommand) => {
  assertSceneOwner();
  if (!command || typeof command.sceneId !== "string" || !/^[a-z0-9][a-z0-9-]{0,70}$/.test(command.sceneId) ||
      !hex64(command.storyboardSha256) || typeof command.note !== "string" || command.note.length > 3000 ||
      (command.scriptSha256 !== undefined && !hex64(command.scriptSha256)))
    throw Error("Malformed board approval.");
  if (command.reviewed !== true) throw Error("Confirm that you reviewed this board yourself («راجعته بنفسي»).");
  const before = await inspectSceneProduction(episode);
  if (before.storyboard.sha256 !== command.storyboardSha256) throw Error("Storyboard changed before review.");
  const edit = before.sceneEdit;
  if (!edit) throw Error("لا تعديل على هذا المشهد بعد اعتماد التجهيز؛ لا شيء لاعتماده.");
  if (!edit.open) throw Error(edit.reason ?? "يُعتمد هذا التعديل من «١ التجهيز» ← «اعتمد التجهيز».");
  if (edit.sceneId !== null && edit.sceneId !== command.sceneId)
    throw Error("لوحة هذا المشهد لم تتغيّر بعد اعتمادها؛ لا شيء لاعتماده.");
  if (!before.script.approved && command.scriptSha256 !== before.script.sha256) throw Error("Script changed before review.");
  const blockers = await preparationBlockers(episode);
  if (blockers.scriptErrors > 0) throw Error("Fix the script errors before approving the preparation.");
  if (!blockers.boardsReviewedBefore && blockers.changedBoards.length)
    throw Error("لم يُعتمد التجهيز بعد: راجع اللوحات كلها في «١ التجهيز» واعتمدها.");
  const others = blockers.changedBoards.filter((id) => id !== command.sceneId);
  if (others.length)
    throw Error(`تغيّرت لوحات أخرى أيضًا (${others.length})؛ اعتمادها معًا من «١ التجهيز» ← «اعتمد اللوحات المتغيّرة».`);
  if (blockers.versesMissing.length)
    throw Error(`لا يُعتمد الستوري بورد وفيه ${blockers.versesMissing.length} آية بلا نصها (${blockers.versesMissing.join("، ")}). أضف نص الآيات داخل السكريبت.`);
  const plan = await loadPlan(episode);
  if (!plan) throw Error("Prepare and save a storyboard plan first.");
  const checked = checkVisualStoryboardSignoff(plan, command.note);
  if (!checked.ok) throw Error(checked.reason);

  // 1 · the script, re-opened by this scene's narration only.
  if (!before.script.approved)
    await decideSceneProduction(episode, {
      action: "approve-script", expectedSha256: before.script.sha256, confirmedWatched: true,
      note: `راجعت تعديل نص المشهد (${command.sceneId}) وحده؛ بقية السكريبت كما اعتُمد`,
    });
  // 2 · this board only.
  if (blockers.changedBoards.includes(command.sceneId)) {
    await requireScriptApproved(episode);
    const scriptPath = await resolveScriptPath(episode);
    await recordChangedBoards(scriptPath, plan, { note: checked.note }, [command.sceneId]);
  }
  // 3 · the storyboard decision.
  const mid = await inspectSceneProduction(episode);
  if (!mid.storyboard.approved)
    await decideSceneProduction(episode, {
      action: "approve-storyboard", expectedSha256: mid.storyboard.sha256, confirmedWatched: true,
      note: `راجعت لوحة المشهد المتغيّرة (${command.sceneId})`,
    });
  return inspectSceneProduction(episode);
};
/** «اعتمد تعديل هذا المشهد» (D66) — the same action. */
export const approveSceneEdit = approveSceneBoard;
