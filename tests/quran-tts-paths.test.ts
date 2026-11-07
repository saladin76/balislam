import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { synthesizeLines } from "../src/voice/generate";
import type { ElevenLabsClient } from "../src/voice/elevenlabs";

const verse = "وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ";
const active: string[] = [];
afterEach(async () => {
  delete process.env.BAL_CHANNELS_DIR;
  delete process.env.BAL_CHANNEL;
  for (const dir of active.splice(0)) await rm(dir, { recursive: true, force: true });
});

const setup = async (dictionary: unknown) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "quran-tts-negative-"));
  active.push(root);
  const channel = path.join(root, "balislam");
  const episode = path.join(channel, "episodes", "000-demo");
  const scriptPath = path.join(episode, "script.md");
  const voiceDir = path.join(root, "line-preview");
  await mkdir(episode, { recursive: true });
  await mkdir(voiceDir, { recursive: true });
  await copyFile(path.join(__dirname, "..", "channels", "balislam", "channel.json"),
    path.join(channel, "channel.json"));
  await writeFile(path.join(channel, "pronunciation.json"), JSON.stringify(dictionary));
  await writeFile(scriptPath, "---\ntitle: تجربة حماية TTS\ndomain: psychology\nepisode: \"999\"\n---\n" +
    "## الفصل 1 · تجربة\n[آية: النجم 39 | " + verse + "]\n");
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_CHANNEL = "balislam";
  return { scriptPath, voiceDir };
};

describe("real TTS entrypoints guard raw, dictionary and cached Quran", () => {
  it("never calls a TTS provider when a dictionary expands a safe word into an authored verse", async () => {
    const { scriptPath, voiceDir } = await setup({
      entries: [{ text: "مرحبا", say: verse }],
    });
    let calls = 0;
    const client = { tts: async () => { calls++; throw new Error("TTS CALLED"); } } as unknown as ElevenLabsClient;
    await expect(synthesizeLines(scriptPath, [{ id: "preview", text: "مرحبا" }],
      { dir: voiceDir, client })).rejects.toThrow(/قرآني|التلاوة/);
    expect(calls).toBe(0);
  });

  it("rejects a Quran clip before any network call even with a claimed existing cache file", async () => {
    const { scriptPath, voiceDir } = await setup({ entries: [] });
    await writeFile(path.join(voiceDir, "cached.mp3"), "UNTRUSTED TTS CACHE");
    await writeFile(path.join(voiceDir, "index.json"), JSON.stringify({
      preview: { file: "cached.mp3", hash: "forged", text: verse, duration: 1, words: [] },
    }));
    let calls = 0;
    const client = { tts: async () => { calls++; throw new Error("TTS CALLED"); } } as unknown as ElevenLabsClient;
    await expect(synthesizeLines(scriptPath, [{ id: "preview", text: verse }],
      { dir: voiceDir, client })).rejects.toThrow(/قرآني|القرآن|التلاوة/);
    expect(calls).toBe(0);
  });
});
