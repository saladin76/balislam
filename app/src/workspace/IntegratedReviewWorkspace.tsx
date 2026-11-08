import React, { useEffect, useState } from "react";
import { api, type PackageInfo, type ReviewSummary, type SceneProductionRead } from "../api";

const CITATION_STATUS: Record<"pending" | "changed" | "verified" | "rejected", string> = {
  pending: "بانتظار التوثيق", changed: "تغيّر بعد التوثيق، يحتاج مراجعة", verified: "موثّق", rejected: "مرفوض",
};

type ReviewData = {
  citations: ReviewSummary | null;
  production: SceneProductionRead | null;
  pkg: PackageInfo | null;
  previews: { name: string; title: string; mtime: number; note: string }[];
  notes: { id: string; text: string; kind: "script" | "episode" }[];
};

/** Read-only, evidence-first AV review. Approval writes are owned by the workflow engine, not this screen. */
export const IntegratedReviewWorkspace: React.FC<{
  episodeId: string;
  onOpen: (stage: "script" | "storyboard" | "voice" | "episode" | "publish", sceneId?: string) => void;
}> = ({ episodeId, onOpen }) => {
  const [data, setData] = useState<ReviewData | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    setData(null);
    const sources = [api.review(episodeId), api.sceneProduction(episodeId), api.packageInfo(episodeId), api.previews(episodeId)] as const;
    void Promise.allSettled(sources).then(([citations, scenes, pkg, previews]) => {
      if (!live) return;
      setData({
        citations: citations.status === "fulfilled" ? citations.value.summary : null,
        production: scenes.status === "fulfilled" ? scenes.value : null,
        pkg: pkg.status === "fulfilled" ? pkg.value : null,
        previews: previews.status === "fulfilled" ? previews.value.files : [],
        notes: [
          ...(citations.status === "fulfilled" ? citations.value.items.filter((x) => x.status !== "verified").map((x) => ({ id: x.key, text: x.note || `${x.label} ${x.ref}: ${CITATION_STATUS[x.status]}`, kind: "script" as const })) : []),
          ...(scenes.status === "fulfilled" ? scenes.value.scenes.filter((x) => x.status === "needs_revision").map((x) => ({ id: x.id, text: `المشهد ${x.id}: يحتاج إعادة إنتاج ومراجعة بالصوت والصورة`, kind: "episode" as const })) : []),
        ],
      });
      setErrors([citations, scenes, pkg, previews].map((r, i) => r.status === "rejected" ? ["توثيق المصادر", "سجل إنتاج المشاهد", "ملف الفيديو", "المعاينات"][i]! : "").filter(Boolean));
    });
    return () => { live = false; };
  }, [episodeId]);

  const video = data?.pkg?.files.find((file) => file.name.endsWith("-episode.mp4"));
  const latestPreview = data?.previews.slice().sort((a, b) => b.mtime - a.mtime)[0];
  const source = video ? api.packageUrl(episodeId, video.name) : latestPreview ? api.previewUrl(episodeId, latestPreview.name) : null;

  return <main className="studio-review-workspace" aria-label="المراجعة المتكاملة للحلقة">
    <header className="studio-workspace-intro">
      <p className="studio-workspace-kicker">مراجعة الحلقة كاملة</p>
      <h1>مراجعة الصورة والصوت معًا</h1>
      <p>شاهد الحلقة كاملة بسرعة طبيعية 1×، وسجّل الملاحظات في مواضعها داخل الأدوات الأصلية. وجود معاينة أو اكتمال الفحوص لا يمثل اعتمادًا للنسخة.</p>
    </header>
    {errors.length > 0 && <div className="studio-review-warning" role="alert">تعذر تحميل: {errors.join("، ")}. لا تعتمد على ملخص غير مكتمل.</div>}
    <section className="studio-review-screen" aria-label="معاينة الفيديو">
      {source ? <video key={source} controls preload="metadata" src={source} aria-label={video ? "معاينة ملف الحلقة المجمع" : "معاينة الحلقة للمراجعة"} /> : <div className="studio-review-no-video">{data ? "لا يوجد فيديو مجمع أو معاينة متاحة بعد." : "جارٍ تحميل المعاينات…"}</div>}
      <div className="studio-review-caption">
        <strong>{video ? "ملف الحلقة الحالي" : latestPreview ? latestPreview.title || latestPreview.name : "المعاينة الرئيسية"}</strong>
        <span>{video ? "ملف مُنتج؛ ليس اعتماد Master" : latestPreview ? "معاينة عمل غير معتمدة للنشر" : "لم يُنتج فيديو بعد"}</span>
      </div>
    </section>
    <section className="studio-review-evidence" aria-label="أدلة المراجعة الفنية">
      <article><span>المصادر الموثقة</span><strong>{data?.citations ? `${data.citations.verified}/${data.citations.total}` : "غير متاح"}</strong><small>فحص توثيق، لا اعتماد السكريبت</small></article>
      <article><span>المشاهد المعتمدة بالصوت والصورة</span><strong>{data?.production ? `${data.production.progress.approvedScenes}/${data.production.progress.totalScenes}` : "غير متاح"}</strong><small>من سجل «إنتاج المشاهد»</small></article>
      <article><span>التجميع · Master · النشر</span><strong>{!data?.production ? "غير متاح" : `${data.production.progress.assemblyApproved ? "✓" : "—"} · ${data.production.progress.masterApproved ? "✓" : "—"} · ${data.production.progress.publishAllowed ? "✓" : "—"}`}</strong><small>ثلاثة قرارات مستقلة في «إنتاج المشاهد»</small></article>
    </section>
    <section className="studio-review-notes" aria-label="ملاحظات المراجعة">
      <h2>الملاحظات التي تحتاج متابعة</h2>
      {!data ? <p>جارٍ تحميل الملاحظات…</p> : data.notes.length === 0 ? <p>لا توجد ملاحظات مسجلة في مصادر المراجعة الحالية؛ هذا لا يثبت اكتمال مشاهدة AV.</p> :
        <div className="studio-review-notes-list">
          {data.notes.map((note) => <button type="button" key={`${note.kind}:${note.id}`} onClick={() => onOpen(note.kind, note.kind === "episode" ? note.id : undefined)}>
            <span dir="auto">{note.id}</span><strong>{note.text}</strong><em>فتح الموضع</em>
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
