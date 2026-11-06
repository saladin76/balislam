import { describe, expect, it } from "vitest";
import { stagePillClear, stagePillX } from "../src/remotion/scenes/LightStage";
import { roadPillX } from "../src/remotion/scenes/RoadJourney";
import { REVIEW_014, review014Frames } from "../src/remotion/lab/ReviewReel014";

const w = (s: string) => s.length * 46 * 0.58 + 64;

describe("الأمر 014: كلمات المعنى في نسخة المراجعة", () => {
  it("«ظل ونور» الطبيعي: الكلمة لا تُعرض في لقطة قريبة تغطي فيها الرأس أو السطر المكتوب", () => {
    const heroX = 960;
    const y1 = 860 - 470 - 60; // الكلمة الثانية
    // اللقطة الأقرب في العمودي: لا تتسع
    expect(stagePillClear(y1, heroX, stagePillX(heroX + 360, heroX, 1.6, "عدلًا", true), 1.6, "عدلًا", true)).toBe(false);
    // اللقطة الواسعة في الأفقي: تتسع بجواره
    expect(stagePillClear(860 - 470, heroX, stagePillX(heroX - 360, heroX, 1.05, "ظلمًا", false), 1.05, "ظلمًا", false)).toBe(true);
  });
  it("«الطريق» الطبيعي: الكلمة داخل الإطار العمودي كاملة ولا تغطي رأس البطل", () => {
    const heroX = 1120;
    for (const z of [0.9, 1.02, 1.08]) {
      for (const x of [heroX - 330, heroX + 330]) {
        const p = roadPillX(x, heroX, z, "بخطئه", true);
        expect(p - w("بخطئه") / 2).toBeGreaterThanOrEqual(heroX - 380 / z);
        expect(p + w("بخطئه") / 2 <= heroX - 90 || p - w("بخطئه") / 2 >= heroX + 90).toBe(true);
      }
    }
  });
  it("النسخة صامتة ومحايدة، بين 45 و60 ثانية", () => {
    const s = review014Frames() / 30;
    expect(s).toBeGreaterThanOrEqual(45);
    expect(s).toBeLessThanOrEqual(60);
    expect(REVIEW_014.some((p) => "audio" in p)).toBe(false);
  });
});
