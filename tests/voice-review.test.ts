import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { approveVoiceScene, approveVoiceEpisode, assertVoiceApproved, voiceReviewItems, episodeVoiceApproved } from "../src/voice/review";
import type { Plan } from "../src/plan/types";

const ownedVoiceReviewDirs: string[] = [];
afterEach(async () => { for (const d of ownedVoiceReviewDirs.splice(0)) await rm(d, { recursive:true, force:true }); });
const sample = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "voice-reviewed-"));
  ownedVoiceReviewDirs.push(dir);
  const scriptPath = path.join(dir, "script.md");
  await writeFile(scriptPath, "test");
  await mkdir(path.join(dir, "voice"));
  execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=400:duration=1.2", "-c:a", "libmp3lame", path.join(dir, "voice", "spoken.mp3")]);
  const plan = { chapters: [{ number: 1, title: "sample", scenes: [{
    id: "c1-s1", template: "noor-text", line: 1, props: {}, narration: "النص المشكول", sfx: [], tone: "calm",
  }] }] } as unknown as Plan;
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
    await expect(assertVoiceApproved(x.scriptPath, x.plan, x.voice)).rejects.toThrow(/الحلقة|التعليق الصوتي كامل/);
    await approveVoiceEpisode(x.scriptPath, x.plan, x.voice, "المراجع", "استمعت للحلقة الصوتية كاملة وتأكدت من الاستمرارية والوقفات");
    expect(await episodeVoiceApproved(x.scriptPath, x.plan, x.voice)).toBe(true);
    await expect(assertVoiceApproved(x.scriptPath, x.plan, x.voice)).resolves.toBe(true);
  });
  it("full episode signoff is invalidated when a new clip is approved or a recording changes", async () => {
    const x = await sample();
    await approveVoiceScene(x.scriptPath, x.plan, x.voice, "c1-s1", "المراجع", "تم الاستماع إلى المقطع والتحقق من نطقه");
    await approveVoiceEpisode(x.scriptPath, x.plan, x.voice, "المراجع", "استمعت للتعليق كاملًا دون توقف وراجعت الانتقالات");
    expect(await episodeVoiceApproved(x.scriptPath, x.plan, x.voice)).toBe(true);
    await writeFile(path.join(x.dir, "voice", "spoken.mp3"), "CHANGED");
    expect(await episodeVoiceApproved(x.scriptPath, x.plan, x.voice)).toBe(false);
  });
  it("invalidates the file-bound approval after bytes change, even if name is unchanged", async () => {
    const x = await sample();
    await approveVoiceScene(x.scriptPath, x.plan, x.voice, "c1-s1", "المراجع", "سمعت المقطع كله وتم اعتماد النطق والنبرة");
    await writeFile(path.join(x.dir, "voice", "spoken.mp3"), "CHANGED AUDIO WITHOUT RENAMING");
    expect((await voiceReviewItems(x.scriptPath, x.plan, x.voice))[0]?.state).toBe("missing_audio");
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
