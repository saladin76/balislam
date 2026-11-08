/**
 * Studio V2 QA-09 — fault-injection of the REAL RenderPool finish() lifecycle.
 * The only fake is the spawned child; cleanup, state, ledger and retry logic
 * execute from src/render/pool.ts. All filesystem paths are run-owned.
 * Neither original test assertions nor global per-test timeouts are changed.
 */
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RenderPool, type TaskSpec, type TaskState } from "../src/render/pool";

const policy = {
  cpus: 2,
  memory: () => ({ availableMB: 20_000 }),
  tree: () => ({ pids: [], rssMB: 0 }),
  pollMs: 5,
  oomCount: () => null,
  oomVictims: () => new Set<number>(),
};

const fixture = () => mkdtempSync(path.join(os.tmpdir(), "studio-qa09-exception-"));
const newTask = (dir: string, id: string, onEnd?: (state: TaskState) => void): TaskSpec => ({
  id, cmd: "qa09-child", args: ["-o", path.join(dir, id + ".mp4")],
  cwd: dir, outputArg: 1, output: path.join(dir, id + ".mp4"), onEnd,
});
const fakeChild = (mode: "success" | "failing-dir" | "failed-file", ms = 8) => {
  let pid = 32000;
  let started = 0;
  const spawnFn = (spec: TaskSpec, args: string[]) => {
    started += 1;
    const child = new EventEmitter() as ChildProcess & EventEmitter;
    let closed = false;
    Object.assign(child, {
      pid: ++pid,
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      kill: () => { closed = true; return true; },
    });
    setTimeout(() => {
      if (closed) return;
      if (mode === "failing-dir") mkdirSync(args[spec.outputArg!]!, { recursive: true });
      else writeFileSync(args[spec.outputArg!]!, "qa09-" + spec.id);
      child.emit("close", mode === "success" ? 0 : 1, null);
    }, ms);
    return child;
  };
  return { spawnFn, started: () => started };
};
async function idleBounded(pool: RenderPool) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      pool.idle(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Error("idle() permanently stuck in settling")), 750);
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

describe("QA-09 exception paths — production RenderPool settlement", () => {
  it("fails closed when rm of a run-owned partial fails; idle unblocks but retry is forbidden", async () => {
    const dir = fixture();
    try {
      const child = fakeChild("failing-dir");
      const pool = new RenderPool({ ...policy, spawnFn: child.spawnFn });
      const spec = newTask(dir, "cleanup");
      pool.add(spec);
      await idleBounded(pool);
      const state = pool.tasks.get("cleanup")!;
      expect(state.status).toBe("error");
      expect(state.attempts).toBe(1);
      expect(state.failure?.kind).toBe("unknown");
      expect(state.failure?.message).toContain("إعادة المحاولة");
      expect(existsSync(spec.output! + ".part.mp4")).toBe(true);
      expect(existsSync(spec.output!)).toBe(false);
      expect(pool.retryFailed()).toEqual([]);
      expect(pool.add(spec)).toBe(state);
      expect(child.started()).toBe(1);
    } finally { rmSync(dir, { force: true, recursive: true }); }
  });

  it("captures observer callback exceptions without corrupting a valid rendered output", async () => {
    const dir = fixture();
    try {
      const child = fakeChild("success");
      const events: string[] = [];
      const pool = new RenderPool({
        ...policy, spawnFn: child.spawnFn,
        onChange: (state) => {
          events.push(state.status);
          if (state.status === "done") throw Error("QA-09 forced onChange exception");
        },
      });
      const spec = newTask(dir, "observer", () => { throw Error("QA-09 forced onEnd exception"); });
      pool.add(spec);
      await idleBounded(pool);
      const state = pool.tasks.get("observer")!;
      expect(state.status).toBe("done");
      expect(state.attempts).toBe(1);
      expect(state.log.join("\n")).toContain("onChange callback failed");
      expect(state.log.join("\n")).toContain("onEnd callback failed");
      expect(readFileSync(spec.output!, "utf8")).toBe("qa09-observer");
      expect(existsSync(spec.output! + ".part.mp4")).toBe(false);
      expect(events).toContain("done");
      expect(pool.retryFailed()).toEqual([]);
      expect(child.started()).toBe(1);
    } finally { rmSync(dir, { force: true, recursive: true }); }
  });

  it("failed ledger finalization cannot expose a success callback or allow unsafe retry", async () => {
    const dir = fixture();
    try {
      const child = fakeChild("success", 20);
      const events: string[] = [];
      const pool = new RenderPool({ ...policy, spawnFn: child.spawnFn,
        onChange: (state) => events.push(state.status) });
      const spec = newTask(dir, "ledger");
      pool.add(spec);
      // Fail ONLY finish-time persistence: add/start invoked their prior saves.
      pool.save = async () => { throw Error("QA-09 forced ledger disk I/O fault"); };
      await idleBounded(pool);
      const state = pool.tasks.get("ledger")!;
      expect(state.status).toBe("error");
      expect(state.attempts).toBe(1);
      expect(state.failure?.message).toContain("أُوقفت إعادة المحاولة");
      expect(state.log.join("\n")).toContain("ledger persistence failed");
      expect(events).not.toContain("done");
      expect(readFileSync(spec.output!, "utf8")).toBe("qa09-ledger");
      expect(existsSync(spec.output! + ".part.mp4")).toBe(false);
      expect(pool.retryFailed()).toEqual([]);
      expect(pool.add(spec)).toBe(state);
      expect(child.started()).toBe(1);
    } finally { rmSync(dir, { force: true, recursive: true }); }
  });

  it("ordinary failure still retries exactly once and preserves unrelated successful outputs", async () => {
    const dir = fixture();
    try {
      const failing = new Set(["y"]);
      let pid = 60000;
      const started: string[] = [];
      const spawnFn = (spec: TaskSpec, args: string[]) => {
        const child = new EventEmitter() as ChildProcess & EventEmitter;
        Object.assign(child, {
          pid: ++pid, stdout: new EventEmitter(), stderr: new EventEmitter(), kill: () => true,
        });
        started.push(spec.id);
        const fail = failing.has(spec.id);
        setTimeout(() => {
          writeFileSync(args[spec.outputArg!]!, "qa09-" + spec.id);
          child.emit("close", fail ? 1 : 0, null);
        }, 8);
        return child;
      };
      const pool = new RenderPool({ ...policy, spawnFn });
      for (const id of ["x", "y", "z"]) pool.add(newTask(dir, id));
      await idleBounded(pool);
      expect(pool.tasks.get("y")?.status).toBe("error");
      expect(existsSync(path.join(dir, "y.mp4.part.mp4"))).toBe(false);
      failing.delete("y");
      expect(pool.retryFailed()).toEqual(["y"]);
      expect(pool.retryFailed()).toEqual([]);
      await idleBounded(pool);
      expect(pool.tasks.get("y")?.status).toBe("done");
      expect(pool.tasks.get("y")?.attempts).toBe(2);
      expect(started).toEqual(["x", "y", "z", "y"]);
      for (const id of ["x", "y", "z"])
        expect(readFileSync(path.join(dir, id + ".mp4"), "utf8")).toBe("qa09-" + id);
      expect(existsSync(path.join(dir, "y.mp4.part.mp4"))).toBe(false);
    } finally { rmSync(dir, { force: true, recursive: true }); }
  });
});
