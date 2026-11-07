import { open, rename, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

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
