import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { approveStoryboard } from "../src/plan/storyboard";
import { approveVoiceScene, approveVoiceEpisode } from "../src/voice/review";
import { assertMotionStartAuthorized } from "../src/voice/motionGate";
import type { Plan } from "../src/plan/types";

describe("pre-motion human approval safety", () => {
  it("requires separate storyboard and full-episode voice decisions, and rechecks audio bytes", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "studio-final-motion-gate-"));
    const scriptPath = path.join(dir, "script.md");
    const voiceDir = path.join(dir, "voice");
    const scene = { id: "c1-s1", template: "noor-text", line: 8,
      narration: "تعليق تجريبي", tone: "calm", sfx: [], props: { text: "اختبار المراجعة" } };
    const plan = { chapters: [{ number: 1, title: "الاختبار", scenes: [scene] }] } as unknown as Plan;
    const voice = { "c1-s1": { file: "clip.mp3", text: scene.narration,
      duration: 1.2, hash: "test-hash", words: [] } };
    try {
      await mkdir(voiceDir);
      await writeFile(scriptPath, `---
title: "اختبار"
domain: psychology
episode: "999"
---
## الفصل 1 · تجربة
نص تعليق دون آيات.
`);
      execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=430:duration=1.2",
        "-c:a", "libmp3lame", path.join(voiceDir, "clip.mp3")]);
      await expect(assertMotionStartAuthorized(scriptPath, plan, voice)).rejects.toThrow();
      await approveStoryboard(scriptPath, plan, { note: "راجعت اللوحة الاختبارية بصريًا قبل اعتماد الصوت الكامل" });
      await expect(assertMotionStartAuthorized(scriptPath, plan, voice)).rejects.toThrow(/اعتماد|الصوت/);
      await approveVoiceScene(scriptPath, plan, voice, "c1-s1", "مراجع", "استمعت للمقطع بعناية وراجعت مخارجه");
      await expect(assertMotionStartAuthorized(scriptPath, plan, voice)).rejects.toThrow(/الحلقة|كامل/);
      await approveVoiceEpisode(scriptPath, plan, voice, "مراجع", "استمعت إلى كل التسجيل بالترتيب الطبيعي وأوافق على بدء الحركة");
      await expect(assertMotionStartAuthorized(scriptPath, plan, voice)).resolves.toBe(true);
      await writeFile(path.join(voiceDir, "clip.mp3"), "BROKEN");
      await expect(assertMotionStartAuthorized(scriptPath, plan, voice)).rejects.toThrow();
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
