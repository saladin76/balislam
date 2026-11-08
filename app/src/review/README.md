# Studio V2 — Real Backend UI Integration (Task 07)

PR #87 uses the actual Backend PR #88 API. Both remain independent Draft PRs. Coordination: https://github.com/saladin76/balislam/issues/89

## Live entry and owner sign-in

- Open http://127.0.0.1:4322/scene-review-v2.html?channel=balislam&episode=001 against a COMBINED Backend/UI isolated checkout with STUDIO_V2_ENFORCE=1.
- The old Studio editor still calls legacy APIs that Backend V2 intentionally locks with HTTP 423. The standalone V2 entry avoids that dependency.
- GET/POST/DELETE /api/studio-v2/session uses Backend owner auth; the browser holds a scoped HttpOnly cookie; CSRF is kept only in memory and sent in x-studio-v2-csrf on writes. Never persist or log the owner secret.

## Backend API mapping (all episode routes append ?channel=<id>)

- GET /api/studio-v2/episodes/:NNN/scenes — canonical scene order/status/fingerprint plus Backend Phase2 currentVideo {version,sha256,epoch,width?,height?,durationSec?,hasAudio?}, blockers[], sourcesReady, and saved timecoded notes. No MP4 URL is returned until review/start.
- GET /api/studio-v2/episodes/:NNN/sources — owner-approved script and storyboard state.
- POST /scenes/:id/review/start — only expectedFingerprint; response gives reviewId, rotating challenge, exact media URL and duration.
- GET /scenes/:id/media?channel=<id>&reviewId=<server-id> — authenticated byte-range AV from Backend.
- POST /scenes/:id/review/:reviewId/tick — challenge + actual positionSec, rotated by Backend, sequential only.
- POST /scenes/:id/review/:reviewId/finish — confirmation reviewed_av, not self-reported watched=true.
- POST /scenes/:id/commands — explicit approve with expectedFingerprint and server reviewId; independent note action with {note,second?,elementId?}; or request_changes that also changes state. The UI sends expectedFingerprint as a concurrency hint, but Backend must revalidate under lock. No browser-supplied owner identity.

Local playback at 1× invalidates on seek, speed change, mute, network tick failure or media error. Only server-confirmed finish enables the explicit approve button; Backend independently validates current AV bytes and evidence.

## Important limitations / Issue #89

1. Backend Phase2 now supports a real independent note action. The UI saves notes through /scenes/:id/commands action note, without changing scene status. However the current note/request_changes implementation does not compare expectedFingerprint under the artifact lock or return a note's historical version binding. The UI preflights a fresh fingerprint but cannot eliminate the server-side race; tracked in Issue #89.
2. GET /scenes now returns the current signed video version, media facts and authoritative blocker keys; these are displayed. It still does not return historical media diffs, per-action permission flags or script/Storyboard/narration details for the standalone page. No invented audio silence or older version is displayed.
3. No real Render/Backend combination is installed by this UI-only PR. A properly registered MP4, approved sources, actual full 1× playback, Media Range + finish and server approve are required for production acceptance.

## Tests

- npx tsc --noEmit -p .
- npx vitest run -c app/vitest.review.config.ts
- npm test (root CI imports the isolated UI suites through tests/studio-v2-ui-contract.test.ts)
- app/scripts/studio-v2-http-qa.mjs is a real HTTP read-only/auth/CSRF/forbidden-field smoke. It requires the server on port 4322 plus an inherited STUDIO_V2_OWNER_SECRET (never place it in shell history). Writes redacted app/qa-artifacts/studio-v2-http-qa.json.

## Combined checkout (QA ONLY; never merge or push production)

1. From ~/balislam: fetch both origin/work/studio-v2-backend-20261108 and origin/work/studio-v2-ui-20261108.
2. Add an isolated detached worktree at ~/studio-v2-integrated-qa-20261108 from the Backend branch.
3. In THAT isolated worktree, git merge --no-commit --no-ff origin/work/studio-v2-ui-20261108. Stop rather than resolving security conflicts arbitrarily.
4. npm ci, npx tsc --noEmit -p ., npx vitest run -c app/vitest.review.config.ts.
5. Set server-only STUDIO_V2_ENFORCE=1, STUDIO_V2_OWNER_ID, strong STUDIO_V2_OWNER_SECRET, distinct BAL_WORKFLOW_HMAC_KEY, absolute STUDIO_V2_FFPROBE. Do not check these into the repo.
6. npm run app -- --port 4322; open /scene-review-v2.html?channel=balislam&episode=001; enter owner secret directly into the form.
7. Run the HTTP QA smoke separately. To prove AV signoff, also register a REAL QA MP4 manifest via trusted Render/Backend, play the entire MP4 at 1× with audible audio, pass tick/finish and explicit approve, and retain redacted HTTP and browser evidence.

Studio V2 UI layout remains unchanged from the previous measured 1600px and 390px QA. The new authenticated UI has not been visually reverified on Mac yet; do not reuse the old QA screenshots as integration evidence.

**Release status:** Draft, fail closed. No Backend/Workflow/Render or production episode files changed by this UI PR. Master/publishing remain separate blocked gates.
