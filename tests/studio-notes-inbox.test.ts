/**
 * صندوق ملاحظات المالك (docs/studio/notes-inbox.md):
 * - التصحيح يُضاف إلى الصندوق بعد نجاح كلمة المرور وتسجيل القرار فقط.
 * - الإرسال إلى studio-notes بأوامر السباكة في مستودع مؤقت (origin مستودع bare محلي): لا يمس فرع المالك
 *   ولا فهرسه ولا ملفاته، ولا يدفع main؛ والخطاف يتخطى البوابة لصناديق الملاحظات وحدها.
 * - بلا اتصال: تبقى «بانتظار الإرسال» وتُرسل في المحاولة التالية.
 * - bal notes يعرض ويرد، والرد يصل المالك مع git pull فيقول الاستوديو «أُصلحت».
 * لا شبكة ولا GitHub ولا مفاتيح.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { childEnv } from "../scripts/git-env.mjs";
import { runWithChannel } from "../src/channel";
import { approveStoryboard } from "../src/plan/storyboard";
import type { Plan } from "../src/plan/types";
import { decideSceneProduction, inspectSceneProduction, recordSceneRenderEvidence } from "../src/studio/sceneService";
import {
  appendStudioNote, correctionInboxView, inboxFileFor, parseCorrectionNote, readInbox, writeResolution,
} from "../src/studio/notesInbox";
import { notesSyncEnabled, syncStudioNotes } from "../src/studio/notesSync";
import { listStudioNotes, resolveStudioNote } from "../src/studio/notesCli";
import { noteInboxLine } from "../app/src/workspace/SceneProductionPanel";

const repo = path.resolve(import.meta.dirname, "..");
const SHA = (s: string) => createHash("sha256").update(s).digest("hex");
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", env: childEnv({ GIT_TERMINAL_PROMPT: "0" }) }).trim();
const tryGit = (cwd: string, ...args: string[]) => {
  try { return { ok: true, out: git(cwd, ...args) }; }
  catch (e) { return { ok: false, out: String((e as { stderr?: string }).stderr ?? e) }; }
};

describe("قراءة ملاحظة التصحيح", () => {
  it("يفصل النوع واللحظة والنص (problemNote)", () => {
    expect(parseCorrectionNote("[الحركة @0:12] السهم يخرج من الإطار")).toEqual({ kind: "motion", timecode: "0:12", note: "السهم يخرج من الإطار" });
    expect(parseCorrectionNote("[النبرة @1:05] حكّاء — أبطأ", "warm")).toEqual({ kind: "tone", timecode: "1:05", note: "حكّاء — أبطأ" });
    expect(parseCorrectionNote("الانتقال سريع")).toEqual({ kind: "general", timecode: null, note: "الانتقال سريع" });
  });
  it("سطر الحالة تحت الملاحظة", () => {
    expect(noteInboxLine({ sync: "sent", status: "open", answer: null })).toBe("أُرسلت الملاحظة");
    expect(noteInboxLine({ sync: "pending", status: "open", answer: null })).toBe("بانتظار الإرسال (بلا اتصال)");
    expect(noteInboxLine({ sync: "sent", status: "fixed", answer: null })).toBe("أُصلحت — أنتج المشهد من جديد");
    expect(noteInboxLine({ sync: "pending", status: "fixed", answer: "أبطأتُ السهم" })).toBe("أُصلحت — أنتج المشهد من جديد (أبطأتُ السهم)");
    const ui = readFileSync(path.join(repo, "app/src/workspace/SceneProductionPanel.tsx"), "utf8");
    expect(ui).toContain("noteInboxLine(scene.correction.inbox)");
  });
  it("الإرسال مطفأ داخل الاختبارات ما لم يُطلب صراحة", () => {
    expect(notesSyncEnabled({ VITEST: "true" })).toBe(false);
    expect(notesSyncEnabled({ VITEST: "true", BAL_NOTES_SYNC: "on" })).toBe(true);
    expect(notesSyncEnabled({ BAL_NOTES_SYNC: "off" })).toBe(false);
    expect(notesSyncEnabled({})).toBe(true);
  });
});

// ———————————————————————————— التصحيح من سجل «إنتاج المشاهد» ————————————————————————————
const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "BAL_WORKFLOW_HMAC_KEY", "BAL_STUDIO_OWNER_PASSPHRASE_SHA256"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-notes-inbox-"));
});
afterAll(() => {
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("التصحيح يُضاف إلى الصندوق بعد كلمة المرور وحدها", () => {
  it("كلمة مرور خاطئة: لا صندوق؛ صحيحة: ملاحظة واحدة «بانتظار الإرسال» تظهر تحت التصحيح، ثم «أُصلحت» من resolved.json", async () => {
    const channels = path.join(tmp, "channels");
    cpSync(path.join(repo, "channels", "dafatir-alzaman"), path.join(channels, "dafatir-alzaman"),
      { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
    process.env.BAL_CHANNELS_DIR = channels;
    delete process.env.BAL_CHANNEL;
    const passphrase = "owner-notes-inbox-2026";
    process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__notes_inbox_signing_key_2026";
    process.env.BAL_STUDIO_OWNER_PASSPHRASE_SHA256 = SHA(passphrase);
    const dir = path.join(channels, "dafatir-alzaman", "episodes", "002-notes");
    mkdirSync(path.join(dir, "voice"), { recursive: true });
    const scriptPath = path.join(dir, "script.md");
    writeFileSync(scriptPath, `---\ntitle: "اختبار"\nepisode: "002"\n---\n## الفصل 1 · تجربة\nكان الدرس الأول.\n\nوهذا مشهد ثان.\n`);
    const s1 = { id: "c1-s1", template: "hz-text", line: 6, narration: "كان الدرس الأول.", sfx: [], props: {} };
    const s2 = { id: "c1-s2", template: "hz-text", line: 8, narration: "وهذا مشهد ثان.", sfx: [], props: {} };
    const plan = { episode: "002", title: "اختبار", chapters: [{ number: 1, title: "تجربة", scenes: [s1, s2] }] } as unknown as Plan;
    writeFileSync(path.join(dir, "plan.json"), JSON.stringify(plan));
    for (const s of [s1, s2]) writeFileSync(path.join(dir, "voice", `${s.id}.wav`), "x");
    writeFileSync(path.join(dir, "voice", "index.json"), JSON.stringify(Object.fromEntries([s1, s2].map((s) =>
      [s.id, { file: `${s.id}.wav`, hash: `h-${s.id}`, text: s.narration, duration: 2, words: [] }]))));

    await runWithChannel("dafatir-alzaman", async () => {
      const st0 = await inspectSceneProduction("002");
      await decideSceneProduction("002", { action: "approve-script", expectedSha256: st0.script.sha256 }, passphrase);
      await approveStoryboard(scriptPath, plan, { note: "راجعت لوحتي الاختبار" });
      const st1 = await inspectSceneProduction("002");
      await decideSceneProduction("002", { action: "approve-storyboard", expectedSha256: st1.storyboard.sha256 }, passphrase);
      const cur = (await inspectSceneProduction("002")).scenes[0]!;
      mkdirSync(path.join(dir, "previews"), { recursive: true });
      execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=160x90:rate=15:duration=2",
        "-f", "lavfi", "-i", "sine=frequency=330:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-c:a", "aac", "-shortest",
        path.join(dir, "previews", "scene-c1-s1-av.mp4")]);
      await recordSceneRenderEvidence("002", "c1-s1", cur.sourceSha256, passphrase, "current");
      const sub = await decideSceneProduction("002", { action: "submit-scene", sceneId: "c1-s1", expectedSha256: cur.sourceSha256 }, passphrase);
      const preview = sub.scenes[0]!.previewSha256!;
      const fix = { action: "correct-scene" as const, sceneId: "c1-s1", expectedSha256: preview, note: "[الحركة @0:01] العنوان يقفز" };

      await expect(decideSceneProduction("002", fix, "wrong")).rejects.toThrow(/authentication/);
      await expect(decideSceneProduction("002", fix, undefined)).rejects.toThrow(/authentication/);
      // قرار مرفوض لغير كلمة المرور (بلا ملاحظة): لا صندوق أيضًا
      await expect(decideSceneProduction("002", { ...fix, note: " " }, passphrase)).rejects.toThrow();
      expect(existsSync(inboxFileFor(dir))).toBe(false);

      await decideSceneProduction("002", fix, passphrase);
      const inbox = await readInbox(dir);
      expect(inbox.notes).toHaveLength(1);
      const n = inbox.notes[0]!;
      expect(n).toMatchObject({ channel: "dafatir-alzaman", episode: "002-notes", sceneId: "c1-s1", kind: "motion", timecode: "0:01",
        note: "العنوان يقفز", raw: fix.note, tone: null, sceneInputSha256: cur.sourceSha256, previewSha256: preview, status: "open",
        fixedBy: null, answer: null, sync: { state: "pending" } });
      expect(n.id).toMatch(/^n[a-f0-9]{10}$/);
      // لا أسرار في الصندوق
      const text = readFileSync(inboxFileFor(dir), "utf8");
      for (const secret of [passphrase, SHA(passphrase), process.env.BAL_WORKFLOW_HMAC_KEY!]) expect(text).not.toContain(secret);

      const read = await inspectSceneProduction("002");
      expect(read.scenes[0]!.correction).toMatchObject({ note: fix.note, inbox: { id: n.id, sync: "pending", status: "open", answer: null } });
      await writeResolution(dir, n.id, { status: "fixed", answer: "ثبّتُّ العنوان", fixedBy: "abc123", at: new Date().toISOString() });
      expect((await inspectSceneProduction("002")).scenes[0]!.correction!.inbox).toMatchObject({ status: "fixed", answer: "ثبّتُّ العنوان" });
    });
  }, 60_000);
});

// ———————————————————————————— الإرسال إلى studio-notes في مستودع مؤقت ————————————————————————————
describe("الإرسال إلى studio-notes", () => {
  let origin = "", owner = "", claude = "", epDir = "", originMain = "";
  const ownerSnapshot = () => ({
    head: git(owner, "symbolic-ref", "HEAD"),
    headSha: git(owner, "rev-parse", "HEAD"),
    status: git(owner, "status", "--porcelain", "--untracked-files=all"),
    staged: git(owner, "diff", "--cached"),
    unstaged: git(owner, "diff"),
    branches: git(owner, "for-each-ref", "--format=%(refname)", "refs/heads"),
    readme: readFileSync(path.join(owner, "README.md"), "utf8"),
    scratch: readFileSync(path.join(owner, "scratch.txt"), "utf8"),
  });
  const note = (seq: number, raw: string) => appendStudioNote(epDir, {
    channel: "zubdat-alkutub", episode: "001-test", sceneId: `c1-s${seq}`, raw, createdAt: `2026-11-09T10:0${seq}:00.000Z`,
    sceneInputSha256: "a".repeat(64), previewSha256: "b".repeat(64), ledgerSeq: seq });

  beforeAll(() => {
    const base = mkdtempSync(path.join(tmp || os.tmpdir(), "git-"));
    origin = path.join(base, "origin.git");
    owner = path.join(base, "owner");
    claude = path.join(base, "claude");
    git(base, "init", "--bare", "-b", "main", origin);
    git(base, "init", "-b", "main", owner);
    for (const [k, v] of [["user.name", "Owner"], ["user.email", "owner@example.invalid"]]) git(owner, "config", k!, v!);
    // خطاف المشروع الحقيقي: البوابة الكاملة لأي مرجع غير studio-notes (لا gate.mjs هنا، فتفشل وترفض الدفع)
    mkdirSync(path.join(owner, ".githooks"));
    copyFileSync(path.join(repo, ".githooks", "pre-push"), path.join(owner, ".githooks", "pre-push"));
    git(owner, "config", "core.hooksPath", ".githooks");
    writeFileSync(path.join(owner, ".gitignore"), "channels/*/episodes/*/notes/inbox.json\nchannels/*/episodes/*/notes/*.json.*.tmp\n");
    writeFileSync(path.join(owner, "README.md"), "v1\n");
    epDir = path.join(owner, "channels", "zubdat-alkutub", "episodes", "001-test");
    mkdirSync(epDir, { recursive: true });
    writeFileSync(path.join(epDir, "script.md"), "# test\n");
    git(owner, "add", "-A");
    git(owner, "commit", "-m", "init");
    git(owner, "remote", "add", "origin", origin);
    git(origin, "fetch", "-q", owner, "+refs/heads/main:refs/heads/main"); // main على origin بالجلب منه، لا بالدفع
    git(owner, "fetch", "origin");
    git(owner, "branch", "--set-upstream-to=origin/main", "main");
    originMain = git(origin, "rev-parse", "refs/heads/main");
    // عمل المالك غير المحفوظ: تعديل غير مرحَّل، وتغيير مرحَّل، وملف غير متتبَّع
    writeFileSync(path.join(owner, "README.md"), "v1\nlocal edit\n");
    writeFileSync(path.join(owner, "staged.txt"), "staged\n");
    git(owner, "add", "staged.txt");
    writeFileSync(path.join(owner, "scratch.txt"), "untracked\n");
  });

  it("يرسل الصندوق وحده إلى studio-notes دون أن يمس فرع المالك أو فهرسه أو ملفاته، ولا يدفع main", async () => {
    await note(1, "[الحركة @0:03] السهم سريع");
    const before = ownerSnapshot();
    expect(before.status).not.toContain("inbox.json"); // متجاهَل على main: لا يعطّل git pull ولا التحديث
    const r = await syncStudioNotes({ channelsDir: path.join(owner, "channels") });
    expect(r).toMatchObject({ ok: true, pushed: true });
    expect(ownerSnapshot()).toEqual(before);
    expect(git(origin, "rev-parse", "refs/heads/main")).toBe(originMain);
    const tip = git(origin, "rev-parse", "refs/heads/studio-notes");
    expect(git(origin, "ls-tree", "-r", "--name-only", tip)).toBe("channels/zubdat-alkutub/episodes/001-test/notes/inbox.json");
    const pushed = JSON.parse(git(origin, "show", `${tip}:channels/zubdat-alkutub/episodes/001-test/notes/inbox.json`));
    expect(pushed.notes).toHaveLength(1);
    expect(pushed.notes[0]).not.toHaveProperty("sync");
    expect(pushed.notes[0]).toMatchObject({ kind: "motion", timecode: "0:03", note: "السهم سريع", status: "open" });
    expect((await readInbox(epDir)).notes[0]!.sync).toMatchObject({ state: "sent", commit: tip });
    expect((await correctionInboxView(epDir, 1))!.sync).toBe("sent");
    // لا شيء جديد للإرسال: لا commit جديد
    expect(await syncStudioNotes({ channelsDir: path.join(owner, "channels") })).toMatchObject({ ok: true, pushed: false });
    expect(git(origin, "rev-parse", "refs/heads/studio-notes")).toBe(tip);
  });

  it("بلا اتصال: تبقى «بانتظار الإرسال»، ثم تُرسل كلها في المحاولة التالية فوق ما سبق (إضافة فقط)", async () => {
    git(owner, "remote", "set-url", "origin", path.join(path.dirname(origin), "missing.git"));
    await note(2, "[النبرة @0:07] أهدأ");
    const before = ownerSnapshot();
    const off = await syncStudioNotes({ channelsDir: path.join(owner, "channels") });
    expect(off).toMatchObject({ ok: false, reason: "offline" });
    expect(ownerSnapshot()).toEqual(before);
    const queued = (await readInbox(epDir)).notes;
    expect(queued[0]!.sync!.state).toBe("sent"); // ما أُرسل لا يرجع «بانتظار»
    expect(queued[1]!.sync).toMatchObject({ state: "pending" });
    expect(queued[1]!.sync!.lastError).toMatch(/^offline/);
    expect((await correctionInboxView(epDir, 2))!.sync).toBe("pending");

    git(owner, "remote", "set-url", "origin", origin);
    await note(3, "[الحركة @0:09] الكلمة تتأخر");
    const on = await syncStudioNotes({ channelsDir: path.join(owner, "channels") });
    expect(on).toMatchObject({ ok: true, pushed: true });
    const tip = git(origin, "rev-parse", "refs/heads/studio-notes");
    expect(git(origin, "rev-list", "--count", tip)).toBe("2");
    const pushed = JSON.parse(git(origin, "show", `${tip}:channels/zubdat-alkutub/episodes/001-test/notes/inbox.json`));
    expect(pushed.notes.map((n: { sceneId: string }) => n.sceneId)).toEqual(["c1-s1", "c1-s2", "c1-s3"]);
    expect((await readInbox(epDir)).notes.every((n) => n.sync?.state === "sent")).toBe(true);
    expect(ownerSnapshot()).toEqual(before);
    expect(git(origin, "rev-parse", "refs/heads/main")).toBe(originMain);
  });

  it("الخطاف: لا تخطٍّ لـ main، ولا لـ studio-notes إن كان فيه ملف غير الصناديق", () => {
    const tree = git(owner, "write-tree"); // شجرة الفهرس الحالي (كود)، بلا تعديل للفهرس
    // تقدّم سريع فوق الفرع، فلا يرفضه git قبل الخطاف: الخطاف وحده يقرر
    const codeCommit = git(owner, "commit-tree", tree, "-p", git(origin, "rev-parse", "refs/heads/studio-notes"), "-m", "not notes");
    const toNotes = tryGit(owner, "push", "origin", `${codeCommit}:refs/heads/studio-notes`);
    expect(toNotes.ok).toBe(false);
    expect(toNotes.out).toMatch(/رُفض الدفع/);
    // شجرة صناديق ملاحظات فقط، تقدّم سريع فوق main: إلى main تمر على البوابة كاملة (لا تخطٍّ)
    const notesTree = git(owner, "rev-parse", `${git(origin, "rev-parse", "refs/heads/studio-notes")}^{tree}`);
    const notesOnMain = git(owner, "commit-tree", notesTree, "-p", originMain, "-m", "notes on main");
    const toMain = tryGit(owner, "push", "origin", `${notesOnMain}:refs/heads/main`);
    expect(toMain.ok).toBe(false);
    expect(toMain.out).toMatch(/رُفض الدفع/);
    expect(git(origin, "rev-parse", "refs/heads/main")).toBe(originMain);
  });

  it("bal notes يعرض المفتوحة من origin/studio-notes، والرد على main يصل المالك بعد git pull", async () => {
    git(path.dirname(claude), "clone", "-q", origin, claude);
    for (const [k, v] of [["user.name", "Claude"], ["user.email", "claude@example.invalid"]]) git(claude, "config", k!, v!);
    const open = await listStudioNotes({ repoDir: claude, open: true });
    expect(open.fetched).toBe("ok");
    expect(open.notes.map((n) => n.sceneId)).toEqual(["c1-s1", "c1-s2", "c1-s3"]);
    expect(open.notes[1]).toMatchObject({ kind: "tone", timecode: "0:07", status: "open", sync: "remote" });
    expect((await listStudioNotes({ repoDir: claude, channel: "balislam" })).notes).toHaveLength(0);

    const id = open.notes[0]!.id;
    const r = await resolveStudioNote({ repoDir: claude, id, answer: "أبطأتُ السهم", fixedBy: "fix-sha" });
    expect(r.file).toBe("channels/zubdat-alkutub/episodes/001-test/notes/resolved.json");
    await expect(resolveStudioNote({ repoDir: claude, id: "n0000000000", answer: "x" })).rejects.toThrow(/No studio note/);
    expect((await listStudioNotes({ repoDir: claude, open: true })).notes.map((n) => n.sceneId)).toEqual(["c1-s2", "c1-s3"]);
    const all = await listStudioNotes({ repoDir: claude });
    expect(all.notes[0]).toMatchObject({ status: "fixed", answer: "أبطأتُ السهم", fixedBy: "fix-sha" });

    // Claude يحفظ الرد على main (مستودع الاختبار فقط)، والمالك يسحب بلا تعارض رغم عمله غير المحفوظ
    git(claude, "add", r.file);
    git(claude, "commit", "-q", "-m", "resolve note");
    git(origin, "fetch", "-q", claude, "+refs/heads/main:refs/heads/main"); // يجلبه origin (لا دفع ولا بوابة في الاختبار)
    git(owner, "pull", "-q", "--ff-only", "origin", "main");
    expect(readFileSync(path.join(owner, "README.md"), "utf8")).toBe("v1\nlocal edit\n");
    const view = await correctionInboxView(epDir, 1);
    expect(view).toMatchObject({ id, status: "fixed", answer: "أبطأتُ السهم", sync: "sent" });
    expect(noteInboxLine(view!)).toBe("أُصلحت — أنتج المشهد من جديد (أبطأتُ السهم)");
    expect((await correctionInboxView(epDir, 2))!.status).toBe("open");
  }, 60_000);
});
