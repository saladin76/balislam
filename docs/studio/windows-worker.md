# جهاز الرندر الثاني (ويندوز) للشورتس — D226

> جهاز ويندوز («Salah»، 8 جيجا) يرندر شورتس القنوات الثلاث (`balislam` و`dafatir-alzaman` و`zubdat-alkutub`) واحدًا بعد واحد. **الماك وحده مصدر الحقيقة:** يرسل المهام، ويتحقق من كل ما يعود قبل أن يستعمله. العامل لا يدفع شيئًا، ولا يعتمد شيئًا، ولا يكتب على أي remote، ولا `.env` ولا مفتاح توقيع ولا سجل اعتماد عنده. الكود في `src/render/worker/`.

## كيف يعمل

```
الماك (worker-submit)                المجلد المشترك render-queue/                 ويندوز (bal worker)
بعد اعتماد Master بعينه      ──►    jobs/<id>.json                       ──►   نقل ذري إلى running/<id>.json
لقطة الوسائط ببصمتها         ──►    media/<القناة>/<الحلقة>/<البصمة>/          git checkout --detach <commit المهمة>
                                                                              npm ci (إن تغيّر package-lock.json وحده)
                                     done/<id>/  (mp4 + result.json + job.json) ◄── رندر portrait بجودة master
                                     failed/<id>/ (error.json + آخر السجل)      ◄── أو السبب
الماك (worker-collect) يتحقق ثم يستورد إلى out/package/
```

- **المهمة** (`render-queue/jobs/<id>.json`): القناة، ومجلد الحلقة، ورقم الشورت، ومقطعه (`sceneIds` أو `chapter`)، وعنوانه، و**commit الماك بالضبط**، والجودة `master`، ومسار لقطة الوسائط، والمتوقَّع (المدة، 2160×3840)، والخطة كاملة ببصمتها، ووصف الوسائط، وربح علوّ التعليق. تُفحص فحصًا صارمًا: لا نوع إلا `short`، ولا حقل مجهول، ولا مسار مطلق ولا `..` ولا شرطة خلفية.
- **النتيجة** (`done/<id>/result.json`): `id` و`sha256` و`bytes` و`durationSec` و`width` و`height` و`commit` و`worker` و`startedAt` و`finishedAt` و`logTail`.
- **رندر واحد في كل وقت:** `render-queue/worker.lock` (الجهاز ورقم العملية)، ويُعدّ متروكًا بعد ٦ ساعات.
- **ناتج العامل غير موثوق** حتى يتحقق منه الماك: العامل لا يفحص بوابات الماك (لا سجل عنده)، والماك فحصها قبل الإرسال ويفحص الناتج بعد عودته.

## على جهاز ويندوز (مرة واحدة)

المستودع منسوخ في `C:\bal-render` و`npm ci` تم. ثم في نافذة «Command Prompt»:

```bat
winget install --id Gyan.FFmpeg -e
git config --global core.longpaths true
```

أغلق النافذة وافتح غيرها (ليصل `ffmpeg` و`ffprobe` إلى PATH)، وتحقق: `ffprobe -version`.

- **لا `.env`** في `C:\bal-render`، ولا مفاتيح أي خدمة. لا تعدّل ملفًا في هذه النسخة: العامل يرفض الرندر على نسخة فيها تعديلات.
- **المجلد المشترك:** مجلد على هذا الجهاز (مثلًا `D:\bal-share`) مشارَك باسم `bal-share` (خصائص المجلد ← Sharing ← Advanced Sharing، وصلاحية القراءة والكتابة لحساب الماك). يمكن تشغيل العامل بالمسار المحلي `D:\bal-share` أو بالمسار الشبكي `\\Salah\bal-share`؛ المحلي أسرع.

### التشغيل يدويًا

```bat
cd C:\bal-render && npx bal worker --share \\Salah\bal-share
```

مهمة واحدة ثم خروج (للتجربة): أضف `--once`.

### التشغيل التلقائي عند الدخول (Task Scheduler)

من «Command Prompt» بصلاحية المسؤول (Run as administrator؛ إنشاء مهمة ONLOGON يحتاجها، والمهمة نفسها تعمل بصلاحية عادية `/RL LIMITED`):

```bat
schtasks /Create /F /TN "bal-render-worker" /SC ONLOGON /RL LIMITED /TR "cmd /c cd /d C:\bal-render && npx bal worker --share \\Salah\bal-share >> C:\bal-render\worker.log 2>&1"
```

- علامتا التنصيص حول قيمة `/TR` تحميان `&&` و`>>` و`2>&1` في سطر الأوامر، فتصل كما هي إلى المهمة، ثم ينفذها `cmd /c` عند كل دخول. طول القيمة أقل من حد ٢٦١ حرفًا.
- السجل في `C:\bal-render\worker.log`. للإيقاف: `schtasks /End /TN "bal-render-worker"`، وللحذف: `schtasks /Delete /TN "bal-render-worker" /F`، وللتشغيل الآن: `schtasks /Run /TN "bal-render-worker"`.

### الإعداد الفعلي (٢٦ نوفمبر)

- المجلد المشترك `F:\bal-share` (مشارك باسم `bal-share`، بحساب مخصص للمشاركة فقط)، والعامل يعمل بالمسار المحلي:

```bat
schtasks /Create /F /TN "bal-render-worker" /SC ONLOGON /RL LIMITED /TR "cmd /c cd /d C:\bal-render && npx bal worker --share F:\bal-share >> C:\bal-render\worker.log 2>&1"
```

- النسخة على ويندوز خفيفة (`--depth 1`)، والعامل يجلب commit المهمة بنفسه قبل checkout.
- أول تجربة: الشورت ١ من «دفاتر الزمن» 001 في ١٨ دقيقة. اجتاز تحقق الماك كله (البصمة، والصيغة، والمدة، والأثر، والحركة)، ورُفض الاستيراد فقط لأن شورت الماك موجود بالاسم نفسه. وطابق شورت الماك: الصوت نفسه (−14.1 LUFS)، والصورة نفسها بعد إزالة حبيبات الورق (PSNR ≈ 40 dB). الملف أكبر (٣٨ ميجابت/ث مقابل ١١)، لأن حبيبات الورق تخرج بنمط مختلف.

## على الماك

**إعادة التوصيل آليًا:** مهمة launchd `com.bal.share-mount` (`~/Library/LaunchAgents/`) تشغّل `.handoff/scratchpad-25nov/share-mount.sh` عند الدخول وكل ٥ دقائق. إن لم يكن `/Volumes/bal-share` موصولًا، والجهاز ظاهرًا على الشبكة، وكلمة السر محفوظة في Keychain، يوصله بـ `mount volume "smb://balshare@192.168.1.129/bal-share"` بلا نافذة. السجل في `share-mount.log` بجواره. يحتاج: عنوانًا ثابتًا للويندوز من الراوتر (DHCP reservation)، وحفظ كلمة السر مرة في Keychain (Connect to Server مع «Remember this password in my keychain»).


اربط المجلد المشترك مرة (Finder ← Go ← Connect to Server ← `smb://Salah/bal-share`)، فيظهر في `/Volumes/bal-share`. ثم:

```bash
# بعد «اعتمد النسخة النهائية» في الاستوديو: كل الشورتس، أو واحد برقمه
npx bal -c balislam worker-submit 001 --shorts --share /Volumes/bal-share
npx bal -c balislam worker-submit 001 --short 2 --share /Volumes/bal-share

# بعد انتهاء العامل: الاستلام بعد التحقق
npx bal -c balislam worker-collect 001 --share /Volumes/bal-share
```

- **الإرسال يرفض** إن لم يُعتمد Master بعينه، أو كانت النسخة النهائية بلا صوت كامل، أو اختلفت ملفات الحلقة أو الكود عن آخر commit (أرشيف `versions/` المحلي مستثنى لأن الرندر لا يقرؤه)، أو لم يصل الـcommit إلى GitHub بعد (العامل يجلبه من هناك). المهمة نفسها لا تُرسل مرتين؛ والفاشلة تُعاد بالإرسال من جديد.
- **الاستلام لا يستورد إلا ما طابق:** بصمة الفيديو، وh264 بـ2160×3840 وصوت AAC، والمدة ±0.1 ث من المتوقَّع، والمهمة كما أرسلها هذا الماك (الـcommit والخطة والوسائط والمقطع والعنوان) والحلقة لم تتغير بعدها، وبيانات وصفية بلا أثر لأدوات الإنتاج؛ ثم ينظّف البيانات الوصفية على الماك (`cleanMetadata`) ويقيس الحركة (≥ 80%، والسكون المقصود مستثنى). بعدها يكتب `<id>-short-<n>.mp4` وترجمته في `out/package/`، ويحدّث `motion-report.md`، ويسجّل في `worker-collected.json`. كل رفض برسالة عربية، والمرفوض لا يدخل الحزمة. لا يُكتب فوق شورت آخر بالاسم نفسه إلا بـ`--replace` (ينقل القديم إلى `superseded/`).
- بعد الاستلام: يشاهد المالك كل شورت كاملًا قبل النشر اليدوي، كأي شورت من الماك.

## D232: كل الرندر على الويندوز (سارٍ، اعتمده المالك ٢٧ نوفمبر؛ المرحلة ١)

- **مهمة الإصدار 2** (`version: 2`) لكل الأنواع: `scene` و`assembly` و`prefinal` و`master` و`short` و`trial` (`thumbnail` محجوز). فيها: `kind`، و`purpose` (`studio` أو `trial`)، و`render` (الاتجاه، الجودة، النطاق `all`/`chapter`/`sceneIds`، قطعة مراجعة أم لا، وضع التوقيت، علامات المسودة، و`review1080` لـ4K، و`concurrency` للتجارب وحدها) أو `join` (قطع المشاهد: `sceneId` ومعرّف مهمتها في `done/` وبصمتها اختياريًا)، و`expected` (الأبعاد من الجودة والاتجاه، والمدة)، والخطة ببصمتها، ولقطة الوسائط، وربح العلوّ. الإصدار 1 (الشورت) يبقى كما هو.
- **العامل القديم لا يأخذ مهام الإصدار 2:** حلقته تفحص المهمة كاملة بكودها قبل checkout فتتجاوزها (تبقى في `jobs/`). الحلقة الجديدة تقرأ الغلاف وحده ثم تفحص كاملًا في العملية الفرعية بكود commit المهمة، فلا تحتاج إعادة تشغيل لنوع جديد بعد ذلك. **مرة واحدة** لتشغيل الحلقة الجديدة (في «Command Prompt» على ويندوز):

```bat
schtasks /End /TN "bal-render-worker"
cd /d C:\bal-render
git fetch --depth=50 origin feat/d232-windows-render-all
git checkout --detach FETCH_HEAD
schtasks /Run /TN "bal-render-worker"
```

  (بعد دمج D232 في `main`: `git fetch --depth=50 origin main` و`git checkout --detach FETCH_HEAD` بدل الفرع.) القفل `package-lock.json` لم يتغير، فلا `npm ci`.
- **النبض والتقدم:** `render-queue/worker.heartbeat.json` كل ٢٠ ثانية (`idle` أو `busy` بالمهمة والـcommit)، و`running/<id>.progress.json` (النسبة والمرحلة، يُحدَّث كل ٣–١٠ ثوانٍ). على الماك: `npx bal worker-status --share /Volumes/bal-share`.
- **النتيجة** تزيد `timings` (البدء، انتهاء تجميع Remotion، انتهاء الرندر، الانتهاء، والمراحل) و`machine` (المعالجات والذاكرة) و`memory.minFreeMB`، و`review` لنسخة 1080p بجوار ملف 4K.
- **التجربة** (لا تدخل الحزمة ولا السجل):

```bash
npx bal -c dafatir-alzaman worker-trial 001 --share /Volumes/bal-share --tag dafatir-001 --out <مجلد على الماك>
npx bal worker-trial-collect --share /Volumes/bal-share --out <المجلد نفسه>
```

- **تجارب التسريع** (كل خيار وحده، للتجارب وحدها؛ الإنتاج بلا تغيير): `--x264-preset medium` (Master 4K بـ«medium» والـcrf نفسه)، و`--shared-bundle` (حزمة Remotion واحدة لكل مشاهد الحلقة على العامل، `renders/bundle-cache/`)، و`--chunk-frames 1800` (Master على قطع دقيقة دقيقة في `out/worker/<المهمة>.chunks/`؛ إن انقطع العامل أعد الأمر نفسه فيستأنف من آخر قطعة تامة). كل خيار يغيّر معرّف المهمة، فلا تختلط نتائجه بالأساس.

- **شرط المحرر (D234):** لا تُرسل مهمة (مشهد أو وصل أو Master أو تجربة) لسكريبت لم يمرّ بمحرر المحتوى، والعامل يفحص سجل المحرر ثانية بـcommit المهمة قبل الرندر أو الوصل.
- **الماك احتياطي للطوارئ وحدها، وبإذن المالك كل مرة:** بلا إذن يرفض الماك كل رندر فيديو برسالة «D232: الماك لا يرندر…». بعد أن يأذن المالك بنفسه لهذه المرة:

```bash
npx bal mac-render-permit --owner-words "<نص إذن المالك>"   # مرة واحدة خلال ٦٠ دقيقة؛ --uses N و--minutes M و--episode NNN
npx bal mac-render-permit --status
npx bal mac-render-permit --revoke
```

## مخاطر معروفة

- **متصفح الرندر:** Remotion ينزّل Chrome Headless Shell عند أول رندر على ويندوز (يحتاج إنترنت مرة واحدة). عند تعذّره: `REMOTION_BROWSER_EXECUTABLE` بمسار Chrome موجود في بيئة المهمة.
- **الذاكرة:** 4K بتبويب واحد (D224)؛ على 8 جيجا أغلق البرامج الثقيلة أثناء الرندر. الشورت الواحد قد يأخذ وقتًا طويلًا.
- **ffmpeg النظام:** يستعمله ضبط العلو (−14 LUFS) وffprobe؛ إصدار winget قد يختلف عن ماك، والماك يتحقق من الناتج على أي حال.
- **طول المسارات:** المسارات تحت `C:\bal-render` قصيرة؛ `core.longpaths` يحمي من مسارات `node_modules` الطويلة.
- **الانقطاع:** إن انقطع المجلد المشترك أو أُعيد تشغيل الجهاز أثناء الرندر، يكتب العامل عند تشغيله التالي تلك المهمة في `failed/` («انقطع العامل»)، ويُعاد إرسالها من الماك.
