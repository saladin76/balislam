/**
 * Studio V2 scene-first AV approval policy.
 *
 * This is a pure, fail-closed policy module. The caller MUST authenticate the
 * owner and independently verify evidence on the server using current files.
 * Never invoke these decisions directly with browser-supplied evidence.
 *
 * The old six-stage v3 ledger remains untouched. V2 does not migrate approvals.
 */
import { createHash } from "node:crypto";

export const SCENE_V2_SCHEMA = 1 as const;
export const SCENE_INPUT_KEYS = [
  "original", "vocalized", "tone", "storyboard", "assets",
  "narration", "sync", "video", "rights",
] as const;

export type SceneInputKey = (typeof SCENE_INPUT_KEYS)[number];
export type SceneArtifact = { version: string; sha256: string; epoch: string };
export type SceneInputs = Record<SceneInputKey, SceneArtifact> & {
  /** Shared assets are version-bound only for the scenes that actually use them. */
  shared: Record<string, SceneArtifact>;
};
export type SceneStatus =
  | "draft" | "prepared" | "producing" | "in_review"
  | "changes_requested" | "approved" | "needs_reapproval";
export type SceneNote = {
  seq: number; at: string; text: string; second?: number; elementId?: string;
};
export type SceneApproval = {
  ownerId: string; at: string; fingerprint: string;
  avSha256: string; eventSeq: number;
};
export type SceneEntry = {
  id: string; status: SceneStatus; inputs?: SceneInputs;
  submittedFingerprint?: string; approval?: SceneApproval; notes: SceneNote[];
};
export type SceneEvent = {
  seq: number; sceneId: string;
  action: "prepared" | "producing" | "submitted" | "approved" | "changes_requested" | "invalidated";
  at: string; ownerId?: string; fingerprint?: string;
};
export type SceneLedgerV2 = {
  schemaVersion: typeof SCENE_V2_SCHEMA;
  channel: string; episode: string; order: string[];
  revision: number; scenes: Record<string, SceneEntry>; events: SceneEvent[];
  /** Present only on sealed, persisted ledgers; do not trust client-owned copies. */
  integrity?: { alg: "HMAC-SHA256"; keyId: string; mac: string };
};
export type SceneEvidenceVerifier = (
  evidence: Readonly<{ sceneId: string; fingerprint: string; avSha256: string; ownerId: string }>
) => void;

/** Reject paths, duplicates, missing scenes and foreign channels at the boundary. */
export const createSceneLedger = (channel: string, episode: string, order: readonly string[]): SceneLedgerV2 => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(channel) ||
      !/^[0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(episode) ||
      order.length === 0 || order.length > 1000 ||
      order.some((id) => typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id.length > 80) ||
      new Set(order).size !== order.length) throw Error("Invalid scene scope or locked order.");
  return {
    schemaVersion: SCENE_V2_SCHEMA, channel, episode, order: [...order], revision: 0,
    scenes: Object.fromEntries(order.map((id) => [id, { id, status: "draft", notes: [] }])),
    events: [],
  };
};

function insist(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}

const hash = (input: unknown): string =>
  createHash("sha256").update(JSON.stringify(input)).digest("hex");

const validateArtifact = (artifact: SceneArtifact | undefined): void => {
  insist(artifact && typeof artifact.version === "string" && artifact.version.length > 0 &&
    artifact.version.length <= 200 &&
    /^[a-f0-9]{64}$/.test(artifact.sha256) && /^[a-f0-9]{64}$/.test(artifact.epoch),
    "Missing or invalid scene artifact version/hash/epoch.");
};

const current = (ledger: SceneLedgerV2, sceneId: string): SceneEntry => {
  insist(ledger?.schemaVersion === SCENE_V2_SCHEMA &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(ledger.channel) &&
    Array.isArray(ledger.order) && new Set(ledger.order).size === ledger.order.length &&
    ledger.order.includes(sceneId) && Object.hasOwn(ledger.scenes, sceneId) &&
    ledger.scenes[sceneId]?.id === sceneId, "Unknown or invalid scoped scene.");
  return ledger.scenes[sceneId]!;
};

/** Fingerprints bind the full, composited VIDEO plus narration, timing and rights. */
export const sceneFingerprint = (sceneId: string, inputs: SceneInputs): string => {
  insist(typeof sceneId === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sceneId),
    "Invalid scene id.");
  insist(inputs && typeof inputs === "object" && inputs.shared &&
    typeof inputs.shared === "object" && !Array.isArray(inputs.shared),
    "Missing shared-scene dependency map.");
  const material = SCENE_INPUT_KEYS.map((key) => {
    const artifact = inputs[key];
    validateArtifact(artifact);
    return [key, artifact.version, artifact.sha256, artifact.epoch];
  });
  const shared = Object.keys(inputs.shared).sort().map((name) => {
    insist(/^[a-z0-9][a-z0-9_.:/-]{0,199}$/.test(name) &&
      !name.split("/").some((part) => part === ".." || part === "."),
      "Invalid shared asset identifier.");
    const artifact = inputs.shared[name]!;
    validateArtifact(artifact);
    return [name, artifact.version, artifact.sha256, artifact.epoch];
  });
  return hash(["studio-scene-av-v2", sceneId, material, shared]);
};

const event = (
  ledger: SceneLedgerV2, sceneId: string, action: SceneEvent["action"], at: string,
  ownerId?: string, fingerprint?: string,
): number => {
  insist(Number.isFinite(Date.parse(at)), "Invalid event time.");
  const seq = ledger.events.length + 1;
  ledger.events.push({ seq, sceneId, action, at,
    ...(ownerId ? { ownerId } : {}), ...(fingerprint ? { fingerprint } : {}) });
  ledger.revision++;
  return seq;
};

const validOwner = (id: string): boolean =>
  typeof id === "string" && /^[\p{L}\p{N}_.@ -]{2,120}$/u.test(id.trim());

/** A revoked approval NEVER becomes live merely because old file bytes return. */
export const isSceneApproved = (ledger: SceneLedgerV2, sceneId: string): boolean => {
  let s: SceneEntry;
  try { s = current(ledger, sceneId); } catch { return false; }
  const a = s.approval;
  if (s.status !== "approved" || !s.inputs || !a || !validOwner(a.ownerId) ||
      !Number.isFinite(Date.parse(a.at)) || !s.inputs.video ||
      a.avSha256 !== s.inputs.video.sha256 ||
      !Number.isSafeInteger(a.eventSeq) || !Array.isArray(ledger.events)) return false;
  const ev = ledger.events[a.eventSeq - 1];
  if (!ev || ev.seq !== a.eventSeq || ev.sceneId !== sceneId ||
      ev.action !== "approved" || ev.ownerId !== a.ownerId ||
      ev.at !== a.at || ev.fingerprint !== a.fingerprint) return false;
  try { return a.fingerprint === sceneFingerprint(sceneId, s.inputs); } catch { return false; }
};

/**
 * Apply server-observed current artifact bytes/epochs. Invalidation is local:
 * later scenes retain their own approval, but assembly is blocked until all
 * affected scenes are reapproved.
 */
export const reconcileSceneInputs = (
  ledger: SceneLedgerV2, sceneId: string, latest: SceneInputs, at: string,
): boolean => {
  const s = current(ledger, sceneId);
  const next = sceneFingerprint(sceneId, latest);
  let before: string | undefined;
  try { before = s.inputs ? sceneFingerprint(sceneId, s.inputs) : undefined; } catch { /* old data unsafe */ }
  if (before === next) return false;
  // Never mutate the owner-provided latest snapshot or permit later aliasing.
  s.inputs = structuredClone(latest);
  s.submittedFingerprint = undefined;
  if (s.status === "approved" || s.status === "in_review" || s.status === "needs_reapproval") {
    s.status = "needs_reapproval";
  } else if (s.status !== "producing") {
    // Newly rendered media is expected to arrive DURING scene production.
    // Replacing the snapshot must not reset producing -> draft.
    s.status = "draft";
  }
  event(ledger, sceneId, "invalidated", at, undefined, next);
  return true;
};

/** Final scene production N+1 is blocked until every preceding scene is approved. */
export const assertCanProduceScene = (ledger: SceneLedgerV2, sceneId: string): void => {
  current(ledger, sceneId);
  for (const earlier of ledger.order.slice(0, ledger.order.indexOf(sceneId))) {
    insist(isSceneApproved(ledger, earlier),
      "Final scene production blocked until preceding scene is approved: " + earlier);
  }
};

export const markScenePrepared = (ledger: SceneLedgerV2, sceneId: string, at: string): void => {
  const s = current(ledger, sceneId);
  insist(["draft", "changes_requested", "needs_reapproval"].includes(s.status),
    "Scene cannot be prepared in current state.");
  // Preparing future assets is allowed; this does not grant final-production rights.
  s.status = "prepared";
  event(ledger, sceneId, "prepared", at);
};

/**
 * The trusted adapter MUST check current locked Script + Storyboard approvals
 * under its shared artifact lock. This callback is never provided by clients.
 */
export const beginFinalSceneProduction = (
  ledger: SceneLedgerV2, sceneId: string, at: string,
  verifyLockedSources: (sceneId: string) => void,
): void => {
  assertCanProduceScene(ledger, sceneId);
  insist(typeof verifyLockedSources === "function", "Trusted Script/Storyboard gate is required.");
  const gateResult: unknown = verifyLockedSources(sceneId);
  insist(!(gateResult && typeof gateResult === "object" && "then" in gateResult),
    "Async Script/Storyboard checks must finish in the trusted adapter before scene production.");
  const s = current(ledger, sceneId);
  insist(["draft", "prepared", "changes_requested", "needs_reapproval"].includes(s.status),
    "Scene is already producing, in review, or approved.");
  s.status = "producing";
  event(ledger, sceneId, "producing", at);
};

export const submitSceneAvReview = (ledger: SceneLedgerV2, sceneId: string, at: string): string => {
  const s = current(ledger, sceneId);
  insist(s.status === "producing" && s.inputs, "No composited AV production ready for review.");
  const fingerprint = sceneFingerprint(sceneId, s.inputs);
  s.status = "in_review";
  s.submittedFingerprint = fingerprint;
  event(ledger, sceneId, "submitted", at, undefined, fingerprint);
  return fingerprint;
};

/**
 * verifyEvidence must be a trusted server-side verifier of actual AV media and
 * the owner's completed audiovisual review. Passing "true" from the browser
 * can NEVER authorize a decision. No implicit approval from rendering/tests.
 */
export const approveSceneAv = (
  ledger: SceneLedgerV2, sceneId: string,
  decision: { ownerId: string; expectedFingerprint: string; reviewedAvSha256: string; at: string },
  verifyEvidence: SceneEvidenceVerifier,
): void => {
  const s = current(ledger, sceneId);
  assertCanProduceScene(ledger, sceneId);
  insist(s.status === "in_review" && s.inputs, "Scene must be explicitly submitted for AV review.");
  insist(validOwner(decision.ownerId), "Authenticated owner is required.");
  insist(typeof verifyEvidence === "function", "Trusted scene AV verifier is required.");
  const actual = sceneFingerprint(sceneId, s.inputs);
  insist(s.submittedFingerprint === actual && decision.expectedFingerprint === actual &&
    decision.reviewedAvSha256 === s.inputs.video.sha256,
    "Scene AV changed since it was shown to reviewer.");
  // A thrown error from a trusted verifier cannot leave a new approval.
  const verified: unknown = verifyEvidence({ sceneId, fingerprint: actual,
    avSha256: s.inputs.video.sha256, ownerId: decision.ownerId });
  insist(!(verified && typeof verified === "object" && "then" in verified),
    "Async AV evidence must be verified before signing an approval.");
  const approvalSeq = event(ledger, sceneId, "approved", decision.at, decision.ownerId, actual);
  s.approval = { ownerId: decision.ownerId, at: decision.at,
    fingerprint: actual, avSha256: decision.reviewedAvSha256, eventSeq: approvalSeq };
  s.status = "approved";
  s.submittedFingerprint = undefined;
};

export const requestSceneChanges = (
  ledger: SceneLedgerV2, sceneId: string,
  note: { at: string; text: string; second?: number; elementId?: string },
): void => {
  const s = current(ledger, sceneId);
  insist(["in_review", "approved", "needs_reapproval"].includes(s.status),
    "Only reviewed scenes may request changes.");
  insist(typeof note.text === "string" && note.text.trim().length >= 2 &&
    note.text.length <= 2000 &&
    (note.second === undefined || (Number.isFinite(note.second) && note.second >= 0)) &&
    (note.elementId === undefined || /^[a-zA-Z0-9_-]{1,100}$/.test(note.elementId)),
    "Scene change request needs a valid timestamp/element note.");
  event(ledger, sceneId, "changes_requested", note.at);
  s.notes.push({ seq: ledger.events.length, at: note.at, text: note.text.trim(),
    ...(note.second !== undefined ? { second: note.second } : {}),
    ...(note.elementId ? { elementId: note.elementId } : {}) });
  s.status = "changes_requested";
  s.submittedFingerprint = undefined;
};

/**
 * Bind assembly to the exact current approval events and AV bytes of ALL
 * scenes in locked order. When one scene is revoked, this digest is unavailable.
 */
export const assemblySceneFingerprint = (ledger: SceneLedgerV2): string => {
  insist(ledger.order.length > 0, "No scenes to assemble.");
  const approved = ledger.order.map((id) => {
    insist(isSceneApproved(ledger, id), "Assembly blocked by unapproved scene: " + id);
    const a = ledger.scenes[id]!.approval!;
    return [id, a.eventSeq, a.fingerprint, a.avSha256];
  });
  return hash(["studio-assembly-scenes-v2", ledger.channel, ledger.episode, approved]);
};
