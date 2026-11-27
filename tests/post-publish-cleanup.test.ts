import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import {
  executeCleanup, pathEscape, permanentMasterPath, planCleanup, summaryLine, type CleanupContext, type CleanupDeps,
} from "../src/render/postPublishCleanup";
import { cleanupPaths, queueWindowsCleanup, runCleanupJob, runCleanupJobs, validateCleanupJob } from "../src/render/worker/cleanupQueue";
import { sha256File } from "../src/render/worker/protocol";
import type { VideoProbe } from "../src/render/worker/probe";

const owned: string[] = [];
afterEach(async () => { for (const d of owned.splice(0)) await rm(d, { recursive: true, force: true }); });
const tmp = async (p: string) => { const d = await mkdtemp(path.join(tmpdir(), p)); owned.push(d); return d; };
const put = async (file: string, body: string | Buffer = "x") => { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, body); return file; };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const CH = "dafatir-alzaman", EP = "001-adam-beginning";
const MASTER = "MASTER-BYTES";
const goodProbe: VideoProbe = { videoCodec: "h264", width: 3840, height: 2160, audioCodec: "aac", durationSec: 525.5, tags: ["encoder=Lavf"] };

/** شجرة كاملة: مستودع (الماك أو ويندوز) ومجلد مشترك. */
const fixture = async (o: { published?: boolean; url?: boolean } = {}) => {
  const repo = await tmp("bal-clean-repo-");
  const share = await tmp("bal-clean-share-");
  const ep = path.join(repo, "channels", CH, "episodes", EP);
  const status = o.published === false ? {} : { published: { date: "2026-11-20", ...(o.url === false ? {} : { url: "https://youtu.be/qz1UVljNP9Q" }) } };
  await put(path.join(ep, "status.json"), JSON.stringify(status));
  await put(path.join(ep, "publish.json"), JSON.stringify({ long: {} }));
  await put(path.join(ep, "script.md"), "نص");
  await put(path.join(ep, "scene-production.v1.json"), "{}");
  const f = {
    repo, share, ep,
    sceneClip: await put(path.join(ep, "previews", "scene-c1-s1-av.mp4"), "clip"),
    assembly: await put(path.join(ep, "previews", "episode.mp4"), "assembly"),
    previewIndex: await put(path.join(ep, "previews", "index.json"), "{}"),
    trackedVideo: await put(path.join(ep, "previews", "tracked.mp4"), "tracked"),
    seams: await put(path.join(ep, "previews", "episode.seams.json"), "{}"),
    macMaster: await put(path.join(ep, "out", "package", "001-episode.mp4"), MASTER),
    short1: await put(path.join(ep, "out", "package", "001-short-1.mp4"), "short1"),
    oldShort: await put(path.join(ep, "out", "package", "superseded", "001-short-1.1700.mp4"), "old"),
    renderJson: await put(path.join(ep, "out", "package", "render.json"), "{}"),
    workerOut: await put(path.join(ep, "out", "worker", "job.mp4"), "w"),
    importing: await put(path.join(ep, "out", "package", ".worker-abc.importing.mp4"), "tmp"),
    voice: await put(path.join(ep, "voice", "c1-s1.mp3"), "voice"),
    paidOld: await put(path.join(ep, "voice", "superseded", "c1-s1.old.mp3"), "paid"),
    cache: await put(path.join(repo, "renders", ".private-media", "_render", CH, EP, "a".repeat(24), "voice", "v.mp3"), "cache"),
    cacheEnv: await put(path.join(repo, "renders", ".private-media", "_render", CH, EP, ".env"), "SECRET=1"),
    otherCache: await put(path.join(repo, "renders", ".private-media", "_render", CH, "002-ibna-adam", "x.mp3"), "keep"),
    permMaster: await put(permanentMasterPath(share, CH, EP), MASTER),
    permShort: await put(path.join(share, "masters", CH, EP, "shorts", "001-short-1.mp4"), "short1"),
    trialJob: await put(path.join(share, "render-queue", "done", "trial-dafatir-001-master-c21a", "job.json"), JSON.stringify({ channel: CH, episode: EP, kind: "master", trial: "dafatir-001" })),
    trialResult: await put(path.join(share, "render-queue", "done", "trial-dafatir-001-master-c21a", "result.json"), "{\"timings\":{}}"),
    trialMaster: await put(path.join(share, "render-queue", "done", "trial-dafatir-001-master-c21a", "trial-dafatir-001-master-c21a.mp4"), "trial"),
    trialReview: await put(path.join(share, "render-queue", "done", "trial-dafatir-001-master-c21a", "trial-dafatir-001-master-c21a.review1080.mp4"), "review"),
    otherJob: await put(path.join(share, "render-queue", "done", "dafatir-alzaman-002-short-1-abc", "job.json"), JSON.stringify({ channel: CH, episode: "002-ibna-adam" })),
    otherVideo: await put(path.join(share, "render-queue", "done", "dafatir-alzaman-002-short-1-abc", "dafatir-alzaman-002-short-1-abc.mp4"), "other"),
    shareMedia: await put(path.join(share, "render-queue", "media", CH, EP, "f".repeat(24), "voice", "v.mp3"), "snap"),
  };
  const ctx: CleanupContext = { channel: CH, episodeFolder: EP, episodeDir: ep, projectRoot: repo, share };
  return { ...f, ctx };
};
type Fx = Awaited<ReturnType<typeof fixture>>;

const depsFor = (f: Fx, over: Partial<CleanupDeps> = {}): CleanupDeps => ({
  approvedMaster: async () => ({ fileSha256: sha(MASTER), publishSha256: sha(MASTER), at: "2026-11-19T10:00:00Z" }),
  sha256File, probe: async () => goodProbe,
  gitTracked: async () => new Set([f.previewIndex, f.trackedVideo, path.join(f.ep, "script.md")].map((x) => path.resolve(x))),
  ...over,
});

const allFiles = async (root: string): Promise<string[]> => {
  const out: string[] = [];
  const go = async (d: string) => { for (const e of await readdir(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) await go(p); else out.push(p); } };
  await go(root);
  return out.sort();
};
const snapshot = async (f: Fx) => [...await allFiles(f.repo), ...await allFiles(f.share)];

describe("D240 post-publish cleanup: all three conditions pass", () => {
  it("lists exactly the temporary files, deletes them, and the keep set survives", async () => {
    const f = await fixture();
    const plan = await planCleanup(f.ctx, depsFor(f));
    expect(plan.conditions.map((c) => [c.n, c.ok])).toEqual([[1, true], [2, true], [3, true]]);
    const del = plan.delete.map((x) => x.path).sort();
    expect(del).toEqual([f.sceneClip, f.assembly, f.oldShort, f.importing, f.workerOut, f.cache, f.trialMaster, f.trialReview, f.shareMedia].sort());
    const keep = plan.keep.map((x) => x.path);
    for (const k of [f.macMaster, f.short1, f.permMaster, f.permShort, f.voice, f.paidOld]) expect(keep).toContain(k);

    const r = await executeCleanup(plan);
    expect(r.deleted.sort()).toEqual(del);
    expect(r.skipped).toEqual([]);
    for (const d of del) expect(existsSync(d)).toBe(false);
    for (const k of [f.macMaster, f.short1, f.permMaster, f.permShort, f.voice, f.paidOld, f.previewIndex, f.trackedVideo, f.seams,
      f.renderJson, f.trialJob, f.trialResult, f.otherJob, f.otherVideo, f.otherCache, f.cacheEnv,
      path.join(f.ep, "scene-production.v1.json"), path.join(f.ep, "status.json"), path.join(f.ep, "script.md")])
      expect(existsSync(k), k).toBe(true);
    const line = summaryLine(plan, r.freed, true);
    expect(line.split("\n")).toHaveLength(1);
    expect(line).toContain(EP);
    expect(line).toContain("Master");
  });

  it("never deletes .env, the signed ledger or a Git-tracked file, even inside an allowed root", async () => {
    const f = await fixture();
    const plan = await planCleanup(f.ctx, depsFor(f));
    const refused = new Map(plan.refused.map((r) => [r.path, r.why]));
    expect(refused.get(f.cacheEnv)).toMatch(/\.env/);
    expect(refused.get(f.trackedVideo)).toMatch(/Git/);
    expect(plan.delete.map((x) => x.path)).not.toContain(f.trackedVideo);
  });
});

describe("D240: worker shorts in done/", () => {
  it("keeps a worker short the Mac never collected, deletes the copy of one it did", async () => {
    const f = await fixture();
    const done = path.join(f.share, "render-queue", "done");
    const job = (_id: string) => JSON.stringify({ channel: CH, episode: EP, kind: "short", n: 1 });
    await put(path.join(done, "dafatir-alzaman-001-short-1-aaa", "job.json"), job("a"));
    const uncollected = await put(path.join(done, "dafatir-alzaman-001-short-1-aaa", "dafatir-alzaman-001-short-1-aaa.mp4"), "only copy");
    await put(path.join(done, "dafatir-alzaman-001-short-2-bbb", "job.json"), job("b"));
    const collected = await put(path.join(done, "dafatir-alzaman-001-short-2-bbb", "dafatir-alzaman-001-short-2-bbb.mp4"), "copy");
    await put(path.join(f.ep, "out", "package", "worker-collected.json"), JSON.stringify({ "dafatir-alzaman-001-short-2-bbb": { file: f.short1 } }));
    const plan = await planCleanup(f.ctx, depsFor(f));
    expect(plan.keep.map((k) => k.path)).toContain(uncollected);
    expect(plan.delete.map((k) => k.path)).toContain(collected);
    await executeCleanup(plan);
    expect(existsSync(uncollected)).toBe(true);
    expect(existsSync(collected)).toBe(false);
  });
});

describe("D240: any missing condition stops with zero deletions", () => {
  const cases: [string, (f: Fx) => Promise<{ deps?: Partial<CleanupDeps>; ctx?: Partial<CleanupContext> }>, number][] = [
    ["not marked published", async (f) => { await writeFile(path.join(f.ep, "status.json"), "{}"); return {}; }, 1],
    ["published without a YouTube link", async (f) => { await writeFile(path.join(f.ep, "status.json"), JSON.stringify({ published: { date: "2026-11-20", url: "https://example.com/v" } })); return {}; }, 1],
    ["no approved Master record", async () => ({ deps: { approvedMaster: async () => null } }), 2],
    ["unreadable signed ledger", async () => ({ deps: { approvedMaster: async () => { throw new Error("signature changed"); } } }), 2],
    ["Master approved but no publish permission", async () => ({ deps: { approvedMaster: async () => ({ fileSha256: sha(MASTER), publishSha256: null, at: "x" }) } }), 2],
    ["permanent Master is not the approved bytes", async (f) => { await writeFile(f.permMaster, "OTHER"); return {}; }, 2],
    ["permanent Master is not sound (codec/size)", async () => ({ deps: { probe: async () => ({ ...goodProbe, width: 1920, height: 1080 }) } }), 2],
    ["Master metadata carries a production-tool trace", async () => ({ deps: { probe: async () => ({ ...goodProbe, tags: ["comment=Made with Remotion"] }) } }), 2],
    ["no Master in the permanent place", async (f) => { await rm(f.permMaster); return {}; }, 3],
    ["shared folder not mounted", async () => ({ ctx: { share: "/nonexistent/bal-share" } }), 3],
    ["permanent Master is a symlink to a temp copy", async (f) => {
      const temp = await put(path.join(f.share, "render-queue", "done", "x", "m.mp4"), MASTER);
      await rm(f.permMaster); await symlink(temp, f.permMaster); return {};
    }, 3],
  ];
  for (const [name, arrange, n] of cases) {
    it(name, async () => {
      const f = await fixture();
      const o = await arrange(f);
      const before = await snapshot(f);
      const plan = await planCleanup({ ...f.ctx, ...o.ctx }, depsFor(f, o.deps));
      expect(plan.ok).toBe(false);
      expect(plan.conditions.find((c) => c.n === n)!.ok).toBe(false);
      await expect(executeCleanup(plan)).rejects.toThrow(/لا حذف/);
      await expect(queueWindowsCleanup(f.share, plan)).rejects.toThrow();
      expect(await snapshot(f)).toEqual(before);
    });
  }
});

describe("D240: path escape refusal", () => {
  it("a symlink inside an allowed root is listed as refused, never followed or deleted", async () => {
    const f = await fixture();
    const outside = await put(path.join(await tmp("bal-clean-outside-"), "precious.mp4"), "precious");
    await symlink(outside, path.join(f.ep, "previews", "scene-evil-av.mp4"));
    const outsideDir = path.dirname(outside);
    await symlink(outsideDir, path.join(f.ep, "out", "linked"));
    const plan = await planCleanup(f.ctx, depsFor(f));
    expect(plan.refused.some((r) => r.path.endsWith("scene-evil-av.mp4") && /رمزي/.test(r.why))).toBe(true);
    expect(plan.refused.some((r) => r.path.endsWith(path.join("out", "linked")))).toBe(true);
    expect(plan.delete.some((x) => x.path.includes("precious") || x.path.includes("evil") || x.path.includes("linked"))).toBe(false);
    await executeCleanup(plan);
    expect(existsSync(outside)).toBe(true);
  });

  it("a forged entry with .. or outside every root is skipped at deletion time", async () => {
    const f = await fixture();
    const outside = await put(path.join(await tmp("bal-clean-outside-"), "precious.mp4"), "precious");
    const plan = await planCleanup(f.ctx, depsFor(f));
    plan.delete.push({ location: "mac", path: outside, bytes: 8, what: "forged" });
    plan.delete.push({ location: "mac", path: path.join(f.ep, "previews", "..", "script.md"), bytes: 2, what: "forged" });
    const r = await executeCleanup(plan);
    expect(existsSync(outside)).toBe(true);
    expect(existsSync(path.join(f.ep, "script.md"))).toBe(true);
    expect(r.skipped.map((s) => s.path)).toContain(outside);
  });

  it("pathEscape refuses .., a symlinked root and a symlinked parent", async () => {
    const root = await tmp("bal-clean-root-");
    const outside = await put(path.join(await tmp("bal-clean-o-"), "a.mp4"));
    expect(await pathEscape(root, path.join(root, "..", path.basename(outside)))).toMatch(/خارج/);
    const linkedRoot = path.join(await tmp("bal-clean-l-"), "root");
    await symlink(path.dirname(outside), linkedRoot);
    expect(await pathEscape(linkedRoot, path.join(linkedRoot, "a.mp4"))).toMatch(/الجذر/);
    await symlink(path.dirname(outside), path.join(root, "sub"));
    expect(await pathEscape(root, path.join(root, "sub", "a.mp4"))).toMatch(/رمزي/);
  });
});

describe("D240: Windows cleanup is a queued worker job", () => {
  it("is queued only after all conditions pass, and validates its Master path strictly", async () => {
    const f = await fixture();
    const plan = await planCleanup(f.ctx, depsFor(f));
    const id = await queueWindowsCleanup(f.share, plan);
    const files = await readdir(cleanupPaths(f.share).jobs);
    expect(files).toEqual([`${id}.json`]);
    const good = { version: 1, kind: "cleanup", id, channel: CH, episode: EP, masterSha256: sha(MASTER), master: `masters/${CH}/${EP}/001-episode.mp4`, createdAt: new Date().toISOString() };
    expect(validateCleanupJob(good).id).toBe(id);
    for (const master of [`render-queue/done/x/001-episode.mp4`, `masters/${CH}/../x/001-episode.mp4`, `masters/${CH}/002-ibna-adam/002-episode.mp4`])
      expect(() => validateCleanupJob({ ...good, master })).toThrow();
    expect(() => validateCleanupJob({ ...good, push: true })).toThrow(/غير معروف/);
  });

  it("the worker deletes nothing when the permanent Master does not match, and cleans its own copy when it does", async () => {
    const f = await fixture();
    const plan = await planCleanup(f.ctx, depsFor(f));
    const id = await queueWindowsCleanup(f.share, plan);
    const job = validateCleanupJob(JSON.parse(await (await import("node:fs/promises")).readFile(path.join(cleanupPaths(f.share).jobs, `${id}.json`), "utf8")));
    const before = await allFiles(f.repo);
    await expect(runCleanupJob(f.share, f.repo, { ...job, masterSha256: sha("OTHER") }, { sha256File, gitTracked: depsFor(f).gitTracked })).rejects.toThrow(/لا تطابق/);
    expect(await allFiles(f.repo)).toEqual(before);

    const logs: string[] = [];
    expect(await runCleanupJobs(f.share, f.repo, (l) => logs.push(l), { sha256File, gitTracked: depsFor(f).gitTracked })).toBe(1);
    expect(existsSync(f.sceneClip)).toBe(false);
    expect(existsSync(f.workerOut)).toBe(false);
    for (const k of [f.macMaster, f.short1, f.voice, f.paidOld, f.trackedVideo, f.cacheEnv]) expect(existsSync(k)).toBe(true);
    expect(await readdir(cleanupPaths(f.share).done)).toEqual([`${id}.json`]);
    expect(await readdir(cleanupPaths(f.share).jobs)).toEqual([]);
  });
});
