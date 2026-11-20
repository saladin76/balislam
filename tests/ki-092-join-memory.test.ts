import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// KI-092 (owner, 20 Nov): the pre-final join of «دفاتر الزمن 001» (47 cuts, 1080p) was SIGKILLed by macOS on an 8 GB Mac.
describe("KI-092: the join opens every scene with one decoder thread", () => {
  it("passes -threads 1 before each scene input, so memory grows with the scenes, not scenes × cores", () => {
    const s = readFileSync(path.join(import.meta.dirname, "..", "src/studio/assembleScenes.ts"), "utf8");
    expect(s).toContain('...cuts.flatMap((c) => ["-threads", "1", "-i", c.file])');
    expect(s).not.toContain('...cuts.flatMap((c) => ["-i", c.file])');
  });
});
