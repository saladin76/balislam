/**
 * Server-side artifact hashing for Studio workflow. Neither paths nor digests
 * in this manifest may come from HTTP requests; they are production configuration.
 * All files must exist inside the owning episode or its channel image library.
 */
import path from "node:path";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { WORKFLOW_STAGES, type WorkflowSnapshot, type WorkflowStage } from "./gates.ts";
import { workflowFileFor, type WorkflowIdentity } from "./store.ts";

export type StageArtifactFiles = { version: string; files: readonly string[] };
export type ArtifactManifest = {
  stages: Partial<Record<Exclude<WorkflowStage, "master">, StageArtifactFiles>>;
  master?: { version: string; file: string };
};
const validRelative = (name: string) => {
  const items = name.split("/");
  return name.length > 0 && name.length < 1024 && !name.includes("\\") &&
    !path.posix.isAbsolute(name) && items.every((s) => s !== ".." && s !== "." && s !== "") &&
    items[0] !== "." && !name.includes("\0");
};
const within = (base: string, candidate: string): boolean => {
  const rel = path.relative(base, candidate);
  return rel !== "" && rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel);
};
/** Resolve against the *real* episode folder. No traversal, foreign episodes or symlink chains. */
export const resolveArtifact = async (scope: WorkflowIdentity, name: string): Promise<string> => {
  if (!validRelative(name)) throw new Error("Unsafe artifact path.");
  const episodeDir = path.dirname(await workflowFileFor(scope));
  // Shared channel imagery may be explicitly included as `channel-images/...`.
  const library = path.join(scope.channelsRoot, scope.channel, "images");
  const isLibrary = name.startsWith("channel-images/");
  if (isLibrary) {
    const channelDir = await realpath(path.join(scope.channelsRoot, scope.channel));
    const st = await lstat(library);
    if (!st.isDirectory() || st.isSymbolicLink() ||
        await realpath(library) !== path.join(channelDir, "images"))
      throw new Error("Unsafe shared image library.");
  }
  const base = isLibrary ? library : episodeDir;
  const sub = isLibrary ? name.slice("channel-images/".length) : name;
  if (!validRelative(sub) ||
      (!isLibrary && (sub === "workflow-approvals.json" ||
        sub.startsWith("workflow-approvals.json."))) ||
      (isLibrary && !/\.(png|jpe?g|webp|svg|mov|mp4|webm)$/i.test(sub)))
    throw new Error("Unsafe or self-referential artifact path.");
  const candidate = path.resolve(base, sub);
  if (!within(base, candidate)) throw new Error("Artifact escapes owning episode/channel library.");
  // Reject *any* symlink in the source path, not just the final file.
  let check = base;
  for (const piece of sub.split("/")) {
    check = path.join(check, piece);
    const st = await lstat(check);
    if (st.isSymbolicLink()) throw new Error("Symlink artifacts are not trusted.");
  }
  const st = await lstat(candidate);
  if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1)
    throw new Error("Artifact must be a regular, episode-owned file without hardlinks.");
  const real = await realpath(candidate);
  const realBase = await realpath(base);
  if (!within(realBase, real)) throw new Error("Artifact real path escapes scope.");
  return real;
};
/**
 * Hash the actual file, plus a separately signed on-disk generation marker.
 * The marker catches edit-then-byte-restore without an intervening workflow read.
 * ctime is changed by the OS on a real write, and inode changes on atomic replace.
 * Privileged filesystem rollback still requires an external monotonic anchor.
 */
export const sha256FileAndEpoch = async (file: string): Promise<{ sha256: string; epoch: string }> => {
  // O_NOFOLLOW prevents the final component being swapped to a symlink.
  // Parents and writers must also be guarded by the shared episode artifact lock.
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.nlink !== 1n)
      throw new Error("Cannot hash a linked or non-regular artifact.");
    const hash = createHash("sha256");
    for await (const bytes of handle.createReadStream({ autoClose: false })) hash.update(bytes);
    const after = await handle.stat({ bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino ||
        before.size !== after.size || before.ctimeNs !== after.ctimeNs ||
        before.mtimeNs !== after.mtimeNs)
      throw new Error("Artifact changed while being hashed; retry under the shared artifact lock.");
    const epoch = createHash("sha256").update(JSON.stringify([
      "studio-file-epoch-v1", before.dev.toString(), before.ino.toString(),
      before.size.toString(), before.ctimeNs.toString(), before.mtimeNs.toString(),
    ])).digest("hex");
    return { sha256: hash.digest("hex"), epoch };
  } finally { await handle.close(); }
};
export const sha256File = async (file: string): Promise<string> =>
  (await sha256FileAndEpoch(file)).sha256;
const validVersion = (v: string) => typeof v === "string" && v.length > 0 && v.length <= 200;

export const collectActualArtifactDigests = async (
  scope: WorkflowIdentity, manifest: ArtifactManifest,
): Promise<WorkflowSnapshot> => {
  const snapshot: WorkflowSnapshot = {};
  for (const stage of WORKFLOW_STAGES) {
    if (stage === "master") {
      if (!manifest.master) continue;
      if (!validVersion(manifest.master.version) || !/\.mp4$/i.test(manifest.master.file) ||
          manifest.master.file.startsWith("channel-images/"))
        throw new Error("Master must be a versioned episode-owned MP4 candidate.");
      // Exact bytes, not a JSON container, filename, video metadata or preview hash.
      const file = await resolveArtifact(scope, manifest.master.file);
      snapshot.master = { version: manifest.master.version, ...await sha256FileAndEpoch(file) };
      continue;
    }
    const input = manifest.stages[stage];
    if (!input) continue;
    if (!validVersion(input.version) || !input.files.length) throw new Error(`Incomplete verified artifact manifest: ${stage}`);
    const names = [...input.files].sort();
    if (new Set(names).size !== names.length) throw new Error(`Duplicate artifact reference: ${stage}`);
    if (stage === "script" && !names.includes("script.md")) throw new Error("Script must include actual script.md.");
    const hash = createHash("sha256");
    const epochHash = createHash("sha256");
    hash.update(JSON.stringify(["studio-stage-artifact-v1", stage, input.version, scope.channel, scope.episode]));
    epochHash.update(JSON.stringify(["studio-stage-epoch-v1", stage, input.version, scope.channel, scope.episode]));
    for (const name of names) {
      const file = await resolveArtifact(scope, name);
      const { sha256, epoch } = await sha256FileAndEpoch(file);
      hash.update(JSON.stringify([name, sha256]));
      epochHash.update(JSON.stringify([name, epoch]));
    }
    snapshot[stage] = { version: input.version, sha256: hash.digest("hex"), epoch: epochHash.digest("hex") };
  }
  return snapshot;
};

/** A verified publication copy freezes the exact bytes checked by the Master gate. */
export const assertExactMaster = async (scope: WorkflowIdentity, manifest: ArtifactManifest, approvedSha: string) => {
  if (!manifest.master || !/^[a-f0-9]{64}$/.test(approvedSha)) throw new Error("No exact Master approval fingerprint.");
  const file = await resolveArtifact(scope, manifest.master.file);
  if (await sha256File(file) !== approvedSha) throw new Error("Master bytes differ from the approved file.");
  return file;
};

// Studio production adapter (snapshot of the real episode files). Kept in its own module.
export { collectWorkflowSnapshot, snapshotFromFiles, workflowIdentity } from "./studioSnapshot";
