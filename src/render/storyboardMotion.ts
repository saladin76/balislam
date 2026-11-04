/**
 * قياس حركة كل مشهد في الستوري بورد: معاينة صامتة خفيفة (ثلث الدقة، بلا صوت، لا تُنشر)،
 * ثم مقياس الحركة لكل ثانية، ونسبة كل مشهد وأطول سكون فيه. تُحفظ في out/storyboard-motion.json
 * مع بصمة كل مشهد، فالمشهد الذي تغيّر بعد القياس يظهر «يحتاج قياسًا جديدًا».
 */
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { loadPlan, regeneratePlan } from "../plan/io";
import { prepareRenderMedia } from "../plan/collect";
import { sceneFrames } from "../plan/duration";
import { sceneHash } from "../plan/sceneReview";
import { introFramesFor } from "../remotion/scenes/ChannelIntro";
import { channelInfo, loadChannel, loadChannelIdentity } from "../channel";
import { browserExecutable, getServeUrl } from "./bundle";
import { outDirFor } from "./episode";
import { ACTIVE_PCT, measureMotion } from "./motionMeter";
import { inspectMotionLogic, type MotionLogicReview } from "../plan/motionLogic";
import { currentMotionFingerprint } from "./motionFingerprint";
import { renderMotionAuditMarkdown } from "./motionAudit";
import config from "../../config.json";

export type StoryboardMotion = { at: string; percent: number; orientation: "landscape" | "portrait"; inputHash?: string; scenes: Record<string, { hash: string; pct: number; still: number; from: number; logic?: MotionLogicReview }> };

export const storyboardMotionFile = async (episode: string) => path.join(await outDirFor(episode), "storyboard-motion.json");

export const loadStoryboardMotion = async (episode: string): Promise<StoryboardMotion | null> => {
  const f = await storyboardMotionFile(episode);
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(await readFile(f, "utf8")) as StoryboardMotion;
  } catch {
    return null;
  }
};

export const measureStoryboardMotion = async (episode: string, opts: { orientation?: "landscape" | "portrait"; onProgress?: (pct: number, msg: string) => void } = {}) => {
  const log = opts.onProgress ?? (() => {});
  const orientation = opts.orientation ?? "landscape";
  const plan = (await loadPlan(episode)) ?? (await regeneratePlan(episode));
  log(0, "تجهيز الوسائط…");
  const media = await prepareRenderMedia(episode, plan);
  const serveUrl = await getServeUrl(true);
  const channel = loadChannel();
  const info = channelInfo(channel);
  const inputProps = { plan, orientation, media, identity: loadChannelIdentity(), channel: info };
  const inputHash = await currentMotionFingerprint(episode, plan, orientation);
  const composition = await selectComposition({ serveUrl, id: `episode-${orientation}`, inputProps, browserExecutable: browserExecutable() });
  const video = path.join(await outDirFor(episode), `${episode}-storyboard-${orientation}.mp4`);
  let last = -1;
  try {
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: "h264",
    scale: 1 / 3,
    crf: 26,
    x264Preset: "ultrafast",
    muted: true,
    outputLocation: video,
    browserExecutable: browserExecutable(),
    onProgress: ({ progress }) => {
      const p = Math.round(progress * 90);
      if (p !== last) log((last = p), "رندر المعاينة الخفيفة");
    },
  });
  log(92, "قياس الحركة…");
  const m = await measureMotion(video, orientation);
  const fps = config.video.fps;
  let t = introFramesFor(info, plan);
  const scenes: StoryboardMotion["scenes"] = {};
  for (const s of plan.chapters.flatMap((c) => c.scenes)) {
    const d = sceneFrames(s, media);
    const a = Math.floor(t / fps);
    const b = Math.max(a + 1, Math.floor((t + d) / fps));
    const secs = m.perSecond.slice(a, b);
    let run = 0;
    let still = 0;
    for (const v of secs) {
      run = v >= ACTIVE_PCT ? 0 : run + 1;
      still = Math.max(still, run);
    }
    const pct = Math.round((100 * secs.filter((v) => v >= ACTIVE_PCT).length) / Math.max(1, secs.length));
    scenes[s.id] = { hash: sceneHash(s), pct, still, from: t / fps, logic: inspectMotionLogic(s, { pct, still, perSecond: secs, activityThreshold: ACTIVE_PCT }, media.voice[s.id]?.text === s.narration.trim() ? media.voice[s.id]?.words : undefined) };
    t += d;
  }
  const out: StoryboardMotion = { at: new Date().toISOString(), percent: m.percent, orientation, inputHash, scenes };
  const outputFile = await storyboardMotionFile(episode);
  await writeFile(outputFile, JSON.stringify(out, null, 2) + "\n");
  await writeFile(path.join(path.dirname(outputFile), "storyboard-motion-report.md"), renderMotionAuditMarkdown(plan, out));
  log(100, "تم");
  return out;
  } finally {
    // لا تترك معاينة ضخمة حتى إذا فشل الرندر أو تحليل الحركة.
    await rm(video, { force: true });
  }
};
