import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import type { Plan } from "../../../src/plan/types";
import type { EpisodeMedia } from "../../../src/plan/media";
import { VoiceBox } from "../tabs/EpisodeTab";
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
  const [selected, setSelected] = useState("");
  useEffect(() => {
    setSelected(""); setPlayerIndex(null); setPlaylistComplete(false); setPlayerError("");
  }, [episodeId, channelId]);
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
  return (
    <main className="ew-voice-stage">
      <div className="ew-voice-heading">
        <h2>صوت الحلقة</h2>
        <p>راجع التشكيل وإعدادات الصوت قبل التوليد. المقاطع التي لم يتغير نصها تبقى محفوظة كما في المحرك الحالي.</p>
      </div>
      <div className="ew-audio-summary" role="status">
        <div><strong>{ready}</strong><span>مقطع تعليق مطابق</span></div>
        <div><strong>{scenes.length - ready}</strong><span>مقطع يحتاج توليدًا</span></div>
        <div><strong>1</strong><span>مراجعة المشهد بصوته وصورته</span></div>
      </div>
      <section className="ew-voice-lane" aria-label="التعليق الصوتي">
        <div className="ew-lane-heading"><span className="ew-lane-index">01</span><div>
          <h3>التعليق الصوتي</h3>
          <p>توليد الراوي والتحقق من التشكيل والمقاطع المتغيّرة.</p>
        </div></div>
        <VoiceBox episodeId={episodeId} hasKeys={hasKeys} onMedia={onMedia} />
      </section>
      <section className="ew-voice-lane" aria-label="التلاوة المرفوعة">
        <div className="ew-lane-heading"><span className="ew-lane-index">02</span><div>
          <h3>التلاوة البشرية المرفوعة</h3>
          <p>تُرفق التلاوة التي يقدّمها المالك عبر Claude في الحلقة، وتراجع قبل استخدامها في المشهد. لا جلب لقرّاء خارجيين، ولا توليد آلي للقرآن.</p>
        </div></div>
      </section>
      <section className="ew-voice-lane" aria-label="الاستماع">
        <div className="ew-lane-heading"><span className="ew-lane-index">03</span><div>
          <h3>الاستماع قبل إنتاج المشاهد</h3>
          <p>للتأكد من النطق والوقفات قبل الرندر. لا يوجد اعتماد صوت منفصل: يُعتمد الصوت مع صورته في كل مشهد من «إنتاج المشاهد».</p>
        </div></div>
        <div className="field">
          <label htmlFor="voice-review-scene">مقطع واحد</label>
          <select id="voice-review-scene" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">اختر مقطعًا…</option>
            {scenes.map(({ scene }) => <option key={scene.id} value={scene.id}>{scene.id} · {scene.tone || "نبرة غير محددة"}</option>)}
          </select>
        </div>
        {activeScene && <div className="field">
          <p>النص الحالي: {activeScene.scene.narration}</p>
          {activeClip?.text === activeScene.scene.narration.trim() ? (
            <audio key={selected + ":" + activeClip.file} controls preload="none"
              src={`/api/episodes/${encodeURIComponent(episodeId)}/media/voice/${encodeURIComponent(activeClip.file)}?channel=${encodeURIComponent(channelId)}`} />
          ) : <p role="status">لا يوجد ملف صوت مطابق للنص الحالي.</p>}
        </div>}
        <div className="field">
          <h4>الاستماع المتصل</h4>
          <button type="button" className="btn small" disabled={!playlist.length}
            onClick={() => { setPlayerIndex(0); setPlaylistComplete(false); setPlayerError(""); }}>
            تشغيل التعليق من أول مقطع ({playlist.length} من {scenes.length})
          </button>
          {playingClip && <div className="field" aria-label="مشغل التعليق المتصل">
            <strong>المقطع {playerIndex! + 1} من {playlist.length}: {playingClip.id}</strong>
            <p>{playingClip.text}</p>
            <audio key={playingClip.id + ":" + playingClip.file} ref={playlistPlayer} controls preload="auto"
              onEnded={finishClip} onError={() => { setPlayerError("تعذّر تشغيل المقطع."); setPlayerIndex(null); }}
              src={`/api/episodes/${encodeURIComponent(episodeId)}/media/voice/${encodeURIComponent(playingClip.file)}?channel=${encodeURIComponent(channelId)}`} />
          </div>}
          {playerError && <p role="alert">{playerError}</p>}
          {playlistComplete && <p role="status">انتهى تشغيل كل المقاطع بالترتيب.</p>}
        </div>
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
