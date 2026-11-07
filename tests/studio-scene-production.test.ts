import { describe, expect, it } from "vitest";
import {
  createSceneFirstProduction, approveScript, approveStoryboard,
  submitSceneAvPreview, approveSceneAv, reviseSceneInput, changeScript,
  changeStoryboard, nextSceneId, submitAssembly, approveFinalMaster,
  assertExactMasterReadyForPublish, sceneFirstProgress,
} from "../src/studio/sceneProduction";

const h = (c: string) => c.repeat(64);
const at = "2026-11-07T20:00:00.000Z";
const initial = () => createSceneFirstProduction({
  channel: "balislam", episode: "001", scriptSha256: h("a"),
  storyboardSha256: h("b"),
  scenes: [{ id: "c1-s1", sourceSha256: h("c") },
    { id: "c1-s2", sourceSha256: h("d") }],
});
const planned = () => approveStoryboard(
  approveScript(initial(), "owner", at, h("a")), "owner", at, h("b"));
const approvedFirst = () => approveSceneAv(
  submitSceneAvPreview(planned(), "c1-s1", h("c"), h("e")),
  "c1-s1", { by: "owner", at, previewSha256: h("e"), watchedWithAudio: true });
const allApproved = () => approveSceneAv(
  submitSceneAvPreview(approvedFirst(), "c1-s2", h("d"), h("f")),
  "c1-s2", { by: "owner", at, previewSha256: h("f"), watchedWithAudio: true });

describe("Studio scene-first audiovisual review", () => {
  it("requires editorial script and PDF storyboard approvals before first scene", () => {
    expect(() => submitSceneAvPreview(initial(), "c1-s1", h("c"), h("e"))).toThrow(/Script and storyboard/);
    expect(() => approveStoryboard(initial(), "owner", at, h("b"))).toThrow(/script first/);
    expect(nextSceneId(planned())).toBe("c1-s1");
  });

  it("blocks the next scene until the previous scene is approved with audio and picture", () => {
    expect(() => submitSceneAvPreview(planned(), "c1-s2", h("d"), h("e"))).toThrow(/previous scene/);
    const preview = submitSceneAvPreview(planned(), "c1-s1", h("c"), h("e"));
    expect(() => submitSceneAvPreview(preview, "c1-s2", h("d"), h("f"))).toThrow(/previous scene/);
    expect(() => approveSceneAv(preview, "c1-s1", {
      by: "owner", at, previewSha256: h("f"), watchedWithAudio: true,
    })).toThrow(/latest rendered/);
    expect(nextSceneId(approvedFirst())).toBe("c1-s2");
  });

  it("keeps approved independent scenes when revising one scene but invalidates assembly", () => {
    const approved = allApproved();
    const assembled = submitAssembly(approved, h("1"));
    const revised = reviseSceneInput(assembled, "c1-s2", h("2"));
    expect(revised.scenes[0]?.status).toBe("approved");
    expect(revised.scenes[1]?.status).toBe("needs_revision");
    expect(revised.assembly).toBeUndefined();
    expect(nextSceneId(revised)).toBe("c1-s2");
    expect(() => submitAssembly(revised, h("1"))).toThrow(/All audiovisual scenes/);
    const rebuilt = approveSceneAv(
      submitSceneAvPreview(revised, "c1-s2", h("2"), h("3")),
      "c1-s2", { by: "owner", at, previewSha256: h("3"), watchedWithAudio: true });
    expect(sceneFirstProgress(rebuilt)).toMatchObject({ approvedScenes: 2, canAssemble: true });
  });

  it("a script edit invalidates storyboard and every scene; reverting bytes does not restore approvals", () => {
    const old = allApproved();
    const firstEdit = changeScript(old, h("2"));
    const restored = changeScript(firstEdit, h("a"));
    expect(restored.script.approval).toBeUndefined();
    expect(restored.storyboard.approval).toBeUndefined();
    expect(restored.scenes.every((s) => s.status === "queued")).toBe(true);
    expect(() => submitSceneAvPreview(restored, "c1-s1", h("c"), h("e"))).toThrow();
    expect(changeStoryboard(old, h("3")).scenes.every((s) => s.status === "queued")).toBe(true);
  });

  it("requires every scene before merge and exact reviewed Master bytes before publication", () => {
    expect(() => submitAssembly(approvedFirst(), h("1"))).toThrow(/All audiovisual scenes/);
    const p = submitAssembly(allApproved(), h("1"));
    expect(() => approveFinalMaster(p, {
      by: "owner", at, masterSha256: h("2"), assembledVideoSha256: h("3"),
      watchedFullEpisodeAt1x: true,
    })).toThrow(/current assembly/);
    const accepted = approveFinalMaster(p, {
      by: "owner", at, masterSha256: h("2"), assembledVideoSha256: h("1"),
      watchedFullEpisodeAt1x: true,
    });
    expect(() => assertExactMasterReadyForPublish(accepted, h("3"))).toThrow(/Publishing is blocked/);
    expect(() => assertExactMasterReadyForPublish(accepted, h("2"))).not.toThrow();
    expect(sceneFirstProgress(accepted).masterApproved).toBe(true);
    const revised = reviseSceneInput(accepted, "c1-s1", h("4"));
    expect(() => assertExactMasterReadyForPublish(revised, h("2"))).toThrow();
  });

  it("rejects bad identifiers, hashes, forged media reviews and unexplained source changes", () => {
    expect(() => createSceneFirstProduction({
      channel: "balislam", episode: "001", scriptSha256: h("a"),
      storyboardSha256: h("b"), scenes: [{ id: "same", sourceSha256: h("c") },
        { id: "same", sourceSha256: h("d") }],
    })).toThrow(/unique/);
    expect(() => submitSceneAvPreview(planned(), "c1-s1", h("d"), h("e"))).toThrow(/differs/);
    const preview = submitSceneAvPreview(planned(), "c1-s1", h("c"), h("e"));
    expect(() => approveSceneAv(preview, "c1-s1", {
      by: "", at, previewSha256: h("e"), watchedWithAudio: true,
    })).toThrow(/human review/);
  });
});
