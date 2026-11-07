import { describe, expect, it } from "vitest";
import { safeName } from "../app/server/util";

describe("core API file selectors", () => {
  it("preserves valid Unicode and legacy media filenames", () => {
    expect(safeName("scene-001.mp4")).toBe("scene-001.mp4");
    expect(safeName("lib__board-v2.png")).toBe("lib__board-v2.png");
    expect(safeName(encodeURIComponent("صورة مرجعية.webp"))).toBe("صورة مرجعية.webp");
  });

  it("returns 400 for traversal, encoded separators and malformed encoding", () => {
    for (const name of [
      "..", ".", "../secret.png", "..%2Fsecret.png", "media%2Fsecret.png",
      "folder%5Csecret.png", "%00private", "%E0%A4%A",
    ]) {
      expect(() => safeName(name), name).toThrow(expect.objectContaining({ status: 400 }));
    }
  });
});
