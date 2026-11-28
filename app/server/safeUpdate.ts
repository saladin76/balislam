import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { childEnv } from "../../scripts/git-env.mjs";
import { countAr, FILES } from "../../src/i18n/count.ts";

/**
 * «حدّث الآن» دون أن يوقفه عمل المالك المحلي (D95).
 *
 * الاستوديو نسخة واحدة للقنوات الثلاث على جهاز المالك؛ كان التحديث يُرفض ما دام أي ملف معدَّل
 * أو جديد من أي قناة، فلا يصل تطوير «دفاتر الزمن» لأن ملفًا في «زبدة الكتب» حفظه الاستوديو.
 * الآن، بالترتيب:
 *   ١. نسخة احتياطية كاملة لكل ملف معدَّل أو جديد أو محذوف خارج المستودع
 *      (`~/balislam-backup/update-<الوقت>/`: الملفات نفسها + patch لكل ملف + manifest.json). لا تُحذف آليًا أبدًا.
 *   ٢. الملف الذي لم يغيّره التحديث يبقى كما هو ولا يمنع شيئًا (fast-forward يتخطاه).
 *   ٣. الملف الذي تغيّر هنا وفي التحديث: يُرجَع مؤقتًا، يُطبَّق التحديث (fast-forward فقط)، ثم يُعاد
 *      تعديل المالك فوقه بـ `git apply --3way`. إن تداخل التعديلان فعلًا لا تُترك علامات تعارض:
 *      يبقى الجديد في مكانه، ونسخة المالك في النسخة الاحتياطية، ويُسأل المالك «أبقِ نسختي / خذ الجديد».
 *   ٤. ملف جديد عند المالك يضيفه التحديث بالمسار نفسه: يُنقل جانبًا (هو في النسخة الاحتياطية)، وإن
 *      اختلف عن الجديد يُسأل المالك كالسابق.
 *   ٥. package-lock.json: إن تغيّرت الحزم في التحديث يؤخذ ملف التحديث (ونسخة الجهاز محفوظة) ثم npm ci.
 *   ٦. يُخبر المالك هل يكفي إعادة تحميل الصفحة أم يلزم إعادة تشغيل `npm run app`.
 *   ٧. (D109) ملف متتبَّع لم يمسه المالك ويحذفه التحديث من main: يُنسخ قبل الدمج إلى
 *      `removed-upstream/` في النسخة الاحتياطية، وإن صار مساره متجاهَلًا (.gitignore؛ مثل فيديوهات المعاينة
 *      القديمة) يُعاد مكانه بايتًا ببايت بعد الدمج، فيبقى على جهاز المالك ويختفي من المستودع وحده.
 * لا commit تلقائي، ولا دمج غير fast-forward، ولا stash، ولا رفع شيء من جهاز المالك.
 */

type G = { ok: boolean; out: string };
export const git = (root: string, args: string[], timeout = 60_000, input?: string) =>
  new Promise<G>((resolve) => {
    const child = execFile("git", args, { cwd: root, timeout, env: childEnv({ GIT_TERMINAL_PROMPT: "0" }), maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout}${stderr}`.trim() }));
    if (input !== undefined) child.stdin?.end(input);
  });
const gitRaw = (root: string, args: string[]) =>
  new Promise<{ ok: boolean; out: Buffer }>((resolve) => {
    execFile("git", args, { cwd: root, timeout: 120_000, env: childEnv({ GIT_TERMINAL_PROMPT: "0" }), maxBuffer: 256 * 1024 * 1024, encoding: "buffer" },
      (err, stdout) => resolve({ ok: !err, out: stdout as unknown as Buffer }));
  });

export type LocalChange = { file: string; kind: "modified" | "deleted" | "added" | "untracked" };

/** كل ما تغيّر على الجهاز ولم يُحفظ في Git (الملفات المتجاهَلة في .gitignore لا تُعد). */
export const localChanges = async (root: string): Promise<LocalChange[] | null> => {
  const st = await new Promise<{ ok: boolean; out: string }>((resolve) =>
    execFile("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames"],
      { cwd: root, timeout: 60_000, env: childEnv({ GIT_TERMINAL_PROMPT: "0" }), maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => resolve({ ok: !err, out: String(stdout) })));
  if (!st.ok) return null;
  const out: LocalChange[] = [];
  for (const e of st.out.split("\0")) {
    if (e.length < 4) continue;
    const code = e.slice(0, 2), file = e.slice(3);
    if (code === "??") out.push({ file, kind: "untracked" });
    else if (code.includes("D")) out.push({ file, kind: "deleted" });
    else if (code[0] === "A") out.push({ file, kind: "added" });
    else out.push({ file, kind: "modified" });
  }
  return out;
};

/** الملفات المتتبَّعة التي يحذفها التحديث (D109). */
const upstreamDeletions = async (root: string, from: string, to: string): Promise<string[] | null> => {
  const d = await git(root, ["diff", "--name-only", "--no-renames", "--diff-filter=D", "-z", from, to]);
  if (!d.ok) return null;
  return d.out.split("\0").filter(Boolean);
};

/** المسارات التي يغيّرها التحديث (إضافة أو تعديل أو حذف) بين HEAD وorigin/main. */
const upstreamPaths = async (root: string, from: string, to: string): Promise<Set<string> | null> => {
  const d = await git(root, ["diff", "--name-only", "--no-renames", "-z", from, to]);
  if (!d.ok) return null;
  return new Set(d.out.split("\0").filter(Boolean));
};

const CHANNEL_NAMES: Record<string, string> = { "balislam": "بالإسلام", "dafatir-alzaman": "دفاتر الزمن", "zubdat-alkutub": "زبدة الكتب" };
export const channelOf = (root: string, file: string): string => {
  const m = /^channels\/([^/]+)\//.exec(file);
  if (!m) return "ملفات الاستوديو المشتركة";
  const id = m[1]!;
  try {
    const name = JSON.parse(readFileSync(path.join(root, "channels", id, "channel.json"), "utf8"))?.name;
    if (typeof name === "string" && name) return name;
  } catch { /* لا channel.json */ }
  return CHANNEL_NAMES[id] ?? id;
};

/** ملفات الخادم: تغيّرها يحتاج إعادة تشغيل `npm run app`؛ ما عداها (src/، الواجهة، ملفات القنوات) يكفيه إعادة التحميل. */
export const needsRestart = (files: string[]) =>
  files.some((f) => f.startsWith("app/server/") || /^app\/vite\.config\./.test(f) || f.startsWith("scripts/") ||
    f === "package.json" || f === "package-lock.json" || /^tsconfig.*\.json$/.test(f) || f === "start-studio.command");

export type UpdateConflict = {
  file: string; channel: string;
  /** المسار النسبي داخل مجلد النسخة الاحتياطية لنسخة المالك؛ null إن كانت نسخته «حذف الملف» */
  mine: string | null; backup: string; at: string;
  reason: "both-changed" | "untracked-collision" | "deleted-here-changed-there";
};

const conflictsFile = async (root: string) => {
  const p = await git(root, ["rev-parse", "--git-path", "bal-update-conflicts.json"]);
  return path.isAbsolute(p.out) ? p.out : path.resolve(root, p.out);
};
export const readConflicts = async (root: string): Promise<UpdateConflict[]> => {
  try { return JSON.parse(await readFile(await conflictsFile(root), "utf8")) as UpdateConflict[]; } catch { return []; }
};
const writeConflicts = async (root: string, list: UpdateConflict[]) => {
  const f = await conflictsFile(root);
  if (!list.length) { await rm(f, { force: true }); return; }
  await writeFile(f, JSON.stringify(list, null, 2) + "\n", "utf8");
};

export const backupRoot = () => process.env.BAL_UPDATE_BACKUP_DIR || path.join(os.homedir(), "balislam-backup");
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

/** ينسخ كل تغيير محلي خارج المستودع قبل أي لمس. يرمي إن فشل نسخ أي ملف (فلا يبدأ التحديث). */
const snapshot = async (root: string, changes: LocalChange[], head: string, upstream: string, removedUpstream: string[] = []) => {
  const dir = path.join(backupRoot(), `update-${stamp()}`);
  await mkdir(path.join(dir, "files"), { recursive: true });
  await mkdir(path.join(dir, "patches"), { recursive: true });
  // D109: ما يحذفه التحديث من ملفات لم يمسها المالك، قبل أن يحذفه Git
  for (const file of removedUpstream) {
    const src = path.join(root, file);
    const dst = path.join(dir, "removed-upstream", file);
    await mkdir(path.dirname(dst), { recursive: true });
    await copyFile(src, dst);
    const a = await readFile(src), b = await readFile(dst);
    if (!a.equals(b)) throw new Error(`تعذّر نسخ ${file} احتياطيًا؛ لم يُطبّق التحديث.`);
  }
  for (const c of changes) {
    const src = path.join(root, c.file);
    if (c.kind !== "deleted" && existsSync(src) && statSync(src).isFile()) {
      const dst = path.join(dir, "files", c.file);
      await mkdir(path.dirname(dst), { recursive: true });
      await copyFile(src, dst);
      const a = await readFile(src), b = await readFile(dst);
      if (!a.equals(b)) throw new Error(`تعذّر نسخ ${c.file} احتياطيًا؛ لم يُطبّق التحديث.`);
    }
    if (c.kind !== "untracked") {
      const p = await gitRaw(root, ["diff", "--binary", "--full-index", "HEAD", "--", c.file]);
      if (!p.ok) throw new Error(`تعذّر حفظ تعديل ${c.file}؛ لم يُطبّق التحديث.`);
      const dst = path.join(dir, "patches", `${c.file}.patch`);
      await mkdir(path.dirname(dst), { recursive: true });
      await writeFile(dst, p.out);
    }
  }
  const all = await gitRaw(root, ["diff", "--binary", "--full-index", "HEAD"]);
  await writeFile(path.join(dir, "all-tracked-changes.patch"), all.out);
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify({
    createdAt: new Date().toISOString(), repo: root, head, upstream,
    note: "نسخة احتياطية قبل «حدّث الآن». لا يحذفها الاستوديو أبدًا؛ احذفها بنفسك حين تطمئن.",
    changes, removedUpstream,
  }, null, 2) + "\n");
  return dir;
};

export type SafeUpdateResult = {
  ok: boolean; message: string; reinstalled?: boolean; restart?: boolean;
  backup?: string; kept?: number; merged?: string[]; conflicts?: UpdateConflict[];
};

const restoreFromHead = async (root: string, file: string) => {
  const inHead = (await git(root, ["cat-file", "-e", `HEAD:${file}`])).ok;
  if (inHead) return git(root, ["checkout", "HEAD", "--", file]);
  await git(root, ["rm", "-q", "--cached", "--ignore-unmatch", "--", file]);
  await rm(path.join(root, file), { force: true });
  return { ok: true, out: "" };
};

/**
 * التحديث نفسه. الشروط المسبقة (فرع main، لا عملية Git معلقة، لا commits محلية) يفحصها المستدعي.
 * `runInstall` يُستبدل في الاختبارات.
 */
export const safeFastForward = async (
  root: string,
  opts: { runInstall?: (root: string) => Promise<boolean> } = {},
): Promise<SafeUpdateResult> => {
  const head = (await git(root, ["rev-parse", "HEAD"])).out;
  const up = await git(root, ["rev-parse", "origin/main"]);
  if (!up.ok) return { ok: false, message: "لم يُعثر على نسخة GitHub (origin/main)؛ لم يُعدل أي ملف." };
  const upstream = up.out;
  if (head === upstream) return { ok: true, message: "الاستوديو محدّث." };
  const changes = await localChanges(root);
  if (!changes) return { ok: false, message: "تعذّر فحص حالة الملفات المحلية بـ Git؛ لم يُعدل أي ملف." };
  const upPaths = await upstreamPaths(root, head, upstream);
  if (!upPaths) return { ok: false, message: "تعذّر قراءة ما يغيّره التحديث؛ لم يُعدل أي ملف." };
  const pkgChanged = upPaths.has("package.json") || upPaths.has("package-lock.json");
  const deletions = await upstreamDeletions(root, head, upstream);
  if (!deletions) return { ok: false, message: "تعذّر قراءة ما يحذفه التحديث؛ لم يُعدل أي ملف." };
  const mine = new Set(changes.map((c) => c.file));
  const removedUpstream = deletions.filter((f) => !mine.has(f) && existsSync(path.join(root, f)) && statSync(path.join(root, f)).isFile());

  // D244 البند ٥: قبل أي دمج نسخة للسجل الموقّع لكل الحلقات على المجلد المشترك؛ إن لم يكن مركّبًا فعلى هذا الجهاز
  // (~/balislam-backup/ledger-offline/backups/ledger/) بالقاعدة نفسها، ولا يُطبّق التحديث إن فشلت النسخة.
  if (!process.env.VITEST) {
    try {
      const lb = await import("../../src/studio/ledgerBackup.ts");
      const share = process.env.BAL_SHARE || "/Volumes/bal-share";
      const target = existsSync(share) ? share : path.join(backupRoot(), "ledger-offline");
      if (!existsSync(target)) await mkdir(target, { recursive: true });
      await lb.backupLedgers(root, target, "update");
    } catch (e) { return { ok: false, message: `تعذّرت نسخة السجل الاحتياطية قبل التحديث؛ لم يُعدل أي ملف. (${(e as Error).message})` }; }
  }
  let backup: string | undefined;
  if (changes.length || removedUpstream.length) {
    try { backup = await snapshot(root, changes, head, upstream, removedUpstream); }
    catch (e) { return { ok: false, message: (e as Error).message }; }
  }

  // ما يتقاطع مع التحديث
  const touches = (f: string) => upPaths.has(f) || [...upPaths].some((u) => u.startsWith(`${f}/`) || f.startsWith(`${u}/`));
  const reapply: LocalChange[] = [];
  const lockTaken: string[] = [];
  const collisions: LocalChange[] = [];
  for (const c of changes) {
    if (!touches(c.file)) continue;
    if (c.file === "package-lock.json" && pkgChanged) { lockTaken.push(c.file); continue; }
    if (c.kind === "untracked") collisions.push(c);
    else reapply.push(c);
  }
  // package-lock.json المحلي يُرجع أيضًا إن تغيّرت package.json وحدها (npm ci يحتاج ملفًا مطابقًا)
  if (pkgChanged && changes.some((c) => c.file === "package-lock.json") && !lockTaken.includes("package-lock.json")) lockTaken.push("package-lock.json");

  // إرجاع المتقاطع مؤقتًا (كله محفوظ في النسخة الاحتياطية)
  for (const c of [...reapply, ...lockTaken.map((file) => ({ file, kind: "modified" as const }))]) {
    const r = await restoreFromHead(root, c.file);
    if (!r.ok) return rollbackMessage(backup, `تعذّر تجهيز ${c.file} للتحديث`);
  }
  for (const c of collisions) await rm(path.join(root, c.file), { force: true });

  const m = await git(root, ["merge", "--ff-only", "--no-edit", upstream], 120_000);
  if (!m.ok) {
    // أعد كل شيء كما كان من النسخة الاحتياطية
    if (backup) await restoreAll(root, backup, [...reapply, ...collisions, ...lockTaken.map((file) => ({ file, kind: "modified" as const }))]);
    return rollbackMessage(backup, "تعذّر تطبيق التحديث (fast-forward فقط)");
  }

  // D109: ما حذفه التحديث وصار مساره متجاهَلًا يعود مكانه كما كان (والنسخة الاحتياطية تبقى)
  const keptLocal: string[] = [];
  for (const file of removedUpstream) {
    if (existsSync(path.join(root, file))) continue;
    if (!(await git(root, ["check-ignore", "-q", "--", file])).ok) continue;
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await copyFile(path.join(backup!, "removed-upstream", file), path.join(root, file));
    keptLocal.push(file);
  }

  const at = new Date().toISOString();
  const conflicts: UpdateConflict[] = [];
  const merged: string[] = [];
  for (const c of reapply) {
    const patch = path.join(backup!, "patches", `${c.file}.patch`);
    const inNew = (await git(root, ["cat-file", "-e", `HEAD:${c.file}`])).ok;
    if (c.kind === "deleted" && !inNew) { merged.push(c.file); continue; }
    const a = await git(root, ["apply", "--3way", "--whitespace=nowarn", patch]);
    if (a.ok) {
      await git(root, ["reset", "-q", "--", c.file]); // يبقى تعديلًا محليًا غير مُدرَج كما كان
      merged.push(c.file);
    } else {
      // لا علامات تعارض في ملفات المالك: الجديد في مكانه، ونسخته في النسخة الاحتياطية
      await git(root, ["reset", "-q", "--", c.file]);
      await restoreFromHead(root, c.file);
      conflicts.push({
        file: c.file, channel: channelOf(root, c.file), at, backup: backup!,
        mine: c.kind === "deleted" ? null : path.join("files", c.file),
        reason: c.kind === "deleted" ? "deleted-here-changed-there" : "both-changed",
      });
    }
  }
  for (const c of collisions) {
    const mine = await readFile(path.join(backup!, "files", c.file)).catch(() => null);
    const theirs = await readFile(path.join(root, c.file)).catch(() => null);
    if (mine && theirs && mine.equals(theirs)) { merged.push(c.file); continue; }
    if (mine && !theirs) { // التحديث أضاف مجلدًا بالاسم نفسه أو حذف المسار: أعد ملف المالك إن أمكن
      if (!existsSync(path.join(root, c.file))) {
        await mkdir(path.dirname(path.join(root, c.file)), { recursive: true }).catch(() => {});
        await copyFile(path.join(backup!, "files", c.file), path.join(root, c.file)).catch(() => {});
      }
      merged.push(c.file);
      continue;
    }
    conflicts.push({ file: c.file, channel: channelOf(root, c.file), at, backup: backup!, mine: path.join("files", c.file), reason: "untracked-collision" });
  }
  if (conflicts.length) await writeConflicts(root, [...(await readConflicts(root)).filter((x) => !conflicts.some((y) => y.file === x.file)), ...conflicts]);

  const changed = (await git(root, ["diff", "--name-only", head, "HEAD"])).out.split("\n").filter(Boolean);
  let reinstalled = false;
  if (pkgChanged) {
    const install = opts.runInstall ?? defaultInstall;
    if (!await install(root)) {
      return { ok: false, message: "تحدّثت الشيفرة، لكن تثبيت الحزم فشل. شغّل npm ci داخل مجلد balislam ثم أعد تشغيل الاستوديو.", backup, conflicts };
    }
    reinstalled = true;
  }
  const restart = reinstalled || needsRestart(changed);
  const kept = changes.length - lockTaken.length - conflicts.length;
  const parts = ["تم التحديث."];
  if (changes.length) parts.push(`تعديلاتك المحلية باقية كما هي (${kept} من ${changes.length})، ونسخة احتياطية منها في ${displayPath(backup!)}.`);
  if (merged.length) parts.push(`أُعيد تعديلك فوق الجديد في: ${merged.slice(0, 4).join("، ")}${merged.length > 4 ? "…" : ""}.`);
  if (lockTaken.length) parts.push("ملف الحزم package-lock.json أُخذ من التحديث (نسخة جهازك محفوظة).");
  if (keptLocal.length) parts.push(`أزال التحديث من المستودع ${countAr(keptLocal.length, FILES)}، وبقيت على جهازك كما هي.`);
  if (removedUpstream.length > keptLocal.length) parts.push(`ما حذفه التحديث محفوظ في ${displayPath(backup!)}.`);
  if (conflicts.length) parts.push(`${conflicts.length === 1 ? "ملف واحد يحتاج" : `${conflicts.length} ملفات تحتاج`} قرارك: اختر «أبقِ نسختي» أو «خذ الجديد».`);
  parts.push(restart ? "تغيّرت ملفات الخادم: أغلق الاستوديو (Ctrl + C) وشغّل npm run app من جديد." : "يكفي إعادة تحميل الصفحة.");
  return { ok: true, message: parts.join(" "), reinstalled, restart, backup, kept, merged, conflicts };
};

const displayPath = (p: string) => p.startsWith(os.homedir()) ? `~${p.slice(os.homedir().length)}` : p;
const rollbackMessage = (backup: string | undefined, what: string): SafeUpdateResult =>
  ({ ok: false, message: `${what}؛ أُعيدت ملفاتك كما كانت${backup ? `، ونسختها الاحتياطية في ${displayPath(backup)}` : ""}.`, backup });
const restoreAll = async (root: string, backup: string, list: LocalChange[]) => {
  for (const c of list) {
    const saved = path.join(backup, "files", c.file);
    if (existsSync(saved)) {
      await mkdir(path.dirname(path.join(root, c.file)), { recursive: true });
      await copyFile(saved, path.join(root, c.file));
    } else if (c.kind === "deleted") await rm(path.join(root, c.file), { force: true });
  }
};
const defaultInstall = (root: string) => new Promise<boolean>((resolve) =>
  execFile("npm", ["ci", "--no-audit", "--no-fund"], { cwd: root, timeout: 600_000, shell: process.platform === "win32", env: childEnv() },
    (err) => resolve(!err)));

/** «أبقِ نسختي» أو «خذ الجديد» لملف واحد فقط. النسخة الاحتياطية لا تُحذف. */
export const resolveConflict = async (root: string, file: string, choice: "mine" | "new"): Promise<{ ok: boolean; message: string }> => {
  const list = await readConflicts(root);
  const c = list.find((x) => x.file === file);
  if (!c) return { ok: false, message: "هذا الملف لا ينتظر قرارًا." };
  if (choice === "mine") {
    const target = path.join(root, c.file);
    if (!path.resolve(target).startsWith(path.resolve(root) + path.sep)) return { ok: false, message: "مسار غير متوقع؛ لم يُعدل شيء." };
    if (c.mine) {
      const src = path.join(c.backup, c.mine);
      if (!existsSync(src)) return { ok: false, message: `لم تُعثر على نسختك في ${displayPath(c.backup)}؛ لم يُعدل شيء.` };
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(src, target);
    } else await rm(target, { force: true });
  }
  await writeConflicts(root, list.filter((x) => x.file !== file));
  return {
    ok: true,
    message: choice === "mine"
      ? `أُبقيت نسختك من ${c.file}. النسخة الجديدة في Git، ويمكن استرجاعها في أي وقت.`
      : `أُخذت النسخة الجديدة من ${c.file}. نسختك محفوظة في ${displayPath(c.backup)}.`,
  };
};
