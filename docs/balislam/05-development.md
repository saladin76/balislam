# ٥. دليل التطوير — خطوات عملية

## ١. ما يُقرأ أولًا

`AGENTS.md` ← `CLAUDE.md` ← [00-start-here.md](00-start-here.md) ← [01-constants.md](01-constants.md) ← الصفحة التي تخص مهمتك ← آخر إدخالات [06-decisions.md](06-decisions.md).

## ٢. التعرف على البنية

```bash
npx bal -c balislam list               # الحلقات
npx bal -c balislam check 001          # فحص السكريبت
npx bal -c balislam scenes-review 001  # حالة مراجعة المشاهد
npm run app                            # الاستوديو، ثم «إدارة الاستوديو ← مرجع الاستوديو»
```

ابدأ من `src/remotion/scenes/Episode.tsx` (الحلقة)، ثم `SceneFromPlan` في `src/remotion/scenes/components.tsx` (اختيار القالب)، ثم القالب نفسه، ثم `templateDefs` في `src/plan/templates.ts` (حقوله في المحرر) و`planIssues` في `src/plan/validate.ts` (فحصه). الخريطة كاملة في [02-architecture.md](02-architecture.md).

## ٣. إضافة خاصية جديدة

1. **اختيارية دائمًا:** حقل جديد في `props` (أو في المشهد)، وغيابه = السلوك القديم **حرفيًا**. لا تغيّر قيمة افتراضية قائمة.
2. **المنطق في طبقة مشتركة** (`src/remotion/illus/`، `src/plan/`) لا في قالب واحد، إن كانت تصلح لأكثر من قالب.
3. **الفحص:** كل قيمة لا ينفذها المحرك تُرفض في `planIssues` برسالة عربية واضحة، وما يرفضه الفحص لا يُطبَّق في الرندر.
4. **الحقل في المحرر:** أضفه إلى `fields` في `templateDefs` بمساعدة تشرح الصيغة، فلا يُضبط شيء بتعديل JSON وحده.
5. **العزل:** إن كان الكود مشتركًا بين القنوات، سجّل الأداة في `ENGINE_FEATURES` (`src/plan/engine.ts`) بـ`channels: ["balislam"]` واحجبها بـ`engineEnabled` حيث يلزم.
6. **السجل:** أداة إخراجية جديدة تُسجّل في `ENGINE_FEATURES` بنوعها (`base` أو `effect` أو `infra`) ومكان التحكم وحدودها، فتظهر حالتها في «أدوات المحرك». الأساس لا يصير افتراضيًا إلا بقرار صاحب القناة.
7. **الاختبار والرندر والمعاينة** (الأقسام ٦–٨)، ثم **المرجع** (القسم ٩).

## ٤. إضافة قالب أو تعديل قالب قائم

- **قالب جديد:** مكوّن في `src/remotion/scenes/`، ويُربط في `SceneFromPlan` (`src/remotion/scenes/components.tsx`)، ويُعرَّف في `templateDefs` (`src/plan/templates.ts`: الحقول والمدة)، ويُنسب للقناة في `templateMeta` (`src/plan/templateMeta.ts`)، ونموذج معاينته في `src/remotion/scenes/channelSamples.ts`. استعمل `SceneShell` (`src/remotion/scenes/SceneShell.tsx`) إن أمكن (به تعمل الانتقالات وتلاشي الدخول والخروج). يُقاس بقياس الحركة قبل اعتماده.
- **تعديل قالب قائم:** لا تغيّر رسم المشاهد القديمة. التحسين يدخل خلف حقل اختياري (مثال: `motion = natural` في `src/remotion/scenes/LightStage.tsx`)، وتثبت مطابقة القديم بالاختبار (رسم الإطار بلا الحقل ومع القيمة القديمة متطابقان) وبالرندر (القسم ٨).
- **العناصر والرسمات:** من مكتبة القناة فقط، وبهوية القناة (`brand/elements/GUIDE.md`)، ولا عنصر لا يطابق الكلمة (القاعدة الثالثة في `CLAUDE.md`).

## ٥. إضافة حقل إلى خطة المشهد

| المكان | ما يُفعل |
| --- | --- |
| `src/plan/types.ts` | حقل اختياري في `PlanScene` (إن كان على المشهد لا في `props`) |
| `src/plan/generate.ts` | يُحفظ عند إعادة التوليد إن كان من تعديل صاحب القناة |
| `src/plan/sceneReview.ts` | يدخل `sceneHash` **فقط حين يوجد**، فلا تتغير بصمات المراجعات القائمة |
| `src/plan/validate.ts` | فحص القيم |
| `src/plan/templates.ts` أو `app/src/tabs/EpisodeTab.tsx` | الحقل في المحرر |
| القالب | قراءة الحقل وتطبيقه |

## ٦. كتابة الاختبارات

- في `tests/`، بـVitest. للمكونات: `renderToStaticMarkup` مع محاكاة `useCurrentFrame` و`useVideoConfig` (نموذج في `tests/lighting-support.test.ts` و`tests/engine-permanent.test.tsx`).
- غطِّ دائمًا: (١) غياب الحقل = الرسم القديم حرفيًا، (٢) للحقل أثر مرئي فعلًا، (٣) الفحص يرفض القيم المجهولة، (٤) الحلقة 001 لا تتغير بإعادة التوليد، (٥) القنوات الأخرى لا تتأثر.
- الاختبارات التي تشغّل عمليات حقيقية تُعزل عن حالة الجهاز (مثال: `foreign: () => []` في `tests/render-pool.test.ts`).
- لا يُعطَّل اختبار ولا يُستثنى لتمرير تسليم.

## ٧. المعاينة والرندر التجريبي

```bash
export REMOTION_BROWSER_EXECUTABLE=<مسار المتصفح>   # إن لم يكن للجهاز إنترنت
npx bal -c balislam render-batch lab-transitions-landscape --out renders/test          # عبر الطابور الآمن
npx bal -c balislam render-batch <تكوين> --out renders/test --frames 0-299             # نطاق للقياس السريع
npx remotion still src/remotion/index.ts <تكوين> out.png --frame=120 --scale=0.5        # لقطة واحدة للفحص
```

- التكوينات في `src/remotion/Root.tsx`؛ المختبر الجديد يُضاف إلى `src/remotion/lab/` ويُسجَّل هناك.
- بعد كل رندر: افحص لقطات عند كل كلمة مرسومة وبينها (القاعدة السادسة في `CLAUDE.md`) قبل عرضه، ثم ارفعه إلى الاستوديو (`upload-preview`) بعنوان يذكر حالته، وحدّث فهرس المختبر في `channels/balislam/episodes/900-engine-lab/README.md`.
- الستوري بورد (صور) قبل الرندر يُحفظ في المختبر نفسه بـ`upload-storyboard` (نسخة جديدة لكل تعديل، والسابقة باقية)، وقرار صاحب القناة يُسجَّل بـ`storyboard-decision` بنصه، لا قبله.

## ٨. التحقق من التوافق مع الإنتاج السابق

1. **بالاختبار:** خطة 001 تُولَّد مرة بالكود الجديد وتُقارن بالتوليد القديم (`tests/engine-permanent.test.tsx`)؛ ورسم الإطارات بلا الحقل الجديد يطابق القديم.
2. **بالرندر:** نسخة من الـcommit السابق في مجلد منفصل، ثم رندر الإطارات نفسها من الخطة نفسها في النسختين، ثم المقارنة:

```bash
git worktree add --detach /tmp/oldwt HEAD && ln -s "$PWD/node_modules" /tmp/oldwt/node_modules
python3 -c "import json;json.dump({'plan':json.load(open('channels/balislam/episodes/001-know-the-truth/plan.json')),'orientation':'landscape'},open('/tmp/p.json','w'))"
(cd /tmp/oldwt && npx remotion render src/remotion/index.ts episode-landscape /tmp/old.mp4 --props=/tmp/p.json --frames=0-2399)
npx remotion render src/remotion/index.ts episode-landscape /tmp/new.mp4 --props=/tmp/p.json --frames=0-2399
ffmpeg -i /tmp/old.mp4 -i /tmp/new.mp4 -lavfi psnr -f null -      # أو framemd5 لكل إطار
git worktree remove --force /tmp/oldwt
```

3. **التفسير:** التطابق بالبت هو الأصل. لكن رندر بعض اللقطات المصمَّمة غير حتمي، فإن ظهرت فروق أعد رندر **الكود القديم نفسه** مرة ثانية وقارنه بنفسه: إن كانت فروق القديم مع الجديد من مستوى ضجيج القديم مع نفسه (PSNR ≥ 50 dB، غير مرئية) فلا تغيير؛ وإلا فهناك تغيير حقيقي يجب تفسيره أو إصلاحه.

## ٩. تحديث المرجع

**متى:** كل تغيير يؤثر في السلوك أو البنية أو القواعد أو طريقة التشغيل أو حالة أداة.

| التغيير | الصفحة |
| --- | --- |
| أداة محرك أو حقل قالب أو صيغته | [03-engine.md](03-engine.md)، و`ENGINE_FEATURES` |
| مسار الحلقة، مجلد، واجهة، خادم | [02-architecture.md](02-architecture.md) |
| الرندر والجودة والطابور والبوابات والأعطال المعروفة | [04-render-quality.md](04-render-quality.md) |
| قاعدة أو ثابت أو درجته | [01-constants.md](01-constants.md) (بقرار صاحب القناة فقط) |
| حالة الحلقات والأدوات والاعتماد | «آخر حالة» في [README.md](README.md) |
| كل ما سبق | إدخال في [06-decisions.md](06-decisions.md) |

**كيف يُفرض:**
- **البوابة:** `scripts/docs-sync.mjs` يرفض الدفع إن تغيّرت ملفات منظومة «بالإسلام» (قائمة `watch` لـ`balislam` في `DOC_RULES`) دون تغيير `docs/balislam/06-decisions.md` في الدفع نفسه.
- **تغيير لا يمس السلوك** (تعليق، إعادة تسمية داخلية، تنسيق): يُعفى بسطر في رسالة الـcommit نفسه:
  `Docs-Unaffected: <سبب قصير>`
  الإعفاء لـ«بالإسلام» وحدها، ويُقبل فقط إن كان في كل commit يمس ملفات منظومتها في الدفع. لا يُستعمل لتغيير سلوك.
- **الاختبار** `tests/balislam-reference.test.ts`: الفهرس يطابق الملفات؛ الروابط والمسارات المذكورة موجودة؛ كل دالة أو ثابت يُذكر بجوار ملف موجود فيه فعلًا؛ كل أداة في `ENGINE_FEATURES` موثقة في [03-engine.md](03-engine.md)؛ كل حقل يكتبه أساس مذكور؛ لا أسرار؛ `AGENTS.md` يدل على المرجع.
- إذا غيّرت ملفًا رئيسيًا في المنظومة غير مراقَب بعد، أضفه إلى `watch`.

## ١٠. التسليم بأمان

1. `npx tsc --noEmit -p .` و`npx vitest run` ناجحان (برموز خروجهما، لا عبر `grep`).
2. الرندر الحقيقي فُحص، والمعاينة مرفوعة إلى الاستوديو بحالتها.
3. المرجع وسجل القرارات محدّثان.
4. commit برسالة تذكر الأمر والتغيير، ثم `git fetch && git rebase origin/main` ثم `git push origin HEAD:main`: البوابة تفحص الـcommit المدفوع نفسه. إن رفضت، أصلح السبب ولا تتجاوزها.
5. إن كان الفشل من تغيير غيرك على main (حدث في الأمر 011)، أصلحه في commit مستقل يوضح مصدره.
