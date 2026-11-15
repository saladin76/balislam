import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TONE_DELIVERY_V4, tones, voiceSettingsFor } from "../src/voice/tones";
import config from "../config.json";

describe("النبرة (أول نسخة، 2d8bee52)", () => {
  it("إعداد النبرة هو قيمتها نفسها على multilingual v2، وعلى v4 أداؤها (D136)، وبلا نبرة لا شيء (إعدادات config.voice)", () => {
    const v = voiceSettingsFor(undefined, "dramatic", "eleven_multilingual_v2")!;
    expect(v).toEqual({ stability: tones.dramatic.stability, style: tones.dramatic.style, speed: tones.dramatic.speed });
    expect(voiceSettingsFor(undefined, "dramatic", "eleven_v4")).toEqual({ stability: TONE_DELIVERY_V4.dramatic.stability, style: tones.dramatic.style,
      speed: tones.dramatic.speed, direction: TONE_DELIVERY_V4.dramatic.direction });
    expect(voiceSettingsFor()).toBeUndefined();
  });

  it("لا طبقة قناة: النبرة نفسها في كل القنوات، والطبقة القديمة لا تؤثر", () => {
    const layer = { speed: 1.2, stability: 0.95, style: 0.9 };
    for (const t of Object.keys(tones) as (keyof typeof tones)[]) expect(voiceSettingsFor(layer, t)).toEqual(voiceSettingsFor(undefined, t));
    for (const id of ["balislam", "dafatir-alzaman", "zubdat-alkutub"]) {
      const v = JSON.parse(readFileSync(`channels/${id}/channel.json`, "utf8")).voice;
      expect(v.profile).toBeUndefined();
      expect(v.profileHistory["1"]).toBeTruthy();
    }
  });

  it("القيم في مدى ElevenLabs", () => {
    for (const t of Object.keys(tones) as (keyof typeof tones)[]) {
      const v = voiceSettingsFor(undefined, t)!;
      expect(v.speed).toBeLessThanOrEqual(1.2);
      expect(v.speed).toBeGreaterThanOrEqual(0.7);
      expect(v.stability).toBeLessThanOrEqual(1);
      expect(v.style).toBeLessThanOrEqual(1);
    }
    expect(config.voice.similarityBoost).toBe(0.8);
  });
});

describe("عيّنة السماع", () => {
  it("ترسل النبرة والنموذج بلا أمر أداء، وتقرّب الثبات في v3", async () => {
    const { createElevenLabs } = await import("../src/voice/elevenlabs");
    const bodies: any[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(new Uint8Array([1, 2, 3]));
    }) as unknown as typeof fetch;
    const el = createElevenLabs({ apiKey: "k", voiceId: "v", modelId: "eleven_multilingual_v2", fetchImpl });
    const tune = voiceSettingsFor(undefined, "warm", "eleven_multilingual_v2")!;
    expect((await el.sample("نص", { tune })).length).toBe(3);
    expect(bodies[0].voice_settings).toMatchObject({ stability: tune.stability, style: tune.style, speed: tune.speed });
    // multilingual v2 takes style and speed: the first version as it is, no performance direction
    expect(bodies[0].text).toBe("نص");
    await el.sample("نص", { tune: voiceSettingsFor(undefined, "warm", "eleven_v3"), modelId: "eleven_v3" });
    expect(bodies[1].model_id).toBe("eleven_v3");
    expect([0, 0.5, 1]).toContain(bodies[1].voice_settings.stability);
    // D136: a model without style takes the tone as its performance direction, before the text
    expect(bodies[1].text).toBe(`[${TONE_DELIVERY_V4.warm.direction}] نص`);
    expect(bodies[1].voice_settings.style).toBeUndefined();
  });
});

describe("نماذج الصوت الحديثة", () => {
  it("أوامر الأداء لا تصل إلى الترجمة", async () => {
    const { dropTagWords } = await import("../src/voice/models");
    const w = (word: string) => ({ word, start: 0, end: 0 });
    expect(dropTagWords([w("[calm,"), w("reflective]"), w("مرحبا"), w("بكم")]).map((x) => x.word)).toEqual(["مرحبا", "بكم"]);
  });

  it("السرعة بعد التوليد تغيّر المدة وتحفظ الصوت", async () => {
    const { RenderInternals } = await import("@remotion/renderer");
    const { applyTempo, scaleTimes } = await import("../src/voice/tempo");
    const { parseBuffer } = await import("music-metadata");
    const os = await import("node:os");
    const path = await import("node:path");
    const { readFileSync, mkdtempSync, rmSync } = await import("node:fs");
    const owned = mkdtempSync(path.join(os.tmpdir(), "bal-tone-"));
    const f = path.join(owned, "source.mp3");
    try {
    await RenderInternals.callFf({ bin: "ffmpeg", args: ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=220:duration=2", "-c:a", "libmp3lame", f], indent: false, logLevel: "error", binariesDirectory: null, cancelSignal: undefined });
    const src = readFileSync(f);
    const out = await applyTempo(src, 0.8);
    const d = (await parseBuffer(out, { mimeType: "audio/mpeg" }, { duration: true })).format.duration!;
    expect(d).toBeGreaterThan(2.3);
    expect(await applyTempo(src, 1)).toBe(src);
    expect(scaleTimes([{ start: 1, end: 2 }], 0.8)[0]!.end).toBeCloseTo(2.5);
    } finally {
      rmSync(owned, { recursive: true, force: true });
    }
  }, 30_000);
});
