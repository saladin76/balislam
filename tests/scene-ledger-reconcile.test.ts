/**
 * QA H3: adding/removing one scene must not wipe every approval. The ledger is reconciled by scene id.
 */
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { reconcileSceneLedger } from "../src/studio/sceneService";
import {
  approveAssembly, approveFinalMaster, approveSceneAv, approveScript, approveStoryboard, createSceneFirstProduction,
  grantPublish, nextSceneId, sceneFirstProgress, sceneSeams, submitAssembly, submitSceneAvPreview,
  type SceneFirstProduction,
} from "../src/studio/sceneProduction";

const h = (s: string) => createHash("sha256").update(s).digest("hex");
const at = "2026-11-10T10:00:00.000Z";
const base = (ids: string[], over: Partial<{ script: string; board: string; src: Record<string, string> }> = {}) =>
  createSceneFirstProduction({ channel: "balislam", episode: "990-x", scriptSha256: h(over.script ?? "script"),
    storyboardSha256: h(over.board ?? "board"), scenes: ids.map(id => ({ id, sourceSha256: h(over.src?.[id] ?? "src-" + id) })) });
const approveAll = (p: SceneFirstProduction): SceneFirstProduction => {
  let s = approveStoryboard(approveScript(p, "owner", at, p.script.sha256), "owner", at, p.storyboard.sha256);
  for (const scene of s.scenes) {
    s = submitSceneAvPreview(s, scene.id, scene.sourceSha256, h("prev-" + scene.id));
    s = approveSceneAv(s, scene.id, { by: "owner", at, previewSha256: h("prev-" + scene.id), watchedWithAudio: true });
  }
  return s;
};
const published = (): SceneFirstProduction => {
  let s = approveAll(base(["c1-s1", "c1-s2", "c1-s3"]));
  s = submitAssembly(s, h("cut"));
  s = approveAssembly(s, { by: "owner", at, videoSha256: h("cut"), watchedFullEpisodeAt1x: true, seamsChecked: sceneSeams(s) });
  s = approveFinalMaster(s, { by: "owner", at, masterSha256: h("m"), assembledVideoSha256: h("cut"), watchedFullEpisodeAt1x: true });
  return grantPublish(s, { by: "owner", at, masterSha256: h("m") });
};
const status = (p: SceneFirstProduction) => Object.fromEntries(p.scenes.map(s => [s.id, s.status]));

describe("reconcileSceneLedger (by scene id)", () => {
  it("an unchanged list keeps everything, including assembly and Master", () => {
    const s = published();
    expect(reconcileSceneLedger(s, base(["c1-s1", "c1-s2", "c1-s3"]))).toEqual(s);
  });

  it("inserting a scene keeps the other approvals, queues the new one, invalidates assembly/Master/publish", () => {
    const s = published();
    const r = reconcileSceneLedger(s, base(["c1-s1", "c1-new", "c1-s2", "c1-s3"]));
    expect(status(r)).toEqual({ "c1-s1": "approved", "c1-new": "queued", "c1-s2": "approved", "c1-s3": "approved" });
    expect(r.script.approval).toBeTruthy();
    expect(r.storyboard.approval).toBeTruthy();
    expect(r.assembly).toBeUndefined();
    expect(r.master).toBeUndefined();
    // Ordering rule: the queue now points at the new scene; assembly is blocked until it is approved.
    expect(nextSceneId(r)).toBe("c1-new");
    expect(sceneFirstProgress(r).canAssemble).toBe(false);
    expect(sceneFirstProgress(r).approvedScenes).toBe(3);
    expect(() => submitAssembly(r, h("cut2"))).toThrow();
    // Approving the new scene completes the episode again without re-approving the others.
    let n = submitSceneAvPreview(r, "c1-new", r.scenes[1]!.sourceSha256, h("prev-new"));
    n = approveSceneAv(n, "c1-new", { by: "owner", at, previewSha256: h("prev-new"), watchedWithAudio: true });
    expect(sceneFirstProgress(n).canAssemble).toBe(true);
  });

  it("removing a scene drops only that scene and invalidates assembly/Master", () => {
    const r = reconcileSceneLedger(published(), base(["c1-s1", "c1-s3"]));
    expect(status(r)).toEqual({ "c1-s1": "approved", "c1-s3": "approved" });
    expect(r.assembly).toBeUndefined();
    expect(r.master).toBeUndefined();
    expect(sceneFirstProgress(r).canAssemble).toBe(true);
  });

  it("reordering keeps scene approvals but invalidates the cut (its seams changed)", () => {
    const r = reconcileSceneLedger(published(), base(["c1-s2", "c1-s1", "c1-s3"]));
    expect(r.scenes.map(s => s.id)).toEqual(["c1-s2", "c1-s1", "c1-s3"]);
    expect(Object.values(status(r))).toEqual(["approved", "approved", "approved"]);
    expect(r.assembly).toBeUndefined();
  });

  it("a scene whose own inputs changed is re-opened, alongside an added scene", () => {
    const r = reconcileSceneLedger(published(), base(["c1-s1", "c1-s2", "c1-s3", "c1-s4"], { src: { "c1-s2": "edited" } }));
    expect(status(r)).toEqual({ "c1-s1": "approved", "c1-s2": "needs_revision", "c1-s3": "approved", "c1-s4": "queued" });
  });

  it("a changed storyboard hash re-opens the storyboard decision but keeps matching scene approvals", () => {
    const r = reconcileSceneLedger(published(), base(["c1-s1", "c1-s2", "c1-s3", "c1-s4"], { board: "board-2" }));
    expect(r.storyboard.approval).toBeUndefined();
    expect(r.script.approval).toBeTruthy();
    expect(status(r)["c1-s1"]).toBe("approved");
    expect(status(r)["c1-s4"]).toBe("queued");
  });

  it("a ledger of another episode is never migrated", () => {
    const other = createSceneFirstProduction({ channel: "balislam", episode: "991-y", scriptSha256: h("script"),
      storyboardSha256: h("board"), scenes: [{ id: "c1-s1", sourceSha256: h("src-c1-s1") }] });
    expect(reconcileSceneLedger(published(), other)).toEqual(other);
  });
});
