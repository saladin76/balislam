import { describe, expect, it } from "vitest";
import { cameraCuts, isDirected, parsePoseTimeline } from "./director";
import { directIllus } from "./illusDirect";
import type { PlanChapter, PlanScene } from "./types";

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

describe("manual direction overrides auto plan suggestions", () => {
  const scene = (template: string, props: Record<string, string> = {}): PlanScene => ({
    id: "c1-s1", template, narration: "قد تصدق خبرًا ثم تراجع رأيك.", line: 1, props, sfx: [],
  });

  it("does not replace a deliberate still camera with an auto push", () => {
    const directed = scene("alley-tale", { cameraMode: "directed", camera: "", poses: "" });
    const chapters: PlanChapter[] = [{ number: 1, title: "أ", scenes: [directed] }];
    directIllus(chapters, "001");
    expect(directed.props.camera).toBe("still");
    expect(directed.props.poses).toBe("stand");
    directIllus(chapters, "001");
    expect(directed.props.camera).toBe("still");
    expect(directed.props.poses).toBe("stand");
  });

  it("preserves explicit camera and acting choices", () => {
    const directed = scene("alley-tale", { cameraMode: "directed", camera: "track", poses: "point" });
    directIllus([{ number: 1, title: "أ", scenes: [directed] }], "001");
    expect(directed.props.camera).toBe("track");
    expect(directed.props.poses).toBe("point");
  });

  it("keeps legacy auto camera and non-illustrated templates unchanged", () => {
    const legacy = scene("alley-tale", { camera: "", poses: "" });
    const other = scene("kinetic-text", { camera: "", poses: "", label: "independent channel" });
    const untouched = JSON.stringify(other);
    directIllus([{ number: 1, title: "أ", scenes: [legacy, other] }], "001");
    expect(legacy.props.camera).toBe("push");
    expect(legacy.props.poses).not.toBe("stand");
    expect(JSON.stringify(other)).toBe(untouched);
  });
});
