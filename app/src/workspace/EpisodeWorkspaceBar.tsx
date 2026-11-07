import React, { useEffect, useMemo, useState } from "react";
import { api, type CheckResult, type EpisodeStatus, type SceneReviewSummary, type ReviewSummary } from "../api";
import type { Plan } from "../../../src/plan/types";
import type { EpisodeMedia } from "../../../src/plan/media";
import type { PlanIssue } from "../../../src/plan/validate";
import { WORKFLOW_STAGES, WorkflowApprovalDetails, approvalLabel, type WorkflowApprovalSnapshot, type WorkflowStage } from "./WorkflowApprovalDetails";
import { parseWorkflowReadModel } from "./workflowReadModel";

export type WorkspaceStage = "research" | "script" | "storyboard" | "voice" | "episode" | "review" | "publish";

/** واجهة عرض فقط؛ ليست مصدرًا جديدًا لحالة الاعتماد ولا تتجاوز بوابات المحرك. */
export const EpisodeWorkspaceBar: React.FC<{
  episodeId: string;
  channelId: string;
  title: string;
  stage: WorkspaceStage;
  onStage: (stage: WorkspaceStage, target?: { sceneId?: string; line?: number }) => void;
  check: CheckResult;
  issues: PlanIssue[];
  plan: Plan;
  media: EpisodeMedia;
  saveState: "saved" | "dirty" | "saving" | "error";
  scriptDirty: boolean;
  researchDirty?: boolean;
  identityDirty?: boolean;
}> = ({ episodeId, channelId, title, stage, onStage, check, issues, plan, media, saveState, scriptDirty, researchDirty = false, identityDirty = false }) => {
  const [approvals, setApprovals] = useState<WorkflowApprovalSnapshot | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setApprovals(null);
    setWorkflowError(null);
    const refresh = async () => {
      try {
        const raw = await api.workflowApprovals(episodeId, channelId);
        const parsed = parseWorkflowReadModel(raw, channelId, episodeId);
        if (alive) { setApprovals(parsed); setWorkflowError(null); }
      } catch (error) {
        if (alive) {
          setApprovals(null); // Never display a stale green approval after a failed refresh.
          setWorkflowError((error as Error).message.includes("404") || (error as Error).message.includes("مسار غير معروف")
            ? "بانتظار ربط واجهة القراءة بمحرك الاعتمادات الموثوق"
            : "تعذر التحقق من سجل الاعتمادات: " + String((error as Error).message));
        }
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [episodeId, channelId, plan]);
  const [review, setReview] = useState<ReviewSummary | null>(null);
  const [sceneReview, setSceneReview] = useState<SceneReviewSummary | null>(null);
  const [board, setBoard] = useState<{ ok: boolean; approved: number; total: number } | null>(null);
  const [published, setPublished] = useState<EpisodeStatus["published"] | null>(null);
  const [researchExists, setResearchExists] = useState<boolean | null>(null);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [unavailableChecks, setUnavailableChecks] = useState(0);

  // تُحدّث الملخصات عند تغيير الحلقة أو الخطة؛ لا تمنح هذه الواجهة أي اعتماد؛ تعرض سجلات الفحوص الأصلية فقط.
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void Promise.allSettled([api.review(episodeId), api.sceneReview(episodeId), api.storyboard(episodeId), api.status(episodeId), api.research(episodeId)]).then(([r, s, b, p, research]) => {
        if (!alive) return;
        setUnavailableChecks([r, s, b, p, research].filter((item) => item.status === "rejected").length);
        setReview(r.status === "fulfilled" ? r.value.summary : null);
        setSceneReview(s.status === "fulfilled" ? s.value.summary : null);
        setBoard(b.status === "fulfilled" ? b.value.status : null);
        setPublished(p.status === "fulfilled" ? p.value.published ?? null : null);
        setResearchExists(research.status === "fulfilled" ? research.value.exists : null);
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [episodeId, plan, stage]);

  const narration = useMemo(() => plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration.trim()), [plan]);
  const missingAudio = narration.filter((s) => !media.voice[s.id] || media.voice[s.id]?.text !== s.narration.trim()).length;
  const notes: { id: string; stage: WorkspaceStage; text: string; critical: boolean; sceneId?: string; line?: number }[] = [
    ...check.issues.filter((i) => i.level === "error").map((i, n) => ({ id: `script-${n}`, stage: "script" as const, text: i.message, critical: true, line: i.line })),
    ...issues.filter((i) => i.level === "error").map((i, n) => ({ id: `plan-${n}`, stage: "episode" as const, text: i.message, critical: true, sceneId: i.sceneId === "-" ? undefined : i.sceneId })),
  ];
  if (unavailableChecks) notes.unshift({ id: "unavailable-checks", stage, text: `تعذر جلب ${unavailableChecks} من تقارير حالة الحلقة؛ لا يمكن تأكيد اكتمال المراجعات الآن`, critical: true });
  if (researchDirty) notes.unshift({ id: "unsaved-research", stage: "research", text: "ملف البحث يحتوي على تعديلات غير محفوظة", critical: true });
  if (identityDirty) notes.unshift({ id: "unsaved-identity", stage: "episode", text: "الهوية البصرية تتضمن تعديلات غير محفوظة؛ اعتمادات المشاهد السابقة لا تخص هذه المسودة", critical: true });
  if (scriptDirty) notes.unshift({ id: "unsaved-script", stage: "script", text: "السكريبت يحتوي على تغييرات غير محفوظة", critical: true });
  if (saveState === "error") notes.unshift({ id: "failed-save", stage: "episode", text: "تعذر حفظ تعديلات المشاهد؛ راجع الحفظ قبل المتابعة", critical: true });
  if (review && !review.ok) notes.push({ id: "citations", stage: "script", text: `الاستشهادات: ${review.verified} من ${review.total} موثّق`, critical: true });
  if (board && !board.ok) notes.push({ id: "storyboard", stage: "storyboard", text: `لوحات Storyboard: ${board.approved} من ${board.total} اجتازت مراجعة اللوحات الحالية`, critical: false });
  if (missingAudio) notes.push({ id: "voice", stage: "voice", text: `${missingAudio} مشهدًا بلا صوت مطابق للنص الحالي`, critical: false });
  if (sceneReview && !sceneReview.done) notes.push({ id: "scenes", stage: "episode", text: `مراجعة المشاهد: ${sceneReview.ok} من ${sceneReview.total} سليم`, critical: false });
  const technical: Partial<Record<WorkflowStage, string>> = {
    script: `المصادر: ${review ? `${review.verified}/${review.total} موثّقة` : "لم يُحمّل سجل المصادر"}؛ ${check.ok && !scriptDirty ? "فحص النص بلا أخطاء" : "النص يحتاج مراجعة"}؛ البحث: ${researchExists === null ? "غير متاح" : researchExists ? "موجود" : "غير موجود"}`,
    storyboard: board ? `مراجعة اللوحات الحالية: ${board.approved}/${board.total} (لا تعادل اعتماد المحرك)` : "تقرير اللوحات غير متاح",
    voice: `المقاطع الصوتية المطابقة: ${narration.length - missingAudio}/${narration.length}؛ لا يثبت الاستماع أو الاعتماد`,
    motion: sceneReview ? `مراجعة المشاهد: ${sceneReview.ok}/${sceneReview.total}؛ لا تعادل اعتماد الحركة` : "مراجعة المشاهد غير متاحة",
    av_review: "تتطلب مشاهدة الفيلم كاملًا بالصوت والصورة بسرعة طبيعية وتوثيق الملاحظات",
    master: published ? "توجد بيانات نشر؛ الاعتماد الرسمي يحتاج سجله الخاص" : "لا يثبت الرندر أو وجود الملفات موافقة صاحب المشروع",
  };
  const visible = showAll ? notes : notes.slice(0, 3);
  // The backend verifies persisted bytes; an unsaved editor draft is a different version.
  // Hide green approvals instead of presenting the last saved version as approved.
  const localChanges = scriptDirty || researchDirty || identityDirty || saveState !== "saved";
  const visibleApprovals = localChanges ? null : approvals;
  const visibleWorkflowError = localChanges
    ? "توجد تعديلات محلية غير محفوظة أو قيد الحفظ؛ الاعتمادات السابقة لا تخص هذه المسودة."
    : workflowError;
  const saveLabel = scriptDirty || researchDirty || saveState === "dirty" ? "تعديلات غير محفوظة" : saveState === "saving" ? "جارٍ الحفظ…" : saveState === "error" ? "تعذر الحفظ" : "تعديلات المشاهد محفوظة";

  return (
    <section className="episode-workspace-header" aria-label="مساحة عمل الحلقة">
      <div className="ew-heading">
        <div>
          <p className="ew-eyebrow">الحلقة {episodeId} · مساحة الإنتاج</p>
          <h1>{title || plan.title || "حلقة بلا عنوان"}</h1>
        </div>
        <div className="ew-heading-actions"><button type="button" className="ew-research-shortcut" onClick={() => onStage("research")} aria-current={stage === "research" ? "step" : undefined}>ملف البحث والتحضير</button><span className={`ew-save ${saveState === "error" ? "error" : ""}`} role="status">{saveLabel}</span></div>
      </div>
      <nav className="ew-stages" aria-label="مراحل إنتاج الحلقة">
        {WORKFLOW_STAGES.map((item, index) => (
          <button key={item.key} type="button" className={`ew-stage ${stage === item.tab || (stage === "research" && item.key === "script") ? "active" : ""}`}
            aria-current={stage === item.tab || (stage === "research" && item.key === "script") ? "step" : undefined}
            onClick={() => onStage(item.tab)}>
            <span className="ew-stage-number">{index + 1}</span>
            <span><strong>{item.title}</strong><small>{approvalLabel(visibleApprovals?.stages[item.key])}</small></span>
          </button>
        ))}
      </nav>
      <WorkflowApprovalDetails approvals={visibleApprovals} error={visibleWorkflowError} technical={technical} />
      {notes.length ? (
        <div className="ew-attention" aria-label="ملاحظات الحلقة">
          <button className="ew-attention-title" type="button" aria-expanded={attentionOpen}
            aria-controls="ew-attention-details" onClick={() => setAttentionOpen((open) => !open)}>
            <strong>ما الذي يحتاج انتباهك؟</strong>
            <span>{notes.filter((n) => n.critical).length} مهمة · {notes.length} ملاحظة</span>
            <span aria-hidden="true">{attentionOpen ? "▴" : "▾"}</span>
          </button>
          {attentionOpen ? (
            <div id="ew-attention-details" className="ew-attention-details">
              <div className="ew-notes">
                {visible.map((n) => <button key={n.id} type="button" onClick={() => onStage(n.stage, { sceneId: n.sceneId, line: n.line })} title="افتح موضع الملاحظة">
                  <span aria-hidden="true">{n.critical ? "●" : "○"}</span>{n.text}<span className="ew-note-action">فتح</span>
                </button>)}
              </div>
              {notes.length > 3 ? <button type="button" className="ew-more" onClick={() => setShowAll((all) => !all)}>
                {showAll ? "عرض أقل" : `عرض ${notes.length - 3} ملاحظات إضافية`}
              </button> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
