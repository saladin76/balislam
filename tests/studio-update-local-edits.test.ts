import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanGitEnv } from "../scripts/git-env.mjs";
import { needsRestart, readConflicts, resolveConflict, safeFastForward } from "../app/server/safeUpdate";
import { applyUpdate, updateStatus } from "../app/server/update";

/**
 * D95: تعديلات المالك المحلية في أي قناة لا تمنع «حدّث الآن»، ولا يضيع منها بايت.
 * مستودع «GitHub» مجرد (bare)، ونسختان: جهاز المالك، ونسخة المطور التي تدفع التحديث.
 */
const gitEnv = cleanGitEnv();
const g = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.email=t@example.invalid", "-c", "user.name=T", ...args], { cwd, env: gitEnv }).toString().trim();
const dirs: string[] = [];
let backupDir = "";
beforeEach(() => {
  backupDir = mkdtempSync(path.join(os.tmpdir(), "bal-backup-"));
  dirs.push(backupDir);
  process.env.BAL_UPDATE_BACKUP_DIR = backupDir;
});
afterEach(() => {
  delete process.env.BAL_UPDATE_BACKUP_DIR;
  for (const d of dirs.splice(0)) rmSync(d, { force: true, recursive: true });
});

const write = (root: string, rel: string, text: string) => {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), text);
};
const read = (root: string, rel: string) => readFileSync(path.join(root, rel), "utf8");
const lines = (n: number, tag = "") => Array.from({ length: n }, (_, i) => `line ${i + 1}${tag}`).join("\n") + "\n";

const setup = (files: Record<string, string>) => {
  const base = mkdtempSync(path.join(os.tmpdir(), "bal-update-"));
  dirs.push(base);
  const remote = path.join(base, "remote.git");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", remote], { env: gitEnv });
  const dev = path.join(base, "dev");
  execFileSync("git", ["clone", "-q", remote, dev], { env: gitEnv });
  g(dev, "checkout", "-q", "-b", "main");
  for (const [f, t] of Object.entries(files)) write(dev, f, t);
  g(dev, "add", "-A");
  g(dev, "commit", "-qm", "init");
  g(dev, "push", "-q", "origin", "main");
  const mac = path.join(base, "mac");
  execFileSync("git", ["clone", "-q", "-b", "main", remote, mac], { env: gitEnv });
  const push = (changes: Record<string, string | null>, msg = "upstream") => {
    for (const [f, t] of Object.entries(changes)) {
      if (t === null) rmSync(path.join(dev, f));
      else write(dev, f, t);
    }
    g(dev, "add", "-A");
    g(dev, "commit", "-qm", msg);
    g(dev, "push", "-q", "origin", "main");
    g(mac, "fetch", "-q", "origin", "main");
  };
  return { mac, push };
};
const noInstall = async () => true;

describe("«حدّث الآن» مع تعديلات محلية (D95)", () => {
  it("تعديل قناة أخرى لا يمنع التحديث ويبقى كما هو", async () => {
    const { mac, push } = setup({
      "channels/zubdat-alkutub/episodes/001-a/plan.json": "{\"v\":1}\n",
      "channels/dafatir-alzaman/episodes/001-b/plan.json": "{\"v\":1}\n",
    });
    write(mac, "channels/zubdat-alkutub/episodes/001-a/plan.json", "{\"v\":\"owner\"}\n");
    write(mac, "channels/zubdat-alkutub/series/s1/series.json", "{\"name\":\"سلسلتي\"}\n");
    rmSync(path.join(mac, "channels/dafatir-alzaman/episodes/001-b/plan.json"), { force: false });
    write(mac, "channels/dafatir-alzaman/episodes/001-b/plan.json", "{\"v\":1}\n"); // unchanged after rewrite
    push({ "channels/dafatir-alzaman/episodes/001-b/plan.json": "{\"v\":2}\n" });
    const r = await safeFastForward(mac, { runInstall: noInstall });
    expect(r.ok).toBe(true);
    expect(read(mac, "channels/dafatir-alzaman/episodes/001-b/plan.json")).toBe("{\"v\":2}\n");
    expect(read(mac, "channels/zubdat-alkutub/episodes/001-a/plan.json")).toBe("{\"v\":\"owner\"}\n");
    expect(read(mac, "channels/zubdat-alkutub/series/s1/series.json")).toContain("سلسلتي");
    expect(g(mac, "rev-parse", "HEAD")).toBe(g(mac, "rev-parse", "origin/main"));
    // نسخة احتياطية خارج المستودع فيها الملف نفسه والـ patch
    expect(r.backup && r.backup.startsWith(backupDir)).toBe(true);
    expect(readFileSync(path.join(r.backup!, "files/channels/zubdat-alkutub/episodes/001-a/plan.json"), "utf8")).toBe("{\"v\":\"owner\"}\n");
    expect(existsSync(path.join(r.backup!, "patches/channels/zubdat-alkutub/episodes/001-a/plan.json.patch"))).toBe(true);
    expect(JSON.parse(readFileSync(path.join(r.backup!, "manifest.json"), "utf8")).changes.length).toBe(2);
    expect(r.restart).toBe(false);
  }, 30_000);

  it("الملف نفسه تغيّر هنا وفي التحديث في موضعين مختلفين: يُدمج ويبقى تعديل المالك غير مُدرَج", async () => {
    const f = "channels/zubdat-alkutub/episodes/001-a/plan.json";
    const { mac, push } = setup({ [f]: lines(40) });
    write(mac, f, lines(40).replace("line 3\n", "line 3 OWNER\n"));
    push({ [f]: lines(40).replace("line 35\n", "line 35 UPSTREAM\n") });
    const r = await safeFastForward(mac, { runInstall: noInstall });
    expect(r.ok).toBe(true);
    const text = read(mac, f);
    expect(text).toContain("line 3 OWNER");
    expect(text).toContain("line 35 UPSTREAM");
    expect(r.merged).toContain(f);
    expect(r.conflicts).toEqual([]);
    expect(g(mac, "diff", "--cached", "--name-only")).toBe(""); // غير مُدرَج كما كان
    expect(g(mac, "diff", "--name-only")).toBe(f);
  }, 30_000);

  it("تعارض فعلي: الجديد في مكانه بلا علامات تعارض، ونسخة المالك محفوظة، ويختار لكل ملف وحده", async () => {
    const f = "channels/zubdat-alkutub/episodes/001-a/plan.json";
    const other = "channels/balislam/pronunciations.json";
    const { mac, push } = setup({ [f]: lines(5), [other]: lines(5) });
    write(mac, f, lines(5).replace("line 2\n", "line 2 OWNER\n"));
    write(mac, other, lines(5).replace("line 2\n", "line 2 OWNER\n"));
    push({ [f]: lines(5).replace("line 2\n", "line 2 UPSTREAM\n"), [other]: lines(5).replace("line 2\n", "line 2 UPSTREAM\n") });
    const r = await safeFastForward(mac, { runInstall: noInstall });
    expect(r.ok).toBe(true);
    expect(r.conflicts?.map((c) => c.file).sort()).toEqual([other, f].sort());
    expect(r.conflicts?.find((c) => c.file === f)?.channel).toBe("زبدة الكتب");
    expect(read(mac, f)).toContain("line 2 UPSTREAM");
    expect(read(mac, f)).not.toMatch(/<<<<<<<|>>>>>>>/);
    expect(g(mac, "status", "--porcelain")).toBe("");
    expect(g(mac, "rev-parse", "HEAD")).toBe(g(mac, "rev-parse", "origin/main"));
    expect((await readConflicts(mac)).length).toBe(2);
    // «أبقِ نسختي» لملف واحد فقط
    expect((await resolveConflict(mac, f, "mine")).ok).toBe(true);
    expect(read(mac, f)).toContain("line 2 OWNER");
    expect(read(mac, other)).toContain("line 2 UPSTREAM");
    // «خذ الجديد» للآخر: يبقى الجديد، ونسخة المالك ما زالت في النسخة الاحتياطية
    expect((await resolveConflict(mac, other, "new")).ok).toBe(true);
    expect(read(mac, other)).toContain("line 2 UPSTREAM");
    expect(readFileSync(path.join(r.backup!, "files", other), "utf8")).toContain("line 2 OWNER");
    expect(await readConflicts(mac)).toEqual([]);
    expect((await resolveConflict(mac, other, "mine")).ok).toBe(false);
  }, 30_000);

  it("ملف جديد عند المالك يضيفه التحديث بالمسار نفسه: نسخة المالك جانبًا ويُسأل", async () => {
    const f = "channels/zubdat-alkutub/episodes/001-a/publish.json";
    const same = "channels/zubdat-alkutub/episodes/001-a/series.json";
    const { mac, push } = setup({ "README.md": "x\n" });
    write(mac, f, "{\"title\":\"owner\"}\n");
    write(mac, same, "{\"s\":1}\n");
    push({ [f]: "{\"title\":\"upstream\"}\n", [same]: "{\"s\":1}\n" });
    const r = await safeFastForward(mac, { runInstall: noInstall });
    expect(r.ok).toBe(true);
    expect(read(mac, f)).toContain("upstream");
    expect(r.conflicts?.map((c) => c.file)).toEqual([f]);
    expect(r.conflicts?.[0]?.reason).toBe("untracked-collision");
    expect(r.merged).toContain(same); // مطابق بايتًا ببايت: لا سؤال
    expect((await resolveConflict(mac, f, "mine")).ok).toBe(true);
    expect(read(mac, f)).toContain("owner");
  }, 30_000);

  it("حذف محلي لملف لم يغيّره التحديث يبقى، وحذف ملف غيّره التحديث يُسأل عنه", async () => {
    const keep = "channels/dafatir-alzaman/episodes/001-b/previews/episode.mp4";
    const ask = "channels/balislam/episodes/001-c/publish.json";
    const { mac, push } = setup({ [keep]: "video\n", [ask]: "v1\n" });
    rmSync(path.join(mac, keep));
    rmSync(path.join(mac, ask));
    push({ [ask]: "v2\n" });
    const r = await safeFastForward(mac, { runInstall: noInstall });
    expect(r.ok).toBe(true);
    expect(existsSync(path.join(mac, keep))).toBe(false);
    expect(read(mac, ask)).toBe("v2\n");
    expect(r.conflicts?.[0]).toMatchObject({ file: ask, reason: "deleted-here-changed-there", mine: null });
    expect((await resolveConflict(mac, ask, "mine")).ok).toBe(true);
    expect(existsSync(path.join(mac, ask))).toBe(false);
  }, 30_000);

  it("package-lock.json المحلي يُؤخذ من التحديث حين تتغير الحزم، ثم تثبيت الحزم وإعادة التشغيل", async () => {
    const { mac, push } = setup({ "package.json": "{\"v\":1}\n", "package-lock.json": "{\"lock\":1}\n" });
    write(mac, "package-lock.json", "{\"lock\":\"local npm noise\"}\n");
    push({ "package.json": "{\"v\":2}\n", "package-lock.json": "{\"lock\":2}\n" });
    let installed = 0;
    const r = await safeFastForward(mac, { runInstall: async () => (++installed, true) });
    expect(r.ok).toBe(true);
    expect(read(mac, "package-lock.json")).toBe("{\"lock\":2}\n");
    expect(installed).toBe(1);
    expect(r.reinstalled).toBe(true);
    expect(r.restart).toBe(true);
    expect(r.conflicts).toEqual([]);
    expect(readFileSync(path.join(r.backup!, "files/package-lock.json"), "utf8")).toContain("local npm noise");
    expect(g(mac, "status", "--porcelain")).toBe("");
  }, 30_000);

  it("package-lock.json المحلي يبقى إن لم تتغير الحزم في التحديث", async () => {
    const { mac, push } = setup({ "package.json": "{}\n", "package-lock.json": "{\"lock\":1}\n", "a.txt": "1\n" });
    write(mac, "package-lock.json", "{\"lock\":\"local\"}\n");
    push({ "a.txt": "2\n" });
    let installed = 0;
    const r = await safeFastForward(mac, { runInstall: async () => (++installed, true) });
    expect(r.ok).toBe(true);
    expect(installed).toBe(0);
    expect(read(mac, "package-lock.json")).toContain("local");
  }, 30_000);

  it("لا نسخة احتياطية حين لا تعديلات، وملفات الخادم تطلب إعادة التشغيل", async () => {
    const { mac, push } = setup({ "app/server/x.ts": "1\n" });
    push({ "app/server/x.ts": "2\n" });
    const r = await safeFastForward(mac, { runInstall: noInstall });
    expect(r.ok).toBe(true);
    expect(r.backup).toBeUndefined();
    expect(readdirSync(backupDir)).toEqual([]);
    expect(r.restart).toBe(true);
    expect(needsRestart(["src/plan/x.ts", "channels/a/plan.json", "app/src/App.tsx"])).toBe(false);
    expect(needsRestart(["app/vite.config.ts"])).toBe(true);
  }, 30_000);

  it("applyUpdate كاملًا (جلب ثم تحديث) وupdateStatus لا يمنع ويعد التعديلات", async () => {
    const { mac, push } = setup({ "channels/zubdat-alkutub/a.json": "1\n", "channels/balislam/b.json": "1\n" });
    write(mac, "channels/zubdat-alkutub/a.json", "owner\n");
    push({ "channels/balislam/b.json": "2\n" });
    const st = await updateStatus(mac, true);
    expect(st.available).toBe(true);
    expect(st.blocked).toBeUndefined();
    expect(st.local).toBe(1);
    const r = await applyUpdate(mac);
    expect(r.ok).toBe(true);
    expect(read(mac, "channels/balislam/b.json")).toBe("2\n");
    expect(read(mac, "channels/zubdat-alkutub/a.json")).toBe("owner\n");
  }, 30_000);
});
