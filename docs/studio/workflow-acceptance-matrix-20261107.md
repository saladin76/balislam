# Studio workflow engine — acceptance and evidence matrix

**Status:** Draft PR #77. Scope is ONLY the independent engine, persistent records, real-byte manifest verification, secure server contracts and synthetic acceptance tests. **All full test execution results currently NOT_RUN** because GitHub Actions jobs terminate with `runner_id=0`, no allocated runner and zero executed steps. A test file being present is not a passing test.

## Contract/denial matrix

| Acceptance | Engine implementation | Regression evidence to run in isolated copy | Status |
| --- | --- | --- | --- |
| Six stages, five statuses, strict prior approval | `src/workflow/gates.ts`, `store.ts` | `tests/workflow-gates.test.ts` six-stage transition, bypass and reject/reopen | Written / not executed |
| No forged owner, no browser actor/role/evidence/paths | `src/workflow/service.ts` and `trust.ts` | `tests/workflow-service-security.test.ts` spoof, unsigned/forged/expired attestation, reviewer publish | Written / not executed |
| Verified evidence receipts from actual owned files | `src/workflow/artifacts.ts`, `service.ts` | evidence changed during verification and after approval, missing/symlinked receipt, receipt omitted from manifest but edit/restore detected by epoch | Written / not executed |
| Script/Storyboard/audio/motion/AV/Master edits revoke dependents | `gates.ts` plus signed `store.ts` reconciliation | `tests/workflow-service-security.test.ts` six real-byte mutation parameter cases | Written / not executed |
| No resurrection of approval on exact byte rollback or new upstream signoff | `ArtifactVersion.epoch`, `approvalEventSeq`, `prerequisiteApprovalSeq` | `tests/workflow-gates.test.ts` reapproval and `tests/workflow-service-security.test.ts` write-and-restore without intermediate inspection | Written / not executed |
| HMAC, corrupted JSON and ledger tampering fail closed | `src/workflow/store.ts` signed v3 ledger | forged signed data, wrong/missing key, corrupted ledger and signatures | Written / not executed |
| Atomic persistence, concurrent processes, isolated episodes | `store.ts` per-episode exclusive lock + fsync + atomic rename | `tests/workflow-gates.test.ts` parallel approvals and three channels; `tests/workflow-process-concurrency.test.ts` five separate Node child processes | Written / not executed |
| No unsafe paths, symlinks, foreign or hardlinked assets | `workflowFileFor`, `resolveArtifact`, `sha256FileAndEpoch` | cross-episode path, channel symlink, file symlink, hardlink and self-reference cases | Partially written / not executed |
| Voice, final motion, Master candidate and exact publish deny side effects until authorized | `src/workflow/ports.ts` and `service.ts` | `tests/workflow-integration-contract.test.ts` denied callbacks never execute, same artifact lock, no nested publish lock | Written synthetic / not connected to real routes |
| Owner approval of **same actual MP4 bytes** before publication | `withVerifiedMasterPublication` | `tests/workflow-service-security.test.ts` immutable temp copy, SHA, epoch, modified Master, reviewer-denied dispatch | Written synthetic / not connected to real uploader |
| Safe UI read model compatible with PR #74 | `service.inspect() -> {uiSnapshot,view}` and `view.ts` | `tests/workflow-service-security.test.ts` currentApproval, schema3, no HMAC/receipt leak, role-dependent flags | Written / PR #74 actual parser not yet integrated |
| All W01–W13 entrypoints protected | Integration handoff `docs/studio/workflow-entrypoint-inventory.md` | Actual API + CLI + queue + publish negative and positive acceptance suite on integrated branch | Pending central conversation nine |

### Trust boundaries

- `service.inspect()` returns only `{uiSnapshot,view}` safe to serialize. `uiSnapshot` is schemaVersion:3 for PR #74 `parseWorkflowReadModel`; `view` is schemaVersion:1. Both derive from server-verified signed ledger and real file bytes/epochs. **Never serialize `inspectInternal()`** or accept a client-supplied `currentApproval`.
- `service.command()` accepts ONLY `{action,stage,expectedFingerprint,note}`. Server authenticates owner/reviewer and derives all evidence from scoped files and independent semantic validators. An arbitrary `verifiedEvidence` callback that simply returns `true` does NOT constitute human review.
- `createWorkflowProtectedPorts` ensures no effects before the respective gate, but the deployment must plug in a **single distributed/process-safe artifact edit lock** shared with every episode writer and queue worker. In-memory-only or per-process independent locks do not satisfy multi-process production safety.
- Even exact data hash + OS epoch cannot prevent a privileged attacker replaying an entire formerly signed filesystem state; a monotonic external revision anchor is needed against that separate threat. The engine fails closed on unexpected corrupted, unsigned or wrong-version ledgers.
- No code in PR #77 silently approves any existing episode, watches footage, generates Master, merges or publishes.

### Isolated execution required for engine-100% certification

1. Check out exact PR #77 HEAD to a fresh detached worktree, NOT the working Mac production folder. Separate `TMPDIR` and test-only HMAC signing key. Do not create or modify production episode files.
2. Run `npm ci` (record node/npm versions and exact lockfile), `npm run typecheck`, targeted workflow Vitest and **all** `npm test`, then `npm run gate`.
3. Confirm `tests/workflow-process-concurrency.test.ts` truly started five separate Node workers. Inspect JSON audit for one valid submission/approval and no leftover locks or temp files. Repeat on at least 2 iterations.
4. Verify test denial assertions and no side effects on an isolated set of material source files. Re-test upon every code change using the final HEAD SHA.
5. PR #74 compatibility must be tested against its actual `parseWorkflowReadModel` (not a new hand-authored mock parser) **after** integration. The original branch should not be edited by this PR.
6. For W01–W13, the central integration must run real HTTP/CLI/queue calls with fake paid clients and fake publisher, and prove denied requests perform no synthesis, final render or publication. Explicit owner confirmation of full AV 1× and exact Master bytes is separate from automated tests.

### GitHub Actions evidence

Prior runs on this branch failed during runner allocation, reporting empty job step arrays and `runner_id=0`. Example: [CI](https://github.com/saladin76/balislam/actions/runs/42403930068) and [Studio parity](https://github.com/saladin76/balislam/actions/runs/42403930114). Re-running earlier head attempts also failed with zero steps. **This is neither a code pass nor a demonstrated code failure**. Rerun on the **final** PR HEAD when runner availability is restored, or execute in an independent verified clone, and store test logs and SHA in this matrix.

**Decision:** Draft and not technically certified as 100% until the isolated suite passes. The full Studio remains UNPROTECTED by these gates until the central integration validates W01–W13.