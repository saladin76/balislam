/**
 * Chapter start times for the YouTube description (funnel audit 8 Nov, D36).
 *
 * Order of truth: the real cuts of the assembled episode (one approved/current AV clip per scene, in order),
 * else the plan's own timings (voice durations + scene rules, exactly what the Master renderer uses).
 * Either way no chapter is ever written at or past the end of the video, and the first one is 0:00 as
 * YouTube requires. `estimated` is for the Studio only; published text never carries such a mark.
 */
import config from "../../config.json";
import { chapterStarts } from "../remotion/scenes/Episode";
import { introFramesFor } from "../remotion/scenes/ChannelIntro";
import { sceneFrames } from "../plan/duration";
import { emptyMedia, type EpisodeMedia } from "../plan/media";
import type { Plan } from "../plan/types";
import type { ChannelInfo } from "../channel/types";

export type RealTimings = {
  /** Duration in seconds of each scene's assembled cut, by scene id. Used only when every scene has one. */
  sceneSeconds?: Record<string, number>;
  /** Duration of the final video itself (the Master), when it exists. */
  totalSeconds?: number;
};
export type ChapterStart = { number: number; title: string; start: number };
export type ChapterTimeline = { starts: ChapterStart[]; total: number; estimated: boolean; source: "assembly" | "master" | "plan" };

/** A chapter needs a little room before the end to be one (YouTube also wants ascending times). */
const TAIL = 1;

export const chapterTimeline = (plan: Plan, media?: EpisodeMedia, channel?: ChannelInfo, real: RealTimings = {}): ChapterTimeline => {
  const fps = config.video.fps;
  const scenes = plan.chapters.flatMap((c) => c.scenes);
  const intro = introFramesFor(channel, plan) / fps;
  const planTotal = intro + scenes.reduce((n, s) => n + sceneFrames(s, media ?? emptyMedia) / fps, 0);
  const master = real.totalSeconds && Number.isFinite(real.totalSeconds) && real.totalSeconds > 0 ? real.totalSeconds : undefined;
  const cuts = real.sceneSeconds;
  const assembled = Boolean(cuts && scenes.length && scenes.every((s) => Number.isFinite(cuts[s.id]) && (cuts[s.id] ?? 0) > 0));

  let starts: ChapterStart[];
  let total: number;
  let source: ChapterTimeline["source"];
  if (assembled) {
    const clips = scenes.reduce((n, s) => n + cuts![s.id]!, 0);
    total = master ?? clips;
    // The Master adds the channel intro in front of the same cuts; never more than the intro itself.
    let t = Math.min(Math.max(total - clips, 0), intro);
    starts = plan.chapters.map((c, i) => {
      const start = i === 0 ? 0 : t;
      for (const s of c.scenes) t += cuts![s.id]!;
      return { number: c.number, title: c.title, start };
    });
    source = "assembly";
  } else {
    starts = chapterStarts(plan, media, channel);
    total = master ?? planTotal;
    source = master ? "master" : "plan";
  }
  // Never past the end, always ascending, the first at 0:00.
  const kept: ChapterStart[] = [];
  for (const s of starts) {
    if (!kept.length) { kept.push({ ...s, start: 0 }); continue; }
    if (s.start >= total - TAIL || s.start <= kept[kept.length - 1]!.start) continue;
    kept.push(s);
  }
  return { starts: kept, total, estimated: source === "plan", source };
};
