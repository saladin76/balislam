import { describe, expect, it, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { REPO_LOCATING_GIT_VARS, childEnv, cleanGitEnv, scrubProcessGitEnv } from "../scripts/git-env.mjs";

/**
 * اختبار ارتداد (الأمر 018، P0): خطّاف git من worktree يضع GIT_DIR للمستودع الحقيقي، وأي عملية فرعية
 * ترثه تعمل عليه بدل مجلدها (git init في مجلد مؤقت كتب core.bare = true في المستودع الحقيقي).
 * كل شيء هنا في مستودعات مؤقتة؛ لا يُمس مستودع المشروع.
 */
const root = path.join(__dirname, "..");
const dirs: string[] = [];
const tmp = (p: string) => {
  const d = mkdtempSync(path.join(os.tmpdir(), p));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const env = cleanGitEnv();
const git = (cwd: string, ...a: string[]) => execFileSync("git", ["-c", "user.email=t@example.invalid", "-c", "user.name=t", ...a], { cwd, env }).toString().trim();

/** مستودع «حقيقي» مؤقت بـworktree وخطّاف pre-push يشغّل git init في مجلد آخر، كما فعلت الاختبارات */
const setup = (hookBody: string) => {
  const base = tmp("git-env-");
  const real = path.join(base, "real");
  git(base, "init", "-q", "-b", "main", real);
  git(real, "commit", "-q", "--allow-empty", "-m", "base");
  git(real, "worktree", "add", "-q", path.join(base, "wt"));
  git(base, "init", "-q", "--bare", path.join(base, "remote.git"));
  git(real, "remote", "add", "origin", path.join(base, "remote.git"));
  const hook = path.join(real, ".git", "hooks", "pre-push");
  writeFileSync(hook, `#!/bin/sh\n${hookBody}\nexit 1\n`);
  chmodSync(hook, 0o755);
  const before = readFileSync(path.join(real, ".git", "config"), "utf8");
  const target = path.join(base, "other");
  // الدفع من الـworktree (الخطّاف يرفضه دائمًا، والمهم ما فعله أثناءه)
  git(path.join(base, "wt"), "commit", "-q", "--allow-empty", "-m", "wt");
  spawnSync("git", ["push", "-q", "origin", "HEAD:x"], { cwd: path.join(base, "wt"), env, encoding: "utf8" });
  return { real, before, after: readFileSync(path.join(real, ".git", "config"), "utf8"), target };
};

describe("عزل بيئة Git للعمليات الفرعية", () => {
  it("cleanGitEnv يزيل متغيرات تحديد المستودع ويُبقي إعدادات الشبكة والاعتماد", () => {
    const e = cleanGitEnv({ GIT_DIR: "/x/.git", GIT_WORK_TREE: "/x", GIT_INDEX_FILE: "/x/i", GIT_COMMON_DIR: "/x", GIT_CONFIG_COUNT: "1", GIT_SSL_CAINFO: "/ca", GIT_TERMINAL_PROMPT: "0", PATH: "/bin" });
    for (const k of REPO_LOCATING_GIT_VARS) expect(e[k]).toBeUndefined();
    expect(e).toMatchObject({ GIT_CONFIG_COUNT: "1", GIT_SSL_CAINFO: "/ca", GIT_TERMINAL_PROMPT: "0", PATH: "/bin" });
    expect(childEnv({ CI: "1" }, { GIT_DIR: "/x", HOME: "/h" })).toEqual({ HOME: "/h", CI: "1" });
    expect(childEnv({ GIT_DIR: "/malicious/.git", GIT_WORK_TREE: "/malicious", CI: "1" }, { HOME: "/h" })).toEqual({ HOME: "/h", CI: "1" });
    const p: NodeJS.ProcessEnv = { GIT_DIR: "/x", GIT_PREFIX: "", HOME: "/h" };
    expect(scrubProcessGitEnv(p).sort()).toEqual(["GIT_DIR", "GIT_PREFIX"]);
    expect(p).toEqual({ HOME: "/h" });
  });

  it("الخطر قائم بلا عزل: git init في مجلد آخر من خطّاف worktree يعيد تهيئة المستودع الحقيقي", () => {
    const r = setup(`git init -q -b review/experiment "$(dirname "$(git rev-parse --git-common-dir)")/../other" 2>/dev/null`);
    expect(r.before).not.toMatch(/bare = true/);
    expect(r.after).toMatch(/bare = true/);
    expect(existsSync(path.join(r.target, ".git"))).toBe(false);
  });

  it("بالعزل (childEnv كما في البوابة): المستودع الحقيقي لا يتغير، والمجلد الآخر مستودع مستقل", () => {
    const probe = `import("${path.join(root, "scripts", "git-env.mjs")}").then((m) => { const t = process.argv[1]; require("node:child_process").spawnSync("git", ["init", "-q", "-b", "review/experiment", t], { env: m.childEnv() }); })`;
    const r = setup(`T="$(dirname "$(git rev-parse --git-common-dir)")/../other"; node -e '${probe}' "$T"`);
    expect(r.after).toBe(r.before);
    expect(existsSync(path.join(r.target, ".git"))).toBe(true);
  });

  it("npm prepare from a linked worktree leaves original Git config, stash and branches untouched", () => {
    const base = tmp("git-hooks-linked-");
    const primary = path.join(base, "primary");
    const linked = path.join(base, "preview-wt");
    git(base, "init", "-q", "-b", "main", primary);
    git(primary, "commit", "-q", "--allow-empty", "-m", "start");
    git(primary, "worktree", "add", "-q", "-b", "preview", linked);
    mkdirSync(path.join(linked, "scripts"), { recursive: true });
    mkdirSync(path.join(linked, ".githooks"), { recursive: true });
    writeFileSync(path.join(linked, ".githooks", "pre-push"), "#!/bin/sh\\nexit 0\\n");
    for (const name of ["install-hooks.mjs", "git-env.mjs"])
      writeFileSync(path.join(linked, "scripts", name),
        readFileSync(path.join(root, "scripts", name), "utf8"));
    const configuration = path.join(primary, ".git", "config");
    const configBefore = readFileSync(configuration, "utf8");
    const branchesBefore = git(primary, "for-each-ref", "--format=%(refname):%(objectname)", "refs/heads");
    const stashBefore = git(primary, "stash", "list", "--format=%H");
    const run = spawnSync(process.execPath, [path.join(linked, "scripts", "install-hooks.mjs")], {
      cwd: linked, encoding: "utf8", env: cleanGitEnv({ ...process.env, GIT_DIR: path.join(primary, ".git") }),
    });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain("skipping shared Git hook configuration");
    expect(readFileSync(configuration, "utf8")).toBe(configBefore);
    expect(git(primary, "for-each-ref", "--format=%(refname):%(objectname)", "refs/heads")).toBe(branchesBefore);
    expect(git(primary, "stash", "list", "--format=%H")).toBe(stashBefore);
    expect(git(primary, "rev-parse", "--is-bare-repository")).toBe("false");
  });

  it("البوابة وكل ما يشغّل git في المشروع لا يورّث process.env كما هو", () => {
    const gate = readFileSync(path.join(root, "scripts", "gate.mjs"), "utf8");
    expect(gate).toMatch(/env: childEnv\(/);
    for (const f of ["scripts/gate.mjs", "scripts/docs-sync.mjs", "scripts/install-hooks.mjs", "app/server/update.ts", "app/server/extra.ts"]) {
      const s = readFileSync(path.join(root, f), "utf8");
      // لا عملية git فرعية ببيئة منسوخة من process.env دون تنظيف
      expect(s, f).not.toMatch(/execFile\("git"[^)]*\.\.\.process\.env/);
      expect(s, f).not.toMatch(/spawnSync\([^)]*env: \{ \.\.\.process\.env/);
    }
    const vitest = readFileSync(path.join(root, "vitest.config.ts"), "utf8");
    expect(vitest).toMatch(/setupFiles: \["tests\/setup\/git-env\.ts"\]/);
    // بيئة هذا الاختبار نفسه نظيفة (setupFiles)
    for (const k of REPO_LOCATING_GIT_VARS) expect(process.env[k]).toBeUndefined();
  });
});
