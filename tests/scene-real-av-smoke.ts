/**
 * Studio V2 E2 — REAL-media standalone smoke test.
 *
 * Creates genuine MP4(s) and WAV with actual ffmpeg, probes with actual
 * ffprobe through the same production function. No episode files touched;
 * every byte is generated in an owned temp folder and removed on exit.
 *
 * Run on Mac:
 *   STUDIO_FFMPEG_BIN=/opt/homebrew/bin/ffmpeg \
 *   STUDIO_FFPROBE_BIN=/opt/homebrew/bin/ffprobe \
 *   npx --no-install tsx tests/scene-real-av-smoke.ts
 *
 * A synthetic sine signal proves an audio track only; it is NOT human
 * narration, Quran recitation, or evidence of owner AV watching.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  access, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { collectSceneInputsFromDiskV2, type SceneFileManifestV2 } from "../src/workflow/sceneArtifactsV2.ts";
import { probeSceneAvLockedV2 } from "../src/workflow/sceneMediaV2.ts";
import type { WorkflowIdentity } from "../src/workflow/store.ts";

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw Error("Real AV QA: " + message);
};
const hash = (content: Buffer) => createHash("sha256").update(content).digest("hex");

const binaryPath = async (value: string | undefined, name: string) => {
  if (!value || !path.isAbsolute(value)) throw Error("Set absolute STUDIO_" + name + "_BIN.");
  const file = await realpath(value);
  if (!(await stat(file)).isFile()) throw Error(name + " is not a regular binary.");
  await access(file, constants.X_OK);
  return file;
};

const ffmpeg = async (binary: string, args: string[]) => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-y", ...args,
    ], {
      shell: false, stdio: ["ignore", "ignore", "pipe"],
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin", LANG: "C" },
    });
    let err = "";
    let finished = false;
    const finish = (problem?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      problem ? reject(problem) : resolve();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(Error("ffmpeg exceeded 20-second smoke timeout"));
    }, 20000);
    child.stderr?.on("data", (data: Buffer) => {
      if (err.length < 4096) err += data.toString("utf8").slice(0, 4096 - err.length);
    });
    child.on("error", (error) => finish(Error("ffmpeg start failed: " + error.message)));
    child.on("close", (code) => finish(code === 0 ? undefined :
      Error("ffmpeg smoke encode failed: " + err.slice(0, 800))));
  });
};

const set = (name: string) => ({ version: "e2-real-media", files: [name] });
const manifestFor = (id: string, mode: "silent" | "narrated", mp4: string): SceneFileManifestV2 => ({
  sceneId: id,
  audioMode: mode,
  inputs: {
    original: set("script.md"),
    vocalized: set("vocalized/" + id + ".json"),
    tone: set("tone/" + id + ".json"),
    storyboard: set("storyboard/" + id + ".json"),
    assets: set("assets/" + id + ".png"),
    narration: mode === "silent"
      ? { version: "e2-real-media", files: [] }
      : set("voice/" + id + ".wav"),
    sync: set("sync/" + id + ".json"),
    video: set("previews/" + mp4),
    rights: set("rights/" + id + ".json"),
  },
  shared: {},
});

const main = async () => {
  const ffmpegBin = await binaryPath(process.env.STUDIO_FFMPEG_BIN, "FFMPEG");
  const ffprobeBin = await binaryPath(process.env.STUDIO_FFPROBE_BIN, "FFPROBE");
  const workspace = await mkdtemp(path.join(os.tmpdir(), "studio-v2-real-av-smoke-"));
  const scope: WorkflowIdentity = {
    channelsRoot: workspace, channel: "balislam", episode: "001-real-av-qa",
  };
  const root = path.join(workspace, scope.channel, "episodes", scope.episode);
  const created: string[] = [];
  const save = async (name: string, value: string | Buffer) => {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, value);
    return file;
  };
  try {
    await mkdir(root, { recursive: true });
    await save("script.md", "Isolated, original real-media smoke script");
    await save("plan.json", JSON.stringify({
      version: 1, episode: "001", channel: scope.channel,
      chapters: [{ number: 1, scenes: [
        { id: "c1-s0", narration: "" },
        { id: "c1-s1", narration: "synthetic audio track for technical QA only" },
      ] }],
    }));
    for (const id of ["c1-s0", "c1-s1"]) {
      for (const group of ["vocalized", "tone", "storyboard", "assets", "sync", "rights"])
        await save(group + "/" + id + (group === "assets" ? ".png" : ".json"),
          "isolated-qa-" + group + "-" + id);
    }

    const visual = ["-f", "lavfi", "-i", "testsrc2=size=320x180:rate=25:duration=1.5"];
    const audio = ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=1.5"];
    const pictureCodec = ["-c:v", "mpeg4", "-q:v", "5", "-pix_fmt", "yuv420p"];
    const silent = path.join(root, "previews", "c1-s0.mp4");
    const narrated = path.join(root, "previews", "c1-s1.mp4");
    const audioOnly = path.join(root, "previews", "audio-only.mp4");
    await mkdir(path.dirname(silent), { recursive: true });

    await ffmpeg(ffmpegBin, [...visual, ...pictureCodec, "-an", "-movflags", "+faststart", silent]);
    created.push("silent-video");
    await ffmpeg(ffmpegBin, [...visual, ...audio, ...pictureCodec,
      "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", narrated]);
    created.push("video-with-audio");
    await ffmpeg(ffmpegBin, [...audio, "-c:a", "aac", "-b:a", "96k", audioOnly]);
    created.push("audio-only-mp4");
    await ffmpeg(ffmpegBin, [...audio, "-c:a", "pcm_s16le",
      path.join(root, "voice", "c1-s1.wav")]);
    // The voice folder must exist before writing the PCM test source.
    created.push("wav-audio-source");

    const withLock = async <T>(job: () => Promise<T>): Promise<T> => job();
    for (const [id, mode] of [["c1-s0", "silent"], ["c1-s1", "narrated"]] as const) {
      const manifest = manifestFor(id, mode, id + ".mp4");
      const { inputs } = await collectSceneInputsFromDiskV2(scope, manifest, withLock);
      const result = await probeSceneAvLockedV2(scope, manifest,
        { ffprobeBinary: ffprobeBin, timeoutMs: 15000 });
      assert(result.sha256 === inputs.video.sha256, "real MP4 digest mismatch: " + id);
      assert(result.epoch === inputs.video.epoch, "real MP4 file epoch mismatch: " + id);
      assert(result.sha256 === hash(await readFile(path.join(root, "previews", id + ".mp4"))),
        "MP4 bytes were not independently hashed: " + id);
      assert(result.width === 320 && result.height === 180, "wrong video dimensions");
      assert(result.durationSec > 0.8 && result.durationSec < 2.5, "wrong video duration");
      assert(result.hasAudio === (mode === "narrated"), "wrong actual MP4 audio flag");
      console.log("PASS", id, mode, "video=" + result.videoCodec,
        "audio=" + (result.audioCodec ?? "none"),
        "duration=" + result.durationSec.toFixed(2), "sha256=" + result.sha256.slice(0, 16));
    }
    // A video-only MP4 cannot be called voiced simply by changing its manifest.
    await expectReject("missing narration track", () =>
      probeSceneAvLockedV2(scope, manifestFor("c1-s0", "narrated", "c1-s0.mp4"),
        { ffprobeBinary: ffprobeBin }), /missing its audio track/);
    // An audio-only MP4 cannot pass as a video, even when audio exists.
    await expectReject("no video stream", () =>
      probeSceneAvLockedV2(scope, manifestFor("c1-s1", "narrated", "audio-only.mp4"),
        { ffprobeBinary: ffprobeBin }), /video stream/);
    await save("previews/not-mp4.mp4", "This is definitely not MP4.");
    await expectReject("invalid MP4 bytes", () =>
      probeSceneAvLockedV2(scope, manifestFor("c1-s1", "narrated", "not-mp4.mp4"),
        { ffprobeBinary: ffprobeBin }), /ffprobe failed|actual MP4 container/);
    console.log("PASS real ffmpeg + ffprobe smoke —", created.join(", "));
  } finally {
    // The random temp root is created by THIS run; never touch episode data.
    await rm(workspace, { recursive: true, force: true });
  }
};

const expectReject = async (
  label: string, work: () => Promise<unknown>, reason: RegExp,
) => {
  try { await work(); }
  catch (e) {
    if (reason.test(String(e))) {
      console.log("PASS rejected", label);
      return;
    }
    throw Error(label + " failed for unexpected reason: " + String(e));
  }
  throw Error("UNSAFE: " + label + " was accepted.");
};

await main().catch((error) => {
  console.error("FAILED Studio V2 real AV QA:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
