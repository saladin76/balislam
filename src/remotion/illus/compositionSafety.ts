/**
 * Non-invasive camera and typography diagnostics for Studio scene previews.
 * No scene state, no output files, no mutation of channel defaults.
 */
export type HorizontalSpan = { lo: number; hi: number; name?: string };
export type CameraFrame = { x: number; z: number };
export type Stage = "solo" | "companion" | "witnesses";
export type Focus = "hero" | "other" | "center" | "pair" | "door" | "board";

/** Switch viewpoint on a speech beat, rather than showing half of each witness while tracking between them. */
export const requiresFocusCut = (opts: {
  portrait: boolean; contained: boolean; stage: Stage;
  from: Focus; to: Focus;
}) => opts.portrait && opts.contained && opts.stage === "witnesses" && opts.from !== opts.to;

export const visibleHorizontal = (camera: CameraFrame, portrait: boolean) => {
  if (!Number.isFinite(camera.x) || !Number.isFinite(camera.z) || camera.z <= 0)
    throw new Error("Camera position and zoom must be finite; zoom must be positive.");
  const half = (portrait ? 304 : 960) / camera.z;
  return { lo: camera.x - half, hi: camera.x + half };
};

export type CompositionIssue = {
  kind: "required-clipped" | "optional-half-clipped" | "off-world";
  name: string;
};
/** A geometry-only audit. A clean result does not replace watching the actual rendered frame. */
export const compositionIssues = (opts: {
  camera: CameraFrame; portrait: boolean; worldW: number;
  required: readonly HorizontalSpan[]; optional?: readonly HorizontalSpan[];
  tolerance?: number;
}): CompositionIssue[] => {
  const { lo, hi } = visibleHorizontal(opts.camera, opts.portrait);
  const tol = opts.tolerance ?? 0.5;
  const inside = (s: HorizontalSpan) => s.lo >= lo - tol && s.hi <= hi + tol;
  const crosses = (s: HorizontalSpan) => s.hi > lo + tol && s.lo < hi - tol;
  const issues: CompositionIssue[] = [];
  if (lo < -tol || hi > opts.worldW + tol) issues.push({ kind: "off-world", name: "world" });
  opts.required.forEach((s, index) => {
    if (!inside(s)) issues.push({ kind: "required-clipped", name: s.name ?? `required-${index + 1}` });
  });
  opts.optional?.forEach((s, index) => {
    if (!inside(s) && crosses(s)) issues.push({ kind: "optional-half-clipped", name: s.name ?? `optional-${index + 1}` });
  });
  return issues;
};

/** May a pill remain beside its owner without being pulled back across the owner's body? */
export const pillClearOfOwner = (opts: {
  x: number; ownerX: number; direction: 1 | -1; width: number; clearance: number;
  camera: CameraFrame; portrait: boolean; margin?: number;
}): boolean => {
  const { lo, hi } = visibleHorizontal(opts.camera, opts.portrait);
  const half = opts.width / 2;
  const margin = opts.margin ?? 20;
  if (!Number.isFinite(opts.x) || !Number.isFinite(half) || half <= 0 || opts.clearance < 0) return false;
  if (opts.x - half < lo + margin || opts.x + half > hi - margin) return false;
  return opts.direction === 1
    ? opts.x - half >= opts.ownerX + opts.clearance
    : opts.x + half <= opts.ownerX - opts.clearance;
};
