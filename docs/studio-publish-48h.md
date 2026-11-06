# Studio — Localhost publication readiness (6–8 November 2026)

**Scope:** Mac localhost only. Vercel is not used. This track is deliberately separate from the draft PR #47 / #49 cloud handoff and UI work. Finishing every Studio feature is **not** a prerequisite for one approved, manually published episode.

## Workflow ownership
- One ChatGPT reviewer and one Claude implementer for each channel: `balislam`, `dafatir-alzaman`, `zubdat-alkutub` (six production conversations).
- Claude: source edits, animation, renders, tests, and truthful handoff reports.
- ChatGPT: content and visual review, corrective directives, quality acceptance recommendation. It cannot grant ownership approval.
- Owner: transfers reports, watches the complete produced episode in Studio, grants or refuses final approval and publishes.
- Google Drive handoff means **delivered for review**, not publish-approved. Restricted audio and private content must not be made link-public.

## Recommended: two-command Mac bootstrap and audit

```bash
cd "$HOME/balislam"
git fetch origin feat/studio-local-release-audit
bash <(git show origin/feat/studio-local-release-audit:scripts/setup-studio-release-audit.sh)
```

This installs the audit scripts under `~/Balislam-Preview-Sync/release-audit/`, runs all **nine** isolated Node fixture tests (five audit + four locator), prints the diagnostic status for the current checkout, and locates candidate episode script folders in **registered** Git worktrees using filename metadata only. The diagnostic may print `AUDIT_BLOCKED` even though `AUDIT_TESTS_OK` appears; they represent different things. No episode data is changed. For the accurate active media state of each channel, run the suggested command using that channel's worktree path.

## Mac: one local diagnostic command (read-only)
From Terminal with the existing `~/balislam` checkout:

```bash
cd "$HOME/balislam"
git fetch origin feat/studio-local-release-audit
mkdir -p "$HOME/Balislam-Preview-Sync/tools"
git show origin/feat/studio-local-release-audit:scripts/studio-release-audit.mjs > "$HOME/Balislam-Preview-Sync/tools/studio-release-audit.mjs"
node "$HOME/Balislam-Preview-Sync/tools/studio-release-audit.mjs" --root "$HOME/balislam" --episode 001
```

## Observed owner Mac audit — 6 November 2026

The standalone audit passed **5/5 unit tests**, then examined `/Users/sword/balislam` on the local branch `review/balislam-directed`. It reported:
- `balislam/001`: no script-backed episode 001 in **that root**
- `dafatir-alzaman/001`: no script-backed episode 001 in **that root**
- `zubdat-alkutub/001`: 31 plan scenes; storyboard hashes 0/31; scene approvals 1/31; matching voice clips 0/27; no master/package/owner approval **in that root**.

This does **not** mean the other episodes were deleted, nor that their current production assets are missing from all Mac worktrees. The registered-worktree locator was added in response, to explicitly identify paths for owner/Claude confirmation without touching files. **Never merge/recreate/re-render based only on a missing file in the inspected branch.**

If each Claude conversation uses a **different channel worktree**, do **not** assume `~/balislam` contains its current untracked voice/video renders. Use the exact worktree path explicitly and one channel at a time, e.g.:

```bash
node "$HOME/Balislam-Preview-Sync/tools/studio-release-audit.mjs" --root "/absolute/path/to/zubdat-worktree" --channel zubdat-alkutub --episode 001
```

To locate existing worktree paths (read only): `git -C "$HOME/balislam" worktree list`. Choose the correct branch/worktree deliberately; **the audit never scans every worktree or chooses the newest video by timestamp**.

The command writes **only a copy of the audit tool** under `Balislam-Preview-Sync/tools`, then reads episode state. The diagnostic exits 1 when any channel remains blocked; that is expected during production and is not an application crash. It never uploads, renders, publishes, deletes, changes status, or updates the production checkout.

Run `node --test tests/studio-release-audit.node.test.mjs` from a checkout of this feature branch to test the audit itself. The four test cases use synthetic fixture files only. The audit is an extra inventory: **the existing authoritative `bal` gates and the owner's full video review remain compulsory**.

## Decision order for 8 November
1. **6 Nov:** run the audit and select the closest real episode to completion, based on actual Mac evidence. Do not assume existing silent previews are uploadable masters.
2. **7 Nov:** ask its Claude implementer to close the specific reported gaps, produce a complete preview and verify scene-by-scene. Reviewer evaluates it, including full 1× audio playback; owner reviews and records final approval.
3. **8 Nov:** only if all source, storyboard, scene, voice, rights, technical and editorial gates pass, create or verify a `master` package; approve the final file in Studio; upload manually using channel-owned accounts, check the public result, and archive evidence. If it is not approved, do not publish an unreviewed video merely to meet the calendar date.

The final export command, **only after all scene/storyboard/source/audio gates pass**:

```bash
cd "$HOME/balislam"
npm run bal -- --channel CHANNEL_ID check 001
npm run bal -- --channel CHANNEL_ID review 001
npm run bal -- --channel CHANNEL_ID scenes-review 001
# Storyboard approval must be inspected within Studio, and the complete movie watched.
npm run bal -- --channel CHANNEL_ID package 001
```

Replace `CHANNEL_ID` with the selected channel ID. `package` is expensive: it can render a full master, write generated metadata, and invalidate earlier approval/shorts. Do **not** run it as a diagnostic, and never use `--ignore-scene-review` to hurry publication. The official release approval is for the final file after export.

## Minimum release checks
- Current script, citations, and plan validated by their existing authoritative checks.
- Storyboard hashes approved for **all current scenes**.
- Every scene reviewed as OK; no fix, pending or changed.
- Audio matches current narration for every spoken scene; recitations rights and licensing verified.
- A full `master` with sound, complete playback review, smooth motion, no cut-off captions, credits and metadata.
- Valid owner approval bound to the exact current master file.
- YouTube/other platform text, translated captions, thumbnail and usage rights reviewed.
- Upload and public-page check done manually by the owner, not by a test runner.

## Do not
- Do not run `fresh-start.command`: it can reset local tracked work and archive files.
- Do not reset/clean Git worktrees, delete masters, or start mass re-rendering.
- Do not enable old preview-sync LaunchAgent, unattended GitHub queue consumer, or automatic publication.
- Do not treat GitHub's absence of local `voice/`, `out/package/`, or video files as conclusive; the Mac checkout is authoritative for those.
