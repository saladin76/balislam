#!/usr/bin/env node
/**
 * Studio V2 QA-08 dependency triage. Reads npm audit without upgrading packages.
 * Distinguishes registry-reported severity from confirmed application exploitability.
 */
import { spawnSync, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const report = { task: "Studio V2 QA-08 dependency security audit", sha: null, overall: "NOT TESTED", scans: [] };
if (!existsSync(path.join(root, "package-lock.json"))) {
  report.overall = "BLOCKED";
  report.reason = "package-lock.json absent; audit must run against exact pinned checkout";
} else {
  report.sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  for (const [profile, args] of [
    ["all-dependencies", ["audit", "--json", "--audit-level=high"]],
    ["production-only", ["audit", "--json", "--omit=dev", "--audit-level=high"]],
  ]) {
    const result = spawnSync("npm", args, { cwd: root, encoding: "utf8", timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
    let data;
    try { data = JSON.parse(result.stdout); } catch {
      report.scans.push({ profile, status: "BLOCKED", reason: "npm registry unavailable or malformed audit response; code=" + result.status });
      continue;
    }
    if (!data || data.error || !data.metadata?.vulnerabilities) {
      report.scans.push({ profile, status: "BLOCKED", reason: data?.error?.summary ?? "Audit registry/lockfile failure" });
      continue;
    }
    const vulnerabilities = Object.entries(data.vulnerabilities ?? {})
      .filter(([, v]) => ["high", "critical"].includes(v.severity))
      .map(([name, v]) => ({
        package: name, severity: v.severity, direct: v.isDirect,
        range: v.range, nodes: v.nodes, fixAvailable: v.fixAvailable,
        advisories: (v.via ?? []).filter((x) => typeof x === "object").map((x) => ({
          title: x.title, url: x.url, range: x.range, source: x.source, severity: x.severity,
        })),
        affects: v.effects,
        reachability: "NOT TESTED — needs code path/entrypoint analysis",
      }));
    report.scans.push({
      profile, status: "PASS",
      meaning: "npm audit query completed, NOT vulnerability remediation",
      counts: data.metadata.vulnerabilities,
      highOrCritical: vulnerabilities,
      manualReviewRequired: vulnerabilities.length > 0,
    });
  }
  report.overall = report.scans.every((x) => x.status === "PASS") ? "PASS" : "BLOCKED";
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.overall === "PASS" ? 0 : 2;
