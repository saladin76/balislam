import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createChannel } from "../src/channel/create";
import { channelPaths, isChannelId, listChannels, loadChannel, runWithChannel, currentChannelId } from "../src/channel";
import { writeJsonAtomic } from "../src/channel/storage";
import { listScriptEpisodeDirs, resolveScriptPath } from "../src/script/episodes";

const project = path.resolve(import.meta.dirname, "..");
let dir: string;
let previous: string | undefined;

const seed = (id: string) => {
  const target = path.join(dir, id);
  mkdirSync(path.join(target, "episodes"), { recursive: true });
  for (const name of ["channel.json", "identity.default.json", "identity.json"]) {
    writeFileSync(path.join(target, name), readFileSync(path.join(project, "channels", id, name)));
  }
  writeFileSync(path.join(target, "pronunciation.json"), '{"entries":[]}\n');
};

beforeEach(() => {
  previous = process.env.BAL_CHANNELS_DIR;
  dir = mkdtempSync(path.join(tmpdir(), "studio-core-isolation-"));
  process.env.BAL_CHANNELS_DIR = dir;
  for (const id of ["balislam", "dafatir-alzaman", "zubdat-alkutub"]) seed(id);
});
afterEach(() => {
  if (previous === undefined) delete process.env.BAL_CHANNELS_DIR;
  else process.env.BAL_CHANNELS_DIR = previous;
  rmSync(dir, { recursive: true, force: true });
});

describe("channel boundaries and crash-safe storage", () => {
  it("rejects malicious selectors before constructing paths", () => {
    for (const id of ["../balislam", "Balislam", "a/b", "-", "a--b", "a.", "", "%2F"]) {
      expect(isChannelId(id)).toBe(false);
      expect(() => channelPaths(id)).toThrow("معرّف");
      expect(() => runWithChannel(id, () => null)).toThrow("معرّف");
    }
    expect(listChannels()).toEqual(["balislam", "dafatir-alzaman", "zubdat-alkutub"]);
  });

  it("never follows channel aliases, symlinked media or foreign JSON files", () => {
    symlinkSync(path.join(dir, "balislam"), path.join(dir, "copy-of-balislam"), "dir");
    expect(listChannels()).not.toContain("copy-of-balislam");
    expect(() => channelPaths("copy-of-balislam")).toThrow("رابط رمزي");
    symlinkSync(path.join(dir, "dafatir-alzaman", "episodes"), path.join(dir, "balislam", "images"), "dir");
    expect(() => channelPaths("balislam")).toThrow("رابط رمزي");
  });

  it("never resolves a symlinked episode into another channel", async () => {
    const other = path.join(channelPaths("dafatir-alzaman").episodes, "001-real");
    mkdirSync(other);
    writeFileSync(path.join(other, "script.md"), "Foreign channel content");
    const own = channelPaths("balislam").episodes;
    symlinkSync(other, path.join(own, "001-aliased"), "dir");
    expect(await listScriptEpisodeDirs(own)).toEqual([]);
    await expect(runWithChannel("balislam", () => resolveScriptPath("001"))).rejects.toThrow("غير موجودة");
    expect(readFileSync(path.join(other, "script.md"), "utf8")).toBe("Foreign channel content");
  });

  it("rejects damaged or mismatched config without rewriting it or other channels", () => {
    const file = channelPaths("balislam").channelFile;
    const otherBefore = readFileSync(channelPaths("dafatir-alzaman").channelFile, "utf8");
    const original = readFileSync(file, "utf8");
    writeFileSync(file, "{bad json");
    expect(() => loadChannel("balislam")).toThrow("تالف");
    expect(readFileSync(file, "utf8")).toBe("{bad json");
    writeFileSync(file, original.replace('"id": "balislam"', '"id": "not-balislam"'));
    expect(() => loadChannel("balislam")).toThrow("لا يطابق");
    expect(readFileSync(channelPaths("dafatir-alzaman").channelFile, "utf8")).toBe(otherBefore);
  });

  it("publishes exactly one new channel in a concurrent create race", async () => {
    const opts = { id: "fourth-channel", name: "قناة جديدة", language: "ar", quran: false };
    const results = await Promise.allSettled([createChannel(opts), createChannel(opts)]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((x) => x.status === "rejected")).toHaveLength(1);
    expect(listChannels()).toContain(opts.id);
    expect(loadChannel(opts.id).rules.quran).toBe(false);
    expect(JSON.parse(readFileSync(channelPaths(opts.id).identity, "utf8")).themes.paper).toBeTruthy();
    expect(readdirSync(dir).some((name) => name.startsWith(".fourth-channel.creating-"))).toBe(false);
    expect(readdirSync(dir).some((name) => name.includes("fourth-channel.create.lock"))).toBe(false);
  });

  it("refuses a concurrent or abandoned creation lock without altering another channel", async () => {
    const claim = path.join(dir, ".locked-channel.create.lock");
    writeFileSync(claim, "owned by another process");
    const before = readFileSync(claim, "utf8");
    await expect(createChannel({ id: "locked-channel", name: "Locked", language: "ar" })).rejects.toThrow("قفل");
    expect(readFileSync(claim, "utf8")).toBe(before);
    expect(listChannels()).not.toContain("locked-channel");
  });

  it("preserves an existing empty directory and does not convert it into a channel", async () => {
    const target = path.join(dir, "reserved");
    mkdirSync(target);
    await expect(createChannel({ id: "reserved", name: "Reserved", language: "ar" })).rejects.toThrow("موجودة");
    expect(readdirSync(target)).toEqual([]);
  });

  it("keeps three overlapping async channel contexts independent", async () => {
    const ids = ["balislam", "dafatir-alzaman", "zubdat-alkutub"];
    const selected = await Promise.all(ids.map((id, index) => runWithChannel(id, async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, index * 3));
      return { scope: currentChannelId(), file: channelPaths().channelFile, channel: loadChannel().id };
    })));
    expect(selected.map((x) => x.scope)).toEqual(ids);
    expect(selected.map((x) => x.channel)).toEqual(ids);
    expect(new Set(selected.map((x) => x.file)).size).toBe(3);
  });

  it("atomically replaces JSON and preserves the prior bytes on serialization failure", async () => {
    const file = path.join(dir, "balislam", "calendar.json");
    await writeJsonAtomic(file, { a: 1 });
    const before = readFileSync(file, "utf8");
    await expect(writeJsonAtomic(file, { invalid: BigInt(1) })).rejects.toThrow();
    expect(readFileSync(file, "utf8")).toBe(before);
    expect(readdirSync(path.dirname(file)).some((name) => name.startsWith(".calendar.json."))).toBe(false);
    await Promise.all(Array.from({ length: 12 }, (_, i) => writeJsonAtomic(file, { generation: i, complete: true })));
    const final = JSON.parse(readFileSync(file, "utf8"));
    expect(final.complete).toBe(true);
    expect(final.generation).toBeGreaterThanOrEqual(0);
    expect(final.generation).toBeLessThan(12);
    expect(existsSync(file)).toBe(true);
  });
});
