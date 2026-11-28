/**
 * `bal worker --share <المجلد>` (D226): الحلقة على جهاز الرندر الثاني (ويندوز).
 *
 * كل ٣٠ ثانية: أقدم مهمة ← تُؤخذ بنقل ذري ← git fetch ثم checkout --detach على commit المهمة حرفيًا ←
 * npm ci فقط إن تغيّر package-lock.json ← عملية فرعية جديدة `bal worker-render` (بكود ذلك الـcommit) ترندر الشورت
 * إلى done/<id>/، أو failed/<id>/ بالسبب وآخر السجل. رندر واحد في كل وقت (render-queue/worker.lock).
 *
 * لا يدفع العامل شيئًا ولا يعتمد شيئًا ولا يكتب على أي remote؛ ولا .env ولا مفتاح توقيع. الحفظ الآلي وإرسال
 * الملاحظات مطفآن صراحة (BAL_CONTENT_SYNC=off وBAL_NOTES_SYNC=off)، والنسخة على commit منفصل لا main.
 * كل ما في هذا الملف مستورد مسبقًا (لا import متأخر): الكود على القرص يتغيّر بعد checkout.
 *
 * D232: الحلقة تقرأ «غلاف» المهمة وحده (الإصدار والمعرّف والقناة والحلقة والنوع والـcommit) قبل checkout، والفحص
 * الكامل في العملية الفرعية بكود commit المهمة؛ فنوع جديد لا يحتاج إعادة تشغيل العامل. وتكتب نبضها كل ٢٠ ثانية
 * في render-queue/worker.heartbeat.json (خاملة أو مشغولة بمهمة)، والماك يعدّ النبض الأقدم من دقيقتين انقطاعًا.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { acquireLock, claimJob, failJob, isProgressName, pendingJobs, queuePaths, tail, workerName, writeHeartbeat, type JobEnvelope } from "./protocol";
import { git, runCmd } from "./git";
import { runCleanupJobs } from "./cleanupQueue";
import { childEnv } from "../../../scripts/git-env.mjs";

export const POLL_MS = 30_000;
export const HEARTBEAT_MS = 20_000;

/** بيئة العامل وعملياته الفرعية: لا حفظ آلي ولا إرسال ملاحظات ولا مفاتيح خدمات. */
export const workerEnv = (env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => {
  const out = childEnv({ BAL_CONTENT_SYNC: "off", BAL_NOTES_SYNC: "off", BAL_RENDER_WORKER: "1" }, env);
  for (const k of Object.keys(out)) if (/^(ELEVENLABS|ANTHROPIC|OPENAI|QF_|GOOGLE_|YOUTUBE_)/i.test(k)) delete out[k];
  return out;
};

export type WorkerDeps = {
  repo: string;
  log: (line: string) => void;
  /** git fetch/checkout وnpm ci؛ يعيد رسالة خطأ أو null */
  prepareCommit: (job: JobEnvelope) => Promise<string | null>;
  /** العملية الفرعية للرندر؛ يعيد رمز الخروج وآخر السجل */
  renderChild: (share: string, job: JobEnvelope) => Promise<{ code: number; log: string }>;
  /** D232: النبض (خامل/مشغول)؛ اختياري في الاختبارات */
  heartbeat?: (state: "idle" | "busy", job?: string) => Promise<void>;
};

const lockHash = async (repo: string) => {
  const f = path.join(repo, "package-lock.json");
  return existsSync(f) ? createHash("sha256").update(await readFile(f)).digest("hex") : "";
};
const stateFile = (repo: string) => path.join(repo, "renders", "worker-state.json");

/** checkout على commit المهمة بالضبط؛ ونسخة العمل يجب أن تكون نظيفة (الملفات المتتبَّعة). */
export const prepareCommit = async (repo: string, job: Pick<JobEnvelope, "commit">, log: (l: string) => void): Promise<string | null> => {
  const dirty = await git(repo, ["status", "--porcelain", "--untracked-files=no"]);
  if (dirty.code !== 0) return `git status: ${dirty.err}`;
  if (dirty.out) return `نسخة العامل فيها تعديلات على ملفات متتبَّعة؛ لا رندر عليها:\n${dirty.out.slice(0, 500)}`;
  log("git fetch…");
  await git(repo, ["fetch", "--depth=50", "origin"]);
  if ((await git(repo, ["cat-file", "-e", `${job.commit}^{commit}`])).code !== 0) {
    const r = await git(repo, ["fetch", "--depth=1", "origin", job.commit]);
    if (r.code !== 0) return `تعذّر جلب الـcommit ${job.commit.slice(0, 8)}: ${r.err.slice(-400)}`;
  }
  const co = await git(repo, ["checkout", "--detach", job.commit]);
  if (co.code !== 0) return `تعذّر checkout: ${co.err.slice(-400)}`;
  const head = await git(repo, ["rev-parse", "HEAD"]);
  if (head.out !== job.commit) return "الـcommit بعد checkout لا يطابق المهمة.";
  const now = await lockHash(repo);
  let state: { lockSha256?: string } = {};
  try { state = JSON.parse(await readFile(stateFile(repo), "utf8")); } catch { state = {}; }
  if (state.lockSha256 !== now) {
    log("package-lock.json تغيّر: npm ci…");
    const r = await runCmd("npm", ["ci", "--no-audit", "--no-fund"], { cwd: repo, shell: process.platform === "win32", env: workerEnv(), timeoutMs: 60 * 60_000 });
    if (r.code !== 0) return `npm ci فشل: ${tail(r.err || r.out, 30)}`;
    await mkdir(path.dirname(stateFile(repo)), { recursive: true });
    await writeFile(stateFile(repo), JSON.stringify({ lockSha256: now, at: new Date().toISOString() }, null, 2) + "\n");
  }
  return null;
};

/** عملية Node جديدة بكود الـcommit الحالي: `bal -c <القناة> worker-render --share … --job …` */
export const renderChild = async (repo: string, share: string, job: Pick<JobEnvelope, "id" | "channel">, log: (l: string) => void) => {
  const lines: string[] = [];
  const r = await runCmd(process.execPath, [path.join(repo, "bin", "bal.mjs"), "-c", job.channel, "worker-render", "--share", share, "--job", job.id],
    { cwd: repo, env: workerEnv(), onLine: (l) => { lines.push(l); if (lines.length > 400) lines.shift(); log(l); } });
  return { code: r.code, log: lines.join("\n") || r.err };
};

/** دورة واحدة: مهمة واحدة على الأكثر. يعيد معرّفها أو null إن لم توجد. */
export const runOnce = async (share: string, deps: WorkerDeps): Promise<string | null> => {
  const release = await acquireLock(share);
  if (!release) { deps.log("عامل آخر يعمل الآن (render-queue/worker.lock)."); return null; }
  try {
    // القفل معنا: أي مهمة في running/ أخذها هذا الجهاز قبلُ انقطعت (إعادة تشغيل أو انقطاع)، فتُكتب فاشلة لا تبقى معلّقة
    const running = queuePaths(share).running;
    for (const f of existsSync(running) ? (await readdir(running)).filter((x) => x.endsWith(".json") && !x.startsWith(".") && !isProgressName(x)) : []) {
      let by: string | undefined;
      try { by = (JSON.parse(await readFile(path.join(running, f), "utf8")) as { claimedBy?: string }).claimedBy; } catch { by = undefined; }
      if (by === workerName()) await failJob(share, f.slice(0, -5), "انقطع العامل أثناء هذه المهمة؛ أعد إرسالها من الماك.", "");
    }
    // D240: تنظيف ما بعد النشر في نسخة العامل المحلية (يتحقق من Master الدائم بنفسه؛ لا دفع ولا اعتماد)
    await runCleanupJobs(share, deps.repo, deps.log);
    for (const candidate of await pendingJobs(share)) {
      const job = await claimJob(share, candidate.id, workerName());
      if (!job) continue;
      deps.log(`المهمة ${job.id}: ${job.channel} ${job.episode} (${job.kind}) @ ${job.commit.slice(0, 8)}`);
      // D245: الحلقة الجارية والتناوب (وما تُخطّي من أدوار) في rotation.json؛ فشل الكتابة لا يوقف الرندر
      await (async () => {
        const R = await import("./rotation");
        const q = path.dirname(queuePaths(share).jobs);
        const before = await R.readRotation(q);
        const after = R.noteClaim(before, job, new Date());
        if (after !== before) {
          await R.writeRotation(q, after);
          const e = after.log.at(-1);
          if (e?.skipped.length) deps.log(`D245: الدور كان على ${e.expected}، ولا حلقة جاهزة لـ ${e.skipped.join(" و")}؛ أُخذت ${job.channel} ${job.episode}.`);
        }
      })().catch(() => undefined);
      await deps.heartbeat?.("busy", job.id).catch(() => undefined);
      const why = await deps.prepareCommit(job);
      if (why) { await failJob(share, job.id, why, ""); deps.log(`فشلت: ${why}`); return job.id; }
      // النبض أثناء الرندر الطويل (الحلقة الأم حية وإن انشغلت العملية الفرعية ساعات)
      const beat = deps.heartbeat ? setInterval(() => { void deps.heartbeat!("busy", job.id).catch(() => undefined); }, HEARTBEAT_MS) : null;
      let r: { code: number; log: string };
      try { r = await deps.renderChild(share, job); } finally { if (beat) clearInterval(beat); }
      const done = existsSync(path.join(queuePaths(share).done, job.id));
      if (r.code !== 0 || !done) {
        const msg = r.code !== 0 ? `انتهى الرندر برمز ${r.code}` : "انتهى الرندر بلا نتيجة في done/";
        await failJob(share, job.id, msg, r.log);
        deps.log(`فشلت: ${msg}`);
      } else deps.log(`تمت: done/${job.id}/ (يتحقق منها الماك قبل استعمالها)`);
      return job.id;
    }
    return null;
  } finally {
    await release();
  }
};

export const runWorker = async (share: string, o: { once?: boolean; repo: string; log?: (l: string) => void }) => {
  Object.assign(process.env, { BAL_CONTENT_SYNC: "off", BAL_NOTES_SYNC: "off", BAL_RENDER_WORKER: "1" });
  const log = o.log ?? ((l: string) => console.log(`[${new Date().toISOString()}] ${l}`));
  const deps: WorkerDeps = {
    repo: o.repo, log,
    prepareCommit: (job) => prepareCommit(o.repo, job, log),
    renderChild: (s, job) => renderChild(o.repo, s, job, log),
    heartbeat: async (state, job) => {
      const head = await git(o.repo, ["rev-parse", "HEAD"]).catch(() => null);
      await writeHeartbeat(share, { state, ...(job ? { job } : {}), ...(head?.code === 0 ? { commit: head.out } : {}) });
    },
  };
  log(`عامل الرندر ${workerName()} على ${share}`);
  for (;;) {
    try {
      await deps.heartbeat!("idle").catch(() => undefined);
      const id = await runOnce(share, deps);
      if (o.once) return id;
      if (id) continue;
    } catch (e) {
      log(`خطأ: ${(e as Error).message}`);
      if (o.once) throw e;
    }
    // نبض خامل كل HEARTBEAT_MS حتى الدورة التالية
    for (let waited = 0; waited < POLL_MS; waited += HEARTBEAT_MS) {
      await delay(Math.min(HEARTBEAT_MS, POLL_MS - waited));
      await deps.heartbeat!("idle").catch(() => undefined);
    }
  }
};
