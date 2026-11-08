# Studio V2 Backend — HTTP / Render / QA Integration Contract

> **Draft / fail-closed.** This document belongs to Backend PR #88. Do not enable production,
> restart queued legacy jobs or publish on the strength of this contract alone.
>
> Base: PR #77, starting SHA \`2d6523d61ccbf6dc434f887bd0b7548a1acd1250\`.
> All examples use a server-resolved channel and a three-digit episode selector.

## Runtime prerequisites

Backend V2 is dispatched by \`app/server/api.ts\` only when \`STUDIO_V2_ENFORCE=1\`.
In this mode **all previous /api/* routes are deliberately locked** with HTTP 423. The existing UI
therefore cannot operate until the V2 UI team migrates it. Legacy HTTP queue recovery is suppressed,
but direct \`bal\`, Remotion and external writes are still not wrapped: this is a release blocker.

Server-only environment:
- \`STUDIO_V2_OWNER_ID\`: a stable owner ID, not supplied by the browser.
- \`STUDIO_V2_OWNER_SECRET\`: independent random secret (at least 32 bytes).
- \`BAL_WORKFLOW_HMAC_KEY\`: independent workflow HMAC secret (at least 32 bytes).
- \`STUDIO_V2_FFPROBE\`: absolute path to a real executable ffprobe.
- \`STUDIO_V2_ENFORCE=1\`: explicitly turn on this quarantined development mode.

Never commit these secrets or expose them to React / render output.

## Authentication contract (UI)

Loopback TCP and matching Host/Origin only. \`POST\`, \`DELETE\` and other writes require
\`Origin: http://localhost:<port>\`, \`Content-Type: application/json\`,
the \`studio_v2_sid\` HTTP-only SameSite=Strict cookie and \`x-studio-v2-csrf\`
(except login, which uses the secret and Origin but not an existing session).

\`\`\`http
POST /api/studio-v2/session
Content-Type: application/json
Origin: http://localhost:5173

{"secret":"<entered-by-owner>"}
\`\`\`

On 200, browser receives a cookie and body:
\`\`\`json
{"authenticated":true,"role":"owner","csrfToken":"<random>","expiresAt":"2026-..."}
\`\`\`

\`GET /api/studio-v2/session\` returns a matching session description and CSRF token.
\`DELETE /api/studio-v2/session\` signs out; it requires the CSRF header.

A server-derived \`ownerId\` is NEVER accepted in API bodies. No shortcut
for a localhost header, a client-provided \`role\`, or \`watched: true\`.

## Episode source signoff contract

Prefix \`/api/studio-v2/episodes/:NNN\`, with \`?channel=<id>\` as a **scope selector**,
not an actor or file path. Channel must be among the existing fixed Studio channels,
and backend verifies the episode's actual directory inside that channel.

\`GET /sources\`: returns:
\`\`\`json
{
  "script":{"fingerprint":"<sha256>","approved":false},
  "storyboard":{"fingerprint":"<sha256>","approved":false}
}
\`\`\`

\`POST /sources\`:
\`\`\`json
{"stage":"script","expectedFingerprint":"<sha256>","note":"Reviewed current script and references"}
\`\`\`
or stage \`storyboard\`. Strictly NO actor, evidence, manifest, path or hash field
other than the last observed \`expectedFingerprint\`. The backend checks actual
script parser, citation review, real plan errors, all storyboard visual hashes, and
owner audit note before saving a signed explicit V2 decision. The storyboard
cannot be approved until script was approved. Changes to script/review/plan/board
bytes or filesystem generation invalidate the signoff. This API does not create
or modify source files.

## Scene state / command contract

\`GET /scenes\` returns:
\`\`\`json
{
  "channel":"balislam",
  "episode":"001-example",
  "revision":0,
  "scenes":[
    {"id":"c1-s1","status":"draft","notes":[]},
    {"id":"c1-s2","status":"draft","notes":[]}
  ]
}
\`\`\`
Depending on on-disk state, a scene can additionally contain \`fingerprint\`,
\`approvedAt\`, and timestamped change notes. Supported statuses:
\`draft | prepared | producing | in_review | changes_requested |
approved | needs_reapproval\`. The authoritative order is taken from locked
\`plan.json\`, never from browser arrays.

\`POST /scenes/:sceneId/commands\` accepts ONLY these object keys:
\`action\`, \`expectedFingerprint\`, \`note\`, \`second\`, \`elementId\`,
\`reviewId\`. Scene ID is the route segment, NOT a writable body field.

Commands:
- \`{"action":"prepare"}\`: preliminary assets preparation status; DOES NOT render.
- \`{"action":"begin"}\`: starts a guarded **workflow transition** to producing; NOT a render process.
- \`{"action":"submit","expectedFingerprint":"<sha256>"}\`: requires a server-registered
  full scene manifest, current files, real valid AV MP4, and ffprobe verification.
- \`{"action":"request_changes","note":"At 00:07 voice is too fast","second":7}\`:
  marks this scene for correction; its previous approval must not silently revive.
- \`{"action":"approve","expectedFingerprint":"<sha256>","reviewId":"<id>"}\`:
  verifies actual current MP4 and independent session-bound completed AV review receipt
  under the same shared episode artifact lock.

Success is \`200 {"ok":true,"sceneId":"c1-s1","action":"begin"}\` etc.
Any final production transition for scene N+1 fails unless all prior scenes
have currently approved exact AV inputs. Approval is explicitly owner-only.

\`GET /assembly-eligibility\` either returns
\`{"sceneAssemblyFingerprint":"<sha256>"}\`, or fails closed. This is
only a prerequisite, NOT permission to create a Master or publish.

## AV review contract

1. After \`submit\`, \`POST /scenes/:id/review/start\`
   \`{"expectedFingerprint":"<sha256>"}\`. Response:
   \`{"reviewId":"<random>","challenge":"<random>","durationSec":12.2,
      "fingerprint":"<sha256>","mediaUrl":"/api/studio-v2/.../media?..."}\`.
2. The UI plays the exact returned scoped \`GET /scenes/:id/media?reviewId=...\`
   video, including audio at **1×**. Backend streams MP4 byte ranges and records
   actual ranges transmitted, bound to owner session, scene, MP4 hash+epoch.
3. During playback, POST \`/scenes/:id/review/:reviewId/tick\`:
   \`{"challenge":"<previous-challenge>","positionSec":1.0}\`.
   Server responds with \`{"challenge":"<new>","playedSec":1}\`. Seeking and
   acceleration cannot simply advance the receipt faster than wall clock.
4. After full viewing and entire MP4 byte-range coverage, POST
   \`/scenes/:id/review/:reviewId/finish\`
   \`{"confirmation":"reviewed_av"}\`. Completed receipt is time-limited.
5. Owner explicitly sends \`approve\` with the same scene fingerprint and reviewId.

This **does not cryptographically prove the human's attention**, even if it
prevents fake booleans, stale scene IDs, stale MP4 bytes and obvious skipping.
The final release requires independent creative/rights review and real-device smoke.

## Render team: mandatory server-side handoff

\`src/workflow/sceneManifestRegistryV2.ts\` exports
\`registerRenderedSceneManifestV2(scope, manifest, withArtifactLock)\`.
It must be invoked from the trusted render worker, NOT HTTP, and never from React.

Manifest shape (all nine input keys are mandatory, every file path server-owned):
\`\`\`ts
type SceneFileManifestV2 = {
  sceneId: string;
  audioMode: "silent" | "narrated" | "recitation" | "mixed";
  inputs: Record<
    "original" | "vocalized" | "tone" | "storyboard" | "assets" |
    "narration" | "sync" | "video" | "rights",
    {version:string; files:readonly string[]}
  >;
  shared: Record<string,{version:string;files:readonly string[]}>;
}
\`\`\`
Mandatory: \`original.files\` includes \`script.md\`, \`storyboard.files\`
includes \`plan.json\`, \`video.files\` has exactly one real, episode-owned
composited MP4. Narrator/recitation requirements are derived from locked plan.
A silent scene uses empty narration files rather than fake MP3. Human Quran
recitation provenance and rights require distinct independent verification.

**Lock order:** shared episode artifact mutex -> V2 ledger lock; never vice
versa. The render process MUST guard actual reads/writes of script/plan/audio/
assets/video and register only after successful output. The manifest registry
signature itself does not authenticate the worker; only privileged server code
may invoke it. Reject queued stale jobs again at execution/recovery, and never
carry forward a prior scene decision as a current approval.

## API failure codes

All V2 failures are JSON: \`{"ok":false,"code":"...","message":"..."}\`.
Generally:
- 400 \`V2_INVALID_JSON\`, \`V2_OBJECT_REQUIRED\`, \`V2_FORBIDDEN_FIELD\`,
  \`V2_EPISODE_SCOPE_INVALID\`, \`V2_REVIEW_ID_REQUIRED\`.
- 401 \`V2_BAD_CREDENTIALS\` or \`V2_SESSION_REQUIRED\`.
- 403 \`V2_ORIGIN_REQUIRED\`, \`V2_CROSS_ORIGIN_REJECTED\`,
  \`V2_LOOPBACK_REQUIRED\`, \`V2_CSRF_REJECTED\`.
- 405 \`V2_METHOD_NOT_ALLOWED\` on session route.
- 409 \`V2_GATE_REJECTED\`, \`V2_REQUIRED_ARTIFACT_MISSING\`.
- 413 \`V2_BODY_TOO_LARGE\`; 415 \`V2_JSON_REQUIRED\`.
- 423 \`V2_ARTIFACT_BUSY\` or \`V2_LEGACY_ENTRYPOINT_LOCKED\`.
- 429 \`V2_LOGIN_RATE_LIMIT\`, \`V2_SESSION_LIMIT\`.
- 503 \`V2_OWNER_CONFIGURATION_REQUIRED\`, \`V2_FFPROBE_NOT_CONFIGURED\`,
  \`V2_BACKEND_NOT_READY\` or \`V2_NOT_ENFORCED\`.
No raw server exception, signing secret, manifest path or hashed input is
serialized to the browser.

## QA owner: acceptance checklist

1. Real HTTP session/login/CSRF + forbidden fields; loopback, Origin/Host,
   nested cookie scope, size limits, stale sessions, reviewer role spoof.
2. Cross-process lock, crashed owner/stale lock, symlink, foreign channel/
   episode, forbidden path and current owner signoff.
3. Explicit source signoff then change script, review.json, plan.json,
   storyboard.json; verify invalidation including edit-then-byte-restore.
4. Render manifest signature tamper; non-AV MP4 and wrong audio policy;
   human recitation and rights reviewed independently.
5. Watch full real AV in 1× on Mac and browser; test random range requests,
   skipping, response truncation, end-of-file, stale video replacement,
   duplicate approvals, queue and CLI bypass.
6. All existing W01–W13 legacy HTTP/CLI/worker/writer entrypoints.
7. Master candidate, full episode 1× review, exact Master owner approval and
   sealed publication copy are intentionally **not wired** in this PR.
8. Check \`npm run typecheck\`, \`npm test\`, \`npm run gate\`, actual FFmpeg/
   FFprobe and browser smoke against the **final SHA**.

Do not report Completed for release while legacy CLI/direct render/queue writer
bypasses or Master/publish gates remain unprotected.
