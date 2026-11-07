/**
 * Read-only contract for PR #77's durable workflow engine.
 * The trusted SERVER endpoint must call readWorkflow/reconcileWorkflow and
 * isCurrentApproval against freshly hashed artifacts before returning this data.
 * This client never signs, stores or infers approvals from other Studio checks.
 */
export const STAGES = ["script", "storyboard", "voice", "motion", "av_review", "master"] as const;
export type WorkflowStage = typeof STAGES[number];
export const STATUSES = ["draft", "in_review", "approved", "rejected", "needs_reapproval"] as const;
export type WorkflowStatus = typeof STATUSES[number];
export type ApprovalActor = { id: string; role: "owner" | "reviewer" };
export type WorkflowApproval = {
  by: ApprovalActor; at: string; contentVersion: string; artifactSha256: string;
  fingerprint: string; note: string; evidence: string[];
};
export type ReviewSubmission = {
  by: ApprovalActor; at: string; contentVersion: string; fingerprint: string; note: string;
};
export type WorkflowEvent = {
  seq: number; stage: WorkflowStage;
  action: "submit" | "approve" | "reject" | "reopen" | "invalidate" | "reset_review";
  by: string; at: string; contentVersion?: string; fingerprint?: string; note?: string;
};
export type WorkflowStageRecord = {
  status: WorkflowStatus; approval?: WorkflowApproval; submitted?: ReviewSubmission;
  reason?: string; currentApproval?: boolean;
};
export type WorkflowApprovalSnapshot = {
  schemaVersion: 1; channel: string; episode: string; revision: number;
  stages: Record<WorkflowStage, WorkflowStageRecord>;
  history: WorkflowEvent[];
};
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const string = (v: unknown): v is string => typeof v === "string";
const date = (v: unknown): v is string => string(v) && v.length > 0 && Number.isFinite(Date.parse(v));
const sha = (v: unknown): v is string => string(v) && /^[a-f0-9]{64}$/.test(v);
const actor = (v: unknown): v is ApprovalActor => object(v) && string(v.id) && Boolean(v.id.trim()) &&
  (v.role === "owner" || v.role === "reviewer");
const approval = (v: unknown): v is WorkflowApproval => object(v) && actor(v.by) &&
  v.by.role === "owner" && date(v.at) && string(v.contentVersion) && Boolean(v.contentVersion) &&
  sha(v.artifactSha256) && sha(v.fingerprint) && string(v.note) && Array.isArray(v.evidence) &&
  v.evidence.every(string);
const submitted = (v: unknown): v is ReviewSubmission => object(v) && actor(v.by) &&
  date(v.at) && string(v.contentVersion) && sha(v.fingerprint) && string(v.note);
const actions = ["submit", "approve", "reject", "reopen", "invalidate", "reset_review"];
const stageValid = (v: unknown): v is WorkflowStage => STAGES.includes(v as WorkflowStage);
const statusValid = (v: unknown): v is WorkflowStatus => STATUSES.includes(v as WorkflowStatus);

export const parseWorkflowReadModel = (raw: unknown, channel: string, episode: string): WorkflowApprovalSnapshot => {
  if (!object(raw) || raw.schemaVersion !== 1 || raw.channel !== channel || raw.episode !== episode ||
      !Number.isSafeInteger(raw.revision) || (raw.revision as number) < 0 ||
      !object(raw.stages) || !Array.isArray(raw.history)) throw new Error("سجل الاعتمادات لا يطابق القناة والحلقة أو صيغته غير صالحة.");
  const history: WorkflowEvent[] = [];
  for (let i = 0; i < raw.history.length; i++) {
    const e: unknown = raw.history[i];
    if (!object(e) || e.seq !== i + 1 || !stageValid(e.stage) || !actions.includes(String(e.action)) ||
        !string(e.by) || !date(e.at) ||
        (e.note !== undefined && !string(e.note)) ||
        (e.fingerprint !== undefined && !sha(e.fingerprint)) ||
        (e.contentVersion !== undefined && !string(e.contentVersion)))
      throw new Error("سجل أحداث الاعتماد غير صالح، لن تُعرض موافقة غير متحقَّق منها.");
    history.push(e as WorkflowEvent);
  }
  const stages = {} as Record<WorkflowStage, WorkflowStageRecord>;
  for (const key of STAGES) {
    const value = raw.stages[key];
    if (!object(value) || !statusValid(value.status) ||
        (value.reason !== undefined && !string(value.reason)) ||
        (value.approval !== undefined && !approval(value.approval)) ||
        (value.submitted !== undefined && !submitted(value.submitted)))
      throw new Error("بيانات مرحلة " + key + " غير موثوقة.");
    if (value.status === "in_review" && !submitted(value.submitted))
      throw new Error("مرحلة قيد المراجعة بلا طلب مراجعة صالح.");
    if (value.status === "approved") {
      // The server MUST recompute isCurrentApproval with current artifact bytes.
      // Never treat a persisted status alone, or a historical approval, as current.
      if (!approval(value.approval) || value.currentApproval !== true ||
          !history.some((e) => e.stage === key && e.action === "approve" &&
            e.by === (value.approval as WorkflowApproval).by.id &&
            e.at === (value.approval as WorkflowApproval).at &&
            e.fingerprint === (value.approval as WorkflowApproval).fingerprint))
        throw new Error("المرحلة " + key + " تفتقر إلى تحقق المحرك الحي من اعتمادها.");
    }
    if (value.status !== "approved" && value.currentApproval === true)
      throw new Error("حالة المرحلة " + key + " متناقضة مع صلاحية الاعتماد.");
    stages[key] = {
      status: value.status, ...(value.reason === undefined ? {} : { reason: value.reason }),
      ...(value.approval === undefined ? {} : { approval: value.approval }),
      ...(value.submitted === undefined ? {} : { submitted: value.submitted }),
      ...(value.status === "approved" ? { currentApproval: true } : {}),
    } as WorkflowStageRecord;
  }
  return { schemaVersion: 1, channel, episode, revision: raw.revision as number, stages, history };
};

export const workflowLabel = (status?: WorkflowStatus): string => {
  switch (status) {
    case "draft": return "مسودة";
    case "in_review": return "قيد المراجعة";
    case "approved": return "معتمدة";
    case "rejected": return "مرفوضة";
    case "needs_reapproval": return "تحتاج إعادة اعتماد";
    default: return "بيانات المحرك غير متاحة";
  }
};
