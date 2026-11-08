import { describe, expect, it, vi } from "vitest";

vi.mock("remotion", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, useCurrentFrame: () => 0, useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 240, id: "t", defaultProps: {}, props: {}, defaultCodec: null }) };
});
const { linePoses } = await import("../src/remotion/scenes/AlleyTale");

describe("حكايات الحارة — السكون عند ذكر الله", () => {
  it("السطر العادي الطويل فيه إيماءة ثانوية ثم عودة (السلوك السابق كما هو)", () => {
    expect(linePoses("stand", 0, 120, { directed: false, walking: false, sacred: false })).toEqual([
      { at: 0, pose: "stand" },
      { at: 36, pose: "think" },
      { at: 94, pose: "stand" },
    ]);
  });
  it("جملة فيها ذكر الله أو دعاء أو آية: الوضعية وحدها بلا إيماءة", () => {
    expect(linePoses("stand", 0, 120, { directed: false, walking: false, sacred: true })).toEqual([{ at: 0, pose: "stand" }]);
    expect(linePoses("sit", 10, 200, { directed: false, walking: false, sacred: true })).toEqual([{ at: 10, pose: "sit" }]);
  });
  it("المشهد الموجَّه والمشي بلا إيماءة كما كانا", () => {
    expect(linePoses("think", 0, 120, { directed: true, walking: false, sacred: false })).toHaveLength(1);
    expect(linePoses("stand", 0, 120, { directed: false, walking: true, sacred: false })).toHaveLength(1);
  });
});
