import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  parseWorkflowReadModel, STAGES, STATUSES, workflowLabel,
  type WorkflowApprovalSnapshot,
} from "../app/src/workspace/workflowReadModel";
import { WorkflowApprovalDetails } from "../app/src/workspace/WorkflowApprovalDetails";

const sha = (char: string) => char.repeat(64);
const approved = {
  by: { id: "صاحب المشروع", role: "owner" },
  at: "2026-11-07T09:00:00Z", contentVersion: "v7",
  artifactSha256: sha("a"), artifactEpoch: sha("c"), fingerprint: sha("b"),
  approvalEventSeq: 1, prerequisiteApprovalSeq: [],
  note: "اعتمدت المادة بعد مراجعة كاملة وتوثيق الأدلة", evidence: ["script_validated", "sources_reviewed", "quran_compared"],
};
const make = (): Record<string, any> => ({
  schemaVersion: 3, channel: "balislam", episode: "001", revision: 3,
  stages: Object.fromEntries(STAGES.map((stage) => [stage, { status: "draft" }])),
  history: [],
});
const parse = (raw: unknown) => parseWorkflowReadModel(raw, "balislam", "001");

describe("trust-boundary for Studio workflow approval presentation", () => {
  it("uses exactly six PR #77 stage keys and five engine status strings", () => {
    expect(STAGES).toEqual(["script", "storyboard", "voice", "motion", "av_review", "master"]);
    expect(STATUSES).toEqual(["draft", "in_review", "approved", "rejected", "needs_reapproval"]);
    for (const status of STATUSES) expect(workflowLabel(status)).not.toBe("بيانات المحرك غير متاحة");
  });

  it("does not convert a persisted green status into a displayed approval without current server verification", () => {
    const raw = make();
    raw.stages.script = { status: "approved", approval: approved };
    expect(() => parse(raw)).toThrow(/تحقق المحرك الحي/);
    raw.stages.script.currentApproval = true;
    expect(() => parse(raw)).toThrow(/تحقق المحرك الحي/); // No matching human approval event.
    raw.history = [{ seq: 1, stage: "script", action: "approve", by: approved.by.id,
      at: approved.at, fingerprint: approved.fingerprint, note: approved.note }];
    const model = parse(raw);
    expect(model.stages.script.status).toBe("approved");
    expect(model.stages.script.approval?.by.id).toBe("صاحب المشروع");
    expect(model.stages.script.approval?.contentVersion).toBe("v7");
    const html = renderToStaticMarkup(<WorkflowApprovalDetails approvals={model} />);
    expect(html).toContain('data-workflow-stage="script"');
    expect(html).toContain('data-workflow-status="approved"');
    expect(html).toContain("صاحب المشروع");
    expect(html).toContain("v7");
    expect(html).toContain(approved.note);
  });

  it("requires signed-engine v3 epoch and the exact owner approval event number", () => {
    const raw = make();
    raw.stages.script = { status: "approved", approval: { ...approved }, currentApproval: true };
    raw.history = [{ seq: 1, stage: "script", action: "approve", by: approved.by.id,
      at: approved.at, fingerprint: approved.fingerprint }];
    expect(parse(raw).schemaVersion).toBe(3);
    raw.stages.script.approval.artifactEpoch = undefined;
    expect(() => parse(raw)).toThrow(/غير موثوقة/);
    raw.stages.script.approval.artifactEpoch = sha("c");
    raw.stages.script.approval.approvalEventSeq = 2;
    expect(() => parse(raw)).toThrow(/حدث اعتماد/);
    raw.stages.script.approval.approvalEventSeq = 1;
    raw.stages.script.approval.prerequisiteApprovalSeq = [2];
    expect(() => parse(raw)).toThrow(/حدث اعتماد/);
    raw.stages.script.approval.prerequisiteApprovalSeq = [];
    expect(parse(raw).stages.script.currentApproval).toBe(true);
  });

  it("preserves invalidation reason and history but never labels a stale approval as current", () => {
    const raw = make();
    raw.stages.voice = { status: "needs_reapproval", approval: approved, reason: "MP3 تغيّر بعد الاعتماد" };
    raw.history = [{ seq: 1, stage: "voice", action: "invalidate", by: "system",
      at: "2026-11-07T10:00:00Z", note: "MP3 تغيّر بعد الاعتماد" }];
    const model = parse(raw);
    const html = renderToStaticMarkup(<WorkflowApprovalDetails approvals={model} />);
    expect(html).toContain('data-workflow-stage="voice"');
    expect(html).toContain('data-workflow-status="needs_reapproval"');
    expect(html).toContain("آخر اعتماد (ملغى)");
    expect(html).toContain("MP3 تغيّر بعد الاعتماد");
    expect(html).not.toMatch(/data-workflow-stage="voice" data-workflow-status="approved"/);
  });

  it("supports rejected and in-review records without assigning an approver", () => {
    const raw = make();
    raw.stages.av_review = { status: "rejected", reason: "الانتقالات غير متزامنة" };
    raw.stages.storyboard = { status: "in_review", submitted: { by: { id: "مراجع", role: "reviewer" },
      at: "2026-11-07T09:00:00Z", fingerprint: sha("c"), contentVersion: "v3", note: "بانتظار اعتماد اللوحات" } };
    const html = renderToStaticMarkup(<WorkflowApprovalDetails approvals={parse(raw)} />);
    expect(html).toContain('data-workflow-stage="av_review" data-workflow-status="rejected"');
    expect(html).toContain("مُقدّم المراجعة");
    expect(html).toContain("الانتقالات غير متزامنة");
  });

  it("fails closed on partial, corrupt or cross-channel records", () => {
    const cases: unknown[] = [
      null,
      { ...make(), episode: "002" },
      { ...make(), channel: "zubdat-alkutub" },
      { ...make(), schemaVersion: 1 },
      { ...make(), stages: { ...make().stages, av_review: undefined } },
      { ...make(), stages: { ...make().stages, av_review: { status: "reapproval_required" } } },
      { ...make(), stages: { ...make().stages, av_review: { status: "approved" } } },
      { ...make(), stages: { ...make().stages, voice: { status: "in_review" } } },
      { ...make(), history: [{ seq: 2, stage: "script", action: "approve", by: "owner", at: approved.at }] },
    ];
    for (const raw of cases) expect(() => parse(raw)).toThrow();
    expect(renderToStaticMarkup(<WorkflowApprovalDetails error="السجل تالف" />)).toContain("لا تُعتبر أي مرحلة معتمدة");
  });

  it("rejects a false server-verified flag on a rejected or invalidated stage", () => {
    const raw = make();
    raw.stages.script = { status: "needs_reapproval", currentApproval: true, reason: "تغيّر السكريبت" };
    expect(() => parse(raw)).toThrow(/متناقضة/);
  });

  it("does not mutate engine payloads or pretend a bare technical check approved anything", () => {
    const raw = make();
    const before = JSON.stringify(raw);
    const model: WorkflowApprovalSnapshot = parse(raw);
    expect(JSON.stringify(raw)).toBe(before);
    expect(STAGES.every((key) => model.stages[key].status === "draft")).toBe(true);
    expect(renderToStaticMarkup(<WorkflowApprovalDetails technical={{ script: "فحص ناجح" }} />))
      .not.toContain('data-workflow-status="approved"');
  });
});
