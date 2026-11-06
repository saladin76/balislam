/**
 * Read-only evidence about a local episode package. This deliberately does not grant
 * editorial, religious or publication approval. Absence of evidence always blocks.
 */
export type EvidenceCount = { done: number; total: number };
export type ReleaseEvidenceInput = {
  scriptOk: boolean;
  planSceneCount: number;
  planErrors: number;
  storyboard: EvidenceCount;
  sceneReview: EvidenceCount;
  sources: EvidenceCount;
  voice: EvidenceCount;
  missingVerseText: number;
  master: { exists: boolean; quality: string | null; voiced: boolean };
  planStale: boolean;
  ownerApprovalMatches: boolean;
  packageFiles: { youtube: boolean; social: boolean; checklist: boolean; srt: boolean; thumbnail: boolean };
  humanChecks: { watched: boolean; review: boolean; pronunciation: boolean };
};
export type ReleaseEvidence = {
  ready: boolean;
  blockers: string[];
  storyboard: EvidenceCount;
  scenes: EvidenceCount;
  sources: EvidenceCount;
  voice: EvidenceCount;
  master: boolean;
  ownerApproved: boolean;
};
const complete = (c: EvidenceCount) => c.total > 0 && c.done === c.total;

export const assessReleaseEvidence = (i: ReleaseEvidenceInput): ReleaseEvidence => {
  const blockers: string[] = [];
  if (!i.scriptOk) blockers.push("السكريبت لا يجتاز فحص القناة.");
  if (i.planSceneCount <= 0 || i.planErrors > 0) blockers.push("خطة المشاهد غير مكتملة أو بها أخطاء مانعة.");
  if (!complete(i.storyboard) || i.storyboard.total !== i.planSceneCount)
    blockers.push("اعتماد الستوري بورد الحالي: " + i.storyboard.done + "/" + i.planSceneCount + ".");
  if (!complete(i.sceneReview) || i.sceneReview.total !== i.planSceneCount)
    blockers.push("مراجعة المشاهد الحالية: " + i.sceneReview.done + "/" + i.planSceneCount + ".");
  if (i.sources.done !== i.sources.total)
    blockers.push("المصادر التي تحتاج توثيقًا: " + (i.sources.total - i.sources.done) + ".");
  if (i.missingVerseText > 0)
    blockers.push("بطاقات آيات بلا نص معتمد: " + i.missingVerseText + ".");
  if (i.voice.total > 0 && i.voice.done !== i.voice.total)
    blockers.push("الصوت المطابق للسكريبت: " + i.voice.done + "/" + i.voice.total + ".");
  const master = i.master.exists && i.master.quality === "master" && i.master.voiced;
  if (!master) blockers.push("لا توجد نسخة Master بصوت كامل (المعاينة وحدها لا تكفي).");
  if (i.planStale) blockers.push("الفيديو أقدم من آخر تعديل بالخطة.");
  const missing = ([
    ["youtube", "عنوان ووصف يوتيوب"],
    ["social", "حزمة المنصات"],
    ["checklist", "قائمة النشر"],
    ["srt", "الترجمة SRT"],
    ["thumbnail", "الصورة المصغّرة"]
  ] as const).filter(([key]) => !i.packageFiles[key]).map(([,label]) => label);
  if (missing.length) blockers.push("ملفات حزمة النشر الناقصة: " + missing.join("، ") + ".");
  if (!i.ownerApprovalMatches) blockers.push("اعتماد المالك للملف النهائي غير موجود أو لا يطابق الملف الحالي.");
  if (!i.humanChecks.watched) blockers.push("لم تُسجّل مشاهدة النسخة النهائية كاملة.");
  if (!i.humanChecks.review) blockers.push("لم يُسجّل اكتمال المراجعة الشرعية/التحريرية.");
  if (!i.humanChecks.pronunciation) blockers.push("لم تُسجّل مراجعة النطق.");
  return {
    ready: blockers.length === 0,
    blockers,
    storyboard: i.storyboard,
    scenes: i.sceneReview,
    sources: i.sources,
    voice: i.voice,
    master,
    ownerApproved: Boolean(i.ownerApprovalMatches),
  };
};
