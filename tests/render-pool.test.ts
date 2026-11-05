import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canStart, classifyFailure, RenderPool, safeParallelism, type TaskSpec } from "../src/render/pool";

/**
 * طابور الرندر (الأمران 009 و010): تحت ضغط مضبوط بعمليات وهمية تحاكي الذاكرة والفشل،
 * وبعمليات حقيقية لاختبار الاستعادة بعد إعادة التشغيل.
 */
type Fake = { ms: number; code?: number; signal?: NodeJS.Signals; writes?: boolean; lines?: string[]; mb?: number; hang?: boolean };
const harness = (availableMB: number, plan: Record<string, Fake>, perTaskMB = 1000) => {
  const running = new Map<number, number>();
  let peak = 0;
  let pidSeq = 1000;
  const started: string[] = [];
  const spawnFn = (spec: TaskSpec, args: string[]) => {
    const child = new EventEmitter() as never as import("node:child_process").ChildProcess & EventEmitter;
    const pid = ++pidSeq;
    const f = plan[spec.id] ?? { ms: 20 };
    let closed = false;
    const close = (code: number | null, signal: NodeJS.Signals | null) => {
      if (closed) return;
      closed = true;
      running.delete(pid);
      child.emit("close", code, signal);
    };
    Object.assign(child, { stdout: new EventEmitter(), stderr: new EventEmitter(), pid, kill: (sig: NodeJS.Signals) => setTimeout(() => close(null, sig), 2) });
    running.set(pid, f.mb ?? perTaskMB);
    peak = Math.max(peak, running.size);
    started.push(spec.id);
    if (!f.hang)
      setTimeout(() => {
        if (closed) return;
        if (f.writes !== false && spec.outputArg !== undefined) writeFileSync(args[spec.outputArg]!, "ok");
        for (const l of f.lines ?? []) (child.stderr as EventEmitter).emit("data", Buffer.from(l + "\n"));
        close(f.signal ? null : (f.code ?? 0), f.signal ?? null);
      }, f.ms);
    return child;
  };
  let used = () => [...running.values()].reduce((s, x) => s + x, 0);
  const memory = () => ({ availableMB: availableMB - used() });
  const tree = (pid: number) => ({ pids: [pid], rssMB: running.get(pid) ?? 0 });
  return { spawnFn, memory, tree, stats: () => ({ peak, started }), setUsed: (fn: () => number) => (used = fn) };
};
const dir = () => mkdtempSync(path.join(os.tmpdir(), "pool-"));
const spec = (d: string, id: string, extra: Partial<TaskSpec> = {}): TaskSpec => ({ id, cmd: "x", args: ["out", path.join(d, `${id}.mp4`)], cwd: d, output: path.join(d, `${id}.mp4`), outputArg: 1, ...extra });
const noEvidence = { oomCount: () => null, oomVictims: () => new Set<number>() };

describe("التوازي الآمن من الموارد", () => {
  it("يتبع الذاكرة وعدد الأنوية لا رقمًا ثابتًا", () => {
    expect(safeParallelism(7400, 2, 1800, 900)).toBe(2);
    expect(safeParallelism(7400, 8, 1800, 900)).toBe(3);
    expect(safeParallelism(31000, 8, 1800, 900)).toBe(8);
    expect(safeParallelism(1500, 8, 1800, 900)).toBe(1);
  });
  it("المهمة الأولى تبدأ دائمًا، والتالية فقط إذا بقي احتياطي بعد ذروة الجارية المتوقعة", () => {
    const c = { cpus: 4, running: 1, reserveMB: 900, nextMB: 1800 };
    expect(canStart({ ...c, availableMB: 500, running: 0, runningMB: 0, runningEstimateMB: 0 })).toBe(true);
    expect(canStart({ ...c, availableMB: 4000, runningMB: 1800, runningEstimateMB: 1800 })).toBe(true);
    // المهمة الجارية لم تبلغ ذروتها بعد: يُحسب ما ستحجزه
    expect(canStart({ ...c, availableMB: 4000, runningMB: 300, runningEstimateMB: 1800 })).toBe(false);
    expect(canStart({ ...c, cpus: 2, running: 2, availableMB: 9000, runningMB: 3600, runningEstimateMB: 3600 })).toBe(false);
  });
});

describe("تقدير الذاكرة يتعامل مع تفاوت المشاهد", () => {
  it("لكل نوع تكلفة ذروته المقيسة مع هامش؛ المشهد الأثقل لا يُخفيه متوسط الخفيفة", async () => {
    const d = dir();
    const h = harness(20000, { light1: { ms: 10, mb: 600 }, light2: { ms: 10, mb: 600 }, heavy: { ms: 10, mb: 3000 } });
    const pool = new RenderPool({ cpus: 1, perJobMB: 1000, memory: h.memory, tree: h.tree, spawnFn: h.spawnFn, pollMs: 2, ...noEvidence });
    pool.add(spec(d, "heavy", { costKey: "depth" }));
    pool.add(spec(d, "light1", { costKey: "plain" }));
    pool.add(spec(d, "light2", { costKey: "plain" }));
    await pool.idle();
    expect(pool.estimateFor({ id: "n", cmd: "", args: [], cwd: "", costKey: "depth" })).toBeGreaterThanOrEqual(3000 * 1.15 - 1);
    expect(pool.estimateFor({ id: "n", cmd: "", args: [], cwd: "", costKey: "plain" })).toBeLessThan(1000);
    // نوع لم يُقس بعد: التقدير العام (لا يقل عن أثقل ما رُصد حديثًا)
    expect(pool.estimateFor({ id: "n", cmd: "", args: [], cwd: "", costKey: "new" })).toBeGreaterThanOrEqual(1000);
  });

  it("عند انخفاض الذاكرة أثناء التشغيل لا تبدأ مهام جديدة", async () => {
    const d = dir();
    const h = harness(6000, { a: { ms: 60, mb: 4500 }, b: { ms: 10 } });
    const pool = new RenderPool({ cpus: 4, perJobMB: 1000, reserveMB: 900, memory: h.memory, tree: h.tree, spawnFn: h.spawnFn, pollMs: 2, ...noEvidence });
    pool.add(spec(d, "a"));
    await new Promise((r) => setTimeout(r, 15));
    pool.add(spec(d, "b"));
    await new Promise((r) => setTimeout(r, 20));
    // a تستهلك 4500 من 6000: b تنتظر
    expect(pool.tasks.get("b")!.status).toBe("queued");
    await pool.idle();
    expect(pool.tasks.get("b")!.status).toBe("done");
    expect(h.stats().peak).toBe(1);
  });

  it("خطر الذاكرة: أحدث مهمة تُوقف وتعود إلى الطابور (ليست فشلًا)، ثم تكتمل", async () => {
    const d = dir();
    const h = harness(5000, { a: { ms: 80, mb: 1200 }, b: { ms: 40, mb: 1200 } });
    const pool = new RenderPool({ cpus: 4, perJobMB: 1200, reserveMB: 900, memory: h.memory, tree: h.tree, spawnFn: h.spawnFn, pollMs: 2, ...noEvidence });
    pool.add(spec(d, "a"));
    pool.add(spec(d, "b"));
    await new Promise((r) => setTimeout(r, 10));
    // ضغط خارجي مفاجئ: يبقى أقل من نصف الاحتياطي
    h.setUsed(() => 4700);
    await new Promise((r) => setTimeout(r, 30));
    h.setUsed(() => 1200);
    await pool.idle();
    const b = pool.tasks.get("b")!;
    expect(b.preemptions).toBeGreaterThanOrEqual(1);
    expect(b.status).toBe("done");
    expect(b.attempts).toBe(1);
    expect(pool.tasks.get("a")!.status).toBe("done");
  });
});

describe("الطابور تحت الضغط", () => {
  it("عشر مهام على ذاكرة تكفي اثنتين: لا تتجاوز اثنتين معًا وتكتمل كلها", async () => {
    const d = dir();
    const h = harness(4700, {}, 1800);
    const pool = new RenderPool({ cpus: 8, perJobMB: 1800, reserveMB: 900, memory: h.memory, tree: h.tree, spawnFn: h.spawnFn, pollMs: 5, ...noEvidence });
    for (let i = 0; i < 10; i++) pool.add(spec(d, `t${i}`));
    await pool.idle();
    expect(h.stats().peak).toBeLessThanOrEqual(2);
    expect([...pool.tasks.values()].every((t) => t.status === "done")).toBe(true);
    for (let i = 0; i < 10; i++) expect(existsSync(path.join(d, `t${i}.mp4`))).toBe(true);
  });

  it("فشل مهمة لا يوقف غيرها، والناتج السليم السابق يبقى، والسبب محفوظ في السجل", async () => {
    const d = dir();
    writeFileSync(path.join(d, "b.mp4"), "previous-good");
    const h = harness(20000, { b: { ms: 15, code: 1, lines: ["Error: Composition not found"] } });
    const ledger = path.join(d, "q.json");
    const pool = new RenderPool({ cpus: 4, memory: h.memory, tree: h.tree, spawnFn: h.spawnFn, pollMs: 5, ledger, ...noEvidence });
    for (const id of ["a", "b", "c"]) pool.add(spec(d, id));
    await pool.idle();
    expect(pool.tasks.get("b")!.failure!.kind).toBe("render-error");
    expect(pool.tasks.get("a")!.status).toBe("done");
    expect(pool.tasks.get("c")!.status).toBe("done");
    expect(readFileSync(path.join(d, "b.mp4"), "utf8")).toBe("previous-good");
    expect(existsSync(path.join(d, "b.mp4.part.mp4"))).toBe(false);
    const saved = JSON.parse(readFileSync(ledger, "utf8"));
    const rec = saved.tasks.find((t: { id: string }) => t.id === "b");
    expect(rec.failure.kind).toBe("render-error");
    expect(rec.failure.diagnostics.log.join()).toContain("Composition not found");
    // لا تُحفظ متغيرات البيئة
    expect(JSON.stringify(saved)).not.toContain('"env"');
  });

  it("إعادة المحاولة تعيد الفاشل وحده، مرة واحدة", async () => {
    const d = dir();
    const plan: Record<string, Fake> = { y: { ms: 5, code: 1 } };
    const h = harness(20000, plan);
    const pool = new RenderPool({ cpus: 4, memory: h.memory, tree: h.tree, spawnFn: h.spawnFn, pollMs: 5, ...noEvidence });
    for (const id of ["x", "y", "z"]) pool.add(spec(d, id));
    await pool.idle();
    delete plan.y;
    expect(pool.retryFailed()).toEqual(["y"]);
    expect(pool.retryFailed()).toEqual([]);
    await pool.idle();
    expect(pool.tasks.get("y")!.status).toBe("done");
    expect(pool.tasks.get("y")!.attempts).toBe(2);
    expect(h.stats().started.filter((s) => s === "x")).toHaveLength(1);
    expect(h.stats().started.filter((s) => s === "y")).toHaveLength(2);
  });

  it("إضافة مهمة جارية مرة ثانية لا تكررها", async () => {
    const d = dir();
    const h = harness(20000, { a: { ms: 30 } });
    const pool = new RenderPool({ cpus: 4, memory: h.memory, tree: h.tree, spawnFn: h.spawnFn, pollMs: 5, ...noEvidence });
    pool.add(spec(d, "a"));
    pool.add(spec(d, "a"));
    await pool.idle();
    expect(h.stats().started).toEqual(["a"]);
  });
});

describe("تصنيف أسباب الفشل", () => {
  const base = { code: null, signal: null, log: [] as string[] };
  it("نفاد الذاكرة لا يُدّعى إلا بدليل", () => {
    // قتل بلا دليل: «إيقاف قسري» حتى مع ذاكرة منخفضة (مع ملاحظة)
    const k = classifyFailure({ ...base, signal: "SIGKILL", minAvailableMB: 300, reserveMB: 900 });
    expect(k.kind).toBe("killed");
    expect(k.message).toContain("لا دليل مثبتًا");
    // سجل النواة يسمي عملية من المهمة
    expect(classifyFailure({ ...base, signal: "SIGKILL", kernelVictims: [42], pids: [40, 42] }).kind).toBe("oom");
    // عملية أخرى قتلها النظام لا تُنسب لهذه المهمة
    expect(classifyFailure({ ...base, signal: "SIGKILL", kernelVictims: [99], pids: [40, 42] }).kind).toBe("killed");
    // عداد الحاوية زاد أثناء المهمة
    expect(classifyFailure({ ...base, code: 1, oomKillsDuringTask: 1 }).kind).toBe("oom");
    // العملية نفسها أبلغت
    expect(classifyFailure({ ...base, code: 134, log: ["FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory"] }).kind).toBe("oom");
  });
  it("المهلة والإلغاء يتقدمان على كل شيء (نحن من أوقفها)", () => {
    expect(classifyFailure({ ...base, signal: "SIGTERM", timedOut: { ms: 60000 } }).kind).toBe("timeout");
    expect(classifyFailure({ ...base, signal: "SIGTERM", cancelled: true, oomKillsDuringTask: 1 }).kind).toBe("cancelled");
  });
  it("انهيار المتصفح وفشل التصيير وغير المحدد", () => {
    expect(classifyFailure({ ...base, code: 1, log: ["Error: Protocol error (Runtime.callFunctionOn): Target closed."] }).kind).toBe("browser-crash");
    expect(classifyFailure({ ...base, code: 1, log: ["TypeError: Cannot read properties of undefined"] }).kind).toBe("render-error");
    const u = classifyFailure({ ...base, code: 3, log: ["something odd"], peakMB: 1234 });
    expect(u.kind).toBe("unknown");
    expect(u.message).toContain("سبب غير محدد");
    expect(u.diagnostics.log).toEqual(["something odd"]);
    expect(u.diagnostics.peakMB).toBe(1234);
  });
});

describe("المهلة والإلغاء داخل الطابور", () => {
  it("مهمة معلقة تُوقف عند مهلتها وتُصنف «انتهاء المهلة»", async () => {
    const d = dir();
    const h = harness(20000, { slow: { ms: 0, hang: true } });
    const pool = new RenderPool({ cpus: 2, memory: h.memory, tree: h.tree, spawnFn: h.spawnFn, pollMs: 5, ...noEvidence });
    pool.add(spec(d, "slow", { timeoutMs: 40 }));
    await pool.idle();
    expect(pool.tasks.get("slow")!.failure!.kind).toBe("timeout");
  });
  it("إلغاء الجارية والمنتظرة: «ألغاها المستخدم»، والباقي يكمل", async () => {
    const d = dir();
    const h = harness(20000, { run: { ms: 0, hang: true }, wait: { ms: 10 }, other: { ms: 10 } });
    const pool = new RenderPool({ cpus: 1, memory: h.memory, tree: h.tree, spawnFn: h.spawnFn, pollMs: 5, ...noEvidence });
    pool.add(spec(d, "run"));
    pool.add(spec(d, "wait"));
    pool.add(spec(d, "other"));
    expect(pool.cancel("wait")).toBe(true);
    expect(pool.cancel("run")).toBe(true);
    await pool.idle();
    expect(pool.tasks.get("run")!.status).toBe("cancelled");
    expect(pool.tasks.get("wait")!.status).toBe("cancelled");
    expect(pool.tasks.get("other")!.status).toBe("done");
    expect(h.stats().started).not.toContain("wait");
  });
});

describe("الاستعادة بعد إعادة التشغيل (عمليات حقيقية)", () => {
  const nodeTask = (d: string, id: string, ms: number): TaskSpec => ({
    id,
    cmd: process.execPath,
    // يكتب الناتج بعد مدة: عملية حقيقية تمثل الرندر
    args: ["-e", `setTimeout(()=>require("fs").writeFileSync(process.argv[1], "${id}-" + process.pid), ${ms})`, path.join(d, `${id}.mp4`)],
    cwd: d,
    output: path.join(d, `${id}.mp4`),
    outputArg: 2,
    costKey: "probe",
    estimateMB: 10,
    meta: { kind: "probe" },
  });

  it("المنتظرة والمنقطعة تُستعاد، واليتيمة تُوقف قبل الإعادة، والمنتهية لا تُعاد ولا يتلف ناتجها", async () => {
    const d = dir();
    const ledger = path.join(d, "studio-queue.json");
    // «الاستوديو الأول»: مهمة تنتهي، وأخرى تعمل طويلًا، وثالثة تنتظر
    const p1 = new RenderPool({ ledger, cpus: 2, maxParallel: 2, pollMs: 20, ...noEvidence });
    p1.add(nodeTask(d, "finished", 10));
    await new Promise((r) => setTimeout(r, 600));
    expect(p1.tasks.get("finished")!.status).toBe("done");
    const finishedBytes = readFileSync(path.join(d, "finished.mp4"), "utf8");
    p1.add(nodeTask(d, "long", 60000));
    p1.add(nodeTask(d, "long2", 60000));
    p1.add(nodeTask(d, "waiting", 10));
    await new Promise((r) => setTimeout(r, 400));
    const orphanPid = p1.tasks.get("long")!.pid!;
    expect(p1.tasks.get("waiting")!.status).toBe("queued");
    await p1.save();
    // «انهيار» الاستوديو: لا تنظيف (العمليات تبقى يتيمة)، ثم استوديو جديد يقرأ السجل نفسه
    const alive = (pid: number) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    expect(alive(orphanPid)).toBe(true);
    const p2 = new RenderPool({ ledger, cpus: 2, maxParallel: 2, pollMs: 20, ...noEvidence });
    const seen: string[] = [];
    const r = await p2.recover((def) => {
      seen.push(def.id);
      // المهام الطويلة صارت قصيرة لتكتمل في الاختبار
      return def.id.startsWith("long") ? nodeTask(d, def.id, 30) : nodeTask(d, def.id, 10);
    });
    expect(r.requeued.sort()).toEqual(["long", "long2", "waiting"]);
    expect(r.killedOrphans).toContain(orphanPid);
    expect(alive(orphanPid)).toBe(false);
    expect(seen).not.toContain("finished");
    await p2.idle();
    for (const id of ["long", "long2", "waiting"]) {
      expect(p2.tasks.get(id)!.status).toBe("done");
      expect(p2.tasks.get(id)!.recovered).toBe(true);
    }
    // المنتهية قبل الانهيار: لم تُعد ولم يتغير ناتجها
    expect(readFileSync(path.join(d, "finished.mp4"), "utf8")).toBe(finishedBytes);
    expect(p2.tasks.get("finished")!.status).toBe("done");
    // كل ناتج كتبته عملية واحدة فقط (لا كتابة مزدوجة من اليتيمة)
    expect(readFileSync(path.join(d, "long.mp4"), "utf8")).toMatch(/^long-\d+$/);
    expect(existsSync(path.join(d, "long.mp4.part.mp4"))).toBe(false);
  }, 20000);
});

// تحذير لمنع تجاهل الاستيراد في بيئات لا تُشغّل الاختبار الحقيقي
void spawn;

describe("التعطل واختفاء المتصفح (الأمر 010)", () => {
  it("مهمة لا تستهلك المعالج تُوقف عند مهلة التقدم: انتهاء المهلة", async () => {
    const d = dir();
    const h = harness(20000, { idle: { ms: 0, hang: true } });
    const pool = new RenderPool({ cpus: 2, memory: h.memory, tree: (pid) => ({ pids: [pid], rssMB: 100, cpuSeconds: 1, browserPids: [] }), spawnFn: h.spawnFn, pollMs: 5, stallMs: 40, ...noEvidence });
    pool.add(spec(d, "idle"));
    await pool.idle();
    const f = pool.tasks.get("idle")!.failure!;
    expect(f.kind).toBe("timeout");
    expect(f.message).toContain("تعطلت");
  });
  it("مهمة تعمل (يزيد زمن معالجها) لا تُعد معطلة", async () => {
    const d = dir();
    const h = harness(20000, { busy: { ms: 120 } });
    let cpu = 0;
    const pool = new RenderPool({ cpus: 2, memory: h.memory, tree: (pid) => ({ pids: [pid], rssMB: 100, cpuSeconds: (cpu += 0.2), browserPids: [] }), spawnFn: h.spawnFn, pollMs: 5, stallMs: 40, ...noEvidence });
    pool.add(spec(d, "busy"));
    await pool.idle();
    expect(pool.tasks.get("busy")!.status).toBe("done");
  });
  it("اختفاء عمليات المتصفح ثم تعطل: «انهيار المتصفح» بدليله، لا مهلة غامضة", async () => {
    const d = dir();
    const h = harness(20000, { crash: { ms: 0, hang: true } });
    let n = 0;
    const pool = new RenderPool({
      cpus: 2,
      memory: h.memory,
      // المتصفح 77 يظهر ثم يختفي، والعملية الأم تبقى بلا تقدم
      tree: (pid) => ({ pids: [pid], rssMB: 100, cpuSeconds: 1, browserPids: n++ < 3 ? [77] : [] }),
      spawnFn: h.spawnFn,
      pollMs: 5,
      stallMs: 60,
      ...noEvidence,
    });
    pool.add(spec(d, "crash"));
    await pool.idle();
    const f = pool.tasks.get("crash")!.failure!;
    expect(f.kind).toBe("browser-crash");
    expect(f.evidence.join()).toContain("اختفت");
  });
  it("المتصفح قتله النظام لنفاد الذاكرة (سجل النواة): نفاد ذاكرة مثبت، لا انهيار", () => {
    expect(classifyFailure({ code: null, signal: null, log: [], stalled: { ms: 300000 }, browserLost: true, kernelVictims: [77], pids: [10, 77] }).kind).toBe("oom");
  });
});

describe("طوابير متعددة على الجهاز نفسه", () => {
  it("مهام طابور آخر جارية تُحسب: لا تبدأ مهمة إن لم تكفِ الذاكرة الباقية بعدها", async () => {
    const d = dir();
    const h = harness(5000, { a: { ms: 10 } });
    // طابور آخر (الاستوديو مثلًا) يشغّل مهمة تقديرها 2500 لم تبلغ ذروتها بعد (300 الآن)
    const pool = new RenderPool({ cpus: 4, perJobMB: 1800, reserveMB: 900, memory: h.memory, tree: (pid) => ({ pids: [pid], rssMB: pid === 9999 ? 300 : 0 }), spawnFn: h.spawnFn, foreign: () => [{ pid: 9999, estimateMB: 2500 }], pollMs: 5, ...noEvidence });
    pool.add(spec(d, "a"));
    await new Promise((r) => setTimeout(r, 30));
    // 5000 − (2500 − 300) − 1800 = 1000 ≥ 900: تبدأ
    expect(pool.tasks.get("a")!.status).toBe("done");
    const pool2 = new RenderPool({ cpus: 4, perJobMB: 1800, reserveMB: 900, memory: () => ({ availableMB: 4000 }), tree: () => ({ pids: [], rssMB: 300 }), spawnFn: h.spawnFn, foreign: () => [{ pid: 9999, estimateMB: 2500 }], pollMs: 5, ...noEvidence });
    pool2.add(spec(d, "b"));
    await new Promise((r) => setTimeout(r, 30));
    // 4000 − 2200 − 1800 = 0 < 900: تنتظر
    expect(pool2.tasks.get("b")!.status).toBe("queued");
    pool2.cancel("b");
  });
});

describe("لا خروج صامت", () => {
  it("مهمة منتظرة بلا مهمة جارية تبقي البرنامج حيًا حتى تبدأ وتكتمل (عملية Node حقيقية)", async () => {
    const d = dir();
    // برنامج منفصل: طابور مهمته تنتظر «طابورًا آخر» يحجز الذاكرة ثم يُفرج عنها بعد 1.5 ث
    const script = `
      import { RenderPool } from ${JSON.stringify(path.resolve("src/render/pool.ts"))};
      const t0 = Date.now();
      const pool = new RenderPool({ cpus: 4, perJobMB: 1000, reserveMB: 900, pollMs: 50, oomCount: () => null, oomVictims: () => new Set(),
        memory: () => ({ availableMB: 4000 }), tree: () => ({ pids: [], rssMB: 0 }),
        foreign: () => (Date.now() - t0 < 1500 ? [{ pid: 1, estimateMB: 3000 }] : []) });
      pool.add({ id: "w", cmd: process.execPath, args: ["-e", "require('fs').writeFileSync(process.argv[1],'ok')", ${JSON.stringify(path.join(d, "w.mp4"))}], cwd: ${JSON.stringify(d)}, output: ${JSON.stringify(path.join(d, "w.mp4"))}, outputArg: 2 });
      await pool.idle();
      console.log("STATUS " + pool.tasks.get("w").status);
    `;
    const file = path.join(d, "probe.mts");
    writeFileSync(file, script);
    const out = await new Promise<string>((res) => {
      const c = spawn(process.execPath, [path.resolve("node_modules/tsx/dist/cli.mjs"), file], { cwd: path.resolve(".") });
      let o = "";
      c.stdout.on("data", (b) => (o += b));
      c.on("close", () => res(o));
    });
    expect(out).toContain("STATUS done");
    expect(readFileSync(path.join(d, "w.mp4"), "utf8")).toBe("ok");
  }, 20000);
});
