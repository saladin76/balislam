/**
 * Synthetic Remotion acceptance renders only the first <= 30 frames.
 * renderMedia() accepts 'frameRange', NOT 'framesToRender'.
 * Keep the requested inclusive range and ffprobe expectation in sync.
 */
export const syntheticFramePlan = (durationInFrames: number): {
  frameRange: [number, number];
  expectedFrames: number;
} => {
  if (!Number.isSafeInteger(durationInFrames) || durationInFrames < 1)
    throw new Error("Invalid synthetic composition frame duration.");
  const expectedFrames = Math.min(30, durationInFrames);
  return { frameRange: [0, expectedFrames - 1], expectedFrames };
};
