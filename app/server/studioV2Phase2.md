# Studio V2 Phase 2 — Backend/UI/Render authoritative integration contract

**Scope:** Backend PR #88 (Draft), issue #89. This is an implementation contract,
not a claim that the independent Render PR #86 or UI PR #87 has merged.

## Browser/API — owner only, loopback only

All writes require the server-issued HTTP-only `studio_v2_sid` cookie,
matching `Origin` and `Host`, `content-type: application/json`, and
`x-studio-v2-csrf` returned from the authenticated session endpoint. **Never**
send a client actor, role, MP4 hash/path, asset path, `approved`, or `watched`
as an authorization claim.

- `POST /api/studio-v2/session` body `{"secret":"<owner-secret>"}`: owner cookie, CSRF token.
- `GET /api/studio-v2/session`: session and CSRF refresh.
- `DELETE /api/studio-v2/session`: requires CSRF; destroys session.
- `GET /api/studio-v2/episodes/:NNN/sources?channel=balislam`: exact signed source fingerprints and approval state.
- `POST .../sources`: `{"stage":"script"|"storyboard","expectedFingerprint":"sha256","note":"meaningful owner signoff"}`. Stage checks are server-derived.
- `GET /api/studio-v2/episodes/:NNN/scenes?channel=balislam`: `{channel,episode,revision,sourcesReady,scenes:[{id,status,fingerprint,currentVideo?,blockers,approvedAt?,notes:[{text,at,second?,elementId?,fingerprint?,videoVersion?,videoSha256?}]}]}`. `currentVideo` exposes only version/job ID, SHA/epoch, dimensions, duration, hasAudio; no private filesystem path. `blockers` is server-generated.
- `POST .../scenes/:id/commands`: `{"action":"prepare"|"begin"|"submit"|"approve"|"note"|"request_changes",...}`.
  - `note`: `{"action":"note","expectedFingerprint":"current-scene-sha256","note":"...","second":1.25,"elementId":"shot-1"}`; verifies exact current AV under the writer mutex and signs a durable annotation bound to server-observed fingerprint, video revision and SHA, **without any approval or status change**.
  - `request_changes`: same mandatory `expectedFingerprint` plus optional timecode/element fields; rejects stale AV first, persists exact video version binding, then changes scene state and revokes its approval.
  - `begin`: explicitly opens final production only with current approved script/Storyboard and all earlier scenes approved.
  - `submit`: `{"action":"submit","expectedFingerprint":"sha256"}`. Revalidates signed render receipt from *current* `begin`, current source approvals and actual MP4 via FFprobe.
  - `approve`: `{"action":"approve","expectedFingerprint":"sha256","reviewId":"48-hex"}`. Revalidates completed independent server-side playback receipt and current signed AV bytes/epoch. Client flags are forbidden.
- `POST .../scenes/:id/render` (new): `{"expectedRevision":123}`. No other fields. Requires an already authorized `begin` and **server-authored signed render spec**. Returns `{ok:true,sceneId,status:"rendered",fingerprint,video:{version,sha256,epoch,width,height,durationSec,hasAudio}}`. No approval is granted. If PR #86 module is absent, returns **503 V2_RENDER_ENGINE_UNCONNECTED**, never legacy render.
- `POST .../scenes/:id/review/start`: `{"expectedFingerprint":"sha256"}`; returns reviewId/challenge/durationSec/mediaUrl.
- `GET .../scenes/:id/media?channel=balislam&reviewId=...`: cookie-bound MP4 byte ranges; backend checks exact current media and records only served byte ranges.
- `POST .../scenes/:id/review/:reviewId/tick`: `{"positionSec":1,"challenge":"prior-response-challenge"}` with bounded real wall-clock progression; returns a new challenge.
- `POST .../scenes/:id/review/:reviewId/finish`: `{"confirmation":"reviewed_av"}`; HMAC-signed durable audit receipt. Follow with explicit `approve`; `finish` alone does not approve.
- `GET .../assembly-eligibility`: fails if current source approvals or any exact scene approval are missing. **No Master or publish endpoint is opened.**

Known errors: 400 invalid/extra fields; 401 no session; 403 Origin/CSRF;
409 stale revision/changed fingerprint/gate; 423 file mutex busy;
503 missing Render module or trusted media tools. UI must show a blocked
state and re-fetch server state after conflicts, never invent approval.

## Render / worker contract

PR #86 owns `src/render/sceneV2.ts` and its Remotion composition. Backend
**does not copy it or silently substitute old render paths**.

The production worker must first create a **signed, server-only** config via
`writeTrustedSceneRenderSpecLockedV2(scope, spec)` while holding
`withSceneArtifactLockV2`, after explicit source signoffs. Config names exact
episode-owned input files, real audio SHA, word timing, pinned SFX/image
references, nine manifest groups (video files initially empty), and verified
owner-upload Quran provenance (where applicable). It is *not* an HTTP input.

`runTrustedSceneProductionV2(scope, id, {renderer:renderSceneV2,
ffprobeBinary, verifySourceReview, verifyRecitationProvenance?})` then:

1. Takes `withSceneProductionLeaseV2` for the entire job plus post-render handoff;
   cross-process exclusive, no stealing dead/foreign locks.
2. Takes `withSceneArtifactLockV2` for preflight, source approval and exact
   source-file sha+epoch snapshots, current scene `producing`, predecessor
   signed MP4/current AV approvals. Future **assets** may be prepared; final
   N+1 cannot start without current N signoff.
3. Builds `renderSceneV2(request, backendAdapters)` entirely from signed
   server spec + current locked `plan.json`. `assertCanRender` verifies
   all source file bytes **and filesystem epochs** at both Render checkpoints.
4. Uses PR #86's `onPublishedLocked(request,result)` callback while
   holding **that same artifact mutex and production lease**, immediately after
   the renderer links its immutable MP4 and writes its per-job report.
   The trusted `verifySceneV2ForBackendManifest` from
   `src/render/sceneV2Handoff.ts` independently checks the H.264/AAC streams,
   exact output bytes and server-signed eight source file sets. Backend then
   registers the nine-group signed Render Manifest, probes with trusted FFprobe,
   and commits a **signed current production receipt** tied to the owner
   `begin` event. All of this happens **before** Render reports success.
5. The bridge refuses `succeeded` if its callback did not sign this same
   job ID and SHA; on any callback error, PR #86 must roll back only this
   invocation's newly published MP4. A separate authenticated `submit`
   rechecks the signed current-generation receipt. Then `review/start` →
   actual media → time checkpoints → `finish` → owner `approve`.
6. Output is **never automatically reviewed, approved, assembled or published**.

**Render hard-link callback fix now present in PR #86:** its current
`src/render/sceneV2.ts` removes only its own temporary hard-link alias
before invoking `onPublishedLocked`, and verifies the published MP4 has
`nlink===1`. This resolves the earlier static mismatch with Render's
`verifySceneV2ForBackendManifest`, but **a combined real Remotion +
Backend acceptance run has not been executed**. Backend does not weaken
file/symlink safety or edit Render-owned files.
Render handoff's media version is `sha256:<digest>`; Backend deliberately
uses the actual unique Render `jobId` as its signed revision after
independently verifying the handoff's SHA and path.

Currently `verifyRecitationProvenance` is deliberately NOT configured by
the HTTP endpoint: mixed/recitation production fails closed until the trusted
owner-upload rights/provenance checker is delivered.

**Do not register an old preview or a browser-supplied Render result.** Queue
dequeue, retry and recovery must call the same bridge at execution time.
There is no V2 final-render queue in this Backend PR, so the V2 route runs
synchronously; legacy queued processes and direct CLI/Remotion exports are
**NOT yet secured** by this branch and remain P0 blockers. In opt-in
`STUDIO_V2_ENFORCE=1`, legacy HTTP API routes are quarantined, not upgraded.

## Verification and explicit limits

- Mandatory CI includes a **real FFmpeg-generated MP4** and the actual
  signed Backend render/manifest/probe/owner-receipt/approval/next-scene
  sequence in `tests/studio-v2-backend-real-integration.test.ts`. The
  fixture renderer is intentionally **not** the Render PR #86 engine.
- Opt-in **actual Remotion** composite test uses
  `STUDIO_V2_REAL_RENDER=1` with `tests/studio-v2-backend-real-integration-smoke.ts`
  *after* PR #86's files are overlaid in a throwaway worktree. It imports
  PR #86's exact `renderSceneV2`; missing files fail, never fall back.
- No test can cryptographically prove a real owner's attention. Simulated
  review checkpoints verify technical enforcement only; an independent owner
  and Chrome real 1× E2E are still required.
- No automatic publish, new Master approval, direct CLI or recovered queue
  bypass protection is claimed. Those are still blocked by issue #89.

See issue #89 for the full cross-team release acceptance matrix.
