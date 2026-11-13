/**
 * «اعتمد التجهيز» once per episode (owner decision 11 Nov 2026, all channels; supersedes the re-approval of
 * D60/D65/D66). A change after it (a board / a scene's text / the script) is carried forward by the ledger with ONE
 * signed system event «تحديث بعد التجهيز», only the changed scenes re-open for review in step ٢, and step ٢ never
 * locks. Also: the first approval is still required, its note is optional (one line), an episode that waited on the
 * old changed-boards re-approval migrates on read, errors block the scene (or every unapproved scene) not the step,
 * the written word is what is sent (D66 pronunciation precedence kept), and no re-approval UI is left in the source.
 */
import { copyFile, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runWithChannel } from "../src/channel";
import type { Plan } from "../src/plan/types";
import { approvePreparation, preparationBlockers } from "../src/studio/preparation";
import { assertSceneRenderAllowed, inspectSceneProduction, requireScriptAndStoryboardApproved } from "../src/studio/sceneService";
import { checkVisualStoryboardSignoff } from "../src/plan/storyboardVisualGate";
import { readSentences } from "../src/voice/sentenceVoice";
import { NOOP_SAY, setLexiconEntry } from "../src/voice/lexicon";
import { lockedStep } from "../app/src/shell/LockedStep";
import { stepsDone } from "../app/src/shell/EpisodeSpine";
import { afterPreparationLine } from "../app/src/api";

const root = path.join(import.meta.dirname, "..");
const N1 = "فِي كِتَابِ «أَوَّلَ مَرَّةٍ أُصَلِّي».";
const N2 = "وَالشُّكْرُ يَحْفَظُ النِّعْمَةَ.";
const N3 = "وَالرِّضَا رَاحَةُ الْقَلْبِ.";
const scriptOf = (n: [string, string, string], heading = "تجربة") => `---\ntitle: "هل نعرف الصبر حقًا؟"\ndomain: psychology\nepisode: "001"\n---\n` +
  `## الفصل 1 · ${heading}\n\n[مشهد: noor-text]\n\n${n[0]}\n\n[مشهد: noor-text]\n\n${n[1]}\n\n[مشهد: noor-text]\n\n${n[2]}\n\n` +
  ["الواقع", "الجذر", "بعين الإسلام", "في حياتك", "الخلاصة"].map((t, i) => `## الفصل ${i + 2} · ${t}\nجملة قصيرة في هذا الفصل.\n`).join("\n") +
  "\n## الاستشهادات\n\n- مصدر | كتاب الصبر، المؤلف، ص ١٢ | فكرة الصبر\n\n## الخطوة العملية\n\nاصبر اليوم على أمر واحد صغير، ثم اكتب ما تعلمته.\n";
const scene = (id: string, narration: string, line: number) =>
  ({ id, template: "noor-text", line, narration, sfx: [], tone: "calm", props: { text: "اختبار" } });
// The plan says every narrated line of the script (QA balislam 2, 12 Nov: a script line no scene says refuses the approval).
const planOf = (n: [string, string, string]) =>
  ({ episode: "001", title: "اختبار", chapters: [{ number: 1, title: "تجربة", scenes: n.map((x, i) => scene(`c1-s${i + 1}`, x, 8 + i * 4)) },
    { number: 2, title: "الواقع", scenes: [scene("c2-s1", "جملة قصيرة في هذا الفصل.", 21)] }] }) as unknown as Plan;

type Event = { action: string; by: string; change?: { source: string[]; script?: { from: string | null; to: string };
  storyboard?: { from: string | null; to: string }; scenes: { id: string; what: string[]; from: string | null; to: string }[] } };

const withEpisode = async (name: string, body: (dir: string) => Promise<void>) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), name));
  const env = { channels: process.env.BAL_CHANNELS_DIR, key: process.env.BAL_WORKFLOW_HMAC_KEY };
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__after_preparation_key_2026";
  try {
    const dir = path.join(tmp, "balislam", "episodes", "001-after-prep");
    await mkdir(dir, { recursive: true });
    for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
      await copyFile(path.join(root, "channels", "balislam", f), path.join(tmp, "balislam", f));
    await writeFile(path.join(dir, "script.md"), scriptOf([N1, N2, N3]));
    await writeFile(path.join(dir, "tashkeel.md"), "فِي كِتَابِ «أَوَّلُ مَرَّةٍ أُصَلِّي».\n");
    await writeFile(path.join(dir, "plan.json"), JSON.stringify(planOf([N1, N2, N3])));
    await runWithChannel("balislam", () => body(dir));
  } finally {
    if (env.channels === undefined) delete process.env.BAL_CHANNELS_DIR; else process.env.BAL_CHANNELS_DIR = env.channels;
    if (env.key === undefined) delete process.env.BAL_WORKFLOW_HMAC_KEY; else process.env.BAL_WORKFLOW_HMAC_KEY = env.key;
    await rm(tmp, { recursive: true, force: true });
  }
};
const ledgerOf = async (dir: string) => JSON.parse(await readFile(path.join(dir, "scene-production.v1.json"), "utf8")) as { history: Event[];
  state: { script: { approval?: { by: string } }; storyboard: { approval?: { by: string } } } };

describe("the board note is optional, one line, no minimum", () => {
  const plan = planOf([N1, N2, N3]);
  it("accepts no note or a short one; refuses several lines or a very long one", () => {
    expect(checkVisualStoryboardSignoff(plan, undefined)).toMatchObject({ ok: true });
    expect(checkVisualStoryboardSignoff(plan, "")).toMatchObject({ ok: true });
    expect(checkVisualStoryboardSignoff(plan, "سليم")).toEqual({ ok: true, note: "سليم" });
    expect(checkVisualStoryboardSignoff(plan, "سطر\nسطر").ok).toBe(false);
    expect(checkVisualStoryboardSignoff(plan, "ا".repeat(301)).ok).toBe(false);
  });
});

describe("«اعتمد التجهيز» once; later changes carried forward, only their scenes re-open", () => {
  it("first approval required; after it a scene edit writes one signed system event and never locks step ٢", async () => {
    await withEpisode("after-prep-", async (dir) => {
      expect((await preparationBlockers("001")).scriptErrors).toBe(0);
      const s0 = await inspectSceneProduction("001");
      // Never prepared: no carry-forward, step ٢ locked, production refused.
      expect(s0.script.approved || s0.storyboard.approved).toBe(false);
      expect(lockedStep("episode", s0)).toBe(1);
      expect(s0.afterPreparation).toBeNull();
      await expect(requireScriptAndStoryboardApproved("001")).rejects.toThrow(/اعتمد التجهيز/);
      await expect(approvePreparation("001", { scriptSha256: s0.script.sha256, storyboardSha256: s0.storyboard.sha256, reviewed: false }))
        .rejects.toThrow();
      await expect(approvePreparation("001", { scriptSha256: s0.script.sha256, storyboardSha256: s0.storyboard.sha256, reviewed: true, note: "سطر\nآخر" }))
        .rejects.toThrow();
      // No note at all is fine.
      await approvePreparation("001", { scriptSha256: s0.script.sha256, storyboardSha256: s0.storyboard.sha256, reviewed: true });
      const s1 = await inspectSceneProduction("001");
      expect(s1.script.approved && s1.storyboard.approved).toBe(true);
      expect(JSON.parse(await readFile(path.join(dir, "storyboard.json"), "utf8")).audit.note.trim()).not.toBe("");
      const h1 = (await ledgerOf(dir)).history.length;

      // Pronunciation (D66 kept): the field is the written word, and the written fatha is what is sent.
      const read = await readSentences("001");
      const w = read.scenes[0]!.rows[0]!.words[2]!;
      expect(w).toMatchObject({ word: "«أَوَّلَ", say: "أَوَّلَ", sent: "أَوَّلَ", source: "written" });
      await expect(setLexiconEntry("«أَوَّلَ", "أَوَّلَ")).rejects.toThrow(NOOP_SAY);

      // A chat edits scene 2: its sentence (board) and its line in the script.
      const N2b = "وَالشُّكْرُ يَزِيدُ النِّعْمَةَ.";
      await writeFile(path.join(dir, "plan.json"), JSON.stringify(planOf([N1, N2b, N3])));
      await writeFile(path.join(dir, "script.md"), scriptOf([N1, N2b, N3]));
      const s2 = await inspectSceneProduction("001");
      expect(s2.script.approved && s2.storyboard.approved).toBe(true);
      expect(s2.boards).toEqual({ current: true, changed: [] });
      expect(stepsDone(s2)[0]).toBe(true);
      expect(lockedStep("episode", s2)).toBeNull();
      await expect(requireScriptAndStoryboardApproved("001")).resolves.toBeUndefined();
      // Only the edited scene's inputs changed.
      expect(s2.scenes[0]!.sourceSha256).toBe(s1.scenes[0]!.sourceSha256);
      expect(s2.scenes[2]!.sourceSha256).toBe(s1.scenes[2]!.sourceSha256);
      expect(s2.scenes[1]!.sourceSha256).not.toBe(s1.scenes[1]!.sourceSha256);
      expect(s2.scenes[1]!.afterPreparation?.what).toContain("board");
      expect(s2.scenes[0]!.afterPreparation).toBeUndefined();
      expect(s2.afterPreparation?.scenes.map((x) => x.id)).toEqual(["c1-s2"]);
      expect(afterPreparationLine(s2.scenes[1]!.afterPreparation!.what)).toContain("تغيّر بعد التجهيز — راجعه");

      const l2 = await ledgerOf(dir);
      const added = l2.history.slice(h1);
      expect(added.map((h) => [h.action, h.by])).toEqual([["update-after-preparation", "system"]]);
      const ev = added[0]!.change!;
      expect(ev.source).toEqual(["script", "boards"]);
      expect(ev.script?.from).toBe(s1.script.sha256);
      expect(ev.script?.to).toBe(s2.script.sha256);
      expect(ev.storyboard?.from).toBe(s1.storyboard.sha256);
      expect(ev.storyboard?.to).toBe(s2.storyboard.sha256);
      expect(ev.scenes).toEqual([{ id: "c1-s2", what: ["board"], from: s1.scenes[1]!.sourceSha256, to: s2.scenes[1]!.sourceSha256 }]);
      expect(l2.state.script.approval?.by).toBe("system");
      expect(l2.state.storyboard.approval?.by).toBe("system");
      // The other boards keep their record byte for byte; only c1-s2 was re-recorded.
      expect(JSON.parse(await readFile(path.join(dir, "storyboard.json"), "utf8")).audit.scenes).toEqual(["c1-s2"]);
      // The event is signed with the rest: the next read accepts the ledger, and writes nothing new.
      await inspectSceneProduction("001");
      expect((await ledgerOf(dir)).history.length).toBe(l2.history.length);
      // «اعتمد التجهيز» again is a no-op (nothing to approve twice).
      const again = await approvePreparation("001", { scriptSha256: s2.script.sha256, storyboardSha256: s2.storyboard.sha256, reviewed: true });
      expect(again.revision).toBe((await inspectSceneProduction("001")).revision);
      expect((await ledgerOf(dir)).history.length).toBe(l2.history.length);

      // A script-only change (heading): carried forward, no scene re-opens.
      await writeFile(path.join(dir, "script.md"), scriptOf([N1, N2b, N3], "عنوان آخر"));
      const s3 = await inspectSceneProduction("001");
      expect(s3.script.approved && s3.storyboard.approved).toBe(true);
      expect(s3.scenes.map((x) => x.sourceSha256)).toEqual(s2.scenes.map((x) => x.sourceSha256));
      const e3 = (await ledgerOf(dir)).history.at(-1)!;
      expect(e3.action).toBe("update-after-preparation");
      expect(e3.change?.source).toEqual(["script"]);
      expect(e3.change?.scenes).toEqual([]);

      // A script error that belongs to no scene: the step stays open, producing a scene refuses with the error.
      // (الأقسام صارت اختيارية فحذف قسم لم يعد خطأً؛ الخطأ هنا «الخطوة العملية» المفقودة، ولا سطر مشهد له)
      await writeFile(path.join(dir, "script.md"), scriptOf([N1, N2b, N3]).replace(/## الخطوة العملية\n\n.*\n/, ""));
      const s4 = await inspectSceneProduction("001");
      expect(s4.script.approved).toBe(true);
      expect(lockedStep("episode", s4)).toBeNull();
      expect(s4.episodeBlocked?.length).toBeGreaterThan(0);
      const cur = s4.scenes.find((x) => x.id === s4.progress.currentScene)!;
      await expect(assertSceneRenderAllowed("001", cur.id, cur.sourceSha256, "current")).rejects.toThrow(/لا يُنتج/);
    });
  }, 60_000);

  it("migrates an episode left waiting on the old changed-boards re-approval: carried forward, only changed scenes re-open", async () => {
    await withEpisode("after-prep-migrate-", async (dir) => {
      const s0 = await inspectSceneProduction("001");
      await approvePreparation("001", { scriptSha256: s0.script.sha256, storyboardSha256: s0.storyboard.sha256, reviewed: true, note: "سليم" });
      const s1 = await inspectSceneProduction("001");
      const boardsFile = path.join(dir, "storyboard.json");
      const record = JSON.parse(await readFile(boardsFile, "utf8"));
      // The waiting state: boards changed after the approval and the storyboard decision lost (here: a record without
      // its note, which the carry-forward never touches), like زبدة الكتب 001 (storyboard.approved=false, boards.changed=[…]).
      await writeFile(boardsFile, JSON.stringify({ ...record, audit: undefined }));
      await writeFile(path.join(dir, "plan.json"), JSON.stringify(planOf([N1, "وَالشُّكْرُ يَزِيدُ.", "وَالرِّضَا نِعْمَةٌ."])));
      const waiting = await inspectSceneProduction("001");
      expect(waiting.storyboard.approved).toBe(false);
      expect(waiting.boards?.changed).toEqual(["c1-s2", "c1-s3"]);
      expect(lockedStep("episode", waiting)).toBe(1);
      // The owner's Mac after updating: the old record (with its note) is read, and migrated on that read.
      await writeFile(boardsFile, JSON.stringify(record));
      const after = await inspectSceneProduction("001");
      expect(after.script.approved && after.storyboard.approved && after.boards?.current).toBe(true);
      expect(lockedStep("episode", after)).toBeNull();
      expect(after.scenes[0]!.sourceSha256).toBe(s1.scenes[0]!.sourceSha256);
      expect(after.afterPreparation?.scenes.map((x) => x.id)).toEqual(["c1-s2", "c1-s3"]);
      expect((await ledgerOf(dir)).history.filter((h) => h.action === "update-after-preparation")).toHaveLength(1);
    });
  }, 60_000);
});

describe("no re-approval UI or route is left (source-level)", () => {
  const files = async (d: string): Promise<string[]> => (await readdir(d, { withFileTypes: true })).flatMap((e) => e.isDirectory()
    ? [] : [path.join(d, e.name)]).concat(...await Promise.all((await readdir(d, { withFileTypes: true })).filter((e) => e.isDirectory() && e.name !== "node_modules").map((e) => files(path.join(d, e.name)))));
  it("no «اعتمد اللوحات المتغيّرة» / «اعتمد لوحة هذا المشهد» / «اعتمد تعديل هذا المشهد», no sceneEdit, no 25-character note", async () => {
    expect(existsSync(path.join(root, "app/src/workspace/SceneBoardApproval.tsx"))).toBe(false);
    expect(existsSync(path.join(root, "src/studio/scriptScope.ts"))).toBe(false);
    const all = [...await files(path.join(root, "src")), ...await files(path.join(root, "app/src")), ...await files(path.join(root, "app/server"))]
      .filter((f) => /\.(ts|tsx|mjs)$/.test(f));
    for (const f of all) {
      const text = await readFile(f, "utf8");
      for (const bad of ["اعتمد اللوحات المتغيّرة", "اعتمد لوحة هذا المشهد", "اعتمد تعديل هذا المشهد", "approveSceneBoard", "sceneEdit", "٢٥ حرفًا على الأقل", "25 حرفًا على الأقل", "لا تقل عن 25", "reapproveText"])
        expect(text.includes(bad), `${path.relative(root, f)} still has ${bad}`).toBe(false);
    }
    const spine = await readFile(path.join(root, "app/src/shell/EpisodeSpine.tsx"), "utf8");
    expect(spine).not.toMatch(/length >= 25/);
    expect(await readFile(path.join(root, "app/server/api.ts"), "utf8")).toMatch(/approve-scene-board[\s\S]{0,120}410/);
  });
});
