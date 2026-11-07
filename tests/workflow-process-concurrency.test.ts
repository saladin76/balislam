import { afterEach, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { readWorkflow, workflowFileFor, type WorkflowIdentity } from "../src/workflow/store";
import { WORKFLOW_STAGES, type WorkflowSnapshot } from "../src/workflow/gates";

const tmp: string[] = [];
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const snapshot = (): WorkflowSnapshot => Object.fromEntries(
  WORKFLOW_STAGES.map((s) => [s, { version: s + "-v1", sha256: hash(s) }]));
afterEach(async () => {
  await Promise.all(tmp.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("workflow ledger cannot be double-submitted by separate Node processes", () => {
  it("keeps exactly one signed transition under simultaneous OS processes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "workflow-process-lock-")); tmp.push(root);
    const scope: WorkflowIdentity = { channelsRoot: root, channel: "balislam", episode: "001-concurrency" };
    await mkdir(path.join(root, "balislam", "episodes", scope.episode), { recursive: true });
    const worker = path.join(root, "worker.mts");
    const store = pathToFileURL(path.resolve("src/workflow/store.ts")).href;
    const gates = pathToFileURL(path.resolve("src/workflow/gates.ts")).href;
    const workerCode = [
      'import { submitWorkflowStage } from ' + JSON.stringify(store) + ';',
      'import { stageFingerprint } from ' + JSON.stringify(gates) + ';',
      'const scope = JSON.parse(process.argv[2]);',
      'const snapshot = JSON.parse(process.argv[3]);',
      'const fingerprint = stageFingerprint(snapshot, "script");',
      'await submitWorkflowStage(scope, { stage: "script", snapshot, expectedFingerprint: fingerprint,',
      '  actor: { id: "authenticated-process-reviewer", role: "reviewer" },',
      '  note: "Concurrently submitted from a separate trusted test worker." });',
    ].join("\n");
    await writeFile(worker, workerCode);
    const current = snapshot();
    const env = { ...process.env,
      BAL_WORKFLOW_HMAC_KEY: "LOCAL_TEST_ONLY__workflow_gates_256_bit_key_2026_testing" };
    const result = await Promise.all(Array.from({ length: 5 }, () =>
      new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
        const child = spawn(process.execPath, ["--import", "tsx", worker, JSON.stringify(scope), JSON.stringify(current)],
          { cwd: path.resolve("."), env, stdio: ["ignore", "ignore", "pipe"] });
        let stderr = "";
        child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
        child.on("error", reject);
        child.on("close", (code) => resolve({ code, stderr }));
      })));
    expect(result.filter((x) => x.code === 0)).toHaveLength(1);
    const failures = result.filter((x) => x.code !== 0);
    expect(failures).toHaveLength(4);
    expect(failures.every((x) => /current status|resubmitted|Stage cannot/i.test(x.stderr))).toBe(true);
    process.env.BAL_WORKFLOW_HMAC_KEY = env.BAL_WORKFLOW_HMAC_KEY;
    const doc = await readWorkflow(scope, current);
    expect(doc.revision).toBe(1);
    expect(doc.stages.script.status).toBe("in_review");
    expect(doc.history).toHaveLength(1);
    const file = await workflowFileFor(scope);
    expect(JSON.parse(await readFile(file, "utf8")).integrity.mac).toMatch(/^[a-f0-9]{64}$/);
  }, 30000);
});
