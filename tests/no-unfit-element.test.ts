import { describe, expect, it } from "vitest";
import { beatFor, beatsFor, needsElement } from "../src/plan/beats";

describe("لا عنصر غير مناسب من المكتبة", () => {
  it("الجملة التي لا يطابق معناها عنصرًا تبقى بلا رسمة (لا مصباح عام ولا مطابقة وسوم)", () => {
    const b = beatFor("بالطبع يتطلب الأمر وقتًا طويلًا.");
    expect(b.draw).toBe("");
    expect(needsElement(b)).toBe(true);
  });
  it("السؤال يأخذ علامة السؤال لأنها معناه", () => {
    expect(beatFor("أين يتطلب الأمر وقتًا طويلًا؟").draw).toBe("question-mark");
  });
  it("لا يظهر المصباح إلا لمعناه", () => {
    for (const b of beatsFor("بالطبع يتطلب الأمر وقتًا. وتستمر المحاولة بلا توقف. ثم ننتهي من العمل.", 3)) expect(b.draw).not.toBe("lightbulb");
  });
});
