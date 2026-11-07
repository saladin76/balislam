import { describe, expect, it } from "vitest";
import { assertCuratedVoiceSample, voiceSampleTextFor } from "../src/voice/sampleText";

describe("safe non-Quran voice-clone samples", () => {
  it("accepts only exact curated text for each of the three channel identities", () => {
    for (const channel of ["balislam", "dafatir-alzaman", "zubdat-alkutub"]) {
      const approved = voiceSampleTextFor(channel);
      expect(approved.length).toBeGreaterThan(30);
      expect(approved).not.toMatch(/\[\s*آية\s*:/u);
      expect(assertCuratedVoiceSample(channel, approved)).toBe(approved);
      expect(() => assertCuratedVoiceSample(channel, approved + " زيادة")).toThrow(/ثابت/);
    }
  });
  it("refuses requests containing Quran verse text or an arbitrary voice prompt", () => {
    for (const input of [
      "[آية: النجم 39 | وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ]",
      "قُلْ هُوَ اللَّهُ أَحَدٌ",
      "مرحبا بكم",
      "",
      null,
    ]) {
      expect(() => assertCuratedVoiceSample("balislam", input)).toThrow();
    }
  });
});
