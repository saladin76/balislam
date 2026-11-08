/**
 * Real Remotion CI acceptance probe, intentionally enabled only for the
 * dedicated Draft PR #86 branch. Ordinary CI/main and local npm test remain
 * fast; the standalone smoke can also be invoked with STUDIO_V2_REAL_RENDER=1.
 *
 * This invokes the ACTUAL studio-v2-scene renderer, not an FFmpeg-only fixture.
 */
import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const authorizedPrSmoke = process.env.GITHUB_ACTIONS === "true" &&
  process.env.GITHUB_HEAD_REF === "work/studio-v2-render-20261108";

describe("Studio V2 real Remotion QA — dedicated PR branch only", () => {
  it.skipIf(!authorizedPrSmoke)(
    "renders real silent and technical-tone MP4 and fully decodes both",
    async () => {
      const ffmpeg = "/usr/bin/ffmpeg";
      const ffprobe = "/usr/bin/ffprobe";
      expect(existsSync(ffmpeg), "Linux CI FFmpeg must be installed").toBe(true);
      expect(existsSync(ffprobe), "Linux CI FFprobe must be installed").toBe(true);
      const chrome = ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]
        .find((binary) => existsSync(binary));
      const env = {
        ...process.env,
        STUDIO_V2_REAL_RENDER: "1",
        STUDIO_V2_QA_EMBED_EVIDENCE: "1",
        STUDIO_FFMPEG_BIN: ffmpeg,
        STUDIO_FFPROBE_BIN: ffprobe,
        ...(chrome ? { REMOTION_BROWSER_EXECUTABLE: chrome } : {}),
      };
      const { code, out, err } = await new Promise<{code: number | null;out: string;err: string}>(
        (resolve, reject) => {
          const child = spawn("npx", ["--no-install", "tsx",
            "tests/render-scene-v2-av-smoke.ts"], {
            cwd: path.resolve("."), env, stdio: ["ignore", "pipe", "pipe"], shell: false,
          });
          let out = "", err = "";
          child.stdout.on("data", (b: Buffer) => { out += b.toString(); });
          child.stderr.on("data", (b: Buffer) => { err += b.toString(); });
          child.once("error", reject);
          child.once("close", (code) => resolve({ code, out, err }));
        },
      );
      console.log("STUDIO_V2_REMOTION_REAL_QA_STDOUT_BEGIN\n" + out +
        "\nSTUDIO_V2_REMOTION_REAL_QA_STDOUT_END");
      if (err) console.log("STUDIO_V2_REMOTION_REAL_QA_STDERR\n" + err.slice(-8000));
      expect(code, "Real Remotion smoke must exit 0").toBe(0);
      expect(out).toContain('"mode":"silent"');
      expect(out).toContain('"mode":"narrated"');
      expect(out).toContain("PASS Studio V2 real AV smoke");
    }, 300_000,
  );
});
