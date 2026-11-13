/**
 * Cross-process lock files with stale detection (QA H4 / M1 / ledger PID reuse, 10 Nov 2026).
 *
 * A lock is a file created with O_EXCL holding JSON: { pid, start, host, token, purpose, at }.
 * `start` is the holder's process start time as the OS reports it (`ps -o lstart=`, second precision),
 * so a lock whose PID was reused by an unrelated process after a crash is recognised as stale.
 * A lock is removed by someone else only when it is provably stale:
 *   - same host, and the PID no longer exists (ESRCH), or
 *   - same host, the PID exists but its start time differs from the recorded one (PID reuse), or
 *   - its content is unreadable/empty and the file is older than `orphanMs` (crash between create and write).
 * A live holder's lock is never deleted. Removal re-reads the file first, so only the inspected lock goes.
 */
import os from "node:os";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

export type LockInfo = { pid: number; start: string | null; host: string; token: string; purpose: string; at: string };

const startCache = new Map<number, string | null>();
/** The OS start time of a process ("Tue Nov 10 09:14:45 2026"), or null if unknown / not running. */
export const processStartTime = (pid: number): string | null => {
  if (pid === process.pid && startCache.has(pid)) return startCache.get(pid)!;
  let out: string | null = null;
  try {
    out = execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8", timeout: 3000,
      env: { ...process.env, LC_ALL: "C", LANG: "C" }, stdio: ["ignore", "pipe", "ignore"] }).trim().replace(/\s+/g, " ") || null;
  } catch { out = null; }
  if (pid === process.pid) startCache.set(pid, out);
  return out;
};

const pidAlive = (pid: number): boolean => {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; }
};

export const parseLock = (content: string | null): LockInfo | null => {
  if (!content) return null;
  try {
    const v = JSON.parse(content) as LockInfo;
    return v && Number.isInteger(v.pid) && v.pid > 0 && typeof v.token === "string" ? v : null;
  } catch { return null; }
};

/** True when the lock content proves its holder is gone (see the module comment). Unknown formats: false. */
export const lockIsStale = (content: string | null, opts: { startOf?: (pid: number) => string | null } = {}): boolean => {
  const info = parseLock(content);
  if (!info) return false;
  if (info.host !== os.hostname()) return false; // another machine (shared folder): never guess
  if (info.pid === process.pid) return false; // a holder in this process (concurrent call): never stale
  if (!pidAlive(info.pid)) return true;
  if (!info.start) return false;
  const now = (opts.startOf ?? processStartTime)(info.pid);
  return now !== null && now !== info.start;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class LockBusyError extends Error {
  readonly code = "LOCK_BUSY";
  readonly status = 409;
  constructor(message: string, readonly holder: LockInfo | null) { super(message); }
}
export const isLockBusyError = (error: unknown): error is LockBusyError =>
  (error as { code?: unknown } | null)?.code === "LOCK_BUSY";

export type AcquireOptions = {
  purpose: string;
  /** How long to wait for a live holder (0 = fail at once). */
  waitMs?: number;
  /** Arabic message for the owner when the lock stays busy. */
  busyMessage: string;
  /** An unreadable lock file older than this is treated as a crashed writer (default 60 s). */
  orphanMs?: number;
  /** Legacy content formats a caller still recognises as stale (e.g. "<pid> <uuid>"). */
  legacyStale?: (content: string) => boolean;
};

/** Acquire `file` as a lock. Returns a release function that removes the lock only if it is still ours. */
export const acquireLock = async (file: string, opts: AcquireOptions): Promise<() => Promise<void>> => {
  const deadline = Date.now() + (opts.waitMs ?? 0);
  const info: LockInfo = { pid: process.pid, start: processStartTime(process.pid), host: os.hostname(),
    token: randomUUID(), purpose: opts.purpose, at: new Date().toISOString() };
  const body = JSON.stringify(info);
  let madeDir = false;
  for (let attempt = 0; ; attempt++) {
    try {
      const fd = await open(file, "wx", 0o600);
      try { await fd.writeFile(body); await fd.sync(); } finally { await fd.close(); }
      break;
    } catch (error) {
      // QA dafatir M3: the lock's folder may not exist yet (voice/ is git-ignored, so a fresh clone or a new
      // episode has none): create it once, then take the lock. Any other error is the caller's.
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && !madeDir) {
        madeDir = true;
        await mkdir(path.dirname(file), { recursive: true });
        continue;
      }
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const held = await readFile(file, "utf8").catch(() => null);
      let stale = held !== null && (lockIsStale(held) || Boolean(opts.legacyStale?.(held)));
      if (!stale && held !== null && !parseLock(held) && !opts.legacyStale?.(held) && !held.trim()) {
        const age = await stat(file).then((s) => Date.now() - s.mtimeMs).catch(() => 0);
        stale = age > (opts.orphanMs ?? 60_000);
      }
      if (stale && await readFile(file, "utf8").catch(() => null) === held) {
        await rm(file, { force: true });
        continue;
      }
      if (Date.now() >= deadline) throw new LockBusyError(opts.busyMessage, parseLock(held));
      await sleep(Math.min(250, 25 * (1 + Math.floor(attempt / 4))));
    }
  }
  return async () => {
    if (await readFile(file, "utf8").catch(() => null) === body) await rm(file, { force: true });
  };
};

export const withLock = async <T>(file: string, opts: AcquireOptions, work: () => Promise<T>): Promise<T> => {
  const release = await acquireLock(file, opts);
  try { return await work(); } finally { await release(); }
};

/** The live holder of a lock file, or null (missing or stale). Used to refuse work while another runs. */
export const liveLockHolder = async (file: string): Promise<LockInfo | null> => {
  const held = await readFile(file, "utf8").catch(() => null);
  if (held === null || lockIsStale(held)) return null;
  return parseLock(held);
};
