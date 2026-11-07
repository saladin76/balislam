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
