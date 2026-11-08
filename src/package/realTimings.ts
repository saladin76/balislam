/** Server-only: reads real durations from disk for chapterTimeline (src/package/chapterTimes.ts, D36). */
import path from "node:path";
import { existsSync } from "node:fs";
import type { Plan } from "../plan/types";
import type { RealTimings } from "./chapterTimes";

/** Real timings on disk: each scene's AV cut (only if the assembly exists) and the Master file. */
export const realEpisodeTimings = async (scriptPath: string, plan: Plan): Promise<RealTimings> => {
  const { parseFile } = await import("music-metadata");
  const seconds = async (file: string) => {
    if (!existsSync(file)) return undefined;
    try {
      const d = (await parseFile(file, { duration: true })).format.duration;
      return d && Number.isFinite(d) && d > 0 ? d : undefined;
    } catch {
      return undefined;
    }
  };
  const dir = path.dirname(scriptPath);
  const out: RealTimings = {};
  const master = await seconds(path.join(dir, "out", "package", `${path.basename(dir).slice(0, 3)}-episode.mp4`));
  if (master) out.totalSeconds = master;
  if (existsSync(path.join(dir, "previews", "episode.mp4"))) {
    const sceneSeconds: Record<string, number> = {};
    for (const s of plan.chapters.flatMap((c) => c.scenes)) {
      const d = await seconds(path.join(dir, "previews", `scene-${s.id}-av.mp4`));
      if (!d) return out;
      sceneSeconds[s.id] = d;
    }
    out.sceneSeconds = sceneSeconds;
  }
  return out;
};
