import { describe, expect, it } from "vitest";
import { eventArrivals } from "../src/remotion/scenes/Timeline";

const words = (text: string, step = 15) => text.split(/\s+/).map((word, i) => ({ word, start: i * step, end: i * step + step - 2 }));

describe("الخط الزمني يتبع الكلام", () => {
  it("كل حدث يظهر وقت نطق كلمته، بالترتيب", () => {
    const t = words("تأسست بغداد سنة سبعمئة واثنتين وستين، وسقطت سنة ألف ومئتين وثمان وخمسين، وفُتحت القسطنطينية سنة ألف وأربعمئة");
    const a = eventArrivals([{ date: "762م", text: "تأسيس مدينة بغداد" }, { date: "1258م", text: "سقوط بغداد على يد المغول" }, { date: "1453م", text: "فتح القسطنطينية" }], t, 0, 400);
    expect(a[0]).toBe(15); // «بغداد»
    expect(a[1]).toBeGreaterThan(a[0]!); // «بغداد» الثانية أو ما بعدها، لا الأولى
    expect(a[2]).toBe(t.find((w) => w.word === "القسطنطينية")!.start);
  });

  it("الحدث الذي لا يُنطق يأخذ موضعًا بين جاريه ولا يسبقهما", () => {
    const t = words("ونتأمل الحروب ثم شيئًا آخر طويلًا جدًا ثم التحولات الكبرى");
    const a = eventArrivals([{ date: "", text: "الحروب" }, { date: "", text: "حدث غير منطوق" }, { date: "", text: "التحولات" }], t, 0, 300);
    expect(a[0]).toBe(15);
    expect(a[1]).toBeGreaterThan(a[0]!);
    expect(a[2]).toBeGreaterThan(a[1]!);
  });
});
