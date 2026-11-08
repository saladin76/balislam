/**
 * QA-08 harness integrity checks. These are NOT production E2E assertions:
 * only syntax and fail-closed behavior of the opt-in runners is exercised.
 * The 17 production TODO cases stay TODO until real integrations are run.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

const scripts = [
  "scripts/qa/studio-v2-phase2-live-http.mjs",
  "scripts/qa/studio-v2-phase2-real-render.mjs",
  "scripts/qa/studio-v2-phase2-security-audit.mjs",
  "scripts/qa/studio-v2-phase2-invalidation.mjs",
  "scripts/qa/studio-v2-phase2-integration-inventory.mjs",
];
const root = process.cwd();
const safeEnv = {
  ...process.env,
  STUDIO_V2_QA_BASE_URL: "",
  STUDIO_V2_QA_FIXTURE_DIR: "",
  STUDIO_V2_QA_EPISODE: "",
  STUDIO_V2_OWNER_SECRET: "",
  STUDIO_V2_QA_ALLOW_RENDER: "0",
  STUDIO_V2_QA_RENDER_SERIAL: "0",
  STUDIO_V2_QA_EVIDENCE: "0",
  STUDIO_V2_QA_ALLOW_WRITES: "0",
  STUDIO_V2_QA_MUTATE_APPROVED_AV: "0",
};

describe("Studio V2 QA-08 runner self-checks only (not E2E)", () => {
  it("all opt-in runner scripts parse under Node without execution", () => {
    for (const file of scripts) {
      const result = spawnSync(process.execPath, ["--check", path.join(root, file)], {
        cwd: root, encoding: "utf8", timeout: 12000,
      });
      expect(result.status, file + " " + result.stderr).toBe(0);
    }
  });
  it("live HTTP runner refuses to contact a server without explicit isolated fixture", () => {
    const result = spawnSync(process.execPath, [scripts[0]!, "--phase=security"], {
      cwd: root, env: safeEnv, encoding: "utf8", timeout: 12000,
    });
    expect(result.status).toBe(2);
    const report = JSON.parse(result.stdout);
    expect(report.status).toBe("BLOCKED");
    expect(report.summary.PASS).toBe(0);
    expect(report.checks[0].id).toBe("CONFIG");
  });
  it("actual Remotion runner stays blocked without explicit Mac-only opt-in", () => {
    const result = spawnSync(process.execPath, [scripts[1]!], {
      cwd: root, env: safeEnv, encoding: "utf8", timeout: 12000,
    });
    expect(result.status).toBe(2);
    const report = JSON.parse(result.stdout);
    expect(report.overall).toBe("BLOCKED");
    expect(report.totals.PASS).toBe(0);
  });
  it("approved-video mutation runner rejects unconsented editing", () => {
    const result = spawnSync(process.execPath, [scripts[3]!], {
      cwd: root, env: safeEnv, encoding: "utf8", timeout: 12000,
    });
    expect(result.status).toBe(2);
    const report = JSON.parse(result.stdout);
    expect(report.status).toBe("BLOCKED");
    expect(report.totals.PASS).toBe(0);
  });
});
