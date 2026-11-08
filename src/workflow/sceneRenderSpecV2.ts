/**
 * Server-only render input contract; never accepted over HTTP or synthesized
 * from browser-supplied paths/hashes/recitation identities.
 * A trusted preparation worker writes this signed plan while the episode mutex
 * is held, after owner source signoff and its own media/right provenance checks.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";
import { sceneV2FileFor } from "./sceneStoreV2.ts";
import { workflowKeyId, workflowSigningKey } from "./trust.ts";
import { readPlannedSceneOrderV2 } from "./scenePlanV2.ts";
import { inspectSceneSourcesV2, requireApprovedSceneSourcesV2 } from "./sceneSourcesV2.ts";
import { SCENE_INPUT_KEYS } from "./sceneV2.ts";
import type { SceneFileManifestV2 } from "./sceneArtifactsV2.ts";
import type { WorkflowIdentity } from "./store.ts";

export type TrustedSceneSoundSpecV2 = {
  file: string; sha256: string; kind: "narrator" | "recitation" | "sfx";
  startSec: number; durationSec: number; volume: number;
  cueId?: string; words?: { word: string; start: number; end: number }[];
};
export type TrustedSceneRenderSpecV2 = {
  sceneId: string;
  orientation: "landscape" | "portrait";
  width: number; height: number; durationSec: number;
  sounds: TrustedSceneSoundSpecV2[];
  pictures: { file: string; sha256: string; ref: string }[];
  recitationEvidence?: { origin: "owner-upload"; sha256: string; recordId: string };
  /** 9-group current source manifest. video.files MUST be [] until Render succeeds. */
  manifest: SceneFileManifestV2;
};
type Stored = {
  version: 1; channel: string; episode: string;
  sourceScript: string; sourceStoryboard: string;
  spec: TrustedSceneRenderSpecV2;
  integrity: { keyId: string; mac: string };
};
const sha = /^[a-f0-9]{64}$/;
const scene = /^c[1-9]\d*-[sv]\d+$/;
const safeFile = (p: string) => typeof p === "string" && p.length > 0 &&
  p.length <= 1023 && !p.startsWith("/") && !p.includes("\\") &&
  p.split("/").every((x) => x && x !== "." && x !== ".." && !x.startsWith("."));
const seal = (x: Omit<Stored, "integrity">) =>
  createHmac("sha256", workflowSigningKey()).update(JSON.stringify(x)).digest("hex");

const specFile = async (scope: WorkflowIdentity, id: string) => {
  if (!scene.test(id)) throw Error("Invalid render spec scene.");
  const folder = path.join(path.dirname(await sceneV2FileFor(scope)), ".studio-v2-render-specs");
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const st = await lstat(folder);
  if (!st.isDirectory() || st.isSymbolicLink() || await realpath(folder) !== folder)
    throw Error("Unsafe render spec directory.");
  return path.join(folder, id + ".json");
};

const verifyShape = (s: TrustedSceneRenderSpecV2) => {
  if (!s || !scene.test(s.sceneId) || !["landscape", "portrait"].includes(s.orientation) ||
      !Number.isSafeInteger(s.width) || !Number.isSafeInteger(s.height) ||
      s.width < 320 || s.width > 3840 || s.height < 180 || s.height > 3840 ||
      s.width % 2 !== 0 || s.height % 2 !== 0 ||
      !Number.isFinite(s.durationSec) || s.durationSec < 0.5 || s.durationSec > 600 ||
      !Array.isArray(s.sounds) || s.sounds.length > 30 ||
      !Array.isArray(s.pictures) || s.pictures.length > 40 ||
      s.manifest?.sceneId !== s.sceneId ||
      !s.manifest.audioMode || !s.manifest.inputs ||
      JSON.stringify(Object.keys(s.manifest.inputs).sort()) !== JSON.stringify([...SCENE_INPUT_KEYS].sort()) ||
      s.manifest.inputs.video?.files?.length !== 0 ||
      !s.manifest.inputs.original.files.includes("script.md") ||
      !s.manifest.inputs.storyboard.files.includes("plan.json") ||
      !s.manifest.shared || typeof s.manifest.shared !== "object")
    throw Error("Invalid trusted V2 render spec or manifest.");
  const mode = s.manifest.audioMode;
  const narrator = s.sounds.filter((x) => x.kind === "narrator");
  const recitation = s.sounds.filter((x) => x.kind === "recitation");
  if ((mode === "silent" && (narrator.length || recitation.length)) ||
      (mode === "narrated" && (narrator.length !== 1 || recitation.length)) ||
      (mode === "recitation" && (narrator.length || recitation.length !== 1)) ||
      (mode === "mixed" && (narrator.length !== 1 || recitation.length !== 1)))
    throw Error("Render spec audio mode does not match its sources.");
  for (const x of s.sounds) {
    if (!safeFile(x.file) || !sha.test(x.sha256) ||
        !["narrator", "recitation", "sfx"].includes(x.kind) ||
        !Number.isFinite(x.startSec) || x.startSec < 0 ||
        !Number.isFinite(x.durationSec) || x.durationSec < 0.05 ||
        !Number.isFinite(x.volume) || x.volume < 0 || x.volume > 1 ||
        (x.kind === "narrator" && (!x.file.startsWith("voice/") ||
          !s.manifest.inputs.narration.files.includes(x.file))) ||
        (x.kind === "recitation" && (!x.file.startsWith("recitations/") ||
          !s.manifest.inputs.narration.files.includes(x.file))) ||
        (x.kind === "sfx" && (!x.cueId ||
          !s.manifest.inputs.assets.files.includes(x.file))))
      throw Error("Unpinned scene sound or unverified media source.");
  }
  for (const x of s.pictures) {
    if (!safeFile(x.file) || !sha.test(x.sha256) ||
        !/^(?:lib:)?[a-zA-Z0-9_.-]{1,150}$/.test(x.ref) ||
        !s.manifest.inputs.assets.files.includes(x.file))
      throw Error("Unpinned scene picture.");
  }
  if (recitation.length && (s.recitationEvidence?.origin !== "owner-upload" ||
      s.recitationEvidence.sha256 !== recitation[0]!.sha256 ||
      !/^[a-zA-Z0-9_-]{3,120}$/.test(s.recitationEvidence.recordId)))
    throw Error("Owner-upload recitation provenance is required.");
  if (!recitation.length && s.recitationEvidence)
    throw Error("Unexpected recitation evidence.");
  for (const group of [...Object.values(s.manifest.inputs), ...Object.values(s.manifest.shared)]) {
    if (!group || typeof group.version !== "string" || !group.version ||
        group.version.length > 200 || !Array.isArray(group.files) ||
        group.files.some((file) => !safeFile(file)) ||
        new Set(group.files).size !== group.files.length)
      throw Error("Render spec has unsafe manifest entries.");
  }
};

/** Trusted server worker only, under withSceneArtifactLockV2. */
export const writeTrustedSceneRenderSpecLockedV2 = async (
  scope: WorkflowIdentity, spec: TrustedSceneRenderSpecV2,
) => {
  verifyShape(spec);
  await requireApprovedSceneSourcesV2(scope);
  const plan = await readPlannedSceneOrderV2(scope, async (job) => job());
  const planned = plan.scenes.find((x) => x.id === spec.sceneId);
  const mode = planned?.narratorRequired
    ? planned.recitationRequired ? "mixed" : "narrated"
    : planned?.recitationRequired ? "recitation" : "silent";
  if (!planned || mode !== spec.manifest.audioMode)
    throw Error("Render spec conflicts with locked scene plan.");
  const sources = await inspectSceneSourcesV2(scope);
  const base = { version: 1 as const, channel: scope.channel, episode: scope.episode,
    sourceScript: sources.script.fingerprint,
    sourceStoryboard: sources.storyboard.fingerprint, spec: structuredClone(spec) };
  const doc: Stored = { ...base, integrity: { keyId: workflowKeyId(), mac: seal(base) } };
  const target = await specFile(scope, spec.sceneId);
  const temporary = target + "." + randomUUID() + ".tmp";
  const handle = await open(temporary, "wx", 0o600);
  try {
    try { await handle.writeFile(JSON.stringify(doc) + "\n"); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, target);
    const dir = await open(path.dirname(target), "r");
    try { await dir.sync(); } finally { await dir.close(); }
  } finally { await rm(temporary, { force: true }); }
};

/** Must be called inside the episode artifact mutex; no unsigned fallbacks. */
export const readTrustedSceneRenderSpecLockedV2 = async (
  scope: WorkflowIdentity, id: string,
): Promise<TrustedSceneRenderSpecV2> => {
  const target = await specFile(scope, id);
  const h = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  let doc: Stored;
  try {
    const st = await h.stat();
    if (!st.isFile() || st.nlink !== 1 || st.size > 1024 * 1024)
      throw Error("Unsafe signed render spec.");
    doc = JSON.parse(await h.readFile("utf8")) as Stored;
  } finally { await h.close(); }
  if (!doc || doc.version !== 1 || doc.channel !== scope.channel ||
      doc.episode !== scope.episode || doc.spec?.sceneId !== id ||
      doc.integrity?.keyId !== workflowKeyId() || !sha.test(doc.integrity.mac))
    throw Error("Unsigned or foreign render spec.");
  const { integrity: _sig, ...base } = doc;
  if (!timingSafeEqual(Buffer.from(doc.integrity.mac, "hex"), Buffer.from(seal(base), "hex")))
    throw Error("Forged or modified render spec.");
  verifyShape(doc.spec);
  const src = await inspectSceneSourcesV2(scope);
  if (!src.script.approved || !src.storyboard.approved ||
      src.script.fingerprint !== doc.sourceScript ||
      src.storyboard.fingerprint !== doc.sourceStoryboard)
    throw Error("Source signoff changed after render spec was sealed.");
  return structuredClone(doc.spec);
};
