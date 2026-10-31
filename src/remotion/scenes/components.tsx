import React from "react";
import { BigQuestion } from "./BigQuestion";
import { CharacterTalk } from "./CharacterTalk";
import { VerseCard } from "./VerseCard";
import { Placeholder } from "./Placeholder";
import { HadithCard } from "./HadithCard";
import { Comparison } from "./Comparison";
import { ListScene } from "./ListScene";
import { BigNumber } from "./BigNumber";
import { ChartScene } from "./ChartScene";
import { Timeline } from "./Timeline";
import { Symbolic } from "./Symbolic";
import { Summary } from "./Summary";
import { GlowStory } from "./GlowStory";
import { SketchBoard } from "./SketchBoard";
import { BoardStory } from "./BoardStory";
import { KineticText } from "./KineticText";
import { SimStage } from "./SimStage";
import { DeskMoment } from "./DeskMoment";
import { SetScene } from "./SetScene";
import { EndScreen } from "./EndScreen";
import type { PlanScene } from "../../plan/types";
import type { ThemeId } from "../../../brand/themes";
import type { CharacterPose, CharacterVariant } from "../../../characters/Character";
import type { Orientation } from "./types";
import type { WordTiming } from "./timing";
import type { EpisodeMedia } from "../../plan/media";
import { useLang } from "../../i18n/context";
import { resolveOverlays, useChannelOverlays, type Overlays } from "../../../brand/identity/index";

type Common = { themeId: ThemeId; orientation: Orientation; eyebrow?: string; timings?: WordTiming[]; media?: EpisodeMedia; episodeOverlays?: Partial<Overlays>; prev?: PlanScene };

/** يحوّل مشهدًا من الخطة إلى مكوّن القالب المناسب. */
export const SceneFromPlan: React.FC<{ scene: PlanScene } & Common> = ({ scene, themeId, orientation, eyebrow, timings, media, episodeOverlays, prev }) => {
  const p = scene.props;
  const ov = resolveOverlays(useChannelOverlays(), episodeOverlays, { captions: scene.captions }, scene.overlays);
  const base = {
    themeId,
    orientation,
    eyebrow: ov.chapterLabel ? eyebrow : undefined,
    narration: scene.narration || undefined,
    narrationTimings: timings,
    captions: ov.captions,
    backdrop: scene.backdrop,
    motif: ov.motif,
    // شاشة النهاية فيها شعار القناة أصلًا
    watermark: ov.watermark && scene.template !== "end-screen",
  };
  const lang = useLang();
  const hasRecitation = Boolean(scene.ayahKey && media?.recitations[scene.ayahKey]);
  switch (scene.template) {
    case "big-question":
      return <BigQuestion {...base} question={p.question || "…"} highlight={p.highlight || undefined} element={p.element || "question-mark"} />;
    case "character-talk":
      return (
        <CharacterTalk
          {...base}
          line={p.line || "…"}
          variant={(p.variant || "narrator-m") as CharacterVariant}
          pose={(p.pose || "stand") as CharacterPose}
          element={p.element || undefined}
          side={(p.side as "left" | "right") || undefined}
        />
      );
    case "verse-card":
      return (
        <VerseCard
          {...base}
          text={p.text || ""}
          reference={p.reference || ""}
          reciter={hasRecitation ? p.reciter || media?.recitations[scene.ayahKey!]?.reciter || undefined : undefined}
          sourceNote={p.text && !p.text.startsWith("‹") ? lang.strings.quranAttribution : undefined}
          meaning={p.meaning || undefined}
          meaningSource={p.meaningSource || undefined}
        />
      );
    case "hadith-card":
      return <HadithCard {...base} {...p} />;
    case "comparison":
      return <Comparison {...base} {...p} />;
    case "list":
      return <ListScene {...base} {...p} />;
    case "big-number":
      return <BigNumber {...base} {...p} />;
    case "chart":
      return <ChartScene {...base} {...p} />;
    case "timeline":
      return <Timeline {...base} {...p} />;
    case "symbolic":
      return <Symbolic {...base} {...p} />;
    case "glow-story":
      return <GlowStory {...base} {...p} />;
    case "board-story":
      return <BoardStory {...base} {...p} prevBeats={prev?.template === "board-story" ? prev.props.beats : undefined} />;
    case "sketch-board":
      return <SketchBoard {...base} {...p} />;
    case "kinetic-text":
      return <KineticText {...base} {...p} />;
    case "set-scene":
      return <SetScene {...base} {...p} />;
    case "desk-moment":
      return <DeskMoment {...base} {...p} />;
    case "sim-stage":
      return <SimStage {...base} {...p} />;
    case "summary":
      return <Summary {...base} {...p} />;
    case "end-screen":
      return <EndScreen {...base} {...p} captions={false} />;
    default:
      return <Placeholder {...base} template={scene.template} text={p.text || p.question || p.line} />;
  }
};
