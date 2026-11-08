#!/usr/bin/env node
/**
 * QA-09: sequentially repeat the EXACT unchanged render-pool retry case.
 * No global timeout changes, skips, mocks in production, npm install or
 * modification of any source. Only runs from a pinned reviewed pool/test blob.
 *
 * Usage (after npm ci): node scripts/qa/studio-v2-qa09-render-pool-replay.mjs 12
 */
import { spawnSync, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const report = {
  task: "Studio V2 QA-09 unchanged legacy retry replay",
  verdict: "NOT TESTED", source: "actual tests/render-pool.test.ts + src/render/pool.ts",
  combinedReference: "40b4d07ebc243e926694c5681f7721fe2899c1b6",
  attempts: [],
};
const expected = {
  "src/render/pool.ts": "f3f3212bab49225123bb7e3e7005bc0457357c94",
  "tests/render-pool.test.ts": "86894ce6b1849e74be5795dc87e6233b820b0f21",
};
const refused = (reason) => { report.verdict = "BLOCKED"; report.reason = reason; };
const n = Number(process.argv[2] ?? "12");
if (!Number.isSafeInteger(n) || n < 1 || n > 30) refused("Use an integer repeat count 1..30");
if (report.verdict !== "BLOCKED") {
  try {
    report.checkoutSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    for (const [name, sha] of Object.entries(expected)) {
      const actual = execFileSync("git", ["hash-object", name], { cwd: root, encoding: "utf8" }).trim();
      if (actual !== sha) { refused("Underlying pool/test blobs changed: " + name); break; }
    }
  } catch (error) { refused("Cannot establish exact source SHA: " + String(error)); }
}
const vitest = path.join(root, "node_modules", "vitest", "vitest.mjs");
if (report.verdict !== "BLOCKED" && !existsSync(vitest))
  refused("Install pinned node_modules with npm ci first; no auto-install permitted");
if (report.verdict !== "BLOCKED") {
  const marker = "إعادة المحاولة تعيد الفاشل وحده، مرة واحدة";
  for (let i = 0; i < n; i++) {
    const begun = Date.now();
    const r = spawnSync(process.execPath, [
      vitest, "run", "tests/render-pool.test.ts", "-t", marker, "--maxWorkers=1",
    ], {
      cwd: root, encoding: "utf8", timeout: 90_000, maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, CI: "1" },
    });
    const merged = (r.stdout ?? "") + "\n" + (r.stderr ?? "");
    const outcome = {
      index: i + 1, status: r.status === 0 ? "PASS" : "FAIL",
      elapsedMs: Date.now() - begun, exitCode: r.status,
      signal: r.signal,
      ...(r.status !== 0 ? {
        snippet: merged.split("\n")
          .filter((line) => /FAIL|AssertionError|expected|Received|no-output|render-error|unknown|error TS|timed out|Error:| ❯ /.test(line))
          .slice(-22).map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").slice(0, 240)),
        failure: r.error ? String(r.error) : undefined,
      } : {}),
    };
    report.attempts.push(outcome);
    if (r.status !== 0) break; // preserve first concrete failing evidence
  }
  report.verdict = report.attempts.every((x) => x.status === "PASS") ? "PASS" : "FAIL";
  report.caveat = "PASS = exact legacy test passed in sequential isolation ONLY; not integrated full CI or V2 E2E";
}
report.counts = {
  PASS: report.attempts.filter((x) => x.status === "PASS").length,
  FAIL: report.attempts.filter((x) => x.status === "FAIL").length,
  BLOCKED: report.verdict === "BLOCKED" ? 1 : 0,
};
const evidence = process.env.STUDIO_V2_QA_EVIDENCE_DIR;
if (evidence) {
  const target = path.resolve(evidence);
  if (target.startsWith(root + path.sep) &&
      target.split(path.sep).includes(".studio-v2-qa-evidence")) {
    await mkdir(target, { recursive: true, mode: 0o700 });
    await writeFile(path.join(target, "qa09-render-pool-replay.json"), JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  } else {
    report.verdict = "BLOCKED";
    report.reason = "Evidence must remain under this checkout's .studio-v2-qa-evidence directory";
  }
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.verdict === "PASS" ? 0 : report.verdict === "FAIL" ? 1 : 2;
