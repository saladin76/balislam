import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import config from "../config.json";
import { ensureQueue, jobPriority, pendingJobs, planSha256, queuePaths, sizeFor, validateJobV2, writeJsonAtomic, type WorkerJobV2, type WorkerResult } from "../src/render/worker/protocol";
import { cutArgs, cutFilter, resolveCutSource, TITLE_FADE_SEC } from "../src/render/worker/verticalCut";
import { cutRangesFor, cutSeconds, sceneStartsInCut, shortTitleSeconds, verticalSceneSpans, type SceneSpan } from "../src/render/worker/verticalShorts";
import { approvedVertical, importStudioJobs, readStudioIndex, rememberSentJob, type StudioImportDeps } from "../src/render/worker/studioJobs";
import { buildCutJob } from "../src/render/worker/macJobs";
import { recordPreviewProvenance } from "../src/render/worker/provenance";
import { QUALITY, isPublishQuality } from "../src/render/quality";
import type { VideoProbe } from "../src/render/worker/probe";

// D243: every episode gets a full vertical version (1080×1920, composed for vertical), rendered on Windows after every scene
// is approved, behind the Master in the queue; every short is a cut of it (D241 kept); it is deleted after the shorts are published.
const owned: string[] = [];
afterEach(async () => { for (const d of owned.splice(0)) await rm(d, { recursive: true, force: true }); });
const tmp = async (p: string) => { const d = await mkdtemp(path.join(tmpdir(), p)); owned.push(d); return d; };
const root = path.join(__dirname, "..");
const src = (f: string) => readFileSync(path.join(root, f), "utf8");
const sha = (b: string) => createHash("sha256").update(b).digest("hex");

const HASH = "0123456789abcdef01234567";
const EP = "002-ibna-adam";
const plan = { episode: "002", title: "حلقة", chapters: [{ number: 1, title: "", scenes: [
  { id: "c1-s1", narration: "متى بدأت القصة؟" }, { id: "c1-s2", narration: "بدأت هنا." }, { id: "c1-s3", narration: "ثم مضت." }] }],
  shorts: [{ from: "c1-s1", to: "c1-s2", title: "متى بدأت القصة؟" }] };
const media = { mode: "static", base: `_render/dafatir-alzaman/${EP}/${HASH}/`, voice: {}, sfx: [], recitations: {} };
const base = (over: Record<string, unknown>) => ({
  version: 2, channel: "dafatir-alzaman", episode: EP, purpose: "studio", commit: "b".repeat(40),
  media: `render-queue/media/dafatir-alzaman/${EP}/${HASH}`, createdAt: "2026-11-28T10:00:00.000Z",
  inputs: { planSha256: planSha256(plan), plan, media, narrationGain: { "c1-s1": 1.02 } }, ...over,
}) as unknown as WorkerJobV2;
const verticalJob = (over: Record<string, unknown> = {}) => base({
  id: "dafatir-alzaman-002-vertical-abcdef012345", kind: "vertical",
  render: { orientation: "portrait", quality: "vertical", scope: { all: true }, scenePreview: false, timingMode: "approved" },
  expected: { durationSec: 480, width: 1080, height: 1920 }, ...over,
});
const cutJob = (over: Record<string, unknown> = {}) => base({
  id: "dafatir-alzaman-002-cut-1-abcdef012345", kind: "cut", n: 1,
  cut: { source: { job: "dafatir-alzaman-002-vertical-abcdef012345", sha256: "c".repeat(64) }, sceneIds: ["c1-s1", "c1-s2"], ranges: [{ from: 0, to: 600 }], fps: 30 },
  expected: { durationSec: 20, width: 1080, height: 1920 }, ...over,
});

describe("D243: the vertical quality and the job kinds", () => {
  it("vertical = Master's encoder settings (crf 14, slow, AAC 320k) at 1080×1920, normalised like everything published", () => {
    expect(QUALITY.vertical).toMatchObject({ scale: 1, crf: QUALITY.master.crf, x264Preset: "slow", audioBitrate: "320k" });
    expect(sizeFor("vertical", "portrait")).toEqual({ width: 1080, height: 1920 });
    expect(config.video.short).toEqual({ width: 1080, height: 1920 });
    expect(isPublishQuality("vertical")).toBe(true);
    expect(isPublishQuality("preview")).toBe(false);
    expect(src("src/render/episode.ts")).toContain("if (isPublishQuality(o.quality) && !o.scenePreview)");
  });

  it("a vertical job is the whole episode, portrait, vertical quality, studio only", () => {
    expect(validateJobV2(verticalJob()).kind).toBe("vertical");
    expect(() => validateJobV2(verticalJob({ expected: { durationSec: 480, width: 2160, height: 3840 } }))).toThrow(/1080×1920/);
    expect(() => validateJobV2(verticalJob({ render: { orientation: "portrait", quality: "vertical", scope: { chapter: 1 }, scenePreview: false, timingMode: "approved" } }))).toThrow(/النسخة العمودية/);
    expect(() => validateJobV2(verticalJob({ render: { orientation: "landscape", quality: "vertical", scope: { all: true }, scenePreview: false, timingMode: "approved" }, expected: { durationSec: 480, width: 1920, height: 1080 } }))).toThrow(/portrait/);
    expect(() => validateJobV2(verticalJob({ render: { orientation: "portrait", quality: "master", scope: { all: true }, scenePreview: false, timingMode: "approved" }, expected: { durationSec: 480, width: 2160, height: 3840 } }))).toThrow(/النسخة العمودية/);
    expect(() => validateJobV2(verticalJob({ purpose: "trial", trial: "x", id: "trial-x-vertical-abcdef012345" }))).toThrow(/للاستوديو وحده/);
    // the vertical quality belongs to the vertical and its trials, never to a Master or a scene cut
    expect(() => validateJobV2(base({ id: "dafatir-alzaman-002-master-abcdef012345", kind: "master",
      render: { orientation: "portrait", quality: "vertical", scope: { all: true }, scenePreview: false, timingMode: "approved" }, expected: { durationSec: 480, width: 1080, height: 1920 } }))).toThrow();
  });

  it("a vertical trial of chosen scenes: kind trial, portrait, vertical quality", () => {
    const t = base({ id: "trial-002-vertical-trial-v-c1-s2-abcdef012345", kind: "trial", purpose: "trial", trial: "002-vertical",
      render: { orientation: "portrait", quality: "vertical", scope: { all: true }, scenePreview: false, timingMode: "scene-preview" }, expected: { durationSec: 9.5, width: 1080, height: 1920 } });
    expect(validateJobV2(t).render?.quality).toBe("vertical");
  });

  it("a cut names its vertical by job id and fingerprint, frames in order, duration = the frames", () => {
    expect(validateJobV2(cutJob()).cut?.ranges).toEqual([{ from: 0, to: 600 }]);
    expect(() => validateJobV2(cutJob({ expected: { durationSec: 21, width: 1080, height: 1920 } }))).toThrow(/مجموع/);
    const overlap = cutJob({ expected: { durationSec: 30, width: 1080, height: 1920 } });
    (overlap.cut as { ranges: unknown }).ranges = [{ from: 0, to: 600 }, { from: 500, to: 800 }];
    expect(() => validateJobV2(overlap)).toThrow(/متداخلة/);
    for (const job of ["../x", "done/x", "C:x"]) {
      const bad = cutJob(); (bad.cut as { source: { job: string } }).source.job = job;
      expect(() => validateJobV2(bad)).toThrow();
    }
    const noN = cutJob(); delete (noN as { n?: number }).n;
    expect(() => validateJobV2(noN)).toThrow(/رقم الشورت/);
    expect(() => validateJobV2(cutJob({ render: { orientation: "portrait", quality: "vertical", scope: { all: true }, scenePreview: false, timingMode: "approved" } }))).toThrow();
    expect(() => validateJobV2(cutJob({ expected: { durationSec: 20, width: 2160, height: 3840 } }))).toThrow(/1080×1920/);
    expect(() => validateJobV2({ ...verticalJob(), cut: cutJob().cut })).toThrow(/القص/);
  });

  it("queue priority: a waiting Master (and every other job) goes before an older vertical and its cuts", async () => {
    const share = await tmp("bal-share-");
    const q = await ensureQueue(share);
    const v = verticalJob({ createdAt: "2026-11-28T09:00:00.000Z" });
    const c = cutJob({ createdAt: "2026-11-28T09:30:00.000Z" });
    const m = base({ id: "dafatir-alzaman-002-master-abcdef012345", kind: "master", createdAt: "2026-11-28T11:00:00.000Z",
      render: { orientation: "landscape", quality: "master", scope: { all: true }, scenePreview: false, timingMode: "approved", review1080: true },
      expected: { durationSec: 480, width: 3840, height: 2160 } });
    for (const j of [v, c, m]) await writeJsonAtomic(path.join(q.jobs, `${j.id}.json`), j);
    expect((await pendingJobs(share)).map((j) => j.kind)).toEqual(["master", "vertical", "cut"]);
    expect([jobPriority("master"), jobPriority("scene"), jobPriority("vertical"), jobPriority("cut")]).toEqual([0, 0, 1, 1]);
  });
});

describe("D243: shorts are frame-exact cuts of the vertical", () => {
  // three 10 s scenes; the narration seam overlaps 12 frames between c1-s1 and c1-s2 (computed by hand here)
  const spans: SceneSpan[] = [
    { id: "c1-s1", start: 0, clean: 0, end: 288 },
    { id: "c1-s2", start: 288, clean: 300, end: 600 },
    { id: "c1-s3", start: 600, clean: 600, end: 900 },
  ];
  it("a contiguous short is one range from its first scene's clean start to the next scene's start", () => {
    expect(cutRangesFor(spans, { sceneIds: ["c1-s1", "c1-s2"] })).toEqual([{ from: 0, to: 600 }]);
    expect(cutRangesFor(spans, { sceneIds: ["c1-s2", "c1-s3"] })).toEqual([{ from: 300, to: 900 }]);
  });
  it("D241 parts (non-consecutive scenes) are separate ranges joined by a straight cut, in episode order", () => {
    expect(cutRangesFor(spans, { sceneIds: ["c1-s1", "c1-s3"] })).toEqual([{ from: 0, to: 288 }, { from: 600, to: 900 }]);
    expect(cutRangesFor(spans, { sceneIds: ["c1-s1", "c1-s3"], parts: [["c1-s1"], ["c1-s3"]] })).toEqual([{ from: 0, to: 288 }, { from: 600, to: 900 }]);
    expect(() => cutRangesFor(spans, { sceneIds: ["c1-s3", "c1-s1"], parts: [["c1-s3"], ["c1-s1"]] })).toThrow(/متداخلة/);
    expect(() => cutRangesFor(spans, { sceneIds: ["c9-s9"] })).toThrow(/ليس في النسخة العمودية/);
    expect(cutSeconds([{ from: 0, to: 288 }, { from: 600, to: 900 }])).toBe(19.6);
  });
  it("subtitles follow the cut: each scene starts where its frames are in the cut file", () => {
    const at = sceneStartsInCut(spans, { sceneIds: ["c1-s2", "c1-s3"] });
    expect(at.get("c1-s2")).toBeCloseTo(-12 / 30, 6); // the trimmed seam: its words still start at their own time
    expect(at.get("c1-s3")).toBeCloseTo(300 / 30, 6);
  });
  it("spans come from the episode composition itself (scene frames minus the seam overlap)", () => {
    const s = verticalSceneSpans(plan as never, media as never, 0);
    expect(s.map((x) => x.id)).toEqual(["c1-s1", "c1-s2", "c1-s3"]);
    for (let i = 1; i < s.length; i++) expect(s[i]!.start).toBe(s[i - 1]!.end);
    for (const x of s) expect(x.clean).toBeGreaterThanOrEqual(x.start);
  });
  it("re-encodes frame-exact at the vertical quality (stream copy cuts only on keyframes)", () => {
    const a = cutArgs("in.mp4", "out.mp4", [{ from: 0, to: 288 }, { from: 600, to: 900 }], 30);
    const at = (k: string) => a[a.indexOf(k) + 1];
    expect([at("-c:v"), at("-preset"), at("-crf"), at("-c:a"), at("-b:a"), at("-pix_fmt"), at("-colorspace")]).toEqual(["libx264", "slow", "14", "aac", "320k", "yuv420p", "bt709"]);
    expect(a).not.toContain("copy");
    expect(cutFilter([{ from: 0, to: 288 }, { from: 600, to: 900 }], 30)).toBe(
      "[0:v]trim=start_frame=0:end_frame=288,setpts=PTS-STARTPTS[v0];[0:a]atrim=start=0.000000:end=9.600000,asetpts=PTS-STARTPTS[a0];"
      + "[0:v]trim=start_frame=600:end_frame=900,setpts=PTS-STARTPTS[v1];[0:a]atrim=start=20.000000:end=30.000000,asetpts=PTS-STARTPTS[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]");
  });
  it("buildCutJob: the vertical's own inputs, its fingerprint, and the frames; refuses any other source", () => {
    const v = verticalJob();
    const job = buildCutJob(v, "d".repeat(64), 2, ["c1-s1", "c1-s3"], [{ from: 0, to: 288 }, { from: 600, to: 900 }],
      { channel: "dafatir-alzaman", episodeFolder: EP, commit: "b".repeat(40), purpose: "studio", createdAt: "2026-11-28T12:00:00.000Z" });
    expect(job.kind).toBe("cut");
    expect(job.cut?.source).toEqual({ job: v.id, sha256: "d".repeat(64) });
    expect(job.inputs).toEqual(v.inputs);
    expect(job.expected).toEqual({ durationSec: 19.6, width: 1080, height: 1920 });
    expect(() => buildCutJob({ ...v, kind: "master" }, "d".repeat(64), 1, ["c1-s1"], [{ from: 0, to: 288 }],
      { channel: "dafatir-alzaman", episodeFolder: EP, commit: "b".repeat(40), purpose: "studio", createdAt: "x" })).toThrow(/النسخة العمودية وحدها/);
  });
});

/** done/<id>/ as the worker leaves it */
const finish = async (share: string, job: WorkerJobV2, bytes: string, worker = "Salah") => {
  const dir = path.join(queuePaths(share).done, job.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${job.id}.mp4`), bytes);
  const result: WorkerResult = { id: job.id, sha256: sha(bytes), bytes: Buffer.byteLength(bytes), durationSec: job.expected.durationSec, width: job.expected.width,
    height: job.expected.height, commit: job.commit, worker, startedAt: "2026-11-28T10:01:00.000Z", finishedAt: "2026-11-28T11:05:00.000Z", logTail: "" };
  await writeFile(path.join(dir, "result.json"), JSON.stringify(result));
  await writeFile(path.join(dir, "job.json"), JSON.stringify({ ...job, claimedBy: worker, claimedAt: "2026-11-28T10:01:00.000Z" }));
  return result;
};

describe("D243: the worker finds the vertical by fingerprint", () => {
  it("resolveCutSource accepts only this episode's studio vertical with the exact bytes", async () => {
    const share = await tmp("bal-share-");
    const v = verticalJob();
    const r = await finish(share, v, "vertical-bytes");
    const job = cutJob(); (job.cut as { source: { sha256: string } }).source.sha256 = r.sha256;
    expect((await resolveCutSource(share, job)).sha256).toBe(r.sha256);
    const wrong = cutJob(); (wrong.cut as { source: { sha256: string } }).source.sha256 = "e".repeat(64);
    await expect(resolveCutSource(share, wrong)).rejects.toThrow(/بصمة/);
    const other = cutJob({ episode: "004-kayfa-bada-al-shirk" }); (other.cut as { source: { sha256: string } }).source.sha256 = r.sha256;
    await expect(resolveCutSource(share, other)).rejects.toThrow(/ليست النسخة العمودية/);
    const missing = cutJob(); (missing.cut as { source: { job: string } }).source.job = "dafatir-alzaman-002-vertical-ffffffffffff";
    await expect(resolveCutSource(share, missing)).rejects.toThrow(/غير موجودة/);
  });
});

const setup = async () => {
  const share = await tmp("bal-share-");
  const epDir = await tmp("bal-ep-");
  const scriptPath = path.join(epDir, "script.md");
  await writeFile(scriptPath, "---\n---\n");
  const previews = path.join(epDir, "previews");
  await mkdir(previews, { recursive: true });
  for (const s of plan.chapters[0]!.scenes) {
    await writeFile(path.join(previews, `scene-${s.id}-av.mp4`), `cut-${s.id}`);
    await recordPreviewProvenance(previews, s.id, { machine: "Salah", commit: "b".repeat(40), sha256: sha(`cut-${s.id}`) });
  }
  const calls: string[] = [];
  const probes = new Map<string, VideoProbe>();
  let masterOk = true;
  const deps: StudioImportDeps = {
    sha256File: async (f) => sha(await readFile(f, "utf8")),
    probe: async (f) => probes.get(path.basename(f, ".mp4"))!,
    measureMotion: async () => ({ percent: 91, seconds: 12, activeSeconds: 11, perSecond: [], still: [] }),
    scene: { current: async () => { throw new Error("no"); }, allowed: async () => {}, publish: async () => { throw new Error("no"); }, evidence: async () => {} },
    join: { cuts: async () => [], planSha256: async () => planSha256(plan), publish: async () => { throw new Error("no"); }, record: async () => {} },
    master: {
      current: async () => ({ planSha256: planSha256(plan), mediaBase: media.base, gain: { "c1-s1": 1.02 } }),
      gates: async () => { calls.push("master-gates"); },
      package: async () => { throw new Error("no"); },
    },
    cut: {
      masterApproved: async () => { calls.push("master-approved"); if (!masterOk) throw new Error("Master غير معتمد"); },
      current: async () => ({ plan: plan as never, media: media as never, introFrames: 0 }),
      collect: async (_ep, job) => { calls.push(`collect ${job.n}`); return { file: path.join(epDir, "out", "package", `002-short-${job.n}.mp4`), sha: "f".repeat(64), motion: 88 }; },
      title: async () => undefined,
    },
  };
  const probeFor = (job: WorkerJobV2): VideoProbe => ({ videoCodec: "h264", audioCodec: "aac", width: job.expected.width, height: job.expected.height, durationSec: job.expected.durationSec, tags: [] }) as unknown as VideoProbe;
  return { share, epDir, scriptPath, calls, probes, deps, probeFor, setMaster: (v: boolean) => { masterOk = v; } };
};

describe("D243: the vertical comes back verified like the Master, and only then are shorts cut", () => {
  it("import: verified against the job as sent, the current inputs, D233 and every Master gate; stays on the share (no copy)", async () => {
    const t = await setup();
    const v = verticalJob();
    await rememberSentJob(t.scriptPath, v);
    const r0 = await finish(t.share, v, "vertical-bytes");
    t.probes.set(v.id, t.probeFor(v));
    const r = await importStudioJobs("002", t.share, { deps: t.deps, scriptPath: t.scriptPath });
    expect(r.refused).toEqual([]);
    expect(t.calls).toContain("master-gates");
    const rec = (await readStudioIndex(t.scriptPath)).jobs[v.id]!;
    expect(rec.imported?.sha256).toBe(r0.sha256);
    expect(rec.imported?.file).toBe(path.join(queuePaths(t.share).done, v.id, `${v.id}.mp4`));
    expect(existsSync(path.join(t.epDir, "out", "package"))).toBe(false);
  });

  it("import refuses a vertical made from other inputs or on another machine", async () => {
    const t = await setup();
    const v = verticalJob();
    await rememberSentJob(t.scriptPath, v);
    await finish(t.share, v, "vertical-bytes", "OtherPC");
    t.probes.set(v.id, t.probeFor(v));
    t.deps.master.current = async () => ({ planSha256: planSha256(plan), mediaBase: media.base, gain: { "c1-s1": 1.5 } });
    const r = await importStudioJobs("002", t.share, { deps: t.deps, scriptPath: t.scriptPath });
    expect(r.refused[0]!.reasons!.join(" ")).toMatch(/علوّ السرد/);
    expect(r.refused[0]!.reasons!.join(" ")).toMatch(/D233/);
  });

  it("approvedVertical: refuses with no imported vertical, a stale one, or an unapproved Master", async () => {
    const t = await setup();
    const cur = { planSha256: planSha256(plan), mediaBase: media.base, gain: { "c1-s1": 1.02 } };
    await expect(approvedVertical("002", t.scriptPath, cur, async () => {})).rejects.toThrow(/لا شورتس بلا نسخة عمودية/);
    const v = verticalJob();
    await rememberSentJob(t.scriptPath, v);
    await finish(t.share, v, "vertical-bytes");
    t.probes.set(v.id, t.probeFor(v));
    await importStudioJobs("002", t.share, { deps: t.deps, scriptPath: t.scriptPath });
    expect((await approvedVertical("002", t.scriptPath, cur, async () => {})).sha256).toBe(sha("vertical-bytes"));
    await expect(approvedVertical("002", t.scriptPath, { ...cur, mediaBase: "_render/x/" }, async () => {})).rejects.toThrow(/قديمة/);
    await expect(approvedVertical("002", t.scriptPath, cur, async () => { throw new Error("لا Master معتمد"); })).rejects.toThrow(/اعتماد Master/);
  });

  it("a cut is imported only from the imported vertical with the same bytes, the same frames, D241 and an approved Master", async () => {
    const t = await setup();
    const v = verticalJob();
    await rememberSentJob(t.scriptPath, v);
    const rv = await finish(t.share, v, "vertical-bytes");
    t.probes.set(v.id, t.probeFor(v));
    await importStudioJobs("002", t.share, { deps: t.deps, scriptPath: t.scriptPath });
    const ranges = cutRangesFor(verticalSceneSpans(plan as never, media as never, 0), { sceneIds: ["c1-s1", "c1-s2"] });
    const c = buildCutJob(v, rv.sha256, 1, ["c1-s1", "c1-s2"], ranges,
      { channel: "dafatir-alzaman", episodeFolder: EP, commit: "b".repeat(40), purpose: "studio", createdAt: "2026-11-28T12:00:00.000Z" });
    await rememberSentJob(t.scriptPath, c);
    await finish(t.share, c, "short-bytes");
    t.probes.set(c.id, t.probeFor(c));
    t.setMaster(false);
    const refused = await importStudioJobs("002", t.share, { deps: t.deps, scriptPath: t.scriptPath, kinds: ["cut"] });
    expect(refused.refused[0]!.reasons!.join(" ")).toMatch(/Master/);
    expect(t.calls).not.toContain("collect 1");
    t.setMaster(true);
    const ok = await importStudioJobs("002", t.share, { deps: t.deps, scriptPath: t.scriptPath, kinds: ["cut"] });
    expect(ok.refused).toEqual([]);
    expect(ok.rows.map((x) => x.kind)).toEqual(["cut"]);
    expect(t.calls).toContain("collect 1");
  });
});

describe("D243: the short's title (owner, 28 Nov): the short hook for the first 3 seconds only, inside the safe area", () => {
  it("3 seconds, or until the first intended stillness (minus the fade); none if the short opens in stillness", () => {
    expect(shortTitleSeconds([])).toBe(3);
    expect(shortTitleSeconds([{ from: 2.5, to: 6 }])).toBe(2.2);
    expect(shortTitleSeconds([{ from: 0, to: 4 }])).toBeNull();
    expect(shortTitleSeconds([{ from: 1.1, to: 4 }])).toBeNull();
    expect(shortTitleSeconds([{ from: 9, to: 12 }])).toBe(3);
  });
  it("the cut burns the channel-style PNG over the first seconds with a short fade, then the picture goes on without it", () => {
    const a = cutArgs("in.mp4", "out.mp4", [{ from: 0, to: 288 }], 30, undefined, { png: "t.png", seconds: 3 });
    expect(a.slice(a.indexOf("-framerate"), a.indexOf("t.png") + 1)).toEqual(["-framerate", "30", "-loop", "1", "-t", "3.000", "-i", "t.png"]);
    const f = cutFilter([{ from: 0, to: 288 }], 30, 3);
    expect(f).toContain(`fade=t=in:st=0:d=${TITLE_FADE_SEC}:alpha=1,fade=t=out:st=2.700:d=${TITLE_FADE_SEC}:alpha=1[t]`);
    expect(f).toContain("[vc][t]overlay=0:0:eof_action=pass");
    expect(f.endsWith("[v]")).toBe(true);
    // without a title the filter is the plain cut
    expect(cutFilter([{ from: 0, to: 288 }], 30)).not.toContain("overlay");
  });
  it("the job carries the title only within its rules, and the worker refuses a traced title before drawing", () => {
    const withTitle = (title: unknown) => { const j = cutJob(); (j.cut as Record<string, unknown>).title = title; return j; };
    expect(validateJobV2(withTitle({ text: "متى بدأت القصة؟", seconds: 3 })).cut?.title?.seconds).toBe(3);
    expect(() => validateJobV2(withTitle({ text: "متى؟", seconds: 4 }))).toThrow(/مدة عنوان/);
    expect(() => validateJobV2(withTitle({ text: "سطر\nآخر", seconds: 3 }))).toThrow(/نص عنوان/);
    expect(() => validateJobV2(withTitle({ text: "متى؟", seconds: 3, png: "C:/x.png" }))).toThrow(/حقل غير معروف/);
    const src = readFileSync(path.join(root, "src/render/worker/verticalCut.ts"), "utf8");
    const body = src.slice(src.indexOf("export const cutVertical"));
    expect(body.indexOf("findTraces(cut.title.text)")).toBeLessThan(body.indexOf("renderShortTitlePng("));
    expect(src).toContain('id: "short-title"');
    expect(readFileSync(path.join(root, "src/remotion/Root.tsx"), "utf8")).toContain('<Still id="short-title" component={ShortTitleStill}');
    // the title box is the ShortTitle text itself, inside the D243 safe area (tests/vertical-safe-area.test.tsx)
    expect(readFileSync(path.join(root, "src/remotion/scenes/ShortTitle.tsx"), "utf8")).toContain("<ShortTitleText text={text} opacity={1} k={1} />");
  });
  it("Mac side: the title is the short's own title from the publish kit, traces-checked, with its seconds from the short's stillness", () => {
    const src = readFileSync(path.join(root, "src/render/worker/studioJobs.ts"), "utf8");
    const b = src.slice(src.indexOf("export const cutTitleFor"), src.indexOf("/* ── importing ── */"));
    expect(b.indexOf("shortTitleFor(")).toBeLessThan(b.indexOf("assertNoTraces("));
    expect(b).toContain("shortTitleSeconds(intendedStillness(");
    expect(src).toContain("تغيّر عنوان الشورت");
  });
});

describe("D243: the gates in source order (like the Master)", () => {
  const body = (f: string, from: string, to?: string) => { const s = src(f); const a = s.indexOf(from); return s.slice(a, to ? s.indexOf(to, a + 1) : undefined); };
  it("worker-submit-vertical: editor, bal make preflight without voice, every Master gate, then the job", () => {
    const b = body("src/render/worker/studioJobs.ts", "export const submitStudioVertical", "export type VerticalSource");
    const order = ["assertEditorPassed(", "finalPreflight(", "assertNoVoiceToGenerate(", "assertMasterRenderGates(", "buildVerticalJob(", "enqueue("];
    const at = order.map((x) => b.indexOf(x));
    expect(at.every((x) => x > 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    const build = body("src/render/worker/macJobs.ts", "export const buildVerticalJob", "export const buildCutJob");
    expect(build.indexOf("assertMasterReady(")).toBeLessThan(build.indexOf("publishSnapshot("));
    expect(build).toContain("MAC_MACHINE");
  });
  it("worker-submit --shorts cuts the vertical (D241 on every short) and no path renders a short on its own", () => {
    const b = body("src/render/worker/studioJobs.ts", "export const submitVerticalShorts", "/* ── importing ── */");
    expect(b.indexOf("approvedVertical(")).toBeLessThan(b.indexOf("buildCutJob("));
    expect(b.indexOf("assertShortsIdea(")).toBeLessThan(b.indexOf("buildCutJob("));
    expect(src("src/cli/index.ts")).toContain("submitVerticalShorts(episode");
    expect(body("src/render/worker/macSide.ts", "export const submitWorkerShorts", "export const verifyWorkerOutput")).toMatch(/if \(!o\.legacyD226\) throw/);
    const pkg = src("src/package/package.ts");
    expect(pkg.indexOf("if (!opts.skipVideo) throw new Error(SHORTS_FROM_VERTICAL)")).toBeLessThan(pkg.indexOf("prepareRenderMedia(ep, plan"));
    expect(src("src/render/episode.ts")).toContain('if (opts.quality === "vertical") throw');
    expect(src("src/render/worker/untrustedRender.ts")).toContain("assertShortRenderIdea(plan, { sceneIds: job.cut.sceneIds })");
  });
});
