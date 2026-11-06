# Studio production contract — Storyboard → Tone → Voice → Motion → audiovisual QA

**Owner decision (2026-11-06). Applies to every newly produced or substantially revised episode of all three channels**: بالإسلام (`balislam`), دفاتر الزمن (`dafatir-alzaman`), زبدة الكتب (`zubdat-alkutub`). This is the mandated editorial handoff sequence; the project currently implements some but **not yet all** of the gates in code. Do not claim enforced voice QA or auto-handoff based solely on this document.

Studio runs on the owner's Mac via Terminal and localhost; no Vercel. A channel's ChatGPT reviewer directs and verifies, its Claude implementer builds and tests, and the owner alone approves publishable assets. Real delivered media must be checked independently of code tests.

## 0. Research, script and source verification — prerequisite before production

Have a verified script, valid narration, citations, Quran/hadith text and permissions; no arbitrary change to approved religious source wording. For Quran: the displayed verse text must be real, matched to an approved reference; recitation comes from approved, usable recordings, not synthetic recitation. If text/translation/pronunciation is changed later, invalidate related work and revise as appropriate. The source ledger and `bal check` are authoritative.

## 1. Complete visual Storyboard for the **entire episode**, before voice

For every scene of every chapter, design the exact shot, composition, characters/elements, camera movement, cuts/transitions, subtitles and labels, expected spoken sentence, approximate duration, emotional beat and mobile/landscape framing. Include verse/sacred-content treatment, existing asset constraints and rights. Produce a browsable sequence of **actual visual frames** (PDF/image contact sheets and scene-by-scene illustrations), not merely `plan.json` or `storyboard.json`. Include a scene ID and version in each entry. Initial small isolated technical render tests are allowed to prove feasibility, but **do not make a full motion video before this stage and voice stage are approved**.

Claude sends full visual Storyboard via the same explicitly opted-in verified uploader (kind `storyboard`), reports `VERIFIED`, Drive URL and checksum, and lists what parts were visually inspected. ChatGPT reviews **all scenes**; owner explicitly decides go/no-go. Store `storyboard.json` per-scene hashes only **after** real visual acceptance, never as a surrogate for human review.

## 2. Tone design for each spoken segment — before generating voice

For **each narration-bearing scene or smaller phrase where mood genuinely changes**, select an explicit tone and speech direction in the scene/segment sheet: pace, energy, emphasis, pauses, pronunciation, emotions, transition into the next segment. The current engine supports per-scene `PlanScene.tone` presets `calm`, `warm`, `documentary`, `dramatic`, `energetic`, `intimate`, with optional `PlanScene.voice`; it also supports a fallback `Plan.tone`, but a global fallback **does not satisfy the new editorial per-segment decision**. Where tone shifts inside one scene, the editor must represent and document that subsegment and verify TTS support, without inventing unsupported automatic controls.

Create a tone-map table with: episode ID, chapter/scene/segment, final text, tone preset and expressive instructions, speed and pause suggestions, speaker/voice choice, religious-pronunciation constraints, reviewer status. Reviewer approves the tone map before paid production. The tone choice must preserve religious gravity; no dramatic treatment of Quranic recitation.

## 3. Generate, listen to and correct Voice-over — **before producing the video**

Start with short samples for each distinct tone and pronunciation. Then generate matching narration scene-by-scene, reusing existing cached clips only when their text, settings and speaking intention still match. Check vowelization, pronunciation, clarity, naturalness, variation, volume, breathing, pacing, pauses, continuity across cuts and the emotional arc. Listen to **each changed clip**, then the **full contiguous episode audio at natural speed**. Correct only failing clips, retime as needed, and capture the final actual audio duration/word timing for animation. Never make a video solely on tentative estimated audio timing. Do not equate presence of `voice/index.json` with reviewed audio.

Required separate reviewer decision: **VOICE_APPROVED_FOR_VIDEO** (text + tone + audio versions known). This is an editorial decision/report, *not* a status automatically set by the current code. If the narration, tone, speaker, text or TTS output changes, the affected voice approval and synchronization must be reevaluated.

## 4. Produce video **synchronized to the approved voice**

Animate on actual approved voice clips and word-level timing, not only guessed durations. Ensure every movement, element, caption and camera cut serves the narrated words and emotional rhythm. Review and deliver actual 16:9 previews, and 9:16 samples when relevant, using the same verified uploader (kind `video`). An audio-less proxy remains labeled **silent technical/reference preview**, not the principal creative review for release.

Ensure visual transitions do not truncate audio, no subtitles cover faces, and that quiet religious beats are intentionally quiet. Preserve the Storyboard scene order and version; reapproval is necessary when the creative meaning or scene composition changes.

## 5. Joint audiovisual review — sound + image together

Claude first self-reviews real playback, records the percentage watched vs sampled frames, and sends immutable handoff evidence. ChatGPT reviewer evaluates the **whole film at 1× with sound** for narrative rhythm, lip/beat sync, transitions, captions, audio levels, pacing, pronunciation, readability and sacred-content handling. Defects should be scene/time/orientation-specific with priority and measurable acceptance. Fix locally and retest affected scenes + neighboring transitions, then do a full contiguous playback after the final assembly. Neither a silent 100% frame scan nor a TypeScript test equals an audiovisual approval.

## 6. Master, owner approval, and publication

Only after full audio/visual, copyright/recitation, and project gates are satisfied: export final master with sound, captions, thumbnails and publish metadata. Check complete final MP4 (including credits/end) at natural speed. Owner signs off on **the exact master file**, not an earlier preview. The owner uploads manually or explicitly authorizes later publication. Short-form cutdowns only after the long master approval. New render or source/audio change invalidates that file-bound approval.

## Verified Google Drive handoff and current folder mapping

Existing folder: [Balislam-Studio-Previews](https://drive.google.com/drive/folders/1FOlC-96OsRndQR_K6Js2OcWOBEK6qBI3).

```text
Balislam-Studio-Previews/
  bilislam/             # channel code: balislam
    episodes/001-know-the-truth/
      storyboard/        # verified board PDF, scene-frame images, sheet and versioned JSON/MD
      previews/          # verified MP4/WebM video reviews
  dafatir-alzaman/
    episodes/001-adam-beginning/
      storyboard/
      previews/
  zubdat-al-kutub/      # channel code: zubdat-alkutub
    episodes/001-awwal-marra-osalli/
      storyboard/
      previews/
```

On **Nov 6** all paths above were verified/created via the connected Google Drive API; empty folders are not evidence that production artifacts were transferred. `bilislam` has at least a storyboard JSON **validation** and `sync-validation.mp4`. `dafatir-alzaman` and `zubdat-al-kutub` episode directories were created on Nov 6 and their storyboard/previews directories are still empty until actual production uploads. Existing prior preview links elsewhere in Drive must not be moved or mistaken for new, approved episode files.

Transfer via an explicit, authorized Mac uploader or guarded queue, never by scanning all 24 worktrees. For each asset: channel, episode slug, kind, stable slot, original source path, source SHA256, Drive MD5/URL, verifier result, timestamp, version, and **PENDING_REVIEW** editorial status. `VERIFIED` means bytes arrived; not that Storyboard, tone, voice or video was approved. No public sharing by default for protected voice/recitation or sensitive material. Unattended scheduler remains **disabled** until separate production handoff and security acceptance.

## Enforcement disclosure

**Already in code:** storyboard scene-hash approval gates before voice, per-scene tone fields, TTS hash/cache, master requirements for matching voice, file-bound master owner approval.

**Not yet proven/enforced end-to-end:** (a) required explicit tone decisions for every spoken segment; (b) human audio QA/VOICE_APPROVED_FOR_VIDEO ledger and gate before ordinary preview render; (c) actual storyboard PDF/visual-frame production for **every scene** and verified Drive delivery across all channels; (d) unattended security-approved bridge. These require separate code/operational acceptance and must not be represented as complete. Production agents must follow the stages manually immediately, without pretending the unimplemented gates exist.
