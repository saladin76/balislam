import { describe, expect, it } from "vitest";
import { narrationReviewPlaylist } from "../app/src/workspace/reviewPlaylist";

const scenes = [
  { id: "c1-s1", narration: "النص الأول" },
  { id: "c1-s2", narration: "" },
  { id: "c1-s3", narration: "النص الثالث" },
];

describe("contiguous human narration listening queue", () => {
  it("keeps episode scene order and skips scenes that have no spoken text", () => {
    const voice = {
      "c1-s1": { file: "one.mp3", text: "النص الأول" },
      "c1-s3": { file: "three.mp3", text: "النص الثالث" },
    };
    expect(narrationReviewPlaylist(scenes, voice as never)).toEqual([
      { id: "c1-s1", file: "one.mp3", text: "النص الأول" },
      { id: "c1-s3", file: "three.mp3", text: "النص الثالث" },
    ]);
  });
  it("does not play stale narration clips or unsafe paths", () => {
    const voice = {
      "c1-s1": { file: "one.mp3", text: "old script" },
      "c1-s3": { file: "../private.mp3", text: "النص الثالث" },
    };
    expect(narrationReviewPlaylist(scenes, voice as never)).toEqual([]);
  });
  it("does not silently shorten an incomplete listening sequence", () => {
    const voice = { "c1-s1": { file: "one.mp3", text: "النص الأول" } };
    const queue = narrationReviewPlaylist(scenes, voice as never);
    expect(queue.length).toBe(1);
    expect(queue.length).toBeLessThan(scenes.filter((s) => s.narration.trim()).length);
  });
});
