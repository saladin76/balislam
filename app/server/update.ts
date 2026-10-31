import { execFile } from "node:child_process";

/**
 * تحديث الاستوديو من داخله: يفحص GitHub كل فترة، وعند الضغط على «حدّث الآن»
 * يحفظ تعديلاتك المحلية في Git أولًا (حتى لا يضيع شيء)، ثم يدمج التحديث.
 * إن تعارض تعديلك مع التحديث في الملف نفسه يُلغى الدمج ويبقى كل شيء كما كان.
 */
const git = (root: string, args: string[], timeout = 60_000) =>
  new Promise<{ ok: boolean; out: string }>((resolve) => {
    execFile("git", args, { cwd: root, timeout, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: `${stdout}${stderr}`.trim() }),
    );
  });

const run = (cmd: string, args: string[], root: string, timeout = 600_000) =>
  new Promise<{ ok: boolean; out: string }>((resolve) => {
    execFile(cmd, args, { cwd: root, timeout, shell: process.platform === "win32" }, (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout}${stderr}`.trim() }));
  });

let lastFetch = 0;
let cached: UpdateStatus | null = null;

export type UpdateStatus = { available: boolean; behind: number; changes: string[]; error?: string };

let updating = false;

export const updateStatus = async (root: string, force = false): Promise<UpdateStatus> => {
  if (updating) return { available: false, behind: 0, changes: [] };
  // الجلب من GitHub مرة كل دقيقة على الأكثر، أما المقارنة بالنسخة المحلية فكل مرة (حتى لا يبقى الشريط بعد التحديث)
  if (force || !cached || Date.now() - lastFetch >= 60_000) {
    lastFetch = Date.now();
    const f = await git(root, ["fetch", "--quiet", "origin"]);
    if (!f.ok) return (cached = { available: false, behind: 0, changes: [], error: "تعذّر الاتصال بـ GitHub للتحقق من التحديثات." });
  }
  const behind = Number((await git(root, ["rev-list", "--count", "HEAD..@{u}"])).out) || 0;
  const log = behind ? (await git(root, ["log", "--format=%s", "HEAD..@{u}"])).out.split("\n").filter(Boolean).slice(0, 8) : [];
  return (cached = { available: behind > 0, behind, changes: log });
};

export const applyUpdate = async (root: string): Promise<{ ok: boolean; message: string; reinstalled?: boolean }> => {
  updating = true;
  try {
    await git(root, ["fetch", "--quiet", "origin"]);
    return await doApply(root);
  } finally {
    updating = false;
    cached = null;
  }
};

const doApply = async (root: string): Promise<{ ok: boolean; message: string; reinstalled?: boolean }> => {
  const before = (await git(root, ["rev-parse", "HEAD"])).out;
  // ملف القفل يتغير أحيانًا بمجرد npm install؛ لا قيمة له محليًا
  await git(root, ["checkout", "--", "package-lock.json"]);
  const dirty = (await git(root, ["status", "--porcelain"])).out;
  if (dirty) {
    // لا نحفظ ملفًا فيه علامات تعارض قديمة من git (<<<<<<<) وإلا صار جزءًا من التاريخ
    const marked = (await git(root, ["grep", "-l", "-E", "^(<<<<<<<|>>>>>>>) ", "--", "."])).out.split("\n").filter(Boolean);
    if (marked.length) return { ok: false, message: `في ملفاتك علامات تعارض قديمة من git (${marked.join("، ")}). صلّحها أولًا: git checkout origin/main -- ${marked.join(" ")}` };
    await git(root, ["add", "-A"]);
    const c = await git(root, ["-c", "user.name=Balislam Studio", "-c", "user.email=studio@localhost", "commit", "-q", "-m", "حفظ تلقائي لتعديلات الاستوديو قبل التحديث"]);
    if (!c.ok) return { ok: false, message: `تعذّر حفظ تعديلاتك قبل التحديث: ${c.out.slice(0, 200)}` };
  }
  const m = await git(root, ["-c", "user.name=Balislam Studio", "-c", "user.email=studio@localhost", "merge", "--no-edit", "@{u}"], 120_000);
  if (!m.ok) {
    const files = (await git(root, ["diff", "--name-only", "--diff-filter=U"])).out.split("\n").filter(Boolean);
    await git(root, ["merge", "--abort"]);
    return {
      ok: false,
      message: `التحديث يعدّل ملفًا عدّلته أنت أيضًا، فلم يُطبَّق حتى لا يضيع شيء من شغلك${files.length ? ` (${files.join("، ")})` : ""}. أرسل هذه الرسالة إلى Claude ليدمجهما.`,
    };
  }
  const changed = (await git(root, ["diff", "--name-only", before, "HEAD"])).out.split("\n");
  let reinstalled = false;
  if (changed.some((f) => f === "package.json" || f === "package-lock.json")) {
    const i = await run("npm", ["install", "--no-audit", "--no-fund"], root);
    if (!i.ok) return { ok: false, message: "نزل التحديث لكن تثبيت الحزم الجديدة فشل. أغلق الاستوديو وشغّل: npm install" };
    reinstalled = true;
  }
  cached = null;
  return { ok: true, message: dirty ? "تم التحديث، وحُفظت تعديلاتك كما هي." : "تم التحديث.", reinstalled };
};
