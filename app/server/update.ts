import { execFile } from "node:child_process";

/**
 * Safe, explicit studio update.
 * Never changes local edits, creates automatic commits, resolves conflicts,
 * checks out files, or updates a detached review worktree.
 */
const git = (root: string, args: string[], timeout = 60_000) =>
  new Promise<{ ok: boolean; out: string }>((resolve) => {
    execFile("git", args, { cwd: root, timeout, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } },
      (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout}${stderr}`.trim() }));
  });
const run = (cmd: string, args: string[], root: string, timeout = 600_000) =>
  new Promise<{ ok: boolean; out: string }>((resolve) => {
    execFile(cmd, args, { cwd: root, timeout, shell: process.platform === "win32" },
      (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout}${stderr}`.trim() }));
  });

export type UpdateStatus = { available: boolean; behind: number; changes: string[]; error?: string };
let lastFetch = 0;
let cached: UpdateStatus | null = null;
let updating = false;

const activeMain = async (root: string): Promise<boolean> => {
  const branch = await git(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  return branch.ok && branch.out === "main";
};
const cleanTree = async (root: string): Promise<boolean> => {
  const status = await git(root, ["status", "--porcelain"]);
  return status.ok && !status.out;
};

export const updateStatus = async (root: string, force = false): Promise<UpdateStatus> => {
  const off = { available: false, behind: 0, changes: [] };
  if (updating) return off;
  if (!await activeMain(root)) return { ...off, error: "التحديث داخل الاستوديو متاح لفرع main فقط؛ نسخة المراجعة لا تتحدث تلقائيًا." };
  if (!await cleanTree(root)) return { ...off, error: "هناك تغييرات محلية؛ لا يُحدّث الاستوديو حتى تُراجع وتُحفظ بأمان." };
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
  return (cached = { available: behind > 0, behind, changes: log });
};

export const applyUpdate = async (root: string): Promise<{ ok: boolean; message: string; reinstalled?: boolean }> => {
  if (updating) return { ok: false, message: "يوجد تحديث قيد التنفيذ." };
  updating = true;
  try {
    if (!await activeMain(root)) return { ok: false, message: "أوقف التحديث: هذه نسخة مراجعة أو فرع غير main." };
    if (!await cleanTree(root)) return { ok: false, message: "أوقف التحديث: توجد ملفات محلية غير محفوظة؛ لم يُعدل أي ملف." };
    const before = await git(root, ["rev-parse", "HEAD"]);
    const fetch = await git(root, ["fetch", "--quiet", "origin", "main"]);
    if (!fetch.ok) return { ok: false, message: "فشل التحقق من GitHub؛ لم يُطبّق التحديث." };
    const ahead = await git(root, ["rev-list", "--count", "origin/main..HEAD"]);
    if (!ahead.ok || Number(ahead.out) > 0) return { ok: false, message: "توجد commits محلية؛ يلزم دمجها يدويًا. لم يُعدل أي ملف." };
    // Recheck after network operation: never override edits made while fetching.
    if (!await cleanTree(root)) return { ok: false, message: "ظهرت تعديلات أثناء الفحص؛ أُوقف التحديث لحمايتها." };
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
