import { describe, expect, it } from "vitest";
import { cleanAutoFraming, framingClean, type EdgeContext } from "../src/remotion/illus/edgeSafety";

/** لا شخص مقصوص عند حافة الإطار في الكاميرا التلقائية (قرار صاحب المشروع، ٩ نوفمبر). */
const hero = { lo: 1100, hi: 1220 };
const companion = { lo: 760, hi: 900 };

describe("تصحيح تأطير اللقطة التلقائية", () => {
  it("لقطة سليمة لا تتغير", () => {
    const c: EdgeContext = { focusX: 1160, view: [0, 1920], required: [hero], optional: [companion] };
    expect(cleanAutoFraming({ z: 1.08, dx: 0 }, c)).toEqual({ z: 1.08, dx: 0 });
  });

  it("الرفيق نصفه عند الحافة: يُزاح الإطار حتى يدخل كله أو يخرج كله، والبطل داخل دائمًا", () => {
    const c: EdgeContext = { focusX: 1160, view: [691, 1299], required: [hero], optional: [companion], margin: 24 };
    const bad = { z: 1.24, dx: 140 };
    expect(framingClean(bad, c)).toBe(false);
    const fixed = cleanAutoFraming(bad, c);
    expect(framingClean(fixed, c)).toBe(true);
  });

  it("لا يتسع الاثنان بالتكبير المطلوب: يُخفَّف التكبير حتى لقطة الاثنين", () => {
    const c: EdgeContext = { focusX: 1160, view: [691, 1299], required: [hero], optional: [{ lo: 780, hi: 900 }], margin: 24, maxShift: 10 };
    const fixed = cleanAutoFraming({ z: 1.6, dx: 0 }, c);
    expect(framingClean(fixed, c)).toBe(true);
    expect(fixed.z).toBeLessThan(1.6);
  });
});

describe("طرف العالم", () => {
  it("اللقطة الافتتاحية الواسعة لا تُظهر ما وراء طرف المكان", () => {
    const c: EdgeContext = { focusX: 1060, view: [0, 1920], required: [{ lo: 1000, hi: 1120 }], optional: [], layers: [0.6, 0.9].map((depth) => ({ depth, lo: -200, hi: 2120 })) };
    const bad = { z: 0.96, dx: -240 };
    expect(framingClean(bad, c)).toBe(false);
    const fixed = cleanAutoFraming(bad, c);
    expect(framingClean(fixed, c)).toBe(true);
  });
});
