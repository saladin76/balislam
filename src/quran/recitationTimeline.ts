import type { Recitation } from "../plan/media";

/**
 * One authoritative schedule for the audio and the verse picture.
 * There are no artificial lead-in, tail or gaps between verse clips.
 * Frame positions are obtained from cumulative audio durations to avoid
 * a rounding gap at the end of a multi-ayah passage.
 */
export const recitationParts = (rec: Recitation) =>
  (rec.parts?.length ? rec.parts : [{ file: rec.file, duration: rec.duration }]).filter(
    (part) => typeof part.file === "string" && Number.isFinite(part.duration) && part.duration > 0,
  );

export const recitationSeconds = (rec: Recitation): number =>
  recitationParts(rec).reduce((sum, part) => sum + part.duration, 0);

export const recitationFrameSchedule = (rec: Recitation, fps: number) => {
  const parts = recitationParts(rec);
  if (!Number.isFinite(fps) || fps <= 0) throw new Error("Invalid recitation frame rate");
  let elapsed = 0;
  return parts.map((part) => {
    const from = Math.round(elapsed * fps);
    elapsed += part.duration;
    const to = Math.round(elapsed * fps);
    return { file: part.file, from, durationInFrames: Math.max(1, to - from) };
  });
};
