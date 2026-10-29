import React from "react";
import { Series } from "remotion";
import { BigQuestion } from "./BigQuestion";
import { CharacterTalk } from "./CharacterTalk";
import { VerseCard } from "./VerseCard";
import { sampleBigQuestion, sampleCharacterTalk, sampleVerseCard, sceneDurations } from "./samples";
import type { Orientation } from "./types";
import type { ThemeId } from "../../../brand/themes";
import { resolveOverlays, useChannelOverlays } from "../../../brand/identity/index";

export type TemplateReelProps = { themeId: ThemeId; orientation: Orientation };

/** شريط معاينة يعرض القوالب الثلاثة متتالية. */
export const TemplateReel: React.FC<TemplateReelProps> = ({ themeId, orientation }) => {
  // عناصر الشاشة كما في إعداد القناة، حتى تظهر في معاينة «الهوية»
  const ov = resolveOverlays(useChannelOverlays());
  const o = { captions: ov.captions, motif: ov.motif, watermark: ov.watermark };
  const eb = (e?: string) => (ov.chapterLabel ? e : undefined);
  return (
  <Series>
    <Series.Sequence durationInFrames={sceneDurations.bigQuestion}>
      <BigQuestion {...sampleBigQuestion} {...o} eyebrow={eb(sampleBigQuestion.eyebrow)} themeId={themeId} orientation={orientation} />
    </Series.Sequence>
    <Series.Sequence durationInFrames={sceneDurations.characterTalk}>
      <CharacterTalk {...sampleCharacterTalk} {...o} eyebrow={eb(sampleCharacterTalk.eyebrow)} themeId={themeId} orientation={orientation} />
    </Series.Sequence>
    <Series.Sequence durationInFrames={sceneDurations.verseCard}>
      <VerseCard {...sampleVerseCard} {...o} eyebrow={eb(sampleVerseCard.eyebrow)} themeId={themeId} orientation={orientation} />
    </Series.Sequence>
  </Series>
  );
};

export const reelDuration = sceneDurations.bigQuestion + sceneDurations.characterTalk + sceneDurations.verseCard;
