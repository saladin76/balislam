# Studio Handoff Contract — Claude ↔ ChatGPT (draft)

This protocol is for the three independent channels: `balislam`, `dafatir-alzaman`, and `zubdat-alkutub`. It is an opt-in operational contract; it does **not** activate any background watcher.

## Authority and workflow
1. **Owner** assigns an instruction from the channel's ChatGPT reviewer to its Claude implementer, and watches the actual results in Studio. Only the owner makes final approval/publication decisions.
2. **Claude** works only on the designated channel/episode/worktree, keeps render or edit source tracked, and verifies the finished artifact locally. A partial, rendering, pending, or failed output must never be uploaded.
3. After a successful output, **Claude** calls the installed explicit uploader from whichever worktree it used:
   ```bash
   "$HOME/Balislam-Preview-Sync/studio-handoff.sh" upload --kind video --file "/absolute/path/to/verified-preview.mp4" --channel balislam --episode 001-know-the-truth --slot scene-c1-s1
   "$HOME/Balislam-Preview-Sync/studio-handoff.sh" upload --kind storyboard --file "/absolute/path/to/board.pdf" --channel balislam --episode 001-know-the-truth --slot visual-board
   ```
   Specify a real, verified file; do not scan all worktrees to select a recent match. Use a stable slot for each deliverable. Preserve the actual episode slug.
4. The uploader checks source integrity and Drive MD5, returns `VERIFIED`, `LINK` and a local `HANDOFF` path. Claude must report any failure rather than claim cloud success.
5. **Claude's report** should include the original task/directive, branch and commit, changed files, exact artifact slot and link, test command/results, visual checks performed versus not performed, known issues, and what reviewer should examine next. It should also copy the relevant channel/episode handoff markdown from `$HOME/Balislam-Preview-Sync/handoffs/<mapped-channel>/<episode>.md`. Reports must never invent an approval.
6. **ChatGPT** reviews the linked storyboard/preview and the implementer's report, and sends one unambiguous corrective directive per iteration. Distinguish an actual continuous realtime playback review from frame-only or sampled review. Do not equate passing code checks with visual approval.
7. Owner transfers reports/decisions between conversations and makes final approval decisions.

## Artifact policy
- Videos and storyboard artifacts use separate Drive folders and each logical slot replaces its previous version. Revisions do not create duplicate revision-named cloud objects.
- `plan.json` is a *plan*, not an approved storyboard. `storyboard.json` is a state/approval record, not visual storyboard frames. A PDF/PNG visual board must exist before claiming visual-board delivery.
- Storyboard approvals are not implied by cloud upload. The review report is always `PENDING`.
- Do **not** send unlicensed audio/recitations, private secrets, credentials, or other restricted data to link-accessible Drive. Uploaded files may be accessible to anyone with the link.
- Old LaunchAgent `com.balislam.preview-sync` must remain disabled. No broad worktree mtime scanning.
- No automated deletion of local footage, originals or masters; even with a published record, cleanup remains report-only.
- The isolated rollout branch `fix/studio-preview-safe-cloud-sync` is not production merge. The shared Mac uploader works from any worktree only when explicitly called; existing Claude CLI processes are not automatically intercepted.

## Rollout gates
- Offline Python tests and read-only Drive access: **passed on owner's Mac** (8 tests, 2026-11-06).
- Real video and real `plan.json` upload: **passed**.
- Actual visual storyboard frames upload: **not yet tested**.
- Cloud overwrite/ID stability on an edited real slot: **not yet verified**.
- Automated trigger from actual Claude production render flows and full workflow review: **not yet verified**.
- Main branch merge: **not approved**.

Do not issue permanent per-chat instruction templates until these rollout gates are resolved; the owner has requested a final operational message for each of the 3 ChatGPT reviewer conversations and 3 Claude implementer conversations.
