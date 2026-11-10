/**
 * M9 (funnel QA, 10 Nov): approving a scene took 2–12 s on a 114-scene episode because every ledger operation
 * re-read and re-hashed every voice clip, recitation and scene preview — twice per decision. The digest of a
 * file is now cached by its identity: device, inode, size, mtime and ctime in nanoseconds. Any write to the
 * file changes its ctime (which no program can set back), a replace changes its inode, so a cached digest is
 * never served for different bytes; the cache only saves reading unchanged bytes again. Process-local, bounded.
 */
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";

const MAX = 4096;
const cache = new Map<string, { key: string; sha256: string }>();
const identity = (st: { dev: bigint; ino: bigint; size: bigint; mtimeNs: bigint; ctimeNs: bigint }) =>
  `${st.dev}:${st.ino}:${st.size}:${st.mtimeNs}:${st.ctimeNs}`;

/** sha256 (hex) of the file's bytes, read only when the file's identity changed since the last read. */
export const cachedFileSha256 = async (file: string): Promise<string> => {
  const before = await lstat(file, { bigint: true });
  const key = identity(before);
  const hit = cache.get(file);
  if (hit && hit.key === key) return hit.sha256;
  const bytes = await readFile(file);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  // Changed while reading: never cache a digest that may not match the identity.
  const after = await lstat(file, { bigint: true });
  if (identity(after) === key) {
    if (cache.size >= MAX) cache.delete(cache.keys().next().value!);
    cache.set(file, { key, sha256 });
  }
  return sha256;
};
/** Generic memo by file identity (e.g. a decoded duration); recomputed when the file changes. */
const memo = new Map<string, { key: string; value: unknown }>();
export const cachedByFile = async <T>(file: string, tag: string, compute: () => Promise<T>): Promise<T> => {
  const key = identity(await lstat(file, { bigint: true }));
  const id = `${tag}\0${file}`;
  const hit = memo.get(id);
  if (hit && hit.key === key) return hit.value as T;
  const value = await compute();
  if (identity(await lstat(file, { bigint: true })) === key) {
    if (memo.size >= MAX) memo.delete(memo.keys().next().value!);
    memo.set(id, { key, value });
  }
  return value;
};
export const clearHashCache = () => { cache.clear(); memo.clear(); };
