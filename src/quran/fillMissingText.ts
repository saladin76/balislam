/** Read-only script verse inventory. A missing ayah must be authored in script.md. */
import { readFile } from "node:fs/promises";
import { parseScript } from "../script/parse";
import { resolveScriptPath } from "../script/episodes";
import { quranFromScript } from "./scriptText";
import type { QuranClient } from "./client";

export type TextOnlyResult = {
  fetched: string[];
  existing: string[];
  failed: { ref: string; reason: string }[];
};

export const inspectMissingQuranTexts = async (episode: string): Promise<{
  missing: string[]; existing: string[]; invalid: { ref: string; reason: string }[];
}> => {
  const scriptPath = await resolveScriptPath(episode);
  const authored = quranFromScript(parseScript(await readFile(scriptPath, "utf8"), scriptPath));
  return {
    missing: [...new Set(authored.problems.filter((p) => p.code === "missing-text").map((p) => p.key))],
    existing: Object.keys(authored.texts),
    invalid: authored.problems.filter((p) => p.code !== "missing-text").map((p) => ({ ref: p.ref, reason: p.reason })),
  };
};

/** Retained for callers of the historical API: it no longer downloads or writes any verse. */
export const fillMissingQuranTexts = async (
  episode: string, _client?: Pick<QuranClient, "verse">,
): Promise<TextOnlyResult> => {
  const status = await inspectMissingQuranTexts(episode);
  return { fetched: [], existing: status.existing,
    failed: [...status.missing.map((ref) => ({ ref, reason: "اكتب نص الآية داخل [آية: المرجع | النص] في السكريبت وراجعه شرعيًا." })), ...status.invalid] };
};
