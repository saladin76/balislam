> أرشيف — السلوك الحالي في studio-map.md

# Studio P0 — temporary-resource ownership and stress-gate audit (2026-11-07)

This document applies only to `work/studio-p0-temp-20261107` / Draft PR #72.
No production Mac, published episode, `main`, render staging, Quran/audio, PDF exporter, or UI module is changed.

## Provenance and allocation inventory

| Resource / original allocation site | Cause and fix in this PR | Verification boundary |
|---|---|---|
| `tests/voice-cache.test.ts` / `bal-voice-*` | Recursive channel copy also included large production episodes; exclude `episodes`, `voice`, `out`, `recitations`, use tiny demo fixture, tear down owned root. | Unit fixture. |
| `tests/recitation.test.ts` / `bal-rec-*` | Channel copy previously included production episodes; exclude them, make demo episode, remove owned root. | Unit fixture; FFmpeg-generated sample stays inside root. |
| `tests/quran-text-only.test.ts` / `bal-text-only-*` | Exclude production episodes from copied channel; use fixture; owned-root teardown. | Unit fixture. |
| `tests/render-pool.test.ts` / `pool-*` | Track every synthetic pool directory and remove after each test. | Fake render pool, not a production Remotion/Chrome render. |
| `tests/studio-temp-lifecycle.test.ts` / `bal-p0-gate-test-*` | Mocked `npx` creates representative `remotion-test` and `webpack-test` cache files. Covers success, failure, SIGTERM, SIGINT, serial repetition, parallel success/failure, foreign sibling and symlink target, and synthetic Git worktree integrity. | Representative caches, not proof of production bundler/browser cleanup. |
| Remaining `tests/**` fixture roots | Owned temp roots are removed in after hooks for channels, doc plate, previews, figure views, Git isolation, storyboards, master gates, scene review, settings, voice review, and other affected suites. | CI test suites; see PR diff for individual directories. |
| `scripts/gate.mjs` / `bal-gate-run-*` | Each invocation gets a unique `mkdtemp` root. Children inherit matching `TMPDIR`/`TMP`/`TEMP`. Child process group receives termination signal. Only the exact owned root is deleted, including owned commit worktree. Allocated bytes are recorded before cleanup. | Handled cancellation/failure, not abrupt kernel kill. |
| `scripts/verify-studio-temp-leaks.mjs` / `bal-test-leak-audit-*` | Distinct per-gate roots, two serial or two concurrent full gates, explicit failure and cancellation probes, before/after free-space and swap counters, leftover enumeration only within owned roots. | Mac free-space deltas can be affected by APFS swap / unrelated processes. |

PR #70 previously recorded approximately 136.1 MB of channel media in the Git tree, with repeated unnecessary copies; a Mac parallel audit observed about 1.085 GB less free space even though private temp roots were empty. The latter is **unattributed disk movement**, not proof of a remaining test-owned leak. Production Chrome/Remotion/webpack render outputs outside these gated test runs remain unverified.

## Reproducible commands (isolated checkout only)

```bash
npm ci
npm run typecheck
npm test
node scripts/verify-studio-temp-leaks.mjs --failure
node scripts/verify-studio-temp-leaks.mjs --cancel
node scripts/verify-studio-temp-leaks.mjs
node scripts/verify-studio-temp-leaks.mjs --parallel
```

`--failure` must report expected gate exit 1 and a passing audit; `--cancel` must record gate exit 143 and a passing audit. Serial and parallel audit runs must each report two status-0 gates, empty leftovers, zero allocated private bytes after cleanup and `passed: true`. Inspect `freeBytesBefore` / `freeBytesAfter` / `freeBytesDelta` and macOS swap changes rather than assuming every host delta is test leakage.

The dedicated GitHub Actions workflow `.github/workflows/studio-p0-temp-audit.yml` executes all four modes and compares exact checkout status, Git worktree registrations, Git config checksum, and channel-file SHA-256 manifests. It uploads raw logs with `TEMP_LEAK_AUDIT` metrics. The already passing standard CI (84 files, 642 tests on head d2f5814) does **not** prove the separate stress audit passed; check the new job's latest exact-head outcome.

## Safety and limitations

- Never run cleanup commands against all of `/tmp`, matching-prefix directories, other worktrees, or another process's files. Do not automatically remove historical leftovers without a verified ownership marker and process-liveness check.
- SIGKILL, machine power loss, process escape from its group, disk errors, and files deliberately written outside the inherited temp/cache environment cannot be cleaned reliably by the killed process.
- The tests verify the containerized / CI checkout, not production Mac's APFS VM swap, other users' caches, or end-to-end Chromium/Remotion production renders.
- **100% acceptance is withheld** until repeated full-gate CI evidence and any required isolated Mac diagnostics are reviewed. A successful single CI run of `npm test` is insufficient.

## Additional audit: commit-mode installation cancellation

An additional source of uncancellable work was identified in `scripts/gate.mjs --commit`: if no matching local `node_modules` is present, `npm ci` formerly used `spawnSync`. Its Node signal handlers cannot stop that long synchronous child promptly. `npm ci` now uses the same detached, tracked, asynchronous child runner as TypeScript and Vitest.

The early-failure path now reports `GATE_TEMP_ALLOCATED_BEFORE_CLEANUP_BYTES` and `GATE_TEMP_CLEANED`. Failure to deregister its own Git worktree is reported as `GATE_WORKTREE_REMOVE_FAILED` and fails the gate; it never prunes unrelated registrations. A measurable cleanup error is never interpreted as success.

Regression tests additionally cover SIGHUP, failed check after `--commit`, failed mocked `npm ci`, and SIGTERM during mocked `npm ci`. A node/FFmpeg isolated smoke fixture (outside GitHub, not the real Vitest suite) ran 3 x 13 gate cases with success/failure/cancellation/parallelism and a separate 4-case mocked `npm ci` fixture; all expected exit codes, synthetic Git worktree ownership and foreign sentinels were preserved. The synthetic fixture uses `/usr/bin/ffmpeg` to produce a short private WAV, not an actual Remotion render. These local results do **not** substitute for the exact-head full CI / Mac stress requirement.

Audit reporting no longer asserts that *all* unrelated /tmp files were inspected and untouched; only root ownership and absence of shared-directory sweeps are verified.


## Measured isolated safety evidence (Linux fixture)

Verification used the exact old `scripts/gate.mjs` Git blob `0b1987e47b1d6d2f82a363e28c0583010ecf3d66` as the baseline. The amended cancellable `npm ci` variant was exercised in the same isolated fixture; this is **not** equivalent to running the full GitHub branch on Mac.

- Three independent smoke batches, **13 gate invocations each (39 total)**, all expected statuses observed: four serial passes, expected check failure, SIGTERM (143), SIGINT (130), SIGHUP (129), two parallel successes, mixed parallel success/failure, and synthetic commit-worktree success. Each mock `npx` executed real local `/usr/bin/ffmpeg` against a short test audio sample, created 512 KiB of fake Remotion/webpack-style cache, and linked a sentinel-owned foreign directory. **No gate-owned roots remained once each batch finished.**
- Allocated blocks before cleanup: **532,480 bytes** for normal fixture cases, **569,344 bytes** for synthetic commit-worktree case. Host free-byte deltas after deleting the entire owned fixture: **+20,480 bytes**, **+20,480 bytes**, **+20,480 bytes**, not interpreted as universal host-leak proof.
- Four additional synthetic `npm ci` cases returned **0, 1, 143, 130** for success, failure, SIGTERM and SIGINT. Their exact owned roots were removed; each synthetic Git repository retained its original HEAD, one worktree, Git configuration, clean status, and episode file.
- Simulated SIGKILL left **one** owned temp root and an owned cache file, proving in-process cleanup is impossible on force kill. The isolated supervisor then removed only its own fixture root. Never run automatic stale-root deletion on system `/tmp` by prefix alone.
- Standalone Chromium probe in this Linux container reached its 20-second timeout; all probe-owned resources were removed by the test supervisor, but **no Chromium/Remotion production leak-free claim** follows.

### Exact head and acceptance blocker

At `8127c45fbe596041d6cb5fd866881b33a7cc4988`, CI, Studio parity and P0 stress workflow all failed **before any job step** (zero steps). These three GitHub Actions outcomes contain no TypeScript, Vitest, or disk audit measurements. Other unrelated PR workflows also showed matching immediate failures around the same time, consistent with a runner/account-level blocker but not enough to establish its precise cause.

The 100% release condition is **not achieved** until GitHub Actions can execute again and the exact-head full-gate serial/parallel/failure/cancellation runs pass with `TEMP_LEAK_AUDIT` measurements. No modification to production Mac, `main`, unrelated components, or Vercel is authorized by this audit.


## P0 audit update — head `1e0b05519ef7c125dd354396e15dad08223f8776`

### Runtime execution status (strict evidence classes)

- Last **proven successful full CI** on this P0 branch: previous head `d2f5814`, `npm run typecheck` and all 642 Vitest tests passed at run [42364764311](https://github.com/saladin76/balislam/actions/runs/42364764311). This **does not cover** subsequent P0 changes.
- Exact-head [CI 42403794709](https://github.com/saladin76/balislam/actions/runs/42403794709), [parity 42403794704](https://github.com/saladin76/balislam/actions/runs/42403794704) and [stress 42403794739](https://github.com/saladin76/balislam/actions/runs/42403794739) all concluded failure **before a runner was assigned** (`runner_id=0`, `steps=[]`). No test assertion, installation, or resource check ran.
- The current isolated analysis container has Node 22 and FFmpeg installed and ~30 GiB free, but the GitHub repository cannot be cloned or installed through its network connection (`git ls-remote ...` fails DNS resolution: `Could not resolve host: github.com`; no project `node_modules`). Hence **there are no exact-head TypeScript / P0 Vitest / full-gate / repeat / parallel runtime results from this environment**. Static inspection and JavaScript syntax parsing are not substitutes.
- The earlier **39 synthetic gate cases** and four isolated mocked `npm ci` cases remain *prior-head*, **synthetic** evidence only. Representative allocated bytes recorded previously: 532,480 B normally, 569,344 B for a temporary synthetic worktree, zero remaining owned gate directories, and final host free-byte deltas +20,480 B for each of the three independent samples. Do not reuse these figures as present-head measurements.

### Source changes after the earlier isolated evidence

- `scripts/verify-studio-temp-leaks.mjs` now captures each full gate's `GATE_TEMP_ALLOCATED_BEFORE_CLEANUP_BYTES` and `GATE_TEMP_CLEANED`, samples only that gate's owned root while running, records `ownedPeakBytes`, `ownedRootBytesAfterGate`, sampling errors and counts, and **fails the audit** when cleanup is unreported or incomplete.
- The parallel preflight now has a **dedicated owned root** and records allocated bytes and leftover paths; it refuses to launch full gates if even the preflight leaves unexplained files. The preflight child is signal-aware and is stopped before its private root is removed. SIGINT, SIGTERM and SIGHUP are handled at the audit level.
- Added *source-defined but not yet CI-executed* regressions for successful full-**mock** parallel audit with a clean preflight and a rejected leaky preflight. The mock uses a fake `npx`; its passing result would **not** demonstrate a real Vitest run.

### Cross-PR safety handoff — PR #73

PR #73 `work/studio-render-isolation-20261107` is separate. The following **eight paths overlap**; retain both functional render changes from PR #73 and P0 resource safety when assembling a future integration branch:

| Shared test file | Must preserve from PR #72 | Must preserve from PR #73 |
| --- | --- | --- |
| `tests/channels.test.ts` | Exact `mkdtemp` root cleanup; reset temp variable | Existing channel assertions; afterAll cleanup |
| `tests/episode-previews.test.ts` | Own/root-tracked teardown on success and failure | Version history, hostile slot, corrupt/locked index regressions |
| `tests/master-gates.test.ts` | Remove each `gates-*` root | Fail-closed `allowUnreviewed` gate assertions |
| `tests/recitation.test.ts` | **Exclude `episodes` when copying channels**, use demo fixture, delete owned root | Audio/render-related assertions and teardown |
| `tests/render-pool.test.ts` | Tracked `pool-*` teardown, official `tsx` invocation and stderr diagnostics | Unique `.part-` ownership, parallel cancellation, queue recovery / live writer guards |
| `tests/storyboard-stage-safety.test.ts` | Tracked storyboard roots and teardown | Content-addressed staging/concurrency/path-symlink protections |
| `tests/studio-production-stage-integration.test.ts` | **Add cleanup currently absent from PR #73** | `voiceTimingMode` approval and invalidation assertions |
| `tests/voice-cache.test.ts` | **Exclude `episodes` and `recitations` before recursive copy**, demo fixture, cleanup | Existing voice assertions and teardown |

In addition, carry PR #73's separate `scripts/studio-acceptance-temp.mjs` ownership-checked `run-*/temp` helper and its tests; do not replace P0 gate isolation with generic acceptance cleanup. Do **not** cherry-pick PR #73's entire branch into this PR or copy unrelated source, voice, Quran, PDF or UI changes. Resolve the eight files intentionally in a future reviewed integration branch; do not alter either production tree.

### Exact acceptance commands and expected evidence

```bash
# In a fresh disposable checkout of the exact PR #72 head, NOT ~/balislam:
git rev-parse HEAD
git status --porcelain=v1
git worktree list --porcelain
npm ci
npm run typecheck
npx vitest run tests/studio-temp-lifecycle.test.ts
npm test
node scripts/verify-studio-temp-leaks.mjs --failure
node scripts/verify-studio-temp-leaks.mjs --cancel
node scripts/verify-studio-temp-leaks.mjs
node scripts/verify-studio-temp-leaks.mjs --parallel
```

Require **all** running commands to succeed (the induced failure/cancel audits themselves must exit 0 with `passed:true`), at least two complete serial gates and two concurrent complete gates, no residual owned roots, every gate reporting cleanup true, preflight leftovers empty, and before/peak/after measurements. Rehash channel episode files and check Git config, refs and worktree registration before vs after. Retain the audit logs and report any storage anomaly by path; an APFS disk-space change alone cannot prove a test-owned leak.

**SIGKILL/power loss:** no in-process cleanup guarantee. A separate supervisor may recover an exact, proven-owned root only after confirming no live writer/descendant is using it and independently verifying ownership, path type and symlink status. Never scan/delete by `bal-*` prefix or broadly clean `/tmp`.

**P0 acceptance remains BLOCKED, not 100%.** The real full-stress gate has not run on this head; provider-side runner assignment diagnostics and a valid isolated checkout are still required.
