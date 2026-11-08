#!/usr/bin/env node
/**
 * Studio V2 QA-04 — READ-ONLY static wiring inventory.
 *
 * This scanner is NOT an integration test: matching a source reference cannot
 * prove the invocation is authorized, reachable, race-safe, or protected.
 * It emits BLOCKED when no production path references the V2 policy and
 * NOT TESTED otherwise. It never emits PASS or writes/deletes any file.
 */
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const expectedSource = [
  "src/workflow/sceneV2.ts",
  "src/workflow/sceneStoreV2.ts",
  "src/workflow/sceneServiceV2.ts",
  "src/workflow/sceneArtifactsV2.ts",
  "src/workflow/sceneMediaV2.ts",
];
const token = /\b(?:createTrustedSceneV2Service|readSceneLedgerV2|mutateSceneLedgerV2|assertCanProduceScene|assemblySceneFingerprint|sceneV2FileFor)\b|scene-workflow\.v2\.json/;
const containers = [
  { gate: "Backend HTTP", dirs: ["app/server"], must: ["app/server/api.ts"] },
  { gate: "Render worker and CLI", dirs: ["src/render", "src/cli", "app/server"], must: ["src/render/episode.ts", "src/cli/index.ts", "app/server/extra.ts"] },
  { gate: "Review UI", dirs: ["app/src"], must: ["app/src/api.ts"] },
  { gate: "Master / publication", dirs: ["src/package", "src/render", "app/server"], must: ["src/package/package.ts", "src/package/make.ts"] },
];
const walk = async (rel) => {
  const absolute = path.join(root, rel);
  if (!existsSync(absolute)) return [];
  const files = [];
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    const child = path.join(rel, entry.name);
    if (entry.isDirectory()) files.push(...await walk(child));
    if (entry.isFile() && /\.(?:ts|tsx|mjs)$/.test(child)) files.push(child);
  }
  return files;
};
const scan = async (files) => {
  const found = [];
  for (const name of [...new Set(files)]) {
    if (!existsSync(path.join(root, name))) continue;
    const body = await readFile(path.join(root, name), "utf8");
    const hits = body.split("\n").flatMap((line, i) =>
      token.test(line) ? [{ line: i + 1, text: line.trim().slice(0, 180) }] : []);
    if (hits.length) found.push({ file: name, hits });
  }
  return found;
};
const missingCore = expectedSource.filter((p) => !existsSync(path.join(root, p)));
const results = [];
for (const item of containers) {
  const files = (await Promise.all(item.dirs.map(walk))).flat();
  const matches = await scan([...files, ...item.must]);
  results.push({
    gate: item.gate,
    status: matches.length ? "NOT TESTED" : "BLOCKED",
    reason: matches.length
      ? "References found in source, but runtime side effects and approval wiring have NOT been verified."
      : "No direct V2 approval-engine reference located in the inspected production surface.",
    filesInspected: new Set([...files, ...item.must]).size,
    references: matches,
  });
}
let sha = null;
try { sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); }
catch { /* a detached code snapshot is not necessarily a Git worktree */ }
const report = {
  name: "Studio V2 QA-04 read-only production-wiring inventory",
  reference: "2d6523d61ccbf6dc434f887bd0b7548a1acd1250",
  checkoutSha: sha,
  method: "file-existence and token scan only; no actual runtime request, render or publishing attempted",
  missingCore,
  gates: results,
  finalProductionReadiness: "BLOCKED",
  limitations: [
    "Static references are NOT proof of executable authorization gates.",
    "A real session, queue execution, artifact writer lock, authenticated UI request, full AV receipt, exact Master review and publisher were not invoked.",
    "Only owned QA test artifacts may be created by the separate executable tests; this scanner creates none.",
  ],
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
if (missingCore.length) process.exitCode = 2;
