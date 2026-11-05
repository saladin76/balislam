/**
 * «المراجعات الفنية» (الأمر 018): تقارير المنفّذ بتوقيتاتها، مع الفيديو الكامل لكل هدف (فتح وتنزيل)، والشرائط المرجعية ومقاطع الملاحظات.
 * التوصية للمنفّذ، والقرار للمشرف: لا شيء هنا يغيّر حالة اعتماد. المصدر: tech-reviews/<المعرّف>/ بجوار الحلقة أو المختبر.
 */
import React, { useEffect, useState } from "react";
import { api } from "../api";
import { Markdown } from "../ui/Markdown";
import type { TechReviewSummary } from "../../../src/channel/techReviews";

const REC: Record<TechReviewSummary["recommendation"], string> = { ready: "جاهز للاعتماد البصري", fixes: "يحتاج إصلاحات محددة" };

export const TechReviewsTab: React.FC<{ channel: string }> = ({ channel }) => {
  const [list, setList] = useState<TechReviewSummary[] | null>(null);
  const [sel, setSel] = useState(0);
  // التقرير مربوط بمراجعته، فلا يُعرض تقرير مراجعة بوسائط مراجعة أخرى عند التبديل
  const [report, setReport] = useState<{ key: string; text: string } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setList(null);
    api.techReviews(channel).then((r) => setList(r.reviews), (e: Error) => setErr(e.message));
  }, [channel]);
  const r = list?.[sel];
  useEffect(() => {
    setReport(null);
    if (!r?.hasReport) return;
    const key = `${r.dir}/${r.id}`;
    fetch(api.techReviewFileUrl(channel, r.dir, r.id, "report.md")).then((x) => (x.ok ? x.text() : Promise.reject(new Error(String(x.status))))).then((text) => setReport({ key, text }), (e: Error) => setErr(e.message));
  }, [channel, r?.dir, r?.id, r?.hasReport]);

  if (err) return <div className="panel"><p className="err">{err}</p></div>;
  if (!list) return <div className="panel"><p className="muted">جارٍ تحميل المراجعات…</p></div>;
  if (!list.length || !r) return <div className="panel"><p className="muted">لا مراجعات فنية لهذه القناة.</p></div>;

  const fileUrl = (rel: string) => api.techReviewFileUrl(channel, r.dir, r.id, rel);
  const videoUrl = (t: TechReviewSummary["targets"][number]) => (t.kind === "lab" ? api.labPreviewUrl(channel, t.dir, t.preview) : api.previewUrl(t.dir.slice(0, 3), t.preview));
  const sep = (u: string) => (u.includes("?") ? "&" : "?");

  return (
    <div className="labs-tab treviews" dir="rtl">
      <header className="labs-head">
        <h2>المراجعات الفنية</h2>
        <p className="help">تقارير مراجعة بتوقيتاتها الدقيقة. <b>التوصية للمنفّذ والقرار للمشرف</b>؛ المراجعة لا تغيّر حالة اعتماد أي حلقة أو مختبر.</p>
        {list.length > 1 ? (
          <nav className="treviews-nav">
            {list.map((x, i) => (
              <button key={`${x.dir}/${x.id}`} className={i === sel ? "active" : ""} onClick={() => setSel(i)}>
                {x.title}
              </button>
            ))}
          </nav>
        ) : null}
      </header>

      <section className="lab-card">
        <div className="lab-title">
          <h3>{r.title}</h3>
          <span className={`lab-badge ${r.recommendation === "ready" ? "lab-approved" : "lab-experimental"}`}>توصية المنفّذ: {REC[r.recommendation]}</span>
          <span className={`lab-badge ${r.supervisorDecision ? "lab-review" : ""}`}>قرار المشرف: {r.supervisorDecision ? r.supervisorDecision.decision : "لم يُتخذ بعد"}</span>
          <span className="help">{r.order ? `الأمر ${r.order} · ` : ""}{r.date} · {r.author} · <code dir="ltr">{r.dir}/tech-reviews/{r.id}</code></span>
        </div>
        <p>{r.summary}</p>

        <h4>الفيديو الكامل</h4>
        <div className="sb-previews-grid">
          {r.targets.map((t) => (
            <figure key={t.label} className="sb-preview">
              <video src={videoUrl(t)} controls preload="metadata" playsInline />
              <figcaption>
                <b>{t.label}</b>
                {t.duration ? <span className="help">{t.duration}</span> : null}
                {t.note ? <span className="err">{t.note}</span> : null}
                <span>
                  <a href={videoUrl(t)} target="_blank" rel="noreferrer">فتح</a> · <a href={`${videoUrl(t)}${sep(videoUrl(t))}download=1`} download={`${t.dir}-${t.preview}`}>تنزيل</a>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>

        {report && report.key === `${r.dir}/${r.id}` ? <article className="guide-page"><Markdown text={report.text} onLink={() => undefined} resolveMedia={(src) => (/^(strips|clips)\/[\w.-]+\.(jpg|mp4)$/.test(src) ? fileUrl(src) : null)} /></article> : null}

        {r.strips.length ? (
          <details className="treviews-strips">
            <summary>كل الشرائط المرجعية ({r.strips.length}) — لقطتان في الثانية لكل مشهد بتوقيتها</summary>
            {r.strips.map((s) => (
              <figure key={s} className="md-media">
                <a href={fileUrl(`strips/${s}`)} target="_blank" rel="noreferrer"><img src={fileUrl(`strips/${s}`)} alt={s} loading="lazy" /></a>
                <figcaption><code dir="ltr">{s.replace(/^strip-|\.jpg$/g, "")}</code></figcaption>
              </figure>
            ))}
          </details>
        ) : null}
      </section>
    </div>
  );
};
