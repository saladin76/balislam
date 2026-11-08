/**
 * Server-only, read-only projection of the DURABLE workflow ledger into Studio UI.
 * No human approval can be inferred from a technical check, an old ledger field
 * or caller-supplied values. The server must load the verified ledger AND calculate
 * the snapshot from current artifact bytes, never from request JSON.
 */
import {
  WORKFLOW_STAGES, isCurrentApproval,
  type WorkflowLedger, type WorkflowSnapshot, type WorkflowStage,
} from "./gates";

export type WorkflowDisplayStage = "script" | "storyboard" | "voice" | "motion" | "review" | "master";
export type WorkflowDisplayStatus = "draft" | "in_review" | "approved" | "rejected" | "reapproval_required";
export type WorkflowDisplayRecord = {
  status: WorkflowDisplayStatus;
  reviewer?: string;
  reviewedAt?: string;
  version?: string;
  note?: string;
};
export type WorkflowApprovalView = Partial<Record<WorkflowDisplayStage, WorkflowDisplayRecord>>;

/** Phase 5 is av_review in policy, review in the Studio navigation. */
export const displayWorkflowStage = (stage: WorkflowStage): WorkflowDisplayStage =>
  stage === "av_review" ? "review" : stage;

export const toWorkflowApprovalView = (
  ledger: WorkflowLedger,
  snapshot: WorkflowSnapshot,
): WorkflowApprovalView => {
  const view: WorkflowApprovalView = {};
  for (const stage of WORKFLOW_STAGES) {
    const state = ledger.stages[stage];
    const current = isCurrentApproval(ledger, snapshot, stage);
    // A stale 'approved' ledger never renders as an effective approval.
    const status: WorkflowDisplayStatus = state.status === "needs_reapproval" ||
      (state.status === "approved" && !current) ? "reapproval_required" : state.status;
    const approved = current ? state.approval : undefined;
    view[displayWorkflowStage(stage)] = {
      status,
      ...(approved ? { reviewer: approved.by.id, reviewedAt: approved.at,
        version: approved.contentVersion, note: approved.note } : {}),
      ...(!approved && state.reason ? { note: state.reason } : {}),
    };
  }
  return view;
};
