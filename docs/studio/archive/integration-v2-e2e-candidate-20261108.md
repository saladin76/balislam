> أرشيف — السلوك الحالي في studio-map.md

# Studio V2 — isolated E2E integration candidate

**STATUS: UNTESTED CROSS-TEAM AGGREGATE, DRAFT — NOT RELEASE AUTHORIZATION.**

Base PR #77 commit: `2d6523d61ccbf6dc434f887bd0b7548a1acd1250`

| Workstream | Draft PR | Pinned HEAD | Files imported |
|---|---|---|---:|
| Backend | #88 | `5e747a85f7ff2ff7728a79890af3b846169f0edc` | 23 |
| Render | #86 | `23c2c3adaf8bc5112d61b0d40b0a86767d48a83f` | 19 |
| UI | #87 | `247a9cbe86bc7f3e977ff81a67941c990e610a0e` | 19 |
| QA | #85 | `c9e9ee0c78f967604420f771dacd3cf667e0f86e` | 14 |

Total distinct imported paths: 75. All from GitHub Git blob SHAs on pinned independent branches; no production episode data overwritten. No source path conflicts were detected.

## Scope and limitations

- This is a new isolated integration tree; none of the original PRs, `main`, or any real episode was merged or edited.
- Source files are combined by their exact Git blob hashes, with no conflict resolution or code modification. **There is no evidence yet that they compile or work together.**
- CI typecheck/tests and preview parity must run on THIS exact aggregate HEAD; separate green PR checks are not equivalent.
- Need real Mac/Chrome integration QA on a NEW QA-only episode and a real `studio-v2-scene` output, not only synthetic FFmpeg fixture.
- Backend ↔ UI authenticated session, Origin, CSRF, scene read-model, notes, challenge-based 1x AV viewing and explicit owner approval must be verified end to end.
- Backend ↔ Render execution-time signed spec, exclusive lease, shared artifact mutex, nine-input signed manifest and exact AV hash/epoch check must be verified end to end.
- Worker dequeues, retries, stale queued jobs, recovery, CLI and direct Remotion entrypoints must be prevented from bypassing V2 approvals.
- Separate Master assembly, full-episode 1x review, exact Master owner signoff, frozen-byte fake publisher and no real publication remain BLOCKED.
- The included Remotion sample MP4/PNG is test-only GitHub Actions evidence; technical decoding does not prove human creative review or Quran provenance.
- Reported npm audit 10 High requires triage, and hosted preview may fail due to external rate limits.

## Non-negotiable

Keep this as Draft, do not merge to main or PR #77, do not enable publishing or modify production episodes.
QA acceptance tracker: https://github.com/saladin76/balislam/issues/89

## Next QA checkpoints

1. `npm ci`, `npm run typecheck`, `npm test`, independent UI tests and gate/parity in isolated checkout. Observe all failures without replacing any real workflow gate with a mock.
2. Run opt-in real HTTP and Remotion/FFprobe QA only on explicitly labelled, isolated three-scene QA episode after checking local RAM/disk.
3. Preserve exact test evidence, source SHA, signed media registry and browser receipts. Reclassify each of the 17 TODO gates only after running its genuine production entrypoint.
4. Stop at a P0 failure. No real publisher invocation.
