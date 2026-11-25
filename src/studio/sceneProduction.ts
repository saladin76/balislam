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
  approval?: { by: string; at: string; previewSha256: string; sourceSha256: string;
    /**
     * «اعتماد مشروط بالتلاوة» (owner decision, 8 Nov): the verse scene's picture and narration were
     * approved while its human recitation was not yet attached (a silent placeholder in the draft).
     * It counts as this scene's decision (scenes are decided in any order, D145) but never as a final approval:
     * assembly, Master and publish stay blocked until the recitation is attached, which changes the
     * scene's inputs, re-opens only this scene and requires a fresh, unconditional approval.
     */
    recitationPending?: true };
};
export type SceneFirstProduction = {
  schemaVersion: 1;
  channel: string;
  episode: string;
  script: SourceState;
  storyboard: SourceState;
  scenes: SceneState[];
  assembly?: { videoSha256: string; inputsSha256: string;
    /** Separate human decision: full 1× viewing and every scene-to-scene seam checked. */
    approval?: { by: string; at: string; videoSha256: string; seams: string[] } };
  master?: { fileSha256: string; assemblyVideoSha256: string; inputsSha256: string;
    by: string; at: string;
    /** Separate, explicit permission to publish these exact Master bytes. */
    publish?: { by: string; at: string; fileSha256: string } };
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

/**
 * Scoped invalidation (plan task 2): a script edit re-opens the script and storyboard decisions,
 * the assembly and the Master. Scene AV approvals stay valid unless that scene's own inputs changed;
 * the caller re-opens exactly those scenes with reviseSceneInput.
 */
export const changeScript = (p: SceneFirstProduction, sha256: string): SceneFirstProduction => {
  requireHash(sha256, "script");
  if (p.script.sha256 === sha256) return p;
  return { ...p, script: { sha256 }, storyboard: { sha256: p.storyboard.sha256 },
    assembly: undefined, master: undefined };
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
  return { ...p, storyboard: { sha256 }, assembly: undefined, master: undefined };
};

export const approveStoryboard = (p: SceneFirstProduction, by: string, at: string, sha256: string): SceneFirstProduction => {
  requireReviewer(by, at); requireHash(sha256, "storyboard approval");
  if (!p.script.approval || p.script.approval.sha256 !== p.script.sha256)
    return block("Approve the current script first.");
  if (sha256 !== p.storyboard.sha256) return block("The storyboard changed before approval.");
  if (p.storyboard.approval) return block("Storyboard already approved; edit explicitly to reopen.");
  return { ...p, storyboard: { ...p.storyboard, approval: { by, at, sha256 } } };
};

const validSceneApproval = (s: SceneState): boolean =>
  s.status === "approved" && Boolean(s.approval && s.previewSha256 &&
    s.approval.previewSha256 === s.previewSha256 &&
    s.approval.sourceSha256 === s.sourceSha256 &&
    s.approval.by.trim() && Number.isFinite(Date.parse(s.approval.at)));

/** A valid approval that is final (not waiting for a recitation). Only these unlock assembly/Master. */
const finalSceneApproval = (s: SceneState): boolean =>
  validSceneApproval(s) && s.approval?.recitationPending !== true;

/** Verse scenes approved on condition of their recitation, in episode order. */
export const recitationPendingScenes = (p: SceneFirstProduction): string[] =>
  p.scenes.filter((s) => validSceneApproval(s) && !finalSceneApproval(s)).map((s) => s.id);

const sceneIndex = (p: SceneFirstProduction, sceneId: string): number => {
  const index = p.scenes.findIndex((s) => s.id === sceneId);
  if (index < 0) return block("Unknown scene.");
  return index;
};
/**
 * Owner decision 15 Nov 2026 (D145, supersedes the sequential part of D24/D31/D40): every scene is its own unit and is
 * produced, reviewed, approved or sent back in ANY order, whatever the state of the scenes before it. What stays:
 * «اعتمد التجهيز» first, and the assembly (then Master, then publish) only once EVERY scene has a final approval.
 */
const canWorkOn = (p: SceneFirstProduction, _index: number): void => {
  if (!p.script.approval || p.script.approval.sha256 !== p.script.sha256 ||
      !p.storyboard.approval || p.storyboard.approval.sha256 !== p.storyboard.sha256)
    return block("Script and storyboard must be approved first.");
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
  // A scene never submitted (queued) has nothing to revise: it stays queued with its new inputs, so the
  // owner never sees «بانتظار التعديل» on a scene nobody asked to fix (funnel audit item 10). Submitted,
  // approved or already-corrected scenes are re-opened as needs_revision, exactly as before.
  return replaceScene(p, i, { id: sceneId, sourceSha256: sha256,
    status: s.status === "queued" ? "queued" : "needs_revision" });
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
  review: { by: string; at: string; previewSha256: string; watchedWithAudio: true;
    /** Set by the trusted server when this verse scene has no attached, reviewed recitation yet. */
    recitationPending?: boolean }): SceneFirstProduction => {
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
      sourceSha256: s.sourceSha256, ...(review.recitationPending === true ? { recitationPending: true as const } : {}) } });
};

export const requestSceneCorrection = (p: SceneFirstProduction, sceneId: string): SceneFirstProduction => {
  const i = sceneIndex(p, sceneId);
  canWorkOn(p, i);
  const scene = p.scenes[i]!;
  if (scene.status !== "in_review") return block("Only a submitted AV scene can be returned for correction.");
  return replaceScene(p, i, { id: scene.id, sourceSha256: scene.sourceSha256,
    status: "needs_revision" });
};

/** The first scene, in episode order, without an approval (a starting point only; scenes are decided in any order). */
export const nextSceneId = (p: SceneFirstProduction): string | null =>
  p.scenes.find((s) => !validSceneApproval(s))?.id ?? null;

/** Every scene without an approval, in episode order: what is left before the assembly (D145). */
export const unapprovedSceneIds = (p: SceneFirstProduction): string[] =>
  p.scenes.filter((s) => !validSceneApproval(s)).map((s) => s.id);

export const approvedSceneInputsSha256 = (p: SceneFirstProduction): string => {
  const left = unapprovedSceneIds(p);
  if (left.length || !p.script.approval || !p.storyboard.approval ||
      p.script.approval.sha256 !== p.script.sha256 ||
      p.storyboard.approval.sha256 !== p.storyboard.sha256)
    return block(left.length
      ? `All audiovisual scenes must be approved first; not approved yet: ${left.slice(0, 12).join(", ")}${left.length > 12 ? "…" : ""}.`
      : "All audiovisual scenes and upstream sources must be approved.");
  const waiting = recitationPendingScenes(p);
  if (waiting.length)
    return block(`Attach the human recitation and re-approve these verse scenes first: ${waiting.join(", ")}.`);
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

/** Every boundary between consecutive scenes, in order: "c1-s1>c1-s2". */
export const sceneSeams = (p: SceneFirstProduction): string[] =>
  p.scenes.slice(1).map((s, i) => `${p.scenes[i]!.id}>${s.id}`);

const assemblyApproved = (p: SceneFirstProduction): boolean => {
  const a = p.assembly;
  if (!a?.approval || a.approval.videoSha256 !== a.videoSha256) return false;
  const want = sceneSeams(p);
  return a.approval.seams.length === want.length && want.every((seam, i) => a.approval!.seams[i] === seam);
};

/**
 * Decision 1 of 3 after the scenes: the assembled cut was watched in full at 1× and every
 * scene-to-scene seam was checked. Independent of each scene's approval and of the Master.
 */
export const approveAssembly = (p: SceneFirstProduction, opts: {
  by: string; at: string; videoSha256: string; watchedFullEpisodeAt1x?: boolean; seamsChecked?: readonly string[];
}): SceneFirstProduction => {
  requireReviewer(opts.by, opts.at);
  requireHash(opts.videoSha256, "assembled episode");
  // D223 (قرار المالك ٢٥ نوفمبر): لا شرط مشاهدة ١× ولا تعليم كل وصلة؛ الاعتماد بضغطة واحدة على التجميع الحالي نفسه
  const inputsSha256 = approvedSceneInputsSha256(p);
  if (!p.assembly || p.assembly.inputsSha256 !== inputsSha256 || p.assembly.videoSha256 !== opts.videoSha256)
    return block("Review the current assembly of all approved scenes.");
  const want = sceneSeams(p);
  return { ...p, assembly: { ...p.assembly, approval: { by: opts.by, at: opts.at, videoSha256: opts.videoSha256, seams: want } },
    master: undefined };
};

/** Decision 2 of 3: the exact final Master bytes, watched in full, after an approved assembly. */
export const approveFinalMaster = (p: SceneFirstProduction, opts: {
  by: string; at: string; masterSha256: string;
  assembledVideoSha256: string; watchedFullEpisodeAt1x?: boolean;
}): SceneFirstProduction => {
  requireReviewer(opts.by, opts.at);
  requireHash(opts.masterSha256, "Master");
  // D223: اعتماد النسخة النهائية بضغطة واحدة بلا تتبع للمشاهدة
  const inputsSha256 = approvedSceneInputsSha256(p);
  if (!p.assembly || p.assembly.inputsSha256 !== inputsSha256 ||
      p.assembly.videoSha256 !== opts.assembledVideoSha256)
    return block("A current assembly of all approved scenes must be reviewed.");
  if (!assemblyApproved(p))
    return block("Approve the assembled episode and its scene transitions before the Master.");
  return { ...p, master: { fileSha256: opts.masterSha256,
    assemblyVideoSha256: p.assembly.videoSha256, inputsSha256,
    by: opts.by, at: opts.at } };
};

/** Decision 3 of 3: explicit permission to publish these exact Master bytes. */
export const grantPublish = (p: SceneFirstProduction, opts: { by: string; at: string; masterSha256: string }): SceneFirstProduction => {
  requireReviewer(opts.by, opts.at);
  requireHash(opts.masterSha256, "Master");
  assertExactMasterApproved(p, opts.masterSha256);
  return { ...p, master: { ...p.master!, publish: { by: opts.by, at: opts.at, fileSha256: opts.masterSha256 } } };
};

/** The exact current Master is approved (enough to cut shorts from it; NOT enough to publish). */
export const assertExactMasterApproved = (p: SceneFirstProduction, actualSha256: string): void => {
  requireHash(actualSha256, "actual Master bytes");
  if (!p.master || !p.assembly || p.master.fileSha256 !== actualSha256 ||
      p.master.assemblyVideoSha256 !== p.assembly.videoSha256 ||
      p.master.inputsSha256 !== approvedSceneInputsSha256(p) || !assemblyApproved(p))
    return block("The exact current Master is not approved.");
};

export const assertExactMasterReadyForPublish = (p: SceneFirstProduction, actualSha256: string): void => {
  assertExactMasterApproved(p, actualSha256);
  if (p.master!.publish?.fileSha256 !== actualSha256)
    return block("Publishing is blocked: give explicit publish permission for this exact Master.");
};

export const sceneFirstProgress = (p: SceneFirstProduction) => ({
  /** The first scene without an approval (where step ٢ opens); any scene may be decided first (D145). */
  currentScene: nextSceneId(p),
  /** Every scene without an approval, in episode order: the assembly waits for all of them. */
  unapprovedScenes: unapprovedSceneIds(p),
  /** Approved scenes, any order (includes «مشروط بالتلاوة»); see recitationPending for the conditional ones. */
  approvedScenes: p.scenes.filter(validSceneApproval).length,
  totalScenes: p.scenes.length,
  /** Verse scenes approved on condition of their recitation: assembly/Master wait for them. */
  recitationPending: recitationPendingScenes(p),
  canAssemble: p.scenes.length > 0 && nextSceneId(p) === null && recitationPendingScenes(p).length === 0,
  assemblyApproved: assemblyApproved(p),
  masterApproved: Boolean(p.master && p.assembly &&
    p.master.inputsSha256 === p.assembly.inputsSha256),
  publishAllowed: Boolean(p.master?.publish && p.master.publish.fileSha256 === p.master.fileSha256),
});
