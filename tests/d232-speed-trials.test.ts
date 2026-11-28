/**
 * D232 — تجارب تسريع رندر الويندوز، كل خيار وحده ليُقاس وحده (للتجارب وحدها؛ الإنتاج يتبع config.json):
 * ١) x264 «medium» لـMaster 4K بالـcrf نفسه، ٢) حزمة Remotion واحدة للحلقة يعيد العامل استعمالها لكل المشاهد،
 * ٣) Master على قطع محفوظة تُستأنف بعد الانقطاع ثم تُوصل بلا إعادة ترميز. لا رندر هنا: المنطق وحده بدوال مزيفة.
 */
import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { planSha256, validateJobV2 } from "../src/render/worker/protocol";
import { chunkRanges, renderChunked, type RenderChunk } from "../src/render/chunkedMaster";
import { BUNDLE_CACHE_KEEP, cachedRenderBundle } from "../src/render/bundle";
import { bundleCacheKeyFor, chunkDirFor } from "../src/render/worker/untrustedRender";
import { emptyMedia } from "../src/plan/media";

const owned: string[] = [];
afterEach(async () => { for (const d of owned.splice(0)) await rm(d, { recursive: true, force: true }); });
const tmp = async (p: string) => { const d = await mkdtemp(path.join(tmpdir(), p)); owned.push(d); return d; };

const HASH = "0123456789abcdef01234567";
const plan = { episode: "001", title: "حلقة", chapters: [{ number: 1, title: "", scenes: [{ id: "c1-s1", narration: "نص" }] }] };
const media = { mode: "static", base: `_render/dafatir-alzaman/001-adam-beginning/${HASH}/`, voice: {}, sfx: [], recitations: {} };
const job = (purpose: "trial" | "studio", kind: "master" | "scene", extra: Record<string, unknown>) => ({
  version: 2, channel: "dafatir-alzaman", episode: "001-adam-beginning", purpose, ...(purpose === "trial" ? { trial: "speed" } : {}), commit: "b".repeat(40),
  media: `render-queue/media/dafatir-alzaman/001-adam-beginning/${HASH}`, createdAt: "2026-11-27T10:00:00.000Z",
  inputs: { planSha256: planSha256(plan), plan, media, narrationGain: {} },
  ...(kind === "master" ? {
    id: `${purpose === "trial" ? "trial-speed" : "dafatir-alzaman-001"}-master-abcdef012345`, kind,
    render: { orientation: "landscape", quality: "master", scope: { all: true }, scenePreview: false, timingMode: "approved", review1080: true, ...extra },
    expected: { durationSec: 525.6, width: 3840, height: 2160 },
  } : {
    id: `${purpose === "trial" ? "trial-speed" : "dafatir-alzaman-001"}-scene-c1-s1-abcdef012345`, kind, sceneId: "c1-s1",
    render: { orientation: "landscape", quality: "preview", scope: { sceneIds: ["c1-s1"] }, scenePreview: true, timingMode: "scene-preview", ...extra },
    expected: { durationSec: 12.4, width: 1920, height: 1080 },
  }),
});

describe("مهمة العامل: خيارات التسريع للتجارب وحدها، كل خيار في مكانه", () => {
  it("x264 «medium» لـMaster التجربة وحده", () => {
    expect(validateJobV2(job("trial", "master", { x264Preset: "medium" })).render?.x264Preset).toBe("medium");
    expect(() => validateJobV2(job("studio", "master", { x264Preset: "medium" }))).toThrow(/للتجارب وحدها|لـMaster التجارب/);
    expect(() => validateJobV2(job("trial", "master", { x264Preset: "ultrafast" }))).toThrow(/medium أو slow/);
    expect(() => validateJobV2(job("trial", "scene", { x264Preset: "medium" }))).toThrow(/لـMaster التجارب/);
  });
  it("الحزمة الواحدة للتجارب وحدها", () => {
    expect(validateJobV2(job("trial", "scene", { bundleCache: true })).render?.bundleCache).toBe(true);
    expect(() => validateJobV2(job("studio", "scene", { bundleCache: true }))).toThrow(/للتجارب وحدها/);
    expect(() => validateJobV2(job("trial", "scene", { bundleCache: "yes" }))).toThrow(/للتجارب وحدها/);
  });
  it("قطع Master لـMaster التجربة وحده وبحدود", () => {
    expect(validateJobV2(job("trial", "master", { chunkFrames: 1800 })).render?.chunkFrames).toBe(1800);
    expect(() => validateJobV2(job("studio", "master", { chunkFrames: 1800 }))).toThrow(/لـMaster التجارب/);
    expect(() => validateJobV2(job("trial", "master", { chunkFrames: 100 }))).toThrow(/لـMaster التجارب/);
    expect(() => validateJobV2(job("trial", "scene", { chunkFrames: 1800 }))).toThrow(/لـMaster التجارب/);
  });
  it("الإنتاج لا يتغير: config.json يبقى slow بتبويب واحد", () => {
    const q = JSON.parse(readFileSync(path.join(__dirname, "..", "config.json"), "utf8")).video.quality.master;
    expect(q).toMatchObject({ x264Preset: "slow", crf: 14, concurrency: 1 });
  });
});

describe("Master على قطع: المدى، والحفظ، والاستئناف", () => {
  it("قطع متساوية إلا الأخيرة، تغطي كل الإطارات بلا تداخل", () => {
    expect(chunkRanges(4000, 1800)).toEqual([[0, 1799], [1800, 3599], [3600, 3999]]);
    expect(chunkRanges(1800, 1800)).toEqual([[0, 1799]]);
    expect(() => chunkRanges(0, 1800)).toThrow();
  });
  const fake = (calls: string[]): RenderChunk => async ({ range, videoOut, audioOut, onProgress }) => {
    calls.push(range.join("-"));
    onProgress(0.5);
    await writeFile(videoOut, `v${range.join("-")}`);
    await writeFile(audioOut, `a${range.join("-")}`);
  };
  const combine = async (o: { videoFiles: string[]; audioFiles: string[]; outputLocation: string; framesPerChunk: number; totalFrames: number }) => {
    await writeFile(o.outputLocation, o.videoFiles.map((f) => readFileSync(f, "utf8")).join("|") + "#" + o.audioFiles.map((f) => readFileSync(f, "utf8")).join("|"));
  };
  it("الانقطاع ثم الإرسال نفسه: لا يُعاد إلا الناقص أو التالف، ومفتاح آخر يعيد الكل", async () => {
    const d = await tmp("bal-chunks-");
    const dir = path.join(d, "job.chunks");
    const out = path.join(d, "out.mp4");
    const calls: string[] = [];
    let n = 0;
    // انقطاع أثناء القطعة الثالثة
    const failing: RenderChunk = async (o) => { if (++n === 3) throw new Error("انقطع"); return fake(calls)(o); };
    await expect(renderChunked({ dir, key: "job-a", totalFrames: 4000, chunkFrames: 1800, output: out, renderChunk: failing, combine })).rejects.toThrow("انقطع");
    expect(calls).toEqual(["0-1799", "1800-3599"]);
    expect((await readdir(dir)).filter((x) => x.includes(".part."))).toHaveLength(0);
    calls.length = 0;
    const r = await renderChunked({ dir, key: "job-a", totalFrames: 4000, chunkFrames: 1800, output: out, renderChunk: fake(calls), combine });
    expect(r).toEqual({ chunks: 3, reused: 2, rendered: 1 });
    expect(calls).toEqual(["3600-3999"]);
    expect(readFileSync(out, "utf8")).toBe("v0-1799|v1800-3599|v3600-3999#a0-1799|a1800-3599|a3600-3999");
    // قطعة تالفة: تُعاد وحدها
    await writeFile(path.join(dir, "chunk-0001.mp4"), "تالف");
    calls.length = 0;
    expect(await renderChunked({ dir, key: "job-a", totalFrames: 4000, chunkFrames: 1800, output: out, renderChunk: fake(calls), combine })).toMatchObject({ reused: 2, rendered: 1 });
    expect(calls).toEqual(["1800-3599"]);
    // مهمة أخرى (commit أو خطة أو مواصفات أخرى) لا تأخذ قطع غيرها
    calls.length = 0;
    expect(await renderChunked({ dir, key: "job-b", totalFrames: 4000, chunkFrames: 1800, output: out, renderChunk: fake(calls), combine })).toMatchObject({ reused: 0, rendered: 3 });
  });
  it("مجلد القطع بجوار ناتج العامل", () => {
    expect(chunkDirFor("/w/out/worker/trial-x-master-1.mp4")).toBe("/w/out/worker/trial-x-master-1.chunks");
  });
});

describe("حزمة واحدة للحلقة على العامل", () => {
  it("المفتاح من الـcommit ولقطة الوسائط وحدهما", () => {
    const k = bundleCacheKeyFor("a".repeat(40), media);
    expect(k).toMatch(/^[a-f0-9]{32}$/);
    expect(bundleCacheKeyFor("a".repeat(40), { ...media })).toBe(k);
    expect(bundleCacheKeyFor("c".repeat(40), media)).not.toBe(k);
    expect(bundleCacheKeyFor("a".repeat(40), { base: media.base.replace(HASH, "f".repeat(24)) })).not.toBe(k);
  });
  it("تُبنى مرة وتُعاد للمفتاح نفسه، ولا تُحذف بعد الرندر، ويبقى أحدثها فقط", async () => {
    const root = await tmp("bal-bundle-cache-");
    const prev = process.env.BAL_BUNDLE_CACHE_DIR;
    process.env.BAL_BUNDLE_CACHE_DIR = root;
    try {
      let builds = 0;
      const build = (async (o: { outDir: string }) => { builds++; await mkdir(o.outDir, { recursive: true }); await writeFile(path.join(o.outDir, "index.html"), "x"); return o.outDir; }) as never;
      const key = (i: number) => String(i).repeat(32);
      const a = await cachedRenderBundle(emptyMedia, key(1), { build });
      expect(a.reused).toBe(false);
      await a.cleanup();
      expect(existsSync(path.join(a.serveUrl, "index.html"))).toBe(true);
      const b = await cachedRenderBundle(emptyMedia, key(1), { build });
      expect(b).toMatchObject({ reused: true, serveUrl: a.serveUrl });
      expect(builds).toBe(1);
      for (let i = 2; i <= BUNDLE_CACHE_KEEP + 2; i++) {
        await cachedRenderBundle(emptyMedia, key(i), { build });
        const t = new Date(Date.now() + i * 1000);
        await utimes(path.join(root, `${key(i)}.complete`), t, t);
      }
      const left = (await readdir(root)).filter((x) => x.endsWith(".complete"));
      expect(left).toHaveLength(BUNDLE_CACHE_KEEP);
      expect(left).not.toContain(`${key(1)}.complete`);
      await expect(cachedRenderBundle(emptyMedia, "../x", { build })).rejects.toThrow(/غير صالح/);
    } finally {
      if (prev === undefined) delete process.env.BAL_BUNDLE_CACHE_DIR; else process.env.BAL_BUNDLE_CACHE_DIR = prev;
    }
  });
});
