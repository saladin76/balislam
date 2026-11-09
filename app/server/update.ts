import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { childEnv } from "../../scripts/git-env.mjs";

/**
 * Safe, explicit studio update.
 * Never changes local edits, creates automatic commits, resolves conflicts,
 * checks out files, or updates a detached review worktree.
 */
const git = (root: string, args: string[], timeout = 60_000) =>
  new Promise<{ ok: boolean; out: string }>((resolve) => {
    execFile("git", args, { cwd: root, timeout, env: childEnv({ GIT_TERMINAL_PROMPT: "0" }) },
      (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout}${stderr}`.trim() }));
  });
const run = (cmd: string, args: string[], root: string, timeout = 600_000) =>
  new Promise<{ ok: boolean; out: string }>((resolve) => {
    execFile(cmd, args, { cwd: root, timeout, shell: process.platform === "win32", env: childEnv() },
      (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout}${stderr}`.trim() }));
  });

export type UpdateStatus = {
  available: boolean; behind: number; changes: string[]; error?: string;
  /** An update exists but local files block it: the Arabic message names them. */
  blocked?: string;
};
let lastFetch = 0;
let cached: UpdateStatus | null = null;
let updating = false;

const activeMain = async (root: string): Promise<boolean> => {
  const branch = await git(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  return branch.ok && branch.out === "main";
};
/**
 * Files that block an update: modified/staged tracked files and untracked files that are not
 * ignored. Ignored files (local runtime state listed in .gitignore: approval ledgers, locks, voice,
 * out…) never block. `null` means Git itself failed (treated as blocking).
 */
export const blockingFiles = async (root: string): Promise<{ tracked: string[]; untracked: string[] } | null> => {
  const status = await new Promise<{ ok: boolean; out: string }>((resolve) => {
    execFile("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
      { cwd: root, timeout: 60_000, env: childEnv({ GIT_TERMINAL_PROMPT: "0" }), maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => resolve({ ok: !err, out: String(stdout) }));
  });
  if (!status.ok) return null;
  const tracked: string[] = [], untracked: string[] = [];
  const entries = status.out.split("\0");
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i] ?? "";
    if (e.length < 4) continue;
    const code = e.slice(0, 2), file = e.slice(3);
    if (code === "??") untracked.push(file);
    else {
      tracked.push(file);
      if (code.startsWith("R") || code.startsWith("C")) i++; // -z: the rename/copy source follows
    }
  }
  return { tracked, untracked };
};
const LIST_MAX = 8;
const listLines = (files: string[]) =>
  files.slice(0, LIST_MAX).map((f) => `• ${f}`).join("\n") +
  (files.length > LIST_MAX ? `\n• و${files.length - LIST_MAX} ملفًا آخر` : "");
/** Arabic explanation naming the files that block the update, or null when the tree is clean. */
export const dirtyTreeMessage = async (root: string): Promise<string | null> => {
  const b = await blockingFiles(root);
  if (!b) return "تعذّر فحص حالة الملفات المحلية بـ Git؛ لم يُعدل أي ملف.";
  if (!b.tracked.length && !b.untracked.length) return null;
  const parts = ["لا يُحدَّث الاستوديو لأن هذه الملفات تغيّرت على هذا الجهاز ولم تُحفظ في Git، والتحديث لا يكتب فوقها:"];
  if (b.tracked.length) parts.push(`ملفات متتبَّعة معدَّلة (${b.tracked.length}):\n${listLines(b.tracked)}`);
  if (b.untracked.length) parts.push(`ملفات جديدة غير متتبَّعة (${b.untracked.length}):\n${listLines(b.untracked)}`);
  parts.push("احفظها (commit) أو أرسل القائمة إلى Claude ليحدد مكانها، ثم أعد المحاولة. لم يُعدل أي ملف.");
  return parts.join("\n");
};

/** Detect unfinished operations even when 'git status --porcelain' is empty. */
const pendingGitOperation = async (root: string): Promise<boolean> => {
  // Check Git's actual control files, not rev-parse --verify: a malformed or
  // partially written MERGE_HEAD must still block updates. --git-path also
  // supports linked worktrees, where control files live outside the checkout.
  for (const marker of [
    "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "REBASE_HEAD",
    "rebase-merge", "rebase-apply", "sequencer",
  ]) {
    const resolved = await git(root, ["rev-parse", "--git-path", marker]);
    if (!resolved.ok || !resolved.out) return true;
    const location = path.isAbsolute(resolved.out)
      ? resolved.out : path.resolve(root, resolved.out);
    if (existsSync(location)) return true;
  }
  return false;
};

export const updateStatus = async (root: string, force = false): Promise<UpdateStatus> => {
  const off = { available: false, behind: 0, changes: [] };
  if (updating) return off;
  if (!await activeMain(root)) return { ...off, error: "التحديث داخل الاستوديو متاح لفرع main فقط؛ نسخة المراجعة لا تتحدث تلقائيًا." };
  if (await pendingGitOperation(root)) return { ...off, error: "هناك عملية Git غير مكتملة (دمج أو إعادة تأسيس أو انتقاء التزام)؛ لا تحديث قبل حلها يدويًا." };
  const dirty = await dirtyTreeMessage(root);
  if (force || !cached || Date.now() - lastFetch >= 60_000) {
    const f = await git(root, ["fetch", "--quiet", "origin", "main"]);
    if (!f.ok) return { ...off, error: "تعذّر الوصول إلى GitHub للتحقق من التحديث." };
    lastFetch = Date.now();
  }
  const count = await git(root, ["rev-list", "--count", "HEAD..origin/main"]);
  const ahead = await git(root, ["rev-list", "--count", "origin/main..HEAD"]);
  if (!count.ok || !ahead.ok || Number(ahead.out) > 0) return { ...off, error: "الفرع المحلي متباعد عن main؛ يلزم مراجعة Git يدويًا." };
  const behind = Number(count.out) || 0;
  const log = behind ? (await git(root, ["log", "--format=%s", "HEAD..origin/main"])).out.split("\n").filter(Boolean).slice(0, 8) : [];
  // The dirty-tree check is not cached: the owner may commit the listed files at any moment.
  if (dirty) return { available: behind > 0, behind, changes: log, blocked: dirty };
  return (cached = { available: behind > 0, behind, changes: log });
};

export const applyUpdate = async (root: string): Promise<{ ok: boolean; message: string; reinstalled?: boolean }> => {
  if (updating) return { ok: false, message: "يوجد تحديث قيد التنفيذ." };
  updating = true;
  try {
    if (!await activeMain(root)) return { ok: false, message: "أوقف التحديث: هذه نسخة مراجعة أو فرع غير main." };
    if (await pendingGitOperation(root)) return { ok: false, message: "أوقف التحديث: توجد عملية Git غير مكتملة؛ لم يُعدل أي ملف." };
    const dirty = await dirtyTreeMessage(root);
    if (dirty) return { ok: false, message: `أوقف التحديث. ${dirty}` };
    const before = await git(root, ["rev-parse", "HEAD"]);
    const fetch = await git(root, ["fetch", "--quiet", "origin", "main"]);
    if (!fetch.ok) return { ok: false, message: "فشل التحقق من GitHub؛ لم يُطبّق التحديث." };
    const ahead = await git(root, ["rev-list", "--count", "origin/main..HEAD"]);
    if (!ahead.ok || Number(ahead.out) > 0) return { ok: false, message: "توجد commits محلية؛ يلزم دمجها يدويًا. لم يُعدل أي ملف." };
    // Recheck after network operation: never override edits or pending operations.
    if (await pendingGitOperation(root)) return { ok: false, message: "بدأت عملية Git أثناء جلب التحديث؛ أُوقف التحديث لحمايتها." };
    const dirtyAfter = await dirtyTreeMessage(root);
    if (dirtyAfter) return { ok: false, message: `ظهرت تعديلات أثناء الفحص؛ أُوقف التحديث لحمايتها. ${dirtyAfter}` };
    const m = await git(root, ["merge", "--ff-only", "origin/main"], 120_000);
    if (!m.ok) return { ok: false, message: "تعذّر تحديث main بشكل آمن (fast-forward فقط). لم نجرِ دمجًا تلقائيًا أو نحذف ملفات." };
    const changed = await git(root, ["diff", "--name-only", before.out, "HEAD"]);
    const needInstall = changed.ok && changed.out.split("\n").some((f) => f === "package.json" || f === "package-lock.json");
    if (!needInstall) return { ok: true, message: "تم تحديث الشيفرة بأمان." };
    const installed = await run("npm", ["ci", "--no-audit", "--no-fund"], root);
    if (!installed.ok) return { ok: false, message: "تحدّثت الشيفرة، لكن تثبيت الاعتماديات فشل. شغّل npm ci داخل هذا المجلد ثم أعد تشغيل الاستوديو." };
    return { ok: true, message: "تم التحديث وتثبيت الاعتماديات. أعد تشغيل الاستوديو.", reinstalled: true };
  } finally {
    updating = false;
    cached = null;
  }
};
