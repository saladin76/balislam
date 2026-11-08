/**
 * Studio V2 — verify the *actual* composited scene MP4 structure using ffprobe.
 *
 * Call ONLY from trusted server code inside the episode's shared artifact
 * writer lock. This module does not prove that a human watched the video,
 * that Quran recitation is human, or that its rights are cleared.
 *
 * The executable path is trusted server config, never a request parameter.
 * Missing ffprobe => fail closed, not "media ok".
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { access, realpath, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { resolveArtifact, sha256FileAndEpoch } from "./artifacts.ts";
import type { SceneFileManifestV2 } from "./sceneArtifactsV2.ts";
import type { WorkflowIdentity } from "./store.ts";

export type SceneAvProbeV2 = {
  sha256: string;
  epoch: string;
  durationSec: number;
  width: number;
  height: number;
  videoCodec: string;
  /** "silent" permits no audio track; scored/ambient audio is also permitted. */
  hasAudio: boolean;
  audioCodec?: string;
  audioChannels?: number;
};

export type SceneMediaProbeSettingsV2 = Readonly<{
  ffprobeBinary: string;
  timeoutMs?: number;
}>;

type FfprobeStream = {
  codec_type?: unknown;
  codec_name?: unknown;
  width?: unknown;
  height?: unknown;
  channels?: unknown;
};
type FfprobeResult = {
  streams?: unknown;
  format?: { format_name?: unknown; duration?: unknown };
};

const acceptedCodec = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-z0-9][a-z0-9_.+-]{0,63}$/i.test(value) &&
  !["none", "unknown", "rawvideo"].includes(value.toLowerCase());

const runProbe = async (binary: string, media: string, timeoutMs: number): Promise<FfprobeResult> => {
  const args = [
    "-v", "error",
    "-show_entries", "format=format_name,duration:stream=codec_type,codec_name,width,height,channels",
    "-of", "json", "-i", media,
  ];
  return new Promise<FfprobeResult>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let oversized = false;
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Only minimal binary execution context; don't leak workflow HMAC key.
    const child = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        HOME: process.env.HOME ?? "",
        LANG: "C",
      },
    });
    const done = (error?: Error, result?: FfprobeResult) => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      if (error) reject(error);
      else resolve(result!);
    };
    timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout?.on("data", (buf: Buffer) => {
      stdout += buf.toString("utf8");
      if (Buffer.byteLength(stdout, "utf8") > 524288) {
        oversized = true;
        child.kill("SIGKILL");
      }
    });
    child.stderr?.on("data", (buf: Buffer) => {
      if (stderr.length < 8192) stderr += buf.toString("utf8").slice(0, 8192 - stderr.length);
    });
    child.on("error", (err) => done(new Error("Studio V2 ffprobe could not start: " + err.message)));
    child.on("close", (exitCode) => {
      if (timedOut) return done(Error("Studio V2 ffprobe timed out."));
      if (oversized) return done(Error("Studio V2 ffprobe output exceeded safety limit."));
      if (exitCode !== 0) return done(Error("Studio V2 ffprobe failed: " + stderr.slice(0, 400)));
      try {
        const raw: unknown = JSON.parse(stdout);
        if (!raw || typeof raw !== "object" || Array.isArray(raw))
          throw Error("Expected structured media metadata.");
        done(undefined, raw as FfprobeResult);
      } catch {
        done(Error("Studio V2 ffprobe returned malformed media metadata."));
      }
    });
  });
};

const extract = (raw: FfprobeResult, mode: string): Omit<SceneAvProbeV2, "sha256" | "epoch"> => {
  const formatName = raw.format?.format_name;
  if (typeof formatName !== "string" ||
      !formatName.toLowerCase().split(",").includes("mp4"))
    throw Error("Scene media must have an actual MP4 container.");
  const durationSec = Number(raw.format?.duration);
  if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > 8 * 3600)
    throw Error("Scene media must have a valid positive duration.");

  if (!Array.isArray(raw.streams)) throw Error("Scene media has no verifiable AV streams.");
  const streams = raw.streams as FfprobeStream[];
  const video = streams.filter((s) => s && s.codec_type === "video");
  const audio = streams.filter((s) => s && s.codec_type === "audio");
  if (video.length !== 1 || !acceptedCodec(video[0]?.codec_name))
    throw Error("Scene media needs exactly one decodable video stream.");
  const width = Number(video[0]?.width);
  const height = Number(video[0]?.height);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 16 || height < 16 || width > 16384 || height > 16384)
    throw Error("Scene video dimensions are invalid.");
  const expectedAudio = mode !== "silent";
  if (expectedAudio && audio.length < 1)
    throw Error("Voiced or recited scene MP4 is missing its audio track.");
  if (audio.some((s) => !acceptedCodec(s.codec_name) ||
      !Number.isSafeInteger(s.channels) || (s.channels as number) < 1 ||
      (s.channels as number) > 32))
    throw Error("Scene audio stream is invalid.");
  const primaryAudio = audio[0];
  return {
    durationSec, width, height,
    videoCodec: video[0]!.codec_name as string,
    hasAudio: audio.length > 0,
    ...(primaryAudio ? {
      audioCodec: primaryAudio.codec_name as string,
      audioChannels: primaryAudio.channels as number,
    } : {}),
  };
};

/**
 * Call within the same shared lock as the file projector, render output
 * writes, and actual owner-signoff mutation. Checks MP4 bytes and epoch on
 * BOTH sides of ffprobe to catch uncoordinated file replacement/edit.
 */
export const probeSceneAvLockedV2 = async (
  scope: WorkflowIdentity,
  manifest: SceneFileManifestV2,
  settings: SceneMediaProbeSettingsV2,
): Promise<SceneAvProbeV2> => {
  if (!manifest || typeof manifest.sceneId !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.sceneId) ||
      !manifest.audioMode || !["silent", "narrated", "recitation", "mixed"].includes(manifest.audioMode))
    throw Error("Scene media probe requires explicit plan-derived audio policy.");
  const mediaFiles = manifest.inputs?.video?.files;
  if (!Array.isArray(mediaFiles) || mediaFiles.length !== 1 ||
      typeof mediaFiles[0] !== "string" ||
      !/\.mp4$/i.test(mediaFiles[0]) || mediaFiles[0].startsWith("channel-images/"))
    throw Error("Scene media probe requires exactly one episode-owned MP4.");
  if (!settings || typeof settings.ffprobeBinary !== "string" ||
      !path.isAbsolute(settings.ffprobeBinary) ||
      (settings.timeoutMs !== undefined && (
        !Number.isSafeInteger(settings.timeoutMs) ||
        settings.timeoutMs < 200 || settings.timeoutMs > 30000
      )))
    throw Error("A trusted absolute ffprobe executable path is required.");
  const resolvedProbe = await realpath(settings.ffprobeBinary);
  const probeStat = await stat(resolvedProbe);
  if (!probeStat.isFile()) throw Error("ffprobe must be a regular executable file.");
  await access(resolvedProbe, constants.X_OK);

  const media = await resolveArtifact(scope, mediaFiles[0]);
  const before = await sha256FileAndEpoch(media);
  const result = extract(await runProbe(resolvedProbe, media, settings.timeoutMs ?? 15000),
    manifest.audioMode);
  const after = await sha256FileAndEpoch(await resolveArtifact(scope, mediaFiles[0]));
  if (before.sha256 !== after.sha256 || before.epoch !== after.epoch)
    throw Error("Scene MP4 changed while checking actual audio/video streams.");
  return { ...after, ...result };
};
