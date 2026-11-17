import { FAILURE_LABEL, queuePosition, RenderPool, type TaskDef, type TaskSpec } from "../../src/render/pool.ts";
import path from "node:path";
import { prepareRunning, PREPARE_RUNNING_MESSAGE } from "./prepare.ts";
import { ownerText } from "../../src/i18n/sceneNames.ts";

/**
 * طابور المهام الثقيلة في الاستوديو وحالتها: الرندر والصناعة والتغليف والقياس، و«مشغول» لكل حلقة،
 * والتقدم كما يراه المالك، والاستعادة بعد إعادة التشغيل.
 */
export type LongJob = {
  id: string;
  kind: "make" | "package" | "shorts" | "sfx" | "render" | "storyboard-motion";
  channel: string;
  episode?: string;
  title: string;
  status: "running" | "done" | "error";
  pct: number;
  log: string[];
  output?: string;
  error?: string;
  startedAt: number;
  /** ينتظر دوره في طابور الرندر (الحالة تبقى running كي لا تظنه الواجهة انتهى) */
  queued?: boolean;
  /** نوع الفشل المصنَّف (نفاد الذاكرة، المهلة، الإلغاء…) */
  failure?: string;
  recovered?: boolean;
};
export const longJobs = new Map<string, LongJob>();

/**
 * حلقة واحدة لا تُصنع مرتين في الوقت نفسه (رندر، صناعة، تغليف تكتب في نفس مجلد out).
 * المفتاح: قناة/حلقة، أو قناة/sfx.
 */
export const busy = new Set<string>();
let seq = 0;
export const newJobId = () => `${Date.now()}-${++seq}`;
/** يُبقي آخر 30 مهمة فقط. */
export const trimJobs = <T extends { status: string }>(m: Map<string, T>) => {
  while (m.size > 30) {
    const oldest = [...m.entries()].find(([, j]) => j.status !== "running");
    if (!oldest) break;
    m.delete(oldest[0]);
  }
};
export const busyMessage = "توجد مهمة جارية على هذه الحلقة (رندر أو صناعة). انتظر انتهاءها ثم أعد المحاولة.";
/** The refusal for a busy episode, naming «جهّز كل المشاهد» when that is what holds it (QA H4/M5). */
export const busyRefusal = (key: string) => (prepareRunning(key) ? PREPARE_RUNNING_MESSAGE : busyMessage);


/**
 * الشورت n من N (D152: بلا حد لعددها) يأخذ نصيبه من 80→98%. السطر القديم بلا «من N» كان يفترض ستة.
 */
const shortPct = (label: string, p: number): number | null => {
  const m = label.match(/الشورت (\d+)(?: من (\d+))?/);
  if (!m) return null;
  const n = Number(m[1]);
  const total = Math.max(n, Number(m[2] ?? 6));
  return Math.min(98, 80 + ((n - 1 + p / 100) * 18) / total);
};

/** تقدير التقدم من سطور bal make: «٣/٥ …» ثم «الحلقة: 40%» … */
export const progressFrom = (job: LongJob, line: string) => {
  const step = line.match(/^([٠-٩1-9])\/([٠-٩1-9])/);
  if (step) {
    const n = Number(step[1]!.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)));
    job.pct = Math.max(job.pct, (n - 1) * 15);
  }
  const pct = line.match(/(\d+)%/);
  if (pct && job.kind !== "sfx" && !/^\s*FRAMES /.test(line)) {
    const p = Number(pct[1]);
    if (/الحلقة/.test(line)) job.pct = Math.max(job.pct, 60 + p * 0.2);
    const short = shortPct(line, p);
    if (short !== null) job.pct = Math.max(job.pct, short);
  }
  if (/^PROGRESS (\d+)/.test(line)) job.pct = Number(line.match(/^PROGRESS (\d+)/)![1]);
  // M7: frame progress of a render inside make/package («FRAMES الحلقة 37»), so a long 4K render moves
  // smoothly from 60% instead of sitting there between the 20% log lines.
  const frames = line.trim().match(/^FRAMES (.+?) (\d+)$/);
  if (frames) {
    const p = Number(frames[2]);
    if (frames[1] === "الحلقة") job.pct = Math.max(job.pct, Math.min(98, 60 + p * (job.kind === "make" ? 0.38 : 0.2)));
    const short = /^الشورت \d+(?: من \d+)?$/.test(frames[1]!) ? shortPct(frames[1]!, p) : null;
    if (short !== null) job.pct = Math.max(job.pct, short);
  }
};

/**
 * M7: what the owner's log shows. Machine progress lines are never listed; the renderer's English memory /
 * concurrency warnings become one Arabic note (said once), not raw English.
 */
export const MEMORY_NOTE = "تنبيه: ذاكرة الجهاز محدودة لهذا الرندر، فيعمل بتوازٍ أقل وقد يطول قليلًا.";
export const ownerLogLine = (line: string, log: string[]): string | null => {
  if (/^(?:PROGRESS|FRAMES) /.test(line.trim())) return null;
  if (/docker|Detected differing/i.test(line)) return null;
  if (/memory|concurrency|RAM\b/i.test(line) && /[A-Za-z]{4}/.test(line) && !/[\u0600-\u06FF]/.test(line))
    return log.includes(MEMORY_NOTE) ? null : MEMORY_NOTE;
  return line;
};

/**
 * كل المهام الثقيلة في الاستوديو (الرندر والصناعة والقياس) تمر بطابور واحد (الأمران 009 و010):
 * تبدأ فورًا إن سمحت ذاكرة الجهاز، وإلا تنتظر دورها بدل أن تُسقط غيرها؛ وفشل إحداها مسجل بسببه
 * المصنَّف في renders/studio-queue.json ولا يمس غيرها. وعند إعادة تشغيل الاستوديو تُستعاد المنتظرة
 * والمنقطعة منها (recoverStudioQueue) وتعود بطاقاتها إلى الواجهة.
 */
export const studioPool = new RenderPool({ ledger: path.join(path.resolve(import.meta.dirname, "..", ".."), "renders", "studio-queue.json") });
export const queued = (j: { log: string[] }, id: string) => {
  const ahead = queuePosition(studioPool, id);
  j.log.push(`في الطابور: ينتظر ذاكرة كافية لبدء الرندر${ahead ? ` (${ahead} قبله)` : ""}…`);
};

/** بطاقة رندر الحلقة (تبويب الحلقة) */
export type RenderJob = { id: string; channel: string; episode: string; orientation: string; chapter?: number; status: "running" | "done" | "error"; pct: number; output?: string; error?: string; log: string[]; queued?: boolean; failure?: string; recovered?: boolean };
export const renderJobs = new Map<string, RenderJob>();

type View = { status: "running" | "done" | "error"; pct: number; log: string[]; output?: string; error?: string; queued?: boolean; failure?: string; recovered?: boolean };
/** يربط مهمة الطابور ببطاقتها: التقدم، والانتهاء، وسبب الفشل المصنَّف بلغة واضحة */
const attach = (def: TaskDef, view: View, key: string, onLine: (line: string) => void, keepLog: number): TaskSpec => ({
  ...def,
  onStart: () => {
    view.queued = false;
    if ("startedAt" in view) (view as LongJob).startedAt = Date.now();
  },
  onLine: (line) => {
    onLine(line);
    const shown = ownerLogLine(line, view.log);
    if (shown === null) return;
    view.log.push(shown);
    if (view.log.length > keepLog) view.log.shift();
  },
  onEnd: (t) => {
    busy.delete(key);
    view.queued = false;
    view.status = t.status === "done" ? "done" : "error";
    if (t.status === "done") view.pct = 100;
    else {
      view.failure = t.failure ? FAILURE_LABEL[t.failure.kind] : undefined;
      // A refusal already carries its own sentence; the log line would only repeat it.
      const detail = t.failure?.kind === "refused" ? "" : view.log.filter((l) => /خطأ|Error|لا يمكن/.test(l)).slice(-2).join(" ");
      view.error = ownerText([t.failure ? `${FAILURE_LABEL[t.failure.kind]}: ${t.failure.message}` : t.error, detail].filter(Boolean).join(" · ") || "توقفت العملية");
    }
  },
});

const longLine = (j: LongJob) => (line: string) => {
  progressFrom(j, line);
  const done = line.match(/^DONE (.+)$/);
  if (done) j.output = path.basename(done[1]!.trim());
};
const renderLine = (job: RenderJob) => (line: string) => {
  const p = line.match(/^PROGRESS (\d+)/);
  if (p) job.pct = Number(p[1]);
  const done = line.match(/^DONE (.+)$/);
  if (done) job.output = path.basename(done[1]!.trim());
};

export const startJob = (ctx: { root: string }, job: Omit<LongJob, "id" | "status" | "pct" | "log" | "startedAt">, args: string[]) => {
  const j: LongJob = { ...job, id: newJobId(), status: "running", pct: 1, log: [], startedAt: Date.now(), queued: true };
  const key = `${job.channel}/${job.episode ?? job.kind}`;
  busy.add(key);
  longJobs.set(j.id, j);
  trimJobs(longJobs);
  const def: TaskDef = { id: j.id, cmd: process.execPath, args: ["bin/bal.mjs", "--channel", job.channel, ...args], cwd: ctx.root, costKey: `long:${job.kind}`, meta: { type: "long", job: { ...job } } };
  studioPool.add(attach(def, j, key, longLine(j), 300));
  if (j.queued) queued(j, j.id);
  return j;
};

/** رندر حلقة من تبويبها */
export const startRenderJob = (root: string, ch: string, b: { episode: string; orientation: string; chapter?: number }) => {
  const key = `${ch}/${b.episode}`;
  busy.add(key);
  const id = newJobId();
  const job: RenderJob = { id, channel: ch, episode: b.episode, orientation: b.orientation, chapter: b.chapter, status: "running", pct: 0, log: [], queued: true };
  renderJobs.set(id, job);
  trimJobs(renderJobs);
  const args = ["bin/bal.mjs", "--channel", ch, "render", b.episode];
  if (b.orientation === "portrait") args.push("--portrait");
  if (b.chapter) args.push("--chapter", String(b.chapter));
  const def: TaskDef = { id, cmd: process.execPath, args, cwd: root, costKey: `render:${b.orientation === "portrait" ? "portrait" : "landscape"}${b.chapter ? ":chapter" : ""}`, meta: { type: "render", job: { channel: ch, episode: b.episode, orientation: b.orientation, chapter: b.chapter } } };
  studioPool.add(attach(def, job, key, renderLine(job), 50));
  if (job.queued) queued(job, id);
  return job;
};

/**
 * استعادة الطابور بعد إعادة تشغيل الاستوديو: كل مهمة منتظرة أو منقطعة تعود ببطاقتها،
 * ومفتاح «مشغول» لحلقتها فلا تُطلق مرتين. المنتهية تبقى في السجل ولا تُعاد.
 */
let recovering: Promise<unknown> | null = null;
/**
 * Owner decision (15–16 Nov): a job that can spend voice credit never resumes on its own after a restart. «توليد
 * المؤثرات الناقصة» (`bal sfx`) and any run told to generate voice are left stopped, with a card that says so; the
 * owner presses the button again if he wants it. Free work (renders, packaging, the Master from existing voice) resumes.
 */
export const paidJobDef = (def: Pick<TaskDef, "args" | "meta">) => {
  const meta = def.meta as { type?: string; job?: { kind?: string } } | undefined;
  return meta?.job?.kind === "sfx" || (def.args ?? []).includes("--generate-voice");
};
export const PAID_JOB_NOT_RESUMED = "أوقفتها إعادة تشغيل الاستوديو قبل أن تكتمل، ولا يُستأنف عمل يصرف رصيدًا وحده. اضغط الزر من جديد إن أردت إكماله؛ ما اكتمل قبلها محفوظ.";
/** One job of the queue ledger after a restart: re-attached (free work) or left stopped with its card (paid work). */
export const attachRecovered = (def: TaskDef): TaskSpec | null => {
  const meta = def.meta as { type?: string; job?: Record<string, unknown> } | undefined;
  if (meta?.type === "long" && meta.job && paidJobDef(def)) {
    const job = meta.job as Omit<LongJob, "id" | "status" | "pct" | "log" | "startedAt">;
    longJobs.set(def.id, { ...job, id: def.id, status: "error", pct: 0, log: [PAID_JOB_NOT_RESUMED], startedAt: Date.now(),
      error: PAID_JOB_NOT_RESUMED, recovered: true });
    return null;
  }
  if (meta?.type === "long" && meta.job) {
    const job = meta.job as Omit<LongJob, "id" | "status" | "pct" | "log" | "startedAt">;
    const j: LongJob = { ...job, id: def.id, status: "running", pct: 1, log: ["استُعيدت بعد إعادة تشغيل الاستوديو"], startedAt: Date.now(), queued: true, recovered: true };
    const key = `${job.channel}/${job.episode ?? job.kind}`;
    busy.add(key);
    longJobs.set(j.id, j);
    return attach(def, j, key, longLine(j), 300);
  }
  if (meta?.type === "render" && meta.job) {
    const m = meta.job as { channel: string; episode: string; orientation: string; chapter?: number };
    const job: RenderJob = { id: def.id, ...m, status: "running", pct: 0, log: ["استُعيدت بعد إعادة تشغيل الاستوديو"], queued: true, recovered: true };
    const key = `${m.channel}/${m.episode}`;
    busy.add(key);
    renderJobs.set(job.id, job);
    return attach(def, job, key, renderLine(job), 50);
  }
  return null;
};
export const recoverStudioQueue = () =>
  (recovering ??= studioPool
    .recover(attachRecovered)
    .then((r) => {
      if (r.requeued.length) console.log(`استُعيدت ${r.requeued.length} مهمة من طابور الرندر${r.killedOrphans.length ? `، وأُوقفت ${r.killedOrphans.length} عملية يتيمة` : ""}.`);
      return r;
    })
    .catch((e) => console.error(`تعذّرت استعادة طابور الرندر: ${(e as Error).message}`)));
