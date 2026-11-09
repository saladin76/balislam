import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseScript } from "../src/script/parse";
import { templateFor } from "../src/script/episodes";

describe("قالب سكريبت لكل قناة", () => {
  for (const ch of ["balislam", "dafatir-alzaman", "zubdat-alkutub"]) {
    it(ch, () => {
      const file = templateFor(ch, "script.md")!;
      expect(file).toContain(`/templates/${ch}/`);
      const s = parseScript(readFileSync(file, "utf8").replace("{{TITLE}}", "عنوان").replace("{{DOMAIN}}", "x").replace("{{EPISODE}}", "001"));
      expect(s.parseIssues.filter((i) => i.level === "error")).toEqual([]);
      expect(s.chapters).toHaveLength(6);
      expect(s.hasCitationsSection).toBe(true);
      expect(templateFor(ch, "research.md", false)).toBeTruthy();
    });
  }
  it("القوالب مختلفة: «بعين الإسلام» لبالإسلام وحدها", () => {
    const t = (ch: string) => readFileSync(templateFor(ch, "script.md")!, "utf8");
    expect(t("balislam")).toContain("بعين الإسلام");
    expect(t("dafatir-alzaman")).not.toContain("بعين الإسلام");
    expect(t("zubdat-alkutub")).not.toContain("بعين الإسلام");
  });
  it("قناة بلا قالب تأخذ القالب المحايد، لا قالب «بالإسلام» ولا غيره", () => {
    const file = templateFor("new-channel", "script.md")!;
    expect(file).toContain("/templates/_neutral/");
    const text = readFileSync(file, "utf8");
    for (const own of ["بعين الإسلام", "[آية", "[حديث", "الدرس"]) expect(text).not.toContain(own);
    const s = parseScript(text.replace("{{TITLE}}", "عنوان").replace("{{DOMAIN}}", "x").replace("{{EPISODE}}", "001"));
    expect(s.parseIssues.filter((i) => i.level === "error")).toEqual([]);
    expect(s.chapters).toHaveLength(6);
    expect(s.hasCitationsSection).toBe(true);
    expect(templateFor("new-channel", "research.md")).toContain("/templates/_neutral/");
    expect(templateFor("new-channel", "research.md", false)).toBeNull();
  });
});
