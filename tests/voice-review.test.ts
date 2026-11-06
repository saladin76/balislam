import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { approveVoiceScene, assertVoiceApproved, voiceReviewItems } from "../src/voice/review";
import type { Plan } from "../src/plan/types";

const sample = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "voice-reviewed-"));
  const scriptPath = path.join(dir, "script.md");
  await writeFile(scriptPath, "test");
  await mkdir(path.join(dir, "voice"));
  await writeFile(path.join(dir, "voice", "spoken.mp3"), "immutable-audio-1");
  const plan = { chapters: [{ number: 1, title: "sample", scenes: [{
    id: "c1-s1", template: "noor-text", line: 1, props: {}, narration: "النص المشكول", sfx: [], tone: "calm",
  }] }] } as Plan;
  const voice = { "c1-s1": { file: "spoken.mp3", text: "النص المشكول", hash: "voice-cache-v1", duration: 1.5, words: [] } };
  return { dir, scriptPath, plan, voice };
};

describe("human-approved, fingerprint-bound voice gate", () => {
  it("never auto-approves a stored MP3", async () => {
    const x = await sample();
    expect((await voiceReviewItems(x.scriptPath, x.plan, x.voice))[0]?.state).toBe("pending");
    await expect(assertVoiceApproved(x.scriptPath, x.plan, x.voice)).rejects.toThrow(/اعتماد/);
  });
  it("requires a reviewer and a meaningful note, then permits unchanged audio", async () => {
    const x = await sample();
    await expect(approveVoiceScene(x.scriptPath, x.plan, x.voice, "c1-s1", "", "")).rejects.toThrow();
    const items = await approveVoiceScene(x.scriptPath, x.plan, x.voice, "c1-s1", "المراجع", "سمعت المقطع كله وتم اعتماد النطق والنبرة");
    expect(items[0]?.state).toBe("approved");
    await expect(assertVoiceApproved(x.scriptPath, x.plan, x.voice)).resolves.toBe(true);
  });
  it("invalidates the file-bound approval after bytes change, even if name is unchanged", async () => {
    const x = await sample();
    await approveVoiceScene(x.scriptPath, x.plan, x.voice, "c1-s1", "المراجع", "سمعت المقطع كله وتم اعتماد النطق والنبرة");
    await writeFile(path.join(x.dir, "voice", "spoken.mp3"), "CHANGED AUDIO WITHOUT RENAMING");
    expect((await voiceReviewItems(x.scriptPath, x.plan, x.voice))[0]?.state).toBe("changed");
    await expect(assertVoiceApproved(x.scriptPath, x.plan, x.voice)).rejects.toThrow();
  });
  it("invalidates the review after tone or script change", async () => {
    const x = await sample();
    await approveVoiceScene(x.scriptPath, x.plan, x.voice, "c1-s1", "المراجع", "سمعت المقطع كله وتم اعتماد النطق والنبرة");
    x.plan.chapters[0]!.scenes[0]!.tone = "dramatic";
    expect((await voiceReviewItems(x.scriptPath, x.plan, x.voice))[0]?.state).toBe("changed");
    x.plan.chapters[0]!.scenes[0]!.tone = "calm";
    x.plan.chapters[0]!.scenes[0]!.narration = "نص آخر";
    expect((await voiceReviewItems(x.scriptPath, x.plan, x.voice))[0]?.state).toBe("missing_audio");
  });
  it("requires explicit tone and rejects unsafe voice file paths", async () => {
    const x = await sample();
    x.plan.chapters[0]!.scenes[0]!.tone = undefined;
    expect((await voiceReviewItems(x.scriptPath, x.plan, x.voice))[0]?.state).toBe("needs_tone");
    x.plan.chapters[0]!.scenes[0]!.tone = "calm";
    x.voice["c1-s1"]!.file = "../stolen.mp3";
    expect((await voiceReviewItems(x.scriptPath, x.plan, x.voice))[0]?.state).toBe("missing_audio");
  });
});
