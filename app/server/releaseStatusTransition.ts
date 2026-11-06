import type { ReleaseEvidence } from "./releaseEvidence";

type ReleaseStatus = {
  approved?: { at: string; size: number; mtime: number };
  published?: { date: string; url?: string };
};

/** Fail closed on new approvals/publications; existing status notes and revocations still work. */
export const statusTransitionError = (
  previous: ReleaseStatus,
  next: ReleaseStatus,
  evidence: ReleaseEvidence | null,
  video: { size: number; mtime: number } | null,
): string | null => {
  const approvalChanged = JSON.stringify(previous.approved ?? null) !== JSON.stringify(next.approved ?? null);
  const publishChanged = JSON.stringify(previous.published ?? null) !== JSON.stringify(next.published ?? null);
  if (next.approved && approvalChanged) {
    if (!Number.isFinite(next.approved.size) || !Number.isFinite(next.approved.mtime) ||
      !video || video.size !== next.approved.size || Math.abs(video.mtime - next.approved.mtime) >= 1)
      return "اعتماد النسخة لا يطابق فيديو Master الموجود على الجهاز.";
    if (!evidence) return "لا تتوفر أدلة الجاهزية المحلية لاعتماد الفيديو.";
    const missing = evidence.blockers.filter((reason) => !reason.startsWith("اعتماد المالك"));
    if (missing.length) return "لا يمكن اعتماد الفيديو قبل إغلاق موانع النشر: " + missing[0];
  }
  if (next.published && publishChanged) {
    if (typeof next.published.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(next.published.date))
      return "تاريخ النشر غير صالح.";
    if (next.published.url && (typeof next.published.url !== "string" || !/^https:\/\//.test(next.published.url)))
      return "رابط النشر يجب أن يبدأ بـ https://.";
    // Approval must be stored and fully checked before publication is recorded.
    if (!evidence?.ready) return "لا يمكن تسجيل النشر قبل اكتمال أدلة Master والمراجعات واعتماد المالك.";
  }
  return null;
};
