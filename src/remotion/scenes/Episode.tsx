import React from "react";
import { chapterEyebrow } from "./eyebrow";
import { Audio, Sequence, Series, staticFile, type CalculateMetadataFunction } from "remotion";
import config from "../../../config.json";
import type { Plan, PlanChapter, PlanScene } from "../../plan/types";
import { sceneFrames } from "../../plan/duration";
import { emptyMedia, type EpisodeMedia } from "../../plan/media";
import { SceneFromPlan } from "./components";
import { toFrames } from "./timing";
import { ChannelIntro, introFramesFor, introKindFor } from "./ChannelIntro";
import type { Orientation } from "./types";
import { Providers } from "../Providers";
import { langPack } from "../../i18n/packs";
import type { Identity } from "../../../brand/identity/index";
import type { ChannelInfo } from "../../channel/types";
import { engineEnabled } from "../../plan/engine";
import { parseTransition, transitionIssues, type Transition } from "../../plan/transitions";
import { FrozenScene, TransitionContext, TransitionIn, type TransitionCtx } from "./transitions";
import { useTheme } from "../../../brand/identity/index";

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
      {scene.template === "verse-card" && rec
        ? (rec.parts ?? [{ file: rec.file, duration: rec.duration }]).map((p, i, all) => {
            // آيات المقطع متتالية بفاصل قصير
            const from = Math.round((0.8 + all.slice(0, i).reduce((n, x) => n + x.duration + 0.25, 0)) * fps);
            return (
              <Sequence key={p.file} from={from} name={`تلاوة ${i + 1}`}>
                <Audio src={mediaSrc(media, `recitations/${p.file}`)} volume={config.audio.recitationVolume} />
              </Sequence>
            );
          })
        : null}
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
          <Series.Sequence key="intro" durationInFrames={introFramesFor(props.channel, plan, props.chapter)} name="افتتاحية القناة">
            <ChannelIntro kind={kind} orientation={orientation} />
          </Series.Sequence>
        ) : null;
      })()}
      {scenesOf(props).map(({ chapter, scene }, idx, all) => {
        // المشهد السابق في الفصل نفسه (للانتقال المتصل في السبورة؛ الشورت يبدأ بلا انتقال)
        const prev = idx > 0 && all[idx - 1]!.chapter.number === chapter.number ? all[idx - 1]!.scene : undefined;
        const next = idx < all.length - 1 && all[idx + 1]!.chapter.number === chapter.number ? all[idx + 1]!.scene : undefined;
        const draw = (i: number) => {
          const { chapter: c, scene: sc } = all[i]!;
          const p = i > 0 && all[i - 1]!.chapter.number === c.number ? all[i - 1]!.scene : undefined;
          const n = i < all.length - 1 && all[i + 1]!.chapter.number === c.number ? all[i + 1]!.scene : undefined;
          const clip = media.voice[sc.id];
          const timings = clip && clip.text === sc.narration.trim() ? toFrames(clip.words, config.video.fps) : undefined;
          return <SceneFromPlan scene={sc} themeId={plan.themeId} orientation={orientation} eyebrow={chapterEyebrow(props.channel, lang.strings.chapter, c)} timings={timings} media={media} episodeOverlays={plan.overlays} prev={p} next={n} />;
        };
        // الانتقال (الأمر 011): يُطبَّق فقط إن كان صالحًا لهذا الزوج؛ وبدونه يبقى السلوك القائم حرفيًا
        const tIn = prev ? activeTransition(scene, prev, plan.channel) : null;
        const tOut = next ? activeTransition(next, scene, plan.channel) : null;
        const ctx: TransitionCtx = {
          ...(tOut ? { holdExit: true } : {}),
          ...(tIn ? { skipEnter: true } : {}),
          ...(tIn?.kind === "carry" ? { carryIn: tIn.dir } : {}),
          ...(tOut?.kind === "carry" ? { carryOut: tOut.dir } : {}),
        };
        const body = <TransitionContext.Provider value={ctx}>{draw(idx)}</TransitionContext.Provider>;
        return (
          <Series.Sequence key={scene.id} durationInFrames={sceneFrames(scene, media)} name={`${scene.id} · ${scene.template}${tIn ? ` · ${tIn.kind}` : ""}`}>
            {tIn && tIn.dur > 0 ? (
              <ThemedTransition t={tIn} themeId={plan.themeId} outgoing={<FrozenScene frames={sceneFrames(prev!, media)}>{draw(idx - 1)}</FrozenScene>}>
                {body}
              </ThemedTransition>
            ) : (
              body
            )}
            <SceneAudio scene={scene} media={media} />
          </Series.Sequence>
        );
      })}
    </Series>
    </Providers>
  );
};

export const episodeFrames = (props: Pick<EpisodeProps, "plan" | "chapter" | "media" | "channel">) =>
  Math.max(1, introFramesFor(props.channel, props.plan, props.chapter) + scenesOf(props).reduce((n, { scene }) => n + sceneFrames(scene, props.media ?? emptyMedia), 0));

/** بدايات الفصول بالثواني (لفصول وصف يوتيوب). */
export const chapterStarts = (plan: Plan, media?: EpisodeMedia, channel?: ChannelInfo) => {
  // الفصل الأول يبدأ من 0:00 (يوتيوب يشترطه) ويشمل الافتتاحية، والبقية تتأخر بمدتها
  let t = introFramesFor(channel, plan) / config.video.fps;
  return plan.chapters.map((c, i) => {
    const start = i === 0 ? 0 : t;
    for (const s of c.scenes) t += sceneFrames(s, media ?? emptyMedia) / config.video.fps;
    return { number: c.number, title: c.title, start };
  });
};

export const calculateEpisodeMetadata: CalculateMetadataFunction<EpisodeProps> = ({ props }) => ({ durationInFrames: episodeFrames(props) });
