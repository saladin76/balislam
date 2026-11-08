/**
 * Studio V2 script/Storyboard signoffs. Separate from historical v3 records.
 * Decisions are always made under the episode artifact mutex by a server
 * authenticated owner, against real script.md / plan.json file generations.
 *
 * Important: semantic/source/visual QA remains a distinct integration gate.
 * Only human source decisions are represented here, never automatic QA.
 */
import path from "node:path";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { open, rename, rm } from "node:fs/promises";
import { resolveArtifact, sha256FileAndEpoch } from "./artifacts.ts";
import { workflowKeyId, workflowSigningKey } from "./trust.ts";
import { sceneV2FileFor } from "./sceneStoreV2.ts";
import { readPlannedSceneOrderV2 } from "./scenePlanV2.ts";
import type { WorkflowIdentity } from "./store.ts";

export type SceneSourceStageV2 = "script" | "storyboard";
type Approval = {
  ownerId: string; at: string; fingerprint: string; eventSeq: number;
  prerequisiteEventSeq?: number;
};
type Event = { seq: number; stage: SceneSourceStageV2; at: string; ownerId: string; fingerprint: string; note: string };
type SignedSources = {
  schemaVersion: 1; channel: string; episode: string; events: Event[];
  approvals: Partial<Record<SceneSourceStageV2, Approval>>;
  integrity?: { keyId: string; mac: string };
};
const sha = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");
const payload = (x: SignedSources) => {
  const { integrity: _ignored, ...doc } = x;
  return JSON.stringify(doc);
};
const signature = (x: SignedSources) =>
  createHmac("sha256", workflowSigningKey()).update(payload(x)).digest("hex");
const sourceFile = async (scope: WorkflowIdentity) =>
  path.join(path.dirname(await sceneV2FileFor(scope)), "scene-sources.v2.json");
const blank = (scope: WorkflowIdentity): SignedSources =>
  ({ schemaVersion: 1, channel: scope.channel, episode: scope.episode, events: [], approvals: {} });

const read = async (scope: WorkflowIdentity): Promise<SignedSources> => {
  workflowSigningKey();
  const file = await sourceFile(scope);
  let handle: Awaited<ReturnType<typeof open>>;
  try { handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return blank(scope);
    throw e;
  }
  let data: SignedSources;
  try {
    const st = await handle.stat();
    if (!st.isFile() || st.nlink !== 1 || st.size > 250000)
      throw Error("Unsafe V2 source approval ledger.");
    data = JSON.parse(await handle.readFile("utf8")) as SignedSources;
  } finally { await handle.close(); }
  const seal = data?.integrity;
  if (data?.schemaVersion !== 1 || data.channel !== scope.channel ||
      data.episode !== scope.episode || !Array.isArray(data.events) ||
      !data.approvals || seal?.keyId !== workflowKeyId() ||
      !/^[a-f0-9]{64}$/.test(seal.mac) ||
      !data.events.every((e, i) => e.seq === i + 1 &&
        ["script", "storyboard"].includes(e.stage)) ||
      !timingSafeEqual(Buffer.from(seal.mac, "hex"),
        Buffer.from(signature(data), "hex")))
    throw Error("Corrupt or forged V2 source approval ledger.");
  return data;
};
const save = async (scope: WorkflowIdentity, doc: SignedSources): Promise<void> => {
  const file = await sourceFile(scope);
  const sealed = { ...doc, integrity: { keyId: workflowKeyId(), mac: signature(doc) } };
  const tmp = file + "." + randomUUID() + ".tmp";
  const handle = await open(tmp, "wx", 0o600);
  try {
    try { await handle.writeFile(JSON.stringify(sealed, null, 2) + "\n"); await handle.sync(); }
    finally { await handle.close(); }
    await rename(tmp, file);
    const directory = await open(path.dirname(file), "r");
    try { await directory.sync(); } finally { await directory.close(); }
  } finally { await rm(tmp, { force: true }); }
};
const fingerprints = async (scope: WorkflowIdentity) => {
  await readPlannedSceneOrderV2(scope, async (work) => work());
  const script = await sha256FileAndEpoch(await resolveArtifact(scope, "script.md"));
  const plan = await sha256FileAndEpoch(await resolveArtifact(scope, "plan.json"));
  return {
    script: sha(["studio-v2-script-approval", scope.channel, scope.episode, script]),
    storyboard: sha(["studio-v2-storyboard-approval", scope.channel, scope.episode, script, plan]),
  };
};
const current = (doc: SignedSources, stage: SceneSourceStageV2, expected: string): boolean => {
  const approval = doc.approvals[stage];
  if (!approval || approval.fingerprint !== expected ||
      !Number.isSafeInteger(approval.eventSeq) || approval.eventSeq < 1) return false;
  const ev = doc.events[approval.eventSeq - 1];
  if (!ev || ev.seq !== approval.eventSeq || ev.stage !== stage ||
      ev.ownerId !== approval.ownerId || ev.at !== approval.at ||
      ev.fingerprint !== approval.fingerprint) return false;
  if (stage === "storyboard")
    return current(doc, "script", doc.approvals.script?.fingerprint ?? "") &&
      approval.prerequisiteEventSeq === doc.approvals.script?.eventSeq;
  return true;
};

/** Caller already holds the shared artifact lock. */
export const inspectSceneSourcesV2 = async (scope: WorkflowIdentity) => {
  const doc = await read(scope);
  const fp = await fingerprints(scope);
  return {
    script: { fingerprint: fp.script, approved: current(doc, "script", fp.script) },
    storyboard: {
      fingerprint: fp.storyboard,
      approved: current(doc, "script", fp.script) &&
        current(doc, "storyboard", fp.storyboard),
    },
  };
};
/** Separate explicit owner decisions for script and the entire Storyboard. */
export const approveSceneSourcesV2 = async (
  scope: WorkflowIdentity, stage: SceneSourceStageV2, expectedFingerprint: string,
  ownerId: string, note: string,
) => {
  if (!["script", "storyboard"].includes(stage) ||
      typeof expectedFingerprint !== "string" ||
      !/^[a-f0-9]{64}$/.test(expectedFingerprint) ||
      typeof ownerId !== "string" || !/^[\p{L}\p{N}_.@ -]{2,120}$/u.test(ownerId) ||
      typeof note !== "string" || note.trim().length < 10 || note.length > 2000)
    throw Error("Malformed V2 source signoff request.");
  const fp = await fingerprints(scope);
  if (fp[stage] !== expectedFingerprint)
    throw Error("Source changed since owner inspection.");
  const doc = await read(scope);
  if (stage === "storyboard" && !current(doc, "script", fp.script))
    throw Error("Script must be approved before Storyboard.");
  if (current(doc, stage, fp[stage]))
    throw Error("Already approved; stale duplicate decision.");
  const at = new Date().toISOString();
  const eventSeq = doc.events.length + 1;
  doc.events.push({ seq: eventSeq, stage, ownerId, at,
    fingerprint: fp[stage], note: note.trim() });
  doc.approvals[stage] = { ownerId, at, fingerprint: fp[stage], eventSeq,
    ...(stage === "storyboard" ? { prerequisiteEventSeq: doc.approvals.script!.eventSeq } : {}) };
  await save(scope, doc);
  return inspectSceneSourcesV2(scope);
};
export const requireApprovedSceneSourcesV2 = async (scope: WorkflowIdentity) => {
  const view = await inspectSceneSourcesV2(scope);
  if (!view.script.approved || !view.storyboard.approved)
    throw Error("V2 Script and Storyboard need current explicit owner approvals.");
};
