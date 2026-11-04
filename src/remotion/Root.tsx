import React from "react";
import { Composition, Still } from "remotion";
import { themeIds } from "../../brand/themes";
import { BrandSheet } from "./BrandSheet";
import { TemplateReel, reelDuration } from "./scenes/TemplateReel";
import { sceneCatalog } from "./scenes/catalog";
import { sampleForChannel } from "./scenes/channelSamples";
import { Thumbnail } from "./Thumbnail";
import { ChannelArt, artSizes, type ArtKind } from "./ChannelArt";
import { SilhouetteDemo } from "./styles/Silhouette";
import { FlatModernDemo } from "./styles/FlatModern";
import { PaperCutDemo } from "./styles/PaperCut";
import { IsometricDemo } from "./styles/Isometric";
import { Providers } from "./Providers";
import config from "../../config.json";
import { Episode, calculateEpisodeMetadata, type EpisodeProps } from "./scenes/Episode";
import { AlleyTale } from "./scenes/AlleyTale";
import samplePlan from "../../tests/fixtures/plan.json";
import { ChannelIntro, type IntroKind } from "./scenes/ChannelIntro";
import { MIHRAB_FRAMES } from "./scenes/MihrabIntro";
import type { Identity } from "../../brand/identity/index";
import type { ChannelInfo } from "../channel/types";

/** نماذج أساليب بديلة (أساس اقتراحات الستوري بورد قبل اعتماد أسلوب الحلقة). */
const styleDemos = { silhouette: SilhouetteDemo, "flat-modern": FlatModernDemo, "paper-cut": PaperCutDemo, isometric: IsometricDemo } as const;

/** افتتاحية قناة منفردة (للمعاينة): تُمرَّر هوية القناة واسمها من inputProps */
const IntroPreview: React.FC<{ kind: IntroKind; orientation: "landscape" | "portrait"; identity?: Identity; channel?: ChannelInfo }> = ({ kind, orientation, identity, channel }) => (
  <Providers identity={identity} channel={channel}>
    <ChannelIntro kind={kind} orientation={orientation} />
  </Providers>
);

/** معاينة قالب بلغة من اليسار لليمين (للتحقق من الاتجاه قبل إطلاق قناة تركية أو إنجليزية). */
const LtrPreview: React.FC<{ entryId: string; lang: string } & Record<string, unknown>> = ({ entryId, lang, ...props }) => {
  const entry = sceneCatalog.find((e) => e.id === entryId)!;
  const C = entry.component;
  return (
    <Providers lang={lang}>
      <C {...props} />
    </Providers>
  );
};

/** معاينة أي قالب بهوية قناة محددة (تُمرَّر الهوية والقناة من inputProps). */
const ChannelScenePreview: React.FC<{ entryId: string; identity?: Identity; channel?: ChannelInfo } & Record<string, unknown>> = ({ entryId, identity, channel, ...props }) => {
  const entry = sceneCatalog.find((e) => e.id === entryId)!;
  const C = entry.component;
  return (
    <Providers identity={identity} channel={channel}>
      <C {...sampleForChannel(channel?.id, entryId, entry.sample)} {...props} />
    </Providers>
  );
};

const sizes = {
  landscape: { width: config.video.episode.width, height: config.video.episode.height },
  portrait: { width: config.video.short.width, height: config.video.short.height },
} as const;
const orientations = ["landscape", "portrait"] as const;

/** كل التكوينات المسجلة في Remotion: لوحات الهوية، القوالب، الحلقة والشورت، الصورة المصغّرة، والافتتاحية. */
export const RemotionRoot: React.FC = () => (
  <>
    {/* Controlled A/B comparison: same words, cast and timing; only camera direction differs. */}
    {(["automatic", "directed"] as const).map((mode) => (
      <Composition
        key={mode}
        id={`balislam-alley-${mode}-review`}
        component={AlleyTale}
        durationInFrames={10 * config.video.fps}
        fps={config.video.fps}
        {...sizes.landscape}
        defaultProps={{
          themeId: "night" as const,
          orientation: "landscape" as const,
          narration: "قد تصدق خبرًا لأنه يؤكد رأيك. ثم تفكر في الحقيقة.",
          place: "alley",
          mood: "night",
          cast: "solo",
          poses: "stand",
          cues: "news | خبرًا\ntruth | الحقيقة",
          cameraMode: mode,
          camera: mode === "directed" ? "still" : "push",
        }}
      />
    ))}

    {(["paper", "night"] as const).flatMap((id) =>
      orientations.flatMap((o) =>
        sceneCatalog.map((entry) => (
          <Composition
            key={`en-${entry.id}-${id}-${o}`}
            id={`en-scene-${entry.id}-${id}-${o}`}
            component={LtrPreview}
            durationInFrames={Math.round(entry.seconds * config.video.fps)}
            fps={config.video.fps}
            {...sizes[o]}
            defaultProps={{ ...(entry.sampleEn ?? entry.sample), themeId: id, orientation: o, entryId: entry.id, lang: "en" }}
          />
        )),
      ),
    )}
    {orientations.map((o) => (
      <Composition key={`chscene-${o}`} id={`channel-scene-${o}`} component={ChannelScenePreview} durationInFrames={10 * config.video.fps} fps={config.video.fps} {...sizes[o]} defaultProps={{ entryId: "motion-story", themeId: "night" as const, orientation: o }} />
    ))}
    {orientations.map((o) => (
      <Composition key={`intro-${o}`} id={`channel-intro-${o}`} component={IntroPreview} durationInFrames={MIHRAB_FRAMES} fps={config.video.fps} {...sizes[o]} defaultProps={{ kind: "mihrab" as IntroKind, orientation: o }} />
    ))}
    {(Object.keys(artSizes) as ArtKind[]).map((k) => (
      <Still key={`art-${k}`} id={`channel-art-${k}`} component={ChannelArt} {...artSizes[k]} defaultProps={{ kind: k }} />
    ))}
      {/* نماذج الأساليب البصرية لدفاتر الزمن (للمقارنة قبل اعتماد أسلوب) */}
      {Object.entries(styleDemos).map(([id, C]) => (
        <Composition key={`style-${id}`} id={`style-${id}`} component={C} durationInFrames={9 * config.video.fps} fps={config.video.fps} {...sizes.landscape} />
      ))}
    <Still id="thumbnail-en" component={Thumbnail} width={1280} height={720} defaultProps={{ themeId: "paper" as const, title: "Why do we put off what matters?", highlight: "what matters?", element: "hourglass-patience", lang: "en" }} />
    <Still id="thumbnail" component={Thumbnail} width={1280} height={720} defaultProps={{ themeId: "paper" as const, title: "لماذا نؤجّل ما نعرف أنه مهم؟", highlight: "نعرف أنه مهم", element: "hourglass-patience" }} />
    {orientations.map((o) => (
      <Composition
        key={`episode-${o}`}
        id={`episode-${o}`}
        component={Episode}
        durationInFrames={300}
        fps={config.video.fps}
        {...sizes[o]}
        defaultProps={{ plan: samplePlan as unknown as EpisodeProps["plan"], orientation: o } as EpisodeProps}
        calculateMetadata={calculateEpisodeMetadata}
      />
    ))}
    {themeIds.map((id) => (
      <React.Fragment key={id}>
        <Still id={`brand-${id}-landscape`} component={BrandSheet} {...sizes.landscape} defaultProps={{ themeId: id, orientation: "landscape" as const }} />
        <Still id={`brand-${id}-portrait`} component={BrandSheet} {...sizes.portrait} defaultProps={{ themeId: id, orientation: "portrait" as const }} />
        {orientations.map((o) => (
          <React.Fragment key={o}>
            <Composition id={`reel-${id}-${o}`} component={TemplateReel} durationInFrames={reelDuration} fps={config.video.fps} {...sizes[o]} defaultProps={{ themeId: id, orientation: o }} />
            {sceneCatalog.map((entry) => (
              <Composition
                key={entry.id}
                id={`scene-${entry.id}-${id}-${o}`}
                component={entry.component}
                durationInFrames={Math.round(entry.seconds * config.video.fps)}
                fps={config.video.fps}
                {...sizes[o]}
                defaultProps={{ ...entry.sample, themeId: id, orientation: o }}
              />
            ))}
          </React.Fragment>
        ))}
      </React.Fragment>
    ))}
  </>
);
