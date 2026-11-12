import React, { forwardRef, useEffect, useRef, useState } from "react";
import { duration as clock } from "./format";
import { Player, type PlayerRef } from "@remotion/player";
import type { Identity, Overlays } from "../../../brand/identity/index";
import { Providers } from "../../../src/remotion/Providers";
import type { ChannelInfo } from "../../../src/channel/types";
import { Episode, episodeFrames, SceneAudio } from "../../../src/remotion/scenes/Episode";
import { emptyMedia, type EpisodeMedia } from "../../../src/plan/media";
import { toFrames } from "../../../src/remotion/scenes/timing";
import { SceneFromPlan } from "../../../src/remotion/scenes/components";
import { TemplateReel, reelDuration } from "../../../src/remotion/scenes/TemplateReel";
import { sceneFrames } from "../../../src/plan/duration";
import type { Plan, PlanScene } from "../../../src/plan/types";
import type { ThemeId } from "../../../brand/themes";
import config from "../../../config.json";
import { onSoloAudio } from "./soloAudio";

export type Orientation = "landscape" | "portrait";
const size = (o: Orientation) => (o === "portrait" ? config.video.short : config.video.episode);

type Ctx = { identity: Identity; channel?: ChannelInfo; lang?: string };

export const SceneComp: React.FC<{ scene: PlanScene; themeId: ThemeId; orientation: Orientation; eyebrow?: string; media?: EpisodeMedia; episodeOverlays?: Partial<Overlays> } & Ctx> = ({ identity, channel, lang, media = emptyMedia, ...p }) => {
  const clip = media.voice[p.scene.id];
  const timings = clip && clip.text === p.scene.narration.trim() ? toFrames(clip.words, config.video.fps) : undefined;
  return (
    <Providers identity={identity} channel={channel} lang={lang}>
      <SceneFromPlan {...p} timings={timings} media={media} />
      <SceneAudio scene={p.scene} media={media} />
    </Providers>
  );
};

const EpisodeComp: React.FC<{ plan: Plan; orientation: Orientation; chapter?: number; media?: EpisodeMedia } & Ctx> = ({ identity, channel, ...p }) => <Episode {...p} identity={identity} channel={channel} />;

const ReelComp: React.FC<{ themeId: ThemeId; orientation: Orientation } & Ctx> = ({ identity, channel, lang, ...p }) => (
  <Providers identity={identity} channel={channel} lang={lang}>
    <TemplateReel {...p} />
  </Providers>
);

/** العرض فقط؛ الارتفاع يحسبه المشغل من نسبة الفيديو. العمودي يُضيَّق من الحاوية. */
const playerStyle = (_o: Orientation): React.CSSProperties => ({ width: "100%", borderRadius: 8, overflow: "hidden" });

/**
 * The players' own controls, in Arabic (D60): Remotion's built-in bar speaks English («Play», «Mute», «0:02 / 0:15»);
 * ours plays and pauses, shows the time in the owner's digits, seeks, mutes and goes full screen, over the same Player.
 */
const ArabicControls: React.FC<{ player: React.RefObject<PlayerRef | null>; frames: number; fps: number; box: React.RefObject<HTMLDivElement | null> }> = ({ player, frames, fps, box }) => {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onMute = (e: { detail: { isMuted: boolean } }) => setMuted(e.detail.isMuted);
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    p.addEventListener("mutechange", onMute);
    setPlaying(p.isPlaying()); setMuted(p.isMuted()); setFrame(p.getCurrentFrame());
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("mutechange", onMute);
    };
  }, [player]);
  const toggle = () => player.current?.toggle();
  const mute = () => { const p = player.current; if (!p) return; if (p.isMuted()) p.unmute(); else p.mute(); };
  const full = () => {
    if (typeof document === "undefined" || !box.current) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); else void box.current.requestFullscreen?.().catch(() => {});
  };
  const t = frame / fps, d = frames / fps;
  return (
    <div className="ms-pc" dir="ltr">
      <button type="button" className="ms-pc-play" onClick={toggle} aria-label={playing ? "أوقف" : "شغّل"} title={playing ? "أوقف" : "شغّل"}>
        <svg viewBox="0 0 16 16" aria-hidden="true">{playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" /> : <path d="M4 2.5v11l9-5.5z" fill="currentColor" />}</svg>
      </button>
      <span className="num clk ms-pc-t">{`${clock(t)} / ${clock(d)}`}</span>
      <input className="ms-pc-seek" type="range" min={0} max={Math.max(0, frames - 1)} step={1} value={frame} aria-label="موضع التشغيل"
        aria-valuetext={`${clock(t)} من ${clock(d)}`} style={{ "--p": `${frames > 1 ? (100 * frame) / (frames - 1) : 0}%` } as React.CSSProperties}
        onChange={(e) => player.current?.seekTo(Number(e.target.value))} />
      <button type="button" onClick={mute} aria-pressed={muted} aria-label={muted ? "أعد الصوت" : "اكتم الصوت"} title={muted ? "أعد الصوت" : "اكتم الصوت"}>{muted ? "بلا صوت" : "الصوت"}</button>
      <button type="button" onClick={full} aria-label="ملء الشاشة" title="ملء الشاشة">ملء الشاشة</button>
    </div>
  );
};

/** A Player with the Arabic controls under it; the outer ref still reaches the Player (EpisodeTab, SceneSettings). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ArPlayerProps = { component: React.ComponentType<any>; inputProps: object; durationInFrames: number; fps: number; className?: string; [k: string]: unknown };
const ArPlayer = forwardRef<PlayerRef, ArPlayerProps>((props, ref) => {
  const own = useRef<PlayerRef | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  // D105: a sentence starting to play pauses this Player itself (pausing only its <audio> lets it play again at once)
  useEffect(() => onSoloAudio(typeof document !== "undefined" ? document : null, () => { const p = own.current; if (p?.isPlaying()) p.pause(); }), []);
  const setRef = (p: PlayerRef | null) => {
    own.current = p;
    if (typeof ref === "function") ref(p); else if (ref) ref.current = p;
    if (p && !ready) setReady(true);
  };
  const { className, ...rest } = props;
  return (
    <div ref={box} className={`ms-pw${className ? ` ${className}` : ""}`}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Player {...(rest as any)} ref={setRef} controls={false} clickToPlay />
      {ready ? <ArabicControls player={own} frames={props.durationInFrames as number} fps={props.fps as number} box={box} /> : null}
    </div>
  );
});
ArPlayer.displayName = "ArPlayer";

/**
 * Silent previews start muted (funnel audit item 17): an autoplaying player with sound is refused by the
 * browser and Remotion then warns and mutes it itself. Muted from the start says what the label says
 * («معاينة صامتة»); the owner can still unmute from the controls.
 */
export const ScenePreview = forwardRef<PlayerRef, { scene: PlanScene; themeId: ThemeId; orientation: Orientation; eyebrow?: string; media?: EpisodeMedia; episodeOverlays?: Partial<Overlays>; muted?: boolean; autoPlay?: boolean; className?: string } & Ctx>(({ muted, autoPlay = true, className, ...props }, ref) => (
  <ArPlayer
    ref={ref}
    key={`${props.scene.id}-${props.orientation}`}
    component={SceneComp}
    inputProps={props}
    durationInFrames={sceneFrames(props.scene, props.media)}
    fps={config.video.fps}
    compositionWidth={size(props.orientation).width}
    compositionHeight={size(props.orientation).height}
    style={playerStyle(props.orientation)}
    className={className}
    autoPlay={autoPlay}
    initiallyMuted={muted}
    loop
    acknowledgeRemotionLicense
  />
));

export const EpisodePreview = forwardRef<PlayerRef, { plan: Plan; orientation: Orientation; chapter?: number; media?: EpisodeMedia } & Ctx>((props, ref) => (
  <ArPlayer
    ref={ref}
    key={`ep-${props.orientation}-${props.chapter ?? "all"}`}
    component={EpisodeComp}
    inputProps={props}
    durationInFrames={episodeFrames(props)}
    fps={config.video.fps}
    compositionWidth={size(props.orientation).width}
    compositionHeight={size(props.orientation).height}
    style={playerStyle(props.orientation)}
    acknowledgeRemotionLicense
  />
));

export const ReelPreview: React.FC<{ themeId: ThemeId; orientation: Orientation } & Ctx> = (props) => (
  <ArPlayer
    key={`reel-${props.themeId}-${props.orientation}`}
    component={ReelComp}
    inputProps={props}
    durationInFrames={reelDuration}
    fps={config.video.fps}
    compositionWidth={size(props.orientation).width}
    compositionHeight={size(props.orientation).height}
    style={playerStyle(props.orientation)}
    autoPlay
    initiallyMuted
    loop
    acknowledgeRemotionLicense
  />
);
