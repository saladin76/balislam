import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { elementExclusion, templateExclusion } from "../src/channel/library";
import { currentChannelId, loadChannel, runWithChannel, channelPaths, channelInfo } from "../src/channel";
import { channelLibrary } from "../src/channel/library";
import { channelSamples } from "../src/remotion/scenes/channelSamples";
import { studioMediaNamespace } from "../src/plan/collect";
import path from "node:path";

const ids = ["balislam", "dafatir-alzaman", "zubdat-alkutub"] as const;

describe("shared studio isolation across all three channels", () => {
  it.each(ids)("loads the actual %s identity, library and template samples independently", (id) => {
    runWithChannel(id, () => {
      const channel = loadChannel();
      expect(channel.id).toBe(id);
      expect(channelInfo(channel).id).toBe(id);
      expect(channelPaths().dir).toContain(id);
      const allowed = new Set(channelLibrary(channel).templates);
      for (const template of Object.keys(channelSamples[id] ?? {})) expect(allowed.has(template), id + "/" + template).toBe(true);
    });
  });

  it("keeps each identity, assets directory and episode storage distinct", () => {
    const dirs = ids.map((id) => channelPaths(id));
    expect(new Set(dirs.map((d) => d.dir)).size).toBe(3);
    expect(new Set(dirs.map((d) => d.episodes)).size).toBe(3);
    const digests = dirs.map((d) => createHash("sha256").update(readFileSync(d.identity)).digest("hex"));
    expect(new Set(digests).size).toBe(3);
    for (const dir of dirs) {
      expect(dir.identity.startsWith(dir.dir)).toBe(true);
      expect(dir.episodes.startsWith(dir.dir)).toBe(true);
    }
  });

  it("uses the same studio engine but applies per-channel libraries and identity rules", () => {
    const channels = ids.map((id) => loadChannel(id));
    const libs = channels.map(channelLibrary);
    for (const lib of libs) {
      expect(lib.templates.length).toBeGreaterThan(0);
      expect(lib.elements.length).toBeGreaterThan(0);
    }
    expect(new Set(libs.map((l) => JSON.stringify(l))).size).toBeGreaterThan(1);
    for (let i = 0; i < ids.length; i++) {
      const c = channels[i]!;
      const lib = libs[i]!;
      for (const id of lib.elements) expect(elementExclusion(c, id)).toBeNull();
      for (const id of lib.templates) expect(templateExclusion(c, id)).toBeNull();
      expect(lib.figures).toBe(c.rules.faces);
    }
    expect(libs[0]!.figures).toBe(false);
    expect(libs[1]!.figures).toBe(true);
  });

  it("never reuses one channel's render or storyboard namespace for another", () => {
    const spaces = ids.map(id => studioMediaNamespace(path.join(channelPaths(id).episodes, "001-demo", "script.md")));
    expect(new Set(spaces.map(s => s.render)).size).toBe(3);
    expect(spaces.map(s => s.channelName)).toEqual([...ids]);
    expect(spaces.every(s => s.render.startsWith("_render/") && !s.render.includes(".."))).toBe(true);
    expect(() => studioMediaNamespace("/tmp/arbitrary/random/script.md")).toThrow(/غير قياسي/);
  });

  it("keeps overlapping asynchronous studio requests in distinct channels", async () => {
    const names = await Promise.all(ids.map((id, index) =>
      runWithChannel(id, async () => {
        await Promise.resolve();
        await new Promise<void>((resolve) => setTimeout(resolve, (3 - index) * 2));
        return { selected: currentChannelId(), loaded: loadChannel().id };
      })));
    expect(names).toEqual(ids.map((id) => ({ selected: id, loaded: id })));
  });
});
