/**
 * previews/<slot>.seams.json: the joins of the assembled file on disk (src/studio/assembleScenes.ts), bound to that file by its
 * size and modification time. Read-only for timings (chapters, seam times, the seam report); never an approval.
 */
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import type { SeamPlan } from "../plan/seams";

export type JoinedSeam = SeamPlan & { at: number };
export type SeamsRecord = { version: 1; size: number; mtimeMs: number; fps: number;
  /** seconds from each scene's start in the file to the next scene's start (the last: its own length) */
  sceneSeconds: Record<string, number>; seams: JoinedSeam[];
  loudness: { target: number | null; gain: Record<string, number> } };
export const seamsRecordFile = (scriptPath: string, slot = "episode") => path.join(path.dirname(scriptPath), "previews", `${slot}.seams.json`);

export const readSeamsRecord = async (scriptPath: string, slot = "episode"): Promise<SeamsRecord | null> => {
  try {
    const rec = JSON.parse(await readFile(seamsRecordFile(scriptPath, slot), "utf8")) as SeamsRecord;
    const st = await stat(path.join(path.dirname(scriptPath), "previews", `${slot}.mp4`));
    return rec.version === 1 && rec.size === st.size && Math.abs(rec.mtimeMs - st.mtimeMs) < 1 ? rec : null;
  } catch { return null; }
};
