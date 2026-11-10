/**
 * One way to write the Studio's JSON state (QA M3, 10 Nov 2026): write a temporary file next to the target,
 * fsync it, then rename over the target. A crash or a concurrent reader never sees a half-written plan.json,
 * voice/index.json, storyboard.json or review.json. Readers retry once on a parse error (a writer from an
 * older build may still be mid-write) and then fail with a clear Arabic message instead of a raw 500.
 */
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";

export const writeFileAtomic = async (file: string, data: string | Uint8Array, mode = 0o644): Promise<void> => {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  const fd = await open(temp, "wx", mode);
  try {
    try { await fd.writeFile(data); await fd.sync(); }
    finally { await fd.close(); }
    await rename(temp, file);
  } finally { await rm(temp, { force: true }); }
};

export const writeJsonAtomic = (file: string, value: unknown, mode?: number): Promise<void> =>
  writeFileAtomic(file, JSON.stringify(value, null, 2) + "\n", mode);

/** A state file that exists but is not valid JSON even after a retry. `status` lets the server answer 409. */
export class JsonFileError extends Error {
  readonly code = "BAD_JSON_FILE";
  readonly status = 409;
  constructor(readonly file: string) {
    super(`الملف «${path.basename(file)}» في «${path.basename(path.dirname(file))}» غير مكتمل أو تالف (ربما يُكتب الآن). ` +
      "أعد المحاولة بعد لحظات؛ وإن تكرر فاسترجعه من نسخته في Git أو من النسخة الاحتياطية بجواره.");
  }
}
export const isJsonFileError = (error: unknown): error is JsonFileError =>
  (error as { code?: unknown } | null)?.code === "BAD_JSON_FILE";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Reads JSON; null when the file does not exist. A parse error is retried once, then a JsonFileError. */
export const readJsonFile = async <T>(file: string, retryMs = 60): Promise<T | null> => {
  for (let attempt = 0; ; attempt++) {
    let text: string;
    try { text = await readFile(file, "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    try { return JSON.parse(text) as T; }
    catch {
      if (attempt >= 1) throw new JsonFileError(file);
      await sleep(retryMs);
    }
  }
};
