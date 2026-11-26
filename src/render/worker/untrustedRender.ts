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
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, rename, rm, stat } from "node:fs/promises";
import { resolveScriptPath } from "../../script/episodes";
import { defaultRenderMediaRoot, verifyStagedMedia } from "../../plan/renderStage";
import { copyUnlinkedFile, ensureUnlinkedDirectory, assertEpisodeOutputConfined } from "../fsIsolation";
import { assertRenderChannelOwnership, assertRenderMediaOwnership, renderComposition, voiceTimingMode } from "../episode";
import { currentChannelId } from "../../channel";
import { completeJob, inShare, runningJob, sha256File, tail, workerName, type WorkerJob, type WorkerResult } from "./protocol";
import { headCommit } from "./git";
import { probeVideo } from "./probe";
import { projectRoot } from "../../config/paths";

const KINDS = ["voice", "sfx", "recitations", "images"] as const;

/** ينسخ لقطة الوسائط من المجلد المشترك إلى مخزن الرندر المحلي (renders/.private-media) ويتحقق من بصمتها. */
export const installSnapshot = async (share: string, job: Pick<WorkerJob, "media" | "inputs">, mediaRoot = defaultRenderMediaRoot()) => {
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
