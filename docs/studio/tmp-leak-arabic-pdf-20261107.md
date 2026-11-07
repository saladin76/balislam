# Studio P0/P1: private test temp cleanup and Arabic PDF review

Status: ENGINEERING DRAFT. This branch is based on the isolated Studio integration candidate. No episode script, source scene, editorial approval, existing PDF, master, Drive file, main branch or production localhost is changed.

## Cause and fixes

- Old voice-cache and recitation tests copied the whole balislam channel, including unrelated episode MP4 previews, and never removed their temporary roots. The Git tree's balislam channel alone contains ~136.1 MB. The owner-reported 278 MB per temp directory is not a measurement we reproduced; filesystem allocation and other files affect it.
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

The verification performs two full gate runs in sequence or concurrently with distinct private temp roots, checks that each ends empty, preserves its sentinel, and records free disk before/after. Its report is meaningful only after actual Mac execution. Do not present simulated or stale numbers as Mac benchmarks.

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
