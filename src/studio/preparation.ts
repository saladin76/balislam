/**
 * Step ١ «التجهيز» (funnel v3, owner decision 8 Nov): the script, its research and the storyboard are prepared
 * by the system and reviewed by the owner on one screen, then approved with ONE button «اعتمد التجهيز».
 *
 * Under the hood nothing is merged or weakened. The single owner action writes, strictly in order and each
 * through its own full check:
 *   1. «approve-script» in the scene-production ledger (bound to the script fingerprint the owner saw);
 *   2. the board review record (storyboard.json, the same `checkVisualStoryboardSignoff`; the owner's note is optional, one line,
 *      and the same «script approved first» rule) — only when the boards are not recorded yet;
 *   3. «approve-storyboard» in the ledger (bound to the storyboard fingerprint the owner saw, or, when step 2
 *      wrote the record in this same action, to the record this action just wrote).
 * Every ledger write still goes through `decideSceneProduction` and its owner check. Nothing else is
 * approved: preparing the scenes afterwards (prepareAll) only makes drafts.
 *
 * Once per episode (owner decision 11 Nov 2026, all channels; supersedes the re-approval of D60/D65/D66): after this
 * approval a change to the script or the storyboard never asks for it again. The ledger carries the approvals forward
 * with a signed system event and re-opens only the changed scenes for review in step ٢ (sceneService ·
 * carryForwardAfterPreparation, afterPreparation.ts). The board note is optional and one line.
 */
import { readFile } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { parseScript } from "../script/parse";
import { checkForChannel } from "../script/checkChannel";
import { loadPlan } from "../plan/io";
import type { Plan } from "../plan/types";
import { effectiveTone, isTone } from "../voice/tones";
import { isBasmalaOnly } from "../voice/basmala";
import { isPartsChannel, toneMapFileFor } from "../voice/dafatirParts";
import { scriptTextDivergence, textDivergenceRefusal, type TextDivergence } from "../plan/scriptSync";
import { loadChannel } from "../channel/index";
import { approveStoryboard as recordBoards, loadStoryboard, recordChangedBoards, storyboardStatus, versesMissingText } from "../plan/storyboard";
import { checkVisualStoryboardSignoff } from "../plan/storyboardVisualGate";
import { earlyPlanErrors } from "../plan/validate";
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
  /** The owner's board review note: optional, one line (11 Nov). */
  note?: string;
};

/** One line, at most this long (11 Nov: optional, no minimum). */
export const NOTE_MAX = 300;
const hex64 = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);

/** What still blocks the preparation approval, without writing anything (also shown as the fix list). */
export type PreparationBlockers = {
  scriptErrors: number; versesMissing: string[]; boardsRecorded: boolean;
  /**
   * M1 (funnel QA, 10 Nov): narrated scenes with no tone at all (none of their own, none for the episode, none
   * for the channel). Their voice cannot be made, so preparing stops at once; step ١ says it BEFORE the
   * approval («لا نبرة للحلقة — اخترها هنا»). Informative: it does not block «اعتمد التجهيز».
   */
  toneMissing: string[];
  /**
   * QA balislam 2 (12 Nov): scenes whose narration in plan.json (what the boards show and the voice says) is not the
   * text in script.md, and script lines that no scene says. The approval is refused while any exists: the approved
   * script would hold text that is never voiced.
   */
  textDiverged: TextDivergence;
  /**
   * KI-054 (D121): plan errors the final file refuses that are known from the plan now (a documentary plate with no
   * picture, a template or element not in the channel's library), per scene. Informative in step ١ «قبل أن تعتمد»:
   * it does not block «اعتمد التجهيز»; the Master gate refuses them exactly as before.
   */
  planErrors: { scene: string; message: string }[];
  /** The episode's own tone (plan.tone) and the channel's, to preselect the choice in step ١. */
  episodeTone: string | null;
  channelTone: string | null;
};

/**
 * Narrated scenes (not verse cards) whose voice has no tone to be made with.
 * QA dafatir M1 (12 Nov): a scene whose tone comes from the episode's tone map (tone-map.json, the path
 * generate.ts really uses in that channel) has a tone; and the basmala is never narrated by the voice (the owner
 * records it), so a scene that is only the basmala needs none.
 */
export const scenesWithoutTone = (plan: Plan, channelTone?: unknown, toneMapScenes: ReadonlySet<string> = new Set()): string[] =>
  plan.chapters.flatMap((c) => c.scenes)
    .filter((s) => s.template !== "verse-card" && s.narration?.trim() && !isBasmalaOnly(s.narration.trim()) &&
      !toneMapScenes.has(s.id) && !effectiveTone(s.tone, plan.tone, channelTone))
    .map((s) => s.id);

/** Scenes that take their tone from the episode's tone map (only where generation follows it: isPartsChannel). */
export const toneMapScenesFor = async (scriptPath: string): Promise<Set<string>> => {
  if (!isPartsChannel(scriptPath)) return new Set();
  const map = await readFile(toneMapFileFor(scriptPath), "utf8").then((t) => JSON.parse(t) as {
    sceneTones?: Record<string, unknown>; segments?: { scene?: unknown; tone?: unknown }[];
  }, () => null);
  if (!map) return new Set();
  const ids = new Set<string>();
  for (const [id, tone] of Object.entries(map.sceneTones ?? {})) if (isTone(tone)) ids.add(id);
  for (const seg of Array.isArray(map.segments) ? map.segments : [])
    if (typeof seg?.scene === "string" && isTone(seg.tone)) ids.add(seg.scene);
  return ids;
};
const channelToneNow = (): string | null => {
  try { return loadChannel().voice?.tone ?? null; } catch { return null; }
};

const channelNow = (id?: string) => {
  try { return loadChannel(id || undefined); } catch { return undefined; }
};

export const preparationBlockers = async (episode: string): Promise<PreparationBlockers> => {
  const scriptPath = await resolveScriptPath(episode);
  const check = checkForChannel(parseScript(await readFile(scriptPath, "utf8"), scriptPath));
  const plan = await loadPlan(episode);
  if (!plan) throw Error("Prepare and save a storyboard plan first.");
  const status = storyboardStatus(plan, await loadStoryboard(scriptPath));
  return {
    scriptErrors: check.issues.filter((i) => i.level === "error").length,
    versesMissing: versesMissingText(plan),
    boardsRecorded: status.ok && Boolean(status.audit?.note?.trim()),
    toneMissing: scenesWithoutTone(plan, channelToneNow(), await toneMapScenesFor(scriptPath)),
    textDiverged: await scriptTextDivergence(scriptPath, plan),
    planErrors: earlyPlanErrors(plan, channelNow(plan.channel)),
    episodeTone: isTone(plan.tone) ? plan.tone : null,
    channelTone: channelToneNow(),
  };
};


export const approvePreparation = async (episode: string, command: PreparationCommand) => {
  assertSceneOwner();
  if (!command || !hex64(command.scriptSha256) || !hex64(command.storyboardSha256) ||
      (command.note !== undefined && (typeof command.note !== "string" || command.note.length > NOTE_MAX)))
    throw Error("Malformed preparation approval.");
  if (command.reviewed !== true) throw Error("Confirm that you reviewed the script and every board yourself.");

  // Everything that can refuse is checked BEFORE the first write, so a refusal leaves the ledger untouched.
  const before = await inspectSceneProduction(episode);
  // Once per episode: after it, the read above has already carried any later change forward (nothing to approve again).
  if (before.script.approved && before.storyboard.approved && before.boards.current) return before;
  if (before.script.sha256 !== command.scriptSha256) throw Error("Script changed before review.");
  if (before.storyboard.sha256 !== command.storyboardSha256) throw Error("Storyboard changed before review.");
  const blockers = await preparationBlockers(episode);
  if (blockers.scriptErrors > 0) throw Error("Fix the script errors before approving the preparation.");
  if (blockers.textDiverged.scenes.length || blockers.textDiverged.unplaced.length) throw Error(textDivergenceRefusal(blockers.textDiverged, await loadPlan(episode)));
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
    const record = await loadStoryboard(scriptPath);
    // Boards recorded once before (e.g. from «سجل مراجعة اللوحات») but never prepared: the changed ones only.
    if (record.audit?.note?.trim() && storyboardStatus(plan, record).approved > 0) await recordChangedBoards(scriptPath, plan, { note: boardNote });
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
  {
    const plan = await loadPlan(episode);
    const d = plan ? await scriptTextDivergence(scriptPath, plan) : null;
    if (d && (d.scenes.length || d.unplaced.length)) return textDivergenceRefusal(d, plan);
  }
  if (c.action === "approve-storyboard") {
    const plan = await loadPlan(episode);
    if (!plan) return "Prepare and save a storyboard plan first.";
    const missing = versesMissingText(plan);
    if (missing.length) return `لا يُعتمد الستوري بورد وفيه ${missing.length} آية بلا نصها (${missing.join("، ")}). أضف نص الآيات داخل السكريبت.`;
  }
  return null;
};
