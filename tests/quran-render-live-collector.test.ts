/**
 * Combined-branch acceptance: invoke with
 *   STUDIO_QURAN_RENDER_INTEGRATION=1 npx vitest run tests/quran-render-live-collector.test.ts
 * Must fail before PR #73 collector integration; skip in the isolated #76 suite
 * rather than pretending its unintegrated collector is a success.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectMedia } from "../src/plan/collect";
import { decodedAudioDuration } from "../src/voice/audioIntegrity";
import type { Plan } from "../src/plan/types";

const text = "وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ";
const script = (verse = text) =>
  "---\ntitle: اختبار جامع التلاوات\ndomain: psychology\nepisode: \"000\"\n---\n" +
  "## الفصل 1 · تجربة\n[آية: النجم 39 | " + verse + "]\n" +
  "## الاستشهادات\n- آية | النجم 39 | المصحف المعتمد\n";
const sha = (s: Uint8Array | string) => createHash("sha256").update(s).digest("hex");
const dirs: string[] = [];
afterEach(async () => {
  delete process.env.BAL_CHANNELS_DIR;
  delete process.env.BAL_CHANNEL;
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
});
const setup = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "quran-live-collector-"));
  dirs.push(root);
  const channel = path.join(root, "balislam");
  const episode = path.join(channel, "episodes", "000-demo");
  const recitations = path.join(episode, "recitations");
  await mkdir(path.join(recitations, "originals"), { recursive: true });
  await copyFile(path.join(__dirname, "..", "channels", "balislam", "channel.json"),
    path.join(channel, "channel.json"));
  const scriptPath = path.join(episode, "script.md");
  await writeFile(scriptPath, script());
  const file = "manual-53-39-abcdef123456.mp3";
  const originalFile = "originals/00000000-0000-4000-8000-000000000001.mp3";
  execFileSync("ffmpeg", ["-nostdin", "-loglevel", "error", "-f", "lavfi",
    "-i", "sine=frequency=411:duration=1.2", "-c:a", "libmp3lame",
    path.join(recitations, file)]);
  const bytes = await readFile(path.join(recitations, file));
  const duration = await decodedAudioDuration(path.join(recitations, file), { mp3Only: true });
  if (!duration) throw Error("Fixture MP3 could not be fully decoded");
  await writeFile(path.join(recitations, originalFile), bytes);
  const index = { "53:39": {
    provider: "manual", reciter: "قارئ يدوي موثق",
    rightsEvidence: "https://rights.example.test/licensed-audio",
    fetchedAt: new Date().toISOString(), approvedAt: new Date().toISOString(),
    approvedBy: "مراجع مستقل", reviewNote: "استمعت لهذا التسجيل وتحـققت من مصدره",
    sha256: sha(bytes), textSha256: sha(Buffer.from(text, "utf8")),
    originalFile, originalName: "licensed-audio.mp3", originalSha256: sha(bytes),
    parts: [{ file, duration }],
  } };
  await writeFile(path.join(recitations, "index.json"), JSON.stringify(index));
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_CHANNEL = "balislam";
  const plan = { chapters: [{ number: 1, title: "اختبار", scenes: [{
    id: "c1-s1", template: "verse-card", ayahKey: "53:39",
    narration: "", sfx: [], props: { text },
  }] }] } as unknown as Plan;
  return { recitations, scriptPath, plan, file };
};

describe.skipIf(process.env.STUDIO_QURAN_RENDER_INTEGRATION !== "1")(
  "required live collector acceptance AFTER PR #73 integration (must not skip in combined QA)", () => {
    it("selects the exact current human-reviewed manual clip and no global/library fallback", async () => {
      const x = await setup();
      const media = await collectMedia("000", x.plan);
      expect(media.recitations["53:39"]?.source).toBe("manual");
      expect(media.recitations["53:39"]?.file).toBe(x.file);
      expect(media.recitations["53:39"]?.reciter).toBe("قارئ يدوي موثق");
      expect(media.recitations["53:39"]?.parts?.[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
    });

    it("fails closed after tampering with manual approved MP3 or changing the verse haraka", async () => {
      const x = await setup();
      await writeFile(path.join(x.recitations, x.file), "CORRUPTED MP3");
      await expect(collectMedia("000", x.plan)).rejects.toThrow();
      const y = await setup();
      await writeFile(y.scriptPath, script(text.replace("وَأَنْ", "وَأَنِ")));
      await expect(collectMedia("000", y.plan)).rejects.toThrow();
    });
  },
);
