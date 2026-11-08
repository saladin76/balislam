import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { listTechReviews, techReviewFilePath, techReviewProblems, type TechReviewMeta } from "../src/channel/techReviews";
import { listLabs } from "../src/channel/labs";
import { listScriptEpisodeDirs } from "../src/script/episodes";
import { parseMarkdown } from "../app/src/ui/Markdown";

/**
 * «المراجعات الفنية» (الأمر 018): تقارير المنفّذ تُعرض في الاستوديو بوسائطها، ولا تُغيّر اعتماد شيء:
 * قرار المشرف فارغ حتى يتخذه، والمختبر يبقى «جاهز للمراجعة»، والمعاينات المراجَعة موجودة كما هي.
 */
const EPS = "channels/dafatir-alzaman/episodes";

describe("المراجعات الفنية", () => {
  it("مراجعات الأوامر 018–025 موجودة، وقرار المشرف فارغ", async () => {
    const list = await listTechReviews(EPS);
    const keys = list.map((r) => `${r.dir}/${r.id}`).sort();
    expect(keys).toEqual(["001-adam-beginning/018", "001-adam-beginning/019", "001-adam-beginning/020", "001-adam-beginning/021", "001-adam-beginning/022", "001-adam-beginning/023", "001-adam-beginning/024", "001-adam-beginning/025", "900-library-lab/018", "900-library-lab/019"]);
    for (const r of list) {
      expect(r.supervisorDecision).toBeNull();
      expect(r.hasReport).toBe(true);
      expect(r.strips.length).toBeGreaterThan(0);
      // ستوري بورد الأمر 020 لوحات وPDF بلا مقاطع؛ مراجعات الفيديو (018، 019) لها مقاطع قبل/بعد
      if (!["020", "021", "022", "023", "024", "025"].includes(r.id)) expect(r.clips.length).toBeGreaterThan(0);
    }
  });

  it("كل وسيط في التقرير موجود ويُخدم، وكل هدف فيديو موجود في معاينات الحلقة أو المختبر", async () => {
    const labs = await listLabs(EPS);
    const episodes = await listScriptEpisodeDirs(EPS);
    for (const r of await listTechReviews(EPS)) {
      const md = readFileSync(path.join(EPS, r.dir, "tech-reviews", r.id, "report.md"), "utf8");
      const media = parseMarkdown(md).filter((b) => b.k === "media");
      expect(media.length, r.dir).toBeGreaterThan(0);
      for (const m of media) if (m.k === "media") expect(await techReviewFilePath(EPS, r.dir, r.id, m.src), m.src).not.toBeNull();
      for (const t of r.targets) {
        if (t.kind === "lab") expect(labs.find((l) => l.dir === t.dir)?.previews.map((p) => p.name), t.label).toContain(t.preview);
        else {
          expect(episodes).toContain(t.dir);
          expect(readFileSync(path.join(EPS, t.dir, "previews", "index.json"), "utf8")).toContain(t.preview);
        }
      }
    }
  });

  it("المراجعة لا تغيّر اعتماد المختبر: يبقى وأدواته «جاهز للمراجعة»", async () => {
    const lab = (await listLabs(EPS)).find((l) => l.dir === "900-library-lab")!;
    expect(lab.status).toBe("review");
    expect(lab.tools.every((t) => t.status === "review")).toBe(true);
    expect(lab.decisions.some((d) => d.status === "approved")).toBe(false);
  });

  it("خدمة الملفات لا تخرج عن مجلد المراجعة ولا تخدم إلا الأنواع المسموحة", async () => {
    expect(await techReviewFilePath(EPS, "001-adam-beginning", "018", "../../script.md")).toBeNull();
    expect(await techReviewFilePath(EPS, "001-adam-beginning", "018", "review.json")).toBeNull();
    expect(await techReviewFilePath(EPS, "../001-adam-beginning", "018", "report.md")).toBeNull();
    expect(await techReviewFilePath(EPS, "001-adam-beginning", "..", "report.md")).toBeNull();
    expect(await techReviewFilePath(EPS, "001-adam-beginning", "018", "report.md")).not.toBeNull();
    // الأمر 020: PDF الستوري بورد وبياناته تُخدم من docs/ وحدها، ولا شيء غيرهما
    expect(await techReviewFilePath(EPS, "001-adam-beginning", "020", "docs/storyboard-001-v1.pdf")).not.toBeNull();
    expect(await techReviewFilePath(EPS, "001-adam-beginning", "020", "docs/storyboard-001-v1.json")).not.toBeNull();
    expect(await techReviewFilePath(EPS, "001-adam-beginning", "020", "docs/storyboard-001-v1.1.pdf")).not.toBeNull();
    expect(await techReviewFilePath(EPS, "001-adam-beginning", "020", "docs/../review.json")).toBeNull();
    expect(await techReviewFilePath(EPS, "001-adam-beginning", "020", "docs/x.mp4")).toBeNull();
  });

  it("لا مراجعات فنية في القناتين الأخريين", async () => {
    expect(await listTechReviews("channels/balislam/episodes")).toEqual([]);
    expect(await listTechReviews("channels/zubdat-alkutub/episodes")).toEqual([]);
  });

  it("السجل يرفض قرار مشرف غير مسجل وتوصية غير معروفة", () => {
    const base: TechReviewMeta = { title: "t", date: "2026-11-05", author: "المنفّذ", recommendation: "fixes", summary: "", targets: [{ label: "x", kind: "lab", dir: "900-x", preview: "a.mp4" }], supervisorDecision: null };
    expect(techReviewProblems(base)).toEqual([]);
    expect(techReviewProblems({ ...base, recommendation: "approved" as never })).toHaveLength(1);
    expect(techReviewProblems({ ...base, supervisorDecision: {} as never })).toHaveLength(1);
  });

  it("عارض Markdown يقرأ سطر الوسائط صورةً أو فيديو", () => {
    expect(parseMarkdown("![وصف](clips/a.mp4)")).toEqual([{ k: "media", alt: "وصف", src: "clips/a.mp4" }]);
  });

  it("ستوري بورد الأمر 020 (v1.1، وv1 محفوظ): لوحة لكل مشهد من مشاهد الخطة، وPDF وبيانات ببصمة المرجع، ومصدر كل حقل، وغير معتمد", () => {
    const dir = path.join(EPS, "001-adam-beginning");
    const data = JSON.parse(readFileSync(path.join(dir, "tech-reviews/020/docs/storyboard-001-v1.1.json"), "utf8"));
    const plan = JSON.parse(readFileSync(path.join(dir, "plan.json"), "utf8"));
    // الستوري بورد v1.1 وثيقة تاريخية (الأمر 020): لا تشمل بطاقة الأعراف 15 (c4-v7) التي أضافها المالك في ٨ نوفمبر؛
    // لوحتها تُضاف في إصدار ستوري بورد جديد، لا بتعديل v1.1
    const ADDED_AFTER_020 = new Set(["c4-v7"]);
    const ids = plan.chapters.flatMap((c: { scenes: { id: string }[] }) => c.scenes.map((s) => s.id)).filter((id: string) => !ADDED_AFTER_020.has(id));
    expect(data.scenes.map((s: { id: string }) => s.id)).toEqual(ids);
    expect(data.status).toBe("PENDING_REVIEW");
    expect(data.approved).toBe(false);
    expect(data.provenance.camera).toBe("automatic-estimate");
    expect(data.provenance.frames).toBe("V7");
    expect(data.scenes.find((s: { id: string; idea: string }) => s.id === "c7-s8").idea).toContain("closing");
    expect(data.source.sha256.startsWith("df30cd648bd7e78a")).toBe(true);
    for (const s of data.scenes) expect(readFileSync(path.join(dir, "tech-reviews/020", s.board)).length).toBeGreaterThan(0);
    for (const v of ["v1", "v1.1"]) expect(readFileSync(path.join(dir, `tech-reviews/020/docs/storyboard-001-${v}.pdf`)).subarray(0, 4).toString()).toBe("%PDF");
  });
});
