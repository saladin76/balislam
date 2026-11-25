/**
 * Steps ٣ and ٤ on the scene ledger: the seams of the assembled episode, the explanation screens before an assembly
 * or a Master exists, and the one-decision panel (scene, assembly, Master, publish permission). Display only: every
 * button is the panel's own decision path (useSceneProduction → api.decideScene), and the server refuses what it must.
 */
import React from "react";
import { api } from "../../api";
import { MakeMaster } from "../MakeMaster";
import { QualityCardView } from "../QualityCard";
import { FramePlayer } from "../FramePlayer";
import { sceneName, seamName } from "../sceneNames";
import { OwnerText } from "../../ui/OwnerText";
import type { SceneProductionProps } from "../SceneProductionPanel";
import type { SceneProductionModel } from "./useSceneProduction";
import { SeamReview, SeamRow, arNumOf } from "./SeamReview";
import { ar } from "./notes";
import { assemblyMissing } from "./sceneStates";
import { SCENES, countAr } from "../../../../src/i18n/count";

/**
 * D145 (owner decision 15 Nov 2026): scenes are approved in any order, so the assembly says exactly what it still waits
 * for: «باقي ٧ مشاهد غير معتمدة: ٣، ٨، …», each number a link to that scene in step ٢, then the verse scenes approved
 * «مشروطًا بالتلاوة». Display only; the server refuses the assembly until every scene has a final approval.
 */
export const AssemblyMissing: React.FC<{ data: NonNullable<SceneProductionModel["data"]>; onOpenScene?: (id: string) => void }> = ({ data, onOpenScene }) => {
  const order = data.scenes.map((x) => x.id);
  const { unapproved, conditional } = assemblyMissing(data);
  const links = (ids: string[]) => {
    const shown = ids.slice(0, 24);
    return (
      <span className="sp-missing-ids">
        {shown.map((id, i) => (
          <React.Fragment key={id}>
            {i ? "، " : ""}
            {onOpenScene
              ? <button type="button" className="prep-link" onClick={() => onOpenScene(id)} title={sceneName(order, id)}>{ar(order.indexOf(id) + 1)}</button>
              : ar(order.indexOf(id) + 1)}
          </React.Fragment>
        ))}
        {ids.length > shown.length ? "، …" : ""}
      </span>
    );
  };
  if (!unapproved.length && !conditional.length) return null;
  return (
    <p className="sp-hint sp-missing" role="status" data-missing={unapproved.join(" ")}>
      {unapproved.length ? <>باقي {countAr(unapproved.length, SCENES)} غير {unapproved.length === 1 ? "معتمد" : "معتمدة"}: {links(unapproved)}.</> : null}
      {unapproved.length && conditional.length ? " " : ""}
      {conditional.length ? <>{unapproved.length ? "و" : ""}بانتظار التلاوة ({countAr(conditional.length, SCENES)}): {links(conditional)}.</> : null}
    </p>
  );
};

type Final = { m: SceneProductionModel; p: SceneProductionProps };

/** Step ٣ in views (direction D): the seams of the assembled episode get their own screen. */
export const FinalSeams: React.FC<Final> = ({ m, p }) => {
  const { data, seamAt, setSeamAt, seamsAll, seams, markSeam, reviewed, setReviewed, pending, error, act, assembleScenes } = m;
  const { episodeId, plan, thumb } = p;
  const ids = data!.scenes.map((x) => x.id);
  return (
    <>
      <SeamReview episodeId={episodeId} data={data!} order={ids} plan={plan} thumb={thumb} at={Math.min(seamAt, Math.max(0, seamsAll.length - 1))} onAt={setSeamAt}
        heard={seams} onHeard={(seam, v, how, playedSec) => void markSeam(seam, v, how ?? "confirmed", playedSec)} reviewed={reviewed} onReviewed={setReviewed} pending={pending} error={error}
        onApprove={() => void act("approve-assembly", data!.assembly!.sha256)} onReassemble={() => void assembleScenes()} />
      {/* بطاقة الجودة (المرحلة A) على الحلقة المجمّعة نفسها، قبل النسخة النهائية */}
      {data!.assembly ? <QualityCardView episodeId={episodeId} target="assembly" /> : null}
    </>
  );
};

/** QA 12 Nov (all three channels): before an assembly exists «الوصلات» is an explanation, never the step-٢ scene card. */
export const SeamsBeforeAssembly: React.FC<Final> = ({ m, p }) => {
  const data = m.data!;
  const { pending, assembleScenes } = m;
  const { onFinalView, onOpenScene } = p;
  const pendingRecs = data.progress.recitationPending?.length ?? 0;
  return (
    <section className="scene-first-panel sp" aria-label="الوصلات">
      <div className="sp-row">
        <div><h3>الوصلات تُسمع بعد التجميع</h3><p className="sp-hint">{data.progress.canAssemble
          ? "كل المشاهد معتمدة: اجمعها في نسخة واحدة، ثم استمع لكل وصلة بين مشهدين واعتمدها هنا."
          : pendingRecs ? "تُجمع الحلقة بعد اعتماد كل المشاهد وتلاواتها؛ بعدها تُسمع كل وصلة بين مشهدين هنا."
          : `تُجمع الحلقة بعد اعتماد كل المشاهد، بأي ترتيب (${arNumOf(data.progress.approvedScenes)} من ${arNumOf(data.progress.totalScenes)} الآن)؛ بعدها تُسمع كل وصلة بين مشهدين هنا.`}</p>
          {!data.progress.canAssemble ? <AssemblyMissing data={data} onOpenScene={onOpenScene} /> : null}</div>
        <div className="sp-actions">{data.progress.canAssemble
          ? <button className="btn primary" type="button" disabled={pending} onClick={() => void assembleScenes()}>{pending ? "جارٍ الدمج…" : "دمج المشاهد للمراجعة"}</button>
          : pendingRecs
          ? <button className="btn primary" type="button" onClick={() => onFinalView?.("recitations")}>إلى التلاوات</button>
          : data.progress.currentScene && onOpenScene
            ? <button className="btn primary" type="button" onClick={() => onOpenScene(data.progress.currentScene!)}>إلى المشاهد</button>
            : null}</div>
      </div>
    </section>
  );
};

export const MasterBeforeSeams: React.FC<Final> = ({ m, p }) => {
  const data = m.data!;
  const { onFinalView, onOpenScene } = p;
  return (
    <section className="scene-first-panel sp" aria-label="النسخة الأساسية">
      <div className="sp-row">
        <div><h3>النسخة الأساسية تُصنع بعد الوصلات</h3><p className="sp-hint">{data.assembly ? "استمع لكل وصلة بين مشهدين في الحلقة المجمعة واعتمدها؛ بعدها تُصنع النسخة الأساسية 4K هنا." : "تُجمع المشاهد المعتمدة أولًا في نسخة واحدة وتُسمع وصلاتها."}</p>
          {!data.assembly && !data.progress.canAssemble ? <AssemblyMissing data={data} onOpenScene={onOpenScene} /> : null}</div>
        <div className="sp-actions">{data.progress.canAssemble || data.assembly
          ? <button className="btn primary" type="button" onClick={() => onFinalView?.("seams")}>إلى الوصلات</button>
          : (data.progress.recitationPending?.length ?? 0) > 0
            ? <button className="btn primary" type="button" onClick={() => onFinalView?.("recitations")}>إلى التلاوات</button>
            : data.progress.currentScene && onOpenScene
              ? <button className="btn primary" type="button" onClick={() => onOpenScene(data.progress.currentScene!)}>إلى المشاهد</button>
              : null}</div>
      </div>
    </section>
  );
};

export const SeamsApproved: React.FC<Final> = ({ p }) => {
  const { onFinalView, episodeId } = p;
  return (
    <section className="scene-first-panel sp" aria-label="الوصلات">
      <div className="sp-row">
        <div><h3>اعتُمدت الوصلات كلها</h3><p className="sp-hint">سُمعت الحلقة المجمعة كاملة ١× وكل وصلة فيها. التالي: النسخة الأساسية 4K.</p></div>
        <div className="sp-actions"><button className="btn primary" type="button" onClick={() => onFinalView?.("master")}>إلى النسخة الأساسية</button></div>
      </div>
      <QualityCardView episodeId={episodeId} target="assembly" />
    </section>
  );
};

/** Step ٢ after its last scene is handled by the scene screen (allDoneHere): strip, rewatch, one forward action. */
export const DecisionPanel: React.FC<Final> = ({ m, p }) => {
  const { data, error, pending, note, setNote, reviewed, setReviewed, seams, setEditing, assemblyRef, markSeam, refresh, renderCurrentScene, assembleScenes,
    humanReviewFocus, currentId, scene, candidate, previewUrl, allApproved, act, seamsAll, seamsDone, sceneMode, order } = m;
  const { episodeId, onOpenScene, onOpenPublish, onOpenReview, onUpdated, hasVoiceKeys } = p;
  // القرار الحالي في سطر واحد: يظهر فيه ما يُشاهَد، وما يُؤكَّد، والزر
  const confirm = (label: string) => (
    <label className="sp-confirm"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} /> {label}</label>
  );
  const criteria = (
    <details className="sp-criteria">
      <summary>معايير مراجعة هذه القناة</summary>
      <ul>{humanReviewFocus.map((item) => <li key={item}>{item}</li>)}</ul>
    </details>
  );
  return (
    <section className="scene-first-panel sp" aria-label="القرار الحالي في إنتاج الحلقة">
      {!data && !error ? <p role="status">جارٍ تحميل حالة الحلقة…</p> : null}
      {error ? <p className="scene-first-error" role="alert"><OwnerText text={error} /></p> : null}
      {!data ? null : currentId && scene ? (
        <div className="sp-grid">
          <div className="sp-media">
            {previewUrl ? (
              <FramePlayer src={previewUrl} label={`${sceneName(data.scenes.map((x) => x.id), currentId)} بالصوت والصورة`} />
            ) : (
              <div className="sp-empty">{scene.readyForAv ? "لم يُنتج هذا المشهد بعد." : "ينقص هذا المشهد صوت الراوي."}</div>
            )}
          </div>
          <div className="sp-side">
            <p className="sp-kicker">{sceneName(data.scenes.map((x) => x.id), currentId)} — معتمد {ar(data.progress.approvedScenes)} من {ar(data.progress.totalScenes)}</p>
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
                  <button className="btn primary" disabled={pending || !scene.readyForAv} onClick={() => void renderCurrentScene(currentId, scene.sourceSha256)}>
                    {pending ? "جارٍ الإنتاج…" : "إنتاج المشهد"}
                  </button>
                  <button className="btn" type="button" onClick={() => onOpenScene(currentId)}>أدوات المشهد</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (data.progress.recitationPending?.length ?? 0) > 0 ? (
        <div className="sp-row">
          <div>
            <h3>كل المشاهد معتمدة، وبانتظار التلاوات</h3>
            <p className="sp-hint">آيات معتمدة «مشروطًا بالتلاوة»: {ar(data.progress.recitationPending!.length)}. شاهد «المعاينة قبل النهائية» ثم ارفع التلاوات أدناه؛ بعد اعتماد كل تلاوة يُفتح مشهدها وحده لمراجعة سريعة. التجميع والنسخة النهائية والنشر لا تُفتح قبل ذلك.</p>
          </div>
        </div>
      ) : allApproved && !data.assembly ? (
        <div className="sp-row">
          <div><h3>كل المشاهد معتمدة</h3><p className="sp-hint">تُدمج ملفات المشاهد المعتمدة نفسها بالترتيب في نسخة واحدة للمشاهدة الكاملة.</p></div>
          <div className="sp-actions">
            <button className="btn primary" disabled={pending} onClick={() => void assembleScenes()}>{pending ? "جارٍ الدمج…" : "دمج المشاهد للمراجعة"}</button>
            {sceneMode && order[0] ? <button type="button" className="btn" onClick={() => setEditing(order[0]!)}>تحرير المشهد</button> : null}
          </div>
        </div>
      ) : data.assembly && !data.assembly.approved ? (
        <div className="sp-grid">
          <div className="sp-media">
            <FramePlayer ref={assemblyRef} src={api.previewUrl(episodeId, "episode.mp4")} label="الحلقة المجمعة" />
          </div>
          <div className="sp-side">
            <h3>الحلقة المجمّعة</h3>
            <p className="sp-hint">شاهدها إن أردت، وافحص الوصلات اختياريًا؛ الاعتماد بضغطة واحدة (D223).</p>
            <fieldset className="scene-first-seams">
              <legend>الوصلات: {seamsDone} من {seamsAll.length}</legend>
              {seamsAll.map((seam) => (
                <SeamRow key={seam} label={seamName(data.scenes.map((x) => x.id), seam)} at={data.seamTimes?.[seam]}
                  checked={Boolean(seams[seam])} onCheck={(v) => void markSeam(seam, v, "confirmed")}
                  onJump={(t) => {
                    // يبدأ قبل الوصلة بثانيتين ليُسمع آخر المشهد وأول التالي
                    const v = assemblyRef.current;
                    if (!v) return;
                    v.currentTime = Math.max(0, t - 2);
                    void v.play().catch(() => {});
                  }} />
              ))}
            </fieldset>
            <div className="sp-actions">
              <button className="btn primary" disabled={pending} onClick={() => void act("approve-assembly", data.assembly!.sha256)}>اعتمد التجميع</button>
            </div>
          </div>
        </div>
      ) : data.assembly && !data.master && onOpenReview ? (
        <div className="sp-row">
          <div><h3>النسخة النهائية لم تُعتمد بعد</h3><p className="sp-hint">تُصنع النسخة النهائية وتُشاهد وتُعتمد في الخطوة ٣؛ وبعدها يُمنح إذن النشر هنا.</p></div>
          <div className="sp-actions"><button className="btn primary" type="button" onClick={onOpenReview}>إلى الخطوة ٣</button></div>
        </div>
      ) : data.assembly && !data.master ? (
        <div className="sp-row">
          <div>
            <h3>{data.candidates.masterSha256 ? "شاهد النسخة النهائية كاملة واعتمد هذا الملف" : "اصنع النسخة النهائية 4K"}</h3>
            <p className="sp-hint">{data.candidates.masterSha256 ? "الاعتماد لهذا الملف بعينه؛ أي ملف جديد يحتاج اعتمادًا جديدًا." : "تُصنع بدقة 4K بالصوت من المشاهد المعتمدة نفسها، ثم تشاهدها هنا وتعتمدها."}</p>
          </div>
          <div className="sp-actions">
            {data.candidates.masterSha256 ? (<>
              <button className="btn primary" disabled={pending} onClick={() => void act("approve-master", data.candidates.masterSha256!)}>اعتمد النسخة النهائية</button>
            </>) : <MakeMaster episodeId={episodeId} hasVoiceKeys={hasVoiceKeys} onDone={() => { void refresh(); onUpdated?.(); }} />}
          </div>
          {/* بطاقة الجودة (المرحلة A): قبل الصنع على المجمّعة، وبعده على النسخة النهائية نفسها */}
          <QualityCardView episodeId={episodeId} target={data.candidates.masterSha256 ? "master" : "assembly"} />
        </div>
      ) : data.master && !data.master.publishAllowed && !onOpenReview ? (
        <div className="sp-row">
          <div><h3>النسخة النهائية معتمدة</h3><p className="sp-hint">الخطوة التالية: إذن النشر لهذا الملف بعينه في «النشر» (الخطوة ٤).</p></div>
          <div className="sp-actions"><button className="btn primary" type="button" onClick={onOpenPublish}>إلى النشر</button></div>
        </div>
      ) : data.master && !data.master.publishAllowed ? (
        <div className="sp-row">
          <div><h3>النسخة النهائية معتمدة</h3><p className="sp-hint">الشورتس والريلز تُصنع منها الآن. النشر قرار منفصل لهذا الملف.</p></div>
          <div className="sp-actions">
            {confirm("أوافق على نشر هذا الملف")}
            <button className="btn primary" disabled={pending || !reviewed} onClick={() => void act("grant-publish", data.master!.sha256)}>إذن النشر</button>
          </div>
          <QualityCardView episodeId={episodeId} target="master" />
        </div>
      ) : (
        <div className="sp-row"><div><h3>مأذون بنشر هذه النسخة</h3><p className="sp-hint">أي تعديل في أي مشهد يلغي الإذن تلقائيًا.</p></div></div>
      )}
      {data ? criteria : null}
    </section>
  );
};
