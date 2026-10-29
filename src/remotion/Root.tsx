import React from "react";
import { Composition, Still } from "remotion";
import { themeIds } from "../../brand/themes";
import { BrandSheet } from "./BrandSheet";
import { TemplateReel, reelDuration } from "./scenes/TemplateReel";
import { sceneCatalog } from "./scenes/catalog";
import { Thumbnail } from "./Thumbnail";
import config from "../../config.json";
import { Episode, calculateEpisodeMetadata, type EpisodeProps } from "./scenes/Episode";
import samplePlan from "../../tests/fixtures/plan.json";

const sizes = {
  landscape: { width: config.video.episode.width, height: config.video.episode.height },
  portrait: { width: config.video.short.width, height: config.video.short.height },
} as const;
const orientations = ["landscape", "portrait"] as const;

/** كل التكوينات المسجلة في Remotion. الحلقة والشورت الكاملان يُضافان في المرحلة 5. */
export const RemotionRoot: React.FC = () => (
  <>
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
