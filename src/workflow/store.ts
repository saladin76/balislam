/**
 * Durable, episode-scoped workflow state with atomic writes and a per-episode lock.
 * This module deliberately does not modify render, voice, app, or episode content files.
 */
import path from "node:path";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { lstat, open, readFile, realpath, rename, rm } from "node:fs/promises";
import {
  WORKFLOW_STAGES, appendEvent, assertPrerequisites, assertRequiredEvidence, assertWorkflowGate, stagePrerequisites,
  initialLedger, reconcileWorkflow, stageFingerprint,
  type Evidence, type WorkflowAction, type WorkflowActor, type WorkflowLedger,
  type WorkflowSnapshot, type WorkflowStage,
} from "./gates.ts";

export const STUDIO_CHANNELS = ["balislam", "dafatir-alzaman", "zubdat-alkutub"] as const;
export type StudioChannel = (typeof STUDIO_CHANNELS)[number];
export type WorkflowIdentity = { channelsRoot: string; channel: StudioChannel; episode: string };
export type WorkflowDecision = {
  stage: WorkflowStage;
  actor: WorkflowActor;
  snapshot: WorkflowSnapshot;
  expectedFingerprint: string;
  note: string;
  evidence?: Evidence;
};

const safeIdentity = (scope: WorkflowIdentity): void => {
  if (!STUDIO_CHANNELS.includes(scope.channel)) throw new Error("Unknown channel (fail closed).");
  if (!/^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scope.episode))
    throw new Error("Invalid episode directory name.");
};

/** Resolve a real existing episode; reject symlinked episode directories and traversal. */
export const workflowFileFor = async (scope: WorkflowIdentity): Promise<string> => {
  safeIdentity(scope);
  const base = await realpath(path.join(scope.channelsRoot, scope.channel, "episodes"));
  const candidate = path.join(base, scope.episode);
  if (!(await lstat(candidate)).isDirectory()) throw new Error("Episode must be a real directory.");
  const resolved = await realpath(candidate);
  if (path.dirname(resolved) !== base) throw new Error("Episode escapes channel directory.");
  return path.join(resolved, "workflow-approvals.json");
};

const validActor = (actor: WorkflowActor): void => {
  if (!actor || !/^[\p{L}\p{N}_.@ -]{2,120}$/u.test(actor.id.trim())) throw new Error("A named human approver is required.");
  if (actor.role !== "owner" && actor.role !== "reviewer") throw new Error("Invalid review role.");
};

/** A private 256-bit signing key is mandatory. If missing/weak, fail closed.
 * Tests use an isolated dummy key. Never embed a production key in Git/JSON. */
const integrityKey = (): Buffer => {
  const value = process.env.BAL_WORKFLOW_HMAC_KEY;
  if (!value || value.length < 32) throw new Error("Workflow signing key is not configured (minimum 32 characters).");
  return Buffer.from(value, "utf8");
};
const ledgerPayload = (doc: WorkflowLedger) => {
  const { integrity: _integrity, ...payload } = doc;
  return JSON.stringify(payload);
};
const sign = (doc: WorkflowLedger): NonNullable<WorkflowLedger["integrity"]> => {
  const key = integrityKey();
  return {
    alg: "HMAC-SHA256",
    keyId: createHash("sha256").update(key).digest("hex").slice(0,16),
    mac: createHmac("sha256", key).update(ledgerPayload(doc)).digest("hex"),
  };
};
const verifyLedger = (doc: WorkflowLedger): boolean => {
  const integrity = doc.integrity;
  if (integrity?.alg !== "HMAC-SHA256" || !/^[a-f0-9]{64}$/.test(integrity.mac) ||
      !/^[a-f0-9]{16}$/.test(integrity.keyId)) return false;
  const expected = sign(doc);
  return integrity.keyId === expected.keyId &&
    timingSafeEqual(Buffer.from(integrity.mac, "hex"), Buffer.from(expected.mac, "hex"));
};

const validLedger = (data: unknown, scope: WorkflowIdentity): data is WorkflowLedger => {
  if (!data || typeof data !== "object") return false;
  const doc = data as WorkflowLedger;
  if (doc.schemaVersion !== 1 || doc.channel !== scope.channel || doc.episode !== scope.episode ||
      !Number.isSafeInteger(doc.revision) || doc.revision < 0 || !doc.stages || !Array.isArray(doc.history)) return false;
  if (!WORKFLOW_STAGES.every((s) => {
    const state = doc.stages[s];
    if (!state || !["draft", "in_review", "approved", "rejected", "needs_reapproval"].includes(state.status)) return false;
    if (state.status === "approved" && (!state.approval || !/^[a-f0-9]{64}$/.test(state.approval.fingerprint))) return false;
    if (state.status === "in_review" && (!state.submitted || !/^[a-f0-9]{64}$/.test(state.submitted.fingerprint))) return false;
    return true;
  })) return false;
  return doc.history.every((event, i) => event && event.seq === i + 1 && WORKFLOW_STAGES.includes(event.stage)) &&
    verifyLedger(doc);
};

const load = async (file: string, scope: WorkflowIdentity): Promise<WorkflowLedger> => {
  integrityKey();
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Workflow ledger is not a regular file.");
    const doc: unknown = JSON.parse(await readFile(file, "utf8"));
    if (!validLedger(doc, scope)) throw new Error("Invalid workflow ledger; manual recovery required.");
    return doc;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return initialLedger(scope.channel, scope.episode);
    throw error; // corrupted files must NEVER be interpreted as unapproved-but-blank
  }
};

const persist = async (file: string, doc: WorkflowLedger): Promise<void> => {
  doc.integrity = sign(doc);
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const fd = await open(tmp, "wx", 0o600);
  try {
    try {
      await fd.writeFile(JSON.stringify(doc, null, 2) + "\n", "utf8");
      await fd.sync();
    } finally { await fd.close(); }
    await rename(tmp, file);
    // fsync the containing directory so atomic rename survives a sudden power loss.
    const directory = await open(path.dirname(file), "r");
    try { await directory.sync(); } finally { await directory.close(); }
  } finally { await rm(tmp, { force: true }); }
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Ownership token prevents deleting another request's lock. Never garbage-collect others' locks. */
const withLock = async <T>(file: string, operation: () => Promise<T>): Promise<T> => {
  const lock = `${file}.lock`;
  const token = randomUUID();
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  for (let i = 0; i < 100; i++) {
    try { handle = await open(lock, "wx", 0o600); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (i === 99) throw new Error("Workflow ledger is locked; retry or investigate, never remove another owner's lock.");
      await sleep(15);
    }
  }
  if (!handle) throw new Error("Cannot acquire workflow ledger lock.");
  try {
    await handle.writeFile(token);
    await handle.sync();
    return await operation();
  } finally {
    await handle.close();
    // Do not unlink a lock that another process replaced or took ownership of.
    if (await readFile(lock, "utf8").catch(() => null) === token) await rm(lock, { force: true });
  }
};

const run = async <T>(
  scope: WorkflowIdentity, snapshot: WorkflowSnapshot,
  operation: (doc: WorkflowLedger) => T | Promise<T>,
): Promise<T> => {
  const file = await workflowFileFor(scope);
  return withLock(file, async () => {
    const doc = await load(file, scope);
    // Persist invalidation even when the requested action is blocked/throws.
    if (reconcileWorkflow(doc, snapshot, new Date().toISOString())) {
      doc.revision++;
      await persist(file, doc);
    }
    const reconciled = JSON.stringify(doc);
    const result = await operation(doc);
    // A decision can invalidate downstream approvals even with unchanged bytes.
    // Do this in the same critical section, before returning to any caller.
    reconcileWorkflow(doc, snapshot, new Date().toISOString());
    if (JSON.stringify(doc) !== reconciled) {
      doc.revision++;
      await persist(file, doc);
    }
    return structuredClone(result);
  });
};

const requireExpected = (snapshot: WorkflowSnapshot, stage: WorkflowStage, expected: string): string => {
  const actual = stageFingerprint(snapshot, stage);
  if (actual !== expected) throw new Error("Current artifact has changed since it was presented for review.");
  return actual;
};

/** Read also reconciles changed artifact revisions, recording invalidations durably. */
export const readWorkflow = (scope: WorkflowIdentity, snapshot: WorkflowSnapshot): Promise<WorkflowLedger> =>
  run(scope, snapshot, (doc) => doc);

export const submitWorkflowStage = (scope: WorkflowIdentity, decision: WorkflowDecision): Promise<WorkflowLedger> =>
  run(scope, decision.snapshot, (doc) => {
    validActor(decision.actor);
    const fp = requireExpected(decision.snapshot, decision.stage, decision.expectedFingerprint);
    assertPrerequisites(doc, decision.snapshot, decision.stage);
    const state = doc.stages[decision.stage];
    if (!["draft", "rejected", "needs_reapproval"].includes(state.status)) throw new Error("Stage cannot be resubmitted in its current status.");
    if (!decision.note?.trim()) throw new Error("A review submission note is required.");
    state.status = "in_review";
    state.reason = undefined;
    state.submitted = { by: decision.actor, at: new Date().toISOString(), contentVersion: decision.snapshot[decision.stage]!.version,
      fingerprint: fp, note: decision.note.trim() };
    appendEvent(doc, decision.stage, "submit", decision.actor.id, state.submitted.at, decision.note.trim(), fp, state.submitted.contentVersion);
    return doc;
  });

export const approveWorkflowStage = (scope: WorkflowIdentity, decision: WorkflowDecision): Promise<WorkflowLedger> =>
  run(scope, decision.snapshot, (doc) => {
    validActor(decision.actor);
    if (decision.actor.role !== "owner") throw new Error("Only the project owner can explicitly approve a production stage.");
    const fp = requireExpected(decision.snapshot, decision.stage, decision.expectedFingerprint);
    assertPrerequisites(doc, decision.snapshot, decision.stage);
    const state = doc.stages[decision.stage];
    if (state.status !== "in_review" || state.submitted?.fingerprint !== fp)
      throw new Error("Stage must be submitted for review with the current fingerprint before explicit approval.");
    if (!decision.note || decision.note.trim().length < 15) throw new Error("Explicit approval requires a meaningful human review note.");
    const evidence = assertRequiredEvidence(decision.stage, decision.evidence ?? {});
    state.status = "approved";
    state.reason = undefined;
    state.approval = {
      by: decision.actor, at: new Date().toISOString(), contentVersion: decision.snapshot[decision.stage]!.version,
      artifactSha256: decision.snapshot[decision.stage]!.sha256, fingerprint: fp,
      note: decision.note.trim(), evidence,
      prerequisiteApprovalSeq: stagePrerequisites(decision.stage).map((parent) =>
        doc.stages[parent].approval!.approvalEventSeq),
      approvalEventSeq: doc.history.length + 1,
    };
    appendEvent(doc, decision.stage, "approve", decision.actor.id, state.approval.at, decision.note.trim(), fp, state.approval.contentVersion);
    return doc;
  });

export const rejectWorkflowStage = (scope: WorkflowIdentity, decision: WorkflowDecision): Promise<WorkflowLedger> =>
  run(scope, decision.snapshot, (doc) => {
    validActor(decision.actor);
    const fp = requireExpected(decision.snapshot, decision.stage, decision.expectedFingerprint);
    const state = doc.stages[decision.stage];
    if (state.status !== "in_review" || state.submitted?.fingerprint !== fp)
      throw new Error("Only a current in-review stage can be rejected.");
    if (!decision.note?.trim()) throw new Error("A rejection reason is required.");
    state.status = "rejected";
    state.reason = decision.note.trim();
    appendEvent(doc, decision.stage, "reject", decision.actor.id, new Date().toISOString(), state.reason, fp, decision.snapshot[decision.stage]!.version);
    return doc;
  });

export const reopenWorkflowStage = (scope: WorkflowIdentity, decision: WorkflowDecision): Promise<WorkflowLedger> =>
  run(scope, decision.snapshot, (doc) => {
    validActor(decision.actor);
    const fp = requireExpected(decision.snapshot, decision.stage, decision.expectedFingerprint);
    const state = doc.stages[decision.stage];
    if (!["rejected", "needs_reapproval"].includes(state.status)) throw new Error("Only rejected or invalidated stages can be reopened.");
    state.status = "draft";
    state.submitted = undefined;
    state.reason = undefined;
    appendEvent(doc, decision.stage, "reopen", decision.actor.id, new Date().toISOString(), decision.note, fp, decision.snapshot[decision.stage]!.version);
    return doc;
  });

export const requireWorkflowGate = async (
  scope: WorkflowIdentity, snapshot: WorkflowSnapshot, action: WorkflowAction,
): Promise<void> => { await run(scope, snapshot, (doc) => assertWorkflowGate(doc, snapshot, action)); };
