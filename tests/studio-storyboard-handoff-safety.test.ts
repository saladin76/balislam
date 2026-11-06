import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
const script = readFileSync(path.join(import.meta.dirname, "..", "scripts", "handoff-storyboard.sh"), "utf8");

describe("storyboard-only handoff safety contract", () => {
  it("defaults to read-only check and requires explicit upload mode", () => {
    expect(script).toContain('MODE="${1:-check}"');
    expect(script).toContain('"$MODE" == "upload"');
    expect(script).toContain('SOURCE_ROOT=""');
  });
  it("targets only existing Dafatir V1 and V1.1 storyboard source files", () => {
    expect(script).toContain("storyboard-001-v1.pdf");
    expect(script).toContain("storyboard-001-v1.json");
    expect(script).toContain("storyboard-001-v1.1.pdf");
    expect(script).toContain("storyboard-001-v1.1.json");
    expect(script).toContain("1wiFhT_4u98hLMpJQQwk1TUvNft54pMbp");
    expect(script).not.toMatch(/\bpreview[s]?\/episode\.mp4|\b--kind video|\bvoice\/|\brender\b/i);
  });
  it("checks the existence of all 4 sources before any upload is permitted", () => {
    const preflight = script.indexOf("# Preflight the ENTIRE versioned source batch");
    const remoteWrite = script.indexOf('rclone copyto "$SOURCE" "$TARGET"');
    expect(preflight).toBeGreaterThan(-1);
    expect(remoteWrite).toBeGreaterThan(preflight);
    expect(script.slice(preflight, remoteWrite)).toContain("PRECHECK_FAILED");
  });
  it("never truncates an old delivery log or overwrites remote version slots", () => {
    expect(script).toContain('>> "$LOG"');
    expect(script).toContain('--ignore-existing');
    expect(script).toContain('REFUSED: remote version exists with DIFFERENT bytes');
    expect(script).toContain('FAILED_MISMATCH');
    expect(script).not.toContain(': > "$LOG"');
    expect(script).not.toContain("git push");
    expect(script).not.toContain("git reset");
  });
  it("verifies the remote MD5 and obtains real file ID without making Google Drive files public", () => {
    expect(script).toContain('CLOUD_MD5="$(rclone md5sum');
    expect(script).toContain('rclone lsjson "$TARGET"');
    expect(script).not.toContain('rclone link');
  });
});
