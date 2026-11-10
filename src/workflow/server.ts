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
import { quranFromScript } from "../quran/scriptText";
import { loadStoryboard, storyboardStatus } from "../plan/storyboard";
import { readPlanFile } from "../plan/io";
import { loadVoiceIndex } from "../voice/generate";
import { assertVoiceApproved } from "../voice/review";
import { loadSceneLedger, sceneReviewItems, sceneReviewSummary } from "../plan/sceneReview";
import { loadStoryboardMotion } from "../render/storyboardMotion";
import { currentMotionFingerprint } from "../render/motionFingerprint";
import { staleMotionScenes, auditNeedsJustification } from "../render/motionValidity";
import { collectMedia } from "../plan/collect";
import type { Plan } from "../plan/types";
import type { Recitation } from "../plan/media";
import { readRenderInfo } from "../render/quality";
import { verifyVideoEvidence } from "./videoEvidence";
import { collectWorkflowSnapshot } from "./artifacts";
import { toWorkflowApprovalView } from "./uiProjection";
import { readWorkflow, submitWorkflowStage, approveWorkflowStage, rejectWorkflowStage,
  reopenWorkflowStage } from "./store";
import { STAGE_EVIDENCE, stageFingerprint, type Evidence, type WorkflowAction,
  type WorkflowSnapshot, type WorkflowStage, WORKFLOW_STAGES } from "./gates";
import { signServerEvidence, type WorkflowEvidenceAttestation } from "./trust";

/** The episode file that carries each stage's evidence (relative to the episode folder). */
const STAGE_EVIDENCE_FILE: Record<WorkflowStage, (masterId: string) => string> = {
  script: () => "script.md",
  storyboard: () => "storyboard.json",
  voice: () => "voice/index.json",
  motion: () => "out/storyboard-motion.json",
  av_review: () => "previews/episode.mp4",
  master: (id) => `out/package/${id}-episode.mp4`,
};

/**
 * Unified engine: the verifier above checked every required fact on the server, so it now signs
 * one proof per required evidence key, bound to the stage's current sha256 and file epoch.
 * The browser never sees or supplies this attestation.
 */
const attestEvidence = (stage: WorkflowStage, fingerprint: string, actorId: string, snapshot: WorkflowSnapshot,
  evidence: Evidence, masterId: string): WorkflowEvidenceAttestation => {
  const current = snapshot[stage];
  if (!current) throw Error(`No current ${stage} artifact to attest.`);
  return signServerEvidence({
    stage, fingerprint, actorId, checkedAt: new Date().toISOString(),
    proofs: STAGE_EVIDENCE[stage].filter((key) => evidence[key] === true).map((key) => ({
      key, file: STAGE_EVIDENCE_FILE[stage](masterId), sha256: current.sha256, epoch: current.epoch, verifier: "studio-server-verifier",
    })),
  });
};

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

/** Silent verse cards are allowed when no recitation was selected.
 * An actual or requested recitation must have a rights-verified origin.
 */
export const unsafeQuranRecitationScenes = (
  plan: Plan, recitations: Record<string, Recitation>, requireRecitation: boolean,
): string[] => plan.chapters.flatMap(c => c.scenes)
  .filter(scene => scene.template === "verse-card")
  .filter(scene => {
    const rec = scene.ayahKey ? recitations[scene.ayahKey] : undefined;
    if (!rec && !requireRecitation) return false;
    return !rec || rec.source !== "manual";
  }).map(scene => scene.id);
const verifyEvidence = async (episode: string, stage: WorkflowStage, confirmWatched: boolean): Promise<Evidence> => {
  const { scriptPath } = await collectWorkflowSnapshot(episode);
  const plan = await readPlanFile(scriptPath);
  const dir = path.dirname(scriptPath);
  if (stage === "script") {
    await assertScriptApproved(scriptPath);
    const src = await readFile(scriptPath, "utf8");
    const parsed = parseScript(src, scriptPath);
    required(checkForChannel(parsed).ok, "The script does not pass validation.");
    // Citations are documentation only and never block (CLAUDE.md rule 5; owner decision 10 Nov).
    const ayahs = quranFromScript(parsed);
    required(ayahs.problems.length === 0, "Quran text and references in script require review.");
    // Script approval and human citation review are the trust source. No external
    // Quran API may verify or mutate the authored verse text implicitly.
    // Any additional Mushaf comparison is a separate explicit human review.

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
    // If a Quran recording is present, its content hash and rights must still be current.
    await collectMedia(episode, plan!, { requireApprovedQuran: true });
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
    const media = await collectMedia(episode, plan!, { requireApprovedQuran: true });
    const unsafe = unsafeQuranRecitationScenes(plan!, media.recitations, true);
    required(unsafe.length === 0,
      "Only the owner-uploaded human Quran recording with documented rights is eligible: " + unsafe.join(", "));
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
    const plan = await readPlanFile(latest.scriptPath);
    const masterId = plan?.episode || path.basename(path.dirname(latest.scriptPath)).slice(0, 3);
    const attestation = attestEvidence(request.stage, request.expectedFingerprint, actor.id, latest.snapshot, evidence, masterId);
    await approveWorkflowStage(latest.scope, { ...input, snapshot: latest.snapshot, attestation });
  } else if (request.action === "reject") await rejectWorkflowStage(scope, input);
  else await reopenWorkflowStage(scope, input);
  return workflowReadForEpisode(episode);
};

/**
 * Unified engine (2026-11-08): every production gate asks the scene-first ledger only.
 * The six-stage ledger stays readable for migration, but it no longer authorizes anything,
 * so an old episode-level voice approval can never conflict with (or substitute for) scene approvals.
 */
export const assertWorkflowForEpisode = async (episode: string, action: WorkflowAction): Promise<void> => {
  const scenes = await import("../studio/sceneService");
  if (action === "publish") return scenes.requirePublishAllowed(episode);
  if (action === "master_render") return scenes.requireScenesReadyForMaster(episode);
  return scenes.requireScriptAndStoryboardApproved(episode);
};
