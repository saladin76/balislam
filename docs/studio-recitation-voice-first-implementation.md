# Studio — Quran recitation sync, voice choices and storyboard-first implementation

Development branch: `fix/recitation-exact-timing-and-voice-gates` (based on draft PR #47).
**No automatic publishing or Mac production changes.** This is code awaiting the owner's Mac gate and natural-speed audiovisual acceptance.

## 1. Quran verse and reader timing

Previously the engine delayed Quran audio by `0.8s`, added `0.25s` between adjacent ayah recordings, and held a verse card for `recitation.duration + 1.6s`, potentially longer if a manual duration was set. Various visual styles also faded the text in after reading started and faded the scene out before sound completed.

The implementation now shares one schedule between video/audio:
- The first Quran audio file begins at **the first frame of the verse scene**; no artificial 0.8-second offset.
- If an ayah passage consists of multiple files, they are joined at cumulative audio frame boundaries with **no synthetic 0.25-second gaps**.
- For a real recitation, the verse scene lasts its measured audio duration and ignores previous extended manual holds and generic minimum scene duration.
- VerseCard classic/ink/page and Dafatir horizon verse open their scripture on the first recitation frame, with the corresponding visual in/out animations suppressed and transitions touching recited verses disabled.
- For scenes with **no recitation**, previous silent technical/still previews remain available, without falsely implying a published recitation.

**Known physical limitation:** Some source MP3 files may contain silence *inside the recording*. Starting the MP3 at time zero cannot remove that silence, and the current patch does **not** auto-trim Quran audio (to avoid clipping sacred words). Before approval, render and listen to first/last audible phoneme in representative scenes from all three channels. If a clip contains real silence, handle its source/trim deliberately with waveform-level verification; no silent fallback.

### Follow-up hardening after the first Mac 599/599 PASS

- The `VersePage` style with `reveal=lines` previously displayed only its **first chunk** on audio frame zero. Now **every chunk and both Quran brackets** display fully from frame zero through the last frame whenever real recitation audio is attached. The line-by-line reveal remains only for audio-less visual planning.
- `bal storyboard-frames` now calls a **separate image-only stage**, not `prepareRenderMedia`. Its content-hashed `public/_storyboard_media/` cache does **not delete or overwrite** the existing `public/_render/` voice, audio or media of a parallel preview. It copies only images referenced in the plan. A regression test checks that changing an image creates a fresh separate cache while the original staged image and production MP3 remain untouched.
- Source MP3 files can contain silence *inside their own audio stream*. The new **read-only** command below reports likely leading/trailing silence. It does not modify the MP3 or automatically trim Quran.

```bash
# Run on an explicitly chosen real audio file from the verified episode worktree:
node scripts/studio-recitation-silence.mjs "/ABSOLUTE/EPISODE/recitations/recording.mp3"
# More files may be listed explicitly after the first.
```

The silence audit requires `ffprobe` and `ffmpeg` installed in the Mac shell. Its readings are thresholds/diagnostics, **not a guarantee** that a soft reciter syllable is silent; listen to the first and last phonemes before deciding whether any source file needs deliberate correction. Its tests are included in the ordinary Vitest gate.

The earlier **599/599 Mac gate and 4322 Vite startup apply only to commit `d1a88fb`**. These follow-up fixes have not yet run on the user's Mac and are not approved for publishing.

## 2. More reciters

- Quran Foundation already offers the live `/resources/recitations?language=ar` reciter and style catalog. The channel picker now includes Arabic-normalized search by name, style (مرتل/مجود) or recording ID, and shows all entries returned rather than a curated shortlist.
- Per-episode `AlQuranCloudBrowser` already supports a second reciter catalog, searchable selection and single-ayah audition. Explicit rights evidence is required before linking an edition for production. Its API listing **is not** a commercial redistribution licence, and the project's verified commercial-edition registry is empty until real paperwork is reviewed.
- Existing licensed `assets/recitations` retains priority. Channel defaults do not overwrite episode-specific authorized choices.

## 3. Storyboard → tone → voice → video

- New `bal storyboard-frames EPISODE [--portrait]` exports a **real Remotion image** for each scene, with versioned PNGs in `channels/<channel>/episodes/<episode>/storyboard/`, a linked Markdown/HTML contact sheet and no auto-approval. Print the HTML as PDF if needed. `plan.json` alone does not count as full visual review. A PDF is **not** automatically generated or transferred by this command.
- Storyboard approval v3 is intentionally independent of later `scene.tone` and `scene.voice`. Changing the narration, visual composition, scene duration or transitions still invalidates it. Legacy storyboard hashes are read compatibly until a change requires an explicit reapproval.
- Paid narration generation now requires explicit per-scene `tone` in the normal workflow. `--dry-run` reports `missingTones` with no cost. Existing explicit maintenance overrides remain and are not an acceptable way to bypass normal human production checks.
- `voice-review.json` stores explicit per-scene human approval bound to **current MP3 bytes SHA256, current text and tone**. Then a second version-bound full-episode listening signoff is required. Neither a matching file nor a green TypeScript check creates this decision.
- Studio Voice Workspace provides a clip player, reviewer and note, checkbox confirming actual listening, and a separate full-audio signoff. A new **sequential in-Studio narration player** now plays the current text-matched clips in scene order and unlocks the full-audio listening confirmation only after the whole playlist completes. It does not pretend to prove no one skipped or muted audio; the named reviewer remains responsible for truthful signoff. Missing/stale clips disable the full-playback start. Local API and CLI: `bal voice-review 001`, `bal voice-review 001 --approve c1-s1 --reviewer "..." --note "..."`, and `bal voice-review 001 --approve-episode --reviewer "..." --note "..."`.
- Final **master** now fails when these voice approvals are missing/changed. Historical silent **technical previews** are intentionally left functioning to avoid destroying the review/laboratory pipeline; this branch does **not** claim to block all use of preview-render commands. The owner's human production workflow forbids treating those previews as a substitute for the proper voice-first video review.

### Safety checks introduced after green Mac baseline

The Mac gate at `d1a88fb` passed **599 tests / 75 files** and Vite started on localhost:4322. Subsequent edits in this PR add visual synchronization tests, read-only source-silence diagnostics, safe dedicated storyboard asset staging, and sequential voice review. **These subsequent commits have not yet passed a new Mac gate or 1× end-to-end audiovisual review.** Do not deploy to localhost:4321 or claim a publishable master on the basis of the older gate result.

## 4. Drive and delivery

Storyboard PNGs and HTML/MD contact sheets are stored locally first, not pushed to Git. The separate existing `$HOME/Balislam-Preview-Sync/studio-handoff.sh upload --kind storyboard --file /absolute/verified/image.png --channel balislam --episode 001-know-the-truth --slot c1-s1` workflow can transfer exact chosen approved-for-review artifacts to Google Drive after the Mac uploader is configured and returns checksum-verified `LINK` / `VERIFIED`. A separate real all-channel PDF/MP4 end-to-end validation (#59) has **not** passed. Never choose a production worktree automatically or expose protected voice files via public links.

## 5. Mac test and review (mandatory)

```bash
cd "$HOME/balislam"
git fetch origin fix/recitation-exact-timing-and-voice-gates
bash <(git show origin/fix/recitation-exact-timing-and-voice-gates:scripts/studio-terminal-preview.sh) check
```

If `CHECK_OK`, stop any older 4322 preview and run the same command with `serve`, then open `http://127.0.0.1:4322`. Review the expanded channel reciter picker and Studio's Voice Workspace. Test real temporary Quran passage previews (both 16:9 and 9:16) **with sound at normal speed**, verify start and end across classic/ink/page/horizon styles and multi-ayah clips. Do not render or overwrite production media until the owner approves an exact worktree/episode/asset. No Vercel, no unattended uploader, no merge into `main` before independent verification.

## Remaining acceptance boundaries

- Explicit Mac TypeScript/Vitest gate and local audiovisual evidence: **pending**.
- Human review of full storyboard and full voice track: **pending per episode**.
- Full automatic PDF assembly and real Drive storyboard+video transfer for all three channels: **not completed**.
- Unattended bridge permission and scheduler security: **pending and disabled**.
- Actual song/voice recording rights and Quran text accuracy: must be verified; broad library access does not equal publication permission.
