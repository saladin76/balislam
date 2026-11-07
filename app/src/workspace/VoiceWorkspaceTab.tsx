import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import type { Plan } from "../../../src/plan/types";
import type { EpisodeMedia } from "../../../src/plan/media";
import { VoiceBox } from "../tabs/EpisodeTab";
import { AlQuranCloudBrowser } from "./AlQuranCloudBrowser";
import { narrationReviewPlaylist } from "./reviewPlaylist";

/** واجهة خفيفة فوق منظومة الصوت الأصلية؛ لا توليد ولا تخزين إضافي. */
export const VoiceWorkspaceTab: React.FC<{
  episodeId: string;
  channelId: string;
  plan: Plan;
  media: EpisodeMedia;
  hasKeys: boolean;
  onMedia: (media: EpisodeMedia) => void;
  onOpenScene: (id: string) => void;
}> = ({ episodeId, channelId, plan, media, hasKeys, onMedia, onOpenScene }) => {
  const scenes = useMemo(() => plan.chapters.flatMap((ch) =>
    ch.scenes.filter((scene) => scene.narration.trim()).map((scene) => ({
      scene,
      chapter: ch.number,
      state: !media.voice[scene.id] ? "missing" : media.voice[scene.id]?.text === scene.narration.trim() ? "ready" : "stale",
    })),
  ), [plan, media]);
  const ready = scenes.filter((s) => s.state === "ready").length;
  const playlist = useMemo(() => narrationReviewPlaylist(scenes.map(({ scene }) => scene), media.voice), [scenes, media.voice]);
  const [playerIndex, setPlayerIndex] = useState<number | null>(null);
  const [playlistComplete, setPlaylistComplete] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const playlistPlayer = useRef<HTMLAudioElement>(null);
  const [review, setReview] = useState<{ id: string; state: string }[]>([]);
  const [fullApproved, setFullApproved] = useState(false);
  const [fullHeard, setFullHeard] = useState(false);
  const [fullNote, setFullNote] = useState("");
  const [selected, setSelected] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [heard, setHeard] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    setReview([]); setFullApproved(false); setFullHeard(false); setSelected(""); setHeard(false); setReviewError("");
    setPlayerIndex(null); setPlaylistComplete(false); setPlayerError("");
    api.voiceReview(episodeId, channelId).then(({ items, episodeApproved }) => {
      if (alive) { setReview(items); setFullApproved(episodeApproved); }
    }).catch((e) => { if (alive) setReviewError("تعذر قراءة سجل مراجعة الصوت: " + (e as Error).message); });
    return () => { alive = false; };
  }, [episodeId, channelId, media.voice, plan]);
  useEffect(() => {
    if (playerIndex === null) return;
    // A browser can still require the reviewer to press Play for the next clip.
    void playlistPlayer.current?.play().catch(() => {
      setPlayerError("يتطلب المتصفح الضغط على تشغيل لإكمال الاستماع؛ لن تُسجَّل المراجعة حتى تنتهي المقاطع جميعًا.");
    });
  }, [playerIndex]);
  const playingClip = playerIndex === null ? null : playlist[playerIndex] ?? null;
  const finishClip = () => {
    if (playerIndex === null) return;
    if (playerIndex + 1 < playlist.length) {
      setPlayerIndex(playerIndex + 1);
    } else {
      setPlayerIndex(null);
      setPlaylistComplete(true);
    }
  };
  const activeScene = scenes.find((s) => s.scene.id === selected);
  const activeClip = activeScene ? media.voice[activeScene.scene.id] : undefined;
  const activeState = review.find((item) => item.id === selected)?.state ?? "pending";
  const approveAudio = async () => {
    if (!selected || !heard || !reviewer.trim() || note.trim().length < 12) {
      setReviewError("اختر المقطع، واستمع إليه كاملًا، ثم اكتب اسم المراجع وملاحظة فعلية قبل الاعتماد.");
      return;
    }
    setReviewBusy(true); setReviewError("");
    try {
      const result = await api.approveVoiceScene(episodeId, channelId, { sceneId: selected, reviewer, note });
      setReview(result.items); setFullApproved(result.episodeApproved); setNote(""); setHeard(false); setFullHeard(false);
    } catch (e) { setReviewError((e as Error).message); }
    finally { setReviewBusy(false); }
  };
  const approveWholeAudio = async () => {
    if (!fullHeard || !reviewer.trim() || fullNote.trim().length < 20) {
      setReviewError("استمع إلى التعليق الصوتي كاملًا 1×، وسجّل المراجع وملاحظات الإيقاع والانتقالات.");
      return;
    }
    setReviewBusy(true); setReviewError("");
    try {
      const result = await api.approveVoiceEpisode(episodeId, channelId, reviewer, fullNote);
      setReview(result.items); setFullApproved(result.episodeApproved);
      setFullHeard(false); setFullNote("");
    } catch (e) { setReviewError((e as Error).message); }
    finally { setReviewBusy(false); }
  };
  return (
    <main className="ew-voice-stage">
      <div className="ew-voice-heading">
        <h2>صوت الحلقة</h2>
        <p>راجع التشكيل وإعدادات الصوت قبل التوليد. المقاطع التي لم يتغير نصها تبقى محفوظة كما في المحرك الحالي.</p>
      </div>
      <div className="ew-audio-summary" role="status">
        <div><strong>{ready}</strong><span>مقطع تعليق مطابق</span></div>
        <div><strong>{scenes.length - ready}</strong><span>مقطع يحتاج توليدًا</span></div>
        <div><strong>2</strong><span>مساران مستقلان: التعليق والتلاوة</span></div>
      </div>
      <section className="ew-voice-lane" aria-label="التعليق الصوتي">
        <div className="ew-lane-heading"><span className="ew-lane-index">01</span><div>
          <h3>التعليق الصوتي</h3>
          <p>توليد الراوي والتحقق من التشكيل والمقاطع المتغيّرة.</p>
        </div></div>
        <VoiceBox episodeId={episodeId} hasKeys={hasKeys} onMedia={onMedia} />
      </section>
      <section className="ew-voice-lane" aria-label="تلاوة القرآن">
        <div className="ew-lane-heading"><span className="ew-lane-index">02</span><div>
          <h3>تلاوة الآيات داخل الفيديو</h3>
          <p>اختر قارئًا وعاين صوته، ثم اعتمده للإنتاج بعد توثيق حقوق التسجيل. تُسحب الآيات تلقائيًا إلى بطاقة الآية.</p>
        </div></div>
        <AlQuranCloudBrowser key={`${channelId}:${episodeId}`} channelId={channelId} episodeId={episodeId} onMedia={onMedia} />
      </section>
      <div className="ew-voice-heading">
        <h3>حالة المقاطع الصوتية</h3>
        <span>{ready} من {scenes.length} مدرج بالنص، و{review.filter((r) => r.state === "approved").length} صالح ومعتمد بالبصمة</span>
      </div>
      <section className="ew-voice-lane" aria-label="الاستماع والاعتماد البشري">
        <div className="ew-lane-heading"><span className="ew-lane-index">03</span><div>
          <h3>اعتماد التعليق الصوتي بعد الاستماع</h3>
          <p>التطابق مع النص لا يعني الاعتماد. يلزم استماع حقيقي لكل مقطع، ثم مراجعة التسجيل الكامل 1× قبل تحريك الفيديو.</p>
        </div></div>
        <p role="status">المقاطع المعتمدة بملف صالح والبصمة الحالية: {review.filter((r) => r.state === "approved").length} من {scenes.length}</p>
        {review.some((r) => r.state === "missing_audio" || r.state === "changed") && <p role="alert">توجد تسجيلات تالفة أو متغيّرة أو غير مطابقة؛ الاعتماد السابق غير صالح للحركة حتى إعادة المراجعة.</p>}
        {reviewError && <p role="alert" className="note err">{reviewError}</p>}
        <div className="field">
          <label htmlFor="voice-review-scene">اختر المقطع للاستماع</label>
          <select id="voice-review-scene" value={selected}
            onChange={(e) => { setSelected(e.target.value); setHeard(false); setNote(""); setReviewError(""); }}>
            <option value="">اختر مقطعًا…</option>
            {scenes.map(({ scene }) => <option key={scene.id} value={scene.id}>
              {scene.id} · {scene.tone || "نبرة غير محددة"} · {review.find((r) => r.id === scene.id)?.state ?? "غير مفحوص"}
            </option>)}
          </select>
        </div>
        {activeScene && <div className="field">
          <p>النص الحالي: {activeScene.scene.narration}</p>
          <p>النبرة: {activeScene.scene.tone ?? "غير محددة"} · حالة المراجعة: {activeState}</p>
          {activeClip?.text === activeScene.scene.narration.trim() ? (
            <audio key={selected + ":" + activeClip.file} controls preload="none"
              src={`/api/episodes/${encodeURIComponent(episodeId)}/media/voice/${encodeURIComponent(activeClip.file)}?channel=${encodeURIComponent(channelId)}`} />
          ) : <p role="status">لا يوجد ملف صوت مطابق للنص الحالي.</p>}
          <label htmlFor="voice-reviewer">المراجع</label>
          <input id="voice-reviewer" value={reviewer} maxLength={120} onChange={(e) => setReviewer(e.target.value)} />
          <label htmlFor="voice-review-note">ملاحظات النطق والنبرة والوقفات</label>
          <textarea id="voice-review-note" value={note} rows={3} maxLength={2000}
            onChange={(e) => setNote(e.target.value)} placeholder="سمعت المقطع كاملًا، والنطق والوقفات والنبرة سليمة…" />
          <label><input type="checkbox" checked={heard} onChange={(e) => setHeard(e.target.checked)} />
            أؤكد أنني استمعت إلى المقطع كاملًا وتحققت من نطقه ونبرته.</label>
          <button className="btn small" type="button" onClick={approveAudio}
            disabled={reviewBusy || !heard || !reviewer.trim() || note.trim().length < 12 || activeState === "needs_tone" ||
              activeState === "missing_audio" || activeClip?.text !== activeScene.scene.narration.trim()}>
            {reviewBusy ? "جارٍ الحفظ…" : "اعتماد المقطع الصوتي المسموع"}
          </button>
        </div>}
        <div className="field">
          <h4>الاعتماد الصوتي الكامل قبل إنتاج الفيديو</h4>
          <p role="status">حالة التعليق الصوتي كاملًا: {fullApproved ? "معتمد بالبصمة الحالية" : "بانتظار مراجعة الاستماع المتصل"}</p>
          <p>شغّل التعليق الصوتي من أول مقطع لآخر مقطع داخل Studio. سينتقل المشغّل للمقطع التالي تلقائيًا عند انتهاء السابق. هذه المراجعة للصوت وحده، وتأتي بعدها مراجعة الفيديو بالصوت والصورة معًا.</p>
          <button type="button" className="btn small" disabled={playlist.length !== scenes.length || !playlist.length}
            onClick={() => { setPlayerIndex(0); setPlaylistComplete(false); setFullHeard(false); setPlayerError(""); }}>
            بدء الاستماع المتصل من أول مقطع ({playlist.length} مقطع)
          </button>
          {playlist.length !== scenes.length && <p role="status">التشغيل المتصل غير مكتمل: {playlist.length}/{scenes.length} ملفات صوت تطابق النص الحالي.</p>}
          {playingClip && <div className="field" aria-label="مشغل التعليق المتصل">
            <strong>المقطع {playerIndex! + 1} من {playlist.length}: {playingClip.id}</strong>
            <p>{playingClip.text}</p>
            <audio key={playingClip.id + ":" + playingClip.file} ref={playlistPlayer} controls preload="auto"
              onEnded={finishClip} onError={() => {
                setPlayerError("تعذّر تشغيل المقطع. لا يمكن اعتماد الاستماع الكامل.");
                setPlayerIndex(null); setPlaylistComplete(false); setFullHeard(false);
              }}
              src={`/api/episodes/${encodeURIComponent(episodeId)}/media/voice/${encodeURIComponent(playingClip.file)}?channel=${encodeURIComponent(channelId)}`} />
          </div>}
          {playerError && <p role="alert">{playerError}</p>}
          {playlistComplete && <p role="status">انتهى تشغيل جميع المقاطع بالترتيب. راجع ملاحظاتك ثم أكّد الاستماع.</p>}
          <label htmlFor="voice-full-note">ملاحظات المراجعة الكاملة: الإيقاع، انتقالات المشاهد، النطق والوقفات</label>
          <textarea id="voice-full-note" rows={3} value={fullNote} maxLength={2000}
            onChange={(e) => setFullNote(e.target.value)} placeholder="استمعت للتعليق كاملًا بالترتيب وتحققت من انتقالات المقاطع…" />
          <label><input type="checkbox" disabled={!playlistComplete} checked={fullHeard} onChange={(e) => setFullHeard(e.target.checked)} />
            أؤكد أنني استمعت إلى كامل التعليق الصوتي بالترتيب بسرعة طبيعية.</label>
          <button type="button" className="btn small" onClick={approveWholeAudio}
            disabled={reviewBusy || review.length !== scenes.length || review.some((r) => r.state !== "approved") ||
              !fullHeard || !reviewer.trim() || fullNote.trim().length < 20}>
            {reviewBusy ? "جارٍ الحفظ…" : "اعتماد التعليق الصوتي كاملًا للمونتاج"}
          </button>
        </div>
        <p className="help">يُبطل تغيير النص أو النبرة أو ملف MP3 الاعتماد تلقائيًا عند إعادة الفحص. هذه الخطوة لا تمنح إذن النشر ولا تثبت استماع الفيلم كاملًا.</p>
      </section>
      {scenes.length ? (
        <div className="ew-voice-scenes">
          {scenes.map(({ scene, chapter, state }) => (
            <button key={scene.id} type="button" onClick={() => onOpenScene(scene.id)}>
              <span className="ew-voice-id">الفصل {chapter} · {scene.id}</span>
              <span className="ew-voice-text">{scene.narration}</span>
              <span className={`ew-voice-status ${state}`}>{state === "ready" ? "صوت مطابق" : state === "stale" ? "صوت قديم" : "بلا صوت"}</span>
            </button>
          ))}
        </div>
      ) : <p className="ew-ready">لا توجد مقاطع تعليق صوتي في خطة هذه الحلقة.</p>}
    </main>
  );
};
