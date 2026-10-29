import { describe, expect, it } from "vitest";
import { createQuranClient, QF_URLS } from "../src/quran/client";
import { composeVerses } from "../src/quran/sync";
import { createElevenLabs } from "../src/voice/elevenlabs";
import { alignmentToWords, applyDictionary, wordsForCaptions } from "../src/voice/words";

/** fetch وهمي يسجّل الطلبات ويرد حسب المسار. */
const mockFetch = (routes: Record<string, (init: RequestInit) => { status?: number; json?: unknown; body?: string }>) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const key = Object.keys(routes).find((k) => url.includes(k));
    const r = key ? routes[key]!(init) : { status: 404, body: "not found" };
    const status = r.status ?? 200;
    return new Response(r.json !== undefined ? JSON.stringify(r.json) : (r.body ?? ""), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { f, calls };
};

describe("Quran Foundation", () => {
  it("يأخذ رمز الدخول بـ Basic ويرسل الترويستين المطلوبتين", async () => {
    const { f, calls } = mockFetch({
      "/oauth2/token": () => ({ json: { access_token: "T1", expires_in: 3600 } }),
      "/verses/by_key/53:39": () => ({ json: { verse: { verse_key: "53:39", verse_number: 39, text_uthmani: "وَأَن لَّيْسَ لِلْإِنسَٰنِ إِلَّا مَا سَعَىٰ" } } }),
    });
    const qf = createQuranClient({ clientId: "ID", clientSecret: "SECRET", env: "prelive", fetchImpl: f });
    const v = await qf.verse("53:39");
    expect(v.text).toContain("سَعَىٰ");
    expect(calls[0]!.url).toBe(`${QF_URLS.prelive.auth}/oauth2/token`);
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from("ID:SECRET").toString("base64")}`);
    expect(String(calls[0]!.init.body)).toBe("grant_type=client_credentials&scope=content");
    expect(calls[1]!.url).toBe(`${QF_URLS.prelive.api}/content/api/v4/verses/by_key/53:39?fields=text_uthmani`);
    expect(calls[1]!.init.headers).toMatchObject({ "x-auth-token": "T1", "x-client-id": "ID" });
  });

  it("يجدد الرمز مرة عند 401", async () => {
    let n = 0;
    const { f } = mockFetch({
      "/oauth2/token": () => ({ json: { access_token: `T${++n}`, expires_in: 3600 } }),
      "/verses/by_key/1:1": (init) => ((init.headers as Record<string, string>)["x-auth-token"] === "T1" ? { status: 401 } : { json: { verse: { verse_number: 1, text_uthmani: "بِسْمِ ٱللَّهِ" } } }),
    });
    const qf = createQuranClient({ clientId: "a", clientSecret: "b", fetchImpl: f });
    expect((await qf.verse("1:1")).text).toBe("بِسْمِ ٱللَّهِ");
  });

  it("يضع علامة نهاية الآية ورقمها بين آيات المقطع دون تغيير النص", () => {
    expect(composeVerses([{ key: "1:1", number: 1, text: "أ" }])).toBe("أ");
    expect(composeVerses([{ key: "2:255", number: 255, text: "أ" }, { key: "2:256", number: 256, text: "ب" }])).toBe("أ ۝٢٥٥ ب ۝٢٥٦");
  });
});

describe("ElevenLabs", () => {
  const alignment = (text: string, step = 0.1) => ({
    characters: [...text],
    character_start_times_seconds: [...text].map((_, i) => i * step),
    character_end_times_seconds: [...text].map((_, i) => (i + 1) * step),
  });

  it("يرسل النص والإعدادات والسياق ويقرأ الصوت والتوقيت", async () => {
    const { f, calls } = mockFetch({
      "/with-timestamps": () => ({ json: { audio_base64: Buffer.from("ID3").toString("base64"), alignment: alignment("مرحبا بكم") } }),
    });
    const el = createElevenLabs({ apiKey: "K", voiceId: "V", fetchImpl: f });
    const r = await el.tts("مرحبا بكم", { previousText: "قبل", nextText: "بعد" });
    expect(r.audio.toString()).toBe("ID3");
    expect(calls[0]!.url).toContain("/v1/text-to-speech/V/with-timestamps");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({ text: "مرحبا بكم", model_id: "eleven_multilingual_v2", previous_text: "قبل", next_text: "بعد" });
    expect((calls[0]!.init.headers as Record<string, string>)["xi-api-key"]).toBe("K");
  });

  it("يشرح الأخطاء بالعربية", async () => {
    const { f } = mockFetch({ "/with-timestamps": () => ({ status: 401, body: "bad key" }) });
    const el = createElevenLabs({ apiKey: "K", voiceId: "V", fetchImpl: f });
    await expect(el.tts("نص")).rejects.toThrow("مفتاح ElevenLabs");
  });

  it("يحوّل توقيت الحروف إلى كلمات", () => {
    const w = alignmentToWords(alignment("كلمة أخرى"));
    expect(w.map((x) => x.word)).toEqual(["كلمة", "أخرى"]);
    expect(w[0]!.start).toBe(0);
    expect(w[1]!.end).toBeCloseTo(0.9);
  });

  it("قاموس النطق يغيّر المنطوق ويُبقي الترجمة بالكتابة الأصلية", () => {
    const d = applyDictionary("قال ابن تيمية: العلم", { entries: [{ text: "تيمية", say: "تَيْمِيَّة" }] });
    expect(d.spoken).toBe("قال ابن تَيْمِيَّة: العلم");
    const spoken = alignmentToWords(alignment(d.spoken));
    const words = wordsForCaptions(d.original, d.owner, spoken);
    expect(words.map((x) => x.word)).toEqual(["قال", "ابن", "تيمية:", "العلم"]);
    expect(words[3]!.start).toBeGreaterThan(words[2]!.start);
  });

  it("المؤثرات: المدة بين 0.5 و30 ثانية", async () => {
    const { f, calls } = mockFetch({ "/sound-generation": () => ({ body: "MP3" }) });
    const el = createElevenLabs({ apiKey: "K", voiceId: "V", fetchImpl: f });
    await el.soundEffect("paper", 60);
    expect(JSON.parse(String(calls[0]!.init.body)).duration_seconds).toBe(30);
  });
});
