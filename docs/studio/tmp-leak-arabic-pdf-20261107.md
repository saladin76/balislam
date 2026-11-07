# Studio P0/P1: private test temp cleanup and Arabic PDF review

Status: ENGINEERING DRAFT. This branch is based on the isolated Studio integration candidate. No episode script, source scene, editorial approval, existing PDF, master, Drive file, main branch or production localhost is changed.

## Cause and fixes

- Old voice-cache and recitation tests copied the whole balislam channel, including unrelated episode MP4 previews, and never removed their temporary roots. The Git tree's balislam channel alone contains ~136.1 MB. The owner-reported 278 MB per temp directory is not a measurement we reproduced; filesystem allocation and other files affect it. A Git tree source-byte inventory of the exact parent candidate calculated 136,057,002 bytes copied into each old balislam fixture (excluding voice/out), versus 5,314,536 source bytes copied into a new episode-isolated fixture including the 000-demo sample: a 96.09% reduction in input fixture bytes. These are not before/after Mac allocated-disk measurements; Mac run verification is still mandatory.
- Quran text-only test already cleaned up, but needlessly copied large episode media.
- Render-pool tests accumulated pool-* directories; PDF tests left studio-pdf-* directories; the tempo sample created bal-tone-*.mp3 directly in shared /tmp.
- Updated fixtures now exclude production episodes and copy only the small test episode; all owned fixture directories are removed in teardown or finally.
- The test gate uses a new private TMPDIR/TMP/TEMP per execution, inherited by child tools (including Remotion and webpack when spawned by tests). The gate cleans only its own directory on success/failure/handled cancellation, and prints GATE_TEMP_ALLOCATED_BEFORE_CLEANUP_BYTES and GATE_TEMP_CLEANED.

Never delete arbitrary /tmp items. SIGKILL or power loss cannot trigger in-process cleanup; do not promise otherwise. We have not proven a leak from the long-running production Remotion bundle cache. If a production render still grows /tmp, audit its exact owned bundle directory independently before making a live-engine change.

## Repeat-run and concurrency regression (Mac acceptance pending)

Run on this branch, in an isolated Mac worktree:

    npm run gate
    node scripts/verify-studio-temp-leaks.mjs
    node scripts/verify-studio-temp-leaks.mjs --parallel
    node scripts/verify-studio-temp-leaks.mjs --failure
    node scripts/verify-studio-temp-leaks.mjs --cancel

The verification performs two full gate runs in sequence or concurrently with distinct private temp roots. The --failure variant deliberately removes npx from the private child PATH; the --cancel variant sends SIGTERM after 1.2 seconds and expects a rejected run. All modes check that each run root ends empty, preserve their sentinels, and record free disk before/after. Its report is meaningful only after actual Mac execution. Do not present simulated or stale numbers as Mac benchmarks.

## Arabic PDF

The shared exporter embeds local project font faces and pins channel-specific typography instead of silently substituting OS fonts:
- Balislam: El Messiri + IBM Plex Sans Arabic
- Dafatir: Amiri
- Zubdat: Tajawal

RTL titles, diacritics and LTR scene IDs are explicitly isolated. Optional --chapter-cover creates exactly one new Arabic cover per selected chapter without altering the old default page count or any scene image. For the real Dafatir V1.1 manifest:
- Chapter 1: بداية القصة, 9 source scenes -> 10 pages with cover
- Chapter 2: إني جاعل في الأرض خليفة, 7 source scenes -> 8 pages with cover

Sample commands (choose NEW output filenames):

    node scripts/studio-storyboard-pdf.mjs --manifest /absolute/storyboard-001-v1.1.json --chapter 1 --chapter-cover --output /absolute/NEW-ch1-review.pdf
    node scripts/studio-storyboard-pdf.mjs --manifest /absolute/storyboard-001-v1.1.json --chapter 2 --chapter-cover --output /absolute/NEW-ch2-review.pdf

Visual acceptance: inspect all generated pages at 100%, verify no detached Arabic letters/diacritics, correct chapter titles and scene numbers, check PDF fonts (pdffonts), page counts and no clipped notes. A screenshot of rasterized source scene art is not fixed merely by changing PDF shell typography. Previously exported PDFs remain historical, not overwritten.

Full Mac gate, repeat/parallel audit, Chrome render and visual page signoff remain PENDING. Do not merge, activate background bridge, or publish until those gates pass.


## Canonical Studio paths and manual Quran production

One approved directory convention across all three channels:

    channels/<channel>/episodes/<NNN-slug>/script.md          # owner-authored script
    channels/<channel>/episodes/<NNN-slug>/quran.json         # owner-supplied ayah text only
    channels/<channel>/episodes/<NNN-slug>/recitations/       # original + review + signed-off manual recording
    channels/<channel>/episodes/<NNN-slug>/voice/             # ordinary narration, separate from Qur'an
    channels/<channel>/episodes/<NNN-slug>/previews/          # reviewed preview slots
    channels/<channel>/episodes/<NNN-slug>/out/               # rendered episode outputs
    public/_render/<channel>/<NNN-slug>/                      # disposable render staging, per channel
    public/_storyboard_media/<channel>/<NNN-slug>-<hash>/     # content-hashed visual-only staging
    $TMPDIR/bal-gate-run-<unique>/                           # owned ephemeral gate test files only

The canonical resolved script path determines the namespace. Never infer the production channel from a random temp basename, never use the same _render/001 folder for three channels, and never remove other channels' media. Paths stored inside an approved episode remain local and unchanged.

Quran workflow: list exact required ayah references from script; owner sends tashkeel-preserving text via conversation, then it is explicitly entered in Studio and reviewed. Owner submits an original audio recording via the Studio upload panel, which preserves its original bytes and makes a gently leveled preview without pitch shifts or speed changes. The clip is excluded from render until listened to, signed off and checked by text/audio SHA hashes. AlQuran Cloud is optional for listening previews only; Quran Foundation, external translations and borrowed reciter tracks do not enter the production pipeline. A ChatGPT conversation attachment is NOT automatically copied to the owner's Mac; this requires explicit Studio upload or a separately reviewed, safe bridge action.

Mac observations from the 2026-11-07 attached terminal report: first gate: 636/638 tests passed, 2 failed; second gate: 635/638 passed, 3 failed. Test names included PDF chapter-cover page matcher and Git isolation gate source matcher, with intermittent child probe failure under parallel CPU stress. The first two test assertions have since been updated to match actual markup/cleanGitEnv structure. Failure/cancel audit produced privateTempBytesAfter=0. Serial and parallel audits remained FAIL because their full-gate tests did not all pass. Under parallel stress, freeBytesDelta=-1085489152 (roughly 1.09 GB of total disk free decrease) while private root bytes after cleanup=0, so this delta MUST NOT be attributed to the test root without more per-path tracing. Full verification of this newer branch head remains pending; no merge approval.

## Expanded temporary-fixture scan

Audited all 83 current Vitest test files for mkdtemp/tmpdir and missing teardown. In addition to the original P0 fixtures, added owned-directory cleanup for channel creation, doc-plate image tests, lab storyboards, storyboard review, episode previews/list discovery, production-stage integration fixtures, voice review, review ledgers, scene review, and settings secrets. All deletions are exact test-owned paths; no glob or system-wide /tmp sweep.

The current source branch also separates shared render staging by resolved canonical channel/episode directory. This is a new path change and must pass a fresh Mac run and visual stage smoke test before merge. The earlier full-gate output described above is evidence of old failures and private-root cleanup, NOT a pass for this new head.
