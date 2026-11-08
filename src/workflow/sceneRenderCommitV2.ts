/**
 * Independent, signed record of the exact FINAL Render generation.
 * A previously signed manifest is NOT evidence that the MP4 belongs to the
 * current explicit "begin" event. Only the trusted render bridge creates it.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";
import { workflowKeyId, workflowSigningKey } from "./trust.ts";
import { sceneV2FileFor } from "./sceneStoreV2.ts";
import { readSceneLedgerV2 } from "./sceneStoreV2.ts";
import type { WorkflowIdentity } from "./store.ts";

type Receipt = {
  version: 1; channel: string; episode: string; sceneId: string;
  jobId: string; productionEventSeq: number; fingerprint: string;
  videoSha256: string; videoEpoch: string;
  integrity: { keyId: string; mac: string };
};
const hex = /^[a-f0-9]{64}$/;
const id = /^c[1-9]\d*-[sv]\d+$/;
const sign = (base: Omit<Receipt, "integrity">) =>
  createHmac("sha256", workflowSigningKey()).update(JSON.stringify(base)).digest("hex");

const dest = async (scope: WorkflowIdentity, sceneId: string) => {
  if (!id.test(sceneId)) throw Error("Invalid render production receipt scene.");
  const dir = path.join(path.dirname(await sceneV2FileFor(scope)), ".studio-v2-production-receipts");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const st = await lstat(dir);
  if (!st.isDirectory() || st.isSymbolicLink() || await realpath(dir) !== dir)
    throw Error("Unsafe render receipt directory.");
  return path.join(dir, sceneId + ".json");
};
const currentBegin = async (scope: WorkflowIdentity, sceneId: string,
  order: readonly string[]) => {
  const state = await readSceneLedgerV2(scope, order);
  if (state.scenes[sceneId]?.status !== "producing")
    throw Error("No current owner-authorized scene production in progress.");
  const latest = [...state.events].reverse().find((e) => e.sceneId === sceneId && e.action === "producing");
  if (!latest) throw Error("Missing current signed scene production generation.");
  return latest.seq;
};

/** Trusted Render bridge only. Caller already holds the episode artifact mutex. */
export const commitCurrentSceneRenderLockedV2 = async (scope: WorkflowIdentity,
  sceneId: string, order: readonly string[],
  jobId: string, fingerprint: string, videoSha256: string, videoEpoch: string) => {
  if (!/^[a-f0-9-]{36}$/.test(jobId) ||
      ![fingerprint, videoSha256, videoEpoch].every((x) => hex.test(x)))
    throw Error("Invalid current video render identity.");
  const productionEventSeq = await currentBegin(scope, sceneId, order);
  const base = { version: 1 as const, channel: scope.channel, episode: scope.episode,
    sceneId, jobId, productionEventSeq, fingerprint, videoSha256, videoEpoch };
  const doc: Receipt = { ...base, integrity: { keyId: workflowKeyId(), mac: sign(base) } };
  const file = await dest(scope, sceneId);
  const tmp = file + "." + randomUUID() + ".tmp";
  const handle = await open(tmp, "wx", 0o600);
  try {
    try { await handle.writeFile(JSON.stringify(doc) + "\n"); await handle.sync(); }
    finally { await handle.close(); }
    await rename(tmp, file);
    const directory = await open(path.dirname(file), "r");
    try { await directory.sync(); } finally { await directory.close(); }
  } finally { await rm(tmp, { force: true }); }
};

/** Called inside the same mutex on the actual submit path, never by browser. */
export const requireCurrentSceneRenderLockedV2 = async (scope: WorkflowIdentity,
  sceneId: string, order: readonly string[], expected: {
    jobId: string; fingerprint: string; videoSha256: string; videoEpoch: string;
  }) => {
  const h = await open(await dest(scope, sceneId), constants.O_RDONLY | constants.O_NOFOLLOW);
  let doc: Receipt;
  try {
    const stat = await h.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 4096)
      throw Error("Unsafe final render receipt.");
    doc = JSON.parse(await h.readFile("utf8")) as Receipt;
  } finally { await h.close(); }
  if (!doc || doc.version !== 1 || doc.channel !== scope.channel ||
      doc.episode !== scope.episode || doc.sceneId !== sceneId ||
      doc.jobId !== expected.jobId || doc.fingerprint !== expected.fingerprint ||
      doc.videoSha256 !== expected.videoSha256 || doc.videoEpoch !== expected.videoEpoch ||
      doc.integrity?.keyId !== workflowKeyId() || !hex.test(doc.integrity.mac))
    throw Error("Missing, stale, or foreign current render receipt.");
  const { integrity: _unused, ...base } = doc;
  if (!timingSafeEqual(Buffer.from(doc.integrity.mac, "hex"), Buffer.from(sign(base), "hex")))
    throw Error("Forged signed render receipt.");
  if (doc.productionEventSeq !== await currentBegin(scope, sceneId, order))
    throw Error("Render receipt belongs to an older owner begin generation.");
};
