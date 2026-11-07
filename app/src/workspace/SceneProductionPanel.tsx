import React, { useEffect, useState } from "react";
import { api, type SceneProductionRead, type SceneOwnerAction } from "../api";
import "./scene-production.css";

type Props = {
  episodeId: string;
  channelId: string;
  onOpenScene: (id: string) => void;
  onOpenStoryboard: () => void;
  onOpenScript: () => void;
  onOpenPublish: () => void;
};

/**
 * The only visible approval surface for scene-first Studio V2.
 * Never infer approval from a video existing or a checkbox in the browser.
 * All decisions are server-authenticated, bound to real bytes and serialized.
 */
export const SceneProductionPanel: React.FC<Props> = ({
  episodeId, channelId, onOpenScene, onOpenStoryboard, onOpenScript, onOpenPublish,
}) => {
  const [data, setData] = useState<SceneProductionRead | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sessionSecret, setSessionSecret] = useState("");
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState(false);

  const refresh = async () => {
    const result = await api.sceneProduction(episodeId, channelId);
    setData(result);
    setError("");
  };
  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    setNote("");
    setReviewed(false);
    void api.sceneProduction(episodeId, channelId).then(
      value => { if (alive) setData(value); },
      cause => { if (alive) setError((cause as Error).message); },
    );
    return () => { alive = false; };
  }, [episodeId, channelId]);

  const currentId = data?.progress.currentScene ?? null;
  const scene = data?.scenes.find(item => item.id === currentId);
  const candidate = currentId ? data?.candidates.scenes[currentId] : null;
  const previewUrl = currentId && candidate ? api.previewUrl(episodeId, `scene-${currentId}-av.mp4`) : "";
  const allApproved = Boolean(data?.progress.canAssemble);
  const stages = [
    { title: "إعداد الحلقة", done: Boolean(data?.script.approved) },
    { title: "Storyboard", done: Boolean(data?.storyboard.approved) },
    { title: "إنتاج المشاهد", done: allApproved },
    { title: "مراجعة الحلقة", done: Boolean(data?.assembly) },
    { title: "Master والنشر", done: Boolean(data?.master?.approved) },
  ];

  const act = async (action: SceneOwnerAction["action"], expectedSha256: string, sceneId?: string) => {
    if (!data || pending || !sessionSecret.trim()) return setError("فعّل جلسة المالك المحلية أولًا.");
    if (["approve-script", "approve-storyboard", "approve-scene", "approve-master"].includes(action) && !reviewed)
      return setError("أكّد المراجعة البشرية الفعلية قبل الاعتماد.");
    if (action === "correct-scene" && !note.trim())
      return setError("اكتب ملاحظة التصحيح قبل إعادة المشهد.");
    setPending(true);
    setError("");
    try {
      const updated = await api.decideScene(episodeId, channelId, sessionSecret, {
        action, expectedSha256, ...(sceneId ? { sceneId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(reviewed ? { confirmedWatched: true } : {}),
      });
      // Server returned a read model, but its current file candidates may have changed.
      setData(updated);
      const fresh = await api.sceneProduction(episodeId, channelId);
      setData(fresh);
      setNote("");
      setReviewed(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="scene-first-panel" aria-label="إنتاج ومراجعة المشاهد بالصوت والصورة">
      <header className="scene-first-heading">
        <div>
          <p className="scene-first-eyebrow">Studio V2 · إنتاج شخصي</p>
          <h2>أكمل من المشهد الحالي</h2>
          <p>راجع نتيجة واحدة بالصوت والصورة. السجلات والفحوص التقنية تعمل في الخلفية.</p>
        </div>
        <button className="btn small" type="button" onClick={() => void refresh().catch(e => setError((e as Error).message))}>
          تحديث الحالة
        </button>
      </header>
      <ol className="scene-first-stages">
        {stages.map((stage, index) => (
          <li key={stage.title} className={stage.done ? "is-complete" : ""}>
            <b>{stage.done ? "✓" : index + 1}</b>
            <span>{stage.title}</span>
          </li>
        ))}
      </ol>
      {!data && !error ? <p role="status">جارٍ تحميل حالة الحلقة…</p> : null}
      {error ? <p className="scene-first-error" role="alert">{error}</p> : null}
      {!data ? null : (
        <div className="scene-first-content">
          {!data.script.approved ? (
            <div className="scene-first-task">
              <h3>راجع السكريبت واعتمد النسخة الأصلية</h3>
              <button className="btn small" type="button" onClick={onOpenScript}>فتح السكريبت والمصادر</button>
            </div>
          ) : !data.storyboard.approved ? (
            <div className="scene-first-task">
              <h3>اعتمد Storyboard كاملًا قبل إنتاج المشهد الأول</h3>
              <p>راجع عدد المشاهد والصور والكاميرا والإضاءة والنص والنبرة.</p>
              <button className="btn small" type="button" onClick={onOpenStoryboard}>فتح Storyboard PDF</button>
            </div>
          ) : currentId && scene ? (
            <>
              <div className="scene-first-current">
                <h3>المشهد الحالي: <span dir="ltr">{currentId}</span></h3>
                <span>{data.progress.approvedScenes} من {data.progress.totalScenes} مشاهد معتمدة</span>
              </div>
              <div className="scene-first-meter" role="progressbar" aria-valuenow={data.progress.approvedScenes} aria-valuemin={0} aria-valuemax={data.progress.totalScenes}>
                <span style={{ width: `${100 * data.progress.approvedScenes / Math.max(1, data.progress.totalScenes)}%` }} />
              </div>
              {previewUrl ? (
                <video className="scene-first-video" controls preload="metadata" src={previewUrl}
                  aria-label={`معاينة المشهد ${currentId} بالصوت والصورة`} />
              ) : (
                <div className="scene-first-empty">لم تُنتج معاينة الفيديو والصوت لهذا المشهد بعد.</div>
              )}
              <p className="scene-first-hint">
                {scene.readyForAv
                  ? "الصوت المربوط بالنص متاح. راجع الفيديو كاملًا قبل اعتماده."
                  : "أكمل التعليق الصوتي أو التلاوة البشرية المرفوعة والمراجَعة قبل إنتاج المشهد."}
              </p>
              <button className="btn small" type="button" onClick={() => onOpenScene(currentId)}>فتح أدوات المشهد</button>
            </>
          ) : allApproved && !data.assembly ? (
            <div className="scene-first-task">
              <h3>اكتملت مراجعة كل المشاهد</h3>
              <p>ادمج النسخ المعتمدة، ثم راجع الحلقة كاملة بسرعة 1×.</p>
              <button className="btn small" type="button" onClick={onOpenPublish}>فتح التجميع</button>
            </div>
          ) : data.assembly && !data.master ? (
            <div className="scene-first-task">
              <h3>راجع الحلقة كاملة واعتمد Master النهائي</h3>
              <button className="btn small" type="button" onClick={onOpenPublish}>فتح مراجعة الحلقة</button>
            </div>
          ) : (
            <div className="scene-first-task">
              <h3>Master معتمد</h3>
              <p>لا يتم النشر تلقائيًا. افتح صفحة النشر لمراجعة المخرجات.</p>
              <button className="btn small" type="button" onClick={onOpenPublish}>فتح النشر</button>
            </div>
          )}

          <details className="scene-first-approval">
            <summary>المراجعة والاعتماد</summary>
            <p>أكّد المراجعة مرة واحدة عند اتخاذ القرار. لا يُعتمد أي مشهد آليًا.</p>
            <label className="scene-first-field">
              <span>جلسة المالك المحلية (لا تُحفظ في المتصفح)</span>
              <input type="password" autoComplete="off" value={sessionSecret}
                onChange={event => setSessionSecret(event.target.value)} placeholder="رمز الجلسة" />
            </label>
            <label className="scene-first-field">
              <span>ملاحظة أو طلب تصحيح</span>
              <textarea rows={2} value={note} onChange={event => setNote(event.target.value)}
                placeholder="مثال: الثانية 00:08 — حركة الكاميرا سريعة" />
            </label>
            <label className="scene-first-confirm">
              <input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />
              راجعت الملف أو النص المطلوب بنفسي، بالصوت والصورة عند اعتماد مشهد أو حلقة.
            </label>
            <div className="scene-first-actions">
              {!data.script.approved && (
                <button className="btn primary" disabled={pending || !reviewed} onClick={() => void act("approve-script", data.script.sha256)}>اعتماد السكريبت</button>
              )}
              {data.script.approved && !data.storyboard.approved && (
                <button className="btn primary" disabled={pending || !reviewed} onClick={() => void act("approve-storyboard", data.storyboard.sha256)}>اعتماد Storyboard</button>
              )}
              {scene && currentId && scene.readyForAv && candidate && scene.status !== "in_review" && (
                <button className="btn primary" disabled={pending} onClick={() => void act("submit-scene", scene.sourceSha256, currentId)}>إرسال المشهد للمراجعة</button>
              )}
              {scene && currentId && scene.status === "in_review" && scene.previewSha256 && (
                <>
                  <button className="btn primary" disabled={pending || !reviewed} onClick={() => void act("approve-scene", scene.previewSha256!, currentId)}>اعتماد المشهد بالصوت والصورة</button>
                  <button className="btn" disabled={pending || !note.trim()} onClick={() => void act("correct-scene", scene.previewSha256!, currentId)}>طلب تعديل</button>
                </>
              )}
              {allApproved && !data.assembly && data.candidates.assemblySha256 && (
                <button className="btn primary" disabled={pending} onClick={() => void act("assemble", data.candidates.assemblySha256!)}>تسجيل النسخة المجمعة</button>
              )}
              {data.assembly && !data.master && data.candidates.masterSha256 && (
                <button className="btn primary" disabled={pending || !reviewed} onClick={() => void act("approve-master", data.candidates.masterSha256!)}>اعتماد Master بعد المشاهدة 1×</button>
              )}
            </div>
          </details>
          <p className="scene-first-disclaimer">اعتماد المشهد لا يغني عن مشاهدة الحلقة كاملة أو التأكد من الحقوق. التغييرات تُبطل الاعتمادات المتأثرة تلقائيًا.</p>
        </div>
      )}
    </section>
  );
};
