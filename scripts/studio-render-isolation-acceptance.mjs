/**
 * Opt-in, isolated macOS acceptance gate. No production episode is rendered,
 * uploaded, modified or approved. Requires an approved worktree path.
 * Usage (on the approved review Mac worktree only):
 * BAL_STUDIO_REVIEW_APPROVED=YES BAL_STUDIO_REVIEW_ROOT="$PWD" \
 *   node scripts/studio-render-isolation-acceptance.mjs
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = await realpath(path.resolve(import.meta.dirname, ".."));
const approved = process.env.BAL_STUDIO_REVIEW_ROOT;
const approval = process.env.BAL_STUDIO_REVIEW_APPROVED;
const branch = "work/studio-render-isolation-20261107";
const command = (bin, args) => execFileSync(bin, args, { cwd: root, encoding: "utf8" }).trim();
const currentBranch = command("git", ["branch", "--show-current"]);
const sha = command("git", ["rev-parse", "HEAD"]);
if (process.platform !== "darwin" || !approved || approval !== "YES" ||
    await realpath(path.resolve(approved)) !== root || currentBranch !== branch ||
    !path.isAbsolute(approved))
  throw new Error("Mac isolated review authorization, exact worktree path and dedicated branch are required.");
if (root === os.homedir() || root === path.join(os.homedir(), "balislam"))
  throw new Error("Refusing to run acceptance checks in the production checkout.");
if (command("git", ["status", "--porcelain"]))
  throw new Error("Review worktree must be clean before acceptance tests.");

const startedAt = new Date().toISOString();
const parent = path.join(root, "renders", "isolated-acceptance");
await mkdir(parent, { recursive: true });
const evidenceDir = await mkdtemp(path.join(parent, "run-"));
const reportPath = path.join(evidenceDir, "acceptance.json");
const testsTemp = path.join(evidenceDir, "temp");
await mkdir(testsTemp, { recursive: true });
const env = { ...process.env, TMPDIR: testsTemp, TMP: testsTemp, TEMP: testsTemp };
const report = {
  stage: "isolated-mac-review",
  branch, sha, mac: process.platform, node: process.version, startedAt,
  evidenceDir, tests: [], temporaryResidue: [], visualReview: "NOT_RUN",
  avReviewAt1x: "NOT_RUN", ownerMasterApproval: "NOT_RUN",
  productionRender: false, publishing: false,
};
const steps = [
  ["npm-ci", "npm", ["ci", "--ignore-scripts"]],
  ["typecheck", "npm", ["run", "typecheck"]],
  ["isolation-targets", "npx", ["vitest", "run",
    "tests/render-output-ownership.test.ts",
    "tests/render-master-gate-contract.test.ts",
    "tests/render-media-snapshots.test.ts",
    "tests/render-media-access.test.ts",
    "tests/render-pool.test.ts",
    "tests/storyboard-stage-safety.test.ts",
    "tests/studio-three-channel-isolation.test.ts",
    "tests/studio-production-stage-integration.test.ts",
    "tests/episode-previews.test.ts"]],
  ["full-vitest", "npm", ["test"]],
  ["project-gate", "npm", ["run", "gate"]],
  // Load tsx via Node's supported ESM import hook instead of its CLI process.
    // On macOS the CLI socket pathname exceeds the Unix domain socket limit
    // when the acceptance runner uses a long, isolated TMPDIR.
    ["remotion-synthetic-smoke", process.execPath, ["--import=tsx", "scripts/studio-render-isolation-smoke.mts", evidenceDir]],
];
let failed = false;
try {
  for (const [id, bin, args] of steps) {
    // Continue only if all preceding checks passed. Never run the Remotion test
    // with known typecheck/test failures or unknown approval state.
    const started = Date.now();
    const run = spawnSync(bin, args, { cwd: root, env, stdio: "inherit", shell: false });
    report.tests.push({ id, exitCode: run.status, signal: run.signal,
      seconds: Math.round((Date.now() - started) / 1000),
      state: run.status === 0 ? "PASS" : "FAIL" });
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
    if (run.status !== 0 || run.signal) { failed = true; break; }
  }
  const items = await readdir(testsTemp);
  report.temporaryResidue = items;
  const after = command("git", ["status", "--porcelain"]);
  if (after) { report.trackedWorktreeChanged = after; failed = true; }
  if (items.length) { report.temporaryClean = false; failed = true; }
  else report.temporaryClean = true;
} finally {
  report.finishedAt = new Date().toISOString();
  report.result = failed ? "FAIL" : "PASS_AUTOMATED_ONLY";
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
}
// Deliberately preserve the result/evidenceDir for an owner to audit. Only
// explicitly named owned scratch files may be removed after inspection.
console.log("Acceptance evidence:", reportPath);
if (failed) process.exitCode = 1;
