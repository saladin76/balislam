# Studio V2 — Integration QA Phase 2 Report (Task 08)

**Date:** 2026-11-08  
**Repo / Draft PR:** [saladin76/balislam #85](https://github.com/saladin76/balislam/pull/85)  
**QA branch:** work/studio-v2-qa-20261108 (base f9f75902d915a69719d3af0202270a9d3ab84b8a)  
**Central tracker:** [Issue #89](https://github.com/saladin76/balislam/issues/89)  
**Release decision:** **BLOCKED** — not one end-to-end three-team integration has yet been run or demonstrated.

### Live update — QA-09 / integration PR #90 (supersedes earlier branch-availability statements)

Coordinator **HAS NOW** created [integrated Draft PR #90](https://github.com/saladin76/balislam/pull/90) at pinned SHA `40b4d07ebc243e926694c5681f7721fe2899c1b6`, combining Backend, Render, UI and QA files. Thus the old statement "no composite branch has been supplied" below is **historical and superseded**, not the current blocker.

On this exact aggregate, TypeScript PASS and Studio parity PASS, but full CI **FAIL**: [rerun 42467225786](https://github.com/saladin76/balislam/actions/runs/42467225786) reported **822 PASS / 1 FAIL / 1 skipped / 17 TODO**. The actual assertion `tests/render-pool.test.ts:163` expected retried y.status="done" and received "error". It was NOT a test timeout. The first run also had two 5s timeouts. The QA team reproduced a second, source-level cleanup race on the **same RenderPool Git blob**: concurrent close can cause `idle()` to resolve while a failed job's `.part.mp4` cleanup is still pending. The two CI checks of [QA commit adefdebb](https://github.com/saladin76/balislam/commit/adefdebbd082d68d30cd07a0e43439ae6c8338df) both **FAIL** on the new adversarial 1ms test with `{status:"error",partialExists:true}`. This is a proven safety/cleanup regression, and a plausible (not yet proved exclusive) cause of the original retry failure. See [QA-09 triage](studio-v2-qa09-render-pool-triage.md) and [Issue #89](https://github.com/saladin76/balislam/issues/89#issuecomment-6720171492). No production code modified by QA.

**Render progress:** #86 previously generated **two actual Remotion 1920×1080/30FPS/H.264 MP4s** (silent and synthetic AAC tone) on Linux GitHub Actions and validated real decode/frames and owned cleanup. This is stronger than the earlier FFmpeg fixture. Still **NOT Mac**, **NOT composite Backend→UI→Remotion**, and **NOT owner 1× AV review/approval**. Full release E2E and Master remain BLOCKED.

**Current QA count:** Original 17 production contract TODO remain TODO; Phase-2 three-team owner E2E 0 PASS; CI on composite #90 FAIL; new QA-09 cleanup-regression intentionally FAIL until actual production owner fix. **Do not skip, mock green, extend global timeout, or merge while red.**


## 1. New deliveries reviewed, with exact heads

| PR | Team | Head SHA | What actually exists | Integration limit |
|---|---|---|---|---|
| [#88](https://github.com/saladin76/balislam/pull/88) | Backend | 09efabf0ab9b1b00fb10dcd0dbdb7bcd723d044e | localhost owner session, Origin/CSRF, signed script+Storyboard snapshots, signed spec/9-group manifest plus current-generation render receipt, production lease, signed notes, HTTP scene decisions and AV receipts; technical FFmpeg Backend CI | Backend-only branch lacks Render-owned module; direct CLI/worker/queue recovery not gated; signed spec creation needs trusted integration worker |
| [#86](https://github.com/saladin76/balislam/pull/86) | Render | 42cbc310b0d31db5abfeac365bce06331d3f41cb | per-scene Remotion composition, real probe/SHA, immutable MP4, Render-to-Backend manifest handoff verifier, cancel/retry handling | no combined trusted backend caller or Mac actual Remotion run evidenced |
| [#87](https://github.com/saladin76/balislam/pull/87) | UI | 9d3ba7466062e229a320f103e79abf3bb41f30b9 | React RTL reviewer and NEW Backend-aligned owner session/CSRF + challenge start/media/tick/finish at 1x | Runtime Chrome+Remotion owner approval remains untested; independent note-only UI still disabled |
| [#85](https://github.com/saladin76/balislam/pull/85) | QA | phase-2 commits in this branch | real opt-in HTTP/Remotion scripts, explicit blocked states, CI harness-safety tests, dependency audit triage | separate QA ancestry contains none of the other teams' runtime files |

All four are independent Draft PRs targeting PR #77's branch. **No integration branch has been supplied.** Do NOT cherry-pick/merge the teams in this QA PR. A green CI run on one PR does not prove an end-to-end Studio flow.

## 2. Actual API contracts, not old QA assumptions

Backend is authoritative for:
- POST/GET /api/studio-v2/session; cookie \`studio_v2_sid\` HttpOnly + SameSite Strict; server identity; Origin and \`x-studio-v2-csrf\` on writes.
- GET/POST /api/studio-v2/episodes/:NNN/sources?channel=:id.
- GET /api/studio-v2/episodes/:NNN/scenes?channel=:id.
- POST /api/studio-v2/episodes/:NNN/scenes/:sceneId/commands?channel=:id (prepare, begin, submit, request_changes, approve).
- POST /api/studio-v2/episodes/:NNN/scenes/:sceneId/render?channel=:id, using only \`expectedRevision\`.
- POST /scenes/:sceneId/review/start; authenticated GET /media?reviewId=... (real byte ranges); POST /review/:reviewId/tick|finish; final explicit approve needs matching fingerprint and completed server-bound reviewId.
- GET /assembly-eligibility (not Master approval).

**Updated finding:** UI #87 has now adapted to the actual Backend `/api/studio-v2/episodes/:NNN/...` routes, uses the owner session and CSRF, and implements challenge-based AV start/media/tick/finish and explicit approval. The ORIGINAL path mismatch was genuine at its former SHA, but **is fixed in the latest UI source**. Combined Chrome/HTTP/Remotion owner E2E remains BLOCKED/NOT TESTED. Backend now supports a signed `note` command and currentVideo/blockers projection, while UI's independent note writer remains disabled and these new read-model fields still need real browser QA. Backend #88 now includes a signed current render receipt and a technical FFmpeg-to-approval CI integration test, which is **not** a real owner attentiveness or Remotion/Chrome E2E.

## 3. QA-08 files / execution semantics

- \`scripts/qa/studio-v2-phase2-live-http.mjs\`: **REAL HTTP** only. Validates real owner login/GET, anonymous access, cookie attributes, Origin and CSRF, forged role/actor/review/render payloads, legacy /api quarantine, scoped 3-scene ordering, future asset preparation, scene N+1 gate, refused early AV finish, stale fingerprint and phase-by-phase approval progression. Does not invent signoffs. Default behavior without a real QA fixture: **BLOCKED, exit 2**.
- \`scripts/qa/studio-v2-phase2-real-render.mjs\`: **REAL Mac-only Remotion** through Backend POST /render on synthetic scene with an existing signed server spec. Validates returned registered MP4 SHA, signed manifest presence, ffprobe streams, full FFmpeg decode, explicit submit and status in_review (never approved). Serial opt-in and owned lease; cannot run without signed spec, explicit QA fixture and healthy resources. **BLOCKED until composite checkout.**
- \`scripts/qa/studio-v2-phase2-security-audit.mjs\`: runs actual npm audit for all and production-only lockfile dependencies, enumerates high/critical advisories and direct/transitive status; never runs npm audit fix/force. Audit success only means a query completed, **not** that risks are harmless.
- \`tests/workflow-v2-qa08-harness-sanity.test.ts\`: parsing and fail-closed runner safety **only**. Do not count these as production acceptance.
- Existing \`tests/workflow-v2-qa-production-contracts.test.ts\`: **17 production TODOs remain TODO**; none green by replacing real routes with mocks.

## 4. Acceptance matrix — do not inflate PASS

| ID | Production acceptance | State as of this report | Required evidence |
|---|---|---|---|
| H01 | Real HTTP owner login/cookie/CSRF, unauthorized, forged actor | **BLOCKED** | composite live server + HTTP response log |
| H02 | Signed script + Storyboard approval, current source validation | **BLOCKED** | real QA episode and owner source review |
| H03 | Future scene 2/3 prepare without authorization for final production | **BLOCKED** | real live HTTP + file/queue side effect snapshot |
| H04 | Scene 2 blocked until scene 1 real AV approval | **BLOCKED** | HTTP 409 at current server state; worker execution denial |
| H05 | Real current-byte Remotion scene 1 MP4 and independent probe | **BLOCKED** | Mac file, ffprobe, full decode, SHA and registry |
| H06 | Signed 9-group manifest, trusted render spec and epoch | **BLOCKED** | producer → registry → current disk verification |
| H07 | Owner's server-bound full 1× AV review (no browser boolean) | **BLOCKED** | Chrome session, stream/ticks/challenge/finish, real owner |
| H08 | Explicit correct-version approval, release scene 2 | **BLOCKED** | server signed approval + next scene gate |
| H09 | Request changes + local invalidation + reapproval | **BLOCKED** | old event inactive, fresh verified MP4 and receipt |
| H10 | Stale fingerprint / changed-restored bytes refused | **BLOCKED** | actual file epoch changes + API rejection |
| H11 | Same signed mutex across HTTP/editor/render processes | **BLOCKED** | composite multi-process and exact lock evidence |
| H12 | Queue dequeue/restart/retry + direct CLI guard | **BLOCKED** | live execution-time denial; no effects/credits |
| H13 | Three actual approved scenes and assembly eligibility | **BLOCKED** | three real scene manifests + three owner AV signoffs |
| H14 | UI live backend read model, session, 1× video review | **BLOCKED** | integrated Chrome UI with network traces |
| H15 | Master assembly, full episode 1× review, exact byte approval | **BLOCKED** | production implementation absent |
| H16 | Fake publisher receives only approved immutable Master | **BLOCKED** | production publisher gate absent |
| H17 | QA-only Mac Chrome/Remotion artefacts, cleanup & leak measurement | **NOT TESTED** | saved local SHA, frames, MP4, logs, owned paths |

**QA-08 production E2E currently:** 0 PASS; 0 observed runtime FAIL; 16 BLOCKED; 1 NOT TESTED.  
**Tracked QA-04 contract file:** 17 TODO; these are the *same coverage requirements*, not 17 more test cases to double-count.  
**QA harness syntax/safety tests:** separate CI suite; do not mix with production counts.  
**Old QA-04 8/8 Linux FFmpeg synthetic smoke:** historical technical media evidence, not Phase-2 real Remotion or human owner review.

## 5. Safe isolated three-scene fixture and serial Mac workflow

The integration coordinator must first provide a **separate composite Draft branch** containing Backend #88, Render #86 and UI #87. This QA branch does not assemble that branch itself.

Create an independent Mac worktree from the supplied composite branch. Use a **new**, non-production QA episode:
- Channel one of \`balislam\`, \`dafatir-alzaman\`, \`zubdat-alkutub\`.
- Directory \`channels/<channel>/episodes/NNN-qa-<slug>\`; place an exact \`.studio-v2-qa-sentinel\` file containing \`STUDIO_V2_QA_ONLY\`.
- Locked \`plan.json\` must have exactly ordered scene IDs \`c1-s1\`, \`c1-s2\`, \`c1-s3\`. Create correct script, citations, Storyboard/visual entries and legitimate reviewable source materials using the existing Studio parsers; **do not synthesize approval signatures or modify a production episode**.
- Owner explicitly approves script and Storyboard through the actual HTTP API; a trusted prep worker must generate signed scene render specs and rights/provenance records. The QA harness never signs these on the owner's behalf.
- Use a synthetic non-Quran video/audio fixture for technical QA, not fabricated Quran recitation. For actual Quran rights tests a separately sourced owner-uploaded, rights-cleared audio file is required.

After the integration coordinator confirms no concurrent heavy tasks and disk/RAM are sufficient:

\`\`\`bash
cd ~/balislam
git fetch origin <approved-composite-branch>
QA="$HOME/studio-v2-integration-qa-$(date +%Y%m%d-%H%M%S)"
git worktree add --detach "$QA" origin/<approved-composite-branch>
cd "$QA"
git rev-parse HEAD
git status --porcelain
npm ci
npm run typecheck
npm test
npx --no-install vitest run -c app/vitest.review.config.ts
# Set in the shell only; never commit credentials.
export STUDIO_V2_ENFORCE=1
export STUDIO_V2_QA_BASE_URL="http://127.0.0.1:4322/"
export STUDIO_V2_QA_CHANNEL=balislam
export STUDIO_V2_QA_EPISODE=099
export STUDIO_V2_QA_FIXTURE_DIR="$QA/channels/balislam/episodes/099-qa-phase2"
export STUDIO_V2_FFPROBE=/opt/homebrew/bin/ffprobe
export STUDIO_V2_FFMPEG_BIN=/opt/homebrew/bin/ffmpeg
export STUDIO_V2_BROWSER_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# STUDIO_V2_OWNER_SECRET, STUDIO_V2_OWNER_ID, BAL_WORKFLOW_HMAC_KEY:
# generate or obtain as QA-only secrets, never echo or persist in logs.
npm run app -- --host 127.0.0.1 --port 4322
\`\`\`

In a **separate terminal** in the *same worktree*, once its synthetic fixture and localhost server are validated:

\`\`\`bash
# Keep runner scripts from QA PR #85 in the approved composite checkout.
node scripts/qa/studio-v2-phase2-live-http.mjs --phase=security
STUDIO_V2_QA_ALLOW_WRITES=1 node scripts/qa/studio-v2-phase2-live-http.mjs --phase=gate-before-first

# Only after owner script/Storyboard signoff, trusted signed render spec,
# scene-1 'begin' and resource preflight:
STUDIO_V2_QA_ALLOW_RENDER=1 STUDIO_V2_QA_RENDER_SERIAL=1 STUDIO_V2_QA_EVIDENCE=1 \
  node scripts/qa/studio-v2-phase2-real-render.mjs

node scripts/qa/studio-v2-phase2-live-http.mjs --phase=review-negative
# Owner now watches actual AV at 1x and explicitly approves exact scene 1 via integrated UI.
STUDIO_V2_QA_ALLOW_WRITES=1 node scripts/qa/studio-v2-phase2-live-http.mjs --phase=after-first
# Repeat trusted render and genuine owner AV approval for scene 2, then:
STUDIO_V2_QA_ALLOW_WRITES=1 node scripts/qa/studio-v2-phase2-live-http.mjs --phase=after-second
# Repeat real render and owner approval for scene 3, then:
node scripts/qa/studio-v2-phase2-live-http.mjs --phase=assembly
# Optional destructive negative AFTER current scenes are all approved:
STUDIO_V2_QA_MUTATE_APPROVED_AV=1 npx --no-install tsx scripts/qa/studio-v2-phase2-invalidation.mjs
# This invalidates the original AV signoff on purpose: re-render, re-watch,
# and reapprove the affected scene before eligibility can become green again.

node scripts/qa/studio-v2-phase2-security-audit.mjs
# Read-only checkout source inventory (NEVER E2E PASS):
node scripts/qa/studio-v2-phase2-integration-inventory.mjs
\`\`\`

**Important:** these commands are a repeatable procedure, not evidence that the operations ran. Without the correct signed specs/source and integrated owner browser, the gates must report **BLOCKED**. Keep outputs inside \`$QA/.studio-v2-qa-evidence/\`; capture Git SHA, HTTP statuses, MP4 SHA, FFprobe JSON, full-decoded audio/video, 1600px/390px Chrome screenshots and 1x owner notes. No global \`/tmp\` cleanup or deletion of foreign test files. Only the QA-render lease created with \`wx\` by the current runner may be removed after matching its original marker/inode.

## 6. Security and dependency assessment

- **P0:** The original UI/Backend route mismatch has now been **resolved in source** (#87). Real composite owner login + Chrome AV playback + MP4 receipt + explicit approval is still BLOCKED, with no live three-team proof.
- **P1:** UI independent timecoded note persistence remains disabled even though updated Backend has a signed `note` command; current-video metadata and blockers require real UI projection QA.
- **P0:** No approved composite branch or live three-team run. Backend alone refuses render if Render module is missing, as designed.
- **P0:** Direct CLI, legacy Remotion imports, recovered/render queue execution lack proven authorization at actual dequeue/execution; HTTP quarantine alone is insufficient.
- **P0:** Master assembly, full episode independent 1× review, exact Master approval and fake publisher are not implemented: all BLOCKED.
- **P1:** Signed trusted scene spec generation and owner-upload recitation provenance need genuine source adapters and verification; Backend technical FFmpeg CI does not substitute for combined real Remotion or actual owner AV attention.
- **P1:** Stale MP4 changed-and-restored, shared lock vs external writers, cancellation and browser-internal temporary leak cases still need real composite tests.
- **P1:** **10 high** npm advisories are confirmed in the `npm ci` output of [QA GitHub CI run 42465460515](https://github.com/saladin76/balislam/actions/runs/42465460515), but the named packages and reachable entrypoints are **not independently triaged yet**. The read-only audit script enumerates exact vulnerability packages, advisories, direct/transitive status and \`--omit=dev\` comparison when run. Severity does not automatically prove reachable exploitation; no arbitrary \`npm audit fix --force\`.
- **P2:** Keep Mac Chrome screenshots/AV, exact SHA, timestamps, memory/disk delta, retry logs and owned-temp evidence. Not captured in this phase.

## 7. Acceptance / handoff

**Do not merge PR #85 or any team Draft into main, do not start Master and do not enable publishing.**

QA can sign off the first integrated production scene only after: current locked sources + real Remotion output + signed manifest/current bytes + real localhost authenticated HTTP owner review + explicit approval + scene-2 production unlock AND queue/CLI bypass tests. Even a green CI on all four branches independently does not satisfy Issue #89.

**Master test eligibility: NO — BLOCKED** until three verified current AV scene approvals and a trusted assembly implementation exist. Separately re-run full-episode viewing/owner exact-Master approval and fake publisher when those production gates are implemented.
