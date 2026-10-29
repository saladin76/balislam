import type React from "react";
import { BigQuestion } from "./BigQuestion";
import { CharacterTalk } from "./CharacterTalk";
import { VerseCard } from "./VerseCard";
import { HadithCard, hadithCardSample, hadithCardSeconds } from "./HadithCard";
import { Comparison, comparisonSample, comparisonSeconds } from "./Comparison";
import { ListScene, listSample, listSeconds } from "./ListScene";
import { BigNumber, bigNumberSample, bigNumberSeconds } from "./BigNumber";
import { ChartScene, chartSample, chartSeconds } from "./ChartScene";
import { Timeline, timelineSample, timelineSeconds } from "./Timeline";
import { Symbolic, symbolicSample, symbolicSeconds } from "./Symbolic";
import { Summary, summarySample, summarySeconds } from "./Summary";
import { EndScreen, endScreenSample, endScreenSeconds } from "./EndScreen";
import { sampleBigQuestion, sampleCharacterTalk, sampleVerseCard, sceneDurations } from "./samples";

type Entry = { id: string; component: React.FC<any>; sample: Record<string, unknown>; seconds: number };

/** كل القوالب مع محتوى تجريبي، لتسجيلها في Remotion ومعاينتها. */
export const sceneCatalog: Entry[] = [
  { id: "big-question", component: BigQuestion, sample: sampleBigQuestion, seconds: sceneDurations.bigQuestion / 30 },
  { id: "character-talk", component: CharacterTalk, sample: sampleCharacterTalk, seconds: sceneDurations.characterTalk / 30 },
  { id: "verse-card", component: VerseCard, sample: sampleVerseCard, seconds: sceneDurations.verseCard / 30 },
  { id: "hadith-card", component: HadithCard, sample: hadithCardSample, seconds: hadithCardSeconds },
  { id: "comparison", component: Comparison, sample: comparisonSample, seconds: comparisonSeconds },
  { id: "list", component: ListScene, sample: listSample, seconds: listSeconds },
  { id: "big-number", component: BigNumber, sample: bigNumberSample, seconds: bigNumberSeconds },
  { id: "chart", component: ChartScene, sample: chartSample, seconds: chartSeconds },
  { id: "timeline", component: Timeline, sample: timelineSample, seconds: timelineSeconds },
  { id: "symbolic", component: Symbolic, sample: symbolicSample, seconds: symbolicSeconds },
  { id: "summary", component: Summary, sample: summarySample, seconds: summarySeconds },
  { id: "end-screen", component: EndScreen, sample: endScreenSample, seconds: endScreenSeconds },
];
