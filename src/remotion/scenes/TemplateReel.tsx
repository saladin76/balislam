import React from "react";
import { Series } from "remotion";
import { BigQuestion } from "./BigQuestion";
import { CharacterTalk } from "./CharacterTalk";
import { VerseCard } from "./VerseCard";
import { sampleBigQuestion, sampleCharacterTalk, sampleVerseCard, sceneDurations } from "./samples";
import type { Orientation } from "./types";
import type { ThemeId } from "../../../brand/themes";

export type TemplateReelProps = { themeId: ThemeId; orientation: Orientation };

/** شريط معاينة يعرض القوالب الثلاثة متتالية. */
export const TemplateReel: React.FC<TemplateReelProps> = ({ themeId, orientation }) => (
  <Series>
    <Series.Sequence durationInFrames={sceneDurations.bigQuestion}>
      <BigQuestion {...sampleBigQuestion} themeId={themeId} orientation={orientation} />
    </Series.Sequence>
    <Series.Sequence durationInFrames={sceneDurations.characterTalk}>
      <CharacterTalk {...sampleCharacterTalk} themeId={themeId} orientation={orientation} />
    </Series.Sequence>
    <Series.Sequence durationInFrames={sceneDurations.verseCard}>
      <VerseCard {...sampleVerseCard} themeId={themeId} orientation={orientation} />
    </Series.Sequence>
  </Series>
);

export const reelDuration = sceneDurations.bigQuestion + sceneDurations.characterTalk + sceneDurations.verseCard;
