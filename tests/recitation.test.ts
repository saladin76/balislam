import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createQuranClient } from "../src/quran/client";
import { syncQuran } from "../src/quran/sync";
import { collectMedia } from "../src/plan/collect";
import { regeneratePlan } from "../src/plan/io";

let tmp = "";
let mp3: Buffer;
beforeAll(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-rec-"));
  cpSync(path.join(__dirname, "..", "channels", "balislam"), path.join(tmp, "balislam"), { recursive: true, filter: (s) => !/[\\/](voice|out|recitations)([\\/]|$)/.test(s) && !s.endsWith("quran.json") });
  const ch = path.join(tmp, "balislam", "channel.json");
  writeFileSync(ch, JSON.stringify({ ...JSON.parse(readFileSync(ch, "utf8")), recitation: { id: 7, name: "قارئ تجريبي" } }));
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.BAL_CHANNEL = "balislam";
  const f = path.join(tmp, "tone.mp3");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=300:duration=1.5", "-c:a", "libmp3lame", f]);
  mp3 = readFileSync(f);
});
afterAll(() => {
  delete process.env.BAL_CHANNELS_DIR;
  delete process.env.BAL_CHANNEL;
});

describe("تلاوة Quran Foundation", () => {
  it("تُجلب مع النص وتُشغَّل في بطاقة الآية بنسبة القارئ", async () => {
    const calls: string[] = [];
    const f = (async (url: string) => {
      calls.push(url);
      if (url.includes("/oauth2/token")) return new Response(JSON.stringify({ access_token: "T", expires_in: 3600 }));
      if (url.includes("/verses/by_key/")) return new Response(JSON.stringify({ verse: { verse_number: 39, text_uthmani: "نص" } }));
      if (url.includes("/recitations/7/by_ayah/")) return new Response(JSON.stringify({ audio_files: [{ verse_key: url.split("/").pop(), url: "Test/mp3/053039.mp3" }] }));
      if (url.startsWith("https://verses.quran.com/")) return new Response(new Uint8Array(mp3));
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;
    const qf = createQuranClient({ clientId: "a", clientSecret: "b", fetchImpl: f });
    const r = await syncQuran("000", qf);
    expect(r.failed).toEqual([]);
    expect(r.recited).toContain("53:39");
    expect(calls.some((u) => u === "https://verses.quran.com/Test/mp3/053039.mp3")).toBe(true);
    const store = JSON.parse(readFileSync(path.join(tmp, "balislam", "episodes", "000-demo", "quran.json"), "utf8"));
    expect(store["53:39#at"]).toBeTruthy();
    const plan = await regeneratePlan("000");
    const media = await collectMedia("000", plan);
    expect(media.recitations["53:39"]?.source).toBe("quran-foundation");
    expect(media.recitations["53:39"]?.reciter).toBe("قارئ تجريبي");
    expect(media.recitations["53:39"]!.duration).toBeGreaterThan(1);
    // مرة ثانية خلال الأسبوع: لا جلب جديد
    calls.length = 0;
    const again = await syncQuran("000", qf);
    expect(again.recited).toEqual([]);
    expect(again.cached).toContain("53:39");
    expect(existsSync(path.join(tmp, "balislam", "episodes", "000-demo", "recitations", "7-53-39.mp3"))).toBe(true);
  });
});
