/**
 * End-to-end funnel QA fixes (10 Nov 2026): M1 tone before preparation, M2 a refused «اعتمد التجهيز» stays
 * visible, M3 failures expire, and shared scene names on the server.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { currentPrepareView } from "../src/studio/prepareAll";
import { scenesWithoutTone } from "../src/studio/preparation";
import { nameSceneIds, planOrder, sceneNames } from "../src/i18n/sceneNames";
import type { Plan } from "../src/plan/types";

const src = (f: string) => readFileSync(path.join(import.meta.dirname, "..", f), "utf8");
const order = ["c1-s1", "c1-s2", "c1-s3", "c2-s1"];

describe("scene names on the server (shared formatter)", () => {
  it("names known ids as the Studio numbers them, seams too, and leaves unknown ids", () => {
    expect(nameSceneIds("تعذّر c1-s3: خطأ", order)).toBe("تعذّر المشهد ٣: خطأ");
    expect(nameSceneIds("الوصلة c1-s2>c1-s3", order)).toBe("الوصلة المشهد ٢ ← ٣");
    expect(nameSceneIds("c9-s9 مجهول", order)).toBe("c9-s9 مجهول");
    expect(sceneNames(order, ["c2-s1", "c1-s1"])).toBe("المشهد ٤، المشهد ١");
  });
  it("the app re-exports the same implementation", () => {
    expect(src("app/src/workspace/sceneNames.ts")).toContain('from "../../../src/i18n/sceneNames"');
  });
});

describe("M1: no tone for the episode is said before preparing", () => {
  const plan = (tone?: string) => ({ tone, chapters: [{ number: 1, title: "x", scenes: [
    { id: "c1-s1", template: "big-question", narration: "نص", props: {}, sfx: [] },
    { id: "c1-s2", template: "verse-card", narration: "", props: {}, sfx: [] },
    { id: "c1-s3", template: "big-question", narration: "نص آخر", tone: "calm", props: {}, sfx: [] },
  ] }] }) as unknown as Plan;
  it("lists narrated scenes without any tone; the episode or channel tone covers them", () => {
    expect(scenesWithoutTone(plan())).toEqual(["c1-s1"]);
    expect(scenesWithoutTone(plan("calm"))).toEqual([]);
    expect(scenesWithoutTone(plan(), "calm")).toEqual([]);
    expect(planOrder(plan())).toEqual(["c1-s1", "c1-s2", "c1-s3"]);
  });
  it("step ١ offers «لا نبرة للحلقة — اخترها هنا»; a finished run with errors offers «استأنف التجهيز»", () => {
    const prep = src("app/src/workspace/PrepareAll.tsx");
    expect(prep).toContain("لا نبرة للحلقة");
    expect(prep).toContain("اخترها هنا");
    expect(prep).toMatch(/finishedWithErrors = Boolean\(job && job\.status === "done"/);
    expect(prep).toContain('job.status === "error" || finishedWithErrors');
    expect(src("app/src/shell/EpisodeSpine.tsx")).toContain("prep?.toneMissing?.length");
    expect(src("src/voice/generate.ts")).toContain("sceneNames(planOrder(plan), report.missingTones, 12)");
  });
});

describe("M2: a refused «اعتمد التجهيز» stays visible; saving the script refreshes step ١", () => {
  it("the ledger re-read after a refusal does not clear the error", () => {
    const spine = src("app/src/shell/EpisodeSpine.tsx");
    expect(spine).toContain("if (!keepErr.current) setErr(\"\")");
    expect(spine).toMatch(/setErr\(\(e as Error\)\.message\);\s*keepErr\.current = true;/);
    expect(src("app/src/App.tsx")).toMatch(/setPlanState\("saved"\);[\s\S]{0,300}setHomeKey\(\(k\) => k \+ 1\);\s*api\.episode\(epId\)/);
  });
});

describe("M3: failures expire when the scene succeeds or its inputs change", () => {
  const scenes = [
    { id: "c1-s1", status: "queued", sourceSha256: "a", draft: "ready" },
    { id: "c1-s2", status: "queued", sourceSha256: "b2" },
    { id: "c1-s3", status: "queued", sourceSha256: "c" },
    { id: "c1-s4", status: "approved", sourceSha256: "d" },
  ];
  it("drops stale «تعذّر» entries and names scenes in the messages", () => {
    const job = {
      failed: [
        { id: "c1-s1", error: "x", sourceSha256: "a" }, // drafted since
        { id: "c1-s2", error: "x", sourceSha256: "b1" }, // inputs changed
        { id: "c1-s3", error: "تعذّر c1-s3", sourceSha256: "c" }, // still failing
        { id: "c1-s4", error: "x", sourceSha256: "d" }, // approved since
      ],
      skipped: [{ id: "c1-s2", reason: "failed-before" as const, error: "x", sourceSha256: "b1" },
        { id: "c1-s3", reason: "voice" as const }],
      voice: { error: "حدّد نبرة c1-s2" },
    };
    const v = currentPrepareView(job, scenes);
    expect(v.failed).toEqual([{ id: "c1-s3", error: "تعذّر المشهد ٣", sourceSha256: "c" }]);
    expect(v.skipped).toEqual([{ id: "c1-s3", reason: "voice" }]);
    expect(v.voice.error).toBe("حدّد نبرة المشهد ٢");
  });
  it("the owner's «استأنف التجهيز» retries previous failures; an automatic start does not", () => {
    const api = src("app/server/api.ts");
    expect(api).toContain("opts.retryFailed ? [] : prepareJob(key)?.failed ?? []");
    expect(api).toContain("await startPrepare({ retryFailed: true })");
  });
});
