/** Shared Quran media paths and composition only.
 * There is deliberately NO Quran Foundation client, network sync or automatic
 * text/audio download in the production pipeline. Text and own recitation
 * arrive from explicit owner submissions; AlQuran Cloud stays preview-only.
 */
import path from "node:path";
import { toEasternDigits } from "../i18n/packs";
import type { Verse } from "./client";
export const meaningKey = (key: string) => `${key}#meaning`;
export const composeVerses = (verses: Verse[]): string =>
  verses.length === 1 ? verses[0]!.text :
    verses.map(v => `${v.text} ۝${toEasternDigits(v.number)}`).join(" ");
export type RecitationIndex = Record<string, {
  parts: { file: string; duration: number }[];
  reciter: string;
  provider: "manual" | "alquran-cloud";
  edition?: string;
  fetchedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  sha256?: string;
  textSha256?: string;
  /** رفض صريح من المراجع: لا يُستعمل التسجيل في أي رندر، ولا يظهر معتمدًا في الواجهة. */
  rejectedAt?: string;
  rejectedBy?: string;
  rejectReason?: string;
}>;
export const recitationsDirFor = (scriptPath: string) =>
  path.join(path.dirname(scriptPath), "recitations");
