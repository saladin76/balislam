/**
 * Studio V2 Backend → Render trusted integration.
 *
 * renderSceneV2 is supplied by the Render-owned PR #86 module at runtime.
 * The backend branch intentionally does not modify or vendor Render files.
 * NO browser-provided request, manifest, actor, file path or approval is used.
 */
import { stat } from "node:fs/promises";
import path from "node:path";
import { readPlannedSceneOrderV2 } from "./scenePlanV2.ts";
import { requireApprovedSceneSourcesV2 } from "./sceneSourcesV2.ts";
import { readTrustedSceneRenderSpecLockedV2, type TrustedSceneRenderSpecV2 } from "./sceneRenderSpecV2.ts";
import { withSceneArtifactLockV2 } from "./sceneLockV2.ts";
import { withSceneProductionLeaseV2 } from "./sceneProductionLeaseV2.ts";
import { readSceneLedgerV2, mutateSceneLedgerV2 } from "./sceneStoreV2.ts";
import { assertCanProduceScene, isSceneApproved, reconcileSceneInputs } from "./sceneV2.ts";
import { collectSceneInputsFromDiskV2 } from "./sceneArtifactsV2.ts";
import { readRegisteredSceneManifestV2, registerRenderedSceneManifestLockedV2 } from "./sceneManifestRegistryV2.ts";
import { probeSceneAvLockedV2 } from "./sceneMediaV2.ts";
import { commitCurrentSceneRenderLockedV2 } from "./sceneRenderCommitV2.ts";
import { resolveArtifact, sha256FileAndEpoch } from "./artifacts.ts";
import type { WorkflowIdentity } from "./store.ts";

export type TrustedRendererV2 = (request: any, adapters: any) =>
  Promise<{ status: "succeeded" | "failed" | "cancelled"; [key: string]: any }>;
export type TrustedProductionDependenciesV2 = {
  renderer: TrustedRendererV2;
  ffprobeBinary: string;
  browserExecutable?: string;
  /** Actual current script/citations/Storyboard visual validation, not client flags. */
  verifySourceReview: () => Promise<void>;
  /** Independently verify owner-upload Quran provenance and rights. */
  verifyRecitationProvenance?: (record: {
    origin: "owner-upload"; sha256: string; recordId: string;
  }) => Promise<void>;
  signal?: AbortSignal;
};
type Proof = { sha256: string; epoch: string };
const resultHash = /^[a-f0-9]{64}$/;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const assetFiles = (spec: TrustedSceneRenderSpecV2) => [
  ...Object.values(spec.manifest.inputs).flatMap((set) => set.files),
  ...Object.values(spec.manifest.shared).flatMap((set) => set.files),
  ...spec.sounds.map((s) => s.file),
  ...spec.pictures.map((p) => p.file),
];
const episodeFileSnapshot = async (scope: WorkflowIdentity, spec: TrustedSceneRenderSpecV2) => {
  const result: Record<string, Proof> = {};
  for (const relative of [...new Set([...assetFiles(spec), "plan.json"])]) {
    // The future MP4 is deliberately not part of the pre-render manifest.
    const filename = await resolveArtifact(scope, relative);
    result[relative] = await sha256FileAndEpoch(filename);
  }
  for (const item of [...spec.sounds, ...spec.pictures]) {
    if (result[item.file]?.sha256 !== item.sha256)
      throw Error("Scene input bytes disagree with trusted render spec.");
  }
  return result;
};
const refreshPredecessorsLocked = async (scope: WorkflowIdentity, order: readonly string[],
  target: string) => {
  for (const id of order.slice(0, order.indexOf(target))) {
    const manifest = await readRegisteredSceneManifestV2(scope, id);
    const captured = await collectSceneInputsFromDiskV2(scope, manifest, async (work) => work());
    await mutateSceneLedgerV2(scope, order, (doc) =>
      reconcileSceneInputs(doc, id, captured.inputs, new Date().toISOString()));
  }
  const state = await readSceneLedgerV2(scope, order);
  assertCanProduceScene(state, target);
  for (const id of order.slice(0, order.indexOf(target)))
    if (!isSceneApproved(state, id))
      throw Error("Preceding scene AV approval is no longer current.");
  if (state.scenes[target]?.status !== "producing")
    throw Error("Current scene needs an explicit owner begin decision before rendering.");
};
/**
 * Single trusted final-render dispatcher. A crashed lease blocks a retry until
 * an owner inspects it; never auto-delete a foreign production lock.
 * The real Remotion renderer obtains lock/lease adapters and re-checks
 * all approved sources + scene order at BOTH its preflight and publication.
 */
export const runTrustedSceneProductionV2 = async (
  scope: WorkflowIdentity, sceneId: string, deps: TrustedProductionDependenciesV2,
) => {
  if (!/^c[1-9]\d*-[sv]\d+$/.test(sceneId) ||
      typeof deps?.renderer !== "function" ||
      typeof deps.verifySourceReview !== "function" ||
      !path.isAbsolute(deps.ffprobeBinary) ||
      (deps.browserExecutable !== undefined && !path.isAbsolute(deps.browserExecutable)))
    throw Error("STUDIO_V2_RENDER_UNAVAILABLE: renderer or trusted backend configuration missing.");
  const locked = <T>(work: () => Promise<T>) => withSceneArtifactLockV2(scope, work);
  return withSceneProductionLeaseV2(scope, sceneId, async () => {
    const preflight = await locked(async () => {
      await requireApprovedSceneSourcesV2(scope);
      await deps.verifySourceReview();
      const order = (await readPlannedSceneOrderV2(scope, async (work) => work())).sceneOrder;
      if (!order.includes(sceneId)) throw Error("Unknown render scene in locked episode.");
      await refreshPredecessorsLocked(scope, order, sceneId);
      const spec = await readTrustedSceneRenderSpecLockedV2(scope, sceneId);
      const observed = await episodeFileSnapshot(scope, spec);
      return { spec, observed, order };
    });
    if (preflight.spec.recitationEvidence) {
      if (!deps.verifyRecitationProvenance)
        throw Error("Human recitation provenance verifier not configured.");
      await deps.verifyRecitationProvenance(preflight.spec.recitationEvidence);
    }
    const assertLocked = async (r: any) => {
      await requireApprovedSceneSourcesV2(scope);
      await deps.verifySourceReview();
      const order = (await readPlannedSceneOrderV2(scope, async (work) => work())).sceneOrder;
      if (!same(order, preflight.order))
        throw Error("Scene order changed during trusted render.");
      await refreshPredecessorsLocked(scope, order, sceneId);
      const spec = await readTrustedSceneRenderSpecLockedV2(scope, sceneId);
      if (!same(spec, preflight.spec))
        throw Error("Trusted render spec changed before publication.");
      const latest = await episodeFileSnapshot(scope, spec);
      if (!same(latest, preflight.observed))
        throw Error("Source files changed even if their bytes were restored.");
      if (r?.channel !== scope.channel || r?.episode !== scope.episode ||
          r?.sceneId !== sceneId || r?.planSha256 !== latest["plan.json"]?.sha256)
        throw Error("Renderer is not using current server-owned plan.");
    };
    const dir = path.join(scope.channelsRoot, scope.channel, "episodes", scope.episode);
    const request = {
      channelsRoot: scope.channelsRoot, channel: scope.channel, episode: scope.episode,
      sceneId, planSha256: preflight.observed["plan.json"]!.sha256,
      mode: preflight.spec.manifest.audioMode,
      orientation: preflight.spec.orientation,
      width: preflight.spec.width, height: preflight.spec.height, fps: 30 as const,
      durationSec: preflight.spec.durationSec,
      sounds: preflight.spec.sounds.map((s) => ({ ...s, file: path.join(dir, s.file) })),
      pictures: preflight.spec.pictures.map((p) => ({ ...p, file: path.join(dir, p.file) })),
      ...(preflight.spec.recitationEvidence
        ? { recitationEvidence: preflight.spec.recitationEvidence } : {}),
    };
    // The outer lease is held through registration. No nested production lease.
    const outcome = await deps.renderer(request, {
      ffprobeBinary: deps.ffprobeBinary, browserExecutable: deps.browserExecutable,
      signal: deps.signal,
      withProductionLease: async (id: string, work: () => Promise<unknown>) => {
        if (id !== sceneId) throw Error("Wrong production lease scene.");
        return work();
      },
      withArtifactLock: locked,
      assertCanRender: assertLocked,
    });
    if (outcome?.status !== "succeeded")
      throw Error(outcome?.status === "cancelled" ? "V2_RENDER_CANCELLED" : "V2_RENDER_FAILED");
    return locked(async () => {
      await assertLocked(request);
      if (outcome.sceneId !== sceneId || outcome.planSha256 !== request.planSha256 ||
          !resultHash.test(outcome.sha256) || typeof outcome.jobId !== "string" ||
          !/^[a-f0-9-]{36}$/.test(outcome.jobId) ||
          typeof outcome.relativeFile !== "string" ||
          !new RegExp("^previews/" + sceneId + "-" + request.planSha256.slice(0, 12) +
            "-[a-f0-9-]{36}\\.mp4$").test(outcome.relativeFile) ||
          outcome.reviewStatus !== "not_submitted")
        throw Error("Untrusted Render output identity or review status.");
      const output = await resolveArtifact(scope, outcome.relativeFile);
      if (outcome.file !== output) throw Error("Render returned a foreign output path.");
      const bytes = (await stat(output)).size;
      const actual = await sha256FileAndEpoch(output);
      if (actual.sha256 !== outcome.sha256 || bytes !== outcome.bytes)
        throw Error("Rendered MP4 bytes changed before signed registration.");
      const manifest = structuredClone(preflight.spec.manifest);
      manifest.inputs.video = { version: outcome.jobId, files: [outcome.relativeFile] };
      await registerRenderedSceneManifestLockedV2(scope, manifest);
      const captured = await collectSceneInputsFromDiskV2(scope, manifest,
        async (work) => work());
      const media = await probeSceneAvLockedV2(scope, manifest,
        { ffprobeBinary: deps.ffprobeBinary });
      if (media.sha256 !== actual.sha256 || media.epoch !== actual.epoch ||
          captured.inputs.video.sha256 !== actual.sha256 ||
          captured.inputs.video.epoch !== actual.epoch)
        throw Error("Independent MP4 stream verification failed after registration.");
      await commitCurrentSceneRenderLockedV2(scope, sceneId, preflight.order,
        outcome.jobId, captured.fingerprint, actual.sha256, actual.epoch);
      // No submission or owner AV approval is granted here.
      return { sceneId, status: "rendered" as const,
        fingerprint: captured.fingerprint,
        video: { version: outcome.jobId, sha256: actual.sha256, epoch: actual.epoch,
          width: media.width, height: media.height, durationSec: media.durationSec,
          hasAudio: media.hasAudio } };
    });
  });
};
