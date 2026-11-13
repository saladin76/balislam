/**
 * KI-054 (D121): a plan error that the final file would refuse — a documentary plate with no picture, or a template
 * that is not in the channel's library — is known from the plan itself, so it is said in step ١ «قبل أن تعتمد» and in
 * the preparation read, named per scene, instead of first at «اصنع النسخة النهائية». It never weakens a gate: the
 * Master still refuses exactly as before (planIssues is unchanged), and the preparation approval is not refused for it.
 */
import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { earlyPlanErrors, planIssues } from "../src/plan/validate";
import { PlanErrorsItem } from "../app/src/shell/EpisodeSpine";
import type { Plan } from "../src/plan/types";

const root = path.join(import.meta.dirname, "..");
const channel = JSON.parse(readFileSync(path.join(root, "channels", "dafatir-alzaman", "channel.json"), "utf8"));

const plan = (scenes: { id: string; template: string; props?: Record<string, string> }[]): Plan => ({
  episode: "952", title: "اختبار", channel: "dafatir-alzaman",
  chapters: [{ number: 1, title: "فصل", scenes: scenes.map((s) => ({ narration: "مرّت القوافل بالسوق.", props: {}, ...s })) }],
} as unknown as Plan);

describe("KI-054 · plan errors known from the plan are said early, per scene", () => {
  it("a plate with no picture and a template from outside the library are named with their scene", () => {
    const p = plan([
      { id: "c1-s1", template: "doc-plate", props: { image: "media/c1-s1.png" } },
      { id: "c1-s2", template: "doc-plate" },
      { id: "c1-s3", template: "kinetic-text" },
    ]);
    const early = earlyPlanErrors(p, channel);
    expect(early.map((e) => e.scene)).toEqual(["c1-s2", "c1-s3"]);
    expect(early[0]!.message).toContain("لوحة وثائقية بلا صورة");
    expect(early[1]!.message).toContain("ليس من مكتبة هذه القناة");
    // The same errors still stop the final file: nothing about the Master gate changed.
    const master = planIssues(p, channel).filter((i) => i.level === "error").map((i) => i.message);
    for (const e of early) expect(master).toContain(e.message);
  });
  it("a plan without those errors says nothing", () => {
    expect(earlyPlanErrors(plan([{ id: "c1-s1", template: "doc-plate", props: { image: "media/c1-s1.png" } }]), channel)).toEqual([]);
  });

  it("the preparation read carries them, and «اعتمد التجهيز» is not refused for them", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "ki054-"));
    const env = { channels: process.env.BAL_CHANNELS_DIR, key: process.env.BAL_WORKFLOW_HMAC_KEY };
    process.env.BAL_CHANNELS_DIR = tmp;
    process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__ki054_key_2026";
    try {
      await mkdir(path.join(tmp, "dafatir-alzaman", "episodes"), { recursive: true });
      for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json", "pronunciations.json"])
        await copyFile(path.join(root, "channels", "dafatir-alzaman", f), path.join(tmp, "dafatir-alzaman", f));
      const dir = path.join(tmp, "dafatir-alzaman", "episodes", "952-e2e-journey");
      await mkdir(dir, { recursive: true });
      const fx = path.join(root, "tests", "fixtures", "e2e", "dafatir-alzaman");
      // The journey's script, with its scenes as a new episode has them (no «[مشهد: …]»: documentary plates), and one
      // naming a template from another channel's library.
      const script = readFileSync(path.join(fx, "script.md"), "utf8").split("[مشهد: big-question]");
      expect(script.length).toBe(4);
      await writeFile(path.join(dir, "script.md"), script[0]! + "[مشهد: kinetic-text]" + script.slice(1).join(""));
      for (const f of ["research.md", "tashkeel.md"]) await copyFile(path.join(fx, f), path.join(dir, f));
      const { runWithChannel } = await import("../src/channel");
      await runWithChannel("dafatir-alzaman", async () => {
        const { regeneratePlan } = await import("../src/plan/io");
        const built = await regeneratePlan("952");
        // The three narrated scenes (the channel's closing card follows them and is not a plate).
        const scenes = built.chapters.flatMap((c) => c.scenes).filter((s) => ["c1-s1", "c1-s2", "c1-s3"].includes(s.id));
        expect(scenes.map((s) => s.template)).toEqual(["kinetic-text", "doc-plate", "doc-plate"]);
        const { preparationBlockers } = await import("../src/studio/preparation");
        const b = await preparationBlockers("952");
        expect(b.planErrors.map((e) => e.scene)).toEqual(scenes.map((s) => s.id));
        expect(b.planErrors[0]!.message).toContain("«kinetic-text» ليس من مكتبة هذه القناة");
        expect(b.planErrors[1]!.message).toContain("لوحة وثائقية بلا صورة");
        // The owner uploads the picture: that scene leaves the list.
        const { writePlanFile, planPathFor } = await import("../src/plan/io");
        scenes[1]!.props.image = "media/c1-s2.png";
        await writePlanFile(planPathFor(path.join(dir, "script.md")), built);
        expect((await preparationBlockers("952")).planErrors.map((e) => e.scene)).toEqual([scenes[0]!.id, scenes[2]!.id]);
        // Informative in step ١: the approval's own refusals are unchanged.
        expect(readFileSync(path.join(root, "src", "studio", "preparation.ts"), "utf8")).not.toMatch(/blockers\.planErrors\.length\)\s*throw/);
      });
    } finally {
      if (env.channels === undefined) delete process.env.BAL_CHANNELS_DIR; else process.env.BAL_CHANNELS_DIR = env.channels;
      if (env.key === undefined) delete process.env.BAL_WORKFLOW_HMAC_KEY; else process.env.BAL_WORKFLOW_HMAC_KEY = env.key;
      await rm(tmp, { recursive: true, force: true });
    }
  }, 120_000);

  it("«قبل أن تعتمد» lists each affected scene with its reason, and says it stops the final file", () => {
    const html = renderToStaticMarkup(<PlanErrorsItem order={["c1-s1", "c1-s2", "c1-s3"]}
      errors={[{ scene: "c1-s2", message: "لوحة وثائقية بلا صورة: ولّد الصورة من الوصف وارفعها من إعدادات المشهد." },
        { scene: "c1-s3", message: "القالب «kinetic-text» ليس من مكتبة هذه القناة (خاص بقناة أخرى)." }]} />);
    expect(html).toContain("تمنع النسخة النهائية");
    expect(html).toContain("المشهد ٢");
    expect(html).toContain("لوحة وثائقية بلا صورة");
    expect(html).toContain("المشهد ٣");
    expect(html).toContain("ليس من مكتبة هذه القناة");
    expect(renderToStaticMarkup(<PlanErrorsItem order={[]} errors={[]} />)).toBe("");
  });
});
