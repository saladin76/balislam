/**
 * Trusted Render -> Backend handoff for each scene. Never expose registration
 * to HTTP: only a server-side producer, while holding the shared artifact
 * mutex, can sign a manifest. Existing previews never become V2 outputs.
 */
import path from "node:path";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises";
import { workflowSigningKey, workflowKeyId } from "./trust.ts";
import { sceneV2FileFor, type SceneV2Scope } from "./sceneStoreV2.ts";
import { readPlannedSceneOrderV2 } from "./scenePlanV2.ts";
import { SCENE_INPUT_KEYS } from "./sceneV2.ts";
import type { SceneFileManifestV2, SceneArtifactLockV2 } from "./sceneArtifactsV2.ts";
import type { WorkflowIdentity } from "./store.ts";

type Registry = {
  schemaVersion: 1; channel: string; episode: string; sceneId: string;
  manifest: SceneFileManifestV2;
  integrity: { alg: "HMAC-SHA256"; keyId: string; mac: string };
};
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const payload = (r: Omit<Registry, "integrity">) =>
  JSON.stringify([1, r.channel, r.episode, r.sceneId, r.manifest]);
const mac = (r: Omit<Registry, "integrity">) =>
  createHmac("sha256", workflowSigningKey()).update(payload(r)).digest("hex");

const registryDir = async (scope: SceneV2Scope) => {
  const parent = path.dirname(await sceneV2FileFor(scope));
  const dir = path.join(parent, ".studio-v2-manifests");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const st = await lstat(dir);
  if (!st.isDirectory() || st.isSymbolicLink() || await realpath(dir) !== dir)
    throw Error("Unsafe scene manifest registry directory.");
  return dir;
};
const registryFile = async (scope: SceneV2Scope, sceneId: string) => {
  if (!idPattern.test(sceneId) || sceneId.length > 80)
    throw Error("Invalid V2 scene manifest identifier.");
  return path.join(await registryDir(scope), sceneId + ".json");
};

const verifyPolicy = async (scope: WorkflowIdentity, manifest: SceneFileManifestV2) => {
  if (!manifest || typeof manifest.sceneId !== "string" ||
      !idPattern.test(manifest.sceneId) ||
      !manifest.inputs || typeof manifest.inputs !== "object" ||
      JSON.stringify(Object.keys(manifest.inputs).sort()) !==
        JSON.stringify([...SCENE_INPUT_KEYS].sort()) ||
      !manifest.inputs.original?.files?.includes("script.md") ||
      !manifest.inputs.storyboard?.files?.includes("plan.json") ||
      !manifest.inputs.video || manifest.inputs.video.files?.length !== 1 ||
      !manifest.audioMode || !manifest.shared ||
      typeof manifest.shared !== "object" || Array.isArray(manifest.shared))
    throw Error("Render handoff must bind exact script, plan, assets and one scene video.");
  const plan = await readPlannedSceneOrderV2(scope, async (job) => job());
  const planned = plan.scenes.find((item) => item.id === manifest.sceneId);
  if (!planned) throw Error("Scene is not part of locked episode plan.");
  const mode = planned.narratorRequired ?
    (planned.recitationRequired ? "mixed" : "narrated") :
    (planned.recitationRequired ? "recitation" : "silent");
  if (mode !== manifest.audioMode)
    throw Error("Render handoff audio policy differs from the locked plan.");
};

/** Called by Render only, NEVER from an API request. */
export const registerRenderedSceneManifestV2 = async (
  scope: WorkflowIdentity, manifest: SceneFileManifestV2,
  withArtifactLock: SceneArtifactLockV2,
): Promise<void> => {
  if (typeof withArtifactLock !== "function")
    throw Error("Manifest registration requires the shared scene artifact lock.");
  await withArtifactLock(async () => {
    await verifyPolicy(scope, manifest);
    const file = await registryFile(scope, manifest.sceneId);
    const base = { schemaVersion: 1 as const, channel: scope.channel,
      episode: scope.episode, sceneId: manifest.sceneId,
      manifest: structuredClone(manifest) };
    const doc: Registry = { ...base, integrity: {
      alg: "HMAC-SHA256", keyId: workflowKeyId(), mac: mac(base),
    } };
    const tmp = file + "." + randomUUID() + ".tmp";
    const handle = await open(tmp, "wx", 0o600);
    try {
      try { await handle.writeFile(JSON.stringify(doc, null, 2) + "\n"); await handle.sync(); }
      finally { await handle.close(); }
      await rename(tmp, file);
      const dir = await open(path.dirname(file), "r");
      try { await dir.sync(); } finally { await dir.close(); }
    } finally { await rm(tmp, { force: true }); }
  });
};

/** Caller MUST already hold withSceneArtifactLockV2. */
export const readRegisteredSceneManifestV2 = async (
  scope: WorkflowIdentity, sceneId: string,
): Promise<SceneFileManifestV2> => {
  const file = await registryFile(scope, sceneId);
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  let doc: Registry;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 1_000_000)
      throw Error("Unsafe or oversized V2 scene manifest.");
    doc = JSON.parse(await handle.readFile("utf8")) as Registry;
  } finally { await handle.close(); }
  if (!doc || doc.schemaVersion !== 1 || doc.channel !== scope.channel ||
      doc.episode !== scope.episode || doc.sceneId !== sceneId ||
      doc.manifest?.sceneId !== sceneId ||
      doc.integrity?.alg !== "HMAC-SHA256" ||
      doc.integrity.keyId !== workflowKeyId() ||
      !/^[a-f0-9]{64}$/.test(doc.integrity.mac))
    throw Error("Foreign, unsigned or forged V2 scene manifest.");
  const { integrity: _ignored, ...base } = doc;
  if (!timingSafeEqual(Buffer.from(doc.integrity.mac, "hex"),
    Buffer.from(mac(base), "hex")))
    throw Error("V2 scene manifest signature mismatch.");
  await verifyPolicy(scope, doc.manifest);
  return structuredClone(doc.manifest);
};
