import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fillMissingQuranTexts, inspectMissingQuranTexts } from "../src/quran/fillMissingText";
import type { QuranClient } from "../src/quran/client";

let root = "";
let episode = "";
const previousDir = process.env.BAL_CHANNELS_DIR;
const previousChannel = process.env.BAL_CHANNEL;
beforeAll(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "bal-script-quran-"));
  cpSync(path.join(__dirname, "..", "channels", "balislam"), path.join(root, "balislam"), {
    recursive: true, filter: (src) => !/[\\/](recitations|voice|out)([\\/]|$)/.test(src),
  });
  episode = path.join(root, "balislam", "episodes", "999-demo");
  cpSync(path.join(__dirname, "fixtures", "episodes", "000-demo"), episode, { recursive: true });
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_CHANNEL = "balislam";
});
afterAll(async () => {
  if (previousDir === undefined) delete process.env.BAL_CHANNELS_DIR;
  else process.env.BAL_CHANNELS_DIR = previousDir;
  if (previousChannel === undefined) delete process.env.BAL_CHANNEL;
  else process.env.BAL_CHANNEL = previousChannel;
  if (root) await rm(root, { recursive: true, force: true });
});

describe("Script is the only Quran verse source", () => {
  it("treats authored ayahs as present without any quran.json sidecar", async () => {
    const old = path.join(episode, "quran.json");
    if (existsSync(old)) throw new Error("test fixture must not introduce quran.json");
    const status = await inspectMissingQuranTexts("999");
    expect(status.existing).toContain("53:39");
    expect(status.missing).toEqual([]);
    expect(status.invalid).toEqual([]);
  });

  it("never fetches or writes missing text even with explicit legacy fill API call", async () => {
    const script = path.join(episode, "script.md");
    const cache = path.join(episode, "quran.json");
    const original = readFileSync(script, "utf8");
    const oldCache = JSON.stringify({ "53:39": "بيانات تاريخية لا تستعمل للعرض", custom: "keep" });
    writeFileSync(cache, oldCache);
    const queried: string[] = [];
    const client = { verse: async (key: string) => {
      queried.push(key);
      return { key, number: 39, text: "ممنوع جلب النص تلقائيًا" };
    } } as Pick<QuranClient, "verse">;
    try {
      writeFileSync(script, original.replace(/\[آية: النجم 39 \| [^\]]+\]/,
        "[آية: النجم 39]"));
      const status = await inspectMissingQuranTexts("999");
      expect(status.missing).toContain("53:39");
      const result = await fillMissingQuranTexts("999", client);
      expect(result.fetched).toEqual([]);
      expect(result.failed[0]?.reason).toMatch(/السكريبت/);
      expect(queried).toEqual([]);
      expect(readFileSync(cache, "utf8")).toBe(oldCache);
      expect(readFileSync(script, "utf8")).toContain("[آية: النجم 39]");
    } finally {
      writeFileSync(script, original);
    }
  });

  it("detects contradictory duplicate text without mutating existing local data", async () => {
    const script = path.join(episode, "script.md");
    const original = readFileSync(script, "utf8");
    const cache = path.join(episode, "quran.json");
    const old = readFileSync(cache, "utf8");
    try {
      writeFileSync(script, original.replace(/\[آية: النجم 39 \| [^\]]+\]/,
        "$&\n[آية: النجم 39 | نَصٌّ مُخْتَلِفٌ]"));
      const status = await inspectMissingQuranTexts("999");
      expect(status.invalid.some((x) => /نصان مختلفان/.test(x.reason))).toBe(true);
      expect(readFileSync(cache, "utf8")).toBe(old);
    } finally {
      writeFileSync(script, original);
    }
  });
});
