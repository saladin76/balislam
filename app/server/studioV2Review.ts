/**
 * Server-owned AV review receipts. Browser progress is a claim, not evidence:
 * require a session-bound media stream, bounded real-time progression, a
 * fresh challenge per checkpoint, and explicit completion. This is an audit
 * trail, not proof of human attention or independent creative QA.
 */
import { randomBytes } from "node:crypto";

type Receipt = {
  id: string; sessionId: string; ownerId: string; scope: string; sceneId: string;
  fingerprint: string; avSha256: string; avEpoch: string; videoVersion: string;
  durationSec: number; mediaBytes: number; startedAt: number; updatedAt: number;
  playedSec: number; checkpoints: number; challenge: string;
  served: Array<[number, number]>; completedAt?: number;
};
const receipts = new Map<string, Receipt>();
const MAX_MS = 2 * 60 * 60 * 1000;
const token = () => randomBytes(24).toString("hex");
const bad = () => Error("V2 AV review receipt is absent, stale or invalid.");
const get = (id: string, sessionId: string) => {
  const entry = receipts.get(id);
  if (!entry || entry.sessionId !== sessionId ||
      Date.now() - entry.startedAt > MAX_MS) throw bad();
  return entry;
};
export const startSceneReviewReceiptV2 = (args: {
  sessionId: string; ownerId: string; scope: string; sceneId: string;
  fingerprint: string; avSha256: string; avEpoch: string; videoVersion: string;
  durationSec: number;
  mediaBytes: number;
}) => {
  if (!Number.isFinite(args.durationSec) || args.durationSec <= 0 ||
      args.durationSec > 8 * 3600 ||
      !Number.isSafeInteger(args.mediaBytes) || args.mediaBytes < 1)
    throw Error("V2 review needs probed, playable AV duration.");
  for (const [key, item] of receipts)
    if (Date.now() - item.startedAt > MAX_MS ||
        item.sessionId === args.sessionId && item.scope === args.scope &&
        item.sceneId === args.sceneId) receipts.delete(key);
  const id = token();
  const entry: Receipt = { ...args, id, startedAt: Date.now(),
    updatedAt: Date.now(), playedSec: 0, checkpoints: 0,
    challenge: token(), served: [] };
  receipts.set(id, entry);
  return { reviewId: id, challenge: entry.challenge,
    durationSec: entry.durationSec, fingerprint: entry.fingerprint };
};
/** Count only byte ranges actually streamed by the backend, not a browser flag. */
export const streamSceneReviewReceiptV2 = (
  id: string, sessionId: string, start: number, endExclusive: number,
) => {
  const entry = get(id, sessionId);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(endExclusive) ||
      start < 0 || start >= endExclusive || endExclusive > entry.mediaBytes)
    throw Error("Invalid served media range.");
  const ranges = [...entry.served, [start, endExclusive] as [number, number]]
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const item of ranges) {
    const last = merged[merged.length - 1];
    if (last && item[0] <= last[1]) last[1] = Math.max(last[1], item[1]);
    else merged.push([item[0], item[1]]);
  }
  // Cannot grow unbounded from adversarial range requests.
  if (merged.length > 4096) throw Error("Too many fragmented AV review ranges.");
  entry.served = merged;
};
export const inspectSceneReviewReceiptV2 = (id: string, sessionId: string) =>
  get(id, sessionId);
export const tickSceneReviewReceiptV2 = (
  id: string, sessionId: string, checkpoint: unknown,
) => {
  const entry = get(id, sessionId);
  const data = checkpoint as Record<string, unknown> | null;
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      Object.keys(data).sort().join(",") !== "challenge,positionSec" ||
      typeof data.challenge !== "string" ||
      data.challenge !== entry.challenge ||
      !Number.isFinite(data.positionSec) ||
      typeof data.positionSec !== "number" ||
      data.positionSec < entry.playedSec ||
      data.positionSec > entry.durationSec + 0.25)
    throw bad();
  const now = Date.now();
  const elapsed = (now - entry.updatedAt) / 1000;
  const lifetime = (now - entry.startedAt) / 1000;
  if (!entry.served.length || elapsed < 0.8 ||
      data.positionSec - entry.playedSec > elapsed * 1.1 + 0.25 ||
      data.positionSec > lifetime * 1.1 + 0.25)
    throw Error("V2 review cannot skip, accelerate or claim unseen AV time.");
  entry.playedSec = data.positionSec;
  entry.updatedAt = now;
  entry.checkpoints++;
  entry.challenge = token();
  return { challenge: entry.challenge, playedSec: entry.playedSec };
};
export const finishSceneReviewReceiptV2 = (
  id: string, sessionId: string, action: unknown,
) => {
  const entry = get(id, sessionId);
  if (!action || typeof action !== "object" || Array.isArray(action) ||
      Object.keys(action).join(",") !== "confirmation" ||
      (action as { confirmation?: unknown }).confirmation !== "reviewed_av")
    throw bad();
  if (entry.served.length !== 1 || entry.served[0]?.[0] !== 0 ||
      entry.served[0]?.[1] !== entry.mediaBytes || entry.checkpoints < 1 ||
      entry.playedSec < entry.durationSec - 0.5 ||
      Date.now() - entry.startedAt < entry.durationSec * 900)
    throw Error("V2 audiovisual review is not complete at normal playback speed.");
  entry.completedAt = Date.now();
  return { completed: true, sceneId: entry.sceneId,
    fingerprint: entry.fingerprint };
};
export const verifySceneReviewReceiptV2 = (
  id: string, sessionId: string, proof: {
    sceneId: string; ownerId: string; fingerprint: string; avSha256: string;
  }, scope: string, avEpoch: string,
) => {
  const e = get(id, sessionId);
  if (!e.completedAt || e.ownerId !== proof.ownerId ||
      e.sceneId !== proof.sceneId || e.scope !== scope ||
      e.fingerprint !== proof.fingerprint ||
      e.avSha256 !== proof.avSha256 || e.avEpoch !== avEpoch ||
      Date.now() - e.completedAt > 15 * 60 * 1000) throw bad();
};
export const revokeSceneReviewReceiptV2 = (id: string) => { receipts.delete(id); };
