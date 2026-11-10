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

## Server-only integration example (removed)

The trusted service/ports facade (`src/workflow/index.ts`, `service.ts`, `ports.ts`) was never mounted and was removed in D27 (2026-11-08). See «Unified engine» below for the live path.

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
- src/workflow/trust.ts signs short-lived evidence attestations bound to stage, current fingerprint and authenticated approver. Each required evidence key has a source file, file SHA and independent checker name.
- A cryptographically valid evidence record does NOT prove its semantic truth: the central integration must implement qualified script/Quran checks, visual review, full audio listening, synchronized motion checks, full 1x audiovisual viewing and real publication rights validators. File existence, UI booleans, test success or Drive delivery are not approvals.

### Restricted API/production port contract (removed)

`src/workflow/service.ts` and `src/workflow/ports.ts` were removed in D27; production gates now ask the scene-production ledger (see «Single approval authority»).

### Mandatory acceptance and status

1. Run npm ci, npm run typecheck, the workflow-gates Vitest file, then npm test and npm run gate on a complete isolated repository clone.
2. Run isolated concurrent mutation and cancellation tests using cloned episode files, check signed history integrity, invalidations, cross-channel isolation, symlinks, missing or altered review evidence, untrusted client role/evidence and old-byte restoration.
3. Test actual API, CLI, audio, final-motion, Master and publish endpoints after central integration. Verify that every failed gate prevents work starting, and that the publication dispatch uploads precisely the frozen approved bytes.
4. Carry out the full normal-speed 1x AV review and real-device landscape/portrait tests; mark NOT_RUN until actual signed owner review. Do not confuse test-generated synthetic evidence with a human check.

**GitHub CI environment blocker:** on 2026-11-07, initial workflow runs for this branch failed within seconds with zero executed job steps and inaccessible job logs (BlobNotFound). This does not establish pass or code failure. Recheck latest commit after runner availability is restored.

**Status: DRAFT / NOT PRODUCTION-READY.** No merge, Vercel, automatic Master, publishing or Mac-production edits were performed.

Signed schemaVersion 3 is intentionally incompatible with any unsigned early draft ledger; migration must be explicitly authorized and must NEVER auto-approve an old episode. Cross-process contention is exercised by tests/workflow-process-concurrency.test.ts; full-suite execution remains blocked by GitHub Actions runner availability.

### File-generation rollback resistance (schema v3)

A material file can be modified and restored **between two workflow reads**, returning to precisely the same SHA-256 bytes. Content-only cumulative fingerprints would then silently reuse the old approval. The hardened server collector now captures both real-byte `sha256` and a separate `epoch` digest over the opened file descriptor's `dev / ino / size / ctimeNs / mtimeNs` on a trusted filesystem. The collector checks metadata before and after hashing, refuses hardlinked artifacts, and uses `O_NOFOLLOW` to block a swapped leaf symlink. Cumulative stage fingerprints include the file-generation epochs, and approvals store `artifactEpoch` alongside the byte SHA. Even after the previous contents are restored before inspection, a normal filesystem write changes `ctimeNs` or inode and automatically invalidates approval. Master publication still compares the exact SHA-256 bytes, **and also checks the approved file epoch**.

This is a conservative content-generation test, not an immutable/replay-proof cryptographic filesystem. It may revoke approval on benign copy/chmod/checkout changes, which is preferable to approving unreviewed bytes. It does **not** prove detection after a privileged attacker rolls back the whole filesystem to an old signed state; use an independently durable monotonic revision authority if that threat is in scope. All writers still need the same shared content lock and an isolated integration run.

### PR #74 inspection response and import boundary (removed)

The `createTrustedWorkflowService` facade they described was removed in D27 (2026-11-08) together with `src/workflow/index.ts`.

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
| «اعتمد التجهيز» (step ١, D40) | one owner request (loopback Studio page) + `reviewed: true`, the script and storyboard fingerprints the owner saw; everything that can refuse is checked before any write (script errors, verses without text, board note ≥ 25 chars when the boards are not recorded); then, in order, `approve-script` → board record (`storyboard.json`, same `checkVisualStoryboardSignoff`, script approved first) → `approve-storyboard`, each ledger decision through `decideSceneProduction` (`src/studio/preparation.ts`) |
| Voice generation | script + storyboard approved (`requireScriptAndStoryboardApproved`) |
| Final motion | same, plus the technical Quran checks (`assertMotionStartAuthorized(episode, …)`) |
| Scene AV render («إنتاج المشهد») | the next unapproved scene only, with current inputs (`assertCurrentSceneRenderAllowed`) |
| Scene AV draft («جهّز كل المشاهد», `bal produce`) | the owner (loopback Studio page or the CLI on his Mac), script + storyboard approved and every board reviewed (`requireSceneProductionReady`); only the current scene or a later scene that is neither approved nor submitted, with current inputs (`assertSceneRenderAllowed(…, "ahead")`) |
| Master render | every scene approved with sound and picture (none «مشروط بالتلاوة») **and** the assembly approved after a full 1× viewing with every seam checked (`requireScenesReadyForMaster`) |
| Shorts/reels | the exact approved Master (`requireSceneMasterReady`) |
| Publish | the exact approved Master **and** an explicit publish permission for those bytes (`requirePublishAllowed`) |
| Drive handoff (D53) | the same gate (`publishHandoffFacts` → `requirePublishAllowed`), started only by the recorded `grant-publish` or by the owner's «أعد الإرسال إلى Drive» (owner session); the Master bytes are re-hashed while copying and must equal the ledger's approved Master |

`assertWorkflowForEpisode` delegates to these. The six-stage ledger, the episode voice approval, the old script signoff and
`scene-review.json` are read-only: their write endpoints return **410** and nothing consults them.

**Scoped invalidation:** each scene's input hash covers only its own content, its own approved board, its own narration
clip and recitation. A script or storyboard edit re-opens those two decisions, the assembly, the Master and the publish
permission; only scenes whose own inputs changed are re-opened.

**Designed plans are never regenerated implicitly (D46).** `plan.json` with any designed scene — a `*-shot` template
(`horizon-shot`, `ink-shot`), a non-empty `props.shot`, or `designed: true` (`isDesignedPlan`, `src/plan/designed.ts`;
detection needs no migration) — is not rewritten from the script. Saving the script (`PUT /api/episodes/<ep>/script`)
always writes `script.md`, leaves `plan.json` byte-identical (`planAfterScriptSave`), so no scene is re-opened by the save,
and returns `planUnchanged`, the designed count and `divergence` (designed-plan scenes whose narration no longer occurs
in the script, script sentences no scene covers). Text is applied per scene from the scene editor, which re-opens exactly
that scene through the existing ledger. `regeneratePlan` throws `DesignedPlanError` (HTTP 409, CLI exit 1) unless
`forceOverwriteDesigned` (`bal plan <ep> --force-overwrite-designed`; Studio body `overwriteDesigned: true` +
`confirmEpisode` equal to the episode number), and then copies `plan.backup-<timestamp>.json` (gitignored) before writing.
`bal make` uses a designed plan as it is. No approval is created or weakened.

**Prepared drafts (D31, D40).** Preparing the scenes starts on its own right after «اعتمد التجهيز» (`POST
/api/episodes/<ep>/approve-preparation` starts the same queue once `requireSceneProductionReady` passes; the response
carries `prepare.job`). It approves and submits nothing. Its status line (step ٢ header, and the spine while step ٢ is
current) offers «أوقف» while running and «استأنف التجهيز» once stopped. The queue and its CLI twin
`npx bal produce <episode> [--channel …]` run one pipeline (`src/studio/prepareAll.ts`): (1) narration voice for every
narrated scene without a current clip, through `generateVoice` (tashkeel ≥ 98%, reviewed boards, tones, script+storyboard
approval; verse cards carry no narration, recitations stay the owner's own recording); without a voice key this step is
skipped and reported in one line; (2) AV preview drafts for the current scene and every later open scene, one at a time
in order, through the same renderer and slot (`previews/scene-<id>-av.mp4`). In the Studio it runs as an in-process
background queue (`app/server/prepare.ts`, `GET/POST /api/episodes/<ep>/scene-prepare`); the owner is checked when the
job starts (the job runs inside that request's owner scope) and nothing about him is stored; a restart drops the job (finished drafts remain). `DELETE …/scene-prepare` (owner only, D36) asks the
queue to stop: the voice clip or scene render in progress finishes and is kept, nothing new starts, status `stopped`;
on the dafatir parts path no scene is composed from an incomplete set of parts. A tone is present when the scene has
one or inherits the episode's (then the channel's) tone (`effectiveTone`, D36); the dafatir tone map is unchanged.
Without a usable voice (no key, or the voice step failed) the queue drafts only the scenes **before** the first open
scene still waiting for its narration (none of the rest can be reviewed before that voice exists), and lists the others
as `skipped: [{ id, reason: "voice" }]`; a scene whose **same inputs** failed in the previous run is not rendered
again by the queue (`reason: "failed-before"`; the scene's own «إنتاج المشهد» retries it), except network/render-browser
failures, which are retried (`pickRenderQueue`, D38).

**Sentence-by-sentence voice (D50).** A narrated scene can be voiced sentence by sentence from «الجمل»
(`src/voice/sentences.ts` pure model, `src/voice/sentenceVoice.ts` disk/generation/composition, `GET/POST
/api/episodes/<ep>/sentences`). Reading needs nothing; every action (`init`, `edit`, `split`, `merge`, `delete`, `add`,
`tone`, `pause`, `generate`, `restore`, `heard`, `fixword`) needs the owner (`assertSceneOwner`: a loopback, same-origin Studio request)
and runs under a per-episode lock on `voice/sentences.json`. `generate` sends ONE ElevenLabs request for that sentence,
with the neighbouring sentences as `previous_text`/`next_text` (models that accept them), behind the same gates as
`generateVoice`, checked for that sentence and scene: tashkeel ≥ 98% for the sentence (Arabic refusal naming the
words), its board approved, script + storyboard approved in the ledger, a tone (sentence → scene → episode → channel, or
the tone-map part), a key, a trained professional voice. A sentence with Quran text (﴿ ﴾) is never voiced; a verse card
stays an owner upload (`own-recitations`, D35 unchanged). When every sentence of a scene has a current recording the
scene clip is composed (edge silence trimmed per sentence, the owner's pause between speech, loudness pulled to the
median within ±6 dB, peak guard) into `voice/<hash>.wav` with word timings in `voice/index.json` — the same record the
renderer, `sceneSeconds` and the ledger read; on a tone-map episode the clip also carries the D-silence `timing`. Until
then the previous scene clip stays as it was. Editing a sentence's text writes that scene's `narration` only in
`plan.json` (raw read/write, never `regeneratePlan`, so designed plans stay designed, D46); the ledger re-opens exactly
that scene through its own input hash, and recomposing re-opens it through its voice fingerprint. `generateVoice`, the
dafatir parts path (`loadPartsContext(…, skipScenes)`) and `scenesNeedingVoice` skip sentence-managed scenes and never
delete their clip. Paid audio is never deleted: a replaced sentence take stays in `takes`; the old scene clip is cut into
sentences only when its word timings show a real pause (≥ 120 ms) at every boundary, otherwise sentences start
«بلا صوت»; when a composed clip replaces it, the old file is moved to `voice/superseded/`.

**Re-record one word (D55).** `fixword` (word index + written pronunciation, fully voweled) re-records only that word of
a generated sentence: one short ElevenLabs request (the corrected word between its two neighbours, the rest of the
sentence and the neighbouring sentences as `previous_text`/`next_text`, same voice/tone/settings/seed), behind the same
gates as `generate` plus "the current take matches the sentence's settings and has aligned word timings". The word is cut
from the fragment by its alignment and spliced into the take (`src/voice/wordSplice.ts`: boundaries snapped to the quietest
point within ±40 ms then the nearest zero crossing, 15 ms equal-power crossfades, RMS matched to the neighbouring words,
surrounding pauses untouched). Quality check before applying: new/old word duration 0.6–1.6×, no added energy jump > 6 dB
at either seam, level within 6 dB of the neighbours; on failure nothing changes (the paid fragment is kept) and the owner
gets «ولّد الجملة كاملة بهذا النطق» (`generate` with `word`/`say`). Success = a new take (`origin: "fix"`, previous one in
`takes`), then the scene clip is recomposed as for D50, so only that scene reopens. The channel lexicon
`channels/<ch>/pronunciations.json` (`src/voice/lexicon.ts`; `POST /api/episodes/<ep>/pronunciations` to edit/remove) is
applied to the outgoing text of the sentence, scene, parts (single-token only) and line paths, never to captions, never
inside ﴿ ﴾ or to a verse row, and is deliberately outside the voice fingerprint (it applies to future generations without
invalidating paid takes or making the scene path regenerate).

Why pre-rendering is safe:
- A render only adds a render-to-input proof (`previewInputs[id]`). `recordSceneRenderEvidence` refuses to save if the
  decision digest (state, history, review epochs, assembly/Master epochs) would change: a render never changes approval state.
- Approval still needs, strictly in order (`canWorkOn`), an owner-authenticated `submit-scene` of the exact bytes on disk,
  checked against the proof and the scene's current inputs, then an owner-authenticated `approve-scene` of those same
  bytes with `confirmedWatched`. Approved and submitted scenes are never re-rendered as drafts, so reviewed bytes are untouched.
- A draft is bound to its inputs: when a scene's inputs change, reconciliation drops only that scene's proof (its draft
  reads `stale` and can never be submitted); the running queue re-scans and re-renders it, otherwise one click
  («جهّز الباقي») re-queues it. Voice regeneration is never automatic (paid service, explicit owner action each time).
- Race (render publishing while the owner submits the same scene): `verifyBeforePublish` re-checks the scene is still
  open just before the file is replaced; a residual overlap can only invalidate the submission (epoch mismatch →
  `needs_revision`), never produce an approval.

The scene ledger read (`GET scene-production`) adds `scenes[].draft` (`ready` / `stale` / `none`) and
`prepared: { ready, total }` (approved + submitted + ready drafts), and, while the assembly awaits review,
`seamTimes: { "<a>><b>": seconds }` from the real cut durations (read-only: jumps the player; never checks a seam, D38).

**Owner notes inbox (notes-inbox.md).** After a successful, owner-checked `correct-scene` is saved in the ledger,
the note is appended to `channels/<ch>/episodes/<ep>/notes/inbox.json` (append-only, gitignored on `main`) and pushed in
the background, by plumbing in a temporary index, to the dedicated branch `studio-notes` only. It grants and blocks
nothing: no gate reads it, a sync failure never fails the correction, and Claude's answers come back in `notes/resolved.json`
on `main` (`bal notes resolve`). The scene read adds `scenes[].correction.inbox: { id, sync, status, answer }`. The pre-push
hook skips the full gate only for `refs/heads/studio-notes` with a tree made solely of `notes/inbox.json` files; `main` is
always gated.

**Input changes and the lock (D38).** A changed input re-opens a submitted, approved or corrected scene as
`needs_revision`; a scene never submitted stays `queued` with its new inputs (no «بانتظار التعديل» on a scene nobody
asked to fix). The ledger lock waits for a live writer up to `LEDGER_LOCK_WAIT_MS` (30 s, short backoff) instead of
60×25 ms, since every read hashes all scene inputs under it; a live writer's lock is still never deleted, only a dead
process's (D34). In step ٢ (D40; step ٣ before) a ready draft of the current scene is shown
for review directly: «اعتمد» or a problem report first submits those exact bytes (the UI checks the server recorded the
same SHA-256 it played), then decides. After «اعتمد» the next scene's draft opens and plays.

**Recitations last (D35, owner decision 8 Nov).** The owner records the Quran verses himself and adds them at the end;
before that he watches a pre-final version with narration and no recitation. Final gates are unchanged.
- Drafts: «جهّز كل المشاهد» and «إنتاج المشهد» no longer stop at a verse card without a reviewed recitation. It renders
  (`renderShotsPreview(…, { allowPendingRecitation: true })`) with the verse visible and silence for the plan's estimate of
  the scene (`sceneFrames` without a recitation: the manual `durationSec`, else the template's 7 s), an audio track always
  present (`enforceAudioTrack` for scene previews), and a small studio tag «التلاوة تُضاف لاحقًا · مسودة» (`draftMarks` →
  `PendingRecitationTag`). `renderEpisode` refuses `draftMarks` on a Master or any non-scene render. Only reviewed,
  owner-attached recordings are ever used; nothing is fetched or generated.
- Conditional approval: `readyForAv` now means "narration present". A verse scene without its recitation can be submitted and
  approved; the server records `approval.recitationPending: true` and the history note «اعتماد مشروط بالتلاوة». It satisfies
  the ORDER (`canWorkOn`, `nextSceneId`) so later scenes can be approved, but `approvedSceneInputsSha256` refuses while any
  scene is conditional, so `submitAssembly`, `approveAssembly`, `approveFinalMaster`, `assertExactMasterApproved`,
  `requireScenesReadyForMaster`, shorts and publish stay blocked; `progress.canAssemble` is false and
  `progress.recitationPending` lists those scenes. Attaching and approving the recitation changes that scene's inputs
  (its hash includes the recording), so `reviseSceneInput` re-opens ONLY that verse scene: it becomes the current scene,
  is rendered with its recitation, and needs a fresh unconditional approval. Removing a recording also re-opens it.
- «معاينة قبل النهائية» (`POST /api/episodes/<ep>/scene-prefinal`, owner only; `assemblePreFinalPreview` with
  `currentSceneCutsForPreFinal`): every scene's current cut in order — the reviewed bytes of approved/submitted scenes,
  otherwise a ready draft bound to current inputs; any scene without one is listed and the request refused. Output goes to
  the preview slot `prefinal-no-recitation`, never `previews/episode.mp4`, so it can never be recorded or approved as the
  assembly, and Master is always rendered from the plan, never from previews. It writes nothing to the scene ledger.
- Recitation polish (`POST /api/episodes/<ep>/own-recitations`, owner only; `src/quran/recitationPolish.ts`): the
  untouched upload stays in `recitations/originals/`; two candidates are made — PROCESSED (edge silence only, found with the
  dafatir trimmer's frame levels and soft threshold, margins 0.12 s before / 0.35 s after; `afftdn=nr=6:nf=-50`; two-pass
  EBU R128 loudnorm, linear, to the narration's median integrated loudness (−24…−12 LUFS), else −16 LUFS, true peak
  −1.5 dBTP) and the ORIGINAL as a plain MP3. No pitch, time or inner cut. The processed one is selected; the owner may
  switch (`select`) before or after approval (after approval the pointer is withdrawn and the recording goes back to review).
  Approval still requires listening, reciter and rights evidence (`approveOwnRecitation`).

**Owner identity — no passphrase (owner decision 9 Nov 2026, supersedes D49).** The Studio asks for no passphrase and
keeps no session or token. `assertSceneOwner()` (`src/studio/sceneService.ts`, the one owner policy) allows:
- a Studio HTTP request whose **socket** address is loopback (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`; no header is
  trusted), that passed the same-origin check (`isTrustedLocalRequest`: no `sec-fetch-site: cross-site`; on writes a
  loopback `Origin` equal to `Host`), and whose `Host` names this machine (DNS-rebinding guard). The API runs every
  `/api/*` request inside `runOwnerRequest` (`src/studio/ownerContext.ts`) with those facts;
- the owner's own CLI or script outside any Studio request (`bal produce` no longer asks for anything).
Any other Studio request is refused with 403 (`OWNER_AUTH`). The ledger is still signed with the separate random machine
key `BAL_WORKFLOW_HMAC_KEY` (created in `.env` on first start), and tampering is still detected; every gate after the
identity check is unchanged (scene order, «راجعته بنفسي», board notes, fingerprints, D35 recitation gates, publish
permission on exact bytes). There is no bypass flag in the UI, API or CLI. The old `.studio/owner-sessions.json` and the
`BAL_STUDIO_OWNER_PASSPHRASE_SHA256` line in `.env` are no longer read (left in place). The endpoints
`/api/owner-passphrase*` and `/api/owner-session` are gone (404). Test: `tests/studio-owner-no-passphrase.test.ts`.

The isolated V2 review API is no longer mounted (`/api/studio-v2/*` returns 410). Its server modules
(`app/server/studioV2*.ts`, `src/workflow/*V2*.ts`, `src/render/sceneV2*.ts`) were removed in D27.

### Local state, safe update and fresh start (D51)

**Ignored local runtime state.** Only files that are definitely local (signed by the machine key, or bound to local-only
bytes) are in `.gitignore`, each with its writer: `scene-production.v1.json` + `.lock` (`src/studio/sceneService.ts`,
`stateFileFor` / `serialized`), `workflow-approvals.json` + `.lock` (`src/workflow/store.ts`), `voice-review.json`
(bound to `voice/*.mp3`, `src/voice/review.ts`), `previews/.preview-index.lock/` (`src/render/episodePreviews.ts`) and
every atomic-write `*.tmp` under an episode folder. `voice/` (including `sentences.json`, takes and `voice/superseded/`,
D50), `out/`, `recitations/`, `status.json` and `.studio/` were already ignored. **Not ignored** (tracked or documented
as "in Git"): `storyboard.json`, `script-signoff.json`, `review.json`, `scene-review.json`, `publish.json`,
`notes/resolved.json`.

**Update button.** `app/server/update.ts` still requires a clean tree, but ignored files never count, and the refusal
names the blockers (`dirtyTreeMessage`: tracked modified files and untracked non-ignored files, eight at most).
`GET /api/update` fetches even when the tree is dirty and returns `blocked` with that message, so the banner shows the
update, the list and a disabled button; `start-studio.command` prints the same list. Test: `tests/studio-safe-update.test.ts`.

**Fresh start.** `fresh-start.command` never archives or deletes `.studio/`, the approval files above, `notes/`, `voice/`,
`recitations/`, `out/`, `assets/recitations/`, `status.json`, `publish.json` or plan backups (`is_protected`). It inspects
untracked folders file by file, and stops before `git reset --hard` when a tracked protected file has unsaved changes or
local commits were never pushed. `previews/` (approved scene cuts, the assembly and `history/`) is protected too (D58).
Any other tracked file modified on the machine (`plan.json`, `pronunciations.json`, `tashkeel.md`…) is listed by name
before the reset, and the reset happens only if the owner types «نعم» a second time; a copy of each goes to
`<archive>/modified-before-reset/` first. Test: `tests/fresh-start-safety.test.ts` (temporary git repository).

### Robustness: reconcile by scene id, locks and atomic state (D58)

**Ledger reconcile by scene id** (`reconcileSceneLedger`, `src/studio/sceneService.ts`). Every ledger operation reconciles
the signed state with the episode as it is now:
- a scene id still present keeps its status and approval; if its own input fingerprint (`sourceSha256`: its content, its
  board record, its narration clip, its recitation) changed it is re-opened by `reviseSceneInput` (queued stays queued,
  anything else becomes `needs_revision`);
- a new scene id enters `queued` at its plan position; a removed id is dropped with its approval;
- script and storyboard approvals stay unless their own hashes changed (`changeScript` / `changeStoryboard`);
- any change to the list — added, removed or reordered ids — clears the assembly, the Master and the publish permission
  (the cut and its seams no longer match), and with them `assemblyEpoch` / `masterEpoch`; preview epochs and draft proofs
  are kept per scene id as before;
- ordering is unchanged: a later approved scene after a newly inserted unapproved one stays approved, but `canWorkOn` /
  `nextSceneId` point at the new scene, which must be approved before assembly (`canAssemble` is false until then);
- a ledger of another channel/episode is never migrated (starts over).
Test: `tests/scene-ledger-reconcile.test.ts`.

**Locks** (`src/io/processLock.ts`). A lock file is created with O_EXCL and holds `{ pid, start, host, token, purpose, at }`,
`start` being the OS start time of the holder (`ps -o lstart=`). It is removed by another process only when provably stale:
same host and the PID is gone, or the PID is alive but started at another time (PID reuse). An empty lock older than 60 s
(crash between create and write) is also recovered; another host's lock never is. Release removes the lock only if it
still holds our token.
- `voice/.voice.lock` — one `generateVoice` per episode at a time, across processes (Studio, prepare-all, CLI, `bal make`).
  A second run waits 2 s, then fails with `VOICE_BUSY_MESSAGE` (409) before anything is paid. Dry runs take no lock.
- `scene-production.v1.json.lock` — `serialized` now uses the same lock (30 s wait); older `"<pid> <uuid>"` locks are still
  recognised by `lockOwnerIsDead`.
- `previews/.preview-index.lock/` — still a directory (older builds respect it), now with `owner.json`. Recovered when its
  writer is gone or its PID was reused, or when it has no owner file and is older than 10 minutes; a live one is waited
  for (15 s), then `PREVIEW_LOCK_BUSY`.
- The episode `busy` key (`app/server/extra.ts`) is also taken by «جهّز كل المشاهد» for its whole run (`startPrepareJob`
  in `app/server/prepare.ts`). The queue refuses to start while a render/make/package holds it; the episode render,
  make, package and DELETE refuse while it runs, naming it (`PREPARE_RUNNING_MESSAGE`).
- Host render slots (`hostSlots`, `src/render/pool.ts`): written atomically; `foreign()` removes only a dead process's
  slot (EPERM counts as alive) and an unreadable slot only after 60 s.

**Paid audio is never deleted by voice generation.** `voice/index.json` is re-read and merged before every atomic write
(only this run's scene ids are set or removed, so clips the sentence path wrote meanwhile survive). Audio no scene points
to is moved to `voice/superseded/` (`voice/superseded/parts/` for dafatir parts), and a file this run did not create and
that was written after the run started is left alone. Each clip is written atomically. Orphaned «أصلح الكلمة» files
(`<sentence>-frag-*.mp3`, `<sentence>-fix-*.wav` that `sentences.json` does not mention, older than 10 minutes) are moved
at Studio start to `voice/superseded/sentences/` (`src/voice/fragmentSweep.ts`).

**Atomic JSON state** (`src/io/atomicJson.ts`). `writeJsonAtomic` = temp file in the same folder, fsync, rename; used for
`plan.json` (`writePlanFile`), `voice/index.json`, `voice/parts/index.json`, `storyboard.json` and `review.json`. Readers
(`readJson` in `src/plan/io.ts`, the ledger reader) retry once on a parse error, then throw `JsonFileError` with an Arabic
message, which the API answers with 409 (also `LOCK_BUSY` / `EPISODE_BUSY`), not a raw 500. A damaged `review.json` is no
longer read as an empty ledger (a decision would have overwritten every review); `storyboard.json` stays fail-closed
(unapproved) when damaged.

**Drive `.part` files** (`src/io/partFiles.ts`). Temporary copies are named `.<name>.<host-tag>-<pid>-<uuid>.part`. Before
copying, a run removes only its own machine's parts whose process is gone, and untagged legacy parts older than a day.

**API hygiene.** JSON bodies are limited to 2 MB (`MAX_JSON_BODY_BYTES`); the three Base64 upload routes (slot media, scene
images, recitations) keep 180 MB. `/api/check` answers 400 for a non-string `text`. While owner notes wait to be sent,
`scheduleStudioNotesSync` retries every 10 minutes (one unref'd timer, cleared on success). Update refusals count files in
correct Arabic (`arabicCount`, `src/i18n/count.ts`).

Tests: `tests/voice-lock-robust.test.ts`, `tests/stale-locks-parts.test.ts`, `tests/robust-io-small.test.ts`,
`tests/sentence-voice-route.test.ts` (check/body limit, prepare-all vs DELETE/render, damaged plan → 409).

### Channel policy and API hygiene (D51)

- **Policy from `channel.json`, not the id.** `rules.sacredFigures` (unset → on wherever `faces` is not `false`) and
  `rules.documentProvenance` (explicit opt-in) drive `src/channel/productionRules.ts`. dafatir sets both; zubdat (faces
  allowed) now gets the sacred-figure check; balislam is unchanged. Test: `tests/studio-channel-production-rules.test.ts`.
- **No borrowed identity.** Unknown channels fall back to `templates/_neutral/` (script, research, grey identity) and to
  neutral art, prompts and PDF fonts. `createChannel` / `bal channel new` have no default `--from`; without it a channel
  starts from the neutral identity and `SAFE_NEW_CHANNEL_RULES` (no faces, no music, both checks on).
- **Owner for policy changes.** `PUT /api/channel`, `PUT /api/identity` and `POST /api/channels` call `assertSceneOwner`
  (`ownerRefusal` in `app/server/extra.ts`, the same loopback same-origin rule) and answer 403 otherwise.
- **Errors.** An unknown channel answers 404, a missing episode or file 404; every error text sent to the browser goes
  through `redactPaths` (`app/server/util.ts`), so no absolute path of the owner's machine leaves the server.
  Test: `tests/studio-policy-endpoints.test.ts`.

### Decision numbers (D51)

`D<n>` is global across `docs/*/0[67]-decisions.md` because the engine is shared. Take a number with
`npx bal decision new "<title>" [--log <channel>…]` (`scripts/decisions.mjs`): it scans every log and the commit messages
on `main`, `origin/main` and the current branch, and returns the maximum plus one. With `--log`, the first log gets the
definition heading and each further log a cross-reference heading that names the defining log's path
(`(D51، التعريف: docs/zubdat-alkutub/06-decisions.md)`). A heading with a `D<n>` and no decisions-log path is a
definition; the gate check «أرقام القرارات» (`node scripts/decisions.mjs check`, run by `scripts/gate.mjs`) and
`tests/decision-numbers.test.ts` fail when a number is defined twice. The historic duplicates D39, D41, D42 and D46
(one shared decision whose heading was copied into each log) are grandfathered in `GRANDFATHERED_DUPLICATES`, a list that
never grows.

### Publishing stays manual; approved files go to Google Drive (D53)

Publishing to YouTube and the other platforms is done by the owner by hand. Right after the publish permission is
recorded (same request, never before), `startDriveHandoff` (`src/package/driveHandoff.ts`) copies, in the background,
the exact approved files into the local Google Drive for desktop folder: `<My Drive>/balislam-publish/<channel>/<episode-dir>/`
(`~/Library/CloudStorage/GoogleDrive-*/My Drive` or `/Volumes/GoogleDrive/My Drive`; `BAL_DRIVE_PUBLISH_DIR` in `.env`
overrides it, `off` disables it; no auto-detection inside tests). Drive for desktop uploads the folder; no code uploads anything
and no platform API is used.

- Delivered: the Master, shorts in the same package made after this Master, thumbnails, `.srt` for the episode and each
  delivered short, `نشر.txt` (the publish kit itself with real-timing chapters) and `manifest.json` (names, sizes, sha256,
  Master sha256, approval and permission dates and ledger sequence numbers).
- Everything is checked before anything is copied: text through `assertNoTraces`, videos' tags plus file head/tail (encoder
  signatures, Remotion: proof that `cleanMetadata` ran), PNG text chunks, subtitle text.
- Copy = temp name in the target folder, size + sha256 verified, then rename. Reruns skip identical files (manifest size/mtime/sha,
  else re-hash), replace changed ones, and never delete other files. The last result is kept in `out/drive-handoff.json`.
- `GET /api/episodes/<ep>/publish-drive` (status, writes nothing), `POST …/publish-drive` (retry, owner session, 202; 409 with the
  Arabic message when there is no Drive folder), `POST …/publish-drive/open` (Finder on macOS, owner session).
- Not implemented: deleting the local copy after upload — the Studio cannot verify that Drive for desktop finished uploading.
- Tests: `tests/publish-drive-handoff.test.ts`, `tests/publish-drive-server.test.ts`.

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
