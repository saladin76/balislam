/**
 * Temporary «.part» files for copies into shared folders such as Google Drive for desktop (QA M2, 10 Nov 2026).
 * A crash mid-copy used to leave `.<name>.<uuid>.part` behind forever. The name now records who wrote it:
 * `.<name>.<host-tag>-<pid>-<uuid>.part`. Before copying again, a run removes only its OWN machine's stale
 * parts (same host tag and the writing process no longer exists), and legacy untagged parts older than a day.
 * A part of a live copy, or one written from another machine into the synced folder, is never touched.
 */
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { readdir, rm, stat } from "node:fs/promises";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const hostTag = (host = os.hostname()) => createHash("sha256").update(host).digest("hex").slice(0, 8);

export const partFileFor = (dst: string) =>
  path.join(path.dirname(dst), `.${path.basename(dst)}.${hostTag()}-${process.pid}-${randomUUID()}.part`);

const pidAlive = (pid: number) => {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; }
};

export const LEGACY_PART_MAX_AGE_MS = 24 * 3600_000;

/** Removes stale part files of this machine in `dir`; returns the names removed. */
export const cleanStaleParts = async (dir: string, now = Date.now()): Promise<string[]> => {
  const tagged = new RegExp(`^\\.(.+)\\.([0-9a-f]{8})-(\\d+)-${UUID}\\.part$`);
  const legacy = new RegExp(`^\\.?(.+)\\.${UUID}\\.part$`);
  const removed: string[] = [];
  for (const name of await readdir(dir).catch(() => [] as string[])) {
    const t = name.match(tagged);
    let stale = false;
    if (t) stale = t[2] === hostTag() && Number(t[3]) !== process.pid && !pidAlive(Number(t[3]));
    else if (legacy.test(name)) {
      const st = await stat(path.join(dir, name)).catch(() => null);
      stale = Boolean(st?.isFile() && now - st.mtimeMs > LEGACY_PART_MAX_AGE_MS);
    }
    if (!stale) continue;
    await rm(path.join(dir, name), { force: true });
    removed.push(name);
  }
  return removed;
};
