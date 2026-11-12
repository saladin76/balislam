import { describe, expect, it } from "vitest";
import { composeVerses } from "../src/quran/sync";
import { parseAyahRef } from "../src/script/quranMeta";
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

describe("Local Quran references and verse formatting", () => {
  it("مرجع الآية بالعربية أو اللاتينية أو بالأرقام", () => {
    for (const r of ["النجم 39", "An-Najm 39", "Surah an najm 39", "53:39", "53 39"]) {
      const res = parseAyahRef(r);
      expect(res.ok && res.ref.key, r).toBe("53:39");
    }
    const range = parseAyahRef("Al-Baqarah 255-256");
    expect(range.ok && range.ref.key).toBe("2:255-256");
    expect(parseAyahRef("Ya-Sin 1").ok).toBe(true);
    expect(parseAyahRef("Nowhere 1").ok).toBe(false);
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
    const el = createElevenLabs({ apiKey: "K", voiceId: "V", modelId: "eleven_multilingual_v2", fetchImpl: f });
    const r = await el.tts("مرحبا بكم", { previousText: "قبل", nextText: "بعد" });
    expect(r.audio.toString()).toBe("ID3");
    expect(calls[0]!.url).toContain("/v1/text-to-speech/V/with-timestamps");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({ text: "مرحبا بكم", model_id: "eleven_multilingual_v2", previous_text: "قبل", next_text: "بعد" });
    expect((calls[0]!.init.headers as Record<string, string>)["xi-api-key"]).toBe("K");
  });

  it("v4: أمر الأداء أول النص، وبلا سرعة ولا تعبير (لا يقبلهما النموذج)، والنص المجاور يُرسل (D94)", async () => {
    const { f, calls } = mockFetch({
      "/with-timestamps": () => ({ json: { audio_base64: Buffer.from("ID3").toString("base64"), alignment: alignment("[calm] مرحبا") } }),
    });
    const el = createElevenLabs({ apiKey: "K", voiceId: "V", modelId: "eleven_v4", fetchImpl: f });
    await el.tts("مرحبا", { previousText: "قبل", tune: { stability: 0.6, style: 0.3, speed: 0.9, direction: "calm" } });
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.text).toBe("[calm] مرحبا");
    expect(body.model_id).toBe("eleven_v4");
    expect(body.voice_settings.stability).toBe(0.6);
    expect(body.voice_settings).not.toHaveProperty("speed");
    expect(body.voice_settings).not.toHaveProperty("style");
    expect(body.previous_text).toBe("قبل");
  });

  it("نموذج بلا توقيت: يُرجع الصوت وحده", async () => {
    const { f } = mockFetch({
      "/with-timestamps": () => ({ status: 422, body: "timestamps are not supported for this model" }),
      "/text-to-speech/V": () => ({ body: "ID3" }),
    });
    const el = createElevenLabs({ apiKey: "K", voiceId: "V", modelId: "eleven_v4", fetchImpl: f });
    const r = await el.tts("مرحبا");
    expect(r.alignment).toBeNull();
    expect(r.audio.toString()).toBe("ID3");
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
