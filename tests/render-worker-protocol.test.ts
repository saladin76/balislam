import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import {
  acquireLock, claimJob, completeJob, ensureQueue, failJob, LOCK_STALE_MS, pendingJobs, planSha256, queuePaths, safeRelative,
  sha256File, validateJob, type JobEnvelope, type WorkerJob,
} from "../src/render/worker/protocol";
import { runOnce, workerEnv } from "../src/render/worker/loop";
import { contentSyncEnabled } from "../app/server/contentSync";

const owned: string[] = [];
afterEach(async () => { for (const d of owned.splice(0)) await rm(d, { recursive: true, force: true }); });
const share = async () => { const d = await mkdtemp(path.join(tmpdir(), "bal-worker-share-")); owned.push(d); return d; };

const HASH = "0123456789abcdef01234567";
const plan = { episode: "001", title: "حلقة", chapters: [{ number: 1, title: "", scenes: [{ id: "s1", narration: "نص" }] }] };
const sampleJob = (over: Partial<Record<keyof WorkerJob, unknown>> = {}): Record<string, unknown> => ({
  version: 1, id: "balislam-001-short-1-abcdef012345", channel: "balislam", episode: "001-know-the-truth", kind: "short", n: 1,
  segment: { sceneIds: ["s1"] }, shortTitle: "سؤال", commit: "a".repeat(40), quality: "master",
  media: `render-queue/media/balislam/001-know-the-truth/${HASH}`,
  expected: { durationSec: 42.5, width: 2160, height: 3840 },
  inputs: { planSha256: planSha256(plan), plan, media: { mode: "static", base: `_render/balislam/001-know-the-truth/${HASH}/`, voice: {}, sfx: [], recitations: {} }, narrationGain: { s1: 1.1 } },
  createdAt: "2026-11-26T10:00:00.000Z", ...over,
});
const put = async (root: string, job: Record<string, unknown>) => {
  const q = await ensureQueue(root);
  await writeFile(path.join(q.jobs, `${job.id as string}.json`), JSON.stringify(job));
};

describe("D226 job protocol: strict validation", () => {
  it("accepts a well-formed short job", () => {
    expect(validateJob(sampleJob()).id).toBe("balislam-001-short-1-abcdef012345");
    expect(validateJob(sampleJob({ segment: { chapter: 2 } })).segment).toEqual({ chapter: 2 });
  });
  it("rejects path traversal, absolute and Windows paths in media", () => {
    for (const media of [
      "render-queue/media/balislam/001-know-the-truth/../../../etc",
      `render-queue/media/balislam/../balislam/${HASH}`,
      `/render-queue/media/balislam/001-know-the-truth/${HASH}`,
      `C:/render-queue/media/balislam/001-know-the-truth/${HASH}`,
      `render-queue\\media\\balislam\\001-know-the-truth\\${HASH}`,
      `render-queue/media/zubdat-alkutub/001-know-the-truth/${HASH}`,
      `render-queue/media/balislam/001-know-the-truth/${HASH}/extra`,
    ]) expect(() => validateJob(sampleJob({ media })), media).toThrow(/مهمة رندر غير صالحة/);
    expect(() => safeRelative("a/../b")).toThrow();
    expect(() => safeRelative("\\\\Salah\\bal-share")).toThrow();
  });
  it("rejects an unknown kind, channel, field, quality, size or a tampered plan", () => {
    expect(() => validateJob(sampleJob({ kind: "episode" }))).toThrow(/نوع غير مدعوم/);
    expect(() => validateJob(sampleJob({ channel: "other" }))).toThrow(/قناة/);
    expect(() => validateJob({ ...sampleJob(), script: "rm -rf" })).toThrow(/حقل غير معروف/);
    expect(() => validateJob(sampleJob({ quality: "preview" }))).toThrow();
    expect(() => validateJob(sampleJob({ expected: { durationSec: 4, width: 1080, height: 1920 } }))).toThrow(/2160×3840/);
    expect(() => validateJob(sampleJob({ commit: "abc123" }))).toThrow(/40/);
    expect(() => validateJob(sampleJob({ episode: "../001" }))).toThrow();
    expect(() => validateJob(sampleJob({ id: "../x" }))).toThrow();
    const j = sampleJob();
    (j.inputs as { plan: { title: string } }).plan = { ...plan, title: "أخرى" };
    expect(() => validateJob(j)).toThrow(/بصمة الخطة/);
    const k = sampleJob();
    (k.inputs as { media: { base: string } }).media.base = `_render/balislam/002-other/${HASH}/`;
    expect(() => validateJob(k)).toThrow(/وصف الوسائط/);
  });
});

describe("D226 queue: atomic claim, done, failed, lock", () => {
  it("only one of two concurrent claims wins the same job", async () => {
    const root = await share();
    await put(root, sampleJob());
    const [a, b] = await Promise.all([
      claimJob(root, "balislam-001-short-1-abcdef012345", "A"),
      claimJob(root, "balislam-001-short-1-abcdef012345", "B"),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    const running = JSON.parse(await readFile(path.join(queuePaths(root).running, "balislam-001-short-1-abcdef012345.json"), "utf8"));
    expect(["A", "B"]).toContain(running.claimedBy);
    expect(await readdir(queuePaths(root).jobs)).toEqual([]);
  });
  it("lists the oldest job first and skips malformed files", async () => {
    const root = await share();
    await put(root, sampleJob({ id: "balislam-001-short-2-x", createdAt: "2026-11-26T12:00:00.000Z" }));
    await put(root, sampleJob({ id: "balislam-001-short-1-y", createdAt: "2026-11-26T09:00:00.000Z" }));
    await writeFile(path.join(queuePaths(root).jobs, "broken.json"), "{");
    expect((await pendingJobs(root)).map((j) => j.id)).toEqual(["balislam-001-short-1-y", "balislam-001-short-2-x"]);
  });
  it("a malformed claimed job goes to failed/ with its reason", async () => {
    const root = await share();
    await put(root, sampleJob({ id: "balislam-001-short-1-bad", kind: "episode" }));
    expect(await claimJob(root, "balislam-001-short-1-bad", "A")).toBeNull();
    const err = JSON.parse(await readFile(path.join(queuePaths(root).failed, "balislam-001-short-1-bad", "error.json"), "utf8"));
    expect(err.error).toMatch(/نوع غير مدعوم/);
  });
  it("completes into done/<id>/ with the mp4, result.json and job.json, sha checked on the share copy", async () => {
    const root = await share();
    await put(root, sampleJob());
    const job = (await claimJob(root, "balislam-001-short-1-abcdef012345", "Salah"))!;
    const mp4 = path.join(root, "local.mp4");
    await writeFile(mp4, "video-bytes");
    const sha = await sha256File(mp4);
    const dir = await completeJob(root, job, mp4, { id: job.id, sha256: sha, bytes: 11, durationSec: 42.5, width: 2160, height: 3840, commit: job.commit, worker: "Salah", startedAt: "", finishedAt: "", logTail: "" });
    expect((await readdir(dir)).sort()).toEqual([`${job.id}.mp4`, "job.json", "result.json"]);
    expect(existsSync(path.join(queuePaths(root).running, `${job.id}.json`))).toBe(false);
  });
  it("one render at a time: a fresh lock blocks, a 6-hour-old lock is reclaimed", async () => {
    const root = await share();
    const t0 = Date.parse("2026-11-26T00:00:00Z");
    const release = await acquireLock(root, () => t0, "Salah", 111);
    expect(release).toBeTruthy();
    expect(await acquireLock(root, () => t0 + 60_000, "Other", 222)).toBeNull();
    const later = await acquireLock(root, () => t0 + LOCK_STALE_MS + 1, "Other", 222);
    expect(later).toBeTruthy();
    expect(JSON.parse(await readFile(queuePaths(root).lock, "utf8"))).toMatchObject({ host: "Other", pid: 222 });
    await later!();
    expect(existsSync(queuePaths(root).lock)).toBe(false);
  });
  it("failJob keeps the job json and log tail", async () => {
    const root = await share();
    await put(root, sampleJob());
    await claimJob(root, "balislam-001-short-1-abcdef012345", "A");
    await failJob(root, "balislam-001-short-1-abcdef012345", "سبب", "a\nb");
    const dir = path.join(queuePaths(root).failed, "balislam-001-short-1-abcdef012345");
    expect((await readdir(dir)).sort()).toEqual(["error.json", "job.json"]);
  });
});

describe("D226 worker loop (injected git/render)", () => {
  it("a failed checkout or a render without a result lands in failed/, never done/", async () => {
    const root = await share();
    await put(root, sampleJob({ id: "balislam-001-short-1-a", createdAt: "2026-11-26T01:00:00.000Z" }));
    await put(root, sampleJob({ id: "balislam-001-short-2-b", createdAt: "2026-11-26T02:00:00.000Z" }));
    const log: string[] = [];
    const deps = { repo: root, log: (l: string) => log.push(l),
      prepareCommit: async (j: JobEnvelope) => (j.id.endsWith("-a") ? "تعذّر جلب الـcommit" : null),
      renderChild: async () => ({ code: 0, log: "no output" }) };
    expect(await runOnce(root, deps)).toBe("balislam-001-short-1-a");
    expect(await runOnce(root, deps)).toBe("balislam-001-short-2-b");
    expect(await runOnce(root, deps)).toBeNull();
    expect((await readdir(queuePaths(root).failed)).sort()).toEqual(["balislam-001-short-1-a", "balislam-001-short-2-b"]);
    expect(await readdir(queuePaths(root).done)).toEqual([]);
    expect(existsSync(queuePaths(root).lock)).toBe(false);
  });
  it("a job this host left in running/ (restart) is failed on the next run, not left hanging", async () => {
    const root = await share();
    await put(root, sampleJob());
    const { workerName } = await import("../src/render/worker/protocol");
    await claimJob(root, "balislam-001-short-1-abcdef012345", workerName());
    const deps = { repo: root, log: () => {}, prepareCommit: async () => null, renderChild: async () => ({ code: 1, log: "" }) };
    expect(await runOnce(root, deps)).toBeNull();
    const err = JSON.parse(await readFile(path.join(queuePaths(root).failed, "balislam-001-short-1-abcdef012345", "error.json"), "utf8"));
    expect(err.error).toMatch(/انقطع العامل/);
  });
  it("auto-save and notes sync are off in the worker and its children; service keys are dropped", () => {
    const env = workerEnv({ PATH: "x", ELEVENLABS_API_KEY: "k", BAL_CONTENT_SYNC: "on", GIT_DIR: "/elsewhere" });
    expect(env.BAL_CONTENT_SYNC).toBe("off");
    expect(env.BAL_NOTES_SYNC).toBe("off");
    expect(env.ELEVENLABS_API_KEY).toBeUndefined();
    expect(env.GIT_DIR).toBeUndefined();
    expect(contentSyncEnabled(env, "win32")).toBe(false);
  });
});

