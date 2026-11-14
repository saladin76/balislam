/**
 * Step ٢ «المشاهد» (direction D): the scene on screen with its header, frame, sentences and «أدوات وتفاصيل», the
 * whole episode as a filmstrip, and the dock with the one decision. Display only; the state and every server call
 * are `useSceneProduction`'s, and every button goes through the same decision path (the server refuses what it must).
 */
import React from "react";
import { SCENES, arabicCountAr } from "../../../../src/i18n/count";
import { sceneName } from "../sceneNames";
import { Icon } from "../../ui/icons";
import { Num, duration as clock } from "../../ui/format";
import { OwnerText } from "../../ui/OwnerText";
import type { SceneProductionProps } from "../SceneProductionPanel";
import type { SceneProductionModel } from "./useSceneProduction";
import { SceneDecisionActions } from "./SceneDecisionActions";
import { ar, noop, problemNote } from "./notes";
import { sceneStepView, type StepPart } from "./sceneStepView";
import {
  SceneAllDone, SceneCriteriaNote, SceneFixList, SceneHeader, SceneIssuesButton, SceneMedia, SceneMore, SceneSentences, SceneSide,
} from "./SceneStepParts";

/** The whole episode as a filmstrip above the dock: widths by duration, chapters, states, verses hatched */
export const SceneReel: React.FC<StepPart> = ({ m, p, v }) => {
  const { data, order, reelOpen, setReelOpen, stripRef, planScenes, openScene } = m;
  const { plan, thumb } = p;
  const { shownId, shownIdx, approvedCount, statusOf, secs } = v;
  return (
    <>
      <section className={`s3-reel${reelOpen ? "" : " is-folded"}`} aria-label={`الحلقة كاملة: ${ar(approvedCount)} معتمد من ${ar(order.length)}`}>
        <div className="s3-reel-head">
          <b>الحلقة كاملة</b>
          <span><Num>{arabicCountAr(order.length, SCENES)}</Num>، <Num className="clk">{clock(order.reduce((n, id) => n + secs(id), 0))}</Num></span>
          <button type="button" className="s3-fold" aria-expanded={reelOpen} onClick={() => setReelOpen((v) => !v)}><Icon name={reelOpen ? "down" : "up"} />{reelOpen ? "اطوِ" : "افتح"}</button>
          <span className="s3-legend" aria-hidden="true"><span><i className="is-now" />الحالي</span><span><i className="is-ready" />جاهز للمراجعة</span><span><i className="is-later" />يُجهَّز</span><span><i className="is-verse" />آية، سكون</span></span>
        </div>
        <div className="s3-chaps" aria-hidden="true">
          {plan!.chapters.map((c) => (
            <span key={c.number} style={{ flex: c.scenes.reduce((n, x) => n + secs(x.id), 0) + c.scenes.length * 0.2 }}>{c.title}</span>
          ))}
        </div>
        <ol className="s3-strip" ref={stripRef}>
          {order.map((id, i) => {
            const st = statusOf(id);
            const srv = data?.scenes.find((x) => x.id === id);
            const verse = planScenes.find((x) => x.scene.id === id)?.scene.template === "verse-card";
            const ready = Boolean(srv && (srv.approved || srv.status === "in_review" || srv.draft === "ready"));
            return (
              <li key={id} style={{ flex: secs(id) }}>
                <button type="button" className={`s3-dot is-${st}${ready ? " is-ready" : ""}${verse ? " is-verse" : ""}${id === shownId ? " is-shown" : ""}`} data-now={st === "now" ? "" : undefined}
                  aria-current={id === shownId ? "true" : undefined} onClick={() => openScene(id)}
                  title={`${sceneName(order, id)} — ${st === "done" ? "معتمد" : st === "now" ? "الحالي" : "ينتظر دوره"}`}>
                  {thumb && !verse && Math.abs(i - shownIdx) <= 8 ? thumb(id) : !verse ? <span className="s3-dot-ph" aria-hidden="true" /> : null}
                  <span className="s3-dot-n">{verse ? "آية" : ar(i + 1)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
      <div className="s3-reelm" aria-hidden="true">
        <span>الحلقة كاملة</span>
        <span className="s3-reelm-bar">{order.map((id) => <i key={id} className={id === shownId ? "is-shown" : statusOf(id) === "done" ? "is-done" : ""} style={{ flex: secs(id) }} />)}</span>
        <span><Num>{approvedCount}</Num> من <Num>{order.length}</Num></span>
      </div>
    </>
  );
};

/** The dock: the current scene's decision, «إلى النسخة النهائية» after the last one, or one lock reason. */
export const SceneDock: React.FC<StepPart & { allDoneHere: boolean }> = ({ m, p, v, allDoneHere }) => {
  const { data, currentId, scene, draftReady, sentNotes, voiceOf, voiceBusy, voiceMsg, pending, problem, problemText, toneChoice, confirming, reviewed,
    reasonsHost, generateVoice, videoRef, setConfirming, setProblemText, setToneChoice, setProblem, planScenes, setReviewed,
    reviewCurrent, submitTone, renderCurrentScene } = m;
  const { onOpenSettings, hasVoiceKeys, plan, onOpenFinal } = p;
  const { shownId, isCurrent, preparing, lock, nav } = v;
  if (p.view === "fix") return null;
  if (isCurrent && currentId && scene) {
    return (
      <SceneDecisionActions
        nav={nav}
        reasonsHost={reasonsHost}
        onOpenSettings={onOpenSettings}
        preparing={(scene.status === "in_review" && scene.previewSha256) || draftReady ? null : preparing}
        awaitingChange={scene.awaitingChange ? (sentNotes[currentId!] || scene.correction?.note || "") : null}
        stage={(scene.status === "in_review" && scene.previewSha256) || draftReady ? "review" : "render"}
        voice={voiceOf(currentId)}
        voiceBusy={voiceBusy}
        voiceMsg={voiceMsg}
        canVoice={Boolean(hasVoiceKeys)}
        readyForAv={scene.readyForAv}
        newerTake={scene.newerTake?.state}
        pending={pending}
        problem={problem}
        problemText={problemText}
        tone={toneChoice}
        confirming={confirming}
        reviewed={reviewed}
        onVoice={() => void generateVoice(currentId, voiceOf(currentId) === "ok")}
        onProblem={(kind) => {
          // يوقف المعاينة ويلتقط لحظة المشكلة
          const v = videoRef.current;
          v?.pause();
          setConfirming(false);
          setProblemText("");
          setToneChoice(data?.toneMap?.tones[currentId] || (planScenes.find((x) => x.scene.id === currentId)?.scene.tone ?? ""));
          setProblem(problem?.kind === kind ? null : { kind, at: v?.currentTime ?? 0 });
        }}
        onProblemText={setProblemText}
        onTone={setToneChoice}
        episodeTone={plan?.tone}
        toneMapVersion={data?.toneMap?.version}
        onCancelProblem={() => setProblem(null)}
        onSubmitProblem={() => {
          if (!problem || !(scene.previewSha256 || draftReady)) return;
          if (problem.kind === "motion") {
            void reviewCurrent("correct-scene", problemNote("motion", problem.at, problemText));
            return;
          }
          void submitTone(currentId, problem.at);
        }}
        onConfirm={(v) => setReviewed(v)}
        onApprove={() => {
          if (!reviewed) { setProblem(null); setConfirming(true); return; }
          void reviewCurrent("approve-scene");
        }}
        onRender={() => void renderCurrentScene(currentId, scene.sourceSha256)}
      />
    );
  }
  if (allDoneHere) {
    return (
      <div className="s3-act ms-dock" role="group" aria-label="المشاهد معتمدة">
        <div className="ms-dock-in">
          {nav.prev}
          <button className="btn primary" type="button" onClick={onOpenFinal}>إلى النسخة النهائية<Icon name="chev" /></button>
          <span className="ms-dv" aria-hidden="true" />
          <span className="ms-ct">{nav.count}</span>
          {nav.next}
        </div>
      </div>
    );
  }
  return (
    <SceneDecisionActions
      nav={nav}
      locked={lock ?? { reason: "لا مشهد ينتظر قرارًا الآن." }}
      stage="render"
      voice={voiceOf(shownId)}
      voiceBusy={false}
      canVoice={Boolean(hasVoiceKeys)}
      readyForAv={false}
      pending={pending}
      problem={null}
      problemText=""
      tone=""
      confirming={false}
      reviewed={false}
      onOpenSettings={onOpenSettings}
      onVoice={noop} onProblem={noop} onProblemText={noop} onTone={noop} onCancelProblem={noop}
      onSubmitProblem={noop} onConfirm={noop} onApprove={noop} onRender={noop}
    />
  );
};

export const SceneStep: React.FC<{ m: SceneProductionModel; p: SceneProductionProps; shownId: string; allDoneHere: boolean }> = ({ m, p, shownId, allDoneHere }) => {
  const v = sceneStepView(m, p, shownId);
  m.keys.current = v.onKey;
  const part = { m, p, v };
  return (
    <section className="stage s3" aria-label="المشهد الحالي في إنتاج الحلقة">
      <div className="s3-col">
        {p.view !== "fix" ? <SceneCriteriaNote focus={m.humanReviewFocus} /> : null}
        <SceneHeader {...part} />

        {m.error ? <p className="scene-first-error" role="alert"><OwnerText text={m.error} /></p> : null}

        {p.view === "fix" ? <SceneFixList {...part} /> : (
        <>
        <SceneMedia {...part} />
        <SceneSide {...part} />
        <SceneSentences {...part} />
        {allDoneHere ? <SceneAllDone m={m} /> : null}
        <SceneIssuesButton {...part} />
        <SceneMore {...part} />
        </>
        )}
      </div>
      <SceneReel {...part} />
      <SceneDock {...part} allDoneHere={allDoneHere} />
    </section>
  );
};
