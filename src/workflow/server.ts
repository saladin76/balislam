/**
 * Trusted, server-side workflow interface. No user-supplied snapshot, actor or
 * evidence booleans may be forwarded into the durable approval ledger.
 */
import path from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseScript } from "../script/parse";
import { checkForChannel } from "../script/checkChannel";
import { assertScriptApproved } from "../script/approval";
import { loadLedger, reviewItems, reviewSummary } from "../script/review";
import { quranFromScript } from "../quran/scriptText";
import { quranClientFromEnv } from "../quran/client";
import { auditEpisodeQuran } from "../quran/audit";
import { loadStoryboard, storyboardStatus } from "../plan/storyboard";
import { readPlanFile } from "../plan/io";
import { loadVoiceIndex } from "../voice/generate";
import { assertVoiceApproved } from "../voice/review";
import { loadSceneLedger, sceneReviewItems, sceneReviewSummary } from "../plan/sceneReview";
import { loadStoryboardMotion } from "../render/storyboardMotion";
import { currentMotionFingerprint } from "../render/motionFingerprint";
import { staleMotionScenes, auditNeedsJustification } from "../render/motionValidity";
import { collectMedia } from "../plan/collect";
import { readRenderInfo } from "../render/quality";
import { verifyVideoEvidence } from "./videoEvidence";
import { collectWorkflowSnapshot } from "./artifacts";
import { toWorkflowApprovalView } from "./uiProjection";
import { readWorkflow, submitWorkflowStage, approveWorkflowStage, rejectWorkflowStage,
  reopenWorkflowStage, requireWorkflowGate } from "./store";
import { STAGE_EVIDENCE, stageFingerprint, type Evidence, type WorkflowAction,
  type WorkflowStage, WORKFLOW_STAGES } from "./gates";

export type OwnerWorkflowAction = "submit" | "approve" | "reject" | "reopen";
export type OwnerWorkflowRequest = { stage: WorkflowStage; action: OwnerWorkflowAction;
  expectedFingerprint: string; note: string; confirmWatched?: boolean };

/** Default disabled; owner secret is configured ONLY in the local Studio server env. */
export const assertOwnerToken = (supplied: unknown, configured = process.env.BAL_STUDIO_OWNER_TOKEN): void => {
  if (typeof configured !== "string" || configured.length < 32)
    throw Error("BAL_STUDIO_OWNER_TOKEN (32+ chars) is not configured; approvals are disabled.");
  if (typeof supplied !== "string" || !supplied || supplied.length > 4096)
    throw Error("Owner authentication required.");
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(configured), digest(supplied))) throw Error("Owner authentication required.");
};

const required = (ok: unknown, message: string) => { if (ok !== true) throw Error(message); };
const verifyEvidence = async (episode: string, stage: WorkflowStage, confirmWatched: boolean): Promise<Evidence> => {
  const { scriptPath } = await collectWorkflowSnapshot(episode);
  const plan = await readPlanFile(scriptPath);
  const dir = path.dirname(scriptPath);
  if (stage === "script") {
    await assertScriptApproved(scriptPath);
    const src = await readFile(scriptPath, "utf8");
    const parsed = parseScript(src, scriptPath);
    required(checkForChannel(parsed).ok, "The script does not pass validation.");
    required(reviewSummary(reviewItems(parsed, await loadLedger(scriptPath))).ok,
      "All citations and religious sources must be reviewed.");
    const ayahs = quranFromScript(parsed);
    required(ayahs.problems.length === 0, "Quran text and references in script require review.");
    if (ayahs.ayahs.length) {
      const client = quranClientFromEnv();
      required(Boolean(client), "An approved Mushaf reference is required to verify Quran text.");
      const audit = await auditEpisodeQuran(episode, { client, frames: false });
      required(audit.audits.length > 0 && audit.audits.every(a => a.status === "match"),
        "Quran verses differ from the approved Mushaf or remain unverified.");
    }
  }
  if (stage === "storyboard") {
    required(Boolean(plan), "Storyboard plan is missing.");
    const board = storyboardStatus(plan!, await loadStoryboard(scriptPath));
    required(board.ok && Boolean(board.audit?.note?.trim()),
      "All boards require explicit visual review with an owner note.");
  }
  if (stage === "voice") {
    required(Boolean(plan), "Voice plan is missing.");
    await assertVoiceApproved(scriptPath, plan!, await loadVoiceIndex(episode));
    required(confirmWatched, "Owner must explicitly confirm listening to the complete voice track.");
  }
  if (stage === "motion") {
    required(Boolean(plan), "Motion plan is missing.");
    const report = await loadStoryboardMotion(episode);
    required(Boolean(report), "A current actual-motion report is required.");
    const currentHash = await currentMotionFingerprint(episode, plan!, report!.orientation);
    required(staleMotionScenes(plan!, report!, currentHash).length === 0,
      "Motion report does not match current scenes and approved audio.");
    const review = sceneReviewSummary(sceneReviewItems(plan!, await loadSceneLedger(scriptPath)));
    required(review.done, "Every animated scene must pass review.");
    const board = await loadStoryboard(scriptPath);
    required(!auditNeedsJustification(report!, board.audit),
      "Motion audit warnings must be resolved.");
  }
  if (stage === "av_review") {
    const { snapshot } = await collectWorkflowSnapshot(episode);
    required(Boolean(snapshot.av_review), "The complete integrated audiovisual review cut is missing.");
    await verifyVideoEvidence(path.join(dir, "previews", "episode.mp4"));
    required(confirmWatched, "Owner must confirm watching the complete cut at natural 1× speed.");
  }
  if (stage === "master") {
    const { snapshot } = await collectWorkflowSnapshot(episode);
    required(Boolean(snapshot.master), "Exact Master video is missing.");
    const info = await readRenderInfo(path.join(dir, "out", "package"));
    required(info?.quality === "master" && info.voiced, "The final Master must be full quality with approved audio.");
    const masterId = plan?.episode || path.basename(dir).slice(0, 3);
    if (!/^\d{3}$/.test(masterId)) throw Error("Invalid Master episode identifier.");
    await verifyVideoEvidence(path.join(dir, "out", "package", `${masterId}-episode.mp4`),
      info?.width ?? 3840, info?.height ?? 2160);
    required(Boolean(plan), "Final episode plan is missing.");
    // Licensed Quran audio cannot be inferred merely from the presence of an MP3.
    const media = await collectMedia(episode, plan!);
    const verses = plan!.chapters.flatMap(c => c.scenes).filter(s => s.template === "verse-card");
    for (const scene of verses) {
      const rec = scene.ayahKey ? media.recitations[scene.ayahKey] : undefined;
      required(Boolean(rec) && (rec?.source === "manual" || rec?.source === "alquran-cloud"),
        "Each Quran recitation requires authenticated manual rights evidence or verified AlQuran Cloud publishing rights.");
    }
    required(confirmWatched, "Owner must explicitly watch and approve these exact Master bytes.");
  }
  return Object.fromEntries(STAGE_EVIDENCE[stage].map(key => [key, true]));
};

export const workflowReadForEpisode = async (episode: string) => {
  const { scope, snapshot } = await collectWorkflowSnapshot(episode);
  const ledger = await readWorkflow(scope, snapshot);
  const fingerprints: Partial<Record<WorkflowStage, string>> = {};
  for (const stage of WORKFLOW_STAGES) {
    try { fingerprints[stage] = stageFingerprint(snapshot, stage); } catch { /* unavailable until artifact exists */ }
  }
  return { approvals: toWorkflowApprovalView(ledger, snapshot),
    fingerprints, revision: ledger.revision, stages: ledger.stages };
};

export const workflowOwnerDecision = async (episode: string, request: OwnerWorkflowRequest, token: unknown) => {
  assertOwnerToken(token);
  if (!request || !WORKFLOW_STAGES.includes(request.stage) ||
      !["submit", "approve", "reject", "reopen"].includes(request.action) ||
      typeof request.expectedFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(request.expectedFingerprint) ||
      typeof request.note !== "string" || request.note.trim().length < 15 || request.note.length > 2000)
    throw Error("Invalid workflow stage, action, current version fingerprint or review note.");
  const { scope, snapshot } = await collectWorkflowSnapshot(episode);
  // Role and identity are server-derived, NEVER accepted from JSON.
  const actor = { id: process.env.BAL_STUDIO_OWNER_ID || "studio-owner", role: "owner" as const };
  const input = { stage: request.stage, actor, snapshot, note: request.note,
    expectedFingerprint: request.expectedFingerprint };
  if (request.action === "submit") await submitWorkflowStage(scope, input);
  else if (request.action === "approve") {
    const evidence = await verifyEvidence(episode, request.stage, request.confirmWatched === true);
    // Recollect after expensive verification: reject approval of changed source bytes.
    const latest = await collectWorkflowSnapshot(episode);
    if (stageFingerprint(latest.snapshot, request.stage) !== request.expectedFingerprint)
      throw Error("Artifact changed during evidence verification; re-open and review the current version.");
    await approveWorkflowStage(latest.scope, { ...input, snapshot: latest.snapshot, evidence });
  } else if (request.action === "reject") await rejectWorkflowStage(scope, input);
  else await reopenWorkflowStage(scope, input);
  return workflowReadForEpisode(episode);
};

/** Publish checks must compare current file hashes, not the legacy status.json marker. */
export const assertWorkflowForEpisode = async (episode: string, action: WorkflowAction): Promise<void> => {
  const { scope, snapshot } = await collectWorkflowSnapshot(episode);
  await requireWorkflowGate(scope, snapshot, action);
};
