import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir, symlink } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { prepareStoryboardMedia } from "../src/plan/collect";
import type { Plan } from "../src/plan/types";

const planWithImage = () => ({
  version: 1, title: "Storyboard staging safety", episode: "001", themeId: "night",
  chapters: [{ number: 1, title: "First", scenes: [{
    id: "c1-s1", template: "doc-photo", narration: "النص", props: { image: "shot.png" }, sfx: [],
  }] }],
}) as unknown as Plan;

const ownedStoryboardDirs: string[] = [];
const isolatedStoryboardTmp = async () => { const d = await mkdtemp(path.join(tmpdir(), "studio-sb-assets-")); ownedStoryboardDirs.push(d); return d; };
afterEach(async () => { for (const d of ownedStoryboardDirs.splice(0)) await rm(d, { recursive:true, force:true }); });

describe("visual storyboard preparation never wipes current production render media", () => {
  it("supports legitimate Arabic image names without allowing path traversal", async () => {
    const base = await isolatedStoryboardTmp();
    const episode = path.join(base, "channels", "balislam", "episodes", "001-test");
    const publicRoot = path.join(base, "public");
    await mkdir(path.join(episode, "images"), { recursive: true });
    const name = "صورة المشهد الأول.png";
    await writeFile(path.join(episode, "images", name), "safe image content");
    const plan = planWithImage();
    plan.chapters[0]!.scenes[0]!.props.image = name;
    const media = await prepareStoryboardMedia("001", plan, {
      scriptPath: path.join(episode, "script.md"), publicRoot,
    });
    expect(media.images).toContain(name);
    expect(await readFile(path.join(publicRoot, media.base, "images", name), "utf8")).toBe("safe image content");
  });
  it("stages only referenced imagery into a separate content-hashed directory", async () => {
    const base = await isolatedStoryboardTmp();
    const episode = path.join(base, "channels", "balislam", "episodes", "001-test");
    const publicRoot = path.join(base, "public");
    await mkdir(path.join(episode, "images"), { recursive: true });
    await mkdir(path.join(publicRoot, "_render", "001", "voice"), { recursive: true });
    const image = path.join(episode, "images", "shot.png");
    const productionFile = path.join(publicRoot, "_render", "001", "voice", "important.mp3");
    await writeFile(image, "first version of storyboard visual");
    await writeFile(productionFile, "unchanged production voice");
    const args = { scriptPath: path.join(episode, "script.md"), publicRoot };
    const first = await prepareStoryboardMedia("001", planWithImage(), args);
    expect(first.mode).toBe("static");
    expect(first.base).toMatch(/^_storyboard_media\/balislam\/001-test-[a-f0-9]{16}\/$/);
    expect(first.voice).toEqual({});
    expect(first.recitations).toEqual({});
    expect(first.sfx).toEqual([]);
    expect(await readFile(path.join(publicRoot, first.base, "images", "shot.png"), "utf8"))
      .toBe("first version of storyboard visual");
    expect(await readFile(productionFile, "utf8")).toBe("unchanged production voice");
    await writeFile(image, "a new image revision");
    const second = await prepareStoryboardMedia("001", planWithImage(), args);
    expect(second.base).not.toBe(first.base);
    expect(await readFile(path.join(publicRoot, first.base, "images", "shot.png"), "utf8"))
      .toBe("first version of storyboard visual");
    expect(await readFile(path.join(publicRoot, second.base, "images", "shot.png"), "utf8"))
      .toBe("a new image revision");
    expect(await readFile(productionFile, "utf8")).toBe("unchanged production voice");
  });
  it("handles concurrent identical Storyboards without replacing prior images or leaving stages", async () => {
    const base = await isolatedStoryboardTmp();
    const episode = path.join(base, "channels", "balislam", "episodes", "001-test");
    const publicRoot = path.join(base, "public");
    await mkdir(path.join(episode, "images"), { recursive: true });
    await writeFile(path.join(episode, "images", "shot.png"), "ORIGINAL");
    const args = { scriptPath: path.join(episode, "script.md"), publicRoot };
    const results = await Promise.all(Array.from({ length: 5 }, () => prepareStoryboardMedia("001", planWithImage(), args)));
    expect(new Set(results.map((x) => x.base)).size).toBe(1);
    const first = results[0]!;
    expect(await readFile(path.join(publicRoot, first.base, "images", "shot.png"), "utf8")).toBe("ORIGINAL");
    const sibling = path.dirname(path.join(publicRoot, first.base));
    expect((await readdir(sibling)).filter((x) => x.startsWith(".stage-") || x.startsWith(".publish-"))).toEqual([]);
    await writeFile(path.join(episode, "images", "shot.png"), "UPDATED");
    const next = await prepareStoryboardMedia("001", planWithImage(), args);
    expect(next.base).not.toBe(first.base);
    expect(await readFile(path.join(publicRoot, first.base, "images", "shot.png"), "utf8")).toBe("ORIGINAL");
  });

  it("rejects storyboard image source directory symlinks without copying outside assets", async () => {
    const base = await isolatedStoryboardTmp();
    const episode = path.join(base, "channels", "balislam", "episodes", "001-test");
    const protectedDir = path.join(base, "protected");
    await mkdir(episode, { recursive: true });
    await mkdir(protectedDir);
    await writeFile(path.join(protectedDir, "shot.png"), "PRIVATE");
    await symlink(protectedDir, path.join(episode, "images"));
    await expect(prepareStoryboardMedia("001", planWithImage(), {
      scriptPath: path.join(episode, "script.md"), publicRoot: path.join(base, "public"),
    })).rejects.toThrow(/غير آمن/);
    expect(await readFile(path.join(protectedDir, "shot.png"), "utf8")).toBe("PRIVATE");
  });

});
