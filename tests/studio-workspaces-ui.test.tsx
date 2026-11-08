import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChannelsWorkspace } from "../app/src/tabs/ChannelsWorkspace";
import { OpsSectionNav } from "../app/src/tabs/OpsRoom";
import { IntegratedReviewWorkspace } from "../app/src/workspace/IntegratedReviewWorkspace";
import { EpisodeWorkspaceBar } from "../app/src/workspace/EpisodeWorkspaceBar";
import { WorkflowApprovalDetails, WORKFLOW_STAGES, approvalLabel } from "../app/src/workspace/WorkflowApprovalDetails";
import { WorkflowOwnerControls } from "../app/src/workspace/WorkflowOwnerControls";
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

  it("gives the operations calendar, pipeline and idea bank accessible, focused navigation", () => {
    const html = renderToStaticMarkup(<OpsSectionNav active="pipeline" onSelect={() => {}} />);
    expect(html).toContain('aria-label="أقسام غرفة العمليات"');
    for (const id of ["ops-week", "ops-pipeline", "ops-ideas"]) expect(html).toContain(`aria-controls="${id}"`);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-controls="ops-pipeline" aria-pressed="true"/);
  });

  it("keeps the six official stages in order without replacing the source research tool", () => {
    expect(WORKFLOW_STAGES.map((stage) => stage.key)).toEqual(["script", "storyboard", "voice", "motion", "review", "master"]);
    expect(WORKFLOW_STAGES.map((stage) => stage.tab)).toEqual(["script", "storyboard", "voice", "episode", "review", "publish"]);
    const plan = { title: "حلقة تجريبية", chapters: [{ number: 1, scenes: [{ id: "c1-s1", narration: "" }] }] } as unknown as Plan;
    const check: CheckResult = { ok: true, issues: [], stats: { chapters: [], totalWords: 0, totalSeconds: 0 } };
    const html = renderToStaticMarkup(<EpisodeWorkspaceBar episodeId="001" title="حلقة تجريبية" stage="review"
      onStage={() => {}} check={check} issues={[]} plan={plan} media={{ voice: {} } as EpisodeMedia}
      saveState="saved" scriptDirty={false} />);
    expect(html).toContain("ملف البحث والتحضير");
    expect(html.match(/class="ew-stage /g)).toHaveLength(6);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("المراجعة المتكاملة");
    expect(html).toContain("بانتظار ربط المحرك");
    expect(html).not.toContain('data-workflow-status="approved"');
  });

  it("renders only externally supplied approval status, owner, timestamp, version and note", () => {
    const empty = renderToStaticMarkup(<WorkflowApprovalDetails />);
    expect(empty.match(/data-workflow-status="unavailable"/g)).toHaveLength(6);
    expect(empty).not.toContain("معتمدة");
    const html = renderToStaticMarkup(<WorkflowApprovalDetails approvals={{
      script: { status: "approved", reviewer: "المراجع المفوض", reviewedAt: "2026-11-07T10:00:00Z", version: "sha256:example", note: "طابقت النسخة" },
      voice: { status: "reapproval_required", version: "v2" },
      review: { status: "rejected", note: "توجد ملاحظة بوقت محدد" },
    }} />);
    expect(html).toContain('data-workflow-status="approved"');
    expect(html).toContain("المراجع المفوض");
    expect(html).toContain("2026-11-07T10:00:00Z");
    expect(html).toContain("sha256:example");
    expect(html).toContain("طابقت النسخة");
    expect(html).toContain("تحتاج إعادة اعتماد");
    expect(html).toContain("مرفوضة");
    expect(approvalLabel({ status: "in_review" })).toBe("قيد المراجعة");
    expect(approvalLabel()).toBe("بانتظار ربط المحرك");
  });

  it("renders manual owner controls collapsed, without storing secret or granting automatic approvals", () => {
    const html = renderToStaticMarkup(<WorkflowOwnerControls episodeId="001" channelId="balislam"
      approvals={{ script: { status: "draft" } }} fingerprints={{ script: "a".repeat(64) }}
      onUpdated={() => {}} />);
    expect(html).toContain("قرارات صاحب المشروع");
    expect(html).toContain("رمز مالك المشروع");
    expect(html).toContain('type="password"');
    expect(html).toContain("اعتماد صريح للنسخة الحالية");
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("تم تسجيل القرار");
  });

  it("keeps integrated AV review read-only and clearly distinct from Master approval", () => {
    const html = renderToStaticMarkup(<IntegratedReviewWorkspace episodeId="001" onOpen={() => {}} />);
    expect(html).toContain('aria-label="المراجعة المتكاملة للحلقة"');
    expect(html).toContain("بسرعة طبيعية 1×");
    expect(html).toContain("ثلاثة قرارات مستقلة في «إنتاج المشاهد»");
    expect(html).toContain("ملفات Master والتسليم");
    expect(html).not.toContain("اعتماد الحلقة الآن");
  });
});
