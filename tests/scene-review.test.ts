import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadSceneLedger, sceneReviewItems, sceneReviewSummary, setSceneReview } from "../src/plan/sceneReview";
import type { Plan } from "../src/plan/types";

const ownedSceneDirs: string[] = [];
const sceneFixture = () => { const d=mkdtempSync(path.join(os.tmpdir(), "sr-")); ownedSceneDirs.push(d); return path.join(d, "script.md"); };
afterEach(() => { for (const d of ownedSceneDirs.splice(0)) rmSync(d, { recursive:true, force:true }); });

const plan = (text = "نص المشهد الأول"): Plan =>
  ({ episode: "001", title: "t", chapters: [{ number: 1, title: "x", scenes: [{ id: "c1-s1", template: "motion-story", narration: text, props: { beats: "| كلمة" } }, { id: "c1-s2", template: "kinetic-text", narration: "نص ثان", props: {} }] }] }) as unknown as Plan;

describe("مراجعة المشاهد بعد تنفيذها", () => {
  it("كل المشاهد تبدأ بلا مراجعة، والنسخة النهائية بعد «سليم» للكل", async () => {
    const file = sceneFixture();
    let items = sceneReviewItems(plan(), await loadSceneLedger(file));
    expect(sceneReviewSummary(items).done).toBe(false);
    for (const i of items) items = await setSceneReview(file, plan(), i.id, "ok");
    expect(sceneReviewSummary(items).done).toBe(true);
  });
  it("تعديل المشهد بعد مراجعته يعيده «تغيّر بعد المراجعة»", async () => {
    const file = sceneFixture();
    for (const i of sceneReviewItems(plan(), null)) await setSceneReview(file, plan(), i.id, "ok");
    const after = sceneReviewItems(plan("نص معدّل"), await loadSceneLedger(file));
    expect(after.find((i) => i.id === "c1-s1")?.status).toBe("changed");
    expect(after.find((i) => i.id === "c1-s2")?.status).toBe("ok");
  });
  it("«يحتاج إصلاحًا» يتطلب وصف المشكلة", async () => {
    const file = sceneFixture();
    await expect(setSceneReview(file, plan(), "c1-s1", "fix")).rejects.toThrow("إصلاح");
    const items = await setSceneReview(file, plan(), "c1-s1", "fix", "الأيقونة تظهر قبل نطق كلمتها");
    expect(items[0]!.status).toBe("fix");
  });
});
