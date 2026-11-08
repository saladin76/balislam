# Studio V2 — QA-09: RenderPool retry race (Issue #89)

**Date:** 2026-11-08  
**Reference:** [Integration Draft PR #90](https://github.com/saladin76/balislam/pull/90), pinned SHA 40b4d07ebc243e926694c5681f7721fe2899c1b6.  
**QA:** [Draft PR #85](https://github.com/saladin76/balislam/pull/85), QA-only changes.  
**Release status:** FAIL for integrated CI; production E2E remains BLOCKED. No production engine changes by QA.

## Exact initial failure

PR #90 [CI rerun #42467225786](https://github.com/saladin76/balislam/actions/runs/42467225786): 822 PASS, 1 FAIL, 1 skipped, 17 TODO. The unchanged legacy assertion at tests/render-pool.test.ts:163 expected job y to be done after retryFailed() and idle(), but got error. This is not a timeout; the failing log did not print the final y.failure.kind or whether a partial file remained.

The exact production and test Git blobs are identical in PR #90 and QA #85:

- src/render/pool.ts = f3f3212bab49225123bb7e3e7005bc0457357c94
- tests/render-pool.test.ts = 86894ce6b1849e74be5795dc87e6233b820b0f21

## Proven independent premature-idle defect

Added tests/workflow-v2-qa09-render-pool-retry-diagnostics.test.ts using the **actual production RenderPool class** with synthetic fake child processes and a new owned QA-only temp directory per iteration. It repeats 40 cases across four timer variants without lowering any security, attempt, success, cleanup, or retry assertions.

**Both independent jobs on QA-only source SHA adefdebbd082d68d30cd07a0e43439ae6c8338df FAILED** in the 1ms fast-close variant:

- [CI #42469825198](https://github.com/saladin76/balislam/actions/runs/42469825198)
- [Studio parity #42469825259](https://github.com/saladin76/balislam/actions/runs/42469825259)

Actual evidence immediately after awaiting pool.idle():

~~~json
{"status":"error","attempts":1,"kind":"unknown","outputExists":false,"partialExists":true}
~~~

This **proves** idle can resolve before a failed job cleans up its temporary .part.mp4. The other three scheduling variants each passed 10 iterations. Do NOT call the combined CI green, skip this red regression, or raise global 5s timeouts to conceal it.

## Code-level causal path (production owner must fix)

In src/render/pool.ts:

1. finish() removes this.running at line 638.
2. For a failing child, terminal status error is assigned at line 702 **before** awaiting rm(tmp, { force: true }) at line 705.
3. busy() lines 493-494 checks only task states queued/running; idle() and wake() lines 489-500 have no pending-async-finalization counter.
4. A different child's finish() can call wake() while the failed child's rm(tmp) is still pending. At that instant there may be no queued/running state, so idle() resolves prematurely.
5. A caller may then retryFailed(), reusing the same .part.mp4 path while the old rm(tmp) is still pending. This **could** remove the new attempt's output and produce a final no-output error despite child success.

The premature idle condition is established by real GitHub QA. The precise cause of the earlier #90 y.status=error assertion is **not definitively proved**, since its diagnostic kind was absent; the observed mechanism is a strong candidate requiring confirmation.

**Owner:** legacy RenderPool/queue lifecycle owner, with Render PR #86 consultation. Fix must keep failed/cancelled jobs busy/non-retryable while their owned cleanup and relevant persistence are pending, and must not allow another child's wake to make idle prematurely resolve. Audit duplicate error/close/exit notification handling and ensure retries never delete a newer attempt's output. This is a production fix owned outside QA; no production edits were made in PR #85.

## Safe unchanged-test replay

QA-only serial diagnostic script: scripts/qa/studio-v2-qa09-render-pool-replay.mjs. It checks exact source Git blob hashes, executes the **original** retry test repeatedly in individual Node subprocesses with no global timeout change or automatic npm install, captures concise diagnostic errors, and stops at first failure.

~~~bash
# In a pinned isolated PR #90 or QA #85 worktree AFTER npm ci:
git rev-parse HEAD
git hash-object src/render/pool.ts tests/render-pool.test.ts
node scripts/qa/studio-v2-qa09-render-pool-replay.mjs 12
~~~

The new replay script is currently on QA PR #85, not automatically added to PR #90's historical SHA. Its standalone run is **NOT TESTED**; these commands are instructions rather than execution evidence. A PASS in isolated replay never overrides a red full-suite CI.

## Gate for closing this finding

1. Production owner supplies a reviewed fix in its own source branch, preserving attempts==2, y-only retry, x/z unchanged, no foreign file deletion, and full safety/security cases.
2. New QA premature-idle test and the unchanged original retry assertion both pass repeatedly under isolated and normal full-suite CI; inspect partial files, failure.kind, lifecycle transitions, timeouts, side effects and concurrent cleanup.
3. Coordinator updates a **new pinned integration SHA** and reruns TypeScript, Studio parity, full CI, then serial Mac real HTTP/CSRF → Remotion/Manifest/MP4 → genuine owner 1× AV review and explicit scene approval → next-scene unlock.
4. Master/publish and queue/CLI production gates remain BLOCKED until separately demonstrated.

**No merge, publish, Mac heavy run or modifications of main/PR #77/source-team branches were made by QA.**
