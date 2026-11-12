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
import { channelSamples, sampleForChannel } from "./channelSamples";

export type TemplateReelProps = { themeId: ThemeId; orientation: Orientation };

/** شريط معاينة يعرض ثلاثة قوالب متتالية؛ بطاقة الآية للقنوات التي تستشهد بالقرآن فقط، وغيرها قائمة نقاط. */
export const TemplateReel: React.FC<TemplateReelProps> = ({ themeId, orientation }) => {
  // عناصر الشاشة كما في إعداد القناة، حتى تظهر في معاينة «الهوية»
  const ov = resolveOverlays(useChannelOverlays());
  const o = { captions: ov.captions, motif: ov.motif, watermark: ov.watermark };
  const eb = (e?: string) => (ov.chapterLabel ? e : undefined);
  const channel = useChannel();
  const quran = Boolean(channel.rules?.quran);
  // نماذج القناة نفسها فوق النموذج العام: لا يرى صاحب قناة في هويته محتوى قناة أخرى
  const own = <T extends Record<string, unknown>>(id: string, base: T) => sampleForChannel(channel.id, id, base) as T;
  const bq = own("big-question", sampleBigQuestion), ct = own("character-talk", sampleCharacterTalk), vc = own("verse-card", sampleVerseCard), ls = own("list", listSample);
  // قناة لها نماذجها ولا نموذج «حوار شخصية» فيها (ليس من مكتبتها): القائمة مكانه، لا نموذج القناة العامة
  const talk = !channelSamples[channel.id ?? ""] || Boolean(channelSamples[channel.id ?? ""]?.["character-talk"]);
  return (
  <Series>
    <Series.Sequence durationInFrames={sceneDurations.bigQuestion}>
      <BigQuestion {...bq} {...o} eyebrow={eb(bq.eyebrow)} themeId={themeId} orientation={orientation} />
    </Series.Sequence>
    <Series.Sequence durationInFrames={sceneDurations.characterTalk}>
      {talk ? <CharacterTalk {...ct} {...o} eyebrow={eb(ct.eyebrow)} themeId={themeId} orientation={orientation} />
        : <ListScene {...ls} {...o} eyebrow={eb(ls.eyebrow)} themeId={themeId} orientation={orientation} />}
    </Series.Sequence>
    <Series.Sequence durationInFrames={sceneDurations.verseCard}>
      {quran ? (
        <VerseCard {...vc} {...o} eyebrow={eb(vc.eyebrow)} themeId={themeId} orientation={orientation} />
      ) : (
        <ListScene {...ls} {...o} eyebrow={eb(ls.eyebrow)} themeId={themeId} orientation={orientation} />
      )}
    </Series.Sequence>
  </Series>
  );
};

export const reelDuration = sceneDurations.bigQuestion + sceneDurations.characterTalk + sceneDurations.verseCard;
