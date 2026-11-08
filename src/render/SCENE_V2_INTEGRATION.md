# Studio V2 — Scene Render / Backend integration contract

This module is **scene production**, not owner review, source approval or
publishing. `renderSceneV2(request, backendAdapters)` is the only new render
entrypoint. It returns a discriminated job outcome and never modifies
`src/workflow/`, a channel's script/plan, previously rendered MP4s, or PR #77.

## Trusted request (Backend server only)

- `channelsRoot`, `channel`, `episode`, `sceneId`: server-owned scope;
  `channelsRoot/<channel>/episodes/<episode>/plan.json` must exist.
- `planSha256`: SHA-256 **of the exact plan.json bytes**, including formatting;
  checked immediately before render and immediately before publication.
- `mode`: `silent | narrated | recitation | mixed`, derived from the pinned
  scene's narration and `ayahKey`. A silent scene gets **no fake MP3**.
- `orientation`, `width`, `height`, `fps: 30`, `durationSec`: 30 FPS and
  even dimensions 320–3840 are currently supported; audio always extends
  duration instead of being cut off.
- `sounds[]`: explicit episode-owned file path, SHA-256, kind
  (`narrator | recitation | sfx`), start in scene seconds, measured audio
  duration, gain 0–1. Every SFX needs `cueId` matching the locked\n  Storyboard SFX identifier and start time. Narration requires actual per-word start/end seconds
  and a sequence matching the locked scene text. The renderer does not call
  ElevenLabs, create silent audio, or retrieve Quran.
- `recitationEvidence`: required for recitation/mixed; origin must be
  `owner-upload`, the SHA-256 must match the recitation file, and `recordId`
  must refer to a provenance record checked by **Backend**
  `assertCanRender`. The renderer cannot independently authenticate a human
  reader or validate recitation rights from a filename.
- `pictures[]`: explicit episode-owned, pinned image paths and the exact
  `image`, `image2`, `image3` references from the Storyboard. Preparation
  of other shared assets and rights verification are Backend responsibilities.
- `channelInfo` / `identity`: optional channel styling props (trusted).

**Important:** Do NOT bind these paths, signoffs or recitation provenance
directly from a browser JSON request.

## Required Backend adapters

```ts
await renderSceneV2(serverBuiltRequest, {
  ffprobeBinary: "/absolute/trusted/ffprobe",
  browserExecutable: "/absolute/path/to/Chrome", // optional, no client control
  signal: jobAbortController.signal,
  onProgress: fraction => reportProgress(fraction),
  withProductionLease: (sceneId, work) => distributedLease(scope, sceneId, work),
  withArtifactLock: work => sharedWorkflowArtifactWriterLock(scope, work),
  assertCanRender: async (request) => {
    // Re-check prior scene AV approval, locked original script,
    // approved Storyboard, selected revision/rights and revocation.
    // MUST reject approved current scene until its approval is invalidated.
  },
});
```

- `withProductionLease` holds a **distributed exclusive** final-render lease
  for the selected scene throughout this call. No other final scene may start
  unless the preceding scene has a current owner approval.
  Asset preparation may run independently in parallel.
- `withArtifactLock` is the **same lock** used by V2 approval and episode
  editors; held during initial validation and atomic publication, not during
  the expensive render. `assertCanRender` is re-executed at both checkpoints.
- UI/Backend MUST NOT infer `watched`, `approved` or `submitted` from a
  successful render. Use existing V2 current-AV-submission and real
  owner-review checks under that same lock.
- Current runtime limits actual renders to one per Node process; distributed
  workers still require the Backend production lease and global capacity
  policy. The module refuses preflight if available memory is under 1.8 GB
  or free disk is under 1 GB + 2× staged inputs. This is a conservative
  preliminary guard, not a complete global resource manager.

## Result & lifecycle

Successful return:

```ts
{
  status: "succeeded", jobId, sceneId, planSha256,
  file, relativeFile, sha256, bytes,
  width, height, fps, frames, durationSec,
  videoCodec, audioCodecs, audioStreams,
  elapsedMs, memoryAvailableBeforeMB, memoryAvailableMinMB,\n  sync, diskFreeBeforeMB, diskFreeAfterMB, inputSha256,
  reviewStatus: "not_submitted"
}
```

The output is an immutable, uniquely named
`previews/<scene>-<planHash12>-<jobUuid>.mp4`, accompanied by
`<name>.mp4.json`; both are inside this episode.
Publication uses an exclusive hard-link (`EEXIST` fails, **never rename
over** an approved/previous MP4). The caller persists this result in Backend
and creates a review submission only after the existing V2 MP4 verifier
re-hashes these exact bytes.

Failed or cancelled:

```ts
{ status: "failed" | "cancelled", jobId, sceneId, elapsedMs,
  reason, retryable }
```

- Retry is an entirely new job ID and unique output location, never
  overwriting a previous revision. Backend owns retry scheduling and attempt
  history.
- Cancellation through `AbortSignal` is checked before bundling, after
  bundling, and passed to Remotion's render cancellation signal.
  Bundling itself may need to finish before cancellation is observed.
- Per-run staging lives under `public/_studio_v2/run-*`; temporary
  bundle/MP4 under `<episode>/.studio-v2-render/run-*`. Both are removed
  after success, failure and cancellation. Shared parent dirs are not deleted.
  No other episodes or global `/tmp` directories are scanned/deleted.
  Browser-internal scratch outside these paths requires a separate Mac
  leak audit before signoff.

## Synchronization and QA rules

Narration word boundaries use measured timestamps (seconds) from the actual
narrator clip, shifted by clip start and quantized to video frames; scene
elements that use `SceneFromPlan` word timing receive these exact positions.
Recitation is **only** an owner-supplied file, starts at its specified time,
and cannot overlap the narrator in mixed mode. SFX use explicit event times.
For a Quran verse, `ayahKey` and actual locked Quran text are required;
the existing VerseCard presents text when recitation is present.

FFprobe validates actual output H.264/AAC (when sound exists), stream count,
dimensions, frame rate, frame count, and duration. Output and input
SHA-256 are recomputed. Technical frame/audio timing checks are **not**
proof of semantic word alignment, Arabic font glyph quality, pleasing
motion or genuine Quran recitation. Review extracted frames and listen
to the MP4 before owner approval. The `sync` return reports scheduled\nevent frames, source word count, frame rounding error and mux audio start;\nit is **not** proof of semantic AV synchrony.

## Test instructions

```bash
npm run typecheck
npx --no-install vitest run tests/render-scene-v2.test.ts

# Real Remotion + synthetic TECHNICAL tone (not narration):
STUDIO_V2_REAL_RENDER=1 \
 STUDIO_FFMPEG_BIN=/opt/homebrew/bin/ffmpeg \
 STUDIO_FFPROBE_BIN=/opt/homebrew/bin/ffprobe \
 REMOTION_BROWSER_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 npx --no-install tsx tests/render-scene-v2-av-smoke.ts
```

Real smoke uses a brand-new isolated test episode, renders silent and
tone-backed AV test scenes, validates MP4 with FFprobe, decodes it via
FFmpeg and extracts a still for Arabic text inspection. It cleans its
workspace. It does **not** simulate human narration/recitation or owner
viewing. Tests should only run after checking local disk/RAM availability.

## Explicit pending work for other owners

Backend: implement the trusted adapter (shared lock, approved Storyboard,
prior scene gating, audio provenance and durable task/attempt records).
Workflow: accept `relativeFile` + `sha256` and probe under its existing
writer lock before review submission; invalidate approvals before a new
production revision. UI: surface real MP4 preview and timestamps, record
owner viewing and separate owner approval. No changes to these modules
are made in this PR.

## Phase 2 — exact Backend PR #88 manifest handshake (Issue #89)

Backend PR #88 defines a signed **nine-input** `SceneFileManifestV2`
registry. The Render result's adjacent `.mp4.json` is **not** a signed
registry, and MUST NOT be treated as an approved/reviewed scene. A real
integration checkout containing both Draft PRs must provide:

1. A trusted, server-built `SceneRenderRequestV2`, derived from the locked
   plan and approved script/Storyboard (no browser-controlled paths/hashes).
2. The Backend episode artifact mutex and durable scene production lease.
3. `onPublishedLocked(request, renderResult)`, which runs **inside** the
   renderer's existing artifact mutex and lease, immediately after an
   immutable MP4 and unsigned report are staged.
4. In that callback, supply eight server-owned, exact-versioned source file
   sets: `original`, `vocalized`, `tone`, `storyboard`, `assets`,
   `narration`, `sync`, `rights`. Then call
   `verifySceneV2ForBackendManifest(request, renderResult, sources, shared,
   ffprobe)` from `src/render/sceneV2Handoff.ts`. This verifies the actual
   bytes, MP4 codecs/frame count, selected source files and audio provenance
   paths. This helper is not a signer.
5. Call **`registerRenderedSceneManifestLockedV2(scope, manifest)`**
   (from Backend PR #88 `src/workflow/sceneManifestRegistryV2.ts`) inside
   that **same** lock; never call the wrapping
   `registerRenderedSceneManifestV2` there, as it would reacquire the mutex.
   Backend remains solely responsible for the HMAC/signature.
6. Return success only after registration. Next, independently project and
   verify the current signed manifest/MP4 under the Backend scene gate; a
   separate explicit owner submission/review/approval follows.
7. In `STUDIO_V2_ENFORCE=1`, renderer rejects production unless the
   `onPublishedLocked` callback exists. When registration fails, its
   newly linked MP4 and sidecar are rolled back; neither pre-existing outputs
   nor other scenes are removed. Backend should also make registrations
   transaction-safe and fail-closed after a partial server error.

Example **inside the trusted worker** (not an HTTP/client callback):

```ts
import { verifySceneV2ForBackendManifest } from "./sceneV2Handoff";
// From integrated Backend PR #88:
// import { registerRenderedSceneManifestLockedV2 } from "../workflow/sceneManifestRegistryV2";

const backendAdapters = {
  ffprobeBinary: absoluteFfprobeFromServer,
  withProductionLease: async (sceneId, job) => productionLease(scope, sceneId, job),
  withArtifactLock: async (job) => episodeArtifactMutex(scope, job),
  assertCanRender: async (req) => verifyCurrentLockedSourceGate(scope, req),
  onPublishedLocked: async (req, result) => {
    const sets = await deriveCurrentApprovedServerFileSets(scope, req);
    const verified = await verifySceneV2ForBackendManifest(
      req, result, sets.inputs, sets.shared, absoluteFfprobeFromServer
    );
    await registerRenderedSceneManifestLockedV2(scope, verified.manifest);
    // Do NOT transition the scene to in_review/approved here.
  },
};
```

This example identifies interfaces Backend **must implement**, not working
imports in Render's independent PR. Exact file-set versions, provenance
records, rights assessment and source signoff are Backend responsibilities.
`narration.files` is empty for honest silence, otherwise contains the exact
episode-relative voice/recitation assets. The current signed Backend policy
supports `voice/*.{mp3,wav,m4a}` and
`recitations/*.{mp3,wav,m4a}`; other renderer input extensions may require
a Backend policy update before they can be registered.

### Real Remotion evidence, not a synthetic FFmpeg claim

A dedicated Draft PR #86 CI test executes the actual
`studio-v2-scene` composition via Remotion and renders both an honest
silent scene and an AAC technical-tone scene. Actual native 1920×1080
smoke, full FFmpeg decode, FFprobe frame count/codecs, separate beginning
and middle extracted images, SHA-256, system available-memory samples and
owned-temp directory cleanup are logged. The technical signal is neither
human narration nor Quran recitation. Review the screenshots and listen to
the videos independently; no automatic human/owner approval is generated.

For Mac, **run serially only after RAM/disk preflight**:

```bash
STUDIO_V2_REAL_RENDER=1 \
STUDIO_V2_QA_WIDTH=1920 STUDIO_V2_QA_HEIGHT=1080 \
STUDIO_FFMPEG_BIN=/opt/homebrew/bin/ffmpeg \
STUDIO_FFPROBE_BIN=/opt/homebrew/bin/ffprobe \
REMOTION_BROWSER_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
npx --no-install tsx tests/render-scene-v2-av-smoke.ts
```

CI and Mac resource figures are environment-specific. `memoryAvailableMinMB`
is the minimum observed **system available memory**, not full process-tree
peak RSS. `diskFreeAfterMB` is sampled before the final removal of staging,
so it is not the final disk leak measurement. The isolated smoke explicitly
checks that its staging directories are empty after the renderer returns;
Chromium private scratch outside those paths remains a separate audit.
Even if full decode and two frame hashes pass, human smooth-motion/Arabic
and audio listening review remain distinct gates.
