import React, { useMemo } from "react";
import type { Plan } from "../../../src/plan/types";
import type { EpisodeMedia } from "../../../src/plan/media";
import { VoiceBox } from "../tabs/EpisodeTab";
import { AlQuranCloudBrowser } from "./AlQuranCloudBrowser";

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
  return (
    <main className="ew-voice-stage">
      <div className="ew-voice-heading">
        <h2>صوت الحلقة</h2>
        <p>راجع التشكيل وإعدادات الصوت قبل التوليد. المقاطع التي لم يتغير نصها تبقى محفوظة كما في المحرك الحالي.</p>
      </div>
      <VoiceBox episodeId={episodeId} hasKeys={hasKeys} onMedia={onMedia} />
      <AlQuranCloudBrowser key={`${channelId}:${episodeId}`} channelId={channelId} episodeId={episodeId} />
      <div className="ew-voice-heading">
        <h3>حالة المقاطع الصوتية</h3>
        <span>{ready} من {scenes.length} مطابق للنص الحالي</span>
      </div>
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
