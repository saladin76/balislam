import { describe, expect, it } from "vitest";
import { compositionIssues, requiresFocusCut, pillClearOfOwner, visibleHorizontal } from "../src/remotion/illus/compositionSafety";
import { composedCamera, witnessPillAt } from "../src/remotion/scenes/AlleyTale";
import { captionLines } from "../src/remotion/illus/TopCaption";

describe("Studio motion safety: isolated opt-in portrait composition", () => {
  it("never activates on legacy, landscape, or other channels' ordinary stages", () => {
    expect(requiresFocusCut({ portrait: true, contained: true, stage: "witnesses", from: "hero", to: "other" })).toBe(true);
    expect(requiresFocusCut({ portrait: false, contained: true, stage: "witnesses", from: "hero", to: "other" })).toBe(false);
    expect(requiresFocusCut({ portrait: true, contained: false, stage: "witnesses", from: "hero", to: "other" })).toBe(false);
    expect(requiresFocusCut({ portrait: true, contained: true, stage: "companion", from: "hero", to: "other" })).toBe(false);
    expect(requiresFocusCut({ portrait: true, contained: true, stage: "witnesses", from: "hero", to: "hero" })).toBe(false);
  });

  it("cuts on the intended speech frame, avoiding half-figures mid-pan between witnesses", () => {
    const plan = "0 | wide center\n60 | medium hero\n120 | medium other";
    const fit = (target: string) => target === "hero"
      ? { x: 700, y: 540, z: 1 }
      : target === "other" ? { x: 1300, y: 540, z: 1 } : { x: 960, y: 540, z: 1 };
    const at = (frame: number, portrait: boolean, contained: boolean) => composedCamera({
      frame, dur: 180, fps: 30, heroX: 700, stage: "witnesses",
      sacred: false, portrait, plan, cues: [], timings: [],
      ...(contained ? { fit } : {}),
    });
    for (const f of [0, 20, 59]) expect(at(f, true, true).x).toBe(960);
    for (const f of [60, 90, 119]) expect(at(f, true, true).x).toBe(700);
    for (const f of [120, 150, 179]) expect(at(f, true, true).x).toBe(1300);
    // Historical composition is unchanged when the option is absent.
    expect(at(60, false, true).x).not.toBe(700);
    expect(at(60, true, false).x).not.toBe(700);
    expect(at(75, true, true)).toEqual(at(75, true, true)); // deterministic
  });

  it("classifies clipped subjects and the world boundary without changing camera data", () => {
    const camera = { x: 960, z: 1 };
    expect(compositionIssues({ camera, portrait: true, worldW: 1920, required: [{ lo: 800, hi: 1000 }],
      optional: [{ lo: 1180, hi: 1400, name: "witness" }] })).toEqual([{ kind: "optional-half-clipped", name: "witness" }]);
    expect(compositionIssues({ camera, portrait: true, worldW: 1920, required: [{ lo: 500, hi: 1000, name: "main" }] }))
      .toEqual([{ kind: "required-clipped", name: "main" }]);
    expect(compositionIssues({ camera: { x: 60, z: 1 }, portrait: true, worldW: 1920, required: [{ lo: 0, hi: 100 }] }))
      .toContainEqual({ kind: "off-world", name: "world" });
    expect(compositionIssues({ camera, portrait: false, worldW: 1920, required: [{ lo: 0, hi: 1920 }] })).toEqual([]);
    expect(() => visibleHorizontal({ x: 0, z: 0 }, true)).toThrow(/zoom/);
  });

  it("does not drag a witness label over the speaker's head or raised hand", () => {
    const camera = { x: 960, y: 540, z: 1 };
    expect(witnessPillAt(700, 1, "حكم", camera, true, 46, 50)).not.toBeNull();
    expect(witnessPillAt(1150, 1, "حكم", camera, true, 46, 50)).toBeNull();
    expect(pillClearOfOwner({ x: 710, ownerX: 700, direction: 1, width: 100, clearance: 70,
      camera, portrait: true })).toBe(false);
    expect(pillClearOfOwner({ x: 850, ownerX: 700, direction: 1, width: 100, clearance: 70,
      camera, portrait: true })).toBe(true);
  });

  it("hard-limits only opted captions; existing caption grouping remains byte-identical", () => {
    const timings = Array.from({ length: 7 }, (_, i) => ({ word: `كلمة${i}`, start: i * 10, end: i * 10 + 9 }));
    expect(captionLines(timings, 5).map((l) => l.length)).toEqual([7]);
    expect(captionLines(timings, 5, true).map((l) => l.length)).toEqual([5, 2]);
  });
});
