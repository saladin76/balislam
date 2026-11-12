/**
 * العمل ٣ من مرحلة الاستقرار (D106/D112): التقاط الأخطاء آليًا.
 * - الخادم: استثناء غير متوقع في مسار يُكتب في `.studio/errors.jsonl` (الوقت، المسار، الرسالة، الـstack، القناة والحلقة
 *   والمشهد، وبصمة الـcommit)، ويُرد 500 برقم الخطأ.
 * - الواجهة: حاجز الأخطاء و`window.onerror` و`unhandledrejection` ترسل الخطأ إلى الخادم فيُسجَّل في الملف نفسه، والبطاقة
 *   تقول جملة عربية وزر «أرسل المشكلة» والنص التقني تحت «تفاصيل».
 * - «أرسل المشكلة»: ملاحظة من نوع `error` في صندوق الحلقة (أو الصندوق العام للقناة)، فيها الخطأ وآخر ٢٠ سطرًا من السجل،
 *   على مسار studio-notes نفسه (مستودع bare مؤقت، عبر الخطاف الحقيقي)، ويقرؤها `bal notes --open` من نسخة أخرى.
 * - `bal errors`: آخر الأخطاء مجمّعة بالرسالة مع عددها.
 * - لا سر في أي منها: قيم .env ومفتاح الجهاز وصلاحية رابط الأصل كلها وهمية هنا، ويُتحقق من غيابها حرفًا.
 * لا شبكة ولا GitHub ولا مفاتيح حقيقية.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { childEnv } from "../scripts/git-env.mjs";
import { isOwnerContentPath } from "../scripts/contentPaths.mjs";
import { balApi } from "../app/server/api";
import { api, setApiChannel } from "../app/src/api";
import { StudioErrorBoundary } from "../app/src/shell/ErrorBoundary";
import { ErrorNotice } from "../app/src/ui/ErrorNotice";
import { installErrorCapture, onStudioError, type StudioErrorEvent } from "../app/src/errorCapture";
import { formatErrorGroups, groupErrors, readErrorRecords, redactSecrets } from "../src/studio/errorLog";
import { formatNote, listStudioNotes } from "../src/studio/notesCli";
import { INBOX_PATH_RE } from "../src/studio/notesInbox";
import { studioNotesStatus } from "../src/studio/notesSync";

const repo = path.resolve(import.meta.dirname, "..");
const CH = "balislam";
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", env: childEnv({ GIT_TERMINAL_PROMPT: "0" }) }).trim();

// ——— أسرار وهمية: يجب ألا يظهر أيٌّ منها في أي ملف أو ملاحظة أو إخراج ———
const FAKE_VOICE_KEY = "sk_FAKEvoiceKEY_0123456789abcdefABCDEF";
const FAKE_DEVICE_KEY = "FAKE_DEVICE_KEY__9f8e7d6c5b4a3928170655aa";
const FAKE_GH_TOKEN = "ghp_FAKEtoken0123456789ABCDEFGHIJKLmnop";
const FAKE_OTHER_ENV = "FAKE_other_env_value_31415926";
const SECRETS = [FAKE_VOICE_KEY, FAKE_DEVICE_KEY, FAKE_GH_TOKEN, FAKE_OTHER_ENV];
const SECRET_MESSAGE = `boom: key ${FAKE_VOICE_KEY} device ${FAKE_DEVICE_KEY} env ${FAKE_OTHER_ENV} ` +
  `remote https://x-access-token:${FAKE_GH_TOKEN}@github.com/owner/balislam.git token=${FAKE_GH_TOKEN}`;
const expectNoSecret = (label: string, text: string) => {
  for (const s of SECRETS) expect(text.includes(s), `${label} contains a secret`).toBe(false);
  expect(text, label).not.toMatch(/ghp_[A-Za-z0-9]{10,}/);
  expect(text, label).not.toMatch(/x-access-token:[^*\s]/);
};

const ENV_KEYS = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "BAL_ENV_FILE", "BAL_WORKFLOW_HMAC_KEY", "BAL_NOTES_SYNC", "BAL_ERRORS_FILE",
  "ELEVENLABS_API_KEY", "BAL_TEST_FAULT_ROUTE", "BAL_TEST_FAULT_MESSAGE"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "", origin = "", owner = "", errorsFile = "";
let vite: ViteDevServer;
let server: http.Server;
let base = "";
const realFetch = globalThis.fetch;

beforeAll(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-errors-"));
  // owner = نسخة المالك على main بخطاف المشروع الحقيقي، وorigin = bare بلا فرع studio-notes.
  origin = path.join(tmp, "origin.git"); owner = path.join(tmp, "owner");
  git(tmp, "init", "-q", "--bare", "-b", "main", origin);
  git(tmp, "init", "-q", "-b", "main", owner);
  for (const [k, v] of [["user.name", "Owner"], ["user.email", "owner@example.invalid"]]) git(owner, "config", k!, v!);
  mkdirSync(path.join(owner, ".githooks"));
  copyFileSync(path.join(repo, ".githooks", "pre-push"), path.join(owner, ".githooks", "pre-push"));
  git(owner, "config", "core.hooksPath", ".githooks");
  copyFileSync(path.join(repo, ".gitignore"), path.join(owner, ".gitignore"));
  cpSync(path.join(repo, "channels", CH), path.join(owner, "channels", CH), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
  const ep = path.join(owner, "channels", CH, "episodes", "001-errors");
  mkdirSync(ep, { recursive: true });
  writeFileSync(path.join(ep, "script.md"), `---\ntitle: "التقاط الأخطاء"\nepisode: "001"\n---\nالصَّبْرُ مِفْتَاحُ الفَرَجِ.\n`);
  git(owner, "add", "-A");
  git(owner, "commit", "-q", "-m", "init");
  git(owner, "remote", "add", "origin", origin);
  git(origin, "fetch", "-q", owner, "+refs/heads/main:refs/heads/main");
  git(owner, "fetch", "-q", "origin");
  git(owner, "branch", "-q", "--set-upstream-to=origin/main", "main");

  // .env وهمي فيه مفتاح الصوت ومفتاح الجهاز وقيمة أخرى
  const envFile = path.join(tmp, ".env");
  writeFileSync(envFile, `ELEVENLABS_API_KEY=${FAKE_VOICE_KEY}\nBAL_WORKFLOW_HMAC_KEY=${FAKE_DEVICE_KEY}\nSOME_SETTING="${FAKE_OTHER_ENV}"\n`);
  errorsFile = path.join(tmp, "state", "errors.jsonl");
  Object.assign(process.env, {
    BAL_CHANNELS_DIR: path.join(owner, "channels"), BAL_ENV_FILE: envFile, BAL_WORKFLOW_HMAC_KEY: FAKE_DEVICE_KEY,
    ELEVENLABS_API_KEY: FAKE_VOICE_KEY, BAL_NOTES_SYNC: "on", BAL_ERRORS_FILE: errorsFile,
  });
  delete process.env.BAL_CHANNEL;

  vite = await createServer({
    configFile: false, root: path.join(repo, "app"), logLevel: "silent", appType: "custom",
    plugins: [balApi()],
    server: { middlewareMode: true, hmr: false, watch: null, fs: { allow: [repo, tmp] } },
  });
  server = http.createServer(vite.middlewares);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  globalThis.fetch = ((input: string, init?: RequestInit) => realFetch(input.startsWith("http") ? input : base + input, {
    ...init, headers: { "sec-fetch-site": "same-origin", ...(init?.headers as Record<string, string> | undefined) },
  })) as typeof fetch;
  setApiChannel(CH);
  await api.channels(); // warm-up inside the setup timeout
}, 90_000);

afterAll(async () => {
  globalThis.fetch = realFetch;
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await vite?.close();
  for (const k of ENV_KEYS) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

const waitFor = async <T,>(fn: () => Promise<T | null | undefined | false>, ms = 30_000): Promise<T> => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw Error("timed out");
    await new Promise((r) => setTimeout(r, 150));
  }
};

describe("التنقيح: لا قيمة من .env ولا مفتاح الجهاز ولا صلاحية في رابط", () => {
  it("يحجب القيم حرفًا، والأنماط، وصلاحية رابط git، والمسارات المطلقة", () => {
    const out = redactSecrets(`${SECRET_MESSAGE} Bearer abc.def-ghi Authorization: Basic Zm9vOmJhcg== xi-api-key: ${FAKE_VOICE_KEY}` +
      ` ELEVENLABS_API_KEY=sk_another_secret_value_123456 github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuv /Users/salah/balislam/app/x.ts`,
    { values: [FAKE_VOICE_KEY, FAKE_DEVICE_KEY, FAKE_OTHER_ENV] });
    expectNoSecret("redacted", out);
    expect(out).not.toContain("sk_another_secret_value_123456");
    expect(out).not.toContain("github_pat_11ABCDEFG");
    expect(out).not.toContain("Zm9vOmJhcg==");
    expect(out).not.toContain("abc.def-ghi");
    expect(out).not.toContain("salah");
    expect(out).toContain("https://***@github.com/owner/balislam.git");
    expect(out).toContain("boom:");
  });

  it("سجل الأخطاء والصندوق العام لا يُحفظان في main ولا يُرفعان مع المحتوى (D101)", () => {
    expect(isOwnerContentPath(".studio/errors.jsonl")).toBe(false);
    expect(isOwnerContentPath("channels/balislam/notes/inbox.json")).toBe(false);
    expect(git(owner, "check-ignore", ".studio/errors.jsonl")).toBe(".studio/errors.jsonl");
    expect(git(owner, "check-ignore", "channels/balislam/notes/inbox.json")).toBe("channels/balislam/notes/inbox.json");
    expect(INBOX_PATH_RE.test("channels/balislam/notes/inbox.json")).toBe(true);
    expect(INBOX_PATH_RE.test("channels/balislam/episodes/001-x/notes/inbox.json")).toBe(true);
    expect(INBOX_PATH_RE.test("channels/balislam/notes/other.json")).toBe(false);
    expect(INBOX_PATH_RE.test(".studio/errors.jsonl")).toBe(false);
  });
});

describe("معيار القبول (العمل ٣)", { timeout: 120_000 }, () => {
  let serverErrorId = "", uiErrorId = "", windowErrorId = "";

  it("خطأ مفتعل في مسار خادم: 500 برقم الخطأ، ويُكتب في errors.jsonl بسياقه وبصمة الـcommit، بلا سر", async () => {
    process.env.BAL_TEST_FAULT_ROUTE = "^/api/episodes/001/scene-production/c1-s1$";
    process.env.BAL_TEST_FAULT_MESSAGE = SECRET_MESSAGE;
    try {
      const res = await fetch(`/api/episodes/001/scene-production/c1-s1?channel=${CH}`);
      expect(res.status).toBe(500);
      const body = await res.json() as { error: string; errorId?: string };
      expect(body.errorId).toMatch(/^e[0-9a-f]{10}$/);
      expectNoSecret("500 body", JSON.stringify(body));
      serverErrorId = body.errorId!;
      // the same fault twice: grouped by message in `bal errors`
      expect((await fetch(`/api/episodes/001/scene-production/c1-s1?channel=${CH}`)).status).toBe(500);
    } finally {
      delete process.env.BAL_TEST_FAULT_ROUTE;
      delete process.env.BAL_TEST_FAULT_MESSAGE;
    }
    const records = await readErrorRecords(errorsFile);
    const rec = records.find((r) => r.id === serverErrorId)!;
    expect(rec).toMatchObject({ source: "server", kind: "route", method: "GET", route: "/api/episodes/001/scene-production/c1-s1",
      channel: CH, episode: "001", sceneId: "c1-s1" });
    expect(rec.at).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(rec.commit).toBe(git(repo, "rev-parse", "--short=12", "HEAD"));
    expect(rec.message).toMatch(/^boom:/);
    expect(rec.stack).toMatch(/at /);
    expectNoSecret("errors.jsonl", readFileSync(errorsFile, "utf8"));
  });

  it("خطأ في مكوّن واجهة: الحاجز يرسله إلى الخادم فيُسجَّل في الملف نفسه، والبطاقة جملة عربية و«أرسل المشكلة» و«تفاصيل»", async () => {
    const Broken: React.FC = () => { throw new Error(`render failed ${FAKE_GH_TOKEN}`); };
    const boundary = new StudioErrorBoundary({ scope: "screen", label: "شاشة المشاهد", children: <Broken /> });
    const err = new Error(`render failed ${FAKE_GH_TOKEN}`);
    // React's lifecycle, by hand (no DOM in vitest): derive the error state, then componentDidCatch.
    boundary.setState = ((s: unknown) => { Object.assign(boundary.state, typeof s === "function" ? (s as (x: unknown) => object)(boundary.state) : s); }) as typeof boundary.setState;
    Object.assign(boundary.state, StudioErrorBoundary.getDerivedStateFromError(err));
    boundary.componentDidCatch(err, { componentStack: "\n    at Broken\n    at ScenePanel" });
    const reported = await boundary.reported;
    expect(reported).toMatch(/^e[0-9a-f]{10}$/);
    uiErrorId = reported!;
    const html = renderToStaticMarkup(<>{boundary.render()}</>);
    expect(html).toContain("أرسل المشكلة");
    expect(html).toContain("لم يُمسح شيء");
    expect(html).toContain("<summary>تفاصيل</summary>");
    expect(html).not.toMatch(/<textarea/);
    expectNoSecret("card", html);
    const rec = (await readErrorRecords(errorsFile)).find((r) => r.id === uiErrorId)!;
    expect(rec).toMatchObject({ source: "ui", kind: "render", label: "شاشة المشاهد", channel: CH });
    expect(rec.stack).toContain("Broken");
    expect(rec.commit).toBe(git(repo, "rev-parse", "--short=12", "HEAD"));
    expectNoSecret("errors.jsonl", readFileSync(errorsFile, "utf8"));
  });

  it("window.onerror وunhandledrejection: يُسجَّلان، ويظهر للمالك إشعار بـ«أرسل المشكلة»؛ ورفض الخادم المعروف لا يُعدّ خطأ", async () => {
    const target = new EventTarget();
    const seen: StudioErrorEvent[] = [];
    const off = onStudioError((e) => seen.push(e));
    const uninstall = installErrorCapture(target, () => "#/balislam/001/episode/c1-s2");
    try {
      target.dispatchEvent(Object.assign(new Event("error"), { error: new TypeError(`x is undefined ${FAKE_VOICE_KEY}`), message: "x is undefined" }));
      target.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: new Error("lost promise") }));
      // a refusal the server answered (409) is shown by its screen; not a crash
      target.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: Object.assign(new Error("مرفوض"), { status: 409 }) }));
      target.dispatchEvent(Object.assign(new Event("error"), { message: "ResizeObserver loop completed with undelivered notifications." }));
      await waitFor(async () => seen.length >= 2 && seen);
      await new Promise((r) => setTimeout(r, 300));
    } finally { uninstall(); off(); }
    expect(seen).toHaveLength(2);
    windowErrorId = seen[0]!.id;
    const recs = await readErrorRecords(errorsFile);
    expect(recs.find((r) => r.id === windowErrorId)).toMatchObject({ source: "ui", kind: "window", channel: CH, episode: "001", sceneId: "c1-s2" });
    expect(recs.find((r) => r.id === seen[1]!.id)).toMatchObject({ source: "ui", kind: "rejection", message: "Error: lost promise" });
    expect(recs.some((r) => /مرفوض|ResizeObserver/.test(r.message))).toBe(false);
    const notice = renderToStaticMarkup(<ErrorNotice initial={seen[0]!} />);
    expect(notice).toContain("أرسل المشكلة");
    expect(notice).toContain("<summary>تفاصيل</summary>");
    expectNoSecret("notice", notice);
    expectNoSecret("errors.jsonl", readFileSync(errorsFile, "utf8"));
  });

  it("«أرسل المشكلة»: الخادم في صندوق الحلقة والواجهة في الصندوق العام، عبر studio-notes، ويقرؤهما bal notes --open بلا سر", async () => {
    const a = await api.sendError(serverErrorId);
    expect(a).toMatchObject({ box: "episode", episode: "001-errors" });
    expect(await api.sendError(serverErrorId)).toMatchObject({ noteId: a.noteId }); // ضغطتان = ملاحظة واحدة
    // خطأ واجهة بلا حلقة على الشاشة ← الصندوق العام للقناة
    const b = await api.sendError(uiErrorId);
    expect(b).toMatchObject({ box: "general", episode: "" });
    const channels = path.join(owner, "channels");
    await waitFor(async () => (await studioNotesStatus(channels)).pending === 0);
    const names = git(origin, "ls-tree", "-r", "--name-only", "refs/heads/studio-notes").split("\n").sort();
    expect(names).toEqual([`channels/${CH}/episodes/001-errors/notes/inbox.json`, `channels/${CH}/notes/inbox.json`]);
    for (const n of names) expectNoSecret(`studio-notes:${n}`, git(origin, "show", `refs/heads/studio-notes:${n}`));
    expectNoSecret("local episode box", readFileSync(path.join(channels, CH, "episodes", "001-errors", "notes", "inbox.json"), "utf8"));
    expectNoSecret("local general box", readFileSync(path.join(channels, CH, "notes", "inbox.json"), "utf8"));

    // Claude: نسخة أخرى بلا صناديق محلية، `bal notes --open`
    const claude = path.join(tmp, "claude");
    git(tmp, "clone", "-q", origin, claude);
    const open = await listStudioNotes({ repoDir: claude, open: true });
    expect(open.fetched).toBe("ok");
    const byId = new Map(open.notes.map((n) => [n.id, n]));
    const sNote = byId.get(a.noteId)!, uNote = byId.get(b.noteId)!;
    expect(sNote).toMatchObject({ kind: "error", channel: CH, episode: "001-errors", sceneId: "c1-s1", status: "open" });
    expect(sNote.error).toMatchObject({ id: serverErrorId, source: "server", route: "/api/episodes/001/scene-production/c1-s1" });
    expect(sNote.error!.log.length).toBeGreaterThan(0);
    expect(sNote.error!.log.length).toBeLessThanOrEqual(20);
    expect(uNote).toMatchObject({ kind: "error", channel: CH, episode: "", status: "open" });
    expect(uNote.error).toMatchObject({ id: uiErrorId, source: "ui", kind: "render" });
    const printed = open.notes.map(formatNote).join("\n\n");
    expect(printed).toContain("خطأ");
    expect(printed).toContain(serverErrorId);
    expect(printed).toContain("عام");
    expectNoSecret("bal notes --open", printed);
    expectNoSecret("bal notes --json", JSON.stringify(open));
  });

  it("bal errors: آخر الأخطاء مجمّعة بالرسالة مع عدد مرات كل منها", async () => {
    const records = await readErrorRecords(errorsFile);
    const groups = groupErrors(records);
    const boom = groups.find((g) => g.message.startsWith("boom:"))!;
    expect(boom.count).toBe(2);
    expect(boom.lastId).toMatch(/^e[0-9a-f]{10}$/);
    const text = formatErrorGroups(groups);
    expect(text).toMatch(/×\s*2|2 ×|مرتان|\(2\)/);
    expectNoSecret("bal errors", text);
    // the real command, on the same file
    const out = execFileSync(process.execPath, [path.join(repo, "bin", "bal.mjs"), "errors"], {
      cwd: repo, encoding: "utf8", env: { ...childEnv({}), BAL_ERRORS_FILE: errorsFile, BAL_ENV_FILE: path.join(tmp, ".env") },
    });
    expect(out).toContain("boom:");
    expectNoSecret("bal errors (cli)", out);
  });
});
