/** Safely fill missing Quran text only. Does not touch plan, script, review ledger or audio. */
import path from "node:path";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { parseScript } from "../script/parse";
import { parseAyahRef } from "../script/quranMeta";
import { resolveScriptPath } from "../script/episodes";
import { quranPathFor, readJson } from "../plan/io";
import { composeVerses } from "./sync";
import type { QuranClient, Verse } from "./client";

export type TextOnlyResult = {
  fetched: string[];
  existing: string[];
  failed: { ref: string; reason: string }[];
};

/** Adds only missing text keys and timestamps, preserving every existing cache value. */
export const fillMissingQuranTexts = async (
  episode: string,
  client: Pick<QuranClient, "verse">,
): Promise<TextOnlyResult> => {
  const scriptPath = await resolveScriptPath(episode);
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const file = quranPathFor(scriptPath);
  const existing = (await readJson<Record<string, string>>(file)) ?? {};
  const additional: Record<string, string> = {};
  const result: TextOnlyResult = { fetched: [], existing: [], failed: [] };
  const refs = parsed.chapters.flatMap((chapter) => chapter.blocks)
    .filter((block) => block.kind === "ayah") as { ref: string }[];

  for (const { ref } of refs) {
    const parsedRef = parseAyahRef(ref);
    if (!parsedRef.ok) { result.failed.push({ ref, reason: parsedRef.reason }); continue; }
    const { key, surah, from, to } = parsedRef.ref;
    if (existing[key]) { result.existing.push(key); continue; }
    if (additional[key]) continue;
    try {
      const verses: Verse[] = [];
      for (let n = from; n <= to; n++) verses.push(await client.verse(`${surah}:${n}`));
      const text = composeVerses(verses);
      if (!text.trim()) throw new Error("لم يرجع نص صالح لهذه الآية.");
      additional[key] = text;
      additional[`${key}#at`] = new Date().toISOString();
      result.fetched.push(key);
    } catch (error) {
      result.failed.push({ ref, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  if (Object.keys(additional).length) {
    // Fail closed rather than overwriting a file changed during network fetches.
    const before = await readFile(file, "utf8").catch((e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return null;
      throw e;
    });
    const latest = before ? JSON.parse(before) as Record<string, string> : {};
    for (const key of Object.keys(existing)) {
      if (latest[key] !== existing[key]) throw new Error("تغير مخزن القرآن أثناء الجلب؛ لم تُحفظ النتيجة.");
    }
    // Do not overwrite a value created while requests were in flight.
    for (const key of result.fetched) if (latest[key]) throw new Error("ظهرت آية جديدة في المخزن أثناء الجلب؛ أعد المحاولة.");
    await mkdir(path.dirname(file), { recursive: true });
    const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
    try {
      await writeFile(temp, JSON.stringify({ ...latest, ...additional }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      await rename(temp, file);
    } finally { await rm(temp, { force: true }); }
  }
  return result;
};
