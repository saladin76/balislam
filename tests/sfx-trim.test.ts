/** خفض مؤثر بعينه (طلب المالك ٢٢ نوفمبر: «دفاتر الزمن 001»، c1-s15 وc1-s35 وc1-s46 قريبة من حد الخلط) */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SFX_TRIM_MIN_DB, sfxTrim } from "../src/plan/sfxMix";

describe("gainDb لمؤثر في الخطة", () => {
  it("يخفض ولا يرفع، ومحصور بين ٠ و−١٨ ديسيبل", () => {
    expect(sfxTrim(undefined)).toBe(1);
    expect(sfxTrim(0)).toBe(1);
    expect(sfxTrim(-6)).toBeCloseTo(0.501, 3);
    expect(sfxTrim(5)).toBe(1);
    expect(sfxTrim(-40)).toBeCloseTo(Math.pow(10, SFX_TRIM_MIN_DB / 20), 6);
    expect(sfxTrim(Number.NaN)).toBe(1);
  });
  it("يُطبَّق في الرندر وفي فحص الخلط نفسه (لا يختلف ما يُسمع عما يُقاس)", () => {
    expect(readFileSync("src/remotion/scenes/Episode.tsx", "utf8")).toContain("sfxTrim(x.gainDb) * sfxGainAt(");
    expect(readFileSync("src/studio/quality/mix.ts", "utf8")).toContain("sfxTrim(x.gainDb) * sfxGainAt(");
  });
});
