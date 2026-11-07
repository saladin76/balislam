/**
 * Studio's six human approval gates. Pure policy: no renderer, network or UI side effects.
 * The caller MUST compute snapshots from actual current artifacts and existing review ledgers.
 * Evidence is supplied only by trusted server-side adapters, never client-provided booleans.
 */
import { createHash } from "node:crypto";
import type { EvidenceProof } from "./trust.ts";

export const WORKFLOW_STAGES = ["script", "storyboard", "voice", "motion", "av_review", "master"] as const;
export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];
export type WorkflowStatus = "draft" | "in_review" | "approved" | "rejected" | "needs_reapproval";
export type WorkflowAction = "generate_voice" | "final_motion_render" | "master_render" | "publish";
export type WorkflowRole = "owner" | "reviewer";
export type WorkflowActor = { id: string; role: WorkflowRole };
export type ArtifactVersion = { version: string; sha256: string };
export type WorkflowSnapshot = Partial<Record<WorkflowStage, ArtifactVersion>>;

/** These tokens are attestations from an independently checked source, not user input. */
export const STAGE_EVIDENCE: Record<WorkflowStage, readonly string[]> = {
  script: ["script_validated", "sources_reviewed", "quran_compared"],
  storyboard: ["all_visual_boards_reviewed", "storyboard_source_matches"],
  voice: ["every_clip_reviewed", "full_audio_listened", "audio_matches_script"],
  motion: ["aligned_to_approved_audio", "scene_checks_passed"],
  av_review: ["full_episode_watched_at_1x", "audio_visual_review_passed"],
  master: ["exact_master_watched", "master_quality_passed", "publication_rights_checked"],
};

export type Evidence = Readonly<Record<string, boolean>>;
export type WorkflowApproval = {
  by: WorkflowActor;
  at: string;
  contentVersion: string;
  artifactSha256: string;
  fingerprint: string;
  note: string;
  evidence: string[];
  evidenceProofs: EvidenceProof[];
  /** Exact approval event sequence of every earlier stage; byte rollback cannot reuse a later signoff. */
  prerequisiteApprovalSeq: number[];
  /** Own immutable approval event number in the append-only log. */
  approvalEventSeq: number;
};
export type ReviewSubmission = {
  by: WorkflowActor;
  at: string;
  contentVersion: string;
  fingerprint: string;
  note: string;
};
export type StageState = {
  status: WorkflowStatus;
  submitted?: ReviewSubmission;
  approval?: WorkflowApproval;
  reason?: string;
};
export type WorkflowEvent = {
  seq: number;
  stage: WorkflowStage;
  action: "submit" | "approve" | "reject" | "reopen" | "invalidate" | "reset_review";
  by: string;
  at: string;
  contentVersion?: string;
  fingerprint?: string;
  note?: string;
};
export type WorkflowLedger = {
  schemaVersion: 2;
  channel: string;
  episode: string;
  revision: number;
  stages: Record<WorkflowStage, StageState>;
  history: WorkflowEvent[];
  /** HMAC-SHA256 over the canonical ledger data; required on persisted ledgers. */
  integrity?: { alg: "HMAC-SHA256"; keyId: string; mac: string };
};

export const initialLedger = (channel: string, episode: string): WorkflowLedger => ({
  schemaVersion: 2, channel, episode, revision: 0,
  stages: Object.fromEntries(WORKFLOW_STAGES.map((stage) => [stage, { status: "draft" }])) as Record<WorkflowStage, StageState>,
  history: [],
});

export const stageFingerprint = (snapshot: WorkflowSnapshot, stage: WorkflowStage): string => {
  const index = WORKFLOW_STAGES.indexOf(stage);
  if (index < 0) throw new Error("Unknown workflow stage.");
  const inputs = WORKFLOW_STAGES.slice(0, index + 1).map((key) => {
    const item = snapshot[key];
    if (!item || !/^[a-f0-9]{64}$/.test(item.sha256) || !item.version || item.version.length > 200)
      throw new Error(`Missing or invalid current artifact fingerprint for ${key}.`);
    return [key, item.version, item.sha256];
  });
  return createHash("sha256").update(JSON.stringify([2, stage, inputs])).digest("hex");
};

export const stagePrerequisites = (stage: WorkflowStage): WorkflowStage[] =>
  WORKFLOW_STAGES.slice(0, WORKFLOW_STAGES.indexOf(stage));

export const appendEvent = (
  ledger: WorkflowLedger, stage: WorkflowStage, action: WorkflowEvent["action"],
  by: string, at: string, note?: string, fingerprint?: string, contentVersion?: string,
): number => {
  ledger.history.push({ seq: ledger.history.length + 1, stage, action, by, at,
    ...(contentVersion ? { contentVersion } : {}), ...(fingerprint ? { fingerprint } : {}), ...(note ? { note } : {}) });
  return ledger.history.length;
};

/**
 * Never resurrect an invalidated approval if old bytes are later restored.
 * A change to any earlier artifact invalidates all *approved* dependent gates.
 */
export const reconcileWorkflow = (ledger: WorkflowLedger, snapshot: WorkflowSnapshot, at: string): boolean => {
  let dirty = false;
  for (const stage of WORKFLOW_STAGES) {
    const state = ledger.stages[stage];
    const upstreamChanged = stagePrerequisites(stage).some((before) => !isCurrentApproval(ledger, snapshot, before));
    let current: string | null = null;
    try { current = stageFingerprint(snapshot, stage); } catch { /* fail closed */ }
    if (state.status === "approved" && (upstreamChanged || !current || state.approval?.fingerprint !== current)) {
      state.status = "needs_reapproval";
      state.reason = "Changed input or upstream approval; explicit reapproval required.";
      appendEvent(ledger, stage, "invalidate", "system", at, state.reason, current ?? undefined, snapshot[stage]?.version);
      dirty = true;
    } else if (state.status === "in_review" && (!current || state.submitted?.fingerprint !== current || upstreamChanged)) {
      state.status = "draft";
      state.submitted = undefined;
      state.reason = "Input changed during review; submit the current version again.";
      appendEvent(ledger, stage, "reset_review", "system", at, state.reason, current ?? undefined, snapshot[stage]?.version);
      dirty = true;
    }
  }
  return dirty;
};

export const assertPrerequisites = (ledger: WorkflowLedger, snapshot: WorkflowSnapshot, stage: WorkflowStage): void => {
  for (const before of stagePrerequisites(stage)) {
    const state = ledger.stages[before];
    if (!isCurrentApproval(ledger, snapshot, before))
      throw new Error(`Stage ${stage} is blocked: ${before} needs valid explicit approval.`);
  }
};

export const assertRequiredEvidence = (stage: WorkflowStage, evidence: Evidence): string[] => {
  const missing = STAGE_EVIDENCE[stage].filter((key) => evidence[key] !== true);
  if (missing.length) throw new Error(`Cannot approve ${stage}; missing verified evidence: ${missing.join(", ")}.`);
  return [...STAGE_EVIDENCE[stage]];
};

/** Verify both the bound content and a human approval audit event; never trust status alone. */
export const isCurrentApproval = (ledger: WorkflowLedger, snapshot: WorkflowSnapshot, stage: WorkflowStage): boolean => {
  const state = ledger.stages[stage];
  const approval = state?.approval;
  const input = snapshot[stage];
  if (state?.status !== "approved" || !approval || !input || approval.by?.role !== "owner" ||
      !approval.by.id || !Number.isFinite(Date.parse(approval.at)) ||
      approval.contentVersion !== input.version || approval.artifactSha256 !== input.sha256 ||
      !Array.isArray(approval.evidence) || !STAGE_EVIDENCE[stage].every((key) => approval.evidence.includes(key)) ||
      !Array.isArray(approval.evidenceProofs) ||
      !STAGE_EVIDENCE[stage].every((key) => approval.evidenceProofs.some((proof) => proof.key === key && /^[a-f0-9]{64}$/.test(proof.sha256)))) return false;
  try {
    if (approval.fingerprint !== stageFingerprint(snapshot, stage)) return false;
  } catch { return false; }
  const parents = stagePrerequisites(stage);
  if (!Number.isSafeInteger(approval.approvalEventSeq) || approval.approvalEventSeq < 1 ||
      !Array.isArray(approval.prerequisiteApprovalSeq) ||
      approval.prerequisiteApprovalSeq.length !== parents.length ||
      parents.some((parent, i) => !isCurrentApproval(ledger, snapshot, parent) ||
        ledger.stages[parent].approval?.approvalEventSeq !== approval.prerequisiteApprovalSeq[i])) return false;
  const event = ledger.history[approval.approvalEventSeq - 1];
  return Boolean(event && event.seq === approval.approvalEventSeq && event.stage === stage &&
    event.action === "approve" && event.by === approval.by.id &&
    event.at === approval.at && event.fingerprint === approval.fingerprint);
};

const GATE_STAGE: Record<WorkflowAction, WorkflowStage> = {
  generate_voice: "storyboard",
  final_motion_render: "voice",
  master_render: "av_review",
  publish: "master",
};

export const assertWorkflowGate = (ledger: WorkflowLedger, snapshot: WorkflowSnapshot, action: WorkflowAction): void => {
  // A forged runtime action must never map to an empty prerequisite slice.
  if (typeof action !== "string" || !Object.prototype.hasOwnProperty.call(GATE_STAGE, action))
    throw new Error("Unknown workflow action; fail closed.");
  const last = GATE_STAGE[action];
  for (const stage of WORKFLOW_STAGES.slice(0, WORKFLOW_STAGES.indexOf(last) + 1)) {
    if (!isCurrentApproval(ledger, snapshot, stage))
      throw new Error(`${action} blocked: ${stage} is not approved for the current content.`);
  }
  // For publish, "master" MUST identify the SHA-256 of the exact final file, not a prior preview.
};
