import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createQuranClient } from "../src/quran/client";
import { syncQuran } from "../src/quran/sync";
import { collectMedia } from "../src/plan/collect";
import { requireCloudPublicationRights, activeRecitation, episodeRecitationFile, saveEpisodeRecitation, readEpisodeRecitation } from "../src/quran/provider";
import { regeneratePlan } from "../src/plan/io";

let tmp = "";
let mp3: Buffer;
beforeAll(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-rec-"));
  cpSync(path.join(__dirname, "..", "channels", "balislam"), path.join(tmp, "balislam"), { recursive: true, filter: (s) => !/[\\/](voice|out|recitations)([\\/]|$)/.test(s) && !s.endsWith("quran.json") });
  // الحلقة التجريبية للاختبارات (القنوات نفسها تبدأ بلا حلقات)
  cpSync(path.join(__dirname, "fixtures", "episodes", "000-demo"), path.join(tmp, "balislam", "episodes", "000-demo"), { recursive: true });
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


describe("تلاوة AlQuran Cloud داخل الفيديو بعد إثبات الحقوق", () => {
  it("يرفض أي اختيار بلا إذن نشر محدد", () => {
    expect(() => requireCloudPublicationRights({ provider: "alquran-cloud", edition: "ar.alafasy", name: "العفاسي",
      licence: { holder: "", evidence: "https://example.com/permission", scope: "يوتيوب والنشر التجاري", verifiedAt: new Date().toISOString() } })).toThrow(/إذن/);
    expect(() => requireCloudPublicationRights({ provider: "alquran-cloud", edition: "ar.alafasy", name: "العفاسي",
      licence: { holder: "المالك", evidence: "http://example.com/permission", scope: "يوتيوب والنشر التجاري", verifiedAt: new Date().toISOString() } })).toThrow(/HTTPS/);
  });

  it("يحفظ قارئ كل حلقة محليًا دون تغيير إعدادات القناة أو خطة الحلقة", async () => {
    const scriptPath = path.join(tmp, "balislam", "episodes", "000-demo", "script.md");
    const other = path.join(tmp, "balislam", "episodes", "999-other", "script.md");
    const selected = {
      provider: "alquran-cloud" as const, edition: "ar.alafasy", name: "القارئ المختار",
      licence: { holder: "صاحب الحق", evidence: "https://rights.example.org/recording",
        scope: "إذن نشر على يوتيوب للاستخدام التجاري", verifiedAt: new Date().toISOString() },
    };
    const planPath = path.join(path.dirname(scriptPath), "plan.json");
    const planBefore = existsSync(planPath) ? readFileSync(planPath, "utf8") : null;
    try {
      await saveEpisodeRecitation(scriptPath, selected);
      expect((await readEpisodeRecitation(scriptPath))?.edition).toBe("ar.alafasy");
      const current = readFileSync(episodeRecitationFile(scriptPath), "utf8");
      await expect(saveEpisodeRecitation(scriptPath, { provider: "alquran-cloud", edition: "ar.invalid", name: "غير مرخّص", licence: { holder: "", evidence: "", scope: "", verifiedAt: "" } })).rejects.toThrow();
      expect(readFileSync(episodeRecitationFile(scriptPath), "utf8")).toBe(current);
      expect((await activeRecitation(scriptPath, { id: 7, name: "قارئ القناة" }))?.provider).toBe("alquran-cloud");
      expect(await readEpisodeRecitation(other)).toBeNull();
      expect(existsSync(episodeRecitationFile(scriptPath))).toBe(true);
      expect(existsSync(planPath) ? readFileSync(planPath, "utf8") : null).toBe(planBefore);
    } finally {
      await saveEpisodeRecitation(scriptPath, null);
    }
    expect(await readEpisodeRecitation(scriptPath)).toBeNull();
    expect((await activeRecitation(scriptPath, { id: 7, name: "قارئ القناة" }))?.name).toBe("قارئ القناة");
  });

  it("يجلب الآية تلقائيًا من القارئ المرخّص ويجهزها لرندر بطاقة الآية", async () => {
    const scriptPath = path.join(tmp, "balislam", "episodes", "000-demo", "script.md");
    const recitation = {
      provider: "alquran-cloud" as const, edition: "ar.alafasy", name: "قارئ تجريبي متعدد",
      licence: { holder: "المالك المصرّح", evidence: "https://rights.example.org/licence/recording-1",
        scope: "إذن نشر على يوتيوب للاستخدام التجاري", verifiedAt: new Date().toISOString() },
    };
    const calls: string[] = [];
    try {
      await saveEpisodeRecitation(scriptPath, recitation);
      const f = (async (url: string) => {
        calls.push(url);
        if (url.includes("/oauth2/token")) return new Response(JSON.stringify({ access_token: "T", expires_in: 3600 }));
        if (url.includes("/verses/by_key/")) return new Response(JSON.stringify({ verse: { verse_number: 39, text_uthmani: "نص" } }));
        if (url.includes("api.alquran.cloud/v1/ayah/53:39/")) {
          const audio = url.endsWith("/ar.alafasy");
          return new Response(JSON.stringify({ code: 200, data: {
            surah: { number: 53 }, numberInSurah: 39, number: 4782,
            text: "نص", edition: { identifier: "ar.alafasy" },
            audio: audio ? "https://cdn.islamic.network/quran/audio/128/ar.alafasy/4782.mp3" : undefined,
          } }));
        }
        if (url === "https://cdn.islamic.network/quran/audio/128/ar.alafasy/4782.mp3")
          return new Response(new Uint8Array(mp3));
        return new Response("not found", { status: 404 });
      }) as unknown as typeof fetch;
      const client = createQuranClient({ clientId: "a", clientSecret: "b", fetchImpl: f });
      const r = await syncQuran("000", client);
      expect(r.failed).toEqual([]);
      expect(r.recited).toContain("53:39");
      const plan = await regeneratePlan("000");
      const media = await collectMedia("000", plan);
      expect(media.recitations["53:39"]?.source).toBe("alquran-cloud");
      expect(media.recitations["53:39"]?.reciter).toBe("قارئ تجريبي متعدد");
      expect(media.recitations["53:39"]?.parts?.length).toBe(1);
      expect(calls.some((url) => url.includes("/ayah/53:39/ar.alafasy"))).toBe(true);
      expect(calls.some((url) => url.endsWith("/ar.alafasy/4782.mp3"))).toBe(true);
    } finally {
      await saveEpisodeRecitation(scriptPath, null);
    }
  });
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
