import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// الإطار الحالي يُضبط من كل اختبار
let currentFrame = 0;
vi.mock("remotion", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, useCurrentFrame: () => currentFrame };
});

const { activeWordIndex } = await import("../src/remotion/scenes/timing");
const { CaptionBar, captionLines, CAPTION_MAX_WORDS } = await import("../src/remotion/scenes/CaptionBar");
const { masterTheme } = await import("../brand/themes");

const w = (word: string, start: number, end: number) => ({ word, start, end });

describe("activeWordIndex", () => {
  // كلمات بينها فجوات قصيرة (كما يأتي التوقيت الحقيقي من الصوت)
  const t = [w("a", 10, 20), w("b", 24, 30), w("c", 30, 40), w("d", 45, 50)];

  it("returns -1 before the first word and for empty timings", () => {
    expect(activeWordIndex(t, 0)).toBe(-1);
    expect(activeWordIndex(t, 9)).toBe(-1);
    expect(activeWordIndex([], 100)).toBe(-1);
  });

  it("keeps the previous word inside a gap instead of snapping to the first", () => {
    expect(activeWordIndex(t, 20)).toBe(0);
    expect(activeWordIndex(t, 23)).toBe(0);
    expect(activeWordIndex(t, 42)).toBe(2);
    expect(activeWordIndex(t, 44)).toBe(2);
  });

  it("handles exact boundaries (start inclusive, adjacent words)", () => {
    expect(activeWordIndex(t, 10)).toBe(0);
    expect(activeWordIndex(t, 19)).toBe(0);
    expect(activeWordIndex(t, 24)).toBe(1);
    expect(activeWordIndex(t, 29)).toBe(1);
    expect(activeWordIndex(t, 30)).toBe(2); // b.end === c.start
    expect(activeWordIndex(t, 45)).toBe(3);
  });

  it("stays on the last word after the last end", () => {
    expect(activeWordIndex(t, 50)).toBe(3);
    expect(activeWordIndex(t, 500)).toBe(3);
  });

  it("works with a single word", () => {
    const one = [w("x", 5, 15)];
    expect(activeWordIndex(one, 4)).toBe(-1);
    expect(activeWordIndex(one, 5)).toBe(0);
    expect(activeWordIndex(one, 15)).toBe(0);
    expect(activeWordIndex(one, 99)).toBe(0);
  });
});

describe("الترجمة الهادئة (قرار المالك ٢٢ نوفمبر): سطر ثابت بلا قفز ولا تلوين", () => {
  // ١٢ كلمة بفجوة ٣ إطارات بين كل كلمتين، والجملة الأولى تنتهي بنقطة عند w4
  const words = Array.from({ length: 12 }, (_, i) => w(i === 4 ? "w4." : `w${i}`, 10 + i * 10, 17 + i * 10));
  const render = (frame: number, variant?: "pill" | "paper" | "cinema" | "dusk") => {
    currentFrame = frame;
    return renderToStaticMarkup(<CaptionBar theme={masterTheme} timings={words} portrait={false} variant={variant} />);
  };

  it("الأسطر تُقطع بعد علامة الوقف أو عند الحد، متقاربة الطول، بلا كلمة يتيمة", () => {
    expect(captionLines(words.map((x) => x.word), CAPTION_MAX_WORDS.landscape)).toEqual([[0, 1, 2, 3, 4], [5, 6, 7, 8, 9, 10, 11]]);
    expect(captionLines(Array.from({ length: 11 }, (_, i) => `k${i}`), 10).map((l) => l.length)).toEqual([6, 5]);
    expect(captionLines(["أ،", "ب", "ج."], 6)).toEqual([[0], [1, 2]]);
  });

  for (const variant of ["pill", "paper", "cinema", "dusk"] as const) {
    it(`${variant}: السطر كله بلون واحد بلا كلمة مميزة، ولا يتغير داخل السطر ولا في الفجوات`, () => {
      const a = render(words[6]!.start + 6, variant), b = render(words[9]!.end + 1, variant);
      expect(a).toBe(b);
      expect(a).toContain("w5 w6 w7 w8 w9 w10 w11");
      expect(a).not.toContain("w4");
      // لا span لكل كلمة، ولا خلفية للكلمة الجارية
      expect(a).not.toMatch(/<span/);
    });
  }

  it("السطر الجديد يظهر بتلاشٍ قصير لا قفزًا", () => {
    expect(render(words[5]!.start)).toMatch(/opacity:0\.25/);
    expect(render(words[5]!.start + 10)).toMatch(/opacity:1/);
  });

  it("بلا مستطيل خلف الترجمة (قرار المالك ٢٢ نوفمبر): خلفية شفافة ونص بظل خفيف في الأشكال الأربعة", () => {
    for (const v of ["pill", "paper", "cinema", "dusk"] as const) {
      const html = render(words[6]!.start + 6, v);
      expect(html, v).toContain("background:transparent");
      expect(html, v).toMatch(/text-shadow:(0 1px 2px rgba|1\.5px 0px 0 rgba)/);
      // تكملة D192 (خطاف «دفاتر الزمن 001»): النص الفاتح بحدّ داكن رفيع من ثمانية ظلال، فيُقرأ على ورق الدفتر الفاتح
      if (v !== "paper") expect((html.match(/px 0 rgba\(0,0,0,0\.8\)/g) ?? []).length, v).toBeGreaterThanOrEqual(8);
      expect(html, v).not.toMatch(/border-radius/);
    }
  });

  it("لا ترجمة قبل أول كلمة", () => {
    expect(render(5)).toBe("");
  });
});
