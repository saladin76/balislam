/**
 * Studio V2 production lease: one final render per episode across OS processes.
 * Held for the full Remotion job AND signed manifest verification/registration.
 * Never evict a crashed/foreign lease automatically: operator intervention required.
 */
import { randomUUID } from "node:crypto";
import { lstat, open, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { sceneV2FileFor, type SceneV2Scope } from "./sceneStoreV2.ts";

export const productionLeaseFileV2 = async (scope: SceneV2Scope) =>
  path.join(path.dirname(await sceneV2FileFor(scope)), ".studio-v2-production.lock");

export const withSceneProductionLeaseV2 = async <T>(
  scope: SceneV2Scope, sceneId: string, work: () => Promise<T>,
): Promise<T> => {
  if (!/^c[1-9]\d*-[sv]\d+$/.test(sceneId))
    throw Error("Invalid scene production lease identity.");
  const file = await productionLeaseFileV2(scope);
  const marker = JSON.stringify({ sceneId, nonce: randomUUID() });
  let handle: Awaited<ReturnType<typeof open>>;
  try { handle = await open(file, "wx", 0o600); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST")
      throw Error("STUDIO_V2_PRODUCTION_BUSY");
    throw e;
  }
  const original = await handle.stat();
  try {
    await handle.writeFile(marker, "utf8");
    await handle.sync();
    return await work();
  } finally {
    await handle.close();
    const observed = await lstat(file).catch(() => null);
    if (observed?.isFile() && !observed.isSymbolicLink() &&
        observed.dev === original.dev && observed.ino === original.ino &&
        await readFile(file, "utf8").catch(() => "") === marker)
      await rm(file, { force: true });
  }
};
