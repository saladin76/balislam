/** Safely fill missing Quran text only. Does not touch plan, script, review ledger or audio. */
import path from "node:path";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { parseScript } from "../script/parse";
import { parseAyahRef } from "../script/quranMeta";
import { resolveScriptPath } from "../script/episodes";
import { quranPathFor } from "../plan/io";
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
  // Capture the complete file BEFORE any network request so edits to ANY key are protected.
  const snapshot = await readFile(file, "utf8").catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
  const existing = snapshot === null ? {} : JSON.parse(snapshot) as Record<string, string>;
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
      for (let n = from; n <= to; n++) {
        const expected = `${surah}:${n}`;
        const verse = await client.verse(expected);
        if (verse.key !== expected || verse.number !== n || !verse.text?.trim())
          throw new Error(`استجابة الآية ${expected} لا تطابق المرجع المطلوب.`);
        verses.push(verse);
      }
      const text = composeVerses(verses);
      if (!text.trim()) throw new Error("لم يرجع نص صالح لهذه الآية.");
      additional[key] = text;
      additional[`${key}#at`] = new Date().toISOString();
      result.fetched.push(key);
    } catch (error) {
      result.failed.push({ ref, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  // All-or-nothing: a failed reference must not leave a misleading partial comparison cache.
  if (result.failed.length) return { fetched: [], existing: result.existing, failed: result.failed };

  if (Object.keys(additional).length) {
    // Never overwrite any edit that occurred while the API requests were in flight.
    const current = await readFile(file, "utf8").catch((e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return null;
      throw e;
    });
    if (current !== snapshot)
      throw new Error("تغير مخزن القرآن أثناء الجلب؛ لم تُحفظ النتيجة، وأُبقيت التعديلات الجديدة.");
    await mkdir(path.dirname(file), { recursive: true });
    const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
    try {
      await writeFile(temp, JSON.stringify({ ...existing, ...additional }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      await rename(temp, file);
    } finally { await rm(temp, { force: true }); }
  }
  return result;
};
