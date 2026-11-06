import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { boardScenes, describeTransition, sceneConstraints } from "../src/plan/storyboardBoard";
import { sceneFrames } from "../src/plan/duration";
import type { Plan, PlanScene } from "../src/plan/types";

/** لوحة الستوري بورد المرئية (عقد الإنتاج الجديد، المرحلة 1): الصفوف من الخطة كما هي، بلا اعتماد */
const ep = path.join(__dirname, "../channels/balislam/episodes/001-know-the-truth");
const plan = JSON.parse(fs.readFileSync(path.join(ep, "plan.json"), "utf8")) as Plan;
const notes = JSON.parse(fs.readFileSync(path.join(ep, "storyboard/board-notes.json"), "utf8"));
const rows = boardScenes(plan, (s) => sceneFrames(s), notes);

describe("لوحة الستوري بورد للحلقة 001", () => {
  it("كل مشاهد الحلقة بترتيبها، بلا افتتاحية، وبدايات متصلة", () => {
    const ids = plan.chapters.flatMap((c) => c.scenes.map((s) => s.id));
    expect(rows.map((r) => r.id)).toEqual(ids);
    expect(rows.length).toBe(114);
    expect(rows[0]!.start).toBe(0);
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.start).toBe(rows[i - 1]!.start + rows[i - 1]!.frames);
    for (const r of rows) for (const f of r.shots) expect(f).toBeLessThan(r.frames);
  });
  it("حدث الميزان: إطاراته المحددة، ويُعلَّم حدثًا واحدًا، وملاحظات المراجعة مدرجة", () => {
    const a = rows.find((r) => r.id === "c1-s1")!;
    const b = rows.find((r) => r.id === "c1-s2")!;
    expect(a.shots).toEqual([15, 72, 110, 150, 200]);
    expect(a.event).toBe(b.event);
    expect(a.notes.join(" ")).toMatch(/017/);
    expect(a.camera).toMatch(/لقطة مصمَّمة/);
    // حقول الإخراج العام لا تُعرض مع اللقطة المصمَّمة
    expect(a.composition.join(" ")).not.toMatch(/حركة البطل لكل جملة/);
  });
  it("القيود: الآية بلا نص تُعلَّم مانعًا للاعتماد، والدعاء بنسبته، وذكر الله سكون", () => {
    const verses = rows.filter((r) => r.template === "verse-card");
    expect(verses.length).toBe(4);
    for (const v of verses) expect(v.constraints.join(" ")).toMatch(/لم يُجلب بعد/);
    const dua = rows.find((r) => r.id === "c4-s1")!;
    expect(dua.constraints.join(" ")).toMatch(/لا يُنسب إلى النبي ﷺ/);
    expect(sceneConstraints({ id: "x", template: "alley-tale", narration: "يقول الله تعالى:", props: {} } as unknown as PlanScene).join(" ")).toMatch(/سكون مقصود/);
  });
  it("الانتقال والإحساس: الافتراضي مذكور، وبداية الفصل معلَّمة، والإحساس مقترح لا قرار", () => {
    expect(rows[0]!.transition).toBe("بداية الحلقة");
    const c2 = rows.find((r) => r.id === "c2-s1")!;
    expect(c2.transition).toMatch(/بداية فصل/);
    expect(describeTransition({ transition: "cut" } as PlanScene, {} as PlanScene, false)).toBe("انتقال «cut»");
    for (const r of rows) expect(r.feeling).toMatch(/^مقترح/);
  });
  it("لا اعتماد: لا storyboard.json للحلقة، والبيان «PENDING_REVIEW» ببصمة لكل مشهد وملف", () => {
    expect(fs.existsSync(path.join(ep, "storyboard.json"))).toBe(false);
    const m = JSON.parse(fs.readFileSync(path.join(ep, "storyboard/board-manifest.json"), "utf8"));
    expect(m.status).toBe("PENDING_REVIEW");
    expect(m.scenes.length).toBe(114);
    expect(m.files.every((f: { sha256: string }) => /^[0-9a-f]{64}$/.test(f.sha256))).toBe(true);
    for (const s of m.scenes) expect(s.images.landscape.length).toBe(s.shots.length);
  });
});
