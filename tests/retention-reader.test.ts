/**
 * قارئ الاحتفاظ (المرحلة ٢ البند ٥): التصدير بأشكاله، وأكبر تسرب ومكانه، وأول ٣٠ ثانية.
 * التصديرات والمشاهد مكتوبة هنا؛ لا تُقرأ حلقة حية (KI-068).
 */
import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { analyseRetention, locate, parseRetention, retentionAt, retentionMarkdown, type RetentionPoint } from "../src/analytics/retention";
import { readRetentionExport } from "../src/analytics/retentionFile";

const D = 300;
/** منحنى: 100 → 80 حتى 30 ث، ثابت حتى 120، هبوط 20 نقطة بين 120 و130، ثم هبوط الخاتمة. */
const curve = (t: number) => (t <= 30 ? 100 - (20 * t) / 30 : t <= 120 ? 80 : t <= 130 ? 80 - 2 * (t - 120) : t <= 285 ? 60 - (5 * (t - 130)) / 155 : 55 - 2 * (t - 285));
const rows = (fmt: (t: number) => string, retFmt = (r: number) => r.toFixed(1)) =>
  Array.from({ length: 101 }, (_, i) => (i * D) / 100).map((t) => `${fmt(t)},${retFmt(curve(t))}`).join("\n");
const scenes = [
  { id: "c1-s1", start: 0, narration: "عرفت الأرض أممًا كثيرة. فمتى كانت البداية؟" },
  { id: "c1-s2", start: 40, narration: "خلق الله آدم من طين." },
  { id: "c1-s3", start: 110, narration: "ثم أمر الملائكة بالسجود. فسجدوا إلا إبليس أبى واستكبر." },
  { id: "c1-s4", start: 200, narration: "ثم كان الهبوط إلى الأرض." },
];

describe("قراءة التصدير", () => {
  it("الموضع نسبة مئوية والاحتفاظ بالنسبة: يلزم طول الحلقة", () => {
    const csv = `Video position (%),Absolute audience retention (%)\n${rows((t) => ((t / D) * 100).toFixed(0))}`;
    const p = parseRetention(csv, D);
    expect(p[0]).toEqual({ t: 0, r: 100 });
    expect(retentionAt(p, 30)).toBeCloseTo(80, 0);
    expect(() => parseRetention(csv)).toThrow(/طول الحلقة/);
  });
  it("الموضع وقت «m:ss»، والاحتفاظ كسر، والمطلق قبل النسبي", () => {
    const csv = `Video position,Relative audience retention,Audience retention\n${Array.from({ length: 31 }, (_, i) => i * 10).map((t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")},0.5,${(curve(t) / 100).toFixed(3)}`).join("\n")}`;
    const p = parseRetention(csv);
    expect(p.at(-1)!.t).toBe(300);
    expect(retentionAt(p, 30)).toBeCloseTo(80, 0);
  });
  it("عناوين عربية وأرقام عربية وفاصل Tab", () => {
    const tsv = `موضع الفيديو (٪)\tالاحتفاظ بالجمهور (٪)\n${Array.from({ length: 11 }, (_, i) => `${"٠١٢٣٤٥٦٧٨٩"[0]}${i * 10}\t${Math.round(curve((i * 10 * D) / 100))}`).join("\n")}`;
    expect(parseRetention(tsv, D)[0]!.r).toBe(100);
  });
  it("ملف بلا العمودين: رسالة بما وجده", () => {
    expect(() => parseRetention("Date,Views\n2026-11-01,5\n2026-11-02,6\n2026-11-03,7")).toThrow(/موضع الفيديو/);
  });
  it("ZIP من Studio: يُختار ملف الاحتفاظ ويُترك غيره", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ret-"));
    try {
      await writeFile(path.join(dir, "Table data.csv"), "Content,Views\nx,10\ny,11\nz,12");
      await writeFile(path.join(dir, "Chart data.csv"), `Video position (%),Audience retention (%)\n${rows((t) => ((t / D) * 100).toFixed(0))}`);
      execFileSync("zip", ["-q", "-j", path.join(dir, "export.zip"), path.join(dir, "Table data.csv"), path.join(dir, "Chart data.csv")]);
      expect((await readRetentionExport(path.join(dir, "export.zip"), D)).length).toBe(101);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});

describe("التحليل", () => {
  const pts: RetentionPoint[] = parseRetention(`Video position (%),Audience retention (%)\n${rows((t) => ((t / D) * 100).toFixed(0))}`, D);
  const r = analyseRetention(pts, { duration: D, scenes, estimated: false });
  it("أول ٣٠ ثانية: من 100 إلى 80، في الحد فلا إصلاح للخطاف", () => {
    expect(r.start).toBe(100);
    expect(r.at30).toBeCloseTo(80, 0);
    expect(r.earlyFix).toBe(false);
  });
  it("أكبر تسرب بعدها مكانه الحقيقي ومشهده، وهبوط الخاتمة (آخر ٥٪) لا يُعدّ", () => {
    expect(r.biggest!.from).toBeGreaterThanOrEqual(115);
    expect(r.biggest!.from).toBeLessThanOrEqual(125);
    expect(r.biggest!.sceneId).toBe("c1-s3");
    expect(r.biggest!.drop).toBeGreaterThan(10);
  });
  it("تسرب أول ٣٠ ث فوق ٢٥ نقطة: «يُصلح في السكريبت» عند الجملة", () => {
    const steep: RetentionPoint[] = [{ t: 0, r: 100 }, { t: 10, r: 60 }, { t: 30, r: 55 }, { t: 300, r: 40 }];
    const s = analyseRetention(steep, { duration: D, scenes, estimated: false });
    expect(s.earlyFix).toBe(true);
    expect(s.early.sceneId).toBe("c1-s1");
    expect(retentionMarkdown("حلقة", s)).toMatch(/يُصلح في السكريبت/);
  });
  it("الجملة تقريبًا بموضعها في نص المشهد", () => {
    expect(locate(130, scenes, D)).toEqual({ sceneId: "c1-s3", sentence: "ثم أمر الملائكة بالسجود." });
    expect(locate(190, scenes, D).sentence).toBe("فسجدوا إلا إبليس أبى واستكبر.");
  });
  it("التقرير يقول متوسط المشاهدة، ويعلن التوقيت التقديري", () => {
    const md = retentionMarkdown("خلق آدم", analyseRetention(pts, { duration: D, scenes, estimated: true }));
    expect(md).toMatch(/متوسط ما يُشاهَد: \d+٪ من 5:00/);
    expect(md).toMatch(/تقديرية/);
  });
});
