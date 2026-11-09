import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanGitEnv } from "../scripts/git-env.mjs";

/**
 * fresh-start.command on a throw-away clone: it must never archive or delete the owner's approvals,
 * session, notes, voice, recitations or render drafts, and must stop before resetting unsaved approvals.
 */
const gitEnv = cleanGitEnv();
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { force: true, recursive: true }); });

const g = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.email=t@example.invalid", "-c", "user.name=T", ...args],
    { cwd, env: gitEnv }).toString();
const put = (root: string, rel: string, body = "x\n") => {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), body);
};

const setup = () => {
  const base = mkdtempSync(path.join(os.tmpdir(), "fresh-start-"));
  dirs.push(base);
  const origin = path.join(base, "origin.git"), work = path.join(base, "work"), home = path.join(base, "home"),
    bin = path.join(base, "bin");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", origin], { env: gitEnv });
  execFileSync("git", ["clone", "-q", origin, work], { env: gitEnv });
  copyFileSync(path.join(import.meta.dirname, "..", "fresh-start.command"), path.join(work, "fresh-start.command"));
  copyFileSync(path.join(import.meta.dirname, "..", ".gitignore"), path.join(work, ".gitignore"));
  put(work, "channels/c/episodes/001-a/script.md", "# a\n");
  put(work, "channels/c/episodes/001-a/review.json", "{}\n");
  g(work, "add", "-A"); g(work, "commit", "-qm", "init"); g(work, "push", "-q", "origin", "HEAD:main");
  mkdirSync(home); mkdirSync(bin);
  // npm/open/sleep are stubs: the script's install, typecheck and studio launch are out of scope here.
  for (const name of ["npm", "open", "sleep"]) {
    writeFileSync(path.join(bin, name), "#!/bin/sh\nexit 0\n"); chmodSync(path.join(bin, name), 0o755);
  }
  const run = () => spawnSync("bash", [path.join(work, "fresh-start.command")], {
    cwd: work, input: "نعم\n", env: { ...gitEnv, HOME: home, PATH: `${bin}:${process.env.PATH}` }, timeout: 60_000,
  });
  return { work, home, run };
};

const PROTECTED = [
  ".studio/owner-sessions.json",
  "channels/c/episodes/001-a/scene-production.v1.json",
  "channels/c/episodes/001-a/workflow-approvals.json",
  "channels/c/episodes/001-a/storyboard.json",
  "channels/c/episodes/001-a/script-signoff.json",
  "channels/c/episodes/001-a/voice-review.json",
  "channels/c/episodes/001-a/notes/inbox.json",
  "channels/c/episodes/001-a/voice/c1-s1.mp3",
  "channels/c/episodes/001-a/voice/index.json",
  "channels/c/episodes/001-a/voice/sentences.json",
  "channels/c/episodes/001-a/voice/c1-s1-s2-take1.mp3",
  "channels/c/episodes/001-a/voice/superseded/c1-s1-old.mp3",
  "channels/c/episodes/001-a/recitations/a.mp3",
  "channels/c/episodes/001-a/out/draft.mp4",
  // a whole untracked episode folder: its ledger and voice stay, only disposable media move
  "channels/c/episodes/002-new/scene-production.v1.json",
  "channels/c/episodes/002-new/voice/c1-s1.mp3",
  "assets/recitations/r.mp3",
];

describe("fresh-start.command safety", () => {
  it("archives disposable media but keeps every approval, session, note, voice, recitation and draft", () => {
    const { work, home, run } = setup();
    for (const p of PROTECTED) put(work, p, `keep ${p}\n`);
    put(work, "channels/c/episodes/001-a/images/big.png");
    put(work, "channels/c/episodes/002-new/images/old.png");
    put(work, "renders/x.mp4");
    const r = run();
    expect(r.status, r.stdout.toString() + r.stderr.toString()).toBe(0);
    for (const p of PROTECTED) expect(readFileSync(path.join(work, p), "utf8"), p).toBe(`keep ${p}\n`);
    expect(existsSync(path.join(work, "channels/c/episodes/001-a/images/big.png"))).toBe(false);
    expect(existsSync(path.join(work, "renders/x.mp4"))).toBe(false);
    const archived = execFileSync("find", [path.join(home, "balislam-archive"), "-type", "f"]).toString();
    expect(archived).toContain("001-a/images/big.png");
    expect(archived).toContain("002-new/images/old.png");
    for (const p of PROTECTED) expect(archived).not.toContain(p);
  }, 60_000);

  it("stops before any reset when a tracked approval file has unsaved changes", () => {
    const { work, run } = setup();
    put(work, "channels/c/episodes/001-a/review.json", "{\"approved\":true}\n");
    put(work, "channels/c/episodes/001-a/images/big.png");
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stdout.toString()).toContain("توقفت البداية النظيفة");
    expect(r.stdout.toString()).toContain("channels/c/episodes/001-a/review.json");
    expect(readFileSync(path.join(work, "channels/c/episodes/001-a/review.json"), "utf8")).toBe("{\"approved\":true}\n");
    expect(existsSync(path.join(work, "channels/c/episodes/001-a/images/big.png"))).toBe(true);
  }, 60_000);

  it("stops when local commits were never pushed", () => {
    const { work, run } = setup();
    put(work, "channels/c/episodes/001-a/storyboard.json", "{}\n");
    g(work, "add", "-f", "channels/c/episodes/001-a/storyboard.json"); g(work, "commit", "-qm", "local approval");
    const head = g(work, "rev-parse", "HEAD");
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stdout.toString()).toContain("local approval");
    expect(g(work, "rev-parse", "HEAD")).toBe(head);
  }, 60_000);
});
