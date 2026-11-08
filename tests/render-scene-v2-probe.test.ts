/**
 * Fast, REAL FFmpeg/FFprobe integration test (no Chromium or production files).
 * This verifies the V2 probe against actual MP4 bytes and actual audio streams.
 * A generated sine is solely a technical test signal, never Quran or narration.
 */
import { describe, it, expect } from "vitest";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { probeMedia } from "../src/render/sceneV2Probe";

const binary = (name: string) => {
  try { return execFileSync("which", [name], { encoding: "utf8", timeout: 2000 }).trim(); }
  catch { return null; }
};

describe("Studio V2 FFprobe, real media bytes", () => {
  it("inspects exactly 30 encoded frames and a real AAC audio track", async () => {
    const ffmpeg = binary("ffmpeg");
    const ffprobe = binary("ffprobe");
    if (!ffmpeg || !ffprobe) return; // portable for local dev without FFmpeg
    const root = await mkdtemp(path.join(os.tmpdir(), "studio-v2-probe-"));
    const output = path.join(root, "technical-qa.mp4");
    try {
      await new Promise<void>((resolve, reject) => {
        const args = [
          "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
          "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30:duration=1",
          "-f", "lavfi", "-i", "sine=frequency=550:sample_rate=48000:duration=1",
          "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "96k", "-shortest", output,
        ];
        const child = spawn(ffmpeg, args, { shell: false, stdio: ["ignore", "ignore", "pipe"] });
        let err = "";
        const timeout = setTimeout(() => child.kill("SIGKILL"), 15000);
        child.stderr?.on("data", (b: Buffer) => { err += b.toString("utf8"); });
        child.on("error", reject);
        child.on("close", (code) => {
          clearTimeout(timeout);
          code === 0 ? resolve() : reject(Error("ffmpeg QA failed: " + err.slice(0, 600)));
        });
      });
      const inspected = await probeMedia(ffprobe, output, true);
      expect(inspected.video).toMatchObject({
        codec: "h264", width: 320, height: 180, fps: 30, frames: 30,
      });
      expect(inspected.audio.length).toBe(1);
      expect(inspected.audio[0]).toMatchObject({ codec: "aac", sampleRate: 48000 });
      expect(inspected.durationSec).toBeGreaterThanOrEqual(0.95);
      expect(inspected.durationSec).toBeLessThan(1.1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 25000);
});
