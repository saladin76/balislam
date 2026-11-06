/** Read-only assessment. Nothing here grants publication permission. */
export type ReleaseCounts = { done: number; total: number };
export type StudioReleaseReadiness = {
  channel: string;
  episode: string;
  found: boolean;
  folder: string | null;
  scriptValid: boolean;
  storyboard: ReleaseCounts;
  scenes: ReleaseCounts;
  sources: ReleaseCounts;
  narration: ReleaseCounts;
  verseTextMissing: number;
  master: boolean;
  masterVoiced: boolean;
  approved: boolean;
  publishFiles: ReleaseCounts;
  blockers: string[];
  state: "blocked" | "needs_human_review";
};
export type ReleaseInput = Omit<StudioReleaseReadiness, "blockers" | "state">;
/** Conservative on purpose. Manual full playback, licensing, ownership and final sign-off remain mandatory. */
export const summarizeStudioRelease = (r: ReleaseInput): StudioReleaseReadiness => {
  const blockers: string[] = [];
  if (!r.found) blockers.push("الحلقة غير موجودة في مجلد Studio الحالي؛ قد تكون في Git worktree آخر.");
  if (r.found) {
    if (!r.scriptValid) blockers.push("فحص السكريبت غير ناجح.");
    if (r.storyboard.total === 0 || r.storyboard.done !== r.storyboard.total)
      blockers.push(`Storyboard: ${r.storyboard.done}/${r.storyboard.total} مشهد معتمد.`);
    if (r.scenes.total === 0 || r.scenes.done !== r.scenes.total)
      blockers.push(`مراجعة المشاهد: ${r.scenes.done}/${r.scenes.total}.`);
    if (r.sources.done !== r.sources.total)
      blockers.push(`توثيق الاستشهادات: ${r.sources.done}/${r.sources.total}.`);
    if (r.verseTextMissing) blockers.push(`بطاقات آيات بلا نص معتمد: ${r.verseTextMissing}.`);
    if (r.narration.total === 0 || r.narration.done !== r.narration.total)
      blockers.push(`الصوت المطابق: ${r.narration.done}/${r.narration.total}.`);
    if (!r.master || !r.masterVoiced) blockers.push("نسخة Master كاملة بالصوت غير مثبتة في هذا المجلد.");
    if (!r.approved) blockers.push("اعتماد المالك المرتبط بالملف النهائي غير موجود أو غير مطابق.");
    if (r.publishFiles.done !== r.publishFiles.total) blockers.push(`حزمة النشر: ${r.publishFiles.done}/${r.publishFiles.total} ملف.`);
  }
  return { ...r, blockers, state: blockers.length ? "blocked" : "needs_human_review" };
};
