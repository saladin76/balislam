/**
 * Client-safe read model for PR #74. Builds presentation data only from
 * an authenticated, reconciled server ledger and a freshly hashed snapshot.
 * Do NOT send the raw signed ledger (HMAC, file paths, evidence receipts) to UI.
 */
import {
  WORKFLOW_STAGES, STAGE_EVIDENCE, isCurrentApproval, stageFingerprint,
  stagePrerequisites,
  type WorkflowAction, type WorkflowLedger, type WorkflowRole,
  type WorkflowSnapshot, type WorkflowStage, type WorkflowStatus,
} from "./gates.ts";

/**
 * Exact read-only DTO expected by PR #74:
 * app/src/workspace/workflowReadModel.ts (parseWorkflowReadModel).
 * Schema 3 describes the underlying signed approval ledger, but neither the
 * signature nor trusted file receipts may cross the HTTP response boundary.
 */
export type WorkflowUiApproval = Omit<NonNullable<WorkflowLedger["stages"]["script"]["approval"]>, "evidenceProofs">;
export type WorkflowUiStage = {
  status: WorkflowStatus;
  approval?: WorkflowUiApproval;
  submitted?: NonNullable<WorkflowLedger["stages"]["script"]["submitted"]>;
  reason?: string;
  currentApproval?: true;
};
export type StudioWorkflowUiSnapshot = {
  schemaVersion: 3;
  channel: string;
  episode: string;
  revision: number;
  stages: Record<WorkflowStage, WorkflowUiStage>;
  history: WorkflowLedger["history"];
};

export const toStudioWorkflowUiSnapshot = (
  ledger: WorkflowLedger, snapshot: WorkflowSnapshot,
): StudioWorkflowUiSnapshot => {
  const stages = Object.fromEntries(WORKFLOW_STAGES.map((stage) => {
    const state = ledger.stages[stage];
    const approval: WorkflowUiApproval | undefined = state.approval ? {
      // Explicit allow-list. Future ledger secrets must never be exposed by rest/spread.
      by: structuredClone(state.approval.by),
      at: state.approval.at,
      contentVersion: state.approval.contentVersion,
      artifactSha256: state.approval.artifactSha256,
      artifactEpoch: state.approval.artifactEpoch,
      fingerprint: state.approval.fingerprint,
      note: state.approval.note,
      evidence: [...state.approval.evidence],
      approvalEventSeq: state.approval.approvalEventSeq,
      prerequisiteApprovalSeq: [...state.approval.prerequisiteApprovalSeq],
    } : undefined;
    return [stage, {
      status: state.status,
      ...(approval ? { approval: structuredClone(approval) } : {}),
      ...(state.status === "in_review" && state.submitted ? { submitted: structuredClone(state.submitted) } : {}),
      ...(state.reason ? { reason: state.reason } : {}),
      ...(isCurrentApproval(ledger, snapshot, stage) ? { currentApproval: true as const } : {}),
    }];
  })) as Record<WorkflowStage, WorkflowUiStage>;
  return {
    schemaVersion: 3,
    channel: ledger.channel, episode: ledger.episode, revision: ledger.revision,
    stages, history: structuredClone(ledger.history),
  };
};

export type WorkflowStageView = {
  stage: WorkflowStage;
  index: number;
  status: WorkflowStatus;
  version: string | null;
  fingerprint: string | null;
  blockedBy: WorkflowStage[];
  reason: string | null;
  submitted: { by: string; at: string } | null;
  approved: { by: string; at: string; version: string; fingerprint: string; evidence: string[] } | null;
  requiredEvidence: string[];
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canReopen: boolean;
};
export type WorkflowGateView = { allowed: boolean; blockedBy: WorkflowStage[]; reason: string | null };
export type WorkflowInspectionView = {
  schemaVersion: 1;
  channel: string;
  episode: string;
  revision: number;
  stages: WorkflowStageView[];
  gates: Record<WorkflowAction, WorkflowGateView>;
};

const ACTION_END: Record<WorkflowAction, WorkflowStage> = {
  generate_voice: "storyboard",
  final_motion_render: "voice",
  master_render: "av_review",
  publish: "master",
};

export const toWorkflowInspectionView = (
  ledger: WorkflowLedger, snapshot: WorkflowSnapshot, currentRole: WorkflowRole,
): WorkflowInspectionView => {
  if (currentRole !== "owner" && currentRole !== "reviewer")
    throw new Error("A trusted authenticated role is required for workflow inspection.");
  const stages = WORKFLOW_STAGES.map((stage, index): WorkflowStageView => {
    const entry = ledger.stages[stage];
    const upstream = stagePrerequisites(stage).filter((before) =>
      !isCurrentApproval(ledger, snapshot, before));
    let fingerprint: string | null = null;
    try { fingerprint = stageFingerprint(snapshot, stage); } catch { /* missing artifact is blocked */ }
    const reviewCurrent = Boolean(fingerprint && entry.submitted?.fingerprint === fingerprint);
    const approved = isCurrentApproval(ledger, snapshot, stage) ? entry.approval! : null;
    return {
      stage, index: index + 1, status: entry.status,
      version: snapshot[stage]?.version ?? null,
      fingerprint, blockedBy: upstream,
      reason: entry.reason ?? (upstream.length ? `Prior stages need approval: ${upstream.join(", ")}` : !fingerprint ? "Missing or incomplete verified artifacts." : null),
      submitted: entry.status === "in_review" && entry.submitted
        ? { by: entry.submitted.by.id, at: entry.submitted.at } : null,
      approved: approved ? {
        by: approved.by.id, at: approved.at, version: approved.contentVersion,
        fingerprint: approved.fingerprint, evidence: [...approved.evidence],
      } : null,
      requiredEvidence: [...STAGE_EVIDENCE[stage]],
      canSubmit: Boolean(fingerprint && !upstream.length &&
        ["draft", "rejected", "needs_reapproval"].includes(entry.status)),
      canApprove: Boolean(currentRole === "owner" && !upstream.length &&
        entry.status === "in_review" && reviewCurrent),
      canReject: Boolean(entry.status === "in_review" && reviewCurrent),
      canReopen: entry.status === "rejected" || entry.status === "needs_reapproval",
    };
  });
  const gates = Object.fromEntries(
    (Object.keys(ACTION_END) as WorkflowAction[]).map((action): [WorkflowAction, WorkflowGateView] => {
      const end = WORKFLOW_STAGES.indexOf(ACTION_END[action]);
      const blockedBy = WORKFLOW_STAGES.slice(0, end + 1).filter((stage) =>
        !isCurrentApproval(ledger, snapshot, stage));
      const deniedRole = action === "publish" && currentRole !== "owner";
      return [action, {
        allowed: blockedBy.length === 0 && !deniedRole,
        blockedBy,
        reason: deniedRole ? "Only authenticated owner can publish." :
          blockedBy.length ? `Missing current approvals: ${blockedBy.join(", ")}` : null,
      }];
    }),
  ) as Record<WorkflowAction, WorkflowGateView>;
  return {
    schemaVersion: 1, channel: ledger.channel, episode: ledger.episode,
    revision: ledger.revision, stages, gates,
  };
};
