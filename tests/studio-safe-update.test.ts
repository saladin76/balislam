import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyUpdate, updateStatus } from "../app/server/update";
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
  });

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
  });

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
  });

  it("refuses a rebase in progress, even when status is otherwise clean", async () => {
    const dir = repo();
    execFileSync("git", ["branch", "-m", "main"], { cwd: dir, env: gitEnv });
    const gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], { cwd: dir, env: gitEnv }).toString().trim();
    const { mkdirSync } = await import("node:fs");
    mkdirSync(path.join(gitDir, "rebase-merge"));
    expect((await applyUpdate(dir)).ok).toBe(false);
    expect((await updateStatus(dir, true)).error).toMatch(/عملية Git غير مكتملة/);
  });

  it("does not update a linked worktree even when its branch is named main", async () => {
    const primary = repo();
    const parent = mkdtempSync(path.join(os.tmpdir(), "studio-linked-checkout-"));
    dirs.push(parent);
    const linked = path.join(parent, "main-wt");
    execFileSync("git", ["worktree", "add", "-q", "-b", "main", linked], { cwd: primary, env: gitEnv });
    const original = readFileSync(path.join(linked, "note.txt"), "utf8");
    const before = execFileSync("git", ["rev-parse", "HEAD"], { cwd: linked, env: gitEnv }).toString().trim();
    const status = await updateStatus(linked, true);
    expect(status.available).toBe(false);
    expect(status.error).toBeTruthy();
    const applied = await applyUpdate(linked);
    expect(applied.ok).toBe(false);
    expect(readFileSync(path.join(linked, "note.txt"), "utf8")).toBe(original);
    expect(execFileSync("git", ["rev-parse", "HEAD"], { cwd: linked, env: gitEnv }).toString().trim()).toBe(before);
  });

  it("does not overwrite dirty work on main", async () => {
    const dir = repo();
    execFileSync("git", ["branch", "-m", "main"], { cwd: dir, env: gitEnv });
    writeFileSync(path.join(dir, "note.txt"), "local unsaved edit\n");
    const result = await applyUpdate(dir);
    expect(result.ok).toBe(false);
    expect(readFileSync(path.join(dir, "note.txt"), "utf8")).toBe("local unsaved edit\n");
    expect(execFileSync("git", ["status", "--porcelain"], { cwd: dir, env: gitEnv }).toString()).toContain("note.txt");
  });
});
