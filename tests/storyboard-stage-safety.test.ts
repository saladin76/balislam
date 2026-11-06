import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
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

describe("visual storyboard preparation never wipes current production render media", () => {
  it("stages only referenced imagery into a separate content-hashed directory", async () => {
    const base = await mkdtemp(path.join(tmpdir(), "studio-sb-assets-"));
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
    expect(first.base).toMatch(/^_storyboard_media\/001-[a-f0-9]{16}\/$/);
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
});
