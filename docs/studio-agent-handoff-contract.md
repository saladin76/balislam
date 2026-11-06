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

## Execution environments and transfer boundary

Claude sessions may run in two different environments, and this must be reported honestly.

**Local Mac-connected Claude:** When the session has authorized access to the owner's Mac, Claude can call the installed `$HOME/Balislam-Preview-Sync/studio-handoff.sh` directly with the exact finished file path. Treat the `VERIFIED` / `LINK` / `HANDOFF` output as proof of transfer, not visual approval.

**Cloud Claude (no Mac access):** It must not pretend that `$HOME/Balislam-Preview-Sync`, `rclone studio_drive`, or Mac secrets are available. It should verify the existing artifact/Studio preview, provide commit/path/checksum and its review report, then mark cloud handoff as `PENDING_TRANSFER`. Do not install or export Mac credentials to the cloud, and do not switch to an unrelated uploader while claiming to have tested this system. A pre-existing Drive link can be referenced as prior evidence but never presented as a new successful transfer.

**GitHub-to-Mac bridge:** A guarded Mac consumer and a dedicated GitHub queue are implemented on the unmerged development branch (details below). The first synthetic queued artifact was successfully delivered GitHub → Mac → Google Drive on 2026-11-06, with checksum verification. Automatic polling is **not** enabled; a real production-channel artifact handoff and owner review are still pending. Cloud agents must not claim success until the Mac uploader returns its verified link.

## GitHub-to-Mac bridge: implemented, NOT scheduled

A dedicated queue exists on GitHub branch `studio-handoff-queue` at `studio-handoff/queue.json`; it has contained a synthetic validation job. Do not assume the queue is empty or that old jobs are automatically removed. This branch does not modify `main`. The Mac-side consumer is `scripts/studio-handoff-bridge.py`, shipped in the protected local installer branch. It only reads the named queue from `origin/studio-handoff-queue`, validates every request, extracts the content of an exact **reachable Git commit** and path, verifies SHA-256, then passes the resulting immutable bytes to the existing checked uploader. It never runs scripts from the queue and never scans folders.

Example request (documentation only; this does not request any new transfer):

```json
{
  "version": 1,
  "jobs": [
    {
      "id": "review-001-scene-a-v1",
      "channel": "balislam",
      "episode": "001-know-the-truth",
      "slot": "scene-a",
      "kind": "video",
      "commit": "FULL_40_CHARACTER_GIT_COMMIT_HASH",
      "path": "channels/balislam/episodes/001-know-the-truth/previews/scene-a.mp4",
      "sha256": "FULL_64_CHARACTER_FILE_SHA256"
    }
  ]
}
```

The example is **not valid until hashes are replaced with genuine values**. The specified commit must be a reachable ancestor of `studio-handoff-queue`; the file must be committed as a regular Git file and actually exist in that commit. A Claude session without Mac access can publish an authorized, exact artifact into the queue branch and append the job, but must report `PENDING_TRANSFER` until a Mac run reports `DELIVERED` with a verified link. It must not expose secrets or include restricted audio. For large videos, Git LFS pointers cannot stand in for actual Git blobs: currently unsupported; the bridge rejects checksum mismatches.

Run **read-only transfer dry-run** after installer:

```bash
/opt/homebrew/bin/python3 "$HOME/balislam-cloud-preview-ready/scripts/studio-handoff-bridge.py" --fetch --dry-run
```

When the queue is empty, expected: `BRIDGE_OK DRY_RUN 0 jobs`. If the previously staged synthetic validation job remains, dry-run may instead show one already-delivered job; inspect its ID and fingerprint, never assume a fresh upload is required. This fetches only the named Git branch and validates queue structure, **without uploading**. To apply after a user-reviewed job is placed in the queue, omit `--dry-run`; currently there is deliberately no LaunchAgent or background schedule. The installer never activates one. Every verified job is recorded under `$HOME/Balislam-Preview-Sync/bridge-delivered.json`, enabling idempotent runs. The bridge is not an access-control boundary against malicious GitHub writers who can push to the queue branch; restrict branch write permissions before unattended automation.

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
- Cloud overwrite/ID stability on an edited real slot: **passed on owner's Mac** (2026-11-06). Real uploads of synthetic JSON revisions 1 and 2 verified MD5, one remote file, and unchanged sharing URL `https://drive.google.com/open?id=1xCDBR1is6z5H9KSiR9a48Z26rgDLSRQf`.
- Synthetic GitHub → Mac → Drive bridge queue delivery: **passed 2026-11-06**. Job `bridge-smoke-balislam-001` delivered an 81-byte non-production JSON file with verified MD5 at `https://drive.google.com/open?id=1xgt3ulA6MGs8fpx6FbrdAGsyexbVhgZy`; this establishes transfer only, not channel-production acceptance.
- Queue write restrictions/branch protection: **not verified**. Production automation must not be enabled without restricting queue writers and testing authorization.
- Production Claude artifact handoff and report visibility inside Studio: **not yet verified**.
- Automated trigger from actual Claude production render flows and full workflow review: **not yet verified**. First Claude cloud session confirmed it cannot reach Mac's rclone or shared uploader; it appropriately reported no new upload.
- Main branch merge: **not approved**.

Do not issue permanent per-chat instruction templates until these rollout gates are resolved; the owner has requested a final operational message for each of the 3 ChatGPT reviewer conversations and 3 Claude implementer conversations.

## Mac verification for stable revision links

Successfully executed on owner's Mac (2026-11-06); to recheck if required, run `bash "$HOME/balislam-cloud-preview-ready/scripts/verify-cloud-overwrite.sh"`. The test uploads a small synthetic JSON document twice to a dedicated `sync-system-validation/storyboard/overwrite-json.json` cloud slot, compares links, confirms exactly one logical file, and leaves production files untouched. The test artifact remains in Drive for audit; its content contains no sensitive production material. A link change or duplicate fails verification and blocks rollout.
