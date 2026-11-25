import { describe, expect, it } from "vitest";
import {
  createSceneFirstProduction, approveScript, approveStoryboard,
  submitSceneAvPreview, approveSceneAv, reviseSceneInput, changeScript,
  changeStoryboard, nextSceneId, submitAssembly, approveFinalMaster,
  assertExactMasterReadyForPublish, sceneFirstProgress, requestSceneCorrection,
  approveAssembly, grantPublish, sceneSeams, assertExactMasterApproved,
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

  it("D145: any scene is produced, approved or sent back first, whatever the scenes before it", () => {
    // scene 2 before scene 1: submitted and approved with its own bytes; scene 1 untouched
    const second = approveSceneAv(submitSceneAvPreview(planned(), "c1-s2", h("d"), h("e")),
      "c1-s2", { by: "owner", at, previewSha256: h("e"), watchedWithAudio: true });
    expect(second.scenes.map((s) => s.status)).toEqual(["queued", "approved"]);
    expect(sceneFirstProgress(second)).toMatchObject({ currentScene: "c1-s1", unapprovedScenes: ["c1-s1"], approvedScenes: 1, canAssemble: false });
    // a correction on scene 2 while scene 1 is not approved
    const back = requestSceneCorrection(submitSceneAvPreview(planned(), "c1-s2", h("d"), h("e")), "c1-s2");
    expect(back.scenes[1]?.status).toBe("needs_revision");
    // the assembly still waits for every scene, and names what is left
    expect(() => submitAssembly(second, h("1"))).toThrow(/not approved yet: c1-s1\./);
    const both = approveSceneAv(submitSceneAvPreview(second, "c1-s1", h("c"), h("f")),
      "c1-s1", { by: "owner", at, previewSha256: h("f"), watchedWithAudio: true });
    expect(sceneFirstProgress(both)).toMatchObject({ currentScene: null, unapprovedScenes: [], canAssemble: true });
    // the reviewed bytes are still required
    const preview = submitSceneAvPreview(planned(), "c1-s1", h("c"), h("e"));
    expect(() => approveSceneAv(preview, "c1-s1", {
      by: "owner", at, previewSha256: h("f"), watchedWithAudio: true,
    })).toThrow(/latest rendered/);
    expect(nextSceneId(approvedFirst())).toBe("c1-s2");
  });

  it("D145: an old ledger (approved in order) is read as is: the chain stays approved, nothing rewritten", () => {
    const old = JSON.parse(JSON.stringify(allApproved()));
    expect(sceneFirstProgress(old)).toMatchObject({ approvedScenes: 2, unapprovedScenes: [], canAssemble: true });
    expect(submitAssembly(old, h("1")).assembly?.videoSha256).toBe(h("1"));
    expect(old).toEqual(allApproved());
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

  it("requires a real matching scene signoff and supports requesting a correction", () => {
    const candidate = submitSceneAvPreview(planned(), "c1-s1", h("c"), h("e"));
    const needsCorrection = requestSceneCorrection(candidate, "c1-s1");
    expect(needsCorrection.scenes[0]?.status).toBe("needs_revision");
    expect(() => approveSceneAv(needsCorrection, "c1-s1", {
      by: "owner", at, previewSha256: h("e"), watchedWithAudio: true,
    })).toThrow(/latest rendered/);
    const forged = allApproved();
    const invalid = { ...forged, scenes: forged.scenes.map((scene, i) =>
      i === 0 ? { ...scene, approval: undefined } : scene) };
    expect(nextSceneId(invalid)).toBe("c1-s1");
    expect(() => submitAssembly(invalid, h("1"))).toThrow(/All audiovisual scenes/);
  });

  it("a script edit re-opens script, storyboard, assembly and Master only; unaffected scenes keep their approvals", () => {
    const old = submitAssembly(allApproved(), h("1"));
    const firstEdit = changeScript(old, h("2"));
    const restored = changeScript(firstEdit, h("a"));
    // Reverting the bytes never revives the script or storyboard decisions.
    expect(restored.script.approval).toBeUndefined();
    expect(restored.storyboard.approval).toBeUndefined();
    expect(restored.assembly).toBeUndefined();
    // Scoped invalidation: scenes whose own inputs did not change stay approved…
    expect(restored.scenes.every((s) => s.status === "approved")).toBe(true);
    // …but nothing new can be produced or assembled before the script/storyboard are re-approved.
    expect(() => submitAssembly(restored, h("1"))).toThrow(/upstream sources/);
    const reopened = reviseSceneInput(restored, "c1-s2", h("9"));
    expect(() => submitSceneAvPreview(reopened, "c1-s2", h("9"), h("8"))).toThrow(/Script and storyboard/);
    const board = changeStoryboard(old, h("3"));
    expect(board.storyboard.approval).toBeUndefined();
    expect(board.scenes.every((s) => s.status === "approved")).toBe(true);
  });

  it("assembly, Master and publishing are three separate human decisions on exact bytes", () => {
    expect(() => submitAssembly(approvedFirst(), h("1"))).toThrow(/All audiovisual scenes/);
    const p = submitAssembly(allApproved(), h("1"));
    const master = { by: "owner", at, masterSha256: h("2"), assembledVideoSha256: h("1"), watchedFullEpisodeAt1x: true as const };
    // No Master before the assembled cut and every seam are approved.
    expect(() => approveFinalMaster(p, master)).toThrow(/transitions/);
    expect(sceneSeams(p)).toEqual(["c1-s1>c1-s2"]);
    // D223: الوصلات لا تُشترط لاعتماد التجميع (تُسجَّل كلها في الاعتماد)
    expect(() => approveAssembly(p, { by: "owner", at, videoSha256: h("3"), watchedFullEpisodeAt1x: true, seamsChecked: ["c1-s1>c1-s2"] }))
      .toThrow(/current assembly/);
    const assembled = approveAssembly(p, { by: "owner", at, videoSha256: h("1"), watchedFullEpisodeAt1x: true, seamsChecked: ["c1-s1>c1-s2"] });
    expect(sceneFirstProgress(assembled).assemblyApproved).toBe(true);
    expect(() => approveFinalMaster(assembled, { ...master, assembledVideoSha256: h("3") })).toThrow(/current assembly/);
    const accepted = approveFinalMaster(assembled, master);
    expect(sceneFirstProgress(accepted).masterApproved).toBe(true);
    expect(() => assertExactMasterApproved(accepted, h("2"))).not.toThrow();
    // An approved Master is not a publish permission.
    expect(() => assertExactMasterReadyForPublish(accepted, h("2"))).toThrow(/publish permission/);
    expect(() => grantPublish(accepted, { by: "owner", at, masterSha256: h("3") })).toThrow(/not approved/);
    const published = grantPublish(accepted, { by: "owner", at, masterSha256: h("2") });
    expect(() => assertExactMasterReadyForPublish(published, h("3"))).toThrow();
    expect(() => assertExactMasterReadyForPublish(published, h("2"))).not.toThrow();
    expect(sceneFirstProgress(published).publishAllowed).toBe(true);
    // Any changed scene invalidates assembly, Master and the publish permission together.
    const revised = reviseSceneInput(published, "c1-s1", h("4"));
    expect(() => assertExactMasterApproved(revised, h("2"))).toThrow();
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
