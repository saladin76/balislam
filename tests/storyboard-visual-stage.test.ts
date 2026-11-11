import { describe, expect, it } from "vitest";
import { checkVisualStoryboardSignoff } from "../src/plan/storyboardVisualGate";
import type { Plan } from "../src/plan/types";
const basePlan = (ayah = "نص الآية المعتمد من المصدر"): Plan => ({
  chapters: [{ number: 1, title: "الفصل", scenes: [
    { id: "c1-s1", template: "noor-text", line: 1, props: { text: "الفكرة" }, narration: "النص", sfx: [] },
    { id: "c1-s2", template: "verse-card", line: 2, props: { text: ayah, reference: "المرجع" }, narration: "", ayahKey: "1:1", sfx: [] },
  ] }],
}) as unknown as Plan;
const note = "راجعت جميع لوحات نسخة V021 بصريًا وتأكدت من تكوين كل مشهد.";

describe("Storyboard-first visual approval, independent of old silent motion check", () => {
  it("permits a documented visual signoff even before a motion audit exists", () => {
    expect(checkVisualStoryboardSignoff(basePlan(), note)).toEqual({ ok: true, note });
  });
  it("does not infer that 19 motion warnings are an approval or a blocker", () => {
    // The new visual stage has no motion-report dependency; motion QA is later.
    const result = checkVisualStoryboardSignoff(basePlan(), note);
    expect(result.ok).toBe(true);
    expect(result).not.toHaveProperty("motionApproved");
  });
  // 11 Nov (owner): the note is optional and one line, no minimum; «راجعته بنفسي» is the confirmation.
  it("accepts no note or a short one; refuses several lines", () => {
    expect(checkVisualStoryboardSignoff(basePlan(), "I clicked OK").ok).toBe(true);
    expect(checkVisualStoryboardSignoff(basePlan(), null).ok).toBe(true);
    expect(checkVisualStoryboardSignoff(basePlan(), "a\nb").ok).toBe(false);
    expect(checkVisualStoryboardSignoff(basePlan(), 12).ok).toBe(false);
  });
  it("keeps a missing Quran verse as a content approval blocker without blocking PDF draft review", () => {
    const result = checkVisualStoryboardSignoff(basePlan(""), note);
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty("reason");
    if (!result.ok) expect(result.reason).toContain("يمكن رفع المسودة");
  });
  it("does not approve an episode with no scenes", () => {
    const result = checkVisualStoryboardSignoff({ chapters: [] } as unknown as Plan, note);
    expect(result.ok).toBe(false);
  });
});
