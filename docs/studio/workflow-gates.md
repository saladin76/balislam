# Studio: durable six-stage workflow gates (integration contract)

**Status: isolated draft implementation. Not deployed or connected to the production Studio UI, voice generator, renderer or uploader.** This module does not approve existing episodes or infer approval from the existence of a file, test success or Drive delivery. Its use is opt-in until the independent integration and Mac checks are approved.

## Six ordered approval states

| Stage ID | Human approval | Required trusted evidence |
| --- | --- | --- |
| `script` | Script + Islamic/source references in this version | `script_validated`, `sources_reviewed`, `quran_compared` |
| `storyboard` | All visual boards and compositions | `all_visual_boards_reviewed`, `storyboard_source_matches` |
| `voice` | Exact complete voice recording | `every_clip_reviewed`, `full_audio_listened`, `audio_matches_script` |
| `motion` | Final motion and scenes aligned to approved audio | `aligned_to_approved_audio`, `scene_checks_passed` |
| `av_review` | Full continuous 1× episode audiovisual review | `full_episode_watched_at_1x`, `audio_visual_review_passed` |
| `master` | The actual final Master file, not its preview | `exact_master_watched`, `master_quality_passed`, `publication_rights_checked` |

Each stage can be `draft`, `in_review`, `approved`, `rejected` or `needs_reapproval`. Transition is `draft/rejected/needs_reapproval → in_review → approved/rejected`. `reopen` turns a rejected or invalidated stage back into a draft. `approve` requires an explicit authenticated `owner` action, a meaningful note, the current exact fingerprint and a trusted server-side evidence result. Approval stores approver identity, ISO timestamp, current content version, artifact SHA-256, cumulative fingerprint and evidence keys; the append-only event history records all decisions and invalidations. A `reviewer` may submit/reject but may not grant approval. No automatic approval occurs.

## Source/version binding

`src/workflow/gates.ts` is a pure state machine; `src/workflow/store.ts` persists a versioned `workflow-approvals.json` inside **only** `channels/<channel>/episodes/<NNN-slug>/`. File changes use exclusive per-episode locks, signed schemaVersion 2, atomic replacement and no cleanup of other processes' locks or assets. Path traversal, unknown channels, symlinked episode directories and corrupted state fail closed. Reads re-check the snapshot and durably mark stale approvals `needs_reapproval`; blocked operations do so as well. Changed in-review input resets that submission to draft. Restoring old bytes cannot revive a previously invalidated approval: a fresh explicit decision is required. Three channels and episodes have isolated paths, not global state.

The trusted adapter provides a `WorkflowSnapshot`, one `{ version, sha256 }` for each existing artifact up to its current stage. SHA-256 must be **computed from the current bytes** by the server, never supplied by browser requests. For `script`, hash the *complete script text and material source verification/religious review state*; for `storyboard`, hash the approved visual scene/version manifest (exclude later tone/voice choices); for `voice`, hash **all current MP3 bytes, scene IDs, transcript, selected voices, tones and listening review evidence**; for `motion`, hash the current scene/video build, synchronisation report and timing data; for `av_review`, hash the actual audiovisual review cut and its human 1× review record; for `master`, hash **the exact master video bytes** being approved and eventually uploaded, not filename, preview, metadata or render time. Include all material source ledger revisions in the appropriate stage's input, otherwise the engine cannot detect those outside changes. Use deterministic canonical serialization for compound artifacts. Every input includes a stable human-readable content version (`version`). A stage fingerprint binds all preceding artifacts and its own artifact, including versions. Approvals from an earlier version never transfer to a changed artifact.

## Server-only integration example (contract only, not a deployed endpoint)

```ts
import { createTrustedWorkflowService } from "../../src/workflow/service";
import { createWorkflowProtectedPorts } from "../../src/workflow/ports";

// These are trusted server implementations required from central integration.
// None of them may be populated from raw HTTP request fields.
const service = createTrustedWorkflowService({
  scope: trustedEpisodeScope,
  authenticate: authenticatedServerSessionPrincipal,
  currentManifest: collectConfiguredEpisodeFilesFromDisk,
  verifiedEvidence: independentSourceStoryboardAudioAVRightsValidators,
  withArtifactLock: sharedEpisodeContentReadWriteLock,
});
const ports = createWorkflowProtectedPorts(service, sharedEpisodeContentReadWriteLock);

// UI may send ONLY action, stage, expectedFingerprint, note.
const current = await service.inspect();
// await service.command({ action: 'submit', stage: 'script',
//   expectedFingerprint: stageFingerprint(current.snapshot, 'script'), note: '...' });
// await service.command({ action: 'approve', stage: 'script', ... });

// Inside actual production routes AFTER the host shared lock is implemented:
// await ports.generateVoice(() => originalVoiceSynthesizer());
// await ports.renderFinalMotion(() => originalFinalMotionRenderer());
// await ports.renderMasterCandidate(() => originalMasterRenderer());
// await ports.publishExactMaster(({ file }) => originalUploader(file));
// The final callback is given a frozen approved Master copy.
```

Calls requiring integration after merging this independent PR (none are patched here):

1. **Script/save and religious checks**: recompute script/source digest from `script.md`, `review.json`, Quran comparison/audit; no auto Quran text edits or inferred religious signoff. Explicitly connect current review checks (`src/script/review.ts`) and external qualified review where required.
2. **Storyboard review**: `src/plan/storyboard.ts` / `storyboardVisualGate.ts` must assert all visual scene hashes and owner signoff; selecting `tone` later must not invalidate the visual digest. A storyboard export, PDF or Drive upload is not an approval.
3. **Voice**: `src/voice/review.ts` `assertVoiceApproved` must succeed for every scene **and the continuous whole recording** at the moment of approval. Recalculate actual MP3 byte hashes after generating or changing clips. Writing a Quran verse in the script is not a recitation approval. Before final motion generation use `requireWorkflowGate(..., "final_motion_render")` and abort if it fails. Draft/preview storyboards remain allowed.
4. **Motion and AV**: require all current scene reviews, actual word-level timings against the approved full audio, then explicit 1× continuous viewing approval. `requireWorkflowGate(..., "master_render")` must precede costly Master rendering. No automatic approval from test/render success.
5. **Master and publication**: render a candidate, compute SHA-256 of the **exact resulting file**, present that file for full owner inspection, submit and approve stage `master`. Before **any** upload/publish/shorts publication, recompute all snapshot digests *and master bytes* and call `requireWorkflowGate(..., "publish")` on the server **immediately before dispatch**. Existing `status.json`/`src/render/quality.ts` approval remains independent until migration; it is not evidence for these six gates. Do not expose a publish path that bypasses this check.
6. **API/UI and concurrency**: bind the authenticated owner identity on the server; reject caller-supplied role/evidence, pass expected fingerprint from last UI inspection, show stage status plus blocking prerequisite; never trust an arbitrary client-reported `approved` value. Protect the artifact-hash/dispatch interval from concurrent edits (lock or immutable versioned artifact). This module locks only its own ledger and cannot prevent external media edits between snapshot collection and action; the adapter must coordinate that boundary.

### Gate map

- `generate_voice`: `script` + `storyboard` approved (source, visual approvals)
- `final_motion_render`: above + `voice` approved (complete audio, not one clip)
- `master_render`: above + `motion` + `av_review` approved
- `publish`: all six, including **the exact Master hash** approved explicitly

### Verification

New regression tests: `tests/workflow-gates.test.ts` cover six-stage progression, blocked renders and publication, required human role/evidence, post-approval edits, no resurrection of old approvals, rejection/resubmission, in-review changes, simultaneous writers, path/symlink protection, corrupted-ledger fail-closed behavior and cross-channel isolation. After integration, rerun TypeScript, all Vitest and the isolated Mac review against the final integration SHA. **No production render, auto-Master, publishing, migration or Vercel calls in this PR.**

## PR #77 — hardened engine contract and mandatory integration

**Security boundary:** this branch is an isolated server-side engine, NOT an activated production gate. No route, audio generator, render process or uploader is modified in this PR. The central integration must wire every entrypoint and test all four gates before declaring 100%.

### Signed durable decisions

- Set BAL_WORKFLOW_HMAC_KEY in the trusted server environment to a high-entropy secret of at least 32 bytes. There is no default. Never commit or expose it. Missing key means fail closed. Key rotation requires a verified migration.
- Every persisted workflow-approvals.json ledger uses HMAC-SHA256, an exclusive episode lock, exclusive temporary file, file sync, atomic rename and directory sync. Invalid signatures, corrupt JSON and foreign-episode paths fail closed.
- Approval records carry authenticated owner ID, UTC date, content version, artifact SHA-256, cumulative fingerprint, evidence source receipts, approvalEventSeq and prerequisiteApprovalSeq. New upstream approvals cannot silently revive prior downstream signoffs even if old bytes return.
- The history and its stage states are signed as one document; attempts to edit approval events or Master SHA without the server key fail validation. A privileged rollback of the entire previously signed file would still need an external monotonic revision authority to detect.

### Server-only artifact and evidence verification

- src/workflow/artifacts.ts accepts a configuration-owned manifest and rehashes real regular files inside the owning episode, plus explicitly listed channel-images. Missing files, traversal, symlinks and other episodes are rejected.
- The script stage must include script.md plus all material Quran/source review ledgers. Storyboard inputs include approved scene/visual manifests and image files. Voice inputs include MP3 bytes, narration/tone and full listening-review records. Motion and AV inputs include real output and review records. Missing a material dependency is a blocker.
- Master stage SHA is exactly SHA-256 of the final Master MP4 file bytes; never a preview, filename, JSON wrapper or timestamp.
- src/workflow/trust.ts signs short-lived evidence attestations bound to stage, current fingerprint and authenticated approver. Each required evidence key has a source file, file SHA and independent checker name. src/workflow/service.ts independently rehashes the evidence files, including when inspecting current status and before guarded operations.
- A cryptographically valid evidence record does NOT prove its semantic truth: the central integration must implement qualified script/Quran checks, visual review, full audio listening, synchronized motion checks, full 1x audiovisual viewing and real publication rights validators. File existence, UI booleans, test success or Drive delivery are not approvals.

### Restricted API/production port contract

- src/workflow/service.ts exports createTrustedWorkflowService with three trusted callbacks: authenticate, currentManifest and verifiedEvidence. Authentication must be based on real server-side credentials, not caller-supplied role or a localhost header.
- The only permitted client command fields are action, stage, expectedFingerprint and note. The service rejects any supplied actor, role, snapshot, source path or evidence. GET status must also use authenticated server-derived state.
- src/workflow/ports.ts exports createWorkflowProtectedPorts(service, withArtifactLock). The edit/read lock must be the same lock used by all script, Storyboard, voice, motion, Master and publishing writes. Without it, no production authorization is safe.
- Protected ports are generateVoice (script and Storyboard), renderFinalMotion (plus approved full audio), renderMasterCandidate (plus motion and complete 1x AV review), and publishExactMaster (all six approvals). Master rendering creates an unapproved candidate, never automatic approval.
- Publishing receives only a private frozen copy of the previously owner-approved Master, verified byte-for-byte with the current Master SHA. The copy is deleted after callback success/failure and never reused as a human approval.
- REST routes, desktop/CLI commands, queue runners, batch jobs and uploaders must call these ports. An alternative unguarded route is a blocker. The central integration must test zero side effects for denied operations with an isolated fake renderer/uploader.

### Mandatory acceptance and status

1. Run npm ci, npm run typecheck, the workflow-gates, workflow-service-security and workflow-integration-contract Vitest files, then npm test and npm run gate on a complete isolated repository clone.
2. Run isolated concurrent mutation and cancellation tests using cloned episode files, check signed history integrity, invalidations, cross-channel isolation, symlinks, missing or altered review evidence, untrusted client role/evidence and old-byte restoration.
3. Test actual API, CLI, audio, final-motion, Master and publish endpoints after central integration. Verify that every failed gate prevents work starting, and that the publication dispatch uploads precisely the frozen approved bytes.
4. Carry out the full normal-speed 1x AV review and real-device landscape/portrait tests; mark NOT_RUN until actual signed owner review. Do not confuse test-generated synthetic evidence with a human check.

**GitHub CI environment blocker:** on 2026-11-07, initial workflow runs for this branch failed within seconds with zero executed job steps and inaccessible job logs (BlobNotFound). This does not establish pass or code failure. Recheck latest commit after runner availability is restored.

**Status: DRAFT / NOT PRODUCTION-READY.** No merge, Vercel, automatic Master, publishing or Mac-production edits were performed.

Signed schemaVersion 2 is intentionally incompatible with any unsigned early draft ledger; migration must be explicitly authorized and must NEVER auto-approve an old episode. Cross-process contention is exercised by tests/workflow-process-concurrency.test.ts; full-suite execution remains blocked by GitHub Actions runner availability.
