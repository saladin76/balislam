import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseScript } from "../src/script/parse";

// صاحب القناة شكّل عناوين سكريبت زبدة الكتب 001 كلها (١٠ نوفمبر): «## الْفَصْلُ 1 · …» و«## الِاسْتِشْهَادَاتِ».
// التشكيل لا يغيّر بنية السكريبت؛ والعنوان يبقى بنصه المشكول.
const base = readFileSync("channels/zubdat-alkutub/episodes/001-awwal-marra-osalli/script.md", "utf8");
const voweled = base
  .replace(/^## الفصل (\d+) · (.*)$/gm, (_m, n, t) => `## الْفَصْلُ ${n} · ${t}ُ`)
  .replace("## الاستشهادات", "## الِاسْتِشْهَادَاتِ")
  .replace("## الخطوة العملية", "## الْخُطْوَةُ الْعَمَلِيَّةُ")
  .replace(/^- آية \|/gm, "- آيَةٌ |");

describe("عناوين مشكولة في السكريبت", () => {
  it("تُقرأ الفصول والاستشهادات والخطوة العملية كما بلا تشكيل", () => {
    const a = parseScript(base);
    const b = parseScript(voweled);
    expect(b.parseIssues.filter((i) => i.code === "heading-unknown")).toEqual([]);
    expect(b.chapters.map((c) => c.number)).toEqual(a.chapters.map((c) => c.number));
    expect(b.chapters.map((c) => c.blocks.length)).toEqual(a.chapters.map((c) => c.blocks.length));
    expect(b.citations.map((c) => c.kind)).toEqual(a.citations.map((c) => c.kind));
    expect(b.practicalStep?.text).toBe(a.practicalStep?.text);
  });
  it("يبقى عنوان الفصل بنصه المشكول", () => {
    const b = parseScript(voweled);
    expect(b.chapters[0]!.title.endsWith("ُ")).toBe(true);
    expect(b.chapters[0]!.title.startsWith("السؤال")).toBe(true);
  });
});

describe("سكريبت المالك المشكول كاملًا (١٠ نوفمبر)", () => {
  it("لا خطأ عناوين، وستة فصول كما في الأصل", () => {
    const owner = base
      .replace(/^## الفصل 1 · .*$/m, "## الْفَصْلُ 1 · السُّؤَالُ الَّذِي لَا يَغِيبُ")
      .replace("## الاستشهادات", "## الِاسْتِشْهَادَاتِ");
    const r = parseScript(owner);
    expect(r.parseIssues.filter((i) => i.level === "error")).toEqual([]);
    expect(r.chapters).toHaveLength(parseScript(base).chapters.length);
    expect(r.chapters[0]!.title).toBe("السُّؤَالُ الَّذِي لَا يَغِيبُ");
  });
});
