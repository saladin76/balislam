/**
 * Signed server attestations; browser clients can never supply an evidence
 * attestation to the public workflow command API. HMAC key lives only in the
 * trusted server environment (no key in repo, browser or ledger).
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { WorkflowStage } from "./gates.ts";

export type EvidenceProof = {
  key: string;
  /** Relative file path in the owning episode or channel image library. */
  file: string;
  sha256: string;
  /** Name of the server-side semantic validator that checked this record. */
  verifier: string;
};
export type WorkflowEvidenceAttestation = {
  stage: WorkflowStage;
  fingerprint: string;
  actorId: string;
  checkedAt: string;
  proofs: EvidenceProof[];
  mac: string;
};
export const workflowSigningKey = (): Buffer => {
  const value = process.env.BAL_WORKFLOW_HMAC_KEY;
  if (!value || Buffer.byteLength(value, "utf8") < 32)
    throw new Error("Workflow signing key is not configured (minimum 32 bytes).");
  return Buffer.from(value, "utf8");
};
export const workflowKeyId = () => createHash("sha256").update(workflowSigningKey()).digest("hex").slice(0, 16);
const payload = (a: Omit<WorkflowEvidenceAttestation, "mac">) =>
  JSON.stringify(["studio-evidence-attestation-v1", a.stage, a.fingerprint, a.actorId, a.checkedAt,
    [...a.proofs].sort((x, y) => x.key.localeCompare(y.key))]);
const signature = (a: Omit<WorkflowEvidenceAttestation, "mac">) =>
  createHmac("sha256", workflowSigningKey()).update(payload(a)).digest("hex");

/** Use ONLY after the trusted validator independently checked every evidence file. */
export const signServerEvidence = (proof: Omit<WorkflowEvidenceAttestation, "mac">): WorkflowEvidenceAttestation =>
  ({ ...proof, mac: signature(proof) });

export const verifyServerEvidence = (a: WorkflowEvidenceAttestation | undefined,
  stage: WorkflowStage, fingerprint: string, actorId: string): EvidenceProof[] => {
  if (!a || a.stage !== stage || a.fingerprint !== fingerprint || a.actorId !== actorId ||
      !Array.isArray(a.proofs) || a.proofs.length === 0 || !/^[a-f0-9]{64}$/.test(a.mac))
    throw new Error("Missing or invalid server-verified evidence attestation.");
  const date = Date.parse(a.checkedAt);
  if (!Number.isFinite(date) || Math.abs(Date.now() - date) > 120_000)
    throw new Error("Server evidence attestation expired; recheck current files.");
  const digest = signature(a);
  if (!timingSafeEqual(Buffer.from(a.mac, "hex"), Buffer.from(digest, "hex")))
    throw new Error("Server evidence attestation was forged or altered.");
  if (new Set(a.proofs.map((p) => p.key)).size !== a.proofs.length ||
      a.proofs.some((p) => !p.key || !p.file || !/^[a-f0-9]{64}$/.test(p.sha256) ||
        !/^[a-z0-9][a-z0-9_-]{2,99}$/.test(p.verifier)))
    throw new Error("Invalid or duplicate server evidence proof.");
  return a.proofs;
};
