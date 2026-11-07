/**
 * P0 regression: exercise the real gate with a fake, local npx executable.
 *
 * No real Vitest/tsc, renderer, Mac production instance or Git worktree is
 * invoked. All children inherit their OWN test-root TMPDIR. Neither the gate
 * nor these tests may enumerate, clean or modify unrelated system temp paths.
 */
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const gate = path.join(projectRoot, "scripts", "gate.mjs");
const ownedRoots: string[] = [];
const fixture = () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "bal-p0-gate-test-"));
  ownedRoots.push(root);
  const bin = path.join(root, "bin");
  mkdirSync(bin);
  const trace = path.join(root, "trace.log");
  const foreign = path.join(root, "bal-gate-run-foreign");
  mkdirSync(foreign);
  writeFileSync(path.join(foreign, "DO-NOT-DELETE"), "foreign fixture\n");
  const shim = path.join(bin, "npx");
  writeFileSync(shim, `#!/usr/bin/env node
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const temp = process.env.TMPDIR;
if (!temp) process.exit(98);
for (const name of ["remotion-test", "webpack-test"]) {
  const dir = path.join(temp, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "cache"), "test-only-cache");
}
appendFileSync(process.env.BAL_P0_TRACE, "npx-start " + process.pid + "\\n");
if (process.env.BAL_P0_MODE === "fail") process.exit(17);
if (process.env.BAL_P0_MODE === "hang") setInterval(() => {}, 1000);
else process.exit(0);
`);
  chmodSync(shim, 0o755);
  return { root, bin, trace, foreign };
};
type Fixture = ReturnType<typeof fixture>;
type RunResult = { code: number | null; signal: NodeJS.Signals | null; out: string };

const execute = (f: Fixture, mode: "ok" | "fail" | "hang", cancel = false): Promise<RunResult> =>
  new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PATH: f.bin + path.delimiter + (process.env.PATH ?? ""),
      TMPDIR: f.root, TMP: f.root, TEMP: f.root,
      BAL_P0_TRACE: f.trace, BAL_P0_MODE: mode,
    };
    // Tests never pass --commit and hence cannot create real git worktrees.
    const child = spawn(process.execPath, [gate], {
      cwd: projectRoot, env, stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (buf: Buffer) => { out += buf.toString(); });
    child.stderr.on("data", (buf: Buffer) => { out += buf.toString(); });
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Gate fixture timed out, output: " + out.slice(-1000)));
    }, 12_000);
    const poll = cancel ? setInterval(() => {
      // Wait for the mocked child to start before signaling the real gate.
      if (existsSync(f.trace) && readFileSync(f.trace, "utf8").includes("npx-start")) {
        clearInterval(poll!);
        child.kill("SIGTERM");
      }
    }, 20) : null;
    child.once("error", (err) => {
      clearTimeout(timeout);
      if (poll) clearInterval(poll);
      reject(err);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      if (poll) clearInterval(poll);
      resolve({ code, signal, out });
    });
  });

const checkIsolated = (f: Fixture) => {
  // Only inspect this fixture's root. A same-prefix FOREIGN directory must
  // survive: cleanup must use the exact mkdtemp path, never a prefix sweep.
  const leftovers = readdirSync(f.root).filter((name) =>
    name.startsWith("bal-gate-run-") && name !== "bal-gate-run-foreign");
  expect(leftovers).toEqual([]);
  expect(readFileSync(path.join(f.foreign, "DO-NOT-DELETE"), "utf8")).toBe("foreign fixture\n");
  expect(existsSync(path.join(f.bin, "npx"))).toBe(true);
};
afterEach(() => {
  for (const root of ownedRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("P0 gate-owned temporary files", () => {
  it("removes Remotion/webpack-like caches after success", async () => {
    const f = fixture();
    const r = await execute(f, "ok");
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain("GATE_TEMP_CLEANED true");
    expect(readFileSync(f.trace, "utf8")).toContain("npx-start");
    checkIsolated(f);
  }, 15_000);

  it("removes all owned files when a check fails, rejecting the push", async () => {
    const f = fixture();
    const r = await execute(f, "fail");
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain("GATE_TEMP_CLEANED true");
    checkIsolated(f);
  }, 15_000);

  it.skipIf(process.platform === "win32")("cancels the active process group before deleting its temp root", async () => {
    const f = fixture();
    const r = await execute(f, "hang", true);
    expect(r.code, r.out).toBe(143);
    expect(r.out).toContain("GATE_CANCELLED SIGTERM");
    expect(r.out).toContain("GATE_TEMP_CLEANED true");
    checkIsolated(f);
  }, 15_000);

  it("runs two gates concurrently without cross-run deletion", async () => {
    const a = fixture();
    const b = fixture();
    const [one, two] = await Promise.all([execute(a, "ok"), execute(b, "ok")]);
    expect(one.code, one.out).toBe(0);
    expect(two.code, two.out).toBe(0);
    checkIsolated(a);
    checkIsolated(b);
  }, 15_000);
});
