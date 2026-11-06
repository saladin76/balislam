import type { ReleaseEvidence } from "../../server/releaseEvidence";

/** Copyable evidence for human chat handoff; it never grants approval. */
export const releaseHandoffReport = (
  channel: string,
  episode: string,
  title: string,
  evidence: ReleaseEvidence | null,
) => [
  "# تقرير حالة النشر — Studio localhost",
  "القناة: " + channel,
  "الحلقة: " + episode + " — " + title,
  "المصدر: ملفات Git worktree الذي يعمل منه Studio فقط. لا يشمل مجلدات الإنتاج الأخرى.",
  "حالة الجاهزية المحلية: " + (evidence?.ready ? "اجتازت الفحوص المسجّلة" : "غير مكتملة"),
  ...(evidence ? [
    "الستوري بورد: " + evidence.storyboard.done + "/" + evidence.storyboard.total,
    "المشاهد المعتمدة: " + evidence.scenes.done + "/" + evidence.scenes.total,
    "المصادر المعتمدة: " + evidence.sources.done + "/" + evidence.sources.total,
    "الصوت المتطابق: " + evidence.voice.done + "/" + evidence.voice.total,
    "Master بصوت: " + (evidence.master ? "نعم" : "غير مثبت"),
    "اعتماد المالك للملف: " + (evidence.ownerApproved ? "مطابق محليًا" : "غير مثبت"),
    "الموانع: ",
    ...(evidence.blockers.length ? evidence.blockers.map((r, i) => (i + 1) + ". " + r) : ["لا توجد موانع آلية مسجّلة."])
  ] : ["بيانات الجاهزية غير متاحة؛ اطلب الفحص على Mac قبل اتخاذ القرار."]),
  "تنبيه: هذا تقرير فحص ملفات فقط، وليس موافقة شرعية أو مراجعة بصرية كاملة أو تصريحًا بالنشر.",
  "المطلوب من المراجع/Claude: التحقق من مسار العمل والنسخة والبصمة ومراجعة العيوب الفعلية ثم رفع تقرير تنفيذ صادق.",
].join("\n");
