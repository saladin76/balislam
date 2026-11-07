import React from "react";

/** Presentation contract only: the workflow engine must provide verified records.
 * This file does not fetch, infer, persist or issue approvals.
 */
export type WorkflowStage = "script" | "storyboard" | "voice" | "motion" | "review" | "master";
export type WorkflowApprovalStatus = "draft" | "in_review" | "approved" | "rejected" | "reapproval_required";
export type WorkflowApprovalRecord = {
  status: WorkflowApprovalStatus;
  reviewer?: string;
  reviewedAt?: string;
  version?: string;
  note?: string;
};
export type WorkflowApprovalSnapshot = Partial<Record<WorkflowStage, WorkflowApprovalRecord>>;

export const WORKFLOW_STAGES: ReadonlyArray<{ key: WorkflowStage; title: string; tab: "script" | "storyboard" | "voice" | "episode" | "review" | "publish" }> = [
  { key: "script", title: "السكريبت والمصادر", tab: "script" },
  { key: "storyboard", title: "Storyboard", tab: "storyboard" },
  { key: "voice", title: "التعليق الصوتي", tab: "voice" },
  { key: "motion", title: "الحركة والمشاهد", tab: "episode" },
  { key: "review", title: "المراجعة المتكاملة", tab: "review" },
  { key: "master", title: "Master والنشر", tab: "publish" },
] as const;

export const approvalLabel = (record?: WorkflowApprovalRecord): string => {
  if (!record) return "بانتظار ربط المحرك";
  switch (record.status) {
    case "draft": return "مسودة";
    case "in_review": return "قيد المراجعة";
    case "approved": return "معتمدة";
    case "rejected": return "مرفوضة";
    case "reapproval_required": return "تحتاج إعادة اعتماد";
  }
};

/** Every visible approval and its owner/version/date must originate in the unified workflow engine. */
export const WorkflowApprovalDetails: React.FC<{ approvals?: WorkflowApprovalSnapshot; technical?: Partial<Record<WorkflowStage, string>> }> = ({ approvals, technical }) => (
  <details className="ew-approval-details">
    <summary>حالات الاعتماد وإصدارات المحتوى <span>للعرض فقط · دون اعتماد تلقائي</span></summary>
    <div className="ew-approval-grid">
      {WORKFLOW_STAGES.map(({ key, title }, index) => {
        const record = approvals?.[key];
        return <article key={key} data-workflow-stage={key} data-workflow-status={record?.status || "unavailable"}>
          <div className="ew-approval-card-title"><strong>{index + 1}. {title}</strong><span>{approvalLabel(record)}</span></div>
          <p>{technical?.[key] || "لا تتوفر بيانات فحص فني لهذه المرحلة."}</p>
          {record ? (
            <dl>
              <dt>المعتمد</dt><dd>{record.reviewer || "غير مسجل"}</dd>
              <dt>التاريخ</dt><dd>{record.reviewedAt || "غير مسجل"}</dd>
              <dt>إصدار المحتوى</dt><dd dir="auto">{record.version || "غير مسجل"}</dd>
              {record.note && <><dt>الملاحظة</dt><dd>{record.note}</dd></>}
            </dl>
          ) : <small>لم يصل سجل اعتماد موثّق من المحرك. نتائج الفحص الفنية لا تمنح الاعتماد.</small>}
        </article>;
      })}
    </div>
  </details>
);
