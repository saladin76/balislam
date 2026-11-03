import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseScript } from "../src/script/parse";
import { templateFor } from "../src/script/episodes";

describe("قالب سكريبت لكل قناة", () => {
  for (const ch of ["balislam", "dafatir-alzaman", "zubdat-alkutub"]) {
    it(ch, () => {
      const file = templateFor(ch, "script.md");
      expect(file).toContain(`/templates/${ch}/`);
      const s = parseScript(readFileSync(file, "utf8").replace("{{TITLE}}", "عنوان").replace("{{DOMAIN}}", "x").replace("{{EPISODE}}", "001"));
      expect(s.parseIssues.filter((i) => i.level === "error")).toEqual([]);
      expect(s.chapters).toHaveLength(6);
      expect(s.hasCitationsSection).toBe(true);
      expect(templateFor(ch, "research.md", false)).toBeTruthy();
    });
  }
  it("القوالب مختلفة: «بعين الإسلام» لبالإسلام وحدها", () => {
    const t = (ch: string) => readFileSync(templateFor(ch, "script.md"), "utf8");
    expect(t("balislam")).toContain("بعين الإسلام");
    expect(t("dafatir-alzaman")).not.toContain("بعين الإسلام");
    expect(t("zubdat-alkutub")).not.toContain("بعين الإسلام");
  });
});
