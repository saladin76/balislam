import { describe, expect, it } from "vitest";
import { compareVerseText } from "../src/quran/compare";

describe("مقابلة نص الآية بالنص المعتمد", () => {
  it("لا يعد اختلاف ترميز الهمزة وترتيب الشدة والفتحة فرقًا", () => {
    const composed = "إِنَّ"; // إِنَّ بهمزة مركبة، وشدة قبل الفتحة
    const decomposed = "إِنَّ"; // ألف + همزة سفلية، وفتحة قبل الشدة
    expect(compareVerseText(composed, decomposed)).toEqual([]);
  });
  it("يعد الحركة المختلفة فرقًا ويعرضها برموز يونيكود", () => {
    const d = compareVerseText("قَدْ", "قَدَ");
    expect(d).toHaveLength(1);
    expect(d[0]!.approved).toContain("U+064E");
  });
});
