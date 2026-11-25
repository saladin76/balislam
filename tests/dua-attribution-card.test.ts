import { describe, expect, it } from "vitest";
import { duaAttributionItem } from "../src/studio/quality/card";
import type { Plan } from "../src/plan/types";

// D225: في الاستوديو، النسبة النبوية على لوحة الدعاء تحتاج الحديث «موثّقًا» في review.json، وإلا ✗ يمنع النسخة النهائية
const plan = (source: string) => ({ title: "t", chapters: [{ title: "c", scenes: [{ id: "c1-s1", template: "dua-board", narration: "", props: { source } }] }] }) as unknown as Plan;

describe("بطاقة الجودة: نسبة الدعاء إلى النبي ﷺ (D225)", () => {
  it("لوحة فيها ﷺ وحديثها غير موثّق في سجل التوثيق: ✗", () => {
    expect(duaAttributionItem(plan("صحيح مسلم ٧٧٠ · من دعائه ﷺ"), { total: 1, open: 1, hadiths: [{ ref: "صحيح مسلم 770", status: "pending" }] })?.status).toBe("fail");
    expect(duaAttributionItem(plan("صحيح مسلم ٧٧٠ · من دعائه ﷺ"), undefined)?.status).toBe("fail");
  });
  it("حديث موثّق يذكره المصدر: ✓", () => {
    expect(duaAttributionItem(plan("صحيح مسلم ٧٧٠ · من دعائه ﷺ"), { total: 1, open: 0, hadiths: [{ ref: "صحيح مسلم 770", status: "verified" }] })?.status).toBe("pass");
  });
  it("لوحة بلا نسبة نبوية: لا بند", () => {
    expect(duaAttributionItem(plan("من الأدعية المأثورة"), undefined)).toBeNull();
  });
});
