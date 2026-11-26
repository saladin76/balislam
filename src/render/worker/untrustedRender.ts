/**
 * رندر العامل (D226) — ناتج غير موثوق، يتحقق منه الماك (`bal worker-collect`) قبل أي استعمال.
 *
 * العامل على ويندوز لا سجل اعتماد عنده ولا مفتاح توقيع ولا .env، فلا تُفحص هنا بوابات الماك (سجل «إنتاج المشاهد»،
 * التلاوات المعتمدة، الستوري بورد): فحصها الماك قبل أن يكتب المهمة (`bal worker-submit`) ويفحص ناتجها بعد عودته.
 * هذا الملف وحده (مع renderEpisode) يستدعي renderComposition، ولا يصل إليه إلا أمر `bal worker-render` المخفي
 * الذي يشغّله `bal worker`؛ والمخرج محصور في `out/worker/` للحلقة ثم `done/<id>/` في المجلد المشترك
 * (tests/render-worker-gates.test.ts).
 *
 * يرندر بالمسار نفسه والجودة نفسها التي يصنع بها الماك شورتاته (package.ts ← renderEpisode portrait master):
 * الخطة ووصف الوسائط وربح العلوّ كما حسبها الماك، ولقطة الوسائط الثابتة نفسها (تُفحص بصمتها قبل الرندر).
 */
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import { resolveScriptPath } from "../../script/episodes";
import { defaultRenderMediaRoot, verifyStagedMedia } from "../../plan/renderStage";
import { copyUnlinkedFile, ensureUnlinkedDirectory, assertEpisodeOutputConfined } from "../fsIsolation";
import { assertRenderChannelOwnership, assertRenderMediaOwnership, cleanMetadata, renderComposition, voiceTimingMode } from "../episode";
import { currentChannelId, loadChannel } from "../../channel";
import {
  completeJob, doneVideoName, inShare, isV2, queuePaths, runningJob, safeRelative, sha256File, tail, validateJobV2, workerName, writeProgress,
  type JoinSpec, type WorkerJob, type WorkerJobV2, type WorkerResult, type WorkerTimings,
} from "./protocol";
import { headCommit } from "./git";
import { assertOneMachine, machineOfResult } from "./provenance";
import { probeVideo } from "./probe";
import { projectRoot } from "../../config/paths";

const KINDS = ["voice", "sfx", "recitations", "images"] as const;

/** ينسخ لقطة الوسائط من المجلد المشترك إلى مخزن الرندر المحلي (renders/.private-media) ويتحقق من بصمتها. */
export const installSnapshot = async (share: string, job: { media: string; inputs: Pick<WorkerJob["inputs"], "media"> }, mediaRoot = defaultRenderMediaRoot()) => {
  const base = job.inputs.media.base;
  const target = path.join(mediaRoot, ...base.split("/").filter(Boolean));
  if (!existsSync(target)) {
    const source = inShare(share, job.media);
    const parent = path.dirname(target);
    await ensureUnlinkedDirectory(parent);
    const staging = path.join(parent, `.worker-${randomUUID()}`);
    try {
      await ensureUnlinkedDirectory(staging);
      await copyUnlinkedFile(path.join(source, ".ready.json"), path.join(staging, ".ready.json"));
      for (const kind of KINDS) {
        await ensureUnlinkedDirectory(path.join(staging, kind));
        const dir = path.join(source, kind);
        for (const name of existsSync(dir) ? await readdir(dir) : [])
          await copyUnlinkedFile(path.join(dir, name), path.join(staging, kind, name));
      }
      if (!existsSync(target)) await rename(staging, target);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }
  // البيان وكل ملف ببصمته (src/plan/renderStage.ts)؛ أي اختلاف يرفض الرندر
  await verifyStagedMedia(mediaRoot, base);
};

export const workerOutputFor = (scriptPath: string, id: string) => path.join(path.dirname(scriptPath), "out", "worker", `${id}.mp4`);

/** مهمة واحدة من running/: يرندرها ويكتب done/<id>/. يرمي خطأ بسببه عند أي فشل (ويكتب العامل failed/). */
export const renderWorkerJob = async (share: string, id: string, log: (line: string) => void = () => {}) => {
  const job = await runningJob(share, id);
  if (isV2(job)) {
    // D232: كل الأنواع الأخرى (المشهد والوصل وMaster والتجارب) أدناه
    return renderWorkerJobV2(share, job, log);
  }
  const startedAt = new Date().toISOString();
  const lines: string[] = [];
  const say = (m: string) => { lines.push(m); log(m); };
  if (currentChannelId() !== job.channel) throw new Error(`القناة النشطة ليست قناة المهمة (${job.channel}).`);
  const head = await headCommit(projectRoot);
  if (head !== job.commit) throw new Error(`الكود المحمَّل (${head.slice(0, 8)}) ليس commit المهمة (${job.commit.slice(0, 8)}).`);
  const scriptPath = await resolveScriptPath(job.episode.slice(0, 3));
  if (path.basename(path.dirname(scriptPath)) !== job.episode) throw new Error(`مجلد الحلقة في هذا الـcommit ليس ${job.episode}.`);
  assertRenderChannelOwnership(scriptPath, job.channel);
  const { plan, media, narrationGain } = job.inputs;
  assertRenderMediaOwnership(scriptPath, media);
  say("تجهيز لقطة الوسائط…");
  await installSnapshot(share, job);
  const output = workerOutputFor(scriptPath, job.id);
  await assertEpisodeOutputConfined(scriptPath, output);
  await rm(output, { force: true });
  let last = -1;
  const file = await renderComposition({
    plan, media, orientation: "portrait",
    ...("chapter" in job.segment ? { chapter: job.segment.chapter } : { segment: { sceneIds: job.segment.sceneIds } }),
    ...(job.shortTitle ? { shortTitle: job.shortTitle } : {}),
    quality: "master", timingMode: await voiceTimingMode(scriptPath, plan, media), narrationGain, output,
    onProgress: (pct, msg) => { const s = Math.floor(pct / 10) * 10; if (s !== last) { last = s; say(`${msg}: ${pct}%`); } },
  });
  try {
    const probe = await probeVideo(file);
    const result: WorkerResult = {
      id: job.id, sha256: await sha256File(file), bytes: (await stat(file)).size, durationSec: probe.durationSec,
      width: probe.width, height: probe.height, commit: head, worker: workerName(), startedAt, finishedAt: new Date().toISOString(),
      logTail: tail(lines.join("\n")),
    };
    say(`انتهى: ${result.durationSec.toFixed(2)} ث، ${result.width}×${result.height}`);
    return await completeJob(share, job, file, result);
  } finally {
    await rm(file, { force: true });
  }
};

/* ── D232: كل أنواع الرندر (الإصدار 2) ── */

const execFileP = promisify(execFile);

export const machineInfo = () => ({
  cpus: os.cpus().length, cpuModel: (os.cpus()[0]?.model ?? "").trim(), totalMB: Math.round(os.totalmem() / 1048576), platform: `${process.platform} ${os.release()}`,
});

/** قطعة الوصل: ناتج مهمة مشهد سابقة في done/<job>/، لهذه الحلقة وبهذا الغرض، وببصمتها. */
export const resolveJoinCut = async (share: string, job: WorkerJobV2, cut: JoinSpec["cuts"][number]) => {
  const dir = path.join(queuePaths(share).done, ...safeRelative(cut.job));
  if (!existsSync(dir)) throw new Error(`قطعة المشهد ${cut.sceneId} لم تُرندر بعد (لا done/${cut.job}).`);
  const src = validateJobV2(JSON.parse(await readFile(path.join(dir, "job.json"), "utf8")));
  if (src.kind !== "scene" || src.sceneId !== cut.sceneId || src.channel !== job.channel || src.episode !== job.episode || src.purpose !== job.purpose)
    throw new Error(`done/${cut.job} ليست قطعة المشهد ${cut.sceneId} لهذه الحلقة.`);
  const result = JSON.parse(await readFile(path.join(dir, "result.json"), "utf8")) as WorkerResult;
  const file = path.join(dir, doneVideoName(src));
  const sha = await sha256File(file);
  if (sha !== (cut.sha256 ?? result.sha256)) throw new Error(`بصمة قطعة المشهد ${cut.sceneId} لا تطابق.`);
  return { sceneId: cut.sceneId, file, sha256: sha, machine: machineOfResult(result), commit: result.commit };
};

/** نسخة مراجعة 1080p من ملف 4K (الماك يحتفظ بها وحدها؛ الكبير يبقى في المجلد المشترك). */
export const makeReviewCopy = async (file: string, out: string, meta: { title: string; artist: string }) => {
  await rm(out, { force: true });
  await execFileP("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", file,
    "-vf", "scale=1920:1080:flags=lanczos", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-c:a", "copy", "-map_metadata", "-1", "-movflags", "+faststart", out],
  { timeout: 4 * 3_600_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  await cleanMetadata(out, meta);
  return out;
};

/**
 * مهمة الإصدار 2: الفحص الكامل بكود هذا الـcommit، ثم الرندر (تكوين Remotion) أو الوصل (ffmpeg)، ثم done/<id>/.
 * يكتب التقدم (النسبة والمرحلة) في running/<id>.progress.json كل ٣ ثوانٍ على الأكثر وكل ١٠ ثوانٍ على الأقل،
 * ويسجّل في result.json أوقات المراحل وأدنى ذاكرة حرة ووصف الجهاز (للقياس، لا للتحقق).
 */
export const renderWorkerJobV2 = async (share: string, raw: WorkerJobV2, log: (line: string) => void = () => {}) => {
  const job = validateJobV2(raw);
  const startedAt = new Date().toISOString();
  const lines: string[] = [];
  const say = (m: string) => { lines.push(m); log(m); };
  const stages: WorkerTimings["stages"] = [];
  let pct = 0, stage = "", lastWrite = 0, bundledAt: string | undefined, renderedAt: string | undefined;
  const progress = (p: number, s: string, force = false) => {
    const changed = s !== stage;
    if (changed) stages.push({ stage: s, at: new Date().toISOString() });
    pct = p; stage = s;
    const now = Date.now();
    if (force || changed || now - lastWrite >= 3000) {
      lastWrite = now;
      void writeProgress(share, { id: job.id, percent: p, stage: s, at: new Date(now).toISOString(), startedAt });
    }
  };
  let minFree = os.freemem();
  const sampler = setInterval(() => { minFree = Math.min(minFree, os.freemem()); }, 5000);
  const ticker = setInterval(() => progress(pct, stage, true), 10_000);
  const cleanup: string[] = [];
  try {
    if (currentChannelId() !== job.channel) throw new Error(`القناة النشطة ليست قناة المهمة (${job.channel}).`);
    const head = await headCommit(projectRoot);
    if (head !== job.commit) throw new Error(`الكود المحمَّل (${head.slice(0, 8)}) ليس commit المهمة (${job.commit.slice(0, 8)}).`);
    const scriptPath = await resolveScriptPath(job.episode.slice(0, 3));
    if (path.basename(path.dirname(scriptPath)) !== job.episode) throw new Error(`مجلد الحلقة في هذا الـcommit ليس ${job.episode}.`);
    assertRenderChannelOwnership(scriptPath, job.channel);
    const { plan, media, narrationGain } = job.inputs;
    assertRenderMediaOwnership(scriptPath, media);
    progress(0, "تجهيز لقطة الوسائط");
    say("تجهيز لقطة الوسائط…");
    await installSnapshot(share, job);
    const output = workerOutputFor(scriptPath, job.id);
    await assertEpisodeOutputConfined(scriptPath, output);
    await rm(output, { force: true });
    cleanup.push(output);
    const meta = { title: plan.title, artist: loadChannel().name };
    const extra: { name: string; file: string }[] = [];
    let review: WorkerResult["review"];
    let file: string;
    if (job.render) {
      const r = job.render;
      const scope = r.scope;
      let last = -1;
      file = await renderComposition({
        plan, media, orientation: r.orientation,
        ...("chapter" in scope ? { chapter: scope.chapter } : {}),
        // قطعة المشهد: الخطة نفسها مقصوصة على مشهدها (cutPlans على الماك)؛ وغيرها مقطع من الخطة
        ...("sceneIds" in scope && job.kind !== "scene" ? { segment: { sceneIds: scope.sceneIds } } : {}),
        ...(r.shortTitle ? { shortTitle: r.shortTitle } : {}),
        ...(r.scenePreview ? { scenePreview: true } : {}),
        ...(r.draftMarks ? { draftMarks: r.draftMarks } : {}),
        ...(r.concurrency ? { concurrency: r.concurrency } : {}),
        quality: r.quality, timingMode: r.timingMode, narrationGain, output,
        onProgress: (p, msg) => {
          const st = msg.startsWith("رندر") ? "رندر" : msg.replace(/…$/, "");
          if (st === "رندر" && !bundledAt) bundledAt = new Date().toISOString();
          progress(p, st);
          const s10 = Math.floor(p / 10) * 10;
          if (s10 !== last || st !== "رندر") { last = s10; say(`${msg}: ${p}%`); }
        },
      });
      renderedAt = new Date().toISOString();
      if (r.review1080) {
        progress(100, "نسخة المراجعة 1080p");
        say("نسخة المراجعة 1080p…");
        const rv = await makeReviewCopy(file, file.replace(/\.mp4$/i, ".review1080.mp4"), meta);
        cleanup.push(rv);
        const p = await probeVideo(rv);
        const name = `${job.id}.review1080.mp4`;
        review = { file: name, sha256: await sha256File(rv), bytes: (await stat(rv)).size, width: p.width, height: p.height };
        extra.push({ name, file: rv });
      }
    } else {
      progress(0, "قطع المشاهد");
      const cuts = [];
      for (const c of job.join!.cuts) cuts.push(await resolveJoinCut(share, job, c));
      // D233: قطع الحلقة كلها من جهاز واحد، وهو هذا الجهاز (لا يُوصل هنا ما رُندر على جهاز آخر)
      const only = assertOneMachine(cuts, job.kind === "prefinal" ? "نسخة قبل النهائية" : "تجميع");
      if (only && only !== workerName()) throw new Error(`لا تجميع هنا: قطع الحلقة رُندرت على «${only}» لا على هذا الجهاز (${workerName()}) (D233). أعد رندر المشاهد على هذا الجهاز أو اجمعها على جهازها.`);
      say(`وصل ${cuts.length} قطعة…`);
      progress(10, "وصل المشاهد");
      const { joinSceneCuts } = await import("../../studio/assembleScenes");
      await mkdir(path.dirname(output), { recursive: true });
      const script = path.join(path.dirname(output), `.${job.id}.filter`);
      await rm(script, { force: true });
      await rm(`${script}.d`, { recursive: true, force: true });
      try {
        await joinSceneCuts(job.episode.slice(0, 3), cuts, output, script, { plan, media, loudness: { target: null, gain: narrationGain } });
      } finally {
        await rm(script, { force: true });
      }
      await cleanMetadata(output, meta);
      file = output;
      renderedAt = new Date().toISOString();
    }
    progress(100, "نسخ الناتج إلى المجلد المشترك");
    const probe = await probeVideo(file);
    const finishedAt = new Date().toISOString();
    const result: WorkerResult = {
      id: job.id, sha256: await sha256File(file), bytes: (await stat(file)).size, durationSec: probe.durationSec,
      width: probe.width, height: probe.height, commit: head, worker: workerName(), startedAt, finishedAt,
      logTail: tail(lines.join("\n")),
      timings: { ...(job.claimedAt ? { claimedAt: job.claimedAt } : {}), startedAt, ...(bundledAt ? { bundledAt } : {}), ...(renderedAt ? { renderedAt } : {}), finishedAt, stages },
      machine: machineInfo(), memory: { minFreeMB: Math.round(Math.min(minFree, os.freemem()) / 1048576) },
      ...(review ? { review } : {}),
    };
    say(`انتهى: ${result.durationSec.toFixed(2)} ث، ${result.width}×${result.height}`);
    return await completeJob(share, job, file, result, extra);
  } finally {
    clearInterval(sampler);
    clearInterval(ticker);
    for (const f of cleanup) await rm(f, { force: true });
  }
};
