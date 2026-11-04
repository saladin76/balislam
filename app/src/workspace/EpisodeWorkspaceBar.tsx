import React, { useEffect, useMemo, useState } from "react";
import { api, type CheckResult, type EpisodeStatus, type SceneReviewSummary, type ReviewSummary } from "../api";
import type { Plan } from "../../../src/plan/types";
import type { EpisodeMedia } from "../../../src/plan/media";
import type { PlanIssue } from "../../../src/plan/validate";

export type WorkspaceStage = "research" | "script" | "storyboard" | "voice" | "episode" | "publish";

const stages: { id: WorkspaceStage; title: string }[] = [
  { id: "research", title: "البحث" },
  { id: "script", title: "السكريبت" },
  { id: "storyboard", title: "الستوري بورد" },
  { id: "voice", title: "الصوت" },
  { id: "episode", title: "المشاهد" },
  { id: "publish", title: "النشر" },
];

/** واجهة عرض فقط؛ ليست مصدرًا جديدًا لحالة الاعتماد ولا تتجاوز بوابات المحرك. */
export const EpisodeWorkspaceBar: React.FC<{
  episodeId: string;
  title: string;
  stage: WorkspaceStage;
  onStage: (stage: WorkspaceStage, target?: { sceneId?: string; line?: number }) => void;
  check: CheckResult;
  issues: PlanIssue[];
  plan: Plan;
  media: EpisodeMedia;
  saveState: "saved" | "dirty" | "saving" | "error";
  scriptDirty: boolean;
}> = ({ episodeId, title, stage, onStage, check, issues, plan, media, saveState, scriptDirty }) => {
  const [review, setReview] = useState<ReviewSummary | null>(null);
  const [sceneReview, setSceneReview] = useState<SceneReviewSummary | null>(null);
  const [board, setBoard] = useState<{ ok: boolean; approved: number; total: number } | null>(null);
  const [published, setPublished] = useState<EpisodeStatus["published"] | null>(null);
  const [researchExists, setResearchExists] = useState<boolean | null>(null);
  const [showAll, setShowAll] = useState(false);

  // تُحدّث الملخصات عند تغيير الحلقة أو الخطة؛ اعتماد أي مرحلة يتم داخل مكوّنها الأصلي فقط.
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void Promise.allSettled([api.review(episodeId), api.sceneReview(episodeId), api.storyboard(episodeId), api.status(episodeId), api.research(episodeId)]).then(([r, s, b, p, research]) => {
        if (!alive) return;
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
  }, [episodeId, plan]);

  const narration = useMemo(() => plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration.trim()), [plan]);
  const missingAudio = narration.filter((s) => !media.voice[s.id] || media.voice[s.id]?.text !== s.narration.trim()).length;
  const notes: { id: string; stage: WorkspaceStage; text: string; critical: boolean; sceneId?: string; line?: number }[] = [
    ...check.issues.filter((i) => i.level === "error").map((i, n) => ({ id: `script-${n}`, stage: "script" as const, text: i.message, critical: true, line: i.line })),
    ...issues.filter((i) => i.level === "error").map((i, n) => ({ id: `plan-${n}`, stage: "episode" as const, text: i.message, critical: true, sceneId: i.sceneId === "-" ? undefined : i.sceneId })),
  ];
  if (scriptDirty) notes.unshift({ id: "unsaved-script", stage: "script", text: "السكريبت يحتوي على تغييرات غير محفوظة", critical: true });
  if (saveState === "error") notes.unshift({ id: "failed-save", stage: "episode", text: "تعذر حفظ تعديلات المشاهد؛ راجع الحفظ قبل المتابعة", critical: true });
  if (review && !review.ok) notes.push({ id: "citations", stage: "script", text: `الاستشهادات: ${review.verified} من ${review.total} معتمد`, critical: true });
  if (board && !board.ok) notes.push({ id: "storyboard", stage: "storyboard", text: `الستوري بورد: ${board.approved} من ${board.total} معتمد`, critical: false });
  if (missingAudio) notes.push({ id: "voice", stage: "voice", text: `${missingAudio} مشهدًا بلا صوت مطابق للنص الحالي`, critical: false });
  if (sceneReview && !sceneReview.done) notes.push({ id: "scenes", stage: "episode", text: `مراجعة المشاهد: ${sceneReview.ok} من ${sceneReview.total} سليم`, critical: false });
  const stageState = (id: WorkspaceStage): string => {
    if (id === "research") return researchExists ? "الملف موجود" : "ملف البحث";
    if (id === "script") return check.ok && review?.ok && !scriptDirty ? "مكتمل" : "مراجعة";
    if (id === "storyboard") return board?.ok ? "معتمد" : "بانتظار الاعتماد";
    if (id === "voice") return narration.length > 0 && missingAudio === 0 ? "الصوت جاهز" : "قيد العمل";
    if (id === "episode") return sceneReview?.done ? "المشاهد معتمدة" : "قيد المراجعة";
    return published ? "منشور" : "قيد العمل";
  };
  const visible = showAll ? notes : notes.slice(0, 3);
  const saveLabel = scriptDirty || saveState === "dirty" ? "تعديلات غير محفوظة" : saveState === "saving" ? "جارٍ الحفظ…" : saveState === "error" ? "تعذر الحفظ" : "تعديلات المشاهد محفوظة";

  return (
    <section className="episode-workspace-header" aria-label="مساحة عمل الحلقة">
      <div className="ew-heading">
        <div>
          <p className="ew-eyebrow">الحلقة {episodeId} · مساحة الإنتاج</p>
          <h1>{title || plan.title || "حلقة بلا عنوان"}</h1>
        </div>
        <span className={`ew-save ${saveState === "error" ? "error" : ""}`} role="status">{saveLabel}</span>
      </div>
      <nav className="ew-stages" aria-label="مراحل إنتاج الحلقة">
        {stages.map((item, index) => (
          <button key={item.id} type="button" className={`ew-stage ${stage === item.id ? "active" : ""}`}
            aria-current={stage === item.id ? "step" : undefined} onClick={() => onStage(item.id)}>
            <span className="ew-stage-number">{index + 1}</span>
            <span><strong>{item.title}</strong><small>{stageState(item.id)}</small></span>
          </button>
        ))}
      </nav>
      {notes.length ? (
        <div className="ew-attention" aria-label="ملاحظات الحلقة">
          <div className="ew-attention-title">
            <strong>ما الذي يحتاج انتباهك؟</strong>
            <span>{notes.filter((n) => n.critical).length} مهمة · {notes.length} ملاحظة</span>
          </div>
          <div className="ew-notes">
            {visible.map((n) => <button key={n.id} type="button" onClick={() => onStage(n.stage, { sceneId: n.sceneId, line: n.line })} title="افتح موضع الملاحظة">
              <span aria-hidden="true">{n.critical ? "●" : "○"}</span>{n.text}<span className="ew-note-action">فتح</span>
            </button>)}
          </div>
          {notes.length > 3 && <button type="button" className="ew-more" onClick={() => setShowAll(!showAll)}>{showAll ? "إخفاء التفاصيل" : `عرض ${notes.length - 3} ملاحظات إضافية`}</button>}
        </div>
      ) : <div className="ew-ready">لا توجد ملاحظات في الفحوص المتاحة. يبقى الاعتماد النهائي داخل مراحل الإنتاج.</div>}
    </section>
  );
};
