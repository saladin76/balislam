/**
 * Studio V2 Phase C — trusted, server-only scene approval orchestration.
 *
 * No web route is activated here. The *host* must inject real authenticated
 * owner sessions, trusted manifest building, actual script/Storyboard gates,
 * audiovisual-review evidence and the SAME lock used by all artifact writers.
 *
 * Every approval is bound to current on-disk voice + composited video bytes.
 * Browser commands may not supply actor, video hashes, filesystem paths or
 * validation booleans. Rendering/publishing remains disabled until integration.
 */
import {
  appendSceneNote, approveSceneAv, assemblySceneFingerprint, assertCanProduceScene,
  beginFinalSceneProduction, markScenePrepared, reconcileSceneInputs,
  requestSceneChanges, sceneFingerprint, submitSceneAvReview,
  type SceneInputs, type SceneLedgerV2,
} from "./sceneV2.ts";
import { readSceneLedgerV2, mutateSceneLedgerV2 } from "./sceneStoreV2.ts";
import type { WorkflowIdentity } from "./store.ts";
import { probeSceneAvLockedV2 } from "./sceneMediaV2.ts";
import {
  collectSceneInputsFromDiskV2, type SceneFileManifestV2,
  type SceneArtifactLockV2,
} from "./sceneArtifactsV2.ts";

export type SceneV2Principal = {
  id: string; role: "owner" | "reviewer"; authenticated: true;
};
export type SceneV2ClientDecision = {
  action: "prepare" | "begin" | "submit" | "approve" | "request_changes" | "note";
  sceneId: string;
  /** Mandatory on submit/approve; taken from read-only inspection of current video. */
  expectedFingerprint?: string;
  /** Required only for a change request, not an approval. */
  note?: string;
  second?: number;
  elementId?: string;
};
export type TrustedSceneV2Dependencies = {
  scope: WorkflowIdentity;
  authenticate: () => Promise<SceneV2Principal>;
  sceneOrder: () => Promise<readonly string[]>;
  currentSceneManifest: (sceneId: string) => Promise<SceneFileManifestV2>;
  assertLockedScriptAndStoryboard: (sceneId: string) => Promise<void>;
  /** Must independently check actual playable AV scene, rights, review receipts
   * and the owner's explicit completed audiovisual viewing (not a UI boolean). */
  verifyCurrentSceneAvReview: (proof: Readonly<{
    sceneId: string; ownerId: string; fingerprint: string; avSha256: string;
  }>) => Promise<void>;
  withArtifactLock: SceneArtifactLockV2;
  /** Trusted server-configured ffprobe binary, never from HTTP request. */
  ffprobeBinary: string;
};

const ALLOWED = ["prepare", "begin", "submit", "approve", "request_changes", "note"] as const;
const sha = /^[a-f0-9]{64}$/;
const validate = (input: SceneV2ClientDecision): SceneV2ClientDecision => {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some((key) =>
        !["action", "sceneId", "expectedFingerprint", "note", "second", "elementId"].includes(key)) ||
      !ALLOWED.includes(input.action) ||
      typeof input.sceneId !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.sceneId) ||
      (input.action === "submit" || input.action === "approve") &&
        !sha.test(input.expectedFingerprint ?? "") ||
      (input.expectedFingerprint !== undefined && !sha.test(input.expectedFingerprint)) ||
      (input.note !== undefined &&
        (typeof input.note !== "string" || input.note.length > 2000)) ||
      (input.second !== undefined &&
        (typeof input.second !== "number" || !Number.isFinite(input.second) || input.second < 0)) ||
      (input.elementId !== undefined &&
        (typeof input.elementId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.elementId))))
    throw Error("Invalid scene decision; identity, artifact paths and evidence are server-only.");
  if ((input.action === "request_changes" || input.action === "note") && (!input.note || input.note.trim().length < 2))
    throw Error("A timestamped or element-specific correction requires a meaningful note.");
  return input;
};

export const createTrustedSceneV2Service = (deps: TrustedSceneV2Dependencies) => {
  if (!deps || typeof deps.withArtifactLock !== "function" ||
      typeof deps.authenticate !== "function" ||
      typeof deps.sceneOrder !== "function" ||
      typeof deps.currentSceneManifest !== "function" ||
      typeof deps.assertLockedScriptAndStoryboard !== "function" ||
      typeof deps.verifyCurrentSceneAvReview !== "function" ||
      typeof deps.ffprobeBinary !== "string" || !deps.ffprobeBinary)
    throw Error("Studio V2 requires all trusted session, artifact and AV review adapters.");

  const owner = async () => {
    const principal = await deps.authenticate();
    if (!principal || principal.authenticated !== true ||
        principal.role !== "owner" || typeof principal.id !== "string" ||
        !/^[\p{L}\p{N}_.@ -]{2,120}$/u.test(principal.id.trim()))
      throw Error("A current authenticated Studio owner session is required.");
    return principal.id;
  };
  const scopedOrder = async (): Promise<readonly string[]> => {
    const order = await deps.sceneOrder();
    if (!Array.isArray(order) || order.length === 0 ||
        order.length > 1000 || new Set(order).size !== order.length ||
        order.some((id) => typeof id !== "string" ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)))
      throw Error("Server scene order is invalid; no approval or render authorized.");
    return order;
  };
  const captureLocked = async (sceneId: string) => {
    const manifest = await deps.currentSceneManifest(sceneId);
    if (!manifest || manifest.sceneId !== sceneId)
      throw Error("Trusted scene manifest belongs to a different scene.");
    // Outer withArtifactLock is already held. The projector requires a lock
    // callback; this is the *already-locked* invocation, never a public API.
    const captured = await collectSceneInputsFromDiskV2(deps.scope, manifest, async (work) => work());
    return { ...captured, manifest };
  };
  const reconcileLocked = async (
    order: readonly string[], sceneId: string, latest: SceneInputs,
  ) => mutateSceneLedgerV2(deps.scope, order, (doc) =>
    reconcileSceneInputs(doc, sceneId, latest, new Date().toISOString()));

  /** Before relying on an existing signoff, re-hash its CURRENT actual files. */
  const refreshSignedLocked = async (order: readonly string[]) => {
    const initial = await readSceneLedgerV2(deps.scope, order);
    for (const id of order) {
      const status = initial.scenes[id]?.status;
      if (status === "approved" || status === "in_review") {
        const { inputs } = await captureLocked(id); // fail closed on missing bytes
        await reconcileLocked(order, id, inputs);
      }
    }
    return readSceneLedgerV2(deps.scope, order);
  };
  const ensureScene = (order: readonly string[], id: string) => {
    if (!order.includes(id)) throw Error("Unknown scene in server-locked Storyboard order.");
  };
  const prepare = async (raw: SceneV2ClientDecision) => {
    const input = validate(raw);
    return deps.withArtifactLock(async () => {
      const ownerId = await owner();
      const order = await scopedOrder();
      ensureScene(order, input.sceneId);
      await refreshSignedLocked(order);
      if (input.action === "prepare") {
        await mutateSceneLedgerV2(deps.scope, order, (doc) =>
          markScenePrepared(doc, input.sceneId, new Date().toISOString()));
      } else if (input.action === "begin") {
        // Explicitly verify the locked original script and Storyboard first.
        await deps.assertLockedScriptAndStoryboard(input.sceneId);
        await mutateSceneLedgerV2(deps.scope, order, (doc) =>
          beginFinalSceneProduction(doc, input.sceneId, new Date().toISOString(), () => {
            // Verified by the trusted asynchronous adapter immediately above,
            // under the SAME shared artifact lock.
          }));
      } else if (input.action === "note") {
        // Signed durable note, without changing approval status or claiming AV review.
        await mutateSceneLedgerV2(deps.scope, order, (doc) =>
          appendSceneNote(doc, input.sceneId, {
            text: input.note!, second: input.second, elementId: input.elementId,
          }, new Date().toISOString()));
      } else if (input.action === "request_changes") {
        await mutateSceneLedgerV2(deps.scope, order, (doc) =>
          requestSceneChanges(doc, input.sceneId, {
            text: input.note!, at: new Date().toISOString(),
            second: input.second, elementId: input.elementId,
          }));
      } else {
        // Both submission and approval must inspect the *current* composed AV
        // file. A stale client fingerprint cannot approve newer bytes.
        const { inputs, fingerprint, manifest } = await captureLocked(input.sceneId);
        await reconcileLocked(order, input.sceneId, inputs);
        if (fingerprint !== input.expectedFingerprint)
          throw Error("Scene AV changed since it was shown; refresh before deciding.");
        if (input.action === "submit") {
          // A filename and hash are not proof of a playable AV stream.
          // Probe under the SAME server writer lock before presenting a scene.
          const probed = await probeSceneAvLockedV2(deps.scope, manifest,
            { ffprobeBinary: deps.ffprobeBinary });
          if (probed.sha256 !== inputs.video.sha256 ||
              probed.epoch !== inputs.video.epoch)
            throw Error("Scene MP4 changed between hashing and stream validation.");
          await mutateSceneLedgerV2(deps.scope, order, (doc) =>
            submitSceneAvReview(doc, input.sceneId, new Date().toISOString()));
        } else {
          const current = await readSceneLedgerV2(deps.scope, order);
          assertCanProduceScene(current, input.sceneId);
          if (current.scenes[input.sceneId]?.status !== "in_review" ||
              current.scenes[input.sceneId]?.submittedFingerprint !== fingerprint)
            throw Error("A current audiovisual review submission is required.");
          await deps.verifyCurrentSceneAvReview({
            sceneId: input.sceneId, ownerId, fingerprint,
            avSha256: inputs.video.sha256,
          });
          // Check bytes again AFTER the independent, asynchronous review
          // validator; the shared editor lock prevents conforming writers.
          const checked = await captureLocked(input.sceneId);
          if (checked.fingerprint !== fingerprint ||
              checked.inputs.video.sha256 !== inputs.video.sha256 ||
              checked.inputs.video.epoch !== inputs.video.epoch)
            throw Error("Scene video or audio changed during owner AV review.");
          const probed = await probeSceneAvLockedV2(deps.scope, checked.manifest,
            { ffprobeBinary: deps.ffprobeBinary });
          if (probed.sha256 !== checked.inputs.video.sha256 ||
              probed.epoch !== checked.inputs.video.epoch)
            throw Error("Scene media changed during final AV validation.");
          await mutateSceneLedgerV2(deps.scope, order, (doc) =>
            approveSceneAv(doc, input.sceneId, {
              ownerId, expectedFingerprint: fingerprint,
              reviewedAvSha256: checked.inputs.video.sha256,
              at: new Date().toISOString(),
            }, () => {
              // The evidence callback was independently awaited under the
              // shared artifact lock. Never pass a client-side boolean here.
            }));
        }
      }
      return { sceneId: input.sceneId, action: input.action };
    });
  };
  const inspect = async () => deps.withArtifactLock(async () => {
    await owner();
    const order = await scopedOrder();
    await refreshSignedLocked(order);
    // A producing scene may be missing video until render completes.
    const before = await readSceneLedgerV2(deps.scope, order);
    for (const id of order) {
      if (before.scenes[id]?.status !== "producing") continue;
      try {
        const latest = await captureLocked(id);
        await reconcileLocked(order, id, latest.inputs);
      } catch {
        // No approval or live fingerprint will be issued without complete AV.
      }
    }
    const doc = await readSceneLedgerV2(deps.scope, order);
    return {
      channel: doc.channel, episode: doc.episode, revision: doc.revision,
      scenes: order.map((id) => {
        const scene = doc.scenes[id]!;
        let fingerprint: string | undefined;
        try { if (scene.inputs) fingerprint = sceneFingerprint(id, scene.inputs); }
        catch { /* no current complete AV to expose */ }
        return {
          id, status: scene.status, fingerprint,
          approvedAt: scene.status === "approved" ? scene.approval?.at : undefined,
          notes: scene.notes.map((n) => ({
            text: n.text, at: n.at, second: n.second, elementId: n.elementId,
          })),
        };
      }),
    };
  });
  /**
   * Eligibility only: actual assembler must call under the same lock, then
   * additionally validate full-episode 1x review and exact Master separately.
   */
  const assemblyEligibility = async () => deps.withArtifactLock(async () => {
    await owner();
    const order = await scopedOrder();
    const doc = await refreshSignedLocked(order);
    return { sceneAssemblyFingerprint: assemblySceneFingerprint(doc) };
  });
  return { inspect, command: prepare, assemblyEligibility };
};
