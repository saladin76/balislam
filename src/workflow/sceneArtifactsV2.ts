/**
 * Studio V2 Phase B: derive EACH scene fingerprint from current on-disk files.
 *
 * Trusted server code only. Manifest entries are authored by server policy,
 * NEVER parsed from browser JSON. The artifact lock MUST be the SAME lock used
 * by script, media, render and publishing writers; no concurrent modification
 * may slip between digest collection and an authorized operation.
 *
 * This is a *read-only input projector*. It does not approve anything, render
 * a scene, or publish any output.
 */
import { createHash } from "node:crypto";
import { resolveArtifact, sha256FileAndEpoch } from "./artifacts.ts";
import { STUDIO_CHANNELS, type WorkflowIdentity } from "./store.ts";
import {
  SCENE_INPUT_KEYS, sceneFingerprint,
  type SceneArtifact, type SceneInputKey, type SceneInputs,
} from "./sceneV2.ts";

export type SceneFileSetV2 = {
  /** A version assigned by the trusted Studio production manifest. */
  version: string;
  /** Paths relative to current episode or explicitly allowed channel-images. */
  files: readonly string[];
};

export type SceneFileManifestV2 = {
  sceneId: string;
  inputs: Record<SceneInputKey, SceneFileSetV2>;
  /** Shared dependencies: only ones used by THIS scene, not the entire library. */
  shared: Readonly<Record<string, SceneFileSetV2>>;
};

export type SceneArtifactLockV2 = <T>(job: () => Promise<T>) => Promise<T>;

const contentHash = (items: unknown): string =>
  createHash("sha256").update(JSON.stringify(items)).digest("hex");

const safeNames = (set: SceneFileSetV2, description: string): string[] => {
  if (!set || typeof set.version !== "string" || !set.version.trim() ||
      set.version.length > 200 || !Array.isArray(set.files) ||
      set.files.length < 1 || set.files.length > 1024)
    throw Error("Missing scene file manifest: " + description);
  const names = [...set.files].sort();
  if (new Set(names).size !== names.length ||
      names.some((name) =>
        typeof name !== "string" || !name || name.length > 1023 ||
        name.startsWith("/") || name.includes("\\") ||
        name.split("/").some((part) => !part || part === "." || part === ".." ||
          part.startsWith(".") || part === "scene-workflow.v2.json" ||
          part === "workflow-approvals.json" || part.endsWith(".lock"))))
    throw Error("Unsafe, duplicate or sensitive scene artifact path: " + description);
  return names;
};

const digestFileSet = async (
  scope: WorkflowIdentity, sceneId: string, key: string, set: SceneFileSetV2,
): Promise<SceneArtifact> => {
  const names = safeNames(set, key);
  const observed: Array<[string, string, string]> = [];
  for (const name of names) {
    const file = await resolveArtifact(scope, name);
    const { sha256, epoch } = await sha256FileAndEpoch(file);
    observed.push([name, sha256, epoch]);
  }
  const seed = ["studio-scene-files-v2", scope.channel, scope.episode, sceneId, key, set.version];
  return {
    version: set.version,
    sha256: contentHash([seed, observed.map(([name, sha256]) => [name, sha256])]),
    epoch: contentHash([seed, observed.map(([name, , epoch]) => [name, epoch])]),
  };
};

/** The preview/video component MUST use the exact composited MP4 bytes. */
const digestExactSceneVideo = async (
  scope: WorkflowIdentity, set: SceneFileSetV2,
): Promise<SceneArtifact> => {
  const files = safeNames(set, "video");
  if (files.length !== 1 || !/\.mp4$/i.test(files[0]!) ||
      files[0]!.startsWith("channel-images/"))
    throw Error("Scene AV review requires exactly one episode-owned MP4 file.");
  const file = await resolveArtifact(scope, files[0]!);
  const { sha256, epoch } = await sha256FileAndEpoch(file);
  return { version: set.version, sha256, epoch };
};

/**
 * Current real-file input projection; to be called under a trusted shared
 * artifact lock. The returned fingerprints are NOT human review evidence.
 */
export const collectSceneInputsFromDiskV2 = async (
  scope: WorkflowIdentity,
  manifest: SceneFileManifestV2,
  withArtifactLock: SceneArtifactLockV2,
): Promise<{ inputs: SceneInputs; fingerprint: string }> => {
  if (typeof withArtifactLock !== "function")
    throw Error("Trusted shared artifact lock is required.");
  if (!STUDIO_CHANNELS.includes(scope.channel) || !manifest ||
      typeof manifest.sceneId !== "string" || !manifest.inputs ||
      typeof manifest.inputs !== "object" || !manifest.shared ||
      typeof manifest.shared !== "object" || Array.isArray(manifest.shared))
    throw Error("Invalid server scene source manifest.");

  // Reject missing/extra categories rather than treating absent video as silence.
  const keys = Object.keys(manifest.inputs).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...SCENE_INPUT_KEYS].sort()))
    throw Error("Every scene input must be explicitly versioned by the server.");
  if (!safeNames(manifest.inputs.original, "original").includes("script.md"))
    throw Error("Original scene source MUST include the locked script.md file.");
  const audio = safeNames(manifest.inputs.narration, "narration");
  if (!audio.some((filename) => /\.(mp3|wav|m4a)$/i.test(filename)))
    throw Error("A scene AV video must be bound to real narration or human-recited audio.");

  // No manifest may list an approval ledger as evidence of its own approval.
  return withArtifactLock(async () => {
    const inputs = {} as SceneInputs;
    for (const key of SCENE_INPUT_KEYS) {
      inputs[key] = key === "video"
        ? await digestExactSceneVideo(scope, manifest.inputs.video)
        : await digestFileSet(scope, manifest.sceneId, key, manifest.inputs[key]);
    }
    const shared: Record<string, SceneArtifact> = {};
    const labels = Object.keys(manifest.shared).sort();
    if (labels.length > 1000) throw Error("Too many scene shared dependencies.");
    for (const label of labels) {
      if (!/^[a-z0-9][a-z0-9_.:/-]{0,199}$/.test(label) ||
          label.split("/").some((part) => !part || part === "." || part === ".."))
        throw Error("Invalid shared scene dependency identifier.");
      shared[label] = await digestFileSet(scope, manifest.sceneId,
        "shared:" + label, manifest.shared[label]!);
    }
    inputs.shared = shared;
    return { inputs, fingerprint: sceneFingerprint(manifest.sceneId, inputs) };
  });
};
