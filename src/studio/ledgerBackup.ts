/**
 * D244 البند ٥ (قرار المالك ٢٨ نوفمبر): نسخة احتياطية تلقائية للسجل الموقّع (`scene-production.v1.json`) لكل الحلقات في
 * القنوات كلها: كل يوم، وقبل أي تنظيف (D240) أو دمج (تحديث الاستوديو)، على المجلد المشترك في الويندوز
 * (`F:\bal-share\backups\ledger\`، `/Volumes/bal-share/backups/ledger/` على الماك)، وتبقى آخر ٣٠ نسخة.
 * كل نسخة مجلد `<الوقت>-<السبب>/<القناة>/<الحلقة>/scene-production.v1.json`، ويُقارن كل ملف بايتًا ببايت بعد نسخه.
 * السجل لا يُرفع إلى Git أبدًا (قرار المالك)، فهذه نسخته الوحيدة خارج الماك.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";

export const LEDGER_FILE = "scene-production.v1.json";
export const LEDGER_BACKUP_KEEP = 30;
export const LEDGER_BACKUP_DAY_MS = 24 * 60 * 60 * 1000;
export const ledgerBackupDir = (share: string) => path.join(share, "backups", "ledger");
export type LedgerBackupReason = "daily" | "cleanup" | "update" | "manual";

/** كل سجلات الحلقات تحت channels/<قناة>/episodes/<حلقة>/ */
export const findLedgers = async (projectRoot: string): Promise<{ channel: string; episode: string; file: string }[]> => {
  const out: { channel: string; episode: string; file: string }[] = [];
  const chDir = path.join(projectRoot, "channels");
  for (const channel of (await readdir(chDir).catch(() => [])).sort()) {
    const epDir = path.join(chDir, channel, "episodes");
    for (const episode of (await readdir(epDir).catch(() => [])).sort()) {
      const file = path.join(epDir, episode, LEDGER_FILE);
      if (existsSync(file)) out.push({ channel, episode, file });
    }
  }
  return out;
};

const stamp = (now: Date) => now.toISOString().replace(/[:.]/g, "-");

/** ينسخ السجلات كلها ويتحقق منها، ثم يُبقي أحدث LEDGER_BACKUP_KEEP نسخة. يرمي إن لم يكن المجلد المشترك مركّبًا. */
export const backupLedgers = async (projectRoot: string, share: string, reason: LedgerBackupReason, now = new Date()) => {
  if (!share || !existsSync(share)) throw new Error(`المجلد المشترك غير مركّب (${share}); لا نسخة احتياطية للسجل.`);
  const root = ledgerBackupDir(share);
  const dir = path.join(root, `${stamp(now)}-${reason}`);
  const ledgers = await findLedgers(projectRoot);
  for (const l of ledgers) {
    const dst = path.join(dir, l.channel, l.episode, LEDGER_FILE);
    await mkdir(path.dirname(dst), { recursive: true });
    await copyFile(l.file, dst);
    if (!(await readFile(l.file)).equals(await readFile(dst))) throw new Error(`تعذّر نسخ سجل ${l.channel}/${l.episode} احتياطيًا.`);
  }
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify({ createdAt: now.toISOString(), reason, count: ledgers.length,
    ledgers: ledgers.map((l) => `${l.channel}/${l.episode}`) }, null, 2) + "\n");
  const pruned = await pruneLedgerBackups(root);
  return { dir, count: ledgers.length, pruned };
};

/** يُبقي أحدث LEDGER_BACKUP_KEEP مجلدًا (بالاسم الزمني) ويحذف الأقدم منها وحدها */
export const pruneLedgerBackups = async (root: string, keep = LEDGER_BACKUP_KEEP): Promise<string[]> => {
  const names = (await readdir(root).catch(() => [])).filter((n) => /^\d{4}-\d\d-\d\dT[\d-]+Z-[a-z]+$/.test(n)).sort();
  const old = names.slice(0, Math.max(0, names.length - keep));
  for (const n of old) await rm(path.join(root, n), { recursive: true, force: true });
  return old;
};

/** آخر نسخة (أي سبب) — للنسخة اليومية */
export const lastLedgerBackupAt = async (share: string): Promise<number | null> => {
  const names = (await readdir(ledgerBackupDir(share)).catch(() => [])).filter((n) => /Z-[a-z]+$/.test(n)).sort();
  if (!names.length) return null;
  return (await stat(path.join(ledgerBackupDir(share), names.at(-1)!))).mtimeMs;
};

/** النسخة اليومية: إن مضى يوم على آخر نسخة (أو لا نسخة) والمجلد مركّب. لا يرمي (يُعاد غدًا أو بعد التركيب). */
export const dailyLedgerBackup = async (projectRoot: string, share: string, now = new Date()): Promise<string | null> => {
  if (!existsSync(share)) return null;
  const last = await lastLedgerBackupAt(share);
  if (last !== null && now.getTime() - last < LEDGER_BACKUP_DAY_MS) return null;
  try { return (await backupLedgers(projectRoot, share, "daily", now)).dir; } catch { return null; }
};
