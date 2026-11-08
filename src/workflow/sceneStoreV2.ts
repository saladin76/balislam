/**
 * Studio V2 durable scene ledger — distinct from the historical v3 workflow.
 *
 * No legacy approvals are imported or converted. All entrypoints here are
 * SERVER-ONLY. They require a secret signing key and a trusted episode scope.
 * The API must not forward user supplied scene inputs, actors or verifier data.
 */
import path from "node:path";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readFile, realpath, rename, rm } from "node:fs/promises";
import { workflowSigningKey, workflowKeyId } from "./trust.ts";
import {
  createSceneLedger, isSceneApproved, sceneFingerprint,
  type SceneLedgerV2, type SceneStatus,
} from "./sceneV2.ts";

export type SceneV2Scope = { channelsRoot: string; channel: string; episode: string };
const FILE = "scene-workflow.v2.json";
const STATUSES: readonly SceneStatus[] = [
  "draft", "prepared", "producing", "in_review",
  "changes_requested", "approved", "needs_reapproval",
];

export const sceneV2FileFor = async (scope: SceneV2Scope): Promise<string> => {
  // The server, not the HTTP caller, must supply channelsRoot.
  createSceneLedger(scope.channel, scope.episode, ["c1-s1"]);
  const root = await realpath(scope.channelsRoot);
  const channel = path.join(root, scope.channel);
  const episodes = path.join(channel, "episodes");
  const directory = path.join(episodes, scope.episode);
  for (const dir of [channel, episodes, directory]) {
    const stat = await lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(dir) !== dir)
      throw Error("V2 scene ledger path redirects outside the owning episode.");
  }
  if (path.dirname(directory) !== episodes) throw Error("Invalid episode directory.");
  return path.join(directory, FILE);
};

const payload = (doc: SceneLedgerV2): string => {
  const { integrity: _integrity, ...rest } = doc;
  return JSON.stringify(rest);
};
const signature = (doc: SceneLedgerV2) =>
  createHmac("sha256", workflowSigningKey()).update(payload(doc)).digest("hex");

const sealed = (doc: SceneLedgerV2): SceneLedgerV2 => ({
  ...doc,
  integrity: { alg: "HMAC-SHA256", keyId: workflowKeyId(), mac: signature(doc) },
});

const checkIntegrity = (doc: SceneLedgerV2): boolean => {
  const seal = doc.integrity;
  if (seal?.alg !== "HMAC-SHA256" || !/^[a-f0-9]{16}$/.test(seal.keyId) ||
      !/^[a-f0-9]{64}$/.test(seal.mac) || seal.keyId !== workflowKeyId()) return false;
  return timingSafeEqual(Buffer.from(seal.mac, "hex"), Buffer.from(signature(doc), "hex"));
};

const validLedger = (data: unknown, scope: SceneV2Scope, order: readonly string[],
  requireSeal: boolean): data is SceneLedgerV2 => {
  if (!data || typeof data !== "object") return false;
  const doc = data as SceneLedgerV2;
  if (doc.schemaVersion !== 1 || doc.channel !== scope.channel ||
      doc.episode !== scope.episode || !Number.isSafeInteger(doc.revision) ||
      doc.revision < 0 || !Array.isArray(doc.order) ||
      JSON.stringify(doc.order) !== JSON.stringify(order) ||
      !doc.scenes || typeof doc.scenes !== "object" || Array.isArray(doc.scenes) ||
      Object.keys(doc.scenes).length !== doc.order.length ||
      !Array.isArray(doc.events) || doc.events.length > doc.revision ||
      doc.events.some((e, index) => !e || e.seq !== index + 1 ||
        !doc.order.includes(e.sceneId) ||
        !["prepared", "producing", "submitted", "approved", "changes_requested", "invalidated", "noted"].includes(e.action))) return false;
  for (const id of order) {
    const entry = doc.scenes[id];
    if (!entry || entry.id !== id || !STATUSES.includes(entry.status) ||
        !Array.isArray(entry.notes) ||
        entry.notes.some((note) => !note || !Number.isSafeInteger(note.seq) ||
          note.seq < 1 || note.seq > doc.events.length)) return false;
    if (entry.inputs) {
      try { sceneFingerprint(id, entry.inputs); } catch { return false; }
    }
    if (entry.status === "approved" && !isSceneApproved(doc, id)) return false;
  }
  return !requireSeal || checkIntegrity(doc);
};

const read = async (file: string, scope: SceneV2Scope,
  order: readonly string[]): Promise<SceneLedgerV2> => {
  workflowSigningKey(); // no key, no read/approval; fail closed
  let handle;
  try {
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT")
      return createSceneLedger(scope.channel, scope.episode, order);
    throw err;
  }
  let doc: unknown;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1)
      throw Error("V2 scene ledger must be a regular, unlinked file.");
    doc = JSON.parse(await handle.readFile("utf8"));
  } finally {
    await handle.close();
  }
  if (!validLedger(doc, scope, order, true))
    throw Error("Corrupted, forged, or out-of-date V2 scene ledger; explicit recovery required.");
  return doc;
};

const save = async (file: string, doc: SceneLedgerV2) => {
  const data = JSON.stringify(sealed(doc), null, 2) + "\n";
  const tmp = file + "." + process.pid + "." + randomUUID() + ".tmp";
  const handle = await open(tmp, "wx", 0o600);
  try {
    try {
      await handle.writeFile(data, "utf8");
      await handle.sync();
    } finally { await handle.close(); }
    await rename(tmp, file);
    const directory = await open(path.dirname(file), "r");
    try { await directory.sync(); } finally { await directory.close(); }
  } finally { await rm(tmp, { force: true }); }
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const lock = async <T>(file: string, operation: () => Promise<T>): Promise<T> => {
  const lockFile = file + ".lock";
  const marker = randomUUID();
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  for (let i = 0; i < 100; i++) {
    try { handle = await open(lockFile, "wx", 0o600); break; }
    catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      if (i === 99) throw Error("Scene ledger is busy; never delete someone else's lock.");
      await sleep(15);
    }
  }
  if (!handle) throw Error("Unable to lock scene ledger.");
  try {
    await handle.writeFile(marker);
    await handle.sync();
    return await operation();
  } finally {
    await handle.close();
    if (await readFile(lockFile, "utf8").catch(() => "") === marker)
      await rm(lockFile, { force: true });
  }
};

/**
 * Mutations are serialized per episode, signed and saved atomically. The
 * callback runs on trusted server code and must be synchronous; never await
 * external, untrusted evidence verification while holding this ledger lock.
 *
 * A failed mutation is not written. Reconcile changed AV artifacts in a
 * separate mutation BEFORE attempting a dependent final-production action.
 */
export const mutateSceneLedgerV2 = async <T>(
  scope: SceneV2Scope,
  order: readonly string[],
  mutate: (doc: SceneLedgerV2) => T,
): Promise<T> => {
  createSceneLedger(scope.channel, scope.episode, order); // validate before any I/O
  const file = await sceneV2FileFor(scope);
  return lock(file, async () => {
    const doc = await read(file, scope, order);
    const before = payload(doc);
    const result = mutate(doc);
    if (result instanceof Promise) throw Error("Async mutations are forbidden within the scene ledger lock.");
    if (!validLedger(doc, scope, order, false))
      throw Error("Scene mutation produced an invalid ledger.");
    if (payload(doc) !== before) await save(file, doc);
    return structuredClone(result);
  });
};

export const readSceneLedgerV2 = async (
  scope: SceneV2Scope, order: readonly string[],
): Promise<SceneLedgerV2> => {
  createSceneLedger(scope.channel, scope.episode, order);
  const file = await sceneV2FileFor(scope);
  return lock(file, async () => structuredClone(await read(file, scope, order)));
};
