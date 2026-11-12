> أرشيف — السلوك الحالي في studio-map.md

# Studio V2 — QA & Integration Handoff Report
**QA workstream:** 04 · **Date:** 2026-11-08  
**Repository:** `saladin76/balislam` · **source SHA:** `2d6523d61ccbf6dc434f887bd0b7548a1acd1250`  
**QA branch:** `work/studio-v2-qa-20261108` · **reference:** Draft PR #77 (not modified)  
**Disposition:** **BLOCKED for production**; changes in this branch are tests, a static scanner, and documentation only.

> **Evidence rule:** PASS is reserved for execution that actually happened. A unit test is not proof of live route protection, a real human audiovisual review, a Quran recitation's provenance, a real renderer, or deployment/publishing approval.

## 1. Source inventory and gaps

At the source SHA, the V2 implementation contains:
- `src/workflow/sceneV2.ts`: scene sequence, preparation, approval, limited invalidation, assembly eligibility digest.
- `src/workflow/sceneStoreV2.ts`: persisted signed scene ledger with an on-disk interprocess lock.
- `src/workflow/sceneArtifactsV2.ts`: real-file content/epoch capture per scene.
- `src/workflow/scenePlanV2.ts`: plan-derived scene order and audio modes.
- `src/workflow/sceneMediaV2.ts`: ffprobe stream/MP4 metadata validation, not semantic playback.
- `src/workflow/sceneServiceV2.ts`: trusted service contract with **unimplemented host adapters** for authentication, actual writer lock, script/board gate, rights and owner-view receipt.

Existing `tests/workflow-scene-*.test.ts` cover extensive pure policies and synthetic adapters. `tests/scene-real-av-smoke.ts` is the earlier E2 real-media smoke script. `tests/workflow-process-concurrency.test.ts` covers the *historical* six-stage ledger, not the separate V2 ledger. `tests/render-pool.test.ts` covers synthetic cancellation, retry and process management, not the real V2 render pipeline.

Source inspection found no V2 service wiring in the legacy production API facade `app/server/api.ts`, `app/src/api.ts`, or the real rendering boundary `src/render/episode.ts`. `app/server/extra.ts` still runs a queue whose V2 execution-time approval has not been verified. The static scanner in this PR is an inventory aid, not execution proof.

## 2. Executable changes in the QA branch

| File | Contract tested | Execution status |
|---|---|---|
| `tests/workflow-v2-qa-regression.test.ts` | Future prepare vs final gating, changes to **all 9** input groups, restore-original-without-resurrection, shared-asset locality, timecoded correction, assembly eligibility | **NOT TESTED** on repository checkout |
| `tests/workflow-v2-qa-process-concurrency.test.ts` | Three independent Node processes compete for the signed V2 ledger; exactly one future-scene preparation; no leftover test locks | **NOT TESTED** on repository checkout |
| `tests/workflow-v2-qa-view-sync.test.ts` | Server-side UI read-model changes when a new scene MP4 arrives or an old MP4 is restored; stale approval blocked | **NOT TESTED** on repository checkout |
| `tests/workflow-v2-qa-production-contracts.test.ts` | 17 explicit `it.todo` executable-production integration acceptance items; no misleading green tests | **BLOCKED** by adapters |
| `scripts/qa/studio-v2-readiness.mjs` | Read-only production references inventory; no rendered/pass claim | **NOT TESTED** in repository checkout |
| `scripts/qa/studio-v2-real-media-matrix.mjs` | Four synthetic MP4 audio modes, full decode, malformed MP4, forced failure, cancellation and retry | A locally authored equivalent was **executed in isolated Linux QA container: 8/8 PASS**; committed script **NOT TESTED** on Mac or actual repo checkout |

Previous Mac evidence **reported by owner**: TypeScript passed; 755/755 tests and 95/95 files passed; FFmpeg/FFprobe real MP4 test succeeded. Those are **historic, externally supplied results** and have not been rerun by QA-04 at the new branch HEAD.

## 3. Backend / Render / UI / Master acceptance matrix

| ID | Surface | Exact acceptance criterion | Current status |
|---|---|---|---|
| B01 | Backend | Owner session derived solely on server; forged role, actor, proof, path, SHA rejected by HTTP | **BLOCKED** |
| B02 | Backend | Locked script + Storyboard is checked before a new scene starts | **BLOCKED** (real adapter) |
| B03 | Backend | Later scene prep allowed without approval or final rendering | **NOT TESTED** (new QA regression) |
| B04 | Backend | Final scene N+1 blocked until actual owner approval for N | **NOT TESTED** (new QA regression); real endpoint **BLOCKED** |
| B05 | Backend | Script/vocalization/tone/Storyboard/assets/audio/sync/video/rights changes invalidate only affected scenes | **NOT TESTED** (new QA regression); real writer **BLOCKED** |
| B06 | Backend | Editing and restoring original bytes/epochs never revives revoked approval | **NOT TESTED** (new QA regression); real disk **BLOCKED** |
| B07 | Backend | V2 HMAC tamper refusal, authentic actor and interprocess lock across separate Node OS processes | **NOT TESTED** (new QA process test) |
| B08 | Backend | Actual script/plan/image writes share same lock as approval engine | **BLOCKED** |
| R01 | Render | Real queue worker revalidates gate at execute time and after recovery | **BLOCKED** |
| R02 | Render | Actual Remotion scene render produces bound composited MP4 | **BLOCKED** |
| R03 | Render | Real cancel/failure/retry and resource cleanup at production entrypoint | **BLOCKED** |
| R04 | Render | Four synthetic MP4 audio policies, full decode, AV stream start offset check | **PASS** (isolated Linux FFmpeg harness only) |
| R05 | Render | Reject invalid container and forced FFmpeg error | **PASS** (isolated Linux harness only) |
| R06 | Render | Cancel owned FFmpeg child and retry into independent owned output | **PASS** (isolated Linux harness only) |
| R07 | Render | Human-recitation provenance and mixing correctness on a real Studio scene | **BLOCKED** |
| U01 | UI | New MP4 causes server read-model fingerprint and approval status changes | **NOT TESTED** (new QA mock-adapter test) |
| U02 | UI | Browser refresh, stale button disabled and time-coded corrections persist | **BLOCKED** |
| U03 | UI | Independent 1× actual owner audiovisual viewing receipt | **BLOCKED** |
| U04 | UI | Real screenshots and live HTTP response evidence | **NOT TESTED** |
| M01 | Master | All current per-scene signed approvals required before assembly, actual file recheck | **BLOCKED** (production) |
| M02 | Master | 1× full-episode review is separate from each approved scene | **BLOCKED** |
| M03 | Master | Exact produced Master bytes approved by authenticated owner | **BLOCKED** |
| M04 | Publish | Frozen SHA-256-checked Master file supplied to actual publisher; no stale/race upload | **BLOCKED** |
| M05 | Publish | No upload/publish without owner authorization | **BLOCKED** |

**No production path gets PASS from read-model/pure-policy or FFmpeg smoke evidence.**

## 4. Real media execution evidence and limitations

**Actually executed in an isolated Linux container, 2026-11-08:** the standalone FFmpeg harness completed **8/8 expected-positive checks; 0 unexpected failures**:
1. Silent MP4: video stream, no audio.
2. Narrated-mode MP4: synthetic 440 Hz AAC track.
3. Recitation-mode MP4: synthetic 550 Hz AAC track (**NOT human recitation**).
4. Mixed-mode MP4: two synthetic sine sources mixed into one AAC track.
5. Malformed MP4 rejected by actual ffprobe.
6. Deliberately invalid FFmpeg input failed as expected.
7. A QA-owned long-running FFmpeg child was terminated and awaited.
8. Fresh output re-encoded and fully decoded after cancellation.

For each valid MP4 the harness verifies an MP4 container, 320×180 video stream, approx. 1.2 s duration, the expected audio-stream policy, <120 ms synthetic video/audio stream start offset when audio exists, full `ffmpeg -f null -` decode and independent SHA-256 of the MP4 bytes. This proves **container/codec and basic synthetic timing only**. It does not prove pronunciation, Quran authenticity, lip/word sync, creative quality, Remotion production, correctness of owner signoff or file retention in the production renderer. It deletes only its newly created random QA temp root. No screenshot or persistent MP4 was produced, by design.

## 5. E2E acceptance plan (once actual adapters arrive)

A. Create a dedicated QA-only episode in a temporary `channelsRoot` with three scenes, locked original script/Storyboard and per-scene input manifests. Require an authenticated owner session; separate "reviewer" and anonymous negatives.

B. Prepare assets for scene 2 and 3. Assert **no final output**, no success status and no approval. Attempt `begin` for scene 2 while 1 is unapproved, including direct API/CLI and queue restart. Assert **no side effects**: no media file, no billable voice generation, no render process, no queued executable job.

C. Produce scene 1 as a real composite AV MP4; validate current file SHA/epoch and ffprobe/decode. Record a separately authenticated owner-view receipt after actual 1× playback. Submit and approve the exact version. Ensure scene 2 now unlocks but scene 3 still does not.

D. Repeat through all three scenes; test four sound policies with a real user-uploaded human recitation file only in rights-approved QA fixtures. Change each input and one shared asset; assert local-only invalidation. After reapproval, re-run master eligibility.

E. Mutate then restore AV bytes, including a replacement inode: assert approval **does not resurrect** and original event is audit-visible but inactive. Independently attempt malicious JSON, wrong HMAC, wrong identity, path traversal, symlink/hardlink and across-episode replay.

F. Run two or more Node worker processes on **the same QA-only episode**; test concurrent worker/HTTP/file writer and simultaneous owner commands. Recheck gate at job execution and recovery; no duplicate approval, no race to unauthorized render.

G. Cancel an actual Remotion job mid-render, provoke a failure and retry it. All temporary resources must be owned, released on normal/failing/cancelled paths, with no cumulative growth or foreign deletion. Run sequentially only after Mac load coordination.

H. For final assembly check the exact current file set and event IDs; review full episode at 1×, then review and approve the **exact Master itself**. Attempt a different Master and a mutate-restore Master: neither may publish. Confirm uploader receives only frozen bytes of explicitly approved Master; use a **fake uploader**, never real publication.

I. Observe browser version updates, timecoded notes, missing/stale previews and revoked state, with screenshots and network logs. Compare backend read-model revision and UI. Fail E2E if browser shows approved after a backend revocation.

## 6. Risk log (not all are demonstrated exploits)

| ID | Severity | Condition and minimal reproduction | Owner / closure |
|---|---|---|---|
| P0-01 | P0 | Inspect `app/server/api.ts` and `app/src/api.ts`; current routes expose legacy render/voice paths, no evidenced trusted V2 command adapter. In a QA episode, post a final render with scene 1 not approved and check for zero side effects. **Runtime repro BLOCKED.** | Backend — authorize actual HTTP entrypoints |
| P0-02 | P0 | Inspect `app/server/extra.ts`, `src/render/episode.ts` and `src/cli/index.ts`; V2 worker-time approval cannot yet be demonstrated. Enqueue prior to invalidation, invalidate, resume/restart queue: must refuse. **Runtime repro BLOCKED.** | Render + Backend — guard worker/recovery/CLI |
| P0-03 | P0 | `assemblyEligibility()` returns a scene digest only. There is no demonstrated V2 full-episode signoff, exact Master approval, or publisher adapter. Try to publish unapproved/mutated Master using a fake uploader. **Runtime repro BLOCKED.** | Master + Backend — three separate approvals/gates |
| P1-01 | P1 | `app/src/api.ts` has no evidenced V2 read-model integration. Replace current scene MP4 while UI review is open; expected new fingerprint and revoked state. **Browser repro BLOCKED**, service read-model regression added. | UI — version-aware refresh and disabled stale controls |
| P1-02 | P1 | V2 service accepts injected `withArtifactLock`; no proven common lock across actual script/plan writes, media output, CLI and queue. Interleave real writer and approval; expect atomic snapshot. **Runtime repro BLOCKED.** | Backend + Render |
| P1-03 | P1 | `verifyCurrentSceneAvReview` is injected; absence of a real authenticated 1× view receipt/recitation provenance permits no owner-approval acceptance claim. **Runtime repro BLOCKED.** | Backend + UI + Audio |
| P2-01 | P2 | Cancellation/cleanup is tested only in an isolated FFmpeg worker, not in full Remotion + queue on Mac. Stress and leakage evidence are missing. | Render + QA |
| P2-02 | P2 | No screenshots or persistent QA-only MP4/HMAC trace attached yet; cannot audit UI or AV aesthetics end to end. | UI + QA |

Classifying an *unwired* guard as P0 means a **release blocker**, not proof that the current server can already be exploited. Each issue requires an actual endpoint reproduction once that integration exists.

## 7. Safe sequential Mac QA procedure

**Coordinate with active Mac workstreams first; do not run the full suite and real render simultaneously. Do not kill unrelated processes or clean global `/tmp`.** Use a dedicated worktree and only a newly created evidence/temp path:

```bash
cd ~/balislam
git fetch origin work/studio-v2-qa-20261108
QA="$HOME/studio-v2-qa04-$(date +%Y%m%d-%H%M%S)"
git worktree add --detach "$QA" origin/work/studio-v2-qa-20261108
cd "$QA"
git rev-parse HEAD
git status --porcelain
OUT="$(mktemp -d "$HOME/studio-v2-qa04-evidence-XXXXXXXX")"
mkdir -p "$OUT/tmp"
export TMPDIR="$OUT/tmp" TMP="$OUT/tmp" TEMP="$OUT/tmp"
test "$(df -Pk "$HOME" | awk 'NR==2 {print $4}')" -gt 7340032 || exit 1
npm ci > "$OUT/npm-ci.log" 2>&1
npm run typecheck > "$OUT/typecheck.log" 2>&1
npx --no-install vitest run \
  tests/workflow-v2-qa-regression.test.ts \
  tests/workflow-v2-qa-process-concurrency.test.ts \
  tests/workflow-v2-qa-view-sync.test.ts \
  tests/workflow-v2-qa-production-contracts.test.ts \
  --maxWorkers=1 --minWorkers=1 > "$OUT/qa04-vitest.log" 2>&1
node scripts/qa/studio-v2-readiness.mjs > "$OUT/wiring.json"
STUDIO_FFMPEG_BIN=/opt/homebrew/bin/ffmpeg \
STUDIO_FFPROBE_BIN=/opt/homebrew/bin/ffprobe \
node scripts/qa/studio-v2-real-media-matrix.mjs > "$OUT/real-media.json"
git status --porcelain > "$OUT/git-status-after.txt"
shasum -a 256 "$OUT/"*.json > "$OUT/evidence-sha256.txt"
echo "QA evidence (retain for handoff): $OUT"
```

**Only after these light tests pass and Mac is idle/coordinated:** run `npm test`, the existing `tests/scene-real-av-smoke.ts`, `npm run gate` and any real Remotion E2E **serially**, each with its own log and resources. Never call these later phases PASS without recorded exit codes and actual evidence.

## 8. Gate decision

| Final gate | Decision |
|---|---|
| QA-04 isolated Linux FFmpeg synthetic media matrix | **PASS** (8/8 in isolated QA environment; not current commit/checkout E2E) |
| New QA-04 Vitest regressions, V2 multi-Node and UI read model | **NOT TESTED** (committed, execution pending) |
| Historic owner-reported Mac TypeScript 755/755 baseline | **PASS previously reported** (prior baseline, not verified on QA branch) |
| Backend V2 production integration | **BLOCKED** |
| Render worker V2 production integration | **BLOCKED** |
| UI real audiovisual review and version updates | **BLOCKED** |
| Master review + exact approval | **BLOCKED** |
| Publication authorization | **BLOCKED** |
| **Overall Studio V2 production acceptance** | **BLOCKED** |

This report does not authorize merge to `main`, release, publication, or automatic owner approval. Update statuses only after running the corresponding tests on an explicitly identified SHA.
