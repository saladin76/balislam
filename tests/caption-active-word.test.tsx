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
const { CaptionBar } = await import("../src/remotion/scenes/CaptionBar");
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

describe("CaptionBar regression: word gaps do not snap back to the first chunk", () => {
  // ١٢ كلمة بفجوة ٣ إطارات بين كل كلمتين؛ الدفعة الافتراضية أقل من ١٢ كلمة
  const words = Array.from({ length: 12 }, (_, i) => w(`w${i}`, 10 + i * 10, 17 + i * 10));
  const render = (frame: number, variant?: "pill" | "paper") => {
    currentFrame = frame;
    return renderToStaticMarkup(<CaptionBar theme={masterTheme} timings={words} portrait={false} variant={variant} />);
  };

  for (const variant of ["pill", "paper"] as const) {
    it(`${variant}: a gap between words keeps the current chunk on screen`, () => {
      const lastWordFrame = render(words[11]!.start + 1, variant);
      expect(lastWordFrame).toContain("w11");
      expect(lastWordFrame).not.toContain(">w0<");
      // الفجوة بين w10 وw11 (إطار 118): كان يعرض الدفعة الأولى (w0…)
      const gap = render(words[10]!.end + 1, variant);
      expect(gap).toContain("w10");
      expect(gap).not.toContain(">w0<");
      expect(gap).toBe(render(words[10]!.start + 1, variant));
    });
  }

  it("still hides the bar before the first word", () => {
    expect(render(5)).toBe("");
  });
});
