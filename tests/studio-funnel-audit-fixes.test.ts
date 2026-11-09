/** Fixes from the full-funnel walkthrough of 8 November (docs/studio/funnel-audit-20261108.md). */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ownerMessage } from "../app/src/serverMessages";
import { lockOwnerIsDead } from "../src/studio/sceneService";

const src = (f: string) => readFileSync(path.join(import.meta.dirname, "..", f), "utf8");

describe("رسائل الخادم للمالك بالعربية", () => {
  it("الرسائل الإنجليزية المعروفة تُعرض بالعربية مع ما يفعله المالك", () => {
    expect(ownerMessage("Storyboard changed before review.")).toMatch(/تغيّر الستوري بورد/);
    expect(ownerMessage("Review and approve every current storyboard scene with a review note before starting AV production."))
      .toMatch(/سجل مراجعة اللوحات/);
    expect(ownerMessage("Scene approval ledger is busy. Never delete another writer lock.")).toMatch(/مشغول/);
    expect(ownerMessage("Scene c1-s2 has changed after audiovisual approval.")).toBe("تغيّر المشهد c1-s2 بعد اعتماده؛ يحتاج إنتاجًا واعتمادًا جديدين.");
    expect(ownerMessage("c6-end: AV/Master review requires a playable video with an audio track, valid duration and required resolution."))
      .toMatch(/^c6-end: الفيديو غير صالح للمراجعة/);
  });
  it("الرسائل غير المعروفة والعربية تمر كما هي", () => {
    expect(ownerMessage("حدّد نبرة كل مقطع")).toBe("حدّد نبرة كل مقطع");
    expect(ownerMessage("Something new")).toBe("Something new");
  });
  it("كل طلب في الواجهة يمر بالترجمة", () => {
    expect(src("app/src/api.ts")).toContain("throw new Error(ownerMessage(");
  });
});

describe("قفل سجل الاعتمادات بعد توقف الاستوديو", () => {
  it("يُسترد قفل عملية ميتة فقط، ولا يُلمس قفل عملية حية أو قفل قديم الصيغة", () => {
    const dead = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"]).stdout.toString();
    const uuid = "a2001769-2f0b-4265-ac82-6171d3e5a6cc";
    expect(lockOwnerIsDead(`${dead} ${uuid}`)).toBe(true);
    expect(lockOwnerIsDead(`${process.pid} ${uuid}`)).toBe(false); // this process: a live writer
    expect(lockOwnerIsDead(`${process.ppid} ${uuid}`)).toBe(false); // another live process
    expect(lockOwnerIsDead(uuid)).toBe(false); // legacy lock: never deleted automatically
    expect(lockOwnerIsDead("")).toBe(false); // being written right now
    expect(lockOwnerIsDead(null)).toBe(false);
  });
});

describe("مسار الخطوات ٢–٤", () => {
  it("قرار المالك يعيد نموذج القراءة كاملًا (لا تنهار شاشة المشاهد بعد «الحركة غير مناسبة» أو «اعتمد»)", () => {
    const api = src("app/server/api.ts");
    // Between the decision and the answer only the D53 Drive handoff start (after «إذن النشر») may run.
    expect(api).toMatch(/await decideSceneProduction\(ep, body, req\.headers\["x-studio-owner-token"\]\);\s*(?:\/\/[^\n]*\n\s*)*(?:if \(body\?\.action === "grant-publish"\) \{\n(?:[^\n]*\n){2}\s*\}\n\s*)?\/\/[^\n]*\n[^\n]*\n\s*return send\(res, 200, await withSeamTimes\(await inspectSceneProduction\(ep\)\)\);/);
    const panel = src("app/src/workspace/SceneProductionPanel.tsx");
    expect(panel).not.toContain("setData(updated)");
    expect(panel).toContain("data?.candidates?.scenes[currentId]");
  });
  it("مشهد بلا تعليق (الخاتمة) يُرندر بمسار صوت صامت فيقبله فحص AV والتجميع", () => {
    expect(src("src/render/episode.ts")).toContain("enforceAudioTrack: true");
  });
  it("«راجعته بنفسي» لا تنتقل من السكريبت إلى الستوري بورد، والحالة تُقرأ من جديد بعد الرفض", () => {
    const spine = src("app/src/shell/EpisodeSpine.tsx");
    expect(spine).toContain("useEffect(() => setReviewed(false), [decideTarget]);");
    expect(spine).toMatch(/setErr\(\(e as Error\)\.message\);\s*\/\/[^\n]*\n\s*setTick/);
    expect(src("app/src/App.tsx")).toContain("onSigned={() => setHomeKey((k) => k + 1)}");
  });
  it("التجميع بضغطة واحدة من المشاهد المعتمدة: لا يُسجَّل ملف قديم في المسار نفسه", () => {
    const panel = src("app/src/workspace/SceneProductionPanel.tsx");
    expect(panel).not.toContain("تسجيل النسخة المجمعة للمراجعة");
    expect(panel).toContain("دمج المشاهد للمراجعة");
    expect(panel).toMatch(/assembleSceneAv\([^)]*\);[\s\S]{0,400}action: "assemble", expectedSha256: built/);
  });
});
