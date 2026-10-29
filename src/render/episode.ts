import path from "node:path";
import { mkdir } from "node:fs/promises";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { resolveScriptPath } from "../script/episodes";
import { loadPlan, regeneratePlan } from "../plan/io";
import { prepareRenderMedia } from "../plan/collect";
import type { EpisodeMedia } from "../plan/media";
import type { Plan } from "../plan/types";
import type { Orientation } from "../remotion/scenes/types";
import { browserExecutable, getServeUrl } from "./bundle";
import { channelInfo, loadChannel, loadChannelIdentity } from "../channel";

export type RenderEpisodeOptions = {
  episode: string;
  orientation: Orientation;
  /** فصل واحد فقط (للشورت) */
  chapter?: number;
  outFile?: string;
  plan?: Plan;
  media?: EpisodeMedia;
  onProgress?: (pct: number, msg: string) => void;
};

export const outDirFor = async (episode: string) => {
  const dir = path.join(path.dirname(await resolveScriptPath(episode)), "out");
  await mkdir(dir, { recursive: true });
  return dir;
};

/** يرندر الحلقة (أو فصلًا) من plan.json بالصوت والمؤثرات إن وُجدت. */
export const renderEpisode = async (opts: RenderEpisodeOptions): Promise<string> => {
  const log = opts.onProgress ?? (() => {});
  const plan = opts.plan ?? (await loadPlan(opts.episode)) ?? (await regeneratePlan(opts.episode));
  log(0, "تجهيز الوسائط…");
  // الوسائط تُنسخ قبل التجميع، لأن Remotion يضمّ مجلد public وقت التجميع
  const media = opts.media ?? (await prepareRenderMedia(opts.episode, plan));
  log(0, "تجميع المشروع…");
  const serveUrl = await getServeUrl(!opts.media);
  const channel = loadChannel();
  const inputProps = { plan, orientation: opts.orientation, chapter: opts.chapter, media, identity: loadChannelIdentity(), channel: channelInfo(channel) };
  const composition = await selectComposition({ serveUrl, id: `episode-${opts.orientation}`, inputProps, browserExecutable: browserExecutable() });
  const output = opts.outFile ?? path.join(await outDirFor(opts.episode), `${plan.episode || opts.episode}-${opts.chapter ? `ch${opts.chapter}-` : ""}${opts.orientation}.mp4`);
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: "h264",
    crf: 18,
    x264Preset: "veryfast",
    audioCodec: "aac",
    outputLocation: output,
    browserExecutable: browserExecutable(),
    onProgress: ({ progress }) => log(Math.round(progress * 100), "رندر"),
  });
  return output;
};

/** الصورة المصغّرة بعنوان محدد. */
export const renderThumbnail = async (input: { themeId: string; title: string; highlight?: string; element?: string; lang?: string }, output: string) => {
  const serveUrl = await getServeUrl();
  const channel = loadChannel();
  const props = { ...input, identity: loadChannelIdentity(), channel: channelInfo(channel) };
  const composition = await selectComposition({ serveUrl, id: "thumbnail", inputProps: props, browserExecutable: browserExecutable() });
  await renderStill({ serveUrl, composition, inputProps: props, output, browserExecutable: browserExecutable() });
  return output;
};
