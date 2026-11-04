import { describe, expect, it } from "vitest";
import { cameraCuts, isDirected, parsePoseTimeline } from "./director";

describe("illustrated director controls", () => {
  it("keeps legacy automatic mode as default", () => {
    expect(isDirected()).toBe(false);
    expect(isDirected("automatic")).toBe(false);
    expect(cameraCuts([0, 100], 180, false)).toEqual([0, 50, 100, 140]);
  });
  it("prevents filler camera cuts when directed", () => {
    expect(isDirected("directed")).toBe(true);
    expect(cameraCuts([0, 100], 180, true)).toEqual([0]);
  });
  it("parses explicit pose events without accepting negative or fractional frames", () => {
    expect(parsePoseTimeline("42 | listen\n0 | stand\n-1 | talk\n1.5 | nod\nhello\n80 | apologize"))
      .toEqual([{ at: 0, pose: "stand" }, { at: 42, pose: "listen" }, { at: 80, pose: "apologize" }]);
  });
  it("handles empty captions and invalid events", () => {
    expect(cameraCuts([], 90, false)).toEqual([0]);
    expect(parsePoseTimeline()).toEqual([]);
  });
});
