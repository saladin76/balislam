import os from "node:os";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

/**
 * طابور الرندر المشترك (الأمر 009): عدد الرندرات المتزامنة يُحسب من موارد الجهاز لحظة بدء كل مهمة،
 * وما يزيد ينتظر في الطابور. فشل مهمة لا يوقف غيرها ولا يمحو ناتجًا سليمًا سابقًا، وسببه يُسجَّل بوضوح،
 * وإعادة المحاولة تعيد الفاشل وحده.
 */

/** ذاكرة الجهاز المتاحة بالميغابايت (حد الحاوية إن وُجد، وإلا ذاكرة النظام) */
export const memoryInfo = (): { totalMB: number; availableMB: number } => {
  const sys = { totalMB: os.totalmem() / 2 ** 20, availableMB: os.freemem() / 2 ** 20 };
  try {
    const meminfo = readFileSync("/proc/meminfo", "utf8");
    const avail = /MemAvailable:\s+(\d+)/.exec(meminfo);
    if (avail) sys.availableMB = Number(avail[1]) / 1024;
  } catch {
    /* غير لينكس */
  }
  try {
    const max = readFileSync("/sys/fs/cgroup/memory.max", "utf8").trim();
    const cur = Number(readFileSync("/sys/fs/cgroup/memory.current", "utf8").trim());
    if (max !== "max") {
      const limit = Number(max) / 2 ** 20;
      return { totalMB: Math.min(sys.totalMB, limit), availableMB: Math.min(sys.availableMB, limit - cur / 2 ** 20) };
    }
  } catch {
    /* بلا cgroup v2 */
  }
  return sys;
};

export type Capacity = { availableMB: number; cpus: number; running: number; runningMB: number; perJobMB: number; reserveMB: number };
/**
 * هل تبدأ مهمة جديدة الآن؟ تبدأ الأولى دائمًا (وإلا لن يعمل شيء)، وبعدها لا تبدأ مهمة
 * إلا إذا بقي بعدها احتياطي للنظام، ولم يتجاوز العدد أنوية المعالج.
 * perJobMB: الذروة المقيسة لمهمة واحدة (تتعلم من المهام السابقة).
 */
export const canStart = (c: Capacity) => {
  if (c.running === 0) return true;
  if (c.running >= Math.max(1, c.cpus)) return false;
  // الذاكرة المتاحة الآن تشمل ما لم تحجزه المهام الجارية بعد؛ نفترض أن كلًا منها سيبلغ ذروته
  const pending = Math.max(0, c.perJobMB * c.running - c.runningMB);
  return c.availableMB - pending - c.perJobMB >= c.reserveMB;
};
/** التوازي الآمن على هذا الجهاز الآن (للتقارير وللسطر الأول في سجل الطابور) */
export const safeParallelism = (availableMB: number, cpus: number, perJobMB: number, reserveMB: number) =>
  Math.max(1, Math.min(cpus, Math.floor((availableMB - reserveMB) / perJobMB)));

/** ذاكرة عملية وكل أبنائها (المتصفح وFFmpeg) بالميغابايت من /proc */
export const treeRssMB = (pid: number): number => {
  try {
    const kids = new Map<number, number[]>();
    const rss = new Map<number, number>();
    for (const d of readdirSync("/proc")) {
      if (!/^\d+$/.test(d)) continue;
      try {
        const st = readFileSync(`/proc/${d}/stat`, "utf8");
        const f = st.slice(st.lastIndexOf(")") + 2).split(" ");
        const ppid = Number(f[1]);
        rss.set(Number(d), (Number(f[21]) * 4096) / 2 ** 20);
        kids.set(ppid, [...(kids.get(ppid) ?? []), Number(d)]);
      } catch {
        /* انتهت العملية */
      }
    }
    let sum = 0;
    const stack = [pid];
    while (stack.length) {
      const p = stack.pop()!;
      sum += rss.get(p) ?? 0;
      stack.push(...(kids.get(p) ?? []));
    }
    return sum;
  } catch {
    return 0;
  }
};

/** سبب الفشل بلغة واضحة من رمز الخروج والإشارة وآخر سطور الخطأ */
export const failureReason = (code: number | null, signal: NodeJS.Signals | null, tail: string[], peakMB: number) => {
  const last = tail.filter((l) => /error|Error|خطأ|ENOMEM|Killed|out of memory|Target closed|crashed/i.test(l)).slice(-2).join(" · ");
  if (signal === "SIGKILL" || code === 137 || /out of memory|ENOMEM|Killed/i.test(last))
    return `نفدت الذاكرة على الأرجح: أوقف النظام العملية (${signal ?? code}) وذروتها ${Math.round(peakMB)} م.ب. أعد المحاولة بتوازٍ أقل.`;
  if (/Target closed|crashed|Page crashed/i.test(last)) return `انهار المتصفح أثناء الرندر: ${last}`;
  if (signal) return `أُوقفت العملية بالإشارة ${signal}${last ? `: ${last}` : ""}`;
  return `انتهت العملية برمز ${code}${last ? `: ${last}` : ""}`;
};

export type TaskSpec = {
  id: string;
  /** الأمر وما يليه: يُشغَّل بلا shell */
  cmd: string;
  args: string[];
  cwd: string;
  /** الملف الناتج: يُكتب أولًا في ملف مؤقت ثم يُنقل مكانه عند النجاح فقط */
  output?: string;
  /** موضع اسم الملف الناتج في args (يُستبدل بالمؤقت) */
  outputArg?: number;
  env?: NodeJS.ProcessEnv;
  /** كل سطر من مخرجات المهمة (للاستوديو: نسبة التقدم وسجل العرض) */
  onLine?: (line: string) => void;
  /** لحظة خروجها من الطابور وبدء تشغيلها فعلًا */
  onStart?: () => void;
  /** عند انتهائها نجاحًا أو فشلًا (مع سبب الفشل) */
  onEnd?: (t: TaskState) => void;
};
export type TaskState = {
  id: string;
  status: "queued" | "running" | "done" | "error";
  attempts: number;
  queuedAt: number;
  startedAt?: number;
  endedAt?: number;
  seconds?: number;
  peakMB?: number;
  error?: string;
  output?: string;
  log: string[];
};

export type PoolOptions = {
  /** ملف حالة الطابور (يبقى بعد انتهاء العملية: من نجح ومن فشل ولماذا) */
  ledger?: string;
  /** احتياطي يُترك للنظام وللاستوديو (م.ب) */
  reserveMB?: number;
  /** تقدير أولي لذروة المهمة الواحدة قبل أن يقيسها الطابور (م.ب) */
  perJobMB?: number;
  /** حد أعلى يفرضه المستخدم (اختياري)؛ الحد الفعلي هو الأصغر بينه وبين ما تسمح به الموارد */
  maxParallel?: number;
  cpus?: number;
  memory?: () => { availableMB: number };
  onChange?: (t: TaskState) => void;
  /** للاختبار: تشغيل مهمة بدل spawn */
  spawnFn?: (spec: TaskSpec) => ChildProcess;
  pollMs?: number;
};

export class RenderPool {
  readonly tasks = new Map<string, TaskState>();
  private specs = new Map<string, TaskSpec>();
  private running = new Map<string, { child: ChildProcess; peak: number }>();
  private waiters: (() => void)[] = [];
  private learnedMB: number;
  private timer: NodeJS.Timeout | null = null;
  constructor(private o: PoolOptions = {}) {
    this.learnedMB = o.perJobMB ?? 1800;
  }

  /** ذروة مهمة واحدة المقيسة حتى الآن (أكبر ما رُصد)، ويبدأ بالتقدير */
  get perJobMB() {
    return this.learnedMB;
  }

  add(spec: TaskSpec) {
    const prev = this.tasks.get(spec.id);
    if (prev && (prev.status === "running" || prev.status === "queued")) return prev;
    this.specs.set(spec.id, spec);
    const t: TaskState = { id: spec.id, status: "queued", attempts: prev?.attempts ?? 0, queuedAt: Date.now(), log: [] };
    this.tasks.set(spec.id, t);
    this.emit(t);
    this.pump();
    return t;
  }

  /** إعادة الفاشل وحده (أو مهام بعينها) دون لمس الناجح */
  retryFailed(ids?: string[]) {
    const again = [...this.tasks.values()].filter((t) => t.status === "error" && (!ids || ids.includes(t.id)));
    for (const t of again) this.add(this.specs.get(t.id)!);
    return again.map((t) => t.id);
  }

  /** ينتظر حتى تفرغ كل المهام (نجاحًا أو فشلًا) */
  idle(): Promise<void> {
    if (![...this.tasks.values()].some((t) => t.status === "queued" || t.status === "running")) return Promise.resolve();
    return new Promise((r) => this.waiters.push(r));
  }

  private capacity(): Capacity {
    const mem = (this.o.memory ?? memoryInfo)();
    let runningMB = 0;
    for (const r of this.running.values()) runningMB += r.peak;
    return { availableMB: mem.availableMB, cpus: this.o.cpus ?? os.cpus().length, running: this.running.size, runningMB, perJobMB: this.learnedMB, reserveMB: this.o.reserveMB ?? 900 };
  }

  private pump() {
    for (const t of this.tasks.values()) {
      if (t.status !== "queued") continue;
      if (this.o.maxParallel && this.running.size >= this.o.maxParallel) break;
      if (!canStart(this.capacity())) break;
      this.start(t);
    }
    this.ensureTimer();
  }

  private ensureTimer() {
    const busy = this.running.size > 0 || [...this.tasks.values()].some((t) => t.status === "queued");
    if (busy && !this.timer) {
      this.timer = setInterval(() => {
        for (const [, r] of this.running) r.peak = Math.max(r.peak, treeRssMB(r.child.pid ?? -1));
        this.pump();
      }, this.o.pollMs ?? 500);
      this.timer.unref?.();
    } else if (!busy && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private start(t: TaskState) {
    const spec = this.specs.get(t.id)!;
    const tmp = spec.output ? `${spec.output}.part${path.extname(spec.output)}` : undefined;
    const args = [...spec.args];
    if (tmp && spec.outputArg !== undefined) args[spec.outputArg] = tmp;
    t.status = "running";
    t.attempts += 1;
    t.startedAt = Date.now();
    t.error = undefined;
    t.log = [];
    this.emit(t);
    spec.onStart?.();
    const child = (this.o.spawnFn ?? ((s: TaskSpec) => spawn(s.cmd, args, { cwd: s.cwd, env: s.env ?? process.env })))({ ...spec, args });
    const rec = { child, peak: 0 };
    this.running.set(t.id, rec);
    const onData = (d: Buffer) => {
      for (const line of d.toString().split("\n")) {
        if (!line.trim()) continue;
        t.log.push(line.trim());
        if (t.log.length > 40) t.log.shift();
        spec.onLine?.(line.trim());
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    const finish = async (code: number | null, signal: NodeJS.Signals | null, spawnError?: Error) => {
      if (!this.running.has(t.id)) return;
      this.running.delete(t.id);
      t.endedAt = Date.now();
      t.seconds = (t.endedAt - (t.startedAt ?? t.endedAt)) / 1000;
      t.peakMB = Math.round(rec.peak);
      if (rec.peak > 0) this.learnedMB = Math.max(this.learnedMB * 0.5, rec.peak, rec.peak * 0.7 + this.learnedMB * 0.3);
      if (code === 0 && !spawnError) {
        if (tmp && spec.output) {
          if (existsSync(tmp)) {
            await rename(tmp, spec.output);
            t.output = spec.output;
            t.status = "done";
          } else {
            t.status = "error";
            t.error = "انتهت العملية بلا ملف ناتج.";
          }
        } else t.status = "done";
      } else {
        t.status = "error";
        t.error = spawnError ? `تعذّر تشغيل المهمة: ${spawnError.message}` : failureReason(code, signal, t.log, rec.peak);
        // الناتج الجزئي يُحذف؛ والناتج السليم السابق (إن وجد) يبقى كما هو
        if (tmp) await rm(tmp, { force: true });
      }
      this.emit(t);
      spec.onEnd?.(t);
      await this.save();
      this.pump();
      if (![...this.tasks.values()].some((x) => x.status === "queued" || x.status === "running")) {
        this.ensureTimer();
        for (const w of this.waiters.splice(0)) w();
      }
    };
    child.on("error", (e) => void finish(null, null, e));
    child.on("close", (code, signal) => void finish(code, signal));
  }

  private emit(t: TaskState) {
    this.o.onChange?.(t);
  }

  private saving: Promise<void> = Promise.resolve();
  /** حفظ السجل: الحفظات متسلسلة (لا يتسابق حفظان على الملف نفسه) وكل حفظ يكتب ملفًا كاملًا ثم ينقله */
  save(): Promise<void> {
    this.saving = this.saving.then(() => this.write()).catch(() => this.write());
    return this.saving;
  }
  private async write() {
    if (!this.o.ledger) return;
    await mkdir(path.dirname(this.o.ledger), { recursive: true });
    const body = { updatedAt: new Date().toISOString(), perJobMB: Math.round(this.learnedMB), tasks: [...this.tasks.values()].map(({ log, ...t }) => ({ ...t, log: t.status === "error" ? log.slice(-8) : [] })) };
    await writeFile(`${this.o.ledger}.tmp`, JSON.stringify(body, null, 2) + "\n");
    await rename(`${this.o.ledger}.tmp`, this.o.ledger);
  }

  /** يقرأ سجلًا سابقًا: المهام الناجحة تبقى ناجحة، والفاشلة يمكن إعادتها وحدها */
  static async readLedger(file: string): Promise<{ perJobMB: number; tasks: Omit<TaskState, "log">[] } | null> {
    if (!existsSync(file)) return null;
    return JSON.parse(await readFile(file, "utf8"));
  }
}

/** طابور واحد للعملية كلها (الاستوديو يشارك به كل المهام الثقيلة) */
let shared: RenderPool | null = null;
export const sharedPool = (o?: PoolOptions) => (shared ??= new RenderPool(o));

/** عدد المهام المنتظرة قبل مهمة في الطابور (للعرض) */
export const queuePosition = (pool: RenderPool, id: string) => {
  let n = 0;
  for (const t of pool.tasks.values()) {
    if (t.id === id) return n;
    if (t.status === "queued") n++;
  }
  return n;
};
