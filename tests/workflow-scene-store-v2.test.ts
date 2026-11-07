import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  type SceneInputs, SCENE_INPUT_KEYS, reconcileSceneInputs,
  beginFinalSceneProduction, submitSceneAvReview, approveSceneAv,
  isSceneApproved,
} from "../src/workflow/sceneV2";
import {
  readSceneLedgerV2, mutateSceneLedgerV2, sceneV2FileFor,
  type SceneV2Scope,
} from "../src/workflow/sceneStoreV2";

process.env.BAL_WORKFLOW_HMAC_KEY = "TEST_ONLY_SCENE_V2_HMAC_KEY_IS_RANDOM_ENOUGH_FOR_UNIT_TESTS";
const roots: string[] = [];
const order = ["c1-s1", "c1-s2"] as const;
const clock = "2026-11-07T20:00:00.000Z";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const artifact = (id: string) => ({
  version: "v1", sha256: digest(id), epoch: digest("epoch:" + id),
});
const inputs = (id: string): SceneInputs => ({
  ...Object.fromEntries(SCENE_INPUT_KEYS.map((name) => [name, artifact(id + ":" + name)])),
  shared: {},
}) as SceneInputs;

const make = async (channel = "balislam", episode = "001-intro") => {
  const channelsRoot = await mkdtemp(path.join(os.tmpdir(), "studio-scene-v2-"));
  roots.push(channelsRoot);
  const dir = path.join(channelsRoot, channel, "episodes", episode);
  await mkdir(dir, { recursive: true });
  const scope: SceneV2Scope = { channelsRoot, channel, episode };
  return { scope, dir };
};
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const stage = async (scope: SceneV2Scope) => {
  await mutateSceneLedgerV2(scope, order, (doc) =>
    reconcileSceneInputs(doc, "c1-s1", inputs("c1-s1"), clock));
  await mutateSceneLedgerV2(scope, order, (doc) =>
    beginFinalSceneProduction(doc, "c1-s1", clock));
  return mutateSceneLedgerV2(scope, order, (doc) =>
    submitSceneAvReview(doc, "c1-s1", clock));
};
const approve = (scope: SceneV2Scope, fp: string) =>
  mutateSceneLedgerV2(scope, order, (doc) =>
    approveSceneAv(doc, "c1-s1", {
      ownerId: "studio-owner", expectedFingerprint: fp,
      reviewedAvSha256: inputs("c1-s1").video.sha256, at: clock,
    }, () => undefined));

describe("Studio V2 — durable per-scene AV ledger", () => {
  it("initializes only the new V2 ledger, never a historical six-stage approval", async () => {
    const { scope, dir } = await make();
    await writeFile(path.join(dir, "workflow-approvals.json"), "legacy v3 ledger");
    const doc = await readSceneLedgerV2(scope, order);
    expect(doc.schemaVersion).toBe(1);
    expect(doc.scenes["c1-s1"]?.status).toBe("draft");
    await stage(scope);
    const file = await sceneV2FileFor(scope);
    expect(path.basename(file)).toBe("scene-workflow.v2.json");
    expect((await readFile(path.join(dir, "workflow-approvals.json"), "utf8"))).toBe("legacy v3 ledger");
    expect((await readSceneLedgerV2(scope, order)).scenes["c1-s1"]?.status).toBe("in_review");
  });

  it("persists signed approval and verifies it across reads", async () => {
    const { scope } = await make();
    const fp = await stage(scope);
    await approve(scope, fp);
    const saved = JSON.parse(await readFile(await sceneV2FileFor(scope), "utf8"));
    expect(saved.integrity).toMatchObject({ alg: "HMAC-SHA256" });
    expect(saved.integrity.mac).toMatch(/^[a-f0-9]{64}$/);
    const loaded = await readSceneLedgerV2(scope, order);
    expect(isSceneApproved(loaded, "c1-s1")).toBe(true);
    expect(loaded.scenes["c1-s1"]?.approval?.avSha256).toBe(inputs("c1-s1").video.sha256);
  });

  it("rejects tampered signed ledger and never recreates a blank one", async () => {
    const { scope } = await make();
    await stage(scope);
    const file = await sceneV2FileFor(scope);
    const saved = await readFile(file, "utf8");
    const forged = JSON.parse(saved);
    forged.scenes["c1-s1"].status = "approved";
    await writeFile(file, JSON.stringify(forged));
    await expect(readSceneLedgerV2(scope, order)).rejects.toThrow(/Corrupted|forged/);
    expect(await readFile(file, "utf8")).not.toBe(saved);
  });

  it("rejects stale storyboard scene order instead of converting previous approvals", async () => {
    const { scope } = await make();
    await stage(scope);
    await expect(readSceneLedgerV2(scope, ["c1-s2", "c1-s1"])).rejects.toThrow(/Corrupted|out-of-date/);
    await expect(readSceneLedgerV2(scope, ["c1-s1", "c1-s2", "c1-s3"])).rejects.toThrow(/Corrupted|out-of-date/);
  });

  it("serializes two concurrent owners so they cannot both approve a single AV version", async () => {
    const { scope } = await make();
    const fp = await stage(scope);
    const results = await Promise.allSettled([approve(scope, fp), approve(scope, fp)]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((x) => x.status === "rejected")).toHaveLength(1);
    const loaded = await readSceneLedgerV2(scope, order);
    expect(loaded.events.filter((e) => e.action === "approved")).toHaveLength(1);
    expect(isSceneApproved(loaded, "c1-s1")).toBe(true);
  });

  it("does not write a partial state after an aborted or asynchronous mutation", async () => {
    const { scope } = await make();
    const fp = await stage(scope);
    const file = await sceneV2FileFor(scope);
    const before = await readFile(file, "utf8");
    await expect(mutateSceneLedgerV2(scope, order, (doc) => {
      approveSceneAv(doc, "c1-s1", {
        ownerId: "studio-owner", expectedFingerprint: fp,
        reviewedAvSha256: inputs("c1-s1").video.sha256, at: clock,
      }, () => { throw Error("AV evidence missing"); });
    })).rejects.toThrow(/AV evidence missing/);
    expect(await readFile(file, "utf8")).toBe(before);
    await expect(mutateSceneLedgerV2(scope, order,
      () => Promise.resolve("unsafe") as never)).rejects.toThrow(/Async mutations/);
    expect(await readFile(file, "utf8")).toBe(before);
  });

  it("isolates independent channels and episodes", async () => {
    const a = await make("balislam", "001-first");
    const b = await make("dafatir-alzaman", "001-first");
    const c = await make("balislam", "002-other");
    await Promise.all([stage(a.scope), stage(b.scope)]);
    const fp = (await readSceneLedgerV2(a.scope, order)).scenes["c1-s1"]!.submittedFingerprint!;
    await approve(a.scope, fp);
    expect(isSceneApproved(await readSceneLedgerV2(a.scope, order), "c1-s1")).toBe(true);
    expect(isSceneApproved(await readSceneLedgerV2(b.scope, order), "c1-s1")).toBe(false);
    expect((await readSceneLedgerV2(c.scope, order)).events).toHaveLength(0);
  });

  it("refuses symlinked episode roots and foreign path selectors", async () => {
    const { scope, dir } = await make();
    const foreign = path.join(path.dirname(dir), "002-foreign");
    await mkdir(foreign);
    await symlink(foreign, path.join(path.dirname(dir), "003-linked"));
    await expect(sceneV2FileFor({ ...scope, episode: "003-linked" }))
      .rejects.toThrow(/redirects|outside/);
    await expect(sceneV2FileFor({ ...scope, episode: "../002-foreign" }))
      .rejects.toThrow(/Invalid/);
  });

  it("fails closed if the server signing key is absent", async () => {
    const { scope } = await make();
    const secret = process.env.BAL_WORKFLOW_HMAC_KEY;
    try {
      delete process.env.BAL_WORKFLOW_HMAC_KEY;
      await expect(readSceneLedgerV2(scope, order)).rejects.toThrow(/signing key/);
    } finally {
      process.env.BAL_WORKFLOW_HMAC_KEY = secret;
    }
  });
});
