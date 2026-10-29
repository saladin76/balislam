import React, { forwardRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { IdentityProvider, type Identity } from "../../../brand/identity/index";
import { Episode, episodeFrames, SceneAudio } from "../../../src/remotion/scenes/Episode";
import { emptyMedia, type EpisodeMedia } from "../../../src/plan/media";
import { toFrames } from "../../../src/remotion/scenes/timing";
import { SceneFromPlan } from "../../../src/remotion/scenes/components";
import { TemplateReel, reelDuration } from "../../../src/remotion/scenes/TemplateReel";
import { sceneFrames } from "../../../src/plan/duration";
import type { Plan, PlanScene } from "../../../src/plan/types";
import type { ThemeId } from "../../../brand/themes";
import config from "../../../config.json";

export type Orientation = "landscape" | "portrait";
const size = (o: Orientation) => (o === "portrait" ? config.video.short : config.video.episode);

const SceneComp: React.FC<{ scene: PlanScene; themeId: ThemeId; orientation: Orientation; eyebrow: string; identity: Identity; media?: EpisodeMedia }> = ({ identity, media = emptyMedia, ...p }) => {
  const clip = media.voice[p.scene.id];
  const timings = clip && clip.text === p.scene.narration.trim() ? toFrames(clip.words, config.video.fps) : undefined;
  return (
    <IdentityProvider identity={identity}>
      <SceneFromPlan {...p} timings={timings} media={media} />
      <SceneAudio scene={p.scene} media={media} />
    </IdentityProvider>
  );
};

const EpisodeComp: React.FC<{ plan: Plan; orientation: Orientation; chapter?: number; identity: Identity; media?: EpisodeMedia }> = ({ identity, ...p }) => (
  <IdentityProvider identity={identity}>
    <Episode {...p} />
  </IdentityProvider>
);

const ReelComp: React.FC<{ themeId: ThemeId; orientation: Orientation; identity: Identity }> = ({ identity, ...p }) => (
  <IdentityProvider identity={identity}>
    <TemplateReel {...p} />
  </IdentityProvider>
);

/** العرض فقط؛ الارتفاع يحسبه المشغل من نسبة الفيديو. العمودي يُضيَّق من الحاوية. */
const playerStyle = (_o: Orientation): React.CSSProperties => ({ width: "100%", borderRadius: 8, overflow: "hidden" });

export const ScenePreview = forwardRef<PlayerRef, { scene: PlanScene; themeId: ThemeId; orientation: Orientation; eyebrow: string; identity: Identity; media?: EpisodeMedia }>((props, ref) => (
  <Player
    ref={ref}
    key={`${props.scene.id}-${props.orientation}`}
    component={SceneComp}
    inputProps={props}
    durationInFrames={sceneFrames(props.scene, props.media)}
    fps={config.video.fps}
    compositionWidth={size(props.orientation).width}
    compositionHeight={size(props.orientation).height}
    style={playerStyle(props.orientation)}
    controls
    autoPlay
    loop
    acknowledgeRemotionLicense
  />
));

export const EpisodePreview = forwardRef<PlayerRef, { plan: Plan; orientation: Orientation; chapter?: number; identity: Identity; media?: EpisodeMedia }>((props, ref) => (
  <Player
    ref={ref}
    key={`ep-${props.orientation}-${props.chapter ?? "all"}`}
    component={EpisodeComp}
    inputProps={props}
    durationInFrames={episodeFrames(props)}
    fps={config.video.fps}
    compositionWidth={size(props.orientation).width}
    compositionHeight={size(props.orientation).height}
    style={playerStyle(props.orientation)}
    controls
    acknowledgeRemotionLicense
  />
));

export const ReelPreview: React.FC<{ themeId: ThemeId; orientation: Orientation; identity: Identity }> = (props) => (
  <Player
    key={`reel-${props.themeId}-${props.orientation}`}
    component={ReelComp}
    inputProps={props}
    durationInFrames={reelDuration}
    fps={config.video.fps}
    compositionWidth={size(props.orientation).width}
    compositionHeight={size(props.orientation).height}
    style={playerStyle(props.orientation)}
    controls
    autoPlay
    loop
    acknowledgeRemotionLicense
  />
);
