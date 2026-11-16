import config from "../../config.json";
import { sceneFrames } from "./duration";
import { seamPlan } from "./seams";
import type { EpisodeMedia } from "./media";
import type { Plan } from "./types";

/**
 * One episode length everywhere (UX review 9 Nov, D52): the sum of the plan's scene durations, the same
 * number the storyboard shows. It is "voice" (measured) once every narrated scene has its current voice
 * clip, otherwise "plan" (template minimums and word estimates before the voice exists). The script's own
 * word-count estimate stays inside the script panel only.
 */
export type EpisodeLength = { seconds: number; source: "voice" | "plan" };

export const episodeLength = (plan: Pick<Plan, "chapters"> & { channel?: string }, media?: Pick<EpisodeMedia, "voice" | "recitations">, fps = config.video.fps): EpisodeLength => {
  const scenes = plan.chapters.flatMap((c) => c.scenes);
  // وصل السرد (src/plan/seams.ts): ما يمر من ذيل مشهد تحت التالي لا يُعدّ مرتين
  const overlap = media ? seamPlan(scenes, media, { fps, channelId: plan.channel }).reduce((n, x) => n + x.overlapFrames, 0) : 0;
  const frames = scenes.reduce((n, s) => n + sceneFrames(s, media, fps), 0) - overlap;
  const narrated = scenes.filter((s) => s.narration?.trim());
  const measured = narrated.length > 0 && narrated.every((s) => media?.voice[s.id]?.text === s.narration.trim());
  return { seconds: Math.round((frames / fps) * 10) / 10, source: measured ? "voice" : "plan" };
};
