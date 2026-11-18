import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import type { Plan } from "../../../src/plan/types";
import type { EpisodeMedia } from "../../../src/plan/media";
import { VoiceBox } from "../tabs/EpisodeTab";
import { narrationReviewPlaylist } from "./reviewPlaylist";
import { Hint, More, Stage } from "../shell/Screen";
import "../shell/screens-s3.css";
import { CLIPS, SCENES, countAr } from "../../../src/i18n/count";
import { isBasmalaOnly } from "../../../src/voice/basmala";

/**
 * حالة مقطع التعليق في «متتابعة». KI-017: البسملة وحدها تسجيل المالك بصوته (قرار ١٠ نوفمبر) ولا تنتظر توليدًا،
 * فلا تُكتب «بلا صوت» كأنها جملة راوٍ ناقصة.
 */
export const clipStatus = (narration: string, playable: boolean, state: string): { cls: string; text: string } =>
  playable ? { cls: "ready", text: "صوت مطابق" }
    : isBasmalaOnly(narration) ? { cls: "basmala", text: "تسجيلك بصوتك — التلاوة تُضاف لاحقًا" }
    : state === "stale" ? { cls: "stale", text: "صوت قديم" }
    : { cls: state === "ready" ? "missing" : state, text: "بلا صوت" };

const ar = (n: number) => n.toLocaleString("ar-EG");

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
  const playlist = useMemo(() => narrationReviewPlaylist(scenes.map(({ scene }) => scene), media.voice), [scenes, media.voice]);
  // QA 12 Nov (dafatir M10): one count — a clip is «مطابق» only when it is also playable here (the same list as «استمع»)
  const playable = useMemo(() => new Set(playlist.map((x) => x.id)), [playlist]);
  const ready = playable.size;
  const order = useMemo(() => plan.chapters.flatMap((c) => c.scenes.map((s) => s.id)), [plan]);
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
  const clipUrl = (file: string) => `/api/episodes/${encodeURIComponent(episodeId)}/media/voice/${encodeURIComponent(file)}?channel=${encodeURIComponent(channelId)}`;
  return (
    <Stage className="s3-voice" title="صوت الحلقة" meta={(() => {
        // «١٦٠ مقطعًا» beside «١٦٣ مشهدًا» (owner review, 18 Nov): a clip is a scene with narration; say how many have none
        const all = plan.chapters.reduce((n, c) => n + c.scenes.length, 0);
        const silent = all - scenes.length;
        return `${ar(ready)} من ${countAr(scenes.length, CLIPS)} بصوت مطابق${silent > 0 ? ` — مقطع لكل مشهد فيه كلام؛ ${countAr(silent, SCENES)} بلا كلام` : ""}`;
      })()}>
      <Hint>لا اعتماد منفصل للصوت: يُعتمد عند مراجعة المشهد بصوته وصورته.</Hint>
      <div className="s3-voice-play">
        <button type="button" className={`btn${playlist.length ? " primary" : ""}`} disabled={!playlist.length}
          onClick={() => { setPlayerIndex(0); setPlaylistComplete(false); setPlayerError(""); }}>
          {playlist.length ? `استمع من أول مقطع (${countAr(playlist.length, CLIPS)})` : "استمع من أول مقطع"}
        </button>
        {!playlist.length && scenes.length ? <span className="sp-hint">لا مقاطع مطابقة تُسمع متتابعة بعد؛ صوت كل مشهد يُولَّد من «الجمل» تحت المشهد في «مشهدًا مشهدًا».</span> : null}
      </div>
      {playingClip && <div className="s3-voice-now" aria-label="مشغل التعليق المتصل">
        <strong>المقطع {ar(playerIndex! + 1)} من {ar(playlist.length)}</strong>
        <p>{playingClip.text}</p>
        <audio key={playingClip.id + ":" + playingClip.file} ref={playlistPlayer} controls preload="auto"
          onEnded={finishClip} onError={() => { setPlayerError("تعذّر تشغيل المقطع."); setPlayerIndex(null); }}
          src={clipUrl(playingClip.file)} />
      </div>}
      {playerError && <p role="alert" className="sp-hint">{playerError}</p>}
      {playlistComplete && <p role="status" className="sp-hint">انتهى تشغيل كل المقاطع بالترتيب.</p>}

      <More>
        <section aria-label="التعليق الصوتي">
          <h3>التعليق الصوتي</h3>
          <VoiceBox episodeId={episodeId} hasKeys={hasKeys} onMedia={onMedia} order={order} />
        </section>
        <section aria-label="التلاوة المرفوعة">
          <h3>التلاوة البشرية المرفوعة</h3>
          <p className="hint">يرفعها المالك بنفسه، وتُراجع قبل المشهد. لا جلب ولا توليد للقرآن.</p>
        </section>
      </More>
      {scenes.length ? (
        <ol className="s3-clips" aria-label="مقاطع التعليق">
          {scenes.map(({ scene, chapter, state }, i) => {
            const open = selected === scene.id;
            const clip = media.voice[scene.id];
            return (
              <li key={scene.id}>
                <button type="button" className="s3-clip-row" aria-expanded={open} onClick={() => setSelected(open ? "" : scene.id)} title={scene.id}>
                  <span className="s3-clip-n" title={`المشهد ${ar(order.indexOf(scene.id) + 1)}`}>{ar(i + 1)}</span>
                  <span className="s3-clip-text">{scene.narration}</span>
                  {(() => { const st = clipStatus(scene.narration, playable.has(scene.id), state); return <span className={`s3-clip-st ${st.cls}`}>{st.text}</span>; })()}
                </button>
                {open ? (
                  <div className="s3-clip">
                    {playable.has(scene.id) && clip ? (
                      <audio key={selected + ":" + clip.file} controls preload="none" src={clipUrl(clip.file)} />
                    ) : <span className="sp-hint" role="status">لا يوجد ملف صوت مطابق للنص الحالي.</span>}
                    <button type="button" className="btn ghost small" onClick={() => onOpenScene(scene.id)}>افتح المشهد {ar(order.indexOf(scene.id) + 1)}</button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : <p className="sp-hint">لا توجد مقاطع تعليق صوتي في خطة هذه الحلقة.</p>}

    </Stage>
  );
};
