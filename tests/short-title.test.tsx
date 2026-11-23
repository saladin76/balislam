/**
 * تكملة D207 (قرار المالك ٢٣ نوفمبر، التعريف: docs/dafatir-alzaman/07-decisions.md): لا خطاف في الشورت؛ عليه عنوان هادئ
 * هو سؤاله، لا يظهر أبدًا في نافذة سكون مقصود (آية، ذكر الله، دعاء)، ويبقى غائبًا حتى تنتهي نافذة في أوله.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHORT_TITLE_FADE_SEC, shortTitleOpacity } from "../src/remotion/scenes/ShortTitle";
import { intendedStillness } from "../src/render/stillness";
import type { Plan } from "../src/plan/types";

describe("عنوان الشورت الهادئ", () => {
  it("يظهر بتلاشٍ قصير من أول الشورت ويثبت بلا حركة", () => {
    expect(shortTitleOpacity(0, [])).toBe(0);
    expect(shortTitleOpacity(SHORT_TITLE_FADE_SEC, [])).toBe(1);
    expect(shortTitleOpacity(20, [])).toBe(1);
  });
  it("غائب تمامًا داخل كل نافذة سكون، ويتلاشى قبلها ويعود بعدها", () => {
    const quiet = [{ from: 5, to: 9 }];
    for (const t of [5, 6.5, 9]) expect(shortTitleOpacity(t, quiet)).toBe(0);
    expect(shortTitleOpacity(4.85, quiet)).toBeLessThan(1);
    expect(shortTitleOpacity(9.15, quiet)).toBeLessThan(1);
    expect(shortTitleOpacity(12, quiet)).toBe(1);
  });
  it("نافذة في أول الشورت: يبقى غائبًا حتى تنتهي", () => {
    const plan = { chapters: [{ number: 1, title: "", scenes: [{ id: "a", template: "alley-tale", narration: "«اللهم أرنا الحق حقًّا وارزقنا اتباعه».", props: {} }] }] } as unknown as Plan;
    const quiet = intendedStillness(plan, 0);
    expect(quiet[0]!.from).toBeLessThanOrEqual(0);
    for (let t = 0; t <= quiet[0]!.to; t += 0.25) expect(shortTitleOpacity(t, quiet)).toBe(0);
  });
  it("يُرسم في الشورت العمودي وحده، من عنوان الشورت في حزمة النشر، بلا حركة ولا مؤثر", () => {
    const ep = readFileSync("src/remotion/scenes/Episode.tsx", "utf8");
    expect(ep).toMatch(/orientation === "portrait" && props\.shortTitle/);
    expect(ep).toContain("intendedStillness(plan,");
    const st = readFileSync("src/remotion/scenes/ShortTitle.tsx", "utf8");
    expect(st).not.toMatch(/spring\(|interpolate\(|transform:|scale\(|translate/);
    const pk = readFileSync("src/package/package.ts", "utf8");
    expect(pk).toMatch(/shortTitleFor\(scriptPath, seg\)/);
    expect(pk).toMatch(/youtube\?\.title/);
  });
});
