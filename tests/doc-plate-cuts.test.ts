import { describe, expect, it } from "vitest";
import { plateCuts } from "../src/remotion/scenes/DocPlate";

const words = (text: string, step = 12) => text.split(/\s+/).map((word, i) => ({ word, start: i * step }));

describe("اللوحة الوثائقية: تبديل اللوحات مع عبارات الكلام", () => {
  it("لوحة واحدة تبدأ من أول المشهد", () => {
    expect(plateCuts(1, words("بغداد مدينة مستديرة"), 200)).toEqual([0]);
  });
  it("تتبدل اللوحة عند أقرب فاصلة أو نقطة لا في منتصف عبارة", () => {
    const t = words("بغداد، في القرن التاسع الميلادي. مدينة مستديرة على ضفاف دجلة، صارت عاصمة الدنيا");
    const cuts = plateCuts(2, t, 300);
    const at = t.findIndex((w) => w.start - 4 === cuts[1]);
    expect(at).toBeGreaterThan(0);
    expect(t[at - 1]!.word).toMatch(/[،.]$/);
  });
  it("ثلاث لوحات بترتيبها وبفاصل كافٍ", () => {
    const cuts = plateCuts(3, words("أ ب ت ث ج ح خ د ذ ر ز س ش ص ض"), 300);
    expect(cuts).toHaveLength(3);
    expect(cuts[1]!).toBeGreaterThan(cuts[0]!);
    expect(cuts[2]!).toBeGreaterThan(cuts[1]!);
  });
});
