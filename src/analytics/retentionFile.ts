/**
 * Server-only: «Audience retention» from a YouTube Studio export, for the retention reader (retention.ts).
 * Studio exports a .zip of CSVs (or the owner saves the CSV itself); in a zip the file whose header names a video
 * position and a retention column is used. Reads only; writes nothing.
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseRetention, type RetentionPoint } from "./retention";

const run = promisify(execFile);

export const readRetentionExport = async (file: string, duration?: number): Promise<RetentionPoint[]> => {
  if (!/\.zip$/i.test(file)) return parseRetention(await readFile(file, "utf8"), duration);
  const { stdout: list } = await run("unzip", ["-Z1", file]);
  const csvs = list.split("\n").map((l) => l.trim()).filter((l) => /\.(csv|tsv)$/i.test(l));
  const errors: string[] = [];
  for (const name of csvs) {
    const { stdout } = await run("unzip", ["-p", file, name], { maxBuffer: 32 * 1024 * 1024 });
    try { return parseRetention(stdout, duration); } catch (e) { errors.push(`${path.basename(name)}: ${(e as Error).message}`); }
  }
  throw new Error(`لا ملف احتفاظ في ${path.basename(file)}. ${errors.join(" | ") || "لا CSV فيه."}`);
};
