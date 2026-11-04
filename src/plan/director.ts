/**
 * Optional, backward-compatible creative direction for illustrated scenes.
 * Scene props remain strings so the existing plan/editor schema is unchanged.
 * All times are narration word offsets in frames (not wall-clock seconds).
 */
export const CAMERA_MODES = ["automatic", "directed"] as const;
export type CameraMode = (typeof CAMERA_MODES)[number];
export const isDirected = (mode?: string) => mode === "directed";

/** Explicit pose events: one event per line, "frame | pose".
 * Frame is an integer >= 0; malformed entries are ignored.
 * These events supplement semantic cue poses and replace filler gestures.
 */
export const parsePoseTimeline = (input?: string): { at: number; pose: string }[] =>
  (input ?? "")
    .split("\n")
    .map((line) => line.split("|").map((part) => part.trim()))
    .filter(([at, pose]) => /^\d+$/.test(at ?? "") && Boolean(pose))
    .map(([at, pose]) => ({ at: Number(at), pose: pose! }))
    .filter((event) => Number.isSafeInteger(event.at))
    .sort((a, b) => a.at - b.at);

/** A single controlled framing is intentionally more useful than auto cuts.
 * This helper makes the mode easy to test independently of Remotion rendering.
 */
export const cameraCuts = (starts: number[], duration: number, directed: boolean): number[] => {
  if (directed) return [0];
  const cuts: number[] = [];
  starts.forEach((start, i) => {
    const end = starts[i + 1] ?? duration;
    cuts.push(start);
    if (end - start > 75) cuts.push(start + Math.round((end - start) / 2));
  });
  return cuts.length ? cuts : [0];
};
