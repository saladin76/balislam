/**
 * D232 (phase 2) — the studio's own renders on the Windows worker, and their import back into the studio.
 *
 * Sending (`bal worker-submit-scenes|-prefinal|-assembly|-master`): the same gates the Mac render path checks before it
 * starts (D234 editor, D228 templates inside the job builders, the scene ledger's render permission, the approved assembly
 * and every Master gate), then a `purpose: "studio"` job per scene, per join, or for the Master. The Mac renders nothing.
 *
 * Importing (`bal worker-import`): a finished job is used only after the Mac verified it (verifyV2Output: the job exactly as
 * this Mac sent it, the fingerprint, h264/AAC, dimensions, duration, no production trace in the metadata) AND the episode
 * still is what it was sent from (the plan, the media snapshot, the scene's inputs, the approved cuts). Then it enters the
 * studio through the very steps a Mac render goes through, so the scene ledger stays the only authority:
 *   - a scene cut → previews/scene-<id>-av.mp4 (putEpisodePreview), its provenance (D233), and the ledger's render-to-input
 *     proof (recordSceneRenderEvidence). It arrives as a DRAFT ready for review: never submitted, never approved (Rule 6);
 *     its motion is measured (the motion meter, intended stillness exempt) and said in the note and the report;
 *   - the assembly / pre-final → previews/episode.mp4 / the pre-final slot with its seams record (publishJoined), after the
 *     approved (or current) cuts are checked to be exactly the bytes the worker joined;
 *   - the Master → out/package/<NNN>-episode.mp4 through packageEpisode itself (texts, kit and trace checks, thumbnails,
 *     motion meter ≥ 80%, render-info, handoff set), after every Master gate again.
 * The owner then records/approves in «٢ المشاهد» and «٣ النسخة النهائية» exactly as after a Mac render.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolveScriptPath } from "../../script/episodes";
import { assertEditorPassed } from "../../studio/scriptPipelineStore";
import { loadChannel } from "../../channel";
import { projectRoot } from "../../config/paths";
import { motionSummary, MOTION_MIN, type MotionReport } from "../motionMeter";
import { probeVideo, type VideoProbe } from "./probe";
import { assertOneMachine, episodeSceneMachines, previewMachines, recordPreviewProvenance } from "./provenance";
import { assertCommitMatchesWorkingTree } from "./macSide";
import { buildJoinJob, buildMasterJob, buildSceneJob, enqueue, fullEpisodeInputs, verifyV2Output, type Base } from "./macJobs";
import {
  doneVideoName, planSha256, queuePaths, readProgress, seamsName, sha256File, validateJobV2, writeJsonAtomic,
  type WorkerJobV2, type WorkerResult,
} from "./protocol";
import type { JoinedRecord } from "../../studio/assembleScenes";

export type StudioKind = "scene" | "assembly" | "prefinal" | "master";
export type StudioJobRecord = {
  id: string; kind: StudioKind; sceneId?: string;
  /** scene jobs: the scene's input fingerprint when sent, and the ledger's render mode (D145: current = one scene, ahead = drafts) */
  sourceSha256?: string; mode?: "current" | "ahead";
  commit: string; submittedAt: string;
  imported?: { at: string; sha256: string; worker: string; file: string; motion?: number };
  refused?: { at: string; reasons: string[] };
};
export type StudioIndex = { version: 1; jobs: Record<string, StudioJobRecord> };

/** Local, never pushed (channels/*\/episodes/*\/out/ is ignored): what this Mac sent, and the exact jobs. */
export const studioDir = (scriptPath: string) => path.join(path.dirname(scriptPath), "out", "worker-studio");
const indexFile = (scriptPath: string) => path.join(studioDir(scriptPath), "index.json");
const sentJobFile = (scriptPath: string, id: string) => path.join(studioDir(scriptPath), "jobs", `${id}.json`);

export const readStudioIndex = async (scriptPath: string): Promise<StudioIndex> => {
  try {
    const raw = JSON.parse(await readFile(indexFile(scriptPath), "utf8")) as StudioIndex;
    if (raw?.version === 1 && raw.jobs && typeof raw.jobs === "object") return raw;
  } catch { /* first job */ }
  return { version: 1, jobs: {} };
};
const writeStudioIndex = async (scriptPath: string, idx: StudioIndex) => {
  await mkdir(studioDir(scriptPath), { recursive: true });
  const f = indexFile(scriptPath);
  await writeJsonAtomic(f, idx);
};
/** The job exactly as this Mac wrote it (verifyV2Output compares the returned job.json to it, byte for byte in JSON). */
export const readSentJob = async (scriptPath: string, id: string): Promise<WorkerJobV2 | undefined> => {
  try { return validateJobV2(JSON.parse(await readFile(sentJobFile(scriptPath, id), "utf8"))); } catch { return undefined; }
};
export const rememberSentJob = async (scriptPath: string, job: WorkerJobV2, extra: Partial<StudioJobRecord> = {}) => {
  await mkdir(path.dirname(sentJobFile(scriptPath, job.id)), { recursive: true });
  if (!existsSync(sentJobFile(scriptPath, job.id))) await writeJsonAtomic(sentJobFile(scriptPath, job.id), job);
  const idx = await readStudioIndex(scriptPath);
  const prev = idx.jobs[job.id];
  idx.jobs[job.id] = { ...(prev ?? {}), id: job.id, kind: job.kind as StudioKind, ...(job.sceneId ? { sceneId: job.sceneId } : {}), commit: job.commit,
    submittedAt: prev?.submittedAt ?? job.createdAt, ...extra };
  // a re-send of a refused job is a new chance
  if (!prev?.imported) delete idx.jobs[job.id]!.refused;
  await writeStudioIndex(scriptPath, idx);
};

/* ── sending ── */

/** D234 before anything is computed or copied, then the commit the worker renders (the Mac's working tree, pushed). */
const studioContext = async (ep: string) => {
  const scriptPath = await resolveScriptPath(ep);
  await assertEditorPassed(scriptPath);
  const channel = loadChannel().id;
  const episodeFolder = path.basename(path.dirname(scriptPath));
  const commit = await assertCommitMatchesWorkingTree(projectRoot, channel, episodeFolder);
  const t0 = Date.now();
  let k = 0;
  const base = (): Base => ({ channel, episodeFolder, commit, purpose: "studio", createdAt: new Date(t0 + k++).toISOString() });
  return { scriptPath, channel, episodeFolder, commit, base };
};

/**
 * Scene cuts on the worker. Explicit `scenes`: «أنتج هذا المشهد» for each (any scene not approved, D145; a newer sentence take
 * is composed into its sound first, KI-066, with no voice request). Without: «أنتج كل المشاهد الجاهزة» (every open scene that
 * has no ready draft and nothing blocking it). The ledger's own render permission is checked for each before it is sent.
 */
export const submitStudioScenes = async (ep: string, share: string, o: { scenes?: string[]; log?: (m: string) => void } = {}) => {
  const log = o.log ?? (() => {});
  const svc = await import("../../studio/sceneService");
  // D234 first, before the sound of a scene may be composed
  await assertEditorPassed(await resolveScriptPath(ep));
  const targets: { id: string; sourceSha256: string; mode: "current" | "ahead" }[] = [];
  if (o.scenes?.length) {
    const takes = await import("../../voice/sceneTakes");
    for (const id of o.scenes) {
      let s = (await svc.inspectSceneProduction(ep)).scenes.find((x: { id: string }) => x.id === id);
      if (!s) throw new Error(`لا مشهد بالمعرّف ${id} في هذه الحلقة.`);
      const n = (await takes.sceneTakeNotices(ep))[id];
      if (n?.outside.length) {
        if (n.missing.length) throw new Error(takes.newerTakeBlockedMessage(n));
        if (await takes.composeSceneForRender(ep, id)) s = (await svc.inspectSceneProduction(ep)).scenes.find((x: { id: string }) => x.id === id)!;
      }
      await svc.assertSceneRenderAllowed(ep, id, s.sourceSha256, "current");
      await svc.assertSceneNotAwaitingChange(ep, id);
      targets.push({ id, sourceSha256: s.sourceSha256, mode: "current" });
    }
  } else {
    const { scenesToRender } = await import("../../studio/prepareAll");
    const q = await scenesToRender(ep);
    for (const h of q.held) log(`لا يُرسل ${h.id}: ${h.error}`);
    if (q.blocked.length) log(`بلا صوت حالي (لا يُرسل؛ الصوت بضغطة المالك وحده): ${q.blocked.join("، ")}`);
    for (const x of q.list) {
      await svc.assertSceneRenderAllowed(ep, x.id, x.sourceSha256, "ahead");
      await svc.assertSceneNotAwaitingChange(ep, x.id);
      targets.push({ ...x, mode: "ahead" });
    }
  }
  if (!targets.length) throw new Error("لا مشهد يحتاج قطعة الآن (كل المشاهد معتمدة أو مرسلة للمراجعة أو لها مسودة جاهزة أو تنتظر إصلاحًا).");
  const ctx = await studioContext(ep);
  // D233: scenes left out whose current cut is the Mac's will block the assembly until they are re-rendered here too
  const ids = targets.map((t) => t.id);
  const others = (await episodeSceneMachines(path.join(path.dirname(ctx.scriptPath), "previews"),
    (await svc.inspectSceneProduction(ep)).scenes.map((x: { id: string }) => x.id).filter((id: string) => !ids.includes(id)
      && existsSync(path.join(path.dirname(ctx.scriptPath), "previews", `scene-${id}-av.mp4`)))))
    .filter((m) => m.machine === "mac").map((m) => m.sceneId);
  if (others.length) log(`تنبيه D233: قطع هذه المشاهد من الماك، والتجميع يُرفض حتى تُرندر على جهاز الرندر أيضًا: ${others.join("، ")}`);
  const sent: string[] = [], existing: string[] = [];
  for (const t of targets) {
    const job = await buildSceneJob(ep, t.id, ctx.base(), share);
    const fresh = await enqueue(share, job);
    await rememberSentJob(ctx.scriptPath, job, { sourceSha256: t.sourceSha256, mode: t.mode });
    (fresh ? sent : existing).push(job.id);
    log(`${fresh ? "أُرسل" : "موجود من قبل"}: المشهد ${t.id} ← ${job.id} (${job.expected.durationSec} ث)`);
  }
  return { sent, existing, commit: ctx.commit };
};

/** The worker scene job that holds exactly these bytes (imported here, the same fingerprint as the ledger's cut). */
const sceneJobsFor = async (scriptPath: string, cuts: { sceneId: string; sha256: string }[]) => {
  const idx = await readStudioIndex(scriptPath);
  const missing: string[] = [];
  const out = cuts.map((c) => {
    const rec = Object.values(idx.jobs).find((r) => r.kind === "scene" && r.sceneId === c.sceneId && r.imported?.sha256 === c.sha256);
    if (!rec) missing.push(c.sceneId);
    return { sceneId: c.sceneId, job: rec?.id ?? "", sha256: c.sha256 };
  });
  if (missing.length)
    throw new Error(`قطع هذه المشاهد ليست من جهاز الرندر (رُندرت على الماك أو لم تُستورد): ${missing.join("، ")}. أرسلها بـ «bal worker-submit-scenes --scenes ${missing.join(",")}» ثم «bal worker-import» واعتمدها، ثم أعد المحاولة (D233: الحلقة كلها على جهاز واحد).`);
  return out;
};

/**
 * The assembly (after every scene is approved, from the exact approved cuts) or the pre-final (every current cut). Each
 * cut must be a worker scene cut imported here with the same bytes (the worker joins its own done/ files by fingerprint).
 */
export const submitStudioJoin = async (kind: "assembly" | "prefinal", ep: string, share: string, o: { log?: (m: string) => void } = {}) => {
  const log = o.log ?? (() => {});
  const ctx = await studioContext(ep);
  const svc = await import("../../studio/sceneService");
  const cuts = kind === "assembly" ? await svc.approvedSceneCutsForAssembly(ep) : await svc.currentSceneCutsForPreFinal(ep);
  if (!cuts.length) throw new Error("لا قطع مشاهد للوصل.");
  assertOneMachine(await previewMachines(path.join(path.dirname(ctx.scriptPath), "previews"), cuts), kind === "prefinal" ? "نسخة قبل النهائية" : "تجميع");
  const joinCuts = await sceneJobsFor(ctx.scriptPath, cuts);
  const inputs = await fullEpisodeInputs(ep, { requireApprovedQuran: false });
  const job = await buildJoinJob(kind, inputs, joinCuts, ctx.base(), share);
  const fresh = await enqueue(share, job);
  await rememberSentJob(ctx.scriptPath, job);
  log(`${fresh ? "أُرسل" : "موجود من قبل"}: ${kind === "assembly" ? "التجميع" : "نسخة قبل النهائية"} (${cuts.length} مشهدًا) ← ${job.id}`);
  return { id: job.id, fresh, commit: ctx.commit };
};

/**
 * The Master (4K) after the owner approved the assembly: the checks of `bal make` before any voice or render (the final
 * file never pays for voice: a missing clip refuses, D151), then every Master gate (assertMasterRenderGates), then the
 * job (assertMasterReady and D233: the scenes are the worker's).
 */
export const submitStudioMaster = async (ep: string, share: string, o: { log?: (m: string) => void } = {}) => {
  const log = o.log ?? (() => {});
  const { finalPreflight, assertNoVoiceToGenerate } = await import("../../package/make");
  await assertEditorPassed(await resolveScriptPath(ep));
  await finalPreflight(ep, { log, regenerate: false });
  await assertNoVoiceToGenerate(ep);
  const ctx = await studioContext(ep);
  const inputs = await fullEpisodeInputs(ep, { requireApprovedQuran: true });
  const { assertMasterRenderGates } = await import("../episode");
  await assertMasterRenderGates({ episode: ep, plan: inputs.plan, media: inputs.media });
  const job = await buildMasterJob(ep, inputs, ctx.base(), share);
  const fresh = await enqueue(share, job);
  await rememberSentJob(ctx.scriptPath, job);
  log(`${fresh ? "أُرسل" : "موجود من قبل"}: Master 4K ← ${job.id} (${job.expected.durationSec} ث)`);
  return { id: job.id, fresh, commit: ctx.commit };
};

/* ── importing ── */

export type StudioImportDeps = {
  sha256File: (file: string) => Promise<string>;
  probe: (file: string) => Promise<VideoProbe>;
  measureMotion: (file: string, exempt: Set<number>) => Promise<MotionReport>;
  scene: {
    /** what a scene job would carry now (shotsRenderInputs), and its intended stillness */
    current: (ep: string, sceneId: string) => Promise<{ planSha256: string; mediaBase: string; exempt: Set<number> }>;
    allowed: (ep: string, sceneId: string, sourceSha256: string, mode: "current" | "ahead") => Promise<void>;
    publish: (ep: string, slot: string, file: string, meta: { title: string; note?: string }) => Promise<{ file: string }>;
    evidence: (ep: string, sceneId: string, sourceSha256: string, mode: "current" | "ahead") => Promise<void>;
  };
  join: {
    cuts: (ep: string, kind: "assembly" | "prefinal") => Promise<{ sceneId: string; sha256: string; recitationPending?: boolean }[]>;
    planSha256: (ep: string) => Promise<string>;
    publish: (kind: "assembly" | "prefinal", ep: string, scriptPath: string, file: string, joined: JoinedRecord | null,
      cuts: { sceneId: string; sha256: string; recitationPending?: boolean }[], meta: { note?: string }) => Promise<{ file: string }>;
    /**
     * The assembly only: records the exact file for the owner's 1× review, the same one step the studio takes right after
     * its own join («اجمع الحلقة»: decision `assemble`). Not an approval: «اعتمد التجميع» stays the owner's press.
     */
    record: (ep: string, sha256: string) => Promise<void>;
  };
  master: {
    current: (ep: string) => Promise<{ planSha256: string; mediaBase: string; gain: Record<string, number> }>;
    gates: (ep: string) => Promise<void>;
    /** packageEpisode with the verified file in place of the render */
    package: (ep: string, masterFrom: (episodePath: string) => Promise<string>, log: (m: string) => void) => Promise<unknown>;
  };
};

export const defaultStudioImportDeps = (): StudioImportDeps => ({
  sha256File, probe: probeVideo,
  measureMotion: async (f, ex) => (await import("../motionMeter")).measureMotion(f, "landscape", ex),
  scene: {
    current: async (ep, id) => {
      const { shotsRenderInputs } = await import("../shotsPreview");
      const { plan, media } = await shotsRenderInputs(ep, [id], { sceneDraft: true, allowPendingRecitation: true });
      const { exemptForRender } = await import("../stillness");
      return { planSha256: planSha256(plan), mediaBase: media.base, exempt: await exemptForRender(plan, media) };
    },
    allowed: async (ep, id, sha, mode) => {
      const svc = await import("../../studio/sceneService");
      await svc.assertSceneRenderAllowed(ep, id, sha, mode);
      await svc.assertSceneNotAwaitingChange(ep, id);
    },
    publish: async (ep, slot, file, meta) => (await import("../episodePreviews")).putEpisodePreview(ep, slot, file, meta),
    evidence: async (ep, id, sha, mode) => (await import("../../studio/sceneService")).recordSceneRenderEvidence(ep, id, sha, mode),
  },
  join: {
    cuts: async (ep, kind) => {
      const svc = await import("../../studio/sceneService");
      return kind === "assembly" ? svc.approvedSceneCutsForAssembly(ep) : svc.currentSceneCutsForPreFinal(ep);
    },
    planSha256: async (ep) => {
      const plan = await (await import("../../plan/io")).loadPlan(ep);
      if (!plan) throw new Error("لا توجد خطة للحلقة.");
      return planSha256(plan);
    },
    publish: async (kind, ep, scriptPath, file, joined, cuts, meta) => (await import("../../studio/assembleScenes")).publishJoined(kind, ep, scriptPath, file, joined, cuts, meta),
    record: async (ep, sha256) => { await (await import("../../studio/sceneService")).decideSceneProduction(ep, { action: "assemble", expectedSha256: sha256 }); },
  },
  master: {
    current: async (ep) => {
      const x = await fullEpisodeInputs(ep, { requireApprovedQuran: true });
      return { planSha256: planSha256(x.plan), mediaBase: x.media.base, gain: x.narrationGain };
    },
    gates: async (ep) => {
      const x = await fullEpisodeInputs(ep, { requireApprovedQuran: true });
      await (await import("../episode")).assertMasterRenderGates({ episode: ep, plan: x.plan, media: x.media });
    },
    package: async (ep, masterFrom, log) => (await import("../../package/package")).packageEpisode({ episode: ep, stage: "episode", quality: "master", masterFrom, onProgress: log }),
  },
});

/** Untrusted seams from the worker: used for timings only, and only if every field has its shape. */
export const parseSeams = (raw: unknown): JoinedRecord | null => {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return null;
  const num = (x: unknown) => typeof x === "number" && Number.isFinite(x);
  const ss = r.sceneSeconds as Record<string, unknown> | undefined;
  const loud = r.loudness as { target?: unknown; gain?: Record<string, unknown> } | undefined;
  if (!num(r.fps) || !ss || typeof ss !== "object" || Object.values(ss).some((x) => !num(x)) || !Array.isArray(r.seams)
    || r.seams.some((x) => !x || typeof x !== "object" || !num((x as { at?: unknown }).at))
    || !loud || typeof loud !== "object" || !(loud.target === null || num(loud.target)) || !loud.gain || Object.values(loud.gain).some((x) => !num(x)))
    return null;
  return { fps: r.fps as number, sceneSeconds: ss as Record<string, number>, seams: r.seams as JoinedRecord["seams"], loudness: loud as JoinedRecord["loudness"] };
};

export type ImportRow = { id: string; kind: StudioKind; sceneId?: string; status: "imported" | "refused" | "queued" | "running" | "failed" | "missing" | "superseded";
  reasons?: string[]; progress?: string; file?: string; motion?: number; fresh?: boolean };

/** Copies the worker file next to its target and checks the bytes did not change on the way (the share is untrusted). */
const localCopy = async (deps: StudioImportDeps, source: string, dir: string, id: string, sha: string) => {
  await mkdir(dir, { recursive: true });
  const temp = path.join(dir, `.worker-import-${id}.mp4`);
  await rm(temp, { force: true });
  await copyFile(source, temp);
  if ((await deps.sha256File(temp)) !== sha) { await rm(temp, { force: true }); throw new Error("تغيّر الملف أثناء نسخه من المجلد المشترك."); }
  return temp;
};

/**
 * Imports every finished studio job of this episode that this Mac sent, in the order sent (scenes, then joins, then the
 * Master). A scene sent again later supersedes its older job. Refusals are said in Arabic and never imported.
 */
export const importStudioJobs = async (ep: string, share: string, o: { log?: (m: string) => void; deps?: StudioImportDeps; scriptPath?: string } = {}) => {
  const log = o.log ?? (() => {});
  const deps = o.deps ?? defaultStudioImportDeps();
  const scriptPath = o.scriptPath ?? await resolveScriptPath(ep);
  const epDir = path.dirname(scriptPath);
  const previews = path.join(epDir, "previews");
  const q = queuePaths(share);
  const idx = await readStudioIndex(scriptPath);
  const order: StudioKind[] = ["scene", "prefinal", "assembly", "master"];
  const recs = Object.values(idx.jobs).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.submittedAt.localeCompare(b.submittedAt));
  const rows: ImportRow[] = [];
  const motionLines: string[] = [];
  for (const rec of recs) {
    const row: ImportRow = { id: rec.id, kind: rec.kind, ...(rec.sceneId ? { sceneId: rec.sceneId } : {}), status: "missing" };
    rows.push(row);
    if (rec.imported) { Object.assign(row, { status: "imported", file: rec.imported.file, motion: rec.imported.motion }); continue; }
    const newer = recs.find((r) => r !== rec && r.kind === rec.kind && r.sceneId === rec.sceneId && r.submittedAt > rec.submittedAt);
    if (newer) { row.status = "superseded"; continue; }
    const doneDir = path.join(q.done, rec.id);
    if (!existsSync(doneDir)) {
      if (existsSync(path.join(q.failed, rec.id))) {
        row.status = "failed";
        try { row.reasons = [(JSON.parse(await readFile(path.join(q.failed, rec.id, "error.json"), "utf8")) as { error: string }).error]; } catch { row.reasons = ["error.json مفقود"]; }
      } else if (existsSync(path.join(q.running, `${rec.id}.json`))) {
        row.status = "running";
        const p = await readProgress(share, rec.id);
        if (p) row.progress = `${p.percent}% (${p.stage})`;
      } else if (existsSync(path.join(q.jobs, `${rec.id}.json`))) row.status = "queued";
      continue;
    }
    const refuse = (reasons: string[]) => { row.status = "refused"; row.reasons = reasons; rec.refused = { at: new Date().toISOString(), reasons }; };
    let job: WorkerJobV2, result: WorkerResult;
    try {
      job = validateJobV2(JSON.parse(await readFile(path.join(doneDir, "job.json"), "utf8")));
      result = JSON.parse(await readFile(path.join(doneDir, "result.json"), "utf8")) as WorkerResult;
    } catch (e) { refuse([`job.json أو result.json تالف: ${(e as Error).message}`]); continue; }
    const file = path.join(doneDir, doneVideoName(job));
    if (!existsSync(file)) { refuse(["الفيديو مفقود."]); continue; }
    const reasons = verifyV2Output({ job, submitted: await readSentJob(scriptPath, rec.id), result, fileSha256: await deps.sha256File(file),
      fileBytes: (await stat(file)).size, probe: await deps.probe(file) });
    if (job.purpose !== "studio" || job.kind !== rec.kind || (job.sceneId ?? undefined) !== rec.sceneId) reasons.push("ليست مهمة الاستوديو التي سُجّلت هنا.");
    try {
      if (rec.kind === "scene") {
        const id = rec.sceneId!;
        const cur = await deps.scene.current(ep, id);
        if (cur.planSha256 !== job.inputs.planSha256) reasons.push(`تغيّرت خطة المشهد ${id} بعد الإرسال؛ أعد الإرسال.`);
        if (cur.mediaBase !== job.inputs.media.base) reasons.push(`تغيّرت وسائط المشهد ${id} (الصوت أو الصور) بعد الإرسال؛ أعد الإرسال.`);
        try { await deps.scene.allowed(ep, id, rec.sourceSha256!, rec.mode!); }
        catch (e) { reasons.push(`المشهد ${id} لم يعد يقبل هذه القطعة: ${(e as Error).message}`); }
        if (reasons.length) { refuse(reasons); continue; }
        const temp = await localCopy(deps, file, path.join(epDir, "out"), job.id, result.sha256);
        try {
          // Rule 2: the motion meter on the cut (intended stillness exempt), said beside it; the Master is held to ≥ 80%
          const motion = await deps.measureMotion(temp, cur.exempt);
          motionLines.push(`- ${motionSummary(motion, `المشهد ${id} (جهاز الرندر ${result.worker})`)}`);
          const weak = motion.percent < MOTION_MIN ? `؛ تنبيه: الحركة ${motion.percent}% أقل من ${MOTION_MIN}%` : "";
          // like verifyBeforePublish of the Mac render: a scene edited meanwhile never gets this cut
          await deps.scene.allowed(ep, id, rec.sourceSha256!, rec.mode!);
          const pub = await deps.scene.publish(ep, `scene-${id}-av`, temp, {
            title: `المشهد ${id} — صوت وصورة للمراجعة`,
            note: `رُندر على جهاز الرندر «${result.worker}» (${job.commit.slice(0, 8)})؛ الحركة ${motion.percent}%${weak}. مسودة غير معتمدة حتى يشاهدها المالك ويقرر.`,
          });
          const sha = await deps.sha256File(pub.file);
          if (sha !== result.sha256) throw new Error("القطعة المنشورة لا تطابق بصمة جهاز الرندر.");
          // D233: where this exact cut was rendered, then the ledger's render-to-input proof (a draft, never a decision)
          await recordPreviewProvenance(previews, id, { machine: result.worker, commit: job.commit, sha256: sha });
          await deps.scene.evidence(ep, id, rec.sourceSha256!, rec.mode!);
          rec.imported = { at: new Date().toISOString(), sha256: sha, worker: result.worker, file: pub.file, motion: motion.percent };
          if (weak) log(`المشهد ${id}${weak}.`);
        } finally { await rm(temp, { force: true }); }
      } else if (rec.kind === "assembly" || rec.kind === "prefinal") {
        const what = rec.kind === "assembly" ? "التجميع" : "نسخة قبل النهائية";
        if ((await deps.join.planSha256(ep)) !== job.inputs.planSha256) reasons.push("تغيّرت خطة الحلقة بعد الإرسال؛ أعد الإرسال.");
        let cuts: Awaited<ReturnType<StudioImportDeps["join"]["cuts"]>> = [];
        try { cuts = await deps.join.cuts(ep, rec.kind); } catch (e) { reasons.push((e as Error).message); }
        const same = (cs: typeof cuts) => cs.length === job.join!.cuts.length && cs.every((c, i) => c.sceneId === job.join!.cuts[i]!.sceneId && c.sha256 === job.join!.cuts[i]!.sha256);
        if (cuts.length && !same(cuts)) reasons.push(`تغيّرت قطع المشاهد منذ إرسال ${what} (مشهد أُعيد أو اعتماد تغيّر)؛ أعد الإرسال.`);
        if (cuts.length) {
          try {
            const m = assertOneMachine(await previewMachines(previews, cuts), what);
            if (m !== result.worker) reasons.push(`قطع المشاهد من «${m}» لا من جهاز الرندر الذي وصلها (${result.worker}) (D233).`);
          } catch (e) { reasons.push((e as Error).message); }
        }
        if (reasons.length) { refuse(reasons); continue; }
        let seams: JoinedRecord | null = null;
        try { seams = parseSeams(JSON.parse(await readFile(path.join(doneDir, seamsName(job)), "utf8"))); } catch { seams = null; }
        if (!seams) log(`${what}: لا سجل وصلات صالح من جهاز الرندر؛ يُنشر الملف بلا أوقات الوصلات.`);
        const temp = await localCopy(deps, file, previews, job.id, result.sha256);
        try {
          if (!same(await deps.join.cuts(ep, rec.kind))) throw new Error(`تغيّرت قطع المشاهد أثناء استيراد ${what}؛ أعد المحاولة.`);
          const pub = await deps.join.publish(rec.kind, ep, scriptPath, temp, seams, cuts,
            { note: rec.kind === "assembly" ? `تجميع المشاهد المعتمدة على جهاز الرندر «${result.worker}» للمشاهدة الكاملة بسرعة 1×؛ ليست Master معتمدة للنشر.` : undefined });
          const pubSha = await deps.sha256File(pub.file);
          if (pubSha !== result.sha256) throw new Error(`${what} المنشور لا يطابق بصمة جهاز الرندر.`);
          if (rec.kind === "assembly") await deps.join.record(ep, pubSha);
          rec.imported = { at: new Date().toISOString(), sha256: pubSha, worker: result.worker, file: pub.file };
        } finally { await rm(temp, { force: true }); }
      } else {
        const cur = await deps.master.current(ep);
        if (cur.planSha256 !== job.inputs.planSha256) reasons.push("تغيّرت خطة الحلقة بعد الإرسال؛ أعد الإرسال.");
        if (cur.mediaBase !== job.inputs.media.base) reasons.push("تغيّرت وسائط الحلقة (الصوت أو الصور) بعد الإرسال؛ أعد الإرسال.");
        if (JSON.stringify(cur.gain) !== JSON.stringify(job.inputs.narrationGain)) reasons.push("تغيّر علوّ السرد بعد الإرسال؛ أعد الإرسال.");
        try {
          const m = assertOneMachine(await episodeSceneMachines(previews, job.inputs.plan.chapters.flatMap((c) => c.scenes.map((s) => s.id))), "Master");
          if (m !== result.worker) reasons.push(`مشاهد الحلقة من «${m}» لا من جهاز الرندر الذي صنع Master (${result.worker}) (D233).`);
        } catch (e) { reasons.push((e as Error).message); }
        if (!reasons.length) { try { await deps.master.gates(ep); } catch (e) { reasons.push((e as Error).message); } }
        if (reasons.length) { refuse(reasons); continue; }
        let placed = "";
        await deps.master.package(ep, async (episodePath) => {
          const temp = await localCopy(deps, file, path.dirname(episodePath), job.id, result.sha256);
          try {
            await deps.master.gates(ep);
            const { publishOutputWithoutOverwrite } = await import("../fsIsolation");
            placed = await publishOutputWithoutOverwrite(temp, episodePath);
            return placed;
          } finally { await rm(temp, { force: true }); }
        }, (m) => log(`   ${m}`));
        rec.imported = { at: new Date().toISOString(), sha256: result.sha256, worker: result.worker, file: placed };
      }
      delete rec.refused;
      Object.assign(row, { status: "imported", file: rec.imported!.file, motion: rec.imported!.motion, fresh: true });
      log(`استُورد: ${rec.sceneId ? `المشهد ${rec.sceneId}` : rec.kind} ← ${path.relative(epDir, rec.imported!.file)}`);
    } catch (e) {
      refuse([...reasons, (e as Error).message]);
    } finally {
      await writeStudioIndex(scriptPath, idx);
    }
  }
  await writeStudioIndex(scriptPath, idx);
  if (motionLines.length) {
    const f = path.join(studioDir(scriptPath), "motion-report.md");
    const prev = existsSync(f) ? (await readFile(f, "utf8")).trimEnd() : "# مقياس الحركة · قطع المشاهد من جهاز الرندر\n";
    await writeFile(f, `${prev}\n${motionLines.join("\n")}\n`);
  }
  return { rows, imported: rows.filter((r) => r.fresh), refused: rows.filter((r) => r.status === "refused" || r.status === "failed") };
};

