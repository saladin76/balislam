import React, { useEffect, useState } from "react";
import { api, type SceneProductionRead, type SceneOwnerAction } from "../api";
import { channelProductionProfile } from "../../../src/channel/productionRules";
import "./scene-production.css";
import { useOwnerSession } from "../shell/ownerSession";

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
  const owner = useOwnerSession();
  const sessionSecret = owner.secret;
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  // وصلات المشاهد التي فحصها المالك في النسخة المجمعة
  const [seams, setSeams] = useState<Record<string, boolean>>({});

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
      setError("افتح جلسة المالك من أعلى الصفحة أولًا.");
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
    if (!sessionSecret.trim()) return setError("افتح جلسة المالك من أعلى الصفحة أولًا.");
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
    if (!data || pending || !sessionSecret.trim()) return setError("افتح جلسة المالك من أعلى الصفحة أولًا.");
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

  // القرار الحالي في سطر واحد: يظهر فيه ما يُشاهَد، وما يُؤكَّد، والزر
  const confirm = (label: string) => owner.open ? (
    <label className="sp-confirm"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} /> {label}</label>
  ) : <span className="sp-hint">افتح جلسة المالك من أعلى الصفحة لتعتمد.</span>;
  const seamsAll = data?.seams ?? [];
  const seamsDone = seamsAll.filter((x) => seams[x]).length;

  // السكريبت والستوري بورد يُعتمدان من عمود الخطوات أعلى الصفحة؛ هذه اللوحة لما بعدهما
  if (data && (!data.script.approved || !data.storyboard.approved)) return null;
  return (
    <section className="scene-first-panel sp" aria-label="القرار الحالي في إنتاج الحلقة">
      {!data && !error ? <p role="status">جارٍ تحميل حالة الحلقة…</p> : null}
      {error ? <p className="scene-first-error" role="alert">{error}</p> : null}
      {!data ? null : currentId && scene ? (
        <div className="sp-grid">
          <div className="sp-media">
            {previewUrl ? (
              <video className="scene-first-video" controls preload="metadata" src={previewUrl} aria-label={`المشهد ${currentId} بالصوت والصورة`} />
            ) : (
              <div className="sp-empty">{scene.readyForAv ? "لم يُنتج هذا المشهد بعد." : "ينقص هذا المشهد صوته أو تلاوته المرفوعة."}</div>
            )}
          </div>
          <div className="sp-side">
            <p className="sp-kicker">المشهد <span dir="ltr">{currentId}</span>، {data.progress.approvedScenes + 1} من {data.progress.totalScenes}</p>
            <div className="scene-first-meter" role="progressbar" aria-valuenow={data.progress.approvedScenes} aria-valuemin={0} aria-valuemax={data.progress.totalScenes}>
              <span style={{ width: `${100 * data.progress.approvedScenes / Math.max(1, data.progress.totalScenes)}%` }} />
            </div>
            {scene.status === "in_review" && scene.previewSha256 ? (
              <>
                <h3>شاهده بالصوت والصورة، ثم قرر</h3>
                {confirm("شاهدته كاملًا بصوته")}
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة التعديل، مثل: الثانية 00:08 — الكاميرا سريعة" aria-label="ملاحظة التعديل" />
                <div className="sp-actions">
                  <button className="btn primary" disabled={pending || !reviewed} onClick={() => void act("approve-scene", scene.previewSha256!, currentId)}>اعتماد المشهد</button>
                  <button className="btn" disabled={pending || !note.trim()} onClick={() => void act("correct-scene", scene.previewSha256!, currentId)}>طلب تعديل</button>
                </div>
              </>
            ) : candidate && scene.readyForAv ? (
              <>
                <h3>المعاينة جاهزة</h3>
                <p className="sp-hint">أرسلها للمراجعة لتعتمدها، أو أعد إنتاجها بعد تعديل المشهد.</p>
                <div className="sp-actions">
                  <button className="btn primary" disabled={pending} onClick={() => void act("submit-scene", scene.sourceSha256, currentId)}>إرسال للمراجعة</button>
                  <button className="btn" disabled={pending} onClick={() => void renderCurrentScene(currentId, scene.sourceSha256)}>إعادة الإنتاج</button>
                </div>
              </>
            ) : (
              <>
                <h3>{scene.status === "needs_revision" ? "عُدّل المشهد؛ أنتجه من جديد" : "أنتج المشهد بالصوت والصورة"}</h3>
                <div className="sp-actions">
                  <button className="btn primary" disabled={pending || !scene.readyForAv || !owner.open} onClick={() => void renderCurrentScene(currentId, scene.sourceSha256)}>
                    {pending ? "جارٍ الإنتاج…" : "إنتاج المشهد"}
                  </button>
                  <button className="btn" type="button" onClick={() => onOpenScene(currentId)}>أدوات المشهد</button>
                </div>
                {!owner.open ? <span className="sp-hint">افتح جلسة المالك من أعلى الصفحة لتُنتج.</span> : null}
              </>
            )}
          </div>
        </div>
      ) : allApproved && !data.assembly ? (
        <div className="sp-row">
          <div><h3>كل المشاهد معتمدة</h3><p className="sp-hint">تُدمج ملفات المشاهد المعتمدة نفسها بالترتيب في نسخة واحدة للمشاهدة الكاملة.</p></div>
          <div className="sp-actions">
            {data.candidates.assemblySha256 ? (
              <button className="btn primary" disabled={pending || !owner.open} onClick={() => void act("assemble", data.candidates.assemblySha256!)}>تسجيل النسخة المجمعة للمراجعة</button>
            ) : (
              <button className="btn primary" disabled={pending || !owner.open} onClick={() => void assembleScenes()}>{pending ? "جارٍ الدمج…" : "دمج المشاهد"}</button>
            )}
          </div>
        </div>
      ) : data.assembly && !data.assembly.approved ? (
        <div className="sp-grid">
          <div className="sp-media">
            <video className="scene-first-video" controls preload="metadata" src={api.previewUrl(episodeId, "episode.mp4")} aria-label="الحلقة المجمعة" />
          </div>
          <div className="sp-side">
            <h3>شاهد الحلقة كاملة بسرعة 1×، وافحص كل وصلة</h3>
            <fieldset className="scene-first-seams">
              <legend>الوصلات: {seamsDone} من {seamsAll.length}</legend>
              {seamsAll.map((seam) => (
                <label key={seam}><input type="checkbox" checked={Boolean(seams[seam])} onChange={(e) => setSeams({ ...seams, [seam]: e.target.checked })} /> <span dir="ltr">{seam.replace(">", " → ")}</span></label>
              ))}
            </fieldset>
            {confirm("شاهدت الحلقة كاملة 1×")}
            <div className="sp-actions">
              <button className="btn primary" disabled={pending || !reviewed || seamsDone !== seamsAll.length} onClick={() => void act("approve-assembly", data.assembly!.sha256)}>اعتماد التجميع</button>
            </div>
          </div>
        </div>
      ) : data.assembly && !data.master ? (
        <div className="sp-row">
          <div>
            <h3>{data.candidates.masterSha256 ? "شاهد النسخة النهائية كاملة واعتمد هذا الملف" : "اصنع النسخة النهائية 4K"}</h3>
            <p className="sp-hint">{data.candidates.masterSha256 ? "الاعتماد لهذا الملف بعينه؛ أي ملف جديد يحتاج اعتمادًا جديدًا." : "من «النشر»: «اصنع النسخة النهائية». ثم تعود هنا لاعتمادها."}</p>
          </div>
          <div className="sp-actions">
            {data.candidates.masterSha256 ? (<>
              {confirm("شاهدتها كاملة 1×")}
              <button className="btn primary" disabled={pending || !reviewed} onClick={() => void act("approve-master", data.candidates.masterSha256!)}>اعتماد النسخة النهائية</button>
            </>) : <button className="btn primary" type="button" onClick={onOpenPublish}>إلى النشر</button>}
          </div>
        </div>
      ) : data.master && !data.master.publishAllowed ? (
        <div className="sp-row">
          <div><h3>النسخة النهائية معتمدة</h3><p className="sp-hint">الشورتس والريلز تُصنع منها الآن. النشر قرار منفصل لهذا الملف.</p></div>
          <div className="sp-actions">
            {confirm("أوافق على نشر هذا الملف")}
            <button className="btn primary" disabled={pending || !reviewed} onClick={() => void act("grant-publish", data.master!.sha256)}>إذن النشر</button>
          </div>
        </div>
      ) : (
        <div className="sp-row"><div><h3>مأذون بنشر هذه النسخة</h3><p className="sp-hint">أي تعديل في أي مشهد يلغي الإذن تلقائيًا.</p></div></div>
      )}
      {data ? (
        <details className="sp-criteria">
          <summary>معايير مراجعة هذه القناة</summary>
          <ul>{humanReviewFocus.map((item) => <li key={item}>{item}</li>)}</ul>
        </details>
      ) : null}
    </section>
  );
};
