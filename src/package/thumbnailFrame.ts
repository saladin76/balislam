/**
 * Server-only: the real picture behind the «مشهد» thumbnail (src/package/thumbnails.ts). One frame of the scene's own
 * AV cut (`previews/scene-<id>-av.mp4`, the clip the owner watched and approved in «٢ المشاهد»), never a new render and
 * never a generated image. JPEG at the cut's own size, handed to the thumbnail still as a data URI; nothing is written
 * beside the episode.
 */
import path from "node:path";
import os from "node:os";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { frameTimeFor } from "./thumbnails";

const run = promisify(execFile);

export const sceneCutFile = (scriptPath: string, sceneId: string) =>
  path.join(path.dirname(scriptPath), "previews", `scene-${sceneId}-av.mp4`);

/** ffmpeg arguments for one high-quality frame at `at` seconds (input seek, so the frame is exact and fast). */
export const frameArgs = (video: string, at: number, out: string) =>
  ["-nostdin", "-v", "error", "-y", "-ss", at.toFixed(3), "-i", video, "-frames:v", "1", "-q:v", "2", "-map_metadata", "-1", out];

/** The scene's frame as a JPEG data URI, or null when the scene has no cut on disk yet (the thumbnail then shows its element). */
export const sceneFrameDataUri = async (scriptPath: string, sceneId: string, atSeconds?: number): Promise<{ uri: string; at: number } | null> => {
  const video = sceneCutFile(scriptPath, sceneId);
  if (!/^[\w-]+$/.test(sceneId) || !existsSync(video)) return null;
  const { parseFile } = await import("music-metadata");
  const duration = (await parseFile(video, { duration: true }).catch(() => null))?.format.duration ?? 0;
  const at = frameTimeFor(duration, atSeconds);
  const dir = await mkdtemp(path.join(os.tmpdir(), "bal-thumb-"));
  try {
    const out = path.join(dir, "frame.jpg");
    await run("ffmpeg", frameArgs(video, at, out), { timeout: 60_000 });
    return { uri: `data:image/jpeg;base64,${(await readFile(out)).toString("base64")}`, at };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};
