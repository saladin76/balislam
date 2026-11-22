/**
 * KI-123 (22 Nov): the assembly of «دفاتر الزمن 001» (47 cuts) was killed by macOS again (no ffmpeg message, ~0.84 GB) on the
 * owner's 8 GB Mac. The join now runs in bounded passes: the picture in chunks, the sound alone, then a light final pass.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JOIN_CHUNK_CUTS, planJoinChunks, runJoinPass, videoChain } from "../src/studio/assembleScenes";

const repo = path.resolve(import.meta.dirname, "..");

describe("KI-123: chunk plan of the join", () => {
  it("covers every cut exactly once, in order, with at most JOIN_CHUNK_CUTS per chunk", () => {
    for (const n of [1, 2, 7, 8, 9, 16, 17, 47, 120]) {
      const chunks = planJoinChunks(n);
      expect(chunks[0]![0]).toBe(0);
      expect(chunks[chunks.length - 1]![1]).toBe(n);
      for (let k = 0; k < chunks.length; k++) {
        const [a, b] = chunks[k]!;
        expect(b - a, `n=${n} chunk ${k}`).toBeGreaterThan(0);
        expect(b - a).toBeLessThanOrEqual(JOIN_CHUNK_CUTS);
        if (k) expect(a).toBe(chunks[k - 1]![1]);
      }
    }
    expect(planJoinChunks(0)).toEqual([]);
    // 47 cuts → 6 even chunks (7–8 cuts), never a tiny last chunk
    expect(planJoinChunks(47).map(([a, b]) => b - a)).toEqual([8, 8, 8, 7, 8, 8]);
  });

  it("joining by chunks gives the same seams as one chain: same dissolve and the same offset on the episode clock", () => {
    // 5 cuts, seams: dissolve, cut, dissolve, cut; chunks [0,2) [2,5) put a dissolve-free seam and a dissolve on the boundary
    const fps = 30, dur = [2, 3, 2.5, 2, 3], dis = [6, 0, 9, 0], ov = [6, 0, 9, 0];
    const starts = [0]; for (let i = 0; i < 4; i++) starts.push(starts[i]! + dur[i]! - ov[i]! / fps);
    const one = videoChain(5, (i) => dis[i - 1]!, (i) => starts[i]!, fps);
    const offsets = (g: string[]) => g.filter((x) => x.includes("xfade")).map((x) => /duration=([\d.]+):offset=([\d.]+)/.exec(x)!.slice(1).join("@"));
    for (const chunks of [[[0, 2], [2, 5]], [[0, 3], [3, 5]], [[0, 1], [1, 4], [4, 5]]] as [number, number][][]) {
      const inner = chunks.flatMap(([a, b]) => offsets(videoChain(b - a, (j) => dis[a + j - 1]!, (j) => starts[a + j]! - starts[a]!, fps))
        .map((x) => { const [d, o] = x.split("@"); return `${d}@${(Number(o) + starts[a]!).toFixed(6)}`; }));
      const outer = offsets(videoChain(chunks.length, (k) => dis[chunks[k]![0] - 1]!, (k) => starts[chunks[k]![0]]!, fps));
      expect([...inner, ...outer].sort()).toEqual(offsets(one).sort());
    }
  });

  it("every pass keeps the thread limits of KI-092/KI-122, and no single graph takes every cut's picture", () => {
    const s = readFileSync(path.join(repo, "src/studio/assembleScenes.ts"), "utf8");
    expect(s).toContain('...inputs.flatMap((file) => ["-threads", "1", "-i", file])');
    expect(s).toContain('"-filter_complex_threads", "1",');
    expect(s).toContain('const ONE_THREAD_X264 = ["-threads", "1", "-x264-params", "threads=1:lookahead-threads=1:rc-lookahead=10"];');
    expect(s.match(/\.\.\.ONE_THREAD_X264/g)?.length).toBe(2);
    expect(s).not.toContain('...cuts.flatMap((c) => ["-threads", "1", "-i", c.file])');
    expect(s).toMatch(/cuts\.slice\(a, b\)\.map\(\(c\) => c\.file\)/);
    expect(s).toMatch(/"-c:a", "pcm_s24le"/);
  });

  it("ffmpeg itself: two chunks joined with a dissolve on the boundary last exactly as long as one chain", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "ki123-"));
    const ff = (args: string[]) => execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    const probe = (f: string) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
    try {
      const fps = 30, dur = [1, 1.5, 1, 1.2], dis = [6, 0, 9];
      const files = dur.map((d, i) => { const f = path.join(dir, `c${i}.mp4`); ff(["-f", "lavfi", "-i", `testsrc=s=64x36:r=30:d=${d}`, "-pix_fmt", "yuv420p", f]); return f; });
      const starts = [0]; for (let i = 0; i < 3; i++) starts.push(starts[i]! + dur[i]! - dis[i]! / fps);
      const inputs = (n: number) => Array.from({ length: n }, (_, i) => `[${i}:v:0]settb=AVTB,fps=${fps},format=yuv420p,setsar=1[v${i}]`);
      const enc = (out: string) => ["-map", "[vout]", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "10", "-pix_fmt", "yuv420p", "-an", "-y", out];
      const run = async () => {
        const whole = path.join(dir, "whole.mkv");
        await runJoinPass(path.join(dir, "whole.filter"), [...inputs(4), ...videoChain(4, (i) => dis[i - 1]!, (i) => starts[i]!, fps)], files, enc(whole));
        const chunks: [number, number][] = [[0, 2], [2, 4]];
        const parts: string[] = [];
        for (const [k, [a, b]] of chunks.entries()) {
          const p = path.join(dir, `p${k}.mkv`);
          await runJoinPass(path.join(dir, `p${k}.filter`), [...inputs(b - a), ...videoChain(b - a, (j) => dis[a + j - 1]!, (j) => starts[a + j]! - starts[a]!, fps)], files.slice(a, b), enc(p));
          parts.push(p);
        }
        const joined = path.join(dir, "joined.mkv");
        await runJoinPass(path.join(dir, "joined.filter"), [...inputs(2), ...videoChain(2, (k) => dis[chunks[k]![0] - 1]!, (k) => starts[chunks[k]![0]]!, fps)], parts, enc(joined));
        return [probe(whole), probe(joined)];
      };
      return run().then(([whole, joined]) => {
        expect(Math.abs(joined! - whole!)).toBeLessThan(1.01 / fps);
        expect(Math.abs(whole! - (starts[3]! + dur[3]!))).toBeLessThan(1.01 / fps);
      }).finally(() => rmSync(dir, { recursive: true, force: true }));
    } catch (e) { rmSync(dir, { recursive: true, force: true }); throw e; }
  }, 60_000);
});
