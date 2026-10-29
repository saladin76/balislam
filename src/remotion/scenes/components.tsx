import React from "react";
import { BigQuestion } from "./BigQuestion";
import { CharacterTalk } from "./CharacterTalk";
import { VerseCard } from "./VerseCard";
import { Placeholder } from "./Placeholder";
import type { PlanScene } from "../../plan/types";
import type { ThemeId } from "../../../brand/themes";
import type { CharacterPose, CharacterVariant } from "../../../characters/Character";
import type { Orientation } from "./types";

type Common = { themeId: ThemeId; orientation: Orientation; eyebrow?: string };

/** يحوّل مشهدًا من الخطة إلى مكوّن القالب المناسب. */
export const SceneFromPlan: React.FC<{ scene: PlanScene } & Common> = ({ scene, themeId, orientation, eyebrow }) => {
  const p = scene.props;
  const base = { themeId, orientation, eyebrow, narration: scene.narration || undefined, captions: scene.captions ?? true, backdrop: scene.backdrop };
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
          side={(p.side as "left" | "right") || "right"}
        />
      );
    case "verse-card":
      return <VerseCard {...base} text={p.text || ""} reference={p.reference || ""} reciter={p.reciter || undefined} />;
    default:
      return <Placeholder {...base} template={scene.template} text={p.text || p.question || p.line} />;
  }
};
