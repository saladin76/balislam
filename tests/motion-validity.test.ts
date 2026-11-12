import { describe, expect, it } from "vitest";
import { staleMotionScenes, auditNeedsJustification } from "../src/render/motionValidity";
import { sceneHash } from "../src/plan/sceneHash";
import type { Plan, PlanScene } from "../src/plan/types";
import type { StoryboardMotion } from "../src/render/storyboardMotion";

const one: PlanScene = { id: "c1-s1", narration: "الحقيقة", line: 1, template: "alley-tale", props: {}, sfx: [] };
const two: PlanScene = { id: "c1-s2", narration: "ثم القرار", line: 2, template: "alley-tale", props: {}, sfx: [] };
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
  it("يستدعي مراجعة جديدة إذا ظهر تحذير بعد اعتماد سابق", () => {
    const r = report();
    r.scenes["c1-s1"]!.logic = {
      status: "needs-review", matched: 0, total: 1,
      findings: [{ kind: "timing", level: "warning", message: "حركة غير متزامنة" }],
    };
    expect(auditNeedsJustification(r)).toBe(true);
    expect(auditNeedsJustification(r, { inputHash: "current", note: "راجعت المشهد واعتمدت السكون المقصود" })).toBe(false);
    expect(auditNeedsJustification(r, { inputHash: "old", note: "راجعت المشهد واعتمدت السكون المقصود" })).toBe(true);
  });

  it("يرفض تغيير المشهد أو تغيير ملفات الرندر العامة", () => {
    const r = report();
    r.scenes["c1-s1"]!.hash = "old";
    expect(staleMotionScenes(plan, r, "current")).toEqual(["c1-s1"]);
    expect(staleMotionScenes(plan, r, "new")).toEqual(["c1-s1", "c1-s2"]);
  });
});
