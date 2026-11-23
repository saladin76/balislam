/** ملاحظة العربي (قرار المالك ٢٣ نوفمبر): «لم يُصِرَّ» بالتشكيل على الشاشة وحدها، والصوت والتوقيت كما هما. */
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { captionSpelled } from "../src/remotion/scenes/CaptionBar";

describe("إملاء الترجمة للمشهد (captionSpell)", () => {
  it("يضيف التشكيل للكلمة نفسها", () => {
    expect(captionSpelled("يصر", { يصر: "يُصِرَّ" })).toBe("يُصِرَّ");
    expect(captionSpelled("معصيته", { يصر: "يُصِرَّ" })).toBe("معصيته");
    expect(captionSpelled("يصر")).toBe("يصر");
  });
  it("لا يغيّر حرفًا ولا كلمة: إملاء بحروف أخرى يُهمل", () => {
    expect(captionSpelled("يصر", { يصر: "يُصِرُّونَ" })).toBe("يصر");
    expect(captionSpelled("يصر", { يصر: "يصبر" })).toBe("يصر");
  });
  it("الحلقة توفّر إملاء كل مشهد لترجمته", async () => {
    const code = await readFile(path.join(import.meta.dirname, "..", "src/remotion/scenes/Episode.tsx"), "utf8");
    expect(code).toContain("CaptionSpellContext.Provider value={sc.captionSpell}");
  });
});
