import type React from "react";
import { BigQuestion } from "./BigQuestion";
import { CharacterTalk } from "./CharacterTalk";
import { VerseCard } from "./VerseCard";
import { HadithCard, hadithCardSample, hadithCardSampleEn, hadithCardSeconds } from "./HadithCard";
import { Comparison, comparisonSample, comparisonSampleEn, comparisonSeconds } from "./Comparison";
import { ListScene, listSample, listSampleEn, listSeconds } from "./ListScene";
import { BigNumber, bigNumberSample, bigNumberSampleEn, bigNumberSeconds } from "./BigNumber";
import { ChartScene, chartSample, chartSampleEn, chartSeconds } from "./ChartScene";
import { Timeline, timelineSample, timelineSampleEn, timelineSeconds } from "./Timeline";
import { Symbolic, symbolicSample, symbolicSampleEn, symbolicSeconds } from "./Symbolic";
import { KineticText, kineticTextSample, kineticTextSampleEn, kineticTextSeconds } from "./KineticText";
import { MapJourney, mapJourneySample, mapJourneySampleEn, mapJourneySeconds } from "./MapJourney";
import { SetScene, setSceneSample, setSceneSampleEn, setSceneSeconds } from "./SetScene";
import { DeskMoment, deskMomentSample, deskMomentSampleEn, deskMomentSeconds } from "./DeskMoment";
import { SimStage, simStageSample, simStageSampleEn, simStageSeconds } from "./SimStage";
import { BoardStory, boardStorySample, boardStorySampleEn, boardStorySeconds } from "./BoardStory";
import { SketchBoard, sketchBoardSample, sketchBoardSampleEn, sketchBoardSeconds } from "./SketchBoard";
import { GlowStory, glowStorySample, glowStorySampleEn, glowStorySeconds } from "./GlowStory";
import { Summary, summarySample, summarySampleEn, summarySeconds } from "./Summary";
import { EndScreen, endScreenSample, endScreenSampleEn, endScreenSeconds } from "./EndScreen";
import { sampleBigQuestion, sampleBigQuestionEn, sampleCharacterTalk, sampleCharacterTalkEn, sampleVerseCard, sampleVerseCardEn, sceneDurations } from "./samples";

type Entry = { id: string; component: React.FC<any>; sample: Record<string, unknown>; seconds: number; sampleEn?: Record<string, unknown> };

/** كل القوالب مع محتوى تجريبي، لتسجيلها في Remotion ومعاينتها. */
export const sceneCatalog: Entry[] = [
  { id: "big-question", component: BigQuestion, sample: sampleBigQuestion, sampleEn: sampleBigQuestionEn, seconds: sceneDurations.bigQuestion / 30 },
  { id: "character-talk", component: CharacterTalk, sample: sampleCharacterTalk, sampleEn: sampleCharacterTalkEn, seconds: sceneDurations.characterTalk / 30 },
  { id: "verse-card", component: VerseCard, sample: sampleVerseCard, sampleEn: sampleVerseCardEn, seconds: sceneDurations.verseCard / 30 },
  { id: "hadith-card", component: HadithCard, sample: hadithCardSample, sampleEn: hadithCardSampleEn, seconds: hadithCardSeconds },
  { id: "comparison", component: Comparison, sample: comparisonSample, sampleEn: comparisonSampleEn, seconds: comparisonSeconds },
  { id: "list", component: ListScene, sample: listSample, sampleEn: listSampleEn, seconds: listSeconds },
  { id: "big-number", component: BigNumber, sample: bigNumberSample, sampleEn: bigNumberSampleEn, seconds: bigNumberSeconds },
  { id: "chart", component: ChartScene, sample: chartSample, sampleEn: chartSampleEn, seconds: chartSeconds },
  { id: "timeline", component: Timeline, sample: timelineSample, sampleEn: timelineSampleEn, seconds: timelineSeconds },
  { id: "symbolic", component: Symbolic, sample: symbolicSample, sampleEn: symbolicSampleEn, seconds: symbolicSeconds },
  { id: "glow-story", component: GlowStory, sample: glowStorySample, sampleEn: glowStorySampleEn, seconds: glowStorySeconds },
  { id: "board-story", component: BoardStory, sample: boardStorySample, sampleEn: boardStorySampleEn, seconds: boardStorySeconds },
  { id: "sketch-board", component: SketchBoard, sample: sketchBoardSample, sampleEn: sketchBoardSampleEn, seconds: sketchBoardSeconds },
  { id: "kinetic-text", component: KineticText, sample: kineticTextSample, sampleEn: kineticTextSampleEn, seconds: kineticTextSeconds },
  { id: "map-journey", component: MapJourney, sample: mapJourneySample, sampleEn: mapJourneySampleEn, seconds: mapJourneySeconds },
  { id: "set-scene", component: SetScene, sample: setSceneSample, sampleEn: setSceneSampleEn, seconds: setSceneSeconds },
  { id: "desk-moment", component: DeskMoment, sample: deskMomentSample, sampleEn: deskMomentSampleEn, seconds: deskMomentSeconds },
  { id: "sim-stage", component: SimStage, sample: simStageSample, sampleEn: simStageSampleEn, seconds: simStageSeconds },
  { id: "summary", component: Summary, sample: summarySample, sampleEn: summarySampleEn, seconds: summarySeconds },
  { id: "end-screen", component: EndScreen, sample: endScreenSample, sampleEn: endScreenSampleEn, seconds: endScreenSeconds },
];
