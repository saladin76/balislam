import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runWithChannel } from "../src/channel";
import { approveStoryboard } from "../src/plan/storyboard";
import type { Plan } from "../src/plan/types";
import { decideSceneProduction, inspectSceneProduction } from "../src/studio/sceneService";
import { runOwnerRequest } from "../src/studio/ownerContext";
import { assertMotionStartAuthorized } from "../src/voice/motionGate";
import { assertWorkflowForEpisode } from "../src/workflow/server";

/** Owner decision (9 Nov): no passphrase. A Studio request from another address or another site is refused. */
const asRemote = <T,>(fn: () => T) => runOwnerRequest({ remoteAddress: "192.168.1.20", sameOrigin: true, host: "127.0.0.1:4321" }, fn);

/**
 * Unified engine: the scene-first ledger is the ONLY human-approval authority for final motion.
 * Legacy script signoff / episode voice approval files neither grant nor block anything.
 */
describe("final motion asks the scene-first ledger only", () => {
  it("blocks until the owner approves script and storyboard in «إنتاج المشاهد», then passes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "final-motion-gate-"));
    const env = { channels: process.env.BAL_CHANNELS_DIR, key: process.env.BAL_WORKFLOW_HMAC_KEY };
    process.env.BAL_CHANNELS_DIR = root;
    process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__final_motion_gate_signing_key_2026";
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
        await expect(asRemote(() => decideSceneProduction("001", { action: "approve-script", expectedSha256: state.script.sha256 })))
          .rejects.toThrow(/only from the Studio/);
        await decideSceneProduction("001", { action: "approve-script", expectedSha256: state.script.sha256 });
        await expect(assertMotionStartAuthorized("001", scriptPath)).rejects.toThrow(/الستوري بورد/);
        await approveStoryboard(scriptPath, plan, { note: "راجعت اللوحة الاختبارية بصريًا قبل بدء الحركة" });
        const board = await inspectSceneProduction("001");
        await decideSceneProduction("001", { action: "approve-storyboard", expectedSha256: board.storyboard.sha256 });
        await expect(assertMotionStartAuthorized("001", scriptPath)).resolves.toBe(true);
        // Master still needs every scene approved with sound and picture, then the assembly.
        await expect(assertWorkflowForEpisode("001", "master_render")).rejects.toThrow(/approved/);
        // Editing the script re-opens the decision; old approvals never come back.
        await writeFile(scriptPath, `---\ntitle: "اختبار"\ndomain: psychology\nepisode: "001"\n---\n## الفصل 1 · تجربة\nنص معدّل.\n`);
        await expect(assertMotionStartAuthorized("001", scriptPath)).rejects.toThrow(/اعتمد السكريبت/);
      });
    } finally {
      for (const [k, v] of [["BAL_CHANNELS_DIR", env.channels], ["BAL_WORKFLOW_HMAC_KEY", env.key]] as const)
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
      await rm(root, { recursive: true, force: true });
    }
  }, 30000);
});
