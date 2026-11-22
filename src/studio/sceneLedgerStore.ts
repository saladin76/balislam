import path from "node:path";
import { cachedFileSha256 } from "../io/hashCache";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readJsonFile } from "../io/atomicJson";
import { withLock } from "../io/processLock";
import { lstat, open, readFile, rename, rm } from "node:fs/promises";
import type { SceneFirstProduction } from "./sceneProduction";
import { workflowSigningKey } from "./signingKey";
import { AFTER_PREPARATION_ACTION, type AfterPreparationChange, type ProductionBlocks } from "./afterPreparation";

/**
 * Scene ledger, file side (work ٨): the signed ledger file next to the script (read, verify, sign, save atomically),
 * its cross-process lock, the scene / assembly / Master file paths, and their digests and inode generations.
 * No decision is taken here; the gates are in sceneGates.ts and sceneDecisions.ts.
 */
export const SCENE_ACTIONS = ["approve-script", "approve-storyboard", "submit-scene",
  "approve-scene", "correct-scene", "assemble", "approve-assembly", "approve-master", "grant-publish"] as const;
export type CommandAction = (typeof SCENE_ACTIONS)[number];
export type SceneOwnerCommand = {
  action: CommandAction;
  expectedSha256: string;
  sceneId?: string;
  note?: string;
  confirmedWatched?: boolean;
  /** approve-assembly: every scene-to-scene seam the owner checked ("c1-s1>c1-s2"). */
  seamsChecked?: string[];
  /**
   * correct-scene («النبرة غير مناسبة»): the tone the owner picked. In an episode with a tone map
   * (دفاتر الزمن) it overrides the map for this scene's parts only, as a new tone-map version
   * (src/voice/toneMapOverride.ts). Elsewhere the tone lives in the plan and this field is ignored.
   */
  tone?: string;
  /**
   * D199 approve-scene only, set by the server (never by a client body): the approval came from «اعتمد المشاهد التي
   * شاهدتها كاملة في المعاينة قبل النهائية», with that pre-final file's sha256 (src/studio/preFinalApprove.ts).
   */
  viaPreFinal?: string;
};
/** D199: how an approval was given, when it was not the single «اعتمد» of the scene's own preview. */
export type ApprovalVia = { kind: "prefinal-watched"; prefinalSha256: string };
/**
 * One ledger event. `by: "owner"` for every owner decision; `by: "system"` only for «تحديث بعد التجهيز»
 * (AFTER_PREPARATION_ACTION, owner decision 11 Nov): a change after «اعتمد التجهيز» carried forward, with what changed.
 * Both are covered by the ledger's HMAC like the rest of the history.
 */
export type AuditEvent = { seq: number; action: CommandAction | typeof AFTER_PREPARATION_ACTION; sceneId?: string;
  at: string; by: "owner" | "system"; resultSha256: string; note: string; change?: AfterPreparationChange; via?: ApprovalVia };
export type SignedSceneLedger = {
  version: 1;
  state: SceneFirstProduction;
  revision: number;
  history: AuditEvent[];
  previewEpochs: Record<string, string>;
  /** A trusted render-to-input binding; old ledgers cannot submit new AV without rerender. */
  previewInputs?: Record<string, {
    sourceSha256: string; videoSha256: string; generation: string;
  }>;
  assemblyEpoch?: string;
  masterEpoch?: string;
  mac: string;
};
export type CurrentInput = {
  scriptPath: string;
  initial: SceneFirstProduction;
  /** Narration and (for a verse card) its reviewed human recitation are both present. */
  ready: Record<string, boolean>;
  /** Narration is present: an AV draft can be rendered (a verse without recitation gets a silent placeholder). */
  voiceReady: Record<string, boolean>;
  /** Verse card whose reviewed human recitation is not attached yet (owner decision: recitations come last). */
  recitationPending: Record<string, boolean>;
  planReady: boolean;
  /** Boards whose current scene differs from the recorded board (changed after the record, or new). */
  boardsChanged: string[];
  /** Board state per scene, and whether each narration still matches its voice clip (to say what changed). */
  boardState: Record<string, "approved" | "changed" | "new">;
  textChanged: Record<string, boolean>;
  /** A board review was recorded at least once (storyboard.json has a note). */
  boardsReviewed: boolean;
  /** Scene-scoped refusals (11 Nov): filled under the lock only while an approval rests on the system carry-forward. */
  blocks: ProductionBlocks;
};
export const sha = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
export const hex64 = (text: unknown): text is string =>
  typeof text === "string" && /^[a-f0-9]{64}$/.test(text);
export const signature = (doc: Omit<SignedSceneLedger, "mac">): string =>
  createHmac("sha256", workflowSigningKey())
    .update(JSON.stringify(["studio-scene-ledger-v1", doc.version, doc.state, doc.revision, doc.history, doc.previewEpochs, doc.assemblyEpoch, doc.masterEpoch,
      ...(doc.previewInputs === undefined ? [] : [doc.previewInputs])]))
    .digest("hex");
export const sign = (doc: Omit<SignedSceneLedger, "mac">): SignedSceneLedger =>
  ({ ...doc, mac: signature(doc) });
// M9: digests come from the identity-keyed cache (src/io/hashCache.ts): unchanged bytes are not read again.
export const byteSha256 = async (file: string): Promise<string> => {
  const st = await lstat(file);
  if (!st.isFile() || st.isSymbolicLink()) return sha(await readFile(file)); // readFile gives the usual error
  return cachedFileSha256(file);
};
export const fileGeneration = async (file: string): Promise<string> => {
  const st = await lstat(file, { bigint: true });
  if (!st.isFile() || st.isSymbolicLink()) throw Error("A Studio source is not a regular file.");
  return sha(JSON.stringify([await cachedFileSha256(file), st.ino.toString(), st.ctimeNs.toString(), st.size.toString()]));
};
export const optionalFileGeneration = async (file: string): Promise<string> => {
  try { return await fileGeneration(file); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw error;
  }
};
export const safeSceneId = (id: string): boolean =>
  /^[a-z0-9][a-z0-9-]{0,70}$/.test(id);
export const stateFileFor = (scriptPath: string) =>
  path.join(path.dirname(scriptPath), "scene-production.v1.json");
export const readLedger = async (file: string, fresh: CurrentInput): Promise<SignedSceneLedger> => {
  let data: SignedSceneLedger;
  try {
    const st = await lstat(file);
    if (!st.isFile() || st.isSymbolicLink()) throw Error("Scene ledger is not a regular file.");
    const parsed = await readJsonFile<SignedSceneLedger>(file); // a parse error is retried once, then an Arabic error
    if (!parsed) throw Object.assign(new Error("missing"), { code: "ENOENT" });
    data = parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return sign({ version: 1, state: fresh.initial, revision: 0, history: [], previewEpochs: {}, previewInputs: {} });
  }
  if (!data || data.version !== 1 || !hex64(data.mac) || !data.state ||
      !Array.isArray(data.history) || !data.previewEpochs || typeof data.previewEpochs !== "object" ||
      !Number.isSafeInteger(data.revision) ||
      data.state.channel !== fresh.initial.channel ||
      data.state.episode !== fresh.initial.episode)
    throw Error("Scene approval ledger is invalid; manual recovery required.");
  const { mac, ...unsigned } = data;
  const expected = signature(unsigned);
  if (!timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(expected, "hex")))
    throw Error("Scene approval ledger signature changed; approvals are blocked.");
  return data;
};
export const saveLedger = async (file: string, doc: SignedSceneLedger): Promise<void> => {
  const temp = file + "." + randomUUID() + ".tmp";
  const fd = await open(temp, "wx", 0o600);
  try {
    try { await fd.writeFile(JSON.stringify(doc, null, 2) + "\n"); await fd.sync(); }
    finally { await fd.close(); }
    await rename(temp, file);
  } finally { await rm(temp, { force: true }); }
};
/** A lock left by a writer process that no longer exists on this machine (Studio crashed or was killed
 * mid-write). Only "<pid> <uuid>" locks of a dead process qualify; a live writer is never touched. */
export const lockOwnerIsDead = (content: string | null, ownPid = process.pid): boolean => {
  const pid = Number(content?.match(/^(\d+) [0-9a-f-]{36}$/)?.[1]);
  if (!Number.isInteger(pid) || pid <= 0 || pid === ownPid) return false;
  try { process.kill(pid, 0); return false; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ESRCH"; }
};
/**
 * How long a decision or read waits for another writer (funnel audit item 9). A ledger operation hashes
 * every scene input (and the Master file) under the lock, which can take seconds on a loaded machine;
 * the old 60×25 ms (1.5 s) made the owner see «busy» for no reason. The wait is bounded by time, with a
 * short backoff, and still never deletes a live writer's lock.
 */
export const LEDGER_LOCK_WAIT_MS = 30_000;
export const serialized = async <T>(file: string, work: () => Promise<T>,
  waitMs = LEDGER_LOCK_WAIT_MS): Promise<T> =>
  // Shared cross-process lock (src/io/processLock.ts): the holder's PID and its OS start time are recorded,
  // so a crashed writer's lock is recovered even if its PID was reused; a live writer's lock is never deleted.
  // Older "<pid> <uuid>" locks are still recognised (lockOwnerIsDead).
  withLock(file + ".lock", { purpose: "scene ledger", waitMs,
    busyMessage: "Scene approval ledger is busy. Never delete another writer lock.",
    legacyStale: (held) => lockOwnerIsDead(held) }, work);
export const optionalSha = async (file: string): Promise<string | null> => {
  try { return await byteSha256(file); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};
export const sceneFile = (scriptPath: string, id: string) => {
  if (!safeSceneId(id)) throw Error("Invalid scene id.");
  return path.join(path.dirname(scriptPath), "previews", `scene-${id}-av.mp4`);
};
export const assemblyFile = (scriptPath: string) =>
  path.join(path.dirname(scriptPath), "previews", "episode.mp4");
export const masterFile = (scriptPath: string) =>
  path.join(path.dirname(scriptPath), "out", "package",
    `${path.basename(path.dirname(scriptPath)).slice(0, 3)}-episode.mp4`);

export const exists = (file: string) => lstat(file).then(() => true, () => false);
