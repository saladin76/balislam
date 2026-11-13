import path from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readGuideIndex, readGuidePage } from "../src/channel/guide";
import { parseMarkdown } from "../app/src/ui/Markdown";
import { STANDARDS, STATUS_AR } from "../src/studio/zubdat";
import { KIT_SHOTS } from "../src/remotion/zubdat/kitShots";
// @ts-expect-error سكريبت mjs بلا أنواع
import { docsSyncProblems } from "../scripts/docs-sync.mjs";

/**
 * المرجع الدائم لاستوديو زبدة الكتب (docs/zubdat-alkutub/) يطابق الواقع: يفشل هذا الاختبار إن ذُكر مسار لم يعد موجودًا،
 * أو أُضيف معيار أو أداة أو أمر دون توثيق، أو انكسر رابط، أو ظهر ما يشبه سرًّا، أو تعذّرت قراءته من الاستوديو.
 */
const root = path.resolve(__dirname, "..");
const DIR = path.join(root, "docs", "zubdat-alkutub");
const channel = path.join(root, "channels", "zubdat-alkutub");
const bases = [root, channel, path.join(channel, "episodes", "001-awwal-marra-osalli")];
const read = (f: string) => readFileSync(f, "utf8");
const pages = readdirSync(DIR).filter((f) => f.endsWith(".md")).sort();
const page = (f: string) => read(path.join(DIR, f));
const all = [...pages.map((f) => ({ name: `docs/zubdat-alkutub/${f}`, md: page(f) })), { name: "channels/zubdat-alkutub/AGENTS.md", md: read(path.join(channel, "AGENTS.md")) }];

describe("المرجع الدائم لاستوديو زبدة الكتب", () => {
  it("الفهرس يذكر كل صفحة، والاستوديو يقرؤها باسم «مرجع الاستوديو»", async () => {
    const idx = (await readGuideIndex("zubdat-alkutub"))!;
    expect(idx.title).toBe("المرجع الدائم لاستوديو زبدة الكتب — الهندسة والإنتاج ومعايير التطوير");
    expect(idx.navLabel).toBe("مرجع الاستوديو");
    expect(idx.entries.filter((e) => !e.shared).map((e) => e.file).sort()).toEqual(pages);
    for (const s of ["00-start-here.md", "01-identity.md", "02-architecture.md", "03-workflow.md", "04-rules.md", "05-quality.md", "06-decisions.md", "07-lessons.md", "CHANGELOG.md"]) expect(pages).toContain(s);
    for (const e of idx.entries) expect((await readGuidePage("zubdat-alkutub", e.file))?.length, e.file).toBeGreaterThan(300);
    expect(await readGuidePage("zubdat-alkutub", "../../.env")).toBeNull();
  });

  it("كل مسار مذكور في المرجع موجود في المستودع", () => {
    const missing: string[] = [];
    for (const { name, md } of all)
      for (const m of md.matchAll(/`([^`\s]+)`/g)) {
        const p = m[1]!.replace(/[،.]$/, "");
        if (p.includes("<") || p.includes("*") || !p.includes("/") || /^(https?:|git|npx|npm)/.test(p)) continue;
        const isFile = /\.(tsx?|mts|mjs|json|md|html|mp4|ttf|css)$/.test(p);
        const isCodeDir = /^(src|app|tests|brand|templates|channels|public|docs|scripts|assets)\//.test(p) && p.endsWith("/");
        if (!isFile && !isCodeDir) continue;
        if (!bases.some((b) => existsSync(path.join(b, p)))) missing.push(`${name}: ${p}`);
      }
    expect(missing).toEqual([]);
  });

  it("كل معيار في STANDARDS موثق بحالته (ملزم، أو خيار، أو ينتظر المراجعة)، وكل أداة kit-* وكل أمر zubdat موثق", () => {
    const quality = page("05-quality.md");
    for (const s of STANDARDS) {
      const row = quality.split("\n").find((l) => l.startsWith(`| ${s.id} |`));
      expect(row, s.id).toBeDefined();
      expect(row, s.id).toContain(`**${STATUS_AR[s.status]}**`);
    }
    const rules = page("04-rules.md");
    for (const id of Object.keys(KIT_SHOTS)) expect(rules, id).toContain(`\`${id}\``);
    for (const a of ["check", "guide", "qa", "sheet"]) expect(quality, a).toMatch(new RegExp(`zubdat ${a}`));
  });

  it("الروابط بين صفحات المرجع سليمة", () => {
    const broken: string[] = [];
    for (const f of pages)
      for (const m of page(f).matchAll(/\]\(([^)]+)\)/g)) {
        const href = m[1]!;
        if (/^https?:/.test(href)) continue;
        const file = href.split("#")[0]!;
        if (!file || !pages.includes(file)) broken.push(`${f} → ${href}`);
      }
    expect(broken).toEqual([]);
  });

  it("سجل القرارات: لكل قرار تاريخ وحالة، والمعرّفات بلا تكرار", () => {
    const dec = page("06-decisions.md");
    const ids = [...dec.matchAll(/^### (D\d+) /gm)].map((m) => m[1]!);
    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
    for (const block of dec.split(/^### /m).slice(1).filter((b) => /^D\d+/.test(b))) {
      expect(block, block.slice(0, 40)).toMatch(/\*\*التاريخ:\*\*/);
      expect(block, block.slice(0, 40)).toMatch(/\*\*الحالة:\*\*/);
    }
  });

  it("العارض يعرض البنود الفرعية تحت بندها دون أن يغيّر القوائم المسطحة", () => {
    const nested = parseMarkdown("1. أول\n   - فرعي\n2. ثانٍ")[0] as { k: string; items: string[]; depth?: number[] };
    expect(nested).toMatchObject({ k: "ol", items: ["أول", "فرعي", "ثانٍ"], depth: [0, 1, 0] });
    expect(parseMarkdown("- أ\n- ب")[0]).toEqual({ k: "ul", items: ["أ", "ب"] });
  });

  it("تزامن التوثيق: تغيير منظومة القناة دون سجل قراراتها مرفوض", () => {
    expect(docsSyncProblems(["src/remotion/zubdat/kitShots.tsx"])).toEqual([{ channel: "zubdat-alkutub", log: "docs/zubdat-alkutub/06-decisions.md", files: ["src/remotion/zubdat/kitShots.tsx"] }]);
    expect(docsSyncProblems(["src/studio/zubdat.ts", "docs/zubdat-alkutub/06-decisions.md"])).toEqual([]);
    expect(docsSyncProblems(["channels/zubdat-alkutub/episodes/001-awwal-marra-osalli/script.md"])).toEqual([]);
  });

  it("لا أسرار في المرجع", () => {
    for (const { name, md } of all)
      expect(md, name).not.toMatch(/(sk_[A-Za-z0-9]{16,}|xi-api-key|Bearer\s+[A-Za-z0-9._-]{20,}|(QF_CLIENT_SECRET|ELEVENLABS_API_KEY)\s*=\s*\S+)/);
  });
});
