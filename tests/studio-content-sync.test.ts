import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanGitEnv } from "../scripts/git-env.mjs";
import { contentOnlyFiles, isOwnerContentPath } from "../scripts/contentPaths.mjs";
import { freePort, portFree } from "../scripts/studioInstance.mjs";
import { commitMessage, contentSyncEnabled, createContentSync, normalizeLockDrift, pendingContent, pushContentOnce } from "../app/server/contentSync";

/**
 * D101: «كل الأماكن نسخة واحدة». مستودع «GitHub» مجرد (bare)، وجهاز المالك (mac)، ونسخة مطور تدفع التحديثات.
 */
const gitEnv = cleanGitEnv();
const g = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.email=t@example.invalid", "-c", "user.name=T", ...args], { cwd, env: gitEnv }).toString().trim();
const dirs: string[] = [];
beforeEach(() => {
  const b = mkdtempSync(path.join(os.tmpdir(), "bal-sync-backup-"));
  dirs.push(b);
  process.env.BAL_UPDATE_BACKUP_DIR = b;
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

const PLAN = "channels/zubdat-alkutub/episodes/001-x/plan.json";
const PLAN_B = "channels/dafatir-alzaman/episodes/001-y/plan.json";
const SERIES = "channels/balislam/series/s1/series.json";
const LEDGER = "channels/zubdat-alkutub/episodes/001-x/scene-production.v1.json";

const setup = (files: Record<string, string>) => {
  const base = mkdtempSync(path.join(os.tmpdir(), "bal-sync-"));
  dirs.push(base);
  const remote = path.join(base, "remote.git");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", remote], { env: gitEnv });
  const dev = path.join(base, "dev");
  execFileSync("git", ["clone", "-q", remote, dev], { env: gitEnv });
  g(dev, "checkout", "-q", "-b", "main");
  write(dev, ".gitignore", "channels/*/episodes/*/scene-production.v1.json\nchannels/*/episodes/*/voice/\n");
  for (const [f, t] of Object.entries(files)) write(dev, f, t);
  g(dev, "add", "-A");
  g(dev, "commit", "-qm", "init");
  g(dev, "push", "-q", "origin", "main");
  const mac = path.join(base, "mac");
  execFileSync("git", ["clone", "-q", "-b", "main", remote, mac], { env: gitEnv });
  const push = (changes: Record<string, string>) => {
    g(dev, "pull", "-q", "--ff-only", "origin", "main");
    for (const [f, t] of Object.entries(changes)) write(dev, f, t);
    g(dev, "add", "-A");
    g(dev, "commit", "-qm", "upstream");
    g(dev, "push", "-q", "origin", "main");
  };
  const remoteFile = (f: string) => { try { return execFileSync("git", ["show", `main:${f}`], { cwd: remote, env: gitEnv }).toString(); } catch { return null; } };
  const remoteFilesOfTip = () => execFileSync("git", ["diff-tree", "-r", "--name-only", "--no-commit-id", "main"], { cwd: remote, env: gitEnv }).toString().split("\n").filter(Boolean);
  return { base, remote, dev, mac, push, remoteFile, remoteFilesOfTip };
};
const sync = (root: string) => createContentSync(root, { enabled: true, quietMs: 0, log: () => {} });

describe("D101: تصنيف ملفات الاستوديو", () => {
  it("محتوى المالك يُحفظ، والمحلي لا يُرفع أبدًا", () => {
    for (const f of [PLAN, SERIES, "channels/zubdat-alkutub/episodes/001-x/script.md", "channels/zubdat-alkutub/episodes/001-x/publish.json",
      "channels/zubdat-alkutub/episodes/001-x/previews/index.json", "channels/zubdat-alkutub/pronunciations.json", "channels/balislam/channel.json", "config.json"])
      expect(isOwnerContentPath(f), f).toBe(true);
    for (const f of [LEDGER, ".env", "channels/x/episodes/001-x/storyboard.json", "channels/x/episodes/001-x/notes/inbox.json",
      "channels/x/episodes/001-x/notes/resolved.json", "channels/x/episodes/001-x/voice/index.json", "channels/x/episodes/001-x/previews/episode.mp4",
      "channels/x/episodes/001-x/script-approved.v1.json", "src/plan/validate.ts", "package-lock.json", "app/server/api.ts", "../etc/passwd",
      // D107: the plan write lock and the rolling backup are local to the computer
      "channels/x/episodes/001-x/plan.json.write.lock", "channels/x/episodes/001-x/plan.backup-last.json"])
      expect(isOwnerContentPath(f), f).toBe(false);
  });
  it("D107: قفل كتابة الخطة في .gitignore فلا يظهر ملفًا جديدًا ولا يُرفع", () => {
    const ignored = spawnSync("git", ["check-ignore", "-q", "--no-index", "channels/balislam/episodes/001-x/plan.json.write.lock"], { cwd: path.resolve(import.meta.dirname, "..") });
    expect(ignored.status).toBe(0);
  });
  it("رسالة الحفظ عربية وتسمي القناة والحلقة وما تغيّر", () => {
    const m = commitMessage([PLAN, SERIES]);
    expect(m).toMatch(/^حفظ الاستوديو: /);
    expect(m).toContain("زبدة الكتب 001: الخطة");
    expect(m).toContain("بالإسلام (سلسلة s1): السلسلة");
  });
  it("مطفأ في الاختبارات وعلى Linux، ومفعَّل على الماك أو بطلب صريح", () => {
    expect(contentSyncEnabled({ VITEST: "1" }, "darwin")).toBe(false);
    expect(contentSyncEnabled({}, "linux")).toBe(false);
    expect(contentSyncEnabled({}, "darwin")).toBe(true);
    expect(contentSyncEnabled({ BAL_CONTENT_SYNC: "on" }, "linux")).toBe(true);
    expect(contentSyncEnabled({ BAL_CONTENT_SYNC: "off" }, "darwin")).toBe(false);
  });
});

describe("D101: الحفظ الآلي في main", { timeout: 120_000 }, () => {
  it("commit الحفظ فيه ملفات المحتوى وحدها؛ السجل الموقَّع والصوت لا يُرفعان أبدًا", async () => {
    const r = setup({ [PLAN]: lines(5), "src/code.ts": "export {}\n" });
    write(r.mac, PLAN, lines(5, " (owner)"));
    write(r.mac, SERIES, "{\"id\":\"s1\"}\n");
    write(r.mac, LEDGER, "{\"signed\":true}\n");
    write(r.mac, "channels/zubdat-alkutub/episodes/001-x/voice/take.mp3", "AUDIO");
    write(r.mac, "src/code.ts", "export const hacked = 1\n"); // كود معدّل محليًا: لا يُرفع آليًا
    const p = await pendingContent(r.mac);
    expect(p!.files).toEqual([SERIES, PLAN].sort());
    const res = await pushContentOnce(r.mac, p!.files);
    expect(res.ok).toBe(true);
    expect(r.remoteFilesOfTip().sort()).toEqual([SERIES, PLAN].sort());
    expect(r.remoteFile(PLAN)).toBe(lines(5, " (owner)"));
    expect(r.remoteFile(LEDGER)).toBeNull();
    expect(r.remoteFile("src/code.ts")).toBe("export {}\n");
    // main المحلي = GitHub، وملفات المحتوى صارت «محفوظة»، والكود المعدّل باقٍ كما هو على القرص
    expect(g(r.mac, "rev-parse", "HEAD")).toBe(execFileSync("git", ["rev-parse", "main"], { cwd: r.remote, env: gitEnv }).toString().trim());
    expect(g(r.mac, "status", "--porcelain")).toBe("M src/code.ts");
    expect(read(r.mac, LEDGER)).toBe("{\"signed\":true}\n");
  });

  it("تحديث متزامن من GitHub في ملف آخر: يُستقبل أولًا ثم يُحفظ عمل المالك فوقه", async () => {
    const r = setup({ [PLAN]: lines(5), [PLAN_B]: lines(5) });
    write(r.mac, PLAN, lines(5, " (owner)"));
    r.push({ [PLAN_B]: lines(5, " (dev)") });
    const s = sync(r.mac);
    await s.tick(true);
    expect(s.state.state).toBe("synced");
    expect(r.remoteFile(PLAN)).toBe(lines(5, " (owner)"));
    expect(r.remoteFile(PLAN_B)).toBe(lines(5, " (dev)"));
    expect(read(r.mac, PLAN_B)).toBe(lines(5, " (dev)"));
    expect(g(r.mac, "status", "--porcelain")).toBe("");
  });

  it("الملف نفسه تغيّر هنا وعلى GitHub في موضعين مختلفين: يندمجان ويُحفظ الناتج", async () => {
    const r = setup({ [PLAN]: lines(20) });
    write(r.mac, PLAN, lines(20).replace("line 2\n", "line 2 owner\n"));
    r.push({ [PLAN]: lines(20).replace("line 19\n", "line 19 dev\n") });
    const s = sync(r.mac);
    await s.tick(true);
    const merged = r.remoteFile(PLAN)!;
    expect(merged).toContain("line 2 owner");
    expect(merged).toContain("line 19 dev");
    expect(s.state.state).toBe("synced");
  });

  it("تعارض حقيقي: لا كتابة فوق أحد، تظهر بطاقة القرار، ولا يُرسل الملف المتعارض", async () => {
    const r = setup({ [PLAN]: lines(5) });
    write(r.mac, PLAN, lines(5).replace("line 3\n", "line 3 owner\n"));
    r.push({ [PLAN]: lines(5).replace("line 3\n", "line 3 dev\n") });
    const s = sync(r.mac);
    await s.tick(true);
    expect(s.state.state).toBe("conflict");
    expect(s.state.conflicts).toBe(1);
    expect(s.state.message).toBe("يحتاج قرارك (ملف واحد)");
    expect(r.remoteFile(PLAN)).toContain("line 3 dev");
    // نسخة المالك محفوظة في النسخة الاحتياطية
    const backups = readdirSync(process.env.BAL_UPDATE_BACKUP_DIR!);
    expect(backups.some((d) => existsSync(path.join(process.env.BAL_UPDATE_BACKUP_DIR!, d, "files", PLAN)))).toBe(true);
  });

  it("بلا اتصال: يبقى «لم يُحفظ في المستودع بعد» ويُعاد لاحقًا بلا فقد", async () => {
    const r = setup({ [PLAN]: lines(5) });
    write(r.mac, PLAN, lines(5, " (owner)"));
    g(r.mac, "remote", "set-url", "origin", path.join(r.base, "missing.git"));
    const s = sync(r.mac);
    await s.tick(true);
    expect(s.state.state).toBe("pending");
    expect(s.state.message).toBe("لم يُحفظ في المستودع بعد — سيُعاد تلقائيًا");
    expect(s.state.pending).toEqual([PLAN]);
    expect(read(r.mac, PLAN)).toBe(lines(5, " (owner)"));
    g(r.mac, "remote", "set-url", "origin", r.remote);
    await s.tick(true);
    expect(s.state.state).toBe("synced");
    expect(r.remoteFile(PLAN)).toBe(lines(5, " (owner)"));
  });

  it("خطاف البوابة يرفض: لا يتقدم main المحلي، ويظهر السبب", async () => {
    const r = setup({ [PLAN]: lines(5) });
    write(r.mac, PLAN, lines(5, " (owner)"));
    mkdirSync(path.join(r.mac, ".git", "hooks"), { recursive: true });
    writeFileSync(path.join(r.mac, ".git", "hooks", "pre-push"), "#!/bin/sh\necho '  • plan.json: خطأ جديد في الخطة' >&2\necho '✗ بوابة المحتوى رفضت الدفع' >&2\nexit 1\n", { mode: 0o755 });
    const head = g(r.mac, "rev-parse", "HEAD");
    const s = sync(r.mac);
    await s.tick(true);
    expect(s.state.state).toBe("pending");
    expect(s.state.message).toContain("رفضت البوابة");
    expect(g(r.mac, "rev-parse", "HEAD")).toBe(head);
    expect(read(r.mac, PLAN)).toBe(lines(5, " (owner)"));
  });

  it("package-lock.json الذي أعاد npm كتابته يُرجع إلى main بعد نسخة احتياطية", async () => {
    const r = setup({ "package.json": "{}\n", "package-lock.json": "{\"v\":1}\n" });
    write(r.mac, "package-lock.json", "{\"v\":1,\"libc\":[\"glibc\"]}\n");
    expect(await normalizeLockDrift(r.mac)).toBe(true);
    expect(read(r.mac, "package-lock.json")).toBe("{\"v\":1}\n");
    expect(readdirSync(path.join(process.env.BAL_UPDATE_BACKUP_DIR!, "package-lock")).length).toBe(1);
    // تغيير حقيقي في الحزم لا يُلمس
    write(r.mac, "package.json", "{\"dependencies\":{\"x\":\"1\"}}\n");
    write(r.mac, "package-lock.json", "{\"v\":2}\n");
    expect(await normalizeLockDrift(r.mac)).toBe(false);
    expect(read(r.mac, "package-lock.json")).toBe("{\"v\":2}\n");
  });
});

describe("D101: البوابة تقرر بالفرق", { timeout: 60_000 }, () => {
  it("دفع محتوى فقط ⇒ بوابة المحتوى؛ أي كود في المدى ⇒ البوابة الكاملة", () => {
    const r = setup({ [PLAN]: lines(3), "src/a.ts": "a\n" });
    const base = g(r.dev, "rev-parse", "HEAD");
    write(r.dev, PLAN, lines(3, " x"));
    g(r.dev, "commit", "-qam", "content");
    expect(contentOnlyFiles(r.dev, base, g(r.dev, "rev-parse", "HEAD"), gitEnv)).toEqual([PLAN]);
    // كود أُضيف ثم أُزيل داخل المدى: الفرق النهائي محتوى فقط، لكن commit في المدى لمس الكود
    write(r.dev, "src/a.ts", "evil\n");
    g(r.dev, "commit", "-qam", "code");
    write(r.dev, "src/a.ts", "a\n");
    g(r.dev, "commit", "-qam", "revert");
    expect(contentOnlyFiles(r.dev, base, g(r.dev, "rev-parse", "HEAD"), gitEnv)).toBeNull();
    // بداية مدى ليست سلفًا ⇒ كاملة
    expect(contentOnlyFiles(r.dev, "0000000000000000000000000000000000000000", g(r.dev, "rev-parse", "HEAD"), gitEnv)).toBeNull();
  });
});

describe("D101: استوديو واحد على المنفذ", () => {
  const listen = (port: number, cwd: string) => new Promise<ReturnType<typeof spawn>>((resolve) => {
    const child = spawn(process.execPath, ["-e", `require("net").createServer().listen(${port},"127.0.0.1",()=>console.log("up"))`], { cwd, stdio: ["ignore", "pipe", "ignore"] });
    child.stdout!.once("data", () => resolve(child));
  });
  it("نسخة أقدم من المجلد نفسه تُغلق ويؤخذ المنفذ؛ وبرنامج آخر يُقال عنه بالعربية ولا يُمس", async () => {
    const ours = mkdtempSync(path.join(os.tmpdir(), "bal-studio-root-"));
    const other = mkdtempSync(path.join(os.tmpdir(), "bal-other-"));
    dirs.push(ours, other);
    const port = 47000 + Math.floor(Math.random() * 1000);
    const old = await listen(port, ours);
    expect(await portFree(port)).toBe(false);
    const msgs: string[] = [];
    expect(await freePort(port, ours, { log: (m) => msgs.push(m), error: (m) => msgs.push(m) })).toBe(true);
    expect(await portFree(port)).toBe(true);
    old.kill();
    const foreign = await listen(port, other);
    try {
      expect(await freePort(port, ours, { log: (m) => msgs.push(m), error: (m) => msgs.push(m) })).toBe(false);
      expect(msgs.join("\n")).toContain("مشغول ببرنامج آخر");
      expect(foreign.exitCode).toBeNull();
    } finally { foreign.kill(); }
  }, 30_000);
});
