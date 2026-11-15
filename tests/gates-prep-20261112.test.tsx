/**
 * QA 12 Nov 2026 — preparation, approvals and dangerous actions (balislam 1/2/3/7/9, dafatir M1/M2/M3/M5/M7,
 * zubdat D-7/D-23, gate order). One regression per item.
 */
import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { BoardAuditLog, AfterPreparationList } from "../app/src/tabs/BoardAuditLog";
import { STORYBOARD_REVOKE_REFUSED } from "../src/plan/storyboard";
import { syncNarrationText } from "../src/script/narrationSync";
import { scenesWithoutTone } from "../src/studio/preparation";
import { pickRenderQueue } from "../src/studio/prepareAll";
import { voiceResultMessage, NO_VOICE_KEY } from "../app/src/workspace/voiceResult";
import { trashWhat } from "../app/src/tabs/HomeTab";
import { acquireLock } from "../src/io/processLock";
import type { Plan } from "../src/plan/types";
import { panelSource } from "./helpers/panelSource";

const root = path.join(import.meta.dirname, "..");
const src = (f: string) => panelSource(f);

describe("balislam 1 · «اعتمد التجهيز» is never withdrawn (D76)", () => {
  it("the board log is read-only history: no «اسحب الاعتماد», no second board approval", () => {
    const st = { total: 3, approved: 3, changed: [], fresh: [], ok: true, scenes: {}, audit: { note: "سليم", at: "2026-11-12T10:00:00.000Z" } };
    const html = renderToStaticMarkup(<BoardAuditLog st={st} channelId="balislam" episodeId="951" />);
    expect(html).toContain("سجل مراجعة اللوحات");
    expect(html).toContain("للقراءة فقط");
    expect(html).not.toContain("اسحب الاعتماد");
    expect(html).not.toContain("تسجيل اعتماد اللوحات المرئية");
    expect(html).not.toMatch(/<button|<input/);
  });
  it("the server refuses a withdrawal and nothing in the studio can empty the board record", () => {
    const extra = src("app/server/routes/preparation.ts");
    expect(extra).toContain("S.STORYBOARD_REVOKE_REFUSED");
    expect(extra).not.toContain("revokeStoryboard");
    expect(STORYBOARD_REVOKE_REFUSED).toContain("D76");
    expect(src("src/plan/storyboard.ts")).not.toMatch(/export const revokeStoryboard/);
    expect(src("app/src/api.ts")).not.toMatch(/"approve" \| "revoke"/);
    expect(src("app/src/tabs/StoryboardPanel.tsx")).not.toContain("api.setStoryboard");
  });
});

describe("balislam 2 · one text: script.md and the scene say the same words", () => {
  const script = "## تجربة\n\nفي سوق صغير، وقف شخصان أمام ميزان بائع الفاكهة.\n\nنظر الأول إلى الميزان، وقال:\n\n﴿وَلَا تَلْبِسُوا الْحَقَّ بِالْبَاطِلِ﴾\n";
  it("a sentence edit is written into the script at its one place", () => {
    const next = syncNarrationText(script, "في سوق صغير، وقف شخصان أمام ميزان بائع الفاكهة.", "في سوق صغير قديم، وقف شخصان أمام ميزان بائع الفاكهة.");
    expect(next).toContain("في سوق صغير قديم، وقف شخصان");
    expect(next!.replace("صغير قديم،", "صغير،")).toBe(script);
  });
  it("a word that also occurs inside another word or twice is widened until unique, else nothing is written", () => {
    const s = "قال الأول: الحق واضح.\n\nقال الثاني: الحق غائب.\n";
    expect(syncNarrationText(s, "قال الثاني: الحق غائب.", "قال الثاني: الحق خفي.")).toBe("قال الأول: الحق واضح.\n\nقال الثاني: الحق خفي.\n");
    expect(syncNarrationText("مدينة قديمة.", "مدينة قديم.", "مدينة عتيق.")).toBeNull();
    expect(syncNarrationText("نص آخر تمامًا.", "في سوق صغير.", "في سوق كبير.")).toBeNull();
  });
  it("verse text is never touched", () => {
    expect(syncNarrationText(script, "وَلَا تَلْبِسُوا الْحَقَّ", "وَلَا تَلْبِسُوا")).toBeNull();
  });
  it("the checklist flags it and the approval refuses it; production of the scene is blocked", () => {
    expect(src("src/studio/preparation.ts")).toContain("textDivergenceRefusal(blockers.textDiverged");
    expect(src("src/studio/preparation.ts")).toContain("return textDivergenceRefusal(d, plan)");
    expect(src("src/studio/afterPreparation.ts")).toContain("textBlocks");
    expect(src("src/studio/sceneLedgerState.ts")).toContain("await textBlocks(current.scriptPath, plan)");
    expect(src("app/src/shell/EpisodeSpine.tsx")).toContain("اللوحات والسكريبت");
    // the reverse direction: «عدّل النص» and the scene editor write script.md too
    expect(src("src/voice/sentenceVoice.ts")).toContain("await syncScriptNarration(scriptPath, before, narration)");
    expect(src("src/plan/io.ts")).toContain("await syncScriptNarration(scriptPath, before, s.narration ?? \"\")");
  });
});

describe("balislam 2 · end to end on a copy of an episode", () => {
  it("a script edit on a designed plan refuses «اعتمد التجهيز» and names the scene; syncing back clears it", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "gates-div-"));
    const env = { channels: process.env.BAL_CHANNELS_DIR, key: process.env.BAL_WORKFLOW_HMAC_KEY };
    process.env.BAL_CHANNELS_DIR = tmp;
    process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__gates_prep_key_2026";
    try {
      const from = path.join(root, "channels", "balislam", "episodes", "001-know-the-truth");
      const dir = path.join(tmp, "balislam", "episodes", "951-qa-know-the-truth");
      await mkdir(dir, { recursive: true });
      for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
        await copyFile(path.join(root, "channels", "balislam", f), path.join(tmp, "balislam", f));
      for (const f of ["script.md", "plan.json", "tashkeel.md"]) if (existsSync(path.join(from, f))) await copyFile(path.join(from, f), path.join(dir, f));
      const { runWithChannel } = await import("../src/channel");
      await runWithChannel("balislam", async () => {
        const { preparationBlockers, approvePreparation } = await import("../src/studio/preparation");
        const { inspectSceneProduction } = await import("../src/studio/sceneService");
        expect((await preparationBlockers("951")).textDiverged).toEqual({ scenes: [], unplaced: [] });
        const script = await readFile(path.join(dir, "script.md"), "utf8");
        expect(script).toContain("في سوق صغير، وقف شخصان");
        await writeFile(path.join(dir, "script.md"), script.replace("في سوق صغير، وقف شخصان", "في سوق صغير قديم، وقف شخصان"));
        const b = await preparationBlockers("951");
        expect(b.textDiverged.scenes).toEqual(["c1-s2"]);
        const s0 = await inspectSceneProduction("951");
        expect(s0.scenes.find((x) => x.id === "c1-s2")?.blocked?.[0]).toContain("يختلف عن السكريبت");
        await expect(approvePreparation("951", { scriptSha256: s0.script.sha256, storyboardSha256: s0.storyboard.sha256, reviewed: true }))
          .rejects.toThrow(/المشهد ٢/);
        // The owner corrects the scene from the studio: the same words reach the plan, and nothing differs any more.
        const { savePlanFromStudio, readPlanFile } = await import("../src/plan/io");
        await writeFile(path.join(dir, "script.md"), script);
        const plan = (await readPlanFile(path.join(dir, "script.md")))! as Plan;
        const sc = plan.chapters.flatMap((c) => c.scenes).find((x) => x.id === "c1-s2")!;
        const before = sc.narration;
        sc.narration = before.replace("في سوق صغير،", "في سوق صغير قديم،");
        await savePlanFromStudio("951", plan);
        expect(await readFile(path.join(dir, "script.md"), "utf8")).toContain("في سوق صغير قديم، وقف شخصان");
        expect((await preparationBlockers("951")).textDiverged).toEqual({ scenes: [], unplaced: [] });
      });
    } finally {
      if (env.channels === undefined) delete process.env.BAL_CHANNELS_DIR; else process.env.BAL_CHANNELS_DIR = env.channels;
      if (env.key === undefined) delete process.env.BAL_WORKFLOW_HMAC_KEY; else process.env.BAL_WORKFLOW_HMAC_KEY = env.key;
      await rm(tmp, { recursive: true, force: true });
    }
  }, 120_000);
});

describe("balislam 3 · no success line for nothing", () => {
  it("a dry run without a key is said as such", () => {
    expect(voiceResultMessage({ generated: false, noKey: true, report: { total: 0, toGenerate: [] } })).toEqual({ ok: false, text: NO_VOICE_KEY });
    expect(voiceResultMessage({ generated: true, report: { total: 1, toGenerate: [] } }).ok).toBe(false);
    expect(voiceResultMessage({ generated: true, report: { total: 1, toGenerate: [{}] } })).toEqual({ ok: true, text: "وُلّد الصوت." });
    expect(voiceResultMessage({ generated: true, sentences: { generated: 0, composed: null } }).ok).toBe(false);
  });
  it("the tone card without a key only sends the note, and says nothing was generated", () => {
    const ui = src("app/src/workspace/SceneProductionPanel.tsx");
    expect(ui).toContain(`p.problem.kind === "tone" && p.canVoice ? "أرسل وأعد توليد الصوت" : "أرسل الملاحظة"`);
    expect(ui).toContain("if (!hasVoiceKeys) { setVoiceMsg(NO_VOICE_KEY_AFTER_NOTE); return; }");
    expect(ui).not.toContain(`: "وُلّد الصوت.");`);
    expect(src("app/server/api.ts")).toContain("...(client ? {} : { noKey: true })");
  });
});

describe("balislam 7 · delete is local, shown and reversible; the studio never pushes", () => {
  it("moves the folder (paid takes included) to the trash and «تراجع» puts it back", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "gates-trash-"));
    const was = process.env.BAL_TRASH_DIR;
    process.env.BAL_TRASH_DIR = path.join(tmp, "trash");
    try {
      const rel = "channels/balislam/episodes/952-qa-procrastination";
      const dir = path.join(tmp, rel);
      await mkdir(path.join(dir, "voice", "superseded"), { recursive: true });
      await writeFile(path.join(dir, "script.md"), "نص");
      await writeFile(path.join(dir, "voice", "superseded", "take-1.mp3"), Buffer.alloc(2048, 1));
      await mkdir(path.join(tmp, "balislam-archive"), { recursive: true });
      const T = await import("../src/studio/episodeTrash");
      const c = await T.episodeContents(dir);
      expect(c).toMatchObject({ files: 2, voiceFiles: 1 });
      const e = await T.trashEpisode(tmp, rel, { channel: "balislam", title: "تجربة" });
      expect(existsSync(dir)).toBe(false);
      const moved = path.join(tmp, "trash", "balislam", e.id, "voice", "superseded", "take-1.mp3");
      expect((await readFile(moved)).length).toBe(2048);
      expect((await T.listTrash("balislam")).map((x) => x.id)).toEqual([e.id]);
      await expect(T.trashEpisode(tmp, "channels/balislam/episodes/../x", { channel: "balislam" })).rejects.toThrow();
      await T.restoreEpisode(tmp, "balislam", e.id);
      expect((await readFile(path.join(dir, "voice", "superseded", "take-1.mp3"))).length).toBe(2048);
      expect(await T.listTrash("balislam")).toEqual([]);
      await expect(T.restoreEpisode(tmp, "balislam", e.id)).rejects.toThrow();
    } finally {
      if (was === undefined) delete process.env.BAL_TRASH_DIR; else process.env.BAL_TRASH_DIR = was;
      await rm(tmp, { recursive: true, force: true });
    }
  });
  it("the confirmation says exactly what moves, and that nothing goes to GitHub", () => {
    const t = trashWhat({ dir: "channels/balislam/episodes/951-x", trash: "/Users/o/balislam-backup/trash",
      contents: { files: 12, bytes: 5_000_000, voiceFiles: 4, videoFiles: 2, tracked: 3 } });
    expect(t).toContain("channels/balislam/episodes/951-x");
    expect(t).toContain("التسجيلات المدفوعة");
    expect(t).toContain("لا يُرفع شيء إلى GitHub");
    expect(t).toContain("«تراجع»");
  });
  it("no git commit, push or archive deletion is triggered from the studio server (notes inbox and D101 owner-content save excepted)", async () => {
    const files = async (d: string): Promise<string[]> => (await readdir(d, { withFileTypes: true })).flatMap((x) =>
      x.isDirectory() ? [] : [path.join(d, x.name)]).concat(...await Promise.all((await readdir(d, { withFileTypes: true }))
        .filter((x) => x.isDirectory()).map((x) => files(path.join(d, x.name)))));
    const all = [...await files(path.join(root, "app/server")), ...await files(path.join(root, "src/studio"))].filter((f) => /\.ts$/.test(f));
    for (const f of all) {
      const text = readFileSync(f, "utf8");
      // D101 (قرار صاحب المشروع ١٢ نوفمبر): contentSync.ts وحده يدفع، ملفات محتوى المالك فقط إلى main عبر الخطاف، بلا --force ولا --no-verify
      if (f.endsWith("contentSync.ts")) {
        expect(text).toMatch(/isOwnerContentPath/);
        expect(text).toMatch(/:refs\/heads\/main`/);
        expect(text).not.toMatch(/--no-verify|--force|"-f"/);
        expect(text).not.toMatch(/"balislam-archive"/);
        continue;
      }
      // studio-notes وحده (D107، وعلم «جلسة عمل» D141): notesSync.ts وworkSession.ts بلا --force ولا --no-verify
      if (f.endsWith("notesSync.ts") || f.endsWith("workSession.ts")) {
        expect(text, f).toMatch(/\$\{NOTES_REF\}`/);
        expect(text, f).not.toMatch(/"--no-verify"|"--force"|"-f"/);
      }
      if (!f.endsWith("notesSync.ts") && !f.endsWith("workSession.ts")) expect(text, f).not.toMatch(/\["push"|"push",|\["commit"|"commit",|"commit-tree"/);
      expect(text, f).not.toMatch(/"balislam-archive"/);
    }
  });
});

describe("balislam 9 / zubdat D-7 / dafatir M1–M3 · preparation says what it did", () => {
  const q = (ids: string[]) => ids.map((id) => ({ id, sourceSha256: id.padEnd(64, "0") }));
  it("D145: verse and end scenes after a scene still waiting for its voice are drafted too (any order), never «needs voice»", () => {
    const r = pickRenderQueue({ list: q(["c1-s1", "c1-s31", "c1-end"]), beforeVoiceGap: q(["c1-s1"]), gap: "c1-s3" }, { voiceMissing: true });
    expect(r.todo.map((x) => x.id)).toEqual(["c1-s1", "c1-s31", "c1-end"]);
    expect(r.skipped).toEqual([]);
  });
  it("a tone-map scene and the basmala are not «without tone»", () => {
    const plan = { chapters: [{ number: 1, title: "", scenes: [
      { id: "c1-s0", template: "horizon-shot", narration: "" },
      { id: "c1-s1", template: "horizon-shot", narration: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" },
      { id: "c1-s2", template: "horizon-shot", narration: "عرفت الأرض قبل الإنسان أزمنة طويلة." },
      { id: "c1-s3", template: "horizon-shot", narration: "ثم جاء الخبر." },
    ] }] } as unknown as Plan;
    expect(scenesWithoutTone(plan, undefined, new Set(["c1-s2"]))).toEqual(["c1-s3"]);
    expect(scenesWithoutTone(plan, undefined, new Set(["c1-s2", "c1-s3"]))).toEqual([]);
  });
  it("a lock in a missing voice/ folder creates the folder instead of failing with ENOENT", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "gates-lock-"));
    try {
      const release = await acquireLock(path.join(tmp, "voice", "sentences.json.lock"), { purpose: "test", busyMessage: "busy" });
      expect(existsSync(path.join(tmp, "voice"))).toBe(true);
      await release();
      expect(existsSync(path.join(tmp, "voice", "sentences.json.lock"))).toBe(false);
    } finally { await rm(tmp, { recursive: true, force: true }); }
  });
  it("the status line shows the real voice error first, a summary when done, and «أوقف» while running", () => {
    const ui = src("app/src/workspace/PrepareAll.tsx");
    expect(ui).toContain("توقف توليد الصوت: {named(job.voice.error?.split(\"\\n\")[0])}");
    expect(ui).toContain("/نبرة/.test(job.voice.error");
    expect(ui).toContain("انتهى التجهيز:");
    expect(ui).toContain(`className="prep-note is-summary"`);
    expect(src("app/src/shell/screens-s3.css")).toContain(".prep-note:not(.is-err):not(.is-summary)");
    expect(ui).toContain('"أوقف"');
    expect(src("src/studio/prepareAll.ts")).toContain("await mkdir(voiceDirFor(await resolveScriptPath(episode)), { recursive: true });");
  });
});

describe("dafatir M5 · «تغيّر بعد التجهيز» keeps every re-opened scene", () => {
  it("the read model lists every scene re-opened and not approved since; a script-only change is said", () => {
    const svc = src("src/studio/sceneLedgerState.ts");
    expect(svc).toContain("const a = afterPreparationOf(data.history, s.id);");
    expect(svc).toContain("scriptOnly: Boolean(last.change.script) && !last.change.scenes.length");
    const html = renderToStaticMarkup(<AfterPreparationList scenes={[]} scriptOnly name={(id) => id} onOpenScene={() => {}} />);
    expect(html).toContain("غيّر السكريبت وحده");
  });
});

describe("gates · the order is checked before any file, in the owner's words", () => {
  it("assembly, Master and publish refusals come before ffprobe", () => {
    const svc = src("src/studio/sceneDecisions.ts");
    const at = svc.indexOf("await gateOrderRefusal(p, command, current.scriptPath);");
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(svc.indexOf('} else if (command.action === "assemble") {'));
    expect(svc).toContain("throw Error(NO_ASSEMBLY_MESSAGE)");
  });
  it("the seams view before an assembly is a locked explanation, with no seam count", () => {
    const ui = src("app/src/workspace/SceneProductionPanel.tsx");
    expect(ui).toContain("الوصلات تُسمع بعد التجميع");
    expect(src("app/src/App.tsx")).toContain("sub: w?.assembly && w.seams.length ? arNum(w.seams.length) : undefined"); // D102: Arabic digits
  });
});
