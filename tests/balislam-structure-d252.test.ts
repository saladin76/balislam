import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseScript } from "../src/script/parse";
import { templateFor } from "../src/script/episodes";

/**
 * D252 (قرار المالك ٢٨ نوفمبر): بنية «بالإسلام» الجديدة، ورفع تجميدها.
 * - قالب السكريبت بالبنية الثابتة الست بترتيبها، والنوعان («مشكلة» و«مفهوم») ونوع الحلقة في الترويسة؛
 *   ولا صيغة استشهاد أو قول حرفية في الإرشادات (فلا تُقرأ آية أو قول إن بقيت الإرشادات في سكريبت).
 * - القناة غير مجمّدة ولا موقوفة تحريريًا (البوابات الأخرى في اختباراتها: D234 وD228).
 * - CLAUDE.md وجدول القرارات يذكران البنية، وD235 ملغى بها.
 */
const root = path.resolve(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

describe("D252: قالب سكريبت «بالإسلام» بالبنية الثابتة", () => {
  const file = templateFor("balislam", "script.md")!;
  const text = readFileSync(file, "utf8");
  const filled = text.replace("{{TITLE}}", "عنوان").replace("{{DOMAIN}}", "psychology").replace("{{EPISODE}}", "014");

  it("الفقرات الست بترتيبها: الخطاف أول ١٥ ث ← السؤال ← الدليل على الشاشة ← الشرح بالأمثلة ← خطوة واحدة ← سؤال التعليقات", () => {
    const steps = ["١. الخطاف (أول ١٥ ثانية)", "٢. السؤال", "٣. الدليل على الشاشة", "٤. الشرح بالأمثلة", "٥. خطوة عملية واحدة", "٦. سؤال للتعليقات"];
    const at = steps.map((s) => text.indexOf(s));
    expect(at.every((i) => i >= 0), String(at)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    const narr = parseScript(filled).chapters[0]!.blocks.filter((b) => b.kind === "narration");
    expect(narr.length).toBe(6); // كل فقرة مشهد، والتعليق (<!-- -->) لا يُقرأ
  });

  it("النوعان، ونوع الحلقة في الترويسة، والراوي لا ينطق الآية", () => {
    expect(text).toMatch(/«مشكلة»: موقف من الحياة ← السؤال ← الدليل ← الفهم ← خطوة عملية واحدة/);
    expect(text).toMatch(/«مفهوم»: فكرة يخطئ فيها الناس ← معناها الصحيح بالدليل ← مثال من الحياة/);
    const parsed = parseScript(filled);
    expect(parsed.frontmatter?.type).toBe("مشكلة");
    expect(parsed.parseIssues.filter((i) => i.level === "error")).toEqual([]);
    expect(text).toContain("لا يقرأ الآية ولا يسكت لقراءتها");
  });

  it("لا صيغة آية أو حديث أو قول حرفية في القالب", () => {
    expect(text).not.toMatch(/\[(آية|حديث|قول)\s*:/);
    expect(text).not.toMatch(/﴿/);
  });
});

describe("D252: رفع التجميد والتوثيق", () => {
  it("القناة غير مجمّدة ولا موقوفة تحريريًا", () => {
    expect(JSON.parse(read("channels/balislam/stock.json")).frozen).toBeUndefined();
  });

  it("CLAUDE.md يذكر الوعد والنوعين والسلاسل الخمس", () => {
    const line = read("CLAUDE.md").split("\n").find((l) => l.startsWith("- **بالإسلام** (`balislam`)"))!;
    expect(line).toContain("D252");
    for (const w of ["«مشكلة»", "«مفهوم»", "خطاف من الحياة أول ١٥ ث", "سؤال للتعليقات", "النفس والسلوك", "الأسرة والعلاقات", "المال والعمل", "أسئلة العصر", "العبادة الواعية", "بلا ملامح", "لا حديث ضعيف"])
      expect(line, w).toContain(w);
  });

  it("جدول القرارات: D252 سارٍ، وD235 ملغى به، وD211 وD227 ملغيان جزئيًا به", () => {
    const row = (id: string) => read("docs/studio/decisions.md").split("\n").find((l) => l.startsWith(`| ${id} |`))!;
    expect(row("D252")).toMatch(/\| سارٍ \|$/);
    expect(row("D235")).toContain("| أُلغي بـ D252");
    expect(row("D211")).toContain("| أُلغي جزئيًا بـ D252");
    expect(row("D227")).toContain("| أُلغي جزئيًا بـ D252");
  });
});
