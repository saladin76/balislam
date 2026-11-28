import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import {
  claimJob, ensureQueue, failJob, heartbeatFile, pendingJobs, planSha256, progressFile, queuePaths, validateAnyJob, validateEnvelope, validateJobV2,
  writeHeartbeat, writeProgress, type JobEnvelope, type WorkerJobV2, type WorkerResult,
} from "../src/render/worker/protocol";
import { runOnce } from "../src/render/worker/loop";
import { verifyV2Output, workerStatus } from "../src/render/worker/macJobs";
import type { VideoProbe } from "../src/render/worker/probe";

// D232: every render kind goes to the Windows worker. The v2 job is as strict as the D226 short; the loop reads only the
// envelope before checkout (a new kind needs no worker restart); progress and heartbeat files tell the studio where it is.
const owned: string[] = [];
afterEach(async () => { for (const d of owned.splice(0)) await rm(d, { recursive: true, force: true }); });
const share = async () => { const d = await mkdtemp(path.join(tmpdir(), "bal-worker-v2-")); owned.push(d); return d; };

const HASH = "0123456789abcdef01234567";
const plan = { episode: "001", title: "حلقة", chapters: [{ number: 1, title: "", scenes: [{ id: "c1-s1", narration: "نص" }] }] };
const media = { mode: "static", base: `_render/dafatir-alzaman/001-adam-beginning/${HASH}/`, voice: {}, sfx: [], recitations: {} };
const base = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  version: 2, channel: "dafatir-alzaman", episode: "001-adam-beginning", purpose: "trial", trial: "dafatir-001", commit: "b".repeat(40),
  media: `render-queue/media/dafatir-alzaman/001-adam-beginning/${HASH}`, createdAt: "2026-11-26T10:00:00.000Z",
  inputs: { planSha256: planSha256(plan), plan, media, narrationGain: { "c1-s1": 1.05 } }, ...over,
});
const scene = (over: Record<string, unknown> = {}) => base({
  id: "trial-dafatir-001-scene-c1-s1-abcdef012345", kind: "scene", sceneId: "c1-s1",
  render: { orientation: "landscape", quality: "preview", scope: { sceneIds: ["c1-s1"] }, scenePreview: true, timingMode: "scene-preview" },
  expected: { durationSec: 12.4, width: 1920, height: 1080 }, ...over,
});
const master = (over: Record<string, unknown> = {}) => base({
  id: "trial-dafatir-001-master-abcdef012345", kind: "master",
  render: { orientation: "landscape", quality: "master", scope: { all: true }, scenePreview: false, timingMode: "approved", review1080: true },
  expected: { durationSec: 525.6, width: 3840, height: 2160 }, ...over,
});
const assembly = (over: Record<string, unknown> = {}) => base({
  id: "trial-dafatir-001-assembly-abcdef012345", kind: "assembly", join: { cuts: [{ sceneId: "c1-s1", job: "trial-dafatir-001-scene-c1-s1-abcdef012345" }] },
  expected: { durationSec: 525.6, width: 1920, height: 1080 }, ...over,
});

describe("D232 v2 job: strict validation for every kind", () => {
  it("accepts a scene cut, an assembly and a 4K Master", () => {
    expect(validateJobV2(scene()).kind).toBe("scene");
    expect(validateJobV2(assembly()).kind).toBe("assembly");
    expect(validateJobV2(master()).render?.review1080).toBe(true);
    expect(validateAnyJob(master()).version).toBe(2);
  });
  it("rejects unknown fields at every level and a tampered plan", () => {
    expect(() => validateJobV2({ ...scene(), script: "x" })).toThrow(/حقل غير معروف/);
    const s = scene(); (s.render as Record<string, unknown>).ffmpegArgs = ["-y"];
    expect(() => validateJobV2(s)).toThrow(/حقل غير معروف/);
    const a = assembly(); (a.join as { cuts: Record<string, unknown>[] }).cuts[0]!.file = "C:/x.mp4";
    expect(() => validateJobV2(a)).toThrow(/حقل غير معروف/);
    const t = scene(); (t.inputs as { plan: { title: string } }).plan = { ...plan, title: "أخرى" };
    expect(() => validateJobV2(t)).toThrow(/بصمة الخطة/);
  });
  it("sizes follow quality and orientation; a scene cut is never 4K, a Master is the whole episode", () => {
    expect(() => validateJobV2(scene({ expected: { durationSec: 12, width: 3840, height: 2160 } }))).toThrow(/1920×1080/);
    expect(() => validateJobV2(master({ expected: { durationSec: 525, width: 1920, height: 1080 } }))).toThrow(/3840×2160/);
    expect(() => validateJobV2(scene({ render: { orientation: "landscape", quality: "master", scope: { sceneIds: ["c1-s1"] }, scenePreview: true, timingMode: "scene-preview" }, expected: { durationSec: 12, width: 3840, height: 2160 } }))).toThrow();
    expect(() => validateJobV2(master({ render: { orientation: "landscape", quality: "master", scope: { chapter: 1 }, scenePreview: false, timingMode: "approved" } }))).toThrow(/Master/);
    expect(() => validateJobV2(scene({ sceneId: "c1-s2" }))).toThrow(/مهمة المشهد/);
  });
  it("trial rules: id prefix, tag, concurrency only in trials; a studio job cannot pose as a trial", () => {
    expect(() => validateJobV2(scene({ id: "dafatir-alzaman-001-scene-c1-s1-x" }))).toThrow(/trial-/);
    expect(() => validateJobV2(scene({ purpose: "studio" }))).toThrow(/للتجارب وحدها/);
    const studio = scene({ purpose: "studio", trial: undefined, id: "dafatir-alzaman-001-scene-c1-s1-abcdef012345" });
    delete studio.trial;
    expect(validateJobV2(studio).purpose).toBe("studio");
    const withTabs = master(); (withTabs.render as Record<string, unknown>).concurrency = 2;
    expect(validateJobV2(withTabs).render?.concurrency).toBe(2);
    const studioMaster = master({ purpose: "studio", id: "dafatir-alzaman-001-master-abcdef012345" }); delete studioMaster.trial;
    (studioMaster.render as Record<string, unknown>).concurrency = 2;
    expect(() => validateJobV2(studioMaster)).toThrow(/للتجارب وحدها/);
  });
  it("join cuts name done/ jobs only (no paths); thumbnails are reserved, not yet run", () => {
    for (const job of ["../x", "done/x", "C:x", "x/y"]) {
      const a = assembly(); (a.join as { cuts: { job: string }[] }).cuts[0]!.job = job;
      expect(() => validateJobV2(a), job).toThrow(/مهمة القطعة/);
    }
    expect(() => validateJobV2(base({ id: "trial-dafatir-001-thumbnail-x", kind: "thumbnail", expected: { durationSec: 1, width: 2560, height: 1440 } }))).toThrow(/الأغلفة/);
  });
});

describe("D232 envelope: the loop needs no restart for a new kind", () => {
  it("a v2 job with a kind this code does not know is claimed (the job's commit validates it), a v1 job is still checked fully", async () => {
    const root = await share();
    const q = await ensureQueue(root);
    const future = { ...master(), id: "trial-dafatir-001-storyboard-motion-x", kind: "storyboard-motion" };
    await writeFile(path.join(q.jobs, `${future.id}.json`), JSON.stringify(future));
    expect((await pendingJobs(root)).map((j) => j.id)).toEqual([future.id]);
    expect((await claimJob(root, future.id, "Salah"))?.kind).toBe("storyboard-motion");
    expect(() => validateJobV2(future)).toThrow(/نوع غير مدعوم/);
    expect(() => validateEnvelope({ ...future, commit: "abc" })).toThrow(/40/);
    expect(() => validateEnvelope({ version: 1, id: "x", kind: "episode" })).toThrow();
  });
  it("progress files in running/ are not jobs: the restart sweep leaves them, done/failed remove them", async () => {
    const root = await share();
    const q = await ensureQueue(root);
    const job = master();
    await writeFile(path.join(q.jobs, `${job.id as string}.json`), JSON.stringify(job));
    await claimJob(root, job.id as string, "Elsewhere");
    await writeProgress(root, { id: job.id as string, percent: 42, stage: "رندر", at: new Date().toISOString(), startedAt: new Date().toISOString() });
    const deps = { repo: root, log: () => {}, prepareCommit: async () => null, renderChild: async () => ({ code: 1, log: "" }) };
    expect(await runOnce(root, deps)).toBeNull();
    expect(existsSync(path.join(q.failed, `${job.id as string}.progress`))).toBe(false);
    expect(JSON.parse(await readFile(progressFile(root, job.id as string), "utf8")).percent).toBe(42);
    await failJob(root, job.id as string, "سبب", "");
    expect(existsSync(progressFile(root, job.id as string))).toBe(false);
  });
  it("the loop beats «busy» with the job while it renders", async () => {
    const root = await share();
    const q = await ensureQueue(root);
    const job = scene();
    await writeFile(path.join(q.jobs, `${job.id as string}.json`), JSON.stringify(job));
    const beats: string[] = [];
    const deps = { repo: root, log: () => {}, prepareCommit: async (_j: JobEnvelope) => null, renderChild: async () => ({ code: 1, log: "" }),
      heartbeat: async (state: "idle" | "busy", id?: string) => { beats.push(`${state}:${id ?? ""}`); } };
    expect(await runOnce(root, deps)).toBe(job.id);
    expect(beats).toContain(`busy:${job.id as string}`);
    expect(await readdir(q.failed)).toEqual([job.id]);
  });
});

describe("D232 Mac side: worker status and output verification", () => {
  it("offline when the share is not mounted or the heartbeat is older than 2 minutes; online with progress otherwise", async () => {
    expect((await workerStatus(path.join(tmpdir(), "no-such-bal-share-xyz"))).message).toMatch(/غير متصل/);
    const root = await share();
    await writeHeartbeat(root, { state: "idle" }, new Date("2026-11-26T10:00:00Z"));
    expect(existsSync(heartbeatFile(root))).toBe(true);
    const stale = await workerStatus(root, Date.parse("2026-11-26T10:02:30Z"));
    expect(stale.online).toBe(false);
    expect(stale.message).toMatch(/غير متصل/);
    const q = queuePaths(root);
    await writeFile(path.join(q.running, "trial-x-master-1.json"), "{}");
    await writeProgress(root, { id: "trial-x-master-1", percent: 37, stage: "رندر", at: "", startedAt: "" });
    const live = await workerStatus(root, Date.parse("2026-11-26T10:01:00Z"));
    expect(live.online).toBe(true);
    expect(live.running).toEqual([{ id: "trial-x-master-1", progress: expect.objectContaining({ percent: 37 }) }]);
  });
  const job = validateJobV2(master());
  const result: WorkerResult = { id: job.id, sha256: "f".repeat(64), bytes: 10, durationSec: 525.6, width: 3840, height: 2160, commit: job.commit, worker: "Salah", startedAt: "", finishedAt: "", logTail: "" };
  const probe: VideoProbe = { videoCodec: "h264", width: 3840, height: 2160, audioCodec: "aac", durationSec: 525.63, tags: ["title=حلقة"] };
  const ok = { job, submitted: job as WorkerJobV2, result, fileSha256: result.sha256, fileBytes: 10, probe };
  it("accepts the job exactly as sent and refuses anything else", () => {
    expect(verifyV2Output(ok)).toEqual([]);
    expect(verifyV2Output({ ...ok, job: { ...job, claimedBy: "Salah" } })).toEqual([]);
    expect(verifyV2Output({ ...ok, submitted: undefined }).join()).toMatch(/لم يرسلها/);
    expect(verifyV2Output({ ...ok, job: { ...job, commit: "c".repeat(40) } }).join()).toMatch(/حرفيًا/);
    expect(verifyV2Output({ ...ok, probe: { ...probe, durationSec: 525.8 } }).join()).toMatch(/المدة/);
    expect(verifyV2Output({ ...ok, probe: { ...probe, tags: ["encoder=Remotion"] } }).join()).toMatch(/أثر/);
    expect(verifyV2Output({ ...ok, fileSha256: "e".repeat(64) }).join()).toMatch(/بصمة/);
  });
  it("a join may be shorter by the trimmed head silence only", () => {
    const a = validateJobV2(assembly());
    const p = { ...probe, width: 1920, height: 1080 };
    const r = { ...result, id: a.id, width: 1920, height: 1080 };
    expect(verifyV2Output({ job: a, submitted: a, result: r, fileSha256: r.sha256, fileBytes: 10, probe: { ...p, durationSec: 522.6 } })).toEqual([]);
    expect(verifyV2Output({ job: a, submitted: a, result: r, fileSha256: r.sha256, fileBytes: 10, probe: { ...p, durationSec: 520 } }).join()).toMatch(/المدة/);
  });
});
