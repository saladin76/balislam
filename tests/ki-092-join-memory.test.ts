import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// KI-092 (owner, 20 Nov): the pre-final join of «دفاتر الزمن 001» (47 cuts, 1080p) was SIGKILLed by macOS on an 8 GB Mac.
describe("KI-092: the join opens every scene with one decoder thread", () => {
  it("passes -threads 1 before each scene input, so memory grows with the scenes, not scenes × cores", () => {
    const s = readFileSync(path.join(import.meta.dirname, "..", "src/studio/assembleScenes.ts"), "utf8");
    // KI-123: every pass of the join goes through runJoinPass, which puts -threads 1 before each input
    expect(s).toContain('...inputs.flatMap((file) => ["-threads", "1", "-i", file])');
    expect(s).not.toContain('flatMap((c) => ["-i", c.file])');
    expect(s).not.toContain('flatMap((file) => ["-i", file])');
  });
});

// KI-122 (owner, 22 Nov): the same join was SIGKILLed again (exit -9 at ~1.3 GB) with 47 cuts; single-threaded filter graph and
// encoder finished it at 933 MB on the owner's Mac.
describe("KI-122: the join's filter graph and encoder run on one thread", () => {
  it("passes -filter_complex_threads 1 and a one-thread x264 with a short look-ahead", () => {
    const s = readFileSync(path.join(import.meta.dirname, "..", "src/studio/assembleScenes.ts"), "utf8");
    expect(s).toContain('"-filter_complex_threads", "1",');
    expect(s).toContain('["-threads", "1", "-x264-params", "threads=1:lookahead-threads=1:rc-lookahead=10"]');
  });
});
