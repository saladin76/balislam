/**
 * M6 (funnel QA, 10 Nov): the seams the owner heard in the assembled episode, kept on the server (not in page
 * state), per assembly fingerprint: a reload or another tab keeps them, and a new assembly starts over.
 * Local state only (`seam-checks.local.json` beside the script, gitignored), written atomically. It is not an
 * approval: «اعتمد الوصلات» still sends `approve-assembly` with every seam, checked by the signed ledger.
 *
 * A seam counts as heard only when its audio was actually played across the seam window (`played`) or the
 * owner ticked «سمعتها» explicitly (`confirmed`).
 */
import path from "node:path";
import { readJsonFile, writeJsonAtomic } from "../io/atomicJson";
import { withLock } from "../io/processLock";
import { resolveScriptPath } from "../script/episodes";
import { assertSceneOwner, inspectSceneProduction } from "./sceneService";

export type SeamHow = "played" | "confirmed";
export type SeamChecks = { version: 1; assembly: string; heard: Record<string, { how: SeamHow; at: string }> };
export const seamChecksFileFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "seam-checks.local.json");
/** The seam window that must be played for «played»: 3 s before and after the seam (as «استمع للوصلة»). */
export const SEAM_WINDOW_SEC = 6;

const current = async (episode: string) => {
  const read = await inspectSceneProduction(episode);
  return { assembly: read.assembly && !read.assembly.approved ? read.assembly.sha256 : null, seams: read.seams };
};

/** What the owner heard of the CURRENT assembly (empty for another or no assembly). */
export const readSeamChecks = async (episode: string): Promise<{ assembly: string | null; heard: SeamChecks["heard"] }> => {
  const scriptPath = await resolveScriptPath(episode);
  const now = await current(episode);
  const doc = await readJsonFile<SeamChecks>(seamChecksFileFor(scriptPath)).catch(() => null);
  if (!now.assembly || !doc || doc.version !== 1 || doc.assembly !== now.assembly) return { assembly: now.assembly, heard: {} };
  return { assembly: now.assembly, heard: Object.fromEntries(Object.entries(doc.heard ?? {}).filter(([k]) => now.seams.includes(k))) };
};

export const recordSeamCheck = async (episode: string, cmd: { seam: unknown; assemblySha256: unknown; how?: unknown; heard?: unknown; playedSec?: unknown }) => {
  assertSceneOwner();
  const scriptPath = await resolveScriptPath(episode);
  const now = await current(episode);
  if (!now.assembly) throw Error("No assembled episode awaits review.");
  if (cmd.assemblySha256 !== now.assembly) throw Error("The assembled video changed.");
  if (typeof cmd.seam !== "string" || !now.seams.includes(cmd.seam)) throw Error("Unknown seam.");
  const seam = cmd.seam;
  const file = seamChecksFileFor(scriptPath);
  return withLock(file + ".lock", { purpose: "seam checks", waitMs: 5000, busyMessage: "Seam checks are busy." }, async () => {
    const old = await readJsonFile<SeamChecks>(file).catch(() => null);
    const doc: SeamChecks = old && old.version === 1 && old.assembly === now.assembly ? old : { version: 1, assembly: now.assembly!, heard: {} };
    if (cmd.heard === false) delete doc.heard[seam];
    else {
      const how = cmd.how === "played" ? "played" : cmd.how === "confirmed" ? "confirmed" : null;
      if (!how) throw Error("Say how the seam was heard: played, or «سمعتها».");
      if (how === "played" && !(typeof cmd.playedSec === "number" && cmd.playedSec >= SEAM_WINDOW_SEC - 0.5))
        throw Error("Play the whole seam window first (3 s before and after), or tick «سمعتها».");
      doc.heard[seam] = { how, at: new Date().toISOString() };
    }
    await writeJsonAtomic(file, doc);
    return { assembly: doc.assembly, heard: doc.heard };
  });
};
