/**
 * Remove ONLY the scratch child created inside one isolated acceptance run.
 * Evidence (reports and synthetic renders) must survive. Never sweep system
 * /tmp, another run's temp, or a symlink to a different directory.
 */
import path from "node:path";
import { lstat, readdir, realpath, rm } from "node:fs/promises";

export async function cleanupOwnedAcceptanceTemp(evidenceDir, scratchDir) {
  if (path.resolve(scratchDir) !== path.join(path.resolve(evidenceDir), "temp"))
    throw new Error("Unsafe acceptance scratch ownership: not this run's temp child.");

  const [evidenceStat, scratchStat] = await Promise.all([lstat(evidenceDir), lstat(scratchDir)]);
  if (!evidenceStat.isDirectory() || evidenceStat.isSymbolicLink() ||
      !scratchStat.isDirectory() || scratchStat.isSymbolicLink())
    throw new Error("Unsafe acceptance scratch ownership: symlink or unexpected type.");

  const [evidenceReal, scratchReal] = await Promise.all([realpath(evidenceDir), realpath(scratchDir)]);
  if (scratchReal !== path.join(evidenceReal, "temp"))
    throw new Error("Unsafe acceptance scratch ownership: escaped the evidence directory.");

  const before = await readdir(scratchDir);
  await rm(scratchDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });

  let remains = false;
  try { await lstat(scratchDir); remains = true; }
  catch (e) { if (e.code !== "ENOENT") throw e; }
  return { before, after: remains ? await readdir(scratchDir) : [], clean: !remains };
}
