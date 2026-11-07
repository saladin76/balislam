/**
 * Public, trusted-server-only integration surface for Studio's six approvals.
 *
 * Production callers MUST import from this barrel. The low-level store is a
 * separate policy/persistence implementation and is NOT a production API.
 * Do not expose this module through browser/client bundling.
 */
export {
  createTrustedWorkflowService,
  type TrustedWorkflowDependencies,
  type AuthenticatedWorkflowPrincipal,
  type WorkflowClientCommand,
} from "./service.ts";
export {
  createWorkflowProtectedPorts,
  type WorkflowGateService,
  type WorkflowArtifactLock,
  type ApprovedMasterFile,
} from "./ports.ts";
export {
  WORKFLOW_STAGES, STAGE_EVIDENCE, stageFingerprint, stagePrerequisites,
  type WorkflowStage, type WorkflowStatus, type WorkflowAction,
  type WorkflowSnapshot, type ArtifactVersion, type WorkflowLedger,
} from "./gates.ts";
export { type ArtifactManifest, type StageArtifactFiles } from "./artifacts.ts";
export { type WorkflowIdentity, type StudioChannel } from "./store.ts";

export { type WorkflowInspectionView, type WorkflowStageView, type WorkflowGateView } from "./view.ts";

export { type StudioWorkflowUiSnapshot, type WorkflowUiStage, type WorkflowUiApproval } from "./view.ts";
