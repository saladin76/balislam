import { describe, expect, it } from "vitest";
import { motionBySegments, motionKindOf } from "../src/render/motionSegments";

describe("فصل قياس الحركة: النص المقدس عن السرد والشرح", () => {
  it("مشهد الدعاء نفسه وبطاقات الآيات «مقدس»، وشرح الدعاء سرد", () => {
    expect(motionKindOf({ template: "dua-board", props: { cues: "dua | اللهم" } })).toBe("sacred");
    expect(motionKindOf({ template: "dua-board", props: { cues: "ask1 | نرى" } })).toBe("narrative");
    expect(motionKindOf({ template: "verse-card", props: {} })).toBe("sacred");
    expect(motionKindOf({ template: "alley-tale", props: {} })).toBe("narrative");
  });

  it("كل ثانية تُحسب في نوع مشهدها فقط، والسكون يُسجل لكل نوع", () => {
    const r = { percent: 0, seconds: 6, activeSeconds: 0, perSecond: [5, 0, 0, 0, 5, 5], still: [] };
    const res = motionBySegments(r, [
      { from: 0, to: 1, kind: "narrative" },
      { from: 1, to: 4, kind: "sacred" },
      { from: 4, to: 6, kind: "narrative" },
    ]);
    expect(res.narrative).toMatchObject({ seconds: 3, activeSeconds: 3, percent: 100 });
    expect(res.sacred).toMatchObject({ seconds: 3, activeSeconds: 0, still: [{ from: 1, to: 4 }] });
  });
});
