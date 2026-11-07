import React from "react";
import {
  STAGES, workflowLabel,
  type WorkflowStage, type WorkflowApprovalSnapshot, type WorkflowStageRecord,
} from "./workflowReadModel";

export type { WorkflowStage, WorkflowApprovalSnapshot } from "./workflowReadModel";
export const WORKFLOW_STAGES: ReadonlyArray<{
  key: WorkflowStage; title: string; tab: "script" | "storyboard" | "voice" | "episode" | "review" | "publish";
}> = [
  { key: "script", title: "السكريبت والمصادر", tab: "script" },
  { key: "storyboard", title: "الستوري بورد", tab: "storyboard" },
  { key: "voice", title: "التعليق الصوتي", tab: "voice" },
  { key: "motion", title: "الحركة والمشاهد", tab: "episode" },
  { key: "av_review", title: "المراجعة المتكاملة", tab: "review" },
  { key: "master", title: "Master والنشر", tab: "publish" },
] as const;

export const approvalLabel = (record?: WorkflowStageRecord): string => workflowLabel(record?.status);
const formattedDate = (iso: string): string => {
  const timestamp = Date.parse(iso);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "تاريخ غير صالح";
};

export const WorkflowApprovalDetails: React.FC<{
  approvals?: WorkflowApprovalSnapshot | null;
  error?: string | null;
  technical?: Partial<Record<WorkflowStage, string>>;
}> = ({ approvals, error, technical }) => (
  <details className="ew-approval-details">
    <summary>الاعتمادات الرسمية وإصدارات المحتوى <span>قراءة من المحرك فقط · لا اعتماد من الواجهة</span></summary>
    {error ? <p className="ew-workflow-error" role="alert">{error} — لا تُعتبر أي مرحلة معتمدة.</p> : null}
    <div className="ew-approval-grid">
      {WORKFLOW_STAGES.map(({ key, title }, index) => {
        const record = approvals?.stages[key];
        const currentApproval = record?.status === "approved" && record.currentApproval === true;
        const previous = record?.approval;
        const person = currentApproval ? previous?.by.id :
          record?.status === "in_review" ? record.submitted?.by.id : undefined;
        const when = currentApproval ? previous?.at :
          record?.status === "in_review" ? record.submitted?.at : undefined;
        const version = currentApproval ? previous?.contentVersion :
          record?.status === "in_review" ? record.submitted?.contentVersion : previous?.contentVersion;
        const lastEvents = (approvals?.history ?? []).filter((event) => event.stage === key).slice(-3).reverse();
        return <article key={key} data-workflow-stage={key} data-workflow-status={record?.status ?? "unavailable"}>
          <div className="ew-approval-card-title"><strong>{index + 1}. {title}</strong><span>{approvalLabel(record)}</span></div>
          {record ? <>
            {record.reason ? <p className="ew-approval-reason" role="status">{record.reason}</p> : null}
            <dl>
              <dt>{currentApproval ? "صاحب الاعتماد" : record.status === "in_review" ? "مُقدّم المراجعة" : "المعتمد الحالي"}</dt>
              <dd>{person || "لا يوجد اعتماد سارٍ"}</dd>
              <dt>{currentApproval ? "تاريخ الاعتماد" : "تاريخ الطلب"}</dt>
              <dd>{when ? formattedDate(when) : "—"}</dd>
              <dt>إصدار المحتوى</dt><dd dir="auto">{version || "غير متاح"}</dd>
              {previous?.artifactSha256 && <><dt>بصمة الملف</dt><dd dir="ltr" className="ew-hash">{previous.artifactSha256}</dd></>}
              {currentApproval && previous?.note ? <><dt>ملاحظة الاعتماد</dt><dd>{previous.note}</dd></> : null}
              {record.status === "in_review" && record.submitted?.note ? <><dt>طلب المراجعة</dt><dd>{record.submitted.note}</dd></> : null}
              {record.status === "needs_reapproval" && previous ? <><dt>آخر اعتماد (ملغى)</dt><dd>{previous.by.id} · {formattedDate(previous.at)}</dd></> : null}
            </dl>
            {lastEvents.length ? <details className="ew-workflow-history"><summary>سجل الأحداث ({lastEvents.length} أخيرة)</summary>
              <ol>{lastEvents.map((event) => <li key={event.seq}><strong>{event.action}</strong> · {event.by} · {formattedDate(event.at)} {event.note ? <span>{event.note}</span> : null}</li>)}</ol>
            </details> : <small>لا توجد أحداث اعتماد مسجلة.</small>}
          </> : <small>لم تصل بيانات هذه المرحلة من محرك موثوق. الفحص الفني ليس اعتمادًا.</small>}
          <p className="ew-technical-evidence">الفحص الفني: {technical?.[key] ?? "غير متاح"}</p>
        </article>;
      })}
    </div>
    {approvals && <small className="ew-workflow-revision">مراجعة السجل {approvals.revision} · القناة <b dir="ltr">{approvals.channel}</b> · الحلقة <b dir="ltr">{approvals.episode}</b></small>}
  </details>
);
