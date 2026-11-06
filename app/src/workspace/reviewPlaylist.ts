import type { PlanScene } from "../../../src/plan/types";
import type { EpisodeMedia } from "../../../src/plan/media";

/** Build one ordered listening queue from *current* narration only.
 * Missing/stale clips are omitted, so the full-episode action can be disabled.
 */
export const narrationReviewPlaylist = (
  scenes: Pick<PlanScene, "id" | "narration">[],
  voice: EpisodeMedia["voice"],
): { id: string; file: string; text: string }[] =>
  scenes.flatMap((scene) => {
    const clip = voice[scene.id];
    if (!scene.narration.trim() || !clip || clip.text !== scene.narration.trim() ||
      typeof clip.file !== "string" || !/^[a-z0-9][a-z0-9_.-]{0,150}\.mp3$/i.test(clip.file)) return [];
    return [{ id: scene.id, file: clip.file, text: scene.narration.trim() }];
  });
