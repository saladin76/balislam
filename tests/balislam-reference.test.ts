import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { readGuideIndex, readGuidePage } from "../src/channel/guide";
import { ENGINE_FEATURES } from "../src/plan/engine";
import { templateDefs } from "../src/plan/templates";
import { parseMarkdown } from "../app/src/ui/Markdown";
// @ts-expect-error سكريبت mjs بلا أنواع
import { DOC_RULES, docsSyncProblems } from "../scripts/docs-sync.mjs";

/**
 * المرجع الهندسي لـ«بالإسلام» (الأمر 012): مطابق للكود الحالي، يُقرأ من الاستوديو ومن AGENTS.md،
 * ويغطي كل أداة في سجل المحرك، وتحديثه مفروض في بوابة التسليم.
 */
const DIR = "docs/balislam";
const pages = () => readdirSync(DIR).filter((f) => f.endsWith(".md"));
const read = (f: string) => readFileSync(path.join(DIR, f), "utf8");
/** نص ملف أو كل ملفات مجلد (لمسار مثل src/remotion/illus/shots) */
const sourceOf = (p: string): string => {
  if (!existsSync(p)) return "";
  if (!statSync(p).isDirectory()) return readFileSync(p, "utf8");
  return readdirSync(p).map((f) => sourceOf(path.join(p, f))).join("\n");
};

describe("المرجع الهندسي لـ«بالإسلام» — البنية والوصول", () => {
  it("الفهرس يذكر كل صفحة، وكل صفحة في الفهرس موجودة، والأقسام الأساسية حاضرة", async () => {
    const idx = (await readGuideIndex("balislam"))!;
    expect(idx.channel).toBe("balislam");
    expect(idx.navLabel).toBe("مرجع الاستوديو");
    expect(idx.entries.map((e) => e.file).sort()).toEqual(pages().sort());
    for (const f of ["README.md", "00-start-here.md", "01-constants.md", "02-architecture.md", "03-engine.md", "04-render-quality.md", "05-development.md", "06-decisions.md"]) expect(pages()).toContain(f);
  });
  it("الاستوديو يقرأ كل صفحة، ولا يقرأ ما خارج الفهرس", async () => {
    const idx = (await readGuideIndex("balislam"))!;
    for (const e of idx.entries) expect((await readGuidePage("balislam", e.file))?.length, e.file).toBeGreaterThan(400);
    expect(await readGuidePage("balislam", "../../.env")).toBeNull();
    expect(await readGuidePage("balislam", "../../CLAUDE.md")).toBeNull();
  });
  it("الأقسام التي يطلبها الأمر 012 موجودة بعناوينها", () => {
    expect(read("01-constants.md")).toContain("الثوابت الهندسية والفنية لاستوديو «بالإسلام»");
    for (const h of ["الثوابت الهندسية", "الثوابت البصرية والإخراجية", "الثوابت الشرعية والمحتوى"]) expect(read("01-constants.md")).toContain(h);
    for (const d of ["إلزامية", "تفضيل إخراجي", "اختياري", "تجريبي"]) expect(read("01-constants.md")).toContain(d);
    const dev = read("05-development.md");
    for (let i = 1; i <= 10; i++) expect(dev, `القسم ${i}`).toMatch(new RegExp(`## ${"١٢٣٤٥٦٧٨٩"[i - 1] ?? "١٠"}${i === 10 ? "" : "\\."}`));
  });
  it("AGENTS.md وCLAUDE.md يدلان على المرجع، ويبقى AGENTS.md للقنوات الثلاث", () => {
    const a = readFileSync("AGENTS.md", "utf8");
    expect(a).toContain("docs/balislam/");
    expect(a).toContain("docs/dafatir-alzaman/");
    expect(a).toContain("docs/zubdat-alkutub/");
    expect(readFileSync("CLAUDE.md", "utf8")).toContain("docs/balislam/");
  });
});

describe("المرجع يطابق الكود الحالي", () => {
  it("الروابط بين الصفحات ومسارات المشروع المذكورة موجودة", () => {
    const bad: string[] = [];
    for (const f of pages()) {
      const src = read(f);
      for (const m of src.matchAll(/\]\(([^)#]+)(#[^)]*)?\)/g)) if (!/^https?:/.test(m[1]!) && !existsSync(path.join(DIR, m[1]!))) bad.push(`${f} → ${m[1]}`);
      for (const m of src.matchAll(/`((?:src|app|tests|scripts|brand|channels|templates|docs|\.githooks)\/[^`*<>\s]+?)`/g)) {
        const p = m[1]!.replace(/\/$/, "");
        if (!existsSync(p)) bad.push(`${f} → ${p}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("كل دالة أو ثابت يُذكر في سطر بجوار ملف موجود في أحد ملفات السطر فعلًا", () => {
    const bad: string[] = [];
    for (const f of pages()) {
      for (const line of read(f).split("\n")) {
        const files = [...line.matchAll(/`((?:src|app|scripts|brand)\/[^`\s]+?\.(?:tsx?|mjs)|src\/remotion\/illus\/shots)`/g)].map((m) => m[1]!);
        if (!files.length) continue;
        const text = files.map(sourceOf).join("\n");
        for (const m of line.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)) {
          const id = m[1]!;
          // أسماء الحقول والقيم والقوالب تُكتب أيضًا بين علامتين؛ تُفحص كلها: يجب أن تظهر في ملفات السطر
          if (!text.includes(id)) bad.push(`${f}: «${id}» ليس في ${files.join("، ")}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
  it("كل أداة في سجل المحرك موثقة بمعرّفها، وكل حقل يكتبه أساس مذكور", () => {
    const engine = read("03-engine.md");
    for (const f of ENGINE_FEATURES) {
      expect(engine, f.id).toContain(`\`${f.id}\``);
      for (const sets of Object.values(f.sets ?? {})) for (const k of Object.keys(sets)) expect(engine, `${f.id}.${k}`).toContain(`\`${k}\``);
    }
  });
  it("حقول المحرك في قوالب «بالإسلام» المصوَّرة موثقة", () => {
    const engine = read("03-engine.md");
    for (const t of ["alley-tale", "road-journey", "light-stage"])
      for (const k of ["cameraMode", "cameraPlan", "cameraPlanPortrait", "gait", "poseTimeline", "motion", "lighting"])
        if (templateDefs.find((d) => d.id === t)!.fields.some((x) => x.key === k)) expect(engine, `${t}.${k}`).toContain(`\`${k}\``);
  });
  it("لا أسرار ولا مفاتيح في المرجع", () => {
    for (const f of [...pages().map((x) => path.join(DIR, x)), path.join(DIR, "guide.json")]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/sk_[A-Za-z0-9]{16,}|xi-api-key\s*[:=]|[A-Z_]*(API|SECRET|TOKEN)[A-Z_]*\s*=\s*\S{8,}|ghp_[A-Za-z0-9]{20,}/);
    }
  });
  it("عارض Markdown في الاستوديو يقرأ الجداول والقوائم والكود في المرجع", () => {
    const blocks = parseMarkdown(read("05-development.md"));
    for (const k of ["h", "table", "code", "ul"]) expect(blocks.some((b) => b.k === k), k).toBe(true);
  });
});

describe("تحديث المرجع مفروض (بوابة التسليم)", () => {
  const rule = DOC_RULES.find((r: { channel: string }) => r.channel === "balislam");
  it("تغيير منظومة «بالإسلام» دون سجل قراراتها مرفوض، ومعه مقبول", () => {
    for (const f of ["src/plan/engine.ts", "src/remotion/scenes/LightStage.tsx", "src/remotion/illus/gait.ts", "channels/balislam/channel.json"]) {
      expect(docsSyncProblems([f]).map((p: { channel: string }) => p.channel), f).toContain("balislam");
      expect(docsSyncProblems([f, rule.log]), f).toEqual([]);
    }
  });
  it("الإعفاء لتغيير لا يمس السلوك: بسبب مكتوب، وفي كل commit يمس المنظومة", () => {
    const f = ["src/remotion/scenes/LightStage.tsx"];
    expect(docsSyncProblems(f, [{ files: f, message: "تنسيق\n\nDocs-Unaffected: تعليق فقط" }])).toEqual([]);
    expect(docsSyncProblems(f, [{ files: f, message: "Docs-Unaffected:" }])).toHaveLength(1);
    expect(docsSyncProblems(f, [{ files: f, message: "Docs-Unaffected: تعليق" }, { files: f, message: "تغيير سلوك" }])).toHaveLength(1);
  });
  it("الكود المشترك بين القنوات وملفات القنوات الأخرى لا تُلزم بسجل «بالإسلام»", () => {
    for (const f of ["src/plan/validate.ts", "src/remotion/scenes/Episode.tsx", "channels/zubdat-alkutub/channel.json", "src/remotion/dafatir/lib/meta.ts"])
      expect(docsSyncProblems([f]).map((p: { channel: string }) => p.channel), f).not.toContain("balislam");
    // والإعفاء لا يمتد إلى قواعد القنوات الأخرى
    const z = ["src/remotion/zubdat/x.tsx"];
    expect(docsSyncProblems(z, [{ files: z, message: "Docs-Unaffected: x" }])).toHaveLength(1);
  });
  it("كل ملف تذكره قائمة المراقبة موجود (لا قائمة قديمة لا تراقب شيئًا)", () => {
    const all = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.name === "node_modules" || e.name.startsWith(".git") && e.name !== ".githooks" ? [] : e.isDirectory() ? all(path.join(d, e.name)) : [path.join(d, e.name)]));
    const files = ["src", "scripts", ".githooks", "channels/balislam", "templates/balislam"].flatMap(all);
    for (const re of rule.watch as RegExp[]) expect(files.some((f) => re.test(f)), String(re)).toBe(true);
  });
});
