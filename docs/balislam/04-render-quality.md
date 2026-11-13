# ٤. الرندر والجودة والتسليم

## الجودة

| النوع | الإعداد (`config.json` ← `video.quality`) | الاستعمال |
| --- | --- | --- |
| `master` | 4K (scale 2 = 3840×2160 للحلقة و2160×3840 للشورت)، H.264 `slow`، crf 14، صوت AAC 320k | كل ما يُنشر |
| `preview` | 1080p، `veryfast`، crf 20 | المعاينات والمختبرات والستوري بورد؛ لا تُنشر أبدًا |

المواصفة في `QUALITY` و`QualitySpec` (`src/render/quality.ts`)، ومعلومات جودة كل رندر في `renderInfoFile`، واعتماد النسخة الأساسية في `approvalValid`. الترتيب الثابت (النسخة الأساسية ← اعتمادها ← الشورتس) في القاعدة الرابعة من `CLAUDE.md`.

## طابور الرندر وإدارة الذاكرة (الأمران 009–010)

**أين:** `src/render/pool.ts` (`RenderPool`)، وطابور الاستوديو `studioPool` في `app/server/jobQueue.ts`، والأمر `npx bal -c balislam render-batch <تكوين…> --out <مجلد>` في `src/cli/index.ts`.

| القدرة | التنفيذ |
| --- | --- |
| توازٍ آمن من الموارد | `canStart` و`safeParallelism`: الذاكرة المتاحة مطروحًا منها احتياطي، وتقدير ذروة كل نوع مهمة من القياس الفعلي (لا متوسط تاريخي فقط) |
| خانات على مستوى الجهاز | `hostSlots`: رندرات أخرى على الجهاز نفسه تُحسب قبل البدء |
| تصنيف الفشل بالدليل | `classifyFailure` و`FAILURE_LABEL`: نفاد ذاكرة مثبت، إيقاف قسري، انتهاء المهلة، انهيار المتصفح، فشل التصيير، إلغاء، تعذّر التشغيل، بلا ملف ناتج، سبب غير محدد (مع التشخيص) |
| مراقبة التوقف | مهمة لا تستهلك المعالج مدة `--stall` (الافتراضي 5 دقائق) تُوقف وتُصنَّف |
| إيقاف نظيف | كل مهمة في مجموعة عمليات (`processTree`، `treeRssMB`)، فلا يبقى متصفح يتيم |
| الاستعادة | السجل على القرص؛ بعد إعادة تشغيل الاستوديو تُستعاد المنتظرة والمنقطعة وتوقف اليتيمة، ولا تُعاد المنتهية ولا يتلف ناتجها |
| إعادة الفاشل وحده | `render-batch --retry` |
| الإلغاء | زر في الاستوديو (مسار الإلغاء في `app/server/routes/jobs.ts`)، وCtrl-C في `render-batch` |

**مهم:** رندر الاستوديو يشغّل `bin/bal.mjs render` داخل `studioPool` (`startRenderJob`). تشغيل `npx bal render` من الطرفية مباشرة لا يمر بالطابور؛ للرندر المتعدد استعمل `render-batch`.
**الاختبارات:** `tests/render-pool.test.ts` (بعمليات حقيقية؛ اختبار الاستعادة معزول عن رندرات الجهاز الأخرى بـ`foreign: () => []`).

## المعاينات والإصدارات

- `npx bal -c balislam upload-preview <الحلقة> <الخانة> <الملف> --title "… · جاهز للمراجعة · لم يُعتمد فنيًا" --note "…"` (`putEpisodePreview` في `src/render/episodePreviews.ts`). يُرفع ثم يُتحقق من تشغيله من الاستوديو، ثم يُدفع إلى main.
- خانة لكل موضوع، ورقم نسخة في `previews/index.json`؛ النسخ السابقة في `git log -- <مجلد المعاينات>`.
- لا تُحذف معاينة سابقة دون إذن.
- **صور الستوري بورد** للمختبرات غير معاينات الفيديو: `npx bal -c balislam upload-storyboard <المختبر> <الخانة> <الصورة> --topic … --title … --order …` (`addLabStoryboard` في `src/channel/labStoryboards.ts`) تضيف نسخة ولا تحذف شيئًا، وتظهر في «مختبرات الإنتاج ← ستوري بورد · صور». حفظها أو عرضها ليس اعتمادًا.

## المراجعة والقياس

| الفحص | الموضع |
| --- | --- |
| مراجعة كل مشهد بعد تنفيذه (المعايير الثلاثة) | اعتماد كل مشهد بالصوت والصورة في «٢ المشاهد» (`src/studio/sceneService.ts`)، وبصمة المشهد `sceneHash` (`src/plan/sceneHash.ts`). سجل المراجعة القديم وأمره حُذفا (D120) |
| قياس الحركة | `measureMotion` (`src/render/motionMeter.ts`)، و`npx bal motion <ملف>`؛ والسكون المقصود مستثنى (`intendedStillness` في `src/render/stillness.ts`): بطاقة الآية، وتمهيدها (أي جملة تسبق بطاقة الآية مباشرة وتنتهي بنقطتين، في أي قالب)، وكلمة ذكر الله ±0.25 ث، والدعاء المقتبس «…» الذي يبدأ بـ«اللهم/ربنا/رب/ربي» من أوله إلى آخره |
| قياس الستوري بورد | `measureStoryboardMotion` (`src/render/storyboardMotion.ts`) |
| شروط النسخة النهائية | `assertMasterReady` (`src/render/episode.ts`) |
| فحص حزمة النشر | `packageEpisode` (`src/package/package.ts`)، و`assertNoTraces` (`src/package/traces.ts`) |

## البوابات والاختبارات

- **بوابة التسليم:** `.githooks/pre-push` ← `scripts/gate.mjs --commit <sha> --range <مدى>`: نسخة مؤقتة منفصلة من الـcommit المدفوع، ثم `tsc --noEmit` و`vitest run` كاملين برموز خروجهما الحقيقية، ثم تزامن التوثيق (`scripts/docs-sync.mjs`). أي فشل يرفض الدفع. تُثبَّت بـ`npm install` (`scripts/install-hooks.mjs`).
- **لا تُفحص نتيجة اختبار عبر أنبوب يخفي رمز الخروج** (`| grep`، `| tail`) قبل قرار دفع.
- **الحماية البعيدة:** حماية الفروع وGitHub Actions غير متاحة لهذا المستودع (خاص على خطة مجانية، وActions متوقفة بسبب الفوترة)، فالبوابة المحلية هي خط الدفاع.
- اختبارات «بالإسلام» الأساسية: `tests/engine-permanent.test.tsx`، `tests/transitions.test.tsx`، `tests/lighting.test.ts`، `tests/lighting-support.test.ts`، `tests/camera-composed.test.ts`، `tests/character-motion.test.ts`، `tests/figure-view.test.ts`، `tests/illus-direction.test.ts`، `tests/dua-board.test.ts`، `tests/no-unfit-element.test.ts`، `tests/identity-approved.test.ts`، `tests/master-gates.test.ts`، `tests/legacy-migration.test.ts`، `tests/stillness-merge.test.ts`، `tests/stillness-dua.test.ts`، `tests/dua-board-sacred.test.ts`، `tests/render-pool.test.ts`، `tests/balislam-reference.test.ts`.

## أعطال وملاحظات معروفة

- **رندر اللقطات المصمَّمة غير حتمي بالبت:** رندر الكود نفسه مرتين يعطي فروقًا طفيفة غير مرئية (PSNR ≥ 50 dB) في إطارات بعض اللقطات المصمَّمة. لذلك يُقارن التوافق بالمستوى نفسه من الضجيج لا بالتطابق الحرفي (الطريقة في [05-development.md](05-development.md#٨-التحقق-من-التوافق-مع-الإنتاج-السابق)). مصدره لم يُحدَّد بعد.
- **توقف رندر متوازٍ مرة واحدة (الأمر 013):** رندر عمودي شُغّل بالتوازي مع آخر توقف بلا تقدم، فأوقفه الطابور بعد 5 دقائق وصنّفه «انتهاء مهلة التقدم»، ونجح حين أُعيد وحده. إن تكرر: `render-batch --retry`، أو `--max 1`.
- **متصفح الرندر بلا إنترنت:** يلزم `REMOTION_BROWSER_EXECUTABLE` قبل تشغيل الاستوديو، وإلا تفشل مهامه بمحاولة تنزيل المتصفح (`ENOTFOUND`).
