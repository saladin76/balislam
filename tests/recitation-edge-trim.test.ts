import { describe, expect, it } from "vitest";
import { edgeSilence } from "../src/quran/recitationPolish";

/** قص صمت الطرفين في تسجيل الهاتف (تسجيلات صاحب القناة، ٩ نوفمبر). */
const sr = 16000;
const build = (parts: { sec: number; amp: number }[]) => {
  const n = parts.reduce((s, p) => s + Math.round(p.sec * sr), 0);
  const out = new Float32Array(n);
  let i = 0;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (const p of parts) for (let k = 0; k < Math.round(p.sec * sr); k++) out[i++] = p.amp * rnd();
  return out;
};

describe("قص صمت الطرفين", () => {
  it("أصفار رقمية في آخر الملف لا تُحسب أرضية، فيُقص صمت الغرفة", () => {
    const s = build([{ sec: 0.6, amp: 0.002 }, { sec: 2, amp: 0.2 }, { sec: 1.2, amp: 0.002 }, { sec: 0.05, amp: 0 }]);
    const t = edgeSilence(s, sr);
    expect(t.trimmedHead).toBeGreaterThan(0.3);
    expect(t.trimmedTail).toBeGreaterThan(0.6);
    expect(t.start).toBeLessThan(0.6);
    expect(t.end).toBeGreaterThan(2.6);
  });

  it("نقرة منفردة (10 مللي ثانية) بعد الصمت لا تمنع القص", () => {
    const s = build([{ sec: 0.5, amp: 0.002 }, { sec: 2, amp: 0.2 }, { sec: 0.8, amp: 0.002 }, { sec: 0.01, amp: 0.05 }, { sec: 0.4, amp: 0.002 }]);
    const t = edgeSilence(s, sr);
    expect(t.end).toBeLessThan(3.0);
    expect(t.end).toBeGreaterThan(2.5);
  });
});
