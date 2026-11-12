import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { verifyVideoEvidence } from "../src/studio/videoEvidence";

const roots: string[] = [];
const scratch = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "studio-video-evidence-"));
  roots.push(dir);
  return dir;
};
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

describe("human audiovisual approval cannot be based on a silent or undersized MP4", () => {
  it("accepts a genuine playable video with an audio track, and rejects a silent preview", async () => {
    const dir = await scratch();
    const full = path.join(dir, "av.mp4");
    const silent = path.join(dir, "silent.mp4");
    execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "color=c=black:s=320x180:d=1.5",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=1.5",
      "-shortest", "-c:v", "mpeg4", "-c:a", "aac", full]);
    const info = await verifyVideoEvidence(full, 320, 180);
    expect(info.audioTracks).toBeGreaterThan(0);
    expect(info.durationSeconds).toBeGreaterThan(1);
    await expect(verifyVideoEvidence(full, 3840, 2160)).rejects.toThrow(/resolution/);
    execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "color=c=black:s=320x180:d=1.5", "-an",
      "-c:v", "mpeg4", silent]);
    await expect(verifyVideoEvidence(silent)).rejects.toThrow(/audio track/);
  }, 25000);
});
