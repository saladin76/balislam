import React, { useEffect, useState } from "react";
import { api, type PackageInfo, type ReviewSummary, type SceneReviewSummary } from "../api";

type ReviewData = {
  citations: ReviewSummary | null;
  scenes: SceneReviewSummary | null;
  pkg: PackageInfo | null;
  previews: { name: string; title: string; mtime: number; note: string }[];
};

/** Read-only, evidence-first AV review. Approval writes are owned by the workflow engine, not this screen. */
export const IntegratedReviewWorkspace: React.FC<{
  episodeId: string;
  onOpen: (stage: "script" | "storyboard" | "voice" | "episode" | "publish") => void;
}> = ({ episodeId, onOpen }) => {
  const [data, setData] = useState<ReviewData | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    setData(null);
    const sources = [api.review(episodeId), api.sceneReview(episodeId), api.packageInfo(episodeId), api.previews(episodeId)] as const;
    void Promise.allSettled(sources).then(([citations, scenes, pkg, previews]) => {
      if (!live) return;
      setData({
        citations: citations.status === "fulfilled" ? citations.value.summary : null,
        scenes: scenes.status === "fulfilled" ? scenes.value.summary : null,
        pkg: pkg.status === "fulfilled" ? pkg.value : null,
        previews: previews.status === "fulfilled" ? previews.value.files : [],
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
      {source ? <video key={source} controls preload="metadata" src={source} aria-label={video ? "معاينة ملف الحلقة المجمع" : "معاينة الحلقة للمراجعة"} /> : <div className="studio-review-no-video">{data ? "لا يوجد فيديو مجمع أو معاينة متاحة بعد." : "جارٍ تحميل المعاينات…"}</div>}
      <div className="studio-review-caption">
        <strong>{video ? "ملف الحلقة الحالي" : latestPreview ? latestPreview.title || latestPreview.name : "المعاينة الرئيسية"}</strong>
        <span>{video ? "ملف مُنتج؛ ليس اعتماد Master" : latestPreview ? "معاينة عمل غير معتمدة للنشر" : "لم يُنتج فيديو بعد"}</span>
      </div>
    </section>
    <section className="studio-review-evidence" aria-label="أدلة المراجعة الفنية">
      <article><span>المصادر الموثقة</span><strong>{data?.citations ? `${data.citations.verified}/${data.citations.total}` : "غير متاح"}</strong><small>فحص توثيق، لا اعتماد السكريبت</small></article>
      <article><span>المشاهد المراجَعة</span><strong>{data?.scenes ? `${data.scenes.ok}/${data.scenes.total}` : "غير متاح"}</strong><small>مراجعات منفردة، لا مراجعة AV كاملة</small></article>
      <article><span>اعتماد AV الرسمي</span><strong>بانتظار المحرك</strong><small>يُربط بمحرك الاعتمادات الموحد لاحقًا</small></article>
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
