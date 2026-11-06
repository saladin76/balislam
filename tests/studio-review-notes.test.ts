import { describe, expect, it } from "vitest";
import { validateReviewNotes } from "../app/server/reviewNotes";

const good = { id: "note-0001", sceneId: "c1-s2", timeSec: 12.4, text: "راجع حركة يد الشخصية عند الثانية 12.4", createdAt: "2026-11-06T12:00:00Z" };

describe("Studio episode review notes", () => {
  it("accepts bounded scene-specific notes but never marks approval", () => {
    expect(validateReviewNotes([good])).toEqual([good]);
    expect("approved" in validateReviewNotes([good])[0]!).toBe(false);
  });
  it("rejects unsafe timing, scene ID and oversized text", () => {
    expect(() => validateReviewNotes([{ ...good, sceneId: "../secret" }])).toThrow();
    expect(() => validateReviewNotes([{ ...good, timeSec: -1 }])).toThrow();
    expect(() => validateReviewNotes([{ ...good, text: "x".repeat(2001) }])).toThrow();
  });
  it("rejects duplicate identifiers and bulk abuse", () => {
    expect(() => validateReviewNotes([good, good])).toThrow();
    expect(() => validateReviewNotes(Array.from({ length: 201 }, (_, i) => ({ ...good, id: "note-" + i })))).toThrow();
  });
});
