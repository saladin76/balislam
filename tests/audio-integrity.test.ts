import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decodedAudioDuration } from "../src/voice/audioIntegrity";

describe("full audio decoding gate", () => {
  it("fully decodes a real MP3 and refuses a forged text blob or non-MP3 codec", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "studio-audio-decode-"));
    try {
      const mp3 = path.join(dir, "sound.mp3");
      const fake = path.join(dir, "fake.mp3");
      const wav = path.join(dir, "sound.wav");
      execFileSync("ffmpeg", ["-nostdin", "-loglevel", "error", "-f", "lavfi",
        "-i", "sine=frequency=400:duration=1", "-c:a", "libmp3lame", mp3]);
      execFileSync("ffmpeg", ["-nostdin", "-loglevel", "error", "-f", "lavfi",
        "-i", "sine=frequency=400:duration=1", "-c:a", "pcm_s16le", wav]);
      await writeFile(fake, "ID3\\u0004\\u0000\\u0000\\u0000\\u0000\\u0000\\u0000" + "NOT_AUDIO".repeat(100));
      expect(await decodedAudioDuration(mp3, { mp3Only: true })).toBeGreaterThan(0.9);
      expect(await decodedAudioDuration(fake, { mp3Only: true })).toBeNull();
      expect(await decodedAudioDuration(wav, { mp3Only: true })).toBeNull();
      expect(await decodedAudioDuration(wav)).toBeGreaterThan(0.9);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
