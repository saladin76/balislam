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
