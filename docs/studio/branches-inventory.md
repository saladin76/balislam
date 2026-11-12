# جرد فروع GitHub (العمل ١٠)

> **ما هذا الملف:** قائمة كل فروع `saladin76/balislam` على GitHub بثلاث فئات (D106، `docs/studio/stabilization-brief.md`، العمل ١٠؛ D113).
> **تم الحذف (D117):** وافق المالك (١٣ نوفمبر، ٠٠:١٦) على الفئتين ١ و٢، فحذف `.github/workflows/delete-approved-branches.yml` الفروع الـ٦٦ كلها (٥٩ + ٧) في التشغيل 43310001960 بعد دمج PR #110 (`7d66e34f`)، ولم يُتخطَّ شيء. الفئة ٣ و`backup/*` و`previews/*` و`main` باقية كما هي. **الاستعادة:** SHA كل فرع في الجدولين ١ و٢ أدناه (المختصر) وكاملًا في `docs/studio/branches-approved-delete.txt`: `gh api -X POST repos/saladin76/balislam/git/refs -f ref=refs/heads/<الفرع> -f sha=<SHA>`.
> **وقت الجرد:** ١٢ نوفمبر ٢٠٢٦، ٢٣:٠٠ (UTC)، و`main` عند `b1e00324`. «أمام main» = commits في الفرع ليست في `main`؛ «خلف main» = commits في `main` ليست في الفرع (من `GET /repos/…/compare/main...<الفرع>`)، و«PR» من قائمة طلبات الدمج.
> **القاعدة:** «مهجور» = لا commit منذ أسبوع (آخر commit يوم ٥ نوفمبر أو قبله). فروع `backup/*` تبقى إلا إذا قال المالك غير ذلك. فروع `previews/*` مخزن معاينات الجلسات السحابية (D75) وليست عملًا، فلا تُعد هنا؛ تنظيفها بأمرها `npx bal cloud-preview prune`.

## الخلاصة

| الفئة | العدد | ما يقترح Claude |
|---|---|---|
| ١. مدموج في `main`، آمن للحذف | ٥٩ | حذفها كلها: لا commit فيها ليس في `main` («أمام main» = ٠) |
| ٢. غير مدموج، مهجور (لا commit منذ أسبوع) | ٧ | حذفها بعد موافقتك؛ كلها من ٤–٥ نوفمبر، قبل الاستوديو الموحد (#93) بأيام، وطلبات الدمج المفتوحة منها تُغلق معها |
| ٣. نشط (commit خلال الأسبوع) | ٣١ | تبقى الآن. أغلبها من ٦–٨ نوفمبر وخلف `main` بمئات الـcommits، فتجاوزها الاستوديو الموحد؛ تُعرض عليك مرة ثانية حين تصير مهجورة بالتعريف (بعد ١٥ نوفمبر) |
| `backup/*` | ٦ | تبقى (التكليف) |
| `previews/*` (D75) | ١٧ | تبقى؛ ليست فروع عمل |
| `main` | ١ | — |
| **المجموع** | ١٢١ | |

**قرار المالك:** «احذف الفئتين ١ و٢» (١٣ نوفمبر، ٠٠:١٦) — نُفّذ (D117).

## ١. مدموج في `main`، آمن للحذف (٥٩) — حُذفت كلها ١٣ نوفمبر (D117)

| الفرع | آخر commit | أمام main | خلف main | PR |
|---|---|---|---|---|
| `docs/channel-motion-production-standard-20261104` | 2026-11-04 (`b821a237`) | 0 | 1000 | #9 merged |
| `feat/episode-workspace-v03` | 2026-11-04 (`148a5d83`) | 0 | 1094 | #1 merged |
| `feat/storyboard-motion-logic-review` | 2026-11-04 (`634cad93`) | 0 | 1080 | #2 merged |
| `feat/studio-integration-rebased-20261104` | 2026-11-04 (`72cec85b`) | 0 | 936 | #17 merged |
| `feat/studio-preview-audit-parity-20261104` | 2026-11-04 (`8aacfc4c`) | 0 | 975 | #10 merged |
| `fix/motion-audit-production-hardening` | 2026-11-04 (`5ba176c0`) | 0 | 1039 | #4 merged |
| `fix/motion-audit-review-round2` | 2026-11-04 (`e2d74e02`) | 0 | 1020 | #5 merged |
| `fix/motion-audit-round2-verified` | 2026-11-04 (`e2d74e02`) | 0 | 1020 | #6 merged |
| `fix/voice-no-documentation-gate-20261104` | 2026-11-04 (`b53c7a7c`) | 0 | 963 | #13 merged |
| `fix/workspace-overflow-layout` | 2026-11-04 (`4536a787`) | 0 | 1075 | #3 merged |
| `sample/ep001-a-b` | 2026-11-04 (`4900172c`) | 0 | 1007 | — |
| `sync/production-assets` | 2026-11-04 (`988075c0`) | 0 | 1018 | #7 merged |
| `docs/dafatir-001-production-continuation-20261105` | 2026-11-05 (`877783c1`) | 0 | 777 | #36 merged |
| `feat/alquran-multi-reciter-review-20261105` | 2026-11-05 (`45817f8b`) | 0 | 873 | #25 merged |
| `feat/production-reciter-provider-and-voice-ux-20261105` | 2026-11-05 (`68315eb3`) | 0 | 827 | #27 merged |
| `feat/quran-text-only-cache-safe-20261105` | 2026-11-05 (`8f798388`) | 0 | 845 | #30 merged |
| `feat/replace-mp3quran-alquran-cloud-20261104` | 2026-11-05 (`8979185c`) | 0 | 915 | #18 merged |
| `fix/alquran-error-typecheck-20261105` | 2026-11-05 (`c98be7c2`) | 0 | 916 | #24 merged |
| `fix/dua-board-arabic-glyph-reveal-20261105` | 2026-11-05 (`599565a5`) | 0 | 877 | #26 merged |
| `fix/episode-discovery-lab-collision-20261105` | 2026-11-05 (`8fa3bd65`) | 0 | 913 | #20 merged |
| `fix/include-orphan-director-tests-20261105` | 2026-11-05 (`e3817f90`) | 0 | 917 | #22 merged |
| `fix/preview-atomic-replacement-20261105` | 2026-11-05 (`75690676`) | 0 | 913 | #21 merged |
| `fix/quran-cache-script-change-during-fetch-20261105` | 2026-11-05 (`9cfe7710`) | 0 | 784 | #34 merged |
| `fix/quran-text-only-test-typecheck-20261105` | 2026-11-05 (`1dc0f2e7`) | 0 | 792 | #32 merged |
| `fix/studio-browser-tab-title-20261105` | 2026-11-05 (`c327cbb8`) | 0 | 862 | #29 merged |
| `fix/studio-git-merge-head-check-20261105` | 2026-11-05 (`8ef873fa`) | 0 | 780 | #35 merged |
| `fix/studio-update-failure-reporting-20261105` | 2026-11-05 (`edb47695`) | 0 | 794 | #31 merged |
| `fix/studio-updater-pending-git-operations-20261105` | 2026-11-05 (`bdb3494b`) | 0 | 788 | #33 merged |
| `studio/intentional-stillness-phase1-design-20261105` | 2026-11-05 (`428c7e87`) | 0 | 916 | #19 merged |
| `ux/alquran-cloud-rights-evidence-filters-20261105` | 2026-11-05 (`476aafa5`) | 0 | 749 | #40 merged |
| `ux/alquran-reciter-picker-state-safety-20261105` | 2026-11-05 (`e55aaa84`) | 0 | 744 | #41 merged |
| `ux/channel-alquran-cloud-listen-20261105` | 2026-11-05 (`b6408cad`) | 0 | 759 | #39 merged |
| `ux/channel-alquran-cloud-preview-reciter-20261105` | 2026-11-05 (`3efe19ed`) | 0 | 763 | #38 merged |
| `ux/channel-settings-responsive-provider-states-20261105` | 2026-11-05 (`7b86769a`) | 0 | 773 | #37 merged |
| `ux/channel-settings-sections-layout-20261105` | 2026-11-05 (`d0620f74`) | 0 | 731 | #42 merged |
| `ux/studio-wide-polish-phase2-20261105` | 2026-11-05 (`ca029049`) | 0 | 720 | #43 merged |
| `ux/visible-studio-primary-navigation-20261105` | 2026-11-05 (`06729e98`) | 0 | 711 | #44 merged |
| `feat/studio-storyboard-pdf-print-review` | 2026-11-06 (`32efd58d`) | 0 | 668 | #67 merged;#63 merged |
| `fix/gate-git-env-isolation` | 2026-11-06 (`e7deca07`) | 0 | 677 | #65 merged;#61 merged |
| `fix/studio-visual-storyboard-gate-20261106` | 2026-11-06 (`97d1cc64`) | 0 | 655 | #66 merged;#62 merged |
| `ux/studio-shell-redesign` | 2026-11-06 (`223419f0`) | 0 | 699 | #46 merged |
| `integration/studio-20261107-reconcile-current-main` | 2026-11-07 (`6a24a1c9`) | 0 | 593 | — |
| `integration/studio-20261107-release-candidate` | 2026-11-07 (`ed93fc06`) | 0 | 590 | #69 merged;#68 merged |
| `work/studio-final-candidate-20261107` | 2026-11-07 (`98b754dc`) | 0 | 449 | #83 open;#82 open |
| `integration/studio-unified-20261108` | 2026-11-08 (`3de81a83`) | 0 | 270 | #93 merged |
| `integration/studio-v2-e2e-20261108` | 2026-11-08 (`40b4d07e`) | 0 | 457 | #90 open |
| `work/studio-channel-production-rules-20261108` | 2026-11-08 (`29da0529`) | 0 | 428 | #84 open |
| `work/studio-v2-render-pool-settling-20261108` | 2026-11-08 (`e2a555af`) | 0 | 456 | #91 open |
| `work/studio-workflow-gates-20261107` | 2026-11-08 (`2d6523d6`) | 0 | 458 | #77 open |
| `docs/d111-owner-decisions` | 2026-11-12 (`b739623f`) | 0 | 6 | #103 merged |
| `docs/known-issues-owner-reports` | 2026-11-12 (`ce3d10a6`) | 0 | 27 | #99 merged |
| `docs/stabilization-d106` | 2026-11-12 (`e191e727`) | 0 | 29 | #98 merged |
| `errors-capture` | 2026-11-12 (`feccbb1a`) | 0 | 1 | #104 merged |
| `fix/notes-inbox-works-20261112` | 2026-11-12 (`5be6a074`) | 0 | 25 | #100 merged |
| `fix/owner-error-details` | 2026-11-12 (`b38588ec`) | 0 | 23 | #101 merged |
| `fix/studio-review-reliability-20261112` | 2026-11-12 (`36a2cd4d`) | 0 | 8 | #97 merged |
| `fix/untrack-old-preview-videos` | 2026-11-12 (`d0637f64`) | 0 | 21 | #102 merged |
| `work/topcaption-033` | 2026-11-12 (`4e897c06`) | 0 | 84 | #96 merged |
| `work/zubdat-001-recue` | 2026-11-12 (`dc37f39a`) | 0 | 57 | — |

## ٢. غير مدموج، مهجور (٧) — حُذفت كلها ١٣ نوفمبر (D117)

| الفرع | آخر commit | أمام main | خلف main | PR |
|---|---|---|---|---|
| `chore/balislam-production-environment-v1` | 2026-11-04 (`e9e8b449`) | 23 | 1016 | #8 open |
| `feat/studio-mp3quran-browser-20261104` | 2026-11-04 (`4a8f7e64`) | 10 | 972 | #11 open |
| `feat/studio-simplified-workflow-20261104` | 2026-11-04 (`71b0558a`) | 15 | 971 | #12 open |
| `feat/studio-validated-integration-20261104` | 2026-11-04 (`ffc570e1`) | 21 | 958 | #16 open |
| `fix/studio-audio-test-timeout-20261104` | 2026-11-04 (`e0b04b92`) | 1 | 959 | #15 merged |
| `test/studio-three-channel-separation-20261104` | 2026-11-04 (`40584832`) | 2 | 960 | #14 open |
| `fix/vercel-readonly-studio-preview` | 2026-11-05 (`da908eb0`) | 1 | 708 | #45 open |

## ٣. نشط (٣١)

| الفرع | آخر commit | أمام main | خلف main | PR |
|---|---|---|---|---|
| `dev/balislam-019-tools` | 2026-11-06 (`51de722d`) | 10 | 691 | — |
| `feat/balislam-001-scale-event` | 2026-11-06 (`3b68d136`) | 3 | 691 | — |
| `feat/studio-local-release-audit` | 2026-11-06 (`0ab30805`) | 16 | 691 | #50 open |
| `feat/studio-local-release-board-20261106` | 2026-11-06 (`f4872e31`) | 106 | 693 | #56 open |
| `feat/studio-release-readiness-dashboard` | 2026-11-06 (`2fe53836`) | 120 | 693 | #55 open |
| `feat/studio-storyboard-tone-voice-first` | 2026-11-06 (`fdef3419`) | 102 | 693 | #57 merged |
| `fix/recitation-exact-timing-and-voice-gates` | 2026-11-06 (`2cef874b`) | 167 | 693 | #60 open |
| `fix/studio-handoff-acceptance-followup` | 2026-11-06 (`f45152e8`) | 80 | 693 | #49 closed |
| `fix/studio-preview-safe-cloud-sync` | 2026-11-06 (`96780080`) | 103 | 693 | #47 open |
| `integration/studio-localhost-acceptance-20261106` | 2026-11-06 (`1bc05aa5`) | 96 | 693 | #54 merged |
| `studio-handoff-queue` | 2026-11-06 (`816d6183`) | 3 | 691 | — |
| `wip/balislam-015` | 2026-11-06 (`9b17f913`) | 1 | 702 | — |
| `feat/quran-manual-script-text-024` | 2026-11-07 (`d02513b5`) | 119 | 590 | #75 open |
| `fix/studio-tmp-lifecycle-arabic-pdf-20261107` | 2026-11-07 (`b18190d3`) | 117 | 590 | #70 open |
| `work/studio-core-channels-20261107` | 2026-11-07 (`ea4611b7`) | 91 | 590 | #80 open |
| `work/studio-integration-validation-20261107` | 2026-11-07 (`3d0c8161`) | 6 | 562 | #78 open |
| `work/studio-motion-engine-20261107` | 2026-11-07 (`f3ff443a`) | 3 | 590 | #79 open |
| `work/studio-p0-temp-20261107` | 2026-11-07 (`2ad60044`) | 43 | 590 | #72 open |
| `work/studio-p1-arabic-pdf-20261107` | 2026-11-07 (`3be644e5`) | 30 | 590 | #71 open |
| `work/studio-quran-audio-20261107` | 2026-11-07 (`29e3d5b5`) | 182 | 590 | #76 open |
| `work/studio-render-isolation-20261107` | 2026-11-07 (`d372deca`) | 132 | 590 | #73 open |
| `work/studio-scene-first-manual-quran-20261107` | 2026-11-07 (`61d81c5b`) | 216 | 590 | #81 open |
| `work/studio-ui-workspaces-20261107` | 2026-11-07 (`edaa1374`) | 111 | 590 | #74 open |
| `feat/balislam-001-storyboard` | 2026-11-08 (`72aeda60`) | 25 | 691 | — |
| `work/studio-v2-backend-20261108` | 2026-11-08 (`495ce3ed`) | 62 | 458 | #88 open |
| `work/studio-v2-qa-20261108` | 2026-11-08 (`4052d6dc`) | 27 | 458 | #85 open |
| `work/studio-v2-qa09-exception-safety-20261108` | 2026-11-08 (`b12c9bce`) | 3 | 456 | #92 open |
| `work/studio-v2-render-20261108` | 2026-11-08 (`03f8bf90`) | 40 | 458 | #86 open |
| `work/studio-v2-ui-20261108` | 2026-11-08 (`cd861cae`) | 58 | 458 | #87 open |
| `work/ci-timeouts-033` | 2026-11-12 (`c4e545da`) | 1 | 93 | #95 closed |
| `work/storyboard-032` | 2026-11-12 (`11ded8f0`) | 9 | 80 | #94 open |

## `backup/*` (تبقى، ٦)

| الفرع | آخر commit | أمام main | خلف main | PR |
|---|---|---|---|---|
| `backup/mac-old-main-20261108` | 2026-11-04 (`915dae07`) | 24 | 1019 | — |
| `backup/mac-next-validation` | 2026-11-05 (`24d82c6a`) | 2 | 872 | — |
| `backup/mac-reciter-ux-validation` | 2026-11-05 (`e558bab2`) | 3 | 828 | — |
| `backup/mac-release-validation` | 2026-11-05 (`50485e1a`) | 5 | 884 | — |
| `backup/mac-balislam-20261108` | 2026-11-08 (`f83adf6e`) | 29 | 1007 | — |
| `backup/mac-dafatir-edits-20261108` | 2026-11-08 (`7a0bbe9c`) | 1 | 273 | — |

## `previews/*` (مخزن المعاينات السحابية D75، ١٧)

لا أصل مشترك لها مع `main` (commit يتيم لكل خانة، ولا تُدمج أبدًا)، فلا «أمام» ولا «خلف».

| الفرع | آخر commit | أمام main | خلف main | PR |
|---|---|---|---|---|
| `previews/balislam/001-know-the-truth/sb032-01-scale-landscape` | 2026-11-11 (`2e8728bf`) | - | - | — |
| `previews/balislam/001-know-the-truth/sb032-01-scale-portrait` | 2026-11-11 (`bed7dd4f`) | - | - | — |
| `previews/balislam/001-know-the-truth/sb032-02-cat-landscape` | 2026-11-11 (`cb632d6d`) | - | - | — |
| `previews/balislam/001-know-the-truth/sb032-02-cat-portrait` | 2026-11-11 (`9fd0c2bf`) | - | - | — |
| `previews/balislam/001-know-the-truth/sb032-03-envelope-landscape` | 2026-11-11 (`5c973259`) | - | - | — |
| `previews/balislam/001-know-the-truth/sb032-04-chair-landscape` | 2026-11-11 (`43593158`) | - | - | — |
| `previews/balislam/001-know-the-truth/sb032-04-chair-portrait` | 2026-11-11 (`84ccb537`) | - | - | — |
| `previews/balislam/001-know-the-truth/sb032-06-night-landscape` | 2026-11-11 (`a91a64dd`) | - | - | — |
| `previews/balislam/001-know-the-truth/sb032-07-return-landscape` | 2026-11-11 (`9d85a2f2`) | - | - | — |
| `previews/balislam/001-know-the-truth/sb032-07-return-portrait` | 2026-11-11 (`0a502d99`) | - | - | — |
| `previews/balislam/001-know-the-truth/sb032-08-listen-landscape` | 2026-11-11 (`7284e180`) | - | - | — |
| `previews/balislam/001-know-the-truth/sb032-05-phone-landscape` | 2026-11-12 (`fbdd10b7`) | - | - | — |
| `previews/balislam/001-know-the-truth/sb032-05-phone-portrait` | 2026-11-12 (`830f9d96`) | - | - | — |
| `previews/balislam/001-know-the-truth/sb032-09-recall-landscape` | 2026-11-12 (`0acf2b76`) | - | - | — |
| `previews/balislam/001-know-the-truth/sb032-09-recall-portrait` | 2026-11-12 (`5e0a2b59`) | - | - | — |
| `previews/balislam/001-know-the-truth/sb032-10-ending-landscape` | 2026-11-12 (`3fd3ffa8`) | - | - | — |
| `previews/dafatir-alzaman/001-adam-beginning/episode` | 2026-11-12 (`7541eabe`) | - | - | — |
