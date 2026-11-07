import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { approveStoryboard, loadStoryboard, storyboardStatus } from "../src/plan/storyboard";
import { checkVisualStoryboardSignoff } from "../src/plan/storyboardVisualGate";
import { approveVoiceScene, approveVoiceEpisode, assertVoiceApproved, voiceReviewItems } from "../src/voice/review";
import type { Plan } from "../src/plan/types";
import { voiceTimingMode } from "../src/render/episode";
import type { EpisodeMedia } from "../src/plan/media";

const build = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-release-stages-"));
  const scriptPath = path.join(root, "script.md");
  await writeFile(scriptPath, "synthetic test fixture");
  await mkdir(path.join(root, "voice"));
  await writeFile(path.join(root, "voice", "c1-s1.mp3"), "FAKE MP3 BYTES - TEST ONLY");
  const scene = { id: "c1-s1", line: 1, template: "noor-text",
    narration: "نص مشهد اختباري", tone: "documentary", props: { text: "عنوان اللوحة" }, sfx: [] };
  const plan = { episode: "001-test", title: "approval fixture", chapters: [{ number: 1, title: "test", scenes: [scene] }] } as unknown as Plan;
  const voice = { "c1-s1": { file: "c1-s1.mp3", hash: "synthetic-v1", text: scene.narration, duration: 1.2, words: [] } };
  return { root, scriptPath, plan, scene, voice };
};

describe("Studio release candidate: visual → tone → approved audio", () => {
  it("keeps approved visual boards after tone selection, but invalidates MP3 approval on byte changes", async () => {
    const x = await build();
    const media: EpisodeMedia = { mode: "url", base: "", voice: x.voice, sfx: [], recitations: {} };
    expect(await voiceTimingMode(x.scriptPath, x.plan, media)).toBe("estimated");
    await approveStoryboard(x.scriptPath, x.plan, { note: "تمت مراجعة اللوحة الاختبارية، وهذا اعتماد تجريبي فقط" });
    expect(storyboardStatus(x.plan, await loadStoryboard(x.scriptPath)).ok).toBe(true);
    expect((await voiceReviewItems(x.scriptPath, x.plan, x.voice))[0]?.state).toBe("pending");
    await expect(assertVoiceApproved(x.scriptPath, x.plan, x.voice)).rejects.toThrow();
    x.scene.tone = "warm";
    // Tone is decided AFTER visual signoff; it must not invalidate the picture.
    expect(storyboardStatus(x.plan, await loadStoryboard(x.scriptPath)).ok).toBe(true);
    await approveVoiceScene(x.scriptPath, x.plan, x.voice, "c1-s1", "اختبار", "سمعت المقطع كله وتأكدت من لفظه ونبرته");
    expect(await voiceTimingMode(x.scriptPath, x.plan, media)).toBe("estimated");
    await expect(assertVoiceApproved(x.scriptPath, x.plan, x.voice)).rejects.toThrow(/الحلقة|التعليق الصوتي كامل/);
    await approveVoiceEpisode(x.scriptPath, x.plan, x.voice, "اختبار", "استمعت إلى النسخة الصوتية كاملة وتأكدت من سلامة الانتقالات");
    await expect(assertVoiceApproved(x.scriptPath, x.plan, x.voice)).resolves.toBe(true);
    expect(await voiceTimingMode(x.scriptPath, x.plan, media)).toBe("approved");
    await writeFile(path.join(x.root, "voice", "c1-s1.mp3"), "CHANGED AUDIO BYTES");
    expect((await voiceReviewItems(x.scriptPath, x.plan, x.voice))[0]?.state).toBe("changed");
    expect(await voiceTimingMode(x.scriptPath, x.plan, media)).toBe("estimated");
    await expect(assertVoiceApproved(x.scriptPath, x.plan, x.voice)).rejects.toThrow();
    x.scene.narration = "نص جديد مختلف";
    expect(storyboardStatus(x.plan, await loadStoryboard(x.scriptPath)).ok).toBe(false);
  });

  it("never approves an illustrated scene with missing Quran text or without human note", async () => {
    const x = await build();
    x.plan.chapters[0]!.scenes[0]!.template = "verse-card";
    x.plan.chapters[0]!.scenes[0]!.ayahKey = "2:30";
    x.plan.chapters[0]!.scenes[0]!.props.text = "";
    expect(checkVisualStoryboardSignoff(x.plan, "تم فحص جميع اللوحات ومراجعة إصداراتها تفصيليًا").ok).toBe(false);
    await expect(approveStoryboard(x.scriptPath, x.plan)).rejects.toThrow(/آية/);
  });
});
