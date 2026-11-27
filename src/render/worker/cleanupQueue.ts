/**
 * D240: تنظيف ويندوز بعد النشر — مهمة في الطابور، لأن الماك لا يصل إلى نسخة العامل المحلية.
 *
 * الماك (`bal cleanup <الحلقة> --delete`) بعد نجاح الشروط الثلاثة يكتب `render-queue/cleanup/<id>.json`. العامل يقرؤها
 * في دورته (قبل مهام الرندر)، ويتحقق بنفسه أن Master في مكانه الدائم بالمجلد المشترك وبصمته هي المكتوبة في المهمة،
 * ثم يحذف في نسخته المحلية الجذور المعروفة للحلقة وحدها (previews وout وكاش الوسائط) بالقواعد نفسها التي على الماك
 * (`postPublishCleanup.ts`): لا Git ولا .env ولا السجل ولا رابط رمزي ولا خروج من الجذر. ويكتب ما حرّره في
 * `render-queue/cleanup-done/<id>.json` أو السبب في `cleanup-failed/<id>.json`. لا يدفع العامل شيئًا ولا يعتمد شيئًا.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { QUEUE_DIR, WORKER_CHANNELS, inShare, sha256File, workerName, writeJsonAtomic, type WorkerChannel } from "./protocol";
import {
  deletionRoots, executeCleanup, gitTrackedUnder, pathEscape, permanentMasterRel, scanRoot, MASTERS_DIR, epNumOf, type CleanupPlan,
} from "../postPublishCleanup";

const ID = /^cleanup-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EPISODE = /^[0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256 = /^[a-f0-9]{64}$/;

export type CleanupJob = {
  version: 1; kind: "cleanup"; id: string; channel: WorkerChannel; episode: string;
  /** بصمة Master المعتمد كما تحقق منها الماك */
  masterSha256: string;
  /** المسار الدائم داخل المجلد المشترك: masters/<القناة>/<الحلقة>/<NNN>-episode.mp4 */
  master: string;
  createdAt: string;
};

const fail = (m: string): never => { throw new Error(`مهمة تنظيف غير صالحة: ${m}`); };
const KNOWN = ["version", "kind", "id", "channel", "episode", "masterSha256", "master", "createdAt"];

export const validateCleanupJob = (raw: unknown): CleanupJob => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fail("ليست كائن JSON.");
  const r = raw as Record<string, unknown>;
  for (const k of Object.keys(r)) if (!KNOWN.includes(k)) fail(`حقل غير معروف: ${k}`);
  if (r.version !== 1 || r.kind !== "cleanup") fail("النوع أو الإصدار.");
  if (typeof r.id !== "string" || !ID.test(r.id) || r.id.length > 120) fail("المعرّف.");
  if (!WORKER_CHANNELS.includes(r.channel as WorkerChannel)) fail("القناة.");
  if (typeof r.episode !== "string" || !EPISODE.test(r.episode)) fail("مجلد الحلقة.");
  if (typeof r.masterSha256 !== "string" || !SHA256.test(r.masterSha256)) fail("بصمة Master.");
  if (r.master !== permanentMasterRel(r.channel as string, r.episode as string)) fail("مسار Master ليس المكان الدائم للحلقة.");
  if (typeof r.createdAt !== "string" || Number.isNaN(Date.parse(r.createdAt))) fail("وقت الإنشاء.");
  return r as unknown as CleanupJob;
};

export const cleanupPaths = (share: string) => ({
  jobs: path.join(share, QUEUE_DIR, "cleanup"),
  done: path.join(share, QUEUE_DIR, "cleanup-done"),
  failed: path.join(share, QUEUE_DIR, "cleanup-failed"),
});

export const cleanupJobId = (channel: string, episodeFolder: string, sha: string) => `cleanup-${channel}-${epNumOf(episodeFolder)}-${sha.slice(0, 12)}`;

/** جانب الماك: يكتب المهمة (بعد نجاح الشروط كلها). */
export const queueWindowsCleanup = async (share: string, plan: CleanupPlan): Promise<string> => {
  if (!plan.ok || !plan.approvedSha256) throw new Error("لا مهمة تنظيف لويندوز قبل نجاح الشروط الثلاثة.");
  const job: CleanupJob = {
    version: 1, kind: "cleanup", id: cleanupJobId(plan.ctx.channel, plan.ctx.episodeFolder, plan.approvedSha256),
    channel: plan.ctx.channel as WorkerChannel, episode: plan.ctx.episodeFolder, masterSha256: plan.approvedSha256,
    master: permanentMasterRel(plan.ctx.channel, plan.ctx.episodeFolder), createdAt: new Date().toISOString(),
  };
  validateCleanupJob(job);
  const p = cleanupPaths(share);
  await mkdir(p.jobs, { recursive: true });
  await writeJsonAtomic(path.join(p.jobs, `${job.id}.json`), job);
  return job.id;
};

export type WorkerCleanupDeps = { sha256File: (f: string) => Promise<string>; gitTracked: (repo: string, dir: string) => Promise<Set<string>> };
const defaults: WorkerCleanupDeps = { sha256File, gitTracked: gitTrackedUnder };

/** مهمة واحدة على العامل: يعيد ما حُذف وما حُرّر. يرمي بالسبب ولا يحذف شيئًا إن لم يتحقق Master. */
export const runCleanupJob = async (share: string, repo: string, job: CleanupJob, deps: WorkerCleanupDeps = defaults) => {
  const master = inShare(share, job.master);
  const escape = await pathEscape(path.join(share, MASTERS_DIR), master).catch((e) => (e as Error).message);
  if (escape) throw new Error(`Master ليس في مكانه الدائم: ${escape}`);
  if ((await deps.sha256File(master)) !== job.masterSha256) throw new Error("بصمة Master في المكان الدائم لا تطابق المهمة؛ لا حذف.");
  const episodeDir = path.join(repo, "channels", job.channel, "episodes", job.episode);
  const ctx = { channel: job.channel, episodeFolder: job.episode, episodeDir, projectRoot: repo, share: null };
  const roots = deletionRoots(ctx, "windows");
  const tracked = await deps.gitTracked(repo, episodeDir);
  const plan: CleanupPlan = {
    ctx, epNum: epNumOf(job.episode), ok: true, delete: [], keep: [], refused: [], permanentMaster: master, approvedSha256: job.masterSha256, roots,
    conditions: [1, 2, 3].map((n) => ({ n: n as 1 | 2 | 3, ok: true, label: "تحقق منه الماك", detail: "" })),
  };
  for (const root of roots) {
    const r = await scanRoot(root, plan.epNum, tracked, new Set());
    plan.delete.push(...r.del); plan.refused.push(...r.refused);
  }
  const r = await executeCleanup(plan);
  return { freed: r.freed, deleted: r.deleted.length, skipped: [...plan.refused, ...r.skipped] };
};

/** دورة العامل: كل مهام التنظيف المنتظرة. الفاشلة تُنقل إلى cleanup-failed/ بسببها. */
export const runCleanupJobs = async (share: string, repo: string, log: (l: string) => void, deps: WorkerCleanupDeps = defaults) => {
  const p = cleanupPaths(share);
  if (!existsSync(p.jobs)) return 0;
  let n = 0;
  for (const f of (await readdir(p.jobs)).filter((x) => x.endsWith(".json") && !x.startsWith(".")).sort()) {
    const file = path.join(p.jobs, f);
    const id = f.slice(0, -5);
    try {
      const job = validateCleanupJob(JSON.parse(await readFile(file, "utf8")));
      if (job.id !== id) throw new Error("اسم الملف لا يطابق المعرّف.");
      const r = await runCleanupJob(share, repo, job, deps);
      await mkdir(p.done, { recursive: true });
      await writeJsonAtomic(path.join(p.done, `${id}.json`), { ...job, worker: workerName(), at: new Date().toISOString(), freedBytes: r.freed, deleted: r.deleted, skipped: r.skipped });
      log(`تنظيف ${job.channel} ${job.episode}: حُرّر ${r.freed} بايت (${r.deleted} ملف).`);
    } catch (e) {
      await mkdir(p.failed, { recursive: true });
      await writeJsonAtomic(path.join(p.failed, `${id}.${Date.now()}.json`), { id, error: (e as Error).message, worker: workerName(), at: new Date().toISOString() });
      log(`تنظيف ${id} فشل: ${(e as Error).message}`);
    }
    await rm(file, { force: true });
    n++;
  }
  return n;
};
