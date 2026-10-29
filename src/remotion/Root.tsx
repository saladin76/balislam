import React from "react";
import { Composition, Still } from "remotion";
import { themeIds } from "../../brand/themes";
import { BrandSheet } from "./BrandSheet";
import { BigQuestion } from "./scenes/BigQuestion";
import { CharacterTalk } from "./scenes/CharacterTalk";
import { VerseCard } from "./scenes/VerseCard";
import { TemplateReel, reelDuration } from "./scenes/TemplateReel";
import { sampleBigQuestion, sampleCharacterTalk, sampleVerseCard, sceneDurations } from "./scenes/samples";
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
            <Composition
              id={`scene-big-question-${id}-${o}`}
              component={BigQuestion}
              durationInFrames={sceneDurations.bigQuestion}
              fps={config.video.fps}
              {...sizes[o]}
              defaultProps={{ ...sampleBigQuestion, themeId: id, orientation: o }}
            />
            <Composition
              id={`scene-character-talk-${id}-${o}`}
              component={CharacterTalk}
              durationInFrames={sceneDurations.characterTalk}
              fps={config.video.fps}
              {...sizes[o]}
              defaultProps={{ ...sampleCharacterTalk, themeId: id, orientation: o }}
            />
            <Composition
              id={`scene-verse-card-${id}-${o}`}
              component={VerseCard}
              durationInFrames={sceneDurations.verseCard}
              fps={config.video.fps}
              {...sizes[o]}
              defaultProps={{ ...sampleVerseCard, themeId: id, orientation: o }}
            />
          </React.Fragment>
        ))}
      </React.Fragment>
    ))}
  </>
);
