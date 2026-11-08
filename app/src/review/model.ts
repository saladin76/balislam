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
  /** Read-only current media verification from Backend GET /scenes. No URL until review/start. */
  currentVideo?: {
    version: string; sha256: string; epoch: string;
    width?: number; height?: number; durationSec?: number; hasAudio?: boolean;
  };
  versions: SceneVersion[]; notes: ReviewNote[];
  /** UI-only affordances derived from server state. Backend remains the sole decision authority. */
  permissions: {
    approve: boolean; requestChanges: boolean; reasons: string[];
  };
};
export type ReviewEpisode = {
  channelId: string; episodeId: string; revision: number;
  /** Backend's canonical episode slug. Not supplied in QA fixtures. */
  serverEpisode?: string;
  sourceApprovals?: { script: boolean; storyboard: boolean };
  sourcesReady?: boolean;
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
  /** Server-issued completed AV review identifier; required only for approve. */
  reviewId?: string;
};
export type NewReviewNote = {
  sceneId: string; versionId: string; expectedFingerprint: string;
  text: string; second?: number; elementId?: string;
};
export type OwnerSession = {
  authenticated: true; role: "owner"; csrfToken: string; expiresAt: string;
};
export type AvReviewStart = {
  reviewId: string; challenge: string; fingerprint: string;
  durationSec: number; mediaUrl: string;
};
export type AvReviewTick = { challenge: string; playedSec: number };
export interface ReviewAdapter {
  readonly mode: "server" | "demo";
  session(): Promise<OwnerSession>;
  login(secret: string): Promise<OwnerSession>;
  logout(): Promise<void>;
  startReview(sceneId: string, fingerprint: string): Promise<AvReviewStart>;
  tickReview(sceneId: string, reviewId: string, challenge: string, positionSec: number): Promise<AvReviewTick>;
  finishReview(sceneId: string, reviewId: string, fingerprint: string): Promise<void>;
  load(): Promise<ReviewEpisode>;
  addNote(input: NewReviewNote): Promise<ReviewEpisode>;
  decide(input: ReviewDecision): Promise<ReviewEpisode>;
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
  if (!version?.fingerprint) reasons.push("الخادم لم يعرض بصمة AV صالحة.");
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
