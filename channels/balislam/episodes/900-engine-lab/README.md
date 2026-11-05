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

النسخ السابقة لكل خانة محفوظة في سجل git (`git log -- channels/balislam/episodes/900-engine-lab/previews`).
الرفع: `npx bal -c balislam upload-preview 900 <الخانة> <الملف> --title … --note …`
الرندر المتعدد عبر الطابور الآمن: `npx bal -c balislam render-batch <تكوين…> --out <مجلد>` (و`--retry` لإعادة الفاشل وحده)
