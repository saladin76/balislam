# Safe Google Drive preview sync (opt-in)

This replaces the unsafe global Mac worktree scanner with an explicit post-render upload.

## Features

- Successful `bal render` previews, committed video preview slots, and saved storyboard approvals/revocations trigger the same opt-in upload service.
- Disabled by default: set BAL_PREVIEW_CLOUD_AUTO=1 to enable after verification.
- Stable Drive keys are grouped by channel / episode / type / slot: `previews/` for MP4/WebM, `storyboard/` for storyboard approval JSON and readable Markdown. Image/PDF storyboard artifacts can also be uploaded explicitly.
- MD5 verification is required before publishing a preview link.
- Maintains a deduplicated production-preview-index.md separate from the legacy preview-index.md.
- Does NOT scan or delete Git worktrees or local media.
- Does NOT delete remote historic worktree directories or empty Drive trash.
- No cloud credentials are checked into Git.
- Uses the existing rclone remote named studio_drive on the Mac.

## Install / activate on Mac

The old launchctl service MUST remain paused. The new upload works on completion of the bal render CLI (not yet every UI render or manually run ffmpeg/remotion render).

The safe installer makes a separate worktree and does not modify dirty production worktrees:

    git -C "$HOME/balislam" fetch origin fix/studio-preview-safe-cloud-sync && bash <(git -C "$HOME/balislam" show FETCH_HEAD:scripts/setup-studio-cloud-preview.sh)

The isolated worktree needs its own node_modules (run `cd "$HOME/balislam-cloud-preview-ready" && npm ci` if required). To render a preview from there, with cloud sync on only for that command:

    "$HOME/Balislam-Preview-Sync/render-cloud-preview.sh" -c balislam render 001

Existing studio apps/worktrees do not inherit this change until the feature is merged and deployed into the active runtime. The installer does not start the legacy scanner.

For any explicit completed MP4 or WebM within the installed worktree, run:

   python3 scripts/studio-preview-cloud.py upload --file /absolute/path/video.mp4 --channel balislam --episode 001-know-the-truth --slot scene-c1-s1

For a manually produced storyboard image, PDF or document, use the same uploader with `--kind storyboard`:

    /opt/homebrew/bin/python3 scripts/studio-preview-cloud.py upload --kind storyboard --file /absolute/path/storyboard.pdf --channel dafatir-alzaman --episode 001-adam-beginning --slot storyboard-final

Use the verified interpreter from `$HOME/Balislam-Preview-Sync/verified-python-path.txt` if the example path differs. The auto-hook uploads approved storyboard **text/metadata**, not a rendered gallery of storyboard frames. Such PNG/PDF panels must be generated first and explicitly passed to the uploader.

The slot must be reused for the same logical scene so updates replace older content. Different portrait/landscape clips must use distinct slots.

## Two-agent production handoff

Each channel has a Claude implementation conversation and a ChatGPT review conversation. The owner relays approvals and execution reports; no upload is an approval.

After successful Mac setup, Claude can upload from **any active worktree**, using an explicit, finished video or storyboard source:

    "$HOME/Balislam-Preview-Sync/studio-handoff.sh" upload --file /absolute/path/scene.mp4 --kind video --channel balislam --episode 001-know-the-truth --slot scene-c1-s1

    "$HOME/Balislam-Preview-Sync/studio-handoff.sh" upload --file /absolute/path/board.pdf --kind storyboard --channel balislam --episode 001-know-the-truth --slot visual-board

The hook returns VERIFIED, LINK and HANDOFF. The HANDOFF is a **local review report** under `$HOME/Balislam-Preview-Sync/handoffs/<channel>/<episode>.md`; Claude may copy its content into its execution reply to the owner. Reports contain only links to successful uploads for that channel/episode, timestamps and checksum metadata, plus a PENDING review flag. Execution/testing notes still need to be supplied by Claude.

For regenerating the report without upload:

    "$HOME/Balislam-Preview-Sync/studio-handoff.sh" handoff --channel balislam --episode 001-know-the-truth

The shared wrapper is available from any worktree after installation, but it does **not** automatically intercept external/CLI renders launched by Claude unless those workflows explicitly call it after completion. The legacy scanner remains disabled. Never upload copyrighted/restricted recitations or sensitive files via this link-sharing mechanism without proper authorization.

## Important limitations

- Upload after render is integrated with the bal render CLI only. Other preview workflows are not automatically integrated.
- A video rendered before the new upload feature is not automatically backfilled.
- CI runners may be unavailable; GitHub Actions status is not proof of having exercised the tests unless a job actually ran.
- The old index and existing worktree-specific remote folders are untouched. Only the new production index is managed.
- Copying a different file to the same logical slot deliberately replaces its cloud content; do not reuse a slot across distinct scenes.
- If an upload errors after replacing cloud data, the index is not updated; the previous remote object may already have changed. Local original is never deleted.
- Google Drive may retain deleted items or old revisions in its storage accounting.
- Audio review slots ending in `-audio` are skipped; do not use the tool to upload externally restricted recitations.
- Storyboard approvals and revocations write `storyboard-review.md` locally, but the uploader only transfers when `BAL_PREVIEW_CLOUD_AUTO=1`.
- Storyboard JSON/Markdown are review records, not graphic frames. Only explicitly produced image/PDF storyboard assets can be transferred as visual files.
- Running rclone link may grant link-based access. Do not upload sensitive or unpublished footage unless this sharing mode is acceptable.
- OAuth testing tokens may expire; monitor auth failures and use approved Google OAuth settings.
- Cleanup-report ONLY validates evidence and never deletes Mac files. Local cleanup is not automated until exact per-episode ownership, immutable final backup, approval and verified publication are implemented.

## Diagnostics

The legacy launch agent should remain stopped:

    launchctl list | grep com.balislam.preview-sync || echo PAUSED

See cloud index in Drive at Balislam-Studio-Previews/production-preview-index.md.
