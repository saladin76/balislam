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

`src/workflow/gates.ts` is a pure state machine; `src/workflow/store.ts` persists a versioned `workflow-approvals.json` inside **only** `channels/<channel>/episodes/<NNN-slug>/`. File changes use exclusive per-episode locks, atomic replacement and no cleanup of other processes' locks or assets. Path traversal, unknown channels, symlinked episode directories and corrupted state fail closed. Reads re-check the snapshot and durably mark stale approvals `needs_reapproval`; blocked operations do so as well. Changed in-review input resets that submission to draft. Restoring old bytes cannot revive a previously invalidated approval: a fresh explicit decision is required. Three channels and episodes have isolated paths, not global state.

The trusted adapter provides a `WorkflowSnapshot`, one `{ version, sha256 }` for each existing artifact up to its current stage. SHA-256 must be **computed from the current bytes** by the server, never supplied by browser requests. For `script`, hash the *complete script text and material source verification/religious review state*; for `storyboard`, hash the approved visual scene/version manifest (exclude later tone/voice choices); for `voice`, hash **all current MP3 bytes, scene IDs, transcript, selected voices, tones and listening review evidence**; for `motion`, hash the current scene/video build, synchronisation report and timing data; for `av_review`, hash the actual audiovisual review cut and its human 1× review record; for `master`, hash **the exact master video bytes** being approved and eventually uploaded, not filename, preview, metadata or render time. Include all material source ledger revisions in the appropriate stage's input, otherwise the engine cannot detect those outside changes. Use deterministic canonical serialization for compound artifacts. Every input includes a stable human-readable content version (`version`). A stage fingerprint binds all preceding artifacts and its own artifact, including versions. Approvals from an earlier version never transfer to a changed artifact.

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
