import { describe, expect, it } from "vitest";
import { safeName, assertSafeMediaFile } from "../app/server/util";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

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
      try {
        safeName(name);
        throw new Error(`Allowed invalid filename: ${name}`);
      } catch (e) {
        expect(e).toMatchObject({ status: 400 });
      }
    }
  });
});

describe("safe Studio media streaming paths", () => {
  it("serves only ordinary files under its root, never symlink aliases or foreign files", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "studio-core-media-"));
    const outside = mkdtempSync(path.join(os.tmpdir(), "studio-core-outside-"));
    try {
      mkdirSync(path.join(root, "channels", "one"), { recursive: true });
      mkdirSync(path.join(root, "channels", "two"), { recursive: true });
      const ownFile = path.join(root, "channels", "one", "shot.mp4");
      const foreign = path.join(root, "channels", "two", "secret.mp4");
      const external = path.join(outside, "secret.mp4");
      writeFileSync(ownFile, "safe");
      writeFileSync(foreign, "another channel");
      writeFileSync(external, "outside root");
      expect(() => assertSafeMediaFile(ownFile, root)).not.toThrow();
      expect(() => assertSafeMediaFile(external, root)).toThrowError(/ملف الوسائط/);
      symlinkSync(foreign, path.join(root, "channels", "one", "alias.mp4"));
      expect(() => assertSafeMediaFile(path.join(root, "channels", "one", "alias.mp4"), root)).toThrowError(/ملف الوسائط/);
      symlinkSync(path.join(root, "channels", "two"), path.join(root, "channels", "one", "aliased"), "dir");
      expect(() => assertSafeMediaFile(path.join(root, "channels", "one", "aliased", "secret.mp4"), root)).toThrowError(/ملف الوسائط/);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
