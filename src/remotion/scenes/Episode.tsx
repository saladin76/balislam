import React from "react";
import { chapterEyebrow } from "./eyebrow";
import { AbsoluteFill, Audio, Sequence, Series, interpolate, staticFile, useCurrentFrame, type CalculateMetadataFunction } from "remotion";
import config from "../../../config.json";
import type { Plan, PlanChapter, PlanScene } from "../../plan/types";
import { sceneFrames } from "../../plan/duration";
import { recitationFrameSchedule } from "../../quran/recitationTimeline";
import { emptyMedia, type EpisodeMedia } from "../../plan/media";
import { SceneFromPlan } from "./components";
import { CaptionSpellContext } from "./CaptionBar";
import { toFrames } from "./timing";
import { ChannelIntro, channelIntroFramesFor, introFramesFor, introKindFor } from "./ChannelIntro";
import { CaptionBar } from "./CaptionBar";
import { useChannel } from "../../channel/context";
import type { Orientation } from "./types";
import { Providers } from "../Providers";
import { langPack } from "../../i18n/packs";
import type { Identity } from "../../../brand/identity/index";
import type { ChannelInfo } from "../../channel/types";
import { engineEnabled } from "../../plan/engine";
import { parseTransition, transitionIssues, type Transition } from "../../plan/transitions";
import { FrozenScene, TransitionContext, TransitionIn, type TransitionCtx } from "./transitions";
import { useSize, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { sceneAdvanceFrames, seamAudio, seamPlan, seamVolumeAt, type SeamAudio } from "../../plan/seams";
import { isAmbience, sceneSacredSpans, sfxGainAt, sfxTrim, speechSpans } from "../../plan/sfxMix";
import { sfxFileNames } from "../../plan/sfxVariants";

export type EpisodeProps = {
  plan: Plan;
  orientation: Orientation;
  /** فصل واحد فقط (للشورت) */
  chapter?: number;
  media?: EpisodeMedia;
  /** Scene-preview timings use the real clip for review, not final approval. */
  timingMode?: "estimated" | "scene-preview" | "approved";
  /** هوية القناة (إن غابت: الهوية الافتراضية) */
  identity?: Identity;
  channel?: ChannelInfo;
  /**
   * Studio-only: verse scenes in a scene review DRAFT whose human recitation is attached later. They play
   * in silence for the plan's duration with a small «التلاوة تُضاف لاحقًا» tag. renderEpisode refuses it for Master.
   */
  draftMarks?: { pendingRecitation: string[] };
  /**
   * One narration bed (owner, 16 Nov): a linear gain per narrated scene so every scene's narration reaches the episode's
   * own median loudness (EBU R128, src/studio/narrationLoudness.ts). Never on a recitation; absent = 1.
   */
  narrationGain?: Record<string, number>;
};

/** Small studio tag on a draft verse scene (never in a Master: renderEpisode refuses draftMarks there). */
export const PendingRecitationTag: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none", justifyContent: "flex-end", alignItems: "flex-start", padding: "0 0 3% 3%" }}>
    <div data-draft-mark="pending-recitation" dir="rtl" style={{
      fontFamily: fontFamilies.body, fontSize: 26, lineHeight: 1.3, color: "#F4EEE2", background: "rgba(0,0,0,0.55)",
      border: "1px dashed rgba(244,238,226,0.6)", borderRadius: 10, padding: "8px 16px",
    }}>
      التلاوة تُضاف لاحقًا · مسودة
    </div>
  </AbsoluteFill>
);

/** في الشورت (فصل واحد) لا تُعرض شاشة النهاية. */
export const scenesOf = (p: Pick<EpisodeProps, "plan" | "chapter">): { chapter: PlanChapter; scene: PlanScene }[] =>
  (p.chapter ? p.plan.chapters.filter((c) => c.number === p.chapter) : p.plan.chapters).flatMap((chapter) =>
    chapter.scenes.filter((s) => !(p.chapter && s.template === "end-screen")).map((scene) => ({ chapter, scene })),
  );

export const mediaSrc = (media: EpisodeMedia, rel: string) => (media.mode === "static" ? staticFile(`${media.base}${rel}`) : `${media.base}${rel}${media.query ?? ""}`);

/** Never use unapproved or stale narration word stamps for final motion. */
export const visualNarrationTimings = (scene: PlanScene, media: EpisodeMedia, timingMode: "estimated" | "scene-preview" | "approved" = "estimated") => {
  const clip = media.voice[scene.id];
  return timingMode !== "estimated" && clip && clip.text === scene.narration.trim()
    ? toFrames(clip.words, config.video.fps) : undefined;
};

export const SceneAudio: React.FC<{ scene: PlanScene; media: EpisodeMedia; seam?: SeamAudio; gain?: number; next?: PlanScene; channel?: string;
  /** D158 الخطوة ٤: ملف كل مؤثر («المشهد#الترتيب») بالتدوير على نسخه في الحلقة؛ غيابه = الأصل */
  sfxNames?: Map<string, string> }> = ({ scene, media, seam, gain, next, channel, sfxNames }) => {
  const fps = config.video.fps;
  const clip = media.voice[scene.id];
  const rec = scene.ayahKey ? media.recitations[scene.ayahKey] : undefined;
  const g = config.audio.narrationVolume * (gain && Number.isFinite(gain) && gain > 0 ? gain : 1);
  const faded = Boolean(seam && (seam.fadeInSec || seam.fadeOutSec));
  return (
    <>
      {clip && clip.text === scene.narration.trim() ? <Audio src={mediaSrc(media, `voice/${clip.file}`)}
        volume={faded ? (f: number) => g * seamVolumeAt(f / fps, seam!) : g} /> : null}
      {scene.template === "verse-card" && rec
        ? recitationFrameSchedule(rec, fps).map((part, i) => (
            <Sequence key={part.file + "-" + i} from={part.from}
              durationInFrames={part.durationInFrames} name={`تلاوة ${i + 1}`}>
              <Audio src={mediaSrc(media, `recitations/${part.file}`)} volume={config.audio.recitationVolume} />
            </Sequence>
          ))
        : null}
      {/* D158 الخطوة ٢: لا مؤثر في السكون المقصود، وصوت الجو ينخفض تحت الكلام (src/plan/sfxMix.ts) */}
      {(() => {
        const live = scene.sfx.map((x, i) => ({ ...x, file: sfxNames?.get(`${scene.id}#${i}`) ?? `${x.id}.mp3` })).filter((x) => media.sfx.includes(x.id));
        if (!live.length) return null;
        const sacred = sceneSacredSpans(scene, next, media, channel);
        const speech = speechSpans(scene, media);
        return live.map((x, i) => (
          <Sequence key={`${x.id}-${i}`} from={Math.round(x.at * fps)} name={`مؤثر ${x.id}`}>
            <Audio src={mediaSrc(media, `sfx/${x.file}`)}
              volume={(f: number) => config.audio.sfxVolume * sfxTrim(x.gainDb) * sfxGainAt(x.at + f / fps, sacred, speech, isAmbience(x.id))} />
          </Sequence>
        ));
      })()}
    </>
  );
};

/** A verse with active recitation may not be crossfaded before/after its actual audio. */
export const isRecitedVerse = (scene: PlanScene | undefined, media: EpisodeMedia) =>
  Boolean(scene?.template === "verse-card" && scene.ayahKey && media.recitations[scene.ayahKey]);

/** الانتقال الصالح بين مشهدين (لا يُطبَّق ما يرفضه فحص الخطة) */
export const activeTransition = (scene: PlanScene, prev: PlanScene, channelId?: string): Transition | null => {
  if (!scene.transition || !engineEnabled("transitions", channelId)) return null;
  const r = parseTransition(scene.transition);
  if (!r || !r.ok) return null;
  return transitionIssues(scene, prev).some((i) => i.level === "error") ? null : r.t;
};
/** ألوان الانتقال من ثيم الحلقة (هوية القناة)، لا من قيم ثابتة */
const ThemedTransition: React.FC<{ t: Transition; themeId: Plan["themeId"]; outgoing: React.ReactNode; children: React.ReactNode }> = ({ t, themeId, outgoing, children }) => {
  const theme = useTheme(themeId);
  return (
    <TransitionIn t={t} outgoing={outgoing} colors={{ bg: theme.colors.bg, light: theme.colors.highlight }}>
      {children}
    </TransitionIn>
  );
};

/** وصل السرد (src/plan/seams.ts): صورة المشهد التالي تظهر فوق ذيل السابق في أول إطاراتها */
const SeamDissolve: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(f, [0, frames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>{children}</AbsoluteFill>;
};

/** الحلقة كاملة (أو فصل واحد) من خطة الحلقة، بالصوت إن وُجد. */
export const Episode: React.FC<EpisodeProps> = (props) => {
  const { plan, orientation } = props;
  const media = props.media ?? emptyMedia;
  const lang = langPack(plan.lang ?? props.channel?.language);
  return (
    <Providers identity={props.identity} channel={props.channel} lang={lang.code}>
    <Series>
      {(() => {
        const kind = introKindFor(props.channel, plan, props.chapter);
        return kind ? (
          <Series.Sequence key="intro" durationInFrames={channelIntroFramesFor(props.channel, plan, props.chapter)} name="افتتاحية القناة">
            <ChannelIntro kind={kind} orientation={orientation} series={plan.series} />
          </Series.Sequence>
        ) : null;
      })()}
      {(() => { const list = scenesOf(props); const shown = list.map((x) => x.scene);
        const seams = seamPlan(shown, media, { channelId: plan.channel });
        const audio = seamAudio(shown, media, { channelId: plan.channel });
        // ترتيب الظهور من الحلقة كلها (لا من الفصل المعروض): المؤثر نفسه يأخذ النسخة نفسها في الحلقة وفي شورتها
        const sfxNames = sfxFileNames(props.plan, media.sfxVariants);
        return list.map(({ chapter, scene }, idx, all) => {
        // المشهد السابق في الفصل نفسه (للانتقال المتصل في السبورة؛ الشورت يبدأ بلا انتقال)
        const prev = idx > 0 && all[idx - 1]!.chapter.number === chapter.number ? all[idx - 1]!.scene : undefined;
        const next = idx < all.length - 1 && all[idx + 1]!.chapter.number === chapter.number ? all[idx + 1]!.scene : undefined;
        const draw = (i: number) => {
          const { chapter: c, scene: sc } = all[i]!;
          const p = i > 0 && all[i - 1]!.chapter.number === c.number ? all[i - 1]!.scene : undefined;
          const n = i < all.length - 1 && all[i + 1]!.chapter.number === c.number ? all[i + 1]!.scene : undefined;
          const timings = visualNarrationTimings(sc, media, props.timingMode);
          const shot = <SceneFromPlan scene={sc} themeId={plan.themeId} orientation={orientation} eyebrow={chapterEyebrow(props.channel, lang.strings.chapter, c)} timings={timings} media={media} episodeOverlays={plan.overlays} prev={p} next={n} />;
          return sc.captionSpell ? <CaptionSpellContext.Provider value={sc.captionSpell}>{shot}</CaptionSpellContext.Provider> : shot;
        };
        // الانتقال (الأمر 011): يُطبَّق فقط إن كان صالحًا لهذا الزوج؛ وبدونه يبقى السلوك القائم حرفيًا
        const tIn = prev && !isRecitedVerse(scene, media) && !isRecitedVerse(prev, media)
          ? activeTransition(scene, prev, plan.channel) : null;
        const tOut = next && !isRecitedVerse(scene, media) && !isRecitedVerse(next, media)
          ? activeTransition(next, scene, plan.channel) : null;
        const ctx: TransitionCtx = {
          ...(tOut ? { holdExit: true } : {}),
          ...(tIn ? { skipEnter: true } : {}),
          ...(tIn?.kind === "carry" ? { carryIn: tIn.dir } : {}),
          ...(tOut?.kind === "carry" ? { carryOut: tOut.dir } : {}),
        };
        const drawn = <TransitionContext.Provider value={ctx}>{draw(idx)}</TransitionContext.Provider>;
        const join = idx > 0 ? seams[idx - 1] : undefined;
        const body = join && join.dissolveFrames > 0 ? <SeamDissolve frames={join.dissolveFrames}>{drawn}</SeamDissolve> : drawn;
        return (
          <Series.Sequence key={scene.id} durationInFrames={sceneFrames(scene, media)} offset={join?.overlapFrames ? -join.overlapFrames : 0}
            name={`${scene.id} · ${scene.template}${tIn ? ` · ${tIn.kind}` : ""}${join?.overlapFrames ? ` · وصل ${join.overlapFrames}` : ""}`}>
            {tIn && tIn.dur > 0 ? (
              <ThemedTransition t={tIn} themeId={plan.themeId} outgoing={<FrozenScene frames={sceneFrames(prev!, media)}>{draw(idx - 1)}</FrozenScene>}>
                {body}
              </ThemedTransition>
            ) : (
              body
            )}
            <SceneAudio scene={scene} media={media} seam={audio[idx]} gain={props.narrationGain?.[scene.id]} next={list[idx + 1]?.scene} channel={props.plan.channel} sfxNames={sfxNames} />
            {props.draftMarks?.pendingRecitation.includes(scene.id) &&
              ((scene.template === "verse-card" && !isRecitedVerse(scene, media)) || media.voice[scene.id]?.basmala?.pending)
              ? <PendingRecitationTag /> : null}
          </Series.Sequence>
        );
      }); })()}
    </Series>
    </Providers>
  );
};

export const episodeFrames = (props: Pick<EpisodeProps, "plan" | "chapter" | "media" | "channel">) => {
  const media = props.media ?? emptyMedia;
  const shown = scenesOf(props).map((x) => x.scene);
  const overlap = seamPlan(shown, media, { channelId: props.plan.channel }).reduce((n, x) => n + x.overlapFrames, 0);
  return Math.max(1, introFramesFor(props.channel, props.plan, props.chapter) + shown.reduce((n, scene) => n + sceneFrames(scene, media), 0) - overlap);
};

/** بدايات الفصول بالثواني (لفصول وصف يوتيوب). */
export const chapterStarts = (plan: Plan, media?: EpisodeMedia, channel?: ChannelInfo) => {
  // الفصل الأول يبدأ من 0:00 (يوتيوب يشترطه) ويشمل الافتتاحية، والبقية تتأخر بمدتها
  let t = introFramesFor(channel, plan) / config.video.fps;
  const all = plan.chapters.flatMap((c) => c.scenes);
  const adv = sceneAdvanceFrames(all, media ?? emptyMedia, { channelId: plan.channel });
  const advOf = new Map(all.map((s, i) => [s.id, adv[i]!]));
  return plan.chapters.map((c, i) => {
    const start = i === 0 ? 0 : t;
    for (const s of c.scenes) t += (advOf.get(s.id) ?? sceneFrames(s, media ?? emptyMedia)) / config.video.fps;
    return { number: c.number, title: c.title, start };
  });
};

export const calculateEpisodeMetadata: CalculateMetadataFunction<EpisodeProps> = ({ props }) => ({ durationInFrames: episodeFrames(props) });
