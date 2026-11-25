import { describe, expect, it } from "vitest";
import { duaAttributionProblems } from "../src/plan/duaAttribution";

// D225 (قرار المالك ٢٥ نوفمبر): حالات مصطنعة فقط، بلا قراءة محتوى حلقة حقيقية (KI-068)
describe("D225: ﷺ في المصدر لحديث موثّق وحده، والمنع باقٍ في غيره", () => {
  const board = (source: string) => ({ id: "x", template: "dua-board", props: { source } });
  const muslim = [{ ref: "صحيح مسلم 770", status: "verified" as const }];

  it("لوحة فيها ﷺ بلا توثيق تُرفض", () => {
    expect(duaAttributionProblems([board("من دعاء النبي ﷺ")], [], false)).toHaveLength(1);
    expect(duaAttributionProblems([board("من دعاء النبي ﷺ")], [], true)).toHaveLength(1);
    expect(duaAttributionProblems([board("صحيح مسلم ٧٧٠ · من دعائه ﷺ")], [], false)).toHaveLength(1);
  });

  it("حديث آخر غير الذي يذكره المصدر لا يكفي، ولا مصدر بلا رقم", () => {
    expect(duaAttributionProblems([board("صحيح البخاري ٦٣٠٦ · من دعائه ﷺ")], muslim, true)).toHaveLength(1);
    expect(duaAttributionProblems([board("صحيح مسلم · من دعائه ﷺ")], [{ ref: "صحيح مسلم", status: "verified" }], true)).toHaveLength(1);
    expect(duaAttributionProblems([board("رسول الله ﷺ")], muslim, true)).toHaveLength(1);
  });

  it("في الاستوديو: الحديث المذكور لكنه غير موثّق بعد في review.json يُرفض", () => {
    for (const status of ["pending", "changed", "rejected"] as const)
      expect(duaAttributionProblems([board("صحيح مسلم ٧٧٠ · من دعائه ﷺ")], [{ ref: "صحيح مسلم 770", status }], true)).toHaveLength(1);
  });

  it("حديث موثّق يذكره المصدر برقمه يُقبل، ولوحة بلا نسبة نبوية لا تتأثر", () => {
    expect(duaAttributionProblems([board("صحيح مسلم ٧٧٠ · من دعائه ﷺ في قيام الليل")], muslim, true)).toEqual([]);
    expect(duaAttributionProblems([board("من الأدعية المأثورة في كلام أهل العلم")], [], true)).toEqual([]);
  });
});
