# المرجعيات الرسمية لقناة «بالإسلام»

هذا المجلد هو المكان الرسمي لوثائق القناة المعتمدة (الأمر 001، ٤ نوفمبر ٢٠٢٦).

## قواعد المجلد

- الوثائق محفوظة **كما سُلّمت** في `package/`: لا تعديل، ولا تلخيص، ولا نسخ مشتقة بديلة عنها.
- سلامتها تُتحقق ببصمات `package/manifest.json` (SHA-256). أي تحديث لوثيقة يأتي في حزمة جديدة كاملة ببصمات جديدة.
- القواعد المكتوبة في الشيفرة أو في ملفات المستودع الأخرى (`CLAUDE.md`، `docs/`، `channel.json`) ليست مرجعًا شرعيًا أو تحريريًا مستقلًا عن هذه الوثائق. عند التعارض يُرفع الأمر إلى صاحب القناة، ولا يُحسم بالشيفرة.
- لا تبدأ كتابة أو إنتاج أي حلقة قبل حسم التعارضات المسجلة واجتياز `package/04_execution/PRODUCTION_GATE.md`.

## سجل الوثائق

| # | الوثيقة | الملف | تاريخها |
| - | ------- | ----- | ------- |
| 1 | دليل قناة «بالإسلام» | `package/01_official_references/channel-guide.pdf` | ٢٩ أكتوبر ٢٠٢٦ |
| 2 | ميثاق المحتوى والمرجعية الشرعية | `package/01_official_references/sharia-editorial-charter.pdf` | ٢٩ أكتوبر ٢٠٢٦ |
| 3 | أصول كتابة السكريبت | `package/01_official_references/scriptwriting-principles.pdf` | ٢٩ أكتوبر ٢٠٢٦ |
| 4 | دليل الصوت | `package/01_official_references/audio-guide.pdf` | ٢٩ أكتوبر ٢٠٢٦ |
| 5 | آلية العمل | `package/01_official_references/workflow.pdf` | ٢٩ أكتوبر ٢٠٢٦ |
| 6 | الهوية البصرية | `package/01_official_references/visual-identity.pdf` (لوحة الثيمات) و`package/03_visual_identity/approved-mihrab-al-noor.png` (المعتمد «محراب النور») و`package/03_visual_identity/channel-assets/` | ٢٩ أكتوبر / ٣ نوفمبر ٢٠٢٦ |
| 7 | المواصفات التقنية لمنظومة «بالإسلام» | `package/01_official_references/technical-specifications.md` | ٢٩ أكتوبر ٢٠٢٦ |
| 8 | يوتيوب والجمهور | `package/01_official_references/youtube-audience.pdf` | ٢٩ أكتوبر ٢٠٢٦ |
| 9 | دليل محتوى قناة «بالإسلام» | `package/01_official_references/channel-content-guide.pdf` | ٣١ أكتوبر ٢٠٢٦ |
| 10 | الدليل المهني للموشن جرافيك | `package/02_motion_and_production/motion-graphics-professional-guide.txt` | — |
| — | تطوير منهج إنتاج الفيديوهات (تعليمات معتمدة) | `package/02_motion_and_production/production-method-development.txt` | — |

ملفات الحزمة التنظيمية: `package/README.md`، و`package/04_execution/` (تكليف التنفيذ، وسجل التعارضات المعلّقة، وبوابة الجاهزية).

## التحقق من السلامة

```bash
cd channels/balislam/references/package
python3 -c "import json,hashlib;m=json.load(open('manifest.json'));print([e['path'] for e in m['entries'] if hashlib.sha256(open(e['path'],'rb').read()).hexdigest()!=e['sha256']] or 'كل البصمات مطابقة')"
```
