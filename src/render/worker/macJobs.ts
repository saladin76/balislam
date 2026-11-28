/**
 * D232 — جانب الماك لمهام الإصدار 2: بناء مهام المشهد والوصل وMaster، والتحقق العام من ناتجها، وحالة جهاز الرندر،
 * و«التجربة» (`bal worker-trial`): حلقة كاملة على الويندوز (المشاهد ← التجميع ← 4K) لا تدخل الحزمة ولا السجل أبدًا.
 *
 * الماك لا يرندر شيئًا هنا: يحسب الخطة والمدة ولقطة الوسائط وربح العلوّ (قياس لا رندر)، ويفحص المحتوى قبل الإرسال
 * (D228 اعتماد القوالب، وفحص السكريبت وأخطاء الخطة ونص الآيات على Tanzil والصوت المطابق والستوري بورد للنسخة النهائية،
 * ونواقص قطعة المشهد)، فمهمة تفشل لا تُرسل أبدًا. التجربة تتخطى «متطلبات الاعتماد» وحدها (السجل الموقّع واعتماد
 * المشاهد والتجميع)، لأنها لا تُستورد ولا تمنح شيئًا؛ ومخرجها في المجلد المشترك ومجلد مؤقت على الماك فقط.
 */
import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import config from "../../../config.json";
import { resolveScriptPath } from "../../script/episodes";
import { loadPlan } from "../../plan/io";
import { prepareRenderMedia } from "../../plan/collect";
import { cutPlans } from "../../plan/sceneCut";
import { assertTemplatesApproved } from "../../plan/templateApproval";
import { assertNoSilentQuoteScenes } from "../../plan/silentQuotes";
import { assertEditorPassed } from "../../studio/scriptPipelineStore";
import type { Plan } from "../../plan/types";
import type { EpisodeMedia } from "../../plan/media";
import { channelInfo, loadChannel } from "../../channel";
import { episodeFrames } from "../../remotion/scenes/Episode";
import { findTraces } from "../../package/traces";
import { projectRoot } from "../../config/paths";
import { probeVideo, type VideoProbe } from "./probe";
import { assertOneMachine, episodeSceneMachines, machineOfResult, MAC_MACHINE, type SceneMachine } from "./provenance";
import { assertCommitMatchesWorkingTree, publishSnapshot, DURATION_TOLERANCE_SEC } from "./macSide";
import {
  doneVideoName, ensureQueue, heartbeatFile, HEARTBEAT_STALE_MS, isProgressName, planSha256, queuePaths, readProgress, sha256File, sizeFor,
  validateJobV2, writeJsonAtomic, type CutSpec, type Heartbeat, type TrialX264Preset, type JobProgress, type RenderSpec, type WorkerJobV2, type WorkerResult,
} from "./protocol";
import { cutSeconds } from "./verticalShorts";

const fps = (config as { video: { fps: number } }).video.fps;
/** الوصل يقص صمت البداية (KI-091، حتى ~3.5 ث)، فمدته قد تقصر عن مدة الخطة بهذا القدر وحده */
export const JOIN_HEAD_TRIM_MAX_SEC = 4;

const hash12 = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 12);
const round3 = (x: number) => Math.round(x * 1000) / 1000;
const secondsOf = (plan: Plan, media: EpisodeMedia, chapter?: number) => round3(episodeFrames({ plan, chapter, media, channel: channelInfo(loadChannel()) }) / fps);

/* ── حالة جهاز الرندر (للاستوديو والسطر) ── */

export type WorkerStatus = {
  mounted: boolean; online: boolean; heartbeat: Heartbeat | null; heartbeatAgeSec: number | null;
  queued: string[]; running: { id: string; progress: JobProgress | null }[]; message: string;
};
/** جهاز الرندر «متصل» إذا كان المجلد المشترك موصولًا ونبضه أحدث من دقيقتين؛ وإلا تنتظر المهام مع «جهاز الرندر غير متصل». */
export const workerStatus = async (share: string, now = Date.now()): Promise<WorkerStatus> => {
  const q = queuePaths(share);
  if (!existsSync(q.root)) return { mounted: false, online: false, heartbeat: null, heartbeatAgeSec: null, queued: [], running: [], message: "جهاز الرندر غير متصل (المجلد المشترك غير موصول)." };
  let hb: Heartbeat | null = null;
  try { hb = JSON.parse(await readFile(heartbeatFile(share), "utf8")) as Heartbeat; } catch { hb = null; }
  const age = hb ? (now - Date.parse(hb.at)) / 1000 : null;
  const online = age !== null && Number.isFinite(age) && age * 1000 <= HEARTBEAT_STALE_MS;
  const list = async (d: string) => (existsSync(d) ? (await readdir(d)).filter((x) => x.endsWith(".json") && !x.startsWith(".") && !isProgressName(x)).map((x) => x.slice(0, -5)).sort() : []);
  const running = await Promise.all((await list(q.running)).map(async (id) => ({ id, progress: await readProgress(share, id) })));
  return { mounted: true, online, heartbeat: hb, heartbeatAgeSec: age === null ? null : Math.round(age), queued: await list(q.jobs), running,
    message: online ? (running.length ? `جهاز الرندر يعمل: ${running.map((r) => `${r.id} ${r.progress ? `${r.progress.percent}% (${r.progress.stage})` : ""}`).join("، ")}` : "جهاز الرندر متصل وخامل.")
      : "جهاز الرندر غير متصل؛ المهام تنتظر في الطابور حتى يعود." };
};

/* ── بناء المهام ── */

export type Base = { channel: string; episodeFolder: string; commit: string; purpose: "studio" | "trial"; trial?: string; createdAt: string };
const baseFields = (b: Base) => ({ version: 2 as const, channel: b.channel, episode: b.episodeFolder, purpose: b.purpose, ...(b.trial ? { trial: b.trial } : {}), commit: b.commit, createdAt: b.createdAt });
const idFor = (b: Base, kind: string, extra: string, fp: unknown) =>
  `${b.purpose === "trial" ? `trial-${b.trial}` : `${b.channel}-${b.episodeFolder.slice(0, 3)}`}-${kind}${extra ? `-${extra.toLowerCase()}` : ""}-${hash12(fp)}`;

/** مهمة قطعة مشهد 1080p: الخطة مقصوصة على المشهد ووسائطه كما يحسبها الاستوديو (shotsRenderInputs)، بعد فحص النواقص. */
export const buildSceneJob = async (ep: string, sceneId: string, b: Base, share: string, o: { sharedMedia?: EpisodeMedia } = {}): Promise<WorkerJobV2> => {
  const { shotsRenderInputs } = await import("../shotsPreview");
  // D234: لا مهمة رندر (للويندوز أو غيره) لسكريبت فيه جملة لم تمرّ بمحرر المحتوى، قبل أي حساب أو نسخ
  await assertEditorPassed(await resolveScriptPath(ep));
  const cut = await shotsRenderInputs(ep, [sceneId], { sceneDraft: true, allowPendingRecitation: true });
  const { plan, pendingRecitation } = cut;
  assertTemplatesApproved(plan);
  assertNoSilentQuoteScenes(plan);
  // تجربة «حزمة واحدة للحلقة»: لقطة وسائط الحلقة كاملة (تحوي وسائط المشهد نفسها) لكل المشاهد، فتتطابق مفاتيح الحزمة على العامل
  if (o.sharedMedia && JSON.stringify(o.sharedMedia.voice[sceneId] ?? null) !== JSON.stringify(cut.media.voice[sceneId] ?? null))
    throw new Error(`وسائط المشهد ${sceneId} في لقطة الحلقة ليست وسائط قطعته.`);
  const media = o.sharedMedia ?? cut.media;
  const mediaRel = await publishSnapshot(share, media);
  const render: RenderSpec = { orientation: "landscape", quality: "preview", scope: { sceneIds: [sceneId] }, scenePreview: true, timingMode: "scene-preview",
    ...(pendingRecitation.length ? { draftMarks: { pendingRecitation } } : {}), ...(o.sharedMedia ? { bundleCache: true } : {}) };
  const sha = planSha256(plan);
  return validateJobV2({
    ...baseFields(b), id: idFor(b, "scene", sceneId, { c: b.commit, sha, base: media.base, render }), kind: "scene", sceneId, media: mediaRel, render,
    expected: { durationSec: secondsOf(plan, media), ...sizeFor("preview", "landscape") },
    inputs: { planSha256: sha, plan, media, narrationGain: {} },
  });
};

/** لقطة الحلقة كاملة وربح العلوّ: للوصل ولـMaster. */
export const fullEpisodeInputs = async (ep: string, o: { requireApprovedQuran: boolean }) => {
  const scriptPath = await resolveScriptPath(ep);
  // D234: الوصل وMaster مثل المشهد: لا مهمة لسكريبت لم يمرّ بالمحرر
  await assertEditorPassed(scriptPath);
  const plan = await loadPlan(ep);
  if (!plan) throw new Error("لا توجد خطة للحلقة.");
  assertTemplatesApproved(plan);
  assertNoSilentQuoteScenes(plan);
  const media = await prepareRenderMedia(ep, plan, { requireApprovedQuran: o.requireApprovedQuran });
  const { narrationLoudness } = await import("../../studio/narrationLoudness");
  const loud = await narrationLoudness(scriptPath, plan, media);
  return { scriptPath, plan, media, narrationGain: loud.gain };
};

/** وصل قطع المشاهد (التجميع أو «قبل النهائية») 1080p على الويندوز، من نواتج مهام المشاهد في done/. */
export const buildJoinJob = async (kind: "assembly" | "prefinal", inputs: Awaited<ReturnType<typeof fullEpisodeInputs>>, cuts: { sceneId: string; job: string; sha256?: string }[], b: Base, share: string): Promise<WorkerJobV2> => {
  // D233: ما انتهى من قطعها في done/ من جهاز واحد (والعامل يفحصها كلها ثانية قبل الوصل)
  await assertCutsOneMachine(share, cuts, kind === "prefinal" ? "نسخة قبل النهائية" : "تجميع");
  const mediaRel = await publishSnapshot(share, inputs.media);
  const sha = planSha256(inputs.plan);
  return validateJobV2({
    ...baseFields(b), id: idFor(b, kind, "", { c: b.commit, sha, base: inputs.media.base, cuts }), kind, media: mediaRel, join: { cuts },
    expected: { durationSec: secondsOf(inputs.plan, inputs.media), width: 1920, height: 1080 },
    inputs: { planSha256: sha, plan: inputs.plan, media: inputs.media, narrationGain: inputs.narrationGain },
  });
};

/** D233: أجهزة قطع الوصل المنتهية في done/ (من result.json؛ بلا نتيجة بعد = لم تُرندر، لا تُحسب) */
export const assertCutsOneMachine = async (share: string, cuts: { sceneId: string; job: string }[], what: string) => {
  const q = queuePaths(share);
  const rows: SceneMachine[] = [];
  for (const c of cuts) {
    const f = path.join(q.done, c.job, "result.json");
    if (!existsSync(f)) continue;
    let r: WorkerResult | null = null;
    try { r = JSON.parse(await readFile(f, "utf8")) as WorkerResult; } catch { r = null; }
    rows.push({ sceneId: c.sceneId, machine: machineOfResult(r) });
  }
  return assertOneMachine(rows, what);
};

/** Master 4K (ونسخة مراجعة 1080p بجوارها). فحوص المحتوى للنسخة النهائية قبل الإرسال (assertMasterReady). */
export type SpeedTrial = { concurrency?: number; x264Preset?: TrialX264Preset; chunkFrames?: number };
export const buildMasterJob = async (ep: string, inputs: Awaited<ReturnType<typeof fullEpisodeInputs>>, b: Base, share: string, o: SpeedTrial = {}): Promise<WorkerJobV2> => {
  if ((o.x264Preset || o.chunkFrames || o.concurrency) && b.purpose !== "trial") throw new Error("خيارات التسريع للتجارب وحدها (D232).");
  const { assertMasterReady, voiceTimingMode } = await import("../episode");
  await assertMasterReady({ scriptPath: inputs.scriptPath, plan: inputs.plan, media: inputs.media, channel: loadChannel() });
  // D233: Master للاستوديو على الويندوز من مشاهد رُندرت كلها على جهاز رندر واحد (لا خلط، ولا مشاهد الماك تحت Master الويندوز).
  // التجربة لا تمس مشاهد الاستوديو، ومشاهدها مهام على العامل نفسه.
  if (b.purpose === "studio") {
    const machine = assertOneMachine(await episodeSceneMachines(path.join(path.dirname(inputs.scriptPath), "previews"),
      inputs.plan.chapters.flatMap((c) => c.scenes.map((s) => s.id))), "Master");
    if (machine === MAC_MACHINE)
      throw new Error("لا Master على جهاز الرندر: مشاهد الحلقة رُندرت على الماك (D233: كل حلقة تُرندر كاملة على جهاز واحد). أعد رندر المشاهد على جهاز الرندر أولًا.");
  }
  const mediaRel = await publishSnapshot(share, inputs.media);
  const render: RenderSpec = { orientation: "landscape", quality: "master", scope: { all: true }, scenePreview: false,
    timingMode: await voiceTimingMode(inputs.scriptPath, inputs.plan, inputs.media), review1080: true, ...(o.concurrency ? { concurrency: o.concurrency } : {}),
    ...(o.x264Preset ? { x264Preset: o.x264Preset } : {}), ...(o.chunkFrames ? { chunkFrames: o.chunkFrames } : {}) };
  const sha = planSha256(inputs.plan);
  const extra = [o.concurrency ? `c${o.concurrency}` : "", o.x264Preset ? `p${o.x264Preset}` : "", o.chunkFrames ? `k${o.chunkFrames}` : ""].filter(Boolean).join("-");
  return validateJobV2({
    ...baseFields(b), id: idFor(b, "master", extra, { c: b.commit, sha, base: inputs.media.base, render, g: inputs.narrationGain }),
    kind: "master", media: mediaRel, render,
    expected: { durationSec: secondsOf(inputs.plan, inputs.media), ...sizeFor("master", "landscape") },
    inputs: { planSha256: sha, plan: inputs.plan, media: inputs.media, narrationGain: inputs.narrationGain },
  });
};

/**
 * D243: النسخة العمودية الكاملة 1080×1920 (الحلقة كلها، بمدخلات Master نفسها: الخطة ولقطة الوسائط وربح العلوّ ووضع
 * التوقيت). فحوص المحتوى للنسخة النهائية قبل الإرسال (assertMasterReady)، وD233 كـMaster: مشاهد الحلقة من جهاز الرندر.
 */
export const buildVerticalJob = async (ep: string, inputs: Awaited<ReturnType<typeof fullEpisodeInputs>>, b: Base, share: string): Promise<WorkerJobV2> => {
  if (b.purpose !== "studio") throw new Error("النسخة العمودية الكاملة للاستوديو وحده؛ التجربة بمشاهد بعينها (worker-submit-scenes --orientation portrait --purpose trial).");
  const { assertMasterReady, voiceTimingMode } = await import("../episode");
  await assertMasterReady({ scriptPath: inputs.scriptPath, plan: inputs.plan, media: inputs.media, channel: loadChannel() });
  const machine = assertOneMachine(await episodeSceneMachines(path.join(path.dirname(inputs.scriptPath), "previews"),
    inputs.plan.chapters.flatMap((c) => c.scenes.map((s) => s.id))), "النسخة العمودية");
  if (machine === MAC_MACHINE)
    throw new Error("لا نسخة عمودية على جهاز الرندر: مشاهد الحلقة رُندرت على الماك (D233). أعد رندر المشاهد على جهاز الرندر أولًا.");
  const mediaRel = await publishSnapshot(share, inputs.media);
  const render: RenderSpec = { orientation: "portrait", quality: "vertical", scope: { all: true }, scenePreview: false,
    timingMode: await voiceTimingMode(inputs.scriptPath, inputs.plan, inputs.media) };
  const sha = planSha256(inputs.plan);
  return validateJobV2({
    ...baseFields(b), id: idFor(b, "vertical", "", { c: b.commit, sha, base: inputs.media.base, render, g: inputs.narrationGain }),
    kind: "vertical", media: mediaRel, render,
    expected: { durationSec: secondsOf(inputs.plan, inputs.media), ...sizeFor("vertical", "portrait") },
    inputs: { planSha256: sha, plan: inputs.plan, media: inputs.media, narrationGain: inputs.narrationGain },
  });
};

/** D243: شورت مقصوص من النسخة العمودية: مدخلاتها نفسها، وبصمة ملفها، ومقاطعه بالإطارات (verticalShorts.ts). */
export const buildCutJob = (vertical: WorkerJobV2, verticalSha256: string, n: number, sceneIds: string[], ranges: CutSpec["ranges"], b: Base): WorkerJobV2 => {
  if (vertical.kind !== "vertical") throw new Error("القص من النسخة العمودية وحدها.");
  const cut: CutSpec = { source: { job: vertical.id, sha256: verticalSha256 }, sceneIds: [...sceneIds], ranges, fps };
  return validateJobV2({
    ...baseFields(b), id: idFor(b, "cut", String(n), { c: b.commit, cut }), kind: "cut", n, media: vertical.media, cut,
    expected: { durationSec: cutSeconds(ranges, fps), ...sizeFor("vertical", "portrait") },
    inputs: vertical.inputs,
  });
};

/** يكتب المهمة في jobs/ إلا إن وُجدت (منتظرة أو جارية أو منتهية)؛ والفاشلة السابقة تُنقل جانبًا. */
export const enqueue = async (share: string, job: WorkerJobV2) => {
  const q = await ensureQueue(share);
  const where = [path.join(q.jobs, `${job.id}.json`), path.join(q.running, `${job.id}.json`), path.join(q.done, job.id)].find((f) => existsSync(f));
  if (where) return false;
  if (existsSync(path.join(q.failed, job.id))) await rename(path.join(q.failed, job.id), path.join(q.failed, `${job.id}.retry-${Date.now()}`));
  await writeJsonAtomic(path.join(q.jobs, `${job.id}.json`), job);
  return true;
};

/* ── التحقق العام من ناتج الإصدار 2 ── */

export type V2VerifyInput = { job: WorkerJobV2; submitted: WorkerJobV2 | undefined; result: WorkerResult; fileSha256: string; fileBytes: number; probe: VideoProbe };
/** كل أسباب الرفض (فارغة = مقبول). المهمة كما أرسلها هذا الماك حرفيًا، والملف بصمته وصيغته وأبعاده ومدته وبلا أثر. */
export const verifyV2Output = (v: V2VerifyInput): string[] => {
  const out: string[] = [];
  const { job, submitted, result, probe } = v;
  if (!submitted) out.push("هذه المهمة لم يرسلها هذا الماك.");
  else {
    const strip = (j: WorkerJobV2) => JSON.stringify({ ...j, claimedBy: undefined, claimedAt: undefined });
    if (strip(submitted) !== strip(job)) out.push("المهمة في done/ ليست التي أرسلها الماك حرفيًا (الـcommit أو الخطة أو الوسائط أو المواصفات).");
  }
  if (result.id !== job.id) out.push("نتيجة لمهمة أخرى.");
  if (result.commit !== job.commit) out.push(`رُندر بـcommit آخر (${String(result.commit).slice(0, 8)}) لا commit المهمة (${job.commit.slice(0, 8)}).`);
  if (v.fileSha256 !== result.sha256) out.push("بصمة الفيديو لا تطابق result.json.");
  if (v.fileBytes !== result.bytes) out.push("حجم الفيديو لا يطابق result.json.");
  if (probe.videoCodec !== "h264") out.push(`ترميز الصورة ${probe.videoCodec ?? "مفقود"} لا h264.`);
  if (probe.width !== job.expected.width || probe.height !== job.expected.height) out.push(`الأبعاد ${probe.width}×${probe.height} لا ${job.expected.width}×${job.expected.height}.`);
  if (probe.audioCodec !== "aac") out.push(`الصوت ${probe.audioCodec ?? "مفقود"} لا AAC.`);
  const d = probe.durationSec - job.expected.durationSec;
  const joinKind = job.kind === "assembly" || job.kind === "prefinal";
  const ok = joinKind ? d <= DURATION_TOLERANCE_SEC && d >= -JOIN_HEAD_TRIM_MAX_SEC : Math.abs(d) <= DURATION_TOLERANCE_SEC;
  if (!ok) out.push(`المدة ${probe.durationSec.toFixed(3)} ث والمتوقَّع ${job.expected.durationSec.toFixed(3)} ث (السماح ±${DURATION_TOLERANCE_SEC}${joinKind ? `، وقص صمت البداية حتى ${JOIN_HEAD_TRIM_MAX_SEC} ث` : ""}).`);
  const traces = probe.tags.flatMap((t) => findTraces(t).map((x) => `${x} (${t})`));
  if (traces.length) out.push(`أثر لأدوات الإنتاج في البيانات الوصفية: ${traces.join("، ")}`);
  return out;
};

/* ── التجربة: bal worker-trial / worker-trial-collect ── */

export type TrialStage = "scenes" | "assembly" | "master";
export type TrialRecord = { tag: string; episode: string; channel: string; commit: string; submittedAt: string; jobs: { id: string; kind: string; sceneId?: string }[]; submitted: Record<string, WorkerJobV2> };
export const trialRecordFile = (outDir: string) => path.join(outDir, "submitted.json");

/**
 * يرسل تجربة كاملة بالترتيب (createdAt متصاعد): كل المشاهد، ثم التجميع (من قطعها في done/)، ثم Master 4K.
 * لا يقرأ السجل الموقّع ولا يكتب في out/package ولا في previews؛ سجله في outDir وحده.
 */
export const submitTrial = async (ep: string, share: string, o: { tag: string; outDir: string; stages?: TrialStage[]; scenes?: string[]; concurrency?: number;
  x264Preset?: TrialX264Preset; chunkFrames?: number; sharedBundle?: boolean; log?: (m: string) => void }) => {
  const log = o.log ?? (() => {});
  const stages = o.stages ?? ["scenes", "assembly", "master"];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(o.tag) || o.tag.length > 40) throw new Error("وسم التجربة: حروف لاتينية صغيرة وأرقام وشرطات.");
  const scriptPath = await resolveScriptPath(ep);
  // D234 بلا استثناء: التجربة لا تتخطى المحرر (تتخطى متطلبات الاعتماد وحدها)، ولا تُرسل منها مهمة واحدة قبله
  await assertEditorPassed(scriptPath);
  const channel = loadChannel().id;
  const episodeFolder = path.basename(path.dirname(scriptPath));
  const commit = await assertCommitMatchesWorkingTree(projectRoot, channel, episodeFolder);
  const plan = await loadPlan(ep);
  if (!plan) throw new Error("لا توجد خطة للحلقة.");
  await mkdir(o.outDir, { recursive: true });
  const rec: TrialRecord = existsSync(trialRecordFile(o.outDir)) ? JSON.parse(await readFile(trialRecordFile(o.outDir), "utf8"))
    : { tag: o.tag, episode: episodeFolder, channel, commit, submittedAt: new Date().toISOString(), jobs: [], submitted: {} };
  const t0 = Date.now();
  let k = 0;
  const b = (): Base => ({ channel, episodeFolder, commit, purpose: "trial", trial: o.tag, createdAt: new Date(t0 + k++).toISOString() });
  const add = async (job: WorkerJobV2) => {
    const fresh = await enqueue(share, job);
    rec.submitted[job.id] = job;
    if (!rec.jobs.some((j) => j.id === job.id)) rec.jobs.push({ id: job.id, kind: job.kind, ...(job.sceneId ? { sceneId: job.sceneId } : {}) });
    log(`${fresh ? "أُرسلت" : "موجودة من قبل"}: ${job.id} (${job.expected.durationSec} ث، ${job.expected.width}×${job.expected.height})`);
  };
  const ids = (o.scenes?.length ? o.scenes : plan.chapters.flatMap((c) => c.scenes.map((s) => s.id)));
  const sceneJobs: WorkerJobV2[] = [];
  // تجربة «حزمة واحدة للحلقة»: لقطة وسائط واحدة للحلقة (كما تحسبها قطعة المشهد: المسودة بلا اشتراط تلاوة)
  const sharedMedia = o.sharedBundle ? await prepareRenderMedia(ep, plan, { requireApprovedQuran: false }) : undefined;
  if (stages.includes("scenes") || stages.includes("assembly")) {
    for (const id of ids) {
      const job = await buildSceneJob(ep, id, b(), share, { sharedMedia });
      sceneJobs.push(job);
      if (stages.includes("scenes")) await add(job);
    }
  }
  const full = stages.includes("assembly") || stages.includes("master") ? await fullEpisodeInputs(ep, { requireApprovedQuran: stages.includes("master") }) : null;
  if (stages.includes("assembly") && full)
    await add(await buildJoinJob("assembly", full, sceneJobs.map((j) => ({ sceneId: j.sceneId!, job: j.id })), b(), share));
  if (stages.includes("master") && full) await add(await buildMasterJob(ep, full, b(), share, { concurrency: o.concurrency, x264Preset: o.x264Preset, chunkFrames: o.chunkFrames }));
  await writeFile(trialRecordFile(o.outDir), JSON.stringify(rec, null, 1) + "\n");
  return rec;
};

/**
 * D243 (تجربة قبل التعميم): مشاهد بعينها عمودية 1080×1920 بجودة vertical على الويندوز، ليرى المالك كيف تُعاد صياغة
 * المشهد للعمودي (الرسم والنص والترجمة والآية داخل المنطقة الآمنة) قبل النسخة العمودية الكاملة. كل مشهد مهمة «trial»
 * بخطته المقصوصة عليه ووسائطه (كقطعة المشهد في الاستوديو)، لا تدخل الحزمة ولا السجل الموقّع أبدًا؛ وتُقرأ نتائجها بـ
 * `bal worker-trial-collect --out <المجلد نفسه>` (تُنسخ الملفات إلى <المجلد>/vertical/).
 */
export const submitVerticalTrialScenes = async (ep: string, share: string, o: { scenes: string[]; tag: string; outDir: string; log?: (m: string) => void }) => {
  const log = o.log ?? (() => {});
  if (!o.scenes.length) throw new Error("التجربة العمودية لمشاهد بعينها: --scenes c1-s2,c1-s3,…");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(o.tag) || o.tag.length > 40) throw new Error("وسم التجربة: حروف لاتينية صغيرة وأرقام وشرطات.");
  const scriptPath = await resolveScriptPath(ep);
  // D234 بلا استثناء، قبل أي حساب أو نسخ
  await assertEditorPassed(scriptPath);
  const channel = loadChannel().id;
  const episodeFolder = path.basename(path.dirname(scriptPath));
  const commit = await assertCommitMatchesWorkingTree(projectRoot, channel, episodeFolder);
  await mkdir(o.outDir, { recursive: true });
  const rec: TrialRecord = existsSync(trialRecordFile(o.outDir)) ? JSON.parse(await readFile(trialRecordFile(o.outDir), "utf8"))
    : { tag: o.tag, episode: episodeFolder, channel, commit, submittedAt: new Date().toISOString(), jobs: [], submitted: {} };
  if (rec.tag !== o.tag || rec.episode !== episodeFolder || rec.channel !== channel) throw new Error(`مجلد التجربة ${o.outDir} لتجربة أخرى (${rec.channel} ${rec.episode} ${rec.tag}).`);
  const { shotsRenderInputs } = await import("../shotsPreview");
  const t0 = Date.now();
  let k = 0;
  for (const id of o.scenes) {
    const cut = await shotsRenderInputs(ep, [id], { sceneDraft: true, allowPendingRecitation: true });
    assertTemplatesApproved(cut.plan);
    if (cut.pendingRecitation.length) log(`تنبيه: ${id} آية بلا تلاوة معتمدة؛ تظهر في التجربة صامتة بلا علامة المسودة.`);
    const mediaRel = await publishSnapshot(share, cut.media);
    const render: RenderSpec = { orientation: "portrait", quality: "vertical", scope: { all: true }, scenePreview: false, timingMode: "scene-preview" };
    const b: Base = { channel, episodeFolder, commit, purpose: "trial", trial: o.tag, createdAt: new Date(t0 + k++).toISOString() };
    const sha = planSha256(cut.plan);
    const job = validateJobV2({
      ...baseFields(b), id: idFor(b, "trial", `v-${id}`, { c: commit, sha, base: cut.media.base, render }), kind: "trial", media: mediaRel, render,
      expected: { durationSec: secondsOf(cut.plan, cut.media), ...sizeFor("vertical", "portrait") },
      inputs: { planSha256: sha, plan: cut.plan, media: cut.media, narrationGain: {} },
    });
    const fresh = await enqueue(share, job);
    rec.submitted[job.id] = job;
    if (!rec.jobs.some((j) => j.id === job.id)) rec.jobs.push({ id: job.id, kind: job.kind, sceneId: id });
    log(`${fresh ? "أُرسلت" : "موجودة من قبل"}: ${id} عمودي ← ${job.id} (${job.expected.durationSec} ث، 1080×1920)`);
  }
  await writeFile(trialRecordFile(o.outDir), JSON.stringify(rec, null, 1) + "\n");
  return rec;
};

export type TrialRow = {
  id: string; kind: string; sceneId?: string; status: "queued" | "running" | "done" | "failed" | "missing"; progress?: JobProgress | null;
  error?: string; startedAt?: string; finishedAt?: string; wallSec?: number; bundleSec?: number; renderSec?: number; finalizeSec?: number;
  durationSec?: number; expectedSec?: number; speed?: number; sha256?: string; bytes?: number; refused?: string[]; local?: string;
  minFreeMB?: number; machine?: WorkerResult["machine"];
};
const secs = (a?: string, b?: string) => (a && b ? round3((Date.parse(b) - Date.parse(a)) / 1000) : undefined);

/**
 * يقرأ نتائج التجربة من المجلد المشترك، ويتحقق من كل ناتج (verifyV2Output)، وينسخ الصغير وحده إلى outDir (قطع المشاهد
 * والتجميع 1080p، ونسخة مراجعة Master)، ويكتب index.json (البصمات والأوقات) وtimings.md. الكبير (4K) يبقى في المجلد المشترك.
 */
export const collectTrial = async (share: string, outDir: string, o: { copy?: boolean; log?: (m: string) => void } = {}) => {
  const log = o.log ?? (() => {});
  const rec = JSON.parse(await readFile(trialRecordFile(outDir), "utf8")) as TrialRecord;
  const q = queuePaths(share);
  const rows: TrialRow[] = [];
  for (const j of rec.jobs) {
    const sub = rec.submitted[j.id]!;
    const row: TrialRow = { id: j.id, kind: j.kind, ...(j.sceneId ? { sceneId: j.sceneId } : {}), status: "missing", expectedSec: sub.expected.durationSec };
    const doneDir = path.join(q.done, j.id);
    if (existsSync(doneDir)) {
      row.status = "done";
      const job = validateJobV2(JSON.parse(await readFile(path.join(doneDir, "job.json"), "utf8")));
      const result = JSON.parse(await readFile(path.join(doneDir, "result.json"), "utf8")) as WorkerResult;
      const file = path.join(doneDir, doneVideoName(job));
      const probe = await probeVideo(file);
      const fileSha256 = await sha256File(file);
      const refused = verifyV2Output({ job, submitted: sub, result, fileSha256, fileBytes: (await stat(file)).size, probe });
      const t = result.timings;
      Object.assign(row, {
        startedAt: result.startedAt, finishedAt: result.finishedAt, wallSec: secs(result.startedAt, result.finishedAt),
        bundleSec: secs(t?.startedAt, t?.bundledAt), renderSec: secs(t?.bundledAt ?? t?.startedAt, t?.renderedAt), finalizeSec: secs(t?.renderedAt, t?.finishedAt),
        durationSec: round3(probe.durationSec), sha256: fileSha256, bytes: result.bytes, minFreeMB: result.memory?.minFreeMB, machine: result.machine,
        ...(refused.length ? { refused } : {}),
      });
      if (row.wallSec && row.durationSec) row.speed = round3(row.wallSec / row.durationSec);
      if (o.copy !== false && !refused.length) {
        const small = job.render?.quality === "master" ? (result.review ? path.join(doneDir, result.review.file) : null) : file;
        if (small && existsSync(small)) {
          const dest = path.join(outDir, j.kind === "scene" ? "scenes" : job.render?.quality === "vertical" ? "vertical" : "", path.basename(small));
          await mkdir(path.dirname(dest), { recursive: true });
          if (!existsSync(dest) || (await sha256File(dest)) !== (await sha256File(small))) await copyFile(small, dest);
          row.local = path.relative(outDir, dest);
        }
      }
    } else if (existsSync(path.join(q.failed, j.id))) {
      row.status = "failed";
      try { row.error = (JSON.parse(await readFile(path.join(q.failed, j.id, "error.json"), "utf8")) as { error: string }).error; } catch { row.error = "error.json مفقود"; }
    } else if (existsSync(path.join(q.running, `${j.id}.json`))) { row.status = "running"; row.progress = await readProgress(share, j.id); }
    else if (existsSync(path.join(q.jobs, `${j.id}.json`))) row.status = "queued";
    rows.push(row);
  }
  const sum = (k: string) => round3(rows.filter((r) => r.kind === k && r.wallSec).reduce((n, r) => n + r.wallSec!, 0));
  const span = (k: string) => {
    const r = rows.filter((x) => x.kind === k && x.startedAt && x.finishedAt);
    return r.length ? secs(r.map((x) => x.startedAt!).sort()[0], r.map((x) => x.finishedAt!).sort().reverse()[0]) : undefined;
  };
  const summary = {
    scenes: { done: rows.filter((r) => r.kind === "scene" && r.status === "done").length, total: rows.filter((r) => r.kind === "scene").length, sumSec: sum("scene"), spanSec: span("scene") },
    assembly: rows.find((r) => r.kind === "assembly") ?? null,
    master: rows.find((r) => r.kind === "master") ?? null,
  };
  const status = await workerStatus(share);
  const index = { tag: rec.tag, episode: rec.episode, channel: rec.channel, commit: rec.commit, collectedAt: new Date().toISOString(), worker: status, summary, rows };
  await writeFile(path.join(outDir, "index.json"), JSON.stringify(index, null, 1) + "\n");
  const fmt = (s?: number) => (s === undefined ? "—" : s >= 60 ? `${Math.floor(s / 60)}د ${Math.round(s % 60)}ث` : `${s.toFixed(1)}ث`);
  const md = [`# تجربة D232: ${rec.tag} (${rec.channel} ${rec.episode}) @ ${rec.commit.slice(0, 8)}`, "", `- ${status.message}`, "",
    "| المهمة | الحالة | المدة | زمن الجدار | التجميع | الرندر | الإنهاء | ×الزمن الحقيقي | أدنى ذاكرة حرة |", "|---|---|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.sceneId ?? r.kind} | ${r.status}${r.refused ? " (مرفوض)" : ""}${r.progress ? ` ${r.progress.percent}%` : ""} | ${fmt(r.durationSec ?? r.expectedSec)} | ${fmt(r.wallSec)} | ${fmt(r.bundleSec)} | ${fmt(r.renderSec)} | ${fmt(r.finalizeSec)} | ${r.speed ?? "—"} | ${r.minFreeMB ?? "—"} MB |`),
    "", `- المشاهد: ${summary.scenes.done}/${summary.scenes.total}، مجموع ${fmt(summary.scenes.sumSec)}، من أول بدء لآخر انتهاء ${fmt(summary.scenes.spanSec)}`,
    ...rows.filter((r) => r.refused || r.error).map((r) => `- ${r.id}: ${r.error ?? r.refused!.join("؛ ")}`)].join("\n");
  await writeFile(path.join(outDir, "timings.md"), md + "\n");
  log(md);
  return index;
};
