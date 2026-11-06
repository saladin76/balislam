import { describe, expect, it } from "vitest";
import { emptyMedia } from "../src/plan/media";
import { sceneFrames } from "../src/plan/duration";
import { shotFrame } from "../src/plan/storyboardView";
import { storyboardFramePlan } from "../src/render/storyboardFrames";
import type { Plan } from "../src/plan/types";

const scene = (id: string, narration: string) => ({
  id, template: "noor-text", line: 1, narration, props: { text: narration }, sfx: [], tone: "calm",
});
const plan = {
  version: 1, episode: "001", title: "Board test", domain: "islamic", themeId: "night",
  intro: false, updatedAt: "2026-11-06T00:00:00Z",
  chapters: [
    { number: 1, title: "Start", scenes: [scene("c1-s1", "أول مشهد"), scene("c1-s2", "ثاني مشهد")] },
    { number: 2, title: "End", scenes: [scene("c2-s1", "ثالث مشهد")] },
  ],
} as Plan;

describe("complete illustrated storyboard schedule", () => {
  it("contains one distinct actual composition frame for every planned scene", () => {
    const rows = storyboardFramePlan(plan, emptyMedia);
    expect(rows.map((r) => r.scene.id)).toEqual(["c1-s1", "c1-s2", "c2-s1"]);
    expect(new Set(rows.map((r) => r.scene.id)).size).toBe(3);
    expect(rows.every((r) => r.hash.length === 12)).toBe(true);
  });
  it("places each frame within its own scene, using the same duration as Episode", () => {
    const rows = storyboardFramePlan(plan, emptyMedia);
    let start = 0;
    for(const row of rows) {
      const duration = sceneFrames(row.scene, emptyMedia);
      expect(row.duration).toBe(duration);
      expect(row.frame).toBe(start + shotFrame(row.scene, duration));
      start += duration;
    }
  });
  it("does not mark frames as approved or manufacture an approval record", () => {
    const rows = storyboardFramePlan(plan, emptyMedia);
    expect(rows.some((r) => "approved" in r)).toBe(false);
  });
});
