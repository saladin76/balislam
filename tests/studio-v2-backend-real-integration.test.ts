import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

describe("Studio V2 genuine FFmpeg Backend integration fixture", () => {
  it("runs real MP4 -> signed manifest -> signed review -> first approval -> next-scene gate", () => {
    // CI installs ffmpeg; absent binaries are an actual failure, never a silent skip.
    const executable = (name: string) => {
      const result = spawnSync("which", [name], { encoding: "utf8" });
      if (result.status !== 0 || !result.stdout.trim())
        throw Error(name + " is required for real integration acceptance.");
      return result.stdout.trim();
    };
    const program = path.resolve(import.meta.dirname, "studio-v2-backend-real-integration-smoke.ts");
    const run = spawnSync(process.execPath, ["--import", "tsx", program], {
      cwd: path.resolve(import.meta.dirname, ".."),
      encoding: "utf8", timeout: 60000,
      env: { ...process.env, STUDIO_FFMPEG_BIN: executable("ffmpeg"),
        STUDIO_FFPROBE_BIN: executable("ffprobe") },
    });
    expect(run.error, run.stderr).toBeUndefined();
    expect(run.status, run.stderr + "\n" + run.stdout).toBe(0);
    expect(run.stdout).toContain("PASS real Backend AV integration fixture");
  }, 70000);
});
