import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanGitEnv } from "../scripts/git-env.mjs";
import { safeFastForward } from "../app/server/safeUpdate";
import { restoreUntrackedPreviews } from "../app/server/untrackedPreviews";

/**
 * D109: ملف متتبَّع يحذفه التحديث من main (فيديوهات المعاينة القديمة) لا يضيع من جهاز المالك.
 * - safeFastForward ينسخه إلى ~/balislam-backup قبل الدمج، وإن صار مسارُه متجاهَلًا (.gitignore) يُعاد مكانه بايتًا ببايت.
 * - إن طبّق التحديثَ كودٌ أقدم (حذفه git بلا نسخة)، فأول تشغيل للكود الجديد يعيده من كائنات Git المحلية
 *   (restoreUntrackedPreviews)، مرة واحدة، وبعد التحقق من البصمة، وللمسارات المتجاهَلة وحدها.
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

const VIDEO = "channels/zubdat-alkutub/episodes/001-a/previews/old.mp4";
const bytes = Buffer.from([0, 1, 2, 3, 250, 251, 252, 253, 10, 13, 0, 7]);
const blobOf = (root: string, rel: string) => g(root, "rev-parse", `HEAD:${rel}`);

describe("حذف ملف متتبَّع في التحديث لا يضيّعه من جهاز المالك (D109)", () => {
  it("المسار متجاهَل بعد التحديث: يبقى في مكانه كما هو، ونسخة منه في النسخة الاحتياطية", async () => {
    const { mac, push } = setup({ ".gitignore": "x\n", "channels/zubdat-alkutub/episodes/001-a/previews/index.json": "{}\n" });
    // الفيديو متتبَّع قبل القرار (أُضيف بالقوة كما حدث قبل .gitignore)
    const dev = path.join(path.dirname(mac), "dev");
    mkdirSync(path.dirname(path.join(dev, VIDEO)), { recursive: true });
    writeFileSync(path.join(dev, VIDEO), bytes);
    g(dev, "add", "-f", VIDEO); g(dev, "commit", "-qm", "video"); g(dev, "push", "-q", "origin", "main");
    g(mac, "pull", "-q", "--ff-only", "origin", "main");
    expect(readFileSync(path.join(mac, VIDEO))).toEqual(bytes);
    // التحديث: يُزال من التتبع، والمسار متجاهَل
    rmSync(path.join(dev, VIDEO));
    push({ ".gitignore": "x\nchannels/*/episodes/*/previews/*.mp4\n" });
    const r = await safeFastForward(mac, { runInstall: noInstall });
    expect(r.ok).toBe(true);
    expect(g(mac, "ls-files", VIDEO)).toBe("");
    expect(readFileSync(path.join(mac, VIDEO))).toEqual(bytes);
    expect(g(mac, "status", "--porcelain")).toBe("");
    expect(r.backup && r.backup.startsWith(backupDir)).toBe(true);
    expect(readFileSync(path.join(r.backup!, "removed-upstream", VIDEO))).toEqual(bytes);
    expect(r.message).toContain("وبقيت على جهازك كما هي");
  }, 30_000);

  it("المسار غير متجاهَل: يُحذف كما يحذفه Git، لكن بعد نسخه إلى النسخة الاحتياطية", async () => {
    const f = "channels/balislam/episodes/001-a/notes.md";
    const { mac, push } = setup({ [f]: "مهم\n", "a.txt": "a\n" });
    push({ [f]: null });
    const r = await safeFastForward(mac, { runInstall: noInstall });
    expect(r.ok).toBe(true);
    expect(existsSync(path.join(mac, f))).toBe(false);
    expect(readFileSync(path.join(r.backup!, "removed-upstream", f), "utf8")).toBe("مهم\n");
    expect(JSON.parse(readFileSync(path.join(r.backup!, "manifest.json"), "utf8")).removedUpstream).toEqual([f]);
  }, 30_000);

  it("حذفه كودٌ أقدم بلا نسخة: يُعاد من كائنات Git مرة واحدة، للمتجاهَل وحده وبالبصمة نفسها", async () => {
    const other = "channels/balislam/episodes/001-a/previews/other.mp4";
    const { mac, push } = setup({ ".gitignore": "x\n.studio/\n" });
    const dev = path.join(path.dirname(mac), "dev");
    for (const rel of [VIDEO, other]) {
      mkdirSync(path.dirname(path.join(dev, rel)), { recursive: true });
      writeFileSync(path.join(dev, rel), bytes);
      g(dev, "add", "-f", rel);
    }
    g(dev, "commit", "-qm", "videos"); g(dev, "push", "-q", "origin", "main");
    g(mac, "pull", "-q", "--ff-only", "origin", "main");
    const list = [{ path: VIDEO, blob: blobOf(mac, VIDEO) }, { path: other, blob: blobOf(mac, other) },
      { path: "channels/x/episodes/001-a/previews/never.mp4", blob: "0".repeat(40) }];
    rmSync(path.join(dev, VIDEO)); rmSync(path.join(dev, other));
    push({ ".gitignore": "x\n.studio/\nchannels/zubdat-alkutub/episodes/*/previews/*.mp4\n" });
    g(mac, "merge", "-q", "--ff-only", "origin/main"); // الكود القديم: Git يحذف الملفين
    expect(existsSync(path.join(mac, VIDEO))).toBe(false);
    const marker = path.join(mac, ".studio", "untracked-previews-restored.json");
    const r = await restoreUntrackedPreviews(mac, list);
    expect(r.restored).toEqual([VIDEO]);
    expect(readFileSync(path.join(mac, VIDEO))).toEqual(bytes);
    expect(existsSync(path.join(mac, other))).toBe(false); // غير متجاهَل: لا يُعاد فيظهر «ملفًا جديدًا»
    expect(g(mac, "status", "--porcelain")).toBe("");
    expect(existsSync(marker)).toBe(true);
    // مرة واحدة: لو حذفه المالك بعد ذلك لا يعود
    rmSync(path.join(mac, VIDEO));
    expect((await restoreUntrackedPreviews(mac, list)).restored).toEqual([]);
    expect(existsSync(path.join(mac, VIDEO))).toBe(false);
  }, 30_000);
});
