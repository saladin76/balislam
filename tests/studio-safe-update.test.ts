import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyUpdate, dirtyTreeMessage, updateStatus } from "../app/server/update";
import { copyFileSync, mkdirSync } from "node:fs";
import { cleanGitEnv } from "../scripts/git-env.mjs";

/** مستودعات الاختبار المؤقتة لا ترث GIT_DIR وأخواته من خطّاف (الأمر 018) */
const gitEnv = cleanGitEnv();

const dirs: string[] = [];
const repo = () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "studio-safe-update-"));
  dirs.push(dir);
  execFileSync("git", ["init", "-q", "-b", "review/experiment"], { cwd: dir, env: gitEnv });
  writeFileSync(path.join(dir, "note.txt"), "original\n");
  execFileSync("git", ["add", "note.txt"], { cwd: dir, env: gitEnv });
  execFileSync("git", ["-c", "user.email=test@example.invalid", "-c", "user.name=Studio Test",
    "commit", "-q", "-m", "init"], { cwd: dir, env: gitEnv });
  return dir;
};
const read = (dir: string, f: string) => readFileSync(path.join(dir, f), "utf8");
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { force: true, recursive: true }); });

describe("safe studio updater", () => {
  it("never attempts to update a review branch", async () => {
    const dir = repo();
    const status = await updateStatus(dir, true);
    expect(status.available).toBe(false);
    const result = await applyUpdate(dir);
    expect(result.ok).toBe(false);
    expect(readFileSync(path.join(dir, "note.txt"), "utf8")).toBe("original\n");
    expect(execFileSync("git", ["log", "-1", "--format=%s"], { cwd: dir, env: gitEnv }).toString().trim()).toBe("init");
  }, 30_000);

  it("refuses an unfinished merge even if the tracked tree is clean", async () => {
    const dir = repo();
    execFileSync("git", ["branch", "-m", "main"], { cwd: dir, env: gitEnv });
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, env: gitEnv }).toString().trim();
    const gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], { cwd: dir, env: gitEnv }).toString().trim();
    writeFileSync(path.join(gitDir, "MERGE_HEAD"), head + "\n");
    const before = readFileSync(path.join(dir, "note.txt"), "utf8");
    const status = await updateStatus(dir, true);
    expect(status.available).toBe(false);
    expect(status.error).toMatch(/عملية Git غير مكتملة/);
    const result = await applyUpdate(dir);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/عملية Git غير مكتملة/);
    expect(readFileSync(path.join(dir, "note.txt"), "utf8")).toBe(before);
    expect(execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, env: gitEnv }).toString().trim()).toBe(head);
  }, 30_000);

  it("refuses a malformed MERGE_HEAD without attempting a network fetch", async () => {
    const dir = repo();
    execFileSync("git", ["branch", "-m", "main"], { cwd: dir, env: gitEnv });
    const gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], { cwd: dir, env: gitEnv }).toString().trim();
    writeFileSync(path.join(gitDir, "MERGE_HEAD"), "incomplete\\n");
    const result = await updateStatus(dir, true);
    expect(result.available).toBe(false);
    expect(result.error).toMatch(/عملية Git غير مكتملة/);
    const applied = await applyUpdate(dir);
    expect(applied.ok).toBe(false);
    expect(applied.message).toMatch(/عملية Git غير مكتملة/);
    expect(readFileSync(path.join(dir, "note.txt"), "utf8")).toBe("original\n");
  }, 30_000);

  it("refuses a rebase in progress, even when status is otherwise clean", async () => {
    const dir = repo();
    execFileSync("git", ["branch", "-m", "main"], { cwd: dir, env: gitEnv });
    const gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], { cwd: dir, env: gitEnv }).toString().trim();
    const { mkdirSync } = await import("node:fs");
    mkdirSync(path.join(gitDir, "rebase-merge"));
    expect((await applyUpdate(dir)).ok).toBe(false);
    expect((await updateStatus(dir, true)).error).toMatch(/عملية Git غير مكتملة/);
  }, 30_000);

  it("does not overwrite dirty work on main", async () => {
    const dir = repo();
    execFileSync("git", ["branch", "-m", "main"], { cwd: dir, env: gitEnv });
    writeFileSync(path.join(dir, "note.txt"), "local unsaved edit\n");
    const result = await applyUpdate(dir); // no remote: stops at the fetch; the edit is untouched (D95 keeps it in any case)
    expect(result.ok).toBe(false);
    expect(readFileSync(path.join(dir, "note.txt"), "utf8")).toBe("local unsaved edit\n");
    expect(execFileSync("git", ["status", "--porcelain"], { cwd: dir, env: gitEnv }).toString()).toContain("note.txt");
  }, 30_000);

  it("ignored local runtime state (scene ledger, board record, locks, voice approvals) never blocks; tracked edits are named", async () => {
    const dir = repo();
    execFileSync("git", ["branch", "-m", "main"], { cwd: dir, env: gitEnv });
    copyFileSync(path.join(import.meta.dirname, "..", ".gitignore"), path.join(dir, ".gitignore"));
    execFileSync("git", ["add", ".gitignore"], { cwd: dir, env: gitEnv });
    execFileSync("git", ["-c", "user.email=t@example.invalid", "-c", "user.name=T", "commit", "-qm", "ignore"], { cwd: dir, env: gitEnv });
    const ep = path.join(dir, "channels", "c", "episodes", "001-a");
    mkdirSync(path.join(ep, "previews", ".preview-index.lock"), { recursive: true });
    for (const f of ["scene-production.v1.json", "scene-production.v1.json.lock", "scene-production.v1.json.x.tmp",
      "workflow-approvals.json", "workflow-approvals.json.lock", "voice-review.json", "voice-review.json.1.x.tmp",
      // D60: the board record written by «اعتمد التجهيز» is local state bound to the ledger; it never blocks «حدّث الآن»
      "storyboard.json"])
      writeFileSync(path.join(ep, f), "{}\n");
    expect(await dirtyTreeMessage(dir)).toBeNull();
    // Ignored by .gitignore itself (not by a special case); an owner file documented "in Git" still blocks.
    expect(execFileSync("git", ["check-ignore", "-q", "channels/c/episodes/001-a/storyboard.json"], { cwd: dir, env: gitEnv }).length).toBe(0);
    writeFileSync(path.join(ep, "review.json"), "{}\n");
    writeFileSync(path.join(dir, "note.txt"), "edited\n");
    const msg = await dirtyTreeMessage(dir);
    expect(msg).toContain("note.txt");
    expect(msg).toContain("channels/c/episodes/001-a/review.json");
    expect(msg).not.toContain("storyboard.json");
    expect(msg).toMatch(/ملفات متتبَّعة معدَّلة \(1\)/);
    expect(msg).not.toContain("scene-production");
    // D95: local edits no longer block «حدّث الآن» (they are backed up and kept); here there is no
    // remote, so the update stops at the fetch without touching the edited file.
    const result = await applyUpdate(dir);
    expect(result.ok).toBe(false);
    expect(read(dir, "note.txt")).toBe("edited\n");
    expect(result.message).not.toMatch(/\/tmp\/|\/home\//);
  }, 30_000);
});
