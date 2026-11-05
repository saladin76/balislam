import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canStart, failureReason, RenderPool, safeParallelism, type TaskSpec } from "../src/render/pool";

/**
 * طابور الرندر (الأمر 009): تحت ضغط مضبوط بعمليات وهمية تحاكي الذاكرة والفشل.
 */
type Fake = { ms: number; code?: number; signal?: NodeJS.Signals; writes?: boolean };
const harness = (availableMB: number, perTaskMB: number, plan: Record<string, Fake>) => {
  let running = 0;
  let peak = 0;
  const started: string[] = [];
  const spawnFn = (spec: TaskSpec) => {
    const child = new EventEmitter() as never as import("node:child_process").ChildProcess & EventEmitter;
    Object.assign(child, { stdout: new EventEmitter(), stderr: new EventEmitter(), pid: -1 });
    const f = plan[spec.id] ?? { ms: 20 };
    running++;
    peak = Math.max(peak, running);
    started.push(spec.id);
    setTimeout(() => {
      if (f.writes !== false && spec.outputArg !== undefined) writeFileSync(spec.args[spec.outputArg]!, "ok");
      if (f.signal) (child.stderr as EventEmitter).emit("data", Buffer.from("Error: Target closed\n"));
      running--;
      child.emit("close", f.signal ? null : (f.code ?? 0), f.signal ?? null);
    }, f.ms);
    return child;
  };
  // الذاكرة المتاحة تنقص بقدر المهام الجارية فعلًا
  const memory = () => ({ availableMB: availableMB - running * perTaskMB });
  return { spawnFn, memory, stats: () => ({ peak, started }) };
};
const dir = () => mkdtempSync(path.join(os.tmpdir(), "pool-"));
const spec = (d: string, id: string): TaskSpec => ({ id, cmd: "x", args: ["out", path.join(d, `${id}.mp4`)], cwd: d, output: path.join(d, `${id}.mp4`), outputArg: 1 });

describe("التوازي الآمن من الموارد", () => {
  it("يتبع الذاكرة وعدد الأنوية لا رقمًا ثابتًا", () => {
    expect(safeParallelism(7400, 2, 1800, 900)).toBe(2);
    expect(safeParallelism(7400, 8, 1800, 900)).toBe(3);
    expect(safeParallelism(31000, 8, 1800, 900)).toBe(8);
    expect(safeParallelism(1500, 8, 1800, 900)).toBe(1);
  });
  it("المهمة الأولى تبدأ دائمًا، والتالية فقط إذا بقي احتياطي", () => {
    expect(canStart({ availableMB: 500, cpus: 2, running: 0, runningMB: 0, perJobMB: 1800, reserveMB: 900 })).toBe(true);
    expect(canStart({ availableMB: 4000, cpus: 4, running: 1, runningMB: 1800, perJobMB: 1800, reserveMB: 900 })).toBe(true);
    // المهمة الجارية لم تبلغ ذروتها بعد: يُحسب ما ستحجزه
    expect(canStart({ availableMB: 4000, cpus: 4, running: 1, runningMB: 300, perJobMB: 1800, reserveMB: 900 })).toBe(false);
    expect(canStart({ availableMB: 9000, cpus: 2, running: 2, runningMB: 3600, perJobMB: 1800, reserveMB: 900 })).toBe(false);
  });
});

describe("الطابور تحت الضغط", () => {
  it("عشر مهام على ذاكرة تكفي اثنتين: لا تتجاوز اثنتين معًا وتكتمل كلها", async () => {
    const d = dir();
    const h = harness(4700, 1800, {});
    const pool = new RenderPool({ cpus: 8, perJobMB: 1800, reserveMB: 900, memory: h.memory, spawnFn: h.spawnFn, pollMs: 5 });
    for (let i = 0; i < 10; i++) pool.add(spec(d, `t${i}`));
    await pool.idle();
    expect(h.stats().peak).toBeLessThanOrEqual(2);
    expect([...pool.tasks.values()].every((t) => t.status === "done")).toBe(true);
    for (let i = 0; i < 10; i++) expect(existsSync(path.join(d, `t${i}.mp4`))).toBe(true);
  });

  it("فشل مهمة (نفاد ذاكرة) لا يوقف غيرها، وسببه واضح، والناتج السليم السابق يبقى", async () => {
    const d = dir();
    writeFileSync(path.join(d, "b.mp4"), "previous-good");
    const h = harness(20000, 1000, { b: { ms: 15, signal: "SIGKILL", writes: true } });
    const ledger = path.join(d, "q.json");
    const pool = new RenderPool({ cpus: 4, memory: h.memory, spawnFn: h.spawnFn, pollMs: 5, ledger });
    for (const id of ["a", "b", "c"]) pool.add(spec(d, id));
    await pool.idle();
    const b = pool.tasks.get("b")!;
    expect(b.status).toBe("error");
    expect(b.error).toContain("نفدت الذاكرة");
    expect(pool.tasks.get("a")!.status).toBe("done");
    expect(pool.tasks.get("c")!.status).toBe("done");
    // الملف الجزئي حُذف، والسابق لم يُمس
    expect(readFileSync(path.join(d, "b.mp4"), "utf8")).toBe("previous-good");
    expect(existsSync(path.join(d, "b.mp4.part.mp4"))).toBe(false);
    // السجل يحفظ السبب
    const saved = JSON.parse(readFileSync(ledger, "utf8"));
    expect(saved.tasks.find((t: { id: string }) => t.id === "b").error).toContain("نفدت الذاكرة");
  });

  it("إعادة المحاولة تعيد الفاشل وحده", async () => {
    const d = dir();
    const plan: Record<string, Fake> = { y: { ms: 5, code: 1 } };
    const h = harness(20000, 500, plan);
    const pool = new RenderPool({ cpus: 4, memory: h.memory, spawnFn: h.spawnFn, pollMs: 5 });
    for (const id of ["x", "y", "z"]) pool.add(spec(d, id));
    await pool.idle();
    delete plan.y;
    expect(pool.retryFailed()).toEqual(["y"]);
    await pool.idle();
    expect(pool.tasks.get("y")!.status).toBe("done");
    expect(pool.tasks.get("y")!.attempts).toBe(2);
    expect(pool.tasks.get("x")!.attempts).toBe(1);
    expect(h.stats().started.filter((s) => s === "x")).toHaveLength(1);
  });

  it("إضافة مهمة جارية مرة ثانية لا تكررها", async () => {
    const d = dir();
    const h = harness(20000, 500, { a: { ms: 30 } });
    const pool = new RenderPool({ cpus: 4, memory: h.memory, spawnFn: h.spawnFn, pollMs: 5 });
    pool.add(spec(d, "a"));
    pool.add(spec(d, "a"));
    await pool.idle();
    expect(h.stats().started).toEqual(["a"]);
  });

  it("رسائل الفشل: انهيار المتصفح ورمز الخروج", () => {
    expect(failureReason(1, null, ["Error: Page crashed!"], 900)).toContain("انهار المتصفح");
    expect(failureReason(2, null, ["something"], 100)).toContain("برمز 2");
    expect(failureReason(null, "SIGKILL", [], 2100)).toContain("2100");
  });
});
