import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runWithChannel } from "../src/channel";
import type { Plan } from "../src/plan/types";
import {
  loadStoryboard, recordChangedBoards, storyboardBlockMessage, storyboardStatus, storyboardVisualHash,
  approveStoryboard as recordBoards,
} from "../src/plan/storyboard";
import { resolveMotionInput } from "../src/render/motionMeter";
import { approvePreparation, preparationBlockers } from "../src/studio/preparation";
import { inspectSceneProduction, MASTER_NOT_APPROVED_MESSAGE, NO_MASTER_MESSAGE, requireSceneMasterReady } from "../src/studio/sceneService";
import { ownerJob, ownerMessage } from "../app/src/serverMessages";
import { stepsDone } from "../app/src/shell/EpisodeSpine";

const root = path.join(import.meta.dirname, "..");
const src = (f: string) => readFileSync(path.join(root, f), "utf8");
const arabic = /[؀-ۿ]/;

describe("F-01 · `bal motion` with a relative path", () => {
  it("resolves the video against the caller's folder and refuses a missing file in Arabic", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "motion-rel-"));
    try {
      await writeFile(path.join(dir, "clip.mp4"), "x");
      expect(resolveMotionInput("clip.mp4", dir)).toBe(path.join(dir, "clip.mp4"));
      expect(resolveMotionInput(path.join(dir, "clip.mp4"), "/elsewhere")).toBe(path.join(dir, "clip.mp4"));
      expect(() => resolveMotionInput("missing.mp4", dir)).toThrow(/ملف الفيديو غير موجود/);
    } finally { await rm(dir, { recursive: true, force: true }); }
    expect(src("src/render/motionMeter.ts")).toContain("const file = resolveMotionInput(fileArg);");
    expect(src("src/cli/index.ts")).toContain("measureMotion(path.resolve(f),");
  });
});

const scene = (id: string, narration: string, line: number) =>
  ({ id, template: "noor-text", line, narration, sfx: [], props: { text: narration || "اختبار" } });
const planOf = (scenes: ReturnType<typeof scene>[]) =>
  ({ episode: "001", title: "اختبار", chapters: [{ number: 1, title: "تجربة", scenes }] }) as unknown as Plan;
const NOTE = "راجعت كل اللوحات المعروضة ونصوصها وتكوينها واحدة واحدة";

// 11 Nov (owner): the P-05 re-approval is superseded — a board changed after «اعتمد التجهيز» is recorded by the ledger
// itself and only its scene re-opens in step ٢ (tests/after-preparation.test.ts). recordChangedBoards stays for a
// first preparation over boards recorded earlier.
describe("P-05 · a board changed after «اعتمد التجهيز» (11 Nov: carried forward)", () => {
  it("recordChangedBoards re-records only the changed/new boards, keeps the others byte for byte and the old note", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "boards-partial-"));
    try {
      const scriptPath = path.join(dir, "script.md");
      const a = scene("c1-s1", "الجملة الأولى", 8), b = scene("c1-s2", "الجملة الثانية", 9);
      await expect(recordChangedBoards(scriptPath, planOf([a, b]), { note: NOTE })).rejects.toThrow(/لم تُسجَّل مراجعة اللوحات من قبل/);
      await recordBoards(scriptPath, planOf([a, b]), { note: NOTE });
      // Simulate a legacy entry: an unchanged board keeps whatever was recorded, never re-hashed.
      const raw = JSON.parse(await readFile(path.join(dir, "storyboard.json"), "utf8"));
      const keptA = raw.scenes["c1-s1"];
      const edited = planOf([a, { ...b, narration: "الجملة الثانية بعد التعديل" }, scene("c1-s3", "جملة جديدة", 10)]);
      const before = storyboardStatus(edited, await loadStoryboard(scriptPath));
      expect(before.changed).toEqual(["c1-s2"]);
      expect(before.fresh).toEqual(["c1-s3"]);
      const msg = storyboardBlockMessage(["c1-s2"], before);
      expect(msg).toContain("«٢ المشاهد»");
      expect(msg).not.toContain("اعتمد اللوحات المتغيّرة");
      expect(msg).not.toMatch(/المشاهد ← ستوري بورد/);

      const { record, scenes } = await recordChangedBoards(scriptPath, edited, { note: "راجعت اللوحتين المتغيّرتين وحدهما بنصهما الجديد كاملًا" });
      expect(scenes).toEqual(["c1-s2", "c1-s3"]);
      expect(record.scenes["c1-s1"]).toBe(keptA);
      expect(record.scenes["c1-s2"]).toBe(storyboardVisualHash(edited.chapters[0]!.scenes[1]!));
      expect(record.audit?.scenes).toEqual(["c1-s2", "c1-s3"]);
      expect(record.history?.[0]?.note).toBe(NOTE);
      const after = storyboardStatus(edited, await loadStoryboard(scriptPath));
      expect(after.ok).toBe(true);
      // A removed scene's board is dropped.
      const dropped = await recordChangedBoards(scriptPath, planOf([a, { ...b, narration: "تعديل ثالث للجملة الثانية" }]), { note: NOTE });
      expect(Object.keys(dropped.record.scenes)).toEqual(["c1-s1", "c1-s2"]);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  it("the never-approved case still says so, pointing to «اعتمد التجهيز»", () => {
    const st = { total: 2, approved: 0, changed: [], fresh: ["a", "b"], ok: false, scenes: { a: "new", b: "new" } } as const;
    const msg = storyboardBlockMessage(["a", "b"], { ...st, changed: [], fresh: ["a", "b"] });
    expect(msg).toContain("لم يُعتمد التجهيز بعد");
    expect(msg).toContain("«اعتمد التجهيز»");
  });

  it("a plan edit after «اعتمد التجهيز» is carried forward on read: only the changed board re-recorded, the other scene keeps its inputs", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "prep-reapprove-"));
    const env = { channels: process.env.BAL_CHANNELS_DIR, key: process.env.BAL_WORKFLOW_HMAC_KEY };
    process.env.BAL_CHANNELS_DIR = tmp;
    process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__prep_reapprove_signing_key_2026";
    try {
      const dir = path.join(tmp, "balislam", "episodes", "001-reapprove");
      await mkdir(dir, { recursive: true });
      for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
        await copyFile(path.join(root, "channels", "balislam", f), path.join(tmp, "balislam", f));
      // A script with no errors (six chapters, citations, the practical step), as in tests/studio-funnel-v3.test.ts.
      await writeFile(path.join(dir, "script.md"), `---\ntitle: "هل نعرف الصبر حقًا؟"\ndomain: psychology\nepisode: "001"\n---\n` +
        ["تجربة"].map((t, i) => // 12 Nov: no filler line that no scene says (QA balislam 2); sections are optional (D87)
   
          `## الفصل ${i + 1} · ${t}\n${i === 0 ? "الصبر مفتاح الفرج.\nوالشكر يحفظ النعمة." : "جملة قصيرة في هذا الفصل."}\n`).join("\n") +
        "\n## الاستشهادات\n\n- مصدر | كتاب الصبر، المؤلف، ص ١٢ | فكرة الصبر\n\n## الخطوة العملية\n\nاصبر اليوم على أمر واحد صغير، ثم اكتب ما تعلمته.\n");
      await writeFile(path.join(dir, "tashkeel.md"), "الصَّبْرُ مِفْتَاحُ الفَرَجِ. وَالشُّكْرُ يَحْفَظُ النِّعْمَةَ.\n");
      const a = scene("c1-s1", "الصبر مفتاح الفرج.", 7), b = scene("c1-s2", "والشكر يحفظ النعمة.", 8);
      await writeFile(path.join(dir, "plan.json"), JSON.stringify(planOf([a, b])));
      await runWithChannel("balislam", async () => {
        const s0 = await inspectSceneProduction("001");
        await approvePreparation("001", { scriptSha256: s0.script.sha256, storyboardSha256: s0.storyboard.sha256, reviewed: true, note: NOTE });
        const s1 = await inspectSceneProduction("001");
        expect(s1.boards).toEqual({ current: true, changed: [] });
        expect(stepsDone(s1)[0]).toBe(true);

        // The owner edits board 2 only (the plan, not the script): recorded by the system on the next read.
        await writeFile(path.join(dir, "plan.json"), JSON.stringify(planOf([a, { ...b, props: { text: "نص جديد على الشاشة" } }])));
        const s3 = await inspectSceneProduction("001");
        expect(s3.script.approved && s3.storyboard.approved).toBe(true);
        expect(s3.boards).toEqual({ current: true, changed: [] });
        expect(stepsDone(s3)[0]).toBe(true);
        expect((await preparationBlockers("001")).boardsRecorded).toBe(true);
        const s2 = s1;
        // Scene 1's inputs (its own board) are untouched: nothing re-opens it.
        expect(s3.scenes[0]!.sourceSha256).toBe(s2.scenes[0]!.sourceSha256);
        expect(s3.scenes[1]!.sourceSha256).not.toBe(s2.scenes[1]!.sourceSha256);
        expect(s3.scenes[1]!.afterPreparation?.what).toEqual(["board"]);
        const rec = JSON.parse(await readFile(path.join(dir, "storyboard.json"), "utf8"));
        expect(rec.history).toHaveLength(1);
        expect(rec.audit.scenes).toEqual(["c1-s2"]);

        // P-07: shorts before any Master / with an unapproved Master say exactly that, in Arabic.
        await expect(requireSceneMasterReady("001")).rejects.toThrow(NO_MASTER_MESSAGE);
      });
    } finally {
      if (env.channels === undefined) delete process.env.BAL_CHANNELS_DIR; else process.env.BAL_CHANNELS_DIR = env.channels;
      if (env.key === undefined) delete process.env.BAL_WORKFLOW_HMAC_KEY; else process.env.BAL_WORKFLOW_HMAC_KEY = env.key;
      await rm(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it("no dock line or button re-approves changed boards any more", () => {
    const spine = src("app/src/shell/EpisodeSpine.tsx");
    expect(spine).not.toContain("اعتمد اللوحات المتغيّرة");
    expect(src("app/src/tabs/StoryboardPanel.tsx")).toContain("<AfterPreparationList");
  });
});

describe("P-06 · no pointer to a screen that no longer exists", () => {
  it("messages name the four current steps", () => {
    for (const f of ["src/plan/storyboard.ts", "src/cli/index.ts", "src/plan/sceneReview.ts", "src/studio/sceneService.ts", "src/script/review.ts",
      "app/server/api.ts", "app/server/extra.ts", "app/src/serverMessages.ts"]) {
      const text = src(f);
      expect(text, f).not.toMatch(/«المشاهد ← ستوري بورد»|«المشاهد ← مراجعة المشهد»|من «إنتاج المشاهد»|في «إنتاج المشاهد»\.|الخطوتان ١ و٢|«السكريبت ← سجل التوثيق»|الستوري بورد ← «أدوات وتفاصيل»/);
    }
  });
});

describe("P-07 · owner refusals in Arabic", () => {
  it("every English refusal literal of the owner flows has an Arabic translation", () => {
    const files = ["src/studio/sceneProduction.ts", "src/studio/sceneService.ts", "src/studio/preparation.ts", "src/studio/assembleScenes.ts",
      "src/render/episode.ts", "src/render/episodePreviews.ts"];
    const missing: string[] = [];
    for (const f of files)
      for (const m of src(f).matchAll(/(?:throw (?:new )?Error|block)\("([A-Za-z][^"]*)"\)/g))
        if (!arabic.test(ownerMessage(m[1]!))) missing.push(`${f}: ${m[1]}`);
    expect(missing).toEqual([]);
    expect(ownerMessage("Malformed preparation approval.")).toMatch(arabic);
    expect(ownerMessage("Confirm that you reviewed the script and every board yourself.")).toContain("راجعته بنفسي");
    expect(ownerMessage("Error: Unknown scene.")).toBe("مشهد غير معروف.");
  });

  it("job errors and log lines pass through the translator", () => {
    const job = ownerJob({ id: "j", status: "error", error: "Publishing is blocked.", log: ["تجهيز الوسائط…", "Error: The exact current Master is not approved."] });
    expect(job.error).toMatch(arabic);
    expect(job.log[1]).toContain("النسخة النهائية لم تُعتمد بعد");
    const prep = ownerJob({ error: undefined, voice: { error: "Unknown scene." }, failed: [{ id: "a", error: "Scene inputs changed." }] } as { error?: string; voice: { error: string }; failed: { id: string; error: string }[] });
    expect(prep.voice.error).toBe("مشهد غير معروف.");
    expect(prep.failed[0]!.error).toMatch(arabic);
    expect(ownerJob(null)).toBeNull();
    const api = src("app/src/api.ts");
    expect(api).toContain('call<LongJob[]>("/api/jobs").then((js) => js.map(ownerJob))');
  });

  it("no Master vs an unapproved Master are told apart", () => {
    expect(NO_MASTER_MESSAGE).toContain("لا توجد نسخة نهائية بعد");
    expect(MASTER_NOT_APPROVED_MESSAGE).toContain("النسخة النهائية لم تُعتمد بعد");
    const svc = src("src/studio/sceneService.ts");
    expect(svc).toContain("if (!doc.masterEpoch || !doc.state.master)\n      throw Error(MASTER_NOT_APPROVED_MESSAGE);");
  });
});

describe("storyboard.json is local state bound to the ledger (D-entry)", () => {
  it("is ignored by Git and still protected by the clean start", () => {
    expect(src(".gitignore")).toMatch(/^channels\/\*\/episodes\/\*\/storyboard\.json$/m);
    expect(src("fresh-start.command")).toContain("channels/*/episodes/*/storyboard.json|");
  });
});
