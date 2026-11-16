/**
 * Step ٢ «المشاهد»: one component per visible part of the scene on screen (its header, the «تحتاج إصلاحًا» list,
 * the frame, the quiet lines beside it, its sentences, «كل المشاهد معتمدة», the warnings and «أدوات وتفاصيل»).
 * Display only: every action is the panel's own (useSceneProduction).
 */
import React from "react";
import { NOTES, SCENES, WARNINGS, countAr } from "../../../../src/i18n/count";
import { afterPreparationLine, api } from "../../api";
import { showsDivision } from "../../../../src/script/divisions";
import { More } from "../../shell/Screen";
import { PrepareAll } from "../PrepareAll";
import { EpisodePace } from "../../ui/Pace";
import { SentencesPanel } from "../SentencesPanel";
import { ShortsPicker } from "../../tabs/ShortsPicker";
import { StudioErrorBoundary } from "../../shell/ErrorBoundary";
import { FramePlayer } from "../FramePlayer";
import { sceneName } from "../sceneNames";
import { Icon } from "../../ui/icons";
import { Num, duration as clock, ownerText } from "../../ui/format";
import { NoteText, ar, noteInboxLine } from "./notes";
import { newerTakeLine } from "./newerTake";
import { liveAudio } from "./liveAudio";
import { remoteChangeLine } from "./remoteChange";
import { useChannel } from "../../../../src/channel/context";
import { allSentencesHint } from "../../../../src/studio/channelParity";
import type { StepPart } from "./sceneStepView";

/** «قبل أن تعتمد»: this channel's review criteria (from its production rules), on a sticky note in the gutter */
export const SceneCriteriaNote: React.FC<{ focus: readonly string[] }> = ({ focus }) => (
  <aside className="ms-note s3-note" aria-label="معايير مراجعة هذه القناة">
    <h2>قبل أن تعتمد</h2>
    <ol>{focus.map((item) => <li key={item}>{item}</li>)}</ol>
  </aside>
);

export const SceneHeader: React.FC<StepPart> = ({ m, p, v }) => {
  const { data, setPrepJob, refresh, order, videoSeconds, setEditing, headRef } = m;
  const { episodeId, channelId, onOpenSettings, onMediaChange, onUpdated, plan, onPlanSave } = p;
  const { shownId, hit, shownIdx, status, stateText, secs, fixes } = v;
  if (p.view === "fix") {
    return (
      <header className="s3-head">
        <div className="s3-title"><h2>تحتاج إصلاحًا <span className="s3-of"><Num>{countAr(fixes.length, SCENES, "لا مشاهد")}</Num></span></h2></div>
      </header>
    );
  }
  // التجهيز يبدأ وحده بعد «اعتمد التجهيز»: سطر حالته فقط («جاهز ١٢ من ١١٤» مع أوقف/استأنف)، لا زر في شريط القرار
  const prepLine = data && !data.progress.canAssemble ? (
    <PrepareAll className="s3-prep" episodeId={episodeId} channelId={channelId} prepared={data.prepared} onOpenSettings={onOpenSettings} order={order}
      onJob={setPrepJob}
      onChanged={() => {
        void refresh().catch(() => {});
        // الصوت المولَّد في الخلفية يظهر في أزرار المشهد دون إعادة فتح الحلقة
        void api.episode(episodeId, channelId).then((d) => onMediaChange?.(d.media), () => {});
        onUpdated?.();
      }}  onEpisodeTone={plan && onPlanSave ? (tone) => onPlanSave({ ...plan, tone }) : undefined}/>
  ) : null;
  return (
    <header className="s3-head">
      <div className="s3-title">
        <h2 ref={headRef} tabIndex={-1}>المشهد {shownIdx >= 0 ? ar(shownIdx + 1) : ""} <span className="s3-of">من {ar(order.length)}</span></h2>
        {hit && showsDivision(plan?.chapters ?? [], hit.chapter) ? <span className="s3-sub" title={`الفصل ${ar(hit.chapter.number)}`}>{hit.chapter.title}</span> : null}
      </div>
      <div className="s3-meta">
        <span className={`s3-state is-${status}`}>{stateText}</span>
        {hit ? <span className="s3-len"><Num className="clk">{clock(videoSeconds?.id === shownId ? videoSeconds.seconds : secs(shownId))}</Num></span> : null}
        {prepLine}
        <EpisodePace episodeId={episodeId} channelId={channelId} shownId={shownId} onApplied={() => { void refresh().catch(() => {}); onUpdated?.(); }} />
        <button type="button" className="btn ghost s3-edit" onClick={() => setEditing(shownId)}><Icon name="doc" />تحرير المشهد</button>
      </div>
    </header>
  );
};

export const SceneFixList: React.FC<StepPart> = ({ m, v }) => {
  const { order, sentNotes, openScene } = m;
  const { fixes } = v;
  return (
    <section className="s3-fixes" aria-label="مشاهد تحتاج إصلاحًا">
      {fixes.length ? (
        <ul className="s3-fixlist">
          {fixes.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => openScene(x.id)}>
                <b>{sceneName(order, x.id)}</b>
                <span><NoteText raw={x.correction?.note || (sentNotes[x.id] ?? "عُدّل؛ يحتاج إنتاجًا جديدًا")} /></span>
                {x.correction?.inbox ? <small>{noteInboxLine(x.correction.inbox)}</small> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="s3-empty">لا مشهد يحتاج إصلاحًا الآن. ما تطلب تعديله بـ«الحركة غير مناسبة» أو «النبرة غير مناسبة» يظهر هنا حتى يُصلح.</p>}
    </section>
  );
};

export const SceneMedia: React.FC<StepPart> = ({ m, p, v }) => {
  const { currentId, candidate, previewUrl, videoRef, advanced, setVideoSeconds, order, voiceProgress } = m;
  const { livePreview, media } = p;
  const { shownId, isCurrent, shownVideo, secs, hit } = v;
  // D131: why the quick preview is silent (the scene's sound is composed once every sentence has its take), or that it has sound
  const la = liveAudio(hit?.scene, media, voiceProgress[shownId], isCurrent);
  return (
    <div className="s3-media">
      {isCurrent && previewUrl ? (
        <FramePlayer key={`${currentId}:${candidate}`} ref={videoRef} autoPlay={advanced} expectedDuration={secs(shownId)} onDuration={(seconds) => setVideoSeconds({ id: shownId, seconds })} src={previewUrl} label={`${sceneName(order, currentId)} بالصوت والصورة`} />
      ) : !isCurrent && shownVideo ? (
        <FramePlayer key={`${shownId}:${shownVideo}`} expectedDuration={secs(shownId)} onDuration={(seconds) => setVideoSeconds({ id: shownId, seconds })} src={shownVideo} label={`${sceneName(order, shownId)} بالصوت والصورة`} />
      ) : livePreview ? (
        // The tag sits under the frame, never over it: burned-in captions run along the top of the picture.
        <figure className="s3-livebox">
          <div className="s3-live"><StudioErrorBoundary scope="screen" compact label="معاينة المشهد" resetKey={shownId}>{livePreview(shownId)}</StudioErrorBoundary></div>
          <figcaption className="s3-tag">{la.line}</figcaption>
        </figure>
      ) : (
        <div className="sp-empty">لم يُنتج هذا المشهد بعد.</div>
      )}
    </div>
  );
};

/** Beside the frame: where «اعتمد» waits (the dock's reasons are portalled here), the sent note and the quiet lines. */
export const SceneSide: React.FC<StepPart> = ({ m, v }) => {
  const { data, setReasonsHost, scene, currentId, sentNotes, draftReady, order } = m;
  const { hit, isCurrent, shownServer } = v;
  return (
    <div className="s3-side">
      <div ref={setReasonsHost} className="s3-reasons" />
      {isCurrent && scene?.status === "needs_revision" && (sentNotes[currentId!] || scene.correction?.note) ? (
        <p className="s3-sent"><b>{draftReady ? "ملاحظتك على النسخة السابقة:" : "ملاحظتك (بانتظار التعديل ثم إعادة الإنتاج):"}</b> <NoteText raw={sentNotes[currentId!] || scene.correction?.note || ""} /></p>
      ) : null}
      {isCurrent && scene?.status === "needs_revision" && scene.correction?.inbox ? (
        <p className="sp-hint" role="status">{noteInboxLine(scene.correction.inbox)}</p>
      ) : null}
      {/* QA 12 Nov: «ينقصه صوت الراوي» is said once, in the reasons line above (no second copy here) */}
      {/* 11 Nov: a quiet line, never a second approval: the scene is reviewed with «اعتمد المشهد» like any other */}
      {shownServer?.newerTake ? <p className="sp-hint s3-newer" role="status">{newerTakeLine(shownServer.newerTake)}</p> : null}
      {shownServer?.afterPreparation ? <p className="sp-hint s3-afterprep" role="note">{afterPreparationLine(shownServer.afterPreparation.what)}</p> : null}
      {/* D148: a conversation's change arrived after this video was made; the cloud never sends videos here */}
      {shownServer?.remoteChange ? <p className="sp-hint s3-remote" role="status">{remoteChangeLine(shownServer.remoteChange)}</p> : null}
      {shownServer?.blocked?.length || (shownServer && !shownServer.approved && data?.episodeBlocked?.length) ? (
        <p className="sp-hint s3-blocked" role="alert">لا يُنتج قبل إصلاح: {ownerText([...(shownServer.blocked ?? []), ...(data?.episodeBlocked ?? [])].join(" — "), order)}</p>
      ) : null}
      {shownServer?.recitationPending ? (
        <p className="sp-hint" role="note">التلاوة تُضاف لاحقًا: مسودة هذه الآية صامتة مكان التلاوة، واعتمادها الآن «مشروط بالتلاوة» يسجّل قرار هذا المشهد؛ وحين ترفع التلاوة في الخطوة ٣ يُفتح هذا المشهد وحده لمراجعة سريعة. التجميع والنسخة النهائية لا يُفتحان قبلها.</p>
      ) : null}
      {!hit?.scene.narration.trim() && hit?.scene.template !== "verse-card" ? <p className="s3-narr">بلا تعليق صوتي</p> : null}
    </div>
  );
};

/** «الجمل» under the scene (D50), in its own boundary so a failure there never blanks step ٢ (D89). */
export const SceneSentences: React.FC<StepPart> = ({ m, p, v }) => {
  const { sentencesKey, refresh } = m;
  const { episodeId, channelId, hasVoiceKeys, onOpenSettings, onPlanFlush, onPlanReplaced, onMediaChange, onUpdated } = p;
  const { shownId, hit } = v;
  return hit?.scene.narration.trim() || hit?.scene.template === "verse-card" ? (
    <StudioErrorBoundary scope="screen" compact label="الجمل" resetKey={shownId}>
    <SentencesPanel key={`sv:${sentencesKey}`} variant="paragraph" onVoiceProgress={m.onVoiceProgress} episodeId={episodeId} channelId={channelId} sceneId={shownId} hasVoiceKeys={hasVoiceKeys} onOpenSettings={onOpenSettings}
      onBeforeEdit={onPlanFlush} onPlanReplaced={onPlanReplaced} onMediaChange={onMediaChange}
      onChanged={() => { void refresh().catch(() => {}); onUpdated?.(); }} />
    </StudioErrorBoundary>
  ) : null;
};

export const SceneAllDone: React.FC<{ m: StepPart["m"] }> = ({ m }) => {
  const { data } = m;
  return (
    <div className="sp-row s3-alldone" role="group" aria-label="المشاهد معتمدة">
      <div>
        <h3>كل المشاهد معتمدة</h3>
        <p className="sp-hint">{(data!.progress.recitationPending?.length ?? 0) > 0
          ? `آيات معتمدة «مشروطًا بالتلاوة»: ${ar(data!.progress.recitationPending!.length)}؛ التلاوات والمعاينة قبل النهائية في الخطوة ٣.`
          : "اختر أي مشهد من الشريط لتعيد مشاهدته. التجميع والنسخة النهائية في الخطوة ٣."}</p>
      </div>
    </div>
  );
};

export const SceneIssuesButton: React.FC<StepPart> = ({ m, v }) => {
  const { issues } = m;
  const { blocking, openIssues } = v;
  return issues.length ? (
    <button type="button" className={`s3-issues${blocking ? " is-block" : ""}`} onClick={openIssues}>
      {blocking ? `${countAr(blocking, NOTES)} تمنع النسخة النهائية` : `${countAr(issues.length, WARNINGS)} قبل النسخة النهائية`} — عرضها
    </button>
  ) : null;
};

/** «أدوات وتفاصيل»: the plan's warnings, the whole episode's sentences, and the shorts segments. */
export const SceneMore: React.FC<StepPart> = ({ m, p }) => {
  const { data, issues, order, setEditing, allSentences, setAllSentences, sentencesKey, refresh, shortsOpen, setShortsOpen, moreRef } = m;
  const { episodeId, channelId, hasVoiceKeys, onOpenSettings, onPlanFlush, onPlanReplaced, onMediaChange, onUpdated } = p;
  const channel = useChannel(); // D150: no promise of a recitation upload in a written-citation channel (D68)
  return (
    <div ref={moreRef}>
      <More>
        {issues.length ? (
          <div className="s3-more-group">
            <h3>قبل النسخة النهائية</h3>
            <ul className="s3-issue-list">
              {issues.map((issue, i) => (
                <li key={i}>
                  <button type="button" onClick={() => setEditing(issue.sceneId)}>
                    <span className={`s3-lv is-${issue.level}`}>{issue.level === "error" ? "يمنع" : "تنبيه"}</span>
                    <span className="s3-id" title={issue.sceneId}>{sceneName(order, issue.sceneId)}</span>
                    <span>{issue.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="s3-more-group">
          <h3>جمل الحلقة كلها</h3>
          <p className="sp-hint">{allSentencesHint(channel)}</p>
          <button type="button" className="btn" aria-expanded={allSentences} onClick={() => setAllSentences((v) => !v)}>{allSentences ? "أخفِ جمل الحلقة" : "اعرض جمل الحلقة كلها"}</button>
          {allSentences ? (
            <StudioErrorBoundary scope="screen" compact label="جمل الحلقة">
            <SentencesPanel key={`sv-all:${sentencesKey}`} episodeId={episodeId} channelId={channelId} hasVoiceKeys={hasVoiceKeys} onOpenSettings={onOpenSettings}
              onBeforeEdit={onPlanFlush} onPlanReplaced={onPlanReplaced} onMediaChange={onMediaChange}
              onChanged={() => { void refresh().catch(() => {}); onUpdated?.(); }} />
            </StudioErrorBoundary>
          ) : null}
        </div>
        {/* D83 + QA 12 Nov: the owner picks the shorts segments at any time; making them stays after Master (rule ٤). */}
        <div className="s3-more-group">
          <h3>مقاطع الشورتس</h3>
          <p className="sp-hint">حدّد مقاطع الشورتس الآن من مشهد إلى مشهد؛ تُصنع بعد اعتماد النسخة الأساسية في «٤ النشر».</p>
          <button type="button" className="btn" aria-expanded={shortsOpen} onClick={() => setShortsOpen((v) => !v)}>{shortsOpen ? "أخفِ مقاطع الشورتس" : "حدّد مقاطع الشورتس"}</button>
          {shortsOpen ? (
            <StudioErrorBoundary scope="screen" compact label="مقاطع الشورتس">
              <ShortsPicker episodeId={episodeId} approved={Boolean(data?.progress.masterApproved)} />
            </StudioErrorBoundary>
          ) : null}
        </div>
        <p className="hint">التحرير الكامل (القالب، الخلفية، النبرة، التصدير) في «تحرير المشهد».</p>
      </More>
    </div>
  );
};
