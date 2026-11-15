/**
 * «جلسة عمل» (D141): الاستوديو يكتب notes/work-session.json على studio-notes، والمهمة المجدولة في السحابة تقرؤه.
 * العقد: { active, until, startedAt, channel } — يكتبه استوديو المالك وحده، بالمسار نفسه الذي ترسل به الملاحظات
 * (فهرس مؤقت، دفع بمرجع صريح، الخطاف الحقيقي يقبل الشجرة). لا شبكة ولا GitHub: origin مستودع bare مؤقت.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { childEnv } from "../scripts/git-env.mjs";
import { appendStudioNote, NOTES_BRANCH_PATH_RE, WORK_SESSION_PATH, writeResolution } from "../src/studio/notesInbox";
import { syncStudioNotes } from "../src/studio/notesSync";
import {
  buildWorkSession, lastResolvedNotes, startWorkSession, stopWorkSession, workSessionJson, workSessionStatus,
} from "../src/studio/workSession";
import {
  WORK_SESSION_FIRST_REVIEW_HINT, WORK_SESSION_START_LABEL, workSessionLiveLabel, workSessionPushText,
} from "../app/src/ui/WorkSessionControl";

const repo = path.resolve(import.meta.dirname, "..");
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", env: childEnv({ GIT_TERMINAL_PROMPT: "0" }) }).trim();
const TEST_ENV = { ...process.env, BAL_NOTES_SYNC: "on" } as NodeJS.ProcessEnv;

let tmp = "";
beforeAll(() => { tmp = mkdtempSync(path.join(os.tmpdir(), "bal-work-session-")); });
afterAll(() => { if (tmp) rmSync(tmp, { recursive: true, force: true }); });

/** owner = نسخة المالك على main بخطاف المشروع الحقيقي، وorigin = bare. */
const makeOwnerRepo = (name: string) => {
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
  git(owner, "add", "-A");
  git(owner, "commit", "-q", "-m", "init");
  git(owner, "remote", "add", "origin", origin);
  git(origin, "fetch", "-q", owner, "+refs/heads/main:refs/heads/main");
  return { base, origin, owner, channelsDir: path.join(owner, "channels") };
};
const remoteFlag = (origin: string) => JSON.parse(git(origin, "show", `refs/heads/studio-notes:${WORK_SESSION_PATH}`));
const remoteTree = (origin: string) => git(origin, "ls-tree", "-r", "--name-only", "refs/heads/studio-notes").split("\n").filter(Boolean);

describe("العقد", () => {
  it("الحقول الأربعة بترتيبها، وuntil = البدء + المدة بتوقيت UTC، والمدة ساعة أو ساعتان أو ٣", () => {
    const now = new Date("2026-11-15T09:10:00.000Z");
    const w = buildWorkSession(2, now);
    expect(w).toEqual({ active: true, until: "2026-11-15T11:10:00.000Z", startedAt: "2026-11-15T09:10:00.000Z", channel: null });
    expect(Object.keys(JSON.parse(workSessionJson(w)))).toEqual(["active", "until", "startedAt", "channel"]);
    expect(buildWorkSession(1, now).until).toBe("2026-11-15T10:10:00.000Z");
    expect(buildWorkSession(3, now, "balislam")).toMatchObject({ until: "2026-11-15T12:10:00.000Z", channel: "balislam" });
    for (const bad of [0, 4, 1.5, 24]) expect(() => buildWorkSession(bad, now)).toThrow(/ساعة أو ساعتان/);
    expect(NOTES_BRANCH_PATH_RE.test(WORK_SESSION_PATH)).toBe(true);
    expect(NOTES_BRANCH_PATH_RE.test("notes/other.json")).toBe(false);
    expect(NOTES_BRANCH_PATH_RE.test("channels/balislam/episodes/001-x/notes/inbox.json")).toBe(true);
  });

  it("نصوص الرأس كما طلبها المالك", () => {
    expect(WORK_SESSION_START_LABEL).toBe("ابدأ جلسة عمل — عالج ملاحظاتي تلقائيًا");
    const until = new Date(2026, 10, 15, 14, 5).toISOString();
    expect(workSessionLiveLabel(until)).toBe("جلسة العمل شغّالة حتى ١٤:٠٥ — تُراجَع ملاحظاتك كل ٥ دقائق");
    expect(WORK_SESSION_FIRST_REVIEW_HINT).toBe("أول مراجعة تبدأ خلال ساعة على الأكثر، ثم كل ٥ دقائق");
    expect(workSessionPushText(null)).toBeNull();
    expect(workSessionPushText({ state: "failed", at: "x", reason: "offline", message: "" })).toMatch(/لا اتصال/);
    expect(workSessionPushText({ state: "failed", at: "x", reason: "auth", message: "" })).toMatch(/صلاحية الدفع/);
    expect(workSessionPushText({ state: "failed", at: "x", reason: "error", message: "" })).toMatch(/تعذّر الدفع/);
  });
});

describe("ابدأ / أوقف / انتهاء الوقت على studio-notes", { timeout: 120_000 }, () => {
  it("ابدأ: العلم على الفرع بـ until الصحيح، عبر الخطاف الحقيقي، والملاحظات تُرسل بعده كما كانت", async () => {
    const { origin, owner, channelsDir } = makeOwnerRepo("start");
    // ملاحظة سابقة على الفرع: العلم يُضاف بجوارها ولا يمسها.
    const ep = path.join(channelsDir, "balislam", "episodes", "001-ws");
    await appendStudioNote(ep, { channel: "balislam", episode: "001-ws", sceneId: "c1-s1", raw: "[الحركة @0:01] سريعة",
      createdAt: "2026-11-15T09:00:00.000Z", sceneInputSha256: "a".repeat(64), previewSha256: "b".repeat(64), ledgerSeq: 1 });
    expect(await syncStudioNotes({ channelsDir, env: TEST_ENV })).toMatchObject({ ok: true, pushed: true });

    const now = new Date("2026-11-15T09:10:00.000Z");
    const { session, result } = await startWorkSession({ channelsDir, hours: 2, now, env: TEST_ENV });
    expect(result).toMatchObject({ ok: true, pushed: true });
    expect(session).toEqual({ active: true, until: "2026-11-15T11:10:00.000Z", startedAt: now.toISOString(), channel: null });
    expect(remoteFlag(origin)).toEqual(session);
    expect(remoteTree(origin).sort()).toEqual(["channels/balislam/episodes/001-ws/notes/inbox.json", WORK_SESSION_PATH]);
    // لا شيء على main ولا في ملفات العمل: الحالة المحلية في .studio/ وحدها (خارج Git).
    expect(git(owner, "status", "--porcelain")).toBe("");
    expect(existsSync(path.join(owner, "notes"))).toBe(false);
    expect(JSON.parse(readFileSync(path.join(owner, ".studio", "work-session.json"), "utf8")).push).toMatchObject({ state: "sent" });

    // ملاحظة جديدة بعد العلم: شجرة فيها العلم مقبولة من notesSync ومن الخطاف.
    await appendStudioNote(ep, { channel: "balislam", episode: "001-ws", sceneId: "c1-s2", raw: "[النبرة @0:02] حادة",
      createdAt: "2026-11-15T09:20:00.000Z", sceneInputSha256: "a".repeat(64), previewSha256: "b".repeat(64), ledgerSeq: 2 });
    expect(await syncStudioNotes({ channelsDir, env: TEST_ENV })).toMatchObject({ ok: true, pushed: true });
    expect(remoteFlag(origin)).toEqual(session);

    const st = await workSessionStatus({ channelsDir, env: TEST_ENV, now: Date.parse("2026-11-15T10:00:00.000Z") });
    expect(st).toMatchObject({ live: true, session, push: { state: "sent" } });
  });

  it("أوقف: active=false ويبقى until وstartedAt", async () => {
    const { origin, channelsDir } = makeOwnerRepo("stop");
    const now = new Date("2026-11-15T09:10:00.000Z");
    await startWorkSession({ channelsDir, hours: 1, now, env: TEST_ENV });
    const { session, result } = await stopWorkSession({ channelsDir, env: TEST_ENV });
    expect(result.ok).toBe(true);
    expect(session).toEqual({ active: false, until: "2026-11-15T10:10:00.000Z", startedAt: now.toISOString(), channel: null });
    expect(remoteFlag(origin)).toEqual(session);
    expect((await workSessionStatus({ channelsDir, env: TEST_ENV, now: now.getTime() })).live).toBe(false);
  });

  it("انتهاء الوقت: بعد until لا تعود شغّالة، ويُكتب active=false على الفرع", async () => {
    const { origin, channelsDir } = makeOwnerRepo("expiry");
    const now = new Date("2026-11-15T09:10:00.000Z");
    await startWorkSession({ channelsDir, hours: 1, now, env: TEST_ENV });
    expect((await workSessionStatus({ channelsDir, env: TEST_ENV, now: Date.parse("2026-11-15T10:09:59.000Z") })).live).toBe(true);
    const st = await workSessionStatus({ channelsDir, env: TEST_ENV, now: Date.parse("2026-11-15T10:10:00.000Z"), wait: true });
    expect(st).toMatchObject({ live: false, session: { active: false, until: "2026-11-15T10:10:00.000Z" }, push: { state: "sent" } });
    expect(remoteFlag(origin)).toMatchObject({ active: false, until: "2026-11-15T10:10:00.000Z", startedAt: now.toISOString() });
  });

  it("نسخة ليست استوديو المالك (worktree) لا تكتب العلم، والسبب بالعربية", async () => {
    const { base, origin, owner } = makeOwnerRepo("worktree");
    const wt = path.join(base, "wt");
    git(owner, "worktree", "add", "-q", "-b", "agent-work", wt);
    const { result } = await startWorkSession({ channelsDir: path.join(wt, "channels"), hours: 2, env: TEST_ENV });
    expect(result).toMatchObject({ ok: false, reason: "not-owner" });
    expect(() => git(origin, "rev-parse", "--verify", "--quiet", "refs/heads/studio-notes")).toThrow();
    const st = await workSessionStatus({ channelsDir: path.join(wt, "channels"), env: TEST_ENV });
    expect(st.push).toMatchObject({ state: "failed", reason: "not-owner" });
    expect(workSessionPushText(st.push)).toMatch(/ليست استوديو المالك/);
    // بلا BAL_NOTES_SYNC=on داخل الاختبار: لا دفع ولو كانت نسخة المالك نفسها.
    const { channelsDir } = makeOwnerRepo("vitest-default");
    expect((await startWorkSession({ channelsDir, hours: 2, env: { VITEST: "true" } })).result).toMatchObject({ ok: false, reason: "not-owner" });
  });

  it("فشل الدفع يظهر بسببه ويُعاد وحده (لا اتصال بالأصل)", async () => {
    const { owner, channelsDir } = makeOwnerRepo("offline");
    git(owner, "remote", "set-url", "origin", path.join(tmp, "missing", "origin.git"));
    const now = new Date("2026-11-15T09:10:00.000Z");
    const { result } = await startWorkSession({ channelsDir, hours: 2, now, env: TEST_ENV });
    expect(result.ok).toBe(false);
    const st = await workSessionStatus({ channelsDir, env: TEST_ENV, now: now.getTime() });
    expect(st).toMatchObject({ live: true, push: { state: "failed" } });
    expect(workSessionPushText(st.push)).toMatch(/^لم تصل جلسة العمل إلى GitHub/);
  });
});

describe("آخر ملاحظة عولجت", () => {
  it("أحدث رد في resolved.json تحت كل القنوات، وعدد ما عولج منذ بدء الجلسة", async () => {
    const channelsDir = mkdtempSync(path.join(tmp, "resolved-"));
    expect(await lastResolvedNotes(channelsDir)).toBeNull();
    const ep = path.join(channelsDir, "balislam", "episodes", "001-x");
    await writeResolution(ep, "n0123456789", { status: "fixed", answer: "أُصلح", fixedBy: "abc", at: "2026-11-15T08:00:00.000Z" });
    await writeResolution(path.join(channelsDir, "zubdat-alkutub"), "n0123456780", { status: "wont-fix", answer: "لا", fixedBy: "abc", at: "2026-11-15T10:30:00.000Z" });
    expect(await lastResolvedNotes(channelsDir, "2026-11-15T09:00:00.000Z")).toEqual({ at: "2026-11-15T10:30:00.000Z", count: 2, sinceStart: 1 });
  });
});
