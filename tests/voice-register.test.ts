import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tones, voiceSettingsFor } from "../src/voice/tones";
import config from "../config.json";

const profile = (id: string) => JSON.parse(readFileSync(`channels/${id}/channel.json`, "utf8")).voice.profile;

describe("طبقة صوت القناة والنبرة", () => {
  it("بلا طبقة: النبرة كما كانت (توافق مع الحلقات القديمة)", () => {
    const v = voiceSettingsFor(undefined, "dramatic")!;
    expect(v.stability).toBe(tones.dramatic.stability);
    expect(v.style).toBe(tones.dramatic.style);
    expect(v.speed).toBe(Math.round(tones.dramatic.speed * config.voice.speed * 100) / 100);
    expect(voiceSettingsFor()).toBeUndefined();
  });

  it("لكل قناة طبقتها، والنبرة نفسها تختلف بين القنوات", () => {
    const [b, d, z] = ["balislam", "dafatir-alzaman", "zubdat-alkutub"].map(profile);
    expect(new Set([b.speed, d.speed, z.speed]).size).toBe(3);
    const eb = voiceSettingsFor(b, "energetic")!;
    const ez = voiceSettingsFor(z, "energetic")!;
    expect(ez.speed).toBeGreaterThan(eb.speed);
    expect(voiceSettingsFor(b)!.speed).toBe(b.speed);
  });

  it("القيم تبقى في مدى ElevenLabs", () => {
    for (const t of Object.keys(tones) as (keyof typeof tones)[]) {
      const v = voiceSettingsFor({ speed: 1.2, stability: 0.95, style: 0.9 }, t)!;
      expect(v.speed).toBeLessThanOrEqual(1.2);
      expect(v.stability).toBeLessThanOrEqual(1);
      expect(v.style).toBeLessThanOrEqual(1);
    }
  });
});

describe("عيّنة السماع", () => {
  it("ترسل الطبقة والنبرة والنموذج، وتقرّب الثبات في v3", async () => {
    const { createElevenLabs } = await import("../src/voice/elevenlabs");
    const bodies: any[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(new Uint8Array([1, 2, 3]));
    }) as unknown as typeof fetch;
    const el = createElevenLabs({ apiKey: "k", voiceId: "v", fetchImpl });
    const tune = voiceSettingsFor({ speed: 1, stability: 0.45, style: 0.3 }, "warm")!;
    expect((await el.sample("نص", { tune })).length).toBe(3);
    expect(bodies[0].voice_settings).toMatchObject({ stability: tune.stability, style: tune.style, speed: tune.speed });
    await el.sample("نص", { tune, modelId: "eleven_v3" });
    expect(bodies[1].model_id).toBe("eleven_v3");
    expect([0, 0.5, 1]).toContain(bodies[1].voice_settings.stability);
  });
});
