import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runWithChannel } from "../src/channel";
import { approveStoryboard } from "../src/plan/storyboard";
import type { Plan } from "../src/plan/types";
import { decideSceneProduction, inspectSceneProduction } from "../src/studio/sceneService";
import { assertMotionStartAuthorized } from "../src/voice/motionGate";
import { assertWorkflowForEpisode } from "../src/workflow/server";

/**
 * Unified engine: the scene-first ledger is the ONLY human-approval authority for final motion.
 * Legacy script signoff / episode voice approval files neither grant nor block anything.
 */
describe("final motion asks the scene-first ledger only", () => {
  it("blocks until the owner approves script and storyboard in «إنتاج المشاهد», then passes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "final-motion-gate-"));
    const env = { channels: process.env.BAL_CHANNELS_DIR, key: process.env.BAL_WORKFLOW_HMAC_KEY, pass: process.env.BAL_STUDIO_OWNER_PASSPHRASE_SHA256 };
    const passphrase = "owner-test-passphrase-2026";
    process.env.BAL_CHANNELS_DIR = root;
    process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__final_motion_gate_signing_key_2026";
    process.env.BAL_STUDIO_OWNER_PASSPHRASE_SHA256 = createHash("sha256").update(passphrase).digest("hex");
    try {
      const dir = path.join(root, "balislam", "episodes", "001-gate");
      await mkdir(dir, { recursive: true });
      const scriptPath = path.join(dir, "script.md");
      await writeFile(scriptPath, `---\ntitle: "اختبار"\ndomain: psychology\nepisode: "001"\n---\n## الفصل 1 · تجربة\nنص تعليق دون آيات.\n`);
      const scene = { id: "c1-s1", template: "noor-text", line: 8, narration: "", sfx: [], props: { text: "اختبار" } };
      const plan = { episode: "001", title: "اختبار", chapters: [{ number: 1, title: "تجربة", scenes: [scene] }] } as unknown as Plan;
      await writeFile(path.join(dir, "plan.json"), JSON.stringify(plan));
      await runWithChannel("balislam", async () => {
        await expect(assertMotionStartAuthorized("001", scriptPath)).rejects.toThrow(/اعتمد السكريبت/);
        await expect(assertWorkflowForEpisode("001", "master_render")).rejects.toThrow();
        const state = await inspectSceneProduction("001");
        await expect(decideSceneProduction("001", { action: "approve-script", expectedSha256: state.script.sha256 }, "wrong"))
          .rejects.toThrow(/authentication/);
        await decideSceneProduction("001", { action: "approve-script", expectedSha256: state.script.sha256 }, passphrase);
        await expect(assertMotionStartAuthorized("001", scriptPath)).rejects.toThrow(/الستوري بورد/);
        await approveStoryboard(scriptPath, plan, { note: "راجعت اللوحة الاختبارية بصريًا قبل بدء الحركة" });
        const board = await inspectSceneProduction("001");
        await decideSceneProduction("001", { action: "approve-storyboard", expectedSha256: board.storyboard.sha256 }, passphrase);
        await expect(assertMotionStartAuthorized("001", scriptPath)).resolves.toBe(true);
        // Master still needs every scene approved with sound and picture, then the assembly.
        await expect(assertWorkflowForEpisode("001", "master_render")).rejects.toThrow(/approved/);
        // Editing the script re-opens the decision; old approvals never come back.
        await writeFile(scriptPath, `---\ntitle: "اختبار"\ndomain: psychology\nepisode: "001"\n---\n## الفصل 1 · تجربة\nنص معدّل.\n`);
        await expect(assertMotionStartAuthorized("001", scriptPath)).rejects.toThrow(/اعتمد السكريبت/);
      });
    } finally {
      for (const [k, v] of [["BAL_CHANNELS_DIR", env.channels], ["BAL_WORKFLOW_HMAC_KEY", env.key], ["BAL_STUDIO_OWNER_PASSPHRASE_SHA256", env.pass]] as const)
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
      await rm(root, { recursive: true, force: true });
    }
  }, 30000);
});
