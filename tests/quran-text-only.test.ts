import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fillMissingQuranTexts, inspectMissingQuranTexts } from "../src/quran/fillMissingText";
import type { QuranClient } from "../src/quran/client";

let tempRoot = "";
let episodeDir = "";
const oldChannels = process.env.BAL_CHANNELS_DIR;
const oldChannel = process.env.BAL_CHANNEL;
beforeAll(() => {
  tempRoot = mkdtempSync(path.join(os.tmpdir(), "bal-text-only-"));
  const channelDir = path.join(tempRoot, "balislam");
  cpSync(path.join(__dirname, "..", "channels", "balislam"), channelDir, {
    recursive: true, filter: (src) => !/[\\/](recitations|voice|out)([\\/]|$)/.test(src),
  });
  episodeDir = path.join(channelDir, "episodes", "999-demo");
  cpSync(path.join(__dirname, "fixtures", "episodes", "000-demo"), episodeDir, { recursive: true });
  process.env.BAL_CHANNELS_DIR = tempRoot;
  process.env.BAL_CHANNEL = "balislam";
});
afterAll(async () => {
  if (oldChannels === undefined) delete process.env.BAL_CHANNELS_DIR;
  else process.env.BAL_CHANNELS_DIR = oldChannels;
  if (oldChannel === undefined) delete process.env.BAL_CHANNEL;
  else process.env.BAL_CHANNEL = oldChannel;
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
});

describe("جلب نصوص الآيات الناقصة دون مساس بالإنتاج", () => {
  it("يضيف الناقص فقط ويحفظ النصوص القديمة والخطة والسكريبت والتسجيلات كما هي", async () => {
    const planFile = path.join(episodeDir, "plan.json");
    const scriptFile = path.join(episodeDir, "script.md");
    const cacheFile = path.join(episodeDir, "quran.json");
    const planBefore = existsSync(planFile) ? readFileSync(planFile) : null;
    const scriptBefore = readFileSync(scriptFile);
    const existing = { "20:14": "نص سابق معتمد", "20:14#at": "2026-11-01T00:00:00.000Z" };
    writeFileSync(cacheFile, JSON.stringify(existing));
    const queried: string[] = [];
    const client = { verse: async (key: string) => {
      queried.push(key);
      return { key, number: Number(key.split(":")[1]), text: "وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ" };
    } } as Pick<QuranClient, "verse">;
    const result = await fillMissingQuranTexts("999", client);
    expect(result.failed).toEqual([]);
    expect(result.fetched).toContain("53:39");
    expect(queried).toEqual(["53:39"]);
    const cache = JSON.parse(readFileSync(cacheFile, "utf8"));
    expect(cache["53:39"]).toContain("وَأَنْ");
    expect(cache["53:39#at"]).toBeTruthy();
    expect(cache["20:14"]).toBe("نص سابق معتمد");
    expect(cache["20:14#at"]).toBe(existing["20:14#at"]);
    expect(existsSync(planFile) ? readFileSync(planFile).equals(planBefore!) : planBefore === null).toBe(true);
    expect(readFileSync(scriptFile).equals(scriptBefore)).toBe(true);
    expect(existsSync(path.join(episodeDir, "recitations"))).toBe(false);
    queried.length = 0;
    const again = await fillMissingQuranTexts("999", client);
    expect(again.fetched).toEqual([]);
    expect(again.existing).toContain("53:39");
    expect(queried).toEqual([]);
  });
  it("يرفض استبدال المخزن إذا تغير أثناء طلب Quran Foundation", async () => {
    const cacheFile = path.join(episodeDir, "quran.json");
    const initial = JSON.stringify({ "other": "لا تغير هذا" });
    writeFileSync(cacheFile, initial);
    const concurrent = JSON.stringify({ "other": "تعديل صاحب المشروع", "custom#at": "2026-11-05" });
    const client = { verse: async (key: string) => {
      writeFileSync(cacheFile, concurrent);
      return { key, number: 39, text: "نص للمراجعة" };
    } } as Pick<QuranClient, "verse">;
    await expect(fillMissingQuranTexts("999", client)).rejects.toThrow(/تغير مخزن القرآن/);
    expect(readFileSync(cacheFile, "utf8")).toBe(concurrent);
  });

  it("يفشل الجلب دون كتابة نص ناقص أو تغيير ملف الخطة", async () => {
    const cacheFile = path.join(episodeDir, "quran.json");
    const planFile = path.join(episodeDir, "plan.json");
    writeFileSync(cacheFile, JSON.stringify({ untouched: "بيانات سابقة" }));
    const cacheBefore = readFileSync(cacheFile);
    const planBefore = existsSync(planFile) ? readFileSync(planFile) : null;
    const failingClient = { verse: async () => { throw new Error("QF offline"); } } as unknown as Pick<QuranClient, "verse">;
    const result = await fillMissingQuranTexts("999", failingClient);
    expect(result.fetched).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(readFileSync(cacheFile).equals(cacheBefore)).toBe(true);
    expect(existsSync(planFile) ? readFileSync(planFile).equals(planBefore!) : planBefore === null).toBe(true);
  });

  it("يرفض نصًا لآية أخرى حتى إن أعاد الخادم استجابة ناجحة", async () => {
    const cacheFile = path.join(episodeDir, "quran.json");
    const untouched = JSON.stringify({ custom: "معلومة محلية" });
    writeFileSync(cacheFile, untouched);
    const wrong = { verse: async () => ({ key: "53:40", number: 40, text: "نص آية مختلفة" }) }
      as unknown as Pick<QuranClient, "verse">;
    const result = await fillMissingQuranTexts("999", wrong);
    expect(result.fetched).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.reason).toMatch(/لا تطابق المرجع/);
    expect(readFileSync(cacheFile, "utf8")).toBe(untouched);
  });

  it("لا يخزن نتيجة جزئية إذا نجحت آية وفشلت أخرى", async () => {
    const cacheFile = path.join(episodeDir, "quran.json");
    const scriptFile = path.join(episodeDir, "script.md");
    const originalScript = readFileSync(scriptFile, "utf8");
    const originalCache = JSON.stringify({ untouched: "احتفظ بالقيمة" });
    try {
      writeFileSync(cacheFile, originalCache);
      // Two distinct references to exercise a partial failure after a successful fetch.
      writeFileSync(scriptFile, originalScript.replace("[آية: النجم 39]", "[آية: النجم 39]\n[آية: طه 14]"));
      const client = { verse: async (key: string) => {
        if (key === "20:14") throw new Error("network unavailable");
        return { key, number: 39, text: "نص تجريبي" };
      } } as Pick<QuranClient, "verse">;
      const result = await fillMissingQuranTexts("999", client);
      expect(result.failed).toHaveLength(1);
      expect(result.fetched).toEqual([]);
      expect(readFileSync(cacheFile, "utf8")).toBe(originalCache);
    } finally {
      writeFileSync(scriptFile, originalScript);
    }
  });

  it("يستعرض المراجع الناقصة دون جلب أو كتابة ملفات", async () => {
    const cacheFile = path.join(episodeDir, "quran.json");
    const original = JSON.stringify({ existing: "محلي" });
    writeFileSync(cacheFile, original);
    const found = await inspectMissingQuranTexts("999");
    expect(found.missing).toContain("53:39");
    expect(found.invalid).toEqual([]);
    expect(readFileSync(cacheFile, "utf8")).toBe(original);
  });

});
