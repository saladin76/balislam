import React from "react";
import { Series } from "remotion";
import { BigQuestion } from "./BigQuestion";
import { CharacterTalk } from "./CharacterTalk";
import { VerseCard } from "./VerseCard";
import { sampleBigQuestion, sampleCharacterTalk, sampleVerseCard, sceneDurations } from "./samples";
import type { Orientation } from "./types";
import type { ThemeId } from "../../../brand/themes";
import { resolveOverlays, useChannelOverlays } from "../../../brand/identity/index";
import { ListScene, listSample } from "./ListScene";
import { useChannel } from "../../channel/context";

export type TemplateReelProps = { themeId: ThemeId; orientation: Orientation };

/** شريط معاينة يعرض ثلاثة قوالب متتالية؛ بطاقة الآية للقنوات التي تستشهد بالقرآن فقط، وغيرها قائمة نقاط. */
export const TemplateReel: React.FC<TemplateReelProps> = ({ themeId, orientation }) => {
  // عناصر الشاشة كما في إعداد القناة، حتى تظهر في معاينة «الهوية»
  const ov = resolveOverlays(useChannelOverlays());
  const o = { captions: ov.captions, motif: ov.motif, watermark: ov.watermark };
  const eb = (e?: string) => (ov.chapterLabel ? e : undefined);
  const quran = Boolean(useChannel().rules?.quran);
  return (
  <Series>
    <Series.Sequence durationInFrames={sceneDurations.bigQuestion}>
      <BigQuestion {...sampleBigQuestion} {...o} eyebrow={eb(sampleBigQuestion.eyebrow)} themeId={themeId} orientation={orientation} />
    </Series.Sequence>
    <Series.Sequence durationInFrames={sceneDurations.characterTalk}>
      <CharacterTalk {...sampleCharacterTalk} {...o} eyebrow={eb(sampleCharacterTalk.eyebrow)} themeId={themeId} orientation={orientation} />
    </Series.Sequence>
    <Series.Sequence durationInFrames={sceneDurations.verseCard}>
      {quran ? (
        <VerseCard {...sampleVerseCard} {...o} eyebrow={eb(sampleVerseCard.eyebrow)} themeId={themeId} orientation={orientation} />
      ) : (
        <ListScene {...listSample} {...o} eyebrow={eb(listSample.eyebrow)} themeId={themeId} orientation={orientation} />
      )}
    </Series.Sequence>
  </Series>
  );
};

export const reelDuration = sceneDurations.bigQuestion + sceneDurations.characterTalk + sceneDurations.verseCard;
