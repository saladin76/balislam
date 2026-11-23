/**
 * D204 (قرار المالك ٢٣ نوفمبر، «عمود السلاسل» D202 «سادسًا»): بطاقة الجودة تقارن الحلقة بالسابقة في سلسلتها
 * (الافتتاح، والتكوينات الجديدة على السلسلة، وترتيب القوالب، والأماكن) وتنبّه ولا تمنع. خطط مكتوبة هنا (KI-068).
 */
import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Plan, PlanScene } from "../src/plan/types";
import { compareWithSeries, seriesDiffIssues } from "../src/studio/quality/seriesDiff";
import { buildCard, seriesDiffItem } from "../src/studio/quality/card";
import { seriesComparison } from "../src/studio/quality/measure";

const sc = (id: string, template: string, props: Record<string, string> = {}): PlanScene => ({ id, template, narration: "نص", line: 1, props, sfx: [] });
const plan = (series: string | null, scenes: PlanScene[]): Plan => ({
  episode: "x", title: "t", themeId: "warm", chapters: [{ number: 1, title: "", scenes }],
  ...(series ? { series: { id: series, name: series, kind: "series", identity: {} as never, template: {}, stampedAt: "" } } : {}),
} as unknown as Plan);
const hz = (shot: string, extra: Record<string, string> = {}) => ({ shot, ...extra });

const ep1 = plan("bidayat", [sc("a1", "horizon-shot", hz("page-turn")), sc("a2", "horizon-shot", hz("timeline")), sc("a3", "verse-card"), sc("a4", "horizon-shot", hz("scales")), sc("a5", "end-screen")]);

describe("الاختلاف عن الحلقة السابقة في السلسلة (D204)", () => {
  it("أول حلقة في سلسلتها ✓ بلا مقارنة", () => {
    const r = compareWithSeries(ep1, []);
    expect(r.previous).toBeNull();
    expect(seriesDiffIssues(r)).toEqual([]);
    expect(seriesDiffItem(r)).toMatchObject({ status: "pass", value: "لا حلقة سابقة في السلسلة" });
  });

  it("حلقة تعيد السابقة: افتتاحها نفسه وتكويناتها وترتيب قوالبها ⇒ تنبيه بالأسباب", () => {
    const copy = plan("bidayat", [sc("b1", "horizon-shot", hz("page-turn")), sc("b2", "horizon-shot", hz("timeline")), sc("b3", "horizon-shot", hz("scales"))]);
    const r = compareWithSeries(copy, [{ id: "001", plan: ep1 }]);
    const item = seriesDiffItem(r);
    expect(item.status).toBe("warn");
    expect(item.reason).toContain("لقطة الافتتاح نفسها في الحلقة 001");
    expect(item.reason).toContain("التكوينات الجديدة على السلسلة ٠٪");
    expect(item.reason).toContain("القوالب نفسها بالترتيب نفسه");
    expect(item.value).toBe("مقارنة بالحلقة 001: ٠٪ تكوينات جديدة (٠ من ٣)");
  });

  it("حلقة مختلفة: افتتاح جديد، وأغلب التكوينات جديدة، وقالب آخر في التتابع ⇒ ✓", () => {
    const fresh = plan("bidayat", [sc("c1", "rahhala-desk", hz("knot")), sc("c2", "horizon-shot", hz("map")), sc("c3", "horizon-shot", hz("scales")), sc("c4", "rahhala-desk", hz("wall"))]);
    const r = compareWithSeries(fresh, [{ id: "001", plan: ep1 }]);
    expect(r.openingSame).toBe(false);
    expect(r.newCount).toBe(3);
    expect(seriesDiffItem(r).status).toBe("pass");
  });

  it("التكوينات تُقارن بالسلسلة كلها لا بالسابقة وحدها، والأماكن المعلنة تُحسب", () => {
    const ep2 = plan("bidayat", [sc("d1", "alley-tale", { place: "السوق" }), sc("d2", "alley-tale", { place: "البيت" })]);
    const ep3 = plan("bidayat", [sc("e1", "horizon-shot", hz("page-turn")), sc("e2", "alley-tale", { place: "السوق" })]);
    const r = compareWithSeries(ep3, [{ id: "001", plan: ep1 }, { id: "002", plan: ep2 }]);
    expect(r.previous).toBe("002");
    expect(r.newShare).toBe(0);
    expect(r.newPlaces).toBe(0);
    expect(seriesDiffIssues(r)).toContain("لا مكان جديد على السلسلة");
  });

  it("البطاقة: بند في «الحِرفة» لا يمنع شيئًا", () => {
    const copy = plan("bidayat", [sc("b1", "horizon-shot", hz("page-turn"))]);
    const card = buildCard({ target: "assembly", plan: copy, measured: null, series: compareWithSeries(copy, [{ id: "001", plan: ep1 }]) });
    const item = card.sections.find((s) => s.id === "craft")!.items.find((i) => i.id === "craft-series")!;
    expect(item.status).toBe("warn");
    expect(card.blockers.some((b) => b.includes("الاختلاف عن الحلقة السابقة"))).toBe(false);
  });

  it("القراءة من مجلد القناة: السلسلة نفسها فقط، وقبل الحلقة فقط، بلا المعامل", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "series-diff-"));
    const put = async (d: string, p: Plan) => { await mkdir(path.join(root, d), { recursive: true }); await writeFile(path.join(root, d, "plan.json"), JSON.stringify(p)); };
    await put("001-first", ep1);
    await put("002-other", plan("hadarat", [sc("o1", "horizon-shot", hz("globe"))]));
    await put("900-lab", plan("bidayat", [sc("l1", "horizon-shot", hz("lab"))]));
    const me = plan("bidayat", [sc("m1", "horizon-shot", hz("page-turn"))]);
    await put("003-me", me);
    await put("004-later", plan("bidayat", [sc("z1", "horizon-shot", hz("later"))]));
    const r = await seriesComparison(path.join(root, "003-me", "script.md"), me);
    expect(r?.previous).toBe("001");
    expect(r?.openingSame).toBe(true);
    const first = await seriesComparison(path.join(root, "001-first", "script.md"), ep1);
    expect(seriesDiffItem(first).status).toBe("pass");
  });
});
