/** D221: علامات الوقف من Tanzil تُضم إلى الكلمة التي قبلها للعرض وحده (فتُرسم فوق آخرها لا فوق المسافة) */
import { describe, expect, it } from "vitest";
import { quranDisplay } from "../src/quran/display";
import { fontFamilies, fontFiles } from "../brand/fonts";

describe("عرض الآية بالرسم العثماني (D221)", () => {
  it("علامة الوقف بعد مسافة تلتصق بالكلمة السابقة، ولا يتغير حرف غيرها", () => {
    const t = "خَلِيفَةً ۖ قَالُوٓا۟ لَكَ ۖ قَالَ";
    const d = quranDisplay(t);
    expect(d).toBe("خَلِيفَةًۖ قَالُوٓا۟ لَكَۖ قَالَ");
    expect(d.replace(/\s/g, "")).toBe(t.replace(/\s/g, ""));
  });
  it("كل علامات الوقف (ۖ ۗ ۘ ۙ ۚ ۛ ۜ) تُعامل كذلك", () => {
    for (const m of ["ۖ", "ۗ", "ۘ", "ۙ", "ۚ", "ۛ", "ۜ"]) expect(quranDisplay(`كلمة ${m} أخرى`)).toBe(`كلمة${m} أخرى`);
  });
  it("خط الآيات Amiri Quran مسجّل، والخط العادي بعده احتياطًا", () => {
    expect(fontFamilies.quran.startsWith("'Amiri Quran'")).toBe(true);
    expect(fontFiles.some((f) => f.family === "Amiri Quran" && f.file === "fonts/AmiriQuran.ttf")).toBe(true);
  });
});
