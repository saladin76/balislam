import React from "react";
import { BigQuestion } from "./BigQuestion";
import { CharacterTalk } from "./CharacterTalk";
import { VerseCard } from "./VerseCard";
import { BasmalaOnScreen } from "./BasmalaOnScreen";
import { showsBasmalaOverlay } from "../../quran/onScreen";
export { showsBasmalaOverlay };
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
import { InkShot } from "./InkShot";
import { HorizonShot, HorizonVerse } from "./HorizonShot";
import { RahhalaDesk } from "../dafatir/world/RahhalaDesk";
import { InkMeaning } from "./InkMeaning";
import { SketchBoard } from "./SketchBoard";
import { BoardStory } from "./BoardStory";
import { AlleyTale } from "./AlleyTale";
import { RoadJourney } from "./RoadJourney";
import { LightStage } from "./LightStage";
import { DuaBoard } from "./DuaBoard";
import { SHOTS } from "../illus/shots";
import { MotionStory } from "./MotionStory";
import { KineticText } from "./KineticText";
import { SimStage } from "./SimStage";
import { DeskMoment } from "./DeskMoment";
import { DocPlate } from "./DocPlate";
import { NoorText } from "./NoorText";
import { staticFile } from "remotion";
import { SetScene } from "./SetScene";
import { MapJourney } from "./MapJourney";
import { EndScreen } from "./EndScreen";
import type { PlanScene } from "../../plan/types";
import type { ThemeId } from "../../../brand/themes";
import type { CharacterPose, CharacterVariant } from "../../../characters/Character";
import type { Orientation } from "./types";
import type { WordTiming } from "./timing";
import type { EpisodeMedia } from "../../plan/media";
import { resolveOverlays, useChannelOverlays, type Overlays } from "../../../brand/identity/index";

type Common = { themeId: ThemeId; orientation: Orientation; eyebrow?: string; timings?: WordTiming[]; media?: EpisodeMedia; episodeOverlays?: Partial<Overlays>; prev?: PlanScene; next?: PlanScene };

/**
 * يحوّل مشهدًا من الخطة إلى مكوّن القالب المناسب، ومعه البسملة على الشاشة حين تُنطق داخل مشهد راوٍ
 * (طلب المالك ١٥ نوفمبر). بطاقة الآية ولقطة البسملة المصممة (دفاتر الزمن) تعرضانها بنفسيهما.
 */
export const SceneFromPlan: React.FC<{ scene: PlanScene } & Common> = (props) => {
  const { scene } = props;
  const template = <SceneTemplate {...props} />;
  if (!showsBasmalaOverlay(scene)) return template;
  return (
    <>
      {template}
      <BasmalaOnScreen narration={scene.narration} timings={props.timings} themeId={props.themeId} orientation={props.orientation} />
    </>
  );
};

const SceneTemplate: React.FC<{ scene: PlanScene } & Common> = ({ scene, themeId, orientation, eyebrow, timings, media, episodeOverlays, prev, next }) => {
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
  const hasRecitation = Boolean(scene.ayahKey && media?.recitations[scene.ayahKey]);
  const recitationDuration = hasRecitation ? media!.recitations[scene.ayahKey!]!.duration : undefined;
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
      if (p.look === "horizon")
        return <HorizonVerse {...base} recitationDuration={recitationDuration} text={p.text || ""} ayahKey={scene.ayahKey} head={p.head || undefined} reciter={hasRecitation ? p.reciter || media?.recitations[scene.ayahKey!]?.reciter || undefined : undefined} />;
      return (
        <VerseCard
          {...base}
          recitationDuration={recitationDuration}
          text={p.text || ""}
          reference={p.reference || ""}
          reciter={hasRecitation ? p.reciter || media?.recitations[scene.ayahKey!]?.reciter || undefined : undefined}
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
    case "road-journey":
      return <RoadJourney {...base} {...p} />;
    case "light-stage":
      return <LightStage {...base} {...p} />;
    case "dua-board":
      // اللوح نفسه يستمر في المشهد التالي: لا إظلام بين المشهدين
      return <DuaBoard {...base} {...p} continues={next?.template === "dua-board"} fromBoard={prev?.template === "dua-board"} />;
    case "alley-tale": {
      // لقطتان متتاليتان في المكان نفسه: قطع مباشر بلا إظلام بينهما
      const here = p.shot ? SHOTS[p.shot]?.place : undefined;
      const there = next?.template === "alley-tale" && next.props.shot ? SHOTS[next.props.shot]?.place : undefined;
      return <AlleyTale {...base} {...p} continues={Boolean(here && here === there)} />;
    }
    case "motion-story":
      return <MotionStory {...base} {...p} />;
    case "ink-shot":
      return <InkShot {...base} {...p} />;
    case "horizon-shot":
      return <HorizonShot {...base} {...p} />;
    case "rahhala-desk":
      return <RahhalaDesk {...base} {...p} />;
    case "ink-meaning":
      return <InkMeaning {...base} {...p} />;
    case "sketch-board":
      return <SketchBoard {...base} {...p} />;
    case "kinetic-text":
      return <KineticText {...base} {...p} />;
    case "map-journey":
      return <MapJourney {...base} {...p} />;
    case "set-scene":
      return <SetScene {...base} {...p} />;
    case "desk-moment":
      return <DeskMoment {...base} {...p} />;
    case "doc-plate": {
      // كل لوحة (الأولى والثانية والثالثة): الملف الفعلي من وسائط الحلقة أو مكتبة القناة
      const plate = (img?: string) => {
        const ref = img ? media?.images?.find((x) => x === img || x.replace(/\.[^.]+$/, "") === img) : undefined;
        const file = ref ? ref.replace(/^lib:/, "lib__") : "";
        const src = file && media ? (media.mode === "static" ? staticFile(`${media.base}images/${file}`) : `${media.base}images/${encodeURIComponent(file)}${media.query ?? ""}`) : undefined;
        return { src, video: /\.(mp4|webm|mov)$/i.test(file) };
      };
      const [a, b, c] = [plate(p.image), plate(p.image2), plate(p.image3)];
      return <DocPlate {...base} {...p} src={a.src} video={a.video} src2={b.src} video2={b.video} src3={c.src} video3={c.video} />;
    }
    case "sim-stage":
      return <SimStage {...base} {...p} />;
    case "noor-text":
      return <NoorText {...base} {...p} />;
    case "summary":
      return <Summary {...base} {...p} />;
    case "end-screen":
      return <EndScreen {...base} {...p} captions={false} />;
    default:
      return <Placeholder {...base} template={scene.template} text={p.text || p.question || p.line} />;
  }
};
