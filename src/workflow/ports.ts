/**
 * Required composition boundary for all production entrypoints. Each protected
 * operation executes under the host's artifact edit/read lock, which MUST be
 * shared with the script, storyboard, voice, render and publish writers.
 * Tests inject a real serialized lock; production must supply its own lock.
 *
 * Central integration must call these adapters, never the unguarded engines.
 */
import type { WorkflowSnapshot } from "./gates.ts";
import type { createTrustedWorkflowService } from "./service.ts";

export type WorkflowGateService = Pick<ReturnType<typeof createTrustedWorkflowService>,
  "gate" | "withVerifiedMasterPublication">;
export type WorkflowArtifactLock = <T>(work: () => Promise<T>) => Promise<T>;
export type ApprovedMasterFile = { file: string; sha256: string; snapshot: WorkflowSnapshot };

export const createWorkflowProtectedPorts = (service: WorkflowGateService, withArtifactLock: WorkflowArtifactLock) => {
  if (typeof withArtifactLock !== "function") throw new Error("A shared artifact lock is mandatory for production gates.");
  const guard = <T>(action: "generate_voice" | "final_motion_render" | "master_render",
    work: (verified: { snapshot: WorkflowSnapshot }) => Promise<T>): Promise<T> =>
    withArtifactLock(async () => {
      const verified = await service.gate(action);
      return work({ snapshot: verified.snapshot });
    });
  return {
    /** No paid voice synthesis before script+Storyboard owner approval. */
    generateVoice: <T>(work: (verified: { snapshot: WorkflowSnapshot }) => Promise<T>) =>
      guard("generate_voice", work),
    /** Motion must follow the approved complete voice recording. */
    renderFinalMotion: <T>(work: (verified: { snapshot: WorkflowSnapshot }) => Promise<T>) =>
      guard("final_motion_render", work),
    /** This creates a candidate, NOT a Master approval. */
    renderMasterCandidate: <T>(work: (verified: { snapshot: WorkflowSnapshot }) => Promise<T>) =>
      guard("master_render", work),
    /** No publication path can choose its own file: receives the frozen approved bytes. */
    publishExactMaster: <T>(publisher: (verified: ApprovedMasterFile) => Promise<T>) =>
      service.withVerifiedMasterPublication(publisher), // service owns the shared lock through dispatch
  };
};
