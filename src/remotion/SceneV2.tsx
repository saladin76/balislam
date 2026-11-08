/**
 * Studio V2: one independently reviewable audio/visual scene.
 * The caller supplies a single, pinned scene and local, verified audio clips.
 * No TTS, Quran fetch, implicit silent audio or owner approval happens here.
 */
import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import type { Plan, PlanScene } from "../plan/types";
import type { EpisodeMedia } from "../plan/media";
import type { Identity } from "../../brand/identity/index";
import type { ChannelInfo } from "../channel/types";
import type { Orientation } from "./scenes/types";
import type { TimedWord } from "../voice/words";
import { toFrames } from "./scenes/timing";
import { SceneFromPlan } from "./scenes/components";
import { Providers } from "./Providers";
import { chapterEyebrow } from "./scenes/eyebrow";
import { langPack } from "../i18n/packs";

export type SceneV2Track = {
  file: string;
  kind: "narrator" | "recitation" | "sfx";
  fromFrame: number;
  durationInFrames: number;
  volume: number;
};
export type SceneV2Props = {
  plan: Plan;
  scene: PlanScene;
  chapterNumber: number;
  orientation: Orientation;
  frames: number;
  media: EpisodeMedia;
  tracks: SceneV2Track[];
  words: TimedWord[];
  identity?: Identity;
  channel?: ChannelInfo;
};

export const SceneV2: React.FC<SceneV2Props> = (props) => {
  const lang = langPack(props.plan.lang ?? props.channel?.language);
  const chapter = props.plan.chapters.find((c) => c.number === props.chapterNumber);
  return (
    <Providers identity={props.identity} channel={props.channel} lang={lang.code}>
      <SceneFromPlan
        scene={props.scene}
        themeId={props.plan.themeId}
        orientation={props.orientation}
        eyebrow={chapter ? chapterEyebrow(props.channel, lang.strings.chapter, chapter) : undefined}
        timings={toFrames(props.words, 30)}
        media={props.media}
        episodeOverlays={props.plan.overlays}
      />
      {props.tracks.map((track, index) => (
        <Sequence
          key={index}
          from={track.fromFrame}
          durationInFrames={track.durationInFrames}
          name={`${track.kind}-${index}`}
        >
          <Audio src={staticFile(`${props.media.base}audio/${track.file}`)} volume={track.volume} />
        </Sequence>
      ))}
    </Providers>
  );
};
