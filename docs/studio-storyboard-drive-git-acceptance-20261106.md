# Studio 001 — Storyboard delivery and Git worktree acceptance (2026-11-06)

Owner's corrected order for all channels: source-checked script → **complete illustrated Storyboard** (versions preserved, visually reviewed) → per-segment tone → human-approved narration → synced video → full 1× audiovisual review → exact master approval. The old *silent motion* diagnostic is not the gate for accepting the **visual design**. Missing Quran text remains a blocker for **final visual approval**, not for *draft delivery*.

## 1. Confirmed Drive delivery — Zubdat 001 V021

- Channel: `zubdat-alkutub` (`zubdat-al-kutub` in Drive).
- Version: `storyboard-visual/v021`, manifest at `channels/zubdat-alkutub/episodes/001-awwal-marra-osalli/storyboard-visual/v021/manifest.json` on `main`.
- Connected Google Drive readback: **32/32 files** in the real parent `Balislam-Studio-Previews/zubdat-al-kutub/episodes/001-awwal-marra-osalli/storyboard` (**31 PNG scene boards + 1 PDF**), *all 32 Drive file IDs and byte lengths match GitHub manifest*.
- Real Drive folder: https://drive.google.com/drive/folders/1gNe-PQp20mqZa9x0VNusY16zq-lzAfyL
- PDF: https://drive.google.com/file/d/1MTtTbSufZN2N0OFueEAjsOlLiaBSglMd/view
- **Independent byte-level verification completed:** all 32 raw files were downloaded directly from the connected Google Drive (one PDF + 31 PNGs). Independently recomputed **MD5 AND SHA-256** for each downloaded file match **32/32** GitHub V021 manifest entries, with zero mismatches; the live parent folder also contains exactly 32 matching IDs/sizes. This is a VERIFIED file-delivery audit, **not** visual, Quranic, or publishing approval. PDF sha256: `44add0df1805df5fbc59e4f35a090b61f950d0ad1a6489c8a46685d5d8486f32`; MD5: `5b6467732a36ec825044534e24e4ad5d`.
- **Not approved:** these are only `PENDING_REVIEW`. Existing voice/video must not start solely because uploads exist.
- CAUTION: there are two **parallel folders named `episodes`** under the `zubdat-al-kutub` Drive channel. The previously created empty episode folder is not the actual delivered V021 folder. **Do not delete, merge, move or reupload without verifying exact IDs.** The uploader may choose a different duplicate folder by path. Prefer exact URLs for reviewers.

## 2. Dafatir 001 — original V1 and updated V1.1 (NOT YET verified in Drive)

- GitHub on main contains both `tech-reviews/020/docs/storyboard-001-v1.pdf` and `tech-reviews/020/docs/storyboard-001-v1.1.pdf`; the latter is 85 pages according to the accompanying report and covers 80 scene boards + opening frames.
- Accompanying source metadata: `storyboard-001-v1.1.json`; original V1 JSON preserved.
- The previously created Drive folder `https://drive.google.com/drive/folders/1wiFhT_4u98hLMpJQQwk1TUvNft54pMbp` is empty at readback. There is **no live verified evidence that V1/V1.1 PDFs were delivered there**.
- The version in the task says `v1/v2`; the current GitHub contents specifically prove **V1/V1.1 for Dafatir** and **V2 textual instructions + V021 visual book for Zubdat**. Do not rename V1.1 to V2 or assume unknown V2 bytes were supplied.
- Existing helper `tech-reviews/020/drive-upload.sh` is **unsafe to run blindly**: it truncates `drive-upload.log` with `: >`, uses a relative uploader path `scripts/studio-preview-cloud.py` (available in draft PR #47, absent on main), and uploads `previews/episode.mp4` even though owner explicitly forbade video render/delivery in this task. **Do NOT execute it as-is.**
- The local Mac file `scripts/handoff-storyboard.sh` named in the request was **not present in main or PR #47**, and its local bytes on Mac were never inspected. **Do not run that unknown local copy.** Instead this PR contains a freshly reviewed `scripts/handoff-storyboard.sh` (see following paragraph); it is explicitly STORYBOARD-ONLY.

## 3. Safe Mac Terminal checks without changing project or uploading content

```bash
cd "$HOME/balislam"
# First inspect worktree and scripts; no remote writes:
git status --short
git worktree list
find "$HOME" -name handoff-storyboard.sh -type f -print 2>/dev/null
# Once found, replace the path below only with the EXACT found path:
# bash -n "/ABSOLUTE/PATH/handoff-storyboard.sh"
# sed -n '1,240p' "/ABSOLUTE/PATH/handoff-storyboard.sh"
# Ensure it lists ONLY the required v1/v1.1 (or explicitly provided v2)
# storyboard PDF/JSON/images. DO NOT include videos, MP3, git reset or git push.
```

### New safe storyboards-only Mac delivery wrapper

This PR adds `scripts/handoff-storyboard.sh`. It is **CHECK-ONLY by default**, accepts an explicit absolute Mac `--source-root`, and inspects precisely four existing Dafatir files: V1 PDF/JSON and V1.1 PDF/JSON in `tech-reviews/020/docs`. It refuses empty/symlink sources, checks the exact Drive destination folder by ID `1wiFhT_4u98hLMpJQQwk1TUvNft54pMbp`, refuses different remote contents at the same name, uses `rclone copyto --ignore-existing` to prevent any overwrite even on a racing concurrent uploader, then re-verifies remote MD5 and queries the actual provider file ID through `rclone lsjson`. It appends secure, version-named receipts to `~/Balislam-Preview-Sync/storyboard-receipts`. It does **not** call `rclone link` (which can change sharing permissions), does **not** upload MP4 or voice, and does **not** touch Git, `handoff.md` or `production-preview-index.md`. If provider ID is unavailable, it records `VERIFIED_BYTES_LINK_PENDING` and fails closed. It has static non-destructive contract tests.

```bash
# After a clean Mac git checkout of the audited PR code:
bash scripts/handoff-storyboard.sh check --source-root "/ABSOLUTE/EXISTING/WORKTREE"
# Only after examining output, exactly which files/versions will move,
# and owner approval to transfer those FOUR sources:
bash scripts/handoff-storyboard.sh upload --source-root "/ABSOLUTE/EXISTING/WORKTREE"
```

**Updated 2026-11-06 after the owner's later Mac log:** the explicit `upload` **did run** from `$HOME/balislam-storyboard-visual-preview`, and the Mac transport reported `VERIFIED` for all four assets. We independently listed the exact Google Drive folder with the connected Drive account; it contains these four files with matching IDs, names, and sizes:

| Version | File | Bytes | Provider file ID | SHA256 logged on Mac |
| --- | --- | ---: | --- | --- |
| V1 | `storyboard-001-v1.pdf` | 18555254 | `1DKkmkEG29doyJXkayIkeQJA4x0rLTzzS` | `2f94715946b32661b833281d2382441fba6d938c84da5fefbd87e8cfa5d990dd` |
| V1 | `storyboard-001-v1.json` | 148796 | `10oRG3FT08J8kaWFmamsFpoViQ055fIPe` | `325ae5586c40671b34b84c0bb8bc8e700110c7ccfcd7562006cea6c3e12f258e` |
| V1.1 | `storyboard-001-v1.1.pdf` | 20160831 | `18xQXzJFR6VPyYj9lqJYS6959yxeDA7pU` | `454b58578062c89d92f541d112e7f3b558c7557f74a79b14bf18f0bd67b48059` |
| V1.1 | `storyboard-001-v1.1.json` | 152238 | `1aWF6jCDec9HjGcAvq3RiGUxmTTpoHNWL` | `99d4fb0596b8ee7470909a14651895f3ae47d649e9784aea5e161ecad794b2b3` |

Destination: https://drive.google.com/drive/folders/1wiFhT_4u98hLMpJQQwk1TUvNft54pMbp . Mac append-only receipt: `~/Balislam-Preview-Sync/storyboard-receipts/dafatir-001-storyboards-20261106T202743Z-88043.log`. The connector also verified one uploaded PDF was **not publicly shared**, preserving its owner-only permission. The Mac transport compared remote MD5 with local MD5; connected Drive readback independently corroborated IDs/sizes. Neither the remote content hashes nor editor approvals were independently regenerated in this cloud session. **This confirms delivery of bytes, never an approval to publish.**

For **other asset kinds**, retain the existing explicit guarded Mac transporter `$HOME/Balislam-Preview-Sync/studio-handoff.sh`: `upload --kind storyboard --file /ABSOLUTE/PDF_OR_PNG --channel <channel> --episode <slug> --slot <unique-versioned-slot>` for PDF/images, and `upload --kind video --file /ABSOLUTE/MP4 --channel <channel> --episode <slug> --slot <unique-versioned-slot>` for previews. Use a unique versioned slot for each immutable review deliverable, and require fresh `VERIFIED` + `LINK` (with local+remote hash proof); do not enable the unattended GitHub→Mac bridge. Independent Drive evidence: existing Zubdat V021 artifacts (31 PNG + 1 PDF) in the **historical** folder `1gNe-PQp20mqZa9x0VNusY16zq-lzAfyL`, whereas its newly created canonical folder `1UQM0_IGkDVieu5C4LfCYBgDfYm-5T1QF` remains empty. The balislam episode preview folder contains a **technical validation** `sync-validation.mp4`, not a signed production video. Do not claim three-channel production MP4 acceptance.

The documented `studio-preview-cloud.py upload` interface uses `--kind storyboard --channel ... --episode ... --slot ... --file ...` and prints `VERIFIED` and `LINK` if the real rclone upload and MD5 verification complete. **Each artifact/version must have a distinct stable slot** or an upload may overwrite another version. Any scripts use an existing authenticated rclone remote on the owner's Mac; this chat does not have Mac shell access. After explicit owner-run uploads, inspect the actual Drive folder by ID, read every file ID/size/MD5 if available, and append delivery evidence to an **append-only versioned log**. `VERIFIED` is byte delivery, not editorial approval.

## 4. Quran Foundation: text-only path (does not make audio or motion)

- New local Studio endpoint `GET /api/episodes/001/quran-text-only?channel=...` lists exact Quran references **missing in the current Mac episode script** without contacting the network or modifying files.
- `POST` requires explicit `{ "confirm": true }`; uses the configured `QF_CLIENT_ID` / `QF_CLIENT_SECRET` and `QF_ENV`. Existing `fillMissingQuranTexts` writes **only missing Quran text** into `quran.json`, refusing partial writes if any verse fails or files change concurrently.
- Quran text must be returned from Quran Foundation and must match source verse key and number. No fabricated text, no automatic religious signoff. No voice, no plan rewrite or video render.
- `src/plan/io.ts readPlanFile()` hydrates the cards from the text cache after reload. The Studio Storyboard UI now offers an explicit source-only action and refreshes the episode state.
- The user mentioned four missing verses, but their exact four references in the *current Mac worktree* have **not** been independently read. The read-only list is the ground truth; do not claim four fixes before its result.
- Quran source excerpts/review notes on historical Storyboards (e.g. Dafatir's omitted A'raf 15 in an older plan) require separate textual/source editorial review.

## 5. Git security: separate PR #61

`fix/gate-git-env-isolation` at base `b80b32c` reproduces inherited `GIT_DIR` contamination from linked worktree push hooks. PR #61 adds:
- `childEnv` sanitizes *extra overrides* as well, not just inherited variables.
- `install-hooks.mjs` detects linked worktrees and skips writing shared `core.hooksPath`.
- Regression tests protect **primary config, local branch refs, stash and non-bare repository state**, using only temporary Git repositories.

**PR #61 is not merged into main.** GitHub checks currently report failures without accessible detailed job logs. To avoid edits to the user's primary checkout, run the PR on an isolated Mac worktree after reviewing all uncommitted changes. Do NOT use `git reset --hard`, `fresh-start.command`, automatic rebases, or an unattended `git push origin HEAD:main`. Merge only after exact-head TypeScript/Vitest gate + safety acceptance and version review.

## 6. Decision

Preproduction illustrated boards can be transferred and reviewed **before any motion audit**. Old warnings from silent motion diagnostics neither approve nor reject visual storyboard design; they remain QA findings for a later stage. Missing Quran content, incomplete or unreviewed storyboard frames, and lack of owner signoff **still block final approval**, followed by tone, voice and motion in that order. Both PR #61 and this PR remain DRAFT until exact-head Mac tests are supplied.
