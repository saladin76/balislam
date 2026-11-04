import { describe, expect, it } from "vitest";
import { currentChannelId, loadChannel, runWithChannel, channelPaths, channelInfo } from "../src/channel";
import { channelLibrary } from "../src/channel/library";
import { channelSamples } from "../src/remotion/scenes/channelSamples";

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
