# Studio — بوابات جاهزية النشر المحلية

هذا تطوير مستقل على فرع feat/studio-release-readiness-dashboard فوق PR #47. لا يستعمل Vercel، ولا يغيّر main أو Studio الأساسي.

## ما الذي تغير
- واجهة /api/overview و/api/ops تقرأ أدلة الستوري بورد ومراجعة المشاهد ببصماتها الفعلية، توثيق المصادر، ملفات صوت متطابقة وموجودة، نصوص الآيات الناقصة، بيانات Master، حزمة النشر، اعتماد المالك وقائمة المراجعة.
- غرفة العمليات تُظهر الموانع لكل قناة، وتجعل أي حلقة مجدولة غير معتمدة ظاهرة على أنها مخاطرة.
- قائمة الحلقات لا تصنف حلقة جاهزة لمجرد وجود MP4 أو معاينة صامتة.
- صفحة النشر تشترط إغلاق الموانع قبل الاعتماد أو تسجيل النشر. خادم localhost يرفض PUT status الجديد المخالف برمز 409. إلغاء اعتماد أو تراجع عن نشر سابق يظل ممكنًا.
- لا يتغير أي ملف فيديو أو صوت أو رندر بسبب هذا الفحص.

## حدود الدليل
- علامات watched وreview وpronunciation هي إقرارات بشرية؛ لا تمثل مشاهدة أو ترخيصا آليًا. لا يقرر النظام من تلقاء نفسه أن فيلمًا صالِح.
- يعتمد النظام حاليًا على الحجم ووقت تعديل الملف للتحقق من استمرار اعتماده، وليس بصمة SHA256. الترقية إلى SHA256 تحتاج ترحيلًا آمنًا لبيانات الاعتماد القديمة.
- يقرأ Studio مجلد Git worktree الذي يعمل بداخله فقط. ملفات القنوات في worktrees أخرى لا تنتقل تلقائيًا ولا تختار بحسب تاريخ الملف.
- رابط Drive هو دليل تسليم، لا اعتماد محتوى. ولا يتم تفعيل تشغيل تلقائي أو نقل غير مصرح.

## Terminal: فحص وعرض في Worktree مستقل
cd "$HOME/balislam"
git fetch origin feat/studio-release-readiness-dashboard
bash <(git show origin/feat/studio-release-readiness-dashboard:scripts/studio-release-dashboard-preview.sh) check

بعد CHECK_OK فقط:
cd "$HOME/balislam"
bash <(git show origin/feat/studio-release-readiness-dashboard:scripts/studio-release-dashboard-preview.sh) serve

يفتح http://127.0.0.1:4323 في مجلد ~/balislam-studio-release-dashboard-preview، دون تعديل localhost:4321 أو نسخة 4322.

## شروط القبول قبل الدمج
1. اجتياز gate بما يشمل TypeScript وكل اختبارات المشروع والاختبارات الجديدة.
2. فحص غرفة العمليات والحلقات والنشر على المتصفح في RTL والهاتف.
3. رفض اعتماد معاينة صامتة، ورفض PUT status لنشر غير معتمد (HTTP 409)، دون تغيير status.json.
4. استمرار ظهور الحلقات المنشورة سابقًا دون التباس، واستمرار الإلغاء الآمن.
5. عدم وجود أخطاء من /api/ops أو /api/overview في Terminal.

لا تستخدم fresh-start.command ولا git reset --hard ولا تفعل LaunchAgent. لا يُدمج هذا الفرع حتى يؤكد Mac نجاح بوابة الاختبارات ومراجعة الواجهة.
