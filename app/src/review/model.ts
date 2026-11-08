/** Studio V2 AV review view models — display-only, never approval authority. */
export type SceneStatus = "draft" | "prepared" | "producing" | "in_review" |
  "changes_requested" | "approved" | "needs_reapproval";
export type ReviewNote = {
  id: string; versionId: string; text: string; second?: number;
  elementId?: string; createdAt: string;
};
export type VersionDiff = {
  field: string; before: string; after: string;
};
export type SceneVersion = {
  id: string;
  label: string;
  fingerprint: string;
  createdAt?: string;
  video?: {
    url: string; mime: "video/mp4"; durationSec: number;
    width?: number; height?: number; hasAudio?: boolean;
  };
  changes?: VersionDiff[];
  /** Optional diffs from arbitrary older versions; keyed by baseline version id. */
  diffsByBase?: Record<string, VersionDiff[]>;
};
export type SceneReviewRecord = {
  id: string; status: SceneStatus; currentVersionId?: string;
  versions: SceneVersion[]; notes: ReviewNote[];
  /** The server computes permissions and their reasons, never the browser. */
  permissions: {
    approve: boolean; requestChanges: boolean; reasons: string[];
  };
};
export type ReviewEpisode = {
  channelId: string; episodeId: string; revision: number;
  order: string[]; scenes: Record<string, SceneReviewRecord>;
};
export type SceneSeed = {
  id: string; ordinal: number; chapter: string; title: string;
  narration: string; storyboard: string; artDirection: string;
  camera: string; transition: string; timing: string; durationSec: number;
  elements: string[];
};
export type PlaybackEvent = {
  sceneId: string; versionId: string; sessionId: string;
  sequence: number; kind: "play" | "pause" | "seeked" | "heartbeat" | "ratechange" | "ended";
  positionSec: number; durationSec: number; playbackRate: number;
};
export type ReviewDecision = {
  sceneId: string; expectedFingerprint: string;
  action: "approve" | "request_changes";
  note?: string; second?: number; elementId?: string;
};
export type NewReviewNote = {
  sceneId: string; versionId: string; expectedFingerprint: string;
  text: string; second?: number; elementId?: string;
};
export interface ReviewAdapter {
  readonly mode: "server" | "demo";
  load(): Promise<ReviewEpisode>;
  addNote(input: NewReviewNote): Promise<ReviewEpisode>;
  decide(input: ReviewDecision): Promise<ReviewEpisode>;
  playback(event: PlaybackEvent): Promise<void>;
}
export const STATUS_LABELS: Record<SceneStatus, string> = {
  draft: "مسودة", prepared: "مجهّز", producing: "قيد الإنتاج",
  in_review: "قيد المراجعة", changes_requested: "مطلوب تعديل",
  approved: "معتمد", needs_reapproval: "يحتاج إعادة اعتماد",
};
export const formatClock = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const n = Math.floor(seconds);
  return String(Math.floor(n / 60)).padStart(2, "0") + ":" +
    String(n % 60).padStart(2, "0");
};
export const isSafeVideoUrl = (url: string, origin: string): boolean => {
  if (!url || url.startsWith("//")) return false;
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === new URL(origin).origin &&
      (parsed.protocol === "http:" || parsed.protocol === "https:");
  } catch { return false; }
};
export const activeVersion = (record: SceneReviewRecord): SceneVersion | undefined =>
  record.versions.find(v => v.id === record.currentVersionId);
/** A disabled state is always explained; these checks NEVER grant permission. */
export function actionBlockers(record: SceneReviewRecord, previous?: SceneReviewRecord, mode: "server" | "demo" = "server"): string[] {
  const reasons: string[] = [];
  if (mode === "demo") reasons.push("بيانات عرض اختبارية: الاعتماد والتعديل الحقيقيان غير متاحين.");
  if (record.status !== "in_review")
    reasons.push("حالة المشهد الحالية لا تسمح بقرار مراجعة.");
  const version = activeVersion(record);
  if (!version?.video?.url) reasons.push("لا يوجد فيديو MP4 صالح لهذا الإصدار.");
  if (previous && previous.status !== "approved")
    reasons.push("يجب اعتماد المشهد السابق أولًا.");
  if (!version?.fingerprint || !/^[a-f0-9]{64}$/.test(version.fingerprint))
    reasons.push("بصمة إصدار المشهد غير متاحة أو غير صالحة.");
  reasons.push(...record.permissions.reasons);
  return [...new Set(reasons)];
}
export const sameScope = (data: ReviewEpisode, channel: string, episode: string): boolean =>
  Boolean(data && data.channelId === channel && data.episodeId === episode &&
    Number.isSafeInteger(data.revision) && Array.isArray(data.order) &&
    data.order.length > 0 && new Set(data.order).size === data.order.length &&
    data.scenes && typeof data.scenes === "object" &&
    data.order.every(id => {
      const item = data.scenes[id];
      return typeof id === "string" && Boolean(item) && item?.id === id &&
        Object.hasOwn(STATUS_LABELS, item.status) &&
        Array.isArray(item.versions) && Array.isArray(item.notes) &&
        Boolean(item.permissions) && typeof item.permissions.approve === "boolean" &&
        typeof item.permissions.requestChanges === "boolean" &&
        Array.isArray(item.permissions.reasons) &&
        item.permissions.reasons.every(reason => typeof reason === "string");
    }));
