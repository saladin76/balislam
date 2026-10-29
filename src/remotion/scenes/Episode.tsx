import React from "react";
import { Series, type CalculateMetadataFunction } from "remotion";
import type { Plan } from "../../plan/types";
import { sceneFrames } from "../../plan/duration";
import { SceneFromPlan } from "./components";
import type { Orientation } from "./types";

export type EpisodeProps = { plan: Plan; orientation: Orientation; /** فصل واحد فقط (للشورت) */ chapter?: number };

const chaptersOf = (p: EpisodeProps) => (p.chapter ? p.plan.chapters.filter((c) => c.number === p.chapter) : p.plan.chapters);

/** الحلقة كاملة (أو فصل واحد) من خطة الحلقة. */
export const Episode: React.FC<EpisodeProps> = (props) => {
  const { plan, orientation } = props;
  return (
    <Series>
      {chaptersOf(props).flatMap((ch) =>
        ch.scenes.map((scene) => (
          <Series.Sequence key={scene.id} durationInFrames={sceneFrames(scene)} name={`${scene.id} · ${scene.template}`}>
            <SceneFromPlan scene={scene} themeId={plan.themeId} orientation={orientation} eyebrow={`الفصل ${ch.number} · ${ch.title}`} />
          </Series.Sequence>
        )),
      )}
    </Series>
  );
};

export const episodeFrames = (props: EpisodeProps) => Math.max(1, chaptersOf(props).reduce((n, ch) => n + ch.scenes.reduce((m, s) => m + sceneFrames(s), 0), 0));

export const calculateEpisodeMetadata: CalculateMetadataFunction<EpisodeProps> = ({ props }) => ({ durationInFrames: episodeFrames(props) });
