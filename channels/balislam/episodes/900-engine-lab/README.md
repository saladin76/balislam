# مختبر المحرك — «بالإسلام»

اختبارات بصرية قصيرة لقدرات المحرك (الأمر 005): مشاهد محايدة، بلا تعليق صوتي ولا موسيقى، لا تُنشر أبدًا ولا تُعد حلقة.
كل اختبار يُرندر من تكوينات `balislam-lab-*` في `src/remotion/lab/BalislamLab.tsx`، ويُرفع إلى «المعاينات» هنا.
رفع الاختبار لا يعني اعتماده فنيًا.

| الخانة | التكوين | ما يختبره |
| --- | --- | --- |
| `camera-ab` | `balislam-lab-camera-ab` | الكاميرا الآلية القديمة مقابل المؤلَّفة (الأمر 005–006) |
| `camera-portrait` | `balislam-lab-camera-portrait` | الكاميرا المؤلَّفة في العمودي |
| `motion` | `balislam-lab-motion-007` (`src/remotion/lab/MotionLab007.tsx`) | الالتفاتة قبل وبعد، والمشيات الأربع، ووقوف ← مشي ← توقف (الأمر 007) |
| `motion-scenes` | `balislam-lab-motion-scenes` | الحركة نفسها في «الطريق» و«الحارة» عبر الطبقة المشتركة (الأمر 007) |
| `light` | `balislam-lab-light-*` (`src/remotion/lab/LightLab.tsx`) | الإضاءة والظلال والعمق: خمس مقارنات قبل وبعد (الأمر 008) |
| `light-009` | `balislam-lab-light9-*` (`src/remotion/lab/LightLab.tsx`) | الإضاءة الداخلية مقابل الأمر 008، وضوء النافذة، والعمق في «الطريق» والعمودي (الأمر 009) |
| `transitions-011` و`transitions-011-portrait` | `lab-transitions-landscape` و`lab-transitions-portrait` (`src/remotion/lab/TransitionLab.tsx`) | الانتقالات بين المشاهد عبر محرك الحلقة الحقيقي، أولها بلا حقل للمقارنة (الأمر 011) |
| `engine-permanent` و`engine-permanent-portrait` | `lab-permanent-ch2-landscape` و`lab-permanent-ch2-portrait` (`src/remotion/lab/PermanentLab.tsx`) | الفصل ٢ من الحلقة 001 كما اعتُمد مقابل الخطة نفسها لو أُنشئت جديدة بعد اعتماد الأساس (التوجيه الدائم) |
| `framing-013` و`framing-013-portrait` | `lab-framing-landscape` و`lab-framing-portrait` (`src/remotion/lab/FramingLab.tsx`) | التأطير القائم مقابل المحتوي (`framing = fit`) في ست حالات: وحده، جالس، شخص أمامه، شاهدان، لوحة، ذكر الله (الأمر 013) |
| `motion-013` و`motion-013-portrait` | `lab-motion-013-landscape` و`lab-motion-013-portrait` (`src/remotion/lab/PermanentLab.tsx`) | الحركة القديمة والطبيعية في «الطريق» و«ظل ونور» بالاتجاهين (الأمر 013) |
| `review-014` و`review-014-portrait` | `review-014-landscape` و`review-014-portrait` (`src/remotion/lab/ReviewReel014.tsx`) | نسخة المراجعة البصرية الأولى بملء الإطار: الحارة والطريق وظل ونور، صامتة ومحايدة (الأمر 014) |
| (صورة) `storyboards/witnesses-015-v1.png` و`-v2.png` | — | ستوري بورد مشهد الشاهدين «ميزان البائع» (الأمر 015): النسخة 1 «يحتاج تعديلًا» بقرار صاحب القناة، والنسخة 2 «جاهز للمراجعة»؛ تظهر في «مختبرات الإنتاج ← ستوري بورد · صور» |
| `engine-styles` | `lab-permanent-styles` (`src/remotion/lab/PermanentLab.tsx`) | الحركة القديمة والطبيعية في «الطريق» و«ظل ونور» (التوجيه الدائم) |

النسخ السابقة لكل خانة محفوظة في سجل git (`git log -- channels/balislam/episodes/900-engine-lab/previews`).
الرفع: `npx bal -c balislam upload-preview 900 <الخانة> <الملف> --title … --note …`
المختبر مسجّل في «مختبرات الإنتاج» بالاستوديو (`lab.json`: حالة كل أداة ومعاينة، ولا اعتماد فيه إلا بقرار صاحب القناة).
المرجع الهندسي الكامل للمحرك وحالة كل أداة: `docs/balislam/03-engine.md`.
الرندر المتعدد عبر الطابور الآمن: `npx bal -c balislam render-batch <تكوين…> --out <مجلد>` (و`--retry` لإعادة الفاشل وحده)
