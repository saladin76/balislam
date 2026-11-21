import type { Plan } from "../plan/types";
import type { EpisodeMedia } from "../plan/media";
// KI-093: the pure functions live in stillnessSpans.ts (safe in the render bundle); this file keeps the server part.
export { SACRED_WORD, duaRanges, intendedStillness, mergeSpans, exemptSeconds } from "./stillnessSpans";
export type { Span } from "./stillnessSpans";
import { intendedStillness, mergeSpans, exemptSeconds } from "./stillnessSpans";

export const exemptForRender = async (plan: Plan, media?: Pick<EpisodeMedia, "voice" | "recitations">, chapter?: number): Promise<Set<number>> => {
  const { introFramesFor } = await import("../remotion/scenes/ChannelIntro");
  const { channelInfo, loadChannel } = await import("../channel/index");
  const start = introFramesFor(channelInfo(loadChannel()), plan, chapter) / 30;
  const spans = intendedStillness(plan, start, media, chapter);
  const end = spans.reduce((a, x) => Math.max(a, x.to), 0);
  return exemptSeconds(spans, Math.ceil(end) + 1);
};
