import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { ensureUnlinkedDirectory, publishOutputWithoutOverwrite, copyUnlinkedFile } from "../src/render/fsIsolation";

const owned: string[] = [];
const make = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "studio-file-ownership-"));
  owned.push(root);
  return root;
};
afterEach(async () => {
  for (const root of owned.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("exclusive and atomic output ownership", () => {
  it("keeps an old MP4 untouched and publishes concurrent versions independently", async () => {
    const root = await make();
    const previous = path.join(root, "episode.mp4");
    await writeFile(previous, "ORIGINAL");
    const pending = await Promise.all(Array.from({ length: 6 }, async (_, i) => {
      const file = path.join(root, `pending-${i}.mp4`);
      await writeFile(file, `RUN-${i}`);
      return file;
    }));
    const published = await Promise.all(pending.map((p) => publishOutputWithoutOverwrite(p, previous)));
    expect(new Set(published).size).toBe(6);
    expect(published).not.toContain(previous);
    expect(await readFile(previous, "utf8")).toBe("ORIGINAL");
    for (let i = 0; i < published.length; i++) {
      expect(await readFile(published[i]!, "utf8")).toBe(`RUN-${i}`);
      expect(existsSync(pending[i]!)).toBe(false);
    }
  });

  it("creates a preferred output only once and never follows an existing symlink", async () => {
    const root = await make();
    const outside = path.join(root, "sensitive.txt");
    const linkPath = path.join(root, "render.mp4");
    await writeFile(outside, "PROTECTED");
    await symlink(outside, linkPath);
    const partial = path.join(root, "pending.mp4");
    await writeFile(partial, "PREVIEW");
    const actual = await publishOutputWithoutOverwrite(partial, linkPath);
    expect(actual).not.toBe(linkPath);
    expect(await readFile(outside, "utf8")).toBe("PROTECTED");
    expect(await readFile(actual, "utf8")).toBe("PREVIEW");
  });

  it("rejects source-directory and output-directory symlinks before reading/writing", async () => {
    const root = await make();
    const sourceDir = path.join(root, "source");
    const protectedDir = path.join(root, "protected");
    await mkdir(protectedDir);
    await mkdir(sourceDir);
    await writeFile(path.join(protectedDir, "x.png"), "SECRET");
    await symlink(protectedDir, path.join(sourceDir, "linked"));
    const safeDir = path.join(root, "safe");
    await ensureUnlinkedDirectory(safeDir);
    await expect(copyUnlinkedFile(path.join(sourceDir, "linked", "x.png"), path.join(safeDir, "x.png"))).rejects.toThrow(/غير آمن/);
    await symlink(protectedDir, path.join(root, "out-link"));
    await expect(ensureUnlinkedDirectory(path.join(root, "out-link", "child"))).rejects.toThrow(/غير آمن/);
    const pending = path.join(root, "pending.mp4");
    await writeFile(pending, "VIDEO");
    await expect(publishOutputWithoutOverwrite(pending, path.join(root, "out-link", "final.mp4"))).rejects.toThrow(/غير آمن/);
    expect(existsSync(pending)).toBe(true);
    expect(await readFile(path.join(protectedDir, "x.png"), "utf8")).toBe("SECRET");
  });

  it("refuses to move a partial file across directories", async () => {
    const root = await make();
    const input = path.join(root, "a", "temp.mp4");
    const output = path.join(root, "b", "video.mp4");
    await mkdir(path.dirname(input));
    await mkdir(path.dirname(output));
    await writeFile(input, "bytes");
    await expect(publishOutputWithoutOverwrite(input, output)).rejects.toThrow(/المجلد نفسه/);
    expect(existsSync(input)).toBe(true);
    expect(existsSync(output)).toBe(false);
  });
});
