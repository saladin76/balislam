import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChannelsWorkspace } from "../app/src/tabs/ChannelsWorkspace";
import { OpsSectionNav } from "../app/src/tabs/OpsRoom";
import { IntegratedReviewWorkspace } from "../app/src/workspace/IntegratedReviewWorkspace";
import { EpisodeWorkspaceBar } from "../app/src/workspace/EpisodeWorkspaceBar";
import { WorkflowApprovalDetails, WORKFLOW_STAGES, approvalLabel } from "../app/src/workspace/WorkflowApprovalDetails";
import type { WorkflowApprovalSnapshot } from "../app/src/workspace/workflowReadModel";
import type { ChannelSummary, CheckResult } from "../app/src/api";
import type { Plan } from "../src/plan/types";
import type { EpisodeMedia } from "../src/plan/media";

const channels: ChannelSummary[] = [
  { id: "balislam", name: "بالإسلام", language: "ar", domains: {} },
  { id: "dafatir-alzaman", name: "دفاتر الزمن", language: "ar", domains: {} },
  { id: "zubdat-alkutub", name: "زبدة الكتب", language: "ar", domains: {} },
];

describe("Studio workspace separation", () => {
  it("provides independent channel cards with the original management destinations", () => {
    const html = renderToStaticMarkup(<ChannelsWorkspace channels={channels} activeId="balislam" onOpen={() => {}} />);
    for (const name of channels.map((channel) => channel.name)) expect(html).toContain(name);
    expect(html.match(/class="studio-channel-tile"/g)).toHaveLength(3);
    for (const label of ["حلقات القناة", "الإعدادات", "الهوية البصرية"]) expect(html).toContain(label);
    expect(html).toContain('aria-label="إدارة القنوات الثلاث"');
    expect(html).not.toContain("اعتماد تلقائي");
  });

  it("distinguishes channel list loading, empty results and recoverable API failure", () => {
    const base = { channels: [], activeId: "", onOpen: () => {}, onRetry: () => {} };
    const loading = renderToStaticMarkup(<ChannelsWorkspace {...base} loadState="loading" />);
    expect(loading).toContain("جارٍ تحميل سجلات القنوات");
    expect(loading).not.toContain("إعادة تحميل القنوات");
    const failed = renderToStaticMarkup(<ChannelsWorkspace {...base} loadState="error" />);
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("تعذر تحميل القنوات");
    expect(failed).toContain("إعادة تحميل القنوات");
    const empty = renderToStaticMarkup(<ChannelsWorkspace {...base} loadState="ready" />);
    expect(empty).toContain("لا توجد قنوات مسجلة");
  });

  it("gives the operations calendar, pipeline and idea bank accessible, focused navigation", () => {
    const html = renderToStaticMarkup(<OpsSectionNav active="pipeline" onSelect={() => {}} />);
    expect(html).toContain('aria-label="أقسام غرفة العمليات"');
    for (const id of ["ops-week", "ops-pipeline", "ops-ideas"]) expect(html).toContain(`aria-controls="${id}"`);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-controls="ops-pipeline" aria-pressed="true"/);
  });

  it("keeps the six official stages in order without replacing the source research tool", () => {
    expect(WORKFLOW_STAGES.map((stage) => stage.key)).toEqual(["script", "storyboard", "voice", "motion", "av_review", "master"]);
    expect(WORKFLOW_STAGES.map((stage) => stage.tab)).toEqual(["script", "storyboard", "voice", "episode", "review", "publish"]);
    const plan = { title: "حلقة تجريبية", chapters: [{ number: 1, scenes: [{ id: "c1-s1", narration: "" }] }] } as unknown as Plan;
    const check: CheckResult = { ok: true, issues: [], stats: { chapters: [], totalWords: 0, totalSeconds: 0 } };
    const html = renderToStaticMarkup(<EpisodeWorkspaceBar episodeId="001" channelId="balislam" title="حلقة تجريبية" stage="review"
      onStage={() => {}} check={check} issues={[]} plan={plan} media={{ voice: {} } as EpisodeMedia}
      saveState="saved" scriptDirty={false} />);
    expect(html).toContain("ملف البحث والتحضير");
    expect(html.match(/class="ew-stage /g)).toHaveLength(6);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("المراجعة المتكاملة");
    expect(html).toContain("بيانات المحرك غير متاحة");
    expect(html).not.toContain('data-workflow-status="approved"');
  });

  it("renders only externally supplied approval status, owner, timestamp, version and note", () => {
    const empty = renderToStaticMarkup(<WorkflowApprovalDetails />);
    expect(empty.match(/data-workflow-status="unavailable"/g)).toHaveLength(6);
    expect(empty).not.toContain("معتمدة");
    const approval = { by: { id: "المراجع المفوض", role: "owner" as const },
      at: "2026-11-07T10:00:00Z", contentVersion: "v1",
      fingerprint: "a".repeat(64), artifactSha256: "b".repeat(64), artifactEpoch: "c".repeat(64),
      approvalEventSeq: 1, prerequisiteApprovalSeq: [],
      note: "طابقت النسخة", evidence: ["script_validated"] };
    const stages: WorkflowApprovalSnapshot["stages"] = {
      script: { status: "approved", approval, currentApproval: true },
      storyboard: { status: "draft" },
      voice: { status: "needs_reapproval", reason: "تغير الملف الصوتي" },
      motion: { status: "in_review", submitted: { by: { id: "مراجع", role: "reviewer" }, at: "2026-11-07T09:00:00Z", contentVersion: "v2", fingerprint: "c".repeat(64), note: "بدء المراجعة" } },
      av_review: { status: "rejected", reason: "توجد ملاحظة بوقت محدد" },
      master: { status: "draft" },
    };
    const snapshot: WorkflowApprovalSnapshot = {
      schemaVersion: 3, channel: "balislam", episode: "001", revision: 7, stages,
      history: [{ seq: 1, stage: "script", action: "approve", by: "المراجع المفوض", at: approval.at,
        fingerprint: approval.fingerprint, note: approval.note }],
    };
    const html = renderToStaticMarkup(<WorkflowApprovalDetails approvals={snapshot} />);
    expect(html).toContain('data-workflow-status="approved"');
    expect(html).toContain("المراجع المفوض");
    // Arabic Intl dateStyle may be numeric or written depending on Node/ICU runtime.
    expect(html).toContain("تاريخ الاعتماد");
    expect(html).toContain(new Date(approval.at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }));
    expect(html).toContain("v1");
    expect(html).toContain("طابقت النسخة");
    expect(html).toContain("تحتاج إعادة اعتماد");
    expect(html).toContain("مرفوضة");
    expect(approvalLabel({ status: "in_review" })).toBe("قيد المراجعة");
    expect(approvalLabel()).toBe("بيانات المحرك غير متاحة");
  });

  it("never displays a prior approval as current for an unsaved local script, plan or research draft", () => {
    const plan = { title: "Draft", chapters: [{ number: 1, scenes: [] }] } as unknown as Plan;
    const check: CheckResult = { ok: true, issues: [], stats: { chapters: [], totalWords: 0, totalSeconds: 0 } };
    const dirty = renderToStaticMarkup(<EpisodeWorkspaceBar episodeId="001" channelId="balislam"
      title="Draft" stage="script" onStage={() => {}} check={check} issues={[]} plan={plan}
      media={{ voice: {} } as EpisodeMedia} saveState="dirty" scriptDirty={true} researchDirty={true} />);
    expect(dirty).toContain("الاعتمادات السابقة لا تخص هذه المسودة");
    expect(dirty).not.toContain('data-workflow-status="approved"');
    const av = renderToStaticMarkup(<IntegratedReviewWorkspace episodeId="001" channelId="balislam"
      hasUnsavedChanges onOpen={() => {}} />);
    expect(av).toContain("الاعتماد السابق لا يغطي هذه المسودة");
    expect(av).not.toContain("اعتماد Master");
  });

  it("keeps integrated AV review read-only and clearly distinct from Master approval", () => {
    const html = renderToStaticMarkup(<IntegratedReviewWorkspace episodeId="001" channelId="balislam" onOpen={() => {}} />);
    expect(html).toContain('aria-label="المراجعة المتكاملة للحلقة"');
    expect(html).toContain("بسرعة طبيعية 1×");
    expect(html).toContain("بيانات المحرك غير متاحة");
    expect(html).toContain("ملفات Master والتسليم");
    expect(html).not.toContain("اعتماد الحلقة الآن");
  });
});
