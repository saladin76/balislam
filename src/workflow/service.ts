/**
 * Trusted-server facade for workflow gates. No HTTP request may provide an
 * actor, permissions, filesystem paths, snapshot digests or evidence booleans.
 * This file intentionally creates no production route: the central integration
 * must inject authenticated session identity and independent artifact checkers.
 */
import { chmod, copyFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  WORKFLOW_STAGES, STAGE_EVIDENCE, stageFingerprint,
  type WorkflowAction, type WorkflowActor, type WorkflowSnapshot, type WorkflowStage,
} from "./gates.ts";
import {
  approveWorkflowStage, readWorkflow, rejectWorkflowStage, reopenWorkflowStage,
  requireWorkflowGate, submitWorkflowStage, invalidateWorkflowStage, type WorkflowIdentity,
} from "./store.ts";
import { collectActualArtifactDigests, resolveArtifact, sha256File, type ArtifactManifest } from "./artifacts.ts";
import { signServerEvidence, type EvidenceProof } from "./trust.ts";

export type WorkflowClientCommand = {
  action: "submit" | "approve" | "reject" | "reopen";
  stage: WorkflowStage;
  expectedFingerprint: string;
  note: string;
};
export type AuthenticatedWorkflowPrincipal = WorkflowActor & { authenticated: true };
/**
 * All three callbacks must be provided by trusted *server* code, never from
 * parsed JSON. An absence/failure of an authentication or checker blocks.
 */
export type TrustedWorkflowDependencies = {
  scope: WorkflowIdentity;
  authenticate: () => Promise<AuthenticatedWorkflowPrincipal>;
  currentManifest: () => Promise<ArtifactManifest>;
  verifiedEvidence: (stage: WorkflowStage, snapshot: WorkflowSnapshot) => Promise<EvidenceProof[]>;
};

const validateClientCommand = (value: WorkflowClientCommand): WorkflowClientCommand => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid workflow command.");
  const fields = Object.keys(value);
  if (fields.some((k) => !["action", "stage", "expectedFingerprint", "note"].includes(k)))
    throw new Error("Client cannot submit identity, role, evidence, paths or content hashes.");
  if (!["submit", "approve", "reject", "reopen"].includes(value.action) ||
      !WORKFLOW_STAGES.includes(value.stage) || !/^[a-f0-9]{64}$/.test(value.expectedFingerprint) ||
      typeof value.note !== "string" || value.note.length > 4000)
    throw new Error("Malformed workflow command.");
  return value;
};

export const createTrustedWorkflowService = (deps: TrustedWorkflowDependencies) => {
  const capture = async () => {
    const manifest = await deps.currentManifest();
    const snapshot = await collectActualArtifactDigests(deps.scope, manifest);
    return { manifest, snapshot };
  };
  const principal = async () => {
    const actor = await deps.authenticate();
    if (!actor || actor.authenticated !== true || !["owner", "reviewer"].includes(actor.role) ||
        typeof actor.id !== "string" || !actor.id.trim())
      throw new Error("An authenticated Studio session is required.");
    // authenticated comes from the injected session provider, not the request.
    return { id: actor.id, role: actor.role } as WorkflowActor;
  };
  const verifyProofFiles = async (proofs: EvidenceProof[]) => {
    for (const proof of proofs) {
      if (!proof || !/^[a-f0-9]{64}$/.test(proof.sha256) ||
          typeof proof.verifier !== "string" || !proof.verifier.trim())
        throw new Error("Malformed independent evidence.");
      const file = await resolveArtifact(deps.scope, proof.file);
      if (await sha256File(file) !== proof.sha256)
        throw new Error(`Trusted evidence source changed: ${proof.key}`);
    }
  };
  const collectProofs = async (stage: WorkflowStage, snapshot: WorkflowSnapshot) => {
    const proofs = await deps.verifiedEvidence(stage, snapshot);
    if (!Array.isArray(proofs) ||
        STAGE_EVIDENCE[stage].some((key) => proofs.filter((p) => p.key === key).length !== 1))
      throw new Error("Trusted validator did not verify every required stage fact.");
    await verifyProofFiles(proofs);
    return proofs;
  };
  const inspect = async () => {
    await principal();
    const { snapshot } = await capture();
    const ledger = await readWorkflow(deps.scope, snapshot);
    // Inspection itself is an invalidation boundary, not only publishing.
    for (const stage of WORKFLOW_STAGES) {
      const state = ledger.stages[stage];
      if (state.status !== "approved" || !state.approval) continue;
      try { await verifyProofFiles(state.approval.evidenceProofs); }
      catch {
        await invalidateWorkflowStage(deps.scope, snapshot, stage,
          "Approved evidence file changed; explicit review required.");
      }
    }
    return { snapshot, ledger: await readWorkflow(deps.scope, snapshot) };
  };
  const command = async (raw: WorkflowClientCommand) => {
    const input = validateClientCommand(raw);
    const actor = await principal();
    const { snapshot } = await capture();
    if (stageFingerprint(snapshot, input.stage) !== input.expectedFingerprint)
      throw new Error("Workflow review has become stale; refresh current artifacts.");
    const decision = {
      stage: input.stage, actor, snapshot,
      expectedFingerprint: input.expectedFingerprint, note: input.note,
    };
    if (input.action === "submit") return submitWorkflowStage(deps.scope, decision);
    if (input.action === "reject") return rejectWorkflowStage(deps.scope, decision);
    if (input.action === "reopen") return reopenWorkflowStage(deps.scope, decision);
    const proofs = await collectProofs(input.stage, snapshot);
    // If sources changed while the trusted checker was running, do not sign.
    const fresh = await capture();
    if (stageFingerprint(fresh.snapshot, input.stage) !== input.expectedFingerprint)
      throw new Error("Artifact changed while checking evidence.");
    const attestation = signServerEvidence({
      stage: input.stage, fingerprint: input.expectedFingerprint,
      actorId: actor.id, checkedAt: new Date().toISOString(), proofs,
    });
    return approveWorkflowStage(deps.scope, { ...decision, snapshot: fresh.snapshot, attestation });
  };

  const assertEvidenceCurrent = async (snapshot: WorkflowSnapshot, action: WorkflowAction) => {
    const doc = await readWorkflow(deps.scope, snapshot);
    const gateIndex = action === "generate_voice" ? 1 :
      action === "final_motion_render" ? 2 : action === "master_render" ? 4 : 5;
    for (const stage of WORKFLOW_STAGES.slice(0, gateIndex + 1)) {
      const approval = doc.stages[stage].approval;
      if (!approval || doc.stages[stage].status !== "approved") continue;
      try { await verifyProofFiles(approval.evidenceProofs); }
      catch {
        await invalidateWorkflowStage(deps.scope, snapshot, stage, "Approved evidence file changed; explicit review required.");
        throw new Error(`${action} blocked: evidence for ${stage} changed since approval.`);
      }
    }
  };
  const gate = async (action: WorkflowAction) => {
    await principal();
    const before = await capture();
    await requireWorkflowGate(deps.scope, before.snapshot, action);
    await assertEvidenceCurrent(before.snapshot, action);
    const after = await capture();
    if (JSON.stringify(after.snapshot) !== JSON.stringify(before.snapshot))
      throw new Error(`${action} blocked: artifact changed during gate verification.`);
    return before;
  };

  /**
   * The publisher MUST upload the private copy provided to the callback,
   * never the mutable episode file or a client filename. Copy bytes, hash them,
   * compare to the signed Master approval, then check ALL upstream gates.
   */
  const withVerifiedMasterPublication = async <T>(
    publish: (approved: { file: string; sha256: string; snapshot: WorkflowSnapshot }) => Promise<T>,
  ): Promise<T> => {
    await principal();
    const frozen = await mkdtemp(path.join(os.tmpdir(), "studio-approved-master-"));
    try {
      const initial = await capture();
      if (!initial.manifest.master || !initial.snapshot.master) throw new Error("No Master video in current manifest.");
      const actual = await resolveArtifact(deps.scope, initial.manifest.master.file);
      const copy = path.join(frozen, "approved-master.mp4");
      await copyFile(actual, copy);
      await chmod(copy, 0o400);
      const sha256 = await sha256File(copy);
      if (sha256 !== initial.snapshot.master.sha256)
        throw new Error("Master video changed during secure publication snapshot.");
      const checked = await gate("publish");
      if (checked.snapshot.master?.sha256 !== sha256 || checked.snapshot.master.version !== initial.snapshot.master.version)
        throw new Error("Approved Master has changed; publication refused.");
      return await publish({ file: copy, sha256, snapshot: checked.snapshot });
    } finally {
      await rm(frozen, { recursive: true, force: true });
    }
  };
  return { inspect, command, gate, withVerifiedMasterPublication };
};
