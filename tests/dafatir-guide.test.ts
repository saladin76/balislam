import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { readGuideIndex, readGuidePage } from "../src/channel/guide";
import { LIB_META } from "../src/remotion/dafatir/lib/meta";
import { parseMarkdown } from "../app/src/ui/Markdown";
// @ts-expect-error سكريبت mjs بلا أنواع
import { docsSyncProblems } from "../scripts/docs-sync.mjs";

/**
 * «دليل الاستوديو» لدفاتر الزمن (الأمر 016): المرجع الدائم كامل، مترابط، يُقرأ من الاستوديو،
 * ويغطي كل ما في المكتبة، ولا يحمل أسرارًا؛ وقاعدة تزامن التوثيق تعمل.
 */
const DIR = "docs/dafatir-alzaman";

describe("دليل دفاتر الزمن", () => {
  it("الفهرس يذكر كل صفحة في المجلد، وكل صفحة في الفهرس موجودة", async () => {
    const idx = (await readGuideIndex("dafatir-alzaman"))!;
    expect(idx.title).toBe("الدليل التشغيلي والإنتاجي الدائم — استوديو دفاتر الزمن");
    const listed = idx.entries.filter((e) => !e.shared).map((e) => e.file).sort();
    const onDisk = readdirSync(DIR).filter((f) => f.endsWith(".md")).sort();
    expect(listed).toEqual(onDisk);
    for (const s of ["00-start-here.md", "01-identity.md", "02-production.md", "03-tools.md", "04-technical.md", "05-content-rules.md", "06-quality.md", "07-decisions.md"]) expect(listed).toContain(s);
  });

  it("الاستوديو يقرأ كل صفحة، ويرفض ما ليس في الفهرس", async () => {
    const idx = (await readGuideIndex("dafatir-alzaman"))!;
    for (const e of idx.entries) expect((await readGuidePage("dafatir-alzaman", e.file))?.length, e.file).toBeGreaterThan(200);
    expect(await readGuidePage("dafatir-alzaman", "../../.env")).toBeNull();
    expect(await readGuidePage("dafatir-alzaman", "../../CLAUDE.md")).toBeNull();
    expect(await readGuideIndex("../balislam")).toBeNull();
    // لكل قناة دليلها المستقل (بالإسلام: tests/balislam-reference.test.ts، زبدة الكتب: tests/zubdat-reference.test.ts)
    expect((await readGuideIndex("balislam"))?.channel).toBe("balislam");
  });

  it("الروابط بين الصفحات ومسارات المشروع المذكورة موجودة", () => {
    const bad: string[] = [];
    for (const f of readdirSync(DIR).filter((x) => x.endsWith(".md"))) {
      const src = readFileSync(path.join(DIR, f), "utf8");
      for (const m of src.matchAll(/\]\(([^)#]+)(#[^)]*)?\)/g)) if (!/^https?:/.test(m[1]!) && !existsSync(path.join(DIR, m[1]!))) bad.push(`${f} → ${m[1]}`);
      // المسارات في `…` التي تبدو ملفات المشروع
      for (const m of src.matchAll(/`((?:src|app|tests|scripts|brand|channels|templates|docs)\/[^`*<>\s]+?)`/g)) {
        const p = m[1]!.replace(/\/$/, "");
        if (!existsSync(p)) bad.push(`${f} → ${p}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("كل مشهد في المكتبة العامة موثق في مكتبة الأدوات", () => {
    const tools = readFileSync(path.join(DIR, "03-tools.md"), "utf8");
    for (const k of Object.keys(LIB_META)) expect(tools, k).toContain(`\`${k}\``);
  });

  it("لا أسرار ولا مفاتيح في الدليل ولا في AGENTS.md", () => {
    const files = [...readdirSync(DIR).map((f) => path.join(DIR, f)), "AGENTS.md"];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/sk_[A-Za-z0-9]{16,}|xi-api-key\s*[:=]|[A-Z_]*(API|SECRET|TOKEN)[A-Z_]*\s*=\s*\S{8,}|ghp_[A-Za-z0-9]{20,}/);
    }
  });

  it("AGENTS.md يدل على CLAUDE.md وعلى دليل القناة", () => {
    const a = readFileSync("AGENTS.md", "utf8");
    expect(a).toContain("CLAUDE.md");
    expect(a).toContain("docs/dafatir-alzaman/");
    expect(existsSync("src/remotion/dafatir/LIBRARY.md") && readFileSync("src/remotion/dafatir/LIBRARY.md", "utf8")).toContain("docs/dafatir-alzaman/03-tools.md");
  });

  it("عارض Markdown في الاستوديو يقرأ عناصر الدليل", () => {
    const blocks = parseMarkdown(readFileSync(path.join(DIR, "03-tools.md"), "utf8"));
    expect(blocks.some((b) => b.k === "h")).toBe(true);
    expect(blocks.some((b) => b.k === "ul")).toBe(true);
    expect(blocks.some((b) => b.k === "code" || b.k === "p")).toBe(true);
    const t = parseMarkdown("| أ | ب |\n| --- | --- |\n| ١ | ٢ |");
    expect(t).toEqual([{ k: "table", head: ["أ", "ب"], rows: [["١", "٢"]] }]);
  });
});

describe("تزامن التوثيق (بوابة التسليم)", () => {
  it("تغيير منظومة دفاتر الزمن بلا تحديث السجل مرفوض", () => {
    expect(docsSyncProblems(["src/remotion/dafatir/lib/scenes.tsx"])).toHaveLength(1);
    expect(docsSyncProblems(["src/remotion/scenes/HorizonShot.tsx", "templates/dafatir-alzaman/script.md"])[0].files).toHaveLength(2);
  });
  it("مع تحديث السجل، أو بتغيير ملفات حلقة أو قناة أخرى فقط، مقبول", () => {
    expect(docsSyncProblems(["src/remotion/dafatir/lib/scenes.tsx", "docs/dafatir-alzaman/07-decisions.md"])).toEqual([]);
    expect(docsSyncProblems(["channels/dafatir-alzaman/episodes/001-adam-beginning/plan.json"])).toEqual([]);
    // ملفات قناة أخرى لا تُلزم بسجل دفاتر الزمن (ولـ«بالإسلام» قاعدتها هي: tests/balislam-reference.test.ts)
    expect(docsSyncProblems(["channels/balislam/channel.json", "src/remotion/illus/x.tsx"]).filter((p: { channel: string }) => p.channel === "dafatir-alzaman")).toEqual([]);
  });
});
