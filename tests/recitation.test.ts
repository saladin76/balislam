import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createQuranClient } from "../src/quran/client";
import { syncQuran } from "../src/quran/sync";
import { collectMedia, prepareRenderMedia } from "../src/plan/collect";
import { prepareOwnRecitation, approveOwnRecitation } from "../src/quran/manualAudio";
import { renderEpisode } from "../src/render/episode";
import { requireCloudPublicationRights, activeRecitation, episodeRecitationFile, saveEpisodeRecitation, readEpisodeRecitation } from "../src/quran/provider";
import { regeneratePlan } from "../src/plan/io";

let tmp = "";
let mp3: Buffer;
beforeAll(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-rec-"));
  cpSync(path.join(__dirname, "..", "channels", "balislam"), path.join(tmp, "balislam"), { recursive: true, filter: (s) => !/[\\/](episodes|voice|out|recitations)([\\/]|$)/.test(s) && !s.endsWith("quran.json") });
  // Create a fresh test episode instead of copying production episodes.
  mkdirSync(path.join(tmp, "balislam", "episodes"), { recursive: true });
  // الحلقة التجريبية للاختبارات (القنوات نفسها تبدأ بلا حلقات)
  cpSync(path.join(__dirname, "fixtures", "episodes", "000-demo"), path.join(tmp, "balislam", "episodes", "000-demo"), { recursive: true });
  const ch = path.join(tmp, "balislam", "channel.json");
  writeFileSync(ch, JSON.stringify({ ...JSON.parse(readFileSync(ch, "utf8")), recitation: { id: 7, name: "قارئ تجريبي" } }));
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.BAL_CHANNEL = "balislam";
  const f = path.join(tmp, "tone.mp3");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=300:duration=1.5", "-c:a", "libmp3lame", f]);
  mp3 = readFileSync(f);
});
afterAll(() => {
  delete process.env.BAL_CHANNELS_DIR;
  delete process.env.BAL_CHANNEL;
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = "";
});


describe("No online Quran provider in production", () => {
  it("never treats an archived provider recitation index as approved episode audio", async () => {
    const recDir = path.join(tmp, "balislam", "episodes", "000-demo", "recitations");
    mkdirSync(recDir, { recursive: true });
    const indexPath = path.join(recDir, "index.json");
    writeFileSync(indexPath, JSON.stringify({ "53:39": {
      provider: "quran-foundation", reciter: "legacy sample",
      approvedBy: "archived", approvedAt: new Date().toISOString(),
      parts: [{ file: "old.mp3", duration: 1.5 }],
    } }));
    try {
      const plan = await regeneratePlan("000");
      const media = await collectMedia("000", plan);
      expect(media.recitations["53:39"]).toBeUndefined();
      await expect(collectMedia("000", plan, { requireApprovedQuran: true }))
        .rejects.toThrow(/تلاوة/);
    } finally { rmSync(indexPath, { force: true }); }
  });
});

describe("integrated manual recitation staging", () => {
  it("uses approved script-bound original recitation and rejects changed bytes without fallback", async () => {
    const candidate = await prepareOwnRecitation("000", "53:39", "recording.mp3", mp3);
    await approveOwnRecitation("000", "53:39", "مراجع", "استمعت إلى التلاوة كاملة وأجزت التسجيل الحالي",
      true, { reciter: "القارئ المسجل", rightsEvidence: "إذن صاحب حقوق التسجيل لهذا الإنتاج" });
    const plan = await regeneratePlan("000");
    const found = await collectMedia("000", plan);
    expect(found.recitations["53:39"]).toMatchObject({
      source: "manual", file: candidate.file, reciter: "القارئ المسجل",
    });
    const destRoot = path.join(tmp, "public-review-only");
    const staged = await prepareRenderMedia("000", plan, { publicRoot: destRoot });
    const copied = readFileSync(path.join(destRoot, staged.base, "recitations", candidate.file));
    expect(copied.equals(readFileSync(path.join(tmp, "balislam", "episodes", "000-demo", "recitations", candidate.file)))).toBe(true);
    writeFileSync(path.join(tmp, "balislam", "episodes", "000-demo", "recitations", candidate.file), Buffer.from("invalid audio bytes"));
    await expect(collectMedia("000", plan, { requireApprovedQuran: true }))
      .rejects.toThrow(/تلاوة/);
  }, 35000);
});

describe("final-motion entrypoint integration", () => {
  it("blocks a direct CLI/API-equivalent Master before Remotion when full owner signoffs are absent", async () => {
    const plan = await regeneratePlan("000");
    const raw = await collectMedia("000", plan).catch(() => ({ voice: {}, sfx: [], recitations: {}, images: [] }));
    await expect(renderEpisode({
      episode: "000", orientation: "landscape", quality: "master", plan,
      media: { ...raw, mode: "url", base: "" },
    })).rejects.toThrow(/owner session|السكريبت|اعتماد|المصادر/);
  }, 30000);
});
