/**
 * Studio V2 QA-04: scene-first regression matrix.
 *
 * Pure policy tests only: these do NOT prove production API/queue/render/UI
 * integration, a human AV review, or a real Master signoff.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  SCENE_INPUT_KEYS, approveSceneAv, assemblySceneFingerprint,
  assertCanProduceScene, beginFinalSceneProduction, createSceneLedger,
  isSceneApproved, markScenePrepared, reconcileSceneInputs,
  requestSceneChanges, submitSceneAvReview,
  type SceneArtifact, type SceneInputKey, type SceneInputs,
  type SceneLedgerV2,
} from "../src/workflow/sceneV2";

const date = "2026-11-08T08:00:00.000Z";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const artifact = (label: string): SceneArtifact => ({
  version: "qa-v1", sha256: sha("bytes:" + label), epoch: sha("epoch:" + label),
});
const order = ["c1-s1", "c1-s2", "c1-s3"];
const material = (id: string, shared: Record<string, SceneArtifact> = {}): SceneInputs =>
  ({ ...Object.fromEntries(SCENE_INPUT_KEYS.map((key) =>
    [key, artifact(id + ":" + key)])), shared }) as SceneInputs;

const create = () => createSceneLedger("balislam", "001-qa", order);

const approve = (doc: SceneLedgerV2, scene: string, inputs = material(scene)) => {
  reconcileSceneInputs(doc, scene, inputs, date);
  beginFinalSceneProduction(doc, scene, date, () => undefined);
  const expectedFingerprint = submitSceneAvReview(doc, scene, date);
  approveSceneAv(doc, scene, {
    ownerId: "studio-owner",
    expectedFingerprint,
    reviewedAvSha256: inputs.video.sha256,
    at: date,
  }, () => undefined); // trusted verifier fixture, not real owner-view evidence
  expect(isSceneApproved(doc, scene)).toBe(true);
  return inputs;
};

describe("QA-04: scene-first acceptance regressions (pure policy)", () => {
  it("permits speculative future preparation but not out-of-order production or approval", () => {
    const doc = create();
    markScenePrepared(doc, "c1-s3", date);
    markScenePrepared(doc, "c1-s2", date);
    expect(doc.scenes["c1-s3"]?.status).toBe("prepared");
    expect(isSceneApproved(doc, "c1-s3")).toBe(false);
    expect(() => assertCanProduceScene(doc, "c1-s3")).toThrow(/c1-s1/);
    expect(() => beginFinalSceneProduction(doc, "c1-s2", date, () => undefined))
      .toThrow(/c1-s1/);
    approve(doc, "c1-s1");
    expect(() => beginFinalSceneProduction(doc, "c1-s3", date, () => undefined))
      .toThrow(/c1-s2/);
    approve(doc, "c1-s2");
    beginFinalSceneProduction(doc, "c1-s3", date, () => undefined);
    expect(doc.scenes["c1-s3"]?.status).toBe("producing");
    expect(() => assemblySceneFingerprint(doc)).toThrow(/c1-s3/);
  });

  it.each([...SCENE_INPUT_KEYS])(
    "invalidates an approved scene on a changed %s, without collateral revocation or rollback resurrection",
    (key: SceneInputKey) => {
      const doc = create();
      approve(doc, "c1-s1");
      const original = approve(doc, "c1-s2");
      approve(doc, "c1-s3");
      const assemblyBefore = assemblySceneFingerprint(doc);
      const changed: SceneInputs = {
        ...structuredClone(original),
        [key]: artifact("changed:" + key),
      };
      expect(reconcileSceneInputs(doc, "c1-s2", changed, date)).toBe(true);
      expect(isSceneApproved(doc, "c1-s1")).toBe(true);
      expect(isSceneApproved(doc, "c1-s2")).toBe(false);
      expect(isSceneApproved(doc, "c1-s3")).toBe(true);
      expect(() => assemblySceneFingerprint(doc)).toThrow(/c1-s2/);
      // Exact original input snapshot is restored (even its simulated epoch).
      // The revoked event remains revoked: no resurrection of old signoffs.
      expect(reconcileSceneInputs(doc, "c1-s2", original, date)).toBe(true);
      expect(isSceneApproved(doc, "c1-s2")).toBe(false);
      expect(doc.scenes["c1-s2"]?.status).toBe("needs_reapproval");
      beginFinalSceneProduction(doc, "c1-s2", date, () => undefined);
      const fingerprint = submitSceneAvReview(doc, "c1-s2", date);
      approveSceneAv(doc, "c1-s2", {
        ownerId: "studio-owner", expectedFingerprint: fingerprint,
        reviewedAvSha256: original.video.sha256, at: date,
      }, () => undefined);
      expect(isSceneApproved(doc, "c1-s2")).toBe(true);
      expect(assemblySceneFingerprint(doc)).not.toBe(assemblyBefore);
    },
  );

  it("invalidates only the consumers of a shared asset, not unrelated scenes", () => {
    const doc = create();
    const first = approve(doc, "c1-s1", material("c1-s1", { backdrop: artifact("bg-v1") }));
    const second = approve(doc, "c1-s2", material("c1-s2", { backdrop: artifact("bg-v1") }));
    approve(doc, "c1-s3", material("c1-s3"));
    reconcileSceneInputs(doc, "c1-s1", {
      ...first, shared: { backdrop: artifact("bg-v2") },
    }, date);
    reconcileSceneInputs(doc, "c1-s2", {
      ...second, shared: { backdrop: artifact("bg-v2") },
    }, date);
    expect(order.map((id) => isSceneApproved(doc, id))).toEqual([false, false, true]);
    reconcileSceneInputs(doc, "c1-s1", first, date);
    expect(order.map((id) => isSceneApproved(doc, id))).toEqual([false, false, true]);
  });

  it("an AV change request revokes the current scene without modifying unrelated signed approvals", () => {
    const doc = create();
    approve(doc, "c1-s1");
    approve(doc, "c1-s2");
    approve(doc, "c1-s3");
    requestSceneChanges(doc, "c1-s2", {
      at: date, second: 7.5, elementId: "voice", text: "Slow down narration at 00:07",
    });
    expect(doc.scenes["c1-s2"]?.notes.at(-1)).toMatchObject({
      second: 7.5, elementId: "voice",
    });
    expect(doc.scenes["c1-s2"]?.status).toBe("changes_requested");
    expect(isSceneApproved(doc, "c1-s2")).toBe(false);
    expect(isSceneApproved(doc, "c1-s1")).toBe(true);
    expect(isSceneApproved(doc, "c1-s3")).toBe(true);
    expect(() => assemblySceneFingerprint(doc)).toThrow(/c1-s2/);
  });

  it("a fake server verifier and synthetic artifacts never create a full-episode or Master approval", () => {
    const doc = create();
    for (const scene of order) approve(doc, scene);
    const eligibility = assemblySceneFingerprint(doc);
    expect(eligibility).toMatch(/^[a-f0-9]{64}$/);
    // Scene eligibility is the ONLY output of this domain model. Master and
    // publication must require separate real-file + owner-verification gates.
    expect(Object.keys(doc)).not.toContain("masterApproval");
    expect(Object.keys(doc)).not.toContain("publishApproval");
    expect(doc.events.every((event) => event.action !== ("published" as string))).toBe(true);
  });
});
