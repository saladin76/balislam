import { describe, expect, it } from "vitest";
import { buildTashkeelIndex } from "../src/voice/tashkeel";
import { tashkeelReport } from "../src/voice/tashkeelReport";

const idx = buildTashkeelIndex("هَلْ تَعْرِفُ الْحَقَّ؟ الْحَقُّ وَاضِحٌ. مَنْ طَلَبَ عِلْمٌ نَافِعٌ وَجَدَ مِنْ رَبِّهِ مَا عَلِمَ.");

describe("مدقق التشكيل", () => {
  it("تغطية كاملة حين يوجد لكل كلمة نظير مشكول", () => {
    const r = tashkeelReport([{ id: "c1-s1", narration: "هل تعرف الحق؟" }], idx);
    expect(r.coverage).toBe(1);
    expect(r.ok).toBe(true);
    expect(r.gaps).toEqual([]);
  });

  it("يكشف الكلمات التي ستُنطق بلا تشكيل ويمنع التوليد تحت الحد", () => {
    const r = tashkeelReport([{ id: "c2-s1", narration: "هل تعرف الحق الذي نسيناه طويلا؟" }], idx);
    expect(r.ok).toBe(false);
    expect(r.gaps[0]!.sceneId).toBe("c2-s1");
    expect(r.gaps[0]!.words).toEqual(expect.arrayContaining(["الذي", "نسيناه", "طويلا"]));
  });

  it("قاموس النطق يغطي الكلمة، والحروف التي لا يلتبس نطقها لا تُحسب", () => {
    const r = tashkeelReport([{ id: "c1-s1", narration: "هل تعرف الحق يا صلاح" }], idx, { entries: [{ text: "صلاح", say: "صَلاح" }] });
    expect(r.ok).toBe(true);
  });

  it("بلا tashkeel.md لا يُسمح بالتوليد", () => {
    const r = tashkeelReport([{ id: "c1-s1", narration: "هل تعرف الحق؟" }], null);
    expect(r.file).toBe(false);
    expect(r.ok).toBe(false);
  });

  it("يكشف الكلمة التي لها أكثر من نطق، ولا يعدّ اختلاف الإعراب التباسًا", () => {
    const r = tashkeelReport([{ id: "c1-s1", narration: "الحق واضح من طلب علم نافع وجد من ربه ما علم" }], idx);
    const words = r.ambiguous.map((a) => a.word);
    expect(words).toContain("من");
    expect(words).toContain("علم");
    // «الْحَقَّ» و«الْحَقُّ»: الفرق في الإعراب فقط
    expect(words).not.toContain("الحق");
  });
});
