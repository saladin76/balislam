import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { withSceneArtifactLockV2 } from "../src/workflow/sceneLockV2.ts";
import { withSceneProductionLeaseV2, productionLeaseFileV2 } from "../src/workflow/sceneProductionLeaseV2.ts";
import { approveSceneSourcesV2, inspectSceneSourcesV2 } from "../src/workflow/sceneSourcesV2.ts";
import { writeTrustedSceneRenderSpecLockedV2, readTrustedSceneRenderSpecLockedV2 } from "../src/workflow/sceneRenderSpecV2.ts";
import { runTrustedSceneProductionV2 } from "../src/workflow/sceneRenderBridgeV2.ts";
import { mutateSceneLedgerV2, readSceneLedgerV2 } from "../src/workflow/sceneStoreV2.ts";
import { appendSceneNote, beginFinalSceneProduction } from "../src/workflow/sceneV2.ts";
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
