# ٢. البنية الهندسية

## التقنيات

| الطبقة | التقنية |
| --- | --- |
| المشاهد والرندر | Remotion 4 (`remotion`، `@remotion/renderer`) بمكونات React وSVG متجهي |
| معاينة المشاهد في الاستوديو | `@remotion/player` |
| الاستوديو | تطبيق Vite + React في `app/` (الواجهة `app/src/`، والخادم `app/server/` مدمج في خادم Vite) |
| الأداة | `bin/bal.mjs` ← `src/cli/index.ts` (Commander) |
| اللغة والفحص | TypeScript (`npx tsc --noEmit -p .`)، والاختبارات Vitest في `tests/` |
| الإعداد العام | `config.json` (fps 30، أبعاد الحلقة 1920×1080 والشورت 1080×1920، وجودة master وpreview) |

## المجلدات الأساسية

| المسار | ما فيه |
| --- | --- |
| `channels/balislam/` | `channel.json` (المجالات، الأساليب، القواعد، المكتبة، الصوت، `production`)، والهوية، وقاموس النطق، والمرجعيات الرسمية `references/`، والحلقات `episodes/` |
| `channels/balislam/episodes/<الحلقة>/` | `script.md`، `research.md`، `plan.json`، `scene-review.json`، `previews/` (والصوت والمخرجات حين تُولَّد) |
| `channels/balislam/episodes/900-engine-lab/` | مختبر المحرك: معاينات اختبارات المحرك (لا تُنشر ولا تُعد حلقة) |
| `templates/balislam/` | قالب السكريبت للقناة |
| `brand/` | الهويات المعتمدة (`brand/identity/approved.ts`)، والثيمات، والعناصر ودليل تصميمها `brand/elements/GUIDE.md` |
| `src/script/` | قراءة السكريبت وفحصه (`parseScript`، `checkForChannel`) وسجل التوثيق |
| `src/plan/` | الخطة: أنواعها، والقوالب، والتوليد، والفحص، والإخراج الآلي، والكاميرا، والإضاءة، والانتقالات، وسجل أدوات المحرك |
| `src/remotion/` | التكوينات (`src/remotion/Root.tsx`)، والحلقة (`src/remotion/scenes/Episode.tsx`)، والقوالب (`src/remotion/scenes/`)، والعالم المصوَّر (`src/remotion/illus/`)، والمختبرات (`src/remotion/lab/`) |
| `src/render/` | الرندر، والجودة، والطابور، والمعاينات، وقياس الحركة |
| `src/quran/` | نصوص الآيات وتلاواتها والتحقق منها |
| `src/voice/` | الصوت والتشكيل (لا يُطوَّر في هذه المرحلة) |
| `src/package/` | حزمة النشر وفحص الآثار |
| `src/channel/` | تحميل القناة، والمكتبة، والأدلة، والمختبرات |
| `app/` | الاستوديو |
| `scripts/` | البوابة (`scripts/gate.mjs`)، وتزامن التوثيق (`scripts/docs-sync.mjs`)، وتثبيت الخطاف (`scripts/install-hooks.mjs`) |

## مسار الحلقة من السكريبت إلى الفيديو

1. **السكريبت:** `script.md` بقالب `templates/balislam/script.md`. يُقرأ بـ`parseScript` (`src/script/parse.ts`) ويُفحص بـ`checkForChannel` (`src/script/checkChannel.ts`).
   - **الأقسام اختيارية (D82، اعتمده صاحب المشروع ١١ نوفمبر (D83)):** السكريبت نص متصل؛ «## الفصل N» أو «## الفصل N · عنوان» تقسيم إنتاجي داخلي 0..N. بلا أي عنوان قسم يُقرأ النص قسمًا ضمنيًا واحدًا (رقمه 1، بلا عنوان) فتبقى المعرّفات `c1-sN`. لا يُشترط عدد الأقسام إلا بـ`script.fixedChapters = true` في `channel.json`، وعنوان القسم بيانات إنتاج لا تُنطق ولا تُترجم ولا تظهر على الشاشة إلا بـ`script.divisionTitlesOnScreen = true` (`src/script/divisions.ts`). القاعدة واحدة للقنوات الثلاث.
   - **الشورتس:** من `plan.shorts` (من مشهد إلى مشهد، `src/plan/shorts.ts`)، وفي الخطة القديمة بلا مقاطع شورت لكل قسم كما كان، وفي النص المتصل بلا مقاطع لا شورتس. **صاحب القناة يحدد المقاطع بنفسه (D83):** «٤ النشر ← الشورتس والريلز ← مقاطع الشورتس» (`app/src/tabs/ShortsPicker.tsx`): لكل شورت مشهد بداية ونهاية (ولو عبر الأقسام) وعنوان اختياري للنشر وحده، مع إضافة وحذف وترتيب ومدة تقريبية ونص المقطع؛ يُحفظ عبر `GET/PUT /api/episodes/<ep>/shorts` (`checkShortsInput` ثم `saveShortsSelection` في `src/plan/io.ts`) في `plan.shorts` وحدها بلا أثر على بصمة مشهد أو اعتماد. حتى ستة، والعنوان يمر على فحص الآثار. الاختيار مسموح قبل اعتماد النسخة الأساسية، والصناعة بعده وحده (القاعدة الرابعة).
2. **الخطة:** `generatePlan` (`src/plan/generate.ts`) تحوّل كل فقرة إلى مشهد:
   - القالب من علامة `[مشهد: …]` أو أسلوب الحلقة (`styleTemplate` في `src/plan/styles.ts`)، و`[آية: …]` بطاقة آية، و`[حديث: …]` بطاقة حديث.
   - الحقول الأولية من `defaultsFor` (`src/plan/generate.ts`)، ثم أدوات المحرك المختومة (`applyEngineDefaults` في `src/plan/engine.ts`)، ثم الإخراج الآلي للقوالب المصوَّرة (`directIllus` في `src/plan/illusDirect.ts`: المزاج يتبع قوس الحلقة، والمكان يتبدل، وحركة البطل من معنى الكلمات).
   - إن وُجدت خطة سابقة تُحفظ تعديلات صاحب القناة لكل مشهد ببصمة محتواه.
   - الكتابة والقراءة في `src/plan/io.ts` (`regeneratePlan`، `savePlan`، `loadPlan`).
3. **الفحص:** `planIssues` (`src/plan/validate.ts`): مكتبة القناة، والإضاءة، والانتقالات، والكاميرا، والحركة، ونصوص الآيات والأحاديث، والعناصر. الخطأ يمنع النسخة النهائية.
4. **الستوري بورد:** لقطة من الرندر الصامت لكل مشهد، واعتماده في `src/plan/storyboard.ts` (`approveStoryboard`).
5. **الصوت:** بعد اكتمال التوثيق والتشكيل (`src/voice/`)؛ والتلاوة من `src/quran/`.
6. **الرندر:** `renderEpisode` (`src/render/episode.ts`) يحزم المشروع (`src/render/bundle.ts`) ويرندر التكوين `episode-landscape` أو `episode-portrait` بالخطة والوسائط (`EpisodeMedia` في `src/plan/media.ts`). داخله:
   - `Episode` (`src/remotion/scenes/Episode.tsx`): الافتتاحية ثم المشاهد متتالية (`Series`)، ومدة كل مشهد من `sceneFrames` (`src/plan/duration.ts`: من الصوت إن وُجد وإلا من طول النص أو المدة اليدوية)، والانتقال الصالح عند كل حد.
   - `SceneFromPlan` (`src/remotion/scenes/components.tsx`) يختار مكوّن القالب ويمرر له حقول المشهد كما هي.
   - توقيت الكلمات من الصوت (`toFrames`) أو تقديرًا (`estimateTimings` في `src/remotion/scenes/timing.ts`)، وعليه تقع أحداث المشهد.
7. **المراجعة:** مراجعة كل مشهد بعد تنفيذه (`src/plan/sceneReview.ts`)، وقياس الحركة (`src/render/motionMeter.ts`).
8. **النسخة النهائية:** `assertMasterReady` (`src/render/episode.ts`) لا يسمح بها قبل اكتمال الشروط (الفحص، التوثيق، الصوت، التلاوة، الستوري بورد، مراجعة المشاهد). جودة master من `src/render/quality.ts`.
9. **النشر:** `packageEpisode` (`src/package/package.ts`)، وفحص الآثار `findTraces` (`src/package/traces.ts`)، وتنظيف البيانات الوصفية `cleanMetadata` (`src/render/episode.ts`).

## نظام القوالب والمشاهد

- **تعريف القالب بيانات:** `templateDefs` في `src/plan/templates.ts`: الاسم، والحقول التي يعرضها محرر المشهد (`FieldDef`: نص، قائمة، عنصر…)، والمدة الأساسية والدنيا. هذا ما يجعل الحقل ظاهرًا في الاستوديو.
- **انتماء القالب لقناة:** `templateMeta` في `src/plan/templateMeta.ts` (`alley-tale` و`road-journey` و`light-stage` لـ`balislam` وحدها)، والاستبعاد في `library.exclude`.
- **المكوّن:** ملف في `src/remotion/scenes/`، يُربط في `SceneFromPlan` (`src/remotion/scenes/components.tsx`). أغلب القوالب داخل الغلاف المشترك `SceneShell` (`src/remotion/scenes/SceneShell.tsx`: الخلفية والتلاشي والترجمة)، إلا لوح الدعاء.
- **قوالب «بالإسلام» المصوَّرة:** `AlleyTale` (`src/remotion/scenes/AlleyTale.tsx`)، `RoadJourney` (`src/remotion/scenes/RoadJourney.tsx`)، `LightStage` (`src/remotion/scenes/LightStage.tsx`)، و`DuaBoard` (`src/remotion/scenes/DuaBoard.tsx`). عالمها في `src/remotion/illus/`: الشخصية `Figure` (`src/remotion/illus/Figure.tsx`)، والأماكن، والعناصر، واللقطات المصمَّمة `SHOTS` (`src/remotion/illus/shots`).

## حقول خطة المشهد

`PlanScene` و`Plan` في `src/plan/types.ts`. حقول المشهد العامة: `template`، `narration` (من السكريبت ولا يُعدَّل في الخطة)، `props` (حقول القالب، نصوص كلها)، `durationSec`، `backdrop`، `overlays`، `sfx`، `tone`، `voice`، `ayahKey`، `edited`، `transition`. وفي الحلقة: `engineDefaults` (الأدوات المختومة عند الإنشاء).
حقول قوالب «بالإسلام» وأدوات المحرك مفصلة في [03-engine.md](03-engine.md).

## الملفات والمعاينات والإصدارات

- **المعاينات:** كل فيديو يُصنع لحلقة يُرفع إلى `previews/` في مجلدها بـ`npx bal -c balislam upload-preview <الحلقة> <الخانة> <الملف> --title … --note …` (`putEpisodePreview` في `src/render/episodePreviews.ts`، والفهرس `previews/index.json` برقم نسخة لكل خانة). خانة لكل موضوع: الرفع الجديد يحل محل القديم في العرض، والنسخ السابقة في سجل git.
- **العنوان يذكر الحالة الفنية** («جاهز للمراجعة · لم يُعتمد فنيًا» أو «معتمد»)، فالرفع ليس اعتمادًا.
- **ستوري بورد المختبرات (صور، ملحق الأمر 015):** صور التخطيط قبل الرندر تُحفظ في `storyboards/` بجوار `lab.json` بـ`npx bal -c balislam upload-storyboard <المختبر> <الخانة> <الصورة> --topic … --title … --note … --order …` (`addLabStoryboard` في `src/channel/labStoryboards.ts`، والفهرس `storyboards/index.json`). **بخلاف الفيديو تبقى كل النسخ** (‎<الخانة>-v<الرقم>.png‎) للمقارنة، ولكل نسخة رقمها وتاريخها واسم ملفها الأصلي وحالتها: «جاهز للمراجعة» عند الرفع دائمًا، و«معتمد فنيًا» أو «يحتاج تعديلًا» بقرار صاحب القناة الصريح وحده، بنصه واسمه (`decideLabStoryboard`، أو `npx bal -c balislam storyboard-decision <المختبر> <الخانة> <النسخة> approved|changes|review --by … --decision …`، أو زر القرار في الاستوديو مع نص إلزامي). «معتمد» بلا قرار مسجل يُعرض «جاهز للمراجعة» ويُبلَّغ عنه (`shownStatus` و`storyboardProblems` في `src/channel/labStoryboardsShared.ts`). مفعّل لبالإسلام وحدها (`LAB_STORYBOARD_CHANNELS`).
- **مخرجات الرندر** النهائية في مجلد الحلقة (`outDirFor` في `src/render/episode.ts`) ومعلومات جودتها (`renderInfoFile` في `src/render/quality.ts`). المؤقت في `renders/` (غير مرفوع).

## الاستوديو وعلاقته بالباك إند

- **الواجهة** `app/src/`: `App.tsx` والتبويبات في `app/src/tabs/`:
  - `EpisodeTab.tsx`: محرر المشهد، وحقول القالب من `templateDefs`، والفحص الحي `planIssues`.
  - `ScriptTab.tsx` و`StoryboardPanel.tsx` و`ReviewPanel.tsx` و`PublishTab.tsx`.
  - `ChannelTab.tsx` و`ChannelBrand.tsx`: إعدادات القناة، ولوحة «أدوات المحرك» (`EnginePanel`).
  - `GuideTab.tsx`: «مرجع الاستوديو» (هذا المرجع).
  - `LabsTab.tsx`: «مختبرات الإنتاج»؛ وفي «بالإسلام» قسم «ستوري بورد · صور» (`app/src/tabs/LabStoryboards.tsx`): الأحدث أولًا، والنسخ السابقة بأزرار، والمقارنة جنبًا إلى جنب، والتكبير (ملء الشاشة و100% و200% والأصل في تبويب جديد)، وزر القرار. ومعاينات الفيديو تحت «المعاينات · فيديو» كما هي.
- **الخادم** `app/server/api.ts` و`app/server/extra.ts`: يقرأ ويكتب ملفات القناة والحلقات مباشرة (لا قاعدة بيانات)، ويشغّل المهام الطويلة والرندر عبر `bin/bal.mjs` داخل طابور الاستوديو `studioPool` (`startRenderJob`، `startJob`). حفظ القناة يمر بفحص الشكل (ومنه `engineDefaultsIssues`).
- **الدليل:** `src/channel/guide.ts` يقرأ `docs/balislam/guide.json` وصفحاته فقط (للقراءة، ولا يقبل مسارًا خارجه).
- مصدر الحقيقة ملفات المستودع؛ الاستوديو يعرضها ويعدّلها، فلا نسختان مختلفتان.

## الاختبارات والتحقق والتسليم

التفصيل في [04-render-quality.md](04-render-quality.md#البوابات-والاختبارات) و[05-development.md](05-development.md).
