import path from "node:path";
import { mkdir } from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { projectRoot } from "../config/paths";
import { resolveScriptPath } from "../script/episodes";
import { loadPlan, regeneratePlan } from "../plan/io";
import type { Orientation } from "../remotion/scenes/types";

export type RenderEpisodeOptions = {
  episode: string;
  orientation: Orientation;
  /** فصل واحد فقط (للشورت) */
  chapter?: number;
  onProgress?: (pct: number, msg: string) => void;
};

/** يرندر الحلقة (أو فصلًا) من plan.json إلى episodes/<الحلقة>/out. */
export const renderEpisode = async (opts: RenderEpisodeOptions): Promise<string> => {
  const log = opts.onProgress ?? (() => {});
  const plan = (await loadPlan(opts.episode)) ?? (await regeneratePlan(opts.episode));
  const dir = path.join(path.dirname(await resolveScriptPath(opts.episode)), "out");
  await mkdir(dir, { recursive: true });
  log(0, "تجميع المشروع…");
  const serveUrl = await bundle({ entryPoint: path.join(projectRoot, "src", "remotion", "index.ts"), publicDir: path.join(projectRoot, "public") });
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  const inputProps = { plan, orientation: opts.orientation, chapter: opts.chapter };
  const composition = await selectComposition({ serveUrl, id: `episode-${opts.orientation}`, inputProps, browserExecutable });
  const name = `${plan.episode || opts.episode}-${opts.chapter ? `ch${opts.chapter}-` : ""}${opts.orientation}.mp4`;
  const output = path.join(dir, name);
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: "h264",
    crf: 20,
    x264Preset: "veryfast",
    outputLocation: output,
    browserExecutable,
    onProgress: ({ progress }) => log(Math.round(progress * 100), "رندر"),
  });
  return output;
};
