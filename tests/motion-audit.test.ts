import { describe, expect, it } from "vitest";
import type { Plan } from "../src/plan/types";
import type { StoryboardMotion } from "../src/render/storyboardMotion";
import { motionAuditSummary, renderMotionAuditMarkdown } from "../src/render/motionAudit";
import { motionFingerprint } from "../src/render/motionFingerprint";

const plan = {
  title: "حلقة اختبار", updatedAt: "2026-01-01",
  chapters: [{ number: 1, title: "الفصل", scenes: [
    { id: "c1-s1", narration: "خبرٌ ثم اعتذار", template: "alley-tale", props: {}, sfx: [] },
    { id: "c1-s2", narration: "تأمل", template: "alley-tale", props: {}, sfx: [] },
  ] }],
} as unknown as Plan;
const report: StoryboardMotion = {
  at: "2026-11-04T00:00:00.000Z", orientation: "landscape", percent: 81,
  scenes: {
    "c1-s1": { hash: "a", pct: 91, still: 1, from: 2, logic: { status: "needs-review", matched: 1, total: 2, findings: [{ kind: "timing", level: "warning", message: "مرساة غير موجودة" }] } },
    "c1-s2": { hash: "b", pct: 58, still: 5, from: 9, logic: { status: "not-assessable", matched: 0, total: 0, findings: [] } },
  },
};
const media = { voice: {}, sfx: [], recitations: {}, images: [] };
describe("تقرير الحركة والإخراج", () => {
  it("يحفظ حالة كل المشاهد ولا يصف غير القابل للفحص بأنه سليم", () => {
    expect(motionAuditSummary(plan, report)).toEqual({ total: 2, analyzed: 2, warnings: 1, unassessable: 1 });
    const markdown = renderMotionAuditMarkdown(plan, report);
    expect(markdown).toContain("c1-s1");
    expect(markdown).toContain("مرساة غير موجودة");
    expect(markdown).toContain("c1-s2");
    expect(markdown).toContain("غير قابل للتقييم");
    expect(markdown).toContain("لا يجري تحليلًا دلاليًا");
  });
  it("يبطل صلاحية القياس عند تغيّر مدخلاته الفعلية لا مجرد وقت الحفظ", () => {
    const a = motionFingerprint(plan, media, { color: "green" }, { id: "balislam" });
    const b = motionFingerprint({ ...plan, updatedAt: "2026-11-04" }, media, { color: "green" }, { id: "balislam" });
    const c = motionFingerprint(plan, media, { color: "gold" }, { id: "balislam" });
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });
});
