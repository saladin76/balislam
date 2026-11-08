/**
 * Render -> Backend V2 registration bridge. Pure server-side projection:
 * verifies real MP4 bytes + 9 input groups, but DOES NOT sign or approve.
 * Call under Backend's existing episode artifact mutex, then invoke
 * registerRenderedSceneManifestLockedV2(scope, manifest) in that SAME lock.
 * No browser data may supply files, versions, scopes, or rights.
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import type { SceneRenderRequestV2, SceneRenderSuccessV2 } from "./sceneV2";
import { probeMedia } from "./sceneV2Probe";

const inputKeys = [
  "original", "vocalized", "tone", "storyboard", "assets",
  "narration", "sync", "video", "rights",
] as const;
type InputKey = (typeof inputKeys)[number];
type SourceInputKey = Exclude<InputKey, "video">;
export type SceneFileSetHandoffV2 = Readonly<{ version: string; files: readonly string[] }>;
export type SceneServerSourcesHandoffV2 = Readonly<Record<SourceInputKey, SceneFileSetHandoffV2>>;
export type SceneManifestHandoffV2 = Readonly<{
  sceneId: string;
  audioMode: "silent" | "narrated" | "recitation" | "mixed";
  inputs: Readonly<Record<InputKey, SceneFileSetHandoffV2>>;
  shared: Readonly<Record<string, SceneFileSetHandoffV2>>;
}>;

const sha256 = async (file: string) => {
  const hash = createHash("sha256");
  for await (const piece of createReadStream(file)) hash.update(piece);
  return hash.digest("hex");
};
const inRoot = (root: string, file: string) => file.startsWith(root + path.sep);
const validRelative = (filename: string): boolean =>
  typeof filename === "string" && filename.length > 0 && filename.length < 1024 &&
  !path.isAbsolute(filename) && !filename.includes("\\") &&
  filename.split("/").every((segment) =>
    segment.length > 0 && segment !== "." && segment !== ".." &&
    !segment.startsWith(".") && !segment.endsWith(".lock") &&
    !["scene-workflow.v2.json", "workflow-approvals.json"].includes(segment));

const safeSet = async (
  root: string, label: string, set: SceneFileSetHandoffV2, allowEmpty = false,
) => {
  if (!set || typeof set.version !== "string" || !set.version.trim() ||
      set.version.length > 200 || !Array.isArray(set.files) ||
      (!allowEmpty && set.files.length === 0) || set.files.length > 1024 ||
      new Set(set.files).size !== set.files.length)
    throw Error("Invalid Backend source set: " + label);
  for (const item of set.files) {
    if (!validRelative(item)) throw Error("Unsafe Backend source file in " + label);
    const file = path.join(root, item);
    const st = await lstat(file);
    if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 ||
        !inRoot(root, await realpath(file)))
      throw Error("Unsafe or redirected Backend source in " + label);
  }
  return { version: set.version, files: [...set.files] };
};

/**
 * The caller MUST hold the production lease and episode artifact lock
 * through both this verification and Backend signed manifest registration.
 * This is NOT an alternate signature or a source of owner approval.
 */
export const verifySceneV2ForBackendManifest = async (
  request: SceneRenderRequestV2,
  result: SceneRenderSuccessV2,
  sources: SceneServerSourcesHandoffV2,
  shared: Readonly<Record<string, SceneFileSetHandoffV2>>,
  ffprobeBinary: string,
): Promise<{ manifest: SceneManifestHandoffV2; evidence: {
  jobId: string; file: string; sha256: string; bytes: number;
  durationSec: number; frames: number; fps: number;
  videoCodec: string; audioCodecs: string[]; reviewStatus: "not_submitted";
} }> => {
  if (!result || result.status !== "succeeded" || result.reviewStatus !== "not_submitted" ||
      result.sceneId !== request.sceneId || result.planSha256 !== request.planSha256 ||
      !path.isAbsolute(ffprobeBinary) || !/^[a-f0-9]{64}$/.test(result.sha256))
    throw Error("Backend handoff requires current successful Render job.");
  const episodeRoot = await realpath(path.join(request.channelsRoot,
    request.channel, "episodes", request.episode));
  if (!validRelative(result.relativeFile) ||
      !result.relativeFile.startsWith("previews/") ||
      !result.relativeFile.endsWith(".mp4"))
    throw Error("Renderer MP4 must be episode-owned and immutable.");
  const canonical = await realpath(result.file);
  if (!inRoot(episodeRoot, canonical) ||
      canonical !== path.join(episodeRoot, result.relativeFile))
    throw Error("Renderer MP4 escapes locked episode.");
  const st = await lstat(result.file);
  if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 ||
      st.size !== result.bytes || st.size < 500)
    throw Error("Renderer MP4 is not the registered immutable file.");
  if (await sha256(result.file) !== result.sha256)
    throw Error("Rendered MP4 changed after Render returned.");
  const actual = await probeMedia(ffprobeBinary, result.file, true);
  if (actual.video.codec !== "h264" || actual.video.width !== result.width ||
      actual.video.height !== result.height ||
      Math.abs(actual.video.fps - result.fps) > 0.01 ||
      actual.video.frames !== result.frames ||
      Math.abs(actual.durationSec - result.durationSec) > 0.01 ||
      actual.audio.length !== result.audioStreams ||
      actual.audio.map((s) => s.codec).join(",") !== result.audioCodecs.join(",") ||
      (request.sounds.length === 0 ? actual.audio.length !== 0 :
        actual.audio.length !== 1 || actual.audio[0]?.codec !== "aac"))
    throw Error("Backend independently probed different scene AV streams.");

  const input = {} as Record<InputKey, SceneFileSetHandoffV2>;
  for (const key of inputKeys) {
    if (key === "video") continue;
    input[key] = await safeSet(episodeRoot, key, sources[key],
      key === "narration" && request.mode === "silent");
  }
  if (!input.original.files.includes("script.md") ||
      !input.storyboard.files.includes("plan.json"))
    throw Error("Backend source manifest lacks script.md or plan.json.");

  const expectedSoundFiles: string[] = [];
  for (const sound of request.sounds) {
    if (sound.kind === "sfx") continue;
    const physical = await realpath(sound.file);
    if (!inRoot(episodeRoot, physical))
      throw Error("Voice source escaped the episode.");
    const rel = path.relative(episodeRoot, physical).split(path.sep).join("/");
    if ((sound.kind === "narrator" && !/^voice\\/[^/]+\\.(mp3|wav|m4a)$/i.test(rel)) ||
        (sound.kind === "recitation" && !/^recitations\\/[^/]+\\.(mp3|wav|m4a)$/i.test(rel)))
      throw Error("Backend voice/recitation path policy mismatch.");
    if (await sha256(physical) !== sound.sha256)
      throw Error("Audio source bytes changed before manifest handoff.");
    expectedSoundFiles.push(rel);
  }
  if (expectedSoundFiles.length !== input.narration.files.length ||
      expectedSoundFiles.some((name) => !input.narration.files.includes(name)))
    throw Error("Manifest narration files differ from exact rendered sound assets.");
  const safeShared: Record<string, SceneFileSetHandoffV2> = {};
  if (!shared || typeof shared !== "object" || Array.isArray(shared) ||
      Object.keys(shared).length > 1000)
    throw Error("Invalid shared Backend source manifest.");
  for (const [name, set] of Object.entries(shared)) {
    if (!/^[a-z0-9][a-z0-9_.:/-]{0,199}$/.test(name) ||
        name.split("/").some((part) => !part || part === "." || part === ".."))
      throw Error("Invalid shared Backend source key.");
    safeShared[name] = await safeSet(episodeRoot, "shared:" + name, set);
  }
  input.video = { version: "sha256:" + result.sha256,
    files: [result.relativeFile] };
  const manifest: SceneManifestHandoffV2 = {
    sceneId: result.sceneId, audioMode: request.mode, inputs: input, shared: safeShared,
  };
  return {
    manifest,
    evidence: {
      jobId: result.jobId, file: result.file, sha256: result.sha256,
      bytes: st.size, durationSec: actual.durationSec, frames: actual.video.frames,
      fps: actual.video.fps, videoCodec: actual.video.codec,
      audioCodecs: actual.audio.map((s) => s.codec),
      reviewStatus: "not_submitted",
    },
  };
};
