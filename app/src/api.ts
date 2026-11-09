import type { Plan } from "../../src/plan/types";
import type { Identity } from "../../brand/identity/index";
import type { EpisodeMedia } from "../../src/plan/media";
import type { PlanIssue } from "../../src/plan/validate";
import type { PublishKit } from "../../src/package/social";
import type { ChannelConfig, ChannelDomain, ChannelInfo } from "../../src/channel/types";
import type { GuideIndex } from "../../src/channel/guide";
import type { LabSummary } from "../../src/channel/labs";
import type { StoryboardEntry, StoryboardStatus, StoryboardVersion } from "../../src/channel/labStoryboardsShared";
import type { TechReviewSummary } from "../../src/channel/techReviews";
import type { ScriptSaveReply } from "./planGuard";
import type { WorkflowApprovalView } from "../../src/workflow/uiProjection";
import type { WorkflowStage } from "../../src/workflow/gates";
import { ownerMessage } from "./serverMessages";

export type Issue = { level: "error" | "warning"; code: string; message: string; line?: number };
export type CheckResult = { ok: boolean; issues: Issue[]; stats: { chapters: { number: number; words: number; seconds: number }[]; totalWords: number; totalSeconds: number } };
export type EpisodeSummary = { id: string; dir: string; title: string; domain: string; hasPlan: boolean };
export type ChannelSummary = { id: string; name: string; language: string; domains: Record<string, ChannelDomain> };
export type EpisodeData = { channel: ChannelInfo; script: string; plan: Plan; check: CheckResult; media: EpisodeMedia; issues: PlanIssue[]; keys: { voice: boolean; quran: boolean } };
export type TashkeelReport = { file: boolean; words: number; covered: number; coverage: number; min: number; ok: boolean; gaps: { sceneId: string; words: string[]; narration: string }[]; ambiguous: { word: string; forms: string[]; scenes: string[] }[] };
export type ReviewItem = { key: string; kind: "ayah" | "hadith" | "other"; label: string; ref: string; detail: string; text?: string; line: number; hash: string; status: "pending" | "changed" | "verified" | "rejected"; note?: string; at?: string };
export type ReviewSummary = { total: number; verified: number; pending: number; changed: number; rejected: number; ok: boolean };
export type SceneReviewItem = { id: string; hash: string; status: "pending" | "changed" | "ok" | "fix"; note?: string; at?: string };
export type SceneReviewSummary = { total: number; ok: number; fix: number; pending: number; changed: number; done: boolean };
export type VoiceReport = { total: number; toGenerate: { id: string; chars: number }[]; cached: string[]; chars: number; credits: number; tashkeel?: TashkeelReport; review?: ReviewSummary };
export type Overview = {
  id: string;
  dir: string;
  title: string;
  domain: string;
  lang: string;
  check: { ok: boolean; errors: number; warnings: number; seconds: number };
  scenes: number;
  voice: { done: number; total: number };
  blocking: number;
  package: { video: boolean; shorts: number; thumbnails: number; updatedAt: number | null };
  planUpdatedAt: number | null;
  /** الأسلوب الغالب على الحلقة (للتنوّع) */
  style: string;
  status: EpisodeStatus;
  /** حالة الخطوات الأربع من سجل الإنتاج؛ null إن تعذّرت قراءته */
  production?: ProductionSummary | null;
};
export type ProductionSummary = { steps?: [boolean, boolean, boolean, boolean]; preparation?: boolean; script: boolean; storyboard: boolean; approvedScenes: number; totalScenes: number; canAssemble: boolean; assemblyApproved: boolean; masterApproved: boolean; publishAllowed: boolean };
/** معاينة حلقة: source يبيّن هل الفيديو على هذا الجهاز، أو في مجلد Drive المتزامن، أو رابط Drive فقط */
export type EpisodePreview = { name: string; size: number; mtime: number; title: string; note: string; version: number; updatedAt: string | null; source: "local" | "drive-mirror" | "drive-link" | "missing"; driveUrl: string | null };
export type EpisodeStatus = { /** اعتماد النسخة الأساسية بعد مشاهدتها كاملة (بصمة ملف الحلقة) */ approved?: { at: string; size: number; mtime: number }; checklist?: Record<string, boolean>; published?: { date: string; url?: string }; notes?: string; /** يوم نشر الحلقة الطويلة المخطط (YYYY-MM-DD) */ scheduled?: string };
export type Idea = { id: string; title: string; note?: string; domain?: string; style?: string; createdAt: string };
/** يوم في تقويم القناة: شورتس محددة (حلقة + رقم الشورت)، أو بلا نشر، وملاحظة */
export type CalendarDay = { shorts?: { ep: string; n: number }[]; off?: boolean; note?: string };
export type OpsChannel = { calendar: Record<string, CalendarDay>; channel: { id: string; name: string; language: string; schedule: { longDay: number; time?: string; shortsPerDay?: number } | null; domains: Record<string, ChannelDomain> }; episodes: Overview[]; ideas: Idea[] };
export type PackageInfo = { files: { name: string; size: number; mtime: number }[]; youtube: string; checklist: string; /** بأي جودة رُندرت الحلقة */ render?: { quality: "master" | "preview"; label: string; width: number; height: number; voiced: boolean; at: string } | null };
export type StoryboardInfo = { status: import("../../src/plan/storyboard").StoryboardStatus; motion: import("../../src/render/storyboardMotion").StoryboardMotion | null; motionStale?: string[]; auditNeedsReview?: boolean; motionAuditNeedsReview?: boolean };
export type LongJob = { id: string; kind: string; episode?: string; title: string; status: "running" | "done" | "error"; pct: number; log: string[]; error?: string; startedAt: number; queued?: boolean };
export type KeyState = Record<string, { label: string; set: boolean; preview: string }>;
export type SfxItem = { id: string; nameAr: string; category: string; categoryAr: string; useAr: string; seconds: number; guard?: string; available: boolean };
export type RenderJob = { id: string; episode: string; orientation: string; chapter?: number; status: "running" | "done" | "error"; pct: number; output?: string; error?: string; queued?: boolean };

/** القناة المختارة في الاستوديو: تُضاف لكل طلب. */
let currentChannel = "";
export const setApiChannel = (id: string) => {
  currentChannel = id;
};
const withChannel = (url: string) => (currentChannel ? `${url}${url.includes("?") ? "&" : "?"}channel=${encodeURIComponent(currentChannel)}` : url);

const call = async <T>(path: string, init?: RequestInit & { json?: unknown }, channel?: string): Promise<T> => {
  const url = channel ? `${path}${path.includes("?") ? "&" : "?"}channel=${encodeURIComponent(channel)}` : withChannel(path);
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined
      ? { "content-type": "application/json", ...(init.headers as Record<string, string> | undefined) }
      : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(ownerMessage((data as { error?: string }).error ?? `خطأ ${res.status}`));
  return data as T;
};


export type SceneProductionRead = {
  schemaVersion: 1;
  channel: string; episode: string; revision: number;
  progress: { currentScene: string | null; approvedScenes: number; totalScenes: number;
    canAssemble: boolean; assemblyApproved: boolean; masterApproved: boolean; publishAllowed: boolean;
    /** Verse scenes approved «مشروط بالتلاوة»: assembly and Master wait for their recitation. */
    recitationPending?: string[] };
  script: { sha256: string; approved: boolean };
  storyboard: { sha256: string; approved: boolean };
  scenes: { id: string; status: "queued" | "in_review" | "approved" | "needs_revision";
    sourceSha256: string; previewSha256?: string; readyForAv: boolean; approved: boolean;
    /** Verse card whose human recitation is not attached yet (its draft is silent, marked). */
    recitationPending?: boolean;
    /** Approved on condition of its recitation (re-opens when the recitation is attached). */
    conditional?: boolean;
    /** Pre-rendered draft from «جهّز كل المشاهد»: never a submission or approval. */
    draft?: "ready" | "stale" | "none";
    /** The owner's latest «الحركة/النبرة غير مناسبة» note while the scene awaits its fix. */
    correction?: { note: string; at: string;
      /** صندوق الملاحظات (docs/studio/notes-inbox.md): أُرسلت إلى Claude أو بانتظار الإرسال، ورده بعد git pull. */
      inbox?: { id: string; sync: "pending" | "sent"; status: "open" | "in-progress" | "fixed" | "wont-fix"; answer: string | null } } }[];
  /** «جاهز ١٢ من ٣١»: approved, submitted, or with a current draft. */
  prepared?: { ready: number; total: number };
  assembly: { sha256: string; approved: boolean } | null;
  /** Every boundary between consecutive scenes, in order ("c1-s1>c1-s2"). */
  seams: string[];
  /** While the assembly awaits review: each seam's time in the assembled file (seconds), if known. */
  seamTimes?: Record<string, number>;
  master: { sha256: string; approved: true; publishAllowed: boolean } | null;
  candidates: { scenes: Record<string, string | null>; assemblySha256: string | null;
    masterSha256: string | null };
  /** Episode tone map (دفاتر الزمن): version and each scene's part tone ("" = mixed). null/absent elsewhere. */
  toneMap?: { version: string; tones: Record<string, string> } | null;
};
export type Loudness = { integrated: number; truePeak: number; lra: number; threshold: number };
export type RecitationVariant = { file: string; duration: number; sha256: string; loudness: Loudness };
export type RecitationPolish = { before: Loudness; trim: { start: number; end: number; duration: number; trimmedHead: number; trimmedTail: number };
  target: { integrated: number; truePeak: number; source: "narration" | "default" } };
export type OwnRecitationCandidate = { file: string; duration: number; sha256: string; createdAt: string;
  variant?: "processed" | "original"; variants?: Record<"processed" | "original", RecitationVariant>; polish?: RecitationPolish };
export type OwnRecitationsRead = {
  verses: { key: string; sceneId: string; reference: string }[];
  pending: Record<string, OwnRecitationCandidate>;
  approved: Record<string, { reciter: string; approvedAt: string; file: string; duration: number;
    variant: "processed" | "original" | null; variants: Record<"processed" | "original", RecitationVariant> | null; polish: RecitationPolish | null }>;
};
export type ScenePrepareJob = {
  status: "running" | "done" | "error" | "stopped"; stopRequested?: boolean; startedAt: number; finishedAt?: number;
  phase: "voice" | "render" | "done"; sceneId?: string;
  voice: { needed: number; generated: number; status: string; error?: string };
  rendered: string[]; failed: { id: string; error: string }[]; error?: string;
  /** Not rendered on purpose: waiting for a voice that cannot be made now, or the same inputs failed last run. */
  skipped?: { id: string; reason: "voice" | "failed-before"; error?: string }[];
};
export type PreparationRead = { scriptErrors: number; versesMissing: string[]; boardsRecorded: boolean };
export type ScenePrepareRead = { job: ScenePrepareJob | null; voiceKey: boolean; needVoice?: number };
export type SceneOwnerAction = {
  action: "approve-script" | "approve-storyboard" | "submit-scene" | "approve-scene" |
    "correct-scene" | "assemble" | "approve-assembly" | "approve-master" | "grant-publish";
  expectedSha256: string;
  sceneId?: string;
  note?: string;
  confirmedWatched?: boolean;
  seamsChecked?: string[];
  /** correct-scene in a tone-map episode: the owner's tone for this scene (new tone-map version). */
  tone?: string;
};

export const api = {
  /** One scene = one combined audiovisual review; no Quran provider selection. */
  /** كلمة مرور المالك: هل ضُبطت؟ وضبطها أول مرة (أو تغييرها بالكلمة الحالية). */
  ownerPassphrase: () => call<{ set: boolean }>("/api/owner-passphrase"),
  setOwnerPassphrase: (passphrase: string, current?: string) =>
    call<{ set: boolean }>("/api/owner-passphrase", { method: "POST", json: { passphrase, ...(current ? { current } : {}) } }),
  /** D49: open a device session once with the passphrase; the server returns a revocable token. */
  openOwnerSession: (passphrase: string) =>
    call<{ ok: boolean; token?: string }>("/api/owner-session", { method: "POST", json: { passphrase } }),
  ownerSessionStatus: (token: string) =>
    call<{ open: boolean }>("/api/owner-session", { headers: { "x-studio-owner-token": token } }),
  closeOwnerSession: (token: string) =>
    call<{ open: boolean }>("/api/owner-session", { method: "DELETE", headers: { "x-studio-owner-token": token } }),
  checkOwnerPassphrase: (passphrase: string) =>
    call<{ ok: boolean }>("/api/owner-passphrase/check", { method: "POST", json: { passphrase } }),
  sceneProduction: (episode: string, channel?: string) =>
    call<SceneProductionRead>(`/api/episodes/${episode}/scene-production`, undefined, channel),
  decideScene: (episode: string, channel: string, token: string, decision: SceneOwnerAction) =>
    call<SceneProductionRead>(`/api/episodes/${episode}/scene-production`, {
      method: "POST", json: decision, headers: { "x-studio-owner-token": token },
    }, channel),
  assembleSceneAv: (episode: string, channel: string, token: string) =>
    call<{ ok: true; version: number; scenes: number }>(
      `/api/episodes/${episode}/scene-av-assemble`, {
        method: "POST", headers: { "x-studio-owner-token": token },
      }, channel),
  renderSceneAv: (episode: string, channel: string, token: string, sceneId: string,
    expectedSha256: string) =>
    call<{ ok: true; version: number; preview: string }>(
      `/api/episodes/${episode}/scene-av-render`, {
        method: "POST", json: { sceneId, expectedSha256 },
        headers: { "x-studio-owner-token": token },
      }, channel),
  /** «معاينة قبل النهائية»: all current scene cuts in order, recitations missing; never an approval. */
  preFinal: (episode: string, channel: string) =>
    call<{ preview: string | null; entry: { title: string; version: number; updatedAt: string | null } | null }>(
      `/api/episodes/${episode}/scene-prefinal`, undefined, channel),
  makePreFinal: (episode: string, channel: string, token: string) =>
    call<{ ok: true; preview: string; version: number; scenes: number; recitationPending: string[] }>(
      `/api/episodes/${episode}/scene-prefinal`, { method: "POST", headers: { "x-studio-owner-token": token } }, channel),
  /** The owner's own recitations: upload (processed + original kept), switch variant, approve after listening. */
  ownRecitations: (episode: string, channel: string) =>
    call<OwnRecitationsRead>(`/api/episodes/${episode}/own-recitations`, undefined, channel),
  ownRecitationAction: (episode: string, channel: string, token: string, body:
    | { action: "upload"; key: string; name: string; data: string }
    | { action: "select"; key: string; variant: "processed" | "original" }
    | { action: "approve"; key: string; reciter: string; rightsEvidence: string; note: string; listened: boolean }) =>
    call<Record<string, unknown>>(`/api/episodes/${episode}/own-recitations`, {
      method: "POST", json: body, headers: { "x-studio-owner-token": token } }, channel),
  /** Step ١ «التجهيز»: what still blocks the one-button approval (script errors, verses without text, board record). */
  preparation: (episode: string, channel: string) =>
    call<PreparationRead>(`/api/episodes/${episode}/approve-preparation`, undefined, channel),
  /**
   * «اعتمد التجهيز»: the script approval, then (if needed) the board record, then the storyboard approval, each
   * checked by the server; then the scenes start preparing on their own (drafts only, nothing approved).
   */
  approvePreparation: (episode: string, channel: string, token: string, body: { scriptSha256: string; storyboardSha256: string; reviewed: boolean; note?: string }) =>
    call<SceneProductionRead & { prepare: { job: ScenePrepareJob | null; error?: string } }>(`/api/episodes/${episode}/approve-preparation`, {
      method: "POST", json: body, headers: { "x-studio-owner-token": token },
    }, channel),
  /** «جهّز كل المشاهد»: status of the background queue (read-only). */
  scenePrepare: (episode: string, channel: string) =>
    call<ScenePrepareRead>(`/api/episodes/${episode}/scene-prepare`, undefined, channel),
  startScenePrepare: (episode: string, channel: string, token: string) =>
    call<ScenePrepareRead>(`/api/episodes/${episode}/scene-prepare`, {
      method: "POST", headers: { "x-studio-owner-token": token },
    }, channel),
  /** «أوقف»: the step in progress finishes and is kept; nothing new starts. */
  stopScenePrepare: (episode: string, channel: string, token: string) =>
    call<ScenePrepareRead>(`/api/episodes/${episode}/scene-prepare`, {
      method: "DELETE", headers: { "x-studio-owner-token": token },
    }, channel),
  workflow: (episode: string, channel?: string) => call<{
    approvals: WorkflowApprovalView;
    fingerprints: Partial<Record<WorkflowStage, string>>;
    revision: number;
  }>(`/api/episodes/${episode}/workflow`, undefined, channel),
  workflowDecision: (episode: string, channel: string, token: string,
    decision: { action: "submit" | "approve" | "reject" | "reopen"; stage: WorkflowStage;
      expectedFingerprint: string; note: string; confirmWatched?: boolean }) =>
    call<{ approvals: WorkflowApprovalView }>(`/api/episodes/${episode}/workflow`, {
      method: "POST", json: decision, headers: { "x-studio-owner-token": token },
    }, channel),
  scriptSignoff: (episode: string) =>
    call<{ approved: boolean; changed: boolean; needsReview?: boolean; signedAt?: string; reviewer?: string }>(`/api/episodes/${episode}/script-signoff`),
  approveScriptSignoff: (episode: string, reviewer: string, note: string) =>
    call<{ approved: boolean; changed: boolean; needsReview?: boolean; signedAt?: string; reviewer?: string }>(
      `/api/episodes/${episode}/script-signoff`, { method: "PUT", json: { reviewer, note, confirm: true } }),
  voiceReview: (episode: string, channel: string) =>
    call<{ items: { id: string; state: "needs_tone" | "missing_audio" | "pending" | "changed" | "approved" }[]; episodeApproved: boolean }>(
      `/api/episodes/${episode}/voice-review`, undefined, channel),
  approveVoiceScene: (episode: string, channel: string, data: { sceneId: string; reviewer: string; note: string }) =>
    call<{ items: { id: string; state: "needs_tone" | "missing_audio" | "pending" | "changed" | "approved" }[]; episodeApproved: boolean }>(
      `/api/episodes/${episode}/voice-review`, { method: "PUT", json: data }, channel),
  approveVoiceEpisode: (episode: string, channel: string, reviewer: string, note: string) =>
    call<{ items: { id: string; state: string }[]; episodeApproved: boolean }>(
      `/api/episodes/${episode}/voice-review`, { method: "PUT", json: { scope: "episode", reviewer, note } }, channel),

  /** المراجعات الفنية للقناة (توصيات المنفّذ وشرائطها ومقاطعها) */
  techReviews: (channel: string) => call<{ reviews: TechReviewSummary[] }>("/api/tech-reviews", undefined, channel),
  techReviewFileUrl: (channel: string, dir: string, id: string, rel: string) => `/api/tech-reviews/${encodeURIComponent(dir)}/${encodeURIComponent(id)}/${rel.split("/").map(encodeURIComponent).join("/")}?channel=${encodeURIComponent(channel)}`,
  /** مختبرات الإنتاج للقناة (ليست حلقات) */
  labs: (channel: string) => call<{ labs: LabSummary[] }>("/api/labs", undefined, channel),
  labStoryboards: (channel: string, dir: string) => call<{ entries: StoryboardEntry[] }>(`/api/labs/${encodeURIComponent(dir)}/storyboards`, undefined, channel),
  labStoryboardUrl: (channel: string, dir: string, file: string) => `/api/labs/${encodeURIComponent(dir)}/storyboards/${encodeURIComponent(file)}?channel=${encodeURIComponent(channel)}`,
  decideLabStoryboard: (channel: string, dir: string, slot: string, version: number, status: StoryboardStatus, note: string) =>
    call<{ version: StoryboardVersion }>(`/api/labs/${encodeURIComponent(dir)}/storyboards/${encodeURIComponent(slot)}/${version}/decision`, { method: "POST", json: { status, note } }, channel),
  labPreviewUrl: (channel: string, dir: string, name: string) => `/api/labs/${encodeURIComponent(dir)}/previews/${encodeURIComponent(name)}?channel=${encodeURIComponent(channel)}`,
  /** دليل الاستوديو للقناة (null إن لم يكن لها دليل) */
  guideIndex: (channel: string) => call<{ index: GuideIndex | null }>("/api/guide", undefined, channel),
  guidePage: (channel: string, file: string) => call<{ text: string }>(`/api/guide/${encodeURIComponent(file)}`, undefined, channel),
  /** غرفة العمليات: كل القنوات */
  ops: () => call<OpsChannel[]>("/api/ops"),
  saveCalendar: (channel: string, calendar: Record<string, CalendarDay>) => call("/api/calendar", { method: "PUT", json: { calendar } }, channel),
  channelFor: (channel: string) => call<ChannelConfig>("/api/channel", undefined, channel),
  saveChannelFor: (channel: string, c: ChannelConfig) => call("/api/channel", { method: "PUT", json: { channel: c } }, channel),
  saveIdeas: (channel: string, ideas: Idea[]) => call("/api/ideas", { method: "PUT", json: { ideas } }, channel),
  statusFor: (channel: string, id: string) => call<EpisodeStatus>(`/api/episodes/${id}/status`, undefined, channel),
  saveStatusFor: (channel: string, id: string, status: EpisodeStatus) => call(`/api/episodes/${id}/status`, { method: "PUT", json: { status } }, channel),
  channels: () => call<ChannelSummary[]>("/api/channels"),
  episodes: () => call<EpisodeSummary[]>("/api/episodes"),
  createEpisode: (b: { episode: string; slug: string; domain: string; title: string }) => call("/api/episodes", { method: "POST", json: b }),
  research: (id: string) => call<{ text: string; exists: boolean; label: string }>(`/api/episodes/${id}/research`),
  saveResearch: (id: string, text: string) => call<{ ok: boolean }>(`/api/episodes/${id}/research`, { method: "PUT", json: { text } }),
  sceneReview: (id: string) => call<{ items: SceneReviewItem[]; summary: SceneReviewSummary; criteria: string[] }>(`/api/episodes/${id}/scene-review`),
  setSceneReview: (id: string, b: { id: string; status: "ok" | "fix" | "pending"; note?: string }) => call<{ items: SceneReviewItem[]; summary: SceneReviewSummary; criteria: string[] }>(`/api/episodes/${id}/scene-review`, { method: "PUT", json: b }),
  review: (id: string) => call<{ items: ReviewItem[]; summary: ReviewSummary }>(`/api/episodes/${id}/review`),
  setReview: (id: string, b: { key: string; status: "verified" | "rejected" | "pending"; note?: string }) => call<{ items: ReviewItem[]; summary: ReviewSummary }>(`/api/episodes/${id}/review`, { method: "PUT", json: b }),
  deleteEpisode: (id: string, confirm: string) => call<{ ok: boolean; archived: number; pushed: boolean; note?: string }>(`/api/episodes/${id}`, { method: "DELETE", json: { confirm } }),
  episode: (id: string, channel?: string) => call<EpisodeData>(`/api/episodes/${id}`, undefined, channel),
  saveScript: (id: string, text: string) => call<{ check: CheckResult; plan: Plan } & ScriptSaveReply>(`/api/episodes/${id}/script`, { method: "PUT", json: { text } }),
  savePlan: (id: string, plan: Plan) => call(`/api/episodes/${id}/plan`, { method: "PUT", json: { plan } }),
  /** على خطة مصمَّمة يرفض الخادم (409) إلا بـ confirmRegenerate من planGuard.ts (رقم الحلقة مكتوبًا) */
  regenerate: (id: string, confirm: { overwriteDesigned?: true; confirmEpisode?: string } = {}) =>
    call<{ plan: Plan; backup?: string }>(`/api/episodes/${id}/plan/regenerate`, { method: "POST", json: confirm }),
  check: (text: string) => call<CheckResult>("/api/check", { method: "POST", json: { text } }),
  identity: () => call<{ identity: Identity; defaults: Identity }>("/api/identity"),
  saveIdentity: (identity: Identity) => call("/api/identity", { method: "PUT", json: { identity } }),
  render: (b: { episode: string; orientation: string; chapter?: number }) => call<RenderJob>("/api/render", { method: "POST", json: b }),
  jobs: () => call<RenderJob[]>("/api/render"),
  libraryImages: () => call<{ files: string[] }>("/api/library-images"),
  libraryImageUrl: (file: string) => withChannel(`/api/library-images/file/${encodeURIComponent(file)}`),
  uploadLibraryImage: (b: { slot: string; name: string; data: string }) => call<{ file: string }>("/api/library-images", { method: "POST", json: b }),
  uploadImage: (id: string, b: { name: string; data: string; scene: string }) => call<{ file: string; media: EpisodeMedia }>(`/api/episodes/${id}/images`, { method: "POST", json: b }),
  voice: (id: string, b: { scenes?: string[]; dryRun?: boolean; force?: boolean }) => call<{ report: VoiceReport; generated: boolean; media: EpisodeMedia }>(`/api/episodes/${id}/voice`, { method: "POST", json: b }),
  overview: () => call<Overview[]>("/api/overview"),
  status: (id: string) => call<EpisodeStatus>(`/api/episodes/${id}/status`),
  saveStatus: (id: string, status: EpisodeStatus) => call(`/api/episodes/${id}/status`, { method: "PUT", json: { status } }),
  packageInfo: (id: string) => call<PackageInfo>(`/api/episodes/${id}/package`),
  packageUrl: (id: string, file: string, download = false) => withChannel(`/api/episodes/${id}/package/${encodeURIComponent(file)}${download ? "?download=1" : ""}`),
  channel: () => call<ChannelConfig>("/api/channel"),
  saveChannel: (channel: ChannelConfig) => call("/api/channel", { method: "PUT", json: { channel } }),
  createChannel: (b: { id: string; name: string; language: string; nameLatin?: string; quran: boolean }) => call("/api/channels", { method: "POST", json: b }),
  updateStatus: (force = false) => call<{ available: boolean; behind: number; changes: string[]; error?: string; blocked?: string }>(`/api/update${force ? "?force=1" : ""}`),
  applyUpdate: () => call<{ ok: boolean; message: string; reinstalled?: boolean }>("/api/update", { method: "POST", json: {} }),
  kit: (id: string) => call<{ kit: PublishKit; keywords: string[]; chapters: string; chaptersEstimated?: boolean; chaptersSource?: "assembly" | "master" | "plan" }>(`/api/episodes/${id}/kit`),
  saveKit: (id: string, kit: PublishKit) => call(`/api/episodes/${id}/kit`, { method: "PUT", json: { kit } }),
  regenerateKit: (id: string) => call<{ kit: PublishKit; keywords: string[] }>(`/api/episodes/${id}/kit/regenerate`, { method: "POST", json: {} }),
  keys: () => call<{ keys: KeyState }>("/api/settings"),
  saveKeys: (updates: Record<string, string>) => call<{ keys: KeyState }>("/api/settings", { method: "PUT", json: { updates } }),
  /** تجربة سماع: النماذج المتاحة، وعيّنة بطبقة ونبرة ونموذج (تُحفظ فلا يُصرف رصيد مرتين) */
  voiceModels: (channel: string) => call<{ models: { id: string; name: string; arabic: boolean }[]; current: string }>("/api/voice-sample/models", undefined, channel),
  voiceSample: (channel: string, b: { text: string; tone?: string; model?: string; profile?: { speed: number; stability: number; style: number } }) =>
    call<{ file: string; cached: boolean; chars: number; model: string }>("/api/voice-sample", { method: "POST", json: b }, channel),
  voiceSampleUrl: (channel: string, file: string) => `/api/voice-sample/file/${encodeURIComponent(file)}?channel=${encodeURIComponent(channel)}`,
  testService: (service: "elevenlabs" | "quran") => call<{ ok: boolean; message?: string; account?: { tier: string; character_count: number; character_limit: number }; voices?: { id: string; name: string; category: string }[]; voiceFound?: boolean; models?: { id: string; name: string; arabic: boolean }[]; training?: Record<string, string>; voiceCategory?: string; model?: string; sample?: string; env?: string }>("/api/settings/test", { method: "POST", json: { service } }),
  sfx: () => call<SfxItem[]>("/api/sfx"),
  sfxUrl: (id: string) => withChannel(`/api/sfx/${id}.mp3`),
  startJob: (b: { kind: "make" | "package" | "shorts" | "sfx" | "storyboard-motion"; episode?: string; noVoice?: boolean }) => call<LongJob>("/api/jobs", { method: "POST", json: b }),
  /** إلغاء مهمة منتظرة أو جارية (رندر أو صناعة) */
  cancelJob: (id: string) => call<{ ok: boolean }>(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  storyboard: (id: string) => call<StoryboardInfo>(`/api/episodes/${id}/storyboard`),
  previewUrl: (id: string, name: string) => withChannel(`/api/episodes/${id}/previews/${encodeURIComponent(name)}`),
  reviewUrl: (id: string, name: string) => withChannel(`/api/episodes/${id}/reviews/${encodeURIComponent(name)}`),
  reviews: (id: string) => call<{ files: { name: string; title: string; note: string; mtime: number }[] }>(`/api/episodes/${id}/reviews`),
  previews: (id: string) => call<{ files: EpisodePreview[] }>(`/api/episodes/${id}/previews`),
  auditQuranScript: (id: string) =>
    call<{ environment: string; audits: { key: string; status: "match" | "differs" | "pending" | "missing" | "failed";
      reason?: string; categories: Record<string, string>; numbers: { ok: boolean; notes: string[] };
      ops: { at: number; op: string; shown: string; ref: string; cls: string }[] }[] }>(
      `/api/episodes/${id}/quran-audit`),
  missingQuranTexts: (id: string) =>
    call<{ status: { missing: string[]; existing: string[]; invalid: { ref: string; reason: string }[] } }>(
      `/api/episodes/${id}/quran-text-only`),
  fetchMissingQuranTexts: (id: string) =>
    call<{ result: { fetched: string[]; existing: string[]; failed: { ref: string; reason: string }[] };
      status: { missing: string[]; existing: string[]; invalid: { ref: string; reason: string }[] } }>(
      `/api/episodes/${id}/quran-text-only`, { method: "POST", json: { confirm: true } }),
  storyboardReport: (id: string) => call<{ markdown: string }>(`/api/episodes/${id}/storyboard-report`),
  setStoryboard: (id: string, action: "approve" | "revoke", auditNote?: string) => call<StoryboardInfo>(`/api/episodes/${id}/storyboard`, { method: "PUT", json: { action, auditNote } }),
  longJobs: () => call<LongJob[]>("/api/jobs"),
  videoUrl: (episode: string, file: string) => withChannel(`/api/episodes/${episode}/video/${encodeURIComponent(file)}`),
};
