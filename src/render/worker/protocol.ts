/**
 * عامل الرندر على الجهاز الثاني (D226): بروتوكول المهام في المجلد المشترك.
 *
 * الماك وحده مصدر الحقيقة: يكتب المهمة في `render-queue/jobs/<id>.json`، ويأخذها العامل بنقل ذري إلى
 * `running/`، ويكتب الناتج في `done/<id>/` (الفيديو و`result.json` و`job.json`) أو السبب في `failed/<id>/`.
 * لا يُستورد شيء من `done/` إلا بعد أن يتحقق منه الماك (`bal worker-collect`). ناتج العامل «غير موثوق» حتى ذلك.
 *
 * كل مسار في المهمة نسبي بشرطات أمامية، ويُفحص بنمط صارم (لا `..` ولا مسار مطلق ولا شرطة خلفية)، ثم يُركَّب
 * بـ path.join على النظام الذي يعمل عليه (ويندوز أو ماك).
 *
 * D232 (كل الرندر على الويندوز): الإصدار 2 من المهمة يعمّم الأنواع: `scene` (مشهد صوت وصورة 1080p)، و`assembly`
 * و`prefinal` (وصل قطع المشاهد)، و`master` (الحلقة 4K)، و`short`، و`trial` (خطة معطاة، كدقيقة تجريبية)؛ و`thumbnail`
 * محجوز لم يُنفَّذ بعد. الإصدار 1 (الشورت وحده، D226) يبقى مقبولًا كما هو. الحلقة تقرأ من المهمة «الغلاف» فقط
 * (validateEnvelope) قبل checkout؛ والفحص الكامل في العملية الفرعية بكود commit المهمة نفسه، فلا يحتاج نوع جديد
 * إعادة تشغيل العامل. العامل يكتب تقدمه في `running/<id>.progress.json` ونبضه في `render-queue/worker.heartbeat.json`.
 */
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile, open } from "node:fs/promises";
import type { EpisodeMedia } from "../../plan/media";
import type { Plan } from "../../plan/types";

export const QUEUE_DIR = "render-queue";
export const WORKER_CHANNELS = ["balislam", "dafatir-alzaman", "zubdat-alkutub"] as const;
export type WorkerChannel = (typeof WORKER_CHANNELS)[number];
export const SHORT_SIZE = { width: 2160, height: 3840 } as const;
/** القفل أقدم من هذا متروك (عامل انقطع): يُستعاد. */
export const LOCK_STALE_MS = 6 * 60 * 60 * 1000;

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EPISODE = /^[0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const HASH24 = /^[a-f0-9]{24}$/;

export type WorkerJob = {
  version: 1;
  id: string;
  channel: WorkerChannel;
  /** مجلد الحلقة كما في المستودع: 001-slug */
  episode: string;
  kind: "short";
  n: number;
  segment: { sceneIds: string[] } | { chapter: number };
  shortTitle?: string;
  /** الـcommit الذي حسب منه الماك الخطة والمدة؛ العامل يرندر به حرفيًا */
  commit: string;
  quality: "master";
  /** لقطة الوسائط الثابتة في المجلد المشترك: render-queue/media/<القناة>/<الحلقة>/<البصمة> */
  media: string;
  expected: { durationSec: number; width: 2160; height: 3840 };
  /** مدخلات الرندر كما حسبها الماك: الخطة كاملة (ببصمتها) ووصف الوسائط وربح علوّ التعليق */
  inputs: { planSha256: string; plan: Plan; media: EpisodeMedia; narrationGain: Record<string, number> };
  createdAt: string;
  claimedBy?: string;
  claimedAt?: string;
};

export type WorkerResult = {
  id: string; sha256: string; bytes: number; durationSec: number; width: number; height: number;
  commit: string; worker: string; startedAt: string; finishedAt: string; logTail: string;
  /** D232: أوقات المراحل (ISO) ووصف الجهاز وأدنى ذاكرة حرة أثناء الرندر؛ لا تُستعمل في التحقق، للقياس فقط */
  timings?: WorkerTimings;
  machine?: { cpus: number; cpuModel: string; totalMB: number; platform: string };
  memory?: { minFreeMB: number };
  /** نسخة مراجعة 1080p (لـMaster 4K) بجوار الملف: الماك يحتفظ بها، والكبير يبقى في المجلد المشترك */
  review?: { file: string; sha256: string; bytes: number; width: number; height: number };
};
export type WorkerTimings = { claimedAt?: string; startedAt: string; bundledAt?: string; renderedAt?: string; finishedAt: string; stages: { stage: string; at: string }[] };

export class JobError extends Error {}
const fail = (m: string): never => { throw new JobError(`مهمة رندر غير صالحة: ${m}`); };

/** بصمة الخطة: JSON كما هو (الماك والعامل يقرآن الكائن نفسه من المهمة). */
export const planSha256 = (plan: unknown) => createHash("sha256").update(JSON.stringify(plan)).digest("hex");

export const mediaRelFor = (channel: string, episode: string, hash: string) => `${QUEUE_DIR}/media/${channel}/${episode}/${hash}`;
/** بصمة اللقطة من مسارها المحلي: _render/<القناة>/<الحلقة>/<البصمة>/ */
export const snapshotHashOf = (base: string) => {
  const m = /^_render\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*)\/([a-f0-9]{24})\/$/.exec(base);
  return m ? { channel: m[1]!, episode: m[2]!, hash: m[3]! } : null;
};

/** مسار نسبي آمن داخل المجلد المشترك: أجزاء بشرطات أمامية، لا `..` ولا `.` ولا جذر ولا شرطة خلفية ولا حرف قرص. */
export const safeRelative = (rel: unknown): string[] => {
  if (typeof rel !== "string" || !rel || rel.length > 400) return fail("مسار فارغ أو طويل.");
  if (rel.includes("\\") || rel.includes("\0") || rel.startsWith("/") || /^[A-Za-z]:/.test(rel) || path.isAbsolute(rel) || path.win32.isAbsolute(rel))
    return fail(`مسار مطلق أو بشرطة خلفية: ${rel}`);
  const parts = rel.split("/");
  if (parts.some((p) => !p || p === "." || p === ".." || !/^[A-Za-z0-9._-]+$/.test(p))) return fail(`مسار غير آمن: ${rel}`);
  return parts;
};
export const inShare = (share: string, rel: string) => path.join(share, ...safeRelative(rel));

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const KNOWN = new Set(["version", "id", "channel", "episode", "kind", "n", "segment", "shortTitle", "commit", "quality", "media", "expected", "inputs", "createdAt", "claimedBy", "claimedAt"]);

/** يفحص المهمة فحصًا صارمًا ويعيدها؛ أي حقل مجهول أو نوع غير «short» أو مسار غير آمن يُرفض. */
export const validateJob = (raw: unknown): WorkerJob => {
  if (!isObj(raw)) return fail("ليست كائن JSON.");
  for (const k of Object.keys(raw)) if (!KNOWN.has(k)) fail(`حقل غير معروف: ${k}`);
  if (raw.version !== 1) fail("الإصدار غير مدعوم.");
  if (typeof raw.id !== "string" || !ID.test(raw.id) || raw.id.length > 120) fail("المعرّف غير صالح.");
  if (!WORKER_CHANNELS.includes(raw.channel as WorkerChannel)) fail(`قناة غير معروفة: ${String(raw.channel)}`);
  if (typeof raw.episode !== "string" || !EPISODE.test(raw.episode)) fail("مجلد الحلقة غير صالح.");
  if (raw.kind !== "short") fail(`نوع غير مدعوم: ${String(raw.kind)}`);
  if (!Number.isInteger(raw.n) || (raw.n as number) < 1 || (raw.n as number) > 999) fail("رقم الشورت غير صالح.");
  const seg = raw.segment;
  if (!isObj(seg)) fail("المقطع مفقود.");
  const segKeys = Object.keys(seg as object).sort().join(",");
  if (segKeys === "sceneIds") {
    const ids = (seg as { sceneIds: unknown }).sceneIds;
    if (!Array.isArray(ids) || !ids.length || ids.some((x) => typeof x !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(x))) fail("مشاهد المقطع غير صالحة.");
  } else if (segKeys === "chapter") {
    const c = (seg as { chapter: unknown }).chapter;
    if (!Number.isInteger(c) || (c as number) < 1) fail("رقم القسم غير صالح.");
  } else fail("المقطع: sceneIds أو chapter فقط.");
  if (raw.shortTitle !== undefined && (typeof raw.shortTitle !== "string" || raw.shortTitle.length > 200)) fail("عنوان الشورت غير صالح.");
  if (typeof raw.commit !== "string" || !SHA1.test(raw.commit)) fail("الـcommit يجب أن يكون بصمة كاملة (40 حرفًا).");
  if (raw.quality !== "master") fail("الجودة master وحدها.");
  const parts = safeRelative(raw.media);
  if (parts.length !== 5 || parts[0] !== QUEUE_DIR || parts[1] !== "media" || parts[2] !== raw.channel || parts[3] !== raw.episode || !HASH24.test(parts[4]!))
    fail("مسار لقطة الوسائط لا يطابق render-queue/media/<القناة>/<الحلقة>/<البصمة>.");
  const ex = raw.expected;
  if (!isObj(ex) || Object.keys(ex).sort().join(",") !== "durationSec,height,width") fail("المتوقَّع غير صالح.");
  const e = ex as { durationSec: unknown; width: unknown; height: unknown };
  if (typeof e.durationSec !== "number" || !Number.isFinite(e.durationSec) || e.durationSec <= 0 || e.durationSec > 3600) fail("المدة المتوقعة غير صالحة.");
  if (e.width !== SHORT_SIZE.width || e.height !== SHORT_SIZE.height) fail("أبعاد الشورت 2160×3840 وحدها.");
  const inp = raw.inputs;
  if (!isObj(inp) || Object.keys(inp).sort().join(",") !== "media,narrationGain,plan,planSha256") fail("مدخلات الرندر ناقصة.");
  const i = inp as WorkerJob["inputs"];
  if (typeof i.planSha256 !== "string" || !SHA256.test(i.planSha256) || planSha256(i.plan) !== i.planSha256) fail("بصمة الخطة لا تطابق الخطة.");
  if (!isObj(i.plan) || !Array.isArray((i.plan as Plan).chapters)) fail("الخطة غير صالحة.");
  if (!isObj(i.media) || i.media.mode !== "static" || typeof i.media.base !== "string") fail("وصف الوسائط غير صالح.");
  const snap = snapshotHashOf(i.media.base);
  if (!snap || snap.channel !== raw.channel || snap.episode !== raw.episode || snap.hash !== parts[4]) fail("وصف الوسائط لا يطابق لقطتها.");
  if (!isObj(i.narrationGain) || Object.values(i.narrationGain).some((g) => typeof g !== "number" || !Number.isFinite(g) || g <= 0 || g > 4)) fail("ربح العلوّ غير صالح.");
  if (typeof raw.createdAt !== "string" || Number.isNaN(Date.parse(raw.createdAt))) fail("وقت الإنشاء غير صالح.");
  for (const k of ["claimedBy", "claimedAt"] as const) if (raw[k] !== undefined && typeof raw[k] !== "string") fail(`${k} غير صالح.`);
  return raw as unknown as WorkerJob;
};

export const queuePaths = (share: string) => {
  const q = path.join(share, QUEUE_DIR);
  return {
    root: q,
    jobs: path.join(q, "jobs"),
    running: path.join(q, "running"),
    done: path.join(q, "done"),
    failed: path.join(q, "failed"),
    media: path.join(q, "media"),
    lock: path.join(q, "worker.lock"),
  };
};
export const ensureQueue = async (share: string) => {
  const p = queuePaths(share);
  for (const d of [p.jobs, p.running, p.done, p.failed, p.media]) await mkdir(d, { recursive: true });
  return p;
};

const jobFile = (dir: string, id: string) => {
  if (!ID.test(id)) fail("المعرّف غير صالح.");
  return path.join(dir, `${id}.json`);
};

/** المهام المنتظرة، الأقدم أولًا (وقت الإنشاء ثم الاسم). الملف التالف لا يوقف الطابور: يُتجاوز. */
export const pendingJobs = async (share: string): Promise<JobEnvelope[]> => {
  const p = queuePaths(share);
  if (!existsSync(p.jobs)) return [];
  const out: JobEnvelope[] = [];
  for (const f of (await readdir(p.jobs)).filter((x) => x.endsWith(".json") && !x.startsWith(".")).sort()) {
    try { out.push(validateEnvelope(JSON.parse(await readFile(path.join(p.jobs, f), "utf8")))); } catch { /* يظهر في المهمة نفسها حين تُؤخذ */ }
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
};

/** يكتب ملفًا كاملًا ثم ينقله ذريًا (لا يرى القارئ نصف ملف). */
export const writeJsonAtomic = async (file: string, value: unknown) => {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  await rename(tmp, file);
};

/**
 * يأخذ المهمة بنقل ذري من jobs/ إلى running/: عاملان على المهمة نفسها ينجح أحدهما فقط (الآخر ENOENT ← null).
 * ثم يكتب من أخذها ومتى.
 */
export const claimJob = async (share: string, id: string, worker: string, now = new Date()): Promise<JobEnvelope | null> => {
  const p = await ensureQueue(share);
  const from = jobFile(p.jobs, id);
  const to = jobFile(p.running, id);
  if (existsSync(to)) return null;
  try {
    await rename(from, to);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EPERM" || code === "EBUSY" || code === "EEXIST") return null;
    throw e;
  }
  let job: JobEnvelope;
  try {
    job = validateEnvelope(JSON.parse(await readFile(to, "utf8")));
  } catch (e) {
    await failJob(share, id, (e as Error).message, "");
    return null;
  }
  const claimed = { ...job, claimedBy: worker, claimedAt: now.toISOString() };
  await writeJsonAtomic(to, claimed);
  return claimed;
};

export const runningJob = async (share: string, id: string): Promise<AnyJob> =>
  validateAnyJob(JSON.parse(await readFile(jobFile(queuePaths(share).running, id), "utf8")));

/** الفشل: failed/<id>/ فيه error.json وملف المهمة (إن وُجد). لا يُحذف أي شيء آخر. */
export const failJob = async (share: string, id: string, error: string, logTail: string) => {
  const p = await ensureQueue(share);
  const dir = path.join(p.failed, id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "error.json"), JSON.stringify({ id, error, logTail: tail(logTail), at: new Date().toISOString(), worker: workerName() }, null, 2) + "\n");
  for (const src of [jobFile(p.running, id), jobFile(p.jobs, id)])
    if (existsSync(src)) { await rename(src, path.join(dir, "job.json")); break; }
  await rm(progressFile(share, id), { force: true });
};

/** النجاح: يُبنى done/.<id>.partial ثم يُنقل كاملًا إلى done/<id>/ (الماك لا يرى نتيجة ناقصة). */
export const completeJob = async (share: string, job: Pick<WorkerJob, "id">, mp4: string, result: WorkerResult, extra: { name: string; file: string }[] = []) => {
  const p = await ensureQueue(share);
  const partial = path.join(p.done, `.${job.id}.partial`);
  const dir = path.join(p.done, job.id);
  if (existsSync(dir)) fail(`نتيجة سابقة موجودة: ${job.id}`);
  await rm(partial, { recursive: true, force: true });
  await mkdir(partial, { recursive: true });
  await copyFile(mp4, path.join(partial, doneVideoName(job)));
  // البصمة من النسخة في المجلد المشترك نفسها (لا من الملف المحلي)
  const copied = await sha256File(path.join(partial, doneVideoName(job)));
  if (copied !== result.sha256) fail("تغيّرت الفيديو أثناء النسخ إلى المجلد المشترك.");
  for (const x of extra) {
    if (!/^[A-Za-z0-9._-]+$/.test(x.name) || x.name === doneVideoName(job)) fail(`اسم ملف إضافي غير آمن: ${x.name}`);
    await copyFile(x.file, path.join(partial, x.name));
  }
  await writeFile(path.join(partial, "result.json"), JSON.stringify(result, null, 2) + "\n");
  await rename(jobFile(p.running, job.id), path.join(partial, "job.json"));
  await rename(partial, dir);
  await rm(progressFile(share, job.id), { force: true });
  return dir;
};
export const doneVideoName = (job: Pick<WorkerJob, "id">) => `${job.id}.mp4`;
/** D232 (phase 2): the joins of a join job's file (assembly/pre-final), beside it in done/<id>/ */
export const seamsName = (job: Pick<WorkerJob, "id">) => `${job.id}.seams.json`;

export const sha256File = (file: string) => new Promise<string>((resolve, reject) => {
  const h = createHash("sha256");
  createReadStream(file).on("data", (d) => h.update(d)).on("error", reject).on("end", () => resolve(h.digest("hex")));
});

export const tail = (text: string, lines = 60) => text.split(/\r?\n/).slice(-lines).join("\n").slice(-8000);
export const workerName = () => `${os.hostname()}`;

/* ── القفل: رندر واحد في كل وقت ── */
export type LockInfo = { host: string; pid: number; at: string };
const pidAlive = (pid: number) => { try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === "EPERM"; } };

/**
 * يأخذ `render-queue/worker.lock` (إنشاء حصري). القفل متروك إن كان أقدم من ٦ ساعات، أو لهذا الجهاز وعمليته
 * لم تعد حية؛ فيُستعاد. يعيد دالة الإفلات، أو null إن كان عامل آخر يعمل.
 */
export const acquireLock = async (share: string, now = () => Date.now(), host = workerName(), pid = process.pid): Promise<(() => Promise<void>) | null> => {
  const p = await ensureQueue(share);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const h = await open(p.lock, "wx");
      await h.writeFile(JSON.stringify({ host, pid, at: new Date(now()).toISOString() } satisfies LockInfo) + "\n");
      await h.close();
      return async () => {
        try {
          const cur = JSON.parse(await readFile(p.lock, "utf8")) as LockInfo;
          if (cur.host === host && cur.pid === pid) await rm(p.lock, { force: true });
        } catch { /* لا قفل */ }
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      let info: LockInfo | null = null;
      try { info = JSON.parse(await readFile(p.lock, "utf8")) as LockInfo; } catch { info = null; }
      const age = info ? now() - Date.parse(info.at) : Infinity;
      const stale = !info || !Number.isFinite(age) || age > LOCK_STALE_MS || (info.host === host && info.pid !== pid && !pidAlive(info.pid));
      if (!stale) return null;
      await rm(p.lock, { force: true });
    }
  }
  return null;
};

/* ── D232: الإصدار 2 — كل أنواع الرندر ── */

export const JOB_KINDS = ["scene", "assembly", "prefinal", "master", "short", "thumbnail", "trial"] as const;
export type JobKind = (typeof JOB_KINDS)[number];
/** أنواع ترندر تكوين Remotion، وأنواع تصل قطع المشاهد (ffmpeg) */
export const RENDER_KINDS: readonly JobKind[] = ["scene", "master", "short", "trial"];
export const JOIN_KINDS: readonly JobKind[] = ["assembly", "prefinal"];
/** studio: ناتجه يُستورد بعد التحقق؛ trial: تجربة لا تدخل الحزمة ولا السجل أبدًا (تبقى في المجلد المشترك ومجلد مؤقت على الماك) */
export type JobPurpose = "studio" | "trial";

export type RenderSpec = {
  orientation: "landscape" | "portrait";
  quality: "preview" | "master";
  /** المشاهد المعروضة: كل الخطة، أو فصل، أو مقطع (sceneIds) */
  scope: { all: true } | { chapter: number } | { sceneIds: string[] };
  /** قطعة مراجعة مشهد (بلا ضبط علوّ ولا Master) */
  scenePreview: boolean;
  timingMode: "estimated" | "approved" | "scene-preview";
  shortTitle?: string;
  draftMarks?: { pendingRecitation: string[] };
  /** تبويبات المتصفح؛ في التجارب وحدها (للقياس)، والإنتاج يتبع config.json */
  concurrency?: number;
  /** يصنع العامل أيضًا نسخة مراجعة 1080p بجوار ملف 4K (الماك يحتفظ بها وحدها) */
  review1080?: boolean;
  /**
   * تجارب التسريع (D232، كل خيار وحده ليُقاس وحده؛ للتجارب وحدها، والإنتاج يتبع config.json):
   * - x264Preset: إعداد x264 لـMaster 4K بالـcrf نفسه (الإنتاج «slow»).
   * - bundleCache: حزمة Remotion واحدة للحلقة يعيد العامل استعمالها لكل مشاهدها (المفتاح: الـcommit ولقطة الوسائط).
   * - chunkFrames: Master على قطع بهذا العدد من الإطارات تُحفظ على العامل، ثم وصل بلا إعادة ترميز؛ الانقطاع يستأنف.
   */
  x264Preset?: TrialX264Preset;
  bundleCache?: boolean;
  chunkFrames?: number;
};
export const TRIAL_X264_PRESETS = ["medium", "slow"] as const;
export type TrialX264Preset = (typeof TRIAL_X264_PRESETS)[number];
/** حدود قطع Master: دقيقة إلى ٣٠ دقيقة بـ30 إطارًا في الثانية */
export const CHUNK_FRAMES_MIN = 300;
export const CHUNK_FRAMES_MAX = 54_000;
/** قطع المشاهد للوصل: كل قطعة ناتج مهمة مشهد في done/<job>/ ببصمتها (من result.json إن لم يحددها الماك) */
export type JoinSpec = { cuts: { sceneId: string; job: string; sha256?: string }[] };

export type WorkerJobV2 = {
  version: 2;
  id: string;
  channel: WorkerChannel;
  episode: string;
  kind: JobKind;
  purpose: JobPurpose;
  /** وسم التجربة: trial وحدها */
  trial?: string;
  /** رقم الشورت (short وحده) */
  n?: number;
  /** معرّف المشهد (scene وحده) */
  sceneId?: string;
  commit: string;
  media: string;
  render?: RenderSpec;
  join?: JoinSpec;
  expected: { durationSec: number; width: number; height: number };
  inputs: { planSha256: string; plan: Plan; media: EpisodeMedia; narrationGain: Record<string, number> };
  createdAt: string;
  claimedBy?: string;
  claimedAt?: string;
};
export type AnyJob = WorkerJob | WorkerJobV2;
/** ما تقرؤه الحلقة قبل checkout: يكفي لأخذ المهمة وجلب commitها */
export type JobEnvelope = { version: number; id: string; channel: WorkerChannel; episode: string; kind: string; commit: string; createdAt: string; claimedBy?: string; claimedAt?: string };

/** الأبعاد المتوقعة من الجودة والاتجاه (config.json: 1920×1080 × المقياس) */
export const sizeFor = (quality: RenderSpec["quality"], orientation: RenderSpec["orientation"]) => {
  const k = quality === "master" ? 2 : 1;
  return orientation === "landscape" ? { width: 1920 * k, height: 1080 * k } : { width: 1080 * k, height: 1920 * k };
};

const KNOWN2 = new Set(["version", "id", "channel", "episode", "kind", "purpose", "trial", "n", "sceneId", "commit", "media", "render", "join", "expected", "inputs", "createdAt", "claimedBy", "claimedAt"]);
const SCENE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const exactKeys = (o: unknown, allowed: string[], required: string[], what: string): Record<string, unknown> => {
  if (!isObj(o)) return fail(`${what} مفقود.`);
  for (const k of Object.keys(o)) if (!allowed.includes(k)) fail(`${what}: حقل غير معروف ${k}`);
  for (const k of required) if (!(k in o)) fail(`${what}: ${k} مفقود.`);
  return o;
};

/** الغلاف: الإصدار 1 يُفحص كاملًا كما كان؛ والإصدار 2 فأعلى بالحقول التي تحتاجها الحلقة وحدها. */
export const validateEnvelope = (raw: unknown): JobEnvelope => {
  if (!isObj(raw)) return fail("ليست كائن JSON.");
  if (raw.version === 1) return validateJob(raw) as unknown as JobEnvelope;
  if (!Number.isInteger(raw.version) || (raw.version as number) < 2 || (raw.version as number) > 9) fail("الإصدار غير مدعوم.");
  if (typeof raw.id !== "string" || !ID.test(raw.id) || raw.id.length > 120) fail("المعرّف غير صالح.");
  if (!WORKER_CHANNELS.includes(raw.channel as WorkerChannel)) fail(`قناة غير معروفة: ${String(raw.channel)}`);
  if (typeof raw.episode !== "string" || !EPISODE.test(raw.episode)) fail("مجلد الحلقة غير صالح.");
  if (typeof raw.kind !== "string" || !ID.test(raw.kind)) fail("النوع غير صالح.");
  if (typeof raw.commit !== "string" || !SHA1.test(raw.commit)) fail("الـcommit يجب أن يكون بصمة كاملة (40 حرفًا).");
  if (typeof raw.createdAt !== "string" || Number.isNaN(Date.parse(raw.createdAt))) fail("وقت الإنشاء غير صالح.");
  return raw as unknown as JobEnvelope;
};

/** الفحص الكامل لمهمة الإصدار 2 (في العملية الفرعية بكود commit المهمة، وعلى الماك قبل الكتابة وبعد العودة). */
export const validateJobV2 = (raw: unknown): WorkerJobV2 => {
  validateEnvelope(raw);
  const r = raw as Record<string, unknown>;
  for (const k of Object.keys(r)) if (!KNOWN2.has(k)) fail(`حقل غير معروف: ${k}`);
  if (r.version !== 2) fail("الإصدار غير مدعوم.");
  if (!JOB_KINDS.includes(r.kind as JobKind)) fail(`نوع غير مدعوم: ${String(r.kind)}`);
  const kind = r.kind as JobKind;
  if (kind === "thumbnail") fail("الأغلفة على العامل لم تُنفَّذ بعد (D232، المرحلة التالية).");
  if (r.purpose !== "studio" && r.purpose !== "trial") fail("الغرض studio أو trial فقط.");
  if (kind === "trial" && r.purpose !== "trial") fail("نوع trial غرضه trial.");
  if (r.purpose === "trial") {
    if (typeof r.trial !== "string" || !ID.test(r.trial) || r.trial.length > 60) fail("وسم التجربة غير صالح.");
    if (!String(r.id).startsWith("trial-")) fail("معرّف مهمة التجربة يبدأ بـtrial-.");
  } else if (r.trial !== undefined || String(r.id).startsWith("trial-")) fail("وسم التجربة ومعرّفها للتجارب وحدها.");
  if (kind === "short") { if (!Number.isInteger(r.n) || (r.n as number) < 1 || (r.n as number) > 999) fail("رقم الشورت غير صالح."); }
  else if (r.n !== undefined) fail("رقم الشورت للشورت وحده.");
  if (kind === "scene") { if (typeof r.sceneId !== "string" || !SCENE_ID.test(r.sceneId)) fail("معرّف المشهد غير صالح."); }
  else if (r.sceneId !== undefined) fail("معرّف المشهد لمهمة المشهد وحدها.");
  const parts = safeRelative(r.media);
  if (parts.length !== 5 || parts[0] !== QUEUE_DIR || parts[1] !== "media" || parts[2] !== r.channel || parts[3] !== r.episode || !HASH24.test(parts[4]!))
    fail("مسار لقطة الوسائط لا يطابق render-queue/media/<القناة>/<الحلقة>/<البصمة>.");
  const ex = exactKeys(r.expected, ["durationSec", "width", "height"], ["durationSec", "width", "height"], "المتوقَّع");
  if (typeof ex.durationSec !== "number" || !Number.isFinite(ex.durationSec) || ex.durationSec <= 0 || ex.durationSec > 4 * 3600) fail("المدة المتوقعة غير صالحة.");
  if (RENDER_KINDS.includes(kind)) {
    if (r.join !== undefined) fail("الوصل لأنواع الوصل وحدها.");
    const s = exactKeys(r.render, ["orientation", "quality", "scope", "scenePreview", "timingMode", "shortTitle", "draftMarks", "concurrency", "review1080", "x264Preset", "bundleCache", "chunkFrames"],
      ["orientation", "quality", "scope", "scenePreview", "timingMode"], "مواصفات الرندر");
    if (s.orientation !== "landscape" && s.orientation !== "portrait") fail("الاتجاه غير صالح.");
    if (s.quality !== "preview" && s.quality !== "master") fail("الجودة غير صالحة.");
    if (typeof s.scenePreview !== "boolean") fail("scenePreview غير صالح.");
    if (!["estimated", "approved", "scene-preview"].includes(s.timingMode as string)) fail("وضع التوقيت غير صالح.");
    const scope = s.scope;
    const sk = isObj(scope) ? Object.keys(scope).sort().join(",") : "";
    if (sk === "all") { if ((scope as { all: unknown }).all !== true) fail("النطاق غير صالح."); }
    else if (sk === "chapter") { const c = (scope as { chapter: unknown }).chapter; if (!Number.isInteger(c) || (c as number) < 1) fail("رقم القسم غير صالح."); }
    else if (sk === "sceneIds") { const ids = (scope as { sceneIds: unknown }).sceneIds; if (!Array.isArray(ids) || !ids.length || ids.some((x) => typeof x !== "string" || !SCENE_ID.test(x))) fail("مشاهد النطاق غير صالحة."); }
    else fail("النطاق: all أو chapter أو sceneIds فقط.");
    if (s.shortTitle !== undefined && (typeof s.shortTitle !== "string" || s.shortTitle.length > 200 || s.orientation !== "portrait")) fail("عنوان الشورت غير صالح.");
    if (s.draftMarks !== undefined) {
      const d = exactKeys(s.draftMarks, ["pendingRecitation"], ["pendingRecitation"], "علامات المسودة") as { pendingRecitation: unknown };
      if (!s.scenePreview || s.quality === "master" || !Array.isArray(d.pendingRecitation) || d.pendingRecitation.some((x) => typeof x !== "string" || !SCENE_ID.test(x))) fail("علامات المسودة لقطعة مراجعة مشهد وحدها.");
    }
    if (s.concurrency !== undefined && (r.purpose !== "trial" || !Number.isInteger(s.concurrency) || (s.concurrency as number) < 1 || (s.concurrency as number) > 8)) fail("التبويبات للتجارب وحدها (1…8).");
    if (s.review1080 !== undefined && (typeof s.review1080 !== "boolean" || s.quality !== "master")) fail("نسخة المراجعة 1080p لملف 4K وحده.");
    if (s.x264Preset !== undefined && (r.purpose !== "trial" || kind !== "master" || !TRIAL_X264_PRESETS.includes(s.x264Preset as TrialX264Preset)))
      fail("إعداد x264 لـMaster التجارب وحده (medium أو slow).");
    if (s.bundleCache !== undefined && (r.purpose !== "trial" || s.bundleCache !== true)) fail("إعادة استعمال الحزمة للتجارب وحدها.");
    if (s.chunkFrames !== undefined && (r.purpose !== "trial" || kind !== "master" || !Number.isInteger(s.chunkFrames)
      || (s.chunkFrames as number) < CHUNK_FRAMES_MIN || (s.chunkFrames as number) > CHUNK_FRAMES_MAX))
      fail(`قطع Master لـMaster التجارب وحده (${CHUNK_FRAMES_MIN}…${CHUNK_FRAMES_MAX} إطارًا).`);
    if (s.scenePreview && (s.quality !== "preview" || kind === "master" || kind === "short")) fail("قطعة مراجعة المشهد بجودة المعاينة وحدها، ولا تكون Master ولا شورت.");
    if (kind === "scene" && (!s.scenePreview || s.orientation !== "landscape" || sk !== "sceneIds" || (scope as { sceneIds: string[] }).sceneIds.join() !== r.sceneId)) fail("مهمة المشهد: قطعة مراجعة أفقية لمشهدها وحده.");
    if (kind === "master" && (s.quality !== "master" || s.orientation !== "landscape" || sk !== "all" || s.scenePreview)) fail("Master: الحلقة كاملة أفقية بأعلى جودة.");
    if (kind === "short" && (s.quality !== "master" || s.orientation !== "portrait" || sk === "all")) fail("الشورت: مقطع عمودي بأعلى جودة.");
    const size = sizeFor(s.quality as RenderSpec["quality"], s.orientation as RenderSpec["orientation"]);
    if (ex.width !== size.width || ex.height !== size.height) fail(`الأبعاد المتوقعة ${size.width}×${size.height} لهذه الجودة.`);
  } else {
    if (r.render !== undefined) fail("مواصفات الرندر لأنواع الرندر وحدها.");
    const j = exactKeys(r.join, ["cuts"], ["cuts"], "الوصل") as { cuts: unknown };
    if (!Array.isArray(j.cuts) || !j.cuts.length || j.cuts.length > 400) fail("قطع الوصل غير صالحة.");
    for (const c of j.cuts as unknown[]) {
      const x = exactKeys(c, ["sceneId", "job", "sha256"], ["sceneId", "job"], "قطعة");
      if (typeof x.sceneId !== "string" || !SCENE_ID.test(x.sceneId)) fail("معرّف مشهد القطعة غير صالح.");
      if (typeof x.job !== "string" || !ID.test(x.job) || x.job.length > 120) fail("مهمة القطعة غير صالحة.");
      if (x.sha256 !== undefined && (typeof x.sha256 !== "string" || !SHA256.test(x.sha256))) fail("بصمة القطعة غير صالحة.");
    }
    if (ex.width !== 1920 || ex.height !== 1080) fail("الوصل بجودة المعاينة 1920×1080.");
  }
  const i = exactKeys(r.inputs, ["planSha256", "plan", "media", "narrationGain"], ["planSha256", "plan", "media", "narrationGain"], "مدخلات الرندر") as unknown as WorkerJobV2["inputs"];
  if (typeof i.planSha256 !== "string" || !SHA256.test(i.planSha256) || planSha256(i.plan) !== i.planSha256) fail("بصمة الخطة لا تطابق الخطة.");
  if (!isObj(i.plan) || !Array.isArray((i.plan as Plan).chapters)) fail("الخطة غير صالحة.");
  if (!isObj(i.media) || i.media.mode !== "static" || typeof i.media.base !== "string") fail("وصف الوسائط غير صالح.");
  const snap = snapshotHashOf(i.media.base);
  if (!snap || snap.channel !== r.channel || snap.episode !== r.episode || snap.hash !== parts[4]) fail("وصف الوسائط لا يطابق لقطتها.");
  if (!isObj(i.narrationGain) || Object.values(i.narrationGain).some((g) => typeof g !== "number" || !Number.isFinite(g) || g <= 0 || g > 4)) fail("ربح العلوّ غير صالح.");
  for (const k of ["claimedBy", "claimedAt"] as const) if (r[k] !== undefined && typeof r[k] !== "string") fail(`${k} غير صالح.`);
  return raw as WorkerJobV2;
};

export const validateAnyJob = (raw: unknown): AnyJob => (isObj(raw) && raw.version === 1 ? validateJob(raw) : validateJobV2(raw));
export const isV2 = (job: AnyJob): job is WorkerJobV2 => job.version === 2;

/* ── D232: التقدم والنبض ── */

export type JobProgress = { id: string; percent: number; stage: string; at: string; startedAt: string };
export const progressFile = (share: string, id: string) => {
  if (!ID.test(id)) fail("المعرّف غير صالح.");
  return path.join(queuePaths(share).running, `${id}.progress.json`);
};
export const isProgressName = (name: string) => name.endsWith(".progress.json");
export const writeProgress = async (share: string, p: JobProgress) => {
  const file = progressFile(share, p.id);
  if (!existsSync(path.dirname(file))) return;
  await writeJsonAtomic(file, p).catch(() => undefined);
};
export const readProgress = async (share: string, id: string): Promise<JobProgress | null> => {
  try { return JSON.parse(await readFile(progressFile(share, id), "utf8")) as JobProgress; } catch { return null; }
};

export type Heartbeat = { host: string; pid: number; at: string; state: "idle" | "busy"; job?: string; commit?: string; protocol: 2 };
export const heartbeatFile = (share: string) => path.join(queuePaths(share).root, "worker.heartbeat.json");
/** نبض أقدم من هذا = جهاز الرندر غير متصل */
export const HEARTBEAT_STALE_MS = 2 * 60 * 1000;
export const writeHeartbeat = async (share: string, hb: Omit<Heartbeat, "at" | "host" | "pid" | "protocol">, now = new Date()) => {
  await ensureQueue(share);
  const value: Heartbeat = { host: workerName(), pid: process.pid, at: now.toISOString(), protocol: 2, ...hb };
  const file = heartbeatFile(share);
  const tmp = path.join(path.dirname(file), `.worker.heartbeat.${process.pid}.tmp`);
  await writeFile(tmp, JSON.stringify(value, null, 2) + "\n");
  await rename(tmp, file);
};
