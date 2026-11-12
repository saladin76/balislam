import { describe, expect, it } from "vitest";
import { createElevenLabs } from "../src/voice/elevenlabs";
import { capsFor } from "../src/voice/models";

/**
 * D94: «الجمل» (D50) تولّد كل جملة بطلب واحد «بنص الجارتين»، لكن النموذج الافتراضي eleven_v4 كان يُسقط النص المجاور
 * من الطلب (context: false)، فتُقرأ كل جملة منفصلة كأنها أول الكلام وآخره ويتقطّع الإيقاع بين الجمل.
 * لا طلب مدفوع هنا: fetch مُحاكى.
 */
type Sent = { url: string; body: Record<string, unknown> };
const mockFetch = (sent: Sent[], refuseContext = false) =>
  (async (url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as Record<string, unknown>;
    sent.push({ url, body });
    if (refuseContext && (body.previous_text || body.next_text))
      return new Response(JSON.stringify({ detail: "previous_text is not supported for this model" }), { status: 422 });
    const chars = [...String(body.text)];
    return new Response(JSON.stringify({ audio_base64: Buffer.from("x").toString("base64"),
      alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.05), character_end_times_seconds: chars.map((_, i) => (i + 1) * 0.05) } }), { status: 200 });
  }) as unknown as typeof fetch;

describe("v4 neighbour context (D94)", () => {
  it("eleven_v4 accepts neighbour text; v3 alone does not", () => {
    expect(capsFor("eleven_v4").context).toBe(true);
    expect(capsFor("eleven_v3").context).toBe(false);
    expect(capsFor("eleven_multilingual_v2").context).toBe(true);
  });

  it("a v4 sentence request carries the previous and next sentence", async () => {
    const sent: Sent[] = [];
    const c = createElevenLabs({ apiKey: "k", voiceId: "v", modelId: "eleven_v4", fetchImpl: mockFetch(sent) });
    await c.tts("ثُمَّ نَتَوَجَّهُ إِلَى الْمَسْجِدِ.", { previousText: "نَتَوَضَّأُ بِهُدُوءٍ.", nextText: "لَيْسَ الْمَقْصُودُ السُّرْعَةَ.",
      tune: { stability: 0.6, style: 0.3, speed: 0.97, direction: "clear, lively explainer" } });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body.previous_text).toBe("نَتَوَضَّأُ بِهُدُوءٍ.");
    expect(sent[0]!.body.next_text).toBe("لَيْسَ الْمَقْصُودُ السُّرْعَةَ.");
    // v4: no style and no native speed (speed is applied after generation), direction as a leading tag — unchanged
    const vs = sent[0]!.body.voice_settings as Record<string, unknown>;
    expect(vs.style).toBeUndefined();
    expect(vs.speed).toBeUndefined();
    expect(String(sent[0]!.body.text).startsWith("[clear, lively explainer] ")).toBe(true);
  });

  it("the context never carries Quran", async () => {
    const sent: Sent[] = [];
    const c = createElevenLabs({ apiKey: "k", voiceId: "v", modelId: "eleven_v4", fetchImpl: mockFetch(sent) });
    await c.tts("كَمَا جَاءَ فِي السُّورَةِ.", { previousText: "قَالَ تَعَالَى: ﴿قَدْ أَفْلَحَ الْمُؤْمِنُونَ﴾", nextText: "وَبَعْدَ هَذِهِ الْآيَاتِ." });
    expect(String(sent[0]!.body.previous_text ?? "")).not.toMatch(/﴿|أَفْلَحَ/);
  });

  it("a model that refuses the neighbour text is asked once more without it", async () => {
    const sent: Sent[] = [];
    const c = createElevenLabs({ apiKey: "k", voiceId: "v", modelId: "eleven_v4", fetchImpl: mockFetch(sent, true) });
    const r = await c.tts("جُمْلَةٌ.", { previousText: "قَبْلَهَا.", nextText: "بَعْدَهَا." });
    expect(r.audio.length).toBeGreaterThan(0);
    expect(sent).toHaveLength(2);
    expect(sent[1]!.body.previous_text).toBeUndefined();
    expect(sent[1]!.body.next_text).toBeUndefined();
    expect(sent[1]!.body.text).toBe(sent[0]!.body.text);
  });

  it("v3 sends no neighbour text (no stitching on v3)", async () => {
    const sent: Sent[] = [];
    const c = createElevenLabs({ apiKey: "k", voiceId: "v", modelId: "eleven_v3", fetchImpl: mockFetch(sent) });
    await c.tts("جُمْلَةٌ.", { previousText: "قَبْلَهَا.", nextText: "بَعْدَهَا." });
    expect(sent[0]!.body.previous_text).toBeUndefined();
  });
});
