/**
 * بنود «الحِرفة» في بطاقة الجودة (قرار المالك ٢٢ نوفمبر): تُقاس من الخطة، و«للعلم» لا تمنع حتى يحدد المالك حدودها.
 */
import { describe, expect, it } from "vitest";
import type { Plan, PlanScene } from "../src/plan/types";
import { measureCraft } from "../src/studio/quality/craft";
import { buildCard, craftItems } from "../src/studio/quality/card";

const sc = (id: string, props: Record<string, unknown>, extra: Partial<PlanScene> = {}): PlanScene =>
  ({ id, template: "set-scene", narration: "x", line: 0, props, sfx: [], durationSec: 20, ...extra });
const plan = (...scenes: PlanScene[]): Plan => ({ version: 1, episode: "001", title: "t", domain: "faith" as Plan["domain"], themeId: "x" as Plan["themeId"], updatedAt: "", chapters: [{ number: 1, title: "", scenes }] });

describe("بنود الحِرفة", () => {
  it("حركة الكاميرا، وأحجام اللقطات في الدقيقة، والمؤثرات مع الحركة، وتكرار اللقطة", () => {
    const p = plan(
      sc("a", { camera: "push-in", shotSize: "wide", place: "souq" }, { sfx: [{ id: "page-turn", at: 0 }, { id: "wind", at: 0 }] }),
      sc("b", { camera: "static", shotSize: "close", place: "souq" }),
      sc("c", { shot: "astrolabe", shotSize: "detail" }, { sfx: [{ id: "stamp", at: 1 }] }),
      sc("v", {}, { template: "verse-card" }),
    );
    const r = measureCraft(p);
    expect([r.scenes, r.cameraMoving, r.sizesDeclared, r.syncedSfx]).toEqual([3, 2, 3, 2]);
    // ٦٠ ث: الدقيقة الأولى فيها wide وclose وdetail
    expect(r.sizesPerMinute).toBe(3);
    expect(measureCraft(plan(sc("x", { place: "a" }), sc("y", { place: "a" }))).repeatedShots).toEqual([{ key: expect.any(String), scenes: ["x", "y"] }]);
  });
  it("لا تمنع شيئًا: «للعلم» أو ✓، والقالب الذي لا يعلن حجمه يقول ذلك", () => {
    const items = craftItems(plan(sc("a", {}), sc("b", { camera: "pan" })));
    expect(items.every((i) => i.status === "warn" || i.status === "pass")).toBe(true);
    expect(items.find((i) => i.id === "craft-sizes")!.reason).toContain("shotSize");
    const card = buildCard({ target: "assembly", plan: plan(sc("a", {})), measured: null });
    expect(card.sections.map((s) => s.id)).toContain("craft");
    expect(card.blockers.some((b) => b.startsWith("الحِرفة"))).toBe(false);
  });
  it("كل مشهد متحرك وبلا تكرار: ✓", () => {
    const items = craftItems(plan(sc("a", { camera: "pan", place: "a" }), sc("b", { camera: "tilt", place: "b" })));
    expect(items.filter((i) => ["craft-camera", "craft-repeat"].includes(i.id)).map((i) => i.status)).toEqual(["pass", "pass"]);
  });
});
