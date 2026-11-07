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

