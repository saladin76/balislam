/**
 * Cross-process, episode-wide artifact mutex. Every conforming script, plan,
 * asset, narration, render, ledger and publishing writer MUST use this lock.
 * It deliberately never steals a stale lock: a crashed owner needs inspected,
 * explicit recovery rather than an unsafe timeout-based unlink.
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { open, readFile, rm } from "node:fs/promises";
import { sceneV2FileFor, type SceneV2Scope } from "./sceneStoreV2.ts";

export class SceneArtifactBusyV2 extends Error {
  constructor() { super("STUDIO_V2_ARTIFACT_BUSY: shared episode writer lock unavailable."); }
}
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const sceneArtifactLockFileV2 = async (scope: SceneV2Scope): Promise<string> =>
  path.join(path.dirname(await sceneV2FileFor(scope)), ".studio-v2-artifacts.lock");

/**
 * Separate ledger lock is acquired INSIDE this mutex, never the reverse.
 * Each server instance/process opens the same exclusive lock on disk.
 */
export const withSceneArtifactLockV2 = async <T>(
  scope: SceneV2Scope, task: () => Promise<T>,
  options: Readonly<{ attempts?: number; delayMs?: number }> = {},
): Promise<T> => {
  const attempts = options.attempts ?? 80;
  const delayMs = options.delayMs ?? 25;
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 1000 ||
      !Number.isSafeInteger(delayMs) || delayMs < 1 || delayMs > 1000)
    throw Error("Invalid scene artifact lock limits.");
  const file = await sceneArtifactLockFileV2(scope);
  const marker = randomUUID();
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  for (let index = 0; index < attempts; index++) {
    try {
      handle = await open(file, "wx", 0o600);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      if (index === attempts - 1) throw new SceneArtifactBusyV2();
      await sleep(delayMs);
    }
  }
  if (!handle) throw new SceneArtifactBusyV2();
  try {
    await handle.writeFile(marker, "utf8");
    await handle.sync();
    return await task();
  } finally {
    await handle.close();
    // Never unlink a lock that another process has already replaced.
    if (await readFile(file, "utf8").catch(() => "") === marker)
      await rm(file, { force: true });
  }
};
