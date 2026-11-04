import { createHash } from "node:crypto";
import type { Plan } from "../plan/types";
import type { EpisodeMedia } from "../plan/media";

/** بصمة مدخلات المعاينة؛ إدخال إصدار الفاحص يجعل النتائج القديمة ظاهرة كقديمة بدل اعتبارها معتمدة. */
const AUDIT_VERSION = 2;
export const motionFingerprint = (
  plan: Plan,
  media: Pick<EpisodeMedia, "voice" | "recitations" | "images" | "sfx">,
  identity: unknown,
  channel: unknown,
  orientation: "landscape" | "portrait" = "landscape",
): string => {
  const { updatedAt: _ignored, ...renderPlan } = plan;
  const voice = Object.fromEntries(Object.entries(media.voice).sort(([a], [b]) => a.localeCompare(b)).map(([id, clip]) =>
    [id, { hash: clip.hash, text: clip.text, duration: clip.duration, words: clip.words }]));
  return createHash("sha256").update(JSON.stringify({
    version: AUDIT_VERSION,
    plan: renderPlan,
    voice,
    recitations: media.recitations,
    images: media.images ?? [],
    sfx: media.sfx,
    identity,
    channel,
    orientation,
  })).digest("hex").slice(0, 24);
};
