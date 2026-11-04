import { describe, expect, it } from "vitest";
import { staleMotionScenes } from "../src/render/motionValidity";
import { sceneHash } from "../src/plan/sceneReview";
import type { Plan } from "../src/plan/types";
import type { StoryboardMotion } from "../src/render/storyboardMotion";

const one = { id: "c1-s1", narration: "الحقيقة", template: "alley-tale", props: {}, sfx: [] };
const two = { id: "c1-s2", narration: "ثم القرار", template: "alley-tale", props: {}, sfx: [] };
const plan = { chapters: [{ scenes: [one, two] }] } as unknown as Plan;
const report = (): StoryboardMotion => ({
  at: new Date(0).toISOString(), percent: 85, orientation: "landscape", inputHash: "current",
  scenes: {
    "c1-s1": { hash: sceneHash(one), pct: 82, still: 1, from: 0 },
    "c1-s2": { hash: sceneHash(two), pct: 88, still: 0, from: 4 },
  },
});

describe("سلامة تقرير الحركة", () => {
  it("يقبل كل المشاهد الحالية ذات البصمة الصحيحة", () => {
    expect(staleMotionScenes(plan, report(), "current")).toEqual([]);
  });
  it("يرفض تقريرًا ناقصًا ولو تطابقت بصمته العامة", () => {
    const r = report();
    delete r.scenes["c1-s2"];
    expect(staleMotionScenes(plan, r, "current")).toEqual(["c1-s2"]);
  });
  it("يرفض تغيير المشهد أو تغيير ملفات الرندر العامة", () => {
    const r = report();
    r.scenes["c1-s1"]!.hash = "old";
    expect(staleMotionScenes(plan, r, "current")).toEqual(["c1-s1"]);
    expect(staleMotionScenes(plan, r, "new")).toEqual(["c1-s1", "c1-s2"]);
  });
});
