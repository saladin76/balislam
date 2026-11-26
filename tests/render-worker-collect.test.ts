import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { importVerified, verifyWorkerOutput, type CollectDeps, type SubmittedRecord, type VerifyInput } from "../src/render/worker/macSide";
import { parseProbe, type VideoProbe } from "../src/render/worker/probe";
import { planSha256, validateJob, type WorkerJob, type WorkerResult } from "../src/render/worker/protocol";

const HASH = "0123456789abcdef01234567";
const plan = { episode: "001", title: "حلقة", chapters: [{ number: 1, title: "", scenes: [{ id: "s1", narration: "نص" }] }] };
const job = validateJob({
  version: 1, id: "balislam-001-short-1-abcdef012345", channel: "balislam", episode: "001-know-the-truth", kind: "short", n: 1,
  segment: { sceneIds: ["s1"] }, shortTitle: "سؤال", commit: "a".repeat(40), quality: "master",
  media: `render-queue/media/balislam/001-know-the-truth/${HASH}`, expected: { durationSec: 42.5, width: 2160, height: 3840 },
  inputs: { planSha256: planSha256(plan), plan, media: { mode: "static", base: `_render/balislam/001-know-the-truth/${HASH}/`, voice: {}, sfx: [], recitations: {} }, narrationGain: {} },
  createdAt: "2026-11-26T10:00:00.000Z",
});
const record: SubmittedRecord = { id: job.id, n: 1, segment: { sceneIds: ["s1"] }, commit: job.commit, expected: job.expected, shortTitle: "سؤال",
  planSha256: job.inputs.planSha256, mediaBase: job.inputs.media.base, submittedAt: job.createdAt };
const result: WorkerResult = { id: job.id, sha256: "f".repeat(64), bytes: 1000, durationSec: 42.5, width: 2160, height: 3840, commit: job.commit, worker: "Salah", startedAt: "", finishedAt: "", logTail: "" };
const probe: VideoProbe = { videoCodec: "h264", width: 2160, height: 3840, audioCodec: "aac", durationSec: 42.53, tags: ["title=حلقة", "artist=بالإسلام", "handler_name=VideoHandler"] };
const good = (): VerifyInput => ({
  job, result, record, current: { planSha256: job.inputs.planSha256, mediaBase: job.inputs.media.base, segment: { sceneIds: ["s1"] }, shortTitle: "سؤال" },
  fileSha256: result.sha256, fileBytes: 1000, probe,
});

describe("D226 worker-collect verification (nothing unverified is imported)", () => {
  it("accepts a matching result", () => expect(verifyWorkerOutput(good())).toEqual([]));
  it("refuses a sha256 or size mismatch", () => {
    expect(verifyWorkerOutput({ ...good(), fileSha256: "e".repeat(64) }).join()).toMatch(/بصمة الفيديو/);
    expect(verifyWorkerOutput({ ...good(), fileBytes: 999 }).join()).toMatch(/حجم/);
  });
  it("refuses a duration outside ±0.1 s", () => {
    expect(verifyWorkerOutput({ ...good(), probe: { ...probe, durationSec: 42.65 } }).join()).toMatch(/المدة/);
    expect(verifyWorkerOutput({ ...good(), probe: { ...probe, durationSec: 42.41 } })).toEqual([]);
  });
  it("refuses the wrong size, codec or a missing AAC track", () => {
    expect(verifyWorkerOutput({ ...good(), probe: { ...probe, width: 1080, height: 1920 } }).join()).toMatch(/الأبعاد/);
    expect(verifyWorkerOutput({ ...good(), probe: { ...probe, videoCodec: "hevc" } }).join()).toMatch(/h264/);
    expect(verifyWorkerOutput({ ...good(), probe: { ...probe, audioCodec: null } }).join()).toMatch(/AAC/);
  });
  it("refuses a commit mismatch (job vs Mac record, result vs job)", () => {
    expect(verifyWorkerOutput({ ...good(), record: { ...record, commit: "b".repeat(40) } }).join()).toMatch(/commit/);
    expect(verifyWorkerOutput({ ...good(), result: { ...result, commit: "c".repeat(40) } }).join()).toMatch(/commit/);
  });
  it("refuses a job the Mac never sent, and an episode that changed since", () => {
    expect(verifyWorkerOutput({ ...good(), record: undefined }).join()).toMatch(/لم يرسلها/);
    expect(verifyWorkerOutput({ ...good(), current: { ...good().current, planSha256: "d".repeat(64) } }).join()).toMatch(/تغيّرت خطة/);
    expect(verifyWorkerOutput({ ...good(), current: { ...good().current, mediaBase: "x" } }).join()).toMatch(/وسائط/);
    expect(verifyWorkerOutput({ ...good(), current: { ...good().current, shortTitle: "آخر" } }).join()).toMatch(/عنوان/);
  });
  it("refuses a production-tool trace in the metadata", () => {
    expect(verifyWorkerOutput({ ...good(), probe: { ...probe, tags: [...probe.tags, "comment=Made with Remotion"] } }).join()).toMatch(/أثر لأدوات الإنتاج/);
  });
  it("parses ffprobe JSON (video stream duration first)", () => {
    const p = parseProbe(JSON.stringify({ streams: [{ codec_type: "video", codec_name: "h264", width: 2160, height: 3840, duration: "42.500000", tags: { handler_name: "VideoHandler" } }, { codec_type: "audio", codec_name: "aac", duration: "42.55" }], format: { duration: "42.55", tags: { title: "t" } } }));
    expect(p).toMatchObject({ videoCodec: "h264", audioCodec: "aac", durationSec: 42.5 });
    expect(p.tags).toEqual(["title=t", "handler_name=VideoHandler"]);
  });
});

describe("D226 import after verification: clean metadata, motion, never overwrite", () => {
  const owned: string[] = [];
  afterEach(async () => { for (const d of owned.splice(0)) await rm(d, { recursive: true, force: true }); });
  const setup = async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "bal-collect-"));
    owned.push(dir);
    const src = path.join(dir, "src.mp4");
    await writeFile(src, "bytes");
    return { dir, src, ctx: { dir, id: "001", plan: plan as never } };
  };
  const deps = (over: Partial<CollectDeps> = {}): CollectDeps => ({
    sha256File: async () => "1".repeat(64), probe: async () => probe, cleanMetadata: async () => {},
    measureMotion: async () => ({ percent: 91, seconds: 42, activeSeconds: 38, perSecond: [], still: [] }), ...over,
  });
  it("imports as <id>-short-<n>.mp4 after metadata cleaning and motion", async () => {
    const { dir, src, ctx } = await setup();
    let cleaned = false;
    const r = await importVerified(ctx, job as WorkerJob, src, deps({ cleanMetadata: async () => { cleaned = true; } }), { artist: "بالإسلام", exempt: new Set() });
    expect(cleaned).toBe(true);
    expect(r.file).toBe(path.join(dir, "001-short-1.mp4"));
    expect(existsSync(r.file!)).toBe(true);
  });
  it("refuses motion under the channel minimum and leaves nothing in the package", async () => {
    const { dir, src, ctx } = await setup();
    const r = await importVerified(ctx, job as WorkerJob, src, deps({ measureMotion: async () => ({ percent: 61, seconds: 42, activeSeconds: 25, perSecond: [], still: [] }) }), { artist: "x", exempt: new Set() });
    expect(r.refused?.join()).toMatch(/الحركة/);
    expect((await readdir(dir)).filter((f) => f.endsWith(".mp4") && f !== "src.mp4")).toEqual([]);
  });
  it("refuses a trace that survives cleaning, and never overwrites another short without --replace", async () => {
    const { dir, src, ctx } = await setup();
    const traced = await importVerified(ctx, job as WorkerJob, src, deps({ probe: async () => ({ ...probe, tags: ["encoder=Remotion"] }) }), { artist: "x", exempt: new Set() });
    expect(traced.refused?.join()).toMatch(/أثر/);
    await writeFile(path.join(dir, "001-short-1.mp4"), "older");
    let n = 0;
    const r = await importVerified(ctx, job as WorkerJob, src, deps({ sha256File: async () => String(n++).repeat(64) }), { artist: "x", exempt: new Set() });
    expect(r.refused?.join()).toMatch(/--replace/);
    const ok = await importVerified(ctx, job as WorkerJob, src, deps({ sha256File: async () => String(n++).repeat(64) }), { artist: "x", exempt: new Set(), replace: true });
    expect(ok.file).toBe(path.join(dir, "001-short-1.mp4"));
    expect((await readdir(path.join(dir, "superseded"))).length).toBe(1);
  });
});
