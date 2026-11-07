import { describe, expect, it } from "vitest";
import { parseStudioDeliveries } from "../app/server/studioTransfers";

const valid = { url: "https://drive.google.com/open?id=known", md5: "a".repeat(32), updated: "2026-11-06T09:00:00Z" };

describe("Studio handoff visibility", () => {
  it("keeps channel boundaries and distinguishes video and storyboard", () => {
    const list = parseStudioDeliveries({
      "bilislam|001-episode|scene-01|mp4": valid,
      "dafatir-alzaman|002-episode|storyboard|visual|pdf": valid,
    });
    expect(list).toHaveLength(2);
    expect(list.find((x) => x.kind === "video")?.channel).toBe("balislam");
    expect(list.find((x) => x.kind === "storyboard")?.channel).toBe("dafatir-alzaman");
    expect(list.every((x) => x.status === "delivered_pending_review")).toBe(true);
  });
  it("never displays unsafe links or malformed slot data", () => {
    const list = parseStudioDeliveries({
      "bilislam|001-episode|scene-01|mp4": { ...valid, url: "javascript:alert(1)" },
      "bilislam|../private|scene-01|mp4": valid,
      "unknown|001-episode|scene-01|mp4": valid,
      "bilislam|001-episode|scene-02|mp4": valid,
    });
    expect(list.map((x) => x.slot)).toEqual(["scene-02"]);
  });
  it("handles missing or corrupt indexes safely", () => {
    expect(parseStudioDeliveries(null)).toEqual([]);
    expect(parseStudioDeliveries([])).toEqual([]);
    expect(parseStudioDeliveries("invalid")).toEqual([]);
  });
});
