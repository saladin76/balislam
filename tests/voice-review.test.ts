import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, open, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { approveVoiceScene, approveVoiceEpisode, assertVoiceApproved, voiceReviewItems, episodeVoiceApproved } from "../src/voice/review";
import type { Plan } from "../src/plan/types";

const owned: string[] = [];
afterEach(async () => { for (const dir of owned.splice(0)) await rm(dir, { recursive: true, force: true }); });
const sample = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "voice-reviewed-"));
  owned.push(dir);
  const scriptPath = path.join(dir, "script.md");
  await writeFile(scriptPath, "test");
  await mkdir(path.join(dir, "voice"));
  execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=400:duration=1.2", "-c:a", "libmp3lame", path.join(dir, "voice", "spoken.mp3")]);
  const plan = { chapters: [{ number: 1, title: "sample", scenes: [{
    id: "c1-s1", template: "noor-text", line: 1, props: {}, narration: "النص المشكول", sfx: [], tone: "calm",
  }] }] } as unknown as Plan;
  const voice = { "c1-s1": { file: "spoken.mp3", text: "النص المشكول", hash: "voice-cache-v1", duration: 1.2, words: [] as { word: string; start: number; end: number }[] } };
  return { dir, scriptPath, plan, voice };
};

describe("human-approved, fingerprint-bound voice gate", () => {
  it("never auto-approves a stored MP3", async () => {
    const x = await sample();
    expect((await voiceReviewItems(x.scriptPath, x.plan, x.voice))[0]?.state).toBe("pending");
    await expect(assertVoiceApproved(x.scriptPath, x.plan, x.voice)).rejects.toThrow(/اعتماد/);
  });
  it("blocks scene and episode approval without explicit human listening acknowledgements", async () => {
    const x = await sample();
    await expect(approveVoiceScene(x.scriptPath, x.plan, x.voice, "c1-s1",
      "مراجع", "سمعت المقطع كاملًا", false)).rejects.toThrow(/التأكيد الصريح/);
    await approveVoiceScene(x.scriptPath, x.plan, x.voice, "c1-s1",
      "مراجع", "سمعت المقطع كاملًا", true);
    await expect(approveVoiceEpisode(x.scriptPath, x.plan, x.voice,
      "مراجع", "استمعت إلى الحلقة بالصوت كاملًا", false)).rejects.toThrow(/الاستماع الكامل/);
    expect(await episodeVoiceApproved(x.scriptPath, x.plan, x.voice)).toBe(false);
  });
  it("does not trust a forged or incomplete legacy approval even with an exact clip hash", async () => {
    const x = await sample();
    const items = await voiceReviewItems(x.scriptPath, x.plan, x.voice);
    expect(items[0]?.fingerprint).toBeTruthy();
    const fingerprint = items[0]!.fingerprint!;
    const forged = { version: 1, scenes: {
      "c1-s1": { fingerprint, reviewer: "", note: "", at: "2026-11-07T00:00:00Z" },
    }, episode: { fingerprint, reviewer: "", note: "", at: "2026-11-07T00:00:00Z" } };
    await writeFile(path.join(x.dir, "voice-review.json"), JSON.stringify(forged));
    expect((await voiceReviewItems(x.scriptPath, x.plan, x.voice))[0]?.state).toBe("pending");
    expect(await episodeVoiceApproved(x.scriptPath, x.plan, x.voice)).toBe(false);
    await expect(assertVoiceApproved(x.scriptPath, x.plan, x.voice)).rejects.toThrow();
  });
  it("refuses symbolic links even when the referenced MP3 is playable", async () => {
    const x = await sample();
    const audio = path.join(x.dir, "voice", "spoken.mp3");
    const external = path.join(x.dir, "not-the-approved-voice.mp3");
    await rename(audio, external);
    await symlink(external, audio);
    expect((await voiceReviewItems(x.scriptPath, x.plan, x.voice))[0]?.state).toBe("missing_audio");
  });
  it("requires a reviewer and a meaningful note, then permits unchanged audio", async () => {
    const x = await sample();
    await expect(approveVoiceScene(x.scriptPath, x.plan, x.voice, "c1-s1", "", "", false)).rejects.toThrow();
    const items = await approveVoiceScene(x.scriptPath, x.plan, x.voice, "c1-s1", "المراجع", "سمعت المقطع كله وتم اعتماد النطق والنبرة", true);
    expect(items[0]?.state).toBe("approved");
    await expect(assertVoiceApproved(x.scriptPath, x.plan, x.voice)).rejects.toThrow(/الحلقة|التعليق الصوتي كامل/);
    await approveVoiceEpisode(x.scriptPath, x.plan, x.voice, "المراجع", "استمعت للحلقة الصوتية كاملة وتأكدت من الاستمرارية والوقفات", true);
    expect(await episodeVoiceApproved(x.scriptPath, x.plan, x.voice)).toBe(true);
    await expect(assertVoiceApproved(x.scriptPath, x.plan, x.voice)).resolves.toBe(true);
  });
  it("full episode signoff is invalidated when a new clip is approved or a recording changes", async () => {
    const x = await sample();
    await approveVoiceScene(x.scriptPath, x.plan, x.voice, "c1-s1", "المراجع", "تم الاستماع إلى المقطع والتحقق من نطقه", true);
    await approveVoiceEpisode(x.scriptPath, x.plan, x.voice, "المراجع", "استمعت للتعليق كاملًا دون توقف وراجعت الانتقالات", true);
    expect(await episodeVoiceApproved(x.scriptPath, x.plan, x.voice)).toBe(true);
    await writeFile(path.join(x.dir, "voice", "spoken.mp3"), "CHANGED");
    expect(await episodeVoiceApproved(x.scriptPath, x.plan, x.voice)).toBe(false);
  });
  it("invalidates the file-bound approval after bytes change, even if name is unchanged", async () => {
    const x = await sample();
    await approveVoiceScene(x.scriptPath, x.plan, x.voice, "c1-s1", "المراجع", "سمعت المقطع كله وتم اعتماد النطق والنبرة", true);
    await writeFile(path.join(x.dir, "voice", "spoken.mp3"), "CHANGED AUDIO WITHOUT RENAMING");
    expect((await voiceReviewItems(x.scriptPath, x.plan, x.voice))[0]?.state).toBe("missing_audio");
    await expect(assertVoiceApproved(x.scriptPath, x.plan, x.voice)).rejects.toThrow();
  });
  it("does not overwrite damaged historical voice-review records", async () => {
    const x = await sample();
    const ledger = path.join(x.dir, "voice-review.json");
    const old = "{ damaged voice review; preserve";
    await writeFile(ledger, old);
    await expect(approveVoiceScene(x.scriptPath, x.plan, x.voice,
      "c1-s1", "مراجع", "استمعت إلى هذا المقطع كاملًا", true)).rejects.toThrow(/التاريخي/);
    expect(await readFile(ledger, "utf8")).toBe(old);
  });
  it("prevents simultaneous voice signoffs from overwriting one another", async () => {
    const x = await sample();
    const lockFile = path.join(x.dir, "voice-review.json.lock");
    const held = await open(lockFile, "wx");
    try {
      await expect(approveVoiceScene(x.scriptPath, x.plan, x.voice,
        "c1-s1", "مراجع", "استمعت إلى هذا المقطع كاملًا", true)).rejects.toThrow(/قيد الحفظ/);
    } finally { await held.close(); await rm(lockFile); }
    const approved = await approveVoiceScene(x.scriptPath, x.plan, x.voice,
      "c1-s1", "مراجع", "استمعت إلى هذا المقطع كاملًا", true);
    expect(approved[0]?.state).toBe("approved");
  });
  it("invalidates time metadata even when audio bytes and narration are unchanged", async () => {
    const x = await sample();
    await approveVoiceScene(x.scriptPath, x.plan, x.voice, "c1-s1",
      "المراجع", "سمعت المقطع كاملًا وراجعت مدته وتوقيتاته", true);
    await approveVoiceEpisode(x.scriptPath, x.plan, x.voice,
      "المراجع", "استمعت للتعليق كاملًا دون توقف وتحققت من التزامن", true);
    expect(await episodeVoiceApproved(x.scriptPath, x.plan, x.voice)).toBe(true);
    // The same file with fabricated playback metadata must not remain approved.
    x.voice["c1-s1"]!.duration = 1.45;
    expect((await voiceReviewItems(x.scriptPath, x.plan, x.voice))[0]?.state).toBe("missing_audio");
    x.voice["c1-s1"]!.duration = 1.2;
    x.voice["c1-s1"]!.words = [{ word: "النص", start: 0, end: 0.5 }];
    expect((await voiceReviewItems(x.scriptPath, x.plan, x.voice))[0]?.state).toBe("changed");
    expect(await episodeVoiceApproved(x.scriptPath, x.plan, x.voice)).toBe(false);
  });
  it("refuses an audio directory that is a symlink, not just a symlinked filename", async () => {
    const x = await sample();
    const voiceRoot = path.join(x.dir, "voice");
    const displaced = path.join(x.dir, "displaced-voice");
    await rename(voiceRoot, displaced);
    await symlink(displaced, voiceRoot);
    expect((await voiceReviewItems(x.scriptPath, x.plan, x.voice))[0]?.state).toBe("missing_audio");
  });
  it("invalidates the review after tone or script change", async () => {
    const x = await sample();
    await approveVoiceScene(x.scriptPath, x.plan, x.voice, "c1-s1", "المراجع", "سمعت المقطع كله وتم اعتماد النطق والنبرة", true);
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
