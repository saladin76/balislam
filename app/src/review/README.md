# Studio V2 — UI & Review Handoff Report (technical contract)

**Branch:** `work/studio-v2-ui-20261108`  
**Base commit:** `2d6523d61ccbf6dc434f887bd0b7548a1acd1250`  
**Status:** new interface implemented, Backend adapter **not connected**. Never describe the QA fixture as an approval.

## Implemented surface

- The episode editor has **مراجعة الفيديو V2**, opening the isolated `SceneReviewWorkspace`.
- Large native HTML5 MP4 player with audio, seek, fullscreen, rate control, ±5 sec, actual time display. A Remotion animation preview **does not** become an AV review video.
- Ordered scene list with explicit states matching `src/workflow/sceneV2.ts`, including `needs_reapproval`.
- Right-side script/silence, storyboard, art direction, camera, transition, timing, element and version inspectors.
- Second- or element-bound notes; current-version-only MP4; descriptive version comparison.
- Fail-closed disabled decisions with visible reasons, refresh/version-change warning, error/offline and missing/broken media states.
- Standalone QA React page `/scene-review-qa.html` with obviously fictional text and optional generated test MP4. QA notes are browser-local; approval and change decisions remain disabled.
- Client playback telemetry has event type, sequence, session, version, position, duration, rate. **Play/ended/seek events are not proof**; the server verifies evidence.

## Backend API contract — not implemented in this branch

Use the current authenticated owner session (cookies with CSRF protection, no actor ID from the browser), same-origin responses, and current locked render artifacts. The client assumes:

1. `GET /api/studio-v2/channels/:channelId/episodes/:episodeId/scene-review` returns the **server-verified** ordered scene snapshot below; no cached or stale approvals.
2. `POST .../scene-review/scenes/:sceneId/playback-events` accepts telemetry fields only: `sceneId,versionId,sessionId,sequence,kind,positionSec,durationSec,playbackRate`. Idempotent sequences and receipt storage must be tied to authenticated owner, currently probed MP4 and current scene fingerprint. Do **not** accept a client-provided `watched`, `approved`, `complete`, `proofValid` or completion percentage as authority. Validate chronological, bounded and plausible playback, paused time, seeking, rate, and version-change invalidation.
3. `POST .../scene-review/scenes/:sceneId/notes` accepts `versionId,expectedFingerprint,text,second?,elementId?`. Server validates version identity and persists author/timestamp from session and trusted clock.
4. `POST .../scene-review/scenes/:sceneId/decisions` accepts `action: "approve"|"request_changes",sceneId,expectedFingerprint,note?,second?,elementId?`. Backend independently checks source bytes under the writer lock, secure owner authentication, preceding scene approval, valid MP4 and owned AV viewing proof. The `expectedFingerprint` is concurrency precondition **not** evidence. For `request_changes`, require meaningful note. Return success or conflict, and the UI re-GETs authoritative state.
5. The MP4 `video.url` MUST be a **same-origin**, authenticated, read-only, byte-range-capable endpoint with `Content-Type: video/mp4`, 206 support, safe path resolution, no arbitrary local path and no untrusted redirect. e.g. `/api/studio-v2/media/scenes/c1-s1/versions/v2.mp4`. Validate SHA and epoch on the server; invalidate stale links if bytes change.

**Example GET response** (illustrative only, NOT an existing endpoint):

```json
{
  "channelId": "balislam",
  "episodeId": "001-example",
  "revision": 12,
  "order": ["c1-s1", "c1-s2"],
  "scenes": {
    "c1-s1": {
      "id": "c1-s1",
      "status": "in_review",
      "currentVersionId": "av-v2",
      "versions": [
        {
          "id": "av-v2", "label": "V2",
          "fingerprint": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "createdAt": "2026-11-08T07:00:00Z",
          "video": {
            "url": "/api/studio-v2/media/scenes/c1-s1/versions/av-v2.mp4",
            "mime": "video/mp4", "durationSec": 8.4, "width": 1920, "height": 1080, "hasAudio": true
          },
          "changes": [{"field": "Camera", "before": "Pan", "after": "Static"}]
        }
      ],
      "notes": [{"id": "note-1", "versionId": "av-v2", "text": "حركة سريعة", "second": 3.2, "elementId": "camera", "createdAt": "2026-11-08T07:05:00Z"}],
      "permissions": {
        "approve": false, "requestChanges": true,
        "reasons": ["لم يكتمل دليل المشاهدة المعتمد على الخادم."]
      }
    },
    "c1-s2": {
      "id": "c1-s2", "status": "prepared", "currentVersionId": null,
      "versions": [], "notes": [],
      "permissions": {
        "approve": false, "requestChanges": false,
        "reasons": ["المشهد السابق لم يعتمد بعد.", "ملف MP4 غير متاح."]
      }
    }
  }
}
```

Note: the UI currently applies conservative blockers also to Request Changes (requires a playable current MP4) and never silently enables an action the server disallows. A future backend may expose per-action `reasons` to improve copy.

Server errors: 401 unauthenticated, 403 unauthorized, 404 missing scope/video, 409 stale version/dependency/invalid proof, 422 invalid note, 429 rate limit and 5xx service failure. On any uncertain response, disable approval and instruct refresh. Do not reuse legacy `/api/episodes/:episode/scene-review` as V2 evidence; it is a separate plan ledger.

## Mac QA worktree — no production episodes modified

```bash
cd ~/balislam
git fetch origin work/studio-v2-ui-20261108
git worktree add --detach ~/studio-v2-ui-qa-20261108 origin/work/studio-v2-ui-20261108
cd ~/studio-v2-ui-qa-20261108
npm ci
npx tsc --noEmit -p .
npx vitest run -c app/vitest.review.config.ts
npx vitest run
mkdir -p app/qa-artifacts
# Optional, synthetic QA-only clip, deliberately untracked:
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i testsrc2=size=1280x720:rate=30 \
  -f lavfi -i sine=frequency=220:sample_rate=48000 \
  -t 8 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest \
  app/scene-review-qa.mp4
npm run app -- --port 4322
```

Visit `http://127.0.0.1:4322/scene-review-qa.html` (explicit QA mode).
For screenshots **from the running actual React component**, with the server still running:

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --no-first-run \
  --window-size=1600,1050 --virtual-time-budget=4500 \
  --screenshot="$PWD/app/qa-artifacts/scene-review-desktop.png" \
  http://127.0.0.1:4322/scene-review-qa.html
"$CHROME" --headless=new --disable-gpu --no-first-run \
  --window-size=390,844 --virtual-time-budget=4500 \
  --screenshot="$PWD/app/qa-artifacts/scene-review-mobile.png" \
  http://127.0.0.1:4322/scene-review-qa.html
```

Run additional manual checks on Mac for keyboard, Arabic joins, 200% zoom, screen reader roles, slow network, MP4 decoding failure (rename QA fixture), scene changes, second-bound notes, status text without color, and no network approvals in QA.

**Important:** screenshots become report evidence only **after commands actually run and generated paths are verified**. This document is not itself screenshot evidence.

## Remaining integration / verification

- Trusted Backend API and owner AV proof verifier, real hashes and release gates — Backend-owned.
- Backend must provide fuller storyboard camera/timing metadata rather than the current plan's best-effort props.
- No production MP4 was provided or accessed by this branch; real episode AV playback and approval are untested.
- Mac full application TypeScript, test suite, Chromium screenshots and visual a11y checks still need recorded logs, unless linked CI results explicitly verify them.
