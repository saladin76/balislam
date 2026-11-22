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
import { DocPlate, docPlateSample, docPlateSampleEn, docPlateSeconds } from "./DocPlate";
import { SimStage, simStageSample, simStageSampleEn, simStageSeconds } from "./SimStage";
import { MotionStory, motionStorySample, motionStorySampleEn, motionStorySeconds } from "./MotionStory";
import { BoardStory, boardStorySample, boardStorySampleEn, boardStorySeconds } from "./BoardStory";
import { SketchBoard, sketchBoardSample, sketchBoardSampleEn, sketchBoardSeconds } from "./SketchBoard";
import { InkShot, inkShotSample, inkShotSampleEn, inkShotSeconds } from "./InkShot";
import { HorizonShot, horizonShotSample, horizonShotSampleEn, horizonShotSeconds } from "./HorizonShot";
import { RahhalaDesk, rahhalaDeskSample, rahhalaDeskSampleEn, rahhalaDeskSeconds } from "../dafatir/world/RahhalaDesk";
import { AlleyWorld, alleyWorldSample, alleyWorldSampleEn, alleyWorldSeconds } from "../balislam/world/AlleyWorld";
import { InkMeaning, inkMeaningSample, inkMeaningSampleEn, inkMeaningSeconds } from "./InkMeaning";
import { GlowStory, glowStorySample, glowStorySampleEn, glowStorySeconds } from "./GlowStory";
import { Summary, summarySample, summarySampleEn, summarySeconds } from "./Summary";
import { RoadJourney, roadJourneySample, roadJourneySampleEn, roadJourneySeconds } from "./RoadJourney";
import { LightStage, lightStageSample, lightStageSampleEn, lightStageSeconds } from "./LightStage";
import { DuaBoard, duaBoardSample, duaBoardSampleEn, duaBoardSeconds } from "./DuaBoard";
import { AlleyTale, alleyTaleSample, alleyTaleSampleEn, alleyTaleSeconds } from "./AlleyTale";
import { NoorText, noorTextSample, noorTextSampleEn, noorTextSeconds } from "./NoorText";
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
  { id: "alley-tale", component: AlleyTale, sample: alleyTaleSample, sampleEn: alleyTaleSampleEn, seconds: alleyTaleSeconds },
  { id: "road-journey", component: RoadJourney, sample: roadJourneySample, sampleEn: roadJourneySampleEn, seconds: roadJourneySeconds },
  { id: "light-stage", component: LightStage, sample: lightStageSample, sampleEn: lightStageSampleEn, seconds: lightStageSeconds },
  { id: "dua-board", component: DuaBoard, sample: duaBoardSample, sampleEn: duaBoardSampleEn, seconds: duaBoardSeconds },
  { id: "motion-story", component: MotionStory, sample: motionStorySample, sampleEn: motionStorySampleEn, seconds: motionStorySeconds },
  { id: "ink-shot", component: InkShot, sample: inkShotSample, sampleEn: inkShotSampleEn, seconds: inkShotSeconds },
  { id: "horizon-shot", component: HorizonShot, sample: horizonShotSample, sampleEn: horizonShotSampleEn, seconds: horizonShotSeconds },
  { id: "rahhala-desk", component: RahhalaDesk, sample: rahhalaDeskSample, sampleEn: rahhalaDeskSampleEn, seconds: rahhalaDeskSeconds },
  { id: "alley-world", component: AlleyWorld, sample: alleyWorldSample, sampleEn: alleyWorldSampleEn, seconds: alleyWorldSeconds },
  { id: "ink-meaning", component: InkMeaning, sample: inkMeaningSample, sampleEn: inkMeaningSampleEn, seconds: inkMeaningSeconds },
  { id: "sketch-board", component: SketchBoard, sample: sketchBoardSample, sampleEn: sketchBoardSampleEn, seconds: sketchBoardSeconds },
  { id: "kinetic-text", component: KineticText, sample: kineticTextSample, sampleEn: kineticTextSampleEn, seconds: kineticTextSeconds },
  { id: "map-journey", component: MapJourney, sample: mapJourneySample, sampleEn: mapJourneySampleEn, seconds: mapJourneySeconds },
  { id: "set-scene", component: SetScene, sample: setSceneSample, sampleEn: setSceneSampleEn, seconds: setSceneSeconds },
  { id: "desk-moment", component: DeskMoment, sample: deskMomentSample, sampleEn: deskMomentSampleEn, seconds: deskMomentSeconds },
  { id: "doc-plate", component: DocPlate, sample: docPlateSample, sampleEn: docPlateSampleEn, seconds: docPlateSeconds },
  { id: "sim-stage", component: SimStage, sample: simStageSample, sampleEn: simStageSampleEn, seconds: simStageSeconds },
  { id: "summary", component: Summary, sample: summarySample, sampleEn: summarySampleEn, seconds: summarySeconds },
  { id: "noor-text", component: NoorText, sample: noorTextSample, sampleEn: noorTextSampleEn, seconds: noorTextSeconds },
  { id: "end-screen", component: EndScreen, sample: endScreenSample, sampleEn: endScreenSampleEn, seconds: endScreenSeconds },
];
