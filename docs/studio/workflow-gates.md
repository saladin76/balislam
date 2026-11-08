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

`src/workflow/gates.ts` is a pure state machine; `src/workflow/store.ts` persists a versioned `workflow-approvals.json` inside **only** `channels/<channel>/episodes/<NNN-slug>/`. File changes use exclusive per-episode locks, signed schemaVersion 3, atomic replacement and no cleanup of other processes' locks or assets. Path traversal, unknown channels, symlinked episode directories and corrupted state fail closed. Reads re-check the snapshot and durably mark stale approvals `needs_reapproval`; blocked operations do so as well. Changed in-review input resets that submission to draft. Restoring old bytes cannot revive a previously invalidated approval: a fresh explicit decision is required. Three channels and episodes have isolated paths, not global state.

The trusted adapter provides a `WorkflowSnapshot`, one `{ version, sha256 }` for each existing artifact up to its current stage. SHA-256 must be **computed from the current bytes** by the server, never supplied by browser requests. For `script`, hash the *complete script text and material source verification/religious review state*; for `storyboard`, hash the approved visual scene/version manifest (exclude later tone/voice choices); for `voice`, hash **all current MP3 bytes, scene IDs, transcript, selected voices, tones and listening review evidence**; for `motion`, hash the current scene/video build, synchronisation report and timing data; for `av_review`, hash the actual audiovisual review cut and its human 1× review record; for `master`, hash **the exact master video bytes** being approved and eventually uploaded, not filename, preview, metadata or render time. Include all material source ledger revisions in the appropriate stage's input, otherwise the engine cannot detect those outside changes. Use deterministic canonical serialization for compound artifacts. Every input includes a stable human-readable content version (`version`). A stage fingerprint binds all preceding artifacts and its own artifact, including versions. Approvals from an earlier version never transfer to a changed artifact.

## Server-only integration example (contract only, not a deployed endpoint)

```ts
import { createTrustedWorkflowService, createWorkflowProtectedPorts } from "../../src/workflow/index";

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
// Use current.view.stages[0].fingerprint as the UI expectedFingerprint.
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

Signed schemaVersion 3 is intentionally incompatible with any unsigned early draft ledger; migration must be explicitly authorized and must NEVER auto-approve an old episode. Cross-process contention is exercised by tests/workflow-process-concurrency.test.ts; full-suite execution remains blocked by GitHub Actions runner availability.

### File-generation rollback resistance (schema v3)

A material file can be modified and restored **between two workflow reads**, returning to precisely the same SHA-256 bytes. Content-only cumulative fingerprints would then silently reuse the old approval. The hardened server collector now captures both real-byte `sha256` and a separate `epoch` digest over the opened file descriptor's `dev / ino / size / ctimeNs / mtimeNs` on a trusted filesystem. The collector checks metadata before and after hashing, refuses hardlinked artifacts, and uses `O_NOFOLLOW` to block a swapped leaf symlink. Cumulative stage fingerprints include the file-generation epochs, and approvals store `artifactEpoch` alongside the byte SHA. Even after the previous contents are restored before inspection, a normal filesystem write changes `ctimeNs` or inode and automatically invalidates approval. Master publication still compares the exact SHA-256 bytes, **and also checks the approved file epoch**.

This is a conservative content-generation test, not an immutable/replay-proof cryptographic filesystem. It may revoke approval on benign copy/chmod/checkout changes, which is preferable to approving unreviewed bytes. It does **not** prove detection after a privileged attacker rolls back the whole filesystem to an old signed state; use an independently durable monotonic revision authority if that threat is in scope. All writers still need the same shared content lock and an isolated integration run.

### PR #74 exact, browser-safe inspection response

The UI branch `work/studio-ui-workspaces-20261107` contains `app/src/workspace/workflowReadModel.ts` with `parseWorkflowReadModel(raw, channel, episode)`. The **precise supported endpoint contract** is:

```ts
import { createTrustedWorkflowService } from "../../src/workflow/index.ts";

// Authenticate and authorize channel/episode scope first, using server session.
// Never use browser actor, role, source paths, evidence or claimed approval.
const service = createTrustedWorkflowService(trustedServerDependencies);
const { uiSnapshot, view } = await service.inspect();
// Send { uiSnapshot, view } or only uiSnapshot to the authenticated browser.
// For existing PR #74 parser: parseWorkflowReadModel(uiSnapshot, channel, episode).
```

`uiSnapshot` has `schemaVersion:3`, `channel`, `episode`, `revision`, `stages` keyed by the six stage IDs, and `history`. `stages[stage].currentApproval=true` is **set by the server only** after HMAC, current file SHA/epoch, exact prerequisite event chain and actual evidence receipt verification. The DTO deliberately omits HMAC (`integrity`), trusted evidence source paths, proof signing tokens and raw file manifests, while preserving the already authenticated approver, date, version, SHA, epoch, decision event seq and history needed by the PR #74 display. `view` is a separate schemaVersion:1 convenience projection showing stage blockers and role-dependent allowed actions.

`service.inspect()` now returns **only** `{uiSnapshot, view}` and is safe by construction for a browser GET handler. `service.inspectInternal()` explicitly returns `{snapshot, ledger, view, uiSnapshot}` for trusted server-only checks and test fixtures, and **must never** be serialized to browser responses. The pending PR #74 integration tests must invoke the actual server endpoint and its existing parser together. Never interpret missing/failed/invalid data as approval.

### Supported import boundary
Production server adapters must import the public API from `src/workflow/index.ts`. `src/workflow/store.ts` is an internal persistence/state-machine test dependency; its direct `approveWorkflowStage` and `requireWorkflowGate(scope, snapshot, action)` calls are **not trustworthy browser/API endpoints** because they accept snapshots and actor values supplied by their caller. Use only the `createTrustedWorkflowService` facade to authenticate the real session and collect current bytes and verified proofs, then the protected ports for side effects. The low-level exports exist for isolated engine testing but must never be directly wired to an external request.


---

## Unified engine (2026-11-08)

The two Studio V2 lines are merged into one engine on `integration/studio-unified-20261108`:

- **Gate engine:** the V2 `gates.ts` / `store.ts` / `trust.ts` (signed ledgers, file epochs, evidence proofs) is the only engine.
- **Studio adapter:** the production adapter from the scene-first line lives in `src/workflow/studioSnapshot.ts`
  (re-exported from `artifacts.ts`). It now issues an `epoch` per stage from the identities (inode, size, mtime, ctime)
  of every file behind it, so restoring old bytes never revives an older approval.
- **Owner decisions:** `src/workflow/server.ts` verifies evidence on the server, then signs one proof per required key
  (`attestEvidence`) and passes the attestation to `approveWorkflowStage`. The browser never sees or supplies it.
- **Local secrets:** `ensureLocalSecrets()` (`src/settings/env.ts`) generates `BAL_WORKFLOW_HMAC_KEY`, `BAL_STUDIO_OWNER_TOKEN`
  and `STUDIO_V2_OWNER_SECRET` once into the owner's `.env` (mode 600) when the Studio starts, so approvals work without manual setup.

### Single approval authority

After unification the **scene-first ledger** (`src/studio/sceneProduction.ts`, `src/studio/sceneService.ts`) is the only
authority. Every production gate asks it:

| Gate | Requirement |
| --- | --- |
| Voice generation | script + storyboard approved (`requireScriptAndStoryboardApproved`) |
| Final motion | same, plus the technical Quran checks (`assertMotionStartAuthorized(episode, …)`) |
| Scene AV render | the next unapproved scene only, with current inputs (`assertCurrentSceneRenderAllowed`) |
| Master render | every scene approved with sound and picture **and** the assembly approved after a full 1× viewing with every seam checked (`requireScenesReadyForMaster`) |
| Shorts/reels | the exact approved Master (`requireSceneMasterReady`) |
| Publish | the exact approved Master **and** an explicit publish permission for those bytes (`requirePublishAllowed`) |

`assertWorkflowForEpisode` delegates to these. The six-stage ledger, the episode voice approval, the old script signoff and
`scene-review.json` are read-only: their write endpoints return **410** and nothing consults them.

**Scoped invalidation:** each scene's input hash covers only its own content, its own approved board, its own narration
clip and recitation. A script or storyboard edit re-opens those two decisions, the assembly, the Master and the publish
permission; only scenes whose own inputs changed are re-opened.

**Owner identity:** approvals need the owner passphrase, chosen once in «إنتاج المشاهد» (only its SHA-256 is stored in
`.env`). The ledger is signed with the separate random `BAL_WORKFLOW_HMAC_KEY`. There is no bypass flag in the UI, API or CLI.

The isolated V2 review API (`app/server/studioV2Api.ts`, `src/workflow/*V2*`) is no longer mounted (`/api/studio-v2/*`
returns 410). Its modules remain in the tree until the owner accepts the release.

### Earlier integration notes from the scene-first line

## Minimal server-only integration

```ts
import { stageFingerprint } from "./src/workflow/gates";
import { submitWorkflowStage, approveWorkflowStage, requireWorkflowGate } from "./src/workflow/store";

// Server only: identity is authenticated, evidence computed from existing review records.
// const scope = { channelsRoot: ..., channel: "balislam", episode: "001-some-episode" };
// const snapshot = await collectActualArtifactDigests(scope); // NOT client-controlled
// const fp = stageFingerprint(snapshot, "voice");
// await submitWorkflowStage(scope, { stage: "voice", snapshot, expectedFingerprint: fp,
//   actor: authenticatedReviewer, note: "Submitted the currently recorded audio." });
// await approveWorkflowStage(scope, { stage: "voice", snapshot, expectedFingerprint: fp,
//   actor: authenticatedOwner, note: "Listened to the full current recording and approved it.",
//   evidence: verifiedAudioEvidence });
// await requireWorkflowGate(scope, await collectActualArtifactDigests(scope), "final_motion_render");
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
