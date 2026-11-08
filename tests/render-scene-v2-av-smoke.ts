/**
 * Opt-in ACTUAL Remotion -> MP4 -> FFprobe/FFmpeg smoke for Mac/CI.
 * No production episodes and no fabricated Quran audio. The optional sine
 * wave is solely a signal-processing test fixture, NOT human narration.
 *
 * STUDIO_V2_REAL_RENDER=1 STUDIO_FFMPEG_BIN=/usr/bin/ffmpeg \
 * STUDIO_FFPROBE_BIN=/usr/bin/ffprobe npx --no-install tsx tests/render-scene-v2-av-smoke.ts
 */
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readdir, readFile, rm, stat, statfs, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import samplePlan from "./fixtures/plan.json";
import { renderSceneV2, type SceneRenderRequestV2 } from "../src/render/sceneV2";
import { probeMedia } from "../src/render/sceneV2Probe";
import { memoryInfo } from "../src/render/pool";
import type { Plan } from "../src/plan/types";

if (process.env.STUDIO_V2_REAL_RENDER !== "1") {
  console.log("SKIP actual Studio V2 Remotion smoke (set STUDIO_V2_REAL_RENDER=1).");
} else {
  const ffmpeg = process.env.STUDIO_FFMPEG_BIN;
  const ffprobe = process.env.STUDIO_FFPROBE_BIN;
  assert(ffmpeg && path.isAbsolute(ffmpeg), "Absolute STUDIO_FFMPEG_BIN is required.");
  assert(ffprobe && path.isAbsolute(ffprobe), "Absolute STUDIO_FFPROBE_BIN is required.");
  assert(memoryInfo().availableMB >= 1800, "Insufficient memory: real render intentionally blocked.");
  const qaWidth = Number(process.env.STUDIO_V2_QA_WIDTH ?? 640);
  const qaHeight = Number(process.env.STUDIO_V2_QA_HEIGHT ?? 360);
  assert([640, 1280, 1920].includes(qaWidth) && qaHeight === qaWidth * 9 / 16,
    "Only safe 16:9 QA test dimensions are allowed.");
  const workspace = await mkdtemp(path.join(os.tmpdir(), "studio-v2-render-real-"));
  const diskStart = await statfs(workspace);
  const workspaceDiskBeforeMB = diskStart.bavail * diskStart.bsize / (1024 * 1024);
  const qaStartTime = Date.now();
  const episodeRoot = path.join(workspace, "balislam", "episodes", "001-render-qa");
  const run = (args: string[]) => new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpeg, ["-hide_banner", "-nostdin", "-loglevel", "error", "-y", ...args], {
      shell: false, stdio: ["ignore", "ignore", "pipe"],
    });
    let error = "";
    const timer = setTimeout(() => p.kill("SIGKILL"), 30000);
    p.stderr?.on("data", (x: Buffer) => { error += x.toString("utf8"); });
    p.on("error", reject);
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(); else reject(Error("ffmpeg failed: " + error.slice(0, 600)));
    });
  });
  const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
  try {
    await mkdir(path.join(episodeRoot, "voice"), { recursive: true });
    const wave = path.join(episodeRoot, "voice", "synthetic-qa-only.wav");
    await run(["-f", "lavfi", "-i", "sine=frequency=623:sample_rate=48000:duration=2",
      "-c:a", "pcm_s16le", wave]);
    for (const mode of ["silent", "narrated"] as const) {
      const scene = {
        ...samplePlan.chapters[0]!.scenes[0]!,
        id: "c1-s0", template: "big-question", props: { question: "اِخْتِبَارُ سَلَامَةِ الْحُرُوفِ الْعَرَبِيَّةِ" },
        narration: mode === "narrated" ? "اختبار" : "",
        durationSec: 2, sfx: [],
      };
      const plan: Plan = {
        ...samplePlan, version: 1, episode: "001", channel: "balislam",
        intro: false, chapters: [{ ...samplePlan.chapters[0]!, number: 1, scenes: [scene] }],
      } as Plan;
      const bytes = Buffer.from(JSON.stringify(plan));
      await writeFile(path.join(episodeRoot, "plan.json"), bytes);
      const sound = { kind: "narrator" as const, file: wave,
        sha256: hash(await readFile(wave)), startSec: 0, durationSec: 2,
        volume: 1, words: [{ word: "اختبار", start: 0, end: 1.7 }] };
      const req: SceneRenderRequestV2 = {
        channelsRoot: workspace, channel: "balislam", episode: "001-render-qa",
        sceneId: "c1-s0", planSha256: hash(bytes), orientation: "landscape",
        mode, width: qaWidth, height: qaHeight, fps: 30, durationSec: 2,
        sounds: mode === "narrated" ? [sound] : [], pictures: [],
      };
      const result = await renderSceneV2(req, {
        ffprobeBinary: ffprobe,
        browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE,
        withArtifactLock: async (job) => job(),
        withProductionLease: async (_, job) => job(),
        assertCanRender: async () => { /* isolated QA plan; no owner approvals are simulated */ },
      });
      assert(result.status === "succeeded", JSON.stringify(result));
      assert((await stat(result.file)).size > 500);
      assert.equal(hash(await readFile(result.file)), result.sha256);
      const streams = await probeMedia(ffprobe, result.file, true, 60000);
      assert.equal(streams.video.width, qaWidth);
      assert.equal(streams.video.height, qaHeight);
      assert.equal(streams.video.fps, 30);
      assert.equal(streams.video.frames, 60);
      assert.equal(streams.video.codec, "h264");
      assert.equal(streams.audio.length, mode === "narrated" ? 1 : 0);
      if (mode === "narrated") assert.equal(streams.audio[0]?.codec, "aac");
      await run(["-i", result.file, "-f", "null", "-"]);
      const still = path.join(episodeRoot, mode + ".png");
      await run(["-ss", "1", "-i", result.file, "-frames:v", "1", still]);
      assert((await stat(still)).size > 1000);
      const early = path.join(episodeRoot, mode + "-early.png");
      await run(["-ss", "0.10", "-i", result.file, "-frames:v", "1", early]);
      const earlySha256 = hash(await readFile(early));
      const middleSha256 = hash(await readFile(still));
      assert.notEqual(earlySha256, middleSha256,
        "Real Remotion frame at 0.10s and 1.00s must visibly change.");
      const stageRoot = path.resolve("public", "_studio_v2");
      const tempRoot = path.join(episodeRoot, ".studio-v2-render");
      assert.equal((await readdir(tempRoot)).length, 0, "Render temp should be empty.");
      assert.equal((await readdir(stageRoot)).length, 0, "Owned public staging should be empty.");
      if (mode === "narrated") {
        assert(streams.audio[0]!.startSec <= 0.1,
          "Technical signal must start near video time 0.");
      }
      const record = { mode, composition: "studio-v2-scene", status: result.status,
        dimensions: qaWidth + "x" + qaHeight, durationSec: result.durationSec, fps: result.fps,
        frames: result.frames, videoCodec: result.videoCodec,
        audioCodecs: result.audioCodecs, audioStreams: result.audioStreams,
        sha256: result.sha256, bytes: result.bytes, elapsedMs: result.elapsedMs,
        memoryAvailableBeforeMB: result.memoryAvailableBeforeMB,
        memoryAvailableMinMB: result.memoryAvailableMinMB,
        diskFreeBeforeMB: result.diskFreeBeforeMB,
        diskFreeAfterMB: result.diskFreeAfterMB,
        extractedFrameSha256: middleSha256, earlyFrameSha256: earlySha256,
        motionDifferentFrames: true, fullDecode: true, stagingClean: true,
        reviewStatus: result.reviewStatus,
        audioStartSec: streams.audio[0]?.startSec ?? null,
      };
      console.log("STUDIO_V2_ACTUAL_REMOTION_EVIDENCE " + JSON.stringify(record));
      if (process.env.STUDIO_V2_QA_EMBED_EVIDENCE === "1") {
        console.log("STUDIO_V2_QA_BINARY_BEGIN " + JSON.stringify({
          mode, media: [
            { name: mode + ".mp4", contentType: "video/mp4",
              sha256: result.sha256, base64: (await readFile(result.file)).toString("base64") },
            { name: mode + ".png", contentType: "image/png",
              sha256: middleSha256, base64: (await readFile(still)).toString("base64") },
            { name: mode + "-early.png", contentType: "image/png",
              sha256: earlySha256, base64: (await readFile(early)).toString("base64") },
          ],
        }) + " STUDIO_V2_QA_BINARY_END");
      }
    }
    // Cancellation is an actual state transition, never a completed owner review.
    const controller = new AbortController();
    controller.abort();
    const cancel = await renderSceneV2({
      channelsRoot: workspace, channel: "balislam", episode: "001-render-qa",
      sceneId: "c1-s0", planSha256: "a".repeat(64),
      mode: "silent", orientation: "landscape", width: qaWidth, height: qaHeight, fps: 30,
      durationSec: 2, sounds: [], pictures: [],
    }, {
      ffprobeBinary: ffprobe, signal: controller.signal,
      withArtifactLock: async (job) => job(),
      withProductionLease: async (_, job) => job(),
      assertCanRender: async () => {},
    });
    assert.equal(cancel.status, "cancelled");
    const diskEnd = await statfs(workspace);
    console.log("STUDIO_V2_QA_RESOURCES " + JSON.stringify({
      workspaceDiskBeforeMB,
      workspaceDiskAfterMB: diskEnd.bavail * diskEnd.bsize / (1024 * 1024),
      qaElapsedMs: Date.now() - qaStartTime,
    }));
    console.log("PASS Studio V2 real AV smoke and pre-aborted cancellation.");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
