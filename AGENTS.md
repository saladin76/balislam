# AGENTS.md — نقطة الدخول لأي مطور أو وكيل

اقرأ هذه الصفحة أولًا. هي خريطة فقط: لا تنسخ قواعد من غيرها، بل تدلّك على مكانها.

## المشروع

منظومة واحدة (محرك Remotion + استوديو ويب في `app/`) تنتج حلقات ثلاث قنوات عربية، لكل منها هويتها ومكتبتها:

| القناة | المعرّف | دليلها التفصيلي |
| --- | --- | --- |
| بالإسلام | `balislam` | لا دليل مستقل بعد: `CLAUDE.md` وملفات `channels/balislam/` (ومختبرها `channels/balislam/episodes/900-engine-lab/README.md`) |
| دفاتر الزمن | `dafatir-alzaman` | **[docs/dafatir-alzaman/](docs/dafatir-alzaman/README.md)** — ابدأ من [00-start-here.md](docs/dafatir-alzaman/00-start-here.md) |
| زبدة الكتب | `zubdat-alkutub` | **[docs/zubdat-alkutub/](docs/zubdat-alkutub/README.md)** — ابدأ من [00-start-here.md](docs/zubdat-alkutub/00-start-here.md)، والمختصر في [channels/zubdat-alkutub/AGENTS.md](channels/zubdat-alkutub/AGENTS.md) |

التشغيل وفتح الاستوديو: [README.md](README.md).

## أين القواعد

1. **[CLAUDE.md](CLAUDE.md) — القواعد الملزمة لكل القنوات.** يتقدم على كل ما سواه، ولا يُنسخ في مكان آخر.
2. **دليل القناة** (`docs/<القناة>/`) — خصوصياتها فقط: الهوية، الإخراج، الأدوات، سير الإنتاج، الجودة، سجل القرارات. يُقرأ أيضًا من الاستوديو: «الأدوات والإعدادات ← دليل الاستوديو».
3. **المختبرات** (مجلد فيه `lab.json` بلا سكريبت): تجارب إخراجية تظهر في «مختبرات الإنتاج» بالاستوديو، منفصلة عن الحلقات ولا تُنشر (`src/channel/labs.ts`؛ التفصيل في [docs/dafatir-alzaman/08-labs.md](docs/dafatir-alzaman/08-labs.md)).
4. **ملفات الحلقة** (`channels/<القناة>/episodes/<الحلقة>/`) — قرارات الحلقة وسجل إنتاجها `production-log.md`.
5. المعايير المهنية العامة للموشن جرافيك: `docs/motion-graphics-standards.md` (تتقدم عليها القواعد أعلاه).

إن تعارض شيء مع `CLAUDE.md` فـ`CLAUDE.md` هو الصحيح، وصحّح الآخر.

## قبل أي تعديل

```bash
npm install                 # يفعّل بوابة التسليم (.githooks/pre-push)
npx tsc --noEmit -p .        # الأنواع
npx vitest run               # كل الاختبارات
npm run gate                 # الاثنان معًا كما تفحصهما البوابة
```

- اعمل على القناة الصحيحة: `BAL_CHANNEL=<المعرّف>` لأوامر `npx bal …`.
- لا تعطّل اختبارًا ولا تتجاوز البوابة (`--no-verify`) لتمرير تسليم.
- الأسرار في `.env` فقط: لا تُرفع، ولا تُكتب في وثيقة، ولا تُستعمل مفاتيح تُلصق في المحادثة.
- لا تخلط هويات القنوات؛ الهويات مقفلة بـ`tests/identity-approved.test.ts`.

## قاعدة تحديث التوثيق

كل تغيير يؤثر في أسلوب إنتاج قناة أو أدواتها أو قواعدها يُسلَّم **مع** تحديث وثيقته وسجل قراراتها في الدفع نفسه. المهمة غير مكتملة إن تغيّر التنفيذ وبقي التوثيق قديمًا.
لـ«دفاتر الزمن» و«زبدة الكتب» يُفرض آليًا: البوابة ترفض تغيير ملفات منظومتهما دون تحديث `docs/dafatir-alzaman/07-decisions.md` أو `docs/zubdat-alkutub/06-decisions.md` (`scripts/docs-sync.mjs`).

## متى ترجع إلى صاحب القناة

النص والتشكيل، أي اعتماد، بدء الصوت أو التلاوة، الهوية، قواعد القياس، الحذف، وأي مسألة شرعية أو تمثيل قد يقترب من التجسيد. التفصيل لكل قناة في دليلها (لدفاتر الزمن: [00-start-here.md](docs/dafatir-alzaman/00-start-here.md)، القسمان ٩ و١٠).
