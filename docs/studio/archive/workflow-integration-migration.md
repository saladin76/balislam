> أرشيف — السلوك الحالي في studio-map.md

# Studio — trusted workflow integration checkpoint (PR #78)

**Status: isolated Draft. No merge, Mac production change, render or publication authorized.**

## Integration built

1. `src/workflow/artifacts.ts` derives canonical stage fingerprints from **actual episode disk bytes**. Script input includes `script.md`, citations and explicit signoff; storyboard includes content-specific visual hashes and human review; voice includes file bytes, scene index, recitation provenance and audio reviews. Motion requires the current report, integrated AV review requires an actual preview, and Master hashes **the exact final video bytes** using streaming SHA-256, not size/mtime.
2. `src/workflow/server.ts` exposes a server-only adapter for durable ledger reads, version-checked owner decisions and independent evidence verification. Script-first ayat must match the configured approved Mushaf; neither the API nor this adapter silently changes Quran text. No caller-supplied snapshot, role or evidence is trusted.
3. Local Studio API `GET /api/episodes/:NNN/workflow?channel=...` returns the six stages, mapped display status, verified approver and current fingerprints. `POST` accepts only `{action,stage,expectedFingerprint,note,confirmWatched?}` with `x-studio-owner-token` header and a server-configured owner token. The UI **reads** verified status, but does not grant approval just from a technical test.
4. Master rendering requires the workflow `master_render` gate in addition to the earlier explicit script / storyboard / whole-narration checks. Short packaging and new status approvals/publication are blocked until the current exact Master satisfies the `publish` gate.

## Safe owner setup (on a future isolated/review installation)

Generate a unique random token (32+ unpredictable characters) and set it as `BAL_STUDIO_OWNER_TOKEN` **in the local server's private environment only**. Optional `BAL_STUDIO_OWNER_ID` identifies the owner in the audit ledger. Do **not** commit the token, store it in channel data, put it in URLs, add it to GitHub PR comments, or share it with workers. If not configured, approval writes remain disabled. The token is not needed to read current stage status.

After inspecting current evidence, the owner explicitly submits and approves each stage in order, using the current `expectedFingerprint`; the server rehashes the actual files before persisting. Full voice approval requires an independent complete listening record and owner confirmation. AV review must be watched at actual 1×; exact Master signoff requires full explicit review, legitimate rights and a quality record.

## Important remaining safeguards

- The Vite local server currently has legacy manual approval routes whose submitter name is supplied by the browser; **only the new workflow ledger is an authoritative release gate**. Existing historical `status.json` is not authoritative for Master/publish.
- Cross-process concurrent edits between final snapshot and an external upload must be prevented by an immutable versioned dispatch, a coordinated lock, and rehash at the exact point of upload. There is no automatic external publishing in this PR.
- Verify the six-stage approval experience end-to-end in an isolated Mac worktree, including signed actions, the absence of an owner token, stale content, three channels and actual desktop/mobile rendering. Do not copy an untested local ledger into production.
- The complete six-worker handbook and permanent three-channel instructions follow **after** the finalized integration architecture is accepted.
- Vercel is outside the project; no Vercel deployment or approval is required.
