/**
 * عامل الرندر على الجهاز الثاني (D226): بروتوكول المهام في المجلد المشترك.
 *
 * الماك وحده مصدر الحقيقة: يكتب المهمة في `render-queue/jobs/<id>.json`، ويأخذها العامل بنقل ذري إلى
 * `running/`، ويكتب الناتج في `done/<id>/` (الفيديو و`result.json` و`job.json`) أو السبب في `failed/<id>/`.
 * لا يُستورد شيء من `done/` إلا بعد أن يتحقق منه الماك (`bal worker-collect`). ناتج العامل «غير موثوق» حتى ذلك.
 *
 * كل مسار في المهمة نسبي بشرطات أمامية، ويُفحص بنمط صارم (لا `..` ولا مسار مطلق ولا شرطة خلفية)، ثم يُركَّب
 * بـ path.join على النظام الذي يعمل عليه (ويندوز أو ماك).
 */
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile, open } from "node:fs/promises";
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
};

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
export const pendingJobs = async (share: string): Promise<WorkerJob[]> => {
  const p = queuePaths(share);
  if (!existsSync(p.jobs)) return [];
  const out: WorkerJob[] = [];
  for (const f of (await readdir(p.jobs)).filter((x) => x.endsWith(".json") && !x.startsWith(".")).sort()) {
    try { out.push(validateJob(JSON.parse(await readFile(path.join(p.jobs, f), "utf8")))); } catch { /* يظهر في المهمة نفسها حين تُؤخذ */ }
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
export const claimJob = async (share: string, id: string, worker: string, now = new Date()): Promise<WorkerJob | null> => {
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
  let job: WorkerJob;
  try {
    job = validateJob(JSON.parse(await readFile(to, "utf8")));
  } catch (e) {
    await failJob(share, id, (e as Error).message, "");
    return null;
  }
  const claimed = { ...job, claimedBy: worker, claimedAt: now.toISOString() };
  await writeJsonAtomic(to, claimed);
  return claimed;
};

export const runningJob = async (share: string, id: string): Promise<WorkerJob> =>
  validateJob(JSON.parse(await readFile(jobFile(queuePaths(share).running, id), "utf8")));

/** الفشل: failed/<id>/ فيه error.json وملف المهمة (إن وُجد). لا يُحذف أي شيء آخر. */
export const failJob = async (share: string, id: string, error: string, logTail: string) => {
  const p = await ensureQueue(share);
  const dir = path.join(p.failed, id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "error.json"), JSON.stringify({ id, error, logTail: tail(logTail), at: new Date().toISOString(), worker: workerName() }, null, 2) + "\n");
  for (const src of [jobFile(p.running, id), jobFile(p.jobs, id)])
    if (existsSync(src)) { await rename(src, path.join(dir, "job.json")); break; }
};

/** النجاح: يُبنى done/.<id>.partial ثم يُنقل كاملًا إلى done/<id>/ (الماك لا يرى نتيجة ناقصة). */
export const completeJob = async (share: string, job: WorkerJob, mp4: string, result: WorkerResult) => {
  const p = await ensureQueue(share);
  const partial = path.join(p.done, `.${job.id}.partial`);
  const dir = path.join(p.done, job.id);
  if (existsSync(dir)) fail(`نتيجة سابقة موجودة: ${job.id}`);
  await rm(partial, { recursive: true, force: true });
  await mkdir(partial, { recursive: true });
  const { copyFile } = await import("node:fs/promises");
  await copyFile(mp4, path.join(partial, doneVideoName(job)));
  // البصمة من النسخة في المجلد المشترك نفسها (لا من الملف المحلي)
  const copied = await sha256File(path.join(partial, doneVideoName(job)));
  if (copied !== result.sha256) fail("تغيّرت الفيديو أثناء النسخ إلى المجلد المشترك.");
  await writeFile(path.join(partial, "result.json"), JSON.stringify(result, null, 2) + "\n");
  await rename(jobFile(p.running, job.id), path.join(partial, "job.json"));
  await rename(partial, dir);
  return dir;
};
export const doneVideoName = (job: Pick<WorkerJob, "id">) => `${job.id}.mp4`;

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
