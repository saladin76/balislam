import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { withSceneArtifactLockV2 } from "../src/workflow/sceneLockV2.ts";
import { withSceneProductionLeaseV2, productionLeaseFileV2 } from "../src/workflow/sceneProductionLeaseV2.ts";
import { approveSceneSourcesV2, inspectSceneSourcesV2 } from "../src/workflow/sceneSourcesV2.ts";
import { writeTrustedSceneRenderSpecLockedV2, readTrustedSceneRenderSpecLockedV2 } from "../src/workflow/sceneRenderSpecV2.ts";
import { runTrustedSceneProductionV2 } from "../src/workflow/sceneRenderBridgeV2.ts";
import { mutateSceneLedgerV2, readSceneLedgerV2 } from "../src/workflow/sceneStoreV2.ts";
import { appendSceneNote, beginFinalSceneProduction, reconcileSceneInputs,
  requestSceneChanges, submitSceneAvReview, SCENE_INPUT_KEYS, type SceneInputs } from "../src/workflow/sceneV2.ts";
import { commitCurrentSceneRenderLockedV2, requireCurrentSceneRenderLockedV2 } from "../src/workflow/sceneRenderCommitV2.ts";
import type { WorkflowIdentity } from "../src/workflow/index.ts";
import type { TrustedSceneRenderSpecV2 } from "../src/workflow/sceneRenderSpecV2.ts";

process.env.BAL_WORKFLOW_HMAC_KEY = "BACKEND_PHASE2_ISOLATED_TEST_SIGNING_KEY_ONLY_0123456789";
const all: string[] = [];
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const manifest = (id: string) => ({
  sceneId: id, audioMode: "silent" as const,
  inputs: {
    original: { version: "v1", files: ["script.md"] },
    vocalized: { version: "v1", files: ["vocalized/source.json"] },
    tone: { version: "v1", files: ["tone/source.json"] },
    storyboard: { version: "v1", files: ["plan.json"] },
    assets: { version: "v1", files: ["assets/art.png"] },
    narration: { version: "v1", files: [] },
    sync: { version: "v1", files: ["sync/data.json"] },
    video: { version: "v1", files: [] },
    rights: { version: "v1", files: ["rights/check.json"] },
  }, shared: {},
});
const setup = async (two = false) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-phase2-backend-"));
  all.push(root);
  const scope: WorkflowIdentity = { channelsRoot: root, channel: "balislam", episode: "001-phase2" };
  const dir = path.join(root, "balislam", "episodes", "001-phase2");
  await mkdir(dir, { recursive: true });
  const plan = { version: 1, episode: "001", channel: "balislam",
    chapters: [{ number: 1, scenes: [
      { id: "c1-s1", narration: "" }, ...(two ? [{ id: "c1-s2", narration: "" }] : []),
    ] }] };
  const files = {
    "script.md": "Approved script and citations",
    "plan.json": JSON.stringify(plan),
    "vocalized/source.json": "{}",
    "tone/source.json": "{}",
    "assets/art.png": "safe-fixture",
    "sync/data.json": "{}",
    "rights/check.json": "{}",
  };
  for (const [name, value] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), value);
  }
  const source = await inspectSceneSourcesV2(scope);
  await approveSceneSourcesV2(scope, "script", source.script.fingerprint,
    "studio-owner", "Reviewed all script references");
  await approveSceneSourcesV2(scope, "storyboard", source.storyboard.fingerprint,
    "studio-owner", "Reviewed all visual scene boards");
  const spec = (id: string): TrustedSceneRenderSpecV2 => ({
    sceneId: id, orientation: "landscape", width: 320, height: 180,
    durationSec: 1.5, sounds: [], pictures: [], manifest: manifest(id),
  });
  const locked = <T>(job: () => Promise<T>) => withSceneArtifactLockV2(scope, job);
  await locked(() => writeTrustedSceneRenderSpecLockedV2(scope, spec("c1-s1")));
  if (two) await locked(() => writeTrustedSceneRenderSpecLockedV2(scope, spec("c1-s2")));
  return { scope, dir, spec, locked };
};
afterEach(async () => {
  await Promise.all(all.splice(0).map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("Studio V2 phase 2 trusted production boundary", () => {
  it("preserves a foreign production lease and never renders concurrently", async () => {
    const { scope } = await setup();
    const events: string[] = [];
    let entered!: () => void;
    const whenEntered = new Promise<void>((resolve) => { entered = resolve; });
    const first = withSceneProductionLeaseV2(scope, "c1-s1", async () => {
      events.push("first");
      entered();
      await new Promise((resolve) => setTimeout(resolve, 35));
    });
    await whenEntered;
    await expect(withSceneProductionLeaseV2(scope, "c1-s1",
      async () => events.push("second"))).rejects.toThrow(/PRODUCTION_BUSY/);
    await first;
    expect(events).toEqual(["first"]);
    const lock = await productionLeaseFileV2(scope);
    await writeFile(lock, "foreign-lease");
    await expect(withSceneProductionLeaseV2(scope, "c1-s1", async () => 1))
      .rejects.toThrow(/PRODUCTION_BUSY/);
    expect(await readFile(lock, "utf8")).toBe("foreign-lease");
  });

  it("denies a separate Node process while the first process owns the episode lease", async () => {
    const { scope, dir } = await setup();
    const ready = path.join(dir, "process-ready.signal");
    const release = path.join(dir, "process-release.signal");
    const moduleFile = path.join(import.meta.dirname, "..", "src", "workflow",
      "sceneProductionLeaseV2.ts");
    const source = `
      import { writeFile, access } from "node:fs/promises";
      import { pathToFileURL } from "node:url";
      const { withSceneProductionLeaseV2 } = await import(
        pathToFileURL(process.env.STUDIO_V2_TEST_MODULE).href);
      await withSceneProductionLeaseV2(
        JSON.parse(process.env.STUDIO_V2_TEST_SCOPE), "c1-s1", async () => {
          await writeFile(process.env.STUDIO_V2_TEST_READY, "owned");
          const deadline = Date.now() + 18000;
          while (Date.now() < deadline) {
            if (await access(process.env.STUDIO_V2_TEST_RELEASE).then(() => true)
              .catch(() => false)) return;
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
          throw Error("Timed out awaiting parent release signal");
        });
    `;
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module",
      "-e", source], {
      cwd: path.join(import.meta.dirname, ".."),
      stdio: ["ignore", "ignore", "pipe"], shell: false,
      env: { ...process.env, STUDIO_V2_TEST_MODULE: moduleFile,
        STUDIO_V2_TEST_SCOPE: JSON.stringify(scope),
        STUDIO_V2_TEST_READY: ready, STUDIO_V2_TEST_RELEASE: release },
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 2000) stderr += chunk.toString("utf8").slice(0, 2000-stderr.length);
    });
    try {
      const deadline = Date.now() + 15000;
      while (!(await access(ready).then(() => true).catch(() => false))) {
        if (child.exitCode !== null || Date.now() > deadline)
          throw Error("Independent lease worker did not start: " + stderr);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await expect(withSceneProductionLeaseV2(scope, "c1-s1", async () => {
        throw Error("UNSAFE: simultaneous production entered");
      })).rejects.toThrow(/PRODUCTION_BUSY/);
      await writeFile(release, "release");
      const code = await new Promise<number | null>((resolve, reject) => {
        if (child.exitCode !== null) return resolve(child.exitCode);
        child.once("exit", resolve);
        child.once("error", reject);
      });
      expect(code, stderr).toBe(0);
      expect(await access(await productionLeaseFileV2(scope)).then(() => true)
        .catch(() => false)).toBe(false);
    } finally {
      child.kill("SIGKILL");
    }
  }, 30000);

  it("refuses to replay a signed render receipt after a second owner begin generation", async () => {
    const { scope, locked } = await setup();
    const order = ["c1-s1"];
    const firstAt = new Date().toISOString();
    await locked(() => mutateSceneLedgerV2(scope, order, (doc) =>
      beginFinalSceneProduction(doc, "c1-s1", firstAt, () => {})));
    const proof = {
      jobId: randomUUID(), fingerprint: sha("old-current-scene"),
      videoSha256: sha("old-mp4"), videoEpoch: sha("old-epoch"),
    };
    await locked(() => commitCurrentSceneRenderLockedV2(scope, "c1-s1",
      order, proof.jobId, proof.fingerprint, proof.videoSha256, proof.videoEpoch));
    await locked(() => requireCurrentSceneRenderLockedV2(scope, "c1-s1", order, proof));
    const inputs = Object.fromEntries(SCENE_INPUT_KEYS.map((key) =>
      [key, { version: "test", sha256: sha(key), epoch: sha("epoch-" + key) }])) as unknown as SceneInputs;
    inputs.shared = {};
    await locked(() => mutateSceneLedgerV2(scope, order, (doc) => {
      reconcileSceneInputs(doc, "c1-s1", inputs, new Date().toISOString());
      submitSceneAvReview(doc, "c1-s1", new Date().toISOString());
      requestSceneChanges(doc, "c1-s1", {
        at: new Date().toISOString(), text: "Old AV must be revised",
      });
      beginFinalSceneProduction(doc, "c1-s1", new Date().toISOString(), () => {});
    }));
    await expect(locked(() =>
      requireCurrentSceneRenderLockedV2(scope, "c1-s1", order, proof)))
      .rejects.toThrow(/older owner begin generation/);
  });

  it("signs server-owned render configuration and rejects changed sources and forged inputs", async () => {
    const { scope, dir, locked } = await setup();
    expect((await locked(() => readTrustedSceneRenderSpecLockedV2(scope, "c1-s1"))).sceneId)
      .toBe("c1-s1");
    const specFile = path.join(dir, ".studio-v2-render-specs", "c1-s1.json");
    const content = JSON.parse(await readFile(specFile, "utf8"));
    content.spec.sounds = [{ file: "/tmp/forged.mp3", sha256: sha("fake"), kind: "narrator" }];
    await writeFile(specFile, JSON.stringify(content));
    await expect(locked(() => readTrustedSceneRenderSpecLockedV2(scope, "c1-s1")))
      .rejects.toThrow(/Forged/);
  });

  it("rejects a changed-and-restored plan generation after trusted input signing", async () => {
    const { scope, dir, locked } = await setup();
    const filename = path.join(dir, "plan.json");
    const original = await readFile(filename);
    await writeFile(filename, "{ }");
    await writeFile(filename, original);
    await expect(locked(() => readTrustedSceneRenderSpecLockedV2(scope, "c1-s1")))
      .rejects.toThrow(/Source signoff changed/);
  });

  it("refuses to invoke Render before explicit begin even with signed sources and config", async () => {
    const { scope } = await setup();
    const renderer = vi.fn();
    await expect(runTrustedSceneProductionV2(scope, "c1-s1", {
      renderer, ffprobeBinary: "/bin/echo", verifySourceReview: async () => {},
    })).rejects.toThrow(/explicit owner begin/);
    expect(renderer).not.toHaveBeenCalled();
  });

  it("builds a source-only request and rechecks current bytes in the Render adapter", async () => {
    const { scope, dir } = await setup();
    await mutateSceneLedgerV2(scope, ["c1-s1"], (ledger) =>
      beginFinalSceneProduction(ledger, "c1-s1", new Date().toISOString(), () => {}));
    const renderer = vi.fn(async (r: any, deps: any) => {
      expect(r.planSha256).toBe(sha(await readFile(path.join(dir, "plan.json"), "utf8")));
      expect(r.sounds).toEqual([]);
      expect(r.pictures).toEqual([]);
      await deps.withArtifactLock(async () => deps.assertCanRender(r));
      // Simulate tampering AFTER the render worker's first gate and BEFORE publish.
      await writeFile(path.join(dir, "rights/check.json"), '{"changed":true}');
      await expect(deps.withArtifactLock(async () => deps.assertCanRender(r)))
        .rejects.toThrow(/changed even if their bytes were restored/);
      return { status: "failed" as const };
    });
    await expect(runTrustedSceneProductionV2(scope, "c1-s1", {
      renderer, ffprobeBinary: "/bin/echo", verifySourceReview: async () => {},
    })).rejects.toThrow(/V2_RENDER_FAILED/);
    expect(renderer).toHaveBeenCalledTimes(1);
  });

  it("persists timecoded owner notes in a signed ledger without granting approval", async () => {
    const { scope, locked } = await setup();
    await locked(async () => mutateSceneLedgerV2(scope, ["c1-s1"], (ledger) =>
      appendSceneNote(ledger, "c1-s1", {
        text: "Camera transition needs revision", second: 1.25, elementId: "shot-2",
      }, new Date().toISOString())));
    const doc = await readSceneLedgerV2(scope, ["c1-s1"]);
    expect(doc.scenes["c1-s1"]?.status).toBe("draft");
    expect(doc.scenes["c1-s1"]?.approval).toBeUndefined();
    expect(doc.scenes["c1-s1"]?.notes[0]?.second).toBe(1.25);
    expect(doc.events.at(-1)?.action).toBe("noted");
  });

  it("rejects final scene 2 before scene 1 approval with no Render side effects", async () => {
    const { scope } = await setup(true);
    const renderer = vi.fn();
    await expect(runTrustedSceneProductionV2(scope, "c1-s2", {
      renderer, ffprobeBinary: "/bin/echo", verifySourceReview: async () => {},
    })).rejects.toThrow();
    expect(renderer).not.toHaveBeenCalled();
  });
});
