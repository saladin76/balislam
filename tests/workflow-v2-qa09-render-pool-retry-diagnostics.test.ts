/**
 * Studio V2 QA-09 — RenderPool retry diagnosis on the EXACT legacy pool module.
 * This is a production CLASS + fake-CHILD lifecycle test, NOT Studio V2 E2E.
 * No timeout/attempt/legacy assertion is weakened, no production files edited.
 */
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RenderPool, type TaskSpec } from "../src/render/pool";

type Behavior = { ms: number; code?: number; writes?: boolean };
type Snapshot = {
  id: string; phase: string; attempts: number; status: string;
  failureKind?: string; failureEvidence?: unknown;
};
type Trace = { started: string[]; transitions: Snapshot[]; final: Record<string, unknown> };

const task = (dir: string, id: string): TaskSpec => ({
  id, cmd: "qa09-fake-child", args: ["-o", path.join(dir, id + ".mp4")],
  cwd: dir, output: path.join(dir, id + ".mp4"), outputArg: 1,
});

async function exercise(n: number, firstFailureMs: number, recoveryMs: number) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "studio-v2-qa09-retry-"));
  const plan: Record<string, Behavior> = { y: { ms: firstFailureMs, code: 1 } };
  const evidence: Trace = { started: [], transitions: [], final: {} };
  let pid = 45000;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const enqueueTimer = (cb: () => void, ms: number) => {
    const timer = setTimeout(() => { timers.delete(timer); cb(); }, ms);
    timers.add(timer);
  };
  const spawnFn = (spec: TaskSpec, args: string[]) => {
    const behavior = { ...(plan[spec.id] ?? { ms: recoveryMs }) };
    const child = new EventEmitter() as ChildProcess & EventEmitter;
    const childPid = ++pid;
    let closed = false;
    const close = (code: number | null, signal: NodeJS.Signals | null) => {
      if (closed) return;
      closed = true;
      child.emit("close", code, signal);
    };
    Object.assign(child, {
      pid: childPid, stdout: new EventEmitter(), stderr: new EventEmitter(),
      kill: (sig: NodeJS.Signals) => {
        enqueueTimer(() => close(null, sig), 1); return true;
      },
    });
    evidence.started.push(spec.id);
    enqueueTimer(() => {
      if (closed) return;
      if (behavior.writes !== false && spec.outputArg !== undefined)
        writeFileSync(args[spec.outputArg]!, "QA09-owned-output-" + spec.id);
      close(behavior.code ?? 0, null);
    }, behavior.ms);
    return child;
  };
  const pool = new RenderPool({
    cpus: 4, memory: () => ({ availableMB: 20_000 }),
    tree: () => ({ pids: [], rssMB: 0 }),
    spawnFn, pollMs: 3, oomCount: () => null, oomVictims: () => new Set<number>(),
    onChange: (state) => evidence.transitions.push({
      id: state.id, phase: plan.y ? "before-retry" : "after-retry",
      attempts: state.attempts, status: state.status,
      failureKind: state.failure?.kind,
      failureEvidence: state.failure?.diagnostics,
    }),
  });
  try {
    for (const id of ["x", "y", "z"]) pool.add(task(dir, id));
    await pool.idle();
    const first = pool.tasks.get("y")!;
    const firstResult = {
      status: first.status, attempts: first.attempts, kind: first.failure?.kind,
      outputExists: existsSync(path.join(dir, "y.mp4")),
      partialExists: existsSync(path.join(dir, "y.mp4.part.mp4")),
    };
    // Assert the first attempt REALLY FAILED, and remove only this job's partial.
    if (firstResult.status !== "error" || firstResult.attempts !== 1 ||
        firstResult.partialExists || firstResult.outputExists)
      throw Error("FIRST_ATTEMPT_BROKEN " + JSON.stringify(firstResult));
    delete plan.y;
    const selected = pool.retryFailed();
    const selectedAgain = pool.retryFailed();
    await pool.idle();
    const y = pool.tasks.get("y")!;
    evidence.final = {
      n, firstResult, selected, selectedAgain, yStatus: y.status, yAttempts: y.attempts,
      failure: y.failure, yError: y.error,
      outputExists: existsSync(path.join(dir, "y.mp4")),
      outputBytes: existsSync(path.join(dir, "y.mp4")) ?
        readFileSync(path.join(dir, "y.mp4"), "utf8") : null,
      partialExists: existsSync(path.join(dir, "y.mp4.part.mp4")),
      xStatus: pool.tasks.get("x")?.status,
      zStatus: pool.tasks.get("z")?.status,
      startCounts: Object.fromEntries(["x", "y", "z"].map((id) =>
        [id, evidence.started.filter((v) => v === id).length])),
    };
    const v = evidence.final;
    // Original requirements preserved verbatim: one failed job alone retried,
    // two attempts, success, x/z untouched and no partial file.
    if (JSON.stringify(selected) !== '["y"]' ||
        JSON.stringify(selectedAgain) !== "[]" ||
        v.yStatus !== "done" || v.yAttempts !== 2 ||
        v.xStatus !== "done" || v.zStatus !== "done" ||
        v.partialExists || !v.outputExists ||
        v.outputBytes !== "QA09-owned-output-y" ||
        JSON.stringify(v.startCounts) !== '{"x":1,"y":2,"z":1}')
      throw Error("RETRY_REGRESSION " + JSON.stringify({
        final: evidence.final, transitions: evidence.transitions,
      }).slice(0, 6500));
    return evidence.final;
  } finally {
    for (const timer of timers) clearTimeout(timer);
    // This fixture directory is made by mkdtempSync in this invocation only.
    rmSync(dir, { force: true, recursive: true });
  }
}

describe("QA-09 real RenderPool retry diagnostics (fake process; NOT E2E)", () => {
  // Each case remains within Vitest's original 5-second per-test timeout.
  // No global timeout increase, skips, retries or altered legacy tests.
  for (const [variant, failedMs, recoveredMs] of [
    ["exact-legacy", 5, 20], ["fast-close", 1, 1],
    ["delayed-close", 12, 25], ["mixed-poll", 7, 11],
  ] as const) {
    it("repeats failed-only once retry with diagnostics: " + variant, async () => {
      for (let n = 0; n < 10; n++) {
        const state = await exercise(n, failedMs, recoveredMs);
        expect(state.yStatus).toBe("done");
        expect(state.yAttempts).toBe(2);
      }
    });
  }
});
