/**
 * Studio vNext: scene-first audiovisual production policy.
 *
 * A pure state machine for trusted server adapters, NOT a filesystem/publishing
 * authorization. Production must authenticate the human approver, hash real
 * source/preview/Master files under the episode artifact lock and persist an
 * append-only signed ledger before relying on these transitions.
 *
 * Old six-stage approvals must NOT be migrated into scene approvals implicitly.
 */
import { createHash } from "node:crypto";

export type SceneStatus = "queued" | "in_review" | "approved" | "needs_revision";
export type SourceState = {
  sha256: string;
  approval?: { by: string; at: string; sha256: string };
};
export type SceneState = {
  id: string;
  sourceSha256: string;
  status: SceneStatus;
  previewSha256?: string;
  approval?: { by: string; at: string; previewSha256: string; sourceSha256: string };
};
export type SceneFirstProduction = {
  schemaVersion: 1;
  channel: string;
  episode: string;
  script: SourceState;
  storyboard: SourceState;
  scenes: SceneState[];
  assembly?: { videoSha256: string; inputsSha256: string };
  master?: { fileSha256: string; assemblyVideoSha256: string; inputsSha256: string;
    by: string; at: string };
};

const hashOk = (value: string): boolean => /^[a-f0-9]{64}$/.test(value);
const requireHash = (value: string, label: string): void => {
  if (!hashOk(value)) throw new Error(`Invalid SHA-256 for ${label}.`);
};
const requireReviewer = (by: string, at: string): void => {
  if (!by?.trim() || !at || !Number.isFinite(Date.parse(at)))
    throw new Error("A real human review identity and time are required.");
};
const block = (why: string): never => { throw new Error(why); };
const resetScenes = (scenes: readonly SceneState[]): SceneState[] =>
  scenes.map((scene) => ({ id: scene.id, sourceSha256: scene.sourceSha256, status: "queued" }));

export const createSceneFirstProduction = (args: {
  channel: string; episode: string; scriptSha256: string; storyboardSha256: string;
  scenes: { id: string; sourceSha256: string }[];
}): SceneFirstProduction => {
  if (!args.channel?.trim() || !args.episode?.trim() || !args.scenes.length)
    throw new Error("A channel, episode, and at least one scene are required.");
  requireHash(args.scriptSha256, "script");
  requireHash(args.storyboardSha256, "storyboard");
  const ids = new Set<string>();
  const scenes = args.scenes.map(({ id, sourceSha256 }) => {
    if (!id?.trim() || ids.has(id)) throw new Error("Scene ids must be unique and non-empty.");
    ids.add(id);
    requireHash(sourceSha256, `scene ${id}`);
    return { id, sourceSha256, status: "queued" as const };
  });
  return { schemaVersion: 1, channel: args.channel, episode: args.episode,
    script: { sha256: args.scriptSha256 },
    storyboard: { sha256: args.storyboardSha256 }, scenes };
};

export const changeScript = (p: SceneFirstProduction, sha256: string): SceneFirstProduction => {
  requireHash(sha256, "script");
  if (p.script.sha256 === sha256) return p;
  return { ...p, script: { sha256 }, storyboard: { sha256: p.storyboard.sha256 },
    scenes: resetScenes(p.scenes), assembly: undefined, master: undefined };
};

export const approveScript = (p: SceneFirstProduction, by: string, at: string, sha256: string): SceneFirstProduction => {
  requireReviewer(by, at); requireHash(sha256, "script approval");
  if (sha256 !== p.script.sha256) return block("The script changed before approval.");
  if (p.script.approval) return block("Script already approved; edit explicitly to reopen.");
  return { ...p, script: { ...p.script, approval: { by, at, sha256 } } };
};

export const changeStoryboard = (p: SceneFirstProduction, sha256: string): SceneFirstProduction => {
  requireHash(sha256, "storyboard");
  if (p.storyboard.sha256 === sha256) return p;
  return { ...p, storyboard: { sha256 }, scenes: resetScenes(p.scenes),
    assembly: undefined, master: undefined };
};

export const approveStoryboard = (p: SceneFirstProduction, by: string, at: string, sha256: string): SceneFirstProduction => {
  requireReviewer(by, at); requireHash(sha256, "storyboard approval");
  if (!p.script.approval || p.script.approval.sha256 !== p.script.sha256)
    return block("Approve the current script first.");
  if (sha256 !== p.storyboard.sha256) return block("The storyboard changed before approval.");
  if (p.storyboard.approval) return block("Storyboard already approved; edit explicitly to reopen.");
  return { ...p, storyboard: { ...p.storyboard, approval: { by, at, sha256 } } };
};

const sceneIndex = (p: SceneFirstProduction, sceneId: string): number => {
  const index = p.scenes.findIndex((s) => s.id === sceneId);
  if (index < 0) return block("Unknown scene.");
  return index;
};
const canWorkOn = (p: SceneFirstProduction, index: number): void => {
  if (!p.script.approval || p.script.approval.sha256 !== p.script.sha256 ||
      !p.storyboard.approval || p.storyboard.approval.sha256 !== p.storyboard.sha256)
    return block("Script and storyboard must be approved first.");
  if (p.scenes.slice(0, index).some((s) => s.status !== "approved"))
    return block("Approve the previous scene, with its sound and video, first.");
};
const replaceScene = (p: SceneFirstProduction, index: number, scene: SceneState): SceneFirstProduction => ({
  ...p, scenes: p.scenes.map((s, i) => i === index ? scene : s),
  assembly: undefined, master: undefined,
});

export const reviseSceneInput = (p: SceneFirstProduction, sceneId: string, sha256: string): SceneFirstProduction => {
  requireHash(sha256, "scene input");
  const i = sceneIndex(p, sceneId), s = p.scenes[i]!;
  if (sha256 === s.sourceSha256) return p;
  // Only this scene is re-opened. Other approved scenes stay approved.
  // Assembly and Master always become stale after any changed scene.
  return replaceScene(p, i, { id: sceneId, sourceSha256: sha256, status: "needs_revision" });
};

export const submitSceneAvPreview = (p: SceneFirstProduction, sceneId: string, sourceSha256: string,
  previewSha256: string): SceneFirstProduction => {
  requireHash(previewSha256, "scene AV preview");
  const i = sceneIndex(p, sceneId);
  canWorkOn(p, i);
  const s = p.scenes[i]!;
  if (sourceSha256 !== s.sourceSha256)
    return block("The submitted sound/visual input differs from the current scene.");
  return replaceScene(p, i, { id: s.id, sourceSha256, status: "in_review", previewSha256 });
};

export const approveSceneAv = (p: SceneFirstProduction, sceneId: string,
  review: { by: string; at: string; previewSha256: string; watchedWithAudio: true }): SceneFirstProduction => {
  requireReviewer(review.by, review.at);
  requireHash(review.previewSha256, "approved AV preview");
  if (review.watchedWithAudio !== true) return block("Review the scene with its audio and picture.");
  const i = sceneIndex(p, sceneId);
  canWorkOn(p, i);
  const s = p.scenes[i]!;
  if (s.status !== "in_review" || s.previewSha256 !== review.previewSha256)
    return block("Review the latest rendered audiovisual preview before approving.");
  return replaceScene(p, i, { ...s, status: "approved",
    approval: { by: review.by, at: review.at, previewSha256: review.previewSha256,
      sourceSha256: s.sourceSha256 } });
};

export const nextSceneId = (p: SceneFirstProduction): string | null =>
  p.scenes.find((s) => s.status !== "approved")?.id ?? null;

export const approvedSceneInputsSha256 = (p: SceneFirstProduction): string => {
  if (nextSceneId(p)) return block("All audiovisual scenes must be reviewed and approved.");
  const payload = [p.channel, p.episode, p.script.sha256, p.storyboard.sha256,
    ...p.scenes.map((s) => [s.id, s.sourceSha256, s.previewSha256,
      s.approval?.at, s.approval?.by])];
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
};

export const submitAssembly = (p: SceneFirstProduction, videoSha256: string): SceneFirstProduction => {
  requireHash(videoSha256, "assembled episode");
  const inputsSha256 = approvedSceneInputsSha256(p);
  return { ...p, assembly: { videoSha256, inputsSha256 }, master: undefined };
};

export const approveFinalMaster = (p: SceneFirstProduction, opts: {
  by: string; at: string; masterSha256: string;
  assembledVideoSha256: string; watchedFullEpisodeAt1x: true;
}): SceneFirstProduction => {
  requireReviewer(opts.by, opts.at);
  requireHash(opts.masterSha256, "Master");
  if (opts.watchedFullEpisodeAt1x !== true)
    return block("The full merged episode must be watched at normal speed.");
  const inputsSha256 = approvedSceneInputsSha256(p);
  if (!p.assembly || p.assembly.inputsSha256 !== inputsSha256 ||
      p.assembly.videoSha256 !== opts.assembledVideoSha256)
    return block("A current assembly of all approved scenes must be reviewed.");
  return { ...p, master: { fileSha256: opts.masterSha256,
    assemblyVideoSha256: p.assembly.videoSha256, inputsSha256,
    by: opts.by, at: opts.at } };
};

export const assertExactMasterReadyForPublish = (p: SceneFirstProduction, actualSha256: string): void => {
  requireHash(actualSha256, "actual Master bytes");
  if (!p.master || !p.assembly || p.master.fileSha256 !== actualSha256 ||
      p.master.assemblyVideoSha256 !== p.assembly.videoSha256 ||
      p.master.inputsSha256 !== approvedSceneInputsSha256(p))
    return block("Publishing is blocked: the exact current Master is not approved.");
};

export const sceneFirstProgress = (p: SceneFirstProduction) => ({
  currentScene: nextSceneId(p),
  approvedScenes: p.scenes.filter((s) => s.status === "approved").length,
  totalScenes: p.scenes.length,
  canAssemble: p.scenes.length > 0 && nextSceneId(p) === null,
  masterApproved: Boolean(p.master && p.assembly &&
    p.master.inputsSha256 === p.assembly.inputsSha256),
});
