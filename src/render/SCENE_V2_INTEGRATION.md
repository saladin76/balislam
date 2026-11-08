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
  duration, gain 0–1. Narration requires actual per-word start/end seconds
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
  elapsedMs, diskFreeBeforeMB, diskFreeAfterMB, inputSha256,
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
to the MP4 before owner approval.

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
