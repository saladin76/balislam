import { open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

/**
 * Atomically replace one owned JSON file. The new bytes are fully written and
 * fsynced before the old file is replaced. Never remove a pre-existing target
 * on error; temporary files use per-call unique names in the same directory.
 */
export const writeJsonAtomic = async (file: string, value: unknown): Promise<void> => {
  const contents = JSON.stringify(value, null, 2);
  if (contents === undefined) throw new TypeError("لا يمكن حفظ بيانات غير صالحة.");
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(temp, "wx", 0o600);
    await handle.writeFile(contents + "\n", "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temp, file);
  } finally {
    if (handle) await handle.close();
    await rm(temp, { force: true });
  }
};

/** Strong version of exact on-disk bytes. No wall-clock granularity or mtime race. */
export const jsonRevision = async (file: string): Promise<string> =>
  `"${createHash("sha256").update(await readFile(file)).digest("hex")}"`;

export class StaleJsonRevisionError extends Error {
  readonly status = 409;
  constructor() {
    super("تغيرت البيانات منذ فتحها. حدّث الصفحة وراجع الفروق قبل إعادة الحفظ؛ لم تُستبدل النسخة الأحدث.");
  }
}

/**
 * Serialize competing writers across separate Studio processes. A stale
 * If-Match revision rejects the write rather than clobbering another editor.
 * Legacy clients with no expectedRevision still work, but cannot detect their
 * own stale form; new Studio clients send the ETag automatically.
 *
 * A lock left by abrupt process death is intentionally not removed by another
 * writer. The operator must inspect it; never delete an unknown process lock.
 */
export const writeJsonWithRevision = async (
  file: string, value: unknown, expectedRevision?: string,
): Promise<string> => {
  const lockPath = `${file}.lock`;
  let lock: Awaited<ReturnType<typeof open>>;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new StaleJsonRevisionError();
    throw error;
  }
  try {
    if (expectedRevision && expectedRevision !== await jsonRevision(file))
      throw new StaleJsonRevisionError();
    await writeJsonAtomic(file, value);
    return await jsonRevision(file);
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
};
