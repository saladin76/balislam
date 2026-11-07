import { describe, expect, it } from "vitest";
import { alignDiff, ayahEndNumbers, classifyChar, comparisonAuditStatus } from "../src/quran/audit";

describe("تدقيق نص بطاقات الآيات", () => {
  it("never calls a prelive or unidentified Quran source an official match", () => {
    expect(comparisonAuditStatus(false, true, "production")).toBe("match");
    expect(comparisonAuditStatus(false, true, "prelive")).toBe("pending");
    expect(comparisonAuditStatus(false, true, undefined)).toBe("pending");
    expect(comparisonAuditStatus(true, true, "production")).toBe("differs");
    expect(comparisonAuditStatus(false, false, "production")).toBe("differs");
  });

  it("يصنّف الحروف والتشكيل والرسم العثماني والعلامات", () => {
    expect(classifyChar("ق")).toBe("letter");
    expect(classifyChar("َ")).toBe("haraka");
    expect(classifyChar("ۡ")).toBe("uthmani"); // السكون العثماني
    expect(classifyChar("ٱ")).toBe("uthmani"); // ألف الوصل
    expect(classifyChar("۝")).toBe("mark"); // نهاية الآية
    expect(classifyChar("ۗ")).toBe("mark"); // علامة وقف
  });
  it("لا يعد اختلاف الترميز فرقًا، ولا يحذف التشكيل لإخفاء الفروق", () => {
    expect(alignDiff("إِنَّ", "إِنَّ")).toEqual([]);
    const d = alignDiff("قَدۡ", "قَدْ");
    expect(d).toHaveLength(1);
    expect(d[0]!.op).toBe("sub");
  });
  it("المحاذاة لا تسلسل الفروق بعد إضافة رمز واحد", () => {
    const d = alignDiff("قَدۡ أَفۡلَحَ", "قَدۡ أَفۡلَحَ ٱلۡ");
    expect(d.every((o) => o.op === "ins")).toBe(true);
    expect(d).toHaveLength(4);
  });
  it("يقرأ أرقام نهايات الآيات", () => {
    expect(ayahEndNumbers("قَدۡ أَفۡلَحَ ٱلۡمُؤۡمِنُونَ ۝١ ٱلَّذِينَ ۝٢")).toEqual([1, 2]);
  });
});
