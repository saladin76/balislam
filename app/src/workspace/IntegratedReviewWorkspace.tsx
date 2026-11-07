import React, { useEffect, useState } from "react";
import { api, type PackageInfo, type ReviewSummary, type SceneReviewSummary } from "../api";
import { parseWorkflowReadModel, workflowLabel, type WorkflowApprovalSnapshot } from "./workflowReadModel";

type ReviewData = {
  citations: ReviewSummary | null;
  scenes: SceneReviewSummary | null;
  pkg: PackageInfo | null;
  previews: { name: string; title: string; mtime: number; note: string }[];
  notes: { id: string; text: string; kind: "script" | "episode" }[];
};

/** Read-only, evidence-first AV review. Approval writes are owned by the workflow engine, not this screen. */
export const IntegratedReviewWorkspace: React.FC<{
  episodeId: string;
  channelId: string;
  onOpen: (stage: "script" | "storyboard" | "voice" | "episode" | "publish", sceneId?: string) => void;
}> = ({ episodeId, channelId, onOpen }) => {
  const [workflow, setWorkflow] = useState<WorkflowApprovalSnapshot | null>(null);
  const [workflowError, setWorkflowError] = useState("");
  useEffect(() => {
    let alive = true;
    setWorkflow(null);
    const refresh = async () => {
      try {
        const raw = await api.workflowApprovals(episodeId, channelId);
        const record = parseWorkflowReadModel(raw, channelId, episodeId);
        if (alive) { setWorkflow(record); setWorkflowError(""); }
      } catch (e) {
        if (alive) {
          setWorkflow(null);
          setWorkflowError("اعتماد AV الرسمي غير متاح: " + (e as Error).message);
        }
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [episodeId, channelId]);
  const [data, setData] = useState<ReviewData | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    setData(null); setErrors([]);
    const sources = [api.review(episodeId), api.sceneReview(episodeId), api.packageInfo(episodeId), api.previews(episodeId)] as const;
    void Promise.allSettled(sources).then(([citations, scenes, pkg, previews]) => {
      if (!live) return;
      setData({
        citations: citations.status === "fulfilled" ? citations.value.summary : null,
        scenes: scenes.status === "fulfilled" ? scenes.value.summary : null,
        pkg: pkg.status === "fulfilled" ? pkg.value : null,
        previews: previews.status === "fulfilled" ? previews.value.files : [],
        notes: [
          ...(citations.status === "fulfilled" ? citations.value.items.filter((x) => x.status !== "verified").map((x) => ({ id: x.key, text: x.note || `${x.label}: ${x.status}`, kind: "script" as const })) : []),
          ...(scenes.status === "fulfilled" ? scenes.value.items.filter((x) => x.status === "fix" || x.status === "changed" || Boolean(x.note)).map((x) => ({ id: x.id, text: x.note || `المشهد ${x.id}: ${x.status}`, kind: "episode" as const })) : []),
        ],
      });
      setErrors([citations, scenes, pkg, previews].map((r, i) => r.status === "rejected" ? ["توثيق المصادر", "مراجعات المشاهد", "ملف الفيديو", "المعاينات"][i]! : "").filter(Boolean));
    });
    return () => { live = false; };
  }, [episodeId]);

  const video = data?.pkg?.files.find((file) => file.name.endsWith("-episode.mp4"));
  const latestPreview = data?.previews.slice().sort((a, b) => b.mtime - a.mtime)[0];
  const source = video ? api.packageUrl(episodeId, video.name) : latestPreview ? api.previewUrl(episodeId, latestPreview.name) : null;

  return <main className="studio-review-workspace" aria-label="المراجعة المتكاملة للحلقة">
    <header className="studio-workspace-intro">
      <p className="studio-workspace-kicker">المرحلة 5 من 6 · مراجعة متكاملة</p>
      <h1>مراجعة الصورة والصوت معًا</h1>
      <p>شاهد الحلقة كاملة بسرعة طبيعية 1×، وسجّل الملاحظات في مواضعها داخل الأدوات الأصلية. وجود معاينة أو اكتمال الفحوص لا يمثل اعتمادًا للنسخة.</p>
    </header>
    {errors.length > 0 && <div className="studio-review-warning" role="alert">تعذر تحميل: {errors.join("، ")}. لا تعتمد على ملخص غير مكتمل.</div>}
    <section className="studio-review-screen" aria-label="معاينة الفيديو">
      {source ? <video key={source} controls preload="metadata" playsInline onRateChange={(event) => { event.currentTarget.playbackRate = 1; }} src={source} aria-label={video ? "معاينة ملف الحلقة المجمع" : "معاينة الحلقة للمراجعة"} /> : <div className="studio-review-no-video">{data ? "لا يوجد فيديو مجمع أو معاينة متاحة بعد." : "جارٍ تحميل المعاينات…"}</div>}
      <div className="studio-review-caption">
        <strong>{video ? "ملف الحلقة الحالي" : latestPreview ? latestPreview.title || latestPreview.name : "المعاينة الرئيسية"}</strong>
        <span>{video ? "ملف مُنتج؛ ليس اعتماد Master" : latestPreview ? "معاينة عمل غير معتمدة للنشر" : "لم يُنتج فيديو بعد"}</span>
      </div>
    </section>
    <section className="studio-review-evidence" aria-label="أدلة المراجعة الفنية">
      <article><span>المصادر الموثقة</span><strong>{data?.citations ? `${data.citations.verified}/${data.citations.total}` : "غير متاح"}</strong><small>فحص توثيق، لا اعتماد السكريبت</small></article>
      <article><span>المشاهد المراجَعة</span><strong>{data?.scenes ? `${data.scenes.ok}/${data.scenes.total}` : "غير متاح"}</strong><small>مراجعات منفردة، لا مراجعة AV كاملة</small></article>
      <article data-workflow-stage="av_review"><span>اعتماد AV الرسمي</span><strong>{workflowLabel(workflow?.stages.av_review?.status)}</strong>
        <small>{workflow?.stages.av_review?.status === "approved" ? `اعتماد ${workflow.stages.av_review.approval?.by.id} · ${workflow.stages.av_review.approval?.contentVersion}` :
          workflow?.stages.av_review?.reason || workflowError || "بانتظار الربط بمحرك الاعتمادات الموثوق"}</small></article>
    </section>
    <section className="studio-review-notes" aria-label="ملاحظات المراجعة">
      <h2>الملاحظات التي تحتاج متابعة</h2>
      {!data ? <p>جارٍ تحميل الملاحظات…</p> : data.notes.length === 0 ? <p>لا توجد ملاحظات مسجلة في مصادر المراجعة الحالية؛ هذا لا يثبت اكتمال مشاهدة AV.</p> :
        <div className="studio-review-notes-list">
          {data.notes.map((note) => <button type="button" key={`${note.kind}:${note.id}`} onClick={() => onOpen(note.kind, note.kind === "episode" ? note.id : undefined)}>
            <span dir="ltr">{note.id}</span><strong>{note.text}</strong><em>فتح الموضع</em>
          </button>)}
        </div>}
    </section>
    <div className="studio-review-actions" aria-label="انتقال إلى أدوات مراجعة الحلقة">
      <button type="button" onClick={() => onOpen("script")}>السكريبت والمصادر</button>
      <button type="button" onClick={() => onOpen("storyboard")}>لوحات Storyboard</button>
      <button type="button" onClick={() => onOpen("voice")}>الصوت</button>
      <button type="button" onClick={() => onOpen("episode")}>المشاهد والحركة</button>
      <button type="button" onClick={() => onOpen("publish")}>ملفات Master والتسليم</button>
    </div>
  </main>;
};
