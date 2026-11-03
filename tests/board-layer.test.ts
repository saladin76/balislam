import { describe, expect, it } from "vitest";
import { cameraAt, findWord, mentionsOf, spokenWords, supportsOf } from "../src/remotion/scenes/boardLayer";
import { estimateTimings } from "../src/remotion/scenes/timing";
import { defaultsFor } from "../src/plan/generate";
import { drawAllowed } from "../src/channel/library";

const words = (text: string) => spokenWords(estimateTimings(text, 0, 300));
const secular = drawAllowed({ id: "test-secular", rules: { faces: false, quran: false, hadith: false } });

describe("طبقة الحركة الثانية للسبورة", () => {
  it("تجد الكلمة المكتوبة لحظة نطقها ولو بواو العطف أو أل", () => {
    const w = words("والخوف من الفشل يجعلنا نؤجل");
    expect(findWord(w, "الخوف")?.i).toBe(0);
    expect(findWord(w, "فشل")?.i).toBe(2);
  });

  it("الرسمات المساندة من قائمة المعاني المراجَعة فقط، بلا تكرار وفي مكتبة القناة", () => {
    const w = words("الفكرة هنا بسيطة. لا تبحث عن قرار كبير يغير حياتك في يوم واحد.");
    const sup = supportsOf(w, [{ from: 0, to: w.length }], [{ draw: "head-idea", shownAt: 0, labelWord: 0 }], secular, 3);
    expect(sup.map((s) => s.draw)).toEqual(["path-fork"]);
    // لا رمز ديني لقناة لا تستشهد بالقرآن والحديث (مكتبة القناة تُحترم)
    const dua = words("نختم بالدعاء");
    expect(supportsOf(dua, [{ from: 0, to: dua.length }], [{ draw: "", shownAt: 0 }], secular)).toEqual([]);
  });

  it("تحويط الرسمة عند ذكر معناها مرة أخرى بعد ظهورها، لا عند كلمتها المكتوبة", () => {
    const w = words("القرار صعب. ثم يأتي قرار آخر بعد قليل");
    const m = mentionsOf(w, [{ draw: "path-fork", shownAt: 0, labelWord: 0 }]);
    expect(m).toHaveLength(1);
    expect(m[0]!.start).toBe(w[4]!.start);
  });

  it("الكاميرا تنتقل من مفتاح إلى مفتاح", () => {
    const keys = [
      { x: 0, y: 0, z: 1, at: 0, dur: 0 },
      { x: 100, y: 50, z: 1.5, at: 10, dur: 10 },
    ];
    expect(cameraAt(keys, 5)).toEqual({ x: 0, y: 0, z: 1 });
    expect(cameraAt(keys, 25)).toEqual({ x: 100, y: 50, z: 1.5 });
  });

  it("السبورة المرسومة تأخذ رسمتها ونقاطها من التعليق، وعند الشك لا تُرسم", () => {
    const d = defaultsFor("sketch-board", "الفكرة هنا بسيطة وواضحة جدا. ابحث عن خطوة صغيرة تستطيعها الآن.", { title: "", chapterTitle: "البداية", allow: secular });
    expect(d.element).toBe("head-idea");
    expect(d.items!.split("\n")).toEqual(["الفكرة", "خطوة"]);
    const none = defaultsFor("sketch-board", "هذا كلام عام جدا بلا معنى مرسوم.", { title: "", chapterTitle: "البداية", allow: secular });
    expect(none.element).toBe("");
  });
});
