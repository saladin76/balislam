import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syntheticFramePlan } from "../scripts/studio-render-frame-range.mts";

describe("real Remotion synthetic smoke frame boundaries", () => {
  it.each([
    [1, [0, 0], 1],
    [10, [0, 9], 10],
    [30, [0, 29], 30],
    [31, [0, 29], 30],
    [495, [0, 29], 30],
  ] as const)("renders %i source frames as inclusive %j (%i output frames)", (duration, range, count) => {
    const plan = syntheticFramePlan(duration);
    expect(plan.frameRange).toEqual(range);
    expect(plan.expectedFrames).toBe(count);
    expect(plan.frameRange[1] - plan.frameRange[0] + 1).toBe(plan.expectedFrames);
  });

  it.each([0, -1, 1.5, NaN, Infinity])("rejects invalid duration %s", (duration) => {
    expect(() => syntheticFramePlan(duration)).toThrow(/Invalid synthetic/);
  });

  it("passes supported frameRange (not ignored framesToRender) to renderMedia", () => {
    const current = path.dirname(fileURLToPath(import.meta.url));
    const smokeSource = readFileSync(path.join(current, "..", "scripts", "studio-render-isolation-smoke.mts"), "utf8");
    expect(smokeSource).toContain("frameRange: framePlan.frameRange");
    expect(smokeSource).not.toMatch(/framesToRender\s*:/);
    expect(smokeSource).toContain("const expectedFrames = framePlan.expectedFrames");
    expect(smokeSource).toContain("-count_frames");
  });
});
