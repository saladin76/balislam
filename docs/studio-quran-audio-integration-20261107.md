# Studio — عقد تكامل القرآن والتعليق الصوتي (7 نوفمبر 2026)

**النطاق:** فرع `work/studio-quran-audio-20261107` فقط، نحو `integration/studio-20261107-release-candidate`.
**لا اعتماد آلي، ولا نشر أو دمج أو تحديث Mac الإنتاجي.** هذه الوثيقة شرط تسليم لفريق الرندر، لا تصريح بتنفيذ تغييرات الرندر من هذا الفرع.

## 1. مصدر الآيات الوحيد

- صاحب المشروع هو من يكتب نص الآية **يدويًا وبالتشكيل داخل `script.md`**. الصيغة: `[آية: النجم 39 | وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ]`.
- يستخرج `parseScript` المرجع والنص حرفيًا؛ `quranFromScript` يمنع النص الفارغ، المرجع الخاطئ، والنصين المختلفين للمرجع الواحد.
- المخزن التاريخي `quran.json` **ليس مصدر نص الآيات**، ولا تتولى أوامر Studio/API إضافته أو إصلاحه. قد يتضمن فقط بيانات ترجمة تاريخية لازمة للتوافق. عند قراءة `plan.json` أو إعادة بناء الخطة، لا تُعرض آية إلا من السكريبت.
- قارن النص المكتوب مع مصحف مرجعي معتمد عبر `quran-audit`/ `bal quran-compare`، مع إظهار الحروف والتشكيل والرسم والوقف والمرجع والموضع. لا تغيير تلقائي لأي حرف.
- المطابقة البرمجية ليست فتوى أو قرار اعتماد: يراجع المختص الفروق ويعتمد الاستشهاد صراحةً في سجل التوثيق. تتغير بصمته إذا تغيرت الآية أو تشكيلها. لا تُقبل المقارنة دون معرفة المصدر وبيئته؛ `QF_ENV=production` هو المطلوب للاعتماد الفعلي.
- **الترجمات التاريخية:** `<key>#meaning` و `<key>#meaningSource` محفوظان من المصدر الأصلي عند جلب ترجمة جديدة، أو من نسبة المصدر في خطة قديمة. إذا غابت نسبة المصدر لا نخترعها من إعداد القناة الحالي؛ تطلب مراجعتها. لا تكتب الترجمة فوق النص الأصلي.
- **منع إسناد الترجمة زورًا:** العلامة القديمة «مدخل يدويًا — يحتاج مراجعة» ليست مصدر ترجمة، ولا تُقبل كـ`meaningSource`. تُحفَظ الترجمة القديمة كما هي في التخزين، لكن تُحجَب عن بطاقة الآية حتى تُحدَّد نسبتها الحقيقية وتُراجع. لا يُنقل اسم مترجم من حقل قديم منفصل ليلصق بترجمة أخرى. وجود نسبة مصدر لا يعني وحده اعتمادًا شرعيًا.

## 2. ترتيب الاعتماد الصريح

1. **السكريبت:** فحص صلاحية النص والآيات، اعتماد الاستشهادات يدويًا، ثم `script-signoff.json` ببصمة SHA-256 للسكريبت ومراجع وملاحظة. الكتابة بعد الاعتماد تبطله.
2. **Storyboard:** اعتماد بصري مستقل بعد السكريبت؛ تتغير حالة اللوحات إذا تغيرت المشاهد. لا يسقط اختيار النبرة اعتماد اللوحات السابقة. تقارير الحركة الصامتة **QA فقط** ولا تشترط تسجيل الصوت.
3. **التعليق الصوتي:** النبرة واختيار الصوت، ثم استماع واعتماد كل MP3 صالح للتشغيل وبصمته، ثم استماع كامل متصل 1× واعتماد الحلقة الصوتية ببصمة المقاطع المرتبة. ملف تالف أو متغير أو نص/نبرة متغير يعيد الحالة إلى انتظار المراجعة. الصوت لا يُعتمد من مجرد وجوده أو من مطابقة اسم الملف. إذا لم توجد أي مقاطع تعليق قابلة للاستماع، تفشل بوابة الحركة النهائية بدل اعتبار القائمة الفارغة معتمدة.
4. **الحركة النهائية:** بوابة `assertMotionStartAuthorized` قبل إدخال مهمة الفيديو النهائية لطابور Studio تُلزم اعتماد المراحل الثلاث؛ لا يُعتمد صوت أو فيديو آليًا من نجاح الاختبارات. تعديلات الصوت أو النص بعد بدء العمل تستدعي إيقاف الناتج وإعادة البوابة.
5. **المراجعة السمعية البصرية والنشر:** موافقة منفصلة على مشاهدة الفيلم كاملًا 1× وملف Master النهائي؛ موافقة الصوت ليست موافقة نشر.

## 3. فصل الكاتب والقارئ وحقوق النشر

- كتابة الآية في السكريبت لا تدل على أن صاحب المشروع سيتلوها. مصدر التلاوة قد يكون **قارئًا خارجيًا مرخصًا**، تسجيلًا منتجًا يدويًا من قارئ مستقل، أو موردًا خاضعًا لشروطه.
- `manualAudio.ts`: يفحص الصوت الأصلي ونسخة التحسين وتوافقهما مع بصمة الآية المكتوبة فعلًا، ويطلب اسم القارئ ودليل حقوق الاستعمال ومراجعة استماع بشرية. فساد MP3 أو اختلاف النص يسقط الصلاحية.
- **ثغرة تكامل مقصودة، وليست اعتمادًا:** جامع وسائط الرندر `src/plan/collect.ts` المملوك لفريق الرندر لا يقرأ حاليًا `provider: "manual"`. لذلك يصرّح `ownAudioStatus` أن `renderIntegrated: false` ويعيد `approved: {}` دائمًا في هذا الفرع؛ `reviewed` يسرد التسجيلات ذات التوقيع البشري والملف السليم حاليًا، و`stale` يذكر التسجيلات التي انتهت صلاحيتها لتغيّر النص أو فساد الصوت أو فقد الملف. لا يجوز للواجهة اعتبار `reviewed` تصريح رندر. بعد ربط الجامع يجب إعادة فحص الصلاحية آنيًا قبل ترقية أي تسجيل إلى «جاهز للرندر». لا يجري تعديل ملف الرندر هنا.

## 4. متطلبات تسليم لفريق الرندر — غير منفذة في هذا الفرع

1. ربط `verifiedOwnRecitations(scriptPath)` بالجامع **بعد** التحقق من SHA-256 للملف والنص، صلاحية فك الصوت، الترخيص واسم القارئ، ثم إدخالها إلى `EpisodeMedia.recitations` مع تمييز مصدرها `manual`. لا تتجاوز مسار الحقوق في QF/Cloud، ولا تُدخل الملفات المعلّقة في الرندر.
2. تطبيق `assertMotionStartAuthorized(scriptPath, plan, voice)` على **كل** مسارات بدء الحركة النهائية المباشرة، بما فيها CLI وأدوات الحزم والعمليات المستأنفة من الطابور؛ بوابة HTTP وحدها لا تحمي تلك المسارات. إعادة الفحص عند التشغيل الفعلي والتصدير قبل Master مهمة فريق الرندر.
3. التمييز الصريح بين رندر QA صامت و«الحركة النهائية» في كل مدخل. لا تجعل `--allowUnreviewed` تصريحًا ببدء إنتاج نهائي بلا صوت.
4. استخدام السكريبت بعد التحديث ومراجعة بصمة الآية والتسجيل عند الجمع؛ إزالة بقايا النصوص القديمة من خطة محفوظة لا يجيز استبدال المصدر اليدوي.
5. إضافة اختبارات تكامل بعد فتح فرع الرندر في نطاقه، خصوصًا اعتماد تلاوة يدوية مرخصة، فساد ملف MP3، تغيّر نص الآية، واستعادة طابور الرندر.

## 5. اختبارات النطاق وحماية الإنتاج

- `tests/quran-script-source.test.ts`: حرفية النص والتشكيل، تغيير اعتماد الاستشهاد، حظر استبدال الآية عبر `generatePlan` مباشرةً، حفظ المصدر التاريخي للترجمة، **حجب ترجمة غير منسوبة عند القراءة وإعادة توليد الخطة** مع الاحتفاظ بنصها في المخزن، وإسقاط التسجيل المتغيّر أو التالف مع منع وسمه بأنه صالح للرندر.
- `tests/quran-text-only.test.ts`: عدم الاتصال بالمصحف أو الكتابة إلى `quran.json` أو تغيير السكريبت عند الاستعلام القديم.
- `tests/script-approval.test.ts`: المراجعة المستقلة واستبطالها مع أي تعديل.
- `tests/voice-review.test.ts` و`tests/studio-production-stage-integration.test.ts`: MP3 حقيقي قابل للفك، لا اعتماد للفاسد.
- `tests/studio-final-motion-gate.test.ts`: لا حركة نهائية قبل Storyboard وكل مقاطع الصوت والاعتماد الكامل، ورفض المسار بلا مقاطع تعليق.
- لم يُعدّل أي ملف حلقة إنتاجية، أو فرع الرندر، أو `src/plan/collect.ts`. لا يُستخدم Vercel أو Mac الإنتاجي. يجب مرور GitHub CI وStudio parity والمراجعة البشرية على رأس فرع التكامل قبل الدمج.


## 6. Hardening audit — Quran/audio workstream only

**This work does not authorize production or scholarly signoff.** The source script remains authoritative; no AI-generated Quran recitation or voice-cloning of ayahs is permitted.

### Arabic source/diff integrity
- `alignDiff` and the legacy `compareVerseText` now use the same complete NFC codepoint alignment. Significant leading/trailing whitespace, Quran marks, letters and tashkeel are not trimmed. Neither the report nor legacy comparison truncates at 40/20 differences.
- An unreasonably large quadratic alignment fails explicitly and requests smaller ayah ranges; it must **never** report a partial comparison as a match. The script itself and the approved remote text are never auto-edited.
- `historicalMeaningConflict` stops a sync when an already stored translation is differently worded, from a different named translator, or has no verifiable original source. The previous text, old provenance and citation are left intact until human migration/review. A selected channel translation is not retroactively assigned to an older meaning.

### Recording identity and human attestation
- `src/voice/audioIntegrity.ts` checks MP3 metadata **and decodes the entire stream using FFmpeg**; a valid header or parseable duration alone is insufficient. Failure closes the audio approval gate.
- `approveOwnRecitation` retains the original audio filename/hash along with the processed MP3 hash, the exact manually authored Quran text SHA, separate reader attribution, rights evidence, named reviewer and decision timestamp. `verifiedOwnRecitations` verifies **both** source and processed bytes/decodability and bounded duration drift at the moment of use. Historical manual index entries without original evidence remain on disk but require human re-review/re-upload before eligibility.
- HTTP, UI and CLI all demand an explicit `listened: true` acknowledgement for each clip and full-episode signoff. CLI reviewers must pass `--listened`. It is an accountable human declaration, not a claim that software can prove a person listened.
- `assertNoQuranInTts` prevents explicit verse directives, entire authored ayahs and substantial verbatim ayah excerpts in **script-derived narration and special-line TTS**. Verse-card scenes cannot become TTS narration jobs. The guard cannot identify every Quran fragment in arbitrary external prose; human review and separated recitation sources remain mandatory.

### Final motion and the render-branch boundary
- `assertMotionStartAuthorized` refuses final motion when a current Quran verse has any manual recording marked reviewed/stale **until** the independent render collector truly supports it. It never silently substitutes missing recitation with synthetic speech.
- The renderer remains the **hard acceptance blocker**: `src/plan/collect.ts`, direct `src/render/episode.ts`, package/master paths, queue recovery and actual execution-time rechecks belong to the other team's branch. They have **not** been modified here. It is wrong to declare a 100% end-to-end technical delivery before each starts through the same gate and the collection path revalidates original/processed hashes.
- Required render-team tests: (a) direct CLI final render with unsigned script must reject before output; (b) direct/package/Master with unchanged script but stale scene audio or unapproved full narration must reject; (c) recovered queued job must recheck at execution, not only enqueue; (d) manual ayah audio must render only after verified license/reader/source/hash and must stop after original or processed file corruption, ref/tashkeel mutation or revoked review; (e) storyboard silent QA remains usable as non-final review; (f) any `--allowUnreviewed` or legacy shortcut cannot bypass final motion.
- Never change `main`, a production Mac checkout or episode files from this workstream.

### Verification checklist
- Run full `npm run typecheck` and all Vitest suites on the **exact head** of Draft PR #76, including `tests/quran-script-source.test.ts`, `tests/quran-tts-guard.test.ts`, `tests/audio-integrity.test.ts`, `tests/voice-review.test.ts`, `tests/script-approval.test.ts`, and `tests/studio-final-motion-gate.test.ts`.
- Check that GitHub Actions actually execute `npm ci`, typecheck, tests and channel smoke checks. A job failing with **zero steps** is an infrastructure failure and does not prove code passed or failed.
- Require a real independently reviewed Quran/text and MP3/source-rights exemplar, plus owner signoff of a full 1× listening session, before any real production acceptance. Test sine-wave recordings are decoder fixtures, never religious review evidence.


## 7. Follow-up hardening and handoff to render owner (7 November 2026)

### Implementation added only in this workstream

- **Named, affirmative citation review:** `src/script/review.ts` records a named reviewer, timestamp, substantive note, SHA-256 over the **exact** citation (including Arabic harakat) and the exact authored Quran text. Anonymous/legacy `verified` entries remain in the historical file but are treated as pending until a new human decision. `setReview` re-reads the current script to prevent a stale in-memory signoff. The `ReviewPanel` and HTTP API require reviewer + explicit confirmation. Nobody is approved automatically.
- **No optional-config bypass:** `src/script/approval.ts` requires every present citation to be explicitly verified independently of `REVIEW.required`, and every Quran verse written into the script must appear in its reference/citation section. Citation verification is not scripture expertise; it remains a human action.
- **Plan/script identity check:** `src/voice/motionGate.ts` fails final motion if any `verse-card` uses a stale or unknown reference, omits a script-authored verse, or displays text not **byte-for-byte** equal to the script's current Quran text. An approved script can never validate an unrelated old plan.
- **No cached Quran TTS escape:** `generateVoice` checks all selected jobs including previously cached voice clips, rather than only newly synthesized jobs. The separate special-line synthesis path remains guarded. All Quranic recitation must use a pre-recorded, attributable human reader.
- **Source and playable file integrity:** a full FFmpeg decode, audio SHA-256, valid review timestamp, reciter/source evidence and explicit listening declarations are necessary for audio review eligibility. A valid MP3 name hiding a symlink is rejected; both the original and processed files for manual Quran audio are checked. Historical lacking-source recitation pointers remain stored but **not eligible**.
- **Concurrency protection:** `syncQuran` writes Quran meaning data and recitation indexes via separate same-directory atomic rename operations. Provider-index updates take the same `.manual-audio.lock` as manual recitation review and merge the current manual entries, so a slow remote sync cannot replace a newly approved human recording. On a concurrent manual review it fails closed and requests a retry; no foreign temporary directory cleanup.
- **Reference trust:** Quran text matching from prelive or an unknown environment reports `pending` rather than `match`; differences are still shown, and nothing silently corrects the script.
- **Tests added/expanded:** citation reviewer proof and exact reference tashkil, old anonymous ledger, script citation coverage, source-translation conflicts, Unicode alignment completeness, manual sync preservation, symlink/forged MP3 reviews, corrupt original file, unintegrated audio, old or missing plan verse cards, source environment, strict listening and TTS protection. Decoder fixtures contain synthetic sine waves **only for codec integrity**, never Quran recitation.

### Required renderer integration before claiming 100%

The other workstream owns `src/plan/collect.ts`, `src/render/episode.ts`, package/Master entrypoints, `app/server/extra.ts` queue recovery and any resumed jobs. This branch deliberately does not modify renderer-owned files. The renderer must:

1. Call `assertMotionStartAuthorized(scriptPath, activePlan, activeVoiceIndex)` at **actual execution time** for every final render, whether launched via HTTP, direct CLI, package, batch, Master or recovered queue. Recheck before final output commit. Silent storyboard QA is explicitly exempt **only** when producing a clearly non-final review.
2. Implement a **verified manual recitation source** in the collector. Use `verifiedOwnRecitations(scriptPath)`, verify original and processed SHA-256, decode both, match the exact current script verse text/ref, and verify reader and rights evidence immediately before each stage. Do not infer permission merely from `provider: "manual"` or `reviewed`.
3. For every `verse-card` in final render, require a playable, licensed and correctly attributed recitation and validate the content source. No missing recitation, obsolete Quran Foundation cache, unsupported manual recording, or synthetic/voice-cloned Quran.
4. Write acceptance tests against every public entrypoint: unsigned/modified script; revised Quran text/ref/tashkeel; unknown Quran source; missing/changed recorded file and changed original; missing/skipped card; unapproved scene/storyboard/full narration; denied provider rights; direct CLI/package/queue recovery bypass; concurrent audio approval/sync; silent QA distinct from final. Tests must fail before output mutation and pass only with deliberately reviewed synthetic **non-Quran** audio fixtures.

### Operational acceptance status

- GitHub CI and Studio parity **have been repeatedly unable to execute any workflow steps** on recent SHA values (including previous attempt #816/#474). This is **not** proof that TypeScript or tests pass. Prior green checks from older SHAs do not cover the follow-up changes.
- No full repository `npm run typecheck` / `npm test` completion on this newest head, no published Master, and no owner scholarly or 1× continuous-listening decision has been claimed.
- **Do not mark the PR Ready or 100% end-to-end** until a full exact-SHA run and renderer-owner integration passes. Draft PR #76 is the sole deliverable for this branch; do not modify `main`, Mac production assets, episode files, other branches, or deploy via Vercel.


## 8. Free-form voice samples closed

The shared Studio `/api/voice-sample` route previously accepted any caller-provided text. That was a genuine alternative path into ElevenLabs, so guarding only scene narration could not prove Quran was never synthesized.

- `src/voice/sampleText.ts`: a small, curated and read-only set of **non-Quran** sample passages for the three channels, plus a safe generic fallback. `assertCuratedVoiceSample` rejects all arbitrary text.
- The backend refuses non-exact sample text **before** calling `el.sample`. It now serves only newly namespaced `curated-v1-<hash>.mp3` samples, never historical free-form samples. Historical files are **not deleted**.
- `ChannelBrand` displays the immutable sample and explains why editing is disabled.
- `tests/voice-sample-policy.test.ts` covers per-channel exact matches and arbitrary Quran/voice-cloning requests.

This is a deliberately restrictive safety trade-off. If editable narrator samples are needed later, they must use an independent audited non-Quran text policy and new acceptance tests, never remove the server-side gate.

**Still required for 100%:** exact-head TypeScript/Vitest run through an executable CI environment; renderer-owner collection and execution-time gates for direct/package/queue/Master; and human source/rights and full-speed listening review. Review outcomes must not be inferred from synthetic test fixtures.


## 9. Read-only inspection of the existing Master implementation — concrete bypasses

At the time of this PR, `src/render/episode.ts` remains **renderer-owned** and was read but not modified. The following must be corrected by the renderer team; these are concrete defects, not hypothetical concerns:

1. `assertMasterReady` checks `checkForChannel`, citation ledger, storyboard, scene and voice approval, but **does not call `assertScriptApproved`**. A current, properly reviewed but **not explicitly signed** script may therefore reach a Master render. Call `assertMotionStartAuthorized` from every final entrypoint in addition to the existing checks.
2. `versesWithoutRecitation(..., Boolean(chosenReciter))` permits an authored verse-card to have **no recitation** if the channel has not selected a reciter. For a final film, fail closed on every verse-card unless an actually licensed, verified human recitation exists.
3. `if (!o.allowUnreviewed)` makes the explicit `allowUnreviewed` option bypass scene review in a **Master**. Restrict this flag to visibly non-final QA/previews; never allow it to waive final acceptance.
4. `renderEpisode` calls `prepareRenderMedia` **before** `assertMasterReady`, causing media staging mutations before an authorization failure. Gate before staging, then recheck current script, MP3 bytes and provider license at the execution/final-commit boundary.
5. The collector considers several provider-index entries based on filenames and durations rather than verifying current SHA-256, complete decode and rights at collection; it currently does not consume `provider: "manual"`. The render-owned workstream must integrate `verifiedOwnRecitations`, then reject stale originals or processed MP3s and missing/unknown provenance.

**Regression matrix required on the renderer branch:** Master with unchanged approved citation ledger but no `script-signoff.json` must fail; Master with verse and no chosen reciter or valid recording must fail; Master with `allowUnreviewed:true` and an unreviewed scene must fail; final render with a swapped MP3 before actual execution or before commit must fail without replacing any previous Master; direct CLI/package and recovered queued jobs must not bypass these failures.

The workstream boundary is deliberate: this branch only supplies `src/voice/motionGate.ts`, verifiers, tests, API safeguards and this contract. It must remain Draft until the renderer owner delivers the above changes and the combined integration tests execute successfully.


## 10. Latest full-stack Quran/audio safety hardening and reproducible test runner

### Recorded audio review and source attribution
- A pending locally uploaded human recitation now carries `textSha256` from the **upload-time** authored verse. Before approval the reviewer must be looking at the **same** verse; a change while pending requires a fresh upload and review, never a retroactive signature.
- Review evidence persists the original uploaded filename (`originalName`), the safely stored source filename and SHA-256 (`originalFile`, `originalSha256`), processed audio SHA-256, verbatim reviewer note (`reviewNote`), reviewer, reciter, rights evidence, approval time and current authored verse SHA-256. Legacy records lacking source or reviewer proof remain historical but are not render-eligible.
- Neither the original recording nor its processing directory may use symlinks; parent directories are checked before files are read or created. The reviewer signoff files are write-once-per-atomic-rename under an exclusive per-episode lock. Corrupt reviewer/approval JSON is preserved and blocked, never reset and overwritten as an empty ledger.
- An approved narrator clip now binds actual MP3 bytes **plus playback duration and word timing**. Impossible word time ranges, a playback duration different from the file, damaged or substituted files, and symlink parents revoke the clip and the entire narration signoff.

### Full MP3 decode validation (verified locally, branch tests still pending)
- Running FFmpeg to `-f null -` with `-xerror` is **not sufficient**: an actual independently generated MP3 was truncated to 50%, FFmpeg exited **0**, but its Xing header retained the original ~1.228-second duration while only ~0.576 seconds decoded.
- `decodedAudioDuration` now extracts FFmpeg's `out_time_us` and compares the actual decoded duration against music-metadata's declared duration. It returns **null** on significant discrepancy. `tests/audio-integrity.test.ts` includes this deterministic truncated-MP3 regression, in addition to empty/invalid codecs and legitimate MP3/WAV.
- This validates decoder integrity and metadata coherence, **not** Quranic recitation identity, reader correctness, melodic quality or theological accuracy. No synthetic Quran was generated.

### Provider recording safety and parallel sync
- Quran Foundation and licensed AlQuran Cloud recordings now stage in unique temporary files. The final filename contains a prefix of the incoming SHA-256 and the index records the **full SHA-256 per part**. File publication uses same-directory atomic hard-link creation rather than `rename` that could overwrite an older functioning MP3.
- A partial multi-verse download failure leaves the previous index and recordings intact; immutable shared files are not removed by another failing task.
- Reusing a provider MP3 requires valid filename/path, SHA-256 and full decoded duration, not merely an index entry and a recent timestamp. Future-dated cache timestamps are invalid. Existing older provider indexes without per-part SHA require a fresh sync before they're trusted.
- `assertMotionStartAuthorized` now checks each authored Quran card has a selected human reciter, valid source identity, explicit Cloud publishing rights where applicable, and all provider recording parts valid. It also rejects Quran text hidden in the narration voice index even when cached. Unintegrated manual recordings remain blocked pending the renderer-owned collector integration.
- These pre-enqueue checks are **not a substitute** for renderer-owned execution-time and pre-commit rechecks in PR #73.

### Evidence-producing QA command

Run locally from this branch with installed node modules and FFmpeg:

```bash
cd ~/balislam
git switch work/studio-quran-audio-20261107
node scripts/run-quran-audio-qa.mjs
```

`scripts/run-quran-audio-qa.mjs` fails closed on the wrong branch, an unresolvable integration base, unexpected changed renderer/episode/shared-CI paths, missing FFmpeg, TypeScript failure, or any Vitest failure. It prints the **exact Git SHA**, base diff, stage exit status and a machine-readable JSON summary. It does not publish, create approvals, edit episode files or invoke Vercel.

The command must be executed in an environment with the repository dependencies; the presence of the runner does **not** imply the command passed. The existing GitHub CI jobs have repeatedly failed with zero executed steps. Do not reuse an older successful SHA as evidence for the new branch tip.

### Final acceptance boundary

No scholarly Quran approval, real reciter license validation, complete-speed human listening or actual production acceptance has been issued. Final 100% remains impossible to claim without (1) a full exact-SHA green TypeScript/Vitest run, (2) renderer PR #73 integrating verified manual audio and enforcing `assertMotionStartAuthorized` at **every final render entry point, dequeue, and output commit**, (3) final audio/rights and script reviewer decisions by the owner. The independent Draft PR #76 stays unmerged.


## 11. First Mac exact-head TypeScript / Vitest execution and three addressed failures

The operator executed `npm ci --ignore-scripts --no-audit --no-fund` followed by
`node scripts/run-quran-audio-qa.mjs` in the dedicated local worktree
`~/studio-quran-audio-qa-20261107` at **`e447821ef26b79645d6adf237fc5f64eddaee27c`**.

- `npm run typecheck`: exit **0**.
- `npm test` / Vitest: **86 of 89 test files passed; 664 of 667 tests passed; 3 tests failed**. The exact-head local tool runner exited **1**; no 100% acceptance.
- Failures were isolated to `tests/quran-script-source.test.ts` (published audio remained mutable via staging hard-link), `tests/recitation.test.ts` (legacy fixed filename expectation predating SHA-addressed storage), and `tests/voice-review.test.ts` (Arabic full-listening error message not matching the asserted wording).
- Remediation in newer commits: `publishImmutableRecitationPart` now removes its staging hard-link **as soon as** its immutable output is verified, with a new explicit `ENOENT` regression assertion; Quran Foundation test now confirms `qf-7-53-39-<hash>.mp3` in its index, its part SHA and actual file existence; full-episode listening rejection wording consistently includes «الاستماع الكامل».
- The preceding 664 green tests and zero-error `tsc` apply **only to commit `e447821`**, not automatically to the newer fixes. The full suite needs to be executed again on the new SHA and its JSON result archived for acceptance.

No main or production episode files were changed, renderer-owned files remain unmodified, and no human scholar or reciter-rights approval has been issued.


## 12. Renderer PR #73 + integration PR #78 — executable source-identity contract (7 Nov 2026)

**Authority and ownership.** This branch owns Quran/script/voice verification and the exported contract in `src/quran/renderContract.ts`. It does **not** implement or change renderer-owned `src/plan/collect.ts`, `src/render/*`, or episode data. Renderer PR #73 owns staging, bundle, queue, recovery, and final output. Integration PR #78 owns validation of the **combined exact heads**. No human signoffs are created by tests.

### Code APIs and invariants

- `verifiedOwnRecitations(scriptPath)` — returns only **human-reviewed** manual entries currently matching script verse text SHA, original-and-processed audio SHA, non-symlink files, full decodability, recording duration, named reader, explicit rights evidence and human reviewer/note. Any stale manual entry in `index.json` is **not** permission to fall back to another source. `ownAudioStatusForScript` retains `renderIntegrated:false` and denies manual final motion until the collector is integrated.
- `verifiedProviderPart(recitationsDir, part)` — requires a 64-hex SHA-256, local normal file, intact audio bytes, complete MP3 decoding including truncated files whose FFmpeg decode returns code 0, and duration agreement; returns `false` for invalid/missing/stale file content. A complete provider entry is trusted only when every part passes, not just the first.
- `assertMotionStartAuthorized(scriptPath, plan, voice)` — before final motion: script and source approvals bound to current bytes, exact verse-card text and key, no authored Quran in TTS narration, source-and-rights verification, full storyboard approval, *each narration clip* human listening signoff, and independently signed 1× full episode listening. It intentionally fails on any manually reviewed recording while the renderer collector lacks the integration.
- `assertReciterPublicationRights(choice)` — on final motion requires an exact named human reciter and an explicit HTTPS publishing-rights licence, owner, scope including YouTube publishing, timestamp, **named human reviewer and substantive review note** for QF and AlQuran Cloud. For manual recitations rights and named listener are checked in `verifiedOwnRecitations`. Downloadability is never presumed to imply publication permission. QF preview-only `{id,name}` remains usable for nonpublishing fetching but is **not final Master eligibility**.
- `approvedRecitationsForRender(scriptPath, activeRecitation)` — the **only** legal recitation selection for the renderer collector. Reads Quran keys exclusively from current `script.md`, verifies approved manual entries or currently selected QF/Cloud provider ID, licence, reciter name, freshness, every part's exact SHA and full decode; emits `AuthorizedRecitations` keyed by ayah. If a manual approval is stale, **throws rather than falling back** to global `assets/recitations` or a provider. Every selected result carries `source`, `reciter`, `file`, `duration`, and all `parts[]: { file, duration, sha256 }`.
- `assertRenderedRecitationsMatchApprovals(scriptPath, activeRecitation, media, privateStageRoot)` — **after** staging, validates exact per-verse coverage, channel and episode namespace, source (including manual), reader, filenames, durations, part SHAs and **bytes of the private staged MP3 files** against renewed live approvals. Rejects changed/missing material and a global `source: licensed` fallback. Also invoke renderer's `verifyStagedMedia(privateStageRoot, media.base)` to validate the **full immutable snapshot manifest**; neither call replaces the other.
- TTS: `generateVoice` checks both raw narration/neighbor text and post-dictionary `spoken` prompts **even for cache hits**. `synthesizeLines` verifies raw and post-dictionary text before cached reuse or API calls. Voice sample endpoint accepts only fixed non-Quran sample text. No AI recitation may be published.

### Required PR #73 connection points (renderer owner, not this branch)

1. **Collector selection**: In `src/plan/collect.ts`, resolve the script and active human reciter, call `approvedRecitationsForRender`, and build `media.recitations` **exclusively** from the returned entries. Delete the current global-library-first fallback for verse cards in final/video audio; do not silently omit any key. Use `recitationsDirFor(scriptPath)` for *both* manual and provider parts, and carry each part's `sha256`. Refuse any malformed/stale source rather than treating it as absent audio.
2. **Motion preflight**: In direct CLI/API render and every final enqueue path, invoke `assertMotionStartAuthorized` using the exact script, plan and voice set that will be rendered. While manual render is unintegrated the explicit fail-closed manual refusal must remain; relax it **only in the tested combined branch** after the collector uses the verified manual selection.
3. **Private media staging**: After `prepareRenderMedia`, call renderer `verifyStagedMedia` and `assertRenderedRecitationsMatchApprovals` with **the same actual private root** the isolated bundle will consume, before Remotion can open the bundle. Externally supplied `opts.media` is subject to the same checks: no caller-supplied snapshot bypass.
4. **Queue/recovery and TOCTOU**: Recheck both human approvals and staged exact-byte identity after dequeue/recovery and again immediately before final Master publication, not only at queue creation. A changed verse, reference, licence, review ledger, voice MP3, staged MP3, or media selection must fail closed and preserve the previous successful output.
5. **Storyboard/preview separation**: Silent storyboard asset preparation must remain image-only. A preview which actually renders or plays Quran audio must use approved selection and must not elevate a preview or stale cache to Master eligibility. Honor all per-channel episode namespaces.
6. **Workflow PR #77**: Both audio identity and persisted six-stage approvals must be current at final output/publish authorization; an audio-only green gate is not a replacement for owner-level AV/publishing authorization.

### Negative verification cases and required evidence

The runnable independent cases in `tests/quran-render-integration-contract.test.ts` and `tests/quran-tts-paths.test.ts` cover: same-source manual success fixture; global fallback mismatch; altered haraka/reference; missing reader/rights/reviewer/note; wrong MP3 SHA; changed staging bytes; wrong QF recitation ID; QF without rights or named human rights reviewer; stale QF cache; missing verse; cross-channel staged base; dictionary-injected Quran in TTS; and cached unsafe Quran TTS. Existing tests additionally check truncated MP3, manual original SHA, provider corrupted cache, all-source text provenance, scene-by-scene and whole-episode voice approval.

**Integration PR #78 must prove the actual connected entry points**, not merely green isolated unit fixtures:

- Negative collector tests with both a valid approved manual and a valid QF/Cloud source, a pre-existing global licensed file and missing/stale alternatives: the selected `media.recitations` must match the approved exact SHA and rights. No fallback.
- Negative staged snapshot and queue/dequeue/restart/crash tests: change original MP3, staged MP3, script haraka, citation reference, rights evidence or full-episode voice review **after** enqueue; no frame/bundle/Master may publish from stale evidence. The previous Master stays intact.
- Negative direct `renderEpisode({media})`, REST/API, preview-with-audio, CLI and recovered RenderPool job tests: no alternative entrance may skip source selection/voice/rights/board/workflow gates.
- Combined-head `npm run typecheck`, full `npm test`, scoped regression, render-isolation synthetic landscape/portrait smoke, three-channel isolation and immutable snapshot checks, followed by separate genuine human Quran/rights/audio/AV listening review. Archive exact SHAs, run evidence and output hashes.

**Evidence boundaries:** last *executed and reported* Quran/audio Mac acceptance was SHA `9322aa2` (89/89 files and 667/667 Vitest, TypeScript exit 0). The new integration contracts, new negative tests and QF publish gates are **later commits** and have **NOT yet been executed on Mac/CI**. PR #73 does not yet call the exported functions, and PR #78 has not yet reconciled these heads. Therefore branch-wide testing at the *new* head, combined functional Master tests and human approvals are pending. **Do not claim 100%, merge or publish.**
