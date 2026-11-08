/**
 * Studio V2 durable independent AV viewing-audit log.
 *
 * A review receipt is not a scene approval. Completion is appended only by
 * trusted server code under the shared artifact lock, after actual media
 * coverage and current byte/epoch checks. HMAC detects forged records, but
 * no automated mechanism can prove that a human paid attention to playback.
 */
import path from "node:path";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { open, rename, rm } from "node:fs/promises";
import { workflowKeyId, workflowSigningKey } from "./trust.ts";
import { sceneV2FileFor, type SceneV2Scope } from "./sceneStoreV2.ts";

export type CompletedAvReviewV2 = Readonly<{
  id: string;
  sessionId: string;
  ownerId: string;
  sceneId: string;
  fingerprint: string;
  avSha256: string;
  avEpoch: string;
  videoVersion: string;
  durationSec: number;
  mediaBytes: number;
  playedSec: number;
  startedAt: number;
  completedAt: number;
  checkpoints: number;
}>;

type ReviewEvent = CompletedAvReviewV2 & { seq: number };
type ReviewLedger = {
  schemaVersion: 1;
  channel: string;
  episode: string;
  revision: number;
  reviews: ReviewEvent[];
  integrity?: { alg: "HMAC-SHA256"; keyId: string; mac: string };
};
const hex = /^[a-f0-9]{64}$/;
const idHex = /^[a-f0-9]{48}$/;
const fileFor = async (scope: SceneV2Scope) =>
  path.join(path.dirname(await sceneV2FileFor(scope)), "scene-av-review.v2.json");
const payload = (doc: ReviewLedger) => {
  const { integrity: _seal, ...body } = doc;
  return JSON.stringify(body);
};
const mac = (doc: ReviewLedger) =>
  createHmac("sha256", workflowSigningKey()).update(payload(doc)).digest("hex");
const blank = (scope: SceneV2Scope): ReviewLedger => ({
  schemaVersion: 1, channel: scope.channel, episode: scope.episode,
  revision: 0, reviews: [],
});
const good = (v: ReviewEvent) =>
  v && idHex.test(v.id) && hex.test(v.sessionId) &&
  typeof v.ownerId === "string" && v.ownerId.length >= 2 && v.ownerId.length <= 120 &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.sceneId) &&
  hex.test(v.fingerprint) && hex.test(v.avSha256) && hex.test(v.avEpoch) &&
  typeof v.videoVersion === "string" && v.videoVersion.length > 0 &&
  v.videoVersion.length <= 200 &&
  Number.isFinite(v.durationSec) && v.durationSec > 0 &&
  Number.isSafeInteger(v.mediaBytes) && v.mediaBytes > 0 &&
  Number.isFinite(v.playedSec) && v.playedSec >= v.durationSec - 0.5 &&
  Number.isSafeInteger(v.startedAt) && Number.isSafeInteger(v.completedAt) &&
  v.completedAt >= v.startedAt &&
  v.completedAt - v.startedAt >= v.durationSec * 900 &&
  Number.isSafeInteger(v.checkpoints) && v.checkpoints >= 1;
const read = async (scope: SceneV2Scope): Promise<ReviewLedger> => {
  workflowSigningKey();
  let handle: Awaited<ReturnType<typeof open>>;
  try { handle = await open(await fileFor(scope), constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return blank(scope);
    throw err;
  }
  let doc: ReviewLedger;
  try {
    const st = await handle.stat();
    if (!st.isFile() || st.nlink !== 1 || st.size > 5_000_000)
      throw Error("Studio V2 AV receipt log has invalid inode or size.");
    doc = JSON.parse(await handle.readFile("utf8")) as ReviewLedger;
  } finally { await handle.close(); }
  const seal = doc?.integrity;
  if (doc?.schemaVersion !== 1 || doc.channel !== scope.channel ||
      doc.episode !== scope.episode || !Number.isSafeInteger(doc.revision) ||
      !Array.isArray(doc.reviews) || doc.revision !== doc.reviews.length ||
      doc.reviews.some((event, i) => !good(event) || event.seq !== i + 1) ||
      new Set(doc.reviews.map((entry) => entry.id)).size !== doc.reviews.length ||
      seal?.alg !== "HMAC-SHA256" || seal.keyId !== workflowKeyId() ||
      !hex.test(seal.mac) ||
      !timingSafeEqual(Buffer.from(seal.mac, "hex"), Buffer.from(mac(doc), "hex")))
    throw Error("Corrupt or forged independent V2 AV review evidence.");
  return doc;
};
const save = async (scope: SceneV2Scope, doc: ReviewLedger): Promise<void> => {
  const file = await fileFor(scope);
  const sealed = { ...doc, integrity: {
    alg: "HMAC-SHA256" as const, keyId: workflowKeyId(), mac: mac(doc),
  } };
  const tmp = file + "." + randomUUID() + ".tmp";
  const handle = await open(tmp, "wx", 0o600);
  try {
    try { await handle.writeFile(JSON.stringify(sealed, null, 2) + "\n"); await handle.sync(); }
    finally { await handle.close(); }
    await rename(tmp, file);
    const parent = await open(path.dirname(file), "r");
    try { await parent.sync(); } finally { await parent.close(); }
  } finally { await rm(tmp, { force: true }); }
};
/** Writer MUST already hold withSceneArtifactLockV2. Never exposed via HTTP. */
export const appendCompletedSceneAvReviewV2 = async (
  scope: SceneV2Scope, evidence: CompletedAvReviewV2,
): Promise<void> => {
  if (!good({ ...evidence, seq: 1 })) throw Error("Incomplete independent V2 AV evidence.");
  const ledger = await read(scope);
  if (ledger.reviews.some((r) => r.id === evidence.id))
    throw Error("V2 AV review receipt was already committed.");
  ledger.reviews.push({ ...structuredClone(evidence), seq: ++ledger.revision });
  await save(scope, ledger);
};
/** Reader MUST already hold withSceneArtifactLockV2. */
export const requireCompletedSceneAvReviewV2 = async (
  scope: SceneV2Scope, expected: Readonly<{
    id: string; sessionId: string; ownerId: string; sceneId: string;
    fingerprint: string; avSha256: string; avEpoch: string; videoVersion: string;
  }>,
): Promise<void> => {
  const ledger = await read(scope);
  const found = ledger.reviews.find((x) => x.id === expected.id);
  if (!found || found.ownerId !== expected.ownerId ||
      found.sessionId !== expected.sessionId || found.sceneId !== expected.sceneId ||
      found.fingerprint !== expected.fingerprint ||
      found.avSha256 !== expected.avSha256 || found.avEpoch !== expected.avEpoch ||
      found.videoVersion !== expected.videoVersion)
    throw Error("No current signed independent AV evidence for owner and video version.");
};
