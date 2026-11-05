# ٣. المحرك البصري — ما بُني وحالته

كل ما بُني في الأوامر 005–011 مسجّل في `src/plan/engine.ts` (`ENGINE_FEATURES`)، وحالته ظاهرة في الاستوديو: **إدارة الاستوديو ← معلومات القناة ← أدوات المحرك** (`EnginePanel` في `app/src/tabs/ChannelBrand.tsx`).

## سجل أدوات المحرك

| المعرّف | الأداة | النوع | الحالة الآن | الاعتماد الفني |
| --- | --- | --- | --- | --- |
| `composed-camera` | الكاميرا المؤلَّفة والمشي الطبيعي في «الحارة» | أساس | متاحة؛ **تنتظر الاعتماد** لتصير افتراضية | لم تُعتمد |
| `natural-road` | المشي الطبيعي في «الطريق» | أساس | متاح؛ **ينتظر الاعتماد** | لم يُعتمد |
| `natural-stage` | المشي الطبيعي في «ظل ونور» | أساس | متاح؛ **ينتظر الاعتماد** | لم يُعتمد |
| `lighting` | الإضاءة والظلال والعمق | مؤثر | متاحة عند الحاجة، لا تُفرض | لم تُعتمد |
| `transitions` | الانتقالات بين المشاهد | مؤثر | متاحة عند الحاجة، لا تُفرض | لم تُعتمد |
| `render-queue` | طابور الرندر الآمن | بنية | مفعّل دائمًا | لا يحتاج اعتمادًا فنيًا |
| `gate` | بوابة التسليم | بنية | مفعّلة دائمًا | لا يحتاج اعتمادًا فنيًا |

**القواعد:**
- **الأساس** يصير افتراضيًا للحلقات الجديدة فقط بزر صاحب القناة («اعتمده افتراضيًا للحلقات الجديدة»)، فيُكتب معرّفه في `production.defaults` في `channels/balislam/channel.json`. عند إنشاء خطة جديدة تُختم القائمة في `engineDefaults` ويكتب `applyEngineDefaults` حقوله في المشاهد التي لا قيمة لها فيها (ولا يمس اللقطة المصمَّمة). الخطة القائمة تستعمل ختمها هي وحده، وغيابه = لا شيء.
- **المؤثر** لا يصير افتراضيًا أبدًا، و`engineDefaultsIssues` يرفضه.
- **العزل:** `channels: ["balislam"]` لكل أداة إخراجية؛ `engineEnabled` و`channelEngineFeatures` يحجبانها عن القنوات الأخرى (لا لوحة، ولا حقل انتقال، وحقل انتقال في خطة قناة أخرى خطأ لا يُطبَّق).
- الاختبار: `tests/engine-permanent.test.tsx`.

## أ. الشخصيات والحركة (الأوامر 006–007، والتوجيه الدائم)

**أين:** `src/remotion/illus/gait.ts` (دوال خالصة: رقم الإطار ← الحالة)، والشخصية `src/remotion/illus/Figure.tsx`.

| المكوّن | ما يفعله |
| --- | --- |
| `GAITS` و`GAIT_IDS` | أربع مشيات: `stroll`، `walk`، `brisk`، `heavy` (الإيقاع، طول الخطوة، الميل، التسارع والتباطؤ) |
| `locomote` | يدمج حركات (`Move`) والتفاتات (`Turn`): قدم ثابتة بلا انزلاق، وتسارع وتباطؤ، واستعداد قبل الانطلاق، ونابضا الجذع والثوب، والتفاتة تلقائية قبل حركة معاكسة |
| `locoPose` و`gaitPose` | وضعية المشي من الحالة (الساقان من هندسة الخطوة، والذراعان بتأخر) |
| `poseAtNatural` | انتقال طبيعي بين الوضعيات (مدة بحجم التغيير، والرأس والذراعان يتأخران) |
| `characterAt` | واجهة واحدة للقوالب: الحالة والوضعية معًا، ومنها سرعة يفرضها القالب (`velocity`) لـ«الطريق» |
| `fitDistance` و`fitFrames` | المسافة التي تتسع لها مدة، والمدة التي تحتاجها مسافة (لا يسرع البطل فوق مشيته) |
| `withCarry` | استمرار الحركة عبر حد المشهد (`flyIn`، `flyOut`): يخرج ماشيًا ويدخل التالي بالسرعة نفسها |
| `Figure` (`facing`، `view`، `sway`) | الالتفاتة دوران للجسد (جانبي ← أمامي ← جانبي معاكس) بدل انقلاب أو تضييق، والثوب يتابع |

**في القوالب:**

| القالب | الحقل | القيم | الافتراضي الآن |
| --- | --- | --- | --- |
| «الحارة» | `cameraMode = composed` يفعّل المشي الطبيعي للبطل وحده، ومعه `gait` و`poseTimeline` | المشيات الأربع؛ و`رقم_الإطار \| الوضعية` لكل سطر | القديم (`cameraMode` فارغ) |
| «الطريق» | `motion`، `gait` | `legacy` أو `natural`؛ المشية (الافتراضية `stroll`) | `legacy` |
| «ظل ونور» | `motion`، `gait` | `legacy` أو `natural`؛ المشية (الافتراضية `walk`) | `legacy` |

**الاختبارات:** `tests/character-motion.test.ts`، `tests/figure-view.test.ts`، `tests/engine-permanent.test.tsx` («ظل ونور»)، `tests/transitions.test.tsx` (`withCarry`).
**القيود:** المشي الطبيعي في «الحارة» للبطل وحده الواقف (لا مع من أمامه ولا الشاهدين ولا الجالس). في «ظل ونور» تُقصَّر الخطوة إن قصر السطر عن المسافة. استمرار الحركة يطابق السرعة والاتجاه لا طور الخطوة.

## ب. الكاميرا (الأوامر 005–006)

**أين:** `src/plan/director.ts` (`CAMERA_MODES`، `parseCameraPlan`، `parseCameraPlanLines`، `autoCameraPlan`، `shotZoom`)، والتنفيذ في `src/remotion/scenes/AlleyTale.tsx` (`composedCamera`، `frameOn`، `shotFrame`، `pillInView`).

| `cameraMode` في «الحارة» | السلوك |
| --- | --- |
| فارغ أو `automatic` | القديم: تأطير آلي مع كل سطر، وحقل `camera` (`push`، `track`، `rise`، `drift`، `still`) |
| `directed` | إخراج يدوي: حركة `camera` وحدها، بلا قطع آلي ولا إيماءات حشو |
| `composed` | الكاميرا المؤلَّفة: حركة أو حركتان على كلمات المعنى (`autoCameraPlan`) بانتقال طويل هادئ، أو خطة يكتبها المخرج في `cameraPlan` (و`cameraPlanPortrait` للعمودي). في جملة فيها ذكر الله: سكون |

صيغة `cameraPlan`: «ثابت» وحدها، أو سطر لكل حركة `الكلمة[+/-إطارات] أو رقم الإطار | wide أو medium أو close [hero أو pair أو door أو board أو center] [مدة 12–300]`. النص نفسه في مساعدة الحقل (`templateDefs`).
**التأطير:** `frameOn` يبقي الإطار داخل العالم، والعمودي يرى 608 وحدات من العرض والهدف في منتصفه، والكلمة تبقى داخل الإطار (`pillInView`).
**الاختبارات:** `tests/camera-composed.test.ts`، `src/plan/director.test.ts`، `tests/illus-direction.test.ts`.
**القيود:** الكاميرا المؤلَّفة لـ«الحارة» وحدها؛ «الطريق» و«ظل ونور» بكاميرتيهما. في العمودي حين يقف شخص أمام البطل يُقص أحدهما على الحافة (في القديم والمؤلَّف معًا). اللقطة المصمَّمة (`shot`) لها كاميرتها.

## ج. الإضاءة والظلال والعمق (الأمران 008–009)

**أين:** الصيغة والفحص في `src/plan/lighting.ts` (`parseLighting`، `lightAt`، `LIGHT_PRESETS`، `LIGHTING_SUPPORT`، `lightingIssues`، `lightingHelp`)، والرسم في `src/remotion/illus/light.tsx` (`LitFigure`، `SceneFigure`، `WorldLight`، `DepthLayer`، `ForegroundFrame`، `shadowGeometry`، `BALISLAM_LIGHT`).

- **الحقل:** `lighting` (نص متعدد الأسطر). فارغ = كما هو.
- **إعداد جاهز** ثم أسطر تعدّله: `night-lamp`، `dawn-sun`، `day-sun`، `interior-lamp`، `interior-window`؛ و`key lamp|sun x y` (أو `key off`)، و`intensity`، و`ambient`، و`warmth`، و`back`، و`shadow soft|hard|off [طول]`، و`depth dof … fog … parallax … fg`، و`fade من إلى الكلمة [مدة]`، و`move x y الكلمة [مدة]`.
- **الدعم (`LIGHTING_SUPPORT`):** «الحارة» كل الخصائص؛ «الطريق» كلها عدا `depth fg` (طبقة المقدمة لمكان مغلق). «ظل ونور» لا يقرأ الحقل، فإضاءته هي أسلوبه، والفحص يرفض الحقل فيه. اللقطة المصمَّمة لا تقرأه أيضًا.
- **الشخصيات الثانوية:** `SceneFigure` تُضاء مثل البطل حين يوجد إعداد، ولا تتغير بدونه.
- **الاختبارات:** `tests/lighting.test.ts`، `tests/lighting-support.test.ts` (كل خاصية مقبولة لها أثر مرئي فعلًا).
- **القيود:** التكلفة أعلى مع العمق (`depth dof`)؛ قِسها عند إضافة طبقات.

## د. الانتقالات والتحولات (الأمر 011)

**أين:** الصيغة والفحص في `src/plan/transitions.ts` (`parseTransition`، `transitionIssues`، `easeOf`، `sacredScene`، `carryReady`، `NO_TRANSITION_TEMPLATES`، `TRANSITION_HELP`)، والرسم في `src/remotion/scenes/transitions.tsx` (`TransitionIn`، `FrozenScene`، `TransitionContext`، `shapePath`)، والربط عند حدود المشاهد في `src/remotion/scenes/Episode.tsx` (`activeTransition`).

- **الحقل:** `transition` في المشهد: كيف **يدخل** من الذي قبله. فارغ = التلاشي القصير القديم.
- **الأنواع:** `cut`، `fade`، `push left|right|up|down`، `zoom in|out [x y]`، `mask arch|circle|wipe`، `through xA yA [xB yB]` (عنصر مشترك)، `morph شكل شكل [x y]` (`circle`، `arch`، `square`، `star`)، `light [x y]`، `carry left|right` (استمرار المشي). ثم `dur` (6–60 إطارًا) و`ease` (`linear`، `in`، `out`، `inout`، `spring`). النقاط نسبية للإطار فتصلح للاتجاهين.
- **التنفيذ:** المشهد الخارج يُرسم مجمّدًا على آخر إطار له تحت أول إطارات الداخل، بلا تداخل في الخط الزمني (المدد والصوت لا تتغير)، وطبقته تُحذف فور انتهاء الانتقال. الألوان من ثيم الحلقة.
- **يُرفض:** على أول مشهد في الفصل؛ مع لوح الدعاء في أي طرف؛ غير القطع والمزج قبل الآية وذكر الله أو بعدهما؛ غير القطع واستمرار الحركة بين مشهدين من «الحارة» في المكان نفسه؛ `carry` إن لم يكن الطرفان «حارة» مؤلَّفة ببطل وحده واقف.
- **التكلفة:** داخل نافذة الانتقال يُرسم المشهدان (نحو +45% لكل إطار في «العنصر المشترك»)، وخارجها لا شيء؛ على فيديو فيه سبعة انتقالات نحو +3%.
- **الاختبارات:** `tests/transitions.test.tsx`.
- **القيود:** الانتقال بين لقطات المشهد الواحد على الكاميرا المؤلَّفة القائمة. نقطة العنصر المشترك تُكتب بالإحداثيات.

## المختبرات

تكوينات بلا صوت لا تُنشر، معايناتها في `channels/balislam/episodes/900-engine-lab/previews/` (فهرسها في `channels/balislam/episodes/900-engine-lab/README.md`):
`src/remotion/lab/BalislamLab.tsx` (الكاميرا)، `src/remotion/lab/MotionLab007.tsx` (الحركة)، `src/remotion/lab/LightLab.tsx` (الإضاءة)، `src/remotion/lab/TransitionLab.tsx` (الانتقالات)، `src/remotion/lab/PermanentLab.tsx` (الحلقة الجديدة بأدوات المحرك، و«الطريق» و«ظل ونور»).
