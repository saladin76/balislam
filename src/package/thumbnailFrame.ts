/**
 * Server-only: the real picture behind the «مشهد» thumbnail (src/package/thumbnails.ts). One frame of the scene's own
 * AV cut (`previews/scene-<id>-av.mp4`, the clip the owner watched and approved in «٢ المشاهد»), never a new render and
 * never a generated image. JPEG at the cut's own size, handed to the thumbnail still as a data URI; nothing is written
 * beside the episode.
 * D196 v4: once the 4K Master exists and is newer than the scene's cut, the same moment is taken from the Master instead
 * (the same approved picture at four times the pixels), so a zoomed cover stays sharp. Before the Master: the 1080p cut.
 */
import path from "node:path";
import os from "node:os";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { frameTimeFor } from "./thumbnails";

const run = promisify(execFile);

export const sceneCutFile = (scriptPath: string, sceneId: string) =>
  path.join(path.dirname(scriptPath), "previews", `scene-${sceneId}-av.mp4`);

/** ffmpeg arguments for one high-quality frame at `at` seconds (input seek, so the frame is exact and fast). */
export const frameArgs = (video: string, at: number, out: string) =>
  ["-nostdin", "-v", "error", "-y", "-ss", at.toFixed(3), "-i", video, "-frames:v", "1", "-q:v", "2", "-map_metadata", "-1", out];

/**
 * Where a scene starts inside the Master, from the assembly's real cut lengths (in plan order). The Master adds the channel
 * intro in front of the same cuts, never more than the intro itself (as chapterTimeline does). null when a cut length is missing.
 */
export const masterSceneStart = (ids: string[], sceneSeconds: Record<string, number>, sceneId: string, masterSeconds: number, introSeconds: number): number | null => {
  const i = ids.indexOf(sceneId);
  if (i < 0 || !ids.every((id) => Number.isFinite(sceneSeconds[id]) && sceneSeconds[id]! > 0)) return null;
  const clips = ids.reduce((n, id) => n + sceneSeconds[id]!, 0);
  const lead = Math.min(Math.max(masterSeconds - clips, 0), introSeconds);
  return lead + ids.slice(0, i).reduce((n, id) => n + sceneSeconds[id]!, 0);
};

/** The Master is used only when it is newer than the scene's own cut (a re-rendered scene after the Master means a stale Master). */
export const useMasterFrame = (o: { masterMtimeMs?: number; cutMtimeMs: number; start: number | null }) =>
  o.masterMtimeMs !== undefined && o.masterMtimeMs > o.cutMtimeMs && o.start !== null;

export type MasterSource = { file: string; ids: string[]; sceneSeconds: Record<string, number>; introSeconds: number };

/** The scene's frame as a JPEG data URI, or null when the scene has no cut on disk yet (the thumbnail then shows its element). */
export const sceneFrameDataUri = async (scriptPath: string, sceneId: string, atSeconds?: number, master?: MasterSource): Promise<{ uri: string; at: number; from: "master" | "cut" } | null> => {
  const video = sceneCutFile(scriptPath, sceneId);
  if (!/^[\w-]+$/.test(sceneId) || !existsSync(video)) return null;
  const { parseFile } = await import("music-metadata");
  const seconds = async (f: string) => (await parseFile(f, { duration: true }).catch(() => null))?.format.duration ?? 0;
  const at = frameTimeFor(await seconds(video), atSeconds);
  let source = video, seek = at, from: "master" | "cut" = "cut";
  if (master && existsSync(master.file)) {
    const start = masterSceneStart(master.ids, master.sceneSeconds, sceneId, await seconds(master.file), master.introSeconds);
    if (useMasterFrame({ masterMtimeMs: (await stat(master.file)).mtimeMs, cutMtimeMs: (await stat(video)).mtimeMs, start })) {
      source = master.file; seek = start! + at; from = "master";
    }
  }
  const dir = await mkdtemp(path.join(os.tmpdir(), "bal-thumb-"));
  try {
    const out = path.join(dir, "frame.jpg");
    await run("ffmpeg", frameArgs(source, seek, out), { timeout: 60_000 });
    return { uri: `data:image/jpeg;base64,${(await readFile(out)).toString("base64")}`, at, from };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};
