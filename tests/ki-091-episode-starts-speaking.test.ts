import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { HEAD_AIR, headTrimFor, leadingSilence } from "../src/studio/assembleScenes";

// KI-091 (owner, 20 Nov): «دفاتر الزمن 001» opened on 3.5 s of silence; D155 says the video starts with its content.
const dir = mkdtempSync(path.join(os.tmpdir(), "head-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const ff = (args: string[]) => execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args]);
const probe = (f: string, s: string) => Number(execFileSync("ffprobe", ["-v", "error", "-select_streams", s, "-show_entries", "stream=duration", "-of", "csv=p=0", f]).toString().trim());

describe("KI-091: an episode starts speaking", () => {
  it("trims only a real silence, and keeps a breath of air before the first word", () => {
    expect(headTrimFor(0)).toBe(0);
    expect(headTrimFor(0.5)).toBe(0);
    expect(headTrimFor(3.52)).toBeCloseTo(3.52 - HEAD_AIR, 3);
  });
  it("measures the silence before the first word, and the trim keeps picture and sound together", async () => {
    const src = path.join(dir, "first.mp4");
    ff(["-f", "lavfi", "-i", "testsrc2=d=8:s=160x90:r=30", "-f", "lavfi", "-i", "sine=d=4.5", "-filter_complex", "[1]adelay=3500:all=1,apad=whole_dur=8[a]", "-map", "0:v", "-map", "[a]", "-t", "8", src]);
    const silence = await leadingSilence(src);
    expect(silence).toBeGreaterThan(3.3);
    expect(silence).toBeLessThan(3.7);
    const head = headTrimFor(silence);
    const out = path.join(dir, "trimmed.mp4");
    ff(["-i", src, "-filter_complex", `[0:v]trim=start=${head},setpts=PTS-STARTPTS[v];[0:a]atrim=start=${head},asetpts=PTS-STARTPTS[a]`, "-map", "[v]", "-map", "[a]", out]);
    expect(await leadingSilence(out)).toBeLessThan(HEAD_AIR + 0.15);
    expect(Math.abs(probe(out, "v:0") - probe(out, "a:0"))).toBeLessThan(0.05);
    expect(probe(out, "v:0")).toBeCloseTo(8 - head, 1);
  });
});
