import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fullImagePrompt, midjourneyPrompt } from "../src/visual/prompts";
import { usedImages } from "../src/plan/collect";
import { planIssues } from "../src/plan/validate";
import { defaultsFor } from "../src/plan/generate";
import type { Plan } from "../src/plan/types";

const planWith = (image: string): Plan =>
  ({ title: "t", themeId: "night", chapters: [{ number: 1, title: "c", scenes: [{ id: "c1-s1", template: "doc-plate", narration: "", props: { ...defaultsFor("doc-plate", "", { title: "t", chapterTitle: "c" }), image }, sfx: [] }] }] }) as unknown as Plan;

describe("لوحة وثائقية", () => {
  it("يضيف أسلوب القناة وقاعدة الوجوه لوصف المشهد", () => {
    const p = fullImagePrompt({ channel: "dafatir-alzaman", prompt: "Baghdad at dawn." });
    expect(p.startsWith("Baghdad at dawn,")).toBe(true);
    expect(p).toContain("faces not visible");
    expect(p).toContain("no text");
  });
  it("الأرشيف بلا قاعدة الوجوه، والوصف الفارغ لا يولّد أمرًا", () => {
    expect(fullImagePrompt({ channel: "dafatir-alzaman", prompt: "a map", look: "archive" })).not.toContain("faces not visible");
    expect(fullImagePrompt({ channel: "dafatir-alzaman", prompt: "  " })).toBe("");
  });
  it("أمر Midjourney بنسبة الأبعاد الصحيحة", () => {
    expect(midjourneyPrompt({ channel: "dafatir-alzaman", prompt: "x" })).toContain("--ar 16:9");
    expect(midjourneyPrompt({ channel: "dafatir-alzaman", prompt: "x", orientation: "portrait" })).toContain("--ar 9:16");
  });
  it("يجمع الصور المستعملة الموجودة فقط", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "img-"));
    writeFileSync(path.join(dir, "a.jpg"), "x");
    expect(usedImages(planWith("a.jpg"), dir)).toEqual(["a.jpg"]);
    expect(usedImages(planWith("b.jpg"), dir)).toEqual([]);
  });
  it("لوحة بلا صورة خطأ يمنع النسخة النهائية", () => {
    expect(planIssues(planWith("")).some((i) => i.level === "error")).toBe(true);
    expect(planIssues(planWith("a.jpg")).some((i) => i.sceneId === "c1-s1")).toBe(false);
  });
});
