# Safe Google Drive preview sync (opt-in)

This replaces the unsafe global Mac worktree scanner with an explicit post-render upload.

## Features

- Only a successful preview render from bal render triggers uploading.
- Disabled by default: set BAL_PREVIEW_CLOUD_AUTO=1 to enable after verification.
- A fixed Drive key per channel / episode / orientation / chapter overwrites that preview slot.
- MD5 verification is required before publishing a preview link.
- Maintains a deduplicated production-preview-index.md separate from the legacy preview-index.md.
- Does NOT scan or delete Git worktrees or local media.
- Does NOT delete remote historic worktree directories or empty Drive trash.
- No cloud credentials are checked into Git.
- Uses the existing rclone remote named studio_drive on the Mac.

## Install / activate on Mac

The old launchctl service MUST remain paused. The new upload works on completion of the bal render CLI (not yet every UI render or manually run ffmpeg/remotion render).

1. Pull this branch into the ACTIVE studio worktree using your normal git workflow. Do not reset other worktrees.
2. Ensure rclone config already has studio_drive and Python 3 is installed.
3. Run a single preview using BAL_PREVIEW_CLOUD_AUTO=1 npm run bal -- render 001 (pass -c or --channel as appropriate). Test before setting the env for normal work.
4. For any explicit completed MP4 or WebM, run:

   python3 scripts/studio-preview-cloud.py upload --file /absolute/path/video.mp4 --channel balislam --episode 001-know-the-truth --slot scene-c1-s1

The slot must be reused for the same logical scene so updates replace older content. Different portrait/landscape clips must use distinct slots.

## Important limitations

- Upload after render is integrated with the bal render CLI only. Other preview workflows are not automatically integrated.
- A video rendered before the new upload feature is not automatically backfilled.
- The old index and existing worktree-specific remote folders are untouched. Only the new production index is managed.
- Copying a different file to the same logical slot deliberately replaces its cloud content; do not reuse a slot across distinct scenes.
- If an upload errors after replacing cloud data, the index is not updated; the previous remote object may already have changed. Local original is never deleted.
- Google Drive may retain deleted items or old revisions in its storage accounting.
- Running rclone link may grant link-based access. Do not upload sensitive or unpublished footage unless this sharing mode is acceptable.
- OAuth testing tokens may expire; monitor auth failures and use approved Google OAuth settings.
- Cleanup-report ONLY validates evidence and never deletes Mac files. Local cleanup is not automated until exact per-episode ownership, immutable final backup, approval and verified publication are implemented.

## Diagnostics

The legacy launch agent should remain stopped:

    launchctl list | grep com.balislam.preview-sync || echo PAUSED

See cloud index in Drive at Balislam-Studio-Previews/production-preview-index.md.
