/**
 * العمل ٢ من مرحلة الاستقرار (D106/D107): صندوق الملاحظات يعمل فعلًا.
 * - KI-001: أول إرسال ينشئ الفرع studio-notes حين لا وجود له، عبر الخطاف الحقيقي؛ والفشل يُقرأ بسببه الحقيقي
 *   فورًا من studioNotesStatus (المؤشر «ملاحظات لم تُرسل: N») بلا تحديث للصفحة.
 * - KI-008: نسخة ليست استوديو المالك (worktree، فرع غير main، اختبار أو CI أو جلسة سحابية) لا تدفع أبدًا،
 *   والاختبار لا يدفع إلا إلى مستودع bare محلي.
 * - معيار القبول: ملاحظة من الاستوديو (decideSceneProduction) ← studio-notes ← `bal notes --open` ← resolve
 *   ← سحب ← «أُصلحت» في الاستوديو.
 * لا شبكة ولا GitHub ولا مفاتيح: origin مستودع bare مؤقت.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { childEnv } from "../scripts/git-env.mjs";
import { runWithChannel } from "../src/channel";
import { approveStoryboard } from "../src/plan/storyboard";
import type { Plan } from "../src/plan/types";
import { decideSceneProduction, inspectSceneProduction, recordSceneRenderEvidence } from "../src/studio/sceneService";
import { appendStudioNote, readInbox } from "../src/studio/notesInbox";
import { AUTH_FAILURE, NETWORK_FAILURE, isLocalRemote, notesSendPolicy, studioNotesStatus, syncStudioNotes } from "../src/studio/notesSync";
import { listStudioNotes, resolveStudioNote } from "../src/studio/notesCli";
import { noteInboxLine } from "../app/src/workspace/SceneProductionPanel";
import { notesReasonText } from "../app/src/ui/NotesBadge";

const repo = path.resolve(import.meta.dirname, "..");
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", env: childEnv({ GIT_TERMINAL_PROMPT: "0" }) }).trim();
const has = (bare: string, ref: string) => {
  try { git(bare, "rev-parse", "--verify", "--quiet", ref); return true; } catch { return false; }
};
/** A test asks for sending explicitly, and only ever to a bare repository on this disk. */
const TEST_ENV = { ...process.env, BAL_NOTES_SYNC: "on" } as NodeJS.ProcessEnv;

let tmp = "";
beforeAll(() => { tmp = mkdtempSync(path.join(os.tmpdir(), "bal-notes-owner-")); });
afterAll(() => { if (tmp) rmSync(tmp, { recursive: true, force: true }); });

/** owner = نسخة المالك على main بخطاف المشروع الحقيقي، وorigin = bare بلا فرع studio-notes. */
const makeOwnerRepo = (name: string, seed?: (owner: string) => void) => {
  const base = mkdtempSync(path.join(tmp, `${name}-`));
  const origin = path.join(base, "origin.git"), owner = path.join(base, "owner");
  git(base, "init", "-q", "--bare", "-b", "main", origin);
  git(base, "init", "-q", "-b", "main", owner);
  for (const [k, v] of [["user.name", "Owner"], ["user.email", "owner@example.invalid"]]) git(owner, "config", k!, v!);
  mkdirSync(path.join(owner, ".githooks"));
  copyFileSync(path.join(repo, ".githooks", "pre-push"), path.join(owner, ".githooks", "pre-push"));
  git(owner, "config", "core.hooksPath", ".githooks");
  copyFileSync(path.join(repo, ".gitignore"), path.join(owner, ".gitignore"));
  writeFileSync(path.join(owner, "README.md"), "v1\n");
  seed?.(owner);
  git(owner, "add", "-A");
  git(owner, "commit", "-q", "-m", "init");
  git(owner, "remote", "add", "origin", origin);
  git(origin, "fetch", "-q", owner, "+refs/heads/main:refs/heads/main"); // main على origin بالجلب منه، لا بالدفع
  git(owner, "fetch", "-q", "origin");
  git(owner, "branch", "-q", "--set-upstream-to=origin/main", "main");
  return { base, origin, owner };
};
const addNote = (epDir: string, seq: number, raw = `[الحركة @0:0${seq}] ملاحظة ${seq}`) => appendStudioNote(epDir, {
  channel: "zubdat-alkutub", episode: path.basename(epDir), sceneId: `c1-s${seq}`, raw, createdAt: `2026-11-12T10:0${seq}:00.000Z`,
  sceneInputSha256: "a".repeat(64), previewSha256: "b".repeat(64), ledgerSeq: seq });

describe("من يرسل إلى صندوق المالك (KI-008)", () => {
  it("استوديو المالك وحده: نسخة المستودع الرئيسية على main، على ماك أو ويندوز، خارج الاختبار وCI والسحابة", async () => {
    const { owner } = makeOwnerRepo("policy");
    const gh = "https://github.com/owner/balislam.git";
    expect(await notesSendPolicy(owner, gh, {}, "darwin")).toEqual({ ok: true });
    expect(await notesSendPolicy(owner, gh, {}, "win32")).toEqual({ ok: true });
    for (const [env, platform] of [[{}, "linux"], [{ VITEST: "true" }, "darwin"], [{ CI: "true" }, "darwin"],
      [{ CLAUDE_CODE_REMOTE: "true" }, "darwin"], [{ BAL_NOTES_SYNC: "off" }, "darwin"]] as const) {
      expect((await notesSendPolicy(owner, gh, env, platform)).ok, JSON.stringify([env, platform])).toBe(false);
    }
    // «on» في اختبار أو سحابة: لمستودع على القرص وحده، أبدًا إلى GitHub
    expect(await notesSendPolicy(owner, gh, { VITEST: "true", BAL_NOTES_SYNC: "on" }, "linux")).toMatchObject({ ok: false });
    expect(await notesSendPolicy(owner, gh, { CLAUDE_CODE_REMOTE: "1", BAL_NOTES_SYNC: "on" }, "linux")).toMatchObject({ ok: false });
    expect(await notesSendPolicy(owner, "/tmp/origin.git", { VITEST: "true", BAL_NOTES_SYNC: "on" }, "linux")).toEqual({ ok: true });
    expect(isLocalRemote("git@github.com:owner/balislam.git")).toBe(false);
    expect(isLocalRemote("file:///tmp/x.git")).toBe(true);
  });

  it("نسخة عمل (worktree) لا ترسل ولو طُلب الإرسال صراحة، وفرع غير main كذلك؛ والسبب يظهر في المؤشر", async () => {
    const { base, origin, owner } = makeOwnerRepo("worktree");
    const wt = path.join(base, "wt");
    git(owner, "worktree", "add", "-q", "-b", "agent-work", wt);
    const ep = path.join(wt, "channels", "zubdat-alkutub", "episodes", "001-wt");
    await addNote(ep, 1);
    const r = await syncStudioNotes({ channelsDir: path.join(wt, "channels"), env: TEST_ENV });
    expect(r).toMatchObject({ ok: false, reason: "not-owner" });
    expect(has(origin, "refs/heads/studio-notes")).toBe(false);
    const st = await studioNotesStatus(path.join(wt, "channels"));
    expect(st).toMatchObject({ pending: 1, reason: "not-owner" });
    expect(notesReasonText(st)).toMatch(/ليست استوديو المالك/);
    expect(noteInboxLine({ sync: "pending", status: "open", answer: null, reason: "not-owner" })).toMatch(/ليست استوديو المالك/);

    // نسخة المالك نفسها على فرع آخر: لا إرسال
    git(owner, "switch", "-q", "-c", "side");
    const ep2 = path.join(owner, "channels", "zubdat-alkutub", "episodes", "001-side");
    await addNote(ep2, 2);
    expect(await syncStudioNotes({ channelsDir: path.join(owner, "channels"), env: TEST_ENV })).toMatchObject({ ok: false, reason: "not-owner" });
    expect(has(origin, "refs/heads/studio-notes")).toBe(false);
    git(owner, "switch", "-q", "main");
  });

  it("اختبار أو جلسة سحابية بأصل على GitHub: يُرفض قبل أي اتصال", async () => {
    const { owner } = makeOwnerRepo("cloud");
    git(owner, "remote", "set-url", "origin", "https://example.invalid/owner/balislam.git");
    const ep = path.join(owner, "channels", "zubdat-alkutub", "episodes", "001-cloud");
    await addNote(ep, 1);
    const started = Date.now();
    const r = await syncStudioNotes({ channelsDir: path.join(owner, "channels"), env: { ...TEST_ENV, CLAUDE_CODE_REMOTE: "true" }, platform: "linux" });
    expect(r).toMatchObject({ ok: false, reason: "not-owner" });
    expect(Date.now() - started).toBeLessThan(5_000);
    // ولا يرسل افتراضيًا داخل الاختبار (بلا BAL_NOTES_SYNC=on) ولو كان الأصل محليًا
    git(owner, "remote", "set-url", "origin", path.join(path.dirname(owner), "origin.git"));
    expect(await syncStudioNotes({ channelsDir: path.join(owner, "channels"), env: { VITEST: "true" } })).toMatchObject({ ok: false, reason: "not-owner" });
  });
});

describe("أول إرسال والسبب الحقيقي (KI-001)", () => {
  it("الفرع غير موجود بعد: أول ملاحظة تنشئه (commit بلا أب، صناديق فقط، عبر الخطاف الحقيقي) والمؤشر صفر", async () => {
    const { origin, owner } = makeOwnerRepo("first");
    expect(git(origin, "ls-remote", "--refs", ".", "refs/heads/studio-notes")).toBe("");
    const ep = path.join(owner, "channels", "zubdat-alkutub", "episodes", "001-first");
    await addNote(ep, 1);
    expect(await studioNotesStatus(path.join(owner, "channels"))).toMatchObject({ pending: 1, reason: null });
    const r = await syncStudioNotes({ channelsDir: path.join(owner, "channels"), env: TEST_ENV });
    expect(r).toMatchObject({ ok: true, pushed: true });
    const tip = git(origin, "rev-parse", "refs/heads/studio-notes");
    expect(git(origin, "rev-list", "--parents", "-n", "1", tip)).toBe(tip); // أول commit: بلا أب
    expect(git(origin, "ls-tree", "-r", "--name-only", tip)).toBe("channels/zubdat-alkutub/episodes/001-first/notes/inbox.json");
    expect(await studioNotesStatus(path.join(owner, "channels"))).toMatchObject({ pending: 0, reason: null });
  });

  it("فشل الدفع: العدد والسبب الحقيقي فور انتهاء المحاولة، ونص Git تحت «تفاصيل» بلا صلاحية مضمّنة", async () => {
    const { base, owner } = makeOwnerRepo("fail");
    git(owner, "remote", "set-url", "origin", path.join(base, "missing.git"));
    const ep = path.join(owner, "channels", "zubdat-alkutub", "episodes", "001-fail");
    await addNote(ep, 1);
    await addNote(ep, 2);
    const r = await syncStudioNotes({ channelsDir: path.join(owner, "channels"), env: TEST_ENV });
    expect(r).toMatchObject({ ok: false, reason: "error" });
    const st = await studioNotesStatus(path.join(owner, "channels"));
    expect(st).toMatchObject({ pending: 2, reason: "error", sending: false, where: [{ channel: "zubdat-alkutub", episode: "001-fail", count: 2 }] });
    expect(st.detail).toMatch(/missing\.git/);
    expect(st.lastAttemptAt).toBeTruthy();
    expect(notesReasonText(st)).toMatch(/^لم تُرسل: تعذّر الدفع إلى GitHub \(ليس انقطاع اتصال\)/);
    // صلاحية مضمّنة في رابط الأصل لا تُحفظ في الصندوق ولا تظهر
    git(owner, "remote", "set-url", "origin", "file://user:s3cr3t-token@" + path.join(base, "missing.git"));
    await syncStudioNotes({ channelsDir: path.join(owner, "channels"), env: TEST_ENV });
    expect(readFileSync(path.join(ep, "notes", "inbox.json"), "utf8")).not.toContain("s3cr3t-token");
    expect(JSON.stringify(await studioNotesStatus(path.join(owner, "channels")))).not.toContain("s3cr3t-token");
  });

  it("رفض الصلاحية من GitHub يُسمّى باسمه، وانقطاع الشبكة باسمه", () => {
    for (const t of ["fatal: Authentication failed for 'https://github.com/x/y.git/'",
      "fatal: could not read Username for 'https://github.com': terminal prompts disabled",
      "remote: Permission to x/y.git denied to someone.\nfatal: unable to access '…': The requested URL returned error: 403",
      "git@github.com: Permission denied (publickey)."]) expect(AUTH_FAILURE.test(t), t).toBe(true);
    expect(AUTH_FAILURE.test("fatal: unable to access 'https://github.com/': Could not resolve host: github.com")).toBe(false);
    expect(NETWORK_FAILURE.test("Could not resolve host: github.com")).toBe(true);
    expect(notesReasonText({ reason: "auth", sending: false })).toMatch(/لم يقبل صلاحية الدفع من هذا الجهاز/);
    expect(notesReasonText({ reason: "offline", sending: false })).toMatch(/لا اتصال بالإنترنت/);
  });

  it("الواجهة: المؤشر ثابت في الشريط العلوي ويظهر فوق الصفر وحده، وشاشة المشاهد تتبعه بلا تحديث", () => {
    const top = readFileSync(path.join(repo, "app/src/shell/TopBar.tsx"), "utf8");
    expect(top).toContain("<NotesBadge />");
    const badge = readFileSync(path.join(repo, "app/src/ui/NotesBadge.tsx"), "utf8");
    expect(badge).toContain("st.pending <= 0) return null");
    expect(badge).toContain("ملاحظات لم تُرسل:");
    const panel = readFileSync(path.join(repo, "app/src/workspace/SceneProductionPanel.tsx"), "utf8");
    expect(panel).toContain("window.addEventListener(NOTES_STATUS_EVENT");
    const server = readFileSync(path.join(repo, "app/server/routes/maintenance.ts"), "utf8");
    expect(server).toContain(`parts[0] === "notes" && parts[1] === "status"`);
  });
});

// ———————————————— معيار القبول: من الاستوديو إلى studio-notes ثم الرد بعد السحب ————————————————
describe("معيار القبول (العمل ٢)", () => {
  const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "BAL_WORKFLOW_HMAC_KEY", "BAL_NOTES_SYNC"] as const;
  const saved: Record<string, string | undefined> = {};
  beforeAll(() => { for (const k of ENV) saved[k] = process.env[k]; });
  afterAll(() => { for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });

  it("ملاحظة من «المشاهد» تصل studio-notes، ويقرؤها bal notes --open، ويعود الرد إلى الاستوديو بعد resolve والسحب", async () => {
    const { base, origin, owner } = makeOwnerRepo("accept", (o) => {
      cpSync(path.join(repo, "channels", "dafatir-alzaman"), path.join(o, "channels", "dafatir-alzaman"),
        { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
    });
    const channels = path.join(owner, "channels");
    process.env.BAL_CHANNELS_DIR = channels;
    delete process.env.BAL_CHANNEL;
    process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__notes_acceptance_signing_key_2026";
    process.env.BAL_NOTES_SYNC = "on"; // الإرسال الحقيقي في الخلفية، إلى origin المحلي وحده
    const dir = path.join(channels, "dafatir-alzaman", "episodes", "003-accept");
    mkdirSync(path.join(dir, "voice"), { recursive: true });
    const scriptPath = path.join(dir, "script.md");
    writeFileSync(scriptPath, `---\ntitle: "قبول"\nepisode: "003"\n---\n## الفصل 1 · تجربة\nكان الدرس الأول.\n\nوهذا مشهد ثان.\n`);
    const s1 = { id: "c1-s1", template: "hz-text", line: 6, narration: "كان الدرس الأول.", sfx: [], props: {} };
    const s2 = { id: "c1-s2", template: "hz-text", line: 8, narration: "وهذا مشهد ثان.", sfx: [], props: {} };
    const plan = { episode: "003", title: "قبول", chapters: [{ number: 1, title: "تجربة", scenes: [s1, s2] }] } as unknown as Plan;
    writeFileSync(path.join(dir, "plan.json"), JSON.stringify(plan));
    for (const s of [s1, s2]) writeFileSync(path.join(dir, "voice", `${s.id}.wav`), "x");
    writeFileSync(path.join(dir, "voice", "index.json"), JSON.stringify(Object.fromEntries([s1, s2].map((s) =>
      [s.id, { file: `${s.id}.wav`, hash: `h-${s.id}`, text: s.narration, duration: 2, words: [] }]))));
    // سكريبت الحلقة وخطتها على main (كما يحفظهما الحفظ الآلي، D101)، فتجد نسخة Claude مجلد الحلقة
    git(owner, "add", path.relative(owner, scriptPath), path.relative(owner, path.join(dir, "plan.json")));
    git(owner, "commit", "-q", "-m", "episode 003");
    git(origin, "fetch", "-q", owner, "+refs/heads/main:refs/heads/main");
    git(owner, "fetch", "-q", "origin");
    expect(has(origin, "refs/heads/studio-notes")).toBe(false);

    await runWithChannel("dafatir-alzaman", async () => {
      const st0 = await inspectSceneProduction("003");
      await decideSceneProduction("003", { action: "approve-script", expectedSha256: st0.script.sha256 });
      await approveStoryboard(scriptPath, plan, { note: "راجعت لوحتي الاختبار" });
      const st1 = await inspectSceneProduction("003");
      await decideSceneProduction("003", { action: "approve-storyboard", expectedSha256: st1.storyboard.sha256 });
      const cur = (await inspectSceneProduction("003")).scenes[0]!;
      mkdirSync(path.join(dir, "previews"), { recursive: true });
      execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=160x90:rate=15:duration=2",
        "-f", "lavfi", "-i", "sine=frequency=330:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-c:a", "aac", "-shortest",
        path.join(dir, "previews", "scene-c1-s1-av.mp4")]);
      await recordSceneRenderEvidence("003", "c1-s1", cur.sourceSha256, "current");
      const sub = await decideSceneProduction("003", { action: "submit-scene", sceneId: "c1-s1", expectedSha256: cur.sourceSha256 });
      // المالك: «الحركة غير مناسبة» ← «أرسل الملاحظة» (الإرسال في الخلفية كما في الاستوديو)
      await decideSceneProduction("003", { action: "correct-scene", sceneId: "c1-s1", expectedSha256: sub.scenes[0]!.previewSha256!,
        note: "[الحركة @0:01] العنوان يقفز" });
    });
    for (let i = 0; i < 100 && (await studioNotesStatus(channels)).pending > 0; i++) await new Promise((r) => setTimeout(r, 200));
    expect(await studioNotesStatus(channels)).toMatchObject({ pending: 0 });
    const local = (await readInbox(dir)).notes[0]!;
    expect(local.sync?.state).toBe("sent");
    expect(git(origin, "ls-tree", "-r", "--name-only", "refs/heads/studio-notes")).toBe("channels/dafatir-alzaman/episodes/003-accept/notes/inbox.json");

    // Claude: نسخة أخرى، `bal notes --open`، ثم resolve في commit على main
    const claude = path.join(base, "claude");
    git(base, "clone", "-q", origin, claude);
    for (const [k, v] of [["user.name", "Claude"], ["user.email", "claude@example.invalid"]]) git(claude, "config", k!, v!);
    const open = await listStudioNotes({ repoDir: claude, open: true });
    expect(open.fetched).toBe("ok");
    expect(open.notes).toHaveLength(1);
    expect(open.notes[0]).toMatchObject({ id: local.id, channel: "dafatir-alzaman", sceneId: "c1-s1", kind: "motion", note: "العنوان يقفز", status: "open" });
    const r = await resolveStudioNote({ repoDir: claude, id: local.id, answer: "ثبّتُّ العنوان", fixedBy: "fix-sha" });
    git(claude, "add", r.file);
    git(claude, "commit", "-q", "-m", "resolve note");
    git(origin, "fetch", "-q", claude, "+refs/heads/main:refs/heads/main"); // يجلبه origin (لا بوابة في الاختبار)
    expect((await listStudioNotes({ repoDir: claude, open: true })).notes).toHaveLength(0);

    // المالك يسحب: السطر تحت ملاحظته «أُصلحت — أنتج المشهد من جديد (الرد)»
    git(owner, "pull", "-q", "--ff-only", "origin", "main");
    expect(existsSync(path.join(dir, "notes", "resolved.json"))).toBe(true);
    await runWithChannel("dafatir-alzaman", async () => {
      const inbox = (await inspectSceneProduction("003")).scenes[0]!.correction!.inbox!;
      expect(inbox).toMatchObject({ id: local.id, status: "fixed", answer: "ثبّتُّ العنوان", sync: "sent" });
      expect(noteInboxLine(inbox)).toBe("أُصلحت — أنتج المشهد من جديد (ثبّتُّ العنوان)");
    });
    expect(git(origin, "rev-parse", "refs/heads/main")).toBe(git(claude, "rev-parse", "HEAD"));
  }, 120_000);
});
