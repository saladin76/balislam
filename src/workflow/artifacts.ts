/**
 * Read-only evidence snapshots for the six-stage workflow.
 * The API MUST compute these on the server from the current episode bytes.
 * No client-supplied digest, approval, or version is authoritative.
 */
import path from "node:path";
import { createHash } from "node:crypto";
import { lstat, open, readFile } from "node:fs/promises";
import { channelsDir, currentChannelId } from "../channel";
import { resolveScriptPath } from "../script/episodes";
import { readPlanFile } from "../plan/io";
import { storyboardVisualHash } from "../plan/storyboard";
import type { Plan } from "../plan/types";
import { STUDIO_CHANNELS, type WorkflowIdentity } from "./store";
import type { ArtifactVersion, WorkflowSnapshot } from "./gates";

const hash = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const versioned = (bytes: string | Uint8Array): ArtifactVersion => {
  const sha256 = hash(bytes);
  return { sha256, version: sha256.slice(0, 16) };
};

/** Symlinks are never treated as trustworthy episode evidence. */
const optionalBytes = async (file: string): Promise<Buffer | null> => {
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Error("Workflow evidence must be a regular file.");
    return await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};
/** Hash large videos by streaming, checking the opened inode before/after hashing. */
const optionalFileHash = async (file: string): Promise<string | null> => {
  let expected: Awaited<ReturnType<typeof lstat>>;
  try { expected = await lstat(file); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  if (!expected.isFile() || expected.isSymbolicLink()) throw Error("Video evidence is not a regular file.");
  const handle = await open(file, "r");
  try {
    const before = await handle.stat();
    if (before.ino !== expected.ino || before.dev !== expected.dev || before.size !== expected.size ||
        before.mtimeMs !== expected.mtimeMs) throw Error("Video changed before hashing.");
    const dig = createHash("sha256");
    for await (const chunk of handle.createReadStream({ autoClose: false })) dig.update(chunk);
    const after = await handle.stat();
    const current = await lstat(file);
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs ||
        after.ctimeMs !== before.ctimeMs || current.ino !== before.ino ||
        current.dev !== before.dev || current.size !== before.size ||
        current.mtimeMs !== before.mtimeMs) throw Error("Video changed while hashing.");
    return dig.digest("hex");
  } finally { await handle.close(); }
};
const fromHash = (sha256: string): ArtifactVersion => ({ sha256, version: sha256.slice(0, 16) });
const optionalText = async (file: string) => (await optionalBytes(file))?.toString("utf8") ?? "";
const safeClip = (name: string) => /^[a-zA-Z0-9_.-]{1,180}\.mp3$/.test(name) && !name.startsWith(".");

export const workflowIdentity = async (episode: string): Promise<{ scope: WorkflowIdentity; scriptPath: string }> => {
  const channel = currentChannelId();
  if (!(STUDIO_CHANNELS as readonly string[]).includes(channel)) throw Error("Unknown workflow channel.");
  const scriptPath = await resolveScriptPath(episode);
  return {
    scope: { channelsRoot: channelsDir(), channel: channel as WorkflowIdentity["channel"], episode: path.basename(path.dirname(scriptPath)) },
    scriptPath,
  };
};

/** Called with a resolved episode file and optional already-loaded plan for test isolation. */
export const snapshotFromFiles = async (scriptPath: string, plan: Plan | null): Promise<WorkflowSnapshot> => {
  const dir = path.dirname(scriptPath);
  const script = await optionalBytes(scriptPath);
  if (!script) throw Error("Missing script; cannot issue a workflow snapshot.");
  const scriptReview = await optionalBytes(path.join(dir, "review.json"));
  const signoff = await optionalBytes(path.join(dir, "script-signoff.json"));
  const snapshot: WorkflowSnapshot = {
    script: versioned(JSON.stringify(["script-v2", hash(script), scriptReview ? hash(scriptReview) : null,
      signoff ? hash(signoff) : null])),
  };
  if (!plan) return snapshot;
  // Tone is intentionally excluded: the storyboard signoff precedes tone selection.
  const visuals = plan.chapters.flatMap(c => c.scenes.map(s => [s.id, storyboardVisualHash(s)]));
  const board = await optionalBytes(path.join(dir, "storyboard.json"));
  snapshot.storyboard = versioned(JSON.stringify(["storyboard-v2", visuals,
    board ? hash(board) : null]));
  const indexFile = await optionalText(path.join(dir, "voice", "index.json"));
  const index = indexFile ? JSON.parse(indexFile) as Record<string, { file?: string; text?: string; duration?: number; words?: unknown }> : {};
  const clips: [string, string, string | null][] = [];
  for (const id of Object.keys(index).sort()) {
    const name = index[id]?.file;
    if (!name || !safeClip(name)) throw Error("Unsafe voice clip reference in workflow snapshot.");
    const bytes = await optionalBytes(path.join(dir, "voice", name));
    clips.push([id, name, bytes ? hash(bytes) : null]);
  }
  const voiceReview = await optionalBytes(path.join(dir, "voice-review.json"));
  const recitations = await optionalBytes(path.join(dir, "recitations", "index.json"));
  const quranIndex = recitations ? JSON.parse(recitations.toString("utf8")) as Record<string, { provider?: string; parts?: { file: string }[] }> : {};
  const recorded: [string, string, string | null][] = [];
  for (const [key, rec] of Object.entries(quranIndex).sort(([a], [b]) => a.localeCompare(b))) {
    if (rec?.provider !== "manual") continue;
    for (const part of rec.parts ?? []) {
      if (!safeClip(part.file)) throw Error("Unsafe Quran clip reference in workflow snapshot.");
      const bytes = await optionalBytes(path.join(dir, "recitations", part.file));
      recorded.push([key, part.file, bytes ? hash(bytes) : null]);
    }
  }
  snapshot.voice = versioned(JSON.stringify(["voice-v2", index, clips,
    voiceReview ? hash(voiceReview) : null, recitations ? hash(recitations) : null, recorded]));
  const motion = await optionalBytes(path.join(dir, "out", "storyboard-motion.json"));
  if (!motion) return snapshot;
  const sceneReview = await optionalBytes(path.join(dir, "scene-review.json"));
  snapshot.motion = versioned(JSON.stringify(["motion-v1", hash(motion), sceneReview ? hash(sceneReview) : null]));
  // Review is of the actual integrated AV preview; presence never implies approval.
  const previewHash = await optionalFileHash(path.join(dir, "previews", "episode.mp4"));
  if (!previewHash) return snapshot;
  snapshot.av_review = fromHash(previewHash);
  const masterId = plan.episode || path.basename(dir).slice(0, 3);
  if (!/^\d{3}$/.test(masterId)) throw Error("Unsafe Master episode identifier.");
  const masterHash = await optionalFileHash(path.join(dir, "out", "package", `${masterId}-episode.mp4`));
  if (masterHash) snapshot.master = fromHash(masterHash); // SHA-256 of EXACT final Master bytes.
  return snapshot;
};

export const collectWorkflowSnapshot = async (episode: string): Promise<{ scope: WorkflowIdentity; scriptPath: string; snapshot: WorkflowSnapshot }> => {
  const { scope, scriptPath } = await workflowIdentity(episode);
  const plan = await readPlanFile(scriptPath);
  return { scope, scriptPath, snapshot: await snapshotFromFiles(scriptPath, plan) };
};
