import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  WORKFLOW_STAGES, STAGE_EVIDENCE, initialLedger, stageFingerprint,
  type WorkflowSnapshot, type WorkflowStage,
} from "../src/workflow/gates";
import { displayWorkflowStage, toWorkflowApprovalView } from "../src/workflow/uiProjection";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const input = (): WorkflowSnapshot => Object.fromEntries(WORKFLOW_STAGES.map(s => [s, { version: s + "-v1", sha256: sha(s), epoch: sha(s + "-epoch") }]));
const ledger = () => initialLedger("balislam", "001-review");

describe("read-only workflow engine → UI projection", () => {
  it("maps all six stages, including av_review, without inventing approvals", () => {
    const view = toWorkflowApprovalView(ledger(), input());
    expect(Object.keys(view)).toEqual(["script", "storyboard", "voice", "motion", "review", "master"]);
    expect(WORKFLOW_STAGES.map(displayWorkflowStage)).toEqual(Object.keys(view));
    expect(Object.values(view).every(v => v.status === "draft")).toBe(true);
    expect(JSON.stringify(view)).not.toContain("approved");
  });

  it("only exposes owner/version/date after verifying the current artifact AND approval history", () => {
    const state = ledger();
    const current = input();
    const stage: WorkflowStage = "script";
    const fp = stageFingerprint(current, stage);
    const at = "2026-11-07T10:00:00Z";
    state.stages.script = { status: "approved", approval: {
      by: { id: "project-owner", role: "owner" }, at, contentVersion: "script-v1",
      artifactSha256: current.script!.sha256, artifactEpoch: current.script!.epoch, fingerprint: fp,
      note: "I reviewed this exact script version.", evidence: [...STAGE_EVIDENCE.script],
      evidenceProofs: STAGE_EVIDENCE.script.map((key) => ({ key, file: "script.md", sha256: current.script!.sha256, epoch: current.script!.epoch, verifier: "test-verifier" })),
      prerequisiteApprovalSeq: [], approvalEventSeq: 1,
    } };
    // A manually constructed approved record, without a human audit event, is not valid.
    expect(toWorkflowApprovalView(state, current).script?.status).toBe("reapproval_required");
    state.history.push({ seq: 1, stage, action: "approve", by: "project-owner", at, fingerprint: fp });
    expect(toWorkflowApprovalView(state, current).script).toMatchObject({
      status: "approved", reviewer: "project-owner", version: "script-v1", reviewedAt: at,
    });
    const edited = structuredClone(current);
    edited.script = { version: "script-v2", sha256: sha("changed-script"), epoch: sha("changed-epoch") };
    const stale = toWorkflowApprovalView(state, edited).script;
    expect(stale?.status).toBe("reapproval_required");
    expect(stale?.reviewer).toBeUndefined();
    expect(stale?.reviewedAt).toBeUndefined();
  });

  it("shows invalidation and rejection notes but no invented author or approval timestamp", () => {
    const state = ledger();
    state.stages.voice = { status: "needs_reapproval", reason: "Audio bytes changed" };
    state.stages.av_review = { status: "rejected", reason: "Watch the full version again" };
    const view = toWorkflowApprovalView(state, input());
    expect(view.voice).toEqual({ status: "reapproval_required", note: "Audio bytes changed" });
    expect(view.review).toEqual({ status: "rejected", note: "Watch the full version again" });
    expect(view.review?.reviewer).toBeUndefined();
  });
});
