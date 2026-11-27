import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { planSha256, queuePaths, seamsName, type WorkerJobV2, type WorkerResult } from "../src/render/worker/protocol";
import { importStudioJobs, parseSeams, readStudioIndex, rememberSentJob, type StudioImportDeps } from "../src/render/worker/studioJobs";
import { provenanceFile } from "../src/render/worker/provenance";
import type { VideoProbe } from "../src/render/worker/probe";

// D232 phase 2: the studio's renders on the Windows worker come back through the same ledger as a Mac render. Nothing is
// rendered here: the worker's done/ folder is built by hand and every heavy step (probe, motion, ledger) is injected.
const owned: string[] = [];
afterEach(async () => { for (const d of owned.splice(0)) await rm(d, { recursive: true, force: true }); });
const tmp = async (p: string) => { const d = await mkdtemp(path.join(tmpdir(), p)); owned.push(d); return d; };
const root = path.join(__dirname, "..");
const src = (f: string) => readFileSync(path.join(root, f), "utf8");
const sha = (b: string) => createHash("sha256").update(b).digest("hex");

const HASH = "0123456789abcdef01234567";
const EP = "002-bidayat";
const plan = { episode: "002", title: "حلقة", chapters: [{ number: 1, title: "", scenes: [{ id: "c1-s1", narration: "نص" }, { id: "c1-s2", narration: "نص ٢" }] }] };
const media = { mode: "static", base: `_render/dafatir-alzaman/${EP}/${HASH}/`, voice: {}, sfx: [], recitations: {} };
const base = (over: Record<string, unknown>) => ({
  version: 2, channel: "dafatir-alzaman", episode: EP, purpose: "studio", commit: "b".repeat(40),
  media: `render-queue/media/dafatir-alzaman/${EP}/${HASH}`, createdAt: "2026-11-27T10:00:00.000Z",
  inputs: { planSha256: planSha256(plan), plan, media, narrationGain: {} }, ...over,
}) as unknown as WorkerJobV2;
const sceneJob = (id: string, at = "2026-11-27T10:00:00.000Z") => base({
  id: `dafatir-alzaman-002-scene-${id}-abcdef012345`.replace(/-abcdef012345$/, `-${sha(id + at).slice(0, 12)}`), kind: "scene", sceneId: id, createdAt: at,
  render: { orientation: "landscape", quality: "preview", scope: { sceneIds: [id] }, scenePreview: true, timingMode: "scene-preview" },
  expected: { durationSec: 12.4, width: 1920, height: 1080 },
});
const probeFor = (job: WorkerJobV2, over: Partial<VideoProbe> = {}): VideoProbe =>
  ({ videoCodec: "h264", audioCodec: "aac", width: job.expected.width, height: job.expected.height, durationSec: job.expected.durationSec, tags: [], ...over }) as VideoProbe;

/** done/<id>/ as the worker leaves it: the file, its result and the job it ran. */
const finish = async (share: string, job: WorkerJobV2, bytes: string, o: { worker?: string; extra?: Record<string, string> } = {}) => {
  const dir = path.join(queuePaths(share).done, job.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${job.id}.mp4`), bytes);
  const result: WorkerResult = { id: job.id, sha256: sha(bytes), bytes: Buffer.byteLength(bytes), durationSec: job.expected.durationSec, width: job.expected.width,
    height: job.expected.height, commit: job.commit, worker: o.worker ?? "Salah", startedAt: "2026-11-27T10:01:00.000Z", finishedAt: "2026-11-27T10:05:00.000Z", logTail: "" };
  await writeFile(path.join(dir, "result.json"), JSON.stringify(result));
  await writeFile(path.join(dir, "job.json"), JSON.stringify({ ...job, claimedBy: "Salah", claimedAt: "2026-11-27T10:01:00.000Z" }));
  for (const [name, text] of Object.entries(o.extra ?? {})) await writeFile(path.join(dir, name), text);
  return result;
};

const setup = async () => {
  const share = await tmp("bal-share-");
  const epDir = await tmp("bal-ep-");
  const scriptPath = path.join(epDir, "script.md");
  await writeFile(scriptPath, "---\n---\n");
  const calls: string[] = [];
  const probes = new Map<string, VideoProbe>();
  const deps: StudioImportDeps = {
    sha256File: async (f) => sha(await readFile(f, "utf8")),
    probe: async (f) => probes.get(path.basename(f, ".mp4"))!,
    measureMotion: async () => ({ percent: 91, seconds: 12, activeSeconds: 11, perSecond: [], still: [] }),
    scene: {
      current: async () => ({ planSha256: planSha256(plan), mediaBase: media.base, exempt: new Set() }),
      allowed: async (_ep, id, s, mode) => { calls.push(`allowed ${id} ${s.slice(0, 4)} ${mode}`); },
      publish: async (_ep, slot, file) => {
        const out = path.join(epDir, "previews", `${slot}.mp4`);
        await mkdir(path.dirname(out), { recursive: true });
        await copyFile(file, out);
        calls.push(`publish ${slot}`);
        return { file: out };
      },
      evidence: async (_ep, id, s, mode) => { calls.push(`evidence ${id} ${s.slice(0, 4)} ${mode}`); },
    },
    join: {
      cuts: async () => [],
      planSha256: async () => planSha256(plan),
      publish: async (kind, _ep, _sp, file, joined) => {
        const out = path.join(epDir, "previews", kind === "assembly" ? "episode.mp4" : "prefinal-no-recitation.mp4");
        await copyFile(file, out);
        calls.push(`publish-join ${kind} seams=${joined ? "yes" : "no"}`);
        return { file: out };
      },
      record: async (_ep, s) => { calls.push(`record-assembly ${s.slice(0, 6)}`); },
    },
    master: {
      current: async () => ({ planSha256: planSha256(plan), mediaBase: media.base, gain: {} }),
      gates: async () => { calls.push("master-gates"); },
      package: async (_ep, masterFrom) => {
        const target = path.join(epDir, "out", "package", "002-episode.mp4");
        await mkdir(path.dirname(target), { recursive: true });
        calls.push(`package ${path.basename(await masterFrom(target))}`);
      },
    },
  };
  const run = () => importStudioJobs("002", share, { deps, scriptPath });
  return { share, epDir, scriptPath, calls, probes, deps, run };
};

describe("D232 phase 2: worker-import of scene cuts", () => {
  it("a verified cut enters the studio as a ready DRAFT: preview slot, D233 provenance, the ledger's render proof — never a decision", async () => {
    const t = await setup();
    const job = sceneJob("c1-s1");
    await rememberSentJob(t.scriptPath, job, { sourceSha256: "a".repeat(64), mode: "ahead" });
    await finish(t.share, job, "cut-bytes");
    t.probes.set(job.id, probeFor(job));
    const r = await t.run();
    expect(r.refused).toEqual([]);
    expect(r.imported.map((x) => x.sceneId)).toEqual(["c1-s1"]);
    expect(await readFile(path.join(t.epDir, "previews", "scene-c1-s1-av.mp4"), "utf8")).toBe("cut-bytes");
    // the scene's own render permission before and right before publishing, then the proof; no submit/approve exists here
    expect(t.calls).toEqual(["allowed c1-s1 aaaa ahead", "allowed c1-s1 aaaa ahead", "publish scene-c1-s1-av", "evidence c1-s1 aaaa ahead"]);
    const prov = JSON.parse(await readFile(provenanceFile(path.join(t.epDir, "previews")), "utf8"));
    expect(prov.scenes["c1-s1"]).toEqual({ machine: "Salah", commit: "b".repeat(40), sha256: sha("cut-bytes") });
    expect((await readStudioIndex(t.scriptPath)).jobs[job.id]!.imported).toMatchObject({ sha256: sha("cut-bytes"), worker: "Salah", motion: 91 });
    expect(await readFile(path.join(t.epDir, "out", "worker-studio", "motion-report.md"), "utf8")).toMatch(/المشهد c1-s1/);
    // a second run imports nothing again
    const again = await t.run();
    expect(again.imported).toEqual([]);
    expect(t.calls.filter((c) => c.startsWith("publish")).length).toBe(1);
  });

  it("refuses what this Mac did not send, a changed scene, a scene no longer open, and bytes that differ from result.json", async () => {
    const t = await setup();
    // not sent by this Mac: nothing in out/worker-studio for it → never even looked at
    const stray = sceneJob("c1-s2");
    await finish(t.share, stray, "stray");
    t.probes.set(stray.id, probeFor(stray));
    expect((await t.run()).rows).toEqual([]);

    const job = sceneJob("c1-s1");
    await rememberSentJob(t.scriptPath, job, { sourceSha256: "a".repeat(64), mode: "current" });
    await finish(t.share, job, "cut-bytes");
    t.probes.set(job.id, probeFor(job));
    // the scene's plan changed after sending
    t.deps.scene.current = async () => ({ planSha256: "f".repeat(64), mediaBase: media.base, exempt: new Set() });
    let r = await t.run();
    expect(r.refused.map((x) => x.reasons!.join())).toEqual([expect.stringMatching(/تغيّرت خطة المشهد c1-s1/)]);
    // approved meanwhile: the ledger refuses the render
    t.deps.scene.current = async () => ({ planSha256: planSha256(plan), mediaBase: media.base, exempt: new Set() });
    t.deps.scene.allowed = async () => { throw new Error("This scene is approved"); };
    r = await t.run();
    expect(r.refused[0]!.reasons!.join()).toMatch(/لم يعد يقبل هذه القطعة/);
    // tampered bytes in done/
    t.deps.scene.allowed = async () => {};
    await writeFile(path.join(queuePaths(t.share).done, job.id, `${job.id}.mp4`), "other-bytes");
    r = await t.run();
    expect(r.refused[0]!.reasons!.join()).toMatch(/بصمة الفيديو/);
    // a trace in the metadata
    await writeFile(path.join(queuePaths(t.share).done, job.id, `${job.id}.mp4`), "cut-bytes");
    t.probes.set(job.id, probeFor(job, { tags: ["encoder=Remotion"] }));
    r = await t.run();
    expect(r.refused[0]!.reasons!.join()).toMatch(/أثر/);
    expect(existsSync(path.join(t.epDir, "previews", "scene-c1-s1-av.mp4"))).toBe(false);
    expect(t.calls.some((c) => c.startsWith("evidence"))).toBe(false);
  });

  it("a job edited in done/ is not the one sent; a newer send of the same scene supersedes the older", async () => {
    const t = await setup();
    const old = sceneJob("c1-s1", "2026-11-27T09:00:00.000Z");
    await rememberSentJob(t.scriptPath, old, { sourceSha256: "a".repeat(64), mode: "ahead" });
    await finish(t.share, old, "old-bytes");
    const edited = { ...old, expected: { ...old.expected, durationSec: 13 } };
    await writeFile(path.join(queuePaths(t.share).done, old.id, "job.json"), JSON.stringify(edited));
    t.probes.set(old.id, probeFor(edited));
    let r = await t.run();
    expect(r.refused[0]!.reasons!.join()).toMatch(/حرفيًا/);
    const fresh = sceneJob("c1-s1", "2026-11-27T11:00:00.000Z");
    await rememberSentJob(t.scriptPath, fresh, { sourceSha256: "c".repeat(64), mode: "ahead" });
    r = await t.run();
    expect(r.rows.find((x) => x.id === old.id)!.status).toBe("superseded");
    expect(r.rows.find((x) => x.id === fresh.id)!.status).toBe("missing");
  });
});

describe("D232 phase 2: worker-import of the assembly and the Master", () => {
  const assemblyJob = (cuts: { sceneId: string; job: string; sha256: string }[]) => base({
    id: "dafatir-alzaman-002-assembly-abcdef012345", kind: "assembly", join: { cuts },
    expected: { durationSec: 24.8, width: 1920, height: 1080 },
  });
  const seams = JSON.stringify({ fps: 30, sceneSeconds: { "c1-s1": 12.4, "c1-s2": 12.4 }, seams: [{ at: 12.4 }], loudness: { target: null, gain: {} } });

  it("joins only the exact approved cuts, from one machine — the worker's; then the assembly slot with its seams", async () => {
    const t = await setup();
    const cuts = [{ sceneId: "c1-s1", job: "j1", sha256: sha("a1") }, { sceneId: "c1-s2", job: "j2", sha256: sha("a2") }];
    const job = assemblyJob(cuts);
    await rememberSentJob(t.scriptPath, job);
    await finish(t.share, job, "joined", { extra: { [seamsName(job)]: seams } });
    t.probes.set(job.id, probeFor(job, { durationSec: 22 }));
    // a cut was re-approved since sending
    t.deps.join.cuts = async () => [cuts[0]!, { sceneId: "c1-s2", sha256: sha("new") }];
    let r = await t.run();
    expect(r.refused[0]!.reasons!.join()).toMatch(/تغيّرت قطع المشاهد/);
    // same bytes, but previews hold no worker provenance for them (= the Mac's): D233
    t.deps.join.cuts = async () => cuts;
    r = await t.run();
    expect(r.refused[0]!.reasons!.join()).toMatch(/D233|«mac»/);
    const previews = path.join(t.epDir, "previews");
    await mkdir(previews, { recursive: true });
    await writeFile(provenanceFile(previews), JSON.stringify({ version: 1, scenes: { "c1-s1": { machine: "Salah", sha256: sha("a1") }, "c1-s2": { machine: "Salah", sha256: sha("a2") } } }));
    r = await t.run();
    expect(r.refused).toEqual([]);
    // published, then recorded for the 1× review exactly like the studio's own «اجمع الحلقة» — never approved
    expect(t.calls.slice(-2)).toEqual(["publish-join assembly seams=yes", `record-assembly ${sha("joined").slice(0, 6)}`]);
    expect(await readFile(path.join(previews, "episode.mp4"), "utf8")).toBe("joined");
  });

  it("the Master: refused if the episode changed or its scenes are not the worker's; else packageEpisode places the verified bytes after the gates again", async () => {
    const t = await setup();
    const job = base({
      id: "dafatir-alzaman-002-master-abcdef012345", kind: "master",
      render: { orientation: "landscape", quality: "master", scope: { all: true }, scenePreview: false, timingMode: "approved", review1080: true },
      expected: { durationSec: 24.8, width: 3840, height: 2160 },
    });
    await rememberSentJob(t.scriptPath, job);
    await finish(t.share, job, "master-4k");
    t.probes.set(job.id, probeFor(job));
    t.deps.master.current = async () => ({ planSha256: planSha256(plan), mediaBase: media.base, gain: { "c1-s1": 1.1 } });
    let r = await t.run();
    expect(r.refused[0]!.reasons!.join()).toMatch(/علوّ السرد/);
    t.deps.master.current = async () => ({ planSha256: planSha256(plan), mediaBase: media.base, gain: {} });
    r = await t.run();
    expect(r.refused[0]!.reasons!.join()).toMatch(/مشاهد الحلقة من «mac»/);
    expect(t.calls.some((c) => c.startsWith("package"))).toBe(false);
    const previews = path.join(t.epDir, "previews");
    await mkdir(previews, { recursive: true });
    await writeFile(provenanceFile(previews), JSON.stringify({ version: 1, scenes: { "c1-s1": { machine: "Salah" }, "c1-s2": { machine: "Salah" } } }));
    r = await t.run();
    expect(r.refused).toEqual([]);
    expect(t.calls).toEqual(["master-gates", "master-gates", "package 002-episode.mp4"]);
    expect(await readFile(path.join(t.epDir, "out", "package", "002-episode.mp4"), "utf8")).toBe("master-4k");
  });

  it("untrusted seams are used only when every field has its shape", () => {
    expect(parseSeams(JSON.parse(seams))).not.toBeNull();
    expect(parseSeams({ fps: "30" })).toBeNull();
    expect(parseSeams({ fps: 30, sceneSeconds: { a: "x" }, seams: [], loudness: { target: null, gain: {} } })).toBeNull();
    expect(parseSeams({ fps: 30, sceneSeconds: {}, seams: [{}], loudness: { target: null, gain: {} } })).toBeNull();
  });
});

describe("D232 phase 2: sending from the Mac keeps every gate", () => {
  const s = src("src/render/worker/studioJobs.ts");
  it("D234 before anything on every path; the ledger's render permission per scene; every Master gate; no voice ever generated", () => {
    for (const fn of ["submitStudioScenes", "submitStudioMaster"]) {
      const body = s.slice(s.indexOf(`export const ${fn}`));
      expect(body.indexOf("assertEditorPassed")).toBeGreaterThan(-1);
      expect(body.indexOf("assertEditorPassed")).toBeLessThan(body.indexOf("enqueue("));
    }
    expect(s.slice(s.indexOf("const studioContext"), s.indexOf("export const submitStudioScenes"))).toMatch(/assertEditorPassed[\s\S]*assertCommitMatchesWorkingTree/);
    expect(s).toMatch(/assertSceneRenderAllowed\(ep, id, s\.sourceSha256, "current"\)/);
    expect(s).toMatch(/assertSceneRenderAllowed\(ep, x\.id, x\.sourceSha256, "ahead"\)/);
    expect(s).toMatch(/finalPreflight[\s\S]*assertNoVoiceToGenerate[\s\S]*assertMasterRenderGates[\s\S]*buildMasterJob/);
    expect(s).not.toMatch(/elevenLabs|generateVoice\(|voiceClient/);
    // the Mac renders nothing on these paths: no permit is consumed, no Remotion/ffmpeg render is called
    expect(s).not.toMatch(/consumeMacRenderPermit|renderComposition|renderEpisode\(|joinSceneCuts\(/);
    // imports never decide for the owner: the only ledger command is recording the assembly file (the studio's «اجمع الحلقة» step)
    expect(s.match(/decideSceneProduction\(/g)?.length).toBe(1);
    expect(s).toMatch(/decideSceneProduction\(ep, \{ action: "assemble", expectedSha256: sha256 \}\)/);
    expect(s).not.toMatch(/"approve-scene"|"approve-assembly"|"approve-master"|"grant-publish"|"submit-scene"|approveSceneAv|submitSceneAvPreview/);
  });
  it("the Mac render and the worker import share the Master gates, the package and the join publishing", () => {
    expect(src("src/render/episode.ts")).toMatch(/if \(opts\.quality === "master"\)\n\s+await assertMasterRenderGates/);
    expect(src("src/package/package.ts")).toMatch(/opts\.masterFrom && quality === "master" \? await opts\.masterFrom\(episodePath\)/);
    const asm = src("src/studio/assembleScenes.ts");
    expect(asm).toMatch(/publishJoined\("prefinal"/);
    expect(asm).toMatch(/publishJoined\("assembly"/);
    expect(src("src/render/worker/untrustedRender.ts")).toMatch(/extra\.push\(\{ name: seamsName\(job\)/);
  });
  it("the CLI covers every step", () => {
    const cli = src("src/cli/index.ts");
    for (const c of ["worker-submit-scenes", "worker-submit-prefinal", "worker-submit-assembly", "worker-submit-master", "worker-import", "worker-submit\")", "worker-collect"])
      expect(cli).toContain(c);
  });
});
