#!/usr/bin/env node
/**
 * Exact-head Quran/audio technical QA. Requires existing node_modules and FFmpeg.
 * No external keys, network requests, uploads, episode edits or output artifacts.
 * The script itself does not grant any scholarly or listening approvals.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

const expectedBranch = "work/studio-quran-audio-20261107";
const base = "integration/studio-20261107-release-candidate";
const run = (command, args, opts = {}) => {
  const result = spawnSync(command, args, {
    encoding: "utf8", maxBuffer: 20 * 1024 * 1024, ...opts,
  });
  return { exit: result.error ? -1 : (result.status ?? -1),
    stdout: result.stdout?.trim() ?? "", stderr: (result.stderr ?? result.error?.message ?? "").trim() };
};
const git = (...args) => run("git", args);
const branch = git("branch", "--show-current");
const actualBranch = branch.stdout || process.env.GITHUB_HEAD_REF || "";
const sha = git("rev-parse", "HEAD");
const ffmpeg = run("ffmpeg", ["-version"]);
const summary = {
  scope: "quran-audio", expectedBranch,
  branch: actualBranch, sha: sha.stdout,
  generatedAt: new Date().toISOString(),
  prerequisites: { git: sha.exit === 0, ffmpeg: ffmpeg.exit === 0 },
  tests: [],
  acceptance: "TECHNICAL_ONLY_HUMAN_REVIEW_REQUIRED",
};
if (branch.exit !== 0 || sha.exit !== 0 || actualBranch !== expectedBranch || ffmpeg.exit !== 0) {
  summary.error = "Run from the sole Quran/audio branch with FFmpeg installed; no checks were executed.";
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  process.exit(2);
}
let changed = git("diff", "--name-only", `${base}...HEAD`);
let diffBase = base;
if (changed.exit !== 0) {
  diffBase = `origin/${base}`;
  changed = git("diff", "--name-only", `${diffBase}...HEAD`);
}
if (changed.exit !== 0) {
  summary.error = "Cannot resolve the integration base locally or in origin; no scoped verification was possible.";
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  process.exit(2);
}
summary.diffBase = diffBase;
const files = changed.stdout.split("\n").filter(Boolean);
summary.scopedChanges = files.length;
const forbidden = files.filter((file) =>
  file === "src/plan/collect.ts" || file.startsWith("src/render/") ||
  file.startsWith("channels/") || file.startsWith(".github/"));
summary.forbiddenChanges = forbidden;
if (forbidden.length) {
  summary.error = "Renderer, channel episode, or shared CI files were modified; stop before testing.";
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  process.exit(2);
}
const groups = [
  ["TypeScript typecheck", "npm", ["run", "typecheck"]],
  ["All repository Vitest suites", "npm", ["test"]],
];
for (const [name, command, args] of groups) {
  const started = Date.now();
  const result = spawnSync(command, args, { stdio: "inherit" });
  summary.tests.push({ name, command: [command, ...args].join(" "),
    durationMs: Date.now() - started, exit: result.error ? -1 : (result.status ?? -1) });
  if (result.status !== 0 || result.error) break;
}
summary.technicalChecksPassed = summary.tests.length === groups.length &&
  summary.tests.every((item) => item.exit === 0);
process.stdout.write("\n" + JSON.stringify(summary, null, 2) + "\n");
process.exit(summary.technicalChecksPassed ? 0 : 1);
