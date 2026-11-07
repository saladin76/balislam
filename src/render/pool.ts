import os from "node:os";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { assertNoLinkedPath, ensureUnlinkedDirectory, publishOutputWithoutOverwrite } from "./fsIsolation";
import { spawn, type ChildProcess } from "node:child_process";

/**
 * طابور الرندر المشترك (الأمر 009، وقُوّي في الأمر 010).
 * - عدد المهام المتزامنة يُحسب لحظة بدء كل مهمة من الذاكرة الفعلية والأنوية وتقدير المهمة نفسها.
 * - تُراقب الذاكرة أثناء التشغيل: لا تبدأ مهمة جديدة تحت الاحتياطي، وعند الخطر تُوقف أحدث مهمة
 *   وتعود إلى الطابور (توقيف مقصود بدل أن يقتل النظام عملية عشوائية).
 * - سبب الفشل مصنَّف بالأدلة (FailureKind)، ومع كل فشل تفاصيله التشخيصية.
 * - الناتج يُكتب في ملف مؤقت فلا يُتلف الفشل نسخة سليمة سابقة، وإعادة المحاولة تعيد الفاشل وحده.
 * - السجل يحفظ وصف المهام؛ وعند إعادة تشغيل الاستوديو تُستعاد المنتظرة والمنقطعة (recover).
 */

/** ذاكرة الجهاز المتاحة بالميغابايت (حد الحاوية إن وُجد، وإلا ذاكرة النظام) */
export const memoryInfo = (): { totalMB: number; availableMB: number } => {
  const sys = { totalMB: os.totalmem() / 2 ** 20, availableMB: os.freemem() / 2 ** 20 };
  try {
    const avail = /MemAvailable:\s+(\d+)/.exec(readFileSync("/proc/meminfo", "utf8"));
    if (avail) sys.availableMB = Number(avail[1]) / 1024;
  } catch {
    /* غير لينكس */
  }
  const limit = (() => {
    try {
      const v2 = readFileSync("/sys/fs/cgroup/memory.max", "utf8").trim();
      if (v2 !== "max") return { limit: Number(v2), cur: Number(readFileSync("/sys/fs/cgroup/memory.current", "utf8")) };
    } catch {
      /* بلا cgroup v2 */
    }
    try {
      const v1 = Number(readFileSync("/sys/fs/cgroup/memory/memory.limit_in_bytes", "utf8"));
      if (v1 < 2 ** 60) return { limit: v1, cur: Number(readFileSync("/sys/fs/cgroup/memory/memory.usage_in_bytes", "utf8")) };
    } catch {
      /* بلا cgroup v1 */
    }
    return null;
  })();
  if (limit) return { totalMB: Math.min(sys.totalMB, limit.limit / 2 ** 20), availableMB: Math.min(sys.availableMB, (limit.limit - limit.cur) / 2 ** 20) };
  return sys;
};

/** عدّاد عمليات القتل لنفاد الذاكرة في الحاوية (cgroup v2 أو v1)؛ null إن لم يتوفر */
export const oomKillCount = (): number | null => {
  for (const f of ["/sys/fs/cgroup/memory.events", "/sys/fs/cgroup/memory/memory.oom_control"]) {
    try {
      const m = /oom_kill (\d+)/.exec(readFileSync(f, "utf8"));
      if (m) return Number(m[1]);
    } catch {
      /* غير متاح */
    }
  }
  return null;
};

/** أرقام العمليات التي قتلها النظام لنفاد الذاكرة بحسب سجل النواة (إن أمكن قراءته) */
export const kernelOomVictims = (): Set<number> => {
  try {
    const out = execFileSync("dmesg", [], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 });
    return new Set([...out.matchAll(/(?:Out of memory|Memory cgroup out of memory).*?Killed process (\d+)/g)].map((m) => Number(m[1])));
  } catch {
    return new Set();
  }
};

export type Capacity = { availableMB: number; cpus: number; running: number; runningMB: number; runningEstimateMB: number; nextMB: number; reserveMB: number };
/**
 * هل تبدأ مهمة جديدة الآن؟ الأولى تبدأ دائمًا (وإلا لن يعمل شيء). بعدها لا تبدأ مهمة إلا إذا:
 * لم يتجاوز العدد الأنوية، وبقي بعد ذروتها المتوقعة احتياطي للنظام، مع حساب ما ستحجزه المهام الجارية
 * حتى تبلغ ذروتها المتوقعة (لا ما حجزته الآن فقط).
 */
export const canStart = (c: Capacity) => {
  if (c.running === 0) return true;
  if (c.running >= Math.max(1, c.cpus)) return false;
  const pending = Math.max(0, c.runningEstimateMB - c.runningMB);
  return c.availableMB - pending - c.nextMB >= c.reserveMB;
};
/** التوازي الآمن على هذا الجهاز الآن (للتقارير) */
export const safeParallelism = (availableMB: number, cpus: number, perJobMB: number, reserveMB: number) =>
  Math.max(1, Math.min(cpus, Math.floor((availableMB - reserveMB) / perJobMB)));

/**
 * شجرة عملية من /proc: أرقام العملية وكل أبنائها، ومجموع ذاكرتها (م.ب)، ومجموع زمن المعالج (ثوانٍ)،
 * وأرقام عمليات المتصفح فيها (لرصد اختفائه أثناء المهمة).
 */
export type ProcTree = { pids: number[]; rssMB: number; cpuSeconds?: number; browserPids?: number[] };
export const processTree = (pid: number): ProcTree => {
  try {
    const kids = new Map<number, number[]>();
    const info = new Map<number, { rss: number; cpu: number; comm: string }>();
    const hz = 100;
    for (const d of readdirSync("/proc")) {
      if (!/^\d+$/.test(d)) continue;
      try {
        const st = readFileSync(`/proc/${d}/stat`, "utf8");
        const comm = st.slice(st.indexOf("(") + 1, st.lastIndexOf(")"));
        const f = st.slice(st.lastIndexOf(")") + 2).split(" ");
        info.set(Number(d), { rss: (Number(f[21]) * 4096) / 2 ** 20, cpu: (Number(f[11]) + Number(f[12])) / hz, comm });
        kids.set(Number(f[1]), [...(kids.get(Number(f[1])) ?? []), Number(d)]);
      } catch {
        /* انتهت العملية */
      }
    }
    if (!info.has(pid)) return { pids: [], rssMB: 0, cpuSeconds: 0, browserPids: [] };
    const pids: number[] = [];
    const browserPids: number[] = [];
    let sum = 0;
    let cpu = 0;
    const stack = [pid];
    while (stack.length) {
      const p = stack.pop()!;
      const i = info.get(p);
      pids.push(p);
      sum += i?.rss ?? 0;
      cpu += i?.cpu ?? 0;
      if (i && /chrom/i.test(i.comm)) browserPids.push(p);
      stack.push(...(kids.get(p) ?? []));
    }
    return { pids, rssMB: sum, cpuSeconds: cpu, browserPids };
  } catch {
    return { pids: [], rssMB: 0, cpuSeconds: 0, browserPids: [] };
  }
};
export const treeRssMB = (pid: number) => processTree(pid).rssMB;
/** وقت بدء العملية (للتمييز بين عملية قديمة ورقم أُعيد استعماله) */
const procStart = (pid: number): string | null => {
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  if (process.platform === "darwin") {
    // macOS has no /proc. lstart identifies the process incarnation rather than PID alone.
    // Never kill a recovered PID unless its recorded start time still matches.
    try {
      const started = execFileSync("/bin/ps", ["-p", String(pid), "-o", "lstart="], {
        encoding: "utf8", timeout: 1500, stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      return started ? `darwin:${started}` : null;
    } catch {
      return null;
    }
  }
  try {
    const st = readFileSync(`/proc/${pid}/stat`, "utf8");
    return st.slice(st.lastIndexOf(")") + 2).split(" ")[19] ?? null;
  } catch {
    return null;
  }
};
/**
 * إيقاف المهمة كلها: مجموعة عملياتها (تشمل ما خرج من الشجرة، كمتصفح أعاد تشغيل نفسه)، ثم كل الشجرة.
 */
const killTree = (pid: number, signal: NodeJS.Signals) => {
  try {
    process.kill(-pid, signal);
  } catch {
    /* ليست قائدة مجموعة أو انتهت */
  }
  for (const p of processTree(pid).pids.reverse()) {
    try {
      process.kill(p, signal);
    } catch {
      /* انتهت */
    }
  }
};

/**
 * سجل المهام الجارية على الجهاز كله (لا في هذه العملية وحدها): الاستوديو وأوامر الرندر قد تعمل معًا،
 * فكل طابور يحسب مهام غيره عند تقدير الذاكرة. ملف صغير لكل مهمة جارية، ويُهمل ملف عملية ميتة.
 */
const SLOTS = path.join(os.tmpdir(), "bal-render-slots");
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
export const hostSlots = {
  register(id: string, pid: number, estimateMB: number) {
    try {
      mkdirSync(SLOTS, { recursive: true });
      writeFileSync(path.join(SLOTS, `${process.pid}-${pid}.json`), JSON.stringify({ id, pid, owner: process.pid, estimateMB }));
    } catch {
      /* السجل المشترك اختياري */
    }
  },
  release(pid: number) {
    rmSync(path.join(SLOTS, `${process.pid}-${pid}.json`), { force: true });
  },
  /** مهام الطوابير الأخرى الجارية الآن */
  foreign(): { pid: number; estimateMB: number }[] {
    try {
      const out: { pid: number; estimateMB: number }[] = [];
      for (const f of readdirSync(SLOTS)) {
        const file = path.join(SLOTS, f);
        try {
          const s = JSON.parse(readFileSync(file, "utf8")) as { pid: number; owner: number; estimateMB: number };
          if (!alive(s.pid) || !alive(s.owner)) rmSync(file, { force: true });
          else if (s.owner !== process.pid) out.push({ pid: s.pid, estimateMB: s.estimateMB });
        } catch {
          rmSync(file, { force: true });
        }
      }
      return out;
    } catch {
      return [];
    }
  },
};

/** أنواع الفشل: كل نوع له دليله، وما لا دليل عليه «غير محدد» مع تفاصيله */
export type FailureKind = "oom" | "killed" | "timeout" | "browser-crash" | "render-error" | "cancelled" | "spawn-error" | "no-output" | "unknown";
export type Failure = {
  kind: FailureKind;
  message: string;
  /** ما بُني عليه التصنيف */
  evidence: string[];
  diagnostics: {
    code: number | null;
    signal: string | null;
    seconds?: number;
    peakMB: number;
    minAvailableMB: number;
    availableAtEndMB: number;
    oomKillsDuringTask: number | null;
    pids: number[];
    log: string[];
  };
};
export const FAILURE_LABEL: Record<FailureKind, string> = {
  oom: "نفاد الذاكرة (مثبت)",
  killed: "إيقاف قسري",
  timeout: "انتهاء المهلة",
  "browser-crash": "انهيار المتصفح",
  "render-error": "فشل التصيير",
  cancelled: "ألغاها المستخدم",
  "spawn-error": "تعذّر تشغيل المهمة",
  "no-output": "انتهت بلا ملف ناتج",
  unknown: "سبب غير محدد",
};

const OOM_SELF = /JavaScript heap out of memory|ENOMEM|Cannot allocate memory|std::bad_alloc|Out of memory/i;
const BROWSER = /Target closed|Page crashed|Browser (?:has )?(?:closed|crashed|disconnected)|Protocol error.*(?:closed|crash)|Failed to launch the browser|chrome.*crash|Navigation failed because browser has disconnected|Session closed/i;
const RENDER = /Error:|error:|خطأ|TypeError|ReferenceError|failed to render|Could not render|renderMedia|Composition/;

/**
 * تصنيف الفشل من أدلته. الترتيب: ما فعلناه نحن (إلغاء، مهلة)، ثم الدليل المثبت لنفاد الذاكرة،
 * ثم التعطل (بعد اختفاء المتصفح = انهياره، وإلا انتهاء مهلة التقدم)، ثم انهيار المتصفح من رسائله،
 * ثم الإيقاف القسري بلا دليل ذاكرة، ثم خطأ التصيير، وإلا «سبب غير محدد».
 * نفاد الذاكرة لا يُدّعى بلا دليل: قتل بإشارة مع ذاكرة منخفضة يبقى «إيقاف قسري» مع ملاحظة.
 */
export const classifyFailure = (input: {
  code: number | null;
  signal: NodeJS.Signals | null;
  log: string[];
  cancelled?: boolean;
  timedOut?: { ms: number };
  /** توقفت عن التقدم (لا استهلاك للمعالج) مدة طويلة فأوقفها الطابور */
  stalled?: { ms: number };
  /** اختفت عمليات المتصفح أثناء المهمة والعملية الأم حية */
  browserLost?: boolean;
  oomKillsDuringTask?: number | null;
  kernelVictims?: number[];
  pids?: number[];
  peakMB?: number;
  minAvailableMB?: number;
  availableAtEndMB?: number;
  reserveMB?: number;
  seconds?: number;
}): Failure => {
  const diagnostics: Failure["diagnostics"] = {
    code: input.code,
    signal: input.signal,
    seconds: input.seconds,
    peakMB: Math.round(input.peakMB ?? 0),
    minAvailableMB: Math.round(input.minAvailableMB ?? Infinity),
    availableAtEndMB: Math.round(input.availableAtEndMB ?? Infinity),
    oomKillsDuringTask: input.oomKillsDuringTask ?? null,
    pids: input.pids ?? [],
    log: input.log.slice(-20),
  };
  const ev: string[] = [];
  const text = input.log.join("\n");
  const peak = `${diagnostics.peakMB} م.ب`;
  const mk = (kind: FailureKind, message: string): Failure => ({ kind, message, evidence: ev, diagnostics });
  if (input.cancelled) return ev.push("طلب إلغاء من المستخدم"), mk("cancelled", "ألغيت المهمة بطلب المستخدم؛ لم يُتلف أي ناتج سابق.");
  if (input.timedOut) return ev.push(`تجاوزت المهلة ${Math.round(input.timedOut.ms / 1000)} ث`), mk("timeout", `انتهت المهلة (${Math.round(input.timedOut.ms / 1000)} ث) فأوقفها الطابور؛ ذروتها ${peak}.`);
  const victim = (input.kernelVictims ?? []).find((p) => (input.pids ?? []).includes(p));
  if (victim !== undefined) ev.push(`سجل النواة: قتل العملية ${victim} من هذه المهمة لنفاد الذاكرة`);
  if ((input.oomKillsDuringTask ?? 0) > 0) ev.push(`عداد نفاد الذاكرة في الحاوية زاد ${input.oomKillsDuringTask} أثناء المهمة`);
  const self = input.log.find((l) => OOM_SELF.test(l));
  if (self) ev.push(`العملية أبلغت: ${self.slice(0, 160)}`);
  if (ev.length) return mk("oom", `نفدت الذاكرة (مثبت): ${ev[0]}. ذروة المهمة ${peak}. أعد المحاولة بتوازٍ أقل.`);
  if (input.stalled && input.browserLost)
    return ev.push("عمليات المتصفح اختفت أثناء الرندر", `ثم لا تقدم ${Math.round(input.stalled.ms / 1000)} ث`), mk("browser-crash", `انهار المتصفح أثناء الرندر فتعطلت المهمة (لا تقدم منذ ${Math.round(input.stalled.ms / 1000)} ث) وأوقفها الطابور.`);
  if (input.stalled) return ev.push(`لا استهلاك للمعالج ${Math.round(input.stalled.ms / 1000)} ث`), mk("timeout", `تعطلت المهمة: لا تقدم منذ ${Math.round(input.stalled.ms / 1000)} ث فأوقفها الطابور (انتهاء مهلة التقدم).`);
  const crash = input.log.find((l) => BROWSER.test(l));
  if (crash) return ev.push(crash.slice(0, 160)), mk("browser-crash", `انهار المتصفح أثناء الرندر: ${crash.slice(0, 160)}`);
  if (input.browserLost && input.code !== 0 && !input.signal) return ev.push("عمليات المتصفح اختفت أثناء الرندر"), mk("browser-crash", "انهار المتصفح أثناء الرندر (اختفت عملياته) ثم فشلت المهمة.");
  const lowMem = (input.minAvailableMB ?? Infinity) < (input.reserveMB ?? 900);
  if (input.signal || input.code === 137 || input.code === 143) {
    ev.push(`أُوقفت بالإشارة ${input.signal ?? (input.code === 137 ? "SIGKILL (137)" : "SIGTERM (143)")} من خارج الطابور`);
    const note = lowMem ? ` كانت الذاكرة المتاحة منخفضة (${diagnostics.minAvailableMB} م.ب)، فقد يكون السبب نفادها، لكن لا دليل مثبتًا.` : "";
    return mk("killed", `أُوقفت العملية قسرًا (${input.signal ?? input.code}) دون دليل على نفاد الذاكرة.${note}`);
  }
  const err = [...input.log].reverse().find((l) => RENDER.test(l));
  if (input.code !== 0 && err) return ev.push(err.slice(0, 200)), mk("render-error", `فشل التصيير (رمز ${input.code}): ${err.slice(0, 200)}`);
  return mk("unknown", `سبب غير محدد: انتهت العملية برمز ${input.code ?? "؟"} دون رسالة تدل على السبب؛ التفاصيل محفوظة في السجل.`);
};
/** للتوافق مع الأمر 009 */
export const failureReason = (code: number | null, signal: NodeJS.Signals | null, tail: string[], peakMB: number) => classifyFailure({ code, signal, log: tail, peakMB }).message;

/** وصف المهمة القابل للحفظ (يُستعاد بعد إعادة التشغيل) */
export type TaskDef = {
  id: string;
  /** الأمر وما يليه: يُشغَّل بلا shell */
  cmd: string;
  args: string[];
  cwd: string;
  /** الملف الناتج: يُكتب أولًا في ملف مؤقت ثم يُنقل مكانه عند النجاح فقط */
  output?: string;
  /** موضع اسم الملف الناتج في args (يُستبدل بالمؤقت) */
  outputArg?: number;
  /** نوع التكلفة: مهام النوع نفسه تتشارك تقدير الذاكرة (مثلًا معرّف التكوين أو نوع مهمة الاستوديو) */
  costKey?: string;
  /** تقدير أولي لذروة هذه المهمة (م.ب) إن عُرف */
  estimateMB?: number;
  /** مهلة قصوى (مللي ثانية) */
  timeoutMs?: number;
  /** مهلة التقدم: إن لم تستهلك المهمة معالجًا يُذكر هذه المدة تُعد معطلة وتُوقف (مللي ثانية؛ 0 يعطلها) */
  stallMs?: number;
  /** بيانات يحتاجها من يستعيد المهمة (مثل بطاقة المهمة في الاستوديو) */
  meta?: Record<string, unknown>;
};
export type TaskSpec = TaskDef & {
  /** متغيرات البيئة: لا تُحفظ في السجل أبدًا (قد تحمل أسرارًا) */
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
  status: "queued" | "running" | "done" | "error" | "cancelled";
  attempts: number;
  queuedAt: number;
  startedAt?: number;
  endedAt?: number;
  seconds?: number;
  peakMB?: number;
  error?: string;
  failure?: Failure;
  output?: string;
  /** المخرج الجزئي الذي تملكه هذه المحاولة وحدها، للاستعادة والإلغاء الآمنين. */
  partialOutput?: string;
  /** أُوقفت مؤقتًا وأُعيدت إلى الطابور لحماية الذاكرة (لا تُحسب محاولة فاشلة) */
  preemptions?: number;
  /** استُعيدت بعد إعادة تشغيل */
  recovered?: boolean;
  pid?: number;
  pidStart?: string | null;
  log: string[];
};

export type PoolOptions = {
  /** ملف حالة الطابور (يبقى بعد انتهاء العملية: من نجح ومن فشل ولماذا، ووصف المنتظر لاستعادته) */
  ledger?: string;
  /** احتياطي يُترك للنظام وللاستوديو (م.ب) */
  reserveMB?: number;
  /** تقدير أولي لذروة المهمة الواحدة قبل أن يقيسها الطابور (م.ب) */
  perJobMB?: number;
  /** هامش أمان فوق أعلى ذروة مقيسة لنوع المهمة */
  safety?: number;
  /** حد أعلى يفرضه المستخدم (اختياري)؛ الحد الفعلي هو الأصغر بينه وبين ما تسمح به الموارد */
  maxParallel?: number;
  cpus?: number;
  memory?: () => { availableMB: number };
  oomCount?: () => number | null;
  oomVictims?: () => Set<number>;
  onChange?: (t: TaskState) => void;
  /** للاختبار: تشغيل مهمة بدل spawn */
  spawnFn?: (spec: TaskSpec, args: string[]) => ChildProcess;
  /** للاختبار: شجرة العملية وذاكرتها */
  tree?: (pid: number) => ProcTree;
  /** مهلة التقدم الافتراضية لكل مهمة (مللي ثانية)؛ الافتراضي 5 دقائق */
  stallMs?: number;
  /** مهام الطوابير الأخرى على الجهاز (الافتراضي: السجل المشترك؛ الاختبارات تمرر غيره) */
  foreign?: () => { pid: number; estimateMB: number }[];
  pollMs?: number;
};

type Running = {
  child: ChildProcess;
  peak: number;
  pids: Set<number>;
  minAvail: number;
  oom0: number | null;
  cancelled?: boolean;
  timedOut?: { ms: number };
  stalled?: { ms: number };
  preempted?: boolean;
  timer?: NodeJS.Timeout;
  /** آخر زمن معالج رُصد ولحظة آخر تقدم */
  cpu: number;
  progressAt: number;
  browsers: Set<number>;
  browserLost?: boolean;
};

export class RenderPool {
  readonly tasks = new Map<string, TaskState>();
  private specs = new Map<string, TaskSpec>();
  private running = new Map<string, Running>();
  private waiters: (() => void)[] = [];
  private learnedMB: number;
  /** أعلى ذروة مقيسة لكل نوع تكلفة */
  private costPeaks = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;
  constructor(private o: PoolOptions = {}) {
    this.learnedMB = o.perJobMB ?? 1800;
  }

  /** ذروة مهمة واحدة المقيسة حتى الآن (عامة)، ويبدأ بالتقدير */
  get perJobMB() {
    return this.learnedMB;
  }
  private get reserve() {
    return this.o.reserveMB ?? 900;
  }

  /**
   * الذروة المتوقعة لمهمة: أعلى ما قيس لنوعها × هامش الأمان، ولا تقل عن تقديرها المعلن،
   * وبلا قياس لنوعها: التقدير العام. ليست متوسطًا: المشهد الأثقل يحدد السقف.
   */
  estimateFor(spec: TaskDef) {
    const peak = spec.costKey ? this.costPeaks.get(spec.costKey) : undefined;
    const safety = this.o.safety ?? 1.15;
    // نوع لم يُقس بعد: أثقل ما رُصد في أي نوع (مع الهامش)، لا متوسطًا يتناقص بعد مشاهد خفيفة
    const heaviest = Math.max(0, ...this.costPeaks.values());
    const unknown = Math.max(this.learnedMB, heaviest * safety);
    return Math.max(spec.estimateMB ?? 0, peak !== undefined ? peak * safety : unknown);
  }

  add(spec: TaskSpec) {
    const prev = this.tasks.get(spec.id);
    if (prev && (prev.status === "running" || prev.status === "queued")) return prev;
    this.specs.set(spec.id, spec);
    const t: TaskState = { id: spec.id, status: "queued", attempts: prev?.attempts ?? 0, queuedAt: Date.now(), log: [], ...(prev?.preemptions ? { preemptions: prev.preemptions } : {}) };
    this.tasks.set(spec.id, t);
    this.emit(t);
    void this.save();
    this.pump();
    return t;
  }

  /** إلغاء مهمة منتظرة أو جارية بطلب المستخدم */
  cancel(id: string) {
    const t = this.tasks.get(id);
    if (!t) return false;
    if (t.status === "queued") {
      t.status = "cancelled";
      t.failure = classifyFailure({ code: null, signal: null, log: [], cancelled: true });
      t.error = t.failure.message;
      this.emit(t);
      this.specs.get(id)?.onEnd?.(t);
      void this.save();
      this.wake();
      return true;
    }
    const r = this.running.get(id);
    if (!r) return false;
    r.cancelled = true;
    this.stop(r);
    return true;
  }

  /** إعادة الفاشل وحده (أو مهام بعينها) دون لمس الناجح */
  retryFailed(ids?: string[]) {
    const again = [...this.tasks.values()].filter((t) => (t.status === "error" || t.status === "cancelled") && (!ids || ids.includes(t.id)) && this.specs.has(t.id));
    for (const t of again) this.add(this.specs.get(t.id)!);
    return again.map((t) => t.id);
  }

  /** ينتظر حتى تفرغ كل المهام (نجاحًا أو فشلًا) */
  idle(): Promise<void> {
    if (!this.busy()) return Promise.resolve();
    return new Promise((r) => this.waiters.push(r));
  }
  private busy() {
    return [...this.tasks.values()].some((t) => t.status === "queued" || t.status === "running");
  }
  private wake() {
    if (!this.busy()) {
      this.ensureTimer();
      for (const w of this.waiters.splice(0)) w();
    }
  }

  private capacity(next: TaskDef): Capacity {
    const mem = (this.o.memory ?? memoryInfo)();
    let runningMB = 0;
    let runningEstimateMB = 0;
    for (const [id, r] of this.running) {
      runningMB += r.peak;
      // ما ستبلغه المهمة الجارية: الأكبر بين تقديرها وما بلغته فعلًا (المشهد الأثقل من المتوقع يرفع السقف فورًا)
      runningEstimateMB += Math.max(r.peak * 1.05, this.estimateFor(this.specs.get(id)!));
    }
    // مهام الطوابير الأخرى (الاستوديو وأوامر الرندر معًا) تُحسب جارية بتقديرها
    const others = (this.o.foreign ?? (this.o.spawnFn ? () => [] : hostSlots.foreign))();
    for (const f of others) {
      const rss = (this.o.tree ?? processTree)(f.pid).rssMB;
      runningMB += rss;
      runningEstimateMB += Math.max(rss * 1.05, f.estimateMB);
    }
    return { availableMB: mem.availableMB, cpus: this.o.cpus ?? os.cpus().length, running: this.running.size + others.length, runningMB, runningEstimateMB, nextMB: this.estimateFor(next), reserveMB: this.reserve };
  }

  private pump() {
    for (const t of this.tasks.values()) {
      if (t.status !== "queued") continue;
      if (this.o.maxParallel && this.running.size >= this.o.maxParallel) break;
      if (!canStart(this.capacity(this.specs.get(t.id)!))) break;
      this.start(t);
    }
    this.ensureTimer();
  }

  /** مراقبة دورية: ذروة كل مهمة وأدنى ذاكرة متاحة، والتوقيف المقصود عند الخطر */
  private tick() {
    const tree = this.o.tree ?? processTree;
    const avail = (this.o.memory ?? memoryInfo)().availableMB;
    const now = Date.now();
    for (const [id, r] of this.running) {
      const t = tree(r.child.pid ?? -1);
      r.peak = Math.max(r.peak, t.rssMB);
      for (const p of t.pids) r.pids.add(p);
      r.minAvail = Math.min(r.minAvail, avail);
      // اختفاء عمليات المتصفح أثناء المهمة (والعملية الأم حية): دليل انهيار
      if (t.browserPids) {
        if (t.pids.length && [...r.browsers].some((p) => !t.browserPids!.includes(p))) r.browserLost = true;
        for (const p of t.browserPids) r.browsers.add(p);
        for (const p of [...r.browsers]) if (!t.browserPids.includes(p)) r.browsers.delete(p);
      }
      // التقدم: معدل استهلاك المعالج منذ آخر تقدم أعلى من 10% من نواة. الرندر الفعلي يستهلك 50% فأكثر،
      // والعملية العالقة الحية (مؤقتات ونبضات المتصفح) نحو 1–2%، فالحد يفصل بينهما بوضوح
      if (t.cpuSeconds !== undefined) {
        const dt = (now - r.progressAt) / 1000;
        if (t.cpuSeconds - r.cpu > Math.max(0.05, 0.1 * dt)) {
          r.cpu = t.cpuSeconds;
          r.progressAt = now;
        }
      }
      const stall = this.specs.get(id)?.stallMs ?? this.o.stallMs ?? 5 * 60_000;
      if (stall > 0 && !r.stalled && !r.cancelled && now - r.progressAt > stall) {
        r.stalled = { ms: now - r.progressAt };
        this.stop(r);
      }
    }
    // خطر: الذاكرة دون نصف الاحتياطي ومعها أكثر من مهمة: تُوقف أحدثها وتعود إلى الطابور
    if (avail < this.reserve / 2 && this.running.size > 1) {
      // الأحدث بدءًا: الأخير في ترتيب البدء (لا بالوقت، فمهمتان قد تبدآن في اللحظة نفسها)
      const newest = [...this.running.entries()].filter(([, r]) => !r.preempted && !r.cancelled).pop();
      if (newest) {
        newest[1].preempted = true;
        this.stop(newest[1]);
      }
    }
    this.pump();
  }

  private ensureTimer() {
    const busy = this.running.size > 0 || [...this.tasks.values()].some((t) => t.status === "queued");
    if (busy && !this.timer) {
      // مؤقت «حيّ» عمدًا: مهام منتظرة بلا عملية جارية (تنتظر ذاكرة يحجزها طابور آخر) يجب أن تبقي البرنامج حيًا،
      // وإلا خرج Node بنجاح صامت تاركًا المنتظر بلا تشغيل. يُلغى المؤقت حين لا يبقى منتظر ولا جارٍ.
      this.timer = setInterval(() => this.tick(), this.o.pollMs ?? 500);
    } else if (!busy && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** إيقاف مهمة جارية وكل أبنائها: SIGTERM ثم SIGKILL بعد مهلة قصيرة */
  private stop(r: Running) {
    const pid = r.child.pid;
    if (this.o.spawnFn || pid === undefined) {
      r.child.kill("SIGTERM");
      return;
    }
    killTree(pid, "SIGTERM");
    setTimeout(() => killTree(pid, "SIGKILL"), 3000).unref?.();
  }

  private start(t: TaskState) {
    const spec = this.specs.get(t.id)!;
    const tmp = spec.output ? `${spec.output}.part-${randomUUID()}${path.extname(spec.output)}` : undefined;
    const args = [...spec.args];
    if (tmp && spec.outputArg !== undefined) args[spec.outputArg] = tmp;
    t.status = "running";
    t.partialOutput = tmp;
    t.attempts += 1;
    t.startedAt = Date.now();
    t.error = undefined;
    t.failure = undefined;
    t.log = [];
    this.emit(t);
    spec.onStart?.();
    // مجموعة عمليات خاصة بالمهمة (detached): إيقافها يصل إلى كل ما أطلقته، ولو خرج من شجرتها
    const child = this.o.spawnFn ? this.o.spawnFn(spec, args) : spawn(spec.cmd, args, { cwd: spec.cwd, env: spec.env ?? process.env, detached: true });
    t.pid = child.pid;
    t.pidStart = child.pid !== undefined && !this.o.spawnFn ? procStart(child.pid) : null;
    const rec: Running = { child, peak: 0, pids: new Set(child.pid !== undefined ? [child.pid] : []), minAvail: Infinity, oom0: (this.o.oomCount ?? oomKillCount)(), cpu: 0, progressAt: Date.now(), browsers: new Set() };
    this.running.set(t.id, rec);
    if (!this.o.spawnFn && child.pid !== undefined) hostSlots.register(t.id, child.pid, this.estimateFor(spec));
    if (spec.timeoutMs) {
      rec.timer = setTimeout(() => {
        rec.timedOut = { ms: spec.timeoutMs! };
        this.stop(rec);
      }, spec.timeoutMs);
      rec.timer.unref?.();
    }
    void this.save();
    const onData = (d: Buffer) => {
      for (const line of d.toString().split("\n")) {
        if (!line.trim()) continue;
        t.log.push(line.trim());
        if (t.log.length > 60) t.log.shift();
        spec.onLine?.(line.trim());
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    const finish = async (code: number | null, signal: NodeJS.Signals | null, spawnError?: Error) => {
      if (!this.running.has(t.id)) return;
      this.running.delete(t.id);
      if (rec.timer) clearTimeout(rec.timer);
      // لا تبقى عملية شاردة من المهمة بعد انتهائها (متصفح يتيم مثلًا): تُوقف مجموعتها كلها
      if (!this.o.spawnFn && child.pid !== undefined) {
        hostSlots.release(child.pid);
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          /* لا أحد بقي */
        }
      }
      t.endedAt = Date.now();
      t.seconds = (t.endedAt - (t.startedAt ?? t.endedAt)) / 1000;
      t.peakMB = Math.round(rec.peak);
      if (rec.peak > 0) {
        this.learnedMB = Math.max(this.learnedMB * 0.5, rec.peak, rec.peak * 0.7 + this.learnedMB * 0.3);
        if (spec.costKey) this.costPeaks.set(spec.costKey, Math.max(this.costPeaks.get(spec.costKey) ?? 0, rec.peak));
      }
      if (rec.preempted && !rec.cancelled) {
        // توقيف مقصود لحماية الذاكرة: تعود إلى الطابور، ولا تُحسب محاولة
        if (tmp) await rm(tmp, { force: true });
        t.partialOutput = undefined;
        t.attempts -= 1;
        t.preemptions = (t.preemptions ?? 0) + 1;
        t.status = "queued";
        t.log.push("أُوقفت مؤقتًا لحماية الذاكرة وأُعيدت إلى الطابور");
        this.emit(t);
        await this.save();
        this.pump();
        return;
      }
      if (code === 0 && !spawnError && !rec.cancelled && !rec.timedOut && !rec.stalled) {
        if (tmp && spec.output) {
          if (existsSync(tmp)) {
            try {
              // Atomic no-clobber publication; identical output names from two
              // workers become distinct versions rather than replacing one another.
              t.output = await publishOutputWithoutOverwrite(tmp, spec.output);
              t.status = "done";
            } catch (e) {
              t.status = "error";
              t.failure = { kind: "no-output", message: `فشل نشر الملف دون استبدال مخرج سابق: ${(e as Error).message}`, evidence: [tmp], diagnostics: classifyFailure({ code, signal, log: t.log }).diagnostics };
              t.error = t.failure.message;
              await rm(tmp, { force: true });
            }
          } else {
            t.status = "error";
            t.failure = { kind: "no-output", message: "انتهت العملية بنجاح لكن بلا ملف ناتج.", evidence: [`لا يوجد ${tmp}`], diagnostics: classifyFailure({ code, signal, log: t.log }).diagnostics };
            t.error = t.failure.message;
          }
        } else t.status = "done";
      } else {
        const oom1 = (this.o.oomCount ?? oomKillCount)();
        const victims = signal || code === 137 || rec.browserLost || /Target closed|crash/i.test(t.log.join("\n")) ? [...(this.o.oomVictims ?? kernelOomVictims)()] : [];
        t.failure = spawnError
          ? { kind: "spawn-error", message: `تعذّر تشغيل المهمة: ${spawnError.message}`, evidence: [spawnError.message], diagnostics: classifyFailure({ code, signal, log: t.log }).diagnostics }
          : classifyFailure({
              code,
              signal,
              log: t.log,
              ...(rec.cancelled ? { cancelled: true } : {}),
              ...(rec.timedOut ? { timedOut: rec.timedOut } : {}),
              ...(rec.stalled ? { stalled: rec.stalled } : {}),
              ...(rec.browserLost ? { browserLost: true } : {}),
              oomKillsDuringTask: rec.oom0 !== null && oom1 !== null ? oom1 - rec.oom0 : null,
              kernelVictims: victims,
              pids: [...rec.pids],
              peakMB: rec.peak,
              minAvailableMB: rec.minAvail,
              availableAtEndMB: (this.o.memory ?? memoryInfo)().availableMB,
              reserveMB: this.reserve,
              seconds: t.seconds,
            });
        t.status = t.failure.kind === "cancelled" ? "cancelled" : "error";
        t.error = t.failure.message;
        // الناتج الجزئي يُحذف؛ والناتج السليم السابق (إن وجد) يبقى كما هو
        if (tmp) await rm(tmp, { force: true });
      }
      t.partialOutput = undefined;
      this.emit(t);
      spec.onEnd?.(t);
      await this.save();
      this.pump();
      this.wake();
    };
    child.on("error", (e) => void finish(null, null, e));
    child.on("close", (code, signal) => void finish(code, signal));
    // الانتهاء من خروج العملية نفسها: إن أبقت عملية شاردة مجاري المخرجات مفتوحة فلن يأتي close أبدًا
    child.on("exit", (code, signal) => {
      setTimeout(() => void finish(code, signal), 1500).unref?.();
    });
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
    await ensureUnlinkedDirectory(path.dirname(this.o.ledger));
    const def = (id: string): TaskDef | undefined => {
      const s = this.specs.get(id);
      if (!s) return undefined;
      const { env: _env, onLine: _l, onStart: _s, onEnd: _e, ...d } = s;
      return d;
    };
    const body = {
      updatedAt: new Date().toISOString(),
      perJobMB: Math.round(this.learnedMB),
      costPeaks: Object.fromEntries([...this.costPeaks].map(([k, v]) => [k, Math.round(v)])),
      tasks: [...this.tasks.values()].map(({ log, ...t }) => ({ ...t, log: t.status === "error" ? log.slice(-8) : [], def: def(t.id) })),
    };
    const pending = `${this.o.ledger}.tmp-${randomUUID()}`;
    try {
      await writeFile(pending, JSON.stringify(body, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      // Ledger atomic replacement is internal queue state, NOT a published video.
      await rename(pending, this.o.ledger);
    } finally {
      await rm(pending, { force: true });
    }
  }

  /** يقرأ سجلًا سابقًا: المهام الناجحة تبقى ناجحة، والفاشلة يمكن إعادتها وحدها */
  static async readLedger(file: string): Promise<{ perJobMB: number; costPeaks?: Record<string, number>; tasks: (Omit<TaskState, "log"> & { def?: TaskDef })[] } | null> {
    if (!existsSync(file)) return null;
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch (e) {
      throw new Error(`سجل طابور الرندر موجود لكنه غير صالح، لن نتجاهل مهامًا قد تكون قيد التشغيل: ${(e as Error).message}`);
    }
  }

  /**
   * الاستعادة بعد إعادة التشغيل: يقرأ السجل، فيبقي المنتهي سجلًا كما هو، ويعيد المنتظر إلى الطابور،
   * والمنقطع (كان يعمل حين توقفت العملية الأم): إن بقيت عمليته القديمة حية فهي يتيمة لا يقرأ أحد ناتجها،
   * فتُوقف أولًا حتى لا تكتب عمليتان في الملف المؤقت نفسه، ثم تعود المهمة إلى الطابور.
   * attach يعيد ربط المهمة بمن يعرضها (بطاقة الاستوديو) ويعطيها callbacks جديدة؛ ويعيد null لتجاهلها.
   */
  async recover(attach: (def: TaskDef, prev: Omit<TaskState, "log">) => TaskSpec | null): Promise<{ requeued: string[]; killedOrphans: number[]; kept: number }> {
    const ledger = this.o.ledger ? await RenderPool.readLedger(this.o.ledger) : null;
    const out = { requeued: [] as string[], killedOrphans: [] as number[], kept: 0 };
    if (!ledger) return out;
    if (ledger.perJobMB) this.learnedMB = Math.max(this.learnedMB, ledger.perJobMB);
    for (const [k, v] of Object.entries(ledger.costPeaks ?? {})) this.costPeaks.set(k, v);
    const toQueue: TaskSpec[] = [];
    for (const t of ledger.tasks) {
      if (this.tasks.has(t.id)) continue;
      if (t.status === "queued" || t.status === "running") {
        const identity = t.status === "running" && t.pid !== undefined && t.pidStart
          ? procStart(t.pid) : null;
        if (identity !== null && identity === t.pidStart && t.pid !== undefined) {
          killTree(t.pid, "SIGTERM");
          await new Promise((r) => setTimeout(r, 1500));
          if (procStart(t.pid) === t.pidStart) {
            killTree(t.pid, "SIGKILL");
            await new Promise((r) => setTimeout(r, 300));
          }
          if (procStart(t.pid) === t.pidStart)
            throw new Error(`فشل إيقاف عملية الرندر السابقة ${t.pid}؛ يجب عدم حذف ملفها أو بدء مهمة بديلة.`);
          out.killedOrphans.push(t.pid);
        }
        // Without a confirmed process incarnation, a LIVE PID might belong to
        // another task. Fail closed rather than deleting its partial file.
        if (t.status === "running" && t.pid !== undefined && !t.pidStart) {
          try {
            process.kill(t.pid, 0);
            throw new Error(`تعذّر التحقق من ملكية عملية الرندر ${t.pid}؛ أُوقفت الاستعادة حفاظًا على ملفاتها.`);
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e;
          }
        }
        const spec = t.def ? attach(t.def, t) : null;
        if (!spec) continue;
        // Only a generated UUID partial with a matching output and safe parent
        // can be removed, after the old writer has verifiably stopped.
        const candidate = t.partialOutput;
        if (spec.output && candidate) {
          const ext = path.extname(spec.output);
          const uuidPart = candidate.slice(`${spec.output}.part-`.length, candidate.length - ext.length);
          if (candidate.startsWith(`${spec.output}.part-`) &&
              candidate.endsWith(ext) &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuidPart) &&
              path.dirname(candidate) === path.dirname(spec.output)) {
            try {
              await assertNoLinkedPath(candidate, true);
              await rm(candidate, { force: true });
            } catch (e) {
              if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
            }
          }
        }
        this.tasks.set(t.id, { ...t, status: "error", log: [] });
        toQueue.push(spec);
      } else {
        this.tasks.set(t.id, { ...t, log: [] });
        if (t.def) this.specs.set(t.id, t.def);
        out.kept++;
      }
    }
    for (const spec of toQueue) {
      const t = this.add(spec);
      t.recovered = true;
      out.requeued.push(spec.id);
    }
    await this.save();
    return out;
  }
}

/** عدد المهام المنتظرة قبل مهمة في الطابور (للعرض) */
export const queuePosition = (pool: RenderPool, id: string) => {
  let n = 0;
  for (const t of pool.tasks.values()) {
    if (t.id === id) return n;
    if (t.status === "queued") n++;
  }
  return n;
};
