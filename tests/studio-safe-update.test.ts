import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyUpdate, updateStatus } from "../app/server/update";

const dirs: string[] = [];
const repo = () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "studio-safe-update-"));
  dirs.push(dir);
  execFileSync("git", ["init", "-q", "-b", "review/experiment"], { cwd: dir });
  writeFileSync(path.join(dir, "note.txt"), "original\n");
  execFileSync("git", ["add", "note.txt"], { cwd: dir });
  execFileSync("git", ["-c", "user.email=test@example.invalid", "-c", "user.name=Studio Test",
    "commit", "-q", "-m", "init"], { cwd: dir });
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
    expect(execFileSync("git", ["log", "-1", "--format=%s"], { cwd: dir }).toString().trim()).toBe("init");
  });

  it("refuses an unfinished merge even if the tracked tree is clean", async () => {
    const dir = repo();
    execFileSync("git", ["branch", "-m", "main"], { cwd: dir });
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir }).toString().trim();
    const gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], { cwd: dir }).toString().trim();
    writeFileSync(path.join(gitDir, "MERGE_HEAD"), head + "\\n");
    const before = readFileSync(path.join(dir, "note.txt"), "utf8");
    const status = await updateStatus(dir, true);
    expect(status.available).toBe(false);
    expect(status.error).toMatch(/عملية Git غير مكتملة/);
    const result = await applyUpdate(dir);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/عملية Git غير مكتملة/);
    expect(readFileSync(path.join(dir, "note.txt"), "utf8")).toBe(before);
    expect(execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir }).toString().trim()).toBe(head);
  });

  it("refuses a rebase in progress, even when status is otherwise clean", async () => {
    const dir = repo();
    execFileSync("git", ["branch", "-m", "main"], { cwd: dir });
    const gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], { cwd: dir }).toString().trim();
    const { mkdirSync } = await import("node:fs");
    mkdirSync(path.join(gitDir, "rebase-merge"));
    expect((await applyUpdate(dir)).ok).toBe(false);
    expect((await updateStatus(dir, true)).error).toMatch(/عملية Git غير مكتملة/);
  });

  it("does not overwrite dirty work on main", async () => {
    const dir = repo();
    execFileSync("git", ["branch", "-m", "main"], { cwd: dir });
    writeFileSync(path.join(dir, "note.txt"), "local unsaved edit\n");
    const result = await applyUpdate(dir);
    expect(result.ok).toBe(false);
    expect(readFileSync(path.join(dir, "note.txt"), "utf8")).toBe("local unsaved edit\n");
    expect(execFileSync("git", ["status", "--porcelain"], { cwd: dir }).toString()).toContain("note.txt");
  });
});
