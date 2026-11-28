/**
 * جانب الماك من عامل الرندر (D226): `bal worker-submit` و`bal worker-collect`.
 *
 * الإرسال: بعد اعتماد المالك للنسخة النهائية فقط (البوابة نفسها التي تسبق `package --shorts`)، يحسب مقاطع
 * الشورتس كما يحسبها package.ts، وينسخ لقطة الوسائط الثابتة (بصمة المحتوى) إلى المجلد المشترك، ويكتب مهمة لكل
 * شورت بـcommit الماك الحالي (ويرفض إن اختلفت ملفات الحلقة أو الكود عنه، أو لم يُدفع الـcommit بعد).
 *
 * الاستلام: لا يُستورد ناتج العامل إلا بعد أن يطابق: بصمة الملف، وh264 بـ2160×3840 وصوت AAC، والمدة ±0.1 ث من
 * المتوقَّع، وcommit المهمة وخطتها كما أرسلها هذا الماك، وخلوّ البيانات الوصفية من أي أثر لأدوات الإنتاج؛ ثم يُعاد
 * تنظيف البيانات الوصفية على الماك نفسه، ويُقاس بمقياس الحركة (≥ الحد) كما يُقاس شورت الماك. كل رفض برسالة عربية.
 */
import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import config from "../../../config.json";
import { resolveScriptPath } from "../../script/episodes";
import { loadPlan, regeneratePlan } from "../../plan/io";
import { prepareRenderMedia } from "../../plan/collect";
import { defaultRenderMediaRoot, verifyStagedMedia } from "../../plan/renderStage";
import { segmentPlan, shortSegments, type ShortSegment } from "../../plan/shorts";
import type { Plan } from "../../plan/types";
import type { EpisodeMedia } from "../../plan/media";
import { channelInfo, loadChannel, loadChannelIdentity } from "../../channel";
import { renderInfoFile, type RenderInfo } from "../quality";
import { outDirFor, cleanMetadata } from "../episode";
import { copyUnlinkedFile } from "../fsIsolation";
import { findTraces, assertNoTraces } from "../../package/traces";
import { shortTitleFor } from "../../package/package";
import { buildSrt } from "../../package/captions";
import { scenesOf, episodeFrames } from "../../remotion/scenes/Episode";
import { measureMotion, motionSummary, MOTION_MIN, type MotionReport } from "../motionMeter";
import { exemptForRender } from "../stillness";
import { projectRoot } from "../../config/paths";
import { git, headCommit } from "./git";
import { probeVideo, type VideoProbe } from "./probe";
import {
  doneVideoName, ensureQueue, inShare, mediaRelFor, planSha256, queuePaths, sha256File, snapshotHashOf, validateJob,
  writeJsonAtomic, SHORT_SIZE, type WorkerJob, type WorkerResult,
} from "./protocol";

export const DURATION_TOLERANCE_SEC = 0.1;
const fps = (config as { video: { fps: number } }).video.fps;

/* ── سياق الحلقة على الماك (مشترك بين الإرسال والاستلام) ── */

export type MacShortsContext = {
  ep: string; scriptPath: string; channel: string; episodeFolder: string; plan: Plan; planSha256: string; id: string;
  dir: string; media: EpisodeMedia; segments: ShortSegment[];
};

/** البوابات نفسها التي تسبق `package --shorts`: Master معتمد بعينه، ونسخة نهائية بصوت كامل، ومقاطع بلا مشكلات، وتلاوات معتمدة. */
export const macShortsContext = async (ep: string): Promise<MacShortsContext> => {
  const scriptPath = await resolveScriptPath(ep);
  const plan = (await loadPlan(ep)) ?? (await regeneratePlan(ep));
  const dir = path.join(await outDirFor(ep), "package");
  const { requireSceneMasterReady } = await import("../../studio/sceneService");
  await requireSceneMasterReady(ep);
  const info = existsSync(renderInfoFile(dir)) ? (JSON.parse(await readFile(renderInfoFile(dir), "utf8")) as RenderInfo) : null;
  if (!info || info.quality !== "master" || !info.voiced) throw new Error("الشورتس تُصنع من النسخة النهائية بأعلى جودة وبصوت كامل. اصنع النسخة النهائية أولًا.");
  const pick = shortSegments(plan);
  if (!pick.segments.length || pick.issues.length) throw new Error(pick.issues.join(" ") || "لا مقاطع شورتس في الخطة.");
  // D241: لا يُرسل إلى الويندوز (ولا يُستلم منه) شورت ليس فكرة كاملة وحده
  (await import("../../package/shortIdeaPlan")).assertShortsIdea(plan, pick.segments);
  const media = await prepareRenderMedia(ep, plan, { requireApprovedQuran: true });
  const narrated = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration.trim());
  const voicedOk = narrated.filter((s) => {
    const clip = media.voice[s.id];
    return clip?.text === s.narration.trim() && existsSync(path.join(path.dirname(scriptPath), "voice", clip.file));
  }).length;
  if (narrated.length && voicedOk !== narrated.length)
    throw new Error(`الشورتس تتطلب صوتًا مطابقًا في كل مشهد: ${voicedOk} من ${narrated.length}.`);
  return {
    ep, scriptPath, channel: loadChannel().id, episodeFolder: path.basename(path.dirname(scriptPath)), plan, planSha256: planSha256(plan),
    id: plan.episode || ep, dir, media, segments: pick.segments,
  };
};

/** المدة كما يحسبها التكوين نفسه (calculateEpisodeMetadata) للمقطع الذي يُرندر. */
export const expectedShortSeconds = (plan: Plan, seg: ShortSegment, media: EpisodeMedia) => {
  const sp = segmentPlan(plan, seg);
  return episodeFrames({ plan: sp.plan, chapter: sp.chapter, media, channel: channelInfo(loadChannel()) }) / fps;
};

const segmentOf = (seg: ShortSegment): WorkerJob["segment"] => (seg.chapter !== undefined ? { chapter: seg.chapter } : { sceneIds: [...seg.sceneIds] });

/* ── سجلات الماك المحلية (out/package، خارج Git) ── */

export type SubmittedRecord = Pick<WorkerJob, "id" | "n" | "segment" | "commit" | "expected"> & {
  shortTitle: string | null; planSha256: string; mediaBase: string; submittedAt: string;
};
export const submittedFile = (dir: string) => path.join(dir, "worker-submitted.json");
export const collectedFile = (dir: string) => path.join(dir, "worker-collected.json");
const readJson = async <T>(f: string, fallback: T): Promise<T> => { try { return JSON.parse(await readFile(f, "utf8")) as T; } catch { return fallback; } };

/* ── git: الـcommit الذي يرندر به العامل يجب أن يكون محتوى الماك نفسه ── */

export const assertCommitMatchesWorkingTree = async (repo: string, channel: string, episodeFolder: string) => {
  const ep = `channels/${channel}/episodes/${episodeFolder}`;
  // versions/ أرشيف نسخ سابقة محلي (فيه فيديو لا يُرفع)، والرندر لا يقرؤه؛ فلا يمنع الإرسال.
  const epState = await git(repo, ["status", "--porcelain", "--", ep, `:(exclude)${ep}/versions`]);
  if (epState.code !== 0) throw new Error(`git status: ${epState.err}`);
  const code = await git(repo, ["status", "--porcelain", "--untracked-files=no", "--", "src", "public", "bin", "config.json", "package.json", "package-lock.json", "tsconfig.json", "brand",
    `channels/${channel}`, `:(exclude)channels/${channel}/episodes`]);
  if (code.code !== 0) throw new Error(`git status: ${code.err}`);
  const changed = [epState.out, code.out].filter(Boolean).join("\n");
  if (changed) throw new Error(`ملفات الحلقة أو الكود تختلف عن آخر commit، والعامل يرندر الـcommit حرفيًا. احفظها أولًا (الحفظ الآلي في الاستوديو) ثم أعد الإرسال:\n${changed.slice(0, 800)}`);
  const head = await headCommit(repo);
  const remote = await git(repo, ["branch", "-r", "--contains", head]);
  if (remote.code !== 0 || !remote.out.trim()) throw new Error(`الـcommit ${head.slice(0, 8)} غير موجود على GitHub بعد؛ العامل يجلبه من هناك. انتظر الحفظ الآلي ثم أعد الإرسال.`);
  return head;
};

/* ── الإرسال ── */

/** ينسخ لقطة الوسائط إلى المجلد المشترك مرة واحدة (بصمة المحتوى اسمها؛ الموجودة لا تُنسخ ثانية). */
export const publishSnapshot = async (share: string, media: EpisodeMedia, mediaRoot = defaultRenderMediaRoot()) => {
  const snap = snapshotHashOf(media.base);
  if (!snap) throw new Error("لقطة الوسائط ليست لقطة رندر ثابتة.");
  await verifyStagedMedia(mediaRoot, media.base);
  const rel = mediaRelFor(snap.channel, snap.episode, snap.hash);
  const target = inShare(share, rel);
  const source = path.join(mediaRoot, ...media.base.split("/").filter(Boolean));
  if (existsSync(path.join(target, ".ready.json"))) {
    const same = (await readFile(path.join(target, ".ready.json"), "utf8")) === (await readFile(path.join(source, ".ready.json"), "utf8"));
    if (!same) throw new Error(`لقطة في المجلد المشترك بالبصمة نفسها ومحتوى مختلف: ${rel}`);
    return rel;
  }
  const partial = `${target}.partial-${process.pid}-${Date.now()}`;
  await mkdir(partial, { recursive: true });
  try {
    for (const kind of ["voice", "sfx", "recitations", "images"]) {
      await mkdir(path.join(partial, kind), { recursive: true });
      for (const name of await readdir(path.join(source, kind))) await copyUnlinkedFile(path.join(source, kind, name), path.join(partial, kind, name));
    }
    await copyFile(path.join(source, ".ready.json"), path.join(partial, ".ready.json"));
    await rm(target, { recursive: true, force: true });
    await rename(partial, target);
  } finally {
    await rm(partial, { recursive: true, force: true });
  }
  return rel;
};

export const workerJobId = (channel: string, episodeFolder: string, n: number, fingerprint: unknown) =>
  `${channel}-${episodeFolder.slice(0, 3)}-short-${n}-${createHash("sha256").update(JSON.stringify(fingerprint)).digest("hex").slice(0, 12)}`;

export const submitWorkerShorts = async (ep: string, share: string, o: { only?: number; log?: (m: string) => void; /** D242: رندر الشورت العمودي منفصلًا موقوف؛ للمهام القديمة وحدها */ legacyD226?: true } = {}) => {
  // D242: كل الشورتس قصّ من النسخة العمودية الكاملة (studioJobs.submitVerticalShorts)، لا رندر عمودي منفصل لكل شورت
  if (!o.legacyD226) throw new Error("D242: الشورتس تُقص من النسخة العمودية وحدها: npx bal worker-submit <الحلقة> --shorts (بعد worker-submit-vertical وworker-import).");
  const log = o.log ?? (() => {});
  const ctx = await macShortsContext(ep);
  // D234: لا مهمة رندر لسكريبت فيه جملة لم تمرّ بمحرر المحتوى (والعامل يفحصها ثانية في قلب الرندر)
  await (await import("../../studio/scriptPipelineStore")).assertEditorPassed(ctx.scriptPath);
  const commit = await assertCommitMatchesWorkingTree(projectRoot, ctx.channel, ctx.episodeFolder);
  const segments = o.only !== undefined ? ctx.segments.filter((s) => s.n === o.only) : ctx.segments;
  if (!segments.length) throw new Error(`لا شورت برقم ${o.only} (المتاح 1…${ctx.segments.length}).`);
  const { narrationLoudness } = await import("../../studio/narrationLoudness");
  const narrationGain = (await narrationLoudness(ctx.scriptPath, ctx.plan, ctx.media)).gain;
  const q = await ensureQueue(share);
  log("نسخ لقطة الوسائط إلى المجلد المشترك…");
  const mediaRel = await publishSnapshot(share, ctx.media);
  const submitted = await readJson<Record<string, SubmittedRecord>>(submittedFile(ctx.dir), {});
  const written: string[] = [], skipped: string[] = [];
  for (const seg of segments) {
    const shortTitle = await shortTitleFor(ctx.scriptPath, seg);
    if (shortTitle) assertNoTraces([{ name: `عنوان الشورت ${seg.n}`, text: shortTitle }]);
    const expected = { durationSec: Math.round(expectedShortSeconds(ctx.plan, seg, ctx.media) * 1000) / 1000, ...SHORT_SIZE };
    const segment = segmentOf(seg);
    const id = workerJobId(ctx.channel, ctx.episodeFolder, seg.n, { commit, plan: ctx.planSha256, base: ctx.media.base, segment, shortTitle: shortTitle ?? null, narrationGain });
    const job: WorkerJob = validateJob({
      version: 1, id, channel: ctx.channel, episode: ctx.episodeFolder, kind: "short", n: seg.n, segment,
      ...(shortTitle ? { shortTitle } : {}), commit, quality: "master", media: mediaRel, expected,
      inputs: { planSha256: ctx.planSha256, plan: ctx.plan, media: ctx.media, narrationGain }, createdAt: new Date().toISOString(),
    });
    const where = [path.join(q.jobs, `${id}.json`), path.join(q.running, `${id}.json`), path.join(q.done, id)].find((f) => existsSync(f));
    if (where) { skipped.push(id); log(`الشورت ${seg.n}: المهمة نفسها موجودة (${path.basename(path.dirname(where))}).`); continue; }
    if (existsSync(path.join(q.failed, id))) await rename(path.join(q.failed, id), path.join(q.failed, `${id}.retry-${Date.now()}`));
    submitted[id] = { id, n: seg.n, segment, commit, expected, shortTitle: shortTitle ?? null, planSha256: ctx.planSha256, mediaBase: ctx.media.base, submittedAt: job.createdAt };
    await writeJsonAtomic(path.join(q.jobs, `${id}.json`), job);
    written.push(id);
    log(`الشورت ${seg.n}: أُرسلت المهمة ${id} (${expected.durationSec} ث).`);
  }
  await writeFile(submittedFile(ctx.dir), JSON.stringify(submitted, null, 2) + "\n");
  return { written, skipped, commit };
};

/* ── الاستلام ── */

export type VerifyInput = {
  job: WorkerJob;
  result: WorkerResult;
  record: SubmittedRecord | undefined;
  current: { planSha256: string; mediaBase: string; segment: WorkerJob["segment"] | null; shortTitle: string | null };
  fileSha256: string;
  fileBytes: number;
  probe: VideoProbe;
};

/** كل أسباب الرفض (فارغة = مقبول للخطوة التالية: تنظيف البيانات الوصفية ثم مقياس الحركة). */
export const verifyWorkerOutput = (v: VerifyInput): string[] => {
  const out: string[] = [];
  const { job, result, record, current, probe } = v;
  if (!record) out.push("هذه المهمة لم يرسلها هذا الماك (لا سجل لها في worker-submitted.json).");
  else {
    if (record.commit !== job.commit) out.push(`commit المهمة (${job.commit.slice(0, 8)}) ليس الذي أرسله الماك (${record.commit.slice(0, 8)}).`);
    if (record.planSha256 !== job.inputs.planSha256) out.push("خطة المهمة ليست الخطة التي أرسلها الماك.");
    if (record.mediaBase !== job.inputs.media.base) out.push("وسائط المهمة ليست التي أرسلها الماك.");
    if (record.n !== job.n || JSON.stringify(record.segment) !== JSON.stringify(job.segment)) out.push("مقطع المهمة ليس الذي أرسله الماك.");
    if ((record.shortTitle ?? null) !== (job.shortTitle ?? null)) out.push("عنوان الشورت في المهمة ليس الذي أرسله الماك.");
    if (Math.abs(record.expected.durationSec - job.expected.durationSec) > 1e-6) out.push("المدة المتوقعة في المهمة ليست التي حسبها الماك.");
  }
  if (result.id !== job.id) out.push("نتيجة لمهمة أخرى.");
  if (result.commit !== job.commit) out.push(`رُندر بـcommit آخر (${String(result.commit).slice(0, 8)}) لا commit المهمة (${job.commit.slice(0, 8)}).`);
  if (current.planSha256 !== job.inputs.planSha256) out.push("تغيّرت خطة الحلقة بعد الإرسال؛ أعد الإرسال.");
  if (current.mediaBase !== job.inputs.media.base) out.push("تغيّرت وسائط الحلقة (الصوت أو التلاوات أو الصور) بعد الإرسال؛ أعد الإرسال.");
  if (JSON.stringify(current.segment) !== JSON.stringify(job.segment)) out.push(`تغيّر مقطع الشورت ${job.n} بعد الإرسال.`);
  if ((current.shortTitle ?? null) !== (job.shortTitle ?? null)) out.push(`تغيّر عنوان الشورت ${job.n} بعد الإرسال.`);
  if (v.fileSha256 !== result.sha256) out.push("بصمة الفيديو لا تطابق result.json.");
  if (v.fileBytes !== result.bytes) out.push("حجم الفيديو لا يطابق result.json.");
  if (probe.videoCodec !== "h264") out.push(`ترميز الصورة ${probe.videoCodec ?? "مفقود"} لا h264.`);
  if (probe.width !== job.expected.width || probe.height !== job.expected.height) out.push(`الأبعاد ${probe.width}×${probe.height} لا ${job.expected.width}×${job.expected.height}.`);
  if (probe.audioCodec !== "aac") out.push(`الصوت ${probe.audioCodec ?? "مفقود"} لا AAC.`);
  if (!(Math.abs(probe.durationSec - job.expected.durationSec) <= DURATION_TOLERANCE_SEC))
    out.push(`المدة ${probe.durationSec.toFixed(3)} ث والمتوقَّع ${job.expected.durationSec.toFixed(3)} ث (السماح ±${DURATION_TOLERANCE_SEC}).`);
  const traces = probe.tags.flatMap((t) => findTraces(t).map((x) => `${x} (${t})`));
  if (traces.length) out.push(`أثر لأدوات الإنتاج في البيانات الوصفية: ${traces.join("، ")}`);
  return out;
};

export type CollectDeps = {
  sha256File: (file: string) => Promise<string>;
  probe: (file: string) => Promise<VideoProbe>;
  cleanMetadata: (file: string, meta: { title: string; artist: string }) => Promise<void>;
  measureMotion: (file: string, exempt: Set<number>) => Promise<MotionReport>;
};
export const defaultCollectDeps: CollectDeps = {
  sha256File, probe: probeVideo, cleanMetadata, measureMotion: (f, ex) => measureMotion(f, "portrait", ex),
};

export type CollectedRecord = { jobId: string; n: number; file: string; workerSha256: string; sha256: string; worker: string; commit: string; collectedAt: string; motion: number };

/** يتحقق من ناتج العامل وما بعده على الماك؛ يعيد أسباب الرفض أو الملف النهائي في out/package. */
export const importVerified = async (ctx: Pick<MacShortsContext, "dir" | "id" | "plan">, job: Pick<WorkerJob, "id" | "n">, source: string, deps: CollectDeps,
  o: { replace?: boolean; artist: string; exempt: Set<number>; /** D242: الشورت المقصوص من النسخة العمودية 1080×1920 */ size?: { width: number; height: number } }) => {
  const size = o.size ?? SHORT_SIZE;
  const final = path.join(ctx.dir, `${ctx.id}-short-${job.n}.mp4`);
  const temp = path.join(ctx.dir, `.worker-${job.id}.importing.mp4`);
  await rm(temp, { force: true });
  await copyFile(source, temp);
  try {
    // القاعدة الأولى: البيانات الوصفية تُنظَّف على الماك نفسه كما تُنظَّف شورتاته (cleanMetadata)، ثم تُفحص من جديد
    await deps.cleanMetadata(temp, { title: ctx.plan.title, artist: o.artist });
    const probe = await deps.probe(temp);
    const traces = probe.tags.flatMap((t) => findTraces(t));
    if (traces.length) return { refused: [`أثر لأدوات الإنتاج بعد التنظيف: ${traces.join("، ")}`] };
    if (probe.videoCodec !== "h264" || probe.width !== size.width || probe.height !== size.height || probe.audioCodec !== "aac")
      return { refused: ["تغيّر الملف بعد تنظيف البيانات الوصفية."] };
    const motion = await deps.measureMotion(temp, o.exempt);
    if (motion.percent < MOTION_MIN) return { refused: [`قاعدة القناة: الحركة ${motion.percent}% أقل من ${MOTION_MIN}%.`], motion };
    const sha = await deps.sha256File(temp);
    if (existsSync(final)) {
      if ((await deps.sha256File(final)) === sha) { await rm(temp, { force: true }); return { file: final, sha, motion }; }
      if (!o.replace) return { refused: [`يوجد ${path.basename(final)} آخر في الحزمة؛ لا يُكتب فوقه (أعد بـ --replace لنقله إلى superseded/).`], motion };
      const old = path.join(ctx.dir, "superseded");
      await mkdir(old, { recursive: true });
      await rename(final, path.join(old, `${path.basename(final, ".mp4")}.${Date.now()}.mp4`));
    }
    await rename(temp, final);
    return { file: final, sha, motion };
  } finally {
    await rm(temp, { force: true });
  }
};

export const collectWorkerShorts = async (ep: string, share: string, o: { replace?: boolean; log?: (m: string) => void; deps?: CollectDeps } = {}) => {
  const log = o.log ?? (() => {});
  const deps = o.deps ?? defaultCollectDeps;
  const ctx = await macShortsContext(ep);
  const q = queuePaths(share);
  const submitted = await readJson<Record<string, SubmittedRecord>>(submittedFile(ctx.dir), {});
  const collected = await readJson<Record<string, CollectedRecord>>(collectedFile(ctx.dir), {});
  const channel = loadChannel();
  const identity = loadChannelIdentity();
  const lang = ctx.plan.lang ?? channel.language;
  const imported: CollectedRecord[] = [];
  const refused: { id: string; reasons: string[] }[] = [];
  const motionLines: string[] = [];
  const dirs = existsSync(q.done) ? (await readdir(q.done)).filter((d) => !d.startsWith(".")).sort() : [];
  for (const d of dirs) {
    let job: WorkerJob;
    let raw: unknown;
    try { raw = JSON.parse(await readFile(path.join(q.done, d, "job.json"), "utf8")); } catch { raw = null; }
    // D232: مهام الإصدار 2 (المشاهد والتجميع وMaster والتجارب) لها استلامها؛ الشورتس هنا بالإصدار 1 وحده
    if ((raw as { version?: unknown } | null)?.version !== undefined && (raw as { version?: unknown }).version !== 1) continue;
    try { job = validateJob(raw); }
    catch (e) { if (d.startsWith(`${ctx.channel}-${ctx.episodeFolder.slice(0, 3)}-`)) refused.push({ id: d, reasons: [(e as Error).message] }); continue; }
    if (job.channel !== ctx.channel || job.episode !== ctx.episodeFolder || job.id !== d) continue;
    if (collected[job.id] && existsSync(collected[job.id]!.file)) continue;
    const source = path.join(q.done, d, doneVideoName(job));
    let result: WorkerResult;
    try { result = JSON.parse(await readFile(path.join(q.done, d, "result.json"), "utf8")) as WorkerResult; }
    catch { refused.push({ id: job.id, reasons: ["result.json مفقود أو تالف."] }); continue; }
    if (!existsSync(source)) { refused.push({ id: job.id, reasons: ["الفيديو مفقود."] }); continue; }
    const seg = ctx.segments.find((s) => s.n === job.n);
    const reasons = verifyWorkerOutput({
      job, result, record: submitted[job.id],
      current: { planSha256: ctx.planSha256, mediaBase: ctx.media.base, segment: seg ? segmentOf(seg) : null, shortTitle: seg ? (await shortTitleFor(ctx.scriptPath, seg)) ?? null : null },
      fileSha256: await deps.sha256File(source), fileBytes: (await stat(source)).size,
      probe: await deps.probe(source),
    });
    if (reasons.length || !seg) { refused.push({ id: job.id, reasons: reasons.length ? reasons : ["الشورت لم يعد في الخطة."] }); continue; }
    const sp = segmentPlan(ctx.plan, seg);
    const r = await importVerified(ctx, job, source, deps, { replace: o.replace, artist: channel.name, exempt: await exemptForRender(sp.plan, ctx.media, sp.chapter) });
    if (r.motion) motionLines.push(`- ${motionSummary(r.motion, `الشورت ${job.n} (عامل الرندر ${result.worker})`)}`);
    if ("refused" in r && r.refused) { refused.push({ id: job.id, reasons: r.refused }); continue; }
    // الترجمة بكود الماك نفسه (كما في package.ts)، ثم فحص الأثر عليها
    const srtName = `${ctx.id}-short-${job.n}.${lang}.srt`;
    const srt = buildSrt(ctx.plan, scenesOf(sp).map((x) => x.scene), ctx.media, identity);
    assertNoTraces([{ name: srtName, text: srt }]);
    await writeFile(path.join(ctx.dir, srtName), srt);
    const rec: CollectedRecord = { jobId: job.id, n: job.n, file: r.file!, workerSha256: result.sha256, sha256: r.sha!, worker: result.worker, commit: job.commit, collectedAt: new Date().toISOString(), motion: r.motion!.percent };
    collected[job.id] = rec;
    imported.push(rec);
    log(`الشورت ${job.n}: استُلم ${path.basename(rec.file)} (الحركة ${rec.motion}%).`);
  }
  if (motionLines.length) {
    const reportFile = path.join(ctx.dir, "motion-report.md");
    const prev = existsSync(reportFile) ? (await readFile(reportFile, "utf8")).trimEnd() : `# مقياس الحركة · ${ctx.plan.title}\n`;
    await writeFile(reportFile, `${prev}\n${motionLines.join("\n")}\n`);
  }
  await writeFile(collectedFile(ctx.dir), JSON.stringify(collected, null, 2) + "\n");
  return { imported, refused };
};
