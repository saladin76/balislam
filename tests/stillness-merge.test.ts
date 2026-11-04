import { describe, expect, it } from "vitest";
import { exemptSeconds, mergeSpans } from "../src/render/stillness";

describe("السكون المقصود: الفترات المتداخلة لا تُحسب مرتين", () => {
  it("فترتان متداخلتان تغطيان ربع الثانية لا تُعفيان الثانية", () => {
    // كل فترة 0.3 ث، وتتداخلان في 0.2 ث: التغطية الحقيقية 0.4 ث (أقل من النصف)، والجمع الساذج 0.6
    const spans = [{ from: 5.1, to: 5.4, why: "ذكر الله" }, { from: 5.2, to: 5.5, why: "ذكر الله" }];
    expect(mergeSpans(spans)).toEqual([{ from: 5.1, to: 5.5, why: "ذكر الله" }]);
    expect(exemptSeconds(spans, 10).has(5)).toBe(false);
  });
  it("ذكر داخل مشهد آية يُدمج معه ولا يضاعف الإعفاء", () => {
    const spans = [{ from: 10, to: 16, why: "آية" }, { from: 12, to: 12.6, why: "ذكر الله" }];
    const merged = mergeSpans(spans);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ from: 10, to: 16 });
    expect([...exemptSeconds(spans, 20)].sort((a, b) => a - b)).toEqual([10, 11, 12, 13, 14, 15]);
  });
  it("الفترات المتباعدة تبقى منفصلة", () => {
    const spans = [{ from: 1, to: 2, why: "آية" }, { from: 4, to: 4.6, why: "ذكر الله" }];
    expect(mergeSpans(spans)).toHaveLength(2);
    expect([...exemptSeconds(spans, 6)].sort()).toEqual([1, 4]);
  });
});
