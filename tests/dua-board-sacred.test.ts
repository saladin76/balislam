import { describe, expect, it } from "vitest";
import { askWordTimes, parseBoardCues } from "../src/remotion/scenes/DuaBoard";
import { estimateTimings } from "../src/remotion/scenes/timing";

describe("لوح الدعاء: السكون عند ذكر الله، والمطلب يُكتب بكلماته", () => {
  it("كلمة الشرح التالية لذكر الله تظهر بعد نافذة الذكر لا داخلها", () => {
    const t = estimateTimings("أي أن نسأل الله البصيرة التي تعيننا", 6, 200);
    const allah = t[3]!;
    const [c] = parseBoardCues("note1:البصيرة | البصيرة", t, 200);
    expect(c!.at).toBeGreaterThanOrEqual(allah.end + 8);
    expect(c!.at).toBeLessThan(t[4]!.end);
  });
  it("قراءة الدعاء نفسه لا تتأخر عن «اللهم»", () => {
    const t = estimateTimings("«اللهم أرنا الحق حقًّا»", 6, 120);
    expect(parseBoardCues("dua | اللهم", t, 120)[0]!.at).toBe(t[0]!.start);
  });
  it("حدث بعيد عن ذكر الله لا يتغير", () => {
    const t = estimateTimings("أولها أن نرى الحق حقًّا.", 6, 100);
    expect(parseBoardCues("ask1 | نرى", t, 100)[0]!.at).toBe(t[2]!.start);
  });
  it("المطلب المنطوق نصه يُكتب كلمة كلمة لحظة نطقها", () => {
    const t = estimateTimings("أولها أن نرى الحق حقًّا.", 6, 100);
    expect(askWordTimes("أن نرى الحق حقًّا", t[2]!.start, t)).toEqual([t[1]!.start, t[2]!.start, t[3]!.start, t[4]!.start]);
  });
  it("المطلب الذي لا يُنطق نصه يظهر كاملًا لحظة إشارته", () => {
    const t = estimateTimings("وثانيها أن يرزقنا الله اتباعه.", 6, 100);
    expect(askWordTimes("أن نتّبعه", 70, t)).toEqual([70, 70]);
  });
});
