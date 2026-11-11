/**
 * The owner's Mac after D87 (one section, ids c1-sN) — D89. His local files, never in Git, still carry the old ids
 * (c2-s1…): the signed scene ledger (approvals and history), storyboard.json, voice/index.json and voice/sentences.json
 * with their paid takes. The Studio must read all of it without throwing: what is not in the plan is ignored (the
 * ledger drops it from its state; history keeps it as written), nothing is deleted, and `remap-scene-ids` moves the
 * recordings to their scenes — including, with `--with-changed-text`, those whose text changed since (shown stale).
 */
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runWithChannel } from "../src/channel";
import type { Plan } from "../src/plan/types";
import { approvePreparation } from "../src/studio/preparation";
import { inspectSceneProduction, summarizeSceneProduction } from "../src/studio/sceneService";
import { readSentences } from "../src/voice/sentenceVoice";
import { remapLocalVoice } from "../src/plan/remapIds";
import { loadStoryboard, storyboardStatus } from "../src/plan/storyboard";
import { lockedStep, nextAction } from "../app/src/shell/LockedStep";
import { stepsDone } from "../app/src/shell/EpisodeSpine";

const root = path.join(import.meta.dirname, "..");
const N = ["فِي كِتَابِ «أَوَّلَ مَرَّةٍ أُصَلِّي».", "وَالشُّكْرُ يَحْفَظُ النِّعْمَةَ.", "وَالرِّضَا رَاحَةُ الْقَلْبِ."];
const tail = "\n## الاستشهادات\n\n- مصدر | كتاب الصبر، المؤلف، ص ١٢ | فكرة الصبر\n\n## الخطوة العملية\n\nاصبر اليوم على أمر واحد صغير، ثم اكتب ما تعلمته.\n";
const head = `---\ntitle: "هل نعرف الصبر حقًا؟"\ndomain: psychology\nepisode: "001"\n---\n`;
const block = (n: string) => `[مشهد: noor-text]\n\n${n}\n\n`;
const scene = (id: string, narration: string, line: number) => ({ id, template: "noor-text", line, narration, sfx: [], tone: "calm", props: { text: "اختبار" } });
// Before D87: two sections (c1-s1 | c2-s1, c2-s2). After: one section without a title (c1-s1..c1-s3).
const oldScript = `${head}## الفصل 1 · تجربة\n\n${block(N[0]!)}## الفصل 2 · ثانٍ\n\n${block(N[1]!)}${block(N[2]!)}${tail}`;
const oldPlan = { episode: "001", title: "اختبار", chapters: [
  { number: 1, title: "تجربة", scenes: [scene("c1-s1", N[0]!, 8)] },
  { number: 2, title: "ثانٍ", scenes: [scene("c2-s1", N[1]!, 14), scene("c2-s2", N[2]!, 18)] }] } as unknown as Plan;
const newScript = `${head}${N.map(block).join("")}${tail}`;
const newPlan = { episode: "001", title: "اختبار", chapters: [{ number: 1, title: "", scenes: N.map((n, i) => scene(`c1-s${i + 1}`, n, 6 + i * 4)) }] } as unknown as Plan;
const MAP = { "c1-s1": "c1-s1", "c2-s1": "c1-s2", "c2-s2": "c1-s3" };

const withMac = async (body: (dir: string) => Promise<void>) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "old-ids-"));
  const env = { channels: process.env.BAL_CHANNELS_DIR, key: process.env.BAL_WORKFLOW_HMAC_KEY };
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__old_ids_local_state_2026";
  try {
    const dir = path.join(tmp, "balislam", "episodes", "001-old-ids");
    await mkdir(path.join(dir, "voice", "sentences"), { recursive: true });
    for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
      await copyFile(path.join(root, "channels", "balislam", f), path.join(tmp, "balislam", f));
    await writeFile(path.join(dir, "script.md"), oldScript);
    await writeFile(path.join(dir, "plan.json"), JSON.stringify(oldPlan));
    await runWithChannel("balislam", () => body(dir));
  } finally {
    if (env.channels === undefined) delete process.env.BAL_CHANNELS_DIR; else process.env.BAL_CHANNELS_DIR = env.channels;
    if (env.key === undefined) delete process.env.BAL_WORKFLOW_HMAC_KEY; else process.env.BAL_WORKFLOW_HMAC_KEY = env.key;
    await rm(tmp, { recursive: true, force: true });
  }
};

/** Local voice as recorded on the old plan; c2-s1's text is from an older script (it no longer matches). */
const seedVoice = async (dir: string) => {
  const clip = (id: string, text: string) => ({ file: `${id}.mp3`, hash: `h-${id}`, text, duration: 1.5,
    words: text.split(" ").map((w, i) => ({ word: w, start: i * 0.4, end: i * 0.4 + 0.3 })) });
  const index = { "c1-s1": clip("c1-s1", N[0]!), "c2-s1": clip("c2-s1", "وَالشُّكْرُ نِعْمَةٌ."), "c2-s2": clip("c2-s2", N[2]!) };
  for (const id of Object.keys(index)) await writeFile(path.join(dir, "voice", `${id}.mp3`), `audio ${id}`);
  await writeFile(path.join(dir, "voice", "index.json"), JSON.stringify(index));
  await writeFile(path.join(dir, "voice", "sentences", "t1.wav"), "take");
  const audio = { file: "t1.wav", fingerprint: "f", context: "c", duration: 1, words: [], at: "2026-11-10T00:00:00.000Z", origin: "tts" };
  await writeFile(path.join(dir, "voice", "sentences.json"), JSON.stringify({ version: 1, scenes: {
    "c2-s2": { createdAt: "2026-11-10T00:00:00.000Z", import: { state: "none" },
      sentences: [{ id: "t1", sceneId: "c2-s2", kind: "narration", text: N[2], pauseAfterMs: 300, audio, takes: [{ ...audio, fingerprint: "older" }] }] } } }));
};

describe("old scene ids in the owner's local files (D89)", () => {
  it("the ledger, storyboard.json and the voice files with old ids are read without throwing; only plan ids are shown", async () => {
    await withMac(async (dir) => {
      const s0 = await inspectSceneProduction("001");
      await approvePreparation("001", { scriptSha256: s0.script.sha256, storyboardSha256: s0.storyboard.sha256, reviewed: true });
      await seedVoice(dir);
      const before = await inspectSceneProduction("001");
      expect(before.scenes.map((s) => s.id)).toEqual(["c1-s1", "c2-s1", "c2-s2"]);
      // git pull with D87: the plan and the script become one section
      await writeFile(path.join(dir, "script.md"), newScript);
      await writeFile(path.join(dir, "plan.json"), JSON.stringify(newPlan));
      const files = (await readdir(path.join(dir, "voice"))).sort();

      const read = await inspectSceneProduction("001");
      expect(read.scenes.map((s) => s.id)).toEqual(["c1-s1", "c1-s2", "c1-s3"]);
      // «اعتمد التجهيز» once: still prepared (carried forward), step ٢ open
      expect(read.script.approved && read.storyboard.approved).toBe(true);
      expect(stepsDone(read)[0]).toBe(true);
      expect(lockedStep("episode", read)).toBeNull();
      expect(nextAction(read).tab).toBeTruthy();
      // the history keeps what was written (old ids), the state only the plan's
      expect(JSON.stringify(read.recentHistory)).toMatch(/"by":"owner"/);
      expect(Object.keys(read.candidates.scenes).sort()).toEqual(["c1-s1", "c1-s2", "c1-s3"]);
      // c1-s2 / c1-s3 have no clip under their new ids yet: «ينقصه صوت الراوي», never a crash
      expect(read.scenes.find((s) => s.id === "c1-s2")?.readyForAv).toBe(false);
      await expect(summarizeSceneProduction("001")).resolves.toMatchObject({ totalScenes: 3 });
      // storyboard.json with old ids: the current boards are read as they are
      const board = storyboardStatus(newPlan, await loadStoryboard(path.join(dir, "script.md")));
      expect(board.scenes).toBeTruthy();

      const sentences = await readSentences("001");
      expect(sentences.scenes.map((s) => s.id)).toEqual(["c1-s1", "c1-s2", "c1-s3"]);
      // nothing deleted
      expect((await readdir(path.join(dir, "voice"))).sort()).toEqual(files);

      // remap: the matching recordings move; c2-s1 (older text) only with --with-changed-text, then shown stale
      const map = MAP;
      const dry = await remapLocalVoice(dir, newPlan, map);
      expect(dry.find((r) => r.file === "voice/index.json")!.skipped.map((x) => x.id)).toEqual(["c2-s1"]);
      await remapLocalVoice(dir, newPlan, map, { apply: true, withChangedText: true });
      const index = JSON.parse(await readFile(path.join(dir, "voice", "index.json"), "utf8")) as Record<string, { file: string }>;
      expect(Object.keys(index).sort()).toEqual(["c1-s1", "c1-s2", "c1-s3"]);
      expect(index["c1-s2"]!.file).toBe("c2-s1.mp3");
      const after = await readSentences("001");
      expect(after.scenes.find((s) => s.id === "c1-s2")!.audio.state).toBe("stale");
      const s3 = after.scenes.find((s) => s.id === "c1-s3")!;
      expect(s3.rows[0]!.takes).toBe(1);
      expect(s3.rows[0]!.audio?.file).toBe("t1.wav");
      const prod = await inspectSceneProduction("001");
      expect(prod.scenes.find((s) => s.id === "c1-s3")?.readyForAv).toBe(true);
      expect(prod.scenes.find((s) => s.id === "c1-s2")?.readyForAv).toBe(false);
      // backups next to the files, and every audio file still there
      expect((await readdir(path.join(dir, "voice"))).sort()).toEqual([...files, "index.before-remap.json", "sentences.before-remap.json"].sort());
    });
  });
});
