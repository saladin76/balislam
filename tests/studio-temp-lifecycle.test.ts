/**
 * P0 regression: exercise the real gate with a fake, local npx executable.
 *
 * No real Vitest/tsc, renderer or Mac production instance is invoked;
 * commit-mode worktrees are created only inside a synthetic test repository. All children inherit their OWN test-root TMPDIR. Neither the gate
 * nor these tests may enumerate, clean or modify unrelated system temp paths.
 */
import { execFileSync, spawn } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanGitEnv } from "../scripts/git-env.mjs";

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
const { appendFileSync, existsSync, mkdirSync, symlinkSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const temp = process.env.TMPDIR;
if (!temp || process.env.TMP !== temp || process.env.TEMP !== temp) process.exit(98);
for (const name of ["remotion-test", "webpack-test"]) {
  const dir = path.join(temp, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "cache"), "test-only-cache");
}
if (process.platform !== "win32") {
  const link = path.join(temp, "foreign-link");
  if (!existsSync(link)) symlinkSync(process.env.BAL_P0_FOREIGN, link, "dir");
  appendFileSync(process.env.BAL_P0_TRACE, "foreign-link-created\\n");
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

const mockNpm = (f: Fixture) => {
  const shim = path.join(f.bin, "npm");
  writeFileSync(shim, `#!/usr/bin/env node
const { appendFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const temp = process.env.TMPDIR;
if (!temp || process.env.TMP !== temp || process.env.TEMP !== temp) process.exit(98);
writeFileSync(path.join(temp, "npm-install-cache"), "owned npm install cache");
appendFileSync(process.env.BAL_P0_TRACE, "npm-start " + process.pid + "\\n");
if (process.env.BAL_P0_MODE === "fail") process.exit(17);
if (process.env.BAL_P0_MODE === "hang") setInterval(() => {}, 1000);
else process.exit(0);
`);
  chmodSync(shim, 0o755);
};

const execute = (f: Fixture, mode: "ok" | "fail" | "hang", cancel: "SIGTERM" | "SIGINT" | "SIGHUP" | null = null,
  target: { script: string; cwd: string; args: string[] } = { script: gate, cwd: projectRoot, args: [] },
  cancelMarker = "npx-start"): Promise<RunResult> =>
  new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PATH: f.bin + path.delimiter + (process.env.PATH ?? ""),
      TMPDIR: f.root, TMP: f.root, TEMP: f.root,
      BAL_P0_TRACE: f.trace, BAL_P0_MODE: mode, BAL_P0_FOREIGN: f.foreign,
    };
    // --commit tests use only the synthetic Git repository in this fixture.
    const child = spawn(process.execPath, [target.script, ...target.args], {
      cwd: target.cwd, env, stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (buf: Buffer) => { out += buf.toString(); });
    child.stderr.on("data", (buf: Buffer) => { out += buf.toString(); });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      // Kill only a known hanging mock worker, never any previously exited PIDs.
      // Avoid leaving hanging child test processes after an assertion timeout.
      if (mode === "hang" && process.platform !== "win32" && existsSync(f.trace)) {
        const pids = readFileSync(f.trace, "utf8").match(/(?:npx|npm)-start (\d+)/g) ?? [];
        for (const entry of pids) {
          const pid = Number(entry.split(" ")[1]);
          try { process.kill(-pid, "SIGKILL"); } catch { /* already exited */ }
        }
      }
      child.kill("SIGKILL");
      // Wait for the process to close before afterEach deletes its fixture.
    }, 12_000);
    const poll = cancel ? setInterval(() => {
      // Wait for the mocked child to start before signaling the real gate.
      if (existsSync(f.trace) && readFileSync(f.trace, "utf8").includes(cancelMarker)) {
        clearInterval(poll!);
        child.kill(cancel!);
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
      if (timedOut) reject(new Error("Gate fixture timed out, output: " + out.slice(-1000)));
      else resolve({ code, signal, out });
    });
  });


const isolatedGitRepository = (f: Fixture) => {
  // This is a NEW repository inside the test fixture. No git command below
  // is ever executed against the actual balislam repository.
  const directory = path.join(f.root, "synthetic-repo");
  const scripts = path.join(directory, "scripts");
  const episode = path.join(directory, "channels", "balislam", "episodes", "001-safe");
  mkdirSync(scripts, { recursive: true });
  mkdirSync(episode, { recursive: true });
  copyFileSync(gate, path.join(scripts, "gate.mjs"));
  copyFileSync(path.join(projectRoot, "scripts", "git-env.mjs"), path.join(scripts, "git-env.mjs"));
  writeFileSync(path.join(directory, "package.json"), '{"name":"synthetic-gate-repo","private":true}');
  writeFileSync(path.join(directory, "package-lock.json"), '{"name":"synthetic-gate-repo"}');
  writeFileSync(path.join(directory, ".gitignore"), "node_modules/\n");
  writeFileSync(path.join(episode, "script.md"), "IMMUTABLE EPISODE CONTENT\n");
  mkdirSync(path.join(directory, "node_modules"));
  const env = cleanGitEnv();
  const git = (...args: string[]) => execFileSync("git", args, { cwd: directory, env, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "fixture-only");
  git("add", ".");
  git("-c", "user.email=p0-test@example.invalid", "-c", "user.name=P0 Fixture",
    "commit", "-q", "-m", "Synthetic episode fixture");
  const sha = git("rev-parse", "HEAD");
  const configuration = readFileSync(path.join(directory, ".git", "config"), "utf8");
  return { directory, episode, sha, configuration, git,
    target: { cwd: directory, script: path.join(scripts, "gate.mjs"), args: ["--commit", sha] } };
};

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

  it("does not accumulate private temp folders over repeated successful runs", async () => {
    const f = fixture();
    for (let run = 0; run < 3; run++) {
      const r = await execute(f, "ok");
      expect(r.code, r.out).toBe(0);
      checkIsolated(f);
    }
    expect(readFileSync(f.trace, "utf8").match(/npx-start/g)).toHaveLength(6);
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
    const r = await execute(f, "hang", "SIGTERM");
    expect(r.code, r.out).toBe(143);
    expect(r.out).toContain("GATE_CANCELLED SIGTERM");
    expect(r.out).toContain("GATE_TEMP_CLEANED true");
    checkIsolated(f);
  }, 15_000);

  it.skipIf(process.platform === "win32")("preserves a separate Git repo and its episode while removing a temporary commit worktree", async () => {
    const f = fixture();
    const isolated = isolatedGitRepository(f);
    const r = await execute(f, "ok", null, isolated.target);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain("GATE_TEMP_CLEANED true");
    expect(isolated.git("rev-parse", "HEAD")).toBe(isolated.sha);
    expect(isolated.git("status", "--porcelain")).toBe("");
    expect(isolated.git("worktree", "list", "--porcelain").split("\n").filter((line) =>
      line.startsWith("worktree "))).toHaveLength(1);
    expect(readFileSync(path.join(isolated.directory, ".git", "config"), "utf8"))
      .toBe(isolated.configuration);
    expect(readFileSync(path.join(isolated.episode, "script.md"), "utf8"))
      .toBe("IMMUTABLE EPISODE CONTENT\n");
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

  it.skipIf(process.platform === "win32")("does not follow child-created symlinks to a foreign sibling", async () => {
    const f = fixture();
    const r = await execute(f, "ok");
    expect(r.code, r.out).toBe(0);
    expect(readFileSync(f.trace, "utf8")).toContain("foreign-link-created");
    checkIsolated(f);
  }, 15_000);

  it.skipIf(process.platform === "win32")("handles SIGINT as a rejected gate and cleans its own root", async () => {
    const f = fixture();
    const r = await execute(f, "hang", "SIGINT");
    expect(r.code, r.out).toBe(130);
    expect(r.out).toContain("GATE_CANCELLED SIGINT");
    expect(r.out).toContain("GATE_TEMP_CLEANED true");
    checkIsolated(f);
  }, 15_000);

  it("does not remove another worker's files when one of two parallel gates fails", async () => {
    const a = fixture();
    const b = fixture();
    const [one, two] = await Promise.all([execute(a, "fail"), execute(b, "ok")]);
    expect(one.code, one.out).toBe(1);
    expect(two.code, two.out).toBe(0);
    checkIsolated(a);
    checkIsolated(b);
  }, 15_000);

  it.skipIf(process.platform === "win32")("handles SIGHUP and cleans the private root", async () => {
    const f = fixture();
    const r = await execute(f, "hang", "SIGHUP");
    expect(r.code, r.out).toBe(129);
    expect(r.out).toContain("GATE_CANCELLED SIGHUP");
    expect(r.out).toContain("GATE_TEMP_CLEANED true");
    checkIsolated(f);
  }, 15_000);

  it.skipIf(process.platform === "win32")("removes a synthetic commit worktree after an unsuccessful check", async () => {
    const f = fixture();
    const isolated = isolatedGitRepository(f);
    const r = await execute(f, "fail", null, isolated.target);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain("GATE_TEMP_CLEANED true");
    expect(isolated.git("rev-parse", "HEAD")).toBe(isolated.sha);
    expect(isolated.git("status", "--porcelain")).toBe("");
    expect(isolated.git("worktree", "list", "--porcelain").split("\n").filter((l) =>
      l.startsWith("worktree "))).toHaveLength(1);
    expect(readFileSync(path.join(isolated.episode, "script.md"), "utf8")).toBe("IMMUTABLE EPISODE CONTENT\n");
    checkIsolated(f);
  }, 15_000);

  it.skipIf(process.platform === "win32")("cleans a failed npm ci and its synthetic commit worktree", async () => {
    const f = fixture();
    const isolated = isolatedGitRepository(f);
    rmSync(path.join(isolated.directory, "node_modules"), { recursive: true, force: true });
    mockNpm(f);
    const r = await execute(f, "fail", null, isolated.target);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain("GATE_TEMP_CLEANED true");
    expect(readFileSync(f.trace, "utf8")).toContain("npm-start");
    expect(isolated.git("worktree", "list", "--porcelain").split("\n").filter((l) =>
      l.startsWith("worktree "))).toHaveLength(1);
    expect(isolated.git("status", "--porcelain")).toBe("");
    checkIsolated(f);
  }, 15_000);

  it.skipIf(process.platform === "win32")("cancels an active npm ci before removing its synthetic worktree", async () => {
    const f = fixture();
    const isolated = isolatedGitRepository(f);
    rmSync(path.join(isolated.directory, "node_modules"), { recursive: true, force: true });
    mockNpm(f);
    const r = await execute(f, "hang", "SIGTERM", isolated.target, "npm-start");
    expect(r.code, r.out).toBe(143);
    expect(r.out).toContain("GATE_CANCELLED SIGTERM during npm ci");
    expect(r.out).toContain("GATE_TEMP_CLEANED true");
    expect(isolated.git("rev-parse", "HEAD")).toBe(isolated.sha);
    expect(isolated.git("worktree", "list", "--porcelain").split("\n").filter((l) =>
      l.startsWith("worktree "))).toHaveLength(1);
    expect(isolated.git("status", "--porcelain")).toBe("");
    checkIsolated(f);
  }, 15_000);

  it.skipIf(process.platform === "win32")("rejects an invalid commit without leaving Git registrations or temp roots", async () => {
    const f = fixture();
    const isolated = isolatedGitRepository(f);
    const target = { ...isolated.target, args: ["--commit", "this-commit-does-not-exist"] };
    const r = await execute(f, "ok", null, target);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain("GATE_TEMP_CLEANED true");
    expect(isolated.git("worktree", "list", "--porcelain").split("\n").filter((l) =>
      l.startsWith("worktree "))).toHaveLength(1);
    expect(isolated.git("status", "--porcelain")).toBe("");
    expect(readFileSync(path.join(isolated.episode, "script.md"), "utf8")).toBe("IMMUTABLE EPISODE CONTENT\n");
    checkIsolated(f);
  }, 15_000);
});
