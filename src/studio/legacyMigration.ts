/**
 * ترحيل السجلات القديمة (العمل ٧، D120): الوحدة الوحيدة في المستودع التي تعرف أسماء ملفات الاعتمادات القديمة.
 *
 * السجلات القديمة لا يقرؤها شيء منذ توحيد ٨ نوفمبر (محرك اعتمادات واحد: سجل «إنتاج المشاهد»)، وحُذف كودها كله.
 * ما بقي منها على جهاز المالك يُؤرشف هنا، ولا يُحوَّل أبدًا إلى اعتماد في السجل الموحد: العقود التاريخية لا تمنح
 * اعتمادًا (CLAUDE.md). هذه الوحدة لا تستورد السجل الموحد ولا تكتب فيه، ولا تقرأ محتوى أي ملف إلا لبصمته.
 *
 * ما يفعله `migrateLegacyRecords` (و`npx bal migrate legacy`، ويعمل آليًا مع كل تشغيل للاستوديو):
 *   1. يجد في كل حلقة من كل قناة الملفات القديمة (وأقفالها وملفاتها المؤقتة)، ملفًا عاديًا غير متتبَّع في Git.
 *      لا شيء ⇒ لا كتابة إطلاقًا (idempotent: التشغيل الثاني لا يغيّر شيئًا ولا يصنع نسخة).
 *   2. نسخة احتياطية أولًا، قبل أي تغيير: كل ملف بايتًا ببايت إلى `~/balislam-backup/legacy-migration-<الوقت>/`
 *      (`BAL_LEGACY_BACKUP_DIR` يغيّر الجذر) بمساره `<القناة>/episodes/<الحلقة>/<الملف>` ومعها `manifest.json`،
 *      وتُطابق بصمة كل نسخة بصمة أصلها. أي فشل هنا يوقف الترحيل قبل أن يُنقل ملف واحد.
 *   3. أرشيف: يُنقل كل ملف (لا يُحذف) إلى `<جذر المشروع>/.studio/legacy-archive/<القناة>/<الحلقة>/<الملف>`
 *      (محلي، متجاهَل في Git، لا يُرفع أبدًا، ومحمي في البداية النظيفة). إن وُجد في الأرشيف ملف بالاسم نفسه
 *      وبايتات أخرى، يُحفظ الجديد باسم فيه بصمته؛ وإن كانت البايتات نفسها فالأصل نسخة مكررة محفوظة مرتين.
 *   4. سطر في `<الأرشيف>/migration-log.json` بما نُقل ومكان النسخة الاحتياطية.
 * الملف المتتبَّع في Git أو الرابط الرمزي يُترك مكانه ويُذكر (لا يُغيَّر Git من هنا).
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** السجلات القديمة: لا يقرؤها ولا يكتبها شيء غير هذه الوحدة. */
export const LEGACY_RECORDS = Object.freeze([
  { name: "workflow-approvals.json", label: "سجل المراحل الست" },
  { name: "voice-review.json", label: "اعتماد الصوت المنفصل" },
  { name: "script-signoff.json", label: "توقيع السكريبت القديم" },
  { name: "scene-review.json", label: "مراجعة المشاهد القديمة" },
  // بقايا مراجعة V2 المعزولة ونسخة السكريبت المعتمدة (D66، أُلغيت بـ D76): لا يقرؤهما شيء منذ زمن.
  { name: "scene-workflow.v2.json", label: "سجل مراجعة V2 المعزولة" },
  { name: "script-approved.v1.json", label: "نسخة السكريبت المعتمدة القديمة" },
] as const);

/** الاسم نفسه، أو أقفاله وملفات كتابته المؤقتة (`<الاسم>.lock`، `<الاسم>.<pid>.<uuid>.tmp`). */
export const legacyRecordOf = (fileName: string) =>
  LEGACY_RECORDS.find((r) => fileName === r.name || fileName.startsWith(`${r.name}.`));

export type LegacyFile = { channel: string; episode: string; name: string; file: string; bytes: number; sha256: string };
export type LegacySkipped = { channel: string; episode: string; name: string; reason: "tracked" | "not-a-file" };
export type LegacyMoved = LegacyFile & { archivedTo: string; duplicate: boolean };
export type LegacyMigrationResult = {
  found: LegacyFile[];
  moved: LegacyMoved[];
  skipped: LegacySkipped[];
  /** مجلد النسخة الاحتياطية لهذا التشغيل، أو null حين لم يُغيَّر شيء */
  backup: string | null;
  archive: string;
  dryRun: boolean;
};
export type LegacyMigrationOptions = {
  channelsDir: string;
  /** جذر النسخ الاحتياطية (الافتراضي BAL_LEGACY_BACKUP_DIR ثم ~/balislam-backup) */
  backupRoot?: string;
  /** مجلد الأرشيف (الافتراضي <أب مجلد القنوات>/.studio/legacy-archive) */
  archiveDir?: string;
  dryRun?: boolean;
  now?: () => Date;
};

export const legacyBackupRoot = () =>
  process.env.BAL_LEGACY_BACKUP_DIR?.trim() || path.join(os.homedir(), "balislam-backup");
export const legacyArchiveDir = (channelsDir: string) =>
  path.join(path.dirname(path.resolve(channelsDir)), ".studio", "legacy-archive");

const sha256 = async (file: string) => createHash("sha256").update(await readFile(file)).digest("hex");
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const dirs = async (dir: string) => {
  try {
    return (await readdir(dir, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && !d.isSymbolicLink() && SAFE.test(d.name)).map((d) => d.name).sort();
  } catch { return []; }
};

/** ملفات متتبَّعة في Git تحت مجلد القنوات (مسارات مطلقة)؛ خارج Git أو عند فشله: لا شيء. */
const trackedFiles = (channelsDir: string): Set<string> => {
  const run = (args: string[]) => spawnSync("git", args, { cwd: channelsDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_INDEX_FILE: undefined, GIT_TERMINAL_PROMPT: "0" } });
  const top = run(["rev-parse", "--show-toplevel"]);
  if (top.status !== 0) return new Set();
  const list = run(["ls-files", "-z", "--full-name", "--", "."]);
  if (list.status !== 0) return new Set();
  const base = top.stdout.trim();
  return new Set(list.stdout.split("\0").filter(Boolean).map((rel) => path.join(base, rel)));
};

/** ما بقي من السجلات القديمة في كل حلقة (للقراءة: البصمة والحجم وحدهما). */
export const findLegacyRecords = async (channelsDir: string): Promise<{ found: LegacyFile[]; skipped: LegacySkipped[] }> => {
  const found: LegacyFile[] = [];
  const skipped: LegacySkipped[] = [];
  let tracked: Set<string> | null = null;
  for (const channel of await dirs(channelsDir)) {
    const episodesDir = path.join(channelsDir, channel, "episodes");
    for (const episode of await dirs(episodesDir)) {
      const dir = path.join(episodesDir, episode);
      let names: string[];
      try { names = (await readdir(dir)).filter((n) => legacyRecordOf(n)).sort(); } catch { continue; }
      for (const name of names) {
        const file = path.join(dir, name);
        const info = await lstat(file).catch(() => null);
        if (!info) continue;
        if (!info.isFile() || info.isSymbolicLink()) { skipped.push({ channel, episode, name, reason: "not-a-file" }); continue; }
        tracked ??= trackedFiles(channelsDir);
        // git يعيد مسار المستودع الحقيقي؛ فيُقارن بالمسار الحقيقي للملف (KI-094: /var ← /private/var على الماك)
        const real = await realpath(file).catch(() => file);
        if (tracked.has(file) || tracked.has(path.resolve(file)) || tracked.has(real)) { skipped.push({ channel, episode, name, reason: "tracked" }); continue; }
        found.push({ channel, episode, name, file, bytes: info.size, sha256: await sha256(file) });
      }
    }
  }
  return { found, skipped };
};

const stampOf = (d: Date) => d.toISOString().replace(/[:.]/g, "-");

/** مجلد جديد لم يوجد من قبل (لا تُكتب نسخة فوق نسخة). */
const freshDir = async (parent: string, base: string) => {
  await mkdir(parent, { recursive: true });
  for (let i = 0; i < 1000; i++) {
    const dir = path.join(parent, i ? `${base}-${i}` : base);
    try { await mkdir(dir); return dir; }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
  }
  throw new Error("تعذّر إنشاء مجلد النسخة الاحتياطية للسجلات القديمة.");
};

/** نقل بلا فقد: rename، وإن اختلف القرص فنسخ ثم مطابقة البصمة ثم حذف الأصل. */
const moveFile = async (from: string, to: string, expected: string) => {
  try { await rename(from, to); return; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== "EXDEV") throw e; }
  await copyFile(from, to, constants.COPYFILE_EXCL);
  if (await sha256(to) !== expected) { await rm(to, { force: true }); throw new Error(`تعذّر نقل ${from} إلى الأرشيف بلا تغيير.`); }
  await rm(from);
};

export const migrateLegacyRecords = async (opts: LegacyMigrationOptions): Promise<LegacyMigrationResult> => {
  const channelsDir = path.resolve(opts.channelsDir);
  const archive = path.resolve(opts.archiveDir ?? legacyArchiveDir(channelsDir));
  const dryRun = opts.dryRun === true;
  const now = opts.now?.() ?? new Date();
  const { found, skipped } = await findLegacyRecords(channelsDir);
  const result: LegacyMigrationResult = { found, moved: [], skipped, backup: null, archive, dryRun };
  if (!found.length || dryRun) return result;

  // ١. النسخة الاحتياطية قبل أي تغيير، وكل نسخة تطابق أصلها.
  const backup = await freshDir(path.resolve(opts.backupRoot ?? legacyBackupRoot()), `legacy-migration-${stampOf(now)}`);
  for (const f of found) {
    const to = path.join(backup, f.channel, "episodes", f.episode, f.name);
    await mkdir(path.dirname(to), { recursive: true });
    await copyFile(f.file, to, constants.COPYFILE_EXCL);
    if (await sha256(to) !== f.sha256)
      throw new Error(`تغيّر ${f.channel}/${f.episode}/${f.name} أثناء نسخه احتياطيًا؛ لم يُنقل شيء.`);
  }
  await writeFile(path.join(backup, "manifest.json"), JSON.stringify({
    kind: "legacy-migration", at: now.toISOString(), note: "سجلات قديمة لا تمنح اعتمادًا ولا تمنعه؛ نسخة قبل نقلها إلى الأرشيف.",
    files: found.map(({ file: _file, ...f }) => ({ ...f, label: legacyRecordOf(f.name)!.label })),
  }, null, 2) + "\n", { flag: "wx" });
  result.backup = backup;

  // ٢. الأرشيف: نقل لا حذف.
  for (const f of found) {
    const dir = path.join(archive, f.channel, f.episode);
    await mkdir(dir, { recursive: true });
    let to = path.join(dir, f.name);
    let duplicate = false;
    for (const candidate of [to, path.join(dir, `${f.name}.${f.sha256.slice(0, 12)}`)]) {
      to = candidate;
      const there = await lstat(candidate).catch(() => null);
      if (!there) break;
      if (there.isFile() && await sha256(candidate) === f.sha256) { duplicate = true; break; }
    }
    if (duplicate) await rm(f.file);
    else {
      if (await lstat(to).catch(() => null)) throw new Error(`في الأرشيف ملفان مختلفان باسم ${f.name}؛ لم يُنقل ${f.channel}/${f.episode}/${f.name}.`);
      await moveFile(f.file, to, f.sha256);
    }
    result.moved.push({ ...f, archivedTo: to, duplicate });
  }

  // ٣. سجل التشغيل في الأرشيف.
  const logFile = path.join(archive, "migration-log.json");
  let log: { runs: unknown[] } = { runs: [] };
  try { log = JSON.parse(await readFile(logFile, "utf8")); if (!Array.isArray(log.runs)) log = { runs: [] }; } catch { /* أول تشغيل */ }
  log.runs.push({ at: now.toISOString(), backup, moved: result.moved.map((m) => ({
    channel: m.channel, episode: m.episode, name: m.name, sha256: m.sha256, archivedTo: path.relative(archive, m.archivedTo), duplicate: m.duplicate,
  })), skipped });
  const tmp = `${logFile}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(log, null, 2) + "\n");
  await rename(tmp, logFile);
  return result;
};

/** سطر للمالك أو لسجل الاستوديو (بلا مسارات تقنية حين لا شيء). */
export const legacyMigrationSummary = (r: LegacyMigrationResult): string => {
  const tracked = r.skipped.filter((s) => s.reason === "tracked").length;
  const odd = r.skipped.length - tracked;
  const rest = [tracked ? `${tracked} متتبَّع في Git تُرك مكانه` : "", odd ? `${odd} ليس ملفًا عاديًا تُرك مكانه` : ""].filter(Boolean).join("، ");
  if (!r.found.length) return `لا سجلات قديمة للترحيل.${rest ? ` (${rest})` : ""}`;
  if (r.dryRun) return `سجلات قديمة للترحيل: ${r.found.length} (${r.found.map((f) => `${f.channel}/${f.episode}/${f.name}`).join("، ")}). تجربة فقط: لم يُغيَّر شيء.`;
  return `نُقلت ${r.moved.length} من السجلات القديمة إلى الأرشيف المحلي (${r.archive})، ونسختها الاحتياطية في ${r.backup}. لم يُعتمد بها شيء ولم يُلغَ شيء.${rest ? ` (${rest})` : ""}`;
};
