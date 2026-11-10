import React, { useEffect, useState } from "react";
import { api, type EpisodePreview, type PackageInfo, type ReviewSummary, type SceneProductionRead } from "../api";
import { arDigits, num, sceneName } from "../ui/format";
import { Hint, More, Stage } from "../shell/Screen";
import "../shell/screens-s45.css";

const CITATION_STATUS: Record<"pending" | "changed" | "verified" | "rejected", string> = {
  pending: "بانتظار التوثيق", changed: "تغيّر بعد التوثيق، يحتاج مراجعة", verified: "موثّق", rejected: "مرفوض",
};

type ReviewData = {
  citations: ReviewSummary | null;
  production: SceneProductionRead | null;
  pkg: PackageInfo | null;
  previews: EpisodePreview[];
  notes: { id: string; text: string; kind: "script" | "episode" }[];
};

/**
 * لوحة القرار («إنتاج المشاهد») فوق هذه الصفحة تعرض فيديو بنفسها حين يكون القرار مشهدًا أو تجميعًا؛
 * عندها لا نكرر الفيديو هنا. في غير ذلك (النسخة النهائية أو قبل اكتمال المشاهد) هذه الصفحة هي الشاشة.
 */
export const decisionShowsVideo = (p: SceneProductionRead | null): boolean => Boolean(
  p && p.script.approved && p.storyboard.approved &&
  (!p.progress.canAssemble ? Boolean(p.progress.currentScene) : Boolean(p.assembly && !p.assembly.approved)),
);

const mark = (on: boolean | undefined) => (on ? "✓" : "—");

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
          ...(scenes.status === "fulfilled" ? scenes.value.scenes.filter((x) => x.status === "needs_revision").map((x) => ({ id: x.id, text: `${sceneName(scenes.value.scenes.map((y) => y.id), x.id)}: يحتاج إعادة إنتاج ومراجعة بالصوت والصورة`, kind: "episode" as const })) : []),
        ],
      });
      setErrors([citations, scenes, pkg, previews].map((r, i) => r.status === "rejected" ? ["توثيق المصادر", "سجل إنتاج المشاهد", "ملف الفيديو", "المعاينات"][i]! : "").filter(Boolean));
    });
    return () => { live = false; };
  }, [episodeId]);

  const p = data?.production ?? null;
  const video = data?.pkg?.files.find((file) => file.name.endsWith("-episode.mp4"));
  // Never a player with no file (D52): only a preview that is actually on this device.
  const latestPreview = data?.previews.filter((f) => f.source === "local" || f.source === "drive-mirror").sort((a, b) => b.mtime - a.mtime)[0];
  const source = video ? api.packageUrl(episodeId, video.name) : latestPreview ? api.previewUrl(episodeId, latestPreview.name) : null;
  const render = data?.pkg?.render ?? null;
  const isMasterFile = Boolean(video && render?.quality === "master" && render.voiced);
  const hideVideo = decisionShowsVideo(p);

  const title = !p ? "الحلقة كاملة"
    : p.progress.masterApproved ? "النسخة النهائية معتمدة"
    : p.progress.assemblyApproved ? "النسخة النهائية"
    : "الحلقة كاملة";
  const meta = !data ? "جارٍ التحميل…"
    : video ? (isMasterFile ? `النسخة النهائية — ${arDigits(`${render!.width}×${render!.height}`)}` : "ملف مُنتج، ليس النسخة النهائية")
    : latestPreview ? "معاينة عمل" : "";
  const hint = !p ? "شاهد الحلقة كاملة بسرعة طبيعية ١×."
    : !p.progress.canAssemble ? "تُفتح هذه الخطوة بعد اعتماد كل المشاهد."
    : !p.progress.assemblyApproved ? "شاهد الحلقة كاملة بسرعة طبيعية ١× وافحص كل وصلة."
    : !p.progress.masterApproved ? "شاهد النسخة النهائية كاملة بسرعة طبيعية ١× ثم اعتمدها."
    : "معتمدة. إذن النشر قرار منفصل في «النشر».";

  return <main className="s45-page s45-review" aria-label="المراجعة المتكاملة للحلقة">
    <Stage title={hideVideo ? undefined : title} meta={hideVideo ? undefined : meta}>
      {errors.length > 0 ? <p className="s45-alert" role="alert">تعذر تحميل: {errors.join("، ")}.</p> : null}
      {hideVideo ? null : <>
        {source ? (
          <div className="s45-screen">
            <video key={source} controls preload="metadata" src={source} aria-label={video ? "معاينة ملف الحلقة المجمع" : "معاينة الحلقة للمراجعة"} />
          </div>
        ) : <p className="s45-note">{data ? "لا يوجد فيديو للحلقة بعد." : "جارٍ تحميل المعاينات…"}</p>}
        {source ? <Hint>{hint}</Hint> : null}
      </>}

      <More>
        <section className="s45-sec" aria-label="أدلة المراجعة الفنية">
          <h3>حالة المراجعة</h3>
          <dl className="s45-facts">
            <div><dt>المصادر الموثقة</dt><dd>{data?.citations ? `${num(data.citations.verified)} من ${num(data.citations.total)}` : "غير متاح"}</dd></div>
            <div><dt>المشاهد المعتمدة بالصوت والصورة</dt><dd>{p ? `${num(p.progress.approvedScenes)} من ${num(p.progress.totalScenes)}` : "غير متاح"}</dd></div>
            <div><dt>التجميع — النسخة النهائية — النشر</dt><dd>{p ? `${mark(p.progress.assemblyApproved)} — ${mark(p.progress.masterApproved)} — ${mark(p.progress.publishAllowed)}` : "غير متاح"}</dd></div>
          </dl>
          <p className="s45-note">ثلاثة قرارات مستقلة في «إنتاج المشاهد». وجود معاينة أو اكتمال الفحوص لا يمثل اعتمادًا للنسخة.</p>
          {source ? <p className="s45-note">الملف المعروض: {video ? "ملف الحلقة" : latestPreview?.title || "معاينة"} — {video ? (isMasterFile ? "النسخة النهائية، تُعتمد بعينها" : "ملف مُنتج؛ ليس اعتماد النسخة النهائية") : "معاينة عمل غير معتمدة للنشر"}</p> : null}
        </section>

        <section className="s45-sec" aria-label="ملاحظات المراجعة">
          <h3>ملاحظات تحتاج متابعة{data && data.notes.length ? <span className="s45-count">{num(data.notes.length)}</span> : null}</h3>
          {!data ? <p className="s45-note">جارٍ تحميل الملاحظات…</p> : data.notes.length === 0
            ? <p className="s45-note">لا ملاحظات مسجلة؛ هذا لا يثبت اكتمال المشاهدة.</p>
            : <ul className="s45-list">
              {data.notes.map((note) => <li key={`${note.kind}:${note.id}`}>
                <button type="button" onClick={() => onOpen(note.kind, note.kind === "episode" ? note.id : undefined)}>
                  <span>{note.text}</span><em>فتح الموضع</em>
                </button>
              </li>)}
            </ul>}
        </section>

        <nav className="s45-sec s45-links" aria-label="انتقال إلى أدوات مراجعة الحلقة">
          <h3>الأدوات الأصلية</h3>
          <div>
            <button type="button" className="btn ghost" onClick={() => onOpen("script")}>السكريبت والمصادر</button>
            <button type="button" className="btn ghost" onClick={() => onOpen("storyboard")}>لوحات الستوري بورد</button>
            <button type="button" className="btn ghost" onClick={() => onOpen("voice")}>الصوت</button>
            <button type="button" className="btn ghost" onClick={() => onOpen("episode")}>المشاهد والحركة</button>
            <button type="button" className="btn ghost" onClick={() => onOpen("publish")}>ملفات النسخة النهائية والتسليم</button>
          </div>
        </nav>
      </More>
    </Stage>
  </main>;
};
