import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  SCENE_INPUT_KEYS, createSceneLedger, reconcileSceneInputs,
  assertCanProduceScene, markScenePrepared, beginFinalSceneProduction,
  submitSceneAvReview, approveSceneAv, isSceneApproved,
  requestSceneChanges, assemblySceneFingerprint, sceneFingerprint,
  type SceneInputs, type SceneLedgerV2,
} from "../src/workflow/sceneV2";

const now = "2026-11-07T20:00:00.000Z";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const artifact = (id: string) => ({
  version: "v1", sha256: digest(id), epoch: digest("epoch-" + id),
});
const inputs = (sceneId: string, shared: Record<string, ReturnType<typeof artifact>> = {}): SceneInputs => ({
  ...Object.fromEntries(SCENE_INPUT_KEYS.map((key) => [key, artifact(sceneId + "-" + key)])),
  shared,
}) as SceneInputs;

const ledger = () => createSceneLedger("balislam", "001-intro", ["c1-s1", "c1-s2", "c1-s3"]);
const verifier = (ev: { sceneId: string; fingerprint: string; avSha256: string; ownerId: string }) => {
  expect(ev.ownerId).toBe("studio-owner");
  expect(ev.avSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(ev.fingerprint).toMatch(/^[a-f0-9]{64}$/);
};

const approve = (doc: SceneLedgerV2, sceneId: string, material = inputs(sceneId)) => {
  reconcileSceneInputs(doc, sceneId, material, now);
  beginFinalSceneProduction(doc, sceneId, now, () => undefined);
  const fingerprint = submitSceneAvReview(doc, sceneId, now);
  approveSceneAv(doc, sceneId, {
    ownerId: "studio-owner", expectedFingerprint: fingerprint,
    reviewedAvSha256: material.video.sha256, at: now,
  }, verifier);
  expect(isSceneApproved(doc, sceneId)).toBe(true);
  return material;
};

describe("Studio V2 — AV scene as the approval unit", () => {
  it("allows asset preparation for later scenes but forbids final production out of order", () => {
    const doc = ledger();
    markScenePrepared(doc, "c1-s3", now);
    expect(doc.scenes["c1-s3"]?.status).toBe("prepared");
    expect(() => beginFinalSceneProduction(doc, "c1-s2", now, () => undefined)).toThrow(/c1-s1/);
    approve(doc, "c1-s1");
    expect(() => beginFinalSceneProduction(doc, "c1-s3", now, () => undefined)).toThrow(/c1-s2/);
    approve(doc, "c1-s2");
    beginFinalSceneProduction(doc, "c1-s3", now, () => undefined);
    expect(doc.scenes["c1-s3"]?.status).toBe("producing");
  });

  it("requires a composited video input, submitted version, actual owner decision and verifier", () => {
    const doc = ledger();
    expect(() => beginFinalSceneProduction(doc, "c1-s1", now, undefined as never))
      .toThrow(/Script\/Storyboard gate/);
    beginFinalSceneProduction(doc, "c1-s1", now, () => undefined);
    expect(() => submitSceneAvReview(doc, "c1-s1", now)).toThrow(/No composited AV/);
    const material = inputs("c1-s1");
    reconcileSceneInputs(doc, "c1-s1", material, now);
    beginFinalSceneProduction(doc, "c1-s1", now, () => undefined);
    expect(isSceneApproved(doc, "c1-s1")).toBe(false);
    const fingerprint = submitSceneAvReview(doc, "c1-s1", now);
    const decision = {
      ownerId: "studio-owner", expectedFingerprint: fingerprint,
      reviewedAvSha256: material.video.sha256, at: now,
    };
    expect(() => approveSceneAv(doc, "c1-s1", decision, undefined as never)).toThrow(/verifier/);
    expect(() => approveSceneAv(doc, "c1-s1", { ...decision, expectedFingerprint: digest("old") }, verifier))
      .toThrow(/changed/);
    expect(() => approveSceneAv(doc, "c1-s1", { ...decision, reviewedAvSha256: digest("wrong") }, verifier))
      .toThrow(/changed/);
    expect(() => approveSceneAv(doc, "c1-s1", { ...decision, ownerId: "!" }, verifier))
      .toThrow(/owner/);
    expect(() => approveSceneAv(doc, "c1-s1", decision, () => { throw Error("No AV evidence"); }))
      .toThrow(/No AV evidence/);
    expect(isSceneApproved(doc, "c1-s1")).toBe(false);
    approveSceneAv(doc, "c1-s1", decision, verifier);
    expect(isSceneApproved(doc, "c1-s1")).toBe(true);
    expect(doc.events.at(-1)?.action).toBe("approved");
  });

  it("invalidates only changed scene and blocks assembly without revoking unrelated approvals", () => {
    const doc = ledger();
    approve(doc, "c1-s1");
    const before = approve(doc, "c1-s2");
    approve(doc, "c1-s3");
    const assemblyBefore = assemblySceneFingerprint(doc);
    const changed: SceneInputs = { ...before, narration: artifact("different-mp3") };
    reconcileSceneInputs(doc, "c1-s2", changed, now);
    expect(isSceneApproved(doc, "c1-s1")).toBe(true);
    expect(isSceneApproved(doc, "c1-s2")).toBe(false);
    expect(isSceneApproved(doc, "c1-s3")).toBe(true);
    expect(() => assemblySceneFingerprint(doc)).toThrow(/c1-s2/);
    expect(() => assertCanProduceScene(doc, "c1-s3")).toThrow(/c1-s2/);
    beginFinalSceneProduction(doc, "c1-s2", now, () => undefined);
    const fp = submitSceneAvReview(doc, "c1-s2", now);
    approveSceneAv(doc, "c1-s2", {
      ownerId: "studio-owner", expectedFingerprint: fp,
      reviewedAvSha256: changed.video.sha256, at: now,
    }, verifier);
    expect(assemblySceneFingerprint(doc)).not.toBe(assemblyBefore);
  });

  it("shared asset edits revoke only scenes referencing the changed asset", () => {
    const doc = ledger();
    const first = approve(doc, "c1-s1", inputs("c1-s1", { logo: artifact("logo-v1") }));
    approve(doc, "c1-s2", inputs("c1-s2", { logo: artifact("logo-v1") }));
    approve(doc, "c1-s3", inputs("c1-s3"));
    reconcileSceneInputs(doc, "c1-s1", { ...first, shared: { logo: artifact("logo-v2") } }, now);
    const second = doc.scenes["c1-s2"]!.inputs!;
    reconcileSceneInputs(doc, "c1-s2", { ...second, shared: { logo: artifact("logo-v2") } }, now);
    expect(isSceneApproved(doc, "c1-s1")).toBe(false);
    expect(isSceneApproved(doc, "c1-s2")).toBe(false);
    expect(isSceneApproved(doc, "c1-s3")).toBe(true);
  });

  it("never revives a revoked decision after restoring old bytes", () => {
    const doc = ledger();
    const original = approve(doc, "c1-s1");
    reconcileSceneInputs(doc, "c1-s1", { ...original, narration: artifact("changed") }, now);
    reconcileSceneInputs(doc, "c1-s1", original, now);
    expect(doc.scenes["c1-s1"]?.status).toBe("needs_reapproval");
    expect(isSceneApproved(doc, "c1-s1")).toBe(false);
  });

  it("records timestamped correction requests and requires a new approval", () => {
    const doc = ledger();
    approve(doc, "c1-s1");
    requestSceneChanges(doc, "c1-s1", { at: now, text: "00:07 الصوت أسرع من حركة الكاميرا", second: 7 });
    expect(isSceneApproved(doc, "c1-s1")).toBe(false);
    expect(doc.scenes["c1-s1"]?.notes[0]).toMatchObject({ second: 7, seq: doc.events.length });
    expect(() => assemblySceneFingerprint(doc)).toThrow();
    expect(() => beginFinalSceneProduction(doc, "c1-s2", now, () => undefined)).toThrow();
    beginFinalSceneProduction(doc, "c1-s1", now, () => undefined);
    const fp = submitSceneAvReview(doc, "c1-s1", now);
    approveSceneAv(doc, "c1-s1", {
      ownerId: "studio-owner", expectedFingerprint: fp,
      reviewedAvSha256: doc.scenes["c1-s1"]!.inputs!.video.sha256, at: now,
    }, verifier);
    expect(isSceneApproved(doc, "c1-s1")).toBe(true);
  });

  it("detects voice, video, scene timing, rights and epoch changes in one AV fingerprint", () => {
    const original = inputs("c1-s1");
    const base = sceneFingerprint("c1-s1", original);
    for (const key of ["video", "narration", "sync", "rights", "vocalized", "tone"] as const) {
      expect(sceneFingerprint("c1-s1", { ...original, [key]: artifact("new-" + key) })).not.toBe(base);
    }
    expect(sceneFingerprint("c1-s1", {
      ...original, video: { ...original.video, epoch: digest("new-epoch") },
    })).not.toBe(base);
  });

  it("preserves approvals when the observed input snapshot is byte- and epoch-identical", () => {
    const doc = ledger();
    const original = approve(doc, "c1-s1");
    const revision = doc.revision;
    expect(reconcileSceneInputs(doc, "c1-s1", structuredClone(original), now)).toBe(false);
    expect(doc.revision).toBe(revision);
    expect(isSceneApproved(doc, "c1-s1")).toBe(true);
  });

  it("rejects invalid channel / episode / scene selectors and duplicate scene order", () => {
    expect(() => createSceneLedger("../balislam", "001-intro", ["c1-s1"])).toThrow();
    expect(() => createSceneLedger("balislam", "../001", ["c1-s1"])).toThrow();
    expect(() => createSceneLedger("balislam", "001-intro", ["c1-s1", "c1-s1"])).toThrow();
    expect(() => createSceneLedger("balislam", "001-intro", ["../pwn"])).toThrow();
    expect(() => assertCanProduceScene(ledger(), "c1-s99")).toThrow();
  });

  it("rejects absent video, malformed versions and path-traversing shared asset references", () => {
    const original = inputs("c1-s1");
    expect(() => sceneFingerprint("c1-s1", { ...original, video: undefined as never })).toThrow();
    expect(() => sceneFingerprint("c1-s1", { ...original, tone: { ...original.tone, sha256: "bad" } })).toThrow();
    expect(() => sceneFingerprint("c1-s1", { ...original, shared: { "../asset": artifact("unsafe") } })).toThrow();
  });

  it("does not trust render success, a bare status or old unsigned approvals", () => {
    const doc = ledger();
    reconcileSceneInputs(doc, "c1-s1", inputs("c1-s1"), now);
    doc.scenes["c1-s1"]!.status = "approved"; // attacker pretends successful render == signoff
    expect(isSceneApproved(doc, "c1-s1")).toBe(false);
    expect(() => assemblySceneFingerprint(doc)).toThrow();
  });
});
