/**
 * D66 — editing one scene after «اعتمد التجهيز» does not lock step ٢ (owner report 10 Nov, زبدة الكتب 001 c1-s3).
 * The script decision is re-recorded from step ٢ for that scene alone, verified against a signed copy of the script
 * as it was approved; anything wider is refused with a precise reason and nothing is written. Also: the word field is
 * pre-filled with the written word, what is sent keeps the owner's tashkeel, and no-op lexicon entries are refused.
 */
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runWithChannel } from "../src/channel";
import type { Plan } from "../src/plan/types";
import { approvePreparation, approveSceneBoard, preparationBlockers } from "../src/studio/preparation";
import { inspectSceneProduction } from "../src/studio/sceneService";
import { approvedScriptFileFor, scriptEditScope } from "../src/studio/scriptScope";
import { readSentences } from "../src/voice/sentenceVoice";
import { NOOP_SAY, setLexiconEntry } from "../src/voice/lexicon";
import { lockedStep } from "../app/src/shell/LockedStep";

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
const planOf = (n: [string, string, string]) =>
  ({ episode: "001", title: "اختبار", chapters: [{ number: 1, title: "تجربة", scenes: n.map((x, i) => scene(`c1-s${i + 1}`, x, 8 + i * 4)) }] }) as unknown as Plan;
const NOTE = "راجعت كل اللوحات المعروضة ونصوصها وتكوينها واحدة واحدة";
const EDIT_NOTE = "راجعت المشهد الثاني بعد تعديل نصه: النص والتوقيت سليمان";

describe("scriptEditScope (pure)", () => {
  const scenes = [{ id: "c1-s1", narration: N1 }, { id: "c1-s2", narration: N2 }, { id: "c1-s3", narration: N3 }];
  const a = scriptOf([N1, N2, N3]);
  it("no content change; one scene's narration changed (matched before or after the edit)", () => {
    expect(scriptEditScope(a, a, scenes)).toEqual({ ok: true, sceneId: null });
    expect(scriptEditScope(a, scriptOf([N1, "وَالشُّكْرُ يَزِيدُ النِّعْمَةَ.", N3]), scenes)).toEqual({ ok: true, sceneId: "c1-s2" });
    expect(scriptEditScope(a, scriptOf([N1, "وَالشُّكْرُ يَزِيدُ النِّعْمَةَ.", N3]), [{ id: "c1-s2", narration: "وَالشُّكْرُ يَزِيدُ النِّعْمَةَ." }])).toEqual({ ok: true, sceneId: "c1-s2" });
  });
  it("two scenes, a heading, the front matter or the citations: other parts changed", () => {
    expect(scriptEditScope(a, scriptOf([N1, "تعديل.", "تعديل آخر."]), scenes).ok).toBe(false);
    expect(scriptEditScope(a, scriptOf([N1, N2, N3], "عنوان آخر"), scenes).ok).toBe(false);
    expect(scriptEditScope(a, a.replace("هل نعرف الصبر حقًا؟", "عنوان جديد"), scenes).ok).toBe(false);
    expect(scriptEditScope(a, a.replace("ص ١٢", "ص ١٣"), scenes).ok).toBe(false);
    expect(scriptEditScope(a, a.replace("جملة قصيرة في هذا الفصل.\n\n## الفصل 3", "جملة أخرى.\n\n## الفصل 3"), scenes).ok).toBe(false);
  });
});

describe("one scene edited after «اعتمد التجهيز» is re-approved from step ٢", () => {
  it("keeps step ٢ open, re-records script + this board + storyboard in one action, other scenes untouched; full lock otherwise", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "scene-edit-"));
    const env = { channels: process.env.BAL_CHANNELS_DIR, key: process.env.BAL_WORKFLOW_HMAC_KEY };
    process.env.BAL_CHANNELS_DIR = tmp;
    process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__scene_edit_signing_key_2026";
    try {
      const dir = path.join(tmp, "balislam", "episodes", "001-scene-edit");
      await mkdir(dir, { recursive: true });
      for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
        await copyFile(path.join(root, "channels", "balislam", f), path.join(tmp, "balislam", f));
      await writeFile(path.join(dir, "script.md"), scriptOf([N1, N2, N3]));
      // The voweled copy has the damma, as زبدة الكتب 001's tashkeel.md.
      await writeFile(path.join(dir, "tashkeel.md"), "فِي كِتَابِ «أَوَّلُ مَرَّةٍ أُصَلِّي».\n");
      await writeFile(path.join(dir, "plan.json"), JSON.stringify(planOf([N1, N2, N3])));
      await runWithChannel("balislam", async () => {
        expect((await preparationBlockers("001")).scriptErrors).toBe(0);
        const s0 = await inspectSceneProduction("001");
        expect(s0.sceneEdit).toBeNull();
        await approvePreparation("001", { scriptSha256: s0.script.sha256, storyboardSha256: s0.storyboard.sha256, reviewed: true, note: NOTE });
        const s1 = await inspectSceneProduction("001");
        expect(s1.script.approved && s1.storyboard.approved).toBe(true);
        expect(s1.sceneEdit).toBeNull();
        expect(JSON.parse(await readFile(approvedScriptFileFor(path.join(dir, "script.md")), "utf8")).text).toBe(scriptOf([N1, N2, N3]));

        // Pronunciation: the field is the written word, and the written fatha is what is sent.
        const read = await readSentences("001");
        const w = read.scenes[0]!.rows[0]!.words[2]!;
        expect(w).toMatchObject({ word: "«أَوَّلَ", say: "أَوَّلَ", sent: "أَوَّلَ", source: "written" });
        expect(read.scenes[0]!.rows[0]!.spoken).toContain("«أَوَّلَ ");
        await expect(setLexiconEntry("«أَوَّلَ", "أَوَّلَ")).rejects.toThrow(NOOP_SAY);

        // The owner edits scene 2: its sentence (plan) and its line in the script.
        const N2b = "وَالشُّكْرُ يَزِيدُ النِّعْمَةَ.";
        await writeFile(path.join(dir, "plan.json"), JSON.stringify(planOf([N1, N2b, N3])));
        await writeFile(path.join(dir, "script.md"), scriptOf([N1, N2b, N3]));
        const s2 = await inspectSceneProduction("001");
        expect(s2.script.approved).toBe(false);
        expect(s2.storyboard.approved).toBe(false);
        expect(s2.sceneEdit).toEqual({ sceneId: "c1-s2", open: true, script: true, board: true });
        expect(lockedStep("episode", s2)).toBeNull();

        const ledger = async () => JSON.parse(await readFile(path.join(dir, "scene-production.v1.json"), "utf8"));
        const historyBefore = (await ledger()).history.length;
        const boardsBefore = await readFile(path.join(dir, "storyboard.json"), "utf8");
        const ok = { sceneId: "c1-s2", storyboardSha256: s2.storyboard.sha256, scriptSha256: s2.script.sha256, reviewed: true, note: EDIT_NOTE };
        await expect(approveSceneBoard("001", { ...ok, sceneId: "c1-s1" })).rejects.toThrow();
        await expect(approveSceneBoard("001", { ...ok, scriptSha256: undefined })).rejects.toThrow(/Script changed/);
        await expect(approveSceneBoard("001", { ...ok, reviewed: false })).rejects.toThrow();
        await expect(approveSceneBoard("001", { ...ok, note: "قصيرة" })).rejects.toThrow();
        expect((await ledger()).history.length).toBe(historyBefore);
        expect(await readFile(path.join(dir, "storyboard.json"), "utf8")).toBe(boardsBefore);

        const s3 = await approveSceneBoard("001", ok);
        expect(s3.script.approved && s3.storyboard.approved).toBe(true);
        expect(s3.boards).toEqual({ current: true, changed: [] });
        expect(s3.sceneEdit).toBeNull();
        expect((await ledger()).history.slice(historyBefore).map((h: { action: string }) => h.action)).toEqual(["approve-script", "approve-storyboard"]);
        // Scenes before and after keep their inputs (so their approvals), the edited one re-opens alone.
        expect(s3.scenes[0]!.sourceSha256).toBe(s1.scenes[0]!.sourceSha256);
        expect(s3.scenes[2]!.sourceSha256).toBe(s1.scenes[2]!.sourceSha256);
        expect(s3.scenes[1]!.sourceSha256).not.toBe(s1.scenes[1]!.sourceSha256);
        const rec = JSON.parse(await readFile(path.join(dir, "storyboard.json"), "utf8"));
        expect(rec.audit.scenes).toEqual(["c1-s2"]);
        // The new approval has its own signed copy.
        expect(JSON.parse(await readFile(approvedScriptFileFor(path.join(dir, "script.md")), "utf8")).text).toBe(scriptOf([N1, N2b, N3]));

        // Another part of the script changed too: locked as before, with the precise reason, and nothing written.
        await writeFile(path.join(dir, "script.md"), scriptOf([N1, N2b, "وَالرِّضَا نِعْمَةٌ."], "عنوان آخر"));
        const s4 = await inspectSceneProduction("001");
        expect(s4.sceneEdit?.open).toBe(false);
        expect(s4.sceneEdit?.reason).toContain("١ التجهيز");
        expect(lockedStep("episode", s4)).toBe(1);
        const h4 = (await ledger()).history.length;
        await expect(approveSceneBoard("001", { ...ok, storyboardSha256: s4.storyboard.sha256, scriptSha256: s4.script.sha256, sceneId: "c1-s3" }))
          .rejects.toThrow(/١ التجهيز/);
        expect((await ledger()).history.length).toBe(h4);

        // No signed copy of the approved script (an approval from before D66): fail closed, step ١ once.
        await writeFile(path.join(dir, "script.md"), scriptOf([N1, N2b, N3]));
        await rm(approvedScriptFileFor(path.join(dir, "script.md")));
        await writeFile(path.join(dir, "script.md"), scriptOf([N1, N2b, "وَالرِّضَا نِعْمَةٌ."]));
        const s5 = await inspectSceneProduction("001");
        expect(s5.sceneEdit).toMatchObject({ open: false, script: true });
        expect(s5.sceneEdit?.reason).toContain("لا نسخة محفوظة");
      });
    } finally {
      if (env.channels === undefined) delete process.env.BAL_CHANNELS_DIR; else process.env.BAL_CHANNELS_DIR = env.channels;
      if (env.key === undefined) delete process.env.BAL_WORKFLOW_HMAC_KEY; else process.env.BAL_WORKFLOW_HMAC_KEY = env.key;
      await rm(tmp, { recursive: true, force: true });
    }
  }, 60_000);
});
