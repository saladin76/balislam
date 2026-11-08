import React, { useState } from "react";
import { api } from "../api";
import type { WorkflowStage } from "../../../src/workflow/gates";
import type { WorkflowApprovalView } from "../../../src/workflow/uiProjection";
import { WORKFLOW_STAGES, approvalLabel } from "./WorkflowApprovalDetails";

type Action = "submit" | "approve" | "reject" | "reopen";
const actions: { key: Action; title: string }[] = [
  { key: "submit", title: "تقديم المرحلة للمراجعة" },
  { key: "approve", title: "اعتماد صريح للنسخة الحالية" },
  { key: "reject", title: "رفض المرحلة وإضافة ملاحظة" },
  { key: "reopen", title: "إعادة فتح المرحلة للمراجعة" },
];

/** Never stores or transmits the owner key except in a direct, explicit user action. */
export const WorkflowOwnerControls: React.FC<{
  episodeId: string;
  channelId?: string;
  approvals: WorkflowApprovalView;
  fingerprints: Partial<Record<WorkflowStage, string>>;
  onUpdated: () => void;
}> = ({ episodeId, channelId = "", approvals, fingerprints, onUpdated }) => {
  const [stage, setStage] = useState<WorkflowStage>("script");
  const [action, setAction] = useState<Action>("submit");
  const [token, setToken] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const selected = WORKFLOW_STAGES.find(s => s.key === (stage === "av_review" ? "review" : stage));
  const status = approvals[selected?.key ?? "script"];
  const expectedFingerprint = fingerprints[stage];
  const needsListen = action === "approve" && ["voice", "av_review", "master"].includes(stage);
  const canAct = Boolean(expectedFingerprint && token.trim() && note.trim().length >= 15 &&
    (!needsListen || confirmed) && !working);
  const confirmLabel = stage === "voice"
    ? "استمعت إلى التعليق الصوتي كاملًا وأعتمد هذه النسخة نفسها"
    : stage === "av_review"
      ? "شاهدت وسمعت الحلقة كاملة بالسرعة الطبيعية 1× وأغلقت ملاحظاتي"
      : "شاهدت ملف Master النهائي نفسه وتحققت من حقوق النشر وأعتمده صراحةً";

  const decide = async () => {
    if (!canAct || !expectedFingerprint) return;
    setWorking(true);
    setError("");
    setDone("");
    try {
      await api.workflowDecision(episodeId, channelId, token, {
        stage, action, expectedFingerprint, note: note.trim(), confirmWatched: confirmed,
      });
      setDone("تم تسجيل القرار في سجل الاعتمادات؛ راجع حالة المرحلة وإصدارها الحالي.");
      setNote("");
      setConfirmed(false);
      onUpdated();
      window.dispatchEvent(new CustomEvent("studio-workflow-updated", { detail: { episodeId } }));
    } catch (e) {
      setError((e as Error).message || "تعذّر تسجيل القرار.");
      onUpdated();
    } finally { setWorking(false); }
  };

  return <details className="ew-owner-controls">
    <summary>قرارات صاحب المشروع · اعتماد يدوي موثّق</summary>
    <p>هذه الإجراءات لا تنفذ رندرًا أو نشرًا. تتطلب رمز المالك السري، وملاحظة واضحة، وبصمة الإصدار الحالي. لا يُحفظ الرمز في المتصفح.</p>
    <div className="ew-owner-fields">
      <label>المرحلة
        <select value={stage} onChange={e => { setStage(e.target.value as WorkflowStage); setError(""); setDone(""); setConfirmed(false); }}>
          {WORKFLOW_STAGES.map(s => <option key={s.key} value={s.key === "review" ? "av_review" : s.key}>{s.title}</option>)}
        </select>
      </label>
      <label>الإجراء
        <select value={action} onChange={e => { setAction(e.target.value as Action); setConfirmed(false); }}>
          {actions.map(a => <option key={a.key} value={a.key}>{a.title}</option>)}
        </select>
      </label>
      <label>رمز مالك المشروع
        <input value={token} type="password" autoComplete="off" spellCheck={false}
          onChange={e => setToken(e.target.value)} placeholder="رمز خاص محفوظ في بيئة Studio المحلية" />
      </label>
      <label className="ew-owner-note">ملاحظة القرار (15 حرفًا على الأقل)
        <textarea rows={3} maxLength={2000} value={note}
          onChange={e => setNote(e.target.value)} placeholder="ما الذي راجعته في هذا الإصدار، وما هو قرارك؟" />
      </label>
    </div>
    <p className="ew-owner-status">الحالة الحالية: <strong>{approvalLabel(status)}</strong> · بصمة المحتوى: <code dir="ltr">{expectedFingerprint?.slice(0, 16) ?? "غير متاحة"}</code></p>
    {needsListen ? <label className="ew-owner-confirm">
      <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
      <span>{confirmLabel}</span>
    </label> : null}
    {error ? <p role="alert" className="ew-owner-error">{error}</p> : null}
    {done ? <p role="status" className="ew-owner-success">{done}</p> : null}
    <button type="button" className="ew-owner-submit" onClick={() => void decide()} disabled={!canAct}>
      {working ? "جارٍ التحقق من النسخة والمراجعات…" : actions.find(a => a.key === action)?.title}
    </button>
    <small>لا يبدأ الإنتاج الحركي النهائي قبل اعتماد الصوت كاملًا، ولا يمكن نشر Master قبل موافقتك على بصمة ملفه النهائي.</small>
  </details>;
};
