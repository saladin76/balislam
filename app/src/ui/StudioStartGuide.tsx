import React from "react";

/**
 * One optional orientation panel. It never changes an episode or bypasses
 * the existing quality gates; the episode workspace remains authoritative.
 */
export const StudioStartGuide: React.FC = () => (
  <details className="studio-start-guide">
    <summary>دليل العمل السريع · من الفكرة إلى النشر <span>عرض الخطوات</span></summary>
    <p>ابدأ من غرفة العمليات، ثم افتح الحلقة. شريط مراحل الحلقة يقودك بين الخطوات؛ لا حاجة للانتقال إلى الإعدادات أو المكتبة إلا عند الحاجة.</p>
    <ol>
      <li><strong>اختر القناة والحلقة:</strong> غرفة العمليات ← افتح حلقة أو أنشئ واحدة.</li>
      <li><strong>البحث والنص:</strong> جهّز المصادر، واكتب السكريبت، وعالج الأخطاء قبل الانتقال.</li>
      <li><strong>الستوري بورد:</strong> راجع المخطط والتوقيت؛ افحص الحركة إذا احتاج المشهد ذلك.</li>
      <li><strong>الصوت والمشاهد:</strong> جهّز التعليق الصوتي، ثم راجع معاينات المشاهد داخل الاستوديو.</li>
      <li><strong>الفيديو والنشر:</strong> صدّر نسخة مراجعة، تحقق من الجودة والاعتماد، ثم جهّز حزمة النشر.</li>
    </ol>
    <p>القائمة الجانبية تجمع مساحة العمل وإدارة القناة: الهوية والمكتبة وإعدادات الاتصال. على الهاتف افتحها من زر القائمة. لا تبدأ بتغيير الإعدادات عند العمل على حلقة عادية.</p>
  </details>
);
