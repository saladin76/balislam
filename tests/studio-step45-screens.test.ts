import { describe, expect, it } from "vitest";
import type { SceneProductionRead } from "../app/src/api";
import { decisionHasPrimary } from "../app/src/tabs/PublishTab";
import { decisionShowsVideo } from "../app/src/workspace/IntegratedReviewWorkspace";

const h = (c: string) => c.repeat(64);
const read = (o: { scenesDone?: boolean; assembly?: boolean | null; master?: "none" | "candidate" | "approved" | "allowed"; approved?: boolean }): SceneProductionRead => ({
  schemaVersion: 1, channel: "balislam", episode: "001", revision: 1,
  progress: { currentScene: o.scenesDone === false ? "c1-s2" : null, approvedScenes: 1, totalScenes: 2, canAssemble: o.scenesDone !== false,
    assemblyApproved: o.assembly === true, masterApproved: o.master === "approved" || o.master === "allowed", publishAllowed: o.master === "allowed" },
  script: { sha256: h("a"), approved: o.approved !== false }, storyboard: { sha256: h("b"), approved: o.approved !== false },
  scenes: [], seams: [],
  assembly: o.assembly == null ? null : { sha256: h("c"), approved: o.assembly },
  master: o.master === "approved" || o.master === "allowed" ? { sha256: h("d"), approved: true, publishAllowed: o.master === "allowed" } : null,
  candidates: { scenes: {}, assemblySha256: h("c"), masterSha256: o.master && o.master !== "none" ? h("d") : null },
});

describe("steps 4–5: one filled action per screen, one video per screen", () => {
  it("the decision panel owns the filled button whenever it shows a decision", () => {
    expect(decisionHasPrimary(null)).toBe(false);
    expect(decisionHasPrimary(read({ approved: false }))).toBe(false);
    expect(decisionHasPrimary(read({ scenesDone: false }))).toBe(true);
    expect(decisionHasPrimary(read({ assembly: false }))).toBe(true);
    expect(decisionHasPrimary(read({ assembly: true, master: "candidate" }))).toBe(true);
    expect(decisionHasPrimary(read({ assembly: true, master: "approved" }))).toBe(true);
    // no Master file yet («إلى النشر» is hidden on the publish page) and after permission: the page owns it
    expect(decisionHasPrimary(read({ assembly: true, master: "none" }))).toBe(false);
    expect(decisionHasPrimary(read({ assembly: true, master: "allowed" }))).toBe(false);
  });

  it("the review page hides its own video while the panel shows a scene or the assembly", () => {
    expect(decisionShowsVideo(null)).toBe(false);
    expect(decisionShowsVideo(read({ scenesDone: false }))).toBe(true);
    expect(decisionShowsVideo(read({ assembly: false }))).toBe(true);
    expect(decisionShowsVideo(read({ assembly: true, master: "candidate" }))).toBe(false);
    expect(decisionShowsVideo(read({ approved: false, scenesDone: false }))).toBe(false);
  });
});
