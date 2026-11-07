# ١. الثوابت الهندسية والفنية لاستوديو «بالإسلام»

تُصنَّف كل قاعدة هنا بإحدى أربع درجات، ولا تُرفع درجة قاعدة دون قرار صاحب القناة:

| الدرجة | المعنى |
| --- | --- |
| **إلزامية** | لا تُكسر. أغلبها مفروض آليًا (الموضع مذكور)، وما ليس مفروضًا آليًا يُراجع يدويًا |
| **تفضيل إخراجي** | اتجاه معتمد يُتبع عادة، ويجوز خلافه لسبب إخراجي في المشهد |
| **اختياري** | أداة متاحة تُستعمل بحسب حاجة المشهد، وغيابها هو الأصل |
| **تجريبي** | منفذ ومختبر، لكنه **لم يُعتمد فنيًا** بعد |

## أ. الثوابت الهندسية (إلزامية)

| الثابت | كيف يُطبَّق |
| --- | --- |
| لا يُكسر توافق الحلقات القديمة | كل حقل جديد في الخطة اختياري، وغيابه = السلوك القديم حرفيًا. الافتراضيات الجديدة تُختم في الخطة عند إنشائها فقط (`plan.engineDefaults`، `applyEngineDefaults` في `src/plan/engine.ts`)، فإعادة توليد خطة قائمة لا تغيّرها (`tests/engine-permanent.test.tsx`) |
| لا تتغير المخرجات المعتمدة دون إذن | بصمة المشهد في `sceneHash` (`src/plan/sceneReview.ts`): أي تعديل لمشهد يعيده للمراجعة. الحقول الجديدة لا تدخل البصمة إلا حين تُستعمل، فلا تتغير بصمات المراجعات القائمة |
| لا يُقبل إعداد لا ينفذه المحرك | فحص الخطة `planIssues` (`src/plan/validate.ts`) يرفض برسالة واضحة: إضاءة لا يدعمها القالب (`lightingIssues`، `LIGHTING_SUPPORT` في `src/plan/lighting.ts`)، وانتقالًا لا يدعمه (`transitionIssues` في `src/plan/transitions.ts`)، ووضع كاميرا أو مشية أو حركة مجهولة. وما يرفضه الفحص لا يُطبَّق في الرندر (`activeTransition` في `src/remotion/scenes/Episode.tsx`) |
| لا تُحذف النسخ السابقة بغير قصد | المعاينات بخانات (`putEpisodePreview` في `src/render/episodePreviews.ts`)، والنسخ السابقة في سجل git. لا حذف لمعاينة أو إنتاج دون إذن |
| لا يُدفع تغيير تفشل اختباراته | بوابة التسليم `scripts/gate.mjs` من `.githooks/pre-push`: فحص الأنواع والاختبارات على الـcommit المدفوع نفسه، وتزامن التوثيق |
| تطويرات القناة معزولة عن القنوات الأخرى | `channels` في `ENGINE_FEATURES` و`engineEnabled` (`src/plan/engine.ts`)؛ قوالب القناة `only: ["balislam"]` في `src/plan/templateMeta.ts`؛ واختبار العزل في `tests/engine-permanent.test.tsx` و`tests/studio-three-channel-isolation.test.ts` |
| الرندر قابل للاستعادة بعد الأعطال | `RenderPool` في `src/render/pool.ts`: سجل الطابور، والاستعادة بعد إعادة التشغيل (`recover`)، وتصنيف الفشل بالدليل (`classifyFailure`)، وإعادة الفاشل وحده (`render-batch --retry`) |
| مكونات مشتركة بدل تكرار المنطق | الحركة من طبقة واحدة (`locomote`، `characterAt` في `src/remotion/illus/gait.ts`)، والإضاءة من `src/remotion/illus/light.tsx`، والانتقالات من `src/remotion/scenes/transitions.tsx`. لا يُنسخ منطق إلى قالب |
| الأسرار في `.env` فقط | لا مفتاح في الكود ولا الوثائق ولا الواجهة؛ اختبار المرجع يرفض أي نمط مفتاح هنا |

## ب. الثوابت البصرية والإخراجية

### الهوية (إلزامية)

مصدرها الوحيد `brand/identity/approved.ts` (`APPROVED_IDENTITIES.balislam`)، ومقفلة بـ`tests/identity-approved.test.ts`. الوثيقة الأصلية: `channels/balislam/references/package/03_visual_identity/approved-mihrab-al-noor.png`.

| البند | القيمة |
| --- | --- |
| الاسم | «محراب النور» (اعتُمد ٣ نوفمبر ٢٠٢٦) |
| الألوان | ليل زمردي `#0B1F1C` · نحاس `#C9A24A` · فجر `#F2B35B` · ورق `#F4EEE2` · ختم `#C2412D` |
| الخطوط | Aref Ruqaa للعناوين والشعار، وTajawal للنص |
| الافتتاحية | `MihrabIntro` (`src/remotion/scenes/MihrabIntro.tsx`)، و`brand.intro = "mihrab"` |
| النقوش | الأقواس والنجمة الثمانية |
| الوجوه والموسيقى | لا وجوه (شخصيات بلا ملامح بمفاصل)، ولا موسيقى (`rules` في `channels/balislam/channel.json`) |

### الأساليب والمكتبة

- **إلزامية:** لا قالب ولا عنصر خارج مكتبة القناة (`library.exclude` في `channels/balislam/channel.json`، و`templateExclusion` في `src/channel/library.ts`). فحص الخطة يرفض ما ليس منها.
- **تفضيل إخراجي:** أساليب القناة «حكايات الحارة» (`alley-tale`) و«الطريق» (`road-journey`) و«ظل ونور» (`light-stage`)، والنص الحركي (`kinetic-text`) ولوح الدعاء (`dua-board`). التنوع بين الحلقات (المبدأ الثاني في `CLAUDE.md`) في الأسلوب والمكان، والثابت هو البصمة فقط.
- **إلزامية:** لا عنصر لا يطابق الكلمة المنطوقة (القاعدة الثالثة في `CLAUDE.md`). الأحداث من القائمة المراجَعة `CUE_WORDS` في `src/plan/sceneCues.ts`، وعند الشك لا يُرسم شيء.

### الحركة والكاميرا والإضاءة والانتقالات

| القاعدة | الدرجة | التطبيق |
| --- | --- | --- |
| حركة مقصودة في 80% من الثواني على الأقل، ولا مقطع ساكن فوق ثانيتين | إلزامية للمنشور | `src/render/motionMeter.ts` (`MOTION_MIN`)، والحزمة تُرفض تحتها |
| السكون المقصود عند الآية وذكر الله ليس خطأ، ولا تُضاف حركة زخرفية لتعويضه | إلزامية | `src/render/stillness.ts` (`intendedStillness`) |
| لكل حركة كاميرا سبب في الكلام، لا تأطير آلي مع كل سطر | تفضيل إخراجي | الكاميرا المؤلَّفة (`cameraMode = composed`) — **تجريبية** لم تُعتمد افتراضيًا |
| المشي بقدم ثابتة وتسارع وتباطؤ، والالتفاتة بدوران الجسد | تفضيل إخراجي | طبقة الحركة المشتركة — **تجريبية** |
| الإضاءة والظلال والعمق | اختياري | حقل `lighting`، لا يُفرض أبدًا |
| الانتقالات بين المشاهد | اختياري | حقل `transition`؛ القطع المباشر خيار إخراجي كامل، ولا يُضاف انتقال بين كل مشهدين |
| لا يخرج عنصر من الإطار ولا يختفي فجأة | إلزامية | المراجعة بعد التنفيذ (القاعدة السادسة في `CLAUDE.md`)، و`pillInView` في الكاميرا المؤلَّفة |

لا تتحول الاختيارات الجمالية المرنة (زاوية، حجم لقطة، مشية، نوع انتقال) إلى قواعد ثابتة: هي أدوات تُختار لكل مشهد.

## ج. الثوابت الشرعية والمحتوى

**المرجع هو الوثائق الرسمية، لا هذا الملف ولا الكود:** `channels/balislam/references/package/01_official_references/` — ميثاق المحتوى والمرجعية الشرعية (`sharia-editorial-charter.pdf`)، ودليل القناة، وأصول كتابة السكريبت، ودليل الصوت، ودليل المحتوى. محفوظة كما سُلّمت ببصمات `manifest.json`، ولا تُعدَّل ولا تُلخَّص بدلًا منها. التعارضات المعلّقة في `channels/balislam/references/package/04_execution/OPEN_DECISIONS.md` لا تُحسم بالكود.

ما يضمنه الاستوديو تقنيًا (لا يغني عن المراجعة الشرعية):

| القيد | الموضع |
| --- | --- |
| النص القرآني من السكريبت المكتوب والمُراجع فقط؛ لا يُجلب أو يُبدّل من مصدر خارجي | `quranFromScript` (`src/quran/scriptText.ts`)، `compareVerseText` (`src/quran/compare.ts`)، `auditEpisodeQuran` (`src/quran/audit.ts`)، `planIssues` (`src/plan/validate.ts`) |
| التلاوة البشرية يرفعها المالك وتُراجع حقوقها وبصمتها؛ لا يُستخدم أي ملف تلاوة خارجي بديل في الرندر | `approvedRecitationsForRender` و`assertRenderedRecitationsMatchApprovals` (`src/quran/renderContract.ts`)، `assertMasterReady` (`src/render/episode.ts`) |
| الحديث بدرجته (صحيح أو حسن فقط) وبنصه | `rules.hadithGrades` في `channels/balislam/channel.json`، وبطاقة حديث بلا نص خطأ في `planIssues` |
| لا يُولَّد صوت قبل اكتمال توثيق الاستشهادات | سجل التوثيق `src/script/review.ts`، ويُفحص في `assertMasterReady` (`src/render/episode.ts`) |
| تشكيل 98% على الأقل قبل الصوت | `TASHKEEL` في `src/voice/tashkeelReport.ts` |
| لا أحداث ولا رموز ولا فقاعات في جملة فيها ذكر الله أو دعاء أو آية | `isSacredSentence` (`src/plan/sceneCues.ts`) يمنع الأحداث فيها ويُسكن البطل (`posesFor` في `src/plan/illusDirect.ts`) |
| قبل الآية وذكر الله وبعدهما القطع أو المزج فقط | `sacredScene` و`transitionIssues` (`src/plan/transitions.ts`) |
| لوح الدعاء بلا رموز بجوار الدعاء، وانتقاله المتصل الخاص | `src/remotion/scenes/DuaBoard.tsx`، و`NO_TRANSITION_TEMPLATES` (`src/plan/transitions.ts`) |
| لا أثر لأدوات الإنتاج في المنشور | `findTraces` (`src/package/traces.ts`)، و`cleanMetadata` (`src/render/episode.ts`) |

المسائل الشرعية المتخصصة لمراجع مؤهل، وأي شك في تمثيل أو نص يُرفع إلى صاحب القناة قبل التنفيذ.
