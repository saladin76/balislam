/**
 * D105 (review of PR #97, finding 2): the shared trim used by the sentence stitcher (D50) clamps a bounded
 * overshoot of the word timings past the decoded file, with a warning, and refuses only clearly corrupt timings.
 * `bal voice-timing` measures the local recordings with the same rule. The takes here are made with ffmpeg in a
 * temporary folder; nothing is generated, sent or written next to real recordings.
 */
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ALIGNMENT_OVERSHOOT_MAX_SEC, AlignmentCorruptError, alignmentVerdict, safeTrim } from "../src/remotion/dafatir/audio/trim";
import { measurePart } from "../src/voice/dafatirParts";
import { checkVoiceTimings, ffmpegDuration, formatTimingReport, summarize } from "../src/voice/timingCheck";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
let root = "";
const ffmpeg = (args: string[]) => {
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...args]);
  if (r.status !== 0) throw new Error(String(r.stderr));
};
const tone = (file: string, seconds: number, rate = 44100, extra: string[] = []) =>
  ffmpeg(["-f", "lavfi", "-i", `sine=frequency=300:duration=${seconds}:sample_rate=${rate}`, "-c:a", "libmp3lame", "-b:a", "128k", ...extra, file]);
const words = (end: number, start = 0.05) => [{ word: "أ", start, end: (start + end) / 2 }, { word: "ب", start: (start + end) / 2, end }];

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "voice-timing-"));
}, 60_000);
afterAll(async () => { if (root) await rm(root, { recursive: true, force: true }); });

describe("the stitcher's alignment rule", () => {
  const b = { duration: 1, start: 0.04, end: 1, speechStart: 0.1, speechEnd: 0.9, floorDb: -80, peakDb: -5 };
  it("clamps a bounded overshoot into the file and warns once, never speechEnd > end > duration", () => {
    const warn = vi.fn();
    for (const end of [1.001, 1.07, 1 + ALIGNMENT_OVERSHOOT_MAX_SEC]) {
      const r = safeTrim(b, { start: [0.1], end: [end] }, {}, warn);
      expect(r.speechEnd).toBe(1);
      expect(r.speechEnd).toBeLessThanOrEqual(r.end);
      expect(r.end).toBeLessThanOrEqual(r.duration);
    }
    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn.mock.calls[1]![0].overshootEndSec).toBeCloseTo(0.07, 6);
    const early = safeTrim(b, { start: [-0.05], end: [0.9] }, {}, warn);
    expect(early.speechStart).toBe(0);
    expect(early.start).toBe(0);
  });
  it("slightly overlapping or reordered words are not corruption", () => {
    const warn = vi.fn();
    const r = safeTrim(b, { start: [0.4, 0.38, 0.6], end: [0.5, 0.49, 0.8] }, {}, warn);
    expect(r).toEqual(b);
    expect(warn.mock.calls[0]![0].disorder).toBeGreaterThan(0);
  });
  it.each([
    [{ start: [0.1], end: [1 + ALIGNMENT_OVERSHOOT_MAX_SEC + 0.01] }, "يتجاوز"],
    [{ start: [-0.3], end: [0.9] }, "يتجاوز"],
    [{ start: [0.1], end: [NaN] }, "غير رقمي"],
    [{ start: [0.1], end: [] }, "عدد"],
    [{ start: [0.8], end: [0.2] }, "تبدأ"],
  ])("refuses clearly corrupt timings with a recovery instruction (%j)", (alignment, reason) => {
    expect(() => safeTrim(b, alignment, {}, () => {})).toThrow(AlignmentCorruptError);
    expect(() => safeTrim(b, alignment, {}, () => {})).toThrow(new RegExp(`دون توليد جديد.*${reason}`));
  });
  it("the measurement fallback without silence clamps captions too", () => {
    const samples = new Float32Array(44100).fill(0.3);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = measurePart("existing", samples, 44100, [{ word: "تجربة", start: 0.1, end: 1.12 }]);
    expect(r.clip.speechEnd).toBe(1);
    expect(r.words[0]!.end).toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("الجزء existing"));
    warn.mockRestore();
  });
  it("the verdict is the same function the measurement uses", () => {
    expect(alignmentVerdict(1, { start: [0], end: [1] })).toEqual({ kind: "ok" });
    expect(alignmentVerdict(1, { start: [0], end: [1.1] }).kind).toBe("clamped");
    expect(alignmentVerdict(1, { start: [0], end: [1.2] }).kind).toBe("corrupt");
  });
});

describe.skipIf(!hasFfmpeg)("bal voice-timing over ffmpeg-made takes", { timeout: 120_000 }, () => {
  it("decoded MP3 length: what the 150 ms limit is measured against", async () => {
    const lame = path.join(root, "lame.mp3"), bare = path.join(root, "bare.mp3"), low = path.join(root, "low.mp3");
    tone(lame, 1); tone(bare, 1, 44100, ["-write_xing", "0"]); tone(low, 1, 22050);
    // Gapless (LAME header) decodes to the spoken length; without it the padding stays in the file. Either way the
    // decoded file is never shorter than the speech, and the declared MP3 length runs at most ~71 ms past it.
    expect(await ffmpegDuration(lame, 44100)).toBeCloseTo(1, 3);
    expect(await ffmpegDuration(low, 44100)).toBeCloseTo(1, 3);
    const padded = await ffmpegDuration(bare, 44100);
    expect(padded).toBeGreaterThanOrEqual(1);
    expect(padded - 1).toBeLessThan(ALIGNMENT_OVERSHOOT_MAX_SEC);
  });

  it("classifies sentences, takes and parts, lists missing files, and writes nothing", async () => {
    const chs = path.join(root, "channels");
    const ep = path.join(chs, "test-ch", "episodes", "991-timing");
    const sdir = path.join(ep, "voice", "sentences");
    const pdir = path.join(ep, "voice", "parts");
    await mkdir(sdir, { recursive: true }); await mkdir(pdir, { recursive: true });
    await writeFile(path.join(ep, "script.md"), "---\ntitle: \"قياس\"\nepisode: \"991\"\n---\nنص.\n");
    for (const f of ["ok", "drift", "far", "early", "nan", "inverted", "old"]) tone(path.join(sdir, `${f}.mp3`), 1);
    tone(path.join(pdir, "p1.mp3"), 0.8, 24000);
    await writeFile(path.join(sdir, "broken.mp3"), "not audio");
    const audio = (file: string, w: unknown[]) => ({ file, fingerprint: "x", context: "", duration: 1, words: w, at: "2026-11-12T00:00:00Z" });
    const doc = { version: 1, scenes: { "c1-s1": { createdAt: "2026-11-12T00:00:00Z", import: { state: "none" }, sentences: [
      { id: "s1", sceneId: "c1-s1", kind: "narration", text: "أ ب", pauseAfterMs: 0, audio: audio("ok.mp3", words(0.95)), takes: [audio("old.mp3", words(1.4))] },
      { id: "s2", sceneId: "c1-s1", kind: "narration", text: "أ ب", pauseAfterMs: 0, audio: audio("drift.mp3", words(1.06)) },
      { id: "s3", sceneId: "c1-s1", kind: "narration", text: "أ ب", pauseAfterMs: 0, audio: audio("far.mp3", words(1.5)) },
      { id: "s4", sceneId: "c1-s1", kind: "narration", text: "أ ب", pauseAfterMs: 0, audio: audio("early.mp3", words(0.9, -0.04)) },
      { id: "s5", sceneId: "c1-s1", kind: "narration", text: "أ ب", pauseAfterMs: 0, audio: audio("nan.mp3", [{ word: "أ", start: 0.1, end: null }]) },
      { id: "s6", sceneId: "c1-s1", kind: "narration", text: "أ ب", pauseAfterMs: 0, audio: audio("inverted.mp3", [{ word: "أ", start: 0.9, end: 0.2 }]) },
      { id: "s7", sceneId: "c1-s1", kind: "narration", text: "أ ب", pauseAfterMs: 0, audio: audio("gone.mp3", words(0.9)) },
      { id: "s8", sceneId: "c1-s1", kind: "narration", text: "أ ب", pauseAfterMs: 0, audio: audio("broken.mp3", words(0.9)) },
      { id: "s9", sceneId: "c1-s1", kind: "narration", text: "أ ب", pauseAfterMs: 0, audio: audio("ok.mp3", []) },
    ] } } };
    const sentencesFile = path.join(ep, "voice", "sentences.json");
    await writeFile(sentencesFile, JSON.stringify(doc));
    await writeFile(path.join(pdir, "index.json"), JSON.stringify({ "c1-s1-p1": { file: "p1.mp3", hash: "h", text: "أ", duration: 0.8, words: words(0.82) } }));
    const before = await readFile(sentencesFile, "utf8");

    const r = await checkVoiceTimings({ channelsDir: chs, channels: ["test-ch"], takes: true });
    const by = Object.fromEntries(r.rows.map((x) => [`${x.kind}:${x.id}:${x.file}`, x]));
    expect(by["sentence:s1:ok.mp3"]!.verdict).toBe("ok");
    expect(by["take:s1:old.mp3"]!.verdict).toBe("corrupt");
    expect(by["sentence:s2:drift.mp3"]).toMatchObject({ verdict: "clamped", overshootEndMs: 60 });
    expect(by["sentence:s3:far.mp3"]).toMatchObject({ verdict: "corrupt", overshootEndMs: 500 });
    expect(by["sentence:s4:early.mp3"]).toMatchObject({ verdict: "clamped", undershootStartMs: 40 });
    expect(by["sentence:s5:nan.mp3"]!.verdict).toBe("corrupt");
    expect(by["sentence:s6:inverted.mp3"]!.verdict).toBe("corrupt");
    expect(by["sentence:s7:gone.mp3"]!.verdict).toBe("missing");
    expect(by["sentence:s8:broken.mp3"]!.verdict).toBe("unreadable");
    expect(by["sentence:s9:ok.mp3"]!.verdict).toBe("no-words");
    expect(by["part:c1-s1-p1:p1.mp3"]).toMatchObject({ verdict: "clamped", overshootEndMs: 20 });
    expect(r.summary).toMatchObject({ limitMs: 150, files: 11, counts: { ok: 1, clamped: 3, corrupt: 4, missing: 1, unreadable: 1, "no-words": 1 } });
    expect(r.summary.overshootMs.max).toBe(500);
    // Without --takes the older take is not read; one episode can be named.
    expect((await checkVoiceTimings({ channelsDir: chs, channels: ["test-ch"], episode: "991" })).rows.some((x) => x.kind === "take")).toBe(false);
    expect((await checkVoiceTimings({ channelsDir: chs, channels: ["test-ch"], episode: "992" })).rows).toEqual([]);
    const text = formatTimingReport(r);
    expect(text).toContain("الحد الحالي: 150 م.ث");
    expect(text).toContain("far.mp3");
    expect(text).not.toContain("(ok.mp3)");
    // Measurement only.
    expect(await readFile(sentencesFile, "utf8")).toBe(before);
  });

  it("an empty computer reports zero files", () => {
    expect(summarize([])).toMatchObject({ files: 0, overshootMs: { max: 0, p50: 0, p95: 0, p99: 0 } });
  });
});
