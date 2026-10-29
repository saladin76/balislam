import React from "react";
import { Audio, Sequence, Series, staticFile, type CalculateMetadataFunction } from "remotion";
import config from "../../../config.json";
import type { Plan, PlanChapter, PlanScene } from "../../plan/types";
import { sceneFrames } from "../../plan/duration";
import { emptyMedia, type EpisodeMedia } from "../../plan/media";
import { SceneFromPlan } from "./components";
import { toFrames } from "./timing";
import type { Orientation } from "./types";
import { Providers } from "../Providers";
import { langPack } from "../../i18n/packs";
import type { Identity } from "../../../brand/identity/index";
import type { ChannelInfo } from "../../channel/types";

export type EpisodeProps = {
  plan: Plan;
  orientation: Orientation;
  /** فصل واحد فقط (للشورت) */
  chapter?: number;
  media?: EpisodeMedia;
  /** هوية القناة (إن غابت: الهوية الافتراضية) */
  identity?: Identity;
  channel?: ChannelInfo;
};

/** في الشورت (فصل واحد) لا تُعرض شاشة النهاية. */
export const scenesOf = (p: Pick<EpisodeProps, "plan" | "chapter">): { chapter: PlanChapter; scene: PlanScene }[] =>
  (p.chapter ? p.plan.chapters.filter((c) => c.number === p.chapter) : p.plan.chapters).flatMap((chapter) =>
    chapter.scenes.filter((s) => !(p.chapter && s.template === "end-screen")).map((scene) => ({ chapter, scene })),
  );

export const mediaSrc = (media: EpisodeMedia, rel: string) => (media.mode === "static" ? staticFile(`${media.base}${rel}`) : `${media.base}${rel}${media.query ?? ""}`);

export const SceneAudio: React.FC<{ scene: PlanScene; media: EpisodeMedia }> = ({ scene, media }) => {
  const fps = config.video.fps;
  const clip = media.voice[scene.id];
  const rec = scene.ayahKey ? media.recitations[scene.ayahKey] : undefined;
  return (
    <>
      {clip && clip.text === scene.narration.trim() ? <Audio src={mediaSrc(media, `voice/${clip.file}`)} volume={config.audio.narrationVolume} /> : null}
      {scene.template === "verse-card" && rec ? (
        <Sequence from={Math.round(0.8 * fps)} name="تلاوة">
          <Audio src={mediaSrc(media, `recitations/${rec.file}`)} volume={config.audio.recitationVolume} />
        </Sequence>
      ) : null}
      {scene.sfx
        .filter((x) => media.sfx.includes(x.id))
        .map((x, i) => (
          <Sequence key={`${x.id}-${i}`} from={Math.round(x.at * fps)} name={`مؤثر ${x.id}`}>
            <Audio src={mediaSrc(media, `sfx/${x.id}.mp3`)} volume={config.audio.sfxVolume} />
          </Sequence>
        ))}
    </>
  );
};

/** الحلقة كاملة (أو فصل واحد) من خطة الحلقة، بالصوت إن وُجد. */
export const Episode: React.FC<EpisodeProps> = (props) => {
  const { plan, orientation } = props;
  const media = props.media ?? emptyMedia;
  const lang = langPack(plan.lang ?? props.channel?.language);
  return (
    <Providers identity={props.identity} channel={props.channel} lang={lang.code}>
    <Series>
      {scenesOf(props).map(({ chapter, scene }) => {
        const clip = media.voice[scene.id];
        const timings = clip && clip.text === scene.narration.trim() ? toFrames(clip.words, config.video.fps) : undefined;
        return (
          <Series.Sequence key={scene.id} durationInFrames={sceneFrames(scene, media)} name={`${scene.id} · ${scene.template}`}>
            <SceneFromPlan scene={scene} themeId={plan.themeId} orientation={orientation} eyebrow={`${lang.strings.chapter} ${chapter.number} · ${chapter.title}`} timings={timings} media={media} episodeOverlays={plan.overlays} />
            <SceneAudio scene={scene} media={media} />
          </Series.Sequence>
        );
      })}
    </Series>
    </Providers>
  );
};

export const episodeFrames = (props: Pick<EpisodeProps, "plan" | "chapter" | "media">) =>
  Math.max(1, scenesOf(props).reduce((n, { scene }) => n + sceneFrames(scene, props.media ?? emptyMedia), 0));

/** بدايات الفصول بالثواني (لفصول وصف يوتيوب). */
export const chapterStarts = (plan: Plan, media?: EpisodeMedia) => {
  let t = 0;
  return plan.chapters.map((c) => {
    const start = t;
    for (const s of c.scenes) t += sceneFrames(s, media ?? emptyMedia) / config.video.fps;
    return { number: c.number, title: c.title, start };
  });
};

export const calculateEpisodeMetadata: CalculateMetadataFunction<EpisodeProps> = ({ props }) => ({ durationInFrames: episodeFrames(props) });
