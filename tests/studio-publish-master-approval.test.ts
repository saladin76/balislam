import { describe, expect, it } from "vitest";
import { validPublishedMaster } from "../app/src/tabs/PublishTab";

describe("PublishTab respects six-stage exact Master approval", () => {
  const video = { size: 100, mtime: 1730990000000 };
  const old = { approved: { at: "2026-11-07T10:00:00Z", size: video.size, mtime: video.mtime } };

  it("does not trust legacy size/mtime approval when workflow ledger is missing", () => {
    expect(validPublishedMaster(null, old, video, true)).toBe(false);
    expect(validPublishedMaster({ master: { status: "reapproval_required" } }, old, video, true)).toBe(false);
    expect(validPublishedMaster({ master: { status: "draft" } }, old, video, true)).toBe(false);
  });

  it("requires a current engine Master approval and exact legacy file revision", () => {
    const approved = { master: { status: "approved" as const, reviewer: "verified owner" } };
    expect(validPublishedMaster(approved, old, video, true)).toBe(true);
    expect(validPublishedMaster(approved, old, { ...video, mtime: video.mtime + 2 }, true)).toBe(false);
    expect(validPublishedMaster(approved, old, video, false)).toBe(false);
    expect(validPublishedMaster(approved, {}, video, true)).toBe(false);
  });
});
