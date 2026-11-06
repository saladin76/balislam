import { describe, expect, it } from "vitest";
import { summarizeStudioRelease, type ReleaseInput } from "../app/server/studioReleaseReadiness";

const ready = (): ReleaseInput => ({
  channel: "zubdat-alkutub", episode: "001", found: true, folder: "001-awwal-marra-osalli",
  scriptValid: true, storyboard: { done: 2, total: 2 }, scenes: { done: 2, total: 2 },
  sources: { done: 1, total: 1 }, narration: { done: 2, total: 2 },
  verseTextMissing: 0, master: true, masterVoiced: true, approved: true,
  publishFiles: { done: 5, total: 5 },
});

describe("Studio release-readiness assessment (never auto-approval)", () => {
  it("blocks a missing episode without making up a failed source gate", () => {
    const result = summarizeStudioRelease({ ...ready(), found: false, folder: null });
    expect(result.state).toBe("blocked");
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toContain("مجلد");
  });
  it("lists every incomplete gate without silently approving", () => {
    const r = ready();
    r.storyboard.done = 0; r.scenes.done = 1; r.narration.done = 0;
    r.sources.done = 0; r.verseTextMissing = 3; r.master = false;
    r.masterVoiced = false; r.approved = false; r.publishFiles.done = 1;
    const result = summarizeStudioRelease(r);
    expect(result.state).toBe("blocked");
    expect(result.blockers).toHaveLength(8);
    expect(result.blockers.join(" ")).toContain("بطاقات آيات");
  });
  it("does not imply publishing permission even when all file checks pass", () => {
    const r = summarizeStudioRelease(ready());
    expect(r.blockers).toEqual([]);
    expect(r.state).toBe("needs_human_review");
    expect(r).not.toHaveProperty("publishAllowed");
    expect(r).not.toHaveProperty("published");
  });
  it("rechecks master sound and owner fingerprint independently", () => {
    const r = summarizeStudioRelease({ ...ready(), masterVoiced: false, approved: false });
    expect(r.state).toBe("blocked");
    expect(r.blockers.some((x) => x.includes("Master"))).toBe(true);
    expect(r.blockers.some((x) => x.includes("المالك"))).toBe(true);
  });
});
