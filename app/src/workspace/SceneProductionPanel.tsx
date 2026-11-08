import React, { useEffect, useState } from "react";
import { api, type SceneProductionRead, type SceneOwnerAction } from "../api";
import { channelProductionProfile } from "../../../src/channel/productionRules";
import "./scene-production.css";

type Props = {
  episodeId: string;
  channelId: string;
  onOpenScene: (id: string) => void;
  onOpenStoryboard: () => void;
  onOpenScript: () => void;
  onOpenPublish: () => void;
  onUpdated?: () => void;
};

/**
 * The only visible approval surface for scene-first Studio V2.
 * Never infer approval from a video existing or a checkbox in the browser.
 * All decisions are server-authenticated, bound to real bytes and serialized.
 */
export const SceneProductionPanel: React.FC<Props> = ({
  episodeId, channelId, onOpenScene, onOpenStoryboard, onOpenScript, onOpenPublish, onUpdated,
}) => {
  const [data, setData] = useState<SceneProductionRead | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sessionSecret, setSessionSecret] = useState("");
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  // كلمة مرور المالك: يختارها مرة واحدة، ويكتبها في كل جلسة (لا تُحفظ في المتصفح)
  const [passSet, setPassSet] = useState<boolean | null>(null);
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  // وصلات المشاهد التي فحصها المالك في النسخة المجمعة
  const [seams, setSeams] = useState<Record<string, boolean>>({});
  useEffect(() => { void api.ownerPassphrase().then((r) => setPassSet(r.set), () => setPassSet(null)); }, []);
  const createPassphrase = async () => {
    if (newPass.length < 8) return setError("كلمة مرور المالك من 8 أحرف على الأقل.");
    if (newPass !== newPass2) return setError("الكلمتان غير متطابقتين.");
    try {
      await api.setOwnerPassphrase(newPass);
      setPassSet(true);
      setSessionSecret(newPass);
      setNewPass(""); setNewPass2(""); setError("");
    } catch (e) { setError((e as Error).message); }
  };

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
    setSeams({});
    void api.sceneProduction(episodeId, channelId).then(
      value => { if (alive) setData(value); },
      cause => { if (alive) setError((cause as Error).message); },
    );
    return () => { alive = false; };
  }, [episodeId, channelId]);

  const renderCurrentScene = async (sceneId: string, sourceSha256: string) => {
    if (!sessionSecret.trim()) {
      setError("فعّل جلسة المالك المحلية أولًا لتشغيل المعاينة.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await api.renderSceneAv(episodeId, channelId, sessionSecret, sceneId, sourceSha256);
      await refresh();
      onUpdated?.();
      setReviewed(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  const assembleScenes = async () => {
    if (!sessionSecret.trim()) return setError("فعّل جلسة المالك المحلية قبل تجميع المشاهد.");
    setPending(true);
    setError("");
    try {
      await api.assembleSceneAv(episodeId, channelId, sessionSecret);
      await refresh();
      onUpdated?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  const humanReviewFocus = channelProductionProfile({ id: channelId }).reviewFocus;
  const currentId = data?.progress.currentScene ?? null;
  const scene = data?.scenes.find(item => item.id === currentId);
  const candidate = currentId ? data?.candidates.scenes[currentId] : null;
  const previewUrl = currentId && candidate ? api.previewUrl(episodeId, `scene-${currentId}-av.mp4`) : "";
  const allApproved = Boolean(data?.progress.canAssemble);

  const act = async (action: SceneOwnerAction["action"], expectedSha256: string, sceneId?: string) => {
    if (!data || pending || !sessionSecret.trim()) return setError("فعّل جلسة المالك المحلية أولًا.");
    if (["approve-script", "approve-storyboard", "approve-scene", "approve-assembly", "approve-master", "grant-publish"].includes(action) && !reviewed)
      return setError("أكّد المراجعة البشرية الفعلية قبل الاعتماد.");
    const seamsChecked = action === "approve-assembly" ? (data.seams ?? []).filter((x) => seams[x]) : undefined;
    if (action === "approve-assembly" && seamsChecked!.length !== (data.seams ?? []).length)
      return setError("افحص كل وصلة بين مشهدين في النسخة المجمعة وعلّمها قبل اعتماد التجميع.");
    if (action === "correct-scene" && !note.trim())
      return setError("اكتب ملاحظة التصحيح قبل إعادة المشهد.");
    setPending(true);
    setError("");
    try {
      const updated = await api.decideScene(episodeId, channelId, sessionSecret, {
        action, expectedSha256, ...(sceneId ? { sceneId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(reviewed ? { confirmedWatched: true } : {}),
        ...(seamsChecked ? { seamsChecked } : {}),
      });
      // Server returned a read model, but its current file candidates may have changed.
      setData(updated);
      const fresh = await api.sceneProduction(episodeId, channelId);
      setData(fresh);
      onUpdated?.();
      setNote("");
      setReviewed(false);
      if (action === "approve-assembly") setSeams({});
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
      {!data && !error ? <p role="status">جارٍ تحميل حالة الحلقة…</p> : null}
      {error ? <p className="scene-first-error" role="alert">{error}</p> : null}
      {passSet === false ? (
        <div className="scene-first-task">
          <h3>اختر كلمة مرور المالك (مرة واحدة)</h3>
          <p>كل اعتماد في الاستوديو يحتاجها، فلا يعتمد شيئًا إلا أنت. تُحفظ بصمتها فقط على جهازك، ولا تُرسل لأحد.</p>
          <label className="scene-first-field"><span>كلمة المرور</span>
            <input type="password" autoComplete="new-password" value={newPass} onChange={(e) => setNewPass(e.target.value)} /></label>
          <label className="scene-first-field"><span>أعد كتابتها</span>
            <input type="password" autoComplete="new-password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} /></label>
          <button className="btn primary" type="button" onClick={() => void createPassphrase()}>حفظ كلمة المرور</button>
        </div>
      ) : null}
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
              <div className="scene-first-actions">
                <button className="btn small" type="button" onClick={() => onOpenScene(currentId)}>فتح أدوات المشهد</button>
                {scene.status !== "in_review" && (
                  <button className="btn primary" type="button"
                    disabled={pending || !scene.readyForAv}
                    onClick={() => void renderCurrentScene(currentId, scene.sourceSha256)}>
                    {pending ? "جارٍ إنتاج معاينة المشهد…" : "إنتاج المشهد بالصوت والصورة"}
                  </button>
                )}
              </div>
            </>
          ) : allApproved && !data.assembly ? (
            <div className="scene-first-task">
              <h3>اكتملت مراجعة كل المشاهد</h3>
              <p>تُجمَّع ملفات المشاهد المعتمدة نفسها بالترتيب في نسخة للمشاهدة الكاملة بسرعة 1×.</p>
              {data.candidates.assemblySha256 ? (
                <>
                  <video className="scene-first-video" controls preload="metadata"
                    src={api.previewUrl(episodeId, "episode.mp4")}
                    aria-label="معاينة الحلقة المجمعة بالصوت والصورة" />
                  <p>النسخة المجمعة جاهزة للمراجعة، وليست Master معتمدة.</p>
                  <button className="btn small" type="button" onClick={onOpenPublish}>فتح المراجعة والنشر</button>
                </>
              ) : (
                <button className="btn primary" type="button" disabled={pending}
                  onClick={() => void assembleScenes()}>
                  {pending ? "جارٍ تجميع المشاهد…" : "دمج المشاهد المعتمدة"}
                </button>
              )}
            </div>
          ) : data.assembly && !data.assembly.approved ? (
            <div className="scene-first-task">
              <h3>شاهد الحلقة المجمعة كاملة بسرعة 1× وافحص كل وصلة</h3>
              <p>قرار مستقل عن اعتماد كل مشهد: هل ينتقل كل مشهد إلى التالي بلا قفز ولا قطع في الصوت؟</p>
              <video className="scene-first-video" controls preload="metadata"
                src={api.previewUrl(episodeId, "episode.mp4")} aria-label="الحلقة المجمعة بالصوت والصورة" />
              <fieldset className="scene-first-seams">
                <legend>الوصلات ({(data.seams ?? []).filter((x) => seams[x]).length} من {(data.seams ?? []).length})</legend>
                {(data.seams ?? []).map((seam) => (
                  <label key={seam}><input type="checkbox" checked={Boolean(seams[seam])}
                    onChange={(e) => setSeams({ ...seams, [seam]: e.target.checked })} /> <span dir="ltr">{seam.replace(">", " → ")}</span></label>
                ))}
              </fieldset>
            </div>
          ) : data.assembly && !data.master ? (
            <div className="scene-first-task">
              <h3>اعتمد Master النهائي بعد مشاهدته كاملًا</h3>
              <p>التجميع معتمد. اصنع النسخة النهائية 4K من «النشر»، ثم شاهدها كاملة واعتمد هذا الملف بعينه.</p>
              <button className="btn small" type="button" onClick={onOpenPublish}>فتح النشر</button>
            </div>
          ) : data.master && !data.master.publishAllowed ? (
            <div className="scene-first-task">
              <h3>Master معتمد — النشر يحتاج إذنك الصريح</h3>
              <p>الشورتس والريلز تُصنع الآن من هذا الملف. أما النشر فقرار منفصل لهذا الملف بعينه.</p>
              <button className="btn small" type="button" onClick={onOpenPublish}>فتح النشر</button>
            </div>
          ) : (
            <div className="scene-first-task">
              <h3>مأذون بنشر هذا Master</h3>
              <p>أي تعديل في أي مشهد يلغي الإذن تلقائيًا.</p>
              <button className="btn small" type="button" onClick={onOpenPublish}>فتح النشر</button>
            </div>
          )}

          <details className="scene-first-approval">
            <summary>معايير مراجعة هذه القناة</summary>
            <ul>
              {humanReviewFocus.map(item => <li key={item}>{item}</li>)}
            </ul>
            <p>هذه تذكيرات للمراجعة البشرية، وليست درجات أو موافقات تلقائية.</p>
          </details>
          <details className="scene-first-approval">
            <summary>المراجعة والاعتماد</summary>
            <p>أكّد المراجعة مرة واحدة عند اتخاذ القرار. لا يُعتمد أي مشهد آليًا.</p>
            <label className="scene-first-field">
              <span>كلمة مرور المالك (لا تُحفظ في المتصفح)</span>
              <input type="password" autoComplete="off" value={sessionSecret}
                onChange={event => setSessionSecret(event.target.value)} placeholder="كلمة المرور" />
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
              {data.assembly && !data.assembly.approved && (
                <button className="btn primary" disabled={pending || !reviewed} onClick={() => void act("approve-assembly", data.assembly!.sha256)}>اعتماد التجميع والوصلات بعد المشاهدة 1×</button>
              )}
              {data.assembly?.approved && !data.master && data.candidates.masterSha256 && (
                <button className="btn primary" disabled={pending || !reviewed} onClick={() => void act("approve-master", data.candidates.masterSha256!)}>اعتماد Master بعد المشاهدة 1×</button>
              )}
              {data.master && !data.master.publishAllowed && (
                <button className="btn primary" disabled={pending || !reviewed} onClick={() => void act("grant-publish", data.master!.sha256)}>إذن نشر هذا Master</button>
              )}
            </div>
          </details>
          <p className="scene-first-disclaimer">اعتماد المشهد لا يغني عن مشاهدة الحلقة كاملة أو التأكد من الحقوق. التغييرات تُبطل الاعتمادات المتأثرة تلقائيًا.</p>
        </div>
      )}
    </section>
  );
};
