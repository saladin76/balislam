/**
 * Studio V2 QA-04: actual independent Node OS processes competing for the
 * SAME signed V2 scene ledger. This intentionally exercises the V2 store,
 * not the old six-stage workflow lock.
 *
 * Run this file ALONE on Mac before broader tests to avoid load spikes.
 * No production channel, existing temp path, or live process is touched.
 */
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readSceneLedgerV2, sceneV2FileFor, type SceneV2Scope } from "../src/workflow/sceneStoreV2";

const owned: string[] = [];
afterEach(async () => {
  for (const root of owned.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("QA-04: V2 cross-process lock and signed ledger", () => {
  it("only one of three Node processes can prepare the same future scene", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "studio-v2-qa-process-"));
    owned.push(root);
    const scope: SceneV2Scope = {
      channelsRoot: root, channel: "balislam", episode: "001-qa-concurrency",
    };
    const episode = path.join(root, scope.channel, "episodes", scope.episode);
    await mkdir(episode, { recursive: true });
    const order = ["c1-s1", "c1-s2"] as const;
    const key = "QA_ONLY_STUDIO_V2_CROSS_PROCESS_HMAC_20261108_LARGE_SECRET";
    const storeUrl = pathToFileURL(path.resolve("src/workflow/sceneStoreV2.ts")).href;
    const policyUrl = pathToFileURL(path.resolve("src/workflow/sceneV2.ts")).href;
    const script = [
      'import { mutateSceneLedgerV2 } from ' + JSON.stringify(storeUrl) + ';',
      'import { markScenePrepared } from ' + JSON.stringify(policyUrl) + ';',
      'const scope = JSON.parse(process.argv[1]);',
      'await mutateSceneLedgerV2(scope, ["c1-s1","c1-s2"], doc =>',
      '  markScenePrepared(doc, "c1-s2", "2026-11-08T08:00:00.000Z"));',
    ].join("\n");
    const runChild = () => new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
      const child = spawn(process.execPath,
        ["--import", "tsx", "--input-type=module", "-e", script, JSON.stringify(scope)],
        {
          cwd: path.resolve("."), shell: false, stdio: ["ignore", "ignore", "pipe"],
          env: { ...process.env, BAL_WORKFLOW_HMAC_KEY: key },
        });
      let stderr = "";
      child.stderr?.on("data", (buf: Buffer) => {
        if (stderr.length < 6000) stderr += buf.toString("utf8").slice(0, 6000 - stderr.length);
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stderr }));
    });
    const results = await Promise.all([runChild(), runChild(), runChild()]);
    expect(results.filter((x) => x.code === 0)).toHaveLength(1);
    expect(results.filter((x) => x.code !== 0)).toHaveLength(2);
    expect(results.filter((x) => x.code !== 0)
      .every((x) => /cannot be prepared/i.test(x.stderr))).toBe(true);

    const previous = process.env.BAL_WORKFLOW_HMAC_KEY;
    try {
      process.env.BAL_WORKFLOW_HMAC_KEY = key;
      const ledger = await readSceneLedgerV2(scope, order);
      expect(ledger.events.filter((e) => e.action === "prepared")).toHaveLength(1);
      expect(ledger.scenes["c1-s2"]?.status).toBe("prepared");
      expect(ledger.scenes["c1-s1"]?.status).toBe("draft");
      const file = await sceneV2FileFor(scope);
      const persisted = JSON.parse(await readFile(file, "utf8"));
      expect(persisted.integrity).toMatchObject({ alg: "HMAC-SHA256" });
      expect(persisted.integrity.mac).toMatch(/^[a-f0-9]{64}$/);
      expect((await readdir(episode)).filter((name) =>
        name.endsWith(".lock") || name.endsWith(".tmp"))).toEqual([]);
    } finally {
      if (previous === undefined) delete process.env.BAL_WORKFLOW_HMAC_KEY;
      else process.env.BAL_WORKFLOW_HMAC_KEY = previous;
    }
  }, 30000);
});
