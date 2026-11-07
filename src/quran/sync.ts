/**
 * Local Quran media index and verse display formatting only.
 * There is no download, online reciter catalog, external provider or sync job.
 * Archived index records are read for migration evidence but NEVER authorize
 * a recording without a fresh manual upload/listening/rights review.
 */
import path from "node:path";
import { toEasternDigits } from "../i18n/packs";
import type { Verse } from "./client";

export const meaningKey = (key: string): string => `${key}#meaning`;

export const composeVerses = (verses: Verse[]): string =>
  verses.length === 1
    ? verses[0]!.text
    : verses.map((v) => `${v.text} ۝${toEasternDigits(v.number)}`).join(" ");

/** Compatibility shape for archived index JSON. Production accepts manual only. */
export type RecitationIndex = Record<string, {
  parts: { file: string; duration: number; sha256?: string }[];
  reciter: string;
  provider?: string;
  fetchedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  reviewNote?: string;
  sha256?: string;
  textSha256?: string;
  rightsEvidence?: string;
  originalFile?: string;
  originalName?: string;
  originalSha256?: string;
  recitationId?: number;
  edition?: string;
}>;
export const recitationsDirFor = (scriptPath: string): string =>
  path.join(path.dirname(scriptPath), "recitations");
