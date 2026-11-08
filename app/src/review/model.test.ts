import { afterEach, describe, expect, it, vi } from "vitest";
import { actionBlockers, activeVersion, formatClock, isSafeVideoUrl, sameScope, type SceneReviewRecord } from "./model";
import { demoReviewAdapter } from "./adapter";

const ready: SceneReviewRecord = {
  id: "c1-s1", status: "in_review", currentVersionId: "v2",
  versions: [{ id: "v2", label: "v2", fingerprint: "current-hash",
    video: { url: "/api/scene/current.mp4", mime: "video/mp4", durationSec: 8 } }],
  notes: [], permissions: { approve: true, requestChanges: true, reasons: [] },
};

afterEach(() => vi.unstubAllGlobals());

describe("Studio V2 review UI fail-closed model", () => {
  it("formats playback time without treating play as a completed review", () => {
    expect(formatClock(67.9)).toBe("01:07");
    expect(formatClock(Number.NaN)).toBe("00:00");
    expect(activeVersion(ready)?.id).toBe("v2");
  });
  it("accepts only same-origin HTTP(S) video URLs", () => {
    const host = "http://127.0.0.1:4321";
    expect(isSafeVideoUrl("/api/scene.mp4", host)).toBe(true);
    expect(isSafeVideoUrl("https://other.example/a.mp4", host)).toBe(false);
    expect(isSafeVideoUrl("javascript:alert(1)", host)).toBe(false);
    expect(isSafeVideoUrl("//evil.example/a.mp4", host)).toBe(false);
  });
  it("explains missing video, prior scene and stale status blockers", () => {
    const draft = structuredClone(ready);
    draft.status = "prepared";
    draft.versions[0]!.video = undefined;
    expect(actionBlockers(draft, { ...ready, status: "draft" }).join(" ")).toContain("السابق");
    expect(actionBlockers(draft).join(" ")).toContain("MP4");
  });
  it("rejects malformed backend gate snapshots instead of displaying false approvals", () => {
    const malformed = {
      channelId: "balislam", episodeId: "001-qa", revision: 1,
      order: ["c1-s1"], scenes: { "c1-s1": { ...ready, permissions: undefined } },
    };
    expect(sameScope(malformed as unknown as Parameters<typeof sameScope>[0], "balislam", "001-qa")).toBe(false);
    const invalidFingerprint = structuredClone(ready);
    expect(actionBlockers(invalidFingerprint).join(" ")).toContain("بصمة");
  });
  it("never turns QA decisions into approvals", async () => {
    const adapter = demoReviewAdapter("balislam", "001-qa",
      [{ id: "c1-s1", ordinal: 1, chapter: "x", title: "x", narration: "", storyboard: "", artDirection: "",
        camera: "", transition: "", timing: "", durationSec: 8, elements: [] }], "/scene-review-qa.mp4");
    const initial = await adapter.load();
    expect(initial.scenes["c1-s1"]?.status).toBe("in_review");
    const updated = await adapter.addNote({
      sceneId: "c1-s1", versionId: "qa-c1-s1-v2",
      expectedFingerprint: "qa-only-not-a-real-fingerprint", text: "الصوت متقدم", second: 2.3,
    });
    expect(updated.scenes["c1-s1"]?.notes[0]?.second).toBe(2.3);
    await expect(adapter.decide({
      sceneId: "c1-s1", expectedFingerprint: "anything", action: "approve",
    })).rejects.toThrow("اختبارية");
    expect((await adapter.load()).scenes["c1-s1"]?.status).toBe("in_review");
  });
  it("rejects episode scope mismatch from server", () => {
    expect(sameScope({ channelId: "other", episodeId: "001-qa", revision: 1, order: ["c1-s1"],
      scenes: { "c1-s1": ready } }, "balislam", "001-qa")).toBe(false);
  });
});
