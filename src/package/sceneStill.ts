/**
 * Server-only (D196 v5, owner 23 Nov: «والثلاثة من رندر 4K»): one 4K still of a scene at a moment, for a cover before the
 * Master exists. It is the scene AV cut's own picture at four times the pixels: the same one-scene plan (the channel intro
 * only when the scene opens the episode, as `renderShotsPreview` builds it), the same episode media and the same
 * "scene-preview" timing and props as `renderEpisode`, rendered with `renderStill` at scale 2 (3840×2160). Not a new design,
 * not a generated image, no audio, and nothing written beside the episode (the frame goes to a temporary folder).
 */
import path from "node:path";
import os from "node:os";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import type { Plan } from "../plan/types";
import config from "../../config.json";

/** The one-scene plan exactly as the scene's AV cut is rendered from it (src/render/shotsPreview.ts). */
export const sceneCutPlan = (full: Plan, sceneId: string): Plan | null => {
  if (!full.chapters.some((c) => c.scenes.some((s) => s.id === sceneId))) return null;
  const opensEpisode = full.chapters[0]?.scenes[0]?.id === sceneId;
  return { ...full, ...(opensEpisode ? {} : { intro: false }),
    chapters: full.chapters.map((c) => ({ ...c, scenes: c.scenes.filter((s) => s.id === sceneId) })).filter((c) => c.scenes.length) };
};

/** The composition frame for `at` seconds into the cut (the cut starts at frame 0 of its own composition). */
export const stillFrameAt = (at: number, durationInFrames: number, fps = config.video.fps) =>
  Math.min(Math.max(Math.round(at * fps), 0), Math.max(durationInFrames - 1, 0));

/** A JPEG data URI of the scene at `at` seconds at 4K, or null when it cannot be rendered (the caller then uses the cut). */
export const sceneStill4k = async (episode: string, sceneId: string, at: number): Promise<string | null> => {
  const { loadPlan } = await import("../plan/io");
  const full = await loadPlan(episode);
  const plan = full && sceneCutPlan(full, sceneId);
  if (!plan) return null;
  const { prepareRenderMedia } = await import("../plan/collect");
  const { createIsolatedRenderBundle, browserExecutable } = await import("../render/bundle");
  const { selectComposition, renderStill } = await import("@remotion/renderer");
  const { channelInfo, loadChannel, loadChannelIdentity } = await import("../channel");
  // A scene draft's media: an unattached recitation stays silent, which a picture never shows anyway.
  const media = await prepareRenderMedia(episode, plan, { requireApprovedQuran: false });
  const bundle = await createIsolatedRenderBundle(media);
  const dir = await mkdtemp(path.join(os.tmpdir(), "bal-thumb-4k-"));
  try {
    const inputProps = { plan, orientation: "landscape" as const, media, timingMode: "scene-preview" as const,
      identity: loadChannelIdentity(), channel: channelInfo(loadChannel()) };
    const composition = await selectComposition({ serveUrl: bundle.serveUrl, id: "episode-landscape", inputProps, browserExecutable: browserExecutable() });
    const out = path.join(dir, "still.jpg");
    await renderStill({ serveUrl: bundle.serveUrl, composition, inputProps, frame: stillFrameAt(at, composition.durationInFrames),
      output: out, imageFormat: "jpeg", jpegQuality: 95, scale: 3840 / composition.width, overwrite: true, browserExecutable: browserExecutable() });
    return `data:image/jpeg;base64,${(await readFile(out)).toString("base64")}`;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
    await bundle.cleanup();
  }
};
